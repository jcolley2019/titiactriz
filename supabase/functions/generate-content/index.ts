// generate-content — BLOG.2 (ported from joeyc.ai's generate-content)
//
// Titi's Content Studio: turns a brain dump or a YouTube transcript into a
// blog article and/or social packages for TikTok, Instagram, Pinterest and
// YouTube, in her voice (site_settings studio.voice), in ES or EN.
//
// Contract: POST with the caller's Supabase auth (admin only, the same check
// translate-text uses) and a body validated by validate.ts:
//   { input_kind, input_text, output_format: "social"|"blog", platform?,
//     language: "es"|"en", cascade_source?, web_search? }
//  - social -> JSON { content, usage, web_search_used }
//  - blog   -> server-sent events:
//      event: content_block_delta  {"text": "..."}      per released text delta
//      event: status               {"status": "searching"}
//      event: done                 {usage, web_search_used}
//      event: error                {"error": "..."}
//
// Kept from joeyc.ai: the static format block first with cache_control, the
// per-author voice block after it, optional web_search, pause_turn
// continuations, the 300 s deadline, NarrationFilter, SSE for the blog, and
// server-side pricing in `usage.cost_usd`.
// Dropped: X threads, LinkedIn, image/video prompts, Perplexity hashtags, X
// posting, the per-user daily quota and activity log (one admin), and the
// server-side history write — the Studio stores one studio_generations row per
// Generate press itself, because one press spans several calls.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import Anthropic from "npm:@anthropic-ai/sdk@0.128.0";
import { validateRequest } from "./validate.ts";
import { languageBlock, voiceBlock, type StudioVoice } from "./voice.ts";
import { derivativePrompt, systemPrompt } from "./prompts.ts";

// Model tiers — the same IDs joeyc.ai's generate-content uses today.
const MODELS = {
  research: "claude-sonnet-5", // the blog, and first-hand social packages
  derivative: "claude-haiku-4-5-20251001", // social packages distilled from the finished blog
};

// Anthropic list prices in USD per million tokens (copied from joeyc.ai, read 2026-09-24
// from https://platform.claude.com/docs/en/about-claude/pricing):
//   Claude Sonnet 5   input $2    5-minute cache write $2.50  cache hit $0.20  output $10
//   Claude Haiku 4.5  input $1    5-minute cache write $1.25  cache hit $0.10  output $5
//   Web search        $10 per 1,000 searches, on top of tokens
const MODEL_PRICING: Record<string, { input: number; cacheWrite: number; cacheRead: number; output: number }> = {
  "claude-sonnet-5": { input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 },
  "claude-haiku-4-5-20251001": { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 },
};
const WEB_SEARCH_USD_PER_REQUEST = 10 / 1000;

const MAX_WEB_SEARCHES = 5;
const MAX_TOKENS_BLOG = 8192;
const MAX_TOKENS_SOCIAL = 4096;
const MAX_TOKENS_DERIVATIVE = 2048;
// Supabase kills an edge function at 400 s wall clock. Stop the model well before that.
const GENERATION_DEADLINE_MS = 300_000;
const GENERATION_TIMEOUT_MESSAGE = "The research took too long and was stopped. Try again in a minute.";
// Text written before a tool call ("I'll research…", "Hitting a rate limit…")
// is held back this long; past it, the text is taken to be the content.
const NARRATION_MAX_CHARS = 600;

const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

interface GenerationUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  web_search_requests: number;
}

interface GenerationResult {
  content: string;
  usage: GenerationUsage;
  webSearchesUsed: boolean;
}

type StreamEvent = { type: "text"; text: string } | { type: "searching" };

class GenerationTimeout extends Error {
  constructor() {
    super(GENERATION_TIMEOUT_MESSAGE);
  }
}

/**
 * Keeps the model's between-search narration out of the content (joeyc.ai).
 * Text since the last tool call is held back until another tool call starts
 * (it was narration: dropped) or it grows past NARRATION_MAX_CHARS or the
 * generation ends (it is the content: released). With `articleStart`, text
 * before the first match is dropped too, until the article has started.
 * The client's stripThinkingText (src/lib/studio/narration.ts) is the second
 * line of defence for anything that still gets through.
 */
class NarrationFilter {
  content = "";
  private held = "";
  private live = false;

  constructor(
    private emit: (text: string) => void = () => {},
    private articleStart?: RegExp,
  ) {}

  text(text: string) {
    if (this.live) return this.release(text);
    this.held += text;
    if (this.held.length > NARRATION_MAX_CHARS) this.flush();
  }

  toolCall() {
    this.held = "";
    this.live = false;
  }

  flush() {
    this.live = true;
    let held = this.held;
    this.held = "";
    const start = !this.content && this.articleStart ? held.search(this.articleStart) : -1;
    if (start > 0) held = held.slice(start);
    if (held) this.release(held);
  }

  private release(text: string) {
    this.content += text;
    this.emit(text);
  }
}

// The blog opens with a ```meta fence, then the # title — at a line start or
// glued straight after a narration sentence ("…quota.# Title").
const BLOG_ARTICLE_START = /```meta|(?:^|(?<=[.!?…]))# /m;

const isToolCall = (blockType: string) => blockType.endsWith("tool_use"); // tool_use, server_tool_use, mcp_tool_use

function costUsd(model: string, u: GenerationUsage): number {
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  const tokens =
    u.input_tokens * p.input +
    u.cache_creation_input_tokens * p.cacheWrite +
    u.cache_read_input_tokens * p.cacheRead +
    u.output_tokens * p.output;
  return tokens / 1_000_000 + u.web_search_requests * WEB_SEARCH_USD_PER_REQUEST;
}

/** One generation, following pause_turn continuations (long web-search turns). */
async function callAnthropic(client: Anthropic, params: {
  model: string;
  maxTokens: number;
  system: Anthropic.TextBlockParam[];
  userMessage: string;
  useWebSearch: boolean;
  deadlineAt: number;
  articleStart?: RegExp;
  onEvent?: (e: StreamEvent) => void;
  signal?: AbortSignal;
}): Promise<GenerationResult> {
  const tools: Anthropic.ToolUnion[] = params.useWebSearch
    ? [{ type: "web_search_20260318", name: "web_search", max_uses: MAX_WEB_SEARCHES }]
    : [];

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: params.userMessage }];
  const usage: GenerationUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    web_search_requests: 0,
  };
  const onEvent = params.onEvent;
  const filter = new NarrationFilter(onEvent && ((text) => onEvent({ type: "text", text })), params.articleStart);
  let webSearchesUsed = false;
  let maxContinuations = 5;

  const abort = new AbortController();
  const onCallerAbort = () => abort.abort();
  params.signal?.addEventListener("abort", onCallerAbort, { once: true });
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    abort.abort();
  }, Math.max(0, params.deadlineAt - Date.now()));

  try {
    while (maxContinuations > 0) {
      maxContinuations--;
      if (timedOut) throw new GenerationTimeout();

      const body: Anthropic.MessageCreateParamsNonStreaming = {
        model: params.model,
        max_tokens: params.maxTokens,
        system: params.system,
        messages,
        ...(tools.length > 0 ? { tools } : {}),
        // Sonnet 5 thinks adaptively unless told not to; the prompts and budgets assume it off.
        ...(params.model.startsWith("claude-sonnet") ? { thinking: { type: "disabled" as const } } : {}),
      };

      let message: Anthropic.Message;
      if (onEvent) {
        const stream = client.messages.stream(body, { signal: abort.signal });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            filter.text(event.delta.text);
          } else if (event.type === "content_block_start" && isToolCall(event.content_block.type)) {
            filter.toolCall();
            if (event.content_block.type === "server_tool_use") onEvent({ type: "searching" });
          }
        }
        message = await stream.finalMessage();
      } else {
        message = await client.messages.create(body, { signal: abort.signal });
        for (const block of message.content) {
          if (block.type === "text") filter.text(block.text);
          else if (isToolCall(block.type)) filter.toolCall();
        }
      }

      usage.input_tokens += message.usage.input_tokens || 0;
      usage.output_tokens += message.usage.output_tokens || 0;
      usage.cache_creation_input_tokens += message.usage.cache_creation_input_tokens || 0;
      usage.cache_read_input_tokens += message.usage.cache_read_input_tokens || 0;
      usage.web_search_requests += message.usage.server_tool_use?.web_search_requests || 0;

      for (const block of message.content) {
        if (block.type === "web_search_tool_result") webSearchesUsed = true;
      }

      // pause_turn: send the partial turn back and let the model continue.
      if (message.stop_reason === "pause_turn") {
        messages = [...messages, { role: "assistant", content: message.content }];
        continue;
      }
      break;
    }
  } catch (err) {
    if (timedOut) throw new GenerationTimeout();
    throw err;
  } finally {
    clearTimeout(deadline);
    params.signal?.removeEventListener("abort", onCallerAbort);
  }
  filter.flush();

  return {
    content: filter.content,
    usage,
    webSearchesUsed: webSearchesUsed || usage.web_search_requests > 0,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const receivedAt = Date.now();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Admin gate — the same check translate-text uses, before the body is read.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!anthropic) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return json({ error: "Forbidden" }, 403);

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return json({ error: "Request body must be valid JSON" }, 400);
    }
    const validation = validateRequest(rawBody);
    if (!validation.ok) return json({ error: validation.error }, 400);
    const { input_kind, input_text, output_format, platform, language, cascade_source, web_search } =
      validation.value;

    // The voice comes from the database, never from the request body.
    const { data: voiceRow, error: voiceErr } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "studio.voice")
      .maybeSingle();
    if (voiceErr) console.error("studio.voice fetch failed:", voiceErr.message);
    const voice = (voiceRow?.value ?? null) as StudioVoice | null;

    const isDerivative = !!cascade_source;
    const isBlog = output_format === "blog";
    const source = input_kind === "youtube" ? "a YouTube video transcript" : "a brain dump";

    let model: string;
    let maxTokens: number;
    let formatPrompt: string; // identical on every call of this format: cached
    let userMessage: string;

    if (isDerivative) {
      model = MODELS.derivative;
      maxTokens = MAX_TOKENS_DERIVATIVE;
      formatPrompt = derivativePrompt(platform!);
      userMessage = `Here is the blog article to distill:\n\n${cascade_source}\n\nReformat this into the requested format. Stay faithful to the blog's content.`;
    } else if (isBlog) {
      model = MODELS.research;
      maxTokens = MAX_TOKENS_BLOG;
      formatPrompt = systemPrompt("blog");
      userMessage = `Here is the raw input (${source}):\n\n${input_text}\n\n` +
        (web_search
          ? "Research the topic (not the author) using web search, then write the blog article."
          : "Write the blog article from this input. Web search is not available.");
    } else {
      model = MODELS.research;
      maxTokens = MAX_TOKENS_SOCIAL;
      formatPrompt = systemPrompt("social", platform);
      userMessage = `Here is the raw input (${source}):\n\n${input_text}\n\n` +
        (web_search
          ? `Before writing, use web search to check any facts about the topic and to find hashtags that are active on ${platform} right now. Then write the package.`
          : "Transform this into the requested format. Web search is not available.");
    }

    // Static part first so the cache hits; the voice and language vary.
    const system: Anthropic.TextBlockParam[] = [
      { type: "text", text: formatPrompt, cache_control: { type: "ephemeral" } },
      { type: "text", text: `${voiceBlock(voice)}\n\n${languageBlock(language)}` },
    ];

    const generation = {
      model,
      maxTokens,
      system,
      userMessage,
      useWebSearch: web_search && !isDerivative,
      deadlineAt: receivedAt + GENERATION_DEADLINE_MS,
      articleStart: isBlog ? BLOG_ARTICLE_START : undefined,
    };

    const usagePayload = (result: GenerationResult) => ({
      usage: {
        ...result.usage,
        model,
        web_search_used: result.webSearchesUsed,
        cost_usd: Number(costUsd(model, result.usage).toFixed(6)),
      },
      web_search_used: result.webSearchesUsed,
    });

    // Blog: stream the released text as server-sent events, so the Studio shows
    // progress and a long research run keeps the connection busy.
    if (isBlog) {
      const encoder = new TextEncoder();
      const upstream = new AbortController();
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          const write = (chunk: string) => {
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch { /* client went away */ }
          };
          const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          const keepAlive = setInterval(() => write(": keep-alive\n\n"), 15_000);
          try {
            const result = await callAnthropic(anthropic, {
              ...generation,
              signal: upstream.signal,
              onEvent: (e) =>
                e.type === "text" ? send("content_block_delta", { text: e.text }) : send("status", { status: "searching" }),
            });
            if (result.content.trim()) send("done", usagePayload(result));
            else send("error", { error: "The model returned no content." });
          } catch (err) {
            console.error("Blog stream error:", err);
            send("error", { error: err instanceof Error ? err.message : "Generation failed" });
          } finally {
            clearInterval(keepAlive);
            try {
              controller.close();
            } catch { /* already closed */ }
          }
        },
        cancel() {
          // The Studio aborted (unmount or Cancel): stop paying for tokens nobody reads.
          upstream.abort();
        },
      });
      return new Response(body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const result = await callAnthropic(anthropic, generation);
    if (!result.content.trim()) return json({ error: "The model returned no content." }, 502);
    return json({ content: result.content, ...usagePayload(result) });
  } catch (err) {
    console.error("Error:", err);
    return json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      err instanceof GenerationTimeout ? 504 : 500,
    );
  }
});

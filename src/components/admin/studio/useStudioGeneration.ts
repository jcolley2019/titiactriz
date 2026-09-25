import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Lang } from "@/hooks/useEventsBoard";

/**
 * BLOG.2 — one Generate press in the Studio (ported from joeyc.ai's
 * useContentGeneration). Blog + social is a cascade: the article is researched
 * and streamed first, then each platform package is distilled from it by the
 * cheap model, in parallel. Social alone calls each platform first-hand.
 *
 * Outputs are kept exactly as the functions returned them; the tabs strip any
 * narration on display (stripThinkingText). The press is stored as ONE
 * studio_generations row once it finishes, whatever succeeded.
 */

export type StudioFormat = "social" | "blog";
export type StudioPlatform = "tiktok" | "instagram" | "pinterest" | "youtube";
export type InputKind = "brain_dump" | "youtube";

export const STUDIO_PLATFORMS: StudioPlatform[] = ["tiktok", "instagram", "pinterest", "youtube"];

export type StudioOutputs = {
  blog?: string;
  social?: Partial<Record<StudioPlatform, string>>;
};

export type StudioUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  web_search_requests: number;
  cost_usd: number;
  models: string[];
};

export type StudioStatus = "researching" | "writing" | "adapting" | "generating" | null;

export type GenerateParams = {
  inputKind: InputKind;
  inputText: string;
  sourceUrl: string | null;
  formats: StudioFormat[];
  platforms: StudioPlatform[];
  language: Lang;
};

export type Generation = {
  id: string | null;
  outputs: StudioOutputs;
  language: Lang;
  blogPostId: string | null;
};

// Mirrors MAX_INPUT_CHARS in supabase/functions/generate-content/validate.ts.
export const MAX_INPUT_CHARS = 30_000;
const REPAINT_MS = 80;

type CallUsage = Partial<Omit<StudioUsage, "models">> & { model?: string };
type CallResult = { content: string; usage: CallUsage };

type Body = {
  input_kind: InputKind;
  input_text: string;
  output_format: StudioFormat;
  platform?: StudioPlatform;
  language: Lang;
  cascade_source?: string;
};

/** A readable message from a failed functions.invoke. */
async function invokeError(error: Error & { context?: unknown }): Promise<string> {
  if (error.context instanceof Response) {
    try {
      const body = await error.context.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      /* not JSON */
    }
  }
  return error.message || "Generation failed";
}

async function callOnce(body: Body, signal: AbortSignal): Promise<CallResult> {
  const { data, error } = await supabase.functions.invoke("generate-content", { body, signal } as never);
  if (error) {
    if (signal.aborted) throw signal.reason;
    throw new Error(await invokeError(error));
  }
  return { content: String(data?.content ?? ""), usage: (data?.usage ?? {}) as CallUsage };
}

/**
 * The blog streams (server-sent events), which functions.invoke cannot read,
 * so it is a plain fetch with the session's token. `onText` gets the whole
 * article so far after each delta.
 */
async function streamBlog(
  body: Body,
  token: string,
  signal: AbortSignal,
  onText: (soFar: string) => void,
  onSearching: () => void,
): Promise<CallResult> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-content`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Generation failed (${res.status})`;
    try {
      const j = await res.json();
      if (typeof j?.error === "string") message = j.error;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  if (!(res.headers.get("Content-Type") ?? "").includes("text/event-stream") || !res.body) {
    const j = await res.json();
    return { content: String(j?.content ?? ""), usage: j?.usage ?? {} };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let done: { usage: CallUsage } | null = null;
  for (;;) {
    const { done: eof, value } = await reader.read();
    if (eof) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue; // keep-alive
      const payload = JSON.parse(data);
      if (event === "content_block_delta") {
        content += payload.text;
        onText(content);
      } else if (event === "status") {
        onSearching();
      } else if (event === "done") {
        done = payload;
      } else if (event === "error") {
        throw new Error(payload.error || "Generation failed");
      }
    }
  }
  if (!done) throw new Error("The connection closed before the article finished. Try again.");
  return { content, usage: done.usage ?? {} };
}

function sumUsage(results: CallUsage[]): StudioUsage {
  const total: StudioUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    web_search_requests: 0,
    cost_usd: 0,
    models: [],
  };
  const models = new Set<string>();
  for (const u of results) {
    total.input_tokens += u.input_tokens ?? 0;
    total.output_tokens += u.output_tokens ?? 0;
    total.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;
    total.cache_creation_input_tokens += u.cache_creation_input_tokens ?? 0;
    total.web_search_requests += u.web_search_requests ?? 0;
    total.cost_usd += u.cost_usd ?? 0;
    if (u.model) models.add(u.model);
  }
  total.cost_usd = Number(total.cost_usd.toFixed(6));
  total.models = [...models];
  return total;
}

export function useStudioGeneration() {
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<StudioStatus>(null);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<StudioUsage | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the Studio stops the calls (and the server stops the model).
  useEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const generate = useCallback(async (p: GenerateParams) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setGenerating(true);
    setStatus("generating");
    setError(null);
    setUsage(null);
    setGeneration({ id: null, outputs: {}, language: p.language, blogPostId: null });

    const outputs: StudioOutputs = {};
    const usages: CallUsage[] = [];
    const failures: string[] = [];
    let repaint: number | undefined;
    const paint = () => {
      if (repaint) return;
      repaint = window.setTimeout(() => {
        repaint = undefined;
        if (!signal.aborted) {
          setGeneration((g) => (g ? { ...g, outputs: { ...outputs, social: outputs.social && { ...outputs.social } } } : g));
        }
      }, REPAINT_MS);
    };

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");
      if (p.inputText.length > MAX_INPUT_CHARS) throw new Error("tooLong");

      const base = { input_kind: p.inputKind, input_text: p.inputText, language: p.language };
      const wantsBlog = p.formats.includes("blog");
      const wantsSocial = p.formats.includes("social") && p.platforms.length > 0;

      if (wantsBlog) {
        const res = await streamBlog(
          { ...base, output_format: "blog" },
          token,
          signal,
          (soFar) => {
            setStatus("writing");
            outputs.blog = soFar;
            paint();
          },
          () => setStatus("researching"),
        );
        outputs.blog = res.content;
        usages.push(res.usage);
        paint();
      }

      if (wantsSocial) {
        setStatus(wantsBlog ? "adapting" : "generating");
        outputs.social = {};
        const results = await Promise.allSettled(
          p.platforms.map(async (platform) => {
            const body: Body = wantsBlog && outputs.blog
              ? { ...base, output_format: "social", platform, cascade_source: outputs.blog }
              : { ...base, output_format: "social", platform };
            const res = await callOnce(body, signal);
            outputs.social![platform] = res.content;
            usages.push(res.usage);
            paint();
          }),
        );
        if (signal.aborted) throw signal.reason;
        results.forEach((r, i) => {
          if (r.status === "rejected") failures.push(`${p.platforms[i]}: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
        });
      }

      window.clearTimeout(repaint);
      const total = sumUsage(usages);
      setUsage(total);

      const produced = !!outputs.blog || Object.keys(outputs.social ?? {}).length > 0;
      let id: string | null = null;
      if (produced) {
        const { data, error: insertErr } = await supabase
          .from("studio_generations")
          .insert({
            input_kind: p.inputKind,
            input_text: p.inputText,
            source_url: p.sourceUrl,
            language: p.language,
            formats: p.formats,
            platforms: p.formats.includes("social") ? p.platforms : [],
            outputs: outputs as unknown as Json,
            usage: total as unknown as Json,
          })
          .select("id")
          .single();
        if (insertErr) failures.push(`history: ${insertErr.message}`);
        else id = data.id;
        setHistoryVersion((v) => v + 1);
      }
      setGeneration({ id, outputs: { ...outputs }, language: p.language, blogPostId: null });
      if (failures.length) setError(failures.join(" · "));
    } catch (e) {
      window.clearTimeout(repaint);
      if (signal.aborted) setError("cancelled");
      else setError(e instanceof Error ? e.message : "Generation failed");
      setGeneration((g) => (g ? { ...g, outputs: { ...outputs } } : g));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setGenerating(false);
      setStatus(null);
    }
  }, []);

  const extractTranscript = useCallback(async (url: string): Promise<{ transcript: string } | { error: string }> => {
    const { data, error: fnError } = await supabase.functions.invoke("youtube-transcript", { body: { url } });
    if (fnError) return { error: await invokeError(fnError) };
    const transcript = typeof data?.transcript === "string" ? data.transcript : "";
    return transcript ? { transcript } : { error: "No transcript text found" };
  }, []);

  return {
    generating,
    status,
    generation,
    setGeneration,
    error,
    setError,
    usage,
    historyVersion,
    generate,
    cancel,
    extractTranscript,
  };
}

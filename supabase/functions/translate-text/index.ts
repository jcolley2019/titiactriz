// translate-text — EVENTS.I18N.1
// The admin has ONE text field per thing. The owner types in whichever language
// they think in; this function decides which language that was and returns the
// faithful other half, so both locale slots can be filled from a single input.
//
// Contract: POST { text } with the caller's Supabase auth ->
//   { source: "es" | "en", target: "es" | "en", translation: string }
//
// Follows generate-alt-text's pattern: admin-only via the caller's bearer token,
// direct Anthropic API call with ANTHROPIC_API_KEY, no anon/publishable key.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CLAUDE_MODEL = "claude-opus-5";
const MAX_INPUT = 2000;

// Site copy is short, loud and punctuated ("Te Invito a Celebrar mi Cumpleanos!").
// A translator that "improves" it silently rewrites Titi's voice, so the prompt
// buys nothing but the language change.
const SYSTEM = `You translate short website copy for a Colombian actress's portfolio site between Spanish and English.

Given a single piece of text:
1. Decide whether it is Spanish ("es") or English ("en"). Judge the text as a whole; proper nouns, brand names, place names and dates do not decide it. If it is genuinely ambiguous (a bare name, a number, an emoji), answer with the language it would most naturally be read as.
2. Translate it faithfully into the OTHER language.

Rules for the translation:
- Translate meaning, not words. It must read naturally to a native speaker.
- Add nothing. Remove nothing. No explanations, no notes, no quotation marks around the result.
- Preserve the register, the capitalisation style (ALL CAPS stays ALL CAPS, Title Case stays Title Case), the punctuation energy (!!! stays !!!), and any emoji, exactly where they were.
- Leave proper nouns, brand names, handles and URLs alone.
- Keep dates, times and numbers in the target language's normal form (e.g. "8 de Agosto" <-> "August 8th", "8:00pm" stays "8:00pm").
- If the text is already in the target language or has no translatable content, return it unchanged.`;

const SCHEMA = {
  type: "object",
  properties: {
    source: { type: "string", enum: ["es", "en"] },
    translation: { type: "string" },
  },
  required: ["source", "translation"],
  additionalProperties: false,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    // Verify caller is a signed-in admin (token-based; no anon/publishable key needed)
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) return json({ error: "Missing text" }, 400);
    if (text.length > MAX_INPUT) return json({ error: "Text too long" }, 400);

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        system: SYSTEM,
        // Low effort: this is a one-line translation, not a reasoning problem.
        // Thinking stays on (the default) rather than disabled — cheaper AND it
        // keeps the structured answer clean.
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: SCHEMA },
        },
        messages: [{ role: "user", content: text }],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "Rate limited" }, 429);
      return json({ error: `AI error: ${txt.slice(0, 200)}` }, 500);
    }

    const aiJson = await aiRes.json();
    if (aiJson?.stop_reason === "refusal") return json({ error: "Refused" }, 500);

    const blocks = Array.isArray(aiJson?.content) ? aiJson.content : [];
    const raw = blocks
      .filter((b: { type?: string }) => b?.type === "text")
      .map((b: { text?: string }) => b?.text ?? "")
      .join("")
      .trim();
    if (!raw) return json({ error: "Empty AI response" }, 500);

    let parsed: { source?: unknown; translation?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "Unparseable AI response" }, 500);
    }

    const source = parsed.source === "en" ? "en" : parsed.source === "es" ? "es" : null;
    const translation = typeof parsed.translation === "string" ? parsed.translation.trim() : "";
    if (!source || !translation) return json({ error: "Incomplete AI response" }, 500);

    return json({ source, target: source === "es" ? "en" : "es", translation });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

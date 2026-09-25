/**
 * Whose voice the Studio writes in (BLOG.2, ported from joeyc.ai voice.ts).
 *
 * joeyc.ai read a per-user brand_profiles row. Titi's voice is one JSON
 * document in site_settings key `studio.voice`:
 *   { name, roles, audience, tone, topics[], avoid[], samplePhrases[] }
 * The format instructions are the same on every call and go first, so the
 * prompt cache can reuse them. This block is appended after them.
 *
 * The voice is admin-editable text that lands in a prompt, so every field is
 * capped. `avoid` only ADDS to the site laws in prompts.ts; it cannot lift one.
 */

export interface StudioVoice {
  name?: unknown;
  roles?: unknown;
  audience?: unknown;
  tone?: unknown;
  topics?: unknown;
  avoid?: unknown;
  samplePhrases?: unknown;
}

const MAX_FIELD_CHARS = 600;
const MAX_ITEM_CHARS = 300;
const MAX_ITEMS = 20;

const clip = (v: unknown, max = MAX_FIELD_CHARS): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const list = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).map((x) => clip(x, MAX_ITEM_CHARS)).filter(Boolean).slice(0, MAX_ITEMS);

// Used only if studio.voice is missing or has no name: the shipped identity, nothing more.
const DEFAULT_NAME = "Cristyna Polentino (Titi, TitiActriz)";
const DEFAULT_ROLES = "Actriz · Streamer · Empresaria";

const SITE_URL = "https://www.titiactriz.com";

export function voiceBlock(voice?: StudioVoice | null): string {
  const name = clip(voice?.name, 120) || DEFAULT_NAME;
  const roles = clip(voice?.roles, 120) || DEFAULT_ROLES;
  const lines = [
    `You are a content creation assistant for ${name}: ${roles}. Everything you write is in her voice, in the first person, and published under her name.`,
  ];
  const audience = clip(voice?.audience);
  if (audience) lines.push(`Audience: ${audience}`);
  const tone = clip(voice?.tone);
  if (tone) lines.push(`Tone: ${tone}`);

  const topics = list(voice?.topics);
  if (topics.length) lines.push(`What she creates about:\n${topics.map((t) => `- ${t}`).join("\n")}`);

  const avoid = list(voice?.avoid);
  if (avoid.length) {
    lines.push(
      `Never write about (in addition to the SITE LAWS, which always apply):\n${avoid.map((t) => `- ${t}`).join("\n")}`,
    );
  }

  const phrases = list(voice?.samplePhrases);
  if (phrases.length) {
    lines.push(
      `Lines she has written on her own site, as a reference for her voice and rhythm. Do not paste them in unless one genuinely fits:\n${phrases.map((t) => `- "${t}"`).join("\n")}`,
    );
  }
  lines.push(`When the instructions above say "the author", they mean ${name}.`);

  return `## AUTHOR — whose voice to write in

${lines.join("\n\n")}

**Author sign-off** — a blog article ends with a --- separator followed by exactly:
*${name}. ${roles}. [titiactriz.com](${SITE_URL})*`;
}

/** The per-call language instruction. Not cached: it changes with the ES/EN toggle. */
export function languageBlock(language: "es" | "en"): string {
  const target = language === "es"
    ? "Spanish, the way a Colombian woman writes it: natural, warm Latin American Spanish (tú, never vos; no Spain-only slang)"
    : "English: natural, conversational American English";
  return `## OUTPUT LANGUAGE

Write every word of the output in ${target}, whatever language the input is in. That includes titles, headings, FAQ questions, captions, scripts and hashtags (a hashtag may stay in the language it trends in).
Two things stay exactly as written: the bold section labels of a social package (e.g. **🎬 HOOK**), and the two field names inside the \`\`\`meta block ("Primary Keyword:" and "Meta Description:"). The field values are in the output language.`;
}

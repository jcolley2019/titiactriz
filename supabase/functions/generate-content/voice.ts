/**
 * Whose voice the Studio writes in (BLOG.2, ported from joeyc.ai voice.ts).
 *
 * joeyc.ai read a per-user brand_profiles row. Titi's voices are JSON
 * documents in site_settings, one per named voice (STUDIO.VOICES.1):
 * `studio.voice.personal` and `studio.voice.greenworld`, each
 *   { name, roles, audience, tone, topics[], avoid[], samplePhrases[] }
 * The bare key `studio.voice` stays as the fallback for a named voice that has
 * no document yet (and for old clients).
 * The format instructions are the same on every call and go first, so the
 * prompt cache can reuse them. This block is appended after them.
 *
 * The voice is admin-editable text that lands in a prompt, so every field is
 * capped. `avoid` only ADDS to the site laws in prompts.ts; it cannot lift one.
 */

import type { GwKind, GwProduct, Voice } from "./validate.ts";

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

/** The document a named voice is read from, and the one it falls back to. */
export const voiceKey = (voice: Voice): string => `studio.voice.${voice}`;
export const FALLBACK_VOICE_KEY = "studio.voice";

const isDocument = (v: unknown): v is StudioVoice => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * The voice's document out of the site_settings rows fetched for it: the named
 * voice's own, else studio.voice, else null (voiceBlock then writes the built-in
 * defaults below).
 */
export function pickVoice(rows: { key: string; value: unknown }[] | null | undefined, voice: Voice): StudioVoice | null {
  for (const key of [voiceKey(voice), FALLBACK_VOICE_KEY]) {
    const value = rows?.find((r) => r.key === key)?.value;
    if (isDocument(value)) return value;
  }
  return null;
}

// Used only if no voice document exists or it has no name: the shipped identity, nothing more.
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

/**
 * Cristyna's Green World storefront — mirrors GREEN_WORLD_SHOP_URL in
 * src/lib/ventures.ts, where the Green World page's "Shop" button points. A
 * Producto piece with no product link of its own points here.
 */
export const GREEN_WORLD_SHOP_URL =
  "https://us.world-food.com/#/shareLoginIn&MjI1Mjg0Mjc7MjIyNjUyNDg7MjAyNi0wMy0wNyAxOToyNDo1NQ==";

/**
 * BLOG.GW.2 — what kind of Green World piece this is, appended after the voice
 * block for the greenworld voice only (empty otherwise). Not cached: it changes
 * with the Studio's Tipo. The no-health-claims law still closes the format
 * prompt (GREEN_WORLD_LAW); each kind restates the part of it that kind is most
 * likely to trip over.
 *
 * ADMIN.FIXES.1 (v5) — it takes the press's products, in order. A Producto
 * piece is about them: one product reads exactly as v4's single product did;
 * several are listed, each with its link (or the Green World shop's), and the
 * piece points to each. A Capacitación or Negocio piece lists the products it
 * mentions and links each where it names it. Names and links reach here
 * validated (one line, capped; http(s) only; at most six).
 */
export function kindBlock(kind: GwKind | undefined, products: GwProduct[] = []): string {
  if (!kind) return "";
  const listed = products
    .map(
      (p) =>
        `- ${p.name ? `"${p.name}"` : "a Green World product, named as the input names it"} — ${
          p.url ? p.url : `${GREEN_WORLD_SHOP_URL} (the Green World shop)`
        }`,
    )
    .join("\n");
  if (kind === "producto") {
    if (products.length > 1) {
      return `## PIECE KIND — Producto (${products.length} products)

This piece is about these ${products.length} Green World products, in this order, each with the address its link goes to:
${listed}

Say what each one is, who it is for, and how it fits into an everyday routine — from the author's own use, as far as the input gives it. Describe them only in the words of bienestar y nutrición (wellness and nutrition): never say or imply that any of them treats, cures, prevents, relieves or diagnoses anything, never promise a result, never compare them with medicine. If the input makes such a claim, leave it out.

It ends by pointing the reader to each product: a Markdown link per product to the address listed above — in a blog article as its closing lines before the author sign-off, in a social package in the CTA or caption. The visible text names the product or says where it goes (e.g. "Ver el producto en Green World"), never the raw address; each target is exactly its listed address. The author gave these links, so they count as links she gives.`;
    }
    const product = products[0];
    const about = product?.name
      ? `ONE named Green World product: "${product.name}"`
      : "ONE Green World product, named as the input names it";
    const url = product?.url ?? GREEN_WORLD_SHOP_URL;
    const where = product?.url ? "the product's own page" : "the Green World shop";
    return `## PIECE KIND — Producto (one product)

This piece is about ${about}. Say what it is, who it is for, and how it fits into an everyday routine — from the author's own use, as far as the input gives it. Describe it only in the words of bienestar y nutrición (wellness and nutrition): never say or imply that it treats, cures, prevents, relieves or diagnoses anything, never promise a result, never compare it with medicine. If the input makes such a claim, leave it out.

It ends by pointing the reader to the product: a Markdown link to ${where}, ${url} — in a blog article as its closing line before the author sign-off, in a social package in the CTA or caption. The visible text names the product or says where it goes (e.g. "Ver el producto en Green World"), never the raw address; the target is exactly that address. The author gave this link, so it counts as a link she gives.`;
  }
  const mentioned = products.length
    ? `

The author lists the Green World products this piece mentions, each with the address its link goes to:
${listed}

Where the piece names one of them, link it once: a Markdown link to its listed address, the visible text its name (or where it goes), never the raw address. The author gave these links, so they count as links she gives. Name no other product's link.`
    : "";
  if (kind === "capacitacion") {
    return `## PIECE KIND — Capacitación (training)

This piece teaches ONE skill or process to Green World distributors — for example placing an order, following up with a customer, or presenting a product honestly. Say who it is for, then the steps in order, then the mistakes to avoid. Practical and specific, from the author's own experience as far as the input gives it. Any product it mentions is described only as bienestar y nutrición, never with a health claim, and it promises no income.${mentioned}`;
  }
  return `## PIECE KIND — Negocio (the business side)

This piece is about the business side of Green World: what being a distributor involves and how the opportunity works — honest and specific about what it takes in time, effort and learning, from the author's own experience as far as the input gives it. Never state, imply or estimate income, earnings or results, and never promise financial freedom or quick success. Any product it mentions is described only as bienestar y nutrición, never with a health claim.${mentioned}`;
}

/** The per-call language instruction. Not cached: it changes with the ES/EN toggle. */
export function languageBlock(language: "es" | "en"): string {
  const target = language === "es"
    ? "Spanish, the way a Colombian woman writes it: natural, warm Latin American Spanish (tú, never vos; no Spain-only slang)"
    : "English: natural, conversational American English";
  return `## OUTPUT LANGUAGE

Write every word of the output in ${target}, whatever language the input is in. That includes titles, headings, FAQ questions, captions, scripts and hashtags (a hashtag may stay in the language it trends in).
Two things stay exactly as written: the bold section labels of a social package (e.g. **🎬 HOOK**) — a blog article's callout labels are not among them and are in the output language — and the two field names inside the \`\`\`meta block ("Primary Keyword:" and "Meta Description:"). The field values are in the output language.`;
}

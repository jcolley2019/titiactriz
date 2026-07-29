/**
 * CINE.FLOW.6 — the wide reel's story chapters (01/02/03).
 *
 * Each numbered slide is an editorial spread on desktop: the photo plate on one
 * side, a story chapter on the other. The chapter copy lives HERE as in-repo
 * defaults and is overridable per chapter through the site_settings keys
 * `reel.chapter1..3`, whose value is a JSON document of this exact shape:
 *
 *   { "es": { "eyebrow": "...", "title": "...", "body": "..." },
 *     "en": { "eyebrow": "...", "title": "...", "body": "..." } }
 *
 * Partial documents are legal — any field absent or empty falls back to the
 * default for that locale — so REEL.COPY.1's admin editor can save exactly what
 * Titi answers and nothing else. This module never writes the keys.
 *
 * COPY LAW. The seed copy below is restated STRICTLY from copy this repo
 * already ships; it introduces no new biographical claim. Sources, per chapter:
 *   1 — i18n `hero.roles.actress` and `hero.description` (verbatim body).
 *   2 — i18n `hero.roles.streamer`, `about.p1` ("conocida por mi comunidad como
 *       Titi (TitiActriz)") and `about.p3` ("el poder de contar historias para
 *       crear conexión e inspirar cambios"), restated in third person.
 *   3 — i18n `hero.roles.entrepreneur`, `about.p2` ("construyendo negocios que
 *       importan" / "building businesses that matter") and `cinematic.gwSeq`
 *       ("Distribuidora oficial" · "Green World" · "Bienestar natural, directo
 *       de la fuente").
 * Where the shipped copy is thin the chapter is SHORT rather than invented.
 */

export type ReelChapterCopy = { eyebrow: string; title: string; body: string };
export type ReelChapterLocale = "es" | "en";
export type ReelChapterDoc = Record<ReelChapterLocale, ReelChapterCopy>;

/** The three site_settings keys, in slide order. Read-only from this layer. */
export const REEL_CHAPTER_KEYS = ["reel.chapter1", "reel.chapter2", "reel.chapter3"] as const;

export const REEL_CHAPTER_DEFAULTS: readonly ReelChapterDoc[] = [
  {
    es: {
      eyebrow: "Actriz Colombiana",
      title: "Movimiento y emoción",
      body: "Dando vida a historias a través del movimiento y la emoción. Cada rol es un viaje, cada actuación una conexión.",
    },
    en: {
      eyebrow: "Colombian Actress",
      title: "Movement and emotion",
      body: "Bringing stories to life through movement and emotion. Every role is a journey, every performance a connection.",
    },
  },
  {
    es: {
      eyebrow: "Streamer de TikTok",
      title: "Conocida como Titi",
      body: "Su comunidad la conoce como Titi (TitiActriz). Cree en el poder de contar historias para crear conexión e inspirar cambios.",
    },
    en: {
      eyebrow: "TikTok Streamer",
      title: "Known as Titi",
      body: "Her community knows her as Titi (TitiActriz). She believes in the power of storytelling to create connection and inspire change.",
    },
  },
  {
    es: {
      eyebrow: "Emprendedora",
      title: "Negocios que importan",
      body: "Distribuidora oficial de Green World — bienestar natural, directo de la fuente.",
    },
    en: {
      eyebrow: "Entrepreneur",
      title: "Businesses that matter",
      body: "Official Green World distributor — natural wellness, straight from the source.",
    },
  },
] as const;

const asText = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v : null;

/**
 * Resolve one chapter for one locale: the stored JSON wins field-by-field over
 * the in-repo default; anything unparsable or empty falls through silently
 * (an admin typo must never blank a shipped slide).
 */
export function resolveReelChapter(
  raw: string | null | undefined,
  index: number,
  locale: ReelChapterLocale,
): ReelChapterCopy {
  const fallback = REEL_CHAPTER_DEFAULTS[index]?.[locale] ?? REEL_CHAPTER_DEFAULTS[0][locale];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<ReelChapterLocale, Partial<ReelChapterCopy>>>;
    const doc = parsed?.[locale];
    return {
      eyebrow: asText(doc?.eyebrow) ?? fallback.eyebrow,
      title: asText(doc?.title) ?? fallback.title,
      body: asText(doc?.body) ?? fallback.body,
    };
  } catch {
    return fallback;
  }
}

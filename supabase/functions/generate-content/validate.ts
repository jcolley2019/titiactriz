/**
 * Request validation for generate-content (BLOG.2, ported from joeyc.ai).
 *
 * Every field that ends up inside a prompt is an enum or length-capped, so a
 * caller cannot smuggle instructions through a label or run up a max-size call
 * with an unbounded body. The voice's CONTENT is never accepted from the body:
 * the body names one of two voices (STUDIO.VOICES.1) and the function reads that
 * voice's document from site_settings itself.
 *
 * BLOG.GW.2 — a Green World call may name its kind (gw_kind). They mean
 * something only for the greenworld voice: on any other voice they are dropped.
 *
 * ADMIN.FIXES.1 (v5) — and its products, gw_products: up to MAX_GW_PRODUCTS rows
 * of { name?, url? }, each name capped and flattened to one line, each url
 * http(s) only; a row with neither is dropped. Any kind may carry them (a
 * Producto piece is about them, a Capacitación or Negocio piece mentions them);
 * a call with no kind, or on another voice, drops them. The old single pair
 * (gw_product_name / gw_product_url) is no longer read.
 */

export const INPUT_KINDS = ["brain_dump", "youtube"] as const;
export const OUTPUT_FORMATS = ["social", "blog"] as const;
export const PLATFORMS = ["tiktok", "instagram", "pinterest", "youtube"] as const;
export const LANGUAGES = ["es", "en"] as const;
export const VOICES = ["personal", "greenworld"] as const;
/** Mirrors GW_KINDS in src/lib/blog.ts and blog_posts_gw_kind_check. */
export const GW_KINDS = ["producto", "capacitacion", "negocio"] as const;

export const MAX_INPUT_CHARS = 30_000; // input_text and cascade_source
export const MAX_PRODUCT_NAME_CHARS = 120;
export const MAX_PRODUCT_URL_CHARS = 500;
/** Mirrors MAX_GW_PRODUCTS in src/lib/blog.ts. */
export const MAX_GW_PRODUCTS = 6;

export type InputKind = typeof INPUT_KINDS[number];
export type OutputFormat = typeof OUTPUT_FORMATS[number];
export type Platform = typeof PLATFORMS[number];
export type Language = typeof LANGUAGES[number];
export type Voice = typeof VOICES[number];
export type GwKind = typeof GW_KINDS[number];

/** One product a Green World piece names: both optional, never both missing. */
export interface GwProduct {
  name?: string;
  url?: string;
}

export interface GenerateRequest {
  input_kind: InputKind;
  input_text: string;
  output_format: OutputFormat;
  platform?: Platform;
  language: Language;
  /** Which of her two voices writes: site_settings studio.voice.<voice>. Default personal. */
  voice: Voice;
  /** Blog article to derive this social package from (the cascade). */
  cascade_source?: string;
  /** Let the model research the topic on the web. Default on for first-hand calls; never for derivatives. */
  web_search: boolean;
  /** BLOG.GW.2 — the Green World kind; undefined on a personal call. */
  gw_kind?: GwKind;
  /** ADMIN.FIXES.1 — the products of a call with a kind, in order; undefined when there are none. */
  gw_products?: GwProduct[];
}

export type ValidationResult =
  | { ok: true; value: GenerateRequest }
  | { ok: false; error: string };

const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);

export function validateRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  if (!isOneOf(OUTPUT_FORMATS, b.output_format)) {
    return { ok: false, error: `output_format must be one of: ${OUTPUT_FORMATS.join(", ")}` };
  }
  if (!isOneOf(LANGUAGES, b.language)) {
    return { ok: false, error: `language must be one of: ${LANGUAGES.join(", ")}` };
  }

  if (b.voice !== undefined && b.voice !== null && !isOneOf(VOICES, b.voice)) {
    return { ok: false, error: `voice must be one of: ${VOICES.join(", ")}` };
  }

  const inputKind = b.input_kind ?? (b.cascade_source ? "brain_dump" : undefined);
  if (!isOneOf(INPUT_KINDS, inputKind)) {
    return { ok: false, error: `input_kind must be one of: ${INPUT_KINDS.join(", ")}` };
  }

  if (b.output_format === "social" && !isOneOf(PLATFORMS, b.platform)) {
    return { ok: false, error: `platform must be one of: ${PLATFORMS.join(", ")}` };
  }
  if (b.output_format === "blog" && b.platform !== undefined && b.platform !== null) {
    return { ok: false, error: "platform applies to social posts only" };
  }

  for (const field of ["input_text", "cascade_source"] as const) {
    const v = b[field];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string") return { ok: false, error: `${field} must be a string` };
    if (v.length > MAX_INPUT_CHARS) {
      return {
        ok: false,
        error: `${field} is too long (${v.length.toLocaleString("en-US")} characters; max ${MAX_INPUT_CHARS.toLocaleString("en-US")})`,
      };
    }
  }

  const cascadeSource = typeof b.cascade_source === "string" && b.cascade_source.trim() ? b.cascade_source : undefined;
  if (cascadeSource && b.output_format === "blog") {
    return { ok: false, error: "cascade_source derives social posts from a blog; it cannot derive a blog" };
  }
  const inputText = typeof b.input_text === "string" ? b.input_text : "";
  if (!cascadeSource && !inputText.trim()) {
    return { ok: false, error: "input_text is required" };
  }

  if (b.web_search !== undefined && b.web_search !== null && typeof b.web_search !== "boolean") {
    return { ok: false, error: "web_search must be a boolean" };
  }

  // BLOG.GW.2 — the kind; ADMIN.FIXES.1 — its products. Shape-checked whatever the voice; used only for greenworld.
  if (b.gw_kind !== undefined && b.gw_kind !== null && !isOneOf(GW_KINDS, b.gw_kind)) {
    return { ok: false, error: `gw_kind must be one of: ${GW_KINDS.join(", ")}` };
  }
  // ADMIN.FIXES.1 — the products, row by row; any row that is not clean refuses the call.
  const products: GwProduct[] = [];
  if (b.gw_products !== undefined && b.gw_products !== null) {
    if (!Array.isArray(b.gw_products)) return { ok: false, error: "gw_products must be an array" };
    if (b.gw_products.length > MAX_GW_PRODUCTS) {
      return { ok: false, error: `gw_products has too many rows (max ${MAX_GW_PRODUCTS})` };
    }
    for (const [i, row] of b.gw_products.entries()) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return { ok: false, error: `gw_products[${i}] must be an object` };
      }
      const r = row as Record<string, unknown>;
      let name: string | undefined;
      if (r.name !== undefined && r.name !== null) {
        if (typeof r.name !== "string") return { ok: false, error: `gw_products[${i}].name must be a string` };
        // One line of plain text: control characters and runs of whitespace become single spaces.
        name = r.name.replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim() || undefined;
        if (name && name.length > MAX_PRODUCT_NAME_CHARS) {
          return { ok: false, error: `gw_products[${i}].name is too long (max ${MAX_PRODUCT_NAME_CHARS} characters)` };
        }
      }
      let url: string | undefined;
      if (r.url !== undefined && r.url !== null) {
        if (typeof r.url !== "string") return { ok: false, error: `gw_products[${i}].url must be a string` };
        url = r.url.trim() || undefined;
        if (url) {
          if (url.length > MAX_PRODUCT_URL_CHARS) {
            return { ok: false, error: `gw_products[${i}].url is too long (max ${MAX_PRODUCT_URL_CHARS} characters)` };
          }
          let parsed: URL | null = null;
          try {
            parsed = /^https?:\/\/\S+$/i.test(url) ? new URL(url) : null;
          } catch {
            parsed = null;
          }
          if (!parsed || !parsed.hostname) return { ok: false, error: `gw_products[${i}].url must be an http(s) link` };
        }
      }
      if (name || url) products.push({ ...(name ? { name } : {}), ...(url ? { url } : {}) });
    }
  }
  const voice: Voice = isOneOf(VOICES, b.voice) ? b.voice : "personal";
  const gwKind = voice === "greenworld" && isOneOf(GW_KINDS, b.gw_kind) ? b.gw_kind : undefined;
  const gwProducts = gwKind && products.length ? products : undefined;

  return {
    ok: true,
    value: {
      input_kind: inputKind,
      input_text: inputText,
      output_format: b.output_format,
      platform: (b.platform ?? undefined) as Platform | undefined,
      language: b.language,
      voice,
      cascade_source: cascadeSource,
      web_search: cascadeSource ? false : b.web_search !== false,
      gw_kind: gwKind,
      gw_products: gwProducts,
    },
  };
}

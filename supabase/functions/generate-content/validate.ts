/**
 * Request validation for generate-content (BLOG.2, ported from joeyc.ai).
 *
 * Every field that ends up inside a prompt is an enum or length-capped, so a
 * caller cannot smuggle instructions through a label or run up a max-size call
 * with an unbounded body. The voice is NOT accepted from the body: the
 * function reads site_settings studio.voice itself.
 */

export const INPUT_KINDS = ["brain_dump", "youtube"] as const;
export const OUTPUT_FORMATS = ["social", "blog"] as const;
export const PLATFORMS = ["tiktok", "instagram", "pinterest", "youtube"] as const;
export const LANGUAGES = ["es", "en"] as const;

export const MAX_INPUT_CHARS = 30_000; // input_text and cascade_source

export type InputKind = typeof INPUT_KINDS[number];
export type OutputFormat = typeof OUTPUT_FORMATS[number];
export type Platform = typeof PLATFORMS[number];
export type Language = typeof LANGUAGES[number];

export interface GenerateRequest {
  input_kind: InputKind;
  input_text: string;
  output_format: OutputFormat;
  platform?: Platform;
  language: Language;
  /** Blog article to derive this social package from (the cascade). */
  cascade_source?: string;
  /** Let the model research the topic on the web. Default on for first-hand calls; never for derivatives. */
  web_search: boolean;
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

  return {
    ok: true,
    value: {
      input_kind: inputKind,
      input_text: inputText,
      output_format: b.output_format,
      platform: (b.platform ?? undefined) as Platform | undefined,
      language: b.language,
      cascade_source: cascadeSource,
      web_search: cascadeSource ? false : b.web_search !== false,
    },
  };
}

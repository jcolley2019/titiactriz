import { supabase } from "@/integrations/supabase/client";
import { isStreamRef } from "@/lib/stream";
import type { Lang } from "@/hooks/useEventsBoard";

/**
 * GW.GUIDE.1 — the "Cómo comprar" guide on /green-world: one tutorial video
 * per language, numbered steps with an optional screenshot each, and where the
 * register button goes. Stored whole in site_settings under `greenworld_guide`
 * and edited from the admin's Green World section.
 *
 * Absent config is a complete, valid state: no video and no steps means the
 * public section renders its heading, intro and CTA and nothing else. Every
 * field is optional on read, so a half-written or hand-edited row degrades to
 * that same state rather than to a broken section.
 */
export const GREEN_WORLD_GUIDE_KEY = "greenworld_guide";

/** The steps list stops here — a guide longer than this is a different page. */
export const GUIDE_MAX_STEPS = 12;

export type GuideLocalized = { es: string; en: string };

export type GuideStep = {
  id: string;
  title: GuideLocalized;
  body: GuideLocalized;
  image: { url: string; alt: string } | null;
};

export type GreenWorldGuide = {
  video: { es: string | null; en: string | null };
  /** null → GREEN_WORLD_SHOP_URL from src/lib/ventures.ts. */
  signupUrl: string | null;
  steps: GuideStep[];
};

export const emptyGreenWorldGuide = (): GreenWorldGuide => ({
  video: { es: null, en: null },
  signupUrl: null,
  steps: [],
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const localized = (v: unknown): GuideLocalized =>
  isRecord(v) ? { es: str(v.es), en: str(v.en) } : { es: "", en: "" };

/** A video slot keeps only a Stream ref; a legacy URL or garbage is no video. */
const videoRef = (v: unknown): string | null => (isStreamRef(v) ? v : null);

const coerceStep = (raw: unknown, index: number): GuideStep | null => {
  if (!isRecord(raw)) return null;
  const image = isRecord(raw.image) && str(raw.image.url) ? { url: str(raw.image.url), alt: str(raw.image.alt) } : null;
  return {
    id: str(raw.id) || `step-${index + 1}`,
    title: localized(raw.title),
    body: localized(raw.body),
    image,
  };
};

/** Whatever the row holds → a guide the page can render. Never throws. */
export const coerceGreenWorldGuide = (raw: unknown): GreenWorldGuide => {
  if (!isRecord(raw)) return emptyGreenWorldGuide();
  const video = isRecord(raw.video) ? raw.video : {};
  const steps = Array.isArray(raw.steps)
    ? raw.steps.map(coerceStep).filter((s): s is GuideStep => s !== null).slice(0, GUIDE_MAX_STEPS)
    : [];
  return {
    video: { es: videoRef(video.es), en: videoRef(video.en) },
    signupUrl: str(raw.signupUrl) || null,
    steps,
  };
};

/**
 * The clip for a viewer's language: their own, else the Spanish one (flagged
 * so the section can say "Video en español"), else nothing. An English-only
 * clip never stands in for the Spanish one — ES is the primary language, and a
 * Spanish reader is not sent to an English tutorial unannounced.
 */
export const pickGuideVideo = (
  guide: GreenWorldGuide,
  lang: Lang,
): { ref: string; fallbackFromEs: boolean } | null => {
  const own = guide.video[lang];
  if (own) return { ref: own, fallbackFromEs: false };
  if (lang === "en" && guide.video.es) return { ref: guide.video.es, fallbackFromEs: true };
  return null;
};

/** A localized field in the viewer's language, else Spanish — no blank cells. */
export const guideText = (field: GuideLocalized, lang: Lang): string =>
  (lang === "en" && field.en) || field.es || field.en;

/* ─────────────────────── site_settings read / write ─────────────────────── */

export const fetchGreenWorldGuide = async (): Promise<GreenWorldGuide> => {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", GREEN_WORLD_GUIDE_KEY)
    .maybeSingle();
  if (error) throw error;
  return coerceGreenWorldGuide(data?.value);
};

export const setGreenWorldGuide = async (next: GreenWorldGuide): Promise<void> => {
  const { error } = await supabase.from("site_settings").upsert({
    key: GREEN_WORLD_GUIDE_KEY,
    value: next as unknown as never,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

import type { Focal } from "@/hooks/useCinematicMedia";

/**
 * BLOG.COVERFRAME.1 — one post's cover framing: where its photograph sits in
 * the crop. Stored as blog_posts.cover_framing (jsonb) in exactly this shape:
 *
 *   { "focal": { "x": 0..1, "y": 0..1 } }
 *
 * A focal point and nothing else — no zoom, no fit, no device classes. Every
 * cover surface is the same fill crop (the 3:2 plate on the /blog cards, the
 * post page and the home act; fixed-size thumbs on the Green World card and in
 * the admin editor), so one point is the whole story, and it renders as a plain
 * object-position on the img that is already object-cover.
 *
 * ABSENT IS DEFAULT, TOTALLY. A null or unreadable cell renders exactly as
 * before this brick: a portrait keeps its upper part (BLOG.FIXES.1), a landscape
 * stays centred. The admin's reset writes null, never {} or a default object.
 */
export type CoverFraming = { focal: Focal };

/**
 * BLOG.FIXES.1 — the crop without a framing. Gallery photos carry no focal
 * point, so a portrait in the 3:2 box cropped dead-centre cut her head off (the
 * Green World card, live): a portrait keeps its upper part, a landscape stays
 * centred.
 */
export const PORTRAIT_COVER_POSITION = "50% 18%";
export const LANDSCAPE_COVER_POSITION = "50% 50%";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * A stored cell, or undefined when it holds no framing. Out-of-range numbers
 * clamp to 0..1; a missing or non-finite coordinate means no framing at all
 * (the default rule), never a half-guessed point.
 */
export const coerceCoverFraming = (raw: unknown): CoverFraming | undefined => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const focal = (raw as { focal?: unknown }).focal;
  if (!focal || typeof focal !== "object" || Array.isArray(focal)) return undefined;
  const { x, y } = focal as { x?: unknown; y?: unknown };
  if (!isNum(x) || !isNum(y)) return undefined;
  return { focal: { x: clamp01(x), y: clamp01(y) } };
};

/**
 * The img's object-position. Whole percents, so what the browser computes reads
 * back equal to what was stored.
 */
export const coverObjectPosition = (framing: CoverFraming | undefined, portrait: boolean): string => {
  if (framing) return `${Math.round(framing.focal.x * 100)}% ${Math.round(framing.focal.y * 100)}%`;
  return portrait ? PORTRAIT_COVER_POSITION : LANDSCAPE_COVER_POSITION;
};

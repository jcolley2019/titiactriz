import { useEffect, useState } from "react";
import type { FitMode, Focal } from "@/hooks/useCinematicMedia";

/**
 * CINE.FLOW.3 — the reel act's veil law, in one place.
 *
 * The reel now has TWO true renderings, and this module is what keeps them from
 * drifting apart:
 *
 *  - PHONE: the photograph covers the frame and carries NO veil at all. Type
 *    legibility is bought locally instead, by a soft scrim confined to the
 *    lockup's own zone at the foot of the frame (CINE.FLOW.4C).
 *  - WIDE (tablet and desktop): unchanged — the whole photo letterboxed on brand
 *    dark under the legacy flat wash, i.e. the reel's gallery character.
 *
 * Live and preview both import from here. `SectionPreview` (the admin framing
 * editor's WYSIWYG canvas) must paint the same veil the phone paints, or the
 * editor starts lying about what publishes — which is the parity law's whole
 * point. Constants restated as strings, never re-derived per surface.
 */

/**
 * The phone/wide line, mirroring `useIsMobile`'s 768 so the reel and the rest of
 * the app agree on what a phone is.
 */
export const REEL_PHONE_BREAKPOINT = 768;

/** Device-class test. Takes the LOGICAL CSS width — a viewport or a preset. */
export const reelIsPhoneWidth = (width: number) => width < REEL_PHONE_BREAKPOINT;

const PHONE_QUERY = `(max-width: ${REEL_PHONE_BREAKPOINT - 1}px)`;

const readPhone = () => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(PHONE_QUERY).matches;
};

/**
 * Is this viewport a phone? Read SYNCHRONOUSLY on first render (unlike
 * `useIsMobile`, which starts undefined and corrects in an effect) — the two
 * reel compositions differ in fit, so a first paint at the wrong one would show
 * a phone the letterboxed act and then swap it under the visitor.
 */
export function useReelIsPhone(): boolean {
  const [phone, setPhone] = useState(readPhone);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(PHONE_QUERY);
    const onChange = () => setPhone(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return phone;
}

/**
 * How a reel slide paints its photo. Cover on phones (the act is edge-to-edge
 * and the veil does the legibility work); letterbox everywhere else.
 *
 * PORT.2: this is now the ONE place the reel's fit is decided, so the live act,
 * the editor canvas and the device thumbnails cannot disagree about it.
 */
export const reelSlideFit = (isPhone: boolean): FitMode => (isPhone ? "fill" : "fit");

/** Where the beam points when a slide carries no framing at all. */
export const SPOTLIGHT_FALLBACK_CENTRE = { x: 50, y: 40 };

/**
 * The beam's aim, as a percentage of the frame.
 *
 * The slide's focal is usable as a container percentage DIRECTLY: in cover mode
 * the resolver pans by `posX = focal.x * 100`, so on an axis with overflow the
 * rectangle is `left = -f * overflow`, `width = 100 + overflow` and the focal
 * point lands at `left + f * width = f * 100`; on an axis without overflow the
 * rectangle is pinned at 100% and it lands at `f * 100` again. Exact, not an
 * approximation — see src/lib/hero-framing.ts.
 */
export const spotlightCentre = (focal?: Focal) =>
  focal ? { x: focal.x * 100, y: focal.y * 100 } : SPOTLIGHT_FALLBACK_CENTRE;

/**
 * CINE.FLOW.4C — the phone act has NO veil over its photograph.
 *
 * The focal radial veil that used to sit here darkened the whole picture to buy
 * legibility for four lines of type at the foot of the frame. The photograph now
 * reads at full brightness — as bright as the unveiled regions of the wide W2
 * plate — and the type buys its own contrast LOCALLY, from the three constants
 * below.
 *
 * The scrim is a soft vertical gradient bound to the lockup's zone: transparent
 * at its top edge, deepening to `rgba(0,0,0,0.55)` at the lockup's baseline,
 * full frame width, and no hard stop anywhere. Its total height is the lockup's
 * own box plus the feather and nothing more, so the photograph above it is
 * untouched. This is NOT the wide act's full-frame wash.
 */

/**
 * The lockup's bottom-anchored box on a phone, in CSS px: `pb-16` (64) + the
 * 22px numeral row + its 10px gap + the 28px title at line-height 1.1 (≈31).
 */
export const LOCKUP_BOX_PX = 128;

/**
 * The lockup's BASELINE, measured up from the foot of the frame: the `pb-16`
 * gutter under the title. This is where the ramp arrives at its floor — below
 * it the scrim simply holds, so the type never sits on a rising gradient.
 */
export const LOCKUP_BASELINE_PX = 64;

/**
 * The feather — the run over which the scrim rises out of nothing. The law is
 * "at least 8vh"; 10 buys margin on the shortest phone the editor models.
 */
export const LOCKUP_SCRIM_FEATHER_VH = 10;

/** The scrim's floor: how dark it ever gets, at and below the baseline. */
export const LOCKUP_SCRIM_FLOOR = 0.55;

/**
 * The scrim ramp, in lengths measured down from the scrim's own top edge, so it
 * stays anchored to the lockup rather than stretching with the frame:
 *
 *   0 → 8vh    the feather: still essentially clear at 8vh (0.09)
 *   → baseline the ramp proper, arriving at 0.55 exactly at the lockup baseline
 *   → 100%     held flat under the type's gutter
 *
 * Every step is under 0.13, so there is no edge to see anywhere along it.
 *
 * `unit` is the vertical unit the surface measures the feather in — `vh` on the
 * live act, `cqh` inside the admin preview's sized container — and `px` is how
 * that surface writes one of the live act's CSS pixels (itself, or the
 * container-unit restatement the preview scales by).
 */
export const lockupScrim = (
  unit: "vh" | "cqh" = "vh",
  px: (n: number) => string = (n) => `${n}px`,
) => {
  const f = LOCKUP_SCRIM_FEATHER_VH;
  const b = LOCKUP_BASELINE_PX;
  return [
    "linear-gradient(180deg",
    "rgba(0,0,0,0) 0px",
    `rgba(0,0,0,0.04) ${f * 0.4}${unit}`,
    `rgba(0,0,0,0.09) ${f * 0.8}${unit}`,
    `rgba(0,0,0,0.20) ${f}${unit}`,
    `rgba(0,0,0,0.33) calc(${f}${unit} + ${px(b * 0.375)})`,
    `rgba(0,0,0,0.45) calc(${f}${unit} + ${px(b * 0.6875)})`,
    `rgba(0,0,0,${LOCKUP_SCRIM_FLOOR}) calc(${f}${unit} + ${px(b)})`,
    `rgba(0,0,0,${LOCKUP_SCRIM_FLOOR}) 100%)`,
  ].join(", ");
};

/**
 * CINE.FLOW.4C — the numeral's two flanking rules, EQUAL. They were 28 and 40,
 * which read as a mistake rather than a device; both now sit at the longer
 * value, from this one constant, on every surface that draws the lockup.
 */
export const LOCKUP_RULE_W_PX = 40;

/**
 * The phone frame the admin preview's container units are calibrated against
 * (see SectionPreview). Lets the preview restate the px constants above as
 * container units instead of re-deriving them by hand.
 */
export const PREVIEW_PHONE_REF_W = 402;

/** A px constant from the live phone lockup, as the preview's container unit. */
export const asPreviewCqw = (px: number) =>
  `${((px / PREVIEW_PHONE_REF_W) * 100).toFixed(2)}cqw`;

/**
 * The wide veil — the flat 0.5 → 0.8 wash the act has always carried above the
 * phone breakpoint. Out of the mandated band and recorded in DESIGN.md as the
 * remaining half of the reel-veil violation; kept byte-identical here only so
 * the preview keeps matching the surface it previews.
 */
export const WIDE_VEIL = "linear-gradient(180deg, rgba(11,10,8,0.5), rgba(11,10,8,0.8))";

/** Brand constants the reel lockup is built from (DESIGN.md normative tokens). */
export const GOLD = "#C9A55C";
export const IVORY = "#f4ecdb";

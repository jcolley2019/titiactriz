import { useEffect, useState } from "react";
import type { FitMode, Focal } from "@/hooks/useCinematicMedia";

/**
 * CINE.FLOW.5 — the reel act's veil law, in one place.
 *
 * The reel has TWO true renderings, and this module is what keeps them from
 * drifting apart:
 *
 *  - PHONE (< 768px): the promoted V1 "Edge Veil" act. The photograph covers the
 *    frame; a single directional veil weights the BOTTOM of that frame, where
 *    the lockup lands, and leaves the top half completely open. Peak 0.32 —
 *    inside DESIGN.md's mandated 0.15–0.35 band, and directional on the vertical
 *    axis, which is what the flat wash it replaced never was.
 *  - WIDE (>= 768px): the promoted W2 "Center Plate & Rules" act, which carries
 *    NO veil at all — its lockup sits below the plate, over an ambient backdrop,
 *    and never crosses the photograph. See ./reelWide, which owns that geometry.
 *
 * Live and preview both import from here. `SectionPreview` (the admin framing
 * editor's WYSIWYG canvas) must paint the same light the live act paints, or the
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
 * reel compositions are structurally different, so a first paint at the wrong
 * one would show a phone the plate act and then swap it under the visitor.
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

/** Where the focal resolver points when a slide carries no framing at all. */
export const SPOTLIGHT_FALLBACK_CENTRE = { x: 50, y: 40 };

/**
 * The slide's focal point, as a percentage of the frame.
 *
 * The slide's focal is usable as a container percentage DIRECTLY: in cover mode
 * the resolver pans by `posX = focal.x * 100`, so on an axis with overflow the
 * rectangle is `left = -f * overflow`, `width = 100 + overflow` and the focal
 * point lands at `left + f * width = f * 100`; on an axis without overflow the
 * rectangle is pinned at 100% and it lands at `f * 100` again. Exact, not an
 * approximation — see src/lib/hero-framing.ts.
 *
 * Named for the retired phone spotlight, but it never was a veil function: it is
 * the reel's ONE focal resolver, and the wide plate act reads it too. The
 * bake-off harness imports this symbol by name, so the name is load-bearing.
 */
export const spotlightCentre = (focal?: Focal) =>
  focal ? { x: focal.x * 100, y: focal.y * 100 } : SPOTLIGHT_FALLBACK_CENTRE;

/**
 * CINE.FLOW.5 — the phone act's edge veil, promoted verbatim from bake-off
 * variant V1.
 *
 * The thesis is that a veil is a WEIGHT AT THE BOTTOM OF THE FRAME and nothing
 * more: the photograph is completely unveiled for its top 54%, suppression
 * begins only where the type is actually going to land, and it deepens to the
 * bottom edge — which doubles as the hand-off to the next act, the same move the
 * hero and Titans veils make.
 *
 * This SUPERSEDES the CINE.FLOW.4C treatment (an unveiled photograph plus a
 * scrim bound to the lockup's own box). Where the two conflict, V1 wins: the
 * scrim, its four ramp constants and its ramp function are all gone. What
 * survives from 4C is its finding — the flat 0.5 → 0.8 wash is dead and is not
 * coming back.
 */
export const PHONE_VEIL =
  "linear-gradient(180deg, rgba(11,10,8,0) 0%, rgba(11,10,8,0) 54%, rgba(11,10,8,0.16) 70%, rgba(11,10,8,0.32) 100%)";

/**
 * The phone numeral, in CSS px: V1's 82px reduced 20% (82 × 0.8 = 65.6) and
 * rounded to a whole CSS pixel. Cinzel is a letterform cut into stone; a
 * fractional cap height is a rasteriser artefact, not a type decision.
 */
export const PHONE_NUMERAL_PX = 66;

/**
 * The phone title. V1 set a flat 22px; the ruling adopts the V2 lockup size
 * instead — bounded rather than flat because the longest title fills the frame
 * exactly at 360 (Galaxy S26), where a flat 28px wraps to two lines and the
 * lockup stops reading as one mark. The ceiling is DESIGN.md's Headline floor.
 */
export const PHONE_TITLE_CLAMP = "clamp(1.5rem, 7.2vw, 1.75rem)";

/** The phone lockup's box, in CSS px: V1's `px-6 pb-14` and its `mt-2` gap. */
export const PHONE_LOCKUP_PAD_X_PX = 24;
export const PHONE_LOCKUP_PAD_BOTTOM_PX = 56;
export const PHONE_LOCKUP_GAP_PX = 8;

/**
 * The phone frame the admin preview's container units are calibrated against
 * (see SectionPreview). Lets the preview restate the px constants above as
 * container units instead of re-deriving them by hand.
 */
export const PREVIEW_PHONE_REF_W = 402;

/** A px constant from the live phone lockup, as the preview's container unit. */
export const asPreviewCqw = (px: number) =>
  `${((px / PREVIEW_PHONE_REF_W) * 100).toFixed(2)}cqw`;

/** Brand constants the reel lockup is built from (DESIGN.md normative tokens). */
export const GOLD = "#C9A55C";
export const IVORY = "#f4ecdb";

/* ------------------------------------------------------------------------- *
 * RETIRED, PENDING THE WIDE PROMOTION.
 *
 * The live phone act no longer reads anything below this line. The admin
 * preview still mirrors the OLD compositions, so these stay exported until the
 * mirror is rewritten and they can be deleted outright.
 * ------------------------------------------------------------------------- */

/** How a reel slide paints its photo: cover on phones, letterbox above. */
export const reelSlideFit = (isPhone: boolean): FitMode => (isPhone ? "fill" : "fit");

/** The 4C lockup scrim's box, baseline, feather and floor. */
export const LOCKUP_BOX_PX = 128;
export const LOCKUP_BASELINE_PX = 64;
export const LOCKUP_SCRIM_FEATHER_VH = 10;
export const LOCKUP_SCRIM_FLOOR = 0.55;

/** The 4C numeral's two flanking rules, equal at the longer value. */
export const LOCKUP_RULE_W_PX = 40;

/** The 4C scrim ramp, in lengths measured down from the scrim's own top edge. */
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

/** The flat 0.5 → 0.8 wash the act carries above the phone breakpoint. */
export const WIDE_VEIL = "linear-gradient(180deg, rgba(11,10,8,0.5), rgba(11,10,8,0.8))";

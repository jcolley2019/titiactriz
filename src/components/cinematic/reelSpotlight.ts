import { useEffect, useState } from "react";
import type { FitMode, Focal } from "@/hooks/useCinematicMedia";

/**
 * CINE.FLOW.3 — the reel act's veil law, in one place.
 *
 * The reel now has TWO true renderings, and this module is what keeps them from
 * drifting apart:
 *
 *  - PHONE: the photograph covers the frame and a radial "spotlight" veil opens
 *    over the subject and closes to 0.35 at the corners. This is the CINE.FLOW.2
 *    bake-off's V2, confirmed as the direction.
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
 * The phone veil: a LENS, not a curtain — fully open over the subject, closing
 * radially to `0.35` at the corners where no photograph information lives.
 * Aiming it elsewhere never raises that ceiling, so it sits inside DESIGN.md's
 * mandated `0.15–0.35` band wherever the subject is.
 */
export const spotlightVeil = (centre: { x: number; y: number }) =>
  `radial-gradient(ellipse 76% 56% at ${centre.x}% ${centre.y}%, rgba(11,10,8,0) 0%, rgba(11,10,8,0) 46%, rgba(11,10,8,0.20) 72%, rgba(11,10,8,0.35) 100%)`;

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

import { PLATE_ASPECT, plateBox } from "@/components/cinematic/reelWide";
import { reelIsPhoneWidth } from "@/components/cinematic/reelSpotlight";
import type { FitMode } from "@/hooks/useCinematicMedia";

/**
 * ADMIN.RESET.1c — THE BOX THE MEDIA ACTUALLY PAINTS INTO.
 *
 * The framing editor's drag surface is the whole device-shaped canvas, but the
 * photo inside it is not always the same rectangle. On the reel's WIDE
 * compositions the photo is cropped into the W2 plate — a fixed portrait box
 * (`PLATE_ASPECT`) hung inside the frame — while on the phone act, the hero and
 * the About panel it fills the surface edge to edge.
 *
 * That distinction is the whole of the pan bug this brick fixes. `surfaceOverflow`
 * used to resolve its geometry against the DEVICE aspect at the editor's notional
 * `imageFit`, neither of which is what the canvas paints:
 *
 *   Desktop tab, 1440x900 → aspect 1.60, editor passed fit "fit"
 *   a 0.8-aspect portrait at zoom 1.16 → widthPct = (0.8 / 1.60) * 100 * 1.16 = 58
 *   → 58 < 100, so the allowable X range computed as ZERO and horizontal drag died,
 *     while heightPct = 100 * 1.16 = 116 left Y working. Hence "vertical drags,
 *     horizontal doesn't, despite obvious room".
 *
 *   What the canvas really paints there is the plate (aspect 0.563) in fill:
 *   widthPct = (0.8 / 0.563) * 100 * 1.16 = 165 and heightPct = 116 — 65% of real
 *   horizontal slack the editor was refusing to let anyone reach.
 *
 * So both axes now derive from the ZOOMED RENDERED SIZE measured against THIS box.
 * An axis is clamped only where the frame would stop being covered, which is the
 * resolver's own self-clamping law — never because of an assumption about which
 * axis can overflow.
 *
 * The plate law is not restated here: `plateBox` is the same function the live
 * wide act sizes its plate with, and SectionPreview's CSS `min()` is that
 * function expressed in container units. One law, three surfaces.
 */
export type PreviewFrame = {
  /** Width of the painted box, in the surface's own px. */
  w: number;
  /** Height of the painted box, in the surface's own px. */
  h: number;
  /** w / h — the container aspect the resolver must be given. */
  aspect: number;
  /** The display mode that box paints in. */
  fit: FitMode;
};

/**
 * The frame a slot's photo paints into on a given device tab, in the px of a
 * `surfaceW` x `surfaceH` editor canvas.
 *
 * `fit` is always "fill" because every image surface is cover now (CINE.FLOW.5
 * retired the letterbox mode; SectionPreview hands FramedImage a fixed
 * `fit="fill"`). The reel's `imageFit` of "fit" survives ONLY as the zoom
 * slider's sub-cover floor and must never reach the geometry — that mismatch is
 * half of what this module exists to prevent.
 */
export function previewMediaFrame(
  kind: "hero" | "reel" | "about",
  deviceWidth: number,
  surfaceW: number,
  surfaceH: number,
): PreviewFrame {
  // The wide reel act crops into the plate; the phone act is edge-to-edge. The
  // test is the same width-derived one the live act and the class split use.
  if (kind === "reel" && !reelIsPhoneWidth(deviceWidth)) {
    const box = plateBox(surfaceW, surfaceH);
    return { w: box.w, h: box.h, aspect: PLATE_ASPECT, fit: "fill" };
  }
  // Everything else paints the full surface: the phone reel act (inset-0), the
  // hero, and the About panel (whose surface IS its fixed 3:4 canvas).
  return {
    w: surfaceW,
    h: surfaceH,
    aspect: surfaceH > 0 ? surfaceW / surfaceH : 1,
    fit: "fill",
  };
}

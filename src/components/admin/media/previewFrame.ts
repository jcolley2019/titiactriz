import { CHAPTER_FIELD_FRACTION, plateBox, plateLaw } from "@/components/cinematic/reelWide";
import { reelIsPhoneWidth } from "@/components/cinematic/reelSpotlight";
import type { FitMode, PlateAspect } from "@/hooks/useCinematicMedia";

/**
 * ADMIN.RESET.1c — THE BOX THE MEDIA ACTUALLY PAINTS INTO.
 *
 * The framing editor's drag surface is the whole device-shaped canvas, but the
 * photo inside it is not always the same rectangle. On a REEL-CLASS surface's
 * plated compositions the photo is cropped into a plate — a bounded box
 * (`plateLaw`) hung inside the frame — while on the reel's phone act and the hero
 * it fills the surface edge to edge.
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
 *
 * ADMIN.ASPECT.1 — the plate has two shapes now, so that box is a function of the
 * edited slide's `plate` too. The pan law does not change at all: both axes still
 * derive from the zoomed rendered size against the box this returns. Switching to
 * a landscape plate simply returns a wider, shallower box, and the same arithmetic
 * hands back the slack that box implies — which is why the editor re-frames on the
 * toggle without a single geometry branch in the drag code.
 *
 * ADMIN.ABOUT.4 — and this function no longer knows what an About panel is.
 * ADMIN.ABOUT.2 gave `kind === "about"` a plate on BOTH classes, which framed the
 * About phone tab against a box the phone composition does not draw. The About slot
 * reaches the editor as a reel now, so it takes the reel's answer here — full
 * surface on the phone act, the plate on the wide one — and the "about" case is
 * gone from the signature entirely.
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
  kind: "hero" | "reel",
  deviceWidth: number,
  surfaceW: number,
  surfaceH: number,
  /**
   * ADMIN.ASPECT.1 — which plate shape the edited record hangs in. Plated
   * surfaces only; the phone act and the hero have no plate and ignore it.
   * Defaults to portrait, so a caller that predates the field gets exactly the old
   * geometry — and a phone record, which can never store a shape, resolves to the
   * portrait plate through this same default.
   */
  plate: PlateAspect = "portrait",
): PreviewFrame {
  // A reel-class surface crops into its plate. The phone act is the one exception
  // — it is edge-to-edge, the photograph IS the stage — and the test for it is the
  // same width-derived one the live act and the class split use.
  const platedReel = kind === "reel" && !reelIsPhoneWidth(deviceWidth);
  if (platedReel) {
    // MIRROR.SYNC.1 — the live spread sizes its plate against the PHOTO PAGE
    // (the frame minus the CINE.FLOW.6 chapter column), so the width cap here
    // must run on that same zone or a landscape plate's drag slack drifts from
    // the box the canvas actually draws.
    const box = plateBox(surfaceW * (1 - CHAPTER_FIELD_FRACTION), surfaceH, plate);
    return { w: box.w, h: box.h, aspect: plateLaw(plate).aspect, fit: "fill" };
  }
  // Everything else paints the full surface: the phone reel act (inset-0) and the
  // hero, whose composition IS the whole frame.
  return {
    w: surfaceW,
    h: surfaceH,
    aspect: surfaceH > 0 ? surfaceW / surfaceH : 1,
    fit: "fill",
  };
}

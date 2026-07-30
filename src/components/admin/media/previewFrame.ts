import { plateBox, plateLaw } from "@/components/cinematic/reelWide";
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
 * ADMIN.ABOUT.2 — the About panel is a reel-class surface, so it hangs a plate too,
 * and it hangs one at BOTH device classes: its phone panel is the portrait plate
 * (the phone class stores no shape, so it can only ever be that), its wide panel the
 * shape its wide record chose. The reel's PHONE act stays the one plated kind's
 * exception, because there the photograph IS the stage rather than a page hung in it.
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
  /**
   * ADMIN.ASPECT.1 — which plate shape the edited record hangs in. Plated
   * surfaces only; the reel's phone act and the hero have no plate and ignore it.
   * Defaults to portrait, so a caller that predates the field gets exactly the old
   * geometry — and an About phone record, which can never store a shape, resolves
   * to the portrait plate through this same default.
   */
  plate: PlateAspect = "portrait",
): PreviewFrame {
  // A reel-class surface crops into its plate. The reel's phone act is the one
  // exception — it is edge-to-edge, the photograph IS the stage — and the test for
  // it is the same width-derived one the live act and the class split use.
  const platedReel = kind === "reel" && !reelIsPhoneWidth(deviceWidth);
  if (kind === "about" || platedReel) {
    const box = plateBox(surfaceW, surfaceH, plate);
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

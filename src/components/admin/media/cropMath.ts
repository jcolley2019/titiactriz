import type { Area } from "@/lib/crop";
import type { Focal } from "@/hooks/useCinematicMedia";

/**
 * ADMIN.MEDIA.4 — bridge react-easy-crop's destructive crop model to this site's
 * NON-destructive focal + zoom (object-cover) model.
 *
 * react-easy-crop reports the exact source-image rectangle (`Area`, in natural
 * pixels) that fills the target frame. For an object-cover render, the same
 * framing is: object-position = the crop's CENTRE (focal), and a wrapper scale
 * relative to the cover baseline. At react-easy-crop's minZoom the crop equals
 * the cover region, so zoom maps 1:1. Nothing is ever rasterized — TitiLinks
 * lifts a File out of the crop; we lift focal/zoom.
 */
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clamp01 = (n: number) => clamp(n, 0, 1);

/** The cover region's source width/height for a frame `aspect` (w/h) over an image. */
const coverRegion = (natW: number, natH: number, aspect: number) => {
  const width = Math.min(natW, natH * aspect);
  return { width, height: width / aspect };
};

/** react-easy-crop crop rectangle (natural px) → focal + object-cover zoom. */
export const areaToFocalZoom = (
  area: Area,
  natW: number,
  natH: number,
  aspect: number,
  minZoom: number,
  maxZoom: number,
): { focal: Focal; zoom: number } => {
  const cover = coverRegion(natW, natH, aspect);
  const zoom = clamp(area.width > 0 ? cover.width / area.width : 1, minZoom, maxZoom);
  return {
    focal: {
      x: clamp01((area.x + area.width / 2) / natW),
      y: clamp01((area.y + area.height / 2) / natH),
    },
    zoom,
  };
};

/**
 * Stored focal/zoom → react-easy-crop `initialCroppedAreaPercentages` so the
 * editor re-opens exactly where it was saved. Percentages are image-relative,
 * so only the natural aspect matters.
 */
export const focalZoomToAreaPct = (
  focal: Focal,
  zoom: number,
  natW: number,
  natH: number,
  aspect: number,
): { x: number; y: number; width: number; height: number } => {
  const cover = coverRegion(natW, natH, aspect);
  const widthPct = (cover.width / zoom / natW) * 100;
  const heightPct = (cover.height / zoom / natH) * 100;
  return {
    x: clamp(focal.x * 100 - widthPct / 2, 0, 100 - widthPct),
    y: clamp(focal.y * 100 - heightPct / 2, 0, 100 - heightPct),
    width: widthPct,
    height: heightPct,
  };
};

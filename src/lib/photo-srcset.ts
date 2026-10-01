/**
 * MEDIA.PHOTO.1 — serve each screen the best a gallery photo can show.
 *
 * Every upload large enough to be optimized keeps two files: the WEB file
 * (image_url — the master scaled down to a WEB_MAX_SIDE long side, never up)
 * and the creator's full-resolution MASTER (master_url, master_width ×
 * master_height). The hero, the reel and the lightbox offer both as srcset
 * candidates; every other surface keeps image_url alone.
 *
 * The web candidate's width is DERIVED from the master's, never assumed to be
 * WEB_MAX_SIDE: a portrait's web file is 3200 tall, not 3200 wide, and an
 * overstated width would make the master the "smaller" candidate on every
 * screen — phones would download the original. The master is offered only when
 * it is wider than the web file; a master whose long side already fits adds no
 * pixels, so that photo renders with a plain src.
 *
 * Kept apart from gallery-upload.ts so public surfaces never import the upload
 * pipeline (and with it the compression library).
 */

/** The web file's long-side cap — the upload pipeline's maxWidthOrHeight. */
export const WEB_MAX_SIDE = 3200;

export type MasterFields = {
  master_url?: string | null;
  master_width?: number | null;
  master_height?: number | null;
};

/**
 * srcSet/sizes for an <img> (or FramedImage) painting `photo`, or an empty
 * object — spread it, and a photo without a useful master renders exactly as
 * before.
 */
export function masterSources(
  photo: ({ image_url: string } & MasterFields) | undefined,
): { srcSet?: string; sizes?: string } {
  const w = photo?.master_width;
  const h = photo?.master_height;
  if (!photo?.master_url || !w || !h) return {};
  const webWidth = Math.round(w * Math.min(1, WEB_MAX_SIDE / Math.max(w, h)));
  if (w <= webWidth) return {};
  return {
    srcSet: `${photo.image_url} ${webWidth}w, ${photo.master_url} ${w}w`,
    sizes: "100vw",
  };
}

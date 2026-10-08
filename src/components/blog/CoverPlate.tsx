import { useState } from "react";

import { FIELD_GROUND, SEAM_GOLD } from "@/components/cinematic/FramedVideo";
import { PLATE_LANDSCAPE_ASPECT } from "@/components/cinematic/reelWide";
import type { BlogCover } from "@/hooks/useBlogPosts";
import type { MasterFields } from "@/lib/photo-srcset";
import { coverObjectPosition, type CoverFraming } from "@/lib/cover-framing";

/**
 * BLOG.FIXES.1 — where a cover photograph sits in its crop: a portrait keeps its
 * upper part, a landscape stays centred. BLOG.COVERFRAME.1 — unless the post
 * stores its own focal point (cover_framing), which wins on every surface. The
 * rule and the constants live in @/lib/cover-framing; re-exported here so no
 * import path breaks.
 */
export { LANDSCAPE_COVER_POSITION, PORTRAIT_COVER_POSITION } from "@/lib/cover-framing";

type CoverSource = { image_url: string; alt_text: string | null } & MasterFields;

/**
 * Portrait from the photo row's master size when it has one (known before the
 * first paint), else from the decoded file's natural size, read on load.
 */
export const CoverImage = ({
  cover,
  className,
  eager = false,
  qa,
  framing,
}: {
  cover: CoverSource;
  className: string;
  eager?: boolean;
  qa?: string;
  framing?: CoverFraming;
}) => {
  const [decoded, setDecoded] = useState<{ src: string; portrait: boolean } | null>(null);
  const w = cover.master_width;
  const h = cover.master_height;
  const portrait =
    w && h ? h > w : decoded?.src === cover.image_url ? decoded.portrait : false;
  return (
    <img
      data-qa={qa}
      src={cover.image_url}
      alt={cover.alt_text ?? ""}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={{ objectPosition: coverObjectPosition(framing, portrait) }}
      onLoad={(e) => {
        const img = e.currentTarget;
        setDecoded({ src: cover.image_url, portrait: img.naturalHeight > img.naturalWidth });
      }}
    />
  );
};

/**
 * BLOG.1 — a post's cover as the reel's plate: the landscape plate's 3:2
 * (ADMIN.ASPECT.1), the ground painted behind the photograph, and the plate's
 * gold hairline at the ratified frame opacity, drawn as an OUTLINE with a
 * negative offset (never a border — DESIGN.md, Shapes). The finished frame, as
 * the reel's markup state is: nothing here scrubs. No veil: no type crosses it.
 */
const CoverPlate = ({
  cover,
  qa,
  eager = false,
  framing,
}: {
  cover: BlogCover;
  qa: string;
  eager?: boolean;
  framing?: CoverFraming;
}) => (
  <div
    data-qa={qa}
    className="relative w-full overflow-hidden"
    style={{
      aspectRatio: String(PLATE_LANDSCAPE_ASPECT),
      backgroundColor: FIELD_GROUND,
    }}
  >
    <CoverImage
      cover={cover}
      eager={eager}
      framing={framing}
      className="absolute inset-0 h-full w-full object-cover"
    />
    {/* The hairline rides ABOVE the photograph: on the box itself it would sit
        under an image that fills it edge to edge (and a line beneath a filling
        medium bleeds at fractional DPR). */}
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ outline: `1px solid ${SEAM_GOLD}`, outlineOffset: "-1px" }}
    />
  </div>
);

export default CoverPlate;

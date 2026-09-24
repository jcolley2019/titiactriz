import { FIELD_GROUND, SEAM_GOLD } from "@/components/cinematic/FramedVideo";
import { PLATE_LANDSCAPE_ASPECT } from "@/components/cinematic/reelWide";
import type { BlogCover } from "@/hooks/useBlogPosts";

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
}: {
  cover: BlogCover;
  qa: string;
  eager?: boolean;
}) => (
  <div
    data-qa={qa}
    className="relative w-full overflow-hidden"
    style={{
      aspectRatio: String(PLATE_LANDSCAPE_ASPECT),
      backgroundColor: FIELD_GROUND,
    }}
  >
    <img
      src={cover.image_url}
      alt={cover.alt_text ?? ""}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
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

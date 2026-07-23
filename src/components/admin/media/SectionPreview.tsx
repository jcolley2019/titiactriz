import FramedImage from "@/components/cinematic/FramedImage";
import FramedVideo from "@/components/cinematic/FramedVideo";
import type { CinematicPhoto } from "@/components/cinematic/useCinematicData";
import type { Focal, FitMode } from "@/hooks/useCinematicMedia";

/**
 * ADMIN.MEDIA.1 (ITEM 3) — a scaled, live composition of the actual cinematic
 * section (hero lockup, or reel numeral + title) over the framed photo. Renders
 * at whatever box it's given via container-query units, so the SAME component
 * powers both the large editor surface and the small device-tab thumbnails, and
 * it uses the SAME FramedImage as the live site — WYSIWYG by construction.
 *
 * Purely visual: pointer/drag handling lives on the FramingEditor surface that
 * wraps this, so images never intercept the drag.
 */
const DISPLAY = "'Cinzel', 'Cormorant Garamond', Georgia, serif";

type Props = {
  kind: "hero" | "reel" | "about";
  /** 0-based slot index — drives the reel numeral (01/02/03). */
  reelIndex?: number;
  photo?: CinematicPhoto;
  focal: Focal;
  zoom: number;
  reelTitle?: string;
  /** Frame aspect (width / height) of the device being previewed. */
  aspect: number;
  /** ADMIN.MEDIA.2 — when set, the framed media is this video (hero only). */
  videoSrc?: string;
  /** Poster for the video preview (the current hero image). */
  poster?: string;
  /** ADMIN.MEDIA.3 — fill (crop) or fit (letterbox over blurred backdrop). */
  fit?: FitMode;
};

const numeral = (i: number) => String(i + 1).padStart(2, "0");

const SectionPreview = ({
  kind,
  reelIndex = 0,
  photo,
  focal,
  zoom,
  reelTitle,
  aspect,
  videoSrc,
  poster,
  fit = "fill",
}: Props) => {
  return (
    <div
      data-qa="media-preview"
      className="relative h-full w-full overflow-hidden bg-[#0b0a08] [&_img]:select-none [&_img]:pointer-events-none [&_video]:select-none [&_video]:pointer-events-none"
      style={{ containerType: "size", aspectRatio: aspect }}
    >
      <div className="absolute inset-0">
        {videoSrc ? (
          <FramedVideo
            src={videoSrc}
            poster={poster ?? photo?.image_url}
            focal={focal}
            zoom={zoom}
            fit={fit}
            videoDataQa="media-preview-video"
            backdropDataQa="media-preview-backdrop"
            fallback={<div className="h-full w-full" style={{ backgroundColor: "#141210" }} />}
          />
        ) : (
          <FramedImage
            src={photo?.image_url}
            focal={focal}
            zoom={zoom}
            fit={kind === "reel" ? "fit" : "fill"}
            fallback={<div className="h-full w-full" style={{ backgroundColor: "#141210" }} />}
          />
        )}
      </div>

      {kind === "about" ? (
        // ABOUT.MEDIA.1 — the live About panel is the bare framed photo (no
        // scrim, no lockup), so the preview is too: card ≡ canvas ≡ live panel.
        null
      ) : kind === "hero" ? (
        <>
          {/* Scrim mirrors the live hero (heavier top/bottom). */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(11,10,8,0.72) 0%, rgba(11,10,8,0.42) 38%, rgba(11,10,8,0.60) 72%, rgba(11,10,8,0.92) 100%)",
            }}
          />
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-center"
            style={{ transform: "translateY(8%)" }}
          >
            <div
              style={{
                fontFamily: DISPLAY,
                lineHeight: 0.92,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              <div style={{ color: "#f4ecdb", fontSize: "min(11cqw, 12cqh)" }}>CRISTYNA</div>
              <div style={{ color: "#C9A55C", fontSize: "min(11cqw, 12cqh)" }}>POLENTINO</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(11,10,8,0.5), rgba(11,10,8,0.8))" }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span style={{ fontFamily: DISPLAY, color: "rgba(201,165,92,0.85)", fontSize: "26cqh", lineHeight: 1 }}>
              {numeral(reelIndex)}
            </span>
            {reelTitle && (
              <span
                style={{
                  fontFamily: DISPLAY,
                  color: "#f4ecdb",
                  fontSize: "7cqh",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginTop: "1cqh",
                }}
              >
                {reelTitle}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SectionPreview;

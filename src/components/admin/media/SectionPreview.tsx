import FramedImage from "@/components/cinematic/FramedImage";
import FramedVideo from "@/components/cinematic/FramedVideo";
import type { CinematicPhoto } from "@/components/cinematic/useCinematicData";
import {
  GOLD,
  IVORY,
  WIDE_VEIL,
  reelIsPhoneWidth,
  reelSlideFit,
  spotlightCentre,
  spotlightVeil,
} from "@/components/cinematic/reelSpotlight";
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
 *
 * CINE.FLOW.3 — the reel act now renders differently on a phone than above the
 * breakpoint, so this preview does too: `deviceWidth` (the previewed device's
 * LOGICAL css width) decides which of the two compositions is drawn, through the
 * same `reelSpotlight` module the live act uses. Without it the preview would
 * keep showing every device the letterboxed wide act and the editor would be
 * lying about what a phone publishes.
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
  /**
   * Logical css width of the device being previewed. Reel only: picks the phone
   * composition below the breakpoint. Absent = the wide act (what a surface
   * belonging to no particular device, e.g. a slot card, should show).
   */
  deviceWidth?: number;
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
  deviceWidth,
  videoSrc,
  poster,
  fit = "fill",
}: Props) => {
  const phoneReel = kind === "reel" && deviceWidth != null && reelIsPhoneWidth(deviceWidth);
  const beam = spotlightCentre(focal);
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
            fit={kind === "reel" ? reelSlideFit(phoneReel) : "fill"}
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
      ) : phoneReel ? (
        // CINE.FLOW.3 phone act: focal-anchored beam + the V2B lockup at the
        // foot. Sizes are the live composition's px expressed in container
        // units against a ~402cqw phone frame, so the scaled preview keeps the
        // live proportions (22px numeral under a 26px title, bound as one mark).
        <>
          <div
            className="absolute inset-0"
            style={{ background: spotlightVeil(beam) }}
          />
          <div
            className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center"
            style={{ paddingBottom: "16cqw", paddingLeft: "6cqw", paddingRight: "6cqw" }}
          >
            <div
              className="flex items-center"
              style={{ gap: "3cqw", marginBottom: "2.5cqw" }}
            >
              <span style={{ display: "block", height: 1, width: "7cqw", backgroundColor: GOLD }} />
              <span
                style={{
                  fontFamily: DISPLAY,
                  color: GOLD,
                  fontSize: "5.5cqw",
                  lineHeight: 1,
                  letterSpacing: "0.12em",
                  textIndent: "0.12em",
                }}
              >
                {numeral(reelIndex)}
              </span>
              <span style={{ display: "block", height: 1, width: "10cqw", backgroundColor: GOLD }} />
            </div>
            {reelTitle && (
              <span
                style={{
                  fontFamily: DISPLAY,
                  color: IVORY,
                  fontSize: "6.5cqw",
                  lineHeight: 1.1,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {reelTitle}
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: WIDE_VEIL }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span style={{ fontFamily: DISPLAY, color: "rgba(201,165,92,0.85)", fontSize: "min(30cqw, 26cqh)", lineHeight: 1 }}>
              {numeral(reelIndex)}
            </span>
            {reelTitle && (
              <span
                style={{
                  fontFamily: DISPLAY,
                  color: "#f4ecdb",
                  fontSize: "min(8cqw, 7cqh)",
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

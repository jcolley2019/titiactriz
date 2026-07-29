import FramedImage from "@/components/cinematic/FramedImage";
import FramedVideo from "@/components/cinematic/FramedVideo";
import type { CinematicPhoto } from "@/components/cinematic/useCinematicData";
import {
  GOLD,
  IVORY,
  PHONE_LOCKUP_GAP_PX,
  PHONE_LOCKUP_PAD_BOTTOM_PX,
  PHONE_LOCKUP_PAD_X_PX,
  PHONE_NUMERAL_PX,
  PHONE_VEIL,
  asPreviewCqw,
  reelIsPhoneWidth,
} from "@/components/cinematic/reelSpotlight";
import {
  AMBIENT_BLUR_PX,
  AmbientBackdrop,
  BAND_PAD_VH,
  PLATE_ASPECT,
  PLATE_HEIGHT_VH,
  PLATE_MAX_WIDTH_VW,
  PLATE_OUTLINE,
  PLATE_TOP_VH,
  WIDE_RULE_OPACITY,
  WIDE_RULE_X,
  lockupNumeralPx,
  lockupRulePx,
  lockupTitlePx,
} from "@/components/cinematic/reelWide";
import type { Focal, FitMode } from "@/hooks/useCinematicMedia";

/**
 * ADMIN.MEDIA.1 (ITEM 3) — a scaled, live composition of the actual cinematic
 * section (hero lockup, or the reel's two acts) over the framed photo. Renders
 * at whatever box it's given via container-query units, so the SAME component
 * powers both the large editor surface and the small device-tab thumbnails, and
 * it uses the SAME FramedImage as the live site — WYSIWYG by construction.
 *
 * Purely visual: pointer/drag handling lives on the FramingEditor surface that
 * wraps this, so images never intercept the drag.
 *
 * CINE.FLOW.3 — the reel act renders differently on a phone than above the
 * breakpoint, so this preview does too: `deviceWidth` (the previewed device's
 * LOGICAL css width) decides which of the two compositions is drawn, through the
 * same `reelSpotlight` module the live act uses.
 *
 * CINE.FLOW.5 — both compositions were replaced by their bake-off winners, and
 * both mirrors follow:
 *
 *  - PHONE mirrors V1 "Edge Veil": cover photo under one directional veil
 *    weighted to the foot of the frame, a 66px numeral over the title. The
 *    lockup-bound scrim and the numeral's flanking rules are gone with it.
 *  - WIDE mirrors W2 "Center Plate & Rules": an UNVEILED portrait plate in a
 *    gold hairline frame, hung between two vertical hairlines over an ambient
 *    backdrop, lockup captioned in the band beneath. `WIDE_VEIL` is deleted.
 *
 * The live act computes its wide geometry in px from its measured frame; a
 * preview has no fixed size, so the same laws are restated here in container
 * units — exact for everything that is a pure ratio (the plate box, the rules,
 * the band), and calibrated against the previewed device's own width for the
 * things the live act clamps in px (type sizes, the backdrop's blur radius).
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

/**
 * The wide plate box, as CSS. This IS `plateBox`'s "smaller box wins" rule:
 * the height rule is 76cqh, the width cap is 60cqw — restated as the height it
 * implies (60 / 0.563 cqw) so a single `min()` can pick the smaller box, exactly
 * as the live act's comparison does.
 */
const PLATE_H = `min(${PLATE_HEIGHT_VH}cqh, ${(PLATE_MAX_WIDTH_VW / PLATE_ASPECT).toFixed(3)}cqw)`;
const PLATE_W = `calc(${PLATE_H} * ${PLATE_ASPECT})`;

/**
 * The reference frame the wide act's px clamps are calibrated against. A slot
 * card belongs to no device, so it previews the wide act at desktop scale.
 */
const WIDE_PREVIEW_REF_W = 1440;

/** A px constant from the live wide lockup, as a fraction of its own frame. */
const asWideCqw = (px: number, refW: number) => `${((px / refW) * 100).toFixed(3)}cqw`;

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
  const wideReel = kind === "reel" && !phoneReel;
  const wideRefW = deviceWidth ?? WIDE_PREVIEW_REF_W;

  const media = videoSrc ? (
    <FramedVideo
      src={videoSrc}
      poster={poster ?? photo?.image_url}
      focal={focal}
      zoom={zoom}
      fit={fit}
      videoDataQa="media-preview-video"
      fallback={<div className="h-full w-full" style={{ backgroundColor: "#141210" }} />}
    />
  ) : (
    <FramedImage
      src={photo?.image_url}
      focal={focal}
      zoom={zoom}
      // CINE.FLOW.5: cover on every surface. The reel's phone act is
      // edge-to-edge and its wide act crops to a portrait plate, so the
      // letterbox mode has no caller left anywhere.
      fit="fill"
      // The wide act's ambient backdrop is an image element too, and it sits
      // FIRST in DOM order. Naming the framed photo keeps the parity probes
      // measuring the surface under test, not the blurred ground behind it.
      imgDataQa="media-preview-img"
      fallback={<div className="h-full w-full" style={{ backgroundColor: "#141210" }} />}
    />
  );

  return (
    <div
      data-qa="media-preview"
      className="relative h-full w-full overflow-hidden bg-[#0b0a08] [&_img]:select-none [&_img]:pointer-events-none [&_video]:select-none [&_video]:pointer-events-none"
      style={{ containerType: "size", aspectRatio: aspect }}
    >
      {wideReel ? (
        // W2: ambient ground, then the two rules, then the plate that holds the
        // framed photo. DOM order is the live act's — the rules sit below the
        // plate, and nothing paints over the photograph at all.
        <>
          {/* The SAME component the live act paints, so the ambient ground
              cannot drift; only the blur radius is restated for the preview's
              box, since the live 64px is measured against a real frame. */}
          <AmbientBackdrop
            src={photo?.image_url}
            blur={asWideCqw(AMBIENT_BLUR_PX, wideRefW)}
          />
          {WIDE_RULE_X.map((x) => (
            <div
              key={x}
              data-qa="wide-rule"
              className="absolute inset-y-0"
              style={{
                left: `${x * 100}%`,
                width: 1,
                backgroundColor: GOLD,
                opacity: WIDE_RULE_OPACITY,
              }}
            />
          ))}
          <div
            data-qa="wide-plate"
            className="absolute overflow-hidden"
            style={{
              top: `${PLATE_TOP_VH}cqh`,
              left: "50%",
              transform: "translateX(-50%)",
              width: PLATE_W,
              height: PLATE_H,
              outline: PLATE_OUTLINE,
            }}
          >
            {media}
          </div>
        </>
      ) : (
        <div className="absolute inset-0">{media}</div>
      )}

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
        // CINE.FLOW.5 phone act (V1 "Edge Veil"): the same directional veil the
        // live act paints — percentages, so it is scale-free and needs no
        // restatement — with the numeral over its title at the foot of the
        // frame. Sizes are the live composition's px expressed in container
        // units against a ~402cqw phone frame, so the scaled preview keeps the
        // live proportions.
        <>
          <div
            data-qa="reel-veil"
            className="absolute inset-0"
            style={{ background: PHONE_VEIL }}
          />
          <div
            data-qa="reel-lockup"
            className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center"
            style={{
              paddingBottom: asPreviewCqw(PHONE_LOCKUP_PAD_BOTTOM_PX),
              paddingLeft: asPreviewCqw(PHONE_LOCKUP_PAD_X_PX),
              paddingRight: asPreviewCqw(PHONE_LOCKUP_PAD_X_PX),
            }}
          >
            <span
              data-qa="reel-numeral"
              style={{
                fontFamily: DISPLAY,
                color: GOLD,
                fontSize: asPreviewCqw(PHONE_NUMERAL_PX),
                lineHeight: 1,
              }}
            >
              {numeral(reelIndex)}
            </span>
            {reelTitle && (
              <span
                style={{
                  fontFamily: DISPLAY,
                  color: IVORY,
                  // The live title clamps between 24 and 28px; on the phone
                  // frames the editor models it is pinned at its 28px ceiling.
                  fontSize: asPreviewCqw(28),
                  lineHeight: 1.1,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginTop: asPreviewCqw(PHONE_LOCKUP_GAP_PX),
                }}
              >
                {reelTitle}
              </span>
            )}
          </div>
        </>
      ) : (
        // CINE.FLOW.5 wide act (W2): the lockup, captioned in the band under the
        // plate. The band's top is the plate's own bottom edge, so it tracks the
        // `min()` above rather than restating it.
        <div
          data-qa="wide-lockup"
          className="absolute inset-x-0 flex flex-col items-center justify-center text-center"
          style={{
            top: `calc(${PLATE_TOP_VH}cqh + ${PLATE_H})`,
            bottom: 0,
            paddingTop: `${BAND_PAD_VH}cqh`,
            paddingBottom: `${BAND_PAD_VH}cqh`,
          }}
        >
          <div
            className="flex items-center"
            style={{
              gap: asWideCqw(12, wideRefW),
              marginBottom: asWideCqw(10, wideRefW),
            }}
          >
            <span
              data-qa="wide-lockup-rule"
              style={{
                display: "block",
                height: 1,
                width: asWideCqw(lockupRulePx(wideRefW), wideRefW),
                backgroundColor: GOLD,
              }}
            />
            <span
              data-qa="wide-numeral"
              style={{
                fontFamily: DISPLAY,
                color: GOLD,
                fontSize: asWideCqw(lockupNumeralPx(wideRefW), wideRefW),
                lineHeight: 1,
                letterSpacing: "0.12em",
                textIndent: "0.12em",
              }}
            >
              {numeral(reelIndex)}
            </span>
            <span
              data-qa="wide-lockup-rule"
              style={{
                display: "block",
                height: 1,
                width: asWideCqw(lockupRulePx(wideRefW), wideRefW),
                backgroundColor: GOLD,
              }}
            />
          </div>
          {reelTitle && (
            <span
              style={{
                fontFamily: DISPLAY,
                color: IVORY,
                fontSize: asWideCqw(lockupTitlePx(wideRefW), wideRefW),
                lineHeight: 1.1,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {reelTitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default SectionPreview;

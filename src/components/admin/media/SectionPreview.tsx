import cornerOrn from "@/assets/cp-corner-ornament-v2.png";
import FramedImage from "@/components/cinematic/FramedImage";
import FramedVideo from "@/components/cinematic/FramedVideo";
import { CHAPTER_GROUNDS, FIELD_LIGHT, SEAM_GOLD } from "@/components/cinematic/FramedVideo";
import type { CinematicPhoto } from "@/components/cinematic/useCinematicData";
import { REEL_CHAPTER_DEFAULTS } from "@/components/cinematic/reelChapters";
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
  CHAPTER_FIELD_FRACTION,
  ORNAMENT_OPACITY,
  PLATE_TOP_VH,
  PlateFrame,
  chapterBodyPx,
  lockupNumeralPx,
  lockupTitlePx,
  plateLaw,
} from "@/components/cinematic/reelWide";
import type { Focal, FitMode, PlateAspect } from "@/hooks/useCinematicMedia";

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
 * The two mirrors:
 *
 *  - PHONE mirrors V1 "Edge Veil": cover photo under one directional veil
 *    weighted to the foot of the frame, a 66px numeral over the title. The
 *    lockup-bound scrim and the numeral's flanking rules are gone with it.
 *  - WIDE mirrors the CINE.FLOW.6 STORY SPREAD (MIRROR.SYNC.1 — this branch was
 *    the frozen W2 mirror through REEL.COPY.1's era, a recorded drift now
 *    repaid): the plate hangs centred in the spread's PHOTO PAGE while the
 *    story chapter occupies the other page — sides alternating per chapter
 *    (even chapters plate→copy, odd flipped) — separated by the 1px gold seam.
 *    REVIEW.2's tonal room comes with it: no ambient backdrop, one
 *    uninterrupted field on the chapter's own ground shade under the
 *    HERO.WIDE.1 luminance gradient, the plate's frame drawn by `PlateFrame`
 *    in its finished markup state (this surface wires no timeline, so it
 *    renders complete and static, exactly as reduced motion does live).
 *
 * The live act computes its wide geometry in px from its measured frame; a
 * preview has no fixed size, so the same laws are restated here in container
 * units — exact for everything that is a pure ratio (the plate box, the chapter
 * column, the seam), and calibrated against the previewed device's own width
 * for the things the live act clamps in px (type sizes, the chapter paddings).
 * Chapter prose is the live act's own fallback law — `REEL_CHAPTER_DEFAULTS`
 * modulo, ES primary — since this surface edits framing, never copy.
 *
 * ADMIN.ASPECT.1 — the wide mirror's plate takes the edited slide's SHAPE
 * (portrait or 3:2 landscape) from `plateLaw`, so the drag surface is genuinely
 * the box that publishes and the editor's pan slack is the live plate's slack.
 * With MIRROR.SYNC.1 the plate's SIZE law matches too: the width cap is applied
 * against the photo page (the frame minus the chapter column), exactly as the
 * live `plateBox(zoneW, frameH)` call applies it.
 *
 * ADMIN.ABOUT.4 — AND THERE IS NO ABOUT COMPOSITION HERE. ADMIN.ABOUT.2 wrote a
 * third branch for the About panel — a bare plate, with the composition explicitly
 * suppressed after it — so every About tab drew a photo crop on black while the
 * reel's tabs drew the two real acts. That branch is deleted, along with the `kind`
 * value that reached it: this component renders a reel or a hero, and the About slot
 * arrives as a reel (see CinematicMediaManager's `editorKind`). An About-shaped
 * preview is now unspellable rather than merely absent.
 *
 * ADMIN.ABOUT.5 — the numeral is a CAPTION POSITION, not a storage index. It arrives
 * as `captionIndex` because the last thing this prop held (`reelIndex`) was a
 * storage fact — which record in `cinematic_media.reel[]` a slot writes to — and the
 * About slot writes to no such record, so it passed the field's do-nothing default
 * and captioned itself "01", the first slide's numeral. The chapter it captions and
 * the record it saves are two facts; only the first one belongs to this component.
 * The chapter eyebrow's LABEL is the slot's own `reelTitle` for the same reason —
 * the About tab reads "04 · Sobre Mí", never a reel chapter's eyebrow.
 */
const DISPLAY = "'Cinzel', 'Cormorant Garamond', Georgia, serif";

type Props = {
  kind: "hero" | "reel";
  /**
   * ADMIN.ABOUT.5 — 0-based CHAPTER position, which is what the numeral reads:
   * the reel's three slides are 0..2 (01/02/03) and the About panel is the fourth
   * chapter, 3 (04). Nothing here indexes storage with it.
   */
  captionIndex?: number;
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
  /**
   * ADMIN.ASPECT.1 — the plate's shape for the record being previewed. Plated
   * compositions only (the wide act); the phone act and the hero hang no plate.
   * Absent ≡ portrait, so a caller that predates the field draws today's plate
   * exactly.
   */
  plate?: PlateAspect;
};

const numeral = (i: number) => String(i + 1).padStart(2, "0");

/**
 * The wide plate box, as CSS. This IS `plateBox`'s "smaller box wins" rule: the
 * height rule is `heightVh`cqh, the width cap is `maxWidthVw`cqw OF THE PHOTO
 * PAGE — the live act sizes against `zoneW = frameW * (1 - CHAPTER_FIELD_FRACTION)`,
 * so the cap is restated as that fraction of the whole frame, then as the height
 * it implies, so a single `min()` can pick the smaller box exactly as the live
 * comparison does.
 *
 * ADMIN.ASPECT.1 — a function of the plate's shape rather than two constants, and
 * the three numbers come from `plateLaw`, so this mirror cannot hold a second
 * opinion about what a landscape plate is.
 */
const plateCss = (plate: PlateAspect) => {
  const { aspect, heightVh, maxWidthVw } = plateLaw(plate);
  const pageCapVw = maxWidthVw * (1 - CHAPTER_FIELD_FRACTION);
  const h = `min(${heightVh}cqh, ${(pageCapVw / aspect).toFixed(3)}cqw)`;
  return { h, w: `calc(${h} * ${aspect})` };
};

/**
 * The reference frame the wide act's px clamps are calibrated against. A slot
 * card belongs to no device, so it previews the wide act at desktop scale.
 */
const WIDE_PREVIEW_REF_W = 1440;

/** A px constant from the live wide composition, as a fraction of its own frame. */
const asWideCqw = (px: number, refW: number) => `${((px / refW) * 100).toFixed(3)}cqw`;

const SectionPreview = ({
  kind,
  captionIndex = 0,
  photo,
  focal,
  zoom,
  reelTitle,
  aspect,
  deviceWidth,
  videoSrc,
  poster,
  fit = "fill",
  plate = "portrait",
}: Props) => {
  const phoneReel = kind === "reel" && deviceWidth != null && reelIsPhoneWidth(deviceWidth);
  const wideReel = kind === "reel" && !phoneReel;
  const wideRefW = deviceWidth ?? WIDE_PREVIEW_REF_W;
  // ADMIN.ASPECT.1 — the plate's box in container units. Computed for every kind
  // (it is two string concatenations) and read only by the plated branch below.
  const plateSize = plateCss(plate);

  // MIRROR.SYNC.1 — the spread's own geometry, restated from WideSlide verbatim:
  // even chapters read plate → copy, odd flipped; the plate hangs centred in the
  // photo page, its top clamped to the header-clearing edge on short frames.
  const copySide: "left" | "right" = captionIndex % 2 === 1 ? "left" : "right";
  const zoneWVw = (1 - CHAPTER_FIELD_FRACTION) * 100;
  const zoneXVw = copySide === "left" ? CHAPTER_FIELD_FRACTION * 100 : 0;
  const plateLeftCss = `calc(${zoneXVw}cqw + (${zoneWVw}cqw - ${plateSize.w}) / 2)`;
  const plateTopCss = `max(${PLATE_TOP_VH}cqh, calc((100cqh - ${plateSize.h}) / 2))`;
  // Chapter prose: the live act's own fallback (`slide.chapter ?? DEFAULTS[i %]`,
  // ES primary). The eyebrow LABEL stays the slot's own caption (ADMIN.ABOUT.5).
  const chapterCopy = REEL_CHAPTER_DEFAULTS[captionIndex % REEL_CHAPTER_DEFAULTS.length].es;
  const chapterPadX = Math.min(96, Math.max(28, wideRefW * 0.04));
  const chapterMaxW = Math.min(wideRefW * CHAPTER_FIELD_FRACTION - 2 * chapterPadX, 420);

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
      // Named so the parity probes address the surface under test directly.
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
        // CINE.FLOW.6 spread (MIRROR.SYNC.1): the tonal room, the plate in the
        // photo page with its finished self-drawn frame, and the story chapter
        // across the seam. DOM order is WideSlide's own.
        <div
          data-qa="wide-room"
          className="absolute inset-0 overflow-hidden"
          style={{
            backgroundColor: CHAPTER_GROUNDS[captionIndex % CHAPTER_GROUNDS.length],
            backgroundImage: FIELD_LIGHT,
          }}
        >
          <div
            data-qa="wide-plate"
            // ADMIN.ASPECT.1 — the canvas declares the shape it drew, exactly as
            // the live plate does, so one spec reads both surfaces the same way.
            data-plate={plate}
            className="absolute overflow-hidden"
            style={{
              left: plateLeftCss,
              top: plateTopCss,
              width: plateSize.w,
              height: plateSize.h,
            }}
          >
            {/* Unveiled: nothing paints over the photograph inside the plate.
                The gold hairline is the self-drawing frame, complete at rest. */}
            {media}
            <PlateFrame />
          </div>

          <div
            data-qa="wide-chapter"
            data-side={copySide}
            className="absolute inset-y-0 overflow-hidden"
            style={{ [copySide]: 0, width: `${CHAPTER_FIELD_FRACTION * 100}cqw` }}
          >
            {/* The 1px gold hairline seam at the chapter/plate junction. */}
            <div
              aria-hidden
              data-qa="wide-chapter-seam"
              className="absolute inset-y-0"
              style={{
                [copySide === "left" ? "right" : "left"]: 0,
                width: 1,
                backgroundColor: SEAM_GOLD,
              }}
            />
            {/* Outer-corner law: one filigree per spread, at the copy column's
                outer top corner, mirrored on a right-hand column. */}
            <img
              src={cornerOrn}
              alt=""
              aria-hidden
              data-qa="chapter-ornament"
              className={`absolute h-auto select-none${copySide === "right" ? " -scale-x-100" : ""}`}
              style={{
                top: asWideCqw(112, wideRefW),
                [copySide]: asWideCqw(28, wideRefW),
                width: `min(22%, ${asWideCqw(96, wideRefW)})`,
                opacity: ORNAMENT_OPACITY,
              }}
              decoding="async"
            />
            <div
              className="flex h-full flex-col justify-center"
              style={{
                paddingLeft: asWideCqw(chapterPadX, wideRefW),
                paddingRight: asWideCqw(chapterPadX, wideRefW),
              }}
            >
              <div style={{ maxWidth: asWideCqw(chapterMaxW, wideRefW) }}>
                <div
                  data-qa="chapter-eyebrow"
                  className="flex items-center"
                  style={{ gap: asWideCqw(12, wideRefW) }}
                >
                  <span
                    aria-hidden
                    data-qa="wide-numeral"
                    className="block leading-none"
                    style={{
                      fontFamily: DISPLAY,
                      color: GOLD,
                      fontSize: asWideCqw(lockupNumeralPx(wideRefW), wideRefW),
                      letterSpacing: "0.12em",
                    }}
                  >
                    {numeral(captionIndex)}
                  </span>
                  <span
                    aria-hidden
                    data-qa="chapter-eyebrow-rule"
                    className="block"
                    style={{
                      height: 1,
                      width: asWideCqw(Math.round(lockupNumeralPx(wideRefW) * 1.2), wideRefW),
                      backgroundColor: GOLD,
                    }}
                  />
                  <span
                    data-qa="chapter-eyebrow-label"
                    className="block uppercase"
                    style={{
                      color: GOLD,
                      fontSize: asWideCqw(12, wideRefW),
                      fontWeight: 500,
                      letterSpacing: "0.25em",
                    }}
                  >
                    {reelTitle ?? chapterCopy.eyebrow}
                  </span>
                </div>
                <h3
                  data-qa="section-heading"
                  className="uppercase"
                  style={{
                    fontFamily: DISPLAY,
                    color: IVORY,
                    fontSize: asWideCqw(lockupTitlePx(wideRefW), wideRefW),
                    fontWeight: 400,
                    lineHeight: 1.1,
                    letterSpacing: "0.06em",
                    marginTop: asWideCqw(18, wideRefW),
                  }}
                >
                  {chapterCopy.title}
                </h3>
                <p
                  data-qa="chapter-body"
                  style={{
                    color: "rgba(240,233,218,0.85)",
                    fontSize: asWideCqw(chapterBodyPx(wideRefW), wideRefW),
                    fontWeight: 300,
                    lineHeight: 1.7,
                    letterSpacing: "0.01em",
                    marginTop: asWideCqw(18, wideRefW),
                    maxWidth: "36ch",
                  }}
                >
                  {chapterCopy.body}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0">{media}</div>
      )}

      {kind === "hero" ? (
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
              {numeral(captionIndex)}
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
      ) : null /* MIRROR.SYNC.1 — the wide caption lives in the chapter above;
                  W2's centred band beneath the plate is superseded here too. */}
    </div>
  );
};

export default SectionPreview;

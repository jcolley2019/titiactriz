import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ImageAspect } from "@/hooks/useEventsBoard";
import type { ClassFramingPair, HeroVideoFraming } from "@/hooks/useCinematicMedia";
import { useReducedMotion } from "@/components/cinematic/useReducedMotion";
import {
  resolveEventMedia,
  SOCIAL_EMBED_SHAPE,
  type EventSocialVideo,
} from "@/lib/event-video";
import {
  defaultEventClassFraming,
  defaultEventVideoSource,
  eventDeviceClassFor,
  eventOrientationFor,
} from "@/lib/event-framing";
import EventFramedImage from "./EventFramedImage";
import EventFramedVideo from "./EventFramedVideo";

/**
 * EVENTS.VIDEO.1 — the card's ONE media well.
 *
 * Before this brick the well was an image, and a video (if any) was a separate
 * block further down the card. Joey's ruling makes the card's medium singular:
 * a card shows an uploaded video, OR a social video, OR the still image — in the
 * same slot, at the same geometry, with the image serving as the POSTER of
 * whichever video is there and as the FALLBACK whenever the video cannot be
 * shown.
 *
 * ## The geometry is not renegotiated
 *
 * Every size rule below is EVENTS.PORTRAIT.1's and EVENTS.NAV.1's, moved here
 * unchanged and now applied to a <video> and to a social poster as well as to an
 * <img>. That is the whole point of one well: a card that swaps its medium in
 * admin cannot change its own shape on the page. The image path in particular is
 * byte-for-byte what it was — the live birthday card renders today exactly as it
 * rendered yesterday, and only Joey's own edit in admin can change that.
 *
 * ## Nothing third-party runs before consent (STEP 3)
 *
 * A social card paints the poster and a play control. No iframe, no platform
 * script, no request to tiktok/instagram/youtube exists on the page until the
 * visitor clicks. The click mounts the PLATFORM'S OWN player, at the platform's
 * own embed URL, over the poster — which stays in the DOM as the box's sizer, so
 * mounting the embed cannot change the card's height. A pinned act measures a
 * frame that the play button will not move (EVENTS.2's decode-wait law).
 *
 * ## Honest failure
 *
 * A link this app cannot read is not guessed at. The visitor gets the still
 * image — no broken frame, no invented player, no "video unavailable" theatre —
 * and the ADMIN gets a warning, because the person who can fix the link is the
 * only person who benefits from being told.
 */

const GOLD = "#C9A55C";
const CREAM = "#f0e9da";

/* ── the ratified caps (EVENTS.PORTRAIT.1 / EVENTS.NAV.1), unchanged ── */
const PORTRAIT_MAX_H = "max-h-[min(560px,70vh)]";
const LANDSCAPE_MAX_H = "max-h-[420px]";
/** EVENTS.NAV.1 — the portrait room, opt-in (tablet portrait only). */
const PORTRAIT_ROOM_MAX_H = "md:portrait:max-h-[min(900px,60vh)]";
/** EVENTS.NAV.1 FIX — 56vh is Joey's measured number, taken on the device. */
const PHONE_ROOM_MAX_H = "max-md:max-h-[56vh]";

type ResolvedAspect = "landscape" | "portrait";

const wrapperClass = (isFull: boolean, fillPortrait?: boolean) =>
  `mx-auto mb-6 ${isFull ? "max-w-3xl" : "max-w-md"} ${fillPortrait ? "max-md:mb-4" : ""}`;

/**
 * The media box itself. Portrait is shown WHOLE at its own ratio and capped;
 * landscape keeps the historic full-width 420px band. Identical for img and
 * video — `object-contain` / `object-cover` mean the same thing to both.
 */
const boxClass = (resolved: ResolvedAspect, fillPortrait?: boolean) =>
  resolved === "portrait"
    ? `mx-auto w-auto h-auto max-w-full ${PORTRAIT_MAX_H} ${
        fillPortrait ? `${PHONE_ROOM_MAX_H} ${PORTRAIT_ROOM_MAX_H}` : ""
      } object-contain rounded-md`
    : `w-full h-auto ${LANDSCAPE_MAX_H} object-cover rounded-md`;

/**
 * EVENTS.MEDIA.EDITOR.1b — the SAME caps, restated for the framed well BOX.
 *
 * The framed branches paint through EventFramedImage/Video: a box div sized by
 * these classes, media inside it styled by the hero resolver. The box must
 * occupy exactly the rectangle the legacy in-flow <img> occupied, but a div has
 * no intrinsic size, so the intrinsic laws are restated as width caps driven by
 * two custom properties the primitive sets from the decoded media:
 *
 *   --evf-ar  intrinsic ratio (w/h) — `aspect-ratio` gives the box its shape,
 *             and each height cap becomes the width cap `cap * ratio`
 *   --evf-nw  intrinsic width in px — the "never upscale past natural size"
 *             half of `w-auto h-auto` (landscape's `w-full` never had it, so
 *             only portrait carries it)
 *
 * Every number is the SAME constant the legacy classes above use; a cap moved
 * there must be moved here, which is why both live in this one file.
 */

/* ── EVENTS.MEDIA.EDITOR.1c — the uploaded-video well follows the SCREEN ──
 *
 * Joey's ruling: one file has to work in every aspect ratio — the hero's own
 * law. So an uploaded video's well is NOT the file's shape: it is the CARD'S
 * design box for the viewport being looked at, and the file covers it through
 * the per-view framing records (zoom/pan in the editor). A portrait screen
 * gets the tall 9:16 well at the ratified height caps (the dialed-in NAV.1
 * phone card); a landscape screen gets the historic full-width 420px band.
 * The design ratios are the SOCIAL_EMBED_SHAPE boxes the social well already
 * uses when it has no poster to measure — promoted, not invented.
 *
 * Images are untouched: a still keeps PORTRAIT.1's own-ratio law exactly.
 */
const videoWellClass = (orientation: "portrait" | "landscape", fillPortrait?: boolean) =>
  orientation === "portrait"
    ? `mx-auto w-full max-w-[min(100%,calc(min(560px,70vh)*9/16))] ${
        fillPortrait
          ? "max-md:max-w-[min(100%,calc(56vh*9/16))] md:portrait:max-w-[min(100%,calc(min(900px,60vh)*9/16))]"
          : ""
      } rounded-md`
    : `w-full ${LANDSCAPE_MAX_H} rounded-md`;

/** The design box's own ratio — inline so the primitive's intrinsic-ratio
 * style cannot override it (later spread wins in the primitive). */
const videoWellStyle = (orientation: "portrait" | "landscape"): React.CSSProperties => ({
  aspectRatio: orientation === "portrait" ? "9 / 16" : "16 / 9",
  maxHeight: orientation === "landscape" ? 420 : undefined,
  boxShadow: `inset 0 0 0 1px ${GOLD}`,
});
const framedBoxClass = (resolved: ResolvedAspect, fillPortrait?: boolean) =>
  resolved === "portrait"
    ? `mx-auto w-full h-auto max-w-[min(100%,calc(min(560px,70vh)*var(--evf-ar)),calc(var(--evf-nw)*1px))] ${
        fillPortrait
          ? "max-md:max-w-[min(100%,calc(56vh*var(--evf-ar)),calc(var(--evf-nw)*1px))] md:portrait:max-w-[min(100%,calc(min(900px,60vh)*var(--evf-ar)),calc(var(--evf-nw)*1px))]"
          : ""
      } rounded-md`
    : `w-full h-auto ${LANDSCAPE_MAX_H} rounded-md`;

/** The gold hairline, painted inside the box so its outer size never moves. */
const framedBoxStyle: React.CSSProperties = { boxShadow: `inset 0 0 0 1px ${GOLD}` };

/**
 * Which stored record this viewport renders: the image's device class at the
 * reel's 768px line, the video's record at the hero's orientation law. Live —
 * a rotated tablet re-picks, exactly as the class-forked reel act does.
 */
const useViewportRecordKeys = () => {
  const [size, setSize] = useState(() =>
    typeof window === "undefined"
      ? { w: 1024, h: 768 }
      : { w: window.innerWidth, h: window.innerHeight },
  );
  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return {
    deviceClass: eventDeviceClassFor(size.w),
    orientation: eventOrientationFor(size.w, size.h),
  };
};

/**
 * "auto" asks the file. Until the browser has decoded it there is nothing to
 * ask, so the well starts landscape — what every row written before the field
 * carried anyway — and switches the moment intrinsic dimensions are known.
 */
const useResolvedAspect = (aspect: ImageAspect) => {
  const [measured, setMeasured] = useState<ResolvedAspect | null>(null);
  const resolved: ResolvedAspect = aspect === "auto" ? (measured ?? "landscape") : aspect;
  const measure = (w: number, h: number) => {
    if (aspect !== "auto" || !w || !h) return;
    setMeasured(h > w ? "portrait" : "landscape");
  };
  return { resolved, measure };
};

/** The admin-only badge on a link the app could not read. Never public. */
const AdminMediaWarning = ({ children }: { children: React.ReactNode }) => (
  <p
    data-qa="event-media-warning"
    role="alert"
    className="mx-auto mt-2 max-w-md px-3 py-2 text-xs"
    style={{ color: "#ffd7d7", backgroundColor: "rgba(173,31,31,0.35)", border: "1px solid #AD1F1F" }}
  >
    {children}
  </p>
);

/* ───────────────────────────── still image ───────────────────────────── */

const EventImage = ({
  src,
  alt,
  isFull,
  aspect,
  fillPortrait,
}: {
  src: string;
  alt: string;
  isFull: boolean;
  aspect: ImageAspect;
  fillPortrait?: boolean;
}) => {
  const { resolved, measure } = useResolvedAspect(aspect);
  return (
    <div className={wrapperClass(isFull, fillPortrait)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        data-qa="event-card-image"
        data-aspect={resolved}
        data-aspect-source={aspect}
        onLoad={(e) => measure(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
        className={boxClass(resolved, fillPortrait)}
        style={{ border: `1px solid ${GOLD}` }}
      />
    </div>
  );
};

/* ─────────────── still image, framed (EVENTS.MEDIA.EDITOR.1b) ─────────────── */

/**
 * The card's still-image medium, painted through the hero resolver. With no
 * stored framing the record is the default and the primitive renders the
 * resolver's object-fit branch in a box shaped by the same caps as ever —
 * today's well to the pixel (law 1 / law 10's reference branch). A stored
 * record pans/zooms the SOURCE inside that unchanged box.
 */
const EventStillImage = ({
  src,
  alt,
  isFull,
  aspect,
  fillPortrait,
  framing,
}: {
  src: string;
  alt: string;
  isFull: boolean;
  aspect: ImageAspect;
  fillPortrait?: boolean;
  framing?: ClassFramingPair;
}) => {
  const { resolved, measure } = useResolvedAspect(aspect);
  const { deviceClass } = useViewportRecordKeys();
  const rec = framing?.[deviceClass] ?? defaultEventClassFraming();
  return (
    <div className={wrapperClass(isFull, fillPortrait)}>
      <EventFramedImage
        src={src}
        alt={alt}
        focal={rec.focal}
        zoom={rec.zoom}
        fit="fill"
        boxClassName={framedBoxClass(resolved, fillPortrait)}
        boxStyle={framedBoxStyle}
        imgDataQa="event-card-image"
        mediaAttrs={{ "data-aspect": resolved, "data-aspect-source": aspect }}
        loading="lazy"
        onNaturalSize={measure}
      />
    </div>
  );
};

/* ──────────────────────────── uploaded video ──────────────────────────── */

/**
 * STEP 2 — ours, so we play it ourselves: muted, looping, inline, with the card
 * image as its poster. Under reduced motion it does not autoplay; it holds the
 * poster frame and gains controls, so the video is still REACHABLE by a visitor
 * who asked the operating system for less movement rather than for less content.
 *
 * EVENTS.MEDIA.EDITOR.1b — rendered through EventFramedVideo: the same well
 * box, the medium styled by the hero resolver, the framing record picked by
 * viewport orientation (the hero video's own law).
 */
const EventUploadedVideo = ({
  src,
  poster,
  title,
  isFull,
  aspect,
  fillPortrait,
  framing,
}: {
  src: string;
  poster: string;
  title: string;
  isFull: boolean;
  aspect: ImageAspect;
  fillPortrait?: boolean;
  framing?: HeroVideoFraming;
}) => {
  const reduced = useReducedMotion();
  const { orientation } = useViewportRecordKeys();
  const rec = framing?.[orientation] ?? defaultEventVideoSource();

  // EVENTS.MEDIA.EDITOR.1c — the well is the SCREEN's design box, never the
  // file's shape; the clip covers it through this viewport's framing record.
  return (
    <div className={wrapperClass(isFull, fillPortrait)}>
      <EventFramedVideo
        src={src}
        poster={poster}
        focal={rec.focal}
        zoom={rec.zoom}
        fit={rec.fit}
        autoPlay={!reduced}
        controls={reduced}
        ariaLabel={title || undefined}
        boxClassName={videoWellClass(orientation, fillPortrait)}
        boxStyle={videoWellStyle(orientation)}
        videoDataQa="event-card-video"
        mediaAttrs={{
          "data-aspect": orientation,
          "data-aspect-source": aspect,
          "data-reduced": reduced ? "true" : "false",
        }}
      />
    </div>
  );
};

/* ───────────────────────────── social video ───────────────────────────── */

const PlayGlyph = () => (
  <span
    aria-hidden
    className="flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
    style={{ backgroundColor: "rgba(14,12,9,0.72)", border: `1px solid ${GOLD}` }}
  >
    <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6" fill={GOLD} aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  </span>
);

/**
 * STEP 3 — the poster is the page; the platform is one click away.
 *
 * The poster stays mounted underneath the embed (hidden, not removed) so the
 * box it measured is the box the embed inherits: mounting the player cannot
 * resize a pinned stage.
 */
const EventSocialEmbed = ({
  video,
  poster,
  title,
  isFull,
  aspect,
  fillPortrait,
  admin,
}: {
  video: EventSocialVideo;
  poster: string;
  title: string;
  isFull: boolean;
  aspect: ImageAspect;
  fillPortrait?: boolean;
  admin?: boolean;
}) => {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const { resolved, measure } = useResolvedAspect(aspect);

  // With a poster, the well keeps the CARD's shape — the poster is the card
  // image and PORTRAIT.1 already ruled on it. Without one there is nothing to
  // measure, so the player's own shape sizes the box.
  const shape: ResolvedAspect = poster ? resolved : SOCIAL_EMBED_SHAPE[video.platform];
  const showEmbed = playing && !failed;

  return (
    <div className={wrapperClass(isFull, fillPortrait)}>
      <div
        data-qa="event-card-social"
        data-platform={video.platform}
        data-playing={showEmbed ? "true" : "false"}
        className={`group relative ${shape === "portrait" ? "inline-block max-w-full" : "block w-full"}`}
        style={{ border: `1px solid ${GOLD}`, borderRadius: 6 }}
      >
        {poster ? (
          <img
            src={poster}
            alt={title || ""}
            loading="lazy"
            data-qa="event-card-poster"
            data-aspect={shape}
            data-aspect-source={aspect}
            onLoad={(e) => measure(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
            className={boxClass(shape, fillPortrait)}
            // Hidden, never unmounted: it is the box's sizer for the embed above.
            style={{ visibility: showEmbed ? "hidden" : undefined }}
          />
        ) : (
          // No poster to size the well, so the player's own shape does.
          <div
            data-qa="event-card-poster-empty"
            className={`${
              shape === "portrait"
                ? `mx-auto aspect-[9/16] w-full ${PORTRAIT_MAX_H} ${
                    fillPortrait ? `${PHONE_ROOM_MAX_H} ${PORTRAIT_ROOM_MAX_H}` : ""
                  }`
                : `aspect-video w-full ${LANDSCAPE_MAX_H}`
            } rounded-md`}
            style={{ backgroundColor: "#13110d" }}
          />
        )}

        {showEmbed ? (
          <iframe
            data-qa="event-card-embed"
            src={video.embedUrl}
            title={title || video.platform}
            className="absolute inset-0 h-full w-full rounded-md"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
            allowFullScreen
            onError={() => setFailed(true)}
          />
        ) : (
          <button
            type="button"
            data-qa="event-card-play"
            onClick={() => {
              setFailed(false);
              setPlaying(true);
            }}
            aria-label={t("events.playVideo")}
            className="absolute inset-0 flex items-center justify-center rounded-md transition-colors duration-300"
            style={{ backgroundColor: "rgba(14,12,9,0.18)" }}
          >
            <PlayGlyph />
          </button>
        )}
      </div>

      {/* A player that refused to load leaves the poster standing. Only the
          admin is told why — the visitor already has the honest thing. */}
      {admin && failed && <AdminMediaWarning>{t("events.admin.embedFailed")}</AdminMediaWarning>}
    </div>
  );
};

/* ──────────────────────────────── the well ──────────────────────────────── */

const EventMedia = ({
  item,
  alt,
  isFull,
  fillPortrait,
  admin,
}: {
  item: {
    imageUrl?: string;
    videoUrl?: string;
    videoFileUrl?: string;
    imageAspect?: ImageAspect;
    imageFraming?: ClassFramingPair;
    videoFraming?: HeroVideoFraming;
  };
  alt: string;
  isFull: boolean;
  fillPortrait?: boolean;
  /** Admin surfaces only: report a link the app could not read. Never public. */
  admin?: boolean;
}) => {
  const { t } = useTranslation();
  const media = resolveEventMedia(item);
  const aspect: ImageAspect =
    item.imageAspect === "landscape" || item.imageAspect === "portrait" ? item.imageAspect : "auto";

  if (media.kind === "none") return null;

  if (media.kind === "image") {
    return (
      <EventStillImage
        src={media.src}
        alt={alt}
        isFull={isFull}
        aspect={aspect}
        fillPortrait={fillPortrait}
        framing={item.imageFraming}
      />
    );
  }

  if (media.kind === "upload") {
    return (
      <EventUploadedVideo
        src={media.src}
        poster={media.poster}
        title={alt}
        isFull={isFull}
        aspect={aspect}
        fillPortrait={fillPortrait}
        framing={item.videoFraming}
      />
    );
  }

  // Social. An unreadable link is not a player: the still image stands in, and
  // the warning exists only where someone can act on it.
  if (!media.video) {
    return (
      <>
        {media.poster && (
          <EventImage
            src={media.poster}
            alt={alt}
            isFull={isFull}
            aspect={aspect}
            fillPortrait={fillPortrait}
          />
        )}
        {admin && <AdminMediaWarning>{t("events.admin.linkUnreadable")}</AdminMediaWarning>}
      </>
    );
  }

  return (
    <EventSocialEmbed
      video={media.video}
      poster={media.poster}
      title={alt}
      isFull={isFull}
      aspect={aspect}
      fillPortrait={fillPortrait}
      admin={admin}
    />
  );
};

export default EventMedia;

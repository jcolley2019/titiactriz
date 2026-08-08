import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ImageAspect } from "@/hooks/useEventsBoard";
import { useReducedMotion } from "@/components/cinematic/useReducedMotion";
import {
  resolveEventMedia,
  SOCIAL_EMBED_SHAPE,
  type EventSocialVideo,
} from "@/lib/event-video";

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

/* ──────────────────────────── uploaded video ──────────────────────────── */

/**
 * STEP 2 — ours, so we play it ourselves: muted, looping, inline, with the card
 * image as its poster. Under reduced motion it does not autoplay; it holds the
 * poster frame and gains controls, so the video is still REACHABLE by a visitor
 * who asked the operating system for less movement rather than for less content.
 */
const EventUploadedVideo = ({
  src,
  poster,
  title,
  isFull,
  aspect,
  fillPortrait,
}: {
  src: string;
  poster: string;
  title: string;
  isFull: boolean;
  aspect: ImageAspect;
  fillPortrait?: boolean;
}) => {
  const reduced = useReducedMotion();
  const { resolved, measure } = useResolvedAspect(aspect);

  return (
    <div className={wrapperClass(isFull, fillPortrait)}>
      <video
        src={src}
        poster={poster || undefined}
        data-qa="event-card-video"
        data-aspect={resolved}
        data-aspect-source={aspect}
        data-reduced={reduced ? "true" : "false"}
        aria-label={title || undefined}
        muted
        loop
        playsInline
        autoPlay={!reduced}
        controls={reduced}
        preload="metadata"
        onLoadedMetadata={(e) => measure(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
        className={boxClass(resolved, fillPortrait)}
        style={{ border: `1px solid ${GOLD}` }}
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
  item: { imageUrl?: string; videoUrl?: string; videoFileUrl?: string; imageAspect?: ImageAspect };
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
      <EventImage
        src={media.src}
        alt={alt}
        isFull={isFull}
        aspect={aspect}
        fillPortrait={fillPortrait}
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

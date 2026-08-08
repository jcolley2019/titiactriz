import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import cornerOrn from "@/assets/cp-corner-ornament-v2.png";
import { decodeImage, cropErrorCauseKey } from "@/lib/crop";
import { probeVideoSize } from "@/lib/hero-video";
import { resolveHeroGeometry } from "@/lib/hero-framing";
import {
  MEDIA_PREVIEW_DEVICES,
  resolveDevicePreset,
  type DevicePreset,
} from "@/lib/device-presets";
import {
  FIT_MIN_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  clampSourceZoom,
  framingFromFocalZoom,
  type ClassFramingPair,
  type FitMode,
  type Focal,
  type HeroVideoFraming,
  type VideoOrientation,
} from "@/hooks/useCinematicMedia";
import type { EventCardItem } from "@/hooks/useEventsBoard";
import {
  defaultEventClassFraming,
  defaultEventImageFraming,
  defaultEventVideoFraming,
  defaultEventVideoSource,
  eventDeviceClassFor,
  eventImageFramingIsDefault,
  eventOrientationFor,
  eventVideoFramingIsDefault,
} from "@/lib/event-framing";
import EventFramedImage from "@/components/events/EventFramedImage";
import EventFramedVideo from "@/components/events/EventFramedVideo";

/**
 * EVENTS.MEDIA.EDITOR.1c — the hero editor's grammar, with the EVENT CARD as
 * its composition (Joey's ruling, both halves):
 *
 *   1. The gold frame is the SCREEN — the device preset's aspect, exactly as
 *      the hero editor draws it.
 *   2. What fills the frame is the CARD as that screen shows it: the /events
 *      page ground, the card shell with its corners, the badge, the title,
 *      the copy — and the media well where the card actually puts it. The
 *      medium paints INTO the well through the resolver, and drag/zoom pan
 *      the source across the WELL's real overflow (the hero editor's own
 *      previewFrame law: measure against the box the media actually paints
 *      into, never the device-shaped surface).
 *
 * The uploaded-video well is the SCREEN's design box (9:16 at the ratified
 * caps on portrait screens, the 420px band on landscape ones — see
 * EventMedia's videoWellClass), so one file of any shape is framed per view,
 * exactly like the hero. A still image keeps PORTRAIT.1's own-ratio well.
 *
 * All controls are the hero editor's: device tabs with live composition
 * thumbnails, the orientation caption, the aspect-mismatch hint (against the
 * WELL the clip must cover), Display Fill/Fit, Zoom, Reset / Cancel / Save.
 * Records stay in the events stored shapes; all-default saves as undefined.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const SURFACE_MAX_H = 360;
const ASPECT_MISMATCH = 0.25;

const GOLD = "#C9A55C";
const CREAM = "#f0e9da";
const DARK = "#0e0c09";
const PAGE_GROUND = "#0b0a08";

/* ── the /events layout, in the previewed device's own px ──
 * Sources: Events.tsx (px-4, md:portrait:max-w-2xl), EventsGrid (max-w-5xl,
 * md:gap-8 halves), EventCard (p-8 md:p-12 / p-6 md:p-8, max-md:p-6 under
 * fillPortrait, the 1px gold border), EventMedia (max-w-3xl / max-w-md
 * wrapper, the ratified height caps). /events passes fillPortrait, and this
 * canvas previews /events. */
const cardColumn = (d: DevicePreset, isFull: boolean) => {
  const isPortraitTablet = d.width >= 768 && d.height > d.width;
  const content = Math.min(isPortraitTablet ? 672 : 1024, d.width - 32);
  return isFull || d.width < 768 ? content : (content - 32) / 2;
};
const cardPad = (d: DevicePreset, isFull: boolean) => {
  if (d.width < 768) return 24; // fillPortrait's max-md:p-6
  return isFull ? 48 : 32; // md:p-12 / md:p-8
};
const portraitCapH = (d: DevicePreset) => {
  if (d.width < 768) return 0.56 * d.height; // PHONE_ROOM_MAX_H
  if (d.height > d.width) return Math.min(900, 0.6 * d.height); // PORTRAIT_ROOM
  return Math.min(560, 0.7 * d.height); // PORTRAIT_MAX_H
};

type WellBox = { w: number; h: number };

/** The card's media well on one device — the box the medium paints into. */
const wellFor = (
  d: DevicePreset,
  isFull: boolean,
  isVideo: boolean,
  natural: { w: number; h: number } | null,
): WellBox | null => {
  const inner = Math.max(120, cardColumn(d, isFull) - 2 * cardPad(d, isFull) - 2);
  const wrapper = Math.min(inner, isFull ? 768 : 448);
  if (isVideo) {
    // EVENTS.MEDIA.EDITOR.1c — the SCREEN's design box, never the file's shape.
    if (eventOrientationFor(d.width, d.height) === "portrait") {
      const w = Math.min(wrapper, portraitCapH(d) * (9 / 16));
      return { w, h: w / (9 / 16) };
    }
    const w = Math.min(wrapper, 768);
    return { w, h: Math.min(w / (16 / 9), 420) };
  }
  // Still image: PORTRAIT.1's own-ratio law, unchanged.
  if (!natural) return null;
  const ar = natural.w / natural.h;
  if (natural.h > natural.w) {
    const w = Math.min(wrapper, portraitCapH(d) * ar, natural.w);
    return { w, h: w / ar };
  }
  return { w: wrapper, h: Math.min(wrapper / ar, 420) };
};

/** The card's text, already picked to one language (ES primary). */
export type EventCardPreviewText = {
  badge: string;
  title: string;
  description: string;
  note: string;
  buttons: string[];
};

type CompositionProps = {
  d: DevicePreset;
  isFull: boolean;
  isVideo: boolean;
  src: string;
  poster?: string;
  text: EventCardPreviewText;
  focal: Focal;
  zoom: number;
  fit: FitMode;
  well: WellBox | null;
  /** Thumbnails pause playback; the big canvas plays like the card does. */
  autoPlayVideo: boolean;
};

/**
 * The screen's content: the /events page ground with the CARD laid out at the
 * device's own CSS px (breakpoint choices made from d.width, since the admin
 * viewport's media queries must not leak in). The caller scales this whole
 * subtree to its frame with a transform.
 */
const CardComposition = ({
  d,
  isFull,
  isVideo,
  src,
  poster,
  text,
  focal,
  zoom,
  fit,
  well,
  autoPlayVideo,
}: CompositionProps) => {
  const phone = d.width < 768;
  const pad = cardPad(d, isFull);
  const colW = cardColumn(d, isFull);
  const cornerW = phone ? 40 : 56;
  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden"
      style={{ backgroundColor: PAGE_GROUND }}
    >
      <article
        className="relative text-center"
        style={{
          width: colW,
          padding: pad,
          backgroundColor: "#13110d",
          border: `1px solid ${GOLD}`,
          boxShadow: "0 20px 60px -30px rgba(201, 165, 92, 0.35)",
        }}
      >
        {isFull &&
          ([
            ["top", "left", ""],
            ["top", "right", "-scale-x-100"],
            ["bottom", "left", "-scale-y-100"],
            ["bottom", "right", "-scale-100"],
          ] as const).map(([v, h, flip]) => (
            <img
              key={`${v}-${h}`}
              src={cornerOrn}
              alt=""
              aria-hidden
              className={`pointer-events-none absolute h-auto select-none ${flip}`}
              style={{ [v]: 8, [h]: 8, width: cornerW }}
            />
          ))}

        {text.badge && (
          <span
            className="inline-block uppercase"
            style={{
              backgroundColor: GOLD,
              color: DARK,
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: isFull ? 10.4 : 9.6,
              letterSpacing: "0.25em",
              padding: "4px 12px",
              marginBottom: isFull ? 24 : 16,
            }}
          >
            {text.badge}
          </span>
        )}

        {text.title && (
          <h2
            style={{
              fontFamily: "var(--font-display)",
              color: CREAM,
              fontSize: isFull ? (phone ? 24 : 36) : phone ? 20 : 24,
              lineHeight: 1.25,
              marginBottom: 16,
            }}
          >
            {text.title}
          </h2>
        )}

        {well && (
          <div
            className="mx-auto"
            style={{ width: well.w, height: well.h, marginBottom: phone ? 16 : 24 }}
          >
            {isVideo ? (
              <EventFramedVideo
                src={src}
                poster={poster}
                focal={focal}
                zoom={zoom}
                fit={fit}
                autoPlay={autoPlayVideo}
                controls={false}
                videoDataQa={autoPlayVideo ? "event-framing-media" : undefined}
                boxClassName="h-full w-full rounded-md"
                boxStyle={{ boxShadow: `inset 0 0 0 1px ${GOLD}` }}
              />
            ) : (
              <EventFramedImage
                src={src}
                alt=""
                focal={focal}
                zoom={zoom}
                fit="fill"
                imgDataQa={autoPlayVideo ? "event-framing-media" : undefined}
                boxClassName="h-full w-full rounded-md"
                boxStyle={{ boxShadow: `inset 0 0 0 1px ${GOLD}` }}
              />
            )}
          </div>
        )}

        {text.description && (
          <p
            className="mx-auto"
            style={{
              color: `${CREAM}d9`,
              lineHeight: 1.7,
              fontSize: isFull ? (phone ? 14 : 16) : 14,
              maxWidth: isFull ? 672 : 448,
              marginBottom: 24,
            }}
          >
            {text.description}
          </p>
        )}

        {text.note && (
          <p
            className="mx-auto italic"
            style={{
              color: `${CREAM}b3`,
              fontSize: isFull ? (phone ? 12 : 14) : 12,
              maxWidth: isFull ? 576 : 384,
              marginBottom: 32,
            }}
          >
            {text.note}
          </p>
        )}

        {text.buttons.length > 0 && (
          <div className="flex flex-wrap items-center justify-center" style={{ gap: 12 }}>
            {text.buttons.map((label, i) => (
              <span
                key={i}
                className="inline-flex items-center justify-center uppercase"
                style={{
                  fontSize: 12,
                  letterSpacing: "0.2em",
                  fontWeight: 500,
                  padding: "10px 24px",
                  ...(i === 0
                    ? { backgroundColor: GOLD, color: DARK }
                    : { color: CREAM, border: `1px solid ${GOLD}` }),
                }}
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </article>
    </div>
  );
};

type Props = {
  open: boolean;
  /** Which medium's framing this session edits — the card's CURRENT medium. */
  mode: "image" | "video";
  src: string;
  /** Video mode: the card image, shown exactly as the card posters it. */
  poster?: string;
  isFull: boolean;
  /** The card's own copy, so the preview IS the card the visitor sees. */
  text: EventCardPreviewText;
  initialImage?: ClassFramingPair;
  initialVideo?: HeroVideoFraming;
  saving?: boolean;
  /** All-default framing arrives as `undefined` — the field is then omitted. */
  onSave: (patch: Pick<EventCardItem, "imageFraming" | "videoFraming">) => void;
  onCancel: () => void;
};

const EventFramingEditor = ({
  open,
  mode,
  src,
  poster,
  isFull,
  text,
  initialImage,
  initialVideo,
  saving,
  onSave,
  onCancel,
}: Props) => {
  const { t } = useTranslation();
  const isVideo = mode === "video";

  const [deviceId, setDeviceId] = useState(MEDIA_PREVIEW_DEVICES[0].id);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const seedImage = (): ClassFramingPair =>
    initialImage
      ? {
          phone: { focal: { ...initialImage.phone.focal }, zoom: initialImage.phone.zoom },
          wide: { focal: { ...initialImage.wide.focal }, zoom: initialImage.wide.zoom },
        }
      : defaultEventImageFraming();
  const seedVideo = (): HeroVideoFraming =>
    initialVideo
      ? {
          landscape: { ...initialVideo.landscape, focal: { ...initialVideo.landscape.focal } },
          portrait: { ...initialVideo.portrait, focal: { ...initialVideo.portrait.focal } },
        }
      : defaultEventVideoFraming();

  const [iFraming, setIFraming] = useState<ClassFramingPair>(seedImage);
  const [vFraming, setVFraming] = useState<HeroVideoFraming>(seedVideo);

  const device = resolveDevicePreset(deviceId);
  const aspect = device.width / device.height;
  const activeClass = eventDeviceClassFor(device.width);
  const activeOrientation: VideoOrientation = eventOrientationFor(device.width, device.height);

  const rec = isVideo ? vFraming[activeOrientation] : iFraming[activeClass];
  const activeFit: FitMode = isVideo ? vFraming[activeOrientation].fit : "fill";

  const setFocal = (f: Focal) =>
    isVideo
      ? setVFraming((v) => ({ ...v, [activeOrientation]: { ...v[activeOrientation], focal: f } }))
      : setIFraming((v) => ({ ...v, [activeClass]: { ...v[activeClass], focal: f } }));
  const setZoom = (z: number) =>
    isVideo
      ? setVFraming((v) => ({
          ...v,
          [activeOrientation]: {
            ...v[activeOrientation],
            zoom: clampSourceZoom(z, v[activeOrientation].fit),
          },
        }))
      : setIFraming((v) => ({
          ...v,
          [activeClass]: { ...v[activeClass], zoom: clampSourceZoom(z, "fill") },
        }));
  const setFit = (fit: FitMode) =>
    setVFraming((v) => {
      const cur = v[activeOrientation];
      return {
        ...v,
        [activeOrientation]: { ...cur, fit, zoom: clampSourceZoom(cur.zoom, fit) },
      };
    });

  // Reset transient state when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setDeviceId(MEDIA_PREVIEW_DEVICES[0].id);
    setIFraming(seedImage());
    setVFraming(seedVideo());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Probe the medium's intrinsic size (image decode / video metadata).
  useEffect(() => {
    if (!open) return;
    setNatural(null);
    setLoadError(null);
    if (!src) return;
    let cancelled = false;
    const measure = isVideo
      ? probeVideoSize(src).then((s) => ({ w: s.w, h: s.h }))
      : decodeImage(src).then((img) => ({ w: img.naturalWidth, h: img.naturalHeight }));
    measure
      .then((size) => {
        if (!cancelled) setNatural(size);
      })
      .catch((err) => {
        if (cancelled) return;
        const key = cropErrorCauseKey(err);
        setLoadError(t(key));
        toast({ title: t("admin.media.editor.saveFailed"), description: t(key), variant: "destructive" });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, src, isVideo]);

  /* ── canvas sizing (the hero editor's own availW/viewport-cap mechanics) ── */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [availW, setAvailW] = useState(480);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvailW(el.clientWidth));
    ro.observe(el);
    setAvailW(el.clientWidth);
    return () => ro.disconnect();
  }, [open]);

  const viewportCap =
    typeof window !== "undefined" ? Math.max(240, window.innerWidth - 80) : 480;
  let fw = Math.min(availW, viewportCap);
  let fh = fw / aspect;
  if (fh > SURFACE_MAX_H) {
    fh = SURFACE_MAX_H;
    fw = fh * aspect;
  }
  const scale = fw / device.width;

  const well = wellFor(device, isFull, isVideo, natural);

  /* ── drag: pan across the resolver's real overflow of the WELL box — the
   * hero editor's previewFrame law: the box the media actually paints into. ── */
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startFocal: Focal;
    overflowX: number;
    overflowY: number;
  } | null>(null);

  const surfaceOverflow = useCallback(
    (focal: Focal, zoom: number, fit: FitMode) => {
      if (!natural || !well) return { x: 0, y: 0 };
      const geo = resolveHeroGeometry(
        natural.w / natural.h,
        well.w / well.h,
        framingFromFocalZoom(focal, zoom, fit),
      );
      if (!geo) return { x: 0, y: 0 };
      return {
        x: (Math.max(0, geo.widthPct - 100) / 100) * well.w * scale,
        y: (Math.max(0, geo.heightPct - 100) / 100) * well.h * scale,
      };
    },
    [natural, well, scale],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!natural || loadError) return;
    const o = surfaceOverflow(rec.focal, rec.zoom, activeFit);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startFocal: { ...rec.focal },
      overflowX: o.x,
      overflowY: o.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setFocal({
      x: d.overflowX > 0 ? clamp01(d.startFocal.x - dx / d.overflowX) : d.startFocal.x,
      y: d.overflowY > 0 ? clamp01(d.startFocal.y - dy / d.overflowY) : d.startFocal.y,
    });
  };
  const endDrag = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const resetActive = () => {
    if (isVideo) {
      setVFraming((v) => ({ ...v, [activeOrientation]: defaultEventVideoSource() }));
    } else {
      setIFraming((v) => ({ ...v, [activeClass]: defaultEventClassFraming() }));
    }
    toast({ title: t("admin.media.editor.resetDone") });
  };

  const handleSave = () => {
    if (isVideo) {
      onSave({ videoFraming: eventVideoFramingIsDefault(vFraming) ? undefined : vFraming });
    } else {
      onSave({ imageFraming: eventImageFramingIsDefault(iFraming) ? undefined : iFraming });
    }
  };

  // Aspect-mismatch hint (video only): the clip vs the WELL it must cover.
  const natAspect = natural && natural.h > 0 ? natural.w / natural.h : null;
  const wellAspect = well ? well.w / well.h : null;
  const mismatch =
    isVideo &&
    natAspect !== null &&
    wellAspect !== null &&
    Math.abs(natAspect - wellAspect) / wellAspect > ASPECT_MISMATCH;
  const hintKey =
    natAspect !== null && wellAspect !== null && natAspect < wellAspect
      ? "admin.media.video.hintPortrait"
      : "admin.media.video.hintLandscape";

  const sourceLabelKey =
    activeOrientation === "portrait"
      ? "admin.media.video.framingViewportPortrait"
      : "admin.media.video.framingViewportLandscape";

  const zoomMin = activeFit === "fit" ? FIT_MIN_ZOOM : MIN_ZOOM;

  const tabRecord = (w: number, h: number) =>
    isVideo ? vFraming[eventOrientationFor(w, h)] : iFraming[eventDeviceClassFor(w)];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) onCancel();
      }}
    >
      <DialogContent
        data-qa="event-framing-editor"
        className="max-h-[92dvh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{t("admin.eventsBoard.framingTitle")}</DialogTitle>
          <DialogDescription>
            {t(isVideo ? "admin.media.video.dragHint" : "admin.media.editor.dragHint")}
          </DialogDescription>
        </DialogHeader>

        {/* Which record this tab edits — the hero editor's orientation caption. */}
        {isVideo && (
          <span data-qa="event-framing-source-label" className="text-xs font-medium text-accent">
            {t(sourceLabelKey)}
          </span>
        )}

        {/* Device tabs — each a scaled live CARD on the device-shaped thumbnail
            its preset describes, previewing ITS OWN record. */}
        <div data-qa="event-framing-devices" className="flex flex-wrap gap-2">
          {MEDIA_PREVIEW_DEVICES.map((dev) => {
            const isActive = dev.id === deviceId;
            const a = dev.width / dev.height;
            const tf = tabRecord(dev.width, dev.height);
            const tWell = wellFor(dev, isFull, isVideo, natural);
            return (
              <button
                key={dev.id}
                type="button"
                data-qa={`event-framing-device-${dev.id}`}
                onClick={() => setDeviceId(dev.id)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-accent/60"
                }`}
              >
                {/* box-content: the border must not shrink the preview box, or
                    the thumbnail's aspect drifts off the device aspect. */}
                <span
                  className="box-content block overflow-hidden rounded-sm border border-border [&_img]:pointer-events-none [&_video]:pointer-events-none"
                  style={{ height: 40, width: 40 * a }}
                >
                  <span
                    className="block"
                    style={{
                      width: dev.width,
                      height: dev.height,
                      transform: `scale(${40 / dev.height})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <CardComposition
                      d={dev}
                      isFull={isFull}
                      isVideo={isVideo}
                      src={src}
                      poster={poster}
                      text={text}
                      focal={tf.focal}
                      zoom={tf.zoom}
                      fit={isVideo ? (tf as { fit?: FitMode }).fit ?? "fill" : "fill"}
                      well={tWell}
                      autoPlayVideo={false}
                    />
                  </span>
                </span>
                {dev.label}
              </button>
            );
          })}
        </div>

        {/* Editing surface: the SCREEN, showing the CARD, the medium framed
            into the card's own well. */}
        <div ref={wrapRef} className="flex w-full min-w-0 justify-center">
          {loadError ? (
            <div
              className="flex items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 px-4 text-center text-sm text-destructive"
              style={{ width: fw, height: fh }}
            >
              {loadError}
            </div>
          ) : (
            <div
              data-qa="event-framing-surface"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onDragStart={(e) => e.preventDefault()}
              className="relative touch-none select-none cursor-grab overflow-hidden rounded-md active:cursor-grabbing [&_img]:pointer-events-none [&_video]:pointer-events-none"
              style={{ width: fw, height: fh }}
            >
              <div
                style={{
                  width: device.width,
                  height: device.height,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <CardComposition
                  d={device}
                  isFull={isFull}
                  isVideo={isVideo}
                  src={src}
                  poster={poster}
                  text={text}
                  focal={rec.focal}
                  zoom={rec.zoom}
                  fit={activeFit}
                  well={well}
                  autoPlayVideo
                />
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-inset ring-[hsl(var(--gold-light))]/70" />
            </div>
          )}
        </div>

        {/* Aspect-mismatch hint (non-blocking, video only). */}
        {mismatch && (
          <p
            data-qa="event-framing-hint"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500"
          >
            {t(hintKey)}
          </p>
        )}

        {/* Fill / Fit display mode (video only — the hero's own control). */}
        {isVideo && (
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">
              {t("admin.media.video.fitLabel")}
            </span>
            <div data-qa="event-framing-fit" className="flex gap-2">
              {(["fill", "fit"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  data-qa={`event-framing-fit-${f}`}
                  onClick={() => setFit(f)}
                  aria-pressed={activeFit === f}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    activeFit === f
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-accent/60"
                  }`}
                >
                  {t(f === "fill" ? "admin.media.video.fitFill" : "admin.media.video.fitFit")}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-xs text-muted-foreground">
            {t("admin.media.editor.zoom")}
          </span>
          <input
            type="range"
            data-qa="event-framing-zoom"
            min={zoomMin}
            max={MAX_ZOOM}
            step={0.01}
            value={rec.zoom}
            disabled={!!loadError}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="h-1.5 flex-1 accent-[hsl(var(--gold-light))]"
          />
          <span
            data-qa="event-framing-zoom-value"
            className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
          >
            {rec.zoom.toFixed(2)}×
          </span>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={resetActive}
            disabled={saving}
            data-qa="event-framing-reset"
            className="text-muted-foreground hover:text-foreground"
          >
            {t("admin.media.editor.reset")}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={saving}
              data-qa="event-framing-cancel"
            >
              {t("admin.media.editor.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !natural || !!loadError}
              data-qa="event-framing-save"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {saving ? t("admin.media.editor.saving") : t("admin.media.editor.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventFramingEditor;

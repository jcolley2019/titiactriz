import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
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
import SectionPreview from "./SectionPreview";
import { areaToFocalZoom, focalZoomToAreaPct } from "./cropMath";
import { decodeImage, cropErrorCauseKey } from "@/lib/crop";
import { probeVideoSize } from "@/lib/hero-video";
import { MEDIA_PREVIEW_DEVICES, devicePreviewAspect } from "@/lib/device-presets";
import {
  MIN_ZOOM,
  MAX_ZOOM,
  FIT_MIN_ZOOM,
  clampSourceZoom,
  defaultHeroVideo,
  defaultVideoSource,
  type Focal,
  type FitMode,
  type HeroVideoFraming,
  type VideoOrientation,
  type VideoSourceFraming,
} from "@/hooks/useCinematicMedia";
import type { CinematicPhoto } from "@/components/cinematic/useCinematicData";

/**
 * ADMIN.MEDIA.4 — framing editor extracted from the TitiLinks profile editor.
 *
 * IMAGE mode (all four slots) is react-easy-crop, ported directly from
 * EditableProfileView's manual-crop step: the same <Cropper> (drag to reposition,
 * wheel/pinch + slider zoom, min-zoom-to-cover clamp via restrictPosition), the
 * same VISIBLE frame overlay — the target-canvas outline with everything outside
 * it dimmed — at the device tab's aspect. The one adaptation: instead of writing
 * a cropped file (TitiLinks' getCroppedImage), Save lifts the crop rectangle into
 * this site's non-destructive focal + zoom (cropMath). Device tabs re-aspect the
 * frame and drive live thumbnails.
 *
 * VIDEO mode (hero) keeps TitiLinks' hero-video object-position approach, extended
 * to 2D focal + zoom, dual orientation sources, fill/fit, and the mismatch hint.
 */
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * FIX.MEDIA.C — in fit (Ajustar) mode, any axis whose scaled video does NOT
 * overflow the frame is pure letterbox bars: the only sensible position is
 * dead center. Snap that axis's focal to 0.5; leave overflowing axes (and
 * fill mode) untouched. The 0.5px tolerance absorbs rounding.
 */
const centerBarAxes = (
  src: VideoSourceFraming,
  natural: { w: number; h: number } | null,
  fw: number,
  fh: number,
): VideoSourceFraming => {
  if (src.fit !== "fit" || !natural || natural.w <= 0 || natural.h <= 0) return src;
  const s = Math.min(fw / natural.w, fh / natural.h) * src.zoom;
  const centerX = natural.w * s <= fw + 0.5;
  const centerY = natural.h * s <= fh + 0.5;
  if (!centerX && !centerY) return src;
  return { ...src, focal: { x: centerX ? 0.5 : src.focal.x, y: centerY ? 0.5 : src.focal.y } };
};
const SURFACE_MAX_H = 360;
const ASPECT_MISMATCH = 0.25;

type Props = {
  open: boolean;
  slotLabel: string;
  kind: "hero" | "reel";
  reelIndex?: number;
  reelTitle?: string;
  photo?: CinematicPhoto;
  initialFocal: Focal;
  initialZoom: number;
  heroVideoActive?: boolean;
  saving?: boolean;
  mode?: "image" | "video";
  videoSrc?: string | null;
  initialVideo?: HeroVideoFraming;
  poster?: string;
  onSave: (focal: Focal, zoom: number) => void;
  onSaveVideo?: (framing: HeroVideoFraming) => void;
  onReset: () => void;
  onCancel: () => void;
};

/* ---- Shared gold frame overlay for react-easy-crop (visible outline + dim). ---- */
const CROP_AREA_STYLE: React.CSSProperties = {
  border: "2px solid hsl(var(--gold-light))",
  boxShadow: "0 0 0 9999em rgba(11, 10, 8, 0.62)",
  color: "transparent",
};
const CROP_MEDIA_STYLE: React.CSSProperties = { backgroundColor: "#0b0a08" };

const FramingEditor = ({
  open,
  slotLabel,
  kind,
  reelIndex = 0,
  reelTitle,
  photo,
  initialFocal,
  initialZoom,
  heroVideoActive,
  saving,
  mode = "image",
  videoSrc,
  initialVideo,
  poster,
  onSave,
  onSaveVideo,
  onReset,
  onCancel,
}: Props) => {
  const { t } = useTranslation();
  const isVideo = mode === "video";

  const [deviceId, setDeviceId] = useState(MEDIA_PREVIEW_DEVICES[0].id);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const aspect = devicePreviewAspect(deviceId);

  /* ---------------- IMAGE mode (react-easy-crop) ---------------- */
  const imageSrc = !isVideo ? photo?.image_url : undefined;
  const [rcCrop, setRcCrop] = useState({ x: 0, y: 0 });
  const [rcZoom, setRcZoom] = useState(1);
  const [rcArea, setRcArea] = useState<Area | null>(null);
  // Seed react-easy-crop ONCE from the saved framing (stable across drags/tabs).
  const [seedPct, setSeedPct] = useState<
    { x: number; y: number; width: number; height: number } | undefined
  >(undefined);

  /* ---------------- VIDEO mode (object-position surface) ---------------- */
  const [vFraming, setVFraming] = useState<HeroVideoFraming>(initialVideo ?? defaultHeroVideo());
  // VID.MODEL.1: one video; each device tab edits the framing record for the
  // VIEWPORT ORIENTATION its aspect represents (aspect < 1 → portrait record).
  // No cross-source fallback — the record follows the tab, always.
  const activeOrientation: VideoOrientation = aspect < 1 ? "portrait" : "landscape";
  const displayedSrc = isVideo ? videoSrc ?? undefined : undefined;
  const vCur = vFraming[activeOrientation];

  const setVFocal = (f: Focal) =>
    setVFraming((v) => ({ ...v, [activeOrientation]: { ...v[activeOrientation], focal: f } }));
  const setVZoom = (z: number) =>
    setVFraming((v) => {
      const src = { ...v[activeOrientation], zoom: z };
      return { ...v, [activeOrientation]: centerBarAxes(src, natural, fw, fh) };
    });
  const setFit = (nextFit: FitMode) =>
    setVFraming((v) => {
      const src = v[activeOrientation];
      const next = { ...src, fit: nextFit, zoom: clampSourceZoom(src.zoom, nextFit) };
      return { ...v, [activeOrientation]: centerBarAxes(next, natural, fw, fh) };
    });

  const wrapRef = useRef<HTMLDivElement>(null);
  const [availW, setAvailW] = useState(480);
  const dragRef = useRef<
    | { startX: number; startY: number; startFocal: Focal; overflowX: number; overflowY: number }
    | null
  >(null);

  const mediaSrc = isVideo ? displayedSrc : imageSrc;

  // Reset transient state when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setDeviceId(MEDIA_PREVIEW_DEVICES[0].id);
    setRcCrop({ x: 0, y: 0 });
    setRcZoom(1);
    setRcArea(null);
    setSeedPct(undefined);
    setVFraming(initialVideo ?? defaultHeroVideo());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Measure the shown media's intrinsic size (image decode / video metadata).
  useEffect(() => {
    if (!open) return;
    setNatural(null);
    setLoadError(null);
    if (!mediaSrc) return;
    let cancelled = false;
    const measure = isVideo
      ? probeVideoSize(mediaSrc).then((s) => ({ w: s.w, h: s.h }))
      : decodeImage(mediaSrc).then((img) => ({ w: img.naturalWidth, h: img.naturalHeight }));
    measure
      .then((size) => {
        if (cancelled) return;
        setNatural(size);
        if (!isVideo) setSeedPct(focalZoomToAreaPct(initialFocal, initialZoom, size.w, size.h, aspect));
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
  }, [open, mediaSrc, isVideo]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvailW(el.clientWidth));
    ro.observe(el);
    setAvailW(el.clientWidth);
    return () => ro.disconnect();
  }, [open]);

  let fw = availW;
  let fh = fw / aspect;
  if (fh > SURFACE_MAX_H) {
    fh = SURFACE_MAX_H;
    fw = fh * aspect;
  }

  // Live image focal/zoom derived from the current crop, for the thumbnails.
  const liveImageFraming =
    !isVideo && rcArea && natural
      ? areaToFocalZoom(rcArea, natural.w, natural.h, aspect, MIN_ZOOM, MAX_ZOOM)
      : { focal: initialFocal, zoom: initialZoom };

  /* ---- VIDEO drag (object-position pan on the SectionPreview surface) ---- */
  const overflow = useCallback(
    (z: number, fitMode: FitMode) => {
      if (!natural) return { x: 0, y: 0 };
      const base =
        fitMode === "fit"
          ? Math.min(fw / natural.w, fh / natural.h)
          : Math.max(fw / natural.w, fh / natural.h);
      const rw = natural.w * base * z;
      const rh = natural.h * base * z;
      return { x: Math.max(0, rw - fw), y: Math.max(0, rh - fh) };
    },
    [natural, fw, fh],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!natural || loadError) return;
    const o = overflow(vCur.zoom, vCur.fit);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startFocal: { ...vCur.focal },
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
    const nx = d.overflowX > 0 ? clamp01(d.startFocal.x - dx / d.overflowX) : d.startFocal.x;
    const ny = d.overflowY > 0 ? clamp01(d.startFocal.y - dy / d.overflowY) : d.startFocal.y;
    setVFocal({ x: nx, y: ny });
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
    if (isVideo) setVFraming((v) => ({ ...v, [activeOrientation]: defaultVideoSource() }));
    else onReset();
  };

  const handleSave = () => {
    if (isVideo) {
      onSaveVideo?.({
        ...vFraming,
        [activeOrientation]: centerBarAxes(vFraming[activeOrientation], natural, fw, fh),
      });
    } else if (rcArea && natural) {
      const { focal, zoom } = areaToFocalZoom(rcArea, natural.w, natural.h, aspect, MIN_ZOOM, MAX_ZOOM);
      onSave(focal, zoom);
    } else {
      onSave(initialFocal, initialZoom);
    }
  };

  // Aspect-mismatch hint (video only): the shown clip vs the previewed canvas.
  const natAspect = natural && natural.h > 0 ? natural.w / natural.h : null;
  const mismatch =
    isVideo && natAspect !== null && Math.abs(natAspect - aspect) / aspect > ASPECT_MISMATCH;
  const hintKey =
    natAspect !== null && natAspect < aspect
      ? "admin.media.video.hintPortrait"
      : "admin.media.video.hintLandscape";

  const sourceLabelKey =
    activeOrientation === "portrait"
      ? "admin.media.video.framingViewportPortrait"
      : "admin.media.video.framingViewportLandscape";

  const zoomMin = isVideo && vCur.fit === "fit" ? FIT_MIN_ZOOM : MIN_ZOOM;
  const displayZoom = isVideo ? vCur.zoom : rcZoom;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) onCancel();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("admin.media.editor.title", { slot: slotLabel })}</DialogTitle>
          <DialogDescription>
            {isVideo ? t("admin.media.video.dragHint") : t("admin.media.editor.dragHint")}
          </DialogDescription>
        </DialogHeader>

        {heroVideoActive && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
            {t("admin.media.heroVideoNote")}
          </p>
        )}

        {isVideo && (
          <span data-qa="media-editor-source-label" className="text-xs font-medium text-accent">
            {t(sourceLabelKey)}
          </span>
        )}

        {/* Device tabs — each a scaled live preview of the actual section. */}
        <div data-qa="media-editor-devices" className="flex flex-wrap gap-2">
          {MEDIA_PREVIEW_DEVICES.map((d) => {
            const isActive = d.id === deviceId;
            const a = d.width / d.height;
            // VID.MODEL.1: one video across all tabs; each tab previews its own
            // viewport-orientation framing record of that single clip.
            const tabOrient: VideoOrientation = a < 1 ? "portrait" : "landscape";
            const tabSrc = isVideo ? videoSrc ?? undefined : undefined;
            const tabFraming = isVideo ? vFraming[tabOrient] : liveImageFraming;
            return (
              <button
                key={d.id}
                type="button"
                data-qa={`media-device-${d.id}`}
                onClick={() => setDeviceId(d.id)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-accent/60"
                }`}
              >
                <span
                  className="block overflow-hidden rounded-sm border border-border"
                  style={{ height: 40, width: 40 * a }}
                >
                  <SectionPreview
                    kind={kind}
                    reelIndex={reelIndex}
                    photo={photo}
                    focal={tabFraming.focal}
                    zoom={tabFraming.zoom}
                    fit={isVideo ? (tabFraming as { fit?: FitMode }).fit : undefined}
                    reelTitle={reelTitle}
                    aspect={a}
                    videoSrc={tabSrc}
                    poster={poster}
                  />
                </span>
                {d.label}
              </button>
            );
          })}
        </div>

        {/* Editing surface. */}
        <div ref={wrapRef} className="flex w-full justify-center">
          {loadError ? (
            <div
              className="flex items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 px-4 text-center text-sm text-destructive"
              style={{ width: fw, height: fh }}
            >
              {loadError}
            </div>
          ) : isVideo ? (
            <div
              data-qa="media-editor-surface"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onDragStart={(e) => e.preventDefault()}
              className="relative touch-none select-none cursor-grab overflow-hidden rounded-md active:cursor-grabbing"
              style={{ width: fw, height: fh }}
            >
              <SectionPreview
                kind={kind}
                reelIndex={reelIndex}
                photo={photo}
                focal={vCur.focal}
                zoom={vCur.zoom}
                fit={vCur.fit}
                reelTitle={reelTitle}
                aspect={aspect}
                videoSrc={displayedSrc}
                poster={poster}
              />
              <div className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-inset ring-[hsl(var(--gold-light))]/70" />
            </div>
          ) : (
            <div
              data-qa="media-editor-surface"
              className="relative overflow-hidden rounded-md"
              style={{ width: fw, height: fh, backgroundColor: "#0b0a08" }}
            >
              {imageSrc && natural && (
                <Cropper
                  image={imageSrc}
                  crop={rcCrop}
                  zoom={rcZoom}
                  aspect={aspect}
                  minZoom={MIN_ZOOM}
                  maxZoom={MAX_ZOOM}
                  zoomSpeed={0.25}
                  restrictPosition
                  showGrid={false}
                  objectFit="cover"
                  initialCroppedAreaPercentages={seedPct}
                  onCropChange={setRcCrop}
                  onZoomChange={setRcZoom}
                  onCropComplete={(_, areaPixels) => setRcArea(areaPixels)}
                  classes={{
                    containerClassName: "media-crop-container",
                    cropAreaClassName: "media-frame-overlay",
                    mediaClassName: "media-crop-media",
                  }}
                  style={{ cropAreaStyle: CROP_AREA_STYLE, mediaStyle: CROP_MEDIA_STYLE }}
                />
              )}
            </div>
          )}
        </div>

        {/* Aspect-mismatch hint (non-blocking, video only). */}
        {mismatch && (
          <p
            data-qa="media-editor-hint"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500"
          >
            {t(hintKey)}
          </p>
        )}

        {/* Fill / Fit display mode (video only). */}
        {isVideo && (
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">
              {t("admin.media.video.fitLabel")}
            </span>
            <div data-qa="media-editor-fit" className="flex gap-2">
              <button
                type="button"
                data-qa="media-editor-fit-fill"
                onClick={() => setFit("fill")}
                aria-pressed={vCur.fit === "fill"}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  vCur.fit === "fill"
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-accent/60"
                }`}
              >
                {t("admin.media.video.fitFill")}
              </button>
              <button
                type="button"
                data-qa="media-editor-fit-fit"
                onClick={() => setFit("fit")}
                aria-pressed={vCur.fit === "fit"}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  vCur.fit === "fit"
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-accent/60"
                }`}
              >
                {t("admin.media.video.fitFit")}
              </button>
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
            data-qa="media-editor-zoom"
            min={zoomMin}
            max={MAX_ZOOM}
            step={0.01}
            value={displayZoom}
            disabled={!!loadError}
            onChange={(e) => (isVideo ? setVZoom(parseFloat(e.target.value)) : setRcZoom(parseFloat(e.target.value)))}
            className="h-1.5 flex-1 accent-[hsl(var(--gold-light))]"
          />
          <span
            data-qa="media-editor-zoom-value"
            className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
          >
            {displayZoom.toFixed(2)}×
          </span>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={resetActive}
            disabled={saving}
            data-qa="media-editor-reset"
            className="text-muted-foreground hover:text-foreground"
          >
            {t("admin.media.editor.reset")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={saving} data-qa="media-editor-cancel">
              {t("admin.media.editor.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || (!isVideo && (!natural || !rcArea)) || !!loadError}
              data-qa="media-editor-save"
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

export default FramingEditor;

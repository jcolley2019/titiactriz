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
import SectionPreview from "./SectionPreview";
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
} from "@/hooks/useCinematicMedia";
import type { CinematicPhoto } from "@/components/cinematic/useCinematicData";

/**
 * ADMIN.MEDIA.1 → .3 — framing editor.
 *
 * Non-destructive: pointer drag + a zoom slider write focal x/y + zoom (+ a
 * per-source fill/fit mode for video) — never a cropped file. The drag surface
 * renders the exact SectionPreview (same FramedImage/FramedVideo as the live
 * site) at the selected device's aspect, so what you drag is what publishes.
 *
 * VIDEO mode (ADMIN.MEDIA.3) frames TWO orientation sources. The active device
 * tab implies the source: a portrait-aspect canvas (phone) edits the portrait
 * source, a landscape-aspect canvas (desktop/tablet) edits the landscape source;
 * if that orientation has no dedicated clip the other source is shown as a stand-
 * in. Each source keeps its own focal/zoom/fit. "Fit" letterboxes at the natural
 * aspect over a blurred backdrop and unlocks sub-cover zoom. A non-blocking hint
 * warns when the shown clip's aspect fights the previewed canvas by >25%.
 */
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
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
  /** ADMIN.MEDIA.2 — "video" frames the hero background video, not the image. */
  mode?: "image" | "video";
  /** Video sources per orientation (video mode). */
  videoLandscapeSrc?: string | null;
  videoPortraitSrc?: string | null;
  /** Initial per-source video framing (video mode). */
  initialVideo?: HeroVideoFraming;
  /** Poster image for the video preview (the current hero image). */
  poster?: string;
  onSave: (focal: Focal, zoom: number) => void;
  /** Persist per-source video framing (video mode). */
  onSaveVideo?: (framing: HeroVideoFraming) => void;
  onReset: () => void;
  onCancel: () => void;
};

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
  videoLandscapeSrc,
  videoPortraitSrc,
  initialVideo,
  poster,
  onSave,
  onSaveVideo,
  onReset,
  onCancel,
}: Props) => {
  const { t } = useTranslation();
  const isVideo = mode === "video";

  // --- Framing state: single (image) vs per-orientation (video). ---
  const [imgFocal, setImgFocal] = useState<Focal>(initialFocal);
  const [imgZoom, setImgZoom] = useState(initialZoom);
  const [vFraming, setVFraming] = useState<HeroVideoFraming>(initialVideo ?? defaultHeroVideo());

  const [deviceId, setDeviceId] = useState(MEDIA_PREVIEW_DEVICES[0].id);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [availW, setAvailW] = useState(480);
  const dragRef = useRef<
    | { startX: number; startY: number; startFocal: Focal; overflowX: number; overflowY: number }
    | null
  >(null);

  const aspect = devicePreviewAspect(deviceId);

  // Which orientation the active tab implies, and which source is actually shown
  // (falling back to the other orientation's clip, mirroring the render).
  const sources: Record<VideoOrientation, string | null | undefined> = {
    landscape: videoLandscapeSrc,
    portrait: videoPortraitSrc,
  };
  const tabTarget: VideoOrientation = aspect < 1 ? "portrait" : "landscape";
  const other: VideoOrientation = tabTarget === "portrait" ? "landscape" : "portrait";
  const activeOrientation: VideoOrientation = sources[tabTarget] ? tabTarget : sources[other] ? other : tabTarget;
  const displayedSrc = isVideo ? sources[activeOrientation] ?? undefined : undefined;

  const mediaSrc = isVideo ? displayedSrc : photo?.image_url;

  // Current framing being edited (derived), plus routed setters.
  const cur = isVideo
    ? vFraming[activeOrientation]
    : { focal: imgFocal, zoom: imgZoom, fit: "fill" as FitMode };
  const focal = cur.focal;
  const zoom = cur.zoom;
  const fit: FitMode = cur.fit;

  const setFocal = (f: Focal) => {
    if (isVideo) setVFraming((v) => ({ ...v, [activeOrientation]: { ...v[activeOrientation], focal: f } }));
    else setImgFocal(f);
  };
  const setZoom = (z: number) => {
    if (isVideo) setVFraming((v) => ({ ...v, [activeOrientation]: { ...v[activeOrientation], zoom: z } }));
    else setImgZoom(z);
  };
  const setFit = (nextFit: FitMode) =>
    setVFraming((v) => {
      const src = v[activeOrientation];
      return {
        ...v,
        [activeOrientation]: { ...src, fit: nextFit, zoom: clampSourceZoom(src.zoom, nextFit) },
      };
    });

  const zoomMin = isVideo && fit === "fit" ? FIT_MIN_ZOOM : MIN_ZOOM;

  // Reset framing state each time the dialog opens fresh.
  useEffect(() => {
    if (!open) return;
    setImgFocal(initialFocal);
    setImgZoom(initialZoom);
    setVFraming(initialVideo ?? defaultHeroVideo());
    setDeviceId(MEDIA_PREVIEW_DEVICES[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Measure the shown media's intrinsic size whenever it changes (tab switch in
  // video mode swaps the source). Framing state is preserved across the switch.
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
  }, [open, mediaSrc, isVideo]);

  // Measure the available width so the surface stays inside the dialog on any viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvailW(el.clientWidth));
    ro.observe(el);
    setAvailW(el.clientWidth);
    return () => ro.disconnect();
  }, [open]);

  // Surface dimensions: fill the available width, capped in height (WYSIWYG frame).
  let fw = availW;
  let fh = fw / aspect;
  if (fh > SURFACE_MAX_H) {
    fh = SURFACE_MAX_H;
    fw = fh * aspect;
  }

  const overflow = useCallback(
    (z: number) => {
      if (!natural) return { x: 0, y: 0 };
      const coverScale = Math.max(fw / natural.w, fh / natural.h);
      const rw = natural.w * coverScale * z;
      const rh = natural.h * coverScale * z;
      return { x: Math.max(0, rw - fw), y: Math.max(0, rh - fh) };
    },
    [natural, fw, fh],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!natural || loadError) return;
    const o = overflow(zoom);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startFocal: { ...focal },
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
    // Media follows the finger: dragging right reveals the left, i.e. focal
    // decreases. Axes with no overflow can't pan.
    const nx = d.overflowX > 0 ? clamp01(d.startFocal.x - dx / d.overflowX) : d.startFocal.x;
    const ny = d.overflowY > 0 ? clamp01(d.startFocal.y - dy / d.overflowY) : d.startFocal.y;
    setFocal({ x: nx, y: ny });
  };

  const endDrag = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer may already be released */
    }
  };

  const resetActive = () => {
    if (isVideo) setVFraming((v) => ({ ...v, [activeOrientation]: defaultVideoSource() }));
    else onReset();
  };

  const handleSave = () => {
    if (isVideo) onSaveVideo?.(vFraming);
    else onSave(imgFocal, imgZoom);
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
      ? "admin.media.video.framingPortrait"
      : "admin.media.video.framingLandscape";

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
            const tabOrient: VideoOrientation = a < 1 ? "portrait" : "landscape";
            const tabSrc = isVideo ? (sources[tabOrient] ?? sources[tabOrient === "portrait" ? "landscape" : "portrait"] ?? undefined) : undefined;
            const tabFraming = isVideo ? vFraming[sources[tabOrient] ? tabOrient : tabOrient === "portrait" ? "landscape" : "portrait"] : cur;
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
                    fit={tabFraming.fit}
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

        {/* Drag surface at the selected device's aspect. */}
        <div ref={wrapRef} className="flex w-full justify-center">
          {loadError ? (
            <div
              className="flex items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 px-4 text-center text-sm text-destructive"
              style={{ width: fw, height: fh }}
            >
              {loadError}
            </div>
          ) : (
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
                focal={focal}
                zoom={zoom}
                fit={fit}
                reelTitle={reelTitle}
                aspect={aspect}
                videoSrc={displayedSrc}
                poster={poster}
              />
              <div className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-inset ring-[hsl(var(--gold-light))]/70" />
            </div>
          )}
        </div>

        {/* Aspect-mismatch hint (non-blocking). */}
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
                aria-pressed={fit === "fill"}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  fit === "fill"
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
                aria-pressed={fit === "fit"}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  fit === "fit"
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
            value={zoom}
            disabled={!!loadError}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="h-1.5 flex-1 accent-[hsl(var(--gold-light))]"
          />
          <span
            data-qa="media-editor-zoom-value"
            className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
          >
            {zoom.toFixed(2)}×
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
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={saving}
              data-qa="media-editor-cancel"
            >
              {t("admin.media.editor.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || (!isVideo && !natural) || !!loadError}
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

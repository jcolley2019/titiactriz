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
import { MIN_ZOOM, MAX_ZOOM, type Focal } from "@/hooks/useCinematicMedia";
import type { CinematicPhoto } from "@/components/cinematic/useCinematicData";

/**
 * ADMIN.MEDIA.1 (ITEM 3) + ADMIN.MEDIA.2 (ITEM 3) — framing editor.
 *
 * Non-destructive: pointer/touch drag + a zoom slider write focal x/y + zoom
 * only — never a cropped file. The drag surface renders the exact SectionPreview
 * (same FramedImage/FramedVideo as the live site) at the selected device's
 * aspect, so what you drag is what publishes. object-cover + zoom >= 1 make gaps
 * structurally impossible (the ported min-zoom-to-cover guarantee), so the only
 * clamp needed is focal ∈ [0,1]. Device tabs re-aspect the surface + show live
 * thumbnails. In VIDEO mode the same shell drives a muted looping <video> and
 * the intrinsic size comes from the video's metadata instead of an image decode.
 */
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

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
  /** The video source to frame (video mode). */
  videoSrc?: string;
  /** Poster image for the video preview (the current hero image). */
  poster?: string;
  onSave: (focal: Focal, zoom: number) => void;
  onReset: () => void;
  onCancel: () => void;
};

const SURFACE_MAX_H = 360;

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
  poster,
  onSave,
  onReset,
  onCancel,
}: Props) => {
  const { t } = useTranslation();
  const isVideo = mode === "video";
  const mediaSrc = isVideo ? videoSrc : photo?.image_url;
  const [focal, setFocal] = useState<Focal>(initialFocal);
  const [zoom, setZoom] = useState(initialZoom);
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

  // Reset all editor state whenever a fresh slot/media opens, then measure the
  // intrinsic size (image decode, or the video's metadata) for the clamp math.
  useEffect(() => {
    if (!open) return;
    setFocal(initialFocal);
    setZoom(initialZoom);
    setDeviceId(MEDIA_PREVIEW_DEVICES[0].id);
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
    // Image follows the finger: dragging right reveals the left of the image,
    // i.e. object-position (focal) decreases. Axes with no overflow can't pan.
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

        {/* Device tabs — each a scaled live preview of the actual section. */}
        <div data-qa="media-editor-devices" className="flex flex-wrap gap-2">
          {MEDIA_PREVIEW_DEVICES.map((d) => {
            const isActive = d.id === deviceId;
            const a = d.width / d.height;
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
                    focal={focal}
                    zoom={zoom}
                    reelTitle={reelTitle}
                    aspect={a}
                    videoSrc={isVideo ? videoSrc : undefined}
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
                reelTitle={reelTitle}
                aspect={aspect}
                videoSrc={isVideo ? videoSrc : undefined}
                poster={poster}
              />
              <div className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-inset ring-[hsl(var(--gold-light))]/70" />
            </div>
          )}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-xs text-muted-foreground">
            {t("admin.media.editor.zoom")}
          </span>
          <input
            type="range"
            data-qa="media-editor-zoom"
            min={MIN_ZOOM}
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
            onClick={onReset}
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
              onClick={() => onSave(focal, zoom)}
              disabled={saving || !natural || !!loadError}
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

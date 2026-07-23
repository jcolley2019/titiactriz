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
import { resolveHeroGeometry } from "@/lib/hero-framing";
import { decodeImage, cropErrorCauseKey } from "@/lib/crop";
import { probeVideoSize } from "@/lib/hero-video";
import { MEDIA_PREVIEW_DEVICES, devicePreviewAspect } from "@/lib/device-presets";
import {
  MIN_ZOOM,
  MAX_ZOOM,
  FIT_MIN_ZOOM,
  ABOUT_PANEL_ASPECT,
  clampSourceZoom,
  defaultHeroVideo,
  defaultVideoSource,
  framingFromFocalZoom,
  type Focal,
  type FitMode,
  type HeroVideoFraming,
  type VideoOrientation,
} from "@/hooks/useCinematicMedia";
import type { CinematicPhoto } from "@/components/cinematic/useCinematicData";

/**
 * PORT.2 — framing editor; BOTH modes edit on the resolver drag surface.
 *
 * IMAGE mode (all four slots) renders the CONTROLLED focal/zoom live through the
 * same SectionPreview → FramedImage pipeline the site uses, at the active device
 * tab's aspect — what the canvas shows IS what publishes, by construction. Drag
 * pans the focal across the real overflow reported by `resolveHeroGeometry`;
 * Save writes focal/zoom exactly as edited, no conversion layer. The slot kind
 * fixes the display mode: reel slides edit in fit (whole photo, dark edges),
 * the hero in fill.
 *
 * VIDEO mode (hero) edits the same way since PORT.3: drag pans across the
 * resolver's real overflow, extended to dual orientation sources, fill/fit,
 * and the mismatch hint. An axis without overflow (letterbox bars) is
 * self-centred by the resolver's geometry, so no snap logic exists here — a
 * saved focal on a bar axis is simply ignored by the render.
 *
 * ABOUT.MEDIA.1 — the "about" kind is fixed 3:4 EVERYWHERE, so it edits on a
 * single canvas at ABOUT_PANEL_ASPECT with no device tabs (one aspect IS the
 * contract). Fill mode, same resolver drag + zoom; Save writes focal/zoom.
 */
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const SURFACE_MAX_H = 360;
const ASPECT_MISMATCH = 0.25;

type Props = {
  open: boolean;
  slotLabel: string;
  kind: "hero" | "reel" | "about";
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
  // ABOUT.MEDIA.1 — the About panel is a fixed 3:4 frame with no device tabs, so
  // its canvas aspect is the constant, never the active device preset.
  const isAbout = kind === "about";
  const aspect = isAbout ? ABOUT_PANEL_ASPECT : devicePreviewAspect(deviceId);

  /* ---------------- IMAGE mode (resolver drag surface) ---------------- */
  const imageSrc = !isVideo ? photo?.image_url : undefined;
  // PORT.2: the slot kind fixes the image display mode — reel slides render the
  // whole photo (fit), the hero covers (fill). No toggle.
  const imageFit: FitMode = kind === "reel" ? "fit" : "fill";
  const [iFocal, setIFocal] = useState<Focal>(initialFocal);
  const [iZoom, setIZoom] = useState(initialZoom);

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
    setVFraming((v) => ({ ...v, [activeOrientation]: { ...v[activeOrientation], zoom: z } }));
  const setFit = (nextFit: FitMode) =>
    setVFraming((v) => {
      const src = v[activeOrientation];
      return {
        ...v,
        [activeOrientation]: { ...src, fit: nextFit, zoom: clampSourceZoom(src.zoom, nextFit) },
      };
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
    setIFocal({ ...initialFocal });
    setIZoom(clampSourceZoom(initialZoom, imageFit));
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

  // Controlled image framing — drives the drag surface AND the device thumbnails.
  const liveImageFraming = { focal: iFocal, zoom: iZoom };

  /* ---- Drag: pan the focal across the REAL overflow of the active surface ---- */
  // Overflow comes from the resolver itself — the same geometry the canvas
  // paints, image AND video since PORT.3 — so drag distance maps 1:1 to what
  // the user sees.
  const surfaceOverflow = useCallback(
    (focal: Focal, z: number, fitMode: FitMode) => {
      if (!natural || natural.w <= 0 || natural.h <= 0) return { x: 0, y: 0 };
      const geo = resolveHeroGeometry(
        natural.w / natural.h,
        aspect,
        framingFromFocalZoom(focal, z, fitMode),
      );
      if (!geo) return { x: 0, y: 0 };
      return {
        x: (Math.max(0, geo.widthPct - 100) / 100) * fw,
        y: (Math.max(0, geo.heightPct - 100) / 100) * fh,
      };
    },
    [natural, aspect, fw, fh],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!natural || loadError) return;
    const o = isVideo
      ? surfaceOverflow(vCur.focal, vCur.zoom, vCur.fit)
      : surfaceOverflow(iFocal, iZoom, imageFit);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startFocal: isVideo ? { ...vCur.focal } : { ...iFocal },
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
    (isVideo ? setVFocal : setIFocal)({ x: nx, y: ny });
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
      onSaveVideo?.(vFraming);
    } else {
      // PORT.2: the edited focal/zoom persist EXACTLY — no conversion layer.
      onSave(iFocal, iZoom);
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

  const activeFit: FitMode = isVideo ? vCur.fit : imageFit;
  const zoomMin = activeFit === "fit" ? FIT_MIN_ZOOM : MIN_ZOOM;
  const displayZoom = isVideo ? vCur.zoom : iZoom;

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

        {/* Device tabs — each a scaled live preview of the actual section. Hidden
            for the About panel, which is one fixed 3:4 canvas (no per-device aspect). */}
        {!isAbout && (
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
                {/* box-content: the border must not shrink the preview box, or the
                    thumbnail's aspect drifts off the device aspect (PORT.2 law). */}
                <span
                  className="box-content block overflow-hidden rounded-sm border border-border"
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
        )}

        {/* Editing surface. */}
        <div ref={wrapRef} className="flex w-full justify-center">
          {loadError ? (
            <div
              className="flex items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 px-4 text-center text-sm text-destructive"
              style={{ width: fw, height: fh }}
            >
              {loadError}
            </div>
          ) : (
            // ONE drag surface for both modes — the live SectionPreview at the
            // active tab's aspect, rendering the controlled framing state.
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
                focal={isVideo ? vCur.focal : iFocal}
                zoom={isVideo ? vCur.zoom : iZoom}
                fit={isVideo ? vCur.fit : undefined}
                reelTitle={reelTitle}
                aspect={aspect}
                videoSrc={displayedSrc}
                poster={poster}
              />
              <div className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-inset ring-[hsl(var(--gold-light))]/70" />
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
            onChange={(e) =>
              isVideo
                ? setVZoom(parseFloat(e.target.value))
                : setIZoom(clampSourceZoom(parseFloat(e.target.value), imageFit))
            }
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

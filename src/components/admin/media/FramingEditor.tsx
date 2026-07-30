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
import { previewMediaFrame, type PreviewFrame } from "./previewFrame";
import { resolveHeroGeometry } from "@/lib/hero-framing";
import { decodeImage, cropErrorCauseKey } from "@/lib/crop";
import { RECOMMENDED_SOURCE_WIDTH } from "@/lib/gallery-upload";
import { probeVideoSize } from "@/lib/hero-video";
import { MEDIA_PREVIEW_DEVICES, devicePreviewAspect, resolveDevicePreset } from "@/lib/device-presets";
import {
  MIN_ZOOM,
  MAX_ZOOM,
  FIT_MIN_ZOOM,
  DEFAULT_ZOOM,
  ABOUT_PANEL_ASPECT,
  ABOUT_DEFAULT_FOCAL,
  HERO_DEFAULT_FOCAL,
  clampSourceZoom,
  REEL_DEFAULT_FOCAL,
  defaultHeroVideo,
  defaultVideoSource,
  framingFromFocalZoom,
  plateAspectOf,
  type Focal,
  type FitMode,
  type HeroVideoFraming,
  type VideoOrientation,
  type DeviceClass,
  type ClassFraming,
  type ClassFramingPair,
  type PlateAspect,
} from "@/hooks/useCinematicMedia";
import { reelIsPhoneWidth } from "@/components/cinematic/reelSpotlight";
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
 * ABOUT.MEDIA.1 — the "about" kind is fixed 3:4 EVERYWHERE, so its canvas is
 * always ABOUT_PANEL_ASPECT (one aspect IS the contract). Fill mode, same
 * resolver drag + zoom.
 *
 * ADMIN.RESET.1b — the About panel is otherwise at FULL REEL PARITY: the same
 * device tab row, the same per-class records, the same Reset. What the tabs
 * change for About is the RECORD, never the shape — all three draw the same 3:4
 * canvas, because that is what the live panel is on all three devices. Save
 * writes both class records through the same resolver contract as the reel.
 *
 * ADMIN.ASPECT.1 — a REEL slide's WIDE record also carries the SHAPE of the plate
 * it hangs in, and the wide tabs get a Portrait / Landscape toggle for it. The
 * whole of the geometry consequence is one argument to `previewMediaFrame`: the
 * canvas re-frames to the chosen plate box and the drag, the zoom floor, the pan
 * clamps and Reset all keep operating against "the box the media paints into"
 * (ADMIN.RESET.1c) without a branch of their own. The phone tab is untouched — the
 * phone act is edge-to-edge and hangs no plate — and so is the About panel.
 *
 * ADMIN.RESET.1a — RESET IS A TRANSFORM CONTROL, NOT AN EXIT.
 *
 * Reset restores the ACTIVE TAB's transform to the default for the loaded media
 * (zoom 1, the kind's default focal) and does nothing else: it stays open on the
 * same slot and the same tab, leaves every other tab's record alone, and writes
 * NOTHING — the value only reaches Supabase when the owner presses Save. It used
 * to delegate to the owner's `onReset`, which closed the dialog and persisted a
 * whole-slot wipe, so the control read as "discard this slot" and behaved like a
 * back button. Cancel is the exit-without-saving control; Reset is not.
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
  /**
   * FRAME.SPLIT.1 / ADMIN.RESET.1b — class-split slots (reel, about): the two
   * device-class records to edit. When omitted (or for a slot stored before the
   * split) both classes seed from initialFocal/initialZoom, which is the same
   * seeding law the resolver applies.
   */
  initialClasses?: ClassFramingPair;
  heroVideoActive?: boolean;
  saving?: boolean;
  mode?: "image" | "video";
  videoSrc?: string | null;
  initialVideo?: HeroVideoFraming;
  poster?: string;
  onSave: (focal: Focal, zoom: number) => void;
  /** Class-split slots save BOTH class records, edited or not. */
  onSaveClasses?: (classes: ClassFramingPair) => void;
  onSaveVideo?: (framing: HeroVideoFraming) => void;
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
  initialClasses,
  heroVideoActive,
  saving,
  mode = "image",
  videoSrc,
  initialVideo,
  poster,
  onSave,
  onSaveClasses,
  onSaveVideo,
  onCancel,
}: Props) => {
  const { t } = useTranslation();
  const isVideo = mode === "video";

  const [deviceId, setDeviceId] = useState(MEDIA_PREVIEW_DEVICES[0].id);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // ABOUT.MEDIA.1 — the About panel is a fixed 3:4 frame on every screen, so its
  // canvas aspect is the constant, never the active device preset.
  // ADMIN.RESET.1b — it DOES get the device tabs now, but they select a class
  // record, not a shape: every About tab draws this same 3:4 canvas.
  const isAbout = kind === "about";
  const aspect = isAbout ? ABOUT_PANEL_ASPECT : devicePreviewAspect(deviceId);

  /* ---------------- IMAGE mode (resolver drag surface) ---------------- */
  const imageSrc = !isVideo ? photo?.image_url : undefined;
  // PORT.2: the slot kind fixes the image display mode — reel slides render the
  // whole photo (fit), the hero covers (fill). No toggle.
  const imageFit: FitMode = kind === "reel" ? "fit" : "fill";
  const [iFocal, setIFocal] = useState<Focal>(initialFocal);
  const [iZoom, setIZoom] = useState(initialZoom);

  /* ------- FRAME.SPLIT.1 / ADMIN.RESET.1b (one record per device class) ------- */
  const isReel = kind === "reel";
  // Which kinds are class-split. The reel named the split; the About panel joined
  // it on identical terms, so both take the two-record path below and the hero is
  // the only single-record image slot left.
  const usesClasses = isReel || isAbout;
  // The kind's default framing anchor — what Reset restores this tab to.
  const kindDefaultFocal: Focal = isAbout
    ? ABOUT_DEFAULT_FOCAL
    : isReel
      ? REEL_DEFAULT_FOCAL
      : HERO_DEFAULT_FOCAL;
  // The seeding law, mirrored from the resolver: with no stored class records,
  // BOTH classes start from the slot's single record, so opening the editor on a
  // pre-split slot shows exactly what the site is rendering today.
  const seedClasses = (): ClassFramingPair =>
    initialClasses
      ? { phone: { ...initialClasses.phone }, wide: { ...initialClasses.wide } }
      : {
          phone: { focal: { ...initialFocal }, zoom: initialZoom },
          wide: { focal: { ...initialFocal }, zoom: initialZoom },
        };
  const [rFraming, setRFraming] = useState<ClassFramingPair>(seedClasses);
  // Class membership is WIDTH-derived, never tab identity: a preset under 768
  // edits "phone", one at or above it edits "wide". Today that puts iPhone on
  // phone and iPad + Desktop on wide — two tabs previewing ONE record, each at
  // its own geometry — and a new tab lands in the right class by its width
  // alone. The line is the same one the live surfaces split on.
  const classOfWidth = (w: number): DeviceClass => (reelIsPhoneWidth(w) ? "phone" : "wide");
  const activeClass = classOfWidth(resolveDevicePreset(deviceId).width);
  const rCur = rFraming[activeClass];

  const setRFocal = (f: Focal) =>
    setRFraming((v) => ({ ...v, [activeClass]: { ...v[activeClass], focal: f } }));
  const setRZoom = (z: number) =>
    setRFraming((v) => ({ ...v, [activeClass]: { ...v[activeClass], zoom: z } }));

  /* -------------------- ADMIN.ASPECT.1 (the plate's shape) -------------------- */
  // A WIDE REEL record's own field: which plate the slide hangs in on the
  // desktop/tablet composition. The phone act is edge-to-edge and hangs no plate,
  // and the About panel is 3:4 everywhere, so neither offers the control.
  const platePref: PlateAspect = plateAspectOf(rFraming.wide);
  const showAspect = isReel && !isVideo && activeClass === "wide";
  // Portrait is stored as the ABSENCE of the field, never as `plate: "portrait"`:
  // that is what keeps a portrait slide's saved JSON byte-identical to today's,
  // and it makes "flip to landscape and back" a true round trip.
  const withPlate = (rec: ClassFraming, plate: PlateAspect): ClassFraming => {
    const { plate: _drop, ...rest } = rec;
    return plate === "landscape" ? { ...rest, plate } : rest;
  };
  const setPlate = (plate: PlateAspect) =>
    setRFraming((v) => ({ ...v, wide: withPlate(v.wide, plate) }));

  // The image record actually being shown and dragged. For a class-split slot
  // that is the active class's record; the hero keeps its single record.
  const curFocal = usesClasses ? rCur.focal : iFocal;
  const curZoom = usesClasses ? rCur.zoom : iZoom;
  const setCurFocal = usesClasses ? setRFocal : setIFocal;
  const setCurZoom = usesClasses ? setRZoom : setIZoom;

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
    setRFraming(seedClasses());
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

  // ADMIN.MOBILE.1: never trust availW beyond the real viewport — the 480
  // default could force the dialog wider than a phone screen, and the
  // measurer would then read the overflowed container back (stuck loop).
  const viewportCap =
    typeof window !== "undefined" ? Math.max(240, window.innerWidth - 80) : 480;
  let fw = Math.min(availW, viewportCap);
  let fh = fw / aspect;
  if (fh > SURFACE_MAX_H) {
    fh = SURFACE_MAX_H;
    fw = fh * aspect;
  }

  // Controlled image framing — drives the drag surface. FRAME.SPLIT.1: the reel
  // thumbnails do NOT use this, since each tab previews its own class record.
  const liveImageFraming = { focal: curFocal, zoom: curZoom };

  /* ---- Drag: pan the focal across the REAL overflow of the active surface ---- */
  // Overflow comes from the resolver itself — the same geometry the canvas
  // paints, image AND video since PORT.3 — so drag distance maps 1:1 to what
  // the user sees.
  //
  // ADMIN.RESET.1c — measured against the box the media ACTUALLY paints into,
  // not the device-shaped surface. BOTH axes are the zoomed rendered size versus
  // that box, so slack anywhere is reachable (including diagonally) and an axis
  // is dead only where the frame would stop being covered. Passing the surface
  // aspect and the editor's notional `imageFit` here is what froze horizontal
  // pan on the wide reel tabs — see previewFrame.ts for the arithmetic.
  const surfaceOverflow = useCallback(
    (focal: Focal, z: number, videoFit: FitMode) => {
      if (!natural || natural.w <= 0 || natural.h <= 0) return { x: 0, y: 0 };
      // Video paints the full surface in its record's own fit; an image paints
      // whatever previewMediaFrame says its composition crops to, always cover.
      const frame: PreviewFrame = isVideo
        ? { w: fw, h: fh, aspect, fit: videoFit }
        : // ADMIN.ASPECT.1 — the plate's shape is part of "the box the media
          // actually paints into", so it belongs in this one call and nowhere
          // else: switching to landscape re-frames the drag with no branch here.
          previewMediaFrame(kind, resolveDevicePreset(deviceId).width, fw, fh, platePref);
      const geo = resolveHeroGeometry(
        natural.w / natural.h,
        frame.aspect,
        framingFromFocalZoom(focal, z, frame.fit),
      );
      if (!geo) return { x: 0, y: 0 };
      return {
        x: (Math.max(0, geo.widthPct - 100) / 100) * frame.w,
        y: (Math.max(0, geo.heightPct - 100) / 100) * frame.h,
      };
    },
    [natural, aspect, fw, fh, isVideo, kind, deviceId, platePref],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!natural || loadError) return;
    // Pointer events, so mouse / touch / pen all arrive here on identical terms
    // — touch drag is the same computation, not a parallel path.
    const o = isVideo
      ? surfaceOverflow(vCur.focal, vCur.zoom, vCur.fit)
      : surfaceOverflow(curFocal, curZoom, imageFit);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startFocal: isVideo ? { ...vCur.focal } : { ...curFocal },
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
    (isVideo ? setVFocal : setCurFocal)({ x: nx, y: ny });
  };
  const endDrag = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  /**
   * ADMIN.RESET.1a — reset THIS tab's transform to the loaded media's default.
   *
   * Local state only, one record only: the video path resets the active
   * orientation, a class-split path the active device class, and a single-record
   * slot its own focal/zoom. No navigation, no close, no write — the editor stays
   * on the slot and tab it was on, and Save is still what publishes.
   *
   * ADMIN.ASPECT.1 — Reset restores the TRANSFORM, and the plate's shape is not
   * one: it is a composition choice, like which photo is in the slot. So a reset
   * recentres and unzooms INSIDE the chosen plate and leaves the plate standing —
   * the same reason Reset does not clear the photo.
   */
  const resetActive = () => {
    if (isVideo) {
      setVFraming((v) => ({ ...v, [activeOrientation]: defaultVideoSource() }));
    } else if (usesClasses) {
      setRFraming((v) => ({
        ...v,
        [activeClass]: withPlate(
          { focal: { ...kindDefaultFocal }, zoom: DEFAULT_ZOOM },
          plateAspectOf(v[activeClass]),
        ),
      }));
    } else {
      setIFocal({ ...kindDefaultFocal });
      setIZoom(DEFAULT_ZOOM);
    }
    toast({ title: t("admin.media.editor.resetDone") });
  };

  const handleSave = () => {
    if (isVideo) {
      onSaveVideo?.(vFraming);
    } else if (usesClasses) {
      // FRAME.SPLIT.1: both records go up, but only the class the owner touched
      // differs from what came in — the untouched class is handed back exactly
      // as it was read, so saving one class cannot rewrite the other's values.
      onSaveClasses?.(rFraming);
    } else {
      // PORT.2: the edited focal/zoom persist EXACTLY — no conversion layer.
      onSave(iFocal, iZoom);
    }
  };

  /**
   * MEDIA.RES.0 — soft low-resolution notice. Read straight off the image the
   * editor already decoded for its drag math, so nothing new is measured,
   * nothing is stored, and nothing reaches Supabase. Advisory only: the photo
   * stays selected, the editor stays usable, and Save is never disabled.
   */
  const lowRes = !isVideo && natural !== null && natural.w > 0 && natural.w < RECOMMENDED_SOURCE_WIDTH;

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
  const displayZoom = isVideo ? vCur.zoom : curZoom;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) onCancel();
      }}
    >
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admin.media.editor.title", { slot: slotLabel })}</DialogTitle>
          <DialogDescription>
            {isVideo
              ? t("admin.media.video.dragHint")
              : // MEDIA.RES.0 — the drag hint carries a short pointer at the same
                // source guidance the picker states in full. Photos only: a video's
                // hint has nothing to do with still-image resolution.
                `${t("admin.media.editor.dragHint")} ${t("admin.media.editor.sourceNote")}`}
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

        {lowRes && (
          <p
            data-qa="media-editor-lowres"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500"
          >
            {t("admin.media.editor.lowRes", { w: natural!.w })}
          </p>
        )}

        {/* Device tabs — each a scaled live preview of the actual section.
            ADMIN.RESET.1b: the About panel gets the same tab row as every other
            slot. Its thumbnails render at ABOUT_PANEL_ASPECT rather than the
            device aspect, because the live panel IS 3:4 on all three devices —
            a device-shaped About thumbnail would be a lie about the section. */}
        <div data-qa="media-editor-devices" className="flex flex-wrap gap-2">
          {MEDIA_PREVIEW_DEVICES.map((d) => {
            const isActive = d.id === deviceId;
            // The thumbnail's own aspect: the section's shape on that device.
            const a = isAbout ? ABOUT_PANEL_ASPECT : d.width / d.height;
            // VID.MODEL.1: one video across all tabs; each tab previews its own
            // viewport-orientation framing record of that single clip. Keyed off
            // the DEVICE aspect, which is the viewport's, not the thumbnail's.
            const tabOrient: VideoOrientation = d.width / d.height < 1 ? "portrait" : "landscape";
            const tabSrc = isVideo ? videoSrc ?? undefined : undefined;
            // FRAME.SPLIT.1: a class-split thumbnail previews the record for ITS
            // OWN device class, so the phone tabs and the wide tabs visibly
            // diverge the moment one class is edited.
            const tabFraming = isVideo
              ? vFraming[tabOrient]
              : usesClasses
                ? rFraming[classOfWidth(d.width)]
                : liveImageFraming;
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
                    deviceWidth={d.width}
                    videoSrc={tabSrc}
                    poster={poster}
                    // ADMIN.ASPECT.1 — each thumbnail draws the plate of the
                    // record IT previews. The wide tabs share one record, so
                    // both re-shape together the moment the toggle moves; the
                    // phone tab has no plate in its record and no plate in its
                    // composition, so it is untouched either way.
                    plate={plateAspectOf(tabFraming)}
                  />
                </span>
                {d.label}
              </button>
            );
          })}
        </div>

        {/* Editing surface. */}
        <div ref={wrapRef} className="flex w-full min-w-0 justify-center">
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
                focal={isVideo ? vCur.focal : curFocal}
                zoom={isVideo ? vCur.zoom : curZoom}
                fit={isVideo ? vCur.fit : undefined}
                reelTitle={reelTitle}
                aspect={aspect}
                deviceWidth={resolveDevicePreset(deviceId).width}
                videoSrc={displayedSrc}
                poster={poster}
                // ADMIN.ASPECT.1 — the drag surface IS the chosen plate, which is
                // what makes the pan slack the editor offers the live plate's own.
                plate={platePref}
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

        {/* ADMIN.ASPECT.1 — the wide plate's SHAPE. Same control grammar as the
            video Fill/Fit pair (two aria-pressed buttons, accent when active), on
            the wide reel tabs only: iPad and Desktop both render the wide act and
            both edit its one record, so the choice is offered wherever that record
            is being edited — exactly like the zoom slider above them. The iPhone
            tab never shows it, because the phone act hangs no plate. */}
        {showAspect && (
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">
              {t("admin.media.editor.aspectLabel")}
            </span>
            <div data-qa="media-editor-aspect" className="flex gap-2">
              {(["portrait", "landscape"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  data-qa={`media-editor-aspect-${p}`}
                  onClick={() => setPlate(p)}
                  aria-pressed={platePref === p}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    platePref === p
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-accent/60"
                  }`}
                >
                  {t(
                    p === "portrait"
                      ? "admin.media.editor.aspectPortrait"
                      : "admin.media.editor.aspectLandscape",
                  )}
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
            data-qa="media-editor-zoom"
            min={zoomMin}
            max={MAX_ZOOM}
            step={0.01}
            value={displayZoom}
            disabled={!!loadError}
            onChange={(e) =>
              isVideo
                ? setVZoom(parseFloat(e.target.value))
                : setCurZoom(clampSourceZoom(parseFloat(e.target.value), imageFit))
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

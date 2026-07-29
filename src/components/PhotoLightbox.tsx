import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  heroFramingAttr,
  imageAspect,
  resolveHeroGeometry,
  useElementAspect,
} from "@/lib/hero-framing";

/**
 * GALLERY.TOUCH.1 — the shared gallery lightbox, in the site's language: the
 * near-black ground at high opacity, the photo letterboxed as a bounded PLATE
 * inside a fine gold hairline (the w2 plate-frame vocabulary), minimal chrome
 * — close glyph top-right, an unobtrusive "n / total" counter, prev/next
 * affordances desktop-only (touch swipes instead).
 *
 * GEOMETRY IS THE RESOLVER'S. The plate rectangle comes from
 * `resolveHeroGeometry` in contain ('fit') mode against the measured stage —
 * no bespoke max-height math — and the resolved framing is exposed as
 * `data-hero-framing` exactly like every other hero-media surface, so specs
 * assert the same contract (hero-framing parity law).
 *
 * Behavior: horizontal swipe advances/retreats with a subtle slide (ported
 * from the TitiLinks gallery: 48px horizontal commit, axis-dominance check),
 * swipe-down closes; desktop gets arrow keys, Esc, and click-on-ground close.
 * Body scroll locks while open; focus is trapped and restored on close. Under
 * prefers-reduced-motion the slide becomes a plain crossfade.
 */

/** The w2 plate hairline — gold #C9A55C at the ratified frame opacity. */
const PLATE_HAIRLINE = "1px solid rgba(201,165,92,0.55)";
/** Warm near-black ground, high opacity — the site's brand-dark base. */
const GROUND = "rgba(11,10,8,0.96)";
/** TitiLinks swipe grammar: commit thresholds in px. */
const SWIPE_X_COMMIT = 48;
const SWIPE_DOWN_COMMIT = 72;
/** The lightbox plate is always the WHOLE photo: centred, unzoomed, contain. */
const PLATE_FRAMING = { scale: 1, posX: 50, posY: 50, fit: "fit" as const };

export type LightboxPhoto = {
  id: string;
  image_url: string;
  alt_text: string | null;
};

type Props = {
  photos: LightboxPhoto[];
  open: boolean;
  initialIndex: number;
  onClose: () => void;
};

const PhotoLightbox = ({ photos, open, initialIndex, onClose }: Props) => {
  const { t } = useTranslation();
  const [index, setIndex] = useState(initialIndex);
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const [reduced, setReduced] = useState(false);
  const [mediaAspect, setMediaAspect] = useState<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const stageAspect = useElementAspect(stageRef);

  // Re-arm the index each time the lightbox opens at a new photo.
  useEffect(() => {
    if (open) {
      setIndex(initialIndex);
      setDir(null);
    }
  }, [open, initialIndex]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Body scroll lock while open; focus moves in and returns to the opener.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    overlayRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  const count = photos.length;
  const step = useCallback(
    (direction: "next" | "prev") => {
      if (count === 0) return;
      setDir(direction);
      setIndex((i) => (direction === "next" ? (i + 1) % count : (i - 1 + count) % count));
    },
    [count],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "ArrowRight") step("next");
    if (e.key === "ArrowLeft") step("prev");
    if (e.key === "Tab") {
      // Focus trap: cycle within the dialog's own focusable chrome.
      const focusables = overlayRef.current?.querySelectorAll<HTMLElement>("button");
      if (!focusables || focusables.length === 0) return;
      const list = Array.from(focusables);
      const active = document.activeElement as HTMLElement | null;
      const at = active ? list.indexOf(active) : -1;
      const next = e.shiftKey
        ? at <= 0
          ? list[list.length - 1]
          : list[at - 1]
        : at === list.length - 1
          ? list[0]
          : list[at + 1] ?? list[0];
      e.preventDefault();
      next.focus();
    }
  };

  // TitiLinks touch grammar: dominant-axis swipe. Horizontal commits a step
  // (subtle slide), a downward swipe closes. Taps fall through untouched.
  const onTouchStart = (e: React.TouchEvent) => {
    const tch = e.touches[0];
    touchRef.current = { x: tch.clientX, y: tch.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const tch = e.changedTouches[0];
    const dx = tch.clientX - start.x;
    const dy = tch.clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx <= -SWIPE_X_COMMIT) step("next");
      else if (dx >= SWIPE_X_COMMIT) step("prev");
    } else if (dy >= SWIPE_DOWN_COMMIT) {
      onClose();
    }
  };

  if (!open || count === 0) return null;

  const photo = photos[((index % count) + count) % count];
  const altText =
    photo.alt_text && photo.alt_text.trim().length > 0
      ? photo.alt_text
      : t("gallery.imageAlt", { number: (index % count) + 1 });

  // The plate rectangle IS the resolver's contain box against the measured
  // stage; the image element fills it exactly (any other object-fit would
  // re-letterbox inside the resolver's own maths — FramedImage's rule).
  const styleInput = { mediaAspect, containerAspect: stageAspect, framing: PLATE_FRAMING };
  const geo = resolveHeroGeometry(mediaAspect, stageAspect, PLATE_FRAMING);

  const entrance = reduced
    ? "lightbox-fade-in 220ms ease-out"
    : dir === "prev"
      ? "lightbox-slide-in-prev 260ms ease-out"
      : dir === "next"
        ? "lightbox-slide-in-next 260ms ease-out"
        : "lightbox-fade-in 220ms ease-out";

  return (
    <div
      ref={overlayRef}
      data-qa="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={t("gallery.title")}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="fixed inset-0 z-[100] outline-none"
      style={{ backgroundColor: GROUND }}
    >
      {/* Click on the dark ground closes; clicks on plate/chrome do not. */}
      <div data-qa="lightbox-ground" className="absolute inset-0" onClick={onClose} />

      {/* The stage: the box the resolver letterboxes the plate into. */}
      <div
        ref={stageRef}
        className="pointer-events-none absolute inset-x-4 inset-y-14 md:inset-x-20 md:inset-y-16"
      >
        {geo ? (
          <div
            key={`${photo.id}-${index}`}
            data-qa="lightbox-plate"
            className="absolute"
            style={{
              left: `${geo.leftPct}%`,
              top: `${geo.topPct}%`,
              width: `${geo.widthPct}%`,
              height: `${geo.heightPct}%`,
              border: PLATE_HAIRLINE,
              backgroundColor: "#0b0a08",
              animation: entrance,
            }}
          >
            <img
              src={photo.image_url}
              alt={altText}
              data-qa="lightbox-img"
              data-hero-framing={heroFramingAttr(styleInput)}
              className="h-full w-full"
              style={{ objectFit: "fill" }}
              onLoad={(e) => setMediaAspect(imageAspect(e.currentTarget))}
              decoding="async"
            />
          </div>
        ) : (
          // Aspect not yet measured: decode invisibly, then the plate mounts.
          <img
            src={photo.image_url}
            alt=""
            aria-hidden
            data-qa="lightbox-img-probe"
            className="absolute h-px w-px opacity-0"
            onLoad={(e) => setMediaAspect(imageAspect(e.currentTarget))}
            decoding="async"
          />
        )}
      </div>

      {/* Chrome — minimal, in the ivory/gold vocabulary. */}
      <button
        type="button"
        data-qa="lightbox-close"
        onClick={onClose}
        aria-label={t("gallery.close")}
        className="absolute right-4 top-4 z-10 p-2 text-[#f4ecdb]/70 transition-colors hover:text-[#C9A55C]"
      >
        <X className="h-6 w-6" strokeWidth={1.25} />
      </button>

      <button
        type="button"
        data-qa="lightbox-prev"
        onClick={() => step("prev")}
        aria-label={t("common.previousImage")}
        className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 p-3 text-[#f4ecdb]/60 transition-colors hover:text-[#C9A55C] md:block"
      >
        <ChevronLeft className="h-8 w-8" strokeWidth={1.25} />
      </button>
      <button
        type="button"
        data-qa="lightbox-next"
        onClick={() => step("next")}
        aria-label={t("common.nextImage")}
        className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 p-3 text-[#f4ecdb]/60 transition-colors hover:text-[#C9A55C] md:block"
      >
        <ChevronRight className="h-8 w-8" strokeWidth={1.25} />
      </button>

      <p
        data-qa="lightbox-counter"
        className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-caps"
        style={{ color: "rgba(240,233,218,0.7)", fontSize: "0.7rem", letterSpacing: "0.3em" }}
      >
        {((index % count) + count) % count + 1} / {count}
      </p>
    </div>
  );
};

export default PhotoLightbox;

import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import { useCinematicData } from "@/components/cinematic/useCinematicData";
import { useReducedMotion } from "@/components/cinematic/useReducedMotion";
import { getCinematicMedia, useCinematicMediaConfig } from "@/hooks/useCinematicMedia";
import type { BakeoffSlide } from "./shared";
import V1 from "./V1";
import V2 from "./V2";
import V3 from "./V3";
import V4 from "./V4";
import V5 from "./V5";
import { WIDE_VARIANTS } from "./wideVariants";

/**
 * CINE.FLOW.2 — reel-act bake-off harness. DEV/QA ONLY.
 *
 * Renders committed interpretations of the reel act inside a device frame on
 * the brand ground, for side-by-side judging on a desktop screen. The route is
 * registered only under `import.meta.env.DEV`, is absent from the nav and from
 * public/sitemap.xml, and carries an explicit noindex — it cannot reach
 * production.
 *
 * This page lives under `src/components/qa/` rather than `src/pages/` on
 * purpose: everything the bake-off adds is quarantined in one folder, so "no QA
 * code outside src/components/qa/" is a checkable invariant rather than a
 * convention.
 *
 * The three photos are the REAL reel photos, resolved by the same
 * `getCinematicMedia` call the live page uses and painted through the same
 * `FramedImage` primitive, so nothing here mocks the media pipeline or steps
 * around the hero-framing parity law. `CinematicReel.tsx` itself is untouched.
 *
 * CINE.FLOW.4A — the harness now carries a frame-size selector. Phone frames
 * (< 768 logical px) keep the CINE.FLOW.2 behavior exactly: one slide at a
 * time, V1–V5, entrance replay. Wide frames (>= 768) mount the W-variants from
 * ./wideVariants and are SCRUBBED: a range input drives a linear 0..1 progress
 * across the whole act, so every slide, every crossfade midpoint and the
 * dead-stop are reachable without page scroll. A review-zoom control
 * transform-scales the frame FOR ON-SCREEN REVIEW ONLY — screenshots and spec
 * measurements always run at scale 1 with the frame at true CSS pixel size.
 *
 * Keys — ←/→ variant · ↑/↓ slide (phone) / dead-stop jump (wide) ·
 * L language · R replay (phone) / rewind (wide).
 */

const cinematicFontVars: React.CSSProperties = {
  ["--font-display" as string]: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  ["--font-sans" as string]: "'Jost', 'Outfit', system-ui, sans-serif",
};

/**
 * The judging frames. 440x956 is the original CINE.FLOW.2 phone frame and
 * stays the entry state; the rest are the CINE.FLOW.4A review set. `phone`
 * mirrors the live act's 768 breakpoint (reelSpotlight.REEL_PHONE_BREAKPOINT).
 */
const FRAMES = [
  { id: "440x956", w: 440, h: 956, phone: true },
  { id: "390x844", w: 390, h: 844, phone: true },
  { id: "834x1112", w: 834, h: 1112, phone: false },
  { id: "1024x768", w: 1024, h: 768, phone: false },
  { id: "1440x900", w: 1440, h: 900, phone: false },
  { id: "1600x900", w: 1600, h: 900, phone: false },
  { id: "2560x1080", w: 2560, h: 1080, phone: false },
] as const;
type FrameId = (typeof FRAMES)[number]["id"];

const PHONE_VARIANTS = [
  { id: "v1", name: "Edge Veil", veil: "0 → 0.32 vertical", thesis: "Weight only at the bottom edge; photo fully open above." },
  { id: "v2", name: "Spotlight", veil: "0 → 0.35 radial", thesis: "A beam on the subject; corners carry all the suppression." },
  { id: "v3", name: "Split Frame", veil: "0, seam 0.30", thesis: "No veil on the photo — the type gets its own bare-ground room." },
  { id: "v4", name: "Glow Type", veil: "0.15 flat (floor)", thesis: "Minimum veil; legibility from the letterforms' own bloom." },
  { id: "v5", name: "Gold Rule", veil: "0.20 → 0.30 below line", thesis: "One gold hairline does the work a heavy scrim usually does." },
] as const;

const PHONE_COMPONENTS = [V1, V2, V3, V4, V5] as const;

/** Review-zoom options. "fit" shrinks to the window; measurements use "1". */
const ZOOMS = ["fit", "0.5", "0.75", "1"] as const;
type Zoom = (typeof ZOOMS)[number];

const BakeoffPage = () => {
  const { t, i18n } = useTranslation();
  const reduced = useReducedMotion();
  const { photos, heroVideo, heroPhotoSetting } = useCinematicData();
  const { media } = useCinematicMediaConfig();

  const [frameId, setFrameId] = useState<FrameId>("440x956");
  const [vi, setVi] = useState(0); // phone variant index
  const [wi, setWi] = useState(0); // wide variant index
  const [si, setSi] = useState(0); // phone slide index
  const [play, setPlay] = useState(0);
  const [progress, setProgress] = useState(0); // wide scrub, 0..1
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [winTick, setWinTick] = useState(0);

  useEffect(() => {
    const onResize = () => setWinTick((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const frame = FRAMES.find((f) => f.id === frameId) ?? FRAMES[0];

  const resolved = getCinematicMedia(photos, media, heroPhotoSetting, heroVideo);
  const reel = resolved.reel;

  // Identical slide construction to HomeCinematic's <CinematicReel> call.
  const slides: BakeoffSlide[] = [
    { photo: reel[0].photo, title: t("hero.roles.actress"), focal: reel[0].focal, zoom: reel[0].zoom },
    { photo: reel[1].photo, title: t("hero.roles.streamer"), focal: reel[1].focal, zoom: reel[1].zoom },
    { photo: reel[2].photo, title: t("hero.roles.entrepreneur"), focal: reel[2].focal, zoom: reel[2].zoom },
  ];

  const lang = i18n.language?.startsWith("es") ? "es" : "en";

  /** Wide ↑/↓: snap the scrub to the mounted variant's advertised dead-stops. */
  const jumpDeadStop = useCallback((dir: 1 | -1) => {
    const root = document.querySelector<HTMLElement>('[data-qa="wide-variant"]');
    const stops = root?.dataset.deadstops?.split(",").map(Number).filter(Number.isFinite) ?? [];
    if (stops.length === 0) return;
    setProgress((p) =>
      dir > 0
        ? stops.find((s) => s > p + 1e-3) ?? stops[stops.length - 1]
        : [...stops].reverse().find((s) => s < p - 1e-3) ?? 0,
    );
  }, []);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      // The scrub / selects own their keyboard while focused.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      const wideCount = WIDE_VARIANTS.length;
      if (e.key === "ArrowRight") {
        if (frame.phone) setVi((n) => (n + 1) % PHONE_VARIANTS.length);
        else if (wideCount) setWi((n) => (n + 1) % wideCount);
      } else if (e.key === "ArrowLeft") {
        if (frame.phone) setVi((n) => (n - 1 + PHONE_VARIANTS.length) % PHONE_VARIANTS.length);
        else if (wideCount) setWi((n) => (n - 1 + wideCount) % wideCount);
      } else if (e.key === "ArrowDown") {
        if (frame.phone) setSi((n) => (n + 1) % slides.length);
        else jumpDeadStop(1);
      } else if (e.key === "ArrowUp") {
        if (frame.phone) setSi((n) => (n - 1 + slides.length) % slides.length);
        else jumpDeadStop(-1);
      } else if (e.key === "l" || e.key === "L") {
        void i18n.changeLanguage(lang === "es" ? "en" : "es");
      } else if (e.key === "r" || e.key === "R") {
        if (frame.phone) setPlay((n) => n + 1);
        else setProgress(0);
      } else return;
      e.preventDefault();
    },
    [frame.phone, i18n, jumpDeadStop, lang, slides.length],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const phoneMeta = PHONE_VARIANTS[vi];
  const PhoneVariant = PHONE_COMPONENTS[vi];
  const wide = WIDE_VARIANTS[wi] ?? WIDE_VARIANTS[0];

  // Review zoom. "fit" is for judging oversized frames on a smaller monitor;
  // winTick re-runs the computation when the window resizes. Screenshots and
  // spec measurements select "1" so the frame is at true CSS pixel size.
  void winTick;
  const fitScale =
    typeof window === "undefined"
      ? 1
      : Math.min(1, (window.innerWidth - 64) / frame.w, (window.innerHeight - 176) / frame.h);
  const scale = zoom === "fit" ? fitScale : Number(zoom);

  const activeMeta = frame.phone
    ? phoneMeta
    : wide
      ? { ...wide.meta, veil: "plate law — 0 at focal → 0.35 at plate edges" }
      : { id: "-", name: "no wide variants", thesis: "Wide variants register in ./wideVariants.", veil: "-" };

  return (
    <div
      data-qa="reel-bakeoff"
      className="relative min-h-screen w-full"
      style={{ ...cinematicFontVars, backgroundColor: "#0b0a08" }}
    >
      <Helmet>
        <title>QA — Reel Bake-off</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Readout — variant position, direction name, veil range under test. */}
      <div
        className="absolute right-8 top-8 z-20 text-right"
        style={{ fontFamily: "var(--font-sans)", color: "#f0e9da" }}
      >
        <div data-qa="bakeoff-counter" className="text-[12px]" style={{ letterSpacing: "0.3em", color: "#C9A55C" }}>
          {frame.phone
            ? `V${vi + 1} / ${PHONE_VARIANTS.length}`
            : `W${wi + 1} / ${Math.max(WIDE_VARIANTS.length, 1)}`}
        </div>
        <div
          data-qa="bakeoff-name"
          className="mt-1 text-[26px] uppercase"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
        >
          {activeMeta.name}
        </div>
        <div className="mt-2 max-w-[300px] text-[12px] leading-relaxed" style={{ color: "rgba(240,233,218,0.55)" }}>
          {activeMeta.thesis}
        </div>
        <div className="mt-3 text-[11px]" style={{ color: "rgba(240,233,218,0.4)" }}>
          {`veil ${activeMeta.veil}`}
        </div>
      </div>

      {/* Controls — frame, review zoom, and (wide) the act scrub. */}
      <div
        className="absolute left-8 top-8 z-20 flex items-center gap-3 text-[12px]"
        style={{ fontFamily: "var(--font-sans)", color: "rgba(240,233,218,0.7)" }}
      >
        <select
          data-qa="bakeoff-frame"
          value={frameId}
          onChange={(e) => setFrameId(e.target.value as FrameId)}
          className="border bg-transparent px-2 py-1"
          style={{ borderColor: "rgba(201,165,92,0.4)", color: "#f0e9da", backgroundColor: "#0b0a08" }}
        >
          {FRAMES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.id}
              {f.phone ? " (phone)" : ""}
            </option>
          ))}
        </select>
        <select
          data-qa="bakeoff-zoom"
          value={zoom}
          onChange={(e) => setZoom(e.target.value as Zoom)}
          className="border bg-transparent px-2 py-1"
          style={{ borderColor: "rgba(201,165,92,0.4)", color: "#f0e9da", backgroundColor: "#0b0a08" }}
        >
          {ZOOMS.map((z) => (
            <option key={z} value={z}>
              {z === "fit" ? "zoom: fit" : `zoom: ${z}`}
            </option>
          ))}
        </select>
        {!frame.phone && WIDE_VARIANTS.length > 0 && (
          <select
            data-qa="bakeoff-wide-variant"
            value={wide?.meta.id}
            onChange={(e) => setWi(Math.max(0, WIDE_VARIANTS.findIndex((w) => w.meta.id === e.target.value)))}
            className="border bg-transparent px-2 py-1"
            style={{ borderColor: "rgba(201,165,92,0.4)", color: "#f0e9da", backgroundColor: "#0b0a08" }}
          >
            {WIDE_VARIANTS.map((w) => (
              <option key={w.meta.id} value={w.meta.id}>
                {w.meta.id} — {w.meta.name}
              </option>
            ))}
          </select>
        )}
        {!frame.phone && (
          <label className="flex items-center gap-2">
            <span style={{ letterSpacing: "0.15em" }}>SCRUB</span>
            <input
              data-qa="bakeoff-scrub"
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={(e) => setProgress(Number(e.target.value) / 1000)}
              style={{ width: 220, accentColor: "#C9A55C" }}
            />
            <span data-qa="bakeoff-progress" className="tabular-nums">
              {progress.toFixed(3)}
            </span>
          </label>
        )}
      </div>

      {/* Legend. */}
      <div
        className="absolute left-8 top-20 z-20 text-[12px] leading-relaxed"
        style={{ fontFamily: "var(--font-sans)", color: "rgba(240,233,218,0.45)" }}
      >
        <div>← / → variant</div>
        <div>{frame.phone ? `↑ / ↓ slide (${si + 1} / ${slides.length})` : "↑ / ↓ dead-stop jump"}</div>
        <div>
          L language (<span data-qa="bakeoff-lang">{lang.toUpperCase()}</span>)
        </div>
        <div>{frame.phone ? "R replay" : "R rewind"}</div>
        {reduced && <div className="mt-2" style={{ color: "#C9A55C" }}>reduced motion — static</div>}
      </div>

      {frame.phone ? (
        /* The phone frame — CINE.FLOW.2 behavior, byte-for-byte. */
        <div className="flex min-h-screen items-center justify-center">
          {/* The frame is outlined, not bordered: an outline sits outside the box
              model, so the composition the variants measure against stays
              exactly frame-sized. */}
          <div
            data-qa="bakeoff-phone"
            className="relative overflow-hidden"
            style={{
              width: frame.w,
              height: frame.h,
              backgroundColor: "#0b0a08",
              outline: "1px solid rgba(201,165,92,0.25)",
              transform: scale === 1 ? undefined : `scale(${scale})`,
              transformOrigin: "center",
            }}
          >
            <PhoneVariant
              key={`${phoneMeta.id}-${si}-${lang}-${play}`}
              slide={slides[si]}
              index={si}
              playKey={play}
              reduced={reduced}
            />
          </div>
        </div>
      ) : (
        /* Wide frames sit below the controls, top-left anchored so the frame's
           page position is stable for element screenshots at zoom 1. 200px of
           headroom keeps the legend/readout chrome fully clear of the frame,
           so evidence screenshots carry no overlay ink. */
        <div style={{ paddingTop: 200, paddingLeft: 32, paddingBottom: 32 }}>
          <div style={{ transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: "top left" }}>
            <div
              data-qa="bakeoff-wide-frame"
              className="relative overflow-hidden"
              style={{
                width: frame.w,
                height: frame.h,
                backgroundColor: "#0b0a08",
                outline: "1px solid rgba(201,165,92,0.25)",
              }}
            >
              {wide ? (
                <wide.component
                  key={`${wide.meta.id}-${frame.id}-${lang}`}
                  slides={slides}
                  progress={progress}
                  reduced={reduced}
                  frameW={frame.w}
                  frameH={frame.h}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-[12px]"
                  style={{ fontFamily: "var(--font-sans)", color: "rgba(240,233,218,0.4)" }}
                >
                  No wide variants registered yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BakeoffPage;

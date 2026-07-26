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

/**
 * CINE.FLOW.2 — reel-act bake-off harness. DEV/QA ONLY.
 *
 * Renders one of five committed interpretations of the mobile reel act inside a
 * 390x844 phone frame on the brand ground, for side-by-side judging on a
 * desktop screen. The route is registered only under `import.meta.env.DEV`, is
 * absent from the nav and from public/sitemap.xml, and carries an explicit
 * noindex — it cannot reach production.
 *
 * This page lives under `src/components/qa/` rather than `src/pages/` on
 * purpose: everything CINE.FLOW.2 adds is quarantined in one folder, so "no QA
 * code outside src/components/qa/" is a checkable invariant rather than a
 * convention.
 *
 * The three photos are the REAL reel photos, resolved by the same
 * `getCinematicMedia` call the live page uses and painted through the same
 * `FramedImage` primitive, so nothing here mocks the media pipeline or steps
 * around the hero-framing parity law. `CinematicReel.tsx` itself is untouched.
 *
 * Keys — ←/→ variant · ↑/↓ slide · L language · R replay entrance.
 */

const PHONE_W = 440;
const PHONE_H = 956;

const cinematicFontVars: React.CSSProperties = {
  ["--font-display" as string]: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  ["--font-sans" as string]: "'Jost', 'Outfit', system-ui, sans-serif",
};

const VARIANTS = [
  { id: "v1", name: "Edge Veil", veil: "0 → 0.32 vertical", thesis: "Weight only at the bottom edge; photo fully open above." },
  { id: "v2", name: "Spotlight", veil: "0 → 0.35 radial", thesis: "A beam on the subject; corners carry all the suppression." },
  { id: "v3", name: "Split Frame", veil: "0, seam 0.30", thesis: "No veil on the photo — the type gets its own bare-ground room." },
  { id: "v4", name: "Glow Type", veil: "0.15 flat (floor)", thesis: "Minimum veil; legibility from the letterforms' own bloom." },
  { id: "v5", name: "Gold Rule", veil: "0.20 → 0.30 below line", thesis: "One gold hairline does the work a heavy scrim usually does." },
] as const;

const COMPONENTS = [V1, V2, V3, V4, V5] as const;

const BakeoffPage = () => {
  const { t, i18n } = useTranslation();
  const reduced = useReducedMotion();
  const { photos, heroVideo, heroPhotoSetting } = useCinematicData();
  const { media } = useCinematicMediaConfig();

  const [vi, setVi] = useState(0);
  const [si, setSi] = useState(0);
  const [play, setPlay] = useState(0);

  const resolved = getCinematicMedia(photos, media, heroPhotoSetting, heroVideo);
  const reel = resolved.reel;

  // Identical slide construction to HomeCinematic's <CinematicReel> call.
  const slides: BakeoffSlide[] = [
    { photo: reel[0].photo, title: t("hero.roles.actress"), focal: reel[0].focal, zoom: reel[0].zoom },
    { photo: reel[1].photo, title: t("hero.roles.streamer"), focal: reel[1].focal, zoom: reel[1].zoom },
    { photo: reel[2].photo, title: t("hero.roles.entrepreneur"), focal: reel[2].focal, zoom: reel[2].zoom },
  ];

  const lang = i18n.language?.startsWith("es") ? "es" : "en";

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setVi((n) => (n + 1) % VARIANTS.length);
      else if (e.key === "ArrowLeft") setVi((n) => (n - 1 + VARIANTS.length) % VARIANTS.length);
      else if (e.key === "ArrowDown") setSi((n) => (n + 1) % slides.length);
      else if (e.key === "ArrowUp") setSi((n) => (n - 1 + slides.length) % slides.length);
      else if (e.key === "l" || e.key === "L") void i18n.changeLanguage(lang === "es" ? "en" : "es");
      else if (e.key === "r" || e.key === "R") setPlay((n) => n + 1);
      else return;
      e.preventDefault();
    },
    [i18n, lang, slides.length],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const meta = VARIANTS[vi];
  const Variant = COMPONENTS[vi];

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
        className="absolute right-8 top-8 text-right"
        style={{ fontFamily: "var(--font-sans)", color: "#f0e9da" }}
      >
        <div data-qa="bakeoff-counter" className="text-[12px]" style={{ letterSpacing: "0.3em", color: "#C9A55C" }}>
          {`V${vi + 1} / ${VARIANTS.length}`}
        </div>
        <div
          data-qa="bakeoff-name"
          className="mt-1 text-[26px] uppercase"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
        >
          {meta.name}
        </div>
        <div className="mt-2 max-w-[300px] text-[12px] leading-relaxed" style={{ color: "rgba(240,233,218,0.55)" }}>
          {meta.thesis}
        </div>
        <div className="mt-3 text-[11px]" style={{ color: "rgba(240,233,218,0.4)" }}>
          {`veil ${meta.veil}`}
        </div>
      </div>

      {/* Legend. */}
      <div
        className="absolute left-8 top-8 text-[12px] leading-relaxed"
        style={{ fontFamily: "var(--font-sans)", color: "rgba(240,233,218,0.45)" }}
      >
        <div>← / → variant</div>
        <div>↑ / ↓ slide ({si + 1} / {slides.length})</div>
        <div>L language ({lang.toUpperCase()})</div>
        <div>R replay</div>
        {reduced && <div className="mt-2" style={{ color: "#C9A55C" }}>reduced motion — static</div>}
      </div>

      {/* The phone frame. */}
      <div className="flex min-h-screen items-center justify-center">
        {/* The frame is outlined, not bordered: an outline sits outside the box
            model, so the 440x956 composition the variants measure against stays
            exactly 440x956. */}
        <div
          data-qa="bakeoff-phone"
          className="relative overflow-hidden"
          style={{
            width: PHONE_W,
            height: PHONE_H,
            backgroundColor: "#0b0a08",
            outline: "1px solid rgba(201,165,92,0.25)",
          }}
        >
          <Variant
            key={`${meta.id}-${si}-${lang}-${play}`}
            slide={slides[si]}
            index={si}
            playKey={play}
            reduced={reduced}
          />
        </div>
      </div>
    </div>
  );
};

export default BakeoffPage;

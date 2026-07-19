import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import SEO from "@/components/SEO";
import { useReducedMotion } from "@/components/cinematic/useReducedMotion";
import { useCinematicData, resolveHeroPhoto } from "@/components/cinematic/useCinematicData";
import CinematicHero from "@/components/cinematic/CinematicHero";
import CinematicReel from "@/components/cinematic/CinematicReel";
import CinematicVentures from "@/components/cinematic/CinematicVentures";
import CinematicGallery from "@/components/cinematic/CinematicGallery";
import CinematicAbout from "@/components/cinematic/CinematicAbout";
import CinematicContact from "@/components/cinematic/CinematicContact";
import "@/components/cinematic/cinematic.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * Cinematic home variant (TA.SPRINT.1) — a scroll-driven, full-bleed dark page.
 *
 * Additive: this is a standalone /cinematic route and a selectable "cinematic"
 * home_variant. It does not change any existing page. The public site keeps
 * rendering the editorial variant until home_variant is flipped manually.
 *
 * Smooth scroll (Lenis) and ScrollTrigger are instantiated HERE, on mount, and
 * fully torn down on unmount so no other route is affected. Under
 * prefers-reduced-motion we skip Lenis and all scroll animation entirely.
 *
 * Font system mirrors HomeEditorial: Cinzel display + Jost sans via CSS vars.
 */
const cinematicFontVars: React.CSSProperties = {
  ["--font-display" as string]: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  ["--font-sans" as string]: "'Jost', 'Outfit', system-ui, sans-serif",
  fontFamily: "var(--font-sans)",
};

const HomeCinematic = () => {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const { photos, heroVideo, heroPhotoSetting } = useCinematicData();

  // Hero photo: the admin-selected one (site_settings "cinematic_hero_photo")
  // when it resolves to a published photo, otherwise the first published photo
  // (today's default behavior). The reel draws from every OTHER published photo
  // so it never duplicates whichever photo the hero actually uses.
  const heroPhoto = resolveHeroPhoto(photos, heroPhotoSetting);
  const reelPhotos = photos.filter((p) => p.id !== heroPhoto?.id);

  // Lenis ↔ GSAP ScrollTrigger, scoped to this page only.
  useEffect(() => {
    if (prefersReduced) return; // no scrolljacking / scrubbing under reduced motion

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [prefersReduced]);

  // Keep ScrollTrigger measurements correct once async photos change layout.
  useEffect(() => {
    if (prefersReduced) return;
    ScrollTrigger.refresh();
  }, [photos, prefersReduced]);

  return (
    <div
      ref={rootRef}
      data-qa="home-cinematic"
      style={{ ...cinematicFontVars, backgroundColor: "#0b0a08" }}
      className="relative w-full overflow-x-clip text-[#f0e9da]"
    >
      <SEO
        path="/cinematic"
        title="Cristyna Polentino | Actriz, Bailarina y Empresaria en Medellín"
        description="Actriz colombiana, bailarina profesional y empresaria en Medellín. Portafolio, Titans Agency y Green World."
      />

      <CinematicHero
        photo={heroPhoto}
        videoSrc={heroVideo}
        subtitle={t("hero.rolesLine")}
        scrollLabel={t("common.scroll")}
        reduced={prefersReduced}
      />

      {/* TA.5c: reel uses photos #2–4 so it never repeats the hero's photo #1.
          `reelPhotos` is the non-hero pool (sort_order 2, 3, 4, …); when fewer
          than 4 photos exist, the trailing slides simply render without an
          image rather than reusing the hero photo. */}
      <CinematicReel
        reduced={prefersReduced}
        slides={[
          { photo: reelPhotos[0], title: t("hero.roles.actress") },
          { photo: reelPhotos[1], title: t("hero.roles.streamer") },
          { photo: reelPhotos[2], title: t("hero.roles.entrepreneur") },
        ]}
      />

      <CinematicGallery photos={photos} reduced={prefersReduced} />

      {/* TA.6b: ventures act — a full-bleed Green World / Titans Agency split
          panel sitting between the reel/gallery and the about section. */}
      <CinematicVentures reduced={prefersReduced} />

      <CinematicAbout reduced={prefersReduced} />

      <CinematicContact />
    </div>
  );
};

export default HomeCinematic;

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import SEO from "@/components/SEO";
import { useReducedMotion } from "@/components/cinematic/useReducedMotion";
import { useCinematicData } from "@/components/cinematic/useCinematicData";
import {
  getCinematicMedia,
  useCinematicMediaConfig,
  type ClassFramingPair,
  type ResolvedReelSlot,
} from "@/hooks/useCinematicMedia";
import CinematicHero from "@/components/cinematic/CinematicHero";
import CinematicReel from "@/components/cinematic/CinematicReel";
import { resolveReelChapter } from "@/components/cinematic/reelChapters";
import CinematicBook from "@/components/cinematic/CinematicBook";
import CinematicGreenWorldSeq from "@/components/cinematic/CinematicGreenWorldSeq";
import CinematicTitans from "@/components/cinematic/CinematicTitans";
import { TITANS_ENABLED } from "@/lib/ventures";
import CinematicTitiLinks from "@/components/cinematic/CinematicTitiLinks";
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
/**
 * FRAME.SPLIT.1 — lift just the two class records off a resolved reel slot. The
 * photo travels as its own prop, so nothing but framing rides in `framing`.
 */
const classesOf = (s: ResolvedReelSlot): ClassFramingPair => ({ phone: s.phone, wide: s.wide });

const cinematicFontVars: React.CSSProperties = {
  ["--font-display" as string]: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  ["--font-sans" as string]: "'Jost', 'Outfit', system-ui, sans-serif",
  fontFamily: "var(--font-sans)",
};

const HomeCinematic = () => {
  const { t, i18n } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const { photos, heroVideo, heroPhotoSetting, reelChapterSettings } = useCinematicData();
  // CINE.FLOW.6 — ES primary: anything that is not explicitly English reads
  // the Spanish chapter (mirrors the site's es-default language law).
  const chapterLocale = i18n.language?.toLowerCase().startsWith("en") ? "en" : "es";
  const chapterFor = (i: number) => resolveReelChapter(reelChapterSettings[i], i, chapterLocale);
  const { media } = useCinematicMediaConfig();

  // ADMIN.MEDIA.1: one resolver merges cinematic_media → legacy cinematic_hero_photo
  // → defaults. With no admin data set this equals today's render exactly — the
  // hero is the first published photo (or the legacy selection) at the TA.6d
  // focal, and the reel draws the non-hero pool (photos 2–4) centered at 1×.
  // VID.MODEL.1: resolves THE single hero video + its per-viewport framing records.
  const resolved = getCinematicMedia(photos, media, heroPhotoSetting, heroVideo);
  const hero = resolved.hero;
  const reel = resolved.reel;

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

  // TA.7d: own the scroll position for this cinematic route. Disable the
  // browser's automatic scroll restoration — on a refresh it could otherwise
  // restore a stale offset against a not-yet-measured layout — and start at the
  // top. The prior policy is restored on unmount so other routes are unaffected.
  useEffect(() => {
    const supported = typeof history !== "undefined" && "scrollRestoration" in history;
    const prev = supported ? history.scrollRestoration : undefined;
    if (supported) {
      try {
        history.scrollRestoration = "manual";
      } catch {
        /* some browsers disallow setting it — best effort */
      }
    }
    window.scrollTo(0, 0);
    return () => {
      if (supported && prev) {
        try {
          history.scrollRestoration = prev;
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  // TA.7d: web fonts change the measured height of the pinned/scrubbed sections.
  // Refresh once they settle so every ScrollTrigger start/end is computed against
  // the final layout (prevents a late height shift under motion).
  useEffect(() => {
    if (prefersReduced) return;
    let cancelled = false;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [prefersReduced]);

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
        description="Actriz colombiana, bailarina profesional y empresaria en Medellín. Portafolio y Green World."
      />

      <CinematicHero
        photo={hero.photo}
        videoSrc={hero.videoSrc}
        subtitle={t("hero.rolesLine")}
        scrollLabel={t("common.scroll")}
        reduced={prefersReduced}
        focal={hero.focal}
        zoom={hero.zoom}
        videoLandscape={hero.videoLandscape}
        videoPortrait={hero.videoPortrait}
      />

      {/* TA.5c: reel uses photos #2–4 so it never repeats the hero's photo #1.
          Each slot's photo + framing comes from the resolver (non-hero pool by
          default; an admin-set slot overrides both). When fewer than 4 photos
          exist, the trailing slides simply render without an image.

          FRAME.SPLIT.1: both device-class records are handed down whole — the
          act picks its own at the same breakpoint it picks its composition, so
          this page never needs to know which one paints. */}
      <CinematicReel
        reduced={prefersReduced}
        slides={[
          {
            photo: reel[0].photo,
            title: t("hero.roles.actress"),
            framing: classesOf(reel[0]),
            chapter: chapterFor(0),
          },
          {
            photo: reel[1].photo,
            title: t("hero.roles.streamer"),
            framing: classesOf(reel[1]),
            chapter: chapterFor(1),
          },
          {
            photo: reel[2].photo,
            title: t("hero.roles.entrepreneur"),
            framing: classesOf(reel[2]),
            chapter: chapterFor(2),
          },
        ]}
      />

      <CinematicGallery photos={photos} reduced={prefersReduced} />

      {/* BOOK.ACT.1 — the coming-soon book teaser, immediately before Green
          World in the scroll order. Publisher law: it reuses the /book page's
          bilingual coming-soon strings only — no title, date, cover, or
          purchase language until Cristyna confirms them. */}
      <CinematicBook reduced={prefersReduced} />

      {/* TA.7: ventures acts — full-viewport cinematic sections that replaced
          the old TA.6b split-panel (archived).
          SEQ.2 — Green World is now a PINNED scroll-scrub act: scroll is the
          playhead of a frame pack, with a static logo layer and lockup held
          still over it. The TA.7a curtain-and-loop-video act it replaced stays
          in-repo, unmounted, at cinematic/CinematicGreenWorld.tsx.
          TITANS.OFF.1 — the Titans act is gated off, so Green World now hands
          straight to TitiLinks. */}
      <CinematicGreenWorldSeq reduced={prefersReduced} />
      {TITANS_ENABLED && <CinematicTitans reduced={prefersReduced} />}

      {/* TA.8: TitiLinks act — pinned product tour → coming-soon → clean fade release. */}
      <CinematicTitiLinks reduced={prefersReduced} />

      {/* ABOUT.MEDIA.1 — the About portrait panel is opt-in: resolved.about is
          null unless an admin picked a photo, in which case the section renders
          the bordered 3:4 panel beside the copy (see CinematicAbout). */}
      <CinematicAbout
        reduced={prefersReduced}
        photo={resolved.about?.photo}
        phone={resolved.about?.phone}
        wide={resolved.about?.wide}
      />

      <CinematicContact reduced={prefersReduced} />
    </div>
  );
};

export default HomeCinematic;

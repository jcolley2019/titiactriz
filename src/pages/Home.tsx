import { lazy, Suspense } from "react";
import HomeClassic from "./HomeClassic";
import HomeEditorial from "./HomeEditorial";
import { useHomeVariant } from "@/hooks/useHomeVariant";

// Lazy so the cinematic variant's gsap/lenis bundle never loads on the default
// (editorial/classic) home. Only pulled in when the variant is actually chosen.
const HomeCinematic = lazy(() => import("./HomeCinematic"));

/**
 * Neutral hold — a full-viewport screen in the site background colour, shown
 * only on a true first visit while the variant fetch is in flight (TA.6c), and
 * as the cinematic chunk's Suspense fallback. Both home variants are dark, so a
 * charcoal hold ends seamlessly in the real page with no white flash between.
 */
const HomeHold = () => (
  <div
    data-qa="home-hold"
    aria-hidden
    style={{ position: "fixed", inset: 0, backgroundColor: "hsl(var(--background))" }}
  />
);

/**
 * Home route — variant is controlled from the Admin console
 * (Settings → Home variant). Stored in public.site_settings.
 *
 * A repeat visitor renders their cached variant immediately; a first visitor
 * sees the neutral hold (variant === null) until the fetch resolves, so the
 * page never flashes the default before swapping.
 */
const Home = () => {
  const { variant } = useHomeVariant();

  if (variant === null) return <HomeHold />;

  if (variant === "cinematic") {
    return (
      <Suspense fallback={<HomeHold />}>
        <HomeCinematic />
      </Suspense>
    );
  }
  return variant === "editorial" ? <HomeEditorial /> : <HomeClassic />;
};

export default Home;

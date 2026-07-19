import { lazy, Suspense } from "react";
import { createPortal } from "react-dom";
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
 *
 * TA.7e: the hold is PORTALED to <body>, not rendered in place. The `/` route is
 * wrapped in <PageTransition>, a framer-motion `motion.div` that animates opacity
 * and y (transform) on mount. Both properties establish a *stacking context*, so
 * a `z-index` on any descendant — including TA.7d's `zIndex: 60` — is trapped
 * INSIDE that wrapper. The wrapper itself is `z-index: auto` in the root stacking
 * context, and the global <Footer> is `relative z-10` (a positive z-index), so
 * for the ~300ms enter tween the footer painted *over* the whole wrapper, hold
 * included — the production footer flash. Portaling the hold to <body> lifts it
 * out of that wrapper into the root stacking context, where `zIndex: 60` truly
 * beats the footer (z-10) and header (z-50).
 *
 * The background is a literal `#121212` (=== `hsl(var(--background))` in the dark
 * theme) rather than the CSS var: in the production bundle the module script is
 * emitted before the stylesheet <link>, so React can mount and paint one frame
 * before app CSS applies — at which point `hsl(var(--background))` would resolve
 * to nothing (a see-through cover). A literal keeps the hold opaque regardless.
 */
const HomeHold = () => {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      data-qa="home-hold"
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: "#121212" }}
    />,
    document.body,
  );
};

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

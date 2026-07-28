import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import PageTransition from "./PageTransition";
import Home from "@/pages/Home";
import { TITANS_ENABLED } from "@/lib/ventures";

// Lazy-loaded routes (kept out of the home-page bundle)
const HomeCinematic = lazy(() => import("@/pages/HomeCinematic"));
const TitansAgency = lazy(() => import("@/pages/TitansAgency"));
const GreenWorld = lazy(() => import("@/pages/GreenWorld"));
const WorkResume = lazy(() => import("@/pages/WorkResume"));
const Socials = lazy(() => import("@/pages/Socials"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Admin = lazy(() => import("@/pages/Admin"));
const Events = lazy(() => import("@/pages/Events"));
const Studio = lazy(() => import("@/pages/Studio"));
const OAuthConsent = lazy(() => import("@/pages/OAuthConsent"));

// CINE.FLOW.2 — QA-only bake-off harness. Registered below under
// `import.meta.env.DEV` only, absent from the nav and public/sitemap.xml, and
// noindex'd by the page itself. Never reachable in a production build.
const QaReelBakeoff = lazy(() => import("@/components/qa/reel-bakeoff/BakeoffPage"));

// SEQ.1 — QA-only frame-scrub lab. Same gating as the bake-off above: DEV-only
// registration, no nav entry, absent from public/sitemap.xml, noindex'd by the
// page itself.
const QaSeqLab = lazy(() => import("@/components/qa/seq-lab/SeqLabPage"));

const RouteFallback = () => (
  <div
    className="min-h-[60vh] flex items-center justify-center"
    aria-busy="true"
    aria-live="polite"
  >
    <div className="h-8 w-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
  </div>
);

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageTransition>
              <Home />
            </PageTransition>
          }
        />
        <Route
          path="/cinematic"
          element={
            <PageTransition>
              <Suspense fallback={<RouteFallback />}>
                <HomeCinematic />
              </Suspense>
            </PageTransition>
          }
        />
        {/* TITANS.OFF.1 — unregistered while TITANS_ENABLED is false, so the
            path falls through to the `*` route and gets the site's ordinary
            404 rather than a bespoke "gone" page. The component above is still
            lazy-imported and still builds; only the registration is gated. */}
        {TITANS_ENABLED && (
          <Route
            path="/titans-agency"
            element={
              <PageTransition>
                <Suspense fallback={<RouteFallback />}>
                  <TitansAgency />
                </Suspense>
              </PageTransition>
            }
          />
        )}
        <Route
          path="/green-world"
          element={
            <PageTransition>
              <Suspense fallback={<RouteFallback />}>
                <GreenWorld />
              </Suspense>
            </PageTransition>
          }
        />
        <Route
          path="/work"
          element={
            <PageTransition>
              <Suspense fallback={<RouteFallback />}>
                <WorkResume />
              </Suspense>
            </PageTransition>
          }
        />
        <Route
          path="/socials"
          element={
            <PageTransition>
              <Suspense fallback={<RouteFallback />}>
                <Socials />
              </Suspense>
            </PageTransition>
          }
        />
        <Route
          path="/events"
          element={
            <PageTransition>
              <Suspense fallback={<RouteFallback />}>
                <Events />
              </Suspense>
            </PageTransition>
          }
        />
        <Route
          path="/studio"
          element={
            <PageTransition>
              <Suspense fallback={<RouteFallback />}>
                <Studio />
              </Suspense>
            </PageTransition>
          }
        />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Admin />
            </Suspense>
          }
        />
        {import.meta.env.DEV && (
          <Route
            path="/qa/reel-bakeoff"
            element={
              <Suspense fallback={<RouteFallback />}>
                <QaReelBakeoff />
              </Suspense>
            }
          />
        )}
        {import.meta.env.DEV && (
          <Route
            path="/qa/seq-lab"
            element={
              <Suspense fallback={<RouteFallback />}>
                <QaSeqLab />
              </Suspense>
            }
          />
        )}
        <Route
          path="/.lovable/oauth/consent"
          element={
            <Suspense fallback={<RouteFallback />}>
              <OAuthConsent />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <PageTransition>
              <Suspense fallback={<RouteFallback />}>
                <NotFound />
              </Suspense>
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
};

export default AnimatedRoutes;

import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import PageTransition from "./PageTransition";
import Home from "@/pages/Home";

// Lazy-loaded routes (kept out of the home-page bundle)
const TitansAgency = lazy(() => import("@/pages/TitansAgency"));
const GreenWorld = lazy(() => import("@/pages/GreenWorld"));
const WorkResume = lazy(() => import("@/pages/WorkResume"));
const Socials = lazy(() => import("@/pages/Socials"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Admin = lazy(() => import("@/pages/Admin"));

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
          path="/titans-agency"
          element={
            <PageTransition>
              <Suspense fallback={<RouteFallback />}>
                <TitansAgency />
              </Suspense>
            </PageTransition>
          }
        />
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
          path="/admin"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Admin />
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

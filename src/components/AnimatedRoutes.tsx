import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import PageTransition from "./PageTransition";
import Index from "@/pages/Index";
import TitansAgency from "@/pages/TitansAgency";
import GreenWorld from "@/pages/GreenWorld";
import WorkResume from "@/pages/WorkResume";
import Socials from "@/pages/Socials";
import NotFound from "@/pages/NotFound";

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageTransition>
              <Index />
            </PageTransition>
          }
        />
        <Route
          path="/titans-agency"
          element={
            <PageTransition>
              <TitansAgency />
            </PageTransition>
          }
        />
        <Route
          path="/green-world"
          element={
            <PageTransition>
              <GreenWorld />
            </PageTransition>
          }
        />
        <Route
          path="/work"
          element={
            <PageTransition>
              <WorkResume />
            </PageTransition>
          }
        />
        <Route
          path="/socials"
          element={
            <PageTransition>
              <Socials />
            </PageTransition>
          }
        />
        <Route
          path="*"
          element={
            <PageTransition>
              <NotFound />
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
};

export default AnimatedRoutes;

import { lazy, Suspense } from "react";
import HomeClassic from "./HomeClassic";
import HomeEditorial from "./HomeEditorial";
import { useHomeVariant } from "@/hooks/useHomeVariant";

// Lazy so the cinematic variant's gsap/lenis bundle never loads on the default
// (editorial/classic) home. Only pulled in when the variant is actually chosen.
const HomeCinematic = lazy(() => import("./HomeCinematic"));

/**
 * Home route — variant is controlled from the Admin console
 * (Settings → Home variant). Stored in public.site_settings.
 */
const Home = () => {
  const { variant } = useHomeVariant();
  if (variant === "cinematic") {
    return (
      <Suspense fallback={null}>
        <HomeCinematic />
      </Suspense>
    );
  }
  return variant === "editorial" ? <HomeEditorial /> : <HomeClassic />;
};

export default Home;

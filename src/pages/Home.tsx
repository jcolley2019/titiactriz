import HomeClassic from "./HomeClassic";
import HomeEditorial from "./HomeEditorial";
import { useHomeVariant } from "@/hooks/useHomeVariant";

/**
 * Home route — variant is controlled from the Admin console
 * (Settings → Home variant). Stored in public.site_settings.
 */
const Home = () => {
  const { variant } = useHomeVariant();
  return variant === "editorial" ? <HomeEditorial /> : <HomeClassic />;
};

export default Home;

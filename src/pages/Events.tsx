import { useTranslation } from "react-i18next";
import SEO from "@/components/SEO";
import SmartFilmsCard from "@/components/events/SmartFilmsCard";
import { useEventSettings } from "@/hooks/useEventSettings";

const CREAM = "#f0e9da";
const DARK = "#0e0c09";

const editorialFontVars: React.CSSProperties = {
  ["--font-display" as never]: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  ["--font-sans" as never]: "'Jost', 'Outfit', system-ui, sans-serif",
  fontFamily: "var(--font-sans)",
};

const Events = () => {
  const { t, i18n } = useTranslation();
  const { settings, loading } = useEventSettings();
  const lang = (i18n.language || "es").startsWith("en") ? "en" : "es";
  const title =
    lang === "en"
      ? "Events | Cristyna Polentino"
      : "Eventos | Cristyna Polentino";
  const description =
    lang === "en"
      ? "Cristyna Polentino is competing in SmartFilms Colombia 2026, the world's largest cellphone-film festival. Theme: retro-futurism."
      : "Cristyna Polentino compite en SmartFilms Colombia 2026, el festival de cine hecho con celular más grande del mundo. Temática: retrofuturismo.";

  return (
    <main
      className="relative min-h-screen pt-32 pb-24 px-4"
      style={{ ...editorialFontVars, backgroundColor: DARK, color: CREAM }}
    >
      <SEO path="/events" title={title} description={description} />

      <div className="max-w-3xl mx-auto text-center mb-12">
        <h1
          className="text-4xl md:text-5xl lg:text-6xl leading-tight mb-4"
          style={{ fontFamily: "var(--font-display)", color: CREAM }}
        >
          {t("events.title")}
        </h1>
        <p
          className="text-sm md:text-base"
          style={{ color: `${CREAM}cc`, fontFamily: "var(--font-sans)" }}
        >
          {t("events.intro")}
        </p>
      </div>

      {!loading && settings.visible && <SmartFilmsCard data={settings} />}

      {!loading && !settings.visible && (
        <p
          className="text-center mt-12 text-xs md:text-sm uppercase tracking-[0.25em]"
          style={{ color: `${CREAM}80`, fontFamily: "var(--font-sans)" }}
        >
          {t("events.more")}
        </p>
      )}

      {!loading && settings.visible && (
        <p
          className="text-center mt-12 text-xs md:text-sm uppercase tracking-[0.25em]"
          style={{ color: `${CREAM}80`, fontFamily: "var(--font-sans)" }}
        >
          {t("events.more")}
        </p>
      )}
    </main>
  );
};

export default Events;

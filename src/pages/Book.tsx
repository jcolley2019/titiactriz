import { useTranslation } from "react-i18next";
import SEO from "@/components/SEO";

/**
 * BOOK.0 — the placeholder that holds the URL.
 *
 * Cristyna's book is in publication; the title, the release date and the place
 * to buy it are not settled yet. This page therefore says exactly that and
 * NOTHING more. It invents no date, no title, and no pre-order — the copy can
 * only gain detail as she confirms it (PRODUCT.md: owner truth is immutable).
 *
 * It exists as a real route rather than a dead nav item because the URL starts
 * earning the day it ships: it is crawlable, it can be linked from her socials,
 * and when the real page replaces it the address already has history instead of
 * starting from zero. The `Person` JSON-LD below is the part that does that
 * work now; a `Book` entity joins it the day there is a title and an ISBN.
 */

const GROUND = "#0b0a08";
const IVORY = "#f4ecdb";
const GOLD = "#C9A55C";

const fontVars: React.CSSProperties = {
  ["--font-display" as never]: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  ["--font-sans" as never]: "'Jost', 'Outfit', system-ui, sans-serif",
  fontFamily: "var(--font-sans)",
};

const Book = () => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "es").startsWith("en") ? "en" : "es";

  const title =
    lang === "en"
      ? "New Book Coming Soon | Cristyna Polentino"
      : "Nuevo Libro Muy Pronto | Cristyna Polentino";
  const description =
    lang === "en"
      ? "Cristyna Polentino's book is being published. The release date and where to order it are coming soon."
      : "El libro de Cristyna Polentino está en proceso de publicación. Pronto compartiremos la fecha de lanzamiento y dónde conseguirlo.";

  // Only what is actually known. No `Book` entity yet: an entity with no title
  // and no ISBN is worse than no entity at all — it teaches the crawlers a
  // half-fact they will have to unlearn.
  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Cristyna Polentino",
    url: "https://titiactriz.com",
    jobTitle: lang === "en" ? "Actress, dancer, entrepreneur" : "Actriz, bailarina y empresaria",
  };

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center px-6 py-32 text-center"
      style={{ ...fontVars, backgroundColor: GROUND, color: IVORY }}
    >
      <SEO path="/book" title={title} description={description}>
        <script type="application/ld+json">{JSON.stringify(personLd)}</script>
      </SEO>

      <p
        className="text-[11px] font-medium uppercase tracking-[0.28em] md:text-xs"
        style={{ color: GOLD }}
      >
        {t("book.eyebrow")}
      </p>

      {/* The single gold hairline the system allows: a rule, not a fill. */}
      <span
        aria-hidden
        className="mt-6 block h-px w-16"
        style={{ backgroundColor: GOLD }}
      />

      <h1
        className="mt-8 max-w-3xl text-4xl uppercase leading-[1.05] tracking-[0.04em] md:text-6xl lg:text-7xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("book.title")}
      </h1>

      <p
        className="mt-8 max-w-md text-sm leading-relaxed md:text-base"
        style={{ color: `${IVORY}b3` }}
      >
        {t("book.body")}
      </p>
    </main>
  );
};

export default Book;

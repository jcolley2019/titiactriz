import { useTranslation } from "react-i18next";

/**
 * SEO.TITIACTRIZ.NAME.1 — one plain-text paragraph under the hero: her name,
 * where she is based and her credit, as real visible copy. The hero is a
 * wordmark over video, and the acts after it are photographs and scrubbed
 * frames, so before this a reader (or a crawler that renders) found 35 words
 * of text on the whole first screen and no credit anywhere.
 *
 * The credit is the one `acting_credits` holds (El Casting, Mi Mundo de Roles),
 * Joey's pick over a [CREDITS] placeholder. index.html's static shell carries
 * the same hero.bio text in both languages for crawlers that run no JS; the
 * seo-name spec holds the two copies equal.
 *
 * Static on purpose: no reveal, no pin, no ScrollTrigger of its own. It sits
 * between the hero and the Events act and must never fight the opening, so it
 * is just type — the DESIGN.md Body step at the About paragraphs' ivory — on
 * the page's own ground. Its height changes with the language, which is why
 * HomeCinematic refreshes ScrollTrigger on a language switch.
 *
 * NAME.1a — the size lives in cinematic.css (`.cine-bio-text`): below 768 the
 * Body step's ceiling held fixed, from 768 up the fluid step.
 *
 * Not a `cinematic-section`: the e2e battery counts and indexes those as acts.
 */
const CinematicBio = () => {
  const { t } = useTranslation();

  return (
    <section data-qa="cinematic-bio" className="cine-safe-x relative py-24 md:py-32">
      <p
        data-qa="cinematic-bio-text"
        className="cine-bio-text mx-auto"
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 300,
          lineHeight: 1.7,
          color: "rgba(240,233,218,0.72)",
          maxWidth: "60ch",
        }}
      >
        {t("hero.bio")}
      </p>
    </section>
  );
};

export default CinematicBio;

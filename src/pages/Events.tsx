import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import EventsGrid from "@/components/events/EventsGrid";
import { useEventsBoard } from "@/hooks/useEventsBoard";

const CREAM = "#f0e9da";
const DARK = "#0e0c09";
const GOLD = "#C9A55C";

const editorialFontVars: React.CSSProperties = {
  ["--font-display" as never]: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  ["--font-sans" as never]: "'Jost', 'Outfit', system-ui, sans-serif",
  fontFamily: "var(--font-sans)",
};

/**
 * EVENTS.NAV.1 — the way out, and the phone's spacing.
 *
 * ## The back control
 *
 * The marquee lands a reader here from anywhere on the site, and until now the
 * only way back was the browser's own button or the nav's Inicio. The control
 * is the site's QUIETEST gold grammar — the eyebrow's `11px / 0.28em` caps in
 * `#C9A55C`, with a small arrow and no border — deliberately NOT the ghost CTA
 * (DESIGN.md Components: 1px gold border, 0.75rem/0.2em), because a way out
 * must not compete with the event's own buttons. It goes to `/` bare.
 *
 * At md and up it is lifted OUT OF FLOW (`md:absolute`), aligned to the same
 * centred column as the heading. That is not decoration: Joey ruled "the
 * spacing here look fine in desktop view", so the desktop composition must not
 * shift, and an in-flow control would push the whole page down by its own
 * height. On the phone it stays in flow above the heading, where there is no
 * horizontal room to float it beside a centred title.
 *
 * ## The phone's spacing
 *
 * Joey, on a 440x956 iPhone: "too much padding above EVENTS and between the
 * events and 'the latest i'm working on' and too much below that text between
 * that and the event card and More Events Coming Soon is cut off."
 *
 * Measured before the change, at 440x956: heading top 128, subtitle 189, card
 * 257, and the closing line at **979 — 23px past the 956 fold**, which is the
 * "cut off". Every gap below is therefore halved on the phone and left exactly
 * as it was from md up:
 *
 *   above the heading   5rem + safe-area (was 8rem, via .events-page-top)
 *   heading -> subtitle mb-2  (was mb-4)
 *   subtitle -> card     mb-6  (was mb-12)
 *   card -> closing line mt-6  (was mt-12)
 *
 * ## …and the second pass, because the phone still didn't fit
 *
 * That budget was measured HEADLESS, where `env(safe-area-inset-top)` is 0px
 * and no browser chrome overlays the fold — so the spec read 956 usable pixels
 * on a screen that in Joey's hand has ~811. On the device the whole page starts
 * ~59px lower (the header's inset, which `.events-page-top` carries too) and
 * Safari's floating bar covers the last ~86px. The poster ran under it.
 *
 * Joey's ruling: "MOVE EVENTS up along the same horizontal plane as the back
 * button and make it slightly smaller move it all up so that the fucking thing
 * fits on the phone screen."
 *
 * So on the phone — and ONLY on the phone, since "desktop view look fine" still
 * stands — the way out and the title share ONE band (back absolute at the left
 * edge, heading centred in the same row), the heading drops a step to `text-3xl`,
 * and what is left of the gaps closes:
 *
 *   back row + heading   one row   (was two, ~38px of it dead)
 *   heading              text-3xl  (was text-4xl)
 *   heading -> subtitle  mb-1      (was mb-2)
 *   subtitle -> card     mb-4      (was mb-6)
 *   card -> closing line mt-4      (was mt-6)
 *
 * ## …and then the subtitle went, and the act took the room
 *
 * Joey, dial in hand on the device: "lets remove the words 'The latest I'm
 * working on' and allow the top of the card to move up and occupy that space"
 * — then, once he had seen it: "Restore … on desktop/tablet only — phone stays
 * without it."
 *
 * So the line is `hidden md:block`. On the phone the heading hands straight to
 * the card and the poster keeps the ~24px. From md up nothing about the page
 * moved at all: the same stack, the same 8rem offset, the same 1024x738 frame.
 * `events.intro` was never going to be deleted either way — the cinematic act's
 * Room speaks the same key, and ES/EN parity is a law.
 *
 * The rest of the fit is the poster's own cap, in EventCard — see
 * PHONE_ROOM_MAX_H there. The law that judges all of it now reserves the
 * device's chrome instead of pretending the headless fold is the real one.
 */
const Events = () => {
  const { t, i18n } = useTranslation();
  const { board, loading } = useEventsBoard();
  const lang = (i18n.language || "es").startsWith("en") ? "en" : "es";
  const title =
    lang === "en"
      ? "Events | Cristyna Polentino"
      : "Eventos | Cristyna Polentino";
  const description =
    lang === "en"
      ? "Cristyna Polentino is competing in SmartFilms Colombia 2026, the world's largest cellphone-film festival. Theme: retro-futurism."
      : "Cristyna Polentino compite en SmartFilms Colombia 2026, el festival de cine hecho con celular más grande del mundo. Temática: retrofuturismo.";

  const hasItems = board.items.length > 0;
  const showGrid = !loading && board.pageVisible && hasItems;
  const showMore =
    !loading && (!board.pageVisible || !hasItems || showGrid);

  return (
    <main
      data-qa="events-page"
      className="events-page-top relative min-h-screen pb-24 px-4"
      style={{ ...editorialFontVars, backgroundColor: DARK, color: CREAM }}
    >
      <SEO path="/events" title={title} description={description} />

      <div className="max-w-3xl mx-auto text-center mb-4 md:mb-12">
        {/* The phone's one row: the way out pinned to the left edge, the title
            centred in the same band. `md:static` hands the control back to the
            page at md and up, where it goes out of flow into the ratified
            `top-24` slot — an in-flow control there would push Joey's approved
            desktop composition down by its own height. `text-left` because the
            band is centred and the control is not. */}
        <div className="relative md:static mb-1 md:mb-4">
          <div className="absolute inset-y-0 left-0 flex items-center text-left md:inset-y-auto md:top-24 md:inset-x-0 md:block md:px-4">
            <div className="md:mx-auto md:max-w-3xl">
              <Link
                to="/"
                data-qa="events-back"
                className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] transition-colors duration-300 hover:text-gold-light"
                style={{ color: GOLD }}
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                {t("common.back")}
              </Link>
            </div>
          </div>

          <h1
            data-qa="events-title"
            className="text-3xl md:text-5xl lg:text-6xl leading-tight"
            style={{ fontFamily: "var(--font-display)", color: CREAM }}
          >
            {t("events.title")}
          </h1>
        </div>
        {/* The subtitle keeps its desk and loses its seat on the phone: Joey
            ruled it off the small screen so the card could take the room, then
            "Restore … on desktop/tablet only — phone stays without it." It is
            `hidden` below md, which also returns the desktop composition to the
            exact ratified stack (heading, mb-4, this line, mb-12, card). */}
        <p
          data-qa="events-intro"
          className="hidden md:block text-sm md:text-base"
          style={{ color: `${CREAM}cc`, fontFamily: "var(--font-sans)" }}
        >
          {t("events.intro")}
        </p>
      </div>

      {/* EVENTS.NAV.1 — the portrait column. A portrait tablet gave the card a
          992x738 frame: wider than tall, with the poster stranded in the middle
          of it. Narrowing the column at `md:portrait:` turns the frame upright
          and the card's own `fillPortrait` lets the art grow into the height
          that screen actually has. Landscape and desktop never match the query,
          so both keep the ratified 1024-wide composition exactly. */}
      {showGrid && (
        <div className="md:portrait:mx-auto md:portrait:max-w-2xl">
          <EventsGrid items={board.items} fillPortrait />
        </div>
      )}

      {showMore && (
        <p
          data-qa="events-more"
          className="text-center mt-4 md:mt-12 text-xs md:text-sm uppercase tracking-[0.25em]"
          style={{ color: `${CREAM}80`, fontFamily: "var(--font-sans)" }}
        >
          {t("events.more")}
        </p>
      )}
    </main>
  );
};

export default Events;

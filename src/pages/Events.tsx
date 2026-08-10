import { useEffect, useRef, useState } from "react";
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
 *
 * ## EVENTS.SNAP.1 — the arrival frame, measured and published
 *
 * A portrait board of two or more cards gives each card a screen of its own and
 * snaps, so every card comes to rest in the frame the FIRST card arrives in.
 * That frame is not the middle of the viewport — the heading band sits above
 * it. Measured on a 1-card board: the card's top is 126px down on both phones,
 * 264 at 820x1180, 276 at 1024x1366. Centring the cards in the viewport instead
 * would yank card 1 out of its own arrival framing by 14px on the phone and
 * 142px on the tablet the moment the reader first scrolled.
 *
 * So the page measures the band above the grid and publishes it as
 * `--events-snap-top`; each cell snaps to `start` with that as its scroll
 * margin (EventsGrid). Card 1's snap position works out to scrollY 0 — the
 * arrival position exactly — and every later card lands in the same frame.
 *
 * The band is measured, never hardcoded: it moves with the locale's heading
 * wrap, the font landing, and `env(safe-area-inset-top)` on a notched phone.
 *
 * The snap TYPE lives on the document element (`html.events-snap`, index.css)
 * because that is the scroller. It is added on mount and removed on unmount, so
 * it can never reach the cinematic home — the one route where Lenis owns the
 * wheel and a second scroll authority would fight it. Nothing here touches
 * src/lib/smoothScroll.ts: /events registers no driver and the banner never
 * issues a scroll on this page (it finds no lit act and navigates instead).
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

  /**
   * EVENTS.SNAP.1 — one card is already one-per-screen, and its composition is
   * ratified to the pixel (events-nav.spec.ts holds the whole act inside the
   * phone's first screen). The snap layout is therefore a MULTI-card behaviour
   * only: a single-card board renders byte-for-byte as it did.
   */
  const snapping = showGrid && board.items.length > 1;

  const headerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [snapTop, setSnapTop] = useState(0);

  /**
   * ARM THE SNAP ONLY ONCE THE BAND IS KNOWN.
   *
   * This gate is not defensive tidiness — without it the page loads scrolled.
   * On the first render the band is still 0, so a cell's snap position is its
   * own raw top (126px down on a phone); the browser obeys immediately, scrolls
   * there, and the heading and the way out are gone before the reader has
   * touched anything. Caught in the rendered evidence, not in the numbers: every
   * measurement is in DOCUMENT coordinates and reads identically whether or not
   * the page has jumped.
   *
   * With the band published first, card 1's snap position works out to scrollY 0
   * and arming changes nothing about where the page sits.
   */
  const armed = snapping && snapTop > 0;

  /**
   * The band above the first card, in document pixels — the grid's own top, so
   * the margin between the heading block and the card is inside the number.
   *
   * Watching the HEADER alone is not enough, and the first cut of this was
   * measurably wrong because of it: at 1024x1366 the grid starts at 291 and
   * settles at 276 once the marquee's spacer and the display font have landed.
   * Those move the grid without changing the header's own box by a pixel, so a
   * header-only observer never fires and the published band stays 15px stale —
   * every card after the first then rests 15px below the frame card 1 arrives
   * in, which is the one thing this number exists to prevent.
   *
   * So the observer watches `document.body`: anything above the grid that grows,
   * lands, or disappears changes the body's box. Publishing a new band changes
   * the cells' `min-height` and therefore the body too, but that feeds back
   * exactly once — the grid's TOP is unmoved by its children's height, so the
   * second pass measures the same number and React drops the re-render. The rAF
   * throttle collapses the burst and keeps the observer out of its own loop
   * warning.
   */
  useEffect(() => {
    if (!snapping) return;
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setSnapTop(Math.round(grid.getBoundingClientRect().top + window.scrollY)),
      );
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    if (headerRef.current) ro.observe(headerRef.current);
    // The display font swapping in re-wraps the heading under the grid.
    void document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [snapping, i18n.language]);

  /**
   * The snap type belongs on the scroller, which is the document element — a
   * `scroll-snap-type` on any inner div would do nothing. Scoped to a class this
   * page owns, and removed on unmount so no other route inherits it.
   *
   * `proximity`, deliberately, and the same under prefers-reduced-motion: it is
   * the least coercive snap that still lands the frame. `mandatory` would refuse
   * to leave a card half-scrolled, which traps a reader mid-gesture and can hide
   * the closing line entirely; proximity only tidies a scroll that has already
   * come to rest near a card, so momentum, a keyboard, and a screen reader all
   * still reach every card and the content below them.
   */
  useEffect(() => {
    if (!armed) return;
    const root = document.documentElement;
    root.classList.add("events-snap");
    return () => root.classList.remove("events-snap");
  }, [armed]);

  return (
    <main
      data-qa="events-page"
      className="events-page-top relative min-h-screen pb-24 px-4"
      style={{ ...editorialFontVars, backgroundColor: DARK, color: CREAM }}
    >
      <SEO path="/events" title={title} description={description} />

      <div ref={headerRef} className="max-w-3xl mx-auto text-center mb-4 md:mb-12">
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
        <div
          ref={gridRef}
          className="md:portrait:mx-auto md:portrait:max-w-2xl"
          style={
            armed
              ? ({ ["--events-snap-top" as never]: `${snapTop}px` } as React.CSSProperties)
              : undefined
          }
        >
          <EventsGrid items={board.items} fillPortrait snap={armed} />
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

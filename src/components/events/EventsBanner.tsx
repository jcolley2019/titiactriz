import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useEventsBoard, type PageBanner } from "@/hooks/useEventsBoard";
import { scrollElementToTop } from "@/lib/smoothScroll";

const DISMISS_PREFIX = "eventsBannerDismissed:";

/**
 * BANNER.EVENTS.1 — the LIT Events act, wherever it happens to be standing.
 *
 * The act is always in the DOM (its late-mount law: a section that arrives after
 * a later act has pinned crashes React's insertBefore), but it renders as a bare
 * `data-empty` marker when it is dark. So "is the events story on this page?" is
 * one selector, asked of the DOM at the moment it matters — never inferred from
 * the flag, the board and the pathname a second time. That is what makes the
 * click rule below true on EVERY home variant without naming any of them: the
 * cinematic home carries the act and scrolls to it; the editorial and classic
 * homes carry no act, find nothing, and go to /events like every subpage.
 */
const LIT_ACT = '[data-qa="cinematic-events"]:not([data-empty])';

/** The bar's own height. The spacer below reserves exactly this much flow. */
const BANNER_H = 38;

/**
 * MARQUEE.1 — the chrome block, and why this component measures the header.
 *
 * The banner used to be pinned at a HARDCODED `top-[60px] md:top-[68px]`. The
 * header is not that tall: measured on the live board it is 75px at 1440, 70px
 * at 768 and 70px at 390 — so the bar's first 7 / 2 / 10 pixels, INCLUDING its
 * 2px gold top hairline, sat underneath the z-50 header. Over the transparent
 * landing header you could still see the line; the moment the header took its
 * scrolled ground (rgba(11,10,8,0.95)) the line vanished. That is defect (2),
 * "the line on the top that boxes the marquee disappears when you scroll down".
 *
 * A guessed offset cannot be right at every width, in both languages, with a
 * safe-area inset on the phone — so the number is MEASURED, not written down.
 * The chrome is one fixed block anchored at the top of the viewport: a ground
 * exactly as tall as the header, then the bar. The bar's top edge is therefore
 * the header's bottom edge by construction, and its hairlines are always its
 * own — never borrowed from the nav, never hidden under it.
 *
 * ## The nav ground, and the seam it removes (defect 1)
 *
 * Joey: "half the nav bar is showing the top of the video and the top half of
 * it is dark you can see the line with the navbar text."
 *
 * The cause was NOT a nav backdrop that stops short — on the cinematic home
 * the nav has no backdrop at all (NAV.CLEAR.1 keeps it transparent over the
 * hero). It was THIS component's spacer: 38px of dark app ground, in flow, as
 * the first child of the page column, pushing the hero down to y=38 while the
 * transparent nav spans 0-75. Through the nav you saw dark ground above y=38
 * and hero video below it — a hard line straight across the nav's text row
 * (measured: the links occupy y=30-46).
 *
 * So the block paints a ground behind the nav for exactly as long as the
 * banner exists. The nav's full content box is covered, the seam has nowhere
 * to fall, and dismissing the banner takes the ground away with it — which
 * restores NAV.CLEAR.1's transparent nav over a hero that once again starts at
 * y=0, with no spacer and therefore no seam either. Every state is coherent:
 * landing, mid-scroll, banner present, banner dismissed.
 *
 * The ground is skipped on Green World and Titans, whose headers are opaque by
 * design and would hide it anyway.
 */
const CHROME_GROUND = "#0b0a08";

/**
 * MARQUEE.1 STEP 3 — the track runs at a CONSTANT speed, in pixels per second,
 * instead of a constant 180s duration. A fixed duration means the speed is
 * whatever the message length and repeat count happen to make it: the same
 * animation crawled at 390px, where one message fills the window and the reader
 * waits out the whole of it, and read fine at 1440 where four are on screen at
 * once. Duration is now derived from the measured track length, so a phone and
 * a desktop move at the same legible rate.
 */
const MARQUEE_SPEED = 48; // px/s
/** Fallback repeat count for the first paint, before the segment is measured. */
const MARQUEE_REPEAT = 10;

/**
 * MARQUEE.1 STEP 2 — the site's own breakpoint grammar, not a new one.
 * NAV.FIT.1 ratified 1200px as this site's desktop boundary (the header's three
 * navs switch there). "Tablet and below" is therefore everything under 1200:
 * the pinned end caps collapse and the whole message — label and text, diamond
 * separated — scrolls as one track. At 1200 and up the caps stay pinned and
 * only the centre scrolls, exactly as before.
 */
const DESKTOP_MIN = 1200;

/** The edge fade. Words dissolve at the track's ends instead of being sliced. */
const FADE = 18;
/** On one track the dismiss button overhangs the text, so its edge fades wider. */
const FADE_UNDER_X = 46;

const hashText = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

type SchemeKey = "main" | "greenWorld" | "titans";

type Scheme = { bg: string; border: string; label: string; accent: string; text: string };

const SCHEMES: Record<SchemeKey, Scheme> = {
  main:       { bg: "#0a0a0a", border: "#C9A55C",     label: "#F0D78C", accent: "#C9A55C", text: "#C9A55C" },
  greenWorld: { bg: "#128A5E", border: "#FFFFFF",     label: "#FFFFFF", accent: "#FFFFFF", text: "#FFFFFF" },
  titans:     { bg: "#841F1F", border: "transparent", label: "#FFFFFF", accent: "#FFE3E3", text: "#FFFFFF" },
};

const EventsBanner = () => {
  const { board, loading } = useEventsBoard();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const activeLang: "es" | "en" = (i18n.language || "es").startsWith("es") ? "es" : "en";
  const fallbackLang: "es" | "en" = activeLang === "es" ? "en" : "es";

  const pageKey: "home" | "greenWorld" | "titans" =
    location.pathname.startsWith("/green-world")
      ? "greenWorld"
      : location.pathname.startsWith("/titans-agency")
        ? "titans"
        : "home";

  const textOf = (b?: PageBanner): string =>
    (b?.text?.[activeLang] ?? "").trim() || (b?.text?.[fallbackLang] ?? "").trim();
  const labelOf = (b?: PageBanner): string =>
    (b?.label?.[activeLang] ?? "").trim() ||
    (b?.label?.[fallbackLang] ?? "").trim() ||
    t("events.title");
  const isOn = (b: PageBanner | undefined, key: "home" | "greenWorld" | "titans"): boolean =>
    !!b && b.enabled && !!b.pages?.[key] && !!textOf(b);

  const banners = board
    ? { main: board.mainBanner, greenWorld: board.greenWorldBanner, titans: board.titansBanner }
    : null;

  let activeKey: SchemeKey | null = null;
  if (banners) {
    if (pageKey === "greenWorld" && isOn(banners.greenWorld, "greenWorld")) {
      activeKey = "greenWorld";
    } else if (pageKey === "titans" && isOn(banners.titans, "titans")) {
      activeKey = "titans";
    } else {
      for (const k of ["greenWorld", "titans", "main"] as SchemeKey[]) {
        if (isOn(banners[k], pageKey)) { activeKey = k; break; }
      }
    }
  }

  const activeBanner = banners && activeKey ? banners[activeKey] : null;
  const scheme = SCHEMES[pageKey === "greenWorld" ? "greenWorld" : pageKey === "titans" ? "titans" : "main"];
  const bannerText = activeBanner ? textOf(activeBanner) : "";
  const label = activeBanner ? labelOf(activeBanner) : t("events.title");
  const textColor = scheme.text;
  const marqueeWeight = activeBanner?.bold ? 700 : 400;

  const dismissKey = bannerText ? DISMISS_PREFIX + hashText(bannerText) : "";

  const [dismissed, setDismissed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  /** Under 1200: one track, no caps. See DESKTOP_MIN. */
  const [compact, setCompact] = useState(false);
  /** The header's MEASURED height — the bar's top edge. Never a literal. */
  const [headerH, setHeaderH] = useState(0);
  /** One segment's measured width, which sets both repeat count and duration. */
  const [segW, setSegW] = useState(0);
  const [viewportW, setViewportW] = useState(0);
  /** The lit Events act on THIS page, or null where there is none. */
  const [actEl, setActEl] = useState<Element | null>(null);
  /** The act is on screen: the bar yields the frame to it. See the note below. */
  const [actOnScreen, setActOnScreen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dismissKey) { setDismissed(false); return; }
    try { setDismissed(localStorage.getItem(dismissKey) === "1"); }
    catch { setDismissed(false); }
  }, [dismissKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${DESKTOP_MIN - 1}px)`);
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  /**
   * Measure the header. A layout effect so the very first paint already has the
   * real number, and a ResizeObserver because the height changes with the
   * breakpoint (75 at desktop, 70 below), with the safe-area inset on a
   * notched phone, and with Green World's extra bottom border.
   */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const header = document.querySelector("header");
    if (!header) return;
    const measure = () => {
      const h = header.getBoundingClientRect().height;
      setHeaderH((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [loading, dismissed, bannerText]);

  /**
   * Measure ONE segment and the window. Everything the track needs follows from
   * those two numbers: how many copies cover the window (so the -50% loop never
   * shows its end), and how long one period should take at a constant speed.
   */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const measure = () => {
      setViewportW(window.innerWidth);
      const first = trackRef.current?.firstElementChild as HTMLElement | null;
      if (!first) return;
      const w = first.getBoundingClientRect().width;
      setSegW((prev) => (w > 0 && Math.abs(prev - w) > 1 ? w : prev));
    };
    measure();
    const first = trackRef.current?.firstElementChild;
    const ro = new ResizeObserver(measure);
    if (first) ro.observe(first);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [bannerText, label, compact, reducedMotion, dismissed]);

  /**
   * BANNER.EVENTS.1 — track the lit act across the page's whole life, not just
   * its first paint. The act lights AFTER the board fetch resolves and can go
   * dark again while the page is open (the board is realtime-subscribed, so the
   * owner's "Mostrar eventos en portada" toggle lands live), and a route change
   * swaps the page under a component that never unmounts — this one is mounted
   * in App, above the router. One querySelector on childList mutations is the
   * cheapest honest answer: GSAP animates STYLE attributes, which this observer
   * is not asking for, so it stays quiet through every act's scrub.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => {
      const found = document.querySelector(LIT_ACT);
      setActEl((prev) => (prev === found ? prev : found));
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [location.pathname, loading]);

  /**
   * BANNER.EVENTS.1 STEP 2 — the yield. Owner ruling, verbatim: "I want the
   * banner to be active on the hero page and then when you scroll down to the
   * events page it fades and disappears then as you pass the events page it
   * reappears."
   *
   * So the bar is not suppressed on home any more — it is DEFERENTIAL. It says
   * its line from the hero down, steps aside for exactly as long as the act it
   * advertises holds the frame (the observed section spans the pin-spacer, so
   * the yield covers the whole +=120% dwell), and comes back for everything
   * below. The banner never says the same thing the act is already saying, and
   * a reader who scrolls past still has the way back.
   *
   * Opacity only: the flow spacer stays put in every state, so nothing under the
   * chrome moves when the bar goes or returns.
   */
  useEffect(() => {
    if (!actEl || typeof IntersectionObserver === "undefined") {
      setActOnScreen(false);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setActOnScreen(entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(actEl);
    return () => io.disconnect();
  }, [actEl]);

  if (loading) return null;
  if (!board?.pageVisible) return null;
  if (!bannerText) return null;
  if (location.pathname.startsWith("/events")) return null;
  if (dismissed) return null;

  // BANNER.EVENTS.1 STEP 1 — the EVENTS.2b home suppression is GONE. It read
  // the flag, the owner's homeVisible switch and the card count to decide the
  // home page should not carry a marquee at all while the act was lit. The
  // owner reversed that division of labor, verbatim: "I wanted the banner to
  // show and when someone clicks it on the home page it scrolls down to the
  // events section on the cinematic page. on the other pages it can lead the
  // viewer to that page." The bar now shows on every page its board allows —
  // home included, act lit or dark — and yields only in the moment the act is
  // actually on screen (the IntersectionObserver above), which is the ONLY
  // moment the two ever said the same thing twice.

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try { if (dismissKey) localStorage.setItem(dismissKey, "1"); } catch {}
    setDismissed(true);
  };

  /**
   * BANNER.EVENTS.1 STEP 2/3 — one click, three outcomes, in this order:
   *
   *   1. The owner's custom link WINS wherever it is set — unchanged. It is the
   *      admin's explicit override of everything below it, external or internal.
   *   2. This page carries the lit act → travel to it, up or down. Verbatim:
   *      "whenever a view clicks the banner/marquee while on the cinematic page
   *      it should automatically scroll up or down to the events section. that
   *      banner is an immediate scroll to that page section." Asked of the DOM,
   *      so it is true on the cinematic home and false on the editorial and
   *      classic ones without this component knowing a single variant's name.
   *   3. Otherwise → /events, exactly as today. Verbatim: "On the other pages,
   *      the editorial and the classic web pages, when that banner is clicked it
   *      keeps the current behavior and takes the viewer to the /events page and
   *      then to return to the main site again they click <-Back."
   *
   * The travel goes through the page's registered scroller (Lenis on the
   * cinematic home) so it never races the smooth scroll that owns the wheel, and
   * lands on the act's own pin start — see src/lib/smoothScroll.ts. Under
   * prefers-reduced-motion it is a jump, not a glide.
   */
  const goTo = () => {
    const link = (activeBanner?.link ?? "").trim();
    if (link) {
      if (/^https?:\/\//i.test(link)) {
        window.open(link, "_blank", "noopener,noreferrer");
        return;
      }
      navigate(link.startsWith("/") ? link : `/${link}`);
      return;
    }
    const act = document.querySelector(LIT_ACT);
    if (act) {
      scrollElementToTop(act, reducedMotion);
      return;
    }
    navigate("/events");
  };

  const Separator = () => (
    <span aria-hidden className="mx-6 text-[10px]" style={{ color: `${textColor}b3` }}>◆</span>
  );

  /**
   * One segment of the track. Below 1200 it carries the LABEL as well, because
   * the pinned caps that used to hold it are gone — the whole message travels
   * as one diamond-separated run.
   */
  const renderSegment = (key: string) => (
    <div key={key} data-qa="events-banner-segment" className="flex items-center shrink-0 pr-2">
      {compact && (
        <>
          <span
            className="text-[11px] font-semibold tracking-[0.28em] uppercase whitespace-nowrap leading-none translate-y-[1px]"
            style={{ fontFamily: "Cinzel, serif", color: scheme.label }}
          >
            {label}
          </span>
          <Separator />
        </>
      )}
      <span
        className="text-[11px] tracking-[0.22em] uppercase whitespace-nowrap leading-none translate-y-[1px]"
        style={{ fontFamily: "Jost, sans-serif", color: textColor, fontWeight: marqueeWeight }}
      >
        {bannerText}
      </span>
      <Separator />
    </div>
  );

  // How many copies cover the window, doubled so translating -50% lands on an
  // identical frame. Measured, so a 390px phone carries a handful of segments
  // instead of the twenty a desktop needs.
  const repeat =
    segW > 0 && viewportW > 0
      ? Math.max(2, Math.ceil((viewportW + 240) / segW))
      : MARQUEE_REPEAT;
  const period = segW * repeat; // one loop's travel, in px
  const duration = period > 0 ? period / MARQUEE_SPEED : 180;

  // The fade that stops a word being guillotined at the track's edge — at the
  // caps on desktop, and under the dismiss button when the track runs full
  // width. `mask-image` needs the -webkit- prefix for iOS Safari, which is the
  // physical test device.
  const rightFade = compact ? FADE_UNDER_X : FADE;
  const fadeMask =
    `linear-gradient(to right, transparent 0, #000 ${FADE}px,` +
    ` #000 calc(100% - ${rightFade}px), transparent 100%)`;

  return (
    <>
      {/* Flow spacer: reserves the BAR's height so page content clears it. The
          ground above the bar needs none — it stands behind the header, which
          was already fixed and which every page already pads for. */}
      <div aria-hidden className="w-full" style={{ height: BANNER_H }} />

      {/* The chrome block: ground + bar, anchored to the top of the viewport.
          Below the header in the stack (z-40 vs z-50) so the nav's own ground,
          its links and the mobile sheet all paint over it. */}
      {/* `left-0 right-0` rather than `w-screen`: the viewport width minus any
          scrollbar, so the block can never be the source of a horizontal
          overflow the site's guard would have to chase. */}
      {/* The yield (STEP 2): while the act holds the frame the chrome fades out
          and stops taking clicks, then returns below it. Opacity only — the
          flow spacer above never moves, so nothing on the page shifts either
          way. Under reduced motion it is a cut, not a dissolve. */}
      <div
        data-qa="events-chrome"
        data-yielded={actOnScreen ? "true" : undefined}
        aria-hidden={actOnScreen || undefined}
        className="fixed left-0 right-0 top-0 z-40"
        style={{
          opacity: actOnScreen ? 0 : 1,
          pointerEvents: actOnScreen ? "none" : undefined,
          transition: reducedMotion ? undefined : "opacity 320ms ease",
        }}
      >
        {/* The nav ground — see the note at the top of this file. Skipped where
            the header is opaque by design and would cover it anyway. */}
        {pageKey === "home" && (
          <div
            aria-hidden
            data-qa="events-banner-navground"
            className="pointer-events-none w-full"
            style={{ height: headerH, backgroundColor: CHROME_GROUND }}
          />
        )}
        {pageKey !== "home" && <div aria-hidden className="w-full" style={{ height: headerH }} />}

        <div
          role="region"
          aria-label={label}
          data-qa="events-banner"
          className="w-full select-none overflow-x-hidden border-y-2"
          style={{ height: BANNER_H, backgroundColor: scheme.bg, borderColor: scheme.border }}
        >
          <div className="relative h-full flex items-stretch">
            {/* The pinned caps — desktop only (NAV.FIT.1's 1200px boundary).
                Below that their text rides in the track instead. */}
            <button
              type="button"
              onClick={goTo}
              data-qa="events-banner-cap"
              className="hidden min-[1200px]:flex shrink-0 h-full items-center px-4 border-r text-[11px] font-semibold tracking-[0.28em] uppercase leading-none transition-colors hover:bg-white/5"
              style={{ fontFamily: "Cinzel, serif", color: scheme.label, borderColor: scheme.border }}
            >
              <span className="translate-y-[1px]">{label}</span>
            </button>

            <button
              type="button"
              onClick={goTo}
              aria-label={label}
              data-qa="events-banner-window"
              className="flex-1 h-full overflow-hidden relative text-left cursor-pointer"
              style={{ maskImage: fadeMask, WebkitMaskImage: fadeMask }}
            >
              {reducedMotion ? (
                <div className="h-full flex items-center px-4">
                  <span
                    className="truncate text-[11px] tracking-[0.22em] uppercase leading-none translate-y-[1px]"
                    style={{ fontFamily: "Jost, sans-serif", color: textColor, fontWeight: marqueeWeight }}
                  >
                    {compact ? `${label} ◆ ${bannerText}` : bannerText}
                  </span>
                </div>
              ) : (
                <div
                  ref={trackRef}
                  data-qa="events-banner-track"
                  data-duration={Math.round(duration)}
                  className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap will-change-transform"
                  style={{
                    animation: `events-banner-marquee ${duration}s linear infinite`,
                    paddingLeft: "1rem",
                  }}
                >
                  {Array.from({ length: repeat * 2 }).map((_, i) => renderSegment(`seg-${i}`))}
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={goTo}
              aria-label={label}
              data-qa="events-banner-cap"
              className="hidden min-[1200px]:flex shrink-0 h-full items-center px-4 border-l text-[11px] font-semibold tracking-[0.28em] uppercase leading-none transition-colors hover:bg-white/5"
              style={{ fontFamily: "Cinzel, serif", color: scheme.label, borderColor: scheme.border }}
            >
              <span className="translate-y-[1px]">{label}</span>
            </button>

            {/* The dismiss control floats above the track and keeps a 44px
                target at every width — the track fades out beneath it rather
                than sliding words under a button. */}
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss"
              data-qa="events-banner-dismiss"
              className="absolute right-0 top-0 z-10 flex h-full min-w-11 items-center justify-center px-3 transition-colors hover:bg-white/5 min-[1200px]:relative min-[1200px]:z-auto min-[1200px]:min-w-0 min-[1200px]:shrink-0"
              style={{ color: `${textColor}b3`, borderColor: scheme.border }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EventsBanner;

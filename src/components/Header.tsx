import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Lock, LayoutDashboard, LogOut, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setLanguage } from "@/i18n";
import LanguageToggle from "./LanguageToggle";
import { useEventsBoard } from "@/hooks/useEventsBoard";
import { TITANS_ENABLED, TITILINKS_URL } from "@/lib/ventures";
import monogram from "@/assets/cp-monogram-transparent.png";
import monogramTwoTone from "@/assets/cp-monogram-twotone.png";

/**
 * TL.LIVE.1 — `external` marks a destination that is NOT a route of this site.
 * The three navs render it as a plain <a target="_blank"> wearing the same
 * classes as their <Link>s, so it reads and behaves like every other nav entry
 * while still leaving the SPA correctly.
 */
type NavLink = {
  name: string;
  path: string;
  noTranslate?: boolean;
  external?: boolean;
  /** Stable spec hook, so a test names the destination rather than its position. */
  qa?: string;
};

const Header = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  // REVIEW.2b — on the cinematic home the nav is transparent only over the
  // hero; past ~80vh it takes the site's near-black ground so content passes
  // beneath it without glyph collisions.
  const [pastHero, setPastHero] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  // NAV.SOON.1 — the "coming soon" disclosure. A child with `path: null` is an
  // announcement, not a destination — rendered inert rather than as a dead link
  // a reader can click into a 404. Book shipped (BOOK.0) and carries its route;
  // TitiLinks got its destination on TL.LIVE.1 and has LEFT this disclosure —
  // it is a shipped product, not an announcement, so it is an ordinary nav link
  // in all three navs now. Book is the disclosure's remaining child.
  const [soonOpen, setSoonOpen] = useState(false);
  const soonRef = useRef<HTMLLIElement>(null);
  const { board } = useEventsBoard();
  const eventsVisible = !!board?.pageVisible;
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isEn = i18n.language?.startsWith("en");
  const setLang = (lng: "es" | "en") => setLanguage(lng);
  const closeMenu = () => setIsMobileMenuOpen(false);
  const handleAdmin = () => {
    closeMenu();
    navigate("/admin");
  };
  const handleSignOut = async () => {
    closeMenu();
    await supabase.auth.signOut();
    navigate("/");
  };

  // `noTranslate` marks brand proper nouns (Green World / Titans Agency) so
  // browser auto-translate leaves them intact.
  // TITANS.OFF.1 — the Titans entry is spread in only while the venture is
  // live, so the nav closes up rather than leaving a hole where it was.
  // TL.LIVE.1 — TitiLinks joins the LEFT rail, the slot the coming-soon
  // disclosure already occupies, so the bar's left/right balance is the one
  // NAV.FIT.1 ratified rather than a new one.
  const leftLinks: NavLink[] = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.greenWorld"), path: "/green-world", noTranslate: true },
    ...(TITANS_ENABLED
      ? [{ name: t("nav.titansAgency"), path: "/titans-agency", noTranslate: true }]
      : []),
    {
      name: t("nav.titilinks"),
      path: TITILINKS_URL,
      noTranslate: true,
      external: true,
      qa: "nav-titilinks",
    },
  ];
  const rightLinks: NavLink[] = [
    { name: t("nav.portfolio"), path: "/work" },
    { name: t("nav.socials"), path: "/socials" },
    { name: t("nav.contact"), path: "/#contact" },
  ];

  // NAV.FIT.1 (Joey's 7/31 ruling) — inline links for the 768–1199 band ONLY.
  // The phone bar is logo + hamburger, nothing inline; Portafolio is surfaced
  // inline in the band; Events joins when the board is visible.
  const bandInlineLinks: NavLink[] = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.greenWorld"), path: "/green-world", noTranslate: true },
    ...(TITANS_ENABLED
      ? [{ name: t("nav.titansShort", "Titans"), path: "/titans-agency", noTranslate: true }]
      : []),
    { name: t("nav.portfolio"), path: "/work" },
    // TL.LIVE.1 — the band carries it too; Joey's verification list names
    // "tablet inline" explicitly, so the live product is not allowed to be the
    // one destination this breakpoint cannot reach without opening the sheet.
    {
      name: t("nav.titilinks"),
      path: TITILINKS_URL,
      noTranslate: true,
      external: true,
      qa: "nav-band-titilinks",
    },
  ];
  if (eventsVisible) {
    bandInlineLinks.push({ name: t("nav.events", "Events"), path: "/events" });
  }

  // NAV.FIT.1 — the sheet is the phone's WHOLE nav, so below md it lists every
  // destination. In the 768–1199 band the inline bar already carries the
  // `phoneOnly` entries, so those hide at md+ instead of duplicating.
  const sheetLinks: (NavLink & { phoneOnly?: boolean })[] = [
    { name: t("nav.home"), path: "/", phoneOnly: true },
    { name: t("nav.greenWorld"), path: "/green-world", noTranslate: true, phoneOnly: true },
    ...(TITANS_ENABLED
      ? [{ name: t("nav.titansAgency"), path: "/titans-agency", noTranslate: true, phoneOnly: true }]
      : []),
    ...(eventsVisible ? [{ name: t("nav.events", "Events"), path: "/events", phoneOnly: true }] : []),
    { name: t("nav.portfolio"), path: "/work", phoneOnly: true },
    // TL.LIVE.1 — `phoneOnly` because the band's inline bar now carries it, so
    // above md the sheet would otherwise list it twice.
    {
      name: t("nav.titilinks"),
      path: TITILINKS_URL,
      noTranslate: true,
      external: true,
      phoneOnly: true,
      qa: "nav-sheet-titilinks",
    },
    { name: t("nav.socials"), path: "/socials" },
    { name: t("nav.contact"), path: "/#contact" },
  ];

  const isTitansPage = location.pathname === "/titans-agency";
  const isGreenWorldPage = location.pathname === "/green-world";
  // NAV.CLEAR.1, amended by REVIEW.2b — on the cinematic surface the header is
  // transparent only over the HERO, where a bar would cut a lid across the
  // opening picture. Past ~80vh (the pastHero threshold) it grounds on the
  // site's near-black so the acts' type and ornaments pass beneath it instead
  // of colliding with the glyphs; the 700ms header transition makes the switch
  // a fade, not a pop. Scoped to this route on purpose — the ordinary pages
  // keep their own scrolled fill.
  const isCinematicHome = location.pathname === "/" || location.pathname === "/cinematic";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      setPastHero(window.scrollY > window.innerHeight * 0.8);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Dismiss the disclosure on an outside pointer or on Escape. Both are wired
  // only while it is open, so the closed state costs nothing.
  useEffect(() => {
    if (!soonOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!soonRef.current?.contains(e.target as Node)) setSoonOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSoonOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [soonOpen]);

  // Route changes must not leave the panel hanging open over the new page.
  useEffect(() => setSoonOpen(false), [location.pathname]);

  /**
   * The disclosure's children. `path: null` means "announced, not yet built".
   *
   * TL.LIVE.1 — TitiLinks left this list when it shipped. Book is what remains,
   * and it stays here rather than being promoted alongside it: the book act is a
   * coming-soon teaser until written publisher clearance (DESIGN.md publisher
   * law), so "coming soon" is the true label for it and the disclosure is still
   * doing its one job. The inert `path: null` branch below is kept for the next
   * announcement, not for a current member.
   */
  const soonItems: { name: string; path: string | null; qa: string }[] = [
    { name: t("nav.book"), path: "/book", qa: "book" },
  ];

  const handleNavClick = (path: string) => {
    setIsMobileMenuOpen(false);
    if (path.includes("#")) {
      const [pagePath, hash] = path.split("#");
      if (location.pathname === pagePath || pagePath === "/") {
        const element = document.getElementById(hash);
        element?.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  // NAV.CLEAR.1 — with no bar behind it, the nav has to survive whatever act is
  // under it: near-black at the hero, near-WHITE at Green World. A halo on the
  // glyphs does that at zero cost to the picture, where any panel or fill would
  // be the very lid the transparent header exists to remove. Applied only where
  // the header is transparent over moving art.
  const navHalo = isCinematicHome
    ? { textShadow: "0 1px 2px rgba(11,10,8,0.75), 0 2px 10px rgba(11,10,8,0.65)" }
    : undefined;

  // 13px at lg is the ratified Nav-label step (DESIGN.md Typography), not an
  // off-ramp literal: the nav must stay legible with no bar behind it.
  const linkBase =
    `text-xs lg:text-[13px] uppercase ${isGreenWorldPage ? "font-semibold" : "font-light"} leading-none link-underline transition-all duration-300 whitespace-nowrap`;
  const linkColor = (active: boolean) =>
    isGreenWorldPage
      ? active
        ? "text-gw-green"
        : "text-gw-green-dark hover:text-gw-green"
      : active
        ? "text-gold-light"
        : "text-[#f0e9da] hover:text-gold-light";

  const renderLink = (link: NavLink) => {
    const active = location.pathname === link.path;
    const noTranslate = link.noTranslate ? "no" : undefined;
    // TL.LIVE.1 — an external destination is never "active": it is not a route
    // this router can be on, so it wears the resting colour at all times.
    if (link.external) {
      return (
        <a
          href={link.path}
          target="_blank"
          rel="noopener noreferrer"
          translate={noTranslate}
          data-qa={link.qa}
          style={navHalo}
          className={`${linkBase} ${linkColor(false)}`}
        >
          {link.name}
        </a>
      );
    }
    if (link.path.includes("#")) {
      return (
        <a
          href={link.path}
          onClick={() => handleNavClick(link.path)}
          translate={noTranslate}
          style={navHalo}
          className={`${linkBase} ${linkColor(false)}`}
        >
          {link.name}
        </a>
      );
    }
    return (
      <Link
        to={link.path}
        translate={noTranslate}
        style={navHalo}
        className={`${linkBase} ${linkColor(active)}`}
      >
        {link.name}
      </Link>
    );
  };

  return (
    <header
      // MOBILE.EDGE.1 D — the page now paints under Safari's bars
      // (viewport-fit=cover), so a `top-0` fixed bar starts at the physical
      // screen edge and its first row lands behind the notch / Dynamic Island.
      // The inset is ADDED to the bar's own `py-3` (which is spacing, not
      // clearance) and falls back to 0px on every device without a cutout, so
      // the header is unchanged everywhere else. Ported from TitiLinks'
      // PublicProfile header, which pads its fixed chrome the same way.
      style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        isTitansPage
          ? "bg-titans-dark/98 backdrop-blur-xl py-3"
          : isGreenWorldPage
            ? `bg-white py-3 border-b border-gw-green/15${isScrolled ? " shadow-sm" : ""}`
            : isCinematicHome
              ? pastHero
                ? "bg-[#0b0a08]/95 backdrop-blur-xl py-3"
                : "bg-transparent py-3"
              : isScrolled
                ? "bg-background/95 backdrop-blur-xl py-3 border-b border-border/50"
                : "bg-transparent py-3"
      }`}
    >
      {/* Desktop nav — three-column grid from 1200px (NAV.FIT.1): the grid
          compressed under the Spanish labels below that, overlapping the
          monogram by up to 82px at 768. */}
      <nav
        className="hidden min-[1200px]:grid container-editorial grid-cols-3 items-center"
        style={{ fontFamily: "'Jost', 'Outfit', system-ui, sans-serif", letterSpacing: "0.16em" }}
      >
        <ul className="flex items-center gap-5 lg:gap-7 justify-self-start">
          {leftLinks.map((link) => (
            <li key={link.name}>{renderLink(link)}</li>
          ))}

          {/* NAV.SOON.1 — a disclosure, not a link, and it lives on the LEFT:
              the right rail already carries three links plus the language
              toggle, so hanging it there tipped the whole bar. The trigger is a
              button so it is keyboard-operable, and the panel opens left-aligned
              under it. Gold at every state — the one item meant to be noticed. */}
          <li ref={soonRef} className="relative">
            <button
              type="button"
              aria-expanded={soonOpen}
              aria-haspopup="true"
              data-qa="nav-coming-soon"
              onClick={() => setSoonOpen((v) => !v)}
              style={navHalo}
              className={`${linkBase} flex items-center gap-1 text-gold-light hover:text-gold-light`}
            >
              {t("nav.comingSoon")}
              <ChevronDown
                size={13}
                aria-hidden
                className={`transition-transform duration-300 ${soonOpen ? "rotate-180" : ""}`}
              />
            </button>

            <ul
              data-qa="nav-coming-soon-panel"
              className={`absolute left-0 top-full mt-3 min-w-[11rem] border transition-all duration-300 ${
                isGreenWorldPage
                  ? "bg-white border-gw-green/20"
                  : "bg-[#0b0a08]/95 backdrop-blur-xl border-[#C9A55C]/30"
              } ${
                soonOpen
                  ? "opacity-100 visible translate-y-0"
                  : "pointer-events-none invisible -translate-y-1 opacity-0"
              }`}
            >
              {soonItems.map((item) => {
                const cls = `notranslate block px-4 py-3 text-xs uppercase tracking-[0.16em] transition-colors ${
                  isGreenWorldPage ? "text-gw-green-dark" : "text-[#f0e9da]"
                }`;
                return (
                  <li key={item.name}>
                    {item.path ? (
                      <Link
                        to={item.path}
                        translate="no"
                        data-qa={`nav-soon-${item.qa}`}
                        onClick={() => setSoonOpen(false)}
                        className={`${cls} hover:text-gold-light`}
                      >
                        {item.name}
                      </Link>
                    ) : (
                      <span
                        aria-disabled
                        translate="no"
                        data-qa={`nav-soon-${item.qa}`}
                        className={`${cls} opacity-60`}
                      >
                        {item.name}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        </ul>

        <div className="justify-self-center">
          <Link to="/" aria-label="Cristyna Polentino — Home" className="inline-flex">
            <img
              src={isGreenWorldPage ? monogramTwoTone : monogram}
              alt="Cristyna Polentino CP monogram"
              className="h-9 md:h-11 w-auto select-none"
              draggable={false}
            />
          </Link>
        </div>

        <ul className="flex items-center gap-5 lg:gap-7 justify-self-end">
          {rightLinks.map((link) => (
            <li key={link.name}>{renderLink(link)}</li>
          ))}

          <li>
            <LanguageToggle variant={isGreenWorldPage ? "greenworld" : "light"} />
          </li>
        </ul>
      </nav>

      {/* NAV.FIT.1 — the under-1200 bar. Phone: logo + hamburger ONLY (every
          destination lives in the sheet). 768–1199 band: the inline-links
          pattern, Portafolio included. */}
      <nav
        className="min-[1200px]:hidden container-editorial flex items-center justify-between gap-2"
        style={{ fontFamily: "'Jost', 'Outfit', system-ui, sans-serif", letterSpacing: "0.14em" }}
      >
        <Link
          to="/"
          aria-label="Cristyna Polentino — Home"
          className="inline-flex min-h-11 shrink-0 items-center"
        >
          <img
            src={isGreenWorldPage ? monogramTwoTone : monogram}
            alt="Cristyna Polentino CP monogram"
            className="h-7 xs:h-8 w-auto select-none"
            draggable={false}
          />
        </Link>

        <ul className="hidden min-w-0 flex-1 items-center justify-center gap-4 md:flex lg:gap-6">
          {bandInlineLinks.map((link) => {
            const active = !link.external && location.pathname === link.path;
            const cls = `mobile-nav-link flex min-h-11 items-center uppercase font-light whitespace-nowrap transition-colors ${
              isGreenWorldPage
                ? active
                  ? "text-gw-green"
                  : "text-gw-green-dark hover:text-gw-green"
                : active
                  ? "text-gold-light"
                  : "text-[#f0e9da] hover:text-gold-light"
            }`;
            return (
              <li key={link.path} className="min-w-0">
                {link.external ? (
                  <a
                    href={link.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    translate={link.noTranslate ? "no" : undefined}
                    data-qa={link.qa}
                    style={navHalo}
                    className={cls}
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    to={link.path}
                    translate={link.noTranslate ? "no" : undefined}
                    data-qa={link.qa}
                    style={navHalo}
                    className={cls}
                  >
                    {link.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={navHalo}
          className={`min-h-11 min-w-11 shrink-0 p-3 transition-colors ${
            isGreenWorldPage
              ? "text-gw-green-dark hover:text-gw-green"
              : "text-foreground/80 hover:text-gold-light"
          }`}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* The sheet — the phone's complete nav; band overflow (socials, contact,
          coming-soon, language, admin) at 768–1199. */}
      <div
        className={`min-[1200px]:hidden absolute top-full left-0 right-0 z-50 border-t transition-all duration-500 ${
          isTitansPage
            ? "bg-[#1a1a1a] border-titans-red/30"
            : isGreenWorldPage
              ? "bg-gw-green-dark border-gw-green/30"
              : "bg-background border-border/50"
        } ${
          isMobileMenuOpen
            ? "opacity-100 visible translate-y-0"
            : "opacity-0 invisible -translate-y-4"
        }`}
      >
        <ul className="container-editorial py-6 space-y-3">
          {sheetLinks.map((link, index) => (
            <li
              key={link.name}
              className={`opacity-0 animate-fade-up${link.phoneOnly ? " md:hidden" : ""}`}
              style={{ animationDelay: `${index * 0.08}s`, animationFillMode: "forwards" }}
            >
              {link.external ? (
                <a
                  href={link.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  translate={link.noTranslate ? "no" : undefined}
                  data-qa={link.qa}
                  onClick={closeMenu}
                  className={`block py-2 text-lg font-serif transition-colors ${
                    isTitansPage
                      ? "text-white/90 hover:text-white"
                      : isGreenWorldPage
                        ? "text-gw-white/90 hover:text-gw-white"
                        : "text-foreground/70 hover:text-gold-light"
                  }`}
                >
                  {link.name}
                </a>
              ) : link.path.includes("#") ? (
                <a
                  href={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className={`block py-2 text-lg font-serif transition-colors ${
                    isTitansPage
                      ? "text-white/90 hover:text-white"
                      : isGreenWorldPage
                        ? "text-gw-white/90 hover:text-gw-white"
                        : "text-foreground/70 hover:text-gold-light"
                  }`}
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  to={link.path}
                  translate={link.noTranslate ? "no" : undefined}
                  onClick={closeMenu}
                  className={`block py-2 text-lg font-serif transition-colors ${
                    location.pathname === link.path
                      ? isTitansPage
                        ? "text-titans-red"
                        : isGreenWorldPage
                          ? "text-gw-white"
                          : "text-gold-light"
                      : isTitansPage
                        ? "text-white/90 hover:text-white"
                        : isGreenWorldPage
                          ? "text-gw-white/90 hover:text-gw-white"
                          : "text-foreground/70 hover:text-gold-light"
                  }`}
                >
                  {link.name}
                </Link>
              )}
            </li>
          ))}

          {/* NAV.SOON.1 — mobile. No disclosure to open here: the sheet is
              already a disclosure, so the items are simply listed under their
              heading rather than hidden behind a second tap. */}
          <li className="pt-2">
            <p
              data-qa="nav-coming-soon-mobile"
              className="text-xs uppercase tracking-[0.2em] text-gold-light"
            >
              {t("nav.comingSoon")}
            </p>
            <ul className="mt-2 space-y-1 pl-3">
              {soonItems.map((item) => {
                const cls = `notranslate block py-1 text-base font-serif ${
                  isTitansPage
                    ? "text-white/70"
                    : isGreenWorldPage
                      ? "text-gw-white/70"
                      : "text-foreground/70"
                }`;
                return (
                  <li key={item.name}>
                    {item.path ? (
                      <Link
                        to={item.path}
                        translate="no"
                        data-qa={`nav-soon-mobile-${item.qa}`}
                        onClick={closeMenu}
                        className={cls}
                      >
                        {item.name}
                      </Link>
                    ) : (
                      <span
                        aria-disabled
                        translate="no"
                        data-qa={`nav-soon-mobile-${item.qa}`}
                        className={`${cls} opacity-60`}
                      >
                        {item.name}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>

          <li aria-hidden className="pt-2">
            <div
              className={`h-px w-full ${
                isTitansPage
                  ? "bg-white/15"
                  : isGreenWorldPage
                    ? "bg-gw-white/20"
                    : "bg-border/60"
              }`}
            />
          </li>

          <li>
            <div
              role="group"
              translate="no"
              aria-label={t("nav.switchLanguage", "Switch language")}
              className={`notranslate flex rounded-md overflow-hidden text-xs font-semibold tracking-[0.2em] border ${
                isTitansPage
                  ? "border-white/20"
                  : isGreenWorldPage
                    ? "border-gw-white/25"
                    : "border-border"
              }`}
            >
              {(["es", "en"] as const).map((lng) => {
                const active = lng === "en" ? !!isEn : !isEn;
                return (
                  <button
                    key={lng}
                    type="button"
                    onClick={() => {
                      setLang(lng);
                      closeMenu();
                    }}
                    className={`flex-1 px-3 py-2 uppercase transition-colors ${
                      active
                        ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                        : isTitansPage
                          ? "bg-transparent text-white/70 hover:text-white"
                          : isGreenWorldPage
                            ? "bg-transparent text-gw-white/70 hover:text-gw-white"
                            : "bg-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    aria-pressed={active}
                  >
                    {lng}
                  </button>
                );
              })}
            </div>
          </li>

          <li>
            {session ? (
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={handleAdmin}
                  className={`flex items-center gap-2 py-2 text-base font-serif transition-colors text-left ${
                    isTitansPage
                      ? "text-white/90 hover:text-white"
                      : isGreenWorldPage
                        ? "text-gw-white/90 hover:text-gw-white"
                        : "text-foreground/70 hover:text-gold-light"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  {t("nav.admin", "Admin")}
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={`flex items-center gap-2 py-2 text-base font-serif transition-colors text-left ${
                    isTitansPage
                      ? "text-white/90 hover:text-white"
                      : isGreenWorldPage
                        ? "text-gw-white/90 hover:text-gw-white"
                        : "text-foreground/70 hover:text-gold-light"
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                  {t("nav.signOut", "Log out")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdmin}
                className={`flex items-center gap-2 py-2 text-base font-serif transition-colors text-left ${
                  isTitansPage
                    ? "text-white/90 hover:text-white"
                    : isGreenWorldPage
                      ? "text-gw-white/90 hover:text-gw-white"
                      : "text-foreground/70 hover:text-gold-light"
                }`}
              >
                <Lock className="w-4 h-4" />
                {t("nav.adminLogin", "Admin Login")}
              </button>
            )}
          </li>
        </ul>
      </div>
    </header>
  );
};

export default Header;

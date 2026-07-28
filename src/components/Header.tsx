import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Lock, LayoutDashboard, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setLanguage } from "@/i18n";
import LanguageToggle from "./LanguageToggle";
import { useEventsBoard } from "@/hooks/useEventsBoard";
import { TITANS_ENABLED } from "@/lib/ventures";
import monogram from "@/assets/cp-monogram-transparent.png";
import monogramTwoTone from "@/assets/cp-monogram-twotone.png";

type NavLink = { name: string; path: string; noTranslate?: boolean };

const Header = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
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
  const leftLinks: NavLink[] = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.greenWorld"), path: "/green-world", noTranslate: true },
    ...(TITANS_ENABLED
      ? [{ name: t("nav.titansAgency"), path: "/titans-agency", noTranslate: true }]
      : []),
  ];
  const rightLinks: NavLink[] = [
    { name: t("nav.portfolio"), path: "/work" },
    { name: t("nav.socials"), path: "/socials" },
    { name: t("nav.contact"), path: "/#contact" },
  ];

  // Mobile-only inline links: shorter "Titans" label, optionally Events
  const mobileInlineLinks: NavLink[] = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.greenWorld"), path: "/green-world", noTranslate: true },
    ...(TITANS_ENABLED
      ? [{ name: t("nav.titansShort", "Titans"), path: "/titans-agency", noTranslate: true }]
      : []),
  ];
  if (eventsVisible) {
    mobileInlineLinks.push({ name: t("nav.events", "Events"), path: "/events" });
  }

  const isTitansPage = location.pathname === "/titans-agency";
  const isGreenWorldPage = location.pathname === "/green-world";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    if (link.path.includes("#")) {
      return (
        <a
          href={link.path}
          onClick={() => handleNavClick(link.path)}
          translate={noTranslate}
          className={`${linkBase} ${linkColor(false)}`}
        >
          {link.name}
        </a>
      );
    }
    return (
      <Link to={link.path} translate={noTranslate} className={`${linkBase} ${linkColor(active)}`}>
        {link.name}
      </Link>
    );
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        isTitansPage
          ? "bg-titans-dark/98 backdrop-blur-xl py-3"
          : isGreenWorldPage
            ? `bg-white py-3 border-b border-gw-green/15${isScrolled ? " shadow-sm" : ""}`
            : isScrolled
              ? "bg-background/95 backdrop-blur-xl py-3 border-b border-border/50"
              : "bg-transparent py-3"
      }`}
    >
      {/* Desktop nav — unchanged */}
      <nav
        className="hidden md:grid container-editorial grid-cols-3 items-center"
        style={{ fontFamily: "'Jost', 'Outfit', system-ui, sans-serif", letterSpacing: "0.16em" }}
      >
        <ul className="flex items-center gap-5 lg:gap-7 justify-self-start">
          {leftLinks.map((link) => (
            <li key={link.name}>{renderLink(link)}</li>
          ))}
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

      {/* Mobile nav — logo + 4 inline links + single hamburger */}
      <nav
        className="md:hidden container-editorial flex items-center gap-2"
        style={{ fontFamily: "'Jost', 'Outfit', system-ui, sans-serif", letterSpacing: "0.14em" }}
      >
        <Link to="/" aria-label="Cristyna Polentino — Home" className="inline-flex shrink-0">
          <img
            src={isGreenWorldPage ? monogramTwoTone : monogram}
            alt="Cristyna Polentino CP monogram"
            className="h-7 xs:h-8 w-auto select-none"
            draggable={false}
          />
        </Link>

        <ul className="flex-1 flex items-center justify-center gap-2.5 xs:gap-3 min-w-0">
          {mobileInlineLinks.map((link) => {
            const active = location.pathname === link.path;
            return (
              <li key={link.path} className="min-w-0">
                <Link
                  to={link.path}
                  translate={link.noTranslate ? "no" : undefined}
                  className={`mobile-nav-link uppercase font-light whitespace-nowrap transition-colors ${
                    isGreenWorldPage
                      ? active
                        ? "text-gw-green"
                        : "text-gw-green-dark hover:text-gw-green"
                      : active
                        ? "text-gold-light"
                        : "text-[#f0e9da] hover:text-gold-light"
                  }`}
                >
                  {link.name}
                </Link>
              </li>
            );
          })}
        </ul>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`shrink-0 p-2 transition-colors ${
            isGreenWorldPage
              ? "text-gw-green-dark hover:text-gw-green"
              : "text-foreground/80 hover:text-gold-light"
          }`}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile Menu — overflow links + language + admin only */}
      <div
        className={`md:hidden absolute top-full left-0 right-0 z-50 border-t transition-all duration-500 ${
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
          {rightLinks.map((link, index) => (
            <li
              key={link.name}
              className="opacity-0 animate-fade-up"
              style={{ animationDelay: `${index * 0.08}s`, animationFillMode: "forwards" }}
            >
              {link.path.includes("#") ? (
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

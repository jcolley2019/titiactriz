import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Lock, LayoutDashboard, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import LanguageToggle from "./LanguageToggle";
import { useEventsBoard } from "@/hooks/useEventsBoard";
import monogramAsset from "@/assets/cp-monogram-transparent.png.asset.json";

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
  const setLang = (lng: "es" | "en") => {
    if (i18n.language?.startsWith(lng)) return;
    i18n.changeLanguage(lng);
  };
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





  const leftLinks = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.greenWorld"), path: "/green-world" },
    { name: t("nav.titansAgency"), path: "/titans-agency" },
  ];
  const rightLinks = [
    { name: t("nav.portfolio"), path: "/work" },
    { name: t("nav.socials"), path: "/socials" },
    { name: t("nav.contact"), path: "/#contact" },
  ];
  const mobileLinks = [...leftLinks, ...rightLinks];

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
    "text-xs lg:text-[13px] uppercase font-light link-underline transition-all duration-300 whitespace-nowrap";
  const linkColor = (active: boolean) =>
    isGreenWorldPage
      ? active
        ? "text-gw-green"
        : "text-gw-green-dark hover:text-gw-green"
      : active
        ? "text-gold-light"
        : "text-[#f0e9da] hover:text-gold-light";

  const renderLink = (link: { name: string; path: string }) => {
    const active = location.pathname === link.path;
    if (link.path.includes("#")) {
      return (
        <a
          href={link.path}
          onClick={() => handleNavClick(link.path)}
          className={`${linkBase} ${linkColor(false)}`}
        >
          {link.name}
        </a>
      );
    }
    return (
      <Link to={link.path} className={`${linkBase} ${linkColor(active)}`}>
        {link.name}
      </Link>
    );
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        isScrolled
          ? isTitansPage
            ? "bg-titans-dark/98 backdrop-blur-xl py-3"
            : isGreenWorldPage
              ? "bg-gw-green-dark/98 backdrop-blur-xl py-3"
              : "bg-background/95 backdrop-blur-xl py-3 border-b border-border/50"
          : "bg-transparent py-4"
      }`}
    >
      <nav
        className="container-editorial grid grid-cols-2 md:grid-cols-3 items-center"
        style={{ fontFamily: "'Jost', 'Outfit', system-ui, sans-serif", letterSpacing: "0.16em" }}
      >
        {/* LEFT */}
        <ul className="hidden md:flex items-center gap-5 lg:gap-7 justify-self-start">
          {leftLinks.map((link) => (
            <li key={link.name}>{renderLink(link)}</li>
          ))}
        </ul>

        {/* CENTER MONOGRAM */}
        <div className="justify-self-start md:justify-self-center">
          <Link to="/" aria-label="Cristyna Polentino — Home" className="inline-flex">
            <img
              src={monogramAsset.url}
              alt="Cristyna Polentino CP monogram"
              className="h-9 md:h-11 w-auto select-none"
              draggable={false}
            />
          </Link>
        </div>

        {/* RIGHT */}
        <ul className="hidden md:flex items-center gap-5 lg:gap-7 justify-self-end">
          {rightLinks.map((link) => (
            <li key={link.name}>{renderLink(link)}</li>
          ))}
          <li>
            <LanguageToggle variant={isGreenWorldPage ? "greenworld" : "light"} />
          </li>
        </ul>



        {/* Mobile right cluster — single hamburger only */}
        <div className="md:hidden flex items-center justify-self-end">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`p-2 transition-colors ${
              isGreenWorldPage
                ? "text-gw-green-dark hover:text-gw-green"
                : "text-foreground/80 hover:text-gold-light"
            }`}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

      </nav>

      {/* Mobile Menu */}
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
        <ul className="container-editorial py-8 space-y-4">
          {mobileLinks.map((link, index) => (
            <li
              key={link.name}
              className="opacity-0 animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s`, animationFillMode: "forwards" }}
            >



              {link.path.includes("#") ? (
                <a
                  href={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className={`block py-3 text-xl font-serif transition-colors ${
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
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block py-3 text-xl font-serif transition-colors ${
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

          {eventsVisible && (
            <li
              className="opacity-0 animate-fade-up"
              style={{ animationDelay: `${mobileLinks.length * 0.1}s`, animationFillMode: "forwards" }}
            >
              <Link
                to="/events"
                onClick={closeMenu}
                className={`block py-3 text-xl font-serif transition-colors ${
                  location.pathname === "/events"
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
                {t("nav.events", "Events")}
              </Link>
            </li>
          )}

          {/* Divider */}
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

          {/* ES/EN segmented control */}
          <li>
            <div
              role="group"
              aria-label={t("nav.switchLanguage", "Switch language")}
              className={`flex rounded-md overflow-hidden text-xs font-semibold tracking-[0.2em] border ${
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

          {/* Admin entry */}
          <li>
            {session ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleAdmin}
                  className={`flex items-center gap-2 py-3 text-base font-serif transition-colors text-left ${
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
                  className={`flex items-center gap-2 py-3 text-base font-serif transition-colors text-left ${
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
                className={`flex items-center gap-2 py-3 text-base font-serif transition-colors text-left ${
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

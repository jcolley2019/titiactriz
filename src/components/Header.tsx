import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";
import monogramAsset from "@/assets/cp-monogram-transparent.png.asset.json";

const Header = () => {
  const { t } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const leftLinks = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.portfolio"), path: "/work" },
    { name: t("nav.titansAgency"), path: "/titans-agency" },
  ];
  const rightLinks = [
    { name: t("nav.greenWorld"), path: "/green-world" },
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
        <ul className="hidden md:flex items-center gap-7 md:gap-8 justify-self-start">
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
        <ul className="hidden md:flex items-center gap-7 md:gap-8 justify-self-end">
          {rightLinks.map((link) => (
            <li key={link.name}>{renderLink(link)}</li>
          ))}
          <li>
            <LanguageToggle variant={isGreenWorldPage ? "greenworld" : "light"} />
          </li>
        </ul>

        {/* Mobile right cluster */}
        <div className="md:hidden flex items-center gap-3 justify-self-end">
          <LanguageToggle variant={isGreenWorldPage ? "greenworld" : "light"} />
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
        </ul>
      </div>
    </header>
  );
};

export default Header;

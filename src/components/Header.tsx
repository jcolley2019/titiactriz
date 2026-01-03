import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";

const Header = () => {
  const { t } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  const navLinks = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.titansAgency"), path: "/titans-agency" },
    { name: t("nav.greenWorld"), path: "/green-world" },
    { name: t("nav.portfolio"), path: "/work" },
    { name: t("nav.contact"), path: "/#contact" },
  ];
  
  // Check if on special pages for custom styling
  const isTitansPage = location.pathname === "/titans-agency";
  const isGreenWorldPage = location.pathname === "/green-world";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
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

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        isScrolled
          ? isTitansPage 
            ? "bg-titans-dark/98 backdrop-blur-xl py-4"
            : isGreenWorldPage
              ? "bg-gw-green-dark/98 backdrop-blur-xl py-4"
              : "bg-background/95 backdrop-blur-xl py-4 border-b border-border/50"
          : "bg-transparent py-6"
      }`}
    >
      <nav className="container-editorial flex items-center justify-between">
        {/* Left Nav */}
        <ul className="hidden lg:flex items-center gap-10">
          {navLinks.slice(0, 3).map((link) => (
            <li key={link.name}>
              {link.path.includes("#") ? (
                <a
                  href={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className={`text-base font-medium tracking-wide link-underline transition-all duration-300 ${
                    isTitansPage || isGreenWorldPage
                      ? "text-foreground/80 hover:text-foreground" 
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  to={link.path}
                  className={`text-base font-medium tracking-wide link-underline transition-all duration-300 ${
                    location.pathname === link.path
                      ? "text-foreground"
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  {link.name}
                </Link>
              )}
            </li>
          ))}
        </ul>

        {/* Spacer for balanced layout */}
        <div className="hidden lg:block" />

        {/* Right Nav */}
        <ul className="hidden lg:flex items-center gap-10">
          {navLinks.slice(3).map((link) => (
            <li key={link.name}>
              {link.path.includes("#") ? (
                <a
                  href={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className={`text-base font-medium tracking-wide link-underline transition-all duration-300 ${
                    isTitansPage || isGreenWorldPage
                      ? "text-foreground/80 hover:text-foreground" 
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  to={link.path}
                  className={`text-base font-medium tracking-wide link-underline transition-all duration-300 ${
                    location.pathname === link.path
                      ? "text-foreground"
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  {link.name}
                </Link>
              )}
            </li>
          ))}
          <li>
            <a 
              href="/#contact" 
              onClick={() => handleNavClick("/#contact")} 
              className="text-base font-medium tracking-wide link-underline transition-all duration-300 text-foreground/80 hover:text-foreground"
            >
              {t("hero.cta")}
            </a>
          </li>
          <li>
            <LanguageToggle variant="default" />
          </li>
        </ul>

        {/* Mobile Menu Button */}
        <div className="lg:hidden flex items-center gap-3">
          <LanguageToggle variant="default" />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-foreground/80 hover:text-foreground transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden absolute top-full left-0 right-0 z-50 bg-background/98 backdrop-blur-xl border-t border-border/50 transition-all duration-500 ${
          isMobileMenuOpen
            ? "opacity-100 visible translate-y-0"
            : "opacity-0 invisible -translate-y-4"
        }`}
      >
        <ul className="container-editorial py-8 space-y-4">
          {navLinks.map((link, index) => (
            <li 
              key={link.name}
              className="opacity-0 animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'forwards' }}
            >
              {link.path.includes("#") ? (
                <a
                  href={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className="block py-3 text-xl font-serif text-foreground/70 hover:text-foreground transition-colors"
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block py-3 text-xl font-serif transition-colors ${
                    location.pathname === link.path
                      ? "text-foreground"
                      : "text-foreground/70 hover:text-foreground"
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

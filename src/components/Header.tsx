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
    { name: t("nav.workResume"), path: "/work" },
    { name: t("nav.contact"), path: "/#contact" },
  ];
  
  // Check if on special pages for custom text styling
  const isTitansPage = location.pathname === "/titans-agency";
  const isGreenWorldPage = location.pathname === "/green-world";
  const isSpecialPage = isTitansPage || isGreenWorldPage;

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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? isTitansPage 
            ? "bg-titans-dark/95 backdrop-blur-md shadow-soft py-3"
            : isGreenWorldPage
              ? "bg-gw-green-dark/95 backdrop-blur-md shadow-soft py-3"
              : "bg-background/95 backdrop-blur-md shadow-soft py-3"
          : "bg-transparent py-5"
      }`}
    >
      <nav className="container-editorial flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className={`font-serif text-xl md:text-2xl tracking-tight transition-colors ${
            isSpecialPage 
              ? "text-white hover:text-white/80" 
              : "text-foreground hover:text-primary"
          }`}
        >
          Cristyna <span className={isTitansPage ? "text-titans-red" : isGreenWorldPage ? "text-gw-white" : "text-accent"}>Polentino</span>
        </Link>

        {/* Desktop Navigation */}
        <ul className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <li key={link.name}>
              {link.path.includes("#") ? (
                <a
                  href={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className={`text-sm font-medium link-underline transition-colors ${
                    isSpecialPage 
                      ? "text-white/80 hover:text-white" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  to={link.path}
                  className={`text-sm font-medium link-underline transition-colors ${
                    isSpecialPage
                      ? location.pathname === link.path
                        ? "text-white"
                        : "text-white/80 hover:text-white"
                      : location.pathname === link.path
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.name}
                </Link>
              )}
            </li>
          ))}
          <li>
            <LanguageToggle variant={isSpecialPage ? "light" : "default"} />
          </li>
        </ul>

        {/* Mobile Menu Button */}
        <div className="lg:hidden flex items-center gap-2">
          <LanguageToggle variant={isSpecialPage ? "light" : "default"} />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`p-2 transition-colors ${
              isSpecialPage 
                ? "text-white hover:text-white/80" 
                : "text-foreground hover:text-primary"
            }`}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden absolute top-full left-0 right-0 z-50 bg-background shadow-lg border-t border-border transition-all duration-300 ${
          isMobileMenuOpen
            ? "opacity-100 visible translate-y-0"
            : "opacity-0 invisible -translate-y-4"
        }`}
      >
        <ul className="container-editorial py-6 space-y-4">
          {navLinks.map((link) => (
            <li key={link.name}>
              {link.path.includes("#") ? (
                <a
                  href={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className="block py-2 text-lg font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block py-2 text-lg font-medium transition-colors ${
                    location.pathname === link.path
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
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

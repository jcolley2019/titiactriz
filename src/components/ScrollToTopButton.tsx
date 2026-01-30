import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const getThreshold = () =>
      window.matchMedia("(max-width: 640px)").matches ? 80 : 300;

    const toggleVisibility = () => {
      setIsVisible(window.scrollY > getThreshold());
    };

    window.addEventListener("scroll", toggleVisibility);
    toggleVisibility();
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!isVisible) return null;

  return (
    <Button
      onClick={scrollToTop}
      size="icon"
      variant="outline"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 rounded-full shadow-lg transition-all duration-300 hover:scale-110 bg-background/60 backdrop-blur border-border"
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
};

export default ScrollToTopButton;

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const location = useLocation();
  
  // Check if we're on the Titans Agency page for special styling
  const isTitansPage = location.pathname === "/titans-agency";

  useEffect(() => {
    const getThreshold = () =>
      window.matchMedia("(max-width: 640px)").matches ? 80 : 300;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const threshold = getThreshold();
      const maxOpacityScroll = threshold + 200;
      
      if (scrollY > threshold) {
        setIsVisible(true);
        // Fade in gradually
        const fadeProgress = Math.min((scrollY - threshold) / 200, 1);
        setOpacity(fadeProgress);
      } else {
        setIsVisible(false);
        setOpacity(0);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      style={{ opacity }}
      className={cn(
        "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 h-12 w-12 rounded-full",
        "flex items-center justify-center",
        "transition-all duration-300 hover:scale-110",
        "backdrop-blur-md shadow-lg",
        // Titans-specific styling with ring motif and glow
        isTitansPage ? [
          "border-2 border-[hsl(0,70%,40%)]/60",
          "bg-[hsl(0,0%,8%)]/80 text-white",
          "shadow-[0_0_20px_hsl(0,70%,40%,0.3)]",
          "hover:border-[hsl(0,70%,40%)]",
          "hover:shadow-[0_0_30px_hsl(0,70%,40%,0.5)]",
        ] : [
          "border border-border",
          "bg-background/60 text-foreground",
          "hover:bg-background/80",
        ]
      )}
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
};

export default ScrollToTopButton;

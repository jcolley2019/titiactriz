import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ScrollReveal from "@/components/ScrollReveal";

type Photo = {
  id: string;
  image_url: string;
  alt_text: string | null;
};

const Gallery = () => {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleImages, setVisibleImages] = useState<Set<number>>(new Set());
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollAccumulator = useRef(0);

  // Fetch published photos
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("gallery_photos")
        .select("id, image_url, alt_text")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (!error && data) setPhotos(data as Photo[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Entrance animations
  useEffect(() => {
    if (photos.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            setVisibleImages((prev) => new Set([...prev, index]));
          }
        });
      },
      { threshold: 0.2, rootMargin: "50px" },
    );
    imageRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, [photos]);

  // Auto-scroll
  useEffect(() => {
    if (!isAutoScrolling || photos.length === 0) return;
    let animationId: number;
    const speed = 0.3;
    const step = () => {
      if (scrollRef.current) {
        const container = scrollRef.current;
        const maxScroll = container.scrollWidth - container.clientWidth;
        scrollAccumulator.current += speed;
        if (scrollAccumulator.current >= 1) {
          const pixels = Math.floor(scrollAccumulator.current);
          scrollAccumulator.current -= pixels;
          if (container.scrollLeft >= maxScroll - 1) {
            container.scrollLeft = 0;
          } else {
            container.scrollLeft += pixels;
          }
        }
      }
      animationId = requestAnimationFrame(step);
    };
    animationId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationId);
  }, [isAutoScrolling, photos]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const scrollAmount = 300;
    const maxScroll = container.scrollWidth - container.clientWidth;
    if (direction === "right") {
      if (container.scrollLeft >= maxScroll - 10) {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    } else {
      if (container.scrollLeft <= 10) {
        container.scrollTo({ left: maxScroll, behavior: "smooth" });
      } else {
        container.scrollBy({ left: -scrollAmount, behavior: "smooth" });
      }
    }
  };

  const handleImageClick = (index: number) => {
    setSelectedIndex(index);
    setIsOpen(true);
  };

  const navigateLightbox = (direction: "prev" | "next") => {
    if (photos.length === 0) return;
    const newIndex =
      direction === "prev"
        ? (selectedIndex - 1 + photos.length) % photos.length
        : (selectedIndex + 1) % photos.length;
    setSelectedIndex(newIndex);
  };

  const altFor = (photo: Photo, i: number) =>
    photo.alt_text && photo.alt_text.trim().length > 0
      ? photo.alt_text
      : t("gallery.imageAlt", { number: i + 1 });

  const selectedPhoto = photos[selectedIndex];

  return (
    <>
      <section className="py-12 sm:py-16 relative z-10">
        {/* Section Header */}
        <ScrollReveal className="container-editorial text-center mb-10">
          <p className="text-caps text-accent mb-4">{t("gallery.eyebrow")}</p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground">
            {t("gallery.title")}
          </h2>
        </ScrollReveal>

        {photos.length > 0 && (
          <>
            <button
              onClick={() => scroll("left")}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 hover:shadow-glow transition-all duration-300 group"
              aria-label={t("gallery.scrollLeft")}
            >
              <ChevronLeft className="w-5 h-5 text-foreground group-hover:text-gold-light transition-colors duration-300" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 hover:shadow-glow transition-all duration-300 group"
              aria-label={t("gallery.scrollRight")}
            >
              <ChevronRight className="w-5 h-5 text-foreground group-hover:text-gold-light transition-colors duration-300" />
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onMouseEnter={() => setIsAutoScrolling(false)}
          onMouseLeave={() => setIsAutoScrolling(true)}
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="flex-shrink-0 w-56 h-72 rounded-sm bg-muted/30 animate-pulse"
                />
              ))
            : photos.map((photo, i) => (
                <div
                  key={photo.id}
                  ref={(el) => (imageRefs.current[i] = el)}
                  data-index={i}
                  onClick={() => handleImageClick(i)}
                  className={`flex-shrink-0 w-56 h-72 rounded-sm overflow-hidden cursor-pointer group relative transition-all duration-700 ease-out hover:shadow-lg hover:shadow-accent/30 ${
                    visibleImages.has(i)
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: `${(i % 6) * 100}ms` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
                  <div className="absolute inset-0 rounded-sm border-2 border-accent/0 group-hover:border-accent/50 transition-all duration-500 z-20" />
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/80 via-gold-light to-accent/80 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-30" />
                  <img
                    src={photo.image_url}
                    alt={altFor(photo, i)}
                    loading="lazy"
                    decoding="async"
                    style={{ aspectRatio: "56 / 72" }}
                    className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 group-hover:rotate-1 animate-color-reveal"
                  />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:translate-y-0 translate-y-4">
                    <span className="text-xs tracking-[0.2em] uppercase text-foreground/90 bg-background/60 backdrop-blur px-3 py-1.5 rounded-full border border-accent/30">
                      {t("common.view")}
                    </span>
                  </div>
                </div>
              ))}
        </div>
      </section>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 z-50 w-12 h-12 rounded-full bg-background/90 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 hover:shadow-glow transition-all duration-300 group"
            aria-label={t("gallery.close")}
          >
            <X className="w-5 h-5 text-foreground group-hover:text-gold-light" />
          </button>

          <button
            onClick={() => navigateLightbox("prev")}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-background/90 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 hover:shadow-glow transition-all duration-300 group"
            aria-label={t("common.previousImage")}
          >
            <ChevronLeft className="w-5 h-5 text-foreground group-hover:text-gold-light transition-colors duration-300" />
          </button>

          <button
            onClick={() => navigateLightbox("next")}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-background/90 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 hover:shadow-glow transition-all duration-300 group"
            aria-label={t("common.nextImage")}
          >
            <ChevronRight className="w-5 h-5 text-foreground group-hover:text-gold-light transition-colors duration-300" />
          </button>

          {selectedPhoto && (
            <img
              src={selectedPhoto.image_url}
              alt={altFor(selectedPhoto, selectedIndex)}
              className="w-full h-auto max-h-[85vh] object-contain rounded-sm animate-[fadeIn_0.3s_ease-out]"
            />
          )}

          {photos.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
              <span className="text-sm text-foreground/80 bg-background/60 backdrop-blur px-4 py-2 rounded-full border border-border/30">
                {selectedIndex + 1} / {photos.length}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Gallery;

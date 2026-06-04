import { memo, useEffect, useRef, useState } from "react";
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

type GalleryProps = {
  photos?: Photo[];
  pauseAutoScroll?: boolean;
  compact?: boolean;
};

const Gallery = ({ photos: photosProp, pauseAutoScroll = false, compact = false }: GalleryProps = {}) => {
  const { t } = useTranslation();
  const [fetchedPhotos, setFetchedPhotos] = useState<Photo[]>([]);
  const photos = photosProp ?? fetchedPhotos;
  const [loading, setLoading] = useState(photosProp ? false : true);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleImages, setVisibleImages] = useState<Set<number>>(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const offsetRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  // Fetch published photos (only when no prop passed)
  useEffect(() => {
    if (photosProp) return;
    let cancelled = false;
    (async () => {
      // Try with is_archived filter; fall back if column doesn't exist yet.
      const base = supabase
        .from("gallery_photos")
        .select("id, image_url, alt_text")
        .eq("is_published", true);
      let result = await (base as unknown as {
        eq: (c: string, v: unknown) => typeof base;
      })
        .eq("is_archived", false)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (result.error && /is_archived/i.test(result.error.message)) {
        result = await supabase
          .from("gallery_photos")
          .select("id, image_url, alt_text")
          .eq("is_published", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });
      }
      if (result.error && /is_archived/i.test(result.error.message)) {
        result = await supabase
          .from("gallery_photos")
          .select("id, image_url, alt_text")
          .eq("is_published", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });
      }
      if (cancelled) return;
      if (!result.error && result.data) setFetchedPhotos(result.data as Photo[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [photosProp]);

  // Reduced motion preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
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

  // Seamless marquee auto-scroll via transform on duplicated track.
  // Compact mode (admin dock) uses a pure CSS keyframe so it can't be restarted
  // by parent re-renders. Full mode keeps the rAF loop.
  useEffect(() => {
    if (compact) return;
    if (photos.length === 0 || prefersReducedMotion) return;
    const track = trackRef.current;
    if (!track) return;

    const speed = 24; // px per second
    let animationId: number;

    const step = (time: number) => {
      if (lastTimeRef.current == null) lastTimeRef.current = time;
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      if (!isPaused && !pauseAutoScroll) {
        // Track contains 2 copies; one set width = trackWidth / 2
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0) {
          offsetRef.current += speed * delta;
          if (offsetRef.current >= halfWidth) {
            offsetRef.current -= halfWidth;
          }
          track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
        }
      }
      animationId = requestAnimationFrame(step);
    };
    animationId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(animationId);
      lastTimeRef.current = null;
    };
  }, [photos, isPaused, prefersReducedMotion, pauseAutoScroll, compact]);

  const nudge = (direction: "left" | "right") => {
    const track = trackRef.current;
    if (!track) return;
    const halfWidth = track.scrollWidth / 2;
    if (halfWidth <= 0) return;
    const amount = 300;
    offsetRef.current += direction === "right" ? amount : -amount;
    // Wrap into [0, halfWidth)
    offsetRef.current = ((offsetRef.current % halfWidth) + halfWidth) % halfWidth;
    track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
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

  // Build two copies for seamless marquee
  const displayPhotos = photos.length > 0 ? [...photos, ...photos] : [];

  const tileClass = compact
    ? "flex-shrink-0 w-[120px] h-[160px] rounded-sm overflow-hidden cursor-pointer group relative"
    : "flex-shrink-0 w-56 h-72 rounded-sm overflow-hidden cursor-pointer group relative transition-all duration-700 ease-out hover:shadow-lg hover:shadow-accent/30";
  const skeletonClass = compact
    ? "flex-shrink-0 w-[120px] h-[160px] rounded-sm bg-muted/30 animate-pulse"
    : "flex-shrink-0 w-56 h-72 rounded-sm bg-muted/30 animate-pulse";

  // CSS-driven marquee for the compact (dock) variant — duration scales with photo count
  // so speed stays roughly constant (~24px/s, matching the public gallery).
  const compactAnimationDuration = Math.max(20, photos.length * 6); // seconds
  const compactPaused = isPaused || pauseAutoScroll;
  const compactTrackStyle: React.CSSProperties = compact
    ? {
        width: "max-content",
        animation: `gallery-marquee ${compactAnimationDuration}s linear infinite`,
        animationPlayState: compactPaused ? "paused" : "running",
        willChange: "transform",
      }
    : { width: "max-content" };

  return (
    <>
      <section className={compact ? "relative z-10" : "py-12 sm:py-16 relative z-10"}>
        {/* Section Header */}
        {!compact && (
          <ScrollReveal className="container-editorial text-center mb-10">
            <p className="text-caps text-accent mb-4">{t("gallery.eyebrow")}</p>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground">
              {t("gallery.title")}
            </h2>
          </ScrollReveal>
        )}

        {photos.length > 0 && !compact && (
          <>
            <button
              onClick={() => nudge("left")}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 hover:shadow-glow transition-all duration-300 group"
              aria-label={t("gallery.scrollLeft")}
            >
              <ChevronLeft className="w-5 h-5 text-foreground group-hover:text-gold-light transition-colors duration-300" />
            </button>
            <button
              onClick={() => nudge("right")}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 hover:shadow-glow transition-all duration-300 group"
              aria-label={t("gallery.scrollRight")}
            >
              <ChevronRight className="w-5 h-5 text-foreground group-hover:text-gold-light transition-colors duration-300" />
            </button>
          </>
        )}

        <div
          ref={viewportRef}
          className="overflow-hidden px-6"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {loading ? (
            <div className="flex gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className={skeletonClass}
                />
              ))}
            </div>
          ) : (
            <div
              ref={trackRef}
              className="flex gap-4 will-change-transform"
              style={compactTrackStyle}
            >
              {displayPhotos.map((photo, i) => {
                const originalIndex = i % photos.length;
                return (
                  <div
                    key={`${photo.id}-${i}`}
                    ref={(el) => {
                      if (i < photos.length) imageRefs.current[i] = el;
                    }}
                    data-index={originalIndex}
                    onClick={() => handleImageClick(originalIndex)}
                    aria-hidden={i >= photos.length ? true : undefined}
                    className={`${tileClass} ${
                      compact || i >= photos.length || visibleImages.has(originalIndex)
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-8"
                    }`}
                    style={{ transitionDelay: `${(originalIndex % 6) * 100}ms` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
                    <div className="absolute inset-0 rounded-sm border-2 border-accent/0 group-hover:border-accent/50 transition-all duration-500 z-20" />
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/80 via-gold-light to-accent/80 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-30" />
                    <img
                      src={photo.image_url}
                      alt={altFor(photo, originalIndex)}
                      loading="eager"
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
                );
              })}
            </div>
          )}
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

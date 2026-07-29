import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import PhotoLightbox from "@/components/PhotoLightbox";
import type { CinematicPhoto } from "./useCinematicData";

gsap.registerPlugin(ScrollTrigger);

type Props = { photos: CinematicPhoto[]; reduced: boolean };

/**
 * TA.5a gallery — a self-driving infinite marquee. The track holds two identical
 * copies of every published photo (ordered by sort_order upstream); a single
 * linear GSAP tween drifts it left by exactly one copy's width and loops
 * forever, so the wrap is seamless. The tween DURATION SCALES WITH THE PHOTO
 * COUNT (~4s per photo), so the drift speed stays constant no matter how many
 * photos exist — it never gets tedious as the gallery grows.
 *
 * REVIEW.3a — the gallery DWELLS: like every story act it pins for +=120%
 * (the About standard) before releasing, so the reader sits with the pictures
 * instead of sliding past them. The marquee keeps self-driving through the
 * dwell, and every interaction survives the pin — hover still pauses the
 * drift, and a tap still opens the lightbox — because pinning only fixes the
 * section's position; it never touches its pointer events. Under reduced
 * motion there is no pin and the marquee falls back to a plain static grid.
 */
const CinematicGallery = ({ photos, reduced }: Props) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  // GALLERY.TOUCH.1: tap/click a photo → the shared lightbox at that index.
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({
    open: false,
    index: 0,
  });
  const openLightbox = (index: number) => setLightbox({ open: true, index });

  const altFor = (p: CinematicPhoto, i: number) =>
    p.alt_text && p.alt_text.trim().length > 0
      ? p.alt_text
      : t("gallery.imageAlt", { number: i + 1 });

  useLayoutEffect(() => {
    if (reduced || photos.length === 0) return;

    const ctx = gsap.context(() => {
      const track = trackRef.current!;
      // The track is two identical copies laid side by side. Shifting left by
      // exactly 50% of its width lands copy #2 where copy #1 began — visually
      // identical, so repeating from 0 is seamless. ~4s per photo keeps the
      // pace constant regardless of how many photos there are.
      tweenRef.current = gsap.to(track, {
        xPercent: -50,
        ease: "none",
        duration: photos.length * 4,
        repeat: -1,
      });

      // REVIEW.3a — the uniform dwell. Same grammar as the About pin: the act
      // holds the frame for +=120% before it releases. The marquee tween above
      // is time-driven, not scroll-driven, so it keeps drifting through the
      // dwell — the pin freezes the section's place on the page, not its life.
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=120%",
        pin: true,
        anticipatePin: 1,
      });
    }, sectionRef);

    // This effect waits for the async photos, so its pin is born AFTER the acts
    // below it already measured. Same hazard as the reel's wide rebuild: a
    // trigger registered out of document order makes every later pinned act
    // measure without this pin's spacer. Re-sort, then refresh.
    ScrollTrigger.sort();
    ScrollTrigger.refresh();

    return () => {
      tweenRef.current = null;
      ctx.revert();
    };
  }, [reduced, photos.length]);

  const pause = () => tweenRef.current?.pause();
  const resume = () => tweenRef.current?.resume();

  const heading = (
    <div className="mb-10 px-6 text-center">
      <p className="text-caps mb-3" style={{ color: "#C9A55C" }}>
        {t("gallery.eyebrow")}
      </p>
      <h2
        data-qa="section-heading"
        className="text-3xl md:text-4xl"
        style={{ fontFamily: "var(--font-display)", color: "#f4ecdb" }}
      >
        {t("gallery.title")}
      </h2>
    </div>
  );

  // Reduced motion: standard static vertical grid (no drift, no duplication).
  if (reduced) {
    return (
      <section ref={sectionRef} data-qa="cinematic-gallery" className="relative px-6 py-20">
        {heading}
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 md:grid-cols-3">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              data-qa="gallery-photo"
              onClick={() => openLightbox(i)}
              className="block aspect-[4/5] w-full overflow-hidden rounded-sm"
            >
              <img
                src={p.image_url}
                alt={altFor(p, i)}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
        <p className="mt-10 text-center text-caps" style={{ color: "rgba(240,233,218,0.7)" }}>
          {photos.length} · {t("gallery.title")}
        </p>
        <PhotoLightbox
          photos={photos}
          open={lightbox.open}
          initialIndex={lightbox.index}
          onClose={() => setLightbox((s) => ({ ...s, open: false }))}
        />
      </section>
    );
  }

  // Two copies of the photo list for a seamless wrap. The second copy is
  // aria-hidden so assistive tech doesn't announce every photo twice.
  const doubled = photos.length > 0 ? [...photos, ...photos] : [];

  return (
    <section ref={sectionRef} data-qa="cinematic-gallery" className="relative overflow-hidden py-14 md:py-16">
      {heading}

      <div
        data-qa="cinematic-marquee"
        className="relative overflow-hidden"
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
        onTouchCancel={resume}
      >
        <div
          ref={trackRef}
          data-qa="cinematic-marquee-track"
          className="flex w-max items-center"
          style={{ willChange: "transform" }}
        >
          {doubled.map((p, i) => {
            const isClone = i >= photos.length;
            const originalIndex = i % photos.length;
            return (
              <figure
                key={i}
                aria-hidden={isClone}
                className="relative mr-6 aspect-[4/5] h-[56svh] shrink-0 overflow-hidden rounded-sm md:mr-8"
              >
                {/* GALLERY.TOUCH.1: every tile (clones included, mapped back
                    to the original index) opens the lightbox at that photo. */}
                <button
                  type="button"
                  data-qa="gallery-photo"
                  tabIndex={isClone ? -1 : undefined}
                  onClick={() => openLightbox(originalIndex)}
                  className="block h-full w-full"
                >
                  <img
                    src={p.image_url}
                    alt={isClone ? "" : altFor(p, originalIndex)}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </button>
              </figure>
            );
          })}
        </div>
      </div>

      <p className="mt-10 text-center text-caps" style={{ color: "rgba(240,233,218,0.7)" }}>
        {photos.length} · {t("gallery.title")}
      </p>

      <PhotoLightbox
        photos={photos}
        open={lightbox.open}
        initialIndex={lightbox.index}
        onClose={() => setLightbox((s) => ({ ...s, open: false }))}
      />
    </section>
  );
};

export default CinematicGallery;

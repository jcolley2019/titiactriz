import { useEffect, useRef, useState } from "react";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/Section";
import { LinkCard } from "@/components/Cards";
import CosmicBackground from "@/components/CosmicBackground";
import ScrollReveal, { StaggerContainer, StaggerItem } from "@/components/ScrollReveal";
import ParallaxImage from "@/components/ParallaxImage";
import Gallery from "@/components/Gallery";

import aboutImage from "@/assets/cristyna-meet.webp";
import danceImage from "@/assets/cristyna-dance.webp";
import titansLogo from "@/assets/titans-logo.webp";
import titansLogoRed from "@/assets/titans-logo-red.webp";
import greenworldLogo from "@/assets/greenworld-logo-hd.webp";
import cpMonogramAsset from "@/assets/cp-monogram-transparent.png.asset.json";
import cornerOrnAsset from "@/assets/cp-corner-ornament-v2.png.asset.json";


const heroPortrait = "/hero-portrait.webp";

const contactSchema = z.object({
  name: z.string().trim().min(2, { message: "Name must be at least 2 characters" }).max(100, { message: "Name must be less than 100 characters" }),
  email: z.string().trim().email({ message: "Please enter a valid email address" }).max(255, { message: "Email must be less than 255 characters" }),
  message: z.string().trim().min(10, { message: "Message must be at least 10 characters" }).max(1000, { message: "Message must be less than 1000 characters" }),
});
type ContactFormData = z.infer<typeof contactSchema>;

/**
 * Editorial home variant.
 * Font system is defined here via CSS variables --font-display + --font-sans
 * so swapping a pairing is a one-spot edit. Defaults: Cinzel + Jost.
 */
const editorialFontVars: React.CSSProperties = {
  ["--font-display" as any]: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  ["--font-sans" as any]: "'Jost', 'Outfit', system-ui, sans-serif",
  fontFamily: "var(--font-sans)",
};

const GOLD = "#C9A55C";
const CREAM = "#ffffff";

const HomeEditorial = () => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const [introStarted, setIntroStarted] = useState(false);
  const [framePlay, setFramePlay] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({ resolver: zodResolver(contactSchema) });

  useEffect(() => {
    setIntroStarted(true);
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setFramePlay(e.isIntersecting),
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const { data: responseData, error } = await supabase.functions.invoke("send-contact", {
        body: { type: "general", name: data.name, email: data.email, message: data.message },
      });
      if (error || responseData?.error) {
        alert(responseData?.error || "There was an error sending your message. Please try again.");
        return;
      }
      try {
        await fetch("https://formspree.io/f/maqzwogl", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            message: data.message,
            _subject: `New contact form submission from ${data.name}`,
          }),
        });
      } catch {}
      setSubmitSuccess(true);
      reset();
      setTimeout(() => setSubmitSuccess(false), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };


  // Delicate gold filigree corner ornament — drawn in a 100x100 viewBox.
  // Faces top-left by default; rotated for the other 3 corners.
  const CornerOrnament = ({ rotate = 0 }: { rotate?: number }) => (
    <svg
      viewBox="0 0 100 100"
      className="absolute w-[44px] sm:w-[56px] md:w-[72px] lg:w-[88px] aspect-square"
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden
    >
      <g fill="none" stroke={GOLD} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
        {/* main scroll curl */}
        <path d="M8 38 C 8 18, 18 8, 38 8" />
        <path d="M14 32 C 18 22, 22 18, 32 14" />
        {/* inner spiral */}
        <path d="M22 22 C 26 18, 32 18, 34 22 C 36 26, 32 30, 28 28 C 25 26, 26 22, 30 22" />
        {/* leaf sprigs */}
        <path d="M38 8 C 46 10, 52 14, 56 20" />
        <path d="M50 12 C 52 14, 53 17, 52 20 C 49 20, 47 18, 47 15 Z" fill={GOLD} fillOpacity="0.85" stroke="none" />
        <path d="M8 38 C 10 46, 14 52, 20 56" />
        <path d="M12 50 C 14 52, 17 53, 20 52 C 20 49, 18 47, 15 47 Z" fill={GOLD} fillOpacity="0.85" stroke="none" />
        {/* small dot accents */}
        <circle cx="40" cy="40" r="0.9" fill={GOLD} stroke="none" />
        <circle cx="22" cy="22" r="0.7" fill={GOLD} stroke="none" />
      </g>
    </svg>
  );

  // Small floral center ornament for the divider
  const DividerOrnament = () => (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden>
      <g fill={GOLD} stroke={GOLD} strokeWidth="0.6" strokeLinejoin="round">
        <path d="M12 3 C 13.5 7.5, 13.5 10.5, 12 12 C 10.5 10.5, 10.5 7.5, 12 3 Z" />
        <path d="M12 21 C 10.5 16.5, 10.5 13.5, 12 12 C 13.5 13.5, 13.5 16.5, 12 21 Z" />
        <path d="M3 12 C 7.5 10.5, 10.5 10.5, 12 12 C 10.5 13.5, 7.5 13.5, 3 12 Z" />
        <path d="M21 12 C 16.5 13.5, 13.5 13.5, 12 12 C 13.5 10.5, 16.5 10.5, 21 12 Z" />
        <circle cx="12" cy="12" r="1.1" />
      </g>
    </svg>
  );

  // CP monogram — transparent PNG
  const CPMonogram = () => (
    <img
      src={cpMonogramAsset.url}
      alt="CP monogram"
      draggable={false}
      className="mx-auto mt-8 block h-auto w-[90px] md:w-[120px] select-none pointer-events-none"
    />
  );






  return (
    <div style={editorialFontVars}>
      <SEO
        path="/"
        title="Cristyna Polentino | Actriz, Bailarina y Empresaria en Medellín"
        description="Actriz colombiana, bailarina profesional y empresaria en Medellín. Portafolio, Titans Agency y Green World."
      />

      <CosmicBackground />

      {/* ===== EDITORIAL HERO ===== */}
      <section
        ref={heroRef}
        className={
          "relative min-h-[calc(100svh-100px)] md:min-h-[100vh] flex items-stretch md:items-center justify-center overflow-hidden px-4 md:px-12 pt-[72px] md:pt-24 pb-2 md:pb-12 " +
          (introStarted ? "editorial-intro " : "") +
          (framePlay ? "editorial-hero-play" : "")
        }
        style={{ backgroundColor: "#0e0c09" }}
      >
        {/* Contained, centered hero box */}
        <div className="relative mx-auto w-full max-w-6xl flex flex-col justify-center min-h-[calc(100svh-122px)] md:min-h-0 px-5 pt-4 pb-5 md:p-14">

          {/* Four solid gold border bars */}
          <span
            aria-hidden
            className="editorial-frame-top absolute top-0 left-0 right-0 h-[1.5px]"
            style={{ backgroundColor: GOLD }}
          />
          <span
            aria-hidden
            className="editorial-frame-right absolute top-0 right-0 bottom-0 w-[1.5px]"
            style={{ backgroundColor: GOLD }}
          />
          <span
            aria-hidden
            className="editorial-frame-bottom absolute bottom-0 left-0 right-0 h-[1.5px]"
            style={{ backgroundColor: GOLD }}
          />
          <span
            aria-hidden
            className="editorial-frame-left absolute top-0 left-0 bottom-0 w-[1.5px]"
            style={{ backgroundColor: GOLD }}
          />

          {/* Four corner flourishes */}
          <img
            aria-hidden
            src={cornerOrnAsset.url}
            alt=""
            className="editorial-frame-corner absolute top-2 left-2 md:top-3 md:left-3 w-[48px] sm:w-[64px] md:w-[80px] h-auto select-none pointer-events-none z-20"
          />
          <img
            aria-hidden
            src={cornerOrnAsset.url}
            alt=""
            className="editorial-frame-corner absolute top-2 right-2 md:top-3 md:right-3 w-[48px] sm:w-[64px] md:w-[80px] h-auto select-none pointer-events-none z-20 -scale-x-100"
          />
          <img
            aria-hidden
            src={cornerOrnAsset.url}
            alt=""
            className="editorial-frame-corner absolute bottom-2 left-2 md:bottom-3 md:left-3 w-[48px] sm:w-[64px] md:w-[80px] h-auto select-none pointer-events-none z-20 -scale-y-100"
          />
          <img
            aria-hidden
            src={cornerOrnAsset.url}
            alt=""
            className="editorial-frame-corner absolute bottom-2 right-2 md:bottom-3 md:right-3 w-[48px] sm:w-[64px] md:w-[80px] h-auto select-none pointer-events-none z-20 -scale-100"
          />

          <div className="grid lg:grid-cols-2 gap-3 lg:gap-12 items-center relative z-10">
            {/* LEFT: name lockup */}
            <div className="order-2 lg:order-1 flex w-full flex-col items-center text-center">
              <div className="editorial-title mx-auto w-fit text-center">
                <h1
                  className="leading-[0.95] tracking-[0.04em] uppercase"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <span
                    className="block font-normal"
                    style={{ color: CREAM, fontSize: "clamp(2rem, 7vw, 4.25rem)" }}
                  >
                    Cristyna
                  </span>
                  <span
                    className="block font-normal mt-1 sm:mt-2"
                    style={{ color: GOLD, fontSize: "clamp(2rem, 7vw, 4.25rem)" }}
                  >
                    Polentino
                  </span>
                </h1>

                {/* Divider with center diamond drawing outward */}
                <div
                  className="mt-1.5 sm:mt-4 flex w-full items-center justify-center gap-2"
                  aria-hidden
                >
                  <span className="editorial-divider-half editorial-divider-left flex-1" />
                  <svg
                    viewBox="0 0 16 16"
                    className="editorial-divider-diamond w-3 h-3 shrink-0"
                  >
                    <rect
                      x="3"
                      y="3"
                      width="10"
                      height="10"
                      transform="rotate(45 8 8)"
                      fill={GOLD}
                    />
                  </svg>
                  <span className="editorial-divider-half editorial-divider-right flex-1" />
                </div>
              </div>

              <p
                className="editorial-roles uppercase mt-3 sm:mt-5"
                style={{
                  color: CREAM,
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(0.625rem, 1.4vw, 0.875rem)",
                  letterSpacing: "0.35em",
                }}
              >
                {t("hero.rolesLine")}
              </p>

              <div className="editorial-subtitle max-w-md mt-2 sm:mt-5 flex flex-col gap-2.5 sm:gap-3">

                <p
                  className="italic leading-relaxed"
                  style={{
                    color: CREAM,
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(0.95rem, 2vw, 1.25rem)",
                  }}
                >
                  {t("hero.tagline")}
                </p>
                <p
                  className="leading-relaxed hidden sm:block"
                  style={{
                    color: "rgba(240, 233, 218, 0.72)",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 300,
                    fontSize: "clamp(0.8rem, 1.4vw, 0.95rem)",
                  }}
                >
                  {t("hero.subtitle")}
                </p>
              </div>

              {/* Monogram hands off to CTA buttons (same grid cell, no layout shift) */}
              <div className="relative mx-auto mt-5 sm:mt-6 mb-1 sm:mb-0 flex min-h-[56px] sm:min-h-[64px] w-full items-center justify-center">

                <span
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  <img
                    src={cpMonogramAsset.url}
                    alt="CP monogram"
                    draggable={false}
                    className="editorial-monogram block h-auto w-[90px] md:w-[120px] select-none"
                  />
                </span>

                <div
                  className="editorial-cta flex flex-wrap items-center justify-center gap-3 sm:gap-4"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  <Link
                    to="/work"
                    className="inline-flex items-center justify-center px-6 py-2.5 text-xs uppercase tracking-[0.2em] font-medium transition-all duration-300 hover:-translate-y-0.5"
                    style={{ backgroundColor: GOLD, color: "#0e0c09" }}
                  >
                    {t("hero.ctaPortfolio")}
                  </Link>
                  <a
                    href="https://us.world-food.com/#/shareLoginIn&MjI1Mjg0Mjc7MjIyNjUyNDg7MjAyNi0wMy0wNyAxOToyNDo1NQ=="
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-6 py-2.5 text-xs uppercase tracking-[0.2em] font-medium border transition-all duration-300 hover:-translate-y-0.5"
                    style={{ color: CREAM, borderColor: GOLD }}
                  >
                    Green World
                  </a>
                  <Link
                    to="/titans-agency"
                    className="inline-flex items-center justify-center px-6 py-2.5 text-xs uppercase tracking-[0.2em] font-medium border transition-all duration-300 hover:-translate-y-0.5"
                    style={{ color: CREAM, borderColor: GOLD }}
                  >
                    Titans Agency
                  </Link>
                </div>
              </div>
            </div>


            {/* RIGHT: portrait */}
            <div className="order-1 lg:order-2 flex justify-center lg:justify-end items-end">
              <img
                src={heroPortrait}
                alt="Cristyna Polentino"
                className="w-full max-w-[260px] sm:max-w-[400px] lg:max-w-[460px] max-h-[44svh] sm:max-h-[64vh] lg:max-h-none h-auto object-contain sm:object-contain"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>

          </div>
        </div>
      </section>




      <section className="py-10 sm:py-14 md:py-16 relative z-10">
        <div className="container-editorial text-center">
          <ScrollReveal>
            <p
              className="text-caps mb-4"
              style={{ color: GOLD, fontFamily: "var(--font-sans)" }}
            >
              {t("hero.guidedBy")}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.15}>
            <h2
              className="text-3xl md:text-5xl lg:text-6xl text-foreground leading-tight max-w-3xl mx-auto"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("hero.guidedByText")}
            </h2>
          </ScrollReveal>
        </div>
      </section>

      <Section id="about" animate={false}>
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <ScrollReveal direction="left">
            <div className="relative">
              <ParallaxImage
                src={aboutImage}
                alt="Cristyna Polentino (Titi) on set"
                containerClassName="rounded-sm"
                className="animate-color-reveal hover:grayscale-0 transition-all duration-700"
                speed={0.1}
                width={768}
                height={1025}
                loading="lazy"
              />
              <div className="absolute -bottom-4 -right-4 w-full h-full border border-accent/20 rounded-sm -z-10" />
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={0.1}>
            <div style={{ fontFamily: "var(--font-sans)" }}>
              <p
                className="text-caps mb-4"
                style={{ color: GOLD, fontFamily: "var(--font-sans)" }}
              >
                {t("about.eyebrow")}
              </p>
              <h2
                className="text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight mb-6"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("about.title")}
              </h2>
              <div className="space-y-5 text-muted-foreground leading-relaxed mb-10">
                <p>{t("about.p1")}</p>
                <p>{t("about.p2")}</p>
                <p>{t("about.p3")}</p>
              </div>
              <div className="flex flex-wrap gap-3 mb-10">
                {[
                  t("about.strengths.presence"),
                  t("about.strengths.discipline"),
                  t("about.strengths.creative"),
                  t("about.strengths.brand"),
                ].map((strength) => (
                  <span
                    key={strength}
                    className="px-4 py-2 rounded-none bg-secondary/50 text-foreground/80 text-sm border border-border/50"
                  >
                    {strength}
                  </span>
                ))}
              </div>
              <Button variant="editorial-outline" size="lg" asChild>
                <Link to="/work">
                  {t("about.viewWork")}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </Section>

      <Gallery />

      <Section id="featured">
        <SectionHeader
          eyebrow={t("featured.eyebrow")}
          title={t("featured.title")}
          subtitle={t("featured.subtitle")}
        />
        <StaggerContainer className="grid md:grid-cols-3 gap-8">
          <StaggerItem>
            <LinkCard
              title={t("featured.titans.title")}
              description={t("featured.titans.description")}
              href="/titans-agency"
              image={titansLogo}
              hoverImage={titansLogoRed}
              imageBackground="dark"
              hoverColor="red"
            />
          </StaggerItem>
          <StaggerItem>
            <LinkCard
              title={t("featured.greenWorld.title")}
              description={t("featured.greenWorld.description")}
              href="https://us.world-food.com/#/shareLoginIn&MjI1Mjg0Mjc7MjIyNjUyNDg7MjAyNi0wMy0wNyAxOToyNDo1NQ=="
              image={greenworldLogo}
              imageBackground="dark"
              hoverColor="green"
            />
          </StaggerItem>
          <StaggerItem>
            <LinkCard
              title={t("featured.work.title")}
              description={t("featured.work.description")}
              href="/work"
              image={danceImage}
              imageFit="cover"
              hoverColor="gold"
            />
          </StaggerItem>
        </StaggerContainer>
      </Section>

      <Section id="contact" background="accent">
        <div className="max-w-2xl mx-auto text-center">
          <SectionHeader
            eyebrow={t("contact.eyebrow")}
            title={t("contact.title")}
            subtitle={t("contact.subtitle")}
          />
          <div className="mb-10">
            <a
              href="mailto:hola@titiactriz.com"
              className="text-2xl md:text-3xl text-foreground hover:text-accent transition-colors duration-300"
              style={{ fontFamily: "var(--font-display)" }}
            >
              hola@titiactriz.com
            </a>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-left">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                  {t("contact.form.name")}
                </label>
                <input
                  type="text"
                  id="name"
                  {...register("name")}
                  className={`w-full h-12 px-4 rounded-none border bg-background/50 backdrop-blur text-foreground focus:outline-none focus:ring-1 focus:ring-accent ${
                    errors.name ? "border-destructive" : "border-border"
                  }`}
                  placeholder={t("contact.form.namePlaceholder")}
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  {t("contact.form.email")}
                </label>
                <input
                  type="email"
                  id="email"
                  {...register("email")}
                  className={`w-full h-12 px-4 rounded-none border bg-background/50 backdrop-blur text-foreground focus:outline-none focus:ring-1 focus:ring-accent ${
                    errors.email ? "border-destructive" : "border-border"
                  }`}
                  placeholder={t("contact.form.emailPlaceholder")}
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                {t("contact.form.message")}
              </label>
              <textarea
                id="message"
                {...register("message")}
                rows={5}
                className={`w-full px-4 py-3 rounded-none border bg-background/50 backdrop-blur text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none ${
                  errors.message ? "border-destructive" : "border-border"
                }`}
                placeholder={t("contact.form.messagePlaceholder")}
              />
              {errors.message && <p className="text-xs text-destructive mt-1">{errors.message.message}</p>}
            </div>
            {submitSuccess && (
              <div className="p-4 rounded-none bg-accent/20 border border-accent/50 text-foreground text-sm">
                {t("contact.form.success") || "Thank you! Your message has been received."}
              </div>
            )}
            <Button type="submit" variant="editorial" size="lg" className="w-full sm:w-auto" disabled={isSubmitting}>
              {isSubmitting ? t("contact.form.sending") || "Sending..." : t("contact.form.submit")}
            </Button>
          </form>
        </div>
      </Section>
    </div>
  );
};

export default HomeEditorial;

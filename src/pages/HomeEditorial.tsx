import { useEffect, useState } from "react";
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
const CREAM = "#f3efe7";

const HomeEditorial = () => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [frameVisible, setFrameVisible] = useState(true);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({ resolver: zodResolver(contactSchema) });

  useEffect(() => {
    if (prefersReducedMotion) return;
    const t1 = window.setTimeout(() => setFrameVisible(false), 7000); // 0.8s delay + 1.5s draw + 0.6s corners + ~4s hold
    return () => window.clearTimeout(t1);
  }, [prefersReducedMotion]);

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
        className="relative min-h-[100vh] flex items-center overflow-hidden"
        style={{ backgroundColor: "#0e0c09" }}
      >
        <div className="w-full px-4 sm:px-6 pt-32 pb-16 md:pt-36 md:pb-20">
          {/* Centered hero card — frame draws around THIS */}
          <div className="relative mx-auto w-full max-w-[1150px] aspect-[16/10] md:aspect-[16/9] min-h-[560px] md:min-h-0">
            {/* Animated gold frame (around the card) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-[1500ms]"
              style={{ opacity: frameVisible ? 1 : 0 }}
            >
              <svg
                className="absolute inset-0 w-full h-full overflow-visible"
                preserveAspectRatio="none"
                viewBox="0 0 1000 1000"
              >
                {/* Perimeter — 4 sides draw simultaneously after a short beat */}
                {[
                  "M 0 0 L 1000 0",
                  "M 1000 0 L 1000 1000",
                  "M 1000 1000 L 0 1000",
                  "M 0 1000 L 0 0",
                ].map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke={GOLD}
                    strokeWidth="1.25"
                    vectorEffect="non-scaling-stroke"
                    pathLength={100}
                    strokeDasharray="100"
                    strokeDashoffset={prefersReducedMotion ? 0 : 100}
                    style={{
                      animation: prefersReducedMotion
                        ? undefined
                        : "editorial-frame-draw 1.5s ease-out 0.8s forwards",
                    }}
                  />
                ))}

                {/* Ornamental corner accents — small flourishes */}
                {[
                  // top-left
                  "M 14 44 L 14 14 L 44 14 M 14 26 L 26 14 M 22 14 L 14 22",
                  // top-right
                  "M 956 14 L 986 14 L 986 44 M 974 14 L 986 26 M 986 22 L 978 14",
                  // bottom-right
                  "M 986 956 L 986 986 L 956 986 M 986 974 L 974 986 M 978 986 L 986 978",
                  // bottom-left
                  "M 44 986 L 14 986 L 14 956 M 26 986 L 14 974 M 14 978 L 22 986",
                ].map((d, i) => (
                  <path
                    key={`c${i}`}
                    d={d}
                    fill="none"
                    stroke={GOLD}
                    strokeWidth="1.25"
                    vectorEffect="non-scaling-stroke"
                    pathLength={100}
                    strokeDasharray="100"
                    strokeDashoffset={prefersReducedMotion ? 0 : 100}
                    style={{
                      animation: prefersReducedMotion
                        ? undefined
                        : "editorial-frame-draw 0.6s ease-out 2.3s forwards",
                    }}
                  />
                ))}
              </svg>
            </div>

            {/* Card content */}
            <div className="relative z-10 h-full px-6 sm:px-10 md:px-14 py-8 md:py-10">
              <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center h-full">
                <div className="order-2 lg:order-1 flex flex-col items-center text-center">
                  <h1
                    className="leading-[0.95] tracking-[0.04em] uppercase"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    <span
                      className="block text-4xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl font-normal"
                      style={{ color: CREAM }}
                    >
                      Cristyna
                    </span>
                    <span
                      className="block text-4xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl font-normal mt-2"
                      style={{ color: GOLD }}
                    >
                      Polentino
                    </span>
                  </h1>

                  <div
                    className="relative my-5 sm:my-6 flex items-center justify-center w-full max-w-[14ch]"
                    aria-hidden
                  >
                    <span
                      className="block h-px w-full origin-center"
                      style={{
                        backgroundColor: GOLD,
                        transform: prefersReducedMotion ? "scaleX(1)" : "scaleX(0)",
                        animation: prefersReducedMotion
                          ? undefined
                          : "editorial-divider-grow 1.5s ease-out 0.8s forwards",
                      }}
                    />
                    <span
                      className="absolute left-1/2 -translate-x-1/2 rotate-45 w-2 h-2"
                      style={{
                        backgroundColor: GOLD,
                        opacity: prefersReducedMotion ? 1 : 0,
                        animation: prefersReducedMotion
                          ? undefined
                          : "editorial-corner-fade 0.6s ease-out 2.0s forwards",
                      }}
                    />
                  </div>

                  <p
                    className="text-[10px] sm:text-xs md:text-sm uppercase tracking-[0.35em] mb-5"
                    style={{ color: CREAM, fontFamily: "var(--font-sans)" }}
                  >
                    Actriz&nbsp;&nbsp;·&nbsp;&nbsp;Empresaria&nbsp;&nbsp;·&nbsp;&nbsp;Streamer
                  </p>

                  <p
                    className="italic text-base sm:text-lg md:text-xl leading-relaxed max-w-md"
                    style={{ color: CREAM, fontFamily: "var(--font-display)" }}
                  >
                    Creo impacto a través de la presencia, la actuación y el propósito.
                  </p>
                </div>

                <div className="order-1 lg:order-2 flex justify-center items-center h-full">
                  <img
                    src={heroPortrait}
                    alt="Cristyna Polentino"
                    className="w-full max-w-[460px] h-full max-h-full object-contain"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                </div>
              </div>
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

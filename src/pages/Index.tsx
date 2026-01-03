import { useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Target, Zap, Heart, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/Section";
import { FeatureCard, LinkCard } from "@/components/Cards";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import CosmicBackground from "@/components/CosmicBackground";
import HeroPortrait from "@/components/HeroPortrait";

// Images
import heroImage from "@/assets/cristyna-hero.jpg";
import aboutImage from "@/assets/cristyna-about.jpg";
import danceImage from "@/assets/cristyna-dance.jpg";
import sunsetImage from "@/assets/cristyna-sunset.jpg";
import lifestyleImage from "@/assets/cristyna-lifestyle.jpg";
import poolImage from "@/assets/cristyna-pool.jpg";
import titi2Image from "@/assets/cristyna-titi2.jpg";
import titi3Image from "@/assets/cristyna-titi3.jpg";
import titi5Image from "@/assets/cristyna-titi5.jpg";
import miami1Image from "@/assets/cristyna-miami1.jpg";
import miami3Image from "@/assets/cristyna-miami3.jpg";
import miami2Image from "@/assets/cristyna-miami2.jpg";
import gallery1Image from "@/assets/cristyna-gallery1.jpg";
import gallery2Image from "@/assets/cristyna-gallery2.jpg";
import gallery3Image from "@/assets/cristyna-gallery3.jpg";
import gallery4Image from "@/assets/cristyna-gallery4.jpg";
import gallery5Image from "@/assets/cristyna-gallery5.jpg";
import gallery6Image from "@/assets/cristyna-gallery6.jpg";
import gallery7Image from "@/assets/cristyna-gallery7.jpg";
import gallery8Image from "@/assets/cristyna-gallery8.jpg";
import gallery9Image from "@/assets/cristyna-gallery9.jpg";
import gallery10Image from "@/assets/cristyna-gallery10.jpg";

const galleryImages = [
  titi5Image, sunsetImage, lifestyleImage, 
  poolImage, titi3Image, miami1Image, miami3Image,
  gallery1Image, gallery2Image, gallery3Image, gallery4Image,
  gallery5Image, gallery6Image, gallery7Image, miami2Image,
  gallery8Image, gallery9Image, gallery10Image
];

// Contact form validation schema
const contactSchema = z.object({
  name: z.string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be less than 100 characters" }),
  email: z.string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  message: z.string()
    .trim()
    .min(10, { message: "Message must be at least 10 characters" })
    .max(1000, { message: "Message must be less than 1000 characters" }),
});

type ContactFormData = z.infer<typeof contactSchema>;

const Index = () => {
  const { t } = useTranslation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setSubmitSuccess(true);
    reset();
    setIsSubmitting(false);
    setTimeout(() => setSubmitSuccess(false), 3000);
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Cristyna Polentino | Colombian Actress, Dancer & Entrepreneur</title>
        <meta
          name="description"
          content="Cristyna Polentino - Colombian actress, professional dance performer, and entrepreneur. Presence, performance, and purpose—on stage and on screen."
        />
        <meta property="og:title" content="Cristyna Polentino" />
        <meta
          property="og:description"
          content="Colombian actress, professional dancer, and entrepreneur creating impact through presence, performance, and purpose."
        />
        <meta property="og:type" content="website" />
      </Helmet>

      <CosmicBackground />

      {/* Hero Section - Full Screen with Overlay Card */}
      <section className="min-h-screen relative flex items-center overflow-hidden">
        {/* Contained Hero Image with Background Removed - Center Right on Desktop */}
        <div className="hidden lg:block absolute top-[35%] right-[5%] xl:right-[10%] -translate-y-1/2 z-[1] opacity-0 animate-scale-in stagger-1">
          <div className="relative w-[550px] xl:w-[620px] 2xl:w-[700px]">
            <HeroPortrait
              src={aboutImage}
              alt="Cristyna Polentino"
              className="w-full h-auto object-cover drop-shadow-2xl"
            />
          </div>
        </div>

        <div className="container-editorial relative z-10 pt-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center min-h-[80vh]">
            {/* Left - Hero Image (visible on mobile/tablet only) */}
            <div className="lg:hidden order-1 opacity-0 animate-scale-in stagger-1">
              <div className="relative max-w-sm mx-auto">
                <HeroPortrait
                  src={aboutImage}
                  alt="Cristyna Polentino"
                  className="w-full h-auto rounded-sm"
                />
              </div>
            </div>

            {/* Left - Text Card on Desktop */}
            <div className="order-2 lg:order-1 lg:col-start-1 flex justify-center lg:justify-start">
              <div className="hero-card max-w-xl opacity-0 animate-slide-up stagger-2">
                {/* Tagline */}
                <p className="text-caps text-charcoal/60 mb-6 opacity-0 animate-fade-up stagger-3">
                  {t("hero.tagline")}
                </p>

                {/* Main headline with highlight effect */}
                <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-charcoal leading-[1.2] mb-8">
                  <span className="inline bg-gold/20 px-2 py-1 -mx-2">{t("hero.subtitle")}</span>{" "}
                  <span className="block mt-3">
                    that inspire presence, performance, and purpose.
                  </span>
                </h1>

                {/* CTA Button */}
                <div className="opacity-0 animate-fade-up stagger-4">
                  <Button variant="editorial" size="lg" asChild>
                    <a href="#contact">
                      {t("hero.cta")}
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 opacity-0 animate-fade-in stagger-6">
          <div className="flex flex-col items-center gap-2 text-foreground/50">
            <span className="text-xs tracking-widest uppercase">Scroll</span>
            <div className="w-px h-8 bg-gradient-to-b from-foreground/50 to-transparent" />
          </div>
        </div>
      </section>

      {/* Guided By Section */}
      <section className="py-20 md:py-28 relative z-10">
        <div className="container-editorial text-center">
          <p className="text-caps text-accent mb-4 opacity-0 animate-fade-up">
            Guided by a desire to...
          </p>
          <h2 className="font-serif text-3xl md:text-5xl lg:text-6xl text-foreground leading-tight max-w-3xl mx-auto opacity-0 animate-fade-up stagger-1">
            awaken curiosity, creativity, and connection.
          </h2>
        </div>
      </section>

      {/* Image Gallery Strip */}
      <section className="py-8 relative z-10">
        {/* Scroll Buttons */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 transition-all duration-300"
          aria-label={t("gallery.scrollLeft")}
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <button
          onClick={() => scroll("right")}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 transition-all duration-300"
          aria-label={t("gallery.scrollRight")}
        >
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-6 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {galleryImages.map((img, i) => (
            <div
              key={i}
              onClick={() => setSelectedImage(img)}
              className="flex-shrink-0 w-56 h-72 rounded-sm overflow-hidden cursor-pointer group"
            >
              <img
                src={img}
                alt={t("gallery.imageAlt", { number: i + 1 })}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Lightbox Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 z-50 w-12 h-12 rounded-full bg-background/90 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background transition-all duration-300"
            aria-label={t("gallery.close")}
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Enlarged gallery image"
              className="w-full h-auto max-h-[85vh] object-contain rounded-sm"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Meet Cristyna Section */}
      <Section id="about">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className="relative opacity-0 animate-scale-in">
            <img
              src={heroImage}
              alt="Cristyna Polentino portrait"
              className="w-full h-auto rounded-sm grayscale hover:grayscale-0 transition-all duration-700"
            />
            {/* Decorative frame */}
            <div className="absolute -bottom-4 -right-4 w-full h-full border border-accent/20 rounded-sm -z-10" />
          </div>

          <div className="opacity-0 animate-fade-up stagger-1">
            <SectionHeader
              eyebrow={t("about.eyebrow")}
              title={t("about.title")}
              centered={false}
              className="text-left"
            />

            <div className="space-y-5 text-muted-foreground leading-relaxed mb-10">
              <p>{t("about.p1")}</p>
              <p>{t("about.p2")}</p>
              <p>{t("about.p3")}</p>
            </div>

            {/* Signature Strengths */}
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
        </div>
      </Section>

      {/* What I Bring Section */}
      <Section background="muted">
        <SectionHeader
          eyebrow={t("strengths.eyebrow")}
          title={t("strengths.title")}
          subtitle={t("strengths.subtitle")}
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<Sparkles className="w-6 h-6" />}
            title={t("strengths.presence.title")}
            description={t("strengths.presence.description")}
          />
          <FeatureCard
            icon={<Heart className="w-6 h-6" />}
            title={t("strengths.creativity.title")}
            description={t("strengths.creativity.description")}
          />
          <FeatureCard
            icon={<Target className="w-6 h-6" />}
            title={t("strengths.discipline.title")}
            description={t("strengths.discipline.description")}
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title={t("strengths.adaptability.title")}
            description={t("strengths.adaptability.description")}
          />
        </div>
      </Section>

      {/* Featured Links Section */}
      <Section id="featured">
        <SectionHeader
          eyebrow={t("featured.eyebrow")}
          title={t("featured.title")}
          subtitle={t("featured.subtitle")}
        />

        <div className="grid md:grid-cols-3 gap-8">
          <LinkCard
            title={t("featured.titans.title")}
            description={t("featured.titans.description")}
            href="/titans-agency"
            image={heroImage}
          />
          <LinkCard
            title={t("featured.greenWorld.title")}
            description={t("featured.greenWorld.description")}
            href="/green-world"
            image={danceImage}
          />
          <LinkCard
            title={t("featured.work.title")}
            description={t("featured.work.description")}
            href="/work"
            image={danceImage}
          />
        </div>
      </Section>

      {/* Contact Section */}
      <Section id="contact" background="accent">
        <div className="max-w-2xl mx-auto text-center">
          <SectionHeader
            eyebrow={t("contact.eyebrow")}
            title={t("contact.title")}
            subtitle={t("contact.subtitle")}
          />

          <div className="mb-10">
            <a
              href="mailto:yourname@email.com"
              className="font-serif text-2xl md:text-3xl text-foreground hover:text-accent transition-colors duration-300"
            >
              yourname@email.com
            </a>
          </div>

          {/* Contact Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-left">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  {t("contact.form.name")}
                </label>
                <input
                  type="text"
                  id="name"
                  {...register("name")}
                  className={`w-full h-12 px-4 rounded-none border bg-background/50 backdrop-blur text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent transition-all duration-300 ${
                    errors.name ? "border-destructive" : "border-border"
                  }`}
                  placeholder={t("contact.form.namePlaceholder")}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  {t("contact.form.email")}
                </label>
                <input
                  type="email"
                  id="email"
                  {...register("email")}
                  className={`w-full h-12 px-4 rounded-none border bg-background/50 backdrop-blur text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent transition-all duration-300 ${
                    errors.email ? "border-destructive" : "border-border"
                  }`}
                  placeholder={t("contact.form.emailPlaceholder")}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
            </div>
            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-foreground mb-2"
              >
                {t("contact.form.message")}
              </label>
              <textarea
                id="message"
                {...register("message")}
                rows={5}
                className={`w-full px-4 py-3 rounded-none border bg-background/50 backdrop-blur text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none transition-all duration-300 ${
                  errors.message ? "border-destructive" : "border-border"
                }`}
                placeholder={t("contact.form.messagePlaceholder")}
              />
              {errors.message && (
                <p className="mt-1 text-sm text-destructive">{errors.message.message}</p>
              )}
            </div>
            {submitSuccess && (
              <div className="p-4 rounded-none bg-accent/20 border border-accent/50 text-foreground text-sm">
                {t("contact.form.success") || "Thank you! Your message has been received."}
              </div>
            )}
            <Button 
              type="submit" 
              variant="editorial" 
              size="lg" 
              className="w-full sm:w-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? (t("contact.form.sending") || "Sending...") : t("contact.form.submit")}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground mt-8">
            {t("contact.formNote")}
          </p>
        </div>
      </Section>
    </>
  );
};

export default Index;

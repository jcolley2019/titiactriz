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
    // Form submission logic can be added here when backend is ready
    // For now, just simulate success after validation
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

      {/* Hero Section */}
      <section className="min-h-screen flex items-center pt-20">
        <div className="container-editorial">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 xl:gap-24 items-center">
            {/* Text Content */}
            <div className="order-2 lg:order-1">
              <div className="opacity-0 animate-fade-up">
                <span className="text-caps text-muted-foreground mb-4 block">
                  {t("hero.tagline")}
                </span>
              </div>

              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl xl:text-7xl text-foreground leading-[1.1] mb-6 opacity-0 animate-fade-up stagger-1">
                Cristyna{" "}
                <span className="text-accent italic">Polentino</span>
              </h1>

              <p className="font-serif text-2xl md:text-3xl text-primary/80 mb-6 opacity-0 animate-fade-up stagger-2">
                {t("hero.subtitle")}
              </p>

              <p className="text-muted-foreground text-lg mb-8 max-w-lg opacity-0 animate-fade-up stagger-3">
                {t("hero.description")}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 xl:gap-4 mb-8 opacity-0 animate-fade-up stagger-4">
                <Button variant="editorial" size="default" className="xl:h-12 xl:px-7" asChild>
                  <a href="#contact">
                    {t("hero.cta")}
                    <ArrowRight className="w-4 h-4 xl:w-5 xl:h-5" />
                  </a>
                </Button>
                <Button variant="gold-outline" size="default" className="xl:h-12 xl:px-7" asChild>
                  <Link to="/titans-agency">Titans Agency</Link>
                </Button>
                <Button variant="gold-outline" size="default" className="xl:h-12 xl:px-7" asChild>
                  <Link to="/green-world">Green World</Link>
                </Button>
              </div>

              {/* Social Row */}
              <div className="flex gap-4 opacity-0 animate-fade-up stagger-5">
                <a
                  href="https://www.tiktok.com/@titina_polen?_r=1&_t=ZT-92aYp2I0zF1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-accent link-underline transition-colors"
                >
                  TikTok
                </a>
                <a
                  href="https://www.instagram.com/cristinapolentino_actriz?igsh=aTJuZXJjNWhsOGZh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-accent link-underline transition-colors"
                >
                  Instagram
                </a>
                <a
                  href="https://youtube.com/@mimundoderoles6875?si=Zc74Dd2fgQjQrNpG"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-accent link-underline transition-colors"
                >
                  YouTube
                </a>
              </div>
            </div>

            {/* Hero Image */}
            <div className="order-1 lg:order-2 opacity-0 animate-scale-in stagger-2">
              <div className="relative">
                <div className="image-frame">
                  <img
                    src={heroImage}
                    alt="Cristyna Polentino - Colombian actress and dancer"
                    className="w-full h-auto rounded-lg"
                  />
                </div>
                {/* Decorative elements */}
                <div className="absolute -bottom-4 -right-4 w-32 h-32 border border-accent/30 rounded-lg -z-10 animate-float animate-pulse-glow" />
                <div className="absolute -top-4 -left-4 w-24 h-24 bg-secondary/50 rounded-lg -z-10 animate-float-slow" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Image Gallery Strip */}
      <section className="py-8 bg-muted/30 relative">
        {/* Scroll Buttons */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/90 shadow-lg flex items-center justify-center hover:bg-background transition-colors"
          aria-label={t("gallery.scrollLeft")}
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <button
          onClick={() => scroll("right")}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/90 shadow-lg flex items-center justify-center hover:bg-background transition-colors"
          aria-label={t("gallery.scrollRight")}
        >
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {galleryImages.map((img, i) => (
            <div
              key={i}
              onClick={() => setSelectedImage(img)}
              className="flex-shrink-0 w-48 h-56 rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
            >
              <img
                src={img}
                alt={t("gallery.imageAlt", { number: i + 1 })}
                className="w-full h-full object-cover"
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
            className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-background/90 shadow-lg flex items-center justify-center hover:bg-background transition-colors"
            aria-label={t("gallery.close")}
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Enlarged gallery image"
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Meet Cristyna Section */}
      <Section id="about">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="image-frame">
            <img
              src={aboutImage}
              alt="Cristyna Polentino portrait"
              className="w-full h-auto rounded-lg"
            />
          </div>

          <div>
            <SectionHeader
              eyebrow={t("about.eyebrow")}
              title={t("about.title")}
              centered={false}
              className="text-left"
            />

            <div className="space-y-4 text-muted-foreground leading-relaxed mb-8">
              <p>{t("about.p1")}</p>
              <p>{t("about.p2")}</p>
              <p>{t("about.p3")}</p>
            </div>

            {/* Signature Strengths */}
            <div className="flex flex-wrap gap-3 mb-8">
              {[
                t("about.strengths.presence"),
                t("about.strengths.discipline"),
                t("about.strengths.creative"),
                t("about.strengths.brand"),
              ].map((strength) => (
                <span
                  key={strength}
                  className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm border border-accent/20"
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

          <div className="mb-8">
            <a
              href="mailto:yourname@email.com"
              className="font-serif text-2xl text-foreground hover:text-accent transition-colors"
            >
              yourname@email.com
            </a>
          </div>

          {/* Contact Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
            <div className="grid sm:grid-cols-2 gap-4">
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
                  className={`w-full h-11 px-4 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent ${
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
                  className={`w-full h-11 px-4 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent ${
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
                rows={4}
                className={`w-full px-4 py-3 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none ${
                  errors.message ? "border-destructive" : "border-border"
                }`}
                placeholder={t("contact.form.messagePlaceholder")}
              />
              {errors.message && (
                <p className="mt-1 text-sm text-destructive">{errors.message.message}</p>
              )}
            </div>
            {submitSuccess && (
              <div className="p-3 rounded-lg bg-green-100 text-green-800 text-sm">
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

          <p className="text-sm text-muted-foreground mt-6">
            {t("contact.formNote")}
          </p>
        </div>
      </Section>
    </>
  );
};

export default Index;

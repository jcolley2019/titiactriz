import { useState, useRef, useEffect } from "react";
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

// Images
import heroImage from "@/assets/cristyna-hero.jpg";
import aboutImage from "@/assets/cristyna-meet.png";
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
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleImages, setVisibleImages] = useState<Set<number>>(new Set());
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Intersection Observer for entrance animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            setVisibleImages((prev) => new Set([...prev, index]));
          }
        });
      },
      { threshold: 0.2, rootMargin: '50px' }
    );

    imageRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const handleImageClick = (img: string, index: number) => {
    setSelectedImage(img);
    setSelectedIndex(index);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' 
      ? (selectedIndex - 1 + galleryImages.length) % galleryImages.length
      : (selectedIndex + 1) % galleryImages.length;
    setSelectedIndex(newIndex);
    setSelectedImage(galleryImages[newIndex]);
  };

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

      {/* Hero Section - Side-by-Side Split */}
      <section className="min-h-[110vh] relative flex items-center overflow-hidden">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/20 z-0" />
        
        <div className="container-editorial relative z-10 py-32 lg:py-16">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center min-h-[90vh]">
            
            {/* Left - Text Content */}
            <div className="order-2 lg:order-1 flex flex-col justify-center">
              {/* Name - centered above headline */}
              <h2 
                className="font-serif text-4xl md:text-5xl lg:text-6xl text-center mb-8 opacity-0 animate-[fadeIn_1s_ease-out_0.1s_forwards]"
                style={{ textShadow: '0 0 40px hsl(var(--accent) / 0.3), 0 2px 10px hsl(var(--background) / 0.5)' }}
              >
                <span className="font-light tracking-wide">Cristyna</span>{" "}
                <span className="text-accent italic font-medium relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-accent/40 after:scale-x-0 after:animate-[scaleX_0.8s_ease-out_0.8s_forwards]">Polentino</span>
              </h2>
              
              {/* Main headline */}
              <h1 
                className="font-serif text-4xl md:text-5xl lg:text-6xl xl:text-7xl text-foreground leading-[1.15] mb-10 opacity-0 animate-[fadeIn_0.8s_ease-out_0.3s_forwards]"
              >
                <span className="inline-block bg-accent/15 px-3 py-1 -mx-3 border-l-2 border-accent">
                  {t("hero.headline")}
                </span>
              </h1>
              
              {/* Roles - centered below headline */}
              <p className="text-[10px] sm:text-xs md:text-sm tracking-[0.1em] sm:tracking-[0.15em] md:tracking-[0.2em] uppercase text-muted-foreground text-center mb-12 opacity-0 animate-[fadeIn_0.8s_ease-out_0.5s_forwards]">
                <span className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-5">
                  <span>Colombian Actress</span>
                  <span className="text-accent">|</span>
                  <span>Professional Dancer</span>
                  <span className="text-accent">|</span>
                  <span>Entrepreneur</span>
                  <span className="text-accent">|</span>
                  <span>TikTok Streamer</span>
                </span>
              </p>

              {/* Quick Link Buttons */}
              <div className="grid grid-cols-1 xs:grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-8 w-full xs:max-w-none mx-auto px-4 xs:px-0 opacity-0 animate-[fadeIn_0.8s_ease-out_0.6s_forwards]">
                <Button variant="outline" size="lg" className="w-full text-xs sm:text-sm md:text-base font-medium border-2 border-foreground/40 hover:border-foreground" asChild>
                  <Link to="/titans-agency">Titans Agency</Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full text-xs sm:text-sm md:text-base font-medium border-2 border-foreground/40 hover:border-foreground" asChild>
                  <Link to="/green-world">Green World</Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full text-xs sm:text-sm md:text-base font-medium border-2 border-foreground/40 hover:border-foreground" asChild>
                  <Link to="/work">Portfolio</Link>
                </Button>
              </div>
            </div>

            {/* Right - Hero Image */}
            <div className="order-1 lg:order-2 opacity-0 animate-[fadeIn_1s_ease-out_0.3s_forwards]">
              <div className="relative">
                {/* Main image */}
                <div className="relative overflow-hidden rounded-sm">
                  <img
                    src={heroImage}
                    alt="Cristyna Polentino"
                    className="w-full h-auto max-h-[75vh] object-cover object-top transition-all duration-500"
                  />
                  {/* Subtle overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/30 via-transparent to-transparent" />
                </div>
                
                {/* Decorative frame */}
                <div className="absolute -bottom-4 -right-4 w-full h-full border border-accent/30 rounded-sm -z-10 opacity-0 animate-[fadeIn_0.8s_ease-out_0.8s_forwards]" />
                <div className="absolute -top-4 -left-4 w-24 h-24 border-t border-l border-accent/20 -z-10 opacity-0 animate-[fadeIn_0.8s_ease-out_1s_forwards]" />
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 opacity-0 animate-[fadeIn_0.8s_ease-out_1.2s_forwards]">
          <div className="flex flex-col items-center gap-2 text-foreground/50 hover:text-accent transition-colors duration-300">
            <span className="text-xs tracking-[0.2em] uppercase">Scroll</span>
            <div className="w-px h-10 bg-gradient-to-b from-foreground/50 to-transparent animate-[pulse_2s_ease-in-out_infinite]" />
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

      {/* Meet Cristyna Section */}
      <Section id="about">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className="relative opacity-0 animate-scale-in">
            <img
              src={aboutImage}
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

      {/* Image Gallery Strip */}
      <section className="py-16 relative z-10">
        {/* Section Header */}
        <div className="container-editorial text-center mb-10">
          <p className="text-caps text-accent mb-4">{t("gallery.eyebrow", "A glimpse into")}</p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground">{t("gallery.title", "Moments & Memories")}</h2>
        </div>

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
              ref={(el) => (imageRefs.current[i] = el)}
              data-index={i}
              onClick={() => handleImageClick(img, i)}
              className={`flex-shrink-0 w-56 h-72 rounded-sm overflow-hidden cursor-pointer group relative transition-all duration-700 ease-out ${
                visibleImages.has(i) 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${(i % 6) * 100}ms` }}
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
              
              {/* Accent border glow effect */}
              <div className="absolute inset-0 rounded-sm border-2 border-accent/0 group-hover:border-accent/60 transition-all duration-500 z-20 group-hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]" />
              
              {/* Image with creative hover effects */}
              <img
                src={img}
                alt={t("gallery.imageAlt", { number: i + 1 })}
                className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 group-hover:rotate-1"
              />
              
              {/* View indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:translate-y-0 translate-y-4">
                <span className="text-xs tracking-[0.2em] uppercase text-foreground/90 bg-background/60 backdrop-blur px-3 py-1.5 rounded-full border border-accent/30">
                  View
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lightbox Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
          {/* Close button */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 z-50 w-12 h-12 rounded-full bg-background/90 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 transition-all duration-300"
            aria-label={t("gallery.close")}
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
          
          {/* Previous button */}
          <button
            onClick={() => navigateLightbox('prev')}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-background/90 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 transition-all duration-300"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          
          {/* Next button */}
          <button
            onClick={() => navigateLightbox('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-background/90 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 transition-all duration-300"
            aria-label="Next image"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
          
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Enlarged gallery image"
              className="w-full h-auto max-h-[85vh] object-contain rounded-sm animate-[fadeIn_0.3s_ease-out]"
            />
          )}
          
          {/* Image counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
            <span className="text-sm text-foreground/80 bg-background/60 backdrop-blur px-4 py-2 rounded-full border border-border/30">
              {selectedIndex + 1} / {galleryImages.length}
            </span>
          </div>
        </DialogContent>
      </Dialog>

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

import { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/Section";
import { LinkCard } from "@/components/Cards";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import CosmicBackground from "@/components/CosmicBackground";
import ScrollReveal, { StaggerContainer, StaggerItem } from "@/components/ScrollReveal";
import ParallaxImage from "@/components/ParallaxImage";

// Images
import heroImage from "@/assets/cristyna-hero.jpg";
import aboutImage from "@/assets/cristyna-meet.png";
import danceImage from "@/assets/cristyna-dance.jpg";
import titansLogo from "@/assets/titans-logo.png";
import titansLogoRed from "@/assets/titans-logo-red.png";
import greenworldLogo from "@/assets/greenworld-logo-hd.png";
import sunsetImage from "@/assets/cristyna-sunset.jpg";
import lifestyleImage from "@/assets/cristyna-lifestyle.jpg";
import poolImage from "@/assets/cristyna-pool.jpg";
import titi2Image from "@/assets/cristyna-titi2.jpg";
import titi3Image from "@/assets/cristyna-titi3.jpg";
import titi5Image from "@/assets/cristyna-titi5.jpg";
import miami1Image from "@/assets/cristyna-miami1.jpg";
import miami3Image from "@/assets/cristyna-miami3.jpg";
import miami2Image from "@/assets/cristyna-miami2.jpg";
import miami4Image from "@/assets/cristyna-miami4.jpg";
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
import gallery11Image from "@/assets/cristyna-gallery11.jpg";

const galleryImages = [
  miami4Image, titi5Image, sunsetImage, lifestyleImage, 
  poolImage, titi3Image, miami1Image, miami3Image,
  gallery1Image, gallery2Image, gallery3Image, gallery4Image,
  gallery5Image, gallery6Image, gallery7Image, miami2Image,
  gallery8Image, gallery9Image, gallery10Image, gallery11Image
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
    try {
      const { data: responseData, error } = await supabase.functions.invoke('send-contact', {
        body: {
          type: 'general',
          name: data.name,
          email: data.email,
          message: data.message,
        },
      });

      if (error) {
        console.error('Contact form error:', error);
        // Show error but don't expose internal details
        alert('There was an error sending your message. Please try again.');
        return;
      }

      if (responseData?.error) {
        console.error('Validation error:', responseData.errors);
        alert(responseData.error);
        return;
      }

      setSubmitSuccess(true);
      reset();
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const scrollAmount = 300;
      const maxScroll = container.scrollWidth - container.clientWidth;
      
      if (direction === "right") {
        // If at or near the end, loop to start
        if (container.scrollLeft >= maxScroll - 10) {
          container.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          container.scrollBy({ left: scrollAmount, behavior: "smooth" });
        }
      } else {
        // If at or near the start, loop to end
        if (container.scrollLeft <= 10) {
          container.scrollTo({ left: maxScroll, behavior: "smooth" });
        } else {
          container.scrollBy({ left: -scrollAmount, behavior: "smooth" });
        }
      }
    }
  };

  // Auto-scroll effect using requestAnimationFrame for smooth continuous scroll
  const scrollAccumulator = useRef(0);
  
  useEffect(() => {
    if (!isAutoScrolling) return;
    
    let animationId: number;
    const speed = 0.3; // pixels per frame (accumulated for sub-pixel precision)
    
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
  }, [isAutoScrolling]);

  // Pause auto-scroll on hover
  const handleMouseEnter = () => setIsAutoScrolling(false);
  const handleMouseLeave = () => setIsAutoScrolling(true);

  return (
    <>
      <Helmet>
        <title>Cristyna Polentino | Actriz Colombiana, Bailarina y Empresaria en Medellín</title>
        <meta
          name="description"
          content="Cristyna Polentino es una actriz colombiana, bailarina profesional y empresaria en Medellín, Colombia. Explora su portafolio de actuación, danza, Titans Agency y productos Green World. Colombian actress, dancer & entrepreneur."
        />
        <link rel="canonical" href="https://cristinapolentino.com/" />
        <meta property="og:title" content="Cristyna Polentino | Actriz, Bailarina y Empresaria" />
        <meta
          property="og:description"
          content="Actriz colombiana, bailarina profesional y empresaria en Medellín. Actuación, danza, Titans Agency y Green World."
        />
        <meta property="og:url" content="https://cristinapolentino.com/" />
        <meta property="og:type" content="website" />
      </Helmet>

      <CosmicBackground />

      {/* Hero Section - Side-by-Side Split */}
      <section className="min-h-[110vh] relative flex items-center overflow-hidden">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/20 z-0" />
        
        <div className="container-editorial relative z-10 pt-28 pb-16 sm:py-32 lg:py-16">
          <div className="grid lg:grid-cols-2 gap-10 sm:gap-16 lg:gap-24 items-center min-h-[90vh]">
            
            {/* Left - Text Content */}
            <div className="order-2 lg:order-1 flex flex-col justify-center">
              {/* Name - stacked layout matching reference */}
              <div className="mb-8 opacity-0 animate-[fadeIn_1s_ease-out_0.1s_forwards]">
                <h2 className="font-serif text-5xl md:text-6xl lg:text-7xl xl:text-8xl text-foreground font-normal leading-[0.95]">
                  Cristyna
                </h2>
                <h2 className="font-serif text-5xl md:text-6xl lg:text-7xl xl:text-8xl text-accent italic font-normal leading-[0.95] relative inline-block after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-accent/50 after:origin-left after:animate-[scaleX_1s_ease-out_0.5s_forwards] after:scale-x-0">
                  Polentino
                </h2>
              </div>
              
              {/* Main headline - tagline style with accent box */}
              <h1 
                className="font-serif text-xl md:text-2xl lg:text-3xl text-accent/80 italic leading-relaxed mb-6 opacity-0 animate-[fadeIn_0.8s_ease-out_0.3s_forwards]"
              >
                <span className="inline-block bg-accent/15 px-3 py-1 -mx-3 border-l-2 border-accent">
                  {t("hero.headline")}
                </span>
              </h1>
              
              {/* Description text */}
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed mb-10 max-w-md opacity-0 animate-[fadeIn_0.8s_ease-out_0.4s_forwards]">
                {t("hero.description")}
              </p>
              
              {/* Roles - centered below headline */}
              <p className="text-[10px] sm:text-xs md:text-sm tracking-[0.1em] sm:tracking-[0.15em] md:tracking-[0.2em] uppercase text-muted-foreground text-center mb-12 opacity-0 animate-[fadeIn_0.8s_ease-out_0.5s_forwards]">
                <span className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-5">
                  <span>{t("hero.roles.actress")}</span>
                  <span className="text-accent">|</span>
                  <span>{t("hero.roles.dancer")}</span>
                  <span className="text-accent">|</span>
                  <span>{t("hero.roles.entrepreneur")}</span>
                  <span className="text-accent">|</span>
                  <span>{t("hero.roles.streamer")}</span>
                </span>
              </p>

              {/* Quick Link Buttons */}
              <div className="grid grid-cols-1 xs:grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 w-full xs:max-w-none mx-auto px-4 xs:px-0 opacity-0 animate-[fadeIn_0.8s_ease-out_0.6s_forwards]">
                <Button variant="outline" size="lg" className="w-full text-xs sm:text-sm md:text-base font-medium border-2 border-gold/60 text-gold-light bg-gold/10 hover:bg-gold/25 hover:border-gold-light hover:text-foreground hover:shadow-glow transition-all duration-300" asChild>
                  <Link to="/titans-agency">{t("hero.buttons.titans")}</Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full text-xs sm:text-sm md:text-base font-medium border-2 border-gold/60 text-gold-light bg-gold/10 hover:bg-gold/25 hover:border-gold-light hover:text-foreground hover:shadow-glow transition-all duration-300" asChild>
                  <Link to="/green-world">{t("hero.buttons.greenWorld")}</Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full text-xs sm:text-sm md:text-base font-medium border-2 border-gold/60 text-gold-light bg-gold/10 hover:bg-gold/25 hover:border-gold-light hover:text-foreground hover:shadow-glow transition-all duration-300" asChild>
                  <Link to="/work">{t("hero.buttons.portfolio")}</Link>
                </Button>
              </div>

              {/* Scroll indicator - in content flow on mobile */}
              <div className="lg:hidden mt-10 opacity-0 animate-[fadeIn_0.8s_ease-out_1.2s_forwards]">
                <div className="flex flex-col items-center gap-2 text-foreground/50 hover:text-accent transition-colors duration-300">
                  <span className="text-xs tracking-[0.2em] uppercase">{t("common.scroll")}</span>
                  <div className="w-px h-10 bg-gradient-to-b from-foreground/50 to-transparent animate-[pulse_2s_ease-in-out_infinite]" />
                </div>
              </div>
            </div>

            {/* Right - Hero Image */}
            <div className="order-1 lg:order-2">
              <div className="relative">
                {/* Main image with parallax */}
                <ParallaxImage
                  src={heroImage}
                  alt="Cristyna Polentino"
                  containerClassName="rounded-sm"
                  className="max-h-[75vh] object-top"
                  speed={0.12}
                  style={{ 
                    filter: 'contrast(1.05) saturate(1.1) brightness(1.02)',
                  }}
                />
                {/* Subtle overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/30 via-transparent to-transparent pointer-events-none rounded-sm" />
                
                {/* Decorative frame */}
                <div className="absolute -bottom-4 -right-4 w-full h-full border border-accent/30 rounded-sm -z-10 opacity-0 animate-[fadeIn_0.8s_ease-out_0.8s_forwards]" />
                <div className="absolute -top-4 -left-4 w-24 h-24 border-t border-l border-accent/20 -z-10 opacity-0 animate-[fadeIn_0.8s_ease-out_1s_forwards]" />
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator - desktop only (absolute positioned) */}
        <div className="hidden lg:block absolute bottom-8 left-1/2 -translate-x-1/2 z-10 opacity-0 animate-[fadeIn_0.8s_ease-out_1.2s_forwards]">
          <div className="flex flex-col items-center gap-2 text-foreground/50 hover:text-accent transition-colors duration-300">
            <span className="text-xs tracking-[0.2em] uppercase">{t("common.scroll")}</span>
            <div className="w-px h-10 bg-gradient-to-b from-foreground/50 to-transparent animate-[pulse_2s_ease-in-out_infinite]" />
          </div>
        </div>
      </section>

      {/* Guided By Section */}
      <section className="py-14 sm:py-20 md:py-28 relative z-10">
        <div className="container-editorial text-center">
          <ScrollReveal>
            <p className="text-caps text-accent mb-4">
              {t("hero.guidedBy")}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.15}>
            <h2 className="font-serif text-3xl md:text-5xl lg:text-6xl text-foreground leading-tight max-w-3xl mx-auto">
              {t("hero.guidedByText")}
            </h2>
          </ScrollReveal>
        </div>
      </section>

      {/* Meet Cristyna Section */}
      <Section id="about" animate={false}>
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <ScrollReveal direction="left">
            <div className="relative">
              <ParallaxImage
                src={aboutImage}
                alt="Cristyna Polentino portrait"
                containerClassName="rounded-sm"
                className="animate-color-reveal hover:grayscale-0 transition-all duration-700"
                speed={0.1}
              />
              {/* Decorative frame */}
              <div className="absolute -bottom-4 -right-4 w-full h-full border border-accent/20 rounded-sm -z-10" />
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={0.1}>
            <SectionHeader
              eyebrow={t("about.eyebrow")}
              title={t("about.title")}
              centered={false}
              className="text-left"
              animate={false}
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
          </ScrollReveal>
        </div>
      </Section>

      {/* Image Gallery Strip */}
      <section className="py-12 sm:py-16 relative z-10">
        {/* Section Header */}
        <ScrollReveal className="container-editorial text-center mb-10">
          <p className="text-caps text-accent mb-4">{t("gallery.eyebrow")}</p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground">{t("gallery.title")}</h2>
        </ScrollReveal>

        {/* Scroll Buttons */}
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

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {galleryImages.map((img, i) => (
            <div
              key={i}
              ref={(el) => (imageRefs.current[i] = el)}
              data-index={i}
              onClick={() => handleImageClick(img, i)}
              className={`flex-shrink-0 w-56 h-72 rounded-sm overflow-hidden cursor-pointer group relative transition-all duration-700 ease-out hover:shadow-lg hover:shadow-accent/30 ${
                visibleImages.has(i) 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${(i % 6) * 100}ms` }}
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
              
              {/* Gold border glow effect */}
              <div className="absolute inset-0 rounded-sm border-2 border-accent/0 group-hover:border-accent/50 transition-all duration-500 z-20" />
              
              {/* Gold bar at bottom on hover */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/80 via-gold-light to-accent/80 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-30" />
              
              {/* Image with creative hover effects */}
              <img
                src={img}
                alt={t("gallery.imageAlt", { number: i + 1 })}
                loading="lazy"
                className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 group-hover:rotate-1 animate-color-reveal"
              />
              
              {/* View indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:translate-y-0 translate-y-4">
                <span className="text-xs tracking-[0.2em] uppercase text-foreground/90 bg-background/60 backdrop-blur px-3 py-1.5 rounded-full border border-accent/30">
                  {t("common.view")}
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
            className="absolute top-4 right-4 z-50 w-12 h-12 rounded-full bg-background/90 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 hover:shadow-glow transition-all duration-300 group"
            aria-label={t("gallery.close")}
          >
            <X className="w-5 h-5 text-foreground group-hover:text-gold-light" />
          </button>
          
          {/* Previous button */}
          <button
            onClick={() => navigateLightbox('prev')}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-background/90 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 hover:shadow-glow transition-all duration-300 group"
            aria-label={t("common.previousImage")}
          >
            <ChevronLeft className="w-5 h-5 text-foreground group-hover:text-gold-light transition-colors duration-300" />
          </button>
          
          {/* Next button */}
          <button
            onClick={() => navigateLightbox('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-background/90 backdrop-blur border border-border/50 flex items-center justify-center hover:bg-background hover:border-accent/50 hover:shadow-glow transition-all duration-300 group"
            aria-label={t("common.nextImage")}
          >
            <ChevronRight className="w-5 h-5 text-foreground group-hover:text-gold-light transition-colors duration-300" />
          </button>
          
          {selectedImage && (
            <img
              src={selectedImage}
              alt={t("common.enlargedGalleryImage")}
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


      {/* Featured Links Section */}
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
              imageBackground="white"
              hoverColor="red"
            />
          </StaggerItem>
          <StaggerItem>
            <LinkCard
              title={t("featured.greenWorld.title")}
              description={t("featured.greenWorld.description")}
              href="/green-world"
              image={greenworldLogo}
              imageBackground="white"
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

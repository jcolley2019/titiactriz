import { useEffect, useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Users, TrendingUp, DollarSign, PlayCircle, BarChart3, Handshake, MessageCircle, ChevronDown, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/Section";
import { StatCard, FeatureCard } from "@/components/Cards";
import TikTokIcon from "@/components/icons/TikTokIcon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import titansLogo from "@/assets/titans-logo-color.png";
import cristynaTitans from "@/assets/cristyna-titans-hd.png";
import cristynaProfile from "@/assets/cristyna-tiktok-profile.png";
import titansQRCode from "@/assets/titans-qr-code-clean.jpg";

// TikTok video IDs for alternating display
const TIKTOK_VIDEOS = [
  "7537859583486823685",
  "7430845962085584133",
  "7434018621099216134",
];

// TikTok Video Player component with rotation, autoplay, loop, and visibility detection
const TikTokVideoPlayer = () => {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(() =>
    Math.floor(Math.random() * TIKTOK_VIDEOS.length)
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const videoId = TIKTOK_VIDEOS[currentVideoIndex];

  // Intersection Observer to detect when video is out of view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleSwitchVideo = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentVideoIndex((prev) => (prev + 1) % TIKTOK_VIDEOS.length);
      setIsTransitioning(false);
    }, 250);
  };

  return (
    <div ref={containerRef} className="flex flex-col w-full">
      {/* Video container */}
      <div className="relative w-full h-full overflow-hidden">
        {/* Only render iframe when visible to pause video when out of view */}
        {isVisible && (
          <iframe
            key={videoId}
            src={`https://www.tiktok.com/embed/v3/${videoId}?autoplay=1&loop=1`}
            className={cn(
              "w-full h-full transition-opacity duration-300",
              isTransitioning ? "opacity-0" : "opacity-100"
            )}
            style={{ border: 0, overflow: "hidden" }}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title="Titans Agency TikTok Video"
            referrerPolicy="no-referrer-when-downgrade"
            scrolling="no"
            loading="eager"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          />
        )}

        {/* Placeholder when video is paused (out of view) */}
        {!isVisible && (
          <div className="w-full h-full bg-titans-dark flex items-center justify-center">
            <PlayCircle className="w-16 h-16 text-white/30" />
          </div>
        )}

        {/* Fallback link if embed fails to render */}
        <a
          href={`https://www.tiktok.com/@titansagencylatam/video/${videoId}`}
          target="_blank"
          rel="noreferrer"
          className="sr-only"
        >
          Open TikTok video
        </a>
      </div>

      {/* Next Video Button - positioned below the video */}
      <button
        onClick={handleSwitchVideo}
        className="mt-3 mx-auto bg-titans-red/90 hover:bg-titans-red text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg transition-all duration-200 hover:scale-105 flex items-center gap-2"
        aria-label="Watch next video"
      >
        <PlayCircle className="w-4 h-4" />
        Next Video
      </button>
    </div>
  );
};

// Scroll indicator component with "Scroll" text and gentle animation
const TitansScrollIndicator = () => {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const handleScroll = () => {
      // Fade out as user scrolls down
      const fadeStart = 50;
      const fadeEnd = 200;
      const scrollY = window.scrollY;
      
      if (scrollY <= fadeStart) {
        setOpacity(1);
      } else if (scrollY >= fadeEnd) {
        setOpacity(0);
      } else {
        setOpacity(1 - (scrollY - fadeStart) / (fadeEnd - fadeStart));
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (opacity === 0) return null;

  return (
    <button
      type="button"
      style={{ opacity }}
      onClick={() =>
        document
          .getElementById("titans-services")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      className="sm:hidden absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/80 transition-opacity duration-500"
      aria-label="Scroll down"
    >
      <span className="text-xs uppercase tracking-widest font-medium">Scroll</span>
      <ChevronDown className="h-4 w-4 animate-[bounce_2s_ease-in-out_infinite]" />
    </button>
  );
};

const TitansAgency = () => {
  const { t } = useTranslation();
  
  // Contact form state
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    tiktokHandle: ""
  });
  const [formErrors, setFormErrors] = useState<{fullName?: string; email?: string; phone?: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const validateForm = () => {
    const errors: {fullName?: string; email?: string; phone?: string} = {};
    
    if (!formData.fullName.trim()) {
      errors.fullName = t("titans.form.errors.nameRequired");
    } else if (formData.fullName.trim().length > 100) {
      errors.fullName = t("titans.form.errors.nameTooLong");
    }
    
    if (!formData.email.trim()) {
      errors.email = t("titans.form.errors.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = t("titans.form.errors.emailInvalid");
    } else if (formData.email.trim().length > 255) {
      errors.email = t("titans.form.errors.emailTooLong");
    }
    
    if (!formData.phone.trim()) {
      errors.phone = t("titans.form.errors.phoneRequired");
    } else if (formData.phone.trim().length > 20) {
      errors.phone = t("titans.form.errors.phoneTooLong");
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    // Build mailto link with form data
    const subject = encodeURIComponent("Titans Agency - New Contact Request");
    const body = encodeURIComponent(
      `Full Name: ${formData.fullName.trim()}\nEmail: ${formData.email.trim()}\nPhone: ${formData.phone.trim()}\nTikTok Handle: ${formData.tiktokHandle.trim() || "Not provided"}`
    );
    
    window.location.href = `mailto:yourname@email.com?subject=${subject}&body=${body}`;
    
    setIsSubmitting(false);
    setSubmitSuccess(true);
    setFormData({ fullName: "", email: "", phone: "", tiktokHandle: "" });
    setTimeout(() => setSubmitSuccess(false), 3000);
  };

  // Format phone number as user types: +XX XXX XXX XXXX
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters except +
    const cleaned = value.replace(/[^\d+]/g, '');
    
    // Handle the + at the beginning
    let hasPlus = cleaned.startsWith('+');
    let digits = cleaned.replace(/\D/g, '');
    
    // Limit to 13 digits (including country code)
    digits = digits.slice(0, 13);
    
    // Format: +XX XXX XXX XXXX
    let formatted = '';
    
    if (hasPlus) {
      formatted = '+';
    }
    
    if (digits.length > 0) {
      // Country code (first 2 digits)
      formatted += digits.slice(0, 2);
    }
    if (digits.length > 2) {
      formatted += ' ' + digits.slice(2, 5);
    }
    if (digits.length > 5) {
      formatted += ' ' + digits.slice(5, 8);
    }
    if (digits.length > 8) {
      formatted += ' ' + digits.slice(8, 12);
    }
    
    return formatted;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  const services = [
    t("titans.services.list.onboarding"),
    t("titans.services.list.content"),
    t("titans.services.list.coaching"),
    t("titans.services.list.deals"),
    t("titans.services.list.analytics"),
  ];

  return (
    <>
      <Helmet>
        <title>Titans Agency Latam | TikTok Growth & Creator Support</title>
        <meta
          name="description"
          content="Titans Agency Latam - TikTok growth, creator support, monetization strategy, and brand partnerships for Latin American creators."
        />
        <meta property="og:title" content="Titans Agency Latam" />
        <meta
          property="og:description"
          content="TikTok growth, creator support, monetization strategy, and brand partnerships."
        />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Hero Section with Titans brand colors */}
      <section className="relative min-h-screen flex items-center pt-28 pb-16 sm:pt-24 sm:pb-12 bg-gradient-to-br from-titans-dark via-titans-red to-titans-dark overflow-x-hidden">
        <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12 max-w-6xl xl:max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-8 lg:gap-12 items-center">
            {/* Content Column */}
            <div className="lg:order-2 flex flex-col items-center text-center">
              {/* Logo with decorative ring */}
              <div className="relative mb-4 sm:mb-6 md:mb-8 opacity-0 animate-fade-up">
                {/* Decorative red ring - responsive sizing */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 sm:w-64 sm:h-64 md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] rounded-full border-[6px] sm:border-8 border-titans-red/60" />
                {/* Logo - responsive sizing */}
                <img
                  src={titansLogo}
                  alt="Titans Agency Logo"
                  className="relative z-10 w-32 h-32 sm:w-48 sm:h-48 md:w-72 md:h-72 lg:w-80 lg:h-80 rounded-full"
                />
              </div>

              <h1 className="text-3xl sm:text-3xl md:text-5xl lg:text-6xl text-white leading-[1.15] mb-3 sm:mb-4 md:mb-6 opacity-0 animate-fade-up stagger-1 drop-shadow-lg">
                <span className="font-titans uppercase tracking-wide">Titans</span>{" "}
                <span className="font-titans-script text-4xl sm:text-4xl md:text-6xl lg:text-7xl">Agency</span>{" "}
                <span className="font-titans-script text-4xl sm:text-4xl md:text-6xl lg:text-7xl italic">Latam</span>
              </h1>

              <p className="text-base sm:text-lg md:text-2xl text-white/90 font-medium mb-4 sm:mb-6 md:mb-8 opacity-0 animate-fade-up stagger-2 drop-shadow-md max-w-md lg:max-w-lg leading-relaxed">
                {t("titans.hero.subtitle")}
              </p>

              <div className="flex flex-col gap-2.5 opacity-0 animate-fade-up stagger-3 justify-center w-full px-2 sm:px-0 sm:w-auto sm:flex-row sm:gap-4">
                <Button 
                  size="xl" 
                  asChild
                  className="bg-white text-titans-red hover:bg-white/90 font-bold text-base sm:text-base md:text-lg shadow-lg w-full sm:w-[220px] md:w-[250px] h-12 sm:h-14 md:h-16 justify-center rounded-lg sm:rounded-sm"
                >
                  <a href="mailto:yourname@email.com?subject=Titans%20Agency%20Inquiry" className="flex items-center justify-center gap-2 w-full h-full">
                    {t("titans.hero.workWithUs")}
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </a>
                </Button>
                <Button 
                  size="xl" 
                  asChild
                  className="bg-titans-dark text-white hover:bg-titans-dark/80 font-bold text-base sm:text-base md:text-lg shadow-lg border border-white/20 w-full sm:w-[220px] md:w-[250px] h-12 sm:h-14 md:h-16 justify-center rounded-lg sm:rounded-sm"
                >
                  <a href="https://www.tiktok.com/@titansagencylatam" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full h-full">
                    <TikTokIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    @titansagencylatam
                  </a>
                </Button>
              </div>
            </div>

            {/* TikTok Video Column - Alternating Videos */}
            <div className="relative opacity-0 animate-scale-in stagger-2 flex justify-center lg:order-1 mt-5 sm:mt-0">
              {/* Outer black border - sized to show full TikTok embed */}
              <div className="relative p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-black shadow-2xl shadow-black/40 w-full max-w-[360px] sm:max-w-[320px] md:max-w-[340px]">
                {/* White outline */}
                <div className="p-0.5 sm:p-1 rounded-lg sm:rounded-xl bg-white">
                  {/* Inner container - cropped to show only video content, hiding related videos section */}
                  <div className="w-full h-[560px] sm:h-[600px] rounded-md sm:rounded-lg overflow-hidden">
                    <TikTokVideoPlayer />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Mobile scroll indicator with Titans ring aesthetic */}
        <TitansScrollIndicator />
      </section>

      {/* Services Section */}
      <Section id="titans-services" className="bg-titans-dark">
        <SectionHeader
          eyebrow={t("titans.services.eyebrow")}
          title={t("titans.services.title")}
          subtitle={t("titans.services.subtitle")}
          className="[&_*]:text-white [&_.text-muted-foreground]:text-white/70"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<TrendingUp className="w-6 h-6 text-titans-red" />}
            title={t("titans.services.growthStrategy.title")}
            description={t("titans.services.growthStrategy.description")}
            className="bg-titans-dark/50 border-titans-red/30 [&_h3]:text-white [&_p]:text-white/70"
          />
          <FeatureCard
            icon={<PlayCircle className="w-6 h-6 text-titans-red" />}
            title={t("titans.services.contentSystems.title")}
            description={t("titans.services.contentSystems.description")}
            className="bg-titans-dark/50 border-titans-red/30 [&_h3]:text-white [&_p]:text-white/70"
          />
          <FeatureCard
            icon={<Users className="w-6 h-6 text-titans-red" />}
            title={t("titans.services.liveCoaching.title")}
            description={t("titans.services.liveCoaching.description")}
            className="bg-titans-dark/50 border-titans-red/30 [&_h3]:text-white [&_p]:text-white/70"
          />
          <FeatureCard
            icon={<BarChart3 className="w-6 h-6 text-titans-red" />}
            title={t("titans.services.analytics.title")}
            description={t("titans.services.analytics.description")}
            className="bg-titans-dark/50 border-titans-red/30 [&_h3]:text-white [&_p]:text-white/70"
          />
          <FeatureCard
            icon={<DollarSign className="w-6 h-6 text-titans-red" />}
            title={t("titans.services.monetization.title")}
            description={t("titans.services.monetization.description")}
            className="bg-titans-dark/50 border-titans-red/30 [&_h3]:text-white [&_p]:text-white/70"
          />
        </div>

        {/* Services List */}
        <div className="mt-12 max-w-2xl mx-auto">
          <h3 className="font-serif text-xl text-white mb-6 text-center">
            {t("titans.services.fullOverview")}
          </h3>
          <ul className="space-y-3">
            {services.map((service, index) => (
              <li
                key={index}
                className="flex items-center gap-3 text-white/80"
              >
                <div className="w-2 h-2 rounded-full bg-titans-red flex-shrink-0" />
                {service}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Featured Creators Section */}
      <Section className="bg-gradient-to-b from-titans-red/90 to-titans-dark">
        <SectionHeader
          eyebrow={t("titans.creators.eyebrow")}
          title={t("titans.creators.title")}
          subtitle={t("titans.creators.subtitle")}
          className="[&_*]:text-white [&_.text-muted-foreground]:text-white/70"
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Creator 1 */}
          <a 
            href="https://www.tiktok.com/@mariaval_tiktoker" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group"
          >
            <div className="bg-black rounded-2xl p-6 border border-titans-red/30 hover:border-titans-red transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-titans-red/20">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)] p-0.5">
                <div className="w-full h-full rounded-full bg-titans-dark flex items-center justify-center text-3xl font-bold text-white">
                  MV
                </div>
              </div>
              <h4 className="text-white font-semibold text-center mb-1">María Valentina</h4>
              <p className="text-titans-red text-sm text-center mb-3">@mariaval_tiktoker</p>
              <div className="flex items-center justify-center gap-4 text-white/60 text-sm">
                <div className="text-center">
                  <p className="text-white font-bold text-lg">125K</p>
                  <p className="text-xs">{t("titans.creators.followers")}</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">2.1M</p>
                  <p className="text-xs">{t("titans.creators.likes")}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-titans-red group-hover:text-white transition-colors">
                <TikTokIcon className="w-4 h-4" />
                <span className="text-sm font-medium">{t("titans.creators.viewProfile")}</span>
              </div>
            </div>
          </a>

          {/* Creator 2 */}
          <a 
            href="https://www.tiktok.com/@carloscomedy_" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group"
          >
            <div className="bg-black rounded-2xl p-6 border border-titans-red/30 hover:border-titans-red transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-titans-red/20">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)] p-0.5">
                <div className="w-full h-full rounded-full bg-titans-dark flex items-center justify-center text-3xl font-bold text-white">
                  CR
                </div>
              </div>
              <h4 className="text-white font-semibold text-center mb-1">Carlos Rodríguez</h4>
              <p className="text-titans-red text-sm text-center mb-3">@carloscomedy_</p>
              <div className="flex items-center justify-center gap-4 text-white/60 text-sm">
                <div className="text-center">
                  <p className="text-white font-bold text-lg">89K</p>
                  <p className="text-xs">{t("titans.creators.followers")}</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">1.5M</p>
                  <p className="text-xs">{t("titans.creators.likes")}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-titans-red group-hover:text-white transition-colors">
                <TikTokIcon className="w-4 h-4" />
                <span className="text-sm font-medium">{t("titans.creators.viewProfile")}</span>
              </div>
            </div>
          </a>

          {/* Creator 3 */}
          <a 
            href="https://www.tiktok.com/@luci.lifestyle" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group"
          >
            <div className="bg-black rounded-2xl p-6 border border-titans-red/30 hover:border-titans-red transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-titans-red/20">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)] p-0.5">
                <div className="w-full h-full rounded-full bg-titans-dark flex items-center justify-center text-3xl font-bold text-white">
                  LP
                </div>
              </div>
              <h4 className="text-white font-semibold text-center mb-1">Luciana Pérez</h4>
              <p className="text-titans-red text-sm text-center mb-3">@luci.lifestyle</p>
              <div className="flex items-center justify-center gap-4 text-white/60 text-sm">
                <div className="text-center">
                  <p className="text-white font-bold text-lg">210K</p>
                  <p className="text-xs">{t("titans.creators.followers")}</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">4.2M</p>
                  <p className="text-xs">{t("titans.creators.likes")}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-titans-red group-hover:text-white transition-colors">
                <TikTokIcon className="w-4 h-4" />
                <span className="text-sm font-medium">{t("titans.creators.viewProfile")}</span>
              </div>
            </div>
          </a>

          {/* Creator 4 - Cristyna */}
          <a 
            href="https://www.tiktok.com/@titina_polen" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group"
          >
            <div className="bg-black rounded-2xl p-6 border border-titans-red/30 hover:border-titans-red transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-titans-red/20">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)] p-0.5">
                <img 
                  src={cristynaProfile} 
                  alt="Titi Actriz" 
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <h4 className="text-white font-semibold text-center mb-1">Titi Actriz</h4>
              <p className="text-titans-red text-sm text-center mb-3">@titina_polen</p>
              <div className="flex items-center justify-center gap-4 text-white/60 text-sm">
                <div className="text-center">
                  <p className="text-white font-bold text-lg">113K</p>
                  <p className="text-xs">{t("titans.creators.followers")}</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">279K</p>
                  <p className="text-xs">{t("titans.creators.likes")}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-titans-red group-hover:text-white transition-colors">
                <TikTokIcon className="w-4 h-4" />
                <span className="text-sm font-medium">{t("titans.creators.viewProfile")}</span>
              </div>
            </div>
          </a>

        </div>
      </Section>

      {/* Results Section */}
      <Section className="bg-gradient-to-b from-titans-dark to-titans-red/20">
        <SectionHeader
          eyebrow={t("titans.results.eyebrow")}
          title={t("titans.results.title")}
          subtitle={t("titans.results.subtitle")}
          className="[&_*]:text-white [&_.text-muted-foreground]:text-white/70"
        />

        <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <StatCard 
            value="+340%" 
            label={t("titans.results.stats.views")} 
            className="bg-titans-dark/50 border-titans-red/30 [&_*]:text-white"
          />
          <StatCard 
            value="$50K+" 
            label={t("titans.results.stats.revenue")} 
            className="bg-titans-dark/50 border-titans-red/30 [&_*]:text-white"
          />
          <StatCard 
            value="25+" 
            label={t("titans.results.stats.creators")} 
            className="bg-titans-dark/50 border-titans-red/30 [&_*]:text-white"
          />
        </div>

        {/* Testimonials */}
        <div className="mt-12 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Testimonial 1 */}
          <div className="p-6 rounded-2xl bg-titans-dark/50 border border-titans-red/30">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-titans-red to-titans-dark flex items-center justify-center text-white font-bold text-xl">
                MV
              </div>
              <div>
                <p className="text-white font-semibold">{t("titans.results.testimonials.t1.name")}</p>
                <p className="text-white/60 text-sm">@mariaval_tiktoker</p>
              </div>
            </div>
            <p className="text-white/90 italic">
              "{t("titans.results.testimonials.t1.quote")}"
            </p>
            <p className="text-titans-red text-sm mt-3 font-medium">{t("titans.results.testimonials.t1.stat")}</p>
          </div>

          {/* Testimonial 2 */}
          <div className="p-6 rounded-2xl bg-titans-dark/50 border border-titans-red/30">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-titans-red to-titans-dark flex items-center justify-center text-white font-bold text-xl">
                CR
              </div>
              <div>
                <p className="text-white font-semibold">{t("titans.results.testimonials.t2.name")}</p>
                <p className="text-white/60 text-sm">@carloscomedy_</p>
              </div>
            </div>
            <p className="text-white/90 italic">
              "{t("titans.results.testimonials.t2.quote")}"
            </p>
            <p className="text-titans-red text-sm mt-3 font-medium">{t("titans.results.testimonials.t2.stat")}</p>
          </div>

          {/* Testimonial 3 */}
          <div className="p-6 rounded-2xl bg-titans-dark/50 border border-titans-red/30">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-titans-red to-titans-dark flex items-center justify-center text-white font-bold text-xl">
                LP
              </div>
              <div>
                <p className="text-white font-semibold">{t("titans.results.testimonials.t3.name")}</p>
                <p className="text-white/60 text-sm">@luci.lifestyle</p>
              </div>
            </div>
            <p className="text-white/90 italic">
              "{t("titans.results.testimonials.t3.quote")}"
            </p>
            <p className="text-titans-red text-sm mt-3 font-medium">{t("titans.results.testimonials.t3.stat")}</p>
          </div>
        </div>
      </Section>

      {/* TikTok Creator Showcase */}
      <Section className="bg-titans-dark">
        <SectionHeader
          eyebrow={t("titans.showcase.eyebrow")}
          title={t("titans.showcase.title")}
          subtitle={t("titans.showcase.subtitle")}
          className="[&_*]:text-white [&_.text-muted-foreground]:text-white/70"
        />

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* TikTok Video Embed 1 */}
          <div className="aspect-[9/16] rounded-2xl overflow-hidden bg-titans-dark/50 border border-titans-red/30 relative group">
            <blockquote 
              className="tiktok-embed w-full h-full" 
              cite="https://www.tiktok.com/@titansagencylatam" 
              data-video-id=""
              style={{ maxWidth: '100%', minWidth: '100%' }}
            >
              <section className="flex flex-col items-center justify-center h-full p-6 text-center">
                <TikTokIcon className="w-16 h-16 text-titans-red mb-4" />
                <p className="text-white font-semibold mb-2">{t("titans.showcase.video1.title")}</p>
                <p className="text-white/60 text-sm mb-4">{t("titans.showcase.video1.description")}</p>
                <a 
                  href="https://www.tiktok.com/@titansagencylatam" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-titans-red hover:text-white transition-colors text-sm font-medium"
                >
                  {t("titans.showcase.watchOnTiktok")} →
                </a>
              </section>
            </blockquote>
          </div>

          {/* TikTok Video Embed 2 */}
          <div className="aspect-[9/16] rounded-2xl overflow-hidden bg-titans-dark/50 border border-titans-red/30 relative group">
            <blockquote 
              className="tiktok-embed w-full h-full" 
              cite="https://www.tiktok.com/@titansagencylatam" 
              data-video-id=""
              style={{ maxWidth: '100%', minWidth: '100%' }}
            >
              <section className="flex flex-col items-center justify-center h-full p-6 text-center">
                <TikTokIcon className="w-16 h-16 text-titans-red mb-4" />
                <p className="text-white font-semibold mb-2">{t("titans.showcase.video2.title")}</p>
                <p className="text-white/60 text-sm mb-4">{t("titans.showcase.video2.description")}</p>
                <a 
                  href="https://www.tiktok.com/@titansagencylatam" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-titans-red hover:text-white transition-colors text-sm font-medium"
                >
                  {t("titans.showcase.watchOnTiktok")} →
                </a>
              </section>
            </blockquote>
          </div>

        </div>

        {/* CTA to TikTok */}
        <div className="mt-10 text-center">
          <Button 
            size="lg" 
            asChild
            className="bg-titans-dark text-white hover:bg-titans-dark/80 font-bold shadow-lg border border-titans-red/50"
          >
            <a href="https://www.tiktok.com/@titansagencylatam" target="_blank" rel="noopener noreferrer">
              <TikTokIcon className="w-5 h-5" />
              {t("titans.showcase.followUs")}
            </a>
          </Button>
        </div>
      </Section>

      {/* Join Us Section with QR Code */}
      <Section className="bg-titans-dark py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* QR Code Card */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl border border-white/10 text-center">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {t("titans.join.title")}
            </h3>
            <p className="text-white/60 text-sm mb-6">
              {t("titans.join.admin")}
            </p>
            
            {/* QR Code Ad - Centered */}
            <div className="rounded-2xl overflow-hidden mb-6 max-w-sm mx-auto">
              <img
                src={titansQRCode}
                alt="Titans Agency QR Code"
                className="w-full h-auto object-cover"
                style={{ 
                  imageRendering: 'crisp-edges',
                  marginTop: '-2%',
                  marginBottom: '-2%'
                }}
              />
            </div>
            
            <p className="text-white/90 mb-4">
              {t("titans.join.scanText")}
            </p>
            
            <div className="flex items-center justify-center gap-2 text-white/70 text-sm">
              <TikTokIcon className="w-5 h-5" />
              <span>{t("common.tiktokCreator")}</span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-white/60 text-sm">
              <p>📥 {t("titans.join.instructions.download")}</p>
              <p>📱 {t("titans.join.instructions.open")}</p>
            </div>
            
            <p className="mt-4 text-white/50 text-xs italic">
              {t("titans.join.disclaimer")}
            </p>
          </div>
          
          {/* Contact Info */}
          <div className="text-center">
            <SectionHeader
              eyebrow={t("titans.join.eyebrow")}
              title={t("titans.join.contactTitle")}
              subtitle={t("titans.join.contactSubtitle")}
              className="[&_*]:text-white [&_.text-muted-foreground]:text-white/70 mb-8 md:mb-10 [&_.gold-line]:mt-5"
            />
            
            <div className="space-y-4 flex flex-col items-center">
              <Button 
                size="xl" 
                asChild
                className="bg-green-500 hover:bg-green-600 text-white font-bold text-lg shadow-lg"
              >
                <a href="https://wa.me/573235065263" target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-5 h-5" />
                  WhatsApp
                </a>
              </Button>
              
              <p className="text-3xl md:text-4xl font-bold text-titans-red">
                +57 323 506 5263
              </p>
              
              <p className="text-white/70">
                {t("titans.join.whatsappNote")}
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* CTA Section with Contact Form */}
      <Section className="bg-titans-red py-16 md:py-24">
        <div className="max-w-xl mx-auto">
          <SectionHeader
            eyebrow={t("titans.cta.eyebrow")}
            title={t("titans.cta.title")}
            subtitle={t("titans.cta.subtitle")}
            className="[&_*]:text-white [&_.text-muted-foreground]:text-white/90 mb-8 md:mb-10"
          />

          <form onSubmit={handleFormSubmit} className="space-y-5">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-white font-medium">
                {t("titans.form.fullName")} <span className="text-white/60">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder={t("titans.form.fullNamePlaceholder")}
                className={cn(
                  "bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white focus:ring-white/30 h-12",
                  formErrors.fullName && "border-yellow-300"
                )}
                maxLength={100}
              />
              {formErrors.fullName && (
                <p className="text-yellow-200 text-sm">{formErrors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white font-medium">
                {t("titans.form.email")} <span className="text-white/60">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder={t("titans.form.emailPlaceholder")}
                className={cn(
                  "bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white focus:ring-white/30 h-12",
                  formErrors.email && "border-yellow-300"
                )}
                maxLength={255}
              />
              {formErrors.email && (
                <p className="text-yellow-200 text-sm">{formErrors.email}</p>
              )}
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white font-medium">
                {t("titans.form.phone")} <span className="text-white/60">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder={t("titans.form.phonePlaceholder")}
                className={cn(
                  "bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white focus:ring-white/30 h-12",
                  formErrors.phone && "border-yellow-300"
                )}
                maxLength={17}
              />
              {formErrors.phone && (
                <p className="text-yellow-200 text-sm">{formErrors.phone}</p>
              )}
            </div>

            {/* TikTok Handle */}
            <div className="space-y-2">
              <Label htmlFor="tiktokHandle" className="text-white font-medium">
                {t("titans.form.tiktokHandle")} <span className="text-white/40 text-sm">({t("titans.form.optional")})</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">@</span>
                <Input
                  id="tiktokHandle"
                  type="text"
                  value={formData.tiktokHandle}
                  onChange={(e) => setFormData(prev => ({ ...prev, tiktokHandle: e.target.value.replace(/^@/, '') }))}
                  placeholder={t("titans.form.tiktokPlaceholder")}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white focus:ring-white/30 h-12 pl-8"
                  maxLength={50}
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit"
              size="xl" 
              disabled={isSubmitting}
              className="bg-white text-titans-red hover:bg-white/90 font-bold w-full mt-6"
            >
              {isSubmitting ? (
                t("titans.form.submitting")
              ) : submitSuccess ? (
                t("titans.form.success")
              ) : (
                <>
                  {t("titans.cta.button")}
                  <Send className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>
        </div>
      </Section>
    </>
  );
};

export default TitansAgency;

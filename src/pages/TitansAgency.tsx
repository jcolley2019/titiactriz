import { Helmet } from "react-helmet-async";
import { ArrowRight, Users, TrendingUp, DollarSign, PlayCircle, BarChart3, Handshake, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/Section";
import { StatCard, FeatureCard } from "@/components/Cards";
import TikTokIcon from "@/components/icons/TikTokIcon";

import titansLogo from "@/assets/titans-logo.png";
import cristynaTitans from "@/assets/cristyna-titans-hd.png";
import titansQRCode from "@/assets/titans-qr-code.jpeg";

const TitansAgency = () => {
  const { t } = useTranslation();

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
      <section className="min-h-[70vh] flex items-center pt-24 pb-12 bg-gradient-to-br from-titans-dark via-titans-red to-titans-dark">
        <div className="container-editorial">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              {/* Logo */}
              <div className="mb-8 opacity-0 animate-fade-up">
                <img
                  src={titansLogo}
                  alt="Titans Agency Logo"
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-titans-red"
                />
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl text-white leading-[1.1] mb-6 opacity-0 animate-fade-up stagger-1 drop-shadow-lg">
                <span className="font-titans uppercase tracking-wide">Titans</span>{" "}
                <span className="font-titans-script text-5xl md:text-6xl lg:text-7xl">Agency</span>{" "}
                <span className="font-titans-script text-5xl md:text-6xl lg:text-7xl italic">Latam</span>
              </h1>

              <p className="text-xl md:text-2xl text-white font-medium mb-8 opacity-0 animate-fade-up stagger-2 drop-shadow-md">
                {t("titans.hero.subtitle")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 opacity-0 animate-fade-up stagger-3">
                <Button 
                  size="xl" 
                  asChild
                  className="bg-white text-titans-red hover:bg-white/90 font-bold text-lg shadow-lg"
                >
                  <a href="mailto:yourname@email.com?subject=Titans%20Agency%20Inquiry">
                    {t("titans.hero.workWithUs")}
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </Button>
                <Button 
                  size="xl" 
                  asChild
                  className="bg-titans-dark text-white hover:bg-titans-dark/80 font-bold text-lg shadow-lg border border-white/20"
                >
                  <a href="https://www.tiktok.com/@titansagencylatam" target="_blank" rel="noopener noreferrer">
                    <TikTokIcon className="w-5 h-5" />
                    @titansagencylatam
                  </a>
                </Button>
              </div>
            </div>

            <div className="relative opacity-0 animate-scale-in stagger-2 flex justify-center">
              <div className="relative">
                <div className="w-80 h-80 md:w-[28rem] md:h-[28rem] lg:w-[32rem] lg:h-[32rem] rounded-full bg-gradient-to-br from-titans-dark via-titans-red to-titans-dark overflow-hidden flex items-center justify-center">
                  <img
                    src={cristynaTitans}
                    alt="Titans Agency Latam"
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Decorative ring */}
                <div className="absolute inset-0 rounded-full border-4 border-white/30 scale-110" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <Section className="bg-titans-dark">
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
            icon={<Handshake className="w-6 h-6 text-titans-red" />}
            title={t("titans.services.brandPartnerships.title")}
            description={t("titans.services.brandPartnerships.description")}
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
      <Section className="bg-titans-dark">
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
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-titans-red/20 hover:border-titans-red/50 transition-all duration-300 hover:-translate-y-1">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-titans-red to-pink-500 p-1">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-titans-red/20 to-titans-dark flex items-center justify-center text-3xl font-bold text-white">
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
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-titans-red/20 hover:border-titans-red/50 transition-all duration-300 hover:-translate-y-1">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-titans-red to-orange-500 p-1">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-titans-red/20 to-titans-dark flex items-center justify-center text-3xl font-bold text-white">
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
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-titans-red/20 hover:border-titans-red/50 transition-all duration-300 hover:-translate-y-1">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-titans-red to-purple-500 p-1">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-titans-red/20 to-titans-dark flex items-center justify-center text-3xl font-bold text-white">
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

          {/* Creator 4 */}
          <a 
            href="https://www.tiktok.com/@andres.fitness" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group"
          >
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-titans-red/20 hover:border-titans-red/50 transition-all duration-300 hover:-translate-y-1">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-titans-red to-blue-500 p-1">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-titans-red/20 to-titans-dark flex items-center justify-center text-3xl font-bold text-white">
                  AM
                </div>
              </div>
              <h4 className="text-white font-semibold text-center mb-1">Andrés Martínez</h4>
              <p className="text-titans-red text-sm text-center mb-3">@andres.fitness</p>
              <div className="flex items-center justify-center gap-4 text-white/60 text-sm">
                <div className="text-center">
                  <p className="text-white font-bold text-lg">67K</p>
                  <p className="text-xs">{t("titans.creators.followers")}</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">890K</p>
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
      <Section className="bg-gradient-to-b from-titans-red/20 to-titans-dark">
        <SectionHeader
          eyebrow={t("titans.showcase.eyebrow")}
          title={t("titans.showcase.title")}
          subtitle={t("titans.showcase.subtitle")}
          className="[&_*]:text-white [&_.text-muted-foreground]:text-white/70"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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

          {/* TikTok Video Embed 3 */}
          <div className="aspect-[9/16] rounded-2xl overflow-hidden bg-titans-dark/50 border border-titans-red/30 relative group md:col-span-2 lg:col-span-1 md:max-w-sm md:mx-auto lg:max-w-none">
            <blockquote 
              className="tiktok-embed w-full h-full" 
              cite="https://www.tiktok.com/@titansagencylatam" 
              data-video-id=""
              style={{ maxWidth: '100%', minWidth: '100%' }}
            >
              <section className="flex flex-col items-center justify-center h-full p-6 text-center">
                <TikTokIcon className="w-16 h-16 text-titans-red mb-4" />
                <p className="text-white font-semibold mb-2">{t("titans.showcase.video3.title")}</p>
                <p className="text-white/60 text-sm mb-4">{t("titans.showcase.video3.description")}</p>
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
      <Section className="bg-titans-dark">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* QR Code Card */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 shadow-2xl border border-white/10">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {t("titans.join.title")}
            </h3>
            <p className="text-white/60 text-sm mb-6">
              {t("titans.join.admin")}
            </p>
            
            {/* QR Code */}
            <div className="bg-white rounded-2xl p-6 mb-6 inline-block">
              <img
                src={titansQRCode}
                alt="Titans Agency QR Code"
                className="w-48 h-48 md:w-56 md:h-56 object-contain"
              />
            </div>
            
            <p className="text-white/90 mb-4">
              {t("titans.join.scanText")}
            </p>
            
            <div className="flex items-center gap-2 text-white/70 text-sm">
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
          <div className="text-center lg:text-left">
            <SectionHeader
              eyebrow={t("titans.join.eyebrow")}
              title={t("titans.join.contactTitle")}
              subtitle={t("titans.join.contactSubtitle")}
              className="[&_*]:text-white [&_.text-muted-foreground]:text-white/70"
            />
            
            <div className="mt-8 space-y-6">
              <Button 
                size="xl" 
                asChild
                className="bg-green-500 hover:bg-green-600 text-white font-bold text-lg shadow-lg w-full sm:w-auto"
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

      {/* CTA Section */}
      <Section className="bg-titans-red">
        <div className="max-w-2xl mx-auto text-center">
          <SectionHeader
            eyebrow={t("titans.cta.eyebrow")}
            title={t("titans.cta.title")}
            subtitle={t("titans.cta.subtitle")}
            className="[&_*]:text-white [&_.text-muted-foreground]:text-white/90"
          />

          <Button 
            size="xl" 
            asChild
            className="bg-white text-titans-red hover:bg-white/90 font-semibold"
          >
            <a href="mailto:yourname@email.com?subject=Titans%20Agency%20Discovery%20Call">
              {t("titans.cta.button")}
              <ArrowRight className="w-5 h-5" />
            </a>
          </Button>
        </div>
      </Section>
    </>
  );
};

export default TitansAgency;

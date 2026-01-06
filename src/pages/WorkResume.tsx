import { Helmet } from "react-helmet-async";
import { Download, ExternalLink, Play, Mail, Sparkles, Heart, Target, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/Section";
import { FeatureCard } from "@/components/Cards";
import { StaggerContainer, StaggerItem } from "@/components/ScrollReveal";

import actingImage from "@/assets/cristyna-acting-headshot.png";
import danceImage from "@/assets/cristyna-dance.jpg";

const WorkResume = () => {
  const { t } = useTranslation();

  const dancePerformances = [
    { title: t("work.dance.performances.p1.title"), venue: t("work.dance.performances.p1.venue") },
    { title: t("work.dance.performances.p2.title"), venue: t("work.dance.performances.p2.venue") },
    { title: t("work.dance.performances.p3.title"), venue: t("work.dance.performances.p3.venue") },
  ];

  const actingCredits = [
    { title: t("work.acting.credits.resume"), type: "document", href: "#" },
    { title: t("work.acting.credits.dramatic"), type: "video", href: "#" },
    { title: t("work.acting.credits.commercial"), type: "video", href: "#" },
  ];

  return (
    <>
      <Helmet>
        <title>Portfolio | Cristyna Polentino - Acting & Dance</title>
        <meta
          name="description"
          content="Cristyna Polentino's professional portfolio - Acting credits, dance performances, and media work. View resume, reels, and booking information."
        />
        <meta property="og:title" content="Portfolio - Cristyna Polentino" />
        <meta
          property="og:description"
          content="Acting credits, dance performances, and media work from Colombian actress and dancer Cristyna Polentino."
        />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Hero Section */}
      <section className="min-h-[50vh] flex items-center pt-24 pb-12">
        <div className="container-editorial text-center">
          <span className="text-caps text-accent mb-4 block opacity-0 animate-fade-up">
            {t("work.hero.eyebrow")}
          </span>

          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-foreground leading-[1.1] mb-6 opacity-0 animate-fade-up stagger-1">
            {t("nav.portfolio")}
          </h1>

          <p className="text-xl text-muted-foreground mb-8 opacity-0 animate-fade-up stagger-2">
            {t("work.hero.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8 opacity-0 animate-fade-up stagger-3">
            <Button variant="gold-outline" size="xl" asChild>
              <a href="https://youtube.com/@mimundoderoles6875?si=Ghscb9PFsG1-Gzuz" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-5 h-5" />
                {t("work.hero.youtubeChannel")}
              </a>
            </Button>
          </div>

          {/* Social Row */}
          <div className="flex gap-4 justify-center opacity-0 animate-fade-up stagger-4">
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
      </section>

      {/* What I Bring Section */}
      <Section background="muted">
        <SectionHeader
          eyebrow={t("strengths.eyebrow")}
          title={t("strengths.title")}
          subtitle={t("strengths.subtitle")}
        />

        <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StaggerItem>
            <FeatureCard
              icon={<Sparkles className="w-6 h-6" />}
              title={t("strengths.presence.title")}
              description={t("strengths.presence.description")}
            />
          </StaggerItem>
          <StaggerItem>
            <FeatureCard
              icon={<Heart className="w-6 h-6" />}
              title={t("strengths.creativity.title")}
              description={t("strengths.creativity.description")}
            />
          </StaggerItem>
          <StaggerItem>
            <FeatureCard
              icon={<Target className="w-6 h-6" />}
              title={t("strengths.discipline.title")}
              description={t("strengths.discipline.description")}
            />
          </StaggerItem>
          <StaggerItem>
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title={t("strengths.adaptability.title")}
              description={t("strengths.adaptability.description")}
            />
          </StaggerItem>
        </StaggerContainer>
      </Section>

      {/* Professional Dance Section */}
      <Section background="muted">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="image-frame">
            <img
              src={danceImage}
              alt="Cristyna Polentino dance performance"
              className="w-full h-auto rounded-lg"
            />
          </div>

          <div>
            <SectionHeader
              eyebrow={t("work.dance.eyebrow")}
              title={t("work.dance.title")}
              centered={false}
              className="text-left"
            />

            <div className="space-y-4">
              {dancePerformances.map((performance, index) => (
                <a
                  key={index}
                  href="#"
                  className="group flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:border-accent/50 transition-colors"
                >
                  <div>
                    <h4 className="font-serif text-lg text-foreground group-hover:text-accent transition-colors">
                      {performance.title}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {performance.venue}
                    </p>
                  </div>
                  <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Acting Section */}
      <Section>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <SectionHeader
              eyebrow={t("work.acting.eyebrow")}
              title={t("work.acting.title")}
              centered={false}
              className="text-left"
            />

            <div className="space-y-4">
              {actingCredits.map((credit, index) => (
                <a
                  key={index}
                  href={credit.href}
                  className="group flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:border-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {credit.type === "video" ? (
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Play className="w-5 h-5 text-accent" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                        <Download className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <h4 className="font-serif text-lg text-foreground group-hover:text-accent transition-colors">
                      {credit.title}
                    </h4>
                  </div>
                  <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                </a>
              ))}
            </div>
          </div>

          <div className="order-1 lg:order-2 image-frame">
            <img
              src={actingImage}
              alt="Cristyna Polentino acting headshot"
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      </Section>

      {/* Featured Video Section */}
      <Section background="muted">
        <SectionHeader
          eyebrow={t("work.reel.eyebrow")}
          title={t("work.reel.title")}
          subtitle={t("work.reel.subtitle")}
        />

        <div className="max-w-4xl mx-auto">
          <div className="aspect-video rounded-2xl overflow-hidden bg-foreground/5 border border-border/50">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/sjtUdw-rUT4"
              title="Cristyna Polentino Reel"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </Section>

      {/* Bookings CTA */}
      <Section background="accent">
        <div className="max-w-2xl mx-auto text-center">
          <SectionHeader
            eyebrow={t("work.bookings.eyebrow")}
            title={t("work.bookings.title")}
            subtitle={t("work.bookings.subtitle")}
          />

          <Button variant="editorial" size="xl" asChild>
            <a href="mailto:yourname@email.com?subject=Booking%20Inquiry">
              <Mail className="w-5 h-5" />
              {t("work.bookings.button")}
            </a>
          </Button>
        </div>
      </Section>
    </>
  );
};

export default WorkResume;

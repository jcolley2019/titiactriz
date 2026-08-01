import SEO from "@/components/SEO";
import { Download, ExternalLink, Play, Mail, Sparkles, Heart, Target, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/Section";
import { FeatureCard } from "@/components/Cards";
import { StaggerContainer, StaggerItem } from "@/components/ScrollReveal";
import ParallaxImage from "@/components/ParallaxImage";

import actingImage from "@/assets/cristyna-acting-headshot.webp";
import danceImage from "@/assets/cristyna-dance.webp";

const WorkResume = () => {
  const { t } = useTranslation();

  // STRIP.FAKE.1 — the three dance performances and the two acting reels were
  // placeholder content: invented venues and tours, every row an `href="#"`
  // going nowhere. They are gone. What is left is what is true: the résumé row
  // and the EL CASTING reel embedded further down, which is a real, live piece.
  const actingCredits = [
    { title: t("work.acting.credits.resume"), type: "document", href: "#" },
  ];

  return (
    <>
      <SEO
        path="/work"
        title="Portafolio de Actuación y Danza | Cristyna Polentino"
        description="Portafolio profesional de Cristyna Polentino: créditos de actuación, presentaciones de danza, demo reels y contratación. Acting & dance portfolio from Medellín."
      />

      {/* Hero Section */}
      <section className="min-h-[50vh] flex items-center pt-28 pb-10 sm:pt-24 sm:pb-12">
        <div className="container-editorial text-center">
          <span className="text-caps text-accent mb-3 sm:mb-4 block opacity-0 animate-fade-up">
            {t("work.hero.eyebrow")}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-foreground leading-[1.1] mb-4 sm:mb-6 opacity-0 animate-fade-up stagger-1">
            {t("nav.portfolio")}
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-6 sm:mb-8 opacity-0 animate-fade-up stagger-2">
            {t("work.hero.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-6 sm:mb-8 opacity-0 animate-fade-up stagger-3">
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
            <ParallaxImage
              src={danceImage}
              alt="Cristyna Polentino dance performance"
              containerClassName="rounded-lg"
              speed={0.1}
            />
          </div>

          <div>
            <SectionHeader
              eyebrow={t("work.dance.eyebrow")}
              title={t("work.dance.title")}
              centered={false}
              className="text-left"
            />

            {/* An honest empty state: a quiet line on the card surface, with no
                chevron and no hover, so nothing reads as a link to press. */}
            <p className="p-4 rounded-xl bg-card border border-border/50 text-sm text-muted-foreground">
              {t("work.dance.soon")}
            </p>
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

              {/* Same honest empty state as the dance column: the two reel rows
                  that used to sit here pointed at nothing. */}
              <p className="p-4 rounded-xl bg-card border border-border/50 text-sm text-muted-foreground">
                {t("work.acting.reelSoon")}
              </p>
            </div>
          </div>

          <div className="order-1 lg:order-2 image-frame">
            <ParallaxImage
              src={actingImage}
              alt="Cristyna Polentino acting headshot"
              containerClassName="rounded-lg"
              speed={0.1}
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

          {/* GOLD.BTN.1 — the bookings CTA is brand GOLD like every other call to
              action on the site (Studio's two, the hero's outline). The
              `editorial` variant paints cream-on-charcoal, which read as a
              second, off-brand accent sitting under a gold eyebrow and a gold
              rule. Same variant family, same size — only the colour moves. */}
          <Button variant="gold" size="xl" asChild>
            <a href="mailto:hola@titiactriz.com?subject=Booking%20Inquiry">
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

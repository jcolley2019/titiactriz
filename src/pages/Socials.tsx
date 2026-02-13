import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Instagram, Youtube, Facebook } from "lucide-react";
import { Section, SectionHeader } from "@/components/Section";
import TikTokIcon from "@/components/icons/TikTokIcon";

const Socials = () => {
  const { t } = useTranslation();

  const socialLinks = [
    {
      name: "TikTok",
      icon: TikTokIcon,
      href: "https://www.tiktok.com/@titina_polen?_r=1&_t=ZT-92aYp2I0zF1",
      handle: "@titina_polen",
      description: t("socials.tiktok.description"),
      color: "bg-gradient-to-br from-[#ff0050] to-[#00f2ea]",
      enabled: true,
    },
    {
      name: "Instagram",
      icon: Instagram,
      href: "https://www.instagram.com/cristinapolentino_actriz?igsh=aTJuZXJjNWhsOGZh",
      handle: "@cristinapolentino_actriz",
      description: t("socials.instagram.description"),
      color: "bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045]",
      enabled: true,
    },
    {
      name: "YouTube",
      icon: Youtube,
      href: "https://youtube.com/@mimundoderoles6875?si=Ghscb9PFsG1-Gzuz",
      handle: "@mimundoderoles6875",
      description: t("socials.youtube.description"),
      color: "bg-[#ff0000]",
      enabled: true,
    },
    {
      name: "Facebook",
      icon: Facebook,
      href: "#",
      handle: t("socials.facebook.comingSoon"),
      description: t("socials.facebook.description"),
      color: "bg-[#1877f2]",
      enabled: false,
    },
  ];

  return (
    <>
      <Helmet>
        <title>Follow Cristina Polentino | TikTok, Instagram & YouTube</title>
        <meta
          name="description"
          content="Follow Cristina Polentino on TikTok (@titina_polen), Instagram (@cristinapolentino_actriz), and YouTube. Stay updated with her latest content, performances, and behind-the-scenes moments."
        />
        <link rel="canonical" href="https://cristinapolentino.com/socials" />
        <meta property="og:title" content="Follow Cristina Polentino on Social Media" />
        <meta
          property="og:description"
          content="Connect with Cristina Polentino on TikTok, Instagram, YouTube and more. Behind-the-scenes, performances, and daily content."
        />
        <meta property="og:url" content="https://cristinapolentino.com/socials" />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Hero Section */}
      <section className="min-h-[40vh] flex items-center pt-28 pb-10 sm:pt-24 sm:pb-12">
        <div className="container-editorial text-center">
          <span className="text-caps text-accent mb-3 sm:mb-4 block opacity-0 animate-fade-up">
            {t("socials.eyebrow")}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-foreground leading-[1.1] mb-4 sm:mb-6 opacity-0 animate-fade-up stagger-1">
            {t("socials.title")}
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-6 sm:mb-8 opacity-0 animate-fade-up stagger-2 max-w-2xl mx-auto">
            {t("socials.subtitle")}
          </p>
        </div>
      </section>

      {/* Social Links Grid */}
      <Section>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {socialLinks.map((social, index) => {
            const IconComponent = social.icon;
            
            return social.enabled ? (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex flex-col items-center p-8 rounded-2xl bg-card border border-border/50 hover:border-accent/50 transition-all duration-500 hover:scale-105 hover:shadow-xl opacity-0 animate-fade-up"
                style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'forwards' }}
              >
                <div className={`w-16 h-16 rounded-2xl ${social.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <IconComponent className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-serif text-xl text-foreground mb-1">{social.name}</h3>
                <p className="text-accent text-sm font-medium mb-2">{social.handle}</p>
                <p className="text-muted-foreground text-sm text-center">{social.description}</p>
              </a>
            ) : (
              <div
                key={social.name}
                className="relative flex flex-col items-center p-8 rounded-2xl bg-card/50 border border-border/30 opacity-50 cursor-not-allowed"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4`}>
                  <IconComponent className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-serif text-xl text-muted-foreground mb-1">{social.name}</h3>
                <p className="text-muted-foreground/70 text-sm font-medium mb-2">{social.handle}</p>
                <p className="text-muted-foreground/70 text-sm text-center">{social.description}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* CTA Section */}
      <Section background="accent">
        <div className="max-w-2xl mx-auto text-center">
          <SectionHeader
            eyebrow={t("socials.cta.eyebrow")}
            title={t("socials.cta.title")}
            subtitle={t("socials.cta.subtitle")}
          />
        </div>
      </Section>
    </>
  );
};

export default Socials;

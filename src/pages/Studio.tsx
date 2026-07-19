import { useTranslation } from "react-i18next";
import { ExternalLink, ArrowRight } from "lucide-react";
import SEO from "@/components/SEO";
import { Section, SectionHeader } from "@/components/Section";
import { Button } from "@/components/ui/button";

const projects = [
  { name: "titiactriz.com", url: "/", descKey: "studio.work.items.titiactriz", image: "/titiactriz-shot.webp", current: true },
  { name: "TitiLinks", url: "https://titilinks.com", descKey: "studio.work.items.titilinks", image: "/titilinks-shot.webp" },
  { name: "JoeyC.ai", url: "https://joeyc.ai", descKey: "studio.work.items.joeyc", image: "/joeyc-shot.webp" },
  { name: "Luxvibe", url: "https://luxvibe.io", descKey: "studio.work.items.luxvibe", image: "/luxvibe-shot.webp" },
  { name: "FieldReport AI", url: "https://fieldreportai.app", descKey: "studio.work.items.fieldreport", image: "/fieldreport-shot.webp" },
];

const Studio = () => {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        path="/studio"
        title={t("studio.seo.title")}
        description={t("studio.seo.description")}
      />

      {/* HERO */}
      <section className="section-padding relative z-10">
        <div className="container-editorial">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <img
                src="/joey-studio.webp"
                alt="Joey Colley studio"
                className="w-auto max-h-[520px] mx-auto border border-accent/40"
              />
            </div>
            <div>
              <span className="text-caps text-accent block mb-4">
                {t("studio.hero.eyebrow")}
              </span>
              <h1 className="font-serif text-4xl md:text-5xl text-foreground leading-tight">
                {t("studio.hero.title")}
              </h1>
              <p className="text-muted-foreground text-lg mt-5 leading-relaxed">
                {t("studio.hero.subtitle")}
              </p>
              <div className="mt-8">
                <Button asChild variant="gold">
                  <a
                    href="https://joeyc.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("studio.hero.cta")}
                    <ArrowRight />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WORK */}
      <Section>
        <SectionHeader
          eyebrow={t("studio.work.eyebrow")}
          title={t("studio.work.title")}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
          {projects.map((item) => (
            <div
              key={item.name}
              className="border border-border/40 bg-background/40 hover:border-accent/50 transition-colors flex flex-col overflow-hidden"
            >
              <div className="aspect-[2/1] overflow-hidden border-b border-border/40 bg-background">
                <img src={item.image} alt={`${item.name} screenshot`} loading="lazy" className="w-full h-full object-cover object-top" />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h3 translate="no" className="notranslate font-serif text-xl text-foreground">{item.name}</h3>
                <p className="text-muted-foreground text-sm mt-2 flex-1">{t(item.descKey)}</p>
                {item.current ? (
                  <a href={item.url} className="mt-4 inline-flex items-center gap-2 text-accent text-caps text-xs hover:text-gold-light transition-colors">
                    {t("studio.work.current")}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-accent text-caps text-xs hover:text-gold-light transition-colors">
                    {t("studio.work.visit")}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* CLOSING CTA */}
      <Section>
        <p className="font-serif text-2xl md:text-3xl text-foreground text-center">
          {t("studio.cta.line")}
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild variant="gold">
            <a
              href="https://joeyc.ai"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("studio.cta.button")}
              <ArrowRight />
            </a>
          </Button>
        </div>
      </Section>
    </>
  );
};

export default Studio;

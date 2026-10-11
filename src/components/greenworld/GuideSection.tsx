import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ExternalLink, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lang } from "@/hooks/useEventsBoard";
import { useStreamVideo } from "@/hooks/useStreamVideo";
import {
  GREEN_WORLD_WHATSAPP_URL,
  guideSignupHref,
  guideText,
  pickGuideVideo,
  type GreenWorldGuide,
} from "@/lib/greenworld-guide";
import { GREEN_WORLD_GUIDE_ANCHOR } from "@/lib/ventures";

/** How long the route's entrance (PageTransition: 300 ms, y 20→0) needs before a hash scroll lands true. */
const ENTRANCE_MS = 350;

/**
 * GW.GUIDE.1 — the tutorial clip, played exactly as EventFramedVideo plays a
 * Stream ref: HLS through useStreamVideo, the Stream thumbnail as poster,
 * native controls, no autoplay. A 16:9 well on the page's cream, no framing.
 */
const GuideVideo = ({ src, label }: { src: string; label: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useStreamVideo(videoRef, src, { autoLoad: false });
  return (
    <video
      ref={videoRef}
      src={stream.src}
      data-stream-src={stream.manifest}
      poster={stream.poster}
      data-qa="gw-guide-video"
      aria-label={label}
      controls
      playsInline
      preload="metadata"
      className="w-full aspect-video bg-gw-green-dark rounded-2xl shadow-2xl object-contain"
    />
  );
};

/**
 * GW.GUIDE.1 — "Cómo comprar": the step-by-step guide the cinematic home's
 * Green World act promises. Heading, intro and the register CTA are always
 * here; the video block and the numbered steps appear only when the admin has
 * filled them in, so an empty guide is a complete section, never a dead player
 * or an empty list. The page owns the fetch (useGreenWorldGuide) because its
 * head's HowTo JSON-LD reads the same guide.
 */
type Props = { guide: GreenWorldGuide; loading: boolean; lang: Lang };

const GuideSection = ({ guide, loading, lang }: Props) => {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const sectionRef = useRef<HTMLElement>(null);

  // The home act's CTA lands on /green-world#como-comprar. A browser hash
  // scroll fires before this section has its content (and while the route's
  // entrance is still translating the page), so it is re-aimed once the data
  // has settled and the entrance has finished.
  useEffect(() => {
    if (loading || hash !== `#${GREEN_WORLD_GUIDE_ANCHOR}`) return;
    const timer = window.setTimeout(() => sectionRef.current?.scrollIntoView({ block: "start" }), ENTRANCE_MS);
    return () => window.clearTimeout(timer);
  }, [loading, hash]);

  const video = pickGuideVideo(guide, lang);
  const signup = guideSignupHref(guide, lang);

  return (
    <section
      id={GREEN_WORLD_GUIDE_ANCHOR}
      ref={sectionRef}
      data-qa="gw-guide"
      data-loading={loading ? "true" : undefined}
      className="scroll-mt-28 py-16 sm:py-24 bg-gw-cream relative"
    >
      <div className="container-editorial">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-gw-navy font-bold text-sm uppercase tracking-widest mb-4">
            {t("greenWorld.guide.eyebrow")}
          </p>
          <h2 className="font-sans font-bold text-3xl md:text-4xl lg:text-5xl text-gw-text mb-4 uppercase">
            {t("greenWorld.guide.title")}
          </h2>
          <div className="w-16 h-1 bg-gw-gold mx-auto mb-6" />
          <p className="text-gw-text/70 text-lg md:text-xl leading-relaxed">{t("greenWorld.guide.intro")}</p>
        </div>

        {video && (
          <div className="max-w-3xl mx-auto mt-10 md:mt-14">
            <GuideVideo src={video.ref} label={t("greenWorld.guide.videoLabel")} />
            {video.fallbackFromEs && (
              <p data-qa="gw-guide-video-note" className="mt-3 text-center text-gw-text/60 text-sm">
                {t("greenWorld.guide.videoEsOnly")}
              </p>
            )}
          </div>
        )}

        {guide.steps.length > 0 && <Steps guide={guide} lang={lang} />}

        <div className="mt-10 md:mt-14 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="bg-gw-green hover:bg-gw-green-dark text-gw-white font-bold h-14 px-10 rounded-lg shadow-lg hover:shadow-xl transition-all"
            asChild
          >
            <a href={signup.href} target="_blank" rel="noopener noreferrer" data-qa="gw-guide-cta">
              {t(signup.kind === "signup" ? "greenWorld.guide.cta" : "greenWorld.guide.ctaWhatsapp")}
              <ExternalLink className="w-4 h-4 ml-2" aria-hidden />
            </a>
          </Button>
          {signup.kind === "signup" && (
            <a
              href={GREEN_WORLD_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-qa="gw-guide-whatsapp"
              className="inline-flex min-h-11 items-center gap-2 text-gw-green font-bold text-sm uppercase tracking-wider hover:text-gw-green-dark transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              {t("greenWorld.guide.whatsapp")}
            </a>
          )}
        </div>
      </div>
    </section>
  );
};

const Steps = ({ guide, lang }: { guide: GreenWorldGuide; lang: Lang }) => (
  <ol data-qa="gw-guide-steps" className="max-w-3xl mx-auto mt-12 md:mt-16 space-y-10 md:space-y-12 list-none">
    {guide.steps.map((step, i) => (
      <li key={step.id} data-qa="gw-guide-step" className="flex gap-5 md:gap-8">
        <span
          aria-hidden
          className="font-serif text-gw-gold text-4xl md:text-5xl font-bold leading-none tabular-nums shrink-0 w-12 md:w-16 text-right"
        >
          {i + 1}
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="font-sans font-bold text-xl md:text-2xl text-gw-text">{guideText(step.title, lang)}</h3>
          {guideText(step.body, lang) && (
            <p className="mt-2 text-gw-text/70 text-base md:text-lg leading-relaxed whitespace-pre-line">
              {guideText(step.body, lang)}
            </p>
          )}
          {step.image && (
            <img
              src={step.image.url}
              alt={step.image.alt}
              loading="lazy"
              className="mt-5 w-full rounded-2xl border border-gw-green/10 shadow-lg"
            />
          )}
        </div>
      </li>
    ))}
  </ol>
);

export default GuideSection;

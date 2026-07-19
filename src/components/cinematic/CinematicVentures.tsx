import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, ShoppingBag } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { GREEN_WORLD_SHOP_URL, TITANS_ROUTE } from "@/lib/ventures";
import gwLogo from "@/assets/greenworld-logo-clean.webp";
import titansLogo from "@/assets/titans-logo-color.webp";

gsap.registerPlugin(ScrollTrigger);

type Side = "green-world" | "titans";

type PanelProps = {
  side: Side;
  bgClass: string;
  logo: string;
  logoAlt: string;
  chip: boolean; // wrap the logo in a white card (Green World mark needs it)
  eyebrow: string;
  valueProp: string;
  ctaLabel: string;
  ctaTextClass: string;
  reduced: boolean;
  hovered: Side | null;
  setHovered: (s: Side | null) => void;
};

const CTA_BASE =
  "inline-flex items-center gap-2 rounded-md bg-white px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] shadow-lg transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

/**
 * One venture half. Full-bleed brand gradient + logo + one-line value prop + a
 * large CTA. On desktop the hovered half expands (~55/45) and brightens while
 * the other dims; on mobile the panels stack full-width. Hover motion is gated
 * behind `reduced` so reduced-motion users get a static, equal split.
 */
const VenturePanel = ({
  side,
  bgClass,
  logo,
  logoAlt,
  chip,
  eyebrow,
  valueProp,
  ctaLabel,
  ctaTextClass,
  reduced,
  hovered,
  setHovered,
}: PanelProps) => {
  const isHovered = hovered === side;
  const otherHovered = hovered !== null && hovered !== side;

  // Grow ratio drives the ~55/45 expansion; basis-0 makes grow == width share.
  const flexGrow = reduced || hovered === null ? 1 : isHovered ? 1.15 : 0.85;
  // Dark scrim: lighter (brighter panel) when hovered, heavier when the sibling
  // is hovered, neutral otherwise / under reduced motion.
  const overlayOpacity = reduced ? 0.25 : isHovered ? 0.08 : otherHovered ? 0.52 : 0.26;

  const ctaContent = (
    <>
      {side === "green-world" ? <ShoppingBag className="h-4 w-4" /> : null}
      {ctaLabel}
      {side === "titans" ? <ArrowRight className="h-4 w-4" /> : null}
    </>
  );

  return (
    <div
      data-qa={`venture-${side}`}
      className={`cine-venture-panel relative flex min-h-[60vh] shrink-0 grow basis-0 items-center justify-center overflow-hidden px-6 py-16 md:min-h-0 ${bgClass} ${
        reduced ? "" : "transition-[flex-grow] duration-500 ease-out"
      }`}
      style={{ flexGrow }}
      onMouseEnter={() => !reduced && setHovered(side)}
      onMouseLeave={() => !reduced && setHovered(null)}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-500"
        style={{ opacity: overlayOpacity }}
        aria-hidden
      />

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <p
          className="mb-6 text-xs font-medium uppercase tracking-[0.3em]"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          {eyebrow}
        </p>

        {chip ? (
          <div className="rounded-2xl bg-white px-6 py-5 shadow-xl">
            <img src={logo} alt={logoAlt} className="h-16 w-auto md:h-20" loading="lazy" decoding="async" />
          </div>
        ) : (
          <img
            src={logo}
            alt={logoAlt}
            className="h-28 w-auto rounded-full shadow-xl md:h-36"
            loading="lazy"
            decoding="async"
          />
        )}

        <p className="mt-8 text-lg leading-relaxed text-white/90 md:text-xl">{valueProp}</p>

        <div className="mt-9">
          {side === "titans" ? (
            <Link
              to={TITANS_ROUTE}
              data-qa="venture-titans-cta"
              className={`${CTA_BASE} ${ctaTextClass}`}
            >
              {ctaContent}
            </Link>
          ) : (
            <a
              href={GREEN_WORLD_SHOP_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-qa="venture-green-world-cta"
              className={`${CTA_BASE} ${ctaTextClass}`}
            >
              {ctaContent}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

type Props = { reduced: boolean };

/**
 * TA.6b ventures act — a full-bleed Green World / Titans Agency split panel.
 * Green World links straight to Cristyna's external storefront (the same
 * destination its page's Shop CTA uses); Titans routes to the internal Titans
 * Agency page. Panels reveal on scroll; under reduced motion they render as a
 * static, fully functional side-by-side (stacked on mobile).
 */
const CinematicVentures = ({ reduced }: Props) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState<Side | null>(null);

  useLayoutEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.from(".cine-venture-panel", {
        y: 44,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.16,
        scrollTrigger: { trigger: sectionRef.current, start: "top 78%" },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={sectionRef} data-qa="cinematic-ventures" className="relative w-full">
      <div className="flex flex-col md:flex-row md:min-h-[80vh]">
        <VenturePanel
          side="green-world"
          bgClass="bg-gradient-to-br from-gw-green via-gw-green to-gw-green-dark"
          logo={gwLogo}
          logoAlt="Green World"
          chip
          eyebrow={t("cinematic.ventures.greenWorld.eyebrow")}
          valueProp={t("cinematic.ventures.greenWorld.valueProp")}
          ctaLabel={t("cinematic.ventures.greenWorld.cta")}
          ctaTextClass="text-gw-green"
          reduced={reduced}
          hovered={hovered}
          setHovered={setHovered}
        />
        <VenturePanel
          side="titans"
          bgClass="bg-gradient-to-br from-titans-dark via-titans-red to-titans-dark"
          logo={titansLogo}
          logoAlt="Titans Agency Latam"
          chip={false}
          eyebrow={t("cinematic.ventures.titans.eyebrow")}
          valueProp={t("cinematic.ventures.titans.valueProp")}
          ctaLabel={t("cinematic.ventures.titans.cta")}
          ctaTextClass="text-titans-red"
          reduced={reduced}
          hovered={hovered}
          setHovered={setHovered}
        />
      </div>
    </section>
  );
};

export default CinematicVentures;

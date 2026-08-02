import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Instagram, Youtube, Music } from "lucide-react";
// TL.LIVE.1 — one address for the product, shared with the nav (see ventures.ts).
import { TITILINKS_URL } from "@/lib/ventures";

gsap.registerPlugin(ScrollTrigger);

/**
 * TA.8 — TitiLinks act. A scroll-driven showcase of Cristyna's link-in-bio
 * product (live at titilinks.com), placed after the Titans act and before About.
 *
 * Three scenes over a pinned range, then a clean release:
 *   1. Arrival — a floating browser-window frame settles as scroll begins.
 *   2. Tour — a native mini-recreation of the TitiLinks hero translates upward
 *      INSIDE the frame while phones parallax and gold feature chips fly in.
 *   3. Announcement — the frame recedes/blurs; a gold launch card irises in via
 *      an expanding circular clip-path with a CTA to titilinks.com.
 *
 *      TL.LIVE.2 — that card used to read "¡MUY PRONTO!" / "COMING SOON". The
 *      product shipped, so it now reads "YA DISPONIBLE" / "NOW LIVE" and the CTA
 *      says visit rather than discover. The act already sent people to the real
 *      titilinks.com; only the promise around it was stale. This matches the nav,
 *      where TL.LIVE.1 moved TitiLinks out of the coming-soon disclosure and made
 *      it a plain external destination.
 *   Release (TA.8a) — as the pin ends, the act's content fades and scales down
 *      slightly (~0.96) while a single thin gold line sweeps once horizontally;
 *      normal scroll then continues into About. The release lives ENTIRELY inside
 *      this section — nothing is portalled to <body>, so no overlay element can
 *      ever exist outside the act at any scroll position.
 *
 * NO code sharing / iframe / embed with the real product — everything here is a
 * static, hand-built recreation. Under reduced motion the whole thing degrades
 * to a static, fully-functional stacked composition (no pin, no release anim).
 */

const TL_BG = "#0e0c09"; // warm near-black (TitiLinks landing background)
const GOLD = "#C9A55C";
const SURFACE = "hsl(30 12% 12%)";

const CALLOUT_KEYS = [
  "fullscreen",
  "video",
  "creators",
  "celebs",
  "ecommerce",
  "luxury",
] as const;

/* ---------------- Mini phone mockup ---------------- */
type PhoneVariant = { name: string; handle: string; accent: string; cover: string };

const MiniPhone = ({ v, className = "", w = 150 }: { v: PhoneVariant; className?: string; w?: number }) => {
  const scale = w / 300;
  return (
    <div className={className} style={{ width: w, height: 620 * scale }} aria-hidden>
      <div style={{ width: 300, transformOrigin: "top left", transform: `scale(${scale})` }}>
        <div
          className="relative rounded-[44px] p-2.5"
          style={{
            backgroundColor: "#1a1a1a",
            boxShadow:
              "0 25px 50px -12px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.08), 0 0 50px -8px rgba(201,165,92,0.35)",
          }}
        >
          <div className="relative overflow-hidden rounded-[34px]" style={{ height: 600, backgroundColor: TL_BG }}>
            {/* Dynamic island */}
            <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
              <div className="h-[30px] w-[100px] rounded-full bg-black" />
            </div>
            {/* Cover */}
            <div className="relative h-[260px] w-full" style={{ background: v.cover }}>
              <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 40%, ${TL_BG} 100%)` }} />
              <div className="absolute inset-x-0 bottom-3 flex flex-col items-center">
                <p className="text-[18px] font-semibold text-white">{v.name}</p>
                <p className="text-[12px] text-white/55">{v.handle}</p>
              </div>
            </div>
            {/* Socials */}
            <div className="mt-2 flex items-center justify-center gap-3">
              {[Instagram, Youtube, Music].map((Icon, i) => (
                <div key={i} className="grid h-8 w-8 place-items-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <Icon className="h-4 w-4" style={{ color: v.accent }} />
                </div>
              ))}
            </div>
            {/* Buttons */}
            <div className="mt-3 flex flex-col gap-2.5 px-4">
              <div className="rounded-full py-3 text-center text-[13px] font-bold" style={{ backgroundColor: v.accent, color: "#1a1200" }}>
                Latest drop
              </div>
              <div className="rounded-full py-3 text-center text-[13px] font-semibold text-white" style={{ backgroundColor: SURFACE, border: "1px solid rgba(255,255,255,0.08)" }}>
                Watch reel
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="aspect-square rounded-2xl" style={{ background: v.cover }} />
                <div className="aspect-square rounded-2xl" style={{ background: v.cover, opacity: 0.7 }} />
              </div>
            </div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/30">
              <span className="text-white/45">Titi</span>
              <span className="italic" style={{ color: v.accent }}>Links</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PHONES: PhoneVariant[] = [
  { name: "Valentina Ríos", handle: "@valeria.rios", accent: GOLD, cover: "linear-gradient(150deg, #4a2c3a, #2a1620)" },
  { name: "Mateo Cruz", handle: "@mateo.crz", accent: "#E24A54", cover: "linear-gradient(150deg, #3a2420, #201410)" },
  { name: "AURA Studio", handle: "@aura.studio", accent: "#5EC2A0", cover: "linear-gradient(150deg, #1c3a33, #10201c)" },
];

/* ---------------- Mini landing (inside the browser frame) ---------------- */
const MiniLanding = ({ innerRef }: { innerRef?: React.Ref<HTMLDivElement> }) => {
  const { t } = useTranslation();
  return (
    <div ref={innerRef} data-qa="tl-landing" className="tl-landing absolute inset-x-0 top-0 px-6 pt-10 pb-16" style={{ backgroundColor: TL_BG }}>
      {/* soft gold spotlight */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 45% at 70% 20%, rgba(201,165,92,0.12) 0%, transparent 60%)" }}
      />
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: GOLD }}>
          {t("cinematic.titilinks.eyebrow")}
        </p>
        <p translate="no" className="notranslate mb-5 font-display text-2xl font-semibold" style={{ color: GOLD, fontFamily: "var(--font-display)" }}>
          {t("cinematic.titilinks.brand")}
        </p>
        <h3
          className="mx-auto max-w-xl font-semibold leading-[1.02] text-white"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.9rem, 4.4vw, 3.4rem)" }}
        >
          {t("cinematic.titilinks.headline")}
        </h3>
        <p className="mx-auto mt-4 max-w-md text-sm text-white/60 sm:text-base">
          {t("cinematic.titilinks.sub")}
        </p>
        {/* Handle claimer */}
        <div className="mx-auto mt-7 flex max-w-md items-center rounded-full p-1.5" style={{ backgroundColor: SURFACE, border: "1px solid rgba(201,165,92,0.35)" }}>
          <span translate="no" className="notranslate whitespace-nowrap pl-4 pr-1 text-sm text-white/45">
            {t("cinematic.titilinks.domain")}/
          </span>
          <span className="flex-1 py-2 text-left text-sm text-white/30">yourname</span>
          <span className="rounded-full px-5 py-2 text-sm font-semibold" style={{ backgroundColor: GOLD, color: TL_BG }}>
            Claim
          </span>
        </div>
      </div>
      {/* Phones */}
      <div className="relative z-10 mt-10 flex items-start justify-center gap-5">
        <MiniPhone v={PHONES[0]} w={150} className="tl-phone tl-phone-1 mt-6" />
        <MiniPhone v={PHONES[1]} w={168} className="tl-phone tl-phone-2" />
        <MiniPhone v={PHONES[2]} w={150} className="tl-phone tl-phone-3 mt-10 hidden sm:block" />
      </div>
    </div>
  );
};

/* ---------------- Launch card ---------------- */
const LaunchCard = ({ cardRef, clipped }: { cardRef?: React.Ref<HTMLDivElement>; clipped: boolean }) => {
  const { t } = useTranslation();
  return (
    <div
      ref={cardRef}
      data-qa="tl-launch"
      className="pointer-events-auto absolute left-1/2 top-1/2 z-30 w-[min(90vw,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl px-8 py-10 text-center"
      style={{
        backgroundColor: "rgba(14,12,9,0.92)",
        border: `1px solid ${GOLD}`,
        boxShadow: "0 30px 80px -20px rgba(0,0,0,0.8), 0 0 60px -20px rgba(201,165,92,0.5)",
        ...(clipped ? { clipPath: "circle(0% at 50% 50%)" } : {}),
      }}
    >
      <span
        className="inline-block rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em]"
        style={{ backgroundColor: GOLD, color: TL_BG }}
      >
        {t("cinematic.titilinks.badge")}
      </span>
      <p className="mt-6 font-display text-2xl font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
        {t("cinematic.titilinks.announce")}
      </p>
      <a
        href={TITILINKS_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-qa="tl-cta"
        translate="no"
        className="mt-8 inline-flex items-center gap-2 rounded-md px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ backgroundColor: GOLD, color: TL_BG }}
      >
        {t("cinematic.titilinks.cta")}
      </a>
    </div>
  );
};

/* ---------------- Browser frame ---------------- */
const BrowserFrame = ({
  frameRef,
  innerRef,
  domain,
}: {
  frameRef?: React.Ref<HTMLDivElement>;
  innerRef?: React.Ref<HTMLDivElement>;
  domain: string;
}) => (
  <div
    ref={frameRef}
    data-qa="tl-frame"
    className="tl-frame relative mx-auto w-full max-w-[640px] overflow-hidden rounded-xl"
    style={{
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 40px 90px -30px rgba(0,0,0,0.85), 0 0 70px -30px rgba(201,165,92,0.35)",
    }}
  >
    {/* Chrome */}
    <div className="flex items-center gap-3 px-4 py-2.5" style={{ backgroundColor: "#141210", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex gap-1.5">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "#e2564d" }} />
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "#e2b64d" }} />
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "#5ec26a" }} />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 rounded-md px-4 py-1 text-xs text-white/60" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ border: `1.5px solid ${GOLD}` }} />
          <span translate="no" className="notranslate">{domain}</span>
        </div>
      </div>
      <div className="w-10" />
    </div>
    {/* Viewport (clips the translating mini-landing) */}
    <div className="tl-frame-viewport relative overflow-hidden" style={{ height: "clamp(320px, 56vh, 560px)", backgroundColor: TL_BG }}>
      <MiniLanding innerRef={innerRef} />
    </div>
  </div>
);

/* ---------------- Static callouts row (shared) ---------------- */
const Callouts = ({ refs }: { refs?: React.MutableRefObject<(HTMLSpanElement | null)[]> }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap justify-center gap-2.5 lg:flex-col lg:items-start">
      {CALLOUT_KEYS.map((key, i) => (
        <span
          key={key}
          ref={(el) => {
            if (refs) refs.current[i] = el;
          }}
          data-qa="tl-callout"
          className="tl-callout inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white/90"
          style={{ backgroundColor: "rgba(201,165,92,0.08)", border: `1px solid ${GOLD}` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
          {t(`cinematic.titilinks.callouts.${key}`)}
        </span>
      ))}
    </div>
  );
};

type Props = { reduced: boolean };

const CinematicTitiLinks = ({ reduced }: Props) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const calloutRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useLayoutEffect(() => {
    if (reduced) return;
    const stage = stageRef.current;
    if (!stage) return;

    const ctx = gsap.context(() => {
      // Scenes 1–3 plus the release, all on ONE pinned timeline. Because the
      // release is part of this timeline (not a body portal), every animated
      // element stays a descendant of this section at all times.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: "+=300%",
          scrub: true,
          pin: true,
          anticipatePin: 1,
        },
      });

      // Scene 1 — arrival: the frame glides up and settles.
      tl.from(
        frameRef.current,
        { yPercent: 14, opacity: 0, rotateX: 10, transformPerspective: 900, duration: 0.8, ease: "power2.out" },
        0,
      );

      // Scene 2 — tour: the mini-landing translates up inside the frame; phones
      // parallax at different rates; callouts fly in staggered.
      tl.to(innerRef.current, { yPercent: -42, ease: "none", duration: 1.9 }, 0.8);
      tl.to(".tl-phone-1", { yPercent: -8, ease: "none", duration: 1.9 }, 0.8);
      tl.to(".tl-phone-2", { yPercent: -20, ease: "none", duration: 1.9 }, 0.8);
      tl.to(".tl-phone-3", { yPercent: -13, ease: "none", duration: 1.9 }, 0.8);
      calloutRefs.current.forEach((el, i) => {
        if (el) tl.from(el, { x: 60, opacity: 0, duration: 0.4, ease: "power3.out" }, 1.0 + i * 0.22);
      });

      // Scene 3 — announcement: frame recedes + blurs; the card irises open via
      // an expanding circular clip-path. GSAP tweens a plain number and writes
      // the clip-path in onUpdate (reliable across engines, unlike interpolating
      // the clip-path string directly).
      tl.to(frameRef.current, { scale: 0.92, filter: "blur(4px)", opacity: 0.6, duration: 0.5, ease: "power2.inOut" }, 2.9);
      const iris = { r: 0 };
      tl.to(
        iris,
        {
          r: 85,
          duration: 0.5,
          ease: "power2.out",
          onUpdate: () => {
            const el = cardRef.current;
            if (el) el.style.clipPath = `circle(${iris.r}% at 50% 50%)`;
          },
        },
        3.0,
      );

      // Release (TA.8a) — clean exit: the act's content fades + scales to 0.96
      // while a single thin gold line sweeps once left→right. No portal, no
      // fixed overlay: when the pin lets go, normal scroll continues into About
      // and nothing from this act remains painted anywhere on the page.
      tl.to(contentRef.current, { opacity: 0, scale: 0.96, duration: 0.6, ease: "power2.in" }, 3.7);
      tl.set(sweepRef.current, { opacity: 1, scaleX: 0, transformOrigin: "left center" }, 3.7);
      tl.to(sweepRef.current, { scaleX: 1, duration: 0.3, ease: "power1.in" }, 3.7);
      tl.set(sweepRef.current, { transformOrigin: "right center" }, 4.0);
      tl.to(sweepRef.current, { scaleX: 0, duration: 0.3, ease: "power1.out" }, 4.0);
    }, sectionRef);

    return () => ctx.revert();
  }, [reduced]);

  /* ----- Reduced motion: static, fully-functional stacked composition ----- */
  if (reduced) {
    return (
      <section
        ref={sectionRef}
        data-qa="cinematic-titilinks"
        className="relative w-full overflow-hidden px-6 py-24"
        style={{ backgroundColor: TL_BG }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: GOLD }}>
            {t("cinematic.titilinks.eyebrow")}
          </p>
          <h2 data-qa="section-heading" className="font-semibold text-white" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.9rem,4.4vw,3.2rem)" }}>
            {t("cinematic.titilinks.headline")}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-white/60">{t("cinematic.titilinks.sub")}</p>
        </div>
        <div className="mx-auto mt-10 max-w-[560px]">
          <BrowserFrame domain={t("cinematic.titilinks.domain")} />
        </div>
        <div className="mx-auto mt-10 max-w-2xl">
          <Callouts />
        </div>
        <div className="relative mx-auto mt-12 h-[22rem] max-w-3xl">
          <LaunchCard clipped={false} />
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} data-qa="cinematic-titilinks" className="relative w-full" style={{ backgroundColor: TL_BG }}>
      <div ref={stageRef} className="cine-vh-full relative w-full overflow-hidden" style={{ backgroundColor: TL_BG }}>
        {/* Everything that fades/scales on release is inside this one wrapper. */}
        <div ref={contentRef} className="absolute inset-0">
          {/* Ambient gold spotlight + vignette. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 45% at 60% 40%, rgba(201,165,92,0.10) 0%, transparent 60%), radial-gradient(120% 100% at 50% 0%, transparent 55%, rgba(0,0,0,0.55) 100%)",
            }}
          />
          <div className="relative z-10 mx-auto flex h-full max-w-6xl items-center px-6">
            <div className="grid w-full items-center gap-8 lg:grid-cols-[1.15fr_0.6fr] lg:gap-10">
              <BrowserFrame frameRef={frameRef} innerRef={innerRef} domain={t("cinematic.titilinks.domain")} />
              <div className="hidden lg:block">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: GOLD }}>
                  {t("cinematic.titilinks.eyebrow")}
                </p>
                <Callouts refs={calloutRefs} />
              </div>

              {/* MOBILE.EDGE.1 — the phone's callout row, INSIDE the stage's own
                  centred column.

                  It used to be a SIBLING of that column, placed after a block
                  that is `h-full` — so it began at the stage's bottom edge and
                  ran 150px past it. The stage clips (`overflow-hidden`), so what
                  the phone actually rendered was the top few pixels of the first
                  row of pills: two gold hairlines across the foot of the act,
                  which is the artifact Joey saw. Nothing was leaking from the
                  next act; the act was overflowing itself.

                  As a grid child it shares the column's `items-center` centring
                  and the `gap-8` that already separates the frame from the copy,
                  so the row is inside the clip by construction rather than by a
                  margin that has to be kept in sync with the frame's height.
                  `lg:hidden` removes it from the grid entirely above the
                  breakpoint, where the right-hand column carries the callouts. */}
              <div className="mx-auto w-full max-w-2xl lg:hidden">
                <Callouts />
              </div>
            </div>
          </div>

          {/* Announcement card irises in over the whole stage during scene 3. */}
          <LaunchCard cardRef={cardRef} clipped />
        </div>

        {/* Release sweep — a single thin gold line, wiped once across on exit.
            Lives inside the stage (never portalled), so it cannot leak past the
            act. Starts collapsed + invisible; the timeline drives it. */}
        <div
          ref={sweepRef}
          data-qa="tl-exit-sweep"
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-[60]"
          style={{
            top: "calc(50% - 0.75px)",
            height: "1.5px",
            background: `linear-gradient(90deg, transparent, ${GOLD} 20%, ${GOLD} 80%, transparent)`,
            boxShadow: "0 0 14px rgba(201,165,92,0.65)",
            opacity: 0,
            transform: "scaleX(0)",
            transformOrigin: "left center",
          }}
        />

        {/* Accessible heading for the section (kept visually within the stage). */}
        <h2 data-qa="section-heading" className="sr-only">
          {t("cinematic.titilinks.brand")} — {t("cinematic.titilinks.headline")}
        </h2>
      </div>
    </section>
  );
};

export default CinematicTitiLinks;

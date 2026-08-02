import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FIELD_GROUND, FIELD_LIGHT, SEAM_GOLD } from "./FramedVideo";
import { GOLD, IVORY } from "./reelSpotlight";
import { PlatformIcon } from "@/components/PlatformIcon";
import { useSocialLinks, type SocialLink } from "./useSocialLinks";

gsap.registerPlugin(ScrollTrigger);

/**
 * PORT.SOC.9 — the Socials act.
 *
 * WHAT THE PORT.ACT.1 PROPOSAL SETTLED, and what this file obeys without asking:
 *
 *   · It is NOT a spread. It is "a tonal room holding the platform grid, gold
 *     hairline tiles on near-black, brand marks rendered exactly as each brand
 *     draws them." The room is the reel's own ground and luminance gradient, so
 *     the act belongs to the same page as everything above it.
 *   · It is UNNUMBERED. The reel owns 01-03 and the chapter spine is for
 *     chapters; a directory that took a numeral would promise a story beat it
 *     does not deliver. Its header therefore follows the Book act's unnumbered
 *     grammar — gold caps eyebrow, a single hairline rule, Cinzel headline,
 *     body — not the spread's numeral-rule-label lockup.
 *   · It sits AFTER the TitiLinks act. TitiLinks sells the link-in-bio idea and
 *     this act is Cristyna's own instance of it. Claim, then proof.
 *   · Every tile is a real destination. A row with no address never reaches
 *     this component (useSocialLinks drops it), and an act with no enabled rows
 *     renders NOTHING rather than an empty room.
 *
 * WHAT IT DID NOT SETTLE — and what this file therefore refuses to decide:
 *
 *     What a tile SAYS, and how dense the grid is.
 *
 * "Gold hairline tiles carrying brand marks" fixes the material, not the
 * composition. A mark alone, a mark with its platform's name, and a mark with a
 * name and a handle are three different acts: a contact sheet, a directory and
 * a set of cards. They want different tile shapes, different densities and
 * different amounts of the reader's attention, and the schema already carries
 * the `handle` column that only the third one uses. So all three are BUILT,
 * none is chosen, and `SOCIALS_ACT_VARIANT` is null until Joey picks one.
 *
 *   A — THE MARK WALL. Mark only, densest grid (3/4/6 across). The name ships
 *       for screen readers and appears on hover, never at rest. Purest as
 *       design; tells a scanning reader the least.
 *   B — THE NAMED ROW. Mark over its platform name (2/3/4 across). Every
 *       destination legible without hovering. The middle reading.
 *   C — THE HANDLE CARD. Mark, name and handle (1/2/3 across). Most
 *       information, closest to the /socials 4-up grid it replaces, and the
 *       only one that spends the `handle` column.
 *
 * OPEN SUB-QUESTION, deliberately NOT turned into a fourth candidate: whether a
 * tile should paint the unfurl cache (og_title / og_image). The cache exists and
 * travels with every row, but a social profile's OG image is usually the
 * platform's own logo — it would put a second, worse copy of the brand mark
 * inside a tile that already draws the real one. Left unpainted in all three so
 * the three stay comparable. Say the word and it becomes candidate D.
 *
 * Under reduced motion the act renders complete and static: every entrance is a
 * gsap.from(), so if the timeline never runs, nothing was ever hidden.
 */

export type SocialsVariant = "A" | "B" | "C";

type Props = { reduced: boolean; variant: SocialsVariant };

/* ─────────────────────────── the shared tile ─────────────────────────── */

const TILE_BASE =
  "group relative flex items-center justify-center transition-transform duration-300 hover:-translate-y-0.5";

const tileStyle: React.CSSProperties = {
  border: `1px solid ${SEAM_GOLD}`,
  backgroundColor: "rgba(255,255,255,0.015)",
};

const nameStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  color: IVORY,
  fontSize: 11,
  fontWeight: 400,
  letterSpacing: "0.14em",
};

/** A tile is an anchor or it is nothing — there is no inert tile. */
const Tile = ({
  link,
  label,
  className,
  children,
}: {
  link: SocialLink;
  label: string;
  className: string;
  children: React.ReactNode;
}) => (
  <a
    data-qa="socials-tile"
    data-platform={link.platform}
    href={link.url}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    className={`${TILE_BASE} ${className}`}
    style={tileStyle}
  >
    {children}
  </a>
);

/* ───────────────────────── the three candidates ───────────────────────── */

type GridProps = {
  links: SocialLink[];
  labelOf: (l: SocialLink) => string;
  gridRef: React.Ref<HTMLDivElement>;
};

/** A — THE MARK WALL. Mark only; the name is read, not seen, until hover. */
const MarkWall = ({ links, labelOf, gridRef }: GridProps) => (
  <div
    ref={gridRef}
    data-qa="socials-grid"
    data-variant="A"
    className="grid w-full grid-cols-3 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-6"
  >
    {links.map((l) => (
      <Tile key={l.id} link={l} label={labelOf(l)} className="aspect-square">
        <PlatformIcon label={l.platform} size={26} />
        <span
          data-qa="socials-name"
          className="pointer-events-none absolute inset-x-0 bottom-2 text-center uppercase opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{ ...nameStyle, fontSize: 9, letterSpacing: "0.16em" }}
        >
          {labelOf(l)}
        </span>
      </Tile>
    ))}
  </div>
);

/** B — THE NAMED ROW. Mark over its name; nothing hides. */
const NamedRow = ({ links, labelOf, gridRef }: GridProps) => (
  <div
    ref={gridRef}
    data-qa="socials-grid"
    data-variant="B"
    className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4"
  >
    {links.map((l) => (
      <Tile
        key={l.id}
        link={l}
        label={labelOf(l)}
        className="aspect-[1.6/1] flex-col gap-2.5 px-3"
      >
        <PlatformIcon label={l.platform} size={26} />
        <span
          data-qa="socials-name"
          className="block max-w-full truncate text-center uppercase"
          style={nameStyle}
        >
          {labelOf(l)}
        </span>
      </Tile>
    ))}
  </div>
);

/** C — THE HANDLE CARD. Mark, name and handle; the only one that spends it. */
const HandleCard = ({ links, labelOf, gridRef }: GridProps) => (
  <div
    ref={gridRef}
    data-qa="socials-grid"
    data-variant="C"
    className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3"
  >
    {links.map((l) => (
      <Tile
        key={l.id}
        link={l}
        label={labelOf(l)}
        className="!justify-start gap-4 px-5 py-4 text-left"
      >
        <span className="flex h-11 w-11 flex-none items-center justify-center">
          <PlatformIcon label={l.platform} size={28} />
        </span>
        <span className="min-w-0">
          <span
            data-qa="socials-name"
            className="block truncate uppercase"
            style={{ ...nameStyle, fontSize: 12 }}
          >
            {labelOf(l)}
          </span>
          {/* The handle is the one thing this candidate exists to show, so an
              absent one leaves a quiet line rather than a collapsed card. */}
          <span
            data-qa="socials-handle"
            className="mt-1 block truncate"
            style={{
              fontFamily: "var(--font-sans)",
              color: l.handle ? "rgba(240,233,218,0.55)" : "rgba(240,233,218,0.28)",
              fontSize: 11,
              fontWeight: 300,
              letterSpacing: "0.04em",
            }}
          >
            {l.handle ?? "—"}
          </span>
        </span>
      </Tile>
    ))}
  </div>
);

const GRIDS: Record<SocialsVariant, (p: GridProps) => JSX.Element> = {
  A: MarkWall,
  B: NamedRow,
  C: HandleCard,
};

/* ─────────────────────────────── the act ─────────────────────────────── */

const CinematicSocials = ({ reduced, variant }: Props) => {
  const { t, i18n } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const { links, loading } = useSocialLinks();
  const locale = i18n.language?.toLowerCase().startsWith("en") ? "en" : "es";
  const hasLinks = links.length > 0;

  /**
   * The pin is built only once the act has rows, because until then the act is
   * not in the DOM at all. Inserting a pinned trigger above existing ones
   * leaves theirs measured against a shorter page, so this sorts the whole list
   * into document order BEFORE refreshing — the same fix CinematicReel and
   * CinematicActing carry, for the same reason.
   */
  useLayoutEffect(() => {
    if (reduced || !hasLinks) return;
    const stage = stageRef.current;
    if (!stage) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: "top 72%" },
      });
      if (headerRef.current) {
        tl.from(headerRef.current, { opacity: 0, y: 16, duration: 0.6, ease: "power3.out" }, 0);
      }
      if (gridRef.current) {
        // The tiles arrive as a field, not one at a time: a stagger across a
        // directory reads as a loading screen.
        tl.from(gridRef.current, { opacity: 0, y: 14, duration: 0.6, ease: "power3.out" }, 0.22);
      }

      // The uniform dwell law (REVIEW.3a): every single-frame act on this page
      // holds for +=120% before it releases, and the distances are ONE number.
      // A directory is not a chapter, but it is still a full frame the reader
      // arrives at, and an act that let go early would be the page's outlier.
      ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        end: "+=120%",
        pin: true,
        anticipatePin: 1,
      });
    }, sectionRef);

    ScrollTrigger.sort();
    ScrollTrigger.refresh();

    return () => ctx.revert();
  }, [reduced, hasLinks, variant]);

  const labelOf = (l: SocialLink) =>
    (locale === "en" ? l.title_en : l.title_es)?.trim() || l.platform;

  const Grid = GRIDS[variant];

  /**
   * An act with nothing to point at paints NOTHING — no room, no header, no
   * "coming soon", and no height.
   *
   * It does that by emptying the section rather than by returning null, and
   * that distinction is load-bearing. GSAP pins by WRAPPING an element in a
   * `pin-spacer` div, which moves it out from under React's feet: once About
   * below has been pinned, React's record of this page's children no longer
   * matches the DOM's. A section that arrives late is then inserted BEFORE a
   * sibling that is no longer a child of the same parent, and React throws
   * NotFoundError: Failed to execute 'insertBefore'. Measured here on the first
   * build of this act, which returned null while its rows loaded and took the
   * whole cinematic home down with it when they arrived.
   *
   * So the section is here from the first paint and stays. Only its CONTENTS
   * are conditional — the same shape CinematicActing uses, and the reason that
   * act mounts a stage before it has anything to put in one.
   */
  if (loading || !hasLinks) {
    return <section ref={sectionRef} data-qa="cinematic-socials" data-empty="true" aria-hidden />;
  }

  return (
    <section ref={sectionRef} data-qa="cinematic-socials" className="relative w-full">
      <div
        ref={stageRef}
        data-qa="socials-stage"
        data-variant={variant}
        className="cine-vh-full relative flex w-full flex-col items-center justify-center overflow-hidden px-6 py-20"
        // The tonal room, edge to edge — the same ground and luminance gradient
        // the reel spreads and the Acting act paint.
        style={{ backgroundColor: FIELD_GROUND, backgroundImage: FIELD_LIGHT }}
      >
        <div className="flex w-full max-w-5xl flex-col items-center">
          {/* The unnumbered header, in the Book act's grammar. */}
          <div ref={headerRef} data-qa="socials-header" className="flex flex-col items-center">
            <p
              data-qa="socials-eyebrow"
              className="uppercase"
              style={{
                fontFamily: "var(--font-sans)",
                color: GOLD,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.25em",
              }}
            >
              {t("cinematic.socials.eyebrow")}
            </p>

            <span
              aria-hidden
              data-qa="socials-rule"
              className="mt-5 block h-px w-16"
              style={{ backgroundColor: GOLD }}
            />

            <h2
              data-qa="section-heading"
              className="mt-7 text-center uppercase"
              style={{
                fontFamily: "var(--font-display)",
                color: IVORY,
                fontSize: "clamp(1.75rem, 4vw, 3.25rem)",
                fontWeight: 400,
                lineHeight: 1.15,
                letterSpacing: "0.06em",
              }}
            >
              {t("cinematic.socials.title")}
            </h2>

            <p
              data-qa="socials-body"
              className="mt-6 max-w-md text-center text-sm leading-relaxed"
              style={{
                fontFamily: "var(--font-sans)",
                color: "rgba(240,233,218,0.72)",
                fontWeight: 300,
              }}
            >
              {t("cinematic.socials.body")}
            </p>
          </div>

          <div className="mt-12 w-full">
            <Grid links={links} labelOf={labelOf} gridRef={gridRef} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CinematicSocials;

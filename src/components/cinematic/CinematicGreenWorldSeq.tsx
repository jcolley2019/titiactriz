import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import gsap from "gsap";

import SeqAct from "./seq/SeqAct";
import { SEQ_PACKS } from "./seq/sequences";
import type { FrameSequence } from "./seq/sequences";
import { useReelIsPhone } from "./reelSpotlight";
import { GREEN_WORLD_ROUTE, GW_LOGO_READY, GW_LOGO_SRC } from "@/lib/ventures";

/**
 * SEQ.2 — Green World, as a pinned scroll-scrub act.
 *
 * Replaces the TA.7a curtain-and-loop-video act (kept in-repo, unmounted, at
 * ./CinematicGreenWorld.tsx). Scroll is now the literal playhead: the pin lasts
 * +=300% — the same length the reel and TitiLinks acts already cost a reader —
 * and the frames advance between two dead stops, so the act arrives held on its
 * first frame and leaves held on its last.
 *
 * Everything painted OVER the canvas is static by construction. The plate moves;
 * the mark, the type and the button do not. That is the whole composition: the
 * only thing the reader's scroll drives is the water.
 *
 * ## The three layers over the plate
 *
 * 1. LOGO — dead centre, never parallaxed, never scrubbed. The re-cut packs are
 *    logo-free (SEQ.1b) precisely so this layer can exist; a mark baked into the
 *    plate would swim with the water. It is fully wired here and paints nothing
 *    while GW_LOGO_READY is false — see the flag in @/lib/ventures for what
 *    unblocks it. The empty layer keeps its geometry and its spec hooks, so the
 *    day the flag flips, the mark lands where the specs already say it lands.
 * 2. SCRIM — a single bottom-weighted gradient. The plates are bright water at
 *    both ends of the scrub, so the lower third is darkened rather than the
 *    whole frame: type stays AA legible without the act turning into a tinted
 *    photograph.
 * 3. LOCKUP — the site's ratified three-part shape, unchanged from TitiLinks:
 *    a gold Label eyebrow, the Headline, and exactly ONE Body line. No health
 *    claims (PRODUCT.md law) — the copy says where the products come from and
 *    that she will show you how to order, and stops there.
 *
 * ## The CTA is a dead-stop event, not a scrubbed value
 *
 * A button whose opacity tracks progress reads as a smear. Instead the act
 * LATCHES on the final dead stop — the moment the mapped playhead reaches 1,
 * which is exactly when the frames stop advancing — and hands the entrance to
 * GSAP (fade + rise, power3.out). Per scrub frame the work is one comparison;
 * the tween runs once per crossing, in either direction, so scrolling back up
 * puts the button away again cleanly.
 *
 * ## Reduced motion
 *
 * SeqAct never builds a pin, so `onProgress` never fires. The first frame, the
 * logo layer, the full lockup and a fully visible, clickable CTA are all painted
 * immediately — the act degrades to a still poster with working type, which is
 * what it should have been all along for a reader who asked for less motion.
 */

/** Gold: the ratified accent (DESIGN.md "Filament Gold"). */
const GOLD = "#C9A55C";
/** Warm near-black — the FrameScrubber's own backdrop, restated for the scrim. */
const NEAR_BLACK = "#0b0a08";

/**
 * Mapped playhead at which the CTA is considered to have reached the final dead
 * stop. The mapping clamps at 1 for the whole lead-out zone, so this fires the
 * instant the frames stop advancing rather than at the very end of the pin.
 */
const CTA_REVEAL_AT = 0.999;

/** Hidden resting state of the CTA, in one place so the tween and the inline style agree. */
const CTA_HIDDEN_Y = 24;

/**
 * Pack selection. The phone/wide line is `reelSpotlight`'s 768px — the same one
 * the reel splits on and the same one `useIsMobile` uses — so a viewport that is
 * a phone for the reel is a phone here too. It is read SYNCHRONOUSLY on first
 * render: swapping packs after mount would throw away a warm decode cache and
 * restart the sequence under the reader.
 */
function packFor(isPhone: boolean): FrameSequence {
  const id = isPhone ? "gw-port-1080" : "gw-land-1920";
  const pack = SEQ_PACKS.find((p) => p.id === id);
  if (!pack) throw new Error(`SEQ.2: pack ${id} is missing from the census`);
  return pack;
}

type Props = { reduced: boolean };

const CinematicGreenWorldSeq = ({ reduced }: Props) => {
  const { t } = useTranslation();
  const isPhone = useReelIsPhone();
  const sequence = useMemo(() => packFor(isPhone), [isPhone]);

  // The entrance is animated on a WRAPPER, never on the link itself: GSAP owns
  // the wrapper's inline `transform`, and the link keeps its own hover lift —
  // an inline transform on the anchor would beat the hover utility and quietly
  // kill it.
  const ctaLayerRef = useRef<HTMLDivElement>(null);
  const ctaLinkRef = useRef<HTMLAnchorElement>(null);
  // The latch. A ref, not state: this is compared on every scrub frame.
  const ctaShownRef = useRef(reduced);

  const handleProgress = useCallback((mapped: number) => {
    const layer = ctaLayerRef.current;
    if (!layer) return;
    const want = mapped >= CTA_REVEAL_AT;
    if (want === ctaShownRef.current) return;
    ctaShownRef.current = want;

    // A reversal mid-tween must not leave the button half-faded and clickable.
    gsap.killTweensOf(layer);
    layer.setAttribute("data-gw-cta-state", want ? "shown" : "hidden");
    // Hit-testing and the tab order flip IMMEDIATELY, not over the tween: a
    // button that is still 30% transparent must not already be clickable, and
    // one on its way out must stop being a tab stop the moment it is dismissed.
    gsap.set(layer, { pointerEvents: want ? "auto" : "none" });
    layer.setAttribute("aria-hidden", want ? "false" : "true");
    if (ctaLinkRef.current) ctaLinkRef.current.tabIndex = want ? 0 : -1;

    gsap.to(layer, {
      opacity: want ? 1 : 0,
      y: want ? 0 : CTA_HIDDEN_Y,
      duration: want ? 0.55 : 0.3,
      ease: want ? "power3.out" : "power2.in",
    });
  }, []);

  return (
    <div data-qa="cinematic-greenworld-seq">
      <SeqAct
        sequence={sequence}
        reduced={reduced}
        backdrop={NEAR_BLACK}
        onProgress={reduced ? undefined : handleProgress}
      >
        {/* 1 — LOGO. Centred over the canvas and completely still. Wired but
            empty while GW_LOGO_READY is false: the box keeps its size and its
            spec hooks so the geometry is asserted before the mark ever exists,
            and `data-gw-logo` states plainly which of the two it is. */}
        <div
          data-qa="gw-seq-logo"
          data-gw-logo={GW_LOGO_READY && GW_LOGO_SRC ? "on" : "off"}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
        >
          <div style={{ width: "clamp(10rem, 34vw, 26rem)" }}>
            {GW_LOGO_READY && GW_LOGO_SRC ? (
              <img
                src={GW_LOGO_SRC}
                alt=""
                data-qa="gw-seq-logo-img"
                className="block h-auto w-full select-none"
                draggable={false}
              />
            ) : null}
          </div>
        </div>

        {/* 2 — SCRIM. Bottom-weighted only; the plate keeps its top two-thirds. */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          aria-hidden
          style={{
            background: `linear-gradient(180deg, rgba(11,10,8,0) 42%, rgba(11,10,8,0.62) 74%, rgba(11,10,8,0.9) 100%)`,
          }}
        />

        {/* 3 — LOCKUP. Lower third, centred at every width. The block itself is
            pointer-transparent — the CTA layer is the ONLY thing in this act
            that takes a pointer, and it takes one only once it has arrived.
            Without this, the type wrapper is a full-width invisible target
            sitting over the button's own neighbourhood. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-6 pb-14 md:pb-20">
          <div className="mx-auto max-w-2xl text-center">
            <p
              data-qa="gw-seq-eyebrow"
              className="text-[11px] font-semibold uppercase tracking-[0.24em]"
              style={{ color: GOLD }}
            >
              {t("cinematic.gwSeq.eyebrow")}
            </p>
            <h2
              data-qa="section-heading"
              translate="no"
              className="notranslate mt-4 font-semibold leading-[1.04] text-white"
              style={{
                fontFamily: "var(--font-display)",
                // DESIGN.md's Headline ramp, verbatim. The neighbouring acts
                // each invented their own clamp and each carry a detector
                // advisory for it; this one does not need to add a seventh.
                fontSize: "clamp(1.75rem, 4vw, 3.25rem)",
              }}
            >
              {t("cinematic.gwSeq.title")}
            </h2>
            <p
              data-qa="gw-seq-body"
              className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-white/70 md:text-base"
            >
              {t("cinematic.gwSeq.body")}
            </p>

            <div
              ref={ctaLayerRef}
              data-qa="gw-seq-cta-layer"
              data-gw-cta-state={reduced ? "shown" : "hidden"}
              aria-hidden={reduced ? undefined : true}
              className="mt-8 flex justify-center"
              style={{
                // Painted straight into the inline style so the button cannot
                // flash before GSAP's first write. Reduced motion starts, and
                // stays, at the resting-visible state.
                opacity: reduced ? 1 : 0,
                transform: reduced ? undefined : `translateY(${CTA_HIDDEN_Y}px)`,
                pointerEvents: reduced ? "auto" : "none",
              }}
            >
              <Link
                ref={ctaLinkRef}
                to={GREEN_WORLD_ROUTE}
                data-qa="gw-seq-cta"
                tabIndex={reduced ? 0 : -1}
                className="inline-flex items-center rounded-md px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] shadow-lg transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                style={{ backgroundColor: GOLD, color: NEAR_BLACK }}
              >
                {t("cinematic.gwSeq.cta")}
              </Link>
            </div>
          </div>
        </div>
      </SeqAct>
    </div>
  );
};

export default CinematicGreenWorldSeq;

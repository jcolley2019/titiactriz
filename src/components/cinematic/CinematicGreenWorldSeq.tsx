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
 * 1. LOGO — the brand's own lockup, never parallaxed, never scrubbed. The re-cut
 *    packs are logo-free (SEQ.1b) precisely so this layer can exist; a mark baked
 *    into the plate would swim with the water. It paints nothing while
 *    GW_LOGO_READY is false — see the flag in @/lib/ventures for what unblocks
 *    it. Since GW.LOGO.5 it carries the NAME as well as the mark, which is why
 *    the act no longer sets the name in type; see the band note below for why it
 *    is not simply centred.
 * 2. SCRIM — a single bottom-weighted gradient. The plates are bright water at
 *    both ends of the scrub, so the lower third is darkened rather than the
 *    whole frame: type stays AA legible without the act turning into a tinted
 *    photograph.
 * 3. LOCKUP — the site's ratified shape minus its headline, which the brand's
 *    wordmark now supplies: a gold Label credential and exactly ONE Body line.
 *    No health claims (PRODUCT.md law) — the copy says where the products come
 *    from and that she will show you how to order, and stops there. The heading
 *    survives as an `sr-only` h2, the same way CinematicTitiLinks keeps one: the
 *    document outline and the section-heading census both still want a heading
 *    even when the name is drawn rather than set.
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
 * The band the lockup is allowed to occupy, as a fraction of the stage.
 *
 * This is a legibility constraint, not a taste one. The brand's wordmark is
 * BLACK, so unlike the white type below it, it gets darker ground the further
 * down the stage it sits. Two things darken that ground, and they compound:
 *
 *   • the SCRIM below, which is transparent to 42% and reaches 0.62 alpha by 74%;
 *   • the plates themselves, which are bright water nearly throughout EXCEPT the
 *     portrait pack, which carries a dark band at roughly 32-38% of its height.
 *
 * Composited over every one of the 72 frames in each pack, the ground that holds
 * black at >=7:1 is 1-55% on the landscape plate, and 1-31% plus 39-57% on the
 * portrait one — the phone's usable window is the LOWER of its two, because the
 * upper one collides with the header. Hence two bands rather than one clamp:
 *
 *   phone   39% -> 58%   (under the dark band, above the scrim's onset)
 *   wide    13% -> 54%   (clear of the header, above the scrim's onset)
 *
 * The lockup is fitted to the band's HEIGHT with width following, so the black
 * wordmark — the bottom ~15% of the asset — cannot drift out of the band when
 * the viewport aspect changes. Re-measure if the scrim or either pack is re-cut.
 */
const LOGO_BAND = "top-[39%] h-[19%] md:top-[13%] md:h-[41%]";

/**
 * GW.BRIGHT.1 — the plate's grade, applied to the CANVAS only.
 *
 * The act read as though a gray mask sat over it. It is worth being precise
 * about what was actually wrong, because the obvious fix was the wrong one: the
 * plate's HIGHLIGHTS were never dim. Measured over all three dead stops, the
 * brightest decile of the untouched canvas already sat at 245/255 at 1440 and
 * 244/255 at 390 — 96% — so there was no headroom to "brighten" into. Pushing
 * brightness alone past 1.04 simply clipped: 1.05 blew 2.3% of the frame to pure
 * white at 1440 and 4.6% at 390, trading a gray wash for a blown one.
 *
 * The wash lived in the MIDTONES, which were both dark and — the reason it read
 * as gray rather than merely dim — desaturated: mean HSV saturation across the
 * midtone band was 15% at 1440. So the grade is mostly saturation, which costs
 * no headroom at all, plus the largest brightness the clip budget actually
 * affords. Calibrated against the measurement, worst of three dead stops:
 *
 *                    brightest decile      pure white      midtone saturation
 *   1440  before          245                 0.00%              15.2%
 *   1440  after           252                 0.00%              21.8%
 *    390  before          244                 0.00%              18.4%
 *    390  after           251                 0.28%              25.7%
 *
 * brightness(1.03) is the ceiling: 1.04 breaks the <1% clip budget at 390
 * (1.10%). Re-measure with e2e/seq2-greenworld's wordmark-ground test if either
 * pack is ever re-cut. The scrim is deliberately untouched — it is what protects
 * the white type below, and grading it would undo that.
 */
const PLATE_GRADE = "brightness(1.03) saturate(1.35)";

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
        canvasFilter={PLATE_GRADE}
        onProgress={reduced ? undefined : handleProgress}
      >
        {/* 1 — LOGO. Horizontally centred, vertically pinned to LOGO_BAND, and
            completely still. Wired but empty while GW_LOGO_READY is false: the
            band keeps its geometry and its spec hooks whether or not there is an
            asset, and `data-gw-logo` states plainly which of the two it is.
            Decorative here — the name it draws is announced once by the sr-only
            heading below, so alt is empty rather than doubling it. */}
        <div
          data-qa="gw-seq-logo"
          data-gw-logo={GW_LOGO_READY && GW_LOGO_SRC ? "on" : "off"}
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 z-20 flex items-center justify-center px-6 ${LOGO_BAND}`}
        >
          {GW_LOGO_READY && GW_LOGO_SRC ? (
            <img
              src={GW_LOGO_SRC}
              alt=""
              data-qa="gw-seq-logo-img"
              // Height-bound so the black wordmark stays inside the band; the
              // max-widths are only a guard for very tall, narrow viewports,
              // where the band would otherwise imply a lockup wider than the act.
              className="block h-full max-h-full w-auto max-w-[76vw] object-contain select-none md:max-w-[40rem]"
              draggable={false}
            />
          ) : null}
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
            {/* The act's heading, drawn rather than set: the brand's wordmark
                above carries the name, so this exists for the document outline
                and the section-heading census only. Same device, and the same
                reason, as the sr-only h2 in CinematicTitiLinks. */}
            <h2 data-qa="section-heading" translate="no" className="notranslate sr-only">
              {t("cinematic.gwSeq.title")}
            </h2>
            {/* The credential, beneath the lockup rather than above the name it
                used to introduce. Same gold Label styling it has always had —
                it changed position and job, not voice. */}
            <p
              data-qa="gw-seq-eyebrow"
              className="text-[11px] font-semibold uppercase tracking-[0.24em]"
              style={{ color: GOLD }}
            >
              {t("cinematic.gwSeq.eyebrow")}
            </p>
            <p
              data-qa="gw-seq-body"
              className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/70 md:text-base"
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

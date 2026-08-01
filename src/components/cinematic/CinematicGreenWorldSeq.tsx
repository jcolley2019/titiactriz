import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
 * ## The lockup arrives on latches, not scrubbed values
 *
 * Type whose opacity tracks progress reads as a smear. Instead the act LATCHES:
 * a threshold crossing hands the entrance to GSAP (fade + rise, power3.out).
 * Per scrub frame the work is one comparison per latch; each tween runs once
 * per crossing, in either direction, so scrolling back up puts everything away
 * again cleanly. REVIEW.3b sequenced the arrival: the body line lands first
 * (BODY_REVEAL_AT), the button follows one beat later (CTA_REVEAL_AT).
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
 * GW.COPY.5 — this act sets its type DARK on a bright plate.
 *
 * Every other act in the site is warm ivory over the dark, because every other
 * act is a photograph burning through a near-black room. The Green World plates
 * are the opposite: near-white water, bright end to end, with no dark for light
 * type to stand against. The measurement was unambiguous — over the composited
 * ground the ivory reached only 2.1:1 and the gold 1.0:1, and the only way to
 * rescue either was a veil heavy enough to kill the very brightness the plates
 * exist for.
 *
 * So the polarity flips instead. Near-black ink on bright water is the same
 * relationship the brand's own BLACK wordmark already has with this plate — the
 * act simply stops fighting it. Warm near-black rather than pure #000, for the
 * same reason the ground is #0b0a08.
 */
const INK = "#0b0a08";

/**
 * The accent, in the brand's own green rather than the site's gold. Gold is a
 * light-on-dark accent and cannot survive here at any weight; a deep green
 * carries on bright water AND ties the phrase to the mark directly above it.
 * Deliberately much darker than the logo's #12A03B, which is itself too light
 * to hold against the plate.
 */
const DEEP_GREEN = "#0B5D2A";

/**
 * REVIEW.3b — the CTA's arrival is TWO latches, sequenced.
 *
 * The reveal point has walked forward twice already: 0.999 (the final dead
 * stop — correct as an event, wrong as an invitation), then 0.4 (present for
 * the back half of the scrub). Joey's second review moved it earlier still and
 * split it: the body line LANDS FIRST, and the button follows on its heels —
 * one beat, 10% of the act's mapped progress, after the text's entrance
 * completes. Never simultaneous: the reader is given the sentence before the
 * ask.
 *
 * Both are still latches, not scrubbed values — one crossing, one tween, in
 * either direction — and the dead-stop behaviour and pointer rules are
 * untouched: the layer's hit-testing still flips at the crossing, and the
 * frames still hold at both ends.
 */
const BODY_REVEAL_AT = 0.15;
const CTA_REVEAL_AT = BODY_REVEAL_AT + 0.1;

/** Hidden resting state of the CTA, in one place so the tween and the inline style agree. */
const CTA_HIDDEN_Y = 24;
/** The body's own hidden rest — a shallower rise than the button's, it is a line of type. */
const BODY_HIDDEN_Y = 16;

/**
 * GW.LAYOUT.2 — ONE centred stack, not three independently placed layers.
 *
 * The act used to pin the lockup inside a legibility band and hang the copy off
 * the bottom of the stage. That made the gap between logo and copy a function of
 * viewport height and the gap between copy and button a separate margin, so the
 * three never related to each other. They are now flex children of a single
 * full-stage column, centre-justified, sharing ONE gap — so "same spacing
 * between them, centred vertically" is a property of the layout rather than
 * three numbers kept in sync by hand.
 *
 * The top padding is the FIXED HEADER's height. The stage is viewport-true and
 * runs underneath the header, so centring against the raw stage buried the top
 * of the mark behind the nav — measured at 34px of overlap at 1440. Padding the
 * box means the stack centres in the area the reader can actually see, which is
 * what "centred" has to mean on a surface with a fixed chrome over it.
 *
 * What this trades away: the old band kept the BLACK wordmark off the plates'
 * dark zones (the portrait pack carries one at ~32-38% of its height, and the
 * scrim reaches 0.62 alpha by 74%). Centring puts the lockup near the middle of
 * the stage instead. The wordmark still clears the scrim's onset at 42%, but if
 * it ever reads muddy on the phone pack, this is the reason — re-measure with
 * the wordmark-ground test rather than nudging the gap.
 */
const STACK = "flex flex-col items-center justify-center gap-6 md:gap-8";

/**
 * The stack's box STARTS below the fixed header rather than at the top of the
 * stage. Padding was tried first and is not equivalent: when the content is
 * taller than the padded box it overflows in both directions and the mark goes
 * back under the nav. Offsetting the box's top edge means the centre the stack
 * resolves against is the centre of what the reader can actually see, at every
 * viewport height. The values are the header's own height.
 */
const STACK_BOX = "absolute inset-x-0 bottom-0 top-28 md:top-32";

/**
 * The lockup's height as a fraction of the stage — what the old band-times-56%
 * arithmetic actually resolved to, now stated directly.
 */
const LOGO_SIZE = "h-[11%] md:h-[23%]";

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
 * Pack selection.
 *
 * GW.TABLET.1 — the pack is keyed on the STAGE'S SHAPE first, and the reel's
 * 768px class line only picks the resolution within a shape. The defect this
 * closes: a portrait tablet stage (iPad, 820x1180) used to take the landscape
 * pack and cover-crop it to its middle ~39% slice — the composition's dullest
 * region, since the landscape master keeps its ribbon motion at the frame's
 * edges. Joey, 7/31: "its missing a lot of the animation." A portrait stage
 * now gets the portrait COMPOSITION at the resolution its class earns: phones
 * the 1080 cut, larger portrait stages the 1600 tablet cut (GW.TABLET.1b —
 * same master, same 72-frame treatment, q72 like the landscape pack). A
 * landscape stage keeps gw-land-1920 at every width.
 *
 * Both keys are read SYNCHRONOUSLY on first render (the orientation hook
 * below mirrors `useReelIsPhone`): swapping packs after mount throws away a
 * warm decode cache, so it happens only when the stage itself changes shape —
 * a rotation — where the reflow already restarts the act's world anyway.
 */
function packFor(isPhone: boolean, portraitStage: boolean): FrameSequence {
  const id = !portraitStage ? "gw-land-1920" : isPhone ? "gw-port-1080" : "gw-port-1600";
  const pack = SEQ_PACKS.find((p) => p.id === id);
  if (!pack) throw new Error(`SEQ.2: pack ${id} is missing from the census`);
  return pack;
}

/**
 * GW.TABLET.1 — is the stage portrait? Same synchronous-first-read shape as
 * `useReelIsPhone`, tracked live so a rotated tablet swaps to the composition
 * that fits its new frame.
 */
function useStagePortrait(): boolean {
  const [portrait, setPortrait] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(orientation: portrait)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    setPortrait(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPortrait(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return portrait;
}

type Props = { reduced: boolean };

const CinematicGreenWorldSeq = ({ reduced }: Props) => {
  const { t } = useTranslation();
  const isPhone = useReelIsPhone();
  const portraitStage = useStagePortrait();
  const sequence = useMemo(() => packFor(isPhone, portraitStage), [isPhone, portraitStage]);

  // The entrance is animated on a WRAPPER, never on the link itself: GSAP owns
  // the wrapper's inline `transform`, and the link keeps its own hover lift —
  // an inline transform on the anchor would beat the hover utility and quietly
  // kill it.
  const ctaLayerRef = useRef<HTMLDivElement>(null);
  const ctaLinkRef = useRef<HTMLAnchorElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  // The latches. Refs, not state: these are compared on every scrub frame.
  const ctaShownRef = useRef(reduced);
  const bodyShownRef = useRef(reduced);

  const handleProgress = useCallback((mapped: number) => {
    // REVIEW.3b latch #1 — the body line. Same one-comparison-per-frame shape
    // as the button below; it just crosses one beat earlier. The body is
    // inside a pointer-transparent stack and is not a tab stop, so unlike the
    // button it has no hit-testing or tab-order to flip.
    const body = bodyRef.current;
    if (body) {
      const wantBody = mapped >= BODY_REVEAL_AT;
      if (wantBody !== bodyShownRef.current) {
        bodyShownRef.current = wantBody;
        gsap.killTweensOf(body);
        body.setAttribute("data-gw-body-state", wantBody ? "shown" : "hidden");
        gsap.to(body, {
          opacity: wantBody ? 1 : 0,
          y: wantBody ? 0 : BODY_HIDDEN_Y,
          duration: wantBody ? 0.55 : 0.3,
          ease: wantBody ? "power3.out" : "power2.in",
        });
      }
    }

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
        {/* 1 — SCRIM. Bottom-weighted only; the plate keeps its top two-thirds. */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          aria-hidden
          style={{
            // GW.VEIL.2 — the veil got OUT OF THE WAY. Once the type went dark
            // (GW.COPY.5) the veil stopped being what buys legibility and went
            // back to being what it is supposed to be: the handoff to the next
            // act. It is now fully clear through the entire stack — logo, copy
            // and button all sit on unveiled water — and only takes hold in the
            // last eighth of the stage. Darkening any earlier both dulls the
            // plate and actively HURTS the dark type now sitting on it.
            background: `linear-gradient(180deg, rgba(11,10,8,0) 76%, rgba(11,10,8,0.45) 93%, rgba(11,10,8,0.88) 100%)`,
          }}
        />

        {/* 2 — THE STACK. Logo, copy and button as three flex children of one
            centred column, so the spacing between them is a single gap and the
            group's centre is the stage's centre. The block is pointer-
            transparent — the CTA layer is the ONLY thing in this act that takes
            a pointer, and it takes one only once it has arrived. Without this,
            the type wrapper is a full-width invisible target sitting over the
            button's own neighbourhood. */}
        <div className={`pointer-events-none z-30 px-6 text-center ${STACK_BOX} ${STACK}`}>
          {/* LOGO. Wired but empty while GW_LOGO_READY is false: the slot keeps
              its spec hooks whether or not there is an asset, and `data-gw-logo`
              states plainly which of the two it is. Decorative — the name it
              draws is announced once by the sr-only heading, so alt is empty
              rather than doubling it. */}
          <div
            data-qa="gw-seq-logo"
            data-gw-logo={GW_LOGO_READY && GW_LOGO_SRC ? "on" : "off"}
            aria-hidden
            className={`flex w-full shrink-0 items-center justify-center ${LOGO_SIZE}`}
          >
            {GW_LOGO_READY && GW_LOGO_SRC ? (
              <img
                src={GW_LOGO_SRC}
                alt=""
                data-qa="gw-seq-logo-img"
                // Height-bound with width following, so the lockup's proportions
                // never depend on the viewport's. The max-widths are only a guard
                // for very tall, narrow viewports.
                className="block h-full w-auto max-w-[76vw] object-contain select-none md:max-w-[40rem]"
                draggable={false}
              />
            ) : null}
          </div>

          {/* The act's heading, drawn rather than set: the brand's wordmark
              above carries the name, so this exists for the document outline
              and the section-heading census only. Same device, and the same
              reason, as the sr-only h2 in CinematicTitiLinks. */}
          <h2 data-qa="section-heading" translate="no" className="notranslate sr-only">
            {t("cinematic.gwSeq.title")}
          </h2>
          {/* GW.COPY.1 — the gold "official distributor" credential is gone.
              The lockup now goes straight from the drawn wordmark to the one
              Body line; nothing stands between the name and the offer. */}
          <p
            ref={bodyRef}
            data-qa="gw-seq-body"
            data-gw-body-state={reduced ? "shown" : "hidden"}
            // GW.COPY.2 — set in the DISPLAY face, not the Body ramp.
            //
            // Three treatments were built and looked at in the running act: the
            // corrected veil with ivory sans, this, and an outlined ivory with a
            // green accent. The sans read as a caption under the mark; the
            // outline read crisp but is a trick, and its green accent would have
            // been a second filament (DESIGN.md's One Filament Rule). Cinzel is
            // already the voice of the hero and the act titles, so at this size
            // the line belongs to the same film instead of annotating it — and
            // the larger, thinner letterforms are what let the gold accent
            // survive over bright water at all.
            //
            // Legibility comes from the veil beneath and the type's own weight.
            // No plate, no outline, no shadow: the Unboxed Type Rule.
            className="max-w-xl text-xl leading-snug tracking-[0.01em] md:text-[34px]"
            style={{
              color: INK,
              fontFamily: "var(--font-display)",
              // Painted straight into the inline style so the line cannot
              // flash before GSAP's first write — the same device as the CTA
              // layer below. Reduced motion starts, and stays, landed.
              opacity: reduced ? 1 : 0,
              transform: reduced ? undefined : `translateY(${BODY_HIDDEN_Y}px)`,
            }}
          >
              {/* GW.COPY.3 — ONE accent, on the provenance clause. The line is
                  split in the locale files rather than marked up in a single
                  string so Spanish can put the accent on its own words ("directo
                  de la fuente") instead of on whatever falls at the same offset.
                  The <em> keeps the emphasis semantic; gold is the site accent,
                  spent here and on the button and nowhere else in the act. */}
              {t("cinematic.gwSeq.bodyPre")}
              <em data-qa="gw-seq-body-accent" style={{ color: DEEP_GREEN, fontWeight: 700 }}>
                {t("cinematic.gwSeq.bodyAccent")}
              </em>
              {t("cinematic.gwSeq.bodyPost")}
            </p>

            <div
              ref={ctaLayerRef}
              data-qa="gw-seq-cta-layer"
              data-gw-cta-state={reduced ? "shown" : "hidden"}
              aria-hidden={reduced ? undefined : true}
              className="flex justify-center"
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
      </SeqAct>
    </div>
  );
};

export default CinematicGreenWorldSeq;

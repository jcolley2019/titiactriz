import { Suspense, lazy, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEventsBoard, type EventItem } from "@/hooks/useEventsBoard";
import {
  EVENTS_ACT_ENABLED,
  EVENTS_ACT_ROOM,
  eventsRoomPreview,
  type EventsRoom,
} from "@/lib/ventures";
import { CHAPTER_GROUND_1 } from "./FramedVideo";

/**
 * The card grammar is loaded ONLY when the act lights. A dark act must cost the
 * home page nothing — the Socials act already measured what happens otherwise
 * (its static import alone spent the TA.7d first-paint budget), and in dev the
 * extra modules shift every async timing on the page, which is exactly the kind
 * of drift the neighbor specs' scroll aims are sensitive to.
 */
const EventCard = lazy(() => import("@/components/events/EventCard"));

gsap.registerPlugin(ScrollTrigger);

const GOLD = "#C9A55C";
const CREAM = "#f0e9da";

/**
 * EVENTS.2 — the Events act, BELOW THE HERO and above act 01 (the reel).
 *
 * Owner ruling (supersedes the EVENTS.1 slot-5 placement), verbatim: "add it to
 * the scrolling scren so that its visible when users scroll through it appears
 * below the hero but above the 01 section."
 *
 * ## The rooms
 *
 * The EventCard grammar is RATIFIED (gold frame, corner ornaments, PORTRAIT.1
 * portrait art shown whole) — what EVENTS.2 builds is the ROOM the cards stand
 * in. Three committed candidates, differing on entrance, framing/ornament, and
 * rhythm against the hero above and the reel below:
 *
 *   A "Proscenio" — a hairline gold proscenium frames the whole stage. Formal
 *     and centered: it answers the hero's centered lockup, and the frame
 *     settles into place as the lines rise (the Book act's entrance grammar).
 *   B "Cartelera" — an editorial playbill. The header band anchors top-left
 *     with a rule drawn across the stage; the cards ride below it. Asymmetric
 *     on purpose — a poster wall, not a ceremony — so the reel's numbered
 *     chapters arrive as the return of order.
 *   C "Función"   — a spotlight. A quiet radial glow pools behind the card,
 *     the eyebrow is a bordered pill, and the card blooms up into the beam.
 *     The most theatrical of the three; the room is dark, the event is lit.
 *
 * The winner is recorded in EVENTS_ACT_ROOM (ventures.ts). In DEV,
 * `/cinematic?events=A|B|C` previews a room — it forces the act lit with the
 * live board so the candidate can be judged in the real flow, and EventsBanner
 * reads the same signal to preview its home-suppression (the true post-flip
 * state). Production builds ignore the query entirely.
 *
 * ## The dwell (EVENTS.2, step 3)
 *
 * The act joins the uniform DWELL LAW as a story act: the stage pins
 * (`start: "top top"`, `end: "+=120%"`) and holds the frame for 120% of a
 * viewport before releasing — the same one number every story act on this page
 * pays. The pin is created only when the act is LIT, which is after the board
 * fetch resolves — i.e. after every act below has already measured — so the
 * trigger list is `ScrollTrigger.sort()`ed into document order and refreshed,
 * the same repair CinematicReel, CinematicActing and CinematicSocials carry
 * (an unsorted late pin stales every trigger under it by its own pin distance).
 * Reduced motion builds neither timeline nor pin: the act renders static,
 * settled, unpinned.
 *
 * ## The late-mount law (unchanged from EVENTS.1)
 *
 * The section is in the DOM at EVERY paint — flag off, still loading, zero
 * cards. It empties rather than returning null: GSAP pins by WRAPPING an
 * element in a `pin-spacer` div, so a section that arrives late is inserted
 * against a DOM React no longer recognises — `NotFoundError: insertBefore`,
 * measured on the first build of the Socials act. DOM order must never depend
 * on what this act knows yet, and flipping EVENTS_ACT_ENABLED can never move
 * another act.
 *
 * ## Honest emptiness (unchanged)
 *
 * Lit with zero cards, the act paints NOTHING — no room, no header, no height.
 * The flag opens the door; the live `events_board` row decides whether anyone
 * walks through it.
 *
 * The act is deliberately UNNUMBERED — a window, not a chapter. Spine 04 stays
 * reserved for Acting.
 */

/** The ratified card grammar, staged: full cards span, halves pair at md+. */
const CardField = ({ cards, wide = true }: { cards: EventItem[]; wide?: boolean }) => (
  <div
    data-qa="events-cards"
    className={`grid w-full grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 ${wide ? "max-w-4xl" : "max-w-3xl"}`}
  >
    {cards.map((item) => (
      <div
        key={item.id}
        data-events-line
        className={item.size === "full" ? "md:col-span-2" : "md:col-span-1"}
      >
        <EventCard item={item} />
      </div>
    ))}
  </div>
);

type RoomProps = { cards: EventItem[]; title: string; intro: string };

/** Room A — "Proscenio": hairline gold frame, centered ceremony. */
const RoomProscenio = ({ cards, title, intro }: RoomProps) => (
  <div className="relative flex w-full max-w-5xl flex-col items-center">
    {/* The proscenium: one hairline, outside the content's own room. It is a
        rule, not a fill — the same single-gold-line device the Book act used.
        Phone-only cut: Joey's device evidence showed the frame's own inset
        clipped top and bottom once the card claimed the reclaimed vertical
        room, so the frame is a tablet+ device — the ceremony, not the phone's
        tight fit. */}
    <div
      aria-hidden
      data-events-frame
      className="pointer-events-none absolute -inset-x-4 -inset-y-6 hidden md:-inset-x-10 md:-inset-y-10 md:block"
      style={{ border: `1px solid rgba(201, 165, 92, 0.45)` }}
    />
    <h2
      data-qa="events-heading"
      data-events-line
      className="text-caps text-center"
      style={{
        // DESIGN.md's Headline ramp — the same act-title size every other act
        // (Book, About) sets its heading in. Room A's eyebrow-sized text-caps
        // font-size is overridden here; the class still supplies uppercase.
        fontFamily: "var(--font-display)",
        color: GOLD,
        letterSpacing: "0.35em",
        // WebKit/Safari counts the tracking trailing the last glyph toward the
        // centered box, so the visible word sits left of true center — cancel
        // it with a matching negative margin (Joey's device evidence).
        marginRight: "-0.35em",
        fontSize: "clamp(1.75rem, 4vw, 3.25rem)",
        lineHeight: 1.15,
      }}
    >
      {title}
    </h2>
    <span aria-hidden data-events-line className="mt-3 block h-px w-16 md:mt-5" style={{ backgroundColor: GOLD }} />
    {/* Phone-only cut: Joey's device evidence showed this line and its gap
        eating room the card needed more. Tablet+ keeps it. */}
    <p
      data-events-line
      className="mt-3 hidden max-w-md text-center text-sm leading-relaxed md:mt-5 md:block"
      style={{ color: "rgba(240,233,218,0.6)", fontFamily: "var(--font-sans)", fontWeight: 300 }}
    >
      {intro}
    </p>
    <div className="mt-6 flex w-full justify-center md:mt-10">
      <CardField cards={cards} wide={false} />
    </div>
  </div>
);

/** Room B — "Cartelera": left-anchored playbill band, rule across the stage. */
const RoomCartelera = ({ cards, title, intro }: RoomProps) => (
  <div className="flex w-full max-w-5xl flex-col">
    <div className="flex w-full items-baseline gap-6">
      <h2
        data-qa="events-heading"
        data-events-band
        className="shrink-0 uppercase"
        style={{
          fontFamily: "var(--font-display)",
          color: CREAM,
          fontSize: "clamp(1.25rem, 2.6vw, 2rem)",
          letterSpacing: "0.18em",
        }}
      >
        {title}
      </h2>
      {/* The rule is drawn from the title's edge to the stage's — the playbill
          margin. It scales in from the left on entrance. */}
      <span
        aria-hidden
        data-events-rule
        className="block h-px min-w-0 flex-1"
        style={{ backgroundColor: "rgba(201,165,92,0.6)", transformOrigin: "left center" }}
      />
    </div>
    <p
      data-events-band
      className="mt-3 max-w-md text-sm leading-relaxed"
      style={{ color: "rgba(240,233,218,0.6)", fontFamily: "var(--font-sans)", fontWeight: 300 }}
    >
      {intro}
    </p>
    <div className="mt-10 flex w-full justify-start">
      <CardField cards={cards} />
    </div>
  </div>
);

/** Room C — "Función": pill eyebrow, radial spotlight pooled behind the card. */
const RoomFuncion = ({ cards, title, intro }: RoomProps) => (
  <div className="relative flex w-full max-w-5xl flex-col items-center">
    {/* The beam: one soft radial pool, gold at very low alpha, behind the
        cards only. Painted, never animated by scroll — the entrance fades it
        up once and the dwell holds it still. */}
    <div
      aria-hidden
      data-events-glow
      className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2"
      style={{
        background: "radial-gradient(ellipse 55% 45% at 50% 55%, rgba(201,165,92,0.14), transparent 70%)",
      }}
    />
    <p
      data-qa="events-heading"
      data-events-line
      className="text-caps border px-5 py-2"
      style={{
        fontFamily: "var(--font-sans)",
        color: GOLD,
        borderColor: "rgba(201,165,92,0.5)",
        letterSpacing: "0.3em",
      }}
    >
      {title}
    </p>
    <div data-events-bloom className="relative mt-10 flex w-full justify-center">
      <CardField cards={cards} wide={false} />
    </div>
    <p
      data-events-line
      className="mt-8 max-w-md text-center text-xs leading-relaxed"
      style={{ color: "rgba(240,233,218,0.45)", fontFamily: "var(--font-sans)", fontWeight: 300 }}
    >
      {intro}
    </p>
  </div>
);

const ROOMS: Record<EventsRoom, (p: RoomProps) => JSX.Element> = {
  A: RoomProscenio,
  B: RoomCartelera,
  C: RoomFuncion,
};

/**
 * Fires once the lazy card grammar has RESOLVED AND MOUNTED — it renders inside
 * the same Suspense boundary as the cards, so its layout effect cannot run
 * before theirs exist in the DOM. The GSAP work below keys off this signal:
 * without it, an effect racing the lazy chunk would find an empty stage,
 * declare the art settled, and freeze the pin at the wrong height.
 */
const MountSignal = ({ onMount }: { onMount: (v: boolean) => void }) => {
  useLayoutEffect(() => {
    onMount(true);
    return () => onMount(false);
  }, [onMount]);
  return null;
};

const CinematicEvents = ({ reduced }: { reduced: boolean }) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { board, loading } = useEventsBoard();

  // Read once per mount: the preview is a page-load decision, like the flag it
  // stands in for, so mid-session query edits cannot half-rebuild the act.
  const preview = useMemo(
    () => eventsRoomPreview(typeof window === "undefined" ? "" : window.location.search),
    [],
  );
  const room: EventsRoom = preview ?? EVENTS_ACT_ROOM;

  const cards = board.items;
  // EVENTS.2b — the render gate, all three doors: the engineering flag, the
  // owner's ONE home-surface switch (board.homeVisible, set in the Events
  // admin — never a per-layout control), and at least one enabled card. The
  // DEV preview stands in for the FLAG ONLY: the board conditions stay real,
  // so previewing a room shows exactly what the flip will show — an owner who
  // has not turned the home surface on previews a dark act, honestly.
  const lit =
    (EVENTS_ACT_ENABLED || preview !== null) &&
    board.homeVisible &&
    !loading &&
    cards.length > 0;

  // The stage's true height is not known until the card art has decoded: a
  // portrait poster adds hundreds of px AFTER first paint. GSAP's pin FREEZES
  // the pinned element's box at creation time, so a pin built against the
  // pre-poster layout dwells on a frame the content then overflows — measured
  // at 1280×800 in the EVENTS.2 evidence run, where the overflow centered
  // itself right out of the top of the stage and clipped the act heading. So
  // the timeline and pin wait for the art.
  const [cardsMounted, setCardsMounted] = useState(false);
  const [artReady, setArtReady] = useState(false);
  useLayoutEffect(() => {
    if (!lit || !cardsMounted) {
      setArtReady(false);
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;

    // EVENTS.VIDEO.1 — a card's medium can now be a VIDEO, and a video is worse
    // than a late image: before its metadata arrives it reports a 300x150
    // intrinsic box, so a pin built against it freezes the stage at a height the
    // real clip immediately overflows. The same decode-wait therefore covers
    // both element kinds — an image settles on `complete`, a video on
    // HAVE_METADATA (readyState >= 1), which is the first moment its true shape
    // exists. Events, not polling: `loadedmetadata` for the good path, `error`
    // so a medium that never arrives cannot hold the act unpinned forever.
    const images = Array.from(stage.querySelectorAll("img")).filter((img) => !img.complete);
    const videos = Array.from(stage.querySelectorAll("video")).filter((v) => v.readyState < 1);
    const pending: { el: HTMLElement; events: string[] }[] = [
      ...images.map((el) => ({ el: el as HTMLElement, events: ["load", "error"] })),
      ...videos.map((el) => ({ el: el as HTMLElement, events: ["loadedmetadata", "error"] })),
    ];

    if (pending.length === 0) {
      setArtReady(true);
      return;
    }
    let done = 0;
    const settled = new WeakSet<HTMLElement>();
    const onSettle = (e: Event) => {
      const el = e.currentTarget as HTMLElement;
      // One vote per element: a video that fires loadedmetadata AND error must
      // not count twice and release the pin before its neighbours are ready.
      if (settled.has(el)) return;
      settled.add(el);
      done += 1;
      if (done === pending.length) setArtReady(true);
    };
    pending.forEach(({ el, events }) =>
      events.forEach((ev) => el.addEventListener(ev, onSettle)),
    );
    return () => {
      pending.forEach(({ el, events }) =>
        events.forEach((ev) => el.removeEventListener(ev, onSettle)),
      );
    };
  }, [lit, cardsMounted, cards.length]);

  useLayoutEffect(() => {
    if (reduced || !lit || !cardsMounted || !artReady) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    const ctx = gsap.context(() => {
      const q = (sel: string) => Array.from(section.querySelectorAll<HTMLElement>(sel));

      // The entrance, scrubbed over the act's arrival and complete at `top
      // 22%` — before the pin engages at `top top` — so the hold always begins
      // on a settled frame (the Book act's contract).
      const tl = gsap.timeline({
        scrollTrigger: { trigger: section, start: "top 78%", end: "top 22%", scrub: true },
      });

      if (room === "A") {
        // Proscenio: the frame settles from a breath wider as the lines rise.
        q("[data-events-frame]").forEach((el) =>
          tl.fromTo(el, { opacity: 0, scale: 1.02 }, { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out" }, 0),
        );
        q("[data-events-line]").forEach((el, i) =>
          tl.fromTo(el, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.38, ease: "power3.out" }, i * 0.12),
        );
      } else if (room === "B") {
        // Cartelera: the band arrives from the left margin, the rule is drawn
        // across the stage, then the cards ride up under it.
        q("[data-events-band]").forEach((el, i) =>
          tl.fromTo(el, { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, i * 0.1),
        );
        q("[data-events-rule]").forEach((el) =>
          tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: "power3.out" }, 0.1),
        );
        q("[data-events-line]").forEach((el, i) =>
          tl.fromTo(el, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, 0.2 + i * 0.1),
        );
      } else {
        // Función: the beam fades up first, then the card blooms into it.
        q("[data-events-glow]").forEach((el) =>
          tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0),
        );
        q("[data-events-line]").forEach((el, i) =>
          tl.fromTo(el, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, 0.08 + i * 0.1),
        );
        q("[data-events-bloom]").forEach((el) =>
          tl.fromTo(el, { scale: 0.965, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.16),
        );
      }

      // The uniform dwell law: the story acts' one price, +=120%, no local
      // number. Pinning fixes the stage's place and nothing else, so the
      // card's buttons stay clickable through the whole hold.
      ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        end: "+=120%",
        pin: true,
        anticipatePin: 1,
      });
    }, section);

    // The board resolves AFTER first paint, so this pin is born above triggers
    // that have already measured — sort into document order, then refresh, or
    // every act below is staled by this pin's own distance.
    ScrollTrigger.sort();
    ScrollTrigger.refresh();

    return () => ctx.revert();
  }, [reduced, lit, cardsMounted, artReady, room, cards.length]);

  if (!lit) {
    return <section ref={sectionRef} data-qa="cinematic-events" data-empty="true" aria-hidden />;
  }

  const Room = ROOMS[room];

  return (
    <section
      ref={sectionRef}
      data-qa="cinematic-events"
      data-room={room}
      data-preview={preview ? "true" : undefined}
      className="relative w-full"
    >
      <div
        ref={stageRef}
        data-qa="events-stage"
        data-cards={cards.length}
        className="cine-act-vh relative flex w-full flex-col items-center justify-center overflow-hidden px-6 pb-10 pt-[70px] md:pb-16 md:pt-24"
        // `safe center` is overflow insurance on top of the artReady gating
        // above: if the stage is ever shorter than its content again, the
        // overflow clips at the BOTTOM instead of centering the heading out of
        // the top of the frame. Browsers without `safe` keep plain `center`
        // from the class.
        style={{ backgroundColor: CHAPTER_GROUND_1, justifyContent: "safe center" }}
      >
        {/* fallback null: while the chunk loads the stage is an empty ground,
            which is the same thing the dark act paints — never a spinner. */}
        <Suspense fallback={null}>
          <Room cards={cards} title={t("events.title")} intro={t("events.intro")} />
          <MountSignal onMount={setCardsMounted} />
        </Suspense>
      </div>
    </section>
  );
};

export default CinematicEvents;

import { useEffect, useRef } from "react";

/**
 * MOBILE.EDGE.2-DIAG — THE FAILING DEVICE REPORTS ITS OWN NUMBERS.
 *
 * The hero act is `min-height: 100lvh`. On paper that is the viewport with
 * Safari's chrome RETRACTED — the full physical screen — so it cannot end above
 * the bottom of what the reader can see, and the act after it cannot be on
 * screen at scrollY 0. Joey's iPhone shows Reel 1's sunset under the hero at
 * landing anyway.
 *
 * A headless Chromium cannot arbitrate this: `lvh`, `svh` and `dvh` all resolve
 * to the same number there and there are no safe-area insets to report, so every
 * measurement agrees with the theory and the theory is wrong. Two fixes have now
 * been argued from that theory and neither landed. This component argues nothing.
 * It puts the numbers the phone actually computes on the phone's own screen.
 *
 * DEV ONLY — mounted behind `import.meta.env.DEV` at its single call site
 * (HomeCinematic), so it is tree-shaken out of a production build entirely. It
 * takes no pointer events and paints nothing but its own box and one line.
 *
 * ## What it does that a console.log cannot
 *
 * The interesting moment is the one where Safari's chrome collapses, which is
 * also the moment a reader is touching the screen and cannot be reading a
 * console. So the readout is LIVE: a requestAnimationFrame loop writes straight
 * to the DOM (never through React state — a re-render per frame would be a
 * second bug on top of the one being diagnosed) and the magenta rule tracks the
 * hero's own bottom edge, so the gap can be SEEN as well as read.
 *
 * ## Reading it
 *
 * The two derived rows are the diagnosis; everything above them is evidence.
 *
 *   SHORT = innerH − hero.bottom. At scrollY 0 this is how many px of visible
 *           viewport the hero fails to cover. Zero or negative is correct
 *           (negative means the hero deliberately overflows behind the chrome).
 *           POSITIVE IS THE BUG, and its value is the height of the strip the
 *           next act is showing through.
 *   GAP   = next.top − hero.bottom. Non-zero means the two acts are not flush —
 *           a different defect from SHORT, and one that would point at a margin
 *           or a pin-spacer rather than at a viewport unit.
 */

/** Rows are `label` + a value written imperatively into a `<span>`. */
const ROWS = [
  "innerH",
  "visualVP",
  "vv offset",
  "100lvh",
  "100svh",
  "100dvh",
  "safe top",
  "safe bot",
  "scrollY",
  "hero top",
  "hero bot",
  "hero h",
  "next top",
  "SHORT",
  "GAP",
] as const;

type Row = (typeof ROWS)[number];

/**
 * The unit probes. `visibility: hidden` still LAYS OUT (unlike `display: none`),
 * which is the whole point — each box is measured, never painted. They are
 * `fixed` so a `100lvh` probe cannot lengthen the document it is measuring.
 */
const PROBES: { key: string; css: string }[] = [
  { key: "lvh", css: "100lvh" },
  { key: "svh", css: "100svh" },
  { key: "dvh", css: "100dvh" },
  { key: "sat", css: "env(safe-area-inset-top, 0px)" },
  { key: "sab", css: "env(safe-area-inset-bottom, 0px)" },
];

const ViewportHud = () => {
  const boxRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const probesRef = useRef<Record<string, HTMLDivElement | null>>({});
  const cellsRef = useRef<Partial<Record<Row, HTMLSpanElement>>>({});

  useEffect(() => {
    let raf = 0;

    const px = (el: HTMLElement | null | undefined) =>
      el ? Math.round(el.getBoundingClientRect().height) : -1;

    const write = (row: Row, value: number | string, warn = false) => {
      const cell = cellsRef.current[row];
      if (!cell) return;
      const text = String(value);
      if (cell.textContent !== text) cell.textContent = text;
      const color = warn ? "#ff4d6d" : "#7CFFB2";
      if (cell.style.color !== color) cell.style.color = color;
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);

      const hero = document.querySelector('[data-qa="cinematic-section"]');
      const heroRect = hero?.getBoundingClientRect();

      // The act that follows the hero in document order, whatever it is — named
      // by position rather than by hook so a re-ordered page still reports.
      let next: Element | null = hero?.nextElementSibling ?? null;
      while (next && next.getBoundingClientRect().height === 0) next = next.nextElementSibling;
      const nextRect = next?.getBoundingClientRect();

      const vv = window.visualViewport;
      const innerH = window.innerHeight;

      write("innerH", innerH);
      write("visualVP", vv ? Math.round(vv.height) : "n/a");
      write("vv offset", vv ? Math.round(vv.offsetTop) : "n/a");
      write("100lvh", px(probesRef.current.lvh));
      write("100svh", px(probesRef.current.svh));
      write("100dvh", px(probesRef.current.dvh));
      write("safe top", px(probesRef.current.sat));
      write("safe bot", px(probesRef.current.sab));
      write("scrollY", Math.round(window.scrollY));

      if (heroRect) {
        const bottom = Math.round(heroRect.bottom);
        write("hero top", Math.round(heroRect.top));
        write("hero bot", bottom);
        write("hero h", Math.round(heroRect.height));

        // SHORT — the diagnosis. Positive means the hero stops above the bottom
        // of the visible viewport, and that many px of something else is on
        // screen under it.
        const short = Math.round(innerH - heroRect.bottom);
        write("SHORT", short, short > 0);

        // The magenta rule sits ON the hero's bottom edge, in viewport
        // coordinates — its LOWER edge flush with the hero's, so that the
        // correct case (hero bottom exactly at the fold) still paints two
        // visible rows instead of falling off the screen. Hidden rather than
        // left stale when the edge is out of view.
        const line = lineRef.current;
        if (line) {
          const visible = bottom >= 0 && bottom <= innerH + 2;
          line.style.top = `${bottom - 2}px`;
          line.style.opacity = visible ? "1" : "0";
        }
      }

      if (heroRect && nextRect) {
        write("next top", Math.round(nextRect.top));
        const gap = Math.round(nextRect.top - heroRect.bottom);
        write("GAP", gap, gap !== 0);
      } else {
        write("next top", "n/a");
        write("GAP", "n/a");
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {/* Probes — laid out, measured, never painted. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 1,
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        {PROBES.map((p) => (
          <div
            key={p.key}
            ref={(el) => {
              probesRef.current[p.key] = el;
            }}
            style={{ height: p.css, width: 1 }}
          />
        ))}
      </div>

      {/* The hero's bottom edge, drawn where the phone says it is. */}
      <div
        ref={lineRef}
        aria-hidden
        data-qa="hud-hero-edge"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          top: 0,
          height: 2,
          backgroundColor: "#ff00ff",
          pointerEvents: "none",
          zIndex: 2147483000,
          opacity: 0,
        }}
      />

      <div
        ref={boxRef}
        aria-hidden
        data-qa="viewport-hud"
        style={{
          position: "fixed",
          top: "calc(4px + env(safe-area-inset-top, 0px))",
          left: 4,
          zIndex: 2147483000,
          pointerEvents: "none",
          backgroundColor: "rgba(0,0,0,0.82)",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: 4,
          padding: "5px 7px",
          font: "500 10px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          color: "#7CFFB2",
          letterSpacing: "0.02em",
          whiteSpace: "pre",
        }}
      >
        {ROWS.map((row) => (
          <div key={row} style={{ display: "flex", gap: 6 }}>
            <span style={{ color: "rgba(255,255,255,0.55)", width: 62, display: "inline-block" }}>
              {row}
            </span>
            <span
              ref={(el) => {
                if (el) cellsRef.current[row] = el;
              }}
              style={{ minWidth: 42, textAlign: "right", display: "inline-block" }}
            >
              –
            </span>
          </div>
        ))}
      </div>
    </>
  );
};

export default ViewportHud;

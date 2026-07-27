import { useCallback, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";

import SeqAct from "@/components/cinematic/seq/SeqAct";
import { SEQ_PACKS } from "@/components/cinematic/seq/sequences";
import type { SeqScrubStatus } from "@/components/cinematic/seq/FrameScrubber";
import { useReducedMotion } from "@/components/cinematic/useReducedMotion";
// SeqAct's stage is `.cine-h-full` — the same pinned-stage class the reel act
// uses, and the same svh law. It is defined in cinematic.css, which the
// cinematic page imports for exactly this reason; without it the stage has no
// height and the canvas has nothing to paint into.
import "@/components/cinematic/cinematic.css";

/**
 * SEQ.1 — frame-scrub lab. DEV/QA ONLY.
 *
 * Mounts one pinned `SeqAct` per pack in the census and lets them be judged by
 * REAL page scroll, at a real viewport, on a real device. Nothing here fakes
 * the playhead: there is no slider, because the thing under judgement is
 * whether scroll-as-playhead feels right, and a slider cannot answer that.
 *
 * The route is registered only under `import.meta.env.DEV`, is absent from the
 * nav and from public/sitemap.xml, and carries an explicit noindex — it cannot
 * reach production. It lives under `src/components/qa/` for the same reason the
 * reel bake-off does: "no QA code outside src/components/qa/" stays a checkable
 * invariant rather than a convention.
 *
 * Deliberately NOT wired to Lenis. The shipped page smooths scroll before
 * ScrollTrigger sees it; judging the engine on native scroll first means any
 * roughness observed here belongs to the engine and not to the smoothing.
 *
 * The HUD publishes each act's state as data attributes as well as text, so
 * `e2e/seq-lab.spec.ts` asserts numbers rather than parsing a sentence.
 */

const NEAR_BLACK = "#0b0a08";

const cinematicFontVars: React.CSSProperties = {
  ["--font-display" as string]: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  ["--font-sans" as string]: "'Jost', 'Outfit', system-ui, sans-serif",
};

const SeqLabPage = () => {
  const reduced = useReducedMotion();
  const [statuses, setStatuses] = useState<Record<string, SeqScrubStatus>>({});

  const onStatus = useMemo(() => {
    const handlers: Record<string, (s: SeqScrubStatus) => void> = {};
    for (const pack of SEQ_PACKS) {
      handlers[pack.id] = (s) => setStatuses((prev) => ({ ...prev, [pack.id]: s }));
    }
    return handlers;
  }, []);

  const hudRow = useCallback(
    (id: string, label: string, total: number) => {
      const s = statuses[id];
      return (
        <div
          key={id}
          data-qa={`seq-hud-${id}`}
          data-seq-index={s ? s.index : -1}
          data-seq-total={total}
          data-seq-loaded={s ? s.loaded : 0}
          data-seq-cached={s ? s.cached : 0}
          style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between", whiteSpace: "nowrap" }}
        >
          <span style={{ opacity: 0.65 }}>{id}</span>
          <span>
            {s ? s.index + 1 : "—"}/{total} · ld {s ? s.loaded : 0} · cx {s ? s.cached : 0}
          </span>
        </div>
      );
    },
    [statuses],
  );

  return (
    <div style={{ ...cinematicFontVars, backgroundColor: NEAR_BLACK, color: "#f5f1e8" }} data-qa="seq-lab">
      <Helmet>
        <title>SEQ lab — QA</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <header style={{ padding: "4rem 1.5rem 2rem", maxWidth: "48rem", margin: "0 auto" }}>
        <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", opacity: 0.6 }}>
          SEQ.1
        </p>
        <h1
          data-qa="seq-lab-heading"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.75rem, 4vw, 2.75rem)", marginTop: "0.75rem" }}
        >
          Frame-scrub lab
        </h1>
        <p style={{ marginTop: "1rem", lineHeight: 1.6, opacity: 0.75, fontSize: "0.95rem" }}>
          {SEQ_PACKS.length} packs, each pinned for 300% of viewport height. Scroll is the playhead. Both ends
          dead-stop before the pin releases.
          {reduced ? " Reduced motion is ON — every act is parked on its first frame." : ""}
        </p>
      </header>

      {SEQ_PACKS.map((pack) => (
        <SeqAct key={pack.id} sequence={pack} reduced={reduced} onStatus={onStatus[pack.id]}>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 p-6"
            style={{
              background: "linear-gradient(180deg, rgba(11,10,8,0) 0%, rgba(11,10,8,0.75) 100%)",
            }}
          >
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>{pack.label}</p>
            <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
              {pack.count} frames · {pack.width}×{pack.height}
            </p>
          </div>
        </SeqAct>
      ))}

      <footer style={{ padding: "6rem 1.5rem", textAlign: "center", opacity: 0.5, fontSize: "0.8rem" }}>
        end of lab
      </footer>

      <div
        data-qa="seq-hud"
        style={{
          // Top-right, clear of the site header, of the act's bottom-left
          // label and of the scroll-to-top button — the only corner free at
          // both 390 and 1440.
          position: "fixed",
          right: "0.75rem",
          top: "5rem",
          zIndex: 100,
          padding: "0.6rem 0.75rem",
          borderRadius: "0.4rem",
          background: "rgba(11,10,8,0.82)",
          border: "1px solid rgba(201,165,92,0.35)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "0.68rem",
          lineHeight: 1.5,
          minWidth: "14rem",
          pointerEvents: "none",
        }}
      >
        {SEQ_PACKS.map((pack) => hudRow(pack.id, pack.label, pack.count))}
      </div>
    </div>
  );
};

export default SeqLabPage;

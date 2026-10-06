import { memo, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";
import Gallery from "@/components/Gallery";
import { useCoach } from "@/components/admin/coach/CoachProvider";

type PreviewPhoto = {
  id: string;
  image_url: string;
  alt_text: string | null;
};

type Props = {
  photos: PreviewPhoto[];
  isDragging?: boolean;
};

/**
 * ADMIN.FIXES.1 — the Galería's live preview, docked at the bottom.
 *
 * It starts COLLAPSED and remembers the open/closed choice on this device
 * (localStorage admin.livePreview.open; closed when nothing is stored or storage
 * is blocked). Its bar reads as a control, not a footer: the whole bar is the
 * toggle, under a gold hairline, with the eye and "VISTA PREVIA EN VIVO" in gold
 * (accent-ink, so the light admin's gold reads as text on cream).
 *
 * The first time the Galería mounts in a visit, the bar pulses soft gold twice
 * and then stays still, so Titi notices it. Never under reduced motion; and it
 * waits while a coaching tip is open (the tip's dim would hide it) — a tip that
 * opens mid-pulse stops it, and it plays once the tip closes.
 */

const OPEN_KEY = "admin.livePreview.open";

/** The last choice; closed when there is none or storage is unavailable. */
const readOpen = (): boolean => {
  try {
    return localStorage.getItem(OPEN_KEY) === "true";
  } catch {
    return false;
  }
};

const writeOpen = (open: boolean) => {
  try {
    localStorage.setItem(OPEN_KEY, String(open));
  } catch {
    /* storage unavailable — the choice lasts for this visit */
  }
};

const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/** One pulse per visit: set once it has played (a page load starts over). */
let pulsedThisVisit = false;

const LivePreviewDock = ({ photos, isDragging = false }: Props) => {
  const { t } = useTranslation();
  const panelId = useId();
  const { active: coachActive } = useCoach();
  const [open, setOpen] = useState(readOpen);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (coachActive) {
      // A tip opened over the pulse: stop it, and play it once the tip is gone.
      if (pulsing) {
        pulsedThisVisit = false;
        setPulsing(false);
      }
      return;
    }
    if (pulsedThisVisit) return;
    pulsedThisVisit = true;
    if (!reducedMotion()) setPulsing(true);
  }, [coachActive, pulsing]);

  const toggle = () =>
    setOpen((v) => {
      writeOpen(!v);
      return !v;
    });

  return (
    <div
      data-qa="live-preview-dock"
      data-open={open ? "true" : "false"}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-accent bg-background/95 backdrop-blur shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.4)]"
    >
      {pulsing && (
        <span
          aria-hidden
          data-qa="live-preview-pulse"
          className="pointer-events-none absolute inset-x-0 top-0 h-12"
          style={{
            background: "linear-gradient(hsl(var(--accent) / 0.3), hsl(var(--accent) / 0))",
            opacity: 0,
            animation: "live-preview-pulse 1.4s ease-in-out 2",
          }}
          onAnimationEnd={() => setPulsing(false)}
        />
      )}
      <div className="max-w-6xl mx-auto px-4">
        <button
          type="button"
          data-qa="live-preview-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className="group relative flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="flex min-w-0 items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent-ink">
            <Eye data-qa="live-preview-eye" className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span data-qa="live-preview-label" className="truncate">
              {t("admin.livePreview.label")}
            </span>
            <span className="shrink-0 text-muted-foreground normal-case tracking-normal">
              {t("admin.livePreview.count", { count: photos.length })}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
            {open ? t("admin.livePreview.collapse") : t("admin.livePreview.expand")}
            {open ? <ChevronDown className="w-4 h-4" aria-hidden /> : <ChevronUp className="w-4 h-4" aria-hidden />}
          </span>
        </button>

        <div id={panelId} data-qa="live-preview-panel" hidden={!open}>
          {open && (
            <div className="pb-3">
              {photos.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">{t("admin.livePreview.empty")}</p>
              ) : (
                <Gallery photos={photos} pauseAutoScroll={isDragging} compact />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(LivePreviewDock);

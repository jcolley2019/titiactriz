import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useEventsBoard } from "@/hooks/useEventsBoard";

const DISMISS_PREFIX = "eventsBannerDismissed:";
const MARQUEE_REPEAT = 10;

// Tiny stable hash for dismissal keys (djb2).
const hashText = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const EventsBanner = () => {
  const { board, loading } = useEventsBoard();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const activeLang: "es" | "en" = (i18n.language || "es").startsWith("es") ? "es" : "en";

  // Primary: editor-controlled bannerText. Fallback: first event's badge + title
  // so the banner is never blank when pageVisible is on and events exist.
  const explicitText = (board?.bannerText?.[activeLang] ?? "").trim();
  let bannerText = explicitText;
  if (!bannerText && board?.items?.length) {
    const first = board.items[0];
    const title = (first?.title?.[activeLang] ?? "").trim();
    const badge = (first?.badge?.[activeLang] ?? "").trim();
    if (title) {
      bannerText = badge ? `${badge} — ${title}` : title;
    }
  }
  const dismissKey = bannerText ? DISMISS_PREFIX + hashText(activeLang + "|" + bannerText) : "";

  const [dismissed, setDismissed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!dismissKey) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(localStorage.getItem(dismissKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  if (loading) return null;
  if (!board?.pageVisible) return null;
  if (!bannerText) return null;
  if (location.pathname.startsWith("/events")) return null;
  if (dismissed) return null;

  const label = t("events.title");

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      if (dismissKey) localStorage.setItem(dismissKey, "1");
    } catch {}
    setDismissed(true);
  };

  const goEvents = () => navigate("/events");

  const Separator = () => (
    <span aria-hidden className="mx-6 text-[#C9A55C]/70 text-[10px]">◆</span>
  );

  const renderSegment = (key: string) => (
    <div key={key} className="flex items-center shrink-0 pr-2">
      <span
        className="text-[#C9A55C] text-[11px] tracking-[0.22em] uppercase whitespace-nowrap leading-none"
        style={{ fontFamily: "Jost, sans-serif" }}
      >
        {bannerText}
      </span>
      <Separator />
    </div>
  );

  return (
    <>
      {/* In-flow spacer so page content (already cleared from the fixed header)
          is pushed an extra 38px down, keeping the hero below the banner. */}
      <div aria-hidden className="w-full" style={{ height: 38 }} />
    <div
      role="region"
      aria-label={label}
      className="fixed left-0 right-0 top-[60px] md:top-[68px] z-40 w-screen max-w-[100vw] bg-[#0a0a0a] border-y border-[#C9A55C]/25 select-none overflow-x-hidden"
      style={{ height: 38 }}
    >
      <div className="h-full flex items-stretch">
        {/* Fixed label */}
        <button
          type="button"
          onClick={goEvents}
          className="shrink-0 h-full flex items-center px-4 border-r border-[#C9A55C]/25 text-[#F0D78C] text-[11px] font-semibold tracking-[0.28em] uppercase leading-none translate-y-[1px] hover:bg-[#F0D78C]/5 transition-colors"
          style={{ fontFamily: "Cinzel, serif" }}
        >
          {label}
        </button>

        {/* Marquee area */}
        <button
          type="button"
          onClick={goEvents}
          aria-label={label}
          className="flex-1 h-full overflow-hidden relative text-left cursor-pointer"
        >
          {reducedMotion ? (
            <div className="h-full flex items-center px-4">
              <span
                className="text-[#C9A55C] text-[11px] tracking-[0.22em] uppercase leading-none"
                style={{ fontFamily: "Jost, sans-serif" }}
              >
                {bannerText}
              </span>
            </div>
          ) : (
            <div
              className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap will-change-transform"
              style={{
                animation: "events-banner-marquee 180s linear infinite",
                paddingLeft: "1rem",
              }}
            >
              {Array.from({ length: MARQUEE_REPEAT * 2 }).map((_, i) => renderSegment(`seg-${i}`))}
            </div>
          )}
        </button>

        {/* Right label (tablet + desktop) */}
        <button
          type="button"
          onClick={goEvents}
          aria-label={label}
          className="hidden md:flex shrink-0 h-full items-center px-4 border-l border-[#C9A55C]/25 text-[#F0D78C] text-[11px] font-semibold tracking-[0.28em] uppercase leading-none translate-y-[1px] hover:bg-[#F0D78C]/5 transition-colors"
          style={{ fontFamily: "Cinzel, serif" }}
        >
          {label}
        </button>

        {/* Dismiss */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 h-full flex items-center px-3 border-l border-[#C9A55C]/25 text-[#C9A55C]/70 hover:text-[#C9A55C] hover:bg-[#C9A55C]/5 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
    </>
  );
};

export default EventsBanner;

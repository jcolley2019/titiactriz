import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useEventsBoard } from "@/hooks/useEventsBoard";

const DISMISS_PREFIX = "eventsBannerDismissed:";

const EventsBanner = () => {
  const { board, loading } = useEventsBoard();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const activeLang: "es" | "en" = (i18n.language || "es").startsWith("es") ? "es" : "en";

  const items = (board?.items ?? []).filter((it) => it.title?.[activeLang]?.trim());
  const topId = items[0]?.id;

  const [dismissed, setDismissed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!topId) return;
    try {
      setDismissed(localStorage.getItem(DISMISS_PREFIX + topId) === "1");
    } catch {
      setDismissed(false);
    }
  }, [topId]);

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
  if (items.length === 0) return null;
  if (location.pathname.startsWith("/events")) return null;
  if (dismissed) return null;

  const label = t("events.title");

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      if (topId) localStorage.setItem(DISMISS_PREFIX + topId, "1");
    } catch {}
    setDismissed(true);
  };

  const goEvents = () => navigate("/events");

  const Separator = () => (
    <span aria-hidden className="mx-4 text-[#C9A55C]/70 text-[10px]">◆</span>
  );

  const renderSegment = (key: string) => (
    <div key={key} className="flex items-center shrink-0 pr-2">
      {items.map((it, idx) => {
        const badge = it.badge?.[activeLang]?.trim();
        const title = it.title[activeLang];
        return (
          <div key={`${key}-${it.id}-${idx}`} className="flex items-center shrink-0">
            {badge && (
              <span className="mr-2 px-1.5 py-[1px] text-[9px] tracking-[0.18em] uppercase border border-[#C9A55C]/50 text-[#C9A55C] rounded-sm">
                {badge}
              </span>
            )}
            <span className="text-[#C9A55C] text-[11px] tracking-[0.22em] uppercase whitespace-nowrap" style={{ fontFamily: "Jost, sans-serif" }}>
              {title}
            </span>
            <Separator />
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      role="region"
      aria-label={label}
      className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen max-w-[100vw] bg-[#0a0a0a] border-y border-[#C9A55C]/25 select-none overflow-x-hidden"
      style={{ height: 38 }}
    >
      <div className="h-full flex items-stretch">
        {/* Fixed label */}
        <button
          type="button"
          onClick={goEvents}
          className="shrink-0 h-full flex items-center px-4 border-r border-[#C9A55C]/25 text-[#C9A55C] text-[11px] tracking-[0.28em] uppercase hover:bg-[#C9A55C]/5 transition-colors"
          style={{ fontFamily: "Cinzel, serif" }}
        >
          {label}
        </button>

        {/* Marquee area */}
        <button
          type="button"
          onClick={goEvents}
          aria-label={label}
          className="flex-1 h-full overflow-hidden relative group text-left cursor-pointer"
        >
          {reducedMotion ? (
            <div className="h-full flex items-center px-4">
              {(() => {
                const first = items[0];
                const badge = first.badge?.[activeLang]?.trim();
                return (
                  <div className="flex items-center">
                    {badge && (
                      <span className="mr-2 px-1.5 py-[1px] text-[9px] tracking-[0.18em] uppercase border border-[#C9A55C]/50 text-[#C9A55C] rounded-sm">
                        {badge}
                      </span>
                    )}
                    <span className="text-[#C9A55C] text-[11px] tracking-[0.22em] uppercase" style={{ fontFamily: "Jost, sans-serif" }}>
                      {first.title[activeLang]}
                    </span>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div
              className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap will-change-transform group-hover:[animation-play-state:paused]"
              style={{
                animation: "events-banner-marquee 38s linear infinite",
                paddingLeft: "1rem",
              }}
            >
              {renderSegment("a")}
              {renderSegment("b")}
            </div>
          )}
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
  );
};

export default EventsBanner;

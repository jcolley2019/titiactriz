import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useEventsBoard, type PageBanner } from "@/hooks/useEventsBoard";

const DISMISS_PREFIX = "eventsBannerDismissed:";
const MARQUEE_REPEAT = 10;

const hashText = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

type SchemeKey = "main" | "greenWorld" | "titans";

type Scheme = { bg: string; border: string; label: string; accent: string; text: string };

const SCHEMES: Record<SchemeKey, Scheme> = {
  main:       { bg: "#0a0a0a", border: "#C9A55C",     label: "#F0D78C", accent: "#C9A55C", text: "#C9A55C" },
  greenWorld: { bg: "#128A5E", border: "#FFFFFF",     label: "#FFFFFF", accent: "#FFFFFF", text: "#FFFFFF" },
  titans:     { bg: "#841F1F", border: "transparent", label: "#FFFFFF", accent: "#FFE3E3", text: "#FFFFFF" },
};

const EventsBanner = () => {
  const { board, loading } = useEventsBoard();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const activeLang: "es" | "en" = (i18n.language || "es").startsWith("es") ? "es" : "en";
  const fallbackLang: "es" | "en" = activeLang === "es" ? "en" : "es";

  const pageKey: "home" | "greenWorld" | "titans" =
    location.pathname.startsWith("/green-world")
      ? "greenWorld"
      : location.pathname.startsWith("/titans-agency")
        ? "titans"
        : "home";

  const textOf = (b?: PageBanner): string =>
    (b?.text?.[activeLang] ?? "").trim() || (b?.text?.[fallbackLang] ?? "").trim();
  const labelOf = (b?: PageBanner): string =>
    (b?.label?.[activeLang] ?? "").trim() ||
    (b?.label?.[fallbackLang] ?? "").trim() ||
    t("events.title");
  const isOn = (b: PageBanner | undefined, key: "home" | "greenWorld" | "titans"): boolean =>
    !!b && b.enabled && !!b.pages?.[key] && !!textOf(b);

  const banners = board
    ? { main: board.mainBanner, greenWorld: board.greenWorldBanner, titans: board.titansBanner }
    : null;

  let activeKey: SchemeKey | null = null;
  if (banners) {
    if (pageKey === "greenWorld" && isOn(banners.greenWorld, "greenWorld")) {
      activeKey = "greenWorld";
    } else if (pageKey === "titans" && isOn(banners.titans, "titans")) {
      activeKey = "titans";
    } else {
      for (const k of ["greenWorld", "titans", "main"] as SchemeKey[]) {
        if (isOn(banners[k], pageKey)) { activeKey = k; break; }
      }
    }
  }

  const activeBanner = banners && activeKey ? banners[activeKey] : null;
  const scheme = SCHEMES[pageKey === "greenWorld" ? "greenWorld" : pageKey === "titans" ? "titans" : "main"];
  const bannerText = activeBanner ? textOf(activeBanner) : "";
  const label = activeBanner ? labelOf(activeBanner) : t("events.title");
  const textColor = scheme.text;
  const marqueeWeight = activeBanner?.bold ? 700 : 400;

  const dismissKey = bannerText ? DISMISS_PREFIX + hashText(bannerText) : "";

  const [dismissed, setDismissed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!dismissKey) { setDismissed(false); return; }
    try { setDismissed(localStorage.getItem(dismissKey) === "1"); }
    catch { setDismissed(false); }
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

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try { if (dismissKey) localStorage.setItem(dismissKey, "1"); } catch {}
    setDismissed(true);
  };

  const goTo = () => {
    const link = (activeBanner?.link ?? "").trim();
    if (!link) { navigate("/events"); return; }
    if (/^https?:\/\//i.test(link)) {
      window.open(link, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(link.startsWith("/") ? link : `/${link}`);
  };

  const Separator = () => (
    <span aria-hidden className="mx-6 text-[10px]" style={{ color: `${textColor}b3` }}>◆</span>
  );

  const renderSegment = (key: string) => (
    <div key={key} className="flex items-center shrink-0 pr-2">
      <span
        className="text-[11px] tracking-[0.22em] uppercase whitespace-nowrap leading-none"
        style={{ fontFamily: "Jost, sans-serif", color: textColor, fontWeight: marqueeWeight }}
      >
        {bannerText}
      </span>
      <Separator />
    </div>
  );

  return (
    <>
      <div aria-hidden className="w-full" style={{ height: 38 }} />
      <div
        role="region"
        aria-label={label}
        className="fixed left-0 right-0 top-[60px] md:top-[68px] z-40 w-screen max-w-[100vw] select-none overflow-x-hidden border-y-2"
        style={{ height: 38, backgroundColor: scheme.bg, borderColor: scheme.border }}
      >
        <div className="h-full flex items-stretch">
          <button
            type="button"
            onClick={goTo}
            className="shrink-0 h-full flex items-center px-4 border-r text-[11px] font-semibold tracking-[0.28em] uppercase leading-none transition-colors hover:bg-white/5"
            style={{ fontFamily: "Cinzel, serif", color: scheme.label, borderColor: scheme.border }}
          >
            {label}
          </button>

          <button
            type="button"
            onClick={goTo}
            aria-label={label}
            className="flex-1 h-full overflow-hidden relative text-left cursor-pointer"
          >
            {reducedMotion ? (
              <div className="h-full flex items-center px-4">
                <span
                  className="text-[11px] tracking-[0.22em] uppercase leading-none translate-y-[1px]"
                  style={{ fontFamily: "Jost, sans-serif", color: textColor, fontWeight: marqueeWeight }}
                >
                  {bannerText}
                </span>
              </div>
            ) : (
              <div
                className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap will-change-transform"
                style={{ animation: "events-banner-marquee 180s linear infinite", paddingLeft: "1rem" }}
              >
                {Array.from({ length: MARQUEE_REPEAT * 2 }).map((_, i) => renderSegment(`seg-${i}`))}
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={goTo}
            aria-label={label}
            className="hidden md:flex shrink-0 h-full items-center px-4 border-l text-[11px] font-semibold tracking-[0.28em] uppercase leading-none translate-y-[1px] transition-colors hover:bg-white/5"
            style={{ fontFamily: "Cinzel, serif", color: scheme.label, borderColor: scheme.border }}
          >
            {label}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="shrink-0 h-full flex items-center px-3 border-l transition-colors hover:bg-white/5"
            style={{ color: `${textColor}b3`, borderColor: scheme.border }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  );
};

export default EventsBanner;

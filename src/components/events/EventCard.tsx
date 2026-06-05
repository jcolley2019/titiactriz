import { useTranslation } from "react-i18next";
import cornerOrnAsset from "@/assets/cp-corner-ornament-v2.png.asset.json";
import type {
  EventItem,
  EventCardItem,
  VideoItem,
  LinkItem,
  Localized,
} from "@/hooks/useEventsBoard";

const GOLD = "#C9A55C";
const CREAM = "#f0e9da";
const DARK = "#0e0c09";

type Lang = "es" | "en";

const pick = (l: Localized | undefined, lang: Lang): string => {
  if (!l) return "";
  return (l[lang] ?? "").trim();
};

const useLang = (): Lang => {
  const { i18n } = useTranslation();
  return (i18n.language || "es").startsWith("es") ? "es" : "en";
};

const Diamond = () => (
  <svg
    aria-hidden
    width="6"
    height="6"
    viewBox="0 0 6 6"
    className="inline-block mx-2 align-middle"
  >
    <rect
      x="3"
      y="0"
      width="4.24"
      height="4.24"
      transform="rotate(45 3 0)"
      fill={GOLD}
    />
  </svg>
);

const frameStyle: React.CSSProperties = {
  backgroundColor: "#13110d",
  border: `1px solid ${GOLD}`,
  boxShadow: "0 20px 60px -30px rgba(201, 165, 92, 0.35)",
};

const Corners = () => (
  <>
    <img
      src={cornerOrnAsset.url}
      alt=""
      aria-hidden
      className="pointer-events-none absolute top-2 left-2 w-[40px] md:w-[56px] h-auto select-none"
    />
    <img
      src={cornerOrnAsset.url}
      alt=""
      aria-hidden
      className="pointer-events-none absolute top-2 right-2 w-[40px] md:w-[56px] h-auto select-none -scale-x-100"
    />
    <img
      src={cornerOrnAsset.url}
      alt=""
      aria-hidden
      className="pointer-events-none absolute bottom-2 left-2 w-[40px] md:w-[56px] h-auto select-none -scale-y-100"
    />
    <img
      src={cornerOrnAsset.url}
      alt=""
      aria-hidden
      className="pointer-events-none absolute bottom-2 right-2 w-[40px] md:w-[56px] h-auto select-none -scale-100"
    />
  </>
);

/* ---------- EVENT ---------- */

const EventVariant = ({ item, lang }: { item: EventCardItem; lang: Lang }) => {
  const isFull = item.size === "full";
  const badge = pick(item.badge, lang);
  const title = pick(item.title, lang);
  const description = pick(item.description, lang);
  const note = pick(item.note, lang);
  const details = item.details
    .map((d) => pick(d, lang))
    .filter((s) => s.length > 0);
  const buttons = item.buttons
    .map((b) => ({ label: pick(b.label, lang), url: b.url }))
    .filter((b) => b.url);

  return (
    <article
      className={`relative h-full text-center ${
        isFull ? "p-8 md:p-12" : "p-6 md:p-8"
      }`}
      style={frameStyle}
    >
      {isFull && <Corners />}

      {badge && (
        <span
          className={`inline-block px-3 py-1 uppercase tracking-[0.25em] ${
            isFull ? "text-[0.65rem] mb-6" : "text-[0.6rem] mb-4"
          }`}
          style={{
            backgroundColor: GOLD,
            color: DARK,
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
          }}
        >
          {badge}
        </span>
      )}

      {title && (
        <h2
          className={`leading-tight mb-4 ${
            isFull ? "text-2xl md:text-4xl" : "text-xl md:text-2xl"
          }`}
          style={{ fontFamily: "var(--font-display)", color: CREAM }}
        >
          {title}
        </h2>
      )}

      {description && (
        <p
          className={`mx-auto mb-6 ${
            isFull ? "text-sm md:text-base max-w-2xl" : "text-sm max-w-md"
          }`}
          style={{ color: `${CREAM}d9`, lineHeight: 1.7 }}
        >
          {description}
        </p>
      )}

      {details.length > 0 && (
        <div
          className={`flex flex-wrap items-center justify-center uppercase tracking-[0.15em] mb-6 ${
            isFull ? "text-xs md:text-sm" : "text-[0.7rem]"
          }`}
          style={{ color: GOLD, fontFamily: "var(--font-sans)" }}
        >
          {details.map((f, i) => (
            <span key={i} className="inline-flex items-center">
              {i > 0 && <Diamond />}
              <span>{f}</span>
            </span>
          ))}
        </div>
      )}

      {note && (
        <p
          className={`italic mx-auto mb-8 ${
            isFull ? "text-xs md:text-sm max-w-xl" : "text-xs max-w-sm"
          }`}
          style={{ color: `${CREAM}b3` }}
        >
          {note}
        </p>
      )}

      {buttons.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {buttons.map((b, i) => {
            const primary = i === 0;
            const base =
              "inline-flex items-center justify-center px-6 py-2.5 text-xs uppercase tracking-[0.2em] font-medium transition-all duration-300 hover:-translate-y-0.5";
            return (
              <a
                key={i}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className={primary ? base : `${base} border`}
                style={
                  primary
                    ? { backgroundColor: GOLD, color: DARK }
                    : { color: CREAM, borderColor: GOLD }
                }
              >
                {b.label || b.url}
              </a>
            );
          })}
        </div>
      )}
    </article>
  );
};

/* ---------- VIDEO ---------- */

const parseYouTubeId = (url: string): string | null => {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1) || null;
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "shorts" || p === "embed");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
    return null;
  } catch {
    return null;
  }
};

const VideoVariant = ({ item, lang }: { item: VideoItem; lang: Lang }) => {
  const title = pick(item.title, lang);
  const id = parseYouTubeId(item.videoUrl);
  return (
    <article className="relative h-full p-6 md:p-8" style={frameStyle}>
      {title && (
        <h2
          className="text-xl md:text-2xl leading-tight mb-4 text-center"
          style={{ fontFamily: "var(--font-display)", color: CREAM }}
        >
          {title}
        </h2>
      )}
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingBottom: "56.25%", border: `1px solid ${GOLD}` }}
      >
        {id ? (
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${id}`}
            title={title || "Video"}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.2em]"
            style={{ color: `${CREAM}80` }}
          >
            —
          </div>
        )}
      </div>
    </article>
  );
};

/* ---------- LINK ---------- */

const LinkVariant = ({ item, lang }: { item: LinkItem; lang: Lang }) => {
  const title = pick(item.title, lang);
  const label = pick(item.buttonLabel, lang);
  const url = item.url;

  return (
    <article
      className="relative h-full p-6 md:p-8 text-center flex flex-col"
      style={frameStyle}
    >
      {title && (
        <h2
          className="text-xl md:text-2xl leading-tight mb-4"
          style={{ fontFamily: "var(--font-display)", color: CREAM }}
        >
          {title}
        </h2>
      )}

      {item.imageUrl && (
        <div
          className="relative w-full overflow-hidden mb-4"
          style={{ paddingBottom: "56.25%", border: `1px solid ${GOLD}` }}
        >
          <img
            src={item.imageUrl}
            alt={title || ""}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      )}

      {url && (
        <div className="mt-auto pt-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-2.5 text-xs uppercase tracking-[0.2em] font-medium transition-all duration-300 hover:-translate-y-0.5"
            style={{ backgroundColor: GOLD, color: DARK }}
          >
            {label || "→"}
          </a>
        </div>
      )}
    </article>
  );
};

/* ---------- ROOT ---------- */

const EventCard = ({ item }: { item: EventItem }) => {
  const lang = useLang();
  if (item.type === "event") return <EventVariant item={item} lang={lang} />;
  if (item.type === "video") return <VideoVariant item={item} lang={lang} />;
  return <LinkVariant item={item} lang={lang} />;
};

export default EventCard;

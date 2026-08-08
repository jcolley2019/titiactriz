import { useTranslation } from "react-i18next";
import cornerOrn from "@/assets/cp-corner-ornament-v2.png";
import EventMedia from "./EventMedia";
import type {
  EventItem,
  EventButton,
  ButtonIcon,
  ImageAspect,
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

const frameStyle: React.CSSProperties = {
  backgroundColor: "#13110d",
  border: `1px solid ${GOLD}`,
  boxShadow: "0 20px 60px -30px rgba(201, 165, 92, 0.35)",
};

const Corners = () => (
  <>
    <img
      src={cornerOrn}
      alt=""
      aria-hidden
      className="pointer-events-none absolute top-2 left-2 w-[40px] md:w-[56px] h-auto select-none"
    />
    <img
      src={cornerOrn}
      alt=""
      aria-hidden
      className="pointer-events-none absolute top-2 right-2 w-[40px] md:w-[56px] h-auto select-none -scale-x-100"
    />
    <img
      src={cornerOrn}
      alt=""
      aria-hidden
      className="pointer-events-none absolute bottom-2 left-2 w-[40px] md:w-[56px] h-auto select-none -scale-y-100"
    />
    <img
      src={cornerOrn}
      alt=""
      aria-hidden
      className="pointer-events-none absolute bottom-2 right-2 w-[40px] md:w-[56px] h-auto select-none -scale-100"
    />
  </>
);

/* ---------- Icons ---------- */

const IconWebsite = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const IconInstagram = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const IconTikTok = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const IconYouTube = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const IconFacebook = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const IconX = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const detectIcon = (url: string): ButtonIcon => {
  if (!url) return "website";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    if (host.includes("facebook.com") || host === "fb.com") return "facebook";
    if (host === "x.com" || host.includes("twitter.com")) return "x";
    return "website";
  } catch {
    return "website";
  }
};

const renderIcon = (icon: ButtonIcon, className: string) => {
  switch (icon) {
    case "instagram":
      return <IconInstagram className={className} />;
    case "tiktok":
      return <IconTikTok className={className} />;
    case "youtube":
      return <IconYouTube className={className} />;
    case "facebook":
      return <IconFacebook className={className} />;
    case "x":
      return <IconX className={className} />;
    case "website":
      return <IconWebsite className={className} />;
    default:
      return <IconWebsite className={className} />;
  }
};

/* ---------- Card ---------- */

const EventCard = ({
  item,
  lang,
  fillPortrait,
  admin,
}: {
  item: EventItem;
  lang?: Lang;
  /** EVENTS.NAV.1 — let portrait art use a portrait tablet's vertical room. */
  fillPortrait?: boolean;
  /**
   * EVENTS.VIDEO.1 — this card is standing in an ADMIN surface, so a medium
   * that could not be rendered may say so out loud. Never set on a public
   * surface: a visitor is shown the honest fallback, not our diagnostics.
   */
  admin?: boolean;
}) => {
  const fallback = useLang();
  const active: Lang = lang ?? fallback;

  // Read all fields through a permissive view: legacy video/link variants
  // may not declare every field, but we render them all the same way.
  const v = item as {
    size?: "full" | "half";
    title?: Localized;
    badge?: Localized;
    description?: Localized;
    note?: Localized;
    imageUrl?: string;
    imagePosition?: "above" | "below";
    imageAspect?: ImageAspect;
    bulletsOn?: boolean;
    bullets?: Localized[];
    videoUrl?: string;
    videoFileUrl?: string;
    buttons?: EventButton[];
  };

  const isFull = v.size === "full";
  const badge = pick(v.badge, active);
  const title = pick(v.title, active);
  const description = pick(v.description, active);
  const note = pick(v.note, active);

  const imagePosition = v.imagePosition === "below" ? "below" : "above";
  const imageAspect: ImageAspect =
    v.imageAspect === "landscape" || v.imageAspect === "portrait"
      ? v.imageAspect
      : "auto";

  const bulletList = (v.bullets ?? [])
    .map((b) => pick(b, active))
    .filter((s) => s.length > 0);
  const showBullets = !!v.bulletsOn && bulletList.length > 0;

  const buttons = (v.buttons ?? [])
    .map((b) => ({
      label: pick(b.label, active),
      url: (b.url || "").trim(),
      icon: (b.icon ?? "auto") as ButtonIcon,
    }))
    .filter((b) => b.url.length > 0);


  /**
   * EVENTS.VIDEO.1 — ONE well, wherever the image used to sit. The card keeps
   * `imagePosition` as the slot's name because that is what the owner set and
   * what every stored row says; what stands in the slot is now whichever medium
   * the card actually has.
   */
  const Media = (
    <EventMedia
      item={{
        imageUrl: v.imageUrl,
        videoUrl: v.videoUrl,
        videoFileUrl: v.videoFileUrl,
        imageAspect,
      }}
      alt={title || ""}
      isFull={isFull}
      fillPortrait={fillPortrait}
      admin={admin}
    />
  );

  return (
    <article
      className={`relative h-full text-center ${
        isFull ? "p-8 md:p-12" : "p-6 md:p-8"
      } ${fillPortrait ? "max-md:p-6" : ""}`}
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

      {imagePosition === "above" && Media}

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

      {imagePosition === "below" && Media}

      {showBullets && (
        <ul
          className={`mx-auto mb-6 text-left grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 ${
            isFull ? "max-w-2xl text-sm" : "max-w-md text-sm"
          }`}
          style={{ color: `${CREAM}e6` }}
        >
          {bulletList.map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                aria-hidden
                className="inline-block mt-2 shrink-0"
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: GOLD,
                  transform: "rotate(45deg)",
                }}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
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

      {/* EVENTS.VIDEO.1 — the standalone video block is gone. A card's video is
          its medium, and its medium stands in the well above, not in a second
          slot underneath the note. */}

      {buttons.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {buttons.map((b, i) => {
            const primary = i === 0;
            const resolved: ButtonIcon =
              b.icon === "auto" ? detectIcon(b.url) : b.icon;
            const showIcon = resolved !== "none";
            const labelText = b.label;
            const base =
              "inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs uppercase tracking-[0.2em] font-medium transition-all duration-300 hover:-translate-y-0.5";
            return (
              <a
                key={i}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={labelText || b.url}
                className={primary ? base : `${base} border`}
                style={
                  primary
                    ? { backgroundColor: GOLD, color: DARK }
                    : { color: CREAM, borderColor: GOLD }
                }
              >
                {showIcon && renderIcon(resolved, "w-4 h-4")}
                {labelText && <span>{labelText}</span>}
              </a>
            );
          })}
        </div>
      )}
    </article>
  );
};

export default EventCard;

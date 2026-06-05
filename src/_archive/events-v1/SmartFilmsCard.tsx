import { useTranslation } from "react-i18next";
import cornerOrnAsset from "@/assets/cp-corner-ornament-v2.png.asset.json";
import type { EventSettings } from "@/hooks/useEventSettings";

const GOLD = "#C9A55C";
const CREAM = "#f0e9da";
const DARK = "#0e0c09";

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

type Props = { data: EventSettings };

const SmartFilmsCard = ({ data }: Props) => {
  const { t } = useTranslation();

  const facts = [
    t("events.sf.factEdition"),
    t("events.sf.factTheme"),
    t("events.sf.factPrize"),
    t("events.sf.deadline"),
  ];

  return (
    <article
      className="relative max-w-3xl mx-auto p-8 md:p-12 text-center"
      style={{
        backgroundColor: "#13110d",
        border: `1px solid ${GOLD}`,
        boxShadow: "0 20px 60px -30px rgba(201, 165, 92, 0.35)",
      }}
    >
      {/* Corner ornaments */}
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

      {/* Badge */}
      <span
        className="inline-block px-3 py-1 text-[0.65rem] uppercase tracking-[0.25em] mb-6"
        style={{
          backgroundColor: GOLD,
          color: DARK,
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
        }}
      >
        {t("events.sf.badge")}
      </span>

      <h2
        className="text-2xl md:text-4xl leading-tight mb-4"
        style={{ fontFamily: "var(--font-display)", color: CREAM }}
      >
        SmartFilms Colombia 2026
      </h2>

      <p
        className="text-sm md:text-base max-w-2xl mx-auto mb-6"
        style={{ color: `${CREAM}d9`, lineHeight: 1.7 }}
      >
        {t("events.sf.blurb")}
      </p>

      {/* Facts row */}
      <div
        className="flex flex-wrap items-center justify-center text-xs md:text-sm uppercase tracking-[0.15em] mb-6"
        style={{ color: GOLD, fontFamily: "var(--font-sans)" }}
      >
        {facts.map((f, i) => (
          <span key={i} className="inline-flex items-center">
            {i > 0 && <Diamond />}
            <span>{f}</span>
          </span>
        ))}
      </div>

      {(data.filmTitle || data.category) && (
        <div
          className="mb-6 text-sm md:text-base space-y-1"
          style={{ color: CREAM }}
        >
          {data.filmTitle && (
            <p>
              <span style={{ color: GOLD }}>{t("events.sf.filmLabel")}: </span>
              <span style={{ fontFamily: "var(--font-display)" }}>
                {data.filmTitle}
              </span>
            </p>
          )}
          {data.category && (
            <p>
              <span style={{ color: GOLD }}>{t("events.sf.categoryLabel")}: </span>
              {data.category}
            </p>
          )}
        </div>
      )}

      <p
        className="text-xs md:text-sm italic max-w-xl mx-auto mb-8"
        style={{ color: `${CREAM}b3` }}
      >
        {t("events.sf.voteNote")}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        {data.watchUrl && (
          <a
            href={data.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-2.5 text-xs uppercase tracking-[0.2em] font-medium transition-all duration-300 hover:-translate-y-0.5"
            style={{ backgroundColor: GOLD, color: DARK }}
          >
            {t("events.sf.watch")}
          </a>
        )}
        {data.voteUrl && (
          <a
            href={data.voteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-2.5 text-xs uppercase tracking-[0.2em] font-medium border transition-all duration-300 hover:-translate-y-0.5"
            style={{ color: CREAM, borderColor: GOLD }}
          >
            {t("events.sf.vote")}
          </a>
        )}
        {data.festivalUrl && (
          <a
            href={data.festivalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-2.5 text-xs uppercase tracking-[0.2em] font-medium border transition-all duration-300 hover:-translate-y-0.5"
            style={{ color: CREAM, borderColor: GOLD }}
          >
            {t("events.sf.festival")}
          </a>
        )}
      </div>
    </article>
  );
};

export default SmartFilmsCard;

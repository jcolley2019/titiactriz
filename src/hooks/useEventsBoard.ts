import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ClassFramingPair, HeroVideoFraming } from "@/hooks/useCinematicMedia";
import { coerceEventImageFraming, coerceEventVideoFraming } from "@/lib/event-framing";

export type Lang = "es" | "en";

/**
 * EVENTS.I18N.1 — the storage shape stays {es,en}: every public reader keeps
 * asking for the locale it wants and gets it. What the admin adds is bookkeeping
 * the public site never looks at:
 *
 *   src     — which slot the owner actually typed. The admin's single field
 *             shows this one back, so re-opening a card shows your own words,
 *             not a translation of them.
 *   pending — the other slot is a copy of the source, not a translation of it
 *             (the owner just typed, or the translation failed). The next
 *             successful save clears it.
 *
 * Both are optional: every row written before this brick parses unchanged.
 */
export type Localized = { es: string; en: string; src?: Lang; pending?: boolean };

/**
 * Which slot the owner typed. Rows written before `src` existed fall back to
 * whichever slot has text, Spanish first — the site is ES-primary.
 */
export const localizedSource = (v: Localized): Lang =>
  v.src === "es" || v.src === "en"
    ? v.src
    : (v.es ?? "").trim()
      ? "es"
      : (v.en ?? "").trim()
        ? "en"
        : "es";

/** The one string the admin shows for this field. */
export const localizedText = (v: Localized): string => v[localizedSource(v)] ?? "";

/**
 * The owner typed. Language is unknown until save, so both slots take the text
 * verbatim and the field is marked `pending`: nothing on the public site can
 * read a stale mismatch in the meantime, and save knows there is work to do.
 */
export const setLocalizedText = (v: Localized, text: string): Localized =>
  text.trim()
    ? { es: text, en: text, src: v.src, pending: true }
    : { es: "", en: "" };

export type ButtonIcon =
  | "auto" | "website" | "instagram" | "tiktok"
  | "youtube" | "facebook" | "x" | "none";

export type EventButton = { label: Localized; url: string; icon?: ButtonIcon };

/**
 * How a card's image well treats the artwork it is given.
 *   landscape — the historic well: full width, cropped to a horizontal band.
 *   portrait  — tall art, shown whole, capped so a 9:16 poster cannot own the page.
 *   auto      — the shape is read off the image itself (the default; rows written
 *               before this field existed keep their landscape rendering because
 *               their art is landscape, not because the field says so).
 */
export type ImageAspect = "landscape" | "portrait" | "auto";

type BaseItem = { id: string; size: "full" | "half"; title: Localized };

export type EventCardItem = BaseItem & {
  badge: Localized;
  description: Localized;
  note: Localized;
  buttons: EventButton[];
  imageUrl?: string;
  imagePosition?: "above" | "below";
  imageAspect?: ImageAspect;
  bulletsOn?: boolean;
  bullets?: Localized[];
  /**
   * EVENTS.VIDEO.1 — a video hosted on a platform, by its public link
   * (TikTok / Instagram / YouTube). Pre-dates this brick and keeps its name and
   * its meaning, so every row already on the board parses exactly as it did.
   */
  videoUrl?: string;
  /**
   * EVENTS.VIDEO.1 — a video we host: an mp4/webm in the gallery bucket, by its
   * public URL. Optional and absent from every row written before this brick.
   *
   * A card has ONE medium. When both video fields somehow carry a value — only
   * reachable by hand-editing the row, since the admin lets you fill in one at a
   * time — the uploaded file wins: it is the one Titi owns, and it is the one
   * that cannot silently change under her from someone else's platform.
   * `imageUrl` is never a competitor: it is this medium's POSTER, and the
   * fallback whenever the video cannot be shown.
   */
  videoFileUrl?: string;
  /**
   * EVENTS.MEDIA.EDITOR.1b — the still image's framing, in the reel's exact
   * shape: one record per device class, split at the same 768px line. Absent
   * (every row written before this brick) = centered / unzoomed = today's
   * render, byte-identical. The admin omits the field when it is all-defaults.
   */
  imageFraming?: ClassFramingPair;
  /**
   * EVENTS.MEDIA.EDITOR.1b — the uploaded video's framing, in the hero video's
   * exact shape: one record per viewport orientation, each focal/zoom/fit.
   * Absent = defaults, same law as imageFraming. A social link stores none —
   * the platform's own player frames itself.
   */
  videoFraming?: HeroVideoFraming;
};

export type EventItem = EventCardItem;

export type BannerPages = { home: boolean; greenWorld: boolean; titans: boolean };

export type PageBanner = {
  enabled: boolean;
  label: Localized;   // pill text e.g. EVENTS / SALE!
  text: Localized;    // scrolling message
  link: string;       // click target; "" falls back to /events
  pages: BannerPages;
  bold: boolean;
  textColor: string;  // hex
};

export type EventsBoard = {
  pageVisible: boolean;
  /**
   * EVENTS.2b — ONE owner switch: do events appear on the HOME SURFACE of
   * whichever layout is active? The admin manages events, never layouts —
   * cinematic expresses this as the Events act (EVENTS.2), classic will
   * express it as a Featured-strip card (EVENTS.3), editorial has no home
   * expression. Default FALSE, and rows written before the field existed
   * parse as false: a surface nobody asked for never appears on its own.
   * Distinct from `pageVisible`, which governs the /events page itself.
   */
  homeVisible: boolean;
  bannerText: Localized; // legacy mirror of mainBanner.text (kept for compatibility)
  mainBanner: PageBanner;
  greenWorldBanner: PageBanner;
  titansBanner: PageBanner;
  items: EventItem[];
};

export const EVENTS_BOARD_KEY = "events_board";

const makeBanner = (
  overrides: Partial<PageBanner> & { pages: BannerPages },
): PageBanner => ({
  enabled: false,
  label: { es: "EVENTOS", en: "EVENTS" },
  text: { es: "", en: "" },
  link: "",
  bold: false,
  textColor: "#C9A55C",
  ...overrides,
});

const SMARTFILMS_TEXT: Localized = {
  es: "EN COMPETENCIA — SmartFilms Colombia 2026",
  en: "NOW COMPETING — SmartFilms Colombia 2026",
};

export const EVENTS_BOARD_DEFAULT: EventsBoard = {
  pageVisible: true,
  homeVisible: false,
  bannerText: SMARTFILMS_TEXT,
  mainBanner: makeBanner({
    enabled: true,
    text: SMARTFILMS_TEXT,
    pages: { home: true, greenWorld: true, titans: true },
    textColor: "#C9A55C",
  }),
  greenWorldBanner: makeBanner({
    pages: { home: false, greenWorld: true, titans: false },
    textColor: "#FFFFFF",
  }),
  titansBanner: makeBanner({
    pages: { home: false, greenWorld: false, titans: true },
    textColor: "#FFFFFF",
  }),
  items: [
    {
      id: "smartfilms-2026",
      size: "full",
      title: { es: "SmartFilms Colombia 2026", en: "SmartFilms Colombia 2026" },
      badge: { es: "EN COMPETENCIA", en: "NOW COMPETING" },
      description: {
        es: "Compito en la 12a edición de SmartFilms, el festival de cine hecho con celular más grande del mundo. La temática de este año: retrofuturismo, donde el pasado y el futuro se encuentran.",
        en: "I'm competing in the 12th edition of SmartFilms, the world's largest festival of films made on a phone. This year's theme: retro-futurism, where past meets future.",
      },
      note: {
        es: "Los ganadores se eligen con un 10% de votación del público: tu apoyo cuenta.",
        en: "Winners are chosen with 10% public voting — your support counts.",
      },
      imageUrl: "",
      imagePosition: "above",
      imageAspect: "auto",
      bulletsOn: false,
      bullets: [],
      videoUrl: "",
      videoFileUrl: "",
      buttons: [
        {
          label: { es: "Sobre SmartFilms", en: "About SmartFilms" },
          url: "https://www.instagram.com/smartfilmsco/",
          icon: "auto",
        },
      ],
    },
  ],
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const coerceLocalized = (v: unknown): Localized => {
  if (!isObj(v)) return { es: "", en: "" };
  const out: Localized = {
    es: typeof v.es === "string" ? v.es : "",
    en: typeof v.en === "string" ? v.en : "",
  };
  if (v.src === "es" || v.src === "en") out.src = v.src;
  if (v.pending === true) out.pending = true;
  return out;
};

const VALID_ICONS: ButtonIcon[] = [
  "auto", "website", "instagram", "tiktok", "youtube", "facebook", "x", "none",
];

const coerceIcon = (v: unknown): ButtonIcon =>
  typeof v === "string" && (VALID_ICONS as string[]).includes(v)
    ? (v as ButtonIcon)
    : "auto";

const coerceButton = (v: unknown): EventButton | null => {
  if (!isObj(v)) return null;
  const url = typeof v.url === "string" ? v.url : "";
  return { label: coerceLocalized(v.label), url, icon: coerceIcon(v.icon) };
};

const coerceSize = (v: unknown): "full" | "half" => (v === "half" ? "half" : "full");
const coercePosition = (v: unknown): "above" | "below" => (v === "below" ? "below" : "above");

// Anything a stored row does not say — including every row written before the
// field existed — means "auto". No migration, no rewrite of live JSON.
const coerceAspect = (v: unknown): ImageAspect =>
  v === "landscape" || v === "portrait" ? v : "auto";

const coerceItem = (v: unknown): EventItem | null => {
  if (!isObj(v)) return null;
  const id = typeof v.id === "string" && v.id ? v.id : null;
  if (!id) return null;
  const bullets = Array.isArray(v.bullets) ? v.bullets.map(coerceLocalized) : [];
  const buttons = Array.isArray(v.buttons)
    ? (v.buttons.map(coerceButton).filter(Boolean) as EventButton[])
    : [];
  // EVENTS.MEDIA.EDITOR.1b — absent stays ABSENT (not defaults-materialized):
  // a row that never stored framing keeps parsing to the same object shape it
  // parsed to yesterday, so nothing downstream can tell this brick happened.
  const imageFraming = coerceEventImageFraming(v.imageFraming);
  const videoFraming = coerceEventVideoFraming(v.videoFraming);
  return {
    id,
    size: coerceSize(v.size),
    title: coerceLocalized(v.title),
    badge: coerceLocalized(v.badge),
    description: coerceLocalized(v.description),
    note: coerceLocalized(v.note),
    imageUrl: typeof v.imageUrl === "string" ? v.imageUrl : "",
    imagePosition: coercePosition(v.imagePosition),
    imageAspect: coerceAspect(v.imageAspect),
    bulletsOn: v.bulletsOn === true,
    bullets,
    videoUrl: typeof v.videoUrl === "string" ? v.videoUrl : "",
    // EVENTS.VIDEO.1 — anything a stored row does not say, including every row
    // written before the field existed, means "no uploaded video". No
    // migration, no rewrite of live JSON.
    videoFileUrl: typeof v.videoFileUrl === "string" ? v.videoFileUrl : "",
    ...(imageFraming ? { imageFraming } : {}),
    ...(videoFraming ? { videoFraming } : {}),
    buttons,
  };
};

const coercePages = (v: unknown, fallback: BannerPages): BannerPages => {
  if (!isObj(v)) return fallback;
  return {
    home: typeof v.home === "boolean" ? v.home : fallback.home,
    greenWorld: typeof v.greenWorld === "boolean" ? v.greenWorld : fallback.greenWorld,
    titans: typeof v.titans === "boolean" ? v.titans : fallback.titans,
  };
};

const coerceBanner = (v: unknown, defaults: PageBanner): PageBanner => {
  if (!isObj(v)) return defaults;
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : defaults.enabled,
    label: isObj(v.label) ? coerceLocalized(v.label) : defaults.label,
    text: coerceLocalized(v.text),
    link: typeof v.link === "string" ? v.link : "",
    pages: coercePages(v.pages, defaults.pages),
    bold: v.bold === true,
    textColor:
      typeof v.textColor === "string" && v.textColor ? v.textColor : defaults.textColor,
  };
};

export const parseBoard = (value: unknown): EventsBoard => {
  if (!isObj(value)) return EVENTS_BOARD_DEFAULT;
  const pageVisible = typeof value.pageVisible === "boolean" ? value.pageVisible : true;
  // EVENTS.2b — anything a stored row does not say, including every row written
  // before the field existed, means "not on home". No migration, no rewrite.
  const homeVisible = value.homeVisible === true;

  // Legacy migration: older rows stored a single `bannerText`.
  const legacyText = isObj(value.bannerText) ? coerceLocalized(value.bannerText) : null;
  const mainDefaults = EVENTS_BOARD_DEFAULT.mainBanner;
  let mainBanner = coerceBanner(value.mainBanner, mainDefaults);
  if (!isObj(value.mainBanner) && legacyText) {
    mainBanner = { ...mainDefaults, enabled: true, text: legacyText };
  }
  const greenWorldBanner = coerceBanner(
    value.greenWorldBanner,
    EVENTS_BOARD_DEFAULT.greenWorldBanner,
  );
  const titansBanner = coerceBanner(value.titansBanner, EVENTS_BOARD_DEFAULT.titansBanner);

  const rawItems = Array.isArray(value.items) ? value.items : null;
  const items = rawItems
    ? ((rawItems.map(coerceItem).filter(Boolean) as EventItem[]).slice(0, 4))
    : EVENTS_BOARD_DEFAULT.items;

  return {
    pageVisible,
    homeVisible,
    bannerText: mainBanner.text,
    mainBanner,
    greenWorldBanner,
    titansBanner,
    items,
  };
};

/**
 * Every localized field on a board, in one place. Both walkers below drive off
 * this list, so a new localized field is wired into detection and translation by
 * adding it here once — not in two places that can drift apart.
 */
const mapBannerLocalized = (
  b: PageBanner,
  fn: (v: Localized) => Localized,
): PageBanner => ({ ...b, label: fn(b.label), text: fn(b.text) });

const mapItemLocalized = (
  it: EventItem,
  fn: (v: Localized) => Localized,
): EventItem => ({
  ...it,
  title: fn(it.title),
  badge: fn(it.badge),
  description: fn(it.description),
  note: fn(it.note),
  bullets: (it.bullets ?? []).map(fn),
  buttons: it.buttons.map((btn) => ({ ...btn, label: fn(btn.label) })),
});

/** Rewrite every localized field on the board. `bannerText` stays a true mirror. */
export const mapBoardLocalized = (
  board: EventsBoard,
  fn: (v: Localized) => Localized,
): EventsBoard => {
  const mainBanner = mapBannerLocalized(board.mainBanner, fn);
  return {
    ...board,
    mainBanner,
    greenWorldBanner: mapBannerLocalized(board.greenWorldBanner, fn),
    titansBanner: mapBannerLocalized(board.titansBanner, fn),
    items: board.items.map((it) => mapItemLocalized(it, fn)),
    bannerText: mainBanner.text,
  };
};

/** Visit every localized field on the board without changing it. */
export const forEachBoardLocalized = (
  board: EventsBoard,
  fn: (v: Localized) => void,
): void => {
  mapBoardLocalized(board, (v) => {
    fn(v);
    return v;
  });
};

export const fetchEventsBoard = async (): Promise<EventsBoard> => {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", EVENTS_BOARD_KEY)
    .maybeSingle();
  return parseBoard(data?.value);
};

export const setEventsBoard = async (next: EventsBoard): Promise<void> => {
  const { error } = await supabase.from("site_settings").upsert([
    {
      key: EVENTS_BOARD_KEY,
      value: next as unknown as never,
      updated_at: new Date().toISOString(),
    },
  ]);
  if (error) throw error;
};

export const useEventsBoard = (): { board: EventsBoard; loading: boolean } => {
  const [board, setBoard] = useState<EventsBoard>(EVENTS_BOARD_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchEventsBoard()
      .then((b) => { if (!cancelled) setBoard(b); })
      .finally(() => { if (!cancelled) setLoading(false); });

    const channel = supabase
      .channel("site_settings_events_board")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_settings",
          filter: `key=eq.${EVENTS_BOARD_KEY}`,
        },
        (payload) => {
          const next = (payload.new as { value?: unknown } | null)?.value;
          if (next !== undefined) setBoard(parseBoard(next));
        },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  return { board, loading };
};

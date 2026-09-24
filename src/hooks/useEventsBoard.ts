import { useSyncExternalStore } from "react";
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
  /**
   * EVENTS.ARCHIVE.1 — the day the event HAPPENS, as a local calendar date
   * (YYYY-MM-DD). Optional: a dated event archives itself the day after this
   * date; an undated event is evergreen and only the owner's manual Archive
   * moves it. Absent from every row written before this brick.
   */
  eventDate?: string;
  /**
   * EVENTS.ARCHIVE.1 — when this event entered the archive (ISO timestamp).
   * Present only on entries in `EventsBoard.archive`. For an undated event it
   * is also the purge clock's anchor: 90 days after it, the entry and its
   * media are deleted for good.
   */
  archivedAt?: string;
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
  /**
   * BANNER.TOGGLE.1 — when this banner last went ON, stamped by the admin at
   * the moment the enable switch is flipped. It is the banner's IDENTITY for
   * the visitor's X dismissal: the dismissal key hashes this stamp with the
   * text, so re-enabling a banner — even with the same words — is a NEW banner
   * and every visitor's X resets. Absent on rows written before the field
   * existed; those fall back to a text-only identity, exactly as before.
   */
  enabledAt?: string;
  /**
   * BANNER.EXPIRE.1 — the last day the banner shows, as a local calendar date
   * (YYYY-MM-DD, the same shape as an event's `eventDate`). The day after it,
   * the banner is off on every page without anyone touching the switch.
   * Absent = never expires. A separate condition from `enabled`: expiry never
   * writes the switch, and it plays no part in the X-dismissal identity.
   */
  showUntil?: string;
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
  /**
   * EVENTS.ARCHIVE.1 — events whose day has passed, or that the owner archived
   * by hand. Each carries `archivedAt`. Never rendered on any public surface;
   * the admin's Archive view lists them with Restore and Delete, and the sweep
   * purges an entry — row AND media files — 90 days past its event date
   * (`archivedAt` for undated events). Rows written before the field existed
   * parse to an empty archive. Deliberately uncapped: the purge bounds it.
   */
  archive: EventItem[];
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
  // BANNER.TOGGLE.1 — the default banner is OFF. This object is what a reader
  // gets when the row is absent OR the fetch fails, and the owner's enable
  // switch is authoritative: a client that cannot READ the switch must fail
  // DARK, never resurrect a hardcoded banner the owner may have turned off.
  mainBanner: makeBanner({
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
  archive: [],
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
    // EVENTS.ARCHIVE.1 — absent stays absent, same law as the framing fields:
    // an undated row keeps parsing to yesterday's exact object shape.
    ...(typeof v.eventDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.eventDate)
      ? { eventDate: v.eventDate }
      : {}),
    ...(typeof v.archivedAt === "string" && v.archivedAt ? { archivedAt: v.archivedAt } : {}),
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
    // BANNER.TOGGLE.1 — absent on every row written before the field existed;
    // conditional so those rows keep parsing to the same object shape.
    ...(typeof v.enabledAt === "string" && v.enabledAt ? { enabledAt: v.enabledAt } : {}),
    // BANNER.EXPIRE.1 — the same coercion as an event's `eventDate`: a malformed
    // value is dropped, and absent stays absent (the banner never expires).
    ...(typeof v.showUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.showUntil)
      ? { showUntil: v.showUntil }
      : {}),
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

  // EVENTS.ARCHIVE.1 — anything a stored row does not say means "nothing
  // archived". No cap: the 4-item law is about what a SURFACE carries, and the
  // purge is what bounds this list.
  const archive = Array.isArray(value.archive)
    ? (value.archive.map(coerceItem).filter(Boolean) as EventItem[])
    : [];

  return {
    pageVisible,
    homeVisible,
    bannerText: mainBanner.text,
    mainBanner,
    greenWorldBanner,
    titansBanner,
    items,
    archive,
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
    archive: board.archive.map((it) => mapItemLocalized(it, fn)),
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

/* ══════════════════ EVENTS.ARCHIVE.1 — the lifecycle clock ══════════════════
 *
 * All times are the CLOCK OF WHOEVER IS LOOKING. An event on the 8th is "today"
 * anywhere on earth until that viewer's own midnight; the day after, it is
 * past. The archive sweep runs on the admin's clock; the public filter runs on
 * each visitor's. A boundary-hour disagreement between them is at most one
 * day wide and always resolves in the sweep's favor on the next admin visit.
 */

/** Days an archived event survives past its date before the purge takes it. */
export const EVENT_PURGE_DAYS = 90;

/** The last millisecond of a local calendar day, from its YYYY-MM-DD name. */
const endOfLocalDay = (ymd: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
};

/** A dated event whose day is fully over. Undated events never pass. */
export const eventDatePassed = (item: EventItem, now: Date = new Date()): boolean => {
  const end = item.eventDate ? endOfLocalDay(item.eventDate) : null;
  return !!end && now.getTime() > end.getTime();
};

/**
 * BANNER.EXPIRE.1 — a banner whose show-until day is fully over, on the
 * viewer's own clock (the same midnight law as an event's date). A banner
 * without the date never expires.
 */
export const bannerExpired = (banner: PageBanner, now: Date = new Date()): boolean => {
  const end = banner.showUntil ? endOfLocalDay(banner.showUntil) : null;
  return !!end && now.getTime() > end.getTime();
};

/**
 * When the purge may take an archived entry: 90 days past its event date, or —
 * for an event that never had one — 90 days past the day it was archived.
 * `null` means "never" (no date and no stamp; nothing to count from).
 */
export const eventPurgeAt = (item: EventItem): Date | null => {
  const anchor = item.eventDate
    ? endOfLocalDay(item.eventDate)
    : item.archivedAt
      ? new Date(item.archivedAt)
      : null;
  if (!anchor || Number.isNaN(anchor.getTime())) return null;
  return new Date(anchor.getTime() + EVENT_PURGE_DAYS * 24 * 60 * 60 * 1000);
};

export const eventPurgeDue = (item: EventItem, now: Date = new Date()): boolean => {
  const at = eventPurgeAt(item);
  return !!at && now.getTime() > at.getTime();
};

/** The events a public surface may show: current ones. */
export const liveEventItems = (items: EventItem[], now: Date = new Date()): EventItem[] =>
  items.filter((it) => !eventDatePassed(it, now));

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
  // BANNER.TOGGLE.1 — echo the write into this tab's own store, so the admin's
  // switch reaches every public surface mounted beside it (header, footer, the
  // banner itself) without waiting on the realtime round trip.
  publishBoard(next);
};

/**
 * BANNER.TOGGLE.1 — ONE board store for every public reader.
 *
 * The hook used to open its own realtime channel per consumer. Five components
 * mount it at once (banner, header, footer, plus the page), and five channels
 * on the SAME topic over one socket is something the realtime server refuses:
 * measured against the live project, every duplicate ends in CHANNEL_ERROR
 * "mismatch between server and client bindings" — so no reader ever heard a
 * change even when the publication was in place. One module-level store, one
 * fetch, one channel; consumers subscribe to the store.
 *
 * The store also refetches when the tab becomes visible or focused again. The
 * owner's test is exactly this shape — flip the switch on the desk, pick the
 * phone back up — and on a phone the socket rarely survives being backgrounded,
 * so the wake-up refetch is what makes "off means off, immediately" true on the
 * physical device and not just on a machine whose websocket never slept.
 */
type BoardState = { board: EventsBoard; loading: boolean };

let boardState: BoardState = { board: EVENTS_BOARD_DEFAULT, loading: true };
const boardListeners = new Set<() => void>();
let boardStoreStarted = false;
let lastBoardFetch = 0;

/** How stale a mounting consumer will tolerate the shared board being. */
const BOARD_FRESH_MS = 2000;

const setBoardState = (next: BoardState) => {
  boardState = next;
  boardListeners.forEach((l) => l());
};

/**
 * The one door every fresh board walks through, wherever it came from.
 *
 * EVENTS.ARCHIVE.1 — the door is where the public filter lives: every consumer
 * of this hook is a public surface (the banner, the act, /events, header,
 * footer — the admin reads `fetchEventsBoard` directly), so the board they
 * share carries only CURRENT events. A dated event disappears from every
 * surface at the viewer's own midnight, whether or not the admin's sweep has
 * moved it to the archive yet.
 */
const publishBoard = (board: EventsBoard) =>
  setBoardState({ board: { ...board, items: liveEventItems(board.items) }, loading: false });

const refetchBoard = () => {
  lastBoardFetch = Date.now();
  fetchEventsBoard()
    .then(publishBoard)
    .catch(() => setBoardState({ ...boardState, loading: false }));
};

const startBoardStore = () => {
  if (boardStoreStarted || typeof window === "undefined") return;
  boardStoreStarted = true;

  refetchBoard();

  supabase
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
        if (next !== undefined) publishBoard(parseBoard(next));
      },
    )
    .subscribe();

  const onWake = () => {
    if (document.visibilityState === "visible") refetchBoard();
  };
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("focus", onWake);
};

const subscribeBoard = (listener: () => void) => {
  startBoardStore();
  // A route change mounts fresh consumers without any wake event. Each used to
  // fetch for itself; the shared store keeps that honesty with one throttled
  // refetch — the mount burst (five consumers per page) collapses to one.
  if (Date.now() - lastBoardFetch > BOARD_FRESH_MS) refetchBoard();
  boardListeners.add(listener);
  return () => boardListeners.delete(listener);
};

const getBoardState = () => boardState;

export const useEventsBoard = (): { board: EventsBoard; loading: boolean } =>
  useSyncExternalStore(subscribeBoard, getBoardState, getBoardState);

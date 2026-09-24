import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { Lang, Localized } from "@/hooks/useEventsBoard";

/**
 * HERO.EDIT.1 — the hero's words, owned by the admin.
 *
 * Joey, verbatim: "it would be really cool if you could make it so that the hero
 * statement and the subtitle and title could be edited in the admin area ... and
 * then she could change them as she sees fit." And, still in force from
 * SEO.BING.1d: "we need to make sure that it keeps the subtitle consistent on all
 * 3 page layouts."
 *
 * ONE source of truth: a single site_settings row, `hero.copy`, whose value is
 *
 *   { es: { roles, intro, title, description },
 *     en: { roles, intro, title, description },
 *     meta?: { src, pending } }
 *
 * Partial documents are legal and are the common case: any field absent or blank
 * falls back, field by field, to what the site shipped before this brick — the
 * i18n roles line and intro, and SEO.BING.1's helmet title and description
 * (reelChapters.ts's fallback law). A missing row is therefore today's site,
 * exactly. `meta` is admin bookkeeping (which slot the owner typed, which still
 * waits on a translation) and no public reader looks at it.
 *
 * Every home layout — cinematic, editorial, classic — and all three helmets read
 * the SAME resolved values through `useHeroCopy`. The public site never writes the
 * row. index.html's static shell and meta tags are build-time and are NOT fed from
 * here: a crawler that runs no JS sees the deploy-time copy until the next push.
 */
export const HERO_COPY_KEY = "hero.copy";

export const HERO_COPY_FIELDS = ["roles", "intro", "title", "description"] as const;
export type HeroCopyField = (typeof HERO_COPY_FIELDS)[number];
export type HeroCopy = Record<HeroCopyField, string>;

export type HeroCopyMeta = {
  src?: Partial<Record<HeroCopyField, Lang>>;
  pending?: Partial<Record<HeroCopyField, boolean>>;
};

export type HeroCopyDoc = {
  es: Partial<HeroCopy>;
  en: Partial<HeroCopy>;
  meta?: HeroCopyMeta;
};

/**
 * SEO.BING.1's helmet strings — the default search listing. The helmet was never
 * localized (SEO.tsx builds no EN variant), so an English visitor has always read
 * these same two lines; the default keeps it that way in both locales.
 */
export const HERO_TITLE_DEFAULT = "Cristyna Polentino | Actriz, Streamer y Empresaria · Medellín";
export const HERO_DESCRIPTION_DEFAULT =
  "Cristyna Polentino (Titi): actriz colombiana, streamer y empresaria en Medellín. Su portafolio de actuación, su comunidad en vivo y su proyecto con Green World.";

/** What each field reads when the row does not say, for one locale's `t`. */
export const heroCopyDefaults = (t: (key: string) => string): HeroCopy => ({
  roles: t("hero.rolesLine"),
  intro: t("hero.intro"),
  title: HERO_TITLE_DEFAULT,
  description: HERO_DESCRIPTION_DEFAULT,
});

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const asText = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

const pickFields = (v: unknown): Partial<HeroCopy> => {
  if (!isObj(v)) return {};
  const out: Partial<HeroCopy> = {};
  for (const f of HERO_COPY_FIELDS) if (typeof v[f] === "string") out[f] = v[f] as string;
  return out;
};

const pickMeta = (v: unknown): HeroCopyMeta | undefined => {
  if (!isObj(v)) return undefined;
  const src: Partial<Record<HeroCopyField, Lang>> = {};
  const pending: Partial<Record<HeroCopyField, boolean>> = {};
  for (const f of HERO_COPY_FIELDS) {
    const s = isObj(v.src) ? v.src[f] : undefined;
    if (s === "es" || s === "en") src[f] = s;
    if (isObj(v.pending) && v.pending[f] === true) pending[f] = true;
  }
  const meta: HeroCopyMeta = {};
  if (Object.keys(src).length) meta.src = src;
  if (Object.keys(pending).length) meta.pending = pending;
  return Object.keys(meta).length ? meta : undefined;
};

/**
 * The stored value, coerced. `value` is jsonb, so a well-formed row arrives as an
 * object; a JSON string (the reel chapters' storage style) is accepted too.
 * Anything unreadable is "no row" — an admin typo must never blank the hero.
 */
export const parseHeroCopyDoc = (value: unknown): HeroCopyDoc | null => {
  let v = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!isObj(v)) return null;
  const meta = pickMeta(v.meta);
  return { es: pickFields(v.es), en: pickFields(v.en), ...(meta ? { meta } : {}) };
};

/** Pure, field by field: the row's text for `lang` where it has some, else the default. */
export const resolveHeroCopy = (
  doc: HeroCopyDoc | null | undefined,
  lang: Lang,
  defaults: HeroCopy,
): HeroCopy => {
  const slot = doc?.[lang];
  return {
    roles: asText(slot?.roles) ?? defaults.roles,
    intro: asText(slot?.intro) ?? defaults.intro,
    title: asText(slot?.title) ?? defaults.title,
    description: asText(slot?.description) ?? defaults.description,
  };
};

/**
 * The admin edits each field as one `Localized` value — the Events board's
 * shape, so its single-field + translate-on-save machinery applies unchanged.
 * These two carry a document to that shape and back; `meta` is where the
 * per-field `src` / `pending` bookkeeping lives in storage.
 */
export type HeroCopyFields = Record<HeroCopyField, Localized>;

export const docToFields = (doc: HeroCopyDoc | null): HeroCopyFields => {
  const out = {} as HeroCopyFields;
  for (const f of HERO_COPY_FIELDS) {
    const v: Localized = { es: doc?.es[f] ?? "", en: doc?.en[f] ?? "" };
    const src = doc?.meta?.src?.[f];
    if (src) v.src = src;
    if (doc?.meta?.pending?.[f]) v.pending = true;
    out[f] = v;
  }
  return out;
};

/** Blank fields are simply left out: absent and blank mean the same thing. */
export const fieldsToDoc = (fields: HeroCopyFields): HeroCopyDoc => {
  const doc: HeroCopyDoc = { es: {}, en: {} };
  const src: Partial<Record<HeroCopyField, Lang>> = {};
  const pending: Partial<Record<HeroCopyField, boolean>> = {};
  for (const f of HERO_COPY_FIELDS) {
    const v = fields[f];
    const es = v.es.trim();
    const en = v.en.trim();
    if (es) doc.es[f] = es;
    if (en) doc.en[f] = en;
    if (!es && !en) continue;
    if (v.src) src[f] = v.src;
    if (v.pending) pending[f] = true;
  }
  const meta: HeroCopyMeta = {};
  if (Object.keys(src).length) meta.src = src;
  if (Object.keys(pending).length) meta.pending = pending;
  return Object.keys(meta).length ? { ...doc, meta } : doc;
};

/** A document with no text in any field of either locale says nothing at all. */
export const heroCopyDocIsEmpty = (doc: HeroCopyDoc): boolean =>
  HERO_COPY_FIELDS.every((f) => !asText(doc.es[f]) && !asText(doc.en[f]));

/**
 * Read the row. Unlike the public store below, this THROWS on a failed read: the
 * admin must never mistake "could not read" for "nothing stored" and save blanks
 * over the owner's copy.
 */
export const fetchHeroCopyDoc = async (): Promise<HeroCopyDoc | null> => {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", HERO_COPY_KEY)
    .maybeSingle();
  if (error) throw error;
  return parseHeroCopyDoc(data?.value);
};

/**
 * Persist the document. A document that says nothing DELETES the row instead —
 * the absent-key-is-default contract useCinematicHero keeps for its own key — so
 * restoring every field leaves the database exactly as it was before this brick.
 */
export const setHeroCopyDoc = async (doc: HeroCopyDoc): Promise<void> => {
  if (heroCopyDocIsEmpty(doc)) {
    const { error } = await supabase.from("site_settings").delete().eq("key", HERO_COPY_KEY);
    if (error) throw error;
    publishHeroCopy(null);
    return;
  }
  const { error } = await supabase.from("site_settings").upsert({
    key: HERO_COPY_KEY,
    value: doc as unknown as never,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  // Echo into this tab's store, so an in-app visit to `/` after saving reads the
  // new copy without waiting for a reload.
  publishHeroCopy(doc);
};

/**
 * ONE read per page load, shared by every consumer: a module-scope store (the
 * useEventsBoard shape, without the realtime channel — the brief's contract is
 * "visible on the next load", and a second channel on site_settings is exactly
 * what the realtime server refuses). The first consumer to mount starts the
 * fetch; every later one, on any layout, reads the same answer.
 */
type HeroCopyState = { doc: HeroCopyDoc | null; loaded: boolean };

let heroState: HeroCopyState = { doc: null, loaded: false };
const heroListeners = new Set<() => void>();
let heroStoreStarted = false;

const setHeroState = (next: HeroCopyState) => {
  heroState = next;
  heroListeners.forEach((l) => l());
};

const publishHeroCopy = (doc: HeroCopyDoc | null) => setHeroState({ doc, loaded: true });

const startHeroCopyStore = () => {
  if (heroStoreStarted || typeof window === "undefined") return;
  heroStoreStarted = true;
  fetchHeroCopyDoc()
    .then(publishHeroCopy)
    // A failed read serves the defaults: the public hero is never blank.
    .catch(() => setHeroState({ ...heroState, loaded: true }));
};

const subscribeHeroCopy = (listener: () => void) => {
  startHeroCopyStore();
  heroListeners.add(listener);
  return () => heroListeners.delete(listener);
};

const getHeroCopyState = () => heroState;

/** The hero copy for the active language, every field resolved. */
export const useHeroCopy = (): HeroCopy => {
  const { t, i18n } = useTranslation();
  const { doc } = useSyncExternalStore(subscribeHeroCopy, getHeroCopyState, getHeroCopyState);
  const lang: Lang = (i18n.language || "es").startsWith("en") ? "en" : "es";
  return resolveHeroCopy(doc, lang, heroCopyDefaults(t));
};

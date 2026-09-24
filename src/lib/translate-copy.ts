import { supabase } from "@/integrations/supabase/client";
import {
  forEachBoardLocalized,
  localizedText,
  mapBoardLocalized,
  type EventsBoard,
  type Lang,
  type Localized,
} from "@/hooks/useEventsBoard";

/**
 * EVENTS.I18N.1 — one field in, two locales out.
 *
 * The owner types in whichever language they think in. `translate-text` decides
 * which one that was and returns the other side; this module walks a board,
 * asks once per distinct string, and writes both slots.
 *
 * Nothing here can block a save. A string the function could not translate is
 * left exactly as the owner typed it — in BOTH slots, still `pending`, so the
 * public site never serves a stale mismatch and the next successful save heals
 * it. The caller reports the failure; it does not swallow it.
 */

export type Translation = { source: Lang; translation: string };

export const translateText = async (text: string): Promise<Translation> => {
  const { data, error } = await supabase.functions.invoke("translate-text", {
    body: { text },
  });
  if (error) throw error;
  const source = data?.source === "en" ? "en" : data?.source === "es" ? "es" : null;
  const translation = typeof data?.translation === "string" ? data.translation : "";
  if (!source || !translation.trim()) throw new Error("Empty translation");
  return { source, translation };
};

/** Fields the owner has typed into since the last successful save. */
const pendingTexts = (board: EventsBoard): string[] => {
  const seen = new Set<string>();
  forEachBoardLocalized(board, (v) => {
    if (!v.pending) return;
    const text = localizedText(v).trim();
    if (text) seen.add(text);
  });
  return [...seen];
};

const applyTranslations = (
  board: EventsBoard,
  done: Map<string, Translation>,
): EventsBoard =>
  mapBoardLocalized(board, (v): Localized => {
    if (!v.pending) return v;
    const typed = localizedText(v);
    const hit = done.get(typed.trim());
    if (!hit) return v; // translation failed — the typed text stands in both slots
    return hit.source === "es"
      ? { es: typed, en: hit.translation, src: "es" }
      : { es: hit.translation, en: typed, src: "en" };
  });

export type SyncResult = { board: EventsBoard; requested: number; failed: number };

/**
 * Fill the other locale slot for every field the owner has edited. Distinct
 * strings are translated once each, concurrently — a board is a handful of short
 * lines, not a document.
 */
export const syncBoardTranslations = async (
  board: EventsBoard,
): Promise<SyncResult> => {
  const texts = pendingTexts(board);
  if (texts.length === 0) return { board, requested: 0, failed: 0 };

  const done = new Map<string, Translation>();
  const results = await Promise.allSettled(texts.map((t) => translateText(t)));
  results.forEach((r, i) => {
    if (r.status === "fulfilled") done.set(texts[i], r.value);
  });

  return {
    board: applyTranslations(board, done),
    requested: texts.length,
    failed: texts.length - done.size,
  };
};

/**
 * HERO.EDIT.1 — the same pass over a flat record of fields (the hero copy is four
 * fields, not a board).
 *
 * HERO.EDIT.1b — and the same failure law as the board: a field whose
 * translation FAILED carries the typed text into BOTH slots and stays `pending`,
 * so the public site never serves a stale mismatch and the next save retries it.
 * (The first cut left the other slot blank, falling back to that locale's
 * default; the architect ruled for the board's behavior.) Never a blocked save.
 */
export const syncLocalizedRecord = async <K extends string>(
  fields: Record<K, Localized>,
): Promise<{ fields: Record<K, Localized>; requested: number; failed: number }> => {
  const keys = Object.keys(fields) as K[];
  const texts = [
    ...new Set(
      keys
        .filter((k) => fields[k].pending)
        .map((k) => localizedText(fields[k]).trim())
        .filter(Boolean),
    ),
  ];
  if (texts.length === 0) return { fields, requested: 0, failed: 0 };

  const done = new Map<string, Translation>();
  const results = await Promise.allSettled(texts.map((t) => translateText(t)));
  results.forEach((r, i) => {
    if (r.status === "fulfilled") done.set(texts[i], r.value);
  });

  const out = { ...fields };
  for (const k of keys) {
    const v = fields[k];
    const typed = localizedText(v);
    if (!v.pending || !typed.trim()) continue;
    const hit = done.get(typed.trim());
    if (hit) {
      out[k] =
        hit.source === "es"
          ? { es: typed, en: hit.translation, src: "es" }
          : { es: hit.translation, en: typed, src: "en" };
    } else {
      // Both slots carry what was typed — written out explicitly rather than
      // trusting `v` to already hold it, so a stored field whose other slot was
      // ever left blank heals to the board's shape on its next failed save too.
      out[k] = { ...v, es: typed, en: typed, pending: true };
    }
  }
  return { fields: out, requested: texts.length, failed: texts.length - done.size };
};

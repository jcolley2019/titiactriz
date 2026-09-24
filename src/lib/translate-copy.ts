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

/**
 * BLOG.1 — a blog body is a document, and translate-text refuses anything over
 * 2000 characters. It goes in pieces: split on blank lines, paragraphs packed
 * greedily into chunks of at most BODY_CHUNK_MAX, translated one after another,
 * and rejoined with the same separators (a blank line, in every normal case).
 *
 * A single paragraph longer than a chunk falls back to its lines, then its
 * sentences, then a hard cut — each piece remembers the separator it came
 * from, so the rejoined text has the typed text's shape.
 */
export const BODY_CHUNK_MAX = 1900;

type Atom = { text: string; sepBefore: string };

const splitOversized = (text: string, max: number, sepBefore: string): Atom[] => {
  if (text.length <= max) return [{ text, sepBefore }];
  const levels: [RegExp, string][] = [
    [/\n/, "\n"],
    [/(?<=[.!?…])[ \t]+/, " "],
  ];
  for (const [re, sep] of levels) {
    const parts = text.split(re).filter((p) => p.length > 0);
    if (parts.length > 1) {
      return parts.flatMap((p, i) => splitOversized(p, max, i === 0 ? sepBefore : sep));
    }
  }
  const out: Atom[] = [];
  for (let i = 0; i < text.length; i += max) {
    out.push({ text: text.slice(i, i + max), sepBefore: i === 0 ? sepBefore : "" });
  }
  return out;
};

/** `join(chunks, seps)` gives back the text: chunks[0] + seps[0] + chunks[1] + … */
export const chunkMarkdown = (
  text: string,
  max = BODY_CHUNK_MAX,
): { chunks: string[]; seps: string[] } => {
  const atoms: Atom[] = [];
  const re = /\n\s*\n/g;
  let last = 0;
  let sep = "";
  let m: RegExpExecArray | null;
  const push = (para: string) => {
    if (para.trim()) atoms.push(...splitOversized(para, max, atoms.length ? sep : ""));
  };
  while ((m = re.exec(text)) !== null) {
    push(text.slice(last, m.index));
    sep = "\n\n";
    last = m.index + m[0].length;
  }
  push(text.slice(last));

  const chunks: string[] = [];
  const seps: string[] = [];
  for (const atom of atoms) {
    const cur = chunks.length ? chunks[chunks.length - 1] : null;
    if (cur !== null && cur.length + atom.sepBefore.length + atom.text.length <= max) {
      chunks[chunks.length - 1] = cur + atom.sepBefore + atom.text;
    } else {
      if (cur !== null) seps.push(atom.sepBefore);
      chunks.push(atom.text);
    }
  }
  return { chunks, seps };
};

export const joinChunks = (chunks: string[], seps: string[]): string =>
  chunks.reduce((acc, c, i) => (i === 0 ? c : acc + (seps[i - 1] ?? "\n\n") + c), "");

/**
 * Translate one long Localized field chunk by chunk, sequentially (the caller
 * shows "Translating N/M…" through `onProgress`). Same failure law as
 * syncLocalizedRecord: a chunk that could not be translated carries the typed
 * text into the other slot and the field stays `pending`, so the next save
 * retries it. Never a blocked save.
 */
export const syncLocalizedLong = async (
  v: Localized,
  onProgress?: (done: number, total: number) => void,
): Promise<{ value: Localized; requested: number; failed: number }> => {
  const typed = localizedText(v);
  if (!v.pending || !typed.trim()) return { value: v, requested: 0, failed: 0 };

  const { chunks, seps } = chunkMarkdown(typed);
  const results: (Translation | null)[] = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);
    try {
      results.push(await translateText(chunks[i]));
    } catch {
      results.push(null);
    }
  }

  const failed = results.filter((r) => r === null).length;
  const source = results.find((r) => r !== null)?.source;
  if (!source) {
    return { value: { ...v, es: typed, en: typed, pending: true }, requested: chunks.length, failed };
  }
  // A chunk read as the other language (a line of names, a quote) stands as typed.
  const other = joinChunks(
    chunks.map((c, i) => (results[i]?.source === source ? results[i]!.translation : c)),
    seps,
  );
  const value: Localized =
    source === "es" ? { es: typed, en: other, src: "es" } : { es: other, en: typed, src: "en" };
  return { value: failed > 0 ? { ...value, pending: true } : value, requested: chunks.length, failed };
};

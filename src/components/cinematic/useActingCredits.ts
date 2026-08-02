import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * PORT.ACT.2 — the Acting act's data.
 *
 * Reads `acting_credits` (public SELECT under RLS; writes are admin-only) and
 * the `acting.chapter` slot in `site_settings`, both created by PORT.ACT.1a.
 *
 * Only ENABLED rows are fetched, ordered by `order_index`. Candidate C draws the
 * index numerals from POSITION in that ordered list, not from the stored
 * `order_index` value — so a gap left by disabling a row never shows up as a
 * hole in the numbering (01, 02, 04). The stored value orders; position numbers.
 *
 * This layer is READ-ONLY and never creates rows. An empty table is a legitimate
 * state, not an error: the act renders its honest empty line instead of an index.
 */

export type ActingCredit = {
  id: string;
  kind: string;
  title_es: string;
  title_en: string;
  role_es: string | null;
  role_en: string | null;
  production: string | null;
  year: number | null;
  url: string | null;
  video_id: string | null;
};

export type ActingChapterCopy = { eyebrow: string; title: string; body: string };

/** The act's own copy, overridable per-locale from `site_settings`. */
export type ActingChapterDoc = Partial<Record<"es" | "en", Partial<ActingChapterCopy>>>;

const asText = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

/**
 * Resolve the chapter copy against in-repo defaults. `site_settings.value` is
 * jsonb, so it arrives already parsed — unlike the reel's chapter keys, which
 * are stored as raw JSON strings and have to go through JSON.parse. A malformed
 * or empty value falls through to the defaults rather than blanking the act.
 */
export function resolveActingChapter(
  raw: unknown,
  locale: "es" | "en",
  defaults: ActingChapterCopy,
): ActingChapterCopy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const doc = (raw as ActingChapterDoc)[locale];
  if (!doc) return defaults;
  return {
    eyebrow: asText(doc.eyebrow) ?? defaults.eyebrow,
    title: asText(doc.title) ?? defaults.title,
    body: asText(doc.body) ?? defaults.body,
  };
}

export function useActingCredits() {
  const [credits, setCredits] = useState<ActingCredit[]>([]);
  const [chapterRaw, setChapterRaw] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Both reads in parallel and committed as one batch: the act's copy and
      // its index are a single fact, and painting the heading before the rows
      // arrive would flash a chapter with an empty panel under it.
      const [creditsRes, chapterRes] = await Promise.all([
        supabase
          .from("acting_credits")
          .select(
            "id, kind, title_es, title_en, role_es, role_en, production, year, url, video_id",
          )
          .eq("enabled", true)
          .order("order_index", { ascending: true }),
        supabase.from("site_settings").select("value").eq("key", "acting.chapter").maybeSingle(),
      ]);

      if (cancelled) return;
      setCredits(creditsRes.data ?? []);
      setChapterRaw(chapterRes.data?.value ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { credits, chapterRaw, loading };
}

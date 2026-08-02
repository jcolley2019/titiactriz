import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * PORT.SOC.9 — the Socials act's data.
 *
 * Reads `social_links` (public SELECT under RLS; writes are admin-only), only
 * ENABLED rows, ordered by `order_index`. The act draws brand marks from
 * `platform`, so that column is the join key back to PLATFORM_CATALOG.
 *
 * The `og_*` columns are the unfurl CACHE, filled by the admin Links tab. They
 * travel with the row so the act can never be tempted to fetch at render time —
 * whether any candidate composition actually paints them is an open question
 * (see the note in CinematicSocials).
 *
 * A row with no address is dropped HERE rather than in the act. That is
 * STRIP.FAKE.1's law applied at the source: nothing is ever drawn as a link
 * that goes nowhere, and a tile is nothing but a link.
 */

export type SocialLink = {
  id: string;
  platform: string;
  url: string;
  handle: string | null;
  title_es: string | null;
  title_en: string | null;
  og_title: string | null;
  og_image: string | null;
};

const COLUMNS = "id, platform, url, handle, title_es, title_en, og_title, og_image";

export function useSocialLinks() {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("social_links")
        .select(COLUMNS)
        .eq("enabled", true)
        .order("order_index", { ascending: true });

      if (cancelled) return;
      const rows = (data ?? []) as SocialLink[];
      setLinks(rows.filter((r) => typeof r.url === "string" && r.url.trim().length > 0));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { links, loading };
}

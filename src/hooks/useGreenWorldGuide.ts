import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/hooks/useEventsBoard";
import { emptyGreenWorldGuide, fetchGreenWorldGuide, type GreenWorldGuide } from "@/lib/greenworld-guide";

/**
 * GW.GUIDE.1 — the public side of the "Cómo comprar" guide, read once per
 * mount in the useBlogPosts shape: `loading` until the row answers, `failed`
 * when it will not, and the empty guide in either case so the section always
 * has something valid to render.
 */
export const useGreenWorldGuide = () => {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language || "es").startsWith("en") ? "en" : "es";
  const [guide, setGuide] = useState<GreenWorldGuide>(emptyGreenWorldGuide);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchGreenWorldGuide()
      .then((g) => {
        if (!cancelled) setGuide(g);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { guide, loading, failed, lang };
};

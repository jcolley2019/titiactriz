import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { STUDIO_PLATFORMS, type StudioOutputs, type StudioPlatform } from "./useStudioGeneration";
import { PLATFORM_LABEL } from "./StudioOutput";

/**
 * BLOG.2 — HISTORY (joeyc.ai ContentHistory): the Studio's past generations
 * from studio_generations, newest first. Click one to expand it; Reopen puts
 * its outputs back in the Generated Content tabs.
 */

export type GenerationRow = Tables<"studio_generations">;

const HISTORY_LIMIT = 50;

export const rowOutputs = (row: GenerationRow): StudioOutputs => {
  const o = (row.outputs ?? {}) as Record<string, unknown>;
  const out: StudioOutputs = {};
  if (typeof o.blog === "string") out.blog = o.blog;
  if (o.social && typeof o.social === "object") {
    const social: Partial<Record<StudioPlatform, string>> = {};
    for (const p of STUDIO_PLATFORMS) {
      const v = (o.social as Record<string, unknown>)[p];
      if (typeof v === "string") social[p] = v;
    }
    if (Object.keys(social).length) out.social = social;
  }
  return out;
};

type Props = {
  version: number;
  openId: string | null;
  onReopen: (row: GenerationRow) => void;
};

const StudioHistory = ({ version, openId, onReopen }: Props) => {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<GenerationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("studio_generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(({ data, error }) => {
        if (cancelled) return;
        setFailed(!!error);
        if (data) setRows(data);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const when = (iso: string) =>
    new Intl.DateTimeFormat((i18n.language || "es").startsWith("en") ? "en-US" : "es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  const labels = (row: GenerationRow) => {
    const o = rowOutputs(row);
    const list: string[] = [];
    if (o.blog !== undefined) list.push(t("admin.studio.tabArticle"));
    for (const p of STUDIO_PLATFORMS) if (o.social?.[p] !== undefined) list.push(PLATFORM_LABEL[p]);
    return list;
  };

  if (loading) return <p className="st-caption">…</p>;
  if (failed) return <p className="st-error">{t("admin.studio.historyLoadError")}</p>;
  if (rows.length === 0) return <p className="st-empty">{t("admin.studio.historyEmpty")}</p>;

  return (
    <div className="st-history-list" data-qa="studio-history">
      {rows.map((row) => {
        const open = expanded === row.id;
        return (
          <div
            key={row.id}
            className="st-history-item"
            data-qa="studio-history-item"
            data-open={open ? "true" : "false"}
            data-current={openId === row.id ? "true" : "false"}
          >
            <button
              type="button"
              className="st-history-summary"
              aria-expanded={open}
              onClick={() => setExpanded(open ? null : row.id)}
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                {open ? <ChevronDown className="w-4 h-4 shrink-0" aria-hidden /> : <ChevronRight className="w-4 h-4 shrink-0" aria-hidden />}
                <span className="truncate">{row.input_text.slice(0, 90)}</span>
              </span>
              <span className="st-caption">
                {when(row.created_at)} · {row.language.toUpperCase()} · {labels(row).join(", ")}
              </span>
            </button>
            {open && (
              <div className="st-history-body">
                <p className="st-caption">
                  {t("admin.studio.historyInput")} ·{" "}
                  {row.input_kind === "youtube" ? t("admin.studio.kindYoutube") : t("admin.studio.kindBrainDump")}
                  {row.source_url ? ` · ${row.source_url}` : ""}
                  {row.blog_post_id ? ` · ${t("admin.studio.historyDraft")}` : ""}
                </p>
                <div className="st-preview mt-2">{row.input_text}</div>
                <div className="st-actions">
                  <button
                    type="button"
                    className="st-btn"
                    data-qa="studio-history-reopen"
                    onClick={() => onReopen(row)}
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden />
                    {t("admin.studio.historyReopen")}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StudioHistory;

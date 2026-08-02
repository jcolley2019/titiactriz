import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { ACTING_ACT_ENABLED } from "@/lib/ventures";

/**
 * PORT.ACT.3 — the admin *portfolio* tab.
 *
 * Owns `acting_credits`: list, reorder, enable, edit, add, delete. It is the
 * only way real credits reach the site, so it is deliberately NOT gated on
 * `ACTING_ACT_ENABLED` — the act is dark precisely until this table holds
 * enough honest rows, and brick 4 flips the flag afterwards. A banner says so
 * while the act is still dark rather than letting the owner wonder why saved
 * credits do not appear.
 *
 * Save model follows the gallery panel, not the events board: this is a table
 * of rows, so text fields commit on blur, switches and reordering commit
 * immediately, and there is no global Save button to forget. Every write is
 * optimistic and reverts the row on failure.
 *
 * The section is a card that defaults open because it is the tab's only
 * content today; brick 6 adds Dance beside it under the same tab.
 */

export type ActingCreditRow = {
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
  order_index: number;
  enabled: boolean;
};

/** Selected explicitly so a later column never silently joins the editor. */
const COLUMNS =
  "id, kind, title_es, title_en, role_es, role_en, production, year, url, video_id, order_index, enabled";

/** Mirrors the table's CHECK constraint — an unlisted value is rejected by the DB. */
const KINDS = ["reel", "film", "tv", "theatre", "commercial", "document"] as const;

type TextKey =
  | "title_es"
  | "title_en"
  | "role_es"
  | "role_en"
  | "production"
  | "url"
  | "video_id";

/* ---------------- one credit ---------------- */
type RowProps = {
  row: ActingCreditRow;
  position: number;
  saved: boolean;
  isFirst: boolean;
  isLast: boolean;
  onLocalChange: (patch: Partial<ActingCreditRow>) => void;
  onCommit: (key: keyof ActingCreditRow) => void;
  onEnabledChange: (v: boolean) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
};

const CreditRow = ({
  row,
  position,
  saved,
  isFirst,
  isLast,
  onLocalChange,
  onCommit,
  onEnabledChange,
  onMove,
  onDelete,
}: RowProps) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  const text = (key: TextKey, label: string, placeholder?: string) => (
    <div className="space-y-1 min-w-0">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        data-qa={`portfolio-${key.replace(/_/g, "-")}`}
        value={row[key] ?? ""}
        placeholder={placeholder}
        onChange={(e) => onLocalChange({ [key]: e.target.value } as Partial<ActingCreditRow>)}
        onBlur={() => onCommit(key)}
      />
    </div>
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-qa="portfolio-credit"
      data-id={row.id}
      data-enabled={row.enabled ? "true" : "false"}
      className="bg-card border border-border rounded-lg p-3 md:p-4 space-y-3"
    >
      {/* Header: order, visibility, delete */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          {...attributes}
          {...listeners}
          data-qa="portfolio-drag"
          aria-label={t("admin.portfolio.dragToReorder")}
          className="hidden md:flex p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex flex-col gap-1 md:hidden shrink-0">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            data-qa="portfolio-move-up-sm"
            aria-label={t("admin.portfolio.moveUp")}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            data-qa="portfolio-move-down-sm"
            aria-label={t("admin.portfolio.moveDown")}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* The numeral the act prints: POSITION in the list, never order_index —
            a disabled row must not leave a hole in the published numbering. */}
        <span
          data-qa="portfolio-position"
          className="text-xs text-muted-foreground tabular-nums w-6 text-center shrink-0"
        >
          {String(position).padStart(2, "0")}
        </span>

        <div className="hidden md:flex gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="px-2"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            data-qa="portfolio-move-up"
            aria-label={t("admin.portfolio.moveUp")}
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="px-2"
            onClick={() => onMove(1)}
            disabled={isLast}
            data-qa="portfolio-move-down"
            aria-label={t("admin.portfolio.moveDown")}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>

        {saved && (
          <span data-qa="portfolio-saved" className="text-xs text-[hsl(var(--gold-light))]">
            {t("admin.portfolio.saved")}
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Switch
            data-qa="portfolio-enabled"
            checked={row.enabled}
            onCheckedChange={onEnabledChange}
          />
          <span className="text-xs text-muted-foreground">
            {row.enabled ? t("admin.portfolio.shown") : t("admin.portfolio.hidden")}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDelete}
            data-qa="portfolio-delete"
            aria-label={t("admin.portfolio.delete")}
            className="px-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* What the act prints today: the localized title, and whether it links. */}
      <div className="grid gap-3 md:grid-cols-2">
        {text("title_es", t("admin.portfolio.titleEs"))}
        {text("title_en", t("admin.portfolio.titleEn"))}
      </div>

      <div className="space-y-1">
        {text("url", t("admin.portfolio.url"), "https://")}
        <p className="text-xs text-muted-foreground">{t("admin.portfolio.urlHint")}</p>
      </div>

      {/* Stored with the credit, not printed by candidate C — the index is a
          title and a state. They travel with the row for the résumé surface. */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1 min-w-0">
          <Label className="text-xs text-muted-foreground">{t("admin.portfolio.kindLabel")}</Label>
          <select
            data-qa="portfolio-kind"
            value={row.kind}
            onChange={(e) => {
              onLocalChange({ kind: e.target.value });
              onCommit("kind");
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`admin.portfolio.kinds.${k}`)}
              </option>
            ))}
          </select>
        </div>
        {text("role_es", t("admin.portfolio.roleEs"))}
        {text("role_en", t("admin.portfolio.roleEn"))}
        {text("production", t("admin.portfolio.production"))}
        <div className="space-y-1 min-w-0">
          <Label className="text-xs text-muted-foreground">{t("admin.portfolio.year")}</Label>
          <Input
            data-qa="portfolio-year"
            type="number"
            inputMode="numeric"
            value={row.year ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              onLocalChange({ year: v === "" ? null : Number(v) });
            }}
            onBlur={() => onCommit("year")}
          />
        </div>
        {text("video_id", t("admin.portfolio.videoId"))}
      </div>
    </li>
  );
};

/* ---------------- the tab ---------------- */
const PortfolioManager = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ActingCreditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ActingCreditRow | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const savedTimers = useRef<Map<string, number>>(new Map());
  /** The DB truth per row — what a blur compares against and what a failure restores. */
  const committed = useRef<Map<string, ActingCreditRow>>(new Map());

  const remember = (list: ActingCreditRow[]) => {
    committed.current = new Map(list.map((r) => [r.id, { ...r }]));
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("acting_credits")
      .select(COLUMNS)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast({
        title: t("admin.portfolio.loadFailed"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    const list = (data ?? []) as ActingCreditRow[];
    remember(list);
    setRows(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timers = savedTimers.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
  }, []);

  const flashSaved = (id: string) => {
    setSavedIds((prev) => new Set(prev).add(id));
    const prevTimer = savedTimers.current.get(id);
    if (prevTimer) window.clearTimeout(prevTimer);
    savedTimers.current.set(
      id,
      window.setTimeout(() => {
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        savedTimers.current.delete(id);
      }, 1800),
    );
  };

  const patchLocal = (id: string, patch: Partial<ActingCreditRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  /**
   * Write one field. Nothing is sent when the value equals the DB truth, so
   * tabbing through a row never touches the network. A failure restores the
   * committed value rather than leaving an unsaved edit looking saved.
   */
  const commitField = async (id: string, key: keyof ActingCreditRow) => {
    const row = rows.find((r) => r.id === id);
    const base = committed.current.get(id);
    if (!row || !base) return;

    let value = row[key];
    if (key === "year" && typeof value === "number" && !Number.isFinite(value)) {
      patchLocal(id, { year: base.year });
      return;
    }
    // Empty text in a nullable column is an absent value, not an empty string.
    if (typeof value === "string" && key !== "title_es" && key !== "title_en" && key !== "kind") {
      const trimmed = value.trim();
      value = (trimmed === "" ? null : trimmed) as ActingCreditRow[typeof key];
      if (value !== row[key]) patchLocal(id, { [key]: value } as Partial<ActingCreditRow>);
    }
    if (value === base[key]) return;

    const patch = { [key]: value } as Partial<ActingCreditRow>;
    const { error } = await supabase.from("acting_credits").update(patch).eq("id", id);
    if (error) {
      patchLocal(id, { [key]: base[key] } as Partial<ActingCreditRow>);
      toast({
        title: t("admin.portfolio.saveFailed"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    committed.current.set(id, { ...base, ...patch });
    flashSaved(id);
  };

  const setEnabled = async (row: ActingCreditRow, value: boolean) => {
    patchLocal(row.id, { enabled: value });
    const { error } = await supabase
      .from("acting_credits")
      .update({ enabled: value })
      .eq("id", row.id);
    if (error) {
      patchLocal(row.id, { enabled: !value });
      toast({
        title: t("admin.portfolio.saveFailed"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    const base = committed.current.get(row.id);
    if (base) committed.current.set(row.id, { ...base, enabled: value });
    flashSaved(row.id);
  };

  /** Renumber 1..N and write only the rows whose index actually moved. */
  const persistOrder = async (next: ActingCreditRow[]) => {
    const moved = next.filter((r) => committed.current.get(r.id)?.order_index !== r.order_index);
    if (moved.length === 0) return;
    const results = await Promise.all(
      moved.map((r) =>
        supabase.from("acting_credits").update({ order_index: r.order_index }).eq("id", r.id),
      ),
    );
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) {
      toast({
        title: t("admin.portfolio.saveFailed"),
        description: firstErr.message,
        variant: "destructive",
      });
      await load();
      return;
    }
    moved.forEach((r) => {
      const base = committed.current.get(r.id);
      if (base) committed.current.set(r.id, { ...base, order_index: r.order_index });
    });
  };

  const reorder = async (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = arrayMove(rows, from, to).map((r, i) => ({ ...r, order_index: i + 1 }));
    setRows(next);
    await persistOrder(next);
  };

  const addCredit = async () => {
    setAdding(true);
    const nextIndex = rows.reduce((m, r) => Math.max(m, r.order_index), 0) + 1;
    // A new credit starts HIDDEN: a half-typed row must never reach the act.
    const { data, error } = await supabase
      .from("acting_credits")
      .insert({ kind: "reel", title_es: "", title_en: "", order_index: nextIndex, enabled: false })
      .select(COLUMNS);
    setAdding(false);
    if (error) {
      toast({
        title: t("admin.portfolio.addFailed"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    // The insert normally returns the row; if the representation is withheld,
    // refetch rather than appending a half-formed row to the list.
    const created = (Array.isArray(data) ? data[0] : null) as ActingCreditRow | null;
    if (!created?.id) {
      await load();
      return;
    }
    committed.current.set(created.id, { ...created });
    setRows((prev) => [...prev, created]);
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    const { error } = await supabase.from("acting_credits").delete().eq("id", target.id);
    if (error) {
      toast({
        title: t("admin.portfolio.deleteFailed"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    committed.current.delete(target.id);
    const next = rows
      .filter((r) => r.id !== target.id)
      .map((r, i) => ({ ...r, order_index: i + 1 }));
    setRows(next);
    await persistOrder(next);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.id === active.id);
    const to = rows.findIndex((r) => r.id === over.id);
    if (from < 0 || to < 0) return;
    await reorder(from, to);
  };

  const liveCount = rows.filter((r) => r.enabled).length;

  return (
    <div data-qa="admin-portfolio" className="pb-12">
      <section className="bg-card border border-border rounded-lg mb-10 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-6 py-3 text-left hover:bg-accent/5 transition-colors"
          aria-expanded={open}
        >
          <div className="flex items-center gap-3">
            {open ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <div>
              <h2 className="font-serif text-base text-foreground leading-tight">
                {t("admin.portfolio.sectionTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("admin.portfolio.sectionSubtitle")}
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {t("admin.portfolio.liveCount", { live: liveCount, total: rows.length })}
          </span>
        </button>

        {open && (
          <div className="px-6 pt-4 pb-6 border-t border-border space-y-4">
            {!ACTING_ACT_ENABLED && (
              <p
                data-qa="portfolio-dark-notice"
                className="text-xs text-amber-500 border border-amber-500/30 bg-amber-500/5 rounded-md px-3 py-2"
              >
                {t("admin.portfolio.darkNotice")}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addCredit}
                disabled={adding || loading}
                data-qa="portfolio-add"
              >
                {adding ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3 mr-1" />
                )}
                {t("admin.portfolio.add")}
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">{t("admin.portfolio.loading")}</p>
            ) : rows.length === 0 ? (
              <p data-qa="portfolio-empty" className="text-sm text-muted-foreground italic">
                {t("admin.portfolio.empty")}
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={rows.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-3 list-none">
                    {rows.map((row, i) => (
                      <CreditRow
                        key={row.id}
                        row={row}
                        position={i + 1}
                        saved={savedIds.has(row.id)}
                        isFirst={i === 0}
                        isLast={i === rows.length - 1}
                        onLocalChange={(patch) => patchLocal(row.id, patch)}
                        onCommit={(key) => commitField(row.id, key)}
                        onEnabledChange={(v) => setEnabled(row, v)}
                        onMove={(dir) => reorder(i, i + dir)}
                        onDelete={() => setDeleteTarget(row)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}
      </section>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.portfolio.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.portfolio.deleteBody", {
                title:
                  deleteTarget?.title_es ||
                  deleteTarget?.title_en ||
                  t("admin.portfolio.untitled"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.portfolio.deleteCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-qa="portfolio-delete-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("admin.portfolio.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PortfolioManager;

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
  RefreshCw,
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
import { PlatformIcon } from "@/components/PlatformIcon";
import { PLATFORM_CATALOG, findPlatform } from "@/lib/platform-catalog";
import { platformFromUrl } from "@/lib/platform-from-url";
import { SOCIALS_ACT_ENABLED, UNFURL_DEPLOYED } from "@/lib/ventures";

/**
 * PORT.SOC.8 — the admin *links* tab.
 *
 * Owns `social_links`: list, reorder, enable, edit, add, delete, plus the OG
 * preview cache. Same save model as the Portfolio tab, deliberately — text
 * commits on blur, switches and reordering commit immediately, every write is
 * optimistic and reverts its own row on failure, and there is no global Save
 * button to forget.
 *
 * Three things this tab has that Portfolio does not:
 *
 *   · THE CATALOG PICKER. `platform` is chosen from PLATFORM_CATALOG, grouped
 *     exactly as the catalog groups it, and the chosen label is what the act
 *     draws a brand mark from. It is a closed list on purpose: a free-text
 *     platform would render as the generic link glyph forever.
 *
 *   · URL-DRIVEN DETECTION. When a committed URL resolves to a catalog platform
 *     and the row says something else, the row ADOPTS the detected platform.
 *     The rule is stated under the field so it is never a surprise: the URL
 *     decides when it is recognised, and you pick when it is not. Detection
 *     never fires on a URL it does not recognise, so a deliberate pick against
 *     an unrecognised host stands.
 *
 *   · THE UNFURL REFRESH. One button per row calls the `unfurl` edge function
 *     and caches title/description/image into the row's `og_*` columns, so the
 *     act never fetches at render time. The function is not deployed yet
 *     (UNFURL_DEPLOYED) and the panel says so above the list — the control is
 *     real, not a mock, and starts working the moment the function ships.
 *
 * Like the Portfolio tab this is NOT gated on its act's flag: rows have to
 * exist before the Socials act can be worth turning on. A banner says the act
 * is dark rather than letting the owner wonder why saved links do not appear.
 */

export type SocialLinkRow = {
  id: string;
  platform: string;
  url: string;
  handle: string | null;
  title_es: string | null;
  title_en: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  og_fetched_at: string | null;
  order_index: number;
  enabled: boolean;
};

/** Selected explicitly so a later column never silently joins the editor. */
const COLUMNS =
  "id, platform, url, handle, title_es, title_en, og_title, og_description, og_image, og_fetched_at, order_index, enabled";

/** A new row starts on the catalog's first platform, as a new credit starts on
 *  the first kind. It is hidden, so the placeholder never reaches the site. */
const DEFAULT_PLATFORM = PLATFORM_CATALOG[0].platforms[0].label;

type TextKey = "url" | "handle" | "title_es" | "title_en";

type UnfurlPayload = {
  title?: string | null;
  description?: string | null;
  image?: string | null;
};

/* ---------------- one link ---------------- */
type RowProps = {
  row: SocialLinkRow;
  position: number;
  saved: boolean;
  refreshing: boolean;
  isFirst: boolean;
  isLast: boolean;
  onLocalChange: (patch: Partial<SocialLinkRow>) => void;
  onCommit: (key: keyof SocialLinkRow) => void;
  onPlatformChange: (label: string) => void;
  onEnabledChange: (v: boolean) => void;
  onMove: (dir: -1 | 1) => void;
  onRefresh: () => void;
  onDelete: () => void;
};

const LinkRow = ({
  row,
  position,
  saved,
  refreshing,
  isFirst,
  isLast,
  onLocalChange,
  onCommit,
  onPlatformChange,
  onEnabledChange,
  onMove,
  onRefresh,
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

  const hint = findPlatform(row.platform)?.hint;
  const handlePlaceholder = hint
    ? t(`admin.links.hints.${hint}`, { platform: row.platform })
    : undefined;

  const text = (key: TextKey, label: string, placeholder?: string) => (
    <div className="space-y-1 min-w-0">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        data-qa={`links-${key.replace(/_/g, "-")}`}
        value={row[key] ?? ""}
        placeholder={placeholder}
        onChange={(e) => onLocalChange({ [key]: e.target.value } as Partial<SocialLinkRow>)}
        onBlur={() => onCommit(key)}
      />
    </div>
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-qa="links-row"
      data-id={row.id}
      data-platform={row.platform}
      data-enabled={row.enabled ? "true" : "false"}
      className="bg-card border border-border rounded-lg p-3 md:p-4 space-y-3"
    >
      {/* Header: order, mark, visibility, delete */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          {...attributes}
          {...listeners}
          data-qa="links-drag"
          aria-label={t("admin.links.dragToReorder")}
          className="hidden md:flex p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex flex-col gap-1 md:hidden shrink-0">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            data-qa="links-move-up-sm"
            aria-label={t("admin.links.moveUp")}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            data-qa="links-move-down-sm"
            aria-label={t("admin.links.moveDown")}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        <span
          data-qa="links-position"
          className="text-xs text-muted-foreground tabular-nums w-6 text-center shrink-0"
        >
          {String(position).padStart(2, "0")}
        </span>

        {/* The mark the act will draw, drawn here too — so the picker is
            verified by eye at the moment of choosing, not after publishing. */}
        <span
          data-qa="links-mark"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-background/60 shrink-0"
        >
          <PlatformIcon label={row.platform} size={18} />
        </span>

        <div className="hidden md:flex gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="px-2"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            data-qa="links-move-up"
            aria-label={t("admin.links.moveUp")}
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
            data-qa="links-move-down"
            aria-label={t("admin.links.moveDown")}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>

        {saved && (
          <span data-qa="links-saved" className="text-xs text-[hsl(var(--gold-light))]">
            {t("admin.links.saved")}
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Switch data-qa="links-enabled" checked={row.enabled} onCheckedChange={onEnabledChange} />
          <span className="text-xs text-muted-foreground">
            {row.enabled ? t("admin.links.shown") : t("admin.links.hidden")}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDelete}
            data-qa="links-delete"
            aria-label={t("admin.links.delete")}
            className="px-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* The two fields that decide what the act draws. */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 min-w-0">
          <Label className="text-xs text-muted-foreground">{t("admin.links.platform")}</Label>
          <select
            data-qa="links-platform"
            value={row.platform}
            onChange={(e) => onPlatformChange(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {/* An off-catalog value saved before a catalog edit still shows,
                rather than silently snapping the row to the first platform. */}
            {!findPlatform(row.platform) && <option value={row.platform}>{row.platform}</option>}
            {PLATFORM_CATALOG.map((group) => (
              <optgroup key={group.key} label={t(`admin.links.groups.${group.key}`)}>
                {group.platforms.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {text("handle", t("admin.links.handle"), handlePlaceholder)}
      </div>

      <div className="space-y-1">
        {text("url", t("admin.links.url"), "https://")}
        <p className="text-xs text-muted-foreground">{t("admin.links.urlHint")}</p>
      </div>

      {/* Optional per-locale label. Empty means the act prints the platform's
          own name, which is right for almost every row. */}
      <div className="grid gap-3 md:grid-cols-2">
        {text("title_es", t("admin.links.titleEs"))}
        {text("title_en", t("admin.links.titleEn"))}
      </div>

      {/* The unfurl cache: what the act would show, and where it came from. */}
      <div
        data-qa="links-og"
        className="rounded-md border border-border/70 bg-background/40 p-3 space-y-2"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("admin.links.preview")}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={refreshing || !row.url}
            data-qa="links-refresh"
          >
            {refreshing ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            {t("admin.links.refresh")}
          </Button>
          {/* The date is rendered as its own node rather than interpolated into
              the string: i18next runs with escapeValue:true on purpose, and a
              locale-formatted date is full of slashes, which came back as
              "8&#x2F;1&#x2F;2026". React escapes this text node anyway. */}
          <span data-qa="links-og-fetched" className="text-xs text-muted-foreground">
            {row.og_fetched_at
              ? `${t("admin.links.fetchedAt")} ${new Date(row.og_fetched_at).toLocaleString()}`
              : t("admin.links.neverFetched")}
          </span>
        </div>

        {(row.og_title || row.og_image || row.og_description) && (
          <div className="flex items-start gap-3">
            {row.og_image && (
              <img
                data-qa="links-og-image"
                src={row.og_image}
                alt=""
                loading="lazy"
                className="h-14 w-14 rounded object-cover border border-border/70 shrink-0"
              />
            )}
            <div className="min-w-0">
              <p data-qa="links-og-title" className="text-sm text-foreground truncate">
                {row.og_title}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2">{row.og_description}</p>
            </div>
          </div>
        )}
      </div>
    </li>
  );
};

/* ---------------- the tab ---------------- */
const LinksManager = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<SocialLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SocialLinkRow | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const savedTimers = useRef<Map<string, number>>(new Map());
  /** The DB truth per row — what a blur compares against and what a failure restores. */
  const committed = useRef<Map<string, SocialLinkRow>>(new Map());

  const remember = (list: SocialLinkRow[]) => {
    committed.current = new Map(list.map((r) => [r.id, { ...r }]));
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("social_links")
      .select(COLUMNS)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast({
        title: t("admin.links.loadFailed"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    const list = (data ?? []) as SocialLinkRow[];
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

  const patchLocal = (id: string, patch: Partial<SocialLinkRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  /** Write a patch, revert the touched keys on failure, remember it on success. */
  const write = async (id: string, patch: Partial<SocialLinkRow>) => {
    const base = committed.current.get(id);
    if (!base) return false;
    const { error } = await supabase.from("social_links").update(patch).eq("id", id);
    if (error) {
      const revert = Object.fromEntries(
        Object.keys(patch).map((k) => [k, base[k as keyof SocialLinkRow]]),
      ) as Partial<SocialLinkRow>;
      patchLocal(id, revert);
      toast({
        title: t("admin.links.saveFailed"),
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
    committed.current.set(id, { ...base, ...patch });
    flashSaved(id);
    return true;
  };

  /**
   * Write one field. Nothing is sent when the value equals the DB truth, so
   * tabbing through a row never touches the network.
   *
   * Committing a URL also runs detection: if the URL resolves to a catalog
   * platform that the row does not already carry, the platform travels in the
   * SAME write — one round trip, and the row can never be saved pointing at
   * Instagram with a tiktok.com address.
   */
  const commitField = async (id: string, key: keyof SocialLinkRow) => {
    const row = rows.find((r) => r.id === id);
    const base = committed.current.get(id);
    if (!row || !base) return;

    let value = row[key];
    // Empty text in a nullable column is an absent value, not an empty string.
    // `url` is NOT NULL, so it keeps its empty string instead.
    if (typeof value === "string" && key !== "url" && key !== "platform") {
      const trimmed = value.trim();
      value = (trimmed === "" ? null : trimmed) as SocialLinkRow[typeof key];
      if (value !== row[key]) patchLocal(id, { [key]: value } as Partial<SocialLinkRow>);
    }
    if (typeof value === "string" && key === "url") {
      const trimmed = value.trim();
      value = trimmed as SocialLinkRow[typeof key];
      if (value !== row[key]) patchLocal(id, { url: trimmed });
    }

    const patch: Partial<SocialLinkRow> = {};
    if (value !== base[key]) Object.assign(patch, { [key]: value });

    if (key === "url") {
      const detected = platformFromUrl(String(value ?? ""));
      if (detected && detected !== row.platform) {
        patch.platform = detected;
        patchLocal(id, { platform: detected });
      }
    }

    if (Object.keys(patch).length === 0) return;
    await write(id, patch);
  };

  const setPlatform = async (row: SocialLinkRow, label: string) => {
    if (label === row.platform) return;
    patchLocal(row.id, { platform: label });
    await write(row.id, { platform: label });
  };

  const setEnabled = async (row: SocialLinkRow, value: boolean) => {
    patchLocal(row.id, { enabled: value });
    await write(row.id, { enabled: value });
  };

  /**
   * Refresh one row's OG cache through the `unfurl` edge function. The function
   * never throws to its caller and never returns a non-200, so a failure here
   * means the invoke itself failed — most likely because the function is not
   * deployed, which is exactly what the banner above the list says.
   */
  const refreshPreview = async (row: SocialLinkRow) => {
    const url = row.url.trim();
    if (!url) return;
    setRefreshingIds((prev) => new Set(prev).add(row.id));
    try {
      const { data, error } = await supabase.functions.invoke("unfurl", { body: { url } });
      if (error) {
        toast({
          title: t("admin.links.refreshFailed"),
          description: UNFURL_DEPLOYED ? error.message : t("admin.links.unfurlNotDeployed"),
          variant: "destructive",
        });
        return;
      }
      const payload = (data ?? {}) as UnfurlPayload;
      const patch: Partial<SocialLinkRow> = {
        og_title: payload.title ?? null,
        og_description: payload.description ?? null,
        og_image: payload.image ?? null,
        og_fetched_at: new Date().toISOString(),
      };
      patchLocal(row.id, patch);
      await write(row.id, patch);
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  /** Renumber 1..N and write only the rows whose index actually moved. */
  const persistOrder = async (next: SocialLinkRow[]) => {
    const moved = next.filter((r) => committed.current.get(r.id)?.order_index !== r.order_index);
    if (moved.length === 0) return;
    const results = await Promise.all(
      moved.map((r) =>
        supabase.from("social_links").update({ order_index: r.order_index }).eq("id", r.id),
      ),
    );
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) {
      toast({
        title: t("admin.links.saveFailed"),
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

  const addLink = async () => {
    setAdding(true);
    const nextIndex = rows.reduce((m, r) => Math.max(m, r.order_index), 0) + 1;
    // A new link starts HIDDEN: a half-typed row must never reach the act.
    const { data, error } = await supabase
      .from("social_links")
      .insert({ platform: DEFAULT_PLATFORM, url: "", order_index: nextIndex, enabled: false })
      .select(COLUMNS);
    setAdding(false);
    if (error) {
      toast({
        title: t("admin.links.addFailed"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    const created = (Array.isArray(data) ? data[0] : null) as SocialLinkRow | null;
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
    const { error } = await supabase.from("social_links").delete().eq("id", target.id);
    if (error) {
      toast({
        title: t("admin.links.deleteFailed"),
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
    <div data-qa="admin-links" className="pb-12">
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
                {t("admin.links.sectionTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("admin.links.sectionSubtitle")}</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {t("admin.links.liveCount", { live: liveCount, total: rows.length })}
          </span>
        </button>

        {open && (
          <div className="px-6 pt-4 pb-6 border-t border-border space-y-4">
            {!SOCIALS_ACT_ENABLED && (
              <p
                data-qa="links-dark-notice"
                className="text-xs text-amber-500 border border-amber-500/30 bg-amber-500/5 rounded-md px-3 py-2"
              >
                {t("admin.links.darkNotice")}
              </p>
            )}
            {!UNFURL_DEPLOYED && (
              <p
                data-qa="links-unfurl-notice"
                className="text-xs text-amber-500 border border-amber-500/30 bg-amber-500/5 rounded-md px-3 py-2"
              >
                {t("admin.links.unfurlNotice")}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addLink}
                disabled={adding || loading}
                data-qa="links-add"
              >
                {adding ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3 mr-1" />
                )}
                {t("admin.links.add")}
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">{t("admin.links.loading")}</p>
            ) : rows.length === 0 ? (
              <p data-qa="links-empty" className="text-sm text-muted-foreground italic">
                {t("admin.links.empty")}
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                  items={rows.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-3 list-none">
                    {rows.map((row, i) => (
                      <LinkRow
                        key={row.id}
                        row={row}
                        position={i + 1}
                        saved={savedIds.has(row.id)}
                        refreshing={refreshingIds.has(row.id)}
                        isFirst={i === 0}
                        isLast={i === rows.length - 1}
                        onLocalChange={(patch) => patchLocal(row.id, patch)}
                        onCommit={(key) => commitField(row.id, key)}
                        onPlatformChange={(label) => setPlatform(row, label)}
                        onEnabledChange={(v) => setEnabled(row, v)}
                        onMove={(dir) => reorder(i, i + dir)}
                        onRefresh={() => refreshPreview(row)}
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.links.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.links.deleteBody", {
                title: deleteTarget?.platform || t("admin.links.untitled"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.links.deleteCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-qa="links-delete-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("admin.links.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LinksManager;

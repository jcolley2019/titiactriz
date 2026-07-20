import { useEffect, useState, useCallback, useRef, useMemo, memo } from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import type { Session } from "@supabase/supabase-js";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreVertical, ChevronUp, ChevronDown, ChevronRight, Sparkles, Loader2, Eye, EyeOff, Images, Clapperboard, CalendarDays, Settings2, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  BUCKET,
  ACCEPT_ATTR,
  isHeic,
  isAcceptedFile,
  formatBytes,
  sha256Hex,
  optimizeFile,
  uploadBlob,
} from "@/lib/gallery-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LivePreviewDock from "@/components/admin/LivePreviewDock";
import HomeVariantToggle from "@/components/admin/HomeVariantToggle";
import EventsBoardManager from "@/components/admin/EventsBoardManager";
import AdminShell, { type AdminSection } from "@/components/admin/AdminShell";
import AdminSubmissionsSection from "@/components/admin/AdminSubmissionsSection";
import CinematicMediaManager from "@/components/admin/media/CinematicMediaManager";

type Photo = {
  id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_published: boolean;
  is_archived: boolean;
  content_hash: string | null;
  created_at: string;
};


/* Upload pipeline (BUCKET, accept lists, isHeic, optimizeFile, uploadBlob, …)
   lives in @/lib/gallery-upload so the cinematic media picker can reuse it. */

/* ---------------- Login ---------------- */
const LoginCard = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(t("admin.login.invalid"));
      return;
    }
    // Honor ?next= for OAuth consent (must be a same-origin relative path).
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      window.location.href = next;
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 pt-32">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-card border border-border rounded-lg p-6 shadow-[var(--shadow-card)]"
      >
        <h1 className="font-serif text-2xl text-foreground mb-1">{t("admin.login.title")}</h1>
        <p className="text-sm text-muted-foreground mb-6">{t("admin.login.subtitle")}</p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("admin.login.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("admin.login.password")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={
                  showPassword ? t("admin.login.hidePassword") : t("admin.login.showPassword")
                }
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {loading ? t("admin.login.signingIn") : t("admin.login.signIn")}
          </Button>
        </div>
      </form>
    </div>
  );
};

/* ---------------- Pipeline ---------------- */
type QueueStatus =
  | "queued"
  | "duplicate"
  | "converting"
  | "optimizing"
  | "uploading"
  | "done"
  | "failed"
  | "skipped";
type QueueItem = {
  id: string;
  name: string;
  size: number;
  status: QueueStatus;
  error?: string;
  optimizedSize?: number;
  file: File;
  sortOrder: number;
  contentHash?: string;
  duplicateOfId?: string;
};

/* ---------------- Sortable photo row ---------------- */
type SortableRowProps = {
  photo: Photo;
  position: number;
  selected: boolean;
  saved: boolean;
  generating: boolean;
  onSelectedChange: (v: boolean) => void;
  onAltChange: (v: string) => void;
  onAltBlur: () => void;
  onGenerateAlt: () => void;
  onPublishedChange: (v: boolean) => void;
  onArchive: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
};

const SortableRow = memo(({
  photo,
  position,
  selected,
  saved,
  generating,
  onSelectedChange,
  onAltChange,
  onAltBlur,
  onGenerateAlt,
  onPublishedChange,
  onArchive,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: SortableRowProps) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });
  const missingAlt = !photo.alt_text || photo.alt_text.trim() === "";
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="bg-card border border-border rounded-lg p-3 md:p-4 flex flex-col gap-3 md:grid md:gap-4 md:grid-cols-[auto_auto_auto_88px_1fr_auto_auto] md:items-center"
    >
      <div className="flex items-center gap-2 md:contents">
        <div className="flex flex-col gap-1 md:hidden shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={t("admin.photos.moveUp")}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={t("admin.photos.moveDown")}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="hidden md:flex p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none shrink-0 md:order-1"
          aria-label={t("admin.photos.dragToReorder")}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onSelectedChange(v === true)}
          className="shrink-0 md:order-2"
        />
        <span className="text-xs text-muted-foreground tabular-nums w-6 text-center shrink-0 md:order-3">
          {position}
        </span>
        <div className="flex items-center gap-2 ml-auto md:ml-0 md:order-6">
          <Switch checked={photo.is_published} onCheckedChange={onPublishedChange} />
          <span className="text-xs text-muted-foreground">
            {photo.is_published ? t("admin.photos.published") : t("admin.photos.hidden")}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" aria-label={t("admin.photos.more")} className="px-2 shrink-0 md:order-7">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onArchive()}>{t("admin.photos.archive")}</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onDelete()}
              className="text-destructive focus:text-destructive"
            >
              {t("admin.photos.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-3 md:contents">
        <img
          src={photo.image_url}
          alt={photo.alt_text ?? ""}
          className="w-28 h-28 md:w-[88px] md:h-[88px] object-cover rounded-md border border-border shrink-0 md:order-4"
          loading="lazy"
        />
        <div className="space-y-2 min-w-0 flex-1 md:order-5">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{t("admin.photos.altText")}</Label>
            {missingAlt && (
              <span
                title={t("admin.photos.needsAlt")}
                className="inline-block w-2 h-2 rounded-full bg-amber-500"
              />
            )}
            {saved && (
              <span className="text-xs text-[hsl(var(--gold-light))]">{t("admin.photos.saved")}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={photo.alt_text ?? ""}
              onChange={(e) => onAltChange(e.target.value)}
              onBlur={onAltBlur}
              disabled={generating}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onGenerateAlt}
              disabled={generating}
              title={t("admin.photos.generateAltTitle")}
              aria-label={t("admin.photos.generateAlt")}
              className="shrink-0 px-2"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
});
SortableRow.displayName = "SortableRow";

/* ---------------- Management Panel ---------------- */
const ManagePanel = () => {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rowDragging, setRowDragging] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(true);
  const [savedAltIds, setSavedAltIds] = useState<Set<string>>(new Set());
  const altSavedTimers = useRef<Map<string, number>>(new Map());
  const altLastSaved = useRef<Map<string, string>>(new Map());


  // Single-file preview flow
  const [singleUploading, setSingleUploading] = useState(false);
  const [singleStage, setSingleStage] = useState<"idle" | "converting" | "optimizing" | "uploading">("idle");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    blob: Blob;
    url: string;
    originalSize: number;
    optimizedSize: number;
    contentHash?: string;
    duplicateOfId?: string;
  } | null>(null);
  const [lastReduction, setLastReduction] = useState<string | null>(null);

  // Batch queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const closePreview = useCallback(() => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gallery_photos")
      .select("*")
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (error) {
      toast({ title: t("admin.toasts.loadFailed"), description: error.message, variant: "destructive" });
      return;
    }
    setPhotos(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateQueueItem = (id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const processItem = async (item: QueueItem) => {
    try {
      updateQueueItem(item.id, {
        status: isHeic(item.file) ? "converting" : "optimizing",
        error: undefined,
      });
      const { blob } = await optimizeFile(item.file);
      updateQueueItem(item.id, { status: "uploading", optimizedSize: blob.size });
      const image_url = await uploadBlob(blob);
      const { error: insErr } = await supabase.from("gallery_photos").insert({
        image_url,
        alt_text: null,
        sort_order: item.sortOrder,
        is_published: true,
        content_hash: item.contentHash ?? null,
      });
      if (insErr) throw insErr;
      updateQueueItem(item.id, { status: "done" });
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      updateQueueItem(item.id, { status: "failed", error: msg });
      return false;
    }
  };

  const startBatch = async (items: QueueItem[]) => {
    let nextIndex = 0;
    const worker = async () => {
      while (true) {
        const idx = nextIndex++;
        if (idx >= items.length) return;
        const it = items[idx];
        if (it.status === "duplicate" || it.status === "skipped") continue;
        await processItem(it);
      }
    };
    const concurrency = Math.min(3, items.length);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  };

  const runBatch = async (files: File[]) => {
    setBatchRunning(true);

    // Determine base sort_order
    const { data: maxRow } = await supabase
      .from("gallery_photos")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const baseSort = (maxRow?.sort_order ?? 0) + 1;

    // Compute hashes and detect duplicates against existing photos + within batch
    const existingHashes = new Map(
      photos.filter((p) => p.content_hash).map((p) => [p.content_hash as string, p.id]),
    );
    const seenInBatch = new Map<string, string>();
    const items: QueueItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      let hash: string | undefined;
      let duplicateOfId: string | undefined;
      try {
        hash = await sha256Hex(f);
        duplicateOfId = existingHashes.get(hash) ?? seenInBatch.get(hash);
        if (hash && !duplicateOfId) seenInBatch.set(hash, "pending");
      } catch {
        // ignore hash errors and let upload proceed
      }
      items.push({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        status: duplicateOfId ? "duplicate" : "queued",
        file: f,
        sortOrder: baseSort + i,
        contentHash: hash,
        duplicateOfId,
      });
    }
    setQueue(items);

    await startBatch(items);

    setBatchRunning(false);
    await load();
    toast({ title: t("admin.queue.batchComplete") });
  };

  const skipQueueItem = (id: string) => {
    updateQueueItem(id, { status: "skipped" });
  };

  const uploadDuplicateAnyway = async (id: string) => {
    let target: QueueItem | undefined;
    setQueue((prev) => {
      const next = prev.map((q) => {
        if (q.id === id) {
          target = { ...q, status: "queued" as QueueStatus };
          return target;
        }
        return q;
      });
      return next;
    });
    if (target) {
      const ok = await processItem(target);
      if (ok) await load();
    }
  };

  const retryItem = async (item: QueueItem) => {
    updateQueueItem(item.id, { status: "queued", error: undefined });
    const ok = await processItem(item);
    if (ok) await load();
  };




  const handleFiles = (fileList: FileList | File[] | null) => {
    setFileError(null);
    setLastReduction(null);
    if (!fileList) return;
    const arr = Array.from(fileList);
    if (arr.length === 0) return;

    const accepted = arr.filter(isAcceptedFile);
    const rejected = arr.length - accepted.length;
    if (rejected > 0) {
      setFileError(
        t("admin.upload.fileError", { count: rejected }),
      );
    }
    if (accepted.length === 0) {
      resetFileInput();
      return;
    }

    if (accepted.length === 1) {
      // Single-file flow: keep the preview modal
      setPendingFile(accepted[0]);
      setQueue([]);
    } else {
      // Multi-file batch
      setPendingFile(null);
      void runBatch(accepted);
      resetFileInput();
    }
  };

  const handlePrepare = async () => {
    if (!pendingFile) return;
    setSingleUploading(true);
    setLastReduction(null);
    closePreview();
    try {
      const originalSize = pendingFile.size;
      let contentHash: string | undefined;
      try {
        contentHash = await sha256Hex(pendingFile);
      } catch {
        // ignore hash errors
      }
      const duplicateOfId = contentHash
        ? photos.find((p) => p.content_hash === contentHash)?.id
        : undefined;
      setSingleStage(isHeic(pendingFile) ? "converting" : "optimizing");
      const { blob } = await optimizeFile(pendingFile);
      const url = URL.createObjectURL(blob);
      setPreview({ blob, url, originalSize, optimizedSize: blob.size, contentHash, duplicateOfId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("admin.toasts.optimizationFailedFallback");
      toast({ title: t("admin.toasts.optimizationFailed"), description: msg, variant: "destructive" });
    } finally {
      setSingleUploading(false);
      setSingleStage("idle");
    }
  };

  const confirmUpload = async () => {
    if (!preview) return;
    setSingleUploading(true);
    setSingleStage("uploading");
    try {
      const image_url = await uploadBlob(preview.blob);

      // Append at end
      const { data: maxRow } = await supabase
        .from("gallery_photos")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSort = (maxRow?.sort_order ?? 0) + 1;

      const { error: insErr } = await supabase.from("gallery_photos").insert({
        image_url,
        alt_text: null,
        sort_order: nextSort,
        is_published: true,
        content_hash: preview.contentHash ?? null,
      });
      if (insErr) throw insErr;

      const reduction = `${formatBytes(preview.originalSize)} → ${formatBytes(preview.optimizedSize)}`;
      setLastReduction(reduction);
      toast({ title: t("admin.toasts.photoUploaded"), description: t("admin.toasts.optimizedDesc", { reduction }) });
      setPendingFile(null);
      resetFileInput();
      closePreview();
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("admin.toasts.uploadFailedFallback");
      toast({ title: t("admin.toasts.uploadFailed"), description: msg, variant: "destructive" });
    } finally {
      setSingleUploading(false);
      setSingleStage("idle");
    }
  };

  const updateRow = (id: string, patch: Partial<Photo>) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const flashSaved = (id: string) => {
    setSavedAltIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const prevTimer = altSavedTimers.current.get(id);
    if (prevTimer) window.clearTimeout(prevTimer);
    const t = window.setTimeout(() => {
      setSavedAltIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      altSavedTimers.current.delete(id);
    }, 1800);
    altSavedTimers.current.set(id, t);
  };

  const [generatingAltIds, setGeneratingAltIds] = useState<Set<string>>(new Set());
  const [altBulk, setAltBulk] = useState<{ done: number; total: number } | null>(null);

  const generateAltFor = useCallback(async (photoId: string): Promise<boolean> => {
    setGeneratingAltIds((prev) => {
      const next = new Set(prev);
      next.add(photoId);
      return next;
    });
    try {
      const { data, error } = await supabase.functions.invoke("generate-alt-text", {
        body: { id: photoId },
      });
      if (error) throw error;
      const text = typeof data?.alt_text === "string" ? data.alt_text.trim() : "";
      if (!text) throw new Error(t("admin.toasts.emptyAlt"));
      setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, alt_text: text } : p)));
      altLastSaved.current.set(photoId, text);
      const { error: upErr } = await supabase
        .from("gallery_photos")
        .update({ alt_text: text })
        .eq("id", photoId);
      if (upErr) throw upErr;
      flashSaved(photoId);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.toasts.altFailedFallback");
      toast({ title: t("admin.toasts.altFailed"), description: msg, variant: "destructive" });
      return false;
    } finally {
      setGeneratingAltIds((prev) => {
        const next = new Set(prev);
        next.delete(photoId);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fillAllMissingAlt = useCallback(async () => {
    const targets = photos
      .filter((p) => !p.is_archived && (!p.alt_text || p.alt_text.trim() === ""))
      .map((p) => p.id);
    if (targets.length === 0) return;
    setAltBulk({ done: 0, total: targets.length });
    let nextIndex = 0;
    let done = 0;
    const worker = async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= targets.length) return;
        await generateAltFor(targets[i]);
        done++;
        setAltBulk({ done, total: targets.length });
      }
    };
    const concurrency = Math.min(3, targets.length);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    setAltBulk(null);
    toast({ title: t("admin.toasts.altGenerated"), description: t("admin.toasts.altGeneratedDesc", { done, total: targets.length }) });
  }, [photos, generateAltFor]);

  const saveAltText = async (photo: Photo) => {
    const current = photo.alt_text ?? "";
    if (altLastSaved.current.get(photo.id) === current) return;
    altLastSaved.current.set(photo.id, current);
    const { error } = await supabase
      .from("gallery_photos")
      .update({ alt_text: current })
      .eq("id", photo.id);
    if (error) {
      toast({ title: t("admin.toasts.saveFailed"), description: error.message, variant: "destructive" });
      return;
    }
    flashSaved(photo.id);
  };

  const togglePublished = async (photo: Photo, value: boolean) => {
    updateRow(photo.id, { is_published: value });
    const { error } = await supabase
      .from("gallery_photos")
      .update({ is_published: value })
      .eq("id", photo.id);
    if (error) {
      updateRow(photo.id, { is_published: !value });
      toast({ title: t("admin.toasts.updateFailed"), description: error.message, variant: "destructive" });
    }
  };

  const setArchived = async (photo: Photo, archived: boolean) => {
    const prev = photos;
    setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, is_archived: archived } : p)));
    const { error } = await (supabase
      .from("gallery_photos") as unknown as {
      update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
    })
      .update({ is_archived: archived })
      .eq("id", photo.id);
    if (error) {
      setPhotos(prev);
      const msg = error instanceof Error ? error.message : t("admin.toasts.updateFailedFallback");
      toast({ title: t("admin.toasts.updateFailed"), description: msg, variant: "destructive" });
      return;
    }
    toast({ title: archived ? t("admin.toasts.archived") : t("admin.toasts.restored") });
  };

  const persistOrder = async (orderedIds: string[]) => {
    // Sequential sort_order 1..N for active photos
    const updates = orderedIds.map((id, i) =>
      supabase.from("gallery_photos").update({ sort_order: i + 1 }).eq("id", id),
    );
    const results = await Promise.all(updates);
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) {
      toast({ title: t("admin.toasts.reorderFailed"), description: firstErr.message, variant: "destructive" });
      await load();
    }
  };

  const pathFromUrl = (url: string): string | null => {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const photo = deleteTarget;
    setDeleteTarget(null);
    const path = pathFromUrl(photo.image_url);
    try {
      if (path) {
        const { error: stErr } = await supabase.storage.from(BUCKET).remove([path]);
        if (stErr) throw stErr;
      }
      const { error: dbErr } = await supabase.from("gallery_photos").delete().eq("id", photo.id);
      if (dbErr) throw dbErr;
      toast({ title: t("admin.toasts.deleted") });
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("admin.toasts.deleteFailedFallback");
      toast({ title: t("admin.toasts.deleteFailed"), description: msg, variant: "destructive" });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const activePhotos = useMemo(
    () =>
      photos
        .filter((p) => !p.is_archived)
        .sort((a, b) => a.sort_order - b.sort_order),
    [photos],
  );
  const archivedPhotos = useMemo(
    () =>
      photos
        .filter((p) => p.is_archived)
        .sort((a, b) => a.sort_order - b.sort_order),
    [photos],
  );
  // Stable signature: only fields that affect the preview visually/order.
  // Editing alt text MUST NOT change this signature, or the dock marquee restarts.
  const livePreviewSignature = useMemo(
    () =>
      photos
        .filter((p) => !p.is_archived && p.is_published)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => `${p.id}|${p.image_url}|${p.sort_order}`)
        .join("~"),
    [photos],
  );
  const livePreviewPhotos = useMemo(
    () =>
      photos
        .filter((p) => !p.is_archived && p.is_published)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({ id: p.id, image_url: p.image_url, alt_text: p.alt_text })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [livePreviewSignature],
  );
  const activePhotoIds = useMemo(() => activePhotos.map((p) => p.id), [activePhotos]);

  const doneCount = queue.filter((q) => q.status === "done").length;
  const failedCount = queue.filter((q) => q.status === "failed").length;
  const duplicateCount = queue.filter((q) => q.status === "duplicate").length;
  const missingAltCount = activePhotos.filter((p) => !p.alt_text || p.alt_text.trim() === "").length;
  const allSelected = activePhotos.length > 0 && selected.size === activePhotos.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleSelect = (id: string, value: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (value: boolean) => {
    setSelected(value ? new Set(activePhotos.map((p) => p.id)) : new Set());
  };

  const bulkSetPublished = async (value: boolean) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const prev = photos;
    setPhotos((ps) => ps.map((p) => (selected.has(p.id) ? { ...p, is_published: value } : p)));
    const { error } = await supabase
      .from("gallery_photos")
      .update({ is_published: value })
      .in("id", ids);
    setBulkBusy(false);
    if (error) {
      setPhotos(prev);
      toast({ title: t("admin.toasts.bulkUpdateFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: value ? t("admin.toasts.publishedSelected") : t("admin.toasts.hiddenSelected"), description: t("admin.toasts.bulkDesc", { count: ids.length }) });
    setSelected(new Set());
  };

  const moveActivePhoto = async (id: string, dir: -1 | 1) => {
    const index = activePhotoIds.indexOf(id);
    if (index < 0) return;
    const target = index + dir;
    if (target < 0 || target >= activePhotos.length) return;
    const newActive = arrayMove(activePhotos, index, target).map((p, i) => ({
      ...p,
      sort_order: i + 1,
    }));
    setPhotos((prev) => {
      const archived = prev.filter((p) => p.is_archived);
      return [...newActive, ...archived];
    });
    await persistOrder(newActive.map((p) => p.id));
  };

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDndDragStart = (_e: DragStartEvent) => {
    setRowDragging(true);
  };

  const onDndDragEnd = async (e: DragEndEvent) => {
    setRowDragging(false);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = activePhotoIds.indexOf(String(active.id));
    const newIndex = activePhotoIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const newActive = arrayMove(activePhotos, oldIndex, newIndex).map((p, i) => ({
      ...p,
      sort_order: i + 1,
    }));
    setPhotos((prev) => {
      const archived = prev.filter((p) => p.is_archived);
      return [...newActive, ...archived];
    });
    await persistOrder(newActive.map((p) => p.id));
  };



  return (
    <div className={galleryOpen ? "pb-[340px]" : "pb-12"}>
      {/* Gallery (collapsible) */}
      <section className="bg-card border border-border rounded-lg mb-10 overflow-hidden">
        <button
          type="button"
          onClick={() => setGalleryOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-6 py-3 text-left hover:bg-accent/5 transition-colors"
          aria-expanded={galleryOpen}
        >
          <div className="flex items-center gap-3">
            {galleryOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <div>
              <h2 className="font-serif text-base text-foreground leading-tight">Gallery</h2>
              <p className="text-xs text-muted-foreground">Upload, manage, and reorder your photos.</p>
            </div>
          </div>
        </button>
        {galleryOpen && (
          <div className="px-6 pt-4 pb-2 border-t border-border">
      {/* Upload */}
      <section className="mb-8">
        <h2 className="font-serif text-xl text-foreground mb-4">{t("admin.upload.title")}</h2>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? "border-accent bg-accent/10"
              : "border-border bg-background/40 hover:border-accent/50"
          }`}
        >
          <p className="text-sm text-foreground mb-1">
            {t("admin.upload.dropHere")}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {t("admin.upload.formats")}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={batchRunning}
          >
            {t("admin.upload.selectFiles")}
          </Button>
        </div>

        {fileError && <p className="mt-3 text-sm text-destructive">{fileError}</p>}
        {lastReduction && !singleUploading && (
          <p className="mt-3 text-sm text-[hsl(var(--gold-light))]">
            {t("admin.upload.optimized")}: {lastReduction}
          </p>
        )}

        {pendingFile && !preview && (
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {t("admin.upload.selected")}: <span className="text-foreground">{pendingFile.name}</span> ·{" "}
              {formatBytes(pendingFile.size)}
            </p>
            <Button
              onClick={handlePrepare}
              disabled={singleUploading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {singleStage === "converting"
                ? t("admin.upload.converting")
                : singleStage === "optimizing"
                  ? t("admin.upload.optimizing")
                  : singleStage === "uploading"
                    ? t("admin.upload.uploading")
                    : t("admin.upload.previewUpload")}
            </Button>
          </div>
        )}

        {queue.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground mb-3">
              {t("admin.queue.summary", { done: doneCount, total: queue.length })}
              {failedCount > 0 ? t("admin.queue.failedSuffix", { count: failedCount }) : ""}
              {duplicateCount > 0 ? t("admin.queue.duplicatesSuffix", { count: duplicateCount }) : ""}
            </p>
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {queue.map((q) => (
                <li
                  key={q.id}
                  className="text-sm border border-border rounded-md px-3 py-2 bg-background/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-foreground flex-1 min-w-0">{q.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={
                          q.status === "done"
                            ? "text-[hsl(var(--gold-light))]"
                            : q.status === "failed"
                              ? "text-destructive"
                              : q.status === "duplicate"
                                ? "text-amber-500"
                                : q.status === "skipped"
                                  ? "text-muted-foreground/70"
                                  : "text-muted-foreground"
                        }
                      >
                        {q.status === "queued" && t("admin.queue.queued")}
                        {q.status === "duplicate" && t("admin.queue.possibleDuplicate")}
                        {q.status === "converting" && t("admin.queue.converting")}
                        {q.status === "optimizing" && t("admin.queue.optimizing")}
                        {q.status === "uploading" && t("admin.queue.uploading")}
                        {q.status === "done" &&
                          `${t("admin.queue.done")}${q.optimizedSize ? ` · ${formatBytes(q.optimizedSize)}` : ""}`}
                        {q.status === "failed" && t("admin.queue.failed", { error: q.error ?? t("admin.queue.errorFallback") })}
                        {q.status === "skipped" && t("admin.queue.skipped")}
                      </span>
                      {q.status === "failed" && (
                        <Button size="sm" variant="outline" onClick={() => retryItem(q)}>
                          {t("admin.queue.retry")}
                        </Button>
                      )}
                    </div>
                  </div>
                  {q.status === "duplicate" && (
                    <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        {t("admin.queue.duplicateHint")}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => skipQueueItem(q.id)}>
                          {t("admin.queue.skip")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => uploadDuplicateAnyway(q.id)}
                        >
                          {t("admin.queue.addAnyway")}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* List */}
      <section>
        <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h2 className="font-serif text-xl text-foreground">
              {t("admin.photos.heading")}{" "}
              <span className="text-sm text-muted-foreground font-sans">
                {t("admin.photos.count", { count: activePhotos.length })}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t("admin.photos.liveCount", { count: activePhotos.length })}
            </p>
            {missingAltCount > 0 && (
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5 align-middle" />
                  {t("admin.photos.missingAlt", { count: missingAltCount })}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fillAllMissingAlt}
                  disabled={altBulk !== null}
                  className="gap-2"
                >
                  {altBulk ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t("admin.photos.fillProgress", { done: altBulk.done, total: altBulk.total })}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      {t("admin.photos.fillAll")}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">{t("admin.photos.loading")}</p>
        ) : activePhotos.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("admin.photos.empty")}</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3 p-3 bg-card border border-border rounded-lg flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleSelectAll(v === true)}
                />
                <span className="text-muted-foreground">
                  {selected.size > 0 ? t("admin.photos.selectedCount", { count: selected.size }) : t("admin.photos.selectAll")}
                </span>
              </label>
              <div className="flex gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selected.size === 0 || bulkBusy}
                  onClick={() => bulkSetPublished(true)}
                >
                  {t("admin.photos.publishSelected")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selected.size === 0 || bulkBusy}
                  onClick={() => bulkSetPublished(false)}
                >
                  {t("admin.photos.hideSelected")}
                </Button>
              </div>
            </div>
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragStart={onDndDragStart}
              onDragEnd={onDndDragEnd}
            >
              <SortableContext
                items={activePhotoIds}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-3 list-none">
                  {activePhotos.map((p, i) => (
                    <SortableRow
                      key={p.id}
                      photo={p}
                      position={i + 1}
                      selected={selected.has(p.id)}
                      saved={savedAltIds.has(p.id)}
                      generating={generatingAltIds.has(p.id)}
                      onGenerateAlt={() => generateAltFor(p.id)}
                      onSelectedChange={(v) => toggleSelect(p.id, v)}
                      onAltChange={(v) => updateRow(p.id, { alt_text: v })}
                      onAltBlur={() => saveAltText(p)}
                      onPublishedChange={(v) => togglePublished(p, v)}
                      onArchive={() => setArchived(p, true)}
                      onDelete={() => setDeleteTarget(p)}
                      onMoveUp={() => moveActivePhoto(p.id, -1)}
                      onMoveDown={() => moveActivePhoto(p.id, 1)}
                      isFirst={i === 0}
                      isLast={i === activePhotos.length - 1}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}

        {/* Archived drawer */}
        {archivedPhotos.length > 0 && (
          <div className="mt-10 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => setArchivedOpen((v) => !v)}
              className="flex items-center gap-2 text-sm text-foreground hover:text-accent transition-colors"
              aria-expanded={archivedOpen}
            >
              {archivedOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              {t("admin.photos.archived")} ({archivedPhotos.length})
            </button>
            {archivedOpen && (
              <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {archivedPhotos.map((p) => (
                  <li
                    key={p.id}
                    className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2"
                  >
                    <img
                      src={p.image_url}
                      alt={p.alt_text ?? ""}
                      loading="lazy"
                      className="w-full aspect-square object-cover rounded-md border border-border"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate">
                        {p.alt_text || t("admin.photos.untitled")}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setArchived(p, false)}
                      >
                        {t("admin.photos.restore")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
          </div>
        )}
      </section>



      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("admin.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open && !singleUploading) closePreview();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("admin.previewDialog.title")}</DialogTitle>
            <DialogDescription>
              {preview && (
                t("admin.previewDialog.description", {
                  from: formatBytes(preview.originalSize),
                  to: formatBytes(preview.optimizedSize),
                })
              )}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <>
              {preview.duplicateOfId && (
                <p className="text-xs text-amber-500">
                  {t("admin.previewDialog.duplicateHint")}
                </p>
              )}
              <div className="flex items-center justify-center bg-muted/30 rounded-md overflow-hidden">
                <img
                  src={preview.url}
                  alt={t("admin.previewDialog.previewAlt")}
                  className="max-h-[60vh] w-auto object-contain"
                />
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closePreview} disabled={singleUploading}>
              {t("admin.previewDialog.cancel")}
            </Button>
            <Button
              onClick={confirmUpload}
              disabled={singleUploading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {singleStage === "uploading" ? t("admin.previewDialog.uploading") : t("admin.previewDialog.confirmUpload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {galleryOpen && (
        <LivePreviewDock photos={livePreviewPhotos} isDragging={rowDragging} />
      )}
    </div>
  );
};

/* ---------------- Sections ---------------- */
/**
 * Build the admin shell's sections. Existing panels are re-parented here as-is
 * (ITEM 0: wrap, don't rewrite) — Gallery hosts the untouched gallery monolith,
 * Settings groups the site-config cards, Events hosts the board manager, Media
 * is the new native manager, and Submissions is a reserved placeholder.
 */
const adminSections = (t: (key: string) => string): AdminSection[] => [
  {
    id: "gallery",
    label: t("admin.shell.sections.gallery"),
    icon: <Images />,
    content: <ManagePanel />,
  },
  {
    id: "media",
    label: t("admin.shell.sections.media"),
    icon: <Clapperboard />,
    content: <CinematicMediaManager />,
  },
  {
    id: "events",
    label: t("admin.shell.sections.events"),
    icon: <CalendarDays />,
    content: <EventsBoardManager />,
  },
  {
    id: "settings",
    label: t("admin.shell.sections.settings"),
    icon: <Settings2 />,
    content: (
      <div className="space-y-2">
        <HomeVariantToggle />
        {/* TA.8a-b: the cinematic hero picker moved into the Media section (its
            Hero slot chooses AND frames the image, reading the legacy
            cinematic_hero_photo through the resolver). A bilingual pointer is
            left here so the old location still guides admins to the new home. */}
        <div
          data-qa="settings-media-note"
          className="rounded-lg border border-border bg-card px-6 py-4"
        >
          <h2 className="font-serif text-base text-foreground leading-tight">
            {t("admin.settings.heroMovedTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.settings.heroMovedBody")}
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "submissions",
    label: t("admin.shell.sections.submissions"),
    icon: <Inbox />,
    content: <AdminSubmissionsSection />,
  },
];

/* ---------------- Page ---------------- */
const Admin = () => {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Auto sign-out after 15 minutes of inactivity
  useEffect(() => {
    if (!session) return;
    const TIMEOUT_MS = 15 * 60 * 1000;
    let timer: number;

    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        await supabase.auth.signOut();
        toast({
          title: t("admin.toasts.signedOut"),
          description: t("admin.toasts.signedOutDesc"),
        });
      }, TIMEOUT_MS);
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [session]);

  return (
    <>
      <Helmet>
        <title>Admin – Cristina Polentino</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="min-h-[80vh] bg-background">
        {checking ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
          </div>
        ) : session ? (
          <AdminShell
            title={t("admin.shell.title")}
            subtitle={t("admin.shell.subtitle")}
            logOutLabel={t("admin.header.logOut")}
            onSignOut={signOut}
            sections={adminSections(t)}
          />
        ) : (
          <LoginCard />
        )}
      </div>
    </>
  );
};

export default Admin;

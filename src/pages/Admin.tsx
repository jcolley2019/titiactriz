import { useEffect, useState, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import imageCompression from "browser-image-compression";
import type { Session } from "@supabase/supabase-js";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, MoreVertical, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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


const BUCKET = "gallery";
const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const ACCEPT_ATTR = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

const isHeic = (file: File) => {
  const type = (file.type || "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
};

const isAcceptedFile = (file: File) =>
  ACCEPTED.includes((file.type || "").toLowerCase()) || isHeic(file);

const formatBytes = (b: number) =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

/* ---------------- Login ---------------- */
const LoginCard = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Invalid email or password. Please try again.");
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 pt-32">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-card border border-border rounded-lg p-6 shadow-[var(--shadow-card)]"
      >
        <h1 className="font-serif text-2xl text-foreground mb-1">Admin</h1>
        <p className="text-sm text-muted-foreground mb-6">Sign in to manage the gallery.</p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {loading ? "Signing in…" : "Sign in"}
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

const sha256Hex = async (file: File): Promise<string> => {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const optimizeFile = async (file: File): Promise<{ blob: Blob; converted: boolean }> => {
  let working: File | Blob = file;
  let converted = false;
  if (isHeic(file)) {
    const mod = await import("heic2any");
    const heic2any = mod.default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const jpegBlob = Array.isArray(out) ? out[0] : out;
    working = new File([jpegBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
      type: "image/jpeg",
    });
    converted = true;
  }
  const blob = await imageCompression(working as File, {
    maxWidthOrHeight: 2400,
    fileType: "image/webp",
    initialQuality: 0.85,
    maxSizeMB: 1.0,
    useWebWorker: true,
    preserveExif: false,
  });
  return { blob, converted };
};

const uploadBlob = async (blob: Blob): Promise<string> => {
  const path = `photos/${crypto.randomUUID()}.webp`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: false, contentType: "image/webp" });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
};

/* ---------------- Sortable photo row ---------------- */
type SortableRowProps = {
  photo: Photo;
  position: number;
  selected: boolean;
  saved: boolean;
  onSelectedChange: (v: boolean) => void;
  onAltChange: (v: string) => void;
  onAltBlur: () => void;
  onPublishedChange: (v: boolean) => void;
  onArchive: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

const SortableRow = ({
  photo,
  position,
  selected,
  saved,
  onSelectedChange,
  onAltChange,
  onAltBlur,
  onPublishedChange,
  onArchive,
  onDelete,
  onDragStart,
  onDragEnd,
}: SortableRowProps) => {
  const controls = useDragControls();
  const missingAlt = !photo.alt_text || photo.alt_text.trim() === "";
  return (
    <Reorder.Item
      value={photo}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-card border border-border rounded-lg p-4 grid gap-4 md:grid-cols-[auto_auto_auto_88px_1fr_auto_auto] md:items-center"
    >
      <button
        type="button"
        onPointerDown={(e) => {
          controls.start(e);
          onDragStart();
        }}
        className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <Checkbox
        checked={selected}
        onCheckedChange={(v) => onSelectedChange(v === true)}
      />
      <span className="text-xs text-muted-foreground tabular-nums w-6 text-center">
        {position}
      </span>
      <img
        src={photo.image_url}
        alt={photo.alt_text ?? ""}
        className="object-cover rounded-md border border-border"
        style={{ width: 88, height: 88 }}
        loading="lazy"
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Alt text</Label>
          {missingAlt && (
            <span
              title="Needs alt text"
              className="inline-block w-2 h-2 rounded-full bg-amber-500"
            />
          )}
          {saved && (
            <span className="text-xs text-[hsl(var(--gold-light))]">Saved</span>
          )}
        </div>
        <Input
          value={photo.alt_text ?? ""}
          onChange={(e) => onAltChange(e.target.value)}
          onBlur={onAltBlur}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={photo.is_published} onCheckedChange={onPublishedChange} />
        <span className="text-xs text-muted-foreground">
          {photo.is_published ? "Published" : "Hidden"}
        </span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" aria-label="More" className="px-2">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onArchive()}>Archive</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onDelete()}
            className="text-destructive focus:text-destructive"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Reorder.Item>
  );
};

/* ---------------- Management Panel ---------------- */
const ManagePanel = ({ onSignOut }: { onSignOut: () => void }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rowDragging, setRowDragging] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
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
      toast({ title: "Failed to load photos", description: error.message, variant: "destructive" });
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
    toast({ title: "Batch complete" });
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
        `${rejected} file(s) skipped — unsupported type. Allowed: JPEG, PNG, WebP, HEIC/HEIF.`,
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
      const msg = e instanceof Error ? e.message : "Optimization failed";
      toast({ title: "Optimization failed", description: msg, variant: "destructive" });
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
      toast({ title: "Photo uploaded", description: `Optimized: ${reduction}` });
      setPendingFile(null);
      resetFileInput();
      closePreview();
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
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

  const saveAltText = async (photo: Photo) => {
    const current = photo.alt_text ?? "";
    if (altLastSaved.current.get(photo.id) === current) return;
    altLastSaved.current.set(photo.id, current);
    const { error } = await supabase
      .from("gallery_photos")
      .update({ alt_text: current })
      .eq("id", photo.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
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
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
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
      const msg = error instanceof Error ? error.message : "Update failed";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: archived ? "Archived" : "Restored" });
  };

  const persistOrder = async (orderedIds: string[]) => {
    // Sequential sort_order 1..N for active photos
    const updates = orderedIds.map((id, i) =>
      supabase.from("gallery_photos").update({ sort_order: i + 1 }).eq("id", id),
    );
    const results = await Promise.all(updates);
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) {
      toast({ title: "Reorder failed", description: firstErr.message, variant: "destructive" });
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
      toast({ title: "Deleted" });
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const activePhotos = photos
    .filter((p) => !p.is_archived)
    .sort((a, b) => a.sort_order - b.sort_order);
  const archivedPhotos = photos
    .filter((p) => p.is_archived)
    .sort((a, b) => a.sort_order - b.sort_order);
  const livePreviewPhotos = activePhotos
    .filter((p) => p.is_published)
    .map((p) => ({ id: p.id, image_url: p.image_url, alt_text: p.alt_text }));

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
      toast({ title: "Bulk update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: value ? "Published selected" : "Hidden selected", description: `${ids.length} photo(s) updated` });
    setSelected(new Set());
  };

  const handleReorder = (newOrder: Photo[]) => {
    // Replace active subset in photos array with new order; archived untouched
    setPhotos((prev) => {
      const archived = prev.filter((p) => p.is_archived);
      const updated = newOrder.map((p, i) => ({ ...p, sort_order: i + 1 }));
      return [...updated, ...archived];
    });
  };

  const onReorderEnd = async () => {
    setRowDragging(false);
    await persistOrder(activePhotos.map((p) => p.id));
  };



  return (
    <div className="max-w-5xl mx-auto px-4 pt-32 pb-[260px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Gallery Admin</h1>
          <p className="text-sm text-muted-foreground">Manage gallery photos.</p>
        </div>
        <Button variant="outline" onClick={onSignOut}>
          Log out
        </Button>
      </div>

      {/* Upload */}
      <section className="bg-card border border-border rounded-lg p-6 mb-10">
        <h2 className="font-serif text-xl text-foreground mb-4">Upload photos</h2>

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
            Drag &amp; drop photos here
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            JPEG, PNG, WebP, or HEIC/HEIF · multiple files OK
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
            Select files
          </Button>
        </div>

        {fileError && <p className="mt-3 text-sm text-destructive">{fileError}</p>}
        {lastReduction && !singleUploading && (
          <p className="mt-3 text-sm text-[hsl(var(--gold-light))]">
            Optimized: {lastReduction}
          </p>
        )}

        {pendingFile && !preview && (
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Selected: <span className="text-foreground">{pendingFile.name}</span> ·{" "}
              {formatBytes(pendingFile.size)}
            </p>
            <Button
              onClick={handlePrepare}
              disabled={singleUploading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {singleStage === "converting"
                ? "Converting…"
                : singleStage === "optimizing"
                  ? "Optimizing…"
                  : singleStage === "uploading"
                    ? "Uploading…"
                    : "Preview & upload"}
            </Button>
          </div>
        )}

        {queue.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground mb-3">
              {doneCount} of {queue.length} uploaded
              {failedCount > 0 ? ` · ${failedCount} failed` : ""}
              {duplicateCount > 0 ? ` · ${duplicateCount} possible duplicate${duplicateCount === 1 ? "" : "s"}` : ""}
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
                        {q.status === "queued" && "Queued"}
                        {q.status === "duplicate" && "Possible duplicate"}
                        {q.status === "converting" && "Converting…"}
                        {q.status === "optimizing" && "Optimizing…"}
                        {q.status === "uploading" && "Uploading…"}
                        {q.status === "done" &&
                          `Done${q.optimizedSize ? ` · ${formatBytes(q.optimizedSize)}` : ""}`}
                        {q.status === "failed" && `Failed: ${q.error ?? "error"}`}
                        {q.status === "skipped" && "Skipped"}
                      </span>
                      {q.status === "failed" && (
                        <Button size="sm" variant="outline" onClick={() => retryItem(q)}>
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                  {q.status === "duplicate" && (
                    <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        Looks like a duplicate of a photo you already have.
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => skipQueueItem(q.id)}>
                          Skip
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => uploadDuplicateAnyway(q.id)}
                        >
                          Add anyway
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
              Photos{" "}
              <span className="text-sm text-muted-foreground font-sans">
                · {activePhotos.length} photo{activePhotos.length === 1 ? "" : "s"}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {activePhotos.length} live — galleries look best around 20 to 30.
            </p>
            {missingAltCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5 align-middle" />
                {missingAltCount} photo{missingAltCount === 1 ? "" : "s"} missing alt text
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : activePhotos.length === 0 ? (
          <p className="text-muted-foreground text-sm">No photos yet.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3 p-3 bg-card border border-border rounded-lg flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleSelectAll(v === true)}
                />
                <span className="text-muted-foreground">
                  {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                </span>
              </label>
              <div className="flex gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selected.size === 0 || bulkBusy}
                  onClick={() => bulkSetPublished(true)}
                >
                  Publish selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selected.size === 0 || bulkBusy}
                  onClick={() => bulkSetPublished(false)}
                >
                  Hide selected
                </Button>
              </div>
            </div>
            <Reorder.Group
              axis="y"
              values={activePhotos}
              onReorder={handleReorder}
              className="space-y-3 list-none"
            >
              {activePhotos.map((p, i) => (
                <SortableRow
                  key={p.id}
                  photo={p}
                  position={i + 1}
                  selected={selected.has(p.id)}
                  saved={savedAltIds.has(p.id)}
                  onSelectedChange={(v) => toggleSelect(p.id, v)}
                  onAltChange={(v) => updateRow(p.id, { alt_text: v })}
                  onAltBlur={() => saveAltText(p)}
                  onPublishedChange={(v) => togglePublished(p, v)}
                  onArchive={() => setArchived(p, true)}
                  onDelete={() => setDeleteTarget(p)}
                  onDragStart={() => setRowDragging(true)}
                  onDragEnd={onReorderEnd}
                />
              ))}
            </Reorder.Group>
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
              Archived ({archivedPhotos.length})
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
                        {p.alt_text || "Untitled"}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setArchived(p, false)}
                      >
                        Restore
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>



      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the database row and the file from storage. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
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
            <DialogTitle>Review optimized photo</DialogTitle>
            <DialogDescription>
              {preview && (
                <>
                  {formatBytes(preview.originalSize)} → {formatBytes(preview.optimizedSize)} ·
                  WebP, max 2400px
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="flex items-center justify-center bg-muted/30 rounded-md overflow-hidden">
              <img
                src={preview.url}
                alt="Optimized preview"
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closePreview} disabled={singleUploading}>
              Cancel
            </Button>
            <Button
              onClick={confirmUpload}
              disabled={singleUploading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {singleStage === "uploading" ? "Uploading…" : "Confirm & upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LivePreviewDock
        photos={photos
          .filter((p) => p.is_published)
          .map((p) => ({ id: p.id, image_url: p.image_url, alt_text: p.alt_text }))}
      />
    </div>
  );
};

/* ---------------- Page ---------------- */
const Admin = () => {
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
          title: "Signed out",
          description: "You were logged out after 15 minutes of inactivity.",
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
          <ManagePanel onSignOut={signOut} />
        ) : (
          <LoginCard />
        )}
      </div>
    </>
  );
};

export default Admin;

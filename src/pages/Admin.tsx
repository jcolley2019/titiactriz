import { useEffect, useState, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import imageCompression from "browser-image-compression";
import type { Session } from "@supabase/supabase-js";
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

type Photo = {
  id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_published: boolean;
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
type QueueStatus = "queued" | "converting" | "optimizing" | "uploading" | "done" | "failed";
type QueueItem = {
  id: string;
  name: string;
  size: number;
  status: QueueStatus;
  error?: string;
  optimizedSize?: number;
  file: File;
  sortOrder: number;
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

/* ---------------- Management Panel ---------------- */
const ManagePanel = ({ onSignOut }: { onSignOut: () => void }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Single-file preview flow
  const [singleUploading, setSingleUploading] = useState(false);
  const [singleStage, setSingleStage] = useState<"idle" | "converting" | "optimizing" | "uploading">("idle");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    blob: Blob;
    url: string;
    originalSize: number;
    optimizedSize: number;
  } | null>(null);
  const [lastReduction, setLastReduction] = useState<string | null>(null);

  // Batch queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null);

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

  const runBatch = async (files: File[]) => {
    setBatchRunning(true);
    const items: QueueItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      status: "queued",
    }));
    setQueue(items);

    // Determine base sort_order
    const { data: maxRow } = await supabase
      .from("gallery_photos")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const baseSort = (maxRow?.sort_order ?? 0) + 1;

    let nextIndex = 0;
    const tasks = files.map((file, i) => ({ file, item: items[i], orderIndex: i }));

    const worker = async () => {
      while (true) {
        const idx = nextIndex++;
        if (idx >= tasks.length) return;
        const { file, item, orderIndex } = tasks[idx];
        try {
          if (isHeic(file)) {
            updateQueueItem(item.id, { status: "converting" });
          } else {
            updateQueueItem(item.id, { status: "optimizing" });
          }
          const { blob } = await optimizeFile(file);
          updateQueueItem(item.id, { status: "uploading", optimizedSize: blob.size });
          const image_url = await uploadBlob(blob);
          const { error: insErr } = await supabase.from("gallery_photos").insert({
            image_url,
            alt_text: null,
            sort_order: baseSort + orderIndex,
            is_published: true,
          });
          if (insErr) throw insErr;
          updateQueueItem(item.id, { status: "done" });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Failed";
          updateQueueItem(item.id, { status: "failed", error: msg });
        }
      }
    };

    const concurrency = Math.min(3, tasks.length);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    setBatchRunning(false);
    await load();
    toast({ title: "Batch complete" });
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
      setSingleStage(isHeic(pendingFile) ? "converting" : "optimizing");
      const { blob } = await optimizeFile(pendingFile);
      const url = URL.createObjectURL(blob);
      setPreview({ blob, url, originalSize, optimizedSize: blob.size });
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

  const saveRow = async (photo: Photo) => {
    const { error } = await supabase
      .from("gallery_photos")
      .update({
        alt_text: photo.alt_text,
        sort_order: Number(photo.sort_order) || 0,
      })
      .eq("id", photo.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
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

  const doneCount = queue.filter((q) => q.status === "done").length;
  const failedCount = queue.filter((q) => q.status === "failed").length;

  return (
    <div className="max-w-5xl mx-auto px-4 pt-32 pb-10">
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
            </p>
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {queue.map((q) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between gap-3 text-sm border border-border rounded-md px-3 py-2 bg-background/40"
                >
                  <span className="truncate text-foreground">{q.name}</span>
                  <span
                    className={
                      q.status === "done"
                        ? "text-[hsl(var(--gold-light))]"
                        : q.status === "failed"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }
                  >
                    {q.status === "queued" && "Queued"}
                    {q.status === "converting" && "Converting…"}
                    {q.status === "optimizing" && "Optimizing…"}
                    {q.status === "uploading" && "Uploading…"}
                    {q.status === "done" &&
                      `Done${q.optimizedSize ? ` · ${formatBytes(q.optimizedSize)}` : ""}`}
                    {q.status === "failed" && `Failed: ${q.error ?? "error"}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* List */}
      <section>
        <h2 className="font-serif text-xl text-foreground mb-4">Photos</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : photos.length === 0 ? (
          <p className="text-muted-foreground text-sm">No photos yet.</p>
        ) : (
          <ul className="space-y-3">
            {photos.map((p) => (
              <li
                key={p.id}
                className="bg-card border border-border rounded-lg p-4 grid gap-4 md:grid-cols-[88px_1fr_120px_auto_auto] md:items-center"
              >
                <img
                  src={p.image_url}
                  alt={p.alt_text ?? ""}
                  className="object-cover rounded-md border border-border"
                  style={{ width: 88, height: 88 }}
                  loading="lazy"
                />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Alt text</Label>
                  <Input
                    value={p.alt_text ?? ""}
                    onChange={(e) => updateRow(p.id, { alt_text: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Sort order</Label>
                  <Input
                    type="number"
                    value={p.sort_order}
                    onChange={(e) => updateRow(p.id, { sort_order: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={p.is_published}
                    onCheckedChange={(v) => togglePublished(p, v)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {p.is_published ? "Published" : "Hidden"}
                  </span>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => saveRow(p)}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteTarget(p)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
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

import { useEffect, useState, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import imageCompression from "browser-image-compression";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

/* ---------------- Management Panel ---------------- */
const ManagePanel = ({ onSignOut }: { onSignOut: () => void }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<"idle" | "optimizing" | "uploading">("idle");
  const [lastReduction, setLastReduction] = useState<string | null>(null);
  const [newAlt, setNewAlt] = useState("");
  const [newSort, setNewSort] = useState<number>(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null);
  const [preview, setPreview] = useState<{
    blob: Blob;
    url: string;
    originalSize: number;
    optimizedSize: number;
  } | null>(null);

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

  const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

  const onFilePick = (file: File | null) => {
    setLastReduction(null);
    if (!file) {
      setPendingFile(null);
      setFileError(null);
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      setPendingFile(null);
      setFileError(
        "Unsupported image type. Please use JPEG, PNG, or WebP (HEIC from iPhone isn't supported — export as JPEG first).",
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFileError(null);
    setPendingFile(file);
  };

  const formatBytes = (b: number) =>
    b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

  const handlePrepare = async () => {
    if (!pendingFile) {
      toast({ title: "Pick a file first", variant: "destructive" });
      return;
    }
    setUploading(true);
    setUploadStage("optimizing");
    setLastReduction(null);
    closePreview();
    try {
      const originalSize = pendingFile.size;
      const optimized = await imageCompression(pendingFile, {
        maxWidthOrHeight: 2400,
        fileType: "image/webp",
        initialQuality: 0.85,
        maxSizeMB: 1.0,
        useWebWorker: true,
        preserveExif: false,
      });
      const url = URL.createObjectURL(optimized);
      setPreview({ blob: optimized, url, originalSize, optimizedSize: optimized.size });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Optimization failed";
      toast({ title: "Optimization failed", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadStage("idle");
    }
  };

  const confirmUpload = async () => {
    if (!preview) return;
    setUploading(true);
    setUploadStage("uploading");
    try {
      const path = `photos/${crypto.randomUUID()}.webp`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, preview.blob, { upsert: false, contentType: "image/webp" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const image_url = pub.publicUrl;

      const { error: insErr } = await supabase.from("gallery_photos").insert({
        image_url,
        alt_text: newAlt || null,
        sort_order: Number(newSort) || 0,
        is_published: true,
      });
      if (insErr) throw insErr;

      const reduction = `${formatBytes(preview.originalSize)} → ${formatBytes(preview.optimizedSize)}`;
      setLastReduction(reduction);
      toast({ title: "Photo uploaded", description: `Optimized: ${reduction}` });
      setPendingFile(null);
      setNewAlt("");
      setNewSort(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      closePreview();
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadStage("idle");
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
    // Public URL format: https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
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
        <h2 className="font-serif text-xl text-foreground mb-4">Upload new photo</h2>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="file">Image file</Label>
            <Input
              id="file"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onFilePick(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alt">Alt text</Label>
            <Input
              id="alt"
              value={newAlt}
              onChange={(e) => setNewAlt(e.target.value)}
              placeholder="Describe the photo"
            />
          </div>
          <div className="space-y-2 w-28">
            <Label htmlFor="sort">Sort</Label>
            <Input
              id="sort"
              type="number"
              value={newSort}
              onChange={(e) => setNewSort(Number(e.target.value))}
            />
          </div>
        </div>
        {fileError && (
          <p className="mt-3 text-sm text-destructive">{fileError}</p>
        )}
        {lastReduction && !uploading && (
          <p className="mt-3 text-sm text-[hsl(var(--gold-light))]">
            Optimized: {lastReduction}
          </p>
        )}
        <div className="mt-4">
          <Button
            onClick={handlePrepare}
            disabled={uploading || !pendingFile}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {uploadStage === "optimizing"
              ? "Optimizing…"
              : uploadStage === "uploading"
                ? "Uploading…"
                : "Preview & upload"}
          </Button>
        </div>

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
                  className="w-22 h-22 object-cover rounded-md border border-border"
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
                    onChange={(e) =>
                      updateRow(p.id, { sort_order: Number(e.target.value) })
                    }
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
              This removes the database row and the file from storage. This cannot be
              undone.
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
          if (!open && !uploading) closePreview();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review optimized photo</DialogTitle>
            <DialogDescription>
              {preview && (
                <>
                  {formatBytes(preview.originalSize)} → {formatBytes(preview.optimizedSize)} ·
                  WebP, max 1600px
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
            <Button variant="outline" onClick={closePreview} disabled={uploading}>
              Cancel
            </Button>
            <Button
              onClick={confirmUpload}
              disabled={uploading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {uploadStage === "uploading" ? "Uploading…" : "Confirm & upload"}
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

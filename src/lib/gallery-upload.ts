import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared gallery upload pipeline. Extracted verbatim from Admin.tsx's ManagePanel
 * (ADMIN.MEDIA.1) so the cinematic media picker can reuse the exact optimize →
 * upload path instead of duplicating it. Behavior is unchanged for the gallery.
 */

export const BUCKET = "gallery";

export const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
export const ACCEPT_ATTR =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export const isHeic = (file: File) => {
  const type = (file.type || "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
};

export const isAcceptedFile = (file: File) =>
  ACCEPTED.includes((file.type || "").toLowerCase()) || isHeic(file);

export const formatBytes = (b: number) =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

export const sha256Hex = async (file: File): Promise<string> => {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const SKIP_COMPRESS_BYTES = 600 * 1024; // images already <= 600KB are uploaded untouched

export const optimizeFile = async (file: File): Promise<{ blob: Blob; converted: boolean }> => {
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
  // Already small enough -> keep the original as-is, no re-compression.
  if (!converted && file.size <= SKIP_COMPRESS_BYTES) {
    return { blob: file, converted: false };
  }
  const blob = await imageCompression(working as File, {
    maxWidthOrHeight: 3200,
    fileType: "image/webp",
    initialQuality: 0.92,
    maxSizeMB: 4,
    useWebWorker: true,
    preserveExif: false,
  });
  return { blob, converted };
};

export const uploadBlob = async (blob: Blob): Promise<string> => {
  const type = blob.type || "image/webp";
  const ext =
    type === "image/jpeg" ? "jpg" :
    type === "image/png" ? "png" :
    "webp";
  const path = `photos/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: false, contentType: type });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
};

export type UploadedGalleryPhoto = {
  id: string;
  image_url: string;
  alt_text: string | null;
};

/**
 * Single-file convenience path for the media picker's "Upload new" tile:
 * optimize → upload → insert one published gallery_photos row at the end of the
 * order, returning the created row so the caller can auto-select it.
 */
export const uploadGalleryPhoto = async (file: File): Promise<UploadedGalleryPhoto> => {
  const { blob } = await optimizeFile(file);
  const image_url = await uploadBlob(blob);

  const { data: maxRow } = await supabase
    .from("gallery_photos")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (maxRow?.sort_order ?? 0) + 1;

  let contentHash: string | null = null;
  try {
    contentHash = await sha256Hex(file);
  } catch {
    // hashing is best-effort dedupe metadata; never block the upload on it
  }

  const { data, error } = await supabase
    .from("gallery_photos")
    .insert({
      image_url,
      alt_text: null,
      sort_order: nextSort,
      is_published: true,
      content_hash: contentHash,
    })
    .select("id, image_url, alt_text")
    .single();
  if (error) throw error;
  return data as UploadedGalleryPhoto;
};

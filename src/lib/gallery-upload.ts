import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";
import { WEB_MAX_SIDE } from "@/lib/photo-srcset";

/**
 * Shared gallery upload pipeline. Extracted verbatim from Admin.tsx's ManagePanel
 * (ADMIN.MEDIA.1) so the cinematic media picker can reuse the exact optimize →
 * upload path instead of duplicating it. Behavior is unchanged for the gallery.
 *
 * MEDIA.PHOTO.1 — every call site now goes through prepareGalleryUpload +
 * uploadGalleryAssets, which keep the creator's full-resolution MASTER beside
 * the optimized WEB file (see photo-srcset.ts for how the two are served).
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

/**
 * MEDIA.RES.0 — the source width below which a photo may read soft once the
 * wide reel act paints it at plate size. GUIDANCE ONLY: nothing validates,
 * blocks, or rejects on this number, and it is never stored. It exists so the
 * threshold the admin warns at is stated once in code; the owner-facing copy
 * that quotes 1600 / 2000 lives in the locale files.
 */
export const RECOMMENDED_SOURCE_WIDTH = 1600;

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

/**
 * MEDIA.PHOTO.1 — the master cap, after HEIC conversion: the Supabase project's
 * upload limit. A larger original is REFUSED out loud — never silently
 * downscaled into something that is no longer the original.
 */
export const MASTER_MAX_MB = 50;
export const MASTER_MAX_BYTES = MASTER_MAX_MB * 1024 * 1024;

export class MasterTooLargeError extends Error {
  /** The master's size, formatted for the owner-facing refusal. */
  readonly size: string;
  constructor(bytes: number) {
    super(`The original is ${formatBytes(bytes)}; the limit is ${MASTER_MAX_MB} MB.`);
    this.name = "MasterTooLargeError";
    this.size = formatBytes(bytes);
  }
}

/** HEIC/HEIF → JPEG at full resolution (heic2any never resizes). */
const heicToJpeg = async (file: File, quality: number): Promise<File> => {
  const mod = await import("heic2any");
  const heic2any = mod.default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality });
  const jpegBlob = Array.isArray(out) ? out[0] : out;
  return new File([jpegBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
    type: "image/jpeg",
  });
};

/** WEB — the 3200px WebP q0.92 pipeline. */
const toWebFile = (source: File): Promise<Blob> =>
  imageCompression(source, {
    maxWidthOrHeight: WEB_MAX_SIDE,
    fileType: "image/webp",
    initialQuality: 0.92,
    maxSizeMB: 4,
    useWebWorker: true,
    preserveExif: false,
  });

const SOI = 0xffd8;
const SOS = 0xffda;
const APP1 = 0xffe1;
const EXIF_HEADER = 0x45786966; // "Exif"
const TAG_ORIENTATION = 0x0112;

/** The EXIF Orientation (2–8) inside one APP1 payload, or null for none/upright. */
const exifOrientation = (view: DataView, start: number, end: number): number | null => {
  if (start + 14 > end || view.getUint32(start) !== EXIF_HEADER || view.getUint16(start + 4) !== 0) {
    return null; // XMP or another APP1 flavour — no orientation here
  }
  const tiff = start + 6;
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const le = order === 0x4949;
  if (view.getUint16(tiff + 2, le) !== 42) return null;
  const ifd0 = tiff + view.getUint32(tiff + 4, le);
  if (ifd0 + 2 > end) return null;
  const count = view.getUint16(ifd0, le);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > end) return null;
    if (view.getUint16(entry, le) !== TAG_ORIENTATION) continue;
    const value = view.getUint16(entry + 8, le); // SHORT, left-justified in the value field
    return value >= 2 && value <= 8 ? value : null;
  }
  return null;
};

/**
 * A minimal EXIF APP1 that carries ONLY the Orientation tag: big-endian TIFF
 * header, one IFD0 entry (0x0112 SHORT ×1), no next IFD.
 */
const orientationApp1 = (orientation: number): Uint8Array =>
  new Uint8Array([
    0xff, 0xe1, 0x00, 0x22, // APP1, length 34
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // "MM", 42, IFD0 at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]);

/**
 * MEDIA.PHOTO.1 — lossless JPEG metadata strip. Walks the marker segments up to
 * SOS and drops every APP1 (EXIF and XMP: GPS, camera, serial, dates); the
 * scan data is copied byte-for-byte, nothing is re-encoded. A non-upright EXIF
 * Orientation survives as a minimal APP1 holding that one tag (Joey's ruling),
 * so a camera portrait stored as sideways pixels still displays upright. Any
 * JPEG the walk can't read is returned untouched rather than risk the photo.
 */
export const stripJpegMetadata = async (blob: Blob): Promise<Blob> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 4 || view.getUint16(0) !== SOI) return blob;

  const kept: Uint8Array[] = [];
  let orientation: number | null = null;
  let stripped = false;
  let offset = 2;
  for (;;) {
    if (offset + 2 > bytes.length) return blob; // no SOS: not a JPEG we can walk
    if (bytes[offset] !== 0xff) return blob;
    if (bytes[offset + 1] === 0xff) {
      offset += 1; // fill byte before a marker
      continue;
    }
    const marker = view.getUint16(offset);
    if (marker === SOS) break;
    const standalone = marker === 0xff01 || (marker >= 0xffd0 && marker <= 0xffd7);
    const end = standalone ? offset + 2 : offset + 2 + view.getUint16(offset + 2);
    if (!standalone && offset + 4 > bytes.length) return blob;
    if (end > bytes.length) return blob;
    if (marker === APP1) {
      stripped = true;
      orientation = exifOrientation(view, offset + 4, end) ?? orientation;
    } else {
      kept.push(bytes.subarray(offset, end));
    }
    offset = end;
  }
  if (!stripped) return blob;

  return new Blob(
    [
      bytes.subarray(0, 2),
      ...(orientation ? [orientationApp1(orientation)] : []),
      ...kept,
      bytes.subarray(offset), // SOS, scan data, EOI and anything after — untouched
    ],
    { type: "image/jpeg" },
  );
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** The PNG chunks that carry metadata: EXIF and the three text flavours (XMP rides in iTXt). */
const PNG_METADATA_CHUNKS = new Set(["eXIf", "tEXt", "iTXt", "zTXt"]);

/**
 * MEDIA.PHOTO.1a — lossless PNG metadata strip: walks the chunks up to IEND
 * and drops eXIf, tEXt, iTXt and zTXt. Every other chunk (IHDR, IDAT, the colour
 * chunks, APNG frames) is copied byte-for-byte with its own CRC, so nothing is
 * re-encoded. A PNG the walk can't read is returned untouched.
 */
export const stripPngMetadata = async (blob: Blob): Promise<Blob> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 8 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) return blob;

  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let stripped = false;
  let offset = 8;
  for (;;) {
    if (offset + 12 > bytes.length) return blob; // no IEND: not a PNG we can walk
    const end = offset + 12 + view.getUint32(offset); // length, type, data, CRC
    if (end > bytes.length) return blob;
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (PNG_METADATA_CHUNKS.has(type)) stripped = true;
    else kept.push(bytes.subarray(offset, end));
    offset = end;
    if (type === "IEND") break;
  }
  return stripped ? new Blob(kept, { type: "image/png" }) : blob;
};

/** VP8X flag bits for the metadata chunks: EXIF (E) and XMP (X). */
const VP8X_EXIF_FLAG = 0x08;
const VP8X_XMP_FLAG = 0x04;

/**
 * MEDIA.PHOTO.1a — lossless WebP metadata strip: walks the RIFF chunks, drops
 * EXIF and "XMP ", clears their two VP8X flag bits and rewrites the RIFF size.
 * The image chunks (VP8/VP8L, ALPH, ANIM/ANMF, ICCP) are copied byte-for-byte.
 * A WebP the walk can't read is returned untouched.
 */
export const stripWebpMetadata = async (blob: Blob): Promise<Blob> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fourcc = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (bytes.length < 12 || fourcc(0) !== "RIFF" || fourcc(8) !== "WEBP") return blob;

  const riffEnd = Math.min(bytes.length, 8 + view.getUint32(4, true));
  const kept: Uint8Array[] = [];
  let stripped = false;
  let offset = 12;
  while (offset + 8 <= riffEnd) {
    const size = view.getUint32(offset + 4, true);
    if (offset + 8 + size > riffEnd) return blob;
    const next = Math.min(riffEnd, offset + 8 + size + (size & 1)); // chunks pad to even
    const type = fourcc(offset);
    if (type === "EXIF" || type === "XMP ") {
      stripped = true;
    } else if (type === "VP8X" && size >= 10) {
      const vp8x = bytes.slice(offset, next);
      vp8x[8] &= ~(VP8X_EXIF_FLAG | VP8X_XMP_FLAG);
      kept.push(vp8x);
    } else {
      kept.push(bytes.subarray(offset, next));
    }
    offset = next;
  }
  if (!stripped) return blob;

  const header = bytes.slice(0, 12);
  new DataView(header.buffer).setUint32(4, 4 + kept.reduce((n, c) => n + c.length, 0), true);
  return new Blob([header, ...kept], { type: "image/webp" });
};

/** Lossless metadata strip for the three master formats; anything else passes through. */
const stripMetadata = (source: File): Promise<Blob> | Blob =>
  source.type === "image/jpeg" ? stripJpegMetadata(source)
  : source.type === "image/png" ? stripPngMetadata(source)
  : source.type === "image/webp" ? stripWebpMetadata(source)
  : source;

/** The master's display size, decoded once (an <img> honours EXIF orientation). */
const decodeSize = async (blob: Blob): Promise<{ width: number; height: number }> => {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
};

export type PreparedGalleryUpload = {
  /** The optimized web file — or the original itself on the ≤600 KB skip path. */
  web: Blob;
  /** The full-resolution original; null when the web file already IS the original. */
  master: Blob | null;
  /** The master's decoded dimensions; null with no master. */
  width: number | null;
  height: number | null;
};

/**
 * MEDIA.PHOTO.1 — two files per upload, Instagram/YouTube style.
 *
 *  - MASTER: the creator's original. HEIC/HEIF → JPEG q0.95 at full size; JPEG,
 *    PNG and WebP → metadata stripped losslessly (stripMetadata), so no master
 *    carries GPS. Over MASTER_MAX_BYTES it is refused with MasterTooLargeError.
 *  - WEB: today's 3200px WebP q0.92 pipeline, from the same source. A HEIC is
 *    converted once and both files come from that one conversion.
 *
 * A non-HEIC file at or under SKIP_COMPRESS_BYTES is already the web file, so it
 * travels alone — one file is enough.
 */
export const prepareGalleryUpload = async (file: File): Promise<PreparedGalleryUpload> => {
  if (!isHeic(file) && file.size <= SKIP_COMPRESS_BYTES) {
    return { web: file, master: null, width: null, height: null };
  }
  const source = isHeic(file) ? await heicToJpeg(file, 0.95) : file;
  const master = await stripMetadata(source);
  if (master.size > MASTER_MAX_BYTES) throw new MasterTooLargeError(master.size);
  const { width, height } = await decodeSize(master);
  const web = await toWebFile(source);
  return { web, master, width, height };
};

export const uploadBlob = async (blob: Blob, folder: "photos" | "masters" = "photos"): Promise<string> => {
  const type = blob.type || "image/webp";
  const ext =
    type === "image/jpeg" ? "jpg" :
    type === "image/png" ? "png" :
    "webp";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: false, contentType: type });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
};

export type GalleryAssets = {
  image_url: string;
  master_url: string | null;
  master_width: number | null;
  master_height: number | null;
  /**
   * The master existed but its upload failed: the row keeps the web file only
   * and the caller warns. Not a column — destructure it off before inserting.
   */
  masterFailed: boolean;
};

/**
 * Upload the web file FIRST, then the master. A failed master never loses the
 * photo: the web upload stands and the row is written without a master.
 */
export const uploadGalleryAssets = async (prepared: PreparedGalleryUpload): Promise<GalleryAssets> => {
  const image_url = await uploadBlob(prepared.web);
  const webOnly = { image_url, master_url: null, master_width: null, master_height: null };
  if (!prepared.master) return { ...webOnly, masterFailed: false };
  try {
    const master_url = await uploadBlob(prepared.master, "masters");
    return {
      image_url,
      master_url,
      master_width: prepared.width,
      master_height: prepared.height,
      masterFailed: false,
    };
  } catch {
    return { ...webOnly, masterFailed: true };
  }
};

export type UploadedGalleryPhoto = {
  id: string;
  image_url: string;
  alt_text: string | null;
};

/**
 * Single-file convenience path for the media picker's "Upload new" tile:
 * prepare → upload → insert one published gallery_photos row at the end of the
 * order, returning the created row so the caller can auto-select it, plus
 * whether the master was lost on the way (the caller warns).
 */
export const uploadGalleryPhoto = async (
  file: File,
): Promise<{ photo: UploadedGalleryPhoto; masterFailed: boolean }> => {
  const prepared = await prepareGalleryUpload(file);
  const { masterFailed, ...assets } = await uploadGalleryAssets(prepared);

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
      ...assets,
      alt_text: null,
      sort_order: nextSort,
      is_published: true,
      content_hash: contentHash,
    })
    .select("id, image_url, alt_text")
    .single();
  if (error) throw error;
  return { photo: data as UploadedGalleryPhoto, masterFailed };
};

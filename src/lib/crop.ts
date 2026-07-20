// Shared crop-engine utilities. Ported near-verbatim from the TitiLinks editor
// (src/lib/crop.ts) for ADMIN.MEDIA.1. Two local adaptations, per spec:
//   1. `Area` is defined locally instead of imported from `react-easy-crop`
//      (that dependency isn't installed here — the cinematic framing model is
//      non-destructive focal+zoom, so the cropper package isn't needed).
//   2. The error-cause keys point at this project's dictionaries
//      (admin.media.crop.*) rather than TitiLinks' editor.crop.*.
//
// getCroppedImage's decode-safety is what the framing editor relies on when it
// measures a photo's natural dimensions before allowing a drag.

/** Pixel rectangle in source-image coordinates (mirrors react-easy-crop's Area). */
export type Area = { x: number; y: number; width: number; height: number };

// Error truth: map a thrown crop/decode error to a concise i18n cause-hint key
// so a SecurityError (tainted canvas), a not-yet-loaded resource, and a decode
// failure can be told apart. Callers render t(cropErrorCauseKey(err)); keys live
// in both en/es dictionaries under admin.media.crop.*.
export const cropErrorCauseKey = (err: unknown): string => {
  const e = err as { name?: string; message?: string } | undefined;
  const name = e?.name || "";
  const msg = (e?.message || "").toLowerCase();
  if (name === "SecurityError" || msg.includes("tainted") || msg.includes("cross-origin"))
    return "admin.media.crop.causeTainted";
  if (
    msg.includes("model") ||
    msg.includes("loadfromuri") ||
    msg.includes("weights") ||
    msg.includes("not loaded") ||
    msg.includes("/models")
  )
    return "admin.media.crop.causeModel";
  if (
    name === "EncodingError" ||
    msg.includes("decode") ||
    msg.includes("image load") ||
    msg.includes("load failed")
  )
    return "admin.media.crop.causeDecode";
  return "admin.media.crop.causeUnknown";
};

/**
 * Decode an image URL safely, resolving only once real pixels are available.
 * Waits on a genuine decode() and falls back to onload for engines whose
 * decode() rejects a valid data URL; a real failure throws so the caller's catch
 * can surface a decode cause hint. Extracted so the framing editor can reuse the
 * exact readiness guarantee before reading naturalWidth/Height.
 */
export const decodeImage = async (imageSrc: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageSrc;
  try {
    await image.decode();
  } catch {
    await new Promise<void>((resolve, reject) => {
      if (image.complete) {
        image.naturalWidth ? resolve() : reject(new Error("Image decode failed"));
        return;
      }
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image decode failed"));
    });
  }
  return image;
};

export const getCroppedImage = async (imageSrc: string, pixelCrop: Area): Promise<File> => {
  const image = await decodeImage(imageSrc);
  const canvas = document.createElement("canvas");
  const maxSize = 800;
  const scaleX = image.naturalWidth / image.width || 1;
  const scaleY = image.naturalHeight / image.height || 1;
  let cropWidth = pixelCrop.width;
  let cropHeight = pixelCrop.height;
  if (cropWidth > maxSize || cropHeight > maxSize) {
    const ratio = Math.min(maxSize / cropWidth, maxSize / cropHeight);
    cropWidth = Math.round(cropWidth * ratio);
    cropHeight = Math.round(cropHeight * ratio);
  }
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    cropWidth,
    cropHeight,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Crop failed"));
          return;
        }
        resolve(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.8,
    );
  });
};

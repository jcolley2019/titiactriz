/**
 * DEVICE_PRESETS — the single, canonical source of truth for the media editor's
 * device-truthful preview (ADMIN.MEDIA.1). Ported near-verbatim from the
 * TitiLinks editor (src/lib/device-presets.ts).
 *
 * `width` / `height` are LOGICAL CSS-viewport pixels (what a page's CSS sees),
 * NOT physical pixels — that is the number the preview frame renders at and the
 * number a frame aspect must be derived from. `dpr` is the device pixel ratio
 * (physical / logical) for reference only; the preview does not upscale by it.
 *
 * iPhone logical sizes are exact; Android logical sizes vary with the user's
 * display-scaling setting, so those carry a `note` and the editor surfaces an
 * "approximate" caption for them.
 *
 * Local adaptation: a `desktop` preset is appended so the cinematic media
 * editor's device tabs can offer a phone, a tablet, and a desktop (the cinematic
 * hero is full-viewport, so desktop framing is a real, distinct case).
 */
export interface DevicePreset {
  /** Stable id — persisted in prefs and referenced by consumers. */
  id: string;
  /** Human label. Device names are intentionally NOT translated. */
  label: string;
  /** Logical CSS-viewport width in px. */
  width: number;
  /** Logical CSS-viewport height in px. */
  height: number;
  /** Device pixel ratio (physical / logical); reference only. */
  dpr: number;
  /** Present when the logical size is approximate (Android scaling varies). */
  note?: string;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: "iphone-17-pro", label: "iPhone 17 Pro / 17", width: 402, height: 874, dpr: 3 },
  { id: "iphone-17-pro-max", label: "iPhone 17 Pro Max", width: 440, height: 956, dpr: 3 },
  { id: "iphone-16-15", label: "iPhone 16 / 15", width: 393, height: 852, dpr: 3 },
  { id: "galaxy-s26", label: "Galaxy S26", width: 360, height: 780, dpr: 3, note: "android-approx" },
  { id: "galaxy-s26-ultra", label: "Galaxy S26 Ultra", width: 412, height: 932, dpr: 3.5, note: "android-approx" },
  { id: "pixel-10", label: "Pixel 10 / 10 Pro", width: 412, height: 915, dpr: 3, note: "android-approx" },
  { id: "ipad-air", label: "iPad Air / iPad", width: 820, height: 1180, dpr: 2 },
  { id: "ipad-pro-13", label: 'iPad Pro 13"', width: 1032, height: 1376, dpr: 2 },
  { id: "desktop", label: "Desktop", width: 1440, height: 900, dpr: 1 },
];

/** Default preset — iPhone 17 Pro. */
export const DEFAULT_DEVICE_ID = "iphone-17-pro";

/** Resolve an id to a preset, falling back to the default for unknown/stale ids. */
export function resolveDevicePreset(id: string | null | undefined): DevicePreset {
  return (
    DEVICE_PRESETS.find((d) => d.id === id) ??
    DEVICE_PRESETS.find((d) => d.id === DEFAULT_DEVICE_ID)!
  );
}

/**
 * The three device tabs the cinematic media editor offers: a phone, a tablet,
 * and a desktop — each drawn from the canonical presets above so the numbers
 * live in exactly one place.
 */
export const MEDIA_PREVIEW_DEVICE_IDS = ["iphone-17-pro", "ipad-air", "desktop"] as const;

export const MEDIA_PREVIEW_DEVICES: DevicePreset[] = MEDIA_PREVIEW_DEVICE_IDS.map((id) =>
  resolveDevicePreset(id),
);

/** Aspect (width / height) of a preset — the frame aspect its preview renders at. */
export function devicePreviewAspect(deviceId: string): number {
  const p = resolveDevicePreset(deviceId);
  return p.width / p.height;
}

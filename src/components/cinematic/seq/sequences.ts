/**
 * SEQ.1 — frame-pack descriptors.
 *
 * A frame pack is a directory of numbered stills under `public/ventures/seq/`.
 * Scrubbing stills instead of scrubbing a video is what buys sharpness at every
 * viewport: a still is decoded at its own resolution and never re-encoded, so a
 * 1280-wide pack on a 1440 screen is a clean upscale rather than a smeared
 * keyframe. It also makes scroll the literal playhead — no `currentTime` seek,
 * no codec-dependent seek latency, no first-frame black.
 *
 * The manifest below IS the STEP 0 census, ratified as code. The browser cannot
 * enumerate a public/ directory, so the count, extension and zero-padding must
 * be declared here; a wrong `count` is the one mistake the engine cannot detect
 * (it would simply 404 the tail and hold the last good frame).
 *
 * Two asymmetries in the census are deliberately preserved rather than smoothed
 * over, because pairing packs into device classes is NOT this brick's job:
 *   • `gw-port-720` carries 60 frames where every other pack carries 72. It is
 *     a genuinely different-length take, not a re-crop of the landscape pack.
 *   • `titans-720` is 720x406 — the same 16:9 as `titans-1280`. It is a
 *     RESOLUTION variant, whereas the Green World pair is an ORIENTATION
 *     variant. Do not assume "-720" means "phone".
 *
 * The packs themselves are untracked at the time of writing, so this manifest
 * is only exercised by the DEV-gated lab.
 */

export interface FrameSequence {
  /** Stable id — used for lab keys and screenshot names. */
  id: string;
  /** Public directory, no trailing slash. */
  dir: string;
  /** Number of frames. Frame indices are 0-based; file numbers start at 1. */
  count: number;
  /** File extension including the dot. */
  ext: string;
  /** Zero-padding width of the file number. */
  pad: number;
  /** Intrinsic pixel size of a frame, from the census. */
  width: number;
  height: number;
  /** Human label for the lab HUD. */
  label: string;
}

/** URL of frame `index` (0-based) in `seq`. */
export function frameUrl(seq: FrameSequence, index: number): string {
  const n = String(index + 1).padStart(seq.pad, "0");
  return `${seq.dir}/f-${n}${seq.ext}`;
}

/** Every URL in the pack, in order. */
export function frameUrls(seq: FrameSequence): string[] {
  return Array.from({ length: seq.count }, (_, i) => frameUrl(seq, i));
}

/**
 * Frame index for a progress value. `round` (not `floor`) so that progress 1
 * lands exactly on the last frame and progress 0 exactly on the first — a
 * floor would make the final frame reachable only at exactly 1.0.
 */
export function frameIndexAt(progress: number, count: number): number {
  if (count <= 0) return 0;
  const p = Math.min(1, Math.max(0, progress));
  return Math.round(p * (count - 1));
}

/** The STEP 0 census, verbatim. */
export const SEQ_PACKS: FrameSequence[] = [
  {
    id: "gw-land-1280",
    dir: "/ventures/seq/gw-land-1280",
    count: 72,
    ext: ".webp",
    pad: 3,
    width: 1280,
    height: 716,
    label: "Green World — landscape 1280",
  },
  {
    id: "gw-port-720",
    dir: "/ventures/seq/gw-port-720",
    count: 60,
    ext: ".webp",
    pad: 3,
    width: 720,
    height: 1288,
    label: "Green World — portrait 720",
  },
  {
    id: "titans-1280",
    dir: "/ventures/seq/titans-1280",
    count: 72,
    ext: ".webp",
    pad: 3,
    width: 1280,
    height: 722,
    label: "Titans — 1280",
  },
  {
    id: "titans-720",
    dir: "/ventures/seq/titans-720",
    count: 72,
    ext: ".webp",
    pad: 3,
    width: 720,
    height: 406,
    label: "Titans — 720",
  },
];

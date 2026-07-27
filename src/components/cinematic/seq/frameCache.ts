/**
 * SEQ.1 — decoded-frame cache.
 *
 * ## Why this exists
 *
 * A 72-frame pack decoded in full is not free: 1280x716 RGBA is ~3.7 MB per
 * frame, so "just preload everything" is ~264 MB of graphics memory per act —
 * enough to get the tab killed on a phone. The engine therefore holds a WINDOW
 * around the playhead plus the two end frames, and evicts the rest.
 *
 * ## The three laws this class enforces
 *
 * 1. NEVER block first paint. Loading is fired from an effect, never awaited by
 *    render, and a failed frame is swallowed — a 404 in the middle of a pack
 *    must degrade to "hold the previous frame", not to a broken act.
 * 2. The window is PRIORITY-ORDERED, centre outward and forward-biased: scroll
 *    almost always advances, so the frames just ahead of the playhead are worth
 *    more than the ones just behind it.
 * 3. Eviction never touches a frame that is pinned (first/last) or currently
 *    inside the window. Everything else is plain LRU — `Map` iterates in
 *    insertion order, and `get()` re-inserts on hit, so the front of the map is
 *    exactly the least-recently-used end.
 *
 * `ImageBitmap` is used where available because it is decoded ONCE, off the
 * main thread, and blits straight to the canvas; an `HTMLImageElement` fallback
 * re-decodes lazily and is only there for engines without `createImageBitmap`.
 * Bitmaps own GPU memory that GC will not reclaim promptly, which is why
 * eviction calls `close()` explicitly.
 */

export type DecodedFrame = ImageBitmap | HTMLImageElement;

/**
 * Memory law. The window is 15 frames (10 ahead + 4 behind + centre); the cap
 * leaves LRU headroom above it so a scrub that reverses direction does not
 * immediately re-fetch what it just passed. At ~3.7 MB/frame the cap is roughly
 * 100 MB worst case, which is the most a phone should be asked to hold.
 */
export const SEQ_CACHE_MAX = 28;
export const SEQ_WINDOW_AHEAD = 10;
export const SEQ_WINDOW_BEHIND = 4;
/** Parallel fetches. Above ~6 the browser queues anyway and latency worsens. */
export const SEQ_MAX_CONCURRENT_LOADS = 6;

export interface FrameCacheStats {
  /** Frames currently decoded and held. */
  cached: number;
  /** Distinct frames decoded at least once since mount (monotonic). */
  loaded: number;
  /** Fetches in flight. */
  inflight: number;
}

/** Intrinsic size of a decoded frame, whichever representation it is. */
export function frameSize(frame: DecodedFrame): { w: number; h: number } {
  return "naturalWidth" in frame
    ? { w: frame.naturalWidth, h: frame.naturalHeight }
    : { w: frame.width, h: frame.height };
}

function closeFrame(frame: DecodedFrame): void {
  if (!("naturalWidth" in frame)) frame.close();
}

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return img;
}

async function decodeFrame(url: string): Promise<DecodedFrame> {
  if (typeof createImageBitmap === "function" && typeof fetch === "function") {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`frame ${url}: HTTP ${res.status}`);
    return await createImageBitmap(await res.blob());
  }
  return await loadImageElement(url);
}

export class FrameCache {
  private readonly urls: string[];
  private readonly cache = new Map<number, DecodedFrame>();
  private readonly inflight = new Set<number>();
  private readonly pinned: Set<number>;
  private readonly onReady?: (index: number) => void;
  private queue: number[] = [];
  private active = 0;
  private centre = 0;
  private loadedTotal = 0;
  private disposed = false;

  constructor(urls: string[], onReady?: (index: number) => void) {
    this.urls = urls;
    this.onReady = onReady;
    // First and last are pinned: the first is what the act shows before any
    // scroll (and the whole of the reduced-motion branch), the last is the
    // dead-stop the viewer rests on when the pin releases.
    this.pinned = new Set(urls.length > 0 ? [0, urls.length - 1] : []);
  }

  get stats(): FrameCacheStats {
    return { cached: this.cache.size, loaded: this.loadedTotal, inflight: this.inflight.size };
  }

  has(index: number): boolean {
    return this.cache.has(index);
  }

  /** Decoded frame if held, else null. Counts as an LRU touch. */
  get(index: number): DecodedFrame | null {
    const frame = this.cache.get(index);
    if (!frame) return null;
    this.cache.delete(index);
    this.cache.set(index, frame);
    return frame;
  }

  /**
   * The held frame closest to `index`, for painting while the exact frame is
   * still decoding. Holding a neighbour is always better than holding blank —
   * on a fast scrub the difference is invisible, and it is what stops the act
   * flashing the backdrop between frames.
   *
   * Returns the index it actually found, never the index that was asked for:
   * the caller reports the painted frame, so it must not be told a number that
   * is one better than the truth.
   */
  nearest(index: number): { index: number; frame: DecodedFrame } | null {
    const exact = this.get(index);
    if (exact) return { index, frame: exact };
    let best: number | null = null;
    let bestDist = Infinity;
    for (const i of this.cache.keys()) {
      const d = Math.abs(i - index);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best === null) return null;
    const frame = this.get(best);
    return frame ? { index: best, frame } : null;
  }

  /**
   * Declare the playhead. Rebuilds the fetch queue centre-outward and starts
   * as many loads as the concurrency cap allows. Cheap enough to call on every
   * frame change; it does no work when the window is already resident.
   */
  request(centre: number): void {
    if (this.disposed || this.urls.length === 0) return;
    this.centre = centre;

    const want: number[] = [centre];
    for (let d = 1; d <= Math.max(SEQ_WINDOW_AHEAD, SEQ_WINDOW_BEHIND); d++) {
      if (d <= SEQ_WINDOW_AHEAD && centre + d < this.urls.length) want.push(centre + d);
      if (d <= SEQ_WINDOW_BEHIND && centre - d >= 0) want.push(centre - d);
    }
    for (const p of this.pinned) want.push(p);

    const seen = new Set<number>();
    this.queue = want.filter((i) => {
      if (seen.has(i) || this.cache.has(i) || this.inflight.has(i)) return false;
      seen.add(i);
      return true;
    });
    this.pump();
  }

  private pump(): void {
    while (!this.disposed && this.active < SEQ_MAX_CONCURRENT_LOADS && this.queue.length > 0) {
      const index = this.queue.shift();
      if (index === undefined) return;
      if (this.cache.has(index) || this.inflight.has(index)) continue;
      void this.load(index);
    }
  }

  private async load(index: number): Promise<void> {
    this.inflight.add(index);
    this.active += 1;
    try {
      const frame = await decodeFrame(this.urls[index]);
      if (this.disposed) {
        closeFrame(frame);
        return;
      }
      this.cache.set(index, frame);
      this.loadedTotal += 1;
      this.evict();
      this.onReady?.(index);
    } catch {
      // A frame that will not decode must not break the scrub. The draw loop
      // holds the previous frame and the pack plays on.
    } finally {
      this.inflight.delete(index);
      this.active -= 1;
      if (!this.disposed) this.pump();
    }
  }

  private evict(): void {
    if (this.cache.size <= SEQ_CACHE_MAX) return;
    const lo = this.centre - SEQ_WINDOW_BEHIND;
    const hi = this.centre + SEQ_WINDOW_AHEAD;
    for (const index of [...this.cache.keys()]) {
      if (this.cache.size <= SEQ_CACHE_MAX) break;
      if (this.pinned.has(index)) continue;
      if (index >= lo && index <= hi) continue;
      const frame = this.cache.get(index);
      if (!frame) continue;
      this.cache.delete(index);
      closeFrame(frame);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.queue = [];
    for (const frame of this.cache.values()) closeFrame(frame);
    this.cache.clear();
  }
}

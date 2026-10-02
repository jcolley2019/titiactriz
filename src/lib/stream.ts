import { supabase } from "@/integrations/supabase/client";

/**
 * MEDIA.VIDEO.2 — uploaded videos live on Cloudflare Stream.
 *
 * A stored video value is either a legacy URL (an mp4/webm in the gallery
 * bucket — resolves exactly as it always did) or a STREAM REF, `cfstream:<uid>`.
 * A ref never names a host: the playback host is
 * https://customer-<code>.cloudflarestream.com, and the code is read from
 * site_settings `stream.customer_code` (written on the first upload), falling
 * back to the account's known code when the setting is missing.
 *
 * Writes go through the admin-only `stream-upload` edge function (the Stream
 * token never reaches the browser); the browser posts the file itself to the
 * one-time upload URL that `create` hands back, then waits for Stream to
 * finish encoding before the ref is stored anywhere.
 */
export const STREAM_PREFIX = "cfstream:";
export const STREAM_CUSTOMER_CODE_KEY = "stream.customer_code";
/** The account's code, read from a live video's `preview` URL (MEDIA.VIDEO.1). */
export const STREAM_CUSTOMER_CODE_FALLBACK = "dnrszolbm7gtqqan";

/** Direct creator upload takes up to 200 MB in one request — the client cap. */
export const STREAM_MAX_MB = 200;
export const STREAM_MAX_BYTES = STREAM_MAX_MB * 1024 * 1024;

/** What the site uploads, and which files it calls video: as filmed, iPhone .mov included. */
export const STREAM_VIDEO_ACCEPTED = ["video/mp4", "video/webm", "video/quicktime"];
export const STREAM_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
export const STREAM_VIDEO_ACCEPT_ATTR = [...STREAM_VIDEO_ACCEPTED, ...STREAM_VIDEO_EXTENSIONS].join(",");

export const isAcceptedStreamVideo = (file: File): boolean => {
  if (STREAM_VIDEO_ACCEPTED.includes((file.type || "").toLowerCase())) return true;
  const name = (file.name || "").toLowerCase();
  return STREAM_VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
};

const POLL_MS = 3_000;
const POLL_CAP_MS = 10 * 60_000;
/** stream-upload's delete can 429 right after a create; one retry after 10 s clears it. */
const DELETE_RETRY_MS = 10_000;

const CODE_RE = /^[a-z0-9]+$/i;
const validCode = (v: unknown): v is string => typeof v === "string" && CODE_RE.test(v);

export const isStreamRef = (v: unknown): v is string =>
  typeof v === "string" && v.startsWith(STREAM_PREFIX);

export const streamUid = (ref: string): string => ref.slice(STREAM_PREFIX.length);

export const streamSources = (ref: string, code: string) => {
  const base = `https://customer-${code}.cloudflarestream.com/${streamUid(ref)}`;
  return {
    hls: `${base}/manifest/video.m3u8`,
    poster: `${base}/thumbnails/thumbnail.jpg?time=1s&height=1080`,
  };
};

/* ─────────────────────────── customer code ─────────────────────────── */

let codeValue: string | null = null;
let codePromise: Promise<string> | null = null;

/** The code as already known this session (no fetch), or null. */
export const knownStreamCustomerCode = (): string | null => codeValue;

/** The playback code: the stored setting, else the account's known code. One read per session. */
export const getStreamCustomerCode = (): Promise<string> => {
  if (codeValue) return Promise.resolve(codeValue);
  codePromise ??= Promise.resolve(
    supabase.from("site_settings").select("value").eq("key", STREAM_CUSTOMER_CODE_KEY).maybeSingle(),
  )
    .then(({ data }) => (validCode(data?.value) ? data.value : STREAM_CUSTOMER_CODE_FALLBACK))
    .catch(() => STREAM_CUSTOMER_CODE_FALLBACK)
    .then((code) => (codeValue = code));
  return codePromise;
};

/* ─────────────────────────── the edge function ─────────────────────────── */

export type StreamKind = "hero" | "event";

type StreamStatus = {
  ready: boolean;
  state: string;
  errorReason: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  customerCode: string | null;
};

/** A failed stream-upload call, carrying the HTTP status so callers can tell 429/404 apart. */
export class StreamCallError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const callStream = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("stream-upload", { body });
  if (!error) return data as T;
  const ctx = (error as { context?: unknown }).context;
  let message = error.message || "Stream request failed";
  let status = 0;
  if (ctx instanceof Response) {
    status = ctx.status;
    try {
      const j = await ctx.clone().json();
      if (typeof j?.error === "string") message = j.error;
    } catch {
      /* not JSON */
    }
  }
  throw new StreamCallError(message, status);
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Delete a Stream video by its ref. A 404 means it is already gone (success).
 * A 429 — Stream throttles a delete that follows its create too closely — is
 * retried once after 10 s; anything still failing throws, and every caller
 * toasts it: a delete that did not happen is never silent.
 */
export const deleteFromStream = async (ref: string): Promise<void> => {
  const uid = streamUid(ref);
  for (let attempt = 0; ; attempt++) {
    try {
      await callStream({ action: "delete", uid });
      return;
    } catch (e) {
      const status = e instanceof StreamCallError ? e.status : 0;
      if (status === 404) return;
      if (status === 429 && attempt === 0) {
        await wait(DELETE_RETRY_MS);
        continue;
      }
      throw e;
    }
  }
};

/** Persist the playback code the first time anything is uploaded (never blocks the upload). */
const ensureCustomerCode = async (uid: string): Promise<void> => {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", STREAM_CUSTOMER_CODE_KEY)
      .maybeSingle();
    if (validCode(data?.value)) {
      codeValue = data.value;
      return;
    }
    const status = await callStream<StreamStatus>({ action: "status", uid }).catch(() => null);
    const code = validCode(status?.customerCode) ? status.customerCode : STREAM_CUSTOMER_CODE_FALLBACK;
    const { error } = await supabase.from("site_settings").upsert({
      key: STREAM_CUSTOMER_CODE_KEY,
      value: code,
      updated_at: new Date().toISOString(),
    });
    if (!error) codeValue = code;
  } catch {
    /* the fallback code still plays everything */
  }
};

/** POST the file to Stream's one-time upload URL. XHR, because fetch cannot report upload progress. */
const postFile = (url: string, file: File, onPct: (pct: number) => void): Promise<void> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Stream upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Stream upload failed (network)"));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });

export type StreamUploadProgress = { phase: "uploading"; pct: number } | { phase: "processing" };

/**
 * An upload that failed. `orphan` is the ref of a half-made Stream video that
 * could not be cleaned up — the caller says so out loud.
 */
export class StreamUploadError extends Error {
  constructor(
    message: string,
    readonly orphan: string | null,
  ) {
    super(message);
  }
}

/**
 * create → upload the file → poll `status` every 3 s until ready (10 min cap)
 * → `cfstream:<uid>`. A failure after `create` deletes the half-made video so
 * nothing unreferenced stays stored.
 */
export const uploadToStream = async (
  file: File,
  kind: StreamKind,
  onProgress?: (p: StreamUploadProgress) => void,
): Promise<string> => {
  const { uid, uploadURL } = await callStream<{ uid: string; uploadURL: string }>({
    action: "create",
    kind,
  });
  const ref = `${STREAM_PREFIX}${uid}`;
  try {
    await ensureCustomerCode(uid);
    onProgress?.({ phase: "uploading", pct: 0 });
    await postFile(uploadURL, file, (pct) => onProgress?.({ phase: "uploading", pct }));
    onProgress?.({ phase: "processing" });
    const deadline = Date.now() + POLL_CAP_MS;
    for (;;) {
      const s = await callStream<StreamStatus>({ action: "status", uid });
      if (s.ready) return ref;
      if (s.state === "error") throw new Error(s.errorReason || "Stream could not process this video");
      if (Date.now() > deadline) throw new Error("Stream is still processing after 10 minutes");
      await wait(POLL_MS);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stream upload failed";
    const cleaned = await deleteFromStream(ref).then(
      () => true,
      () => false,
    );
    throw new StreamUploadError(message, cleaned ? null : ref);
  }
};

/* ─────────────────────────── playback ─────────────────────────── */

let nativeHlsMemo: boolean | null = null;
/** Safari (and iOS) play HLS natively; everyone else gets hls.js. */
const nativeHls = (): boolean =>
  (nativeHlsMemo ??=
    typeof document !== "undefined" &&
    document.createElement("video").canPlayType("application/vnd.apple.mpegurl") !== "");

/**
 * Attach an HLS manifest to a <video>. Native HLS sets `src`; otherwise hls.js
 * is imported on demand (it never loads for a page without a Stream video) and
 * caps the rendition at the player's size, so each screen gets the best one it
 * can show. `autoLoad: false` loads the manifest only (its RESOLUTION reports
 * the size through `onSize`) and starts segments on the first play. Returns the
 * detach function.
 */
export const attachStreamPlayback = (
  video: HTMLVideoElement,
  manifest: string,
  opts: { autoLoad?: boolean; onSize?: (w: number, h: number) => void } = {},
): (() => void) => {
  const autoLoad = opts.autoLoad !== false;
  if (nativeHls()) {
    video.src = manifest;
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }

  let cancelled = false;
  let destroy: (() => void) | null = null;
  import("hls.js").then(({ default: Hls }) => {
    if (cancelled) return;
    if (!Hls.isSupported()) {
      video.src = manifest;
      return;
    }
    const hls = new Hls({ capLevelToPlayerSize: true, autoStartLoad: autoLoad });
    const onPlay = () => hls.startLoad();
    if (!autoLoad) video.addEventListener("play", onPlay, { once: true });
    hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
      const top = data.levels.reduce<{ width: number; height: number } | null>(
        (best, l) => (l.width && l.height && (!best || l.height > best.height) ? l : best),
        null,
      );
      if (top) opts.onSize?.(top.width, top.height);
    });
    let recovered = false;
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      // One media-error recovery; anything else fatal stops here and the
      // surface holds its poster / dark ground rather than retrying forever.
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
        recovered = true;
        hls.recoverMediaError();
        return;
      }
      hls.destroy();
    });
    hls.loadSource(manifest);
    hls.attachMedia(video);
    destroy = () => {
      video.removeEventListener("play", onPlay);
      hls.destroy();
    };
  });
  return () => {
    cancelled = true;
    destroy?.();
  };
};

/**
 * The intrinsic size of a Stream video, for the framing editors' clamp: the
 * same attach the player uses, on a detached element, released as soon as the
 * size is known.
 */
export const probeStreamSize = async (ref: string): Promise<{ w: number; h: number }> => {
  const manifest = streamSources(ref, await getStreamCustomerCode()).hls;
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "metadata";
    let detach: () => void = () => {};
    let done = false;
    const timer = window.setTimeout(() => finish(null), 20_000);
    const finish = (size: { w: number; h: number } | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      v.onloadedmetadata = null;
      v.onerror = null;
      detach();
      if (size && size.w > 0 && size.h > 0) resolve(size);
      else reject(new Error("video decode failed"));
    };
    v.onloadedmetadata = () => finish({ w: v.videoWidth, h: v.videoHeight });
    v.onerror = () => finish(null);
    detach = attachStreamPlayback(v, manifest, {
      autoLoad: false,
      onSize: (w, h) => finish({ w, h }),
    });
  });
};

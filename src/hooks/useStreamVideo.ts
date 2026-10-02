import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  attachStreamPlayback,
  getStreamCustomerCode,
  isStreamRef,
  knownStreamCustomerCode,
  streamSources,
} from "@/lib/stream";

/**
 * MEDIA.VIDEO.2 — what a <video> surface needs to play a stored video value.
 *
 * A legacy URL passes straight through as `src`: that path is untouched. A
 * stream ref (`cfstream:<uid>`) resolves to its HLS manifest and Stream poster
 * once the customer code is known, and the manifest is attached imperatively
 * (native HLS on Safari, hls.js elsewhere) — `src` stays undefined for it, so
 * React never fights the attach. `manifest` is exposed for the surface's
 * `data-stream-src`, the one place a spec can read which stream is playing.
 */
export const useStreamVideo = (
  videoRef: RefObject<HTMLVideoElement>,
  value: string | null | undefined,
  opts: { autoLoad?: boolean; onSize?: (w: number, h: number) => void } = {},
) => {
  const stream = isStreamRef(value);
  const [code, setCode] = useState<string | null>(knownStreamCustomerCode);

  useEffect(() => {
    if (!stream || code) return;
    let live = true;
    getStreamCustomerCode().then((c) => {
      if (live) setCode(c);
    });
    return () => {
      live = false;
    };
  }, [stream, code]);

  const sources = stream && code ? streamSources(value, code) : null;
  const manifest = sources?.hls;
  const autoLoad = opts.autoLoad !== false;
  const onSizeRef = useRef(opts.onSize);
  onSizeRef.current = opts.onSize;

  useEffect(() => {
    const el = videoRef.current;
    if (!manifest || !el) return;
    return attachStreamPlayback(el, manifest, {
      autoLoad,
      onSize: (w, h) => onSizeRef.current?.(w, h),
    });
  }, [manifest, autoLoad, videoRef]);

  return {
    /** The `src` attribute to render: the legacy URL, or undefined for a stream ref. */
    src: stream ? undefined : value || undefined,
    manifest,
    poster: sources?.poster,
  };
};

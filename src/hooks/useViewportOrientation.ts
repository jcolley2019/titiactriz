import { useEffect, useState } from "react";
import type { VideoOrientation } from "@/hooks/useCinematicMedia";

/**
 * ADMIN.MEDIA.3 — the viewport's orientation by ASPECT, re-evaluated on resize.
 * "portrait" when the viewport is at least as tall as it is wide (phones in
 * portrait), else "landscape". Used to pick the matching hero-video source.
 */
const query = "(max-aspect-ratio: 1/1)";

const read = (): VideoOrientation => {
  if (typeof window === "undefined" || !window.matchMedia) return "landscape";
  return window.matchMedia(query).matches ? "portrait" : "landscape";
};

export function useViewportOrientation(): VideoOrientation {
  const [orientation, setOrientation] = useState<VideoOrientation>(read);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setOrientation(mql.matches ? "portrait" : "landscape");
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return orientation;
}

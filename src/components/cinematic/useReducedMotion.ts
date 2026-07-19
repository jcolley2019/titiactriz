import { useEffect, useState } from "react";

/**
 * Tracks the user's `prefers-reduced-motion` setting, live.
 * The cinematic page uses this to disable Lenis smooth-scroll, ScrollTrigger
 * pinning/scrubbing, parallax, and letter animation — falling back to a clean
 * static layout — whenever reduced motion is requested.
 */
export function useReducedMotion(): boolean {
  // Read the preference SYNCHRONOUSLY on first render. This is critical: if the
  // initial value were false, the animated branches would mount and GSAP would
  // pin sections (rewriting the DOM into pin-spacers) before the value flipped
  // to true — and swapping to the static branch then crashes React's reconciler
  // (removeChild on a node GSAP moved). Getting it right up front avoids that.
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

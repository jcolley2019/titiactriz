/**
 * BANNER.EVENTS.1 — the one place that knows HOW this site scrolls itself.
 *
 * Owner ruling, verbatim: "I wanted the banner to show and when someone clicks
 * it on the home page it scrolls down to the events section on the cinematic
 * page. on the other pages it can lead the viewer to that page." Clarified:
 * "whenever a view clicks the banner/marquee while on the cinematic page it
 * should automatically scroll up or down to the events section."
 *
 * The cinematic home runs Lenis (HomeCinematic instantiates it and feeds
 * ScrollTrigger.update from its ticker). A component OUTSIDE that page — the
 * sitewide marquee lives in App, above the router — cannot reach that instance,
 * and calling `window.scrollTo({behavior:"smooth"})` while Lenis owns the wheel
 * means two animators writing the same scrollTop: Lenis resyncs from the native
 * scroll event every frame, so the travel stutters and ScrollTrigger measures a
 * position nothing agreed on. (Precedent, memory: Lenis momentum already breaks
 * fixed scroll aims — the fix is always to ask the driver, never to out-shout
 * it.)
 *
 * So the page that OWNS the smooth scroller publishes it here for as long as it
 * is mounted, and callers ask for it. Nothing registered — every other route,
 * and the cinematic page under prefers-reduced-motion, which builds no Lenis at
 * all — falls back to the platform, which is correct for exactly those cases.
 *
 * Lenis drives ScrollTrigger.update on every tick, so a scroll issued through
 * this module is ScrollTrigger-safe by construction: pins engage and release at
 * the positions they measured, including the Events act's own +=120% dwell.
 */

/** The shape this module needs. Lenis satisfies it as-is; so does a test stub. */
export type ScrollDriver = {
  scrollTo: (target: number, opts?: { immediate?: boolean }) => void;
};

let driver: ScrollDriver | null = null;

/**
 * Publish the active smooth scroller. Returns its own unregister function, so a
 * React effect can `return registerScrollDriver(lenis)` and never leave a dead
 * instance behind on unmount. Registering is last-write-wins; unregistering only
 * clears the driver if it is still the one that was registered, so a late
 * cleanup from an old page cannot blank a new page's live scroller.
 */
export const registerScrollDriver = (next: ScrollDriver): (() => void) => {
  driver = next;
  return () => {
    if (driver === next) driver = null;
  };
};

/**
 * Scroll the window to an absolute document Y. `immediate` jumps with no
 * animation — what prefers-reduced-motion asks for, in both the Lenis path and
 * the platform one.
 */
export const scrollWindowTo = (y: number, immediate = false): void => {
  if (typeof window === "undefined") return;
  const top = Math.max(0, Math.round(y));
  if (driver) {
    driver.scrollTo(top, { immediate });
    return;
  }
  window.scrollTo({ top, behavior: immediate ? "auto" : "smooth" });
};

/**
 * Scroll an element to the top of the viewport. Absolute document position, not
 * `scrollIntoView`: the target here is a GSAP-pinned section whose top edge is
 * its pin-spacer's top — the exact position `start: "top top"` measured — and
 * `scrollIntoView` would hand the travel to the browser, behind Lenis's back.
 */
export const scrollElementToTop = (el: Element, immediate = false): void => {
  if (typeof window === "undefined") return;
  scrollWindowTo(el.getBoundingClientRect().top + window.scrollY, immediate);
};

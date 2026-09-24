import type { Locator } from "@playwright/test";

/**
 * A real-shaped touch swipe, dispatched at the DOM.
 *
 * Playwright's touch API is `touchscreen.tap()` and nothing else — there is no
 * swipe primitive in any engine — so a gesture has to be synthesised. The two
 * engines disagree about how to build one, and BOTH disagreements are load-
 * bearing here because this battery runs the same laws in Chromium and in a real
 * mobile WebKit:
 *
 *   - Chromium has the `Touch` constructor and dropped `document.createTouch`.
 *   - WebKit still rejects `new Touch(...)` with "Illegal constructor" (probed,
 *     not assumed) and still carries the legacy `document.createTouch` /
 *     `createTouchList` pair.
 *
 * So each is tried in turn. What this drives is the JS swipe grammar — the
 * lightbox's 48px horizontal commit and 72px downward close, and the strip's
 * seize/release handlers. It deliberately does NOT pretend to drive NATIVE
 * scrolling: a synthesised touch cannot scroll an overflow container, and a spec
 * that claimed otherwise would be measuring nothing.
 */
/**
 * Bring a drifting carousel strip to rest, the way a reader does.
 *
 * A spec cannot click a moving target: Playwright's actionability check waits
 * for an element to be STABLE and a drifting strip never is, which took every
 * modal spec down on WebKit with "element is not stable". Emulation hid it —
 * Chromium tolerated the same clicks — so this is exactly the class of thing the
 * real-engine project exists to catch.
 *
 * The fix is not to reach past the check, it is to do what a finger does. A
 * wheel over the strip is one of the three seizures the carousel listens for, so
 * this pauses the drift for the full idle window AND arms the snap, which
 * settles a card centred and fully visible — the state a reader taps from.
 */
export async function stillStrip(strip: Locator) {
  await strip.evaluate((el) =>
    el.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: 0, deltaY: 0 })),
  );
  await waitForStripRest(strip);
}

/**
 * Wait until the strip has genuinely stopped, settle-scroll and all.
 *
 * A seizure does not stop the strip immediately: the release is debounced, and
 * the release then SMOOTH-SCROLLS the nearest card to centre. A spec that reads
 * scrollLeft before all of that has finished captures a position mid-flight and
 * then compares it against where the strip actually came to rest — which is how
 * the phone's "closing returns the strip position" law failed at 0 vs 334, with
 * nothing wrong in the app at all.
 *
 * The fixed wait covers the debounce and the start of the settle; the frame poll
 * then waits out the smooth scroll itself, however long the engine takes.
 */
export async function waitForStripRest(strip: Locator) {
  await strip.page().waitForTimeout(500);
  await strip.evaluate(async (el) => {
    let last = Number.NaN;
    let stable = 0;
    for (let i = 0; i < 180; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const now = el.scrollLeft;
      stable = Math.abs(now - last) < 0.5 ? stable + 1 : 0;
      last = now;
      if (stable >= 8) return;
    }
  });
}

export async function swipe(
  target: Locator,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await target.evaluate(
    (el, { from, to }) => {
      const mk = (x: number, y: number): Touch => {
        try {
          return new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        } catch {
          const legacy = document as unknown as {
            createTouch: (
              view: Window,
              target: EventTarget,
              id: number,
              px: number,
              py: number,
              sx: number,
              sy: number,
            ) => Touch;
          };
          return legacy.createTouch(window, el, 1, x, y, x, y);
        }
      };

      const list = (...touches: Touch[]): Touch[] => {
        const legacy = document as unknown as {
          createTouchList?: (...t: Touch[]) => TouchList;
        };
        return legacy.createTouchList
          ? (legacy.createTouchList(...touches) as unknown as Touch[])
          : touches;
      };

      const fire = (type: string, active: Touch[], changed: Touch[]) =>
        el.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: list(...active) as unknown as TouchList,
            changedTouches: list(...changed) as unknown as TouchList,
          }),
        );

      const start = mk(from.x, from.y);
      const mid = mk((from.x + to.x) / 2, (from.y + to.y) / 2);
      const end = mk(to.x, to.y);

      fire("touchstart", [start], [start]);
      fire("touchmove", [mid], [mid]);
      fire("touchend", [], [end]);
    },
    { from, to },
  );
}

/**
 * ADMIN.COACH.1 — finding a step's target on the page.
 *
 * Every element carrying `data-coach="<id>"` that has a box counts; their
 * union is the one rect the overlay spotlights (the brain-dump box and its
 * Grabar button read as one control).
 */

export type Rect = { top: number; left: number; width: number; height: number };

const boxes = (id: string) =>
  [...document.querySelectorAll<HTMLElement>(`[data-coach="${CSS.escape(id)}"]`)]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 || r.height > 0);

export const hasTarget = (id: string) => boxes(id).length > 0;

export function targetRect(id: string): Rect | null {
  const rs = boxes(id);
  if (rs.length === 0) return null;
  const top = Math.min(...rs.map((r) => r.top));
  const left = Math.min(...rs.map((r) => r.left));
  const bottom = Math.max(...rs.map((r) => r.bottom));
  const right = Math.max(...rs.map((r) => r.right));
  return { top, left, width: right - left, height: bottom - top };
}

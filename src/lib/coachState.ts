/**
 * ADMIN.COACH.1 — which coaching tours this admin has already seen.
 *
 * localStorage `admin.coach.seen.<userId>` holds a JSON array of tour ids.
 * It is per device by design: on a second device the tours run once more.
 * Storage can throw (Safari private mode, blocked site data), so every access
 * is best-effort; the worst case is a tour showing again.
 */

export const coachSeenKey = (userId: string) => `admin.coach.seen.${userId}`;

export function readSeen(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(coachSeenKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function markSeen(userId: string, tourId: string) {
  try {
    const seen = readSeen(userId);
    seen.add(tourId);
    localStorage.setItem(coachSeenKey(userId), JSON.stringify([...seen]));
  } catch {
    /* storage unavailable — the tour may show once more */
  }
}

/** Forget every seen tour for this user: each one fires fresh again. */
export function resetAll(userId: string) {
  try {
    localStorage.removeItem(coachSeenKey(userId));
  } catch {
    /* storage unavailable — nothing was remembered */
  }
}

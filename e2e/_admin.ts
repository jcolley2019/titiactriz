import type { Page, Route } from "@playwright/test";

/**
 * ADMIN.MEDIA.1 gate helpers — authenticate the admin and mock the owned
 * Supabase backend so the media flow is deterministic and offline.
 *
 * The project ref drives the supabase-js localStorage key (sb-<ref>-auth-token).
 * A far-future expiry means getSession() returns the injected session without a
 * network refresh, so the admin shell renders without a real login.
 */
export const SUPABASE_REF = "nsmstwkjbjicpdclgecq";

export type Write = { method: string; url: string; body: string | null };

export function svgPhoto(id: string, color: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500'><rect width='100%' height='100%' fill='${color}'/></svg>`;
  return { id, image_url: `data:image/svg+xml,${encodeURIComponent(svg)}`, alt_text: id };
}

/** Four deterministic, offline published photos (data-URL SVGs). */
export const MOCK_PHOTOS = [
  svgPhoto("p1", "crimson"),
  svgPhoto("p2", "teal"),
  svgPhoto("p3", "goldenrod"),
  svgPhoto("p4", "navy"),
];

/** Inject a valid-looking admin session into localStorage before the app boots. */
export async function injectAdminSession(page: Page) {
  await page.addInitScript((ref) => {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600;
    const b64u = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const jwt = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({
      sub: "00000000-0000-0000-0000-000000000000",
      role: "authenticated",
      aud: "authenticated",
      exp,
    })}.sig`;
    const user = {
      id: "00000000-0000-0000-0000-000000000000",
      aud: "authenticated",
      role: "authenticated",
      email: "admin@example.com",
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: "2024-01-01T00:00:00Z",
    };
    const session = {
      access_token: jwt,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: exp,
      refresh_token: "test-refresh",
      user,
    };
    try {
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    } catch {
      /* storage disabled — nothing we can do */
    }
  }, SUPABASE_REF);
}

/** Force a UI language before boot (the app reads localStorage "ta_lang" first). */
export async function forceLanguage(page: Page, lng: "en" | "es") {
  await page.addInitScript((l) => {
    try {
      localStorage.setItem("ta_lang", l);
    } catch {
      /* noop */
    }
  }, lng);
}

type RouteOpts = {
  media?: unknown; // cinematic_media value, or null for absent
  photos?: unknown[];
  homeVariant?: string;
  writes?: Write[]; // push-collected non-GET requests for payload assertions
};

/**
 * Route the owned Supabase project. GET reads return mocked gallery/site_settings;
 * non-GET writes are captured (and acked) so tests can assert upsert/delete shape.
 */
export async function routeSupabase(page: Page, opts: RouteOpts = {}) {
  const media = opts.media ?? null;
  const photos = opts.photos ?? MOCK_PHOTOS;
  const homeVariant = opts.homeVariant ?? "cinematic";

  await page.route("**/auth/v1/**", (route: Route) => {
    const url = route.request().url();
    if (url.includes("/logout")) return route.fulfill({ status: 204, body: "" });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/rest/v1/**", (route: Route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    const asJson = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const asNull = () =>
      route.fulfill({ status: 200, contentType: "application/json", body: "null" });

    if (method !== "GET") {
      opts.writes?.push({ method, url, body: req.postData() });
      return route.fulfill({
        status: method === "DELETE" ? 204 : 201,
        contentType: "application/json",
        body: "[]",
      });
    }
    if (url.includes("gallery_photos")) return asJson(photos);
    if (url.includes("site_settings")) {
      if (url.includes("cinematic_media")) return media === null ? asNull() : asJson({ value: media });
      if (url.includes("home_variant")) return asJson({ value: homeVariant });
      return asNull(); // cinematic_hero_photo / cinematic_hero_video / events keys → absent
    }
    return asJson([]); // events tables, user_roles, anything else
  });
}

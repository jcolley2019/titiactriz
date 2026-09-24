import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, routeSupabase, SUPABASE_REF } from "./_admin";

/**
 * ADMIN.TAB.1 — the admin reopens on the last section; sign-out resets it.
 *
 * Joey: "if I'm working in Settings and I exit to view the page and then return
 * i'd like it to go back to the settings view so I can continue without having
 * to select it again. Now if an admin logs out it should return to the Gallery
 * menu view because that's the first editor"
 *
 * Sign-in here is the real form against a mocked token endpoint, and the
 * injected session is planted ONCE per tab (not on every navigation, as
 * injectAdminSession does) — otherwise a sign-out would be silently undone by
 * the next page load and the reset could never be observed.
 */

const KEY = "admin.section";
const USER = {
  id: "00000000-0000-0000-0000-000000000000",
  aud: "authenticated",
  role: "authenticated",
  email: "admin@example.com",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2024-01-01T00:00:00Z",
};

function makeSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({
    sub: USER.id,
    role: "authenticated",
    aud: "authenticated",
    exp,
  })}.sig`;
  return {
    access_token: jwt,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: "test-refresh",
    user: USER,
  };
}

/** Signed in when the tab opens; a later sign-out sticks across navigations. */
async function signedInOnce(page: Page, rememberedSection?: string) {
  await page.addInitScript(
    ({ ref, session, remembered, key }) => {
      try {
        if (sessionStorage.getItem("e2e.seeded")) return;
        sessionStorage.setItem("e2e.seeded", "1");
        localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
        if (remembered) localStorage.setItem(key, remembered);
      } catch {
        /* storage disabled */
      }
    },
    { ref: SUPABASE_REF, session: makeSession(), remembered: rememberedSection ?? null, key: KEY },
  );
}

async function mockTokenGrant(page: Page) {
  await page.route("**/auth/v1/token*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(makeSession()) }),
  );
}

async function signInViaForm(page: Page) {
  await page.locator("#email").fill("admin@example.com");
  await page.locator("#password").fill("pw");
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('[data-qa="admin-shell"]')).toBeVisible();
}

const activeTab = (page: Page) => page.locator('[data-qa="admin-nav"] [aria-current="page"]');

test.beforeEach(async ({ page }) => {
  await forceLanguage(page, "en");
  await routeSupabase(page);
  await mockTokenGrant(page);
});

test("T1: Settings → view the page → back to /admin reopens on Settings", async ({ page }) => {
  await signedInOnce(page);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(activeTab(page)).toHaveAttribute("data-qa", "admin-nav-gallery");

  await page.locator('[data-qa="admin-nav-settings"]').click();
  await expect(page.locator('[data-qa="admin-section-settings"]')).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe("settings");

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-qa="admin-section-settings"]')).toBeVisible();
  await expect(activeTab(page)).toHaveAttribute("data-qa", "admin-nav-settings");
});

test("T2: Settings → sign out → sign in opens on Gallery", async ({ page }) => {
  await signedInOnce(page);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.locator('[data-qa="admin-nav-settings"]').click();
  await expect(page.locator('[data-qa="admin-section-settings"]')).toBeVisible();

  // The shell's Log out → supabase-js fires SIGNED_OUT (logout call is mocked).
  await page.locator('[data-qa="admin-shell"] button', { hasText: "Log out" }).click();
  await expect(page.locator("#email")).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();

  await signInViaForm(page);
  await expect(activeTab(page)).toHaveAttribute("data-qa", "admin-nav-gallery");
  await expect(page.locator('[data-qa="admin-section-gallery"]')).toBeVisible();
});

test("T2b: sign-out from the public page's language menu also resets to Gallery", async ({
  page,
}) => {
  // A fresh load on / with Settings remembered from an earlier visit: the
  // admin page's code has never loaded in this tab when the sign-out happens.
  await signedInOnce(page, "settings");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-qa="lang-menu-trigger"]').first().click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect
    .poll(() => page.evaluate((ref) => localStorage.getItem(`sb-${ref}-auth-token`), SUPABASE_REF))
    .toBeNull();

  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await signInViaForm(page);
  await expect(activeTab(page)).toHaveAttribute("data-qa", "admin-nav-gallery");
});

test("T3: a remembered section that no longer exists opens on Gallery", async ({ page }) => {
  await signedInOnce(page, "no-such-section");
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-qa="admin-shell"]')).toBeVisible();
  await expect(activeTab(page)).toHaveAttribute("data-qa", "admin-nav-gallery");
  await expect(page.locator('[data-qa="admin-section-gallery"]')).toBeVisible();
});

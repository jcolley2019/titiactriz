/**
 * Shared venture destinations, so the cinematic Ventures split-panel and the
 * standalone brand pages can never drift apart.
 *
 * GREEN_WORLD_SHOP_URL is Cristyna's Green World storefront (her referral
 * login) — the exact destination the Green World page's primary "Shop Green
 * World" CTA points to. It is an external store, so link to it directly and
 * open it in a new tab with rel="noopener".
 *
 * TITANS_ROUTE is the internal Titans Agency page.
 */
export const GREEN_WORLD_SHOP_URL =
  "https://us.world-food.com/#/shareLoginIn&MjI1Mjg0Mjc7MjIyNjUyNDg7MjAyNi0wMy0wNyAxOToyNDo1NQ==";

export const TITANS_ROUTE = "/titans-agency";

/**
 * TITANS.OFF.1 (2026-07-27) — Titans Agency is shut down after a TikTok policy
 * change ended the creator-agency program.
 *
 * The ruling was HIDE, not delete: the page, the cinematic act, the assets, the
 * copy and the translations all stay in the repo, and every surface that would
 * expose them is gated on this one constant. Flipping it back to `true` is the
 * whole revive — there is no second switch, no archived branch to resurrect,
 * and no content to rewrite.
 *
 * What this gates, and what it deliberately does not:
 *   • Gated — the /titans-agency route (falls through to the 404), the home
 *     cinematic Titans act, both navs, the footer, the hero quick-link and
 *     featured cards on both home variants, and the Titans banner controls in
 *     the admin events board.
 *   • NOT gated — the i18n strings and the TitansAgency page component. Neither
 *     renders on its own; both are reached only through a gated surface, and
 *     deleting the strings would break the locale-parity guard for nothing.
 *   • NOT gated — `isTitansPage` styling branches in Header and
 *     ScrollToTopButton. They key off `location.pathname`, which can no longer
 *     equal the Titans route while the flag is false, so they are already
 *     unreachable and become live again for free on revive.
 *
 * Two surfaces are static files that cannot import this constant, so they carry
 * their Titans entries commented out with a pointer back here: public/sitemap.xml
 * and the JSON-LD block in index.html. Reviving means uncommenting both.
 */
export const TITANS_ENABLED = false;

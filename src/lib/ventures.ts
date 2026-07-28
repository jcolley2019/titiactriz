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

/** The internal Green World brand page — where the scroll-scrub act's CTA lands. */
export const GREEN_WORLD_ROUTE = "/green-world";

/**
 * SEQ.2 (2026-07-28) — the Green World act's STATIC logo layer.
 *
 * The re-cut frame packs are logo-free by design (SEQ.1b): the mark is no longer
 * baked into the plate, so it can sit perfectly still while the plate scrubs
 * underneath it. That layer is fully wired — positioned, sized, and carrying its
 * spec hooks — but it paints NOTHING until a source asset exists that deserves
 * to be painted.
 *
 * The audit that set this flag to `false` found no such asset:
 *   • greenworld-logo-hd.webp (1120x928) — opaque (yuv420p, no alpha) AND a
 *     different lockup (serif) from the one the act needs. Do not use it.
 *   • greenworld-logo-clean.webp / greenworld-logo-new.png (500x500) — opaque.
 *   • green-world_512.png / hgw_512.png / GW-SYMBOL.png — transparent, but they
 *     cap at 512px, which cannot hold up centred over a 1920-wide plate.
 *   • No SVG exists anywhere in the repo or the source library.
 *
 * The bar was a transparent source at >=1200px (an SVG would be better still).
 * GW.LOGO.1 (2026-07-28) cleared it: public/ventures/green-world-logo.png,
 * 1600x1168, 32-bit RGBA, 48 KB — the correct lockup, transparent, and wide
 * enough to hold up centred over a 1920-wide plate. Nothing else in the act
 * changed on the flip — the layer's geometry was already asserted by the specs
 * while it was empty, so the flip could not silently move it.
 *
 * GW.LOGO.2 (2026-07-28) swapped that asset for a MARK-ONLY one:
 * public/ventures/green-world-mark.png, 1210x995, 32-bit RGBA, 36 KB — stars and
 * leaves, with the wordmark cropped off. The full lockup carried a baked "GREEN
 * WORLD" wordmark, and at 1440 it scaled up until that wordmark sat on the act's
 * gold eyebrow and crowded the serif lockup beneath it: the name rendered twice,
 * stacked. The serif lockup is the act's own voice and stays, so the NAME is the
 * act's job and the MARK is the asset's. Mark-only is what keeps them from
 * saying the same thing on top of each other.
 */
export const GW_LOGO_READY = true;

/**
 * The logo layer's source. `null` while GW_LOGO_READY is false — the two move
 * together, and the act treats either one being unset as "paint nothing", so a
 * half-finished flip degrades to the current (empty) state rather than to a
 * broken image.
 */
export const GW_LOGO_SRC: string | null = "/ventures/green-world-mark.png";

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

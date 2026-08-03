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
 * TL.LIVE.1 (2026-07-31) — TitiLinks is LIVE, with working payments.
 *
 * It is Cristyna's own product but a SEPARATE application on its own domain, so
 * the nav treats it exactly as it treats the Green World storefront: an external
 * destination, opened in a new tab with rel="noopener noreferrer". It is NOT a
 * route of this site and must never be linked as one.
 *
 * This constant is the single source of truth for that address — the nav and the
 * home page's TitiLinks act both read it, so the two cannot drift apart. It
 * replaces the `path: null` "announced, not yet built" entry NAV.SOON.1 carried
 * in the coming-soon disclosure while the product was unreleased.
 */
export const TITILINKS_URL = "https://titilinks.com";

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
 *
 * GW.LOGO.5 (2026-07-28) REVERSES that direction, per Joey: the brand's mark is
 * rendered as the brand draws it — leaves, stars and their own bold wordmark —
 * so public/ventures/green-world-lockup.png (1598x1167, 32-bit RGBA, 49 KB,
 * alpha-true trimmed) paints the FULL lockup and green-world-mark.png is gone.
 * The site's voice lives AROUND the mark, not inside it: GW.LOGO.2 resolved the
 * doubled name by cropping the brand's wordmark off, and that was the wrong half
 * to cut. This brick cuts the other half — the act's serif headline is retired,
 * the lockup carries the name alone, and "OFFICIAL DISTRIBUTOR" drops beneath it
 * as a gold credential line. The name still renders exactly once; it is simply
 * the brand's rendering of it rather than ours.
 *
 * The wordmark is black, so where it lands is a legibility constraint, not just
 * a taste one: the act's scrim reaches 0.62 alpha by 74% of the stage and the
 * portrait plate carries its own dark band at ~32-38%. The logo layer's band is
 * pinned to keep the whole lockup on ground measured at >=7:1 against black at
 * every frame of the scrub — see the band comment in CinematicGreenWorldSeq.
 */
export const GW_LOGO_READY = true;

/**
 * The logo layer's source. `null` while GW_LOGO_READY is false — the two move
 * together, and the act treats either one being unset as "paint nothing", so a
 * half-finished flip degrades to the current (empty) state rather than to a
 * broken image.
 */
export const GW_LOGO_SRC: string | null = "/ventures/green-world-lockup.png";

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

/**
 * PORT.ACT.2 (2026-08-01) — the Acting act, built and gated OFF.
 *
 * Candidate C (editorial split) won the bakeoff: the photograph is the page,
 * full-bleed to the frame edges with the gold seam at the junction, and the
 * frame language survives as an engraved panel around a numbered credits index.
 * It was picked because it is the only one of the three that fills a tall
 * portrait tablet frame without new levers — and Dance clones whatever wins.
 *
 * The act is finished code reading real rows from `acting_credits`. It is dark
 * because the table currently holds exactly ONE honest credit (El Casting); an
 * act whose index is a single line is not an act yet. Flip this to `true` when
 * Titi has supplied enough verified credits to fill it — that is the whole
 * revive, there is no second switch.
 *
 * What this gates: the act's registration in the cinematic home page. NOT gated
 * — the component, its data hook and its i18n strings, none of which render on
 * their own, and deleting the strings would break locale parity for nothing.
 */
export const ACTING_ACT_ENABLED = false;

/**
 * PORT.SOC.8 (2026-08-02) — the Socials act, gated OFF.
 *
 * The act itself arrives in brick 9; this constant lands with the admin Links
 * tab because the tab has to be able to say, honestly, that saved links are not
 * on the site yet. Same shape as ACTING_ACT_ENABLED and TITANS_ENABLED: one
 * constant gates the act's registration in the cinematic home, nothing else,
 * and flipping it is the whole switch-on.
 *
 * The Socials act is a DIRECTORY, not a chapter — it is deliberately unnumbered
 * and sits after the TitiLinks act, because TitiLinks sells the link-in-bio
 * idea and this act is Cristyna's own instance of it. Claim, then proof.
 */
export const SOCIALS_ACT_ENABLED = false;

/**
 * PORT.SOC.9 (2026-08-02) — WHICH Socials composition.
 *
 * The PORT.ACT.1 proposal settled the act's room, its material and its place in
 * the flow, but not what a tile SAYS: a mark alone, a mark with its platform's
 * name, and a mark with a name and a handle are three different acts at three
 * different densities. All three were built and rendered at four viewports in
 * both languages, and Joey picked **B — THE NAMED ROW** on 2026-08-02: mark
 * over its platform name, 2/3/4 across, nothing hidden behind a hover.
 *
 * The two it beat are still in CinematicSocials rather than deleted, because
 * this is a taste call that can be revisited by changing one letter — and
 * because the measured fit table is part of the record: A and B hold all four
 * frames, C runs 21px off the bottom of a 360x780 phone with six links, and the
 * act is pinned so that overflow can never be scrolled to.
 *
 * `null` remains a legal value and still means "do not mount", so the flag can
 * be flipped without a composition being chosen. Both constants must be set
 * before a reader sees anything.
 */
export const SOCIALS_ACT_VARIANT: "A" | "B" | "C" | null = "B";

/**
 * PORT.SOC.8 (2026-08-02) — is the `unfurl` edge function LIVE on the project?
 *
 * The function is written and committed (supabase/functions/unfurl) but has not
 * been deployed: law 5 says repo state is not deployed state, and deploying is
 * a supervised step that ends with the slug entering deploy-ledger.json and
 * `npm run drift` going green. Until then the admin Links tab still renders its
 * "refresh preview" control — it is the real control, not a mock — but says
 * plainly above it that the service is not live yet, so a failed refresh reads
 * as "not deployed" rather than "broken".
 *
 * Flip this to `true` in the SAME commit that adds `unfurl` to the ledger.
 */
export const UNFURL_DEPLOYED = false;

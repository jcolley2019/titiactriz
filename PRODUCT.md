# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: her audience.** TikTok viewers, followers, and fans arriving from her
socials — mostly Spanish-speaking, mostly on a phone, mostly in the first few
seconds of deciding whether she is worth their attention. Their job is not a task;
it is to *meet her*.

**Secondary: casting and industry.** Welcome, but not the audience the site is
optimized to win.

**Tertiary: venture audiences.** Green World prospects and TitiLinks visitors.
They arrive *through* her, not directly — see Positioning.

## Product Purpose

A persona-first showcase for Cristyna Polentino. Within seconds a visitor should
feel they have met a beautiful, talented, multi-dimensional woman. The site
introduces her as an actress, streamer and entrepreneur — three roles, in this
order: **Actriz · Streamer · Empresaria**.

It is a showcase. It is **not** a casting portfolio and **not** a storefront.

Success is a visitor who arrived from a social feed leaving with a real sense of
her, and — when they care — following one of her ventures onward.

## Positioning

The persona is the mechanism. Ventures are **destinations the persona leads to,
not co-equal tenants** of the site. A competitor can copy a link hub or a
supplement funnel; none of them can be her.

## Operating Context

- Visitors arrive from social (principally TikTok): mobile-first, Spanish-first,
  short attention, often cold.
- **Green World** — health products she sells and promotes. `/green-world` is an
  instructional page with a "Cómo comprar" guide that **hands off to the Green
  World store to buy**. The site itself does not transact.
- **TitiLinks** — her own link-in-bio product. It is live as a **separate
  application at titilinks.com**; this site links out to it and never routes to
  it.
- **Titans Agency Latam** — her TikTok agency, **paused** after a TikTok policy
  change and hidden since 2026-07-27. It is hidden, not deleted: every Titans
  surface is gated on `TITANS_ENABLED = false` in `src/lib/ventures.ts`.
- **Blog** — built and live at `/blog`. She writes about Green World products,
  training and business, and personal posts. The admin's Content Studio drafts
  posts; **every post is a draft until a human publishes it — never
  auto-publish.**
- **Events** — an owner-managed board feeds `/events`, the home's Events act and
  the sitewide banner.
- **Book** — a coming-soon teaser, live at `/book` (CLAUDE.md publisher law).
- `/admin` is the authenticated surface where she manages media, events, links,
  blog posts and site settings.

## Capabilities and Constraints

**Stack.** Vite + React 18 + TypeScript, Tailwind + shadcn/ui, React Router,
Supabase (database, storage, edge functions), deployed on Vercel. Playwright
covers e2e. Motion is GSAP + ScrollTrigger + Lenis.

**Home.** `/` serves the cinematic home. Editorial and classic variants exist
and are selectable in the admin (`home_variant`).

**Language.** i18next with `es` and `en` at exact key parity. The site opens in
Spanish unless the visitor has chosen English (`ta_lang`); the browser's
language is ignored. **Spanish is primary; English is parity, not a translation
afterthought.**

**Load-bearing technical contracts.**
- `src/lib/hero-framing.ts` is the single owner of hero media geometry: a
  preview shows exactly what publishes. Nothing else may hardcode `object-fit`
  or re-derive a transform.
- `npm run guard` enforces the `CROP-CORS` invariant and fails on untracked
  files under `public/`.
- Reduced motion is honored via `useReducedMotion`.

**Explicitly not built.**
- No commerce or checkout. Purchase completes on the venture's own property.
- No streaming surface. The home's Socials act links to her real profiles.
- The Acting act (`ACTING_ACT_ENABLED`, `src/lib/ventures.ts`) and the home's
  Book act (`CinematicBook`) are built and switched off on the home page; the
  Acting act waits on verified credits.

## Brand Commitments

- The name **Cristyna Polentino**, and the venture names **Green World**,
  **Titans Agency Latam**, and **TitiLinks**, are owner-provided and binding.
- **Copy is owner-provided.** Names, numbers, venture claims, and titles come
  from her. They are not to be rewritten, "improved", or invented.
- Binding *visual* constraints are recorded in `DESIGN.md`, which is the design
  authority. They are deliberately not restated here.

## Evidence on Hand

**Confirmed real and operating:** the Green World supplement line she sells and
promotes; TitiLinks; an active streaming presence; her social profiles as
entered in the admin.

**Absences future work must not fabricate.** No testimonials, follower counts,
revenue or performance metrics, pricing, case studies, press quotes, or client
logos have been established. Acting credits come only from the `acting_credits`
table. Blog posts are hers; do not invent one's contents.

## Product Principles

1. **Persona before product.** The visitor meets her first; every venture is
   reached through her, never placed beside her as an equal.
2. **Spanish is primary.** English is parity, not a courtesy layer.
3. **Introduce and hand off.** The site earns the click; the venture's own
   property completes it. Adding a transaction here changes what the product is.
4. **Owner truth is immutable.** Names, claims, numbers, and titles originate
   with her. Fabrication is a correctness failure, not a style choice.
5. **Arriving from a feed sets the terms.** Mobile-first, seconds-long attention,
   cold traffic. Anything that costs the first few seconds costs the visitor.

## Accessibility & Inclusion

- ES/EN key parity is a product requirement.
- `prefers-reduced-motion` is honored through `useReducedMotion`; the cinematic
  layer builds no animation and no pins under it.

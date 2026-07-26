# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: her audience.** TikTok viewers, followers, and fans arriving from her
socials — mostly Spanish-speaking, mostly on a phone, mostly in the first few
seconds of deciding whether she is worth their attention. Their job is not a task;
it is to *meet her*.

**Secondary: casting and industry.** Welcome, and served specifically by the
resume section (work as actress and dancer). They are not the audience the site
is optimized to win.

**Tertiary: venture audiences.** Green World prospects, Titans Agency Latam
recruits, and TitiLinks visitors. They arrive *through* her, not directly — see
Positioning.

## Product Purpose

A persona-first showcase for Cristyna Polentino. Within seconds a visitor should
feel they have met a beautiful, talented, multi-dimensional woman — actress,
dancer, streamer, entrepreneur.

It is a showcase. It is **not** a casting portfolio and **not** a storefront.

Structure follows persona:

1. **Bio** — personal; who she is.
2. **Resume** — her work as actress and dancer.
3. **Ventures** — routes outward into Green World, Titans Agency Latam, TitiLinks.

Success is a visitor who arrived from a social feed leaving with a real sense of
her, and — when they care — following one of her ventures onward.

## Positioning

The persona is the mechanism. Ventures are **destinations the persona leads to,
not co-equal tenants** of the site. A competitor can copy a link hub or a
supplement funnel; none of them can be her, and the site is built so that the
introduction is what carries the ventures rather than the reverse.

## Operating Context

- Visitors arrive from social (principally TikTok): mobile-first, Spanish-first,
  short attention, often cold.
- **Green World** — health products she sells and promotes. The site hosts an
  *instructional funnel page* that teaches sign-up and purchase via embedded
  video, then **hands off to the Green World website to buy**. Spanish exists
  today; English is coming. The site itself does not transact.
- **Titans Agency Latam** — her TikTok agency, which she owns.
- **TitiLinks** — her link surface.
- An authenticated `/admin` surface exists for her to manage site media and
  gallery content directly.

## Capabilities and Constraints

**Stack.** Web SPA: Vite + React 18 + TypeScript, Tailwind + shadcn/ui, React
Router, Supabase (`gallery_photos`, `site_settings`), deployed on Vercel.
Playwright covers e2e. Motion is GSAP + ScrollTrigger + Lenis, with
framer-motion also present.

**Routes today.** `/`, `/cinematic`, `/titans-agency`, `/green-world`, `/work`,
`/socials`, `/events`, `/studio`, `/admin`, OAuth consent, and a 404.

**Language.** i18next with `es` and `en`, currently at exact key parity
(622 / 622). The document defaults to `lang="es"`. **Spanish is primary; English
is parity, not a translation afterthought.**

**Load-bearing technical contracts.**
- `src/lib/hero-framing.ts` is the single owner of hero media geometry. Every
  surface that paints hero media resolves through `resolveHeroMediaStyle`; the
  ratified contract is that a preview shows exactly what publishes. Nothing else
  may hardcode `object-fit` or re-derive a transform.
- `npm run guard` statically enforces the `CROP-CORS` invariant (`crossOrigin`
  must be assigned before `.src`, or remote re-crops fail with a tainted canvas).
- Reduced-motion is honored via `useReducedMotion`.

**Explicitly not built in this repo.**
- **Blog engine — planned, not built.** A working reference implementation
  exists and is public: the JoeyC.ai Command Center
  (`github.com/jcolley2019/JoeyC.ai`) — a `generate-content` edge function with
  a model cascade, a studio UI with text and voice input, a draft/publish
  editor, blog list and post pages, RSS and sitemap. The plan is to port it into
  the titiactriz admin for Cristyna's personal use: she posts about Green World
  products, announcements, and product links. Port changes are already decided:
  **draft-by-default (a human approves every post; never auto-publish)**,
  Spanish-primary with EN parity, Green World affiliate links, and her branding.
  Gated behind the current design arc. Its strategic purpose is to feed all
  three ventures — SEO for Green World sales, visibility for acting, recruitment
  for Titans.
- No commerce or checkout. Purchase completes on the venture's own property.
- No streaming surface. `/socials` is the only social-facing route today.

## Brand Commitments

- The name **Cristyna Polentino**, and the venture names **Green World**,
  **Titans Agency Latam**, and **TitiLinks**, are owner-provided and binding.
- **Copy is owner-provided.** Names, numbers, venture claims, and titles come
  from her. They are not to be rewritten, "improved", or invented.
- Binding *visual* constraints (ground, accent, display type, act behavior,
  photography treatment) are recorded in `DESIGN.md`, which is the design
  authority. They are deliberately not restated here.

## Evidence on Hand

**Confirmed real and operating** (owner-confirmed, 2026-07-25): the Green World
supplement line she sells and promotes; Titans Agency Latam, the TikTok agency
she owns; TitiLinks; and an active streaming presence.

**In-repo assets.** Venture imagery under `public/ventures/`, TitiLinks art under
`src/assets/titilinks/`, gallery media in Supabase `gallery_photos`.

**Absences future work must not fabricate.** No testimonials, follower counts,
revenue or performance metrics, pricing, case studies, press quotes, or client
logos have been established. No blog content exists. The streaming presence is
real but has no surface in this repo yet — do not invent one's contents.

## Product Principles

1. **Persona before product.** The visitor meets her first; every venture is
   reached through her, never placed beside her as an equal.
2. **Spanish is primary.** English is parity, not a courtesy layer. Any surface
   that ships ES-only is an explicitly recorded interim state, not a default.
3. **Introduce and hand off.** The site earns the click; the venture's own
   property completes it. Adding a transaction here changes what the product is.
4. **Owner truth is immutable.** Names, claims, numbers, and titles originate
   with her. Fabrication is a correctness failure, not a style choice.
5. **Arriving from a feed sets the terms.** Mobile-first, seconds-long attention,
   cold traffic. Anything that costs the first few seconds costs the visitor.

## Accessibility & Inclusion

- ES/EN parity is a product requirement, currently held at 622 / 622 keys.
- `prefers-reduced-motion` is honored through `useReducedMotion`; the cinematic
  layer disables its animations under it.

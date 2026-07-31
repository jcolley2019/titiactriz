---
name: Titiactriz
description: A warm near-black room lit by one gold filament, where the photograph is the light source.
colors:
  ground: "#0b0a08"
  gold: "#C9A55C"
  ivory: "#f4ecdb"
  ivory-dim: "#f0e9da"
  ground-adjacent: "#0e0c09"
  ground-field: "#12100c"
  ground-chrome: "#141210"
  gw-deep-green: "#0B5D2A"
  admin-charcoal: "#121212"
  admin-tan: "#C4A86C"
typography:
  display:
    fontFamily: "Cinzel, 'Cormorant Garamond', Georgia, serif"
    fontSize: "clamp(2.75rem, 11vw, 9rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "0.05em"
  headline:
    fontFamily: "Cinzel, 'Cormorant Garamond', Georgia, serif"
    fontSize: "clamp(1.75rem, 4vw, 3.25rem)"
    fontWeight: 400
    lineHeight: 1.15
  body:
    fontFamily: "Jost, Outfit, system-ui, sans-serif"
    fontSize: "clamp(0.7rem, 1.5vw, 0.95rem)"
    fontWeight: 300
    lineHeight: 1.7
  label:
    fontFamily: "Jost, Outfit, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.25em"
rounded:
  sharp: "0px"
  admin: "0.5rem"
components:
  cta-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ivory}"
    rounded: "{rounded.sharp}"
    padding: "0.75rem 1.75rem"
    typography: "{typography.label}"
  eyebrow:
    textColor: "{colors.gold}"
    typography: "{typography.label}"
---

# Design System: Titiactriz

## Overview

**Creative North Star: "The Luminous Veil"**

The photograph is the light source. The ground is not a backdrop the image sits
on — it is what the image burns through. Every cinematic surface is a warm
near-black room (`#0b0a08`) into which a single photograph of her is admitted at
near-full brightness, and the veil laid over it is the thinnest film that still
lets type survive. A veil is not a lid. The moment the veil is doing the work
instead of the photograph, the world has failed.

One filament of metallic gold (`#C9A55C`) lights the room. It is a hairline, an
eyebrow, a letterform, a rule — never a fill, never a glow orb, never a gradient
wash. Its scarcity is what makes it read as gold rather than as yellow. Type
carries its own luminosity rather than borrowing a plate to sit on: warm ivory
(`#f4ecdb`) against the dark, glowing slightly, unboxed.

The format is theatrical. Surfaces advance as **acts** — full-bleed,
viewport-true stages that occupy the whole screen and hand off to the next.
Nothing is a card in a scroll; everything is a frame in a reel. Motion is heavy
and decelerating (`power3.out`), never springy, never bouncing: real mass coming
to rest. The interface recedes so the artifact leads.

**Key Characteristics:**

- Warm near-black ground; never pure `#000`, never a cool OLED black
- A single gold filament, used as line and letter rather than as surface
- Serif display in full caps, tight leading, at genuinely architectural scale
- Photography at near-full brightness under a `0.15–0.35` veil
- Full-bleed viewport-true acts, not a card scroll
- Square corners on cinematic surfaces; no pills, no bezels, no glass
- Decelerating GSAP motion; scrubbed parallax is linear, never eased
- Spanish and English at exact parity on every surface

### Intent

The following is the owner's brief, recorded verbatim. It is the reason the world
exists and outranks any inference drawn from the code.

> Introduce Cristyna Polentino — a visitor should feel they've met a talented
> actress, streamer, and entrepreneur within seconds. Showcase and sell her
> ventures: Green World supplements, Titans agency, TitiLinks. The blog engine
> feeds all three (SEO for Green World sales, visibility for acting, recruitment
> for Titans).

### ALWAYS — the constants

These are invariants, not preferences. A change to any line here is a change to
the identity and requires an explicit brick.

- Ground: #0b0a08 (warm near-black; never pure #000, never cool OLED black)
- Accent: #C9A55C metallic gold
- Display type: serif; ES/EN parity in every surface
- Acts are full-bleed and viewport-true (100vh+100dvh per MOBILE.VH.1; the hero
  takes 100vh+100lvh so no next act leaks behind a mobile browser bar)
- The preview is the contract: hero-framing resolver parity law is untouchable
- Photos carry the page: near-full brightness, luminous veil ~0.15–0.35, type
  carries its own glow

### Settled — the detector baseline (PIPELINE.2, 2026-07-29)

Writing this file armed the gate it is judged by: with a token spec to compare
against, the dormant `design-system-*` rules fire. `.impeccable/config.json` now
encodes the exemption the detector could not see: the admin-exempt layer
(`src/components/admin/**`, the events components, the `_archive`, the editorial
home variant, and the legacy `:root` values in `src/index.css`) is ignored for
`design-system-*` rules only — every other rule still applies everywhere. At the
PIPELINE.2 census the raw count was **77**; the exempt layer held **25** of
those, and deleting the two ratified-dead items (`--transition-bounce`,
`.text-gradient-gold`) removed two more. The normative baseline is **50**. That
number is the gate: a brick that raises it introduces drift; a brick that lowers
it retires debt owed to CINE.FLOW.

### Motion

The cinematic layer's easing vocabulary is GSAP's power curves, extracted from
the incumbent implementation: `power3.out` is the default entrance (6 uses),
`power3.inOut` drives symmetric reveals such as the Green World curtains,
`power2.out` handles smaller lifts, and `ease: "none"` is used deliberately for
scroll-scrubbed parallax so travel maps linearly to scroll position. Durations
cluster at `0.5s–0.9s` with a `0.12s` stagger. Lenis provides inertial smooth
scroll; ScrollTrigger owns the pinned stages.

**The Dead-Stop Rule.** Motion decelerates into place and stops. Nothing
overshoots, springs back, or bounces. If a curve's control points exceed 1, it
does not belong on a cinematic surface.

**Resolved — bounce easing (PIPELINE.2, 2026-07-29).** The legacy
`--transition-bounce` token (`cubic-bezier(0.34, 1.56, 0.64, 1)`) is **deleted**
from `src/index.css`. It had zero references anywhere, and its control points
exceed 1, which the Dead-Stop Rule bans outright. The ban stands; the token is
gone.

## Colors

A warm, low-chroma darkness lit by one metallic accent — the palette of a
screening room, not of a product page.

### Primary

- **Filament Gold** (`#C9A55C`): the single accent. It appears as hairline rules
  and inset outlines (`rgba(201,165,92,0.4)` on the About panel), as eyebrow
  labels above headings, as one line of the hero wordmark, as the CTA border,
  and as the scroll-cue's fading stroke. It is never a background fill and never
  a gradient wash across type.

### Neutral

- **Warm Near-Black** (`#0b0a08`): the ground of every cinematic surface, the
  backdrop painted behind all framed media (so that a sub-cover scale reveals
  brand-dark edges rather than transparency), and the base of every veil, always
  expressed as `rgba(11,10,8,α)`.
- **Warm Ivory** (`#f4ecdb`): display and body type over the dark. Carries its
  own slight glow rather than sitting on a plate.
- **Dimmed Ivory** (`#f0e9da`): secondary and supporting type, typically at
  reduced opacity for scroll cues and captions.

### Secondary grounds

The ground is not one value but a short family of warm near-blacks, each a
named step with a job. All of them stay inside the Warm Dark Rule's world.

- **Adjacent Ground** (`#0e0c09`): the room one step lighter than the ground —
  the Contact act's field and the TitiLinks landing. Used where an act carries
  no photograph and needs to read as its own opaque room beside the
  photographic acts, and as the ink on the one solid-gold surface (the
  Contact submit button's text).
- **Field-Input Ground** (`#12100c`): form surfaces. The Contact inputs sit on
  it at 70% opacity so the field reads as a shallow recess in the room's wall,
  not a plate.
- **Chrome Ground** (`#141210`): simulated device chrome and media fallback —
  the TitiLinks phone's browser bar and the reel's pre-media fallback surface.
  A component-surface step, never an act ground.
- **Field family** (the wide reel's spread): `FIELD_GROUND` (`#0b0a08`, the
  ground restated as an exported constant), the sibling `CHAPTER_GROUND_1..3`
  shades recorded under the REVIEW.2 decision below, `FIELD_LIGHT`
  (`linear-gradient(180deg, rgba(244,236,219,0.05) 0%, rgba(244,236,219,0.015)
  42%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.24) 100%)` — the barely-there ivory
  luminance that keeps the field from reading as a dead fill), and `SEAM_GOLD`
  (`rgba(201,165,92,0.55)`, the chapter/plate seam at the ratified frame
  opacity).

### Venture accents (gated)

Two ventures carry their own brand accents. Both are **gated to their own
surfaces**: their appearance anywhere outside the named scope is drift, exactly
as `#121212` on a public surface would be.

- **Titans reds** — kicker `#E24A54` (the brand red brightened so it holds AA
  over the dark art) and CTA `#C41E2A` (the on-brand solid, white text).
  Scope: the Titans act and the `/titans-agency` page only.
- **Deep Green** (`#0B5D2A`) — the Green World act's type accent, deliberately
  much darker than the logo's `#12A03B`, which cannot hold against the bright
  plate. Scope: the Green World act's bright-water surfaces only. This is the
  One Filament Rule's single ratified exception; see the amendment below and
  the Green World grammar under Layout.

### The gold alpha ladder

Gold appears at fixed alpha steps of `rgba(201,165,92,α)`, and the step *is*
the meaning — three bands, from substance to air:

- **`1.0`** — the filament itself: letterforms, eyebrows, the CTA border, solid
  hairline rules. Gold as line and letter.
- **`0.85` / `0.65` / `0.5` (glow band)** — light *around* a gold line, never a
  surface: the TitiLinks exit-shimmer's peak (`0.85`), the bloom on the moving
  progress rule (`0.65`), the halo on a gold-bordered overlay and the success
  border (`0.5`). Always a `drop-shadow`/`box-shadow` or a border, never a fill.
- **`0.55`** — the **ratified frame opacity**: the wide plate's hairline, the
  spread seam (`SEAM_GOLD`), the lightbox frame. A gold edge that must read as
  drawn, not glowing.
- **`0.4` / `0.35` (structure band)** — hairlines at rest on or beside
  photography: the About panel's inset outline and tag borders (`0.4`), side
  rails, input borders, and ambient edge glows (`0.35`). Present, not
  assertive.
- **`0.12` / `0.1` / `0.08` (atmosphere band)** — gold as air: edgeless radial
  tints over a stage (`0.12`, `0.1`), the fill of a gold-bordered chip and the
  success wash (`0.12`, `0.08`). At these alphas gold may be an area — it has
  no edge and reads as warmth, not as a second accent.
- **`0`** — the terminus of every fading gold gradient (scroll-cue rule,
  shimmer rest state).

New gold must land on an existing step with the step's meaning; a new alpha is
a design-system change, not a tweak.

### Admin-exempt (not normative)

- **Legacy Charcoal** (`#121212`) and **Legacy Tan** (`#C4A86C`): the older
  `:root` HSL system in `src/index.css`, commented "inspired by
  mistytrevino.com". It powers `/admin` and the shadcn primitives.

**The One Filament Rule (amended PIPELINE.2, 2026-07-29).** Exactly one accent
lights the room. Gold appears as line, letter, or rule — never as a filled
surface, never as a second accent alongside it, and never blended into another
hue. If a screen reads as "gold themed" rather than as dark with a gold detail,
there is too much of it. **One exception is ratified, and it is scoped:** the
Green World act sets its type accent in Deep Green (`#0B5D2A`), because that
act flips polarity to dark ink on bright water and gold cannot survive there at
any weight (measured `1.0:1`). The exception belongs to that single act — on
every other cinematic surface, gold remains the only accent, and the venture
reds stay behind their own gate.

**The Warm Dark Rule.** The ground is `#0b0a08` and its veils are
`rgba(11,10,8,α)`. Pure `#000` and cool blue-blacks are both regressions: the
warmth is what lets her skin tones sit in the frame without going waxy.

**The Two Systems Rule.** The cinematic palette is normative for everything a
visitor sees. `/admin` and the shadcn internals are explicitly exempt and may
keep the legacy `:root` tokens. Any appearance of `#121212` or `#C4A86C` on a
public surface is drift, not a choice.

**Resolved — gradient text (PIPELINE.2, 2026-07-29).** `.text-gradient-gold`
(`bg-clip-text` over `from-accent via-gold-light to-accent`) is **deleted** from
`src/index.css`. A repo-wide search confirmed zero call sites — it was dead code,
and a gradient wash across type is exactly what the One Filament Rule prohibits.
It is not the gold treatment; the gold treatment is line, letter, and rule.

## Typography

**Display Font:** Cinzel (with Cormorant Garamond, Georgia, serif)
**Body Font:** Jost (with Outfit, system-ui, sans-serif)

Bound at the cinematic root as `--font-display` and `--font-sans`. Tailwind's
`font-serif` resolves to Cormorant Garamond for the non-cinematic surfaces.

**Character:** An engraved Roman capital against a geometric humanist sans. Cinzel
supplies the monumentality — it is a letterform cut into stone, not printed —
while Jost keeps the supporting text quiet, light, and modern enough that the
serif never tips into period pastiche.

### Hierarchy

- **Display** (400, `clamp(2.75rem, 11vw, 9rem)`, line-height `0.92`, tracking
  `0.05em`, uppercase): the hero wordmark only. Set in two blocks — ivory over
  gold — with per-letter GSAP reveal. The `0.92` leading is deliberate: the lines
  must lock together as a mass.
- **Headline** (400, `clamp(1.75rem, 4vw, 3.25rem)`): act titles, e.g. the About
  heading. Display family, sentence-scale leading.
- **Body** (300, `clamp(0.7rem, 1.5vw, 0.95rem)`, line-height ~1.7): supporting
  paragraphs and hero subtitle. Kept light and generously leaded.
- **Label** (500, `0.75rem`, tracking `0.25em`, uppercase, sans): the `.text-caps`
  utility. Eyebrows above headings (in gold), CTA text (tracking `0.2em`), and
  scroll cues (`0.625rem`, tracking `0.3em`).
- **Nav label** (300, `0.75rem`, stepping to `13px` at `lg`, tracking `0.16em`,
  uppercase, sans): the fixed header's links (Header.tsx `linkBase`). The one
  pixel above **Label** on large screens is ratified, not drift: it predates the
  ramp (shipped 2026-06-04, approved by exposure ever since), and the nav is the
  ramp's one surface that must hold legibility with NO bar behind it over moving
  photography (NAV.CLEAR.1's halo-not-panel law) at a wide `0.16em` track.
  Ratified 2026-07-31, closing the design-detector advisory on Header's
  `lg:text-[13px]`.

**Reel lockup steps** (CINE.FLOW.5). The reel's two acts are different
compositions, not one composition at two sizes, so each sets its own pair —
display family, gold numeral over ivory title:

- **Reel numeral, phone** (400, `66px` flat, tracking none, gold): the promoted
  V1 mark. Fixed rather than fluid because it is a compositional element sized
  against the frame's foot, not a text size.
- **Reel title, phone** (400, `clamp(1.5rem, 7.2vw, 1.75rem)`, leading `1.1`,
  tracking `0.06em`, uppercase): bounded so the longest title shrinks instead of
  wrapping at 360 (Galaxy S26). The ceiling is the **Headline** floor.
- **Reel numeral, wide** (400, `clamp(1.375rem, 2.5vw, 2.375rem)` → 22–38px,
  tracking `0.12em` with a matching `text-indent` so tracking's trailing space
  does not drag it left of true centre between its rules).
- **Reel title, wide** (400, `clamp(1.75rem, 3.2vw, 3rem)` → 28–48px, leading
  `1.1`, tracking `0.06em`, uppercase): the floor equals the phone title's
  ceiling, so the **title** is continuous across the 768px line.

Both wide steps are computed in px against the act's **measured frame**, not in
CSS `vw` — the reel's frame is a pinned stage, and viewport units would describe
the window instead of the box.

The **numeral** is deliberately *not* continuous across the breakpoint: 66px
below it, 22px just above. That is not drift. The two acts are different
compositions — edge-to-edge cover with the numeral as the lockup's mass, versus
a bounded plate with the numeral as an engraved caption — and the numeral
changes role with them.

**The Unboxed Type Rule.** Type earns legibility from its own weight, color, and
the veil beneath it — never from a plate, chip, or panel drawn behind it. If text
needs a box to be readable, the veil is wrong, not the type.

**The Parity Rule.** Every string ships in Spanish and English. ES and EN locale
files are held at exact key parity (625 / 625 today). Spanish is primary; English
is parity, not a follow-up.

## Layout

**Acts.** The cinematic page is a sequence of full-bleed, viewport-true acts.
The hero uses `.cine-act-lvh` — `100vh` then `100lvh` — so it covers the full
*physical* screen and nothing but the hero can ever sit behind a floating mobile
browser bar; it overflows by the chrome's height while the chrome is shown, a
deliberate trade the hero can absorb. Mid-page acts (Green World, Titans) use
`.cine-act-vh`, which declares `100vh` and then `100dvh` on mobile so the act
covers exactly the visible viewport as browser chrome collapses — as does the
Book announcement, which is pinned but *held* rather than scrubbed (BOOK.ACT.2).
Pinned SCRUB stages (the reel, TitiLinks) deliberately stay on `svh`:
ScrollTrigger writes pixel dimensions at refresh time, and a `dvh` stage would be
re-measured taller and jump mid-scrub when the URL bar retracts. A held act has
no playhead to jump, so it takes `dvh` and the coverage guarantee. Every
full-viewport section reserves its height in CSS before any JS or media loads, so
the document is never momentarily short on first paint.

**Act padding.** `1.5rem` horizontal, `6rem` top, `4rem` bottom — top-weighted to
clear the fixed header. These values are description, not machine tokens: no
code reads a spacing scale, so the former frontmatter `spacing:` block was
deleted (PIPELINE.2) rather than left implying one exists.

**Breakpoints.** `xs 480 · sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. The
container centers with `2rem` padding and caps at `1400px` — a constraint that
applies to the editorial surfaces, not to full-bleed acts, which are edge-to-edge
by definition.

**The editorial split.** At `md+`, the About act becomes a named-grid two-column
layout (`minmax(0,1fr)` and a photo rail, `3rem` gap) in which a single panel node
reflows from mid-column on mobile to a full-height right rail on desktop — one DOM
node, no duplication, no gap left behind. **The rail IS the plate** (ADMIN.ABOUT.3):
its width is `plateBox`'s own output, not a clamp that approximates one, so an About
plate and a reel plate at the same viewport are the same box. The copy column narrows
to a `456px` floor before the container is allowed to grow past `64rem`.

**The Full-Bleed Rule.** Cinematic acts are edge-to-edge and viewport-true. A
max-width container, a visible gutter, or a card boundary on an act is a
regression — the frame is the viewport.

### Settled — the reel's two compositions (CINE.FLOW.5, 2026-07-26)

Three decisions, taken on the bake-off evidence and recorded here because each
one narrows what a later brick may do:

1. **The wide reel adopts W2 "Center Plate & Rules."** Above 768px the act is a
   bounded portrait plate (`aspect 0.563`, height `76vh` capped at `60vw` —
   smaller box wins), centred, top edge at `8vh`, in a `1px rgba(201,165,92,0.55)`
   gold hairline frame, hung between two vertical gold hairlines at 18% and 82%
   of the frame at `0.35` opacity, over a full-frame ambient backdrop of the
   slide's own photograph (`blur(64px) brightness(0.35) saturate(0.9)`, scaled
   `1.1`, and **never animated**). The lockup is captioned in the band beneath,
   with at least `3vh` clear above and below. The letterboxed rendering it
   replaces is retired.

   ADMIN.ASPECT.1 narrows this: the portrait plate described here is now the
   DEFAULT shape rather than the only one, and a slide may instead choose a 3:2
   landscape plate. Everything else in this paragraph stands.

   This is a deliberate exception to nothing: the plate is a *frame within the
   act*, not a card. The act itself is still full-bleed and viewport-true — the
   backdrop reaches every edge — so the Full-Bleed Rule holds. What the plate
   rejects is **cover at desktop widths**, where a portrait source keeps only
   24–42% of the photograph. Showing less of her to fill the frame was the worse
   trade.

2. **`WIDE_VEIL` is deleted, not merely unreferenced.** See the veil law under
   Elevation & Depth. Restoring a full-frame wash above the breakpoint is a
   regression, and the specs assert the absence rather than the value.

3. **`reelSlideFit` is retired.** Both acts crop to their subject now — the
   phone against the viewport, the plate against its own box — so the letterbox
   fit mode has no caller anywhere in the reel, live or admin. Every reel
   surface reports `fill`.

Bake-off variants V1–V5 and w1–w3 are kept as museum pieces under
`src/components/qa/reel-bakeoff/`. Live code does not import from `qa/`, so the
promoted primitives were copied into `src/components/cinematic/reelWide.tsx`
rather than shared; the harness copy is frozen and is not a second source of
truth for anything that ships.

### Settled — the wide reel is an editorial spread (CINE.FLOW.6, 2026-07-29)

Above 768px each numbered slide is a two-page STORY SPREAD: the W2 portrait
plate (its laws unchanged — true portrait aspect, gold hairline outline,
unveiled) hangs centred in the photo page while a story chapter occupies the
other page, the sides alternating per slide (01 plate-left/copy-right, 02
flipped, 03 as 01). The chapter column takes `0.42` of the frame and sits on
the SAME field treatment HERO.WIDE.1 ratified for the hero's side fields — its
exact exported tokens (warm near-black ground, the barely-there ivory luminance
gradient, one restrained corner-ornament filigree) — with a `1px
rgba(201,165,92,0.55)` gold seam at the chapter/plate junction. The chapter is
the gold numeral eyebrow (01/02/03 at the wide numeral step, hairline, role
label), a headline at the wide title step, and one short paragraph.

Three consequences:

- W2's centred caption band and its two 18%/82% hairlines are **superseded
  everywhere**; the seam is the spread's one vertical gold line. (The admin
  SectionPreview restated the frozen W2 mirror through REEL.COPY.1's era — a
  recorded drift repaid by MIRROR.SYNC.1, 2026-07-31: the wide mirror now
  restates this spread, the drag math sizes the plate against the photo page
  exactly as the live act does, and the orphaned W2 constants are deleted.)
- The chapter FIELD is **not a veil** — an opaque ground beside the
  photograph, never over it. The veil law is untouched: the wide plate still
  carries none.
- The chapter copy is seeded STRICTLY from already-shipped strings (no new
  biographical claims) in `reelChapters.ts`, ES primary with EN parity, and is
  overridable per chapter through the site_settings keys `reel.chapter1..3` —
  the contract a later admin copy editor writes against.

### Settled — spreads are tonal rooms; the frame draws itself (REVIEW.2, 2026-07-29)

Ratified on Joey's direction. Three decisions:

1. **Each spread is ONE continuous field.** The blurred ambient backdrop is
   retired from the live wide act: both sides of the seam sit on a single
   uninterrupted ground, edge to edge, under the HERO.WIDE.1 luminance
   gradient. The seam is a hairline on the room's wall, not the join of two
   materials. (`AmbientBackdrop` outlived the live act only for the admin
   SectionPreview's frozen W2 mirror; MIRROR.SYNC.1 retired both.)

2. **The three chapters carry sibling tonal shades.** `CHAPTER_GROUND_1..3`
   (`#0d0b08`, `#0b0b0a`, `#080706`), defined beside `FIELD_GROUND` in
   `FramedVideo.tsx`, are derived from it by shifting luminance/warmth one
   small step per chapter — warmer/lighter, cooled at base luminance, deeper —
   all inside the warm near-black world. The difference is felt in succession,
   invisible in isolation; the three grounds must differ from each other.

3. **The plate's gold frame is a scroll-drawn line.** The hairline renders as
   an SVG rect (`pathLength` 1, stroke `rgba(201,165,92,0.55)`) whose
   dashoffset the PINNED timeline scrubs 1 → 0 on the slide's own entrance
   slot — never free-running — completing before the slide's dead-stop. The
   corner filigree (outer-corner law: one per spread, at the copy column's
   outer top corner, mirrored per alternation) blooms in only AFTER the line
   completes. The markup state is the finished frame, so reduced motion — and
   any surface that never wires the ref — renders frame and filigree complete
   and static, no draw.

### Settled — the scroll grammar: dwells, pins, and dead zones (REVIEW.3a, 2026-07-29)

The page's scroll cost is a ruled vocabulary with exactly two prices:

1. **Story acts dwell `+=120%`.** The gallery, the **Book announcement**
   (BOOK.ACT.2), About, and Contact each pin (`start: "top top"`,
   `end: "+=120%"`) and hold their frame for 120% of a viewport before
   releasing — the uniform dwell law: every story act earns the same beat of
   stillness, no act more. A pinned act keeps its pointer events, so the Contact
   form stays fully usable and the Book CTA stays clickable through the dwell.
   **The footer never pins.** Reduced motion skips every pin.
2. **The scrub showcases pin `+=300%`.** The reel, TitiLinks, and the Green
   World sequence each hold for three viewports
   (`SEQ_PIN_DURATION = "+=300%"`) — the price of a scrubbed performance,
   uniform across all three. These three are the *only* showcases; an act with a
   scrubbed entrance but nothing to perform is a story act and takes the story
   price, which is what moved the Book act off the showcase side of the line.
3. **Scrubbed sequences carry dead zones.** Frame-scrubbed acts map pin
   progress through `SEQ_LEAD_IN = 0.08` and `SEQ_LEAD_OUT = 0.08`: the first
   frame holds while the act settles, the final frame holds before release, and
   both zones **clamp** — over-scrolling cannot push the playhead past its end.
   The clamp is what produces the dead stop; without it the sequence reads as
   already moving when it arrives and still moving when it leaves.

**The Dwell Law.** A story act pins for `+=120%`; a showcase pins for
`+=300%`; the footer never pins. A new act chooses one of the two prices — a
third duration is a design-system change, not a tuning.

**A pinned act owns its full ground** (BOOK.ACT.2). An act that holds the frame
must *cover* the frame: its ground reaches the bottom edge at the settled
position and at every point of the hold, so no strip of the next act shows
beneath it. This is what a short stage costs — the Book act at `min-h-[80svh]`
left 180px of Green World's bright water visible under it at 1440×900. A held
act is therefore a full-viewport stage on the acts' own height grammar
(`.cine-act-vh`), with `min-height` and never `height`, so long copy grows the
stage instead of being clipped by it. This does not soften the `svh`-on-pinned
rule under Do's and Don'ts: that rule protects a *scrubbed* stage, whose playhead
would jump if the stage re-measured mid-scrub. A held act has no playhead to
jump, and covering the visible viewport is the stronger requirement — so a story
act's dwell takes `dvh`, and only the scrub showcases stay on `svh`.

### Settled — the Green World act: dark ink on bright water (GW.COPY.5 → REVIEW.3b, 2026-07-29)

The Green World act is the site's one polarity flip, and every piece of it is
ruled:

- **Dark ink, not light type.** Every other act is warm ivory over a
  photograph burning through the dark. The Green World plates are the opposite
  — near-white water, bright end to end — and over the composited ground the
  ivory measured only `2.1:1` and the gold `1.0:1`. So the type flips to
  `INK = #0b0a08`: warm near-black on bright water, the same relationship the
  brand's own black wordmark already has with the plate. Never pure `#000`,
  for the same reason the ground isn't.
- **The accent is Deep Green** (`#0B5D2A`) — the One Filament Rule's single
  scoped exception, recorded under Colors. It is deliberately far darker than
  the logo's `#12A03B`, which is itself too light to hold on the plate.
- **`PLATE_GRADE = brightness(1.03) saturate(1.35)`**, with a **<1% clip
  budget**: `1.04` breaks the budget at 390px and `1.05` blew 2.3% of the frame
  to pure white. The grade may not be raised without re-measuring clipping
  against the shipped frame pack.
- **The scrim is a handoff, not legibility** (GW.VEIL.2):
  `linear-gradient(180deg, rgba(11,10,8,0) 76%, rgba(11,10,8,0.45) 93%,
  rgba(11,10,8,0.88) 100%)`. Fully clear through the entire stack — logo, copy,
  and button all sit on unveiled water — taking hold only in the last eighth
  of the stage to hand off to the next act. Darkening earlier both dulls the
  plate and actively hurts the dark type now sitting on it.
- **The lockup arrives on two latches, sequenced** (REVIEW.3b): the body line
  lands at mapped progress `0.15` (`BODY_REVEAL_AT`) and the button follows
  one beat later at `0.25` (`CTA_REVEAL_AT = BODY_REVEAL_AT + 0.1`) — never
  simultaneous; the reader is given the sentence before the ask. Both are
  latches, not scrubbed values: one comparison per frame, one tween per
  crossing, clean in both directions, and the CTA layer takes a pointer only
  once it has arrived.

### Settled — the wide plate has two shapes, chosen per slide (ADMIN.ASPECT.1, 2026-07-29)

Ratified on Joey's direction: a landscape photograph must not be forced into a
portrait plate on desktop. Each wide reel slide now chooses its plate's **shape**,
and the choice is a **wide-only** one — the phone act is edge-to-edge and hangs no
plate, so it has no opinion to store and ignores the field entirely.

- **Portrait (the default) is unchanged.** `aspect 0.563`, height `76vh` capped at
  `60vw` of the photo page — the W2 plate, arithmetic included. Every slide that
  predates this decision, and every slide left on portrait, renders and *stores*
  byte-identically: the field is written only when landscape is chosen, so absent
  ≡ portrait, exactly as an absent `about` key means "no panel".
- **Landscape is `3:2`** — `aspect 1.5`, height `52vh` capped at `78vw` of the
  photo page. 3:2 over 16:10 because this is a photographer's plate, not a
  screen: it is the frame a full-frame camera hands over, and it is the deeper of
  the two candidates at every supported wide frame, which keeps the plate reading
  as the spread's photo *page* beside a full-height copy column rather than as a
  banner. The landscape shape carries **its own two fractions** and cannot
  inherit the portrait pair: at `76vh` a 3:2 box would be `114vw` wide, so the
  width cap would govern at every frame and the height rule would be dead
  arithmetic. The pair is the landscape reading of the same intent — the wider
  page (`78%` against `60%`) and the shallower one (`52%` against `76%`) — so a
  landscape slide is visibly wider and shallower than a portrait one everywhere.
  At 1440×900 that is a `651×434` plate against portrait's `385×684`.
- **One law, three surfaces, still.** Both shapes are declared once (`plateLaw`)
  and sized by the one unchanged "smaller box wins" comparison (`plateBox`), which
  the live act, the admin drag math (`previewMediaFrame`) and the admin CSS mirror
  all read. Everything hung *on* the plate is shape-blind because it measures the
  plate rather than restating its aspect: the self-drawing gold hairline frame, the
  filigree bloom, the gold seam, the tonal ground, and the vertical centring —
  `max(PLATE_TOP_VH, (frame − plate) / 2)`, whose clamp only ever binds on the tall
  portrait plate at short frames, so a shallow landscape plate centres against the
  copy column with no second rule.
- **The choice lives on the WIDE framing record** (`reel[i].wide.plate`), beside
  that record's focal and zoom, because it belongs to the composition that record
  serves. The **phone** class is parsed *without* the field, so it can never carry
  one. (ADMIN.ABOUT.2 extended the field to `about.wide.plate` on identical terms;
  the phone half of this law is untouched.) The admin offers a Portrait / Landscape
  toggle on the wide tabs (iPad and Desktop both render the wide composition and
  both edit its one record — the same reason the zoom slider governs both), in the
  same control grammar as the hero video's Fill / Fit pair.
- **Reset does not undo the shape.** Reset is a transform control (ADMIN.RESET.1a):
  it recentres and unzooms *inside* the chosen plate and leaves the plate standing,
  for the same reason it does not clear the slot's photo.

### Settled — the About photo is a reel-class surface (ADMIN.ABOUT.2, 2026-07-30)

Joey's ruling, and it is total: **the About photo is not a special case of anything.**
It is a reel-class surface, governed by the plate law, edited by the reel's editor.
This **supersedes the ABOUT.MEDIA.1 record that the panel is a fixed `3:4` frame
everywhere** — that shape is gone from the live panel, from the editor canvas, and
from the code (`ABOUT_PANEL_ASPECT` is deleted, not deprecated).

- **The panel is a plate.** Its box is `plateLaw`'s — the same function the wide reel
  act sizes its plate with. The **phone** class paints the portrait plate (`0.563`)
  and can paint nothing else, because a phone record stores no shape; the **wide**
  class paints the shape its record chose, portrait or the `3:2` landscape plate.
  One law, and now four surfaces read it: the live act, the live About panel, the
  admin drag math (`previewMediaFrame`), and the admin CSS mirror.
- **The layout adapts to the shape, never the shape to the layout.** The md+ rail is
  a function of the panel's plate, and a landscape page is the wider one. *(The two
  `clamp()` rails this brick shipped are superseded by ADMIN.ABOUT.3 below — the rail
  is the plate's own width now.)* The act's grammar is untouched: same named grid,
  same line-by-line reveal, same `+=120%` dwell.
- **The panel keeps its own quiet frame.** It is the plate's *box*, not the reel
  act's plate *chrome*: no ambient backdrop, no W2 rules, no self-drawing gold line,
  no filigree, no lockup — one `rgba(201,165,92,0.4)` inset outline, as recorded
  under Shapes. The reel's chrome belongs to the reel's act.
- **The editor is the reel's editor, verbatim.** Not a parallel path: the same
  component, the same device tabs at the same **device-shaped** canvas, the same
  zoom slider, pan, Reset, Cancel and Save — and the same Portrait / Landscape
  toggle on the wide tabs. `FramingEditor` holds no About branch beyond the two
  things that were always per-kind: the default focal a Reset restores, and the
  zoom floor (About is cover, so `1`).
- **What is still About's own** is the panel's *opt-in* nature (an absent or
  unresolvable `about` renders no panel at all — no pool fallback, unlike a reel
  slide) and its place in the section's editorial split.

### Settled — the About plate is SIZED by the plate law (ADMIN.ABOUT.3, 2026-07-30)

ABOUT.2 gave the panel the plate law's **shape** but left ABOUT.MEDIA.1's rail clamp
holding its **size**. A clamp stops growing and the plate law does not, so the two
surfaces drifted apart the wider the frame got: at `1920×1080` a reel portrait plate
measured `462px` and the About plate `400px`; a landscape reel plate `842px` against
`520px`. Joey's ruling: **About's plate takes the reel plate's sizing law — same
height caps, same proportions — and the section's layout adapts around it.**

- **The rail is the plate, not a clamp shaped like one.** `plateBox`'s two rules
  reach the stylesheet as the plate WIDTH each implies — `--cine-plate-w-from-height`
  (`heightVh × aspect`, in `svh`) and `--cine-plate-w-cap` (`maxWidthVw × 0.58`, in
  `vw`) — both computed from `plateLaw` in `CinematicAbout`. CSS `min()` of the pair
  IS the law's "smaller box wins" comparison, evaluated live against the viewport, so
  the rail needs no measurement pass and no resize listener. **Both `clamp()` rails
  are deleted, not deprecated.**
- **The frame is the reel's frame, deliberately.** `svh` is what the reel's pinned
  stage is declared at, and the width cap is taken against the act's PHOTO PAGE — the
  frame minus the copy column, the same `CHAPTER_FIELD_FRACTION` split `CinematicReel`
  feeds `plateBox`. Feed the law a different frame and the two plates stop matching,
  which is the whole defect. Verified: at `1440×900` both plates measure `385.08 ×
  684.00` portrait and `651.45 × 434.30` landscape, to the pixel.
- **The height cap applies at BOTH classes; the width cap is a wide-class rule.** The
  phone act is edge-to-edge and hangs no plate, so that class has no photo page for a
  width cap to measure against — the panel fills its column, trimmed by the law's
  height rule. At `390×844` this is today's panel unchanged (`342 × 607`); at
  `390×667` the cap now binds and the plate no longer overruns the viewport.
- **The layout adapts to the plate, never the plate to the layout.** The copy column
  narrows first — down to a `456px` floor, the measure ABOUT.2 already ratified as
  true — and only once it would go under does the container grow past `64rem`.
  Without that second step a landscape plate at `1920` leaves the copy a `134px`
  gutter. `min(100%, …)` keeps the whole container inside the act's `px-6` at every
  frame. Act grammar and dwell are untouched.
- **Reduced motion is the one place the two differ, and it is the reel that moves.**
  The reel act collapses to `70svh` slides under reduced motion and its plate shrinks
  with them — its own pre-existing law. About has no scrubbed stage to collapse, so
  it stays at the law's declared frame. Parity is therefore asserted against
  `plateBox` restated, and against the reel *under motion*.

## Elevation & Depth

This system has **no shadow vocabulary on cinematic surfaces**. Depth is
atmospheric, not architectural: it comes from graded veils over photography, from
scale and parallax under scroll, and from a single gold hairline that reads as an
edge rather than as a lift.

The veils are directional gradients, not flat washes — heavier where type lands,
open where the photograph should breathe:

- **Hero veil** (`linear-gradient(180deg, rgba(11,10,8,0.72) 0%, 0.42 38%, 0.60
  72%, 0.92 100%)`): opens at the middle so her face stays lit, closes hard at
  the bottom edge to hand off to the next act.
- **Titans veil** (`0.28 → 0 at 32% → 0.35 at 60% → 0.9 at 100%`): fully
  transparent through the upper third; all suppression lives in the lower third
  where the type sits.

The legacy `--shadow-soft / card / elevated / glow` tokens exist in the
admin-exempt layer and have no role in the cinematic world.

**The Atmosphere-Not-Elevation Rule.** Depth is made of light and distance, never
of a drop shadow. Nothing on a cinematic surface floats above the ground plane.

- **Reel edge veil** (phone only): `linear-gradient(180deg, 0 0%, 0 54%, 0.16
  70%, 0.32 100%)`. A veil as a *weight at the foot of the frame*: the
  photograph is completely unveiled through its top 54%, suppression begins only
  where the lockup lands, and it deepens to `0.32` at the bottom edge, which
  doubles as the hand-off to the next act. Same move as the hero and Titans
  veils, and its peak sits inside the mandated band.

**What a veil is for.** A veil exists for exactly one reason: **to protect type
set over photography.** It is not atmosphere, not a mood wash, and not a way to
calm a busy picture. Two consequences, and both are now load-bearing:

- Where type crosses the photograph, the veil is the thinnest film that keeps it
  legible, and it is directional — open where the photograph carries the image,
  weighted only where the type actually lands.
- **Where type does not cross the photograph, there is no veil at all.** A
  composition that moves its type off the picture does not earn a lighter veil;
  it earns none. Darkening a photograph that carries no type over it is a cost
  with no benefit.

**Seam skirt (MOBILE.EDGE.3)** — a scoped second purpose of the veil law, ruled
alongside GW.VEIL.2, not an exception to it: "Seam skirt: a short (~110px)
#0b0a08→transparent fade at the top edge of an act, permitted solely where the
successor's bright content can sit under mobile browser chrome at a rest
position. It protects the seam, never the composition — it may not grow, darken
mid-act, or migrate into a photographic veil." Ruled at exactly one boundary:
hero→reel. The hero's foot paints near-black to its last pixel, but Safari's
expanded bottom bar is taller than the hero's `lvh−svh` overflow, so at the rest
position the bar's lower rows sampled the reel's first rows directly — sky at
mean luminance ~190, glowing through the chrome. The skirt is a child of the
reel SECTION, never of its pinned stage, so it rides the seam and has left the
screen before the scrub plays; the GAP between hero.bottom and reel.top stays
exactly 0 (spec-asserted, mobileedge suite E). It renders on the phone
composition only, split on the act's own breakpoint: a wide viewport has no
mobile bottom chrome to guard against, so a skirt there is this law's own "cost
with no benefit", and the wide section's gradient census stays exactly the
three rooms' luminance light. And it YIELDS on approach (MOBILE.EDGE.4, Joey's
eye 2026-07-31: the static fade read as a very noticeable smudge on slide 01's
sky): its opacity is scrubbed from full at the fold's rest position to zero
before the seam passes the viewport's upper two-thirds — the chrome that needed
it collapses on the first scroll, so past the window the photograph is bare and
the slide's dwell shows unveiled art. No other boundary wears one without its
own ruling; the Book→Green World case (audited at 204/211, the page's brightest
boundary) was reviewed and ruled FINE as-is on-device.

**Resolved — the reel veil.** The flat
`linear-gradient(180deg, rgba(11,10,8,0.5), rgba(11,10,8,0.8))` wash —
undirected, squarely in the banned 50–80% range and outside the mandated
`0.15–0.35` — is **gone from both device classes**, and the constant that held
it (`WIDE_VEIL`) is deleted rather than merely unreferenced. This closes the
violation this document has carried since TA.2.

Settled by bake-off across CINE.FLOW.2 → CINE.FLOW.5
(`62fcb19..d524529`, 2026-07-25 → 2026-07-26):

- **Phone (< 768px)** carries the edge veil above, promoted from bake-off
  variant V1. It replaces the CINE.FLOW.4C treatment (an unveiled photograph
  under a scrim bound to the lockup's own box), which is superseded — where the
  two conflicted, V1 won. The type still sits over the photograph here, so a
  veil is still owed; it is just directional and inside the band now.
- **Wide (≥ 768px)** carries **no veil**, promoted from variant W2. The
  letterboxed rendering is retired entirely in favour of a bounded portrait
  plate on an ambient backdrop, with the lockup captioned *below* the plate. No
  type crosses the photograph, so by the rule above the plate renders unveiled;
  the blurred, darkened backdrop is what carries the caption's legibility.

The focal-anchored radial spotlight CINE.FLOW.3 introduced on phones is retired
with the rest — it was a lens rather than a curtain, but it still darkened a
whole photograph to buy four lines of type their contrast. Its resolver survives
as `spotlightCentre`, which is now simply the reel's one focal source and is
read by the wide plate.

## Shapes

The form language is **square and cut**. Cinematic surfaces have no border radius
at all: the CTA is a sharp-cornered rectangle, the About panel is a hard-cornered
plate (its aspect is the plate law's — ADMIN.ABOUT.2), and media fills its container
edge-to-edge. Corners are where the frame ends, not a softness to be sanded off.

Borders are hairlines and are usually *outlines*, not borders. The About panel
uses `outline: 1px solid rgba(201,165,92,0.4)` with `outline-offset: -1px`
specifically because an outline sits outside the box model — a real border would
shrink the measured child by 1px per axis and break the framing parity between the
editor canvas and the live panel. This is a parity constraint expressed as a shape
decision.

The `0.5rem` radius scale (`--radius`) belongs to the admin-exempt shadcn layer.

**The Hard-Corner Rule.** Radius on a cinematic surface is zero. Pills, squircles,
`rounded-[2rem]` shells, and nested bezels are all foreign bodies here.

## Components

### Buttons

- **Shape:** sharp rectangle (radius `0`), 1px gold border.
- **Ghost CTA (the only cinematic button):** transparent fill,
  `borderColor #C9A55C`, `color #f4ecdb`, padding `0.75rem 1.75rem`, label type
  at `0.75rem` uppercase with `0.2em` tracking, icon at `0.5rem` gap.
- **Hover:** a `2px` lift (`-translate-y-0.5`) over `300ms`. No fill change, no
  scale, no glow.
- There is no filled/primary variant on cinematic surfaces. The gold outline *is*
  the emphasis.

### Cards / Containers

There are no cards on cinematic surfaces. The nearest equivalent is the **About
panel**: a plate-shaped framed media container with a gold inset outline, no
background of its own, no shadow, and no radius. Media containers paint `#0b0a08` behind the
image so a sub-cover scale reveals brand-dark edges rather than transparency.

### Navigation

Cinematic acts carry no persistent chrome beyond the site header. In-act
navigation is the **scroll cue**: a `0.625rem` uppercase label at `0.3em`
tracking above a 40px vertical rule that fades from `#C9A55C` at 80% opacity to
transparent, pulsing gently on a 2s loop and disabled under reduced motion.

**Nav grounding** (NAV.CLEAR.1, amended REVIEW.2b). On the cinematic home the
header is transparent **only over the hero**, where a bar would cut a lid
across the opening picture. Past `~80vh` (`scrollY > innerHeight * 0.8`) it
grounds on the site's near-black — `#0b0a08` at 95% with backdrop blur — so
the acts' type and ornaments pass beneath it instead of colliding with the
glyphs; the header's `700ms` transition makes the switch a fade, not a pop.
While transparent over moving art, legibility comes from a per-glyph halo
(`text-shadow: 0 1px 2px rgba(11,10,8,0.75), 0 2px 10px rgba(11,10,8,0.65)`),
never from a panel — the panel would be the very lid the transparent header
exists to remove. Scoped to the cinematic routes; ordinary pages keep their
own scrolled fill.

### Signature — the framed media resolver

The system's defining component is not visual chrome but a contract.
`src/lib/hero-framing.ts` (`resolveHeroMediaStyle`) is the single definition of
hero framing. Every surface that paints hero media — the live page, the Video
Profile preview, the Edit Photo dialog — resolves its CSS through it. Geometry is
expressed purely as percentages of the container, with no transforms, so two
different DOM surfaces reproduce the same rectangle byte-identically. Nothing
else may hardcode `object-fit` or re-derive a transform.

### Signature — the act

The recurring unit: a full-bleed viewport-true stage holding one photograph at
near-full brightness, a directional veil, a gold eyebrow, a display or headline
in warm ivory, and at most one ghost CTA. Acts advance; they do not stack.

### Signature — the Book teaser act (BOOK.ACT.1 → BOOK.ACT.2)

The book act, between the gallery and Green World, is the pattern for an act
that **reuses instead of claiming**:

- **The Publisher Law.** The act is a coming-soon teaser only: no title, no
  date, no cover, no way to buy — none of that is settled, and owner-truth
  means the copy cannot run ahead of what Cristyna has confirmed. Every string
  is the `/book` page's own bilingual coming-soon copy via the **same locale
  keys** (`book.*`, plus the nav's name for the page on the CTA) — a census,
  not new claims. The act gains detail the day `/book` does, from the same
  keys.
- **Field language.** One uninterrupted `CHAPTER_GROUND_1` room (the warmest of
  the family — candle-light for a book, re-opening the reel's tonal sequence
  before Green World's bright water), the gold eyebrow, the display face, and
  the outlined button.
- **A full stage, its column centred** (BOOK.ACT.2). The act is a
  `.cine-act-vh` full-viewport stage with its content column centred inside the
  site's act padding (`1.5rem` / `6rem` / `4rem`). It shipped at
  `min-h-[80svh]`, which both read short and leaked the seam — see *A pinned act
  owns its full ground* under the scroll grammar.
- **Scrubbed entrance, then the story dwell** (BOOK.ACT.2). The entrance is a
  modest scrub timeline in the spreads' own grammar (`y: 14 → 0`, opacity,
  `power3.out`, `0.12` stagger, scrubbed from `top 78%` to `top 22%`), and the
  act then pins for the story acts' `+=120%`. The entrance completes at
  `top 22%`, before the pin engages at `top top`, so the hold always begins on
  an act that has already settled. It shipped with no pin at all, and an
  announcement that scrolls past unbidden reads as an aside. Reduced motion
  builds neither: static, settled, unpinned — and still a full stage.

## Do's and Don'ts

### Do:

- **Do** paint `#0b0a08` behind every media container, so a sub-cover scale
  reveals brand-dark edges instead of transparency.
- **Do** route every hero-media surface through `resolveHeroMediaStyle`. Test: an
  editor preview and the published page must produce identical
  `data-hero-framing` strings.
- **Do** use `outline` with a negative `outline-offset` for hairlines on framed
  media, never `border` — a border changes the measured box and breaks framing
  parity.
- **Do** keep `dvh` on acts that just stand there — unpinned, or pinned and
  merely held — and `svh` on pinned SCRUB stages. Test: collapse the mobile URL
  bar mid-scrub; a scrubbed stage must not jump.
- **Do** let the veil be directional — open where the photograph carries the
  frame, heavier only where type actually lands.
- **Do** ship every string in ES and EN at the same time. Test: locale key counts
  stay equal.
- **Do** decelerate into rest with `power3.out`, and use `ease: "none"` for
  scroll-scrubbed travel so motion tracks the scrollbar exactly.
- **Do** keep gold to lines, letters, and rules. Test: if you can point at a
  gold *area*, reduce it.

### Don't:

The following are prohibitions, recorded verbatim from the owner's brief.

- No remote placeholder images of any kind (picsum.photos explicitly banned)
- No copy rewrites: names, numbers, venture claims, and titles are owner-provided
- No cream/light ground, no purple/emerald glow orbs, no glassmorphism bezels or
  nested hardware chrome on cinematic surfaces
- No font swaps outside an explicit brick
- No flat heavy scrims (the 50–80% murk) over reel photography
- Variance/dice-roll behavior banned outside designated bake-off generation
  prompts

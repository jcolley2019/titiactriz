---
name: Titiactriz
description: A warm near-black room lit by one gold filament, where the photograph is the light source.
colors:
  ground: "#0b0a08"
  gold: "#C9A55C"
  ivory: "#f4ecdb"
  ivory-dim: "#f0e9da"
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
spacing:
  act-x: "1.5rem"
  act-top: "6rem"
  act-bottom: "4rem"
  column-gap: "3rem"
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

### Admin-exempt (not normative)

- **Legacy Charcoal** (`#121212`) and **Legacy Tan** (`#C4A86C`): the older
  `:root` HSL system in `src/index.css`, commented "inspired by
  mistytrevino.com". It powers `/admin` and the shadcn primitives.

**The One Filament Rule.** Exactly one accent lights the room. Gold appears as
line, letter, or rule — never as a filled surface, never as a second accent
alongside it, and never blended into another hue. If a screen reads as "gold
themed" rather than as dark with a gold detail, there is too much of it.

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
deliberate trade the hero can absorb. Mid-page unpinned acts (Green World,
Titans) use `.cine-act-vh`, which declares `100vh` and then `100dvh` on mobile
so the act covers exactly the visible viewport as browser chrome collapses.
Pinned stages (the reel, TitiLinks)
deliberately stay on `svh`: ScrollTrigger writes pixel dimensions at refresh
time, and a `dvh` stage would be re-measured taller and jump mid-scrub when the
URL bar retracts. Every full-viewport section reserves its height in CSS before
any JS or media loads, so the document is never momentarily short on first paint.

**Act padding.** `1.5rem` horizontal, `6rem` top, `4rem` bottom — top-weighted to
clear the fixed header.

**Breakpoints.** `xs 480 · sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. The
container centers with `2rem` padding and caps at `1400px` — a constraint that
applies to the editorial surfaces, not to full-bleed acts, which are edge-to-edge
by definition.

**The editorial split.** At `md+`, the About act becomes a named-grid two-column
layout (`minmax(0,1fr)` and `clamp(300px, 32vw, 400px)`, `3rem` gap) in which a
single panel node reflows from mid-column on mobile to a full-height right rail
on desktop — one DOM node, no duplication, no gap left behind.

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

- W2's centred caption band and its two 18%/82% hairlines are **superseded on
  the live act**; the seam is the spread's one vertical gold line. Their
  constants remain exported only because the admin SectionPreview still
  restates the frozen W2 mirror (an accepted, recorded drift owed to
  REEL.COPY.1's era).
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
   materials. (`AmbientBackdrop` stays exported solely for the admin
   SectionPreview's frozen W2 mirror.)

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
at all: the CTA is a sharp-cornered rectangle, the About panel is a hard `3:4`
frame, and media fills its container edge-to-edge. Corners are where the frame
ends, not a softness to be sanded off.

Borders are hairlines and are usually *outlines*, not borders. The About panel
uses `outline: 1px solid rgba(201,165,92,0.4)` with `outline-offset: -1px`
specifically because an outline sits outside the box model — a real border would
shrink the measured child by 1px per axis and break byte-identical framing
between the editor canvas and the live panel. This is a parity constraint
expressed as a shape decision.

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
panel**: a `3:4` framed media container with a gold inset outline, no background
of its own, no shadow, and no radius. Media containers paint `#0b0a08` behind the
image so a sub-cover scale reveals brand-dark edges rather than transparency.

### Navigation

Cinematic acts carry no persistent chrome beyond the site header. In-act
navigation is the **scroll cue**: a `0.625rem` uppercase label at `0.3em`
tracking above a 40px vertical rule that fades from `#C9A55C` at 80% opacity to
transparent, pulsing gently on a 2s loop and disabled under reduced motion.

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
- **Do** keep `dvh` on unpinned acts and `svh` on pinned stages. Test: collapse
  the mobile URL bar mid-scrub; a pinned stage must not jump.
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

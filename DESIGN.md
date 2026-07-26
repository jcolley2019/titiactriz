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
- Acts are full-bleed and viewport-true (100vh+100dvh pattern per MOBILE.VH.1)
- The preview is the contract: hero-framing resolver parity law is untouchable
- Photos carry the page: near-full brightness, luminous veil ~0.15–0.35, type
  carries its own glow

### Open item — detector activation

Writing this file armed the gate it will be judged by. Against the bare
repository the Impeccable detector reported **6** findings; with a token spec to
compare against, 59 previously-dormant `design-system-*` rules fire and the count
is **65** — with no source file changed. The delta is `design-system-color` (25),
`design-system-font-size` (33), and `design-system-radius` (1), splitting **34 in
the normative cinematic layer** and **25 in the admin-exempt layer** the detector
cannot see the exemption for. The normative 34 are real work owed to CINE.FLOW;
the exempt 25 are candidates for a detector ignore-list rather than for edits.

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

**Open item — bounce easing.** `--transition-bounce: all 0.6s
cubic-bezier(0.34, 1.56, 0.64, 1)` at `src/index.css:84` is under review pending
CINE.FLOW motion decisions. (Context: it is a legacy token in the admin-exempt
layer; no cinematic component references it, and the detector flags it as
`bounce-easing`.)

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

**Open item — gradient text.** `.text-gradient-gold` at `src/index.css:302`
(`bg-clip-text` over `from-accent via-gold-light to-accent`) is a candidate brand
exception pending confirmation it is the gold treatment. (Context: it is the
gold treatment by construction, but a repo-wide search finds **zero call sites** —
it is currently dead code in the admin-exempt layer, and the detector flags it as
`gradient-text`.)

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

**The Unboxed Type Rule.** Type earns legibility from its own weight, color, and
the veil beneath it — never from a plate, chip, or panel drawn behind it. If text
needs a box to be readable, the veil is wrong, not the type.

**The Parity Rule.** Every string ships in Spanish and English. ES and EN locale
files are held at exact key parity (622 / 622 today). Spanish is primary; English
is parity, not a follow-up.

## Layout

**Acts.** The cinematic page is a sequence of full-bleed, viewport-true acts.
Unpinned acts (hero, Green World, Titans) use `.cine-act-vh`, which declares
`100vh` and then `100dvh` on mobile so the act covers exactly the visible
viewport as browser chrome collapses. Pinned stages (the reel, TitiLinks)
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

- **Reel spotlight** (phone only): `radial-gradient(ellipse 76% 56% at Fx% Fy%,
  0 0%, 0 46%, 0.20 72%, 0.35 100%)`, where `Fx/Fy` is the slide's own focal
  point from the admin framing. The veil is a lens rather than a curtain: fully
  open over the subject, all suppression spent on the corners where no
  photograph information lives. Aiming it elsewhere never raises the ceiling —
  `0.35` is the darkest stop wherever the beam points.

**Half-resolved — the reel veil.** The flat
`linear-gradient(180deg, rgba(11,10,8,0.5), rgba(11,10,8,0.8))` wash — undirected,
squarely in the banned 50–80% range and outside the mandated `0.15–0.35` — is
**retired on phones** as of CINE.FLOW.3 (`62fcb19`, 2026-07-25), replaced by the
focal-anchored spotlight above. Below 768px the act is now compliant.

It **still paints at 768px and wider**, where the mandate keeps the reel's
letterbox/gallery character and CINE.FLOW.3 was scoped not to touch it. The
constant now lives in one place, `src/components/cinematic/reelSpotlight.ts`
(`WIDE_VEIL`), imported by both the live act and the admin preview, so retiring
the second half is a one-line change in a single file when a later brick takes
the wide composition. Until then this remains an open violation on tablet and
desktop, and it is recorded here, not fixed here.

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

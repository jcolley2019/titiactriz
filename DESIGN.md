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
  gw-lane: "#12A03B"
  admin-charcoal: "#121212"
  admin-tan: "#C4A86C"
  studio-luxe-bg: "#faf6f0"
  studio-luxe-card: "#f5efe6"
  studio-luxe-text: "#1a1008"
  studio-luxe-text-2: "#3d2b1f"
  studio-luxe-border: "#d4c5a9"
  studio-luxe-gold: "#b8860b"
  studio-luxe-gold-hover: "#d4a017"
  studio-luxe-error: "#9b2c2c"
  studio-dark-error: "#e8a598"
  room-light-ink: "#1d1a16"
  room-light-ink-dim: "#2e2a25"
  room-light-ink-faint: "#5c554b"
  room-light-muted: "#36312b"
  room-light-gold: "#835f07"
  room-light-code: "#efe7da"
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
  studio-eyebrow:
    fontFamily: "'Cormorant Garamond', Cinzel, Jost, Georgia, serif"
    fontSize: "14px"
    fontWeight: 700
    letterSpacing: "0.25em"
  studio-label:
    fontFamily: "'Cormorant Garamond', Cinzel, Jost, Georgia, serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "0.12em"
  studio-body-compact:
    fontFamily: "'Cormorant Garamond', Cinzel, Jost, Georgia, serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.6
  studio-body:
    fontFamily: "'Cormorant Garamond', Cinzel, Jost, Georgia, serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.6
  studio-subhead:
    fontFamily: "'Cormorant Garamond', Cinzel, Jost, Georgia, serif"
    fontSize: "20px"
    fontWeight: 700
  studio-heading:
    fontFamily: "'Cormorant Garamond', Cinzel, Jost, Georgia, serif"
    fontSize: "22px"
    fontWeight: 700
  studio-title:
    fontFamily: "'Cormorant Garamond', Cinzel, Jost, Georgia, serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
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

This file describes the site **as shipped**. Where it and the code disagree, the
code is right and this file is stale. CLAUDE.md's laws outrank it. Every
treatment over photography or video recorded here is a **frozen record, not a
recipe** (CLAUDE.md Law 8): nothing in this file is a reason to add, tune or
remove one.

## Overview

**Creative North Star: "The Luminous Veil."** Every cinematic surface is a warm
near-black room (`#0b0a08`) lit by one filament of metallic gold (`#C9A55C`),
with a photograph of her as the light source. Surfaces advance as **acts** —
full-bleed, viewport-true stages. Motion is heavy and decelerating, never
springy.

- Warm near-black ground; never pure `#000`, never a cool OLED black
- One gold accent, used as line and letter
- Serif display in full caps, tight leading, at architectural scale
- Full-bleed viewport-true acts, not a card scroll
- Square corners on cinematic surfaces; no pills, bezels or glass
- Decelerating GSAP motion; scrubbed travel is linear
- Spanish and English at exact key parity on every surface

### Intent (owner's brief, verbatim)

> Introduce Cristyna Polentino — a visitor should feel they've met a talented
> actress, streamer, and entrepreneur within seconds. Showcase and sell her
> ventures: Green World supplements, Titans agency, TitiLinks. The blog engine
> feeds all three (SEO for Green World sales, visibility for acting, recruitment
> for Titans).

Titans Agency is paused. It is **hidden, not deleted**: one constant
(`TITANS_ENABLED = false`, `src/lib/ventures.ts`) gates every surface that would
show it.

### Constants

A change to any of these is a change to the identity and needs an explicit brick.

- Ground `#0b0a08`; accent `#C9A55C`
- Display type is serif; ES/EN parity on every surface
- Acts are full-bleed and viewport-true
- The preview is the contract: the hero-framing resolver's parity is untouchable
- The roles are **Actriz · Streamer · Empresaria**, in that order (the reel's
  three chapters)
- The hero `<video>` never carries a `poster` attribute

### The cinematic home, as shipped

`src/pages/HomeCinematic.tsx`. "Off" acts are built and gated in
`src/lib/ventures.ts`.

| # | Act | Component | Scroll |
| --- | --- | --- | --- |
| 1 | Hero | `CinematicHero` | unpinned |
| 2 | Bio paragraph | `CinematicBio` | unpinned |
| 3 | Events | `CinematicEvents` (room A) | story dwell |
| 4 | Reel 01–03 | `CinematicReel` | showcase |
| — | Acting (off) | `CinematicActing` | story dwell |
| 5 | Gallery marquee | `CinematicGallery` | story dwell |
| 6 | Blog | `CinematicBlog` | story dwell |
| 7 | Green World | `CinematicGreenWorldSeq` | showcase |
| — | Titans (off) | `CinematicTitans` | unpinned |
| 8 | TitiLinks | `CinematicTitiLinks` | showcase |
| 9 | Socials (composition B) | `CinematicSocials` | story dwell |
| 10 | About | `CinematicAbout` | story dwell |
| 11 | Contact | `CinematicContact` | story dwell |

The Book act (`CinematicBook`) is built and switched off on the home page;
`/book` is live. `CinematicGreenWorld` (the older curtain act) is in the repo
and mounted nowhere.

### Motion

GSAP power curves: `power3.out` is the default entrance, `power3.inOut` drives
symmetric reveals, `power2.out` smaller lifts, and `ease: "none"` every
scroll-scrubbed travel. Durations cluster at `0.5s–0.9s` with a `0.12s`
stagger. Lenis provides smooth scroll; ScrollTrigger owns the pins. Reduced
motion builds no Lenis, no tweens and no pins.

**The Dead-Stop Rule.** Motion decelerates into place and stops. Nothing
overshoots or bounces; a curve whose control points exceed 1 does not belong on
a cinematic surface.

### The detector gate

`npx impeccable detect src --json` is the gate, and CLAUDE.md states the
baseline. `.impeccable/config.json` exempts the admin layer
(`src/components/admin/**`, the events components, `_archive`, the editorial
home, generated files, and the legacy `:root` values in `src/index.css`) from
the `design-system-*` rules only. A brick that raises the count introduces
drift.

## Colors

### Primary and neutrals

- **Filament Gold** (`#C9A55C`): hairline rules and inset outlines, eyebrow
  labels, one line of the hero wordmark, CTA borders, the scroll cue's stroke.
- **Warm Near-Black** (`#0b0a08`): the ground of every cinematic surface and
  the backdrop painted behind all framed media, so a sub-cover scale shows
  brand-dark edges rather than transparency.
- **Warm Ivory** (`#f4ecdb`): display and body type over the dark.
- **Dimmed Ivory** (`#f0e9da`): secondary type, often at reduced opacity.

### Secondary grounds

- **Adjacent Ground** (`#0e0c09`): the Contact act's field and the TitiLinks
  act — acts with no photograph — and the ink on the Contact submit button.
- **Field-Input Ground** (`#12100c`): form surfaces; Contact inputs at 70%.
- **Chrome Ground** (`#141210`): simulated device chrome and media fallback.
  Never an act ground.
- **Field family** (`FramedVideo.tsx`): `FIELD_GROUND` (`#0b0a08`),
  `CHAPTER_GROUND_1..3` (`#0d0b08`, `#0b0b0a`, `#080706` — one small tonal step
  per reel chapter), `FIELD_LIGHT` (the faint ivory luminance gradient over an
  opaque field) and `SEAM_GOLD` (`rgba(201,165,92,0.55)`).

### Venture accents (gated to their own surfaces)

- **Titans reds** — kicker `#E24A54`, CTA `#C41E2A` with white text. Titans act
  and `/titans-agency` only; both hidden while `TITANS_ENABLED` is false.
- **Deep Green** (`#0B5D2A`) — the Green World act's type accent, and the Green
  World lane on the light reading room.
- **Lane Green** (`#12A03B`, the logo's green; `--gw-lane`, `LANE_GREEN`) — the
  Green World lane on dark. It marks a greenworld post and nothing else, as
  line and letter only: on `/blog` cards and `/blog/<slug>` (left hairline,
  date line, "Green World" label, the hairline under a post's title), on the
  home Blog act (card hairline in the gutter, tile frame and label line, the
  "Green World →" footer link), and on a post's product list (one hairline down
  its left edge; names in ivory, "Ver producto →" in gold). A greenworld post's
  kind (Producto, Capacitación, Negocio) rides inside the lane's own meta line.
  A post lists at most six products (`gw_products`); a row with no link goes to
  the Green World shop. Kind chips under `/blog?c=greenworld` are gold, like
  every other chip. Meta separators are bound to the word before them
  (`META_SEP`), so a wrapped line never starts with a dot.

### The gold alpha ladder

Gold appears at fixed alpha steps of `rgba(201,165,92,α)`, and the step is the
meaning. New gold lands on an existing step; a new alpha is a design-system
change.

- **`1.0`** — the filament: letterforms, eyebrows, CTA borders, solid rules.
- **`0.85` / `0.65` / `0.5`** — light around a gold line (a shadow or border,
  never a fill): the TitiLinks exit shimmer, the progress rule's bloom, the
  success border.
- **`0.55`** — the frame opacity: the wide plate's hairline, the spread seam,
  the lightbox frame.
- **`0.4` / `0.35`** — hairlines at rest: the About panel's outline and tag
  borders, side rails, input borders.
- **`0.12` / `0.1` / `0.08`** — gold as air: edgeless tints, chip fills, the
  success wash.
- **`0`** — the end of every fading gold gradient.

### The reading room — dark and light

`/blog`, `/blog/<slug>`, `/events` and `/book` paint from one set of CSS
variables (`--room-*`, `src/index.css`; exported as `var()` strings from
`src/components/blog/tokens.ts`). The site setting `site_theme` (`dark` |
`light` | `auto`; Admin › Ajustes) picks the set, and `auto` follows the
reader's `prefers-color-scheme`. **Default dark.**

- **Scope.** `SiteFrame` puts `data-site-theme` on those four routes, and on
  `/` while it shows the editorial or classic home (`useShownHomeVariant`).
  **The cinematic home is dark-only**, whatever the setting says.
  `/green-world` keeps its own bright grammar; `/admin` has its own theme.
- **Values** live in `src/index.css` (`:root` and `[data-site-theme="light"]`),
  with the measured ratios beside them. The light ground is the Luxe paper
  `#faf6f0`, not white.
- **Gold on paper (Joey's ruling).** On the light room every gold, letter and
  line alike, is `#835f07`; its hairline and wash use the ladder's `0.55` and
  `0.1`.
- **Plates.** Covers, framed images, event cards (`#13110d` inside their gold
  frame) and a LinkCard's image well keep their own dark ground on paper.
  Photographs are never washed or recoloured.
- **Chrome.** The light set retunes the shadcn tokens, which is how the header,
  footer and Radix portals follow the page. On paper the header shows the
  two-tone monogram (charcoal C, gold P).
- **Classic home** paints from the shadcn tokens alone; its gold CTA is
  `#835f07` letters on a `bg-gold/10` wash.
- **Editorial home** reads the room variables (`--room-ground-editorial`,
  `--room-ink-editorial`, `.editorial-divider-half`).
- **Contact band on paper.** The editorial and classic submit is the
  `editorial-paper` button: a 2px `#835f07` line over the `bg-gold/10` wash
  with ink letters. Form errors, and the line a failed send leaves under the
  form, use the light set's `--destructive` (`#9b2c2c`).

### Rules

**The One Filament Rule.** One accent lights the room: gold, as line, letter or
rule, never blended into another hue. Shipped exceptions, each scoped: Deep
Green as the Green World act's type accent, and Lane Green on greenworld posts.
**The two solid gold buttons are approved exceptions** (Joey's ruling): the
Contact send button (`#C9A55C` fill, `#0e0c09` text) and the Green World act's
"Cómo comprar" CTA (`#C9A55C` fill, `#0b0a08` text).

**The Warm Dark Rule.** The ground is `#0b0a08`. Pure `#000` and cool
blue-blacks are regressions.

**The Two Systems Rule.** The cinematic palette is normative for everything a
visitor sees. `/admin` and the shadcn internals keep the legacy `:root` tokens
(charcoal `#121212`, tan `#C4A86C`, the `0.5rem` radius, the `--shadow-*`
tokens). Those values on a public cinematic surface are drift.

## Typography

**Display:** Cinzel (then Cormorant Garamond, Georgia, serif). **Body:** Jost
(then Outfit, system-ui, sans-serif). Bound as `--font-display` and
`--font-sans` at each surface's root — the variables are not global, so a new
surface must set them. Tailwind's `font-serif` is Cormorant Garamond.

- **Display** (400, `clamp(2.75rem, 11vw, 9rem)`, leading `0.92`, tracking
  `0.05em`, uppercase): the hero wordmark only, ivory over gold, per-letter
  reveal.
- **Headline** (400, `clamp(1.75rem, 4vw, 3.25rem)`): act titles.
- **Body** (300, `clamp(0.7rem, 1.5vw, 0.95rem)`): supporting copy and the hero
  subtitle. Long paragraphs on a phone (the bio, blog bodies) hold the ceiling,
  `0.95rem`, fixed.
- **Label** (500, `0.75rem`, tracking `0.25em`, uppercase, sans): `.text-caps`.
  Eyebrows (gold), CTA text (tracking `0.2em`), scroll cue (`0.625rem`,
  tracking `0.3em`).
- **Nav label** (300, `0.75rem`, `13px` at `lg`, uppercase): the header's links
  (`linkBase`). The `13px` step is ratified, not drift.

**Reel lockup** — gold numeral over ivory title, display family:

- Phone numeral `66px` flat; phone title `clamp(1.5rem, 7.2vw, 1.75rem)`,
  leading `1.1`, tracking `0.06em`, uppercase.
- Wide numeral `clamp(1.375rem, 2.5vw, 2.375rem)`, tracking `0.12em`; wide
  title `clamp(1.75rem, 3.2vw, 3rem)`, tracking `0.06em`. Both are computed in
  px against the act's measured frame, not CSS `vw`.
- The numeral is deliberately not continuous across 768px: the two widths are
  different compositions.

**The Unboxed Type Rule.** Type on cinematic surfaces sits on no plate, chip or
panel, and carries no text-shadow. The one exception is the header's glyph
shadow over the hero (see Photography treatments).

**The Parity Rule.** Every string ships in Spanish and English at the same
time. Spanish is primary; the two locale files hold identical keys.

### Studio ramp (Admin › Estudio)

The Content Studio is the one admin surface with its own governed type and
palette. Every value is written once, in `src/styles/studio.css` under
`.studio`; the frontmatter `studio-*` roles mirror it. It is built for a laptop
or iPad — she does not write the blog from her phone.

- Eyebrow `14px` · Label and caption `15px` · Body `17px` from 1024px, `16px`
  below · Subhead `20px` · Heading `22px` · Title `28px`.
- **Light — Luxe (default):** ground `#faf6f0`, cards `#f5efe6`, ink `#1a1008`,
  borders `#d4c5a9`, gold `#b8860b` for fills, rules and focus rings, and
  `#835f07` for gold text. Cormorant Garamond at 500 / 700. Generate is solid
  gold with ink text.
- **Dark — the site:** the public room's tokens; Cinzel display, Jost 400.
  Generate is a gold outline, never a fill.
- The Studio wears the whole admin's theme. The toggle sits in the admin
  header and is remembered per browser (`localStorage` `admin.theme`). The
  site's header and footer stay dark on the admin page.

## Layout

**Act heights** (`cinematic.css`). Every full-viewport section reserves its
height in CSS before JS or media loads.

- `.cine-act-lvh` (`100lvh`) — the hero. It covers the full physical screen, so
  only the hero can sit behind a floating mobile browser bar.
- `.cine-act-vh` (`100dvh` on mobile, `100svh` from 768px) — held story acts:
  Events, Blog.
- `.cine-stage-lvh` (`100lvh`) — the pinned scrub stages that must cover the
  screen: the reel and the Green World sequence. `lvh` is static, so the pin
  does not jump when the URL bar retracts.
- `.cine-vh-full` (`100svh`) — TitiLinks' stage and the Socials act.
- A pinned stage never takes `dvh`: ScrollTrigger writes pixel sizes at
  refresh, and a `dvh` stage would be re-measured and jump mid-scrub.

**Act padding.** `1.5rem` horizontal, `6rem` top, `4rem` bottom.

**Breakpoints.** `xs 480 · sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. The
container (`2rem` padding, `1400px` cap) applies to editorial surfaces, not to
acts.

**The Full-Bleed Rule.** Acts are edge-to-edge. A max-width container, gutter
or card boundary on an act is a regression.

### The scroll grammar — the Dwell Law

The page's scroll cost has exactly two prices. A third duration is a
design-system change.

1. **Story acts dwell `+=120%`** (`start: "top top"`): Events, the gallery,
   Blog, Socials, About, Contact — and Acting when lit. A pinned act keeps its
   pointer events, so forms and links work through the hold.
2. **Scrub showcases pin `+=300%`** (`SEQ_PIN_DURATION`): the reel, TitiLinks
   and the Green World sequence — the only three.
3. **Scrubbed sequences carry dead zones.** `SEQ_LEAD_IN = 0.08` and
   `SEQ_LEAD_OUT = 0.08`, both clamped: the first and last frames hold.

The footer never pins. Reduced motion skips every pin. A pinned act covers its
whole frame at every point of the hold, with `min-height`, never `height`, so
long copy grows the stage.

**Late pins.** An act whose content arrives after first paint (Events, Blog)
keeps its `<section>` in the DOM at every paint and creates its pin late, then
calls `ScrollTrigger.sort()` and refreshes. Never wrap such an act's mount in a
flag; gate its contents.

### The reel — two compositions

- **Phone (< 768px):** an edge-to-edge cover photograph with the lockup at the
  foot of the frame.
- **Wide (≥ 768px):** a two-page story spread. A plate hangs centred in the
  photo page; a chapter column takes `0.42` of the frame
  (`CHAPTER_FIELD_FRACTION`) on an opaque field (`CHAPTER_GROUND_n` under
  `FIELD_LIGHT`), with a 1px `SEAM_GOLD` seam between them. Sides alternate per
  slide. The chapter is the gold numeral eyebrow, a headline and one short
  paragraph.
- **The plate has two shapes, chosen per slide** (`plateLaw`, `plateBox` in
  `reelWide.tsx`). Portrait, the default: aspect `0.563`, height `76vh`, capped
  at `60vw` of the photo page. Landscape: aspect `1.5`, height `52vh`, capped
  at `78vw`. The smaller box wins. The plate centres vertically, never closer
  than `PLATE_TOP_VH` (10) to the top.
- The choice lives on the **wide** framing record (`reel[i].wide.plate`); an
  absent field means portrait. The phone record never carries one. Reset
  recentres and unzooms inside the chosen plate; it does not undo the shape.
- **The plate's gold frame draws itself.** An SVG rect (`pathLength` 1, stroke
  at `0.55`) whose dashoffset the pinned timeline scrubs on the slide's
  entrance; one corner filigree per spread blooms after the line completes.
  The markup state is the finished frame, so reduced motion renders it whole.
- **Chapter copy** is seeded from already-shipped strings (`reelChapters.ts`),
  ES primary with EN parity, overridable through `site_settings` keys
  `reel.chapter1..3`. No new biographical claims.
- One law, every surface: the live act, the About panel, the admin drag math
  (`previewMediaFrame`) and the admin CSS mirror all read `plateLaw`.
- `src/components/qa/reel-bakeoff/` is a frozen museum. Live code does not
  import from `qa/`.

### The About act

- At `md+` it is a named-grid split: copy column and photo rail, `3rem` gap,
  one DOM node for the panel at every width.
- **The photo is a reel-class surface** (Joey's ruling). Its box is
  `plateLaw`'s, and it is edited by the reel's editor (`FramingEditor`) — the
  same component, tabs, zoom, pan, Reset and Portrait / Landscape toggle. The
  phone class paints the portrait plate only.
- **The rail is the plate, not a clamp.** Its width is CSS `min()` of
  `--cine-plate-w-from-height` and `--cine-plate-w-cap`, both computed from
  `plateLaw`, so an About plate and a reel plate at the same viewport are the
  same box.
- **The layout adapts to the plate.** The copy column has a `456px` floor
  before the container grows past `64rem`. From 1200px the act is a centred
  full-viewport stage and the copy column may grow to `42vw`, capped at
  `700px`.
- The panel's frame is one `rgba(201,165,92,0.4)` inset outline — none of the
  reel's chrome.
- The panel is opt-in: with no About photo set, no panel renders.

### The Green World act

The site's one polarity flip: dark ink on bright water.

- Type is `INK = #0b0a08`; the accent is Deep Green (`#0B5D2A`).
- The frame pack is graded `brightness(1.03) saturate(1.35)` (`PLATE_GRADE`).
- The lockup arrives on two latches: the body line at mapped progress `0.15`
  (`BODY_REVEAL_AT`), the button at `0.25` (`CTA_REVEAL_AT`). The CTA takes a
  pointer only once it has arrived.
- The CTA, "Cómo comprar", is the act's own solid gold button, an approved
  exception (One Filament Rule): gold fill, near-black text, `rounded-md`.
- The brand lockup is painted exactly as the brand draws it
  (`public/ventures/green-world-lockup.png`).
- No health claims anywhere near this act (CLAUDE.md Law 6).

## Photography treatments — frozen (CLAUDE.md Law 8)

This is a record of what is shipped over photographs and video. It is closed:
do not add to it, adjust it, measure against it or propose changes to it. The
code holds the exact values.

- **Hero** (`CinematicHeroMedia.tsx`): one vertical gradient of
  `rgba(11,10,8,α)` — `0.72` at the top, `0.42` at 38%, `0.60` at 72%, `0.92`
  at the foot.
- **Reel, phone** (`reelSpotlight.ts`): clear through the top 54%, `0.16` at
  70%, `0.32` at the foot.
- **Reel, wide:** nothing over the plate. The chapter field sits beside the
  photograph, not over it.
- **Seam skirt** (`.cine-seam-skirt`): a `110px` `#0b0a08`→transparent fade at
  the top of the reel section, phone only, at the hero→reel boundary only. Its
  opacity scrubs to zero as the seam is scrolled. No other boundary has one.
- **Green World sequence:** clear to 76%, `0.45` at 93%, `0.88` at the foot,
  plus the `PLATE_GRADE` filter above.
- **Titans** (hidden): `0.28` at the top, clear at 32%, `0.35` at 60%, `0.9` at
  the foot.
- **Header over the hero** (`Header.tsx`): while transparent on the cinematic
  home, the nav glyphs carry `text-shadow: 0 1px 2px rgba(11,10,8,0.75), 0 2px
  10px rgba(11,10,8,0.65)`.
- **Framed plates** (the wide reel plate, the About panel, covers): no
  treatment.

Cinematic surfaces otherwise use no drop shadows and no elevation.

## Shapes

Cinematic surfaces are square: radius zero on CTAs, plates and media. The
`0.5rem` radius belongs to the admin layer; the Green World act's CTA is the
one rounded button on the home.

Hairlines on framed media are **outlines, not borders**: the About panel uses
`outline: 1px solid rgba(201,165,92,0.4)` with `outline-offset: -1px`, because
a border would shrink the measured child and break framing parity between the
editor canvas and the live panel.

## Components

### Buttons

- **Ghost CTA** — the cinematic default: transparent fill, 1px `#C9A55C`
  border, `#f4ecdb` text, padding `0.75rem 1.75rem`, label type at `0.2em`
  tracking. Hover is a `2px` lift over `300ms`; no fill change, scale or glow.
- **Solid gold, approved exceptions:** the Contact send button and the Green
  World "Cómo comprar" CTA (see One Filament Rule).

### Cards and containers

Acts hold no cards. The About panel is a framed plate with a gold inset
outline, no fill, shadow or radius. The Blog act's entries are the ratified
exception (below). Event cards belong to the events components, which are
outside the cinematic design-system rules.

### Navigation

- **Scroll cue:** a `0.625rem` uppercase label at `0.3em` tracking over a 40px
  rule fading from gold at 80% to transparent, pulsing on a 2s loop; static
  under reduced motion.
- **Header on the cinematic home:** transparent over the hero only. Past
  `scrollY > innerHeight * 0.8` it grounds on `#0b0a08` at 95% with backdrop
  blur, over a `700ms` transition. Other pages keep their own scrolled fill.
- New desktop links go on the right rail; the left rail is full.

### The framed media resolver

`src/lib/hero-framing.ts` (`resolveHeroMediaStyle`) is the single definition of
hero framing. Every surface that paints hero media — the live page, the Video
Profile preview, the Edit Photo dialog — resolves its CSS through it, as
percentages of the container with no transforms, so two DOM surfaces produce
the same rectangle. Nothing else may hardcode `object-fit` or re-derive a
transform. An editor preview and the published page must produce identical
`data-hero-framing` strings.

### The Book teaser — the Publisher Law

The book is a coming-soon teaser only: no title, date, cover, way to buy or
email capture until written publisher clearance. `/book` is live, and its
`book.*` locale keys are the only book copy. The home's Book act
(`CinematicBook`) is built and switched off on the home page.

### The Blog act

`CinematicBlog.tsx`, between the gallery and Green World. It shows the newest
published posts, up to four, each linking to `/blog/<slug>`; the footer line is
"Ver todos los artículos →" plus "Green World →" when a shown post is in that
lane. Copy lives under `home.blogAct.*`.

- A story act on the bare ground, with a linear scrubbed entrance (`top 78%` →
  `top 22%`) that completes before the pin engages.
- **Wide (≥ 768):** Entry cards — a 3:2 framed cover, a text-caps date line,
  the title at `1.75rem` (two lines at most), the excerpt (two lines at most).
  One row of four at ≥ 1024, a 2×2 below it.
- **The 2×2 needs a frame at least 1140px tall.** Between 768 and 1023 wide, a
  shorter frame takes the phone tiles (`.blog-act-cards` / `.blog-act-tiles` in
  `cinematic.css` own `display`).
- **Phone:** compact tiles — full width, `68px` tall, sharp-cornered, a 1px
  frame at `0.4`, a left hairline, the category and short date on one line and
  the title on the next (`0.95rem`, one line, ellipsis). No cover, no excerpt.
- With no published posts the act paints nothing and takes no height.

## Do's and Don'ts

### Do

- Paint `#0b0a08` behind every media container.
- Route every hero-media surface through `resolveHeroMediaStyle`.
- Use `outline` with a negative offset for hairlines on framed media, never
  `border`.
- Keep pinned stages off `dvh`.
- Ship every string in ES and EN at the same time.
- Decelerate into rest with `power3.out`; use `ease: "none"` for scrubbed
  travel.
- Keep gold to lines, letters and rules.

### Don't (owner's brief, verbatim)

- No remote placeholder images of any kind (picsum.photos explicitly banned)
- No copy rewrites: names, numbers, venture claims, and titles are owner-provided
- No cream/light ground, no purple/emerald glow orbs, no glassmorphism bezels or
  nested hardware chrome on cinematic surfaces
- No font swaps outside an explicit brick
- No flat heavy scrims (the 50–80% murk) over reel photography
- Variance/dice-roll behavior banned outside designated bake-off generation
  prompts

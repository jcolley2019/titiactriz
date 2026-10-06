/**
 * BLOG.1 — the blog's room, in the cinematic palette (DESIGN.md Colors). Every
 * value is an existing step: ivory type, the one gold filament, and gold at the
 * ladder's structure (0.4) and atmosphere (0.08) bands.
 *
 * SITE.THEME.1 — each is a CSS variable of the room, not a hex: index.css
 * declares the dark set on :root (today's values exactly — FIELD_GROUND and
 * FIELD_LIGHT included) and the light set under [data-site-theme="light"],
 * which the app's root wrapper carries only on the reading pages. A surface
 * outside that scope (the cinematic home's Blog act) resolves the dark set.
 * Never append a hex alpha to one of these (`${GOLD}66`): a var() takes none —
 * use color-mix() or a variable of its own.
 */
export const IVORY = "var(--room-ink)";
export const IVORY_DIM = "var(--room-ink-dim)";
export const GOLD = "var(--room-gold)";
/** The structure band of the gold ladder: hairlines at rest. */
export const GOLD_RULE = "var(--room-gold-rule)";
/** The atmosphere band: a chip's fill, no edge of its own. */
export const GOLD_AIR = "var(--room-gold-air)";

/**
 * BLOG.GW.1 — the Green World lane: the logo green (#12A03B, --gw-lane), 5.3:1
 * on this room where Deep Green is 2.3:1. Only a greenworld post's lane wears it
 * (the card's left hairline, its date line and label; the post's meta line and
 * title rule) — everything else on the blog stays gold. On the light room it is
 * Deep Green (#0B5D2A), the bright-plate green.
 */
export const LANE_GREEN = "var(--room-lane)";

/** SITE.THEME.1 — an inline `code` chip's ground (the Field-Input Ground on the dark). */
export const CODE_GROUND = "var(--room-code)";

/**
 * BLOG.GW.2 — the " · " between a meta line's parts (label, kind, date), with a
 * no-break space before the dot: a line that wraps breaks after a dot, never
 * leaves one leading the next line.
 */
export const META_SEP = " · ";

/** --font-display is page-scoped on this site: every surface declares its own. */
export const blogFontVars: React.CSSProperties = {
  ["--font-display" as never]: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
  ["--font-sans" as never]: "'Jost', 'Outfit', system-ui, sans-serif",
  fontFamily: "var(--font-sans)",
};

/**
 * One continuous field: the ground under HERO.WIDE.1's luminance gradient. Act
 * padding (DESIGN.md Layout): 6rem on top clears the fixed header, plus the
 * notch's inset, which the header pads itself by too.
 */
export const blogRoom: React.CSSProperties = {
  ...blogFontVars,
  backgroundColor: "var(--room-ground)",
  backgroundImage: "var(--room-light)",
  color: IVORY,
  paddingTop: "calc(6rem + env(safe-area-inset-top, 0px))",
};

/** Body type at the Body step's ceiling, held fixed — see PostBody. */
export const BODY_TEXT: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 300,
  lineHeight: 1.7,
  color: IVORY_DIM,
};

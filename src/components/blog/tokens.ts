import { FIELD_GROUND, FIELD_LIGHT } from "@/components/cinematic/FramedVideo";

/**
 * BLOG.1 — the blog's room, in the cinematic palette (DESIGN.md Colors). Every
 * value is an existing step: ivory type, the one gold filament, and gold at the
 * ladder's structure (0.4) and atmosphere (0.08) bands.
 */
export const IVORY = "#f4ecdb";
export const IVORY_DIM = "#f0e9da";
export const GOLD = "#C9A55C";
/** The structure band of the gold ladder: hairlines at rest. */
export const GOLD_RULE = "rgba(201,165,92,0.4)";
/** The atmosphere band: a chip's fill, no edge of its own. */
export const GOLD_AIR = "rgba(201,165,92,0.08)";

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
  backgroundColor: FIELD_GROUND,
  backgroundImage: FIELD_LIGHT,
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

import { Link as LinkIcon, Globe } from "lucide-react";
import { BRAND_MARKS } from "./brandMarks.generated";
import bigoLiveMark from "@/assets/brands/bigo-live.png";

/**
 * PORT.SOC.8 — brand marks, ported from the TitiLinks application
 * (C:\dev\titilinks, src/components/PlatformIcon.tsx).
 *
 * DESIGN law: brand marks are rendered exactly as the brand draws them. That is
 * what this component is for.
 *
 * PORT.SOC.11 — the geometry now comes from `brandMarks.generated.ts` instead
 * of from `react-icons` directly. Same marks, same paths, extracted verbatim by
 * scripts/generate-brand-marks.mjs. The reason is the first-paint gate: the
 * react-icons packs are BARREL modules and Vite's dev server serves them whole,
 * which cost enough budget to stop the cinematic home mounting in time once the
 * Socials act was wired in. `react-icons` is now a devDependency, used only to
 * regenerate that file — the app never imports it. To change which mark or
 * which colour a platform gets, edit the generator and re-run it.
 *
 * What did NOT come across from the source, and why:
 *   · The four ADULT marks (OnlyFans, Fansly, Privacy, FatalFans) and the
 *     legacy labels the source keeps for old saved rows (Truth Social, Twitter,
 *     Skype, Pandora). None are in this site's catalog, and an icon nobody can
 *     select is dead weight.
 *   · `resolveGlyphColor` and its `@/lib/contrast` dependency. That function
 *     exists to rescue white glyphs from TitiLinks' WHITE icon circles. Every
 *     surface here paints on near-black, where the white-glyph brands are the
 *     legible ones — it has no caller.
 *
 * Two catalog platforms have NO mark in the icon set — Lemon8 and Whop — and
 * fall through to the generic link glyph in brand gold. That is the source
 * app's own behaviour, not a gap opened here.
 *
 * BIGO LIVE is the one mark this site draws from ARTWORK rather than from a
 * glyph, and it is deliberate. Searched 2026-08-02: there is no official SVG of
 * the icon anywhere. What exists officially is
 *   · joyy.com/assets/logo/bigo-logo.ai — real vector, XMP title "RGB_BIGO LIVE
 *     LOGO", published by the parent company — but it is the 2:1 LOCKUP
 *     (mascot + wordmark), not the icon;
 *   · bigo.tv's own static bucket — the mascot ALONE, PNG only, 512x512 (and a
 *     300x300), palette + tRNS so it carries real transparency.
 * Every "SVG" result outside those is a third-party aggregator redraw, which is
 * a trace by another name and is not used.
 *
 * So Bigo Live renders the official 512x512 artwork. The trade-off is real and
 * is recorded rather than hidden: it is a raster among vectors, it cannot be
 * tinted by the `color` prop the way a glyph can, and it is full-colour where
 * every other mark is monochrome. Its dark outline all but disappears against
 * this site's near-black grounds — the white body and cyan accents are what
 * carry the shape. Swap it for a single-path glyph the moment Bigo publishes
 * one; RASTER_MARKS is the only thing that has to change.
 */

/** The site's brand gold — the fallback tint for a platform with no mark. */
export const PLATFORM_FALLBACK_GOLD = "#C9A55C";

/**
 * Brands whose only official mark is ARTWORK — multi-colour, multi-path, and
 * therefore impossible to express as one tintable path without redrawing it.
 * Checked BEFORE the glyph map, and rendered as an image rather than an icon.
 * See the header for why Bigo Live is here and what would remove it.
 */
const RASTER_MARKS: Record<string, string> = {
  "Bigo Live": bigoLiveMark,
};

// Lowercase + strip any parenthetical suffix so variant labels resolve:
// "X (Twitter)" and "X" both normalize to "x".
const normalize = (label: string) =>
  label.toLowerCase().replace(/\s*\(.*?\)\s*/g, " ").trim();

const NORMALIZED = Object.fromEntries(
  Object.entries(BRAND_MARKS).map(([label, mark]) => [normalize(label), mark]),
);

const resolve = (label: string) => BRAND_MARKS[label] ?? NORMALIZED[normalize(label)];

/** True when this label draws a real brand mark rather than the generic glyph. */
export function hasPlatformIcon(label: string): boolean {
  return (
    label in RASTER_MARKS || resolve(label) !== undefined || normalize(label) === "website"
  );
}

/** The brand's own colour for a label, or null when it has no glyph mark. */
export function platformBrandColor(label: string): string | null {
  return resolve(label)?.color ?? null;
}

interface PlatformIconProps {
  label: string;
  size?: number;
  className?: string;
  /**
   * Override the brand colour. Pass this where the surface wants the mark
   * monochrome (e.g. color="currentColor"). Omit it to get the brand's own
   * colour, which is the default and the design law. Ignored by artwork marks.
   */
  color?: string;
}

export function PlatformIcon({ label, size = 20, className, color }: PlatformIconProps) {
  // Artwork marks come first, and ignore `color` — there is no single tint for
  // a full-colour character, and silently monochroming a brand's own artwork
  // would be redrawing it. `alt=""` because every surface that uses this names
  // the destination beside it or on the anchor.
  const raster = RASTER_MARKS[label];
  if (raster) {
    return (
      <img
        src={raster}
        alt=""
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: "contain" }}
        decoding="async"
        loading="lazy"
      />
    );
  }

  // "Website" is generic, not a brand — use a globe.
  if (normalize(label) === "website") {
    return <Globe size={size} className={className} style={{ color: color ?? PLATFORM_FALLBACK_GOLD }} />;
  }

  const mark = resolve(label);
  if (!mark) {
    // Unknown / no-mark label → neutral link glyph in brand gold.
    return <LinkIcon size={size} className={className} style={{ color: color ?? PLATFORM_FALLBACK_GOLD }} />;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={mark.viewBox}
      width={size}
      height={size}
      fill={color ?? mark.color}
      className={className}
      role="img"
      aria-hidden
      focusable="false"
    >
      {mark.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

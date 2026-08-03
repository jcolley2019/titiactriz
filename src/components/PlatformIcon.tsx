import type { IconType } from "react-icons";
import {
  SiTiktok, SiInstagram, SiYoutube, SiFacebook, SiX, SiSnapchat, SiThreads,
  SiPinterest, SiGithub, SiTelegram, SiWhatsapp, SiCalendly, SiDiscord,
  SiSpotify, SiApplemusic, SiSoundcloud, SiYoutubemusic, SiPaypal, SiVenmo,
  SiCashapp, SiTwitch, SiKick, SiNetflix, SiSteam, SiEtsy, SiYelp,
  SiAirbnb, SiApplepodcasts, SiSubstack, SiBluesky, SiReddit, SiXiaohongshu,
  SiBereal, SiPatreon, SiKofi, SiBuymeacoffee, SiMessenger, SiVinted,
  SiKuaishou, SiRoblox,
} from "react-icons/si";
import { FaLinkedin, FaAmazon } from "react-icons/fa";
import { Link as LinkIcon, Globe } from "lucide-react";
import bigoLiveMark from "@/assets/brands/bigo-live.png";

/**
 * PORT.SOC.8 — brand marks, ported from the TitiLinks application
 * (C:\dev\titilinks, src/components/PlatformIcon.tsx).
 *
 * DESIGN law: brand marks are rendered exactly as the brand draws them. That is
 * what this component is for — Simple Icons are the brands' own marks, and the
 * two traced-in-house paths below (Depop, Vrbo) follow the same convention
 * because those two brands are not in the icon set.
 *
 * What did NOT come across, and why:
 *   · The four ADULT marks (OnlyFans, Fansly, Privacy, FatalFans) and the
 *     legacy labels the source keeps for old saved rows (Truth Social, Twitter,
 *     Skype, Pandora). None are in this site's catalog, and an icon nobody can
 *     select is dead weight.
 *   · `resolveGlyphColor` and its `@/lib/contrast` dependency. That function
 *     exists to rescue white glyphs from TitiLinks' WHITE icon circles. Every
 *     surface here paints on near-black, where the white-glyph brands are the
 *     legible ones — it has no caller and porting it would be porting a
 *     solution to a problem this site does not have. If a light-ground icon
 *     surface is ever built, port it then; the source is two files away.
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

interface PlatformMeta {
  Icon: IconType;
  color: string;
}

// ---- Custom brand marks (traced in-house; not in react-icons) ----
// Single-path, 24x24 viewBox, monochrome — same convention as Simple
// Icons, so they tint correctly via the color prop app-wide.
const makeBrandIcon = (d: string): IconType =>
  function BrandIcon({ size = 24, color = "currentColor", ...rest }) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill={color} {...rest}>
        <path d={d} />
      </svg>
    );
  };

const DepopIcon = makeBrandIcon('M15.17 0.03C15.16 0.05 15.16 1.64 15.15 3.57L15.14 7.08L12.90 7.10C10.68 7.11 10.54 7.12 9.75 7.22C6.78 7.59 4.49 8.89 3.08 11.01C2.42 12.01 2.01 13.12 1.82 14.46C1.76 14.89 1.75 16.20 1.81 16.60C2.04 18.31 2.64 19.75 3.62 20.93C5.13 22.75 7.42 23.79 10.28 23.97C10.57 23.99 12.85 24.00 16.48 24.00L22.23 24.00L22.22 12.00L22.21 0.01L18.70 0.00C15.90 -0.00 15.18 0.00 15.17 0.03M15.16 15.59L15.16 18.77L13.40 18.77C11.95 18.77 11.59 18.76 11.38 18.73C9.61 18.44 8.55 17.08 8.70 15.30C8.82 13.84 9.89 12.75 11.46 12.48C11.83 12.42 11.79 12.42 13.55 12.41L15.16 12.41L15.16 15.59Z');
const VrboIcon = makeBrandIcon('M0.52 2.01L0.00 2.02L0.31 2.12C1.23 2.42 1.91 2.98 2.46 3.89C2.82 4.47 2.98 4.88 3.60 6.79C4.20 8.64 5.72 13.35 6.18 14.78C6.37 15.36 6.76 16.58 7.05 17.48C7.77 19.72 8.41 21.73 8.45 21.84C8.49 22.01 8.49 22.00 8.99 22.00C9.38 22.00 9.46 22.00 9.46 21.96C9.46 21.94 9.29 21.39 9.08 20.74C8.87 20.09 8.66 19.42 8.61 19.26C8.56 19.10 8.45 18.77 8.37 18.53C8.30 18.28 8.13 17.76 8.00 17.36C7.88 16.96 7.59 16.06 7.36 15.34C7.13 14.63 6.81 13.62 6.65 13.11C6.48 12.59 6.02 11.14 5.61 9.88C5.21 8.63 4.83 7.43 4.76 7.24C3.80 4.22 3.61 3.74 3.15 3.04C2.65 2.28 2.11 1.98 1.30 2.00C1.16 2.00 0.81 2.01 0.52 2.01M3.65 2.01C3.52 2.02 3.49 2.05 3.55 2.08C3.61 2.12 3.91 2.61 4.07 2.92C4.38 3.55 4.49 3.88 5.27 6.33C5.52 7.10 5.89 8.29 6.11 8.97C6.33 9.66 6.55 10.33 6.59 10.47C6.64 10.61 6.80 11.15 6.97 11.66C7.41 13.05 7.71 14.00 8.27 15.76C8.54 16.62 8.87 17.67 9.00 18.08C9.33 19.13 9.92 21.00 10.02 21.35C10.07 21.51 10.12 21.65 10.13 21.66C10.14 21.68 10.67 20.51 10.68 20.42C10.69 20.40 10.61 20.12 10.52 19.82C10.27 19.01 9.99 18.13 9.61 16.88C9.42 16.28 9.12 15.31 8.93 14.73C8.75 14.15 8.50 13.36 8.38 12.99C8.26 12.61 8.09 12.05 7.99 11.73C7.88 11.41 7.74 10.96 7.67 10.73C7.60 10.49 7.40 9.88 7.24 9.38C7.08 8.87 6.80 7.97 6.61 7.37C6.42 6.77 6.13 5.84 5.95 5.30C5.44 3.69 5.21 2.86 5.07 2.18L5.04 2.03L4.80 2.01C4.55 1.99 3.88 1.99 3.65 2.01M6.32 2.01C6.19 2.03 6.18 2.06 6.18 2.54C6.19 3.36 6.33 3.97 6.96 5.96C7.12 6.49 7.40 7.36 7.56 7.89C7.72 8.42 8.01 9.33 8.19 9.91C8.37 10.49 8.66 11.39 8.82 11.90C8.98 12.42 9.17 13.01 9.23 13.22C9.74 14.84 10.60 17.60 11.07 19.15C11.11 19.30 11.16 19.40 11.17 19.39C11.18 19.38 11.32 19.09 11.46 18.76L11.74 18.15L11.23 16.52C10.96 15.63 10.64 14.57 10.51 14.18C9.93 12.30 8.92 9.05 8.63 8.14C8.45 7.59 8.26 6.98 8.21 6.79C8.15 6.60 7.99 6.11 7.87 5.70C7.38 4.13 7.33 3.94 7.33 3.29C7.33 2.96 7.34 2.82 7.38 2.69C7.43 2.49 7.59 2.15 7.67 2.08C7.69 2.06 7.72 2.03 7.72 2.02C7.72 2.00 6.47 1.99 6.32 2.01M9.06 2.02C8.87 2.04 8.78 2.09 8.61 2.26C8.32 2.57 8.20 2.95 8.19 3.54C8.19 4.08 8.27 4.51 8.53 5.32C8.60 5.53 8.75 6.03 8.88 6.45C9.01 6.86 9.41 8.15 9.78 9.32C10.94 13.03 11.94 16.30 12.11 16.91C12.15 17.04 12.18 17.13 12.19 17.13C12.21 17.13 12.75 15.87 12.75 15.83C12.75 15.81 12.61 15.34 12.44 14.79C12.10 13.68 11.94 13.14 11.75 12.51C11.68 12.28 11.54 11.84 11.45 11.53C11.35 11.22 11.02 10.15 10.72 9.16C10.41 8.17 10.01 6.86 9.82 6.26C9.63 5.65 9.44 5.02 9.39 4.84C9.13 3.90 9.23 3.17 9.69 2.56C9.82 2.38 10.20 2.04 10.26 2.04C10.28 2.04 10.29 2.04 10.29 2.02C10.29 2.00 9.25 1.99 9.06 2.02M11.97 2.02C11.12 2.11 10.43 2.72 10.23 3.54C10.18 3.74 10.18 3.82 10.19 4.20C10.21 4.81 10.22 4.87 10.87 6.98C11.28 8.35 11.49 9.05 11.59 9.37C11.63 9.51 11.67 9.61 11.67 9.60C11.68 9.58 11.61 9.05 11.52 8.42C11.03 4.91 11.03 4.17 11.55 3.29C11.88 2.74 12.59 2.29 13.45 2.08C13.57 2.06 13.66 2.03 13.66 2.02C13.66 1.99 12.19 1.99 11.97 2.02M22.82 2.11C21.35 2.27 20.41 3.34 18.25 7.37C17.89 8.04 16.90 10.00 16.90 10.04C16.90 10.05 16.98 9.90 17.09 9.71C17.75 8.49 18.69 7.00 19.33 6.14C20.81 4.13 22.40 2.75 23.79 2.24L24.00 2.17L23.89 2.15C23.76 2.12 22.97 2.10 22.82 2.11M19.53 2.20C19.27 2.32 19.15 2.59 18.87 3.70C18.42 5.50 17.84 7.20 17.00 9.16C16.72 9.84 16.72 9.82 16.74 9.80C16.77 9.79 17.78 7.67 18.31 6.54C18.99 5.10 19.57 3.91 19.80 3.52C20.21 2.79 20.62 2.37 21.08 2.22C21.15 2.19 21.20 2.17 21.20 2.16C21.20 2.16 20.85 2.15 20.42 2.15C19.72 2.15 19.63 2.16 19.53 2.20M16.49 2.20C16.24 2.22 15.96 2.27 15.97 2.28C15.98 2.29 16.07 2.31 16.17 2.34C16.90 2.53 17.36 3.05 17.53 3.91C17.60 4.23 17.59 5.23 17.53 5.71C17.36 6.92 16.91 8.56 16.39 9.88C16.36 9.96 16.34 10.03 16.34 10.04C16.37 10.06 16.97 8.60 17.26 7.81C18.55 4.30 18.61 2.46 17.44 2.21C17.31 2.18 16.73 2.17 16.49 2.20Z');

// Keyed by the exact catalog label. Near-black brands use #FFFFFF so they stay
// visible on dark surfaces — which is every surface on this site. LinkedIn comes
// from Font Awesome because Simple Icons removed its mark.
const PLATFORMS: Record<string, PlatformMeta> = {
  "TikTok": { Icon: SiTiktok, color: "#FFFFFF" },
  "Instagram": { Icon: SiInstagram, color: "#E4405F" },
  "YouTube": { Icon: SiYoutube, color: "#FF0000" },
  "Facebook": { Icon: SiFacebook, color: "#1877F2" },
  "X (Twitter)": { Icon: SiX, color: "#FFFFFF" },
  "Snapchat": { Icon: SiSnapchat, color: "#FFFC00" },
  "Threads": { Icon: SiThreads, color: "#FFFFFF" },
  "Pinterest": { Icon: SiPinterest, color: "#E60023" },
  "Bluesky": { Icon: SiBluesky, color: "#1185FE" },
  "Reddit": { Icon: SiReddit, color: "#FF4500" },
  "RedNote": { Icon: SiXiaohongshu, color: "#FF2442" },
  "BeReal": { Icon: SiBereal, color: "#FFFFFF" },
  "Kwai": { Icon: SiKuaishou, color: "#FF4906" },
  "LinkedIn": { Icon: FaLinkedin, color: "#0A66C2" },
  "GitHub": { Icon: SiGithub, color: "#FFFFFF" },
  "Telegram": { Icon: SiTelegram, color: "#26A5E4" },
  "WhatsApp": { Icon: SiWhatsapp, color: "#25D366" },
  "Messenger": { Icon: SiMessenger, color: "#0866FF" },
  "Calendly": { Icon: SiCalendly, color: "#006BFF" },
  "Discord": { Icon: SiDiscord, color: "#5865F2" },
  "Spotify": { Icon: SiSpotify, color: "#1DB954" },
  "Apple Music": { Icon: SiApplemusic, color: "#FA243C" },
  "SoundCloud": { Icon: SiSoundcloud, color: "#FF5500" },
  "YouTube Music": { Icon: SiYoutubemusic, color: "#FF0000" },
  "Amazon Music": { Icon: FaAmazon, color: "#FF9900" },
  "PayPal": { Icon: SiPaypal, color: "#0070BA" },
  "Venmo": { Icon: SiVenmo, color: "#3D95CE" },
  "Cash App": { Icon: SiCashapp, color: "#00D632" },
  "Patreon": { Icon: SiPatreon, color: "#FFFFFF" },
  "Ko-fi": { Icon: SiKofi, color: "#FF6433" },
  "Buy Me a Coffee": { Icon: SiBuymeacoffee, color: "#FFDD00" },
  "Twitch": { Icon: SiTwitch, color: "#9146FF" },
  "Kick": { Icon: SiKick, color: "#53FC18" },
  "Netflix": { Icon: SiNetflix, color: "#E50914" },
  "Steam": { Icon: SiSteam, color: "#FFFFFF" },
  "Roblox": { Icon: SiRoblox, color: "#FFFFFF" },
  "Substack": { Icon: SiSubstack, color: "#FF6719" },
  "Apple Podcasts": { Icon: SiApplepodcasts, color: "#9933CC" },
  "Depop": { Icon: DepopIcon, color: "#FD2801" },
  "Vinted": { Icon: SiVinted, color: "#007782" },
  "Etsy": { Icon: SiEtsy, color: "#F16521" },
  "Amazon": { Icon: FaAmazon, color: "#FF9900" },
  "Yelp": { Icon: SiYelp, color: "#FF1A1A" },
  "Airbnb": { Icon: SiAirbnb, color: "#FF5A5F" },
  "Vrbo": { Icon: VrboIcon, color: "#02CEC6" },
};

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

const NORMALIZED: Record<string, PlatformMeta> = Object.fromEntries(
  Object.entries(PLATFORMS).map(([label, meta]) => [normalize(label), meta]),
);

function resolve(label: string): PlatformMeta | undefined {
  return PLATFORMS[label] ?? NORMALIZED[normalize(label)];
}

/** True when this label draws a real brand mark rather than the generic glyph. */
export function hasPlatformIcon(label: string): boolean {
  return (
    label in RASTER_MARKS || resolve(label) !== undefined || normalize(label) === "website"
  );
}

/** The brand's own colour for a label, or null when it has no mark. */
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
   * colour, which is the default and the design law.
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
  const meta = resolve(label);
  if (!meta) {
    // Unknown / no-mark label → neutral link glyph in brand gold.
    return <LinkIcon size={size} className={className} style={{ color: color ?? PLATFORM_FALLBACK_GOLD }} />;
  }
  return <meta.Icon size={size} className={className} color={color ?? meta.color} />;
}

/**
 * PORT.SOC.8 — the platform catalog, ported from the TitiLinks application
 * (C:\dev\titilinks, src/lib/platform-catalog.ts).
 *
 * Single source of truth for the admin Links picker and for the Socials act.
 * Rendering goes through PlatformIcon, which keys off `label` — entries carry
 * no icon of their own, exactly as in the source.
 *
 * TWO deliberate differences from the source catalog, both rulings:
 *
 *   1. The ADULT (18+) group is DROPPED — OnlyFans, Fansly, Privacy, FatalFans.
 *      Dropping it also drops everything that existed only to serve it: the
 *      adult gate, its modal and the `is_adult` column all stay behind in
 *      TitiLinks. None of them port.
 *   2. BIGO LIVE is ADDED, in SOCIAL. It is a live-streaming platform and
 *      Cristyna is a streamer (`hero.roles.streamer` already ships), so Social
 *      beats Entertainment.
 *
 * 7 groups / 51 platforms, minus 4, plus 1 = 6 groups / 48 platforms.
 *
 * The source stores an English `placeholder` string per platform. This site is
 * ES-primary and its admin is fully bilingual, so each entry instead carries a
 * `hint` KIND, which the picker renders through i18n with the platform's name
 * interpolated: `admin.links.hints.username` + "TikTok" → "Usuario de TikTok" /
 * "TikTok username". Same information, in the reader's language.
 *
 * `label` is the stored value of `social_links.platform`. It is the join key
 * between this file, PlatformIcon and the database — changing one is changing
 * all three.
 */

/** How a platform's address is usually written. Rendered via i18n, per locale. */
export type PlatformHint =
  | "username"
  | "handle"
  | "id"
  | "phone"
  | "cashtag"
  | "slug"
  | "profileUrl"
  | "channelUrl"
  | "inviteUrl"
  | "shopUrl"
  | "showUrl"
  | "businessUrl"
  | "propertyUrl"
  | "link";

export type CatalogPlatform = { label: string; hint: PlatformHint };
export type CatalogGroup = { label: string; key: string; platforms: CatalogPlatform[] };

export const PLATFORM_CATALOG: CatalogGroup[] = [
  {
    label: "SOCIAL",
    key: "social",
    platforms: [
      { label: "TikTok", hint: "username" },
      { label: "Instagram", hint: "username" },
      { label: "YouTube", hint: "channelUrl" },
      { label: "Facebook", hint: "profileUrl" },
      { label: "X (Twitter)", hint: "username" },
      { label: "Snapchat", hint: "username" },
      { label: "Threads", hint: "username" },
      { label: "Pinterest", hint: "username" },
      { label: "Bluesky", hint: "handle" },
      { label: "Reddit", hint: "username" },
      { label: "Lemon8", hint: "username" },
      { label: "RedNote", hint: "profileUrl" },
      { label: "BeReal", hint: "username" },
      { label: "Kwai", hint: "profileUrl" },
      // The one addition to the ported catalog — see the header.
      { label: "Bigo Live", hint: "id" },
    ],
  },
  {
    label: "BUSINESS",
    key: "business",
    platforms: [
      { label: "LinkedIn", hint: "profileUrl" },
      { label: "GitHub", hint: "username" },
      { label: "Telegram", hint: "username" },
      { label: "WhatsApp", hint: "phone" },
      { label: "Messenger", hint: "username" },
      { label: "Calendly", hint: "username" },
      { label: "Discord", hint: "inviteUrl" },
    ],
  },
  {
    label: "MUSIC",
    key: "music",
    platforms: [
      { label: "Spotify", hint: "profileUrl" },
      { label: "Apple Music", hint: "link" },
      { label: "SoundCloud", hint: "username" },
      { label: "YouTube Music", hint: "link" },
      { label: "Amazon Music", hint: "link" },
    ],
  },
  {
    label: "PAYMENT",
    key: "payment",
    platforms: [
      { label: "PayPal", hint: "link" },
      { label: "Venmo", hint: "username" },
      { label: "Cash App", hint: "cashtag" },
      { label: "Patreon", hint: "username" },
      { label: "Ko-fi", hint: "username" },
      { label: "Buy Me a Coffee", hint: "username" },
      { label: "Whop", hint: "slug" },
    ],
  },
  {
    label: "ENTERTAINMENT",
    key: "entertainment",
    platforms: [
      { label: "Twitch", hint: "username" },
      { label: "Kick", hint: "username" },
      { label: "Netflix", hint: "link" },
      { label: "Steam", hint: "profileUrl" },
      { label: "Roblox", hint: "profileUrl" },
      { label: "Substack", hint: "handle" },
      { label: "Apple Podcasts", hint: "showUrl" },
    ],
  },
  {
    label: "LIFESTYLE",
    key: "lifestyle",
    platforms: [
      { label: "Depop", hint: "username" },
      { label: "Vinted", hint: "profileUrl" },
      { label: "Etsy", hint: "shopUrl" },
      { label: "Amazon", hint: "shopUrl" },
      { label: "Yelp", hint: "businessUrl" },
      { label: "Airbnb", hint: "profileUrl" },
      { label: "Vrbo", hint: "propertyUrl" },
    ],
  },
];

/** Every catalog label, flat, in picker order. */
export const PLATFORM_LABELS: string[] = PLATFORM_CATALOG.flatMap((g) =>
  g.platforms.map((p) => p.label),
);

/** Look one platform up by its stored label. */
export function findPlatform(label: string): CatalogPlatform | undefined {
  for (const group of PLATFORM_CATALOG) {
    const hit = group.platforms.find((p) => p.label === label);
    if (hit) return hit;
  }
  return undefined;
}

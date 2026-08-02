/**
 * PORT.SOC.8 — URL → catalog label, ported from the TitiLinks application
 * (C:\dev\titilinks, src/lib/platform-from-url.ts).
 *
 * A pure function: it maps a link URL's hostname to a PLATFORM_CATALOG label,
 * and returns null for anything it does not recognise so callers can fall back
 * to a generic link glyph. It never fetches and never throws.
 *
 * Ported host-for-host with the catalog's own two edits: the four ADULT hosts
 * are gone, and Bigo Live's hosts are added. Every label this returns must
 * exist in PLATFORM_CATALOG — platform-catalog.spec proves it.
 */
const HOST_MAP: Array<[RegExp, string]> = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)music\.youtube\.com$/, "YouTube Music"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "Facebook"],
  [/(^|\.)(x\.com|twitter\.com)$/, "X (Twitter)"],
  [/(^|\.)snapchat\.com$/, "Snapchat"],
  [/(^|\.)threads\.(com|net)$/, "Threads"],
  [/(^|\.)pinterest\.(com|ca|co\.uk)$/, "Pinterest"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)github\.com$/, "GitHub"],
  [/(^|\.)(t\.me|telegram\.(me|org))$/, "Telegram"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "WhatsApp"],
  [/(^|\.)calendly\.com$/, "Calendly"],
  [/(^|\.)(discord\.gg|discord\.com)$/, "Discord"],
  [/(^|\.)spotify\.com$/, "Spotify"],
  [/(^|\.)music\.apple\.com$/, "Apple Music"],
  [/(^|\.)podcasts\.apple\.com$/, "Apple Podcasts"],
  [/(^|\.)music\.amazon\.com$/, "Amazon Music"],
  [/(^|\.)soundcloud\.com$/, "SoundCloud"],
  [/(^|\.)(paypal\.com|paypal\.me)$/, "PayPal"],
  [/(^|\.)venmo\.com$/, "Venmo"],
  [/(^|\.)cash\.app$/, "Cash App"],
  [/(^|\.)twitch\.tv$/, "Twitch"],
  [/(^|\.)kick\.com$/, "Kick"],
  [/(^|\.)netflix\.com$/, "Netflix"],
  [/(^|\.)(steampowered\.com|steamcommunity\.com)$/, "Steam"],
  [/(^|\.)etsy\.com$/, "Etsy"],
  [/(^|\.)depop\.com$/, "Depop"],
  [/(^|\.)yelp\.com$/, "Yelp"],
  [/(^|\.)airbnb\.(com|ca|co\.uk)$/, "Airbnb"],
  [/(^|\.)vrbo\.com$/, "Vrbo"],
  [/(^|\.)bsky\.app$/, "Bluesky"],
  [/(^|\.)reddit\.com$/, "Reddit"],
  [/(^|\.)lemon8-app\.com$/, "Lemon8"],
  [/(^|\.)(xiaohongshu\.com|xhslink\.com)$/, "RedNote"],
  [/(^|\.)(bere\.al|bereal\.com)$/, "BeReal"],
  [/(^|\.)patreon\.com$/, "Patreon"],
  [/(^|\.)ko-fi\.com$/, "Ko-fi"],
  [/(^|\.)buymeacoffee\.com$/, "Buy Me a Coffee"],
  [/(^|\.)(m\.me|messenger\.com)$/, "Messenger"],
  [/(^|\.)vinted\.(com|es|fr|it|co\.uk|de|pl|nl|pt|lt)$/, "Vinted"],
  [/(^|\.)(kwai\.com|kwai-video\.com|kuaishou\.com)$/, "Kwai"],
  [/(^|\.)roblox\.com$/, "Roblox"],
  [/(^|\.)whop\.com$/, "Whop"],
  [/(^|\.)amazon\.(com|co\.uk|es|it|fr|de|com\.br|com\.mx|ca)$/, "Amazon"],
  [/(^|\.)substack\.com$/, "Substack"],
  // The catalog's one addition. bigo.tv is the profile host; the other two are
  // the app's own share domains.
  [/(^|\.)(bigo\.tv|bigolive\.tv|bigo\.sg)$/, "Bigo Live"],
];

export function platformFromUrl(url: string | null | undefined): string | null {
  const raw = (url || "").trim();
  if (!raw || /^mailto:/i.test(raw) || /^tel:/i.test(raw)) return null;
  // A bare email ("user@host.tld" — no scheme, no slashes) isn't a platform URL,
  // but a social URL with an @handle in the PATH (tiktok.com/@user) IS — so bail
  // only on the former, not on every '@'.
  if (!/^https?:\/\//i.test(raw) && /^[^\s/]+@[^\s/]+$/.test(raw)) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
      .hostname.toLowerCase().replace(/^www\./, "");
    for (const [re, label] of HOST_MAP) {
      if (re.test(host)) return label;
    }
  } catch { /* unparseable — treat as generic */ }
  return null;
}

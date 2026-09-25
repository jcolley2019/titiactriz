// youtube-transcript — BLOG.2 (ported from joeyc.ai) → BLOG.2b (player API)
//
// Contract: POST { url } with the caller's Supabase auth -> { transcript }
//
// BLOG.2b: the joeyc.ai scraper read caption tracks out of the watch page. That
// stopped working: from Supabase the page carries no captions block at all,
// and from a home connection every caption URL it lists needs a proof-of-origin
// token and returns 0 bytes. The caption tracks now come from YouTube's player
// API as the Android app asks for them, whose caption URLs return the XML
// (format 3: <p t= d=> lines, optionally split into <s> words; the old
// <text> format is still read).
//
// Track choice is unchanged from the port: English if there is one, else the
// first track. The gate is the site's pattern (translate-text): admin-only via
// the caller's bearer token, checked before the body is read and before any
// YouTube request, so nobody else can use this as a free scraper.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ANDROID_CLIENT = {
  clientName: "ANDROID",
  clientVersion: "20.10.38",
  androidSdkVersion: 30,
  hl: "en",
};
const ANDROID_UA = "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** Caption XML (format 3 <p>, or the older <text>) → one line of transcript. */
export function captionXmlToText(xml: string): string {
  const segments: string[] = [];
  const re = /<(p|text)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ""))
      .replace(/\s+/g, " ")
      .trim();
    if (text) segments.push(text);
  }
  return segments.join(" ");
}

type CaptionTrack = { baseUrl: string; languageCode?: string; kind?: string };

async function fetchTranscript(videoId: string): Promise<string> {
  const playerRes = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": ANDROID_UA },
    body: JSON.stringify({ context: { client: ANDROID_CLIENT }, videoId }),
  });
  if (!playerRes.ok) throw new Error(`YouTube player request failed (${playerRes.status})`);
  const player = await playerRes.json();

  const status = player?.playabilityStatus?.status;
  if (status && status !== "OK") {
    throw new Error(`Video not available (${status}${player?.playabilityStatus?.reason ? `: ${player.playabilityStatus.reason}` : ""})`);
  }

  const tracks: CaptionTrack[] = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (tracks.length === 0) throw new Error("No captions available for this video");

  // Prefer English, fall back to the first track (unchanged from the port).
  const track = tracks.find((t) => t.languageCode === "en" || t.languageCode?.startsWith("en")) ?? tracks[0];

  const captionRes = await fetch(track.baseUrl, { headers: { "User-Agent": ANDROID_UA } });
  const transcript = captionXmlToText(await captionRes.text());
  if (!transcript) throw new Error("No transcript text found");
  return transcript;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Admin gate — the same check translate-text uses.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice("Bearer ".length);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return json({ error: "Forbidden" }, 403);

    const { url } = await req.json().catch(() => ({ url: null }));
    if (!url || typeof url !== "string") return json({ error: "URL is required" }, 400);

    const videoId = extractVideoId(url);
    if (!videoId) return json({ error: "Invalid YouTube URL" }, 400);

    const transcript = await fetchTranscript(videoId);
    return json({ transcript });
  } catch (err) {
    console.error("Error:", err);
    return json({ error: err instanceof Error ? err.message : "Failed to fetch transcript" }, 500);
  }
});

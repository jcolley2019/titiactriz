// youtube-transcript — BLOG.2 (ported as-is from joeyc.ai)
//
// Contract: POST { url } with the caller's Supabase auth -> { transcript }
//
// The transcript logic is joeyc.ai's, unchanged. Only the gate differs: the
// site's pattern (translate-text) — admin-only via the caller's bearer token,
// checked before the body is read and before any YouTube fetch, so nobody
// else can use this as a free scraper.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchTranscript(videoId: string): Promise<string> {
  // Fetch the video page to get caption track info
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  const html = await pageRes.text();

  // Extract captions JSON from the page
  const captionMatch = html.match(
    /"captions":\s*(\{.*?"playerCaptionsTracklistRenderer".*?\})\s*,\s*"videoDetails"/s,
  );

  if (!captionMatch) {
    throw new Error("No captions available for this video");
  }

  let captionsData;
  try {
    captionsData = JSON.parse(captionMatch[1]);
  } catch {
    throw new Error("Failed to parse captions data");
  }

  const tracks = captionsData?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!tracks || tracks.length === 0) {
    throw new Error("No caption tracks found");
  }

  // Prefer English, fall back to first track
  const englishTrack =
    tracks.find(
      (t: { languageCode: string }) => t.languageCode === "en" || t.languageCode?.startsWith("en"),
    ) || tracks[0];

  const captionUrl = englishTrack.baseUrl;

  // Fetch the caption XML
  const captionRes = await fetch(captionUrl);
  const captionXml = await captionRes.text();

  // Parse XML and extract text
  const textSegments: string[] = [];
  const regex = /<text[^>]*>(.*?)<\/text>/gs;
  let match;

  while ((match = regex.exec(captionXml)) !== null) {
    const text = match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, " ")
      .trim();
    if (text) textSegments.push(text);
  }

  if (textSegments.length === 0) {
    throw new Error("No transcript text found");
  }

  return textSegments.join(" ");
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

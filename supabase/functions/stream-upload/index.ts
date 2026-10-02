// stream-upload — MEDIA.VIDEO.1
// Uploaded videos (hero background, Events clips) go to Cloudflare Stream
// instead of the gallery bucket: Stream keeps the original, builds the adaptive
// ladder and a poster, and the site plays HLS. This function is the only place
// the Stream token lives; the browser never sees it. The browser uploads the
// file itself, straight to the one-time uploadURL that `create` hands back.
//
// Contract: POST JSON with the caller's Supabase auth ->
//   { action: "create", kind: "hero" | "event", maxDurationSeconds?: number }
//     -> { uid, uploadURL }            (maxDurationSeconds default 600, hero 20)
//   { action: "status", uid }
//     -> { ready, state, errorReason, duration, width, height, customerCode }
//        duration/width/height are null until Stream knows them (it reports -1);
//        customerCode is the <code> of https://customer-<code>.cloudflarestream.com,
//        read from the video's `preview` URL (null if absent).
//   { action: "delete", uid } -> { deleted: true }
//
// Gate: admin-only exactly as generate-alt-text — platform verify_jwt=true, then
// the bearer token is resolved to a user and re-checked with has_role('admin')
// before the body is read and before any Cloudflare request.
//
// Secrets (Deno.env): CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_TOKEN
// (Account · Stream · Edit). The token is never logged and never returned.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DEFAULT_MAX_DURATION = { hero: 20, event: 600 } as const;
// Cloudflare's own bounds for maxDurationSeconds.
const MAX_DURATION_CEILING = 21600;
// A Stream video uid is 32 hex characters. Anything else never reaches the
// Cloudflare API, so a crafted uid cannot walk the token to another endpoint.
const UID_RE = /^[a-f0-9]{32}$/;
const CUSTOMER_RE = /^https:\/\/customer-([a-z0-9]+)\.cloudflarestream\.com\//i;

type Kind = keyof typeof DEFAULT_MAX_DURATION;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// A Cloudflare failure becomes a short, token-free error for the admin UI.
async function cfError(res: Response) {
  const body = await res.json().catch(() => null);
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const detail = errors
    .map((e: { message?: string }) => e?.message ?? "")
    .filter(Boolean)
    .join("; ")
    .slice(0, 200);
  const status = res.status === 404 || res.status === 429 ? res.status : 502;
  return json({ error: `Cloudflare Stream ${res.status}${detail ? `: ${detail}` : ""}` }, status);
}

const known = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const streamToken = Deno.env.get("CLOUDFLARE_STREAM_TOKEN");
    if (!accountId || !streamToken) return json({ error: "Cloudflare Stream not configured" }, 500);

    // Verify caller is a signed-in admin (token-based; no anon/publishable key needed)
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";

    const api = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`;
    const cfHeaders = { Authorization: `Bearer ${streamToken}` };

    if (action === "create") {
      const kind = body.kind as Kind;
      if (kind !== "hero" && kind !== "event") return json({ error: "Invalid kind" }, 400);
      let maxDurationSeconds: number = DEFAULT_MAX_DURATION[kind];
      if (body.maxDurationSeconds !== undefined && body.maxDurationSeconds !== null) {
        const m = body.maxDurationSeconds;
        if (!Number.isInteger(m) || m < 1 || m > MAX_DURATION_CEILING) {
          return json({ error: "Invalid maxDurationSeconds" }, 400);
        }
        maxDurationSeconds = m;
      }

      const res = await fetch(`${api}/direct_upload`, {
        method: "POST",
        headers: { ...cfHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          maxDurationSeconds,
          requireSignedURLs: false,
          meta: { kind, site: "titiactriz" },
        }),
      });
      if (!res.ok) return cfError(res);
      const result = (await res.json())?.result;
      if (typeof result?.uid !== "string" || typeof result?.uploadURL !== "string") {
        return json({ error: "Cloudflare Stream returned no upload URL" }, 502);
      }
      return json({ uid: result.uid, uploadURL: result.uploadURL });
    }

    if (action === "status" || action === "delete") {
      const uid = typeof body.uid === "string" ? body.uid : "";
      if (!UID_RE.test(uid)) return json({ error: "Invalid uid" }, 400);

      if (action === "delete") {
        const res = await fetch(`${api}/${uid}`, { method: "DELETE", headers: cfHeaders });
        if (!res.ok) return cfError(res);
        return json({ deleted: true });
      }

      const res = await fetch(`${api}/${uid}`, { headers: cfHeaders });
      if (!res.ok) return cfError(res);
      const video = (await res.json())?.result ?? {};
      const state: string = typeof video.status?.state === "string" ? video.status.state : "unknown";
      const preview: string = typeof video.preview === "string" ? video.preview : "";
      return json({
        ready: state === "ready",
        state,
        errorReason: video.status?.errorReasonText || video.status?.errorReasonCode || null,
        duration: known(video.duration),
        width: known(video.input?.width),
        height: known(video.input?.height),
        customerCode: preview.match(CUSTOMER_RE)?.[1] ?? null,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

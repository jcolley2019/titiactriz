// generate-alt-text — TitiActriz owned-backend version (ALT.1)
// Replaces the Lovable AI gateway with a direct Anthropic API call (Claude Haiku 4.5 vision) using ANTHROPIC_API_KEY.
// Contract preserved: POST { id } with the caller's Supabase auth -> { alt_text }.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "gallery";
const MARKER = `/storage/v1/object/public/${BUCKET}/`;
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const PROMPT = `Escribe un texto alternativo conciso y descriptivo en espanol para esta foto del portafolio de Cristyna Polentino, actriz y bailarina colombiana. Describe de forma natural y precisa lo que se ve: persona, accion, entorno y vestuario si es relevante. Incluye su nombre solo si ella es claramente la protagonista. Maximo 125 caracteres. Sin comillas. Sin relleno de palabras clave. Devuelve unicamente el texto alternativo.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

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
    const photoId = typeof body.id === "string" ? body.id : "";
    if (!photoId) return json({ error: "Missing id" }, 400);

    const { data: photo, error: phErr } = await admin
      .from("gallery_photos")
      .select("id,image_url")
      .eq("id", photoId)
      .maybeSingle();
    if (phErr || !photo) return json({ error: "Photo not found" }, 404);

    const idx = (photo.image_url as string).indexOf(MARKER);
    if (idx === -1) return json({ error: "Image not in gallery bucket" }, 400);
    const path = (photo.image_url as string).slice(idx + MARKER.length);

    const { data: fileBlob, error: dlErr } = await admin.storage.from(BUCKET).download(path);
    if (dlErr || !fileBlob) return json({ error: "Download failed" }, 500);

    const buf = new Uint8Array(await fileBlob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const base64 = btoa(binary);
    const mime = fileBlob.type || "image/webp";

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "Rate limited" }, 429);
      return json({ error: `AI error: ${txt.slice(0, 200)}` }, 500);
    }

    const aiJson = await aiRes.json();
    const blocks = Array.isArray(aiJson?.content) ? aiJson.content : [];
    let text: string = blocks
      .filter((b: { type?: string }) => b?.type === "text")
      .map((b: { text?: string }) => b?.text ?? "")
      .join("")
      .trim();
    text = text.replace(/^["'\u201c\u201d\u2018\u2019]+|["'\u201c\u201d\u2018\u2019]+$/g, "").trim();
    if (!text) return json({ error: "Empty AI response" }, 500);

    return json({ alt_text: text });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
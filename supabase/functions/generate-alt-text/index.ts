import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "gallery";
const MARKER = `/storage/v1/object/public/${BUCKET}/`;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const photoId = typeof body.id === "string" ? body.id : "";
    if (!photoId) return json({ error: "Missing id" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
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
    const dataUrl = `data:${mime};base64,${base64}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "Rate limited" }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: `AI error: ${txt.slice(0, 200)}` }, 500);
    }

    const aiJson = await aiRes.json();
    let text: string = aiJson?.choices?.[0]?.message?.content ?? "";
    if (typeof text !== "string") text = String(text ?? "");
    text = text.trim().replace(/^["'\u201c\u201d\u2018\u2019]+|["'\u201c\u201d\u2018\u2019]+$/g, "").trim();

    return json({ alt_text: text });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

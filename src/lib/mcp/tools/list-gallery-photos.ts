import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_gallery_photos",
  title: "List gallery photos",
  description: "List published gallery photos on titiactriz.com, ordered by sort_order. Returns image URLs and alt text.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum number of photos to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("gallery_photos")
      .select("id,image_url,alt_text,sort_order")
      .eq("is_published", true)
      .eq("is_archived", false)
      .order("sort_order", { ascending: true })
      .limit(limit);

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { photos: data ?? [] },
    };
  },
});

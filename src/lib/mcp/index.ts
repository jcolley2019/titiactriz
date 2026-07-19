import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listGalleryPhotosTool from "./tools/list-gallery-photos";
import getEventsBoardTool from "./tools/get-events-board";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "titiactriz-mcp",
  title: "Cristyna Polentino MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Cristyna Polentino (titiactriz.com) site. Use `whoami` to confirm the connected user, `list_gallery_photos` to read published portfolio photos, and `get_events_board` to read the current events banner and event list.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listGalleryPhotosTool, getEventsBoardTool],
});

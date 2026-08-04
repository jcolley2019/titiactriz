import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import webeditConnect from "./webedit-connect.plugin";

// CLEAN.LOVABLE.1 — the site left Lovable; its build plugins are gone with it.
// `componentTagger` annotated the DOM for Lovable's visual editor, which nothing
// uses any more. `mcpPlugin` bundled src/lib/mcp into supabase/functions/mcp on
// every dev run, and once the Lovable environment was gone it emitted an
// unresolvable `npm:C:\...` local-path import — a broken edge function that sat
// permanently modified in the working tree. Both are removed rather than pinned:
// nothing referenced the function they produced.
// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), webeditConnect()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

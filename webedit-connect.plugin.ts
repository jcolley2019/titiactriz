import type { Plugin } from "vite";

// WEBEDIT.VISION.1a — dev-only bridge to the WebEdit design tool (C:\dev\webedit).
// Injects WebEdit's connector script so the running site can be framed and
// live-edited from localhost:5199. `apply: "serve"` keeps it out of builds;
// if WebEdit isn't running the script 404s and the site is unaffected.
export default function webeditConnect(): Plugin {
  return {
    name: "webedit-connect",
    apply: "serve",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { src: "http://localhost:5199/webedit-connect.js" },
          injectTo: "body",
        },
      ];
    },
  };
}

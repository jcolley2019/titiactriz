/**
 * BLOG.1 — per-post URLs in public/sitemap.xml, refreshed before every build
 * (`prebuild`).
 *
 * The sitemap stays a hand-kept static file: every entry in it is left exactly
 * as written. Only the region between the two BLOG-POSTS markers belongs to this
 * script, and it is rewritten from the published posts — slug and updated_at,
 * read with the same anon key and URL the browser client uses
 * (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, from the environment or
 * the .env files Vite would read). RLS serves the anon key published posts only.
 *
 * It must never fail a build. No network, no env, a bad answer, missing markers:
 * the file is kept as it is, a warning is printed, and the exit code is 0.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITEMAP = resolve(ROOT, "public/sitemap.xml");
const SITE = "https://titiactriz.com";
const START = "<!-- BLOG-POSTS:START";
const END = "<!-- BLOG-POSTS:END -->";
const TIMEOUT_MS = 8000;

const warn = (msg) => console.warn(`[build-sitemap] WARNING: ${msg} — public/sitemap.xml kept as is.`);

/** Vite's precedence, lowest first: .env, .env.local, .env.production, .env.production.local. */
function readEnv() {
  const env = {};
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    const file = resolve(ROOT, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return {
    url: process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL,
    key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const entry = ({ slug, updated_at }) => {
  const loc = `${SITE}/blog/${slug}`;
  const day = typeof updated_at === "string" ? updated_at.slice(0, 10) : "";
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    `    <xhtml:link rel="alternate" hreflang="es" href="${loc}" />`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${loc}" />`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />`,
    ...(/^\d{4}-\d{2}-\d{2}$/.test(day) ? [`    <lastmod>${day}</lastmod>`] : []),
    "    <changefreq>monthly</changefreq>",
    "    <priority>0.6</priority>",
    "  </url>",
  ].join("\n");
};

async function main() {
  let xml;
  try {
    xml = readFileSync(SITEMAP, "utf8");
  } catch {
    return warn("could not read public/sitemap.xml");
  }
  const eol = xml.includes("\r\n") ? "\r\n" : "\n";
  const start = xml.indexOf(START);
  const end = xml.indexOf(END);
  if (start < 0 || end < start) return warn("BLOG-POSTS markers not found");
  const startLineEnd = xml.indexOf("-->", start) + 3;

  const { url, key } = readEnv();
  if (!url || !key) return warn("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY not set");

  let rows;
  try {
    const res = await fetch(
      `${url}/rest/v1/blog_posts?select=slug,updated_at&status=eq.published&order=published_at.desc`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) return warn(`blog_posts answered ${res.status}`);
    rows = await res.json();
  } catch (e) {
    return warn(`could not reach Supabase (${e instanceof Error ? e.message : e})`);
  }
  if (!Array.isArray(rows)) return warn("blog_posts answered something that is not a list");

  const posts = rows.filter((r) => r && typeof r.slug === "string" && SLUG.test(r.slug));
  const block = posts.map(entry).join("\n");
  const region = `${eol}${block ? block.replace(/\n/g, eol) + eol : ""}  `;
  const next = xml.slice(0, startLineEnd) + region + xml.slice(end);
  if (next === xml) {
    console.log(`[build-sitemap] ${posts.length} published post(s); sitemap already current.`);
    return;
  }
  writeFileSync(SITEMAP, next);
  console.log(`[build-sitemap] ${posts.length} published post(s) written to public/sitemap.xml.`);
}

main().catch((e) => warn(`unexpected error (${e instanceof Error ? e.message : e})`)).finally(() => {
  process.exitCode = 0;
});

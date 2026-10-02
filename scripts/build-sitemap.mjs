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
 * BLOG.GW.1 — the Green World lane (/blog?c=greenworld) is its own search
 * result with its own head, so the region opens with it as a static entry,
 * listed whatever the posts are. The committed file carries it too, so a build
 * that cannot reach Supabase still lists it.
 *
 * BLOG.GW.2 — and each Green World kind (/blog?c=greenworld&k=<kind>) after
 * it, the same way: static, listed every build. Their `&` is written `&amp;`.
 *
 * It must never fail a build. No network, no env, a bad answer, missing markers:
 * the file is kept as it is, a warning is printed, and the exit code is 0.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, readEnv } from "./prebuild-env.mjs";

const SITEMAP = resolve(ROOT, "public/sitemap.xml");
const SITE = "https://www.titiactriz.com";
const START = "<!-- BLOG-POSTS:START";
const END = "<!-- BLOG-POSTS:END -->";
const TIMEOUT_MS = 8000;

const warn = (msg) => console.warn(`[build-sitemap] WARNING: ${msg} — public/sitemap.xml kept as is.`);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A URL as XML text: `&` is the one character any of these addresses carries. */
const xmlEscape = (s) => s.replace(/&/g, "&amp;");

const urlEntry = ({ loc: raw, day = "", changefreq, priority }) => {
  const loc = xmlEscape(raw);
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    `    <xhtml:link rel="alternate" hreflang="es" href="${loc}" />`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${loc}" />`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />`,
    ...(/^\d{4}-\d{2}-\d{2}$/.test(day) ? [`    <lastmod>${day}</lastmod>`] : []),
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
};

/** BLOG.GW.2 — mirrors GW_KINDS in src/lib/blog.ts. */
const GW_KINDS = ["producto", "capacitacion", "negocio"];

/** Listed first, every build, posts or not: the Green World lane, then each of its kinds. */
const STATIC = [
  { loc: `${SITE}/blog?c=greenworld`, changefreq: "weekly", priority: "0.6" },
  ...GW_KINDS.map((k) => ({ loc: `${SITE}/blog?c=greenworld&k=${k}`, changefreq: "weekly", priority: "0.5" })),
];

const entry = ({ slug, updated_at }) =>
  urlEntry({
    loc: `${SITE}/blog/${slug}`,
    day: typeof updated_at === "string" ? updated_at.slice(0, 10) : "",
    changefreq: "monthly",
    priority: "0.6",
  });

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
  const block = [...STATIC.map(urlEntry), ...posts.map(entry)].join("\n");
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

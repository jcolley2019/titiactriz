/**
 * ADMIN.GUIDE.1 — the guide's section index, shared by GuidePanel and its
 * spec (which reads the same markdown from disk and expects the same ids).
 */

const H2_RE = /^##\s+(.+?)\s*$/gm;

/** "Galería y Medios" → "galeria-y-medios" — the blog's slug rule, inline. */
export const headingId = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** The H2s of a guide, in order, for the table of contents. */
export const guideSections = (md: string): { id: string; title: string }[] => {
  const out: { id: string; title: string }[] = [];
  for (const m of md.matchAll(H2_RE)) out.push({ id: headingId(m[1]), title: m[1] });
  return out;
};

import type { Lang } from "@/hooks/useEventsBoard";
import { plainText } from "@/lib/studio/publish";

/**
 * BLOG.SEO.1 — the structured data a public article carries beside its Article
 * JSON-LD: FAQPage when the body has a questions section, BreadcrumbList always.
 *
 * Pure: no React, no Supabase, so the Playwright runner can unit-test it.
 */

export const SITE = "https://titiactriz.com";

export interface FaqItem {
  question: string;
  answer: string;
}

const headingLevel = (line: string): number => {
  const m = /^(#{1,6})\s+\S/.exec(line);
  return m ? m[1].length : 0;
};
const isFence = (line: string) => /^\s*(```|~~~)/.test(line);
const isThematicBreak = (line: string) => /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
const isQuestion = (text: string) => text.startsWith("¿") || text.endsWith("?");

/** One answer line as plain text: list and quote markers off, images dropped, then plainText. */
const answerLine = (line: string) =>
  plainText(
    line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/^\s*(?:>\s*)+/, "")
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ""),
  );

/** The lines under an H3, up to the next H3/H2: paragraphs as plain text, one per line. Code is not prose. */
function answerText(lines: string[]): string {
  const out: string[] = [];
  let para: string[] = [];
  let inFence = false;
  const flush = () => {
    if (para.length) out.push(para.join(" "));
    para = [];
  };
  for (const line of lines) {
    if (isFence(line)) inFence = !inFence;
    if (inFence || !line.trim() || isFence(line) || isThematicBreak(line)) {
      flush();
      continue;
    }
    const text = answerLine(line);
    if (!text) continue;
    // A list item stands on its own line; prose lines join into their paragraph.
    if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) {
      flush();
      out.push(text);
    } else {
      para.push(text);
    }
  }
  flush();
  return out.join("\n");
}

/**
 * The article's FAQ: the first H2 section whose content is H3 headings each
 * followed by text, at least two of them questions (¿… or …?). Each question
 * H3 becomes an item, its answer the text until the next H3/H2 as plain text.
 * Headings inside code fences are not headings. [] when there is none.
 */
export function extractFaq(markdown: string): FaqItem[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");

  // Every H2 section, as its lines (fenced code never opens or closes one).
  const sections: string[][] = [];
  let current: string[] | null = null;
  let inFence = false;
  for (const line of lines) {
    if (isFence(line)) inFence = !inFence;
    const level = inFence ? 0 : headingLevel(line);
    if (level === 1 || level === 2) {
      current = level === 2 ? [] : null;
      if (current) sections.push(current);
      continue;
    }
    current?.push(line);
  }

  for (const section of sections) {
    // The section's H3s, each with the lines under it (any lead-in before the first is skipped).
    const entries: { heading: string; body: string[] }[] = [];
    inFence = false;
    for (const line of section) {
      if (isFence(line)) inFence = !inFence;
      if (!inFence && headingLevel(line) === 3) {
        entries.push({ heading: plainText(line), body: [] });
        continue;
      }
      entries[entries.length - 1]?.body.push(line);
    }
    if (entries.length < 2) continue;

    const items = entries
      .map((e) => ({ question: e.heading, answer: answerText(e.body) }))
      .filter((i) => i.answer);
    if (items.length !== entries.length) continue; // an H3 with no text under it: not an FAQ
    const questions = items.filter((i) => isQuestion(i.question));
    if (questions.length >= 2) return questions;
  }
  return [];
}

/** schema.org FAQPage: one Question per item, its answer as the acceptedAnswer. */
export const faqPageLd = (items: FaqItem[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
});

/** schema.org BreadcrumbList: Inicio|Home → Blog → the post, as absolute URLs. */
export const breadcrumbLd = (lang: Lang, title: string, path: string) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { name: lang === "en" ? "Home" : "Inicio", item: `${SITE}/` },
    { name: "Blog", item: `${SITE}/blog` },
    { name: title, item: `${SITE}${path}` },
  ].map((crumb, i) => ({ "@type": "ListItem", position: i + 1, ...crumb })),
});

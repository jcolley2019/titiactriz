import { expect, test } from "@playwright/test";
import { peelNarration, stripThinkingText } from "../src/lib/studio/narration";

/**
 * BLOG.2 step 1 — stripThinkingText, ported from joeyc.ai and fixed.
 *
 * SCREENSHOT is the Generated Content box from Joey's Command Center
 * screenshot (www.joeyc.ai-command-center.png, 2026-09-24), transcribed
 * character for character, including the missing spaces where the stream
 * glued one text block onto the next. The Modern/Edit pill covers a few
 * characters of the first model name; they are restored as "Claude Fable 5.1",
 * the name the sentence goes on to pair with "Claude Mythos 5.1".
 */
const SCREENSHOT =
  "I'll research prompt caching with the Claude API to get accurate technical details and current pricing data." +
  "I notice some odd model names appearing (\"Claude Fable 5.1\", \"Claude Mythos 5.1\") which look like search index artifacts or possibly hallucinated/mixed-up names not matching real Anthropic model names. Let me dig deeper into official docs and verify real model names and numbers." +
  "Hitting a rate limit on server tool use. Let me wait and try one at a time." +
  "Let me try using the web_search tool directly instead of through code_execution, since that might be a separate quota.";

const ARTICLE = [
  "# Prompt caching, explained for solo builders",
  "",
  "*Put the static part first and pay less on every repeat call.*",
  "",
  "Caching the system prompt cut our per-call input cost.",
  "",
  "## Why order matters",
  "",
  "Let me show you the one change that did it.",
].join("\n");

const SOCIAL = [
  "**🎬 HOOK (first 3 seconds)**",
  "Esto me ahorró dinero en cada llamada.",
  "",
  "**📝 SCRIPT**",
  "Let me tell you what changed.",
].join("\n");

test.describe("stripThinkingText", () => {
  test("screenshot narration on its own lines, then the article: only the article is left", () => {
    expect(stripThinkingText(`${SCREENSHOT}\n\n${ARTICLE}`)).toBe(ARTICLE);
  });

  test("screenshot narration glued straight onto the heading (the old gap): only the article is left", () => {
    expect(stripThinkingText(SCREENSHOT + ARTICLE)).toBe(ARTICLE);
  });

  test("the old line-start rule broke the glued case: it skipped to the first ## and lost the title and intro", () => {
    const old = (c: string) => {
      const lines = c.split("\n");
      const i = lines.findIndex((l) => /^#{1,3}\s+\S/.test(l));
      return i > 0 ? lines.slice(i).join("\n").trim() : c.trim();
    };
    const before = old(SCREENSHOT + ARTICLE);
    expect(before.startsWith("## Why order matters")).toBe(true);
    expect(before).not.toContain("# Prompt caching");
    expect(stripThinkingText(SCREENSHOT + ARTICLE).startsWith("# Prompt caching")).toBe(true);
  });

  test("narration before the ```meta fence: the fence is kept for parseMetaFence", () => {
    const fence = "```meta\nPrimary Keyword: prompt caching\nMeta Description: x\n```\n\n";
    expect(stripThinkingText(SCREENSHOT + fence + ARTICLE)).toBe((fence + ARTICLE).trim());
  });

  test("narration only (the article has not started streaming yet): nothing is shown", () => {
    expect(stripThinkingText(SCREENSHOT)).toBe("");
    expect(stripThinkingText("I'll research prompt cach")).toBe("");
  });

  test("social package with glued narration in front: the package is left whole", () => {
    expect(stripThinkingText(SCREENSHOT + SOCIAL, "social")).toBe(SOCIAL);
    expect(stripThinkingText(`${SCREENSHOT}\n\n${SOCIAL}`, "social")).toBe(SOCIAL);
  });

  test("Spanish narration is stripped too", () => {
    const es = "Voy a investigar el tema.Déjame buscar datos recientes.Perfecto, ya tengo lo necesario.";
    expect(stripThinkingText(es + ARTICLE)).toBe(ARTICLE);
    expect(stripThinkingText(es + SOCIAL, "social")).toBe(SOCIAL);
  });

  test("clean output is untouched, including 'Let me' inside the body", () => {
    expect(stripThinkingText(ARTICLE)).toBe(ARTICLE);
    expect(stripThinkingText(SOCIAL, "social")).toBe(SOCIAL);
    const prose = "Hoy quiero contarte cómo empezó todo.\n\nLet me be honest.";
    expect(peelNarration(prose)).toBe(prose);
  });

  test("hashtags and decimals do not count as a heading or a sentence end", () => {
    const text = "Let me check #Medellín trends for v5.1 today.**📌 PIN TITLE**\nx";
    expect(stripThinkingText(text, "social")).toBe("**📌 PIN TITLE**\nx");
  });
});

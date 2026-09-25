/**
 * BLOG.2 — keep the model's process narration out of Studio output.
 *
 * Ported from joeyc.ai's stripThinkingText (GeneratedContentTabs.tsx), which
 * dropped every line before the first markdown heading. That rule has two gaps,
 * both visible in the Command Center screenshot that prompted this brick:
 *
 *  1. The narration and the article arrive as separate text blocks around the
 *     model's tool calls, and the stream joins them with NO newline
 *     ("…pricing data.I notice…", "…a separate quota.# Title"). A heading
 *     glued onto a narration sentence is not at a line start, so the old
 *     /^#/ line test never found it and nothing was stripped.
 *  2. Social packages open with a bold label ("**🎬 HOOK**"), never a heading,
 *     so narration in front of them was never stripped at all.
 *
 * The fix: (a) find the article start even when it is glued to a sentence end;
 * (b) for every format, peel leading sentences that narrate the process
 * ("I'll research…", "Let me…", "Hitting a rate limit…", "Voy a…"). Only the
 * LEADING run is touched; a sentence in the body is never removed.
 *
 * Pure: no React, no Supabase, so the Playwright runner can unit-test it.
 */

/** Sentence openers that narrate the model's own process, EN and ES. */
const NARRATION_START = new RegExp(
  "^(?:" +
    [
      // English
      "I['’]ll", "I will", "I['’]m going to", "I am going to", "I need to", "I should",
      "I notice", "I see", "I found", "I now have", "I have (?:enough|everything|what|the|some|good)",
      "I['’]ve (?:got|found|gathered|collected|done)", "I can see",
      "Now I", "Now let me", "Now,? I", "Let me", "Let['’]s (?:search|research|look|check|find|verify|start|try)",
      "Hitting", "Searching", "Researching", "Looking (?:up|for|into)", "Checking", "Trying",
      "Based on (?:my|the|this|these) (?:research|search|searches|results)",
      "(?:The|That|This|My) (?:search|searches|results?) (?:is|are|was|were|returned|show|shows|gave|didn['’]t)",
      "Okay[,.!]", "OK[,.!]", "Alright[,.!]", "Great[,.!]", "Perfect[,.!]", "Good[,.!]", "Hmm",
      "First,? (?:I['’]ll|let me|I will)",
      // Español
      "Voy a", "D[ée]jame", "Perm[ií]teme", "Primero,? (?:voy|d[ée]jame|buscar[ée])",
      "Ahora (?:tengo|voy|d[ée]jame|que tengo)", "Investigar[ée]", "Buscar[ée]", "Revisar[ée]",
      "Estoy (?:buscando|investigando|revisando)", "Tengo (?:suficiente|todo lo)",
      "Bas[aá]ndome en (?:mi|la|las|los|esta|estas) (?:investigaci[oó]n|b[uú]squedas?|resultados)",
      "Perfecto[,.!]", "Listo[,.!]", "Bien[,.!]", "Vale[,.!]",
    ].join("|") +
    ")(?![\p{L}\p{N}])",
  "iu",
);

/**
 * Where a sentence ends: . ! ? … followed by whitespace, the end, or the
 * start of a glued next block (a capital, ¿ ¡, #, *, `, a quote, a bracket).
 * "5.1" and "web_search" do not end a sentence; a newline always does.
 */
const SENTENCE_END = /[.!?…](?=\s|$|[\p{Lu}¿¡#*`"“(\[])|\n/u;

/**
 * The start of an article: a ```meta fence or an H1–H3, at a line start OR
 * glued straight after a sentence end ("…quota.# Title").
 */
const ARTICLE_START = /(?:^|\n|(?<=[.!?…:)"”]))(```meta|#{1,3}[ \t]+\S)/;

/** Drop leading narration sentences; stops at the first sentence that is not one. */
export function peelNarration(content: string): string {
  let rest = content.replace(/^\s+/, "");
  for (let guard = 0; guard < 100 && NARRATION_START.test(rest); guard++) {
    const m = SENTENCE_END.exec(rest);
    const end = m ? m.index + m[0].length : rest.length;
    rest = rest.slice(end).replace(/^\s+/, "");
  }
  return rest;
}

export type NarrationFormat = "blog" | "social";

/**
 * Clean one generated section.
 *  - blog: everything before the article start (meta fence or first heading,
 *    glued or not) goes, as joeyc.ai did; with no article start yet (still
 *    streaming the research), only leading narration goes.
 *  - social: leading narration goes; the package itself is untouched.
 * Narration-only text returns "" so a streaming tab shows its status line,
 * never the model talking to itself.
 */
export function stripThinkingText(content: string, format: NarrationFormat = "blog"): string {
  const text = content.replace(/\r\n?/g, "\n");
  if (format === "blog") {
    const m = ARTICLE_START.exec(text);
    if (m) return text.slice(m.index + (m[0].length - m[1].length)).trim();
  }
  return peelNarration(text).trim();
}

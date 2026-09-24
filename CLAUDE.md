# CLAUDE.md — TitiActriz working laws

Portfolio site for Cristyna "Titi" Polentino (actress/dancer, ES-primary). Claude Code leads
implementation: Joey gives plain intent (often via screenshots or voice). The architect seat
(claude.ai) issues design rulings and specs for big features — housekeeping gets one-sentence
GOAL prompts. Large product features arrive as STEP-format bricks; everything else does not.

## Laws

1. **Verbatim acceptance.** Joey's total instructions, quoted verbatim, are the acceptance
   criteria. Any deviation = stop and ask.
2. **Visual work is never "done" from a report.** Produce rendered side-by-side evidence;
   Joey's on-screen confirmation is the FINAL gate. Two misses in a row = stop and inspect
   the rendered state directly instead of theorizing.
3. **Fresh dev server** before any visual verification.
4. **Audits produce candidates, never rulings.** No fix ships for a "measured" defect until
   it is seen on the physical device (precedent: Book→Green World skirt, cancelled on-device
   7/31 despite the luminance audit flagging it).
5. **Deployed state ≠ repo state.** Check both before diagnosing backend/edge-function issues
   (precedent: generate-alt-text was migrated by a dashboard deploy 7/19; repo copy was stale).
6. **Design laws** (detail in DESIGN.md):
   - **Face law**: NO AI enhancement of Titi's face, ever. Originals arrive via WhatsApp
     Documents (full quality), never chat compression.
   - **Brand marks** are rendered exactly as the brand draws them.
   - **Publisher law**: the book act is a coming-soon teaser only — zero book details, no
     email capture, until written publisher clearance.
   - **No health claims** anywhere near the Green World act.
   - **ES-primary copy**: Spanish first; ES and EN locale files at exact key parity.
7. **Git discipline.** Stage explicit paths (never `-A`); one commit per item with two `-m`
   messages; verify pushes against `git ls-remote`; report hashes. No secrets or tokens are
   ever pasted into any chat.

## Environment

- Dev: `npm run dev` — PC at localhost:8080, phone at 192.168.4.27:8080. The physical test
  device is Joey's iPhone 17 Pro Max; phone-rendered truth outranks any emulator.
- Gates before commit: `npx tsc --noEmit`, `npm run guard`, and
  `npx impeccable detect src --json` — 0 new vs 46 (baseline, .impeccable/config.json).
  When edge functions are in play, also `npm run drift` (compares deployed function shas
  against `supabase/functions/deploy-ledger.json`; needs an authenticated Supabase CLI).
- Supabase: live project ref `nsmstwkjbjicpdclgecq` ("TitiActriz"). Deploys: Vercel →
  titiactriz.com. Everything under `public/` deploys publicly — no stray files.

## Final reply — REPORT format (Joey pastes this into the architect chat)
Every task ends with a REPORT and nothing after it. Under ~60 lines. No file contents or diffs unless the task asked for specific files by name.
1. One line: task/brick ID, what was done, and whether anything is committed or pushed.
2. Departures from the spec, most important first, each with its reason — or "None".
3. Verification table: check → result (lint/typecheck/guard, each test run with pass/fail counts, any live probes).
4. `git status --short`; after a push, `git log -1 --oneline` and HEAD vs `origin/main`.
5. "Worth knowing": at most three short notes (risks, follow-ups, what to check after deploy).
Long explanations, walkthroughs of the code, and full diffs stay in the terminal — they are not part of the reply.

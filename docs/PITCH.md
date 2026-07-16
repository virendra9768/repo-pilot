# RepoPilot — Pitch

## One-liner
**RepoPilot turns any GitHub repository into a guided, AI-powered onboarding experience —
grounded in a real analysis of the code, so it explains instead of hallucinating.**

## The problem
Joining a new codebase is slow and lonely. READMEs are stale, the original authors are
busy or gone, and new engineers spend days just figuring out *where things are* and
*what to read first*. AI chat over a repo helps, but ungrounded models confidently make
things up — which is worse than no answer.

## The approach
RepoPilot runs a **deterministic static analysis** first (routes, models, imports, entry
points, a file intelligence graph) to build a locked "Understanding Map." Every AI
feature is grounded in that map and validated against real file paths — so answers cite
actual files, and the app flags anything it can't verify.

## What you get
1. **Overview** — purpose, a visual architecture diagram, tech stack, key folders, entry points.
2. **Start Here** — an AI-ordered reading path with time + difficulty.
3. **Guided Onboarding** — a day-by-day lesson plan you can step through and check off.
4. **Execution Flow** — ask how something works, get a clickable, node-based flow map.
5. **Talk to the Original Developer** — a lead-engineer persona that answers from the
   code and **says when it doesn't have the evidence**, instead of inventing.
6. **Repository GPS** — describe a change, get a confidence score and the ranked files to touch.

## Why it's different
- **Grounded, not guessy.** Deterministic engine + validated file references + explicit
  "not enough evidence" states.
- **Demo-safe.** Two vendored repos guarantee a flawless offline demo; live clones fall
  back gracefully.
- **Feels premium.** A dark, Linear/Cursor-grade UI with real motion — not an admin dashboard.

## Stack
Next.js 16 · TypeScript · Tailwind v4 · Framer Motion · React Flow · `simple-git` ·
Gemini (structured JSON output) behind a swappable provider abstraction.

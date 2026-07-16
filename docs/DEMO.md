# RepoPilot — Demo Script

A fixed, rehearsed walkthrough that runs entirely on the **two bundled demo repos**.
Never rely on a live GitHub clone during judging — use the demo buttons.

> Setup: `.env.local` has `GEMINI_API_KEY=…`, then `npm run dev` → open http://localhost:3000

---

## 0. The pitch (15s)
"Drop any repo into RepoPilot and it becomes a guided onboarding experience — an AI
overview, a day-by-day learning plan, a live execution-flow map you can question, a
'talk to the engineer who built it' chat, and a GPS that tells you where to make a
change. All grounded in a real static analysis of the code, so it doesn't hallucinate."

## 1. Landing → analyze (20s)
1. Land on the hero. Note the staged loader is real analysis phases.
2. Click **Next.js + Prisma** demo. Watch the staged progress (clone → scan → detect →
   graph → guide), then it routes into the dashboard.

## 2. Overview (30s)
- Point out the **purpose** hero, the live **stats** (files / routes / models / tech),
  the **visual architecture diagram** (Interface → Server → Data), tech stack, and the
  Finder-style **key folders** + entry points.

## 3. Start Here (15s)
- The AI-ordered reading path; each step links to the real file on GitHub, with reading
  time + difficulty.

## 4. Onboarding (30s)
- A **3-day journey** (beginner → advanced). Click through Day 1 → Day 2, hit **Mark
  complete** (persists across reloads), watch the progress bar move.

## 5. Execution Flow — the wow moment (45s)
- Ask: **"how does a quote get created?"**
- A clickable flow renders: AddQuote component → API route → query util → Prisma schema
  → UI refresh. Click a node → detail panel (responsibility, leads-to / called-by,
  related files, **Focus** + **Open file**).

## 6. Ask the Dev — grounded + honest (40s)
- Ask: **"How is the data layer structured?"** → *high confidence*, cites
  `prisma/schema.prisma`, `app/api/route.ts`.
- Ask: **"What is the CI/CD and deployment pipeline?"** → **"Not enough evidence"** — it
  explicitly says the code doesn't show it instead of inventing. (This is the trust story.)

## 7. Repository GPS (30s)
- Type: **"add a rating field to the Quote model"** → ~95% confidence, ranked files with
  `prisma/schema.prisma` at 100%, likelihood bars + reasons.

## 8. Second repo (optional, 20s)
- Top-left **New** → **NestJS API** demo. Same six tabs work.
  - Flow: **"what happens when the app starts up?"**
  - Ask: **"What does this project do?"**
  - GPS: **"add a new GET endpoint"**

---

## Fallback story (if asked)
- Pasting a real GitHub URL clones it live (`simple-git`, shallow) and analyzes it the
  same way. If a clone fails, RepoPilot **falls back to a demo repo** with a clear notice
  — the dashboard never dead-ends.
- Everything the AI says is grounded in the deterministic Understanding Map; node/file
  references are validated against real paths (unverified ones are flagged).

## Known-good prompts (copy/paste)
| Tab | next-prisma-starter | nest-starter |
|---|---|---|
| Flow | how does a quote get created? | what happens when the app starts up? |
| Ask (grounded) | How is the data layer structured? | What does this project do? |
| Ask (refusal) | What is the CI/CD and deployment pipeline? | Where are the tests run in CI? |
| GPS | add a rating field to the Quote model | add a new GET endpoint |

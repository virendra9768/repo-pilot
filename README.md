# RepoPilot

**Turn any GitHub repository into a guided, AI-powered onboarding experience —
grounded in a real analysis of the code, so it explains instead of hallucinating.**

Paste a repo (or pick a bundled demo) and RepoPilot clones it, runs a deterministic
static analysis, and generates an onboarding dashboard: an overview, a learning path, a
day-by-day journey, an interactive execution-flow map, a "talk to the engineer who built
it" chat, and a change-impact GPS.

---

## How it works

```
GitHub URL / demo
      │
      ▼
 Repository Import  ──►  Deterministic Engine  ──►  Understanding Map (locked schema)
 (simple-git clone,      (routes · models ·         entryPoints · criticalFiles ·
  ignore list, temp,      imports · graph —          technologies · routes · models ·
  demo fallback)          regex/heuristic, no AST)   learningOrder · graph{nodes,edges}
                                                              │
                                                              ▼
                                        AI Layer (OpenRouter, structured JSON output)
                                        grounded in the map + a context pack,
                                        every file reference validated
                                                              │
                                                              ▼
                                               Premium dark dashboard (6 features)
```

The AI never sees raw guesses — it consumes the map plus a small **context pack**
(README excerpt, critical-file snippets, line counts) captured at analysis time, and
every file path it returns is validated against the real inventory.

## Features
1. **Overview** — purpose, visual architecture diagram, tech stack, key folders, entry points.
2. **Start Here** — an AI-ordered reading path with reading time + difficulty.
3. **Guided Onboarding** — a day-by-day lesson plan you step through and check off.
4. **Execution Flow** — ask how something works → a clickable, node-based flow map.
5. **Talk to the Original Developer** — a lead-engineer persona that answers from the code
   and explicitly says when it lacks evidence, instead of inventing.
6. **Repository GPS** — describe a change → confidence score + ranked files to touch.

## Stack
Next.js 16 · TypeScript · Tailwind v4 · Framer Motion · React Flow (`@xyflow/react`) ·
`simple-git` · OpenRouter (OpenAI-compatible, structured JSON output) behind a swappable
provider abstraction · `zod` for response validation.

## Getting started
```bash
npm install

# .env.local
OPENROUTER_API_KEY=your_key_here     # free tier — get one at openrouter.ai
# optional overrides:
#   OPENROUTER_MODEL=openrouter/free  # default: free auto-router (JSON-capable)
#   AI_PROVIDER=openrouter|mock       # force a provider
#   AI_DISK_CACHE=0                   # disable disk cache (e.g. on serverless)

npm run dev   # http://localhost:3000
```
The AI layer is behind a **swappable provider abstraction** (`lib/ai/`). Selection is
auto: OpenRouter key → Mock (placeholder answers so the UI still renders keyless).

### Offline / rate-limit-proof demos
AI responses are cached to disk (`.cache/ai/`, content-addressed and re-validated against
the schema). Pre-generate every demo answer once, then the demo replays with **zero live
API calls**:
```bash
npm run dev          # terminal 1 (with a working key)
npm run warm-demo    # terminal 2 — caches both demo repos' answers
```

## Demo repos
Two real OSS repos are vendored under `demo-repos/` (source-only, pinned — see
`demo-repos/SOURCES.md`) as guaranteed-working, offline fallbacks:
- `next-prisma-starter` — Next.js App Router + Prisma + Tailwind
- `nest-starter` — NestJS

Pasting a real GitHub URL clones and analyzes it live; if the clone fails, RepoPilot falls
back to a demo repo with a clear notice. See **`docs/DEMO.md`** for the rehearsed demo
script and **`docs/PITCH.md`** for the pitch.

## Deploy
Deploy to a **long-running host** — a `git` binary + writable disk are required for cloning
arbitrary repos, so **serverless (Vercel) won't work** for the live-clone feature.
Recommended: an **Oracle Cloud "Always Free" VM** (free forever, never sleeps) running the
included **`Dockerfile`**. PaaS alternatives (Render Blueprint / Railway / Fly.io) also work.
Warmed demo answers ship in `cache-seed/ai/`, so the deployed demo is instant on the first
request. Full steps + env vars + the Oracle firewall gotcha: **`docs/DEPLOY.md`**.

## Project structure
```
app/                      routes + API (/api/repos, /api/ai/*)
engine/                   clone · analyzer · graph · context · prompts (the deterministic + AI glue)
features/                 repository-import · repository-overview · onboarding · execution-flow · original-developer · repository-gps
components/{ui,layout,shared}
lib/{ai,git,persistence,security,utils}
types/                    locked Understanding Map + internal analysis types
demo-repos/               vendored fallback repositories
```

## Scope notes (deliberate, for a 3-day build)
- Route/dependency/model detection is **regex/path-heuristic**, not AST-based.
- The intelligence graph is plain `Node[]/Edge[]` in memory — not a graph database.
- No auth / private repos / semantic search. Business Flow Explorer is out of scope.
- Local/demo-first: cloning needs a local `git` binary; a stateless serverless host would
  require the demo path (bundled repos, no git).

## Debug
`/debug` renders the raw Understanding Map JSON for any demo/URL (engine sanity check).

# RepoPilot — Project Context

## What this is
AI-powered repository-onboarding platform, built for a 3-day hackathon. Flow: user pastes/selects a GitHub repo → deterministic analysis engine runs → AI layer generates explanations, an interactive execution-flow diagram, and a guided onboarding journey.

## Stack
- Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, React Flow
- GitHub tarball fetch over HTTP for acquiring repos (`lib/git/download.ts`) — no `git` binary, so it runs on serverless
- OpenRouter (structured/JSON output, zod-validated) for the AI layer, behind a provider abstraction so it can be swapped later. Falls back to a mock provider when no key is set; a committed `cache-seed/ai/` tier replays the demo answers with no key and no network

## Folder structure
```
app/
components/{ui,layout,shared}/
features/{repository-import,repository-overview,execution-flow,onboarding,repository-gps,original-developer}/
engine/{clone,analyzer,graph,context,prompts}/
lib/{ai,git,persistence,security,utils}/
types/
hooks/
public/
```

## Non-negotiable scope decisions — do not silently deviate
- Route/dependency/DB-model detection is **AST-based**, via `ts-morph` for TS/JS and `@mrleebo/prisma-ast` for `.prisma`. **Parse only** — never construct a Program or type checker (ts-morph builds them lazily, so this is a discipline, not a flag; see the banned-API list in `engine/analyzer/parse.ts`). Every code file is parsed once into a shared cache in `engine/analyze.ts` and the tree is handed to all three analyzers.
- Detection that is **not** parsing stays as-is, deliberately: Next.js route URLs come from file paths (`deriveNextRoute`), module resolution from path logic (`resolveSpecifier`), technologies from the package.json dependency table, and metadata from JSON config. An AST has no input to those — don't "upgrade" them.
- The parse budget in `lib/security/ignore.ts` (`MAX_PARSE_*`) is load-bearing for memory, not a nicety — the shared cache holds every tree at once. Don't remove it.
- **Business Flow Explorer is out of scope.** Skip it even if referenced elsewhere.
- No auth, GitHub OAuth, private-repo support, semantic search/vector DB, multi-repo workspace, or VS Code extension.
- The intelligence graph is plain `Node[]/Edge[]` in memory — not a graph database.
- Talk to the Original Developer and Repository GPS **shipped** — both are fully built and wired into the dashboard nav. (They were originally scoped as conditional stretch goals; that no longer applies.)

## Locked Understanding Map schema
Every feature consumes this. Do not change its shape without flagging it first.
```json
{
  "entryPoints": [],
  "criticalFiles": [],
  "technologies": [],
  "businessDomains": [],
  "importantRoutes": [],
  "databaseModels": [],
  "learningOrder": [],
  "graph": { "nodes": [], "edges": [] }
}
```

## Demo repos
Two repos are bundled/vendored as guaranteed-working fallbacks if a pasted GitHub URL fails to clone (e.g. one Next.js app, one NestJS or Express app). Import/fallback logic must be built around these from the start, not bolted on later.

## Working style for this project
- Work in scoped daily increments — see `day1-prompt.md`, `day2-prompt.md`, `day3-prompt.md`.
- Stop at each day's checkpoint and wait for review before moving to the next day's scope, even if you think you have time left.
- If something in this file conflicts with a request, flag it rather than quietly expanding scope.
# RepoPilot — Project Context

## What this is
AI-powered repository-onboarding platform, built for a 3-day hackathon. Flow: user pastes/selects a GitHub repo → deterministic analysis engine runs → AI layer generates explanations, an interactive execution-flow diagram, and a guided onboarding journey.

## Stack
- Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, React Flow
- `simple-git` for cloning
- Gemini API (structured/JSON output mode) for the AI layer, behind a provider abstraction so it can be swapped later

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
- Route/dependency/DB-model detection is **regex/path-heuristic based**, not AST-based. No ts-morph/babel traversal. This is a deliberate time-budget call for a 3-day build — don't "upgrade" it without being asked.
- **Business Flow Explorer is out of scope.** Skip it even if referenced elsewhere.
- No auth, GitHub OAuth, private-repo support, semantic search/vector DB, multi-repo workspace, or VS Code extension.
- The intelligence graph is plain `Node[]/Edge[]` in memory — not a graph database.
- Talk to the Original Developer and Repository GPS are conditional — only build if the day's core checkpoint is already met (see day prompts).

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
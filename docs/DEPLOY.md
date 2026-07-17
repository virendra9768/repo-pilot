# Deploying RepoPilot

RepoPilot fetches repos over plain HTTP (GitHub tarball download — no `git` binary), so it
runs anywhere, **including serverless**. Warmed demo answers ship in `cache-seed/ai/`
(committed), so the deployed demo is instant on the very first request.

---

## Recommended: Vercel (one-click, free, instant)
Simplest deploy, fast cold starts, automatic HTTPS.

1. Push this repo to **GitHub**.
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo. Vercel
   auto-detects Next.js (build `next build`, no config needed).
3. **Environment Variables** → add:
   - `OPENROUTER_API_KEY` = your key (required)
   - optional: `OPENROUTER_MODEL`, `GITHUB_TOKEN` (raises GitHub's tarball rate limit for
     live analysis of pasted repos — 60/hr → 5000/hr).
4. **Deploy.** You get a public `*.vercel.app` URL with HTTPS.

Already handled for serverless:
- `next.config.ts` traces `demo-repos/` + `cache-seed/` into the functions.
- API routes set `maxDuration = 60`.
- Repo fetching uses the GitHub tarball API (extracts to `/tmp`), so no `git` binary is needed.

**Serverless notes / limits (all handled or minor):**
- **60s per request:** the demo is served from the seed cache (instant). A *live* analysis
  of a very large pasted repo could approach the limit; it fails gracefully to a demo.
- **No persistent writable cache:** `/tmp` is ephemeral, so live answers regenerate each
  time — but the committed seed keeps the scripted demo instant. (Optionally set
  `AI_CACHE_DIR=/tmp/repopilot` so a warm instance caches live answers too.)
- Public repos only (no auth); private repos are out of scope.

---

## Alternatives (long-running hosts)
Also work (git no longer required). Push to GitHub, connect, set `OPENROUTER_API_KEY`;
build `npm install --include=dev && npm run build`, start `npm start`.
- **Render** — free, `render.yaml` Blueprint included, but sleeps after ~15min idle
  (30–60s cold start).
- **Railway** — no cold starts; trial credit then paid.
- **Docker anywhere** (a `Dockerfile` is included) — VM / Fly.io / etc. `--restart unless-stopped` for always-on.

---

## Environment variables
| Var | Required | Default | Notes |
|---|---|---|---|
| `OPENROUTER_API_KEY` | yes | — | your OpenRouter key |
| `OPENROUTER_MODEL` | no | `nvidia/nemotron-3-super-120b-a12b:free` | falls back to `openrouter/free` |
| `GITHUB_TOKEN` | no | — | raises GitHub tarball rate limit for live repo analysis |
| `AI_PROVIDER` | no | auto | `openrouter` \| `mock` |
| `AI_DISK_CACHE` | no | on | `0` disables the writable disk layer (seed still served) |
| `AI_CACHE_DIR` | no | `.cache/ai` | writable cache path (e.g. `/tmp/repopilot` on serverless) |
| `UPSTASH_REDIS_REST_URL` | no | — | durable cache + cross-device recents (see below) |
| `UPSTASH_REDIS_REST_TOKEN` | no | — | pairs with the URL above |
| `GITHUB_OAUTH_CLIENT_ID` | no | — | GitHub login → private repos (see below) |
| `GITHUB_OAUTH_CLIENT_SECRET` | no | — | pairs with the client id |
| `SESSION_SECRET` | no | — | long random string; encrypts the session cookie |

### Optional: durable cache (Upstash Redis)
Without it, caching is in-memory + disk (ephemeral on serverless). Add a free **Upstash
Redis** DB (on Vercel: *Storage → Upstash* auto-sets the two env vars) so analysis + all
AI answers persist across sessions/instances — a re-analyzed repo never re-calls the LLM.

### Optional: GitHub login for private repos
1. GitHub → *Settings → Developer settings → OAuth Apps → New*. Authorization callback URL:
   `https://<your-origin>/api/auth/github/callback`.
2. Set `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, and a random `SESSION_SECRET`.
The GitHub token is **never stored** (only an encrypted httpOnly cookie). Private-repo
analyses are cached **per account** (namespaced by GitHub user id) and never shared.

## After deploying — verify
1. Open the URL → click a demo (**Next.js + Prisma** / **NestJS**) → dashboard loads.
2. Walk the six tabs; run the `docs/DEMO.md` prompts (instant, from the seed cache).
3. Paste a small public repo URL → confirm it downloads + analyzes live.

## Notes
- `demo-repos/` and `cache-seed/ai/` are committed and ship with the deploy.
- `.cache/ai/` (writable) stays gitignored; `.env.local` is gitignored — set keys in the
  host's dashboard so they never leak.

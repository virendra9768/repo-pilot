# Deploying RepoPilot

RepoPilot must run on a **long-running host** (a VM or a container platform), **not**
serverless (Vercel/Netlify). It clones arbitrary repos with `simple-git`, which needs a
**`git` binary** + **writable disk** — absent on serverless (there, live clones fail and
everything falls back to a demo).

Warmed demo answers ship in `cache-seed/ai/` (committed), so the deployed demo is instant
on the very first request, even on a fresh boot.

---

## Recommended: Oracle Cloud "Always Free" VM (free + always-on)
The only host that's both **genuinely free forever** and **never sleeps** (no cold starts).
You run a Docker container; it auto-restarts on crash/reboot. ~15–20 min of one-time setup.

### 1. Create the instance
Oracle Cloud Console → **Compute → Instances → Create instance**:
- **Shape:** `VM.Standard.A1.Flex` (Ampere/ARM — part of Always Free). Give it **2 OCPU / 12 GB** (Always Free allows up to 4 OCPU / 24 GB total) so the build has headroom.
- **Image:** Ubuntu 22.04.
- **SSH keys:** upload/download a key pair (you'll SSH with it).
- Ensure it gets a **public IPv4**. Create.

### 2. Open the port — BOTH firewalls (this is the #1 gotcha)
Oracle blocks ports in two places; you must open both.
- **Cloud firewall (VCN):** Networking → your VCN → Security List → **Add Ingress Rule**:
  Source `0.0.0.0/0`, IP Protocol TCP, Destination port **3000** (and 80, 443 if you add HTTPS below).
- **OS firewall (on the VM):** Ubuntu on Oracle ships iptables rules that drop everything
  except SSH. SSH in and run:
  ```bash
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
  sudo netfilter-persistent save
  ```
  (Skipping this is why "the security list is open but it still won't connect.")

### 3. Install Docker + git
```bash
ssh -i <your-key> ubuntu@<public-ip>
curl -fsSL https://get.docker.com | sudo sh
sudo apt-get update && sudo apt-get install -y git
sudo usermod -aG docker $USER && newgrp docker   # run docker without sudo
```

### 4. Build & run (always-on)
```bash
git clone <your-repo-url> repo-pilot && cd repo-pilot
docker build -t repopilot .
docker run -d --name repopilot --restart unless-stopped \
  -p 3000:3000 \
  -e OPENROUTER_API_KEY=your_key_here \
  repopilot
```
`--restart unless-stopped` keeps it running across crashes and reboots (Docker starts on
boot). Open **`http://<public-ip>:3000`**.

Update later: `git pull && docker build -t repopilot . && docker rm -f repopilot && docker run -d …` (same run command).

### 5. (Optional but recommended) Free HTTPS + a clean URL
Plain `http://<ip>:3000` shows "Not secure". Add Caddy for automatic HTTPS using
[sslip.io](https://sslip.io) (a hostname that maps to your IP — no domain purchase):
```bash
# open 80 + 443 in BOTH firewalls first (step 2, ports 80 and 443)
docker run -d --name caddy --restart unless-stopped --network host \
  -v caddy_data:/data \
  caddy caddy reverse-proxy --from <public-ip>.sslip.io --to localhost:3000
```
Then share **`https://<public-ip>.sslip.io`**. Caddy fetches a Let's Encrypt cert automatically.

---

## Alternatives (PaaS — simpler, but sleep or cost)
Push the repo to GitHub, connect it, set `OPENROUTER_API_KEY`. All build with
`npm install --include=dev && npm run build` and start with `npm start`.

- **Render** — genuinely free, but **sleeps after ~15 min idle → 30–60s cold start**. A
  `render.yaml` Blueprint is included (Dashboard → New → Blueprint). Mitigate cold starts
  with an uptime pinger.
- **Railway** — **no cold starts**, auto-detects Next.js, but only a trial credit then paid.
- **Fly.io** — no cold start with `min_machines_running = 1`; **not free** (~$2–5/mo, card
  required). Uses the included `Dockerfile`. Set `AI_CACHE_DIR=/data/ai` + a volume to
  persist the writable cache.

---

## Environment variables
| Var | Required | Default | Notes |
|---|---|---|---|
| `OPENROUTER_API_KEY` | yes | — | your OpenRouter key |
| `OPENROUTER_MODEL` | no | `nvidia/nemotron-3-super-120b-a12b:free` | falls back to `openrouter/free` |
| `AI_PROVIDER` | no | auto | `openrouter` \| `mock` |
| `AI_DISK_CACHE` | no | on | `0` disables the writable disk layer (seed still served) |
| `AI_CACHE_DIR` | no | `.cache/ai` | writable cache path (e.g. a mounted volume) |
| `PORT` | no | 3000 | server port |

## After deploying — verify
1. Open the URL → click a demo (**Next.js + Prisma** / **NestJS**) → dashboard loads.
2. Walk the six tabs; run the `docs/DEMO.md` prompts (instant, from the seed cache).
3. Paste a small public repo URL → confirm it clones + analyzes live.

## Notes
- `demo-repos/` and `cache-seed/ai/` are committed and ship with the deploy/image.
- `.cache/ai/` (writable, per-instance) stays gitignored.
- Your `.env.local` is gitignored and excluded from the image — set the key via
  `docker run -e` / the host's dashboard instead, so it never leaks.

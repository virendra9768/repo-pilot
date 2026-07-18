/**
 * Pre-generate (and disk-cache) every AI answer used by the demo script, for
 * both bundled demo repos. Run this once while your AI provider is working; the
 * answers are persisted under `.cache/ai/` and then replay offline with zero
 * live API calls during judging.
 *
 *   1. npm run dev            (in one terminal, with a working OPENROUTER_API_KEY)
 *   2. node scripts/warm-demo-cache.mjs
 *
 * `.cache/ai/` is gitignored, so it only helps the machine that ran this. To make
 * the answers ship with the repo, copy them into `cache-seed/ai/` and commit —
 * that tier is read-only, provider-agnostic, and is what lets a fresh clone demo
 * with no key at all.
 *
 * The cache key is a hash of the system prompt + user prompt, and the prompt
 * embeds the Understanding Map. Any change to deterministic engine output
 * invalidates every seeded answer, so re-run and re-commit after engine changes.
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";

const DEMOS = ["next-prisma-starter", "nest-starter"];

const FLOW_Q = {
  "next-prisma-starter": "how does a quote get created?",
  "nest-starter": "what happens when the app starts up?",
};
const ASK_Q = {
  "next-prisma-starter": [
    "How is the data layer structured?",
    "What is the CI/CD and deployment pipeline?",
  ],
  "nest-starter": ["What does this project do?", "Where are the tests run in CI?"],
};
const GPS_T = {
  "next-prisma-starter": "add a rating field to the Quote model",
  "nest-starter": "add a new GET endpoint",
};

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return res.ok;
}
async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function warm(id) {
  const tasks = [
    ["overview", () => get(`/api/ai/overview?id=${id}`)],
    ["start-here", () => get(`/api/ai/start-here?id=${id}`)],
    ["onboarding", () => get(`/api/ai/onboarding?id=${id}`)],
    ["flow", () => post(`/api/ai/execution-flow`, { id, question: FLOW_Q[id] })],
    ["gps", () => post(`/api/ai/gps`, { id, task: GPS_T[id] })],
    ...ASK_Q[id].map((q, i) => [
      `ask#${i + 1}`,
      () => post(`/api/ai/ask-developer`, { id, question: q, history: [] }),
    ]),
  ];
  for (const [label, run] of tasks) {
    process.stdout.write(`  ${id} · ${label} … `);
    try {
      const ok = await run();
      console.log(ok ? "ok" : "FAILED");
    } catch (e) {
      console.log("ERROR", e.message);
    }
  }
}

console.log(`Warming demo cache against ${BASE}\n`);
for (const id of DEMOS) {
  console.log(id);
  await warm(id);
  console.log("");
}
console.log("Done. Answers cached under .cache/ai/ — the demo now replays offline.");

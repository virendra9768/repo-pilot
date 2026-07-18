/**
 * Budgets for the durable cache layer (Upstash Redis, free tier: 250 MB storage
 * and 250k commands/month).
 *
 * Repo-*shape* budgets — how much source we walk and parse — live in `ignore.ts`.
 * This file is about what leaves the process: how large a cached blob may get and
 * how many Redis commands we are willing to spend.
 */

/**
 * Primary languages we will analyze, as GitHub reports them.
 *
 * The analyzer is JS/TS-only (ts-morph + prisma-ast), so a Python or Go repo
 * produces a near-empty Understanding Map that reads as broken rather than as
 * out of scope. GitHub's `language` field comes free with the metadata call we
 * already make, so this costs no extra request.
 *
 * Measured rather than assumed — the popular frameworks all report as JS/TS, so
 * no per-framework special-casing is needed:
 *   vuejs/core -> TypeScript      sveltejs/svelte -> JavaScript
 *   withastro/astro -> TypeScript tailwindlabs/tailwindcss -> TypeScript
 * Vue/Svelte/Astro/MDX are listed anyway in case a repo's mix tips that way.
 * HTML and CSS are deliberately included: a static site with real JS in it often
 * reports one of them.
 *
 * Lives here rather than beside the download code so client components (the repo
 * picker) can warn before submit without pulling node:stream into the bundle.
 */
export const ANALYZABLE_LANGUAGES = new Set<string>([
  "JavaScript",
  "TypeScript",
  "Vue",
  "Svelte",
  "Astro",
  "MDX",
  "HTML",
  "CSS",
]);

/**
 * A null/empty language means GitHub couldn't detect one — a brand-new or empty
 * repo. Allow those through: the gate is best-effort and must never be the
 * reason a legitimate repo is refused, matching how unknown metadata is treated
 * everywhere else in the acquire path.
 */
export function isAnalyzableLanguage(language: string | null | undefined): boolean {
  return !language || ANALYZABLE_LANGUAGES.has(language);
}

/**
 * Caps on the persisted intelligence graph.
 *
 * The graph is written at full size but read narrowly: `engine/context/slices.ts`
 * takes at most 200 files and 200 edges for the AI layer, and the React Flow
 * diagram is generated from that slice rather than from the stored graph. Only
 * `knownFilePaths` (slices.ts) wants breadth, and it reads file *nodes* — which
 * is why nodes get a looser cap than edges.
 *
 * Edges are the unbounded term: one per import link, so 3-10x the file count on
 * a large repo. Capping them is the single biggest lever on worst-case blob size
 * and costs nothing any consumer can observe.
 *
 * Sized against real measurements rather than estimates (t3-oss/create-t3-app,
 * 540 files): a graph node serializes to ~168 B and an edge to ~164 B, because
 * both carry full repo-relative paths — a file node stores the path twice, as
 * `id` and as `path`. A fileLines entry is ~47 B. See MAX_KV_BLOB_BYTES for how
 * these multiply out.
 *
 * Files reach the graph in sorted path order, so which ones survive truncation is
 * deterministic — the same property the parse cache relies on.
 */
export const MAX_GRAPH_NODES = 1500;
export const MAX_GRAPH_EDGES = 600;

/**
 * Cap on `contextPack.fileLines`, which otherwise holds one entry per text file
 * up to MAX_WALK_FILES. Entries for `criticalFiles` are kept first, so the paths
 * most likely to be referenced survive truncation.
 */
export const MAX_FILE_LINES_ENTRIES = 1500;

/**
 * Hard ceiling on a single cached analysis blob. Upstash's free tier rejects
 * values over 1 MB, and `kvSet` swallows write failures — so without this check
 * an oversized repo would fail to cache silently and re-analyze on *every*
 * request, costing far more than it saves. We measure and skip the write
 * instead, keeping the memory + disk layers.
 *
 * This must sit ABOVE what the caps above can produce, or a repo that maxes them
 * out would be permanently uncacheable — the very failure this guard exists to
 * prevent. `limits.test.ts` pins that relationship: a synthetic repo that maxes
 * every cap, using long monorepo-shaped paths, serializes to ~512 KB, so 600 KB
 * leaves ~15% headroom while staying well under Upstash's 1 MB limit. Raising
 * any cap above without re-running that test will break the invariant.
 *
 * Paths deeper still can exceed it; that is what the runtime guard is for, and
 * it degrades to memory + disk rather than failing.
 *
 * Storage arithmetic: at this ceiling and the 7-day public TTL, 250 MB holds
 * ~425 worst-case repos. Real blobs run 4-80 KB (create-t3-app, 540 files, is
 * 83 KB), so the practical ceiling is in the thousands. Storage is not the
 * binding constraint — commands are.
 */
export const MAX_KV_BLOB_BYTES = 600 * 1024;

/**
 * Monthly command budget and the point at which we stop spending it.
 *
 * A signed-in user opening one repo and clicking through the tabs costs roughly
 * 10-12 commands, so 250k is on the order of 20-25k page interactions. We trip
 * at 200k to leave headroom: past the soft limit the KV layer turns itself off
 * and the app runs on memory + disk, which is the same path local dev takes when
 * the Upstash env vars are unset.
 */
export const KV_MONTHLY_COMMAND_BUDGET = 250_000;
export const KV_SOFT_LIMIT = 200_000;

/**
 * Commands are counted locally and flushed with one INCRBY per batch — counting
 * each command individually would spend ~10% of the budget measuring it. At 25
 * the overhead is ~4%, and the worst case for a cold serverless instance is
 * losing 24 uncounted commands, which the headroom above absorbs.
 */
export const KV_COUNTER_FLUSH_EVERY = 25;

/** TTL on the monthly counter key — long enough to outlive the month it counts. */
export const KV_USAGE_KEY_TTL_SECONDS = 60 * 60 * 24 * 35;

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  analyzeRepository,
  type AnalyzeInput,
  type AnalysisResult,
} from "@/engine/analyze";
import { resolveDemoKey } from "@/engine/clone";
import { validateGitHubUrl } from "@/lib/git/validate";

export interface AnalyzedRepo {
  id: string;
  input: AnalyzeInput;
  workspace: AnalysisResult["workspace"];
  understandingMap: AnalysisResult["understandingMap"];
  contextPack: AnalysisResult["contextPack"];
}

/** Process-lifetime cache; disk mirror survives dev HMR restarts. */
const store = new Map<string, AnalyzedRepo>();
const CACHE_DIR = join(process.cwd(), ".cache", "repopilot");

/** Stable, filename-safe id for an import request. */
export function computeId(input: AnalyzeInput): string {
  if (input.kind === "demo") return resolveDemoKey(input.demo) ?? "demo";
  const v = validateGitHubUrl(input.url);
  if (v.ok && v.repo) return `gh__${v.repo.owner}__${v.repo.repo}`.toLowerCase();
  return "invalid-url";
}

/** Return the cached analysis for an id, or undefined. */
export async function getRepo(id: string): Promise<AnalyzedRepo | undefined> {
  const inMem = store.get(id);
  if (inMem) return inMem;
  const onDisk = await readDisk(id);
  if (onDisk) store.set(id, onDisk);
  return onDisk;
}

/** Return cached analysis for an input, or run the engine and cache it. */
export async function getOrAnalyze(input: AnalyzeInput): Promise<AnalyzedRepo> {
  const id = computeId(input);
  const cached = await getRepo(id);
  if (cached) return cached;

  const result = await analyzeRepository(input);
  const repo: AnalyzedRepo = { id, input, ...result };
  store.set(id, repo);
  await writeDisk(repo);
  return repo;
}

async function readDisk(id: string): Promise<AnalyzedRepo | undefined> {
  try {
    const raw = await readFile(join(CACHE_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as AnalyzedRepo;
  } catch {
    return undefined;
  }
}

async function writeDisk(repo: AnalyzedRepo): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, `${repo.id}.json`), JSON.stringify(repo), "utf8");
  } catch {
    /* best-effort cache; ignore write failures */
  }
}

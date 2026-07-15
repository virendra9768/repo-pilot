import { simpleGit } from "simple-git";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Shallow-clone a public repo into a fresh temp directory.
 * `timeout.block` aborts the clone if git stalls (no output) for `timeoutMs`.
 * Throws on failure (caller decides whether to fall back to a demo repo).
 */
export async function shallowClone(
  cloneUrl: string,
  opts: { timeoutMs?: number } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const dir = await mkdtemp(join(tmpdir(), "repopilot-"));
  const git = simpleGit({ timeout: { block: timeoutMs } });
  try {
    await git.clone(cloneUrl, dir, ["--depth", "1", "--single-branch"]);
    return dir;
  } catch (err) {
    await removeDir(dir);
    throw err;
  }
}

/** Best-effort recursive delete; never throws. */
export async function removeDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore cleanup errors */
  }
}

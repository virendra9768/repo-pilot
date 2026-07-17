import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { walkRepo } from "./walk";

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "walk-test-"));
  await writeFile(join(root, "a.ts"), "1");
  await writeFile(join(root, "b.ts"), "2");
  await mkdir(join(root, "src"));
  for (const f of ["c.ts", "d.ts", "e.ts", "f.ts"]) {
    await writeFile(join(root, "src", f), "x");
  }
  // An ignored dir whose contents must never be collected.
  await mkdir(join(root, "node_modules"));
  await writeFile(join(root, "node_modules", "ignored.ts"), "x");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("walkRepo", () => {
  it("collects all files and skips ignored dirs when under the cap", async () => {
    const { files, truncated } = await walkRepo(root);
    const rels = files.map((f) => f.relPath);
    expect(truncated).toBe(false);
    expect(files).toHaveLength(6);
    expect(rels).toContain("a.ts");
    expect(rels).toContain("src/c.ts");
    expect(rels.some((r) => r.includes("node_modules"))).toBe(false);
  });

  it("stops at maxFiles and flags the result as truncated", async () => {
    const { files, truncated } = await walkRepo(root, { maxFiles: 3 });
    expect(files).toHaveLength(3);
    expect(truncated).toBe(true);
  });
});

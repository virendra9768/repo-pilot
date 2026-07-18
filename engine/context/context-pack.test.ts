import { describe, it, expect } from "vitest";
import { buildContextPack } from "./context-pack";
import { fakeFile } from "../analyzer/__fixtures__/helpers";
import { MAX_FILE_LINES_ENTRIES } from "@/lib/security/limits";
import type { RepoMetadata } from "@/types/analysis";
import type { UnderstandingMap } from "@/types/understanding-map";

const metadata = { allDependencies: {} } as RepoMetadata;

function mapWith(criticalPaths: string[]): UnderstandingMap {
  return {
    criticalFiles: criticalPaths.map((path) => ({ path })),
  } as UnderstandingMap;
}

function tsFiles(n: number) {
  return Array.from({ length: n }, (_, i) =>
    fakeFile(`src/f${String(i).padStart(5, "0")}.ts`, "a\nb\nc"),
  );
}

describe("buildContextPack fileLines cap", () => {
  it("caps entries and reports capped on an oversized repo", () => {
    const { pack, capped } = buildContextPack(
      tsFiles(MAX_FILE_LINES_ENTRIES + 300),
      metadata,
      mapWith([]),
    );

    expect(capped).toBe(true);
    expect(Object.keys(pack.fileLines)).toHaveLength(MAX_FILE_LINES_ENTRIES);
  });

  it("keeps critical files even when they sort past the cap", () => {
    const files = tsFiles(MAX_FILE_LINES_ENTRIES + 300);
    // A path that would otherwise be dropped: it sorts well beyond the cap.
    const late = files[files.length - 1].relPath;

    const { pack, capped } = buildContextPack(files, metadata, mapWith([late]));

    expect(capped).toBe(true);
    expect(pack.fileLines[late]).toBe(3);
  });

  it("leaves a normal repo untouched and reports capped=false", () => {
    const { pack, capped } = buildContextPack(tsFiles(20), metadata, mapWith([]));

    expect(capped).toBe(false);
    expect(Object.keys(pack.fileLines)).toHaveLength(20);
  });
});

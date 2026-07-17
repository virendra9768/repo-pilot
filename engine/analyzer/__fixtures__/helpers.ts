import type { RepoFile } from "@/types/analysis";

/**
 * Analyzer fixtures are inline source strings, not files on disk.
 *
 * tsconfig includes `**\/*.ts` (excluding only demo-repos) and eslint ignores
 * only demo-repos/**, so on-disk fixtures would be typechecked and linted — and
 * they can't compile, since express/mongoose/typeorm aren't dependencies and
 * never will be. Putting them under demo-repos/ is worse: next.config.ts
 * outputFileTracingIncludes ships ./demo-repos/** into every /api/** bundle.
 *
 * Strings sidestep all of it. This file is *.ts, not *.test.ts, so vitest's
 * include glob never collects it.
 */
export function fakeFile(
  relPath: string,
  content: string,
  over: Partial<RepoFile> = {},
): RepoFile {
  const name = relPath.split("/").pop() ?? relPath;
  const dot = name.lastIndexOf(".");
  return {
    absPath: `/repo/${relPath}`,
    relPath,
    name,
    ext: dot > 0 ? name.slice(dot).toLowerCase() : "",
    size: Buffer.byteLength(content, "utf8"),
    isText: true,
    read: () => content,
    ...over,
  };
}

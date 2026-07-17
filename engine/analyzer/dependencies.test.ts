import { describe, expect, test } from "vitest";
import {
  analyzeDependencies,
  extractSpecifiers,
} from "@/engine/analyzer/dependencies";
import { createParseCache } from "@/engine/analyzer/parse";
import { fakeFile } from "@/engine/analyzer/__fixtures__/helpers";
import type { RepoFile } from "@/types/analysis";

/** Parse one source string and pull its specifiers. */
function specsOf(source: string, relPath = "a.ts"): string[] {
  const file = fakeFile(relPath, source);
  const cache = createParseCache([file]);
  try {
    return extractSpecifiers(cache.get(file)!);
  } finally {
    cache.dispose();
  }
}

/** Run the full analyzer over a set of files. */
function linksOf(files: RepoFile[], aliases: Record<string, string> = {}) {
  const cache = createParseCache(files);
  try {
    return analyzeDependencies(files, aliases, cache);
  } finally {
    cache.dispose();
  }
}

describe("extractSpecifiers", () => {
  test("extracts every import/export form", () => {
    expect(
      specsOf(`
        import a from "./a";
        import { b } from "./b";
        import * as c from "./c";
        import "./side-effect";
        export { d } from "./d";
        export * from "./e";
        const f = require("./f");
        const g = await import("./g");
        import h = require("./h");
      `),
    ).toEqual([
      "./a", "./b", "./c", "./side-effect",
      "./d", "./e", "./f", "./g", "./h",
    ]);
  });

  test("ignores imports inside comments and string literals", () => {
    // The headline fix. The old regex scanned raw text, so every one of these
    // became a real edge and inflated the target's inDegree.
    expect(
      specsOf(`
        // import x from "./commented-out";
        /* import y from "./block-commented"; */
        /**
         * Usage: import z from "./doc-example";
         */
        const snippet = 'import w from "./in-a-string";';
        const tpl = \`require("./in-a-template")\`;
        import real from "./real";
      `),
    ).toEqual(["./real"]);
  });

  test("type-only imports are still extracted (parity with the old regex)", () => {
    expect(
      specsOf(`
        import type { A } from "./a";
        import { type B } from "./b";
        export type { C } from "./c";
      `),
    ).toEqual(["./a", "./b", "./c"]);
  });

  test("export with no module specifier yields nothing", () => {
    expect(specsOf(`const x = 1; export { x };`)).toEqual([]);
  });

  test("skips templates with substitutions and non-literal specifiers", () => {
    expect(
      specsOf(`
        const mod = "./dynamic";
        const a = await import(\`./locales/\${lang}\`);
        const b = await import(mod);
        const c = require(mod);
        const d = await import("./static");
      `),
    ).toEqual(["./static"]);
  });

  test("emits in declaration order regardless of form", () => {
    expect(
      specsOf(`
        const a = require("./first");
        import b from "./second";
        const c = await import("./third");
        export { d } from "./fourth";
      `),
    ).toEqual(["./first", "./second", "./third", "./fourth"]);
  });

  test("require identifier must be exactly `require`", () => {
    expect(specsOf(`notRequire("./a"); obj.require("./b");`)).toEqual([]);
  });
});

describe("analyzeDependencies", () => {
  test("resolves relative specifiers, extensions, and index files", () => {
    const files = [
      fakeFile("src/a.ts", `import "./b"; import "./dir";`),
      fakeFile("src/b.ts", ""),
      fakeFile("src/dir/index.ts", ""),
    ];
    expect(linksOf(files)).toEqual([
      { from: "src/a.ts", to: "src/b.ts" },
      { from: "src/a.ts", to: "src/dir/index.ts" },
    ]);
  });

  test("resolves tsconfig path aliases", () => {
    const files = [
      fakeFile("app/page.tsx", `import "@/lib/utils";`),
      fakeFile("lib/utils.ts", ""),
    ];
    expect(linksOf(files, { "@/": "" })).toEqual([
      { from: "app/page.tsx", to: "lib/utils.ts" },
    ]);
  });

  test("drops bare package imports and self-imports", () => {
    const files = [fakeFile("src/a.ts", `import "react"; import "./a";`)];
    expect(linksOf(files)).toEqual([]);
  });

  test("dedupes repeated edges between the same pair", () => {
    const files = [
      fakeFile("src/a.ts", `import { x } from "./b"; import { y } from "./b";`),
      fakeFile("src/b.ts", ""),
    ];
    expect(linksOf(files)).toEqual([{ from: "src/a.ts", to: "src/b.ts" }]);
  });

  test("resolves to files the parse cache never parses", () => {
    // .json is not a code ext, so it has no tree — but it is a valid target.
    const files = [
      fakeFile("src/a.ts", `import data from "./data.json";`),
      fakeFile("src/data.json", "{}"),
    ];
    expect(linksOf(files)).toEqual([
      { from: "src/a.ts", to: "src/data.json" },
    ]);
  });

  test("skips unparsed source files without throwing", () => {
    const files = [
      fakeFile("src/big.ts", `import "./b";`, { isText: false, read: () => "" }),
      fakeFile("src/b.ts", ""),
    ];
    expect(linksOf(files)).toEqual([]);
  });
});

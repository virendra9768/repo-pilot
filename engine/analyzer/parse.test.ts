import { describe, expect, test } from "vitest";
import { SyntaxKind } from "ts-morph";
import { createParseCache } from "@/engine/analyzer/parse";
import { fakeFile } from "@/engine/analyzer/__fixtures__/helpers";

describe("createParseCache", () => {
  test("parses each supported code extension", () => {
    const files = [
      fakeFile("a.ts", "export const a = 1;"),
      fakeFile("b.tsx", "export const B = () => <div />;"),
      fakeFile("c.js", "module.exports = 1;"),
      fakeFile("d.jsx", "export const D = () => <div />;"),
      fakeFile("e.mjs", "export const e = 1;"),
      fakeFile("f.cjs", "module.exports = 1;"),
    ];
    const cache = createParseCache(files);
    for (const f of files) expect(cache.get(f), f.relPath).not.toBeNull();
    expect(cache.stats.parsed).toBe(6);
    cache.dispose();
  });

  test("ScriptKind is per-extension: JSX only where the extension allows it", () => {
    const tsx = fakeFile("a.tsx", "export const A = () => <div>hi</div>;");
    const jsx = fakeFile("b.jsx", "export const B = () => <div>hi</div>;");
    // Same text in a .ts file is a type assertion + expression, never JSX —
    // which is exactly why the ScriptKind table is explicit rather than inferred.
    const ts = fakeFile("c.ts", "const v = <string>someValue;");
    const cache = createParseCache([tsx, jsx, ts]);

    expect(cache.get(tsx)!.getDescendantsOfKind(SyntaxKind.JsxElement)).toHaveLength(1);
    expect(cache.get(jsx)!.getDescendantsOfKind(SyntaxKind.JsxElement)).toHaveLength(1);
    expect(cache.get(ts)!.getDescendantsOfKind(SyntaxKind.JsxElement)).toHaveLength(0);
    expect(
      cache.get(ts)!.getDescendantsOfKind(SyntaxKind.TypeAssertionExpression),
    ).toHaveLength(1);
    cache.dispose();
  });

  test("skips non-text files without attempting a parse", () => {
    // read() returns "" for these; parsing it would yield an empty tree.
    const f = fakeFile("big.ts", "export const a = 1;", {
      isText: false,
      read: () => "",
    });
    const cache = createParseCache([f]);
    expect(cache.get(f)).toBeNull();
    expect(cache.stats).toMatchObject({ parsed: 0, skipped: 1 });
    cache.dispose();
  });

  test("skips .d.ts and non-code extensions", () => {
    const dts = fakeFile("types.d.ts", "declare const x: number;");
    const css = fakeFile("a.css", ".x { color: red }");
    const prisma = fakeFile("schema.prisma", "model A { id Int @id }");
    const cache = createParseCache([dts, css, prisma]);
    expect(cache.get(dts)).toBeNull();
    expect(cache.get(css)).toBeNull();
    expect(cache.get(prisma)).toBeNull();
    expect(cache.stats.skipped).toBe(3);
    cache.dispose();
  });

  test("malformed source does not throw and still yields a tree", () => {
    // TS's parser is error-tolerant: it recovers rather than throwing.
    const f = fakeFile("broken.ts", "export function ( { const >>> ;");
    const cache = createParseCache([f]);
    expect(() => cache.get(f)).not.toThrow();
    expect(cache.stats.failed).toBe(0);
    cache.dispose();
  });

  test("get() is memoized — the same file yields the identical tree", () => {
    // The "parse once" guarantee: three analyzers, one parse.
    const f = fakeFile("a.ts", "export const a = 1;");
    const cache = createParseCache([f]);
    expect(cache.get(f)).toBe(cache.get(f));
    expect(cache.stats.parsed).toBe(1);
    cache.dispose();
  });

  test("maxFiles cap stops parsing and flags capped", () => {
    const files = Array.from({ length: 5 }, (_, i) =>
      fakeFile(`f${i}.ts`, "export const a = 1;"),
    );
    const cache = createParseCache(files, { maxFiles: 3 });
    expect(cache.stats.parsed).toBe(3);
    expect(cache.stats.capped).toBe(true);
    expect(cache.get(files[4])).toBeNull();
    cache.dispose();
  });

  test("maxFileBytes skips oversized files but keeps parsing smaller ones", () => {
    const big = fakeFile("big.ts", `const s = "${"x".repeat(500)}";`);
    const small = fakeFile("small.ts", "const a = 1;");
    const cache = createParseCache([big, small], { maxFileBytes: 100 });
    expect(cache.get(big)).toBeNull();
    expect(cache.get(small)).not.toBeNull();
    // Per-file skip is not a global cap — later files still parse.
    expect(cache.stats.capped).toBe(false);
    cache.dispose();
  });

  test("maxTotalBytes caps cumulative source", () => {
    const files = Array.from({ length: 5 }, (_, i) =>
      fakeFile(`f${i}.ts`, `const a${i} = "${"x".repeat(40)}";`),
    );
    const cache = createParseCache(files, { maxTotalBytes: 120 });
    expect(cache.stats.parsed).toBeLessThan(5);
    expect(cache.stats.capped).toBe(true);
    cache.dispose();
  });

  test("dispose() is idempotent", () => {
    const cache = createParseCache([fakeFile("a.ts", "export const a = 1;")]);
    cache.dispose();
    expect(() => cache.dispose()).not.toThrow();
  });

  test("scoped() returns plain data and does not throw", () => {
    const f = fakeFile("a.ts", "import x from './b';");
    const cache = createParseCache([f]);
    const specs = cache.scoped(() =>
      cache.get(f)!.getImportDeclarations().map((d) => d.getModuleSpecifierValue()),
    );
    expect(specs).toEqual(["./b"]);
    cache.dispose();
  });

  test("parsing stays fast — guards against an accidental Program build", () => {
    // A type checker here would blow this by orders of magnitude. There's no
    // clean public probe for "was a Program built", so assert on the symptom.
    const files = Array.from({ length: 50 }, (_, i) =>
      fakeFile(`f${i}.ts`, `import { a } from "./dep";\nexport const x${i} = a;`),
    );
    const start = performance.now();
    const cache = createParseCache(files);
    const elapsed = performance.now() - start;
    expect(cache.stats.parsed).toBe(50);
    expect(elapsed).toBeLessThan(2000);
    cache.dispose();
  });
});

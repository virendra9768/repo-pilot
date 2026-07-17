import { describe, expect, test } from "vitest";
import {
  analyzeRoutes,
  deriveNextRoute,
  detectExportedMethods,
  detectExpressRoutes,
  detectNestRoutes,
} from "@/engine/analyzer/routes";
import { createParseCache } from "@/engine/analyzer/parse";
import { fakeFile } from "@/engine/analyzer/__fixtures__/helpers";

/** Parse one source string and hand its tree to `fn`. */
function withTree<T>(source: string, fn: (sf: never) => T, relPath = "a.ts"): T {
  const file = fakeFile(relPath, source);
  const cache = createParseCache([file]);
  try {
    return fn(cache.get(file)! as never);
  } finally {
    cache.dispose();
  }
}

function routesOf(
  files: ReturnType<typeof fakeFile>[],
  deps: Record<string, string>,
) {
  const cache = createParseCache(files);
  try {
    return analyzeRoutes(files, deps, cache);
  } finally {
    cache.dispose();
  }
}

describe("deriveNextRoute", () => {
  test.each([
    ["app/page.tsx", "/", false],
    ["app/api/route.ts", "/api", true],
    ["app/blog/[slug]/page.tsx", "/blog/[slug]", false],
    ["src/app/page.tsx", "/", false],
    ["app/(marketing)/about/page.tsx", "/about", false],
    ["app/@modal/photo/page.tsx", "/photo", false],
  ])("%s -> %s", (path, expected, isApi) => {
    expect(deriveNextRoute(path)).toEqual({ path: expected, isApi });
  });

  test.each([
    ["app/_components/page.tsx", "private folder"],
    ["components/page.tsx", "no app dir"],
    ["lib/app/page.tsx", "app not a routing root"],
    ["app/layout.tsx", "not a route file"],
  ])("%s -> null (%s)", (path) => {
    expect(deriveNextRoute(path)).toBeNull();
  });
});

describe("detectExportedMethods", () => {
  test("finds function, const, and aliased re-export forms", () => {
    const methods = withTree(
      `
        export function GET() {}
        export async function POST() {}
        export const PUT = () => {};
        export { handler as DELETE } from "./handlers";
        export function notAMethod() {}
        function PATCH() {}
      `,
      (sf) => detectExportedMethods(sf),
    );
    // PATCH is declared but not exported; notAMethod isn't an HTTP verb.
    expect(new Set(methods)).toEqual(new Set(["GET", "POST", "PUT", "DELETE"]));
  });

  test("returns [] when a route file exports no recognizable handler", () => {
    // The caller turns this into ["GET"] — see analyzeRoutes.
    expect(
      withTree(`export const { GET, POST } = makeHandlers();`, (sf) =>
        detectExportedMethods(sf),
      ),
    ).toEqual([]);
  });
});

describe("detectExpressRoutes", () => {
  test("detects routers bound to a non-conventional name", () => {
    // Regression: the old regex only matched variables literally named
    // `app`/`router`, so this route was invisible.
    expect(
      withTree(
        `
          import express from "express";
          const api = express.Router();
          api.get("/users", handler);
          api.post("/users", handler);
        `,
        (sf) => detectExpressRoutes(sf),
      ),
    ).toEqual([
      { method: "GET", path: "/users" },
      { method: "POST", path: "/users" },
    ]);
  });

  test("still detects the conventional app/router names (superset of the regex)", () => {
    expect(
      withTree(
        `
          app.get("/a", h);
          router.post("/b", h);
        `,
        (sf) => detectExpressRoutes(sf),
      ),
    ).toEqual([
      { method: "GET", path: "/a" },
      { method: "POST", path: "/b" },
    ]);
  });

  test.each([
    [`const app = express();`, "express()"],
    [`const app = require("express")();`, "require('express')()"],
    [`const { Router } = require("express"); const app = Router();`, "destructured require"],
    [`import { Router } from "express"; const app = Router();`, "named import"],
    [`const e = require("express"); const app = e.Router();`, "require + .Router()"],
  ])("tracks bindings via %s", (setup) => {
    expect(
      withTree(`${setup}\napp.get("/x", h);`, (sf) => detectExpressRoutes(sf)),
    ).toEqual([{ method: "GET", path: "/x" }]);
  });

  test("handles .route() chains", () => {
    const routes = withTree(
      `
        import express from "express";
        const api = express.Router();
        api.route("/users").get(list).post(create);
      `,
      (sf) => detectExpressRoutes(sf),
    );
    // Order is outermost-call-first: `.post(create)` wraps `.get(list)`, and
    // traversal descends. Both links resolve to the same `.route()` base, so
    // the set is what matters here.
    expect(new Set(routes)).toEqual(
      new Set([
        { method: "POST", path: "/users" },
        { method: "GET", path: "/users" },
      ]),
    );
  });

  test("single-arg app.get is a settings getter, not a route", () => {
    expect(
      withTree(`app.get("view engine");`, (sf) => detectExpressRoutes(sf)),
    ).toEqual([]);
  });

  test("skips non-literal paths and untracked identifiers", () => {
    expect(
      withTree(
        `
          const p = "/dynamic";
          app.get(p, h);
          somethingElse.get("/x", h);
        `,
        (sf) => detectExpressRoutes(sf),
      ),
    ).toEqual([]);
  });

  test("normalizes paths", () => {
    expect(
      withTree(`app.get("users/", h); app.post("/", h);`, (sf) =>
        detectExpressRoutes(sf),
      ),
    ).toEqual([
      { method: "GET", path: "/users" },
      { method: "POST", path: "/" },
    ]);
  });
});

describe("detectNestRoutes", () => {
  test("two controllers in one file keep their own base paths", () => {
    // Regression: the old `content.match()` had no /g, so only the first
    // @Controller was seen and every @Get in the file was glued onto it.
    expect(
      withTree(
        `
          @Controller("users")
          export class UsersController {
            @Get() findAll() {}
            @Get(":id") findOne() {}
          }

          @Controller("posts")
          export class PostsController {
            @Post() create() {}
          }
        `,
        (sf) => detectNestRoutes(sf),
      ),
    ).toEqual([
      { method: "GET", path: "/users" },
      { method: "GET", path: "/users/:id" },
      { method: "POST", path: "/posts" },
    ]);
  });

  test.each([
    [`@Controller()`, "/"],
    [`@Controller`, "/"],
    [`@Controller("users")`, "/users"],
    [`@Controller({ path: "users" })`, "/users"],
    [`@Controller({ path: "users", version: "1" })`, "/users"],
    [`@Controller(["users", "people"])`, "/users"],
    [`@Controller({ path: ["users", "people"] })`, "/users"],
  ])("%s -> %s", (decorator, expected) => {
    expect(
      withTree(`${decorator}\nclass C { @Get() find() {} }`, (sf) =>
        detectNestRoutes(sf),
      ),
    ).toEqual([{ method: "GET", path: expected }]);
  });

  test("ignores classes with no @Controller", () => {
    expect(
      withTree(`class Service { @Get() nope() {} }`, (sf) => detectNestRoutes(sf)),
    ).toEqual([]);
  });
});

describe("analyzeRoutes", () => {
  test("express and nest stay gated on their dependency", () => {
    const files = [
      fakeFile("server.js", `app.get("/x", h);`),
      fakeFile("ctrl.ts", `@Controller("u") class C { @Get() f() {} }`),
    ];
    expect(routesOf(files, {})).toEqual([]);
    expect(routesOf(files, { express: "^4" })).toEqual([
      { method: "GET", path: "/x", handlerFile: "server.js", framework: "express" },
    ]);
    expect(routesOf(files, { "@nestjs/core": "^10" })).toEqual([
      { method: "GET", path: "/u", handlerFile: "ctrl.ts", framework: "nestjs" },
    ]);
  });

  test("a non-text route.ts is skipped entirely (pre-existing behavior)", () => {
    // Oversized/binary files never reach route detection — analyzeRoutes filters
    // on isText before deriveNextRoute, and did so before the AST change too.
    // Documenting parity rather than quietly widening scope.
    const files = [
      fakeFile("app/api/route.ts", `export function GET() {}`, {
        isText: false,
        read: () => "",
      }),
    ];
    expect(routesOf(files, {})).toEqual([]);
  });

  test("a route.ts with no recognizable handler falls back to GET", () => {
    const files = [
      fakeFile("app/api/route.ts", `export const { GET, POST } = makeHandlers();`),
    ];
    expect(routesOf(files, {})).toEqual([
      { method: "GET", path: "/api", handlerFile: "app/api/route.ts", framework: "next-app" },
    ]);
  });

  test("dedupes identical routes", () => {
    const files = [fakeFile("server.js", `app.get("/x", h); app.get("/x", h2);`)];
    expect(routesOf(files, { express: "^4" })).toHaveLength(1);
  });
});

import {
  Node,
  SyntaxKind,
  type ClassDeclaration,
  type SourceFile,
} from "ts-morph";
import type { RepoFile } from "@/types/analysis";
import type { ImportantRoute } from "@/types/understanding-map";
import type { ParseCache } from "./parse";

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const HTTP_METHODS = new Set([
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
]);
const EXPRESS_METHODS = new Set(["get", "post", "put", "patch", "delete", "all"]);
const NEST_DECORATORS = new Set(["Get", "Post", "Put", "Patch", "Delete", "All"]);

/**
 * Route detection.
 * - Next.js App Router: file conventions (`app/**\/{page,route}`) — a path-only
 *   rule, so `deriveNextRoute` stays pure string work. Exported HTTP methods in
 *   a `route.ts` are read off the AST.
 * - Express: `app|router.get('/x', handler)`, including routers bound to any
 *   variable name, plus `.route('/x').get(h)` chains.
 * - NestJS: `@Controller` + method decorators, resolved per class.
 *
 * Express/Nest stay gated on their dependency being present, to avoid false hits.
 * Known-unhandled: `app.use('/api', router)` mount prefixes — resolving those
 * needs cross-file router tracking, which is out of scope here.
 */
export function analyzeRoutes(
  files: RepoFile[],
  allDependencies: Record<string, string>,
  parsed: ParseCache,
): ImportantRoute[] {
  const routes: ImportantRoute[] = [];
  const codeFiles = files.filter((f) => f.isText && CODE_EXT.has(f.ext));

  // --- Next.js App Router (file-convention based) ---
  for (const file of codeFiles) {
    const derived = deriveNextRoute(file.relPath);
    if (!derived) continue;
    if (derived.isApi) {
      const sf = parsed.get(file);
      const found = sf ? parsed.scoped(() => detectExportedMethods(sf)) : [];
      // Both "couldn't parse it" and "parsed it, recognized no handler" mean the
      // same thing here: it's a route file, so it's a route. See detectExportedMethods.
      const methods = found.length ? found : ["GET"];
      for (const method of methods) {
        routes.push({ method, path: derived.path, handlerFile: file.relPath, framework: "next-app" });
      }
    } else {
      routes.push({ method: "GET", path: derived.path, handlerFile: file.relPath, framework: "next-app" });
    }
  }

  // --- Express ---
  if ("express" in allDependencies) {
    for (const file of codeFiles) {
      const sf = parsed.get(file);
      if (!sf) continue;
      for (const r of parsed.scoped(() => detectExpressRoutes(sf))) {
        routes.push({ ...r, handlerFile: file.relPath, framework: "express" });
      }
    }
  }

  // --- NestJS ---
  const hasNest = Object.keys(allDependencies).some((d) => d.startsWith("@nestjs/"));
  if (hasNest) {
    for (const file of codeFiles) {
      const sf = parsed.get(file);
      if (!sf) continue;
      for (const r of parsed.scoped(() => detectNestRoutes(sf))) {
        routes.push({ ...r, handlerFile: file.relPath, framework: "nestjs" });
      }
    }
  }

  return dedupeRoutes(routes);
}

/**
 * Map an App Router file path to its URL, or null if it isn't a route file.
 * Pure filesystem convention — nothing in the file's contents affects its URL,
 * so this is deliberately not AST work.
 */
export function deriveNextRoute(
  relPath: string,
): { path: string; isApi: boolean } | null {
  const parts = relPath.split("/");
  const file = parts[parts.length - 1];
  const m = file.match(/^(page|route)\.(?:t|j)sx?$/);
  if (!m) return null;

  const appIdx = parts.indexOf("app");
  // Require `app` to be a routing root: repo root or under `src`.
  if (appIdx === -1 || (appIdx !== 0 && parts[appIdx - 1] !== "src")) return null;

  const segments = parts.slice(appIdx + 1, parts.length - 1);
  const urlParts: string[] = [];
  for (const seg of segments) {
    if (/^\(.*\)$/.test(seg)) continue; // route group — not part of the URL
    if (/^@/.test(seg)) continue; // parallel route slot
    if (/^_/.test(seg)) return null; // private folder — not routable
    urlParts.push(seg);
  }
  const path = "/" + urlParts.join("/");
  return { path: path === "/" ? "/" : path.replace(/\/$/, ""), isApi: m[1] === "route" };
}

/**
 * Find exported HTTP method handlers in a route.ts file.
 *
 * Returns [] when the file exports none. Callers fall back to ["GET"]: the
 * existence of `app/**\/route.ts` is itself Next's evidence that this is a
 * route, so a file whose handlers we can't name (`export const { GET, POST } =
 * makeHandlers()`, a re-exported default) is a route in an unrecognized shape,
 * not a non-route. Dropping it would lose a real route from the graph.
 */
export function detectExportedMethods(sf: SourceFile): string[] {
  const methods = new Set<string>();

  for (const fn of sf.getFunctions()) {
    const name = fn.getName();
    if (name && fn.hasExportKeyword() && HTTP_METHODS.has(name)) methods.add(name);
  }

  for (const stmt of sf.getVariableStatements()) {
    if (!stmt.hasExportKeyword()) continue;
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      if (HTTP_METHODS.has(name)) methods.add(name);
    }
  }

  // `export { handler as GET }` / `export { GET } from './handlers'`
  for (const exp of sf.getExportDeclarations()) {
    for (const named of exp.getNamedExports()) {
      const exported = named.getAliasNode()?.getText() ?? named.getName();
      if (HTTP_METHODS.has(exported)) methods.add(exported);
    }
  }

  return [...methods];
}

/**
 * Express routes. `app` and `router` are seeded as tracked names so this stays a
 * strict superset of the old regex — a router we can't trace to a binding (a
 * function parameter, one imported from another file) still resolves by
 * convention. Bindings to any other name are discovered from the source.
 */
export function detectExpressRoutes(
  sf: SourceFile,
): Omit<ImportantRoute, "handlerFile" | "framework">[] {
  const tracked = collectExpressBindings(sf);
  const out: Omit<ImportantRoute, "handlerFile" | "framework">[] = [];

  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const access = call.getExpression();
    if (!Node.isPropertyAccessExpression(access)) continue;
    const method = access.getName();
    if (!EXPRESS_METHODS.has(method)) continue;

    const target = access.getExpression();

    // `app.get('/x', handler)` — direct form.
    if (Node.isIdentifier(target) && tracked.has(target.getText())) {
      // `app.get('view engine')` is Express's settings getter, not a route: a
      // real route always has at least one handler after the path.
      if (call.getArguments().length < 2) continue;
      const path = literalValue(call.getArguments()[0]);
      if (path === undefined) continue;
      out.push({ method: normalizeMethod(method), path: normalizePath(path) });
      continue;
    }

    // `app.route('/x').get(handler).post(handler)` — chained form.
    const chained = routeChainPath(target, tracked);
    if (chained !== undefined) {
      out.push({ method: normalizeMethod(method), path: normalizePath(chained) });
    }
  }

  return out;
}

/**
 * Walk a `.route('/x').get(h).post(h)` chain down to its `.route(literal)` base
 * and return that path. Each link past the first sees the previous call as its
 * target, so this has to descend rather than unwrap once.
 */
function routeChainPath(node: Node, tracked: Set<string>): string | undefined {
  let current: Node = node;
  while (Node.isCallExpression(current)) {
    const access = current.getExpression();
    if (!Node.isPropertyAccessExpression(access)) return undefined;
    if (access.getName() === "route") {
      const base = access.getExpression();
      if (!Node.isIdentifier(base) || !tracked.has(base.getText())) return undefined;
      return literalValue(current.getArguments()[0]);
    }
    current = access.getExpression();
  }
  return undefined;
}

/** Variable names bound to an express app or router, plus the `app`/`router` conventions. */
function collectExpressBindings(sf: SourceFile): Set<string> {
  const tracked = new Set(["app", "router"]);

  // Local names for the express import and any destructured `Router`.
  const expressLocals = new Set<string>();
  const routerLocals = new Set<string>();

  for (const imp of sf.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue() !== "express") continue;
    const def = imp.getDefaultImport();
    if (def) expressLocals.add(def.getText());
    for (const named of imp.getNamedImports()) {
      if (named.getName() === "Router") {
        routerLocals.add(named.getAliasNode()?.getText() ?? named.getName());
      }
    }
  }

  for (const decl of sf.getVariableDeclarations()) {
    const init = decl.getInitializer();
    if (!init) continue;
    const name = decl.getNameNode();

    // `const express = require('express')` — track the local name for later.
    if (Node.isIdentifier(name) && isRequireOf(init, "express")) {
      expressLocals.add(name.getText());
      continue;
    }
    // `const { Router } = require('express')`
    if (Node.isObjectBindingPattern(name) && isRequireOf(init, "express")) {
      for (const el of name.getElements()) {
        const prop = el.getPropertyNameNode()?.getText() ?? el.getName();
        if (prop === "Router") routerLocals.add(el.getName());
      }
      continue;
    }
    if (!Node.isIdentifier(name)) continue;
    if (!Node.isCallExpression(init)) continue;

    const callee = init.getExpression();

    // `const app = express()` / `const r = Router()`
    if (Node.isIdentifier(callee)) {
      const calleeName = callee.getText();
      if (expressLocals.has(calleeName) || routerLocals.has(calleeName)) {
        tracked.add(name.getText());
      }
      continue;
    }

    // `const app = require('express')()`
    if (isRequireOf(callee, "express")) {
      tracked.add(name.getText());
      continue;
    }

    // `const r = express.Router()` / `const r = require('express').Router()`
    if (Node.isPropertyAccessExpression(callee) && callee.getName() === "Router") {
      const obj = callee.getExpression();
      const fromLocal = Node.isIdentifier(obj) && expressLocals.has(obj.getText());
      if (fromLocal || isRequireOf(obj, "express")) tracked.add(name.getText());
    }
  }

  return tracked;
}

/** True for `require('<moduleName>')`. */
function isRequireOf(node: Node, moduleName: string): boolean {
  if (!Node.isCallExpression(node)) return false;
  const callee = node.getExpression();
  if (!Node.isIdentifier(callee) || callee.getText() !== "require") return false;
  return literalValue(node.getArguments()[0]) === moduleName;
}

/**
 * NestJS routes, resolved per controller class. Iterating classes (rather than
 * scanning the file) is what keeps a second `@Controller` in the same file from
 * inheriting the first one's base path.
 */
export function detectNestRoutes(
  sf: SourceFile,
): Omit<ImportantRoute, "handlerFile" | "framework">[] {
  const out: Omit<ImportantRoute, "handlerFile" | "framework">[] = [];
  for (const cls of sf.getClasses()) {
    out.push(...routesForController(cls));
  }
  return out;
}

function routesForController(
  cls: ClassDeclaration,
): Omit<ImportantRoute, "handlerFile" | "framework">[] {
  // Matches both `@Controller` and the `@Controller(...)` factory form.
  const controller = cls.getDecorator("Controller");
  if (!controller) return [];

  const base = decoratorPath(controller.getArguments()[0]);
  const out: Omit<ImportantRoute, "handlerFile" | "framework">[] = [];

  for (const method of cls.getMethods()) {
    for (const dec of method.getDecorators()) {
      const name = dec.getName();
      if (!NEST_DECORATORS.has(name)) continue;
      const sub = decoratorPath(dec.getArguments()[0]);
      out.push({
        method: normalizeMethod(name),
        path: joinPath(base, sub),
      });
    }
  }
  return out;
}

/**
 * Path from a Nest decorator argument. Handles the bare/absent form, a string,
 * `{ path: 'x' }`, and the array forms (first entry wins).
 */
function decoratorPath(arg: Node | undefined): string {
  if (!arg) return "";

  const literal = literalValue(arg);
  if (literal !== undefined) return literal;

  if (Node.isArrayLiteralExpression(arg)) {
    return decoratorPath(arg.getElements()[0]);
  }

  if (Node.isObjectLiteralExpression(arg)) {
    const prop = arg.getProperty("path");
    if (prop && Node.isPropertyAssignment(prop)) {
      return decoratorPath(prop.getInitializer());
    }
  }

  return "";
}

/** Literal string value, or undefined for anything computed. */
function literalValue(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue();
  }
  return undefined;
}

function normalizeMethod(raw: string): string {
  const upper = raw.toUpperCase();
  return upper === "ALL" ? "ALL" : upper;
}

function normalizePath(p: string): string {
  if (!p.startsWith("/")) p = "/" + p;
  return p.length > 1 ? p.replace(/\/$/, "") : p;
}

function joinPath(base: string, sub: string): string {
  const segs = [base, sub]
    .map((s) => s.replace(/^\/+|\/+$/g, ""))
    .filter((s) => s.length > 0);
  return segs.length ? "/" + segs.join("/") : "/";
}

function dedupeRoutes(routes: ImportantRoute[]): ImportantRoute[] {
  const seen = new Set<string>();
  const out: ImportantRoute[] = [];
  for (const r of routes) {
    const key = `${r.framework} ${r.method} ${r.path} ${r.handlerFile}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

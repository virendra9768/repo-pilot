import type { RepoFile } from "@/types/analysis";
import type { ImportantRoute } from "@/types/understanding-map";

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * Heuristic route detection — regex / file-convention only, no AST.
 * - Next.js App Router: file conventions (`app/**\/{page,route}`)
 * - Express: `app|router.get('/x', ...)`
 * - NestJS: `@Controller` + method decorators
 * Express/Nest are gated on their dependency being present to avoid false hits.
 */
export function analyzeRoutes(
  files: RepoFile[],
  allDependencies: Record<string, string>,
): ImportantRoute[] {
  const routes: ImportantRoute[] = [];
  const codeFiles = files.filter((f) => f.isText && CODE_EXT.has(f.ext));

  // --- Next.js App Router (file-convention based) ---
  for (const file of codeFiles) {
    const derived = deriveNextRoute(file.relPath);
    if (!derived) continue;
    if (derived.isApi) {
      const methods = detectExportedMethods(file.read());
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
      for (const r of detectExpressRoutes(file.read())) {
        routes.push({ ...r, handlerFile: file.relPath, framework: "express" });
      }
    }
  }

  // --- NestJS ---
  const hasNest = Object.keys(allDependencies).some((d) => d.startsWith("@nestjs/"));
  if (hasNest) {
    for (const file of codeFiles) {
      for (const r of detectNestRoutes(file.read())) {
        routes.push({ ...r, handlerFile: file.relPath, framework: "nestjs" });
      }
    }
  }

  return dedupeRoutes(routes);
}

/** Map an App Router file path to its URL, or null if it isn't a route file. */
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

/** Find exported HTTP method handlers in a route.ts file. */
function detectExportedMethods(content: string): string[] {
  const methods = new Set<string>();
  const fnRe = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  const constRe = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/g;
  let mm: RegExpExecArray | null;
  while ((mm = fnRe.exec(content))) methods.add(mm[1]);
  while ((mm = constRe.exec(content))) methods.add(mm[1]);
  return methods.size ? [...methods] : ["GET"];
}

function detectExpressRoutes(content: string): Omit<ImportantRoute, "handlerFile" | "framework">[] {
  const out: Omit<ImportantRoute, "handlerFile" | "framework">[] = [];
  const re = /\b(?:app|router)\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    out.push({ method: m[1].toUpperCase() === "ALL" ? "ALL" : m[1].toUpperCase(), path: normalizePath(m[2]) });
  }
  return out;
}

function detectNestRoutes(content: string): Omit<ImportantRoute, "handlerFile" | "framework">[] {
  const controller = content.match(/@Controller\(\s*[`'"]?([^`'")]*)[`'"]?\s*\)/);
  if (!controller) return [];
  const base = controller[1] ?? "";
  const out: Omit<ImportantRoute, "handlerFile" | "framework">[] = [];
  const re = /@(Get|Post|Put|Patch|Delete|All)\(\s*[`'"]?([^`'")]*)[`'"]?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const method = m[1].toUpperCase() === "ALL" ? "ALL" : m[1].toUpperCase();
    out.push({ method, path: joinPath(base, m[2] ?? "") });
  }
  return out;
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

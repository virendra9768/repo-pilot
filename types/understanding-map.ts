import type { IntelligenceGraph } from "./graph";

/**
 * The **locked** Understanding Map schema. Every downstream feature consumes this.
 * The eight top-level keys are fixed by CLAUDE.md and must NOT change shape.
 *
 * The per-item shapes below are additive detail (the locked schema left array
 * item shapes unspecified). Flagged in the Day-1 plan; top-level keys unchanged.
 */

export interface EntryPoint {
  /** Repo-relative path. */
  path: string;
  /** Why this is considered an entry point. */
  reason: string;
}

export interface CriticalFile {
  path: string;
  reason: string;
  /** Heuristic importance score (higher = more central). */
  score: number;
}

export type TechnologyCategory =
  | "framework"
  | "language"
  | "styling"
  | "database"
  | "orm"
  | "runtime"
  | "payments"
  | "cache"
  | "auth"
  | "library";

export interface Technology {
  name: string;
  category: TechnologyCategory;
  /** What in the repo proved this (e.g. "dependency: next"). */
  evidence: string;
}

export interface BusinessDomain {
  name: string;
  /** Repo-relative paths that make up this domain. */
  paths: string[];
}

export type RouteFramework = "next-app" | "express" | "nestjs";

export interface ImportantRoute {
  /** HTTP method, uppercased (GET/POST/...), or "ALL". */
  method: string;
  /** URL path, e.g. "/api/users/[id]". */
  path: string;
  /** Repo-relative file that declares the route. */
  handlerFile: string;
  framework: RouteFramework;
}

export type Orm = "prisma" | "mongoose" | "typeorm";

export interface ModelField {
  name: string;
  type: string;
}

export interface ModelRelation {
  /** Field on this model that references another model. */
  field: string;
  /** Referenced model name. */
  target: string;
}

export interface DatabaseModel {
  name: string;
  /** Repo-relative file the model was found in. */
  file: string;
  orm: Orm;
  fields: ModelField[];
  relations: ModelRelation[];
}

export interface LearningStep {
  path: string;
  /** 1-based suggested reading order. */
  order: number;
  reason: string;
}

/** The locked top-level shape — do not add/remove/rename these eight keys. */
export interface UnderstandingMap {
  entryPoints: EntryPoint[];
  criticalFiles: CriticalFile[];
  technologies: Technology[];
  businessDomains: BusinessDomain[];
  importantRoutes: ImportantRoute[];
  databaseModels: DatabaseModel[];
  learningOrder: LearningStep[];
  graph: IntelligenceGraph;
}

import type { RepoFile } from "@/types/analysis";
import type {
  DatabaseModel,
  ModelField,
  ModelRelation,
} from "@/types/understanding-map";

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * Detect ORMs by file presence + regex-extract model names / fields / relations.
 * Prisma / Mongoose / TypeORM only (see CLAUDE.md scope). No AST.
 */
export function analyzeDatabase(files: RepoFile[]): DatabaseModel[] {
  const models: DatabaseModel[] = [];

  for (const file of files) {
    if (!file.isText) continue;
    if (file.name === "schema.prisma" || file.ext === ".prisma") {
      models.push(...parsePrisma(file));
    }
  }

  const codeFiles = files.filter((f) => f.isText && CODE_EXT.has(f.ext));
  for (const file of codeFiles) {
    const content = file.read();
    if (/from\s+["']mongoose["']|require\(\s*["']mongoose["']/.test(content)) {
      models.push(...parseMongoose(file, content));
    }
    if (/@Entity\s*\(/.test(content)) {
      models.push(...parseTypeOrm(file, content));
    }
  }

  return models;
}

// --- Prisma ---------------------------------------------------------------

function parsePrisma(file: RepoFile): DatabaseModel[] {
  const content = file.read();
  const modelNames = new Set<string>();
  const blockRe = /model\s+(\w+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(content))) modelNames.add(m[1]);

  const out: DatabaseModel[] = [];
  const bodyRe = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
  while ((m = bodyRe.exec(content))) {
    const [, name, body] = m;
    const fields: ModelField[] = [];
    const relations: ModelRelation[] = [];
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      const fm = line.match(/^(\w+)\s+([\w.]+)(\[\])?/);
      if (!fm) continue;
      const [, fieldName, baseType] = fm;
      const typeLabel = baseType + (fm[3] ?? "");
      fields.push({ name: fieldName, type: typeLabel });
      if (modelNames.has(baseType)) {
        relations.push({ field: fieldName, target: baseType });
      }
    }
    out.push({ name, file: file.relPath, orm: "prisma", fields, relations });
  }
  return out;
}

// --- Mongoose -------------------------------------------------------------

function parseMongoose(file: RepoFile, content: string): DatabaseModel[] {
  const out: DatabaseModel[] = [];
  // Model name from mongoose.model('Name', ...) / model('Name', ...)
  const nameRe = /\bmodel\s*(?:<[^>]*>)?\s*\(\s*["'`](\w+)["'`]/g;
  const names: string[] = [];
  let nm: RegExpExecArray | null;
  while ((nm = nameRe.exec(content))) names.push(nm[1]);

  // First `new Schema({ ... })` object — best-effort field extraction.
  const schemaBody = content.match(/new\s+(?:mongoose\.)?Schema\s*\(\s*\{([\s\S]*?)\}\s*[,)]/);
  const fields: ModelField[] = [];
  const relations: ModelRelation[] = [];
  if (schemaBody) {
    const body = schemaBody[1];
    const keyRe = /(\w+)\s*:\s*\{?([^,{}\n]*)/g;
    let km: RegExpExecArray | null;
    while ((km = keyRe.exec(body))) {
      const key = km[1];
      const rest = km[2] ?? "";
      const typeM = rest.match(/type\s*:\s*(\w+)/) ?? rest.match(/^\s*(\w+)/);
      fields.push({ name: key, type: typeM ? typeM[1] : "Mixed" });
      const refM = body.slice(km.index).match(/ref\s*:\s*["'`](\w+)["'`]/);
      if (refM && rest.includes("ObjectId")) relations.push({ field: key, target: refM[1] });
    }
  }

  const modelName = names[0] ?? deriveNameFromFile(file.relPath);
  if (names.length === 0 && fields.length === 0) return out;
  out.push({ name: modelName, file: file.relPath, orm: "mongoose", fields, relations });
  return out;
}

// --- TypeORM --------------------------------------------------------------

function parseTypeOrm(file: RepoFile, content: string): DatabaseModel[] {
  const out: DatabaseModel[] = [];
  const classRe = /@Entity\s*\([^)]*\)\s*(?:export\s+)?class\s+(\w+)/g;
  let cm: RegExpExecArray | null;
  while ((cm = classRe.exec(content))) {
    const name = cm[1];
    const fields: ModelField[] = [];
    const relations: ModelRelation[] = [];
    // Columns: @Column(...) prop: Type;
    const colRe = /@Column\s*\([^)]*\)\s*(\w+)\s*:\s*([\w<>[\]]+)/g;
    let colm: RegExpExecArray | null;
    while ((colm = colRe.exec(content))) fields.push({ name: colm[1], type: colm[2] });
    // Relations: @OneToMany(() => Target, ...) prop
    const relRe = /@(OneToOne|OneToMany|ManyToOne|ManyToMany)\s*\(\s*(?:type\s*=>|\(\)\s*=>)\s*(\w+)[\s\S]*?\)\s*(\w+)/g;
    let relm: RegExpExecArray | null;
    while ((relm = relRe.exec(content))) relations.push({ field: relm[3], target: relm[2] });
    out.push({ name, file: file.relPath, orm: "typeorm", fields, relations });
  }
  return out;
}

function deriveNameFromFile(relPath: string): string {
  const base = relPath.split("/").pop() ?? relPath;
  return base.replace(/\.(model|schema)\.[jt]sx?$/i, "").replace(/\.[jt]sx?$/i, "");
}

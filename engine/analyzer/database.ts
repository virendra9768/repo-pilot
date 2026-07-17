import { getSchema } from "@mrleebo/prisma-ast";
import {
  Node,
  SyntaxKind,
  type ClassDeclaration,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";
import type { RepoFile } from "@/types/analysis";
import type {
  DatabaseModel,
  ModelField,
  ModelRelation,
} from "@/types/understanding-map";
import type { ParseCache } from "./parse";

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/** TypeORM decorators that mark a persisted column. */
const COLUMN_DECORATORS = new Set([
  "Column",
  "PrimaryColumn",
  "PrimaryGeneratedColumn",
  "CreateDateColumn",
  "UpdateDateColumn",
  "DeleteDateColumn",
  "VersionColumn",
]);

const RELATION_DECORATORS = new Set([
  "OneToOne",
  "OneToMany",
  "ManyToOne",
  "ManyToMany",
]);

/**
 * Detect ORMs and extract model names / fields / relations.
 * Prisma / Mongoose / TypeORM only (see CLAUDE.md scope).
 *
 * Prisma schemas are their own grammar, so they go through a Prisma parser;
 * Mongoose and TypeORM are read off the shared TypeScript AST.
 */
export function analyzeDatabase(
  files: RepoFile[],
  parsed: ParseCache,
): DatabaseModel[] {
  const models: DatabaseModel[] = [];

  for (const file of files) {
    if (!file.isText) continue;
    if (file.name === "schema.prisma" || file.ext === ".prisma") {
      models.push(...parsePrisma(file));
    }
  }

  const codeFiles = files.filter((f) => f.isText && CODE_EXT.has(f.ext));
  for (const file of codeFiles) {
    const sf = parsed.get(file);
    if (!sf) continue;
    models.push(...parsed.scoped(() => parseMongoose(file, sf)));
    models.push(...parsed.scoped(() => parseTypeOrm(file, sf)));
  }

  return dedupeModels(models);
}

/**
 * A model is identified by name + file — which is exactly how buildGraph ids its
 * nodes, so duplicates here would emit colliding graph node ids. They arise from
 * real code: a test file that declares `const schema` inside several blocks and
 * registers each under the same model name. Keep the richest entry, since the
 * shape we can say most about is the most useful one.
 */
function dedupeModels(models: DatabaseModel[]): DatabaseModel[] {
  const best = new Map<string, DatabaseModel>();
  for (const model of models) {
    const key = `${model.name}@${model.file}`;
    const seen = best.get(key);
    if (!seen || model.fields.length > seen.fields.length) best.set(key, model);
  }
  return [...best.values()];
}

// --- Prisma ---------------------------------------------------------------

function parsePrisma(file: RepoFile): DatabaseModel[] {
  let schema;
  try {
    schema = getSchema(file.read());
  } catch {
    // Unlike the TS parser, prisma-ast throws on malformed input.
    return [];
  }

  const blocks = schema.list.filter((b) => b.type === "model");
  const modelNames = new Set(blocks.map((b) => b.name));

  return blocks.map((block) => {
    const fields: ModelField[] = [];
    const relations: ModelRelation[] = [];

    for (const prop of block.properties) {
      // Skips `@@id`/`@@index` block attributes and comments.
      if (prop.type !== "field") continue;
      // `Unsupported("...")` yields a function rather than a plain type name.
      if (typeof prop.fieldType !== "string") continue;

      // Optional is deliberately not encoded: the regex this replaced rendered
      // `String?` as "String", and keeping that keeps the output identical.
      fields.push({ name: prop.name, type: prop.fieldType + (prop.array ? "[]" : "") });
      if (modelNames.has(prop.fieldType)) {
        relations.push({ field: prop.name, target: prop.fieldType });
      }
    }

    return { name: block.name, file: file.relPath, orm: "prisma", fields, relations };
  });
}

// --- Mongoose -------------------------------------------------------------

interface SchemaBinding {
  /** Variable the schema was assigned to, if any. */
  varName?: string;
  /** Source offset of the construction, used to resolve name reuse across scopes. */
  pos: number;
  fields: ModelField[];
  relations: ModelRelation[];
}

function parseMongoose(file: RepoFile, sf: SourceFile): DatabaseModel[] {
  if (!importsMongoose(sf)) return [];

  const schemas = collectSchemas(sf);
  if (schemas.length === 0) return [];

  const modelCalls = collectModelCalls(sf);
  const out: DatabaseModel[] = [];
  const used = new Set<SchemaBinding>();

  for (const call of modelCalls) {
    const schema = pairSchema(schemas, call);
    if (!schema) continue;
    used.add(schema);
    out.push({
      name: call.name,
      file: file.relPath,
      orm: "mongoose",
      fields: schema.fields,
      relations: schema.relations,
    });
  }

  // No `model('X', schema)` call at all — fall back to the filename, as before.
  if (modelCalls.length === 0) {
    const schema = schemas[0];
    if (schema.fields.length > 0) {
      out.push({
        name: deriveNameFromFile(file.relPath),
        file: file.relPath,
        orm: "mongoose",
        fields: schema.fields,
        relations: schema.relations,
      });
    }
  }

  return out;
}

/**
 * Match a `model('X', schema)` call to the schema it names.
 *
 * Resolution is by nearest *preceding* binding of that variable name, not the
 * first one in the file: real code reuses `const schema` across sibling blocks
 * (one per test case), and taking the first would give every model the wrong
 * body. This approximates lexical shadowing without a scope analysis, which
 * would need a binder we deliberately don't build.
 */
function pairSchema(
  schemas: SchemaBinding[],
  call: ModelCall,
): SchemaBinding | undefined {
  if (call.schemaVar) {
    const named = schemas
      .filter((s) => s.varName === call.schemaVar && s.pos < call.pos)
      .sort((a, b) => b.pos - a.pos);
    if (named.length > 0) return named[0];
  }
  // An inline or unnamed schema is unambiguous only when the file has just one.
  return schemas.length === 1 ? schemas[0] : undefined;
}

function importsMongoose(sf: SourceFile): boolean {
  for (const imp of sf.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue() === "mongoose") return true;
  }
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (!Node.isIdentifier(callee) || callee.getText() !== "require") continue;
    if (literalValue(call.getArguments()[0]) === "mongoose") return true;
  }
  return false;
}

/**
 * Every schema construction in the file, bound to its variable where there is
 * one. Mongoose allows `new Schema({...})` and a bare `Schema({...})` call, and
 * both are common in the wild — the regex this replaced only ever matched the
 * `new` form, so plain-call schemas went undetected entirely.
 */
function collectSchemas(sf: SourceFile): SchemaBinding[] {
  const out: SchemaBinding[] = [];

  const constructions = [
    ...sf.getDescendantsOfKind(SyntaxKind.NewExpression),
    ...sf.getDescendantsOfKind(SyntaxKind.CallExpression),
  ].sort((a, b) => a.getStart() - b.getStart());

  for (const expr of constructions) {
    const callee = expr.getExpression();
    const isSchema =
      (Node.isIdentifier(callee) && callee.getText() === "Schema") ||
      (Node.isPropertyAccessExpression(callee) && callee.getName() === "Schema");
    if (!isSchema) continue;

    const arg = expr.getArguments()[0];
    if (!arg || !Node.isObjectLiteralExpression(arg)) continue;

    const decl = expr.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    const { fields, relations } = readSchemaBody(arg);
    out.push({ varName: decl?.getName(), pos: expr.getStart(), fields, relations });
  }

  return out;
}

interface ModelCall {
  name: string;
  schemaVar?: string;
  /** Source offset of the call, used to resolve name reuse across scopes. */
  pos: number;
}

/** Every `model('X', schema)` / `mongoose.model('X', schema)` call. */
function collectModelCalls(sf: SourceFile): ModelCall[] {
  const out: ModelCall[] = [];

  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    const isModel =
      (Node.isIdentifier(callee) && callee.getText() === "model") ||
      (Node.isPropertyAccessExpression(callee) && callee.getName() === "model");
    if (!isModel) continue;

    const name = literalValue(call.getArguments()[0]);
    if (name === undefined) continue;

    const second = call.getArguments()[1];
    out.push({
      name,
      schemaVar: second && Node.isIdentifier(second) ? second.getText() : undefined,
      pos: call.getStart(),
    });
  }

  return out;
}

function readSchemaBody(body: ObjectLiteralExpression): {
  fields: ModelField[];
  relations: ModelRelation[];
} {
  const fields: ModelField[] = [];
  const relations: ModelRelation[] = [];

  for (const prop of body.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const name = prop.getName().replace(/^["'`]|["'`]$/g, "");
    const value = prop.getInitializer();
    if (!value) continue;

    fields.push({ name, type: mongooseType(value) });

    // `ref` is read from this field's own object literal. The regex this
    // replaced scanned forward from the field to the end of the schema for any
    // `ref:`, so a bare ObjectId could adopt a later field's target.
    if (Node.isObjectLiteralExpression(value) && hasTypeKey(value)) {
      const ref = literalValue(propertyValue(value, "ref"));
      const type = mongooseType(value);
      if (ref !== undefined && type.includes("ObjectId")) {
        relations.push({ field: name, target: ref });
      }
    }
  }

  return { fields, relations };
}

/**
 * Mongoose's own disambiguation: an object value is a field config iff it has a
 * `type` key; otherwise it's a nested subdocument. The old flat regex couldn't
 * express this and hoisted subdocument keys into the parent's field list.
 */
function mongooseType(node: Node): string {
  if (Node.isIdentifier(node)) return node.getText();
  // `Schema.Types.ObjectId` -> "ObjectId"
  if (Node.isPropertyAccessExpression(node)) return node.getName();
  if (Node.isStringLiteral(node)) return node.getLiteralValue();
  if (Node.isArrayLiteralExpression(node)) {
    const first = node.getElements()[0];
    return first ? `[${mongooseType(first)}]` : "[Mixed]";
  }
  if (Node.isObjectLiteralExpression(node)) {
    if (!hasTypeKey(node)) return "Object";
    const type = propertyValue(node, "type");
    return type ? mongooseType(type) : "Mixed";
  }
  return "Mixed";
}

function hasTypeKey(obj: ObjectLiteralExpression): boolean {
  return obj.getProperty("type") !== undefined;
}

function propertyValue(obj: ObjectLiteralExpression, key: string): Node | undefined {
  const prop = obj.getProperty(key);
  if (!prop || !Node.isPropertyAssignment(prop)) return undefined;
  return prop.getInitializer();
}

// --- TypeORM --------------------------------------------------------------

function parseTypeOrm(file: RepoFile, sf: SourceFile): DatabaseModel[] {
  const out: DatabaseModel[] = [];
  for (const cls of sf.getClasses()) {
    if (!cls.getDecorator("Entity")) continue;
    const name = cls.getName();
    if (!name) continue;
    out.push({ name, file: file.relPath, orm: "typeorm", ...readEntity(cls) });
  }
  return out;
}

/**
 * Fields and relations for one entity, read from its own property list.
 * Scoping to the class is what the regex could not do: it scanned the whole
 * file per entity, so two entities in one file each received both their columns.
 */
function readEntity(cls: ClassDeclaration): {
  fields: ModelField[];
  relations: ModelRelation[];
} {
  const fields: ModelField[] = [];
  const relations: ModelRelation[] = [];

  for (const prop of cls.getProperties()) {
    const name = prop.getName();

    for (const dec of prop.getDecorators()) {
      const decName = dec.getName();

      if (COLUMN_DECORATORS.has(decName)) {
        fields.push({ name, type: columnType(prop.getTypeNode()?.getText(), dec.getArguments()[0]) });
        continue;
      }

      if (RELATION_DECORATORS.has(decName)) {
        const target = relationTarget(dec.getArguments()[0]);
        if (target) relations.push({ field: name, target });
      }
    }
  }

  return { fields, relations };
}

/**
 * Prefer the declared TypeScript type, then `@Column({ type: 'varchar' })`. The
 * old regex required `: Type` and dropped untyped columns entirely.
 */
function columnType(typeNode: string | undefined, arg: Node | undefined): string {
  if (typeNode) return typeNode;
  if (arg && Node.isObjectLiteralExpression(arg)) {
    const type = literalValue(propertyValue(arg, "type"));
    if (type !== undefined) return type;
  }
  return "unknown";
}

/** `() => Target`, `type => Target`, or the string form `'Target'`. */
function relationTarget(arg: Node | undefined): string | undefined {
  if (!arg) return undefined;
  const literal = literalValue(arg);
  if (literal !== undefined) return literal;
  if (Node.isArrowFunction(arg)) {
    const body = arg.getBody();
    if (Node.isIdentifier(body)) return body.getText();
  }
  return undefined;
}

// --- shared ---------------------------------------------------------------

/** Literal string value, or undefined for anything computed. */
function literalValue(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue();
  }
  return undefined;
}

function deriveNameFromFile(relPath: string): string {
  const base = relPath.split("/").pop() ?? relPath;
  return base.replace(/\.(model|schema)\.[jt]sx?$/i, "").replace(/\.[jt]sx?$/i, "");
}

import { describe, expect, test } from "vitest";
import { analyzeDatabase } from "@/engine/analyzer/database";
import { createParseCache } from "@/engine/analyzer/parse";
import { fakeFile } from "@/engine/analyzer/__fixtures__/helpers";
import type { RepoFile } from "@/types/analysis";

function modelsOf(files: RepoFile[]) {
  const cache = createParseCache(files);
  try {
    return analyzeDatabase(files, cache);
  } finally {
    cache.dispose();
  }
}

function prisma(source: string) {
  return modelsOf([fakeFile("prisma/schema.prisma", source)]);
}

describe("prisma", () => {
  test("extracts models, fields, and relations", () => {
    expect(
      prisma(`
        model User {
          id    Int    @id @default(autoincrement())
          email String @unique
          posts Post[]
        }

        model Post {
          id       Int  @id
          author   User @relation(fields: [authorId], references: [id])
          authorId Int
        }
      `),
    ).toEqual([
      {
        name: "User",
        file: "prisma/schema.prisma",
        orm: "prisma",
        fields: [
          { name: "id", type: "Int" },
          { name: "email", type: "String" },
          { name: "posts", type: "Post[]" },
        ],
        relations: [{ field: "posts", target: "Post" }],
      },
      {
        name: "Post",
        file: "prisma/schema.prisma",
        orm: "prisma",
        fields: [
          { name: "id", type: "Int" },
          { name: "author", type: "User" },
          { name: "authorId", type: "Int" },
        ],
        relations: [{ field: "author", target: "User" }],
      },
    ]);
  });

  test("nested braces in an attribute do not truncate the model", () => {
    // Regression: the old body regex was a lazy match that stopped at the first
    // `}`, silently dropping every field after a nested brace.
    const models = prisma(`
      model Thing {
        id        String @id @default(dbgenerated("gen_random_uuid()"))
        meta      Json   @default("{}")
        createdAt DateTime @default(now())
        name      String
      }
    `);
    expect(models[0].fields.map((f) => f.name)).toEqual([
      "id",
      "meta",
      "createdAt",
      "name",
    ]);
  });

  test("optional fields render without the ? (parity with the old regex)", () => {
    expect(
      prisma(`
        model A {
          id  Int     @id
          bio String?
        }
      `)[0].fields,
    ).toEqual([
      { name: "id", type: "Int" },
      { name: "bio", type: "String" },
    ]);
  });

  test("skips block attributes and comments; enums are not relations", () => {
    const models = prisma(`
      enum Role {
        USER
        ADMIN
      }

      model User {
        // a comment
        id   Int  @id
        role Role
        @@index([id])
        @@map("users")
      }
    `);
    expect(models).toHaveLength(1);
    expect(models[0].fields).toEqual([
      { name: "id", type: "Int" },
      { name: "role", type: "Role" },
    ]);
    expect(models[0].relations).toEqual([]);
  });

  test("malformed schema yields no models rather than throwing", () => {
    // prisma-ast throws where the TS parser would recover.
    expect(() => prisma(`model { !!! broken`)).not.toThrow();
    expect(prisma(`model { !!! broken`)).toEqual([]);
  });
});

describe("typeorm", () => {
  test("two entities in one file each get only their own columns", () => {
    // The headline regression: the old column/relation regexes scanned the whole
    // file inside a per-entity loop, so every entity got every column.
    const models = modelsOf([
      fakeFile(
        "src/entities.ts",
        `
          @Entity()
          export class User {
            @PrimaryGeneratedColumn() id: number;
            @Column() email: string;
          }

          @Entity()
          export class Product {
            @PrimaryGeneratedColumn() id: number;
            @Column() title: string;
            @Column() price: number;
          }
        `,
      ),
    ]);

    expect(models.map((m) => m.name)).toEqual(["User", "Product"]);
    expect(models[0].fields).toEqual([
      { name: "id", type: "number" },
      { name: "email", type: "string" },
    ]);
    expect(models[1].fields).toEqual([
      { name: "id", type: "number" },
      { name: "title", type: "string" },
      { name: "price", type: "number" },
    ]);
  });

  test("primary key columns are detected", () => {
    // The old regex required a literal `@Column`, so `@PrimaryGeneratedColumn()`
    // never matched and every TypeORM model was missing its primary key.
    const models = modelsOf([
      fakeFile(
        "src/user.ts",
        `
          @Entity()
          export class User {
            @PrimaryGeneratedColumn() id: number;
            @CreateDateColumn() createdAt: Date;
          }
        `,
      ),
    ]);
    expect(models[0].fields).toEqual([
      { name: "id", type: "number" },
      { name: "createdAt", type: "Date" },
    ]);
  });

  test("untyped columns fall back to the options type, then unknown", () => {
    const models = modelsOf([
      fakeFile(
        "src/user.ts",
        `
          @Entity()
          export class User {
            @Column({ type: "varchar" }) name;
            @Column() mystery;
          }
        `,
      ),
    ]);
    expect(models[0].fields).toEqual([
      { name: "name", type: "varchar" },
      { name: "mystery", type: "unknown" },
    ]);
  });

  test.each([
    [`@OneToMany(() => Photo, (p) => p.user) photos: Photo[];`, "Photo"],
    [`@ManyToOne(type => User, u => u.photos) user: User;`, "User"],
    [`@OneToOne("Profile") profile: Profile;`, "Profile"],
  ])("relation target from %s", (decl, target) => {
    const models = modelsOf([
      fakeFile("src/e.ts", `@Entity()\nexport class E {\n  ${decl}\n}`),
    ]);
    expect(models[0].relations).toEqual([
      { field: models[0].relations[0]?.field, target },
    ]);
  });

  test("classes without @Entity are ignored", () => {
    expect(
      modelsOf([fakeFile("src/s.ts", `export class Service { @Column() x: string; }`)]),
    ).toEqual([]);
  });
});

describe("mongoose", () => {
  test("two schemas in one file are both parsed", () => {
    // Regression: only the first `new Schema({...})` per file was ever read.
    const models = modelsOf([
      fakeFile(
        "src/models.js",
        `
          const mongoose = require("mongoose");
          const { Schema } = mongoose;

          const userSchema = new Schema({ email: String });
          const postSchema = new Schema({ title: String });

          const User = mongoose.model("User", userSchema);
          const Post = mongoose.model("Post", postSchema);
        `,
      ),
    ]);
    expect(models.map((m) => m.name)).toEqual(["User", "Post"]);
    expect(models[0].fields).toEqual([{ name: "email", type: "String" }]);
    expect(models[1].fields).toEqual([{ name: "title", type: "String" }]);
  });

  test("an ObjectId field does not adopt a later field's ref", () => {
    // Regression: `ref` was found by scanning forward from the field to the end
    // of the schema, so `owner` used to steal `category`'s ref.
    const models = modelsOf([
      fakeFile(
        "src/thing.js",
        `
          const mongoose = require("mongoose");
          const thingSchema = new mongoose.Schema({
            owner: { type: mongoose.Schema.Types.ObjectId },
            category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
          });
          module.exports = mongoose.model("Thing", thingSchema);
        `,
      ),
    ]);
    expect(models[0].relations).toEqual([{ field: "category", target: "Category" }]);
  });

  test("field types: arrays, ObjectId, and nested subdocuments", () => {
    const models = modelsOf([
      fakeFile(
        "src/post.js",
        `
          const mongoose = require("mongoose");
          const postSchema = new mongoose.Schema({
            title: String,
            tags: [String],
            author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            address: { street: String, city: String },
            count: { type: Number, default: 0 },
          });
          module.exports = mongoose.model("Post", postSchema);
        `,
      ),
    ]);
    expect(models[0].fields).toEqual([
      { name: "title", type: "String" },
      // was "Mixed" — the regex's `^\s*(\w+)` couldn't see past the `[`
      { name: "tags", type: "[String]" },
      // was "Schema" — the regex grabbed the first \w+ of Schema.Types.ObjectId
      { name: "author", type: "ObjectId" },
      // no `type` key -> a subdocument, not a field config. The flat regex used
      // to hoist `street`/`city` into this list as sibling fields.
      { name: "address", type: "Object" },
      { name: "count", type: "Number" },
    ]);
  });

  test("detects `mongoose.Schema({...})` called without `new`", () => {
    // Mongoose allows both forms and the plain call is common in real code
    // (e.g. node-express-boilerplate). The old regex required `new\\s+`, so
    // these schemas were invisible.
    const models = modelsOf([
      fakeFile(
        "src/user.model.js",
        `
          const mongoose = require("mongoose");
          const userSchema = mongoose.Schema({
            name: { type: String, required: true },
            email: { type: String, unique: true },
          });
          module.exports = mongoose.model("User", userSchema);
        `,
      ),
    ]);
    expect(models).toHaveLength(1);
    expect(models[0].name).toBe("User");
    expect(models[0].fields).toEqual([
      { name: "name", type: "String" },
      { name: "email", type: "String" },
    ]);
  });

  test("falls back to the filename when there is no model() call", () => {
    const models = modelsOf([
      fakeFile(
        "src/user.model.js",
        `
          const mongoose = require("mongoose");
          const schema = new mongoose.Schema({ email: String });
          module.exports = schema;
        `,
      ),
    ]);
    expect(models[0].name).toBe("user");
  });

  test("same model name in one file collapses to a single entry", () => {
    // buildGraph ids model nodes as `model:<name>@<file>`, so duplicates would
    // collide. Real code hits this: a test file with a `const schema` per block,
    // each registered under the same name. The richest entry wins.
    const models = modelsOf([
      fakeFile(
        "tests/plugin.test.js",
        `
          const mongoose = require("mongoose");
          it("a", () => {
            const schema = mongoose.Schema({});
            const Model = connection.model("Model", schema);
          });
          it("b", () => {
            const schema = mongoose.Schema({ public: { type: String } });
            const Model = connection.model("Model", schema);
          });
        `,
      ),
    ]);
    expect(models).toHaveLength(1);
    expect(models[0].fields).toEqual([{ name: "public", type: "String" }]);
  });

  test("files that never import mongoose are ignored", () => {
    expect(
      modelsOf([
        fakeFile("src/x.js", `const schema = new Schema({ a: String }); model("X", schema);`),
      ]),
    ).toEqual([]);
  });

  test("a mongoose mention in a comment is not an import", () => {
    expect(
      modelsOf([
        fakeFile(
          "src/x.js",
          `// import mongoose from "mongoose";\nconst s = new Schema({ a: String });`,
        ),
      ]),
    ).toEqual([]);
  });
});

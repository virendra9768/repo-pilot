# Vendored demo repositories

These are **source-only snapshots** of real OSS repos, bundled as guaranteed-working
fallbacks for the analysis engine (used when a pasted GitHub URL fails to clone, and
as the Day-1 verification targets). `.git/` and `node_modules/` are intentionally removed.

| Local folder | Source repo | Commit SHA | Notes |
|---|---|---|---|
| `next-prisma-starter/` | [prisma/prisma-examples](https://github.com/prisma/prisma-examples) — subfolder `accelerate/nextjs-starter` | `6d44921b6795eea9dd1268f6f071415edf80f2fd` | Next.js App Router + Prisma + Tailwind. Exercises Next/React/Tailwind/Prisma detectors; `Quotes` model populates `databaseModels`. MIT. |
| `nest-starter/` | [nestjs/typescript-starter](https://github.com/nestjs/typescript-starter) | `c4d9330f5513eda0fb5df594f6b34a11fde1a934` | Minimal NestJS. Exercises the `@Controller`/`@Get` route detector (`GET /`). No database. MIT. |

Both are excluded from our TypeScript build (`tsconfig.json`) and ESLint (`eslint.config.mjs`).

import type { Technology, TechnologyCategory } from "@/types/understanding-map";

interface TechRule {
  /** Exact dependency names that trigger this technology. */
  deps: string[];
  name: string;
  category: TechnologyCategory;
}

/**
 * Rule-based technology detection off package.json dependencies.
 * Deliberately dependency-driven (no file scanning) — see CLAUDE.md scope.
 */
const RULES: TechRule[] = [
  { deps: ["next"], name: "Next.js", category: "framework" },
  { deps: ["react", "react-dom"], name: "React", category: "framework" },
  { deps: ["express"], name: "Express", category: "framework" },
  { deps: ["@nestjs/core", "@nestjs/common"], name: "NestJS", category: "framework" },
  { deps: ["prisma", "@prisma/client"], name: "Prisma", category: "orm" },
  { deps: ["typeorm"], name: "TypeORM", category: "orm" },
  { deps: ["mongoose"], name: "Mongoose", category: "orm" },
  { deps: ["pg", "postgres"], name: "PostgreSQL", category: "database" },
  { deps: ["mongodb"], name: "MongoDB", category: "database" },
  { deps: ["tailwindcss"], name: "Tailwind CSS", category: "styling" },
  { deps: ["firebase", "firebase-admin"], name: "Firebase", category: "database" },
  { deps: ["redis", "ioredis"], name: "Redis", category: "cache" },
  { deps: ["stripe", "@stripe/stripe-js"], name: "Stripe", category: "payments" },
  { deps: ["typescript"], name: "TypeScript", category: "language" },
];

export function analyzeTechnologies(
  allDependencies: Record<string, string>,
): Technology[] {
  const found: Technology[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    const hit = rule.deps.find((d) => d in allDependencies);
    if (hit && !seen.has(rule.name)) {
      seen.add(rule.name);
      found.push({
        name: rule.name,
        category: rule.category,
        evidence: `dependency: ${hit}`,
      });
    }
  }
  return found;
}

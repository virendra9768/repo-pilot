import { describe, it, expect } from "vitest";
import { analyzeRepository } from "./analyze";

/**
 * End-to-end smoke over the bundled demos: walk → every detector → graph →
 * Understanding Map. Fully deterministic — reads vendored files from disk, no
 * network and no AI provider.
 */
describe("analyzeRepository (bundled demos)", () => {
  it("produces a populated Understanding Map for the NestJS demo", async () => {
    const { workspace, understandingMap } = await analyzeRepository({
      kind: "demo",
      demo: "nest-starter",
    });

    expect(workspace.source).toBe("demo");
    expect(workspace.fileCount).toBeGreaterThan(0);
    expect(understandingMap.technologies.length).toBeGreaterThan(0);
    expect(understandingMap.technologies.map((t) => t.name).join(" ")).toMatch(/nest/i);
    expect(understandingMap.entryPoints.length).toBeGreaterThan(0);
    expect(understandingMap.criticalFiles.length).toBeGreaterThan(0);
    expect(understandingMap.graph.nodes.length).toBeGreaterThan(0);
  });

  it("detects Next.js/Prisma for the Next demo", async () => {
    const { understandingMap } = await analyzeRepository({
      kind: "demo",
      demo: "next-prisma-starter",
    });

    const tech = understandingMap.technologies.map((t) => t.name).join(" ").toLowerCase();
    expect(tech).toMatch(/next|prisma/);
    expect(understandingMap.graph.nodes.length).toBeGreaterThan(0);
    expect(understandingMap.learningOrder.length).toBeGreaterThan(0);
  });
});

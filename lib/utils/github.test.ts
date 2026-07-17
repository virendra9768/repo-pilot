import { describe, it, expect } from "vitest";
import { repoUrl, fileUrl } from "./github";

describe("repoUrl", () => {
  it("reconstructs a github URL from a gh__ id", () => {
    expect(repoUrl("gh__facebook__react")).toBe("https://github.com/facebook/react");
  });

  it("maps a demo id to its real source repo", () => {
    expect(repoUrl("next-prisma-starter")).toBe("https://github.com/prisma/prisma-examples");
    expect(repoUrl("nest-starter")).toBe("https://github.com/nestjs/typescript-starter");
  });

  it("returns null for an unknown id", () => {
    expect(repoUrl("mystery")).toBeNull();
  });
});

describe("fileUrl", () => {
  it("builds a blob URL for a gh__ id at HEAD", () => {
    expect(fileUrl("gh__o__r", "src/index.ts")).toBe(
      "https://github.com/o/r/blob/HEAD/src/index.ts",
    );
  });

  it("applies the demo branch and vendored subfolder prefix", () => {
    expect(fileUrl("next-prisma-starter", "app/page.tsx")).toBe(
      "https://github.com/prisma/prisma-examples/blob/latest/accelerate/nextjs-starter/app/page.tsx",
    );
    // nest-starter has an empty prefix.
    expect(fileUrl("nest-starter", "src/main.ts")).toBe(
      "https://github.com/nestjs/typescript-starter/blob/master/src/main.ts",
    );
  });

  it("returns null for an empty path or unknown id", () => {
    expect(fileUrl("gh__o__r", "")).toBeNull();
    expect(fileUrl("mystery", "a.ts")).toBeNull();
  });
});

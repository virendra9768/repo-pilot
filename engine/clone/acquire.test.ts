import { describe, it, expect, beforeEach, vi } from "vitest";

const { fetchRepoMetaMock, downloadMock, removeDirMock } = vi.hoisted(() => ({
  fetchRepoMetaMock: vi.fn(),
  downloadMock: vi.fn(),
  removeDirMock: vi.fn(async () => undefined),
}));
vi.mock("@/lib/git/download", () => ({
  fetchRepoMeta: fetchRepoMetaMock,
  downloadRepoTarball: downloadMock,
  removeDir: removeDirMock,
  MAX_TARBALL_BYTES: 20 * 1024 * 1024,
}));

import { acquireWorkspace } from "./index";

const url = (u: string) => ({ kind: "url", url: u }) as const;

/** GitHub metadata, defaulting to a shape that passes the gate. */
const meta = (over: Partial<{ sizeKb: number; private: boolean; language: string | null }> = {}) => ({
  sizeKb: 1000,
  private: false,
  language: "TypeScript",
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("acquireWorkspace language gate", () => {
  it("rejects a non-JS/TS repo to the demo before downloading", async () => {
    fetchRepoMetaMock.mockResolvedValue(meta({ language: "Python" }));
    const { workspace } = await acquireWorkspace(url("https://github.com/django/django"));

    expect(workspace.source).toBe("demo");
    expect(workspace.fallbackReason).toMatch(/looks like a Python project/i);
    expect(workspace.fallbackReason).toMatch(/JavaScript and TypeScript/i);
    // The whole point of the pre-flight: no bytes are spent on a repo we can't use.
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("clones a TypeScript repo", async () => {
    fetchRepoMetaMock.mockResolvedValue(meta({ language: "TypeScript" }));
    downloadMock.mockResolvedValue("/tmp/workspace");
    const { workspace } = await acquireWorkspace(url("https://github.com/ok/repo"));

    expect(workspace.source).toBe("clone");
    expect(downloadMock).toHaveBeenCalledTimes(1);
  });

  it("clones a repo whose language is null (best-effort — never the reason to refuse)", async () => {
    fetchRepoMetaMock.mockResolvedValue(meta({ language: null }));
    downloadMock.mockResolvedValue("/tmp/workspace");
    const { workspace } = await acquireWorkspace(url("https://github.com/new/repo"));

    expect(workspace.source).toBe("clone");
    expect(downloadMock).toHaveBeenCalled();
  });

  it("proceeds when metadata is unknown (private repo w/o token, or rate limited)", async () => {
    fetchRepoMetaMock.mockResolvedValue(null);
    downloadMock.mockResolvedValue("/tmp/workspace");
    const { workspace } = await acquireWorkspace(url("https://github.com/unknown/repo"));

    expect(workspace.source).toBe("clone");
    expect(downloadMock).toHaveBeenCalled();
  });

  it("does not gate on reported size — a huge report with a small tarball still clones", async () => {
    // nestjs/nest reports ~474 MB but its tarball is 1.1 MB. Any size ceiling
    // would wrongly reject it, which is why the size pre-flight was removed.
    fetchRepoMetaMock.mockResolvedValue(meta({ sizeKb: 474 * 1024 }));
    downloadMock.mockResolvedValue("/tmp/workspace");
    const { workspace } = await acquireWorkspace(url("https://github.com/nestjs/nest"));

    expect(workspace.source).toBe("clone");
    expect(downloadMock).toHaveBeenCalledTimes(1);
  });
});

describe("acquireWorkspace archive size failure", () => {
  it("explains the download limit rather than reporting a generic fetch error", async () => {
    fetchRepoMetaMock.mockResolvedValue(meta());
    downloadMock.mockRejectedValue(new Error("Repository archive exceeds 20 MB limit"));
    const { workspace } = await acquireWorkspace(url("https://github.com/big/repo"));

    expect(workspace.source).toBe("demo");
    expect(workspace.fallbackReason).toMatch(/over the 20 MB download limit/i);
  });
});

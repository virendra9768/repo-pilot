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
  MAX_REPO_SIZE_KB: 150 * 1024,
}));

import { acquireWorkspace } from "./index";

const url = (u: string) => ({ kind: "url", url: u }) as const;

beforeEach(() => vi.clearAllMocks());

describe("acquireWorkspace size pre-check (#1)", () => {
  it("rejects an oversized repo to the demo before downloading", async () => {
    fetchRepoMetaMock.mockResolvedValue({ sizeKb: 200 * 1024, private: false });
    const { workspace } = await acquireWorkspace(url("https://github.com/big/repo"));

    expect(workspace.source).toBe("demo");
    expect(workspace.fallbackReason).toMatch(/over the 150 MB limit/i);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("clones a normally-sized repo", async () => {
    fetchRepoMetaMock.mockResolvedValue({ sizeKb: 1000, private: false });
    downloadMock.mockResolvedValue("/tmp/workspace");
    const { workspace } = await acquireWorkspace(url("https://github.com/ok/repo"));

    expect(workspace.source).toBe("clone");
    expect(downloadMock).toHaveBeenCalledTimes(1);
  });

  it("proceeds with the download when the size is unknown (best-effort)", async () => {
    fetchRepoMetaMock.mockResolvedValue(null); // e.g. private repo w/o token
    downloadMock.mockResolvedValue("/tmp/workspace");
    const { workspace } = await acquireWorkspace(url("https://github.com/unknown/repo"));

    expect(workspace.source).toBe("clone");
    expect(downloadMock).toHaveBeenCalled();
  });
});

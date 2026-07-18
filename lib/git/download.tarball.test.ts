import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Writable } from "node:stream";

// Discard sink in place of the real tar extractor, and keep the temp-dir
// bookkeeping off the filesystem.
vi.mock("tar", () => ({
  extract: () =>
    new Writable({
      write(_chunk, _enc, cb) {
        cb();
      },
    }),
}));
vi.mock("node:fs/promises", () => ({
  mkdtemp: vi.fn(async () => "/tmp/repopilot-test"),
  rm: vi.fn(async () => undefined),
}));

import { downloadRepoTarball, MAX_TARBALL_BYTES } from "./download";
import { rm } from "node:fs/promises";

/** A web ReadableStream of `total` bytes, delivered in 1 KB chunks. */
function bodyOf(total: number): ReadableStream<Uint8Array> {
  const chunk = new Uint8Array(1024);
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent >= total) {
        controller.close();
        return;
      }
      const n = Math.min(1024, total - sent);
      controller.enqueue(chunk.subarray(0, n));
      sent += n;
    },
  });
}

const respond = (total: number) =>
  ({ ok: true, status: 200, statusText: "OK", body: bodyOf(total) }) as unknown as Response;

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("downloadRepoTarball byte guard", () => {
  it("extracts an archive under the limit", async () => {
    vi.mocked(fetch).mockResolvedValue(respond(4 * 1024));
    await expect(downloadRepoTarball("o", "r", { maxBytes: 64 * 1024 })).resolves.toBe(
      "/tmp/repopilot-test",
    );
  });

  it("aborts once the stream exceeds the limit", async () => {
    vi.mocked(fetch).mockResolvedValue(respond(64 * 1024));
    await expect(downloadRepoTarball("o", "r", { maxBytes: 8 * 1024 })).rejects.toThrow(/limit/i);
  });

  it("cleans up the temp dir when the guard trips", async () => {
    vi.mocked(fetch).mockResolvedValue(respond(64 * 1024));
    await expect(downloadRepoTarball("o", "r", { maxBytes: 8 * 1024 })).rejects.toThrow();
    expect(vi.mocked(rm)).toHaveBeenCalledWith("/tmp/repopilot-test", expect.anything());
  });

  it("defaults to MAX_TARBALL_BYTES when no override is given", async () => {
    // Comfortably under the default, so it must succeed without an explicit cap.
    expect(MAX_TARBALL_BYTES).toBeGreaterThan(1024 * 1024);
    vi.mocked(fetch).mockResolvedValue(respond(4 * 1024));
    await expect(downloadRepoTarball("o", "r")).resolves.toBe("/tmp/repopilot-test");
  });
});

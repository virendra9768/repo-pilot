import { describe, it, expect, beforeEach } from "vitest";
import {
  noteCommand,
  applyFlush,
  returnFlush,
  isOverBudget,
  usageKey,
  usageSnapshot,
  __resetBudget,
} from "./budget";
import { KV_COUNTER_FLUSH_EVERY, KV_SOFT_LIMIT } from "@/lib/security/limits";

beforeEach(() => __resetBudget());

describe("noteCommand batching", () => {
  it("returns null until the flush threshold, then the batch size", () => {
    for (let i = 1; i < KV_COUNTER_FLUSH_EVERY; i++) {
      expect(noteCommand()).toBeNull();
    }
    expect(noteCommand()).toBe(KV_COUNTER_FLUSH_EVERY);
  });

  it("resets the local counter after a flush is due", () => {
    for (let i = 0; i < KV_COUNTER_FLUSH_EVERY; i++) noteCommand();
    expect(usageSnapshot().pending).toBe(0);

    // The next batch has to build up from scratch.
    for (let i = 1; i < KV_COUNTER_FLUSH_EVERY; i++) {
      expect(noteCommand()).toBeNull();
    }
    expect(noteCommand()).toBe(KV_COUNTER_FLUSH_EVERY);
  });
});

describe("flush accounting", () => {
  it("adopts the INCRBY reply as the total and charges the flush itself", () => {
    applyFlush(1_000, 1);
    expect(usageSnapshot().total).toBe(1_000);
    // The INCRBY was a command too, so it lands in the next batch.
    expect(usageSnapshot().pending).toBe(1);
  });

  it("charges two commands when the key also had to be expired", () => {
    applyFlush(25, 2);
    expect(usageSnapshot().pending).toBe(2);
  });

  it("returns a failed batch instead of losing the count", () => {
    for (let i = 0; i < KV_COUNTER_FLUSH_EVERY; i++) noteCommand();
    expect(usageSnapshot().pending).toBe(0);

    returnFlush(KV_COUNTER_FLUSH_EVERY);
    expect(usageSnapshot().pending).toBe(KV_COUNTER_FLUSH_EVERY);
  });
});

describe("circuit breaker", () => {
  it("stays closed below the soft limit", () => {
    applyFlush(KV_SOFT_LIMIT - 100, 0);
    expect(isOverBudget()).toBe(false);
  });

  it("trips at the soft limit", () => {
    applyFlush(KV_SOFT_LIMIT, 0);
    expect(isOverBudget()).toBe(true);
  });

  it("counts unflushed commands toward the limit", () => {
    applyFlush(KV_SOFT_LIMIT - 2, 0);
    expect(isOverBudget()).toBe(false);
    noteCommand();
    noteCommand();
    expect(isOverBudget()).toBe(true);
  });
});

describe("usageKey", () => {
  it("is scoped to the calendar month", () => {
    expect(usageKey(new Date("2026-07-18T00:00:00Z"))).toBe("usage:v1:cmds:2026-07");
    expect(usageKey(new Date("2026-08-01T00:00:00Z"))).toBe("usage:v1:cmds:2026-08");
  });
});

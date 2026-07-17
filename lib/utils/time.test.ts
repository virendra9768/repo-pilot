import { describe, it, expect, vi, afterEach } from "vitest";
import { timeAgo } from "./time";

const NOW = new Date("2026-07-17T12:00:00Z").getTime();
const ago = (ms: number) => NOW - ms;
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("timeAgo", () => {
  afterEach(() => vi.useRealTimers());

  function at(ts: number): string {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    return timeAgo(ts);
  }

  it("reports 'just now' for sub-minute", () => {
    expect(at(ago(10 * SEC))).toBe("just now");
  });

  it("reports minutes", () => {
    expect(at(ago(5 * MIN))).toBe("5m ago");
  });

  it("reports hours", () => {
    expect(at(ago(3 * HOUR))).toBe("3h ago");
  });

  it("reports days", () => {
    expect(at(ago(2 * DAY))).toBe("2d ago");
  });
});

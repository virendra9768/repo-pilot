import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, clientKey, enforceRateLimit, __resetRateLimit } from "./rate-limit";

beforeEach(() => __resetRateLimit());
afterEach(() => vi.useRealTimers());

describe("rateLimit fixed window", () => {
  it("allows up to the limit and rejects past it", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 60_000).ok).toBe(true);
    }
    expect(rateLimit("k", 3, 60_000).ok).toBe(false);
  });

  it("keys are independent", () => {
    expect(rateLimit("a", 1, 60_000).ok).toBe(true);
    expect(rateLimit("a", 1, 60_000).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000).ok).toBe(true);
  });

  it("resets once the window elapses", () => {
    vi.useFakeTimers();
    expect(rateLimit("k", 1, 1_000).ok).toBe(true);
    expect(rateLimit("k", 1, 1_000).ok).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect(rateLimit("k", 1, 1_000).ok).toBe(true);
  });

  it("reports seconds until reset when rejecting", () => {
    vi.useFakeTimers();
    rateLimit("k", 1, 10_000);
    expect(rateLimit("k", 1, 10_000).retryAfter).toBe(10);
  });
});

describe("clientKey", () => {
  it("takes the left-most x-forwarded-for entry", () => {
    const req = new Request("https://x.test", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientKey(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip, then a shared bucket", () => {
    expect(clientKey(new Request("https://x.test", { headers: { "x-real-ip": "9.9.9.9" } }))).toBe(
      "9.9.9.9",
    );
    expect(clientKey(new Request("https://x.test"))).toBe("unknown");
  });
});

describe("enforceRateLimit", () => {
  const req = () =>
    new Request("https://x.test", { headers: { "x-forwarded-for": "1.1.1.1" } });

  it("returns null while under budget", () => {
    expect(enforceRateLimit(req(), "s", { limit: 2, windowMs: 60_000 })).toBeNull();
  });

  it("returns a 429 with Retry-After once over", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    enforceRateLimit(req(), "s", opts);
    const res = enforceRateLimit(req(), "s", opts);

    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toBeTruthy();
  });

  it("scopes separate route families independently", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(enforceRateLimit(req(), "import", opts)).toBeNull();
    // Same IP, different scope — the AI budget is untouched.
    expect(enforceRateLimit(req(), "ai", opts)).toBeNull();
    expect(enforceRateLimit(req(), "import", opts)).not.toBeNull();
  });
});

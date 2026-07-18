import { usageSnapshot } from "@/lib/persistence/budget";
import { kvEnabled } from "@/lib/persistence/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upstash command usage as this instance sees it. Costs zero Redis commands —
 * `total` is whatever the last INCRBY reply reported, so it is shared across
 * instances but only as fresh as this instance's last flush. The Upstash console
 * remains the source of truth; this is for spotting a runaway locally.
 */
export function GET() {
  return Response.json({ ...usageSnapshot(), kvEnabled: kvEnabled() });
}

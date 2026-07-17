import { getSession } from "@/lib/auth/session";
import { kvGet, kvSet } from "@/lib/persistence/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
const CAP = 12;

interface Recent {
  id: string;
  name: string;
  source: string;
  at: number;
}

const keyFor = (userId: string) => `u:${userId}:recents`;

/** The signed-in user's cross-device recent repos (empty if anonymous). */
export async function GET() {
  const s = await getSession();
  if (!s) return Response.json({ recents: [] });
  const recents = (await kvGet<Recent[]>(keyFor(s.userId))) ?? [];
  return Response.json({ recents });
}

/** Append a repo to the signed-in user's recent list. No-op if anonymous. */
export async function POST(request: Request) {
  const s = await getSession();
  if (!s) return Response.json({ ok: false });

  let body: Partial<Recent>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.id || !body.name) {
    return Response.json({ error: "id and name required" }, { status: 400 });
  }

  const key = keyFor(s.userId);
  const list = (await kvGet<Recent[]>(key)) ?? [];
  const next: Recent[] = [
    { id: body.id, name: body.name, source: body.source ?? "clone", at: Date.now() },
    ...list.filter((r) => r.id !== body.id),
  ].slice(0, CAP);
  await kvSet(key, next, TTL_SECONDS);
  return Response.json({ ok: true, recents: next });
}

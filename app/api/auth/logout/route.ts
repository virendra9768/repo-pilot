import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Clear the session cookie (discards the GitHub token). */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

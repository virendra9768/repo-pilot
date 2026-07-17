import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start the GitHub OAuth flow: redirect to GitHub's authorize page. */
export async function GET(request: Request) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "GitHub OAuth is not configured" }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const state = randomUUID();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/github/callback`,
    scope: "repo read:user", // `repo` = read private repos (we only ever read)
    state,
    allow_signup: "false",
  });

  const res = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`,
  );
  res.cookies.set("rp_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}

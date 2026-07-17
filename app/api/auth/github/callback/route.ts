import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, cookieOptions, encryptSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OAuth callback: verify state, exchange code → token, store an encrypted session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const savedState = jar.get("rp_oauth_state")?.value;

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/?auth=${reason}`);

  if (!code || !state || !savedState || state !== savedState) return fail("error");

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("error");

  try {
    // Exchange the code for an access token.
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${origin}/api/auth/github/callback`,
      }),
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const token = tokenJson.access_token;
    if (!token) return fail("error");

    // Identify the user (for the per-account cache namespace + UI label).
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "RepoPilot",
        Accept: "application/vnd.github+json",
      },
    });
    const user = (await userRes.json()) as { id?: number; login?: string };
    if (!user.id) return fail("error");

    const jwe = await encryptSession({
      token,
      userId: String(user.id),
      login: user.login ?? "",
    });

    const res = NextResponse.redirect(`${origin}/?auth=connected`);
    if (jwe) res.cookies.set(SESSION_COOKIE, jwe, cookieOptions);
    res.cookies.delete("rp_oauth_state");
    return res;
  } catch {
    return fail("error");
  }
}

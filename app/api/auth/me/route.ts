import { getSession, oauthConfigured } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Report connection state (never the token) so the UI can show Connect/Connected. */
export async function GET() {
  const session = await getSession();
  return Response.json({
    configured: oauthConfigured(),
    connected: Boolean(session),
    login: session?.login ?? null,
  });
}

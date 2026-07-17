import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";

export const SESSION_COOKIE = "rp_session";

export interface SessionData {
  token: string;
  userId: string;
  login: string;
}

/** 32-byte key derived from SESSION_SECRET for A256GCM. Null if unconfigured. */
function key(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return new Uint8Array(createHash("sha256").update(secret).digest());
}

/** Whether GitHub OAuth is fully configured (so the UI can show "Connect"). */
export function oauthConfigured(): boolean {
  return Boolean(
    process.env.SESSION_SECRET &&
      process.env.GITHUB_OAUTH_CLIENT_ID &&
      process.env.GITHUB_OAUTH_CLIENT_SECRET,
  );
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

/** Encrypt the session (incl. the GitHub token) into a JWE string. */
export async function encryptSession(data: SessionData): Promise<string | null> {
  const k = key();
  if (!k) return null;
  return new EncryptJWT({ token: data.token, userId: data.userId, login: data.login })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .encrypt(k);
}

async function decryptSession(jwe: string): Promise<SessionData | null> {
  const k = key();
  if (!k) return null;
  try {
    const { payload } = await jwtDecrypt(jwe, k);
    if (typeof payload.token === "string" && payload.userId) {
      return {
        token: payload.token,
        userId: String(payload.userId),
        login: String(payload.login ?? ""),
      };
    }
  } catch {
    /* invalid/expired cookie */
  }
  return null;
}

/** Read the current session (server components + route handlers). */
export async function getSession(): Promise<SessionData | null> {
  const jar = await cookies();
  const jwe = jar.get(SESSION_COOKIE)?.value;
  if (!jwe) return null;
  return decryptSession(jwe);
}

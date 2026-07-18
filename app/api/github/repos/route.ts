import { getSession } from "@/lib/auth/session";
import { kvGet, kvSet } from "@/lib/persistence/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 300; // 5 min — the list changes rarely
const keyFor = (userId: string) => `u:${userId}:ghrepos`;

/** Minimal repo shape the picker needs (never exposes the token). */
interface Repo {
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  description: string | null;
  language: string | null;
  pushedAt: number;
  url: string;
  /** Repo size in KB, as GitHub reports it — lets the picker flag repos that
   *  would be rejected by the size guard before the user submits. */
  sizeKb: number;
}

/** GitHub `/user/repos` item (only the fields we read). */
interface GhRepo {
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  description: string | null;
  language: string | null;
  pushed_at: string | null;
  html_url: string;
  size?: number;
}

/**
 * List the signed-in user's GitHub repositories (private + public, most-recently
 * pushed first) for the home-page repo picker. Empty list when anonymous or on
 * any GitHub error, so the UI degrades gracefully to manual URL entry.
 */
export async function GET() {
  const s = await getSession();
  if (!s) return Response.json({ repos: [] });

  const cached = await kvGet<Repo[]>(keyFor(s.userId));
  if (cached) return Response.json({ repos: cached });

  try {
    const res = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member",
      {
        headers: {
          Authorization: `Bearer ${s.token}`,
          "User-Agent": "RepoPilot",
          Accept: "application/vnd.github+json",
        },
      },
    );
    if (!res.ok) return Response.json({ repos: [] });

    const raw = (await res.json()) as GhRepo[];
    const repos: Repo[] = (Array.isArray(raw) ? raw : []).map((r) => ({
      fullName: r.full_name,
      name: r.name,
      owner: r.owner?.login ?? "",
      private: Boolean(r.private),
      description: r.description,
      language: r.language,
      pushedAt: r.pushed_at ? Date.parse(r.pushed_at) : 0,
      url: r.html_url,
      // Already in the /user/repos response — carrying it through costs nothing.
      sizeKb: typeof r.size === "number" ? r.size : 0,
    }));

    await kvSet(keyFor(s.userId), repos, CACHE_TTL_SECONDS);
    return Response.json({ repos });
  } catch {
    return Response.json({ repos: [] });
  }
}

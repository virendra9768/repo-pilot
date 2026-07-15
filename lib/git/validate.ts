/**
 * GitHub URL validation & normalization. No network — pure string parsing.
 * Only public github.com repos are supported (no auth / private repos — scope).
 */

export interface ParsedRepo {
  owner: string;
  repo: string;
  /** Normalized https clone URL ending in `.git`. */
  cloneUrl: string;
  /** "owner/repo" */
  slug: string;
}

export interface ValidationResult {
  ok: boolean;
  repo?: ParsedRepo;
  error?: string;
}

// owner: alnum + hyphen; repo: alnum + . _ - (strip trailing .git)
const GITHUB_HOST = /^(www\.)?github\.com$/i;

export function validateGitHubUrl(input: string): ValidationResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: "No repository URL provided." };

  // Accept "owner/repo" shorthand.
  const shorthand = raw.match(/^([\w-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (shorthand && !raw.includes("://") && !raw.includes("github.com")) {
    const [, owner, repo] = shorthand;
    return build(owner, repo);
  }

  let url: URL;
  try {
    // Normalize scp-like git@github.com:owner/repo to a URL we can parse.
    const normalized = raw.startsWith("git@")
      ? "https://" + raw.slice(4).replace(":", "/")
      : raw.replace(/^http:\/\//i, "https://");
    url = new URL(normalized);
  } catch {
    return { ok: false, error: "Not a valid URL." };
  }

  if (!GITHUB_HOST.test(url.hostname)) {
    return { ok: false, error: "Only github.com repositories are supported." };
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    return { ok: false, error: "URL must include an owner and repository." };
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  return build(owner, repo);
}

function build(owner: string, repo: string): ValidationResult {
  if (!/^[\w-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    return { ok: false, error: "Invalid owner or repository name." };
  }
  return {
    ok: true,
    repo: {
      owner,
      repo,
      slug: `${owner}/${repo}`,
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
    },
  };
}

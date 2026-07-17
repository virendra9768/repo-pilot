"use client";

/** Per-browser list of recently analyzed repos (localStorage). */
export interface RecentRepo {
  id: string;
  name: string;
  source: string;
  at: number;
}

const KEY = "repopilot:recent-repos";
const CAP = 12;

export function readLocalRecents(): RecentRepo[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentRepo[]) : [];
  } catch {
    return [];
  }
}

export function pushLocalRecent(entry: Omit<RecentRepo, "at">): RecentRepo[] {
  const next = [
    { ...entry, at: Date.now() },
    ...readLocalRecents().filter((r) => r.id !== entry.id),
  ].slice(0, CAP);
  write(next);
  return next;
}

export function removeLocalRecent(id: string): RecentRepo[] {
  const next = readLocalRecents().filter((r) => r.id !== id);
  write(next);
  return next;
}

export function clearLocalRecents(): void {
  write([]);
}

function write(list: RecentRepo[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore quota/availability errors */
  }
}

import {
  Atom,
  Boxes,
  Braces,
  CreditCard,
  Database,
  DoorOpen,
  FileCode2,
  Flame,
  Layers,
  Leaf,
  type LucideIcon,
  Network,
  Puzzle,
  Server,
  Settings2,
  Shield,
  Waypoints,
  Wind,
  Zap,
} from "lucide-react";

/** Map a detected technology name to a representative Lucide icon. */
export function techIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("next")) return Layers;
  if (n.includes("react")) return Atom;
  if (n.includes("prisma")) return Database;
  if (n.includes("tailwind")) return Wind;
  if (n.includes("typescript") || n.includes("javascript")) return Braces;
  if (n.includes("nest")) return Boxes;
  if (n.includes("express")) return Server;
  if (n.includes("postgres")) return Database;
  if (n.includes("mongo")) return Leaf;
  if (n.includes("redis")) return Zap;
  if (n.includes("firebase")) return Flame;
  if (n.includes("stripe")) return CreditCard;
  return Boxes;
}

export interface NodeCategory {
  label: string;
  Icon: LucideIcon;
  /** Tailwind gradient classes for the node header. */
  gradient: string;
  /** Accent text/icon color class. */
  color: string;
  /** Minimap dot color. */
  dot: string;
}

/**
 * Refine an AI node type + file path into a richer, well-iconed category —
 * client-side only, no backend change. Subtle, distinct colors per category.
 */
export function nodeCategory(type: string, file: string): NodeCategory {
  const f = file.toLowerCase();

  if (type === "model" || /schema\.prisma|\.entity\.|models?\//.test(f)) {
    return cat("Database", Database, "from-amber-500/25 to-amber-500/5", "text-amber-300", "#f59e0b");
  }
  if (type === "route" || /\/api\/|route\.(t|j)s/.test(f)) {
    return cat("API Route", Waypoints, "from-blue-500/25 to-blue-500/5", "text-blue-300", "#3b82f6");
  }
  if (/middleware/.test(f)) {
    return cat("Middleware", Shield, "from-rose-500/25 to-rose-500/5", "text-rose-300", "#f43f5e");
  }
  if (type === "service" || /service|\/lib\/|controller/.test(f)) {
    return cat("Service", Settings2, "from-violet-500/25 to-violet-500/5", "text-violet-300", "#8b5cf6");
  }
  if (/utils?|helpers?|\/query/.test(f)) {
    return cat("Utility", Puzzle, "from-teal-500/25 to-teal-500/5", "text-teal-300", "#14b8a6");
  }
  if (/\.tsx$|components?\//.test(f)) {
    return cat("Component", Atom, "from-cyan-500/25 to-cyan-500/5", "text-cyan-300", "#22d3ee");
  }
  if (type === "entry") {
    return cat("Entry", DoorOpen, "from-emerald-500/25 to-emerald-500/5", "text-emerald-300", "#10b981");
  }
  if (type === "external") {
    return cat("External", Network, "from-zinc-500/25 to-zinc-500/5", "text-zinc-300", "#a1a1aa");
  }
  return cat("File", FileCode2, "from-zinc-500/25 to-zinc-500/5", "text-zinc-300", "#a1a1aa");
}

function cat(
  label: string,
  Icon: LucideIcon,
  gradient: string,
  color: string,
  dot: string,
): NodeCategory {
  return { label, Icon, gradient, color, dot };
}

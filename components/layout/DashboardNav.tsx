"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, ListOrdered, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { seg: "", label: "Overview", icon: LayoutDashboard },
  { seg: "/start-here", label: "Start Here", icon: ListOrdered },
  { seg: "/flow", label: "Execution Flow", icon: Workflow },
];

export function DashboardNav({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/r/${id}`;

  return (
    <nav className="inline-flex gap-1 rounded-xl border border-border bg-card p-1">
      {ITEMS.map((item) => {
        const href = base + item.seg;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              active ? "text-accent-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active-pill"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-lg bg-accent shadow-[0_6px_20px_-8px_var(--accent-glow)]"
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <item.icon className="h-4 w-4" />
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

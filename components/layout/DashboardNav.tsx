"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    <nav className="inline-flex gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
      {ITEMS.map((item) => {
        const href = base + item.seg;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

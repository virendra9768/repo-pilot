"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DashboardNav({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/r/${id}`;
  const items = [
    { href: base, label: "Overview" },
    { href: `${base}/start-here`, label: "Start Here" },
    { href: `${base}/flow`, label: "Execution Flow" },
  ];

  return (
    <nav className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

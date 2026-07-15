import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Cog, Database, FileCode2, Globe, LogIn, Route, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FlowNodeData {
  title: string;
  kind: string;
  file: string;
  unknown: boolean;
  [key: string]: unknown;
}

const KIND: Record<string, { icon: typeof Cog; chip: string }> = {
  entry: { icon: LogIn, chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  route: { icon: Route, chip: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
  handler: { icon: Cog, chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400" },
  service: { icon: Wrench, chip: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400" },
  model: { icon: Database, chip: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  file: { icon: FileCode2, chip: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  external: { icon: Globe, chip: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400" },
};

export function FlowNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const meta = KIND[d.kind] ?? KIND.file;
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "w-60 rounded-xl border bg-card p-3 shadow-sm transition-all",
        selected
          ? "border-accent ring-2 ring-accent"
          : "border-border hover:border-accent/50",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-muted-foreground" />
      <div className="flex items-center gap-2">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", meta.chip)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {d.kind}
        </span>
      </div>
      <div className="mt-2 text-sm font-medium leading-snug text-foreground">{d.title}</div>
      {d.file && (
        <div
          className={cn(
            "mt-1 truncate font-mono text-[11px]",
            d.unknown ? "text-rose-500" : "text-muted-foreground",
          )}
          title={d.file}
        >
          {d.file}
          {d.unknown ? " ·unverified" : ""}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-muted-foreground" />
    </div>
  );
}

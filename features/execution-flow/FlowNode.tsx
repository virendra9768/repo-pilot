import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

export interface FlowNodeData {
  title: string;
  kind: string;
  file: string;
  unknown: boolean;
  [key: string]: unknown;
}

const KIND_COLOR: Record<string, string> = {
  entry: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  route: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  handler: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  service: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  model: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  file: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  external: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

export function FlowNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <div
      className={cn(
        "w-56 rounded-lg border bg-white p-3 shadow-sm transition-all dark:bg-neutral-950",
        selected
          ? "border-neutral-900 ring-2 ring-neutral-900 dark:border-white dark:ring-white"
          : "border-neutral-300 dark:border-neutral-700",
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-neutral-400" />
      <span
        className={cn(
          "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          KIND_COLOR[d.kind] ?? KIND_COLOR.file,
        )}
      >
        {d.kind}
      </span>
      <div className="mt-1.5 text-sm font-medium leading-snug">{d.title}</div>
      {d.file && (
        <div
          className={cn(
            "mt-1 truncate text-[11px]",
            d.unknown ? "text-rose-500" : "text-neutral-500",
          )}
          title={d.file}
        >
          {d.file}
          {d.unknown ? " (unverified)" : ""}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-neutral-400" />
    </div>
  );
}

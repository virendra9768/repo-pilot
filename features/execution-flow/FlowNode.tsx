import { Handle, Position, type NodeProps } from "@xyflow/react";
import { nodeCategory } from "@/components/shared/icons";
import { cn } from "@/lib/utils";

export interface FlowNodeData {
  title: string;
  kind: string;
  file: string;
  unknown: boolean;
  selected: boolean;
  index: number;
  [key: string]: unknown;
}

export function FlowNode({ data }: NodeProps) {
  const d = data as FlowNodeData;
  const cat = nodeCategory(d.kind, d.file);
  const Icon = cat.Icon;

  return (
    <div
      style={{
        animation: "rp-fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both",
        animationDelay: `${(d.index ?? 0) * 0.07}s`,
      }}
      className={cn(
        "w-60 overflow-hidden rounded-2xl border bg-card transition-shadow",
        d.selected
          ? "border-accent/70 shadow-[0_0_0_1px_var(--accent),0_0_36px_-8px_var(--accent-glow)]"
          : "border-border shadow-[0_12px_30px_-20px_rgba(0,0,0,0.9)]",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-1.5 !w-1.5 !border-0 !bg-faint"
      />
      <div className={cn("flex items-center gap-2 bg-linear-to-r px-3 py-2", cat.gradient)}>
        <Icon className={cn("h-3.5 w-3.5", cat.color)} />
        <span className={cn("text-[10px] font-semibold uppercase tracking-[0.06em]", cat.color)}>
          {cat.label}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-sm font-medium leading-snug text-foreground">{d.title}</div>
        {d.file && (
          <div
            className={cn(
              "mt-1 truncate font-mono text-[11px]",
              d.unknown ? "text-rose-400" : "text-muted-foreground",
            )}
            title={d.file}
          >
            {d.file}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-1.5 !w-1.5 !border-0 !bg-faint"
      />
    </div>
  );
}

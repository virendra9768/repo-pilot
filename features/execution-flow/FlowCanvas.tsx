"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ExecutionFlowResult } from "@/engine/prompts/executionFlow";
import { nodeCategory } from "@/components/shared/icons";
import { FlowNode } from "./FlowNode";
import { computeLayout } from "./layout";

export interface FocusTarget {
  id: string;
  nonce: number;
}

export function FlowCanvas({
  result,
  unknown,
  selectedId,
  onSelect,
  focusTarget,
}: {
  result: ExecutionFlowResult;
  unknown: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  focusTarget: FocusTarget | null;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const nodeTypes = useMemo(() => ({ flow: FlowNode }), []);
  const instance = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const layoutRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Build nodes/edges when the result changes. Selection highlight is applied
  // by the effect below (selectedId is reset to null whenever a result loads).
  useEffect(() => {
    const layout = computeLayout(result.nodes, result.edges);
    layoutRef.current = layout;
    const ids = new Set(result.nodes.map((n) => n.id));
    setNodes(
      result.nodes.map((n, i) => ({
        id: n.id,
        type: "flow",
        position: layout.get(n.id) ?? { x: 0, y: 0 },
        data: {
          title: n.title,
          kind: n.type,
          file: n.file,
          unknown: n.file !== "" && unknown.has(n.file),
          selected: false,
          index: i,
        },
      })),
    );
    setEdges(
      result.edges
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e, i) => ({
          id: `e${i}`,
          source: e.source,
          target: e.target,
          label: e.label || undefined,
          type: "default",
          animated: true,
          style: { stroke: "var(--accent)", strokeWidth: 1.5, opacity: 0.6 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "var(--accent)" },
          labelStyle: { fill: "var(--foreground)", fontSize: 11, fontWeight: 500 },
          labelShowBg: true,
          labelBgPadding: [8, 4] as [number, number],
          labelBgBorderRadius: 6,
          labelBgStyle: { fill: "var(--card)", stroke: "var(--border)", strokeWidth: 1, fillOpacity: 0.96 },
        })),
    );
  }, [result, unknown, setNodes, setEdges]);

  // Update selection highlight without disturbing positions.
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, selected: n.id === selectedId } })),
    );
    setEdges((eds) =>
      eds.map((e) => {
        const on = e.source === selectedId || e.target === selectedId;
        return {
          ...e,
          style: { stroke: "var(--accent)", strokeWidth: on ? 2.4 : 1.5, opacity: on ? 1 : 0.45 },
        };
      }),
    );
  }, [selectedId, setNodes, setEdges]);

  // Focus a node when requested from the detail panel.
  useEffect(() => {
    if (!focusTarget || !instance.current) return;
    const pos = layoutRef.current.get(focusTarget.id);
    if (pos) instance.current.setCenter(pos.x + 120, pos.y + 40, { zoom: 1.35, duration: 600 });
  }, [focusTarget]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onInit={(inst) => (instance.current = inst)}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      nodeTypes={nodeTypes}
      colorMode="dark"
      fitView
      fitViewOptions={{ padding: 0.25 }}
      minZoom={0.3}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        maskColor="rgba(9,9,9,0.6)"
        nodeColor={(n) =>
          nodeCategory(String(n.data?.kind ?? ""), String(n.data?.file ?? "")).dot
        }
        style={{ background: "var(--card)" }}
      />
    </ReactFlow>
  );
}

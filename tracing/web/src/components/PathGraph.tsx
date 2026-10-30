import { useMemo } from "react";
import { Background, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { clock, type PathNode, type TraceResult } from "../api";
import { Icon } from "./Ui";

const STEP = 262;
const WIDTH = 214;
const HEIGHT = 158;
const MIN_COLUMN = 210;

function PersonNode({ data }: NodeProps) {
  const { node, origin } = data as { node: PathNode; origin: boolean };
  return (
    <div className={`pnode ${node.external ? "pnode-ext" : ""}`} style={{ width: WIDTH }}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="pnode-head">
        <span className="pnode-icon"><Icon name={node.external ? "building" : origin ? "doc" : "user"} size={20} /></span>
        <div><b>{node.actor.name}</b><small>{origin ? "원본 작성자" : node.actor.org}</small></div>
      </div>
      <div className="pnode-time mono">{clock(node.at_kst)}</div>
      <div className="pnode-meta">기기 {node.actor.device ?? "미상"}</div>
      <div className="pnode-meta">{node.actor.phone ?? (node.reopened_kst.length > 0 ? `다시 열람 ${node.reopened_kst.length}회` : "사내 계정")}</div>
      <div className="pnode-sig"><Icon name="check" size={14} /> 서명 검증</div>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

function BrokenNode({ data }: NodeProps) {
  const { lines } = data as { lines: number };
  return (
    <div className="pnode pnode-broken" style={{ width: WIDTH }}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="pnode-head">
        <span className="pnode-icon"><Icon name="unlink" size={20} /></span>
        <div><b>연결 끊김</b><small>삭제 의심</small></div>
      </div>
      <div className="pnode-meta">여기부터 장부 {lines}줄은 신뢰하지 않습니다.</div>
    </div>
  );
}

function Boundary() {
  return <div className="boundary"><span>사내 / 외부 경계</span></div>;
}

const nodeTypes = { person: PersonNode, broken: BrokenNode, boundary: Boundary };

export default function PathGraph({ result }: { result: TraceResult }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = result.path.map((p, i) => ({
      id: `n${i}`, type: "person", position: { x: i * STEP, y: 0 }, data: { node: p, origin: i === 0 },
      draggable: false, selectable: false,
    }));
    const edges: Edge[] = result.path.slice(1).map((p, i) => {
      const leak = p.external && !result.path[i].external;
      const color = leak ? "#dc2626" : "#94a3b8";
      return {
        id: `e${i}`, source: `n${i}`, target: `n${i + 1}`, animated: leak,
        style: { stroke: color, strokeWidth: leak ? 2.5 : 1.75 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    });

    const leakAt = result.path.findIndex((p, i) => i > 0 && p.external && !result.path[i - 1].external);
    if (leakAt > 0) {
      nodes.push({
        id: "boundary", type: "boundary", position: { x: leakAt * STEP - (STEP - WIDTH) / 2 - 1, y: -30 },
        data: {}, draggable: false, selectable: false, zIndex: -1,
      });
    }
    if (result.untrusted.length > 0 && result.path.length > 0) {
      const i = result.path.length;
      nodes.push({ id: "broken", type: "broken", position: { x: i * STEP, y: 0 }, data: { lines: result.untrusted.length }, draggable: false, selectable: false });
      edges.push({
        id: "e-broken", source: `n${i - 1}`, target: "broken",
        style: { stroke: "#d97706", strokeWidth: 1.75, strokeDasharray: "6 5" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#d97706" },
      });
    }
    return { nodes, edges };
  }, [result]);
  const columns = nodes.filter((n) => n.type !== "boundary").length;

  return (
    <div className="graph-scroll">
      <div className="graph" style={{ height: HEIGHT + 110, minWidth: columns * MIN_COLUMN }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.08, maxZoom: 1 }}
          nodesConnectable={false} nodesDraggable={false} elementsSelectable={false} panOnDrag={false}
          zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false} proOptions={{ hideAttribution: true }}>
          <Background gap={24} color="#e8eef8" />
        </ReactFlow>
      </div>
    </div>
  );
}

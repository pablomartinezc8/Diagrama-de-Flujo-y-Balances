/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Link2,
  Maximize2,
  Plus,
  Sliders,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
   EQUIPMENT_CATALOG,
  EquipmentCatalogItem,
} from '../data/initialProjects';
import {
  EquipmentCategory,
  EquipmentNode,
  Flowsheet,
  NodeBalanceDiagnostics,
  StreamEdge,
  StreamFlowData,
} from '../types/process';
import { computeDerivedSlurryProperties } from '../utils/massBalanceMath';
import { EquipmentSymbolSvg } from './EquipmentSymbols';

interface FlowsheetWorkspaceProps {
  flowsheet: Flowsheet;
  diagnostics: NodeBalanceDiagnostics[];
  onUpdateFlowsheet: (updated: Flowsheet) => void;
  onAutoReconcile: () => void;
}

const CATEGORIES: EquipmentCategory[] = [
  'Comminución',
  'Separación y Concentración',
  'Manejo de Sólidos/Líquidos',
  'Bloques Genéricos',
];

export const FlowsheetWorkspace: React.FC<FlowsheetWorkspaceProps> = ({
  flowsheet,
  diagnostics,
  onUpdateFlowsheet,
  onAutoReconcile,
}) => {
  const [activeCategory, setActiveCategory] = useState<EquipmentCategory>('Comminución');
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(
    flowsheet.edges[0]?.id ?? null
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingSourceNodeId, setConnectingSourceNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [calcMode, setCalcMode] = useState<'from_solids_and_cp' | 'from_solids_and_water'>(
    'from_solids_and_cp'
  );

  // Dragging state for equipment nodes on canvas
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const selectedStream = flowsheet.edges.find((e) => e.id === selectedStreamId) ?? null;
  const selectedNode = flowsheet.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedNodeDiag = diagnostics.find((d) => d.nodeId === selectedNodeId) ?? null;

  const diagMap = new Map(diagnostics.map((d) => [d.nodeId, d]));
  const nodeMap = new Map(flowsheet.nodes.map((n) => [n.id, n]));

  // Añadir equipo desde la paleta (por clic o por Drag & Drop)
  const handleAddEquipment = (item: EquipmentCatalogItem, posX?: number, posY?: number) => {
    const existingOfPrefix = flowsheet.nodes.filter((n) =>
      n.tag.startsWith(item.prefix)
    ).length;
    const nextNumber = 101 + existingOfPrefix + flowsheet.nodes.length;
    const newNode: EquipmentNode = {
      id: `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tag: `${item.prefix}-${nextNumber}`,
      type: item.type,
      category: item.category,
      name: item.name,
      position_x: posX ?? 380 + ((flowsheet.nodes.length * 45) % 450),
      position_y: posY ?? 150 + ((flowsheet.nodes.length * 35) % 220),
      parameters: { ...item.defaultParams },
    };

    onUpdateFlowsheet({
      ...flowsheet,
      nodes: [...flowsheet.nodes, newNode],
    });
    setSelectedNodeId(newNode.id);
    setSelectedStreamId(null);
  };

  // Drag & Drop desde la paleta izquierda hacia el lienzo
  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rawType = e.dataTransfer.getData('application/minflow-equipment');
    if (!rawType) return;
    const catalogItem = EQUIPMENT_CATALOG.find((c) => c.type === rawType);
    if (!catalogItem || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(20, Math.round((e.clientX - rect.left) / zoom - 95));
    const y = Math.max(20, Math.round((e.clientY - rect.top) / zoom - 42));
    handleAddEquipment(catalogItem, x, y);
  };

  // Movimiento de nodos dentro del lienzo PFD
  const handleNodeMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    node: EquipmentNode
  ) => {
    e.stopPropagation();
    if (connectingSourceNodeId) {
      if (connectingSourceNodeId !== node.id) {
        handleCreateStreamConnection(connectingSourceNodeId, node.id);
      }
      setConnectingSourceNodeId(null);
      return;
    }

    setSelectedNodeId(node.id);
    setSelectedStreamId(null);

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggingNodeId(node.id);
    setDragOffset({
      x: (e.clientX - rect.left) / zoom - node.position_x,
      y: (e.clientY - rect.top) / zoom - node.position_y,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingNodeId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nextX = Math.max(16, Math.round((e.clientX - rect.left) / zoom - dragOffset.x));
    const nextY = Math.max(16, Math.round((e.clientY - rect.top) / zoom - dragOffset.y));

    onUpdateFlowsheet({
      ...flowsheet,
      nodes: flowsheet.nodes.map((n) =>
        n.id === draggingNodeId ? { ...n, position_x: nextX, position_y: nextY } : n
      ),
    });
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Crear nueva corriente (StreamEdge) entre dos equipos
  const handleCreateStreamConnection = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const nextIdx = flowsheet.edges.length + 1;
    const streamId = `STR-${String(nextIdx).padStart(3, '0')}`;
    const srcNode = nodeMap.get(sourceId);
    const tgtNode = nodeMap.get(targetId);

    const newEdge: StreamEdge = {
      id: streamId,
      name: `Flujo ${srcNode?.tag ?? ''} → ${tgtNode?.tag ?? ''}`,
      source_node_id: sourceId,
      target_node_id: targetId,
      stream_type: 'slurry',
      flow_data: computeDerivedSlurryProperties(
        {
          solids_tph: 500,
          percent_solids: 60,
          solid_sg: 2.75,
          liquid_sg: 1.0,
          reagent_dosage_gpt: 15,
          assay: { cu_pct: 0.85, au_gpt: 0.35, li_pct: 0, fe_pct: 3.5, mo_pct: 0.02 },
        },
        'from_solids_and_cp'
      ),
    };

    onUpdateFlowsheet({
      ...flowsheet,
      edges: [...flowsheet.edges, newEdge],
    });
    setSelectedStreamId(newEdge.id);
    setSelectedNodeId(null);
  };

  // Actualizar variables metalúrgicas de una corriente seleccionada
  const handleStreamDataChange = (
    field: keyof StreamFlowData | 'cu_pct' | 'au_gpt' | 'li_pct' | 'fe_pct',
    rawValue: number,
    explicitMode?: 'from_solids_and_cp' | 'from_solids_and_water'
  ) => {
    if (!selectedStream) return;
    const modeToUse = explicitMode ?? calcMode;

    const currentData = selectedStream.flow_data;
    let nextDraft: Partial<StreamFlowData> = { ...currentData };

    if (field === 'cu_pct' || field === 'au_gpt' || field === 'li_pct' || field === 'fe_pct') {
      nextDraft.assay = {
        ...currentData.assay,
        [field]: rawValue,
      };
    } else {
      nextDraft = {
        ...currentData,
        [field]: rawValue,
      };
    }

    const recalculated = computeDerivedSlurryProperties(nextDraft, modeToUse);

    onUpdateFlowsheet({
      ...flowsheet,
      edges: flowsheet.edges.map((edge) =>
        edge.id === selectedStream.id ? { ...edge, flow_data: recalculated } : edge
      ),
    });
  };

  const handleDeleteSelectedStream = () => {
    if (!selectedStream) return;
    const remaining = flowsheet.edges.filter((e) => e.id !== selectedStream.id);
    onUpdateFlowsheet({
      ...flowsheet,
      edges: remaining,
    });
    setSelectedStreamId(remaining[0]?.id ?? null);
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNode) return;
    const remainingNodes = flowsheet.nodes.filter((n) => n.id !== selectedNode.id);
    const remainingEdges = flowsheet.edges.filter(
      (e) => e.source_node_id !== selectedNode.id && e.target_node_id !== selectedNode.id
    );
    onUpdateFlowsheet({
      ...flowsheet,
      nodes: remainingNodes,
      edges: remainingEdges,
    });
    setSelectedNodeId(null);
    setSelectedStreamId(remainingEdges[0]?.id ?? null);
  };

  // Estadísticas globales de cierre del diagrama
  const internalDiagnostics = diagnostics.filter((d) => !d.isBoundary);
  const unbalancedNodesCount = internalDiagnostics.filter((d) => !d.isBalanced).length;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-57px)] overflow-hidden bg-slate-950">
      {/* COLUMNA IZQUIERDA (310px): Paleta Drag & Drop de Equipos Industriales */}
      <aside className="w-full lg:w-[310px] shrink-0 bg-slate-900/90 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col max-h-[38vh] lg:max-h-none overflow-hidden">
        <div className="p-3.5 border-b border-slate-800">
          <div className="text-[11px] font-mono text-cyan-400 tracking-wide">
            PALETA DE EQUIPOS PFD
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Arrastra al lienzo o haz clic en un equipo para insertarlo en el circuito.
          </p>

          {/* Pestañas de Categorías */}
          <div className="grid grid-cols-2 gap-1 mt-3 bg-slate-950 p-1 rounded border border-slate-800">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2 py-1.5 text-[11px] font-medium rounded text-left truncate transition-colors cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-slate-800 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Equipos de la Categoría Activa */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {EQUIPMENT_CATALOG.filter((item) => item.category === activeCategory).map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/minflow-equipment', item.type);
              }}
              onClick={() => handleAddEquipment(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleAddEquipment(item);
              }}
              aria-label={`Insertar equipo ${item.name}`}
              className="group flex items-start gap-3 p-2.5 rounded bg-slate-950/80 border border-slate-800/90 hover:border-cyan-500/60 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <div className="p-2 rounded bg-slate-900 text-cyan-400 group-hover:bg-cyan-950/60 shrink-0">
                <EquipmentSymbolSvg type={item.type} className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {item.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {item.prefix}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Pie de Paleta: Tolerancia Global y Reconciliador Automático */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="tolerance-input" className="text-slate-400">
              Tolerancia Cierre Nodo:
            </label>
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono text-slate-400">±</span>
              <input
                id="tolerance-input"
                type="number"
                step="0.05"
                min="0.01"
                max="10"
                value={flowsheet.tolerance_pct}
                onChange={(e) =>
                  onUpdateFlowsheet({
                    ...flowsheet,
                    tolerance_pct: Math.max(0.01, Number(e.target.value) || 0.1),
                  })
                }
                className="w-16 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-xs text-cyan-300 tabular-nums"
              />
              <span className="text-xs font-mono text-slate-400">%</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onAutoReconcile}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            Balancear Nodos Automáticamente
          </button>
        </div>
      </aside>

      {/* CENTRO (Flex-1): Lienzo Interactivo PFD (Canvas) */}
      <section className="flex-1 flex flex-col min-w-0 relative bg-slate-950 overflow-hidden">
        {/* Sub-barra de Herramientas del Lienzo PFD */}
        <div className="h-11 px-4 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 overflow-x-auto">
            {/* Estado de Cierre del Flowsheet */}
            {unbalancedNodesCount === 0 ? (
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 whitespace-nowrap">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>CIERRE DE BALANCE: NOMINAL (ΣE = ΣS)</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-rose-400 whitespace-nowrap">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  ALERTA DE CIERRE: {unbalancedNodesCount} NODO(S) FUERA DE TOLERANCIA (±
                  {flowsheet.tolerance_pct}%)
                </span>
              </div>
            )}

            <span className="text-slate-700" aria-hidden="true">
              |
            </span>

            {/* Modo Conector de Corrientes */}
            {connectingSourceNodeId ? (
              <div className="flex items-center gap-2 text-xs text-amber-300 font-mono">
                <span>
                  Haz clic en el equipo de destino para conectar desde{' '}
                  {nodeMap.get(connectingSourceNodeId)?.tag}...
                </span>
                <button
                  type="button"
                  onClick={() => setConnectingSourceNodeId(null)}
                  className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-400 hidden xl:inline">
                Haz clic en una corriente <strong className="text-slate-200">STR-###</strong> para
                editar su pulpa o arrastra los equipos para organizar el diagrama.
              </span>
            )}
          </div>

          {/* Controles de Zoom y Selección Rápida */}
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              aria-label="Seleccionar corriente rápidamente"
              value={selectedStreamId ?? ''}
              onChange={(e) => {
                setSelectedStreamId(e.target.value || null);
                setSelectedNodeId(null);
              }}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="">-- Seleccionar Corriente --</option>
              {flowsheet.edges.map((edge) => (
                <option key={edge.id} value={edge.id}>
                  {edge.id}: {edge.name} ({edge.flow_data.solids_tph} t/h)
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.65, +(z - 0.1).toFixed(2)))}
              aria-label="Reducir zoom del lienzo"
              className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-950 border border-slate-800 rounded cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono text-slate-300 w-12 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.35, +(z + 0.1).toFixed(2)))}
              aria-label="Aumentar zoom del lienzo"
              className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-950 border border-slate-800 rounded cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              aria-label="Restablecer zoom 100%"
              className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-950 border border-slate-800 rounded cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Superficie del Lienzo con Grilla Técnica PFD */}
        <div
          ref={canvasRef}
          data-testid="pfd-canvas-surface"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="flex-1 overflow-auto bg-pfd-grid bg-pfd-grid-major relative select-none cursor-crosshair"
        >
          <div
            className="relative min-w-[1480px] min-h-[580px] origin-top-left transition-transform duration-75"
            style={{ transform: `scale(${zoom})` }}
          >
            {/* CAPA SVG: Líneas Ortogonales de Corrientes (Streams) */}
            <svg
              className="absolute inset-0 w-[1480px] h-[580px] pointer-events-none"
              viewBox="0 0 1480 580"
            >
              <defs>
                <marker
                  id="arrow-slurry"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#94a3b8" />
                </marker>
                <marker
                  id="arrow-selected"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#22d3ee" />
                </marker>
                <marker
                  id="arrow-water"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#38bdf8" />
                </marker>
                <marker
                  id="arrow-conc"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#10b981" />
                </marker>
              </defs>

              {flowsheet.edges.map((edge, idx) => {
                const src = nodeMap.get(edge.source_node_id);
                const tgt = nodeMap.get(edge.target_node_id);
                if (!src || !tgt) return null;

                const x1 = src.position_x + 196;
                const y1 = src.position_y + 42;
                const x2 = tgt.position_x;
                const y2 = tgt.position_y + 42;

                // Enrutamiento ortogonal limpio
                const midX = Math.round((x1 + x2) / 2 + ((idx % 3) - 1) * 8);
                const pathD =
                  x2 >= x1 - 10
                    ? `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
                    : `M ${x1} ${y1} L ${x1 + 25} ${y1} L ${x1 + 25} ${Math.max(y1, y2) + 70} L ${
                        x2 - 25
                      } ${Math.max(y1, y2) + 70} L ${x2 - 25} ${y2} L ${x2} ${y2}`;

                const isSelected = edge.id === selectedStreamId;
                const strokeColor = isSelected
                  ? '#22d3ee'
                  : edge.stream_type === 'water'
                  ? '#38bdf8'
                  : edge.stream_type === 'concentrate'
                  ? '#10b981'
                  : edge.stream_type === 'tailings'
                  ? '#f59e0b'
                  : '#94a3b8';

                const markerId = isSelected
                  ? 'url(#arrow-selected)'
                  : edge.stream_type === 'water'
                  ? 'url(#arrow-water)'
                  : edge.stream_type === 'concentrate'
                  ? 'url(#arrow-conc)'
                  : 'url(#arrow-slurry)';

                return (
                  <g key={edge.id} className="pointer-events-auto">
                    {/* Trazo ancho invisible para facilitar el clic sobre la corriente */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="16"
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedStreamId(edge.id);
                        setSelectedNodeId(null);
                      }}
                    />
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3.2 : 2.2}
                      strokeDasharray={edge.stream_type === 'water' ? '5 3' : undefined}
                      markerEnd={markerId}
                      className="transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedStreamId(edge.id);
                        setSelectedNodeId(null);
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* ETIQUETAS INTERACTIVAS DE CORRIENTE (STR-001, STR-002...) */}
            {flowsheet.edges.map((edge, idx) => {
              const src = nodeMap.get(edge.source_node_id);
              const tgt = nodeMap.get(edge.target_node_id);
              if (!src || !tgt) return null;

              const x1 = src.position_x + 196;
              const y1 = src.position_y + 42;
              const x2 = tgt.position_x;
              const y2 = tgt.position_y + 42;
              const midX = Math.round((x1 + x2) / 2 + ((idx % 3) - 1) * 8);
              const midY = Math.round((y1 + y2) / 2);

              const isSelected = edge.id === selectedStreamId;

              return (
                <button
                  key={`tag-${edge.id}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStreamId(edge.id);
                    setSelectedNodeId(null);
                  }}
                  aria-label={`Corriente ${edge.id} ${edge.name}`}
                  style={{
                    left: `${midX - 54}px`,
                    top: `${midY - 22}px`,
                  }}
                  className={`absolute z-10 w-[108px] px-2 py-1 rounded border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-950/95 border-cyan-400 ring-2 ring-cyan-400/30 shadow-md'
                      : 'bg-slate-900/95 border-slate-700 hover:border-cyan-500/70'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className={isSelected ? 'text-cyan-300 font-bold' : 'text-slate-200 font-semibold'}>
                      {edge.id}
                    </span>
                    <span className="text-slate-400 tabular-nums">
                      {edge.flow_data.percent_solids.toFixed(0)}%Cp
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-300 tabular-nums truncate">
                    {edge.flow_data.solids_tph > 0
                      ? `${edge.flow_data.solids_tph.toFixed(0)} t/h`
                      : `${edge.flow_data.water_m3h.toFixed(0)} m³/h`}
                  </div>
                </button>
              );
            })}

            {/* BLOQUES DE EQUIPOS EN EL LIENZO (EquipmentNode) */}
            {flowsheet.nodes.map((node) => {
              const diag = diagMap.get(node.id);
              const isSelected = node.id === selectedNodeId;
              const isConnectingSource = node.id === connectingSourceNodeId;

              // Color de estado de cierre de balance en el nodo (Rojo / Ámbar / Verde / Frontera)
              const statusBorder =
                diag?.status === 'unbalanced'
                  ? 'border-rose-500/90'
                  : diag?.status === 'warning'
                  ? 'border-amber-500/90'
                  : diag?.status === 'balanced'
                  ? 'border-emerald-500/70'
                  : 'border-slate-700';

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  style={{
                    left: `${node.position_x}px`,
                    top: `${node.position_y}px`,
                  }}
                  className={`absolute w-[196px] rounded-md bg-slate-900/95 border-2 transition-shadow cursor-grab active:cursor-grabbing ${statusBorder} ${
                    isSelected ? 'ring-2 ring-cyan-400 shadow-lg' : ''
                  } ${isConnectingSource ? 'ring-2 ring-amber-400' : ''}`}
                >
                  {/* Barra Superior del Equipo: Tag + Estado de Cierre */}
                  <div className="px-2.5 py-1 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono">
                    <span className="font-bold text-cyan-400">{node.tag}</span>
                    {diag && !diag.isBoundary && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] ${
                          diag.isBalanced ? 'text-emerald-400' : 'text-rose-400 font-semibold'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            diag.isBalanced ? 'bg-emerald-400' : 'bg-rose-500'
                          }`}
                        />
                        {diag.isBalanced
                          ? 'OK'
                          : `Δ ${Math.max(diag.solidsError_pct, diag.waterError_pct).toFixed(1)}%`}
                      </span>
                    )}
                    {diag?.isBoundary && (
                      <span className="text-[10px] text-slate-400">
                        {node.type === 'feed_source' ? 'ENTRADA' : 'SALIDA'}
                      </span>
                    )}
                  </div>

                  {/* Cuerpo Principal: Símbolo PFD + Nombre Equipo */}
                  <div className="p-2.5 flex items-center gap-2.5">
                    <div className="p-1.5 rounded bg-slate-950 text-slate-200 border border-slate-800 shrink-0">
                      <EquipmentSymbolSvg type={node.type} className="w-7 h-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-100 leading-tight truncate">
                        {node.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {node.category}
                      </div>
                    </div>
                  </div>

                  {/* Barra Inferior del Nodo: Botón Conectar Salida + Resumen Flujo */}
                  <div className="px-2.5 py-1 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="tabular-nums">
                      E:{diag?.inCount ?? 0} · S:{diag?.outCount ?? 0}
                    </span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnectingSourceNodeId(
                          connectingSourceNodeId === node.id ? null : node.id
                        );
                      }}
                      title={`Conectar nueva corriente de salida desde ${node.tag}`}
                      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>Conectar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* COLUMNA DERECHA (380px): Inspector de Balance de Masa por Corriente / Nodo */}
      <aside className="w-full lg:w-[380px] shrink-0 bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col overflow-y-auto">
        {selectedStream ? (
          <div className="p-4 space-y-5">
            {/* Encabezado del Inspector de Corriente */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                  <span>CORRIENTE {selectedStream.id}</span>
                  <span>·</span>
                  <span className="uppercase">{selectedStream.stream_type}</span>
                </div>
                <input
                  type="text"
                  aria-label="Nombre de la corriente seleccionada"
                  value={selectedStream.name}
                  onChange={(e) =>
                    onUpdateFlowsheet({
                      ...flowsheet,
                      edges: flowsheet.edges.map((ed) =>
                        ed.id === selectedStream.id ? { ...ed, name: e.target.value } : ed
                      ),
                    })
                  }
                  className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-100 border-b border-transparent hover:border-slate-700 focus:border-cyan-400 focus:outline-none py-0.5"
                />
                <div className="mt-1 flex items-center gap-1.5 text-xs font-mono text-slate-400">
                  <span>{nodeMap.get(selectedStream.source_node_id)?.tag ?? 'Origen'}</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span>{nodeMap.get(selectedStream.target_node_id)?.tag ?? 'Destino'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDeleteSelectedStream}
                aria-label={`Eliminar corriente ${selectedStream.id}`}
                title="Eliminar corriente"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Selector de Modo de Auto-Cálculo de Pulpa */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono text-slate-400">
                MODO DE AUTO-CÁLCULO DE PULPA
              </div>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCalcMode('from_solids_and_cp')}
                  className={`px-2 py-1.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                    calcMode === 'from_solids_and_cp'
                      ? 'bg-slate-800 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Fijar Sólidos + %Cp
                </button>
                <button
                  type="button"
                  onClick={() => setCalcMode('from_solids_and_water')}
                  className={`px-2 py-1.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                    calcMode === 'from_solids_and_water'
                      ? 'bg-slate-800 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Fijar Sólidos + Agua
                </button>
              </div>
            </div>

            {/* Variables Físicas Primarias de la Corriente */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Variables de Flujo Másico y Pulpa
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="input-solids-tph"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Flujo Sólidos (t/h)
                  </label>
                  <input
                    id="input-solids-tph"
                    type="number"
                    step="10"
                    min="0"
                    value={selectedStream.flow_data.solids_tph}
                    onChange={(e) =>
                      handleStreamDataChange('solids_tph', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-cp-pct"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    % Sólidos Peso (%Cp)
                  </label>
                  <input
                    id="input-cp-pct"
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={selectedStream.flow_data.percent_solids}
                    onChange={(e) =>
                      handleStreamDataChange(
                        'percent_solids',
                        parseFloat(e.target.value) || 0,
                        'from_solids_and_cp'
                      )
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-cyan-300 tabular-nums focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-water-m3h"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Flujo Agua / Sol. (m³/h)
                  </label>
                  <input
                    id="input-water-m3h"
                    type="number"
                    step="5"
                    min="0"
                    value={selectedStream.flow_data.water_m3h}
                    onChange={(e) =>
                      handleStreamDataChange(
                        'water_m3h',
                        parseFloat(e.target.value) || 0,
                        'from_solids_and_water'
                      )
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-sky-300 tabular-nums focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-solid-sg"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    GE Mineral Seco (t/m³)
                  </label>
                  <input
                    id="input-solid-sg"
                    type="number"
                    step="0.05"
                    min="1.2"
                    max="7.5"
                    value={selectedStream.flow_data.solid_sg}
                    onChange={(e) =>
                      handleStreamDataChange('solid_sg', parseFloat(e.target.value) || 2.75)
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-200 tabular-nums focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Resultados Auto-Calculados de Pulpa */}
              <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-[11px] font-mono text-cyan-400">
                  PROPIEDADES DE PULPA AUTO-CALCULADAS
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <div className="text-[10px] text-slate-400">Densidad Pulpa</div>
                    <div className="text-sm font-mono font-semibold text-slate-100 tabular-nums">
                      {selectedStream.flow_data.pulp_density.toFixed(3)}
                      <span className="text-[10px] text-slate-400 ml-1">t/m³</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Flujo Pulpa</div>
                    <div className="text-sm font-mono font-semibold text-slate-100 tabular-nums">
                      {selectedStream.flow_data.pulp_mass_tph.toFixed(1)}
                      <span className="text-[10px] text-slate-400 ml-1">t/h</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Caudal Pulpa</div>
                    <div className="text-sm font-mono font-semibold text-slate-100 tabular-nums">
                      {selectedStream.flow_data.pulp_vol_m3h.toFixed(1)}
                      <span className="text-[10px] text-slate-400 ml-1">m³/h</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Leyes de Mineral y Dosificación de Reactivos */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="text-xs font-semibold text-slate-200">
                Leyes Químicas y Reactivos
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="assay-cu" className="block text-[11px] text-slate-400 mb-1">
                    Ley Cobre (% Cu)
                  </label>
                  <input
                    id="assay-cu"
                    type="number"
                    step="0.05"
                    min="0"
                    value={selectedStream.flow_data.assay.cu_pct}
                    onChange={(e) =>
                      handleStreamDataChange('cu_pct', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="assay-au" className="block text-[11px] text-slate-400 mb-1">
                    Ley Oro (g/t Au)
                  </label>
                  <input
                    id="assay-au"
                    type="number"
                    step="0.05"
                    min="0"
                    value={selectedStream.flow_data.assay.au_gpt}
                    onChange={(e) =>
                      handleStreamDataChange('au_gpt', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="assay-li" className="block text-[11px] text-slate-400 mb-1">
                    Ley Litio (% Li)
                  </label>
                  <input
                    id="assay-li"
                    type="number"
                    step="0.05"
                    min="0"
                    value={selectedStream.flow_data.assay.li_pct}
                    onChange={(e) =>
                      handleStreamDataChange('li_pct', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="reagent-gpt" className="block text-[11px] text-slate-400 mb-1">
                    Reactivos (g/t)
                  </label>
                  <input
                    id="reagent-gpt"
                    type="number"
                    step="1"
                    min="0"
                    value={selectedStream.flow_data.reagent_dosage_gpt}
                    onChange={(e) =>
                      handleStreamDataChange(
                        'reagent_dosage_gpt',
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : selectedNode && selectedNodeDiag ? (
          <div className="p-4 space-y-5">
            {/* Inspector de Equipo y Verificación de Cierre de Balance */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs font-mono text-cyan-400">{selectedNode.tag}</div>
                <h3 className="text-sm font-semibold text-slate-100 mt-0.5">
                  {selectedNode.name}
                </h3>
                <div className="text-xs text-slate-400">{selectedNode.category}</div>
              </div>
              <button
                type="button"
                onClick={handleDeleteSelectedNode}
                aria-label={`Eliminar equipo ${selectedNode.tag}`}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Diagnóstico de Conservación de Masa en el Nodo */}
            <div className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300">
                  BALANCE EN NODO (ΣE = ΣS)
                </span>
                <span
                  className={`text-xs font-mono font-semibold ${
                    selectedNodeDiag.isBalanced ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {selectedNodeDiag.isBoundary
                    ? 'FRONTERA SISTEMA'
                    : selectedNodeDiag.isBalanced
                    ? 'CERRADO OK'
                    : 'DESBALANCEADO'}
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Σ Sólidos Entrada:</span>
                  <span className="text-slate-100 tabular-nums">
                    {selectedNodeDiag.solidsIn_tph.toFixed(2)} t/h
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Σ Sólidos Salida:</span>
                  <span className="text-slate-100 tabular-nums">
                    {selectedNodeDiag.solidsOut_tph.toFixed(2)} t/h
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-1">
                  <span className="text-slate-400">Discrepancia Sólidos:</span>
                  <span
                    className={`tabular-nums ${
                      selectedNodeDiag.solidsError_pct <= flowsheet.tolerance_pct
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {selectedNodeDiag.solidsDelta_tph.toFixed(2)} t/h (
                    {selectedNodeDiag.solidsError_pct.toFixed(2)}%)
                  </span>
                </div>

                <div className="flex justify-between pt-2">
                  <span className="text-slate-400">Σ Agua Entrada:</span>
                  <span className="text-sky-300 tabular-nums">
                    {selectedNodeDiag.waterIn_m3h.toFixed(2)} m³/h
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Σ Agua Salida:</span>
                  <span className="text-sky-300 tabular-nums">
                    {selectedNodeDiag.waterOut_m3h.toFixed(2)} m³/h
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-1">
                  <span className="text-slate-400">Discrepancia Agua:</span>
                  <span
                    className={`tabular-nums ${
                      selectedNodeDiag.waterError_pct <= flowsheet.tolerance_pct
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {selectedNodeDiag.waterDelta_m3h.toFixed(2)} m³/h (
                    {selectedNodeDiag.waterError_pct.toFixed(2)}%)
                  </span>
                </div>
              </div>

              {!selectedNodeDiag.isBalanced && !selectedNodeDiag.isBoundary && (
                <button
                  type="button"
                  onClick={onAutoReconcile}
                  className="w-full py-2 px-3 bg-cyan-400 text-slate-950 font-semibold text-xs rounded hover:bg-cyan-300 transition-colors cursor-pointer"
                >
                  Reconciliar Cierre de Nodo Ahora
                </button>
              )}
            </div>

            {/* Crear nueva corriente desde este equipo hacia otro */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-xs font-semibold text-slate-200">
                Conectar Nueva Corriente de Salida
              </div>
              <div className="flex gap-2">
                <select
                  aria-label="Seleccionar equipo destino para nueva corriente"
                  id="quick-target-select"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleCreateStreamConnection(selectedNode.id, e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <option value="">-- Elegir Equipo Destino --</option>
                  {flowsheet.nodes
                    .filter((n) => n.id !== selectedNode.id)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.tag} — {n.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 space-y-2">
            <p>
              Selecciona cualquier corriente <strong className="text-slate-200">STR-###</strong> o
              bloque de equipo en el lienzo PFD para inspeccionar y calcular su balance de masa.
            </p>
          </div>
        )}

        {/* Resumen Rápido de Estado de Todos los Nodos Internos */}
        <div className="mt-auto p-4 border-t border-slate-800 bg-slate-950/60 space-y-2">
          <div className="text-[11px] font-mono text-slate-400">
            VERIFICACIÓN DE CIERRE POR NODO (±{flowsheet.tolerance_pct}%)
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {internalDiagnostics.map((d) => (
              <button
                key={d.nodeId}
                type="button"
                onClick={() => {
                  setSelectedNodeId(d.nodeId);
                  setSelectedStreamId(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-xs font-mono transition-colors cursor-pointer"
              >
                <span className="text-slate-200 truncate">
                  {d.nodeTag} · {d.nodeName.slice(0, 18)}
                </span>
                <span
                  className={`tabular-nums shrink-0 ${
                    d.isBalanced ? 'text-emerald-400' : 'text-rose-400 font-semibold'
                  }`}
                >
                  {d.isBalanced
                    ? '● 0.00% ERR'
                    : `▲ ${Math.max(d.solidsError_pct, d.waterError_pct).toFixed(2)}% ERR`}
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};

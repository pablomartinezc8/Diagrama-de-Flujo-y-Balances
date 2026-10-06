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
  FileSpreadsheet,
  FileText,
  Link2,
  Maximize2,
  PenTool,
  PlusSquare,
  Sliders,
  StickyNote,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  EQUIPMENT_CATALOG,
  EquipmentCatalogItem,
} from '../data/initialProjects';
import {
  CanvasAnnotation,
  EquipmentCategory,
  EquipmentNode,
  Flowsheet,
  NodeBalanceDiagnostics,
  Project,
  StreamEdge,
  StreamFlowData,
} from '../types/process';
import {
  exportFlowsheetToPrintablePdf,
  exportProfessionalExcelSheet,
} from '../utils/exportTools';
import { computeDerivedSlurryProperties } from '../utils/massBalanceMath';
import { EquipmentSymbolSvg } from './EquipmentSymbols';
import { TagingBrandLogo } from './TagingBrandLogo';

interface FlowsheetWorkspaceProps {
  project: Project;
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
  project,
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
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [connectingSourceNodeId, setConnectingSourceNodeId] = useState<string | null>(null);
  const [isDrawZoneMode, setIsDrawZoneMode] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [calcMode, setCalcMode] = useState<'from_solids_and_cp' | 'from_solids_and_water'>(
    'from_solids_and_cp'
  );

  // Dragging state for equipment nodes and manual zones on canvas
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingAnnotationId, setDraggingAnnotationId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Interactive rectangle drawing state on canvas
  const [drawStartPt, setDrawStartPt] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrentPt, setDrawCurrentPt] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  const annotations = flowsheet.annotations ?? [];
  const selectedStream = flowsheet.edges.find((e) => e.id === selectedStreamId) ?? null;
  const selectedNode = flowsheet.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedNodeDiag = diagnostics.find((d) => d.nodeId === selectedNodeId) ?? null;
  const selectedAnnotation =
    annotations.find((a) => a.id === selectedAnnotationId) ?? null;

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
    setSelectedAnnotationId(null);
  };

  // Añadir Zona Manual / Cuadro Personalizado / Nota Técnica (ej. Zona de Carga de Camiones)
  const handleAddManualAnnotation = (
    kind: CanvasAnnotation['kind'],
    customRect?: { x: number; y: number; w: number; h: number }
  ) => {
    const count = annotations.length + 1;
    const newAnn: CanvasAnnotation = {
      id: `ann-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      kind,
      title:
        kind === 'zone_box'
          ? `ZONA OPERATIVA #${count} (Ej. Carga de Camiones / Stockpile)`
          : kind === 'custom_block'
          ? `BLOQUE PERSONALIZADO #${count} (Ej. Tolva / Chancado Móvil)`
          : `NOTA DE INGENIERÍA #${count}`,
      details:
        kind === 'zone_box'
          ? 'Escribe aquí detalles operativos, capacidad de camiones, turnos o especificaciones del área.'
          : 'Agrega observaciones de proceso, cotas, parámetros de diseño o instrucciones para el cliente.',
      position_x: customRect?.x ?? 180 + ((count * 40) % 360),
      position_y: customRect?.y ?? 90 + ((count * 35) % 200),
      width: customRect?.w ?? (kind === 'zone_box' ? 320 : 230),
      height: customRect?.h ?? (kind === 'zone_box' ? 210 : 110),
      color_theme: kind === 'zone_box' ? 'amber' : kind === 'custom_block' ? 'emerald' : 'cyan',
    };

    onUpdateFlowsheet({
      ...flowsheet,
      annotations: [...annotations, newAnn],
    });
    setSelectedAnnotationId(newAnn.id);
    setSelectedNodeId(null);
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

  // Inicio de dibujo manual de un rectángulo/cuadrado en el lienzo
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawZoneMode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(10, Math.round((e.clientX - rect.left) / zoom));
    const y = Math.max(10, Math.round((e.clientY - rect.top) / zoom));
    setDrawStartPt({ x, y });
    setDrawCurrentPt({ x: x + 40, y: y + 40 });
  };

  // Movimiento de nodos, zonas manuales o dibujo de cuadrado en el lienzo PFD
  const handleNodeMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    node: EquipmentNode
  ) => {
    e.stopPropagation();
    if (isDrawZoneMode) return;

    if (connectingSourceNodeId) {
      if (connectingSourceNodeId !== node.id) {
        handleCreateStreamConnection(connectingSourceNodeId, node.id);
      }
      setConnectingSourceNodeId(null);
      return;
    }

    setSelectedNodeId(node.id);
    setSelectedStreamId(null);
    setSelectedAnnotationId(null);

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggingNodeId(node.id);
    setDragOffset({
      x: (e.clientX - rect.left) / zoom - node.position_x,
      y: (e.clientY - rect.top) / zoom - node.position_y,
    });
  };

  const handleAnnotationMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    ann: CanvasAnnotation
  ) => {
    e.stopPropagation();
    if (isDrawZoneMode) return;

    setSelectedAnnotationId(ann.id);
    setSelectedNodeId(null);
    setSelectedStreamId(null);

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggingAnnotationId(ann.id);
    setDragOffset({
      x: (e.clientX - rect.left) / zoom - ann.position_x,
      y: (e.clientY - rect.top) / zoom - ann.position_y,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    if (isDrawZoneMode && drawStartPt) {
      const currX = Math.max(16, Math.round((e.clientX - rect.left) / zoom));
      const currY = Math.max(16, Math.round((e.clientY - rect.top) / zoom));
      setDrawCurrentPt({ x: currX, y: currY });
      return;
    }

    if (draggingNodeId) {
      const nextX = Math.max(16, Math.round((e.clientX - rect.left) / zoom - dragOffset.x));
      const nextY = Math.max(16, Math.round((e.clientY - rect.top) / zoom - dragOffset.y));

      onUpdateFlowsheet({
        ...flowsheet,
        nodes: flowsheet.nodes.map((n) =>
          n.id === draggingNodeId ? { ...n, position_x: nextX, position_y: nextY } : n
        ),
      });
      return;
    }

    if (draggingAnnotationId) {
      const nextX = Math.max(12, Math.round((e.clientX - rect.left) / zoom - dragOffset.x));
      const nextY = Math.max(12, Math.round((e.clientY - rect.top) / zoom - dragOffset.y));

      onUpdateFlowsheet({
        ...flowsheet,
        annotations: annotations.map((a) =>
          a.id === draggingAnnotationId ? { ...a, position_x: nextX, position_y: nextY } : a
        ),
      });
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDrawZoneMode && drawStartPt && drawCurrentPt) {
      const x = Math.min(drawStartPt.x, drawCurrentPt.x);
      const y = Math.min(drawStartPt.y, drawCurrentPt.y);
      const w = Math.max(160, Math.abs(drawCurrentPt.x - drawStartPt.x));
      const h = Math.max(100, Math.abs(drawCurrentPt.y - drawStartPt.y));

      handleAddManualAnnotation('zone_box', { x, y, w, h });
      setDrawStartPt(null);
      setDrawCurrentPt(null);
      setIsDrawZoneMode(false);
      return;
    }

    setDraggingNodeId(null);
    setDraggingAnnotationId(null);
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
    setSelectedAnnotationId(null);
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

  const handleUpdateSelectedAnnotation = (patch: Partial<CanvasAnnotation>) => {
    if (!selectedAnnotation) return;
    onUpdateFlowsheet({
      ...flowsheet,
      annotations: annotations.map((a) =>
        a.id === selectedAnnotation.id ? { ...a, ...patch } : a
      ),
    });
  };

  const handleDeleteSelectedAnnotation = () => {
    if (!selectedAnnotation) return;
    onUpdateFlowsheet({
      ...flowsheet,
      annotations: annotations.filter((a) => a.id !== selectedAnnotation.id),
    });
    setSelectedAnnotationId(null);
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
      {/* COLUMNA IZQUIERDA (315px): Paleta Drag & Drop de Equipos + Dibujo Manual de Zonas */}
      <aside className="w-full lg:w-[315px] shrink-0 bg-slate-900/90 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col max-h-[42vh] lg:max-h-none overflow-hidden">
        {/* Bloque de Herramientas de Dibujo Manual (Zonas de Camiones, Cuadrados, Notas) */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-cyan-400 tracking-wide">
              DIBUJO MANUAL DE ZONAS Y NOTAS
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setIsDrawZoneMode((v) => !v)}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold rounded border transition-colors cursor-pointer ${
                isDrawZoneMode
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-900 text-amber-300 border-slate-700 hover:border-amber-400/70'
              }`}
            >
              <PenTool className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {isDrawZoneMode ? 'Arrastra en Lienzo...' : 'Dibujar Zona/Cuadro'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleAddManualAnnotation('zone_box')}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded transition-colors cursor-pointer"
            >
              <PlusSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">+ Zona Camiones</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddManualAnnotation('custom_block')}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded transition-colors cursor-pointer"
            >
              <PlusSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">+ Bloque Libre</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddManualAnnotation('callout_note')}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded transition-colors cursor-pointer"
            >
              <StickyNote className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">+ Nota Texto</span>
            </button>
          </div>
        </div>

        <div className="p-3.5 border-b border-slate-800">
          <div className="text-[11px] font-mono text-cyan-400 tracking-wide">
            PALETA DE EQUIPOS INDUSTRIALES
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Arrastra al lienzo o haz clic para insertar un equipo en el proceso.
          </p>

          {/* Pestañas de Categorías */}
          <div className="grid grid-cols-2 gap-1 mt-2.5 bg-slate-950 p-1 rounded border border-slate-800">
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

      {/* CENTRO (Flex-1): Lienzo Interactivo PFD (Canvas) con Descarga PDF Inmediata */}
      <section className="flex-1 flex flex-col min-w-0 relative bg-slate-950 overflow-hidden">
        {/* Sub-barra de Herramientas del Lienzo PFD */}
        <div className="min-h-11 px-4 py-1.5 border-b border-slate-800 bg-slate-900/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 overflow-x-auto">
            {/* Estado de Cierre del Flowsheet */}
            {unbalancedNodesCount === 0 ? (
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 whitespace-nowrap">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>CIERRE NOMINAL (ΣE = ΣS)</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-rose-400 whitespace-nowrap">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {unbalancedNodesCount} NODO(S) FUERA DE TOLERANCIA (±{flowsheet.tolerance_pct}%)
                </span>
              </div>
            )}

            <span className="text-slate-700" aria-hidden="true">
              |
            </span>

            {/* Instrucciones contextuales según modo */}
            {isDrawZoneMode ? (
              <div className="flex items-center gap-2 text-xs text-amber-300 font-mono">
                <span>
                  MODO DIBUJO ACTIVO: Haz clic y arrastra sobre el lienzo para trazar tu cuadrado o
                  zona operativa...
                </span>
                <button
                  type="button"
                  onClick={() => setIsDrawZoneMode(false)}
                  className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded hover:bg-slate-700 cursor-pointer"
                >
                  Salir
                </button>
              </div>
            ) : connectingSourceNodeId ? (
              <div className="flex items-center gap-2 text-xs text-amber-300 font-mono">
                <span>
                  Haz clic en el equipo destino para conectar desde{' '}
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
              <span className="text-xs text-slate-400 hidden 2xl:inline">
                Haz clic en cualquier zona manual, equipo o corriente para editar sus textos y
                parámetros.
              </span>
            )}
          </div>

          {/* Botones Directos en el Lienzo: Descargar PDF con Sello TAGING + Planilla Excel + Zoom */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                exportFlowsheetToPrintablePdf(project, flowsheet, diagnostics)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer whitespace-nowrap shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              Descargar Lienzo PDF (Sello TAGING)
            </button>

            <button
              type="button"
              onClick={() =>
                exportProfessionalExcelSheet(project, flowsheet, diagnostics)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Planilla Excel (.XLS)
            </button>

            <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-slate-800">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.65, +(z - 0.1).toFixed(2)))}
                aria-label="Reducir zoom del lienzo"
                className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-950 border border-slate-800 rounded cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono text-slate-300 w-11 text-center tabular-nums">
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
        </div>

        {/* Superficie del Lienzo con Grilla Técnica PFD */}
        <div
          ref={canvasRef}
          data-testid="pfd-canvas-surface"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="flex-1 overflow-auto bg-pfd-grid bg-pfd-grid-major relative select-none cursor-crosshair"
        >
          <div
            className="relative min-w-[1480px] min-h-[600px] origin-top-left transition-transform duration-75"
            style={{ transform: `scale(${zoom})` }}
          >
            {/* CAPA 1: ZONAS MANUALES / CUADRADOS DIBUJADOS / NOTAS (ej. Zona de Carga de Camiones) */}
            {annotations.map((ann) => {
              const isSelected = ann.id === selectedAnnotationId;
              const themeClasses =
                ann.color_theme === 'amber'
                  ? 'border-amber-400/80 bg-amber-950/15 text-amber-300'
                  : ann.color_theme === 'emerald'
                  ? 'border-emerald-400/80 bg-emerald-950/15 text-emerald-300'
                  : ann.color_theme === 'rose'
                  ? 'border-rose-400/80 bg-rose-950/15 text-rose-300'
                  : ann.color_theme === 'slate'
                  ? 'border-slate-500/80 bg-slate-900/35 text-slate-200'
                  : 'border-cyan-400/80 bg-cyan-950/15 text-cyan-300';

              return (
                <div
                  key={ann.id}
                  onMouseDown={(e) => handleAnnotationMouseDown(e, ann)}
                  style={{
                    left: `${ann.position_x}px`,
                    top: `${ann.position_y}px`,
                    width: `${ann.width}px`,
                    height: `${ann.height}px`,
                  }}
                  className={`absolute rounded-md border-2 ${
                    ann.kind === 'zone_box' ? 'border-dashed' : 'border-solid'
                  } p-3 flex flex-col justify-between cursor-move transition-shadow ${themeClasses} ${
                    isSelected ? 'ring-2 ring-white shadow-lg' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold tracking-wide uppercase font-display">
                        {ann.title}
                      </span>
                      <span className="text-[10px] font-mono opacity-75 shrink-0">
                        {ann.kind === 'zone_box'
                          ? 'ZONA'
                          : ann.kind === 'custom_block'
                          ? 'BLOQUE'
                          : 'NOTA'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300/95 leading-snug whitespace-pre-wrap">
                      {ann.details}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono opacity-60 pt-1">
                    <span>
                      {ann.width}×{ann.height} px
                    </span>
                    <span>Clic para editar texto/tamaño</span>
                  </div>
                </div>
              );
            })}

            {/* Vista previa del rectángulo mientras el usuario dibuja con el mouse */}
            {isDrawZoneMode && drawStartPt && drawCurrentPt && (
              <div
                style={{
                  left: `${Math.min(drawStartPt.x, drawCurrentPt.x)}px`,
                  top: `${Math.min(drawStartPt.y, drawCurrentPt.y)}px`,
                  width: `${Math.abs(drawCurrentPt.x - drawStartPt.x)}px`,
                  height: `${Math.abs(drawCurrentPt.y - drawStartPt.y)}px`,
                }}
                className="absolute border-2 border-dashed border-amber-400 bg-amber-400/15 rounded-md pointer-events-none flex items-center justify-center text-xs font-mono text-amber-200"
              >
                Nueva Zona Manual ({Math.abs(drawCurrentPt.x - drawStartPt.x)}×
                {Math.abs(drawCurrentPt.y - drawStartPt.y)})
              </div>
            )}

            {/* CAPA 2 (SVG): Líneas Ortogonales de Corrientes (Streams) */}
            <svg
              className="absolute inset-0 w-[1480px] h-[600px] pointer-events-none"
              viewBox="0 0 1480 600"
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
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="16"
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedStreamId(edge.id);
                        setSelectedNodeId(null);
                        setSelectedAnnotationId(null);
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
                        setSelectedAnnotationId(null);
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* CAPA 3: ETIQUETAS INTERACTIVAS DE CORRIENTE (STR-001, STR-002...) */}
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
                    setSelectedAnnotationId(null);
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
                    <span
                      className={
                        isSelected ? 'text-cyan-300 font-bold' : 'text-slate-200 font-semibold'
                      }
                    >
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

            {/* CAPA 4: BLOQUES DE EQUIPOS EN EL LIENZO (EquipmentNode) */}
            {flowsheet.nodes.map((node) => {
              const diag = diagMap.get(node.id);
              const isSelected = node.id === selectedNodeId;
              const isConnectingSource = node.id === connectingSourceNodeId;

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
                  className={`absolute z-10 w-[196px] rounded-md bg-slate-900/95 border-2 transition-shadow cursor-grab active:cursor-grabbing ${statusBorder} ${
                    isSelected ? 'ring-2 ring-cyan-400 shadow-lg' : ''
                  } ${isConnectingSource ? 'ring-2 ring-amber-400' : ''}`}
                >
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

            {/* CAJETÍN / SELLO CORPORATIVO DE TAGING EN LA ESQUINA DEL LIENZO PFD */}
            <div className="absolute right-6 bottom-6 z-20 pointer-events-none bg-slate-950/90 border border-slate-800 rounded-md px-4 py-2.5 flex items-center gap-4 shadow-lg">
              <TagingBrandLogo size="sm" showSubtitle />
              <div className="border-l border-slate-800 pl-3 text-[10px] font-mono text-slate-400 space-y-0.5">
                <div className="text-slate-200 font-semibold">{project.code}</div>
                <div>{project.client}</div>
                <div className="text-cyan-400">{flowsheet.version}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COLUMNA DERECHA (380px): Inspector de Zonas Manuales, Corrientes o Equipos */}
      <aside className="w-full lg:w-[380px] shrink-0 bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col overflow-y-auto">
        {selectedAnnotation ? (
          <div className="p-4 space-y-5">
            {/* Inspector de Zona Manual / Cuadrado Dibujado / Nota */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs font-mono text-amber-400">
                  ELEMENTO MANUAL DEL LIENZO
                </div>
                <h3 className="text-sm font-semibold text-slate-100 mt-0.5">
                  Personalizar Zona, Cuadro o Nota
                </h3>
              </div>
              <button
                type="button"
                onClick={handleDeleteSelectedAnnotation}
                aria-label="Eliminar zona o nota manual"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label htmlFor="ann-title" className="block text-xs text-slate-300 mb-1">
                  Título / Nombre de la Zona o Bloque
                </label>
                <input
                  id="ann-title"
                  type="text"
                  value={selectedAnnotation.title}
                  onChange={(e) =>
                    handleUpdateSelectedAnnotation({ title: e.target.value })
                  }
                  placeholder="Ej: ZONA DE CARGA DE CAMIONES CAEX"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs font-semibold text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="ann-details" className="block text-xs text-slate-300 mb-1">
                  Detalles, Especificaciones o Texto Libre
                </label>
                <textarea
                  id="ann-details"
                  rows={4}
                  value={selectedAnnotation.details}
                  onChange={(e) =>
                    handleUpdateSelectedAnnotation({ details: e.target.value })
                  }
                  placeholder="Escribe aquí cualquier detalle: capacidad de camiones, ley de corte, dimensiones de acopio, notas para el cliente..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:border-cyan-400 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ann-width" className="block text-[11px] text-slate-400 mb-1">
                    Ancho del Cuadro (px)
                  </label>
                  <input
                    id="ann-width"
                    type="number"
                    step="15"
                    min="120"
                    max="1200"
                    value={selectedAnnotation.width}
                    onChange={(e) =>
                      handleUpdateSelectedAnnotation({
                        width: Math.max(120, Number(e.target.value) || 240),
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="ann-height" className="block text-[11px] text-slate-400 mb-1">
                    Alto del Cuadro (px)
                  </label>
                  <input
                    id="ann-height"
                    type="number"
                    step="15"
                    min="70"
                    max="600"
                    value={selectedAnnotation.height}
                    onChange={(e) =>
                      handleUpdateSelectedAnnotation({
                        height: Math.max(70, Number(e.target.value) || 140),
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">
                  Color Demarcatorio en Lienzo y PDF
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(
                    [
                      { id: 'amber', label: 'Ámbar' },
                      { id: 'cyan', label: 'Cian' },
                      { id: 'emerald', label: 'Verde' },
                      { id: 'rose', label: 'Rojo' },
                      { id: 'slate', label: 'Gris' },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleUpdateSelectedAnnotation({ color_theme: c.id })}
                      className={`py-1.5 px-2 rounded text-[11px] font-medium border cursor-pointer ${
                        selectedAnnotation.color_theme === c.id
                          ? 'bg-slate-800 border-cyan-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : selectedStream ? (
          <div className="p-4 space-y-5">
            {/* Encabezado del Inspector de Corriente */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex-1">
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
            {/* Inspector Editable de Equipo y Verificación de Cierre de Balance */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label="Tag del equipo"
                    value={selectedNode.tag}
                    onChange={(e) =>
                      onUpdateFlowsheet({
                        ...flowsheet,
                        nodes: flowsheet.nodes.map((n) =>
                          n.id === selectedNode.id ? { ...n, tag: e.target.value } : n
                        ),
                      })
                    }
                    className="w-24 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono font-bold text-cyan-400"
                  />
                  <span className="text-xs text-slate-400">{selectedNode.category}</span>
                </div>
                <input
                  type="text"
                  aria-label="Nombre personalizado del equipo"
                  value={selectedNode.name}
                  onChange={(e) =>
                    onUpdateFlowsheet({
                      ...flowsheet,
                      nodes: flowsheet.nodes.map((n) =>
                        n.id === selectedNode.id ? { ...n, name: e.target.value } : n
                      ),
                    })
                  }
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-semibold text-slate-100"
                />
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
              Selecciona cualquier <strong className="text-amber-300">Zona Manual</strong>,{' '}
              <strong className="text-cyan-300">Corriente STR-###</strong> o{' '}
              <strong className="text-slate-200">Equipo</strong> en el lienzo PFD para editar sus
              textos, dimensiones o balance de masa.
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
                  setSelectedAnnotationId(null);
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

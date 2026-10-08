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
  ChevronLeft,
  ChevronRight,
  Columns,
  FileSpreadsheet,
  FileText,
  Link2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PenTool,
  Plus,
  PlusSquare,
  Search,
  Settings2,
  Sliders,
  StickyNote,
  Trash2,
  X,
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
  EquipmentParameters,
  EquipmentSubType,
  Flowsheet,
  FlowsheetSolverReport,
  NodeBalanceDiagnostics,
  Project,
  StreamEdge,
  StreamFlowData,
} from '../types/process';
import {
  exportFlowsheetToPrintablePdf,
  exportProfessionalExcelSheet,
} from '../utils/exportTools';
import {
  computeDerivedSlurryProperties,
  detectDirectedCycles,
  generateUniqueStreamId,
  getEquipmentUnitRole,
  parseSafeEngineeringNumber,
  reconcileFlowsheetMassBalance,
  solveFlowsheetWithReport,
  validateFlowsheetGraph,
} from '../utils/massBalanceMath';
import { CustomEquipmentCadModal } from './CustomEquipmentCadModal';
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

const CUSTOM_CATALOG_KEY = 'taging_custom_equipment_catalog_v1';

export const FlowsheetWorkspace: React.FC<FlowsheetWorkspaceProps> = ({
  project,
  flowsheet,
  diagnostics,
  onUpdateFlowsheet,
  onAutoReconcile,
}) => {
  // Estado de paneles laterales desplegables/colapsables (en pantallas medianas ~1000px inicia plegado el izquierdo para priorizar lienzo + inspector)
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1180 : true
  );
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [lastSolverReport, setLastSolverReport] = useState<FlowsheetSolverReport | null>(null);
  const [showValidationPanel, setShowValidationPanel] = useState<boolean>(false);

  // Catálogo combinado (Equipos estándar + Equipos creados por el usuario desde el buscador)
  const [customCatalog, setCustomCatalog] = useState<EquipmentCatalogItem[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_CATALOG_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fullCatalog = [...EQUIPMENT_CATALOG, ...customCatalog];

  const [activeCategory, setActiveCategory] = useState<EquipmentCategory>('Comminución');
  const [equipmentSearch, setEquipmentSearch] = useState<string>('');
  const [isCreateCustomEquipOpen, setIsCreateCustomEquipOpen] = useState<boolean>(false);
  const [newEquipName, setNewEquipName] = useState<string>('');
  const [newEquipPrefix, setNewEquipPrefix] = useState<string>('EQ');
  const [newEquipCategory, setNewEquipCategory] =
    useState<EquipmentCategory>('Comminución');
  const [newEquipBaseType, setNewEquipBaseType] =
    useState<EquipmentSubType>('mill_sag');
  const [newEquipDesc, setNewEquipDesc] = useState<string>(
    'Equipo personalizado agregado al catálogo de ingeniería.'
  );

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

  // Filtrado de equipos en la paleta izquierda (busca por nombre, prefijo, descripción, tipo y keywords en español/inglés)
  const [showAllCategories, setShowAllCategories] = useState<boolean>(false);
  const filteredCatalog = fullCatalog.filter((item) => {
    if (equipmentSearch.trim().length > 0) {
      const q = equipmentSearch.toLowerCase();
      const kwMatch = (item.keywords ?? []).some((kw) => kw.toLowerCase().includes(q));
      return (
        item.name.toLowerCase().includes(q) ||
        item.prefix.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        kwMatch
      );
    }
    if (showAllCategories) return true;
    return item.category === activeCategory;
  });

  // Guardar nuevo equipo diseñado en el Estudio CAD en el catálogo y agregarlo al lienzo
  const handleSaveCustomEquipment = (newCatalogItem: EquipmentCatalogItem) => {
    const nextCustom = [newCatalogItem, ...customCatalog];
    setCustomCatalog(nextCustom);
    try {
      localStorage.setItem(CUSTOM_CATALOG_KEY, JSON.stringify(nextCustom));
    } catch {
      // Ignore quota errors
    }

    handleAddEquipment(newCatalogItem);
    setIsCreateCustomEquipOpen(false);
    setEquipmentSearch('');
  };

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
      custom_drawing: item.customDrawing,
    };

    onUpdateFlowsheet({
      ...flowsheet,
      nodes: [...flowsheet.nodes, newNode],
    });
    setSelectedNodeId(newNode.id);
    setSelectedStreamId(null);
    setSelectedAnnotationId(null);
    setIsRightPanelOpen(true);
  };

  // Añadir Zona Manual / Cuadro Personalizado / Nota Técnica
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
    setIsRightPanelOpen(true);
  };

  // Drag & Drop desde la paleta izquierda hacia el lienzo
  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rawName = e.dataTransfer.getData('application/minflow-equipment-name');
    const rawType = e.dataTransfer.getData('application/minflow-equipment');
    const catalogItem =
      fullCatalog.find((c) => c.name === rawName) ??
      fullCatalog.find((c) => c.type === rawType);
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

  // Al tocar un equipo en el lienzo: abre su configuración en el panel derecho y permite moverlo
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
    setIsRightPanelOpen(true);

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
    setIsRightPanelOpen(true);

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

  // Crear nueva corriente (StreamEdge) garantizando un ID 100% único (evita colisiones STR-007)
  const handleCreateStreamConnection = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const streamId = generateUniqueStreamId(flowsheet.edges);
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

    const nextFlowsheet = reconcileFlowsheetMassBalance({
      ...flowsheet,
      edges: [...flowsheet.edges, newEdge],
    });

    onUpdateFlowsheet(nextFlowsheet);
    setSelectedStreamId(newEdge.id);
    setSelectedNodeId(null);
    setSelectedAnnotationId(null);
    setIsRightPanelOpen(true);
  };

  const handleRunSolverWithReport = () => {
    const { flowsheet: solved, report } = solveFlowsheetWithReport(flowsheet);
    setLastSolverReport(report);
    if (report.validationIssues.length > 0 || !report.converged) {
      setShowValidationPanel(true);
    }
    onUpdateFlowsheet(solved);
  };

  // Actualizar parámetros específicos del equipo seleccionado y recalcular el balance aguas abajo
  const handleNodeParameterChange = (
    paramKey: keyof EquipmentParameters,
    value: number | string | undefined,
    autoSolve: boolean = true
  ) => {
    if (!selectedNode) return;
    const updatedNodes = flowsheet.nodes.map((n) => {
      if (n.id !== selectedNode.id) return n;
      return {
        ...n,
        parameters: {
          ...n.parameters,
          [paramKey]: value,
        },
      };
    });

    const draftFlowsheet: Flowsheet = {
      ...flowsheet,
      nodes: updatedNodes,
    };

    if (autoSolve) {
      const { flowsheet: solved, report } = solveFlowsheetWithReport(draftFlowsheet);
      setLastSolverReport(report);
      onUpdateFlowsheet(solved);
    } else {
      onUpdateFlowsheet(draftFlowsheet);
    }
  };

  // Actualizar la corriente de salida de un nodo Alimentador (Fuente Única de Verdad)
  const handleFeedNodeStreamChange = (
    field: 'solids_tph' | 'percent_solids' | 'water_m3h' | 'cu_pct' | 'au_gpt' | 'li_pct',
    rawVal: string | number,
    mode: 'from_solids_and_cp' | 'from_solids_and_water'
  ) => {
    if (!selectedNode) return;
    const val = parseSafeEngineeringNumber(rawVal, 0, 0);
    const outEdge = flowsheet.edges.find((e) => e.source_node_id === selectedNode.id);

    if (outEdge) {
      const cur = outEdge.flow_data;
      const nextDraft: Partial<StreamFlowData> =
        field === 'cu_pct' || field === 'au_gpt' || field === 'li_pct'
          ? { ...cur, assay: { ...cur.assay, [field]: val } }
          : { ...cur, [field]: val };

      const recalculated = computeDerivedSlurryProperties(nextDraft, mode);
      const updatedEdges = flowsheet.edges.map((e) =>
        e.id === outEdge.id ? { ...e, flow_data: recalculated } : e
      );
      // Limpiamos parámetros duplicados en el nodo feed para mantener única fuente de verdad en la corriente
      const updatedNodes = flowsheet.nodes.map((n) =>
        n.id === selectedNode.id ? { ...n, parameters: {} } : n
      );
      const { flowsheet: solved, report } = solveFlowsheetWithReport({
        ...flowsheet,
        nodes: updatedNodes,
        edges: updatedEdges,
      });
      setLastSolverReport(report);
      onUpdateFlowsheet(solved);
    } else {
      // Si aún no tiene corriente conectada, guarda preliminarmente en parameters
      const paramMap: Record<string, keyof EquipmentParameters> = {
        solids_tph: 'feed_solids_tph',
        percent_solids: 'feed_cp_pct',
        water_m3h: 'feed_water_m3h',
        cu_pct: 'feed_cu_pct',
        au_gpt: 'feed_au_gpt',
        li_pct: 'feed_li_pct',
      };
      handleNodeParameterChange(paramMap[field], val, false);
    }
  };

  // Actualizar variables metalúrgicas de una corriente seleccionada
  const handleStreamDataChange = (
    field: keyof StreamFlowData | 'cu_pct' | 'au_gpt' | 'li_pct' | 'fe_pct' | 'mo_pct',
    rawValue: number | string,
    explicitMode?: 'from_solids_and_cp' | 'from_solids_and_water'
  ) => {
    if (!selectedStream) return;
    const modeToUse = explicitMode ?? calcMode;
    const sanitizedVal = parseSafeEngineeringNumber(rawValue, 0, 0);

    const currentData = selectedStream.flow_data;
    let nextDraft: Partial<StreamFlowData> = { ...currentData };

    if (
      field === 'cu_pct' ||
      field === 'au_gpt' ||
      field === 'li_pct' ||
      field === 'fe_pct' ||
      field === 'mo_pct'
    ) {
      nextDraft.assay = {
        ...currentData.assay,
        [field]: sanitizedVal,
      };
    } else {
      nextDraft = {
        ...currentData,
        [field]: sanitizedVal,
      };
    }

    const recalculated = computeDerivedSlurryProperties(nextDraft, modeToUse);

    // Si la corriente nace de un feed_source, limpiamos parámetros duplicados en ese feed_source
    const srcNode = nodeMap.get(selectedStream.source_node_id);
    const updatedNodes =
      srcNode?.type === 'feed_source'
        ? flowsheet.nodes.map((n) => (n.id === srcNode.id ? { ...n, parameters: {} } : n))
        : flowsheet.nodes;

    onUpdateFlowsheet({
      ...flowsheet,
      nodes: updatedNodes,
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

  const internalDiagnostics = diagnostics.filter((d) => !d.isBoundary);
  const unbalancedNodesCount = internalDiagnostics.filter((d) => !d.isBalanced).length;
  const graphIssues = validateFlowsheetGraph(flowsheet);
  const hasRecycleLoop = detectDirectedCycles(flowsheet.nodes, flowsheet.edges);
  const selectedNodeRole = selectedNode
    ? getEquipmentUnitRole(selectedNode.type, selectedNode)
    : null;
  const selectedFeedOutEdge =
    selectedNode && selectedNodeRole === 'feed_generator'
      ? flowsheet.edges.find((e) => e.source_node_id === selectedNode.id) ?? null
      : null;

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-57px)] md:h-[calc(100vh-57px)] overflow-y-auto md:overflow-hidden bg-slate-950 relative">
      {/* COLUMNA IZQUIERDA COLAPSABLE: Buscador + Paleta de Equipos + Dibujo Manual */}
      {isLeftPanelOpen && (
        <aside className="w-full md:w-[260px] xl:w-[320px] shrink-0 bg-slate-900/95 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col max-h-[38vh] md:max-h-none overflow-hidden z-20">
          {/* Cabecera del Panel Izquierdo con botón para plegar */}
          <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
            <span className="text-[11px] font-mono text-cyan-400 font-semibold tracking-wide">
              PALETA DE EQUIPOS & ZONAS
            </span>
            <button
              type="button"
              onClick={() => setIsLeftPanelOpen(false)}
              title="Ocultar panel izquierdo para ampliar el lienzo"
              aria-label="Ocultar panel izquierdo"
              className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
            >
              <PanelLeftClose className="w-4 h-4" />
              <span className="hidden sm:inline">Ocultar</span>
            </button>
          </div>

          {/* Herramientas de Dibujo Manual de Zonas y Notas */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/40 space-y-2">
            <div className="text-[10px] font-mono text-slate-400">
              DIBUJO MANUAL EN LIENZO (CAMIONES / ÁREAS)
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setIsDrawZoneMode((v) => !v)}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded border transition-colors cursor-pointer ${
                  isDrawZoneMode
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-900 text-amber-300 border-slate-700 hover:border-amber-400/70'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {isDrawZoneMode ? 'Arrastra en Lienzo...' : 'Dibujar Cuadro'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleAddManualAnnotation('zone_box')}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded transition-colors cursor-pointer"
              >
                <PlusSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">+ Zona Camiones</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddManualAnnotation('custom_block')}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded transition-colors cursor-pointer"
              >
                <PlusSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">+ Bloque Libre</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddManualAnnotation('callout_note')}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded transition-colors cursor-pointer"
              >
                <StickyNote className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">+ Nota Texto</span>
              </button>
            </div>
          </div>

          {/* Buscador de Equipos + Botón Crear Nuevo Equipo si no está */}
          <div className="p-3 border-b border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-cyan-400">
                BUSCADOR Y CATÁLOGO DE EQUIPOS PFD
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewEquipName(equipmentSearch);
                  setIsCreateCustomEquipOpen(true);
                }}
                className="px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-400 hover:text-slate-950 text-[11px] font-mono font-semibold text-cyan-300 border border-cyan-500/40 transition-colors cursor-pointer"
              >
                + Dibujar Equipo CAD
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Buscar equipo o icono en el catálogo"
                value={equipmentSearch}
                onChange={(e) => setEquipmentSearch(e.target.value)}
                placeholder="Buscar equipo (ej. Molino, Ciclón, Tolva, Filtro)..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              {equipmentSearch && (
                <button
                  type="button"
                  onClick={() => setEquipmentSearch('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Pestañas de Categorías (visibles cuando no hay texto de búsqueda) */}
            {!equipmentSearch.trim() && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setShowAllCategories((v) => !v)}
                  className={`w-full px-2.5 py-1 text-[11px] font-mono font-semibold rounded border text-center transition-colors cursor-pointer ${
                    showAllCategories
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/60'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-cyan-500/40'
                  }`}
                >
                  {showAllCategories
                    ? `✓ Mostrando Todo el Catálogo (${fullCatalog.length} Equipos)`
                    : `Ver Todos los Equipos del Catálogo (${fullCatalog.length})`}
                </button>
                <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded border border-slate-800">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setShowAllCategories(false);
                        setActiveCategory(cat);
                      }}
                      className={`px-2 py-1.5 text-[11px] font-medium rounded text-left truncate transition-colors cursor-pointer ${
                        !showAllCategories && activeCategory === cat
                          ? 'bg-slate-800 text-cyan-300'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Lista de Equipos con Iconos Técnicos PFD */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredCatalog.map((item, i) => (
              <div
                key={`${item.prefix}-${item.name}-${i}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/minflow-equipment', item.type);
                  e.dataTransfer.setData('application/minflow-equipment-name', item.name);
                }}
                onClick={() => handleAddEquipment(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleAddEquipment(item);
                }}
                aria-label={`Insertar equipo ${item.name}`}
                className="group flex items-center gap-3 p-2.5 rounded bg-slate-950/90 border border-slate-800/90 hover:border-cyan-500/70 hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <div className="w-16 h-11 flex items-center justify-center shrink-0">
                  <EquipmentSymbolSvg
                    type={item.type}
                    customDrawing={item.customDrawing}
                    className="w-full h-full"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-slate-100 truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 shrink-0">
                      {item.prefix}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}

            {/* Si el usuario busca un icono/equipo que no está en la lista, permite agregarlo en 1 clic */}
            {equipmentSearch.trim().length > 0 && (
              <div className="p-3 rounded bg-slate-950 border border-dashed border-cyan-500/60 text-center space-y-2">
                <p className="text-xs text-slate-300">
                  ¿No encuentras <strong>"{equipmentSearch}"</strong> en la lista?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNewEquipName(equipmentSearch);
                    setIsCreateCustomEquipOpen(true);
                  }}
                  className="w-full py-2 px-3 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs rounded inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar "{equipmentSearch}" al Catálogo y Lienzo
                </button>
              </div>
            )}
          </div>

          {/* Pie de Paleta: Tolerancia Global y Reconciliador Automático */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/90 space-y-2">
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
              onClick={handleRunSolverWithReport}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              Calcular y Balancear Flujo (ΣE=ΣS)
            </button>
          </div>
        </aside>
      )}

      {/* CENTRO (Flex-1): Lienzo Interactivo PFD con Botones para Desplegar/Cerrar Paneles */}
      <section className="flex-1 flex flex-col min-w-0 min-h-[480px] relative bg-slate-950 overflow-hidden">
        {/* Sub-barra de Herramientas del Lienzo PFD */}
        <div className="min-h-11 px-3 py-1.5 border-b border-slate-800 bg-slate-900/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            {/* Botón para abrir/cerrar Paleta Izquierda */}
            <button
              type="button"
              onClick={() => setIsLeftPanelOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer whitespace-nowrap ${
                isLeftPanelOpen
                  ? 'bg-slate-800 text-cyan-300 border-slate-700'
                  : 'bg-slate-950 text-slate-200 border-cyan-500/60 hover:bg-slate-800'
              }`}
              title="Mostrar u ocultar el panel izquierdo de dibujos y equipos"
            >
              {isLeftPanelOpen ? (
                <>
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Ocultar Paleta</span>
                </>
              ) : (
                <>
                  <PanelLeftOpen className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Mostrar Equipos/Dibujo</span>
                </>
              )}
            </button>

            {/* Botón Modo Vista Completa (cierra ambos paneles o los abre) */}
            <button
              type="button"
              onClick={() => {
                if (isLeftPanelOpen || isRightPanelOpen) {
                  setIsLeftPanelOpen(false);
                  setIsRightPanelOpen(false);
                } else {
                  setIsLeftPanelOpen(true);
                  setIsRightPanelOpen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded transition-colors cursor-pointer whitespace-nowrap"
              title="Alternar vista de pantalla completa del diagrama"
            >
              <Columns className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {isLeftPanelOpen || isRightPanelOpen ? 'Ver Flujo Completo' : 'Restaurar Paneles'}
              </span>
            </button>

            <span className="text-slate-700" aria-hidden="true">
              |
            </span>

            {/* Estado de Cierre del Flowsheet (Masa, Agua y 5 Elementos) */}
            {unbalancedNodesCount === 0 ? (
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 whitespace-nowrap">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>CIERRE NOMINAL (ΣE = ΣS · Masa, Agua y Leyes)</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-rose-400 whitespace-nowrap">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {unbalancedNodesCount} EQUIPO(S) CON DESBALANCE
                </span>
                <button
                  type="button"
                  onClick={handleRunSolverWithReport}
                  className="ml-1 px-2 py-0.5 bg-rose-500/20 border border-rose-500/50 text-rose-200 rounded hover:bg-rose-500/30 cursor-pointer"
                >
                  Calcular y Balancear Flujo (ΣE=ΣS)
                </button>
              </div>
            )}

            {/* Indicador de Validación Topológica / Lazo de Recirculación */}
            {(graphIssues.length > 0 || hasRecycleLoop || lastSolverReport) && (
              <button
                type="button"
                onClick={() => setShowValidationPanel((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono rounded border cursor-pointer whitespace-nowrap ${
                  graphIssues.some((i) => i.severity === 'error')
                    ? 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                    : graphIssues.length > 0
                    ? 'bg-amber-950/80 border-amber-500/60 text-amber-200'
                    : 'bg-cyan-950/70 border-cyan-500/50 text-cyan-200'
                }`}
              >
                <span>
                  {graphIssues.length > 0
                    ? `${graphIssues.length} Alerta(s) Topología`
                    : hasRecycleLoop
                    ? 'Lazo Recirculación Activo'
                    : `Solver OK (${lastSolverReport?.iterations ?? 1} iter)`}
                </span>
              </button>
            )}

            {/* Instrucciones contextuales según modo */}
            {isDrawZoneMode && (
              <div className="flex items-center gap-2 text-xs text-amber-300 font-mono">
                <span>MODO DIBUJO: Arrastra en el lienzo para crear la zona...</span>
                <button
                  type="button"
                  onClick={() => setIsDrawZoneMode(false)}
                  className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded hover:bg-slate-700 cursor-pointer"
                >
                  Salir
                </button>
              </div>
            )}
            {connectingSourceNodeId && (
              <div className="flex items-center gap-2 text-xs text-amber-300 font-mono">
                <span>
                  Selecciona el equipo destino para conectar desde{' '}
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
            )}
          </div>

          {/* Botones Directos en el Lienzo: Descargar PDF con Sello TAGING + Planilla Excel + Zoom + Panel Derecho */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                exportFlowsheetToPrintablePdf(project, flowsheet, diagnostics)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer whitespace-nowrap shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              Descargar PDF (Sello TAGING)
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

            <div className="hidden xl:flex items-center gap-1 pl-1 border-l border-slate-800">
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

            {/* Botón para abrir/cerrar Panel Derecho de Configuración y Balance */}
            <button
              type="button"
              onClick={() => setIsRightPanelOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer whitespace-nowrap ${
                isRightPanelOpen
                  ? 'bg-slate-800 text-cyan-300 border-slate-700'
                  : 'bg-slate-950 text-slate-200 border-cyan-500/60 hover:bg-slate-800'
              }`}
              title="Mostrar u ocultar el panel derecho de configuración y balance"
            >
              {isRightPanelOpen ? (
                <>
                  <span>Ocultar Balance</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <PanelRightOpen className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Abrir Configuración</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Panel Desplegable de Validación de Grafo y Reporte de Convergencia de Recirculación */}
        {showValidationPanel && (
          <div className="px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 text-xs space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-3 font-mono">
                <span className="text-cyan-400 font-semibold">
                  DIAGNÓSTICO DE GRAFO Y CONVERGENCIA DEL MOTOR:
                </span>
                {lastSolverReport && (
                  <span
                    className={
                      lastSolverReport.converged ? 'text-emerald-400' : 'text-rose-400 font-bold'
                    }
                  >
                    {lastSolverReport.message}
                  </span>
                )}
                {lastSolverReport?.circulatingLoadRatio_pct !== undefined && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                    Razón Carga Circulante (UF/OF): {lastSolverReport.circulatingLoadRatio_pct.toFixed(1)}%
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowValidationPanel(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {graphIssues.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-36 overflow-y-auto pt-1">
                {graphIssues.map((iss) => (
                  <div
                    key={iss.id}
                    className={`p-2 rounded border text-[11px] ${
                      iss.severity === 'error'
                        ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                        : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                    }`}
                  >
                    <div className="font-mono font-bold">
                      [{iss.severity.toUpperCase()}] {iss.targetLabel}: {iss.message}
                    </div>
                    <div className="text-slate-300 mt-0.5">Solución: {iss.remediation}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] font-mono text-emerald-400">
                ✓ Topología PFD verificada: sin corrientes huérfanas, sin equipos desconectados y grados de libertad consistentes.
              </div>
            )}
          </div>
        )}

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
            {/* CAPA 1: ZONAS MANUALES / CUADRADOS DIBUJADOS / NOTAS */}
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

                const x1 = src.position_x + 172;
                const y1 = src.position_y + 54;
                const x2 = tgt.position_x + 8;
                const y2 = tgt.position_y + 54;

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
                  <g key={`svg-edge-${edge.id}-${idx}`} className="pointer-events-auto">
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
                        setIsRightPanelOpen(true);
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
                        setIsRightPanelOpen(true);
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* CAPA 3: ETIQUETAS INTERACTIVAS DE CORRIENTE ESTILO PFD (Cuadrito con Número + Flujo) */}
            {flowsheet.edges.map((edge, idx) => {
              const src = nodeMap.get(edge.source_node_id);
              const tgt = nodeMap.get(edge.target_node_id);
              if (!src || !tgt) return null;

              const x1 = src.position_x + 172;
              const y1 = src.position_y + 54;
              const x2 = tgt.position_x + 8;
              const y2 = tgt.position_y + 54;
              const midX = Math.round((x1 + x2) / 2 + ((idx % 3) - 1) * 8);
              const midY = Math.round((y1 + y2) / 2);

              const isSelected = edge.id === selectedStreamId;
              const shortNum = edge.id.replace('STR-0', '').replace('STR-', '');

              return (
                <button
                  key={`tag-btn-${edge.id}-${idx}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStreamId(edge.id);
                    setSelectedNodeId(null);
                    setSelectedAnnotationId(null);
                    setIsRightPanelOpen(true);
                  }}
                  aria-label={`Corriente ${edge.id} ${edge.name}`}
                  style={{
                    left: `${midX - 44}px`,
                    top: `${midY - 18}px`,
                  }}
                  className={`absolute z-10 px-2 py-0.5 rounded border-2 text-center transition-all cursor-pointer shadow-md ${
                    isSelected
                      ? 'bg-cyan-950 border-cyan-300 ring-2 ring-cyan-400/40'
                      : 'bg-slate-950/95 border-slate-500 hover:border-cyan-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono">
                    <span
                      className={`px-1 rounded font-bold ${
                        isSelected
                          ? 'bg-cyan-400 text-slate-950'
                          : 'bg-slate-800 text-cyan-300'
                      }`}
                    >
                      {shortNum}
                    </span>
                    <span className="text-slate-200 font-semibold tabular-nums">
                      {edge.flow_data.solids_tph > 0
                        ? `${edge.flow_data.solids_tph.toFixed(2)} t/h`
                        : `${edge.flow_data.water_m3h.toFixed(2)} m³/h`}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 tabular-nums">
                    {edge.id} · {edge.flow_data.percent_solids.toFixed(2)}%Cp
                  </div>
                </button>
              );
            })}

            {/* CAPA 4: EQUIPOS DE CUERPO COMPLETO (El icono ES la figura completa + cuadrito arriba + dato clave dentro + nombre abajo) */}
            {flowsheet.nodes.map((node, idx) => {
              const diag = diagMap.get(node.id);
              const isSelected = node.id === selectedNodeId;
              const isConnectingSource = node.id === connectingSourceNodeId;

              const badgeBorder =
                diag?.status === 'unbalanced'
                  ? 'border-rose-500 bg-rose-950/95 text-rose-200'
                  : diag?.status === 'warning'
                  ? 'border-amber-400 bg-amber-950/95 text-amber-200'
                  : 'border-slate-600 bg-slate-900/95 text-slate-100';

              // Dato resumido clave que va dentro/sobre el cuerpo del equipo o en su placa
              const outFeed =
                node.type === 'feed_source'
                  ? flowsheet.edges.find((e) => e.source_node_id === node.id)
                  : undefined;
              const quickMetric =
                node.parameters.dim_width_m && node.parameters.dim_height_m
                  ? `${node.parameters.dim_width_m}×${node.parameters.dim_height_m}m`
                  : outFeed
                  ? outFeed.flow_data.solids_tph > 0
                    ? `${outFeed.flow_data.solids_tph.toFixed(2)} t/h`
                    : `${outFeed.flow_data.water_m3h.toFixed(2)} m³/h`
                  : node.parameters.feed_solids_tph !== undefined
                  ? `${node.parameters.feed_solids_tph} t/h`
                  : node.parameters.split_ratio_primary !== undefined
                  ? `Split ${Math.round(node.parameters.split_ratio_primary * 100)}%`
                  : node.parameters.mass_pull_pct !== undefined
                  ? `Pull ${node.parameters.mass_pull_pct}%`
                  : node.parameters.target_underflow_cp !== undefined
                  ? `UF ${node.parameters.target_underflow_cp}%Cp`
                  : node.parameters.added_water_m3h
                  ? `+${node.parameters.added_water_m3h} m³/h`
                  : null;

              return (
                <div
                  key={`node-card-${node.id}-${idx}`}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  style={{
                    left: `${node.position_x}px`,
                    top: `${node.position_y}px`,
                  }}
                  className={`group absolute z-10 w-[188px] flex flex-col items-center select-none cursor-grab active:cursor-grabbing transition-transform ${
                    isSelected ? 'scale-[1.04]' : ''
                  }`}
                >
                  {/* CUADRITO SUPERIOR DEL EQUIPO (Tag + Estado Cierre + Botones Configurar/Conectar) */}
                  <div
                    title={
                      diag && !diag.isBoundary && diag.failingVariables.length > 0
                        ? `Desbalance en: ${diag.failingVariables.join(', ')}`
                        : `${node.tag} — ${node.name}`
                    }
                    className={`px-2 py-0.5 rounded border flex items-center justify-between gap-2 text-[10px] font-mono shadow-md ${badgeBorder} ${
                      isSelected ? 'ring-2 ring-cyan-400 border-cyan-400' : ''
                    } ${isConnectingSource ? 'ring-2 ring-amber-400 border-amber-400' : ''}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-cyan-300 shrink-0">{node.tag}</span>
                      {diag && !diag.isBoundary && (
                        <span
                          className={`px-1 rounded text-[9px] font-bold ${
                            diag.isBalanced
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/30 text-rose-200'
                          }`}
                        >
                          {diag.isBalanced
                            ? 'OK'
                            : `Δ${diag.maxError_pct.toFixed(2)}%`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNodeId(node.id);
                          setSelectedStreamId(null);
                          setSelectedAnnotationId(null);
                          setIsRightPanelOpen(true);
                        }}
                        title={`Configurar cálculo de ${node.tag}`}
                        className="px-1 py-0.5 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 transition-colors cursor-pointer"
                      >
                        <Settings2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConnectingSourceNodeId(
                            connectingSourceNodeId === node.id ? null : node.id
                          );
                        }}
                        title={`Conectar corriente de salida desde ${node.tag}`}
                        className="px-1 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-400 hover:text-slate-950 text-cyan-300 font-semibold transition-colors cursor-pointer flex items-center gap-0.5"
                      >
                        <Link2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* SILUETA COMPLETA Y GRANDE DEL EQUIPO (Sin cuadrado envolvente, con placa de dato dentro del icono) */}
                  <div
                    className={`relative w-[184px] h-[102px] flex items-center justify-center filter drop-shadow-md transition-all ${
                      isSelected ? 'drop-shadow-[0_0_12px_rgba(34,211,238,0.55)]' : ''
                    }`}
                  >
                    <EquipmentSymbolSvg
                      type={node.type}
                      customDrawing={node.custom_drawing}
                      className="w-full h-full"
                    />

                    {/* Placa compacta con parámetro operativo dentro del cuerpo del icono */}
                    {quickMetric && (
                      <div className="absolute bottom-3.5 px-1.5 py-0.2 rounded bg-slate-950/90 border border-amber-400/60 text-[9px] font-mono font-bold text-amber-300 shadow-xs pointer-events-none">
                        {quickMetric}
                      </div>
                    )}
                  </div>

                  {/* ETIQUETA INFERIOR CON EL NOMBRE COMPLETO DEL EQUIPO (como "Rod Mill A" en tu imagen) */}
                  <div className="-mt-1.5 px-2.5 py-0.5 rounded bg-slate-950/90 border border-slate-800 text-center max-w-[198px] shadow-xs">
                    <div className="text-[11px] font-bold text-slate-100 leading-tight">
                      {node.name}
                    </div>
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

      {/* COLUMNA DERECHA COLAPSABLE (330-395px): Configuración de Cálculo por Equipo, Corriente o Zona */}
      {isRightPanelOpen && (
        <aside className="w-full md:w-[330px] xl:w-[395px] shrink-0 bg-slate-900/95 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col overflow-y-auto z-20">
          {/* Barra superior del Inspector Derecho con botón para cerrar */}
          <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
            <span className="text-[11px] font-mono text-cyan-400 font-semibold tracking-wide">
              {selectedNode
                ? `CONFIGURACIÓN DE EQUIPO (${selectedNode.tag})`
                : selectedStream
                ? `BALANCE DE CORRIENTE (${selectedStream.id})`
                : selectedAnnotation
                ? 'EDITOR DE ZONA MANUAL'
                : 'INSPECTOR DE PROCESOS'}
            </span>
            <button
              type="button"
              onClick={() => setIsRightPanelOpen(false)}
              title="Ocultar panel derecho para ver el diagrama completo"
              aria-label="Ocultar panel derecho"
              className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
            >
              <span className="hidden sm:inline">Ocultar</span>
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>

          {selectedNode && selectedNodeDiag ? (
            <div className="p-4 space-y-5">
              {/* 1. Identificación e Icono del Equipo Seleccionado */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-cyan-300 shrink-0">
                  <EquipmentSymbolSvg
                    type={selectedNode.type}
                    customDrawing={selectedNode.custom_drawing}
                    className="w-14 h-10"
                  />
                </div>
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
                    <span className="text-[11px] text-slate-400 truncate">
                      {selectedNode.category}
                    </span>
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

              {/* 2. UTILIDADES Y PARÁMETROS ESPECÍFICOS DE CÁLCULO SEGÚN EL TIPO DE EQUIPO */}
              <div className="p-3.5 rounded bg-slate-950 border border-cyan-500/40 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5" />
                    PARÁMETROS DE CÁLCULO DEL EQUIPO
                  </span>
                </div>

                {/* ROL A: ALIMENTACIÓN INICIAL (Feed Source - Fuente Única de Verdad en su Corriente de Salida) */}
                {selectedNodeRole === 'feed_generator' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400">
                      {selectedFeedOutEdge
                        ? `Fuente única de verdad sincronizada con la corriente ${selectedFeedOutEdge.id}:`
                        : 'Define la corriente inicial de alimentación o caudal de agua/solución:'}
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Sólidos Iniciales (t/h)
                        </label>
                        <input
                          type="number"
                          step="25"
                          min="0"
                          value={
                            selectedFeedOutEdge
                              ? selectedFeedOutEdge.flow_data.solids_tph
                              : selectedNode.parameters.feed_solids_tph ?? 1800
                          }
                          onChange={(e) =>
                            handleFeedNodeStreamChange(
                              'solids_tph',
                              e.target.value,
                              'from_solids_and_cp'
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          % Sólidos (%Cp)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={
                            selectedFeedOutEdge
                              ? selectedFeedOutEdge.flow_data.percent_solids
                              : selectedNode.parameters.feed_cp_pct ?? 97
                          }
                          onChange={(e) =>
                            handleFeedNodeStreamChange(
                              'percent_solids',
                              e.target.value,
                              'from_solids_and_cp'
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-cyan-300 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Caudal Agua/Sol. (m³/h)
                        </label>
                        <input
                          type="number"
                          step="10"
                          min="0"
                          value={
                            selectedFeedOutEdge
                              ? selectedFeedOutEdge.flow_data.water_m3h
                              : selectedNode.parameters.feed_water_m3h ?? 55.67
                          }
                          onChange={(e) =>
                            handleFeedNodeStreamChange(
                              'water_m3h',
                              e.target.value,
                              'from_solids_and_water'
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-sky-300 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Ley Cabeza (% Cu)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          value={
                            selectedFeedOutEdge
                              ? selectedFeedOutEdge.flow_data.assay.cu_pct
                              : selectedNode.parameters.feed_cu_pct ?? 0.85
                          }
                          onChange={(e) =>
                            handleFeedNodeStreamChange(
                              'cu_pct',
                              e.target.value,
                              'from_solids_and_water'
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-amber-300 tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ROL B: TRITURACIÓN Y MOLIENDA (Chancadores / Molinos SAG, Bolas, HPGR) */}
                {selectedNodeRole === 'crushing_grinding' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400">
                      Configura la reducción granulométrica (Ley de Bond) y el caudal de agua o
                      solución agregada directamente en el equipo:
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Agua/Sol. Agregada (m³/h)
                        </label>
                        <input
                          type="number"
                          step="10"
                          min="0"
                          value={selectedNode.parameters.added_water_m3h ?? 0}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'added_water_m3h',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-sky-500/60 rounded text-xs font-mono text-sky-300 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Work Index Wi (kWh/t)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="5"
                          max="30"
                          value={selectedNode.parameters.bond_wi_kwht ?? 15.5}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'bond_wi_kwht',
                              parseFloat(e.target.value) || 15
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Tamaño Entrada F80 (mm)
                        </label>
                        <input
                          type="number"
                          step="5"
                          min="1"
                          value={selectedNode.parameters.f80_mm ?? 120}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'f80_mm',
                              parseFloat(e.target.value) || 100
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Producto P80 (µm)
                        </label>
                        <input
                          type="number"
                          step="50"
                          min="20"
                          value={selectedNode.parameters.p80_um ?? 1800}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'p80_um',
                              parseFloat(e.target.value) || 1000
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-cyan-300 tabular-nums"
                        />
                      </div>
                    </div>

                    {selectedNodeDiag.calculatedBondPower_kw !== undefined && (
                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">Potencia Bond Calculada:</span>
                        <span className="text-amber-300 font-semibold tabular-nums">
                          {selectedNodeDiag.calculatedBondPower_kw.toLocaleString()} kW
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ROL C: CLASIFICACIÓN DE TAMAÑO (Hidrociclones y Zarandas) */}
                {selectedNodeRole === 'size_classifier' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400">
                      Configura la partición de sólidos hacia la primera salida (Overflow/Pasante)
                      y el % de sólidos objetivo en el Underflow (Gruesos):
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          % Sólidos a Salida 1 (Overflow)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="5"
                          max="95"
                          value={Math.round(
                            (selectedNode.parameters.split_ratio_primary ?? 0.65) * 100
                          )}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'split_ratio_primary',
                              Math.min(0.95, Math.max(0.05, (parseFloat(e.target.value) || 65) / 100))
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-cyan-300 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          %Cp Descarga Gruesos (UF)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="30"
                          max="88"
                          value={selectedNode.parameters.target_underflow_cp ?? 75}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'target_underflow_cp',
                              parseFloat(e.target.value) || 75
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-amber-300 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Tamaño Corte d50 (µm)
                        </label>
                        <input
                          type="number"
                          step="10"
                          min="10"
                          value={selectedNode.parameters.cut_size_d50_um ?? 150}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'cut_size_d50_um',
                              parseFloat(e.target.value) || 150
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Agua Agregada (m³/h)
                        </label>
                        <input
                          type="number"
                          step="5"
                          min="0"
                          value={selectedNode.parameters.added_water_m3h ?? 0}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'added_water_m3h',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-sky-300 tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ROL D: FLOTACIÓN, LIXIVIACIÓN Y CONCENTRACIÓN */}
                {selectedNodeRole === 'concentration_leach' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400">
                      Define la recuperación metalúrgica, el Mass Pull al concentrado y el caudal
                      de solución/agua agregada:
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Recuperación Metal (%R)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="10"
                          max="99"
                          value={selectedNode.parameters.metal_recovery_pct ?? 90}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'metal_recovery_pct',
                              parseFloat(e.target.value) || 88
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-emerald-500/60 rounded text-xs font-mono text-emerald-300 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Mass Pull a Conc. (%)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="90"
                          value={selectedNode.parameters.mass_pull_pct ?? 10}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'mass_pull_pct',
                              parseFloat(e.target.value) || 10
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-cyan-300 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          % Sólidos Concentrado (%Cp)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="15"
                          max="75"
                          value={selectedNode.parameters.concentrate_cp_pct ?? 40}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'concentrate_cp_pct',
                              parseFloat(e.target.value) || 40
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Solución / Agua Adic. (m³/h)
                        </label>
                        <input
                          type="number"
                          step="5"
                          min="0"
                          value={selectedNode.parameters.added_water_m3h ?? 0}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'added_water_m3h',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-sky-300 tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ROL E: ESPESADORES Y FILTROS PRENSA (Separación Sólido-Líquido) */}
                {selectedNodeRole === 'dewatering' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400">
                      Ingresa el % de sólidos objetivo en el Underflow/Queque para calcular
                      automáticamente cuánta agua se recupera en el Overflow:
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          %Cp Descarga Underflow
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="35"
                          max="95"
                          value={selectedNode.parameters.target_underflow_cp ?? 65}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'target_underflow_cp',
                              parseFloat(e.target.value) || 65
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-cyan-500/60 rounded text-xs font-mono text-cyan-300 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Agua Floculante Adic. (m³/h)
                        </label>
                        <input
                          type="number"
                          step="5"
                          min="0"
                          value={selectedNode.parameters.added_water_m3h ?? 0}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'added_water_m3h',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-sky-300 tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ROL F: DIVISORES, MEZCLADORES, BOMBAS Y SALIDAS */}
                {(selectedNodeRole === 'flow_splitter' ||
                  selectedNodeRole === 'mixer_pump' ||
                  selectedNodeRole === 'output_sink') && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      {selectedNodeRole === 'flow_splitter' && (
                        <div>
                          <label className="block text-[11px] text-slate-300 mb-1">
                            % Flujo a Salida Primaria
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="5"
                            max="95"
                            value={Math.round(
                              (selectedNode.parameters.split_ratio_primary ?? 0.5) * 100
                            )}
                            onChange={(e) =>
                              handleNodeParameterChange(
                                'split_ratio_primary',
                                (parseFloat(e.target.value) || 50) / 100
                              )
                            }
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-cyan-300 tabular-nums"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Agua/Sol. Agregada (m³/h)
                        </label>
                        <input
                          type="number"
                          step="5"
                          min="0"
                          value={selectedNode.parameters.added_water_m3h ?? 0}
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'added_water_m3h',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-sky-300 tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* MEDIDAS FÍSICAS E INPUTS PERSONALIZADOS CREADOS EN EL ESTUDIO CAD */}
                {selectedNode.custom_drawing && (
                  <div className="pt-2.5 border-t border-slate-800 space-y-2.5">
                    <div className="text-[11px] font-mono text-amber-300 font-semibold">
                      DIMENSIONES CAD & INPUTS PROPIOS DEL EQUIPO
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Ancho/Ø (m)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={
                            selectedNode.parameters.dim_width_m ??
                            selectedNode.custom_drawing.dimensions.width_m
                          }
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'dim_width_m',
                              parseFloat(e.target.value) || 1,
                              false
                            )
                          }
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-amber-300 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Largo/Alto (m)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={
                            selectedNode.parameters.dim_height_m ??
                            selectedNode.custom_drawing.dimensions.height_m
                          }
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'dim_height_m',
                              parseFloat(e.target.value) || 1,
                              false
                            )
                          }
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-amber-300 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Volumen (m³)
                        </label>
                        <input
                          type="number"
                          step="5"
                          value={
                            selectedNode.parameters.dim_volume_m3 ??
                            selectedNode.custom_drawing.dimensions.volume_m3 ??
                            0
                          }
                          onChange={(e) =>
                            handleNodeParameterChange(
                              'dim_volume_m3',
                              parseFloat(e.target.value) || 0,
                              false
                            )
                          }
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-200 tabular-nums"
                        />
                      </div>
                    </div>

                    {selectedNode.custom_drawing.customInputs.length > 0 && (
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        {selectedNode.custom_drawing.customInputs.map((inp) => {
                          const currentVal =
                            selectedNode.parameters.custom_input_values?.[inp.id] ??
                            inp.defaultValue;

                          return (
                            <div key={inp.id}>
                              <label className="block text-[11px] text-slate-300 mb-1 truncate">
                                {inp.label} ({inp.unit})
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={currentVal}
                                onChange={(e) => {
                                  const num = parseFloat(e.target.value) || 0;
                                  const nextCustomVals = {
                                    ...(selectedNode.parameters.custom_input_values ?? {}),
                                    [inp.id]: num,
                                  };

                                  const extraPatch: Partial<EquipmentParameters> = {
                                    custom_input_values: nextCustomVals,
                                  };
                                  if (inp.roleImpact === 'added_water_m3h') {
                                    extraPatch.added_water_m3h = num;
                                  } else if (inp.roleImpact === 'split_pct') {
                                    extraPatch.split_ratio_primary = Math.min(
                                      0.95,
                                      Math.max(0.05, num / 100)
                                    );
                                  } else if (inp.roleImpact === 'target_cp_pct') {
                                    extraPatch.target_underflow_cp = num;
                                  }

                                  const updatedNodes = flowsheet.nodes.map((n) =>
                                    n.id === selectedNode.id
                                      ? {
                                          ...n,
                                          parameters: { ...n.parameters, ...extraPatch },
                                        }
                                      : n
                                  );
                                  onUpdateFlowsheet(
                                    reconcileFlowsheetMassBalance({
                                      ...flowsheet,
                                      nodes: updatedNodes,
                                    })
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 bg-slate-900 border border-cyan-500/50 rounded text-xs font-mono text-cyan-300 tabular-nums"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRunSolverWithReport}
                  className="w-full py-2 px-3 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  Calcular y Balancear Flujo (ΣE=ΣS)
                </button>
              </div>

              {/* 3. Diagnóstico Completo de Conservación de Masa, Agua y 5 Elementos en el Equipo */}
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-300">
                    AUDITORÍA DEL NODO (ΣE = ΣS)
                  </span>
                  <span
                    className={`text-xs font-mono font-semibold ${
                      selectedNodeDiag.isBalanced ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {selectedNodeDiag.isBoundary
                      ? 'FRONTERA SISTEMA'
                      : selectedNodeDiag.isBalanced
                      ? `CERRADO OK (Máx ${selectedNodeDiag.maxError_pct.toFixed(2)}%)`
                      : `DESBALANCE (${selectedNodeDiag.maxError_pct.toFixed(2)}%)`}
                  </span>
                </div>

                {!selectedNodeDiag.isBoundary && selectedNodeDiag.failingVariables.length > 0 && (
                  <div className="p-2 rounded bg-rose-950/50 border border-rose-500/60 text-[11px] font-mono text-rose-200">
                    Variables fuera de tolerancia (±{flowsheet.tolerance_pct}%):{' '}
                    <strong>{selectedNodeDiag.failingVariables.join(', ')}</strong>
                  </div>
                )}

                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Σ Sólidos Ent / Sal:</span>
                    <span className="text-slate-100 tabular-nums">
                      {selectedNodeDiag.solidsIn_tph.toFixed(2)} /{' '}
                      {selectedNodeDiag.solidsOut_tph.toFixed(2)} t/h (
                      {selectedNodeDiag.solidsError_pct.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-slate-400">Σ Agua Ent (+Adic.) / Sal:</span>
                    <span className="text-sky-300 tabular-nums">
                      {selectedNodeDiag.waterIn_m3h.toFixed(2)} /{' '}
                      {selectedNodeDiag.waterOut_m3h.toFixed(2)} m³/h (
                      {selectedNodeDiag.waterError_pct.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                {/* Tabla de cierre por elemento de ley (Cu, Au, Li, Fe, Mo) */}
                {!selectedNodeDiag.isBoundary && (
                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-[10px] font-mono text-cyan-400 mb-1.5">
                      CIERRE DE FINOS METÁLICOS POR ELEMENTO
                    </div>
                    <table className="w-full text-[10px] font-mono tabular-nums border-collapse">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800">
                          <th className="py-1 text-left">Elem.</th>
                          <th className="py-1 text-right">Σ Ent.</th>
                          <th className="py-1 text-right">Σ Sal.</th>
                          <th className="py-1 text-right">Δ Abs</th>
                          <th className="py-1 text-right">Error %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {(['Cu', 'Au', 'Li', 'Fe', 'Mo'] as const).map((sym) => {
                          const ed = selectedNodeDiag.elementDiagnostics[sym];
                          return (
                            <tr key={sym}>
                              <td className="py-1 font-bold text-slate-200">
                                {sym} ({ed.unit})
                              </td>
                              <td className="py-1 text-right text-slate-300">
                                {ed.fineIn.toFixed(3)}
                              </td>
                              <td className="py-1 text-right text-slate-300">
                                {ed.fineOut.toFixed(3)}
                              </td>
                              <td className="py-1 text-right text-slate-400">
                                {ed.delta >= 0 ? `+${ed.delta.toFixed(3)}` : ed.delta.toFixed(3)}
                              </td>
                              <td
                                className={`py-1 text-right font-semibold ${
                                  ed.isBalanced ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {ed.error_pct.toFixed(2)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 4. Conectar Nueva Corriente de Salida desde este Equipo */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-xs font-semibold text-slate-200">
                  Conectar Nueva Corriente de Salida
                </div>
                <select
                  aria-label="Seleccionar equipo destino para nueva corriente"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleCreateStreamConnection(selectedNode.id, e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
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
          ) : selectedAnnotation ? (
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
                        {selectedStream.flow_data.pulp_mass_tph.toFixed(2)}
                        <span className="text-[10px] text-slate-400 ml-1">t/h</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Caudal Pulpa</div>
                      <div className="text-sm font-mono font-semibold text-slate-100 tabular-nums">
                        {selectedStream.flow_data.pulp_vol_m3h.toFixed(2)}
                        <span className="text-[10px] text-slate-400 ml-1">m³/h</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Leyes de Mineral (5 Elementos) y Dosificación de Reactivos */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="text-xs font-semibold text-slate-200">
                  Leyes Químicas (Cu, Au, Li, Fe, Mo) y Reactivos
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="assay-cu" className="block text-[11px] text-slate-400 mb-1">
                      Ley Cobre (% Cu)
                    </label>
                    <input
                      id="assay-cu"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={selectedStream.flow_data.assay.cu_pct}
                      onChange={(e) => handleStreamDataChange('cu_pct', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-amber-300 tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="assay-au" className="block text-[11px] text-slate-400 mb-1">
                      Ley Oro (g/t Au)
                    </label>
                    <input
                      id="assay-au"
                      type="number"
                      step="0.01"
                      min="0"
                      value={selectedStream.flow_data.assay.au_gpt}
                      onChange={(e) => handleStreamDataChange('au_gpt', e.target.value)}
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
                      step="0.01"
                      min="0"
                      max="100"
                      value={selectedStream.flow_data.assay.li_pct}
                      onChange={(e) => handleStreamDataChange('li_pct', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-emerald-300 tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="assay-fe" className="block text-[11px] text-slate-400 mb-1">
                      Ley Hierro (% Fe)
                    </label>
                    <input
                      id="assay-fe"
                      type="number"
                      step="0.05"
                      min="0"
                      max="100"
                      value={selectedStream.flow_data.assay.fe_pct}
                      onChange={(e) => handleStreamDataChange('fe_pct', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-200 tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="assay-mo" className="block text-[11px] text-slate-400 mb-1">
                      Ley Molibdeno (% Mo)
                    </label>
                    <input
                      id="assay-mo"
                      type="number"
                      step="0.005"
                      min="0"
                      max="100"
                      value={selectedStream.flow_data.assay.mo_pct ?? 0}
                      onChange={(e) => handleStreamDataChange('mo_pct', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-cyan-300 tabular-nums"
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
                        handleStreamDataChange('reagent_dosage_gpt', e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-100 tabular-nums"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400 space-y-2">
              <p>
                Toca cualquier <strong className="text-cyan-300">Equipo</strong> para abrir su
                configuración de cálculo, una <strong className="text-slate-200">Corriente</strong>{' '}
                para editar su pulpa, o una <strong className="text-amber-300">Zona Manual</strong>.
              </p>
            </div>
          )}

          {/* Resumen Rápido de Estado de Todos los Equipos Internos */}
          <div className="mt-auto p-4 border-t border-slate-800 bg-slate-950/60 space-y-2">
            <div className="text-[11px] font-mono text-slate-400">
              ACCESO RÁPIDO A EQUIPOS DEL PROCESO
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {diagnostics.map((d) => (
                <button
                  key={d.nodeId}
                  type="button"
                  onClick={() => {
                    setSelectedNodeId(d.nodeId);
                    setSelectedStreamId(null);
                    setSelectedAnnotationId(null);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                    selectedNodeId === d.nodeId
                      ? 'bg-cyan-950/80 border border-cyan-500/60 text-cyan-200'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <span className="truncate">
                    {d.nodeTag} · {d.nodeName.slice(0, 20)}
                  </span>
                  <span
                    className={`tabular-nums shrink-0 ${
                      d.isBoundary
                        ? 'text-slate-400'
                        : d.isBalanced
                        ? 'text-emerald-400'
                        : 'text-rose-400 font-semibold'
                    }`}
                  >
                    {d.isBoundary
                      ? 'FRONTERA'
                      : d.isBalanced
                      ? '● OK'
                      : `▲ ${d.maxError_pct.toFixed(2)}%`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* ESTUDIO CAD PARA DISEÑAR UN NUEVO EQUIPO DESDE CERO (Forma, Medidas e Inputs) */}
      {isCreateCustomEquipOpen && (
        <CustomEquipmentCadModal
          initialName={newEquipName}
          onClose={() => setIsCreateCustomEquipOpen(false)}
          onSaveEquipment={handleSaveCustomEquipment}
        />
      )}
    </div>
  );
};

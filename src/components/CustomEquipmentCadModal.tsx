/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import {
  Circle,
  Check,
  Minus,
  PenTool,
  Plus,
  RotateCcw,
  Ruler,
  Settings2,
  Square,
  Trash2,
  Triangle,
  Wrench,
  X,
} from 'lucide-react';
import { EquipmentCatalogItem } from '../data/initialProjects';
import {
  CadMaterialStyle,
  CadPrimitiveKind,
  CustomCadPrimitive,
  CustomEquipmentDrawing,
  CustomInputFieldDef,
  EquipmentCategory,
  EquipmentParameters,
  UnitOperationRole,
} from '../types/process';
import { EquipmentSymbolSvg } from './EquipmentSymbols';

interface CustomEquipmentCadModalProps {
  initialName?: string;
  onClose: () => void;
  onSaveEquipment: (newCatalogItem: EquipmentCatalogItem) => void;
}

const CATEGORIES: EquipmentCategory[] = [
  'Comminución',
  'Separación y Concentración',
  'Manejo de Sólidos/Líquidos',
  'Bloques Genéricos',
];

const INITIAL_PRIMITIVES: CustomCadPrimitive[] = [
  {
    id: 'prim-chute-1',
    kind: 'hopper_trapezoid',
    material: 'machinery_gold',
    x: 16,
    y: 26,
    w: 36,
    h: 28,
    topRatio: 1.0,
  },
  {
    id: 'prim-body-1',
    kind: 'drum_rect',
    material: 'machinery_gold',
    x: 52,
    y: 22,
    w: 84,
    h: 58,
    hasBolts: true,
  },
  {
    id: 'prim-motor-1',
    kind: 'motor_drive',
    material: 'motor_blue',
    x: 38,
    y: 66,
    w: 32,
    h: 18,
  },
  {
    id: 'prim-skid-1',
    kind: 'skid_base',
    material: 'machinery_gold',
    x: 32,
    y: 84,
    w: 118,
    h: 10,
  },
];

export const CustomEquipmentCadModal: React.FC<CustomEquipmentCadModalProps> = ({
  initialName = '',
  onClose,
  onSaveEquipment,
}) => {
  // 1. Identidad del equipo
  const [name, setName] = useState<string>(initialName || 'Tambor Aglomerador / Equipo Especial');
  const [prefix, setPrefix] = useState<string>('EQ');
  const [category, setCategory] = useState<EquipmentCategory>('Comminución');
  const [description, setDescription] = useState<string>(
    'Equipo diseñado a medida en el Estudio CAD con dimensiones e inputs propios.'
  );

  // 2. Estado de Dibujo CAD (Grilla 180 x 110)
  const [primitives, setPrimitives] = useState<CustomCadPrimitive[]>(INITIAL_PRIMITIVES);
  const [activeTool, setActiveTool] = useState<CadPrimitiveKind>('drum_rect');
  const [activeMaterial, setActiveMaterial] = useState<CadMaterialStyle>('machinery_gold');
  const [hasBoltsOnDrum, setHasBoltsOnDrum] = useState<boolean>(true);
  const [selectedPrimId, setSelectedPrimId] = useState<string | null>(
    INITIAL_PRIMITIVES[1]?.id ?? null
  );

  // Trazado interactivo con el mouse sobre la grilla CAD
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [polyPoints, setPolyPoints] = useState<Array<{ x: number; y: number }>>([]);
  const svgCadRef = useRef<SVGSVGElement | null>(null);

  // 3. Medidas e Ingeniería (Dimensiones Reales)
  const [widthM, setWidthM] = useState<number>(4.5);
  const [heightM, setHeightM] = useState<number>(8.2);
  const [volumeM3, setVolumeM3] = useState<number>(120);
  const [capacityTph, setCapacityTph] = useState<number>(1600);
  const [powerKw, setPowerKw] = useState<number>(850);

  // 4. Puertos y Rol de Cálculo en el Balance de Masa
  const [unitRole, setUnitRole] = useState<UnitOperationRole>('crushing_grinding');
  const [inletCount, setInletCount] = useState<number>(1);
  const [outletCount, setOutletCount] = useState<number>(1);

  // 5. Inputs Personalizados del Equipo
  const [customInputs, setCustomInputs] = useState<CustomInputFieldDef[]>([
    {
      id: 'inp-water-add',
      label: 'Caudal Solución / Agua Adicional',
      unit: 'm³/h',
      defaultValue: 35,
      roleImpact: 'added_water_m3h',
    },
    {
      id: 'inp-res-time',
      label: 'Tiempo de Residencia Operativo',
      unit: 'min',
      defaultValue: 18,
      roleImpact: 'none',
    },
  ]);

  const [newInputLabel, setNewInputLabel] = useState<string>('');
  const [newInputUnit, setNewInputUnit] = useState<string>('m³/h');
  const [newInputDefault, setNewInputDefault] = useState<number>(25);
  const [newInputImpact, setNewInputImpact] =
    useState<CustomInputFieldDef['roleImpact']>('none');

  // Convierte clic del mouse a coordenadas CAD (0..180, 0..110) con Snap-to-Grid de 4 unidades
  const toCadCoords = (e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } => {
    if (!svgCadRef.current) return { x: 90, y: 55 };
    const rect = svgCadRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 180;
    const rawY = ((e.clientY - rect.top) / rect.height) * 110;
    const snap = (v: number) => Math.round(v / 4) * 4;
    return {
      x: Math.max(8, Math.min(172, snap(rawX))),
      y: Math.max(8, Math.min(102, snap(rawY))),
    };
  };

  const handleCadMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const pt = toCadCoords(e);

    if (activeTool === 'polygon_free') {
      setPolyPoints((prev) => [...prev, pt]);
      return;
    }

    setDragStart(pt);
    setDragCurrent({ x: pt.x + 16, y: pt.y + 12 });
  };

  const handleCadMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragStart) return;
    setDragCurrent(toCadCoords(e));
  };

  const handleCadMouseUp = () => {
    if (!dragStart || !dragCurrent) return;

    const id = `cad-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (activeTool === 'pipe_line') {
      const newPrim: CustomCadPrimitive = {
        id,
        kind: 'pipe_line',
        material: activeMaterial,
        x: dragStart.x,
        y: dragStart.y,
        w: Math.abs(dragCurrent.x - dragStart.x),
        h: Math.abs(dragCurrent.y - dragStart.y),
        x2: dragCurrent.x,
        y2: dragCurrent.y,
      };
      setPrimitives((prev) => [...prev, newPrim]);
      setSelectedPrimId(id);
    } else {
      const x = Math.min(dragStart.x, dragCurrent.x);
      const y = Math.min(dragStart.y, dragCurrent.y);
      const w = Math.max(16, Math.abs(dragCurrent.x - dragStart.x));
      const h = Math.max(12, Math.abs(dragCurrent.y - dragStart.y));

      const newPrim: CustomCadPrimitive = {
        id,
        kind: activeTool,
        material: activeTool === 'motor_drive' ? 'motor_blue' : activeMaterial,
        x,
        y,
        w,
        h,
        hasBolts: activeTool === 'drum_rect' ? hasBoltsOnDrum : undefined,
        topRatio: activeTool === 'hopper_trapezoid' ? 1.0 : undefined,
      };
      setPrimitives((prev) => [...prev, newPrim]);
      setSelectedPrimId(id);
    }

    setDragStart(null);
    setDragCurrent(null);
  };

  const handleFinishPolygon = () => {
    if (polyPoints.length < 3) return;
    const xs = polyPoints.map((p) => p.x);
    const ys = polyPoints.map((p) => p.y);
    const id = `cad-poly-${Date.now()}`;
    const newPrim: CustomCadPrimitive = {
      id,
      kind: 'polygon_free',
      material: activeMaterial,
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
      points: [...polyPoints],
    };
    setPrimitives((prev) => [...prev, newPrim]);
    setSelectedPrimId(id);
    setPolyPoints([]);
  };

  // Estampar piezas rápidas en 1 clic
  const handleQuickStamp = (stamp: 'motor' | 'skid' | 'hopper' | 'cyclone_cone') => {
    const id = `stamp-${Date.now()}`;
    if (stamp === 'motor') {
      setPrimitives((prev) => [
        ...prev,
        {
          id,
          kind: 'motor_drive',
          material: 'motor_blue',
          x: 24,
          y: 64,
          w: 32,
          h: 18,
        },
      ]);
    } else if (stamp === 'skid') {
      setPrimitives((prev) => [
        ...prev,
        {
          id,
          kind: 'skid_base',
          material: 'machinery_gold',
          x: 24,
          y: 86,
          w: 132,
          h: 10,
        },
      ]);
    } else if (stamp === 'hopper') {
      setPrimitives((prev) => [
        ...prev,
        {
          id,
          kind: 'hopper_trapezoid',
          material: 'machinery_gold',
          x: 44,
          y: 12,
          w: 92,
          h: 24,
          topRatio: 1.0,
        },
      ]);
    } else if (stamp === 'cyclone_cone') {
      setPrimitives((prev) => [
        ...prev,
        {
          id,
          kind: 'hopper_trapezoid',
          material: 'machinery_gold',
          x: 56,
          y: 48,
          w: 68,
          h: 44,
          topRatio: 1.0,
        },
      ]);
    }
    setSelectedPrimId(id);
  };

  const handleAddCustomInputField = () => {
    const cleanLabel = newInputLabel.trim();
    if (!cleanLabel) return;
    const item: CustomInputFieldDef = {
      id: `cinp-${Date.now()}`,
      label: cleanLabel,
      unit: newInputUnit.trim() || '-',
      defaultValue: Number(newInputDefault) || 0,
      roleImpact: newInputImpact,
    };
    setCustomInputs((prev) => [...prev, item]);
    setNewInputLabel('');
  };

  const previewCustomDrawing: CustomEquipmentDrawing = {
    primitives,
    dimensions: {
      width_m: widthM,
      height_m: heightM,
      volume_m3: volumeM3,
    },
    unitRole,
    inletCount,
    outletCount,
    customInputs,
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || 'Equipo CAD Personalizado';
    const cleanPrefix = (prefix.trim() || 'EQ').toUpperCase().slice(0, 5);

    const customValuesMap: Record<string, number> = {};
    let autoAddedWater = 0;
    let autoSplitRatio = 0.65;
    let autoTargetCp = 65;

    for (const inp of customInputs) {
      customValuesMap[inp.id] = inp.defaultValue;
      if (inp.roleImpact === 'added_water_m3h') autoAddedWater = inp.defaultValue;
      if (inp.roleImpact === 'split_pct') {
        autoSplitRatio = Math.min(0.95, Math.max(0.05, inp.defaultValue / 100));
      }
      if (inp.roleImpact === 'target_cp_pct') autoTargetCp = inp.defaultValue;
    }

    const defaultParams: EquipmentParameters = {
      capacity_max_tph: capacityTph,
      power_kw: powerKw,
      dim_width_m: widthM,
      dim_height_m: heightM,
      dim_volume_m3: volumeM3,
      added_water_m3h: autoAddedWater,
      split_ratio_primary: autoSplitRatio,
      target_underflow_cp: autoTargetCp,
      custom_input_values: customValuesMap,
    };

    const newItem: EquipmentCatalogItem = {
      type: 'mill_sag',
      category,
      name: cleanName,
      prefix: cleanPrefix,
      description: `${description} (${widthM}m × ${heightM}m)`,
      defaultParams,
      customDrawing: previewCustomDrawing,
    };

    onSaveEquipment(newItem);
  };

  const selectedPrim = primitives.find((p) => p.id === selectedPrimId) ?? null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cad-studio-title"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-md max-w-5xl w-full overflow-hidden shadow-2xl my-auto">
        {/* CABECERA DEL ESTUDIO CAD */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-cyan-400 tracking-wider uppercase">
                ESTUDIO CAD METALÚRGICO — AUTO-ESTILO INDUSTRIAL 3D
              </div>
              <h2 id="cad-studio-title" className="text-base font-semibold text-slate-100">
                Diseñar Nuevo Equipo a Medida (Forma CAD, Dimensiones e Inputs)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12">
          {/* COLUMNA IZQUIERDA (7 cols): Lienzo Interactivo AutoCAD + Herramientas Geométricas */}
          <div className="lg:col-span-7 p-4 border-b lg:border-b-0 lg:border-r border-slate-800 space-y-3.5 bg-slate-950/60">
            {/* Barra de Herramientas Geométricas CAD */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-cyan-400 font-semibold">
                  1. HERRAMIENTAS DE TRAZADO GEOMÉTRICO (ARRASTRA EN LA GRILLA CAD)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPrimitives((prev) => prev.slice(0, -1))}
                    disabled={primitives.length === 0}
                    className="px-2 py-1 text-[11px] font-mono bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-700 rounded inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Deshacer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrimitives([]);
                      setPolyPoints([]);
                      setSelectedPrimId(null);
                    }}
                    className="px-2 py-1 text-[11px] font-mono bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 border border-rose-500/40 rounded inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Limpiar Lienzo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {(
                  [
                    {
                      id: 'drum_rect',
                      label: 'Tambor / Cuerpo',
                      icon: Square,
                    },
                    {
                      id: 'hopper_trapezoid',
                      label: 'Tolva / Cono',
                      icon: Triangle,
                    },
                    {
                      id: 'flywheel_circle',
                      label: 'Rodillo / Volante',
                      icon: Circle,
                    },
                    {
                      id: 'pipe_line',
                      label: 'Tubería / Eje',
                      icon: Minus,
                    },
                    {
                      id: 'polygon_free',
                      label: 'Polilínea CAD',
                      icon: PenTool,
                    },
                  ] as const
                ).map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setActiveTool(t.id);
                        setPolyPoints([]);
                      }}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                        activeTool === t.id
                          ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-semibold'
                          : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selector de Material Industrial (Auto-Sombreado 3D) y Piezas Rápidas */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400">MATERIAL:</span>
                  {(
                    [
                      { id: 'machinery_gold', label: 'Amarillo Ocre 3D', dot: 'bg-yellow-400' },
                      { id: 'motor_blue', label: 'Azul Motor', dot: 'bg-blue-500' },
                      { id: 'dark_steel', label: 'Acero Carbono', dot: 'bg-slate-500' },
                      { id: 'process_cyan', label: 'Cian Proceso', dot: 'bg-sky-400' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveMaterial(m.id)}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] border cursor-pointer ${
                        activeMaterial === m.id
                          ? 'bg-slate-800 border-cyan-400 text-white font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>

                {activeTool === 'drum_rect' && (
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasBoltsOnDrum}
                      onChange={(e) => setHasBoltsOnDrum(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-400"
                    />
                    <span>Incluir pernos/liners</span>
                  </label>
                )}
              </div>
            </div>

            {/* SUPERFICIE DE DIBUJO CAD MILIMETRADA */}
            <div className="relative rounded-md border-2 border-cyan-500/40 bg-[#050C1A] overflow-hidden shadow-inner">
              <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-cyan-300">
                  GRILLA CAD 180×110 (SNAP 4px) —{' '}
                  {activeTool === 'polygon_free'
                    ? 'Haz clic punto por punto para trazar polígono'
                    : 'Haz clic y arrastra para dibujar pieza industrial'}
                </span>
                <span className="text-amber-300">
                  Cotas: {widthM}m × {heightM}m
                </span>
              </div>

              {activeTool === 'polygon_free' && polyPoints.length > 0 && (
                <div className="px-3 py-1 bg-amber-500/20 border-b border-amber-400/40 flex items-center justify-between text-xs text-amber-200">
                  <span>{polyPoints.length} vértices marcados en polilínea</span>
                  <button
                    type="button"
                    onClick={handleFinishPolygon}
                    className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-semibold rounded text-[11px] cursor-pointer"
                  >
                    Cerrar y Crear Polígono
                  </button>
                </div>
              )}

              <div className="relative h-[250px] flex items-center justify-center p-2 select-none">
                {/* Fondo milimetrado AutoCAD */}
                <svg
                  ref={svgCadRef}
                  viewBox="0 0 180 110"
                  onMouseDown={handleCadMouseDown}
                  onMouseMove={handleCadMouseMove}
                  onMouseUp={handleCadMouseUp}
                  className="w-full h-full cursor-crosshair"
                >
                  <defs>
                    <pattern id="cad-minor-grid" width="8" height="8" patternUnits="userSpaceOnUse">
                      <path
                        d="M 8 0 L 0 0 0 8"
                        fill="none"
                        stroke="rgba(56, 189, 248, 0.09)"
                        strokeWidth="0.4"
                      />
                    </pattern>
                    <pattern id="cad-major-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                      <rect width="32" height="32" fill="url(#cad-minor-grid)" />
                      <path
                        d="M 32 0 L 0 0 0 32"
                        fill="none"
                        stroke="rgba(56, 189, 248, 0.22)"
                        strokeWidth="0.6"
                      />
                    </pattern>
                  </defs>

                  <rect width="180" height="110" fill="url(#cad-major-grid)" />

                  {/* Ejes centrales de referencia CAD */}
                  <line
                    x1="90"
                    y1="0"
                    x2="90"
                    y2="110"
                    stroke="rgba(34, 211, 238, 0.25)"
                    strokeWidth="0.5"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1="0"
                    y1="55"
                    x2="180"
                    y2="55"
                    stroke="rgba(34, 211, 238, 0.25)"
                    strokeWidth="0.5"
                    strokeDasharray="3 3"
                  />

                  {/* Render en vivo del equipo con el mismo estilo industrial */}
                  <EquipmentSymbolSvg
                    type="mill_sag"
                    customDrawing={previewCustomDrawing}
                    showDimensionsOverlay
                  />

                  {/* Previsualización mientras el usuario arrastra el mouse */}
                  {dragStart && dragCurrent && activeTool !== 'pipe_line' && (
                    <rect
                      x={Math.min(dragStart.x, dragCurrent.x)}
                      y={Math.min(dragStart.y, dragCurrent.y)}
                      width={Math.abs(dragCurrent.x - dragStart.x)}
                      height={Math.abs(dragCurrent.y - dragStart.y)}
                      fill="rgba(34, 211, 238, 0.18)"
                      stroke="#22D3EE"
                      strokeWidth="1"
                      strokeDasharray="3 2"
                    />
                  )}
                  {dragStart && dragCurrent && activeTool === 'pipe_line' && (
                    <line
                      x1={dragStart.x}
                      y1={dragStart.y}
                      x2={dragCurrent.x}
                      y2={dragCurrent.y}
                      stroke="#22D3EE"
                      strokeWidth="3"
                      strokeDasharray="3 2"
                    />
                  )}

                  {/* Puntos activos de polilínea */}
                  {polyPoints.length > 0 && (
                    <g>
                      <polyline
                        points={polyPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="rgba(250, 204, 21, 0.2)"
                        stroke="#FACC15"
                        strokeWidth="1.5"
                      />
                      {polyPoints.map((p, idx) => (
                        <circle key={idx} cx={p.x} cy={p.y} r="2.2" fill="#22D3EE" />
                      ))}
                    </g>
                  )}
                </svg>
              </div>

              {/* Barra inferior del lienzo CAD: Sellos Industriales en 1 clic + Piezas creadas */}
              <div className="px-3 py-2 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-slate-400">AGREGAR PIEZA RÁPIDA:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickStamp('motor')}
                    className="px-2 py-0.5 text-[11px] bg-blue-950/70 hover:bg-blue-900/80 text-blue-200 border border-blue-500/40 rounded cursor-pointer"
                  >
                    + Motor Azul
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickStamp('skid')}
                    className="px-2 py-0.5 text-[11px] bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border border-amber-500/40 rounded cursor-pointer"
                  >
                    + Base / Skid
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickStamp('hopper')}
                    className="px-2 py-0.5 text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer"
                  >
                    + Tolva Superior
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickStamp('cyclone_cone')}
                    className="px-2 py-0.5 text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer"
                  >
                    + Cono Inferior
                  </button>
                </div>

                {selectedPrim && (
                  <button
                    type="button"
                    onClick={() => {
                      setPrimitives((prev) => prev.filter((p) => p.id !== selectedPrim.id));
                      setSelectedPrimId(null);
                    }}
                    className="text-[11px] font-mono text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    Eliminar última pieza seleccionada
                  </button>
                )}
              </div>
            </div>

            {/* 2. MEDIDAS Y DIMENSIONES REALES DEL EQUIPO */}
            <div className="p-3 rounded bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div className="text-[11px] font-mono text-cyan-400 font-semibold flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5" />
                2. MEDIDAS FÍSICAS Y CAPACIDAD DE DISEÑO DEL EQUIPO
              </div>
              <div className="grid grid-cols-5 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Ancho / Ø (m)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={widthM}
                    onChange={(e) => setWidthM(parseFloat(e.target.value) || 1)}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-cyan-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Largo / Alto (m)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={heightM}
                    onChange={(e) => setHeightM(parseFloat(e.target.value) || 1)}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-cyan-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Volumen Útil (m³)
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={volumeM3}
                    onChange={(e) => setVolumeM3(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Capacidad (t/h)
                  </label>
                  <input
                    type="number"
                    step="50"
                    min="1"
                    value={capacityTph}
                    onChange={(e) => setCapacityTph(parseFloat(e.target.value) || 100)}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Potencia (kW)
                  </label>
                  <input
                    type="number"
                    step="25"
                    min="0"
                    value={powerKw}
                    onChange={(e) => setPowerKw(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-amber-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA (5 cols): Nombre, Puertos, Rol de Cálculo e Inputs Personalizados */}
          <div className="lg:col-span-5 p-4 flex flex-col justify-between space-y-4 bg-slate-900">
            <div className="space-y-3.5">
              {/* Identificación y Categoría */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-mono text-cyan-400 font-semibold">
                  3. IDENTIDAD DEL EQUIPO Y PUERTOS DE CONEXIÓN
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Nombre del Equipo
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: Tambor Aglomerador / Columna Cobre"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-semibold text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Prefijo Tag
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                      placeholder="Ej: AG"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-cyan-300 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Categoría
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      N° Entradas (Inlets)
                    </label>
                    <select
                      value={inletCount}
                      onChange={(e) => setInletCount(Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-sky-300"
                    >
                      <option value={1}>1 Entrada</option>
                      <option value={2}>2 Entradas</option>
                      <option value={3}>3 Entradas</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      N° Salidas (Outlets)
                    </label>
                    <select
                      value={outletCount}
                      onChange={(e) => setOutletCount(Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-emerald-300"
                    >
                      <option value={1}>1 Salida (Directa)</option>
                      <option value={2}>2 Salidas (UF/OF)</option>
                      <option value={3}>3 Salidas</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Comportamiento Matemático en el Balance de Masa */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <label className="block text-[11px] font-mono text-cyan-400 font-semibold">
                  4. FÓRMULA DE CÁLCULO EN EL BALANCE DE MASA
                </label>
                <select
                  value={unitRole}
                  onChange={(e) => setUnitRole(e.target.value as UnitOperationRole)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-cyan-500/50 rounded text-xs text-slate-100"
                >
                  <option value="crushing_grinding">
                    Conminución / Acondicionamiento (Suma Entradas + Agua/Solución Adicional)
                  </option>
                  <option value="size_classifier">
                    Clasificador / Separador 2 Salidas (Partición % Split Sólidos y %Cp Descarga)
                  </option>
                  <option value="concentration_leach">
                    Concentración / Lixiviación (% Recuperación Metalúrgica + Mass Pull)
                  </option>
                  <option value="dewatering">
                    Desaguado / Espesamiento / Filtrado (%Cp Objetivo en Queque + Agua Recuperada)
                  </option>
                  <option value="feed_generator">
                    Alimentador Inicial (Genera Corriente de Entrada a la Planta)
                  </option>
                  <option value="mixer_pump">
                    Mezclador / Impulsión / Transporte (Conservación Σ Entradas = Σ Salidas)
                  </option>
                </select>
              </div>

              {/* 5. CREADOR DE INPUTS PERSONALIZADOS DEL EQUIPO */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-cyan-400 font-semibold flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5" />
                    5. INPUTS Y VARIABLES PROPIAS DEL EQUIPO
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {customInputs.length} configurados
                  </span>
                </div>

                {/* Lista de inputs personalizados actuales */}
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {customInputs.map((inp) => (
                    <div
                      key={inp.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-200 truncate">
                          {inp.label}{' '}
                          <span className="text-cyan-400 font-mono">({inp.unit})</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          Valor base: {inp.defaultValue} {inp.unit}
                          {inp.roleImpact === 'added_water_m3h' && ' · Suma al Balance de Agua'}
                          {inp.roleImpact === 'split_pct' && ' · Controla % Partición Sólidos'}
                          {inp.roleImpact === 'target_cp_pct' && ' · Fija %Cp Descarga'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCustomInputs((prev) => prev.filter((item) => item.id !== inp.id))
                        }
                        className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Agregar nuevo input personalizado */}
                <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-2">
                  <div className="text-[10px] font-mono text-slate-400">
                    + AGREGAR NUEVO INPUT QUE PEDIRÁ ESTE EQUIPO AL TOCARLO:
                  </div>
                  <div className="grid grid-cols-12 gap-1.5">
                    <input
                      type="text"
                      value={newInputLabel}
                      onChange={(e) => setNewInputLabel(e.target.value)}
                      placeholder="Nombre (ej. Dosis Ácido, Presión, RPM)"
                      className="col-span-6 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100"
                    />
                    <input
                      type="text"
                      value={newInputUnit}
                      onChange={(e) => setNewInputUnit(e.target.value)}
                      placeholder="Unidad (kg/t)"
                      className="col-span-3 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-cyan-300"
                    />
                    <input
                      type="number"
                      step="any"
                      value={newInputDefault}
                      onChange={(e) => setNewInputDefault(parseFloat(e.target.value) || 0)}
                      placeholder="Valor"
                      className="col-span-3 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={newInputImpact}
                      onChange={(e) =>
                        setNewInputImpact(e.target.value as CustomInputFieldDef['roleImpact'])
                      }
                      className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300"
                    >
                      <option value="none">Efecto: Variable Operativa / Informativa</option>
                      <option value="added_water_m3h">
                        Efecto en Balance: Sumar como Caudal de Agua/Solución (m³/h)
                      </option>
                      <option value="split_pct">
                        Efecto en Balance: Usar como % Partición de Sólidos (Split %)
                      </option>
                      <option value="target_cp_pct">
                        Efecto en Balance: Usar como %Cp Objetivo de Descarga
                      </option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddCustomInputField}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 font-semibold text-xs rounded inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Añadir Input
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de Acción Final */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded inline-flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Guardar Diseño CAD e Insertar en Lienzo
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

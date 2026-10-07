/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Download,
  FileCode2,
  FileSpreadsheet,
  Search,
} from 'lucide-react';
import {
  Flowsheet,
  NodeBalanceDiagnostics,
  Project,
  StreamEdge,
} from '../types/process';
import {
  exportFlowsheetToPrintablePdf,
  exportFlowsheetToSvg,
  exportProfessionalExcelSheet,
  exportProjectModelToJson,
} from '../utils/exportTools';
import {
  computeDerivedSlurryProperties,
  parseSafeEngineeringNumber,
} from '../utils/massBalanceMath';

interface MassBalanceMatrixProps {
  project: Project;
  flowsheet: Flowsheet;
  diagnostics: NodeBalanceDiagnostics[];
  onUpdateFlowsheet: (updated: Flowsheet) => void;
  onAutoReconcile: () => void;
}

export const MassBalanceMatrix: React.FC<MassBalanceMatrixProps> = ({
  project,
  flowsheet,
  diagnostics,
  onUpdateFlowsheet,
  onAutoReconcile,
}) => {
  const [searchStream, setSearchStream] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | StreamEdge['stream_type']>('all');

  const nodeMap = new Map(flowsheet.nodes.map((n) => [n.id, n]));

  const filteredEdges = flowsheet.edges.filter((edge) => {
    const matchesSearch =
      edge.id.toLowerCase().includes(searchStream.toLowerCase()) ||
      edge.name.toLowerCase().includes(searchStream.toLowerCase());
    const matchesType = typeFilter === 'all' || edge.stream_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleInlineCellEdit = (
    edgeId: string,
    field: 'solids_tph' | 'percent_solids' | 'water_m3h' | 'cu_pct' | 'au_gpt' | 'li_pct' | 'fe_pct' | 'mo_pct',
    rawVal: string
  ) => {
    const val = parseSafeEngineeringNumber(rawVal, 0);
    const updatedEdges = flowsheet.edges.map((edge) => {
      if (edge.id !== edgeId) return edge;
      const d = edge.flow_data;
      if (
        field === 'cu_pct' ||
        field === 'au_gpt' ||
        field === 'li_pct' ||
        field === 'fe_pct' ||
        field === 'mo_pct'
      ) {
        return {
          ...edge,
          flow_data: computeDerivedSlurryProperties(
            {
              ...d,
              assay: { ...d.assay, [field]: val },
            },
            'from_solids_and_water'
          ),
        };
      }
      const mode = field === 'water_m3h' ? 'from_solids_and_water' : 'from_solids_and_cp';
      return {
        ...edge,
        flow_data: computeDerivedSlurryProperties(
          {
            ...d,
            [field]: val,
          },
          mode
        ),
      };
    });

    onUpdateFlowsheet({
      ...flowsheet,
      edges: updatedEdges,
    });
  };

  const internalNodes = diagnostics.filter((d) => !d.isBoundary);
  const allBalanced = internalNodes.every((d) => d.isBalanced);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-8">
      {/* Cabecera de Módulo 3 & 4 */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="space-y-2">
          <div className="text-xs font-mono text-cyan-400 tracking-wide">
            03. MATRIZ MAESTRA DE BALANCE DE MASA & EXPORTACIÓN DE REPORTES
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-100 tracking-tight">
            Tabla Resumen de Corrientes y Cierre Metalúrgico
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="text-slate-200 font-semibold">{project.code}</span>
            <span>·</span>
            <span>{project.client}</span>
            <span>·</span>
            <span>{project.mining_unit}</span>
            <span>·</span>
            <span className="text-cyan-400">{flowsheet.version}</span>
          </div>
        </div>

        {/* Botonera de Exportación Directa (Excel/CSV, SVG Vectorial, JSON Modelo) */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onAutoReconcile}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            <Calculator className="w-3.5 h-3.5 text-cyan-400" />
            Calcular y Balancear Flujo (ΣE=ΣS)
          </button>

          <button
            type="button"
            onClick={() => exportFlowsheetToPrintablePdf(project, flowsheet, diagnostics)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-cyan-500/50 rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Descargar Plano PDF (Sello TAGING)
          </button>

          <button
            type="button"
            onClick={() => exportFlowsheetToSvg(project, flowsheet)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            PFD Vectorial (.SVG)
          </button>

          <button
            type="button"
            onClick={() => exportProjectModelToJson(project, flowsheet)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
            Modelo (.JSON)
          </button>

          <button
            type="button"
            onClick={() => exportProfessionalExcelSheet(project, flowsheet, diagnostics)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar Planilla Excel (.XLS)
          </button>
        </div>
      </div>

      {/* Filtros de Tabla y Estado de Cierre */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-3 rounded-md">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Filtrar corrientes por ID o nombre"
            value={searchStream}
            onChange={(e) => setSearchStream(e.target.value)}
            placeholder="Buscar corriente (ej. STR-001, Overflow, Concentrado)..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'ore', label: 'Mineral' },
                { id: 'slurry', label: 'Pulpa' },
                { id: 'water', label: 'Agua' },
                { id: 'concentrate', label: 'Concentrado' },
                { id: 'tailings', label: 'Relave' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  typeFilter === tab.id
                    ? 'bg-slate-800 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TABLA MATRICIAL DE CORRIENTES (Filas = Corrientes, Columnas = Parámetros Físicos/Químicos) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/90 text-[11px] font-mono text-slate-400">
                <th className="py-3 px-2.5">ID</th>
                <th className="py-3 px-2.5">Descripción de Corriente</th>
                <th className="py-3 px-2.5">Origen → Destino</th>
                <th className="py-3 px-2 text-right">Sólidos (t/h)</th>
                <th className="py-3 px-2 text-right">Agua (m³/h)</th>
                <th className="py-3 px-2 text-right">Pulpa (t/h)</th>
                <th className="py-3 px-2 text-right">Caudal (m³/h)</th>
                <th className="py-3 px-2 text-right">% Sólidos (%Cp)</th>
                <th className="py-3 px-2 text-right">Dens. Pulpa (t/m³)</th>
                <th className="py-3 px-2 text-right text-amber-300">Ley Cu (%)</th>
                <th className="py-3 px-2 text-right text-emerald-300">Cu Fino (t/h)</th>
                <th className="py-3 px-2 text-right text-yellow-300">Au (g/t)</th>
                <th className="py-3 px-2 text-right text-purple-300">Li (%)</th>
                <th className="py-3 px-2 text-right text-orange-300">Fe (%)</th>
                <th className="py-3 px-2 text-right text-cyan-300">Mo (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs font-mono tabular-nums">
              {filteredEdges.map((edge) => {
                const d = edge.flow_data;
                const src = nodeMap.get(edge.source_node_id);
                const tgt = nodeMap.get(edge.target_node_id);
                const cuFine = (d.solids_tph * d.assay.cu_pct) / 100;

                return (
                  <tr
                    key={edge.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-2.5 font-semibold text-cyan-400 whitespace-nowrap">
                      {edge.id}
                    </td>
                    <td className="py-2.5 px-2.5 font-sans text-slate-200 min-w-[180px]">
                      {edge.name}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-400 whitespace-nowrap">
                      {src?.tag ?? '?'} → {tgt?.tag ?? '?'}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`Sólidos t/h para ${edge.id}`}
                        value={Number(d.solids_tph.toFixed(2))}
                        onChange={(e) =>
                          handleInlineCellEdit(edge.id, 'solids_tph', e.target.value)
                        }
                        className="w-20 px-1.5 py-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded text-right text-slate-100"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`Agua m3/h para ${edge.id}`}
                        value={Number(d.water_m3h.toFixed(2))}
                        onChange={(e) =>
                          handleInlineCellEdit(edge.id, 'water_m3h', e.target.value)
                        }
                        className="w-20 px-1.5 py-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded text-right text-sky-300"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-200">
                      {d.pulp_mass_tph.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-300">
                      {d.pulp_vol_m3h.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        aria-label={`Porcentaje sólidos para ${edge.id}`}
                        value={Number(d.percent_solids.toFixed(2))}
                        onChange={(e) =>
                          handleInlineCellEdit(edge.id, 'percent_solids', e.target.value)
                        }
                        className="w-16 px-1.5 py-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded text-right text-cyan-300"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-slate-100">
                      {d.pulp_density.toFixed(3)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={Number(d.assay.cu_pct.toFixed(3))}
                        onChange={(e) =>
                          handleInlineCellEdit(edge.id, 'cu_pct', e.target.value)
                        }
                        className="w-16 px-1 py-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded text-right text-amber-300"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-emerald-300">
                      {cuFine.toFixed(3)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={Number(d.assay.au_gpt.toFixed(3))}
                        onChange={(e) =>
                          handleInlineCellEdit(edge.id, 'au_gpt', e.target.value)
                        }
                        className="w-16 px-1 py-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded text-right text-yellow-300"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={Number(d.assay.li_pct.toFixed(3))}
                        onChange={(e) =>
                          handleInlineCellEdit(edge.id, 'li_pct', e.target.value)
                        }
                        className="w-14 px-1 py-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded text-right text-purple-300"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={Number(d.assay.fe_pct.toFixed(3))}
                        onChange={(e) =>
                          handleInlineCellEdit(edge.id, 'fe_pct', e.target.value)
                        }
                        className="w-14 px-1 py-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded text-right text-orange-300"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max="100"
                        value={Number(d.assay.mo_pct.toFixed(4))}
                        onChange={(e) =>
                          handleInlineCellEdit(edge.id, 'mo_pct', e.target.value)
                        }
                        className="w-16 px-1 py-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded text-right text-cyan-300"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABLA DE AUDITORÍA DE CONSERVACIÓN DE MATERIA POR NODO (Σ Entradas = Σ Salidas en Masa, Agua y 5 Elementos) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Verificación de Cierre de Balance en Nodos y Equipos (Σ Entradas = Σ Salidas)
            </h2>
            <p className="text-xs text-slate-400">
              Tolerancia configurada para el proyecto: ±{flowsheet.tolerance_pct}% sobre sólidos, agua y cada uno de los 5 elementos químicos (Cu, Au, Li, Fe, Mo).
            </p>
          </div>
          <div className="text-xs font-mono">
            {allBalanced ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                TODOS LOS NODOS Y ELEMENTOS CERRADOS (ERROR &le; {flowsheet.tolerance_pct}%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                EXISTEN DESBALANCES EN MASA O ELEMENTOS QUÍMICOS
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/90 text-[11px] font-mono text-slate-400">
                  <th className="py-2.5 px-2.5">Tag Equipo</th>
                  <th className="py-2.5 px-2.5">Nombre de Equipo / Nodo</th>
                  <th className="py-2.5 px-2 text-right">Σ Sólidos E/S (t/h)</th>
                  <th className="py-2.5 px-2 text-right">Σ Agua E/S (m³/h)</th>
                  <th className="py-2.5 px-2 text-right text-amber-300">Err Cu (%)</th>
                  <th className="py-2.5 px-2 text-right text-yellow-300">Err Au (%)</th>
                  <th className="py-2.5 px-2 text-right text-purple-300">Err Li (%)</th>
                  <th className="py-2.5 px-2 text-right text-orange-300">Err Fe (%)</th>
                  <th className="py-2.5 px-2 text-right text-cyan-300">Err Mo (%)</th>
                  <th className="py-2.5 px-2.5 text-right">Error Máx. (%)</th>
                  <th className="py-2.5 px-2.5 text-right">Estado / Variables con Falla</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs font-mono tabular-nums">
                {internalNodes.map((n) => {
                  const cuCheck = n.elementChecks.find((c) => c.key === 'cu_pct');
                  const auCheck = n.elementChecks.find((c) => c.key === 'au_gpt');
                  const liCheck = n.elementChecks.find((c) => c.key === 'li_pct');
                  const feCheck = n.elementChecks.find((c) => c.key === 'fe_pct');
                  const moCheck = n.elementChecks.find((c) => c.key === 'mo_pct');

                  const renderErrCell = (errPct: number | undefined, isOk: boolean | undefined) => {
                    const val = errPct ?? 0;
                    return (
                      <span className={isOk !== false ? 'text-emerald-400' : 'text-rose-400 font-semibold'}>
                        {val >= 0 ? `+${val.toFixed(2)}%` : `${val.toFixed(2)}%`}
                      </span>
                    );
                  };

                  return (
                    <tr key={n.nodeId} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-2.5 font-semibold text-cyan-400">{n.nodeTag}</td>
                      <td className="py-2.5 px-2.5 font-sans text-slate-200">{n.nodeName}</td>
                      <td className="py-2.5 px-2 text-right text-slate-200">
                        {n.solidsIn_tph.toFixed(2)} / {n.solidsOut_tph.toFixed(2)}
                        <span className="block text-[10px] text-slate-400">
                          Δ: {n.solidsDelta_tph >= 0 ? `+${n.solidsDelta_tph.toFixed(2)}` : n.solidsDelta_tph.toFixed(2)} ({n.solidsError_pct.toFixed(2)}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-sky-300">
                        {n.waterIn_m3h.toFixed(2)} / {n.waterOut_m3h.toFixed(2)}
                        <span className="block text-[10px] text-slate-400">
                          Δ: {n.waterDelta_m3h >= 0 ? `+${n.waterDelta_m3h.toFixed(2)}` : n.waterDelta_m3h.toFixed(2)} ({n.waterError_pct.toFixed(2)}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {renderErrCell(cuCheck?.relativeError_pct, cuCheck?.isBalanced)}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {renderErrCell(auCheck?.relativeError_pct, auCheck?.isBalanced)}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {renderErrCell(liCheck?.relativeError_pct, liCheck?.isBalanced)}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {renderErrCell(feCheck?.relativeError_pct, feCheck?.isBalanced)}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {renderErrCell(moCheck?.relativeError_pct, moCheck?.isBalanced)}
                      </td>
                      <td
                        className={`py-2.5 px-2.5 text-right font-semibold ${
                          n.maxError_pct > flowsheet.tolerance_pct ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {n.maxError_pct.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-2.5 text-right">
                        {n.isBalanced ? (
                          <span className="text-emerald-400">● NOMINAL</span>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="text-rose-400 font-semibold">▲ DESBALANCE</span>
                            {n.failingVariables.length > 0 && (
                              <span className="text-[10px] text-rose-300 font-sans">
                                Falla: {n.failingVariables.join(', ')}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

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
import { computeDerivedSlurryProperties } from '../utils/massBalanceMath';

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
    field: 'solids_tph' | 'percent_solids' | 'water_m3h' | 'cu_pct',
    val: number
  ) => {
    const updatedEdges = flowsheet.edges.map((edge) => {
      if (edge.id !== edgeId) return edge;
      const d = edge.flow_data;
      if (field === 'cu_pct') {
        return {
          ...edge,
          flow_data: computeDerivedSlurryProperties(
            {
              ...d,
              assay: { ...d.assay, cu_pct: val },
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
            Reconciliar Balance (ΣE=ΣS)
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
                <th className="py-3 px-3">ID</th>
                <th className="py-3 px-3">Descripción de Corriente</th>
                <th className="py-3 px-3">Origen → Destino</th>
                <th className="py-3 px-3 text-right">Sólidos (t/h)</th>
                <th className="py-3 px-3 text-right">Agua (m³/h)</th>
                <th className="py-3 px-3 text-right">Pulpa (t/h)</th>
                <th className="py-3 px-3 text-right">Caudal (m³/h)</th>
                <th className="py-3 px-3 text-right">% Sólidos (%Cp)</th>
                <th className="py-3 px-3 text-right">Dens. Pulpa (t/m³)</th>
                <th className="py-3 px-3 text-right">Ley Cu (%)</th>
                <th className="py-3 px-3 text-right">Ley Au (g/t)</th>
                <th className="py-3 px-3 text-right">Ley Li (%)</th>
                <th className="py-3 px-3 text-right">Cu Fino (t/h)</th>
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
                    <td className="py-2.5 px-3 font-semibold text-cyan-400 whitespace-nowrap">
                      {edge.id}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-200 min-w-[200px]">
                      {edge.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {src?.tag ?? '?'} → {tgt?.tag ?? '?'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        step="10"
                        min="0"
                        aria-label={`Sólidos t/h para ${edge.id}`}
                        value={d.solids_tph}
                        onChange={(e) =>
                          handleInlineCellEdit(
                            edge.id,
                            'solids_tph',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-20 px-1.5 py-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded text-right text-slate-100"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        step="5"
                        min="0"
                        aria-label={`Agua m3/h para ${edge.id}`}
                        value={d.water_m3h}
                        onChange={(e) =>
                          handleInlineCellEdit(
                            edge.id,
                            'water_m3h',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-20 px-1.5 py-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded text-right text-sky-300"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200">
                      {d.pulp_mass_tph.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {d.pulp_vol_m3h.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        aria-label={`Porcentaje sólidos para ${edge.id}`}
                        value={d.percent_solids}
                        onChange={(e) =>
                          handleInlineCellEdit(
                            edge.id,
                            'percent_solids',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-16 px-1.5 py-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded text-right text-cyan-300"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-100">
                      {d.pulp_density.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-300">
                      {d.assay.cu_pct.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {d.assay.au_gpt.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-300">
                      {d.assay.li_pct.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-200">
                      {cuFine.toFixed(3)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABLA DE AUDITORÍA DE CONSERVACIÓN DE MATERIA POR NODO (Σ Entradas = Σ Salidas) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Verificación de Cierre de Balance en Nodos y Equipos (Σ Entradas = Σ Salidas)
            </h2>
            <p className="text-xs text-slate-400">
              Tolerancia configurada para el proyecto: ±{flowsheet.tolerance_pct}% sobre flujos de
              sólidos y agua.
            </p>
          </div>
          <div className="text-xs font-mono">
            {allBalanced ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                TODOS LOS NODOS CERRADOS (ERROR &le; {flowsheet.tolerance_pct}%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                EXISTEN DESBALANCES EN EQUIPOS
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/90 text-[11px] font-mono text-slate-400">
                  <th className="py-2.5 px-3">Tag Equipo</th>
                  <th className="py-2.5 px-3">Nombre de Equipo / Nodo</th>
                  <th className="py-2.5 px-3 text-right">Σ Sólidos Ent. (t/h)</th>
                  <th className="py-2.5 px-3 text-right">Σ Sólidos Sal. (t/h)</th>
                  <th className="py-2.5 px-3 text-right">Δ Sólidos (t/h)</th>
                  <th className="py-2.5 px-3 text-right">Σ Agua Ent. (m³/h)</th>
                  <th className="py-2.5 px-3 text-right">Σ Agua Sal. (m³/h)</th>
                  <th className="py-2.5 px-3 text-right">Error Máx. (%)</th>
                  <th className="py-2.5 px-3 text-right">Estado Cierre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs font-mono tabular-nums">
                {internalNodes.map((n) => {
                  const maxErr = Math.max(n.solidsError_pct, n.waterError_pct);
                  return (
                    <tr key={n.nodeId} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-cyan-400">{n.nodeTag}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-200">{n.nodeName}</td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {n.solidsIn_tph.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {n.solidsOut_tph.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right ${
                          Math.abs(n.solidsDelta_tph) <= 0.1 ? 'text-slate-400' : 'text-rose-400'
                        }`}
                      >
                        {n.solidsDelta_tph > 0 ? `+${n.solidsDelta_tph.toFixed(2)}` : n.solidsDelta_tph.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-sky-300">
                        {n.waterIn_m3h.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-sky-300">
                        {n.waterOut_m3h.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {maxErr.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {n.isBalanced ? (
                          <span className="text-emerald-400">● NOMINAL</span>
                        ) : (
                          <span className="text-rose-400 font-semibold">▲ DESBALANCE</span>
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

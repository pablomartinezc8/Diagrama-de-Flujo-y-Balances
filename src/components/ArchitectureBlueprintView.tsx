/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Check, Copy, Database, GitBranch, Layers, Sigma } from 'lucide-react';
import { Flowsheet, Project } from '../types/process';

interface ArchitectureBlueprintViewProps {
  project: Project;
  flowsheet: Flowsheet;
}

export const ArchitectureBlueprintView: React.FC<ArchitectureBlueprintViewProps> = ({
  project,
  flowsheet,
}) => {
  const [copiedJson, setCopiedJson] = useState(false);

  const liveJsonPayload = JSON.stringify(
    {
      Project: {
        id: project.id,
        code: project.code,
        name: project.name,
        client: project.client,
        mining_unit: project.mining_unit,
        phase: project.phase,
        lead_engineer: project.lead_engineer,
        status: project.status,
        created_at: project.created_at,
        updated_at: project.updated_at,
      },
      Flowsheet: {
        id: flowsheet.id,
        project_id: flowsheet.project_id,
        version: flowsheet.version,
        tolerance_pct: flowsheet.tolerance_pct,
        nodes: flowsheet.nodes.slice(0, 3),
        edges: flowsheet.edges.slice(0, 3),
      },
    },
    null,
    2
  );

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify({ project, flowsheet }, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-10">
      {/* Cabecera de Especificación de Arquitectura */}
      <div className="border-b border-slate-800 pb-6 space-y-2">
        <div className="text-xs font-mono text-cyan-400 tracking-wide">
          04. ESPECIFICACIÓN DE ARQUITECTURA DE SOFTWARE, FÓRMULAS & MODELO DE DATOS
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-100 tracking-tight">
          Documentación Técnica de Ingeniería y Lógica Metalúrgica
        </h1>
        <p className="text-sm text-slate-400 max-w-3xl">
          Referencia arquitectónica integral con el Flujo de Usuario (User Journey), distribución
          de interfaz (Wireframe Layout), ecuaciones matemáticas de pulpas mineras y esquema JSON
          en vivo del proyecto activo.
        </p>
      </div>

      {/* ENTREGABLE 1: FLUJO DE USUARIO (USER JOURNEY) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-cyan-400" />
          <h2 className="text-lg font-semibold text-slate-100">
            01. Flujo de Usuario End-to-End (User Journey)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            {
              step: 'Paso 01',
              title: 'Creación y Aislamiento de Proyecto',
              desc: 'El ingeniero crea o clona un proyecto minero asignando Cliente, Código, Unidad Minera, Fase (Conceptual a Detalle) y plantilla PFD.',
              outcome: 'Estado aislado en contenedor Project + Flowsheet.',
            },
            {
              step: 'Paso 02',
              title: 'Diseño Gráfico en Lienzo PFD',
              desc: 'Arrastra equipos de Comminución, Flotación, Espesamiento o Bloques Genéricos al Canvas y los posiciona sobre la grilla.',
              outcome: 'Asignación automática de Tag ISA (ej. ML-201, CY-202).',
            },
            {
              step: 'Paso 03',
              title: 'Trazado Ortogonal de Corrientes',
              desc: 'Conecta puertos de salida y entrada entre equipos generando líneas orientadas con etiquetas STR-001, STR-002.',
              outcome: 'Grafo dirigido (DAG/Recirculación) listo para balance.',
            },
            {
              step: 'Paso 04',
              title: 'Cálculo de Pulpas y Cierre de Nodos',
              desc: 'Ingresa t/h de sólidos y %Cp (o agua m³/h) y leyes (%Cu, g/t Au, %Li). El motor calcula densidad de pulpa y verifica ΣE = ΣS.',
              outcome: 'Alertas visuales Verde/Rojo según tolerancia (±0.1%).',
            },
            {
              step: 'Paso 05',
              title: 'Matriz Resumen y Exportación',
              desc: 'Audita la tabla matricial de corrientes y exporta el Balance de Masa a Excel (.CSV), el PFD a Vectorial (.SVG) o el esquema (.JSON).',
              outcome: 'Entregable listo para revisión de ingeniería del cliente.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="p-4 rounded-md bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1.5">
                <div className="text-xs font-mono text-cyan-400 font-semibold">{item.step}</div>
                <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-emerald-400">
                → {item.outcome}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ENTREGABLE 2: FÓRMULAS MATEMÁTICAS DE PROCESO */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sigma className="w-4 h-4 text-cyan-400" />
          <h2 className="text-lg font-semibold text-slate-100">
            02. Fórmulas Matemáticas de Proceso (Pulpas Mineras y Conservación de Masa)
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="p-5 rounded-md bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-sm font-semibold text-slate-100">
              A. Relaciones Físicas de Pulpa Mineral (Sólido-Líquido)
            </h3>
            <p className="text-xs text-slate-400">
              Dado el flujo másico de sólidos secos <code className="text-cyan-300">M_s (t/h)</code>,
              el porcentaje de sólidos en peso <code className="text-cyan-300">C_p (%)</code>, la
              gravedad específica del mineral seco <code className="text-cyan-300">ρ_s (t/m³)</code>{' '}
              y la densidad del líquido/salmuera <code className="text-cyan-300">ρ_l (t/m³)</code>:
            </p>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-slate-200 space-y-2">
              <div>
                <span className="text-slate-400">1. Flujo Másico de Líquido (t/h):</span>
                <div className="text-cyan-300 mt-0.5">M_l = M_s × [ (100 - C_p) / C_p ]</div>
              </div>
              <div>
                <span className="text-slate-400">2. Caudal Volumétrico de Agua/Solución (m³/h):</span>
                <div className="text-sky-300 mt-0.5">Q_l = M_l / ρ_l</div>
              </div>
              <div>
                <span className="text-slate-400">3. Caudal Volumétrico Total de Pulpa (m³/h):</span>
                <div className="text-slate-100 mt-0.5">Q_p = (M_s / ρ_s) + Q_l</div>
              </div>
              <div>
                <span className="text-slate-400">4. Densidad de Pulpa (t/m³):</span>
                <div className="text-emerald-300 mt-0.5">
                  ρ_p = (M_s + M_l) / Q_p = 100 / [ (C_p / ρ_s) + ((100 - C_p) / ρ_l) ]
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-md bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-sm font-semibold text-slate-100">
              B. Conservación de Materia en Nodos, Mezcladores y Divisores
            </h3>
            <p className="text-xs text-slate-400">
              En estado estacionario sin acumulación, todo equipo, mezclador (Mixer) o divisor
              (Splitter / Hidrociclón / Celda de Flotación) verifica simultáneamente:
            </p>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-slate-200 space-y-2">
              <div>
                <span className="text-slate-400">1. Balance Global de Sólidos y Líquidos:</span>
                <div className="text-cyan-300 mt-0.5">
                  Σ M_s,in = Σ M_s,out &nbsp;&nbsp;|&nbsp;&nbsp; Σ Q_l,in = Σ Q_l,out
                </div>
              </div>
              <div>
                <span className="text-slate-400">
                  2. Balance de Finos Metálicos (Cu, Au, Li, Fe):
                </span>
                <div className="text-amber-300 mt-0.5">
                  Σ (M_s,in × Ley_in) = Σ (M_s,out × Ley_out)
                </div>
              </div>
              <div>
                <span className="text-slate-400">
                  3. Ley Ponderada en Mezclador (N entradas → 1 salida):
                </span>
                <div className="text-slate-100 mt-0.5">
                  Ley_out = [ Σ (M_s,i × Ley_i) ] / [ Σ M_s,i ]
                </div>
              </div>
              <div>
                <span className="text-slate-400">
                  4. Criterio de Cierre de Balance (Tolerancia ε = ±{flowsheet.tolerance_pct}%):
                </span>
                <div className="text-emerald-300 mt-0.5">
                  Error (%) = |Σ Entrada - Σ Salida| / max(Σ Entrada, Σ Salida) × 100 ≤ ε
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ENTREGABLE 3 & 4: WIREFRAME ARQUITECTÓNICO Y MODELO DE DATOS JSON EN VIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wireframe en Texto / Layout de la Interfaz */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-lg font-semibold text-slate-100">
              03. Diseño de Interfaz (Wireframe Layout de 3 Zonas)
            </h2>
          </div>

          <pre className="p-4 rounded-md bg-slate-950 border border-slate-800 font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto">
{`+-----------------------------------------------------------------------------------+
| TOP BAR: [MinFlow PFD]  |  [1.Proyectos] [2.Canvas PFD] [3.Matriz] [4.Arquitectura] |
|                         |  Selector Proyecto Activo: [${project.code}]  [Export CSV] |
+-------------------------+-----------------------------------+---------------------+
| PALETA EQUIPOS (310px)  | LIENZO INTERACTIVO PFD (Flex-1)   | INSPECTOR (380px)   |
|                         | [Estado: Cierre Nominal ΣE = ΣS]  |                     |
| [Comminución]           |                                   | CORRIENTE: STR-003  |
| [Separación/Flotación]  |  +----------+       +----------+  | ML-201 -> CY-202    |
| [Manejo Pulpas]         |  | FD-101   |--STR->| ML-201   |  |                     |
| [Bloques Genéricos]     |  | Mineral  |  001  | Molino   |  | Modo Auto-Cálculo:  |
|                         |  +----------+       +----+-----+  | [Sólidos + %Cp]     |
| +---------------------+ |                          |        |                     |
| | [SVG] Molino SAG    | |                     STR-003       | Sólidos: 1800.0 t/h |
| | [SVG] Hidrociclón   | |                          v        | %Cp:       64.29 %  |
| | [SVG] Celda Rougher | |                     +----------+  | Agua:    1000.0 m³/h|
| | [SVG] Espesador     | |                     | CY-202   |  | ---------------------|
| +---------------------+ |                     | Ciclones |  | Densidad: 1.691 t/m³|
|                         |                     +----------+  | Pulpa:   2800.0 t/h |
| Tolerancia: [± 0.10 %]  |                                   | Caudal:  1654.5 m³/h|
| [Balancear Nodos Auto]  |                      [Zoom 100%]  | Leyes: 0.85% Cu     |
+-------------------------+-----------------------------------+---------------------+`}
          </pre>
        </section>

        {/* Estructura JSON Relacional / NoSQL en Vivo */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <h2 className="text-lg font-semibold text-slate-100">
                04. Modelo de Datos JSON Activo (Project & Flowsheet)
              </h2>
            </div>
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded cursor-pointer"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar JSON Completo
                </>
              )}
            </button>
          </div>

          <pre className="p-4 rounded-md bg-slate-950 border border-slate-800 font-mono text-[11px] leading-relaxed text-cyan-300/90 overflow-x-auto max-h-[340px]">
            {liveJsonPayload}
          </pre>
        </section>
      </div>
    </div>
  );
};

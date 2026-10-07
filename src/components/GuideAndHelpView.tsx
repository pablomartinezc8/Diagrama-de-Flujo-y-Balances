/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  Compass,
  FileSpreadsheet,
  FolderKanban,
  HelpCircle,
  Layers,
  MousePointerClick,
  Play,
  Sliders,
  Workflow,
} from 'lucide-react';
import { computeDerivedSlurryProperties } from '../utils/massBalanceMath';

interface GuideAndHelpViewProps {
  onNavigateToModule: (module: 'projects' | 'canvas' | 'matrix' | 'architecture') => void;
}

export const GuideAndHelpView: React.FC<GuideAndHelpViewProps> = ({
  onNavigateToModule,
}) => {
  // Estado para el simulador interactivo de aprendizaje de pulpas en la guía
  const [demoSolids, setDemoSolids] = useState<number>(1500);
  const [demoCp, setDemoCp] = useState<number>(62);
  const [demoSg, setDemoSg] = useState<number>(2.75);

  const demoResult = computeDerivedSlurryProperties(
    {
      solids_tph: demoSolids,
      percent_solids: demoCp,
      solid_sg: demoSg,
      liquid_sg: 1.0,
      assay: { cu_pct: 0.85, au_gpt: 0.35, li_pct: 0, fe_pct: 3.8 },
    },
    'from_solids_and_cp'
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-12">
      {/* 1. CABECERA PRINCIPAL: QUÉ HACE LA PLATAFORMA */}
      <section className="border-b border-slate-800 pb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3 max-w-3xl">
          <div className="text-xs font-mono text-cyan-400 tracking-wide">
            PLATAFORMA CORPORATIVA TAGING — INGENIERÍA INTELIGENTE
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-100 tracking-tight">
            ¿Qué hace la plataforma de TAGING y cómo funciona el Balance de Masa?
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Desarrollada por <strong>TAGING — Ingeniería Inteligente</strong>, esta estación de
            trabajo interactiva permite a ingenieros de procesos construir{' '}
            <strong>Diagramas de Flujo de Procesos (PFD / Flowsheets)</strong>, dibujar zonas
            operativas personalizadas (como zonas de descarga de camiones, stockpiles o notas),
            calcular pulpas minerales y descargar planos imprimibles en{' '}
            <strong>PDF con sello oficial TAGING</strong> y <strong>Planillas Profesionales Excel (.XLS)</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateToModule('canvas')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            Ir al Lienzo PFD Ahora
          </button>
          <button
            type="button"
            onClick={() => onNavigateToModule('projects')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            <FolderKanban className="w-3.5 h-3.5 text-cyan-400" />
            Explorar Proyectos
          </button>
        </div>
      </section>

      {/* 2. RESUMEN DE LOS 4 MÓDULOS DE LA APLICACIÓN */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              01. Estructura de la Aplicación: Los 4 Módulos Principales
            </h2>
            <p className="text-xs text-slate-400">
              Cada pestaña en la barra superior cumple un rol específico dentro del flujo de
              trabajo de ingeniería:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Tarjeta Módulo 1 */}
          <div className="p-5 rounded-md bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
                <span>MÓDULO 01</span>
                <FolderKanban className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                Gestión Multiproyecto
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Administra múltiples estudios mineros en paralelo de forma totalmente aislada.
                Registra cliente, unidad minera, código, ingeniero responsable y fase de estudio
                (Conceptual, Pre-factibilidad, Factibilidad o Ingeniería de Detalle).
              </p>
              <ul className="text-xs text-slate-300 space-y-1 pt-1 font-mono">
                <li>· Crear desde plantilla Cu-Au o Litio</li>
                <li>· Clonar proyectos para sensibilidad</li>
                <li>· Archivar o filtrar por estado</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToModule('projects')}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Abrir Módulo Proyectos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tarjeta Módulo 2 */}
          <div className="p-5 rounded-md bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
                <span>MÓDULO 02</span>
                <Workflow className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                Lienzo Interactivo PFD
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                 Área gráfica donde diseñas el diagrama de flujo arrastrando equipos de
                Comminución, Flotación, Espesamiento y Manejo de Pulpas, conectándolos mediante
                corrientes ortogonales orientadas (<span className="font-mono">STR-001</span>,{' '}
                <span className="font-mono">STR-002</span>).
              </p>
              <ul className="text-xs text-slate-300 space-y-1 pt-1 font-mono">
                <li>· 19 equipos con simbología técnica</li>
                <li>· Conectores de pulpa, mineral y agua</li>
                <li>· Alertas visuales Verde/Rojo en nodos</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToModule('canvas')}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Abrir Lienzo PFD</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tarjeta Módulo 3 */}
          <div className="p-5 rounded-md bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
                <span>MÓDULO 03</span>
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                Matriz de Balance y Exportación
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tabla maestra donde cada fila es una corriente del diagrama y cada columna es un
                parámetro físico o químico editable. Incluye la auditoría de cierre por equipo y
                botones de exportación directa.
              </p>
              <ul className="text-xs text-slate-300 space-y-1 pt-1 font-mono">
                <li>· Edición rápida en tabla matricial</li>
                <li>· Exportar Planilla Excel (.XLS)</li>
                <li>· Descargar Plano PDF y PFD Vectorial (.SVG)</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToModule('matrix')}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Abrir Matriz de Balance</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tarjeta Módulo 4 */}
          <div className="p-5 rounded-md bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
                <span>MÓDULO 04</span>
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                Arquitectura & Fórmulas
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Documentación técnica con las ecuaciones metalúrgicas utilizadas por el motor de
                cálculo, el esquema de interfaz (Wireframe) y el visor en tiempo real del modelo
                de datos JSON del proyecto activo.
              </p>
              <ul className="text-xs text-slate-300 space-y-1 pt-1 font-mono">
                <li>· Ecuaciones de densidad de pulpa</li>
                <li>· Balance de finos metálicos</li>
                <li>· Inspector JSON en vivo</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToModule('architecture')}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Ver Especificación Técnica</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. GUÍA PASO A PASO: CÓMO USAR EL LIENZO Y CALCULAR BALANCES */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <h2 className="text-lg font-semibold text-slate-100">
            02. Paso a Paso: Cómo diseñar un circuito y cerrar un Balance de Masa
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="p-5 rounded-md bg-slate-900/50 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <MousePointerClick className="w-4 h-4" />
              <span>PASO 1 · INSERTAR Y CONECTAR EQUIPOS</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-100">
              Construcción del Diagrama en el Lienzo PFD
            </h3>
            <ol className="text-xs text-slate-300 space-y-2 leading-relaxed list-decimal list-inside">
              <li>
                En el panel izquierdo del <strong>Lienzo PFD</strong>, elige una categoría
                (<em>Comminución</em>, <em>Separación</em>, <em>Manejo de Pulpas</em> o{' '}
                <em>Bloques Genéricos</em>).
              </li>
              <li>
                <strong>Arrastra un equipo al lienzo</strong> (o haz clic sobre él) para crear un
                nuevo bloque con su código ISA automático (ej. <code className="text-cyan-300">ML-201</code>).
              </li>
              <li>
                Para unir dos equipos con una tubería/corriente, haz clic en el botón{' '}
                <strong className="text-cyan-300">Conectar</strong> en la esquina inferior derecha
                del equipo origen y luego haz clic sobre el equipo destino.
              </li>
            </ol>
          </div>

          <div className="p-5 rounded-md bg-slate-900/50 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Sliders className="w-4 h-4" />
              <span>PASO 2 · CONFIGURAR CORRIENTES (STREAMS)</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-100">
              Ingreso de Sólidos, Agua, %Cp y Leyes de Mineral
            </h3>
            <ol className="text-xs text-slate-300 space-y-2 leading-relaxed list-decimal list-inside">
              <li>
                Haz clic sobre cualquier etiqueta de corriente (ej.{' '}
                <code className="text-cyan-300">STR-001</code>) en el lienzo para abrir el{' '}
                <strong>Inspector de Corriente</strong> a la derecha.
              </li>
              <li>
                Elige el modo de cálculo:
                <ul className="pl-4 mt-1 space-y-1 text-slate-400">
                  <li>
                    • <strong>Fijar Sólidos + %Cp:</strong> Ingresas toneladas secas ($t/h$) y
                    concentración en peso ($\%Cp$); la app calcula el agua requerida ($m^3/h$).
                  </li>
                  <li>
                    • <strong>Fijar Sólidos + Agua:</strong> Ingresas sólidos ($t/h$) y caudal de
                    agua ($m^3/h$); la app calcula automáticamente el $\%Cp$ resultante.
                  </li>
                </ul>
              </li>
              <li>
                Ajusta la Gravedad Específica del mineral seco (ej. $2.75\ t/m^3$) y las 5 leyes
                químicas ($\%Cu$, $g/t\ Au$, $\%Li$, $\%Fe$, $\%Mo$).
              </li>
            </ol>
          </div>

          <div className="p-5 rounded-md bg-slate-900/50 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>PASO 3 · VALIDAR Y EXPORTAR ENTREGABLES</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-100">
              Diagnóstico de Cierre (ΣE = ΣS) y Planilla Excel (.XLS)
            </h3>
            <ol className="text-xs text-slate-300 space-y-2 leading-relaxed list-decimal list-inside">
              <li>
                Cada equipo interno suma sus corrientes de entrada y las compara con sus salidas en
                masa de sólidos, agua y los 5 elementos químicos (Cu, Au, Li, Fe, Mo).
              </li>
              <li>
                Si alguna variable supera la tolerancia ($\pm 0.1\%$), el equipo se marca en{' '}
                <strong className="text-rose-400">Rojo (Desbalanceado)</strong> indicando qué
                variable falla.
              </li>
              <li>
                Presiona el botón{' '}
                <strong className="text-cyan-300">Calcular y Balancear Flujo</strong> para resolver
                el circuito (incluyendo lazos cerrados por iteración de punto fijo/Wegstein) al
                $0.00\%$ de error.
              </li>
              <li>
                Finalmente, usa <strong>Descargar Plano PDF</strong>,{' '}
                <strong>Exportar Planilla Excel (.XLS)</strong>, <strong>PFD Vectorial (.SVG)</strong>{' '}
                o <strong>Modelo (.JSON)</strong>.
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* 4. SIMULADOR DIDÁCTICO INTERACTIVO: ENTENDIENDO EL MOTOR DE PULPAS */}
      <section className="p-6 rounded-md bg-slate-900/70 border border-slate-800 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs font-mono text-cyan-400">
              DEMOSTRACIÓN EN VIVO DEL MOTOR DE CÁLCULO
            </div>
            <h2 className="text-lg font-semibold text-slate-100 mt-0.5">
              03. Prueba aquí cómo funciona el Auto-Cálculo de Pulpa Mineral
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Mueve los controles para observar cómo reaccionan las ecuaciones en tiempo real
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Controles de Entrada del Simulador */}
          <div className="lg:col-span-5 space-y-4 bg-slate-950 p-4 rounded border border-slate-800">
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-cyan-400" />
              Variables de Entrada (Datos de Diseño)
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="demo-solids" className="text-slate-300">
                    Flujo de Sólidos Secos (M_s):
                  </label>
                  <span className="font-mono font-semibold text-cyan-300 tabular-nums">
                    {demoSolids} t/h
                  </span>
                </div>
                <input
                  id="demo-solids"
                  type="range"
                  min="100"
                  max="3500"
                  step="50"
                  value={demoSolids}
                  onChange={(e) => setDemoSolids(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="demo-cp" className="text-slate-300">
                    Concentración de Sólidos en Peso (%Cp):
                  </label>
                  <span className="font-mono font-semibold text-cyan-300 tabular-nums">
                    {demoCp}%
                  </span>
                </div>
                <input
                  id="demo-cp"
                  type="range"
                  min="15"
                  max="85"
                  step="1"
                  value={demoCp}
                  onChange={(e) => setDemoCp(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="demo-sg" className="text-slate-300">
                    Gravedad Específica del Mineral (ρ_s):
                  </label>
                  <span className="font-mono font-semibold text-cyan-300 tabular-nums">
                    {demoSg.toFixed(2)} t/m³
                  </span>
                </div>
                <input
                  id="demo-sg"
                  type="range"
                  min="2.2"
                  max="4.5"
                  step="0.05"
                  value={demoSg}
                  onChange={(e) => setDemoSg(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Resultados Calculados y Explicación */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">1. Agua Requerida en la Corriente</div>
              <div className="text-2xl font-mono font-semibold text-sky-400 tabular-nums">
                {demoResult.water_m3h.toFixed(2)}{' '}
                <span className="text-xs text-slate-400">m³/h</span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 font-mono">
                Fórmula: {demoSolids} × (100 - {demoCp}) / {demoCp}
              </p>
            </div>

            <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">2. Flujo Másico Total de Pulpa</div>
              <div className="text-2xl font-mono font-semibold text-slate-100 tabular-nums">
                {demoResult.pulp_mass_tph.toFixed(2)}{' '}
                <span className="text-xs text-slate-400">t/h</span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 font-mono">
                Suma: Sólidos ({demoSolids} t/h) + Agua ({demoResult.water_m3h.toFixed(1)} t/h)
              </p>
            </div>

            <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">3. Caudal Volumétrico de Pulpa</div>
              <div className="text-2xl font-mono font-semibold text-cyan-300 tabular-nums">
                {demoResult.pulp_vol_m3h.toFixed(2)}{' '}
                <span className="text-xs text-slate-400">m³/h</span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 font-mono">
                Volumen Sólido ({(demoSolids / demoSg).toFixed(1)} m³/h) + Volumen Agua
              </p>
            </div>

            <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">4. Densidad de Pulpa Resultante</div>
              <div className="text-2xl font-mono font-semibold text-emerald-400 tabular-nums">
                {demoResult.pulp_density.toFixed(3)}{' '}
                <span className="text-xs text-slate-400">t/m³</span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 font-mono">
                Relación: {demoResult.pulp_mass_tph.toFixed(1)} t/h ÷{' '}
                {demoResult.pulp_vol_m3h.toFixed(1)} m³/h
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. PREGUNTAS FRECUENTES & GLOSARIO DE SIMBOLOGÍA */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-md bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Código de Colores de Corrientes y Nodos en el Lienzo
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
              <span className="text-slate-300 font-medium">Borde Verde en Equipo (OK)</span>
              <span className="font-mono text-emerald-400">
                Cierre de masa cumplido (Error ≤ Tolerancia)
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
              <span className="text-slate-300 font-medium">Borde Rojo en Equipo (Δ%)</span>
              <span className="font-mono text-rose-400">
                Desbalance entre entradas y salidas
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
              <span className="text-slate-300 font-medium">Línea Punteada Celeste</span>
              <span className="font-mono text-sky-400">
                Corriente de Agua Fresca / Solución / Eluyente
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
              <span className="text-slate-300 font-medium">Línea Continua Esmeralda</span>
              <span className="font-mono text-emerald-400">
                Corriente de Concentrado Valioso (Cu / Li)
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-300 font-medium">Línea Continua Ámbar / Gris</span>
              <span className="font-mono text-amber-400">
                Corriente de Pulpa en Proceso o Relave (Tailings)
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-md bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Preguntas Frecuentes sobre el Funcionamiento
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <h3 className="font-semibold text-slate-200">
                ¿Dónde se guardan mis proyectos y cambios en los diagramas?
              </h3>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Todos los proyectos, posiciones de equipos y balances de masa se guardan
                automáticamente en el almacenamiento local de tu navegador (<code className="text-cyan-300">localStorage</code>) y también puedes respaldarlos en archivo físico usando el botón{' '}
                <strong>Modelo (.JSON)</strong>.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-200">
                ¿Qué hace exactamente el botón "Calcular y Balancear Flujo"?
              </h3>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Valida primero la topología del grafo (nodos aislados, corrientes huérfanas y grados de libertad) y luego resuelve el circuito desde las entradas de alimentación (<em>Feeds</em>) hacia las salidas, incluyendo lazos de recirculación mediante iteración de punto fijo/Wegstein, garantizando que masa, agua y los 5 elementos químicos (Cu, Au, Li, Fe, Mo) cumplan <span className="font-mono text-cyan-300">Σ Entradas = Σ Salidas</span> dentro de la tolerancia ($\pm 0.1\%$).
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Copy,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Flowsheet,
  Project,
  ProjectPhase,
  ProjectStatus,
} from '../types/process';

interface ProjectDashboardProps {
  projects: Project[];
  flowsheets: Record<string, Flowsheet>;
  activeProjectId: string;
  onSelectProject: (projectId: string, openCanvas?: boolean) => void;
  onCreateProject: (newProject: Omit<Project, 'id' | 'created_at' | 'updated_at'>, templateType: 'Cu-Au' | 'Li-Brine' | 'Blank') => void;
  onCloneProject: (projectId: string) => void;
  onToggleArchiveProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  projects,
  flowsheets,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onCloneProject,
  onToggleArchiveProject,
  onDeleteProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | ProjectStatus>('Todos');
  const [phaseFilter, setPhaseFilter] = useState<'Todas' | ProjectPhase>('Todas');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Form state for creating a new project
  const [formCode, setFormCode] = useState('PRJ-2026-305');
  const [formName, setFormName] = useState('');
  const [formClient, setFormClient] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formPhase, setFormPhase] = useState<ProjectPhase>('Factibilidad');
  const [formEngineer, setFormEngineer] = useState('Ing. Valentina Rojas');
  const [formCommodity, setFormCommodity] = useState<'Cu-Au' | 'Li-Brine' | 'Polimetálico Fe-Cu'>('Cu-Au');
  const [formTemplate, setFormTemplate] = useState<'Cu-Au' | 'Li-Brine' | 'Blank'>('Cu-Au');

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mining_unit.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.lead_engineer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || p.status === statusFilter;
    const matchesPhase = phaseFilter === 'Todas' || p.phase === phaseFilter;
    return matchesSearch && matchesStatus && matchesPhase;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formClient.trim()) return;

    onCreateProject(
      {
        code: formCode.trim() || `PRJ-2026-${Math.floor(100 + Math.random() * 900)}`,
        name: formName.trim(),
        client: formClient.trim(),
        mining_unit: formUnit.trim() || 'Planta Concentradora Principal',
        phase: formPhase,
        lead_engineer: formEngineer.trim() || 'Ing. Procesos Senior',
        status: 'Activo',
        primary_commodity: formCommodity,
      },
      formTemplate
    );

    setFormName('');
    setFormClient('');
    setFormUnit('');
    setFormCode(`PRJ-2026-${Math.floor(310 + Math.random() * 600)}`);
    setIsNewModalOpen(false);
  };

  const totalStreamsCount = Object.values(flowsheets).reduce(
    (acc, fs) => acc + fs.edges.length,
    0
  );
  const totalEquipmentCount = Object.values(flowsheets).reduce(
    (acc, fs) => acc + fs.nodes.length,
    0
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">
      {/* Cabecera de Módulo 1 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="space-y-2">
          <div className="text-xs font-mono text-cyan-400 tracking-wide">
            01. GESTIÓN MULTIPROYECTO & AISLAMIENTO DE DATOS
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-100 tracking-tight">
            Portafolio de Proyectos de Ingeniería de Procesos
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Cada proyecto opera en un contenedor aislado con su propio diagrama de flujo (Flowsheet PFD),
            criterios de tolerancia metalúrgica y matriz de balance de masa de pulpas.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nuevo Proyecto Minero
          </button>
        </div>
      </div>

      {/* Cinta de Métricas del Portafolio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-md">
          <div className="text-xs text-slate-400">Proyectos Registrados</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-mono font-semibold text-slate-100 tabular-nums">
              {projects.length}
            </span>
            <span className="text-xs font-mono text-emerald-400">
              {projects.filter((p) => p.status === 'Activo').length} activos
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-md">
          <div className="text-xs text-slate-400">Equipos Modelados en PFD</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-mono font-semibold text-slate-100 tabular-nums">
              {totalEquipmentCount}
            </span>
            <span className="text-xs font-mono text-slate-400">unidades</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-md">
          <div className="text-xs text-slate-400">Corrientes de Flujo (Streams)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-mono font-semibold text-slate-100 tabular-nums">
              {totalStreamsCount}
            </span>
            <span className="text-xs font-mono text-cyan-400">balanceadas</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-md">
          <div className="text-xs text-slate-400">Proyecto Activo en Sesión</div>
          <div className="mt-1 truncate">
            <span className="text-sm font-mono font-semibold text-cyan-400">
              {projects.find((p) => p.id === activeProjectId)?.code ?? 'N/A'}
            </span>
            <span className="text-xs text-slate-400 ml-2">
              {projects.find((p) => p.id === activeProjectId)?.client}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros Interactivos */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-900/50 border border-slate-800 p-3 rounded-md">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Buscar proyecto por nombre, cliente, código o unidad minera"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por código, cliente (ej. Los Andes), unidad minera o ingeniero..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro Estado */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
            {(['Todos', 'Activo', 'En Revisión', 'Archivado'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-slate-800 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Selector Fase de Ingeniería */}
          <select
            aria-label="Filtrar por Fase de Ingeniería"
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value as 'Todas' | ProjectPhase)}
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
          >
            <option value="Todas">Todas las Fases</option>
            <option value="Conceptual">Fase: Conceptual</option>
            <option value="Pre-factibilidad">Fase: Pre-factibilidad</option>
            <option value="Factibilidad">Fase: Factibilidad</option>
            <option value="Ingeniería de Detalle">Fase: Ingeniería de Detalle</option>
          </select>
        </div>
      </div>

      {/* Grilla de Proyectos con Metadatos Completos (Zero-Pill Static Metadata) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {filteredProjects.map((project) => {
          const fs = flowsheets[project.id];
          const isSelected = project.id === activeProjectId;
          const totalFeedTph = fs
            ? fs.edges
                .filter((e) => {
                  const srcNode = fs.nodes.find((n) => n.id === e.source_node_id);
                  return srcNode?.type === 'feed_source';
                })
                .reduce((s, e) => s + e.flow_data.solids_tph, 0)
            : 0;

          return (
            <article
              key={project.id}
              className={`flex flex-col justify-between p-5 rounded-md border transition-colors ${
                isSelected
                  ? 'bg-slate-900 border-cyan-500/70'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-3">
                {/* Kicker de metadatos limpios sin pastillas */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-cyan-400 font-semibold">{project.code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{project.phase}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        project.status === 'Activo'
                          ? 'bg-emerald-400'
                          : project.status === 'En Revisión'
                          ? 'bg-amber-400'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span className="text-slate-300">{project.status}</span>
                  </div>
                </div>

                {/* Título del Proyecto */}
                <h2 className="text-base font-semibold text-slate-100 leading-snug">
                  {project.name}
                </h2>

                {/* Metadatos de Cliente, Unidad e Ingeniero Responsable */}
                <dl className="space-y-1.5 text-xs border-t border-slate-800/80 pt-3">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Cliente:</dt>
                    <dd className="text-slate-200 font-medium text-right">{project.client}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Unidad Minera:</dt>
                    <dd className="text-slate-300 text-right truncate max-w-[210px]">
                      {project.mining_unit}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Ing. Responsable:</dt>
                    <dd className="text-slate-300 text-right">{project.lead_engineer}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Última Modificación:</dt>
                    <dd className="text-slate-400 font-mono tabular-nums">{project.updated_at}</dd>
                  </div>
                </dl>

                {/* Resumen de Telemetría del Flowsheet */}
                {fs && (
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80 text-center">
                    <div className="bg-slate-950/70 p-2 rounded">
                      <div className="text-[11px] text-slate-400">Equipos</div>
                      <div className="text-sm font-mono font-semibold text-slate-200 tabular-nums">
                        {fs.nodes.length}
                      </div>
                    </div>
                    <div className="bg-slate-950/70 p-2 rounded">
                      <div className="text-[11px] text-slate-400">Corrientes</div>
                      <div className="text-sm font-mono font-semibold text-slate-200 tabular-nums">
                        {fs.edges.length}
                      </div>
                    </div>
                    <div className="bg-slate-950/70 p-2 rounded">
                      <div className="text-[11px] text-slate-400">Alim. Sólidos</div>
                      <div className="text-sm font-mono font-semibold text-cyan-400 tabular-nums">
                        {totalFeedTph.toFixed(0)} <span className="text-[10px] text-slate-400">t/h</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Acciones del Proyecto */}
              <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectProject(project.id, true)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                      : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Abrir Lienzo PFD Activo
                    </>
                  ) : (
                    <>
                      <FolderOpen className="w-3.5 h-3.5" />
                      Cargar en Lienzo PFD
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onCloneProject(project.id)}
                    title={`Clonar proyecto ${project.code}`}
                    aria-label={`Clonar proyecto ${project.code}`}
                    className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleArchiveProject(project.id)}
                    title={
                      project.status === 'Archivado'
                        ? `Restaurar proyecto ${project.code}`
                        : `Archivar proyecto ${project.code}`
                    }
                    aria-label={
                      project.status === 'Archivado'
                        ? `Restaurar proyecto ${project.code}`
                        : `Archivar proyecto ${project.code}`
                    }
                    className="p-2 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  {projects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteProject(project.id)}
                      title={`Eliminar proyecto ${project.code}`}
                      aria-label={`Eliminar proyecto ${project.code}`}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Estado Vacío si la búsqueda no arroja resultados */}
      {filteredProjects.length === 0 && (
        <div className="p-10 text-center bg-slate-900/40 border border-slate-800 rounded-md space-y-3">
          <div className="text-sm font-medium text-slate-300">
            No se encontraron proyectos que coincidan con los criterios de filtrado.
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('Todos');
              setPhaseFilter('Todas');
            }}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-cyan-300 rounded hover:bg-slate-700 cursor-pointer"
          >
            Restablecer Filtros
          </button>
        </div>
      )}

      {/* Modal para Crear Nuevo Proyecto */}
      {isNewModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-new-project-title"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-md max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 id="modal-new-project-title" className="text-lg font-semibold text-slate-100">
                Crear Nuevo Proyecto de Ingeniería
              </h2>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                aria-label="Cerrar modal"
                className="p-1 text-slate-400 hover:text-slate-200 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1" htmlFor="prj-code">
                    Código de Proyecto
                  </label>
                  <input
                    id="prj-code"
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1" htmlFor="prj-phase">
                    Fase de Estudio
                  </label>
                  <select
                    id="prj-phase"
                    value={formPhase}
                    onChange={(e) => setFormPhase(e.target.value as ProjectPhase)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="Conceptual">Conceptual</option>
                    <option value="Pre-factibilidad">Pre-factibilidad</option>
                    <option value="Factibilidad">Factibilidad</option>
                    <option value="Ingeniería de Detalle">Ingeniería de Detalle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1" htmlFor="prj-name">
                  Nombre del Proyecto
                </label>
                <input
                  id="prj-name"
                  type="text"
                  required
                  placeholder="Ej: Circuito Chancado Secundario y Molienda Bolas"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1" htmlFor="prj-client">
                    Empresa Minera / Cliente
                  </label>
                  <input
                    id="prj-client"
                    type="text"
                    required
                    placeholder="Ej: Minera Antofagasta Minerals"
                    value={formClient}
                    onChange={(e) => setFormClient(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1" htmlFor="prj-unit">
                    Unidad Minera / Planta
                  </label>
                  <input
                    id="prj-unit"
                    type="text"
                    placeholder="Ej: Concentradora Centinela"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1" htmlFor="prj-eng">
                    Ingeniero Responsable
                  </label>
                  <input
                    id="prj-eng"
                    type="text"
                    value={formEngineer}
                    onChange={(e) => setFormEngineer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1" htmlFor="prj-template">
                    Plantilla Inicial de Flowsheet
                  </label>
                  <select
                    id="prj-template"
                    value={formTemplate}
                    onChange={(e) =>
                      setFormTemplate(e.target.value as 'Cu-Au' | 'Li-Brine' | 'Blank')
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="Cu-Au">Circuito Molienda SAG & Flotación Cu-Au</option>
                    <option value="Li-Brine">Planta Salmuera de Litio DLE</option>
                    <option value="Blank">Lienzo PFD Base (Feed + Mixer + Salida)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-cyan-400 text-slate-950 rounded hover:bg-cyan-300 transition-colors cursor-pointer"
                >
                  Crear y Abrir Flowsheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

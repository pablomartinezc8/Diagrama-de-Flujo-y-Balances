/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { ArchitectureBlueprintView } from './components/ArchitectureBlueprintView';
import { FlowsheetWorkspace } from './components/FlowsheetWorkspace';
import { GuideAndHelpView } from './components/GuideAndHelpView';
import { MassBalanceMatrix } from './components/MassBalanceMatrix';
import { ProjectDashboard } from './components/ProjectDashboard';
import { TagingBrandLogo } from './components/TagingBrandLogo';
import { INITIAL_FLOWSHEETS, INITIAL_PROJECTS } from './data/initialProjects';
import { Flowsheet, Project } from './types/process';
import {
  exportFlowsheetToPrintablePdf,
  exportProfessionalExcelSheet,
} from './utils/exportTools';
import {
  computeDerivedSlurryProperties,
  evaluateNodeBalance,
  reconcileFlowsheetMassBalance,
} from './utils/massBalanceMath';

type ActiveModule = 'projects' | 'canvas' | 'matrix' | 'architecture' | 'guide';

const STORAGE_KEY_PROJECTS = 'minflow_pfd_projects_v2';
const STORAGE_KEY_FLOWSHEETS = 'minflow_pfd_flowsheets_v2';

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
      return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
    } catch {
      return INITIAL_PROJECTS;
    }
  });

  const [flowsheets, setFlowsheets] = useState<Record<string, Flowsheet>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FLOWSHEETS);
      return saved ? JSON.parse(saved) : INITIAL_FLOWSHEETS;
    } catch {
      return INITIAL_FLOWSHEETS;
    }
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id ?? 'prj-copper-sag');
  const [activeModule, setActiveModule] = useState<ActiveModule>('canvas');

  // Persistencia automática por proyecto en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    } catch {
      // Ignore storage quota errors in sandboxed frames
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FLOWSHEETS, JSON.stringify(flowsheets));
    } catch {
      // Ignore storage quota errors in sandboxed frames
    }
  }, [flowsheets]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0],
    [projects, activeProjectId]
  );

  const activeFlowsheet = useMemo(
    () => flowsheets[activeProject.id] ?? INITIAL_FLOWSHEETS['prj-copper-sag'],
    [flowsheets, activeProject]
  );

  // Evaluación en tiempo real del cierre de balance en todos los nodos del proyecto activo
  const activeDiagnostics = useMemo(
    () =>
      activeFlowsheet.nodes.map((node) =>
        evaluateNodeBalance(node, activeFlowsheet.edges, activeFlowsheet.tolerance_pct)
      ),
    [activeFlowsheet]
  );

  const handleUpdateFlowsheet = (updated: Flowsheet) => {
    const today = new Date().toISOString().slice(0, 10);
    setFlowsheets((prev) => ({
      ...prev,
      [activeProject.id]: updated,
    }));
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? { ...p, updated_at: today } : p))
    );
  };

  const handleAutoReconcile = () => {
    const reconciled = reconcileFlowsheetMassBalance(activeFlowsheet);
    handleUpdateFlowsheet(reconciled);
  };

  const handleSelectProject = (projectId: string, openCanvas: boolean = false) => {
    setActiveProjectId(projectId);
    if (openCanvas) {
      setActiveModule('canvas');
    }
  };

  const handleCreateProject = (
    newMeta: Omit<Project, 'id' | 'created_at' | 'updated_at'>,
    templateType: 'Cu-Au' | 'Li-Brine' | 'Blank'
  ) => {
    const today = new Date().toISOString().slice(0, 10);
    const newId = `prj-${Date.now()}`;
    const createdProject: Project = {
      ...newMeta,
      id: newId,
      created_at: today,
      updated_at: today,
    };

    let baseFlowsheet: Flowsheet;
    if (templateType === 'Cu-Au') {
      baseFlowsheet = JSON.parse(JSON.stringify(INITIAL_FLOWSHEETS['prj-copper-sag']));
    } else if (templateType === 'Li-Brine') {
      baseFlowsheet = JSON.parse(JSON.stringify(INITIAL_FLOWSHEETS['prj-lithium-brine']));
    } else {
      baseFlowsheet = {
        id: `fs-${Date.now()}`,
        project_id: newId,
        version: 'Rev 1.0 — Diseño Preliminar',
        tolerance_pct: 0.1,
        nodes: [
          {
            id: 'n-feed-1',
            tag: 'FD-101',
            type: 'feed_source',
            category: 'Bloques Genéricos',
            name: 'Alimentación Fresca',
            position_x: 100,
            position_y: 180,
            parameters: {},
          },
          {
            id: 'n-mix-1',
            tag: 'MX-201',
            type: 'mixer_node',
            category: 'Bloques Genéricos',
            name: 'Cajón Mezclador Pulpa',
            position_x: 450,
            position_y: 180,
            parameters: {},
          },
          {
            id: 'n-out-1',
            tag: 'PR-301',
            type: 'product_sink',
            category: 'Bloques Genéricos',
            name: 'Descarga Proceso',
            position_x: 800,
            position_y: 180,
            parameters: {},
          },
        ],
        edges: [
          {
            id: 'STR-001',
            name: 'Alimentación Primaria',
            source_node_id: 'n-feed-1',
            target_node_id: 'n-mix-1',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties(
              {
                solids_tph: 1000,
                percent_solids: 65,
                solid_sg: 2.75,
                liquid_sg: 1.0,
                assay: { cu_pct: 0.9, au_gpt: 0.3, li_pct: 0, fe_pct: 3.5 },
              },
              'from_solids_and_cp'
            ),
          },
          {
            id: 'STR-002',
            name: 'Pulpa Acondicionada',
            source_node_id: 'n-mix-1',
            target_node_id: 'n-out-1',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties(
              {
                solids_tph: 1000,
                percent_solids: 65,
                solid_sg: 2.75,
                liquid_sg: 1.0,
                assay: { cu_pct: 0.9, au_gpt: 0.3, li_pct: 0, fe_pct: 3.5 },
              },
              'from_solids_and_cp'
            ),
          },
        ],
      };
    }

    baseFlowsheet.id = `fs-${Date.now()}`;
    baseFlowsheet.project_id = newId;

    setProjects((prev) => [createdProject, ...prev]);
    setFlowsheets((prev) => ({
      ...prev,
      [newId]: baseFlowsheet,
    }));
    setActiveProjectId(newId);
    setActiveModule('canvas');
  };

  const handleCloneProject = (projectId: string) => {
    const sourceProj = projects.find((p) => p.id === projectId);
    const sourceFs = flowsheets[projectId];
    if (!sourceProj || !sourceFs) return;

    const today = new Date().toISOString().slice(0, 10);
    const clonedId = `prj-${Date.now()}`;
    const clonedProj: Project = {
      ...sourceProj,
      id: clonedId,
      code: `${sourceProj.code}-CLON`,
      name: `${sourceProj.name} (Copia)`,
      created_at: today,
      updated_at: today,
    };

    const clonedFs: Flowsheet = {
      ...JSON.parse(JSON.stringify(sourceFs)),
      id: `fs-${Date.now()}`,
      project_id: clonedId,
      version: `${sourceFs.version} (Clon)`,
    };

    setProjects((prev) => [clonedProj, ...prev]);
    setFlowsheets((prev) => ({
      ...prev,
      [clonedId]: clonedFs,
    }));
    setActiveProjectId(clonedId);
  };

  const handleToggleArchiveProject = (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, status: p.status === 'Archivado' ? 'Activo' : 'Archivado' }
          : p
      )
    );
  };

  const handleDeleteProject = (projectId: string) => {
    if (projects.length <= 1) return;
    const remaining = projects.filter((p) => p.id !== projectId);
    setProjects(remaining);
    if (activeProjectId === projectId && remaining[0]) {
      setActiveProjectId(remaining[0].id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* TOP BAR CONTRACT: 1-Row, 3-Zone Header with Official TAGING Brand Logo */}
      <header className="h-[57px] px-5 border-b border-slate-800 bg-slate-950/95 flex items-center justify-between gap-4 shrink-0">
        {/* Zone 1: Brand Logo TAGING */}
        <a
          href="#canvas"
          onClick={(e) => {
            e.preventDefault();
            setActiveModule('canvas');
          }}
          className="flex items-center shrink-0"
          aria-label="TAGING Ingeniería Inteligente - Inicio"
        >
          <TagingBrandLogo size="sm" showSubtitle={false} />
        </a>

        {/* Zone 2: 5 Clean Single-Line Navigation Links */}
        <nav
          aria-label="Navegación principal de módulos"
          className="flex items-center gap-5 text-xs md:text-sm font-medium text-slate-400 overflow-x-auto"
        >
          <a
            href="#projects"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('projects');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeModule === 'projects'
                ? 'text-cyan-300 border-cyan-400'
                : 'border-transparent hover:text-slate-100'
            }`}
          >
            Proyectos ({projects.length})
          </a>
          <a
            href="#canvas"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('canvas');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeModule === 'canvas'
                ? 'text-cyan-300 border-cyan-400'
                : 'border-transparent hover:text-slate-100'
            }`}
          >
            Lienzo PFD
          </a>
          <a
            href="#matrix"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('matrix');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeModule === 'matrix'
                ? 'text-cyan-300 border-cyan-400'
                : 'border-transparent hover:text-slate-100'
            }`}
          >
            Balance de Masa
          </a>
          <a
            href="#architecture"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('architecture');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeModule === 'architecture'
                ? 'text-cyan-300 border-cyan-400'
                : 'border-transparent hover:text-slate-100'
            }`}
          >
            Arquitectura & Fórmulas
          </a>
          <a
            href="#guide"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('guide');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeModule === 'guide'
                ? 'text-cyan-300 border-cyan-400'
                : 'border-transparent hover:text-slate-100'
            }`}
          >
            Cómo Funciona
          </a>
        </nav>

        {/* Zone 3: 2 Primary Actions (Active Project Selector + Instant Printable PDF / Excel) */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            aria-label="Selector de Proyecto Activo"
            value={activeProject.id}
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400 max-w-[210px] truncate"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.client}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() =>
              exportFlowsheetToPrintablePdf(activeProject, activeFlowsheet, activeDiagnostics)
            }
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-cyan-500/50 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            Plano PDF
          </button>

          <button
            type="button"
            onClick={() =>
              exportProfessionalExcelSheet(activeProject, activeFlowsheet, activeDiagnostics)
            }
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Planilla Excel
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL POR MÓDULO */}
      <main className="flex-1 min-h-0">
        {activeModule === 'projects' && (
          <ProjectDashboard
            projects={projects}
            flowsheets={flowsheets}
            activeProjectId={activeProject.id}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onCloneProject={handleCloneProject}
            onToggleArchiveProject={handleToggleArchiveProject}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {activeModule === 'canvas' && (
          <FlowsheetWorkspace
            project={activeProject}
            flowsheet={activeFlowsheet}
            diagnostics={activeDiagnostics}
            onUpdateFlowsheet={handleUpdateFlowsheet}
            onAutoReconcile={handleAutoReconcile}
          />
        )}

        {activeModule === 'matrix' && (
          <MassBalanceMatrix
            project={activeProject}
            flowsheet={activeFlowsheet}
            diagnostics={activeDiagnostics}
            onUpdateFlowsheet={handleUpdateFlowsheet}
            onAutoReconcile={handleAutoReconcile}
          />
        )}

        {activeModule === 'architecture' && (
          <ArchitectureBlueprintView
            project={activeProject}
            flowsheet={activeFlowsheet}
          />
        )}

        {activeModule === 'guide' && (
          <GuideAndHelpView onNavigateToModule={setActiveModule} />
        )}
      </main>

      {/* PIE CORPORATIVO DISCRETO CUANDO NO ESTÁ EN EL LIENZO FULL-HEIGHT */}
      {activeModule !== 'canvas' && (
        <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <TagingBrandLogo size="sm" showSubtitle={false} />
            <span>·</span>
            <span>Propiedad de TAGING — Ingeniería Inteligente</span>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            Plataforma de Diagramas de Flujo (PFD) y Balances de Masa Mineros
          </div>
        </footer>
      )}
    </div>
  );
}

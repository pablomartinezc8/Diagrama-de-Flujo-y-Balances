/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ProjectPhase =
  | 'Conceptual'
  | 'Pre-factibilidad'
  | 'Factibilidad'
  | 'Ingeniería de Detalle';

export type ProjectStatus = 'Activo' | 'En Revisión' | 'Archivado';

export type EquipmentCategory =
  | 'Comminución'
  | 'Separación y Concentración'
  | 'Manejo de Sólidos/Líquidos'
  | 'Bloques Genéricos';

export type EquipmentSubType =
  // Comminución
  | 'crusher_jaw'
  | 'crusher_cone'
  | 'mill_sag'
  | 'mill_ball'
  | 'mill_hpgr'
  | 'screen_vibrating'
  | 'hydrocyclone'
  // Separación y Concentración
  | 'flotation_rougher'
  | 'flotation_scavenger'
  | 'flotation_cleaner'
  | 'thickener'
  | 'filter_press'
  | 'magnetic_separator'
  // Manejo de Sólidos/Líquidos
  | 'slurry_pump'
  | 'conveyor_belt'
  | 'leach_tank'
  | 'pipeline_header'
  // Bloques Genéricos
  | 'feed_source'
  | 'product_sink'
  | 'mixer_node'
  | 'splitter_node';

export interface AssayValues {
  cu_pct: number;      // % Cu (Cobre)
  au_gpt: number;      // g/t Au (Oro)
  li_pct: number;      // % Li (Litio)
  fe_pct: number;      // % Fe (Hierro)
  mo_pct?: number;     // % Mo (Molibdeno)
}

export interface StreamFlowData {
  solids_tph: number;          // Flujo Másico Total de Sólidos (t/h)
  water_m3h: number;           // Flujo Volumétrico de Agua / Solución (m³/h)
  percent_solids: number;      // Porcentaje de Sólidos en Peso (%Cp o %p/p)
  solid_sg: number;            // Gravedad Específica del Mineral Seco (ρ_s, t/m³, ej. 2.75)
  liquid_sg: number;           // Densidad del Líquido / Salmuera (ρ_l, t/m³, ej. 1.00 o 1.20)
  pulp_mass_tph: number;       // Flujo Másico de Pulpa Total (t/h) [Auto-calculado]
  pulp_vol_m3h: number;        // Caudal Volumétrico de Pulpa (m³/h) [Auto-calculado]
  pulp_density: number;        // Densidad de Pulpa (t/m³) [Auto-calculado]
  reagent_dosage_gpt: number;  // Dosificación de Reactivos (g/t)
  assay: AssayValues;          // Leyes de Mineral / Elementos de Interés
}

export interface EquipmentParameters {
  capacity_max_tph?: number;
  power_kw?: number;
  split_ratio_primary?: number; // Para divisores, hidrociclones, flotación (0.0 a 1.0)
  target_underflow_cp?: number; // % sólidos objetivo en descarga de espesador/ciclón
  residence_time_min?: number;
  notes?: string;
}

export interface EquipmentNode {
  id: string;
  tag: string;                 // Ej: CR-101, ML-201, CY-202, TH-301
  type: EquipmentSubType;
  category: EquipmentCategory;
  name: string;
  position_x: number;
  position_y: number;
  parameters: EquipmentParameters;
}

export interface StreamEdge {
  id: string;                  // Ej: STR-001, STR-002
  name: string;                // Ej: Alimentación Fresca ROM, Overflow Ciclones
  source_node_id: string;
  source_port?: 'out_primary' | 'out_secondary';
  target_node_id: string;
  target_port?: 'in_primary' | 'in_secondary';
  stream_type: 'ore' | 'slurry' | 'water' | 'concentrate' | 'tailings';
  flow_data: StreamFlowData;
}

export interface CanvasAnnotation {
  id: string;
  kind: 'zone_box' | 'callout_note' | 'custom_block';
  title: string;               // Ej: ZONA DE CARGA DE CAMIONES / ÁREA STOCKPILE
  details: string;             // Texto libre, capacidades, notas operativas
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  color_theme: 'cyan' | 'amber' | 'emerald' | 'slate' | 'rose';
}

export interface Flowsheet {
  id: string;
  project_id: string;
  version: string;
  tolerance_pct: number;       // Tolerancia de cierre de balance (ej. 0.1%)
  nodes: EquipmentNode[];
  edges: StreamEdge[];
  annotations?: CanvasAnnotation[];
}

export interface Project {
  id: string;
  code: string;                // Código de Proyecto (ej: PRJ-2026-042)
  name: string;
  client: string;              // Cliente (ej: Minera Escondida / Codelco)
  mining_unit: string;         // Unidad Minera (ej: Planta Concentradora Laguna Seca)
  phase: ProjectPhase;
  lead_engineer: string;       // Ingeniero Responsable
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  primary_commodity: 'Cu-Au' | 'Li-Brine' | 'Polimetálico Fe-Cu';
}

export interface NodeBalanceDiagnostics {
  nodeId: string;
  nodeTag: string;
  nodeName: string;
  nodeType: EquipmentSubType;
  isBoundary: boolean;         // True si es Feed (solo salidas) o Output (solo entradas)
  isDisconnected: boolean;
  inCount: number;
  outCount: number;
  solidsIn_tph: number;
  solidsOut_tph: number;
  solidsDelta_tph: number;
  solidsError_pct: number;
  waterIn_m3h: number;
  waterOut_m3h: number;
  waterDelta_m3h: number;
  waterError_pct: number;
  cuFineIn_tph: number;
  cuFineOut_tph: number;
  cuError_pct: number;
  isBalanced: boolean;
  status: 'balanced' | 'warning' | 'unbalanced' | 'boundary' | 'disconnected';
}

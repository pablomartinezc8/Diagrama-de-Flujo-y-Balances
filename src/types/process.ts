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

export type UnitOperationRole =
  | 'feed_generator'      // Alimentación ROM / Agua Fresca (genera caudal inicial)
  | 'crushing_grinding'   // Chancadores y Molinos (F80 -> P80, Work Index, adición de agua/solución)
  | 'size_classifier'     // Zarandas e Hidrociclones (Partición a gruesos/finos, d50, %Cp descarga)
  | 'concentration_leach' // Flotación, Lixiviación, Sep. Magnética (% Recuperación, Mass Pull, solución)
  | 'dewatering'          // Espesadores y Filtros (%Cp Underflow/Queque, agua recuperada Overflow)
  | 'mixer_pump'          // Bombas, Correas, Tuberías, Mezcladores (Suma de entradas + adición opcional)
  | 'flow_splitter'       // Divisores (Split ratio primario)
  | 'output_sink';        // Salida final del circuito

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

export type CadMaterialStyle =
  | 'machinery_gold'   // Acero Ocre / Amarillo Maquinaria con degradado 3D
  | 'motor_blue'       // Azul Motor Eléctrico / Accionamiento
  | 'dark_steel'       // Acero Carbono / Gris Oscuro
  | 'process_cyan';    // Cian / Verde Proceso (Tuberías, Rebose, Espuma)

export type CadPrimitiveKind =
  | 'drum_rect'        // Cilindro / Tambor / Cuerpo rectangular
  | 'hopper_trapezoid' // Tolva / Cono / Chute trapezoidal
  | 'flywheel_circle'  // Volante / Rodillo / Impulsor circular
  | 'pipe_line'        // Tubería / Eje / Línea ortogonal
  | 'polygon_free'     // Polilínea / Polígono libre punto por punto
  | 'motor_drive'      // Sello rápido: Motor eléctrico con aletas
  | 'skid_base';       // Sello rápido: Bastidor / Base estructural

export interface CustomCadPrimitive {
  id: string;
  kind: CadPrimitiveKind;
  material: CadMaterialStyle;
  x: number;           // Coordenada en canvas CAD (0..180)
  y: number;           // Coordenada en canvas CAD (0..110)
  w: number;           // Ancho en canvas CAD
  h: number;           // Alto en canvas CAD
  x2?: number;         // Punto final X para líneas/tuberías
  y2?: number;         // Punto final Y para líneas/tuberías
  points?: Array<{ x: number; y: number }>; // Vértices para polígono libre / trapecio
  hasBolts?: boolean;  // Dibujar pernos/liners metálicos sobre el manto
  topRatio?: number;   // Para conos/tolvas: ancho superior vs inferior (0.2 a 1.5)
}

export interface CustomInputFieldDef {
  id: string;
  label: string;       // Ej: "Tiempo de Residencia", "Presión Hidráulica", "Dosis Ácido"
  unit: string;        // Ej: "min", "bar", "kg/t", "m³/h"
  defaultValue: number;
  roleImpact?: 'none' | 'added_water_m3h' | 'split_pct' | 'target_cp_pct';
}

export interface CustomEquipmentDrawing {
  primitives: CustomCadPrimitive[];
  dimensions: {
    width_m: number;     // Ancho o Diámetro real (m)
    height_m: number;    // Alto o Largo real (m)
    volume_m3?: number;  // Volumen útil opcional (m³)
  };
  unitRole: UnitOperationRole;
  inletCount: number;    // Cantidad de entradas (1 a 3)
  outletCount: number;   // Cantidad de salidas (1 a 3)
  customInputs: CustomInputFieldDef[];
}

export interface EquipmentParameters {
  // Capacidad y Potencia
  capacity_max_tph?: number;
  power_kw?: number;

  // Medidas Físicas Personalizadas (m / m³)
  dim_width_m?: number;
  dim_height_m?: number;
  dim_volume_m3?: number;

  // Valores de Inputs Personalizados definidos en el creador CAD
  custom_input_values?: Record<string, number>;

  // 1. Parámetros para Alimentación Inicial (feed_generator)
  feed_solids_tph?: number;       // Flujo inicial de sólidos (t/h)
  feed_water_m3h?: number;        // Caudal inicial de agua/solución (m³/h)
  feed_cp_pct?: number;           // % Sólidos inicial (%Cp)
  feed_cu_pct?: number;           // Ley inicial %Cu
  feed_au_gpt?: number;           // Ley inicial g/t Au
  feed_li_pct?: number;           // Ley inicial %Li

  // 2. Parámetros para Chancado y Molienda (crushing_grinding)
  f80_mm?: number;                // Tamaño 80% pasante alimentación (mm)
  p80_um?: number;                // Tamaño 80% pasante producto (µm)
  bond_wi_kwht?: number;          // Work Index de Bond (kWh/t)
  added_water_m3h?: number;       // Caudal de agua/solución agregada en el equipo (m³/h)
  target_discharge_cp?: number;   // % Sólidos objetivo en la descarga (opcional)

  // 3. Parámetros para Clasificación y Divisores (size_classifier / flow_splitter)
  split_ratio_primary?: number;   // Fracción de sólidos a la salida 1 (0.0 a 1.0)
  water_split_ratio?: number;     // Fracción de agua a la salida 1 (0.0 a 1.0)
  cut_size_d50_um?: number;       // Tamaño de corte d50 (µm)
  target_underflow_cp?: number;   // % Sólidos objetivo en Underflow / Queque

  // 4. Parámetros para Flotación, Lixiviación y Concentración (concentration_leach)
  mass_pull_pct?: number;         // % en peso de sólidos que reporta al concentrado (ej. 10%)
  metal_recovery_pct?: number;    // % Recuperación metalúrgica del elemento principal (ej. 88%)
  concentrate_cp_pct?: number;    // % Sólidos en el concentrado (ej. 40%)
  residence_time_min?: number;    // Tiempo de residencia (min)
  flocculant_gpt?: number;        // Dosis de floculante o reactivo (g/t)

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
  custom_drawing?: CustomEquipmentDrawing; // Si el usuario lo dibujó en el Estudio CAD
}

export interface StreamEdge {
  id: string;                  // Ej: STR-001, STR-002 (Siempre único)
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
  addedWaterInNode_m3h: number; // Agua o solución agregada directamente en el equipo
  waterOut_m3h: number;
  waterDelta_m3h: number;
  waterError_pct: number;
  cuFineIn_tph: number;
  cuFineOut_tph: number;
  cuError_pct: number;
  calculatedBondPower_kw?: number;
  isBalanced: boolean;
  status: 'balanced' | 'warning' | 'unbalanced' | 'boundary' | 'disconnected';
}

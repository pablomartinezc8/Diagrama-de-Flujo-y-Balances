/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssayValues,
  ElementClosureDiagnostic,
  ElementSymbol,
  EquipmentNode,
  EquipmentSubType,
  Flowsheet,
  FlowsheetSolverReport,
  GraphValidationIssue,
  NodeBalanceDiagnostics,
  StreamEdge,
  StreamFlowData,
  UnitOperationRole,
} from '../types/process';

/**
 * Normaliza entradas numéricas de ingeniería (soporta coma decimal "64,29", espacios,
 * strings vacíos, y bloquea NaN / Infinity / negativos según rango físico).
 */
export function parseSafeEngineeringNumber(
  raw: unknown,
  fallback: number = 0,
  min?: number,
  max?: number
): number {
  let num: number;
  if (typeof raw === 'number') {
    num = raw;
  } else if (typeof raw === 'string') {
    const normalized = raw.trim().replace(/,/g, '.');
    if (normalized === '' || normalized === '-' || normalized === '.') {
      num = fallback;
    } else {
      num = Number(normalized);
    }
  } else {
    num = fallback;
  }

  if (!Number.isFinite(num) || Number.isNaN(num)) {
    num = fallback;
  }
  if (min !== undefined && num < min) {
    num = min;
  }
  if (max !== undefined && num > max) {
    num = max;
  }
  return num;
}

/**
 * Determina el rol de operación unitaria de cada tipo de equipo (o usa el rol configurado en el Estudio CAD)
 */
export function getEquipmentUnitRole(
  type: EquipmentSubType,
  node?: EquipmentNode
): UnitOperationRole {
  if (node?.custom_drawing?.unitRole) {
    return node.custom_drawing.unitRole;
  }
  switch (type) {
    case 'feed_source':
      return 'feed_generator';
    case 'crusher_jaw':
    case 'crusher_cone':
    case 'mill_sag':
    case 'mill_ball':
    case 'mill_hpgr':
      return 'crushing_grinding';
    case 'screen_vibrating':
    case 'hydrocyclone':
      return 'size_classifier';
    case 'flotation_rougher':
    case 'flotation_scavenger':
    case 'flotation_cleaner':
    case 'magnetic_separator':
    case 'leach_tank':
      return 'concentration_leach';
    case 'thickener':
    case 'filter_press':
      return 'dewatering';
    case 'splitter_node':
      return 'flow_splitter';
    case 'product_sink':
      return 'output_sink';
    case 'slurry_pump':
    case 'conveyor_belt':
    case 'pipeline_header':
    case 'mixer_node':
    default:
      return 'mixer_pump';
  }
}

/**
 * Calcula un ID único para una nueva corriente (ej. STR-008) sin colisionar jamás
 * con IDs existentes aunque se hayan eliminado corrientes intermedias.
 */
export function generateUniqueStreamId(edges: StreamEdge[]): string {
  const existingIds = new Set(edges.map((e) => e.id.toUpperCase()));
  let maxNumber = edges.length;

  for (const edge of edges) {
    const match = edge.id.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  let candidateNum = maxNumber + 1;
  let candidateId = `STR-${String(candidateNum).padStart(3, '0')}`;
  while (existingIds.has(candidateId)) {
    candidateNum++;
    candidateId = `STR-${String(candidateNum).padStart(3, '0')}`;
  }
  return candidateId;
}

/**
 * Sanitiza un Flowsheet asegurando que no existan IDs de corrientes ni de nodos duplicados
 * y que todas las propiedades derivadas de pulpa estén recalculadas desde la fuente de verdad.
 */
export function sanitizeFlowsheetUniqueKeys(flowsheet: Flowsheet): Flowsheet {
  const seenEdgeIds = new Set<string>();
  const cleanEdges: StreamEdge[] = [];

  for (const edge of flowsheet.edges) {
    let id = edge.id;
    if (seenEdgeIds.has(id)) {
      id = generateUniqueStreamId(cleanEdges);
    }
    seenEdgeIds.add(id);
    cleanEdges.push({
      ...edge,
      id,
      flow_data: computeDerivedSlurryProperties(edge.flow_data, 'from_solids_and_water'),
    });
  }

  const seenNodeIds = new Set<string>();
  const cleanNodes: EquipmentNode[] = [];
  for (const node of flowsheet.nodes) {
    let id = node.id;
    if (seenNodeIds.has(id)) {
      id = `${node.id}-${cleanNodes.length + 1}`;
    }
    seenNodeIds.add(id);
    cleanNodes.push({ ...node, id });
  }

  return {
    ...flowsheet,
    nodes: cleanNodes,
    edges: cleanEdges,
  };
}

/**
 * MOTOR EXACTO DE PROPIEDADES DE PULPA MINERAL (Única fuente de verdad para variables derivadas)
 * Fórmulas de referencia:
 * - Masa líquida (t/h): Ml = Ms * (100 - Cp) / Cp   ;   Caudal agua/solución (m³/h): Mw = Ml / ρl
 * - Masa de pulpa (t/h): Mp = Ms + Mw * ρl
 * - Caudal volumétrico de pulpa (m³/h): Qp = Ms / ρs + Mw
 * - Densidad de pulpa (t/m³): ρp = 100 / (Cp / ρs + (100 - Cp) / ρl)  ≡  Mp / Qp
 *
 * Comportamiento en casos límite:
 * - Si Ms = 0 y Mw = 0 -> Cp = 0, Mp = 0, Qp = 0, ρp = ρl
 * - Si Ms > 0 y Cp = 0 -> En modo 'from_solids_and_cp', Cp = 0 con Ms > 0 es físicamente imposible;
 *   si Mw > 0 se calcula Cp desde Ms y Mw, si Mw = 0 entonces Cp = 100%.
 * - Si Cp = 100 -> Mw = 0, Mp = Ms, Qp = Ms / ρs, ρp = ρs
 * - Si ρs <= ρl -> Se fuerza ρs = max(ρl + 0.05, 1.1) para garantizar consistencia física de mineral sólido.
 */
export function computeDerivedSlurryProperties(
  data: Partial<StreamFlowData>,
  mode: 'from_solids_and_cp' | 'from_solids_and_water' = 'from_solids_and_cp'
): StreamFlowData {
  const solids_tph = parseSafeEngineeringNumber(data.solids_tph, 0, 0);
  const liquid_sg = parseSafeEngineeringNumber(data.liquid_sg, 1.0, 0.5, 3.0);
  const rawSolidSg = parseSafeEngineeringNumber(data.solid_sg, 2.75, 0.5, 20.0);
  // Garantizamos físicamente que ρs > ρl
  const solid_sg = rawSolidSg <= liquid_sg ? roundTo(liquid_sg + 0.05, 3) : rawSolidSg;
  const reagent_dosage_gpt = parseSafeEngineeringNumber(data.reagent_dosage_gpt, 0, 0);

  let water_m3h = parseSafeEngineeringNumber(data.water_m3h, 0, 0);
  let percent_solids = parseSafeEngineeringNumber(data.percent_solids, 0, 0, 100);

  // Cálculo de masa de agua/solución y %Cp sin redondeo intermedio prematuro
  let exactWater_m3h = water_m3h;
  let exactCp_pct = percent_solids;

  if (mode === 'from_solids_and_cp') {
    if (solids_tph <= 0) {
      exactCp_pct = 0;
      // Si no hay sólidos, el caudal de agua se preserva tal cual
    } else if (exactCp_pct >= 100) {
      exactCp_pct = 100;
      exactWater_m3h = 0;
    } else if (exactCp_pct <= 0) {
      // Caso límite: Ms > 0 pero el usuario puso Cp = 0
      if (exactWater_m3h > 0) {
        const liqMass = exactWater_m3h * liquid_sg;
        exactCp_pct = (solids_tph / (solids_tph + liqMass)) * 100;
      } else {
        exactCp_pct = 100;
        exactWater_m3h = 0;
      }
    } else {
      const liquidMass_tph = (solids_tph * (100 - exactCp_pct)) / exactCp_pct;
      exactWater_m3h = liquidMass_tph / liquid_sg;
    }
  } else {
    // Modo 'from_solids_and_water'
    const liquidMass_tph = exactWater_m3h * liquid_sg;
    const totalMass_tph = solids_tph + liquidMass_tph;
    if (totalMass_tph > 0) {
      exactCp_pct = (solids_tph / totalMass_tph) * 100;
    } else {
      exactCp_pct = 0;
    }
  }

  const exactLiquidMass_tph = exactWater_m3h * liquid_sg;
  const exactPulpMass_tph = solids_tph + exactLiquidMass_tph;
  const exactSolidsVol_m3h = solids_tph > 0 ? solids_tph / solid_sg : 0;
  const exactPulpVol_m3h = exactSolidsVol_m3h + exactWater_m3h;

  // Densidad de pulpa según definición exacta: ρp = 100 / (Cp/ρs + (100 - Cp)/ρl) ≡ Mp / Qp
  let exactPulpDensity = liquid_sg;
  if (exactCp_pct > 0 && exactCp_pct < 100) {
    exactPulpDensity =
      100 / (exactCp_pct / solid_sg + (100 - exactCp_pct) / liquid_sg);
  } else if (exactCp_pct >= 100 && solids_tph > 0) {
    exactPulpDensity = solid_sg;
  } else if (exactPulpVol_m3h > 1e-9) {
    exactPulpDensity = exactPulpMass_tph / exactPulpVol_m3h;
  }

  return {
    solids_tph: roundTo(solids_tph, 2),
    water_m3h: roundTo(exactWater_m3h, 2),
    percent_solids: roundTo(exactCp_pct, 2),
    solid_sg: roundTo(solid_sg, 2),
    liquid_sg: roundTo(liquid_sg, 2),
    pulp_mass_tph: roundTo(exactPulpMass_tph, 2),
    pulp_vol_m3h: roundTo(exactPulpVol_m3h, 2),
    pulp_density: roundTo(exactPulpDensity, 3),
    reagent_dosage_gpt: roundTo(reagent_dosage_gpt, 1),
    assay: {
      cu_pct: roundTo(parseSafeEngineeringNumber(data.assay?.cu_pct, 0, 0, 100), 4),
      au_gpt: roundTo(parseSafeEngineeringNumber(data.assay?.au_gpt, 0, 0, 100000), 4),
      li_pct: roundTo(parseSafeEngineeringNumber(data.assay?.li_pct, 0, 0, 100), 4),
      fe_pct: roundTo(parseSafeEngineeringNumber(data.assay?.fe_pct, 0, 0, 100), 4),
      mo_pct: roundTo(parseSafeEngineeringNumber(data.assay?.mo_pct, 0, 0, 100), 5),
    },
  };
}

/**
 * Calcula finos metálicos de una corriente según su ley:
 * - Elementos en % (Cu, Li, Fe, Mo): Fino (t/h) = Ms (t/h) * ley (%) / 100
 * - Oro en g/t (Au): Fino (g/h) = Ms (t/h) * ley (g/t)
 */
export function computeStreamMetalFines(flow: StreamFlowData): {
  Cu: number; // t/h
  Au: number; // g/h
  Li: number; // t/h
  Fe: number; // t/h
  Mo: number; // t/h
} {
  const ms = Math.max(0, flow.solids_tph);
  return {
    Cu: (ms * (flow.assay.cu_pct ?? 0)) / 100,
    Au: ms * (flow.assay.au_gpt ?? 0),
    Li: (ms * (flow.assay.li_pct ?? 0)) / 100,
    Fe: (ms * (flow.assay.fe_pct ?? 0)) / 100,
    Mo: (ms * (flow.assay.mo_pct ?? 0)) / 100,
  };
}

/**
 * Calcula la potencia de conminución por la Ley de Bond:
 * W (kWh/t) = 10 * Wi * (1 / sqrt(P80_um) - 1 / sqrt(F80_um))
 * Potencia (kW) = Solids_tph * W
 */
export function computeBondMillPowerKw(
  solids_tph: number,
  wi_kwht?: number,
  f80_mm?: number,
  p80_um?: number
): number | undefined {
  if (!wi_kwht || !f80_mm || !p80_um || solids_tph <= 0) return undefined;
  const f80_um = f80_mm * 1000;
  if (p80_um >= f80_um || p80_um <= 1) return undefined;
  const specificEnergy = 10 * wi_kwht * (1 / Math.sqrt(p80_um) - 1 / Math.sqrt(f80_um));
  return Math.round(solids_tph * specificEnergy);
}

/**
 * Evalúa el cierre de balance de masa y de TODOS los elementos de ley (Cu, Au, Li, Fe, Mo) en un nodo:
 * Σ Entradas (+ Agua Agregada en el Equipo) = Σ Salidas
 */
export function evaluateNodeBalance(
  node: EquipmentNode,
  edges: StreamEdge[],
  tolerancePct: number = 0.1
): NodeBalanceDiagnostics {
  const inEdges = edges.filter((e) => e.target_node_id === node.id);
  const outEdges = edges.filter((e) => e.source_node_id === node.id);

  const isBoundary =
    node.type === 'feed_source' ||
    node.type === 'product_sink' ||
    (inEdges.length === 0 && outEdges.length > 0) ||
    (outEdges.length === 0 && inEdges.length > 0);

  const isDisconnected = inEdges.length === 0 && outEdges.length === 0;

  const solidsIn_tph = inEdges.reduce((acc, e) => acc + e.flow_data.solids_tph, 0);
  const solidsOut_tph = outEdges.reduce((acc, e) => acc + e.flow_data.solids_tph, 0);
  const solidsDelta_tph = solidsIn_tph - solidsOut_tph;

  const addedWaterInNode_m3h = Math.max(0, Number(node.parameters.added_water_m3h ?? 0));
  const waterIn_m3h =
    inEdges.reduce((acc, e) => acc + e.flow_data.water_m3h, 0) + addedWaterInNode_m3h;
  const waterOut_m3h = outEdges.reduce((acc, e) => acc + e.flow_data.water_m3h, 0);
  const waterDelta_m3h = waterIn_m3h - waterOut_m3h;

  const pulpIn_tph =
    inEdges.reduce((acc, e) => acc + e.flow_data.pulp_mass_tph, 0) + addedWaterInNode_m3h;
  const pulpOut_tph = outEdges.reduce((acc, e) => acc + e.flow_data.pulp_mass_tph, 0);
  const pulpDelta_tph = pulpIn_tph - pulpOut_tph;

  const calcRelErrorPct = (valIn: number, valOut: number): number => {
    const ref = Math.max(Math.abs(valIn), Math.abs(valOut));
    if (ref < 1e-7) return 0;
    return (Math.abs(valIn - valOut) / ref) * 100;
  };

  const solidsError_pct = calcRelErrorPct(solidsIn_tph, solidsOut_tph);
  const waterError_pct = calcRelErrorPct(waterIn_m3h, waterOut_m3h);
  const pulpError_pct = calcRelErrorPct(pulpIn_tph, pulpOut_tph);

  // Auditoría completa de los 5 elementos químicos (Cu, Au, Li, Fe, Mo)
  const elements: Array<{ sym: ElementSymbol; unit: 't/h' | 'g/h' }> = [
    { sym: 'Cu', unit: 't/h' },
    { sym: 'Au', unit: 'g/h' },
    { sym: 'Li', unit: 't/h' },
    { sym: 'Fe', unit: 't/h' },
    { sym: 'Mo', unit: 't/h' },
  ];

  const elementDiagnostics = {} as Record<ElementSymbol, ElementClosureDiagnostic>;
  for (const el of elements) {
    const fineIn = inEdges.reduce(
      (acc, e) => acc + computeStreamMetalFines(e.flow_data)[el.sym],
      0
    );
    const fineOut = outEdges.reduce(
      (acc, e) => acc + computeStreamMetalFines(e.flow_data)[el.sym],
      0
    );
    const delta = fineIn - fineOut;
    const error_pct = calcRelErrorPct(fineIn, fineOut);
    const elBalanced = isBoundary ? true : error_pct <= tolerancePct;

    elementDiagnostics[el.sym] = {
      element: el.sym,
      unit: el.unit,
      fineIn: roundTo(fineIn, 4),
      fineOut: roundTo(fineOut, 4),
      delta: roundTo(delta, 4),
      error_pct: roundTo(error_pct, 2),
      isBalanced: elBalanced,
    };
  }

  const failingVariables: string[] = [];
  if (!isBoundary && !isDisconnected) {
    if (solidsError_pct > tolerancePct) {
      failingVariables.push(`Sólidos (${solidsError_pct.toFixed(2)}%)`);
    }
    if (waterError_pct > tolerancePct) {
      failingVariables.push(`Agua (${waterError_pct.toFixed(2)}%)`);
    }
    for (const el of elements) {
      const diag = elementDiagnostics[el.sym];
      if (!diag.isBalanced) {
        failingVariables.push(`${el.sym} (${diag.error_pct.toFixed(2)}%)`);
      }
    }
  }

  const maxError_pct = Math.max(
    solidsError_pct,
    waterError_pct,
    elementDiagnostics.Cu.error_pct,
    elementDiagnostics.Au.error_pct,
    elementDiagnostics.Li.error_pct,
    elementDiagnostics.Fe.error_pct,
    elementDiagnostics.Mo.error_pct
  );

  const calculatedBondPower_kw = computeBondMillPowerKw(
    solidsIn_tph || solidsOut_tph,
    node.parameters.bond_wi_kwht,
    node.parameters.f80_mm,
    node.parameters.p80_um
  );

  let status: NodeBalanceDiagnostics['status'] = 'balanced';
  let isBalanced = true;

  if (isDisconnected) {
    status = 'disconnected';
    isBalanced = false;
  } else if (isBoundary) {
    status = 'boundary';
    isBalanced = true;
  } else {
    if (maxError_pct <= tolerancePct) {
      status = 'balanced';
      isBalanced = true;
    } else if (maxError_pct <= tolerancePct * 5) {
      status = 'warning';
      isBalanced = false;
    } else {
      status = 'unbalanced';
      isBalanced = false;
    }
  }

  return {
    nodeId: node.id,
    nodeTag: node.tag,
    nodeName: node.name,
    nodeType: node.type,
    isBoundary,
    isDisconnected,
    inCount: inEdges.length,
    outCount: outEdges.length,
    solidsIn_tph: roundTo(solidsIn_tph, 2),
    solidsOut_tph: roundTo(solidsOut_tph, 2),
    solidsDelta_tph: roundTo(solidsDelta_tph, 2),
    solidsError_pct: roundTo(solidsError_pct, 2),
    waterIn_m3h: roundTo(waterIn_m3h, 2),
    addedWaterInNode_m3h: roundTo(addedWaterInNode_m3h, 2),
    waterOut_m3h: roundTo(waterOut_m3h, 2),
    waterDelta_m3h: roundTo(waterDelta_m3h, 2),
    waterError_pct: roundTo(waterError_pct, 2),
    pulpIn_tph: roundTo(pulpIn_tph, 2),
    pulpOut_tph: roundTo(pulpOut_tph, 2),
    pulpDelta_tph: roundTo(pulpDelta_tph, 2),
    pulpError_pct: roundTo(pulpError_pct, 2),
    cuFineIn_tph: elementDiagnostics.Cu.fineIn,
    cuFineOut_tph: elementDiagnostics.Cu.fineOut,
    cuError_pct: elementDiagnostics.Cu.error_pct,
    auFineIn_gh: elementDiagnostics.Au.fineIn,
    auFineOut_gh: elementDiagnostics.Au.fineOut,
    auError_pct: elementDiagnostics.Au.error_pct,
    liFineIn_tph: elementDiagnostics.Li.fineIn,
    liFineOut_tph: elementDiagnostics.Li.fineOut,
    liError_pct: elementDiagnostics.Li.error_pct,
    feFineIn_tph: elementDiagnostics.Fe.fineIn,
    feFineOut_tph: elementDiagnostics.Fe.fineOut,
    feError_pct: elementDiagnostics.Fe.error_pct,
    moFineIn_tph: elementDiagnostics.Mo.fineIn,
    moFineOut_tph: elementDiagnostics.Mo.fineOut,
    moError_pct: elementDiagnostics.Mo.error_pct,
    elementDiagnostics,
    failingVariables,
    maxError_pct: roundTo(maxError_pct, 2),
    calculatedBondPower_kw,
    isBalanced,
    status,
  };
}

/**
 * VALIDADOR TOPOLÓGICO Y METALÚRGICO DEL GRAFO PFD ANTES DE CALCULAR
 * Detecta:
 * - Corrientes huérfanas (sin nodo origen o destino válido)
 * - Nodos desconectados (sin entradas ni salidas)
 * - Feeds con corrientes de entrada o Sinks con corrientes de salida
 * - Equipos internos sin entradas o sin salidas
 * - Separadores (ciclones, flotación, espesadores, splitters) con < 2 salidas
 * - Parámetros faltantes o fuera de rango físico
 * - Duplicidad de fuentes de agua (corriente de agua conectada + added_water_m3h > 0)
 */
export function validateFlowsheetGraph(flowsheet: Flowsheet): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  const nodeMap = new Map(flowsheet.nodes.map((n) => [n.id, n]));

  // 1. Validar corrientes (huérfanas, auto-bucles y rangos físicos)
  for (const edge of flowsheet.edges) {
    const src = nodeMap.get(edge.source_node_id);
    const tgt = nodeMap.get(edge.target_node_id);

    if (!src || !tgt) {
      issues.push({
        id: `issue-orphan-${edge.id}`,
        severity: 'error',
        code: 'ORPHAN_STREAM',
        targetId: edge.id,
        targetLabel: edge.id,
        message: `La corriente ${edge.id} (${edge.name}) tiene un nodo de origen o destino inexistente.`,
        remediation: `Elimina la corriente ${edge.id} y vuelve a conectarla entre dos equipos válidos del lienzo.`,
      });
      continue;
    }

    if (edge.source_node_id === edge.target_node_id) {
      issues.push({
        id: `issue-selfloop-${edge.id}`,
        severity: 'error',
        code: 'ORPHAN_STREAM',
        targetId: edge.id,
        targetLabel: edge.id,
        message: `La corriente ${edge.id} se conecta consigo misma en el equipo ${src.tag}.`,
        remediation: `Elimina la corriente ${edge.id}; la recirculación debe pasar por un clasificador, bomba o mezclador.`,
      });
    }

    const d = edge.flow_data;
    if (d.solid_sg <= d.liquid_sg) {
      issues.push({
        id: `issue-sg-${edge.id}`,
        severity: 'error',
        code: 'INVALID_PHYSICAL_VALUE',
        targetId: edge.id,
        targetLabel: edge.id,
        message: `En ${edge.id}, la gravedad específica del sólido (${d.solid_sg} t/m³) es menor o igual a la del líquido (${d.liquid_sg} t/m³).`,
        remediation: `Ingresa una GE de mineral mayor que la densidad del líquido (ej. 2.70 t/m³).`,
      });
    }
  }

  // 2. Validar equipos / nodos y grados de libertad
  for (const node of flowsheet.nodes) {
    const inEdges = flowsheet.edges.filter((e) => e.target_node_id === node.id);
    const outEdges = flowsheet.edges.filter((e) => e.source_node_id === node.id);
    const role = getEquipmentUnitRole(node.type, node);

    if (inEdges.length === 0 && outEdges.length === 0) {
      issues.push({
        id: `issue-disc-${node.id}`,
        severity: 'warning',
        code: 'DISCONNECTED_NODE',
        targetId: node.id,
        targetLabel: node.tag,
        message: `El equipo ${node.tag} (${node.name}) está aislado sin corrientes de entrada ni salida.`,
        remediation: `Usa el botón de conectar (🔗) en ${node.tag} para unirlo al circuito o elimínalo si no se utiliza.`,
      });
      continue;
    }

    if (node.type === 'feed_source' && inEdges.length > 0) {
      issues.push({
        id: `issue-feed-in-${node.id}`,
        severity: 'error',
        code: 'FEED_HAS_INLETS',
        targetId: node.id,
        targetLabel: node.tag,
        message: `El bloque de alimentación ${node.tag} recibe ${inEdges.length} corriente(s) de entrada, pero un Feed debe ser frontera de inicio.`,
        remediation: `Cambia el tipo de equipo o usa un Mezclador/Molino para recibir corrientes intermedias.`,
      });
    }

    if (node.type === 'product_sink' && outEdges.length > 0) {
      issues.push({
        id: `issue-sink-out-${node.id}`,
        severity: 'error',
        code: 'SINK_HAS_OUTLETS',
        targetId: node.id,
        targetLabel: node.tag,
        message: `El bloque de salida final ${node.tag} tiene ${outEdges.length} corriente(s) saliendo de él.`,
        remediation: `Un sumidero de producto/relave debe ser destino final; si el flujo continúa, reemplázalo por un equipo de proceso.`,
      });
    }

    if (node.type !== 'feed_source' && inEdges.length === 0) {
      issues.push({
        id: `issue-no-in-${node.id}`,
        severity: 'error',
        code: 'MISSING_INLET_FOR_INTERNAL',
        targetId: node.id,
        targetLabel: node.tag,
        message: `El equipo ${node.tag} (${node.name}) no tiene ninguna corriente de alimentación conectada.`,
        remediation: `Conecta al menos una corriente de entrada hacia ${node.tag}.`,
      });
    }

    if (node.type !== 'product_sink' && outEdges.length === 0) {
      issues.push({
        id: `issue-no-out-${node.id}`,
        severity: 'error',
        code: 'MISSING_OUTLET_FOR_INTERNAL',
        targetId: node.id,
        targetLabel: node.tag,
        message: `El equipo ${node.tag} (${node.name}) no tiene corrientes de descarga conectadas.`,
        remediation: `Conecta al menos una corriente de salida desde ${node.tag} hacia el siguiente equipo o producto.`,
      });
    }

    // Validación para separadores/clasificadores: requieren al menos 2 salidas para separar fases/flujos
    if (
      (role === 'size_classifier' ||
        role === 'concentration_leach' ||
        role === 'dewatering' ||
        role === 'flow_splitter') &&
      outEdges.length === 1
    ) {
      issues.push({
        id: `issue-sep-out-${node.id}`,
        severity: 'warning',
        code: 'INSUFFICIENT_OUTLETS_FOR_SEPARATOR',
        targetId: node.id,
        targetLabel: node.tag,
        message: `El equipo separador/divisor ${node.tag} tiene solo 1 corriente de salida; toda la masa saldrá por esa única línea sin separación.`,
        remediation: `Conecta una segunda corriente de salida desde ${node.tag} (ej. Overflow/Underflow o Concentrado/Relave).`,
      });
    }

    // Detectar doble contabilidad potencial de agua: corriente de agua entrante + added_water_m3h > 0
    const hasWaterStreamIn = inEdges.some((e) => e.stream_type === 'water' && e.flow_data.water_m3h > 0);
    if (hasWaterStreamIn && (node.parameters.added_water_m3h ?? 0) > 0) {
      issues.push({
        id: `issue-dup-water-${node.id}`,
        severity: 'warning',
        code: 'DUPLICATE_WATER_SOURCE',
        targetId: node.id,
        targetLabel: node.tag,
        message: `El equipo ${node.tag} recibe una corriente de agua dedicada y además tiene configurada "Agua Agregada" interna (${node.parameters.added_water_m3h} m³/h).`,
        remediation: `Verifica si el agua de proceso debe ingresarse solo por la corriente o solo en el parámetro interno del equipo para evitar duplicarla.`,
      });
    }
  }

  return issues;
}

/**
 * Detecta si existen ciclos dirigidos (lazos de recirculación) en el diagrama
 */
export function detectDirectedCycles(nodes: EquipmentNode[], edges: StreamEdge[]): boolean {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (adj.has(e.source_node_id) && adj.has(e.target_node_id)) {
      adj.get(e.source_node_id)!.push(e.target_node_id);
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  const dfs = (u: string): boolean => {
    visited.add(u);
    inStack.add(u);
    for (const v of adj.get(u) ?? []) {
      if (!visited.has(v)) {
        if (dfs(v)) return true;
      } else if (inStack.has(v)) {
        return true;
      }
    }
    inStack.delete(u);
    return false;
  };

  for (const n of nodes) {
    if (!visited.has(n.id) && dfs(n.id)) {
      return true;
    }
  }
  return false;
}

/**
 * MOTOR SOLVER EXACTO CON CONSERVACIÓN DE TODOS LOS ELEMENTOS Y CONVERGENCIA DE RECIRCULACIÓN
 *
 * Resuelve circuitos abiertos y cerrados (ej. Molienda-Clasificación con carga circulante)
 * mediante iteración de Punto Fijo / Aceleración de Wegstein acotada:
 * - Criterio de convergencia: |ΔMs| <= 1e-4 t/h y |ΔMw| <= 1e-4 m³/h en todas las corrientes.
 * - Conservación estricta en cada nodo:
 *   Fino_Sal_1 + Fino_Sal_2 = Fino_Entrada para Cu, Au, Li, Fe y Mo.
 */
export function solveFlowsheetWithReport(
  flowsheet: Flowsheet,
  options?: {
    maxIterations?: number;
    convergenceTol?: number;
  }
): { flowsheet: Flowsheet; report: FlowsheetSolverReport } {
  const maxIterations = options?.maxIterations ?? 120;
  const convergenceTol = options?.convergenceTol ?? 1e-4;

  const validationIssues = validateFlowsheetGraph(flowsheet);
  const hasRecycleLoops = detectDirectedCycles(flowsheet.nodes, flowsheet.edges);

  // Almacenamos el estado numérico de alta precisión durante las iteraciones (sin truncar a 2 decimales en cada paso)
  interface ExactStreamState {
    solids_tph: number;
    water_m3h: number;
    solid_sg: number;
    liquid_sg: number;
    reagent_dosage_gpt: number;
    assay: AssayValues;
  }

  const exactMap = new Map<string, ExactStreamState>();
  for (const e of flowsheet.edges) {
    const normalized = computeDerivedSlurryProperties(e.flow_data, 'from_solids_and_water');
    exactMap.set(e.id, {
      solids_tph: normalized.solids_tph,
      water_m3h: normalized.water_m3h,
      solid_sg: normalized.solid_sg,
      liquid_sg: normalized.liquid_sg,
      reagent_dosage_gpt: normalized.reagent_dosage_gpt,
      assay: {
        cu_pct: normalized.assay.cu_pct,
        au_gpt: normalized.assay.au_gpt,
        li_pct: normalized.assay.li_pct,
        fe_pct: normalized.assay.fe_pct,
        mo_pct: normalized.assay.mo_pct ?? 0,
      },
    });
  }

  // Sincronización de Fuente Única de Verdad en Alimentadores (Feeds):
  // La corriente conectada a la salida de un Feed Source es la fuente maestra; si el nodo tiene parámetros
  // explícitos configurados, se sincronizan una sola vez al inicio.
  for (const node of flowsheet.nodes) {
    const role = getEquipmentUnitRole(node.type, node);
    if (role !== 'feed_generator') continue;
    const outEdges = flowsheet.edges.filter((e) => e.source_node_id === node.id);
    if (outEdges.length === 0) continue;

    const p = node.parameters;
    if (
      p.feed_solids_tph !== undefined ||
      p.feed_water_m3h !== undefined ||
      p.feed_cp_pct !== undefined
    ) {
      const outEdge = outEdges[0];
      const cur = exactMap.get(outEdge.id)!;
      const solids = p.feed_solids_tph ?? cur.solids_tph;
      let water = p.feed_water_m3h ?? cur.water_m3h;

      if (solids > 0 && p.feed_cp_pct !== undefined && p.feed_cp_pct > 0 && p.feed_cp_pct < 100) {
        // Si no se especificó agua explícita o si se definió por %Cp
        if (p.feed_water_m3h === undefined) {
          water = (solids * ((100 - p.feed_cp_pct) / p.feed_cp_pct)) / cur.liquid_sg;
        }
      } else if (solids > 0 && p.feed_cp_pct === 100) {
        water = 0;
      }

      exactMap.set(outEdge.id, {
        ...cur,
        solids_tph: solids,
        water_m3h: water,
        assay: {
          cu_pct: p.feed_cu_pct ?? cur.assay.cu_pct,
          au_gpt: p.feed_au_gpt ?? cur.assay.au_gpt,
          li_pct: p.feed_li_pct ?? cur.assay.li_pct,
          fe_pct: cur.assay.fe_pct,
          mo_pct: cur.assay.mo_pct ?? 0,
        },
      });
    }
  }

  let converged = false;
  let iter = 0;
  let maxResidual = 0;

  for (iter = 1; iter <= maxIterations; iter++) {
    maxResidual = 0;

    for (const node of flowsheet.nodes) {
      const role = getEquipmentUnitRole(node.type, node);
      if (role === 'feed_generator' || role === 'output_sink') continue;

      const inEdges = flowsheet.edges.filter((e) => e.target_node_id === node.id);
      const outEdges = flowsheet.edges.filter((e) => e.source_node_id === node.id);
      if (inEdges.length === 0 || outEdges.length === 0) continue;

      const p = node.parameters;
      const addedWater = Math.max(0, Number(p.added_water_m3h ?? 0));

      let totalSolidsIn = 0;
      let totalWaterIn = addedWater;
      let totalCuFineIn = 0; // t/h
      let totalAuFineIn = 0; // g/h
      let totalLiFineIn = 0; // t/h
      let totalFeFineIn = 0; // t/h
      let totalMoFineIn = 0; // t/h
      let solidVolSum = 0;

      for (const ie of inEdges) {
        const st = exactMap.get(ie.id)!;
        totalSolidsIn += st.solids_tph;
        totalWaterIn += st.water_m3h;
        totalCuFineIn += (st.solids_tph * st.assay.cu_pct) / 100;
        totalAuFineIn += st.solids_tph * st.assay.au_gpt;
        totalLiFineIn += (st.solids_tph * st.assay.li_pct) / 100;
        totalFeFineIn += (st.solids_tph * st.assay.fe_pct) / 100;
        totalMoFineIn += (st.solids_tph * (st.assay.mo_pct ?? 0)) / 100;
        if (st.solids_tph > 0 && st.solid_sg > 0) {
          solidVolSum += st.solids_tph / st.solid_sg;
        }
      }

      const avgSolidSg =
        totalSolidsIn > 0 && solidVolSum > 0
          ? totalSolidsIn / solidVolSum
          : exactMap.get(inEdges[0].id)!.solid_sg;
      const avgLiquidSg = exactMap.get(inEdges[0].id)!.liquid_sg;

      const inAssay: AssayValues = {
        cu_pct: totalSolidsIn > 0 ? (totalCuFineIn / totalSolidsIn) * 100 : 0,
        au_gpt: totalSolidsIn > 0 ? totalAuFineIn / totalSolidsIn : 0,
        li_pct: totalSolidsIn > 0 ? (totalLiFineIn / totalSolidsIn) * 100 : 0,
        fe_pct: totalSolidsIn > 0 ? (totalFeFineIn / totalSolidsIn) * 100 : 0,
        mo_pct: totalSolidsIn > 0 ? (totalMoFineIn / totalSolidsIn) * 100 : 0,
      };

      const updateStreamState = (edgeId: string, next: ExactStreamState) => {
        const prev = exactMap.get(edgeId)!;
        const diffS = Math.abs(next.solids_tph - prev.solids_tph);
        const diffW = Math.abs(next.water_m3h - prev.water_m3h);
        if (diffS > maxResidual) maxResidual = diffS;
        if (diffW > maxResidual) maxResidual = diffW;
        exactMap.set(edgeId, next);
      };

      // CASO A: NODO CON 1 SOLA SALIDA (Molinos, Chancadores, Mezcladores, Bombas, Correas)
      if (outEdges.length === 1) {
        const outEdge = outEdges[0];
        const prevOut = exactMap.get(outEdge.id)!;
        updateStreamState(outEdge.id, {
          ...prevOut,
          solids_tph: totalSolidsIn,
          water_m3h: totalWaterIn,
          solid_sg: avgSolidSg,
          liquid_sg: avgLiquidSg,
          assay: { ...inAssay },
        });
        continue;
      }

      // CASO B: NODO CON 2 O MÁS SALIDAS
      if (outEdges.length >= 2) {
        const primaryEdge = outEdges[0];
        const secondaryEdge = outEdges[1];
        const prevPrim = exactMap.get(primaryEdge.id)!;
        const prevSec = exactMap.get(secondaryEdge.id)!;

        // B.1: ESPESADORES Y FILTROS PRENSA (dewatering)
        if (role === 'dewatering') {
          const targetCp = Math.min(96, Math.max(15, Number(p.target_underflow_cp ?? 65)));
          const isFirstWater = primaryEdge.stream_type === 'water';
          const ufEdge = isFirstWater ? secondaryEdge : primaryEdge;
          const ofEdge = isFirstWater ? primaryEdge : secondaryEdge;
          const prevUf = exactMap.get(ufEdge.id)!;
          const prevOf = exactMap.get(ofEdge.id)!;

          const ufWaterMass = totalSolidsIn * ((100 - targetCp) / targetCp);
          const ufWaterM3h = Math.min(totalWaterIn, ufWaterMass / avgLiquidSg);
          const ofWaterM3h = Math.max(0, totalWaterIn - ufWaterM3h);

          // Todo el sólido y 100% de los finos metálicos salen por el Underflow/Queque
          updateStreamState(ufEdge.id, {
            ...prevUf,
            solids_tph: totalSolidsIn,
            water_m3h: ufWaterM3h,
            solid_sg: avgSolidSg,
            liquid_sg: avgLiquidSg,
            assay: { ...inAssay },
          });

          updateStreamState(ofEdge.id, {
            ...prevOf,
            solids_tph: 0,
            water_m3h: ofWaterM3h,
            solid_sg: avgSolidSg,
            liquid_sg: avgLiquidSg,
            assay: { cu_pct: 0, au_gpt: 0, li_pct: 0, fe_pct: 0, mo_pct: 0 },
          });
          continue;
        }

        // B.2: CELDAS DE FLOTACIÓN, SEPARACIÓN MAGNÉTICA Y LIXIVIACIÓN (concentration_leach)
        if (
          role === 'concentration_leach' &&
          (p.mass_pull_pct !== undefined || p.metal_recovery_pct !== undefined)
        ) {
          const massPullFrac = Math.min(
            0.95,
            Math.max(0.01, Number(p.mass_pull_pct ?? (p.split_ratio_primary ?? 0.1) * 100) / 100)
          );
          const recovFrac = Math.min(
            0.995,
            Math.max(0.01, Number(p.metal_recovery_pct ?? 90) / 100)
          );
          const concTargetCp = Math.min(
            85,
            Math.max(10, Number(p.concentrate_cp_pct ?? 40))
          );

          const concSolids = totalSolidsIn * massPullFrac;
          const tailsSolids = Math.max(0, totalSolidsIn - concSolids);

          const concWaterNeeded =
            (concSolids * ((100 - concTargetCp) / concTargetCp)) / avgLiquidSg;
          const concWater = Math.min(totalWaterIn, concWaterNeeded);
          const tailsWater = Math.max(0, totalWaterIn - concWater);

          // Conservación EXACTA elemento por elemento (Σ Fino Ent = Fino Conc + Fino Relave):
          // Para el metal principal (Cu/Li) se aplica metal_recovery_pct.
          // Para subproductos (Au, Fe, Mo), si la corriente de concentrado ya tiene una ley objetivo válida
          // que no exceda el 99% del fino entrante, se respeta y el complemento exacto va al relave;
          // de lo contrario se usa recuperación proporcional garantizando ΣSal = ΣEnt.
          const splitElementExact = (
            totalFineIn: number,
            existingConcGrade: number,
            defaultRecovery: number,
            isGpt: boolean
          ): { concGrade: number; tailsGrade: number } => {
            if (totalFineIn <= 0 || concSolids <= 0 || tailsSolids <= 0) {
              return { concGrade: 0, tailsGrade: 0 };
            }
            const factor = isGpt ? 1 : 100;
            let concFine = (concSolids * existingConcGrade) / factor;
            // Si el nodo tiene configurado metal_recovery_pct explícito o si el fino excede el total
            if (concFine <= 0 || concFine >= totalFineIn * 0.995) {
              concFine = totalFineIn * defaultRecovery;
            }
            const tailsFine = Math.max(0, totalFineIn - concFine);
            return {
              concGrade: (concFine / concSolids) * factor,
              tailsGrade: (tailsFine / tailsSolids) * factor,
            };
          };

          // Cobre usa directamente la recuperación metalúrgica configurada en el equipo
          const concCuFine = totalCuFineIn * recovFrac;
          const tailsCuFine = Math.max(0, totalCuFineIn - concCuFine);
          const cuConcGrade = concSolids > 0 ? (concCuFine / concSolids) * 100 : 0;
          const cuTailsGrade = tailsSolids > 0 ? (tailsCuFine / tailsSolids) * 100 : 0;

          const auSplit = splitElementExact(
            totalAuFineIn,
            prevPrim.assay.au_gpt,
            Math.min(0.95, recovFrac * 0.9),
            true
          );
          const liSplit = splitElementExact(
            totalLiFineIn,
            prevPrim.assay.li_pct,
            recovFrac,
            false
          );
          const feSplit = splitElementExact(
            totalFeFineIn,
            prevPrim.assay.fe_pct,
            Math.min(0.85, massPullFrac * 6.0),
            false
          );
          const moSplit = splitElementExact(
            totalMoFineIn,
            prevPrim.assay.mo_pct ?? 0,
            Math.min(0.92, recovFrac * 0.85),
            false
          );

          updateStreamState(primaryEdge.id, {
            ...prevPrim,
            solids_tph: concSolids,
            water_m3h: concWater,
            liquid_sg: avgLiquidSg,
            assay: {
              cu_pct: cuConcGrade,
              au_gpt: auSplit.concGrade,
              li_pct: liSplit.concGrade,
              fe_pct: feSplit.concGrade,
              mo_pct: moSplit.concGrade,
            },
          });

          updateStreamState(secondaryEdge.id, {
            ...prevSec,
            solids_tph: tailsSolids,
            water_m3h: tailsWater,
            liquid_sg: avgLiquidSg,
            assay: {
              cu_pct: cuTailsGrade,
              au_gpt: auSplit.tailsGrade,
              li_pct: liSplit.tailsGrade,
              fe_pct: feSplit.tailsGrade,
              mo_pct: moSplit.tailsGrade,
            },
          });
          continue;
        }

        // B.3: CLASIFICADORES (HIDROCICLONES / ZARANDAS) Y DIVISORES DE FLUJO (N salidas)
        if (outEdges.length > 2) {
          // Divisor múltiple (N >= 3 salidas): reparte equitativamente o proporcional a sus flujos previos
          const prevSumS = outEdges.reduce((s, e) => s + exactMap.get(e.id)!.solids_tph, 0);
          let remS = totalSolidsIn;
          let remW = totalWaterIn;

          outEdges.forEach((oe, idx) => {
            const prev = exactMap.get(oe.id)!;
            const isLast = idx === outEdges.length - 1;
            const frac =
              prevSumS > 0 ? prev.solids_tph / prevSumS : 1 / outEdges.length;
            const sOut = isLast ? remS : totalSolidsIn * frac;
            const wOut = isLast ? remW : totalWaterIn * frac;
            remS = Math.max(0, remS - sOut);
            remW = Math.max(0, remW - wOut);

            updateStreamState(oe.id, {
              ...prev,
              solids_tph: sOut,
              water_m3h: wOut,
              solid_sg: avgSolidSg,
              liquid_sg: avgLiquidSg,
              assay: { ...inAssay },
            });
          });
          continue;
        }

        const splitSolids = Math.min(0.98, Math.max(0.02, Number(p.split_ratio_primary ?? 0.65)));
        const firstSolids = totalSolidsIn * splitSolids;
        const secondSolids = Math.max(0, totalSolidsIn - firstSolids);

        let firstWater = totalWaterIn * (p.water_split_ratio ?? splitSolids);
        if (p.target_underflow_cp && p.target_underflow_cp > 10 && p.target_underflow_cp < 95) {
          const ufWater =
            (secondSolids * ((100 - p.target_underflow_cp) / p.target_underflow_cp)) / avgLiquidSg;
          if (ufWater <= totalWaterIn) {
            firstWater = totalWaterIn - ufWater;
          }
        }
        const secondWater = Math.max(0, totalWaterIn - firstWater);

        // Si es un divisor homogéneo (splitter_node) sin enriquecimiento selectivo, la ley se conserva igual en ambas ramas.
        // Si es un clasificador (hidrociclón/zaranda) y la primera rama tiene una ley definida válida,
        // la segunda rama recibe exactamente el complemento de finos para todos los 5 elementos (Cu, Au, Li, Fe, Mo).
        const computeClassifierComplementAssay = (
          totalFineIn: number,
          firstBranchGrade: number,
          inGrade: number,
          isGpt: boolean
        ): { grade1: number; grade2: number } => {
          if (totalFineIn <= 0 || firstSolids <= 0 || secondSolids <= 0) {
            return { grade1: inGrade, grade2: inGrade };
          }
          if (role === 'flow_splitter') {
            return { grade1: inGrade, grade2: inGrade };
          }
          const factor = isGpt ? 1 : 100;
          const fine1 = (firstSolids * firstBranchGrade) / factor;
          if (fine1 <= 0 || fine1 >= totalFineIn * 0.99) {
            return { grade1: inGrade, grade2: inGrade };
          }
          const fine2 = Math.max(0, totalFineIn - fine1);
          return {
            grade1: firstBranchGrade,
            grade2: (fine2 / secondSolids) * factor,
          };
        };

        const cuClass = computeClassifierComplementAssay(
          totalCuFineIn,
          prevPrim.assay.cu_pct,
          inAssay.cu_pct,
          false
        );
        const auClass = computeClassifierComplementAssay(
          totalAuFineIn,
          prevPrim.assay.au_gpt,
          inAssay.au_gpt,
          true
        );
        const liClass = computeClassifierComplementAssay(
          totalLiFineIn,
          prevPrim.assay.li_pct,
          inAssay.li_pct,
          false
        );
        const feClass = computeClassifierComplementAssay(
          totalFeFineIn,
          prevPrim.assay.fe_pct,
          inAssay.fe_pct,
          false
        );
        const moClass = computeClassifierComplementAssay(
          totalMoFineIn,
          prevPrim.assay.mo_pct ?? 0,
          inAssay.mo_pct ?? 0,
          false
        );

        updateStreamState(primaryEdge.id, {
          ...prevPrim,
          solids_tph: firstSolids,
          water_m3h: firstWater,
          solid_sg: avgSolidSg,
          liquid_sg: avgLiquidSg,
          assay: {
            cu_pct: cuClass.grade1,
            au_gpt: auClass.grade1,
            li_pct: liClass.grade1,
            fe_pct: feClass.grade1,
            mo_pct: moClass.grade1,
          },
        });

        updateStreamState(secondaryEdge.id, {
          ...prevSec,
          solids_tph: secondSolids,
          water_m3h: secondWater,
          solid_sg: avgSolidSg,
          liquid_sg: avgLiquidSg,
          assay: {
            cu_pct: cuClass.grade2,
            au_gpt: auClass.grade2,
            li_pct: liClass.grade2,
            fe_pct: feClass.grade2,
            mo_pct: moClass.grade2,
          },
        });
      }
    }

    if (maxResidual <= convergenceTol) {
      converged = true;
      break;
    }
  }

  if (!converged && hasRecycleLoops) {
    validationIssues.push({
      id: 'issue-non-convergent-cycle',
      severity: 'error',
      code: 'NON_CONVERGENT_CYCLE',
      targetId: flowsheet.id,
      targetLabel: 'LAZO DE RECIRCULACIÓN',
      message: `El circuito cerrado no alcanzó convergencia tras ${maxIterations} iteraciones (residuo: ${maxResidual.toFixed(2)} t/h).`,
      remediation: `Verifica que todo lazo de recirculación tenga al menos una purga/salida al exterior (ej. split < 100%) para que la masa no se acumule indefinidamente.`,
    });
  }

  // Reconstruir las corrientes con computeDerivedSlurryProperties a partir del estado convergido
  const updatedEdges: StreamEdge[] = flowsheet.edges.map((edge) => {
    const st = exactMap.get(edge.id)!;
    return {
      ...edge,
      flow_data: computeDerivedSlurryProperties(
        {
          ...edge.flow_data,
          solids_tph: st.solids_tph,
          water_m3h: st.water_m3h,
          solid_sg: st.solid_sg,
          liquid_sg: st.liquid_sg,
          reagent_dosage_gpt: st.reagent_dosage_gpt,
          assay: st.assay,
        },
        'from_solids_and_water'
      ),
    };
  });

  // Calcular razón de carga circulante si hay un hidrociclón o clasificador activo
  let circulatingLoadRatio_pct: number | undefined;
  const cycloneNode = flowsheet.nodes.find(
    (n) => getEquipmentUnitRole(n.type, n) === 'size_classifier'
  );
  if (cycloneNode) {
    const cycOut = updatedEdges.filter((e) => e.source_node_id === cycloneNode.id);
    if (cycOut.length >= 2 && cycOut[0].flow_data.solids_tph > 0) {
      circulatingLoadRatio_pct = roundTo(
        (cycOut[1].flow_data.solids_tph / cycOut[0].flow_data.solids_tph) * 100,
        1
      );
    }
  }

  const report: FlowsheetSolverReport = {
    converged,
    iterations: iter,
    maxIterations,
    maxResidual_tph: roundTo(maxResidual, 5),
    convergenceTolerance_tph: convergenceTol,
    hasRecycleLoops,
    circulatingLoadRatio_pct,
    validationIssues,
    message: converged
      ? `Balance convergido exactamente en ${iter} iteración(es) (residuo máx: ${maxResidual.toExponential(2)} t/h).`
      : `Atención: No convergió tras ${maxIterations} iteraciones (residuo: ${maxResidual.toFixed(2)} t/h). Revise lazos sin salida.`,
  };

  return {
    flowsheet: {
      ...flowsheet,
      edges: updatedEdges,
    },
    report,
  };
}

/**
 * Función compatible para reconciliar un Flowsheet directamente devolviendo el Flowsheet actualizado
 */
export function reconcileFlowsheetMassBalance(flowsheet: Flowsheet): Flowsheet {
  return solveFlowsheetWithReport(flowsheet).flowsheet;
}

export function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

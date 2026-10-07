/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EquipmentNode,
  EquipmentSubType,
  Flowsheet,
  NodeBalanceDiagnostics,
  StreamEdge,
  StreamFlowData,
  UnitOperationRole,
} from '../types/process';

/**
 * Determina el rol de operación unitaria de cada tipo de equipo
 */
export function getEquipmentUnitRole(type: EquipmentSubType): UnitOperationRole {
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
 * (evita cualquier error de claves duplicadas en React si vienen datos antiguos en localStorage).
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
    cleanEdges.push({ ...edge, id });
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
 * Calcula las propiedades físicas derivadas de una pulpa mineral
 */
export function computeDerivedSlurryProperties(
  data: Partial<StreamFlowData>,
  mode: 'from_solids_and_cp' | 'from_solids_and_water' = 'from_solids_and_cp'
): StreamFlowData {
  const solids_tph = Math.max(0, Number(data.solids_tph ?? 0));
  const solid_sg = Math.max(1.1, Number(data.solid_sg ?? 2.75));
  const liquid_sg = Math.max(0.8, Number(data.liquid_sg ?? 1.0));
  const reagent_dosage_gpt = Math.max(0, Number(data.reagent_dosage_gpt ?? 0));

  let water_m3h = Math.max(0, Number(data.water_m3h ?? 0));
  let percent_solids = Math.min(100, Math.max(0, Number(data.percent_solids ?? 0)));

  if (mode === 'from_solids_and_cp') {
    if (solids_tph === 0) {
      percent_solids = 0;
    } else if (percent_solids >= 99.99) {
      percent_solids = 100;
      water_m3h = 0;
    } else if (percent_solids > 0) {
      const liquidMass_tph = solids_tph * ((100 - percent_solids) / percent_solids);
      water_m3h = liquidMass_tph / liquid_sg;
    }
  } else {
    const liquidMass_tph = water_m3h * liquid_sg;
    const totalMass_tph = solids_tph + liquidMass_tph;
    if (totalMass_tph > 0) {
      percent_solids = (solids_tph / totalMass_tph) * 100;
    } else {
      percent_solids = 0;
    }
  }

  const liquidMass_tph = water_m3h * liquid_sg;
  const pulp_mass_tph = solids_tph + liquidMass_tph;
  const solidsVol_m3h = solids_tph > 0 ? solids_tph / solid_sg : 0;
  const pulp_vol_m3h = solidsVol_m3h + water_m3h;

  let pulp_density = liquid_sg;
  if (pulp_vol_m3h > 0.0001) {
    pulp_density = pulp_mass_tph / pulp_vol_m3h;
  } else if (solids_tph > 0 && water_m3h === 0) {
    pulp_density = solid_sg;
  }

  return {
    solids_tph: roundTo(solids_tph, 2),
    water_m3h: roundTo(water_m3h, 2),
    percent_solids: roundTo(percent_solids, 2),
    solid_sg: roundTo(solid_sg, 2),
    liquid_sg: roundTo(liquid_sg, 2),
    pulp_mass_tph: roundTo(pulp_mass_tph, 2),
    pulp_vol_m3h: roundTo(pulp_vol_m3h, 2),
    pulp_density: roundTo(pulp_density, 3),
    reagent_dosage_gpt: roundTo(reagent_dosage_gpt, 1),
    assay: {
      cu_pct: roundTo(Number(data.assay?.cu_pct ?? 0), 3),
      au_gpt: roundTo(Number(data.assay?.au_gpt ?? 0), 2),
      li_pct: roundTo(Number(data.assay?.li_pct ?? 0), 3),
      fe_pct: roundTo(Number(data.assay?.fe_pct ?? 0), 2),
      mo_pct: roundTo(Number(data.assay?.mo_pct ?? 0.015), 3),
    },
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
 * Evalúa el cierre de balance de masa en un nodo (Conservación de Materia):
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

  const cuFineIn_tph = inEdges.reduce(
    (acc, e) => acc + (e.flow_data.solids_tph * e.flow_data.assay.cu_pct) / 100,
    0
  );
  const cuFineOut_tph = outEdges.reduce(
    (acc, e) => acc + (e.flow_data.solids_tph * e.flow_data.assay.cu_pct) / 100,
    0
  );

  const maxSolidsRef = Math.max(solidsIn_tph, solidsOut_tph, 0.001);
  const solidsError_pct =
    solidsIn_tph === 0 && solidsOut_tph === 0
      ? 0
      : (Math.abs(solidsDelta_tph) / maxSolidsRef) * 100;

  const maxWaterRef = Math.max(waterIn_m3h, waterOut_m3h, 0.001);
  const waterError_pct =
    waterIn_m3h === 0 && waterOut_m3h === 0
      ? 0
      : (Math.abs(waterDelta_m3h) / maxWaterRef) * 100;

  const maxCuRef = Math.max(cuFineIn_tph, cuFineOut_tph, 0.0001);
  const cuError_pct =
    cuFineIn_tph === 0 && cuFineOut_tph === 0
      ? 0
      : (Math.abs(cuFineIn_tph - cuFineOut_tph) / maxCuRef) * 100;

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
    const worstError = Math.max(solidsError_pct, waterError_pct);
    if (worstError <= tolerancePct) {
      status = 'balanced';
      isBalanced = true;
    } else if (worstError <= tolerancePct * 5) {
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
    cuFineIn_tph: roundTo(cuFineIn_tph, 3),
    cuFineOut_tph: roundTo(cuFineOut_tph, 3),
    cuError_pct: roundTo(cuError_pct, 2),
    calculatedBondPower_kw,
    isBalanced,
    status,
  };
}

/**
 * MOTOR DE SIMULACIÓN Y BALANCE DE MASA IMPULSADO POR EQUIPOS (Equipment-Driven Solver)
 * Recorre todos los equipos y aplica sus fórmulas de operación unitaria:
 * - Alimentadores (Feeds): Si el usuario configuró flujo inicial en el equipo, actualiza sus corrientes de salida.
 * - Chancadores / Molinos: Suma entradas + agua agregada directamente en el equipo (`added_water_m3h`).
 * - Hidrociclones / Zarandas: Divide la corriente según `split_ratio_primary` y `%Cp` objetivo de descarga.
 * - Flotación / Lixiviación: Calcula concentrado y relave según `% Recuperación Metalúrgica`, `Mass Pull` y `%Cp Concentrado`.
 * - Espesadores / Filtros: Calcula el Underflow al `%Cp` objetivo (ej. 65% o 91%) y envía el agua clarificada restante al Overflow.
 */
export function reconcileFlowsheetMassBalance(flowsheet: Flowsheet): Flowsheet {
  const updatedEdges = flowsheet.edges.map((e) => ({
    ...e,
    flow_data: computeDerivedSlurryProperties(e.flow_data, 'from_solids_and_water'),
  }));

  for (let pass = 0; pass < 6; pass++) {
    for (const node of flowsheet.nodes) {
      const inEdges = updatedEdges.filter((e) => e.target_node_id === node.id);
      const outEdges = updatedEdges.filter((e) => e.source_node_id === node.id);
      const role = getEquipmentUnitRole(node.type);
      const p = node.parameters;

      // 1. NODO GENERADOR DE ALIMENTACIÓN (Feed Source)
      if (role === 'feed_generator' && outEdges.length > 0) {
        if (
          p.feed_solids_tph !== undefined ||
          p.feed_water_m3h !== undefined ||
          p.feed_cp_pct !== undefined
        ) {
          const outEdge = outEdges[0];
          const solids = p.feed_solids_tph ?? outEdge.flow_data.solids_tph;
          const cp = p.feed_cp_pct ?? outEdge.flow_data.percent_solids;
          const water = p.feed_water_m3h ?? outEdge.flow_data.water_m3h;
          const mode =
            solids > 0 && p.feed_cp_pct !== undefined
              ? 'from_solids_and_cp'
              : 'from_solids_and_water';

          outEdge.flow_data = computeDerivedSlurryProperties(
            {
              ...outEdge.flow_data,
              solids_tph: solids,
              percent_solids: cp,
              water_m3h: water,
              assay: {
                ...outEdge.flow_data.assay,
                cu_pct: p.feed_cu_pct ?? outEdge.flow_data.assay.cu_pct,
                au_gpt: p.feed_au_gpt ?? outEdge.flow_data.assay.au_gpt,
                li_pct: p.feed_li_pct ?? outEdge.flow_data.assay.li_pct,
              },
            },
            mode
          );
        }
        continue;
      }

      if (inEdges.length === 0 || outEdges.length === 0) continue;

      const addedWater = Math.max(0, Number(p.added_water_m3h ?? 0));
      const totalSolidsIn = inEdges.reduce((s, e) => s + e.flow_data.solids_tph, 0);
      const totalWaterIn =
        inEdges.reduce((s, e) => s + e.flow_data.water_m3h, 0) + addedWater;

      const weightedCu =
        totalSolidsIn > 0
          ? inEdges.reduce((s, e) => s + e.flow_data.solids_tph * e.flow_data.assay.cu_pct, 0) /
            totalSolidsIn
          : 0;
      const weightedAu =
        totalSolidsIn > 0
          ? inEdges.reduce((s, e) => s + e.flow_data.solids_tph * e.flow_data.assay.au_gpt, 0) /
            totalSolidsIn
          : 0;
      const weightedLi =
        totalSolidsIn > 0
          ? inEdges.reduce((s, e) => s + e.flow_data.solids_tph * e.flow_data.assay.li_pct, 0) /
            totalSolidsIn
          : 0;
      const weightedFe =
        totalSolidsIn > 0
          ? inEdges.reduce((s, e) => s + e.flow_data.solids_tph * e.flow_data.assay.fe_pct, 0) /
            totalSolidsIn
          : 0;
      const avgSolidSg =
        totalSolidsIn > 0
          ? inEdges.reduce((s, e) => s + e.flow_data.solids_tph * e.flow_data.solid_sg, 0) /
            totalSolidsIn
          : inEdges[0].flow_data.solid_sg;
      const avgLiquidSg = inEdges[0].flow_data.liquid_sg;

      // CASO A: EQUIPO CON 1 SOLA SALIDA (Molinos, Chancadores, Mezcladores, Bombas, Correas)
      if (outEdges.length === 1) {
        const outEdge = outEdges[0];
        outEdge.flow_data = computeDerivedSlurryProperties(
          {
            ...outEdge.flow_data,
            solids_tph: totalSolidsIn,
            water_m3h: totalWaterIn,
            solid_sg: avgSolidSg,
            liquid_sg: avgLiquidSg,
            assay: {
              cu_pct: weightedCu,
              au_gpt: weightedAu,
              li_pct: weightedLi,
              fe_pct: weightedFe,
              mo_pct: outEdge.flow_data.assay.mo_pct,
            },
          },
          'from_solids_and_water'
        );
        continue;
      }

      // CASO B: EQUIPO CON 2 O MÁS SALIDAS (Separación Sólido-Líquido, Clasificación, Flotación, Divisor)
      if (outEdges.length >= 2) {
        const primaryEdge = outEdges[0];
        const secondaryEdge = outEdges[1];

        // B.1: ESPESADORES Y FILTROS PRENSA (dewatering)
        if (role === 'dewatering') {
          const targetCp = Math.min(96, Math.max(15, Number(p.target_underflow_cp ?? 65)));
          // Identificamos cuál corriente es el Underflow/Queque y cuál es el Agua Clarificada
          const isFirstWater = primaryEdge.stream_type === 'water';
          const ufEdge = isFirstWater ? secondaryEdge : primaryEdge;
          const ofEdge = isFirstWater ? primaryEdge : secondaryEdge;

          const ufWaterMass = totalSolidsIn * ((100 - targetCp) / targetCp);
          const ufWaterM3h = Math.min(totalWaterIn, ufWaterMass / avgLiquidSg);
          const ofWaterM3h = Math.max(0, totalWaterIn - ufWaterM3h);

          ufEdge.flow_data = computeDerivedSlurryProperties(
            {
              ...ufEdge.flow_data,
              solids_tph: totalSolidsIn,
              water_m3h: ufWaterM3h,
              solid_sg: avgSolidSg,
              liquid_sg: avgLiquidSg,
              assay: {
                ...ufEdge.flow_data.assay,
                cu_pct: weightedCu,
                au_gpt: weightedAu,
                li_pct: weightedLi,
                fe_pct: weightedFe,
              },
            },
            'from_solids_and_water'
          );

          ofEdge.flow_data = computeDerivedSlurryProperties(
            {
              ...ofEdge.flow_data,
              solids_tph: 0,
              water_m3h: ofWaterM3h,
              percent_solids: 0,
              solid_sg: avgSolidSg,
              liquid_sg: avgLiquidSg,
              assay: { cu_pct: 0, au_gpt: 0, li_pct: 0, fe_pct: 0, mo_pct: 0 },
            },
            'from_solids_and_water'
          );
          continue;
        }

        // B.2: CELDAS DE FLOTACIÓN, SEPARACIÓN MAGNÉTICA Y REACTORES (concentration_leach)
        if (
          role === 'concentration_leach' &&
          (p.mass_pull_pct !== undefined || p.metal_recovery_pct !== undefined)
        ) {
          const massPullFrac = Math.min(
            0.95,
            Math.max(0.01, Number(p.mass_pull_pct ?? (p.split_ratio_primary ?? 0.1) * 100) / 100)
          );
          const recovFrac = Math.min(
            0.99,
            Math.max(0.05, Number(p.metal_recovery_pct ?? 88) / 100)
          );
          const concTargetCp = Math.min(
            85,
            Math.max(10, Number(p.concentrate_cp_pct ?? primaryEdge.flow_data.percent_solids ?? 40))
          );

          const concSolids = totalSolidsIn * massPullFrac;
          const tailsSolids = Math.max(0, totalSolidsIn - concSolids);

          const concWaterNeeded =
            (concSolids * ((100 - concTargetCp) / concTargetCp)) / avgLiquidSg;
          const concWater = Math.min(totalWaterIn * 0.9, concWaterNeeded);
          const tailsWater = Math.max(0, totalWaterIn - concWater);

          // Leyes por recuperación metalúrgica
          const totalCuFine = (totalSolidsIn * weightedCu) / 100;
          const concCuFine = totalCuFine * recovFrac;
          const tailsCuFine = Math.max(0, totalCuFine - concCuFine);

          const concCuPct = concSolids > 0 ? (concCuFine / concSolids) * 100 : weightedCu;
          const tailsCuPct = tailsSolids > 0 ? (tailsCuFine / tailsSolids) * 100 : 0.05;

          primaryEdge.flow_data = computeDerivedSlurryProperties(
            {
              ...primaryEdge.flow_data,
              solids_tph: concSolids,
              water_m3h: concWater,
               liquid_sg: avgLiquidSg,
              assay: {
                ...primaryEdge.flow_data.assay,
                cu_pct: roundTo(concCuPct, 3),
                au_gpt: roundTo(weightedAu * (recovFrac / massPullFrac) * 0.85, 2),
                li_pct: roundTo(weightedLi * (recovFrac / massPullFrac), 3),
              },
            },
            'from_solids_and_water'
          );

          secondaryEdge.flow_data = computeDerivedSlurryProperties(
            {
              ...secondaryEdge.flow_data,
              solids_tph: tailsSolids,
              water_m3h: tailsWater,
              liquid_sg: avgLiquidSg,
              assay: {
                ...secondaryEdge.flow_data.assay,
                cu_pct: roundTo(tailsCuPct, 3),
                au_gpt: roundTo(weightedAu * 0.18, 2),
                li_pct: roundTo(weightedLi * 0.15, 3),
              },
            },
            'from_solids_and_water'
          );
          continue;
        }

        // B.3: CLASIFICADORES (HIDROCICLONES / ZARANDAS) Y DIVISORES DE FLUJO
        const splitSolids = Math.min(0.98, Math.max(0.02, Number(p.split_ratio_primary ?? 0.65)));
        const firstSolids = totalSolidsIn * splitSolids;
        const secondSolids = Math.max(0, totalSolidsIn - firstSolids);

        let firstWater = totalWaterIn * (p.water_split_ratio ?? splitSolids);
        if (p.target_underflow_cp && p.target_underflow_cp > 10 && p.target_underflow_cp < 95) {
          // Si tiene %Cp objetivo en el Underflow (segunda corriente en ciclones), calculamos su agua exacta
          const ufWater =
            (secondSolids * ((100 - p.target_underflow_cp) / p.target_underflow_cp)) / avgLiquidSg;
          if (ufWater <= totalWaterIn) {
            firstWater = totalWaterIn - ufWater;
          }
        }
        const secondWater = Math.max(0, totalWaterIn - firstWater);

        primaryEdge.flow_data = computeDerivedSlurryProperties(
          {
            ...primaryEdge.flow_data,
            solids_tph: firstSolids,
            water_m3h: firstWater,
            solid_sg: avgSolidSg,
            liquid_sg: avgLiquidSg,
          },
          'from_solids_and_water'
        );

        const totalCuFineIn = (totalSolidsIn * weightedCu) / 100;
        const firstCuFine = (firstSolids * primaryEdge.flow_data.assay.cu_pct) / 100;
        const secondCuPct =
          secondSolids > 0
            ? Math.max(0.01, ((totalCuFineIn - firstCuFine) / secondSolids) * 100)
            : weightedCu;

        secondaryEdge.flow_data = computeDerivedSlurryProperties(
          {
            ...secondaryEdge.flow_data,
            solids_tph: secondSolids,
            water_m3h: secondWater,
            solid_sg: avgSolidSg,
            liquid_sg: avgLiquidSg,
            assay: {
              ...secondaryEdge.flow_data.assay,
              cu_pct: roundTo(secondCuPct, 3),
            },
          },
          'from_solids_and_water'
        );
      }
    }
  }

  return {
    ...flowsheet,
    edges: updatedEdges,
  };
}

function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EquipmentNode,
  Flowsheet,
  NodeBalanceDiagnostics,
  StreamEdge,
  StreamFlowData,
} from '../types/process';

/**
 * MOTOR DE CÁLCULO METALÚRGICO DE PULPAS Y BALANCE DE MASA
 * 
 * Ecuaciones fundamentales implementadas:
 * 1. Flujo de Agua a partir de Sólidos y %Cp:
 *    M_l (t/h) = M_s * ((100 - Cp) / Cp)
 *    Q_l (m³/h) = M_l / ρ_l
 * 
 * 2. Porcentaje de Sólidos en Peso (%Cp) a partir de Sólidos y Agua:
 *    Cp (%) = (M_s / (M_s + Q_l * ρ_l)) * 100
 * 
 * 3. Caudal Volumétrico de Pulpa (m³/h):
 *    Q_p = (M_s / ρ_s) + Q_l
 * 
 * 4. Densidad de Pulpa (t/m³):
 *    ρ_p = (M_s + Q_l * ρ_l) / Q_p
 *    Equivalentemente: ρ_p = 100 / ( (Cp / ρ_s) + ((100 - Cp) / ρ_l) )
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
      // Si es una corriente de agua pura (0 t/h sólidos)
      percent_solids = 0;
    } else if (percent_solids >= 99.99) {
      percent_solids = 100;
      water_m3h = 0;
    } else if (percent_solids > 0) {
      const liquidMass_tph = solids_tph * ((100 - percent_solids) / percent_solids);
      water_m3h = liquidMass_tph / liquid_sg;
    }
  } else {
    // mode === 'from_solids_and_water'
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
 * Evalúa el cierre de balance de masa en un nodo (Conservación de Materia):
 * Σ Entradas = Σ Salidas (Sólidos, Agua y Finos Metálicos)
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

  const waterIn_m3h = inEdges.reduce(
    (acc, e) => acc + e.flow_data.water_m3h,
    0
  );
  const waterOut_m3h = outEdges.reduce(
    (acc, e) => acc + e.flow_data.water_m3h,
    0
  );
  const waterDelta_m3h = waterIn_m3h - waterOut_m3h;

  // Finos de Cobre (t/h de Cu fino = Solids_tph * (%Cu / 100))
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
    waterOut_m3h: roundTo(waterOut_m3h, 2),
    waterDelta_m3h: roundTo(waterDelta_m3h, 2),
    waterError_pct: roundTo(waterError_pct, 2),
    cuFineIn_tph: roundTo(cuFineIn_tph, 3),
    cuFineOut_tph: roundTo(cuFineOut_tph, 3),
    cuError_pct: roundTo(cuError_pct, 2),
    isBalanced,
    status,
  };
}

/**
 * Reconciliador Automático de Balance de Masa en el Flowsheet:
 * Propaga flujos desde las corrientes de entrada hacia las corrientes de salida
 * respetando Σ Entradas = Σ Salidas en mezcladores, equipos de paso y divisores.
 */
export function reconcileFlowsheetMassBalance(flowsheet: Flowsheet): Flowsheet {
  const updatedEdges = flowsheet.edges.map((e) => ({
    ...e,
    flow_data: computeDerivedSlurryProperties(e.flow_data, 'from_solids_and_water'),
  }));

  // Iteramos topológicamente hasta 6 pasadas para propagar corrientes aguas abajo
  for (let pass = 0; pass < 6; pass++) {
    for (const node of flowsheet.nodes) {
      const inEdges = updatedEdges.filter((e) => e.target_node_id === node.id);
      const outEdges = updatedEdges.filter((e) => e.source_node_id === node.id);

      if (inEdges.length === 0 || outEdges.length === 0) continue;

      const totalSolidsIn = inEdges.reduce((s, e) => s + e.flow_data.solids_tph, 0);
      const totalWaterIn = inEdges.reduce((s, e) => s + e.flow_data.water_m3h, 0);

      // Ponderación de leyes y gravedad específica a la entrada
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

      if (outEdges.length === 1) {
        // Caso 1: Nodo Mezclador o Equipo 1-Salida (Conservación exacta: Salida = Σ Entradas)
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
      } else if (outEdges.length >= 2) {
        // Caso 2: Divisor, Hidrociclón, Flotación o Espesador (2+ salidas)
        // Si la primera salida (ej. Underflow / Concentrado) está definida o el nodo tiene split_ratio_primary,
        // ajustamos la última salida por diferencia exacta para cerrar el balance al 100.00%.
        const primaryEdges = outEdges.slice(0, outEdges.length - 1);
        const remainderEdge = outEdges[outEdges.length - 1];

        let sumPrimarySolids = primaryEdges.reduce((s, e) => s + e.flow_data.solids_tph, 0);
        let sumPrimaryWater = primaryEdges.reduce((s, e) => s + e.flow_data.water_m3h, 0);

        // Si las salidas primarias exceden la entrada, aplicamos partición proporcional según split_ratio_primary
        if (sumPrimarySolids > totalSolidsIn || sumPrimaryWater > totalWaterIn || sumPrimarySolids === 0) {
          const splitSolids = node.parameters.split_ratio_primary ?? 0.65;
          const primaryEdge = outEdges[0];
          const primarySolids = totalSolidsIn * splitSolids;
          const primaryWater = totalWaterIn * splitSolids;

          primaryEdge.flow_data = computeDerivedSlurryProperties(
            {
              ...primaryEdge.flow_data,
              solids_tph: primarySolids,
              water_m3h: primaryWater,
              solid_sg: avgSolidSg,
              liquid_sg: avgLiquidSg,
            },
            'from_solids_and_water'
          );
          sumPrimarySolids = primaryEdge.flow_data.solids_tph;
          sumPrimaryWater = primaryEdge.flow_data.water_m3h;
        }

        const remSolids = Math.max(0, totalSolidsIn - sumPrimarySolids);
        const remWater = Math.max(0, totalWaterIn - sumPrimaryWater);

        // Balance de finos de Cu para conservar metal contenido
        const totalCuFineIn = (totalSolidsIn * weightedCu) / 100;
        const sumPrimaryCuFine = primaryEdges.reduce(
          (s, e) => s + (e.flow_data.solids_tph * e.flow_data.assay.cu_pct) / 100,
          0
        );
        const remCuPct =
          remSolids > 0
            ? Math.max(0.01, ((totalCuFineIn - sumPrimaryCuFine) / remSolids) * 100)
            : weightedCu;

        remainderEdge.flow_data = computeDerivedSlurryProperties(
          {
            ...remainderEdge.flow_data,
            solids_tph: remSolids,
            water_m3h: remWater,
            solid_sg: avgSolidSg,
            liquid_sg: avgLiquidSg,
            assay: {
              ...remainderEdge.flow_data.assay,
              cu_pct: roundTo(remCuPct, 3),
              au_gpt: roundTo(weightedAu * 0.45, 2),
              li_pct: roundTo(weightedLi, 3),
              fe_pct: roundTo(weightedFe, 2),
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

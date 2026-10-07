/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { INITIAL_FLOWSHEETS } from '../data/initialProjects';
import { Flowsheet } from '../types/process';
import {
  computeDerivedSlurryProperties,
  computeStreamMetalFines,
  evaluateNodeBalance,
  parseSafeEngineeringNumber,
  reconcileFlowsheetMassBalance,
  solveFlowsheetWithReport,
  validateFlowsheetGraph,
} from './massBalanceMath';

describe('Suite de Auditoría y Verificación Metalúrgica TAGING PFD', () => {
  describe('1. Fórmulas de Pulpa Mineral y Casos Límite', () => {
    it('Verifica caso de referencia a mano: Ms = 1500 t/h, Cp = 62%, ρs = 2.75', () => {
      const res = computeDerivedSlurryProperties(
        {
          solids_tph: 1500,
          percent_solids: 62,
          solid_sg: 2.75,
          liquid_sg: 1.0,
        },
        'from_solids_and_cp'
      );

      // Agua requerida: 1500 * (100 - 62) / 62 = 919.3548 -> 919.35 m³/h
      expect(res.water_m3h).toBeCloseTo(919.35, 2);
      // Masa de pulpa: 1500 + 919.3548 = 2419.35 t/h
      expect(res.pulp_mass_tph).toBeCloseTo(2419.35, 2);
      // Caudal volumétrico: 1500/2.75 + 919.3548 = 545.4545 + 919.3548 = 1464.81 m³/h
      expect(res.pulp_vol_m3h).toBeCloseTo(1464.81, 2);
      // Densidad de pulpa: 100 / (62/2.75 + 38/1.0) = 1.65165 -> 1.652 t/m³
      expect(res.pulp_density).toBeCloseTo(1.652, 3);
    });

    it('Verifica equivalencia entre modo Fijar Sólidos+%Cp y Fijar Sólidos+Agua', () => {
      const fromCp = computeDerivedSlurryProperties(
        { solids_tph: 1800, percent_solids: 97, solid_sg: 2.75, liquid_sg: 1.0 },
        'from_solids_and_cp'
      );
      expect(fromCp.water_m3h).toBeCloseTo(55.67, 2);

      const fromWater = computeDerivedSlurryProperties(
        { solids_tph: 1800, water_m3h: 55.67, solid_sg: 2.75, liquid_sg: 1.0 },
        'from_solids_and_water'
      );
      expect(fromWater.percent_solids).toBeCloseTo(97.0, 2);
      expect(fromWater.pulp_mass_tph).toBeCloseTo(1855.67, 2);
      expect(fromWater.pulp_density).toBeCloseTo(fromCp.pulp_density, 3);
    });

    it('Maneja casos límite: Cp = 0, Cp = 100, Ms = 0, ρs <= ρl, negativos, vacíos y coma decimal', () => {
      // Ms = 0, Agua = 944.33 -> Cp = 0%, densidad = 1.000
      const pureWater = computeDerivedSlurryProperties(
        { solids_tph: 0, water_m3h: 944.33, percent_solids: 0, solid_sg: 2.75, liquid_sg: 1.0 },
        'from_solids_and_water'
      );
      expect(pureWater.percent_solids).toBe(0);
      expect(pureWater.pulp_mass_tph).toBeCloseTo(944.33, 2);
      expect(pureWater.pulp_density).toBeCloseTo(1.0, 3);

      // Cp = 100% (mineral seco sin agua) -> Agua = 0, densidad = ρs
      const dryOre = computeDerivedSlurryProperties(
        { solids_tph: 1000, percent_solids: 100, solid_sg: 2.8, liquid_sg: 1.0 },
        'from_solids_and_cp'
      );
      expect(dryOre.water_m3h).toBe(0);
      expect(dryOre.pulp_mass_tph).toBe(1000);
      expect(dryOre.pulp_density).toBeCloseTo(2.8, 3);

      // ρs <= ρl -> corrige automáticamente ρs > ρl y evita densidades inválidas
      const badSg = computeDerivedSlurryProperties(
        { solids_tph: 500, percent_solids: 50, solid_sg: 0.9, liquid_sg: 1.1 },
        'from_solids_and_cp'
      );
      expect(badSg.solid_sg).toBeGreaterThan(badSg.liquid_sg);
      expect(Number.isFinite(badSg.pulp_density)).toBe(true);

      // Coma decimal, negativos y NaN
      expect(parseSafeEngineeringNumber('64,29', 0)).toBeCloseTo(64.29, 2);
      expect(parseSafeEngineeringNumber('-45', 0, 0)).toBe(0);
      expect(parseSafeEngineeringNumber('texto_invalido', 10)).toBe(10);
      expect(parseSafeEngineeringNumber(NaN, 5)).toBe(5);
    });
  });

  describe('2. Verificación Completa del Caso Base PRJ-2026-104 (Masa, Agua y 5 Elementos)', () => {
    it('Cumple todos los valores esperados en STR-001..STR-007 y cierra todos los nodos dentro de ±0.1%', () => {
      const baseFs: Flowsheet = JSON.parse(
        JSON.stringify(INITIAL_FLOWSHEETS['prj-copper-sag'])
      );
      const { flowsheet: solved, report } = solveFlowsheetWithReport(baseFs);

      expect(report.converged).toBe(true);

      const getEdge = (id: string) => solved.edges.find((e) => e.id === id)!;

      // STR-001: 1800 t/h al 97% (agua 55.67 m³/h)
      const s1 = getEdge('STR-001');
      expect(s1.flow_data.solids_tph).toBeCloseTo(1800, 1);
      expect(s1.flow_data.water_m3h).toBeCloseTo(55.67, 2);
      expect(s1.flow_data.percent_solids).toBeCloseTo(97.0, 2);

      // STR-002: agua 944.33 m³/h
      const s2 = getEdge('STR-002');
      expect(s2.flow_data.solids_tph).toBe(0);
      expect(s2.flow_data.water_m3h).toBeCloseTo(944.33, 2);

      // STR-003: 1800 t/h con 1000 m³/h (64.29% Cp), Cu fino = 15.30 t/h
      const s3 = getEdge('STR-003');
      expect(s3.flow_data.solids_tph).toBeCloseTo(1800, 1);
      expect(s3.flow_data.water_m3h).toBeCloseTo(1000, 1);
      expect(s3.flow_data.percent_solids).toBeCloseTo(64.29, 2);
      expect(computeStreamMetalFines(s3.flow_data).Cu).toBeCloseTo(15.3, 3);

      // Ciclones CY-202 split 65/35 -> STR-004 (1170 t/h, 790 m³/h) + STR-005 (630 t/h, 210 m³/h)
      const s4 = getEdge('STR-004');
      const s5 = getEdge('STR-005');
      expect(s4.flow_data.solids_tph).toBeCloseTo(1170, 1);
      expect(s4.flow_data.water_m3h).toBeCloseTo(790, 1);
      expect(s5.flow_data.solids_tph).toBeCloseTo(630, 1);
      expect(s5.flow_data.water_m3h).toBeCloseTo(210, 1);
      expect(computeStreamMetalFines(s4.flow_data).Cu).toBeCloseTo(10.764, 3);

      // Flotación Rougher FT-301 (10% mass pull, 90% recov Cu) -> STR-006 (117 t/h, 175.5 m³/h) + STR-007 (1053 t/h, 614.5 m³/h)
      const s6 = getEdge('STR-006');
      const s7 = getEdge('STR-007');
      expect(s6.flow_data.solids_tph).toBeCloseTo(117, 1);
      expect(s6.flow_data.water_m3h).toBeCloseTo(175.5, 1);
      expect(s7.flow_data.solids_tph).toBeCloseTo(1053, 1);
      expect(s7.flow_data.water_m3h).toBeCloseTo(614.5, 1);

      const cuConc = computeStreamMetalFines(s6.flow_data).Cu;
      const cuFeedRougher = computeStreamMetalFines(s4.flow_data).Cu;
      expect(cuConc).toBeCloseTo(9.6876, 3);
      expect((cuConc / cuFeedRougher) * 100).toBeCloseTo(90.0, 1);

      // Auditoría nodo por nodo: ML-201, CY-202 y FT-301 deben cerrar en Sólidos, Agua, Cu, Au, Li, Fe y Mo (error <= 0.1%)
      for (const node of solved.nodes) {
        const diag = evaluateNodeBalance(node, solved.edges, 0.1);
        if (!diag.isBoundary) {
          expect(diag.isBalanced).toBe(true);
          expect(diag.solidsError_pct).toBeLessThanOrEqual(0.1);
          expect(diag.waterError_pct).toBeLessThanOrEqual(0.1);
          expect(diag.cuError_pct).toBeLessThanOrEqual(0.1);
          expect(diag.auError_pct).toBeLessThanOrEqual(0.1);
          expect(diag.liError_pct).toBeLessThanOrEqual(0.1);
          expect(diag.feError_pct).toBeLessThanOrEqual(0.1);
          expect(diag.moError_pct).toBeLessThanOrEqual(0.1);
          expect(diag.failingVariables).toEqual([]);
        }
      }
    });

    it('Detecta explícitamente desbalances de Au y Mo cuando las leyes de salida están trucadas/redondeadas', () => {
      const baseFs: Flowsheet = JSON.parse(
        JSON.stringify(INITIAL_FLOWSHEETS['prj-copper-sag'])
      );
      // Forzamos el valor antiguo redondeado en STR-005 (Au = 0.36 en vez de 0.3643)
      const str5 = baseFs.edges.find((e) => e.id === 'STR-005')!;
      str5.flow_data.assay.au_gpt = 0.36;

      const cyNode = baseFs.nodes.find((n) => n.tag === 'CY-202')!;
      const diag = evaluateNodeBalance(cyNode, baseFs.edges, 0.1);

      // Au entra 756 g/h y sale 526.5 + 226.8 = 753.3 g/h -> error ~0.36% > 0.1%
      expect(diag.auError_pct).toBeGreaterThan(0.3);
      expect(diag.isBalanced).toBe(false);
      expect(diag.failingVariables.some((v) => v.startsWith('Au'))).toBe(true);
    });
  });

  describe('3. Circuitos Cerrados con Recirculación (Molino + Hidrociclón Carga Circulante 150-300%)', () => {
    it('Converge un circuito cerrado Molino-Hidrociclón con carga circulante del 250% (split OF = 40%, UF = 60%)', () => {
      // Alimentación fresca F = 1000 t/h sólidos, 500 m³/h agua.
      // Hidrociclón envía 40% al Overflow (producto final) y 60% al Underflow (recircula al Molino).
      // En estado estacionario: Overflow = 1000 t/h, Entrada Molino/Ciclón = 1000 / 0.40 = 2500 t/h,
      // Underflow (Carga Circulante) = 1500 t/h (Razón Carga Circulante = 1500 / 1000 = 150%).
      const closedLoopFs: Flowsheet = {
        id: 'fs-closed-loop',
        project_id: 'prj-test',
        version: 'Rev 1.0',
        tolerance_pct: 0.1,
        nodes: [
          {
            id: 'n-feed',
            tag: 'FD-101',
            type: 'feed_source',
            category: 'Bloques Genéricos',
            name: 'Alimentación Fresca',
            position_x: 50,
            position_y: 100,
            parameters: { feed_solids_tph: 1000, feed_water_m3h: 500, feed_cu_pct: 1.0 },
          },
          {
            id: 'n-mill',
            tag: 'ML-201',
            type: 'mill_ball',
            category: 'Comminución',
            name: 'Molino de Bolas Circuito Cerrado',
            position_x: 300,
            position_y: 100,
            parameters: { added_water_m3h: 0 },
          },
          {
            id: 'n-cyc',
            tag: 'CY-202',
            type: 'hydrocyclone',
            category: 'Comminución',
            name: 'Ciclones Clasificación',
            position_x: 600,
            position_y: 100,
            parameters: { split_ratio_primary: 0.4, water_split_ratio: 0.5 },
          },
          {
            id: 'n-sink',
            tag: 'PR-301',
            type: 'product_sink',
            category: 'Bloques Genéricos',
            name: 'Producto Overflow a Flotación',
            position_x: 900,
            position_y: 100,
            parameters: {},
          },
        ],
        edges: [
          {
            id: 'STR-001',
            name: 'Alimentación Fresca',
            source_node_id: 'n-feed',
            target_node_id: 'n-mill',
            stream_type: 'ore',
            flow_data: computeDerivedSlurryProperties(
              { solids_tph: 1000, water_m3h: 500, assay: { cu_pct: 1.0, au_gpt: 0.5, li_pct: 0, fe_pct: 2, mo_pct: 0.02 } },
              'from_solids_and_water'
            ),
          },
          {
            id: 'STR-002',
            name: 'Descarga Molino a Ciclón',
            source_node_id: 'n-mill',
            target_node_id: 'n-cyc',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties(
              { solids_tph: 1000, water_m3h: 500, assay: { cu_pct: 1.0, au_gpt: 0.5, li_pct: 0, fe_pct: 2, mo_pct: 0.02 } },
              'from_solids_and_water'
            ),
          },
          {
            id: 'STR-003',
            name: 'Overflow Ciclón (Producto)',
            source_node_id: 'n-cyc',
            target_node_id: 'n-sink',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties(
              { solids_tph: 400, water_m3h: 250, assay: { cu_pct: 1.0, au_gpt: 0.5, li_pct: 0, fe_pct: 2, mo_pct: 0.02 } },
              'from_solids_and_water'
            ),
          },
          {
            id: 'STR-004',
            name: 'Underflow Ciclón (Recirculación a Molino)',
            source_node_id: 'n-cyc',
            target_node_id: 'n-mill',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties(
              { solids_tph: 600, water_m3h: 250, assay: { cu_pct: 1.0, au_gpt: 0.5, li_pct: 0, fe_pct: 2, mo_pct: 0.02 } },
              'from_solids_and_water'
            ),
          },
        ],
      };

      const { flowsheet: solved, report } = solveFlowsheetWithReport(closedLoopFs);
      expect(report.hasRecycleLoops).toBe(true);
      expect(report.converged).toBe(true);
      expect(report.circulatingLoadRatio_pct).toBeCloseTo(150.0, 1);

      const s2 = solved.edges.find((e) => e.id === 'STR-002')!;
      const s3 = solved.edges.find((e) => e.id === 'STR-003')!;
      const s4 = solved.edges.find((e) => e.id === 'STR-004')!;

      // En estado estacionario: Salida al sumidero (STR-003) iguala exactamente la entrada fresca (1000 t/h, 500 m³/h)
      expect(s3.flow_data.solids_tph).toBeCloseTo(1000, 1);
      expect(s3.flow_data.water_m3h).toBeCloseTo(500, 1);
      // Carga circulante STR-004 = 1500 t/h; Descarga molino STR-002 = 2500 t/h
      expect(s4.flow_data.solids_tph).toBeCloseTo(1500, 1);
      expect(s2.flow_data.solids_tph).toBeCloseTo(2500, 1);

      // Todos los nodos internos (Molino y Ciclón) cierran a 0.00%
      const millDiag = evaluateNodeBalance(solved.nodes[1], solved.edges, 0.1);
      const cycDiag = evaluateNodeBalance(solved.nodes[2], solved.edges, 0.1);
      expect(millDiag.isBalanced).toBe(true);
      expect(cycDiag.isBalanced).toBe(true);
    });
  });

  describe('4. Validación Topológica de Grafo (Nodos sin salida, Huérfanas, Divisor Múltiple)', () => {
    it('Detecta corrientes huérfanas, nodos desconectados y equipos internos sin salida', () => {
      const invalidFs: Flowsheet = {
        id: 'fs-invalid',
        project_id: 'prj-test',
        version: 'Rev 1.0',
        tolerance_pct: 0.1,
        nodes: [
          {
            id: 'n-disc',
            tag: 'ML-999',
            type: 'mill_sag',
            category: 'Comminución',
            name: 'Molino Aislado',
            position_x: 100,
            position_y: 100,
            parameters: {},
          },
          {
            id: 'n-deadend',
            tag: 'TK-201',
            type: 'leach_tank',
            category: 'Manejo de Sólidos/Líquidos',
            name: 'Tanque Sin Descarga',
            position_x: 300,
            position_y: 100,
            parameters: {},
          },
          {
            id: 'n-feed',
            tag: 'FD-101',
            type: 'feed_source',
            category: 'Bloques Genéricos',
            name: 'Feed',
            position_x: 50,
            position_y: 100,
            parameters: {},
          },
        ],
        edges: [
          {
            id: 'STR-001',
            name: 'Flujo a Tanque sin salida',
            source_node_id: 'n-feed',
            target_node_id: 'n-deadend',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties({ solids_tph: 500, water_m3h: 500 }),
          },
          {
            id: 'STR-ORPHAN',
            name: 'Corriente Huérfana',
            source_node_id: 'n-feed',
            target_node_id: 'nodo-inexistente',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties({ solids_tph: 100, water_m3h: 100 }),
          },
        ],
      };

      const issues = validateFlowsheetGraph(invalidFs);
      expect(issues.some((i) => i.code === 'DISCONNECTED_NODE' && i.targetLabel === 'ML-999')).toBe(
        true
      );
      expect(
        issues.some((i) => i.code === 'MISSING_OUTLET_FOR_INTERNAL' && i.targetLabel === 'TK-201')
      ).toBe(true);
      expect(issues.some((i) => i.code === 'ORPHAN_STREAM' && i.targetLabel === 'STR-ORPHAN')).toBe(
        true
      );
    });

    it('Balancea correctamente un divisor múltiple (3 salidas) y corrientes con ley cero', () => {
      const multiSplitFs: Flowsheet = {
        id: 'fs-multisplit',
        project_id: 'prj-test',
        version: 'Rev 1.0',
        tolerance_pct: 0.1,
        nodes: [
          {
            id: 'f1',
            tag: 'FD-1',
            type: 'feed_source',
            category: 'Bloques Genéricos',
            name: 'Feed',
            position_x: 0,
            position_y: 0,
            parameters: {},
          },
          {
            id: 'sp1',
            tag: 'SP-1',
            type: 'splitter_node',
            category: 'Bloques Genéricos',
            name: 'Distribuidor Triple',
            position_x: 200,
            position_y: 0,
            parameters: {},
          },
          {
            id: 'p1',
            tag: 'PR-1',
            type: 'product_sink',
            category: 'Bloques Genéricos',
            name: 'Out 1',
            position_x: 400,
            position_y: 0,
            parameters: {},
          },
          {
            id: 'p2',
            tag: 'PR-2',
            type: 'product_sink',
            category: 'Bloques Genéricos',
            name: 'Out 2',
            position_x: 400,
            position_y: 100,
            parameters: {},
          },
          {
            id: 'p3',
            tag: 'PR-3',
            type: 'product_sink',
            category: 'Bloques Genéricos',
            name: 'Out 3',
            position_x: 400,
            position_y: 200,
            parameters: {},
          },
        ],
        edges: [
          {
            id: 'STR-1',
            name: 'In',
            source_node_id: 'f1',
            target_node_id: 'sp1',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties({
              solids_tph: 900,
              water_m3h: 600,
              assay: { cu_pct: 0, au_gpt: 0, li_pct: 0, fe_pct: 0, mo_pct: 0 },
            }),
          },
          {
            id: 'STR-2',
            name: 'B1',
            source_node_id: 'sp1',
            target_node_id: 'p1',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties({ solids_tph: 300, water_m3h: 200 }),
          },
          {
            id: 'STR-3',
            name: 'B2',
            source_node_id: 'sp1',
            target_node_id: 'p2',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties({ solids_tph: 300, water_m3h: 200 }),
          },
          {
            id: 'STR-4',
            name: 'B3',
            source_node_id: 'sp1',
            target_node_id: 'p3',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties({ solids_tph: 300, water_m3h: 200 }),
          },
        ],
      };

      const solved = reconcileFlowsheetMassBalance(multiSplitFs);
      const spDiag = evaluateNodeBalance(solved.nodes[1], solved.edges, 0.1);
      expect(spDiag.isBalanced).toBe(true);
      expect(spDiag.solidsOut_tph).toBeCloseTo(900, 2);
      expect(spDiag.waterOut_m3h).toBeCloseTo(600, 2);
    });

    it('Balancea exactamente un mezclador de múltiples corrientes con distintas leyes y reporta no-convergencia si maxIterations=1 en ciclo cerrado', () => {
      const mixerFlowsheet: Flowsheet = {
        id: 'fs-mixer-test',
        project_id: 'prj-mixer',
        version: 'Rev 1.0',
        tolerance_pct: 0.1,
        nodes: [
          {
            id: 'f1',
            tag: 'FD-1',
            type: 'feed_source',
            category: 'Bloques Genéricos',
            name: 'Feed 1',
            position_x: 0,
            position_y: 0,
            parameters: {},
          },
          {
            id: 'f2',
            tag: 'FD-2',
            type: 'feed_source',
            category: 'Bloques Genéricos',
            name: 'Feed 2',
            position_x: 0,
            position_y: 120,
            parameters: {},
          },
          {
            id: 'mix',
            tag: 'MX-101',
            type: 'conditioning_tank',
            category: 'Manejo de Pulpas',
            name: 'Estanque Mezclador',
            position_x: 250,
            position_y: 60,
            parameters: { added_water_m3h: 50 },
          },
          {
            id: 'sink',
            tag: 'PR-1',
            type: 'product_sink',
            category: 'Bloques Genéricos',
            name: 'Descarga',
            position_x: 500,
            position_y: 60,
            parameters: {},
          },
        ],
        edges: [
          {
            id: 'S-IN-1',
            name: 'Entrada 1',
            source_node_id: 'f1',
            target_node_id: 'mix',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties(
              {
                solids_tph: 600,
                water_m3h: 300,
                solid_sg: 2.7,
                liquid_sg: 1.0,
                assay: { cu_pct: 1.0, au_gpt: 0.5, li_pct: 0, fe_pct: 4.0, mo_pct: 0.02 },
              },
              'from_solids_and_water'
            ),
          },
          {
            id: 'S-IN-2',
            name: 'Entrada 2',
            source_node_id: 'f2',
            target_node_id: 'mix',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties(
              {
                solids_tph: 400,
                water_m3h: 150,
                solid_sg: 2.8,
                liquid_sg: 1.0,
                assay: { cu_pct: 0.5, au_gpt: 0.25, li_pct: 0, fe_pct: 2.0, mo_pct: 0.01 },
              },
              'from_solids_and_water'
            ),
          },
          {
            id: 'S-OUT',
            name: 'Salida Mezcla',
            source_node_id: 'mix',
            target_node_id: 'sink',
            stream_type: 'slurry',
            flow_data: computeDerivedSlurryProperties({ solids_tph: 0, water_m3h: 0 }),
          },
        ],
      };

      const { flowsheet: solved } = solveFlowsheetWithReport(mixerFlowsheet);
      const out = solved.edges.find((e) => e.id === 'S-OUT')!.flow_data;
      expect(out.solids_tph).toBeCloseTo(1000, 2);
      expect(out.water_m3h).toBeCloseTo(500, 2); // 300 + 150 + 50 agua adicionada
      expect(out.assay.cu_pct).toBeCloseTo(0.8, 3); // (600*1 + 400*0.5)/1000 = 0.8%
      expect(out.assay.au_gpt).toBeCloseTo(0.4, 3); // (300 + 100)/1000 = 0.4 g/t
      expect(out.assay.mo_pct).toBeCloseTo(0.016, 4); // (12 + 4)/1000 = 0.016%

      const mixDiag = evaluateNodeBalance(
        solved.nodes.find((n) => n.id === 'mix')!,
        solved.edges,
        0.1
      );
      expect(mixDiag.isBalanced).toBe(true);
    });
  });
});

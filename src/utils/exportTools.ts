/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Flowsheet, NodeBalanceDiagnostics, Project } from '../types/process';

/**
 * Exporta la Tabla Resumen de Balance de Masa a un archivo CSV compatible con Excel (UTF-8 con BOM)
 */
export function exportMassBalanceToCsv(
  project: Project,
  flowsheet: Flowsheet,
  diagnostics: NodeBalanceDiagnostics[]
): void {
  const nodeMap = new Map(flowsheet.nodes.map((n) => [n.id, `${n.tag} (${n.name})`]));

  const headers = [
    'ID Corriente',
    'Nombre de Corriente',
    'Tipo de Flujo',
    'Equipo Origen',
    'Equipo Destino',
    'Sólidos Secos (t/h)',
    'Agua / Solución (m³/h)',
    'Pulpa Total (t/h)',
    'Caudal Pulpa (m³/h)',
    '% Sólidos Peso (%Cp)',
    'Gravedad Esp. Sólido (t/m³)',
    'Densidad Líquido (t/m³)',
    'Densidad Pulpa (t/m³)',
    'Ley Cu (%)',
    'Ley Au (g/t)',
    'Ley Li (%)',
    'Ley Fe (%)',
    'Cobre Fino (t/h)',
    'Reactivos (g/t)',
  ];

  const rows = flowsheet.edges.map((edge) => {
    const d = edge.flow_data;
    const cuFine = ((d.solids_tph * d.assay.cu_pct) / 100).toFixed(3);
    return [
      edge.id,
      `"${edge.name.replace(/"/g, '""')}"`,
      edge.stream_type.toUpperCase(),
      `"${nodeMap.get(edge.source_node_id) ?? edge.source_node_id}"`,
      `"${nodeMap.get(edge.target_node_id) ?? edge.target_node_id}"`,
      d.solids_tph.toFixed(2),
      d.water_m3h.toFixed(2),
      d.pulp_mass_tph.toFixed(2),
      d.pulp_vol_m3h.toFixed(2),
      d.percent_solids.toFixed(2),
      d.solid_sg.toFixed(2),
      d.liquid_sg.toFixed(2),
      d.pulp_density.toFixed(3),
      d.assay.cu_pct.toFixed(3),
      d.assay.au_gpt.toFixed(2),
      d.assay.li_pct.toFixed(3),
      d.assay.fe_pct.toFixed(2),
      cuFine,
      d.reagent_dosage_gpt.toFixed(1),
    ].join(',');
  });

  const nodeClosureHeader = [
    '',
    'DIAGNÓSTICO DE CIERRE DE BALANCE POR EQUIPO / NODO',
    'Tag Equipo,Nombre Equipo,Sólidos Entrada (t/h),Sólidos Salida (t/h),Delta Sólidos (t/h),Error Sólidos (%),Agua Entrada (m³/h),Agua Salida (m³/h),Error Agua (%),Estado Cierre',
  ];

  const nodeClosureRows = diagnostics
    .filter((n) => !n.isBoundary)
    .map((n) =>
      [
        n.nodeTag,
        `"${n.nodeName}"`,
        n.solidsIn_tph.toFixed(2),
        n.solidsOut_tph.toFixed(2),
        n.solidsDelta_tph.toFixed(2),
        n.solidsError_pct.toFixed(2),
        n.waterIn_m3h.toFixed(2),
        n.waterOut_m3h.toFixed(2),
        n.waterError_pct.toFixed(2),
        n.isBalanced ? 'BALANCEADO (OK)' : 'DESBALANCEADO (ALERTA)',
      ].join(',')
    );

  const metadataBlock = [
    `"PROYECTO: ${project.name}"`,
    `"CÓDIGO: ${project.code} | CLIENTE: ${project.client} | UNIDAD: ${project.mining_unit}"`,
    `"FASE: ${project.phase} | INGENIERO: ${project.lead_engineer} | VERSIÓN: ${flowsheet.version}"`,
    `"TOLERANCIA CIERRE: ±${flowsheet.tolerance_pct}% | FECHA EXPORTACIÓN: ${new Date().toISOString().slice(0, 10)}"`,
    '',
  ];

  const csvContent =
    '\uFEFF' +
    [...metadataBlock, headers.join(','), ...rows, ...nodeClosureHeader, ...nodeClosureRows].join(
      '\n'
    );

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${project.code}_Balance_Masa_${flowsheet.id}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Genera y descarga una representación vectorial SVG limpa del diagrama de flujo PFD actual
 */
export function exportFlowsheetToSvg(project: Project, flowsheet: Flowsheet): void {
  const width = 1520;
  const height = 640;

  const nodeMap = new Map(flowsheet.nodes.map((n) => [n.id, n]));

  const edgesSvg = flowsheet.edges
    .map((edge) => {
      const src = nodeMap.get(edge.source_node_id);
      const tgt = nodeMap.get(edge.target_node_id);
      if (!src || !tgt) return '';

      const x1 = src.position_x + 190;
      const y1 = src.position_y + 42;
      const x2 = tgt.position_x;
      const y2 = tgt.position_y + 42;
      const midX = Math.round((x1 + x2) / 2);
      const pathData = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

      const strokeColor =
        edge.stream_type === 'water'
          ? '#38bdf8'
          : edge.stream_type === 'concentrate'
          ? '#10b981'
          : edge.stream_type === 'tailings'
          ? '#f59e0b'
          : '#94a3b8';

      return `
        <g>
          <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="2.5" />
          <rect x="${midX - 46}" y="${(y1 + y2) / 2 - 18}" width="92" height="34" rx="4" fill="#0f172a" stroke="${strokeColor}" stroke-width="1" />
          <text x="${midX}" y="${(y1 + y2) / 2 - 4}" fill="#f8fafc" font-family="monospace" font-size="10" font-weight="bold" text-anchor="middle">${edge.id}</text>
          <text x="${midX}" y="${(y1 + y2) / 2 + 10}" fill="#cbd5e1" font-family="monospace" font-size="9" text-anchor="middle">${edge.flow_data.solids_tph}t/h · ${edge.flow_data.percent_solids}%Cp</text>
        </g>
      `;
    })
    .join('\n');

  const nodesSvg = flowsheet.nodes
    .map((node) => {
      return `
        <g transform="translate(${node.position_x}, ${node.position_y})">
          <rect width="190" height="84" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1.8" />
          <text x="12" y="22" fill="#06b6d4" font-family="monospace" font-size="11" font-weight="bold">${node.tag}</text>
          <text x="12" y="42" fill="#f8fafc" font-family="sans-serif" font-size="11" font-weight="bold">${escapeXml(node.name.slice(0, 26))}</text>
          <text x="12" y="62" fill="#94a3b8" font-family="sans-serif" font-size="10">${escapeXml(node.category)}</text>
        </g>
      `;
    })
    .join('\n');

  const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#020617" />
  <g transform="translate(24, 28)">
    <text x="0" y="0" fill="#f8fafc" font-family="sans-serif" font-size="16" font-weight="bold">${escapeXml(project.code)} — ${escapeXml(project.name)}</text>
    <text x="0" y="20" fill="#94a3b8" font-family="monospace" font-size="12">Cliente: ${escapeXml(project.client)} | Unidad: ${escapeXml(project.mining_unit)} | Fase: ${escapeXml(project.phase)} | ${escapeXml(flowsheet.version)}</text>
  </g>
  <g transform="translate(0, 50)">
    ${edgesSvg}
    ${nodesSvg}
  </g>
</svg>`;

  const blob = new Blob([svgDoc], { type: 'image/svg+xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${project.code}_Diagrama_PFD.svg`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Descarga el JSON completo del Modelo de Datos Relacional/NoSQL del proyecto activo
 */
export function exportProjectModelToJson(project: Project, flowsheet: Flowsheet): void {
  const payload = {
    schema_version: '2026.1-MINFLOW-PFD',
    exported_at: new Date().toISOString(),
    project,
    flowsheet,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${project.code}_DataModel.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import {
  EquipmentSubType,
  Flowsheet,
  NodeBalanceDiagnostics,
  Project,
} from '../types/process';

/**
 * Normaliza cadenas para jsPDF (fuente estándar Helvetica WinAnsi) evitando que guiones largos
 * o caracteres fuera de Latin-1 rompan el renderizado o corten palabras.
 */
function sanitizePdfText(str: string): string {
  return (str || '')
    .replace(/—|–/g, '-')
    .replace(/·/g, '|')
    .replace(/µ/g, 'u')
    .replace(/³/g, '3')
    .replace(/±/g, '+/-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

/**
 * Dibuja la silueta técnica PFD/CAD de cada equipo dentro del plano PDF usando primitivas vectoriales
 */
function drawPdfEquipmentSymbol(
  doc: jsPDF,
  type: EquipmentSubType,
  cx: number,
  cy: number,
  w: number,
  h: number
): void {
  const rx = w / 2;
  const ry = h / 2;

  switch (type) {
    case 'mill_sag':
    case 'mill_ball': {
      // Chute de alimentación inclinado (izquierda)
      doc.setFillColor(234, 179, 8);
      doc.setDrawColor(113, 63, 18);
      doc.setLineWidth(0.3);
      doc.triangle(cx - rx * 0.9, cy - ry * 0.6, cx - rx * 0.5, cy - ry * 0.6, cx - rx * 0.45, cy + ry * 0.1, 'FD');
      // Tambor cilíndrico rotatorio principal (Amarillo ocre grande)
      doc.setFillColor(234, 179, 8);
      doc.rect(cx - rx * 0.45, cy - ry * 0.55, rx * 1.15, ry * 1.1, 'FD');
      // Pernos / Liners del molino
      doc.setDrawColor(133, 77, 14);
      doc.line(cx - rx * 0.1, cy - ry * 0.55, cx - rx * 0.1, cy + ry * 0.55);
      doc.line(cx + rx * 0.3, cy - ry * 0.55, cx + rx * 0.3, cy + ry * 0.55);
      // Trommel de descarga derecha
      doc.rect(cx + rx * 0.7, cy - ry * 0.25, rx * 0.22, ry * 0.5, 'FD');
      // Motor azul inferior izquierdo
      doc.setFillColor(29, 78, 216);
      doc.rect(cx - rx * 0.6, cy + ry * 0.3, rx * 0.45, ry * 0.35, 'FD');
      // Base / Skid amarillo inferior
      doc.setFillColor(202, 138, 4);
      doc.rect(cx - rx * 0.65, cy + ry * 0.65, rx * 1.45, ry * 0.18, 'FD');
      break;
    }
    case 'crusher_jaw':
    case 'crusher_cone': {
      // Tolva superior amarilla + cuerpo cónico/mandíbula + motor azul
      doc.setFillColor(234, 179, 8);
      doc.setDrawColor(113, 63, 18);
      doc.setLineWidth(0.3);
      doc.rect(cx - rx * 0.55, cy - ry * 0.7, rx * 1.1, ry * 0.28, 'FD');
      doc.setFillColor(202, 138, 4);
      doc.rect(cx - rx * 0.5, cy - ry * 0.42, rx * 1.0, ry * 0.95, 'FD');
      doc.setFillColor(51, 65, 85);
      doc.triangle(cx, cy - ry * 0.35, cx - rx * 0.32, cy + ry * 0.4, cx + rx * 0.32, cy + ry * 0.4, 'FD');
      doc.setFillColor(29, 78, 216);
      doc.rect(cx + rx * 0.52, cy + ry * 0.1, rx * 0.35, ry * 0.38, 'FD');
      break;
    }
    case 'mill_hpgr': {
      doc.setFillColor(202, 138, 4);
      doc.setDrawColor(113, 63, 18);
      doc.setLineWidth(0.3);
      doc.rect(cx - rx * 0.65, cy - ry * 0.5, rx * 1.3, ry * 1.05, 'FD');
      doc.setFillColor(51, 65, 85);
      doc.circle(cx - rx * 0.25, cy, ry * 0.38, 'FD');
      doc.circle(cx + rx * 0.25, cy, ry * 0.38, 'FD');
      break;
    }
    case 'hydrocyclone': {
      // Cabezal amarillo + cono clasificador + tubería overflow azul
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.5);
      doc.line(cx, cy - ry * 0.55, cx, cy - ry * 0.82);
      doc.line(cx, cy - ry * 0.82, cx + rx * 0.65, cy - ry * 0.82);
      doc.setFillColor(234, 179, 8);
      doc.setDrawColor(113, 63, 18);
      doc.setLineWidth(0.3);
      doc.rect(cx - rx * 0.32, cy - ry * 0.55, rx * 0.64, ry * 0.42, 'FD');
      doc.setFillColor(202, 138, 4);
      doc.triangle(cx - rx * 0.32, cy - ry * 0.13, cx + rx * 0.32, cy - ry * 0.13, cx, cy + ry * 0.78, 'FD');
      break;
    }
    case 'flotation_rougher':
    case 'flotation_scavenger':
    case 'flotation_cleaner':
    case 'leach_tank': {
      // Puente amarillo + motores azules + celdas con espuma verde
      doc.setFillColor(234, 179, 8);
      doc.setDrawColor(113, 63, 18);
      doc.setLineWidth(0.25);
      doc.rect(cx - rx * 0.75, cy - ry * 0.68, rx * 1.5, ry * 0.16, 'FD');
      doc.setFillColor(29, 78, 216);
      doc.rect(cx - rx * 0.55, cy - ry * 0.85, rx * 0.22, ry * 0.18, 'FD');
      doc.rect(cx - rx * 0.11, cy - ry * 0.85, rx * 0.22, ry * 0.18, 'FD');
      doc.rect(cx + rx * 0.33, cy - ry * 0.85, rx * 0.22, ry * 0.18, 'FD');
      doc.setFillColor(30, 41, 59);
      doc.setDrawColor(71, 85, 105);
      doc.rect(cx - rx * 0.7, cy - ry * 0.42, rx * 1.4, ry * 1.05, 'FD');
      doc.setFillColor(16, 185, 129);
      doc.rect(cx - rx * 0.68, cy - ry * 0.32, rx * 1.36, ry * 0.18, 'F');
      break;
    }
    case 'thickener': {
      doc.setFillColor(234, 179, 8);
      doc.setDrawColor(113, 63, 18);
      doc.setLineWidth(0.25);
      doc.rect(cx - rx * 0.85, cy - ry * 0.65, rx * 1.7, ry * 0.16, 'FD');
      doc.setFillColor(30, 41, 59);
      doc.setDrawColor(2, 132, 199);
      doc.rect(cx - rx * 0.8, cy - ry * 0.45, rx * 1.6, ry * 0.5, 'FD');
      doc.triangle(cx - rx * 0.8, cy + ry * 0.05, cx + rx * 0.8, cy + ry * 0.05, cx, cy + ry * 0.72, 'FD');
      break;
    }
    case 'slurry_pump': {
      doc.setFillColor(29, 78, 216);
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.25);
      doc.rect(cx - rx * 0.7, cy - ry * 0.1, rx * 0.55, ry * 0.65, 'FD');
      doc.setFillColor(234, 179, 8);
      doc.setDrawColor(113, 63, 18);
      doc.circle(cx + rx * 0.25, cy + ry * 0.15, ry * 0.48, 'FD');
      doc.rect(cx + rx * 0.15, cy - ry * 0.65, rx * 0.22, ry * 0.55, 'FD');
      break;
    }
    case 'feed_source': {
      doc.setFillColor(234, 179, 8);
      doc.setDrawColor(113, 63, 18);
      doc.setLineWidth(0.3);
      doc.triangle(cx - rx * 0.7, cy - ry * 0.55, cx + rx * 0.7, cy - ry * 0.55, cx, cy + ry * 0.45, 'FD');
      doc.setFillColor(29, 78, 216);
      doc.rect(cx - rx * 0.5, cy + ry * 0.4, rx * 1.0, ry * 0.25, 'FD');
      break;
    }
    case 'product_sink': {
      doc.setFillColor(16, 185, 129);
      doc.setDrawColor(5, 150, 105);
      doc.setLineWidth(0.3);
      doc.triangle(cx - rx * 0.75, cy + ry * 0.65, cx + rx * 0.75, cy + ry * 0.65, cx, cy - ry * 0.55, 'FD');
      break;
    }
    default: {
      doc.setFillColor(234, 179, 8);
      doc.setDrawColor(113, 63, 18);
      doc.setLineWidth(0.3);
      doc.rect(cx - rx * 0.65, cy - ry * 0.48, rx * 1.3, ry * 0.96, 'FD');
      doc.setFillColor(29, 78, 216);
      doc.rect(cx - rx * 0.82, cy - ry * 0.18, rx * 0.2, ry * 0.36, 'FD');
      break;
    }
  }
}

/**
 * 1. EXPORTACIÓN DE PLANILLA PROFESIONAL PARA EXCEL (.XLS con formato corporativo TAGING)
 */
export function exportProfessionalExcelSheet(
  project: Project,
  flowsheet: Flowsheet,
  diagnostics: NodeBalanceDiagnostics[]
): void {
  const nodeMap = new Map(flowsheet.nodes.map((n) => [n.id, `${n.tag} (${n.name})`]));
  const exportDate = new Date().toISOString().slice(0, 10);

  const streamRowsHtml = flowsheet.edges
    .map((edge, idx) => {
      const d = edge.flow_data;
      const cuFine = (d.solids_tph * d.assay.cu_pct) / 100;
      const bgRow = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      const typeLabel =
        edge.stream_type === 'ore'
          ? 'MINERAL ROM'
          : edge.stream_type === 'slurry'
          ? 'PULPA'
          : edge.stream_type === 'water'
          ? 'AGUA / SOL.'
          : edge.stream_type === 'concentrate'
          ? 'CONCENTRADO'
          : 'RELAVE';

      return `
        <tr style="background-color: ${bgRow};">
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; font-family: Consolas, monospace; font-weight: bold; color: #0369A1; text-align: center;">${escapeHtml(edge.id)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 10px; font-weight: 600; color: #0F172A;">${escapeHtml(edge.name)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: center; font-size: 11px; color: #334155;">${typeLabel}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; color: #334155;">${escapeHtml(nodeMap.get(edge.source_node_id) ?? edge.source_node_id)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; color: #334155;">${escapeHtml(nodeMap.get(edge.target_node_id) ?? edge.target_node_id)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; font-weight: bold; color: #0F172A; mso-number-format:'\\#\\,\\#\\#0\\.00';">${d.solids_tph.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; color: #0284C7; mso-number-format:'\\#\\,\\#\\#0\\.00';">${d.water_m3h.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; font-weight: bold; color: #0F172A; mso-number-format:'\\#\\,\\#\\#0\\.00';">${d.pulp_mass_tph.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; color: #334155; mso-number-format:'\\#\\,\\#\\#0\\.00';">${d.pulp_vol_m3h.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; font-weight: bold; color: #0369A1; background-color: #F0F9FF; mso-number-format:'0\\.00';">${d.percent_solids.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; color: #475569; mso-number-format:'0\\.00';">${d.solid_sg.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; font-weight: bold; color: #0F172A; mso-number-format:'0\\.000';">${d.pulp_density.toFixed(3)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; color: #B45309; mso-number-format:'0\\.000';">${d.assay.cu_pct.toFixed(3)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; color: #475569; mso-number-format:'0\\.00';">${d.assay.au_gpt.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; color: #047857; mso-number-format:'0\\.000';">${d.assay.li_pct.toFixed(3)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; color: #475569; mso-number-format:'0\\.00';">${d.assay.fe_pct.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; font-weight: bold; color: #0F172A; mso-number-format:'0\\.000';">${cuFine.toFixed(3)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; color: #475569; mso-number-format:'0\\.0';">${d.reagent_dosage_gpt.toFixed(1)}</td>
        </tr>
      `;
    })
    .join('');

  const nodeClosureHtml = diagnostics
    .filter((n) => !n.isBoundary)
    .map((n, idx) => {
      const bgRow = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      const statusBg = n.isBalanced ? '#DCFCE7' : '#FEE2E2';
      const statusColor = n.isBalanced ? '#166534' : '#991B1B';
      const statusText = n.isBalanced ? 'CERRADO OK (NOMINAL)' : 'DESBALANCEADO (REVISAR)';

      return `
        <tr style="background-color: ${bgRow};">
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; font-family: Consolas, monospace; font-weight: bold; color: #0369A1;">${escapeHtml(n.nodeTag)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 10px; font-weight: 600; color: #0F172A;" colspan="2">${escapeHtml(n.nodeName)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00';">${n.solidsIn_tph.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00';">${n.solidsOut_tph.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; mso-number-format:'0\\.00';">${n.solidsDelta_tph.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; mso-number-format:'0\\.00';">${n.solidsError_pct.toFixed(2)}%</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; color: #0284C7; mso-number-format:'\\#\\,\\#\\#0\\.00';">${n.waterIn_m3h.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; color: #0284C7; mso-number-format:'\\#\\,\\#\\#0\\.00';">${n.waterOut_m3h.toFixed(2)}</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 8px; text-align: right; mso-number-format:'0\\.00';">${n.waterError_pct.toFixed(2)}%</td>
          <td style="border: 1px solid #CBD5E1; padding: 6px 10px; text-align: center; font-weight: bold; background-color: ${statusBg}; color: ${statusColor};" colspan="2">${statusText}</td>
        </tr>
      `;
    })
    .join('');

  const annotationRowsHtml = (flowsheet.annotations ?? [])
    .map(
      (a) => `
      <tr>
        <td style="border: 1px solid #CBD5E1; padding: 6px 8px; font-weight: bold; color: #0369A1;" colspan="2">${escapeHtml(a.title)}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px; color: #334155;" colspan="6">${escapeHtml(a.details)}</td>
      </tr>
    `
    )
    .join('');

  const excelDocument = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Balance de Masa TAGING</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #0F172A; }
          table { border-collapse: collapse; width: 100%; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="4" style="background-color: #06152D; color: #FFFFFF; padding: 14px 16px; font-size: 20px; font-weight: 800; letter-spacing: 2px; border: 1px solid #06152D;">
              &#9698; TAGING — INGENIERÍA INTELIGENTE
            </td>
            <td colspan="10" style="background-color: #06152D; color: #38BDF8; padding: 14px 16px; font-size: 15px; font-weight: 700; text-align: left; border: 1px solid #06152D;">
              PLANILLA OFICIAL DE BALANCE DE MASA METALÚRGICO Y FLUJOS DE PROCESO (PFD)
            </td>
            <td colspan="4" style="background-color: #06152D; color: #E2E8F0; padding: 14px 16px; font-size: 11px; text-align: right; border: 1px solid #06152D;">
              FECHA EMISIÓN: ${exportDate}
            </td>
          </tr>

          <tr>
            <td colspan="2" style="background-color: #E2E8F0; font-weight: bold; padding: 6px 10px; border: 1px solid #CBD5E1;">CÓDIGO PROYECTO:</td>
            <td colspan="4" style="background-color: #F8FAFC; font-weight: bold; color: #0369A1; padding: 6px 10px; border: 1px solid #CBD5E1;">${escapeHtml(project.code)}</td>
            <td colspan="2" style="background-color: #E2E8F0; font-weight: bold; padding: 6px 10px; border: 1px solid #CBD5E1;">CLIENTE MINERO:</td>
            <td colspan="4" style="background-color: #F8FAFC; font-weight: 600; padding: 6px 10px; border: 1px solid #CBD5E1;">${escapeHtml(project.client)}</td>
            <td colspan="2" style="background-color: #E2E8F0; font-weight: bold; padding: 6px 10px; border: 1px solid #CBD5E1;">FASE DE ESTUDIO:</td>
            <td colspan="4" style="background-color: #F8FAFC; padding: 6px 10px; border: 1px solid #CBD5E1;">${escapeHtml(project.phase)}</td>
          </tr>
          <tr>
            <td colspan="2" style="background-color: #E2E8F0; font-weight: bold; padding: 6px 10px; border: 1px solid #CBD5E1;">NOMBRE PROYECTO:</td>
            <td colspan="4" style="background-color: #F8FAFC; padding: 6px 10px; border: 1px solid #CBD5E1;">${escapeHtml(project.name)}</td>
            <td colspan="2" style="background-color: #E2E8F0; font-weight: bold; padding: 6px 10px; border: 1px solid #CBD5E1;">UNIDAD / PLANTA:</td>
            <td colspan="4" style="background-color: #F8FAFC; padding: 6px 10px; border: 1px solid #CBD5E1;">${escapeHtml(project.mining_unit)}</td>
            <td colspan="2" style="background-color: #E2E8F0; font-weight: bold; padding: 6px 10px; border: 1px solid #CBD5E1;">ING. RESPONSABLE:</td>
            <td colspan="4" style="background-color: #F8FAFC; padding: 6px 10px; border: 1px solid #CBD5E1;">${escapeHtml(project.lead_engineer)}</td>
          </tr>
          <tr>
            <td colspan="2" style="background-color: #E2E8F0; font-weight: bold; padding: 6px 10px; border: 1px solid #CBD5E1;">VERSIÓN FLOWSHEET:</td>
            <td colspan="4" style="background-color: #F8FAFC; padding: 6px 10px; border: 1px solid #CBD5E1;">${escapeHtml(flowsheet.version)}</td>
            <td colspan="2" style="background-color: #E2E8F0; font-weight: bold; padding: 6px 10px; border: 1px solid #CBD5E1;">TOLERANCIA CIERRE:</td>
            <td colspan="4" style="background-color: #F8FAFC; padding: 6px 10px; border: 1px solid #CBD5E1;">&plusmn; ${flowsheet.tolerance_pct}% (Conservación de Masa)</td>
            <td colspan="2" style="background-color: #E2E8F0; font-weight: bold; padding: 6px 10px; border: 1px solid #CBD5E1;">PROPIEDAD INTELECTUAL:</td>
            <td colspan="4" style="background-color: #F8FAFC; font-weight: bold; color: #06152D; padding: 6px 10px; border: 1px solid #CBD5E1;">TAGING — INGENIERÍA INTELIGENTE</td>
          </tr>

          <tr><td colspan="18" style="height: 14px;"></td></tr>

          <tr>
            <td colspan="18" style="background-color: #0F172A; color: #FFFFFF; font-weight: bold; font-size: 13px; padding: 8px 12px; border: 1px solid #0F172A;">
              1. TABLA RESUMEN DE BALANCE DE MASA POR CORRIENTE (STREAMS)
            </td>
          </tr>
          <tr style="background-color: #0284C7; color: #FFFFFF; font-weight: bold; text-align: center;">
            <th style="border: 1px solid #0369A1; padding: 8px;">ID Corriente</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Descripción de la Corriente</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Tipo Flujo</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Equipo Origen</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Equipo Destino</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Sólidos Secos (t/h)</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Agua / Solución (m³/h)</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Pulpa Total (t/h)</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Caudal Pulpa (m³/h)</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">% Sólidos (%Cp)</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">GE Mineral (t/m³)</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Dens. Pulpa (t/m³)</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Ley Cu (%)</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Ley Au (g/t)</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Ley Li (%)</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Ley Fe (%)</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Cu Fino (t/h)</th>
            <th style="border: 1px solid #0369A1; padding: 8px;">Reactivos (g/t)</th>
          </tr>
          ${streamRowsHtml}

          <tr><td colspan="18" style="height: 16px;"></td></tr>

          <tr>
            <td colspan="12" style="background-color: #0F172A; color: #FFFFFF; font-weight: bold; font-size: 13px; padding: 8px 12px; border: 1px solid #0F172A;">
              2. VERIFICACIÓN DE CIERRE DE BALANCE POR EQUIPO / NODO (&Sigma; ENTRADAS = &Sigma; SALIDAS)
            </td>
          </tr>
          <tr style="background-color: #1E293B; color: #FFFFFF; font-weight: bold; text-align: center;">
            <th style="border: 1px solid #334155; padding: 7px;">Tag Equipo</th>
            <th style="border: 1px solid #334155; padding: 7px;" colspan="2">Nombre del Equipo</th>
            <th style="border: 1px solid #334155; padding: 7px;">&Sigma; Sólidos Ent. (t/h)</th>
            <th style="border: 1px solid #334155; padding: 7px;">&Sigma; Sólidos Sal. (t/h)</th>
            <th style="border: 1px solid #334155; padding: 7px;">&Delta; Sólidos (t/h)</th>
            <th style="border: 1px solid #334155; padding: 7px;">Error Sólidos (%)</th>
            <th style="border: 1px solid #334155; padding: 7px;">&Sigma; Agua Ent. (m³/h)</th>
            <th style="border: 1px solid #334155; padding: 7px;">&Sigma; Agua Sal. (m³/h)</th>
            <th style="border: 1px solid #334155; padding: 7px;">Error Agua (%)</th>
            <th style="border: 1px solid #334155; padding: 7px;" colspan="2">Diagnóstico Cierre</th>
          </tr>
          ${nodeClosureHtml}

          ${
            annotationRowsHtml
              ? `
          <tr><td colspan="12" style="height: 16px;"></td></tr>
          <tr>
            <td colspan="8" style="background-color: #0F172A; color: #FFFFFF; font-weight: bold; font-size: 13px; padding: 8px 12px; border: 1px solid #0F172A;">
              3. ZONAS OPERATIVAS Y ANOTACIONES DEL LIENZO PFD
            </td>
          </tr>
          ${annotationRowsHtml}
          `
              : ''
          }
        </table>
      </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + excelDocument], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `TAGING_${project.code}_Balance_Masa_Profesional.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const exportMassBalanceToCsv = exportProfessionalExcelSheet;

/**
 * 2. EXPORTACIÓN DIRECTA DE PLANO DE INGENIERÍA EN PDF IMPRIMIBLE (A4 Landscape)
 * CON SILUETAS TÉCNICAS DE CADA EQUIPO, NOMBRES COMPLETOS SIN TEXTO CORTADO Y SELLO TAGING.
 */
export function exportFlowsheetToPrintablePdf(
  project: Project,
  flowsheet: Flowsheet,
  diagnostics: NodeBalanceDiagnostics[]
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = 297;
  const pageH = 210;
  const exportDate = new Date().toISOString().slice(0, 10);

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.rect(6, 6, pageW - 12, pageH - 12);
  doc.setLineWidth(0.2);
  doc.rect(7.5, 7.5, pageW - 15, pageH - 15);

  // CABECERA CORPORATIVA CON EL SELLO / LOGO DE TAGING
  doc.setFillColor(6, 21, 45);
  doc.rect(7.5, 7.5, pageW - 15, 22, 'F');

  doc.setFillColor(0, 154, 222);
  doc.triangle(31, 14.5, 46, 9.2, 46, 14.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('TAGING', 13, 21.2);

  doc.setFontSize(5.8);
  doc.setTextColor(186, 230, 253);
  doc.text('INGENIERIA INTELIGENTE', 13.2, 25.2);

  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.4);
  doc.line(58, 10, 58, 27);

  doc.setTextColor(56, 189, 248);
  doc.setFontSize(8);
  doc.text(
    sanitizePdfText(`DIAGRAMA DE FLUJO DE PROCESOS (PFD) & BALANCE DE MASA - ${project.code}`),
    63,
    14
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10.5);
  doc.text(sanitizePdfText(project.name).slice(0, 82), 63, 19.8);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(
    sanitizePdfText(
      `Cliente: ${project.client}  |  Unidad: ${project.mining_unit}  |  Fase: ${project.phase}  |  Ing.: ${project.lead_engineer}`
    ).slice(0, 118),
    63,
    25.2
  );

  // Sello de Revisión y Fecha a la derecha
  doc.setFillColor(15, 23, 42);
  doc.rect(236, 9.5, 51, 18, 'F');
  doc.setTextColor(56, 189, 248);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('SELLO DE INGENIERIA', 239, 14);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.8);
  doc.text(sanitizePdfText(`Rev: ${flowsheet.version}`).slice(0, 28), 239, 19);
  doc.text(`Fecha: ${exportDate}`, 239, 23.8);

  const canvasTop = 32;
  const canvasHeight = 104;
  const canvasLeft = 10;
  const canvasWidth = pageW - 20;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(canvasLeft, canvasTop, canvasWidth, canvasHeight, 'FD');

  const allX: number[] = [0, 1420];
  const allY: number[] = [0, 420];
  flowsheet.nodes.forEach((n) => {
    allX.push(n.position_x, n.position_x + 215);
    allY.push(n.position_y, n.position_y + 100);
  });
  (flowsheet.annotations ?? []).forEach((a) => {
    allX.push(a.position_x, a.position_x + a.width);
    allY.push(a.position_y, a.position_y + a.height);
  });

  const minX = Math.max(0, Math.min(...allX) - 20);
  const maxX = Math.max(...allX) + 30;
  const minY = Math.max(0, Math.min(...allY) - 20);
  const maxY = Math.max(...allY) + 30;

  const scaleX = (canvasWidth - 12) / Math.max(600, maxX - minX);
  const scaleY = (canvasHeight - 10) / Math.max(280, maxY - minY);
  const scale = Math.min(scaleX, scaleY);

  const tx = (x: number) => canvasLeft + 6 + (x - minX) * scale;
  const ty = (y: number) => canvasTop + 5 + (y - minY) * scale;

  // 1) Dibujar Zonas Manuales / Cuadros de Usuario
  (flowsheet.annotations ?? []).forEach((ann) => {
    const ax = tx(ann.position_x);
    const ay = ty(ann.position_y);
    const aw = ann.width * scale;
    const ah = ann.height * scale;

    if (ann.color_theme === 'amber') {
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(217, 119, 6);
    } else if (ann.color_theme === 'emerald') {
      doc.setFillColor(209, 250, 229);
      doc.setDrawColor(5, 150, 105);
    } else if (ann.color_theme === 'rose') {
      doc.setFillColor(255, 228, 230);
      doc.setDrawColor(225, 29, 72);
    } else {
      doc.setFillColor(224, 242, 254);
      doc.setDrawColor(2, 132, 199);
    }

    doc.setLineWidth(0.35);
    doc.setLineDashPattern([1.8, 1.2], 0);
    doc.roundedRect(ax, ay, aw, ah, 1.5, 1.5, 'FD');
    doc.setLineDashPattern([], 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(ann.title).slice(0, 70), ax + 2, ay + 4.2);

    if (ann.details) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.2);
      doc.setTextColor(51, 65, 85);
      const splitDetails = doc.splitTextToSize(sanitizePdfText(ann.details), Math.max(20, aw - 4));
      doc.text(splitDetails.slice(0, 3), ax + 2, ay + 7.8);
    }
  });

  // 2) Dibujar Conectores / Corrientes Ortogonales
  const nodeMap = new Map(flowsheet.nodes.map((n) => [n.id, n]));
  flowsheet.edges.forEach((edge, idx) => {
    const src = nodeMap.get(edge.source_node_id);
    const tgt = nodeMap.get(edge.target_node_id);
    if (!src || !tgt) return;

    const x1 = tx(src.position_x + 204);
    const y1 = ty(src.position_y + 46);
    const x2 = tx(tgt.position_x);
    const y2 = ty(tgt.position_y + 46);
    const midX = (x1 + x2) / 2 + ((idx % 3) - 1) * 1.5;

    if (edge.stream_type === 'water') {
      doc.setDrawColor(2, 132, 199);
    } else if (edge.stream_type === 'concentrate') {
      doc.setDrawColor(5, 150, 105);
    } else if (edge.stream_type === 'tailings') {
      doc.setDrawColor(217, 119, 6);
    } else {
      doc.setDrawColor(71, 85, 105);
    }

    doc.setLineWidth(0.45);
    doc.line(x1, y1, midX, y1);
    doc.line(midX, y1, midX, y2);
    doc.line(midX, y2, x2, y2);

    doc.triangle(x2, y2, x2 - 2.2, y2 - 1.1, x2 - 2.2, y2 + 1.1, 'F');

    const tagW = 20;
    const tagH = 6.5;
    const midY = (y1 + y2) / 2;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.2);
    doc.roundedRect(midX - tagW / 2, midY - tagH / 2, tagW, tagH, 0.8, 0.8, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(3, 105, 161);
    doc.text(edge.id, midX, midY - 0.6, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.6);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `${edge.flow_data.solids_tph.toFixed(0)}t/h | ${edge.flow_data.percent_solids.toFixed(0)}%`,
      midX,
      midY + 2.1,
      { align: 'center' }
    );
  });

  // 3) Dibujar Equipos como Gráficos de Cuerpo Completo (Sin cuadrado envolvente + Cuadrito arriba + Nombre abajo)
  const diagMap = new Map(diagnostics.map((d) => [d.nodeId, d]));
  flowsheet.nodes.forEach((node) => {
    const nx = tx(node.position_x);
    const ny = ty(node.position_y);
    const nw = Math.max(28, 184 * scale);
    const nh = Math.max(16, 108 * scale);

    const diag = diagMap.get(node.id);

    // 3a) Cuadrito superior de información del equipo (Tag + Estado Cierre)
    const topBoxH = 4.2;
    doc.setFillColor(15, 23, 42);
    if (diag && !diag.isBoundary && !diag.isBalanced) {
      doc.setDrawColor(225, 29, 72);
    } else {
      doc.setDrawColor(2, 132, 199);
    }
    doc.setLineWidth(0.3);
    doc.roundedRect(nx + nw * 0.1, ny, nw * 0.8, topBoxH, 0.8, 0.8, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(56, 189, 248);
    const statusBadge =
      diag && !diag.isBoundary ? (diag.isBalanced ? ' [OK]' : ' [REV]') : '';
    doc.text(
      sanitizePdfText(`${node.tag}${statusBadge}`),
      nx + nw / 2,
      ny + 2.9,
      { align: 'center' }
    );

    // 3b) Figura principal grande del equipo (Sin caja contenedora)
    drawPdfEquipmentSymbol(
      doc,
      node.type,
      nx + nw / 2,
      ny + topBoxH + (nh - topBoxH - 4) * 0.52,
      nw * 0.88,
      (nh - topBoxH - 4) * 0.92
    );

    // 3c) Etiqueta inferior con el Nombre Completo del Equipo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.4);
    doc.setTextColor(15, 23, 42);
    const wrappedName = doc.splitTextToSize(sanitizePdfText(node.name), nw + 6);
    doc.text(wrappedName.slice(0, 2), nx + nw / 2, ny + nh - 1.2, { align: 'center' });
  });

  // TABLA RESUMEN DE BALANCE DE MASA IMPRIMIBLE
  const tableTop = 140;
  doc.setFillColor(6, 21, 45);
  doc.rect(10, tableTop, pageW - 20, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    'TABLA RESUMEN DE BALANCE DE MASA POR CORRIENTE (STREAMS) - DOCUMENTO PRESENTACION CLIENTE',
    13,
    tableTop + 4.1
  );

  const cols = [
    { label: 'ID', x: 11, w: 16 },
    { label: 'Nombre de Corriente', x: 27, w: 62 },
    { label: 'Origen -> Destino', x: 89, w: 34 },
    { label: 'Solidos (t/h)', x: 123, w: 22 },
    { label: 'Agua (m3/h)', x: 145, w: 22 },
    { label: 'Pulpa (t/h)', x: 167, w: 22 },
    { label: 'Caudal (m3/h)', x: 189, w: 22 },
    { label: '% Sol (%Cp)', x: 211, w: 20 },
    { label: 'Dens. (t/m3)', x: 231, w: 20 },
    { label: 'Ley Cu (%)', x: 251, w: 18 },
    { label: 'Cu Fino (t/h)', x: 269, w: 18 },
  ];

  const headerY = tableTop + 6;
  doc.setFillColor(226, 232, 240);
  doc.rect(10, headerY, pageW - 20, 5.5, 'F');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  cols.forEach((c) => {
    doc.text(c.label, c.x + 1, headerY + 3.8);
  });

  const maxRows = Math.min(flowsheet.edges.length, 8);
  for (let i = 0; i < maxRows; i++) {
    const edge = flowsheet.edges[i];
    const d = edge.flow_data;
    const rowY = headerY + 5.5 + i * 5.2;
    const srcTag = nodeMap.get(edge.source_node_id)?.tag ?? '?';
    const tgtTag = nodeMap.get(edge.target_node_id)?.tag ?? '?';
    const cuFine = (d.solids_tph * d.assay.cu_pct) / 100;

    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(10, rowY, pageW - 20, 5.2, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(10, rowY + 5.2, pageW - 10, rowY + 5.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(3, 105, 161);
    doc.text(edge.id, cols[0].x + 1, rowY + 3.6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(edge.name).slice(0, 40), cols[1].x + 1, rowY + 3.6);
    doc.text(`${srcTag} -> ${tgtTag}`, cols[2].x + 1, rowY + 3.6);
    doc.text(d.solids_tph.toFixed(2), cols[3].x + 1, rowY + 3.6);
    doc.text(d.water_m3h.toFixed(2), cols[4].x + 1, rowY + 3.6);
    doc.text(d.pulp_mass_tph.toFixed(2), cols[5].x + 1, rowY + 3.6);
    doc.text(d.pulp_vol_m3h.toFixed(2), cols[6].x + 1, rowY + 3.6);

    doc.setFont('helvetica', 'bold');
    doc.text(`${d.percent_solids.toFixed(2)}%`, cols[7].x + 1, rowY + 3.6);
    doc.text(d.pulp_density.toFixed(3), cols[8].x + 1, rowY + 3.6);

    doc.setFont('helvetica', 'normal');
    doc.text(d.assay.cu_pct.toFixed(3), cols[9].x + 1, rowY + 3.6);
    doc.text(cuFine.toFixed(3), cols[10].x + 1, rowY + 3.6);
  }

  // PIE DE PÁGINA OFICIAL CON SELLO TAGING
  doc.setFillColor(241, 245, 249);
  doc.rect(7.5, pageH - 13.5, pageW - 15, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(6, 21, 45);
  doc.text(
    'PROPIEDAD DE TAGING - INGENIERIA INTELIGENTE  |  DOCUMENTO TECNICO DE PROCESOS MINEROS',
    11,
    pageH - 9.5
  );
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Tolerancia de Cierre: +/-${flowsheet.tolerance_pct}%  |  Plano generado digitalmente listo para impresion`,
    pageW - 11,
    pageH - 9.5,
    { align: 'right' }
  );

  doc.save(`TAGING_${project.code}_Plano_PFD_y_Balance.pdf`);
}

/**
 * 3. EXPORTACIÓN VECTORIAL SVG CON SELLO TAGING Y ZONAS MANUALES
 */
export function exportFlowsheetToSvg(project: Project, flowsheet: Flowsheet): void {
  const width = 1520;
  const height = 680;

  const nodeMap = new Map(flowsheet.nodes.map((n) => [n.id, n]));

  const annotationsSvg = (flowsheet.annotations ?? [])
    .map((ann) => {
      const stroke =
        ann.color_theme === 'amber'
          ? '#f59e0b'
          : ann.color_theme === 'emerald'
          ? '#10b981'
          : ann.color_theme === 'rose'
          ? '#f43f5e'
          : '#009ade';
      return `
        <g transform="translate(${ann.position_x}, ${ann.position_y})">
          <rect width="${ann.width}" height="${ann.height}" rx="8" fill="rgba(15, 23, 42, 0.38)" stroke="${stroke}" stroke-width="2" stroke-dasharray="8 5" />
          <text x="12" y="22" fill="${stroke}" font-family="sans-serif" font-size="12" font-weight="bold">${escapeHtml(ann.title)}</text>
          <text x="12" y="40" fill="#cbd5e1" font-family="sans-serif" font-size="10">${escapeHtml(ann.details.slice(0, 90))}</text>
        </g>
      `;
    })
    .join('\n');

  const edgesSvg = flowsheet.edges
    .map((edge) => {
      const src = nodeMap.get(edge.source_node_id);
      const tgt = nodeMap.get(edge.target_node_id);
      if (!src || !tgt) return '';

      const x1 = src.position_x + 204;
      const y1 = src.position_y + 46;
      const x2 = tgt.position_x;
      const y2 = tgt.position_y + 46;
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
          <!-- Cuadrito superior de Tag -->
          <rect x="24" y="0" width="136" height="20" rx="4" fill="#0f172a" stroke="#06b6d4" stroke-width="1.2" />
          <text x="92" y="14" fill="#22d3ee" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">${node.tag}</text>

          <!-- Cuerpo Industrial del Equipo (Sin caja envolvente) -->
          <polygon points="18,36 44,36 52,58 34,58" fill="#eab308" stroke="#713f12" stroke-width="1.5" />
          <rect x="52" y="30" width="84" height="54" rx="3" fill="#eab308" stroke="#713f12" stroke-width="1.6" />
          <rect x="136" y="44" width="18" height="26" fill="#ca8a04" stroke="#713f12" stroke-width="1.4" />
          <rect x="42" y="72" width="32" height="16" rx="2" fill="#1d4ed8" stroke="#0f172a" stroke-width="1.2" />
          <rect x="34" y="88" width="118" height="8" fill="#a16207" stroke="#713f12" stroke-width="1.2" />

          <!-- Etiqueta inferior con Nombre Completo -->
          <rect x="10" y="100" width="164" height="20" rx="3" fill="#020617" stroke="#1e293b" stroke-width="1" />
          <text x="92" y="114" fill="#f8fafc" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">${escapeHtml(node.name)}</text>
        </g>
      `;
    })
    .join('\n');

  const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#020617" />
  <rect x="0" y="0" width="${width}" height="68" fill="#06152d" />
  <polygon points="88,26 142,6 142,26" fill="#009ade" />
  <text x="24" y="48" fill="#ffffff" font-family="sans-serif" font-size="28" font-weight="800" letter-spacing="2">TAGING</text>
  <text x="26" y="61" fill="#93c5fd" font-family="sans-serif" font-size="9" font-weight="600" letter-spacing="2.5">INGENIERIA INTELIGENTE</text>
  <text x="210" y="30" fill="#f8fafc" font-family="sans-serif" font-size="16" font-weight="bold">${escapeHtml(project.code)} — ${escapeHtml(project.name)}</text>
  <text x="210" y="50" fill="#94a3b8" font-family="monospace" font-size="12">Cliente: ${escapeHtml(project.client)} | Unidad: ${escapeHtml(project.mining_unit)} | Fase: ${escapeHtml(project.phase)} | ${escapeHtml(flowsheet.version)}</text>
  <g transform="translate(0, 78)">
    ${annotationsSvg}
    ${edgesSvg}
    ${nodesSvg}
  </g>
</svg>`;

  const blob = new Blob([svgDoc], { type: 'image/svg+xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `TAGING_${project.code}_Diagrama_PFD.svg`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 4. Descarga el JSON completo del Modelo de Datos Relacional/NoSQL del proyecto activo
 */
export function exportProjectModelToJson(project: Project, flowsheet: Flowsheet): void {
  const payload = {
    owner: 'TAGING — INGENIERÍA INTELIGENTE',
    schema_version: '2026.3-TAGING-PFD',
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
  link.setAttribute('download', `TAGING_${project.code}_DataModel.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeHtml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&#39;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

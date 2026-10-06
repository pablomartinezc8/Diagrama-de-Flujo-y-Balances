/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { Flowsheet, NodeBalanceDiagnostics, Project } from '../types/process';

/**
 * 1. EXPORTACIÓN DE PLANILLA PROFESIONAL PARA EXCEL (.XLS con formato corporativo TAGING)
 * Genera un libro compatible con Microsoft Excel con:
 * - Membrete corporativo azul marino de TAGING — INGENIERÍA INTELIGENTE y su logo triangular
 * - Cuadro de metadatos del proyecto (Código, Cliente, Unidad Minera, Fase, Ingeniero, Fecha)
 * - Tabla Maestra de Corrientes con bordes, encabezados coloreados, unidades claras y celdas numéricas alineadas
 * - Tabla de Auditoría de Cierre de Balance por Equipo (Σ Entradas = Σ Salidas) con semáforo visual
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
          <!-- MEMBRETE CORPORATIVO TAGING -->
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

          <!-- CUADRO TÉCNICO DE METADATOS DEL PROYECTO -->
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

          <!-- SECCIÓN 1: MATRIZ PRINCIPAL DE CORRIENTES -->
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

          <!-- SECCIÓN 2: VERIFICACIÓN DE CIERRE DE NODOS -->
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

// Mantenemos alias para retrocompatibilidad con cualquier llamada existente
export const exportMassBalanceToCsv = exportProfessionalExcelSheet;

/**
 * 2. EXPORTACIÓN DIRECTA DE PLANO DE INGENIERÍA EN PDF IMPRIMIBLE (A3/A4 Landscape)
 * CON SELLO OFICIAL DE "TAGING — INGENIERÍA INTELIGENTE", CAJETÍN DE CLIENTE,
 * ZONAS MANUALES DIBUJADAS, DIAGRAMAS PFD Y TABLA RESUMEN DE CORRIENTES.
 */
export function exportFlowsheetToPrintablePdf(
  project: Project,
  flowsheet: Flowsheet,
  diagnostics: NodeBalanceDiagnostics[]
): void {
  // Creamos documento PDF apaisado (Landscape A4: 297mm x 210mm) listo para imprimir o presentar a cliente
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = 297;
  const pageH = 210;
  const exportDate = new Date().toISOString().slice(0, 10);

  // Marco perimetral doble estilo plano de ingeniería
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.rect(6, 6, pageW - 12, pageH - 12);
  doc.setLineWidth(0.2);
  doc.rect(7.5, 7.5, pageW - 15, pageH - 15);

  // CABECERA CORPORATIVA CON EL SELLO / LOGO DE TAGING
  doc.setFillColor(6, 21, 45); // Azul marino corporativo TAGING (#06152D)
  doc.rect(7.5, 7.5, pageW - 15, 22, 'F');

  // Sello gráfico TAGING (Triángulo cian #009ADE + Texto TAGING + INGENIERÍA INTELIGENTE)
  doc.setFillColor(0, 154, 222); // #009ADE
  doc.triangle(31, 14.5, 46, 9.2, 46, 14.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('TAGING', 13, 21.2);

  doc.setFontSize(5.8);
  doc.setTextColor(186, 230, 253);
  doc.text('INGENIERIA INTELIGENTE', 13.2, 25.2);

  // Línea separadora vertical en cabecera
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.4);
  doc.line(58, 10, 58, 27);

  // Datos del Proyecto en Cabecera del Plano
  doc.setTextColor(56, 189, 248);
  doc.setFontSize(8);
  doc.text(`DIAGRAMA DE FLUJO DE PROCESOS (PFD) & BALANCE DE MASA — ${project.code}`, 63, 14);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(project.name.slice(0, 75), 63, 20);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `Cliente: ${project.client}  |  Unidad: ${project.mining_unit}  |  Fase: ${project.phase}  |  Ing.: ${project.lead_engineer}`,
    63,
    25.2
  );

  // Sello de Revisión y Fecha a la derecha de la cabecera
  doc.setFillColor(15, 23, 42);
  doc.rect(240, 9.5, 47, 18, 'F');
  doc.setTextColor(56, 189, 248);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('SELLO DE INGENIERIA', 243, 14);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text(`Rev: ${flowsheet.version.slice(0, 22)}`, 243, 19);
  doc.text(`Fecha: ${exportDate}`, 243, 23.8);

  // ÁREA DEL LIENZO PFD (Escala automática para encajar nodos, conectores y zonas manuales)
  const canvasTop = 32;
  const canvasHeight = 104;
  const canvasLeft = 10;
  const canvasWidth = pageW - 20;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(canvasLeft, canvasTop, canvasWidth, canvasHeight, 'FD');

  // Calculamos bounding box del diagrama para escalarlo de forma limpia al plano PDF
  const allX: number[] = [0, 1380];
  const allY: number[] = [0, 420];
  flowsheet.nodes.forEach((n) => {
    allX.push(n.position_x, n.position_x + 210);
    allY.push(n.position_y, n.position_y + 95);
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

  // 1) Dibujar Zonas Manuales / Cuadros de Usuario (ej. Zona de Carga de Camiones)
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
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(ann.title.slice(0, 65), ax + 2, ay + 4.2);

    if (ann.details) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(51, 65, 85);
      const splitDetails = doc.splitTextToSize(ann.details, Math.max(20, aw - 4));
      doc.text(splitDetails.slice(0, 3), ax + 2, ay + 8);
    }
  });

  // 2) Dibujar Conectores / Corrientes Ortogonales (Streams)
  const nodeMap = new Map(flowsheet.nodes.map((n) => [n.id, n]));
  flowsheet.edges.forEach((edge, idx) => {
    const src = nodeMap.get(edge.source_node_id);
    const tgt = nodeMap.get(edge.target_node_id);
    if (!src || !tgt) return;

    const x1 = tx(src.position_x + 196);
    const y1 = ty(src.position_y + 42);
    const x2 = tx(tgt.position_x);
    const y2 = ty(tgt.position_y + 42);
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

    // Pequeña flecha en el destino
    doc.triangle(x2, y2, x2 - 2.2, y2 - 1.1, x2 - 2.2, y2 + 1.1, 'F');

    // Etiqueta de la corriente en el punto medio
    const tagW = 19;
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
      `${edge.flow_data.solids_tph.toFixed(0)}t/h · ${edge.flow_data.percent_solids.toFixed(0)}%`,
      midX,
      midY + 2.1,
      { align: 'center' }
    );
  });

  // 3) Dibujar Bloques de Equipos (EquipmentNode)
  const diagMap = new Map(diagnostics.map((d) => [d.nodeId, d]));
  flowsheet.nodes.forEach((node) => {
    const nx = tx(node.position_x);
    const ny = ty(node.position_y);
    const nw = Math.max(24, 196 * scale);
    const nh = Math.max(11, 84 * scale);

    const diag = diagMap.get(node.id);
    doc.setFillColor(15, 23, 42);
    if (diag && !diag.isBoundary && !diag.isBalanced) {
      doc.setDrawColor(225, 29, 72);
    } else {
      doc.setDrawColor(2, 132, 199);
    }
    doc.setLineWidth(0.4);
    doc.roundedRect(nx, ny, nw, nh, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(56, 189, 248);
    doc.text(node.tag, nx + 1.8, ny + 3.6);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5.5);
    doc.text(node.name.slice(0, 25), nx + 1.8, ny + 7.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.6);
    doc.setTextColor(148, 163, 184);
    doc.text(node.category.slice(0, 26), nx + 1.8, ny + 10.2);
  });

  // SECCIÓN INFERIOR DEL PDF: TABLA RESUMEN DE BALANCE DE MASA IMPRIMIBLE
  const tableTop = 140;
  doc.setFillColor(6, 21, 45);
  doc.rect(10, tableTop, pageW - 20, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    'TABLA RESUMEN DE BALANCE DE MASA POR CORRIENTE (STREAMS) — DOCUMENTO PRESENTACION CLIENTE',
    13,
    tableTop + 4.1
  );

  // Encabezados de Columna
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

  // Filas de Corrientes (máximo 9 filas en la hoja principal para no desbordar el cajetín)
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
    doc.text(edge.name.slice(0, 36), cols[1].x + 1, rowY + 3.6);
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
    'PROPIEDAD DE TAGING — INGENIERIA INTELIGENTE  |  DOCUMENTO TECNICO DE PROCESOS MINEROS',
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
          <text x="12" y="42" fill="#f8fafc" font-family="sans-serif" font-size="11" font-weight="bold">${escapeHtml(node.name.slice(0, 26))}</text>
          <text x="12" y="62" fill="#94a3b8" font-family="sans-serif" font-size="10">${escapeHtml(node.category)}</text>
        </g>
      `;
    })
    .join('\n');

  const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#020617" />
  <!-- Membrete TAGING -->
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
    schema_version: '2026.2-TAGING-PFD',
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

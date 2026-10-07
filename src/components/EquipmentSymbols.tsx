/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  CadMaterialStyle,
  CustomEquipmentDrawing,
  EquipmentSubType,
} from '../types/process';

interface EquipmentIconProps {
  type: EquipmentSubType;
  className?: string;
  customDrawing?: CustomEquipmentDrawing;
  showDimensionsOverlay?: boolean;
}

function getMaterialFillAndStroke(material: CadMaterialStyle, gradPrefix: string) {
  switch (material) {
    case 'machinery_gold':
      return {
        fill: `url(#${gradPrefix}-gold)`,
        stroke: '#713F12',
        accent: '#FDE047',
      };
    case 'motor_blue':
      return {
        fill: `url(#${gradPrefix}-blue)`,
        stroke: '#0F172A',
        accent: '#60A5FA',
      };
    case 'dark_steel':
      return {
        fill: `url(#${gradPrefix}-steel)`,
        stroke: '#0F172A',
        accent: '#94A3B8',
      };
    case 'process_cyan':
    default:
      return {
        fill: `url(#${gradPrefix}-cyan)`,
        stroke: '#0369A1',
        accent: '#38BDF8',
      };
  }
}

/**
 * Gráficos Industriales Ilustrados de Cuerpo Completo para Diagramas de Flujo Mineros (PFD)
 * Soporta tanto la librería estándar como los equipos dibujados desde cero por el usuario en el Estudio CAD,
 * aplicando automáticamente el mismo estilo industrial 3D (degradados metálicos, pernos, motores azules y puertos).
 */
export const EquipmentSymbolSvg: React.FC<EquipmentIconProps> = ({
  type,
  className = 'w-full h-full',
  customDrawing,
  showDimensionsOverlay = false,
}) => {
  // Si el equipo fue diseñado a medida en el Estudio CAD, renderizamos sus primitivas con auto-estilo industrial
  if (customDrawing && customDrawing.primitives.length > 0) {
    const gradId = 'cad-ind';
    const inPorts = Math.max(1, Math.min(3, customDrawing.inletCount || 1));
    const outPorts = Math.max(1, Math.min(3, customDrawing.outletCount || 1));

    return (
      <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
        <defs>
          <linearGradient id={`${gradId}-gold`} x1="0" y1="10" x2="0" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="35%" stopColor="#EAB308" />
            <stop offset="80%" stopColor="#CA8A04" />
            <stop offset="100%" stopColor="#854D0E" />
          </linearGradient>
          <linearGradient id={`${gradId}-blue`} x1="0" y1="15" x2="0" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="50%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
          <linearGradient id={`${gradId}-steel`} x1="0" y1="15" x2="0" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="55%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id={`${gradId}-cyan`} x1="0" y1="15" x2="0" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="60%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
        </defs>

        {/* Dibujo de cada pieza CAD con sombreado industrial y pernos */}
        {customDrawing.primitives.map((prim) => {
          const style = getMaterialFillAndStroke(prim.material, gradId);

          if (prim.kind === 'drum_rect') {
            const boltCols = [prim.x + prim.w * 0.25, prim.x + prim.w * 0.5, prim.x + prim.w * 0.75];
            const boltRows = [prim.y + prim.h * 0.22, prim.y + prim.h * 0.5, prim.y + prim.h * 0.78];
            return (
              <g key={prim.id}>
                {/* Bridas laterales automáticas estilo tambor minero */}
                <rect
                  x={prim.x - 2.5}
                  y={prim.y - 2}
                  width={3}
                  height={prim.h + 4}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth="1.2"
                />
                <rect
                  x={prim.x + prim.w - 0.5}
                  y={prim.y - 2}
                  width={3}
                  height={prim.h + 4}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth="1.2"
                />
                <rect
                  x={prim.x}
                  y={prim.y}
                  width={prim.w}
                  height={prim.h}
                  rx="2"
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth="1.6"
                />
                {prim.hasBolts !== false && prim.w >= 26 && prim.h >= 20 && (
                  <g>
                    {boltCols.map((bx, ci) => (
                      <g key={ci}>
                        <line
                          x1={bx}
                          y1={prim.y}
                          x2={bx}
                          y2={prim.y + prim.h}
                          stroke={style.stroke}
                          strokeWidth="0.9"
                          strokeOpacity="0.55"
                        />
                        {boltRows.map((by, ri) => (
                          <circle
                            key={ri}
                            cx={bx}
                            cy={by}
                            r="1.6"
                            fill="#334155"
                            stroke="#F8FAFC"
                            strokeWidth="0.55"
                          />
                        ))}
                      </g>
                    ))}
                  </g>
                )}
              </g>
            );
          }

          if (prim.kind === 'hopper_trapezoid') {
            const topRatio = prim.topRatio ?? 1.0;
            // Si topRatio === 1 hacemos tolva o cono inferior; por defecto cono angosto abajo (60%)
            const insetBottom = prim.w * (topRatio < 1 ? 0.08 : 0.28);
            const insetTop = prim.w * (topRatio < 1 ? 0.28 : 0.04);
            const pts = `${prim.x + insetTop},${prim.y} ${prim.x + prim.w - insetTop},${prim.y} ${
              prim.x + prim.w - insetBottom
            },${prim.y + prim.h} ${prim.x + insetBottom},${prim.y + prim.h}`;
            return (
              <g key={prim.id}>
                <polygon
                  points={pts}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <line
                  x1={prim.x + prim.w / 2}
                  y1={prim.y + 2}
                  x2={prim.x + prim.w / 2}
                  y2={prim.y + prim.h - 2}
                  stroke={style.accent}
                  strokeWidth="0.9"
                  strokeOpacity="0.45"
                />
              </g>
            );
          }

          if (prim.kind === 'flywheel_circle') {
            const cx = prim.x + prim.w / 2;
            const cy = prim.y + prim.h / 2;
            const r = Math.max(6, Math.min(prim.w, prim.h) / 2);
            return (
              <g key={prim.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth="1.8"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={r * 0.65}
                  stroke={style.accent}
                  strokeWidth="1.2"
                  strokeDasharray="4 2"
                />
                <circle cx={cx} cy={cy} r={Math.max(2.5, r * 0.22)} fill="#38BDF8" />
              </g>
            );
          }

          if (prim.kind === 'motor_drive') {
            return (
              <g key={prim.id}>
                <rect
                  x={prim.x}
                  y={prim.y}
                  width={prim.w}
                  height={prim.h}
                  rx="2.5"
                  fill={`url(#${gradId}-blue)`}
                  stroke="#0F172A"
                  strokeWidth="1.4"
                />
                <line
                  x1={prim.x + 3}
                  y1={prim.y + prim.h * 0.28}
                  x2={prim.x + prim.w - 3}
                  y2={prim.y + prim.h * 0.28}
                  stroke="#93C5FD"
                  strokeWidth="1.1"
                />
                <line
                  x1={prim.x + 3}
                  y1={prim.y + prim.h * 0.55}
                  x2={prim.x + prim.w - 3}
                  y2={prim.y + prim.h * 0.55}
                  stroke="#1E3A8A"
                  strokeWidth="1.1"
                />
                <line
                  x1={prim.x + 3}
                  y1={prim.y + prim.h * 0.78}
                  x2={prim.x + prim.w - 3}
                  y2={prim.y + prim.h * 0.78}
                  stroke="#1E3A8A"
                  strokeWidth="1.1"
                />
              </g>
            );
          }

          if (prim.kind === 'skid_base') {
            const pts = `${prim.x},${prim.y} ${prim.x + prim.w},${prim.y} ${
              prim.x + prim.w - 5
            },${prim.y + prim.h} ${prim.x + 5},${prim.y + prim.h}`;
            return (
              <polygon
                key={prim.id}
                points={pts}
                fill={`url(#${gradId}-gold)`}
                stroke="#713F12"
                strokeWidth="1.5"
              />
            );
          }

          if (prim.kind === 'pipe_line') {
            const x2 = prim.x2 ?? prim.x + prim.w;
            const y2 = prim.y2 ?? prim.y + prim.h;
            return (
              <g key={prim.id}>
                <line
                  x1={prim.x}
                  y1={prim.y}
                  x2={x2}
                  y2={y2}
                  stroke={style.stroke}
                  strokeWidth="5.5"
                  strokeLinecap="round"
                />
                <line
                  x1={prim.x}
                  y1={prim.y}
                  x2={x2}
                  y2={y2}
                  stroke={style.accent}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </g>
            );
          }

          if (prim.kind === 'polygon_free' && prim.points && prim.points.length >= 2) {
            const ptsStr = prim.points.map((pt) => `${pt.x},${pt.y}`).join(' ');
            return (
              <polygon
                key={prim.id}
                points={ptsStr}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            );
          }

          return null;
        })}

        {/* Bridas de Conexión de Entrada (Izquierda) y Salida (Derecha) */}
        {Array.from({ length: inPorts }).map((_, i) => {
          const py = inPorts === 1 ? 52 : 30 + i * 24;
          return (
            <g key={`in-port-${i}`}>
              <rect x="6" y={py - 4} width="7" height="8" rx="1" fill="#0284C7" stroke="#E0F2FE" strokeWidth="0.9" />
            </g>
          );
        })}
        {Array.from({ length: outPorts }).map((_, i) => {
          const py = outPorts === 1 ? 52 : 30 + i * 24;
          return (
            <g key={`out-port-${i}`}>
              <rect x="167" y={py - 4} width="7" height="8" rx="1" fill="#10B981" stroke="#D1FAE5" strokeWidth="0.9" />
            </g>
          );
        })}

        {/* Cotas Técnicas estilo AutoCAD (Ancho × Alto en metros) */}
        {showDimensionsOverlay && (
          <g>
            <line x1="22" y1="104" x2="158" y2="104" stroke="#22D3EE" strokeWidth="1" strokeDasharray="3 2" />
            <text x="90" y="102" fill="#22D3EE" fontSize="8" fontFamily="monospace" textAnchor="middle">
              {customDrawing.dimensions.width_m}m × {customDrawing.dimensions.height_m}m
            </text>
          </g>
        )}
      </svg>
    );
  }
  switch (type) {
    case 'mill_sag':
    case 'mill_ball':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="mill-drum-grad" x1="0" y1="15" x2="0" y2="85" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="35%" stopColor="#EAB308" />
              <stop offset="80%" stopColor="#CA8A04" />
              <stop offset="100%" stopColor="#854D0E" />
            </linearGradient>
            <linearGradient id="mill-chute-grad" x1="0" y1="18" x2="0" y2="65" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#A16207" />
            </linearGradient>
            <linearGradient id="motor-blue-grad" x1="0" y1="68" x2="0" y2="90" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="50%" stopColor="#1D4ED8" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </linearGradient>
          </defs>

          {/* Chute / Tolva inclinada de alimentación (izquierda, igual a la imagen de referencia) */}
          <polygon
            points="8,22 42,22 50,48 62,48 62,56 44,56 34,38"
            fill="url(#mill-chute-grad)"
            stroke="#713F12"
            strokeWidth="1.5"
          />
          {/* Columna soporte del chute */}
          <rect x="44" y="48" width="9" height="40" fill="#CA8A04" stroke="#713F12" strokeWidth="1.2" />

          {/* Brida izquierda y derecha del tambor rotatorio */}
          <rect x="62" y="18" width="5" height="68" fill="#EAB308" stroke="#713F12" strokeWidth="1.4" />
          <rect x="148" y="18" width="6" height="68" fill="#EAB308" stroke="#713F12" strokeWidth="1.4" />

          {/* Cuerpo Cilíndrico Principal del Molino (Amarillo Ocre con sombreado 3D) */}
          <rect
            x="67"
            y="21"
            width="81"
            height="62"
            fill="url(#mill-drum-grad)"
            stroke="#713F12"
            strokeWidth="1.6"
          />

          {/* Líneas de blindaje (Liners) y filas de pernos metálicos sobre el manto */}
          {[84, 106, 128].map((bx) => (
            <g key={bx}>
              <line x1={bx} y1="21" x2={bx} y2="83" stroke="#854D0E" strokeWidth="1" strokeOpacity="0.6" />
              {[27, 38, 50, 62, 74].map((by) => (
                <circle key={by} cx={bx} cy={by} r="1.8" fill="#475569" stroke="#F8FAFC" strokeWidth="0.6" />
              ))}
            </g>
          ))}

          {/* Trommel / Trunnion de descarga derecha */}
          <rect
            x="154"
            y="36"
            width="12"
            height="32"
            fill="url(#mill-drum-grad)"
            stroke="#713F12"
            strokeWidth="1.4"
          />
          <rect x="166" y="42" width="5" height="20" fill="#A16207" stroke="#713F12" strokeWidth="1.2" />

          {/* Rodamientos / Descansos de apoyo inferiores */}
          <rect x="86" y="75" width="18" height="14" rx="1" fill="#1E293B" stroke="#0F172A" strokeWidth="1.2" />
          <rect x="116" y="75" width="22" height="14" rx="1" fill="#1E293B" stroke="#0F172A" strokeWidth="1.2" />

          {/* Motor Eléctrico Azul de Accionamiento (frente izquierdo inferior) */}
          <rect
            x="53"
            y="70"
            width="33"
            height="18"
            rx="2"
            fill="url(#motor-blue-grad)"
            stroke="#0F172A"
            strokeWidth="1.3"
          />
          <line x1="57" y1="74" x2="82" y2="74" stroke="#60A5FA" strokeWidth="1" />
          <line x1="57" y1="79" x2="82" y2="79" stroke="#1E40AF" strokeWidth="1" />
          <line x1="57" y1="83" x2="82" y2="83" stroke="#1E40AF" strokeWidth="1" />

          {/* Bastidor Base Estructural (Skid amarillo inferior) */}
          <polygon
            points="40,88 156,88 150,99 46,99"
            fill="#EAB308"
            stroke="#713F12"
            strokeWidth="1.5"
          />
          <polygon points="50,91 62,91 56,96" fill="#713F12" opacity="0.6" />
        </svg>
      );

    case 'crusher_jaw':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="crusher-body" x1="0" y1="15" x2="0" y2="95" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FACC15" />
              <stop offset="60%" stopColor="#CA8A04" />
              <stop offset="100%" stopColor="#713F12" />
            </linearGradient>
          </defs>
          {/* Tolva superior recepción ROM */}
          <polygon points="22,12 90,12 78,28 32,28" fill="#EAB308" stroke="#713F12" strokeWidth="1.5" />
          {/* Cuerpo pesado del chancador */}
          <polygon points="26,28 134,28 124,86 32,86" fill="url(#crusher-body)" stroke="#713F12" strokeWidth="1.6" />
          {/* Cámara de mandíbulas (fija y móvil) */}
          <polygon points="38,32 50,32 48,80 38,80" fill="#334155" stroke="#0F172A" strokeWidth="1.2" />
          <polygon points="78,32 92,34 66,80 56,80" fill="#475569" stroke="#0F172A" strokeWidth="1.2" />
          {/* Gran volante de inercia excéntrico */}
          <circle cx="112" cy="48" r="24" fill="#1E293B" stroke="#94A3B8" strokeWidth="2.5" />
          <circle cx="112" cy="48" r="16" stroke="#EAB308" strokeWidth="1.8" strokeDasharray="5 3" />
          <circle cx="112" cy="48" r="5" fill="#38BDF8" />
          {/* Motor azul trasero y correa en V */}
          <rect x="136" y="58" width="28" height="18" rx="2" fill="#1D4ED8" stroke="#0F172A" strokeWidth="1.3" />
          <line x1="112" y1="26" x2="150" y2="58" stroke="#0F172A" strokeWidth="2.5" />
          {/* Base estructural */}
          <rect x="20" y="86" width="144" height="11" rx="2" fill="#A16207" stroke="#713F12" strokeWidth="1.5" />
        </svg>
      );

    case 'crusher_cone':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Tolva superior de alimentación */}
          <polygon points="48,10 132,10 118,26 62,26" fill="#EAB308" stroke="#713F12" strokeWidth="1.5" />
          {/* Carcasa cónica superior e inferior */}
          <polygon points="44,26 136,26 122,64 58,64" fill="#CA8A04" stroke="#713F12" strokeWidth="1.6" />
          <rect x="54" y="64" width="72" height="24" fill="#A16207" stroke="#713F12" strokeWidth="1.6" />
          {/* Cono triturador interior (Manto) */}
          <polygon points="90,28 112,60 68,60" fill="#334155" stroke="#38BDF8" strokeWidth="1.6" />
          <rect x="85" y="60" width="10" height="26" fill="#475569" />
          {/* Motor de accionamiento lateral azul */}
          <rect x="132" y="68" width="30" height="18" rx="2" fill="#1D4ED8" stroke="#0F172A" strokeWidth="1.4" />
          <rect x="36" y="88" width="130" height="10" fill="#EAB308" stroke="#713F12" strokeWidth="1.4" />
        </svg>
      );

    case 'mill_hpgr':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Chute vertical de carga */}
          <polygon points="64,8 116,8 104,28 76,28" fill="#EAB308" stroke="#713F12" strokeWidth="1.5" />
          {/* Bastidor pesado HPGR */}
          <rect x="28" y="28" width="124" height="60" rx="3" fill="#CA8A04" stroke="#713F12" strokeWidth="1.6" />
          {/* Dos rodillos de alta presión contrarrotatorios */}
          <circle cx="66" cy="58" r="22" fill="#334155" stroke="#E2E8F0" strokeWidth="2.2" />
          <circle cx="114" cy="58" r="22" fill="#334155" stroke="#E2E8F0" strokeWidth="2.2" />
          <circle cx="66" cy="58" r="6" fill="#38BDF8" />
          <circle cx="114" cy="58" r="6" fill="#38BDF8" />
          {/* Pistones hidráulicos laterales */}
          <rect x="14" y="48" width="16" height="20" fill="#1D4ED8" stroke="#0F172A" strokeWidth="1.3" />
          <rect x="22" y="88" width="136" height="10" fill="#A16207" stroke="#713F12" strokeWidth="1.4" />
        </svg>
      );

    case 'hydrocyclone':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Tubería colectora Overflow superior (azul/celeste) */}
          <path d="M90 22V8H154" stroke="#0284C7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M90 22V8H154" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Tubería de alimentación tangencial izquierda */}
          <rect x="24" y="26" width="44" height="12" fill="#CA8A04" stroke="#713F12" strokeWidth="1.4" />
          {/* Cámara cilíndrica superior del hidrociclón */}
          <rect x="66" y="20" width="48" height="24" rx="2" fill="#EAB308" stroke="#713F12" strokeWidth="1.6" />
          <rect x="64" y="42" width="52" height="5" fill="#A16207" stroke="#713F12" strokeWidth="1.2" />
          {/* Sección cónica y Apex de descarga Underflow */}
          <polygon points="68,47 112,47 96,92 84,92" fill="#CA8A04" stroke="#713F12" strokeWidth="1.6" />
          <rect x="83" y="92" width="14" height="10" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.4" />
          {/* Bastidor estructural de soporte */}
          <line x1="52" y1="44" x2="52" y2="98" stroke="#64748B" strokeWidth="3" />
          <line x1="128" y1="44" x2="128" y2="98" stroke="#64748B" strokeWidth="3" />
          <line x1="44" y1="98" x2="136" y2="98" stroke="#475569" strokeWidth="4" />
        </svg>
      );

    case 'screen_vibrating':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Caja vibratoria inclinada amarilla */}
          <polygon
            points="22,20 154,36 146,72 18,56"
            fill="#EAB308"
            stroke="#713F12"
            strokeWidth="1.6"
          />
          {/* Mallas de clasificación (Doble Deck) */}
          <line x1="24" y1="34" x2="150" y2="50" stroke="#1E293B" strokeWidth="2.5" strokeDasharray="6 3" />
          <line x1="21" y1="45" x2="147" y2="61" stroke="#334155" strokeWidth="2" strokeDasharray="4 3" />
          {/* Unidad motriz excéntrica azul */}
          <circle cx="88" cy="44" r="11" fill="#1D4ED8" stroke="#0F172A" strokeWidth="1.6" />
          <circle cx="88" cy="44" r="4" fill="#60A5FA" />
          {/* Resortes y pedestales de apoyo */}
          <rect x="30" y="58" width="12" height="34" fill="#475569" stroke="#0F172A" strokeWidth="1.2" />
          <rect x="130" y="70" width="12" height="22" fill="#475569" stroke="#0F172A" strokeWidth="1.2" />
          <rect x="18" y="92" width="144" height="7" fill="#94A3B8" />
        </svg>
      );

    case 'flotation_rougher':
    case 'flotation_scavenger':
    case 'flotation_cleaner':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Puente superior de motores y accionamiento */}
          <rect x="16" y="14" width="148" height="8" fill="#EAB308" stroke="#713F12" strokeWidth="1.4" />
          {/* 3 Motores azules de agitación */}
          {[42, 90, 138].map((mx) => (
            <g key={mx}>
              <rect x={mx - 9} y="4" width="18" height="12" rx="1.5" fill="#1D4ED8" stroke="#0F172A" strokeWidth="1.2" />
              <line x1={mx} y1="22" x2={mx} y2="76" stroke="#CBD5E1" strokeWidth="2.5" />
              <rect x={mx - 10} y="72" width="20" height="6" rx="1" fill="#38BDF8" />
            </g>
          ))}
          {/* Celdas de Flotación con pulpa y espuma mineralizada */}
          <rect x="20" y="30" width="140" height="58" rx="3" fill="#1E293B" stroke="#94A3B8" strokeWidth="1.8" />
          <line x1="66" y1="30" x2="66" y2="88" stroke="#64748B" strokeWidth="1.5" />
          <line x1="114" y1="30" x2="114" y2="88" stroke="#64748B" strokeWidth="1.5" />
          {/* Rebose de espuma rica en concentrado */}
          <path
            d="M22 38C34 32 46 42 58 36C70 30 82 42 94 36C106 30 118 42 130 36C142 30 150 40 158 36"
            stroke="#10B981"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Canaleta de concentrado (Launder) */}
          <rect x="16" y="42" width="148" height="9" fill="#CA8A04" stroke="#713F12" strokeWidth="1.3" />
          <rect x="14" y="88" width="152" height="8" fill="#EAB308" stroke="#713F12" strokeWidth="1.4" />
        </svg>
      );

    case 'thickener':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Pasarela / Puente estructural superior amarillo */}
          <rect x="10" y="16" width="160" height="9" fill="#EAB308" stroke="#713F12" strokeWidth="1.4" />
          {/* Cabezal motriz central azul */}
          <rect x="76" y="6" width="28" height="14" rx="2" fill="#1D4ED8" stroke="#0F172A" strokeWidth="1.3" />
          {/* Estanque cilíndrico-cónico del espesador */}
          <polygon
            points="16,26 164,26 164,54 96,88 84,88 16,54"
            fill="#1E293B"
            stroke="#38BDF8"
            strokeWidth="1.8"
          />
          {/* Nivel de agua clarificada en el rebose superior */}
          <rect x="18" y="27" width="144" height="10" fill="#0284C7" fillOpacity="0.45" />
          {/* Eje central y rastrillos (Rakes) hacia el cono de descarga */}
          <line x1="90" y1="25" x2="90" y2="84" stroke="#EAB308" strokeWidth="3" />
          <path d="M36 56L90 82L144 56" stroke="#FACC15" strokeWidth="2.5" />
          {/* Columnas de soporte perimetrales */}
          <rect x="24" y="56" width="8" height="38" fill="#64748B" />
          <rect x="148" y="56" width="8" height="38" fill="#64748B" />
          <rect x="14" y="94" width="152" height="6" fill="#94A3B8" />
        </svg>
      );

    case 'filter_press':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Vigas laterales y placas verticales de filtrado */}
          <rect x="16" y="24" width="14" height="68" fill="#EAB308" stroke="#713F12" strokeWidth="1.5" />
          <rect x="150" y="24" width="14" height="68" fill="#EAB308" stroke="#713F12" strokeWidth="1.5" />
          <rect x="30" y="34" width="120" height="8" fill="#CA8A04" stroke="#713F12" strokeWidth="1.2" />
          {[38, 52, 66, 80, 94, 108, 122].map((px) => (
            <rect
              key={px}
              x={px}
              y="26"
              width="10"
              height="52"
              rx="1"
              fill="#334155"
              stroke="#38BDF8"
              strokeWidth="1.2"
            />
          ))}
          {/* Cilindro hidráulico azul de compresión */}
          <rect x="134" y="42" width="18" height="20" fill="#1D4ED8" stroke="#0F172A" strokeWidth="1.3" />
          <rect x="12" y="92" width="156" height="7" fill="#A16207" />
        </svg>
      );

    case 'slurry_pump':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Bastidor base amarillo */}
          <rect x="20" y="84" width="140" height="12" rx="2" fill="#EAB308" stroke="#713F12" strokeWidth="1.5" />
          {/* Motor eléctrico azul (izquierda) + acoplamiento */}
          <rect x="26" y="46" width="52" height="38" rx="3" fill="#1D4ED8" stroke="#0F172A" strokeWidth="1.5" />
          <rect x="78" y="58" width="18" height="16" fill="#CA8A04" stroke="#713F12" strokeWidth="1.2" />
          {/* Voluta centrífuga de pulpa (derecha) con descarga vertical */}
          <rect x="122" y="14" width="18" height="40" fill="#EAB308" stroke="#713F12" strokeWidth="1.5" />
          <circle cx="122" cy="58" r="26" fill="#EAB308" stroke="#713F12" strokeWidth="1.8" />
          <circle cx="122" cy="58" r="10" fill="#334155" stroke="#38BDF8" strokeWidth="1.5" />
          <rect x="144" y="52" width="22" height="14" fill="#CA8A04" stroke="#713F12" strokeWidth="1.4" />
        </svg>
      );

    case 'conveyor_belt':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Estructura reticulada inclinada de la correa */}
          <polygon points="14,68 152,24 158,42 20,86" fill="#EAB308" stroke="#713F12" strokeWidth="1.5" />
          <circle cx="22" cy="75" r="11" fill="#1E293B" stroke="#38BDF8" strokeWidth="2" />
          <circle cx="152" cy="34" r="11" fill="#1D4ED8" stroke="#60A5FA" strokeWidth="2" />
          {/* Mineral transportado sobre la cinta */}
          <polygon points="30,58 60,44 95,36 136,22 142,27 26,64" fill="#A16207" />
          <rect x="44" y="68" width="8" height="28" fill="#64748B" />
          <rect x="124" y="44" width="8" height="52" fill="#64748B" />
        </svg>
      );

    case 'leach_tank':
    case 'magnetic_separator':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Motor superior azul */}
          <rect x="78" y="4" width="24" height="14" rx="2" fill="#1D4ED8" stroke="#0F172A" strokeWidth="1.3" />
          <rect x="40" y="18" width="100" height="6" fill="#EAB308" stroke="#713F12" strokeWidth="1.3" />
          {/* Cuerpo del reactor agitado */}
          <rect x="44" y="24" width="92" height="68" rx="4" fill="#1E293B" stroke="#EAB308" strokeWidth="2" />
          <line x1="90" y1="18" x2="90" y2="76" stroke="#CBD5E1" strokeWidth="3" />
          <ellipse cx="90" cy="54" rx="22" ry="5" fill="#38BDF8" />
          <ellipse cx="90" cy="76" rx="26" ry="6" fill="#38BDF8" />
          <rect x="36" y="92" width="108" height="7" fill="#CA8A04" />
        </svg>
      );

    case 'feed_source':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Tolva ROM / Buzón de Recepción con mineral */}
          <polygon points="36,18 144,18 130,32 50,32" fill="#78350F" stroke="#F59E0B" strokeWidth="1.5" />
          <polygon
            points="26,28 154,28 124,78 56,78"
            fill="#EAB308"
            stroke="#713F12"
            strokeWidth="1.8"
          />
          {/* Alimentador de placas inferior (Apron Feeder) */}
          <rect x="48" y="78" width="96" height="14" rx="6" fill="#1D4ED8" stroke="#0F172A" strokeWidth="1.5" />
          <circle cx="58" cy="85" r="4" fill="#93C5FD" />
          <circle cx="134" cy="85" r="4" fill="#93C5FD" />
        </svg>
      );

    case 'product_sink':
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Domo / Acopio Stockpile de Producto o Relave */}
          <polygon
            points="18,88 90,22 162,88"
            fill="#10B981"
            fillOpacity="0.35"
            stroke="#10B981"
            strokeWidth="2.2"
          />
          <polygon points="42,88 90,42 138,88" fill="#059669" fillOpacity="0.55" />
          <rect x="12" y="88" width="156" height="8" rx="2" fill="#EAB308" stroke="#713F12" strokeWidth="1.4" />
        </svg>
      );

    case 'pipeline_header':
    case 'mixer_node':
    case 'splitter_node':
    default:
      return (
        <svg viewBox="0 0 180 110" fill="none" className={className} aria-hidden="true">
          {/* Cajón distribuidor / Nodo de proceso industrial */}
          <rect x="38" y="24" width="104" height="58" rx="4" fill="#EAB308" stroke="#713F12" strokeWidth="1.8" />
          <rect x="22" y="42" width="16" height="16" fill="#1D4ED8" stroke="#0F172A" strokeWidth="1.3" />
          <rect x="142" y="32" width="16" height="14" fill="#0284C7" stroke="#0F172A" strokeWidth="1.3" />
          <rect x="142" y="58" width="16" height="14" fill="#0284C7" stroke="#0F172A" strokeWidth="1.3" />
          <rect x="32" y="82" width="116" height="10" fill="#A16207" stroke="#713F12" strokeWidth="1.4" />
        </svg>
      );
  }
};

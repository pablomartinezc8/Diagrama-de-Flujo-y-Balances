/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { EquipmentSubType } from '../types/process';

interface EquipmentIconProps {
  type: EquipmentSubType;
  className?: string;
}

/**
 * Simbología Técnica PFD / ISA para Equipos de Procesamiento de Minerales
 */
export const EquipmentSymbolSvg: React.FC<EquipmentIconProps> = ({
  type,
  className = 'w-7 h-7',
}) => {
  switch (type) {
    case 'crusher_jaw':
    case 'crusher_cone':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M6 6L13 30H23L30 6H6Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M14 11L18 25L22 11"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'mill_sag':
    case 'mill_ball':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect
            x="7"
            y="8"
            width="22"
            height="20"
            rx="3"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M3 15H7V21H3" stroke="currentColor" strokeWidth="2" />
          <path d="M33 15H29V21H33" stroke="currentColor" strokeWidth="2" />
          <circle cx="14" cy="21" r="2" fill="currentColor" />
          <circle cx="19" cy="23" r="1.8" fill="currentColor" />
          <circle cx="22" cy="19" r="2" fill="currentColor" />
          <path d="M8 15C13 13 23 17 28 15" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
        </svg>
      );

    case 'mill_hpgr':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="18" r="7" stroke="currentColor" strokeWidth="2" />
          <circle cx="24" cy="18" r="7" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="18" r="2" fill="currentColor" />
          <circle cx="24" cy="18" r="2" fill="currentColor" />
          <path d="M18 6V11M18 25V30" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      );

    case 'screen_vibrating':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <polygon
            points="5,10 31,15 29,25 5,20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line
            x1="7"
            y1="15"
            x2="29"
            y2="19.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeDasharray="3 2"
          />
        </svg>
      );

    case 'hydrocyclone':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect x="11" y="6" width="14" height="8" stroke="currentColor" strokeWidth="2" />
          <path d="M11 14L18 31L25 14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M18 6V2" stroke="currentColor" strokeWidth="2" />
          <path d="M6 9H11" stroke="currentColor" strokeWidth="2" />
        </svg>
      );

    case 'flotation_rougher':
    case 'flotation_scavenger':
    case 'flotation_cleaner':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M6 10V26C6 28 8 29 10 29H26C28 29 30 28 30 26V10" stroke="currentColor" strokeWidth="2" />
          <line x1="18" y1="5" x2="18" y2="23" stroke="currentColor" strokeWidth="2" />
          <path d="M13 23H23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M6 13C11 11 15 15 18 13C21 11 25 15 30 13" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );

    case 'thickener':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M4 11H32V19L18 28L4 19V11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <line x1="18" y1="6" x2="18" y2="24" stroke="currentColor" strokeWidth="1.75" />
          <path d="M11 21L18 24L25 21" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      );

    case 'filter_press':
    case 'magnetic_separator':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect x="6" y="9" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="9" x2="12" y2="27" stroke="currentColor" strokeWidth="1.75" />
          <line x1="18" y1="9" x2="18" y2="27" stroke="currentColor" strokeWidth="1.75" />
          <line x1="24" y1="9" x2="24" y2="27" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      );

    case 'slurry_pump':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="17" cy="18" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M17 9H31V14H25" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M11 27L7 31H27L23 27" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );

    case 'conveyor_belt':
    case 'pipeline_header':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="13" width="28" height="10" rx="5" stroke="currentColor" strokeWidth="2" />
          <circle cx="9" cy="18" r="2.5" fill="currentColor" />
          <circle cx="27" cy="18" r="2.5" fill="currentColor" />
        </svg>
      );

    case 'leach_tank':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <rect x="8" y="6" width="20" height="24" rx="2" stroke="currentColor" strokeWidth="2" />
          <line x1="18" y1="4" x2="18" y2="23" stroke="currentColor" strokeWidth="2" />
          <path d="M13 23L23 23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'feed_source':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M5 10H23L31 18L23 26H5V10Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="14" cy="18" r="2.5" fill="currentColor" />
        </svg>
      );

    case 'product_sink':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M5 10H25L31 18L25 26H5L10 18L5 10Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'mixer_node':
    case 'splitter_node':
    default:
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <polygon
            points="18,5 31,18 18,31 5,18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="18" r="3" fill="currentColor" />
        </svg>
      );
  }
};

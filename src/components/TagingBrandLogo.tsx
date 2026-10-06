/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface TagingBrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  theme?: 'dark' | 'light';
}

/**
 * Sello / Logo Vectorial Oficial de TAGING — INGENIERÍA INTELIGENTE
 * Basado en la identidad visual adjunta por el usuario:
 * - Triángulo rectángulo ascendente en azul cian (#009ADE)
 * - Logotipo geométrico "TAGING" en negrita
 * - Subtítulo "INGENIERÍA INTELIGENTE" con interletrado técnico
 */
export const TagingBrandLogo: React.FC<TagingBrandLogoProps> = ({
  size = 'md',
  showSubtitle = false,
  theme = 'dark',
}) => {
  const heightClass =
    size === 'sm' ? 'h-7' : size === 'lg' ? 'h-12' : 'h-8';

  const textColor = theme === 'dark' ? '#FFFFFF' : '#06152D';

  return (
    <svg
      viewBox={showSubtitle ? '0 0 240 86' : '0 0 210 64'}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${heightClass} w-auto select-none shrink-0`}
      role="img"
      aria-label="TAGING Ingeniería Inteligente"
    >
      {/* Triángulo rectángulo ascendente característico sobre "GI" */}
      <polygon points="90,30 156,4 156,30" fill="#009ADE" />

      {/* Tipografía Principal TAGING */}
      <text
        x="12"
        y="56"
        fill={textColor}
        fontFamily="'Chakra Petch', 'Plus Jakarta Sans', sans-serif"
        fontWeight="800"
        fontSize="38"
        letterSpacing="2.5"
      >
        TAGING
      </text>

      {/* Subtítulo INGENIERÍA INTELIGENTE */}
      {showSubtitle && (
        <text
          x="15"
          y="76"
          fill={theme === 'dark' ? '#CBD5E1' : '#334155'}
          fontFamily="'Plus Jakarta Sans', sans-serif"
          fontWeight="600"
          fontSize="11.2"
          letterSpacing="3.4"
        >
          INGENIERÍA INTELIGENTE
        </text>
      )}
    </svg>
  );
};

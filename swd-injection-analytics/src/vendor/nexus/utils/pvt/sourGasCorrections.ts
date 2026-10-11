/**
 * Sour Gas Pseudocritical Corrections
 *
 * Shared Wichert-Aziz correction utility following pyRestToolbox SUT method.
 * Separates HC fraction, applies Sutton to HC-only gravity, then Kay's mixing
 * with component criticals, then Wichert-Aziz epsilon correction.
 *
 * Used by pvt/correlations.ts for Z-factor calculation.
 * Multiphase flow modules (beggsBrill.ts, hagedornBrown.ts) have their own
 * implementations which are NOT modified here (Phase 11 scope).
 */

import {
  calculateSuttonPseudoCriticalPressure,
  calculateSuttonPseudoCriticalTemperature,
} from './correlations.js';

export const COMPONENT_CRITICALS = {
  N2: { Tpc: 239.26, Ppc: 507.5 },
  CO2: { Tpc: 547.58, Ppc: 1071.0 },
  H2S: { Tpc: 672.35, Ppc: 1306.0 },
} as const;

const MW_AIR = 28.97;
const MW_N2 = 28.01;
const MW_CO2 = 44.01;
const MW_H2S = 34.1;

export function calculateSourGasPseudocriticals(
  gasSG: number,
  yH2S: number = 0,
  yCO2: number = 0,
  yN2: number = 0
): { ppc: number; tpc: number } {
  if (yH2S === 0 && yCO2 === 0 && yN2 === 0) {
    return {
      ppc: calculateSuttonPseudoCriticalPressure(gasSG),
      tpc: calculateSuttonPseudoCriticalTemperature(gasSG),
    };
  }

  const hcFrac = 1 - yN2 - yCO2 - yH2S;
  let sgHC = (gasSG - (yN2 * MW_N2 + yCO2 * MW_CO2 + yH2S * MW_H2S) / MW_AIR) / hcFrac;

  if (hcFrac < 0.01 || sgHC < 0.3) {
    sgHC = gasSG;
  }

  const ppcHC = calculateSuttonPseudoCriticalPressure(sgHC);
  const tpcHC = calculateSuttonPseudoCriticalTemperature(sgHC);

  const ppcStar = hcFrac * ppcHC + yN2 * COMPONENT_CRITICALS.N2.Ppc + yCO2 * COMPONENT_CRITICALS.CO2.Ppc + yH2S * COMPONENT_CRITICALS.H2S.Ppc;
  const tpcStar = hcFrac * tpcHC + yN2 * COMPONENT_CRITICALS.N2.Tpc + yCO2 * COMPONENT_CRITICALS.CO2.Tpc + yH2S * COMPONENT_CRITICALS.H2S.Tpc;

  const A = yH2S + yCO2;
  const B = yH2S;
  const epsilon = 120 * (Math.pow(A, 0.9) - Math.pow(A, 1.6)) +
    (B > 0 ? 15 * (Math.pow(B, 0.5) - Math.pow(B, 4)) : 0);

  const tpc = tpcStar - epsilon;
  const ppc = ppcStar * (tpcStar - epsilon) / (tpcStar + yH2S * (1 - yH2S) * epsilon);

  return { ppc, tpc };
}

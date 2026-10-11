/**
 * PVT Correlations - Single Source of Truth
 *
 * Consolidated PVT correlation functions. This module unifies code that
 * previously existed in both wellboreMath.ts and multiphaseFlow/pvtCorrelations.ts.
 *
 * Source of truth hierarchy (per Phase 7 decision):
 * - Overlapping functions: wellboreMath.ts versions win
 * - Unique functions from pvtCorrelations.ts: preserved here
 * - Oil compressibility: Vasquez-Beggs (wellboreMath) for wellbore calcs,
 *   McCain (pvtCorrelations) preserved for multiphase flow calcs
 *
 * Correlations:
 * - Vasquez-Beggs (SPE-6719): Gas gravity correction, Rs, Bo, oil compressibility
 * - McCain et al. (2011): Bubble point pressure
 * - Standing: Oil FVF at bubble point
 * - McCain (1990): Water FVF
 * - Dranchuk-Abou-Kassem (SPE-7330): Z-factor (DAK iterative, Sutton pseudocriticals)
 * - Sutton (SPE-14265): Pseudocritical pressure and temperature
 * - Beggs-Robinson: Oil viscosity (dead, live, undersaturated)
 */

import type {
  PVTProperties,
  PVTConfig,
  PVTWarning,
  PVTWarningCode,
  PVTWarningSeverity,
  PbCorrelation,
  RsCorrelation,
  BoCorrelation,
  ZCorrelation,
  ViscosityCorrelation,
} from './types.js';
import { TYPICAL_GOR_RANGES, GVF_MODERATE_MIN, GVF_HIGH_MIN, GVF_SEVERE_MIN } from './types.js';
import { P_STD, T_STD, MIN_RSB, MIN_PRESSURE } from './constants.js';
import { RANKINE_OFFSET } from '../constants.js';
import { calculateSourGasPseudocriticals } from './sourGasCorrections.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate oil specific gravity from API gravity.
 */
function _oilSGFromAPI(api: number): number {
  return 141.5 / (131.5 + api);
}

// Keep _oilSGFromAPI accessible for internal use but not exported
void _oilSGFromAPI;

// ============================================================================
// GAS GRAVITY CORRECTION
// ============================================================================

/**
 * Calculate gas gravity at 100 psig (corrected for separator conditions)
 * Based on Vasquez-Beggs correlation (SPE-6719)
 *
 * @param gasSG - Gas specific gravity (air = 1.0)
 * @param oilAPI - Oil API gravity
 * @param separatorTemp - Separator temperature (degrees F)
 * @param separatorPressure - Separator pressure (psig)
 * @returns Gas gravity corrected to 100 psig
 */
export function calculateGasGravityAt100psig(
  gasSG: number,
  oilAPI: number,
  separatorTemp: number,
  separatorPressure: number
): number {
  // SPE-6719: gamma_gs = gamma_g * [1 + 0.1595 * API^0.4078 * Tsep^(-0.2466) * log(Psep/114.7)]
  const term1 = 0.1595 * Math.pow(oilAPI, 0.4078);
  const term2 = Math.pow(separatorTemp, -0.2466);
  const term3 = Math.log10((separatorPressure + P_STD) / 114.7);
  return gasSG * (1 + term1 * term2 * term3);
}

// ============================================================================
// SOLUTION GAS-OIL RATIO - Vasquez-Beggs (wellboreMath version)
// ============================================================================

/**
 * Calculate Solution GOR using Vasquez-Beggs (1980) correlation
 * SPE-6719: Correlations for Fluid Physical Property Prediction
 * Uses different coefficients for API > 30 vs API <= 30
 *
 * NOTE: This is the wellboreMath version which takes gauge pressure and
 * corrected gas gravity. For the pvtCorrelations version that takes
 * absolute pressure and raw gas gravity, see calculateRsVasquezBeggs.
 *
 * @param pressure - Pressure (psig)
 * @param temperature - Temperature (degrees F)
 * @param oilAPI - Oil API gravity
 * @param gasGravityAt100 - Gas gravity corrected to 100 psig
 * @returns Solution GOR (scf/stb)
 */
export function calculateSolutionGOR(
  pressure: number,
  temperature: number,
  oilAPI: number,
  gasGravityAt100: number
): number {
  // Pressure in psia
  const P = pressure + P_STD;
  const T = temperature; // degrees F

  if (oilAPI > 30) {
    // API > 30 coefficients (Vasquez-Beggs 1980, SPE-6719)
    const term1 = 0.0315 * Math.pow(gasGravityAt100, 0.7587);
    const term2 = Math.pow(P, 1.0937);
    const term3 = Math.pow(10, (11.289 * oilAPI) / (T + RANKINE_OFFSET));
    return term1 * term2 * term3;
  } else {
    // API <= 30 coefficients (Vasquez-Beggs 1980, SPE-6719)
    const term1 = 0.05958 * Math.pow(gasGravityAt100, 0.7972);
    const term2 = Math.pow(P, 1.0014);
    const term3 = Math.pow(10, (13.1405 * oilAPI) / (T + RANKINE_OFFSET));
    return term1 * term2 * term3;
  }
}

/**
 * Calculate solution gas-oil ratio using Vasquez-Beggs correlation.
 * SPE-6719: Same correlation as calculateSolutionGOR but with different
 * parameter convention (absolute pressure, raw gas gravity).
 *
 * Gas gravity correction is applied inline assuming stock-tank separator
 * conditions (Psep = 0 psig), matching calculateGasGravityAt100psig(gg, api, T, 0).
 *
 * Used by getPVTPropertiesAtPressure for multiphase flow calculations.
 *
 * @param pressure - Pressure (psia)
 * @param temperature - Temperature (degrees F)
 * @param api - Oil API gravity
 * @param gasGravity - Gas specific gravity (air = 1.0), raw (not corrected)
 * @returns Solution GOR (scf/stb)
 */
export function calculateRsVasquezBeggs(
  pressure: number,
  temperature: number,
  api: number,
  gasGravity: number
): number {
  // Apply gas gravity correction to 100 psig (same as calculateGasGravityAt100psig with Psep=0)
  const correctedGg = calculateGasGravityAt100psig(gasGravity, api, temperature, 0);

  if (api > 30) {
    // API > 30 coefficients (Vasquez-Beggs 1980, SPE-6719)
    const term1 = 0.0315 * Math.pow(correctedGg, 0.7587);
    const term2 = Math.pow(pressure, 1.0937);
    const term3 = Math.pow(10, (11.289 * api) / (temperature + RANKINE_OFFSET));
    return term1 * term2 * term3;
  } else {
    // API <= 30 coefficients (Vasquez-Beggs 1980, SPE-6719)
    const term1 = 0.05958 * Math.pow(correctedGg, 0.7972);
    const term2 = Math.pow(pressure, 1.0014);
    const term3 = Math.pow(10, (13.1405 * api) / (temperature + RANKINE_OFFSET));
    return term1 * term2 * term3;
  }
}

// ============================================================================
// BUBBLE POINT PRESSURE
// ============================================================================

/**
 * McCain et al. (2011) correlation coefficients for bubble point pressure.
 * Reference: McCain, W.D., et al. (2011). "The Properties of Petroleum Fluids"
 */
const MCCAIN_PB_COEFFICIENTS = [
  { C0: -5.48, C1: -0.0378, C2: 0.281, C3: -0.0206 },     // n=1: ln(Rsb)
  { C0: 1.27, C1: -0.0449, C2: 4.36e-4, C3: -4.76e-6 },   // n=2: API
  { C0: 4.51, C1: -10.84, C2: 8.39, C3: -2.34 },          // n=3: gamma_gSP
  { C0: -0.7835, C1: 6.23e-3, C2: -1.22e-5, C3: 1.03e-8 }, // n=4: TR
];

/**
 * Calculate bubble point pressure using McCain et al. (2011) correlation.
 * ln(Pb) = 7.475 + 0.713*Z + 0.0075*Z^2
 */
function calculateBubblePointMcCain(
  gor: number,
  temperature: number,
  oilAPI: number,
  gasGravityAt100: number
): number {
  const VAR = [
    Math.log(Math.max(gor, 10)),  // VAR1 = ln(Rsb), min 10 to avoid log(0)
    oilAPI,                        // VAR2 = API
    gasGravityAt100,               // VAR3 = gamma_gSP (separator gas gravity)
    temperature,                   // VAR4 = TR (degrees F)
  ];

  let Z = 0;
  for (let n = 0; n < 4; n++) {
    const coeff = MCCAIN_PB_COEFFICIENTS[n];
    const v = VAR[n];
    const Zn = coeff.C0 + coeff.C1 * v + coeff.C2 * v * v + coeff.C3 * v * v * v;
    Z += Zn;
  }

  const lnPb = 7.475 + 0.713 * Z + 0.0075 * Z * Z;
  return Math.exp(lnPb);
}

/**
 * Calculate bubble point pressure using inverse Vasquez-Beggs (1980) correlation.
 * SPE-6719: Correlations for Fluid Physical Property Prediction
 */
function calculateBubblePointVasquezBeggs(
  gor: number,
  temperature: number,
  oilAPI: number,
  gasGravityAt100: number
): number {
  const T = temperature;

  let Pb: number;
  if (oilAPI > 30) {
    const term1 = 0.0315 * Math.pow(gasGravityAt100, 0.7587);
    const term2 = Math.pow(10, (11.289 * oilAPI) / (T + RANKINE_OFFSET));
    Pb = Math.pow(gor / (term1 * term2), 1 / 1.0937) - P_STD;
  } else {
    const term1 = 0.05958 * Math.pow(gasGravityAt100, 0.7972);
    const term2 = Math.pow(10, (13.1405 * oilAPI) / (T + RANKINE_OFFSET));
    Pb = Math.pow(gor / (term1 * term2), 1 / 1.0014) - P_STD;
  }

  return Math.max(0, Pb);
}

/**
 * Calculate bubble point pressure using Standing (1947) correlation.
 * Pb = 18.2 * ((Rs/Yg)^0.83 * 10^(0.00091*T - 0.0125*API) - 1.4)
 *
 * @param rsb - Solution GOR at bubble point (scf/stb)
 * @param api - Oil API gravity
 * @param gasGravity - Gas specific gravity (air = 1.0)
 * @param temperature - Temperature (degrees F)
 * @returns Bubble point pressure (psia)
 */
export function calculateBubblePointStanding(
  rsb: number,
  api: number,
  gasGravity: number,
  temperature: number
): number {
  const ratio = Math.pow(rsb / gasGravity, 0.83);
  const exponent = 0.00091 * temperature - 0.0125 * api;
  const Pb = 18.2 * (ratio * Math.pow(10, exponent) - 1.4);
  return Math.max(14.696, Pb);
}

/**
 * Calculate bubble point pressure using Velarde, Blasingame & McCain (1997) correlation.
 * Complex formula with rsb_lim clamp and psc = 14.696.
 *
 * @param rsb - Solution GOR at bubble point (scf/stb)
 * @param api - Oil API gravity
 * @param gasGravity - Gas specific gravity (air = 1.0)
 * @param temperature - Temperature (degrees F)
 * @returns Bubble point pressure (psia)
 */
export function calculateBubblePointVelarde(
  rsb: number,
  api: number,
  gasGravity: number,
  temperature: number
): number {
  const psc = 14.696;
  const x = 0.013098 * Math.pow(temperature, 0.282372) - 8.2e-6 * Math.pow(api, 2.176124);
  const rsbLim = Math.pow(0.740152 / (Math.pow(gasGravity, -0.161488) * Math.pow(10, x)), 1 / 0.081465);

  const safeRsb = rsb < rsbLim + 1e-6 ? rsbLim + 1e-6 : rsb;

  const inner = Math.pow(safeRsb, 0.081465) * Math.pow(gasGravity, -0.161488) * Math.pow(10, x) - 0.740152;
  const Pb = 1091.47 * Math.pow(Math.max(0, inner), 5.354891) + psc;
  return Math.max(psc, Pb);
}

/**
 * Calculate Bubble Point Pressure using selected correlation method.
 *
 * @param gor - Gas-Oil Ratio (scf/stb)
 * @param temperature - Temperature (degrees F)
 * @param oilAPI - Oil API gravity
 * @param gasGravityAt100 - Gas gravity at 100 psig
 * @param method - Correlation method (default: 'vasquez-beggs' for Excel compatibility)
 * @returns Bubble point pressure (psia)
 */
export function calculateBubblePoint(
  gor: number,
  temperature: number,
  oilAPI: number,
  gasGravityAt100: number,
  method: PbCorrelation = 'vasquez-beggs'
): number {
  // Apply input guards
  const safeGor = Math.max(gor, 10);
  const safeApi = Math.max(10, Math.min(oilAPI, 60));
  const safeGg = Math.max(0.5, Math.min(gasGravityAt100, 1.5));
  const safeT = Math.max(60, Math.min(temperature, 400));

  let Pb: number;
  if (method === 'standing') {
    Pb = calculateBubblePointStanding(safeGor, safeApi, safeGg, safeT);
  } else if (method === 'velarde') {
    Pb = calculateBubblePointVelarde(safeGor, safeApi, safeGg, safeT);
  } else if (method === 'mccain' || method === 'valko-mccain') {
    Pb = calculateBubblePointMcCain(safeGor, safeT, safeApi, safeGg);
  } else {
    Pb = calculateBubblePointVasquezBeggs(safeGor, safeT, safeApi, safeGg);
  }

  // Only apply lower bound (100 psia minimum for numerical stability)
  // No upper cap - return actual calculated value for engineering assessment
  return Math.max(100, Pb);
}

/**
 * Calculate bubble point pressure using selected correlation method.
 * Same as calculateBubblePoint but with different parameter naming convention
 * for backward compatibility with pvtCorrelations.ts consumers.
 *
 * @param rsb - Total GOR at bubble point (scf/stb)
 * @param api - Oil API gravity
 * @param gasGravity - Gas specific gravity (air = 1.0)
 * @param temperature - Temperature (degrees F)
 * @param method - Correlation method (default: 'vasquez-beggs')
 * @returns Bubble point pressure (psia)
 */
export function calculateBubblePointPressure(
  rsb: number,
  api: number,
  gasGravity: number,
  temperature: number,
  method: PbCorrelation = 'vasquez-beggs'
): number {
  return calculateBubblePoint(rsb, temperature, api, gasGravity, method);
}

// ============================================================================
// OIL COMPRESSIBILITY
// ============================================================================

/**
 * Calculate isothermal oil compressibility using Vasquez-Beggs (1980)
 * SPE-6719
 * co = 10^(0.83415 + 0.5002*log(Rs) + 0.3613*log(API) + 0.7606*log(T) - 0.35505*log(gamma_g)) / P * 10^-6
 *
 * This is the wellboreMath version used for wellbore potential calculations.
 *
 * @param gor - Gas-Oil Ratio (scf/stb)
 * @param oilAPI - Oil API gravity
 * @param temperature - Temperature (degrees F)
 * @param pressure - Pressure (psig)
 * @param gasGravityAt100 - Gas gravity corrected to 100 psig (optional, default 0.7)
 * @returns Oil compressibility (1/psi)
 */
export function calculateOilCompressibility(
  gor: number,
  oilAPI: number,
  temperature: number,
  pressure: number,
  gasGravityAt100?: number
): number {
  const P = pressure + P_STD;
  const gamma = gasGravityAt100 ?? 0.7;

  const exponent =
    0.83415 +
    0.5002 * Math.log10(gor) +
    0.3613 * Math.log10(oilAPI) +
    0.7606 * Math.log10(temperature) -
    0.35505 * Math.log10(gamma);

  return (Math.pow(10, exponent) / P) * 1e-6;
}

/**
 * Calculate isothermal oil compressibility using McCain, Rollins,
 * Villena-Lanzi (1988) Eq 3.13 polynomial correlation.
 * Used for undersaturated oil (P > Pb) in multiphase flow calculations.
 *
 * Phase 8 Audit (08-03): Replaced simple closed-form with Eq 3.13
 * polynomial matching pyrestoolbox implementation. Previous closed-form
 * produced values 6-14x lower than pyrestoolbox across test conditions.
 *
 * @param pressure - Current pressure (psia)
 * @param bubblePointPressure - Bubble point pressure (psia)
 * @param temperature - Temperature (degrees F)
 * @param api - Oil API gravity
 * @param rsb - Solution GOR at bubble point (scf/stb)
 * @param gasGravitySep - Separator gas gravity (default 0.7)
 * @returns Oil compressibility (psi^-1)
 */
export function calculateOilCompressibilityMcCain(
  pressure: number,
  bubblePointPressure: number,
  temperature: number,
  api: number,
  rsb: number,
  gasGravitySep?: number
): number {
  const safeP = Math.max(pressure, MIN_PRESSURE);
  const safePb = Math.max(bubblePointPressure, MIN_PRESSURE);
  const safeT = Math.max(temperature, 60);
  const safeApi = Math.max(api, 10);
  const safeRsb = Math.max(rsb, MIN_RSB);
  const sgSp = gasGravitySep ?? 0.7;

  // McCain, Rollins, Villena-Lanzi (1988) Eq 3.13
  // Polynomial coefficients [constant, linear, quadratic] for each variable
  const C = [
    [3.011, -0.0835, 3.51, 0.327, -1.918, 2.52],
    [-2.6254, -0.259, -0.0289, -0.608, -0.642, -2.73],
    [0.497, 0.382, -0.0584, 0.0911, 0.154, 0.429],
  ];

  const vars = [
    Math.log(safeApi),
    Math.log(sgSp),
    Math.log(safePb),
    Math.log(safeP / safePb),
    Math.log(safeRsb),
    Math.log(safeT),
  ];

  let Zp = 0;
  for (let n = 0; n < 6; n++) {
    const v = vars[n];
    // Zn = C[0][n]*v^0 + C[1][n]*v^1 + C[2][n]*v^2 (pyrestoolbox convention)
    Zp += C[0][n] + C[1][n] * v + C[2][n] * v * v;
  }

  const lnCo = 2.434 + 0.475 * Zp + 0.048 * Zp * Zp - Math.log(1e6);
  const co = Math.exp(lnCo);

  return Math.max(5e-7, Math.min(co, 1e-3));
}

// ============================================================================
// OIL COMPRESSIBILITY - NUMERICAL DERIVATIVE (EXPLT METHOD)
// ============================================================================

/**
 * Calculate oil compressibility using numerical derivative (EXPLT method).
 * Matches pyRestToolbox v3.0 oil_co() approach:
 *   Co = -1/Bo * [dBo/dp - Bg * dRs/dp]
 *
 * Uses central difference with dp = max(0.5, P * 0.001).
 * For undersaturated (P > Pb): dRs/dp = 0, Bo perturbation via Eq 3.13 + exponential.
 * For saturated (P < Pb): both dBo/dp and dRs/dp are non-zero.
 * Near bubble point: one-sided derivative to avoid crossing saturation boundary.
 *
 * @param pressure - Current pressure (psia)
 * @param temperature - Temperature (degrees F)
 * @param api - Oil API gravity
 * @param gasGravity - Gas specific gravity (air = 1.0)
 * @param totalGOR - Total producing GOR in scf/stb (Rsb at bubble point)
 * @param pbCorrelation - Bubble point correlation method (default: 'vasquez-beggs')
 * @returns Oil compressibility (psi^-1)
 */
export function calculateOilCompressibilityNumerical(
  pressure: number,
  temperature: number,
  api: number,
  gasGravity: number,
  totalGOR: number,
  pbCorrelation: PbCorrelation = 'vasquez-beggs'
): number {
  const rsb = Math.max(totalGOR, MIN_RSB);
  const Pb = calculateBubblePointPressure(rsb, api, gasGravity, temperature, pbCorrelation);
  const dp = Math.max(0.5, pressure * 0.001);

  let dBo_dp: number;
  let dRs_dp: number;
  let Bo: number;

  if (pressure > Pb) {
    dRs_dp = 0;
    const bob = calculateBoVasquezBeggs(rsb, temperature, api, gasGravity);

    const coPPlus = calculateOilCompressibilityMcCain(pressure + dp, Pb, temperature, api, rsb, gasGravity);
    const boPlus = calculateUndersaturatedBo(pressure + dp, Pb, bob, coPPlus);

    const coPMinus = calculateOilCompressibilityMcCain(pressure - dp, Pb, temperature, api, rsb, gasGravity);
    const boMinus = calculateUndersaturatedBo(pressure - dp, Pb, bob, coPMinus);

    dBo_dp = (boPlus - boMinus) / (2 * dp);

    const coAtP = calculateOilCompressibilityMcCain(pressure, Pb, temperature, api, rsb, gasGravity);
    Bo = calculateUndersaturatedBo(pressure, Pb, bob, coAtP);
  } else if (pressure + dp > Pb) {
    const rsAtP = calculateRsVasquezBeggs(pressure, temperature, api, gasGravity);
    const rsMinus = calculateRsVasquezBeggs(pressure - dp, temperature, api, gasGravity);
    const boAtP = calculateBoVasquezBeggs(rsAtP, temperature, api, gasGravity);
    const boMinusV = calculateBoVasquezBeggs(rsMinus, temperature, api, gasGravity);

    dBo_dp = (boAtP - boMinusV) / dp;
    dRs_dp = (rsAtP - rsMinus) / dp;
    Bo = boAtP;
  } else if (pressure - dp < P_STD) {
    const rsAtP = calculateRsVasquezBeggs(pressure, temperature, api, gasGravity);
    const rsPlus = calculateRsVasquezBeggs(pressure + dp, temperature, api, gasGravity);
    const boAtP = calculateBoVasquezBeggs(rsAtP, temperature, api, gasGravity);
    const boPlusV = calculateBoVasquezBeggs(rsPlus, temperature, api, gasGravity);

    dBo_dp = (boPlusV - boAtP) / dp;
    dRs_dp = (rsPlus - rsAtP) / dp;
    Bo = boAtP;
  } else {
    const rsPlus = calculateRsVasquezBeggs(pressure + dp, temperature, api, gasGravity);
    const rsMinus = calculateRsVasquezBeggs(pressure - dp, temperature, api, gasGravity);
    const boPlusV = calculateBoVasquezBeggs(rsPlus, temperature, api, gasGravity);
    const boMinusV = calculateBoVasquezBeggs(rsMinus, temperature, api, gasGravity);

    dBo_dp = (boPlusV - boMinusV) / (2 * dp);
    dRs_dp = (rsPlus - rsMinus) / (2 * dp);
    Bo = calculateBoVasquezBeggs(
      calculateRsVasquezBeggs(pressure, temperature, api, gasGravity),
      temperature, api, gasGravity
    );
  }

  const pressurePsig = pressure - P_STD;
  const zResult = calculateFullZFactor(pressurePsig, temperature, gasGravity);
  const BgCf = calculateGasFVF(pressurePsig, temperature, zResult.Z);
  const BgBbl = BgCf / 5.6146;

  const Co = Math.abs((-1 / Bo) * (dBo_dp - BgBbl * dRs_dp));
  return Math.max(1e-7, Math.min(Co, 1e-3));
}

// ============================================================================
// OIL DENSITY - STANDING-WITTE-MCCAIN-HILL (SWMH)
// ============================================================================

/**
 * Calculate oil density using Standing-Witte-McCain-Hill (1995) method.
 * Eqs 3.18a-3.18g + 3.19d-3.19g from McCain textbook.
 * Matches pyRestToolbox v3.0 oil_deno() SWMH approach.
 *
 * @param pressure - Current pressure (psia)
 * @param temperature - Temperature (degrees F)
 * @param api - Oil API gravity
 * @param gasGravity - Gas specific gravity (air = 1.0)
 * @param rs - Solution GOR at current pressure (scf/stb)
 * @param pb - Bubble point pressure (psia)
 * @param co - Oil compressibility (psi^-1), computed from Eq 3.13 if not provided
 * @returns Oil density (lb/ft3)
 */
export function calculateOilDensitySWMH(
  pressure: number,
  temperature: number,
  api: number,
  gasGravity: number,
  rs: number,
  pb: number,
  co?: number
): number {
  const sgO = 141.5 / (131.5 + api);
  const rhoa = 38.52 * Math.pow(10, -0.00326 * api) +
    (94.75 - 33.93 * Math.log10(api)) * Math.log10(gasGravity);
  const rhoPo = (rs * gasGravity + 4600 * sgO) / (73.71 + rs * gasGravity / rhoa);

  const pCalc = Math.min(pressure, pb);
  const dRhoP = (0.167 + 16.181 * Math.pow(10, -0.0425 * rhoPo)) * (pCalc / 1000) -
    0.01 * (0.299 + 263 * Math.pow(10, -0.0603 * rhoPo)) * Math.pow(pCalc / 1000, 2);
  const rhoBs = rhoPo + dRhoP;

  const dRhoT = (0.00302 + 1.505 * Math.pow(rhoBs, -0.951)) * Math.pow(temperature - 60, 0.938) -
    (0.0216 - 0.0233 * Math.pow(10, -0.0161 * rhoBs)) * Math.pow(temperature - 60, 0.475);
  const rhoOr = rhoBs - dRhoT;

  let rho: number;
  if (pressure > pb) {
    const coVal = co ?? calculateOilCompressibilityMcCain(pressure, pb, temperature, api, rs, gasGravity);
    rho = rhoOr * Math.exp(coVal * (pressure - pb));
  } else {
    rho = rhoOr;
  }

  return Math.max(30, Math.min(rho, 70));
}

// ============================================================================
// FORMATION VOLUME FACTORS
// ============================================================================

/**
 * Calculate Oil FVF at bubble point using Vasquez-Beggs (1980)
 * SPE-6719
 * Bob = 0.98496 + 0.0001 * (Rs^0.755 * gamma_gs^0.25 * (141.5/(131.5+API))^(-1.5) + 0.45 * T)^1.5
 */
export function calculateOilFVFAtBubblePoint(
  solutionGOR: number,
  gasGravityAt100: number,
  oilAPI: number,
  temperature: number
): number {
  const oilSG = 141.5 / (131.5 + oilAPI);
  const innerTerm =
    Math.pow(solutionGOR, 0.755) *
    Math.pow(gasGravityAt100, 0.25) *
    Math.pow(oilSG, -1.5) +
    0.45 * temperature;
  return 0.98496 + 0.0001 * Math.pow(innerTerm, 1.5);
}

/**
 * Calculate Oil FVF at pressure below bubble point
 * Bo = Bob * exp(co * (Pb - P))
 */
export function calculateOilFVFAtPressure(
  oilFVFAtBubblePoint: number,
  oilCompressibility: number,
  bubblePoint: number,
  pressure: number
): number {
  const Pb = bubblePoint + P_STD;
  const P = pressure + P_STD;
  return oilFVFAtBubblePoint * Math.exp(oilCompressibility * (Pb - P));
}

/**
 * Calculate Oil FVF (automatically selects above/below bubble point)
 */
export function calculateOilFVF(
  pressure: number,
  bubblePoint: number,
  oilFVFAtBubblePoint: number,
  oilFVFAtPressure: number
): number {
  const P = pressure + P_STD;
  const Pb = bubblePoint + P_STD;
  return Pb > P ? oilFVFAtBubblePoint : oilFVFAtPressure;
}

/**
 * Calculate oil formation volume factor using Vasquez-Beggs correlation.
 * Valid for saturated oil (P <= Pb). This is the pvtCorrelations.ts version.
 *
 * @param rs - Solution GOR (scf/stb)
 * @param temperature - Temperature (degrees F)
 * @param api - Oil API gravity
 * @param gasGravity - Gas specific gravity (air = 1.0)
 * @returns Oil FVF (rb/stb)
 */
export function calculateBoVasquezBeggs(
  rs: number,
  temperature: number,
  api: number,
  gasGravity: number
): number {
  const tempF = temperature;
  const correctedGg = gasGravity;

  if (api <= 30) {
    return 1 + 4.677e-4 * rs + 1.751e-5 * (tempF - 60) * (api / correctedGg) -
           1.811e-8 * rs * (tempF - 60) * (api / correctedGg);
  } else {
    return 1 + 4.67e-4 * rs + 1.1e-5 * (tempF - 60) * (api / correctedGg) +
           1.337e-9 * rs * (tempF - 60) * (api / correctedGg);
  }
}

// ============================================================================
// ALTERNATIVE CORRELATION BACKENDS (Phase 10)
// ============================================================================

/**
 * Calculate solution GOR using Standing (1947) correlation.
 * Rs = gasGravity * ((P/18.2 + 1.4) * 10^(0.0125*API - 0.00091*T))^(1/0.83)
 *
 * @param pressure - Current pressure (psia)
 * @param temperature - Temperature (degrees F)
 * @param api - Oil API gravity
 * @param gasGravity - Gas specific gravity (air = 1.0)
 * @returns Solution GOR (scf/stb)
 */
export function calculateRsStanding(
  pressure: number,
  temperature: number,
  api: number,
  gasGravity: number
): number {
  const inner = pressure / 18.2 + 1.4;
  if (inner <= 0) return 0;
  const exponent = 0.0125 * api - 0.00091 * temperature;
  const Rs = gasGravity * Math.pow(inner * Math.pow(10, exponent), 1 / 0.83);
  return Math.max(0, Rs);
}

/**
 * Calculate solution GOR using Velarde, Blasingame & McCain (1997) correlation.
 * Three coefficient arrays (A, B, C) with reduced pressure formulation.
 *
 * @param pressure - Current pressure (psia)
 * @param temperature - Temperature (degrees F)
 * @param api - Oil API gravity
 * @param gasGravity - Gas specific gravity (air = 1.0)
 * @param bubblePointPressure - Bubble point pressure (psia)
 * @param rsb - Solution GOR at bubble point (scf/stb)
 * @returns Solution GOR (scf/stb)
 */
export function calculateRsVelarde(
  pressure: number,
  temperature: number,
  api: number,
  gasGravity: number,
  bubblePointPressure: number,
  rsb: number
): number {
  if (gasGravity * api * rsb === 0) return 0;

  const psc = 14.696;
  const pb = Math.max(psc, bubblePointPressure);
  const p = Math.max(psc, pressure);

  if (p >= pb) return rsb;

  const A = [9.73e-7, 1.672608, 0.929870, 0.247235, 1.056052];
  const B = [0.022339, -1.004750, 0.337711, 0.132795, 0.302065];
  const C = [0.725167, -1.485480, -0.164741, -0.091330, 0.047094];

  const pbMinusPsc = pb - psc;
  const computeCoeff = (X: number[]) =>
    X[0] * Math.pow(gasGravity, X[1]) * Math.pow(api, X[2]) * Math.pow(temperature, X[3]) * Math.pow(pbMinusPsc, X[4]);

  const a0 = computeCoeff(A);
  const a1 = computeCoeff(B);
  const a2 = computeCoeff(C);

  const pr = (p - psc) / pbMinusPsc;
  const rsr = a0 * Math.pow(pr, a1) + (1 - a0) * Math.pow(pr, a2);

  return Math.max(0, rsb * rsr);
}

/**
 * Calculate oil FVF using McCain density-based method.
 * Bo = (sg_o * 62.372 + 0.01357 * rs * gasGravity) / rho_oil
 *
 * Uses existing calculateOilDensitySWMH for reservoir oil density.
 *
 * @param pressure - Current pressure (psia)
 * @param temperature - Temperature (degrees F)
 * @param api - Oil API gravity
 * @param gasGravity - Gas specific gravity (air = 1.0)
 * @param rs - Solution GOR at current pressure (scf/stb)
 * @param bubblePointPressure - Bubble point pressure (psia)
 * @returns Oil FVF (rb/stb)
 */
export function calculateBoMcCain(
  pressure: number,
  temperature: number,
  api: number,
  gasGravity: number,
  rs: number,
  bubblePointPressure: number
): number {
  const sgO = 141.5 / (131.5 + api);
  const rhoOil = calculateOilDensitySWMH(pressure, temperature, api, gasGravity, rs, bubblePointPressure);
  const Bo = (sgO * 62.372 + 0.01357 * rs * gasGravity) / rhoOil;
  return Math.max(1.0, Bo);
}

/**
 * Solve Z-factor using Wang-Ye-Wu (WYW) explicit rational polynomial.
 * 20 coefficients (1-indexed), no iteration needed.
 * Applicable range: 0.2 < Ppr < 30, 1.05 < Tpr < 3.0.
 *
 * @param Ppr - Pseudo-reduced pressure (dimensionless)
 * @param Tpr - Pseudo-reduced temperature (dimensionless)
 * @returns Z-factor (dimensionless)
 */
export function solveZFactorWangYeWu(Ppr: number, Tpr: number): number {
  const a = [0,
    256.41675, 7.18202, -178.5725, 182.98704, -40.74427, 2.24427,
    47.44825, 5.2852, -0.14914, 271.50446, 16.2694, -121.51728,
    167.71477, -81.73093, 20.36191, -2.1177, 124.64444, -6.74331,
    0.20897, -0.00314
  ];

  const Ppr2 = Ppr * Ppr;
  const Ppr3 = Ppr2 * Ppr;
  const Ppr4 = Ppr3 * Ppr;
  const Tpr2 = Tpr * Tpr;
  const Tpr3 = Tpr2 * Tpr;
  const Tpr4 = Tpr3 * Tpr;
  const Tpr5 = Tpr4 * Tpr;

  const num = a[1] +
    a[2] * (1 + a[3] * Tpr + a[4] * Tpr2 + a[5] * Tpr3 + a[6] * Tpr4) * Ppr +
    a[7] * Ppr2 + a[8] * Ppr3 + a[9] * Ppr4;

  const den = a[10] +
    a[11] * (1 + a[12] * Tpr + a[13] * Tpr2 + a[14] * Tpr3 + a[15] * Tpr4 + a[16] * Tpr5) * Ppr +
    a[17] * Ppr2 + a[18] * Ppr3 + a[19] * Ppr4 + a[20] * Ppr * Ppr4;

  const Z = num / den;
  return Math.max(0.1, Math.min(Z, 3.0));
}

/**
 * Solve Z-factor using Hall-Yarborough (1973) method.
 * Newton-Raphson on reduced density y. Uses WYW as initial guess.
 * Max 100 iterations, tol=0.0005. Clips y to [1e-10, 0.99].
 *
 * @param Ppr - Pseudo-reduced pressure (dimensionless)
 * @param Tpr - Pseudo-reduced temperature (dimensionless)
 * @returns Z-factor (dimensionless)
 */
export function solveZFactorHallYarborough(Ppr: number, Tpr: number): number {
  const tprInv = 1 / Tpr;
  const t2 = tprInv * tprInv;

  const a = 0.06125 * tprInv * Math.exp(-1.2 * Math.pow(1 - tprInv, 2));
  const b = tprInv * (14.76 - 9.76 * tprInv + 4.58 * t2);
  const c = tprInv * (90.7 - 242.2 * tprInv + 42.4 * t2);
  const D = 2.18 + 2.82 * tprInv;

  const zInit = solveZFactorWangYeWu(Ppr, Tpr);
  let y = a * Ppr / zInit;
  y = Math.max(1e-10, Math.min(y, 0.99));

  for (let iter = 0; iter < 100; iter++) {
    const ySafe = Math.max(1e-10, Math.min(y, 0.99));
    const omy = 1 - ySafe;
    const omy3 = omy * omy * omy;
    const omy4 = omy3 * omy;
    const y2 = ySafe * ySafe;
    const y3 = y2 * ySafe;
    const y4 = y3 * ySafe;

    const f = (ySafe + y2 + y3 - y4) / omy3
      - a * Ppr
      - b * y2
      + c * Math.pow(ySafe, D);

    const df = (1 + 4 * ySafe + 4 * y2 - 4 * y3 + y4) / omy4
      - 2 * b * ySafe
      + c * D * Math.pow(ySafe, D - 1);

    if (Math.abs(df) < 1e-30) break;

    const yNew = ySafe - f / df;
    const yClamp = Math.max(1e-10, yNew);

    const relErr = Math.abs(yClamp - ySafe) / Math.max(Math.abs(ySafe), 1e-10);
    y = yClamp;

    if (relErr <= 0.0005) break;
  }

  const Z = a * Ppr / Math.max(y, 1e-10);
  return Math.max(0.1, Math.min(Z, 3.0));
}

/**
 * Calculate gas viscosity using Lee-Gonzalez-Eakin (1966) correlation.
 * ug = a * 0.0001 * exp(b * rho^c)
 *
 * @param pressure - Pressure (psia)
 * @param temperature - Temperature (degrees F)
 * @param gasGravity - Gas specific gravity (air = 1.0)
 * @param zFactor - Gas compressibility factor (dimensionless)
 * @returns Gas viscosity (cP)
 */
export function calculateGasViscosityLGE(
  pressure: number,
  temperature: number,
  gasGravity: number,
  zFactor: number
): number {
  const T_R = temperature + 459.67;
  const M = 28.97 * gasGravity;
  const rho = (M * pressure) / (T_R * zFactor * 10.732 * 62.37);

  const b = 3.448 + 986.4 / T_R + 0.01009 * M;
  const c = 2.447 - 0.2224 * b;
  const a = (9.379 + 0.01607 * M) * Math.pow(T_R, 1.5) / (209.2 + 19.26 * M + T_R);

  return a * 0.0001 * Math.exp(b * Math.pow(rho, c));
}

/**
 * Calculate undersaturated oil formation volume factor.
 * Uses exponential correction from bubble point.
 *
 * Bo = Bob * exp(co * (Pb - P))
 *
 * @param pressure - Current pressure (psia)
 * @param bubblePointPressure - Bubble point pressure (psia)
 * @param boAtBubblePoint - Bo at bubble point (rb/stb)
 * @param oilCompressibility - Oil compressibility (psi^-1)
 * @returns Undersaturated oil FVF (rb/stb)
 */
export function calculateUndersaturatedBo(
  pressure: number,
  bubblePointPressure: number,
  boAtBubblePoint: number,
  oilCompressibility: number
): number {
  const deltaPressure = bubblePointPressure - pressure;
  const bo = boAtBubblePoint * Math.exp(oilCompressibility * deltaPressure);
  return Math.max(1.0, bo);
}

/**
 * Calculate Water FVF using McCain (1990) correlation
 * Bw = (1 - A) * (1 + B)
 */
export function calculateWaterFVF(pressure: number, temperature: number): number {
  const P = pressure + P_STD;
  const T = temperature;

  const A =
    -1.95301e-9 * P * T -
    1.72834e-13 * Math.pow(P, 2) * T -
    3.58922e-7 * P -
    2.25341e-10 * Math.pow(P, 2);

  const B = -0.010001 + 0.00013391 * T + 5.50654e-7 * Math.pow(T, 2);

  return (1 - A) * (1 + B);
}

// ============================================================================
// SALINITY-CORRECTED BRINE PROPERTIES (Phase 9, Plan 09-03)
// ============================================================================

/**
 * Calculate Water FVF with salinity correction.
 * Base: McCain (1990) fresh water Bw with simplified salinity adjustment.
 * At salinity=0, returns calculateWaterFVF(pressure, temperature) exactly.
 *
 * @param pressure - Pressure (psig)
 * @param temperature - Temperature (degrees F)
 * @param salinity - Salinity in ppm TDS (default 0)
 * @returns Water formation volume factor (rb/stb)
 */
export function calculateWaterFVFWithSalinity(
  pressure: number,
  temperature: number,
  salinity: number
): number {
  const bwFresh = calculateWaterFVF(pressure, temperature);
  if (salinity === 0) return bwFresh;

  const S = salinity / 10000;
  const P = pressure + P_STD;
  const dT = temperature - 60;
  const correction = S * (
    5.1e-8 * P +
    (5.47e-6 - 1.95e-10 * P) * dT -
    (3.23e-8 - 8.5e-13 * P) * dT * dT
  );
  const bwBrine = bwFresh * (1 + correction);
  return Math.max(0.95, Math.min(bwBrine, 1.10));
}

/**
 * Calculate brine density with salinity correction.
 * Base fresh water density at standard conditions: 62.4 lb/ft3.
 * Temperature and salinity corrections applied.
 *
 * @param pressure - Pressure (psia)
 * @param temperature - Temperature (degrees F)
 * @param salinity - Salinity in ppm TDS (default 0)
 * @returns Brine density (lb/ft3)
 */
export function calculateBrineDensity(
  pressure: number,
  temperature: number,
  salinity: number
): number {
  const rhoW = 62.4 * (1 - 3.6e-4 * (temperature - 60));
  const rhoBrine = rhoW * (1 + 0.695e-6 * salinity);
  return Math.max(55, Math.min(rhoBrine, 85));
}

/**
 * Calculate brine viscosity with salinity correction.
 * Base: simplified McCain fresh water viscosity with salinity multiplier.
 *
 * @param temperature - Temperature (degrees F)
 * @param salinity - Salinity in ppm TDS (default 0)
 * @returns Brine viscosity (cp)
 */
export function calculateBrineViscosity(
  temperature: number,
  salinity: number
): number {
  const muW = Math.exp(1.003 - 1.479e-2 * temperature + 1.982e-5 * temperature * temperature);
  const muBrine = muW * (1 + 3.5e-12 * salinity * salinity + 2.5e-7 * salinity);
  return Math.max(0.1, Math.min(muBrine, 10));
}

/**
 * Calculate water compressibility using Osif (1988) correlation.
 * Cw = 1 / (7.033*P + 0.5415*S - 537*T + 403300)
 *
 * Full temperature, pressure, and salinity dependence.
 * Replaces previous pressure-only formula (Phase 9.1 ISSUE-05).
 *
 * @param pressure - Pressure (psia)
 * @param temperature - Temperature (degrees F)
 * @param salinity - Salinity in ppm TDS (mg/L NaCl)
 * @returns Water compressibility (psi^-1)
 */
export function calculateWaterCompressibilityWithSalinity(
  pressure: number,
  temperature: number,
  salinity: number
): number {
  const denominator = 7.033 * pressure + 0.5415 * salinity - 537.0 * temperature + 403300;
  const cw = 1.0 / denominator;
  return Math.max(1e-7, Math.min(cw, 1e-4));
}

/**
 * Calculate Gas FVF
 * Bg = P_ATM * (T + RANKINE_OFFSET) * Z / ((P + P_ATM) * T_STD)
 */
export function calculateGasFVF(
  pressure: number,
  temperature: number,
  zFactor: number
): number {
  const P = pressure + P_STD;
  const T_R = temperature + RANKINE_OFFSET;
  return (P_STD * T_R * zFactor) / (P * T_STD);
}

// ============================================================================
// Z-FACTOR (DRANCHUK-ABOU-KASSEM CORRELATION, SPE-7330)
// ============================================================================
//
// Phase 8 Audit (08-02): Replaced Brill-Beggs explicit formula with proper
// DAK iterative Newton-Raphson solver. Switched pseudocriticals from
// Brill-Beggs to Sutton (SPE-14265) for improved accuracy.
//
// Previous Brill-Beggs explicit had 2-3% error vs DAK across McLaren
// operating conditions (P 500-5000 psia). DAK iterative matches
// hagedornBrown.ts implementation and pyrestoolbox reference values.
//
// The legacy Brill-Beggs helper functions (calculateZFactorA/B/C/D) are
// preserved for UI display of intermediate values but are NOT used for
// the final Z calculation.

import type { ZFactorCalculation } from '../../types/wellbore.js';

// --- Sutton Pseudocritical Properties (SPE-14265) ---

/**
 * Calculate pseudocritical pressure using Sutton (1985) correlation.
 * More accurate than Brill-Beggs across wide gas gravity range.
 *
 * @param gasSG - Gas specific gravity (air = 1.0)
 * @returns Pseudocritical pressure (psia)
 */
export function calculateSuttonPseudoCriticalPressure(gasSG: number): number {
  return 756.8 - 131.0 * gasSG - 3.6 * gasSG * gasSG;
}

/**
 * Calculate pseudocritical temperature using Sutton (1985) correlation.
 *
 * @param gasSG - Gas specific gravity (air = 1.0)
 * @returns Pseudocritical temperature (degrees Rankine)
 */
export function calculateSuttonPseudoCriticalTemperature(gasSG: number): number {
  return 169.2 + 349.5 * gasSG - 74.0 * gasSG * gasSG;
}

// --- Legacy Brill-Beggs Pseudocriticals (kept for backward compat) ---

/** @deprecated Use calculateSuttonPseudoCriticalPressure. Brill-Beggs coefficients. */
export function calculatePseudoCriticalPressure(gasSG: number): number {
  return 706 - 51.7 * gasSG - 11.1 * Math.pow(gasSG, 2);
}

/** @deprecated Use calculateSuttonPseudoCriticalTemperature. Brill-Beggs coefficients. */
export function calculatePseudoCriticalTemperature(gasSG: number): number {
  return 187 + 330 * gasSG - 71.5 * Math.pow(gasSG, 2);
}

// --- Reduced Properties ---

export function calculateReducedPressure(pressure: number, Pc: number): number {
  return (pressure + P_STD) / Pc;
}

export function calculateReducedTemperature(
  temperature: number,
  Tc: number
): number {
  return (temperature + RANKINE_OFFSET) / Tc;
}

// --- Legacy Brill-Beggs Explicit Helpers (display only) ---

/** Brill-Beggs A coefficient. Used for UI display, not Z calculation. */
export function calculateZFactorA(Tr: number): number {
  return 1.39 * Math.sqrt(Tr - 0.92) - 0.36 * Tr - 0.101;
}

/** Brill-Beggs B coefficient. Used for UI display, not Z calculation. */
export function calculateZFactorB(Pr: number, Tr: number): number {
  const term1 = (0.62 - 0.23 * Tr) * Pr;
  const term2 = (0.066 / (Tr - 0.86) - 0.037) * Math.pow(Pr, 2);
  const term3 = (0.32 * Math.pow(Pr, 6)) / Math.pow(10, 9 * (Tr - 1));
  return term1 + term2 + term3;
}

/** Brill-Beggs C coefficient. Used for UI display, not Z calculation. */
export function calculateZFactorC(Tr: number): number {
  return 0.132 - 0.32 * Math.log10(Tr);
}

/** Brill-Beggs D coefficient. Used for UI display, not Z calculation. */
export function calculateZFactorD(Tr: number): number {
  return Math.pow(10, 0.3106 - 0.49 * Tr + 0.1824 * Math.pow(Tr, 2));
}

/**
 * @deprecated Legacy Brill-Beggs explicit Z-factor formula. Not used internally.
 * Kept for backward compatibility. Use calculateFullZFactor for accurate Z.
 */
export function calculateZFactor(A: number, B: number, C: number, D: number, Pr: number): number {
  return A + (1 - A) / Math.exp(B) + C * Math.pow(Pr, D);
}

// --- DAK Iterative Z-Factor Solver ---

/**
 * DAK 11-coefficient equation constants.
 * Reference: Dranchuk & Abou-Kassem, JCPT (July-Sept 1975) 34-36.
 */
const DAK = {
  A1: 0.3265, A2: -1.0700, A3: -0.5339, A4: 0.01569, A5: -0.05165,
  A6: 0.5475, A7: -0.7361, A8: 0.1844, A9: 0.1056, A10: 0.6134, A11: 0.7210,
} as const;

/**
 * Solve for Z-factor using DAK correlation with Newton-Raphson iteration.
 * Converges to machine precision in ~5-10 iterations for typical conditions.
 *
 * @param ppr - Pseudo-reduced pressure (dimensionless)
 * @param tpr - Pseudo-reduced temperature (dimensionless)
 * @returns Z-factor (dimensionless)
 */
function solveZFactorDAK(ppr: number, tpr: number): number {
  const { A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11 } = DAK;

  let z = 1.0;

  for (let iter = 0; iter < 30; iter++) {
    const rhoR = 0.27 * ppr / (z * tpr);
    const rhoR2 = rhoR * rhoR;
    const rhoR5 = rhoR2 * rhoR2 * rhoR;

    const term1 = (A1 + A2 / tpr + A3 / Math.pow(tpr, 3) + A4 / Math.pow(tpr, 4) + A5 / Math.pow(tpr, 5)) * rhoR;
    const term2 = (A6 + A7 / tpr + A8 / (tpr * tpr)) * rhoR2;
    const term3 = A9 * (A7 / tpr + A8 / (tpr * tpr)) * rhoR5;
    const term4 = A10 * (1 + A11 * rhoR2) * (rhoR2 / Math.pow(tpr, 3)) * Math.exp(-A11 * rhoR2);

    const F = z - 1 - term1 - term2 + term3 - term4;

    const drhoR_dz = -0.27 * ppr / (z * z * tpr);

    const dterm1 = (A1 + A2 / tpr + A3 / Math.pow(tpr, 3) + A4 / Math.pow(tpr, 4) + A5 / Math.pow(tpr, 5)) * drhoR_dz;
    const dterm2 = 2 * (A6 + A7 / tpr + A8 / (tpr * tpr)) * rhoR * drhoR_dz;
    const dterm3 = 5 * A9 * (A7 / tpr + A8 / (tpr * tpr)) * rhoR2 * rhoR2 * drhoR_dz;
    const expTerm = Math.exp(-A11 * rhoR2);
    const dterm4 = A10 / Math.pow(tpr, 3) * drhoR_dz * (
      2 * rhoR * (1 + A11 * rhoR2) * expTerm +
      rhoR2 * 2 * A11 * rhoR * expTerm -
      rhoR2 * (1 + A11 * rhoR2) * 2 * A11 * rhoR * expTerm
    );

    const dF = 1 - dterm1 - dterm2 + dterm3 - dterm4;
    const zNew = z - F / dF;

    if (Math.abs(zNew - z) < 1e-10) {
      z = zNew;
      break;
    }

    z = zNew;
    if (z < 0.1) z = 0.1;
    if (z > 3.0) z = 3.0;
  }

  return Math.max(0.3, Math.min(z, 1.5));
}

/**
 * Complete Z-factor calculation with Sutton pseudocritical properties
 * and optional Wichert-Aziz sour gas corrections.
 *
 * Returns ZFactorCalculation with:
 * - Pc, Tc: Pseudocritical properties (Sutton or Wichert-Aziz corrected)
 * - Pr, Tr: Reduced properties
 * - A, B, C, D: Legacy Brill-Beggs display coefficients (not used for Z)
 * - Z: Z-factor from selected method
 *
 * @param pressure - Pressure (psig)
 * @param temperature - Temperature (degrees F)
 * @param gasGravityAt100 - Gas gravity corrected to 100 psig
 * @param yH2S - Mole fraction of H2S (0-1), defaults to 0
 * @param yCO2 - Mole fraction of CO2 (0-1), defaults to 0
 * @param yN2 - Mole fraction of N2 (0-1), defaults to 0
 * @param zMethod - Z-factor correlation method (default: 'dak')
 * @returns Z-factor calculation with all components
 */
export function calculateFullZFactor(
  pressure: number,
  temperature: number,
  gasGravityAt100: number,
  yH2S: number = 0,
  yCO2: number = 0,
  yN2: number = 0,
  zMethod: ZCorrelation = 'dak'
): ZFactorCalculation {
  // Pseudocritical properties with optional sour gas corrections (Phase 9)
  const { ppc: Pc, tpc: Tc } = calculateSourGasPseudocriticals(gasGravityAt100, yH2S, yCO2, yN2);
  const Pr = calculateReducedPressure(pressure, Pc);
  const Tr = calculateReducedTemperature(temperature, Tc);

  // Legacy Brill-Beggs display coefficients (UI shows these)
  const A = calculateZFactorA(Tr);
  const B = calculateZFactorB(Pr, Tr);
  const C = calculateZFactorC(Tr);
  const D = calculateZFactorD(Tr);

  // Z-factor from selected method (Phase 10: added HY and WYW alternatives)
  const Z = zMethod === 'hall-yarborough'
    ? solveZFactorHallYarborough(Pr, Tr)
    : zMethod === 'wang-ye-wu'
    ? solveZFactorWangYeWu(Pr, Tr)
    : solveZFactorDAK(Pr, Tr);

  return { Pc, Tc, Pr, Tr, A, B, C, D, Z };
}

// ============================================================================
// OIL VISCOSITY - Beggs-Robinson (from pvtCorrelations.ts)
// ============================================================================

/**
 * Calculate dead oil viscosity using Beggs-Robinson correlation.
 */
export function calculateDeadOilViscosity(temperature: number, api: number): number {
  const tempF = Math.max(temperature, 70);
  const x = Math.pow(10, 3.0324 - 0.02023 * api);
  const y = Math.pow(tempF, -1.163);
  const muod = Math.pow(10, x * y) - 1;
  return Math.max(0.1, Math.min(muod, 10000));
}

/**
 * Calculate live (saturated) oil viscosity using Beggs-Robinson correlation.
 */
export function calculateLiveOilViscosity(
  deadOilVisc: number,
  rs: number
): number {
  const safeRs = Math.max(rs, 0);
  const a = 10.715 * Math.pow(safeRs + 100, -0.515);
  const b = 5.44 * Math.pow(safeRs + 150, -0.338);
  const muoLive = a * Math.pow(deadOilVisc, b);
  return Math.max(0.1, Math.min(muoLive, 1000));
}

/**
 * Calculate undersaturated oil viscosity using Petrosky-Farshad correlation.
 * A coefficient depends on ln(muob), NOT deltaP.
 *
 * Reference: pyRestToolbox oil_viso() undersaturated branch.
 * A = -1.0146 + 1.3322*ln(muob) - 0.4876*ln(muob)^2 - 1.15036*ln(muob)^3
 * mu = muob + 1.3449e-3 * (P - Pb) * 10^A
 */
export function calculateUndersaturatedViscosity(
  pressure: number,
  bubblePointPressure: number,
  viscosityAtBubblePoint: number
): number {
  const deltaP = pressure - bubblePointPressure;

  if (deltaP <= 0) {
    return viscosityAtBubblePoint;
  }

  const logMuob = Math.log(viscosityAtBubblePoint);
  const A = -1.0146 + 1.3322 * logMuob - 0.4876 * logMuob * logMuob - 1.15036 * logMuob * logMuob * logMuob;
  const muUndersaturated = viscosityAtBubblePoint + 1.3449e-3 * deltaP * Math.pow(10, A);

  return Math.max(viscosityAtBubblePoint, Math.min(muUndersaturated, 1000));
}

// ============================================================================
// OIL VISCOSITY - Beal + Chew-Connally (from OilProperties.xls)
// ============================================================================

/**
 * Calculate dead oil viscosity using Beal (1946) correlation.
 * Reference: OilProperties.xls
 *
 * a = 10^(0.43 + 8.33/API)
 * muod = (0.32 + 1.8e7/API^4.53) * (360/(T+200))^a
 */
export function calculateDeadOilViscosityBeal(temperature: number, api: number): number {
  const tempF = Math.max(temperature, 70);
  const a = Math.pow(10, 0.43 + 8.33 / api);
  const muod = (0.32 + 1.8e7 / Math.pow(api, 4.53)) * Math.pow(360 / (tempF + 200), a);
  return Math.max(0.1, Math.min(muod, 10000));
}

/**
 * Calculate saturated (live) oil viscosity using Chew-Connally (1959) correlation.
 * Reference: OilProperties.xls
 *
 * A = 10^(Rs*(2.2e-7*Rs - 7.4e-4))
 * B = 0.68/10^(8.62e-5*Rs) + 0.25/10^(1.1e-3*Rs) + 0.062/10^(3.74e-3*Rs)
 * muob = A * muod^B
 */
export function calculateSaturatedViscosityChewConnally(deadOilVisc: number, rs: number): number {
  const safeRs = Math.max(rs, 0);
  const A = Math.pow(10, safeRs * (2.2e-7 * safeRs - 7.4e-4));
  const B = 0.68 / Math.pow(10, 8.62e-5 * safeRs) + 0.25 / Math.pow(10, 1.1e-3 * safeRs) + 0.062 / Math.pow(10, 3.74e-3 * safeRs);
  const muob = A * Math.pow(deadOilVisc, B);
  return Math.max(0.1, Math.min(muob, 1000));
}

/**
 * Calculate undersaturated oil viscosity using Beal modified correlation.
 * Reference: OilProperties.xls (with corrected coefficient 0.038, not 0.38)
 *
 * mu = muob + 0.001*(P-Pb)*(0.024*muob^1.6 + 0.038*muob^0.56)
 */
export function calculateUndersaturatedViscosityBeal(
  pressure: number,
  bubblePointPressure: number,
  viscosityAtBubblePoint: number
): number {
  const deltaP = pressure - bubblePointPressure;
  if (deltaP <= 0) return viscosityAtBubblePoint;
  const mu = viscosityAtBubblePoint + 0.001 * deltaP * (
    0.024 * Math.pow(viscosityAtBubblePoint, 1.6) + 0.038 * Math.pow(viscosityAtBubblePoint, 0.56)
  );
  return Math.max(viscosityAtBubblePoint, Math.min(mu, 1000));
}

// ============================================================================
// MAIN ENTRY POINT (from pvtCorrelations.ts)
// ============================================================================

/**
 * Get complete PVT properties at a given pressure with bubble point awareness.
 *
 * @param pressure - Current pressure (psia)
 * @param temperature - Temperature (degrees F)
 * @param api - Oil API gravity
 * @param gasGravity - Gas specific gravity (air = 1.0)
 * @param totalGOR - Total producing GOR in scf/stb (this is Rsb at bubble point)
 * @param config - Optional PVT configuration (correlation methods, sour gas, salinity)
 * @returns Complete PVT properties with saturation state
 */
export function getPVTPropertiesAtPressure(
  pressure: number,
  temperature: number,
  api: number,
  gasGravity: number,
  totalGOR: number,
  config?: PVTConfig
): PVTProperties {
  const {
    pbCorrelation = 'vasquez-beggs',
    rsMethod = 'vasquez-beggs',
    boMethod = 'vasquez-beggs',
    zMethod = 'dak',
    viscosityMethod = 'beggs-robinson',
    yH2S = 0,
    yCO2 = 0,
    yN2 = 0,
    salinity = 0,
  } = config ?? {};

  const rsb = Math.max(totalGOR, MIN_RSB);
  const Pb = calculateBubblePointPressure(rsb, api, gasGravity, temperature, pbCorrelation);

  const isSaturated = pressure < Pb;
  const deadOilViscosity = calculateDeadOilViscosity(temperature, api);

  const pressurePsig = pressure - P_STD;
  const zResult = calculateFullZFactor(pressurePsig, temperature, gasGravity, yH2S, yCO2, yN2, zMethod);
  const zFactor = zResult.Z;
  const gasFVF = calculateGasFVF(pressurePsig, temperature, zFactor);
  const gasViscosity = calculateGasViscosityLGE(pressure, temperature, gasGravity, zFactor);

  const waterFVF = salinity > 0
    ? calculateWaterFVFWithSalinity(pressurePsig, temperature, salinity)
    : calculateWaterFVF(pressurePsig, temperature);
  const waterDensity = salinity > 0 ? calculateBrineDensity(pressure, temperature, salinity) : undefined;
  const waterViscosity = calculateBrineViscosity(temperature, salinity);
  const waterCompressibility = salinity > 0
    ? calculateWaterCompressibilityWithSalinity(pressure, temperature, salinity)
    : undefined;

  // Dispatch maps for method selection (defined inside function for closure access to Pb, rsb)
  const calcRs = (p: number): number => {
    const RS_DISPATCH: Record<RsCorrelation, () => number> = {
      'vasquez-beggs': () => calculateRsVasquezBeggs(p, temperature, api, gasGravity),
      'standing': () => calculateRsStanding(p, temperature, api, gasGravity),
      'velarde': () => calculateRsVelarde(p, temperature, api, gasGravity, Pb, rsb),
    };
    return RS_DISPATCH[rsMethod]();
  };

  const calcBo = (p: number, rs: number): number => {
    const BO_DISPATCH: Record<BoCorrelation, () => number> = {
      'vasquez-beggs': () => calculateBoVasquezBeggs(rs, temperature, api, gasGravity),
      'standing': () => calculateOilFVFAtBubblePoint(rs, gasGravity, api, temperature),
      'mccain': () => calculateBoMcCain(p, temperature, api, gasGravity, rs, Pb),
    };
    return BO_DISPATCH[boMethod]();
  };

  const calcDeadOilVisc = (): number => {
    const DEAD_OIL_DISPATCH: Record<ViscosityCorrelation, () => number> = {
      'beggs-robinson': () => deadOilViscosity,
      'beal-chew-connally': () => calculateDeadOilViscosityBeal(temperature, api),
    };
    return DEAD_OIL_DISPATCH[viscosityMethod]();
  };

  const calcSaturatedVisc = (muod: number, rs: number): number => {
    const SAT_VISC_DISPATCH: Record<ViscosityCorrelation, () => number> = {
      'beggs-robinson': () => calculateLiveOilViscosity(muod, rs),
      'beal-chew-connally': () => calculateSaturatedViscosityChewConnally(muod, rs),
    };
    return SAT_VISC_DISPATCH[viscosityMethod]();
  };

  const calcUndersatVisc = (pBubble: number, muob: number): number => {
    const UNDERSAT_VISC_DISPATCH: Record<ViscosityCorrelation, () => number> = {
      'beggs-robinson': () => calculateUndersaturatedViscosity(pressure, pBubble, muob),
      'beal-chew-connally': () => calculateUndersaturatedViscosityBeal(pressure, pBubble, muob),
    };
    return UNDERSAT_VISC_DISPATCH[viscosityMethod]();
  };

  if (isSaturated) {
    const rs = calcRs(pressure);
    const bo = calcBo(pressure, rs);
    const muod = calcDeadOilVisc();
    const oilViscosity = calcSaturatedVisc(muod, rs);

    const co = calculateOilCompressibilityNumerical(pressure, temperature, api, gasGravity, totalGOR, pbCorrelation);
    const oilDensity = calculateOilDensitySWMH(pressure, temperature, api, gasGravity, rs, Pb);

    return {
      rs,
      bo,
      oilViscosity,
      deadOilViscosity,
      bubblePointPressure: Pb,
      isSaturated: true,
      oilCompressibility: co,
      oilDensity,
      waterFVF,
      waterDensity,
      waterViscosity,
      waterCompressibility,
      gasFVF,
      zFactor,
      gasViscosity,
    };
  } else {
    const rs = rsb;
    const boAtBubblePoint = calcBo(Pb, rsb);
    const muod = calcDeadOilVisc();
    const muob = calcSaturatedVisc(muod, rsb);
    const oilViscosity = calcUndersatVisc(Pb, muob);

    const co = calculateOilCompressibilityNumerical(pressure, temperature, api, gasGravity, totalGOR, pbCorrelation);
    const bo = calculateUndersaturatedBo(pressure, Pb, boAtBubblePoint, co);
    const oilDensity = calculateOilDensitySWMH(pressure, temperature, api, gasGravity, rs, Pb, co);

    return {
      rs,
      bo,
      oilViscosity,
      deadOilViscosity,
      bubblePointPressure: Pb,
      isSaturated: false,
      oilCompressibility: co,
      oilDensity,
      waterFVF,
      waterDensity,
      waterViscosity,
      waterCompressibility,
      gasFVF,
      zFactor,
      gasViscosity,
    };
  }
}

/**
 * Calculate total GOR (Rsb) from flow conditions.
 */
export function calculateTotalGOR(
  gasRate: number,
  liquidRate: number,
  waterCut: number
): number {
  const oilRate = liquidRate * (1 - waterCut);
  if (oilRate <= 0) {
    return MIN_RSB;
  }
  const totalGOR = (gasRate * 1000) / oilRate;
  return Math.max(totalGOR, MIN_RSB);
}

// ============================================================================
// PVT VALIDATION WARNINGS (from pvtCorrelations.ts)
// ============================================================================

function createWarning(
  code: PVTWarningCode,
  severity: PVTWarningSeverity,
  message: string,
  value: number,
  threshold: number,
  recommendation?: string
): PVTWarning {
  return { code, severity, message, value, threshold, recommendation };
}

function getGORCategory(api: number): keyof typeof TYPICAL_GOR_RANGES {
  if (api < 22) return 'heavy';
  if (api < 31) return 'medium';
  if (api < 40) return 'light';
  return 'condensate';
}

export function validateBubblePointPressure(bubblePoint: number): PVTWarning[] {
  const warnings: PVTWarning[] = [];

  if (bubblePoint > 15000) {
    warnings.push(createWarning(
      'PB_VERY_HIGH',
      'critical',
      `Bubble point pressure of ${bubblePoint.toFixed(0)} psia is extremely high. This may indicate a data quality issue with GOR, API, or gas gravity inputs.`,
      bubblePoint,
      15000,
      'Verify GOR calculation: check gas and oil rate measurements. Consider if free gas production from gas cap or gas zone breakthrough is occurring.'
    ));
  } else if (bubblePoint > 10000) {
    warnings.push(createWarning(
      'PB_HIGH',
      'warning',
      `Bubble point pressure of ${bubblePoint.toFixed(0)} psia is unusually high. Check input data validity.`,
      bubblePoint,
      10000,
      'High Pb typically indicates high GOR. Verify gas metering and ensure GOR represents solution gas only (not free gas production).'
    ));
  }

  return warnings;
}

export function validateGOR(gor: number, api: number): PVTWarning[] {
  const warnings: PVTWarning[] = [];
  const category = getGORCategory(api);
  const range = TYPICAL_GOR_RANGES[category];

  if (gor > range.max * 2) {
    warnings.push(createWarning(
      'GOR_HIGH',
      'warning',
      `GOR of ${gor.toFixed(0)} scf/STB exceeds typical range for ${category} oil (API ${api.toFixed(1)}). Typical range: ${range.min}-${range.max} scf/STB.`,
      gor,
      range.max,
      `High GOR may indicate: (1) gas cap breakthrough, (2) gas zone communication, (3) metering error, or (4) naturally high-GOR reservoir. Verify data before ESP sizing.`
    ));
  }

  return warnings;
}

export function validateGVF(gvf: number): PVTWarning[] {
  const warnings: PVTWarning[] = [];
  const gvfPercent = gvf * 100;

  if (gvf > GVF_SEVERE_MIN) {
    warnings.push(createWarning(
      'GVF_SEVERE',
      'critical',
      `GVF of ${gvfPercent.toFixed(1)}% indicates severe gas interference. Standard ESP cannot handle this gas volume.`,
      gvfPercent,
      GVF_SEVERE_MIN * 100,
      'Consider: (1) High-efficiency gas separator (>70%), (2) Advanced Gas Handling (AGH) stages, (3) Gas anchor installation, (4) Reducing PIP to increase Rs, or (5) Alternative artificial lift method.'
    ));
  } else if (gvf > GVF_HIGH_MIN) {
    warnings.push(createWarning(
      'GVF_HIGH',
      'warning',
      `GVF of ${gvfPercent.toFixed(1)}% requires gas handling equipment for reliable ESP operation.`,
      gvfPercent,
      GVF_HIGH_MIN * 100,
      'Install gas separator with minimum 60% efficiency. Consider AGH stages if separator alone is insufficient.'
    ));
  } else if (gvf > GVF_MODERATE_MIN) {
    warnings.push(createWarning(
      'GVF_MODERATE',
      'info',
      `GVF of ${gvfPercent.toFixed(1)}% is moderate. Gas separator recommended for optimal pump performance.`,
      gvfPercent,
      GVF_MODERATE_MIN * 100,
      'Standard gas separator (40-60% efficiency) should be adequate.'
    ));
  }

  return warnings;
}

export function validateTurpinIndex(turpinIndex: number): PVTWarning[] {
  const warnings: PVTWarning[] = [];

  if (turpinIndex > 1.0) {
    warnings.push(createWarning(
      'TURPIN_HIGH',
      'warning',
      `Turpin index of ${turpinIndex.toFixed(3)} exceeds 1.0. Expect pumping difficulties due to gas interference.`,
      turpinIndex,
      1.0,
      'The Turpin index combines gas/liquid ratio and PIP effects. Reduce free gas at intake through gas separation or increase PIP to dissolve more gas.'
    ));
  }

  return warnings;
}

export function validatePVTConditions(params: {
  bubblePoint?: number;
  gor?: number;
  api?: number;
  gvf?: number;
  turpinIndex?: number;
  pressure?: number;
}): PVTWarning[] {
  const warnings: PVTWarning[] = [];

  if (params.bubblePoint !== undefined) {
    warnings.push(...validateBubblePointPressure(params.bubblePoint));
  }

  if (params.gor !== undefined && params.api !== undefined) {
    warnings.push(...validateGOR(params.gor, params.api));
  }

  if (params.gvf !== undefined) {
    warnings.push(...validateGVF(params.gvf));
  }

  if (params.turpinIndex !== undefined) {
    warnings.push(...validateTurpinIndex(params.turpinIndex));
  }

  if (params.pressure !== undefined && params.bubblePoint !== undefined) {
    if (params.pressure >= params.bubblePoint) {
      warnings.push(createWarning(
        'UNDERSATURATED',
        'info',
        `Operating pressure (${params.pressure.toFixed(0)} psia) exceeds bubble point (${params.bubblePoint.toFixed(0)} psia). Oil is undersaturated - all gas is in solution.`,
        params.pressure,
        params.bubblePoint,
        'Undersaturated conditions mean no free gas from solution. If free gas is still present, it may be from gas cap production or external source.'
      ));
    }
  }

  return warnings;
}

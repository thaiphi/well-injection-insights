/**
 * Central Constants File
 *
 * All universal physical constants, unit conversion factors, engineering
 * thresholds, and heuristic values used across math modules.
 *
 * Correlation-specific coefficients (e.g. Vasquez-Beggs 0.1595, 0.4078)
 * stay inline with their formulas in the respective correlation files.
 */

// ============================================================================
// PHYSICAL CONSTANTS
// ============================================================================

/** Fluid gradient: 1 SG water = 0.433 psi/ft */
export const PSI_PER_FT_WATER = 0.433;

/** Standard/atmospheric pressure (psia) */
export const P_ATM = 14.7;

/** Standard temperature in Rankine (60 degF + 460) */
export const T_STD = 520;

/** Rankine offset from Fahrenheit */
export const RANKINE_OFFSET = 460;

/** Barrel to cubic feet conversion */
export const BBL_TO_CF = 5.615;

/** Fresh water density (lb/ft3) */
export const WATER_DENSITY = 62.4;

/**
 * Produced-water specific gravity assumed when the caller supplies none.
 *
 * Only a fallback. The well's own water SG is entered by the user
 * (`ExistingProductionInput.waterSG`, default 1.05) and reaches the correlations on
 * `FlowConditions.waterSG`; this applies solely to callers that omit it.
 *
 * ⚠ Do not re-inline this value. It is the single definition every correlation defaults
 * to; a per-correlation copy is one more place a user's entry can be forgotten.
 */
export const PRODUCED_WATER_SG_DEFAULT = 1.02;

/**
 * Air density at standard conditions (lb/ft3), 14.696 psia and 60 degF.
 *
 * Converts a gas gravity — which is relative to AIR — into an absolute standard
 * density, so that dividing by a formation volume factor gives in-situ density.
 *
 * ⚠ The repo carries three values for this: 0.0765 in
 * `src/components/black-oil-tables/engine/generateBlackOilTable.ts`, 0.0752 inside
 * `src/utils/productionMath.ts`'s composite-SG helper, and this one. Paths are
 * repo-relative: this file is `src/utils/constants.ts`, so a bare
 * `black-oil-tables/...` reads as a sibling of it, and there is no such directory.
 * They correspond to
 * different pressure/temperature bases. Deliberately NOT unified here — the other
 * two feed shipped numbers on unrelated surfaces, so reconciling them is its own
 * change with its own fixture re-records. The spread is 1.7%, which lands on the
 * gas term only.
 */
export const AIR_DENSITY_STD = 0.0764;

/** Gravitational acceleration (ft/s2) */
export const GRAVITY = 32.174;

/** Base ESP frequency (Hz) */
export const BASE_FREQUENCY = 60;

// ============================================================================
// ENGINEERING THRESHOLDS (config object with defaults)
// ============================================================================

export const GVF_THRESHOLDS = {
  /** GVF below this is "good" */
  GOOD: 0.15,
  /** GVF below this is "warning", above is "danger" */
  WARNING: 0.25,
} as const;

export const TURPIN_THRESHOLDS = {
  /** Turpin below this is "safe" */
  SAFE: 0.8,
  /** Turpin below this is "warning", above is "danger" */
  WARNING: 1.2,
} as const;

export const GVF_PUMP_DEGRADATION_THRESHOLDS = {
  /** GVF above this triggers caution-level pump degradation warning */
  CAUTION: 0.50,
  /** GVF above this triggers danger-level ESP limit warning */
  DANGER: 0.75,
} as const;

// ============================================================================
// HEURISTIC CONSTANTS
// TODO Phase 8/14: Audit these values against industry references
// ============================================================================

/** Cap bubble point at this fraction of static pressure when Pb > Ps */
export const BUBBLE_POINT_CAP_RATIO = 0.9;

/** Maximum Pb/Ps ratio to prevent Vogel division issues */
export const MAX_PB_PS_RATIO = 0.99;

/** Minimum denominator in Vogel equation */
export const MIN_VOGEL_DENOMINATOR = 0.01;

/** Number of points for IPR/VLP curve generation */
export const NUM_CURVE_POINTS = 50;

// ============================================================================
// UNIT CONVERSION FACTORS
// ============================================================================

/** Convert scf/stb to m3/m3 (solution GOR unit conversion) */
export const SCF_STB_TO_M3_M3 = 0.178108;

/**
 * Convert dyn/cm to lbm/s² (surface tension unit conversion).
 *
 * NOT dyn/cm -> lbf/ft, despite the name this constant carried until the 2026-08 audit:
 * 1 dyn/cm = 1 g/s², and 0.00220462 is g -> lbm, so the product is lbm/s². The dyn/cm ->
 * lbf/ft factor is 6.852e-5 (see gray.ts, which defines its own and uses it correctly).
 *
 * The mislabelling was harmless in hagedornBrown.ts — dividing by (GRAVITY * sigma) in
 * these units yields a genuinely dimensionless group whose fourth root reproduces the
 * published 1.938 prefactor — but it caused beggsBrill.ts to apply 1.938 on top of that
 * chain and inflate NLV ~1.94x. Do not "correct" the value; hagedornBrown.ts's
 * NL/NLV/NGV/ND all depend on it as-is.
 */
export const DYNCM_TO_LBM_PER_S2 = 0.00220462;

/** Atmospheric pressure raised to 0.1 power (H-B f1 pressure term) */
export const P_ATM_01 = Math.pow(14.7, 0.1);

// ============================================================================
// UNIT CONVERSION HELPERS
// ============================================================================

/** Convert pressure (psi) to feet of head at given specific gravity */
export function psiToFtHead(psi: number, sg: number): number {
  return psi / (PSI_PER_FT_WATER * sg);
}

/** Convert feet of head to pressure (psi) at given specific gravity */
export function ftHeadToPsi(ftHead: number, sg: number): number {
  return ftHead * PSI_PER_FT_WATER * sg;
}

/** Convert Fahrenheit to Rankine */
export function fahrenheitToRankine(tempF: number): number {
  return tempF + RANKINE_OFFSET;
}

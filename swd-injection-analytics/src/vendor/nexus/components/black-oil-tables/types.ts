/**
 * Black Oil Table Generator Types
 *
 * Type definitions for the black oil table input form and validation.
 */

import type { PVTWarningSeverity } from '../../utils/multiphaseFlow/types.js';

// Re-export PVTConfig for convenience
export type { PVTConfig } from '../../utils/multiphaseFlow/types.js';

/**
 * Input parameters for black oil table generation.
 * All values are in field units (degF, psia, scf/stb, etc.).
 */
export type BlackOilTableInputs = {
  /** Reservoir temperature in degrees Fahrenheit */
  temperature: number;
  /** Stock tank oil API gravity */
  api: number;
  /** Gas specific gravity (air = 1.0) */
  gasGravity: number;
  /** Total solution GOR at bubble point in scf/stb */
  totalGOR: number;
  /** Minimum table pressure in psia */
  pressureMin: number;
  /** Maximum table pressure in psia */
  pressureMax: number;
  /** Number of rows in the generated table */
  numRows: number;
};

/**
 * Warning codes specific to black oil table input validation.
 */
export type BlackOilWarningCode =
  | 'API_OUT_OF_RANGE'
  | 'GOR_NEGATIVE'
  | 'GOR_HIGH'
  | 'PRESSURE_RANGE_INVALID'
  | 'PRESSURE_BELOW_ATMOSPHERIC'
  | 'ROWS_TOO_FEW'
  | 'ROWS_TOO_MANY'
  | 'SOUR_GAS_HIGH';

/**
 * Validation warning for black oil table inputs.
 * Extends the PVTWarning pattern with domain-specific codes.
 */
export type BlackOilInputValidation = {
  /** Warning code for programmatic handling */
  code: BlackOilWarningCode;
  /** Severity level */
  severity: PVTWarningSeverity;
  /** Human-readable warning message */
  message: string;
  /** Calculated value that triggered the warning */
  value: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Recommended action or consideration */
  recommendation?: string;
};

/**
 * Extended inputs for table generation including optional Pb override and vis_frac.
 */
export type GenerationConfig = {
  /** Optional user-specified bubble point pressure (psia). If provided with totalGOR (Rsb), triggers reconciliation. */
  bubblePointOverride?: number;
  /** Viscosity scaling factor (1.0 = no scaling). Applied as multiplier to all viscosity values. */
  visFrac?: number;
};

/**
 * Single row in the generated black oil table.
 */
export type BlackOilTableRow = {
  /** Pressure in psia */
  pressure: number;
  /** Solution GOR in scf/stb */
  rs: number;
  /** Oil FVF in rb/stb */
  bo: number;
  /** Gas FVF in rb/mscf (converted from cf/scf) */
  bg: number;
  /** Water FVF in rb/stb */
  bw: number;
  /** Oil density in lb/ft3 */
  oilDensity: number;
  /** Oil viscosity in cp */
  oilViscosity: number;
  /** Gas viscosity in cp */
  gasViscosity: number;
  /** Water viscosity in cp */
  waterViscosity: number;
  /** Oil compressibility in psi^-1 */
  co: number;
  /** Gas compressibility in psi^-1 (calculated as 1/P for ideal gas approximation) */
  cg: number;
  /** Water compressibility in psi^-1 */
  cw: number;
  /** Z-factor (dimensionless) */
  zFactor: number;
  /** True if this row is at or below bubble point */
  isSaturated: boolean;
};

/**
 * Complete result of black oil table generation.
 */
export type BlackOilTableResult = {
  /** Generated table rows, sorted by pressure ascending */
  rows: BlackOilTableRow[];
  /** Bubble point pressure used in generation (psia) */
  bubblePointPressure: number;
  /** Solution GOR at bubble point (scf/stb) */
  rsb: number;
  /** Rsb scaling factor applied for Pb/Rsb reconciliation (1.0 if none) */
  rsbScale: number;
  /** Stock tank oil density (lb/ft3) */
  stockTankOilDensity: number;
  /** Stock tank gas density (lb/ft3) - approximate from gas SG */
  stockTankGasDensity: number;
  /** Generation timestamp */
  generatedAt: Date;
};

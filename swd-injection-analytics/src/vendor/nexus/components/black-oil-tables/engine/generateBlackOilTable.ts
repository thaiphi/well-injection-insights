/**
 * Black Oil Table Generation Engine
 *
 * Core function that generates complete PVT tables by wrapping
 * getPVTPropertiesAtPressure in a pressure sweep loop.
 */

import { getPVTPropertiesAtPressure } from '../../../utils/pvt/correlations.js';
import type { PVTConfig } from '../../../utils/multiphaseFlow/types.js';
import type {
  BlackOilTableInputs,
  GenerationConfig,
  BlackOilTableResult,
  BlackOilTableRow,
} from '../types.js';
import { buildPressureArray } from './pressureArray.js';
import { reconcilePbRsb } from './pbRsbReconciliation.js';

/** Air density at standard conditions (lb/ft3) */
const AIR_DENSITY_STD = 0.0765;

/** Conversion factor for gas FVF: cf/scf to rb/mscf */
const GAS_FVF_CONVERSION = 1000 / 5.615;

/**
 * Calculate stock tank oil density from API gravity.
 * Formula: rho = 141.5 / (131.5 + API) * 62.4 lb/ft3
 *
 * @param api - Oil API gravity
 * @returns Stock tank oil density in lb/ft3
 */
function stockTankOilDensity(api: number): number {
  return (141.5 / (131.5 + api)) * 62.4;
}

/**
 * Calculate stock tank gas density from specific gravity.
 * Formula: rho_g = SG * rho_air
 *
 * @param gasGravity - Gas specific gravity (air = 1.0)
 * @returns Stock tank gas density in lb/ft3
 */
function stockTankGasDensity(gasGravity: number): number {
  return gasGravity * AIR_DENSITY_STD;
}

/**
 * Generate a complete black oil PVT table.
 *
 * This function:
 * 1. Reconciles Pb/Rsb if both are provided
 * 2. Builds a pressure array ensuring Pb is included
 * 3. Calls getPVTPropertiesAtPressure for each pressure point
 * 4. Converts units and applies vis_frac scaling
 * 5. Returns complete table with metadata
 *
 * @param inputs - Reservoir parameters (T, API, gas SG, GOR, pressure range, numRows)
 * @param pvtConfig - PVT correlation method selections and sour gas/salinity
 * @param genConfig - Optional: Pb override, viscosity scaling factor
 * @returns Complete table result with rows and metadata
 */
export function generateBlackOilTable(
  inputs: BlackOilTableInputs,
  pvtConfig: PVTConfig,
  genConfig?: GenerationConfig
): BlackOilTableResult {
  // Extract Pb correlation (default to vasquez-beggs)
  const pbCorrelation = pvtConfig.pbCorrelation ?? 'vasquez-beggs';

  // Reconcile Pb and Rsb
  const reconciliation = reconcilePbRsb(
    inputs.totalGOR,
    inputs.api,
    inputs.gasGravity,
    inputs.temperature,
    pbCorrelation,
    genConfig?.bubblePointOverride
  );

  const { pb, rsb, rsbScale } = reconciliation;

  // Build pressure array (ensures Pb is included if within range)
  const pressures = buildPressureArray(
    inputs.pressureMin,
    inputs.pressureMax,
    inputs.numRows,
    pb >= inputs.pressureMin && pb <= inputs.pressureMax ? pb : null
  );

  // Viscosity scaling factor (default 1.0)
  const visFrac = genConfig?.visFrac ?? 1.0;

  // Generate table rows
  const rows: BlackOilTableRow[] = pressures.map((pressure) => {
    // Get PVT properties at this pressure
    const pvt = getPVTPropertiesAtPressure(
      pressure,
      inputs.temperature,
      inputs.api,
      inputs.gasGravity,
      rsb,
      pvtConfig
    );

    // Guard against invalid PVT results (NaN/Infinity from correlation edge cases)
    if (!Number.isFinite(pvt.bo) || !Number.isFinite(pvt.rs)) {
      throw new Error(`Invalid PVT properties at pressure ${pressure} psia: Bo=${pvt.bo}, Rs=${pvt.rs}`);
    }

    // Convert gas FVF from cf/scf to rb/mscf
    const bgRbMscf = (pvt.gasFVF ?? 0) * GAS_FVF_CONVERSION;

    // Gas compressibility using ideal gas approximation: Cg = 1/P
    // Note: Real gas Cg = 1/P - (1/Z)(dZ/dP) can differ 30-50% at reservoir conditions.
    // This approximation is acceptable for black oil simulation but may need refinement
    // for volatile oil or condensate systems.
    const cg = pressure > 0 ? 1 / pressure : 0;

    // Determine if saturated (below Pb)
    const isSaturated = pressure < pb;

    return {
      pressure,
      rs: pvt.rs,
      bo: pvt.bo,
      bg: bgRbMscf,
      bw: pvt.waterFVF ?? 1.0,
      oilDensity: pvt.oilDensity ?? 0,
      oilViscosity: (pvt.oilViscosity ?? 0) * visFrac,
      gasViscosity: (pvt.gasViscosity ?? 0) * visFrac,
      waterViscosity: pvt.waterViscosity ?? 1.0,  // water viscosity is not tunable via visFrac (determined by temperature and salinity)
      co: pvt.oilCompressibility ?? 0,
      cg,
      cw: pvt.waterCompressibility ?? 0,
      zFactor: pvt.zFactor ?? 1.0,
      isSaturated,
    };
  });

  // Sort rows by pressure ascending (should already be sorted, but ensure)
  rows.sort((a, b) => a.pressure - b.pressure);

  return {
    rows,
    bubblePointPressure: pb,
    rsb,
    rsbScale,
    stockTankOilDensity: stockTankOilDensity(inputs.api),
    stockTankGasDensity: stockTankGasDensity(inputs.gasGravity),
    generatedAt: new Date(),
  };
}

/**
 * PVT-Specific Constants
 *
 * Re-exports universal constants from the central constants file and
 * adds PVT-specific bounds used by correlations.
 * All values in field units unless noted.
 */

import { P_ATM, T_STD as T_STD_CENTRAL, BBL_TO_CF as BBL_TO_CF_CENTRAL } from '../constants.js';

/** Standard/atmospheric pressure (psia) - re-export from central constants */
export const P_STD = P_ATM;

/** Standard temperature (degrees Rankine) - re-export from central constants */
export const T_STD = T_STD_CENTRAL;

/** Conversion: barrels to cubic feet (bbl -> cf) - re-export from central constants */
export const BBL_TO_CF = BBL_TO_CF_CENTRAL;

// ============================================================================
// PVT-SPECIFIC BOUNDS
// ============================================================================

/** Minimum Rsb threshold for numerical stability (scf/stb) */
export const MIN_RSB = 10;

/** Minimum pressure for undersaturated calculations (psia) */
export const MIN_PRESSURE = P_ATM;

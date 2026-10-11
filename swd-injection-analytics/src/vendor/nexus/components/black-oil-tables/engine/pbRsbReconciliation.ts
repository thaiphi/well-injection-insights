/**
 * Pb/Rsb Reconciliation
 *
 * Reconciles user-provided bubble point pressure and solution GOR values
 * following the pyRT pattern. When both Pb and Rsb are provided, computes
 * a scaling factor to honor both inputs simultaneously.
 */

import { calculateBubblePointPressure } from '../../../utils/pvt/correlations.js';
import type { PbCorrelation } from '../../../utils/multiphaseFlow/types.js';

/** Atmospheric pressure in psia (default Pb when Rsb=0) */
const P_ATMOSPHERIC = 14.7;

/** Tolerance for Pb match (1%) */
const PB_MATCH_TOLERANCE = 0.01;

/**
 * Result of Pb/Rsb reconciliation.
 */
export type ReconciliationResult = {
  /** Bubble point pressure to use (psia) */
  pb: number;
  /** Solution GOR at bubble point (scf/stb) */
  rsb: number;
  /** Scaling factor applied to honor both Pb and Rsb inputs */
  rsbScale: number;
};

/**
 * Reconcile user-provided Pb and Rsb values following pyRT pattern.
 *
 * When both Pb and Rsb are provided:
 * 1. Calculate what Pb *should* be from Rsb using correlation
 * 2. Compute scaling factor: scale = userPb / calculatedPb
 * 3. Return userPb as the bubble point with the scaling factor
 *
 * The scaling factor can be used by downstream consumers to understand
 * how much the correlation was "stretched" to honor both inputs.
 *
 * @param userRsb - User-provided solution GOR at Pb (scf/stb)
 * @param api - Oil API gravity
 * @param gasGravity - Gas specific gravity
 * @param temperature - Temperature (degF)
 * @param pbCorrelation - Bubble point correlation method
 * @param userPbOverride - Optional user-specified Pb (psia)
 * @returns Reconciliation result with pb, rsb, and scaling factor
 */
export function reconcilePbRsb(
  userRsb: number,
  api: number,
  gasGravity: number,
  temperature: number,
  pbCorrelation: PbCorrelation,
  userPbOverride?: number
): ReconciliationResult {
  // Edge case: Rsb <= 0 means no dissolved gas
  if (userRsb <= 0) {
    return {
      pb: userPbOverride ?? P_ATMOSPHERIC,
      rsb: 0,
      rsbScale: 1.0,
    };
  }

  // Calculate what Pb should be from the correlation
  const correlationPb = calculateBubblePointPressure(
    userRsb,
    api,
    gasGravity,
    temperature,
    pbCorrelation
  );

  // If no override provided, use correlation result
  if (userPbOverride === undefined) {
    return {
      pb: correlationPb,
      rsb: userRsb,
      rsbScale: 1.0,
    };
  }

  // User provided a Pb override - check if it's close enough to calculated
  const relativeDifference = Math.abs(userPbOverride - correlationPb) / correlationPb;

  if (relativeDifference < PB_MATCH_TOLERANCE) {
    // Close enough - no scaling needed
    return {
      pb: userPbOverride,
      rsb: userRsb,
      rsbScale: 1.0,
    };
  }

  // Calculate scaling factor to honor both inputs
  const scale = userPbOverride / correlationPb;

  return {
    pb: userPbOverride,
    rsb: userRsb,
    rsbScale: scale,
  };
}

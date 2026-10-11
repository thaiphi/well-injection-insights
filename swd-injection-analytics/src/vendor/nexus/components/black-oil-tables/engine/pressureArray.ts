/**
 * Pressure Array Builder
 *
 * Generates array of pressure points for black oil table generation.
 * Ensures bubble point is included as an explicit row if within range.
 */

/** Tolerance for detecting near-duplicate pressures (psia) */
const PRESSURE_TOLERANCE = 0.1;

/**
 * Build array of pressure points for table generation.
 * Ensures bubble point is included as an explicit row if within range.
 *
 * @param pMin - Minimum pressure (psia)
 * @param pMax - Maximum pressure (psia)
 * @param nRows - Desired number of rows
 * @param bubblePoint - Bubble point pressure to include (null if unknown)
 * @returns Sorted array of pressure values
 */
export function buildPressureArray(
  pMin: number,
  pMax: number,
  nRows: number,
  bubblePoint: number | null
): number[] {
  // Handle edge case of single row
  if (nRows <= 1) {
    return [pMin];
  }

  // Generate evenly-spaced pressures (linspace)
  const step = (pMax - pMin) / (nRows - 1);
  const pressures: number[] = [];

  for (let i = 0; i < nRows; i++) {
    pressures.push(pMin + i * step);
  }

  // Ensure last point is exactly pMax (avoid floating point drift)
  pressures[pressures.length - 1] = pMax;

  // If bubble point is provided and within range, consider adding it
  if (bubblePoint !== null && bubblePoint >= pMin && bubblePoint <= pMax) {
    // Check if any existing pressure is within tolerance of bubble point
    const isNearExisting = pressures.some(
      (p) => Math.abs(p - bubblePoint) <= PRESSURE_TOLERANCE
    );

    if (!isNearExisting) {
      // Add bubble point to the array
      pressures.push(bubblePoint);
    }
  }

  // Sort ascending
  pressures.sort((a, b) => a - b);

  return pressures;
}

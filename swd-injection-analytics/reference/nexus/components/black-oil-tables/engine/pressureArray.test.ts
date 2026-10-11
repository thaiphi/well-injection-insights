/**
 * Pressure Array Builder Tests
 *
 * Tests for buildPressureArray function that generates pressure points
 * for black oil table generation, ensuring bubble point is included.
 */

import { describe, it, expect } from 'vitest';
import { buildPressureArray } from './pressureArray';

describe('buildPressureArray', () => {
  it('returns equally-spaced pressures when no bubble point provided', () => {
    const result = buildPressureArray(25, 4000, 20, null);

    expect(result).toHaveLength(20);
    expect(result[0]).toBe(25);
    expect(result[result.length - 1]).toBe(4000);

    // Check spacing is approximately equal
    const expectedStep = (4000 - 25) / 19;
    for (let i = 1; i < result.length; i++) {
      const actualStep = result[i] - result[i - 1];
      expect(actualStep).toBeCloseTo(expectedStep, 5);
    }
  });

  it('adds bubble point as explicit row when within range', () => {
    const result = buildPressureArray(25, 4000, 20, 2500);

    // Should be 21 rows (20 + Pb)
    expect(result).toHaveLength(21);

    // Pb should be in the array
    expect(result).toContain(2500);

    // First and last should still be pMin and pMax
    expect(result[0]).toBe(25);
    expect(result[result.length - 1]).toBe(4000);
  });

  it('does not add extra row when Pb equals pMin', () => {
    const result = buildPressureArray(25, 4000, 20, 25);

    // Should be exactly 20 rows (Pb is already the first pressure)
    expect(result).toHaveLength(20);
    expect(result[0]).toBe(25);
    expect(result).toContain(25);
  });

  it('does not add extra row when Pb equals pMax', () => {
    const result = buildPressureArray(25, 4000, 20, 4000);

    // Should be exactly 20 rows (Pb is already the last pressure)
    expect(result).toHaveLength(20);
    expect(result[result.length - 1]).toBe(4000);
    expect(result).toContain(4000);
  });

  it('returns array sorted ascending', () => {
    const result = buildPressureArray(25, 4000, 20, 2500);

    for (let i = 1; i < result.length; i++) {
      expect(result[i]).toBeGreaterThan(result[i - 1]);
    }
  });

  it('avoids duplicate pressures when Pb is very close to grid point', () => {
    // With 20 rows from 0 to 3800, step = 200
    // Grid points: 0, 200, 400, ..., 3800
    // If Pb = 200.05, should NOT add a duplicate near 200
    const result = buildPressureArray(0, 3800, 20, 200.05);

    // Should still be 20 rows (Pb within tolerance of grid point)
    expect(result).toHaveLength(20);

    // Check no near-duplicates (all differences > 0.1)
    for (let i = 1; i < result.length; i++) {
      expect(result[i] - result[i - 1]).toBeGreaterThan(0.1);
    }
  });

  it('handles bubble point outside range (no insertion)', () => {
    // Pb below pMin
    const resultBelow = buildPressureArray(500, 4000, 10, 100);
    expect(resultBelow).toHaveLength(10);
    expect(resultBelow).not.toContain(100);

    // Pb above pMax
    const resultAbove = buildPressureArray(500, 4000, 10, 5000);
    expect(resultAbove).toHaveLength(10);
    expect(resultAbove).not.toContain(5000);
  });

  it('handles single row request', () => {
    const result = buildPressureArray(1000, 1000, 1, null);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(1000);
  });

  it('handles small pressure range', () => {
    // With 5 rows from 100 to 110, step = 2.5. Grid: 100, 102.5, 105, 107.5, 110
    // Use Pb = 106 which is NOT on the grid
    const result = buildPressureArray(100, 110, 5, 106);
    expect(result).toHaveLength(6); // 5 + Pb
    expect(result).toContain(106);
    expect(result[0]).toBe(100);
    expect(result[result.length - 1]).toBe(110);
  });
});

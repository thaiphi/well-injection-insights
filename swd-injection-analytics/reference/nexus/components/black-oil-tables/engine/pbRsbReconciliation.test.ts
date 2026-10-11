/**
 * Pb/Rsb Reconciliation Tests
 *
 * Tests for reconcilePbRsb function that handles user-provided
 * Pb and Rsb values with scaling factor calculation.
 */

import { describe, it, expect } from 'vitest';
import { reconcilePbRsb } from './pbRsbReconciliation';

describe('reconcilePbRsb', () => {
  // Standard test inputs: api=35, gasGravity=0.7, temperature=200, rsb=500
  // These produce Pb ~2400 psia with vasquez-beggs correlation
  const testApi = 35;
  const testGasGravity = 0.7;
  const testTemperature = 200;
  const testRsb = 500;

  it('returns calculated Pb and scale=1.0 when no override provided', () => {
    const result = reconcilePbRsb(
      testRsb,
      testApi,
      testGasGravity,
      testTemperature,
      'vasquez-beggs',
      undefined
    );

    // Should return correlation-calculated Pb
    expect(result.pb).toBeGreaterThan(1000);
    expect(result.pb).toBeLessThan(5000);
    expect(result.rsb).toBe(testRsb);
    expect(result.rsbScale).toBe(1.0);
  });

  it('returns scale=1.0 when Pb override matches calculated within 1%', () => {
    // First get the calculated Pb
    const baseline = reconcilePbRsb(
      testRsb,
      testApi,
      testGasGravity,
      testTemperature,
      'vasquez-beggs',
      undefined
    );

    // Now provide an override within 1% of calculated
    const closeOverride = baseline.pb * 1.005; // 0.5% higher
    const result = reconcilePbRsb(
      testRsb,
      testApi,
      testGasGravity,
      testTemperature,
      'vasquez-beggs',
      closeOverride
    );

    expect(result.pb).toBe(closeOverride);
    expect(result.rsb).toBe(testRsb);
    expect(result.rsbScale).toBe(1.0);
  });

  it('returns scale > 1.0 when Pb override is higher than calculated', () => {
    // First get the calculated Pb
    const baseline = reconcilePbRsb(
      testRsb,
      testApi,
      testGasGravity,
      testTemperature,
      'vasquez-beggs',
      undefined
    );

    // Override 20% higher
    const higherOverride = baseline.pb * 1.2;
    const result = reconcilePbRsb(
      testRsb,
      testApi,
      testGasGravity,
      testTemperature,
      'vasquez-beggs',
      higherOverride
    );

    expect(result.pb).toBe(higherOverride);
    expect(result.rsb).toBe(testRsb);
    expect(result.rsbScale).toBeCloseTo(1.2, 1);
  });

  it('returns scale < 1.0 when Pb override is lower than calculated', () => {
    // First get the calculated Pb
    const baseline = reconcilePbRsb(
      testRsb,
      testApi,
      testGasGravity,
      testTemperature,
      'vasquez-beggs',
      undefined
    );

    // Override 20% lower
    const lowerOverride = baseline.pb * 0.8;
    const result = reconcilePbRsb(
      testRsb,
      testApi,
      testGasGravity,
      testTemperature,
      'vasquez-beggs',
      lowerOverride
    );

    expect(result.pb).toBe(lowerOverride);
    expect(result.rsb).toBe(testRsb);
    expect(result.rsbScale).toBeCloseTo(0.8, 1);
  });

  it('handles edge case when Rsb = 0 without division by zero', () => {
    // With Rsb = 0 and no Pb override
    const resultNoOverride = reconcilePbRsb(
      0,
      testApi,
      testGasGravity,
      testTemperature,
      'vasquez-beggs',
      undefined
    );

    expect(resultNoOverride.rsb).toBe(0);
    expect(resultNoOverride.rsbScale).toBe(1.0);
    expect(resultNoOverride.pb).toBe(14.7); // Atmospheric

    // With Rsb = 0 and Pb override
    const resultWithOverride = reconcilePbRsb(
      0,
      testApi,
      testGasGravity,
      testTemperature,
      'vasquez-beggs',
      2000
    );

    expect(resultWithOverride.rsb).toBe(0);
    expect(resultWithOverride.rsbScale).toBe(1.0);
    expect(resultWithOverride.pb).toBe(2000);
  });

  it('works with different correlation methods', () => {
    // Test with standing correlation
    const standingResult = reconcilePbRsb(
      testRsb,
      testApi,
      testGasGravity,
      testTemperature,
      'standing',
      undefined
    );

    expect(standingResult.pb).toBeGreaterThan(1000);
    expect(standingResult.rsb).toBe(testRsb);
    expect(standingResult.rsbScale).toBe(1.0);

    // Test with velarde correlation
    const velardeResult = reconcilePbRsb(
      testRsb,
      testApi,
      testGasGravity,
      testTemperature,
      'velarde',
      undefined
    );

    expect(velardeResult.pb).toBeGreaterThan(1000);
    expect(velardeResult.rsb).toBe(testRsb);
    expect(velardeResult.rsbScale).toBe(1.0);
  });
});

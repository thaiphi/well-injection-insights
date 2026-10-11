/**
 * Black Oil Table Generation Tests
 *
 * Tests for generateBlackOilTable function that produces complete
 * PVT tables with all 12 properties.
 */

import { describe, it, expect } from 'vitest';
import { generateBlackOilTable } from './generateBlackOilTable';
import type { BlackOilTableInputs } from '../types';
import type { PVTConfig } from '@/utils/multiphaseFlow/types';

describe('generateBlackOilTable', () => {
  // Standard test inputs
  const testInputs: BlackOilTableInputs = {
    temperature: 200,
    api: 35,
    gasGravity: 0.7,
    totalGOR: 500,
    pressureMin: 500,
    pressureMax: 4000,
    numRows: 10,
  };

  const testPvtConfig: PVTConfig = {
    pbCorrelation: 'vasquez-beggs',
    rsMethod: 'vasquez-beggs',
    boMethod: 'vasquez-beggs',
    zMethod: 'dak',
    viscosityMethod: 'beggs-robinson',
  };

  it('returns rows array with correct length', () => {
    const result = generateBlackOilTable(testInputs, testPvtConfig);

    // Should be numRows or numRows+1 if Pb is added
    expect(result.rows.length).toBeGreaterThanOrEqual(testInputs.numRows);
    expect(result.rows.length).toBeLessThanOrEqual(testInputs.numRows + 1);
  });

  it('each row has all 12 properties plus pressure and isSaturated', () => {
    const result = generateBlackOilTable(testInputs, testPvtConfig);

    const requiredProps = [
      'pressure',
      'rs',
      'bo',
      'bg',
      'bw',
      'oilDensity',
      'oilViscosity',
      'gasViscosity',
      'waterViscosity',
      'co',
      'cg',
      'cw',
      'zFactor',
      'isSaturated',
    ];

    for (const row of result.rows) {
      for (const prop of requiredProps) {
        expect(row).toHaveProperty(prop);
        // Check that numeric properties are finite numbers
        if (prop !== 'isSaturated') {
          expect(typeof row[prop as keyof typeof row]).toBe('number');
          expect(Number.isFinite(row[prop as keyof typeof row])).toBe(true);
        }
      }
    }
  });

  it('includes bubble point pressure as an explicit row', () => {
    const result = generateBlackOilTable(testInputs, testPvtConfig);

    // Find the row at bubble point
    const pbRow = result.rows.find(
      (row) => Math.abs(row.pressure - result.bubblePointPressure) < 0.1
    );

    expect(pbRow).toBeDefined();
    expect(result.bubblePointPressure).toBeGreaterThan(testInputs.pressureMin);
    expect(result.bubblePointPressure).toBeLessThan(testInputs.pressureMax);
  });

  it('marks rows correctly as saturated or undersaturated', () => {
    const result = generateBlackOilTable(testInputs, testPvtConfig);
    const pb = result.bubblePointPressure;

    for (const row of result.rows) {
      if (row.pressure < pb) {
        // Below Pb: saturated
        expect(row.isSaturated).toBe(true);
      } else {
        // At or above Pb: undersaturated
        expect(row.isSaturated).toBe(false);
      }
    }
  });

  it('Rs is constant (equal to rsb) for all rows above Pb', () => {
    const result = generateBlackOilTable(testInputs, testPvtConfig);
    const pb = result.bubblePointPressure;
    const rsb = result.rsb;

    const undersaturatedRows = result.rows.filter((row) => row.pressure >= pb);

    // Should have at least one undersaturated row
    expect(undersaturatedRows.length).toBeGreaterThan(0);

    for (const row of undersaturatedRows) {
      // Rs should be capped at rsb
      expect(row.rs).toBeCloseTo(rsb, 0);
    }
  });

  it('vis_frac=0.5 halves oil and gas viscosity but not water viscosity', () => {
    // Generate with default vis_frac (1.0)
    const resultDefault = generateBlackOilTable(testInputs, testPvtConfig, {
      visFrac: 1.0,
    });

    // Generate with vis_frac = 0.5
    const resultHalved = generateBlackOilTable(testInputs, testPvtConfig, {
      visFrac: 0.5,
    });

    // Compare viscosities at same pressure points
    for (let i = 0; i < resultDefault.rows.length; i++) {
      const defaultRow = resultDefault.rows[i];
      const halvedRow = resultHalved.rows[i];

      // Pressures should match
      expect(halvedRow.pressure).toBe(defaultRow.pressure);

      // Oil and gas viscosities should be halved (PVT tuning targets)
      expect(halvedRow.oilViscosity).toBeCloseTo(
        defaultRow.oilViscosity * 0.5,
        5
      );
      expect(halvedRow.gasViscosity).toBeCloseTo(
        defaultRow.gasViscosity * 0.5,
        5
      );

      // Water viscosity is NOT affected by visFrac — it is determined by
      // temperature and salinity, not by oil PVT calibration.
      expect(halvedRow.waterViscosity).toBeCloseTo(
        defaultRow.waterViscosity,
        5
      );
    }
  });

  it('result includes all required metadata', () => {
    const result = generateBlackOilTable(testInputs, testPvtConfig);

    expect(result.bubblePointPressure).toBeGreaterThan(0);
    expect(result.rsb).toBe(testInputs.totalGOR);
    expect(result.rsbScale).toBe(1.0);
    expect(result.stockTankOilDensity).toBeGreaterThan(0);
    expect(result.stockTankGasDensity).toBeGreaterThan(0);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('handles Pb override with reconciliation', () => {
    // First get baseline to know what correlation would calculate
    const baseline = generateBlackOilTable(testInputs, testPvtConfig);
    const correlationPb = baseline.bubblePointPressure;

    // Now use a Pb override that's 20% higher
    const higherPb = correlationPb * 1.2;
    const result = generateBlackOilTable(testInputs, testPvtConfig, {
      bubblePointOverride: higherPb,
    });

    expect(result.bubblePointPressure).toBeCloseTo(higherPb, 0);
    expect(result.rsbScale).toBeCloseTo(1.2, 1);
  });

  it('rows are sorted by pressure ascending', () => {
    const result = generateBlackOilTable(testInputs, testPvtConfig);

    for (let i = 1; i < result.rows.length; i++) {
      expect(result.rows[i].pressure).toBeGreaterThan(
        result.rows[i - 1].pressure
      );
    }
  });

  it('handles edge case of Pb outside pressure range', () => {
    // Use very high pressure min to force Pb below range
    const highPressureInputs: BlackOilTableInputs = {
      ...testInputs,
      pressureMin: 5000,
      pressureMax: 8000,
    };

    const result = generateBlackOilTable(highPressureInputs, testPvtConfig);

    // Should still generate table
    expect(result.rows.length).toBe(highPressureInputs.numRows);

    // All rows should be undersaturated (above Pb)
    for (const row of result.rows) {
      expect(row.isSaturated).toBe(false);
    }
  });
});

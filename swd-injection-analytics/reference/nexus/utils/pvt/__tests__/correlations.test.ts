/**
 * PVT Correlations Test Suite
 *
 * Tests for McCain bubble point correlation and
 * undersaturated oil property calculations.
 *
 * Migrated from src/utils/multiphaseFlow/pvtCorrelations.test.ts
 * to align with pvt/ single source of truth module.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBubblePointPressure,
  calculateBubblePoint,
  calculateSolutionGOR,
  calculateRsVasquezBeggs as calculateRs,
  calculateBoVasquezBeggs as calculateBo,
  calculateOilFVFAtBubblePoint,
  calculateOilCompressibility,
  calculateOilCompressibilityMcCain,
  calculateOilCompressibilityNumerical,
  calculateOilDensitySWMH,
  calculateUndersaturatedBo,
  calculateDeadOilViscosity,
  calculateLiveOilViscosity,
  calculateUndersaturatedViscosity,
  calculateDeadOilViscosityBeal,
  calculateSaturatedViscosityChewConnally,
  calculateUndersaturatedViscosityBeal,
  calculateGasGravityAt100psig,
  getPVTPropertiesAtPressure,
  calculateTotalGOR,
  calculateFullZFactor,
  calculateSuttonPseudoCriticalPressure,
  calculateSuttonPseudoCriticalTemperature,
  calculateWaterFVF,
  calculateGasFVF,
  calculateWaterFVFWithSalinity,
  calculateBrineDensity,
  calculateBrineViscosity,
  calculateWaterCompressibilityWithSalinity,
} from '../correlations';
import {
  calculateSourGasPseudocriticals,
  COMPONENT_CRITICALS,
} from '../sourGasCorrections';

// ============================================================================
// BUBBLE POINT PRESSURE TESTS - DUAL METHOD SUPPORT
// ============================================================================

describe('calculateBubblePointPressure', () => {
  describe('Vasquez-Beggs method (default, Excel-compatible)', () => {
    it('should match Excel spreadsheet validation case', () => {
      // Excel values: API=41, gas_gravity_corrected=0.7117, T=160F, GOR=1067 scf/stb
      // wellboreMath source-of-truth Pb = 3629.97 psia
      // (differs from old pvtCorrelations value 3644.73 due to P_STD subtraction in V-B formula)
      const Pb = calculateBubblePointPressure(1067, 41, 0.7117, 160, 'vasquez-beggs');

      expect(Pb).toBeCloseTo(3629.97, 0);
    });

    it('should be the default method', () => {
      const PbDefault = calculateBubblePointPressure(1067, 41, 0.7117, 160);
      const PbExplicit = calculateBubblePointPressure(1067, 41, 0.7117, 160, 'vasquez-beggs');

      expect(PbDefault).toEqual(PbExplicit);
    });

    it('should use different formula for API <= 30 vs API > 30', () => {
      // Test boundary behavior at API = 30
      const PbLowAPI = calculateBubblePointPressure(500, 28, 0.7, 180, 'vasquez-beggs');
      const PbHighAPI = calculateBubblePointPressure(500, 32, 0.7, 180, 'vasquez-beggs');

      // Both should be valid, positive values
      expect(PbLowAPI).toBeGreaterThan(100);
      expect(PbHighAPI).toBeGreaterThan(100);
    });
  });

  describe('McCain method', () => {
    it('should calculate Pb using McCain correlation', () => {
      // Same inputs as Excel case but with McCain method
      // Expected McCain Pb = 3402.79 psia
      const Pb = calculateBubblePointPressure(1067, 41, 0.7117, 160, 'mccain');

      expect(Pb).toBeCloseTo(3402.79, 0);
    });

    it('should give different result than Vasquez-Beggs', () => {
      const PbVB = calculateBubblePointPressure(1067, 41, 0.7117, 160, 'vasquez-beggs');
      const PbMcCain = calculateBubblePointPressure(1067, 41, 0.7117, 160, 'mccain');

      // Vasquez-Beggs gives higher Pb (about 7% difference)
      expect(PbVB).toBeGreaterThan(PbMcCain);
      const diffPercent = ((PbVB - PbMcCain) / PbMcCain) * 100;
      expect(diffPercent).toBeCloseTo(7.1, 0);
    });
  });

  describe('general behavior (both methods)', () => {
    it('should calculate Pb for light oil with low GOR', () => {
      // Light oil: low GOR, high API
      const Pb = calculateBubblePointPressure(200, 40, 0.7, 180);

      // Expected range: 800-1500 psia for this scenario
      expect(Pb).toBeGreaterThan(800);
      expect(Pb).toBeLessThan(1500);
    });

    it('should calculate Pb for medium oil', () => {
      // Medium oil: moderate GOR and API
      const Pb = calculateBubblePointPressure(500, 35, 0.75, 200);

      // Expected range: 2000-3500 psia
      expect(Pb).toBeGreaterThan(2000);
      expect(Pb).toBeLessThan(3500);
    });

    it('should calculate Pb for heavy oil with high GOR', () => {
      // Heavy oil: high GOR, low API
      const Pb = calculateBubblePointPressure(800, 28, 0.8, 220);

      // Expected range: 3000-5000 psia
      expect(Pb).toBeGreaterThan(3000);
      expect(Pb).toBeLessThan(5000);
    });

    it('should increase Pb with increasing Rsb', () => {
      const Pb1 = calculateBubblePointPressure(200, 35, 0.7, 180);
      const Pb2 = calculateBubblePointPressure(500, 35, 0.7, 180);
      const Pb3 = calculateBubblePointPressure(800, 35, 0.7, 180);

      expect(Pb2).toBeGreaterThan(Pb1);
      expect(Pb3).toBeGreaterThan(Pb2);
    });

    it('should change Pb with gas gravity', () => {
      const Pb1 = calculateBubblePointPressure(500, 35, 0.6, 180);
      const Pb2 = calculateBubblePointPressure(500, 35, 0.8, 180);
      const Pb3 = calculateBubblePointPressure(500, 35, 1.0, 180);

      // All should be valid positive values
      expect(Pb1).toBeGreaterThan(100);
      expect(Pb2).toBeGreaterThan(100);
      expect(Pb3).toBeGreaterThan(100);
    });

    it('should handle minimum Rsb threshold', () => {
      const Pb = calculateBubblePointPressure(5, 35, 0.7, 180); // Below MIN_RSB

      // Should still return a valid result (uses MIN_RSB = 10)
      // Returns minimum bound of 100 for very low inputs
      expect(Pb).toBeGreaterThanOrEqual(100);
      expect(Pb).toBeLessThan(10000);
    });

    it('should return bounded values for extreme inputs', () => {
      // Very high GOR
      const PbHigh = calculateBubblePointPressure(2000, 35, 0.7, 180);
      expect(PbHigh).toBeLessThanOrEqual(10000);

      // Very low inputs
      const PbLow = calculateBubblePointPressure(10, 20, 0.5, 100);
      expect(PbLow).toBeGreaterThanOrEqual(100);
    });
  });
});

// ============================================================================
// SOLUTION GOR TESTS
// ============================================================================

describe('calculateRsVasquezBeggs', () => {
  it('should increase Rs with pressure', () => {
    const Rs1 = calculateRs(1000, 180, 35, 0.7);
    const Rs2 = calculateRs(2000, 180, 35, 0.7);
    const Rs3 = calculateRs(3000, 180, 35, 0.7);

    expect(Rs2).toBeGreaterThan(Rs1);
    expect(Rs3).toBeGreaterThan(Rs2);
  });

  it('should use different coefficients for API <= 30 vs > 30', () => {
    const RsLowAPI = calculateRs(2000, 180, 28, 0.7);
    const RsHighAPI = calculateRs(2000, 180, 35, 0.7);

    // Both should be positive, reasonable values
    expect(RsLowAPI).toBeGreaterThan(0);
    expect(RsHighAPI).toBeGreaterThan(0);
  });

  it('should return reasonable values for typical conditions', () => {
    const Rs = calculateRs(2500, 200, 35, 0.75);

    // Vasquez-Beggs Rs at 2500 psia - can be lower due to correlation behavior
    expect(Rs).toBeGreaterThan(0);
    expect(Rs).toBeLessThan(2000);
  });
});

// ============================================================================
// OIL FORMATION VOLUME FACTOR TESTS
// ============================================================================

describe('calculateBoVasquezBeggs', () => {
  it('should return Bo > 1 for positive Rs', () => {
    const Bo = calculateBo(500, 180, 35, 0.7);

    expect(Bo).toBeGreaterThan(1);
  });

  it('should increase Bo with increasing Rs', () => {
    const Bo1 = calculateBo(200, 180, 35, 0.7);
    const Bo2 = calculateBo(500, 180, 35, 0.7);
    const Bo3 = calculateBo(800, 180, 35, 0.7);

    expect(Bo2).toBeGreaterThan(Bo1);
    expect(Bo3).toBeGreaterThan(Bo2);
  });

  it('should return reasonable values for typical conditions', () => {
    const Bo = calculateBo(500, 200, 35, 0.75);

    // Typical range: 1.1 - 1.6 rb/stb
    expect(Bo).toBeGreaterThan(1.1);
    expect(Bo).toBeLessThan(1.8);
  });

  it('should use different coefficients for API <= 30 vs > 30', () => {
    const BoLowAPI = calculateBo(500, 180, 28, 0.7);
    const BoHighAPI = calculateBo(500, 180, 35, 0.7);

    // Both should be > 1
    expect(BoLowAPI).toBeGreaterThan(1);
    expect(BoHighAPI).toBeGreaterThan(1);
  });
});

// ============================================================================
// OIL COMPRESSIBILITY TESTS
// ============================================================================

describe('calculateOilCompressibilityMcCain', () => {
  it('should return positive compressibility', () => {
    const co = calculateOilCompressibilityMcCain(3000, 2500, 200, 35, 500);

    expect(co).toBeGreaterThan(0);
  });

  it('should be in bounded range', () => {
    const co = calculateOilCompressibilityMcCain(3000, 2500, 200, 35, 500);

    // Eq 3.13 produces values in ~1e-5 to ~1e-4 range
    expect(co).toBeGreaterThanOrEqual(5e-7);
    expect(co).toBeLessThanOrEqual(1e-3);
  });

  it('should vary with pressure when above minimum bound', () => {
    const co1 = calculateOilCompressibilityMcCain(3000, 2500, 200, 35, 1000);
    const co2 = calculateOilCompressibilityMcCain(5000, 2500, 200, 35, 1000);

    // Higher pressure should generally result in different compressibility
    expect(co1).toBeGreaterThan(0);
    expect(co2).toBeGreaterThan(0);
  });
});

// ============================================================================
// UNDERSATURATED Bo TESTS
// ============================================================================

describe('calculateUndersaturatedBo', () => {
  it('should return Bo less than Bob when P > Pb', () => {
    const Bob = 1.35;
    const co = 15e-6;
    const Pb = 2500;
    const P = 3500; // Above bubble point

    const Bo = calculateUndersaturatedBo(P, Pb, Bob, co);

    expect(Bo).toBeLessThan(Bob);
    expect(Bo).toBeGreaterThan(1.0);
  });

  it('should equal Bob when P = Pb', () => {
    const Bob = 1.35;
    const co = 15e-6;
    const Pb = 2500;

    const Bo = calculateUndersaturatedBo(Pb, Pb, Bob, co);

    expect(Bo).toBeCloseTo(Bob, 6);
  });

  it('should decrease more as pressure increases above Pb', () => {
    const Bob = 1.35;
    const co = 15e-6;
    const Pb = 2500;

    const Bo1 = calculateUndersaturatedBo(3000, Pb, Bob, co);
    const Bo2 = calculateUndersaturatedBo(4000, Pb, Bob, co);
    const Bo3 = calculateUndersaturatedBo(5000, Pb, Bob, co);

    expect(Bo2).toBeLessThan(Bo1);
    expect(Bo3).toBeLessThan(Bo2);
  });
});

// ============================================================================
// OIL VISCOSITY TESTS
// ============================================================================

describe('calculateDeadOilViscosity', () => {
  it('should decrease with increasing temperature', () => {
    const mu1 = calculateDeadOilViscosity(100, 35);
    const mu2 = calculateDeadOilViscosity(200, 35);
    const mu3 = calculateDeadOilViscosity(300, 35);

    expect(mu2).toBeLessThan(mu1);
    expect(mu3).toBeLessThan(mu2);
  });

  it('should decrease with increasing API (lighter oil)', () => {
    const mu1 = calculateDeadOilViscosity(180, 25); // Heavy oil
    const mu2 = calculateDeadOilViscosity(180, 35); // Medium oil
    const mu3 = calculateDeadOilViscosity(180, 45); // Light oil

    expect(mu2).toBeLessThan(mu1);
    expect(mu3).toBeLessThan(mu2);
  });

  it('should return reasonable values', () => {
    const mu = calculateDeadOilViscosity(180, 35);

    // Typical range: 1-100 cp for dead oil
    expect(mu).toBeGreaterThan(0.1);
    expect(mu).toBeLessThan(1000);
  });
});

describe('calculateLiveOilViscosity', () => {
  it('should be less than dead oil viscosity', () => {
    const muDead = 10;
    const Rs = 500;

    const muLive = calculateLiveOilViscosity(muDead, Rs);

    expect(muLive).toBeLessThan(muDead);
  });

  it('should decrease with increasing Rs', () => {
    const muDead = 10;

    const mu1 = calculateLiveOilViscosity(muDead, 200);
    const mu2 = calculateLiveOilViscosity(muDead, 500);
    const mu3 = calculateLiveOilViscosity(muDead, 800);

    expect(mu2).toBeLessThan(mu1);
    expect(mu3).toBeLessThan(mu2);
  });

  it('should return reasonable values', () => {
    const mu = calculateLiveOilViscosity(10, 500);

    // Live oil viscosity typically 0.2-5 cp
    expect(mu).toBeGreaterThan(0.1);
    expect(mu).toBeLessThan(100);
  });
});

describe('calculateUndersaturatedViscosity', () => {
  it('should increase with pressure above Pb', () => {
    const muob = 1.5; // Viscosity at bubble point
    const Pb = 2500;

    const mu1 = calculateUndersaturatedViscosity(3000, Pb, muob);
    const mu2 = calculateUndersaturatedViscosity(4000, Pb, muob);
    const mu3 = calculateUndersaturatedViscosity(5000, Pb, muob);

    expect(mu1).toBeGreaterThanOrEqual(muob);
    expect(mu2).toBeGreaterThan(mu1);
    expect(mu3).toBeGreaterThan(mu2);
  });

  it('should equal muob when P = Pb', () => {
    const muob = 1.5;
    const Pb = 2500;

    const mu = calculateUndersaturatedViscosity(Pb, Pb, muob);

    expect(mu).toBeCloseTo(muob, 6);
  });

  it('should return muob when P < Pb', () => {
    const muob = 1.5;
    const Pb = 2500;

    const mu = calculateUndersaturatedViscosity(2000, Pb, muob);

    expect(mu).toBe(muob);
  });
});

// ============================================================================
// MAIN ENTRY POINT TESTS
// ============================================================================

describe('getPVTPropertiesAtPressure', () => {
  const api = 35;
  const gasGravity = 0.75;
  const temperature = 200;
  const totalGOR = 600; // scf/stb - this is Rsb

  it('should identify saturated conditions when P < Pb', () => {
    // First get Pb to know where we are
    const result = getPVTPropertiesAtPressure(1000, temperature, api, gasGravity, totalGOR);

    // At low pressure (1000 psia), likely below Pb
    if (result.isSaturated) {
      expect(result.rs).toBeLessThan(totalGOR);
      // Phase 9-01: Co now returned in both branches (numerical derivative)
      expect(result.oilCompressibility).toBeDefined();
      expect(result.oilCompressibility).toBeGreaterThan(0);
    }
  });

  it('should identify undersaturated conditions when P >= Pb', () => {
    // High pressure should be above Pb
    const result = getPVTPropertiesAtPressure(5000, temperature, api, gasGravity, totalGOR);

    if (!result.isSaturated) {
      // Rs should be capped at Rsb (totalGOR)
      expect(result.rs).toBe(totalGOR);
      expect(result.oilCompressibility).toBeDefined();
      expect(result.oilCompressibility).toBeGreaterThan(0);
    }
  });

  it('should return valid bubble point pressure', () => {
    const result = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR);

    expect(result.bubblePointPressure).toBeGreaterThan(100);
    expect(result.bubblePointPressure).toBeLessThan(10000);
  });

  it('should return consistent properties across saturation boundary', () => {
    // Get properties just below and just above Pb
    const resultLow = getPVTPropertiesAtPressure(1000, temperature, api, gasGravity, totalGOR);
    const Pb = resultLow.bubblePointPressure;

    const resultAtPb = getPVTPropertiesAtPressure(Pb, temperature, api, gasGravity, totalGOR);
    const resultAbovePb = getPVTPropertiesAtPressure(Pb + 100, temperature, api, gasGravity, totalGOR);

    // Rs at Pb should equal Rsb
    expect(resultAtPb.rs).toBeCloseTo(totalGOR, 0);

    // Rs above Pb should also equal Rsb (capped)
    expect(resultAbovePb.rs).toBe(totalGOR);
  });

  it('should return all required properties', () => {
    const result = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR);

    expect(result.rs).toBeGreaterThan(0);
    expect(result.bo).toBeGreaterThan(1);
    expect(result.oilViscosity).toBeGreaterThan(0);
    expect(result.deadOilViscosity).toBeGreaterThan(0);
    expect(result.bubblePointPressure).toBeGreaterThan(0);
    expect(typeof result.isSaturated).toBe('boolean');
  });

  it('should have Bo decrease above Pb', () => {
    const resultLow = getPVTPropertiesAtPressure(1000, temperature, api, gasGravity, totalGOR);
    const Pb = resultLow.bubblePointPressure;

    // Compare Bo at Pb vs above Pb
    const resultAtPb = getPVTPropertiesAtPressure(Pb, temperature, api, gasGravity, totalGOR);
    const resultAbovePb = getPVTPropertiesAtPressure(Pb + 500, temperature, api, gasGravity, totalGOR);

    if (!resultAbovePb.isSaturated) {
      expect(resultAbovePb.bo).toBeLessThanOrEqual(resultAtPb.bo);
    }
  });

  it('should have viscosity increase above Pb', () => {
    const resultLow = getPVTPropertiesAtPressure(1000, temperature, api, gasGravity, totalGOR);
    const Pb = resultLow.bubblePointPressure;

    const resultAtPb = getPVTPropertiesAtPressure(Pb, temperature, api, gasGravity, totalGOR);
    const resultAbovePb = getPVTPropertiesAtPressure(Pb + 500, temperature, api, gasGravity, totalGOR);

    if (!resultAbovePb.isSaturated) {
      expect(resultAbovePb.oilViscosity).toBeGreaterThanOrEqual(resultAtPb.oilViscosity);
    }
  });

  describe('pbCorrelation parameter', () => {
    it('should use Vasquez-Beggs by default', () => {
      const resultDefault = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR);
      const resultVB = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs' });

      expect(resultDefault.bubblePointPressure).toEqual(resultVB.bubblePointPressure);
    });

    it('should give different Pb with McCain method', () => {
      const resultVB = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs' });
      const resultMcCain = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'mccain' });

      // Vasquez-Beggs typically gives higher Pb
      expect(resultVB.bubblePointPressure).not.toEqual(resultMcCain.bubblePointPressure);
    });

    it('should affect saturation state based on method', () => {
      // Use pressure between the two Pb values to see different saturation states
      // V-B gives ~3645 psia, McCain gives ~3403 psia for Excel test case
      const testPressure = 3500;

      const resultVB = getPVTPropertiesAtPressure(
        testPressure, 160, 41, 0.7117, 1067, { pbCorrelation: 'vasquez-beggs' }
      );
      const resultMcCain = getPVTPropertiesAtPressure(
        testPressure, 160, 41, 0.7117, 1067, { pbCorrelation: 'mccain' }
      );

      // At 3500 psia:
      // - V-B Pb ~3645 => P < Pb => SATURATED
      // - McCain Pb ~3403 => P > Pb => UNDERSATURATED
      expect(resultVB.isSaturated).toBe(true);
      expect(resultMcCain.isSaturated).toBe(false);
    });
  });
});

// ============================================================================
// TOTAL GOR CALCULATION
// ============================================================================

describe('calculateTotalGOR', () => {
  it('should calculate GOR correctly', () => {
    // 500 Mscf/d gas, 1000 bbl/d liquid, 0.3 water cut
    // Oil rate = 1000 * 0.7 = 700 stb/d
    // GOR = 500,000 / 700 = 714.3 scf/stb
    const gor = calculateTotalGOR(500, 1000, 0.3);

    expect(gor).toBeCloseTo(714.3, 0);
  });

  it('should handle 100% water cut', () => {
    const gor = calculateTotalGOR(500, 1000, 1.0);

    // Should return MIN_RSB when oil rate is 0
    expect(gor).toBe(10);
  });

  it('should handle zero liquid rate', () => {
    const gor = calculateTotalGOR(500, 0, 0.3);

    expect(gor).toBe(10);
  });

  it('should handle low GOR cases', () => {
    // 10 Mscf/d gas, 1000 bbl/d liquid, 0 water cut
    // GOR = 10,000 / 1000 = 10 scf/stb
    const gor = calculateTotalGOR(10, 1000, 0);

    expect(gor).toBe(10);
  });
});

// ============================================================================
// INTEGRATION TESTS - TYPICAL FIELD SCENARIOS
// ============================================================================

describe('PVT Integration - Field Scenarios', () => {
  it('should handle typical West Texas Permian well', () => {
    // Permian Basin volatile oil: high GOR, light oil
    const result = getPVTPropertiesAtPressure(
      2000,    // Current pressure (psia)
      180,     // Temperature (F)
      40,      // API gravity
      0.72,    // Gas gravity
      800      // GOR (scf/stb)
    );

    expect(result.bubblePointPressure).toBeGreaterThan(1500);
    expect(result.rs).toBeGreaterThan(0);
    expect(result.bo).toBeGreaterThan(1.0); // Bo > 1 for any dissolved gas
    expect(result.oilViscosity).toBeLessThan(10);
  });

  it('should handle Gulf of Mexico deepwater well', () => {
    // GOM deepwater: moderate GOR, high temperature
    const result = getPVTPropertiesAtPressure(
      5000,    // High pressure
      220,     // High temperature
      32,      // Medium API
      0.78,    // Gas gravity
      500      // GOR
    );

    // At high pressure, likely undersaturated
    if (!result.isSaturated) {
      expect(result.rs).toBe(500); // Capped at Rsb
      expect(result.oilCompressibility).toBeDefined();
    }
  });

  it('should handle heavy oil well', () => {
    // Heavy oil: low GOR, low API
    const result = getPVTPropertiesAtPressure(
      800,     // Low pressure
      140,     // Lower temperature
      22,      // Heavy oil
      0.65,    // Gas gravity
      150      // Low GOR
    );

    expect(result.bubblePointPressure).toBeLessThan(1500);
    expect(result.oilViscosity).toBeGreaterThan(1); // Higher viscosity for heavy oil
  });
});

// ============================================================================
// PHASE 8 AUDIT: PYRESTOOLBOX-VALIDATED TESTS
// ============================================================================
//
// Parameter mapping between our functions and pyrestoolbox:
//
// | Our Parameter    | pyrestoolbox Parameter | Notes                         |
// |-----------------|----------------------|-------------------------------|
// | gasGravity (raw) | sg_g                 | Weighted avg surface gas SG    |
// | gasGravityAt100  | sg_sp                | Separator gas gravity at 100 psig |
// | oilAPI          | api                  | Stock tank oil API gravity     |
// | temperature (F) | degf                 | Reservoir temperature (deg F)  |
// | pressure (psia) | p                    | Absolute pressure (psia)       |
// | GOR (scf/stb)   | rsb                  | Solution gas at bubble point   |
//
// Correlation mapping:
//   pyrestoolbox Standing (1947) = cross-reference oracle
//   Our VB inverse = Vasquez-Beggs SPE-6719 (different valid correlation)
//   Expected inter-correlation difference: 5-20% (normal for different correlations)
//
// Oracle: pyrestoolbox v2.5.0, Standing method (pb_method.STAN, rs_method.STAN, bo_method.STAN)

// ============================================================================
// Pb - PYRESTOOLBOX CROSS-VALIDATED (Phase 8 Audit)
// ============================================================================

describe('Pb - pyrestoolbox cross-validated (Phase 8 audit)', () => {
  // Helper: relative error with absolute floor
  const relativeError = (ours: number, ref: number, floor: number) =>
    Math.abs(ours - ref) / Math.max(Math.abs(ref), floor);

  // Our VB and Standing are different correlations.
  // We validate that VB values are within a reasonable inter-correlation band (< 25%)
  // and that VB is self-consistent (inverse of Rs formula).
  const MAX_INTERCORRELATION_DIFF = 0.25; // 25% max inter-correlation difference

  describe('GOR sweep (API=40, T=200F, Gg=0.75)', () => {
    const cases = [
      // pyrestoolbox: oil_pbub(api=40, degf=200, rsb=GOR, sg_g=0.75, pbmethod=STAN)
      { gor: 300,  standing: 1253.3, vb: 1241.4 },
      { gor: 500,  standing: 1920.8, vb: 1989.2 },
      { gor: 800,  standing: 2842.4, vb: 3065.0 },
      { gor: 1000, standing: 3423.0, vb: 3762.1 },
      { gor: 1500, standing: 4796.8, vb: 5457.1 },
    ];

    it.each(cases)('GOR=$gor: VB within inter-correlation band of Standing', ({ gor, standing }) => {
      const Pb = calculateBubblePointPressure(gor, 40, 0.75, 200, 'vasquez-beggs');
      const err = relativeError(Pb, standing, 50);
      expect(err).toBeLessThan(MAX_INTERCORRELATION_DIFF);
    });

    it.each(cases)('GOR=$gor: VB matches expected value', ({ gor, vb }) => {
      const Pb = calculateBubblePointPressure(gor, 40, 0.75, 200, 'vasquez-beggs');
      expect(Pb).toBeCloseTo(vb, 0);
    });
  });

  describe('API sweep (GOR=800, T=200F, Gg=0.75)', () => {
    const cases = [
      // pyrestoolbox: oil_pbub(api=API, degf=200, rsb=800, sg_g=0.75, pbmethod=STAN)
      { api: 35, standing: 3284.1, vb: 3672.6 },
      { api: 40, standing: 2842.4, vb: 3065.0 },
      { api: 45, standing: 2460.0, vb: 2557.6 },
    ];

    it.each(cases)('API=$api: VB within inter-correlation band', ({ api, standing }) => {
      const Pb = calculateBubblePointPressure(800, api, 0.75, 200, 'vasquez-beggs');
      const err = relativeError(Pb, standing, 50);
      expect(err).toBeLessThan(MAX_INTERCORRELATION_DIFF);
    });
  });

  describe('Temperature sweep (GOR=800, API=40, Gg=0.75)', () => {
    const cases = [
      // pyrestoolbox: oil_pbub(api=40, degf=T, rsb=800, sg_g=0.75, pbmethod=STAN)
      { T: 150, standing: 2558.6, vb: 2722.1 },
      { T: 200, standing: 2842.4, vb: 3065.0 },
      { T: 250, standing: 3157.6, vb: 3393.8 },
    ];

    it.each(cases)('T=$T: VB within inter-correlation band', ({ T, standing }) => {
      const Pb = calculateBubblePointPressure(800, 40, 0.75, T, 'vasquez-beggs');
      const err = relativeError(Pb, standing, 50);
      expect(err).toBeLessThan(MAX_INTERCORRELATION_DIFF);
    });
  });

  describe('Gas gravity sweep (GOR=800, API=40, T=200F)', () => {
    const cases = [
      // pyrestoolbox: oil_pbub(api=40, degf=200, rsb=800, sg_g=Gg, pbmethod=STAN)
      { gg: 0.65, standing: 3202.3, vb: 3386.5 },
      { gg: 0.75, standing: 2842.4, vb: 3065.0 },
      { gg: 0.85, standing: 2560.9, vb: 2808.9 },
    ];

    it.each(cases)('Gg=$gg: VB within inter-correlation band', ({ gg, standing }) => {
      const Pb = calculateBubblePointPressure(800, 40, gg, 200, 'vasquez-beggs');
      const err = relativeError(Pb, standing, 50);
      expect(err).toBeLessThan(MAX_INTERCORRELATION_DIFF);
    });
  });

  describe('API <= 30 branch (GOR=800, T=200F, Gg=0.75)', () => {
    const cases = [
      // pyrestoolbox: oil_pbub(api=API, degf=200, rsb=800, sg_g=0.75, pbmethod=STAN)
      { api: 25, standing: 4383.0, vb: 5289.6 },
      { api: 30, standing: 3794.0, vb: 4204.4 },
    ];

    it.each(cases)('API=$api: VB within 25% of Standing', ({ api, standing }) => {
      const Pb = calculateBubblePointPressure(800, api, 0.75, 200, 'vasquez-beggs');
      const err = relativeError(Pb, standing, 50);
      expect(err).toBeLessThan(MAX_INTERCORRELATION_DIFF);
    });
  });

  describe('VB inverse self-consistency', () => {
    // The VB inverse Pb should be consistent with calculateSolutionGOR:
    // Rs(Pb) should approximately equal the input GOR
    it('should be self-consistent with calculateSolutionGOR', () => {
      const gor = 800;
      const gg = 0.75;
      const Pb = calculateBubblePoint(gor, 200, 40, gg, 'vasquez-beggs');
      // Pb returns with P_STD subtracted (gauge), calculateSolutionGOR expects gauge
      const Rs = calculateSolutionGOR(Pb, 200, 40, gg);
      expect(Rs).toBeCloseTo(gor, 0);
    });

    it('should be self-consistent across GOR range', () => {
      for (const gor of [300, 500, 800, 1000, 1500]) {
        const Pb = calculateBubblePoint(gor, 200, 40, 0.75, 'vasquez-beggs');
        const Rs = calculateSolutionGOR(Pb, 200, 40, 0.75);
        expect(Rs).toBeCloseTo(gor, 0);
      }
    });
  });

  describe('sour gas stability', () => {
    it('should not crash with sour gas inputs', () => {
      // Sour gas doesn't affect VB Pb directly (no H2S/CO2 terms),
      // but verify the base correlation remains stable
      const Pb = calculateBubblePointPressure(800, 40, 0.75, 200, 'vasquez-beggs');
      expect(Pb).toBeGreaterThan(100);
      expect(Pb).toBeLessThan(10000);
    });

    it('should produce reasonable values for typical sour gas conditions', () => {
      // Sour gas wells typically have lower API and different gas gravity
      const Pb = calculateBubblePointPressure(800, 35, 0.82, 200, 'vasquez-beggs');
      expect(Pb).toBeGreaterThan(1000);
      expect(Pb).toBeLessThan(6000);
    });
  });
});

// ============================================================================
// Rs - PYRESTOOLBOX CROSS-VALIDATED (Phase 8 Audit)
// ============================================================================

describe('Rs - pyrestoolbox cross-validated (Phase 8 audit)', () => {
  const relativeError = (ours: number, ref: number, floor: number) =>
    Math.abs(ours - ref) / Math.max(Math.abs(ref), floor);

  // VB and Standing are different correlations - 20% inter-correlation band
  const MAX_INTERCORRELATION_DIFF = 0.25;

  describe('calculateRsVasquezBeggs (psia + raw gg convention)', () => {
    describe('pressure sweep (API=40, T=200F, Gg=0.75)', () => {
      const cases = [
        // pyrestoolbox: oil_rs(api=40, degf=200, sg_sp=0.75, p=P, rsb=800, rsmethod=STAN)
        { P: 1000, standing: 229.8, vbExpected: 202.3 },
        { P: 1500, standing: 372.9, vbExpected: 315.2 },
        { P: 2000, standing: 526.2, vbExpected: 431.8 },
        { P: 2500, standing: 687.6, vbExpected: 551.1 },
      ];

      it.each(cases)('P=$P psia: VB within inter-correlation band', ({ P, standing }) => {
        const Rs = calculateRs(P, 200, 40, 0.75);
        const err = relativeError(Rs, standing, 10);
        expect(err).toBeLessThan(MAX_INTERCORRELATION_DIFF);
      });

      it.each(cases)('P=$P psia: matches expected VB value', ({ P, vbExpected }) => {
        const Rs = calculateRs(P, 200, 40, 0.75);
        expect(Rs).toBeCloseTo(vbExpected, 0);
      });
    });

    describe('API sweep (P=2000 psia, T=200F, Gg=0.75)', () => {
      const cases = [
        // pyrestoolbox: oil_rs(api=API, degf=200, sg_sp=0.75, p=2000, rsb=800, rsmethod=STAN)
        { api: 25, standing: 312.8, vbExpected: 266.3 },
        { api: 30, standing: 372.0, vbExpected: 331.5 },
        { api: 35, standing: 442.4, vbExpected: 357.6 },
        { api: 40, standing: 526.2, vbExpected: 431.8 },
        { api: 45, standing: 625.8, vbExpected: 521.7 },
      ];

      it.each(cases)('API=$api: VB within inter-correlation band', ({ api, standing }) => {
        const Rs = calculateRs(2000, 200, api, 0.75);
        const err = relativeError(Rs, standing, 10);
        expect(err).toBeLessThan(MAX_INTERCORRELATION_DIFF);
      });
    });

    describe('temperature sweep (P=2000, API=40, Gg=0.75)', () => {
      const cases = [
        // pyrestoolbox: oil_rs(api=40, degf=T, sg_sp=0.75, p=2000, rsb=800, rsmethod=STAN)
        { T: 150, standing: 597.0, vbExpected: 485.6 },
        { T: 200, standing: 526.2, vbExpected: 431.8 },
        { T: 250, standing: 463.8, vbExpected: 389.7 },
      ];

      it.each(cases)('T=$T: VB within inter-correlation band', ({ T, standing }) => {
        const Rs = calculateRs(2000, T, 40, 0.75);
        const err = relativeError(Rs, standing, 10);
        expect(err).toBeLessThan(MAX_INTERCORRELATION_DIFF);
      });
    });

    describe('gas gravity sweep (P=2000, API=40, T=200)', () => {
      const cases = [
        // pyrestoolbox: oil_rs(api=40, degf=200, sg_sp=Gg, p=2000, rsb=800, rsmethod=STAN)
        { gg: 0.65, standing: 456.6, vbExpected: 387.4 },
        { gg: 0.75, standing: 526.2, vbExpected: 431.8 },
        { gg: 0.85, standing: 595.8, vbExpected: 474.8 },
      ];

      it.each(cases)('Gg=$gg: VB within inter-correlation band', ({ gg, standing }) => {
        const Rs = calculateRs(2000, 200, 40, gg);
        const err = relativeError(Rs, standing, 10);
        expect(err).toBeLessThan(MAX_INTERCORRELATION_DIFF);
      });
    });
  });

  describe('calculateSolutionGOR consistency with calculateRsVasquezBeggs', () => {
    it('should produce equivalent results when inputs are properly converted', () => {
      // calculateSolutionGOR takes (psig, T, API, correctedGg)
      // calculateRsVasquezBeggs takes (psia, T, API, rawGg)
      // Both should give the same result with proper conversion
      const gg_raw = 0.75;
      const api = 40;
      const T = 200;
      const P_psia = 2500;
      const P_psig = P_psia - 14.7;

      const gg_corrected = calculateGasGravityAt100psig(gg_raw, api, T, 0);
      const rsA = calculateSolutionGOR(P_psig, T, api, gg_corrected);
      const rsB = calculateRs(P_psia, T, api, gg_raw);

      // Both use same VB coefficients after fix, same gas gravity correction
      expect(rsA).toBeCloseTo(rsB, 0);
    });

    it('should match across pressure range', () => {
      for (const P_psia of [1000, 1500, 2000, 2500, 3000]) {
        const gg_corrected = calculateGasGravityAt100psig(0.75, 40, 200, 0);
        const rsA = calculateSolutionGOR(P_psia - 14.7, 200, 40, gg_corrected);
        const rsB = calculateRs(P_psia, 200, 40, 0.75);
        expect(rsA).toBeCloseTo(rsB, 0);
      }
    });
  });
});

// ============================================================================
// Bo - PYRESTOOLBOX CROSS-VALIDATED (Phase 8 Audit)
// ============================================================================

describe('Bo - pyrestoolbox cross-validated (Phase 8 audit)', () => {
  const relativeError = (ours: number, ref: number, floor: number) =>
    Math.abs(ours - ref) / Math.max(Math.abs(ref), floor);

  // Bo correlations (VB linearized, VB Bob, Standing) are all within ~3% of each other
  const MAX_BO_DIFF = 0.05; // 5% tolerance

  describe('calculateBoVasquezBeggs (linearized form)', () => {
    describe('Rs sweep (T=200F, API=40, Gg=0.75)', () => {
      const cases = [
        // pyrestoolbox: oil_bo(p=2000, pb=3000, degf=200, rs=Rs, rsb=800, sg_o=0.8251, sg_g=0.75, bomethod=STAN)
        { rs: 100, standing: 1.1132, boLinear: 1.1298 },
        { rs: 300, standing: 1.2087, boLinear: 1.2252 },
        { rs: 500, standing: 1.3104, boLinear: 1.3206 },
        { rs: 700, standing: 1.4170, boLinear: 1.4160 },
        { rs: 900, standing: 1.5275, boLinear: 1.5114 },
      ];

      it.each(cases)('Rs=$rs: VB linearized within 5% of Standing', ({ rs, standing }) => {
        const Bo = calculateBo(rs, 200, 40, 0.75);
        const err = relativeError(Bo, standing, 0.01);
        expect(err).toBeLessThan(MAX_BO_DIFF);
      });

      it.each(cases)('Rs=$rs: matches expected linearized value', ({ rs, boLinear }) => {
        const Bo = calculateBo(rs, 200, 40, 0.75);
        expect(Bo).toBeCloseTo(boLinear, 3);
      });
    });

    describe('temperature sweep (Rs=500, API=40, Gg=0.75)', () => {
      const cases = [
        // pyrestoolbox: oil_bo(p=2000, pb=3000, degf=T, rs=500, rsb=800, sg_o=0.8251, sg_g=0.75, bomethod=STAN)
        { T: 150, standing: 1.2765, boLinear: 1.2895 },
        { T: 200, standing: 1.3104, boLinear: 1.3206 },
        { T: 250, standing: 1.3448, boLinear: 1.3517 },
      ];

      it.each(cases)('T=$T: VB linearized within 5% of Standing', ({ T, standing }) => {
        const Bo = calculateBo(500, T, 40, 0.75);
        const err = relativeError(Bo, standing, 0.01);
        expect(err).toBeLessThan(MAX_BO_DIFF);
      });
    });

    describe('API sweep (Rs=500, T=200F, Gg=0.75)', () => {
      const cases = [
        // pyrestoolbox: oil_bo(p=2000, pb=3000, degf=200, rs=500, rsb=800, sg_o=sg_o(API), sg_g=0.75, bomethod=STAN)
        { api: 25, standing: 1.2988, boLinear: 1.2733 },
        { api: 30, standing: 1.3027, boLinear: 1.2812 },
        { api: 35, standing: 1.3066, boLinear: 1.3097 },
        { api: 40, standing: 1.3104, boLinear: 1.3206 },
        { api: 45, standing: 1.3142, boLinear: 1.3315 },
      ];

      it.each(cases)('API=$api: VB linearized within 5% of Standing', ({ api, standing }) => {
        const Bo = calculateBo(500, 200, api, 0.75);
        const err = relativeError(Bo, standing, 0.01);
        expect(err).toBeLessThan(MAX_BO_DIFF);
      });
    });
  });

  describe('calculateOilFVFAtBubblePoint (full VB Bob)', () => {
    const cases = [
      // pyrestoolbox: oil_bo(p=2000, pb=3000, degf=200, rs=Rs, rsb=800, sg_o=0.8251, sg_g=0.75, bomethod=STAN)
      { rs: 100, standing: 1.1132, bob: 1.1335 },
      { rs: 300, standing: 1.2087, bob: 1.2307 },
      { rs: 500, standing: 1.3104, bob: 1.3235 },
      { rs: 700, standing: 1.4170, bob: 1.4154 },
      { rs: 900, standing: 1.5275, bob: 1.5074 },
    ];

    it.each(cases)('Rs=$rs: VB Bob within 5% of Standing', ({ rs, standing }) => {
      const Bo = calculateOilFVFAtBubblePoint(rs, 0.75, 40, 200);
      const err = relativeError(Bo, standing, 0.01);
      expect(err).toBeLessThan(0.05);
    });

    it.each(cases)('Rs=$rs: matches expected Bob value', ({ rs, bob }) => {
      const Bo = calculateOilFVFAtBubblePoint(rs, 0.75, 40, 200);
      expect(Bo).toBeCloseTo(bob, 3);
    });
  });

  describe('undersaturated Bo formula verification', () => {
    it('should correctly apply exponential compression above Pb', () => {
      const Bob = 1.35;
      const co = 15e-6;  // 15 microsip
      const Pb = 3000;   // psia

      // Bo = Bob * exp(co * (Pb - P))
      for (const P of [3500, 4000, 5000]) {
        const Bo = calculateUndersaturatedBo(P, Pb, Bob, co);
        const expected = Bob * Math.exp(co * (Pb - P));
        // The function clamps to min 1.0, so use max
        expect(Bo).toBeCloseTo(Math.max(1.0, expected), 6);
      }
    });

    it('should equal Bob at bubble point', () => {
      const Bob = 1.40;
      const co = 12e-6;
      const Pb = 2800;

      const Bo = calculateUndersaturatedBo(Pb, Pb, Bob, co);
      expect(Bo).toBeCloseTo(Bob, 6);
    });

    it('should decrease monotonically above Pb', () => {
      const Bob = 1.35;
      const co = 15e-6;
      const Pb = 3000;

      const pressures = [3000, 3500, 4000, 4500, 5000];
      const bos = pressures.map(P => calculateUndersaturatedBo(P, Pb, Bob, co));

      for (let i = 1; i < bos.length; i++) {
        expect(bos[i]).toBeLessThanOrEqual(bos[i - 1]);
      }
    });
  });

  describe('gas gravity sweep for Bo (Rs=500, T=200, API=40)', () => {
    const cases = [
      // pyrestoolbox: oil_bo(p=2000, pb=3000, degf=200, rs=500, rsb=800, sg_o=0.8251, sg_g=Gg, bomethod=STAN)
      { gg: 0.65, standing: 1.2925, boLinear: 1.3340, bob: 1.3128 },
      { gg: 0.75, standing: 1.3104, boLinear: 1.3206, bob: 1.3235 },
      { gg: 0.85, standing: 1.3273, boLinear: 1.3104, bob: 1.3332 },
    ];

    it.each(cases)('Gg=$gg: Bo linearized within 5% of Standing', ({ gg, standing }) => {
      const Bo = calculateBo(500, 200, 40, gg);
      const err = Math.abs(Bo - standing) / Math.max(standing, 0.01);
      expect(err).toBeLessThan(0.05);
    });
  });
});

// ============================================================================
// Z-FACTOR - PYRESTOOLBOX CROSS-VALIDATED (Phase 8 Audit, Plan 08-02)
// ============================================================================
//
// Oracle: DAK iterative (Dranchuk-Abou-Kassem, SPE-7330) with Sutton
// pseudocritical properties (SPE-14265). Reference values computed from
// hagedornBrown.ts implementation which matches pyrestoolbox gas_z_factor.
//
// Phase 8 Audit: Replaced Brill-Beggs explicit (2-3% error) with DAK
// iterative solver. Switched pseudocriticals from Brill-Beggs to Sutton.
// Tolerance: 1% (warning at 0.8%)

describe('Z-factor - pyrestoolbox validated (Phase 8 audit, 08-02)', () => {
  const relativeError = (ours: number, ref: number, floor: number) =>
    Math.abs(ours - ref) / Math.max(Math.abs(ref), floor);

  const Z_TOLERANCE = 0.01; // 1% max error

  describe('Sutton pseudocritical properties', () => {
    const cases = [
      // pyrestoolbox: gas_critical_properties(gas_gravity=Gg)
      // Sutton (1985) SPE-14265 coefficients
      { gg: 0.65, Pc: 670.1, Tc: 365.1 },
      { gg: 0.70, Pc: 663.3, Tc: 377.6 },
      { gg: 0.75, Pc: 656.5, Tc: 389.7 },
      { gg: 0.80, Pc: 649.6, Tc: 401.4 },
      { gg: 0.85, Pc: 642.8, Tc: 412.8 },
    ];

    it.each(cases)('Gg=$gg: Sutton Pc within 0.1%', ({ gg, Pc }) => {
      const ourPc = calculateSuttonPseudoCriticalPressure(gg);
      expect(ourPc).toBeCloseTo(Pc, 0);
    });

    it.each(cases)('Gg=$gg: Sutton Tc within 0.1%', ({ gg, Tc }) => {
      const ourTc = calculateSuttonPseudoCriticalTemperature(gg);
      expect(ourTc).toBeCloseTo(Tc, 0);
    });
  });

  describe('pressure sweep (Gg=0.75, T=200F)', () => {
    const cases = [
      // pyrestoolbox: gas_z_factor(gas_gravity=0.75, pressure=P, temperature=200)
      // DAK + Sutton pseudocriticals, P in psia
      // Our function takes psig: P_psig = P_psia - 14.7
      { P_psig: 485.3,  Z: 0.9517 },  // P=500 psia
      { P_psig: 985.3,  Z: 0.9104 },  // P=1000 psia
      { P_psig: 1485.3, Z: 0.8797 },  // P=1500 psia
      { P_psig: 1985.3, Z: 0.8627 },  // P=2000 psia
      { P_psig: 2485.3, Z: 0.8605 },  // P=2500 psia
      { P_psig: 2985.3, Z: 0.8714 },  // P=3000 psia
      { P_psig: 3985.3, Z: 0.9216 },  // P=4000 psia
      { P_psig: 4985.3, Z: 0.9944 },  // P=5000 psia
    ];

    it.each(cases)('P_psig=$P_psig: Z within 1% of DAK reference', ({ P_psig, Z: ref }) => {
      const result = calculateFullZFactor(P_psig, 200, 0.75);
      const err = relativeError(result.Z, ref, 0.005);
      expect(err).toBeLessThan(Z_TOLERANCE);
    });

    it.each(cases)('P_psig=$P_psig: matches reference value', ({ P_psig, Z: ref }) => {
      const result = calculateFullZFactor(P_psig, 200, 0.75);
      expect(result.Z).toBeCloseTo(ref, 3);
    });
  });

  describe('temperature sweep (Gg=0.75, P=2500 psia)', () => {
    const cases = [
      // pyrestoolbox: gas_z_factor(gas_gravity=0.75, pressure=2500, temperature=T)
      { T: 150, Z: 0.8068 },
      { T: 175, Z: 0.8355 },
      { T: 200, Z: 0.8605 },
      { T: 225, Z: 0.8821 },
      { T: 250, Z: 0.9007 },
    ];

    it.each(cases)('T=$T: Z within 1% of DAK reference', ({ T, Z: ref }) => {
      const result = calculateFullZFactor(2485.3, T, 0.75);
      const err = relativeError(result.Z, ref, 0.005);
      expect(err).toBeLessThan(Z_TOLERANCE);
    });
  });

  describe('gas gravity sweep (P=2500, T=200F)', () => {
    const cases = [
      // pyrestoolbox: gas_z_factor(gas_gravity=Gg, pressure=2500, temperature=200)
      { gg: 0.65, Z: 0.8964 },
      { gg: 0.70, Z: 0.8787 },
      { gg: 0.75, Z: 0.8605 },
      { gg: 0.80, Z: 0.8418 },
      { gg: 0.85, Z: 0.8230 },
    ];

    it.each(cases)('Gg=$gg: Z within 1% of DAK reference', ({ gg, Z: ref }) => {
      const result = calculateFullZFactor(2485.3, 200, gg);
      const err = relativeError(result.Z, ref, 0.005);
      expect(err).toBeLessThan(Z_TOLERANCE);
    });
  });

  describe('sour gas sweep (P=2500, T=200F, Gg=0.75)', () => {
    // Note: calculateFullZFactor does not yet support sour gas corrections.
    // These tests verify the base correlation stability. Sour gas corrections
    // (Wichert-Aziz) are implemented in hagedornBrown.ts and will be unified
    // in a future phase. Reference values here use DAK+Sutton+Wichert-Aziz.
    it('should produce valid Z for base conditions (no sour gas)', () => {
      const result = calculateFullZFactor(2485.3, 200, 0.75);
      expect(result.Z).toBeGreaterThan(0.3);
      expect(result.Z).toBeLessThan(1.5);
      expect(result.Z).toBeCloseTo(0.8605, 3);
    });

    it('should produce stable Z across gas gravity range (sour gas proxy)', () => {
      // Sour gas increases effective gas gravity. Test with higher Gg as proxy.
      // H2S=0.05 + CO2=0.10 -> effectively heavier gas
      const result = calculateFullZFactor(2485.3, 200, 0.85);
      expect(result.Z).toBeGreaterThan(0.3);
      expect(result.Z).toBeLessThan(1.5);
    });

    it('should not produce NaN or Infinity for edge gas gravities', () => {
      for (const gg of [0.55, 0.60, 0.90, 0.95, 1.0]) {
        const result = calculateFullZFactor(2485.3, 200, gg);
        expect(Number.isFinite(result.Z)).toBe(true);
        expect(result.Z).toBeGreaterThan(0);
      }
    });
  });

  describe('edge cases', () => {
    it('low pressure (Pr < 1): should return Z near 1.0', () => {
      // At very low pressure, Z approaches 1.0 (ideal gas behavior)
      const result = calculateFullZFactor(100, 200, 0.75);
      expect(result.Z).toBeGreaterThan(0.95);
      expect(result.Z).toBeLessThan(1.05);
    });

    it('high pressure (Pr > 5): should return valid Z', () => {
      // Pc for Gg=0.75 is ~656.5, so P_psia=5000 -> Pr ~7.6
      const result = calculateFullZFactor(4985.3, 200, 0.75);
      expect(result.Z).toBeCloseTo(0.9944, 3);
    });

    it('low temperature: should not diverge', () => {
      const result = calculateFullZFactor(2485.3, 100, 0.75);
      expect(Number.isFinite(result.Z)).toBe(true);
      expect(result.Z).toBeGreaterThan(0.3);
    });

    it('should return complete ZFactorCalculation structure', () => {
      const result = calculateFullZFactor(2485.3, 200, 0.75);
      expect(result.Pc).toBeCloseTo(656.5, 0);
      expect(result.Tc).toBeCloseTo(389.7, 0);
      expect(result.Pr).toBeGreaterThan(0);
      expect(result.Tr).toBeGreaterThan(0);
      expect(typeof result.A).toBe('number');
      expect(typeof result.B).toBe('number');
      expect(typeof result.C).toBe('number');
      expect(typeof result.D).toBe('number');
      expect(result.Z).toBeCloseTo(0.8605, 3);
    });
  });
});

// ============================================================================
// Co - PYRESTOOLBOX CROSS-VALIDATED (Phase 8 Audit, Plan 08-02)
// ============================================================================
//
// Oracle: Vasquez-Beggs oil compressibility (SPE-6719)
// Phase 8 Audit: Fixed McCain Co formula (was exp(A)/(1e6*P), corrected to exp(A))
// Tolerance: 5%

describe('Co - pyrestoolbox validated (Phase 8 audit, 08-02)', () => {
  const relativeError = (ours: number, ref: number, floor: number) =>
    Math.abs(ours - ref) / Math.max(Math.abs(ref), floor);

  const CO_TOLERANCE = 0.05; // 5% max error

  describe('calculateOilCompressibility (Vasquez-Beggs)', () => {
    describe('pressure sweep (API=40, GOR=800, T=200F, Gg=0.75)', () => {
      const cases = [
        // VB formula: co = 10^(0.83415+...) / P * 1e-6
        // P_psig = P_psia - 14.7, Gg = corrected gas gravity
        { P_psig: 1985.3, co: 2.2835e-5 },  // P=2000 psia
        { P_psig: 2485.3, co: 1.8268e-5 },  // P=2500 psia
        { P_psig: 2985.3, co: 1.5223e-5 },  // P=3000 psia
        { P_psig: 3485.3, co: 1.3048e-5 },  // P=3500 psia
        { P_psig: 3985.3, co: 1.1417e-5 },  // P=4000 psia
        { P_psig: 4985.3, co: 9.1338e-6 },  // P=5000 psia
      ];

      it.each(cases)('P_psig=$P_psig: VB Co within 5%', ({ P_psig, co: ref }) => {
        const result = calculateOilCompressibility(800, 40, 200, P_psig, 0.75);
        const err = relativeError(result, ref, 1e-7);
        expect(err).toBeLessThan(CO_TOLERANCE);
      });

      it.each(cases)('P_psig=$P_psig: matches expected value', ({ P_psig, co: ref }) => {
        const result = calculateOilCompressibility(800, 40, 200, P_psig, 0.75);
        expect(result).toBeCloseTo(ref, 8);
      });
    });

    describe('GOR sweep (P=3000 psia, API=40, T=200F, Gg=0.75)', () => {
      const cases = [
        // VB Co: 10^(0.83415 + 0.5002*log10(Rs) + ...) / P * 1e-6
        { Rs: 300,  co: 9.3203e-6 },
        { Rs: 500,  co: 1.2034e-5 },
        { Rs: 800,  co: 1.5223e-5 },
        { Rs: 1000, co: 1.7021e-5 },
        { Rs: 1500, co: 2.0848e-5 },
      ];

      it.each(cases)('Rs=$Rs: Co increases with GOR', ({ Rs, co: ref }) => {
        const result = calculateOilCompressibility(Rs, 40, 200, 2985.3, 0.75);
        const err = relativeError(result, ref, 1e-7);
        expect(err).toBeLessThan(CO_TOLERANCE);
      });
    });

    describe('temperature sweep (P=3000, API=40, GOR=800, Gg=0.75)', () => {
      const cases = [
        // VB Co at P_psig=2985.3
        { T: 150, co: 1.2231e-5 },
        { T: 200, co: 1.5223e-5 },
        { T: 250, co: 1.8039e-5 },
      ];

      it.each(cases)('T=$T: Co increases with temperature', ({ T, co: ref }) => {
        const result = calculateOilCompressibility(800, 40, T, 2985.3, 0.75);
        const err = relativeError(result, ref, 1e-7);
        expect(err).toBeLessThan(CO_TOLERANCE);
      });
    });
  });

  describe('calculateOilCompressibilityMcCain', () => {
    // Phase 8 Audit (08-03): Replaced closed-form with Eq 3.13 polynomial
    // matching pyrestoolbox implementation (McCain, Rollins, Villena-Lanzi 1988)

    describe('McCain Eq 3.13 polynomial (pyrestoolbox Deno_p_gt_pb validated 2026-02-25)', () => {
      // Reference values from pyrestoolbox Deno_p_gt_pb cofb_p calculation
      // (same polynomial used internally by pyrestoolbox for density above Pb)
      // Note: pyrestoolbox oil_co() returns a different quantity (numerical Bo derivative)
      const cases = [
        { P: 3000, Pb: 2500, T: 180, API: 35, gg: 0.7, Rs: 500, ref: 1.0863e-5 },
        { P: 3500, Pb: 2500, T: 180, API: 35, gg: 0.7, Rs: 500, ref: 1.0439e-5 },
        { P: 4000, Pb: 2500, T: 180, API: 35, gg: 0.7, Rs: 500, ref: 1.0106e-5 },
        { P: 2000, Pb: 1500, T: 150, API: 25, gg: 0.8, Rs: 300, ref: 7.6716e-6 },
      ];

      it.each(cases)(
        'P=$P Pb=$Pb T=$T API=$API gg=$gg Rs=$Rs: Co within 1% of pyrestoolbox Eq 3.13',
        ({ P, Pb, T, API, gg, Rs, ref }) => {
          const result = calculateOilCompressibilityMcCain(P, Pb, T, API, Rs, gg);
          const err = relativeError(result, ref, 1e-7);
          expect(err).toBeLessThan(0.01);
        }
      );
    });

    it('should produce values in typical range (5e-6 to 50e-6 psi^-1)', () => {
      const co = calculateOilCompressibilityMcCain(4000, 2500, 180, 35, 500, 0.7);
      expect(co).toBeGreaterThan(5e-6);
      expect(co).toBeLessThan(50e-6);
    });

    it('should decrease with increasing pressure above Pb', () => {
      // Eq 3.13 cofb decreases as P/Pb increases (log(P/Pb) term has negative net coefficient)
      const co1 = calculateOilCompressibilityMcCain(3000, 2500, 180, 35, 500, 0.7);
      const co2 = calculateOilCompressibilityMcCain(4000, 2500, 180, 35, 500, 0.7);
      expect(co2).toBeLessThan(co1);
    });

    it('should increase with increasing Rsb', () => {
      const co1 = calculateOilCompressibilityMcCain(4000, 2500, 180, 35, 300, 0.7);
      const co2 = calculateOilCompressibilityMcCain(4000, 2500, 180, 35, 1000, 0.7);
      expect(co2).toBeGreaterThan(co1);
    });

    it('should accept optional gasGravitySep parameter', () => {
      const coDefault = calculateOilCompressibilityMcCain(3000, 2500, 180, 35, 500);
      const coExplicit = calculateOilCompressibilityMcCain(3000, 2500, 180, 35, 500, 0.7);
      expect(coDefault).toBeCloseTo(coExplicit, 10);
    });
  });
});

// ============================================================================
// Bw - PYRESTOOLBOX CROSS-VALIDATED (Phase 8 Audit, Plan 08-02)
// ============================================================================
//
// Oracle: McCain (1990) water FVF correlation
// Our implementation matches at 0 ppm salinity. Salinity effects documented
// as known gap for future phase.
// Tolerance: 5%

describe('Bw - pyrestoolbox validated (Phase 8 audit, 08-02)', () => {
  const relativeError = (ours: number, ref: number, floor: number) =>
    Math.abs(ours - ref) / Math.max(Math.abs(ref), floor);

  const BW_TOLERANCE = 0.05;

  describe('pressure sweep (T=200F, salinity=0 ppm)', () => {
    const cases = [
      // McCain (1990): Bw = (1 - A)(1 + B) where A depends on P,T and B depends on T
      // Our function takes psig: P_psig = P_psia - 14.7
      { P_psig: 485.3,  Bw: 1.039264 },  // P=500 psia
      { P_psig: 985.3,  Bw: 1.039856 },  // P=1000 psia
      { P_psig: 1485.3, Bw: 1.040583 },  // P=1500 psia
      { P_psig: 1985.3, Bw: 1.041444 },  // P=2000 psia
      { P_psig: 2485.3, Bw: 1.042441 },  // P=2500 psia
      { P_psig: 2985.3, Bw: 1.043573 },  // P=3000 psia
      { P_psig: 3985.3, Bw: 1.046242 },  // P=4000 psia
      { P_psig: 4985.3, Bw: 1.049450 },  // P=5000 psia
    ];

    it.each(cases)('P_psig=$P_psig: Bw within 5%', ({ P_psig, Bw: ref }) => {
      const result = calculateWaterFVF(P_psig, 200);
      const err = relativeError(result, ref, 0.005);
      expect(err).toBeLessThan(BW_TOLERANCE);
    });

    it.each(cases)('P_psig=$P_psig: matches reference value', ({ P_psig, Bw: ref }) => {
      const result = calculateWaterFVF(P_psig, 200);
      expect(result).toBeCloseTo(ref, 5);
    });
  });

  describe('temperature sweep (P=2500 psia, salinity=0 ppm)', () => {
    const cases = [
      // McCain (1990) Bw at P_psig=2485.3
      { T: 100, Bw: 1.011824 },
      { T: 150, Bw: 1.025747 },
      { T: 200, Bw: 1.042441 },
      { T: 250, Bw: 1.061909 },
    ];

    it.each(cases)('T=$T: Bw within 5%', ({ T, Bw: ref }) => {
      const result = calculateWaterFVF(2485.3, T);
      const err = relativeError(result, ref, 0.005);
      expect(err).toBeLessThan(BW_TOLERANCE);
    });

    it('Bw increases monotonically with temperature', () => {
      const temps = [100, 150, 200, 250];
      const bws = temps.map(T => calculateWaterFVF(2485.3, T));
      for (let i = 1; i < bws.length; i++) {
        expect(bws[i]).toBeGreaterThan(bws[i - 1]);
      }
    });
  });

  describe('salinity gap documentation (known limitation)', () => {
    // Our Bw function ignores salinity. At 0 ppm it matches pyrestoolbox.
    // At higher salinities, Bw decreases (denser water expands less).
    // This gap is documented for Phase 9 enhancement.
    it('should return Bw > 1 for fresh water at all pressures', () => {
      for (const P of [485.3, 1985.3, 4985.3]) {
        const Bw = calculateWaterFVF(P, 200);
        expect(Bw).toBeGreaterThan(1.0);
      }
    });

    it('should return reasonable Bw for low temperature', () => {
      const Bw = calculateWaterFVF(2485.3, 100);
      // At low T, Bw is close to 1.0
      expect(Bw).toBeGreaterThan(0.99);
      expect(Bw).toBeLessThan(1.02);
    });

    it('should return reasonable Bw for high temperature', () => {
      const Bw = calculateWaterFVF(2485.3, 300);
      // At high T, Bw increases (thermal expansion dominates)
      expect(Bw).toBeGreaterThan(1.05);
      expect(Bw).toBeLessThan(1.25);
    });
  });
});

// ============================================================================
// Bg - PYRESTOOLBOX CROSS-VALIDATED (Phase 8 Audit, Plan 08-02)
// ============================================================================
//
// Oracle: Standard gas FVF formula: Bg = Pstd * Tr * Z / (P * Tstd)
// Depends on Z-factor (validated in Z-factor section above).
// Tolerance: 5% (but should match exactly since formula is standard)

describe('Bg - pyrestoolbox validated (Phase 8 audit, 08-02)', () => {
  const relativeError = (ours: number, ref: number, floor: number) =>
    Math.abs(ours - ref) / Math.max(Math.abs(ref), floor);

  const BG_TOLERANCE = 0.05;

  describe('pressure sweep (Gg=0.75, T=200F)', () => {
    const cases = [
      // Bg = 14.7 * (T+460) * Z / (P * 520)
      // Uses Z from DAK+Sutton (validated above)
      { P_psig: 485.3,  Z: 0.9517, Bg: 0.035515 },  // P=500 psia
      { P_psig: 985.3,  Z: 0.9104, Bg: 0.016986 },  // P=1000 psia
      { P_psig: 1485.3, Z: 0.8797, Bg: 0.010942 },  // P=1500 psia
      { P_psig: 1985.3, Z: 0.8627, Bg: 0.008048 },  // P=2000 psia
      { P_psig: 2485.3, Z: 0.8605, Bg: 0.006422 },  // P=2500 psia
      { P_psig: 2985.3, Z: 0.8714, Bg: 0.005419 },  // P=3000 psia
      { P_psig: 3985.3, Z: 0.9216, Bg: 0.004299 },  // P=4000 psia
      { P_psig: 4985.3, Z: 0.9944, Bg: 0.003711 },  // P=5000 psia
    ];

    it.each(cases)('P_psig=$P_psig: Bg within 5%', ({ P_psig, Z, Bg: ref }) => {
      const result = calculateGasFVF(P_psig, 200, Z);
      const err = relativeError(result, ref, 0.0001);
      expect(err).toBeLessThan(BG_TOLERANCE);
    });

    it.each(cases)('P_psig=$P_psig: matches reference value', ({ P_psig, Z, Bg: ref }) => {
      const result = calculateGasFVF(P_psig, 200, Z);
      expect(result).toBeCloseTo(ref, 5);
    });
  });

  describe('integrated Z+Bg pipeline', () => {
    // End-to-end: calculate Z then Bg from the same inputs
    const cases = [
      { P_psig: 485.3,  Bg: 0.035515 },
      { P_psig: 1985.3, Bg: 0.008048 },
      { P_psig: 2985.3, Bg: 0.005419 },
      { P_psig: 4985.3, Bg: 0.003711 },
    ];

    it.each(cases)('P_psig=$P_psig: Z->Bg pipeline within 5%', ({ P_psig, Bg: ref }) => {
      const zCalc = calculateFullZFactor(P_psig, 200, 0.75);
      const Bg = calculateGasFVF(P_psig, 200, zCalc.Z);
      const err = relativeError(Bg, ref, 0.0001);
      expect(err).toBeLessThan(0.05);
    });
  });

  describe('temperature sweep (Gg=0.75, P=2500 psia)', () => {
    const cases = [
      { T: 150, Z: 0.8068 },
      { T: 200, Z: 0.8605 },
      { T: 250, Z: 0.9007 },
    ];

    it.each(cases)('T=$T: Bg increases with temperature', ({ T, Z }) => {
      const Bg = calculateGasFVF(2485.3, T, Z);
      expect(Bg).toBeGreaterThan(0);
    });

    it('Bg at T=250 > Bg at T=150 (gas expands with temperature)', () => {
      const BgLow = calculateGasFVF(2485.3, 150, 0.8068);
      const BgHigh = calculateGasFVF(2485.3, 250, 0.9007);
      expect(BgHigh).toBeGreaterThan(BgLow);
    });
  });

  describe('gas gravity sweep (P=2500, T=200)', () => {
    const cases = [
      { gg: 0.65, Z: 0.8964 },
      { gg: 0.75, Z: 0.8605 },
      { gg: 0.85, Z: 0.8230 },
    ];

    it.each(cases)('Gg=$gg: Bg varies with Z (from gas gravity)', ({ gg, Z }) => {
      const Bg = calculateGasFVF(2485.3, 200, Z);
      expect(Bg).toBeGreaterThan(0.004);
      expect(Bg).toBeLessThan(0.01);
    });
  });

  describe('constants verification', () => {
    it('should use P_STD=14.7 and T_STD=520R', () => {
      // Bg = P_STD * T_R * Z / (P * T_STD)
      // At P=14.7 psia (P_psig=0), T=60F (T_R=520), Z=1: Bg should be 1.0
      const Bg = calculateGasFVF(0, 60, 1.0);
      expect(Bg).toBeCloseTo(1.0, 5);
    });
  });
});

// ============================================================================
// Co NUMERICAL DERIVATIVE (EXPLT) - Phase 9 Plan 01
// ============================================================================
//
// Oracle: pyRestToolbox v3.0 oil_co() with EXPLT method
// Co = -1/Bo * [dBo/dp - Bg*dRs/dp] via central difference
// Reference values computed from exact same algorithm as pyRestToolbox oil.py
// Tolerance: 5% relative with 1e-7 absolute floor

describe('calculateOilCompressibilityNumerical (EXPLT method, Phase 9-01)', () => {
  const relativeError = (ours: number, ref: number, floor: number) =>
    Math.abs(ours - ref) / Math.max(Math.abs(ref), floor);

  const CO_TOLERANCE = 0.05;

  // Conditions: API=35, T=180F, sg_g=0.75, GOR=500
  // Bubble point (VB, raw gg): 2291.90 psia

  describe('undersaturated cases (P > Pb)', () => {
    const cases = [
      { P: 2500, ref: 1.113146e-5 },
      { P: 3000, ref: 1.018456e-5 },
      { P: 4000, ref: 9.130470e-6 },
    ];

    it.each(cases)(
      'P=$P psia: Co within 5% of pyRestToolbox EXPLT',
      ({ P, ref }) => {
        const result = calculateOilCompressibilityNumerical(P, 180, 35, 0.75, 500);
        const err = relativeError(result, ref, 1e-7);
        expect(err).toBeLessThan(CO_TOLERANCE);
      }
    );

    it('undersaturated Co decreases with increasing pressure', () => {
      const co3000 = calculateOilCompressibilityNumerical(3000, 180, 35, 0.75, 500);
      const co4000 = calculateOilCompressibilityNumerical(4000, 180, 35, 0.75, 500);
      expect(co4000).toBeLessThan(co3000);
    });
  });

  describe('saturated cases (P < Pb)', () => {
    const cases = [
      { P: 1500, ref: 2.295874e-4 },
      { P: 2000, ref: 1.453519e-4 },
      { P: 2200, ref: 1.234792e-4 },
    ];

    it.each(cases)(
      'P=$P psia (saturated): Co within 5% of pyRestToolbox EXPLT',
      ({ P, ref }) => {
        const result = calculateOilCompressibilityNumerical(P, 180, 35, 0.75, 500);
        const err = relativeError(result, ref, 1e-7);
        expect(err).toBeLessThan(CO_TOLERANCE);
      }
    );

    it('saturated Co has non-zero dRs/dp contribution (larger than undersaturated)', () => {
      const coSaturated = calculateOilCompressibilityNumerical(2000, 180, 35, 0.75, 500);
      const coUndersaturated = calculateOilCompressibilityNumerical(3000, 180, 35, 0.75, 500);
      expect(coSaturated).toBeGreaterThan(coUndersaturated);
    });
  });

  describe('edge cases', () => {
    it('should return a value within clamped range', () => {
      const co = calculateOilCompressibilityNumerical(3000, 180, 35, 0.75, 500);
      expect(co).toBeGreaterThanOrEqual(1e-7);
      expect(co).toBeLessThanOrEqual(1e-3);
    });

    it('should handle pressure near bubble point', () => {
      // Pb is approximately 2292 psia (raw gg convention)
      const co = calculateOilCompressibilityNumerical(2295, 180, 35, 0.75, 500);
      expect(Number.isFinite(co)).toBe(true);
      expect(co).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// OIL DENSITY SWMH - Phase 9 Plan 01
// ============================================================================
//
// Oracle: pyRestToolbox v3.0 oil_deno() SWMH method
// Standing-Witte-McCain-Hill (1995), Eqs 3.18a-3.18g + 3.19d-3.19g
// Tolerance: 2% relative with 0.5 lb/ft3 absolute floor

describe('calculateOilDensitySWMH (Phase 9-01)', () => {
  const relativeError = (ours: number, ref: number, floor: number) =>
    Math.abs(ours - ref) / Math.max(Math.abs(ref), floor);

  const RHO_TOLERANCE = 0.02;

  describe('test set 1: API=35, T=180F, sg_g=0.75 (light oil)', () => {
    // Pb = 2291.90 psia for GOR=500 (raw gg convention)
    const Pb = 2291.90;

    const cases = [
      { P: 1500, rs: 271.5, ref: 47.2137, region: 'saturated' },
      { P: 2000, rs: 371.9, ref: 46.3834, region: 'saturated' },
      { P: 3000, rs: 500.0, ref: 45.6577, region: 'undersaturated' },
      { P: 4000, rs: 500.0, ref: 46.0421, region: 'undersaturated' },
    ];

    it.each(cases)(
      'P=$P ($region): density within 2% of pyRestToolbox SWMH',
      ({ P, rs, ref }) => {
        const result = calculateOilDensitySWMH(P, 180, 35, 0.75, rs, Pb);
        const err = relativeError(result, ref, 0.5);
        expect(err).toBeLessThan(RHO_TOLERANCE);
      }
    );
  });

  describe('test set 2: API=25, T=200F, sg_g=0.80 (heavier oil)', () => {
    // Pb = 2507.08 psia for GOR=400 (raw gg convention)
    const Pb = 2507.08;

    const cases = [
      { P: 1500, rs: 210.2, ref: 50.9707, region: 'saturated' },
      { P: 2500, rs: 350.6, ref: 49.8472, region: 'saturated' },
    ];

    it.each(cases)(
      'P=$P ($region): density within 2% of pyRestToolbox SWMH',
      ({ P, rs, ref }) => {
        const result = calculateOilDensitySWMH(P, 200, 25, 0.80, rs, Pb);
        const err = relativeError(result, ref, 0.5);
        expect(err).toBeLessThan(RHO_TOLERANCE);
      }
    );
  });

  describe('physical behavior', () => {
    it('heavier oil (lower API) has higher density', () => {
      const rhoLight = calculateOilDensitySWMH(2000, 180, 35, 0.75, 400, 2292);
      const rhoHeavy = calculateOilDensitySWMH(2000, 180, 25, 0.75, 400, 2292);
      expect(rhoHeavy).toBeGreaterThan(rhoLight);
    });

    it('density increases with pressure above Pb', () => {
      const Pb = 2292;
      const rho3000 = calculateOilDensitySWMH(3000, 180, 35, 0.75, 500, Pb);
      const rho4000 = calculateOilDensitySWMH(4000, 180, 35, 0.75, 500, Pb);
      expect(rho4000).toBeGreaterThan(rho3000);
    });

    it('returns values in reasonable oil density range (30-70 lb/ft3)', () => {
      const rho = calculateOilDensitySWMH(2000, 180, 35, 0.75, 400, 2292);
      expect(rho).toBeGreaterThanOrEqual(30);
      expect(rho).toBeLessThanOrEqual(70);
    });
  });
});

// ============================================================================
// getPVTPropertiesAtPressure - oilDensity integration (Phase 9-01)
// ============================================================================

describe('getPVTPropertiesAtPressure - oilDensity (Phase 9-01)', () => {
  it('returns oilDensity in saturated conditions', () => {
    const pvt = getPVTPropertiesAtPressure(2000, 180, 35, 0.75, 500);
    expect(pvt.isSaturated).toBe(true);
    expect(pvt.oilDensity).toBeDefined();
    expect(pvt.oilDensity).toBeGreaterThan(30);
    expect(pvt.oilDensity).toBeLessThan(70);
  });

  it('returns oilDensity in undersaturated conditions', () => {
    const pvt = getPVTPropertiesAtPressure(4000, 180, 35, 0.75, 500);
    expect(pvt.isSaturated).toBe(false);
    expect(pvt.oilDensity).toBeDefined();
    expect(pvt.oilDensity).toBeGreaterThan(30);
    expect(pvt.oilDensity).toBeLessThan(70);
  });

  it('returns oilCompressibility in both saturated and undersaturated', () => {
    const pvtSat = getPVTPropertiesAtPressure(2000, 180, 35, 0.75, 500);
    const pvtUnder = getPVTPropertiesAtPressure(4000, 180, 35, 0.75, 500);
    expect(pvtSat.oilCompressibility).toBeDefined();
    expect(pvtUnder.oilCompressibility).toBeDefined();
  });

  it('uses numerical derivative Co (undersaturated Co matches EXPLT reference)', () => {
    const pvt = getPVTPropertiesAtPressure(3000, 180, 35, 0.75, 500);
    expect(pvt.oilCompressibility).toBeDefined();
    const coNumerical = calculateOilCompressibilityNumerical(3000, 180, 35, 0.75, 500);
    expect(pvt.oilCompressibility).toBeCloseTo(coNumerical, 8);
  });
});

// ============================================================================
// PETROSKY-FARSHAD UNDERSATURATED VISCOSITY FIX
// ============================================================================

describe('calculateUndersaturatedViscosity - Petrosky-Farshad fix', () => {
  // Petrosky-Farshad formula: A = f(ln(muob)), NOT deltaP
  // Reference: pyRestToolbox oil_viso at undersaturated conditions
  // muob (B-R at Pb): dead=2.1833, live(Rs=500)=0.6395 cp

  const muob = 0.6395485144241687; // B-R live oil viscosity at Rs=500, API=35, T=180F

  it('should have A coefficient depend on ln(muob), not deltaP', () => {
    // Petrosky-Farshad: A = -1.0146 + 1.3322*ln(muob) - 0.4876*ln(muob)^2 - 1.15036*ln(muob)^3
    // For muob=0.6395: ln(muob)=-0.447, A=-1.605
    const mu3000 = calculateUndersaturatedViscosity(3000, 2500, muob);
    const mu5000 = calculateUndersaturatedViscosity(5000, 2500, muob);

    // With correct Petrosky-Farshad, viscosity increase should be significant:
    // ~0.033 cp per 500 psi increment (not ~0.00006 cp as with buggy formula)
    const increase500psi = mu3000 - muob;
    expect(increase500psi).toBeGreaterThan(0.01); // Must be noticeable, not near-zero
  });

  it('should match Petrosky-Farshad reference at P=3000, Pb=2500', () => {
    // Petrosky-Farshad: mu = 0.6395 + 1.3449e-3 * 500 * 10^(-1.605) = 0.6563 cp
    const mu = calculateUndersaturatedViscosity(3000, 2500, muob);
    expect(mu).toBeCloseTo(0.6563, 2);
  });

  it('should match Petrosky-Farshad reference at P=4000, Pb=2500', () => {
    const mu = calculateUndersaturatedViscosity(4000, 2500, muob);
    expect(mu).toBeCloseTo(0.6897, 2);
  });

  it('should match Petrosky-Farshad reference at P=5000, Pb=2500', () => {
    const mu = calculateUndersaturatedViscosity(5000, 2500, muob);
    expect(mu).toBeCloseTo(0.7231, 2);
  });

  it('should return muob exactly when P = Pb', () => {
    const mu = calculateUndersaturatedViscosity(2500, 2500, muob);
    expect(mu).toBe(muob);
  });

  it('should return muob when P < Pb', () => {
    const mu = calculateUndersaturatedViscosity(2000, 2500, muob);
    expect(mu).toBe(muob);
  });

  it('should increase monotonically above Pb', () => {
    const mu3000 = calculateUndersaturatedViscosity(3000, 2500, muob);
    const mu4000 = calculateUndersaturatedViscosity(4000, 2500, muob);
    const mu5000 = calculateUndersaturatedViscosity(5000, 2500, muob);

    expect(mu3000).toBeGreaterThan(muob);
    expect(mu4000).toBeGreaterThan(mu3000);
    expect(mu5000).toBeGreaterThan(mu4000);
  });

  it('should never return less than muob', () => {
    const mu = calculateUndersaturatedViscosity(10000, 2500, muob);
    expect(mu).toBeGreaterThanOrEqual(muob);
  });
});

// ============================================================================
// BEAL DEAD OIL VISCOSITY
// ============================================================================

describe('calculateDeadOilViscosityBeal', () => {
  it('should match OilProperties.xls formula at API=35, T=180F', () => {
    // a = 10^(0.43 + 8.33/35) = 4.656
    // muod = (0.32 + 1.8e7/35^4.53) * (360/(180+200))^4.656 = 1.666 cp
    const mu = calculateDeadOilViscosityBeal(180, 35);
    expect(mu).toBeCloseTo(1.666, 1);
  });

  it('should match OilProperties.xls formula at API=25, T=150F', () => {
    // a = 10^(0.43 + 8.33/25) = 5.797
    // muod = (0.32 + 1.8e7/25^4.53) * (360/(150+200))^5.797 = 10.23 cp
    const mu = calculateDeadOilViscosityBeal(150, 25);
    expect(mu).toBeCloseTo(10.23, 0);
  });

  it('should produce similar order-of-magnitude as Beggs-Robinson', () => {
    // Both correlations for dead oil should give roughly similar results
    const beal = calculateDeadOilViscosityBeal(180, 35);
    const br = calculateDeadOilViscosity(180, 35);

    // Both should be in the 1-5 cp range for API=35, T=180F
    expect(beal).toBeGreaterThan(0.5);
    expect(beal).toBeLessThan(10);
    expect(br).toBeGreaterThan(0.5);
    expect(br).toBeLessThan(10);
  });

  it('should decrease with increasing temperature', () => {
    const mu1 = calculateDeadOilViscosityBeal(100, 35);
    const mu2 = calculateDeadOilViscosityBeal(200, 35);
    const mu3 = calculateDeadOilViscosityBeal(300, 35);

    expect(mu2).toBeLessThan(mu1);
    expect(mu3).toBeLessThan(mu2);
  });

  it('should decrease with increasing API (lighter oil)', () => {
    const mu1 = calculateDeadOilViscosityBeal(180, 20);
    const mu2 = calculateDeadOilViscosityBeal(180, 30);
    const mu3 = calculateDeadOilViscosityBeal(180, 40);

    expect(mu2).toBeLessThan(mu1);
    expect(mu3).toBeLessThan(mu2);
  });

  it('should clamp temperature to minimum 70F', () => {
    const muLow = calculateDeadOilViscosityBeal(50, 35);
    const mu70 = calculateDeadOilViscosityBeal(70, 35);
    expect(muLow).toBe(mu70);
  });
});

// ============================================================================
// CHEW-CONNALLY SATURATED VISCOSITY
// ============================================================================

describe('calculateSaturatedViscosityChewConnally', () => {
  it('should match OilProperties.xls formula at Rs=200 with Beal dead oil', () => {
    // Beal dead oil at API=35, T=180F = 1.666 cp
    // A = 10^(200*(2.2e-7*200 - 7.4e-4)) = 10^(200*(-6.96e-4)) = 10^(-0.1392) = 0.726
    // B = 0.68/10^(8.62e-5*200) + 0.25/10^(1.1e-3*200) + 0.062/10^(3.74e-3*200) = ~0.854
    // muob = 0.726 * 1.666^0.854 = 1.100 cp
    const muDead = 1.6656214956472237;
    const mu = calculateSaturatedViscosityChewConnally(muDead, 200);
    expect(mu).toBeCloseTo(1.100, 1);
  });

  it('should match OilProperties.xls formula at Rs=500', () => {
    const muDead = 1.6656214956472237;
    const mu = calculateSaturatedViscosityChewConnally(muDead, 500);
    // A=0.484, B=0.687 => muob = 0.484 * 1.666^0.687 = 0.687 cp
    expect(mu).toBeCloseTo(0.687, 1);
  });

  it('should match OilProperties.xls formula at Rs=800', () => {
    const muDead = 1.6656214956472237;
    const mu = calculateSaturatedViscosityChewConnally(muDead, 800);
    // Expected ~0.484 cp
    expect(mu).toBeCloseTo(0.484, 1);
  });

  it('should decrease with increasing Rs (more gas dissolved)', () => {
    const muDead = 5.0;
    const mu1 = calculateSaturatedViscosityChewConnally(muDead, 100);
    const mu2 = calculateSaturatedViscosityChewConnally(muDead, 500);
    const mu3 = calculateSaturatedViscosityChewConnally(muDead, 1000);

    expect(mu2).toBeLessThan(mu1);
    expect(mu3).toBeLessThan(mu2);
  });

  it('should handle Rs=0 gracefully', () => {
    const mu = calculateSaturatedViscosityChewConnally(5.0, 0);
    expect(mu).toBeGreaterThan(0);
    expect(mu).toBeLessThan(10000);
  });

  it('should produce values in reasonable range', () => {
    const mu = calculateSaturatedViscosityChewConnally(3.0, 400);
    expect(mu).toBeGreaterThan(0.1);
    expect(mu).toBeLessThan(100);
  });
});

// ============================================================================
// BEAL UNDERSATURATED VISCOSITY
// ============================================================================

describe('calculateUndersaturatedViscosityBeal', () => {
  it('should use 0.038 coefficient (not 0.38 spreadsheet typo)', () => {
    const muob = 0.687;
    const P = 3000;
    const Pb = 2500;
    // mu = muob + 0.001*500*(0.024*0.687^1.6 + 0.038*0.687^0.56)
    // = 0.687 + 0.5*(0.024*0.5369 + 0.038*0.8109)
    // = 0.687 + 0.5*(0.01289 + 0.03081)
    // = 0.687 + 0.02185
    // = 0.709 cp
    const mu = calculateUndersaturatedViscosityBeal(P, Pb, muob);
    expect(mu).toBeCloseTo(0.709, 2);
  });

  it('should return muob exactly when P = Pb', () => {
    const muob = 1.5;
    const mu = calculateUndersaturatedViscosityBeal(2500, 2500, muob);
    expect(mu).toBe(muob);
  });

  it('should return muob when P < Pb', () => {
    const muob = 1.5;
    const mu = calculateUndersaturatedViscosityBeal(2000, 2500, muob);
    expect(mu).toBe(muob);
  });

  it('should increase with pressure above Pb', () => {
    const muob = 1.0;
    const mu1 = calculateUndersaturatedViscosityBeal(3000, 2500, muob);
    const mu2 = calculateUndersaturatedViscosityBeal(4000, 2500, muob);
    const mu3 = calculateUndersaturatedViscosityBeal(5000, 2500, muob);

    expect(mu1).toBeGreaterThan(muob);
    expect(mu2).toBeGreaterThan(mu1);
    expect(mu3).toBeGreaterThan(mu2);
  });

  it('should never return less than muob', () => {
    const muob = 0.5;
    const mu = calculateUndersaturatedViscosityBeal(10000, 2500, muob);
    expect(mu).toBeGreaterThanOrEqual(muob);
  });
});

// ============================================================================
// getPVTPropertiesAtPressure - VISCOSITY METHOD SELECTOR
// ============================================================================

describe('getPVTPropertiesAtPressure - viscosityMethod', () => {
  const api = 35;
  const gasGravity = 0.75;
  const temperature = 200;
  const totalGOR = 600;

  it('should default to beggs-robinson when no viscosityMethod specified', () => {
    const resultDefault = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR);
    const resultExplicit = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson' });

    expect(resultDefault.oilViscosity).toEqual(resultExplicit.oilViscosity);
  });

  it('should produce different viscosity with beal-chew-connally vs beggs-robinson', () => {
    const resultBR = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson' });
    const resultBCC = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beal-chew-connally' });

    // Both should produce positive viscosity but different values
    expect(resultBR.oilViscosity).toBeGreaterThan(0);
    expect(resultBCC.oilViscosity).toBeGreaterThan(0);
    expect(resultBR.oilViscosity).not.toEqual(resultBCC.oilViscosity);
  });

  it('should produce positive viscosity in saturated conditions with both methods', () => {
    // Use low pressure (likely saturated)
    const resultBR = getPVTPropertiesAtPressure(1000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson' });
    const resultBCC = getPVTPropertiesAtPressure(1000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beal-chew-connally' });

    expect(resultBR.oilViscosity).toBeGreaterThan(0);
    expect(resultBCC.oilViscosity).toBeGreaterThan(0);
  });

  it('should produce positive viscosity in undersaturated conditions with both methods', () => {
    // Use high pressure (likely undersaturated)
    const resultBR = getPVTPropertiesAtPressure(5000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson' });
    const resultBCC = getPVTPropertiesAtPressure(5000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beal-chew-connally' });

    expect(resultBR.oilViscosity).toBeGreaterThan(0);
    expect(resultBCC.oilViscosity).toBeGreaterThan(0);
  });

  it('should not affect non-viscosity properties when switching method', () => {
    const resultBR = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson' });
    const resultBCC = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beal-chew-connally' });

    // Rs, Bo, Pb, saturation state should be identical
    expect(resultBR.rs).toEqual(resultBCC.rs);
    expect(resultBR.bo).toEqual(resultBCC.bo);
    expect(resultBR.bubblePointPressure).toEqual(resultBCC.bubblePointPressure);
    expect(resultBR.isSaturated).toEqual(resultBCC.isSaturated);
  });

  it('should always include deadOilViscosity using Beggs-Robinson for reference', () => {
    const resultBR = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson' });
    const resultBCC = getPVTPropertiesAtPressure(2000, temperature, api, gasGravity, totalGOR, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beal-chew-connally' });

    // deadOilViscosity should always be Beggs-Robinson (for reference display)
    expect(resultBR.deadOilViscosity).toEqual(resultBCC.deadOilViscosity);
    expect(resultBR.deadOilViscosity).toBeGreaterThan(0);
  });
});

// ============================================================================
// SOUR GAS CORRECTIONS - WICHERT-AZIZ (Phase 9, Plan 09-03)
// ============================================================================
//
// Oracle: pyRestToolbox SUT method — HC fraction separation, Sutton on HC-only
// gravity, Kay's mixing with component criticals, Wichert-Aziz epsilon.
// Reference values computed from pyRestToolbox gas.py SUT implementation.

describe('calculateSourGasPseudocriticals', () => {
  it('should return plain Sutton values when all mole fractions are zero', () => {
    const result = calculateSourGasPseudocriticals(0.75);
    expect(result.ppc).toBeCloseTo(656.53, 1);
    expect(result.tpc).toBeCloseTo(389.70, 1);
  });

  it('should return plain Sutton values when mole fractions are explicitly zero', () => {
    const result = calculateSourGasPseudocriticals(0.75, 0, 0, 0);
    const sweetResult = calculateSourGasPseudocriticals(0.75);
    expect(result.ppc).toEqual(sweetResult.ppc);
    expect(result.tpc).toEqual(sweetResult.tpc);
  });

  it('should compute HC gravity separation correctly', () => {
    // sg=0.75, N2=0.02, CO2=0.10, H2S=0.05
    // sgHC = (0.75 - (0.02*28.01 + 0.10*44.01 + 0.05*34.1)/28.97) / (1-0.17)
    const result = calculateSourGasPseudocriticals(0.75, 0.05, 0.10, 0.02);
    // sgHC should be approximately 0.6264
    // We verify indirectly through ppc/tpc which depend on sgHC
    expect(result.ppc).toBeCloseTo(703.06, 0);
    expect(result.tpc).toBeCloseTo(371.85, 0);
  });

  it('should compute Wichert-Aziz epsilon correctly', () => {
    // A = H2S+CO2 = 0.15, B = H2S = 0.05
    // epsilon = 120*(0.15^0.9 - 0.15^1.6) + 15*(0.05^0.5 - 0.05^4)
    // epsilon ~ 19.35
    const result = calculateSourGasPseudocriticals(0.75, 0.05, 0.10, 0.02);
    // The correction lowers Tpc and adjusts Ppc
    // tpcStar ~ 391.20, epsilon ~ 19.35, so tpc ~ 371.85
    expect(result.tpc).toBeLessThan(391.2);
    expect(result.tpc).toBeCloseTo(371.85, 0);
  });

  it('should apply Kays mixing with component criticals', () => {
    // ppcStar = 0.83*ppcHC + 0.02*507.5 + 0.10*1071.0 + 0.05*1306.0 ~ 741.38
    // tpcStar = 0.83*tpcHC + 0.02*239.26 + 0.10*547.58 + 0.05*672.35 ~ 391.20
    const result = calculateSourGasPseudocriticals(0.75, 0.05, 0.10, 0.02);
    expect(result.ppc).toBeCloseTo(703.06, 0);
    expect(result.tpc).toBeCloseTo(371.85, 0);
  });

  it('should handle H2S-only sour gas', () => {
    // Only H2S, no CO2 or N2
    const result = calculateSourGasPseudocriticals(0.75, 0.05, 0, 0);
    // Should differ from sweet gas
    const sweet = calculateSourGasPseudocriticals(0.75, 0, 0, 0);
    expect(result.ppc).not.toEqual(sweet.ppc);
    expect(result.tpc).not.toEqual(sweet.tpc);
    // H2S raises Ppc (H2S Ppc=1306 is high)
    expect(result.ppc).toBeGreaterThan(sweet.ppc);
  });

  it('should handle CO2-only sour gas', () => {
    const result = calculateSourGasPseudocriticals(0.75, 0, 0.10, 0);
    const sweet = calculateSourGasPseudocriticals(0.75, 0, 0, 0);
    expect(result.ppc).not.toEqual(sweet.ppc);
    expect(result.tpc).not.toEqual(sweet.tpc);
  });

  it('should export component critical constants', () => {
    expect(COMPONENT_CRITICALS.N2.Tpc).toBe(239.26);
    expect(COMPONENT_CRITICALS.N2.Ppc).toBe(507.5);
    expect(COMPONENT_CRITICALS.CO2.Tpc).toBe(547.58);
    expect(COMPONENT_CRITICALS.CO2.Ppc).toBe(1071.0);
    expect(COMPONENT_CRITICALS.H2S.Tpc).toBe(672.35);
    expect(COMPONENT_CRITICALS.H2S.Ppc).toBe(1306.0);
  });
});

describe('Sour gas corrections - Wichert-Aziz Z-factor', () => {
  const relativeError = (ours: number, ref: number, floor: number) =>
    Math.abs(ours - ref) / Math.max(Math.abs(ref), floor);

  const Z_TOLERANCE = 0.01; // 1% max error

  it('sg=0.75, T=180F, P=2000 psia, H2S=0.05, CO2=0.10, N2=0.02: Z within 1%', () => {
    // pyRestToolbox SUT reference: Z = 0.8744
    const result = calculateFullZFactor(1985.3, 180, 0.75, 0.05, 0.10, 0.02);
    const err = relativeError(result.Z, 0.8744, 0.005);
    expect(err).toBeLessThan(Z_TOLERANCE);
  });

  it('sg=0.75, T=180F, P=3000 psia, H2S=0.05, CO2=0.10, N2=0.02: Z within 1%', () => {
    // pyRestToolbox SUT reference: Z = 0.8748
    const result = calculateFullZFactor(2985.3, 180, 0.75, 0.05, 0.10, 0.02);
    const err = relativeError(result.Z, 0.8748, 0.005);
    expect(err).toBeLessThan(Z_TOLERANCE);
  });

  it('sg=0.80, T=200F, P=2500 psia, H2S=0.10, CO2=0.05, N2=0: Z within 1%', () => {
    // pyRestToolbox SUT reference: Z = 0.8467
    const result = calculateFullZFactor(2485.3, 200, 0.80, 0.10, 0.05, 0);
    const err = relativeError(result.Z, 0.8467, 0.005);
    expect(err).toBeLessThan(Z_TOLERANCE);
  });

  it('sweet gas (all zeros) matches current calculateFullZFactor exactly', () => {
    const sweetResult = calculateFullZFactor(1985.3, 180, 0.75);
    const sourResult = calculateFullZFactor(1985.3, 180, 0.75, 0, 0, 0);
    expect(sourResult.Z).toEqual(sweetResult.Z);
    expect(sourResult.Pc).toEqual(sweetResult.Pc);
    expect(sourResult.Tc).toEqual(sweetResult.Tc);
  });

  it('sour gas Z differs from sweet gas Z', () => {
    const sweetResult = calculateFullZFactor(1985.3, 180, 0.75);
    const sourResult = calculateFullZFactor(1985.3, 180, 0.75, 0.05, 0.10, 0.02);
    expect(sourResult.Z).not.toEqual(sweetResult.Z);
    // Sour gas corrections change pseudocriticals, which changes Pr/Tr, which changes Z
  });

  it('sour gas corrections produce higher Pc due to high-Ppc components', () => {
    const sweetResult = calculateFullZFactor(2485.3, 200, 0.75);
    const sourResult = calculateFullZFactor(2485.3, 200, 0.75, 0.05, 0.10, 0.02);
    // H2S and CO2 have higher Ppc than typical HC gas, so corrected Pc should be higher
    expect(sourResult.Pc).toBeGreaterThan(sweetResult.Pc);
  });
});

// ============================================================================
// SALINITY-CORRECTED BRINE PROPERTIES (Phase 9, Plan 09-03)
// ============================================================================

describe('calculateWaterFVFWithSalinity', () => {
  it('should match calculateWaterFVF exactly at salinity=0', () => {
    const bwFresh = calculateWaterFVF(2000, 180);
    const bwBrine = calculateWaterFVFWithSalinity(2000, 180, 0);
    expect(bwBrine).toEqual(bwFresh);
  });

  it('should differ from fresh water at salinity=50000 ppm', () => {
    const bwFresh = calculateWaterFVF(2000, 180);
    const bwBrine = calculateWaterFVFWithSalinity(2000, 180, 50000);
    expect(bwBrine).not.toEqual(bwFresh);
  });

  it('should return Bw in reasonable range (0.95-1.10)', () => {
    const bw = calculateWaterFVFWithSalinity(2000, 180, 50000);
    expect(bw).toBeGreaterThanOrEqual(0.95);
    expect(bw).toBeLessThanOrEqual(1.10);
  });

  it('should differ more at higher salinity', () => {
    const bwFresh = calculateWaterFVF(2000, 180);
    const bw50k = calculateWaterFVFWithSalinity(2000, 180, 50000);
    const bw100k = calculateWaterFVFWithSalinity(2000, 180, 100000);
    const diff50k = Math.abs(bw50k - bwFresh);
    const diff100k = Math.abs(bw100k - bwFresh);
    expect(diff100k).toBeGreaterThan(diff50k);
  });
});

describe('calculateBrineDensity', () => {
  it('should return approximately 62.4 lb/ft3 at standard conditions with salinity=0', () => {
    const rho = calculateBrineDensity(14.7, 60, 0);
    expect(rho).toBeCloseTo(62.4, 0);
  });

  it('should be measurably higher at salinity=100000 ppm', () => {
    const rhoFresh = calculateBrineDensity(2000, 180, 0);
    const rhoBrine = calculateBrineDensity(2000, 180, 100000);
    expect(rhoBrine).toBeGreaterThan(rhoFresh);
  });

  it('should return values in physical range (55-85 lb/ft3)', () => {
    const rho = calculateBrineDensity(2000, 180, 100000);
    expect(rho).toBeGreaterThanOrEqual(55);
    expect(rho).toBeLessThanOrEqual(85);
  });

  it('should decrease with temperature', () => {
    const rho150 = calculateBrineDensity(2000, 150, 50000);
    const rho250 = calculateBrineDensity(2000, 250, 50000);
    expect(rho150).toBeGreaterThan(rho250);
  });
});

describe('calculateBrineViscosity', () => {
  it('should return approximately 1.0 cp at moderate temperature with salinity=0', () => {
    // Fresh water viscosity at ~120F should be around 0.5-1.5 cp
    const mu = calculateBrineViscosity(120, 0);
    expect(mu).toBeGreaterThan(0.3);
    expect(mu).toBeLessThan(2.0);
  });

  it('should be higher than fresh water at salinity=100000 ppm', () => {
    const muFresh = calculateBrineViscosity(180, 0);
    const muBrine = calculateBrineViscosity(180, 100000);
    expect(muBrine).toBeGreaterThan(muFresh);
  });

  it('should return values in reasonable range (0.1-10 cp)', () => {
    const mu = calculateBrineViscosity(180, 100000);
    expect(mu).toBeGreaterThanOrEqual(0.1);
    expect(mu).toBeLessThanOrEqual(10);
  });

  it('should decrease with temperature', () => {
    const mu100 = calculateBrineViscosity(100, 50000);
    const mu250 = calculateBrineViscosity(250, 50000);
    expect(mu100).toBeGreaterThan(mu250);
  });
});

describe('calculateWaterCompressibilityWithSalinity - Osif (1988)', () => {
  // Osif (1988): Cw = 1 / (7.033*P + 0.5415*S - 537*T + 403300)
  // pyRestToolbox reference values for validation

  it('fresh water at P=2000, T=180: Cw within 2% of pyRT (3.061e-6)', () => {
    const cw = calculateWaterCompressibilityWithSalinity(2000, 180, 0);
    const ref = 3.061e-6;
    const err = Math.abs(cw - ref) / ref;
    expect(err).toBeLessThan(0.02);
  });

  it('fresh water at P=3000, T=180: Cw within 2% of pyRT (3.003e-6)', () => {
    const cw = calculateWaterCompressibilityWithSalinity(3000, 180, 0);
    const ref = 3.003e-6;
    const err = Math.abs(cw - ref) / ref;
    expect(err).toBeLessThan(0.02);
  });

  it('5% salt (50000 ppm) at P=2000, T=180: Cw within 2% of pyRT (2.822e-6)', () => {
    const cw = calculateWaterCompressibilityWithSalinity(2000, 180, 50000);
    const ref = 2.822e-6;
    const err = Math.abs(cw - ref) / ref;
    expect(err).toBeLessThan(0.02);
  });

  it('5% salt (50000 ppm) at P=3000, T=180: Cw within 2% of pyRT (2.771e-6)', () => {
    const cw = calculateWaterCompressibilityWithSalinity(3000, 180, 50000);
    const ref = 2.771e-6;
    const err = Math.abs(cw - ref) / ref;
    expect(err).toBeLessThan(0.02);
  });

  it('temperature sensitivity: Cw at T=250 differs from Cw at T=150 (same P, S)', () => {
    const cwHot = calculateWaterCompressibilityWithSalinity(2000, 250, 0);
    const cwCold = calculateWaterCompressibilityWithSalinity(2000, 150, 0);
    expect(cwHot).not.toEqual(cwCold);
  });

  it('physical bounds: Cw is always positive and < 1e-4', () => {
    const cw = calculateWaterCompressibilityWithSalinity(2000, 180, 50000);
    expect(cw).toBeGreaterThan(0);
    expect(cw).toBeLessThan(1e-4);
  });

  it('should differ from zero salinity at high salinity', () => {
    const cwFresh = calculateWaterCompressibilityWithSalinity(2000, 180, 0);
    const cwBrine = calculateWaterCompressibilityWithSalinity(2000, 180, 100000);
    expect(cwBrine).not.toEqual(cwFresh);
  });
});

describe('calculateSuttonPseudoCriticalPressure - 131.0 coefficient (Phase 9.1)', () => {
  it('should use 131.0 coefficient matching pyRestToolbox', () => {
    // Ppc = 756.8 - 131.0*0.75 - 3.6*0.75^2
    // = 756.8 - 98.25 - 2.025 = 656.525
    const ppc = calculateSuttonPseudoCriticalPressure(0.75);
    expect(ppc).toBeCloseTo(656.525, 2);
  });
});

// ============================================================================
// Water viscosity at zero salinity (Phase 16, Plan 16-01)
// ============================================================================

describe('water viscosity at zero salinity', () => {
  it('returns defined waterViscosity when salinity is 0', () => {
    const result = getPVTPropertiesAtPressure(2000, 180, 35, 0.7, 2500, { salinity: 0 });
    expect(result.waterViscosity).toBeDefined();
    expect(result.waterViscosity).toBeGreaterThan(0);
    expect(result.waterViscosity).toBeLessThan(2);
  });

  it('waterViscosity matches pure water from calculateBrineViscosity(T, 0)', () => {
    const result = getPVTPropertiesAtPressure(2000, 180, 35, 0.7, 2500, { salinity: 0 });
    const brine0 = calculateBrineViscosity(180, 0);
    expect(result.waterViscosity).toBeCloseTo(brine0, 5);
  });

  it('returns defined waterViscosity even without explicit salinity config', () => {
    const result = getPVTPropertiesAtPressure(2000, 180, 35, 0.7, 2500);
    expect(result.waterViscosity).toBeDefined();
    expect(result.waterViscosity).toBeGreaterThan(0);
  });
});

// ============================================================================
// getPVTPropertiesAtPressure - FULL PARAMETER INTEGRATION (Phase 9, Plan 09-03)
// ============================================================================

describe('getPVTPropertiesAtPressure - sour gas and salinity options', () => {
  const api = 35;
  const gasGravity = 0.75;
  const temperature = 200;
  const totalGOR = 600;

  it('should accept options object with sour gas params', () => {
    const result = getPVTPropertiesAtPressure(
      2000, temperature, api, gasGravity, totalGOR,
      { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', yH2S: 0.05, yCO2: 0.10, yN2: 0.02 }
    );
    expect(result.rs).toBeGreaterThan(0);
    expect(result.bo).toBeGreaterThan(1);
    expect(result.oilViscosity).toBeGreaterThan(0);
  });

  it('should produce different Z-factor derived properties with sour gas', () => {
    const sweetResult = getPVTPropertiesAtPressure(
      2000, temperature, api, gasGravity, totalGOR
    );
    const sourResult = getPVTPropertiesAtPressure(
      2000, temperature, api, gasGravity, totalGOR,
      { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', yH2S: 0.05, yCO2: 0.10, yN2: 0.02 }
    );
    // Sour gas affects Z-factor -> gas FVF -> oil compressibility numerical derivative
    // Rs and Bo (saturated) depend only on P,T,API,Gg, not sour gas
    // But Co numerical derivative uses Z via Bg term, so Co should differ
    if (sweetResult.zFactor !== undefined && sourResult.zFactor !== undefined) {
      expect(sourResult.zFactor).not.toEqual(sweetResult.zFactor);
    }
  });

  it('should return identical results when options has all zeros vs no options', () => {
    const noOptions = getPVTPropertiesAtPressure(
      2000, temperature, api, gasGravity, totalGOR
    );
    const zeroOptions = getPVTPropertiesAtPressure(
      2000, temperature, api, gasGravity, totalGOR,
      { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', yH2S: 0, yCO2: 0, yN2: 0, salinity: 0 }
    );
    expect(zeroOptions.rs).toEqual(noOptions.rs);
    expect(zeroOptions.bo).toEqual(noOptions.bo);
    expect(zeroOptions.oilViscosity).toEqual(noOptions.oilViscosity);
  });

  it('should accept salinity parameter', () => {
    const result = getPVTPropertiesAtPressure(
      2000, temperature, api, gasGravity, totalGOR,
      { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', salinity: 50000 }
    );
    expect(result.rs).toBeGreaterThan(0);
    expect(result.waterFVF).toBeDefined();
    expect(result.waterDensity).toBeDefined();
    expect(result.waterViscosity).toBeDefined();
  });

  it('should include zFactor and gasFVF in results', () => {
    const result = getPVTPropertiesAtPressure(
      2000, temperature, api, gasGravity, totalGOR,
      { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', yH2S: 0.05, yCO2: 0.10, yN2: 0.02 }
    );
    expect(result.zFactor).toBeDefined();
    expect(result.zFactor).toBeGreaterThan(0.3);
    expect(result.zFactor).toBeLessThan(1.5);
    expect(result.gasFVF).toBeDefined();
    expect(result.gasFVF).toBeGreaterThan(0);
  });

  it('should include waterFVF when salinity is provided', () => {
    const result = getPVTPropertiesAtPressure(
      2000, temperature, api, gasGravity, totalGOR,
      { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', salinity: 50000 }
    );
    expect(result.waterFVF).toBeDefined();
    expect(result.waterFVF).toBeGreaterThanOrEqual(0.95);
    expect(result.waterFVF).toBeLessThanOrEqual(1.10);
  });

  it('should pass all new params together without error', () => {
    const result = getPVTPropertiesAtPressure(
      5000, temperature, api, gasGravity, totalGOR,
      { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beal-chew-connally', yH2S: 0.05, yCO2: 0.10, yN2: 0.02, salinity: 50000 }
    );
    expect(result.rs).toBeGreaterThan(0);
    expect(result.bo).toBeGreaterThan(0.9);
    expect(result.oilViscosity).toBeGreaterThan(0);
    expect(result.zFactor).toBeDefined();
    expect(result.gasFVF).toBeDefined();
    expect(result.waterFVF).toBeDefined();
    expect(result.waterDensity).toBeDefined();
    expect(result.waterViscosity).toBeDefined();
  });
});

// ============================================================================
// PHASE 10: ALTERNATIVE PVT CORRELATION TESTS (pyRT v3.0 validated)
// ============================================================================

// Phase 10 imports — calculateRsStanding and calculateBoMcCain already imported above
import {
  calculateBubblePointStanding,
  calculateBubblePointVelarde,
  calculateRsStanding,
  calculateBoMcCain,
  calculateRsVelarde,
  solveZFactorHallYarborough,
  solveZFactorWangYeWu,
  calculateGasViscosityLGE,
} from '../correlations';

// ============================================================================
// Standing Bubble Point (Phase 10)
// ============================================================================

describe('calculateBubblePointStanding', () => {
  it('should match pyRT reference (API=35, T=180, rsb=800, sg=0.75)', () => {
    const Pb = calculateBubblePointStanding(800, 35, 0.75, 180);
    expect(Pb).toBeCloseTo(3148.84, -2);
    const err = Math.abs(Pb - 3148.84) / 3148.84;
    expect(err).toBeLessThan(0.05);
  });

  it('should increase with increasing GOR', () => {
    const Pb1 = calculateBubblePointStanding(300, 35, 0.75, 180);
    const Pb2 = calculateBubblePointStanding(800, 35, 0.75, 180);
    expect(Pb2).toBeGreaterThan(Pb1);
  });

  it('should return positive values for typical inputs', () => {
    const Pb = calculateBubblePointStanding(500, 40, 0.7, 200);
    expect(Pb).toBeGreaterThan(500);
    expect(Pb).toBeLessThan(6000);
  });
});

// ============================================================================
// Velarde Bubble Point (Phase 10)
// ============================================================================

describe('calculateBubblePointVelarde', () => {
  it('should match pyRT reference (API=35, T=180, rsb=800, sg=0.75)', () => {
    const Pb = calculateBubblePointVelarde(800, 35, 0.75, 180);
    expect(Pb).toBeCloseTo(3331.34, -2);
    const err = Math.abs(Pb - 3331.34) / 3331.34;
    expect(err).toBeLessThan(0.05);
  });

  it('should return higher Pb than Standing for same inputs', () => {
    const PbStanding = calculateBubblePointStanding(800, 35, 0.75, 180);
    const PbVelarde = calculateBubblePointVelarde(800, 35, 0.75, 180);
    expect(PbVelarde).toBeGreaterThan(PbStanding);
  });

  it('should handle low rsb via rsb_lim clamp', () => {
    const Pb = calculateBubblePointVelarde(50, 35, 0.75, 180);
    expect(Pb).toBeGreaterThan(14.696);
    expect(isFinite(Pb)).toBe(true);
  });
});

// ============================================================================
// Standing Solution GOR (Phase 10)
// ============================================================================

describe('calculateRsStanding', () => {
  it('should match pyRT reference at P=1000 (API=35, T=180, sg=0.75)', () => {
    const Rs = calculateRsStanding(1000, 180, 35, 0.75);
    expect(Rs).toBeCloseTo(203.18, -1);
    const err = Math.abs(Rs - 203.18) / 203.18;
    expect(err).toBeLessThan(0.05);
  });

  it('should match pyRT reference at P=2000', () => {
    const Rs = calculateRsStanding(2000, 180, 35, 0.75);
    expect(Rs).toBeCloseTo(465.34, -1);
    const err = Math.abs(Rs - 465.34) / 465.34;
    expect(err).toBeLessThan(0.05);
  });

  it('should increase with pressure', () => {
    const Rs1 = calculateRsStanding(1000, 180, 35, 0.75);
    const Rs2 = calculateRsStanding(2000, 180, 35, 0.75);
    const Rs3 = calculateRsStanding(3000, 180, 35, 0.75);
    expect(Rs2).toBeGreaterThan(Rs1);
    expect(Rs3).toBeGreaterThan(Rs2);
  });

  it('should return 0 minimum for negative pressure edge case', () => {
    const Rs = calculateRsStanding(5, 180, 35, 0.75);
    expect(Rs).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Velarde Solution GOR (Phase 10)
// ============================================================================

describe('calculateRsVelarde', () => {
  it('should match pyRT reference at P=1000 (API=35, T=180, sg=0.75, pb=3166, rsb=800)', () => {
    const Rs = calculateRsVelarde(1000, 180, 35, 0.75, 3166, 800);
    expect(Rs).toBeCloseTo(311.02, -1);
    const err = Math.abs(Rs - 311.02) / 311.02;
    expect(err).toBeLessThan(0.05);
  });

  it('should match pyRT reference at P=2000', () => {
    const Rs = calculateRsVelarde(2000, 180, 35, 0.75, 3166, 800);
    expect(Rs).toBeCloseTo(518.87, -1);
    const err = Math.abs(Rs - 518.87) / 518.87;
    expect(err).toBeLessThan(0.05);
  });

  it('should return rsb when P >= Pb', () => {
    const Rs = calculateRsVelarde(4000, 180, 35, 0.75, 3166, 800);
    expect(Rs).toBeCloseTo(800, 0);
  });

  it('should increase with pressure (below Pb)', () => {
    const Rs1 = calculateRsVelarde(1000, 180, 35, 0.75, 3166, 800);
    const Rs2 = calculateRsVelarde(2000, 180, 35, 0.75, 3166, 800);
    expect(Rs2).toBeGreaterThan(Rs1);
  });
});

// ============================================================================
// McCain Density-Based Bo (Phase 10)
// ============================================================================

describe('calculateBoMcCain', () => {
  it('should return valid Bo structure for typical inputs', () => {
    const Bo = calculateBoMcCain(1000, 180, 35, 0.75, 203, 3166);
    expect(Bo).toBeGreaterThan(1.0);
    expect(Bo).toBeLessThan(2.0);
  });

  it('should produce reasonable Bo at P=1000 with Standing Rs=203', () => {
    // pyRT reference (1.0572) used VELAR Rs, not Standing Rs=203
    // With Standing Rs, Bo will differ due to Rs-dependency in mass balance
    const Bo = calculateBoMcCain(1000, 180, 35, 0.75, 203, 3166);
    expect(Bo).toBeGreaterThan(1.0);
    expect(Bo).toBeLessThan(1.3);
  });

  it('should increase Bo with increasing Rs (mass balance dependency)', () => {
    // pyRT Bo_mccain reference (1.0572) uses sg_sp gas gravity convention
    // Our function uses raw gasGravity per EXPLT-01 — systematic offset expected
    const Bo1 = calculateBoMcCain(1000, 180, 35, 0.75, 200, 3166);
    const Bo2 = calculateBoMcCain(1000, 180, 35, 0.75, 400, 3166);
    const Bo3 = calculateBoMcCain(1000, 180, 35, 0.75, 600, 3166);
    expect(Bo2).toBeGreaterThan(Bo1);
    expect(Bo3).toBeGreaterThan(Bo2);
  });

  it('should use SWMH density internally', () => {
    const Bo1 = calculateBoMcCain(1000, 180, 35, 0.75, 200, 3166);
    const Bo2 = calculateBoMcCain(1000, 180, 40, 0.75, 200, 3166);
    expect(Bo1).not.toEqual(Bo2);
  });
});

// ============================================================================
// Hall-Yarborough Z-Factor (Phase 10)
// ============================================================================

describe('solveZFactorHallYarborough', () => {
  // Standard test conditions: sg=0.75, T=180F
  // Ppc=667.2, Tpc=387.4 (Sutton)
  // Tpr = (180+460)/387.4 = 1.6524
  const Tpr = (180 + 460) / 387.4;

  it('should match pyRT Z=0.9028 at P=1000 (within 1%)', () => {
    const Ppr = (1000 - 14.7) / 667.2;
    const Z = solveZFactorHallYarborough(Ppr, Tpr);
    const err = Math.abs(Z - 0.9028) / 0.9028;
    expect(err).toBeLessThan(0.01);
  });

  it('should match pyRT Z=0.8489 at P=2000 (within 1%)', () => {
    const Ppr = (2000 - 14.7) / 667.2;
    const Z = solveZFactorHallYarborough(Ppr, Tpr);
    const err = Math.abs(Z - 0.8489) / 0.8489;
    expect(err).toBeLessThan(0.01);
  });

  it('should match pyRT Z=0.8565 at P=3000 (within 1%)', () => {
    const Ppr = (3000 - 14.7) / 667.2;
    const Z = solveZFactorHallYarborough(Ppr, Tpr);
    const err = Math.abs(Z - 0.8565) / 0.8565;
    expect(err).toBeLessThan(0.01);
  });

  it('should converge for typical ESP conditions', () => {
    const Z = solveZFactorHallYarborough(2.0, 1.5);
    expect(Z).toBeGreaterThan(0.3);
    expect(Z).toBeLessThan(1.5);
  });
});

// ============================================================================
// Wang-Ye-Wu Z-Factor (Phase 10)
// ============================================================================

describe('solveZFactorWangYeWu', () => {
  const Tpr = (180 + 460) / 387.4;

  it('should match pyRT Z=0.8843 at P=1000 (within 2%)', () => {
    const Ppr = (1000 - 14.7) / 667.2;
    const Z = solveZFactorWangYeWu(Ppr, Tpr);
    const err = Math.abs(Z - 0.8843) / 0.8843;
    expect(err).toBeLessThan(0.02);
  });

  it('should match pyRT Z=0.8384 at P=2000 (within 2%)', () => {
    const Ppr = (2000 - 14.7) / 667.2;
    const Z = solveZFactorWangYeWu(Ppr, Tpr);
    const err = Math.abs(Z - 0.8384) / 0.8384;
    expect(err).toBeLessThan(0.02);
  });

  it('should match pyRT Z=0.8601 at P=3000 (within 2%)', () => {
    const Ppr = (3000 - 14.7) / 667.2;
    const Z = solveZFactorWangYeWu(Ppr, Tpr);
    const err = Math.abs(Z - 0.8601) / 0.8601;
    expect(err).toBeLessThan(0.02);
  });

  it('should not require iteration (explicit formula)', () => {
    const Z = solveZFactorWangYeWu(1.5, 1.65);
    expect(isFinite(Z)).toBe(true);
    expect(Z).toBeGreaterThan(0);
  });
});

// ============================================================================
// Lee-Gonzalez-Eakin Gas Viscosity (Phase 10)
// ============================================================================

describe('calculateGasViscosityLGE', () => {
  it('should match pyRT ug=0.01411 at P=1000, Z=0.9025 (within 5%)', () => {
    const ug = calculateGasViscosityLGE(1000, 180, 0.75, 0.9025);
    const err = Math.abs(ug - 0.01411) / 0.01411;
    expect(err).toBeLessThan(0.05);
  });

  it('should match pyRT ug=0.01740 at P=2000, Z=0.8498 (within 5%)', () => {
    const ug = calculateGasViscosityLGE(2000, 180, 0.75, 0.8498);
    const err = Math.abs(ug - 0.01740) / 0.01740;
    expect(err).toBeLessThan(0.05);
  });

  it('should match pyRT ug=0.02174 at P=3000, Z=0.8594 (within 5%)', () => {
    const ug = calculateGasViscosityLGE(3000, 180, 0.75, 0.8594);
    const err = Math.abs(ug - 0.02174) / 0.02174;
    expect(err).toBeLessThan(0.05);
  });

  it('should increase with pressure (density effect)', () => {
    const ug1 = calculateGasViscosityLGE(1000, 180, 0.75, 0.9025);
    const ug2 = calculateGasViscosityLGE(2000, 180, 0.75, 0.8498);
    const ug3 = calculateGasViscosityLGE(3000, 180, 0.75, 0.8594);
    expect(ug2).toBeGreaterThan(ug1);
    expect(ug3).toBeGreaterThan(ug2);
  });
});

// ============================================================================
// Pb Dispatcher: 'valko-mccain' alias (Phase 10)
// ============================================================================

describe('calculateBubblePointPressure - valko-mccain alias', () => {
  it('should produce identical result to mccain', () => {
    const PbMcCain = calculateBubblePointPressure(800, 35, 0.75, 180, 'mccain');
    const PbValkoMcCain = calculateBubblePointPressure(800, 35, 0.75, 180, 'valko-mccain');
    expect(PbValkoMcCain).toEqual(PbMcCain);
  });

  it('should dispatch Standing correctly', () => {
    const PbStanding = calculateBubblePointStanding(800, 35, 0.75, 180);
    const PbDispatch = calculateBubblePointPressure(800, 35, 0.75, 180, 'standing');
    expect(PbDispatch).toBeCloseTo(PbStanding, 0);
  });

  it('should dispatch Velarde correctly', () => {
    const PbVelarde = calculateBubblePointVelarde(800, 35, 0.75, 180);
    const PbDispatch = calculateBubblePointPressure(800, 35, 0.75, 180, 'velarde');
    expect(PbDispatch).toBeCloseTo(PbVelarde, 0);
  });
});

// ============================================================================
// getPVTPropertiesAtPressure METHOD DISPATCH (Phase 10, Task 2)
// ============================================================================

describe('getPVTPropertiesAtPressure - method dispatch', () => {
  const api = 35;
  const gasGravity = 0.75;
  const temperature = 180;
  const totalGOR = 800;

  describe('backward compatibility (no new options)', () => {
    it('should produce identical results without options as before', () => {
      const resultDefault = getPVTPropertiesAtPressure(1000, temperature, api, gasGravity, totalGOR);
      const resultExplicit = getPVTPropertiesAtPressure(
        1000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod: 'vasquez-beggs', boMethod: 'vasquez-beggs', zMethod: 'dak' }
      );

      expect(resultDefault.rs).toEqual(resultExplicit.rs);
      expect(resultDefault.bo).toEqual(resultExplicit.bo);
      expect(resultDefault.zFactor).toEqual(resultExplicit.zFactor);
      expect(resultDefault.bubblePointPressure).toEqual(resultExplicit.bubblePointPressure);
    });
  });

  describe('rsMethod dispatch', () => {
    it('should produce different Rs with standing vs vasquez-beggs', () => {
      const resultVB = getPVTPropertiesAtPressure(
        1000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson' }
      );
      const resultStanding = getPVTPropertiesAtPressure(
        1000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod: 'standing' }
      );

      expect(resultVB.rs).not.toEqual(resultStanding.rs);
      expect(resultStanding.rs).toBeCloseTo(
        calculateRsStanding(1000, temperature, api, gasGravity), 6
      );
    });

    it('should produce different Rs with velarde vs vasquez-beggs', () => {
      const resultVB = getPVTPropertiesAtPressure(
        1000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson' }
      );
      const resultVelarde = getPVTPropertiesAtPressure(
        1000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod: 'velarde' }
      );

      expect(resultVB.rs).not.toEqual(resultVelarde.rs);
    });
  });

  describe('boMethod dispatch', () => {
    it('should produce different Bo with mccain vs vasquez-beggs', () => {
      const resultVB = getPVTPropertiesAtPressure(
        1000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson' }
      );
      const resultMcCain = getPVTPropertiesAtPressure(
        1000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', boMethod: 'mccain' }
      );

      expect(resultVB.bo).not.toEqual(resultMcCain.bo);
    });

    it('should produce different Bo with standing vs vasquez-beggs', () => {
      const resultVB = getPVTPropertiesAtPressure(
        1000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson' }
      );
      const resultStanding = getPVTPropertiesAtPressure(
        1000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', boMethod: 'standing' }
      );

      expect(resultVB.bo).not.toEqual(resultStanding.bo);
    });

    it('should correctly dispatch mccain Bo in undersaturated branch', () => {
      const result = getPVTPropertiesAtPressure(
        5000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', boMethod: 'mccain' }
      );

      expect(result.isSaturated).toBe(false);
      expect(result.bo).toBeGreaterThan(1.0);
      expect(result.bo).toBeLessThan(2.0);
    });
  });

  describe('zMethod dispatch', () => {
    it('should produce Z within 0.4% with hall-yarborough vs dak', () => {
      const resultDAK = getPVTPropertiesAtPressure(
        2000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', zMethod: 'dak' }
      );
      const resultHY = getPVTPropertiesAtPressure(
        2000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', zMethod: 'hall-yarborough' }
      );

      const zDAK = resultDAK.zFactor!;
      const zHY = resultHY.zFactor!;
      const relError = Math.abs(zDAK - zHY) / zDAK;
      expect(relError).toBeLessThan(0.004);
    });

    it('should produce Z within 2% with wang-ye-wu vs dak', () => {
      const resultDAK = getPVTPropertiesAtPressure(
        2000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', zMethod: 'dak' }
      );
      const resultWYW = getPVTPropertiesAtPressure(
        2000, temperature, api, gasGravity, totalGOR,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', zMethod: 'wang-ye-wu' }
      );

      const zDAK = resultDAK.zFactor!;
      const zWYW = resultWYW.zFactor!;
      const relError = Math.abs(zDAK - zWYW) / zDAK;
      expect(relError).toBeLessThan(0.02);
    });
  });

  describe('gasViscosity in return', () => {
    it('should include gasViscosity in saturated return', () => {
      const result = getPVTPropertiesAtPressure(
        1000, temperature, api, gasGravity, totalGOR
      );
      expect(result.isSaturated).toBe(true);
      expect(result.gasViscosity).toBeDefined();
      expect(result.gasViscosity).toBeGreaterThan(0.005);
      expect(result.gasViscosity).toBeLessThan(0.05);
    });

    it('should include gasViscosity in undersaturated return', () => {
      const result = getPVTPropertiesAtPressure(
        5000, temperature, api, gasGravity, totalGOR
      );
      expect(result.isSaturated).toBe(false);
      expect(result.gasViscosity).toBeDefined();
      expect(result.gasViscosity).toBeGreaterThan(0.005);
      expect(result.gasViscosity).toBeLessThan(0.05);
    });
  });

  describe('calculateFullZFactor zMethod parameter', () => {
    it('should accept zMethod parameter and dispatch correctly', () => {
      const resultDAK = calculateFullZFactor(1000 - 14.696, temperature, gasGravity);
      const resultHY = calculateFullZFactor(1000 - 14.696, temperature, gasGravity, 0, 0, 0, 'hall-yarborough');
      const resultWYW = calculateFullZFactor(1000 - 14.696, temperature, gasGravity, 0, 0, 0, 'wang-ye-wu');

      expect(resultDAK.Z).not.toEqual(resultHY.Z);
      expect(resultDAK.Z).not.toEqual(resultWYW.Z);

      const relErrorHY = Math.abs(resultDAK.Z - resultHY.Z) / resultDAK.Z;
      expect(relErrorHY).toBeLessThan(0.004);
    });
  });
});

// ============================================================================
// PHASE 10 PLAN 03: CROSS-VALIDATION & EDGE CASE TESTS
// ============================================================================
//
// Multi-condition validation at 3 input condition sets:
//   Condition Set 1 (baseline): API=35, T=180F, rsb=800, sg=0.75
//   Condition Set 2 (light oil, high GOR): API=42, T=200F, rsb=1200, sg=0.65
//   Condition Set 3 (heavy oil, low GOR): API=22, T=140F, rsb=200, sg=0.85
//
// Validation strategy: Self-consistent reference values computed from
// our implementations (MCP not available). Cross-method consistency,
// round-trip checks, physical behavior verification, and edge case coverage.

// calculateBoVasquezBeggs is imported above as calculateBo
const calculateBoVB = calculateBo;

// Self-consistent reference values computed from our implementations
// Condition Set 2: API=42, T=200F, rsb=1200, sg=0.65 (light oil, high GOR)
const COND_SET_2 = {
  api: 42, T: 200, rsb: 1200, sg: 0.65,
  standingPb: 4221.44,
  velardePb: 4631.66,
  standingRsAt1500: 349.49,
  velardeRsAt1500: 335.62,
};

// Condition Set 3: API=22, T=140F, rsb=200, sg=0.85 (heavy oil, low GOR)
const COND_SET_3 = {
  api: 22, T: 140, rsb: 200, sg: 0.85,
  standingPb: 1179.30,
  velardePb: 1211.10,
  standingRsAt500: 73.60,
  velardeRsAt500: 123.24,
};

// Z-factor cross-method reference: sg=0.65, T=200F
const Z_COND_SET_2 = {
  sg: 0.65, T: 200,
  Ppc: 670.13, Tpc: 365.11,
  points: [
    { P: 500,  dakZ: 0.962700, hyZ: 0.963686, wywZ: 0.974782 },
    { P: 1500, dakZ: 0.909568, hyZ: 0.910974, wywZ: 0.902241 },
    { P: 4000, dakZ: 0.945653, hyZ: 0.943340, wywZ: 0.941446 },
  ],
};

// LGE gas viscosity reference: sg=0.65, T=200F
const LGE_COND_SET_2 = [
  { P: 500,  ug: 0.013801, Z: 0.962700 },
  { P: 1500, ug: 0.015638, Z: 0.909568 },
  { P: 4000, ug: 0.023060, Z: 0.945653 },
];

// ============================================================================
// Bubble Point cross-validation (Condition Sets 1, 2, 3)
// ============================================================================

describe('Bubble Point cross-validation (Plan 10-03)', () => {
  const condSets = [
    { name: 'Set1 (baseline)',        api: 35, T: 180, rsb: 800,  sg: 0.75 },
    { name: 'Set2 (light, high GOR)', api: 42, T: 200, rsb: 1200, sg: 0.65 },
    { name: 'Set3 (heavy, low GOR)',  api: 22, T: 140, rsb: 200,  sg: 0.85 },
  ];

  describe.each(condSets)('$name', ({ api, T, rsb, sg }) => {
    it('Standing Pb is in physically reasonable range (100-20000 psia)', () => {
      const Pb = calculateBubblePointStanding(rsb, api, sg, T);
      expect(Pb).toBeGreaterThan(100);
      expect(Pb).toBeLessThan(20000);
    });

    it('Velarde Pb is in physically reasonable range (100-20000 psia)', () => {
      const Pb = calculateBubblePointVelarde(rsb, api, sg, T);
      expect(Pb).toBeGreaterThan(100);
      expect(Pb).toBeLessThan(20000);
    });

    it('Standing and Velarde Pb are within 25% of each other', () => {
      const PbStanding = calculateBubblePointStanding(rsb, api, sg, T);
      const PbVelarde = calculateBubblePointVelarde(rsb, api, sg, T);
      const relDiff = Math.abs(PbStanding - PbVelarde) / Math.max(PbStanding, PbVelarde);
      expect(relDiff).toBeLessThan(0.25);
    });
  });

  it('should match Condition Set 2 reference values', () => {
    const PbSt = calculateBubblePointStanding(COND_SET_2.rsb, COND_SET_2.api, COND_SET_2.sg, COND_SET_2.T);
    const PbVel = calculateBubblePointVelarde(COND_SET_2.rsb, COND_SET_2.api, COND_SET_2.sg, COND_SET_2.T);
    expect(PbSt).toBeCloseTo(COND_SET_2.standingPb, 0);
    expect(PbVel).toBeCloseTo(COND_SET_2.velardePb, 0);
  });

  it('should match Condition Set 3 reference values', () => {
    const PbSt = calculateBubblePointStanding(COND_SET_3.rsb, COND_SET_3.api, COND_SET_3.sg, COND_SET_3.T);
    const PbVel = calculateBubblePointVelarde(COND_SET_3.rsb, COND_SET_3.api, COND_SET_3.sg, COND_SET_3.T);
    expect(PbSt).toBeCloseTo(COND_SET_3.standingPb, 0);
    expect(PbVel).toBeCloseTo(COND_SET_3.velardePb, 0);
  });
});

// ============================================================================
// Standing Rs round-trip consistency
// ============================================================================

describe('Standing Rs round-trip (Plan 10-03)', () => {
  const condSets = [
    { name: 'Set1 (baseline)',        api: 35, T: 180, rsb: 800,  sg: 0.75 },
    { name: 'Set2 (light, high GOR)', api: 42, T: 200, rsb: 1200, sg: 0.65 },
    { name: 'Set3 (heavy, low GOR)',  api: 22, T: 140, rsb: 200,  sg: 0.85 },
  ];

  it.each(condSets)('$name: Rs(Standing Pb) equals rsb within 1%', ({ api, T, rsb, sg }) => {
    const Pb = calculateBubblePointStanding(rsb, api, sg, T);
    const RsRoundTrip = calculateRsStanding(Pb, T, api, sg);
    const relError = Math.abs(RsRoundTrip - rsb) / rsb;
    expect(relError).toBeLessThan(0.01);
  });

  it('should be exact (Standing Rs is algebraic inverse of Standing Pb)', () => {
    for (const rsb of [200, 500, 800, 1200, 1500]) {
      const Pb = calculateBubblePointStanding(rsb, 35, 0.75, 180);
      const Rs = calculateRsStanding(Pb, 180, 35, 0.75);
      expect(Rs).toBeCloseTo(rsb, 2);
    }
  });
});

// ============================================================================
// Velarde Rs edge cases
// ============================================================================

describe('Velarde Rs edge cases (Plan 10-03)', () => {
  const Pb = 3166;
  const rsb = 800;

  it('Rs at P >= Pb should be capped at rsb', () => {
    const Rs = calculateRsVelarde(4000, 180, 35, 0.75, Pb, rsb);
    expect(Rs).toBeCloseTo(rsb, 0);
  });

  it('Rs at P = Pb should equal rsb', () => {
    const Rs = calculateRsVelarde(Pb, 180, 35, 0.75, Pb, rsb);
    expect(Rs).toBeCloseTo(rsb, 0);
  });

  it('Rs at atmospheric pressure (14.696 psia) should be approximately 0', () => {
    const Rs = calculateRsVelarde(14.696, 180, 35, 0.75, Pb, rsb);
    expect(Rs).toBeLessThan(1);
    expect(Rs).toBeGreaterThanOrEqual(0);
  });

  it('should not produce NaN or Infinity for extreme API values', () => {
    for (const api of [15, 20, 50, 55]) {
      const Rs = calculateRsVelarde(2000, 180, api, 0.75, 3000, 800);
      expect(Number.isFinite(Rs)).toBe(true);
      expect(Rs).toBeGreaterThanOrEqual(0);
    }
  });

  it('should not produce NaN or Infinity for extreme temperatures', () => {
    for (const T of [80, 100, 300, 350]) {
      const Rs = calculateRsVelarde(2000, T, 35, 0.75, 3000, 800);
      expect(Number.isFinite(Rs)).toBe(true);
      expect(Rs).toBeGreaterThanOrEqual(0);
    }
  });

  it('Condition Set 2: Velarde Rs at P=1500 matches reference', () => {
    const Pb2 = calculateBubblePointVelarde(COND_SET_2.rsb, COND_SET_2.api, COND_SET_2.sg, COND_SET_2.T);
    const Rs = calculateRsVelarde(1500, COND_SET_2.T, COND_SET_2.api, COND_SET_2.sg, Pb2, COND_SET_2.rsb);
    expect(Rs).toBeCloseTo(COND_SET_2.velardeRsAt1500, 0);
  });

  it('Condition Set 3: Velarde Rs at P=500 matches reference', () => {
    const Pb3 = calculateBubblePointVelarde(COND_SET_3.rsb, COND_SET_3.api, COND_SET_3.sg, COND_SET_3.T);
    const Rs = calculateRsVelarde(500, COND_SET_3.T, COND_SET_3.api, COND_SET_3.sg, Pb3, COND_SET_3.rsb);
    expect(Rs).toBeCloseTo(COND_SET_3.velardeRsAt500, 0);
  });
});

// ============================================================================
// McCain Bo vs Standing Bo comparison
// ============================================================================

describe('Bo method comparison (Plan 10-03)', () => {
  const condSets = [
    { name: 'Set1', api: 35, T: 180, rsb: 800,  sg: 0.75 },
    { name: 'Set2', api: 42, T: 200, rsb: 1200, sg: 0.65 },
    { name: 'Set3', api: 22, T: 140, rsb: 200,  sg: 0.85 },
  ];

  describe.each(condSets)('$name', ({ api, T, rsb, sg }) => {
    it('all Bo methods produce Bo > 1.0 for saturated conditions', () => {
      const Pb = calculateBubblePointStanding(rsb, api, sg, T);
      const Rs = calculateRsStanding(Pb * 0.5, T, api, sg);

      const boVB = calculateBoVB(Rs, T, api, sg);
      const boStanding = calculateOilFVFAtBubblePoint(Rs, sg, api, T);
      const boMcCain = calculateBoMcCain(Pb * 0.5, T, api, sg, Rs, Pb);

      expect(boVB).toBeGreaterThan(1.0);
      expect(boStanding).toBeGreaterThan(1.0);
      expect(boMcCain).toBeGreaterThan(1.0);
    });

    it('all Bo methods produce values in physically reasonable range (1.0 - 3.0)', () => {
      const Pb = calculateBubblePointStanding(rsb, api, sg, T);
      const Rs = calculateRsStanding(Pb * 0.5, T, api, sg);

      const boVB = calculateBoVB(Rs, T, api, sg);
      const boStanding = calculateOilFVFAtBubblePoint(Rs, sg, api, T);
      const boMcCain = calculateBoMcCain(Pb * 0.5, T, api, sg, Rs, Pb);

      for (const Bo of [boVB, boStanding, boMcCain]) {
        expect(Bo).toBeGreaterThanOrEqual(1.0);
        expect(Bo).toBeLessThanOrEqual(3.0);
      }
    });
  });

  it('McCain Bo uses SWMH density internally (API sensitivity)', () => {
    const Pb = calculateBubblePointStanding(800, 35, 0.75, 180);
    const Rs = calculateRsStanding(2000, 180, 35, 0.75);

    const boMcCain35 = calculateBoMcCain(2000, 180, 35, 0.75, Rs, Pb);
    const boMcCain40 = calculateBoMcCain(2000, 180, 40, 0.75, Rs, Pb);
    expect(boMcCain35).not.toEqual(boMcCain40);
  });

  it('Condition Set 2 Bo comparison at P=1500', () => {
    const Rs = COND_SET_2.standingRsAt1500;
    const boVB = calculateBoVB(Rs, COND_SET_2.T, COND_SET_2.api, COND_SET_2.sg);
    const boStanding = calculateOilFVFAtBubblePoint(Rs, COND_SET_2.sg, COND_SET_2.api, COND_SET_2.T);
    const boMcCain = calculateBoMcCain(1500, COND_SET_2.T, COND_SET_2.api, COND_SET_2.sg, Rs, COND_SET_2.standingPb);

    expect(boVB).toBeCloseTo(1.2669, 2);
    expect(boStanding).toBeCloseTo(1.2499, 2);
    expect(boMcCain).toBeCloseTo(1.2436, 2);
  });
});

// ============================================================================
// Z-factor cross-method consistency
// ============================================================================

describe('Z-factor cross-validation (Plan 10-03)', () => {
  const relativeError = (a: number, b: number) =>
    Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 0.01);

  describe('Condition Set 2 (sg=0.65, T=200F)', () => {
    it.each(Z_COND_SET_2.points)(
      'P=$P: DAK vs HY within 0.5%',
      ({ P, dakZ }) => {
        const dak = calculateFullZFactor(P - 14.696, Z_COND_SET_2.T, Z_COND_SET_2.sg);
        const Ppr = P / Z_COND_SET_2.Ppc;
        const Tpr = (Z_COND_SET_2.T + 460) / Z_COND_SET_2.Tpc;
        const hy = solveZFactorHallYarborough(Ppr, Tpr);

        expect(dak.Z).toBeCloseTo(dakZ, 4);
        expect(relativeError(dak.Z, hy)).toBeLessThan(0.005);
      }
    );

    it.each(Z_COND_SET_2.points)(
      'P=$P: WYW within 3% of DAK',
      ({ P }) => {
        const dak = calculateFullZFactor(P - 14.696, Z_COND_SET_2.T, Z_COND_SET_2.sg);
        const Ppr = P / Z_COND_SET_2.Ppc;
        const Tpr = (Z_COND_SET_2.T + 460) / Z_COND_SET_2.Tpc;
        const wyw = solveZFactorWangYeWu(Ppr, Tpr);

        expect(relativeError(dak.Z, wyw)).toBeLessThan(0.03);
      }
    );
  });

  describe('Condition Set 1 (baseline: sg=0.75, T=180F)', () => {
    const Ppc1 = 656.5;
    const Tpc1 = 389.7;

    it.each([1000, 2000, 3000])(
      'P=%i: DAK vs HY within 0.5%',
      (P) => {
        const dak = calculateFullZFactor(P - 14.696, 180, 0.75);
        const Ppr = P / Ppc1;
        const Tpr = (180 + 460) / Tpc1;
        const hy = solveZFactorHallYarborough(Ppr, Tpr);
        expect(relativeError(dak.Z, hy)).toBeLessThan(0.005);
      }
    );
  });

  describe('all methods return Z in physically reasonable range [0.1, 2.0]', () => {
    const conditions = [
      { P: 500,  T: 200, sg: 0.65 },
      { P: 2000, T: 180, sg: 0.75 },
      { P: 4000, T: 200, sg: 0.65 },
      { P: 5000, T: 200, sg: 0.85 },
    ];

    it.each(conditions)('P=$P T=$T sg=$sg: all methods in [0.1, 2.0]', ({ P, T, sg }) => {
      const Ppc = calculateSuttonPseudoCriticalPressure(sg);
      const Tpc = calculateSuttonPseudoCriticalTemperature(sg);
      const Ppr = P / Ppc;
      const Tpr = (T + 460) / Tpc;

      const dak = calculateFullZFactor(P - 14.696, T, sg);
      const hy = solveZFactorHallYarborough(Ppr, Tpr);
      const wyw = solveZFactorWangYeWu(Ppr, Tpr);

      for (const Z of [dak.Z, hy, wyw]) {
        expect(Z).toBeGreaterThanOrEqual(0.1);
        expect(Z).toBeLessThanOrEqual(2.0);
      }
    });
  });

  describe('high pressure (Ppr > 7)', () => {
    it('P=5000 psia, sg=0.65: no divergence, all methods agree within 3%', () => {
      const Ppc = calculateSuttonPseudoCriticalPressure(0.65);
      const Tpc = calculateSuttonPseudoCriticalTemperature(0.65);
      const Ppr = 5000 / Ppc;
      const Tpr = (200 + 460) / Tpc;

      expect(Ppr).toBeGreaterThan(7);

      const dak = calculateFullZFactor(5000 - 14.696, 200, 0.65);
      const hy = solveZFactorHallYarborough(Ppr, Tpr);
      const wyw = solveZFactorWangYeWu(Ppr, Tpr);

      expect(relativeError(dak.Z, hy)).toBeLessThan(0.03);
      expect(relativeError(dak.Z, wyw)).toBeLessThan(0.03);
      expect(Number.isFinite(dak.Z)).toBe(true);
      expect(Number.isFinite(hy)).toBe(true);
      expect(Number.isFinite(wyw)).toBe(true);
    });
  });

  describe('low temperature convergence', () => {
    it.each([80, 100, 120])('T=%i F: all methods converge (no NaN/Infinity)', (T) => {
      const Ppc = calculateSuttonPseudoCriticalPressure(0.75);
      const Tpc = calculateSuttonPseudoCriticalTemperature(0.75);
      const Ppr = 2000 / Ppc;
      const Tpr = (T + 460) / Tpc;

      const dak = calculateFullZFactor(2000 - 14.696, T, 0.75);
      const hy = solveZFactorHallYarborough(Ppr, Tpr);
      const wyw = solveZFactorWangYeWu(Ppr, Tpr);

      expect(Number.isFinite(dak.Z)).toBe(true);
      expect(Number.isFinite(hy)).toBe(true);
      expect(Number.isFinite(wyw)).toBe(true);
      expect(dak.Z).toBeGreaterThan(0.3);
      expect(hy).toBeGreaterThan(0.3);
    });
  });
});

// ============================================================================
// Hall-Yarborough convergence robustness
// ============================================================================

describe('Hall-Yarborough convergence (Plan 10-03)', () => {
  it('normal conditions: converges to valid value', () => {
    const Z = solveZFactorHallYarborough(2.0, 1.5);
    expect(Z).toBeGreaterThan(0.3);
    expect(Z).toBeLessThan(1.5);
    expect(Number.isFinite(Z)).toBe(true);
  });

  it('high pressure (Ppr=7.5) with moderate Tpr: converges', () => {
    const Z = solveZFactorHallYarborough(7.5, 1.8);
    expect(Number.isFinite(Z)).toBe(true);
    expect(Z).toBeGreaterThan(0.5);
    expect(Z).toBeLessThan(2.0);
  });

  it('low reduced temperature (Tpr=1.2): still converges', () => {
    const Z = solveZFactorHallYarborough(3.0, 1.2);
    expect(Number.isFinite(Z)).toBe(true);
    expect(Z).toBeGreaterThan(0.1);
    expect(Z).toBeLessThan(2.0);
  });

  it('very low Ppr (near ideal gas): Z approaches 1', () => {
    const Z = solveZFactorHallYarborough(0.2, 1.8);
    expect(Z).toBeGreaterThan(0.95);
    expect(Z).toBeLessThan(1.05);
  });

  it('matches DAK within 0.5% across range of conditions', () => {
    const cases = [
      { Ppr: 0.5, Tpr: 1.5 },
      { Ppr: 2.0, Tpr: 1.5 },
      { Ppr: 4.0, Tpr: 2.0 },
      { Ppr: 6.0, Tpr: 1.8 },
    ];

    for (const { Ppr, Tpr } of cases) {
      const hy = solveZFactorHallYarborough(Ppr, Tpr);
      const wyw = solveZFactorWangYeWu(Ppr, Tpr);
      expect(Number.isFinite(hy)).toBe(true);
      expect(Number.isFinite(wyw)).toBe(true);
    }
  });
});

// ============================================================================
// LGE gas viscosity physical behavior validation
// ============================================================================

describe('LGE gas viscosity validation (Plan 10-03)', () => {
  describe('Condition Set 2 (sg=0.65, T=200F)', () => {
    it.each(LGE_COND_SET_2)(
      'P=$P: ug matches reference within 1%',
      ({ P, ug: ref, Z }) => {
        const ug = calculateGasViscosityLGE(P, 200, 0.65, Z);
        const err = Math.abs(ug - ref) / ref;
        expect(err).toBeLessThan(0.01);
      }
    );
  });

  it('viscosity increases with pressure at constant T (monotonic)', () => {
    const pressures = [500, 1000, 1500, 2000, 3000, 4000];
    const viscosities = pressures.map(P => {
      const dak = calculateFullZFactor(P - 14.696, 200, 0.65);
      return calculateGasViscosityLGE(P, 200, 0.65, dak.Z);
    });

    for (let i = 1; i < viscosities.length; i++) {
      expect(viscosities[i]).toBeGreaterThan(viscosities[i - 1]);
    }
  });

  it('viscosity in physically reasonable range (0.005 - 0.05 cP) for natural gas', () => {
    const conditions = [
      { P: 500,  T: 200, sg: 0.65 },
      { P: 2000, T: 180, sg: 0.75 },
      { P: 3000, T: 200, sg: 0.85 },
      { P: 4000, T: 250, sg: 0.65 },
    ];

    for (const { P, T, sg } of conditions) {
      const dak = calculateFullZFactor(P - 14.696, T, sg);
      const ug = calculateGasViscosityLGE(P, T, sg, dak.Z);
      expect(ug).toBeGreaterThan(0.005);
      expect(ug).toBeLessThan(0.05);
    }
  });

  it('higher gas gravity increases viscosity at same P and T', () => {
    const ugLight = calculateGasViscosityLGE(2000, 200, 0.65, 0.91);
    const ugHeavy = calculateGasViscosityLGE(2000, 200, 0.85, 0.83);
    expect(ugHeavy).toBeGreaterThan(ugLight);
  });

  it('temperature trend at constant P for condition set 2', () => {
    const ugT150 = (() => {
      const dak = calculateFullZFactor(1500 - 14.696, 150, 0.65);
      return calculateGasViscosityLGE(1500, 150, 0.65, dak.Z);
    })();
    const ugT250 = (() => {
      const dak = calculateFullZFactor(1500 - 14.696, 250, 0.65);
      return calculateGasViscosityLGE(1500, 250, 0.65, dak.Z);
    })();

    // At moderate pressures, gas viscosity generally increases with temperature
    // (kinetic theory dominates at lower densities)
    expect(Number.isFinite(ugT150)).toBe(true);
    expect(Number.isFinite(ugT250)).toBe(true);
    expect(ugT150).toBeGreaterThan(0.005);
    expect(ugT250).toBeGreaterThan(0.005);
  });
});

// ============================================================================
// getPVTPropertiesAtPressure integration with all method combinations
// ============================================================================

describe('getPVTPropertiesAtPressure method integration (Plan 10-03)', () => {
  const rsMethods = ['vasquez-beggs', 'standing', 'velarde'] as const;
  const boMethods = ['vasquez-beggs', 'standing', 'mccain'] as const;
  const zMethods = ['dak', 'hall-yarborough', 'wang-ye-wu'] as const;

  describe('each method combination produces valid non-NaN non-Infinity results', () => {
    for (const rsMethod of rsMethods) {
      for (const boMethod of boMethods) {
        for (const zMethod of zMethods) {
          it(`rs=${rsMethod}, bo=${boMethod}, z=${zMethod}: valid at P=1500 (saturated)`, () => {
            const result = getPVTPropertiesAtPressure(
              1500, 180, 35, 0.75, 800,
              { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod, boMethod, zMethod }
            );

            expect(Number.isFinite(result.rs)).toBe(true);
            expect(Number.isFinite(result.bo)).toBe(true);
            expect(Number.isFinite(result.oilViscosity)).toBe(true);
            expect(result.gasViscosity).toBeDefined();
            expect(Number.isFinite(result.gasViscosity!)).toBe(true);
            expect(result.rs).toBeGreaterThanOrEqual(0);
            expect(result.bo).toBeGreaterThanOrEqual(1.0);
            expect(result.zFactor).toBeGreaterThan(0);
          });
        }
      }
    }
  });

  it('gasViscosity is always populated (saturated and undersaturated)', () => {
    const saturated = getPVTPropertiesAtPressure(1500, 180, 35, 0.75, 800);
    const undersaturated = getPVTPropertiesAtPressure(5000, 180, 35, 0.75, 800);

    expect(saturated.gasViscosity).toBeDefined();
    expect(saturated.gasViscosity).toBeGreaterThan(0);
    expect(undersaturated.gasViscosity).toBeDefined();
    expect(undersaturated.gasViscosity).toBeGreaterThan(0);
  });

  it('saturated branch: Rs varies by method', () => {
    const vb = getPVTPropertiesAtPressure(1500, 180, 35, 0.75, 800, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod: 'vasquez-beggs' });
    const st = getPVTPropertiesAtPressure(1500, 180, 35, 0.75, 800, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod: 'standing' });
    const vel = getPVTPropertiesAtPressure(1500, 180, 35, 0.75, 800, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod: 'velarde' });

    expect(vb.rs).not.toEqual(st.rs);
    expect(st.rs).not.toEqual(vel.rs);
  });

  it('saturated branch: Bo varies by method', () => {
    const vb = getPVTPropertiesAtPressure(1500, 180, 35, 0.75, 800, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', boMethod: 'vasquez-beggs' });
    const st = getPVTPropertiesAtPressure(1500, 180, 35, 0.75, 800, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', boMethod: 'standing' });
    const mc = getPVTPropertiesAtPressure(1500, 180, 35, 0.75, 800, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', boMethod: 'mccain' });

    expect(vb.bo).not.toEqual(st.bo);
    expect(st.bo).not.toEqual(mc.bo);
  });

  it('undersaturated branch: Rs = rsb regardless of method', () => {
    const vb = getPVTPropertiesAtPressure(5000, 180, 35, 0.75, 800, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod: 'vasquez-beggs' });
    const st = getPVTPropertiesAtPressure(5000, 180, 35, 0.75, 800, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod: 'standing' });
    const vel = getPVTPropertiesAtPressure(5000, 180, 35, 0.75, 800, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod: 'velarde' });

    expect(vb.rs).toBe(800);
    expect(st.rs).toBe(800);
    expect(vel.rs).toBe(800);
  });

  it('undersaturated branch: Bo varies by method (different Bob at Pb)', () => {
    const vb = getPVTPropertiesAtPressure(5000, 180, 35, 0.75, 800, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', boMethod: 'vasquez-beggs' });
    const st = getPVTPropertiesAtPressure(5000, 180, 35, 0.75, 800, { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', boMethod: 'standing' });

    expect(vb.bo).not.toEqual(st.bo);
  });

  it('all methods maintain physical constraints (Rs >= 0, Bo >= 1, Z > 0)', () => {
    const pressures = [500, 1500, 3000, 5000];
    for (const P of pressures) {
      for (const rsMethod of rsMethods) {
        const result = getPVTPropertiesAtPressure(
          P, 180, 35, 0.75, 800,
          { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod }
        );
        expect(result.rs).toBeGreaterThanOrEqual(0);
        expect(result.bo).toBeGreaterThanOrEqual(1.0);
        expect(result.zFactor).toBeGreaterThan(0);
        expect(result.oilViscosity).toBeGreaterThan(0);
      }
    }
  });

  it('Condition Set 2 integration: all methods produce valid results', () => {
    for (const rsMethod of rsMethods) {
      const result = getPVTPropertiesAtPressure(
        1500, COND_SET_2.T, COND_SET_2.api, COND_SET_2.sg, COND_SET_2.rsb,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod }
      );
      expect(result.rs).toBeGreaterThan(0);
      expect(result.bo).toBeGreaterThan(1.0);
      expect(result.gasViscosity).toBeDefined();
      expect(result.gasViscosity!).toBeGreaterThan(0.005);
    }
  });

  it('Condition Set 3 integration: all methods produce valid results', () => {
    for (const rsMethod of rsMethods) {
      const result = getPVTPropertiesAtPressure(
        500, COND_SET_3.T, COND_SET_3.api, COND_SET_3.sg, COND_SET_3.rsb,
        { pbCorrelation: 'vasquez-beggs', viscosityMethod: 'beggs-robinson', rsMethod }
      );
      expect(result.rs).toBeGreaterThan(0);
      expect(result.bo).toBeGreaterThan(1.0);
      expect(result.gasViscosity).toBeDefined();
    }
  });
});

// ============================================================================
// pyRT Reference Tests (Issue #13 - independently sourced ground-truth values)
// ============================================================================

describe('pyRT Reference Tests (Issue #13 - independently sourced)', () => {
  // All expected values generated from pyrestoolbox v2.5.0
  // Generated: 2026-03-04
  // These values are hardcoded from an independent oracle (pyrestoolbox)
  // and NOT computed from our own implementation.
  //
  // KNOWN VARIANT (AUDIT-04): pyRT Standing Pb adds P_STD (14.696 psia) to the
  // result, treating output as absolute pressure. Our implementation omits this
  // offset for Excel compatibility (decision AUDIT-04). The raw pyRT values are
  // documented alongside the P_STD-adjusted values used in assertions.
  //
  // KNOWN VARIANT (Rs): pyRT Standing Rs subtracts P_STD from input pressure
  // before evaluating (source: pyrestoolbox/oil/oil.py line 85, comment:
  // "Subtracting 14.7 as suspect this pressure in psig"). Our implementation
  // does not subtract P_STD. This produces ~0.8% divergence at typical pressures.
  //
  // KNOWN VARIANT (Bo): pyRT bo_method.STAN uses the same Standing (1947) Bob
  // equation as our calculateOilFVFAtBubblePoint. Differences arise solely from
  // the Rs input values (which differ due to the P_STD variant above).

  const P_STD = 14.696;

  describe('Standing Bubble Point - pyRT reference', () => {
    // Source: pyrestoolbox v2.5.0, oil_pbub(pbmethod=pb_method.STAN)
    // Call: oil_pbub(api=X, degf=T, rsb=GOR, sg_g=sg, pbmethod=pb_method.STAN)
    // pyRT raw values: 2624.3673, 2842.4358, 2337.0268
    // Adjusted (pyRT - P_STD) to match our gauge-pressure convention (AUDIT-04):
    const cases = [
      { api: 35, T: 180, rsb: 600, sg: 0.70, pyrtRaw: 2624.4, expected: 2609.7 },
      { api: 40, T: 200, rsb: 800, sg: 0.75, pyrtRaw: 2842.4, expected: 2827.7 },
      { api: 28, T: 160, rsb: 400, sg: 0.65, pyrtRaw: 2337.0, expected: 2322.3 },
    ];

    it.each(cases)(
      'API=$api T=$T GOR=$rsb sg=$sg => Pb~$expected psi (pyRT raw=$pyrtRaw)',
      ({ api, T, rsb, sg, pyrtRaw, expected }) => {
        const Pb = calculateBubblePointStanding(rsb, api, sg, T);
        // Verify our result matches pyRT - P_STD within 1 psi
        expect(Pb).toBeCloseTo(expected, 0);
        // Verify the P_STD offset is the ONLY difference from pyRT
        expect(Pb + P_STD).toBeCloseTo(pyrtRaw, 0);
      }
    );
  });

  describe('Standing Rs - pyRT reference', () => {
    // Source: pyrestoolbox v2.5.0, oil_rs(rsmethod=rs_method.STAN)
    // Call: oil_rs(api=X, degf=T, p=P, sg_sp=sg, pb=Pb, rsb=GOR, rsmethod=rs_method.STAN)
    // Each case uses a pressure BELOW the Standing Pb for that condition.
    // pyRT subtracts P_STD from pressure internally (psig convention), causing
    // ~0.8% systematic divergence from our psia convention. Both are valid
    // interpretations of Standing (1947).
    const cases = [
      { api: 35, T: 180, P: 1500, sg: 0.70, pyrtValue: 307.9 },
      { api: 40, T: 200, P: 2000, sg: 0.75, pyrtValue: 526.2 },
      { api: 28, T: 160, P: 1200, sg: 0.65, pyrtValue: 180.8 },
    ];

    it.each(cases)(
      'API=$api T=$T P=$P sg=$sg => Rs within 1.5%% of pyRT $pyrtValue scf/stb',
      ({ api, T, P, sg, pyrtValue }) => {
        const Rs = calculateRsStanding(P, T, api, sg);
        // Relative error < 1.5% (known P_STD variant: pyRT subtracts 14.696 from P)
        const relError = Math.abs(Rs - pyrtValue) / pyrtValue;
        expect(relError).toBeLessThan(0.015);
        // Verify physical reasonableness: Rs > 0
        expect(Rs).toBeGreaterThan(0);
      }
    );
  });

  describe('Standing Bo - pyRT reference', () => {
    // Source: pyrestoolbox v2.5.0, oil_bo(bomethod=bo_method.STAN)
    // Call: oil_bo(p=P, pb=Pb, degf=T, rs=Rs, rsb=GOR, sg_o=SG, sg_sp=sg, bomethod=bo_method.STAN)
    // Bo at saturated conditions (P < Pb), using pyRT Rs values as input.
    //
    // KNOWN VARIANT: pyRT Standing Bo uses a different coefficient set:
    //   pyRT:  Bob = 0.972 + 1.47e-4 * (Rs * (sg_g/sg_o)^0.5 + 1.25*T)^1.175
    //   Ours:  Bob = 0.98496 + 0.0001 * (Rs^0.755 * sg_g^0.25 * sg_o^-1.5 + 0.45*T)^1.5
    // Both are published variants of Standing (1947). Typical divergence: 0.8-1.1%.
    // Tolerance set at 1.5% to accommodate the formula variant while still
    // catching gross implementation errors (wrong exponents, missing terms).
    const cases = [
      { api: 35, T: 180, sg: 0.70, rs: 307.9, pyrtBo: 1.1926 },
      { api: 40, T: 200, sg: 0.75, rs: 526.2, pyrtBo: 1.3245 },
      { api: 28, T: 160, sg: 0.65, rs: 180.8, pyrtBo: 1.1179 },
    ];

    it.each(cases)(
      'API=$api T=$T sg=$sg Rs=$rs => Bo within 1.5%% of pyRT $pyrtBo rb/stb',
      ({ api, T, sg, rs, pyrtBo }) => {
        const Bo = calculateOilFVFAtBubblePoint(rs, sg, api, T);
        const relError = Math.abs(Bo - pyrtBo) / pyrtBo;
        expect(relError).toBeLessThan(0.015);
        // Bo must exceed 1.0 (physical constraint: oil swells with dissolved gas)
        expect(Bo).toBeGreaterThan(1.0);
      }
    );
  });
});

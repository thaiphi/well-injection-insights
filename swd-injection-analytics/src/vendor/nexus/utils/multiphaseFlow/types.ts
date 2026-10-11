/**
 * Multiphase Flow Types
 *
 * Type definitions for Beggs-Brill multiphase flow correlation
 * and well trajectory calculations.
 */

/**
 * Flow regime classification per Beggs-Brill correlation.
 * Determined by Froude number (NFR) and input liquid content (λL).
 */
export type FlowRegime = 'segregated' | 'intermittent' | 'distributed' | 'transition';

/**
 * Available pressure drop correlation methods.
 * - hazen-williams: Single-phase friction (legacy, faster)
 * - beggs-brill: Multiphase correlation for all inclinations (horizontal/deviated)
 * - hagedorn-brown: Multiphase correlation for vertical/near-vertical wells
 */
export type MultiphaseMethod = 'beggs-brill' | 'hagedorn-brown' | 'hazen-williams' | 'gray' | 'woldesemayat-ghajar';

/**
 * Available bubble point pressure correlation methods.
 * - 'vasquez-beggs': Inverted Vasquez-Beggs Rs correlation (matches Excel spreadsheet)
 * - 'mccain': McCain et al. (2011) direct-fit correlation (alias for 'valko-mccain')
 * - 'valko-mccain': Valko-McCain (2003) 4x4 coefficient matrix (same as 'mccain')
 * - 'standing': Standing (1947) correlation
 * - 'velarde': Velarde, Blasingame & McCain (1997) correlation
 */
export type PbCorrelation = 'vasquez-beggs' | 'mccain' | 'valko-mccain' | 'standing' | 'velarde';

/** Available solution GOR correlation methods */
export type RsCorrelation = 'vasquez-beggs' | 'standing' | 'velarde';

/** Available oil FVF correlation methods */
export type BoCorrelation = 'vasquez-beggs' | 'standing' | 'mccain';

/** Available Z-factor correlation methods */
export type ZCorrelation = 'dak' | 'hall-yarborough' | 'wang-ye-wu';

/** Available oil viscosity correlation methods */
export type ViscosityCorrelation = 'beggs-robinson' | 'beal-chew-connally';

/**
 * Configuration for PVT property calculations.
 * Controls which correlations are used for each property
 * and provides sour gas / salinity parameters.
 */
export type PVTConfig = {
  pbCorrelation?: PbCorrelation;
  rsMethod?: RsCorrelation;
  boMethod?: BoCorrelation;
  zMethod?: ZCorrelation;
  viscosityMethod?: ViscosityCorrelation;
  yH2S?: number;
  yCO2?: number;
  yN2?: number;
  salinity?: number;
};

/**
 * Pipe segment for pressure drop calculation.
 * Represents a discrete section of the wellbore with uniform properties.
 */
export type PipeSegment = {
  /** Segment length in feet */
  length: number;
  /** Inclination in degrees from horizontal (0=horizontal, 90=vertical up, -90=vertical down) */
  inclination: number;
  /** Inner diameter in inches */
  diameter: number;
  /** Absolute roughness in feet (default 0.0006 for commercial steel) */
  roughness: number;
  /** Optional segment index for tracking */
  index?: number;
  /** True Vertical Depth at segment midpoint in feet (for temperature/PVT) */
  tvd?: number;
};

/**
 * Flow conditions at a point in the wellbore.
 * All rates are at standard conditions unless otherwise noted.
 */
export type FlowConditions = {
  /** Total liquid rate in bbl/d (oil + water at stock tank) */
  liquidRate: number;
  /** Gas rate in Mscf/d at standard conditions */
  gasRate: number;
  /** Water cut as fraction (0-1) */
  waterCut: number;
  /** Oil API gravity */
  oilAPI: number;
  /** Gas specific gravity (air = 1.0) */
  gasGravity: number;
  /** Temperature in °F */
  temperature: number;
  /** Pressure in psia (inlet to segment) */
  pressure: number;
  /**
   * Optional: produced-water specific gravity, defaults to `PRODUCED_WATER_SG_DEFAULT` (1.02).
   *
   * The well's entered water weight (`ExistingProductionInput.waterSG`, default 1.05).
   * Feeds `rhoW -> rhoL` in every correlation, so it lands on the hydrostatic gradient —
   * the dominant term of a traverse, not a friction correction.
   *
   * ⚠ This field is only honest while every correlation reads it. One that stops makes it
   * an inert setting the UI still collects — the shape `PVTConfig.salinity` already has.
   */
  waterSG?: number;
  /** Optional: Solution GOR in scf/stb (calculated if not provided) */
  solutionGOR?: number;
  /** Optional: Mole fraction of N2 (0-1), defaults to 0 */
  yN2?: number;
  /** Optional: Mole fraction of CO2 (0-1), defaults to 0 */
  yCO2?: number;
  /** Optional: Mole fraction of H2S (0-1), defaults to 0 */
  yH2S?: number;
  /** Optional: Total producing GOR at bubble point in scf/stb (calculated from gasRate/oilRate if not provided) */
  rsb?: number;
  /** Optional: Bubble point pressure correlation method (default: 'vasquez-beggs') */
  pbCorrelation?: PbCorrelation;
  /** Optional: PVT configuration for correlation method selection */
  pvtConfig?: PVTConfig;
};

/**
 * PVT properties at a given pressure with bubble point awareness.
 * Handles both saturated (P < Pb) and undersaturated (P > Pb) conditions.
 */
export type PVTProperties = {
  /** Solution GOR in scf/stb (capped at Rsb if P > Pb) */
  rs: number;
  /** Oil formation volume factor in rb/stb */
  bo: number;
  /** Live oil viscosity in cp */
  oilViscosity: number;
  /** Dead oil viscosity in cp (for reference) */
  deadOilViscosity: number;
  /** Bubble point pressure in psia */
  bubblePointPressure: number;
  /** True if P < Pb (saturated), false if P >= Pb (undersaturated) */
  isSaturated: boolean;
  /** Oil compressibility in psi^-1 (only meaningful when undersaturated) */
  oilCompressibility?: number;
  /** Oil density in lb/ft3 (SWMH method) */
  oilDensity?: number;
  /** Water formation volume factor in rb/stb */
  waterFVF?: number;
  /** Water density in lb/ft3 */
  waterDensity?: number;
  /** Water viscosity in cp */
  waterViscosity?: number;
  /** Water compressibility in psi^-1 */
  waterCompressibility?: number;
  /** Gas formation volume factor in cf/scf */
  gasFVF?: number;
  /** Gas compressibility factor (dimensionless) */
  zFactor?: number;
  /** Gas viscosity in cp (Lee-Gonzalez-Eakin) */
  gasViscosity?: number;
};

/**
 * Result of multiphase pressure drop calculation for a single segment.
 */
export type MultiphaseResult = {
  /** Pressure drop across segment in psi */
  pressureDrop: number;
  /** Liquid holdup fraction (0-1) */
  liquidHoldup: number;
  /**
   * In-situ gas volume fraction, vsg / (vsl + vsg).
   *
   * Computed identically by every correlation, which is the point: it replaced `flowRegime`,
   * a field three mechanisms wrote with incompatible meanings. Beggs-Brill assigned it from
   * the 1973 pattern map, where a gasless segment has lambda_L = 1 and reads 'distributed';
   * Hagedorn-Brown, Gray and Woldesemayat-Ghajar assigned it from an undocumented GVF ladder,
   * where the same segment reads 'segregated'. Use gvfFromVelocities to compute it and
   * deriveGvfBand to display it -- 0 here means either no gas or no velocities, and only the
   * band tells those apart.
   */
  gvf: number;
  /** Mixture velocity in ft/s */
  mixtureVelocity: number;
  /** Two-phase friction factor (dimensionless) */
  frictionFactor: number;
  /** Superficial liquid velocity in ft/s */
  vsl: number;
  /** Superficial gas velocity in ft/s */
  vsg: number;
  /**
   * Elevation (hydrostatic) component of `pressureDrop`, psi for this segment.
   *
   * Optional only so hand-built fixtures stay valid; every shipped correlation populates
   * it. Together with `frictionPressureDrop` it reconstructs `pressureDrop` exactly --
   * these are the values the correlation actually used, not a fraction of the total.
   * Reporting a plausible-looking estimate here is what the 2026-08 audit removed.
   */
  elevationPressureDrop?: number;
  /** Friction component of `pressureDrop`, psi for this segment. See above. */
  frictionPressureDrop?: number;
  /**
   * Pressure (psia) at the segment outlet in the direction of the pressure march that
   * produced this result — i.e. the running pressure AFTER traversing the segment.
   * Surface→bottomhole trajectory marchers report the deeper-end pressure (increases
   * with depth); the standalone correlation call and the legacy bottomhole→surface
   * marcher return inlet−drop (decreases going up). Consumers wanting the aggregate
   * pump-discharge pressure must read TrajectoryResult.outletPressure / requiredPDP.
   */
  outletPressure: number;
  /**
   * Beggs-Brill's 1973 flow-pattern class, for display in the per-segment traverse table.
   *
   * 🚨 **Beggs-Brill only.** Every other correlation must leave this `undefined`, and
   * `bbFlowRegime.test.ts` asserts they do. This is not a revival of the deleted `flowRegime`
   * field: that one was written by all four, three of them from an undocumented 0.15/0.5/0.85
   * GVF ladder, so the same segment carried a different label per method. Gas content is
   * reported cross-method by `gvf` and `deriveGvfBand`; this field reports one correlation's
   * own pattern map and nothing else. Populating it from a ladder is the defect, not the field.
   *
   * `undefined` at both single-phase extremes even under Beggs-Brill. `determineFlowRegime`
   * maps lambda_L <= 0 and lambda_L >= 1 to 'distributed' to keep its boundary equations off a
   * zero base -- correct for coefficient selection, but as a printed label "Distributed" on a
   * gasless segment claims dispersed gas that is not there. Blanked at the assignment site so
   * the coefficient path keeps its value. Blanking the pattern does NOT blank the band: a
   * gasless segment is honestly `gvf = 0`, band 'low'.
   *
   * The four values are the map's umbrella classes, not sub-patterns. Slug and plug share
   * 'intermittent'; bubble, mist and froth share 'distributed'. The 1973 map does not resolve
   * further, so a UI must not print "Slug".
   */
  bbFlowRegime?: FlowRegime;
};

/**
 * Deviation survey station from imported file.
 * Represents a measurement point along the wellbore.
 */
export type SurveyStation = {
  /** Measured Depth in feet (along wellbore) */
  md: number;
  /** True Vertical Depth in feet (vertical distance from surface) */
  tvd: number;
  /** Inclination in degrees from vertical (0=vertical, 90=horizontal) */
  inclination: number;
  /** Azimuth in degrees from north (optional, for 3D trajectory) */
  azimuth?: number;
  /** Northing coordinate in feet */
  northing?: number;
  /** Easting coordinate in feet */
  easting?: number;
  /** Dogleg severity in degrees per 100 ft (calculated from adjacent stations) */
  dls?: number;
};

/**
 * Summary of dogleg severity analysis for a survey.
 */
export type DoglegSummary = {
  /** Maximum DLS in degrees/100ft */
  maxDLS: number;
  /** Average DLS in degrees/100ft */
  avgDLS: number;
  /** MD at maximum DLS */
  maxDLSDepth: number;
  /** Number of stations exceeding severe threshold (>10°/100ft) */
  severeCount: number;
  /** Number of stations exceeding critical threshold (>15°/100ft) */
  criticalCount: number;
};

/**
 * Well trajectory configuration.
 * Can be built from deviation survey or simple parameters.
 */
export type WellTrajectory = {
  /** Vertical section depth in feet TVD (surface to kick-off point) */
  verticalDepth: number;
  /** Kick-off depth in feet TVD */
  kickOffDepth: number;
  /** Build rate in degrees per 100 ft */
  buildRate: number;
  /** Landing depth in feet TVD (at heel) */
  landingDepth: number;
  /** Lateral length in feet MD */
  lateralLength: number;
  /** Total measured depth in feet */
  totalMD: number;
  /** Discretized pipe segments for calculation */
  segments: PipeSegment[];
};

/**
 * Temperature profile for non-isothermal calculations (V1.1).
 */
export type TemperatureProfile = {
  /** Surface temperature in °F */
  surfaceTemp: number;
  /** Bottomhole temperature in °F */
  bottomholeTemp: number;
  /** Temperature gradient in °F/ft (calculated from surface and BHT) */
  gradient: number;
};

/**
 * Liquid loading warning for critical velocity check (V1.1).
 */
export type LiquidLoadingWarning = {
  /** Segment index where warning applies */
  segmentIndex: number;
  /** Actual mixture velocity in ft/s */
  actualVelocity: number;
  /** Critical velocity threshold in ft/s */
  criticalVelocity: number;
  /** Risk level assessment */
  riskLevel: 'moderate' | 'high';
  /** Human-readable warning message */
  message: string;
};

/**
 * Complete trajectory pressure drop result.
 */
export type TrajectoryResult = {
  /** Total pressure drop from inlet to outlet in psi */
  totalPressureDrop: number;
  /** Results for each segment */
  segmentResults: MultiphaseResult[];
  /** Inlet pressure in psia */
  inletPressure: number;
  /** Outlet pressure in psia */
  outletPressure: number;
  /** Any liquid loading warnings (V1.1) */
  warnings?: LiquidLoadingWarning[];
  /** Traverse warnings for numerical corrections (pressure flooring) */
  traverseWarnings?: import('../../types/wellbore.js').TraverseWarning[];
};

// Re-export TraverseWarning from wellbore types for convenience
export type { TraverseWarning } from '../../types/wellbore.js';

/**
 * Section pressure drop breakdown for diagnostics.
 */
export type SectionPressureDrop = {
  /** Section length in feet */
  length: number;
  /** Pressure drop in psi */
  pressureDrop: number;
  /** Start MD in feet */
  startMD?: number;
  /** End MD in feet */
  endMD?: number;
};

/**
 * Pressure drop diagnostics for explaining correlation differences.
 */
export type PressureDropDiagnostics = {
  /** Vertical section (inclination > 75° from horizontal) */
  verticalSection: SectionPressureDrop;
  /** Build section (15° < inclination < 75° from horizontal) */
  buildSection: SectionPressureDrop;
  /** Lateral/horizontal section (inclination < 15° from horizontal) */
  lateralSection: SectionPressureDrop;
  /** Average liquid holdup across all segments */
  avgHoldup: number;
  /**
   * Mean in-situ GVF across segments that reported phase velocities, or null when none did.
   *
   * Null rather than 0 on purpose. A Hazen-Williams traverse carries vsl = vsg = 0 on every
   * segment, so a mean over all segments would report "0%" -- a computed-looking number from
   * a method that never computed a gas fraction. Gate display on `determinedSegments`.
   */
  avgGvf: number | null;
  /**
   * Highest in-situ GVF among determined segments, or null when none.
   *
   * The worst computed segment, which in a producing traverse is systematically the
   * lowest-pressure one, since gas expands as pressure falls. It is NOT GVF at pump intake
   * depth, which is the number that governs gas lock and which this aggregate does not expose.
   */
  maxGvf: number | null;
  /** How many counted segments fell in each band, including those with no velocities. */
  gvfBandCounts: Record<GvfBand, number>;
  /** Segments actually counted: min(segments.length, segmentResults.length). */
  segmentsCounted: number;
  /** Of those, how many reported phase velocities. The gate for showing any GVF figure. */
  determinedSegments: number;
  /** Total friction pressure drop in psi */
  frictionPressureDrop: number;
  /** Total elevation pressure drop in psi */
  elevationPressureDrop: number;
  /**
   * True when every segment supplied its own elevation/friction terms, so the totals above
   * are the correlation's own numbers. False means at least one segment did not, and the
   * totals are incomplete -- render them as unavailable rather than as a figure.
   */
  splitFromCorrelation: boolean;
  /** Warnings about correlation usage */
  warnings: string[];
};

/**
 * PVT validation warning severity levels.
 */
export type PVTWarningSeverity = 'info' | 'warning' | 'critical';

/**
 * PVT validation warning codes for specific conditions.
 */
export type PVTWarningCode =
  | 'PB_HIGH'        // Pb > 10,000 psia - unusually high
  | 'PB_VERY_HIGH'   // Pb > 15,000 psia - likely data issue
  | 'GOR_HIGH'       // GOR exceeds typical range for API
  | 'GVF_MODERATE'   // GVF 10-25% - moderate gas
  | 'GVF_HIGH'       // GVF > 25% - gas handling required
  | 'GVF_SEVERE'     // GVF > 50% - severe gas interference
  | 'TURPIN_HIGH'    // Turpin > 1.0 - pumping difficulties
  | 'UNDERSATURATED';// P > Pb - undersaturated conditions

/**
 * In-situ GVF thresholds, as fractions.
 *
 * Single source for the three GVF_* warning codes above and for the GvfBand severity axis in
 * multiphaseFlow/gvfBand.ts. Both compare with strict `>`, so a GVF sitting exactly on a
 * threshold belongs to the band below it.
 */
export const GVF_MODERATE_MIN = 0.1;
export const GVF_HIGH_MIN = 0.25;
export const GVF_SEVERE_MIN = 0.5;

/**
 * Share of GVF-determined segments that must sit in the severe band before the Hagedorn-Brown
 * divergence warning fires.
 *
 * Why a share and not the mean: the sweep that set GVF_SEVERE_MIN measured divergence at a
 * *local* GVF under fixed conditions. A whole-well mean is a different quantity, so testing it
 * against a locally-derived threshold tests something the sweep never measured. Observed
 * consequence on a real well (browning survey, 68 segments, 2026-08-12): 28 segments -- the
 * entire top 2,346 ft -- sat above GVF_SEVERE_MIN, Hagedorn-Brown returned 1,518 psi against
 * Beggs-Brill's 1,790 (15.2% lower), and the mean of 46.0% kept the warning silent. That is the
 * exact case the warning exists for.
 *
 * ⚠ 2026-08-13 -- THE 08-12 FIGURES ABOVE ARE NOT REPRODUCIBLE and are kept only as the
 * record of what this threshold was set against. They were measured ad-hoc, with nothing
 * committed to re-run. `src/validation/correlationDivergence.test.ts` now is that harness,
 * and fed what the app feeds its correlations -- the separator-credited effective GOR
 * (3,425 scf/stb) through buildTraverseFlowConditions, over the same 68 above-pump segments
 * -- Browning reads 16 of 68 severe (23.5%) with Hagedorn-Brown at 1,765 psi against
 * Beggs-Brill's 1,975, a 10.6% spread. Sweeping the GOR basis brackets the 08-12 numbers
 * between that and the full surface GOR (12,400 scf/stb -> every segment severe, spread
 * -41%), so the original run used an intermediate gas rate no current app path produces.
 *
 * The consequence is the opposite of what the paragraph above claims: on the well this
 * threshold was calibrated for, the share is 23.5% and 0.25 keeps the warning SILENT while
 * the two correlations still disagree by 10.6%. Whether to lower it, re-derive it from
 * full-well profiles, or accept the silence is an open engineering decision.
 *
 * Not caused by the Beggs-Brill Z-factor fix landed the same day: that moved Beggs-Brill
 * from 1,938 to 1,975 psi (+1.9%, widening the spread from 8.9%) and cannot move this
 * statistic at all, which is counted from the segments of whichever method is dispatched
 * and is only ever tested when that method is Hagedorn-Brown.
 *
 * Why not the peak: GVF rises monotonically toward surface as gas breaks out, so `maxGvf` clears
 * 50% on essentially any well with meaningful GOR. A warning that fires on nearly everything is
 * one users learn to skip, and the worst single segment says little about a *total* pressure drop
 * summed over the whole string.
 *
 * Why not weighted by pressure drop: the weights would come from the very correlation under
 * suspicion -- Hagedorn-Brown biases the gassy segments' contribution low, so the statistic
 * weakens itself precisely where the warning matters most.
 *
 * 0.25 is a materiality judgement, not a measurement, and it is the one such number here. To
 * replace it with a measured value, rerun the sweep as full-well profiles and find where the
 * spread in *total* pressure drop first exceeds 1.25x -- `correlationDivergence.test.ts` is
 * the place to put it, so the next person to question this number finds code rather than
 * prose. If the warning proves too chatty, recalibrate this share -- do not revert to the mean.
 *
 * Strict `>`, matching GVF_SEVERE_MIN and bandForGvf: a value sitting exactly on the threshold
 * belongs below it.
 */
export const DIVERGENT_SEGMENT_SHARE_MIN = 0.25;

/**
 * The two figures the divergence warning quotes about HOW FAR Hagedorn-Brown reads below its
 * peers: the shortfall against the median of the four, and the GVF by which that shortfall is
 * reached.
 *
 * Constants rather than literals in the message because a test that pins the measurement has to
 * bind to the same numbers the sentence prints. While these were inline in the template string,
 * the harness could stay green through an edit to the copy -- the exact drift that put two
 * earlier prose characterisations out of step with the code.
 *
 * MEASURED, not asserted. `correlationDivergence.test.ts` rebuilds the 18-combination local-GVF
 * sweep these come from -- 3 tubing IDs x 3 pressures x 2 water cuts -- and pins both. As of
 * 2026-08-16, post the Beggs-Brill Z-factor correction that moved one of the four by +1.9%:
 *
 *   - Hagedorn-Brown first reads 20% below the median of the four at GVF 40.5%-71.9% across the
 *     18 combinations, median crossing 59.4% -- which is what "around 60%" names.
 *   - Once crossed it stays crossed: the shortfall holds above 20% from the crossing all the way
 *     to the 95% GVF ceiling of the swept domain, in all 18.
 *   - Above GVF 0.5, where the warning can actually fire, Hagedorn-Brown is the lowest of the
 *     four at EVERY sample in all 18 combinations. Below it the ordering is not reliable, which
 *     is why the sentence says "typically" and not "always".
 *
 * Strict `>` is not used against these -- they are descriptive figures printed in a sentence,
 * not gates. `DIVERGENT_SEGMENT_SHARE_MIN` above is the gate.
 */
export const HB_MEDIAN_SHORTFALL_MIN = 0.2;
export const HB_MEDIAN_SHORTFALL_ONSET_GVF = 0.6;

/**
 * Severity band of in-situ gas volume fraction. The cross-method axis for reporting gas
 * content; see multiphaseFlow/gvfBand.ts for the derivation.
 *
 * 'undetermined' means no phase velocities were computed for the segment -- not that the
 * segment carries no gas. Keeping the two apart is why this is not a plain number.
 */
export type GvfBand = 'undetermined' | 'low' | 'moderate' | 'high' | 'severe';

/** Every band except the one that means "no phase velocities were computed". */
export type DeterminedGvfBand = Exclude<GvfBand, 'undetermined'>;

/**
 * Individual PVT validation warning.
 */
export type PVTWarning = {
  /** Warning code for programmatic handling */
  code: PVTWarningCode;
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
 * Bubble-point domain validity warning codes. Emitted once per fluid (they are
 * pressure-invariant) by `assessBubblePointDomain` in src/utils/pvt/pbValidity.ts.
 */
export type PbDomainWarningCode =
  | 'PB_GOR_ABOVE_BLACK_OIL'    // GOR above the black-oil/condensate divide
  | 'PB_RSB_ABOVE_CALIBRATION'  // Rsb past the correlation's published dataset ceiling
  | 'PB_NON_MONOTONIC_IN_GOR';  // Pb falls as GOR rises — the correlation has turned over

/**
 * One bubble-point domain validity warning. Deliberately NOT a `PVTWarning`:
 * that shape would force fabricating severity/value/threshold and would widen
 * the shared `PVTWarningCode` union.
 */
export type PbDomainWarning = {
  /** Warning code for programmatic handling */
  code: PbDomainWarningCode;
  /** Human-readable, engineer-facing explanation — one sentence */
  message: string;
};

/**
 * PVT calculation result with optional validation warnings.
 */
export type PVTResult<T> = {
  /** The calculated value(s) */
  value: T;
  /** Any validation warnings generated */
  warnings: PVTWarning[];
};

/**
 * Typical GOR ranges by API gravity for validation.
 * Based on empirical data from various oil provinces.
 */
export const TYPICAL_GOR_RANGES: Record<string, { min: number; max: number; typical: number }> = {
  'heavy': { min: 0, max: 200, typical: 50 },       // API < 22
  'medium': { min: 100, max: 800, typical: 350 },   // API 22-31
  'light': { min: 300, max: 1500, typical: 700 },   // API 31-40
  'condensate': { min: 1000, max: 5000, typical: 2500 }, // API > 40
};

/**
 * Well segment for multi-section completion modeling.
 * Represents a section of pipe (tubing, secondary tubing, or casing)
 * with uniform properties. Segments are ordered from surface to bottomhole.
 */
export type WellSegment = {
  /** Segment length in feet (NOT cumulative MD) */
  md: number;
  /** Inner diameter in inches */
  id: number;
  /** Absolute roughness in feet (default 0.0006 for commercial steel) */
  roughness: number;
  /** Semantic segment type for color/label assignment in plots */
  segmentType?: 'primary' | 'secondary' | 'casing';
};

/**
 * Geometry at a specific measured depth along the wellbore.
 * Combines survey-derived trajectory data with pipe properties.
 */
export type GeometryAtMD = {
  /** Measured depth in feet */
  md: number;
  /** True vertical depth in feet */
  tvd: number;
  /** Inclination in degrees from vertical (survey convention: 0=vertical, 90=horizontal) */
  inclination: number;
  /** Inner diameter in inches */
  id: number;
  /** Absolute roughness in feet */
  roughness: number;
};

/**
 * Beggs-Brill intermediate calculation values.
 * Useful for debugging and validation.
 */
export type BeggsBrillIntermediates = {
  /** Froude number */
  NFR: number;
  /** Input liquid content (no-slip holdup) */
  lambdaL: number;
  /** Liquid velocity number */
  NLV: number;
  /** Gas velocity number */
  NGV: number;
  /** Horizontal liquid holdup HL(0) */
  holdupHorizontal: number;
  /** Inclination correction factor ψ */
  inclinationCorrection: number;
  /** Mixture density in lb/ft³ */
  mixtureDensity: number;
  /** Flow regime boundary values L1, L2, L3, L4 */
  boundaries: {
    L1: number;
    L2: number;
    L3: number;
    L4: number;
  };
};

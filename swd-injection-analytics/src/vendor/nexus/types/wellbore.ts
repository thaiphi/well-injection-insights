export type ZFactorCalculation = {
  // Critical Properties
  Pc: number;                 // Pseudo-critical pressure (psia)
  Tc: number;                 // Pseudo-critical temperature (°R)

  // Reduced Properties
  Pr: number;                 // Reduced pressure (dimensionless)
  Tr: number;                 // Reduced temperature (dimensionless)

  // Dranchuk-Abou-Kassem Coefficients
  A: number;                  // Coefficient A
  B: number;                  // Coefficient B
  C: number;                  // Coefficient C
  D: number;                  // Coefficient D

  // Result
  Z: number;                  // Compressibility factor
};

export type TraverseWarning = {
  type: 'pressure-floor' | 'negative-pressure';
  segmentIndex: number;
  startDepthTVD: number;
  endDepthTVD: number;
  originalPressure: number;
  flooredPressure: number;
  message: string;
};

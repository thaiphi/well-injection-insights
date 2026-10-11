/**
 * PVT Type Definitions
 *
 * Shared types for PVT correlations and validation.
 * Re-exported from multiphaseFlow/types.ts for backward compatibility.
 */

export type {
  PVTProperties,
  PVTConfig,
  PVTWarning,
  PVTWarningCode,
  PVTWarningSeverity,
  PbDomainWarning,
  PbDomainWarningCode,
  PbCorrelation,
  RsCorrelation,
  BoCorrelation,
  ZCorrelation,
  ViscosityCorrelation,
} from '../multiphaseFlow/types.js';

export { TYPICAL_GOR_RANGES } from '../multiphaseFlow/types.js';
export { GVF_MODERATE_MIN, GVF_HIGH_MIN, GVF_SEVERE_MIN } from '../multiphaseFlow/types.js';

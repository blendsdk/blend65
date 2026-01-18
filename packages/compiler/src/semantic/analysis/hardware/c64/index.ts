/**
 * C64 Hardware Analysis Module
 *
 * Exports C64-specific hardware analysis components.
 *
 * **Components:**
 * - C64HardwareAnalyzer: Main analyzer for C64-specific hardware validation
 * - C64 Zero-Page: Zero-page validation utilities for C64 memory map
 * - VIC-II Timing: Raster timing and cycle estimation (Tier 4)
 */

export { C64HardwareAnalyzer } from './c64-hardware-analyzer.js';

// Zero-page types and utilities
export {
  // Zero-page types
  C64ZeroPageCategory,
  type ZeroPageLocationInfo,
  type C64ZeroPageValidationResult,
  // Zero-page utilities
  getC64ZeroPageCategory,
  getC64CategoryDescription,
  isC64ZeroPageSafe,
  validateC64ZeroPageAllocation,
  getC64ZeroPageInfo,
  getC64AvailableZeroPageBytes,
  getC64SafeZeroPageRange,
  suggestC64ZeroPageAllocation,
  // Constants
  C64_ZERO_PAGE_DETAILS,
} from './c64-zero-page.js';

// VIC-II timing analysis (Tier 4)
export {
  // Main analyzer class
  VICIITimingAnalyzer,
  // Types
  type VICIITimingConstants,
  type CycleEstimate,
  type CycleBreakdown,
  type LoopCycleEstimate,
  type HardwarePenalties,
  type RasterSafetyResult,
  type RasterSafetyMetadata,
  type BadlineInfo,
  type VICIITimingWarning,
  // Enums
  BadlineRecommendation,
  // Constants
  CYCLE_ESTIMATES,
  HARDWARE_PENALTIES,
  DEFAULT_LOOP_ITERATIONS,
  // Utility functions
  createVICIITimingAnalyzer,
  calculateCyclesPerFrame,
  fitsInRasterLine,
} from './vic-ii-timing.js';

// SID conflict analysis (Tier 4)
export {
  // Main analyzer class
  SIDConflictAnalyzer,
  // Types
  type SIDVoiceNumber,
  type SIDRegisterInfo,
  type VoiceUsage,
  type VoiceConflict,
  type FilterUsage,
  type FilterConflict,
  type VolumeConflict,
  type SIDAnalysisResult,
  type SIDTimingRequirements,
  // Enums
  SIDRegisterType,
  SIDFilterMode,
  // Constants
  SID_BASE,
  SID_VOICE_OFFSET,
  SID_REGISTERS,
  SID_ADDRESS_RANGE,
  // Utility functions
  getVoiceForAddress,
  isSIDAddress,
  isSIDVoiceRegister,
  isSIDFilterRegister,
  isSIDVolumeRegister,
  getSIDRegisterInfo,
  getFilteredVoices,
  getFilterMode,
  getVolume,
} from './sid-conflicts.js';
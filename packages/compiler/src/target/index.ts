/**
 * Target Architecture Module
 *
 * Provides multi-target support for the Blend65 compiler.
 *
 * @module target
 */

// Architecture Types
export {
  TargetArchitecture,
  CPUType,
  isTargetImplemented,
  isCPUImplemented,
  getTargetDisplayName,
  getCPUDisplayName,
  parseTargetArchitecture,
  getDefaultTarget,
  getDefaultCPU,
} from './architecture.js';

// Configuration Types
export type {
  ReservedZeroPageRange,
  ZeroPageConfig,
  GraphicsChipConfig,
  SoundChipConfig,
  MemoryRegion,
  TargetConfig,
} from './config.js';

export {
  validateTargetConfig,
  isAddressReserved,
  getReservationReason,
  isAddressSafe,
  doesAllocationFit,
} from './config.js';

// Registry Functions
export {
  UnknownTargetError,
  TargetNotImplementedError,
  getTargetConfig,
  getTargetConfigFromString,
  getDefaultTargetConfig,
  getRegisteredTargets,
  getImplementedTargets,
  isTargetRegistered,
  validateAllTargetConfigs,
  getC64TargetConfig,
  formatTargetConfig,
} from './registry.js';

// Target Configurations (Direct Access)
export { C64_CONFIG, C64_NTSC_CONFIG, getC64Config } from './configs/c64.js';
export { C128_CONFIG, C128NotImplementedError } from './configs/c128.js';
export { X16_CONFIG, X16NotImplementedError } from './configs/x16.js';

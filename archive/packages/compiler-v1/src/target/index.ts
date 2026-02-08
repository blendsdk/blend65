/**
 * Target Architecture Module
 *
 * Provides multi-target support for the Blend65 compiler.
 * This module allows the compiler to generate optimized code for
 * different 6502-based machines (C64, C128, X16, etc.).
 *
 * **Primary Export Groups:**
 * - Architecture: Target and CPU type enums
 * - Config: Configuration interfaces and utilities
 * - Registry: Factory functions to get configurations
 *
 * **Usage:**
 * ```typescript
 * import {
 *   TargetArchitecture,
 *   getTargetConfig,
 *   getDefaultTargetConfig,
 * } from './target/index.js';
 *
 * // Get default (C64) configuration
 * const config = getDefaultTargetConfig();
 *
 * // Or specify a target
 * const c64Config = getTargetConfig(TargetArchitecture.C64);
 *
 * // Parse from CLI string
 * const config = getTargetConfigFromString('c64');
 * ```
 *
 * **Adding New Targets:**
 * 1. Add enum value to TargetArchitecture
 * 2. Create configs/[target].ts with configuration
 * 3. Register in registry.ts
 * 4. Export from this file
 */

// ============================================
// Architecture Types
// ============================================

export {
  // Enums
  TargetArchitecture,
  CPUType,
  // Utility functions
  isTargetImplemented,
  isCPUImplemented,
  getTargetDisplayName,
  getCPUDisplayName,
  parseTargetArchitecture,
  getDefaultTarget,
  getDefaultCPU,
} from './architecture.js';

// ============================================
// Configuration Types
// ============================================

export type {
  // Interfaces
  ReservedZeroPageRange,
  ZeroPageConfig,
  GraphicsChipConfig,
  SoundChipConfig,
  MemoryRegion,
  TargetConfig,
} from './config.js';

export {
  // Utility functions
  validateTargetConfig,
  isAddressReserved,
  getReservationReason,
  isAddressSafe,
  doesAllocationFit,
} from './config.js';

// ============================================
// Registry Functions
// ============================================

export {
  // Error classes
  UnknownTargetError,
  TargetNotImplementedError,
  // Main registry functions
  getTargetConfig,
  getTargetConfigFromString,
  getDefaultTargetConfig,
  // Query functions
  getRegisteredTargets,
  getImplementedTargets,
  isTargetRegistered,
  // Validation
  validateAllTargetConfigs,
  // C64-specific
  getC64TargetConfig,
  // Formatting
  formatTargetConfig,
} from './registry.js';

// ============================================
// Target Configurations (Direct Access)
// ============================================

// C64 Configuration (fully implemented)
export { C64_CONFIG, C64_NTSC_CONFIG, getC64Config } from './configs/c64.js';

// C128 Configuration (placeholder)
export { C128_CONFIG, C128NotImplementedError } from './configs/c128.js';

// X16 Configuration (placeholder)
export { X16_CONFIG, X16NotImplementedError } from './configs/x16.js';
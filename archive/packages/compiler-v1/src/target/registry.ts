/**
 * Target Registry
 *
 * Factory and registry for target configurations. This is the main
 * entry point for obtaining target-specific configurations throughout
 * the compiler.
 *
 * **Usage:**
 * ```typescript
 * import { getTargetConfig, TargetArchitecture } from './target/index.js';
 *
 * // Get C64 configuration (default)
 * const config = getTargetConfig(TargetArchitecture.C64);
 *
 * // Or parse from CLI argument
 * const config = getTargetConfigFromString('c64');
 * ```
 *
 * **Adding New Targets:**
 * 1. Create config file in `configs/[target].ts`
 * 2. Import and register in this file
 * 3. Update the switch statements in getter functions
 */

import {
  TargetArchitecture,
  isTargetImplemented,
  parseTargetArchitecture,
  getDefaultTarget,
  getTargetDisplayName,
} from './architecture.js';
import type { TargetConfig } from './config.js';
import { validateTargetConfig } from './config.js';
import { C64_CONFIG, getC64Config } from './configs/c64.js';
import { C128_CONFIG } from './configs/c128.js';
import { X16_CONFIG } from './configs/x16.js';

/**
 * Error thrown when an unknown target is requested
 */
export class UnknownTargetError extends Error {
  constructor(target: string) {
    super(
      `Unknown target architecture: '${target}'. ` +
        `Valid targets are: c64, c128, x16, generic`
    );
    this.name = 'UnknownTargetError';
  }
}

/**
 * Error thrown when an unimplemented target is requested
 */
export class TargetNotImplementedError extends Error {
  constructor(target: TargetArchitecture) {
    const displayName = getTargetDisplayName(target);
    super(
      `Target '${displayName}' (${target}) is not yet implemented. ` +
        `Currently only 'c64' is fully supported.`
    );
    this.name = 'TargetNotImplementedError';
  }
}

/**
 * Target configuration registry
 *
 * Maps target architectures to their configurations.
 * This is populated on module load.
 */
const TARGET_CONFIGS: Map<TargetArchitecture, TargetConfig> = new Map([
  [TargetArchitecture.C64, C64_CONFIG],
  [TargetArchitecture.C128, C128_CONFIG],
  [TargetArchitecture.X16, X16_CONFIG],
]);

/**
 * Get target configuration for an architecture
 *
 * This is the primary way to obtain a target configuration.
 * It validates that the target exists and is implemented.
 *
 * @param target - Target architecture to get configuration for
 * @param allowUnimplemented - If true, returns config even if target is not implemented
 * @returns Target configuration
 * @throws {TargetNotImplementedError} If target is not implemented and allowUnimplemented is false
 *
 * @example
 * ```typescript
 * // Normal usage - throws if target not implemented
 * const config = getTargetConfig(TargetArchitecture.C64);
 *
 * // Allow unimplemented targets (for testing/documentation)
 * const config = getTargetConfig(TargetArchitecture.C128, true);
 * ```
 */
export function getTargetConfig(
  target: TargetArchitecture,
  allowUnimplemented: boolean = false
): TargetConfig {
  const config = TARGET_CONFIGS.get(target);

  if (!config) {
    throw new UnknownTargetError(target);
  }

  // Check if target is implemented
  if (!allowUnimplemented && !config.implemented) {
    throw new TargetNotImplementedError(target);
  }

  return config;
}

/**
 * Get target configuration from a string
 *
 * Parses a string (e.g., from CLI argument) and returns
 * the corresponding configuration.
 *
 * @param targetString - String representing the target (e.g., 'c64', 'C64')
 * @param allowUnimplemented - If true, returns config even if target is not implemented
 * @returns Target configuration
 * @throws {UnknownTargetError} If string doesn't match any target
 * @throws {TargetNotImplementedError} If target is not implemented
 *
 * @example
 * ```typescript
 * // From CLI argument
 * const target = process.argv.find(a => a.startsWith('--target='));
 * const config = getTargetConfigFromString(target?.split('=')[1] || 'c64');
 * ```
 */
export function getTargetConfigFromString(
  targetString: string,
  allowUnimplemented: boolean = false
): TargetConfig {
  const target = parseTargetArchitecture(targetString);

  if (target === null) {
    throw new UnknownTargetError(targetString);
  }

  return getTargetConfig(target, allowUnimplemented);
}

/**
 * Get the default target configuration (C64)
 *
 * Convenience function that returns the C64 configuration,
 * which is the default and primary target.
 *
 * @returns C64 target configuration
 *
 * @example
 * ```typescript
 * // When no target is specified, use default
 * const config = getDefaultTargetConfig();
 * ```
 */
export function getDefaultTargetConfig(): TargetConfig {
  return getTargetConfig(getDefaultTarget());
}

/**
 * Get all registered targets
 *
 * Returns a list of all target architectures that have
 * configurations registered (both implemented and unimplemented).
 *
 * @returns Array of registered target architectures
 */
export function getRegisteredTargets(): TargetArchitecture[] {
  return Array.from(TARGET_CONFIGS.keys());
}

/**
 * Get all implemented targets
 *
 * Returns only targets that are fully implemented and
 * can be used for compilation.
 *
 * @returns Array of implemented target architectures
 */
export function getImplementedTargets(): TargetArchitecture[] {
  return getRegisteredTargets().filter((target) => isTargetImplemented(target));
}

/**
 * Check if a target is registered
 *
 * @param target - Target architecture to check
 * @returns True if target has a configuration registered
 */
export function isTargetRegistered(target: TargetArchitecture): boolean {
  return TARGET_CONFIGS.has(target);
}

/**
 * Validate all registered target configurations
 *
 * Runs validation on all registered configurations.
 * Useful for testing and CI to catch configuration errors.
 *
 * @returns Map of target to validation errors (empty array if valid)
 *
 * @example
 * ```typescript
 * const results = validateAllTargetConfigs();
 * for (const [target, errors] of results) {
 *   if (errors.length > 0) {
 *     console.error(`${target} has errors:`, errors);
 *   }
 * }
 * ```
 */
export function validateAllTargetConfigs(): Map<TargetArchitecture, string[]> {
  const results = new Map<TargetArchitecture, string[]>();

  for (const [target, config] of TARGET_CONFIGS) {
    const errors = validateTargetConfig(config);
    results.set(target, errors);
  }

  return results;
}

/**
 * Get C64 configuration with PAL/NTSC option
 *
 * Convenience function for getting C64 config with
 * timing variant selection.
 *
 * @param ntsc - True for NTSC timing, false for PAL (default)
 * @returns C64 target configuration
 *
 * @example
 * ```typescript
 * const palConfig = getC64TargetConfig(false);  // PAL (European)
 * const ntscConfig = getC64TargetConfig(true);  // NTSC (American)
 * ```
 */
export function getC64TargetConfig(ntsc: boolean = false): TargetConfig {
  return getC64Config(ntsc);
}

/**
 * Format target configuration as human-readable string
 *
 * Useful for debugging and logging.
 *
 * @param config - Target configuration to format
 * @returns Formatted string description
 */
export function formatTargetConfig(config: TargetConfig): string {
  const lines: string[] = [
    `Target: ${getTargetDisplayName(config.architecture)} (${config.architecture})`,
    `CPU: ${config.cpu}`,
    `Clock: ${config.clockSpeedMHz} MHz`,
    `Memory: ${config.totalMemory / 1024}K`,
    `Zero-Page:`,
    `  Safe range: $${config.zeroPage.safeRange.start.toString(16).padStart(2, '0').toUpperCase()}-$${config.zeroPage.safeRange.end.toString(16).padStart(2, '0').toUpperCase()} (${config.zeroPage.usableBytes} bytes)`,
    `  Reserved ranges:`,
  ];

  for (const range of config.zeroPage.reservedRanges) {
    lines.push(
      `    $${range.start.toString(16).padStart(2, '0').toUpperCase()}-$${range.end.toString(16).padStart(2, '0').toUpperCase()}: ${range.reason}`
    );
  }

  if (config.graphicsChip) {
    lines.push(
      `Graphics: ${config.graphicsChip.name} at $${config.graphicsChip.baseAddress.toString(16).toUpperCase()}`
    );
  }

  if (config.soundChip) {
    lines.push(
      `Sound: ${config.soundChip.name} at $${config.soundChip.baseAddress.toString(16).toUpperCase()} (${config.soundChip.voices} voices)`
    );
  }

  lines.push(`Implemented: ${config.implemented ? 'Yes' : 'No'}`);

  return lines.join('\n');
}
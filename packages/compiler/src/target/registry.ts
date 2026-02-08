/**
 * Target Registry
 *
 * Factory and registry for target configurations. This is the main
 * entry point for obtaining target-specific configurations throughout
 * the compiler.
 *
 * @module target/registry
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
        `Valid targets are: c64, c128, x16, generic`,
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
        `Currently only 'c64' is fully supported.`,
    );
    this.name = 'TargetNotImplementedError';
  }
}

/**
 * Target configuration registry
 *
 * Maps target architectures to their configurations.
 */
const TARGET_CONFIGS: Map<TargetArchitecture, TargetConfig> = new Map([
  [TargetArchitecture.C64, C64_CONFIG],
  [TargetArchitecture.C128, C128_CONFIG],
  [TargetArchitecture.X16, X16_CONFIG],
]);

/**
 * Get target configuration for an architecture
 *
 * @param target - Target architecture to get configuration for
 * @param allowUnimplemented - If true, returns config even if target is not implemented
 * @returns Target configuration
 * @throws {TargetNotImplementedError} If target is not implemented and allowUnimplemented is false
 */
export function getTargetConfig(
  target: TargetArchitecture,
  allowUnimplemented: boolean = false,
): TargetConfig {
  const config = TARGET_CONFIGS.get(target);

  if (!config) {
    throw new UnknownTargetError(target);
  }

  if (!allowUnimplemented && !config.implemented) {
    throw new TargetNotImplementedError(target);
  }

  return config;
}

/**
 * Get target configuration from a string
 *
 * @param targetString - String representing the target (e.g., 'c64')
 * @param allowUnimplemented - If true, returns config even if target is not implemented
 * @returns Target configuration
 */
export function getTargetConfigFromString(
  targetString: string,
  allowUnimplemented: boolean = false,
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
 * @returns C64 target configuration
 */
export function getDefaultTargetConfig(): TargetConfig {
  return getTargetConfig(getDefaultTarget());
}

/**
 * Get all registered targets
 *
 * @returns Array of registered target architectures
 */
export function getRegisteredTargets(): TargetArchitecture[] {
  return Array.from(TARGET_CONFIGS.keys());
}

/**
 * Get all implemented targets
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
 * @returns Map of target to validation errors (empty array if valid)
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
 * @param ntsc - True for NTSC timing, false for PAL (default)
 * @returns C64 target configuration
 */
export function getC64TargetConfig(ntsc: boolean = false): TargetConfig {
  return getC64Config(ntsc);
}

/**
 * Format target configuration as human-readable string
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
      `    $${range.start.toString(16).padStart(2, '0').toUpperCase()}-$${range.end.toString(16).padStart(2, '0').toUpperCase()}: ${range.reason}`,
    );
  }

  if (config.graphicsChip) {
    lines.push(
      `Graphics: ${config.graphicsChip.name} at $${config.graphicsChip.baseAddress.toString(16).toUpperCase()}`,
    );
  }

  if (config.soundChip) {
    lines.push(
      `Sound: ${config.soundChip.name} at $${config.soundChip.baseAddress.toString(16).toUpperCase()} (${config.soundChip.voices} voices)`,
    );
  }

  lines.push(`Implemented: ${config.implemented ? 'Yes' : 'No'}`);

  return lines.join('\n');
}

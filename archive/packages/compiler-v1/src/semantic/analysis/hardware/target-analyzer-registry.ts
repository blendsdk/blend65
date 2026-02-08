/**
 * Target Analyzer Registry
 *
 * Factory for creating target-specific hardware analyzers.
 * This is the main entry point for obtaining the correct analyzer
 * for a given target architecture.
 *
 * **Usage:**
 * ```typescript
 * import { getHardwareAnalyzer } from './hardware/index.js';
 * import { TargetArchitecture } from '../../../target/index.js';
 *
 * const analyzer = getHardwareAnalyzer(
 *   TargetArchitecture.C64,
 *   symbolTable,
 *   cfgs
 * );
 *
 * const result = analyzer.analyze(ast);
 * ```
 *
 * **Adding New Targets:**
 * 1. Create analyzer class extending BaseHardwareAnalyzer
 * 2. Import and add to switch statement in createHardwareAnalyzer()
 * 3. Export from index.ts
 */

import type { SymbolTable } from '../../symbol-table.js';
import type { ControlFlowGraph } from '../../control-flow.js';
import type { BaseHardwareAnalyzer } from './base-hardware-analyzer.js';
import { TargetArchitecture, getTargetConfig, getTargetDisplayName } from '../../../target/index.js';
import type { TargetConfig } from '../../../target/config.js';

// Import concrete analyzer implementations
import { C64HardwareAnalyzer } from './c64/c64-hardware-analyzer.js';
import { C128HardwareAnalyzer } from './c128/c128-hardware-analyzer.js';
import { X16HardwareAnalyzer } from './x16/x16-hardware-analyzer.js';

/**
 * Error thrown when no analyzer is available for a target
 */
export class NoAnalyzerForTargetError extends Error {
  constructor(target: TargetArchitecture) {
    super(
      `No hardware analyzer available for target '${getTargetDisplayName(target)}' (${target}). ` +
        `This target may not be fully implemented.`
    );
    this.name = 'NoAnalyzerForTargetError';
  }
}

/**
 * Create a hardware analyzer for the specified target
 *
 * This is the main factory function. It creates the appropriate
 * hardware analyzer based on the target architecture.
 *
 * @param target - Target architecture
 * @param symbolTable - Symbol table from semantic analysis
 * @param cfgs - Control flow graphs
 * @returns Hardware analyzer for the target
 * @throws {NoAnalyzerForTargetError} If no analyzer is available
 *
 * @example
 * ```typescript
 * const analyzer = createHardwareAnalyzer(
 *   TargetArchitecture.C64,
 *   symbolTable,
 *   cfgs
 * );
 *
 * const result = analyzer.analyze(ast);
 * if (!result.success) {
 *   console.log('Hardware analysis errors:', result.diagnostics);
 * }
 * ```
 */
export function createHardwareAnalyzer(
  target: TargetArchitecture,
  symbolTable: SymbolTable,
  cfgs: Map<string, ControlFlowGraph>
): BaseHardwareAnalyzer {
  // Get target configuration
  // Note: allowUnimplemented=true because we handle that in the switch
  const config = getTargetConfig(target, true);

  // Create the appropriate analyzer
  switch (target) {
    case TargetArchitecture.C64:
      return new C64HardwareAnalyzer(config, symbolTable, cfgs);

    case TargetArchitecture.C128:
      return new C128HardwareAnalyzer(config, symbolTable, cfgs);

    case TargetArchitecture.X16:
      return new X16HardwareAnalyzer(config, symbolTable, cfgs);

    case TargetArchitecture.Generic:
      // Generic target has no hardware-specific analysis
      // Return a minimal analyzer that just passes through
      throw new NoAnalyzerForTargetError(target);

    default:
      throw new NoAnalyzerForTargetError(target);
  }
}

/**
 * Create a hardware analyzer from target configuration
 *
 * Alternative factory function that takes a TargetConfig directly.
 * Useful when you already have the config from elsewhere.
 *
 * @param config - Target configuration
 * @param symbolTable - Symbol table from semantic analysis
 * @param cfgs - Control flow graphs
 * @returns Hardware analyzer for the target
 * @throws {NoAnalyzerForTargetError} If no analyzer is available
 */
export function createHardwareAnalyzerFromConfig(
  config: TargetConfig,
  symbolTable: SymbolTable,
  cfgs: Map<string, ControlFlowGraph>
): BaseHardwareAnalyzer {
  return createHardwareAnalyzer(config.architecture, symbolTable, cfgs);
}

/**
 * Get hardware analyzer for the default target (C64)
 *
 * Convenience function that returns the C64 analyzer.
 *
 * @param symbolTable - Symbol table from semantic analysis
 * @param cfgs - Control flow graphs
 * @returns C64 hardware analyzer
 */
export function getDefaultHardwareAnalyzer(
  symbolTable: SymbolTable,
  cfgs: Map<string, ControlFlowGraph>
): BaseHardwareAnalyzer {
  return createHardwareAnalyzer(TargetArchitecture.C64, symbolTable, cfgs);
}

/**
 * Check if a hardware analyzer is available for a target
 *
 * @param target - Target architecture to check
 * @returns True if an analyzer is available
 */
export function isHardwareAnalyzerAvailable(target: TargetArchitecture): boolean {
  switch (target) {
    case TargetArchitecture.C64:
    case TargetArchitecture.C128:
    case TargetArchitecture.X16:
      return true;
    case TargetArchitecture.Generic:
      return false;
    default:
      return false;
  }
}

/**
 * Get list of targets that have hardware analyzers
 *
 * @returns Array of target architectures with analyzers
 */
export function getTargetsWithAnalyzers(): TargetArchitecture[] {
  return [
    TargetArchitecture.C64,
    TargetArchitecture.C128,
    TargetArchitecture.X16,
  ];
}

/**
 * Alias for createHardwareAnalyzer
 *
 * Shorter name for convenience.
 */
export const getHardwareAnalyzer = createHardwareAnalyzer;
/**
 * CPU Instruction Set Module
 *
 * Provides the CPU target abstraction layer for the code generator.
 * Uses the Strategy Pattern to encapsulate instruction-level differences
 * between CPU variants (MOS 6502, WDC 65C02).
 *
 * **Usage:**
 * ```typescript
 * import { createCpuInstructionSet, CpuTarget } from './cpu/index.js';
 *
 * const cpu = createCpuInstructionSet('65c02');
 * cpu.emitStoreZero(asm, 0xD020, false); // Emits STZ $D020
 * ```
 *
 * @module codegen/cpu
 */

import { CpuInstructionSet } from './cpu-instruction-set.js';
import { Cpu6502InstructionSet } from './cpu-6502.js';
import { Cpu65C02InstructionSet } from './cpu-65c02.js';
import type { CpuTarget } from './types.js';

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a CpuInstructionSet for the given CPU target.
 *
 * This is the primary entry point for obtaining CPU-specific
 * instruction emission strategies. The code generator base class
 * calls this once during construction and stores the result.
 *
 * @param target - The CPU target to create an instruction set for
 * @returns A CpuInstructionSet implementation for the target
 * @throws Error if the target is not recognized
 *
 * @example
 * ```typescript
 * // For Commodore 64 (MOS 6502)
 * const cpu = createCpuInstructionSet('6502');
 *
 * // For Commander X16 (WDC 65C02)
 * const cpu = createCpuInstructionSet('65c02');
 * ```
 */
export function createCpuInstructionSet(target: CpuTarget): CpuInstructionSet {
  switch (target) {
    case '6502':
      return new Cpu6502InstructionSet();
    case '65c02':
      return new Cpu65C02InstructionSet();
    default:
      // Exhaustive check — TypeScript will flag if a CpuTarget variant is unhandled
      throw new Error(`Unknown CPU target: ${target as string}`);
  }
}

// ============================================================================
// Re-exports
// ============================================================================

// Types
export type { CpuTarget } from './types.js';
export { DEFAULT_CPU_TARGET } from './types.js';

// Abstract base class
export { CpuInstructionSet } from './cpu-instruction-set.js';

// Concrete implementations
export { Cpu6502InstructionSet } from './cpu-6502.js';
export { Cpu65C02InstructionSet } from './cpu-65c02.js';

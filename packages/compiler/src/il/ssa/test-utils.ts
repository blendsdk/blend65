/**
 * SSA Test Utilities
 *
 * Reusable helper functions for testing SSA construction and verifying SSA invariants.
 * These utilities support the SSA ID Collision regression tests and can be used
 * by other SSA-related tests.
 *
 * @module il/ssa/test-utils
 */

import type { ILFunction } from '../function.js';
import { ILOpcode } from '../instructions.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of register ID uniqueness verification.
 *
 * This structure provides detailed information about any uniqueness violations,
 * including which registers are duplicated and where they occur.
 */
export interface RegisterIdVerification {
  /**
   * Whether all IDs are globally unique across the function.
   * true = all register IDs are unique (SSA invariant holds)
   * false = duplicate register IDs found (SSA violation)
   */
  unique: boolean;

  /**
   * List of register IDs that were defined multiple times.
   * Empty if unique is true.
   */
  duplicates: number[];

  /**
   * Total number of result registers checked across all blocks.
   */
  totalChecked: number;

  /**
   * Detailed information about each duplicate, including locations.
   * Useful for debugging and error reporting.
   */
  details: Array<{
    /** The duplicate register ID */
    id: number;
    /** Location of the first definition */
    firstLocation: { blockId: number; instructionId: number };
    /** Location of the duplicate definition */
    secondLocation: { blockId: number; instructionId: number };
  }>;
}

/**
 * Statistics collected from an IL function.
 */
export interface FunctionStats {
  /** Number of basic blocks in the function */
  blockCount: number;
  /** Total number of instructions across all blocks */
  instructionCount: number;
  /** Number of phi instructions */
  phiCount: number;
  /** Number of unique result registers */
  resultRegisterCount: number;
}

// =============================================================================
// Register ID Verification Functions
// =============================================================================

/**
 * Verifies that all register IDs in a function are globally unique.
 *
 * This is the primary verification function for catching "Local-to-Global ID Mismatch"
 * bugs where per-entity counters (like SSA versions) are incorrectly used as global IDs.
 *
 * The bug this catches: Using SSA version numbers (which are per-variable) as
 * VirtualRegister IDs (which must be globally unique). For example, `a.0` and `b.0`
 * both have version 0, but their registers must have different IDs.
 *
 * @param func - The IL function to verify
 * @returns Verification result with details about any duplicates found
 *
 * @example
 * ```typescript
 * const func = createTestFunction();
 * constructSSA(func, { skipVerification: false });
 *
 * const result = verifyRegisterIdUniqueness(func);
 * if (!result.unique) {
 *   console.error(`Duplicate IDs found: ${result.duplicates.join(', ')}`);
 *   for (const detail of result.details) {
 *     console.error(`  ID ${detail.id}: first at block ${detail.firstLocation.blockId}, ` +
 *                   `again at block ${detail.secondLocation.blockId}`);
 *   }
 * }
 * ```
 */
export function verifyRegisterIdUniqueness(func: ILFunction): RegisterIdVerification {
  // Track seen register IDs and their definition locations
  const seen = new Map<number, { blockId: number; instructionId: number }>();
  const duplicates: number[] = [];
  const details: RegisterIdVerification['details'] = [];
  let totalChecked = 0;

  // Iterate through all blocks and instructions
  for (const block of func.getBlocks()) {
    for (const instruction of block.getInstructions()) {
      // Check result register if present
      if (instruction.result) {
        totalChecked++;
        const existing = seen.get(instruction.result.id);

        if (existing) {
          // Duplicate found - this is an SSA violation
          duplicates.push(instruction.result.id);
          details.push({
            id: instruction.result.id,
            firstLocation: existing,
            secondLocation: { blockId: block.id, instructionId: instruction.id },
          });
        } else {
          // First occurrence - record location
          seen.set(instruction.result.id, { blockId: block.id, instructionId: instruction.id });
        }
      }
    }
  }

  return {
    unique: duplicates.length === 0,
    duplicates: [...new Set(duplicates)], // Deduplicate the duplicates list
    totalChecked,
    details,
  };
}

/**
 * Collects all result register IDs from a function.
 *
 * Returns IDs from both regular instructions and phi instruction results.
 * Does not include phi source operands (those reference existing registers).
 *
 * @param func - The IL function to collect from
 * @returns Array of all result register IDs
 */
export function collectAllResultRegisterIds(func: ILFunction): number[] {
  const ids: number[] = [];

  for (const block of func.getBlocks()) {
    for (const instruction of block.getInstructions()) {
      if (instruction.result) {
        ids.push(instruction.result.id);
      }
    }
  }

  return ids;
}

/**
 * Collects all register IDs used in a function (both definitions and uses).
 *
 * This includes:
 * - Result registers from all instructions
 * - Phi instruction source operands
 * - Operand registers in binary/unary instructions
 *
 * Useful for analyzing register usage patterns.
 *
 * @param func - The IL function to collect from
 * @returns Array of all register IDs (may contain duplicates for uses)
 */
export function collectAllRegisterUsage(func: ILFunction): number[] {
  const ids: number[] = [];

  for (const block of func.getBlocks()) {
    for (const instruction of block.getInstructions()) {
      // Result register
      if (instruction.result) {
        ids.push(instruction.result.id);
      }

      // Phi instruction sources
      if (instruction.opcode === ILOpcode.PHI) {
        // Access sources array from phi instruction
        const phi = instruction as unknown as { sources: Array<{ value: { id: number } }> };
        if (phi.sources) {
          for (const source of phi.sources) {
            if (source.value?.id !== undefined) {
              ids.push(source.value.id);
            }
          }
        }
      }
    }
  }

  return ids;
}

// =============================================================================
// Phi Instruction Analysis
// =============================================================================

/**
 * Counts the number of phi instructions in a function.
 *
 * @param func - The IL function to analyze
 * @returns Number of phi instructions
 */
export function countPhiInstructions(func: ILFunction): number {
  let count = 0;

  for (const block of func.getBlocks()) {
    for (const instruction of block.getInstructions()) {
      if (instruction.opcode === ILOpcode.PHI) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Finds all blocks containing phi instructions.
 *
 * @param func - The IL function to analyze
 * @returns Array of block IDs that contain phi instructions
 */
export function findBlocksWithPhis(func: ILFunction): number[] {
  const blockIds: number[] = [];

  for (const block of func.getBlocks()) {
    const hasPhis = block.getInstructions().some((i) => i.opcode === ILOpcode.PHI);
    if (hasPhis) {
      blockIds.push(block.id);
    }
  }

  return blockIds;
}

/**
 * Counts phi instructions per block.
 *
 * @param func - The IL function to analyze
 * @returns Map of block ID to phi count
 */
export function countPhisPerBlock(func: ILFunction): Map<number, number> {
  const counts = new Map<number, number>();

  for (const block of func.getBlocks()) {
    const phiCount = block.getInstructions().filter((i) => i.opcode === ILOpcode.PHI).length;
    if (phiCount > 0) {
      counts.set(block.id, phiCount);
    }
  }

  return counts;
}

// =============================================================================
// Function Statistics
// =============================================================================

/**
 * Collects statistics about an IL function.
 *
 * Useful for test assertions and debugging.
 *
 * @param func - The IL function to analyze
 * @returns Statistics about the function
 */
export function getFunctionStats(func: ILFunction): FunctionStats {
  let instructionCount = 0;
  let phiCount = 0;
  const resultRegisters = new Set<number>();

  for (const block of func.getBlocks()) {
    for (const instruction of block.getInstructions()) {
      instructionCount++;
      if (instruction.opcode === ILOpcode.PHI) {
        phiCount++;
      }
      if (instruction.result) {
        resultRegisters.add(instruction.result.id);
      }
    }
  }

  return {
    blockCount: func.getBlocks().length,
    instructionCount,
    phiCount,
    resultRegisterCount: resultRegisters.size,
  };
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Asserts that all register IDs in a function are unique.
 *
 * Throws an error with detailed information if duplicates are found.
 * Useful for test assertions.
 *
 * @param func - The IL function to verify
 * @throws Error if duplicate register IDs are found
 */
export function assertUniqueRegisterIds(func: ILFunction): void {
  const result = verifyRegisterIdUniqueness(func);

  if (!result.unique) {
    const messages = result.details.map(
      (d) =>
        `  - ID ${d.id}: defined at block ${d.firstLocation.blockId}:${d.firstLocation.instructionId}, ` +
        `again at block ${d.secondLocation.blockId}:${d.secondLocation.instructionId}`,
    );

    throw new Error(`Register ID uniqueness violation:\n${messages.join('\n')}`);
  }
}

/**
 * Asserts that a function has the expected number of phi instructions.
 *
 * @param func - The IL function to check
 * @param expected - Expected number of phi instructions
 * @throws Error if the count doesn't match
 */
export function assertPhiCount(func: ILFunction, expected: number): void {
  const actual = countPhiInstructions(func);

  if (actual !== expected) {
    throw new Error(`Expected ${expected} phi instructions, but found ${actual}`);
  }
}
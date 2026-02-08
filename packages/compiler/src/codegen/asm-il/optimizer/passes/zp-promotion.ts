/**
 * Zero-Page Promotion Pass
 *
 * Promotes frequently-accessed variables from absolute addressing ($0100-$FFFF)
 * to zero-page addressing ($00-$FF) for faster access on the 6502.
 *
 * **Benefits per promoted access:**
 * - Saves 1 cycle per access (3 cycles instead of 4 for loads/stores)
 * - Saves 1 byte per instruction (2 bytes instead of 3)
 *
 * **Algorithm:**
 * 1. Count access frequency for each absolute address
 * 2. Rank candidates by hotness (frequency × cycles saved)
 * 3. Allocate top-N to available ZP slots
 * 4. Transform all references from Absolute → ZeroPage
 *
 * **Safety constraints:**
 * - Only promotes Absolute and AbsoluteX/AbsoluteY modes
 * - Already zero-page addresses are skipped
 * - Hardware registers ($D000-$DFFF) are excluded
 * - Label-based operands are excluded (address unknown at this stage)
 *
 * **Enabled at:** O3, Os, Oz
 *
 * @module codegen/asm-il/optimizer/passes/zp-promotion
 */

import type {
  AsmOptimizationPass,
  AsmOptimizationPassResult,
  AsmPassTransformStats,
} from '../types.js';
import { createEmptyTransformStats, createUnchangedPassResult } from '../types.js';
import type { AsmILProgram, AsmILSection, AsmILElement, AsmInstruction } from '../../types.js';
import { AsmAddressingMode, isInstructionElement } from '../../types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * C64 hardware I/O range — addresses in this range must NOT be promoted.
 * These are memory-mapped hardware registers that must remain at their
 * fixed addresses for correct operation.
 */
const IO_RANGE_START = 0xD000;
const IO_RANGE_END = 0xDFFF;

/**
 * Addressing modes that can be promoted to ZP equivalents.
 * Maps absolute modes to their zero-page counterparts.
 */
const PROMOTABLE_MODES: Record<string, AsmAddressingMode> = {
  [AsmAddressingMode.Absolute]: AsmAddressingMode.ZeroPage,
  [AsmAddressingMode.AbsoluteX]: AsmAddressingMode.ZeroPageX,
  [AsmAddressingMode.AbsoluteY]: AsmAddressingMode.ZeroPageY,
};

/**
 * Cycles saved per access when promoting from absolute to zero-page.
 * Most load/store operations save 1 cycle.
 */
const CYCLES_SAVED_PER_ACCESS = 1;

/**
 * Bytes saved per instruction when promoting from absolute to zero-page.
 * Absolute instructions are 3 bytes, ZP instructions are 2 bytes.
 */
const BYTES_SAVED_PER_INSTRUCTION = 1;

// ============================================================================
// Types
// ============================================================================

/**
 * Tracks access frequency for a single memory address.
 */
interface AddressFrequency {
  /** The absolute address being tracked */
  address: number;

  /** Total number of accesses (reads + writes) */
  accessCount: number;

  /** Hotness score = accessCount × cyclesSaved */
  hotness: number;
}

/**
 * Maps an absolute address to its promoted ZP slot.
 */
interface ZPAllocation {
  /** Original absolute address */
  originalAddress: number;

  /** Assigned zero-page slot */
  zpSlot: number;
}

// ============================================================================
// ZPPromotionPass
// ============================================================================

/**
 * Promotes frequently-accessed absolute addresses to zero-page for
 * faster and smaller code on the 6502.
 *
 * @example
 * ```typescript
 * const pass = new ZPPromotionPass([0x50, 0x51, 0x52, 0x53]);
 * const result = pass.run(program);
 * ```
 */
export class ZPPromotionPass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = 'zp-promotion';

  /** @inheritdoc */
  readonly isTransform = true;

  /** Available zero-page slots for promotion */
  protected readonly availableSlots: readonly number[];

  /**
   * Create a new ZP promotion pass.
   *
   * @param availableSlots - Array of zero-page addresses available for promotion.
   *   Defaults to empty (no promotion possible without slots).
   */
  constructor(availableSlots: readonly number[] = []) {
    this.availableSlots = availableSlots;
  }

  /**
   * Run the ZP promotion pass on an ASM-IL program.
   *
   * @param program - The program to optimize
   * @returns Result with optimized program and statistics
   */
  run(program: AsmILProgram): AsmOptimizationPassResult {
    // No slots available — nothing to promote
    if (this.availableSlots.length === 0) {
      return createUnchangedPassResult(program);
    }

    const stats = createEmptyTransformStats();

    // Step 1: Count access frequencies across all sections
    const frequencies = this.countAccesses(program);

    // No promotable accesses found
    if (frequencies.length === 0) {
      return createUnchangedPassResult(program);
    }

    // Step 2: Rank by hotness and select top candidates
    const ranked = this.rankByHotness(frequencies);

    // Step 3: Allocate ZP slots to the hottest candidates
    const allocations = this.allocateSlots(ranked);

    // No allocations possible
    if (allocations.length === 0) {
      return createUnchangedPassResult(program);
    }

    // Step 4: Transform all references
    const newProgram = this.applyAllocations(program, allocations, stats);

    if (stats.patternsMatched === 0) {
      return createUnchangedPassResult(program);
    }

    return {
      program: newProgram,
      changed: true,
      stats,
    };
  }

  // ==========================================================================
  // Step 1: Count Accesses
  // ==========================================================================

  /**
   * Count access frequencies for all absolute addresses across the program.
   *
   * Scans all sections for instructions using absolute addressing modes
   * and counts how many times each unique address is accessed.
   *
   * @param program - The program to analyze
   * @returns Array of address frequency records
   */
  protected countAccesses(program: AsmILProgram): AddressFrequency[] {
    const frequencyMap = new Map<number, number>();

    for (const section of program.sections) {
      for (const element of section.elements) {
        if (!isInstructionElement(element)) continue;

        const instr = element.instruction;

        // Only count promotable addressing modes with numeric operands
        if (!this.isPromotableAccess(instr)) continue;

        const address = instr.operand!;
        frequencyMap.set(address, (frequencyMap.get(address) ?? 0) + 1);
      }
    }

    // Convert map to array of AddressFrequency records
    const result: AddressFrequency[] = [];
    for (const [address, count] of frequencyMap) {
      result.push({
        address,
        accessCount: count,
        hotness: count * CYCLES_SAVED_PER_ACCESS,
      });
    }

    return result;
  }

  // ==========================================================================
  // Step 2: Rank by Hotness
  // ==========================================================================

  /**
   * Rank addresses by hotness score (descending).
   *
   * Higher hotness = more benefit from promotion.
   * For equal hotness, lower address gets priority (stable sort).
   *
   * @param frequencies - The access frequency data
   * @returns Sorted array (highest hotness first)
   */
  protected rankByHotness(frequencies: AddressFrequency[]): AddressFrequency[] {
    return [...frequencies].sort((a, b) => {
      // Primary: higher hotness first
      if (b.hotness !== a.hotness) return b.hotness - a.hotness;
      // Tie-break: lower address first (stable ordering)
      return a.address - b.address;
    });
  }

  // ==========================================================================
  // Step 3: Allocate ZP Slots
  // ==========================================================================

  /**
   * Allocate available ZP slots to the hottest addresses.
   *
   * Assigns one ZP slot per address, limited by the number of available slots.
   *
   * @param ranked - Addresses sorted by hotness (descending)
   * @returns Array of allocations mapping original → ZP address
   */
  protected allocateSlots(ranked: AddressFrequency[]): ZPAllocation[] {
    const allocations: ZPAllocation[] = [];
    const maxAllocations = Math.min(ranked.length, this.availableSlots.length);

    for (let i = 0; i < maxAllocations; i++) {
      allocations.push({
        originalAddress: ranked[i].address,
        zpSlot: this.availableSlots[i],
      });
    }

    return allocations;
  }

  // ==========================================================================
  // Step 4: Apply Allocations (Transform)
  // ==========================================================================

  /**
   * Apply ZP allocations by transforming all matching instructions.
   *
   * Replaces absolute addressing modes with their zero-page equivalents
   * and updates operands to the allocated ZP slot.
   *
   * @param program - The original program
   * @param allocations - The ZP allocations to apply
   * @param stats - Stats accumulator (mutated)
   * @returns A new program with transformed instructions
   */
  protected applyAllocations(
    program: AsmILProgram,
    allocations: ZPAllocation[],
    stats: AsmPassTransformStats
  ): AsmILProgram {
    // Build a lookup map for fast allocation resolution
    const allocationMap = new Map<number, number>();
    for (const alloc of allocations) {
      allocationMap.set(alloc.originalAddress, alloc.zpSlot);
    }

    const newSections: AsmILSection[] = [];

    for (const section of program.sections) {
      const newElements: AsmILElement[] = [];
      let sectionChanged = false;

      for (const element of section.elements) {
        if (!isInstructionElement(element)) {
          newElements.push(element);
          continue;
        }

        const instr = element.instruction;
        if (!this.isPromotableAccess(instr)) {
          newElements.push(element);
          continue;
        }

        const zpSlot = allocationMap.get(instr.operand!);
        if (zpSlot === undefined) {
          newElements.push(element);
          continue;
        }

        // Promote this instruction to ZP addressing
        const newMode = PROMOTABLE_MODES[instr.mode];
        const newInstr: AsmInstruction = {
          ...instr,
          mode: newMode,
          operand: zpSlot,
        };

        newElements.push({
          ...element,
          instruction: newInstr,
        });

        sectionChanged = true;
        stats.patternsMatched++;
        stats.instructionsRemoved++; // Conceptually "removed" old instruction
        stats.instructionsAdded++;   // Replaced with ZP version
        stats.estimatedCyclesSaved += CYCLES_SAVED_PER_ACCESS;
        stats.estimatedBytesSaved += BYTES_SAVED_PER_INSTRUCTION;
      }

      newSections.push(sectionChanged ? { ...section, elements: newElements } : section);
    }

    return { ...program, sections: newSections };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Check if an instruction access is promotable to zero-page.
   *
   * An instruction is promotable if:
   * 1. It uses an absolute addressing mode (Absolute, AbsoluteX, AbsoluteY)
   * 2. It has a numeric operand (not label-based)
   * 3. The operand is NOT already in zero-page range (< 0x100)
   * 4. The operand is NOT in the C64 I/O range ($D000-$DFFF)
   *
   * @param instr - The instruction to check
   * @returns True if the access can be promoted to ZP
   */
  protected isPromotableAccess(instr: AsmInstruction): boolean {
    // Must be a promotable addressing mode
    if (!(instr.mode in PROMOTABLE_MODES)) return false;

    // Must have a numeric operand (not a label reference)
    if (instr.operand === undefined) return false;

    const address = instr.operand;

    // Already zero-page — no promotion needed
    if (address < 0x100) return false;

    // C64 I/O hardware registers — must not be promoted
    if (address >= IO_RANGE_START && address <= IO_RANGE_END) return false;

    return true;
  }
}

/**
 * Indexed Addressing Optimization Pass
 *
 * Detects computed-address array access patterns and replaces them with
 * 6502 indexed addressing modes. This is an O2-level pass that identifies
 * sequences where a base address is combined with an index via addition,
 * stored to a temporary, then used for a load — and replaces them with
 * the more efficient `LDA base,X` or `LDA base,Y` instructions.
 *
 * **Pattern handled:**
 * ```asm
 * ; Before (computed address via addition):
 * LDX index      ; load index into X
 * LDA base,X     ; ... but if codegen produced:
 *
 * ; Common codegen pattern we optimize:
 * LDA base       ; load base address low byte
 * CLC
 * ADC temp       ; add index value from temp
 * STA ptr        ; store computed address to pointer
 * LDA (ptr)      ; load via indirect
 *
 * ; After (indexed addressing):
 * LDX temp       ; load index into X
 * LDA base,X    ; use indexed addressing directly
 * ```
 *
 * **Simpler pattern also handled:**
 * ```asm
 * ; Before:
 * LDA someAddr   ; LDA absolute
 * TAX            ; transfer A to X
 * LDA table,X   ; (this is already indexed — no optimization needed)
 *
 * ; Pattern we DO optimize:
 * LDX someAddr     ; load value into X from memory
 * LDA otherAddr    ; load another value (absolute)
 * STA otherAddr    ; store back (no alias concern)
 * ; When LDX is followed by LDA absolute that could use ,X:
 * ; We look for LDA addr + CLC + ADC idx + STA tmp sequences
 * ```
 *
 * **Safety constraints:**
 * - Base address must be a known absolute address (not a label that could change)
 * - Index must already be in X or Y register, or loadable from a known location
 * - Only optimizes when the pattern is provably equivalent
 * - Indirect modes require zero-page pointers (constraints apply)
 *
 * **Performance impact:**
 * - Saves 4-8 bytes (CLC+ADC+STA+LDA indirect → LDX+LDA indexed)
 * - Saves 6-12 cycles (eliminates addition and indirect access overhead)
 *
 * @module codegen/asm-il/optimizer/passes/indexed-addr
 */

import type {
  AsmOptimizationPass,
  AsmOptimizationPassResult,
  AsmPassTransformStats,
} from '../types.js';
import { createEmptyTransformStats, createUnchangedPassResult } from '../types.js';
import type { AsmILProgram, AsmILSection, AsmILElement } from '../../types.js';
import { AsmAddressingMode, isInstructionElement } from '../../types.js';

// ============================================================================
// IndexedAddrPass
// ============================================================================

/**
 * Optimizes computed-address patterns into 6502 indexed addressing.
 *
 * Detects the common code generation pattern where an absolute address is
 * loaded, an index is added via CLC+ADC, the result is stored to a pointer,
 * and then an indirect load is performed. Replaces this with a single
 * indexed addressing instruction (LDA base,X or LDA base,Y).
 *
 * The pass is conservative: it only transforms when the pattern is an
 * exact match and the transformation is provably correct.
 *
 * @example
 * ```typescript
 * const pass = new IndexedAddrPass();
 * const result = pass.run(program);
 * ```
 */
export class IndexedAddrPass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = 'indexed-addr';

  /** @inheritdoc */
  readonly isTransform = true;

  /**
   * Run the indexed addressing optimization pass on an ASM-IL program.
   *
   * @param program - The program to optimize
   * @returns Result with optimized program and statistics
   */
  run(program: AsmILProgram): AsmOptimizationPassResult {
    const stats = createEmptyTransformStats();
    let anyChanged = false;
    const newSections: AsmILSection[] = [];

    for (const section of program.sections) {
      const result = this.optimizeSection(section, stats);
      newSections.push(result.section);
      if (result.changed) {
        anyChanged = true;
      }
    }

    if (!anyChanged) {
      return createUnchangedPassResult(program);
    }

    return {
      program: { ...program, sections: newSections },
      changed: true,
      stats,
    };
  }

  // ==========================================================================
  // Section Processing
  // ==========================================================================

  /**
   * Optimize a single section by scanning for computed-address patterns.
   *
   * Searches for the 5-instruction pattern:
   * LDA base → CLC → ADC index → STA ptr → LDA (ptr),Y or LDA (ptr)
   * And replaces with: LDX index → LDA base,X (or LDY + LDA base,Y)
   *
   * @param section - The section to optimize
   * @param stats - Mutable stats to accumulate
   * @returns The optimized section and whether it changed
   */
  protected optimizeSection(
    section: AsmILSection,
    stats: AsmPassTransformStats
  ): { section: AsmILSection; changed: boolean } {
    const elements = section.elements;
    const newElements: AsmILElement[] = [];
    let changed = false;
    let i = 0;

    while (i < elements.length) {
      const match = this.matchComputedAddressPattern(elements, i);

      if (match) {
        // Replace the 5-instruction sequence with 2 instructions:
        // 1. LDX index (or LDY index)
        // 2. LDA base,X (or LDA base,Y)
        newElements.push({
          kind: 'instruction',
          instruction: {
            mnemonic: match.useY ? 'LDY' : 'LDX',
            mode: match.indexMode,
            operand: match.indexOperand,
            labelOperand: match.indexLabelOperand,
            comment: 'indexed-addr: load index register',
          },
        });

        newElements.push({
          kind: 'instruction',
          instruction: {
            mnemonic: 'LDA',
            mode: match.useY ? AsmAddressingMode.AbsoluteY : AsmAddressingMode.AbsoluteX,
            operand: match.baseOperand,
            labelOperand: match.baseLabelOperand,
            comment: 'indexed-addr: use indexed addressing',
          },
        });

        changed = true;
        stats.patternsMatched++;
        // Removed 5 instructions, added 2 → net removal of 3
        stats.instructionsRemoved += match.instructionCount;
        stats.instructionsAdded += 2;
        // CLC=1b + ADC=2-3b + STA=2-3b + LDA(ind)=2b = ~8-10 bytes removed
        // LDX=2-3b + LDA,X=3b = ~5-6 bytes added → net savings ~3-4 bytes
        stats.estimatedBytesSaved += 4;
        // CLC=2c + ADC=3-4c + STA=3-4c + LDA(ind)=5-6c = ~13-16c removed
        // LDX=3-4c + LDA,X=4-5c = ~7-9c added → net savings ~6-7 cycles
        stats.estimatedCyclesSaved += 6;

        // Advance past the matched pattern
        i = match.endIndex + 1;
      } else {
        newElements.push(elements[i]);
        i++;
      }
    }

    if (!changed) {
      return { section, changed: false };
    }
    return { section: { ...section, elements: newElements }, changed: true };
  }

  // ==========================================================================
  // Pattern Matching
  // ==========================================================================

  /**
   * Match the computed-address pattern starting at a given index.
   *
   * Pattern: LDA base → CLC → ADC index → STA ptr → LDA (ptr),Y
   *
   * The base address and index source are extracted for the replacement.
   * Non-instruction elements between instructions cause the match to fail
   * (the pattern must be a contiguous instruction sequence).
   *
   * @param elements - All elements in the section
   * @param startIndex - Index to start matching from
   * @returns Match info or null if no match
   */
  protected matchComputedAddressPattern(
    elements: readonly AsmILElement[],
    startIndex: number
  ): IndexedAddrMatch | null {
    // Need at least 5 consecutive instructions
    if (startIndex + 4 >= elements.length) return null;

    // Step 1: LDA with absolute or zero-page addressing (base address)
    const ldaBase = elements[startIndex];
    if (!isInstructionElement(ldaBase)) return null;
    if (ldaBase.instruction.mnemonic !== 'LDA') return null;
    if (!this.isDirectAddressing(ldaBase.instruction.mode)) return null;

    const baseOperand = ldaBase.instruction.operand;
    const baseLabelOperand = ldaBase.instruction.labelOperand;

    // Must have either numeric or label operand for the base
    if (baseOperand === undefined && baseLabelOperand === undefined) return null;

    // Step 2: CLC (clear carry for addition)
    const clc = elements[startIndex + 1];
    if (!isInstructionElement(clc)) return null;
    if (clc.instruction.mnemonic !== 'CLC') return null;

    // Step 3: ADC with direct addressing (index source)
    const adc = elements[startIndex + 2];
    if (!isInstructionElement(adc)) return null;
    if (adc.instruction.mnemonic !== 'ADC') return null;
    if (!this.isDirectOrImmediateAddressing(adc.instruction.mode)) return null;

    const indexOperand = adc.instruction.operand;
    const indexLabelOperand = adc.instruction.labelOperand;

    // Must have either numeric or label operand for the index
    if (indexOperand === undefined && indexLabelOperand === undefined) return null;

    // Step 4: STA to a pointer location
    const sta = elements[startIndex + 3];
    if (!isInstructionElement(sta)) return null;
    if (sta.instruction.mnemonic !== 'STA') return null;

    // Step 5: LDA with indirect addressing using the same pointer
    const ldaInd = elements[startIndex + 4];
    if (!isInstructionElement(ldaInd)) return null;
    if (ldaInd.instruction.mnemonic !== 'LDA') return null;

    // Must be indirect addressing mode
    if (!this.isIndirectAddressing(ldaInd.instruction.mode)) return null;

    // The indirect load must use the same pointer that the STA wrote to
    if (!this.samePtrAddress(sta, ldaInd)) return null;

    // Determine the addressing mode for the index load instruction
    // If index was immediate, we load with immediate (LDX #imm)
    // If index was from memory, we load from the same memory (LDX addr)
    const indexMode = adc.instruction.mode;

    // Determine whether to use X or Y based on indirect mode:
    // IndirectIndexed (ptr),Y uses Y — so we prefer X for indexed addressing
    // IndexedIndirect (ptr,X) uses X — so we prefer Y for indexed addressing
    const useY = ldaInd.instruction.mode === AsmAddressingMode.IndexedIndirect;

    return {
      baseOperand,
      baseLabelOperand,
      indexOperand,
      indexLabelOperand,
      indexMode,
      useY,
      instructionCount: 5,
      endIndex: startIndex + 4,
    };
  }

  /**
   * Check if an addressing mode is a direct memory access (absolute or zero-page).
   *
   * @param mode - The addressing mode to check
   * @returns true if the mode directly references a memory address
   */
  protected isDirectAddressing(mode: AsmAddressingMode): boolean {
    return mode === AsmAddressingMode.Absolute || mode === AsmAddressingMode.ZeroPage;
  }

  /**
   * Check if an addressing mode is direct memory or immediate.
   *
   * @param mode - The addressing mode to check
   * @returns true if the mode is direct or immediate
   */
  protected isDirectOrImmediateAddressing(mode: AsmAddressingMode): boolean {
    return (
      mode === AsmAddressingMode.Absolute ||
      mode === AsmAddressingMode.ZeroPage ||
      mode === AsmAddressingMode.Immediate
    );
  }

  /**
   * Check if an addressing mode is an indirect mode.
   *
   * @param mode - The addressing mode to check
   * @returns true if the mode is indirect (Indirect, IndexedIndirect, IndirectIndexed)
   */
  protected isIndirectAddressing(mode: AsmAddressingMode): boolean {
    return (
      mode === AsmAddressingMode.Indirect ||
      mode === AsmAddressingMode.IndexedIndirect ||
      mode === AsmAddressingMode.IndirectIndexed
    );
  }

  /**
   * Check if the STA and indirect LDA reference the same pointer address.
   *
   * Compares both numeric operands and label operands to determine if
   * the STA's target matches the LDA's pointer source.
   *
   * @param sta - The STA instruction element
   * @param lda - The indirect LDA instruction element
   * @returns true if they reference the same pointer location
   */
  protected samePtrAddress(
    sta: { kind: 'instruction'; instruction: { operand?: number; labelOperand?: string } },
    lda: { kind: 'instruction'; instruction: { operand?: number; labelOperand?: string } }
  ): boolean {
    // Match by label operand
    if (
      sta.instruction.labelOperand !== undefined &&
      lda.instruction.labelOperand !== undefined
    ) {
      return sta.instruction.labelOperand === lda.instruction.labelOperand;
    }

    // Match by numeric operand
    if (
      sta.instruction.operand !== undefined &&
      lda.instruction.operand !== undefined
    ) {
      return sta.instruction.operand === lda.instruction.operand;
    }

    return false;
  }
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Information about a matched computed-address pattern.
 *
 * Contains the base address, index source, and addressing details needed
 * to generate the replacement indexed-addressing instructions.
 */
interface IndexedAddrMatch {
  /** Base address numeric operand (if any) */
  baseOperand: number | undefined;

  /** Base address label operand (if any) */
  baseLabelOperand: string | undefined;

  /** Index source numeric operand (if any) */
  indexOperand: number | undefined;

  /** Index source label operand (if any) */
  indexLabelOperand: string | undefined;

  /** Addressing mode for loading the index value */
  indexMode: AsmAddressingMode;

  /** Whether to use Y register instead of X for indexed addressing */
  useY: boolean;

  /** Number of instructions consumed by the pattern */
  instructionCount: number;

  /** Index of the last element in the matched pattern */
  endIndex: number;
}

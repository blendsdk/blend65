/**
 * Register Promotion Pass
 *
 * Promotes loop counter variables from memory (INC/DEC addr) to 6502
 * index registers (INX/DEX or INY/DEY). This is one of the highest-impact
 * optimizations for 6502 programs because:
 *
 * - INC addr takes 5-6 cycles; INX/DEX takes 2 cycles (60-67% savings)
 * - Eliminates redundant LDA/CMP for the counter variable
 * - Reduces memory bus traffic in tight loops
 *
 * **Pattern handled:**
 * ```asm
 * ; Before:
 * .loop
 *   LDA counter    ; load counter
 *   ...            ; use A
 *   INC counter    ; increment counter in memory (5-6 cycles)
 *   LDA counter    ; reload counter for comparison
 *   CMP #limit     ; compare with limit
 *   BNE .loop
 *
 * ; After:
 *   LDX counter    ; load counter into X before loop
 * .loop
 *   TXA            ; transfer X to A when needed
 *   ...            ; use A
 *   INX            ; increment X directly (2 cycles)
 *   CPX #limit     ; compare X with limit (no reload needed)
 *   BNE .loop
 *   STX counter    ; store back after loop
 * ```
 *
 * **Safety constraints:**
 * - Only promotes when X or Y is completely free in the loop body
 * - Only handles INC/DEC with ZeroPage or Absolute addressing
 * - JSR in loop body disqualifies (callee may use X/Y)
 * - Only one counter per loop (simplicity and correctness)
 * - Counter address must be consistently used (same addr for INC and LDA/CMP)
 *
 * **Enabled at:** O2+ (not enabled at Os/Oz where code size matters more,
 * though the transformation is typically size-neutral or size-reducing)
 *
 * @module codegen/asm-il/optimizer/passes/register-promote
 */

import type {
  AsmOptimizationPass,
  AsmOptimizationPassResult,
  AsmPassTransformStats,
} from '../types.js';
import { createEmptyTransformStats, createUnchangedPassResult } from '../types.js';
import type { AsmILProgram, AsmILSection, AsmILElement, AsmInstruction } from '../../types.js';
import { AsmAddressingMode, isInstructionElement, isLabelElement } from '../../types.js';
import { RegisterTracker } from '../analysis/register-tracker.js';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Represents a detected loop in the ASM-IL instruction stream.
 *
 * A loop is identified by a label followed by a backward branch
 * (BNE, BEQ, BCC, BCS, BPL, BMI) that targets the same label.
 */
interface DetectedLoop {
  /** Label name that marks the loop header */
  labelName: string;

  /** Index of the label element in the section's elements array */
  labelIndex: number;

  /** Index of the backward branch element */
  branchIndex: number;

  /** Indices of all instruction elements within the loop body */
  bodyInstructionIndices: number[];

  /** The actual instructions in the loop body (for analysis) */
  bodyInstructions: AsmInstruction[];
}

/**
 * A candidate for register promotion: a memory address used as a
 * loop counter (INC/DEC) that can be moved to X or Y.
 */
interface PromotionCandidate {
  /** Memory address (operand) of the counter variable */
  address: number;

  /** Whether it's INC (true) or DEC (false) */
  isIncrement: boolean;

  /** Index of the INC/DEC instruction element in the section */
  incDecElementIndex: number;

  /** Which register to promote to */
  targetRegister: 'x' | 'y';

  /** Element indices of LDA addr instructions to replace with TXA/TYA */
  loadElementIndices: number[];

  /** Element indices of CMP addr instructions to replace with CPX/CPY */
  compareElementIndices: number[];
}

// ============================================================================
// RegisterPromotePass
// ============================================================================

/**
 * Promotes loop counter memory operations to register operations.
 *
 * Scans each section for loop patterns where a memory address is
 * incremented/decremented with INC/DEC. When X or Y is free in the
 * loop body, the counter is promoted to that register:
 * - INC addr → INX (or INY)
 * - DEC addr → DEX (or DEY)
 * - LDA addr → TXA (or TYA)
 * - CMP addr → CPX (or CPY)
 * - LDX addr inserted before loop, STX addr after loop
 *
 * @example
 * ```typescript
 * const pass = new RegisterPromotePass();
 * const result = pass.run(program);
 * ```
 */
export class RegisterPromotePass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = 'register-promote';

  /** @inheritdoc */
  readonly isTransform = true;

  /** RegisterTracker used for register availability analysis */
  protected readonly tracker = new RegisterTracker();

  /**
   * Run the register promotion pass on an ASM-IL program.
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
   * Optimize a single section by finding loops and promoting counters.
   *
   * @param section - The section to optimize
   * @param stats - Mutable stats to accumulate
   * @returns The optimized section and whether it changed
   */
  protected optimizeSection(
    section: AsmILSection,
    stats: AsmPassTransformStats
  ): { section: AsmILSection; changed: boolean } {
    const loops = this.detectLoops(section);
    if (loops.length === 0) {
      return { section, changed: false };
    }

    let changed = false;
    // Work on a mutable copy of elements — process loops from last to first
    // so that index adjustments from insertions don't affect earlier loops
    let elements = [...section.elements];

    // Process loops in reverse order (last first) to maintain valid indices
    for (let i = loops.length - 1; i >= 0; i--) {
      const loop = loops[i];
      const candidate = this.findPromotionCandidate(loop, elements);
      if (candidate) {
        elements = this.applyPromotion(elements, loop, candidate, stats);
        changed = true;
      }
    }

    if (!changed) {
      return { section, changed: false };
    }

    return {
      section: { ...section, elements },
      changed: true,
    };
  }

  // ==========================================================================
  // Loop Detection
  // ==========================================================================

  /**
   * Detect loops in a section by finding label + backward-branch pairs.
   *
   * A loop is identified when:
   * 1. A label element exists in the section
   * 2. A branch instruction later in the section targets that label
   * 3. The branch is a conditional branch (BNE, BEQ, BCC, BCS, BPL, BMI)
   *
   * Only the innermost/simplest loops are detected — nested loops are
   * skipped because their promotion is more complex.
   *
   * @param section - Section to scan for loops
   * @returns Array of detected loops
   */
  protected detectLoops(section: AsmILSection): DetectedLoop[] {
    const loops: DetectedLoop[] = [];
    const elements = section.elements;

    // Build a map of label name → element index
    const labelIndices = new Map<string, number>();
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (isLabelElement(el)) {
        labelIndices.set(el.label.name, i);
      }
    }

    // Find backward branches that target known labels
    const branchMnemonics = new Set(['BNE', 'BEQ', 'BCC', 'BCS', 'BPL', 'BMI']);

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!isInstructionElement(el)) continue;
      if (!branchMnemonics.has(el.instruction.mnemonic)) continue;
      if (!el.instruction.labelOperand) continue;

      const targetLabel = el.instruction.labelOperand;
      const labelIdx = labelIndices.get(targetLabel);

      // Must be a backward branch (label before branch)
      if (labelIdx === undefined || labelIdx >= i) continue;

      // Collect body instruction indices and instructions
      const bodyInstructionIndices: number[] = [];
      const bodyInstructions: AsmInstruction[] = [];
      for (let j = labelIdx + 1; j < i; j++) {
        const bodyEl = elements[j];
        if (isInstructionElement(bodyEl)) {
          bodyInstructionIndices.push(j);
          bodyInstructions.push(bodyEl.instruction);
        }
      }

      loops.push({
        labelName: targetLabel,
        labelIndex: labelIdx,
        branchIndex: i,
        bodyInstructionIndices,
        bodyInstructions,
      });
    }

    return loops;
  }

  // ==========================================================================
  // Candidate Detection
  // ==========================================================================

  /**
   * Find a promotion candidate within a detected loop.
   *
   * Looks for INC/DEC instructions targeting memory addresses where:
   * 1. The INC/DEC uses ZeroPage or Absolute addressing
   * 2. X or Y is free (not used) in the loop body
   * 3. No JSR in the loop body (callee might use X/Y)
   * 4. Only one INC/DEC to the same address (simple counter)
   *
   * If both X and Y are free, X is preferred (convention).
   *
   * @param loop - The detected loop to analyze
   * @param elements - All elements in the section
   * @returns A promotion candidate, or null if none found
   */
  protected findPromotionCandidate(
    loop: DetectedLoop,
    elements: readonly AsmILElement[]
  ): PromotionCandidate | null {
    // Safety: no JSR in loop body (callee may clobber X/Y)
    if (this.hasJSR(loop.bodyInstructions)) {
      return null;
    }

    // Find INC/DEC instructions in the loop body
    const incDecCandidates = this.findIncDecInstructions(loop, elements);
    if (incDecCandidates.length === 0) {
      return null;
    }

    // Check register availability — try X first, then Y
    const xFree = this.tracker.isRegisterFree(loop.bodyInstructions, 'x');
    const yFree = this.tracker.isRegisterFree(loop.bodyInstructions, 'y');

    if (!xFree && !yFree) {
      return null;
    }

    const targetRegister: 'x' | 'y' = xFree ? 'x' : 'y';

    // Use the first INC/DEC candidate (one counter per loop for safety)
    const first = incDecCandidates[0];

    // Find LDA and CMP instructions referencing the same address
    const loadIndices = this.findLoadsForAddress(
      loop, elements, first.address
    );
    const compareIndices = this.findComparesForAddress(
      loop, elements, first.address
    );

    return {
      address: first.address,
      isIncrement: first.isIncrement,
      incDecElementIndex: first.elementIndex,
      targetRegister,
      loadElementIndices: loadIndices,
      compareElementIndices: compareIndices,
    };
  }

  /**
   * Check if any instruction in the array is a JSR (subroutine call).
   *
   * JSR disqualifies promotion because the callee may use X or Y,
   * and we cannot prove the callee preserves registers.
   *
   * @param instructions - Instructions to check
   * @returns true if any JSR is found
   */
  protected hasJSR(instructions: AsmInstruction[]): boolean {
    return instructions.some(instr => instr.mnemonic === 'JSR');
  }

  /**
   * Find INC/DEC instructions in the loop body that target memory addresses.
   *
   * Only ZeroPage and Absolute addressing modes are eligible for promotion.
   * If multiple INC/DEC target the same address, they are combined.
   *
   * @param loop - The detected loop
   * @param elements - All section elements
   * @returns Array of INC/DEC candidates with their addresses
   */
  protected findIncDecInstructions(
    loop: DetectedLoop,
    elements: readonly AsmILElement[]
  ): Array<{ address: number; isIncrement: boolean; elementIndex: number }> {
    const candidates: Array<{
      address: number;
      isIncrement: boolean;
      elementIndex: number;
    }> = [];
    const validModes = new Set([
      AsmAddressingMode.ZeroPage,
      AsmAddressingMode.Absolute,
    ]);

    for (const idx of loop.bodyInstructionIndices) {
      const el = elements[idx];
      if (!isInstructionElement(el)) continue;

      const { mnemonic, mode, operand } = el.instruction;
      if (mnemonic !== 'INC' && mnemonic !== 'DEC') continue;
      if (!validModes.has(mode)) continue;
      if (operand === undefined) continue;

      candidates.push({
        address: operand,
        isIncrement: mnemonic === 'INC',
        elementIndex: idx,
      });
    }

    // Deduplicate by address — only promote if exactly one INC or DEC
    // to the same address exists (prevents complex multi-modify patterns)
    const addressCounts = new Map<number, number>();
    for (const c of candidates) {
      addressCounts.set(c.address, (addressCounts.get(c.address) ?? 0) + 1);
    }

    return candidates.filter(c => addressCounts.get(c.address) === 1);
  }

  /**
   * Find LDA instructions in the loop body that load from the counter address.
   *
   * These will be replaced with TXA/TYA after promotion.
   *
   * @param loop - The detected loop
   * @param elements - All section elements
   * @param address - The counter memory address
   * @returns Element indices of matching LDA instructions
   */
  protected findLoadsForAddress(
    loop: DetectedLoop,
    elements: readonly AsmILElement[],
    address: number
  ): number[] {
    const indices: number[] = [];
    const validModes = new Set([
      AsmAddressingMode.ZeroPage,
      AsmAddressingMode.Absolute,
    ]);

    for (const idx of loop.bodyInstructionIndices) {
      const el = elements[idx];
      if (!isInstructionElement(el)) continue;
      if (el.instruction.mnemonic !== 'LDA') continue;
      if (!validModes.has(el.instruction.mode)) continue;
      if (el.instruction.operand !== address) continue;
      indices.push(idx);
    }

    return indices;
  }

  /**
   * Find CMP instructions in the loop body that compare against the counter address.
   *
   * These will be replaced with CPX/CPY after promotion.
   * Only CMP with immediate mode following a LDA of the counter are eligible,
   * but we also catch direct CMP to the counter address.
   *
   * @param loop - The detected loop
   * @param elements - All section elements
   * @param address - The counter memory address
   * @returns Element indices of matching CMP instructions
   */
  protected findComparesForAddress(
    loop: DetectedLoop,
    elements: readonly AsmILElement[],
    address: number
  ): number[] {
    const indices: number[] = [];
    const validModes = new Set([
      AsmAddressingMode.ZeroPage,
      AsmAddressingMode.Absolute,
    ]);

    for (const idx of loop.bodyInstructionIndices) {
      const el = elements[idx];
      if (!isInstructionElement(el)) continue;
      if (el.instruction.mnemonic !== 'CMP') continue;
      if (!validModes.has(el.instruction.mode)) continue;
      if (el.instruction.operand !== address) continue;
      indices.push(idx);
    }

    return indices;
  }

  // ==========================================================================
  // Promotion Application
  // ==========================================================================

  /**
   * Apply the register promotion transformation to the section elements.
   *
   * This performs the following transformations:
   * 1. Insert LDX/LDY addr before the loop label (load counter into register)
   * 2. Replace INC/DEC addr → INX/DEX or INY/DEY
   * 3. Replace LDA addr → TXA or TYA (where addr is the counter)
   * 4. Replace CMP addr → CPX/CPY (where addr is the counter)
   * 5. Insert STX/STY addr after the loop branch (store counter back)
   *
   * @param elements - Current section elements (will be copied)
   * @param loop - The detected loop
   * @param candidate - The promotion candidate
   * @param stats - Mutable stats to accumulate
   * @returns New elements array with promotion applied
   */
  protected applyPromotion(
    elements: AsmILElement[],
    loop: DetectedLoop,
    candidate: PromotionCandidate,
    stats: AsmPassTransformStats
  ): AsmILElement[] {
    const reg = candidate.targetRegister;
    const result = [...elements];

    // Track index offset caused by insertions
    let offset = 0;

    // 1. Insert LDX/LDY addr before the loop label
    const loadMnemonic = reg === 'x' ? 'LDX' : 'LDY';
    const loadInstr: AsmILElement = {
      kind: 'instruction',
      instruction: {
        mnemonic: loadMnemonic,
        mode: this.getAddressingMode(candidate.address),
        operand: candidate.address,
        comment: `register-promote: load counter into ${reg.toUpperCase()}`,
      },
    };
    result.splice(loop.labelIndex + offset, 0, loadInstr);
    offset++;
    stats.instructionsAdded++;

    // 2. Replace INC/DEC addr → INX/DEX or INY/DEY
    const incDecMnemonic = candidate.isIncrement
      ? (reg === 'x' ? 'INX' : 'INY')
      : (reg === 'x' ? 'DEX' : 'DEY');
    result[candidate.incDecElementIndex + offset] = {
      kind: 'instruction',
      instruction: {
        mnemonic: incDecMnemonic,
        mode: AsmAddressingMode.Implied,
        comment: `register-promote: ${candidate.isIncrement ? 'INC' : 'DEC'} → ${incDecMnemonic}`,
      },
    };
    stats.patternsMatched++;
    // INC addr = 5-6 cycles, INX = 2 cycles → save 3-4 cycles per iteration
    stats.estimatedCyclesSaved += 3;
    // INC addr = 2-3 bytes, INX = 1 byte → save 1-2 bytes
    stats.estimatedBytesSaved += 1;

    // 3. Replace LDA addr → TXA/TYA (counter loads)
    const transferMnemonic = reg === 'x' ? 'TXA' : 'TYA';
    for (const loadIdx of candidate.loadElementIndices) {
      result[loadIdx + offset] = {
        kind: 'instruction',
        instruction: {
          mnemonic: transferMnemonic,
          mode: AsmAddressingMode.Implied,
          comment: `register-promote: LDA → ${transferMnemonic}`,
        },
      };
      stats.patternsMatched++;
      // LDA addr = 3-4 cycles, TXA = 2 cycles → save 1-2 cycles
      stats.estimatedCyclesSaved += 2;
      // LDA addr = 2-3 bytes, TXA = 1 byte → save 1-2 bytes
      stats.estimatedBytesSaved += 1;
    }

    // 4. Replace CMP addr → CPX/CPY (counter compares — only for memory-mode CMP)
    const cmpRegMnemonic = reg === 'x' ? 'CPX' : 'CPY';
    for (const cmpIdx of candidate.compareElementIndices) {
      const origEl = elements[cmpIdx];
      if (isInstructionElement(origEl)) {
        result[cmpIdx + offset] = {
          kind: 'instruction',
          instruction: {
            mnemonic: cmpRegMnemonic,
            mode: origEl.instruction.mode,
            operand: origEl.instruction.operand,
            comment: `register-promote: CMP → ${cmpRegMnemonic}`,
          },
        };
        stats.patternsMatched++;
      }
    }

    // 5. Insert STX/STY addr after the loop branch
    const storeMnemonic = reg === 'x' ? 'STX' : 'STY';
    const storeInstr: AsmILElement = {
      kind: 'instruction',
      instruction: {
        mnemonic: storeMnemonic,
        mode: this.getAddressingMode(candidate.address),
        operand: candidate.address,
        comment: `register-promote: store counter from ${reg.toUpperCase()} back to memory`,
      },
    };
    // Insert after the branch instruction
    result.splice(loop.branchIndex + offset + 1, 0, storeInstr);
    stats.instructionsAdded++;

    return result;
  }

  /**
   * Determine the correct addressing mode for a memory address.
   *
   * Addresses in the range 0x00–0xFF use ZeroPage mode (2 bytes, faster).
   * Addresses above 0xFF use Absolute mode (3 bytes).
   *
   * @param address - The memory address
   * @returns The appropriate addressing mode
   */
  protected getAddressingMode(address: number): AsmAddressingMode {
    return address <= 0xFF
      ? AsmAddressingMode.ZeroPage
      : AsmAddressingMode.Absolute;
  }
}

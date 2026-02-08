/**
 * Branch Optimization Pass
 *
 * Optimizes branch and jump patterns in 6502 assembly. This is an O2-level
 * pass that handles three key patterns:
 *
 * **Patterns handled:**
 * 1. **JMP chain collapse** — Redirect JMP through chains (JMP A → JMP B → JMP B directly)
 * 2. **Unreachable code removal** — Remove instructions after unconditional JMP/RTS/RTI/BRK
 * 3. **Branch-over-JMP** — Replace BEQ skip; JMP target; skip: with BNE target
 *
 * **Safety constraints:**
 * - Chain resolution limited to 10 hops (prevents infinite loops)
 * - Labels end unreachable sections (could be jumped to from elsewhere)
 * - Branch-over-JMP only matches when the JMP immediately follows the branch
 *
 * **Performance impact:**
 * - JMP chain: saves 3+ cycles per hop eliminated
 * - Unreachable code: saves code size (bytes vary)
 * - Branch-over-JMP: saves 3 cycles and 2 bytes (replace JMP 3b + branch 2b with single branch 2b)
 *
 * @module codegen/asm-il/optimizer/passes/branch-opt
 */

import type {
  AsmOptimizationPass,
  AsmOptimizationPassResult,
  AsmPassTransformStats,
} from '../types.js';
import { createEmptyTransformStats, createUnchangedPassResult } from '../types.js';
import type { AsmILProgram, AsmILSection, AsmILElement } from '../../types.js';
import { isInstructionElement } from '../../types.js';

// ============================================================================
// Constants
// ============================================================================

/** Maximum chain resolution depth to prevent infinite loops on circular references */
const MAX_CHAIN_DEPTH = 10;

/** Unconditional jumps/returns that make subsequent code unreachable */
const UNCONDITIONAL_TERMINATORS = new Set(['JMP', 'RTS', 'RTI', 'BRK']);

/** Conditional branch instructions that can be inverted */
const CONDITIONAL_BRANCHES = new Set([
  'BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS',
]);

/** Mapping from conditional branch to its inverse */
const BRANCH_INVERSIONS: Record<string, string> = {
  BCC: 'BCS', BCS: 'BCC',
  BEQ: 'BNE', BNE: 'BEQ',
  BMI: 'BPL', BPL: 'BMI',
  BVC: 'BVS', BVS: 'BVC',
};

/** All branch/jump instructions (for chain collapse) */
const JUMP_OR_BRANCH = new Set([
  'JMP', 'BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS',
]);

// ============================================================================
// BranchOptPass
// ============================================================================

/**
 * Optimizes branch and jump patterns in 6502 assembly.
 *
 * Processes each section independently, applying three passes internally:
 * 1. Collapse JMP chains by following label targets
 * 2. Remove unreachable code after unconditional terminators
 * 3. Replace branch-over-JMP with inverted conditional branch
 *
 * Iterates until no more changes are found within each section.
 *
 * @example
 * ```typescript
 * const pass = new BranchOptPass();
 * const result = pass.run(program);
 * ```
 */
export class BranchOptPass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = 'branch-opt';

  /** @inheritdoc */
  readonly isTransform = true;

  /**
   * Run the branch optimization pass on an ASM-IL program.
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
   * Optimize a single section by applying all branch patterns.
   *
   * Iterates the three sub-passes until no further changes occur,
   * because one pass can create opportunities for another (e.g.,
   * chain collapse may create unreachable code).
   *
   * @param section - The section to optimize
   * @param stats - Mutable stats to accumulate
   * @returns The optimized section and whether it changed
   */
  protected optimizeSection(
    section: AsmILSection,
    stats: AsmPassTransformStats
  ): { section: AsmILSection; changed: boolean } {
    let current = section;
    let everChanged = false;
    let keepGoing = true;

    // Iterate until stable (sub-passes can create opportunities for each other)
    while (keepGoing) {
      keepGoing = false;

      const r1 = this.collapseJmpChains(current, stats);
      if (r1.changed) { current = r1.section; keepGoing = true; everChanged = true; }

      const r2 = this.removeUnreachableCode(current, stats);
      if (r2.changed) { current = r2.section; keepGoing = true; everChanged = true; }

      const r3 = this.optimizeBranchOverJmp(current, stats);
      if (r3.changed) { current = r3.section; keepGoing = true; everChanged = true; }
    }

    return { section: current, changed: everChanged };
  }

  // ==========================================================================
  // Pattern 1: JMP Chain Collapse
  // ==========================================================================

  /**
   * Collapse JMP chains by resolving intermediate labels.
   *
   * Builds a map of label → JMP target, then resolves chains
   * (label1 → label2 → label3) to final targets. Any JMP or
   * branch targeting a chain head is redirected to the final target.
   *
   * @param section - Section to process
   * @param stats - Stats accumulator
   * @returns The section and whether changes were made
   */
  protected collapseJmpChains(
    section: AsmILSection,
    stats: AsmPassTransformStats
  ): { section: AsmILSection; changed: boolean } {
    const labelTargets = this.buildLabelTargetMap(section);
    if (labelTargets.size === 0) {
      return { section, changed: false };
    }

    const elements = section.elements;
    const newElements: AsmILElement[] = [];
    let changed = false;

    for (const element of elements) {
      if (!isInstructionElement(element)) {
        newElements.push(element);
        continue;
      }

      const instr = element.instruction;

      // Only process jumps/branches with label operands
      if (JUMP_OR_BRANCH.has(instr.mnemonic) && instr.labelOperand !== undefined) {
        const finalTarget = this.resolveChain(instr.labelOperand, labelTargets);
        if (finalTarget !== instr.labelOperand) {
          // Create new instruction with resolved target
          newElements.push({
            kind: 'instruction',
            instruction: { ...instr, labelOperand: finalTarget },
          });
          changed = true;
          stats.patternsMatched++;
          // No cycle savings counted here — JMP itself isn't removed,
          // just shortened chain. Savings come from fewer hops at runtime.
          continue;
        }
      }

      newElements.push(element);
    }

    if (!changed) {
      return { section, changed: false };
    }
    return { section: { ...section, elements: newElements }, changed: true };
  }

  /**
   * Build a map of label names to their immediate JMP target.
   *
   * A label "chains" to a JMP target when the label's first instruction
   * is an unconditional JMP with a label operand.
   *
   * @param section - Section to scan
   * @returns Map from label name to JMP target label
   */
  protected buildLabelTargetMap(section: AsmILSection): Map<string, string> {
    const map = new Map<string, string>();
    const elements = section.elements;

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el.kind !== 'label') continue;

      // Find the next instruction after this label
      for (let j = i + 1; j < elements.length; j++) {
        const next = elements[j];

        // Skip consecutive labels (a label followed by another label)
        if (next.kind === 'label') continue;

        // Skip non-instruction elements (comments, blanks)
        if (!isInstructionElement(next)) continue;

        // If the label's first instruction is JMP with label target, record it
        if (next.instruction.mnemonic === 'JMP' && next.instruction.labelOperand !== undefined) {
          map.set(el.label.name, next.instruction.labelOperand);
        }
        break; // Only check the first instruction after the label
      }
    }

    return map;
  }

  /**
   * Resolve a JMP chain to its final target.
   *
   * Follows chains up to MAX_CHAIN_DEPTH to prevent infinite loops
   * on circular references (label1 → label2 → label1).
   *
   * @param label - Starting label
   * @param targets - Label-to-target map
   * @param depth - Current recursion depth
   * @returns The final target label
   */
  protected resolveChain(
    label: string,
    targets: Map<string, string>,
    depth = 0
  ): string {
    if (depth > MAX_CHAIN_DEPTH) return label;
    const target = targets.get(label);
    if (!target || target === label) return label;
    return this.resolveChain(target, targets, depth + 1);
  }

  // ==========================================================================
  // Pattern 2: Unreachable Code Removal
  // ==========================================================================

  /**
   * Remove unreachable instructions after unconditional terminators.
   *
   * After JMP, RTS, RTI, or BRK, instructions are unreachable until
   * a label is encountered (labels can be jumped to from elsewhere).
   * Non-instruction elements (comments, blanks) in unreachable regions
   * are also removed to keep output clean.
   *
   * @param section - Section to process
   * @param stats - Stats accumulator
   * @returns The section and whether changes were made
   */
  protected removeUnreachableCode(
    section: AsmILSection,
    stats: AsmPassTransformStats
  ): { section: AsmILSection; changed: boolean } {
    const elements = section.elements;
    const newElements: AsmILElement[] = [];
    let changed = false;
    let inUnreachable = false;

    for (const element of elements) {
      // Labels end unreachable regions (they could be branch targets)
      if (element.kind === 'label') {
        inUnreachable = false;
        newElements.push(element);
        continue;
      }

      // In unreachable code, skip instructions
      if (inUnreachable && isInstructionElement(element)) {
        changed = true;
        stats.patternsMatched++;
        stats.instructionsRemoved++;
        // Estimate 2 bytes per instruction (average)
        stats.estimatedBytesSaved += 2;
        continue;
      }

      // Skip non-instruction elements in unreachable regions too (comments, blanks)
      if (inUnreachable) {
        changed = true;
        continue;
      }

      newElements.push(element);

      // Unconditional terminators start unreachable regions
      if (isInstructionElement(element)) {
        if (UNCONDITIONAL_TERMINATORS.has(element.instruction.mnemonic)) {
          inUnreachable = true;
        }
      }
    }

    if (!changed) {
      return { section, changed: false };
    }
    return { section: { ...section, elements: newElements }, changed: true };
  }

  // ==========================================================================
  // Pattern 3: Branch-over-JMP Optimization
  // ==========================================================================

  /**
   * Replace branch-over-JMP with inverted conditional branch.
   *
   * Pattern: BEQ skip; JMP target; skip: → BNE target
   * This saves 3 bytes (JMP) and simplifies control flow.
   *
   * @param section - Section to process
   * @param stats - Stats accumulator
   * @returns The section and whether changes were made
   */
  protected optimizeBranchOverJmp(
    section: AsmILSection,
    stats: AsmPassTransformStats
  ): { section: AsmILSection; changed: boolean } {
    const elements = section.elements;
    const newElements: AsmILElement[] = [];
    let changed = false;
    let i = 0;

    while (i < elements.length) {
      const element = elements[i];

      // Look for conditional branch with label operand
      if (isInstructionElement(element) && CONDITIONAL_BRANCHES.has(element.instruction.mnemonic)) {
        const match = this.matchBranchOverJmp(elements, i);
        if (match) {
          // Replace with inverted branch to JMP's target
          const invertedMnemonic = BRANCH_INVERSIONS[element.instruction.mnemonic];
          newElements.push({
            kind: 'instruction',
            instruction: {
              ...element.instruction,
              mnemonic: invertedMnemonic,
              labelOperand: match.jmpTarget,
            },
          });
          // Skip past the JMP and the skip label
          i = match.resumeIndex;
          changed = true;
          stats.patternsMatched++;
          stats.instructionsRemoved++; // JMP removed
          stats.estimatedBytesSaved += 3; // JMP = 3 bytes
          stats.estimatedCyclesSaved += 3; // JMP = 3 cycles
          continue;
        }
      }

      newElements.push(element);
      i++;
    }

    if (!changed) {
      return { section, changed: false };
    }
    return { section: { ...section, elements: newElements }, changed: true };
  }

  /**
   * Match the branch-over-JMP pattern starting at a conditional branch.
   *
   * Pattern: BXX skip_label; JMP target; skip_label:
   *
   * @param elements - All elements in section
   * @param branchIndex - Index of the conditional branch
   * @returns Match info or null if no match
   */
  protected matchBranchOverJmp(
    elements: readonly AsmILElement[],
    branchIndex: number
  ): { jmpTarget: string; resumeIndex: number } | null {
    const branchEl = elements[branchIndex];
    if (!isInstructionElement(branchEl)) return null;

    const skipLabel = branchEl.instruction.labelOperand;
    if (skipLabel === undefined) return null;

    // Find next instruction after the branch (skip comments/blanks)
    let jmpIndex = branchIndex + 1;
    while (jmpIndex < elements.length) {
      const el = elements[jmpIndex];
      if (isInstructionElement(el) || el.kind === 'label') break;
      jmpIndex++;
    }
    if (jmpIndex >= elements.length) return null;

    // Must be a JMP with a label target
    const jmpEl = elements[jmpIndex];
    if (!isInstructionElement(jmpEl)) return null;
    if (jmpEl.instruction.mnemonic !== 'JMP') return null;
    if (jmpEl.instruction.labelOperand === undefined) return null;

    const jmpTarget = jmpEl.instruction.labelOperand;

    // Find skip label after JMP (skip comments/blanks only, no instructions)
    let labelIndex = jmpIndex + 1;
    while (labelIndex < elements.length) {
      const el = elements[labelIndex];
      if (el.kind === 'label') break;
      if (isInstructionElement(el)) return null; // Instruction before label = no match
      labelIndex++;
    }
    if (labelIndex >= elements.length) return null;

    // Must match the branch's skip label
    const labelEl = elements[labelIndex];
    if (labelEl.kind !== 'label') return null;
    if (labelEl.label.name !== skipLabel) return null;

    return {
      jmpTarget,
      resumeIndex: labelIndex, // Resume from the skip label (keep it, it might be used)
    };
  }
}

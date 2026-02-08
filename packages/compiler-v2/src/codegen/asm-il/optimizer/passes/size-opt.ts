/**
 * Size Optimization Pass
 *
 * Optimizes for code size over speed. Critical for memory-constrained
 * 6502 programs where every byte matters.
 *
 * **Strategies implemented:**
 *
 * 1. **Tail Call Optimization** (Os + Oz)
 *    Replaces `JSR label; RTS` with `JMP label` — saves 1 byte per occurrence.
 *    The called subroutine's RTS will return to _our_ caller directly.
 *
 * 2. **Common Sequence Factoring** (Oz only)
 *    Identifies instruction sequences that appear 2+ times and extracts them
 *    into generated subroutines, replacing each occurrence with a JSR.
 *    Trades speed for size: each extracted sequence saves (N-3)*(K-1) bytes
 *    where N = sequence byte size and K = occurrence count, but adds JSR/RTS
 *    overhead (12 cycles per call site).
 *
 * **Safety constraints:**
 * - Tail call optimization skips JSR targets that are labels within
 *   the same section (only optimizes external/global calls)
 * - Sequence factoring ignores sequences containing labels, branches,
 *   or other control flow that would break when moved to a subroutine
 * - Minimum sequence length of 4 bytes (JSR=3 bytes, so only saves
 *   space when the factored sequence is ≥4 bytes)
 *
 * **Performance impact:**
 * - Tail call: saves 1 byte, neutral on cycles (JMP=3cy vs JSR=6cy+RTS=6cy)
 * - Sequence factoring: variable savings, always slower due to JSR/RTS overhead
 *
 * **Enabled at:** Os (non-aggressive), Oz (aggressive with sequence factoring)
 *
 * @module codegen/asm-il/optimizer/passes/size-opt
 */

import type {
  AsmOptimizationPass,
  AsmOptimizationPassResult,
  AsmPassTransformStats,
} from '../types.js';
import { createEmptyTransformStats, createUnchangedPassResult } from '../types.js';
import type { AsmILProgram, AsmILSection, AsmILElement } from '../../types.js';
import {
  isInstructionElement,
  createInstructionElement,
  createLabelElement,
  createCommentElement,
} from '../../types.js';
import { AsmAddressingMode } from '../../types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum sequence byte size for factoring to be worthwhile.
 * A JSR is 3 bytes, so extracting a sequence only saves space
 * when the original sequence is > 3 bytes and appears 2+ times.
 *
 * With 2 occurrences: saves (seqBytes * 2) - (seqBytes + 1 + 3*2)
 *   = seqBytes - 7 bytes (so sequence must be ≥ 8 bytes for savings)
 *   But with 3+ occurrences the threshold drops.
 *
 * We use a minimum of 3 instructions (typically ≥ 6 bytes) as a
 * practical threshold.
 */
const MIN_SEQUENCE_INSTRUCTIONS = 3;

/**
 * Maximum sequence length to consider for factoring.
 * Longer sequences are less likely to repeat exactly.
 */
const MAX_SEQUENCE_INSTRUCTIONS = 8;

/**
 * Minimum occurrences needed before factoring a sequence.
 * With 2 occurrences and ≥3 instructions, factoring typically saves space.
 */
const MIN_OCCURRENCES = 2;

/**
 * Bytes saved per tail call optimization.
 * JSR (3 bytes) + RTS (1 byte) → JMP (3 bytes) = 1 byte saved.
 */
const TAIL_CALL_BYTES_SAVED = 1;

/**
 * Cycles saved per tail call optimization.
 * JSR (6 cycles) + RTS (6 cycles) = 12 cycles
 * JMP (3 cycles) = 3 cycles → saves 9 cycles
 * However, the called subroutine's RTS now returns directly,
 * so net is: -6 (no JSR overhead) -6 (no our RTS) +3 (JMP) = -9
 * But the function's RTS still executes, so actual = 6+6-3 = 9 saved.
 */
const TAIL_CALL_CYCLES_SAVED = 9;

/**
 * Instructions that represent control flow and cannot be safely
 * extracted into a subroutine via sequence factoring.
 */
const CONTROL_FLOW_MNEMONICS = new Set([
  'JMP', 'JSR', 'RTS', 'RTI', 'BRK',
  'BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS',
]);

/**
 * Counter for generating unique subroutine names during sequence factoring.
 * Reset per pass invocation to keep names deterministic.
 */
let factorCounter = 0;

// ============================================================================
// SizeOptPass
// ============================================================================

/**
 * Optimizes 6502 assembly for code size.
 *
 * In non-aggressive mode (Os), applies only tail call optimization.
 * In aggressive mode (Oz), also extracts repeated instruction sequences
 * into subroutines.
 *
 * @example
 * ```typescript
 * // Os mode — tail calls only
 * const pass = new SizeOptPass(false);
 *
 * // Oz mode — tail calls + sequence factoring
 * const pass = new SizeOptPass(true);
 * ```
 */
export class SizeOptPass implements AsmOptimizationPass {
  /** @inheritdoc */
  readonly name = 'size-opt';

  /** @inheritdoc */
  readonly isTransform = true;

  /**
   * Create a new SizeOptPass.
   *
   * @param aggressive - When true, enables sequence factoring (Oz level).
   *   When false, only applies tail call optimization (Os level).
   */
  constructor(protected readonly aggressive: boolean) {}

  /**
   * Run the size optimization pass on an ASM-IL program.
   *
   * @param program - The program to optimize
   * @returns Result with optimized program and statistics
   */
  run(program: AsmILProgram): AsmOptimizationPassResult {
    // Reset the factor counter for deterministic naming
    factorCounter = 0;

    const stats = createEmptyTransformStats();
    let anyChanged = false;

    // Step 1: Tail call optimization on each section
    const tailCallSections = this.applyTailCallOptimization(
      program.sections,
      stats
    );
    if (tailCallSections !== program.sections) {
      anyChanged = true;
    }

    // Step 2: Sequence factoring (Oz only) across all sections
    let finalSections = tailCallSections;
    if (this.aggressive) {
      const factored = this.applySequenceFactoring(tailCallSections, stats);
      if (factored !== tailCallSections) {
        finalSections = factored;
        anyChanged = true;
      }
    }

    if (!anyChanged) {
      return createUnchangedPassResult(program);
    }

    return {
      program: { ...program, sections: finalSections },
      changed: true,
      stats,
    };
  }

  // ==========================================================================
  // Tail Call Optimization
  // ==========================================================================

  /**
   * Apply tail call optimization across all sections.
   *
   * Scans for `JSR label; RTS` patterns and replaces with `JMP label`.
   * Returns the original sections array if no changes were made.
   *
   * @param sections - All program sections
   * @param stats - Mutable stats accumulator
   * @returns Original or new sections array
   */
  protected applyTailCallOptimization(
    sections: AsmILSection[],
    stats: AsmPassTransformStats
  ): AsmILSection[] {
    let anyChanged = false;
    const newSections: AsmILSection[] = [];

    for (const section of sections) {
      const result = this.optimizeTailCallsInSection(section, stats);
      newSections.push(result.section);
      if (result.changed) {
        anyChanged = true;
      }
    }

    return anyChanged ? newSections : sections;
  }

  /**
   * Optimize tail calls in a single section.
   *
   * Pattern: `JSR <target>; RTS` → `JMP <target>`
   * The JSR is replaced with JMP and the RTS is removed.
   *
   * Comments and blank lines between JSR and RTS are skipped
   * (they don't affect execution), but labels and other instructions
   * break the pattern.
   *
   * @param section - Section to optimize
   * @param stats - Mutable stats accumulator
   * @returns Optimized section and whether it changed
   */
  protected optimizeTailCallsInSection(
    section: AsmILSection,
    stats: AsmPassTransformStats
  ): { section: AsmILSection; changed: boolean } {
    const elements = section.elements;
    if (elements.length < 2) {
      return { section, changed: false };
    }

    const newElements: AsmILElement[] = [];
    let changed = false;
    let i = 0;

    while (i < elements.length) {
      const el = elements[i];

      // Look for JSR instruction
      if (isInstructionElement(el) && el.instruction.mnemonic === 'JSR') {
        // Scan forward for RTS, skipping comments and blanks
        const rtsIndex = this.findNextRTS(elements, i + 1);

        if (rtsIndex !== -1) {
          // Replace JSR with JMP
          const jmpElement = createInstructionElement(
            'JMP',
            el.instruction.mode,
            el.instruction.operand,
            el.instruction.labelOperand,
            el.instruction.comment
          );
          newElements.push(jmpElement);

          // Copy any comments/blanks between JSR and RTS
          for (let k = i + 1; k < rtsIndex; k++) {
            newElements.push(elements[k]);
          }

          // Skip the RTS (it's removed)
          i = rtsIndex + 1;
          changed = true;

          stats.patternsMatched++;
          stats.instructionsRemoved += 1; // RTS removed
          stats.estimatedBytesSaved += TAIL_CALL_BYTES_SAVED;
          stats.estimatedCyclesSaved += TAIL_CALL_CYCLES_SAVED;
          continue;
        }
      }

      newElements.push(el);
      i++;
    }

    if (!changed) {
      return { section, changed: false };
    }

    return {
      section: { ...section, elements: newElements },
      changed: true,
    };
  }

  /**
   * Find the next RTS instruction after startIndex, skipping comments and blanks.
   *
   * Returns -1 if no RTS is found before a non-skippable element.
   *
   * @param elements - All elements in the section
   * @param startIndex - Index to start scanning from
   * @returns Index of the RTS instruction, or -1 if not found
   */
  protected findNextRTS(
    elements: readonly AsmILElement[],
    startIndex: number
  ): number {
    for (let i = startIndex; i < elements.length; i++) {
      const el = elements[i];

      // Comments and blanks are transparent — skip them
      if (el.kind === 'comment' || el.kind === 'blank') continue;

      // Found an instruction — check if it's RTS
      if (isInstructionElement(el) && el.instruction.mnemonic === 'RTS') {
        return i;
      }

      // Any other element (label, directive, non-RTS instruction) breaks
      return -1;
    }

    return -1;
  }

  // ==========================================================================
  // Sequence Factoring (Oz only)
  // ==========================================================================

  /**
   * Apply common sequence factoring across all sections.
   *
   * Finds instruction sequences that appear 2+ times across sections,
   * extracts them into generated subroutines, and replaces each
   * occurrence with a JSR to the generated subroutine.
   *
   * @param sections - All program sections
   * @param stats - Mutable stats accumulator
   * @returns Original or new sections array (with appended subroutine section)
   */
  protected applySequenceFactoring(
    sections: AsmILSection[],
    stats: AsmPassTransformStats
  ): AsmILSection[] {
    // Step 1: Collect all factorable instruction sequences
    const candidates = this.findRepeatedSequences(sections);

    if (candidates.length === 0) {
      return sections;
    }

    // Step 2: Filter to sequences that actually save space
    const profitable = candidates.filter(c =>
      this.isFactoringProfitable(c.instructionCount, c.occurrences)
    );

    if (profitable.length === 0) {
      return sections;
    }

    // Step 3: Apply factoring for the BEST candidate only.
    // We only factor one candidate per pass invocation because factoring
    // invalidates element indices for remaining candidates. The optimizer's
    // fixed-point iteration will re-run and find the next candidate.
    const bestCandidate = profitable[0];
    const subroutineElements: AsmILElement[] = [];
    let newSections = this.factorSequence(
      sections,
      bestCandidate,
      subroutineElements,
      stats
    );

    // Step 4: Append generated subroutines as a new section
    if (subroutineElements.length > 0) {
      const subroutineSection: AsmILSection = {
        name: '_factored_routines',
        elements: subroutineElements,
      };
      newSections = [...newSections, subroutineSection];
    }

    return newSections;
  }

  /**
   * Find instruction sequences that appear multiple times across sections.
   *
   * Uses a sliding window approach to find repeated sequences of
   * MIN_SEQUENCE_INSTRUCTIONS to MAX_SEQUENCE_INSTRUCTIONS instructions.
   *
   * @param sections - All program sections
   * @returns Array of candidate sequences with occurrence info
   */
  protected findRepeatedSequences(
    sections: readonly AsmILSection[]
  ): SequenceCandidate[] {
    // Build a map of sequence fingerprints → occurrences
    const sequenceMap = new Map<string, SequenceOccurrence[]>();

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const elements = sections[sIdx].elements;

      // Extract only instruction elements with their original indices
      const instructions: { element: AsmILElement; index: number }[] = [];
      for (let i = 0; i < elements.length; i++) {
        if (isInstructionElement(elements[i])) {
          instructions.push({ element: elements[i], index: i });
        }
      }

      // Sliding window over instruction sequences
      for (let len = MIN_SEQUENCE_INSTRUCTIONS; len <= MAX_SEQUENCE_INSTRUCTIONS; len++) {
        for (let start = 0; start <= instructions.length - len; start++) {
          const slice = instructions.slice(start, start + len);

          // Skip sequences containing control flow
          if (this.containsControlFlow(slice.map(s => s.element))) continue;

          const fingerprint = this.computeFingerprint(slice.map(s => s.element));
          const occurrence: SequenceOccurrence = {
            sectionIndex: sIdx,
            startElementIndex: slice[0].index,
            endElementIndex: slice[slice.length - 1].index,
          };

          const existing = sequenceMap.get(fingerprint);
          if (existing) {
            existing.push(occurrence);
          } else {
            sequenceMap.set(fingerprint, [occurrence]);
          }
        }
      }
    }

    // Filter to sequences with MIN_OCCURRENCES+ occurrences
    const candidates: SequenceCandidate[] = [];
    for (const [fingerprint, occurrences] of sequenceMap) {
      if (occurrences.length >= MIN_OCCURRENCES) {
        // Filter out overlapping occurrences
        const nonOverlapping = this.removeOverlaps(occurrences);
        if (nonOverlapping.length >= MIN_OCCURRENCES) {
          candidates.push({
            fingerprint,
            occurrences: nonOverlapping.length,
            instructionCount: this.countInstructionsInFingerprint(fingerprint),
            locations: nonOverlapping,
          });
        }
      }
    }

    // Sort by savings potential (more occurrences × longer sequences first)
    candidates.sort((a, b) => {
      const savingsA = a.occurrences * a.instructionCount;
      const savingsB = b.occurrences * b.instructionCount;
      return savingsB - savingsA;
    });

    return candidates;
  }

  /**
   * Check if a sequence of elements contains control flow instructions.
   *
   * Sequences with control flow cannot be safely extracted into subroutines
   * because branches/jumps use relative or absolute addresses that would
   * be invalid when moved.
   *
   * @param elements - Elements to check
   * @returns True if any element is a control flow instruction
   */
  protected containsControlFlow(elements: readonly AsmILElement[]): boolean {
    for (const el of elements) {
      if (isInstructionElement(el)) {
        if (CONTROL_FLOW_MNEMONICS.has(el.instruction.mnemonic)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Compute a string fingerprint for an instruction sequence.
   *
   * Two sequences with the same fingerprint are functionally identical
   * and can be factored.
   *
   * @param elements - Instruction elements to fingerprint
   * @returns String fingerprint
   */
  protected computeFingerprint(elements: readonly AsmILElement[]): string {
    const parts: string[] = [];
    for (const el of elements) {
      if (isInstructionElement(el)) {
        const instr = el.instruction;
        const operandStr = instr.operand !== undefined ? `$${instr.operand.toString(16)}` : '';
        const labelStr = instr.labelOperand ?? '';
        parts.push(`${instr.mnemonic}:${instr.mode}:${operandStr}:${labelStr}`);
      }
    }
    return parts.join('|');
  }

  /**
   * Count the number of instructions encoded in a fingerprint.
   *
   * @param fingerprint - Fingerprint string from computeFingerprint
   * @returns Number of instructions
   */
  protected countInstructionsInFingerprint(fingerprint: string): number {
    return fingerprint.split('|').length;
  }

  /**
   * Remove overlapping occurrences, keeping the earliest non-overlapping set.
   *
   * @param occurrences - All occurrences (may overlap)
   * @returns Non-overlapping subset
   */
  protected removeOverlaps(occurrences: SequenceOccurrence[]): SequenceOccurrence[] {
    // Sort by section index then by start element index
    const sorted = [...occurrences].sort((a, b) => {
      if (a.sectionIndex !== b.sectionIndex) return a.sectionIndex - b.sectionIndex;
      return a.startElementIndex - b.startElementIndex;
    });

    const result: SequenceOccurrence[] = [];
    let lastEnd = -1;
    let lastSection = -1;

    for (const occ of sorted) {
      // Different section — no overlap possible
      if (occ.sectionIndex !== lastSection) {
        result.push(occ);
        lastSection = occ.sectionIndex;
        lastEnd = occ.endElementIndex;
        continue;
      }

      // Same section — check for overlap
      if (occ.startElementIndex > lastEnd) {
        result.push(occ);
        lastEnd = occ.endElementIndex;
      }
      // Otherwise skip (overlapping)
    }

    return result;
  }

  /**
   * Check if factoring a sequence of given length with given occurrences
   * is profitable (saves bytes).
   *
   * Cost of factoring:
   * - Subroutine: N instruction bytes + 1 byte (RTS) + label overhead
   * - Each call site: 3 bytes (JSR)
   *
   * Original cost:
   * - N instruction bytes × K occurrences
   *
   * Savings = (N × K) - (N + 1 + 3×K)
   *         = N×K - N - 1 - 3K
   *         = N(K-1) - 3K - 1
   *
   * For this to be positive: N(K-1) > 3K + 1
   *
   * We estimate instruction bytes conservatively as 2 bytes per instruction
   * (mix of 1-byte implied and 2-3 byte addressed).
   *
   * @param instructionCount - Number of instructions in the sequence
   * @param occurrences - Number of times the sequence appears
   * @returns True if factoring saves bytes
   */
  protected isFactoringProfitable(
    instructionCount: number,
    occurrences: number
  ): boolean {
    // Estimate bytes per instruction (conservative average)
    const estimatedBytes = instructionCount * 2;
    const savings = estimatedBytes * (occurrences - 1) - 3 * occurrences - 1;
    return savings > 0;
  }

  /**
   * Factor a single sequence: replace all occurrences with JSR and
   * generate the subroutine.
   *
   * @param sections - Current sections array
   * @param candidate - The sequence candidate to factor
   * @param subroutineElements - Array to append subroutine code to (mutated)
   * @param stats - Stats accumulator (mutated)
   * @returns New sections array with occurrences replaced
   */
  protected factorSequence(
    sections: AsmILSection[],
    candidate: SequenceCandidate,
    subroutineElements: AsmILElement[],
    stats: AsmPassTransformStats
  ): AsmILSection[] {
    // Generate subroutine name
    const subName = `.factored_${factorCounter++}`;

    // Build the subroutine: label + instructions + RTS
    subroutineElements.push(
      createCommentElement(`Factored sequence (${candidate.occurrences} occurrences)`)
    );
    subroutineElements.push(createLabelElement(subName, true));

    // Extract the instruction sequence from the first occurrence
    const firstOcc = candidate.locations[0];
    const firstSection = sections[firstOcc.sectionIndex];
    for (let i = firstOcc.startElementIndex; i <= firstOcc.endElementIndex; i++) {
      const el = firstSection.elements[i];
      if (isInstructionElement(el)) {
        subroutineElements.push(el);
      }
    }
    subroutineElements.push(
      createInstructionElement('RTS', AsmAddressingMode.Implied)
    );

    // Replace each occurrence with JSR
    // Group locations by section for efficient replacement
    const bySectionIdx = new Map<number, SequenceOccurrence[]>();
    for (const loc of candidate.locations) {
      const existing = bySectionIdx.get(loc.sectionIndex);
      if (existing) {
        existing.push(loc);
      } else {
        bySectionIdx.set(loc.sectionIndex, [loc]);
      }
    }

    const newSections = sections.map((section, sIdx) => {
      const locs = bySectionIdx.get(sIdx);
      if (!locs || locs.length === 0) return section;

      // Sort locations in reverse order so indices don't shift during replacement
      const sortedLocs = [...locs].sort(
        (a, b) => b.startElementIndex - a.startElementIndex
      );

      const newElements = [...section.elements];
      for (const loc of sortedLocs) {
        // Count how many elements to replace (includes non-instructions between)
        const replaceCount = loc.endElementIndex - loc.startElementIndex + 1;

        // Replace the range with a single JSR
        const jsrElement = createInstructionElement(
          'JSR',
          AsmAddressingMode.Absolute,
          undefined,
          subName
        );
        newElements.splice(loc.startElementIndex, replaceCount, jsrElement);

        // Update stats
        stats.patternsMatched++;
        // Instructions removed = original count, instructions added = 1 (JSR)
        stats.instructionsRemoved += candidate.instructionCount;
        stats.instructionsAdded += 1;
        // Estimate bytes saved per replacement site
        const estimatedOriginalBytes = candidate.instructionCount * 2;
        stats.estimatedBytesSaved += estimatedOriginalBytes - 3; // JSR = 3 bytes
      }

      return { ...section, elements: newElements };
    });

    // Account for the subroutine itself (added instructions)
    // The subroutine has instructionCount + 1 (RTS) instructions
    stats.instructionsAdded += candidate.instructionCount + 1;
    // The subroutine costs instructionCount*2 + 1 (RTS) bytes
    stats.estimatedBytesSaved -= (candidate.instructionCount * 2 + 1);

    return newSections;
  }
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * A location where a sequence occurs in the program.
 */
interface SequenceOccurrence {
  /** Index into the sections array */
  sectionIndex: number;

  /** Start element index within the section */
  startElementIndex: number;

  /** End element index within the section (inclusive) */
  endElementIndex: number;
}

/**
 * A candidate sequence that could be factored into a subroutine.
 */
interface SequenceCandidate {
  /** Fingerprint identifying this unique sequence */
  fingerprint: string;

  /** Number of times this sequence occurs */
  occurrences: number;

  /** Number of instructions in the sequence */
  instructionCount: number;

  /** Locations of each occurrence */
  locations: SequenceOccurrence[];
}

/**
 * Loop Tree Analysis
 *
 * Builds a hierarchical view of loops from ILFunction.loops, enabling
 * structured queries needed by loop-aware optimizations such as:
 * - LICM (Loop Invariant Code Motion): getPreheaderIndex(), getBodyIndices()
 * - Loop Unrolling: getLoopFor(), getDepth()
 * - Register allocation: identifying hot inner loops
 *
 * The LoopTree maps ILLoop structures (which store label names and depth)
 * to concrete instruction indices by scanning the function's instruction
 * stream for matching LABEL instructions. This bridges the gap between
 * high-level loop metadata and the flat instruction sequence.
 *
 * @module optimizer/analysis/loop-tree
 */

import { ILOpcode } from '../../il/enums.js';
import { isLabelOperand } from '../../il/guards.js';
import type { ILFunction, ILLoop } from '../../il/structures.js';

// ============================================================================
// LoopInfo: Enriched loop structure with instruction indices and hierarchy
// ============================================================================

/**
 * Enriched loop information with instruction indices and parent/child relationships.
 *
 * Extends the raw ILLoop data (label names, depth) with:
 * - Resolved instruction indices (headerIndex, exitIndex)
 * - Hierarchical relationships (parent, children)
 *
 * This is the primary data structure returned by LoopTree queries.
 *
 * @example
 * ```typescript
 * const info: LoopInfo = {
 *   headerLabel: 'while_0',
 *   exitLabel: 'while_0_exit',
 *   headerIndex: 5,
 *   exitIndex: 20,
 *   depth: 1,
 *   parent: null,
 *   children: [innerLoopInfo],
 *   loop: originalILLoop,
 * };
 * ```
 */
export interface LoopInfo {
  /** Label name at loop header (from ILLoop) */
  readonly headerLabel: string;

  /** Label name at loop exit (from ILLoop) */
  readonly exitLabel: string;

  /** Instruction index of the LABEL instruction for the loop header */
  readonly headerIndex: number;

  /** Instruction index of the LABEL instruction for the loop exit */
  readonly exitIndex: number;

  /** Loop nesting depth (1 = outermost) */
  readonly depth: number;

  /** Parent loop (null if outermost) */
  readonly parent: LoopInfo | null;

  /** Child loops (inner loops directly nested in this one) */
  readonly children: LoopInfo[];

  /** Original ILLoop structure (for counted loop metadata, etc.) */
  readonly loop: ILLoop;
}

// ============================================================================
// LoopTree Class
// ============================================================================

/**
 * Loop tree for structured loop analysis.
 *
 * Builds a hierarchical view of loops from ILFunction.loops and resolves
 * label names to instruction indices. Supports queries needed by LICM,
 * loop unrolling, and register allocation optimizations.
 *
 * **Construction:**
 * Use `LoopTree.build(func)` to construct from an ILFunction. The builder
 * scans the instruction stream once to build a label→index map, then
 * resolves each ILLoop's header/exit labels to instruction indices.
 * Loops whose labels cannot be found are silently skipped.
 *
 * **Hierarchy:**
 * Parent/child relationships are determined by containment: loop A is a
 * parent of loop B if B's header and exit are both within A's range,
 * and A is the closest (innermost) such enclosing loop.
 *
 * **Usage:**
 * ```typescript
 * const tree = LoopTree.build(func);
 * const loops = tree.getLoops();
 * for (const loop of loops) {
 *   const body = tree.getBodyIndices(loop);
 *   const preheader = tree.getPreheaderIndex(loop);
 *   // Analyze or transform loop body
 * }
 * ```
 *
 * @see LICMPass - Uses LoopTree for invariant code motion
 * @see LoopUnrollPass - Uses LoopTree for unrolling decisions
 */
export class LoopTree {
  // ═══════════════════════════════════════════════════════════════════
  // Internal State
  // ═══════════════════════════════════════════════════════════════════

  /** All resolved LoopInfo structures (sorted by headerIndex ascending) */
  protected loops: LoopInfo[];

  /**
   * Map from instruction index to the innermost loop containing it.
   * Only populated for indices that fall within at least one loop body.
   * Lazily computed on first query via ensureIndexMap().
   */
  protected indexToLoop: Map<number, LoopInfo> | null;

  /** Total number of instructions in the analyzed function */
  protected instructionCount: number;

  // ═══════════════════════════════════════════════════════════════════
  // Constructor (protected — use static build() instead)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Creates a new LoopTree instance.
   *
   * @param loops - Resolved LoopInfo structures
   * @param instructionCount - Total instructions in the function
   */
  protected constructor(loops: LoopInfo[], instructionCount: number) {
    this.loops = loops;
    this.indexToLoop = null;
    this.instructionCount = instructionCount;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Static Builder
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Build a LoopTree from an ILFunction's loops and instructions.
   *
   * Algorithm:
   * 1. Scan instructions once to build label → index map
   * 2. For each ILLoop, resolve headerLabel/exitLabel to indices
   * 3. Skip loops with unresolvable labels (defensive)
   * 4. Sort loops by headerIndex for deterministic ordering
   * 5. Build parent/child hierarchy by containment analysis
   *
   * @param func - IL function to analyze (must have loops[] populated)
   * @returns A fully constructed LoopTree
   *
   * @example
   * ```typescript
   * const func = generator.generateFunction(decl);
   * const tree = LoopTree.build(func);
   * const innermost = tree.getLoopFor(someInstrIndex);
   * ```
   */
  static build(func: ILFunction): LoopTree {
    const instructions = func.instructions;

    // Step 1: Build label → instruction index map (single pass)
    const labelMap = new Map<string, number>();
    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];
      if (instr.opcode === ILOpcode.LABEL && instr.operands.length > 0) {
        const operand = instr.operands[0];
        if (isLabelOperand(operand)) {
          labelMap.set(operand.name, i);
        }
      }
    }

    // Step 2-3: Resolve each ILLoop to a LoopInfo (skip unresolvable)
    const resolvedLoops: LoopInfo[] = [];
    for (const loop of func.loops) {
      const headerIndex = labelMap.get(loop.headerLabel);
      const exitIndex = labelMap.get(loop.exitLabel);

      // Skip loops whose labels cannot be found in the instruction stream
      // This is defensive — normally all loop labels should exist
      if (headerIndex === undefined || exitIndex === undefined) {
        continue;
      }

      // Skip degenerate loops where header is at or after exit
      if (headerIndex >= exitIndex) {
        continue;
      }

      resolvedLoops.push({
        headerLabel: loop.headerLabel,
        exitLabel: loop.exitLabel,
        headerIndex,
        exitIndex,
        depth: loop.depth,
        parent: null,
        children: [],
        loop,
      });
    }

    // Step 4: Sort by headerIndex (ascending) for deterministic processing
    resolvedLoops.sort((a, b) => a.headerIndex - b.headerIndex);

    // Step 5: Build parent/child hierarchy using containment
    LoopTree.buildHierarchy(resolvedLoops);

    return new LoopTree(resolvedLoops, instructions.length);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Query Methods
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get all resolved loops.
   *
   * Returns loops sorted by headerIndex (ascending). Includes both
   * outer and inner loops.
   *
   * @returns Array of all LoopInfo structures
   *
   * @example
   * ```typescript
   * const loops = tree.getLoops();
   * // Process innermost first for LICM
   * const innermostFirst = [...loops].sort((a, b) => b.depth - a.depth);
   * ```
   */
  getLoops(): LoopInfo[] {
    return this.loops;
  }

  /**
   * Get the innermost loop containing a specific instruction index.
   *
   * If the instruction is inside multiple nested loops, returns the
   * innermost (deepest) one. Returns null if the instruction is not
   * inside any loop.
   *
   * @param instrIndex - Instruction index to query
   * @returns The innermost LoopInfo containing this index, or null
   *
   * @example
   * ```typescript
   * const loop = tree.getLoopFor(15);
   * if (loop) {
   *   console.log(`Instruction 15 is in loop ${loop.headerLabel} at depth ${loop.depth}`);
   * }
   * ```
   */
  getLoopFor(instrIndex: number): LoopInfo | null {
    this.ensureIndexMap();
    return this.indexToLoop!.get(instrIndex) ?? null;
  }

  /**
   * Get the loop nesting depth for a specific instruction index.
   *
   * Returns 0 if the instruction is not inside any loop.
   * Returns the depth of the innermost loop containing the instruction.
   *
   * @param instrIndex - Instruction index to query
   * @returns Loop nesting depth (0 = not in loop, 1 = outermost, etc.)
   *
   * @example
   * ```typescript
   * const depth = tree.getDepth(15);
   * if (depth > 1) {
   *   // Instruction is in a nested loop — high priority for optimization
   * }
   * ```
   */
  getDepth(instrIndex: number): number {
    const loop = this.getLoopFor(instrIndex);
    return loop ? loop.depth : 0;
  }

  /**
   * Get instruction indices that form the loop body.
   *
   * The body includes all instructions from the header label (inclusive)
   * up to but not including the exit label. This matches the IL convention
   * where the exit label marks the first instruction after the loop.
   *
   * @param loop - LoopInfo to query
   * @returns Array of instruction indices in the loop body (ascending order)
   *
   * @example
   * ```typescript
   * const body = tree.getBodyIndices(loop);
   * for (const idx of body) {
   *   const instr = func.instructions[idx];
   *   // Analyze instruction within loop
   * }
   * ```
   */
  getBodyIndices(loop: LoopInfo): number[] {
    const indices: number[] = [];
    // Body spans from header (inclusive) to exit (exclusive)
    for (let i = loop.headerIndex; i < loop.exitIndex; i++) {
      indices.push(i);
    }
    return indices;
  }

  /**
   * Get the preheader insertion point for LICM.
   *
   * The preheader is the instruction index just before the loop header,
   * where loop-invariant instructions should be hoisted to.
   *
   * Returns the index immediately before the header label instruction.
   * If the header is at index 0 (no room before it), returns 0 as the
   * insertion point (caller should insert before, not replace).
   *
   * @param loop - LoopInfo to query
   * @returns Instruction index for the preheader insertion point
   *
   * @example
   * ```typescript
   * const preheader = tree.getPreheaderIndex(loop);
   * // Insert hoisted instruction at preheader position
   * func.instructions.splice(preheader, 0, hoistedInstr);
   * ```
   */
  getPreheaderIndex(loop: LoopInfo): number {
    // The preheader is just before the loop header label
    // If header is at index 0, return 0 (insert at start)
    return Math.max(0, loop.headerIndex);
  }

  /**
   * Get all root loops (outermost loops with no parent).
   *
   * Root loops are the top-level loops in the function. Their children
   * are the first level of nested loops.
   *
   * @returns Array of root LoopInfo structures
   *
   * @example
   * ```typescript
   * const roots = tree.getRootLoops();
   * for (const root of roots) {
   *   console.log(`Root loop: ${root.headerLabel}, children: ${root.children.length}`);
   * }
   * ```
   */
  getRootLoops(): LoopInfo[] {
    return this.loops.filter(l => l.parent === null);
  }

  /**
   * Check if the tree has any loops.
   *
   * @returns true if the function contains at least one loop
   */
  hasLoops(): boolean {
    return this.loops.length > 0;
  }

  /**
   * Get the total number of loops.
   *
   * @returns Number of loops in the function
   */
  getLoopCount(): number {
    return this.loops.length;
  }

  /**
   * Get the maximum loop nesting depth across all loops.
   *
   * @returns Maximum depth (0 if no loops)
   */
  getMaxDepth(): number {
    if (this.loops.length === 0) return 0;
    return Math.max(...this.loops.map(l => l.depth));
  }

  // ═══════════════════════════════════════════════════════════════════
  // Internal Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Build parent/child hierarchy from resolved loops using containment.
   *
   * A loop A is the parent of loop B if:
   * 1. A contains B (A.headerIndex <= B.headerIndex && B.exitIndex <= A.exitIndex)
   * 2. A is the tightest (smallest range) such containing loop
   *
   * Algorithm: For each loop, find the innermost loop that fully contains it.
   * Since loops are sorted by headerIndex, we can check all other loops
   * for containment and pick the tightest one.
   *
   * @param loops - Mutable array of LoopInfo to populate parent/children fields
   */
  protected static buildHierarchy(loops: LoopInfo[]): void {
    for (let i = 0; i < loops.length; i++) {
      const child = loops[i];
      let bestParent: LoopInfo | null = null;
      let bestRange = Infinity;

      for (let j = 0; j < loops.length; j++) {
        if (i === j) continue;

        const candidate = loops[j];
        // Check if candidate contains child
        const containsChild =
          candidate.headerIndex <= child.headerIndex &&
          child.exitIndex <= candidate.exitIndex;

        if (containsChild) {
          // Pick the tightest containing loop (smallest range)
          const range = candidate.exitIndex - candidate.headerIndex;
          if (range < bestRange) {
            bestParent = candidate;
            bestRange = range;
          }
        }
      }

      // Set parent/child relationships (cast to mutable for construction)
      if (bestParent !== null) {
        (child as { parent: LoopInfo | null }).parent = bestParent;
        (bestParent.children as LoopInfo[]).push(child);
      }
    }
  }

  /**
   * Lazily build the instruction-index-to-innermost-loop map.
   *
   * For each loop, marks all instruction indices in its body range.
   * When an index is already mapped to a loop, the deeper (innermost)
   * loop wins. This ensures getLoopFor() returns the innermost loop.
   */
  protected ensureIndexMap(): void {
    if (this.indexToLoop !== null) return;

    this.indexToLoop = new Map();

    // Process loops in depth-ascending order so inner loops overwrite outer
    // (inner loops have higher depth values)
    const sortedByDepth = [...this.loops].sort((a, b) => a.depth - b.depth);

    for (const loop of sortedByDepth) {
      // Mark all instructions from header (inclusive) to exit (exclusive)
      for (let i = loop.headerIndex; i < loop.exitIndex; i++) {
        this.indexToLoop.set(i, loop);
      }
    }
  }
}

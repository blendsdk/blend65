/**
 * Phi Function Placement for SSA Construction
 *
 * This module handles phi function placement, which determines where phi
 * functions need to be inserted during SSA construction. Phi functions
 * are placed at dominance frontiers of variable definition blocks.
 *
 * **Key Concept:**
 * ```
 * For each variable V:
 *   WorkList = {blocks where V is defined}
 *   While WorkList not empty:
 *     B = WorkList.pop()
 *     For each block F in DF(B):
 *       If phi for V not at F:
 *         Place phi for V at F
 *         Add F to WorkList (phi creates new def)
 * ```
 *
 * **Why Phi Functions Are Needed:**
 * - Multiple definitions of a variable may reach a join point
 * - Phi function selects the correct version based on control flow
 * - SSA requires each variable to have exactly one definition
 * - Phi functions provide that single definition at merge points
 *
 * **Example:**
 * ```
 *     entry
 *       |
 *     [x = 0]  (block 1)
 *       |
 *     cond
 *      / \
 *   [x=1]  [x=2]   (blocks 2, 3)
 *     \    /
 *      join   <-- phi(x) needed here
 *       |
 *     [use x]  (block 4)
 * ```
 *
 * At the join point, we don't know which path was taken, so we need:
 * `x.3 = phi(x.1, x.2)` to select the correct version.
 *
 * @module il/ssa/phi
 */

import type { ILFunction } from '../function.js';
import type { DominanceFrontier } from './frontiers.js';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Information about where a variable is defined in the CFG.
 *
 * This tracks which blocks contain assignments to a variable,
 * used as input to the phi placement algorithm.
 */
export interface VariableDefInfo {
  /**
   * The variable name (original, non-SSA name).
   * For example: "x", "counter", "result"
   */
  variable: string;

  /**
   * Set of block IDs where this variable is assigned/defined.
   * Each block in this set contains at least one assignment to the variable.
   */
  defBlocks: Set<number>;
}

/**
 * Information about phi function placement for a single variable.
 *
 * After the phi placement algorithm runs, this structure describes
 * where phi functions need to be inserted for a specific variable.
 *
 * **Properties:**
 * - `variable`: The original variable name (not SSA-renamed)
 * - `phiBlocks`: Blocks where phi functions must be placed
 * - `defBlocks`: Original definition blocks (for reference)
 *
 * @example
 * ```typescript
 * // After phi placement for variable "x":
 * const info: PhiPlacementInfo = {
 *   variable: 'x',
 *   phiBlocks: new Set([4]),    // Phi needed at block 4 (join point)
 *   defBlocks: new Set([1, 2, 3]) // x defined in blocks 1, 2, 3
 * };
 * ```
 */
export interface PhiPlacementInfo {
  /**
   * The variable name (original, non-SSA name).
   * This is the base name before SSA versioning (e.g., "x" not "x.1").
   */
  variable: string;

  /**
   * Set of block IDs where phi functions are needed for this variable.
   *
   * A phi function is needed at block B if:
   * - B is in the iterated dominance frontier (DF+) of the def blocks
   * - Multiple reaching definitions of the variable converge at B
   */
  phiBlocks: Set<number>;

  /**
   * Set of block IDs where this variable has original definitions.
   *
   * These are the blocks that contain explicit assignments to the variable
   * (not phi functions, which are implicit definitions added by SSA).
   */
  defBlocks: Set<number>;
}

/**
 * Result of the phi placement algorithm.
 *
 * Contains phi placement information for all variables in the function,
 * organized by block ID for efficient lookup during phi insertion.
 */
export interface PhiPlacementResult {
  /**
   * Map from variable name to its phi placement info.
   * Key: variable name (e.g., "x")
   * Value: PhiPlacementInfo for that variable
   */
  byVariable: Map<string, PhiPlacementInfo>;

  /**
   * Map from block ID to list of variables needing phi functions at that block.
   * Key: block ID
   * Value: Array of variable names that need phi functions at this block
   *
   * This is an inverted view of the same data for efficient block-centric access.
   */
  byBlock: Map<number, string[]>;

  /**
   * Total number of phi functions that need to be placed.
   */
  totalPhiCount: number;

  /**
   * Statistics about the phi placement process.
   */
  stats: PhiPlacementStats;
}

/**
 * Statistics about the phi placement process.
 *
 * Useful for debugging, optimization analysis, and understanding
 * the structure of the SSA form being constructed.
 */
export interface PhiPlacementStats {
  /**
   * Number of variables analyzed.
   */
  variableCount: number;

  /**
   * Number of blocks with at least one phi function.
   */
  blocksWithPhis: number;

  /**
   * Total number of phi functions placed.
   */
  totalPhiCount: number;

  /**
   * Maximum number of phi functions at any single block.
   */
  maxPhisPerBlock: number;

  /**
   * Number of iterations needed for the worklist algorithm to converge.
   */
  iterations: number;
}

// =============================================================================
// PhiPlacer Class
// =============================================================================

/**
 * Places phi functions at dominance frontiers during SSA construction.
 *
 * This class implements the standard phi placement algorithm that uses
 * dominance frontiers to determine where phi functions are needed.
 *
 * **Algorithm Overview:**
 * 1. For each variable, collect all definition blocks
 * 2. Compute iterated dominance frontier (DF+) of definition blocks
 * 3. Place phi functions at each block in DF+
 * 4. Note: Phi placement creates new definitions, requiring iteration
 *
 * **Usage:**
 * ```typescript
 * // Setup
 * const domTree = computeDominators(func);
 * const frontiers = computeFrontiers(func, domTree);
 *
 * // Create phi placer and collect variable definitions
 * const placer = new PhiPlacer(frontiers);
 *
 * // Register variable definitions
 * placer.addVariableDef('x', 1);  // x defined in block 1
 * placer.addVariableDef('x', 2);  // x also defined in block 2
 * placer.addVariableDef('y', 1);  // y defined in block 1
 *
 * // Place phi functions
 * const result = placer.placePhiFunctions(func);
 *
 * // Use results
 * for (const [blockId, variables] of result.byBlock) {
 *   console.log(`Block ${blockId} needs phi for: ${variables.join(', ')}`);
 * }
 * ```
 *
 * **Key Insights:**
 * - Phi functions are placed at join points where definitions converge
 * - The iterated frontier (DF+) accounts for phi definitions creating new defs
 * - Variables only defined once (and no phi) don't need phi functions
 *
 * @see DominanceFrontier - Computes where definitions "meet"
 * @see computeIteratedFrontier - Handles phi-creates-def iteration
 */
export class PhiPlacer {
  /**
   * Reference to the dominance frontier information.
   */
  protected readonly frontiers: DominanceFrontier;

  /**
   * Map of variable names to their definition blocks.
   * Built up by calling addVariableDef() before placement.
   */
  protected readonly variableDefs: Map<string, Set<number>>;

  /**
   * Whether phi placement has been computed.
   * Once computed, no more variable definitions can be added.
   */
  protected computed: boolean;

  /**
   * Cached result of phi placement computation.
   */
  protected result: PhiPlacementResult | null;

  /**
   * Creates a new PhiPlacer instance.
   *
   * @param frontiers - Pre-computed dominance frontiers for the CFG
   *
   * @example
   * ```typescript
   * const domTree = computeDominators(func);
   * const frontiers = computeFrontiers(func, domTree);
   * const placer = new PhiPlacer(frontiers);
   * ```
   */
  constructor(frontiers: DominanceFrontier) {
    this.frontiers = frontiers;
    this.variableDefs = new Map();
    this.computed = false;
    this.result = null;
  }

  // ===========================================================================
  // Variable Definition Registration
  // ===========================================================================

  /**
   * Registers a variable definition in a specific block.
   *
   * Call this method for each variable assignment found in the function.
   * Multiple calls with the same variable name accumulate definition blocks.
   *
   * @param variable - The variable name (non-SSA, e.g., "x")
   * @param blockId - The block ID where the variable is defined
   * @throws Error if phi placement has already been computed
   *
   * @example
   * ```typescript
   * placer.addVariableDef('counter', 0);  // counter = 0 in entry
   * placer.addVariableDef('counter', 3);  // counter += 1 in loop body
   * ```
   */
  addVariableDef(variable: string, blockId: number): void {
    if (this.computed) {
      throw new Error('Cannot add variable definitions after phi placement is computed');
    }

    let defBlocks = this.variableDefs.get(variable);
    if (!defBlocks) {
      defBlocks = new Set();
      this.variableDefs.set(variable, defBlocks);
    }
    defBlocks.add(blockId);
  }

  /**
   * Registers multiple variable definitions at once.
   *
   * Convenience method for adding definitions from an array of info objects.
   *
   * @param defs - Array of variable definition info objects
   * @throws Error if phi placement has already been computed
   *
   * @example
   * ```typescript
   * placer.addVariableDefs([
   *   { variable: 'x', defBlocks: new Set([1, 2]) },
   *   { variable: 'y', defBlocks: new Set([1]) }
   * ]);
   * ```
   */
  addVariableDefs(defs: VariableDefInfo[]): void {
    for (const def of defs) {
      for (const blockId of def.defBlocks) {
        this.addVariableDef(def.variable, blockId);
      }
    }
  }

  /**
   * Gets the current variable definitions.
   *
   * @returns Map of variable names to their definition block sets
   */
  getVariableDefs(): Map<string, Set<number>> {
    // Return a copy to prevent modification
    const result = new Map<string, Set<number>>();
    for (const [variable, defBlocks] of this.variableDefs) {
      result.set(variable, new Set(defBlocks));
    }
    return result;
  }

  /**
   * Checks if a variable has any definitions registered.
   *
   * @param variable - The variable name to check
   * @returns true if the variable has at least one definition
   */
  hasVariable(variable: string): boolean {
    return this.variableDefs.has(variable);
  }

  /**
   * Gets the number of registered variables.
   *
   * @returns Number of distinct variables with definitions
   */
  getVariableCount(): number {
    return this.variableDefs.size;
  }

  // ===========================================================================
  // Phi Placement Algorithm
  // ===========================================================================

  /**
   * Computes phi function placement for all registered variables.
   *
   * This is the main method that implements the phi placement algorithm.
   * It uses the iterated dominance frontier (DF+) to determine where
   * phi functions are needed for each variable.
   *
   * **Algorithm (Worklist):**
   * ```
   * For each variable v:
   *   WorkList = {blocks where v is defined}
   *   EverOnWorkList = WorkList
   *   HasPhi = {}
   *   While WorkList not empty:
   *     n = WorkList.pop()
   *     For each block m in DF(n):
   *       If m not in HasPhi:
   *         Place phi for v at m
   *         HasPhi.add(m)
   *         If m not in EverOnWorkList:
   *           EverOnWorkList.add(m)
   *           WorkList.push(m)  // Phi creates new def
   * ```
   *
   * @param _func - The IL function (used for validation and context)
   * @returns PhiPlacementResult with all placement information
   *
   * @example
   * ```typescript
   * const result = placer.placePhiFunctions(func);
   *
   * // Check where phi functions are needed
   * for (const [blockId, variables] of result.byBlock) {
   *   for (const variable of variables) {
   *     console.log(`Insert phi for ${variable} at block ${blockId}`);
   *   }
   * }
   *
   * console.log(`Total phi functions: ${result.totalPhiCount}`);
   * ```
   */
  placePhiFunctions(_func: ILFunction): PhiPlacementResult {
    // If already computed, return cached result
    if (this.computed && this.result) {
      return this.result;
    }

    // Build result structures
    const byVariable = new Map<string, PhiPlacementInfo>();
    const byBlock = new Map<number, string[]>();
    let totalPhiCount = 0;
    let iterations = 0;
    let maxPhisPerBlock = 0;

    // Process each variable
    for (const [variable, defBlocks] of this.variableDefs) {
      // Compute iterated dominance frontier for this variable's def blocks
      const phiBlocks = this.frontiers.computeIteratedFrontier(defBlocks);

      // Create placement info for this variable
      const info: PhiPlacementInfo = {
        variable,
        phiBlocks: new Set(phiBlocks),
        defBlocks: new Set(defBlocks),
      };
      byVariable.set(variable, info);

      // Add to by-block index
      for (const blockId of phiBlocks) {
        let variables = byBlock.get(blockId);
        if (!variables) {
          variables = [];
          byBlock.set(blockId, variables);
        }
        variables.push(variable);
        totalPhiCount++;
      }

      // Count iterations (simplified - using DF+ handles iteration internally)
      iterations++;
    }

    // Calculate max phis per block
    for (const variables of byBlock.values()) {
      if (variables.length > maxPhisPerBlock) {
        maxPhisPerBlock = variables.length;
      }
    }

    // Build stats
    const stats: PhiPlacementStats = {
      variableCount: this.variableDefs.size,
      blocksWithPhis: byBlock.size,
      totalPhiCount,
      maxPhisPerBlock,
      iterations,
    };

    // Create and cache result
    this.result = {
      byVariable,
      byBlock,
      totalPhiCount,
      stats,
    };

    this.computed = true;
    return this.result;
  }

  // ===========================================================================
  // Query Methods (Post-Computation)
  // ===========================================================================

  /**
   * Checks if phi placement has been computed.
   *
   * @returns true if placePhiFunctions() has been called
   */
  isComputed(): boolean {
    return this.computed;
  }

  /**
   * Gets the cached phi placement result.
   *
   * @returns The result if computed, null otherwise
   */
  getResult(): PhiPlacementResult | null {
    return this.result;
  }

  /**
   * Gets the dominance frontier used for placement.
   *
   * @returns The DominanceFrontier instance
   */
  getFrontiers(): DominanceFrontier {
    return this.frontiers;
  }

  /**
   * Resets the phi placer to allow new computation.
   *
   * Clears all variable definitions and cached results.
   * Use this to recompute phi placement after modifications.
   */
  reset(): void {
    this.variableDefs.clear();
    this.computed = false;
    this.result = null;
  }

  // ===========================================================================
  // Debugging
  // ===========================================================================

  /**
   * Returns a string representation of the phi placement state.
   *
   * @returns Human-readable description
   */
  toString(): string {
    const lines: string[] = ['PhiPlacer:'];
    lines.push(`  Variables: ${this.variableDefs.size}`);
    lines.push(`  Computed: ${this.computed}`);

    if (this.result) {
      lines.push(`  Total Phi Functions: ${this.result.totalPhiCount}`);
      lines.push(`  Blocks with Phis: ${this.result.stats.blocksWithPhis}`);

      lines.push('  By Variable:');
      for (const [variable, info] of this.result.byVariable) {
        const phiBlocksList = Array.from(info.phiBlocks).sort((a, b) => a - b);
        const defBlocksList = Array.from(info.defBlocks).sort((a, b) => a - b);
        lines.push(`    ${variable}:`);
        lines.push(`      defs: {${defBlocksList.join(', ')}}`);
        lines.push(`      phis: {${phiBlocksList.join(', ')}}`);
      }
    }

    return lines.join('\n');
  }
}
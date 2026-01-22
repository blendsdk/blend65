/**
 * SSA Variable Renaming for SSA Construction
 *
 * This module implements the variable renaming phase of SSA construction.
 * After phi functions are placed, variables need to be renamed to unique
 * versions to satisfy the single-assignment property of SSA form.
 *
 * **Key Concept:**
 * ```
 * Original:            SSA Form:
 * x = 0                x.0 = 0
 * if (cond)            if (cond)
 *   x = 1                x.1 = 1
 * else                 else
 *   x = 2                x.2 = 2
 * y = x                x.3 = phi(x.1, x.2)
 *                      y.0 = x.3
 * ```
 *
 * **Algorithm (Dominator Tree Walk):**
 * ```
 * For each block B in dominator tree preorder:
 *   For each phi in B:
 *     Rename result to fresh version (x.n)
 *   For each instruction in B:
 *     Rename uses to current version
 *     If defines variable, rename to fresh version
 *   For each successor S:
 *     Update phi operands from B with current versions
 *   Recurse to dominated blocks
 *   Pop version stack at end (restore state)
 * ```
 *
 * **Why Preorder Traversal?**
 * - Ensures definitions are processed before uses in dominated blocks
 * - Maintains correct version stack for each scope level
 * - Natural recursive structure matches dominator tree
 *
 * @module il/ssa/renaming
 */

import type { ILFunction } from '../function.js';
import type { BasicBlock } from '../basic-block.js';
import type { DominatorTree } from './dominators.js';
import type { PhiPlacementResult } from './phi.js';
import type { ILInstruction } from '../instructions.js';
import {
  ILPhiInstruction,
  ILLoadVarInstruction,
  ILStoreVarInstruction,
  ILOpcode,
} from '../instructions.js';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Represents an SSA-renamed variable name.
 *
 * SSA names follow the format "variableName.version" where:
 * - variableName is the original variable name
 * - version is a non-negative integer (0, 1, 2, ...)
 *
 * @example
 * ```typescript
 * const name: SSAName = {
 *   base: 'counter',
 *   version: 2,
 * };
 * // Represents "counter.2" in SSA form
 * ```
 */
export interface SSAName {
  /**
   * The original (base) variable name before SSA renaming.
   */
  base: string;

  /**
   * The SSA version number (0 = first definition, 1 = second, etc.).
   */
  version: number;
}

/**
 * Information about a renamed instruction.
 *
 * Tracks how an instruction's uses and definitions were renamed.
 */
export interface RenamedInstruction {
  /**
   * The instruction ID that was renamed.
   */
  instructionId: number;

  /**
   * Map of original register IDs to their SSA-renamed versions.
   * Key: original register ID
   * Value: SSA name assigned to that register
   */
  renamedUses: Map<number, SSAName>;

  /**
   * If this instruction defines a variable, its SSA name.
   * null for instructions that don't define variables.
   */
  definition: SSAName | null;
}

/**
 * Phi operand information with SSA versioning.
 *
 * For each phi function, tracks which SSA version of a variable
 * comes from each predecessor block.
 */
export interface SSAPhiOperand {
  /**
   * Block ID of the predecessor.
   */
  blockId: number;

  /**
   * SSA name of the value from this predecessor.
   */
  ssaName: SSAName;
}

/**
 * Information about a renamed phi function.
 */
export interface RenamedPhi {
  /**
   * The variable this phi function is for.
   */
  variable: string;

  /**
   * The block ID where this phi is located.
   */
  blockId: number;

  /**
   * SSA name of the phi's result.
   */
  result: SSAName;

  /**
   * Operands with their SSA versions per predecessor.
   */
  operands: SSAPhiOperand[];
}

/**
 * Result of the SSA variable renaming process.
 */
export interface SSARenamingResult {
  /**
   * Whether renaming completed successfully.
   */
  success: boolean;

  /**
   * Renamed phi functions with their SSA operands.
   * Key: block ID
   * Value: Array of renamed phi functions at that block
   */
  renamedPhis: Map<number, RenamedPhi[]>;

  /**
   * Map from register ID to its SSA name.
   * Useful for looking up the SSA version of any register.
   */
  registerSSANames: Map<number, SSAName>;

  /**
   * Statistics about the renaming process.
   */
  stats: SSARenamingStats;

  /**
   * Errors encountered during renaming (if any).
   */
  errors: string[];
}

/**
 * Statistics about the SSA renaming process.
 */
export interface SSARenamingStats {
  /**
   * Number of variables that were renamed.
   */
  variablesRenamed: number;

  /**
   * Total number of SSA versions created across all variables.
   */
  versionsCreated: number;

  /**
   * Maximum version number for any single variable.
   */
  maxVersionForAnyVariable: number;

  /**
   * Number of phi functions processed.
   */
  phisProcessed: number;

  /**
   * Number of blocks visited during renaming.
   */
  blocksProcessed: number;

  /**
   * Number of instructions processed.
   */
  instructionsProcessed: number;
}

// =============================================================================
// Version Stack Management
// =============================================================================

/**
 * Manages version stacks for SSA variable renaming.
 *
 * For each variable, maintains a stack of versions. The stack enables
 * proper scoping during dominator tree traversal - when leaving a
 * subtree, versions defined in that subtree are popped.
 *
 * @internal
 */
export class VersionStackManager {
  /**
   * Map from variable name to its version stack.
   * Each stack element is a version number.
   */
  protected readonly versionStacks: Map<string, number[]>;

  /**
   * Map from variable name to its next version counter.
   * Used to allocate fresh version numbers.
   */
  protected readonly nextVersions: Map<string, number>;

  /**
   * Creates a new version stack manager.
   */
  constructor() {
    this.versionStacks = new Map();
    this.nextVersions = new Map();
  }

  /**
   * Gets the current SSA version for a variable.
   *
   * Returns the version at the top of the stack for this variable.
   * If the variable has no versions yet, returns undefined.
   *
   * @param variable - The variable name
   * @returns Current SSA name, or undefined if not defined
   */
  getCurrentVersion(variable: string): SSAName | undefined {
    const stack = this.versionStacks.get(variable);
    if (!stack || stack.length === 0) {
      return undefined;
    }
    return { base: variable, version: stack[stack.length - 1] };
  }

  /**
   * Allocates a fresh SSA version for a variable.
   *
   * Creates a new version number and pushes it onto the stack.
   * Returns the new SSA name.
   *
   * @param variable - The variable name
   * @returns The fresh SSA name
   */
  allocateFreshVersion(variable: string): SSAName {
    // Get or initialize the next version counter
    let nextVersion = this.nextVersions.get(variable);
    if (nextVersion === undefined) {
      nextVersion = 0;
      this.nextVersions.set(variable, 0);
    }

    // Create the SSA name
    const ssaName: SSAName = { base: variable, version: nextVersion };

    // Increment the version counter
    this.nextVersions.set(variable, nextVersion + 1);

    // Push onto the version stack
    let stack = this.versionStacks.get(variable);
    if (!stack) {
      stack = [];
      this.versionStacks.set(variable, stack);
    }
    stack.push(nextVersion);

    return ssaName;
  }

  /**
   * Pops the most recent version for a variable.
   *
   * Called when leaving a dominated subtree to restore the previous version.
   *
   * @param variable - The variable name
   */
  popVersion(variable: string): void {
    const stack = this.versionStacks.get(variable);
    if (stack && stack.length > 0) {
      stack.pop();
    }
  }

  /**
   * Records the number of versions on each stack.
   *
   * Used to track what needs to be popped when leaving a block.
   *
   * @returns Map from variable name to current stack depth
   */
  recordStackDepths(): Map<string, number> {
    const depths = new Map<string, number>();
    for (const [variable, stack] of this.versionStacks) {
      depths.set(variable, stack.length);
    }
    return depths;
  }

  /**
   * Pops versions to restore stack depths to a recorded state.
   *
   * @param depths - Previously recorded stack depths
   */
  restoreStackDepths(depths: Map<string, number>): void {
    for (const [variable, stack] of this.versionStacks) {
      const targetDepth = depths.get(variable) ?? 0;
      while (stack.length > targetDepth) {
        stack.pop();
      }
    }
  }

  /**
   * Gets all variables that have been versioned.
   *
   * @returns Array of variable names
   */
  getVersionedVariables(): string[] {
    return Array.from(this.nextVersions.keys());
  }

  /**
   * Gets the total number of versions created.
   *
   * @returns Total version count across all variables
   */
  getTotalVersionCount(): number {
    let total = 0;
    for (const count of this.nextVersions.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Gets the maximum version number for any single variable.
   *
   * @returns Maximum version number
   */
  getMaxVersion(): number {
    let max = 0;
    for (const count of this.nextVersions.values()) {
      if (count > max) {
        max = count;
      }
    }
    return max;
  }

  /**
   * Resets all version tracking state.
   */
  reset(): void {
    this.versionStacks.clear();
    this.nextVersions.clear();
  }
}

// =============================================================================
// SSA Renamer Class
// =============================================================================

/**
 * Performs SSA variable renaming on an IL function.
 *
 * The renamer walks the dominator tree in preorder, maintaining version
 * stacks for each variable. At each block:
 *
 * 1. Process phi functions - assign fresh versions to their results
 * 2. Process instructions - rename uses to current versions, assign
 *    fresh versions to definitions
 * 3. Update phi operands in successors with current versions
 * 4. Recursively process dominated blocks
 * 5. Pop versions defined in this block (restore stack state)
 *
 * **Usage:**
 * ```typescript
 * // Build dominator tree and place phi functions first
 * const domTree = computeDominators(func);
 * const frontiers = computeFrontiers(func, domTree);
 * const placer = new PhiPlacer(frontiers);
 * // ... register variable definitions ...
 * const phiResult = placer.placePhiFunctions(func);
 *
 * // Now rename variables
 * const renamer = new SSARenamer(domTree, phiResult);
 * const result = renamer.rename(func);
 *
 * if (result.success) {
 *   console.log(`Created ${result.stats.versionsCreated} SSA versions`);
 * }
 * ```
 */
export class SSARenamer {
  /**
   * The dominator tree for traversal order.
   */
  protected readonly domTree: DominatorTree;

  /**
   * Phi placement information (where phi functions are needed).
   */
  protected readonly phiPlacement: PhiPlacementResult;

  /**
   * Version stack manager for tracking variable versions.
   */
  protected readonly versionManager: VersionStackManager;

  /**
   * Renamed phi functions indexed by block ID.
   */
  protected renamedPhis: Map<number, RenamedPhi[]>;

  /**
   * Map from register ID to its SSA name.
   */
  protected registerSSANames: Map<number, SSAName>;

  /**
   * Errors encountered during renaming.
   */
  protected errors: string[];

  /**
   * Statistics counters.
   */
  protected phisProcessed: number;
  protected blocksProcessed: number;
  protected instructionsProcessed: number;

  /**
   * Creates a new SSA renamer.
   *
   * @param domTree - Dominator tree for the function
   * @param phiPlacement - Result from phi placement phase
   */
  constructor(domTree: DominatorTree, phiPlacement: PhiPlacementResult) {
    this.domTree = domTree;
    this.phiPlacement = phiPlacement;
    this.versionManager = new VersionStackManager();
    this.renamedPhis = new Map();
    this.registerSSANames = new Map();
    this.errors = [];
    this.phisProcessed = 0;
    this.blocksProcessed = 0;
    this.instructionsProcessed = 0;
  }

  // ===========================================================================
  // Main Renaming Entry Point
  // ===========================================================================

  /**
   * Performs SSA variable renaming on the function.
   *
   * This is the main entry point that walks the dominator tree
   * and renames all variables to SSA form. The algorithm starts
   * from the entry block and recursively processes dominated blocks,
   * maintaining version stacks for proper scoping.
   *
   * @param func - The IL function to rename
   * @returns Result containing renamed phis and statistics
   */
  rename(func: ILFunction): SSARenamingResult {
    // Reset state for fresh renaming
    this.versionManager.reset();
    this.renamedPhis.clear();
    this.registerSSANames.clear();
    this.errors = [];
    this.phisProcessed = 0;
    this.blocksProcessed = 0;
    this.instructionsProcessed = 0;

    // Initialize all phi entries upfront so predecessors can fill operands
    // before the block itself is processed in preorder
    this.initializePhiEntries();

    // Start recursive renaming from entry block
    // The recursion handles dominator tree preorder traversal
    const entryBlockId = this.domTree.getEntryBlockId();
    const entryBlock = func.getBlocks().find((b) => b.id === entryBlockId);

    if (entryBlock) {
      this.renameBlock(func, entryBlock);
    } else {
      this.errors.push(`Entry block ${entryBlockId} not found in function`);
    }

    // Build result
    const stats: SSARenamingStats = {
      variablesRenamed: this.versionManager.getVersionedVariables().length,
      versionsCreated: this.versionManager.getTotalVersionCount(),
      maxVersionForAnyVariable: this.versionManager.getMaxVersion(),
      phisProcessed: this.phisProcessed,
      blocksProcessed: this.blocksProcessed,
      instructionsProcessed: this.instructionsProcessed,
    };

    return {
      success: this.errors.length === 0,
      renamedPhis: new Map(this.renamedPhis),
      registerSSANames: new Map(this.registerSSANames),
      stats,
      errors: [...this.errors],
    };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initializes phi entries for all blocks that need them.
   *
   * This must be done before the main renaming pass so that
   * predecessors can fill in phi operands for successor blocks
   * that haven't been visited yet in the dominator tree walk.
   */
  protected initializePhiEntries(): void {
    for (const [blockId, variables] of this.phiPlacement.byBlock) {
      const phis: RenamedPhi[] = [];
      for (const variable of variables) {
        phis.push({
          variable,
          blockId,
          result: { base: variable, version: -1 }, // Placeholder, set in processPhiFunctions
          operands: [],
        });
      }
      this.renamedPhis.set(blockId, phis);
    }
  }

  // ===========================================================================
  // Block Renaming
  // ===========================================================================

  /**
   * Renames variables within a single block.
   *
   * @param func - The IL function
   * @param block - The block to rename
   */
  protected renameBlock(func: ILFunction, block: BasicBlock): void {
    this.blocksProcessed++;

    // Record stack depths before processing this block
    const stackDepths = this.versionManager.recordStackDepths();

    // Step 1: Process phi functions at this block
    this.processPhiFunctions(func, block);

    // Step 2: Process regular instructions
    this.processInstructions(block);

    // Step 3: Update phi operands in successors
    this.updateSuccessorPhiOperands(func, block);

    // Step 4: Recursively process dominated blocks
    const dominatedBlocks = this.domTree.getImmediatelyDominatedBlocks(block.id);
    for (const dominatedId of dominatedBlocks) {
      const dominatedBlock = func.getBlocks().find((b) => b.id === dominatedId);
      if (dominatedBlock) {
        this.renameBlock(func, dominatedBlock);
      }
    }

    // Step 5: Restore stack depths (pop versions defined in this block)
    this.versionManager.restoreStackDepths(stackDepths);
  }

  // ===========================================================================
  // Phi Function Processing
  // ===========================================================================

  /**
   * Processes phi functions at a block, assigning SSA versions to results.
   *
   * The phi entries were already initialized by initializePhiEntries().
   * This method assigns fresh versions to the phi results.
   *
   * @param _func - The IL function (for context)
   * @param block - The block containing phi functions
   */
  protected processPhiFunctions(_func: ILFunction, block: BasicBlock): void {
    // Get the pre-initialized phi entries for this block
    const phis = this.renamedPhis.get(block.id);
    if (!phis || phis.length === 0) {
      return;
    }

    // For each phi, assign a fresh version to its result
    for (const phi of phis) {
      const result = this.versionManager.allocateFreshVersion(phi.variable);
      phi.result = result; // Update the placeholder result
      this.phisProcessed++;
    }
  }

  /**
   * Updates phi operands in successor blocks with current versions.
   *
   * When we finish processing a block, we need to fill in the phi operands
   * in its successors with the current SSA versions of each variable.
   *
   * @param _func - The IL function (unused, kept for API consistency)
   * @param block - The block we just finished processing
   */
  protected updateSuccessorPhiOperands(_func: ILFunction, block: BasicBlock): void {
    // Get successors
    const successors = block.getSuccessors();

    for (const successor of successors) {
      // Get phi functions at the successor
      const successorPhis = this.renamedPhis.get(successor.id);
      if (!successorPhis) {
        continue;
      }

      // For each phi at the successor, add an operand from this block
      for (const phi of successorPhis) {
        const currentVersion = this.versionManager.getCurrentVersion(phi.variable);

        if (currentVersion) {
          // Add operand from this predecessor
          phi.operands.push({
            blockId: block.id,
            ssaName: currentVersion,
          });
        } else {
          // Variable not defined on this path - could indicate an error
          // or the variable is only defined on some paths
          // For robustness, we skip adding an operand
        }
      }
    }
  }

  // ===========================================================================
  // Instruction Processing
  // ===========================================================================

  /**
   * Processes regular instructions in a block, renaming uses and definitions.
   *
   * @param block - The block to process
   */
  protected processInstructions(block: BasicBlock): void {
    const instructions = block.getInstructions();

    for (const instruction of instructions) {
      this.instructionsProcessed++;

      // Handle different instruction types
      if (instruction.opcode === ILOpcode.LOAD_VAR) {
        this.processLoadVar(instruction as ILLoadVarInstruction);
      } else if (instruction.opcode === ILOpcode.STORE_VAR) {
        this.processStoreVar(instruction as ILStoreVarInstruction);
      } else if (instruction.opcode === ILOpcode.PHI) {
        // Phi instructions are handled separately in processPhiFunctions
        // Their results were already renamed
        this.processPhiInstruction(instruction as ILPhiInstruction);
      } else {
        // For other instructions, process uses (if any are variable references)
        this.processGenericInstruction(instruction);
      }
    }
  }

  /**
   * Processes a LOAD_VAR instruction.
   *
   * The result register gets the current SSA version of the loaded variable.
   *
   * @param instruction - The load instruction
   */
  protected processLoadVar(instruction: ILLoadVarInstruction): void {
    const variable = instruction.variableName;
    const currentVersion = this.versionManager.getCurrentVersion(variable);

    if (currentVersion && instruction.result) {
      // Map the result register to the current SSA version
      this.registerSSANames.set(instruction.result.id, currentVersion);
    }
  }

  /**
   * Processes a STORE_VAR instruction.
   *
   * This creates a new definition of the variable, so we allocate a fresh version.
   *
   * @param instruction - The store instruction
   */
  protected processStoreVar(instruction: ILStoreVarInstruction): void {
    const variable = instruction.variableName;

    // Allocate a fresh version for this definition
    const freshVersion = this.versionManager.allocateFreshVersion(variable);

    // Map the stored value's register to the fresh SSA name
    // Note: The value being stored already has its own SSA version
    // The fresh version is for the variable being defined
    this.registerSSANames.set(instruction.value.id, freshVersion);
  }

  /**
   * Processes a PHI instruction's operands.
   *
   * The phi result was already renamed in processPhiFunctions.
   * Here we just note that the instruction was processed.
   *
   * @param _instruction - The phi instruction (unused, already processed)
   */
  protected processPhiInstruction(_instruction: ILPhiInstruction): void {
    // The phi's result register mapping was already done in processPhiFunctions.
    // This method exists for consistency in the instruction processing dispatch.
  }

  /**
   * Processes a generic instruction, tracking register SSA names.
   *
   * @param instruction - The instruction to process
   */
  protected processGenericInstruction(instruction: ILInstruction): void {
    // Track the result register if present
    if (instruction.result) {
      // For non-variable operations, the register doesn't have a base variable name
      // We could either:
      // 1. Use the register name as the base
      // 2. Generate a synthetic name
      // For now, we track it with a synthetic name based on register ID

      const syntheticName = instruction.result.name ?? `__r${instruction.result.id}`;
      const ssaName: SSAName = {
        base: syntheticName,
        version: 0, // First (and only) definition of this temp
      };
      this.registerSSANames.set(instruction.result.id, ssaName);
    }
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Gets the SSA name for a register.
   *
   * @param registerId - The register ID to look up
   * @returns SSA name, or undefined if not found
   */
  getRegisterSSAName(registerId: number): SSAName | undefined {
    return this.registerSSANames.get(registerId);
  }

  /**
   * Gets all renamed phi functions at a block.
   *
   * @param blockId - The block ID
   * @returns Array of renamed phis, or empty array if none
   */
  getRenamedPhisAtBlock(blockId: number): RenamedPhi[] {
    return this.renamedPhis.get(blockId) ?? [];
  }

  /**
   * Gets the dominator tree used for renaming.
   *
   * @returns The dominator tree
   */
  getDominatorTree(): DominatorTree {
    return this.domTree;
  }

  /**
   * Gets the phi placement result used for renaming.
   *
   * @returns The phi placement result
   */
  getPhiPlacement(): PhiPlacementResult {
    return this.phiPlacement;
  }

  /**
   * Resets the renamer for a fresh renaming operation.
   */
  reset(): void {
    this.versionManager.reset();
    this.renamedPhis.clear();
    this.registerSSANames.clear();
    this.errors = [];
    this.phisProcessed = 0;
    this.blocksProcessed = 0;
    this.instructionsProcessed = 0;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Formats an SSA name as a string.
 *
 * @param name - The SSA name to format
 * @returns String in format "base.version"
 *
 * @example
 * ```typescript
 * formatSSAName({ base: 'x', version: 2 }); // "x.2"
 * formatSSAName({ base: 'counter', version: 0 }); // "counter.0"
 * ```
 */
export function formatSSAName(name: SSAName): string {
  return `${name.base}.${name.version}`;
}

/**
 * Parses an SSA name string back to an SSAName object.
 *
 * @param str - String in format "base.version"
 * @returns SSAName object, or null if parsing fails
 *
 * @example
 * ```typescript
 * parseSSAName('x.2'); // { base: 'x', version: 2 }
 * parseSSAName('counter.0'); // { base: 'counter', version: 0 }
 * parseSSAName('invalid'); // null
 * ```
 */
export function parseSSAName(str: string): SSAName | null {
  const lastDot = str.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0 || lastDot === str.length - 1) {
    // -1: no dot found
    // 0: empty base name (e.g., ".5")
    // str.length - 1: empty version (e.g., "x.")
    return null;
  }

  const base = str.substring(0, lastDot);
  const versionStr = str.substring(lastDot + 1);
  const version = parseInt(versionStr, 10);

  if (isNaN(version) || version < 0) {
    return null;
  }

  return { base, version };
}

/**
 * Performs SSA variable renaming on a function.
 *
 * This is a convenience function that creates an SSARenamer and
 * performs the renaming operation.
 *
 * @param func - The IL function to rename
 * @param domTree - Dominator tree for the function
 * @param phiPlacement - Result from phi placement phase
 * @returns SSA renaming result
 *
 * @example
 * ```typescript
 * const domTree = computeDominators(func);
 * const frontiers = computeFrontiers(func, domTree);
 * const placer = new PhiPlacer(frontiers);
 * // ... register variable definitions ...
 * const phiResult = placer.placePhiFunctions(func);
 *
 * const result = renameVariables(func, domTree, phiResult);
 * ```
 */
export function renameVariables(
  ilFunction: ILFunction,
  domTree: DominatorTree,
  phiPlacement: PhiPlacementResult
): SSARenamingResult {
  const renamer = new SSARenamer(domTree, phiPlacement);
  return renamer.rename(ilFunction);
}
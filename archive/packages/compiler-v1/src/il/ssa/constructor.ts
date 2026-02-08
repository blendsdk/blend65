/**
 * SSA Constructor - Main Orchestrator for SSA Form Construction
 *
 * This module provides the main entry point for converting IL functions
 * to SSA (Static Single Assignment) form. It orchestrates the complete
 * SSA construction pipeline:
 *
 * **SSA Construction Pipeline:**
 * ```
 * 1. Compute dominator tree from CFG
 * 2. Compute dominance frontiers
 * 3. Collect variable definitions from IL instructions
 * 4. Place phi functions at dominance frontiers
 * 5. Rename variables to unique SSA versions
 * 6. Verify SSA invariants
 * ```
 *
 * **Why SSA Form?**
 * - Enables clean dataflow analysis (each variable defined once)
 * - Simplifies optimizations (dead code elimination, constant propagation)
 * - Improves register allocation (better live range analysis)
 * - Makes phi functions explicit at control flow merge points
 *
 * @module il/ssa/constructor
 *
 * @example
 * ```typescript
 * import { SSAConstructor } from './ssa/constructor.js';
 *
 * // Create constructor and convert function to SSA form
 * const constructor = new SSAConstructor();
 * const result = constructor.construct(ilFunction);
 *
 * if (result.success) {
 *   console.log(`SSA construction successful!`);
 *   console.log(`  Phi functions placed: ${result.stats.phiCount}`);
 *   console.log(`  SSA versions created: ${result.stats.versionsCreated}`);
 *   console.log(`  Blocks processed: ${result.stats.blocksProcessed}`);
 * } else {
 *   console.error('SSA construction failed:');
 *   for (const error of result.errors) {
 *     console.error(`  - ${error.message}`);
 *   }
 * }
 *
 * // Access intermediate results for debugging
 * const domTree = constructor.getDominatorTree();
 * const frontiers = constructor.getDominanceFrontiers();
 * ```
 */

import type { ILFunction } from '../function.js';
import type { BasicBlock } from '../basic-block.js';
import { ILOpcode, ILStoreVarInstruction, ILPhiInstruction } from '../instructions.js';
import { DominatorTree, computeDominators } from './dominators.js';
import { DominanceFrontier, computeFrontiers } from './frontiers.js';
import { PhiPlacer, type PhiPlacementResult } from './phi.js';
import { SSARenamer, type SSARenamingResult } from './renaming.js';
import { verifySSA, type SSAVerificationResult, type SSAVerificationError } from './verification.js';
import { VirtualRegister } from '../values.js';
import { IL_BYTE } from '../types.js';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Error that occurred during SSA construction.
 */
export interface SSAConstructionError {
  /**
   * Phase where the error occurred.
   */
  phase: SSAConstructionPhase;

  /**
   * Human-readable error message.
   */
  message: string;

  /**
   * Optional details about the error.
   */
  details?: Record<string, unknown>;
}

/**
 * Phases of SSA construction.
 */
export enum SSAConstructionPhase {
  /** Computing dominator tree */
  DOMINATORS = 'DOMINATORS',

  /** Computing dominance frontiers */
  FRONTIERS = 'FRONTIERS',

  /** Collecting variable definitions */
  DEFINITIONS = 'DEFINITIONS',

  /** Placing phi functions */
  PHI_PLACEMENT = 'PHI_PLACEMENT',

  /** Renaming variables to SSA form */
  RENAMING = 'RENAMING',

  /** Verifying SSA invariants */
  VERIFICATION = 'VERIFICATION',

  /** Inserting phi instructions into blocks */
  PHI_INSERTION = 'PHI_INSERTION',
}

/**
 * Statistics about the SSA construction process.
 */
export interface SSAConstructionStats {
  /**
   * Number of phi functions placed.
   */
  phiCount: number;

  /**
   * Number of SSA versions created across all variables.
   */
  versionsCreated: number;

  /**
   * Number of blocks processed.
   */
  blocksProcessed: number;

  /**
   * Number of variables converted to SSA form.
   */
  variablesProcessed: number;

  /**
   * Number of instructions processed.
   */
  instructionsProcessed: number;

  /**
   * Time taken for each phase (in milliseconds).
   */
  phaseTimes: Map<SSAConstructionPhase, number>;

  /**
   * Total construction time (in milliseconds).
   */
  totalTime: number;
}

/**
 * Result of SSA construction.
 */
export interface SSAConstructionResult {
  /**
   * Whether construction completed successfully.
   */
  success: boolean;

  /**
   * Errors encountered during construction.
   */
  errors: SSAConstructionError[];

  /**
   * Statistics about the construction process.
   */
  stats: SSAConstructionStats;

  /**
   * The dominator tree computed for the function.
   */
  dominatorTree: DominatorTree | null;

  /**
   * The dominance frontiers computed for the function.
   */
  dominanceFrontiers: DominanceFrontier | null;

  /**
   * Result of phi placement phase.
   */
  phiPlacement: PhiPlacementResult | null;

  /**
   * Result of variable renaming phase.
   */
  renaming: SSARenamingResult | null;

  /**
   * Result of SSA verification.
   */
  verification: SSAVerificationResult | null;
}

/**
 * Options for SSA construction.
 */
export interface SSAConstructionOptions {
  /**
   * Whether to skip verification after construction.
   * Default: false (verification is performed)
   */
  skipVerification?: boolean;

  /**
   * Whether to insert phi instructions into blocks.
   * Default: true
   */
  insertPhiInstructions?: boolean;

  /**
   * Whether to collect timing statistics.
   * Default: true
   */
  collectTimings?: boolean;

  /**
   * Enable verbose logging for debugging.
   * Default: false
   */
  verbose?: boolean;
}

// =============================================================================
// SSA Constructor Class
// =============================================================================

/**
 * Main orchestrator for SSA form construction.
 *
 * This class manages the complete SSA construction pipeline:
 * 1. Dominator tree computation
 * 2. Dominance frontier computation
 * 3. Variable definition collection
 * 4. Phi function placement
 * 5. Variable renaming
 * 6. SSA verification
 *
 * Each phase can be accessed individually for debugging, and the
 * constructor provides detailed statistics about the process.
 *
 * **Usage:**
 * ```typescript
 * const constructor = new SSAConstructor();
 * const result = constructor.construct(ilFunction);
 *
 * if (!result.success) {
 *   for (const error of result.errors) {
 *     console.error(`[${error.phase}] ${error.message}`);
 *   }
 * }
 * ```
 *
 * **Thread Safety:**
 * This class is NOT thread-safe. Each thread should use its own instance.
 * The constructor maintains state between construct() calls that can be
 * accessed via getter methods.
 */
export class SSAConstructor {
  /**
   * Options for SSA construction.
   */
  protected readonly options: Required<SSAConstructionOptions>;

  /**
   * The function currently being processed.
   */
  protected currentFunction: ILFunction | null;

  /**
   * Computed dominator tree.
   */
  protected dominatorTree: DominatorTree | null;

  /**
   * Computed dominance frontiers.
   */
  protected dominanceFrontiers: DominanceFrontier | null;

  /**
   * Phi placement result.
   */
  protected phiPlacement: PhiPlacementResult | null;

  /**
   * SSA renaming result.
   */
  protected renamingResult: SSARenamingResult | null;

  /**
   * SSA verification result.
   */
  protected verificationResult: SSAVerificationResult | null;

  /**
   * Errors collected during construction.
   */
  protected errors: SSAConstructionError[];

  /**
   * Phase timing statistics.
   */
  protected phaseTimes: Map<SSAConstructionPhase, number>;

  /**
   * Counter for generating unique phi instruction IDs.
   */
  protected nextPhiId: number;

  /**
   * Creates a new SSA constructor.
   *
   * @param options - Construction options
   */
  constructor(options: SSAConstructionOptions = {}) {
    this.options = {
      skipVerification: options.skipVerification ?? false,
      insertPhiInstructions: options.insertPhiInstructions ?? true,
      collectTimings: options.collectTimings ?? true,
      verbose: options.verbose ?? false,
    };

    this.currentFunction = null;
    this.dominatorTree = null;
    this.dominanceFrontiers = null;
    this.phiPlacement = null;
    this.renamingResult = null;
    this.verificationResult = null;
    this.errors = [];
    this.phaseTimes = new Map();
    this.nextPhiId = 0;
  }

  // ===========================================================================
  // Main Construction Entry Point
  // ===========================================================================

  /**
   * Converts an IL function to SSA form.
   *
   * This is the main entry point that orchestrates the complete SSA
   * construction pipeline. The function is modified in place to include
   * phi instructions if `insertPhiInstructions` is enabled.
   *
   * @param func - The IL function to convert to SSA form
   * @returns Result containing success status, errors, and statistics
   *
   * @example
   * ```typescript
   * const result = constructor.construct(ilFunction);
   *
   * if (result.success) {
   *   // Function is now in SSA form
   *   console.log(`Converted to SSA with ${result.stats.phiCount} phi functions`);
   * }
   * ```
   */
  construct(func: ILFunction): SSAConstructionResult {
    const startTime = this.options.collectTimings ? performance.now() : 0;

    // Reset state for new construction
    this.reset();
    this.currentFunction = func;

    // Initialize phi ID counter based on existing instructions
    this.initializePhiIdCounter(func);

    try {
      // Phase 1: Compute dominator tree
      this.log('Phase 1: Computing dominator tree...');
      if (!this.computeDominatorTree(func)) {
        return this.buildResult(startTime);
      }

      // Phase 2: Compute dominance frontiers
      this.log('Phase 2: Computing dominance frontiers...');
      if (!this.computeDominanceFrontiers(func)) {
        return this.buildResult(startTime);
      }

      // Phase 3: Collect variable definitions
      this.log('Phase 3: Collecting variable definitions...');
      const variableDefs = this.collectVariableDefinitions(func);
      if (variableDefs === null) {
        return this.buildResult(startTime);
      }

      // Phase 4: Place phi functions
      this.log('Phase 4: Placing phi functions...');
      if (!this.placePhiFunctions(func, variableDefs)) {
        return this.buildResult(startTime);
      }

      // Phase 5: Rename variables to SSA form
      this.log('Phase 5: Renaming variables...');
      if (!this.renameVariables(func)) {
        return this.buildResult(startTime);
      }

      // Phase 6 (optional): Insert phi instructions into blocks
      if (this.options.insertPhiInstructions) {
        this.log('Phase 6: Inserting phi instructions...');
        if (!this.insertPhiInstructions(func)) {
          return this.buildResult(startTime);
        }
      }

      // Phase 7 (optional): Verify SSA form
      if (!this.options.skipVerification) {
        this.log('Phase 7: Verifying SSA form...');
        if (!this.verifySsaForm(func)) {
          return this.buildResult(startTime);
        }
      }

      this.log('SSA construction completed successfully.');
    } catch (error) {
      this.addError(SSAConstructionPhase.DOMINATORS, `Unexpected error: ${String(error)}`);
    }

    return this.buildResult(startTime);
  }

  // ===========================================================================
  // Phase 1: Dominator Tree
  // ===========================================================================

  /**
   * Computes the dominator tree for the function.
   *
   * @param func - The IL function
   * @returns true if successful, false if an error occurred
   */
  protected computeDominatorTree(func: ILFunction): boolean {
    const startTime = this.options.collectTimings ? performance.now() : 0;

    try {
      this.dominatorTree = computeDominators(func);

      if (this.options.collectTimings) {
        this.phaseTimes.set(SSAConstructionPhase.DOMINATORS, performance.now() - startTime);
      }

      this.log(`  Dominator tree computed with ${this.dominatorTree.getBlockCount()} blocks`);
      return true;
    } catch (error) {
      this.addError(SSAConstructionPhase.DOMINATORS, `Failed to compute dominator tree: ${String(error)}`);
      return false;
    }
  }

  // ===========================================================================
  // Phase 2: Dominance Frontiers
  // ===========================================================================

  /**
   * Computes dominance frontiers for the function.
   *
   * @param func - The IL function
   * @returns true if successful, false if an error occurred
   */
  protected computeDominanceFrontiers(func: ILFunction): boolean {
    const startTime = this.options.collectTimings ? performance.now() : 0;

    if (!this.dominatorTree) {
      this.addError(SSAConstructionPhase.FRONTIERS, 'Dominator tree not computed');
      return false;
    }

    try {
      this.dominanceFrontiers = computeFrontiers(func, this.dominatorTree);

      if (this.options.collectTimings) {
        this.phaseTimes.set(SSAConstructionPhase.FRONTIERS, performance.now() - startTime);
      }

      this.log(`  Dominance frontiers computed for ${this.dominanceFrontiers.getBlockCount()} blocks`);
      return true;
    } catch (error) {
      this.addError(SSAConstructionPhase.FRONTIERS, `Failed to compute dominance frontiers: ${String(error)}`);
      return false;
    }
  }

  // ===========================================================================
  // Phase 3: Variable Definition Collection
  // ===========================================================================

  /**
   * Collects variable definitions from the function's instructions.
   *
   * Scans all instructions to find STORE_VAR operations and records
   * which blocks define each variable.
   *
   * @param func - The IL function
   * @returns Map from variable name to set of defining block IDs, or null on error
   */
  protected collectVariableDefinitions(func: ILFunction): Map<string, Set<number>> | null {
    const startTime = this.options.collectTimings ? performance.now() : 0;

    try {
      const variableDefs = new Map<string, Set<number>>();
      const blocks = func.getBlocks();

      for (const block of blocks) {
        const instructions = block.getInstructions();

        for (const instruction of instructions) {
          if (instruction.opcode === ILOpcode.STORE_VAR) {
            const storeVar = instruction as ILStoreVarInstruction;
            const variable = storeVar.variableName;

            let defBlocks = variableDefs.get(variable);
            if (!defBlocks) {
              defBlocks = new Set();
              variableDefs.set(variable, defBlocks);
            }
            defBlocks.add(block.id);
          }
        }
      }

      if (this.options.collectTimings) {
        this.phaseTimes.set(SSAConstructionPhase.DEFINITIONS, performance.now() - startTime);
      }

      this.log(`  Found ${variableDefs.size} variables with definitions`);
      return variableDefs;
    } catch (error) {
      this.addError(SSAConstructionPhase.DEFINITIONS, `Failed to collect variable definitions: ${String(error)}`);
      return null;
    }
  }

  // ===========================================================================
  // Phase 4: Phi Placement
  // ===========================================================================

  /**
   * Places phi functions at dominance frontiers.
   *
   * @param func - The IL function
   * @param variableDefs - Map from variable name to defining block IDs
   * @returns true if successful, false if an error occurred
   */
  protected placePhiFunctions(func: ILFunction, variableDefs: Map<string, Set<number>>): boolean {
    const startTime = this.options.collectTimings ? performance.now() : 0;

    if (!this.dominanceFrontiers) {
      this.addError(SSAConstructionPhase.PHI_PLACEMENT, 'Dominance frontiers not computed');
      return false;
    }

    try {
      const placer = new PhiPlacer(this.dominanceFrontiers);

      // Register all variable definitions
      for (const [variable, defBlocks] of variableDefs) {
        for (const blockId of defBlocks) {
          placer.addVariableDef(variable, blockId);
        }
      }

      // Place phi functions
      this.phiPlacement = placer.placePhiFunctions(func);

      if (this.options.collectTimings) {
        this.phaseTimes.set(SSAConstructionPhase.PHI_PLACEMENT, performance.now() - startTime);
      }

      this.log(`  Placed ${this.phiPlacement.totalPhiCount} phi functions`);
      return true;
    } catch (error) {
      this.addError(SSAConstructionPhase.PHI_PLACEMENT, `Failed to place phi functions: ${String(error)}`);
      return false;
    }
  }

  // ===========================================================================
  // Phase 5: Variable Renaming
  // ===========================================================================

  /**
   * Renames variables to SSA form.
   *
   * @param func - The IL function
   * @returns true if successful, false if an error occurred
   */
  protected renameVariables(func: ILFunction): boolean {
    const startTime = this.options.collectTimings ? performance.now() : 0;

    if (!this.dominatorTree || !this.phiPlacement) {
      this.addError(SSAConstructionPhase.RENAMING, 'Prerequisites not computed');
      return false;
    }

    try {
      const renamer = new SSARenamer(this.dominatorTree, this.phiPlacement);
      this.renamingResult = renamer.rename(func);

      if (this.options.collectTimings) {
        this.phaseTimes.set(SSAConstructionPhase.RENAMING, performance.now() - startTime);
      }

      if (!this.renamingResult.success) {
        for (const error of this.renamingResult.errors) {
          this.addError(SSAConstructionPhase.RENAMING, error);
        }
        return false;
      }

      this.log(`  Created ${this.renamingResult.stats.versionsCreated} SSA versions`);
      return true;
    } catch (error) {
      this.addError(SSAConstructionPhase.RENAMING, `Failed to rename variables: ${String(error)}`);
      return false;
    }
  }

  // ===========================================================================
  // Phase 6: Phi Instruction Insertion
  // ===========================================================================

  /**
   * Inserts phi instructions into the appropriate blocks.
   *
   * @param func - The IL function
   * @returns true if successful, false if an error occurred
   */
  protected insertPhiInstructions(func: ILFunction): boolean {
    const startTime = this.options.collectTimings ? performance.now() : 0;

    if (!this.phiPlacement || !this.renamingResult) {
      this.addError(SSAConstructionPhase.PHI_INSERTION, 'Prerequisites not computed');
      return false;
    }

    try {
      let phisInserted = 0;

      // Build inverse map: SSA name string -> register ID
      // This allows us to look up existing registers by their SSA version
      const ssaNameToRegisterId = new Map<string, number>();
      for (const [registerId, ssaName] of this.renamingResult.registerSSANames) {
        const key = `${ssaName.base}.${ssaName.version}`;
        ssaNameToRegisterId.set(key, registerId);
      }

      // For each block that needs phi functions
      for (const [blockId] of this.phiPlacement.byBlock) {
        const block = this.findBlock(func, blockId);
        if (!block) {
          this.addError(SSAConstructionPhase.PHI_INSERTION, `Block ${blockId} not found`);
          continue;
        }

        // Get renamed phi information for this block
        const renamedPhis = this.renamingResult.renamedPhis.get(blockId) ?? [];

        // Create and insert phi instructions
        for (const renamedPhi of renamedPhis) {
          // Create phi sources from the renamed operands
          // Look up existing register IDs using the inverse SSA name map
          const sources = renamedPhi.operands.map((operand) => {
            const ssaKey = `${operand.ssaName.base}.${operand.ssaName.version}`;
            const existingRegisterId = ssaNameToRegisterId.get(ssaKey);

            // If we found an existing register, use its ID; otherwise create a new one
            // Note: If not found, this indicates a potential issue in SSA renaming,
            // but we handle it gracefully by creating a new register via the function's factory
            const registerId = existingRegisterId ?? func.getValueFactory().getNextRegisterId();

            return {
              value: new VirtualRegister(
                registerId,
                IL_BYTE,
                `${operand.ssaName.base}.${operand.ssaName.version}`
              ),
              blockId: operand.blockId,
            };
          });

          // Create result register using the function's value factory for a globally unique ID
          const result = func.createRegister(
            IL_BYTE,
            `${renamedPhi.result.base}.${renamedPhi.result.version}`
          );

          // Create phi instruction
          const phiInstruction = new ILPhiInstruction(this.nextPhiId++, sources, result);

          // Insert at beginning of block (after any existing phis)
          block.insertInstruction(this.countExistingPhis(block), phiInstruction);
          phisInserted++;
        }
      }

      if (this.options.collectTimings) {
        this.phaseTimes.set(SSAConstructionPhase.PHI_INSERTION, performance.now() - startTime);
      }

      this.log(`  Inserted ${phisInserted} phi instructions into blocks`);
      return true;
    } catch (error) {
      this.addError(SSAConstructionPhase.PHI_INSERTION, `Failed to insert phi instructions: ${String(error)}`);
      return false;
    }
  }

  /**
   * Counts the number of existing phi instructions at the start of a block.
   *
   * @param block - The block to check
   * @returns Number of phi instructions at block start
   */
  protected countExistingPhis(block: BasicBlock): number {
    const instructions = block.getInstructions();
    let count = 0;

    for (const instruction of instructions) {
      if (instruction.opcode === ILOpcode.PHI) {
        count++;
      } else {
        break; // Phi instructions must be at the start
      }
    }

    return count;
  }

  /**
   * Finds a block by ID in the function.
   *
   * @param func - The IL function
   * @param blockId - The block ID to find
   * @returns The block, or undefined if not found
   */
  protected findBlock(func: ILFunction, blockId: number): BasicBlock | undefined {
    return func.getBlocks().find((b) => b.id === blockId);
  }

  // ===========================================================================
  // Phase 7: SSA Verification
  // ===========================================================================

  /**
   * Verifies that the function is in valid SSA form.
   *
   * @param func - The IL function
   * @returns true if verification passed, false if errors found
   */
  protected verifySsaForm(func: ILFunction): boolean {
    const startTime = this.options.collectTimings ? performance.now() : 0;

    if (!this.dominatorTree) {
      this.addError(SSAConstructionPhase.VERIFICATION, 'Dominator tree not computed');
      return false;
    }

    try {
      this.verificationResult = verifySSA(func, this.dominatorTree);

      if (this.options.collectTimings) {
        this.phaseTimes.set(SSAConstructionPhase.VERIFICATION, performance.now() - startTime);
      }

      if (!this.verificationResult.valid) {
        for (const error of this.verificationResult.errors) {
          this.addVerificationError(error);
        }
        return false;
      }

      this.log(`  SSA verification passed (${this.verificationResult.stats.registersVerified} registers checked)`);
      return true;
    } catch (error) {
      this.addError(SSAConstructionPhase.VERIFICATION, `Failed to verify SSA form: ${String(error)}`);
      return false;
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Initializes the phi ID counter based on existing instructions.
   *
   * @param func - The IL function
   */
  protected initializePhiIdCounter(func: ILFunction): void {
    let maxId = 0;

    for (const block of func.getBlocks()) {
      for (const instruction of block.getInstructions()) {
        if (instruction.id > maxId) {
          maxId = instruction.id;
        }
      }
    }

    this.nextPhiId = maxId + 1000; // Leave room for other IDs
  }

  /**
   * Resets the constructor state for a new construction.
   */
  protected reset(): void {
    this.currentFunction = null;
    this.dominatorTree = null;
    this.dominanceFrontiers = null;
    this.phiPlacement = null;
    this.renamingResult = null;
    this.verificationResult = null;
    this.errors = [];
    this.phaseTimes.clear();
    this.nextPhiId = 0;
  }

  /**
   * Adds an error to the error list.
   *
   * @param phase - The phase where the error occurred
   * @param message - Error message
   * @param details - Optional additional details
   */
  protected addError(phase: SSAConstructionPhase, message: string, details?: Record<string, unknown>): void {
    this.errors.push({ phase, message, details });
  }

  /**
   * Adds a verification error to the error list.
   *
   * @param error - The SSA verification error
   */
  protected addVerificationError(error: SSAVerificationError): void {
    this.addError(SSAConstructionPhase.VERIFICATION, error.message, {
      code: error.code,
      blockId: error.blockId,
      instructionId: error.instructionId,
      registerId: error.registerId,
    });
  }

  /**
   * Logs a message if verbose mode is enabled.
   *
   * @param message - The message to log
   */
  protected log(message: string): void {
    if (this.options.verbose) {
      console.log(`[SSAConstructor] ${message}`);
    }
  }

  /**
   * Builds the construction result.
   *
   * @param startTime - The start time for total time calculation
   * @returns The construction result
   */
  protected buildResult(startTime: number): SSAConstructionResult {
    const stats: SSAConstructionStats = {
      phiCount: this.phiPlacement?.totalPhiCount ?? 0,
      versionsCreated: this.renamingResult?.stats.versionsCreated ?? 0,
      blocksProcessed: this.renamingResult?.stats.blocksProcessed ?? 0,
      variablesProcessed: this.renamingResult?.stats.variablesRenamed ?? 0,
      instructionsProcessed: this.renamingResult?.stats.instructionsProcessed ?? 0,
      phaseTimes: new Map(this.phaseTimes),
      totalTime: this.options.collectTimings ? performance.now() - startTime : 0,
    };

    return {
      success: this.errors.length === 0,
      errors: [...this.errors],
      stats,
      dominatorTree: this.dominatorTree,
      dominanceFrontiers: this.dominanceFrontiers,
      phiPlacement: this.phiPlacement,
      renaming: this.renamingResult,
      verification: this.verificationResult,
    };
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Gets the computed dominator tree.
   *
   * @returns The dominator tree, or null if not computed
   */
  getDominatorTree(): DominatorTree | null {
    return this.dominatorTree;
  }

  /**
   * Gets the computed dominance frontiers.
   *
   * @returns The dominance frontiers, or null if not computed
   */
  getDominanceFrontiers(): DominanceFrontier | null {
    return this.dominanceFrontiers;
  }

  /**
   * Gets the phi placement result.
   *
   * @returns The phi placement result, or null if not computed
   */
  getPhiPlacement(): PhiPlacementResult | null {
    return this.phiPlacement;
  }

  /**
   * Gets the SSA renaming result.
   *
   * @returns The renaming result, or null if not computed
   */
  getRenamingResult(): SSARenamingResult | null {
    return this.renamingResult;
  }

  /**
   * Gets the SSA verification result.
   *
   * @returns The verification result, or null if not computed
   */
  getVerificationResult(): SSAVerificationResult | null {
    return this.verificationResult;
  }

  /**
   * Gets the current function being processed.
   *
   * @returns The current function, or null if none
   */
  getCurrentFunction(): ILFunction | null {
    return this.currentFunction;
  }

  /**
   * Gets all errors from the last construction.
   *
   * @returns Array of construction errors
   */
  getErrors(): SSAConstructionError[] {
    return [...this.errors];
  }

  /**
   * Gets the construction options.
   *
   * @returns The options used for construction
   */
  getOptions(): Readonly<Required<SSAConstructionOptions>> {
    return this.options;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Converts an IL function to SSA form.
 *
 * This is a convenience function that creates an SSAConstructor and
 * performs the conversion.
 *
 * @param func - The IL function to convert
 * @param options - Optional construction options
 * @returns The construction result
 *
 * @example
 * ```typescript
 * const result = constructSSA(ilFunction);
 *
 * if (result.success) {
 *   console.log(`SSA construction successful!`);
 * }
 * ```
 */
export function constructSSA(func: ILFunction, options?: SSAConstructionOptions): SSAConstructionResult {
  const constructor = new SSAConstructor(options);
  return constructor.construct(func);
}
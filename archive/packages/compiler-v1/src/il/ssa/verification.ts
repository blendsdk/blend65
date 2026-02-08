/**
 * SSA Form Verification for IL Functions
 *
 * This module verifies that an IL function is in valid SSA form.
 * SSA (Static Single Assignment) form has several invariants that
 * must hold for the representation to be correct:
 *
 * **SSA Invariants:**
 * 1. **Single Assignment**: Each virtual register is defined exactly once
 * 2. **Dominance**: Every use of a register is dominated by its definition
 * 3. **Phi Correctness**: Phi functions have operands from all predecessors
 * 4. **Phi Position**: Phi functions only appear at the start of blocks
 * 5. **Use Before Def**: Every use has a reaching definition
 *
 * **Why Verify SSA?**
 * - Catch bugs in SSA construction early
 * - Ensure optimizations receive valid input
 * - Validate transformations maintain SSA form
 * - Debugging aid for compiler development
 *
 * @module il/ssa/verification
 *
 * @example
 * ```typescript
 * import { verifySSA, SSAVerificationResult } from './ssa/verification.js';
 *
 * const result = verifySSA(ilFunction, domTree);
 * if (!result.valid) {
 *   console.error('SSA verification failed:');
 *   for (const error of result.errors) {
 *     console.error(`  - ${error.message} (${error.code})`);
 *   }
 * }
 * ```
 */

import type { ILFunction } from '../function.js';
import type { BasicBlock } from '../basic-block.js';
import type { VirtualRegister } from '../values.js';
import type { ILInstruction } from '../instructions.js';
import type { DominatorTree } from './dominators.js';
import { ILOpcode, ILPhiInstruction } from '../instructions.js';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Error codes for SSA verification failures.
 *
 * Each code corresponds to a specific SSA invariant violation.
 */
export enum SSAVerificationErrorCode {
  /** Register defined more than once */
  MULTIPLE_DEFINITIONS = 'MULTIPLE_DEFINITIONS',

  /** Register used but never defined */
  USE_BEFORE_DEFINITION = 'USE_BEFORE_DEFINITION',

  /** Use not dominated by definition */
  DOMINANCE_VIOLATION = 'DOMINANCE_VIOLATION',

  /** Phi function missing operand from predecessor */
  PHI_MISSING_OPERAND = 'PHI_MISSING_OPERAND',

  /** Phi function has operand from non-predecessor */
  PHI_INVALID_PREDECESSOR = 'PHI_INVALID_PREDECESSOR',

  /** Phi function not at start of block */
  PHI_NOT_AT_BLOCK_START = 'PHI_NOT_AT_BLOCK_START',

  /** Phi function in entry block (entry has no predecessors) */
  PHI_IN_ENTRY_BLOCK = 'PHI_IN_ENTRY_BLOCK',

  /** Phi operand count mismatch with predecessor count */
  PHI_OPERAND_COUNT_MISMATCH = 'PHI_OPERAND_COUNT_MISMATCH',

  /** Register used in phi has no definition for that path */
  PHI_UNDEFINED_OPERAND = 'PHI_UNDEFINED_OPERAND',

  /** Internal error during verification */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Describes a single SSA verification error.
 */
export interface SSAVerificationError {
  /**
   * Error code identifying the type of violation.
   */
  code: SSAVerificationErrorCode;

  /**
   * Human-readable error message.
   */
  message: string;

  /**
   * Block ID where the error was detected.
   */
  blockId?: number;

  /**
   * Instruction ID involved in the error.
   */
  instructionId?: number;

  /**
   * Register ID involved in the error.
   */
  registerId?: number;

  /**
   * Additional context-specific details.
   */
  details?: Record<string, unknown>;
}

/**
 * Result of SSA verification.
 */
export interface SSAVerificationResult {
  /**
   * Whether the function is in valid SSA form.
   */
  valid: boolean;

  /**
   * List of verification errors (empty if valid).
   */
  errors: SSAVerificationError[];

  /**
   * Statistics about the verification process.
   */
  stats: SSAVerificationStats;
}

/**
 * Statistics gathered during SSA verification.
 */
export interface SSAVerificationStats {
  /**
   * Number of blocks verified.
   */
  blocksVerified: number;

  /**
   * Number of instructions verified.
   */
  instructionsVerified: number;

  /**
   * Number of registers verified.
   */
  registersVerified: number;

  /**
   * Number of phi functions verified.
   */
  phisVerified: number;

  /**
   * Number of dominance checks performed.
   */
  dominanceChecks: number;
}

/**
 * Information about a register definition.
 *
 * @internal
 */
interface RegisterDefInfo {
  /**
   * Block ID where the register is defined.
   */
  blockId: number;

  /**
   * Instruction ID that defines the register.
   */
  instructionId: number;

  /**
   * Index within the block's instruction list.
   */
  instructionIndex: number;
}

/**
 * Information about a register use.
 *
 * @internal
 */
interface RegisterUseInfo {
  /**
   * Block ID where the register is used.
   */
  blockId: number;

  /**
   * Instruction ID that uses the register.
   */
  instructionId: number;

  /**
   * Index within the block's instruction list.
   */
  instructionIndex: number;

  /**
   * Whether this use is in a phi function.
   */
  isPhiUse: boolean;

  /**
   * For phi uses, the predecessor block this operand comes from.
   */
  phiPredecessorBlockId?: number;
}

// =============================================================================
// SSA Verifier Class
// =============================================================================

/**
 * Verifies that an IL function is in valid SSA form.
 *
 * The verifier checks all SSA invariants:
 * 1. Each register is defined exactly once
 * 2. Every use is dominated by its definition
 * 3. Phi functions are well-formed
 *
 * **Usage:**
 * ```typescript
 * const verifier = new SSAVerifier(domTree);
 * const result = verifier.verify(func);
 *
 * if (!result.valid) {
 *   for (const error of result.errors) {
 *     console.error(error.message);
 *   }
 * }
 * ```
 */
export class SSAVerifier {
  /**
   * Dominator tree for dominance checking.
   */
  protected readonly domTree: DominatorTree;

  /**
   * Map from register ID to its definition info.
   */
  protected definitions: Map<number, RegisterDefInfo>;

  /**
   * Map from register ID to its uses.
   */
  protected uses: Map<number, RegisterUseInfo[]>;

  /**
   * Collected verification errors.
   */
  protected errors: SSAVerificationError[];

  /**
   * Statistics counters.
   */
  protected blocksVerified: number;
  protected instructionsVerified: number;
  protected registersVerified: number;
  protected phisVerified: number;
  protected dominanceChecks: number;

  /**
   * The function being verified.
   */
  protected currentFunction: ILFunction | null;

  /**
   * Creates a new SSA verifier.
   *
   * @param domTree - Dominator tree for the function
   */
  constructor(domTree: DominatorTree) {
    this.domTree = domTree;
    this.definitions = new Map();
    this.uses = new Map();
    this.errors = [];
    this.blocksVerified = 0;
    this.instructionsVerified = 0;
    this.registersVerified = 0;
    this.phisVerified = 0;
    this.dominanceChecks = 0;
    this.currentFunction = null;
  }

  // ===========================================================================
  // Main Verification Entry Point
  // ===========================================================================

  /**
   * Verifies that the function is in valid SSA form.
   *
   * @param func - The IL function to verify
   * @returns Verification result with errors (if any)
   */
  verify(func: ILFunction): SSAVerificationResult {
    // Reset state
    this.reset();
    this.currentFunction = func;

    // Phase 1: Collect all definitions and uses
    this.collectDefinitionsAndUses(func);

    // Phase 2: Check single assignment property
    // (already checked during collection - multiple defs are errors)

    // Phase 3: Check phi function well-formedness
    this.verifyPhiFunctions(func);

    // Phase 4: Check dominance property
    this.verifyDominance(func);

    // Build result
    const stats: SSAVerificationStats = {
      blocksVerified: this.blocksVerified,
      instructionsVerified: this.instructionsVerified,
      registersVerified: this.registersVerified,
      phisVerified: this.phisVerified,
      dominanceChecks: this.dominanceChecks,
    };

    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      stats,
    };
  }

  // ===========================================================================
  // Phase 1: Collect Definitions and Uses
  // ===========================================================================

  /**
   * Collects all register definitions and uses from the function.
   *
   * Also checks the single assignment property during collection.
   *
   * @param func - The IL function to analyze
   */
  protected collectDefinitionsAndUses(func: ILFunction): void {
    const blocks = func.getBlocks();

    for (const block of blocks) {
      this.blocksVerified++;
      const instructions = block.getInstructions();

      for (let index = 0; index < instructions.length; index++) {
        const instruction = instructions[index];
        this.instructionsVerified++;

        // Collect definition (if any)
        if (instruction.result) {
          this.collectDefinition(instruction.result, block.id, instruction.id, index);
        }

        // Collect uses
        this.collectUses(instruction, block.id, index);
      }
    }

    // Count unique registers verified
    const allRegisters = new Set([...this.definitions.keys(), ...this.uses.keys()]);
    this.registersVerified = allRegisters.size;
  }

  /**
   * Records a register definition, checking for multiple definitions.
   *
   * @param register - The defined register
   * @param blockId - Block where defined
   * @param instructionId - Instruction ID
   * @param instructionIndex - Index within block
   */
  protected collectDefinition(
    register: VirtualRegister,
    blockId: number,
    instructionId: number,
    instructionIndex: number
  ): void {
    const existing = this.definitions.get(register.id);

    if (existing) {
      // Multiple definitions - SSA violation!
      this.addError({
        code: SSAVerificationErrorCode.MULTIPLE_DEFINITIONS,
        message:
          `Register r${register.id} is defined multiple times: ` +
          `first at block ${existing.blockId} instruction ${existing.instructionId}, ` +
          `again at block ${blockId} instruction ${instructionId}`,
        blockId,
        instructionId,
        registerId: register.id,
        details: {
          firstDefBlock: existing.blockId,
          firstDefInstruction: existing.instructionId,
          secondDefBlock: blockId,
          secondDefInstruction: instructionId,
        },
      });
    } else {
      this.definitions.set(register.id, {
        blockId,
        instructionId,
        instructionIndex,
      });
    }
  }

  /**
   * Collects all register uses from an instruction.
   *
   * @param instruction - The instruction to analyze
   * @param blockId - Block containing the instruction
   * @param instructionIndex - Index within block
   */
  protected collectUses(instruction: ILInstruction, blockId: number, instructionIndex: number): void {
    // Handle phi instructions specially - they have operands from specific predecessors
    if (instruction.opcode === ILOpcode.PHI) {
      const phi = instruction as ILPhiInstruction;
      for (const source of phi.sources) {
        this.addUse(source.value.id, {
          blockId,
          instructionId: instruction.id,
          instructionIndex,
          isPhiUse: true,
          phiPredecessorBlockId: source.blockId,
        });
      }
      return;
    }

    // For other instructions, collect operand uses
    const operands = this.getInstructionOperands(instruction);
    for (const operand of operands) {
      this.addUse(operand.id, {
        blockId,
        instructionId: instruction.id,
        instructionIndex,
        isPhiUse: false,
      });
    }
  }

  /**
   * Extracts operand registers from an instruction.
   *
   * @param instruction - The instruction to analyze
   * @returns Array of operand registers
   */
  protected getInstructionOperands(instruction: ILInstruction): VirtualRegister[] {
    const operands: VirtualRegister[] = [];

    // Check common operand patterns
    // The actual operands depend on instruction type
    const instr = instruction as unknown as Record<string, unknown>;

    // Binary operations: left, right
    if ('left' in instr && instr.left && typeof instr.left === 'object' && 'id' in (instr.left as object)) {
      operands.push(instr.left as VirtualRegister);
    }
    if ('right' in instr && instr.right && typeof instr.right === 'object' && 'id' in (instr.right as object)) {
      operands.push(instr.right as VirtualRegister);
    }

    // Unary operations: operand
    if ('operand' in instr && instr.operand && typeof instr.operand === 'object' && 'id' in (instr.operand as object)) {
      operands.push(instr.operand as VirtualRegister);
    }

    // Store operations: value
    if ('value' in instr && instr.value && typeof instr.value === 'object' && 'id' in (instr.value as object)) {
      operands.push(instr.value as VirtualRegister);
    }

    // Branch operations: condition
    if (
      'condition' in instr &&
      instr.condition &&
      typeof instr.condition === 'object' &&
      'id' in (instr.condition as object)
    ) {
      operands.push(instr.condition as VirtualRegister);
    }

    // Return operations: returnValue
    if (
      'returnValue' in instr &&
      instr.returnValue &&
      typeof instr.returnValue === 'object' &&
      'id' in (instr.returnValue as object)
    ) {
      operands.push(instr.returnValue as VirtualRegister);
    }

    // Call operations: arguments
    if ('args' in instr && Array.isArray(instr.args)) {
      for (const arg of instr.args) {
        if (arg && typeof arg === 'object' && 'id' in arg) {
          operands.push(arg as VirtualRegister);
        }
      }
    }

    // Memory operations: address, index, source
    if (
      'address' in instr &&
      instr.address &&
      typeof instr.address === 'object' &&
      'id' in (instr.address as object)
    ) {
      operands.push(instr.address as VirtualRegister);
    }
    if ('index' in instr && instr.index && typeof instr.index === 'object' && 'id' in (instr.index as object)) {
      operands.push(instr.index as VirtualRegister);
    }
    if ('source' in instr && instr.source && typeof instr.source === 'object' && 'id' in (instr.source as object)) {
      operands.push(instr.source as VirtualRegister);
    }

    return operands;
  }

  /**
   * Adds a use record for a register.
   *
   * @param registerId - The register ID
   * @param useInfo - Information about the use
   */
  protected addUse(registerId: number, useInfo: RegisterUseInfo): void {
    let useList = this.uses.get(registerId);
    if (!useList) {
      useList = [];
      this.uses.set(registerId, useList);
    }
    useList.push(useInfo);
  }

  // ===========================================================================
  // Phase 2: Verify Phi Functions
  // ===========================================================================

  /**
   * Verifies all phi functions are well-formed.
   *
   * Checks:
   * - Phi functions only at block start
   * - No phi in entry block
   * - Operand count matches predecessor count
   * - Operands come from actual predecessors
   *
   * @param func - The IL function to verify
   */
  protected verifyPhiFunctions(func: ILFunction): void {
    const blocks = func.getBlocks();
    const entryBlockId = this.domTree.getEntryBlockId();

    for (const block of blocks) {
      const instructions = block.getInstructions();
      let seenNonPhi = false;

      for (let index = 0; index < instructions.length; index++) {
        const instruction = instructions[index];

        if (instruction.opcode === ILOpcode.PHI) {
          this.phisVerified++;
          const phi = instruction as ILPhiInstruction;

          // Check: Phi not in entry block
          if (block.id === entryBlockId) {
            this.addError({
              code: SSAVerificationErrorCode.PHI_IN_ENTRY_BLOCK,
              message: `Phi function (instruction ${instruction.id}) in entry block ${block.id}`,
              blockId: block.id,
              instructionId: instruction.id,
            });
          }

          // Check: Phi only at block start
          if (seenNonPhi) {
            this.addError({
              code: SSAVerificationErrorCode.PHI_NOT_AT_BLOCK_START,
              message:
                `Phi function (instruction ${instruction.id}) not at start of block ${block.id}` +
                ` (found after non-phi instruction at index ${index})`,
              blockId: block.id,
              instructionId: instruction.id,
            });
          }

          // Verify phi operands
          this.verifyPhiOperands(phi, block);
        } else {
          seenNonPhi = true;
        }
      }
    }
  }

  /**
   * Verifies a phi function's operands match its predecessors.
   *
   * @param phi - The phi instruction
   * @param block - The block containing the phi
   */
  protected verifyPhiOperands(phi: ILPhiInstruction, block: BasicBlock): void {
    const predecessors = block.getPredecessors();
    const predecessorIds = new Set(predecessors.map((p) => p.id));
    const sourcePredecessorIds = new Set(phi.sources.map((src) => src.blockId));

    // Check: Source count matches predecessor count
    if (phi.sources.length !== predecessors.length) {
      this.addError({
        code: SSAVerificationErrorCode.PHI_OPERAND_COUNT_MISMATCH,
        message:
          `Phi function (instruction ${phi.id}) in block ${block.id} has ` +
          `${phi.sources.length} operands but block has ${predecessors.length} predecessors`,
        blockId: block.id,
        instructionId: phi.id,
        details: {
          operandCount: phi.sources.length,
          predecessorCount: predecessors.length,
          predecessorIds: Array.from(predecessorIds),
        },
      });
    }

    // Check: Each source comes from an actual predecessor
    for (const source of phi.sources) {
      if (!predecessorIds.has(source.blockId)) {
        this.addError({
          code: SSAVerificationErrorCode.PHI_INVALID_PREDECESSOR,
          message:
            `Phi function (instruction ${phi.id}) in block ${block.id} has operand ` +
            `from block ${source.blockId} which is not a predecessor`,
          blockId: block.id,
          instructionId: phi.id,
          details: {
            invalidPredecessor: source.blockId,
            actualPredecessors: Array.from(predecessorIds),
          },
        });
      }
    }

    // Check: Each predecessor has a corresponding source
    for (const predId of predecessorIds) {
      if (!sourcePredecessorIds.has(predId)) {
        this.addError({
          code: SSAVerificationErrorCode.PHI_MISSING_OPERAND,
          message:
            `Phi function (instruction ${phi.id}) in block ${block.id} is missing ` +
            `operand from predecessor block ${predId}`,
          blockId: block.id,
          instructionId: phi.id,
          details: {
            missingPredecessor: predId,
            providedPredecessors: Array.from(sourcePredecessorIds),
          },
        });
      }
    }
  }

  // ===========================================================================
  // Phase 3: Verify Dominance Property
  // ===========================================================================

  /**
   * Verifies that all uses are dominated by their definitions.
   *
   * For regular uses: the definition's block must dominate the use's block,
   * OR they're in the same block and def comes before use.
   *
   * For phi uses: the definition must dominate the predecessor block
   * that the phi operand comes from.
   *
   * @param _func - The IL function (unused, uses collected data)
   */
  protected verifyDominance(_func: ILFunction): void {
    for (const [registerId, useList] of this.uses) {
      const def = this.definitions.get(registerId);

      // Check: Register must be defined
      if (!def) {
        // Report for each use
        for (const use of useList) {
          this.addError({
            code: SSAVerificationErrorCode.USE_BEFORE_DEFINITION,
            message:
              `Register r${registerId} used in block ${use.blockId} ` +
              `(instruction ${use.instructionId}) but never defined`,
            blockId: use.blockId,
            instructionId: use.instructionId,
            registerId,
          });
        }
        continue;
      }

      // Check dominance for each use
      for (const use of useList) {
        this.dominanceChecks++;

        if (use.isPhiUse) {
          // For phi uses, definition must dominate the predecessor block
          // The predecessor block is where the value "comes from"
          this.verifyPhiUseDominance(registerId, def, use);
        } else {
          // For regular uses, definition must dominate use
          this.verifyRegularUseDominance(registerId, def, use);
        }
      }
    }
  }

  /**
   * Verifies dominance for a regular (non-phi) use.
   *
   * @param registerId - The register ID
   * @param def - Definition info
   * @param use - Use info
   */
  protected verifyRegularUseDominance(registerId: number, def: RegisterDefInfo, use: RegisterUseInfo): void {
    if (def.blockId === use.blockId) {
      // Same block: def must come before use
      if (def.instructionIndex >= use.instructionIndex) {
        this.addError({
          code: SSAVerificationErrorCode.DOMINANCE_VIOLATION,
          message:
            `Register r${registerId} used before defined in same block ${use.blockId}: ` +
            `defined at instruction index ${def.instructionIndex}, ` +
            `used at instruction index ${use.instructionIndex}`,
          blockId: use.blockId,
          instructionId: use.instructionId,
          registerId,
          details: {
            defInstructionIndex: def.instructionIndex,
            useInstructionIndex: use.instructionIndex,
          },
        });
      }
    } else {
      // Different blocks: def's block must dominate use's block
      if (!this.domTree.dominates(def.blockId, use.blockId)) {
        this.addError({
          code: SSAVerificationErrorCode.DOMINANCE_VIOLATION,
          message:
            `Register r${registerId} use in block ${use.blockId} not dominated by ` +
            `definition in block ${def.blockId}`,
          blockId: use.blockId,
          instructionId: use.instructionId,
          registerId,
          details: {
            defBlock: def.blockId,
            useBlock: use.blockId,
          },
        });
      }
    }
  }

  /**
   * Verifies dominance for a phi operand use.
   *
   * For phi functions, the value comes from a predecessor block,
   * so the definition must dominate that predecessor, not the
   * phi's block itself.
   *
   * @param registerId - The register ID
   * @param def - Definition info
   * @param use - Use info (with phiPredecessorBlockId set)
   */
  protected verifyPhiUseDominance(registerId: number, def: RegisterDefInfo, use: RegisterUseInfo): void {
    const predecessorBlockId = use.phiPredecessorBlockId;

    if (predecessorBlockId === undefined) {
      // Internal error - phi use should have predecessor block ID
      this.addError({
        code: SSAVerificationErrorCode.INTERNAL_ERROR,
        message: `Phi use of r${registerId} missing predecessor block ID`,
        blockId: use.blockId,
        instructionId: use.instructionId,
        registerId,
      });
      return;
    }

    // Definition must dominate the predecessor block
    // (or be in the predecessor block, which self-dominates)
    if (!this.domTree.dominates(def.blockId, predecessorBlockId)) {
      this.addError({
        code: SSAVerificationErrorCode.DOMINANCE_VIOLATION,
        message:
          `Phi operand r${registerId} in block ${use.blockId} (from predecessor ${predecessorBlockId}) ` +
          `not dominated by definition in block ${def.blockId}`,
        blockId: use.blockId,
        instructionId: use.instructionId,
        registerId,
        details: {
          defBlock: def.blockId,
          phiBlock: use.blockId,
          predecessorBlock: predecessorBlockId,
        },
      });
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Adds an error to the error list.
   *
   * @param error - The error to add
   */
  protected addError(error: SSAVerificationError): void {
    this.errors.push(error);
  }

  /**
   * Resets the verifier state for a new verification.
   */
  protected reset(): void {
    this.definitions.clear();
    this.uses.clear();
    this.errors = [];
    this.blocksVerified = 0;
    this.instructionsVerified = 0;
    this.registersVerified = 0;
    this.phisVerified = 0;
    this.dominanceChecks = 0;
    this.currentFunction = null;
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Gets the dominator tree used for verification.
   *
   * @returns The dominator tree
   */
  getDominatorTree(): DominatorTree {
    return this.domTree;
  }

  /**
   * Gets all collected errors.
   *
   * @returns Array of verification errors
   */
  getErrors(): SSAVerificationError[] {
    return [...this.errors];
  }

  /**
   * Gets the definition info for a register.
   *
   * @param registerId - The register ID
   * @returns Definition info, or undefined if not defined
   */
  getDefinition(registerId: number): RegisterDefInfo | undefined {
    return this.definitions.get(registerId);
  }

  /**
   * Gets all uses of a register.
   *
   * @param registerId - The register ID
   * @returns Array of use info, or empty array if no uses
   */
  getUses(registerId: number): RegisterUseInfo[] {
    return this.uses.get(registerId) ?? [];
  }
}

// =============================================================================
// Convenience Function
// =============================================================================

/**
 * Verifies that an IL function is in valid SSA form.
 *
 * This is a convenience function that creates an SSAVerifier and
 * performs the verification.
 *
 * @param func - The IL function to verify
 * @param domTree - Dominator tree for the function
 * @returns Verification result
 *
 * @example
 * ```typescript
 * const domTree = computeDominators(func);
 * const result = verifySSA(func, domTree);
 *
 * if (!result.valid) {
 *   console.error('SSA verification failed:');
 *   for (const error of result.errors) {
 *     console.error(`  ${error.code}: ${error.message}`);
 *   }
 * }
 * ```
 */
export function verifySSA(func: ILFunction, domTree: DominatorTree): SSAVerificationResult {
  const verifier = new SSAVerifier(domTree);
  return verifier.verify(func);
}
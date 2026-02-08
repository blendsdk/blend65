/**
 * Basic Block - fundamental unit of control flow in IL
 *
 * A basic block is a sequence of instructions with:
 * - Single entry point (the first instruction)
 * - Single exit point (the last instruction, which must be a terminator)
 * - No branches except at the end
 *
 * Basic blocks are connected to form a Control Flow Graph (CFG).
 *
 * @module il/basic-block
 */

import type { ILLabel } from './values.js';
import { ILInstruction } from './instructions.js';

/**
 * Represents a basic block in the IL control flow graph.
 *
 * A basic block is a sequence of instructions that execute sequentially
 * without any branches except at the very end. This structure enables
 * efficient dataflow analysis and optimization.
 *
 * Key properties:
 * - Instructions execute in order
 * - Only the last instruction can transfer control
 * - All predecessors and successors are tracked for CFG analysis
 *
 * @example
 * ```typescript
 * // Create a basic block
 * const block = new BasicBlock(0, 'entry');
 *
 * // Add instructions
 * block.addInstruction(new ILConstInstruction(0, 42, IL_BYTE, v0));
 * block.addInstruction(new ILReturnInstruction(1, v0));
 *
 * // Check properties
 * block.isEmpty() // false
 * block.hasTerminator() // true (ends with RETURN)
 * ```
 */
export class BasicBlock {
  /** Instructions in this block (in execution order) */
  protected readonly instructions: ILInstruction[] = [];

  /** Predecessor blocks in the CFG (blocks that jump/branch to this block) */
  protected readonly predecessors: Set<BasicBlock> = new Set();

  /** Successor blocks in the CFG (blocks this block can jump/branch to) */
  protected readonly successors: Set<BasicBlock> = new Set();

  /** Whether this block is an exit block (contains a return instruction) */
  protected isExitBlock = false;

  /**
   * Creates a new basic block.
   *
   * @param id - Unique block identifier within the function
   * @param label - Human-readable label for the block
   */
  constructor(
    public readonly id: number,
    public readonly label: string,
  ) {}

  // ===========================================================================
  // Instruction Management
  // ===========================================================================

  /**
   * Adds an instruction to the end of this block.
   *
   * Note: Instructions should be added in execution order.
   * The last instruction added should be a terminator.
   *
   * @param instruction - The instruction to add
   * @throws Error if trying to add an instruction after a terminator
   */
  addInstruction(instruction: ILInstruction): void {
    // Check if we already have a terminator
    if (this.hasTerminator()) {
      throw new Error(
        `Cannot add instruction after terminator in block '${this.label}'. ` +
          `Block already ends with ${this.getTerminator()?.opcode}`,
      );
    }

    this.instructions.push(instruction);

    // Track if this is an exit block (has a return instruction)
    if (instruction.opcode === 'RETURN' || instruction.opcode === 'RETURN_VOID') {
      this.isExitBlock = true;
    }
  }

  /**
   * Inserts an instruction at a specific index.
   *
   * @param index - Position to insert at (0-based)
   * @param instruction - The instruction to insert
   * @throws Error if index is out of bounds
   */
  insertInstruction(index: number, instruction: ILInstruction): void {
    if (index < 0 || index > this.instructions.length) {
      throw new Error(
        `Invalid insertion index ${index} for block '${this.label}' ` +
          `with ${this.instructions.length} instructions`,
      );
    }

    // Cannot insert after terminator (except at the end to replace it)
    if (this.hasTerminator() && index === this.instructions.length) {
      throw new Error(`Cannot insert instruction after terminator in block '${this.label}'`);
    }

    this.instructions.splice(index, 0, instruction);
  }

  /**
   * Removes an instruction at a specific index.
   *
   * @param index - Position to remove from (0-based)
   * @returns The removed instruction
   * @throws Error if index is out of bounds
   */
  removeInstruction(index: number): ILInstruction {
    if (index < 0 || index >= this.instructions.length) {
      throw new Error(
        `Invalid removal index ${index} for block '${this.label}' ` +
          `with ${this.instructions.length} instructions`,
      );
    }

    const [removed] = this.instructions.splice(index, 1);

    // Update exit block status if we removed a return
    if (removed.opcode === 'RETURN' || removed.opcode === 'RETURN_VOID') {
      this.isExitBlock = false;
    }

    return removed;
  }

  /**
   * Replaces an instruction at a specific index.
   *
   * @param index - Position to replace at (0-based)
   * @param instruction - The new instruction
   * @returns The replaced instruction
   * @throws Error if index is out of bounds
   */
  replaceInstruction(index: number, instruction: ILInstruction): ILInstruction {
    if (index < 0 || index >= this.instructions.length) {
      throw new Error(
        `Invalid replacement index ${index} for block '${this.label}' ` +
          `with ${this.instructions.length} instructions`,
      );
    }

    const old = this.instructions[index];
    this.instructions[index] = instruction;

    // Update exit block status
    if (old.opcode === 'RETURN' || old.opcode === 'RETURN_VOID') {
      this.isExitBlock = false;
    }
    if (instruction.opcode === 'RETURN' || instruction.opcode === 'RETURN_VOID') {
      this.isExitBlock = true;
    }

    return old;
  }

  /**
   * Gets all instructions in this block.
   *
   * @returns Readonly array of instructions
   */
  getInstructions(): readonly ILInstruction[] {
    return this.instructions;
  }

  /**
   * Gets the instruction at a specific index.
   *
   * @param index - Position to get from (0-based)
   * @returns The instruction at that index, or undefined if out of bounds
   */
  getInstruction(index: number): ILInstruction | undefined {
    return this.instructions[index];
  }

  /**
   * Gets the number of instructions in this block.
   *
   * @returns Instruction count
   */
  getInstructionCount(): number {
    return this.instructions.length;
  }

  /**
   * Checks if this block has no instructions.
   *
   * @returns true if block has no instructions
   */
  isEmpty(): boolean {
    return this.instructions.length === 0;
  }

  // ===========================================================================
  // Terminator Management
  // ===========================================================================

  /**
   * Gets the terminator instruction (last instruction if it's a terminator).
   *
   * @returns The terminator instruction, or undefined if none
   */
  getTerminator(): ILInstruction | undefined {
    if (this.instructions.length === 0) {
      return undefined;
    }

    const last = this.instructions[this.instructions.length - 1];
    return last.isTerminator() ? last : undefined;
  }

  /**
   * Checks if this block has a terminator instruction.
   *
   * A properly formed block must end with a terminator (JUMP, BRANCH, RETURN).
   *
   * @returns true if block ends with a terminator
   */
  hasTerminator(): boolean {
    return this.getTerminator() !== undefined;
  }

  /**
   * Checks if this block is an exit block (ends with a return).
   *
   * @returns true if block contains a return instruction
   */
  isExit(): boolean {
    return this.isExitBlock;
  }

  // ===========================================================================
  // CFG Navigation
  // ===========================================================================

  /**
   * Adds a predecessor block.
   *
   * Called internally when CFG edges are created.
   *
   * @param block - The predecessor block
   */
  addPredecessor(block: BasicBlock): void {
    this.predecessors.add(block);
  }

  /**
   * Removes a predecessor block.
   *
   * @param block - The predecessor block to remove
   * @returns true if the block was removed
   */
  removePredecessor(block: BasicBlock): boolean {
    return this.predecessors.delete(block);
  }

  /**
   * Gets all predecessor blocks.
   *
   * @returns Array of predecessor blocks
   */
  getPredecessors(): BasicBlock[] {
    return Array.from(this.predecessors);
  }

  /**
   * Gets the number of predecessor blocks.
   *
   * @returns Predecessor count
   */
  getPredecessorCount(): number {
    return this.predecessors.size;
  }

  /**
   * Checks if a block is a predecessor.
   *
   * @param block - Block to check
   * @returns true if block is a predecessor
   */
  hasPredecessor(block: BasicBlock): boolean {
    return this.predecessors.has(block);
  }

  /**
   * Adds a successor block.
   *
   * Called internally when CFG edges are created.
   *
   * @param block - The successor block
   */
  addSuccessor(block: BasicBlock): void {
    this.successors.add(block);
  }

  /**
   * Removes a successor block.
   *
   * @param block - The successor block to remove
   * @returns true if the block was removed
   */
  removeSuccessor(block: BasicBlock): boolean {
    return this.successors.delete(block);
  }

  /**
   * Gets all successor blocks.
   *
   * @returns Array of successor blocks
   */
  getSuccessors(): BasicBlock[] {
    return Array.from(this.successors);
  }

  /**
   * Gets the number of successor blocks.
   *
   * @returns Successor count
   */
  getSuccessorCount(): number {
    return this.successors.size;
  }

  /**
   * Checks if a block is a successor.
   *
   * @param block - Block to check
   * @returns true if block is a successor
   */
  hasSuccessor(block: BasicBlock): boolean {
    return this.successors.has(block);
  }

  // ===========================================================================
  // CFG Edge Management
  // ===========================================================================

  /**
   * Creates a directed edge from this block to a target block.
   *
   * Updates both this block's successors and the target's predecessors.
   *
   * @param target - The target block
   */
  linkTo(target: BasicBlock): void {
    this.addSuccessor(target);
    target.addPredecessor(this);
  }

  /**
   * Removes the edge from this block to a target block.
   *
   * Updates both this block's successors and the target's predecessors.
   *
   * @param target - The target block to unlink
   * @returns true if the edge existed and was removed
   */
  unlinkFrom(target: BasicBlock): boolean {
    const removed = this.removeSuccessor(target);
    if (removed) {
      target.removePredecessor(this);
    }
    return removed;
  }

  /**
   * Removes all CFG edges (both predecessors and successors).
   *
   * Used when removing a block from the CFG.
   */
  unlinkAll(): void {
    // Remove from all predecessors' successors
    for (const pred of this.predecessors) {
      pred.removeSuccessor(this);
    }

    // Remove from all successors' predecessors
    for (const succ of this.successors) {
      succ.removePredecessor(this);
    }

    this.predecessors.clear();
    this.successors.clear();
  }

  // ===========================================================================
  // Analysis Helpers
  // ===========================================================================

  /**
   * Checks if this block is the entry block (has no predecessors).
   *
   * Note: Only the first block of a function should be an entry block.
   *
   * @returns true if block has no predecessors
   */
  isEntry(): boolean {
    return this.predecessors.size === 0;
  }

  /**
   * Gets all phi instructions at the start of this block.
   *
   * Phi instructions must be at the beginning of a block.
   *
   * @returns Array of phi instructions
   */
  getPhiInstructions(): ILInstruction[] {
    const phis: ILInstruction[] = [];
    for (const inst of this.instructions) {
      if (inst.opcode === 'PHI') {
        phis.push(inst);
      } else {
        // Phi instructions must be at the start
        break;
      }
    }
    return phis;
  }

  /**
   * Gets non-phi instructions (all instructions after phi section).
   *
   * @returns Array of non-phi instructions
   */
  getNonPhiInstructions(): ILInstruction[] {
    let phiEnd = 0;
    for (let i = 0; i < this.instructions.length; i++) {
      if (this.instructions[i].opcode !== 'PHI') {
        phiEnd = i;
        break;
      }
    }
    return this.instructions.slice(phiEnd);
  }

  /**
   * Creates a label for this block.
   *
   * @returns An ILLabel pointing to this block
   */
  getLabel(): ILLabel {
    return Object.freeze({
      kind: 'label' as const,
      name: this.label,
      blockId: this.id,
    });
  }

  // ===========================================================================
  // Debugging
  // ===========================================================================

  /**
   * Returns a string representation of this block.
   *
   * @returns Human-readable block description
   */
  toString(): string {
    return `block${this.id}:${this.label}`;
  }

  /**
   * Returns a detailed string representation including all instructions.
   *
   * @returns Multi-line block representation
   */
  toDetailedString(): string {
    const lines: string[] = [];
    lines.push(`${this.label}:`);

    if (this.predecessors.size > 0) {
      const preds = Array.from(this.predecessors)
        .map((b) => b.label)
        .join(', ');
      lines.push(`  ; predecessors: ${preds}`);
    }

    for (const inst of this.instructions) {
      lines.push(`  ${inst.toString()}`);
    }

    if (this.successors.size > 0) {
      const succs = Array.from(this.successors)
        .map((b) => b.label)
        .join(', ');
      lines.push(`  ; successors: ${succs}`);
    }

    return lines.join('\n');
  }
}
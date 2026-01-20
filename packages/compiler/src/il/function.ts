/**
 * IL Function - represents a function in the IL representation
 *
 * An IL function contains:
 * - Function signature (name, parameters, return type)
 * - Collection of basic blocks forming the control flow graph
 * - Entry block (first block executed)
 * - Exit blocks (blocks that return from the function)
 *
 * @module il/function
 */

import { BasicBlock } from './basic-block.js';
import type { ILType, ILFunctionType } from './types.js';
import { IL_VOID, createFunctionType } from './types.js';
import { VirtualRegister, ILValueFactory } from './values.js';

/**
 * Function parameter definition.
 *
 * Each parameter has a name and type.
 */
export interface ILParameter {
  /** Parameter name */
  readonly name: string;

  /** Parameter IL type */
  readonly type: ILType;
}

/**
 * Storage class for global variables.
 *
 * Determines where variables are allocated in memory.
 */
export enum ILStorageClass {
  /** Zero page storage (fast access, limited space) */
  ZeroPage = 'zeropage',

  /** Regular RAM storage */
  Ram = 'ram',

  /** Read-only data section */
  Data = 'data',

  /** Hardware-mapped address (not allocated, fixed address) */
  Map = 'map',
}

/**
 * Represents a function in the IL representation.
 *
 * An ILFunction owns a collection of BasicBlocks that form its control flow graph.
 * The first block is always the entry block, and blocks ending with RETURN
 * instructions are exit blocks.
 *
 * Key responsibilities:
 * - Managing basic blocks and their interconnections
 * - Tracking function signature (parameters and return type)
 * - Providing CFG traversal utilities
 * - Managing local value allocation via ILValueFactory
 *
 * @example
 * ```typescript
 * // Create a function
 * const func = new ILFunction('add', [
 *   { name: 'a', type: IL_BYTE },
 *   { name: 'b', type: IL_BYTE },
 * ], IL_BYTE);
 *
 * // Get entry block and add instructions
 * const entry = func.getEntryBlock();
 * // ... add instructions ...
 *
 * // Create additional blocks for control flow
 * const loopBlock = func.createBlock('loop');
 * ```
 */
export class ILFunction {
  /** All basic blocks in this function (indexed by ID) */
  protected readonly blocks: Map<number, BasicBlock> = new Map();

  /** Next available block ID */
  protected nextBlockId = 0;

  /** Entry block ID (always 0) */
  protected entryBlockId = 0;

  /** Value factory for creating registers and labels */
  protected readonly valueFactory: ILValueFactory;

  /** Parameter registers (created during construction) */
  protected readonly parameterRegisters: VirtualRegister[] = [];

  /** Function type (computed from parameters and return type) */
  protected readonly functionType: ILFunctionType;

  /** Whether this function is exported */
  protected isExported = false;

  /** Whether this function is an interrupt handler */
  protected isInterrupt = false;

  /** Storage class hints for parameters */
  protected readonly parameterStorageHints: Map<string, ILStorageClass> = new Map();

  /**
   * Creates a new IL function.
   *
   * Automatically creates an entry block.
   *
   * @param name - Function name
   * @param parameters - Array of parameter definitions
   * @param returnType - Return type (IL_VOID for void functions)
   */
  constructor(
    public readonly name: string,
    public readonly parameters: readonly ILParameter[],
    public readonly returnType: ILType = IL_VOID,
  ) {
    this.valueFactory = new ILValueFactory();

    // Create function type
    this.functionType = createFunctionType(
      parameters.map((p) => p.type),
      returnType,
    );

    // Create parameter registers
    for (const param of parameters) {
      const reg = this.valueFactory.createRegister(param.type, param.name);
      this.parameterRegisters.push(reg);
    }

    // Create entry block
    this.createBlock('entry');
  }

  // ===========================================================================
  // Block Management
  // ===========================================================================

  /**
   * Creates a new basic block and adds it to the function.
   *
   * @param label - Human-readable label for the block
   * @returns The newly created block
   */
  createBlock(label: string): BasicBlock {
    const id = this.nextBlockId++;
    const block = new BasicBlock(id, label);
    this.blocks.set(id, block);
    return block;
  }

  /**
   * Gets a block by its ID.
   *
   * @param id - Block ID
   * @returns The block, or undefined if not found
   */
  getBlock(id: number): BasicBlock | undefined {
    return this.blocks.get(id);
  }

  /**
   * Gets the entry block (first block executed).
   *
   * @returns The entry block
   */
  getEntryBlock(): BasicBlock {
    const entry = this.blocks.get(this.entryBlockId);
    if (!entry) {
      throw new Error(`Entry block not found in function '${this.name}'`);
    }
    return entry;
  }

  /**
   * Gets all blocks that are exit blocks (contain return instructions).
   *
   * @returns Array of exit blocks
   */
  getExitBlocks(): BasicBlock[] {
    const exits: BasicBlock[] = [];
    for (const block of this.blocks.values()) {
      if (block.isExit()) {
        exits.push(block);
      }
    }
    return exits;
  }

  /**
   * Gets all basic blocks in this function.
   *
   * @returns Array of all blocks
   */
  getBlocks(): BasicBlock[] {
    return Array.from(this.blocks.values());
  }

  /**
   * Gets the number of basic blocks.
   *
   * @returns Block count
   */
  getBlockCount(): number {
    return this.blocks.size;
  }

  /**
   * Removes a block from the function.
   *
   * Also removes all CFG edges to/from the block.
   *
   * @param id - Block ID to remove
   * @returns true if the block was removed
   */
  removeBlock(id: number): boolean {
    const block = this.blocks.get(id);
    if (!block) {
      return false;
    }

    // Cannot remove entry block
    if (id === this.entryBlockId) {
      throw new Error(`Cannot remove entry block from function '${this.name}'`);
    }

    // Unlink all CFG edges
    block.unlinkAll();

    return this.blocks.delete(id);
  }

  // ===========================================================================
  // CFG Traversal
  // ===========================================================================

  /**
   * Gets blocks in reverse postorder (good for forward dataflow).
   *
   * Reverse postorder visits a node before its successors in the DFS tree,
   * making it ideal for forward dataflow analysis.
   *
   * @returns Blocks in reverse postorder
   */
  getBlocksInReversePostorder(): BasicBlock[] {
    const visited = new Set<number>();
    const postorder: BasicBlock[] = [];

    const visit = (block: BasicBlock): void => {
      if (visited.has(block.id)) {
        return;
      }
      visited.add(block.id);

      for (const succ of block.getSuccessors()) {
        visit(succ);
      }

      postorder.push(block);
    };

    visit(this.getEntryBlock());

    // Reverse to get reverse postorder
    return postorder.reverse();
  }

  /**
   * Gets blocks in postorder (good for backward dataflow).
   *
   * @returns Blocks in postorder
   */
  getBlocksInPostorder(): BasicBlock[] {
    const visited = new Set<number>();
    const postorder: BasicBlock[] = [];

    const visit = (block: BasicBlock): void => {
      if (visited.has(block.id)) {
        return;
      }
      visited.add(block.id);

      for (const succ of block.getSuccessors()) {
        visit(succ);
      }

      postorder.push(block);
    };

    visit(this.getEntryBlock());
    return postorder;
  }

  /**
   * Finds all blocks reachable from the entry block.
   *
   * @returns Set of reachable block IDs
   */
  getReachableBlocks(): Set<number> {
    const reachable = new Set<number>();
    const worklist: BasicBlock[] = [this.getEntryBlock()];

    while (worklist.length > 0) {
      const block = worklist.pop()!;
      if (reachable.has(block.id)) {
        continue;
      }
      reachable.add(block.id);

      for (const succ of block.getSuccessors()) {
        if (!reachable.has(succ.id)) {
          worklist.push(succ);
        }
      }
    }

    return reachable;
  }

  /**
   * Finds unreachable blocks (dead code).
   *
   * @returns Array of unreachable blocks
   */
  getUnreachableBlocks(): BasicBlock[] {
    const reachable = this.getReachableBlocks();
    const unreachable: BasicBlock[] = [];

    for (const block of this.blocks.values()) {
      if (!reachable.has(block.id)) {
        unreachable.push(block);
      }
    }

    return unreachable;
  }

  // ===========================================================================
  // Dominator Tree Support
  // ===========================================================================

  /**
   * Computes the immediate dominator for each block.
   *
   * Uses the Cooper-Harvey-Kennedy algorithm for simplicity.
   * Returns a map from block ID to its immediate dominator's ID.
   * The entry block has no dominator (mapped to -1).
   *
   * @returns Map from block ID to immediate dominator ID
   */
  computeDominators(): Map<number, number> {
    const blocks = this.getBlocksInReversePostorder();
    const blockIndex = new Map<number, number>();
    for (let i = 0; i < blocks.length; i++) {
      blockIndex.set(blocks[i].id, i);
    }

    // Initialize dominators
    const idom = new Map<number, number>();
    for (const block of blocks) {
      idom.set(block.id, -1); // -1 means undefined
    }
    idom.set(this.entryBlockId, this.entryBlockId); // Entry dominates itself

    // Intersect helper
    const intersect = (b1: number, b2: number): number => {
      let finger1 = blockIndex.get(b1)!;
      let finger2 = blockIndex.get(b2)!;

      while (finger1 !== finger2) {
        while (finger1 > finger2) {
          finger1 = blockIndex.get(idom.get(blocks[finger1].id)!)!;
        }
        while (finger2 > finger1) {
          finger2 = blockIndex.get(idom.get(blocks[finger2].id)!)!;
        }
      }

      return blocks[finger1].id;
    };

    // Iterate until fixed point
    let changed = true;
    while (changed) {
      changed = false;

      for (const block of blocks) {
        if (block.id === this.entryBlockId) {
          continue;
        }

        // Find first processed predecessor
        let newIdom = -1;
        for (const pred of block.getPredecessors()) {
          if (idom.get(pred.id) !== -1) {
            newIdom = pred.id;
            break;
          }
        }

        // Intersect with other predecessors
        for (const pred of block.getPredecessors()) {
          if (pred.id !== newIdom && idom.get(pred.id) !== -1) {
            newIdom = intersect(newIdom, pred.id);
          }
        }

        if (idom.get(block.id) !== newIdom) {
          idom.set(block.id, newIdom);
          changed = true;
        }
      }
    }

    return idom;
  }

  /**
   * Computes the dominance frontier for each block.
   *
   * The dominance frontier of a block B is the set of blocks where
   * B's dominance ends - these are the blocks where phi functions
   * may need to be inserted.
   *
   * @returns Map from block ID to set of frontier block IDs
   */
  computeDominanceFrontier(): Map<number, Set<number>> {
    const idom = this.computeDominators();
    const frontier = new Map<number, Set<number>>();

    // Initialize empty frontiers
    for (const block of this.blocks.values()) {
      frontier.set(block.id, new Set());
    }

    // Compute frontiers
    for (const block of this.blocks.values()) {
      const preds = block.getPredecessors();
      if (preds.length < 2) {
        continue;
      }

      for (const pred of preds) {
        let runner = pred.id;
        while (runner !== idom.get(block.id) && runner !== -1) {
          frontier.get(runner)!.add(block.id);
          runner = idom.get(runner)!;
        }
      }
    }

    return frontier;
  }

  // ===========================================================================
  // Value Factory Access
  // ===========================================================================

  /**
   * Gets the value factory for this function.
   *
   * Used to create registers and labels.
   *
   * @returns The value factory
   */
  getValueFactory(): ILValueFactory {
    return this.valueFactory;
  }

  /**
   * Creates a new virtual register.
   *
   * Convenience method that delegates to the value factory.
   *
   * @param type - IL type for the register
   * @param name - Optional name for debugging
   * @returns A new virtual register
   */
  createRegister(type: ILType, name?: string): VirtualRegister {
    return this.valueFactory.createRegister(type, name);
  }

  // ===========================================================================
  // Parameter Access
  // ===========================================================================

  /**
   * Gets the register for a parameter by index.
   *
   * @param index - Parameter index (0-based)
   * @returns The parameter's register, or undefined if out of bounds
   */
  getParameterRegister(index: number): VirtualRegister | undefined {
    return this.parameterRegisters[index];
  }

  /**
   * Gets all parameter registers.
   *
   * @returns Readonly array of parameter registers
   */
  getParameterRegisters(): readonly VirtualRegister[] {
    return this.parameterRegisters;
  }

  /**
   * Gets the register for a parameter by name.
   *
   * @param name - Parameter name
   * @returns The parameter's register, or undefined if not found
   */
  getParameterRegisterByName(name: string): VirtualRegister | undefined {
    const index = this.parameters.findIndex((p) => p.name === name);
    return index >= 0 ? this.parameterRegisters[index] : undefined;
  }

  // ===========================================================================
  // Function Properties
  // ===========================================================================

  /**
   * Gets the function type.
   *
   * @returns The function's IL type
   */
  getFunctionType(): ILFunctionType {
    return this.functionType;
  }

  /**
   * Checks if this function returns void.
   *
   * @returns true if return type is void
   */
  isVoid(): boolean {
    return this.returnType.kind === 'void';
  }

  /**
   * Sets whether this function is exported.
   *
   * @param exported - Whether the function is exported
   */
  setExported(exported: boolean): void {
    this.isExported = exported;
  }

  /**
   * Checks if this function is exported.
   *
   * @returns true if exported
   */
  getExported(): boolean {
    return this.isExported;
  }

  /**
   * Sets whether this function is an interrupt handler.
   *
   * @param interrupt - Whether the function is an interrupt handler
   */
  setInterrupt(interrupt: boolean): void {
    this.isInterrupt = interrupt;
  }

  /**
   * Checks if this function is an interrupt handler.
   *
   * @returns true if interrupt handler
   */
  getInterrupt(): boolean {
    return this.isInterrupt;
  }

  /**
   * Sets a storage class hint for a parameter.
   *
   * @param paramName - Parameter name
   * @param storage - Storage class hint
   */
  setParameterStorageHint(paramName: string, storage: ILStorageClass): void {
    this.parameterStorageHints.set(paramName, storage);
  }

  /**
   * Gets the storage class hint for a parameter.
   *
   * @param paramName - Parameter name
   * @returns Storage class hint, or undefined if not set
   */
  getParameterStorageHint(paramName: string): ILStorageClass | undefined {
    return this.parameterStorageHints.get(paramName);
  }

  // ===========================================================================
  // Analysis Helpers
  // ===========================================================================

  /**
   * Gets the total number of instructions in all blocks.
   *
   * @returns Total instruction count
   */
  getInstructionCount(): number {
    let count = 0;
    for (const block of this.blocks.values()) {
      count += block.getInstructionCount();
    }
    return count;
  }

  /**
   * Gets the next available instruction ID for this function.
   *
   * This is used when entering a function that was created separately
   * (e.g., as a stub) to continue the instruction ID sequence.
   *
   * @returns The next available instruction ID (equal to current instruction count)
   */
  getNextInstructionId(): number {
    return this.getInstructionCount();
  }

  /**
   * Gets the number of registers allocated.
   *
   * @returns Register count
   */
  getRegisterCount(): number {
    return this.valueFactory.getRegisterCount();
  }

  /**
   * Checks if the function's CFG is well-formed.
   *
   * A well-formed CFG has:
   * - All blocks end with terminators
   * - All successors/predecessors are consistent
   * - All blocks are reachable from entry
   *
   * @returns Array of error messages (empty if well-formed)
   */
  validateCFG(): string[] {
    const errors: string[] = [];

    // Check terminators
    for (const block of this.blocks.values()) {
      if (!block.hasTerminator()) {
        errors.push(`Block '${block.label}' does not end with a terminator`);
      }
    }

    // Check CFG consistency
    for (const block of this.blocks.values()) {
      for (const succ of block.getSuccessors()) {
        if (!succ.hasPredecessor(block)) {
          errors.push(
            `CFG inconsistency: ${block.label} -> ${succ.label} ` +
              `but ${succ.label} doesn't have ${block.label} as predecessor`,
          );
        }
      }
      for (const pred of block.getPredecessors()) {
        if (!pred.hasSuccessor(block)) {
          errors.push(
            `CFG inconsistency: ${pred.label} <- ${block.label} ` +
              `but ${pred.label} doesn't have ${block.label} as successor`,
          );
        }
      }
    }

    // Check reachability
    const unreachable = this.getUnreachableBlocks();
    for (const block of unreachable) {
      errors.push(`Block '${block.label}' is unreachable`);
    }

    return errors;
  }

  // ===========================================================================
  // Debugging
  // ===========================================================================

  /**
   * Returns a string representation of this function.
   *
   * @returns Function signature string
   */
  toString(): string {
    const params = this.parameters.map((p) => `${p.name}: ${p.type.kind}`).join(', ');
    return `function ${this.name}(${params}) -> ${this.returnType.kind}`;
  }

  /**
   * Returns a detailed string representation including all blocks.
   *
   * @returns Multi-line function representation
   */
  toDetailedString(): string {
    const lines: string[] = [];
    lines.push(`; Function: ${this.toString()}`);

    if (this.isExported) {
      lines.push('; exported');
    }
    if (this.isInterrupt) {
      lines.push('; interrupt');
    }

    lines.push('');

    for (const block of this.getBlocksInReversePostorder()) {
      lines.push(block.toDetailedString());
      lines.push('');
    }

    return lines.join('\n');
  }
}
/**
 * IL Generator - Base Layer
 *
 * Foundation class with core infrastructure:
 * - Frame/symbol table management
 * - Variable resolution
 * - Current function tracking
 * - Loop depth tracking
 *
 * @module il/generator/base
 */

import { SourceLocation } from '../../ast/base.js';
import { Frame } from '../../frame/allocator/frame-calculator.js';
import { FrameSlot } from '../../frame/types.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { ILBuilder } from '../builder/index.js';
import { ILInstruction } from '../instruction.js';
import { ILLoop } from '../structures.js';

// ============================================================================
// ILGeneratorBase Class
// ============================================================================

/**
 * Base class for IL Generator.
 *
 * Provides core infrastructure:
 * - Frame map from SFA for variable slot lookups
 * - Symbol table for type/scope information
 * - ILBuilder for emitting instructions
 * - Current function and loop tracking
 *
 * Extended by expression and statement generation layers.
 *
 * @example
 * ```typescript
 * const generator = new ILGenerator(frameMap, symbolTable);
 * const ilProgram = generator.generate(program);
 * ```
 */
export class ILGeneratorBase {
  /** IL instruction builder */
  protected builder: ILBuilder;

  /** Frame map from SFA - contains slots for all functions */
  protected frameMap: Map<string, Frame>;

  /** Symbol table for type/scope lookups */
  protected symbolTable: SymbolTable;

  /** Name of the function currently being generated */
  protected currentFunction: string | null = null;

  /** Current loop nesting depth (for optimization hints) */
  protected currentLoopDepth: number = 0;

  /** Detected loops in current function */
  protected loops: ILLoop[] = [];

  /** Maximum loop depth reached in current function */
  protected maxLoopDepth: number = 0;

  /**
   * Creates an IL generator.
   *
   * @param frameMap - Frame map from SFA (function name → Frame)
   * @param symbolTable - Symbol table from semantic analysis
   */
  constructor(frameMap: Map<string, Frame>, symbolTable: SymbolTable) {
    this.builder = new ILBuilder();
    this.frameMap = frameMap;
    this.symbolTable = symbolTable;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Variable Resolution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Resolve a variable name to its frame slot.
   *
   * Looks up the slot in the current function's frame. This provides
   * complete SFA context (location, address, ZP status) for code generation.
   *
   * @param name - Variable name to resolve
   * @returns FrameSlot for the variable
   * @throws Error if no current function or variable not found
   *
   * @example
   * ```typescript
   * const slot = this.resolveVariable('counter');
   * // slot contains: name, kind, type, size, location, address, etc.
   * this.builder.loadSlot(slot);
   * ```
   */
  protected resolveVariable(name: string): FrameSlot {
    if (!this.currentFunction) {
      throw new Error(`Cannot resolve variable "${name}": no current function`);
    }

    const frame = this.frameMap.get(this.currentFunction);
    if (!frame) {
      throw new Error(`No frame for function "${this.currentFunction}"`);
    }

    const slot = frame.slots.find((s) => s.name === name);
    if (!slot) {
      throw new Error(
        `Unknown variable "${name}" in function "${this.currentFunction}"`
      );
    }

    return slot;
  }

  /**
   * Try to resolve a variable, returning undefined if not found.
   *
   * Useful for checking if a name refers to a local variable
   * or something else (global, intrinsic, etc.).
   *
   * @param name - Variable name to resolve
   * @returns FrameSlot or undefined if not found
   */
  protected tryResolveVariable(name: string): FrameSlot | undefined {
    if (!this.currentFunction) {
      return undefined;
    }

    const frame = this.frameMap.get(this.currentFunction);
    if (!frame) {
      return undefined;
    }

    return frame.slots.find((s) => s.name === name);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Current Function Management
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get the current function's frame.
   *
   * @returns Frame for current function
   * @throws Error if no current function
   */
  protected getCurrentFrame(): Frame {
    if (!this.currentFunction) {
      throw new Error('No current function');
    }

    const frame = this.frameMap.get(this.currentFunction);
    if (!frame) {
      throw new Error(`No frame for function "${this.currentFunction}"`);
    }

    return frame;
  }

  /**
   * Begin generating a new function.
   *
   * Resets state for the new function:
   * - Clears the instruction builder
   * - Resets loop tracking
   * - Sets the current function name
   *
   * @param functionName - Name of the function to generate
   */
  protected beginFunction(functionName: string): void {
    this.currentFunction = functionName;
    this.builder.clear();
    this.loops = [];
    this.currentLoopDepth = 0;
    this.maxLoopDepth = 0;
  }

  /**
   * End generating the current function.
   *
   * @returns Generated instructions, loops, and max depth
   */
  protected endFunction(): {
    instructions: ILInstruction[];
    loops: ILLoop[];
    maxLoopDepth: number;
  } {
    const result = {
      instructions: this.builder.getInstructions(),
      loops: this.loops,
      maxLoopDepth: this.maxLoopDepth,
    };

    this.currentFunction = null;
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Loop Tracking
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enter a loop (increment depth).
   *
   * Called at the start of while/for loop generation.
   */
  protected enterLoop(): void {
    this.currentLoopDepth++;
    this.maxLoopDepth = Math.max(this.maxLoopDepth, this.currentLoopDepth);
  }

  /**
   * Exit a loop (decrement depth).
   *
   * Called at the end of while/for loop generation.
   */
  protected exitLoop(): void {
    this.currentLoopDepth--;
  }

  /**
   * Record a detected loop for optimization hints.
   *
   * @param loop - Loop information
   */
  protected recordLoop(loop: ILLoop): void {
    this.loops.push(loop);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Source Location
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Set source location for upcoming instructions.
   *
   * @param location - Source location
   */
  protected setLocation(location: SourceLocation): void {
    this.builder.setLocation(location);
  }

  /**
   * Clear source location.
   */
  protected clearLocation(): void {
    this.builder.clearLocation();
  }
}
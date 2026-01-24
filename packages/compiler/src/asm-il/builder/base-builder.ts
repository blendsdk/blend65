/**
 * Base ASM-IL Builder
 *
 * Foundation for the builder inheritance chain.
 * Provides core item management and utilities.
 *
 * @module asm-il/builder/base-builder
 */

import type { SourceLocation } from '../../ast/base.js';
import type {
  AsmItem,
  AsmLabel,
  AsmComment,
  AsmBlankLine,
  AsmOrigin,
  AsmRaw,
} from '../types.js';
import { LabelType } from '../types.js';

// ============================================================================
// BUILDER STATE
// ============================================================================

/**
 * Base builder state and statistics
 *
 * Contains all mutable state tracked during module construction.
 * Separated from the class for potential cloning/serialization.
 */
export interface BuilderState {
  /** Module name */
  name: string;

  /** Target architecture */
  target: string;

  /** Initial origin address */
  origin: number;

  /** Current address (estimated) */
  currentAddress: number;

  /** Accumulated items */
  items: AsmItem[];

  /** Label lookup */
  labels: Map<string, AsmLabel>;

  /** Total code bytes emitted */
  codeBytes: number;

  /** Total data bytes emitted */
  dataBytes: number;

  /** Number of functions declared */
  functionCount: number;

  /** Number of global variables declared */
  globalCount: number;
}

/**
 * Builder statistics for external access
 */
export interface BuilderStats {
  /** Total code bytes emitted */
  codeBytes: number;

  /** Total data bytes emitted */
  dataBytes: number;

  /** Number of functions declared */
  functionCount: number;

  /** Number of global variables declared */
  globalCount: number;

  /** Total items in module */
  itemCount: number;

  /** Current estimated address */
  currentAddress: number;
}

// ============================================================================
// BASE ASM BUILDER
// ============================================================================

/**
 * Base ASM-IL Builder
 *
 * Provides core infrastructure for building ASM-IL modules.
 * Extended by InstructionBuilder → DataBuilder → AsmModuleBuilder.
 *
 * Design philosophy:
 * - Fluent API: All methods return `this` for chaining
 * - Immutable output: Builder produces immutable AsmModule
 * - Source tracking: Optional source location for debugging
 * - Statistics: Tracks code/data sizes during construction
 *
 * @example
 * ```typescript
 * const builder = new AsmModuleBuilder('main.blend')
 *   .comment('Header')
 *   .setOrigin(0x0801)
 *   .functionLabel('_main', 'Entry point')
 *   .ldaImm(5)
 *   .rts();
 *
 * const module = builder.build();
 * ```
 */
export abstract class BaseAsmBuilder {
  /** Builder state */
  protected state: BuilderState;

  /** Current source location for tracking */
  protected currentLocation?: SourceLocation;

  /**
   * Creates a new base builder
   *
   * @param name - Module name (usually source file name)
   * @param origin - Initial origin address (default: $0801 for C64 BASIC)
   * @param target - Target architecture (default: 'c64')
   */
  constructor(name: string, origin: number = 0x0801, target: string = 'c64') {
    this.state = {
      name,
      target,
      origin,
      currentAddress: origin,
      items: [],
      labels: new Map(),
      codeBytes: 0,
      dataBytes: 0,
      functionCount: 0,
      globalCount: 0,
    };
  }

  // ========================================
  // SOURCE LOCATION TRACKING
  // ========================================

  /**
   * Set current source location for subsequent items
   *
   * All items added after this call will have this source location
   * attached until clearLocation() is called or a new location is set.
   *
   * @param location - Source location to attach
   * @returns this for chaining
   */
  setLocation(location: SourceLocation): this {
    this.currentLocation = location;
    return this;
  }

  /**
   * Clear current source location
   *
   * Subsequent items will not have a source location attached.
   *
   * @returns this for chaining
   */
  clearLocation(): this {
    this.currentLocation = undefined;
    return this;
  }

  /**
   * Get current source location
   *
   * @returns Current source location or undefined
   */
  getLocation(): SourceLocation | undefined {
    return this.currentLocation;
  }

  // ========================================
  // ITEM MANAGEMENT
  // ========================================

  /**
   * Add an item to the module
   *
   * Internal method used by all builder methods. Items are stored
   * in order and will appear in the final assembly output in the
   * same sequence.
   *
   * @param item - Item to add
   */
  protected addItem(item: AsmItem): void {
    this.state.items.push(item);
  }

  /**
   * Get current item count
   *
   * @returns Number of items in the module
   */
  getItemCount(): number {
    return this.state.items.length;
  }

  /**
   * Get current estimated address
   *
   * The estimated address is updated as instructions and data are added.
   * This is an estimate because label addresses are resolved by the assembler.
   *
   * @returns Current estimated address
   */
  getCurrentAddress(): number {
    return this.state.currentAddress;
  }

  /**
   * Get all items (read-only)
   *
   * @returns Array of items
   */
  getItems(): readonly AsmItem[] {
    return this.state.items;
  }

  // ========================================
  // LABEL MANAGEMENT
  // ========================================

  /**
   * Add a label at current position
   *
   * Labels mark named locations in the assembly output. They can be
   * referenced by branch/jump instructions and data directives.
   *
   * @param name - Label name (without colon)
   * @param type - Label type category
   * @param comment - Optional description
   * @param exported - Whether label is exported (visible outside module)
   * @returns this for chaining
   */
  label(
    name: string,
    type: LabelType,
    comment?: string,
    exported: boolean = false,
  ): this {
    const label: AsmLabel = {
      kind: 'label',
      name,
      type,
      exported,
      address: this.state.currentAddress,
      comment,
      sourceLocation: this.currentLocation,
    };

    this.state.labels.set(name, label);
    this.addItem(label);

    return this;
  }

  /**
   * Add a function label
   *
   * Convenience method for adding function entry point labels.
   * Increments the function counter.
   *
   * @param name - Function name
   * @param comment - Optional description
   * @param exported - Whether function is exported
   * @returns this for chaining
   */
  functionLabel(
    name: string,
    comment?: string,
    exported: boolean = false,
  ): this {
    this.state.functionCount++;
    return this.label(name, LabelType.Function, comment, exported);
  }

  /**
   * Add a global variable label
   *
   * Convenience method for adding global variable labels.
   * Increments the global counter.
   *
   * @param name - Variable name
   * @param comment - Optional description
   * @param exported - Whether variable is exported
   * @returns this for chaining
   */
  globalLabel(name: string, comment?: string, exported: boolean = false): this {
    this.state.globalCount++;
    return this.label(name, LabelType.Global, comment, exported);
  }

  /**
   * Add a block label (local, starts with .)
   *
   * Block labels are used for control flow (loops, conditionals).
   * They are local to the current function scope.
   *
   * @param name - Label name
   * @param comment - Optional description
   * @returns this for chaining
   */
  blockLabel(name: string, comment?: string): this {
    return this.label(name, LabelType.Block, comment, false);
  }

  /**
   * Add a data section label
   *
   * Data labels mark the start of data sections (strings, arrays, etc.)
   *
   * @param name - Label name
   * @param comment - Optional description
   * @returns this for chaining
   */
  dataLabel(name: string, comment?: string): this {
    return this.label(name, LabelType.Data, comment, false);
  }

  /**
   * Add a temporary label
   *
   * Temporary labels are internal implementation details.
   * They should not be used directly by user code.
   *
   * @param name - Label name
   * @param comment - Optional description
   * @returns this for chaining
   */
  tempLabel(name: string, comment?: string): this {
    return this.label(name, LabelType.Temp, comment, false);
  }

  /**
   * Check if a label exists
   *
   * @param name - Label name to check
   * @returns true if label exists
   */
  hasLabel(name: string): boolean {
    return this.state.labels.has(name);
  }

  /**
   * Get a label by name
   *
   * @param name - Label name
   * @returns Label or undefined if not found
   */
  getLabel(name: string): AsmLabel | undefined {
    return this.state.labels.get(name);
  }

  // ========================================
  // DIRECTIVES
  // ========================================

  /**
   * Set assembly origin address
   *
   * Changes the current address for subsequent items.
   * Emits a *= directive in the output.
   *
   * @param address - Target address
   * @param comment - Optional comment
   * @returns this for chaining
   */
  setOrigin(address: number, comment?: string): this {
    const origin: AsmOrigin = {
      kind: 'origin',
      address,
      comment,
    };
    this.state.currentAddress = address;
    this.addItem(origin);
    return this;
  }

  /**
   * Add a comment line
   *
   * @param text - Comment text (without semicolon prefix)
   * @param style - Comment style: 'line', 'section', or 'inline'
   * @returns this for chaining
   */
  comment(text: string, style: 'line' | 'section' | 'inline' = 'line'): this {
    const comment: AsmComment = {
      kind: 'comment',
      text,
      style,
    };
    this.addItem(comment);
    return this;
  }

  /**
   * Add a section header comment
   *
   * Section comments are visually distinct in the output,
   * typically with separators above and below.
   *
   * @param title - Section title
   * @returns this for chaining
   */
  section(title: string): this {
    return this.comment(title, 'section');
  }

  /**
   * Add a blank line
   *
   * Blank lines improve readability in the output.
   *
   * @returns this for chaining
   */
  blank(): this {
    const blank: AsmBlankLine = {
      kind: 'blank',
    };
    this.addItem(blank);
    return this;
  }

  /**
   * Add raw assembly text
   *
   * Escape hatch for features not directly supported by the builder.
   * Use sparingly as it bypasses validation.
   *
   * @param text - Raw text to emit verbatim
   * @returns this for chaining
   */
  raw(text: string): this {
    const raw: AsmRaw = {
      kind: 'raw',
      text,
    };
    this.addItem(raw);
    return this;
  }

  // ========================================
  // STATISTICS
  // ========================================

  /**
   * Add to code byte count
   *
   * Called by instruction methods to track code size.
   *
   * @param bytes - Number of bytes to add
   */
  protected addCodeBytes(bytes: number): void {
    this.state.codeBytes += bytes;
    this.state.currentAddress += bytes;
  }

  /**
   * Add to data byte count
   *
   * Called by data methods to track data size.
   *
   * @param bytes - Number of bytes to add
   */
  protected addDataBytes(bytes: number): void {
    this.state.dataBytes += bytes;
    this.state.currentAddress += bytes;
  }

  /**
   * Get current statistics
   *
   * @returns Builder statistics snapshot
   */
  getStats(): BuilderStats {
    return {
      codeBytes: this.state.codeBytes,
      dataBytes: this.state.dataBytes,
      functionCount: this.state.functionCount,
      globalCount: this.state.globalCount,
      itemCount: this.state.items.length,
      currentAddress: this.state.currentAddress,
    };
  }

  /**
   * Get module name
   *
   * @returns Module name
   */
  getName(): string {
    return this.state.name;
  }

  /**
   * Get target architecture
   *
   * @returns Target architecture identifier
   */
  getTarget(): string {
    return this.state.target;
  }

  /**
   * Get origin address
   *
   * @returns Initial origin address
   */
  getOrigin(): number {
    return this.state.origin;
  }
}
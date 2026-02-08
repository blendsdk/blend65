/**
 * Intrinsic Registry
 *
 * Central registry for all intrinsic functions in the IL generator.
 * Maps function names to their IL generation handlers and metadata.
 *
 * Intrinsics are special functions that:
 * - Are recognized by the IL generator
 * - Map to special IL instructions (not regular function calls)
 * - May be evaluated at compile-time (e.g., sizeof)
 * - Provide low-level access to 6502 hardware
 *
 * @module il/intrinsics/registry
 */

import type { ILType } from '../types.js';
import { IL_VOID, IL_BYTE, IL_WORD } from '../types.js';
import { ILOpcode } from '../instructions.js';

// =============================================================================
// Intrinsic Categories
// =============================================================================

/**
 * Categories of intrinsic functions.
 *
 * Used for documentation and organization of intrinsics.
 */
export enum IntrinsicCategory {
  /** Memory access intrinsics (peek, poke, peekw, pokew) */
  Memory = 'memory',

  /** Optimization control (barrier, volatile_read, volatile_write) */
  Optimization = 'optimization',

  /** CPU instruction intrinsics (sei, cli, nop, brk, pha, pla, php, plp) */
  CPU = 'cpu',

  /** Stack operations (pha, pla, php, plp) */
  Stack = 'stack',

  /** Utility intrinsics (sizeof, length, lo, hi) */
  Utility = 'utility',

  /** Compile-time intrinsics (sizeof) */
  CompileTime = 'compile_time',
}

// =============================================================================
// Intrinsic Definition
// =============================================================================

/**
 * Definition of an intrinsic function.
 *
 * Contains all information needed to:
 * - Validate calls to the intrinsic
 * - Generate IL instructions
 * - Optimize intrinsic usage
 */
export interface IntrinsicDefinition {
  /** Intrinsic function name */
  readonly name: string;

  /** Category for organization and documentation */
  readonly category: IntrinsicCategory;

  /** Parameter types (in order) */
  readonly parameterTypes: readonly ILType[];

  /** Parameter names (for documentation) */
  readonly parameterNames: readonly string[];

  /** Return type (IL_VOID for void intrinsics) */
  readonly returnType: ILType;

  /** IL opcode to emit (null for compile-time intrinsics) */
  readonly opcode: ILOpcode | null;

  /** Whether this intrinsic is evaluated at compile time */
  readonly isCompileTime: boolean;

  /** Whether this intrinsic has side effects (prevents DCE) */
  readonly hasSideEffects: boolean;

  /** Whether this intrinsic acts as an optimization barrier */
  readonly isBarrier: boolean;

  /** Whether reads/writes are volatile (cannot be eliminated or reordered) */
  readonly isVolatile: boolean;

  /** Cycle count on 6502 (for timing-critical code) */
  readonly cycleCount: number | null;

  /** Description for documentation */
  readonly description: string;
}

// =============================================================================
// Intrinsic Registry
// =============================================================================

/**
 * Registry of all intrinsic functions.
 *
 * Provides methods to:
 * - Look up intrinsics by name
 * - Check if a function is an intrinsic
 * - Get intrinsic metadata for IL generation
 *
 * @example
 * ```typescript
 * const registry = new IntrinsicRegistry();
 *
 * // Check if a function is an intrinsic
 * if (registry.isIntrinsic('peek')) {
 *   const def = registry.get('peek')!;
 *   // Generate IL based on definition
 * }
 *
 * // Get all intrinsics in a category
 * const cpuIntrinsics = registry.getByCategory(IntrinsicCategory.CPU);
 * ```
 */
export class IntrinsicRegistry {
  /**
   * Map of intrinsic name to definition.
   */
  protected readonly intrinsics: Map<string, IntrinsicDefinition>;

  /**
   * Creates a new intrinsic registry with all built-in intrinsics.
   */
  constructor() {
    this.intrinsics = new Map();
    this.registerBuiltinIntrinsics();
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Checks if a function name is a registered intrinsic.
   *
   * @param name - Function name to check
   * @returns true if the function is an intrinsic
   */
  public isIntrinsic(name: string): boolean {
    return this.intrinsics.has(name);
  }

  /**
   * Gets the definition for an intrinsic.
   *
   * @param name - Intrinsic name
   * @returns Intrinsic definition, or undefined if not found
   */
  public get(name: string): IntrinsicDefinition | undefined {
    return this.intrinsics.get(name);
  }

  /**
   * Gets all registered intrinsics.
   *
   * @returns Iterator over all intrinsic definitions
   */
  public getAll(): IterableIterator<IntrinsicDefinition> {
    return this.intrinsics.values();
  }

  /**
   * Gets all intrinsic names.
   *
   * @returns Iterator over all intrinsic names
   */
  public getNames(): IterableIterator<string> {
    return this.intrinsics.keys();
  }

  /**
   * Gets intrinsics by category.
   *
   * @param category - Category to filter by
   * @returns Array of intrinsic definitions in that category
   */
  public getByCategory(category: IntrinsicCategory): IntrinsicDefinition[] {
    const result: IntrinsicDefinition[] = [];
    for (const def of this.intrinsics.values()) {
      if (def.category === category) {
        result.push(def);
      }
    }
    return result;
  }

  /**
   * Gets all compile-time intrinsics.
   *
   * @returns Array of compile-time intrinsic definitions
   */
  public getCompileTimeIntrinsics(): IntrinsicDefinition[] {
    const result: IntrinsicDefinition[] = [];
    for (const def of this.intrinsics.values()) {
      if (def.isCompileTime) {
        result.push(def);
      }
    }
    return result;
  }

  /**
   * Gets the number of registered intrinsics.
   *
   * @returns Number of intrinsics
   */
  public get size(): number {
    return this.intrinsics.size;
  }

  // ===========================================================================
  // Registration
  // ===========================================================================

  /**
   * Registers all built-in intrinsics.
   *
   * Called automatically during construction.
   */
  protected registerBuiltinIntrinsics(): void {
    // Memory access intrinsics
    this.registerMemoryIntrinsics();

    // Optimization control intrinsics
    this.registerOptimizationIntrinsics();

    // CPU instruction intrinsics
    this.registerCPUIntrinsics();

    // Stack operation intrinsics
    this.registerStackIntrinsics();

    // Utility intrinsics
    this.registerUtilityIntrinsics();
  }

  /**
   * Registers a single intrinsic.
   *
   * @param definition - Intrinsic definition to register
   */
  protected register(definition: IntrinsicDefinition): void {
    if (this.intrinsics.has(definition.name)) {
      throw new Error(`Intrinsic '${definition.name}' is already registered`);
    }
    this.intrinsics.set(definition.name, definition);
  }

  // ===========================================================================
  // Memory Access Intrinsics
  // ===========================================================================

  /**
   * Registers memory access intrinsics: peek, poke, peekw, pokew.
   */
  protected registerMemoryIntrinsics(): void {
    // peek(address: word): byte - Read byte from memory
    this.register({
      name: 'peek',
      category: IntrinsicCategory.Memory,
      parameterTypes: [IL_WORD],
      parameterNames: ['address'],
      returnType: IL_BYTE,
      opcode: ILOpcode.INTRINSIC_PEEK,
      isCompileTime: false,
      hasSideEffects: false,
      isBarrier: false,
      isVolatile: false,
      cycleCount: 4, // LDA absolute
      description: 'Read a byte from memory at the specified address',
    });

    // poke(address: word, value: byte): void - Write byte to memory
    this.register({
      name: 'poke',
      category: IntrinsicCategory.Memory,
      parameterTypes: [IL_WORD, IL_BYTE],
      parameterNames: ['address', 'value'],
      returnType: IL_VOID,
      opcode: ILOpcode.INTRINSIC_POKE,
      isCompileTime: false,
      hasSideEffects: true,
      isBarrier: false,
      isVolatile: false,
      cycleCount: 4, // STA absolute
      description: 'Write a byte to memory at the specified address',
    });

    // peekw(address: word): word - Read word from memory (little-endian)
    this.register({
      name: 'peekw',
      category: IntrinsicCategory.Memory,
      parameterTypes: [IL_WORD],
      parameterNames: ['address'],
      returnType: IL_WORD,
      opcode: ILOpcode.INTRINSIC_PEEKW,
      isCompileTime: false,
      hasSideEffects: false,
      isBarrier: false,
      isVolatile: false,
      cycleCount: 8, // Two LDA absolute
      description: 'Read a 16-bit word from memory (little-endian)',
    });

    // pokew(address: word, value: word): void - Write word to memory (little-endian)
    this.register({
      name: 'pokew',
      category: IntrinsicCategory.Memory,
      parameterTypes: [IL_WORD, IL_WORD],
      parameterNames: ['address', 'value'],
      returnType: IL_VOID,
      opcode: ILOpcode.INTRINSIC_POKEW,
      isCompileTime: false,
      hasSideEffects: true,
      isBarrier: false,
      isVolatile: false,
      cycleCount: 8, // Two STA absolute
      description: 'Write a 16-bit word to memory (little-endian)',
    });
  }

  // ===========================================================================
  // Optimization Control Intrinsics
  // ===========================================================================

  /**
   * Registers optimization control intrinsics: barrier, volatile_read, volatile_write.
   */
  protected registerOptimizationIntrinsics(): void {
    // barrier(): void - Optimization barrier
    this.register({
      name: 'barrier',
      category: IntrinsicCategory.Optimization,
      parameterTypes: [],
      parameterNames: [],
      returnType: IL_VOID,
      opcode: ILOpcode.OPT_BARRIER,
      isCompileTime: false,
      hasSideEffects: true, // Prevents DCE
      isBarrier: true,
      isVolatile: false,
      cycleCount: 0, // No runtime cost
      description: 'Optimization barrier - prevents instruction reordering across this point',
    });

    // volatile_read(address: word): byte - Volatile memory read
    this.register({
      name: 'volatile_read',
      category: IntrinsicCategory.Optimization,
      parameterTypes: [IL_WORD],
      parameterNames: ['address'],
      returnType: IL_BYTE,
      opcode: ILOpcode.VOLATILE_READ,
      isCompileTime: false,
      hasSideEffects: true, // Cannot be eliminated
      isBarrier: true,
      isVolatile: true,
      cycleCount: 4, // LDA absolute
      description: 'Volatile read - cannot be eliminated or reordered',
    });

    // volatile_write(address: word, value: byte): void - Volatile memory write
    this.register({
      name: 'volatile_write',
      category: IntrinsicCategory.Optimization,
      parameterTypes: [IL_WORD, IL_BYTE],
      parameterNames: ['address', 'value'],
      returnType: IL_VOID,
      opcode: ILOpcode.VOLATILE_WRITE,
      isCompileTime: false,
      hasSideEffects: true,
      isBarrier: true,
      isVolatile: true,
      cycleCount: 4, // STA absolute
      description: 'Volatile write - cannot be eliminated or reordered',
    });
  }

  // ===========================================================================
  // CPU Instruction Intrinsics
  // ===========================================================================

  /**
   * Registers CPU instruction intrinsics: sei, cli, nop, brk.
   */
  protected registerCPUIntrinsics(): void {
    // sei(): void - Set interrupt disable
    this.register({
      name: 'sei',
      category: IntrinsicCategory.CPU,
      parameterTypes: [],
      parameterNames: [],
      returnType: IL_VOID,
      opcode: ILOpcode.CPU_SEI,
      isCompileTime: false,
      hasSideEffects: true,
      isBarrier: true, // Implicit barrier
      isVolatile: false,
      cycleCount: 2,
      description: 'Set interrupt disable flag (disable interrupts)',
    });

    // cli(): void - Clear interrupt disable
    this.register({
      name: 'cli',
      category: IntrinsicCategory.CPU,
      parameterTypes: [],
      parameterNames: [],
      returnType: IL_VOID,
      opcode: ILOpcode.CPU_CLI,
      isCompileTime: false,
      hasSideEffects: true,
      isBarrier: true, // Implicit barrier
      isVolatile: false,
      cycleCount: 2,
      description: 'Clear interrupt disable flag (enable interrupts)',
    });

    // nop(): void - No operation
    this.register({
      name: 'nop',
      category: IntrinsicCategory.CPU,
      parameterTypes: [],
      parameterNames: [],
      returnType: IL_VOID,
      opcode: ILOpcode.CPU_NOP,
      isCompileTime: false,
      hasSideEffects: true, // Prevents elimination for timing
      isBarrier: false,
      isVolatile: false,
      cycleCount: 2,
      description: 'No operation (2 cycles) - useful for timing',
    });

    // brk(): void - Software interrupt
    this.register({
      name: 'brk',
      category: IntrinsicCategory.CPU,
      parameterTypes: [],
      parameterNames: [],
      returnType: IL_VOID,
      opcode: ILOpcode.CPU_BRK,
      isCompileTime: false,
      hasSideEffects: true,
      isBarrier: true, // Implicit barrier
      isVolatile: false,
      cycleCount: 7,
      description: 'Software interrupt (BRK)',
    });
  }

  // ===========================================================================
  // Stack Operation Intrinsics
  // ===========================================================================

  /**
   * Registers stack operation intrinsics: pha, pla, php, plp.
   */
  protected registerStackIntrinsics(): void {
    // pha(): void - Push accumulator
    this.register({
      name: 'pha',
      category: IntrinsicCategory.Stack,
      parameterTypes: [],
      parameterNames: [],
      returnType: IL_VOID,
      opcode: ILOpcode.CPU_PHA,
      isCompileTime: false,
      hasSideEffects: true,
      isBarrier: false,
      isVolatile: false,
      cycleCount: 3,
      description: 'Push accumulator to stack',
    });

    // pla(): byte - Pull accumulator
    this.register({
      name: 'pla',
      category: IntrinsicCategory.Stack,
      parameterTypes: [],
      parameterNames: [],
      returnType: IL_BYTE,
      opcode: ILOpcode.CPU_PLA,
      isCompileTime: false,
      hasSideEffects: true, // Stack modification
      isBarrier: false,
      isVolatile: false,
      cycleCount: 4,
      description: 'Pull accumulator from stack',
    });

    // php(): void - Push processor status
    this.register({
      name: 'php',
      category: IntrinsicCategory.Stack,
      parameterTypes: [],
      parameterNames: [],
      returnType: IL_VOID,
      opcode: ILOpcode.CPU_PHP,
      isCompileTime: false,
      hasSideEffects: true,
      isBarrier: false,
      isVolatile: false,
      cycleCount: 3,
      description: 'Push processor status to stack',
    });

    // plp(): void - Pull processor status
    this.register({
      name: 'plp',
      category: IntrinsicCategory.Stack,
      parameterTypes: [],
      parameterNames: [],
      returnType: IL_VOID,
      opcode: ILOpcode.CPU_PLP,
      isCompileTime: false,
      hasSideEffects: true,
      isBarrier: true, // Modifies processor flags
      isVolatile: false,
      cycleCount: 4,
      description: 'Pull processor status from stack',
    });
  }

  // ===========================================================================
  // Utility Intrinsics
  // ===========================================================================

  /**
   * Registers utility intrinsics: sizeof, length, lo, hi.
   */
  protected registerUtilityIntrinsics(): void {
    // sizeof(type): byte - Get size of type (compile-time)
    this.register({
      name: 'sizeof',
      category: IntrinsicCategory.CompileTime,
      parameterTypes: [], // Type parameter, not a regular value
      parameterNames: ['type'],
      returnType: IL_BYTE,
      opcode: null, // Compile-time only
      isCompileTime: true,
      hasSideEffects: false,
      isBarrier: false,
      isVolatile: false,
      cycleCount: null, // No runtime cost
      description: 'Get the size of a type in bytes (compile-time constant)',
    });

    // length(array): word - Get length of array (compile-time only)
    // All arrays in Blend65 have fixed, compile-time known sizes.
    // There are no dynamic arrays, so length is always a compile-time constant.
    this.register({
      name: 'length',
      category: IntrinsicCategory.CompileTime,
      parameterTypes: [], // Array parameter, type varies
      parameterNames: ['array'],
      returnType: IL_WORD,
      opcode: null, // Compile-time only - no runtime IL generated
      isCompileTime: true, // Always known at compile time (no dynamic arrays)
      hasSideEffects: false,
      isBarrier: false,
      isVolatile: false,
      cycleCount: null, // No runtime cost
      description: 'Get the length of an array or string (compile-time constant)',
    });

    // lo(value: word): byte - Get low byte of word
    this.register({
      name: 'lo',
      category: IntrinsicCategory.Utility,
      parameterTypes: [IL_WORD],
      parameterNames: ['value'],
      returnType: IL_BYTE,
      opcode: ILOpcode.INTRINSIC_LO,
      isCompileTime: false, // Compile-time when value is constant
      hasSideEffects: false,
      isBarrier: false,
      isVolatile: false,
      cycleCount: 0, // Just uses low byte
      description: 'Extract the low byte of a 16-bit word',
    });

    // hi(value: word): byte - Get high byte of word
    this.register({
      name: 'hi',
      category: IntrinsicCategory.Utility,
      parameterTypes: [IL_WORD],
      parameterNames: ['value'],
      returnType: IL_BYTE,
      opcode: ILOpcode.INTRINSIC_HI,
      isCompileTime: false, // Compile-time when value is constant
      hasSideEffects: false,
      isBarrier: false,
      isVolatile: false,
      cycleCount: 3, // LDA zp+1 (3 cycles) or LDA abs+1 (4 cycles), using minimum
      description: 'Extract the high byte of a 16-bit word',
    });
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Global intrinsic registry instance.
 *
 * Use this for standard intrinsic lookups.
 */
export const INTRINSIC_REGISTRY = new IntrinsicRegistry();
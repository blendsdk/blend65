/**
 * Globals Code Generator for Blend65 Compiler
 *
 * Handles code generation for global variables:
 * - Zero-page variables (@zp) - fast access storage
 * - RAM variables (@ram) - general purpose storage
 * - Data section variables (@data) - initialized constants
 * - Memory-mapped variables (@map) - hardware registers
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module codegen/globals-generator
 */

import type { ILGlobalVariable } from '../il/module.js';
import { ILStorageClass } from '../il/function.js';
import { BaseCodeGenerator } from './base-generator.js';

/**
 * Tracks allocation for zero-page variables
 */
interface ZeroPageAllocation {
  /** Variable name */
  name: string;
  /** Allocated address */
  address: number;
  /** Size in bytes */
  size: number;
}

/**
 * Tracks allocation for RAM variables
 */
interface RamAllocation {
  /** Variable name */
  name: string;
  /** Generated label */
  label: string;
  /** Size in bytes */
  size: number;
  /** Initial value(s) */
  initialValue?: number | number[];
}

// ============================================
// COMPILER RESERVED ZERO PAGE ADDRESSES
// ============================================

/**
 * Reserved zero-page addresses for compiler temporaries.
 *
 * These addresses are used by the code generator for internal operations
 * like indirect addressing for peek/poke with variable addresses.
 *
 * Layout (8 bytes reserved at start of safe ZP range):
 * - $02-$03: PTR0 - Primary pointer for indirect addressing
 * - $04-$05: PTR1 - Secondary pointer (for word operations)
 * - $06-$07: TMP0 - Temporary storage
 * - $08-$09: TMP1 - Additional temporary storage
 *
 * User ZP variables start at $0A after the reserved area.
 */
export const ZP_RESERVED = {
  /** Primary pointer for indirect addressing (2 bytes: $02-$03) */
  PTR0: 0x02,
  /** Secondary pointer for word operations (2 bytes: $04-$05) */
  PTR1: 0x04,
  /** Temporary storage (2 bytes: $06-$07) */
  TMP0: 0x06,
  /** Additional temporary (2 bytes: $08-$09) */
  TMP1: 0x08,
  /** First address available for user ZP variables */
  USER_START: 0x0a,
  /** Total bytes reserved for compiler use */
  RESERVED_SIZE: 8,
} as const;

/**
 * Globals code generator - extends base generator
 *
 * Handles generation of assembly code for all global variable types:
 * - Allocates zero-page memory for @zp variables
 * - Creates data section entries for @ram and @data variables
 * - Generates ACME directives for initialization
 * - Maps @map variables to fixed hardware addresses
 *
 * This class is extended by InstructionGenerator.
 */
export abstract class GlobalsGenerator extends BaseCodeGenerator {
  // ============================================
  // ALLOCATION TRACKING
  // ============================================

  /**
   * Next available zero-page address
   *
   * C64 safe ZP range: $02-$8F (142 bytes)
   * User variables start after reserved compiler temporaries at $0A
   */
  protected nextZpAddress: number = ZP_RESERVED.USER_START;

  /**
   * Zero-page allocations for lookup
   */
  protected zpAllocations: Map<string, ZeroPageAllocation> = new Map();

  /**
   * RAM variable allocations
   */
  protected ramAllocations: Map<string, RamAllocation> = new Map();

  /**
   * Map variable addresses (fixed hardware addresses)
   */
  protected mapAddresses: Map<string, number> = new Map();

  // ============================================
  // STATE RESET (OVERRIDE)
  // ============================================

  /**
   * Resets state including allocation tracking
   */
  protected override resetState(): void {
    super.resetState();
    this.nextZpAddress = ZP_RESERVED.USER_START;
    this.zpAllocations.clear();
    this.ramAllocations.clear();
    this.mapAddresses.clear();
  }

  // ============================================
  // GLOBAL VARIABLE GENERATION
  // ============================================

  /**
   * Generates code for all global variables in the module
   *
   * Processes globals by storage class in this order:
   * 1. @map variables (register fixed addresses)
   * 2. @zp variables (allocate zero-page)
   * 3. @ram and @data variables (add to data section)
   */
  protected generateGlobals(): void {
    const globals = this.currentModule.getGlobals();

    if (globals.length === 0) {
      return;
    }

    // Process @map variables first (no allocation needed, just register addresses)
    for (const global of globals) {
      if (global.storageClass === ILStorageClass.Map) {
        this.processMapVariable(global);
      }
    }

    // Process @zp variables (allocate zero-page)
    const zpGlobals = globals.filter((g) => g.storageClass === ILStorageClass.ZeroPage);
    if (zpGlobals.length > 0) {
      this.generateZeroPageSection(zpGlobals);
    }

    // Process @ram and @data variables
    const dataGlobals = globals.filter(
      (g) => g.storageClass === ILStorageClass.Ram || g.storageClass === ILStorageClass.Data
    );
    if (dataGlobals.length > 0) {
      this.generateDataSection(dataGlobals);
    }
  }

  /**
   * Processes a @map variable - registers its fixed address
   *
   * @map variables don't need allocation - they reference
   * fixed hardware addresses.
   *
   * @param global - Map variable definition
   */
  protected processMapVariable(global: ILGlobalVariable): void {
    if (global.address === undefined) {
      this.addWarning(`@map variable '${global.name}' has no address`);
      return;
    }

    // Register the address for code generation
    this.mapAddresses.set(global.name, global.address);
    this.incrementGlobalCount();

    // Add to source mapper for debugging
    this.labelGenerator.globalLabel(global.name, global.address);
  }

  /**
   * Generates the zero-page allocation section
   *
   * Zero-page variables get fast 2-cycle access on 6502.
   * C64 safe range: $02-$8F (142 bytes available).
   *
   * @param globals - Zero-page variables to allocate
   */
  protected generateZeroPageSection(globals: ILGlobalVariable[]): void {
    this.emitSectionComment('Zero Page Variables');

    for (const global of globals) {
      this.allocateZpVariable(global);
    }
  }

  /**
   * Allocates a single zero-page variable
   *
   * @param global - Variable to allocate
   */
  protected allocateZpVariable(global: ILGlobalVariable): void {
    const size = this.getTypeSize(global.type);

    // Check if we have space
    if (this.nextZpAddress + size > 0x90) {
      this.addWarning(
        `Zero-page overflow: cannot allocate '${global.name}' (${size} bytes). ` +
          `Consider using @ram storage class.`
      );
      return;
    }

    const address = this.nextZpAddress;
    this.nextZpAddress += size;

    // Track allocation
    this.zpAllocations.set(global.name, {
      name: global.name,
      address,
      size,
    });

    // Emit comment showing allocation
    this.emitComment(`${global.name}: ${global.type.kind} @ ${this.formatZeroPage(address)}`);

    // Track statistics
    this.addZpBytes(size);
    this.incrementGlobalCount();
  }

  /**
   * Generates the data section for RAM and DATA variables
   *
   * @param globals - RAM/DATA variables to process
   */
  protected generateDataSection(globals: ILGlobalVariable[]): void {
    this.emitSectionComment('Data Section');
    this.assemblyWriter.emitBlankLine();

    for (const global of globals) {
      this.generateDataVariable(global);
    }
  }

  /**
   * Generates a single data section variable
   *
   * @param global - Variable to generate
   */
  protected generateDataVariable(global: ILGlobalVariable): void {
    const label = this.getGlobalLabel(global.name);
    const size = this.getTypeSize(global.type);

    // Track allocation
    this.ramAllocations.set(global.name, {
      name: global.name,
      label,
      size,
      initialValue: global.initialValue,
    });

    // Emit label
    this.emitLabel(label);

    // Emit data based on type and initial value
    if (global.initialValue !== undefined) {
      this.emitInitialValue(global);
    } else {
      // Uninitialized - emit zeros
      this.emitZeroFill(size, global.name);
    }

    // Track statistics
    this.addDataBytes(size);
    this.incrementGlobalCount();
  }

  /**
   * Emits an initial value for a variable
   *
   * @param global - Variable with initial value
   */
  protected emitInitialValue(global: ILGlobalVariable): void {
    const value = global.initialValue;

    if (value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      // Array of bytes
      this.assemblyWriter.emitBytes(value, global.name);
    } else if (global.type.kind === 'word' || global.type.kind === 'pointer') {
      // Word value (16-bit)
      this.assemblyWriter.emitWords([value], global.name);
    } else {
      // Byte value
      this.assemblyWriter.emitBytes([value], global.name);
    }
  }

  /**
   * Emits zero-fill for uninitialized variables
   *
   * @param size - Number of bytes to fill
   * @param name - Variable name for comment
   */
  protected emitZeroFill(size: number, name: string): void {
    if (size === 1) {
      this.assemblyWriter.emitBytes([0], name);
    } else if (size === 2) {
      this.assemblyWriter.emitWords([0], name);
    } else {
      this.assemblyWriter.emitFill(size, 0, name);
    }
  }

  // ============================================
  // INITIALIZATION CODE GENERATION
  // ============================================

  /**
   * Generates initialization code for zero-page variables
   *
   * Called during startup to initialize ZP variables with their
   * initial values (if any).
   */
  protected generateZpInitialization(): void {
    const zpWithInit = Array.from(this.zpAllocations.values()).filter((alloc) => {
      const global = this.currentModule.getGlobal(alloc.name);
      return global?.initialValue !== undefined;
    });

    if (zpWithInit.length === 0) {
      return;
    }

    this.emitSectionComment('Zero Page Initialization');

    for (const alloc of zpWithInit) {
      const global = this.currentModule.getGlobal(alloc.name);
      if (!global || global.initialValue === undefined) continue;

      const value = global.initialValue;
      if (typeof value === 'number') {
        // Single byte initialization
        this.emitLdaImmediate(value & 0xff, `Initialize ${alloc.name}`);
        this.emitStaZeroPage(alloc.address);
      }
      // Array initialization would require more complex loop generation
    }
  }

  // ============================================
  // ADDRESS LOOKUP
  // ============================================

  /**
   * Looks up the address of a global variable
   *
   * @param name - Variable name
   * @returns Address info or undefined if not found
   */
  protected lookupGlobalAddress(
    name: string
  ): { address: number; isZeroPage: boolean } | undefined {
    // Check @map variables first (fixed hardware addresses)
    const mapAddr = this.mapAddresses.get(name);
    if (mapAddr !== undefined) {
      return { address: mapAddr, isZeroPage: false };
    }

    // Check zero-page allocations
    const zpAlloc = this.zpAllocations.get(name);
    if (zpAlloc) {
      return { address: zpAlloc.address, isZeroPage: true };
    }

    // RAM variables are resolved at link time via labels
    // Return undefined - caller should use label instead
    return undefined;
  }

  /**
   * Gets the label for a RAM variable
   *
   * @param name - Variable name
   * @returns Label or undefined if not a RAM variable
   */
  protected lookupGlobalLabel(name: string): string | undefined {
    const alloc = this.ramAllocations.get(name);
    return alloc?.label;
  }

  // ============================================
  // TYPE SIZE HELPERS
  // ============================================

  /**
   * Gets the size in bytes for an IL type
   *
   * @param type - IL type
   * @returns Size in bytes
   */
  protected getTypeSize(type: { kind: string; size?: number }): number {
    // Use explicit size if available
    if (type.size !== undefined) {
      return type.size;
    }

    // Infer from kind
    switch (type.kind) {
      case 'void':
        return 0;
      case 'bool':
      case 'byte':
        return 1;
      case 'word':
      case 'pointer':
        return 2;
      default:
        // Default to byte for unknown types
        return 1;
    }
  }
}
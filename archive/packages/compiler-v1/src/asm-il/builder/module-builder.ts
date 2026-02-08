/**
 * ASM Module Builder
 *
 * Final concrete class for building ASM-IL modules.
 * Extends DataBuilder (which extends the entire chain).
 *
 * @module asm-il/builder/module-builder
 */

import { DataBuilder } from './data-builder.js';
import type { AsmModule, AsmModuleMetadata } from '../types.js';

/**
 * ASM Module Builder
 *
 * Complete builder for constructing ASM-IL modules.
 * This is the final class in the inheritance chain.
 *
 * Inheritance chain:
 * BaseAsmBuilder → LoadStoreBuilder → TransferStackBuilder →
 * ArithmeticBuilder → LogicalBuilder → BranchJumpBuilder →
 * DataBuilder → AsmModuleBuilder
 *
 * @example
 * ```typescript
 * const module = new AsmModuleBuilder('main.blend', 0x0801, 'c64')
 *   .header()
 *   .setOrigin(0x0801)
 *   .functionLabel('_main', 'Entry point')
 *   .ldaImm(5, 'Load value')
 *   .staAbs(0xD020, 'Set border color')
 *   .rts('Return')
 *   .footer()
 *   .build();
 * ```
 */
export class AsmModuleBuilder extends DataBuilder {
  /** Optional output file path */
  protected outputFile?: string;

  /**
   * Creates a new ASM module builder
   *
   * @param name - Module name (usually source file name)
   * @param origin - Initial origin address (default: $0801 for C64 BASIC)
   * @param target - Target architecture (default: 'c64')
   */
  constructor(name: string, origin: number = 0x0801, target: string = 'c64') {
    super(name, origin, target);
  }

  // ========================================
  // OUTPUT CONFIGURATION
  // ========================================

  /**
   * Set the output file path
   *
   * Used by ACME's !to directive.
   *
   * @param path - Output file path
   * @returns this for chaining
   */
  setOutputFile(path: string): this {
    this.outputFile = path;
    return this;
  }

  // ========================================
  // HEADER/FOOTER HELPERS
  // ========================================

  /**
   * Emit file header with standard comments
   *
   * Adds a formatted header section with module info.
   *
   * @param moduleName - Optional override for module name
   * @returns this for chaining
   */
  header(moduleName?: string): this {
    this.comment(
      '===========================================================================',
      'section',
    );
    this.comment('Blend65 Compiler Output');
    this.comment(`Module: ${moduleName ?? this.state.name}`);
    this.comment(`Generated: ${new Date().toISOString()}`);
    this.comment(`Target: ${this.state.target}`);
    this.comment(
      '===========================================================================',
      'section',
    );
    this.blank();
    return this;
  }

  /**
   * Emit file footer with statistics
   *
   * Adds a formatted footer section with size info.
   *
   * @returns this for chaining
   */
  footer(): this {
    this.blank();
    this.section('End of Program');
    this.comment(`Code size: ${this.state.codeBytes} bytes`);
    this.comment(`Data size: ${this.state.dataBytes} bytes`);
    this.comment(`Total size: ${this.state.codeBytes + this.state.dataBytes} bytes`);
    this.comment(`Functions: ${this.state.functionCount}`);
    this.comment(`Globals: ${this.state.globalCount}`);
    return this;
  }

  // ========================================
  // BASIC LOADER HELPERS
  // ========================================

  /**
   * Emit C64 BASIC loader stub
   *
   * Creates the standard BASIC SYS line that auto-runs the program.
   * Format: 10 SYS 2061 (or appropriate address)
   *
   * @param sysAddress - Address to SYS to (default: calculated)
   * @returns this for chaining
   */
  basicLoader(sysAddress?: number): this {
    // Standard C64 BASIC stub for programs at $0801
    // 10 SYS 2061 (or $080D in hex - after the BASIC line)
    const address = sysAddress ?? this.state.origin + 12;

    this.section('BASIC Loader');
    this.setOrigin(0x0801, 'BASIC program start');

    // BASIC line structure:
    // - 2 bytes: pointer to next line
    // - 2 bytes: line number
    // - tokens and data
    // - 1 byte: null terminator
    // - 2 bytes: null pointer (end of program)

    // Emit the BASIC line using raw (assembler calculates addresses)
    this.raw('        !word .basic_end  ; Pointer to next line');
    this.raw('        !word 10          ; Line number 10');
    this.raw(`        !byte $9e         ; SYS token`);
    this.raw(`        !text "${address}" ; Address as text`);
    this.raw('        !byte 0           ; End of line');
    this.raw('.basic_end');
    this.raw('        !word 0           ; End of BASIC program');
    this.blank();

    // Update current address estimate
    this.state.currentAddress = address;

    return this;
  }

  // ========================================
  // MODULE BUILDING
  // ========================================

  /**
   * Build the final AsmModule
   *
   * Creates an immutable AsmModule from the current builder state.
   * This should be called once when construction is complete.
   *
   * @returns Complete ASM-IL module
   */
  build(): AsmModule {
    const metadata: AsmModuleMetadata = {
      generatedAt: new Date().toISOString(),
      compilerVersion: '0.1.0',
      optimizationLevel: 'O0',
      estimatedCodeSize: this.state.codeBytes,
      estimatedDataSize: this.state.dataBytes,
      functionCount: this.state.functionCount,
      globalCount: this.state.globalCount,
    };

    return {
      name: this.state.name,
      origin: this.state.origin,
      target: this.state.target,
      outputFile: this.outputFile,
      items: [...this.state.items], // Copy array for immutability
      labels: new Map(this.state.labels), // Copy map for immutability
      metadata,
    };
  }

  /**
   * Reset builder for reuse
   *
   * Clears all state, allowing the builder to be reused for a new module.
   * The name, origin, and target are preserved.
   *
   * @returns this for chaining
   */
  reset(): this {
    this.state.items = [];
    this.state.labels.clear();
    this.state.currentAddress = this.state.origin;
    this.state.codeBytes = 0;
    this.state.dataBytes = 0;
    this.state.functionCount = 0;
    this.state.globalCount = 0;
    this.outputFile = undefined;
    this.currentLocation = undefined;
    return this;
  }

  /**
   * Clone the builder
   *
   * Creates a new builder with a copy of the current state.
   * Useful for creating variations of a module.
   *
   * @returns New AsmModuleBuilder with copied state
   */
  clone(): AsmModuleBuilder {
    const cloned = new AsmModuleBuilder(
      this.state.name,
      this.state.origin,
      this.state.target,
    );

    cloned.state = {
      ...this.state,
      items: [...this.state.items],
      labels: new Map(this.state.labels),
    };

    cloned.outputFile = this.outputFile;
    cloned.currentLocation = this.currentLocation;

    return cloned;
  }
}

/**
 * Factory function to create an ASM module builder
 *
 * @param name - Module name
 * @param origin - Initial origin address (default: $0801)
 * @param target - Target architecture (default: 'c64')
 * @returns New AsmModuleBuilder
 */
export function createAsmModuleBuilder(
  name: string,
  origin: number = 0x0801,
  target: string = 'c64',
): AsmModuleBuilder {
  return new AsmModuleBuilder(name, origin, target);
}
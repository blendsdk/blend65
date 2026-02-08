/**
 * Code Generator Class for Blend65 Compiler
 *
 * Final concrete class that provides the main entry point for code generation.
 * Extends the full inheritance chain and orchestrates the generation process.
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * **ASM-IL Architecture:**
 * The code generator produces a structured AsmModule via AsmModuleBuilder.
 * This module is then emitted to ACME assembly text via AcmeEmitter.
 * All output flows through the ASM-IL layer - there is no direct text emission.
 *
 * @example
 * ```typescript
 * const codegen = new CodeGenerator();
 * const result = codegen.generate(ilModule, {
 *   target: C64_CONFIG,
 *   format: 'both',
 *   debug: 'inline',
 * });
 *
 * // Write outputs
 * writeFileSync('game.asm', result.assembly);
 * if (result.binary) {
 *   writeFileSync('game.prg', result.binary);
 * }
 * ```
 *
 * @module codegen/code-generator
 */

import type { ILModule } from '../il/module.js';
import type { CodegenOptions, CodegenResult } from './types.js';
import { C64_BASIC_START, C64_CODE_START } from './types.js';
import { generateBasicStub } from './basic-stub.js';
import { isAcmeAvailable, invokeAcmeSync, AcmeNotFoundError, AcmeError } from './acme-invoker.js';
import { InstructionGenerator } from './instruction-generator.js';

/**
 * Code Generator - final concrete implementation
 *
 * Transforms IL (Intermediate Language) into 6502 assembly code
 * and optionally assembles to binary .prg format using ACME.
 *
 * **Generation Pipeline:**
 * 1. Reset state and configure options
 * 2. Start ASM-IL generation with module name and origin
 * 3. Generate file header comments
 * 4. Generate BASIC stub (if enabled)
 * 5. Generate program entry point
 * 6. Generate global variables (ZP, RAM, DATA, MAP)
 * 7. Generate functions and instructions
 * 8. Generate file footer
 * 9. Finalize AsmModule
 * 10. Emit to ACME text via AcmeEmitter
 * 11. Assemble to binary (if ACME available and format requires it)
 * 12. Return complete result
 *
 * **Current Capabilities:**
 * - Generates ACME-compatible assembly via ASM-IL
 * - Handles @map hardware writes/reads
 * - Handles @zp, @ram, @data variable allocation
 * - Generates BASIC autostart stub
 * - Supports debug comments and source mapping
 * - Produces .prg binary output via ACME
 */
export class CodeGenerator extends InstructionGenerator {
  // ============================================
  // MAIN PUBLIC API
  // ============================================

  /**
   * Generate code from an IL module
   *
   * Main entry point for code generation. Transforms IL into
   * assembly and optionally binary output.
   *
   * @param module - IL module to generate code from
   * @param options - Code generation options
   * @returns Complete code generation result
   *
   * @example
   * ```typescript
   * const result = codegen.generate(ilModule, {
   *   target: C64_CONFIG,
   *   format: 'both',
   *   sourceMap: true,
   *   debug: 'inline',
   * });
   * ```
   */
  public generate(module: ILModule, options: CodegenOptions): CodegenResult {
    // Store options and module for access by parent classes
    this.options = options;
    this.currentModule = module;

    // Configure source mapper
    this.sourceMapper.setFilePath(module.name);

    // Reset state for new generation
    this.resetState();

    // Start ASM-IL generation
    const loadAddress = options.loadAddress ?? C64_BASIC_START;
    this.startAsmILGeneration(module.name, loadAddress);

    // === GENERATION PIPELINE ===

    // 1. Generate file header
    this.generateHeader();

    // 2. Generate BASIC stub (if enabled)
    if (options.basicStub !== false) {
      this.generateBasicStubSection();
    }

    // 3. Generate program entry point
    this.generateEntryPoint();

    // 4. Generate global variables
    this.generateGlobals();

    // 5. Generate functions
    this.generateFunctions();

    // 6. Generate file footer
    this.generateFooter();

    // 7. Finalize statistics
    this.finalizeStats();

    // === BUILD RESULT ===

    // Finish ASM-IL generation and get the module
    const asmModule = this.finishAsmILGeneration();

    // Emit to ACME assembly text
    const assembly = this.emitAsmModuleToText(asmModule);

    // Assemble to binary if requested
    let binary: Uint8Array | undefined;
    if (options.format === 'prg' || options.format === 'both') {
      binary = this.assembleWithAcme(assembly);
    }

    // Handle unsupported formats
    if (options.format === 'crt') {
      this.addWarning('CRT (cartridge) output format is not implemented yet. Generating .asm only.');
    }

    // Generate VICE labels if requested
    let viceLabels: string | undefined;
    if (options.debug === 'vice' || options.debug === 'both') {
      viceLabels = this.generateViceLabels();
    }

    // Build and return result
    return {
      module: asmModule,
      assembly,
      binary,
      sourceMap: options.sourceMap ? this.getSourceMapEntries() : undefined,
      viceLabels,
      warnings: this.getWarningsWithLocations(),
      stats: this.getStats(),
    };
  }

  // ============================================
  // HEADER GENERATION
  // ============================================

  /**
   * Generates the file header comments
   */
  protected generateHeader(): void {
    // Emit header via ASM-IL
    this.asmBuilder.header(this.currentModule.name);

    // Emit load address
    const loadAddress = this.options.loadAddress ?? C64_BASIC_START;
    this.emitSectionComment('Configuration');
    this.asmBuilder.setOrigin(loadAddress, 'Program load address');
  }

  // ============================================
  // BASIC STUB GENERATION
  // ============================================

  /**
   * Generates the BASIC autostart stub section
   */
  protected generateBasicStubSection(): void {
    // Calculate where code will start after BASIC stub
    const loadAddress = this.options.loadAddress ?? C64_BASIC_START;
    const stub = generateBasicStub({
      sysAddress: C64_CODE_START,
      loadAddress,
    });

    this.emitSectionComment(`BASIC Stub (${stub.basicLine})`);

    // Emit stub bytes as assembly directives
    this.asmBuilder.byte(Array.from(stub.bytes), 'BASIC stub bytes');
    this.addDataBytes(stub.size);

    // Update address to code start
    this.asmBuilder.blank();
    this.asmBuilder.setOrigin(C64_CODE_START, 'Code start');
    this.currentAddress = C64_CODE_START;
  }

  // ============================================
  // ENTRY POINT GENERATION
  // ============================================

  /**
   * Generates the program entry point
   *
   * Creates a simple entry point that:
   * 1. Optionally initializes globals
   * 2. Calls the main function (if present)
   * 3. Returns to BASIC via RTS
   *
   * **Clean Exit Philosophy:**
   * Programs should behave like C programs - main() returns and control
   * goes back to the caller (BASIC). If the user wants an infinite loop,
   * they write `while(true) {}` in their code.
   */
  protected generateEntryPoint(): void {
    this.emitSectionComment('Program Entry Point');

    // Check if module has a main function
    const entryPointName = this.currentModule.getEntryPointName();
    const mainFunc = this.currentModule.getFunction('main') || this.currentModule.getFunction(entryPointName ?? '');

    if (!mainFunc) {
      // No main function - just return to BASIC immediately
      this.emitComment('No main function - return to BASIC');
      this.emitRts('Return to BASIC');
      return;
    }

    // Generate init code that calls main
    const initLabel = this.labelGenerator.functionLabel('_start', this.currentAddress);
    this.emitLabel(initLabel);

    // Initialize zero-page variables if any
    if (this.zpAllocations.size > 0) {
      this.generateZpInitialization();
    }

    // Call main function
    const mainLabel = `_${mainFunc.name}`;
    this.emitJsr(mainLabel, 'Call main');

    // Return to BASIC after main returns
    this.emitRts('Return to BASIC');
  }

  // ============================================
  // FOOTER GENERATION
  // ============================================

  /**
   * Generates the file footer
   */
  protected generateFooter(): void {
    this.emitSectionComment('End of Program');
    this.emitComment(`Code size: ${this.stats.codeSize} bytes`);
    this.emitComment(`Data size: ${this.stats.dataSize} bytes`);
    this.emitComment(`ZP used: ${this.stats.zpBytesUsed} bytes`);
    this.emitComment(`Functions: ${this.stats.functionCount}`);
    this.emitComment(`Globals: ${this.stats.globalCount}`);
  }

  // ============================================
  // ACME ASSEMBLY
  // ============================================

  /**
   * Assembles the generated assembly using ACME
   *
   * Invokes ACME synchronously to assemble the generated assembly
   * into a PRG binary file.
   *
   * @param assembly - Assembly source text
   * @returns Binary .prg data, or undefined if ACME not available or assembly failed
   */
  protected assembleWithAcme(assembly: string): Uint8Array | undefined {
    // Check if ACME is available
    if (!isAcmeAvailable(this.options.acmePath)) {
      this.addWarning(
        'ACME assembler not found. Install ACME for binary output. ' +
          'Assembly file generated but .prg binary not created.'
      );
      return undefined;
    }

    try {
      // Invoke ACME synchronously to assemble the source
      const result = invokeAcmeSync(assembly, {
        format: 'prg',
        labels: false,
        acmePath: this.options.acmePath,
      });

      return result.binary;
    } catch (error) {
      if (error instanceof AcmeNotFoundError) {
        this.addWarning(`ACME not found: ${error.message}`);
      } else if (error instanceof AcmeError) {
        this.addWarning(`ACME assembly failed: ${error.stderr || error.message}`);
      } else {
        this.addWarning(`ACME assembly failed: ${error}`);
      }
      return undefined;
    }
  }

  // ============================================
  // VICE LABELS GENERATION
  // ============================================

  /**
   * Generates VICE monitor label file content
   *
   * @returns VICE label file content
   */
  protected generateViceLabels(): string {
    // Combine labels from labelGenerator and sourceMapper
    const generatorLabels = this.labelGenerator.generateViceLabels();
    const mapperLabels = this.sourceMapper.generateViceLabels();

    // Merge (labelGenerator has the primary labels)
    return generatorLabels + '\n' + mapperLabels;
  }
}
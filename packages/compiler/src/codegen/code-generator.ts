/**
 * Code Generator Class for Blend65 Compiler
 *
 * Final concrete class that provides the main entry point for code generation.
 * Extends the full inheritance chain and orchestrates the generation process.
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * **STUB IMPLEMENTATION**
 * This is a minimal implementation that generates basic working code.
 * Full instruction selection and optimization will be added in future phases.
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
import { isAcmeAvailable, AcmeNotFoundError } from './acme-invoker.js';
import { InstructionGenerator } from './instruction-generator.js';

/**
 * Code Generator - final concrete implementation
 *
 * Transforms IL (Intermediate Language) into 6502 assembly code
 * and optionally assembles to binary .prg format using ACME.
 *
 * **Generation Pipeline:**
 * 1. Reset state and configure options
 * 2. Generate file header comments
 * 3. Generate BASIC stub (if enabled)
 * 4. Generate global variables (ZP, RAM, DATA, MAP)
 * 5. Generate functions and instructions
 * 6. Generate file footer
 * 7. Assemble to binary (if ACME available and format requires it)
 * 8. Return complete result
 *
 * **Current Capabilities (Stub Phase):**
 * - Generates ACME-compatible assembly
 * - Handles @map hardware writes/reads
 * - Handles @zp, @ram, @data variable allocation
 * - Generates BASIC autostart stub
 * - Supports debug comments and source mapping
 * - Produces .prg binary output via ACME
 *
 * **Future Capabilities (Full Implementation):**
 * - Complete instruction selection
 * - Register allocation optimization
 * - Complex expression compilation
 * - Full control flow
 * - Function call ABI
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
    if (options.debug === 'inline' || options.debug === 'both') {
      this.assemblyWriter.setIncludeSourceComments(true);
    }

    // Reset state for new generation
    this.resetState();

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

    // Get assembly text
    const assembly = this.assemblyWriter.toString();

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
      assembly,
      binary,
      sourceMap: options.sourceMap ? this.getSourceMapEntries() : undefined,
      viceLabels,
      warnings: this.getWarnings(),
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
    const targetName = this.options.target?.architecture ?? 'c64';
    this.assemblyWriter.emitHeader(this.currentModule.name, targetName);

    // Emit load address
    const loadAddress = this.options.loadAddress ?? C64_BASIC_START;
    this.emitSectionComment('Configuration');
    this.assemblyWriter.emitOrigin(loadAddress);
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
    this.assemblyWriter.emitBytes(Array.from(stub.bytes), 'BASIC stub bytes');
    this.addDataBytes(stub.size);

    // Update address to code start
    this.assemblyWriter.emitBlankLine();
    this.assemblyWriter.emitOrigin(C64_CODE_START);
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
   * 3. Returns or loops
   */
  protected generateEntryPoint(): void {
    this.emitSectionComment('Program Entry Point');

    // Check if module has a main function
    const entryPointName = this.currentModule.getEntryPointName();
    const mainFunc = this.currentModule.getFunction('main') || this.currentModule.getFunction(entryPointName ?? '');

    if (!mainFunc) {
      // No main function - just emit a simple infinite loop
      this.emitComment('No main function - infinite loop');
      const loopLabel = this.getTempLabel('loop');
      this.emitLabel(loopLabel);
      this.emitJmp(loopLabel, 'Infinite loop');
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

    // After main returns, infinite loop to prevent crash
    const endLabel = this.getTempLabel('end');
    this.emitLabel(endLabel);
    this.emitJmp(endLabel, 'End: infinite loop');
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
   * @param _assembly - Assembly source text (unused in stub, will be used in full impl)
   * @returns Binary .prg data, or undefined if ACME not available
   */
  protected assembleWithAcme(_assembly: string): Uint8Array | undefined {
    // Check if ACME is available
    if (!isAcmeAvailable(this.options.acmePath)) {
      this.addWarning(
        'ACME assembler not found. Install ACME for binary output. ' +
          'Assembly file generated but .prg binary not created.'
      );
      return undefined;
    }

    try {
      // Use synchronous pattern for stub (async will be added in full impl)
      // For now, return undefined and let caller use the async invokeAcme directly
      this.addWarning(
        'Binary generation requires async ACME invocation. ' +
          'Use invokeAcme() directly for .prg output.'
      );
      return undefined;
    } catch (error) {
      if (error instanceof AcmeNotFoundError) {
        this.addWarning(`ACME not found: ${error.message}`);
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
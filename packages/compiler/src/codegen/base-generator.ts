/**
 * Base Code Generator Class for Blend65 Compiler
 *
 * Provides fundamental code generation infrastructure:
 * - AsmModuleBuilder for structured ASM-IL output (Phase 3e)
 * - Helper class instances (LabelGenerator, SourceMapper)
 * - Code generation options and warnings management
 * - Statistics tracking
 * - Utility methods for common patterns
 *
 * **Phase 3e Changes:**
 * The code generator now uses AsmModuleBuilder to produce structured
 * AsmModule output instead of raw assembly text. The AssemblyWriter
 * is retained for backward compatibility during the transition.
 *
 * This is the foundation that all code generator layers build upon.
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module codegen/base-generator
 */

import type { ILModule } from '../il/module.js';
import type { SourceLocation } from '../ast/base.js';
import type { CodegenOptions, CodegenStats, SourceMapEntry, CodegenWarning } from './types.js';
import type { AsmModule } from '../asm-il/types.js';
import { AsmModuleBuilder } from '../asm-il/builder/index.js';
import { createAcmeEmitter } from '../asm-il/emitters/index.js';
import { AssemblyWriter } from './assembly-writer.js';
import { LabelGenerator } from './label-generator.js';
import { SourceMapper } from './source-mapper.js';
import { C64_CODE_START } from './types.js';

/**
 * Abstract base class for code generation
 *
 * Provides core infrastructure used by all code generation phases:
 * - AsmModuleBuilder for structured ASM-IL output (Phase 3e)
 * - AssemblyWriter for legacy text output (backward compatibility)
 * - Label management via LabelGenerator
 * - Source mapping for debugging via SourceMapper
 * - Warning collection and statistics tracking
 *
 * **Phase 3e Architecture:**
 * The generator produces an AsmModule via the builder, which is then
 * emitted to text via AcmeEmitter. The AssemblyWriter is retained
 * during the transition period but will be deprecated.
 *
 * This class cannot be instantiated directly - use the concrete CodeGenerator class.
 */
export abstract class BaseCodeGenerator {
  // ============================================
  // ASM-IL BUILDER (Phase 3e)
  // ============================================

  /**
   * ASM-IL module builder
   *
   * Primary output mechanism for code generation (Phase 3e).
   * Produces structured AsmModule that can be optimized and emitted.
   *
   * @since Phase 3e (CodeGenerator Rewire)
   */
  protected asmBuilder: AsmModuleBuilder;

  /**
   * Whether to use ASM-IL builder (Phase 3e) or legacy AssemblyWriter
   *
   * During transition, this allows gradual migration.
   * Default: false (use legacy AssemblyWriter)
   *
   * Set to true to enable ASM-IL output.
   *
   * @since Phase 3e (CodeGenerator Rewire)
   */
  protected useAsmIL: boolean = false;

  // ============================================
  // LEGACY HELPER CLASS INSTANCES
  // ============================================

  /**
   * Assembly text generator (legacy)
   *
   * Used to emit ACME-compatible 6502 assembly code.
   * Handles formatting, indentation, and directives.
   *
   * @deprecated Use asmBuilder instead (Phase 3e transition)
   */
  protected assemblyWriter: AssemblyWriter;

  /**
   * Label name generator
   *
   * Generates unique, consistent labels for functions,
   * variables, and control flow blocks.
   */
  protected labelGenerator: LabelGenerator;

  /**
   * Source location tracker
   *
   * Maps generated assembly addresses back to original
   * Blend65 source locations for debugging.
   */
  protected sourceMapper: SourceMapper;

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  /**
   * Code generation options
   *
   * Configuration for target, output format, debug mode, etc.
   */
  protected options!: CodegenOptions;

  /**
   * Current IL module being processed
   */
  protected currentModule!: ILModule;

  /**
   * Warnings collected during generation
   *
   * Non-fatal issues are collected here for reporting.
   * Each warning contains a message and optional source location.
   */
  protected warnings: CodegenWarning[] = [];

  /**
   * Statistics about generated code
   */
  protected stats: CodegenStats = {
    codeSize: 0,
    dataSize: 0,
    zpBytesUsed: 0,
    functionCount: 0,
    globalCount: 0,
    totalSize: 0,
  };

  /**
   * Current address being generated
   *
   * Tracked for source mapping and statistics.
   */
  protected currentAddress: number = C64_CODE_START;

  // ============================================
  // CONSTRUCTOR
  // ============================================

  /**
   * Creates a new base code generator
   *
   * Initializes helper class instances including the ASM-IL builder.
   */
  constructor() {
    this.asmBuilder = new AsmModuleBuilder('unnamed');
    this.assemblyWriter = new AssemblyWriter();
    this.labelGenerator = new LabelGenerator();
    this.sourceMapper = new SourceMapper();
  }

  // ============================================
  // STATE RESET
  // ============================================

  /**
   * Resets all generator state for a new generation pass
   *
   * Called at the start of generate() to ensure clean state.
   */
  protected resetState(): void {
    // Reset ASM-IL builder (Phase 3e)
    this.asmBuilder.reset();

    // Reset legacy systems
    this.assemblyWriter.reset();
    this.labelGenerator.reset();
    this.sourceMapper.reset();
    this.warnings = [];
    this.stats = {
      codeSize: 0,
      dataSize: 0,
      zpBytesUsed: 0,
      functionCount: 0,
      globalCount: 0,
      totalSize: 0,
    };
    this.currentAddress = this.options.loadAddress ?? C64_CODE_START;
  }

  // ============================================
  // ASM-IL GENERATION HELPERS (Phase 3e)
  // ============================================

  /**
   * Starts a new ASM-IL generation session
   *
   * Configures the builder with module name and origin address.
   * Call this at the beginning of code generation.
   *
   * @param moduleName - Name of the module being generated
   * @param origin - Load address (origin) for the module
   *
   * @since Phase 3e (CodeGenerator Rewire)
   */
  protected startAsmILGeneration(moduleName: string, origin: number): void {
    this.asmBuilder = new AsmModuleBuilder(moduleName, origin);
  }

  /**
   * Finishes ASM-IL generation and returns the module
   *
   * Adds footer and builds the final AsmModule.
   *
   * @returns The completed AsmModule
   *
   * @since Phase 3e (CodeGenerator Rewire)
   */
  protected finishAsmILGeneration(): AsmModule {
    return this.asmBuilder.build();
  }

  /**
   * Emits the AsmModule to ACME assembly text
   *
   * Uses the AcmeEmitter to convert the AsmModule to text format.
   *
   * @param module - The AsmModule to emit
   * @returns The ACME assembly text
   *
   * @since Phase 3e (CodeGenerator Rewire)
   */
  protected emitAsmModuleToText(module: AsmModule): string {
    const emitter = createAcmeEmitter();
    const result = emitter.emit(module);
    return result.text;
  }

  /**
   * Gets the current AsmModule being built
   *
   * Useful for testing and inspection.
   *
   * @returns The AsmModule (calls build() on the builder)
   *
   * @since Phase 3e (CodeGenerator Rewire)
   */
  protected getCurrentAsmModule(): AsmModule {
    return this.asmBuilder.build();
  }

  // ============================================
  // WARNING MANAGEMENT
  // ============================================

  /**
   * Adds a warning message with optional source location
   *
   * Warnings are collected and returned in the result.
   * When a source location is provided, rich diagnostic output
   * with source snippets can be generated.
   *
   * @param message - Warning message
   * @param location - Optional source location for rich diagnostics
   */
  protected addWarning(message: string, location?: SourceLocation): void {
    this.warnings.push({ message, location });
  }

  /**
   * Gets all collected warnings as strings (for backward compatibility)
   *
   * @returns Array of warning message strings
   */
  protected getWarnings(): string[] {
    return this.warnings.map((w) => w.message);
  }

  /**
   * Gets all collected warnings with full location information
   *
   * Use this method for rich diagnostic output that includes
   * source code snippets and caret markers.
   *
   * @returns Array of CodegenWarning objects
   */
  protected getWarningsWithLocations(): CodegenWarning[] {
    return [...this.warnings];
  }

  // ============================================
  // STATISTICS TRACKING
  // ============================================

  /**
   * Increments code size counter
   *
   * @param bytes - Number of code bytes to add
   */
  protected addCodeBytes(bytes: number): void {
    this.stats.codeSize += bytes;
    this.currentAddress += bytes;
  }

  /**
   * Increments data size counter
   *
   * @param bytes - Number of data bytes to add
   */
  protected addDataBytes(bytes: number): void {
    this.stats.dataSize += bytes;
  }

  /**
   * Increments zero-page usage counter
   *
   * @param bytes - Number of ZP bytes to add
   */
  protected addZpBytes(bytes: number): void {
    this.stats.zpBytesUsed += bytes;
  }

  /**
   * Increments function counter
   */
  protected incrementFunctionCount(): void {
    this.stats.functionCount++;
  }

  /**
   * Increments global variable counter
   */
  protected incrementGlobalCount(): void {
    this.stats.globalCount++;
  }

  /**
   * Finalizes statistics
   *
   * Calculates total size and other derived stats.
   */
  protected finalizeStats(): void {
    this.stats.totalSize = this.stats.codeSize + this.stats.dataSize;
  }

  /**
   * Gets current statistics
   *
   * @returns Copy of current stats
   */
  protected getStats(): CodegenStats {
    return { ...this.stats };
  }

  // ============================================
  // SOURCE MAPPING HELPERS
  // ============================================

  /**
   * Tracks a source location at the current address
   *
   * @param source - Source location from IL metadata
   * @param label - Optional label at this location
   * @param description - Optional description for debug comments
   */
  protected trackLocation(source?: SourceLocation, label?: string, description?: string): void {
    if (!source) return;

    this.sourceMapper.trackLocation(this.currentAddress, source, label, description);
  }

  /**
   * Emits a source location comment if debug mode is enabled
   *
   * @param source - Source location
   * @param description - Optional description
   */
  protected emitSourceComment(source?: SourceLocation, description?: string): void {
    if (!source) return;
    if (this.options.debug === 'none') return;

    if (this.options.debug === 'inline' || this.options.debug === 'both') {
      if (description) {
        this.assemblyWriter.emitRaw(
          this.sourceMapper.formatInlineCommentWithDesc(source, description)
        );
      } else {
        this.assemblyWriter.emitRaw(this.sourceMapper.formatInlineComment(source));
      }
    }
  }

  /**
   * Gets all source map entries
   *
   * @returns Array of source map entries
   */
  protected getSourceMapEntries(): SourceMapEntry[] {
    return this.sourceMapper.getEntries();
  }

  // ============================================
  // FORMATTING HELPERS
  // ============================================

  /**
   * Formats a number as hexadecimal with $ prefix
   *
   * @param value - Number to format
   * @param digits - Minimum digits (default: 4)
   * @returns Formatted hex string (e.g., '$D020')
   */
  protected formatHex(value: number, digits: number = 4): string {
    return '$' + value.toString(16).toUpperCase().padStart(digits, '0');
  }

  /**
   * Formats a byte value as immediate operand
   *
   * @param value - Byte value (0-255)
   * @returns Formatted immediate operand (e.g., '#$05')
   */
  protected formatImmediate(value: number): string {
    return '#' + this.formatHex(value & 0xff, 2);
  }

  /**
   * Formats an address as absolute operand
   *
   * @param address - Memory address
   * @returns Formatted address (e.g., '$D020')
   */
  protected formatAbsolute(address: number): string {
    return this.formatHex(address, 4);
  }

  /**
   * Formats a zero-page address
   *
   * @param address - Zero-page address (0-255)
   * @returns Formatted ZP address (e.g., '$02')
   */
  protected formatZeroPage(address: number): string {
    return this.formatHex(address & 0xff, 2);
  }

  // ============================================
  // COMMENT HELPERS
  // ============================================

  /**
   * Emits a section separator comment
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   *
   * @param title - Section title
   */
  protected emitSectionComment(title: string): void {
    // Legacy: AssemblyWriter
    this.assemblyWriter.emitBlankLine();
    this.assemblyWriter.emitSectionHeader(title);

    // Phase 3e: AsmBuilder (when enabled)
    if (this.useAsmIL) {
      this.asmBuilder.blank();
      this.asmBuilder.section(title);
    }
  }

  /**
   * Emits a simple comment line
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   *
   * @param text - Comment text
   */
  protected emitComment(text: string): void {
    // Legacy: AssemblyWriter
    this.assemblyWriter.emitComment(text);

    // Phase 3e: AsmBuilder (when enabled)
    if (this.useAsmIL) {
      this.asmBuilder.comment(text);
    }
  }

  // ============================================
  // INSTRUCTION EMISSION HELPERS
  // ============================================

  /**
   * Emits a single instruction
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   * This is a low-level method used by specific instruction helpers.
   *
   * @param mnemonic - Instruction mnemonic (e.g., 'LDA')
   * @param operand - Optional operand
   * @param comment - Optional inline comment
   * @param bytes - Instruction size for address tracking
   */
  protected emitInstruction(
    mnemonic: string,
    operand?: string,
    comment?: string,
    bytes: number = 0
  ): void {
    // Legacy: AssemblyWriter
    this.assemblyWriter.emitInstruction(mnemonic, operand, comment);
    if (bytes > 0) {
      this.addCodeBytes(bytes);
    }

    // Note: AsmBuilder instruction emission is handled by specific helpers
    // (emitLdaImmediate, emitStaAbsolute, etc.) since they have typed methods
  }

  /**
   * Emits LDA immediate instruction
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   *
   * @param value - Byte value to load
   * @param comment - Optional comment
   */
  protected emitLdaImmediate(value: number, comment?: string): void {
    // Legacy: AssemblyWriter
    this.emitInstruction('LDA', this.formatImmediate(value), comment, 2);

    // Phase 3e: AsmBuilder (when enabled)
    if (this.useAsmIL) {
      this.asmBuilder.ldaImm(value, comment);
    }
  }

  /**
   * Emits LDA absolute instruction
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   *
   * @param address - Memory address to load from
   * @param comment - Optional comment
   */
  protected emitLdaAbsolute(address: number, comment?: string): void {
    // Legacy: AssemblyWriter
    this.emitInstruction('LDA', this.formatAbsolute(address), comment, 3);

    // Phase 3e: AsmBuilder (when enabled)
    if (this.useAsmIL) {
      this.asmBuilder.ldaAbs(address, comment);
    }
  }

  /**
   * Emits LDA zero-page instruction
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   *
   * @param address - Zero-page address to load from
   * @param comment - Optional comment
   */
  protected emitLdaZeroPage(address: number, comment?: string): void {
    // Legacy: AssemblyWriter
    this.emitInstruction('LDA', this.formatZeroPage(address), comment, 2);

    // Phase 3e: AsmBuilder (when enabled)
    if (this.useAsmIL) {
      this.asmBuilder.ldaZp(address, comment);
    }
  }

  /**
   * Emits STA absolute instruction
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   *
   * @param address - Memory address to store to
   * @param comment - Optional comment
   */
  protected emitStaAbsolute(address: number, comment?: string): void {
    // Legacy: AssemblyWriter
    this.emitInstruction('STA', this.formatAbsolute(address), comment, 3);

    // Phase 3e: AsmBuilder (when enabled)
    if (this.useAsmIL) {
      this.asmBuilder.staAbs(address, comment);
    }
  }

  /**
   * Emits STA zero-page instruction
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   *
   * @param address - Zero-page address to store to
   * @param comment - Optional comment
   */
  protected emitStaZeroPage(address: number, comment?: string): void {
    // Legacy: AssemblyWriter
    this.emitInstruction('STA', this.formatZeroPage(address), comment, 2);

    // Phase 3e: AsmBuilder (when enabled)
    if (this.useAsmIL) {
      this.asmBuilder.staZp(address, comment);
    }
  }

  /**
   * Emits JMP instruction
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   *
   * @param label - Label to jump to
   * @param comment - Optional comment
   */
  protected emitJmp(label: string, comment?: string): void {
    // Legacy: AssemblyWriter
    this.emitInstruction('JMP', label, comment, 3);

    // Phase 3e: AsmBuilder (when enabled)
    if (this.useAsmIL) {
      this.asmBuilder.jmp(label, comment);
    }
  }

  /**
   * Emits JSR instruction
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   *
   * @param label - Label to call
   * @param comment - Optional comment
   */
  protected emitJsr(label: string, comment?: string): void {
    // Legacy: AssemblyWriter
    this.emitInstruction('JSR', label, comment, 3);

    // Phase 3e: AsmBuilder (when enabled)
    if (this.useAsmIL) {
      this.asmBuilder.jsr(label, comment);
    }
  }

  /**
   * Emits RTS instruction
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   *
   * @param comment - Optional comment
   */
  protected emitRts(comment?: string): void {
    // Legacy: AssemblyWriter
    this.emitInstruction('RTS', undefined, comment, 1);

    // Phase 3e: AsmBuilder (when enabled)
    if (this.useAsmIL) {
      this.asmBuilder.rts(comment);
    }
  }

  /**
   * Emits NOP instruction
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   *
   * @param comment - Optional comment
   */
  protected emitNop(comment?: string): void {
    // Legacy: AssemblyWriter
    this.emitInstruction('NOP', undefined, comment, 1);

    // Phase 3e: AsmBuilder (when enabled)
    if (this.useAsmIL) {
      this.asmBuilder.nop(comment);
    }
  }

  // ============================================
  // LABEL HELPERS
  // ============================================

  /**
   * Emits a label definition
   *
   * Writes to both AssemblyWriter (legacy) and AsmBuilder (Phase 3e).
   *
   * @param name - Label name
   * @param labelType - Optional label type for AsmBuilder (default: 'block')
   * @param comment - Optional comment for the label
   */
  protected emitLabel(name: string, labelType?: 'function' | 'global' | 'block' | 'data' | 'temp', comment?: string): void {
    // Legacy: AssemblyWriter
    this.assemblyWriter.emitLabel(name);

    // Phase 3e: AsmBuilder (when enabled)
    if (this.useAsmIL) {
      switch (labelType) {
        case 'function':
          this.asmBuilder.functionLabel(name, comment);
          break;
        case 'global':
          this.asmBuilder.globalLabel(name, comment);
          break;
        case 'data':
          this.asmBuilder.dataLabel(name, comment);
          break;
        case 'temp':
          this.asmBuilder.tempLabel(name, comment);
          break;
        case 'block':
        default:
          this.asmBuilder.blockLabel(name, comment);
          break;
      }
    }
  }

  /**
   * Gets the label for an existing function
   *
   * This returns the standard function label format without registering
   * a new label. Use this when CALLING a function that was already defined.
   *
   * For function DEFINITIONS, use labelGenerator.functionLabel() to register
   * the label in the label table.
   *
   * @param name - Function name
   * @returns Standard function label (e.g., '_main')
   */
  protected getFunctionLabel(name: string): string {
    // Just return the standard function label format without registering
    // This is used for function CALLS where the function is already defined
    // Sanitize the name to match what functionLabel() does
    const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');
    return `_${sanitized}`;
  }

  /**
   * Generates and returns a global variable label
   *
   * @param name - Variable name
   * @returns Generated label (e.g., '_counter')
   */
  protected getGlobalLabel(name: string): string {
    return this.labelGenerator.globalLabel(name, this.currentAddress);
  }

  /**
   * Generates and returns a block label
   *
   * @param name - Block name
   * @returns Generated label (e.g., '.block_entry')
   */
  protected getBlockLabel(name: string): string {
    return this.labelGenerator.blockLabel(name, this.currentAddress);
  }

  /**
   * Generates and returns a temporary label
   *
   * @param prefix - Optional prefix
   * @returns Generated label (e.g., '.L_0001')
   */
  protected getTempLabel(prefix?: string): string {
    return this.labelGenerator.tempLabel(prefix, this.currentAddress);
  }
}
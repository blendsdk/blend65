/**
 * Base Code Generator Class for Blend65 Compiler
 *
 * Provides fundamental code generation infrastructure:
 * - Helper class instances (AssemblyWriter, LabelGenerator, SourceMapper)
 * - Code generation options and warnings management
 * - Statistics tracking
 * - Utility methods for common patterns
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
import type { CodegenOptions, CodegenStats, SourceMapEntry } from './types.js';
import { AssemblyWriter } from './assembly-writer.js';
import { LabelGenerator } from './label-generator.js';
import { SourceMapper } from './source-mapper.js';
import { C64_CODE_START } from './types.js';

/**
 * Abstract base class for code generation
 *
 * Provides core infrastructure used by all code generation phases:
 * - Assembly output via AssemblyWriter
 * - Label management via LabelGenerator
 * - Source mapping for debugging via SourceMapper
 * - Warning collection and statistics tracking
 *
 * This class cannot be instantiated directly - use the concrete CodeGenerator class.
 */
export abstract class BaseCodeGenerator {
  // ============================================
  // HELPER CLASS INSTANCES
  // ============================================

  /**
   * Assembly text generator
   *
   * Used to emit ACME-compatible 6502 assembly code.
   * Handles formatting, indentation, and directives.
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
   */
  protected warnings: string[] = [];

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
   * Initializes helper class instances.
   */
  constructor() {
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
  // WARNING MANAGEMENT
  // ============================================

  /**
   * Adds a warning message
   *
   * Warnings are collected and returned in the result.
   *
   * @param message - Warning message
   */
  protected addWarning(message: string): void {
    this.warnings.push(message);
  }

  /**
   * Gets all collected warnings
   *
   * @returns Array of warning messages
   */
  protected getWarnings(): string[] {
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
   * @param title - Section title
   */
  protected emitSectionComment(title: string): void {
    this.assemblyWriter.emitBlankLine();
    this.assemblyWriter.emitSectionHeader(title);
  }

  /**
   * Emits a simple comment line
   *
   * @param text - Comment text
   */
  protected emitComment(text: string): void {
    this.assemblyWriter.emitComment(text);
  }

  // ============================================
  // INSTRUCTION EMISSION HELPERS
  // ============================================

  /**
   * Emits a single instruction
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
    this.assemblyWriter.emitInstruction(mnemonic, operand, comment);
    if (bytes > 0) {
      this.addCodeBytes(bytes);
    }
  }

  /**
   * Emits LDA immediate instruction
   *
   * @param value - Byte value to load
   * @param comment - Optional comment
   */
  protected emitLdaImmediate(value: number, comment?: string): void {
    this.emitInstruction('LDA', this.formatImmediate(value), comment, 2);
  }

  /**
   * Emits LDA absolute instruction
   *
   * @param address - Memory address to load from
   * @param comment - Optional comment
   */
  protected emitLdaAbsolute(address: number, comment?: string): void {
    this.emitInstruction('LDA', this.formatAbsolute(address), comment, 3);
  }

  /**
   * Emits LDA zero-page instruction
   *
   * @param address - Zero-page address to load from
   * @param comment - Optional comment
   */
  protected emitLdaZeroPage(address: number, comment?: string): void {
    this.emitInstruction('LDA', this.formatZeroPage(address), comment, 2);
  }

  /**
   * Emits STA absolute instruction
   *
   * @param address - Memory address to store to
   * @param comment - Optional comment
   */
  protected emitStaAbsolute(address: number, comment?: string): void {
    this.emitInstruction('STA', this.formatAbsolute(address), comment, 3);
  }

  /**
   * Emits STA zero-page instruction
   *
   * @param address - Zero-page address to store to
   * @param comment - Optional comment
   */
  protected emitStaZeroPage(address: number, comment?: string): void {
    this.emitInstruction('STA', this.formatZeroPage(address), comment, 2);
  }

  // ============================================
  // INDIRECT ADDRESSING HELPERS
  // ============================================

  /**
   * Emits LDA indirect Y-indexed instruction: LDA ($zp),Y
   *
   * Loads a byte from the address stored at the zero-page location,
   * plus the Y register offset. Commonly used with Y=0 for variable
   * address memory access.
   *
   * @param zpAddress - Zero-page address containing the 16-bit pointer
   * @param comment - Optional comment
   */
  protected emitLdaIndirectY(zpAddress: number, comment?: string): void {
    const operand = `(${this.formatZeroPage(zpAddress)}),Y`;
    this.emitInstruction('LDA', operand, comment, 2);
  }

  /**
   * Emits STA indirect Y-indexed instruction: STA ($zp),Y
   *
   * Stores the accumulator to the address stored at the zero-page location,
   * plus the Y register offset. Commonly used with Y=0 for variable
   * address memory access.
   *
   * @param zpAddress - Zero-page address containing the 16-bit pointer
   * @param comment - Optional comment
   */
  protected emitStaIndirectY(zpAddress: number, comment?: string): void {
    const operand = `(${this.formatZeroPage(zpAddress)}),Y`;
    this.emitInstruction('STA', operand, comment, 2);
  }

  /**
   * Emits LDY immediate instruction
   *
   * @param value - Byte value to load into Y
   * @param comment - Optional comment
   */
  protected emitLdyImmediate(value: number, comment?: string): void {
    this.emitInstruction('LDY', this.formatImmediate(value), comment, 2);
  }

  /**
   * Emits LDX immediate instruction
   *
   * @param value - Byte value to load into X
   * @param comment - Optional comment
   */
  protected emitLdxImmediate(value: number, comment?: string): void {
    this.emitInstruction('LDX', this.formatImmediate(value), comment, 2);
  }

  /**
   * Emits INY instruction (increment Y)
   *
   * @param comment - Optional comment
   */
  protected emitIny(comment?: string): void {
    this.emitInstruction('INY', undefined, comment, 1);
  }

  /**
   * Emits JMP instruction
   *
   * @param label - Label to jump to
   * @param comment - Optional comment
   */
  protected emitJmp(label: string, comment?: string): void {
    this.emitInstruction('JMP', label, comment, 3);
  }

  /**
   * Emits JSR instruction
   *
   * @param label - Label to call
   * @param comment - Optional comment
   */
  protected emitJsr(label: string, comment?: string): void {
    this.emitInstruction('JSR', label, comment, 3);
  }

  /**
   * Emits RTS instruction
   *
   * @param comment - Optional comment
   */
  protected emitRts(comment?: string): void {
    this.emitInstruction('RTS', undefined, comment, 1);
  }

  /**
   * Emits NOP instruction
   *
   * @param comment - Optional comment
   */
  protected emitNop(comment?: string): void {
    this.emitInstruction('NOP', undefined, comment, 1);
  }

  // ============================================
  // LABEL HELPERS
  // ============================================

  /**
   * Emits a label definition
   *
   * @param name - Label name
   */
  protected emitLabel(name: string): void {
    this.assemblyWriter.emitLabel(name);
  }

  /**
   * Generates and returns a function label
   *
   * @param name - Function name
   * @returns Generated label (e.g., '_main')
   */
  protected getFunctionLabel(name: string): string {
    return this.labelGenerator.functionLabel(name, this.currentAddress);
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
/**
 * Base Code Generator Class for Blend65 Compiler
 *
 * Provides fundamental code generation infrastructure:
 * - AsmModuleBuilder for structured ASM-IL output
 * - Helper class instances (LabelGenerator, SourceMapper)
 * - Code generation options and warnings management
 * - Statistics tracking
 * - Utility methods for common patterns
 *
 * **ASM-IL Architecture:**
 * The code generator produces a structured AsmModule via AsmModuleBuilder.
 * This module can be optimized and then emitted to text via AcmeEmitter.
 * All output flows through the ASM-IL layer - there is no direct text emission.
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
import type { CodegenOptions, CodegenStats, SourceMapEntry, CodegenWarning, TrackedValue } from './types.js';
import { ValueLocation } from './types.js';
import type { AsmModule } from '../asm-il/types.js';
import { AsmModuleBuilder } from '../asm-il/builder/index.js';
import { createAcmeEmitter } from '../asm-il/emitters/index.js';
import { LabelGenerator } from './label-generator.js';
import { SourceMapper } from './source-mapper.js';
import { C64_CODE_START } from './types.js';

/**
 * Abstract base class for code generation
 *
 * Provides core infrastructure used by all code generation phases:
 * - AsmModuleBuilder for structured ASM-IL output
 * - Label management via LabelGenerator
 * - Source mapping for debugging via SourceMapper
 * - Warning collection and statistics tracking
 *
 * **ASM-IL Architecture:**
 * The generator produces an AsmModule via the builder, which is then
 * emitted to text via AcmeEmitter. All code generation flows through
 * the ASM-IL layer - there is no direct text emission.
 *
 * This class cannot be instantiated directly - use the concrete CodeGenerator class.
 */
export abstract class BaseCodeGenerator {
  // ============================================
  // ASM-IL BUILDER
  // ============================================

  /**
   * ASM-IL module builder
   *
   * Primary output mechanism for code generation.
   * Produces structured AsmModule that can be optimized and emitted.
   */
  protected asmBuilder: AsmModuleBuilder;

  // ============================================
  // HELPER CLASS INSTANCES
  // ============================================

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
  // VALUE TRACKING
  // ============================================

  /**
   * Tracks where each IL value is stored at runtime
   *
   * Maps IL value IDs (e.g., "v1", "v2") to their current storage locations.
   * This enables the code generator to emit correct operands for binary
   * operations instead of using placeholder values.
   *
   * The map is cleared at the start of each function and updated as
   * instructions are generated.
   */
  protected valueLocations: Map<string, TrackedValue> = new Map();

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
    // Reset ASM-IL builder
    this.asmBuilder.reset();

    // Reset helper systems
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

    // Reset value tracking
    this.valueLocations.clear();
  }

  // ============================================
  // VALUE TRACKING METHODS
  // ============================================

  /**
   * Resets value tracking for a new function
   *
   * Called at the start of each function to clear any stale value
   * location information from previous functions.
   */
  protected resetValueTracking(): void {
    this.valueLocations.clear();
  }

  /**
   * Tracks where an IL value is stored after an instruction
   *
   * This must be called after generating instructions that produce
   * values (CONST, LOAD_VAR, binary operations, etc.) so that
   * subsequent instructions can locate the operands.
   *
   * @param ilValueId - The IL value identifier (e.g., "v1", "v5:i.2")
   * @param location - Where the value is now stored
   *
   * @example
   * ```typescript
   * // After generating LDA #$42 for CONST instruction
   * this.trackValue('v1', {
   *   location: ValueLocation.IMMEDIATE,
   *   value: 0x42
   * });
   *
   * // After storing to zero page
   * this.trackValue('v2', {
   *   location: ValueLocation.ZERO_PAGE,
   *   address: 0x50
   * });
   * ```
   */
  protected trackValue(ilValueId: string, location: TrackedValue): void {
    // Normalize the value ID - strip SSA version suffixes for simpler lookup
    const normalizedId = this.normalizeValueId(ilValueId);
    this.valueLocations.set(normalizedId, { ...location, ilValueId: normalizedId });
  }

  /**
   * Gets the tracked location of an IL value
   *
   * Returns undefined if the value is not tracked (e.g., hasn't been
   * generated yet or was invalidated).
   *
   * @param ilValueId - The IL value identifier
   * @returns The tracked value location, or undefined if not found
   */
  protected getValueLocation(ilValueId: string): TrackedValue | undefined {
    const normalizedId = this.normalizeValueId(ilValueId);
    return this.valueLocations.get(normalizedId);
  }

  /**
   * Normalizes an IL value ID for tracking lookup
   *
   * IL values may have SSA version suffixes like "v5:i.2" or simple
   * forms like "v1". This normalizes them for consistent lookup.
   *
   * @param ilValueId - The IL value identifier
   * @returns Normalized identifier
   */
  protected normalizeValueId(ilValueId: string): string {
    // Keep the full ID including SSA suffixes for precise tracking
    // This allows distinguishing between v5:i.0 and v5:i.1
    return ilValueId.toString();
  }

  /**
   * Emits code to load a tracked IL value into the accumulator
   *
   * This is the core method for operand resolution. It looks up where
   * the value is stored and emits the appropriate LDA instruction.
   *
   * @param ilValueId - The IL value to load
   * @returns true if the value was loaded, false if not tracked
   *
   * @example
   * ```typescript
   * // Before ADC instruction, ensure left operand is in A
   * if (!this.loadValueToA('v1')) {
   *   this.addWarning('Cannot load v1 - not tracked');
   *   this.emitLdaImmediate(0, 'STUB: v1 not tracked');
   * }
   * ```
   */
  protected loadValueToA(ilValueId: string): boolean {
    const loc = this.getValueLocation(ilValueId);

    if (!loc) {
      this.addWarning(`Unknown value location: ${ilValueId}`);
      return false;
    }

    switch (loc.location) {
      case ValueLocation.ACCUMULATOR:
        // Already in A, nothing to do
        this.emitComment(`${ilValueId} already in A`);
        break;

      case ValueLocation.IMMEDIATE:
        this.emitLdaImmediate(loc.value ?? 0, `Load ${ilValueId}`);
        break;

      case ValueLocation.ZERO_PAGE:
        this.emitLdaZeroPage(loc.address ?? 0, `Load ${ilValueId}`);
        break;

      case ValueLocation.ABSOLUTE:
        this.emitLdaAbsolute(loc.address ?? 0, `Load ${ilValueId}`);
        break;

      case ValueLocation.LABEL:
        this.emitInstruction('LDA', loc.label ?? '_unknown', `Load ${ilValueId}`, 3);
        break;

      case ValueLocation.X_REGISTER:
        this.emitInstruction('TXA', undefined, `Transfer ${ilValueId} from X`, 1);
        break;

      case ValueLocation.Y_REGISTER:
        this.emitInstruction('TYA', undefined, `Transfer ${ilValueId} from Y`, 1);
        break;

      case ValueLocation.STACK:
        // Stack access is more complex - would need PLA
        this.emitInstruction('PLA', undefined, `Pop ${ilValueId} from stack`, 1);
        break;

      default:
        this.addWarning(`Unsupported value location for ${ilValueId}: ${loc.location}`);
        return false;
    }

    return true;
  }

  /**
   * Emits code to load a tracked IL value into the X register
   *
   * @param ilValueId - The IL value to load
   * @returns true if the value was loaded, false if not tracked
   */
  protected loadValueToX(ilValueId: string): boolean {
    const loc = this.getValueLocation(ilValueId);

    if (!loc) {
      this.addWarning(`Unknown value location: ${ilValueId}`);
      return false;
    }

    switch (loc.location) {
      case ValueLocation.X_REGISTER:
        // Already in X, nothing to do
        this.emitComment(`${ilValueId} already in X`);
        break;

      case ValueLocation.IMMEDIATE:
        this.emitInstruction('LDX', this.formatImmediate(loc.value ?? 0), `Load ${ilValueId} to X`, 2);
        break;

      case ValueLocation.ZERO_PAGE:
        this.emitInstruction('LDX', this.formatZeroPage(loc.address ?? 0), `Load ${ilValueId} to X`, 2);
        break;

      case ValueLocation.ABSOLUTE:
        this.emitInstruction('LDX', this.formatAbsolute(loc.address ?? 0), `Load ${ilValueId} to X`, 3);
        break;

      case ValueLocation.LABEL:
        this.emitInstruction('LDX', loc.label ?? '_unknown', `Load ${ilValueId} to X`, 3);
        break;

      case ValueLocation.ACCUMULATOR:
        this.emitInstruction('TAX', undefined, `Transfer ${ilValueId} from A to X`, 1);
        break;

      case ValueLocation.Y_REGISTER:
        // Y to X requires going through A
        this.emitInstruction('TYA', undefined, `Transfer ${ilValueId} Y→A`, 1);
        this.emitInstruction('TAX', undefined, `Transfer ${ilValueId} A→X`, 1);
        break;

      default:
        this.addWarning(`Unsupported value location for X: ${ilValueId}: ${loc.location}`);
        return false;
    }

    return true;
  }

  /**
   * Emits code to load a tracked IL value into the Y register
   *
   * @param ilValueId - The IL value to load
   * @returns true if the value was loaded, false if not tracked
   */
  protected loadValueToY(ilValueId: string): boolean {
    const loc = this.getValueLocation(ilValueId);

    if (!loc) {
      this.addWarning(`Unknown value location: ${ilValueId}`);
      return false;
    }

    switch (loc.location) {
      case ValueLocation.Y_REGISTER:
        // Already in Y, nothing to do
        this.emitComment(`${ilValueId} already in Y`);
        break;

      case ValueLocation.IMMEDIATE:
        this.emitInstruction('LDY', this.formatImmediate(loc.value ?? 0), `Load ${ilValueId} to Y`, 2);
        break;

      case ValueLocation.ZERO_PAGE:
        this.emitInstruction('LDY', this.formatZeroPage(loc.address ?? 0), `Load ${ilValueId} to Y`, 2);
        break;

      case ValueLocation.ABSOLUTE:
        this.emitInstruction('LDY', this.formatAbsolute(loc.address ?? 0), `Load ${ilValueId} to Y`, 3);
        break;

      case ValueLocation.LABEL:
        this.emitInstruction('LDY', loc.label ?? '_unknown', `Load ${ilValueId} to Y`, 3);
        break;

      case ValueLocation.ACCUMULATOR:
        this.emitInstruction('TAY', undefined, `Transfer ${ilValueId} from A to Y`, 1);
        break;

      case ValueLocation.X_REGISTER:
        // X to Y requires going through A
        this.emitInstruction('TXA', undefined, `Transfer ${ilValueId} X→A`, 1);
        this.emitInstruction('TAY', undefined, `Transfer ${ilValueId} A→Y`, 1);
        break;

      default:
        this.addWarning(`Unsupported value location for Y: ${ilValueId}: ${loc.location}`);
        return false;
    }

    return true;
  }

  /**
   * Formats an operand string based on a tracked value's location
   *
   * Returns the appropriate operand format for use in instructions
   * like ADC, SBC, CMP, AND, ORA, EOR.
   *
   * @param ilValueId - The IL value to format as operand
   * @returns Formatted operand string (e.g., "#$05", "$50", "_label")
   */
  protected formatOperand(ilValueId: string): string {
    const loc = this.getValueLocation(ilValueId);

    if (!loc) {
      // Fallback for untracked values
      this.addWarning(`formatOperand: Unknown value ${ilValueId}`);
      return '#$00';
    }

    switch (loc.location) {
      case ValueLocation.IMMEDIATE:
        return this.formatImmediate(loc.value ?? 0);

      case ValueLocation.ZERO_PAGE:
        return this.formatZeroPage(loc.address ?? 0);

      case ValueLocation.ABSOLUTE:
        return this.formatAbsolute(loc.address ?? 0);

      case ValueLocation.LABEL:
        return loc.label ?? '_unknown';

      case ValueLocation.ACCUMULATOR:
      case ValueLocation.X_REGISTER:
      case ValueLocation.Y_REGISTER:
        // Value is in a register - need to save to temp first
        // This is a complex case that should be handled by the caller
        this.addWarning(`formatOperand: Value ${ilValueId} is in register, cannot use as operand directly`);
        return '#$00';

      default:
        return '#$00';
    }
  }

  /**
   * Checks if a value is currently in the accumulator
   *
   * Useful for avoiding redundant loads.
   *
   * @param ilValueId - The IL value to check
   * @returns true if the value is in A
   */
  protected isValueInA(ilValueId: string): boolean {
    const loc = this.getValueLocation(ilValueId);
    return loc?.location === ValueLocation.ACCUMULATOR;
  }

  /**
   * Invalidates all register-based value locations
   *
   * Called when registers are clobbered by an instruction
   * (e.g., after a JSR that doesn't preserve registers).
   */
  protected invalidateRegisters(): void {
    for (const [key, value] of this.valueLocations.entries()) {
      if (
        value.location === ValueLocation.ACCUMULATOR ||
        value.location === ValueLocation.X_REGISTER ||
        value.location === ValueLocation.Y_REGISTER
      ) {
        this.valueLocations.delete(key);
      }
    }
  }

  /**
   * Invalidates the accumulator location tracking
   *
   * Called when A is modified by an operation that overwrites
   * its previous value.
   */
  protected invalidateAccumulator(): void {
    for (const [key, value] of this.valueLocations.entries()) {
      if (value.location === ValueLocation.ACCUMULATOR) {
        this.valueLocations.delete(key);
      }
    }
  }

  // ============================================
  // ASM-IL GENERATION HELPERS
  // ============================================

  /**
   * Starts a new ASM-IL generation session
   *
   * Configures the builder with module name and origin address.
   * Call this at the beginning of code generation.
   *
   * @param moduleName - Name of the module being generated
   * @param origin - Load address (origin) for the module
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
   * Sets the current source location for subsequent ASM-IL items
   *
   * All ASM-IL items emitted after calling this will have the source
   * location attached for debugging and source maps.
   *
   * @param source - Source location to set, or undefined to clear
   */
  protected setCurrentSourceLocation(source?: SourceLocation): void {
    if (source) {
      this.asmBuilder.setLocation(source);
    } else {
      this.asmBuilder.clearLocation();
    }
  }

  /**
   * Emits a source location comment if debug mode is enabled
   *
   * Adds the source location as a comment in the ASM-IL output
   * for debugging purposes.
   *
   * @param source - Source location
   * @param description - Optional description
   */
  protected emitSourceComment(source?: SourceLocation, description?: string): void {
    if (!source) return;
    if (this.options.debug === 'none') return;

    if (this.options.debug === 'inline' || this.options.debug === 'both') {
      const comment = description
        ? this.sourceMapper.formatInlineCommentWithDesc(source, description)
        : this.sourceMapper.formatInlineComment(source);
      this.asmBuilder.comment(comment);
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
    this.asmBuilder.blank();
    this.asmBuilder.section(title);
  }

  /**
   * Emits a simple comment line
   *
   * @param text - Comment text
   */
  protected emitComment(text: string): void {
    this.asmBuilder.comment(text);
  }

  // ============================================
  // INSTRUCTION EMISSION HELPERS
  // ============================================

  /**
   * Emits a single instruction via ASM-IL raw emission
   *
   * This is a low-level method used for instructions that don't have
   * dedicated builder methods. Prefer specific instruction helpers
   * (emitLdaImmediate, etc.) when available.
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
    // Format the instruction as raw text for ASM-IL
    let text = `        ${mnemonic}`;
    if (operand) {
      text += ` ${operand}`;
    }
    if (comment) {
      text += `  ; ${comment}`;
    }
    this.asmBuilder.raw(text);

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
    this.asmBuilder.ldaImm(value, comment);
    this.addCodeBytes(2);
  }

  /**
   * Emits LDA absolute instruction
   *
   * @param address - Memory address to load from
   * @param comment - Optional comment
   */
  protected emitLdaAbsolute(address: number, comment?: string): void {
    this.asmBuilder.ldaAbs(address, comment);
    this.addCodeBytes(3);
  }

  /**
   * Emits LDA zero-page instruction
   *
   * @param address - Zero-page address to load from
   * @param comment - Optional comment
   */
  protected emitLdaZeroPage(address: number, comment?: string): void {
    this.asmBuilder.ldaZp(address, comment);
    this.addCodeBytes(2);
  }

  /**
   * Emits STA absolute instruction
   *
   * @param address - Memory address to store to
   * @param comment - Optional comment
   */
  protected emitStaAbsolute(address: number, comment?: string): void {
    this.asmBuilder.staAbs(address, comment);
    this.addCodeBytes(3);
  }

  /**
   * Emits STA zero-page instruction
   *
   * @param address - Zero-page address to store to
   * @param comment - Optional comment
   */
  protected emitStaZeroPage(address: number, comment?: string): void {
    this.asmBuilder.staZp(address, comment);
    this.addCodeBytes(2);
  }

  /**
   * Emits JMP instruction
   *
   * @param label - Label to jump to
   * @param comment - Optional comment
   */
  protected emitJmp(label: string, comment?: string): void {
    this.asmBuilder.jmp(label, comment);
    this.addCodeBytes(3);
  }

  /**
   * Emits JSR instruction
   *
   * @param label - Label to call
   * @param comment - Optional comment
   */
  protected emitJsr(label: string, comment?: string): void {
    this.asmBuilder.jsr(label, comment);
    this.addCodeBytes(3);
  }

  /**
   * Emits RTS instruction
   *
   * @param comment - Optional comment
   */
  protected emitRts(comment?: string): void {
    this.asmBuilder.rts(comment);
    this.addCodeBytes(1);
  }

  /**
   * Emits NOP instruction
   *
   * @param comment - Optional comment
   */
  protected emitNop(comment?: string): void {
    this.asmBuilder.nop(comment);
    this.addCodeBytes(1);
  }

  // ============================================
  // LABEL HELPERS
  // ============================================

  /**
   * Emits a label definition
   *
   * @param name - Label name
   * @param labelType - Optional label type (default: 'block')
   * @param comment - Optional comment for the label
   */
  protected emitLabel(
    name: string,
    labelType?: 'function' | 'global' | 'block' | 'data' | 'temp',
    comment?: string
  ): void {
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
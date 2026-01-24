/**
 * Assembly Writer
 *
 * Generates ACME-compatible 6502 assembly text.
 * Provides methods for emitting instructions, labels,
 * data, and comments with proper formatting.
 *
 * **Features:**
 * - ACME assembler syntax
 * - Proper indentation for readability
 * - Section organization (header, code, data)
 * - Source location comments for debugging
 * - Byte/word/text data directives
 *
 * @module codegen/assembly-writer
 */

import type { SourceLocation } from '../ast/base.js';

/**
 * Section types for organizing assembly output
 */
export type AssemblySection = 'header' | 'config' | 'basic' | 'code' | 'data' | 'footer';

/**
 * Assembly Writer
 *
 * Generates ACME-compatible 6502 assembly text with proper
 * formatting and organization.
 *
 * **Usage Pattern:**
 * 1. Create writer
 * 2. Emit header and configuration
 * 3. Emit code and data sections
 * 4. Get final assembly text with toString()
 *
 * @example
 * ```typescript
 * const writer = new AssemblyWriter();
 *
 * writer.emitHeader('main.blend', 'c64');
 * writer.emitOrigin(0x0801);
 * writer.emitLabel('main');
 * writer.emitInstruction('LDA', '#$00');
 * writer.emitInstruction('STA', '$D020');
 * writer.emitInstruction('RTS');
 *
 * const asm = writer.toString();
 * ```
 */
export class AssemblyWriter {
  /**
   * Lines of generated assembly
   */
  protected lines: string[] = [];

  /**
   * Current indentation level
   */
  protected indentLevel: number = 0;

  /**
   * Characters per indentation level
   */
  protected readonly indentSize: number = 2;

  /**
   * Current section being written
   */
  protected currentSection: AssemblySection = 'header';

  /**
   * Whether to include source location comments
   */
  protected includeSourceComments: boolean = false;

  /**
   * Current address (for tracking)
   */
  protected currentAddress: number = 0;

  /**
   * Creates a new assembly writer
   *
   * @param includeSourceComments - Include source location comments
   */
  constructor(includeSourceComments: boolean = false) {
    this.includeSourceComments = includeSourceComments;
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  /**
   * Reset the writer to initial state
   *
   * Clears all generated content and resets state.
   * Call this before generating a new assembly file.
   */
  public reset(): void {
    this.lines = [];
    this.indentLevel = 0;
    this.currentSection = 'header';
    this.currentAddress = 0;
  }

  /**
   * Set whether to include source location comments
   *
   * @param include - True to include source comments
   */
  public setIncludeSourceComments(include: boolean): void {
    this.includeSourceComments = include;
  }

  /**
   * Get current tracked address
   *
   * @returns Current address
   */
  public getCurrentAddress(): number {
    return this.currentAddress;
  }

  // ===========================================================================
  // Header and Configuration
  // ===========================================================================

  /**
   * Emit file header comments
   *
   * Writes standard header with module name, timestamp, and target.
   *
   * @param moduleName - Source module name
   * @param target - Target architecture name
   */
  public emitHeader(moduleName: string, target: string): void {
    this.currentSection = 'header';
    const timestamp = new Date().toISOString();

    this.emitRaw('; ===========================================================================');
    this.emitRaw('; Blend65 Compiler Output');
    this.emitRaw(`; Module: ${moduleName}`);
    this.emitRaw(`; Generated: ${timestamp}`);
    this.emitRaw(`; Target: ${target}`);
    this.emitRaw('; ===========================================================================');
    this.emitBlankLine();
  }

  /**
   * Emit origin directive
   *
   * Sets the assembly origin address using ACME's * = syntax.
   *
   * @param address - Origin address (e.g., 0x0801)
   */
  public emitOrigin(address: number): void {
    this.currentAddress = address;
    this.emitRaw(`* = $${this.formatHex(address, 4)}`);
  }

  // ===========================================================================
  // Section Organization
  // ===========================================================================

  /**
   * Start a new section with a header comment
   *
   * @param name - Section name
   * @param description - Optional description
   */
  public emitSectionHeader(name: string, description?: string): void {
    this.emitBlankLine();
    this.emitRaw('; ---------------------------------------------------------------------------');
    this.emitRaw(`; ${name}`);
    if (description) {
      this.emitRaw(`; ${description}`);
    }
    this.emitRaw('; ---------------------------------------------------------------------------');
  }

  /**
   * Set current section
   *
   * @param section - Section type
   */
  public setSection(section: AssemblySection): void {
    this.currentSection = section;
  }

  // ===========================================================================
  // Labels
  // ===========================================================================

  /**
   * Emit a label definition
   *
   * Labels are emitted without indentation and end with a colon.
   *
   * @param name - Label name
   */
  public emitLabel(name: string): void {
    this.emitRaw(`${name}:`);
  }

  /**
   * Emit a local label definition
   *
   * Local labels start with a dot (ACME syntax).
   *
   * @param name - Label name (without leading dot)
   */
  public emitLocalLabel(name: string): void {
    this.emitRaw(`.${name}:`);
  }

  // ===========================================================================
  // Instructions
  // ===========================================================================

  /**
   * Emit a 6502 instruction
   *
   * Formats instruction with proper indentation.
   *
   * @param mnemonic - Instruction mnemonic (e.g., 'LDA', 'STA')
   * @param operand - Optional operand (e.g., '#$00', '$D020')
   * @param comment - Optional inline comment
   */
  public emitInstruction(mnemonic: string, operand?: string, comment?: string): void {
    let line = `  ${mnemonic.toUpperCase()}`;
    if (operand !== undefined) {
      line += ` ${operand}`;
    }
    if (comment) {
      // Pad to align comments
      line = line.padEnd(30);
      line += `; ${comment}`;
    }
    this.emitRaw(line);
  }

  /**
   * Emit instruction with source location comment
   *
   * If source comments are enabled, adds a comment line before
   * the instruction showing the original source location.
   *
   * @param mnemonic - Instruction mnemonic
   * @param operand - Optional operand
   * @param source - Optional source location
   * @param comment - Optional inline comment
   */
  public emitInstructionWithSource(
    mnemonic: string,
    operand?: string,
    source?: SourceLocation,
    comment?: string,
  ): void {
    if (this.includeSourceComments && source) {
      this.emitSourceComment(source);
    }
    this.emitInstruction(mnemonic, operand, comment);
  }

  // ===========================================================================
  // Data Directives
  // ===========================================================================

  /**
   * Emit byte data
   *
   * Uses ACME's !byte directive.
   *
   * @param values - Byte values (numbers or hex strings)
   * @param comment - Optional inline comment
   */
  public emitBytes(values: (number | string)[], comment?: string): void {
    const formatted = values.map((v) => (typeof v === 'number' ? `$${this.formatHex(v, 2)}` : v));
    let line = `  !byte ${formatted.join(', ')}`;
    if (comment) {
      line = line.padEnd(30);
      line += `; ${comment}`;
    }
    this.emitRaw(line);
  }

  /**
   * Emit word data (16-bit little-endian)
   *
   * Uses ACME's !word directive.
   *
   * @param values - Word values (numbers or hex strings)
   * @param comment - Optional inline comment
   */
  public emitWords(values: (number | string)[], comment?: string): void {
    const formatted = values.map((v) => (typeof v === 'number' ? `$${this.formatHex(v, 4)}` : v));
    let line = `  !word ${formatted.join(', ')}`;
    if (comment) {
      line = line.padEnd(30);
      line += `; ${comment}`;
    }
    this.emitRaw(line);
  }

  /**
   * Emit text data
   *
   * Uses ACME's !text directive.
   *
   * @param text - Text string (will be quoted)
   * @param nullTerminate - Add null terminator
   * @param comment - Optional inline comment
   */
  public emitText(text: string, nullTerminate: boolean = false, comment?: string): void {
    let line = `  !text "${this.escapeString(text)}"`;
    if (nullTerminate) {
      line += ', $00';
    }
    if (comment) {
      line = line.padEnd(30);
      line += `; ${comment}`;
    }
    this.emitRaw(line);
  }

  /**
   * Emit fill directive
   *
   * Uses ACME's !fill directive to fill memory with a value.
   *
   * @param count - Number of bytes to fill
   * @param value - Value to fill with (default 0)
   * @param comment - Optional inline comment
   */
  public emitFill(count: number, value: number = 0, comment?: string): void {
    let line = `  !fill ${count}, $${this.formatHex(value, 2)}`;
    if (comment) {
      line = line.padEnd(30);
      line += `; ${comment}`;
    }
    this.emitRaw(line);
  }

  // ===========================================================================
  // Comments
  // ===========================================================================

  /**
   * Emit a comment line
   *
   * @param text - Comment text
   */
  public emitComment(text: string): void {
    this.emitRaw(`  ; ${text}`);
  }

  /**
   * Emit a source location comment
   *
   * Formats: FILE:filename LINE:n COL:n
   *
   * @param source - Source location
   */
  public emitSourceComment(source: SourceLocation): void {
    // Note: We assume source.start exists as per the interface
    if (source.start) {
      this.emitRaw(`; FILE:${source.start.line} COL:${source.start.column}`);
    }
  }

  /**
   * Emit a source file/line comment in VICE-friendly format
   *
   * @param filename - Source filename
   * @param line - Line number
   * @param column - Column number
   */
  public emitSourceLocationComment(filename: string, line: number, column: number): void {
    this.emitRaw(`; FILE:${filename} LINE:${line} COL:${column}`);
  }

  // ===========================================================================
  // Blank Lines and Raw Output
  // ===========================================================================

  /**
   * Emit a blank line
   */
  public emitBlankLine(): void {
    this.lines.push('');
  }

  /**
   * Emit raw assembly text (no formatting)
   *
   * @param text - Raw text to emit
   */
  public emitRaw(text: string): void {
    this.lines.push(text);
  }

  /**
   * Emit multiple raw lines
   *
   * @param lines - Array of raw lines
   */
  public emitRawLines(lines: string[]): void {
    for (const line of lines) {
      this.emitRaw(line);
    }
  }

  // ===========================================================================
  // Output
  // ===========================================================================

  /**
   * Get the complete assembly text
   *
   * @returns Complete assembly source as a string
   */
  public toString(): string {
    return this.lines.join('\n');
  }

  /**
   * Get the current line count
   *
   * @returns Number of lines
   */
  public getLineCount(): number {
    return this.lines.length;
  }

  // ===========================================================================
  // Formatting Helpers
  // ===========================================================================

  /**
   * Format a number as hexadecimal
   *
   * @param value - Number to format
   * @param digits - Minimum digits (padded with zeros)
   * @returns Hex string without $ prefix
   */
  protected formatHex(value: number, digits: number): string {
    return value.toString(16).toUpperCase().padStart(digits, '0');
  }

  /**
   * Escape a string for assembly output
   *
   * Handles special characters that need escaping.
   *
   * @param text - Text to escape
   * @returns Escaped text
   */
  protected escapeString(text: string): string {
    // ACME uses backslash escaping for special characters
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Get current indentation string
   *
   * @returns Indentation spaces
   */
  protected getIndent(): string {
    return ' '.repeat(this.indentLevel * this.indentSize);
  }

  // ===========================================================================
  // Common Patterns
  // ===========================================================================

  /**
   * Emit a complete BASIC stub for autostart
   *
   * Generates a BASIC program: 10 SYS address
   *
   * @param sysAddress - Address for SYS command
   */
  public emitBasicStub(sysAddress: number): void {
    this.emitSectionHeader('BASIC Stub', `10 SYS ${sysAddress}`);

    // Convert address to ASCII digits
    const addressStr = sysAddress.toString();
    const addressBytes = Array.from(addressStr).map((c) => `$${c.charCodeAt(0).toString(16).toUpperCase()}`);

    this.emitBytes([0x0b, 0x08], 'Next line pointer (low, high)');
    this.emitBytes([0x0a, 0x00], 'Line number 10');
    this.emitBytes([0x9e], 'SYS token');
    this.emitBytes(addressBytes, `"${addressStr}" as ASCII`);
    this.emitBytes([0x00], 'End of line');
    this.emitBytes([0x00, 0x00], 'End of BASIC program');
  }

  /**
   * Emit a function prologue
   *
   * @param name - Function name
   * @param comment - Optional comment
   */
  public emitFunctionPrologue(name: string, comment?: string): void {
    this.emitBlankLine();
    if (comment) {
      this.emitRaw(`; ${comment}`);
    }
    this.emitLabel(name);
    this.emitComment('Function prologue');
  }

  /**
   * Emit a function epilogue
   */
  public emitFunctionEpilogue(): void {
    this.emitComment('Function epilogue');
    this.emitInstruction('RTS');
  }

  /**
   * Emit an infinite loop (common for main program end)
   *
   * @param labelName - Loop label name (default: '.loop')
   */
  public emitInfiniteLoop(labelName: string = '.loop'): void {
    this.emitLocalLabel(labelName.replace(/^\./, ''));
    this.emitInstruction('JMP', labelName, 'Infinite loop');
  }
}
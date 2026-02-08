/**
 * Source Mapper
 *
 * Tracks the mapping between generated assembly addresses and
 * original Blend65 source code locations. This enables:
 *
 * - **Inline Comments**: Assembly output includes source location comments
 * - **VICE Integration**: Label file for VICE debugger
 * - **Source Maps**: JSON source maps for IDE integration
 * - **Error Correlation**: Map runtime errors back to source
 *
 * **Debug Output Modes:**
 *
 * - `inline`: Comments in assembly showing FILE:LINE:COL
 * - `vice`: VICE monitor label file format
 * - `both`: Both inline comments and VICE labels
 *
 * @module codegen/source-mapper
 */

import type { SourceLocation } from '../ast/base.js';
import type { SourceMapEntry, DebugMode } from './types.js';

/**
 * Tracked mapping entry with additional metadata
 *
 * Internal representation with more detail than the public SourceMapEntry.
 */
interface TrackedEntry {
  /** Generated assembly address (if known) */
  address: number | null;

  /** Original source location */
  source: SourceLocation;

  /** Optional label at this location */
  label?: string;

  /** Description for inline comments */
  description?: string;

  /** Whether this is a function entry point */
  isFunction?: boolean;

  /** Source file path (if known) */
  filePath?: string;
}

/**
 * VICE label file entry format
 *
 * VICE uses format: `al C:address .label`
 * - `al` = add label
 * - `C:` = CPU memory (vs `D:` for drive)
 * - `address` = 4-digit hex address
 * - `.label` = label name (must start with .)
 */
interface ViceLabelEntry {
  address: number;
  label: string;
}

/**
 * Source Mapper for tracking assembly ↔ source mappings
 *
 * The SourceMapper tracks the relationship between generated assembly
 * code and original Blend65 source code. It supports multiple output
 * formats for debugging and IDE integration.
 *
 * **Usage Flow:**
 * 1. Create a SourceMapper instance
 * 2. Call track methods during code generation
 * 3. Call format methods to get debug output
 *
 * @example
 * ```typescript
 * const mapper = new SourceMapper();
 *
 * // During code generation
 * mapper.trackLocation(0x0810, functionDecl.getLocation(), '_main', 'function main()');
 * mapper.trackInstruction(0x0813, stmt.getLocation(), 'LDA #$05');
 *
 * // After generation
 * const inlineComment = mapper.formatInlineComment(stmt.getLocation());
 * const viceLabels = mapper.generateViceLabels();
 * ```
 */
export class SourceMapper {
  /** Tracked entries in order of addition */
  protected entries: TrackedEntry[] = [];

  /** VICE label entries */
  protected viceLabels: ViceLabelEntry[] = [];

  /** Current source file path for relative paths */
  protected currentFilePath: string | null = null;

  /** Address counter for sequential tracking */
  protected currentAddress: number = 0;

  /**
   * Creates a new SourceMapper
   *
   * @param options - Optional configuration
   */
  constructor(options?: { filePath?: string }) {
    this.currentFilePath = options?.filePath ?? null;
  }

  /**
   * Resets the mapper to initial state
   *
   * Call this between compilation units to clear tracking data.
   */
  public reset(): void {
    this.entries = [];
    this.viceLabels = [];
    this.currentAddress = 0;
  }

  /**
   * Sets the current source file path
   *
   * Used for generating relative paths in debug output.
   *
   * @param filePath - Absolute or relative path to source file
   */
  public setFilePath(filePath: string): void {
    this.currentFilePath = filePath;
  }

  /**
   * Gets the current source file path
   *
   * @returns Current file path or null if not set
   */
  public getFilePath(): string | null {
    return this.currentFilePath;
  }

  /**
   * Sets the current address for sequential tracking
   *
   * @param address - Current assembly address
   */
  public setCurrentAddress(address: number): void {
    this.currentAddress = address;
  }

  /**
   * Gets the current address
   *
   * @returns Current assembly address
   */
  public getCurrentAddress(): number {
    return this.currentAddress;
  }

  /**
   * Advances the current address
   *
   * @param bytes - Number of bytes to advance
   */
  public advanceAddress(bytes: number): void {
    this.currentAddress += bytes;
  }

  /**
   * Track a source location at a specific address
   *
   * Primary method for recording source ↔ assembly mappings.
   *
   * @param address - Assembly address (or null for current)
   * @param source - Source location in Blend65 code
   * @param label - Optional label name at this address
   * @param description - Optional description for inline comments
   *
   * @example
   * ```typescript
   * // Track a function entry
   * mapper.trackLocation(0x0810, funcDecl.getLocation(), '_main', 'function main(): void');
   *
   * // Track a statement (using current address)
   * mapper.trackLocation(null, stmt.getLocation(), undefined, 'borderColor = 5');
   * ```
   */
  public trackLocation(
    address: number | null,
    source: SourceLocation,
    label?: string,
    description?: string
  ): void {
    const entry: TrackedEntry = {
      address: address ?? this.currentAddress,
      source,
      label,
      description,
      filePath: this.currentFilePath ?? undefined,
    };

    this.entries.push(entry);

    // Also add to VICE labels if this entry has a label
    if (label && entry.address !== null) {
      this.addViceLabel(entry.address, label);
    }
  }

  /**
   * Track a function entry point
   *
   * Convenience method for tracking function declarations.
   * Marks the entry as a function for special handling.
   *
   * @param address - Assembly address of function entry
   * @param source - Source location of function declaration
   * @param name - Function name (used as label)
   * @param signature - Optional function signature for comments
   *
   * @example
   * ```typescript
   * mapper.trackFunction(0x0810, funcDecl.getLocation(), 'main', 'function main(): void');
   * ```
   */
  public trackFunction(
    address: number,
    source: SourceLocation,
    name: string,
    signature?: string
  ): void {
    const label = `_${name}`;
    const description = signature ?? `function ${name}`;

    const entry: TrackedEntry = {
      address,
      source,
      label,
      description,
      isFunction: true,
      filePath: this.currentFilePath ?? undefined,
    };

    this.entries.push(entry);
    this.addViceLabel(address, label);
  }

  /**
   * Track an instruction at the current address
   *
   * Convenience method for tracking individual instructions.
   *
   * @param source - Source location
   * @param instruction - Optional instruction description
   * @param size - Size of instruction in bytes (advances address)
   *
   * @example
   * ```typescript
   * mapper.trackInstruction(stmt.getLocation(), 'LDA #$05', 2);
   * ```
   */
  public trackInstruction(source: SourceLocation, instruction?: string, size?: number): void {
    this.trackLocation(this.currentAddress, source, undefined, instruction);

    if (size !== undefined) {
      this.advanceAddress(size);
    }
  }

  /**
   * Add a VICE label entry
   *
   * Adds a label for VICE debugger integration.
   *
   * @param address - Assembly address
   * @param label - Label name (will be prefixed with . if needed)
   */
  public addViceLabel(address: number, label: string): void {
    // VICE labels must start with a dot
    const viceName = label.startsWith('.') ? label : `.${label}`;

    this.viceLabels.push({
      address,
      label: viceName,
    });
  }

  /**
   * Get all tracked entries
   *
   * @returns Array of all tracked entries
   */
  public getEntries(): SourceMapEntry[] {
    return this.entries
      .filter((e) => e.address !== null)
      .map((e) => ({
        address: e.address!,
        source: e.source,
        label: e.label,
      }));
  }

  /**
   * Get entries for a specific address range
   *
   * @param startAddress - Start of range (inclusive)
   * @param endAddress - End of range (exclusive)
   * @returns Entries within the address range
   */
  public getEntriesInRange(startAddress: number, endAddress: number): SourceMapEntry[] {
    return this.entries
      .filter((e) => e.address !== null && e.address >= startAddress && e.address < endAddress)
      .map((e) => ({
        address: e.address!,
        source: e.source,
        label: e.label,
      }));
  }

  /**
   * Find entry for a specific address
   *
   * @param address - Assembly address to look up
   * @returns Entry at address or undefined
   */
  public findEntryAt(address: number): SourceMapEntry | undefined {
    const entry = this.entries.find((e) => e.address === address);
    if (!entry || entry.address === null) {
      return undefined;
    }

    return {
      address: entry.address,
      source: entry.source,
      label: entry.label,
    };
  }

  /**
   * Find the nearest entry for an address
   *
   * Finds the entry with the highest address <= the given address.
   * Useful for finding what source location a runtime address maps to.
   *
   * @param address - Assembly address
   * @returns Nearest entry or undefined
   */
  public findNearestEntry(address: number): SourceMapEntry | undefined {
    let nearest: TrackedEntry | undefined;
    let nearestDist = Infinity;

    for (const entry of this.entries) {
      if (entry.address === null) continue;
      if (entry.address > address) continue;

      const dist = address - entry.address;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entry;
      }
    }

    if (!nearest || nearest.address === null) {
      return undefined;
    }

    return {
      address: nearest.address,
      source: nearest.source,
      label: nearest.label,
    };
  }

  /**
   * Format an inline comment for a source location
   *
   * Generates a comment string for assembly output.
   *
   * Format: `; FILE:path LINE:n COL:n`
   *
   * @param source - Source location
   * @param filePath - Optional file path override
   * @returns Formatted comment string
   *
   * @example
   * ```typescript
   * const comment = mapper.formatInlineComment(stmt.getLocation());
   * // Returns: "; FILE:game.blend LINE:42 COL:5"
   * ```
   */
  public formatInlineComment(source: SourceLocation, filePath?: string): string {
    const file = filePath ?? this.currentFilePath ?? 'unknown';
    const line = source.start.line;
    const col = source.start.column;

    return `; FILE:${file} LINE:${line} COL:${col}`;
  }

  /**
   * Format an inline comment with description
   *
   * Generates a comment with both location and description.
   *
   * @param source - Source location
   * @param description - Description of what's being generated
   * @param filePath - Optional file path override
   * @returns Formatted comment string
   *
   * @example
   * ```typescript
   * const comment = mapper.formatInlineCommentWithDesc(
   *   stmt.getLocation(),
   *   'borderColor = 5'
   * );
   * // Returns: "; FILE:game.blend LINE:42 COL:5 - borderColor = 5"
   * ```
   */
  public formatInlineCommentWithDesc(
    source: SourceLocation,
    description: string,
    filePath?: string
  ): string {
    const base = this.formatInlineComment(source, filePath);
    return `${base} - ${description}`;
  }

  /**
   * Format a simple source location comment
   *
   * Generates a shorter comment format for less verbose output.
   *
   * Format: `; [line:col]`
   *
   * @param source - Source location
   * @returns Formatted comment string
   *
   * @example
   * ```typescript
   * const comment = mapper.formatShortComment(stmt.getLocation());
   * // Returns: "; [42:5]"
   * ```
   */
  public formatShortComment(source: SourceLocation): string {
    return `; [${source.start.line}:${source.start.column}]`;
  }

  /**
   * Generate VICE label file content
   *
   * Produces a label file compatible with VICE monitor.
   *
   * Format: `al C:XXXX .labelname`
   *
   * @returns VICE label file content as string
   *
   * @example
   * ```typescript
   * const labels = mapper.generateViceLabels();
   * // Returns:
   * // al C:0810 .main
   * // al C:0815 .loop
   * // al C:0820 .data
   * ```
   */
  public generateViceLabels(): string {
    const lines: string[] = [];

    // Header comment
    lines.push('; VICE monitor labels generated by Blend65 compiler');
    lines.push('; Load with: l "filename.labels"');
    lines.push('');

    // Sort by address
    const sorted = [...this.viceLabels].sort((a, b) => a.address - b.address);

    for (const entry of sorted) {
      const addr = entry.address.toString(16).toUpperCase().padStart(4, '0');
      lines.push(`al C:${addr} ${entry.label}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate VICE label entries for a label generator
   *
   * Creates VICE-compatible label entries from a LabelGenerator.
   *
   * @param labelEntries - Array of label entries from LabelGenerator
   *
   * @example
   * ```typescript
   * const labels = labelGen.getAllLabels();
   * mapper.importLabels(labels);
   * ```
   */
  public importLabels(
    labelEntries: Array<{ name: string; type: string; metadata?: { address?: number } }>
  ): void {
    for (const entry of labelEntries) {
      const address = entry.metadata?.address;
      if (address !== undefined) {
        this.addViceLabel(address, entry.name);
      }
    }
  }

  /**
   * Generate JSON source map
   *
   * Produces a JSON source map for IDE integration.
   * Format is similar to JavaScript source maps.
   *
   * @returns Source map as JSON string
   */
  public generateJsonSourceMap(): string {
    const sourceMap = {
      version: 1,
      file: this.currentFilePath ?? 'output.asm',
      sourceRoot: '',
      sources: [this.currentFilePath ?? 'input.blend'],
      mappings: this.entries
        .filter((e) => e.address !== null)
        .map((e) => ({
          generated: {
            address: e.address,
          },
          original: {
            line: e.source.start.line,
            column: e.source.start.column,
          },
          name: e.label,
        })),
    };

    return JSON.stringify(sourceMap, null, 2);
  }

  /**
   * Get statistics about tracked entries
   *
   * @returns Statistics object
   */
  public getStats(): {
    totalEntries: number;
    entriesWithLabels: number;
    entriesWithDescriptions: number;
    functionEntries: number;
    viceLabels: number;
    addressRange: { min: number; max: number } | null;
  } {
    const entriesWithLabels = this.entries.filter((e) => e.label !== undefined).length;
    const entriesWithDescriptions = this.entries.filter((e) => e.description !== undefined).length;
    const functionEntries = this.entries.filter((e) => e.isFunction === true).length;

    let addressRange: { min: number; max: number } | null = null;
    const addresses = this.entries.filter((e) => e.address !== null).map((e) => e.address!);

    if (addresses.length > 0) {
      addressRange = {
        min: Math.min(...addresses),
        max: Math.max(...addresses),
      };
    }

    return {
      totalEntries: this.entries.length,
      entriesWithLabels,
      entriesWithDescriptions,
      functionEntries,
      viceLabels: this.viceLabels.length,
      addressRange,
    };
  }

  /**
   * Check if debug mode requires inline comments
   *
   * @param mode - Debug mode setting
   * @returns true if inline comments should be generated
   */
  public static needsInlineComments(mode: DebugMode): boolean {
    return mode === 'inline' || mode === 'both';
  }

  /**
   * Check if debug mode requires VICE labels
   *
   * @param mode - Debug mode setting
   * @returns true if VICE labels should be generated
   */
  public static needsViceLabels(mode: DebugMode): boolean {
    return mode === 'vice' || mode === 'both';
  }
}
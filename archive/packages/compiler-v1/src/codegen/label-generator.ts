/**
 * Label Generator
 *
 * Generates unique, consistent labels for assembly output.
 * Handles function names, variable names, temporary labels,
 * and ensures no collisions in the generated assembly.
 *
 * **Label Conventions:**
 * - Function labels: `_functionName`
 * - Global variables: `_varName`
 * - Local labels: `.localName`
 * - Temp labels: `.L_nnnn` (incrementing counter)
 * - Block labels: `.block_nnnn`
 *
 * @module codegen/label-generator
 */

/**
 * Label type categories
 *
 * Used to organize and format labels appropriately
 * for their purpose.
 */
export type LabelType = 'function' | 'global' | 'local' | 'temp' | 'block' | 'data';

/**
 * Label entry in the registry
 *
 * Stores information about a generated label for
 * debugging and VICE integration.
 */
export interface LabelEntry {
  /**
   * The generated assembly label
   */
  label: string;

  /**
   * Original name from source code
   */
  originalName: string;

  /**
   * Type of label
   */
  type: LabelType;

  /**
   * Memory address (if known)
   */
  address?: number;

  /**
   * Source file (if available)
   */
  sourceFile?: string;

  /**
   * Source line (if available)
   */
  sourceLine?: number;
}

/**
 * Label Generator
 *
 * Generates unique, consistent labels for assembly output.
 * Tracks all generated labels for VICE label file generation
 * and collision detection.
 *
 * **Label Prefixes:**
 * - `_` for global labels (functions, global variables)
 * - `.` for local labels (within a function scope)
 * - `.L_` for temporary/generated labels
 * - `.block_` for basic block labels
 *
 * @example
 * ```typescript
 * const labels = new LabelGenerator();
 *
 * // Generate function label
 * const mainLabel = labels.functionLabel('main');
 * // Returns: '_main'
 *
 * // Generate temp label
 * const temp1 = labels.tempLabel();
 * // Returns: '.L_0001'
 *
 * // Generate block label
 * const block = labels.blockLabel('entry');
 * // Returns: '.block_entry'
 * ```
 */
export class LabelGenerator {
  /**
   * Counter for temporary labels
   */
  protected tempCounter: number = 0;

  /**
   * Counter for anonymous block labels
   */
  protected blockCounter: number = 0;

  /**
   * Registry of all generated labels
   */
  protected registry: Map<string, LabelEntry> = new Map();

  /**
   * Set of used label names (for collision detection)
   */
  protected usedNames: Set<string> = new Set();

  /**
   * Current function context (for local labels)
   */
  protected currentFunction: string | null = null;

  /**
   * Creates a new label generator
   */
  constructor() {}

  // ===========================================================================
  // State Management
  // ===========================================================================

  /**
   * Reset the generator to initial state
   *
   * Clears all generated labels and counters.
   * Call this before generating labels for a new file.
   */
  public reset(): void {
    this.tempCounter = 0;
    this.blockCounter = 0;
    this.registry.clear();
    this.usedNames.clear();
    this.currentFunction = null;
  }

  /**
   * Set the current function context
   *
   * Used for local label scoping and debugging info.
   *
   * @param name - Function name, or null to clear
   */
  public setCurrentFunction(name: string | null): void {
    this.currentFunction = name;
  }

  /**
   * Get the current function context
   *
   * @returns Current function name, or null
   */
  public getCurrentFunction(): string | null {
    return this.currentFunction;
  }

  // ===========================================================================
  // Label Generation
  // ===========================================================================

  /**
   * Generate a function label
   *
   * Function labels are prefixed with underscore for global scope.
   *
   * @param name - Function name from source
   * @param address - Optional memory address
   * @returns Assembly label (e.g., '_main')
   */
  public functionLabel(name: string, address?: number): string {
    const sanitized = this.sanitizeName(name);
    const baseLabel = `_${sanitized}`;
    const label = this.makeUnique(baseLabel);

    this.registerLabel(label, name, 'function', address);
    return label;
  }

  /**
   * Generate a global variable label
   *
   * Global variables are prefixed with underscore.
   *
   * @param name - Variable name from source
   * @param address - Optional memory address
   * @returns Assembly label (e.g., '_score')
   */
  public globalLabel(name: string, address?: number): string {
    const sanitized = this.sanitizeName(name);
    const label = `_${sanitized}`;

    this.registerLabel(label, name, 'global', address);
    return label;
  }

  /**
   * Generate a local label
   *
   * Local labels are prefixed with dot for function-local scope.
   *
   * @param name - Label name
   * @param address - Optional memory address
   * @returns Assembly label (e.g., '.loop')
   */
  public localLabel(name: string, address?: number): string {
    const sanitized = this.sanitizeName(name);
    const label = `.${sanitized}`;

    this.registerLabel(label, name, 'local', address);
    return label;
  }

  /**
   * Generate a unique temporary label
   *
   * Temp labels are auto-numbered for uniqueness.
   *
   * @param prefix - Optional prefix (default: 'L')
   * @param address - Optional memory address
   * @returns Assembly label (e.g., '.L_0001')
   */
  public tempLabel(prefix: string = 'L', address?: number): string {
    this.tempCounter++;
    const counter = this.tempCounter.toString().padStart(4, '0');
    const label = `.${prefix}_${counter}`;

    this.registerLabel(label, `temp_${this.tempCounter}`, 'temp', address);
    return label;
  }

  /**
   * Generate a basic block label
   *
   * Block labels use a consistent naming scheme for CFG blocks.
   *
   * @param name - Block name (e.g., 'entry', 'loop', 'exit')
   * @param address - Optional memory address
   * @returns Assembly label (e.g., '.block_entry')
   */
  public blockLabel(name: string, address?: number): string {
    const sanitized = this.sanitizeName(name);
    const label = `.block_${sanitized}`;

    this.registerLabel(label, name, 'block', address);
    return label;
  }

  /**
   * Generate an anonymous block label
   *
   * Auto-numbered for basic blocks without names.
   *
   * @param address - Optional memory address
   * @returns Assembly label (e.g., '.block_0001')
   */
  public anonymousBlockLabel(address?: number): string {
    this.blockCounter++;
    const counter = this.blockCounter.toString().padStart(4, '0');
    const label = `.block_${counter}`;

    this.registerLabel(label, `block_${this.blockCounter}`, 'block', address);
    return label;
  }

  /**
   * Generate a data section label
   *
   * Data labels are prefixed with underscore for global scope.
   *
   * @param name - Data label name
   * @param address - Optional memory address
   * @returns Assembly label (e.g., '_gameTitle')
   */
  public dataLabel(name: string, address?: number): string {
    const sanitized = this.sanitizeName(name);
    const label = `_${sanitized}`;

    this.registerLabel(label, name, 'data', address);
    return label;
  }

  // ===========================================================================
  // Label Lookup
  // ===========================================================================

  /**
   * Look up a label by its assembly name
   *
   * @param label - Assembly label
   * @returns Label entry, or undefined if not found
   */
  public lookupLabel(label: string): LabelEntry | undefined {
    return this.registry.get(label);
  }

  /**
   * Look up a label by original source name
   *
   * @param name - Original name from source
   * @param type - Optional type filter
   * @returns Label entry, or undefined if not found
   */
  public lookupByName(name: string, type?: LabelType): LabelEntry | undefined {
    for (const entry of this.registry.values()) {
      if (entry.originalName === name) {
        if (type === undefined || entry.type === type) {
          return entry;
        }
      }
    }
    return undefined;
  }

  /**
   * Check if a label name is already used
   *
   * @param label - Assembly label to check
   * @returns True if label is already used
   */
  public isUsed(label: string): boolean {
    return this.usedNames.has(label);
  }

  /**
   * Get all registered labels
   *
   * @returns Array of all label entries
   */
  public getAllLabels(): LabelEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * Get labels by type
   *
   * @param type - Label type to filter
   * @returns Array of matching label entries
   */
  public getLabelsByType(type: LabelType): LabelEntry[] {
    return this.getAllLabels().filter((entry) => entry.type === type);
  }

  /**
   * Get the total number of labels
   *
   * @returns Label count
   */
  public getLabelCount(): number {
    return this.registry.size;
  }

  // ===========================================================================
  // Address Updates
  // ===========================================================================

  /**
   * Update the address of an existing label
   *
   * Called after assembly when addresses are resolved.
   *
   * @param label - Assembly label
   * @param address - Memory address
   * @returns True if label was found and updated
   */
  public updateAddress(label: string, address: number): boolean {
    const entry = this.registry.get(label);
    if (entry) {
      // Create new entry with updated address (entries are readonly)
      this.registry.set(label, { ...entry, address });
      return true;
    }
    return false;
  }

  /**
   * Update source information for a label
   *
   * @param label - Assembly label
   * @param sourceFile - Source file path
   * @param sourceLine - Line number
   * @returns True if label was found and updated
   */
  public updateSourceInfo(label: string, sourceFile: string, sourceLine: number): boolean {
    const entry = this.registry.get(label);
    if (entry) {
      this.registry.set(label, { ...entry, sourceFile, sourceLine });
      return true;
    }
    return false;
  }

  // ===========================================================================
  // VICE Integration
  // ===========================================================================

  /**
   * Generate VICE monitor label file content
   *
   * Creates a label file that can be loaded into VICE
   * for debugging with symbolic names.
   *
   * Format: `al C:xxxx .labelname`
   *
   * @returns VICE label file content
   */
  public generateViceLabels(): string {
    const lines: string[] = [];
    lines.push('# VICE labels generated by Blend65 compiler');
    lines.push('#');

    // Sort by address for readability
    const sorted = this.getAllLabels()
      .filter((entry) => entry.address !== undefined)
      .sort((a, b) => (a.address ?? 0) - (b.address ?? 0));

    for (const entry of sorted) {
      if (entry.address !== undefined) {
        const addr = entry.address.toString(16).toUpperCase().padStart(4, '0');
        // VICE format: al C:XXXX .labelname
        lines.push(`al C:${addr} .${entry.label.replace(/^[._]/, '')}`);
      }
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // Internal Helpers
  // ===========================================================================

  /**
   * Register a label in the registry
   *
   * @param label - Assembly label
   * @param originalName - Original source name
   * @param type - Label type
   * @param address - Optional address
   */
  protected registerLabel(label: string, originalName: string, type: LabelType, address?: number): void {
    // Check for collision
    if (this.usedNames.has(label)) {
      // Make unique by adding counter
      let unique = label;
      let counter = 1;
      while (this.usedNames.has(unique)) {
        unique = `${label}_${counter}`;
        counter++;
      }
      // Use the unique version (but log warning)
      // In production, this would be a diagnostic
      label = unique;
    }

    this.usedNames.add(label);

    const entry: LabelEntry = {
      label,
      originalName,
      type,
      address,
    };

    // Add current function context for local labels
    if (type === 'local' && this.currentFunction) {
      entry.sourceFile = this.currentFunction;
    }

    this.registry.set(label, entry);
  }

  /**
   * Sanitize a name for use as an assembly label
   *
   * - Replaces invalid characters with underscore
   * - Ensures label starts with valid character
   * - Converts to lowercase
   *
   * @param name - Original name
   * @returns Sanitized name safe for assembly
   */
  protected sanitizeName(name: string): string {
    // Replace invalid characters with underscore
    // Valid: a-z, A-Z, 0-9, _
    let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');

    // Ensure doesn't start with number
    if (/^[0-9]/.test(sanitized)) {
      sanitized = '_' + sanitized;
    }

    // Handle empty result
    if (sanitized.length === 0) {
      sanitized = '_empty';
    }

    return sanitized;
  }

  /**
   * Generate a unique suffix if needed
   *
   * @param baseName - Base label name
   * @returns Unique suffix to append
   */
  protected getUniqueSuffix(baseName: string): string {
    let counter = 1;
    let candidate = baseName;

    while (this.usedNames.has(candidate)) {
      candidate = `${baseName}_${counter}`;
      counter++;
    }

    return candidate === baseName ? '' : `_${counter - 1}`;
  }

  /**
   * Make a label unique by adding suffix if needed
   *
   * Checks if the label is already used and appends a counter
   * suffix to make it unique.
   *
   * @param baseLabel - Base label to make unique
   * @returns Unique label (may be unchanged if not used)
   */
  protected makeUnique(baseLabel: string): string {
    if (!this.usedNames.has(baseLabel)) {
      return baseLabel;
    }

    let counter = 1;
    let candidate = `${baseLabel}_${counter}`;
    while (this.usedNames.has(candidate)) {
      counter++;
      candidate = `${baseLabel}_${counter}`;
    }
    return candidate;
  }
}
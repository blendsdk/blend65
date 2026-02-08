/**
 * IL Module - represents a compilation unit in the IL representation
 *
 * An IL module contains:
 * - All functions defined in the source file
 * - Global variables with storage class information
 * - Import and export declarations
 * - Module-level metadata
 *
 * @module il/module
 */

import { ILFunction, ILStorageClass } from './function.js';
import type { ILType } from './types.js';

/**
 * Global variable definition in the IL.
 *
 * Represents a module-level variable with storage class information.
 */
export interface ILGlobalVariable {
  /** Variable name */
  readonly name: string;

  /** Variable IL type */
  readonly type: ILType;

  /** Storage class (zeropage, ram, data, map) */
  readonly storageClass: ILStorageClass;

  /** Initial value (for constants/data section) */
  readonly initialValue?: number | number[];

  /** Fixed address (for @map variables) */
  readonly address?: number;

  /** Whether this variable is exported */
  readonly isExported: boolean;

  /** Whether this variable is constant (read-only) */
  readonly isConstant: boolean;
}

/**
 * Import declaration in the IL.
 *
 * Represents an imported symbol from another module.
 */
export interface ILImport {
  /** Local name (may be different if aliased) */
  readonly localName: string;

  /** Original name in the source module */
  readonly originalName: string;

  /** Source module path */
  readonly modulePath: string;

  /** Whether this is a type import (not used at runtime) */
  readonly isTypeOnly: boolean;
}

/**
 * Export declaration in the IL.
 *
 * Represents an exported symbol from this module.
 */
export interface ILExport {
  /** Exported name (may be different if aliased) */
  readonly exportedName: string;

  /** Local name in this module */
  readonly localName: string;

  /** What kind of symbol is being exported */
  readonly kind: 'function' | 'variable' | 'type';
}

/**
 * Module metadata and statistics.
 */
export interface ILModuleStats {
  /** Number of functions */
  functionCount: number;

  /** Number of global variables */
  globalCount: number;

  /** Number of imports */
  importCount: number;

  /** Number of exports */
  exportCount: number;

  /** Total instruction count across all functions */
  totalInstructions: number;

  /** Total register count across all functions */
  totalRegisters: number;

  /** Total block count across all functions */
  totalBlocks: number;
}

/**
 * Represents a module (compilation unit) in the IL representation.
 *
 * An ILModule is the top-level container for a single source file's IL.
 * It manages functions, global variables, and import/export declarations.
 *
 * @example
 * ```typescript
 * // Create a module
 * const module = new ILModule('main.bl65');
 *
 * // Add a function
 * const func = module.createFunction('init', [], IL_VOID);
 *
 * // Add a global variable
 * module.addGlobal({
 *   name: 'counter',
 *   type: IL_BYTE,
 *   storageClass: ILStorageClass.ZeroPage,
 *   isExported: false,
 *   isConstant: false,
 * });
 * ```
 */
export class ILModule {
  /** Functions in this module */
  protected readonly functions: Map<string, ILFunction> = new Map();

  /** Global variables in this module */
  protected readonly globals: Map<string, ILGlobalVariable> = new Map();

  /** Import declarations */
  protected readonly imports: Map<string, ILImport> = new Map();

  /** Export declarations */
  protected readonly exports: Map<string, ILExport> = new Map();

  /** Entry point function name (if this module has one) */
  protected entryPointName: string | null = null;

  /** Module-level metadata */
  protected readonly metadata: Map<string, unknown> = new Map();

  /**
   * Creates a new IL module.
   *
   * @param name - Module name (usually the source file path)
   */
  constructor(public readonly name: string) {}

  // ===========================================================================
  // Function Management
  // ===========================================================================

  /**
   * Creates a new function and adds it to the module.
   *
   * @param name - Function name
   * @param parameters - Function parameters
   * @param returnType - Return type
   * @returns The newly created function
   * @throws Error if a function with this name already exists
   */
  createFunction(
    name: string,
    parameters: { name: string; type: ILType }[],
    returnType: ILType,
  ): ILFunction {
    if (this.functions.has(name)) {
      throw new Error(`Function '${name}' already exists in module '${this.name}'`);
    }

    const func = new ILFunction(name, parameters, returnType);
    this.functions.set(name, func);
    return func;
  }

  /**
   * Adds an existing function to the module.
   *
   * @param func - The function to add
   * @throws Error if a function with this name already exists
   */
  addFunction(func: ILFunction): void {
    if (this.functions.has(func.name)) {
      throw new Error(`Function '${func.name}' already exists in module '${this.name}'`);
    }
    this.functions.set(func.name, func);
  }

  /**
   * Gets a function by name.
   *
   * @param name - Function name
   * @returns The function, or undefined if not found
   */
  getFunction(name: string): ILFunction | undefined {
    return this.functions.get(name);
  }

  /**
   * Gets all functions in this module.
   *
   * @returns Array of all functions
   */
  getFunctions(): ILFunction[] {
    return Array.from(this.functions.values());
  }

  /**
   * Gets all function names in this module.
   *
   * @returns Array of function names
   */
  getFunctionNames(): string[] {
    return Array.from(this.functions.keys());
  }

  /**
   * Checks if a function exists in this module.
   *
   * @param name - Function name
   * @returns true if function exists
   */
  hasFunction(name: string): boolean {
    return this.functions.has(name);
  }

  /**
   * Removes a function from the module.
   *
   * @param name - Function name
   * @returns true if the function was removed
   */
  removeFunction(name: string): boolean {
    return this.functions.delete(name);
  }

  /**
   * Gets the number of functions in this module.
   *
   * @returns Function count
   */
  getFunctionCount(): number {
    return this.functions.size;
  }

  // ===========================================================================
  // Global Variable Management
  // ===========================================================================

  /**
   * Adds a global variable to the module.
   *
   * @param global - Global variable definition
   * @throws Error if a global with this name already exists
   */
  addGlobal(global: ILGlobalVariable): void {
    if (this.globals.has(global.name)) {
      throw new Error(`Global '${global.name}' already exists in module '${this.name}'`);
    }
    this.globals.set(global.name, global);
  }

  /**
   * Creates and adds a global variable.
   *
   * @param name - Variable name
   * @param type - Variable type
   * @param storageClass - Storage class
   * @param options - Optional configuration
   * @returns The created global variable definition
   */
  createGlobal(
    name: string,
    type: ILType,
    storageClass: ILStorageClass,
    options: {
      initialValue?: number | number[];
      address?: number;
      isExported?: boolean;
      isConstant?: boolean;
    } = {},
  ): ILGlobalVariable {
    const global: ILGlobalVariable = {
      name,
      type,
      storageClass,
      initialValue: options.initialValue,
      address: options.address,
      isExported: options.isExported ?? false,
      isConstant: options.isConstant ?? false,
    };
    this.addGlobal(global);
    return global;
  }

  /**
   * Gets a global variable by name.
   *
   * @param name - Variable name
   * @returns The global variable, or undefined if not found
   */
  getGlobal(name: string): ILGlobalVariable | undefined {
    return this.globals.get(name);
  }

  /**
   * Gets all global variables in this module.
   *
   * @returns Array of all global variables
   */
  getGlobals(): ILGlobalVariable[] {
    return Array.from(this.globals.values());
  }

  /**
   * Gets global variables filtered by storage class.
   *
   * @param storageClass - Storage class to filter by
   * @returns Array of matching global variables
   */
  getGlobalsByStorageClass(storageClass: ILStorageClass): ILGlobalVariable[] {
    return this.getGlobals().filter((g) => g.storageClass === storageClass);
  }

  /**
   * Checks if a global variable exists.
   *
   * @param name - Variable name
   * @returns true if global exists
   */
  hasGlobal(name: string): boolean {
    return this.globals.has(name);
  }

  /**
   * Removes a global variable from the module.
   *
   * @param name - Variable name
   * @returns true if the global was removed
   */
  removeGlobal(name: string): boolean {
    return this.globals.delete(name);
  }

  /**
   * Gets the number of global variables.
   *
   * @returns Global count
   */
  getGlobalCount(): number {
    return this.globals.size;
  }

  // ===========================================================================
  // Import Management
  // ===========================================================================

  /**
   * Adds an import declaration.
   *
   * @param imp - Import declaration
   */
  addImport(imp: ILImport): void {
    this.imports.set(imp.localName, imp);
  }

  /**
   * Creates and adds an import declaration.
   *
   * @param localName - Local name for the import
   * @param originalName - Original name in source module
   * @param modulePath - Source module path
   * @param isTypeOnly - Whether this is a type-only import
   * @returns The created import declaration
   */
  createImport(
    localName: string,
    originalName: string,
    modulePath: string,
    isTypeOnly: boolean = false,
  ): ILImport {
    const imp: ILImport = {
      localName,
      originalName,
      modulePath,
      isTypeOnly,
    };
    this.addImport(imp);
    return imp;
  }

  /**
   * Gets an import by local name.
   *
   * @param localName - Local name of the import
   * @returns The import, or undefined if not found
   */
  getImport(localName: string): ILImport | undefined {
    return this.imports.get(localName);
  }

  /**
   * Gets all imports.
   *
   * @returns Array of all imports
   */
  getImports(): ILImport[] {
    return Array.from(this.imports.values());
  }

  /**
   * Gets imports from a specific module.
   *
   * @param modulePath - Module path to filter by
   * @returns Array of imports from that module
   */
  getImportsFromModule(modulePath: string): ILImport[] {
    return this.getImports().filter((i) => i.modulePath === modulePath);
  }

  /**
   * Gets the number of imports.
   *
   * @returns Import count
   */
  getImportCount(): number {
    return this.imports.size;
  }

  // ===========================================================================
  // Export Management
  // ===========================================================================

  /**
   * Adds an export declaration.
   *
   * @param exp - Export declaration
   */
  addExport(exp: ILExport): void {
    this.exports.set(exp.exportedName, exp);
  }

  /**
   * Creates and adds an export declaration.
   *
   * @param exportedName - Name to export as
   * @param localName - Local name in this module
   * @param kind - Kind of symbol being exported
   * @returns The created export declaration
   */
  createExport(
    exportedName: string,
    localName: string,
    kind: 'function' | 'variable' | 'type',
  ): ILExport {
    const exp: ILExport = {
      exportedName,
      localName,
      kind,
    };
    this.addExport(exp);
    return exp;
  }

  /**
   * Gets an export by exported name.
   *
   * @param exportedName - Exported name
   * @returns The export, or undefined if not found
   */
  getExport(exportedName: string): ILExport | undefined {
    return this.exports.get(exportedName);
  }

  /**
   * Gets all exports.
   *
   * @returns Array of all exports
   */
  getExports(): ILExport[] {
    return Array.from(this.exports.values());
  }

  /**
   * Gets exports filtered by kind.
   *
   * @param kind - Kind to filter by
   * @returns Array of matching exports
   */
  getExportsByKind(kind: 'function' | 'variable' | 'type'): ILExport[] {
    return this.getExports().filter((e) => e.kind === kind);
  }

  /**
   * Gets the number of exports.
   *
   * @returns Export count
   */
  getExportCount(): number {
    return this.exports.size;
  }

  // ===========================================================================
  // Entry Point Management
  // ===========================================================================

  /**
   * Sets the entry point function for this module.
   *
   * @param name - Name of the entry point function
   * @throws Error if the function doesn't exist
   */
  setEntryPoint(name: string): void {
    if (!this.functions.has(name)) {
      throw new Error(`Cannot set entry point: function '${name}' not found`);
    }
    this.entryPointName = name;
  }

  /**
   * Gets the entry point function name.
   *
   * @returns Entry point name, or null if not set
   */
  getEntryPointName(): string | null {
    return this.entryPointName;
  }

  /**
   * Gets the entry point function.
   *
   * @returns Entry point function, or undefined if not set
   */
  getEntryPoint(): ILFunction | undefined {
    return this.entryPointName ? this.functions.get(this.entryPointName) : undefined;
  }

  /**
   * Checks if this module has an entry point.
   *
   * @returns true if entry point is set
   */
  hasEntryPoint(): boolean {
    return this.entryPointName !== null;
  }

  // ===========================================================================
  // Metadata Management
  // ===========================================================================

  /**
   * Sets module-level metadata.
   *
   * @param key - Metadata key
   * @param value - Metadata value
   */
  setMetadata(key: string, value: unknown): void {
    this.metadata.set(key, value);
  }

  /**
   * Gets module-level metadata.
   *
   * @param key - Metadata key
   * @returns Metadata value, or undefined if not set
   */
  getMetadata<T>(key: string): T | undefined {
    return this.metadata.get(key) as T | undefined;
  }

  /**
   * Checks if metadata exists.
   *
   * @param key - Metadata key
   * @returns true if metadata exists
   */
  hasMetadata(key: string): boolean {
    return this.metadata.has(key);
  }

  // ===========================================================================
  // Analysis and Statistics
  // ===========================================================================

  /**
   * Gets statistics about this module.
   *
   * @returns Module statistics
   */
  getStats(): ILModuleStats {
    let totalInstructions = 0;
    let totalRegisters = 0;
    let totalBlocks = 0;

    for (const func of this.functions.values()) {
      totalInstructions += func.getInstructionCount();
      totalRegisters += func.getRegisterCount();
      totalBlocks += func.getBlockCount();
    }

    return {
      functionCount: this.functions.size,
      globalCount: this.globals.size,
      importCount: this.imports.size,
      exportCount: this.exports.size,
      totalInstructions,
      totalRegisters,
      totalBlocks,
    };
  }

  /**
   * Validates the entire module.
   *
   * @returns Array of error messages (empty if valid)
   */
  validate(): string[] {
    const errors: string[] = [];

    // Validate all functions
    for (const func of this.functions.values()) {
      const funcErrors = func.validateCFG();
      for (const error of funcErrors) {
        errors.push(`[${func.name}] ${error}`);
      }
    }

    // Check entry point if set
    if (this.entryPointName && !this.functions.has(this.entryPointName)) {
      errors.push(`Entry point function '${this.entryPointName}' not found`);
    }

    // Check exports reference existing symbols
    for (const exp of this.exports.values()) {
      if (exp.kind === 'function' && !this.functions.has(exp.localName)) {
        errors.push(`Export '${exp.exportedName}' references unknown function '${exp.localName}'`);
      }
      if (exp.kind === 'variable' && !this.globals.has(exp.localName)) {
        errors.push(`Export '${exp.exportedName}' references unknown global '${exp.localName}'`);
      }
    }

    return errors;
  }

  /**
   * Resolves a symbol name to its definition.
   *
   * Checks functions, globals, and imports in that order.
   *
   * @param name - Symbol name
   * @returns Object describing the symbol, or undefined if not found
   */
  resolveSymbol(name: string):
    | { kind: 'function'; value: ILFunction }
    | { kind: 'global'; value: ILGlobalVariable }
    | { kind: 'import'; value: ILImport }
    | undefined {
    const func = this.functions.get(name);
    if (func) {
      return { kind: 'function', value: func };
    }

    const global = this.globals.get(name);
    if (global) {
      return { kind: 'global', value: global };
    }

    const imp = this.imports.get(name);
    if (imp) {
      return { kind: 'import', value: imp };
    }

    return undefined;
  }

  // ===========================================================================
  // Debugging
  // ===========================================================================

  /**
   * Returns a string representation of this module.
   *
   * @returns Module name
   */
  toString(): string {
    return `module ${this.name}`;
  }

  /**
   * Returns a detailed string representation including all contents.
   *
   * @returns Multi-line module representation
   */
  toDetailedString(): string {
    const lines: string[] = [];
    lines.push(`; Module: ${this.name}`);
    lines.push('');

    // Imports
    if (this.imports.size > 0) {
      lines.push('; Imports');
      for (const imp of this.imports.values()) {
        const alias = imp.localName !== imp.originalName ? ` as ${imp.localName}` : '';
        const typeOnly = imp.isTypeOnly ? ' (type)' : '';
        lines.push(`import ${imp.originalName}${alias} from "${imp.modulePath}"${typeOnly}`);
      }
      lines.push('');
    }

    // Globals
    if (this.globals.size > 0) {
      lines.push('; Globals');
      for (const global of this.globals.values()) {
        const exported = global.isExported ? 'export ' : '';
        const constant = global.isConstant ? 'const ' : '';
        const address =
          global.address !== undefined ? ` @ $${global.address.toString(16).toUpperCase()}` : '';
        lines.push(
          `${exported}${constant}${global.name}: ${global.type.kind} [${global.storageClass}]${address}`,
        );
      }
      lines.push('');
    }

    // Functions
    for (const func of this.functions.values()) {
      lines.push(func.toDetailedString());
    }

    // Exports
    if (this.exports.size > 0) {
      lines.push('; Exports');
      for (const exp of this.exports.values()) {
        const alias = exp.exportedName !== exp.localName ? ` as ${exp.exportedName}` : '';
        lines.push(`export ${exp.localName}${alias} (${exp.kind})`);
      }
    }

    return lines.join('\n');
  }
}
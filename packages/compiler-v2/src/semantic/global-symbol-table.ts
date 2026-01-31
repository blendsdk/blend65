/**
 * Global Symbol Table for Blend65 Compiler v2
 *
 * Aggregates exports from all modules in a multi-module compilation.
 * Provides cross-module symbol lookup and tracks which module each
 * exported symbol comes from.
 *
 * Key responsibilities:
 * - Collect all exported symbols from all modules
 * - Provide cross-module symbol lookup by name
 * - Track which module each symbol originates from
 * - Support fully qualified lookups (module.symbol)
 * - Detect duplicate export names across modules
 *
 * @module semantic/global-symbol-table
 */

import type { SourceLocation, Program } from '../ast/index.js';
import { ExportDecl } from '../ast/index.js';
import { isExportDecl, isFunctionDecl, isVariableDecl } from '../ast/type-guards.js';
import type { ModuleRegistry } from './module-registry.js';
import type { TypeInfo } from './types.js';

/**
 * A globally visible symbol (exported from a module)
 *
 * Contains all information needed to reference a symbol across modules.
 */
export interface GlobalSymbol {
  /** Symbol name */
  name: string;

  /** Fully qualified name (module.symbol) */
  qualifiedName: string;

  /** Module that exports this symbol */
  moduleName: string;

  /** Symbol kind */
  kind: GlobalSymbolKind;

  /** Type information (resolved during type checking) */
  type: TypeInfo | null;

  /** Source location of the declaration */
  location: SourceLocation;

  /** Additional metadata */
  metadata?: Map<string, unknown>;
}

/**
 * Global symbol kinds
 *
 * Simplified set of kinds for globally exported symbols.
 */
export enum GlobalSymbolKind {
  /** Exported function */
  Function = 'function',

  /** Exported variable */
  Variable = 'variable',

  /** Exported constant */
  Constant = 'constant',
}

/**
 * Result of looking up a global symbol
 *
 * Contains the symbol and information about how it was found.
 */
export interface GlobalLookupResult {
  /** Whether the lookup was successful */
  found: boolean;

  /** The found symbol (if any) */
  symbol?: GlobalSymbol;

  /** If multiple symbols match, list all (for ambiguity detection) */
  ambiguous?: GlobalSymbol[];

  /** Error message (if lookup failed) */
  error?: string;
}

/**
 * Global Symbol Table - aggregates exports from all modules
 *
 * The GlobalSymbolTable provides a unified view of all exported symbols
 * across all modules in a compilation. It supports:
 *
 * 1. **Simple lookups**: Find a symbol by name (may be ambiguous)
 * 2. **Qualified lookups**: Find a symbol by module.name (unambiguous)
 * 3. **Module exports**: Get all exports from a specific module
 * 4. **Cross-module resolution**: Resolve imports to their actual symbols
 *
 * @example
 * ```typescript
 * const globalTable = new GlobalSymbolTable();
 *
 * // Collect exports from all modules
 * globalTable.collectFromRegistry(registry);
 *
 * // Look up by qualified name
 * const result = globalTable.lookupQualified('Game.Sprites', 'drawSprite');
 * if (result.found) {
 *   console.log('Found:', result.symbol.qualifiedName);
 * }
 *
 * // Look up by simple name (may be ambiguous)
 * const simpleResult = globalTable.lookup('drawSprite');
 * if (simpleResult.ambiguous) {
 *   console.error('Multiple modules export drawSprite');
 * }
 * ```
 */
export class GlobalSymbolTable {
  /**
   * All global symbols indexed by qualified name (module.symbol)
   */
  protected symbolsByQualifiedName: Map<string, GlobalSymbol> = new Map();

  /**
   * Symbols indexed by simple name (for quick lookup)
   * Value is an array because multiple modules may export same name
   */
  protected symbolsBySimpleName: Map<string, GlobalSymbol[]> = new Map();

  /**
   * All symbols grouped by module
   */
  protected symbolsByModule: Map<string, Map<string, GlobalSymbol>> = new Map();

  /**
   * Registers a global symbol
   *
   * Adds the symbol to all lookup indices.
   *
   * @param symbol - The global symbol to register
   *
   * @example
   * ```typescript
   * globalTable.register({
   *   name: 'drawSprite',
   *   qualifiedName: 'Game.Sprites.drawSprite',
   *   moduleName: 'Game.Sprites',
   *   kind: GlobalSymbolKind.Function,
   *   type: null,
   *   location: { start: {...}, end: {...} }
   * });
   * ```
   */
  public register(symbol: GlobalSymbol): void {
    // Add to qualified name index
    this.symbolsByQualifiedName.set(symbol.qualifiedName, symbol);

    // Add to simple name index
    const existing = this.symbolsBySimpleName.get(symbol.name) ?? [];
    existing.push(symbol);
    this.symbolsBySimpleName.set(symbol.name, existing);

    // Add to module index
    let moduleSymbols = this.symbolsByModule.get(symbol.moduleName);
    if (!moduleSymbols) {
      moduleSymbols = new Map();
      this.symbolsByModule.set(symbol.moduleName, moduleSymbols);
    }
    moduleSymbols.set(symbol.name, symbol);
  }

  /**
   * Looks up a symbol by qualified name (module.symbol)
   *
   * This is the unambiguous lookup - there can only be one symbol
   * with a given qualified name.
   *
   * @param moduleName - The module name
   * @param symbolName - The symbol name within the module
   * @returns Lookup result
   *
   * @example
   * ```typescript
   * const result = globalTable.lookupQualified('Game.Sprites', 'drawSprite');
   * if (result.found) {
   *   // Use result.symbol
   * }
   * ```
   */
  public lookupQualified(moduleName: string, symbolName: string): GlobalLookupResult {
    const qualifiedName = this.makeQualifiedName(moduleName, symbolName);
    const symbol = this.symbolsByQualifiedName.get(qualifiedName);

    if (symbol) {
      return { found: true, symbol };
    }

    // Check if module exists but symbol doesn't
    const moduleSymbols = this.symbolsByModule.get(moduleName);
    if (moduleSymbols) {
      return {
        found: false,
        error: `Symbol '${symbolName}' not found in module '${moduleName}'`,
      };
    }

    return {
      found: false,
      error: `Module '${moduleName}' not found`,
    };
  }

  /**
   * Looks up a symbol by simple name
   *
   * This lookup may be ambiguous if multiple modules export the same name.
   * Use lookupQualified for unambiguous lookups.
   *
   * @param symbolName - The symbol name to look up
   * @returns Lookup result (may indicate ambiguity)
   *
   * @example
   * ```typescript
   * const result = globalTable.lookup('drawSprite');
   * if (result.ambiguous) {
   *   console.error('Ambiguous: multiple modules export', result.ambiguous);
   * } else if (result.found) {
   *   // Use result.symbol
   * }
   * ```
   */
  public lookup(symbolName: string): GlobalLookupResult {
    const symbols = this.symbolsBySimpleName.get(symbolName);

    if (!symbols || symbols.length === 0) {
      return {
        found: false,
        error: `Symbol '${symbolName}' not found in any module`,
      };
    }

    if (symbols.length === 1) {
      return { found: true, symbol: symbols[0] };
    }

    // Ambiguous - multiple modules export this name
    return {
      found: false,
      ambiguous: symbols,
      error: `Symbol '${symbolName}' is ambiguous - exported by multiple modules: ${symbols.map((s) => s.moduleName).join(', ')}`,
    };
  }

  /**
   * Gets all exported symbols from a specific module
   *
   * @param moduleName - The module to get exports from
   * @returns Map of symbol name → GlobalSymbol, or empty map if module not found
   *
   * @example
   * ```typescript
   * const exports = globalTable.getModuleExports('Game.Sprites');
   * for (const [name, symbol] of exports) {
   *   console.log(`${name}: ${symbol.kind}`);
   * }
   * ```
   */
  public getModuleExports(moduleName: string): Map<string, GlobalSymbol> {
    return this.symbolsByModule.get(moduleName) ?? new Map();
  }

  /**
   * Checks if a module has any exports
   *
   * @param moduleName - The module to check
   * @returns true if the module has at least one export
   */
  public hasModuleExports(moduleName: string): boolean {
    const exports = this.symbolsByModule.get(moduleName);
    return exports !== undefined && exports.size > 0;
  }

  /**
   * Checks if a specific symbol exists
   *
   * @param moduleName - The module name
   * @param symbolName - The symbol name
   * @returns true if the symbol exists
   */
  public has(moduleName: string, symbolName: string): boolean {
    const qualifiedName = this.makeQualifiedName(moduleName, symbolName);
    return this.symbolsByQualifiedName.has(qualifiedName);
  }

  /**
   * Checks if any symbol with the given name exists
   *
   * @param symbolName - The simple name to check
   * @returns true if at least one module exports this name
   */
  public hasAny(symbolName: string): boolean {
    const symbols = this.symbolsBySimpleName.get(symbolName);
    return symbols !== undefined && symbols.length > 0;
  }

  /**
   * Gets all module names that have exports
   *
   * @returns Array of module names
   */
  public getModuleNames(): string[] {
    return Array.from(this.symbolsByModule.keys());
  }

  /**
   * Gets all global symbols
   *
   * @returns Array of all global symbols
   */
  public getAllSymbols(): GlobalSymbol[] {
    return Array.from(this.symbolsByQualifiedName.values());
  }

  /**
   * Gets the total number of global symbols
   *
   * @returns Symbol count
   */
  public getSymbolCount(): number {
    return this.symbolsByQualifiedName.size;
  }

  /**
   * Gets symbols of a specific kind
   *
   * @param kind - The symbol kind to filter by
   * @returns Array of matching symbols
   */
  public getSymbolsByKind(kind: GlobalSymbolKind): GlobalSymbol[] {
    return this.getAllSymbols().filter((s) => s.kind === kind);
  }

  /**
   * Collects exports from all modules in a registry
   *
   * Scans all registered modules and collects their exported symbols
   * into this global symbol table.
   *
   * @param registry - The module registry to collect from
   * @returns Number of symbols collected
   *
   * @example
   * ```typescript
   * const globalTable = new GlobalSymbolTable();
   * const count = globalTable.collectFromRegistry(registry);
   * console.log(`Collected ${count} global symbols`);
   * ```
   */
  public collectFromRegistry(registry: ModuleRegistry): number {
    let count = 0;

    for (const module of registry.getAllModules()) {
      const collected = this.collectFromProgram(module.name, module.program);
      count += collected;
    }

    return count;
  }

  /**
   * Collects exports from a single program
   *
   * Supports both v1-style exports (ExportDecl wrapper) and v2-style exports
   * (export flags on FunctionDecl/VariableDecl).
   *
   * @param moduleName - The module name
   * @param program - The program AST
   * @returns Number of symbols collected
   */
  public collectFromProgram(moduleName: string, program: Program): number {
    let count = 0;

    for (const decl of program.getDeclarations()) {
      // V1 style: ExportDecl wrapper node
      if (isExportDecl(decl)) {
        const exportDecl = decl as ExportDecl;
        const innerDecl = exportDecl.getDeclaration();
        const location = innerDecl.getLocation();

        if (isFunctionDecl(innerDecl)) {
          const name = innerDecl.getName();
          this.register({
            name,
            qualifiedName: this.makeQualifiedName(moduleName, name),
            moduleName,
            kind: GlobalSymbolKind.Function,
            type: null, // Resolved during type checking
            location,
          });
          count++;
        } else if (isVariableDecl(innerDecl)) {
          const name = innerDecl.getName();
          const isConstVar = innerDecl.isConst();
          this.register({
            name,
            qualifiedName: this.makeQualifiedName(moduleName, name),
            moduleName,
            kind: isConstVar ? GlobalSymbolKind.Constant : GlobalSymbolKind.Variable,
            type: null, // Resolved during type checking
            location,
          });
          count++;
        }
      }

      // V2 style: Export flag on FunctionDecl
      if (isFunctionDecl(decl) && decl.isExportedFunction()) {
        const name = decl.getName();
        // Only register if not already registered (avoid duplicates from v1 style)
        if (!this.has(moduleName, name)) {
          this.register({
            name,
            qualifiedName: this.makeQualifiedName(moduleName, name),
            moduleName,
            kind: GlobalSymbolKind.Function,
            type: null, // Resolved during type checking
            location: decl.getLocation(),
          });
          count++;
        }
      }

      // V2 style: Export flag on VariableDecl
      if (isVariableDecl(decl) && decl.isExportedVariable()) {
        const name = decl.getName();
        const isConstVar = decl.isConst();
        // Only register if not already registered (avoid duplicates from v1 style)
        if (!this.has(moduleName, name)) {
          this.register({
            name,
            qualifiedName: this.makeQualifiedName(moduleName, name),
            moduleName,
            kind: isConstVar ? GlobalSymbolKind.Constant : GlobalSymbolKind.Variable,
            type: null, // Resolved during type checking
            location: decl.getLocation(),
          });
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Updates the type of a global symbol
   *
   * Called during type resolution to annotate symbols with their types.
   *
   * @param moduleName - The module name
   * @param symbolName - The symbol name
   * @param type - The resolved type
   * @returns true if the symbol was found and updated
   */
  public setSymbolType(moduleName: string, symbolName: string, type: TypeInfo): boolean {
    const qualifiedName = this.makeQualifiedName(moduleName, symbolName);
    const symbol = this.symbolsByQualifiedName.get(qualifiedName);

    if (symbol) {
      symbol.type = type;
      return true;
    }

    return false;
  }

  /**
   * Clears all symbols
   *
   * Resets the global symbol table.
   */
  public clear(): void {
    this.symbolsByQualifiedName.clear();
    this.symbolsBySimpleName.clear();
    this.symbolsByModule.clear();
  }

  /**
   * Checks if the table is empty
   *
   * @returns true if no symbols are registered
   */
  public isEmpty(): boolean {
    return this.symbolsByQualifiedName.size === 0;
  }

  /**
   * Finds all symbols that match a pattern
   *
   * Useful for IDE completion and search features.
   *
   * @param pattern - Simple pattern to match (substring)
   * @returns Array of matching symbols
   */
  public findSymbols(pattern: string): GlobalSymbol[] {
    const lowerPattern = pattern.toLowerCase();
    const results: GlobalSymbol[] = [];

    for (const symbol of this.symbolsByQualifiedName.values()) {
      if (
        symbol.name.toLowerCase().includes(lowerPattern) ||
        symbol.qualifiedName.toLowerCase().includes(lowerPattern)
      ) {
        results.push(symbol);
      }
    }

    return results;
  }

  /**
   * Gets statistics about the global symbol table
   *
   * @returns Object with table statistics
   */
  public getStats(): {
    totalSymbols: number;
    modules: number;
    functions: number;
    variables: number;
    constants: number;
  } {
    const symbols = this.getAllSymbols();
    return {
      totalSymbols: symbols.length,
      modules: this.symbolsByModule.size,
      functions: symbols.filter((s) => s.kind === GlobalSymbolKind.Function).length,
      variables: symbols.filter((s) => s.kind === GlobalSymbolKind.Variable).length,
      constants: symbols.filter((s) => s.kind === GlobalSymbolKind.Constant).length,
    };
  }

  /**
   * Creates a qualified name from module and symbol names
   *
   * @param moduleName - The module name
   * @param symbolName - The symbol name
   * @returns The qualified name (module.symbol)
   */
  protected makeQualifiedName(moduleName: string, symbolName: string): string {
    return `${moduleName}.${symbolName}`;
  }

  /**
   * Debug: Gets a string representation of the global symbol table
   *
   * @returns Human-readable table description
   */
  public toString(): string {
    const lines: string[] = ['GlobalSymbolTable:'];
    const stats = this.getStats();

    lines.push(`  Total symbols: ${stats.totalSymbols}`);
    lines.push(`  Modules: ${stats.modules}`);
    lines.push(`  Functions: ${stats.functions}`);
    lines.push(`  Variables: ${stats.variables}`);
    lines.push(`  Constants: ${stats.constants}`);
    lines.push('');

    for (const [moduleName, symbols] of this.symbolsByModule) {
      lines.push(`  Module: ${moduleName}`);
      for (const [name, symbol] of symbols) {
        lines.push(`    ${symbol.kind} ${name}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Iterator support - allows for...of iteration over all symbols
   *
   * @example
   * ```typescript
   * for (const symbol of globalTable) {
   *   console.log(symbol.qualifiedName);
   * }
   * ```
   */
  public [Symbol.iterator](): IterableIterator<GlobalSymbol> {
    return this.symbolsByQualifiedName.values();
  }
}
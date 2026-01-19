/**
 * Global Symbol Table
 *
 * Aggregates symbols from all modules in a multi-module compilation.
 * Provides cross-module symbol lookup and export validation.
 */

import type { Declaration } from '../ast/base.js';
import type { SymbolTable } from './symbol-table.js';
import type { Symbol, SymbolKind } from './symbol.js';
import type { TypeInfo } from './types.js';

/**
 * Global symbol with module context
 *
 * Represents a symbol that exists in the global compilation scope,
 * tracking which module it belongs to and whether it's exported.
 */
export interface GlobalSymbol {
  /** Symbol name */
  name: string;

  /** Module where this symbol is declared */
  moduleName: string;

  /** Symbol kind (Variable, Function, etc.) */
  kind: SymbolKind;

  /** Is this symbol exported from its module? */
  isExported: boolean;

  /** Original declaration AST node */
  declaration: Declaration;

  /** Type information (from semantic analysis) */
  typeInfo?: TypeInfo;

  /** Is this symbol a constant? */
  isConst: boolean;

  /** Original local symbol (from module's symbol table) */
  localSymbol: Symbol;
}

/**
 * Global Symbol Table
 *
 * Aggregates symbols from all modules and provides cross-module lookup.
 * Built after per-module analysis completes (Phase B in analyzer).
 *
 * **Usage Pattern:**
 * 1. Register each module's symbol table after analysis
 * 2. Use lookup() for import resolution (respects export visibility)
 * 3. Use lookupInModule() for module-specific queries
 * 4. Use getExportedSymbols() for import validation
 */
export class GlobalSymbolTable {
  /**
   * Map of module name → Global symbols in that module
   * Includes ALL symbols (exported and non-exported)
   */
  protected moduleSymbols: Map<string, Map<string, GlobalSymbol>>;

  /**
   * Map of module name → Only exported symbols
   * Used for import resolution (only exported symbols are visible)
   */
  protected moduleExports: Map<string, Map<string, GlobalSymbol>>;

  /**
   * Creates an empty global symbol table
   */
  constructor() {
    this.moduleSymbols = new Map();
    this.moduleExports = new Map();
  }

  /**
   * Register a module's symbols
   *
   * Extracts all symbols from a module's symbol table and adds them
   * to the global registry. Must be called after per-module analysis.
   *
   * @param moduleName - Fully qualified module name
   * @param symbolTable - Module's symbol table from semantic analysis
   * @throws Error if module already registered
   */
  public registerModule(moduleName: string, symbolTable: SymbolTable): void {
    if (this.moduleSymbols.has(moduleName)) {
      throw new Error(`Module '${moduleName}' is already registered in global symbol table`);
    }

    const symbols = new Map<string, GlobalSymbol>();
    const exports = new Map<string, GlobalSymbol>();

    // Extract all symbols from module's root scope
    const rootScope = symbolTable.getRootScope();
    const moduleLocalSymbols = Array.from(rootScope.symbols.values());

    for (const localSymbol of moduleLocalSymbols) {
      const globalSymbol: GlobalSymbol = {
        name: localSymbol.name,
        moduleName,
        kind: localSymbol.kind,
        isExported: localSymbol.isExported,
        declaration: localSymbol.declaration as Declaration,
        typeInfo: localSymbol.type,
        isConst: localSymbol.isConst,
        localSymbol,
      };

      symbols.set(localSymbol.name, globalSymbol);

      // Also add to exports map if exported
      if (localSymbol.isExported) {
        exports.set(localSymbol.name, globalSymbol);
      }
    }

    this.moduleSymbols.set(moduleName, symbols);
    this.moduleExports.set(moduleName, exports);
  }

  /**
   * Lookup a symbol across modules (respects export visibility)
   *
   * Searches for a symbol that can be imported by the requesting module.
   * Only returns symbols that are exported from their declaring module.
   *
   * **Use Case**: Validating `import { foo } from "bar"` statements
   *
   * @param identifier - Symbol name to lookup
   * @param fromModule - Module requesting the lookup (for future scoping rules)
   * @returns Global symbol if found and exported, undefined otherwise
   */
  public lookup(identifier: string, fromModule: string): GlobalSymbol | undefined {
    // Search all modules for an exported symbol with this name
    // TODO: In future, respect module visibility rules (public/protected modules)

    for (const [moduleName, exports] of this.moduleExports) {
      // Skip the requesting module (imports must be from other modules)
      if (moduleName === fromModule) {
        continue;
      }

      const symbol = exports.get(identifier);
      if (symbol) {
        return symbol;
      }
    }

    return undefined;
  }

  /**
   * Lookup a symbol in a specific module
   *
   * Searches only the specified module for the symbol.
   * Returns symbol regardless of export status.
   *
   * **Use Case**: Validating `import { foo } from "bar"` where module "bar" is known
   *
   * @param identifier - Symbol name to lookup
   * @param moduleName - Specific module to search
   * @returns Global symbol if found in that module, undefined otherwise
   */
  public lookupInModule(identifier: string, moduleName: string): GlobalSymbol | undefined {
    const symbols = this.moduleSymbols.get(moduleName);
    if (!symbols) {
      return undefined;
    }

    return symbols.get(identifier);
  }

  /**
   * Get all exported symbols from a module
   *
   * **Use Case**: List available imports from a module for IDE completion
   *
   * @param moduleName - Module to query
   * @returns Array of exported symbols (empty if module not found)
   */
  public getExportedSymbols(moduleName: string): GlobalSymbol[] {
    const exports = this.moduleExports.get(moduleName);
    if (!exports) {
      return [];
    }

    return Array.from(exports.values());
  }

  /**
   * Get all symbols from a module (including non-exported)
   *
   * @param moduleName - Module to query
   * @returns Array of all symbols (empty if module not found)
   */
  public getAllSymbols(moduleName: string): GlobalSymbol[] {
    const symbols = this.moduleSymbols.get(moduleName);
    if (!symbols) {
      return [];
    }

    return Array.from(symbols.values());
  }

  /**
   * Check if a module is registered
   *
   * @param moduleName - Module name to check
   * @returns True if module is registered
   */
  public hasModule(moduleName: string): boolean {
    return this.moduleSymbols.has(moduleName);
  }

  /**
   * Get all registered module names
   *
   * @returns Array of module names
   */
  public getModuleNames(): string[] {
    return Array.from(this.moduleSymbols.keys());
  }

  /**
   * Get total number of symbols across all modules
   *
   * @returns Total symbol count (all modules)
   */
  public getTotalSymbolCount(): number {
    let count = 0;
    for (const symbols of this.moduleSymbols.values()) {
      count += symbols.size;
    }
    return count;
  }

  /**
   * Get total number of exported symbols across all modules
   *
   * @returns Total exported symbol count
   */
  public getTotalExportCount(): number {
    let count = 0;
    for (const exports of this.moduleExports.values()) {
      count += exports.size;
    }
    return count;
  }

  /**
   * Reset the global symbol table
   *
   * Clears all modules and symbols. Used for testing.
   */
  public reset(): void {
    this.moduleSymbols.clear();
    this.moduleExports.clear();
  }
}

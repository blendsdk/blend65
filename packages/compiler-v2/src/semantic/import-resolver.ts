/**
 * Import Resolver for Blend65 Compiler v2
 *
 * Validates import statements and resolves imported symbols.
 * Works with the ModuleRegistry to check that imported modules exist
 * and that imported symbols are exported from those modules.
 *
 * Key responsibilities:
 * - Validate that imported modules exist in the registry
 * - Validate that imported symbols exist in the source module
 * - Validate that imported symbols are exported (not private)
 * - Report meaningful error messages for import failures
 *
 * @module semantic/import-resolver
 */

import type { SourceLocation } from '../ast/index.js';
import { ImportDecl, ExportDecl, Program } from '../ast/index.js';
import { isExportDecl, isFunctionDecl, isVariableDecl } from '../ast/type-guards.js';
import type { ModuleRegistry } from './module-registry.js';
import type { SymbolTable } from './symbol-table.js';

/**
 * Import validation error information
 *
 * Contains details about why an import validation failed.
 */
export interface ImportError {
  /** Error code for programmatic handling */
  code: ImportErrorCode;

  /** Human-readable error message */
  message: string;

  /** Source location of the import statement */
  location: SourceLocation;

  /** The module being imported from (if relevant) */
  moduleName?: string;

  /** The symbol being imported (if relevant) */
  symbolName?: string;
}

/**
 * Import error codes
 *
 * Allows programmatic handling of different error types.
 */
export enum ImportErrorCode {
  /** The imported module does not exist */
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',

  /** The imported symbol does not exist in the module */
  SYMBOL_NOT_FOUND = 'SYMBOL_NOT_FOUND',

  /** The symbol exists but is not exported */
  SYMBOL_NOT_EXPORTED = 'SYMBOL_NOT_EXPORTED',

  /** Circular import detected (handled by DependencyGraph, but reported here) */
  CIRCULAR_IMPORT = 'CIRCULAR_IMPORT',

  /** Wildcard import from module with no exports */
  NO_EXPORTS = 'NO_EXPORTS',
}

/**
 * Result of resolving a single import
 *
 * Contains the resolved symbols or error information.
 */
export interface ImportResolution {
  /** The import declaration that was resolved */
  importDecl: ImportDecl;

  /** Whether the import was resolved successfully */
  success: boolean;

  /** Resolved symbols (if successful) */
  symbols?: ResolvedImport[];

  /** Errors encountered (if unsuccessful) */
  errors?: ImportError[];
}

/**
 * A successfully resolved import
 *
 * Maps the local name to the exported symbol from the source module.
 */
export interface ResolvedImport {
  /** The local name used in the importing module */
  localName: string;

  /** The original name in the source module */
  originalName: string;

  /** The source module name */
  moduleName: string;

  /** The resolved symbol from the source module */
  symbol: ExportedSymbol;
}

/**
 * Exported symbol information
 *
 * Contains the symbol information and its origin.
 */
export interface ExportedSymbol {
  /** Symbol name */
  name: string;

  /** Symbol kind (function, variable, etc.) */
  kind: 'function' | 'variable' | 'constant';

  /** Source location of the export */
  location: SourceLocation;
}

/**
 * Import Resolver - validates and resolves import statements
 *
 * The ImportResolver works with the ModuleRegistry to validate that:
 * 1. Imported modules exist
 * 2. Imported symbols exist in the source module
 * 3. Imported symbols are exported (public)
 *
 * It does NOT perform type checking - that happens later in the
 * type checking pass. This is purely about symbol resolution.
 *
 * @example
 * ```typescript
 * const resolver = new ImportResolver(registry);
 *
 * // Resolve all imports in a module
 * const results = resolver.resolveImports(program);
 *
 * // Check for errors
 * for (const result of results) {
 *   if (!result.success) {
 *     for (const error of result.errors) {
 *       console.error(error.message);
 *     }
 *   }
 * }
 * ```
 */
export class ImportResolver {
  /**
   * The module registry containing all parsed modules
   */
  protected registry: ModuleRegistry;

  /**
   * Cache of exported symbols per module
   * Key: module name
   * Value: Map of symbol name → ExportedSymbol
   */
  protected exportCache: Map<string, Map<string, ExportedSymbol>> = new Map();

  /**
   * Creates a new ImportResolver
   *
   * @param registry - The module registry to use for module lookups
   */
  constructor(registry: ModuleRegistry) {
    this.registry = registry;
  }

  /**
   * Resolves all imports in a program
   *
   * Processes each import declaration and validates that the imported
   * module and symbols exist and are properly exported.
   *
   * @param program - The program AST to resolve imports for
   * @returns Array of ImportResolution results for each import
   *
   * @example
   * ```typescript
   * const results = resolver.resolveImports(program);
   * const allSuccess = results.every(r => r.success);
   * ```
   */
  public resolveImports(program: Program): ImportResolution[] {
    const results: ImportResolution[] = [];

    // Find all import declarations in the program
    for (const decl of program.getDeclarations()) {
      if (decl.getNodeType() === 'ImportDecl') {
        const importDecl = decl as ImportDecl;
        results.push(this.resolveImport(importDecl));
      }
    }

    return results;
  }

  /**
   * Resolves a single import declaration
   *
   * Validates the module exists, then validates each imported symbol.
   *
   * @param importDecl - The import declaration to resolve
   * @returns Resolution result with symbols or errors
   *
   * @example
   * ```typescript
   * const result = resolver.resolveImport(importDecl);
   * if (result.success) {
   *   for (const sym of result.symbols) {
   *     console.log(`Imported ${sym.localName} from ${sym.moduleName}`);
   *   }
   * }
   * ```
   */
  public resolveImport(importDecl: ImportDecl): ImportResolution {
    const moduleName = importDecl.getModuleName();
    const errors: ImportError[] = [];
    const symbols: ResolvedImport[] = [];

    // Step 1: Check if the module exists
    if (!this.registry.hasModule(moduleName)) {
      errors.push({
        code: ImportErrorCode.MODULE_NOT_FOUND,
        message: `Module '${moduleName}' not found`,
        location: importDecl.getLocation(),
        moduleName,
      });
      return { importDecl, success: false, errors };
    }

    // Step 2: Get exports from the module
    const exports = this.getModuleExports(moduleName);

    // Step 3: Handle wildcard imports
    if (importDecl.isWildcardImport()) {
      if (exports.size === 0) {
        errors.push({
          code: ImportErrorCode.NO_EXPORTS,
          message: `Module '${moduleName}' has no exports`,
          location: importDecl.getLocation(),
          moduleName,
        });
        return { importDecl, success: false, errors };
      }

      // Import all exported symbols
      for (const [name, exportedSymbol] of exports) {
        symbols.push({
          localName: name,
          originalName: name,
          moduleName,
          symbol: exportedSymbol,
        });
      }

      return { importDecl, success: true, symbols };
    }

    // Step 4: Handle named imports
    for (const identifier of importDecl.getIdentifiers()) {
      const exportedSymbol = exports.get(identifier);

      if (!exportedSymbol) {
        // Check if symbol exists but isn't exported
        const exists = this.symbolExistsInModule(moduleName, identifier);

        if (exists) {
          errors.push({
            code: ImportErrorCode.SYMBOL_NOT_EXPORTED,
            message: `Symbol '${identifier}' exists in module '${moduleName}' but is not exported`,
            location: importDecl.getLocation(),
            moduleName,
            symbolName: identifier,
          });
        } else {
          errors.push({
            code: ImportErrorCode.SYMBOL_NOT_FOUND,
            message: `Symbol '${identifier}' not found in module '${moduleName}'`,
            location: importDecl.getLocation(),
            moduleName,
            symbolName: identifier,
          });
        }
      } else {
        symbols.push({
          localName: identifier,
          originalName: identifier,
          moduleName,
          symbol: exportedSymbol,
        });
      }
    }

    if (errors.length > 0) {
      return { importDecl, success: false, errors, symbols };
    }

    return { importDecl, success: true, symbols };
  }

  /**
   * Gets all exported symbols from a module
   *
   * Returns a map of symbol name → ExportedSymbol for all symbols
   * that are exported from the given module.
   *
   * @param moduleName - The module to get exports from
   * @returns Map of exported symbols
   *
   * @example
   * ```typescript
   * const exports = resolver.getModuleExports('Game.Sprites');
   * for (const [name, symbol] of exports) {
   *   console.log(`${name}: ${symbol.kind}`);
   * }
   * ```
   */
  public getModuleExports(moduleName: string): Map<string, ExportedSymbol> {
    // Check cache first
    if (this.exportCache.has(moduleName)) {
      return this.exportCache.get(moduleName)!;
    }

    const exports = new Map<string, ExportedSymbol>();
    const program = this.registry.getProgram(moduleName);

    if (!program) {
      return exports;
    }

    // Find all export declarations
    for (const decl of program.getDeclarations()) {
      if (isExportDecl(decl)) {
        const exportDecl = decl as ExportDecl;
        const innerDecl = exportDecl.getDeclaration();
        const location = innerDecl.getLocation();

        if (isFunctionDecl(innerDecl)) {
          const name = innerDecl.getName();
          exports.set(name, {
            name,
            kind: 'function',
            location,
          });
        } else if (isVariableDecl(innerDecl)) {
          const name = innerDecl.getName();
          const isConstVar = innerDecl.isConst();
          exports.set(name, {
            name,
            kind: isConstVar ? 'constant' : 'variable',
            location,
          });
        }
      }
    }

    // Cache the result
    this.exportCache.set(moduleName, exports);

    return exports;
  }

  /**
   * Checks if a symbol exists in a module (regardless of export status)
   *
   * Used to provide better error messages - "not exported" vs "not found".
   *
   * @param moduleName - The module to check
   * @param symbolName - The symbol to look for
   * @returns true if the symbol exists (exported or not)
   */
  public symbolExistsInModule(moduleName: string, symbolName: string): boolean {
    const program = this.registry.getProgram(moduleName);

    if (!program) {
      return false;
    }

    // Check all top-level declarations
    for (const decl of program.getDeclarations()) {
      // Check export declarations
      if (isExportDecl(decl)) {
        const innerDecl = (decl as ExportDecl).getDeclaration();
        if (isFunctionDecl(innerDecl) && innerDecl.getName() === symbolName) {
          return true;
        }
        if (isVariableDecl(innerDecl) && innerDecl.getName() === symbolName) {
          return true;
        }
      }

      // Check non-exported declarations
      if (isFunctionDecl(decl) && decl.getName() === symbolName) {
        return true;
      }
      if (isVariableDecl(decl) && decl.getName() === symbolName) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validates an import against a SymbolTable
   *
   * Checks that the imported symbol doesn't conflict with existing
   * symbols in the importing module's symbol table.
   *
   * @param importDecl - The import declaration
   * @param symbolTable - The importing module's symbol table
   * @returns Array of conflict errors (empty if no conflicts)
   */
  public checkImportConflicts(importDecl: ImportDecl, symbolTable: SymbolTable): ImportError[] {
    const errors: ImportError[] = [];

    // For wildcard imports, check all exported names
    if (importDecl.isWildcardImport()) {
      const moduleName = importDecl.getModuleName();
      const exports = this.getModuleExports(moduleName);

      for (const [name] of exports) {
        const existing = symbolTable.lookupLocal(name);
        if (existing) {
          errors.push({
            code: ImportErrorCode.SYMBOL_NOT_FOUND, // Using existing code, could add CONFLICT
            message: `Import '${name}' from '${moduleName}' conflicts with existing declaration`,
            location: importDecl.getLocation(),
            moduleName,
            symbolName: name,
          });
        }
      }
    } else {
      // For named imports, check each name
      for (const name of importDecl.getIdentifiers()) {
        const existing = symbolTable.lookupLocal(name);
        if (existing) {
          errors.push({
            code: ImportErrorCode.SYMBOL_NOT_FOUND,
            message: `Import '${name}' conflicts with existing declaration`,
            location: importDecl.getLocation(),
            moduleName: importDecl.getModuleName(),
            symbolName: name,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Clears the export cache
   *
   * Should be called when modules are re-parsed or the registry changes.
   */
  public clearCache(): void {
    this.exportCache.clear();
  }

  /**
   * Gets all import errors for a program
   *
   * Convenience method that collects all errors from all imports.
   *
   * @param program - The program to check
   * @returns Array of all import errors
   */
  public getAllErrors(program: Program): ImportError[] {
    const results = this.resolveImports(program);
    const errors: ImportError[] = [];

    for (const result of results) {
      if (result.errors) {
        errors.push(...result.errors);
      }
    }

    return errors;
  }

  /**
   * Checks if all imports in a program are valid
   *
   * @param program - The program to check
   * @returns true if all imports are valid
   */
  public allImportsValid(program: Program): boolean {
    const results = this.resolveImports(program);
    return results.every((r) => r.success);
  }
}
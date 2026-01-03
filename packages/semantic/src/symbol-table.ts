/**
 * Symbol Table Management for Blend65 Semantic Analysis
 * Task 1.2: Implement Symbol Table Management
 *
 * This file implements the core symbol table functionality for the Blend65 compiler:
 * - Hierarchical scope management (Global → Module → Function → Block)
 * - Symbol declaration and lookup with proper lexical scoping
 * - Symbol visibility and shadowing rules
 * - Blend65 module system support with import/export tracking
 * - Duplicate declaration detection
 * - Type-safe symbol resolution
 *
 * Educational Focus:
 * - How compilers manage nested scopes and symbol visibility
 * - Implementation of lexical scoping rules
 * - Module system symbol resolution
 * - Error detection and recovery in symbol management
 */

import { SourcePosition } from '@blend65/lexer';
import {
  Symbol,
  Scope,
  ScopeType,
  VariableSymbol,
  FunctionSymbol,
  ModuleSymbol,
  TypeSymbol,
  EnumSymbol,
  SemanticError,
  SemanticResult,
  ImportInfo,
  createScope
} from './types.js';

// ============================================================================
// SYMBOL TABLE CORE IMPLEMENTATION
// ============================================================================

/**
 * Main symbol table class that manages hierarchical scopes and symbol resolution.
 *
 * Educational Note:
 * - The symbol table is the compiler's "memory" of all declared symbols
 * - Scope hierarchy enables proper variable shadowing and visibility
 * - Efficient lookup enables fast symbol resolution during compilation
 */
export class SymbolTable {
  /** Current scope being processed */
  private currentScope: Scope;

  /** Global scope (root of scope hierarchy) */
  private globalScope: Scope;

  /** All modules in the program, indexed by qualified name */
  private modules: Map<string, ModuleSymbol>;

  /** Errors accumulated during symbol table construction */
  private errors: SemanticError[];

  /**
   * Initialize symbol table with global scope.
   */
  constructor() {
    this.globalScope = createScope('Global', null, 'Global');
    this.currentScope = this.globalScope;
    this.modules = new Map();
    this.errors = [];
  }

  // ============================================================================
  // SCOPE MANAGEMENT
  // ============================================================================

  /**
   * Enter a new scope (push scope onto scope stack).
   *
   * Educational Note:
   * - Entering scope creates new symbol namespace
   * - Parent scope remains accessible for symbol lookup
   * - Used when processing functions, blocks, etc.
   */
  enterScope(scopeType: ScopeType, name?: string): void {
    const newScope = createScope(scopeType, this.currentScope, name);
    this.currentScope.children.push(newScope);
    this.currentScope = newScope;
  }

  /**
   * Exit current scope (pop scope from scope stack).
   *
   * Educational Note:
   * - Exiting scope removes local symbols from visibility
   * - Parent scope becomes current scope again
   * - Local symbols are preserved for later phases (IL generation)
   */
  exitScope(): void {
    if (this.currentScope.parent) {
      this.currentScope = this.currentScope.parent;
    } else {
      // Should not happen in well-formed programs
      this.addError({
        errorType: 'InvalidScope',
        message: 'Cannot exit global scope',
        location: { line: 0, column: 0, offset: 0 }
      });
    }
  }

  /**
   * Get current scope.
   */
  getCurrentScope(): Scope {
    return this.currentScope;
  }

  /**
   * Get global scope.
   */
  getGlobalScope(): Scope {
    return this.globalScope;
  }

  // ============================================================================
  // SYMBOL DECLARATION
  // ============================================================================

  /**
   * Declare a symbol in the current scope.
   *
   * Educational Note:
   * - Declaration adds symbol to current scope's symbol table
   * - Checks for duplicate declarations in same scope
   * - Different scopes can have symbols with same name (shadowing)
   */
  declareSymbol(symbol: Symbol): SemanticResult<void> {
    // Check for duplicate declaration in current scope
    const existing = this.currentScope.symbols.get(symbol.name);
    if (existing) {
      const error: SemanticError = {
        errorType: 'DuplicateSymbol',
        message: `Symbol '${symbol.name}' is already declared in this scope`,
        location: symbol.sourceLocation,
        suggestions: [
          `Use a different name for the ${symbol.symbolType.toLowerCase()}`,
          `Check if you meant to reference the existing ${existing.symbolType.toLowerCase()}`
        ],
        relatedErrors: [{
          errorType: 'DuplicateSymbol',
          message: `Previous declaration of '${symbol.name}' was here`,
          location: existing.sourceLocation
        }]
      };

      this.addError(error);
      return {
        success: false,
        errors: [error]
      };
    }

    // Add symbol to current scope
    this.currentScope.symbols.set(symbol.name, symbol);

    // Special handling for modules
    if (symbol.symbolType === 'Module') {
      const moduleSymbol = symbol as ModuleSymbol;
      const qualifiedName = moduleSymbol.qualifiedName.join('.');
      this.modules.set(qualifiedName, moduleSymbol);
    }

    return {
      success: true,
      data: undefined
    };
  }

  // ============================================================================
  // SYMBOL LOOKUP
  // ============================================================================

  /**
   * Look up a symbol by name in current scope chain.
   *
   * Educational Note:
   * - Lookup walks up the scope chain from current to global
   * - First matching symbol wins (inner scopes shadow outer scopes)
   * - Returns null if symbol not found in any accessible scope
   */
  lookupSymbol(name: string): Symbol | null {
    let scope: Scope | null = this.currentScope;

    // Walk up the scope chain
    while (scope) {
      const symbol = scope.symbols.get(name);
      if (symbol) {
        return symbol;
      }
      scope = scope.parent;
    }

    return null;
  }

  /**
   * Look up a symbol in a specific scope (no scope chain walking).
   *
   * Educational Note:
   * - Direct scope lookup for specific visibility rules
   * - Used for checking local vs global symbol conflicts
   * - Useful for implementing specific language semantics
   */
  lookupSymbolInScope(name: string, scope: Scope): Symbol | null {
    return scope.symbols.get(name) || null;
  }

  /**
   * Look up a qualified symbol (e.g., "Game.Main", "c64.sprites").
   *
   * Educational Note:
   * - Qualified names enable hierarchical organization
   * - Module system allows importing symbols from other modules
   * - Qualified lookup resolves module boundaries
   */
  lookupQualifiedSymbol(qualifiedName: string[]): Symbol | null {
    if (qualifiedName.length === 1) {
      // Simple name - use regular lookup
      return this.lookupSymbol(qualifiedName[0]);
    }

    // Multi-part name - resolve through modules
    const modulePath = qualifiedName.slice(0, -1);
    const symbolName = qualifiedName[qualifiedName.length - 1];
    const moduleQualifiedName = modulePath.join('.');

    const module = this.modules.get(moduleQualifiedName);
    if (!module) {
      return null;
    }

    return module.exports.get(symbolName) || null;
  }

  /**
   * Look up all symbols in current scope (for debugging/introspection).
   */
  getCurrentScopeSymbols(): Map<string, Symbol> {
    return new Map(this.currentScope.symbols);
  }

  /**
   * Get all symbols accessible from current scope.
   *
   * Educational Note:
   * - Returns all symbols visible in current context
   * - Includes symbols from parent scopes
   * - Useful for IDE completion and error reporting
   */
  getAccessibleSymbols(): Map<string, Symbol> {
    const accessible = new Map<string, Symbol>();
    let scope: Scope | null = this.currentScope;

    // Collect symbols from current scope up to global scope
    while (scope) {
      for (const [name, symbol] of scope.symbols) {
        // Only add if not already present (inner scopes shadow outer scopes)
        if (!accessible.has(name)) {
          accessible.set(name, symbol);
        }
      }
      scope = scope.parent;
    }

    return accessible;
  }

  // ============================================================================
  // MODULE SYSTEM SUPPORT
  // ============================================================================

  /**
   * Register a module and enter its scope.
   *
   * Educational Note:
   * - Modules provide namespace isolation
   * - Module scope contains module's declarations
   * - Module registration enables import/export resolution
   */
  enterModule(moduleSymbol: ModuleSymbol): SemanticResult<void> {
    // Declare module in current scope first
    const declareResult = this.declareSymbol(moduleSymbol);
    if (!declareResult.success) {
      return declareResult;
    }

    // Enter module scope
    this.enterScope('Module', moduleSymbol.qualifiedName.join('.'));

    return {
      success: true,
      data: undefined
    };
  }

  /**
   * Exit module scope.
   */
  exitModule(): void {
    this.exitScope();
  }

  /**
   * Add an export to the current module.
   *
   * Educational Note:
   * - Exported symbols become visible to importing modules
   * - Export tracking enables import resolution
   * - Only exported symbols are accessible via qualified names
   */
  exportSymbol(symbol: Symbol): SemanticResult<void> {
    const currentModule = this.getCurrentModule();
    if (!currentModule) {
      const error: SemanticError = {
        errorType: 'InvalidScope',
        message: `Cannot export '${symbol.name}' outside of module scope`,
        location: symbol.sourceLocation,
        suggestions: [
          'Move export declaration inside a module',
          'Remove export keyword for non-module symbols'
        ]
      };

      this.addError(error);
      return {
        success: false,
        errors: [error]
      };
    }

    // Check if already exported
    if (currentModule.exports.has(symbol.name)) {
      const error: SemanticError = {
        errorType: 'DuplicateSymbol',
        message: `Symbol '${symbol.name}' is already exported from module '${currentModule.qualifiedName.join('.')}'`,
        location: symbol.sourceLocation
      };

      this.addError(error);
      return {
        success: false,
        errors: [error]
      };
    }

    // Mark symbol as exported
    symbol.isExported = true;
    currentModule.exports.set(symbol.name, symbol);

    return {
      success: true,
      data: undefined
    };
  }

  /**
   * Add an import to the current module.
   *
   * Educational Note:
   * - Imports make external symbols available in current module
   * - Import resolution happens during symbol table construction
   * - Failed imports are semantic errors
   */
  importSymbol(importInfo: ImportInfo, location: SourcePosition): SemanticResult<void> {
    const currentModule = this.getCurrentModule();
    if (!currentModule) {
      const error: SemanticError = {
        errorType: 'InvalidScope',
        message: `Cannot import '${importInfo.importedName}' outside of module scope`,
        location,
        suggestions: [
          'Move import declaration inside a module',
          'Use qualified names instead of imports'
        ]
      };

      this.addError(error);
      return {
        success: false,
        errors: [error]
      };
    }

    // Try to resolve the imported symbol
    const sourceModuleName = importInfo.sourceModule.join('.');
    const sourceModule = this.modules.get(sourceModuleName);

    if (!sourceModule) {
      const error: SemanticError = {
        errorType: 'ImportNotFound',
        message: `Cannot find module '${sourceModuleName}' for import`,
        location,
        suggestions: [
          `Check if module '${sourceModuleName}' is declared`,
          'Check module name spelling and case'
        ]
      };

      this.addError(error);
      return {
        success: false,
        errors: [error]
      };
    }

    const importedSymbol = sourceModule.exports.get(importInfo.importedName);
    if (!importedSymbol) {
      const error: SemanticError = {
        errorType: 'ImportNotFound',
        message: `Symbol '${importInfo.importedName}' is not exported by module '${sourceModuleName}'`,
        location,
        suggestions: [
          `Check if '${importInfo.importedName}' is exported from module '${sourceModuleName}'`,
          'Check symbol name spelling and case',
          `Available exports: ${Array.from(sourceModule.exports.keys()).join(', ')}`
        ]
      };

      this.addError(error);
      return {
        success: false,
        errors: [error]
      };
    }

    // Resolve the import
    importInfo.resolvedSymbol = importedSymbol;
    currentModule.imports.set(importInfo.localName, importInfo);

    // Add imported symbol to current scope with local name
    this.currentScope.symbols.set(importInfo.localName, importedSymbol);

    return {
      success: true,
      data: undefined
    };
  }

  /**
   * Get current module (if in module scope).
   */
  getCurrentModule(): ModuleSymbol | null {
    let scope: Scope | null = this.currentScope;

    // Walk up scope chain looking for module scope
    while (scope) {
      if (scope.scopeType === 'Module') {
        // Find module symbol in parent scope
        const moduleName = scope.name;
        if (moduleName) {
          return this.modules.get(moduleName) || null;
        }
      }
      scope = scope.parent;
    }

    return null;
  }

  /**
   * Get all modules in the symbol table.
   */
  getAllModules(): Map<string, ModuleSymbol> {
    return new Map(this.modules);
  }

  // ============================================================================
  // SYMBOL VISIBILITY AND SHADOWING
  // ============================================================================

  /**
   * Check if a symbol would shadow another symbol.
   *
   * Educational Note:
   * - Shadowing occurs when inner scope declares symbol with same name as outer scope
   * - Some languages allow shadowing, others forbid it
   * - Blend65 allows shadowing but warns about potential confusion
   */
  checkShadowing(symbolName: string, location: SourcePosition): SemanticResult<void> {
    // Look for symbol in parent scopes (not current scope)
    let scope = this.currentScope.parent;

    while (scope) {
      const shadowedSymbol = scope.symbols.get(symbolName);
      if (shadowedSymbol) {
        // Found shadowed symbol - create warning
        const warning: SemanticError = {
          errorType: 'InvalidScope',
          message: `Symbol '${symbolName}' shadows symbol in outer scope`,
          location,
          suggestions: [
            `Use a different name to avoid shadowing`,
            `Consider if you meant to reference the outer symbol`
          ],
          relatedErrors: [{
            errorType: 'InvalidScope',
            message: `Shadowed symbol '${symbolName}' declared here`,
            location: shadowedSymbol.sourceLocation
          }]
        };

        return {
          success: true,
          data: undefined,
          warnings: [warning]
        };
      }
      scope = scope.parent;
    }

    return {
      success: true,
      data: undefined
    };
  }

  /**
   * Check if a symbol is visible from current scope.
   *
   * Educational Note:
   * - Visibility rules determine which symbols can be accessed
   * - Used for validating symbol references in expressions
   * - Considers scope hierarchy and module boundaries
   */
  isSymbolVisible(symbol: Symbol): boolean {
    // Symbol is visible if it's in current scope chain
    let scope: Scope | null = this.currentScope;

    while (scope) {
      for (const [_, scopeSymbol] of scope.symbols) {
        if (scopeSymbol === symbol) {
          return true;
        }
      }
      scope = scope.parent;
    }

    return false;
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  /**
   * Add a semantic error to the error list.
   */
  private addError(error: SemanticError): void {
    this.errors.push(error);
  }

  /**
   * Get all accumulated errors.
   */
  getErrors(): SemanticError[] {
    return [...this.errors];
  }

  /**
   * Clear all accumulated errors.
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Check if symbol table has any errors.
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  // ============================================================================
  // DEBUGGING AND INTROSPECTION
  // ============================================================================

  /**
   * Get string representation of symbol table for debugging.
   *
   * Educational Note:
   * - Debug output helps understand symbol table structure
   * - Useful for compiler development and troubleshooting
   * - Shows scope hierarchy and symbol distribution
   */
  toString(): string {
    return this.scopeToString(this.globalScope, 0);
  }

  /**
   * Convert scope to string representation (recursive helper).
   */
  private scopeToString(scope: Scope, indent: number): string {
    const indentStr = '  '.repeat(indent);
    const scopeName = scope.name || scope.scopeType;
    let result = `${indentStr}Scope[${scopeName}]\n`;

    // List symbols in this scope
    for (const [name, symbol] of scope.symbols) {
      result += `${indentStr}  ${symbol.symbolType}: ${name}\n`;
    }

    // Recursively print child scopes
    for (const child of scope.children) {
      result += this.scopeToString(child, indent + 1);
    }

    return result;
  }

  /**
   * Get statistics about symbol table.
   */
  getStatistics(): SymbolTableStatistics {
    let symbolCount = 0;
    let scopeCount = 0;

    const countScope = (scope: Scope): void => {
      scopeCount++;
      symbolCount += scope.symbols.size;
      for (const child of scope.children) {
        countScope(child);
      }
    };

    countScope(this.globalScope);

    return {
      totalSymbols: symbolCount,
      totalScopes: scopeCount,
      moduleCount: this.modules.size,
      errorCount: this.errors.length,
      maxScopeDepth: this.getMaxScopeDepth(this.globalScope, 0)
    };
  }

  /**
   * Get maximum scope depth (for complexity analysis).
   */
  private getMaxScopeDepth(scope: Scope, currentDepth: number): number {
    let maxDepth = currentDepth;
    for (const child of scope.children) {
      maxDepth = Math.max(maxDepth, this.getMaxScopeDepth(child, currentDepth + 1));
    }
    return maxDepth;
  }
}

// ============================================================================
// HELPER TYPES AND INTERFACES
// ============================================================================

/**
 * Statistics about symbol table structure.
 */
export interface SymbolTableStatistics {
  /** Total number of symbols across all scopes */
  totalSymbols: number;

  /** Total number of scopes */
  totalScopes: number;

  /** Number of modules */
  moduleCount: number;

  /** Number of accumulated errors */
  errorCount: number;

  /** Maximum nesting depth of scopes */
  maxScopeDepth: number;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a new symbol table.
 */
export function createSymbolTable(): SymbolTable {
  return new SymbolTable();
}

/**
 * Helper function to validate symbol table integrity.
 * Useful for testing and debugging.
 */
export function validateSymbolTable(symbolTable: SymbolTable): SemanticResult<void> {
  const errors: SemanticError[] = [];

  // Check for circular scope references
  const visitedScopes = new Set<Scope>();

  const validateScope = (scope: Scope): void => {
    if (visitedScopes.has(scope)) {
      errors.push({
        errorType: 'CircularDependency',
        message: 'Circular scope reference detected',
        location: { line: 0, column: 0, offset: 0 }
      });
      return;
    }

    visitedScopes.add(scope);

    // Validate parent-child relationships
    for (const child of scope.children) {
      if (child.parent !== scope) {
        errors.push({
          errorType: 'InvalidScope',
          message: 'Invalid parent-child scope relationship',
          location: { line: 0, column: 0, offset: 0 }
        });
      }
      validateScope(child);
    }

    visitedScopes.delete(scope);
  };

  validateScope(symbolTable.getGlobalScope());

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  return {
    success: true,
    data: undefined
  };
}

/**
 * Educational Summary of Symbol Table Implementation:
 *
 * 1. HIERARCHICAL SCOPE MANAGEMENT
 *    - Global → Module → Function → Block scope hierarchy
 *    - Proper scope enter/exit with scope stack management
 *    - Parent-child relationships for scope traversal
 *
 * 2. SYMBOL DECLARATION AND LOOKUP
 *    - Type-safe symbol declaration with duplicate detection
 *    - Lexical scoping with scope chain traversal
 *    - Qualified name resolution for module system
 *    - Efficient symbol lookup with scope walking
 *
 * 3. MODULE SYSTEM SUPPORT
 *    - Module registration and scope management
 *    - Import/export tracking with resolution
 *    - Symbol visibility across module boundaries
 *    - Qualified name resolution (e.g., Game.Main, c64.sprites)
 *
 * 4. VISIBILITY AND SHADOWING
 *    - Symbol shadowing detection with warnings
 *    - Visibility checking for symbol references
 *    - Scope-based access control
 *
 * 5. ERROR HANDLING
 *    - Comprehensive error collection and reporting
 *    - Rich error messages with suggestions
 *    - Error recovery for continued compilation
 *
 * 6. DEBUGGING AND INTROSPECTION
 *    - String representation for debugging
 *    - Statistics collection for analysis
 *    - Validation functions for testing
 *
 * This symbol table implementation provides the foundation for semantic analysis
 * in the Blend65 compiler, enabling proper symbol resolution, scope management,
 * and error detection for 6502-targeted compilation.
 *
 * Next: Task 1.3 will implement the type system infrastructure that uses this
 * symbol table for type checking and validation.
 */

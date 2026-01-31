/**
 * Symbol Table for Blend65 Compiler v2
 *
 * The SymbolTable is the central manager for all symbols and scopes during
 * semantic analysis. It maintains the scope tree and provides methods for
 * symbol declaration and lookup.
 *
 * @module semantic/symbol-table
 */

import type { ASTNode } from '../ast/index.js';
import type { SourceLocation, Expression, FunctionDecl } from '../ast/index.js';
import type { TypeInfo } from './types.js';
import {
  type Symbol,
  SymbolKind,
  createSymbol,
  createFunctionSymbol,
  createImportedSymbol,
} from './symbol.js';
import {
  type Scope,
  ScopeKind,
  createModuleScope,
  createFunctionScope,
  createBlockScope,
  createLoopScope,
  declareSymbol as scopeDeclareSymbol,
  lookupLocal,
  lookupInChain,
  getEnclosingFunctionSymbol,
} from './scope.js';

/**
 * Result of declaring a symbol
 */
export interface DeclareResult {
  /** Whether declaration was successful */
  success: boolean;

  /** The declared symbol (if successful) */
  symbol?: Symbol;

  /** Error message (if failed) */
  error?: string;

  /** Existing symbol (if duplicate) */
  existingSymbol?: Symbol;
}

/**
 * SymbolTable manages all scopes and symbols for a module
 *
 * The SymbolTable:
 * - Maintains the scope tree (module -> function -> block -> loop)
 * - Tracks the current scope during AST traversal
 * - Provides symbol declaration with duplicate checking
 * - Provides symbol lookup with scope chain traversal
 * - Generates unique scope IDs
 *
 * Usage during semantic analysis:
 * 1. Create SymbolTable with module AST node
 * 2. Traverse AST, calling enterScope/exitScope for each scope-creating node
 * 3. Call declare* methods to register symbols
 * 4. Call lookup* methods to resolve identifiers
 *
 * @example
 * ```typescript
 * const symbolTable = new SymbolTable(programNode);
 *
 * // Enter a function
 * const funcSymbol = symbolTable.declareFunction('add', location, ...);
 * symbolTable.enterFunctionScope(funcSymbol, funcNode);
 *
 * // Declare parameters
 * symbolTable.declareParameter('a', location, byteType);
 *
 * // Look up a symbol
 * const symbol = symbolTable.lookup('a');
 *
 * // Exit the function
 * symbolTable.exitScope();
 * ```
 */
export class SymbolTable {
  /** Root scope (module scope) */
  protected rootScope: Scope;

  /** Current scope during traversal */
  protected currentScope: Scope;

  /** All scopes indexed by ID */
  protected scopes: Map<string, Scope>;

  /** Counter for generating unique scope IDs */
  protected scopeCounter: number;

  /** Module name (for error messages and debugging) */
  protected moduleName: string;

  /**
   * Creates a new SymbolTable
   *
   * @param moduleNode - The Program AST node
   * @param moduleName - The module name (defaults to 'main')
   */
  constructor(moduleNode: ASTNode | null = null, moduleName: string = 'main') {
    this.scopeCounter = 0;
    this.scopes = new Map();
    this.moduleName = moduleName;

    // Create the root module scope
    this.rootScope = this.createScopeInternal(ScopeKind.Module, null, moduleNode);
    this.currentScope = this.rootScope;
  }

  // ============================================================
  // Scope Management
  // ============================================================

  /**
   * Gets the root (module) scope
   */
  getRootScope(): Scope {
    return this.rootScope;
  }

  /**
   * Gets the current scope
   */
  getCurrentScope(): Scope {
    return this.currentScope;
  }

  /**
   * Gets a scope by ID
   */
  getScope(id: string): Scope | undefined {
    return this.scopes.get(id);
  }

  /**
   * Gets all scopes
   */
  getAllScopes(): Map<string, Scope> {
    return this.scopes;
  }

  /**
   * Gets the module name
   */
  getModuleName(): string {
    return this.moduleName;
  }

  /**
   * Creates a new scope with a unique ID
   *
   * Internal method - use enterFunctionScope, enterBlockScope, etc.
   */
  protected createScopeInternal(kind: ScopeKind, parent: Scope | null, node: ASTNode | null): Scope {
    const id = `scope_${this.scopeCounter++}`;
    let scope: Scope;

    switch (kind) {
      case ScopeKind.Module:
        scope = createModuleScope(id, node);
        break;
      case ScopeKind.Function:
        // Function scopes need a symbol, handle specially in enterFunctionScope
        throw new Error('Use enterFunctionScope to create function scopes');
      case ScopeKind.Block:
        if (!parent) throw new Error('Block scope requires parent');
        scope = createBlockScope(id, parent, node);
        break;
      case ScopeKind.Loop:
        if (!parent) throw new Error('Loop scope requires parent');
        scope = createLoopScope(id, parent, node);
        break;
      default:
        throw new Error(`Unknown scope kind: ${kind}`);
    }

    this.scopes.set(id, scope);
    return scope;
  }

  /**
   * Enters a function scope
   *
   * Creates a new function scope and sets it as current.
   * The function symbol should already be declared in the parent scope.
   *
   * @param functionSymbol - The function symbol
   * @param node - The FunctionDecl AST node
   * @returns The new function scope
   */
  enterFunctionScope(functionSymbol: Symbol, node: ASTNode | null = null): Scope {
    const id = `scope_${this.scopeCounter++}`;
    const scope = createFunctionScope(id, this.currentScope, functionSymbol, node);
    this.scopes.set(id, scope);
    this.currentScope = scope;
    return scope;
  }

  /**
   * Enters a block scope
   *
   * Creates a new block scope for if/else bodies, standalone blocks, etc.
   *
   * @param node - The statement AST node
   * @returns The new block scope
   */
  enterBlockScope(node: ASTNode | null = null): Scope {
    const scope = this.createScopeInternal(ScopeKind.Block, this.currentScope, node);
    this.currentScope = scope;
    return scope;
  }

  /**
   * Enters a loop scope
   *
   * Creates a new loop scope for while/for loops.
   * Loop scopes track nesting for break/continue validation.
   *
   * @param node - The loop AST node
   * @returns The new loop scope
   */
  enterLoopScope(node: ASTNode | null = null): Scope {
    const scope = this.createScopeInternal(ScopeKind.Loop, this.currentScope, node);
    this.currentScope = scope;
    return scope;
  }

  /**
   * Exits the current scope
   *
   * Returns to the parent scope.
   *
   * @returns The parent scope
   * @throws If trying to exit the module scope
   */
  exitScope(): Scope {
    if (!this.currentScope.parent) {
      throw new Error('Cannot exit module scope');
    }
    this.currentScope = this.currentScope.parent;
    return this.currentScope;
  }

  /**
   * Checks if currently inside a loop
   */
  isInLoop(): boolean {
    return (this.currentScope.loopDepth ?? 0) > 0;
  }

  /**
   * Checks if currently inside a function
   */
  isInFunction(): boolean {
    let scope: Scope | null = this.currentScope;
    while (scope) {
      if (scope.kind === ScopeKind.Function) return true;
      scope = scope.parent;
    }
    return false;
  }

  /**
   * Gets the current function symbol (if inside a function)
   */
  getCurrentFunction(): Symbol | undefined {
    return getEnclosingFunctionSymbol(this.currentScope);
  }

  // ============================================================
  // Symbol Declaration
  // ============================================================

  /**
   * Declares a variable symbol
   *
   * @param name - Variable name
   * @param location - Source location
   * @param type - Type (null if not yet resolved)
   * @param options - Additional options
   * @returns Declaration result
   */
  declareVariable(
    name: string,
    location: SourceLocation,
    type: TypeInfo | null = null,
    options: {
      isConst?: boolean;
      isExported?: boolean;
      initializer?: Expression;
    } = {},
  ): DeclareResult {
    // Check for duplicate in current scope
    const existing = lookupLocal(this.currentScope, name);
    if (existing) {
      return {
        success: false,
        error: `Variable '${name}' is already declared in this scope`,
        existingSymbol: existing,
      };
    }

    const symbol = createSymbol(name, SymbolKind.Variable, location, this.currentScope, {
      type,
      isConst: options.isConst,
      isExported: options.isExported,
      initializer: options.initializer,
    });

    scopeDeclareSymbol(this.currentScope, symbol);

    return { success: true, symbol };
  }

  /**
   * Declares a constant symbol
   *
   * @param name - Constant name
   * @param location - Source location
   * @param type - Type (null if not yet resolved)
   * @param initializer - The initializer expression
   * @param isExported - Whether exported
   * @returns Declaration result
   */
  declareConstant(
    name: string,
    location: SourceLocation,
    type: TypeInfo | null = null,
    initializer?: Expression,
    isExported: boolean = false,
  ): DeclareResult {
    const existing = lookupLocal(this.currentScope, name);
    if (existing) {
      return {
        success: false,
        error: `Constant '${name}' is already declared in this scope`,
        existingSymbol: existing,
      };
    }

    const symbol = createSymbol(name, SymbolKind.Constant, location, this.currentScope, {
      type,
      isConst: true,
      isExported,
      initializer,
    });

    scopeDeclareSymbol(this.currentScope, symbol);

    return { success: true, symbol };
  }

  /**
   * Declares a parameter symbol
   *
   * Parameters are declared in function scopes.
   *
   * @param name - Parameter name
   * @param location - Source location
   * @param type - Parameter type
   * @returns Declaration result
   */
  declareParameter(name: string, location: SourceLocation, type: TypeInfo | null = null): DeclareResult {
    const existing = lookupLocal(this.currentScope, name);
    if (existing) {
      return {
        success: false,
        error: `Parameter '${name}' is already declared`,
        existingSymbol: existing,
      };
    }

    const symbol = createSymbol(name, SymbolKind.Parameter, location, this.currentScope, {
      type,
      isConst: false, // Parameters are mutable in Blend65
      isExported: false,
    });

    scopeDeclareSymbol(this.currentScope, symbol);

    return { success: true, symbol };
  }

  /**
   * Declares a function symbol
   *
   * Functions are declared in the current scope (typically module scope).
   * The function scope is not created here - use enterFunctionScope after.
   *
   * @param name - Function name
   * @param location - Source location
   * @param returnType - Return type (null if not yet resolved)
   * @param declaration - The FunctionDecl AST node
   * @param isExported - Whether exported
   * @returns Declaration result
   */
  declareFunction(
    name: string,
    location: SourceLocation,
    returnType: TypeInfo | null = null,
    declaration?: FunctionDecl,
    isExported: boolean = false,
  ): DeclareResult {
    const existing = lookupLocal(this.currentScope, name);
    if (existing) {
      return {
        success: false,
        error: `Function '${name}' is already declared in this scope`,
        existingSymbol: existing,
      };
    }

    // Parameters are added later when entering the function scope
    const symbol = createFunctionSymbol(name, location, this.currentScope, [], returnType, declaration, isExported);

    scopeDeclareSymbol(this.currentScope, symbol);

    return { success: true, symbol };
  }

  /**
   * Declares an imported symbol
   *
   * @param localName - Local name (possibly aliased)
   * @param originalName - Name in source module
   * @param sourceModule - Module path
   * @param location - Source location
   * @returns Declaration result
   */
  declareImport(
    localName: string,
    originalName: string,
    sourceModule: string,
    location: SourceLocation,
  ): DeclareResult {
    const existing = lookupLocal(this.currentScope, localName);
    if (existing) {
      return {
        success: false,
        error: `'${localName}' is already declared in this scope`,
        existingSymbol: existing,
      };
    }

    const symbol = createImportedSymbol(localName, originalName, sourceModule, location, this.currentScope);

    scopeDeclareSymbol(this.currentScope, symbol);

    return { success: true, symbol };
  }

  /**
   * Declares an enum member
   *
   * @param name - Member name
   * @param location - Source location
   * @param type - Enum type
   * @returns Declaration result
   */
  declareEnumMember(name: string, location: SourceLocation, type: TypeInfo | null = null): DeclareResult {
    const existing = lookupLocal(this.currentScope, name);
    if (existing) {
      return {
        success: false,
        error: `Enum member '${name}' is already declared`,
        existingSymbol: existing,
      };
    }

    const symbol = createSymbol(name, SymbolKind.EnumMember, location, this.currentScope, {
      type,
      isConst: true, // Enum members are constants
      isExported: false,
    });

    scopeDeclareSymbol(this.currentScope, symbol);

    return { success: true, symbol };
  }

  // ============================================================
  // Symbol Lookup
  // ============================================================

  /**
   * Looks up a symbol in the current scope only
   *
   * @param name - Symbol name
   * @returns The symbol if found in current scope
   */
  lookupLocal(name: string): Symbol | undefined {
    return lookupLocal(this.currentScope, name);
  }

  /**
   * Looks up a symbol in the scope chain
   *
   * Traverses from current scope to module scope.
   *
   * @param name - Symbol name
   * @returns The symbol if found in any enclosing scope
   */
  lookup(name: string): Symbol | undefined {
    return lookupInChain(this.currentScope, name);
  }

  /**
   * Looks up a symbol starting from a specific scope
   *
   * @param name - Symbol name
   * @param scope - Starting scope
   * @returns The symbol if found
   */
  lookupFrom(name: string, scope: Scope): Symbol | undefined {
    return lookupInChain(scope, name);
  }

  /**
   * Looks up a symbol in the module scope only
   *
   * @param name - Symbol name
   * @returns The symbol if found in module scope
   */
  lookupGlobal(name: string): Symbol | undefined {
    return lookupLocal(this.rootScope, name);
  }

  /**
   * Checks if a symbol exists in the current scope
   *
   * @param name - Symbol name
   * @returns true if exists in current scope
   */
  hasLocal(name: string): boolean {
    return this.currentScope.symbols.has(name);
  }

  /**
   * Checks if a symbol exists anywhere in the scope chain
   *
   * @param name - Symbol name
   * @returns true if exists in any enclosing scope
   */
  has(name: string): boolean {
    return this.lookup(name) !== undefined;
  }

  // ============================================================
  // Query Methods
  // ============================================================

  /**
   * Gets all symbols in the current scope
   */
  getCurrentScopeSymbols(): Map<string, Symbol> {
    return this.currentScope.symbols;
  }

  /**
   * Gets all symbols visible from the current scope
   *
   * Includes symbols from all parent scopes, with inner scopes
   * shadowing outer scopes.
   */
  getAllVisibleSymbols(): Map<string, Symbol> {
    const result = new Map<string, Symbol>();
    const scopes: Scope[] = [];

    // Collect scopes from module to current
    let scope: Scope | null = this.currentScope;
    while (scope) {
      scopes.unshift(scope);
      scope = scope.parent;
    }

    // Process from module scope down
    for (const s of scopes) {
      for (const [name, symbol] of s.symbols) {
        result.set(name, symbol);
      }
    }

    return result;
  }

  /**
   * Gets all exported symbols from the module
   */
  getExportedSymbols(): Symbol[] {
    const exports: Symbol[] = [];

    for (const symbol of this.rootScope.symbols.values()) {
      if (symbol.isExported) {
        exports.push(symbol);
      }
    }

    return exports;
  }

  /**
   * Gets all function symbols in the module
   */
  getFunctionSymbols(): Symbol[] {
    const functions: Symbol[] = [];

    for (const symbol of this.rootScope.symbols.values()) {
      if (symbol.kind === SymbolKind.Function) {
        functions.push(symbol);
      }
    }

    return functions;
  }

  /**
   * Gets all symbols of a specific kind
   *
   * @param kind - The symbol kind to filter by
   * @param scope - Optional scope (defaults to root scope)
   */
  getSymbolsByKind(kind: SymbolKind, scope: Scope = this.rootScope): Symbol[] {
    const symbols: Symbol[] = [];

    for (const symbol of scope.symbols.values()) {
      if (symbol.kind === kind) {
        symbols.push(symbol);
      }
    }

    return symbols;
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Gets the total number of scopes
   */
  getScopeCount(): number {
    return this.scopes.size;
  }

  /**
   * Gets the total number of symbols across all scopes
   */
  getTotalSymbolCount(): number {
    let count = 0;
    for (const scope of this.scopes.values()) {
      count += scope.symbols.size;
    }
    return count;
  }

  /**
   * Creates a snapshot of the symbol table for debugging
   */
  toDebugString(): string {
    const lines: string[] = [];
    lines.push(`SymbolTable for module '${this.moduleName}':`);
    lines.push(`  Total scopes: ${this.scopes.size}`);
    lines.push(`  Total symbols: ${this.getTotalSymbolCount()}`);
    lines.push('');

    const printScope = (scope: Scope, indent: string) => {
      lines.push(`${indent}Scope ${scope.id} (${scope.kind}):`);
      for (const [name, symbol] of scope.symbols) {
        const typeStr = symbol.type ? symbol.type.name : '<unresolved>';
        lines.push(`${indent}  ${symbol.kind} ${name}: ${typeStr}`);
      }
      for (const child of scope.children) {
        printScope(child, indent + '  ');
      }
    };

    printScope(this.rootScope, '  ');

    return lines.join('\n');
  }
}
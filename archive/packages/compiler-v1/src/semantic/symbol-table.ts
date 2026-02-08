/**
 * Symbol Table Implementation
 *
 * Manages scopes and symbols throughout the compilation process.
 * Provides symbol declaration, lookup, and scope management operations.
 */

import type { ASTNode } from '../ast/base.js';
import type { Symbol } from './symbol.js';
import { Scope, ScopeKind } from './scope.js';

/**
 * Symbol table manages all scopes and symbols in the program
 *
 * The symbol table maintains a tree of scopes with the module scope
 * at the root. It provides operations for:
 * - Creating and navigating scopes
 * - Declaring symbols within scopes
 * - Looking up symbols (with scope chain traversal)
 * - Managing current scope during AST traversal
 */
export class SymbolTable {
  /** Root scope (module scope) - top of the scope tree */
  protected rootScope: Scope;

  /** All scopes indexed by their unique ID */
  protected scopes: Map<string, Scope>;

  /** Current scope during AST traversal */
  protected currentScope: Scope;

  /** Scope counter for generating unique IDs */
  protected scopeCounter: number;

  /**
   * Creates a new symbol table with an empty module scope
   */
  constructor() {
    this.scopeCounter = 0;
    this.scopes = new Map();

    // Create root module scope (no parent, no node initially)
    this.rootScope = this.createScope(ScopeKind.Module, null, null);
    this.currentScope = this.rootScope;
  }

  /**
   * Create a new scope
   *
   * @param kind - Scope kind (Module or Function)
   * @param parent - Parent scope (null for root)
   * @param node - AST node that created this scope (null for synthetic scopes)
   * @returns The newly created scope
   */
  public createScope(kind: ScopeKind, parent: Scope | null, node: ASTNode | null): Scope {
    const id = `scope_${this.scopeCounter++}`;

    const scope: Scope = {
      id,
      kind,
      parent,
      children: [],
      symbols: new Map(),
      node: node!,
    };

    this.scopes.set(id, scope);

    // Add to parent's children if there is a parent
    if (parent) {
      parent.children.push(scope);
    }

    return scope;
  }

  /**
   * Enter a scope (make it the current scope)
   *
   * Used during AST traversal to track which scope declarations
   * should be added to.
   *
   * @param scope - Scope to enter
   */
  public enterScope(scope: Scope): void {
    this.currentScope = scope;
  }

  /**
   * Exit current scope (return to parent scope)
   *
   * Used after finishing traversal of a scope's contents.
   * If current scope has no parent (root scope), stays at root.
   */
  public exitScope(): void {
    if (this.currentScope.parent) {
      this.currentScope = this.currentScope.parent;
    }
  }

  /**
   * Get the current scope
   *
   * @returns Current scope being traversed
   */
  public getCurrentScope(): Scope {
    return this.currentScope;
  }

  /**
   * Get the root (module) scope
   *
   * @returns Root scope of the symbol table
   */
  public getRootScope(): Scope {
    return this.rootScope;
  }

  /**
   * Get a scope by its ID
   *
   * @param id - Scope identifier
   * @returns Scope with the given ID, or undefined if not found
   */
  public getScope(id: string): Scope | undefined {
    return this.scopes.get(id);
  }

  /**
   * Declare a symbol in the current scope
   *
   * @param symbol - Symbol to declare
   * @throws Error if a symbol with the same name already exists in current scope
   */
  public declare(symbol: Symbol): void {
    const existing = this.currentScope.symbols.get(symbol.name);

    if (existing) {
      throw new Error(`Duplicate declaration: '${symbol.name}' is already declared in this scope`);
    }

    this.currentScope.symbols.set(symbol.name, symbol);
  }

  /**
   * Lookup a symbol by name in current scope and parent scopes
   *
   * Searches up the scope chain:
   * 1. Check current scope
   * 2. Check parent scope
   * 3. Continue up to module scope
   *
   * @param name - Symbol name to lookup
   * @returns Symbol if found, undefined otherwise
   */
  public lookup(name: string): Symbol | undefined {
    let scope: Scope | null = this.currentScope;

    // Walk up the scope chain
    while (scope) {
      const symbol = scope.symbols.get(name);
      if (symbol) {
        return symbol;
      }
      scope = scope.parent;
    }

    return undefined;
  }

  /**
   * Lookup a symbol only in the current scope (no parent search)
   *
   * Used for duplicate declaration detection and scope-local queries.
   *
   * @param name - Symbol name to lookup
   * @returns Symbol if found in current scope, undefined otherwise
   */
  public lookupLocal(name: string): Symbol | undefined {
    return this.currentScope.symbols.get(name);
  }

  /**
   * Get all symbols declared in a specific scope
   *
   * @param scope - Scope to query (defaults to current scope)
   * @returns Array of symbols in the scope
   */
  public getSymbolsInScope(scope?: Scope): Symbol[] {
    const targetScope = scope || this.currentScope;
    return Array.from(targetScope.symbols.values());
  }

  /**
   * Get all visible symbols (current scope + all parent scopes)
   *
   * Returns symbols in the current scope chain, useful for
   * completion, diagnostics, and symbol visibility queries.
   *
   * @returns Array of all visible symbols
   */
  public getVisibleSymbols(): Symbol[] {
    const symbols: Symbol[] = [];
    let scope: Scope | null = this.currentScope;

    // Walk up the scope chain and collect all symbols
    while (scope) {
      symbols.push(...Array.from(scope.symbols.values()));
      scope = scope.parent;
    }

    return symbols;
  }

  /**
   * Get total number of scopes in the symbol table
   *
   * @returns Total scope count
   */
  public getScopeCount(): number {
    return this.scopes.size;
  }

  /**
   * Get total number of symbols across all scopes
   *
   * @returns Total symbol count
   */
  public getSymbolCount(): number {
    let count = 0;
    for (const scope of this.scopes.values()) {
      count += scope.symbols.size;
    }
    return count;
  }

  /**
   * Reset symbol table to initial state
   *
   * Clears all scopes and symbols, creates fresh module scope.
   * Used for testing or recompilation.
   */
  public reset(): void {
    this.scopeCounter = 0;
    this.scopes.clear();
    this.rootScope = this.createScope(ScopeKind.Module, null, null);
    this.currentScope = this.rootScope;
  }
}

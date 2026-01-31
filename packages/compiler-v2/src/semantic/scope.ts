/**
 * Scope definitions for Blend65 Compiler v2
 *
 * Scopes represent lexical regions in the program where symbols are defined.
 * The scope tree mirrors the AST structure and enables proper symbol resolution
 * through scope chain lookups.
 *
 * @module semantic/scope
 */

import type { ASTNode } from '../ast/index.js';
import type { Symbol } from './symbol.js';

/**
 * Scope kinds
 *
 * Different scopes have different semantics for symbol visibility and lifetime.
 */
export enum ScopeKind {
  /** Module scope - top level of a file */
  Module = 'module',

  /** Function scope - function body */
  Function = 'function',

  /** Block scope - if/while/for bodies, standalone blocks */
  Block = 'block',

  /** Loop scope - special block scope for loops (for break/continue tracking) */
  Loop = 'loop',
}

/**
 * Scope represents a lexical scope in the program
 *
 * Scopes form a tree structure where:
 * - The root is always a Module scope
 * - Function declarations create Function scopes
 * - Control flow statements (if/while/for) create Block scopes
 * - Loop constructs create Loop scopes (special Block scopes)
 *
 * Symbol lookup traverses up the scope chain from the current scope
 * to the module scope, enabling nested scopes to shadow outer symbols.
 *
 * @example
 * ```
 * Module Scope (global variables, functions)
 *   └── Function Scope (parameters, local variables)
 *         ├── Block Scope (if body)
 *         └── Loop Scope (for body)
 *               └── Block Scope (nested if)
 * ```
 */
export interface Scope {
  /**
   * Unique scope identifier
   *
   * Format: scope_<number> (e.g., scope_0, scope_1, scope_42)
   */
  id: string;

  /** Scope kind determines visibility and symbol lifetime rules */
  kind: ScopeKind;

  /**
   * Parent scope (null only for module scope)
   *
   * Forms the scope chain for symbol lookup.
   */
  parent: Scope | null;

  /** Child scopes (nested functions, blocks, loops) */
  children: Scope[];

  /**
   * Symbols declared in this scope
   *
   * Map from symbol name to Symbol object.
   * Only contains symbols declared directly in this scope, not inherited.
   */
  symbols: Map<string, Symbol>;

  /**
   * AST node that created this scope
   *
   * Useful for error messages and debugging.
   * null for synthetic scopes (like the intrinsics scope).
   */
  node: ASTNode | null;

  /**
   * For function scopes: the function symbol
   *
   * Enables quick lookup of the containing function.
   */
  functionSymbol?: Symbol;

  /**
   * For loop scopes: loop depth (for break/continue validation)
   *
   * Incremented for each nested loop.
   */
  loopDepth?: number;
}

/**
 * Creates a new scope
 *
 * Factory function for creating scopes with proper initialization.
 *
 * @param id - Unique scope identifier
 * @param kind - The scope kind
 * @param parent - Parent scope (null for module scope)
 * @param node - AST node that created this scope
 * @returns A new Scope instance
 */
export function createScope(id: string, kind: ScopeKind, parent: Scope | null, node: ASTNode | null = null): Scope {
  const scope: Scope = {
    id,
    kind,
    parent,
    children: [],
    symbols: new Map(),
    node,
  };

  // Add this scope to parent's children
  if (parent) {
    parent.children.push(scope);
  }

  return scope;
}

/**
 * Creates a module scope (root scope)
 *
 * Module scopes are the root of the scope tree for each file.
 *
 * @param id - Scope identifier
 * @param node - The Program AST node
 * @returns A new module Scope
 */
export function createModuleScope(id: string, node: ASTNode | null = null): Scope {
  return createScope(id, ScopeKind.Module, null, node);
}

/**
 * Creates a function scope
 *
 * Function scopes contain parameters and local variables.
 *
 * @param id - Scope identifier
 * @param parent - Parent scope (module or enclosing function)
 * @param functionSymbol - The function symbol this scope belongs to
 * @param node - The FunctionDecl AST node
 * @returns A new function Scope
 */
export function createFunctionScope(
  id: string,
  parent: Scope,
  functionSymbol: Symbol,
  node: ASTNode | null = null,
): Scope {
  const scope = createScope(id, ScopeKind.Function, parent, node);
  scope.functionSymbol = functionSymbol;
  scope.loopDepth = 0; // Functions reset loop depth
  return scope;
}

/**
 * Creates a block scope
 *
 * Block scopes are created for if/else bodies, standalone blocks, etc.
 *
 * @param id - Scope identifier
 * @param parent - Parent scope
 * @param node - The statement AST node that created this block
 * @returns A new block Scope
 */
export function createBlockScope(id: string, parent: Scope, node: ASTNode | null = null): Scope {
  const scope = createScope(id, ScopeKind.Block, parent, node);

  // Inherit loop depth from parent
  if (parent.loopDepth !== undefined) {
    scope.loopDepth = parent.loopDepth;
  }

  return scope;
}

/**
 * Creates a loop scope
 *
 * Loop scopes are special block scopes that track loop nesting
 * for break/continue validation.
 *
 * @param id - Scope identifier
 * @param parent - Parent scope
 * @param node - The loop statement AST node
 * @returns A new loop Scope
 */
export function createLoopScope(id: string, parent: Scope, node: ASTNode | null = null): Scope {
  const scope = createScope(id, ScopeKind.Loop, parent, node);

  // Increment loop depth
  const parentLoopDepth = parent.loopDepth ?? 0;
  scope.loopDepth = parentLoopDepth + 1;

  return scope;
}

/**
 * Declares a symbol in a scope
 *
 * @param scope - The scope to add the symbol to
 * @param symbol - The symbol to add
 * @returns true if successful, false if name already exists
 */
export function declareSymbol(scope: Scope, symbol: Symbol): boolean {
  if (scope.symbols.has(symbol.name)) {
    return false;
  }
  scope.symbols.set(symbol.name, symbol);
  return true;
}

/**
 * Looks up a symbol in a specific scope (no chain lookup)
 *
 * @param scope - The scope to search
 * @param name - The symbol name
 * @returns The symbol if found, undefined otherwise
 */
export function lookupLocal(scope: Scope, name: string): Symbol | undefined {
  return scope.symbols.get(name);
}

/**
 * Looks up a symbol in the scope chain
 *
 * Traverses from the given scope up to the module scope,
 * returning the first matching symbol found.
 *
 * @param scope - The scope to start the search from
 * @param name - The symbol name
 * @returns The symbol if found in any parent scope, undefined otherwise
 */
export function lookupInChain(scope: Scope, name: string): Symbol | undefined {
  let current: Scope | null = scope;

  while (current !== null) {
    const symbol = current.symbols.get(name);
    if (symbol) {
      return symbol;
    }
    current = current.parent;
  }

  return undefined;
}

/**
 * Checks if the scope is inside a loop
 *
 * Used for validating break/continue statements.
 *
 * @param scope - The scope to check
 * @returns true if inside a loop, false otherwise
 */
export function isInsideLoop(scope: Scope): boolean {
  return (scope.loopDepth ?? 0) > 0;
}

/**
 * Checks if the scope is inside a function
 *
 * Used for validating return statements.
 *
 * @param scope - The scope to check
 * @returns true if inside a function, false otherwise
 */
export function isInsideFunction(scope: Scope): boolean {
  let current: Scope | null = scope;

  while (current !== null) {
    if (current.kind === ScopeKind.Function) {
      return true;
    }
    current = current.parent;
  }

  return false;
}

/**
 * Gets the enclosing function scope
 *
 * Traverses up the scope chain to find the nearest function scope.
 *
 * @param scope - The scope to start from
 * @returns The function scope if found, null otherwise
 */
export function getEnclosingFunctionScope(scope: Scope): Scope | null {
  let current: Scope | null = scope;

  while (current !== null) {
    if (current.kind === ScopeKind.Function) {
      return current;
    }
    current = current.parent;
  }

  return null;
}

/**
 * Gets the enclosing function symbol
 *
 * Useful for type checking return statements.
 *
 * @param scope - The scope to start from
 * @returns The function symbol if inside a function, undefined otherwise
 */
export function getEnclosingFunctionSymbol(scope: Scope): Symbol | undefined {
  const funcScope = getEnclosingFunctionScope(scope);
  return funcScope?.functionSymbol;
}

/**
 * Gets the module scope (root scope)
 *
 * @param scope - Any scope in the tree
 * @returns The module scope
 */
export function getModuleScope(scope: Scope): Scope {
  let current = scope;

  while (current.parent !== null) {
    current = current.parent;
  }

  return current;
}

/**
 * Checks if a scope is a descendant of another
 *
 * @param descendant - The potential descendant scope
 * @param ancestor - The potential ancestor scope
 * @returns true if descendant is nested within ancestor
 */
export function isDescendantOf(descendant: Scope, ancestor: Scope): boolean {
  let current: Scope | null = descendant.parent;

  while (current !== null) {
    if (current === ancestor) {
      return true;
    }
    current = current.parent;
  }

  return false;
}

/**
 * Gets all symbols in a scope chain (from current scope to module)
 *
 * Later scopes (closer to current) override earlier ones with same name.
 *
 * @param scope - The scope to collect symbols from
 * @returns Map of all visible symbols
 */
export function getAllVisibleSymbols(scope: Scope): Map<string, Symbol> {
  const result = new Map<string, Symbol>();
  const scopes: Scope[] = [];

  // Collect all scopes from module to current
  let current: Scope | null = scope;
  while (current !== null) {
    scopes.unshift(current); // Add to front so module scope is first
    current = current.parent;
  }

  // Process from module scope down, letting inner scopes override
  for (const s of scopes) {
    for (const [name, symbol] of s.symbols) {
      result.set(name, symbol);
    }
  }

  return result;
}

/**
 * Gets the depth of a scope in the tree
 *
 * Module scope has depth 0, its children have depth 1, etc.
 *
 * @param scope - The scope to measure
 * @returns The depth in the scope tree
 */
export function getScopeDepth(scope: Scope): number {
  let depth = 0;
  let current: Scope | null = scope;

  while (current.parent !== null) {
    depth++;
    current = current.parent;
  }

  return depth;
}

/**
 * Type guard: checks if scope is a module scope
 */
export function isModuleScope(scope: Scope): boolean {
  return scope.kind === ScopeKind.Module;
}

/**
 * Type guard: checks if scope is a function scope
 */
export function isFunctionScope(scope: Scope): boolean {
  return scope.kind === ScopeKind.Function;
}

/**
 * Type guard: checks if scope is a block scope
 */
export function isBlockScope(scope: Scope): boolean {
  return scope.kind === ScopeKind.Block;
}

/**
 * Type guard: checks if scope is a loop scope
 */
export function isLoopScope(scope: Scope): boolean {
  return scope.kind === ScopeKind.Loop;
}
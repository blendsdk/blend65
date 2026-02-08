/**
 * Symbol Table - Scope Types
 *
 * Defines types and enums for scopes in the symbol table.
 * Scopes represent lexical regions where symbols are declared and visible.
 */

import type { ASTNode } from '../ast/base.js';
import type { Symbol } from './symbol.js';

/**
 * Scope kinds in Blend65
 *
 * Note: Blend65 uses function-scoped variables (like JavaScript's var),
 * NOT block-scoped variables. Control flow structures (if, while, for)
 * do NOT create new scopes.
 */
export enum ScopeKind {
  /** Module scope - top-level declarations */
  Module = 'Module',

  /** Function scope - function body and parameters */
  Function = 'Function',
}

/**
 * Scope metadata (extensible for future analysis passes)
 */
export interface ScopeMetadata {
  /** Scope name (for debugging and error messages) */
  name?: string;

  /** Custom metadata for analysis passes */
  [key: string]: unknown;
}

/**
 * Represents a scope in the program
 *
 * Scopes form a tree structure with module scope at the root
 * and function scopes as children. Blend65 uses function-scoped
 * variables, so control flow blocks do NOT create scopes.
 */
export interface Scope {
  /** Unique scope identifier */
  id: string;

  /** Scope kind (Module or Function) */
  kind: ScopeKind;

  /** Parent scope (null for module scope) */
  parent: Scope | null;

  /** Child scopes (function scopes if this is module scope) */
  children: Scope[];

  /** Symbols declared directly in this scope */
  symbols: Map<string, Symbol>;

  /** AST node that created this scope (Program for module, FunctionDecl for function) */
  node: ASTNode;

  /** Scope metadata */
  metadata?: ScopeMetadata;
}

/**
 * Context Management for AST Walker
 *
 * Provides context-aware traversal with scope tracking, metadata storage,
 * and rich query capabilities for semantic analysis phases.
 *
 * This extends the base walker with contextual information about:
 * - Current scope (function, loop, block)
 * - Parent scopes and nesting
 * - Custom metadata per scope
 * - Scope-specific data accumulation
 */

import { ASTWalker } from './base.js';
import { ASTNode } from '../base.js';
import type {
  FunctionDecl,
  WhileStatement,
  ForStatement,
  MatchStatement,
  BlockStatement,
  Program,
} from '../nodes.js';

/**
 * Types of scopes in Blend65
 */
export enum ContextType {
  /** Root program scope */
  PROGRAM = 'program',
  /** Function scope */
  FUNCTION = 'function',
  /** Loop scope (while, for, match) */
  LOOP = 'loop',
  /** Block scope (explicit blocks) */
  BLOCK = 'block',
  /** Match case scope */
  MATCH_CASE = 'match_case',
}

/**
 * Information about a scope/context in the stack
 *
 * Each context represents a scope boundary and can store:
 * - Type of scope (function, loop, etc.)
 * - Reference to the AST node that created it
 * - Custom metadata (extensible for different analysis passes)
 */
export interface ContextInfo {
  /** Type of this context */
  type: ContextType;
  /** AST node that created this context */
  node: ASTNode;
  /** Custom metadata storage (analysis-specific) */
  metadata: Map<string, unknown>;
}

/**
 * WalkerContext - Context stack manager for semantic analysis
 *
 * Manages a stack of contexts during AST traversal, tracking:
 * - Scope boundaries (function, loop, block)
 * - Nesting relationships
 * - Custom metadata per scope
 * - Scope-specific queries
 *
 * **Design Philosophy:**
 * - Separate from parser's ScopeManager (different purpose)
 * - Parser's ScopeManager: Validation during parsing
 * - WalkerContext: Analysis after parsing
 *
 * **Key Features:**
 * - Generic metadata storage (any analysis can use it)
 * - Query methods for context checking
 * - Parent context access
 * - Scope-specific data accumulation
 *
 * **Usage:**
 * ```typescript
 * const context = new WalkerContext();
 *
 * // Entering function
 * context.enterContext(ContextType.FUNCTION, functionNode);
 * context.setMetadata('returnType', 'word');
 *
 * // Query context
 * const inFunction = context.isInFunction(); // true
 * const returnType = context.getMetadata('returnType'); // 'word'
 *
 * // Exit function
 * context.exitContext();
 * ```
 */
export class WalkerContext {
  /**
   * Stack of contexts (innermost is at end)
   */
  protected contexts: ContextInfo[] = [];

  /**
   * Enter a new context
   *
   * Pushes a new context onto the stack for the given scope type and node.
   * The context has empty metadata initially.
   *
   * @param type Type of context being entered
   * @param node AST node that creates this context
   */
  public enterContext(type: ContextType, node: ASTNode): void {
    this.contexts.push({
      type,
      node,
      metadata: new Map<string, unknown>(),
    });
  }

  /**
   * Exit the current context
   *
   * Removes the innermost context from the stack.
   * Returns the context info that was removed (useful for validation).
   *
   * @returns The context that was exited, or undefined if stack empty
   */
  public exitContext(): ContextInfo | undefined {
    return this.contexts.pop();
  }

  /**
   * Get the current (innermost) context
   *
   * @returns Current context or undefined if no contexts
   */
  public getCurrentContext(): ContextInfo | undefined {
    return this.contexts.length > 0 ? this.contexts[this.contexts.length - 1] : undefined;
  }

  /**
   * Get parent context (one level up)
   *
   * @returns Parent context or undefined if at root
   */
  public getParentContext(): ContextInfo | undefined {
    return this.contexts.length >= 2 ? this.contexts[this.contexts.length - 2] : undefined;
  }

  /**
   * Get ancestor context at specific level
   *
   * @param levels How many levels up (1=parent, 2=grandparent, etc.)
   * @returns Ancestor context or undefined if doesn't exist
   */
  public getAncestorContext(levels: number): ContextInfo | undefined {
    const index = this.contexts.length - 1 - levels;
    return index >= 0 ? this.contexts[index] : undefined;
  }

  /**
   * Find nearest context of specific type
   *
   * Searches from current context backwards to find the first context
   * matching the given type.
   *
   * @param type Context type to search for
   * @returns First matching context or undefined if not found
   *
   * @example
   * ```typescript
   * // Find containing function
   * const functionCtx = context.findContext(ContextType.FUNCTION);
   * if (functionCtx) {
   *   const functionNode = functionCtx.node as FunctionDecl;
   * }
   * ```
   */
  public findContext(type: ContextType): ContextInfo | undefined {
    for (let i = this.contexts.length - 1; i >= 0; i--) {
      if (this.contexts[i].type === type) {
        return this.contexts[i];
      }
    }
    return undefined;
  }

  /**
   * Find all contexts of specific type
   *
   * Returns array of all contexts matching the type, from outermost to innermost.
   *
   * @param type Context type to search for
   * @returns Array of matching contexts (empty if none found)
   */
  public findAllContexts(type: ContextType): ContextInfo[] {
    return this.contexts.filter(ctx => ctx.type === type);
  }

  /**
   * Check if currently in specific context type
   *
   * @param type Context type to check for
   * @returns True if any context of this type exists in stack
   */
  public isInContext(type: ContextType): boolean {
    return this.contexts.some(ctx => ctx.type === type);
  }

  /**
   * Check if currently in function context
   *
   * @returns True if inside any function
   */
  public isInFunction(): boolean {
    return this.isInContext(ContextType.FUNCTION);
  }

  /**
   * Check if currently in loop context
   *
   * @returns True if inside any loop
   */
  public isInLoop(): boolean {
    return this.isInContext(ContextType.LOOP);
  }

  /**
   * Check if in loop without crossing function boundary
   *
   * Returns true only if there's a loop context and no function context
   * between current position and that loop.
   *
   * Useful for validating break/continue statements.
   *
   * @returns True if in loop AND no function boundary crossed
   */
  public isInLoopWithoutFunctionBoundary(): boolean {
    for (let i = this.contexts.length - 1; i >= 0; i--) {
      const ctx = this.contexts[i];
      if (ctx.type === ContextType.LOOP) {
        return true;
      }
      if (ctx.type === ContextType.FUNCTION) {
        return false;
      }
    }
    return false;
  }

  /**
   * Get context depth (number of contexts in stack)
   *
   * @returns Number of active contexts
   */
  public getDepth(): number {
    return this.contexts.length;
  }

  /**
   * Get nesting level for specific context type
   *
   * Counts how many contexts of the given type are active.
   *
   * @param type Context type to count
   * @returns Number of active contexts of this type
   *
   * @example
   * ```typescript
   * // Get loop nesting depth
   * const loopDepth = context.getNestingLevel(ContextType.LOOP);
   * console.log(`Nested ${loopDepth} levels deep in loops`);
   * ```
   */
  public getNestingLevel(type: ContextType): number {
    return this.contexts.filter(ctx => ctx.type === type).length;
  }

  // ============================================
  // METADATA MANAGEMENT
  // ============================================

  /**
   * Set metadata on current context
   *
   * Stores arbitrary data on the innermost context.
   * Can be retrieved later with getMetadata().
   *
   * @param key Metadata key
   * @param value Metadata value
   *
   * @example
   * ```typescript
   * // Store function return type
   * context.enterContext(ContextType.FUNCTION, node);
   * context.setMetadata('returnType', 'word');
   * context.setMetadata('hasReturn', false);
   * ```
   */
  public setMetadata(key: string, value: unknown): void {
    const current = this.getCurrentContext();
    if (current) {
      current.metadata.set(key, value);
    }
  }

  /**
   * Get metadata from current context
   *
   * Retrieves data stored on the innermost context.
   * Returns undefined if key doesn't exist or no context.
   *
   * @param key Metadata key
   * @returns Metadata value or undefined
   */
  public getMetadata(key: string): unknown {
    const current = this.getCurrentContext();
    return current?.metadata.get(key);
  }

  /**
   * Get metadata with type assertion
   *
   * Type-safe metadata retrieval with generic type parameter.
   *
   * @param key Metadata key
   * @returns Metadata value cast to T, or undefined
   *
   * @example
   * ```typescript
   * const returnType = context.getMetadataAs<string>('returnType');
   * const hasReturn = context.getMetadataAs<boolean>('hasReturn');
   * ```
   */
  public getMetadataAs<T>(key: string): T | undefined {
    return this.getMetadata(key) as T | undefined;
  }

  /**
   * Check if metadata key exists on current context
   *
   * @param key Metadata key
   * @returns True if key exists
   */
  public hasMetadata(key: string): boolean {
    const current = this.getCurrentContext();
    return current?.metadata.has(key) ?? false;
  }

  /**
   * Set metadata on specific context type
   *
   * Finds nearest context of given type and sets metadata on it.
   * Does nothing if context type not found.
   *
   * @param contextType Context type to target
   * @param key Metadata key
   * @param value Metadata value
   *
   * @example
   * ```typescript
   * // Set metadata on containing function (not current context)
   * context.setMetadataOn(ContextType.FUNCTION, 'hasReturn', true);
   * ```
   */
  public setMetadataOn(contextType: ContextType, key: string, value: unknown): void {
    const ctx = this.findContext(contextType);
    if (ctx) {
      ctx.metadata.set(key, value);
    }
  }

  /**
   * Get metadata from specific context type
   *
   * Finds nearest context of given type and retrieves metadata.
   * Returns undefined if context or key not found.
   *
   * @param contextType Context type to search
   * @param key Metadata key
   * @returns Metadata value or undefined
   */
  public getMetadataFrom(contextType: ContextType, key: string): unknown {
    const ctx = this.findContext(contextType);
    return ctx?.metadata.get(key);
  }

  /**
   * Get metadata from specific context with type assertion
   *
   * @param contextType Context type to search
   * @param key Metadata key
   * @returns Metadata value cast to T, or undefined
   */
  public getMetadataFromAs<T>(contextType: ContextType, key: string): T | undefined {
    return this.getMetadataFrom(contextType, key) as T | undefined;
  }

  // ============================================
  // DEBUGGING AND TESTING
  // ============================================

  /**
   * Reset all contexts
   *
   * Clears the context stack. Useful for testing or error recovery.
   */
  public reset(): void {
    this.contexts = [];
  }

  /**
   * Get snapshot of context stack for debugging
   *
   * Returns array of context types from outermost to innermost.
   *
   * @returns Array of context type names
   *
   * @example
   * ```typescript
   * const stack = context.getStack();
   * console.log('Context:', stack.join(' → '));
   * // Output: "program → function → loop"
   * ```
   */
  public getStack(): string[] {
    return this.contexts.map(ctx => ctx.type);
  }

  /**
   * Get detailed snapshot of context stack
   *
   * Returns array of objects with full context information.
   * Useful for debugging and testing.
   *
   * @returns Array of context info objects
   */
  public getDetailedStack(): Array<{
    type: string;
    nodeType: string;
    metadata: Record<string, unknown>;
  }> {
    return this.contexts.map(ctx => ({
      type: ctx.type,
      nodeType: ctx.node.getNodeType(),
      metadata: Object.fromEntries(ctx.metadata.entries()),
    }));
  }
}

/**
 * Context-Aware Walker
 *
 * Extends ASTWalker with automatic context management.
 * Automatically enters/exits contexts as AST is traversed.
 *
 * **Features:**
 * - Automatic context tracking for functions, loops, blocks
 * - Access to WalkerContext at any point
 * - Metadata storage per scope
 * - Rich context queries
 *
 * **Usage:**
 * ```typescript
 * class MyAnalyzer extends ContextWalker {
 *   visitFunctionDecl(node: FunctionDecl): void {
 *     // Context automatically entered before this is called
 *     this.context.setMetadata('returnType', node.getReturnType());
 *
 *     super.visitFunctionDecl(node); // Visit body
 *
 *     // Context automatically exited after this returns
 *   }
 * }
 * ```
 */
export abstract class ContextWalker extends ASTWalker {
  /**
   * Context manager for scope tracking
   *
   * Public to allow subclasses (including test walkers) to access context information.
   */
  public context: WalkerContext;

  /**
   * Create a new context-aware walker
   */
  constructor() {
    super();
    this.context = new WalkerContext();
  }

  /**
   * Initialize walker for new traversal
   *
   * Overrides base walk() to reset context before traversal.
   */
  public walk(node: ASTNode): void {
    this.context.reset();
    super.walk(node);
  }

  // ============================================
  // CONTEXT-AWARE VISIT METHODS
  // ============================================
  //
  // These methods automatically enter/exit contexts for scope-creating nodes.
  // Subclasses can override and call super to get automatic context management.

  /**
   * Visit Program with context
   *
   * Automatically creates PROGRAM context.
   */
  visitProgram(node: Program): void {
    if (this.shouldStop) return;

    this.context.enterContext(ContextType.PROGRAM, node);
    this.enterNode(node);

    // Visit children (same as base walker)
    node.getModule().accept(this);
    if (!this.shouldSkip && !this.shouldStop) {
      for (const decl of node.getDeclarations()) {
        if (this.shouldStop) break;
        decl.accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
    this.context.exitContext();
  }

  /**
   * Visit Function with context
   *
   * Automatically creates FUNCTION context.
   * Handles stub functions (which have no body).
   */
  visitFunctionDecl(node: FunctionDecl): void {
    if (this.shouldStop) return;

    this.context.enterContext(ContextType.FUNCTION, node);
    this.enterNode(node);

    // Visit children (if present - stub functions have null body)
    if (!this.shouldSkip && !this.shouldStop) {
      const body = node.getBody();
      if (body) {
        for (const stmt of body) {
          if (this.shouldStop) break;
          stmt.accept(this);
        }
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
    this.context.exitContext();
  }

  /**
   * Visit While statement with context
   *
   * Automatically creates LOOP context.
   */
  visitWhileStatement(node: WhileStatement): void {
    if (this.shouldStop) return;

    // Visit condition before entering loop context
    this.enterNode(node);
    node.getCondition().accept(this);

    // Enter loop context for body
    this.context.enterContext(ContextType.LOOP, node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of node.getBody()) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
    }

    this.context.exitContext();
    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit For statement with context
   *
   * Automatically creates LOOP context.
   */
  visitForStatement(node: ForStatement): void {
    if (this.shouldStop) return;

    // Visit start/end before entering loop context
    this.enterNode(node);
    node.getStart().accept(this);
    if (!this.shouldStop) {
      node.getEnd().accept(this);
    }

    // Enter loop context for body
    this.context.enterContext(ContextType.LOOP, node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of node.getBody()) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
    }

    this.context.exitContext();
    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Match statement with context
   *
   * Automatically creates LOOP context (match can be exited with break).
   */
  visitMatchStatement(node: MatchStatement): void {
    if (this.shouldStop) return;

    // Visit value before entering match context
    this.enterNode(node);
    node.getValue().accept(this);

    // Enter loop context (match acts like loop for break)
    this.context.enterContext(ContextType.LOOP, node);

    if (!this.shouldSkip && !this.shouldStop) {
      // Visit cases
      for (const caseClause of node.getCases()) {
        if (this.shouldStop) break;

        // Enter case context
        this.context.enterContext(ContextType.MATCH_CASE, node);

        caseClause.value.accept(this);
        if (!this.shouldStop) {
          for (const stmt of caseClause.body) {
            if (this.shouldStop) break;
            stmt.accept(this);
          }
        }

        this.context.exitContext(); // Exit case context
      }

      // Visit default case
      if (!this.shouldStop) {
        const defaultCase = node.getDefaultCase();
        if (defaultCase) {
          this.context.enterContext(ContextType.MATCH_CASE, node);

          for (const stmt of defaultCase) {
            if (this.shouldStop) break;
            stmt.accept(this);
          }

          this.context.exitContext(); // Exit case context
        }
      }
    }

    this.context.exitContext(); // Exit match context
    this.shouldSkip = false;
    this.exitNode(node);
  }

  /**
   * Visit Block statement with context
   *
   * Automatically creates BLOCK context.
   */
  visitBlockStatement(node: BlockStatement): void {
    if (this.shouldStop) return;

    this.context.enterContext(ContextType.BLOCK, node);
    this.enterNode(node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of node.getStatements()) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
    }

    this.shouldSkip = false;
    this.exitNode(node);
    this.context.exitContext();
  }
}

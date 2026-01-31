/**
 * Context Management for AST Walker v2
 *
 * Provides context-aware traversal with scope tracking, metadata storage,
 * and rich query capabilities for semantic analysis phases.
 */

import { ASTWalker } from './base.js';
import { ASTNode } from '../base.js';
import type {
  FunctionDecl,
  WhileStatement,
  ForStatement,
  DoWhileStatement,
  SwitchStatement,
  MatchStatement,
  BlockStatement,
  Program,
} from '../index.js';

/**
 * Types of scopes in Blend65
 */
export enum ContextType {
  PROGRAM = 'program',
  FUNCTION = 'function',
  LOOP = 'loop',
  BLOCK = 'block',
  MATCH_CASE = 'match_case',
}

/**
 * Information about a scope/context in the stack
 */
export interface ContextInfo {
  type: ContextType;
  node: ASTNode;
  metadata: Map<string, unknown>;
}

/**
 * WalkerContext - Context stack manager for semantic analysis
 */
export class WalkerContext {
  protected contexts: ContextInfo[] = [];

  public enterContext(type: ContextType, node: ASTNode): void {
    this.contexts.push({
      type,
      node,
      metadata: new Map<string, unknown>(),
    });
  }

  public exitContext(): ContextInfo | undefined {
    return this.contexts.pop();
  }

  public getCurrentContext(): ContextInfo | undefined {
    return this.contexts.length > 0 ? this.contexts[this.contexts.length - 1] : undefined;
  }

  public getParentContext(): ContextInfo | undefined {
    return this.contexts.length >= 2 ? this.contexts[this.contexts.length - 2] : undefined;
  }

  public getAncestorContext(levels: number): ContextInfo | undefined {
    const index = this.contexts.length - 1 - levels;
    return index >= 0 ? this.contexts[index] : undefined;
  }

  public findContext(type: ContextType): ContextInfo | undefined {
    for (let i = this.contexts.length - 1; i >= 0; i--) {
      if (this.contexts[i].type === type) {
        return this.contexts[i];
      }
    }
    return undefined;
  }

  public findAllContexts(type: ContextType): ContextInfo[] {
    return this.contexts.filter(ctx => ctx.type === type);
  }

  public isInContext(type: ContextType): boolean {
    return this.contexts.some(ctx => ctx.type === type);
  }

  public isInFunction(): boolean {
    return this.isInContext(ContextType.FUNCTION);
  }

  public isInLoop(): boolean {
    return this.isInContext(ContextType.LOOP);
  }

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

  public getDepth(): number {
    return this.contexts.length;
  }

  public getNestingLevel(type: ContextType): number {
    return this.contexts.filter(ctx => ctx.type === type).length;
  }

  // Metadata management
  public setMetadata(key: string, value: unknown): void {
    const current = this.getCurrentContext();
    if (current) {
      current.metadata.set(key, value);
    }
  }

  public getMetadata(key: string): unknown {
    const current = this.getCurrentContext();
    return current?.metadata.get(key);
  }

  public getMetadataAs<T>(key: string): T | undefined {
    return this.getMetadata(key) as T | undefined;
  }

  public hasMetadata(key: string): boolean {
    const current = this.getCurrentContext();
    return current?.metadata.has(key) ?? false;
  }

  public setMetadataOn(contextType: ContextType, key: string, value: unknown): void {
    const ctx = this.findContext(contextType);
    if (ctx) {
      ctx.metadata.set(key, value);
    }
  }

  public getMetadataFrom(contextType: ContextType, key: string): unknown {
    const ctx = this.findContext(contextType);
    return ctx?.metadata.get(key);
  }

  public getMetadataFromAs<T>(contextType: ContextType, key: string): T | undefined {
    return this.getMetadataFrom(contextType, key) as T | undefined;
  }

  public reset(): void {
    this.contexts = [];
  }

  public getStack(): string[] {
    return this.contexts.map(ctx => ctx.type);
  }

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
 */
export abstract class ContextWalker extends ASTWalker {
  public context: WalkerContext;

  constructor() {
    super();
    this.context = new WalkerContext();
  }

  public walk(node: ASTNode): void {
    this.context.reset();
    super.walk(node);
  }

  visitProgram(node: Program): void {
    if (this.shouldStop) return;

    this.context.enterContext(ContextType.PROGRAM, node);
    this.enterNode(node);

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

  visitFunctionDecl(node: FunctionDecl): void {
    if (this.shouldStop) return;

    this.context.enterContext(ContextType.FUNCTION, node);
    this.enterNode(node);

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

  visitWhileStatement(node: WhileStatement): void {
    if (this.shouldStop) return;

    this.enterNode(node);
    node.getCondition().accept(this);

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

  visitForStatement(node: ForStatement): void {
    if (this.shouldStop) return;

    this.enterNode(node);
    node.getStart().accept(this);
    if (!this.shouldStop) {
      node.getEnd().accept(this);
    }

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

  visitDoWhileStatement(node: DoWhileStatement): void {
    if (this.shouldStop) return;

    this.enterNode(node);
    this.context.enterContext(ContextType.LOOP, node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const stmt of node.getBody()) {
        if (this.shouldStop) break;
        stmt.accept(this);
      }
    }

    this.context.exitContext();

    if (!this.shouldStop) {
      node.getCondition().accept(this);
    }

    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitSwitchStatement(node: SwitchStatement): void {
    if (this.shouldStop) return;

    this.enterNode(node);
    node.getValue().accept(this);

    this.context.enterContext(ContextType.LOOP, node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const caseClause of node.getCases()) {
        if (this.shouldStop) break;

        this.context.enterContext(ContextType.MATCH_CASE, node);

        caseClause.value.accept(this);
        if (!this.shouldStop) {
          for (const stmt of caseClause.body) {
            if (this.shouldStop) break;
            stmt.accept(this);
          }
        }

        this.context.exitContext();
      }

      if (!this.shouldStop) {
        const defaultCase = node.getDefaultCase();
        if (defaultCase) {
          this.context.enterContext(ContextType.MATCH_CASE, node);

          for (const stmt of defaultCase) {
            if (this.shouldStop) break;
            stmt.accept(this);
          }

          this.context.exitContext();
        }
      }
    }

    this.context.exitContext();
    this.shouldSkip = false;
    this.exitNode(node);
  }

  visitMatchStatement(node: MatchStatement): void {
    if (this.shouldStop) return;

    this.enterNode(node);
    node.getValue().accept(this);

    this.context.enterContext(ContextType.LOOP, node);

    if (!this.shouldSkip && !this.shouldStop) {
      for (const caseClause of node.getCases()) {
        if (this.shouldStop) break;

        this.context.enterContext(ContextType.MATCH_CASE, node);

        caseClause.value.accept(this);
        if (!this.shouldStop) {
          for (const stmt of caseClause.body) {
            if (this.shouldStop) break;
            stmt.accept(this);
          }
        }

        this.context.exitContext();
      }

      if (!this.shouldStop) {
        const defaultCase = node.getDefaultCase();
        if (defaultCase) {
          this.context.enterContext(ContextType.MATCH_CASE, node);

          for (const stmt of defaultCase) {
            if (this.shouldStop) break;
            stmt.accept(this);
          }

          this.context.exitContext();
        }
      }
    }

    this.context.exitContext();
    this.shouldSkip = false;
    this.exitNode(node);
  }

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
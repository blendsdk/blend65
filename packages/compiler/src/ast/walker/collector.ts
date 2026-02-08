/**
 * AST Collector Infrastructure for Blend65 Compiler v2
 *
 * Provides reusable collectors that gather information from AST during traversal.
 * Built on top of ASTWalker for automatic recursion and context tracking.
 */

import { ASTWalker } from './base.js';
import { ASTNode } from '../base.js';

/**
 * Base class for collectors that gather information from AST
 *
 * Generic collector that maintains a collection of items of type T.
 * Subclasses override visit methods to add items to the collection
 * during traversal.
 *
 * @template T - The type of items being collected
 */
export abstract class ASTCollector<T> extends ASTWalker {
  /**
   * Collection of gathered items
   */
  protected items: T[] = [];

  /**
   * Run collector on AST and return results
   *
   * @param node - Root node to start collection from
   * @returns Array of collected items
   */
  public run(node: ASTNode): T[] {
    this.items = [];
    this.walk(node);
    return this.getResults();
  }

  /**
   * Collect an item during traversal
   */
  protected collect(item: T): void {
    this.items.push(item);
  }

  /**
   * Get current collection results
   */
  protected getResults(): T[] {
    return [...this.items];
  }

  /**
   * Get count of collected items
   */
  protected getCount(): number {
    return this.items.length;
  }

  /**
   * Clear collected items
   */
  protected clear(): void {
    this.items = [];
  }
}

/**
 * Specialized collector for finding nodes matching a predicate
 */
export class NodeFinder extends ASTCollector<ASTNode> {
  protected predicate: (node: ASTNode) => boolean;

  constructor(predicate: (node: ASTNode) => boolean) {
    super();
    this.predicate = predicate;
  }

  protected enterNode(node: ASTNode): void {
    super.enterNode(node);
    if (this.predicate(node)) {
      this.collect(node);
    }
  }

  /**
   * Static helper for one-off searches
   */
  public static find(root: ASTNode, predicate: (node: ASTNode) => boolean): ASTNode[] {
    const finder = new NodeFinder(predicate);
    return finder.run(root);
  }
}

/**
 * Specialized collector for counting nodes by type
 */
export class NodeCounter extends ASTWalker {
  protected counts: Map<string, number> = new Map();

  public run(node: ASTNode): Map<string, number> {
    this.counts = new Map();
    this.walk(node);
    return this.getCounts();
  }

  protected enterNode(node: ASTNode): void {
    super.enterNode(node);
    const nodeType = node.getNodeType();
    const currentCount = this.counts.get(nodeType) || 0;
    this.counts.set(nodeType, currentCount + 1);
  }

  public getCounts(): Map<string, number> {
    return new Map(this.counts);
  }

  public getCountForType(nodeType: string): number {
    return this.counts.get(nodeType) || 0;
  }

  public getTotalCount(): number {
    let total = 0;
    for (const count of this.counts.values()) {
      total += count;
    }
    return total;
  }

  public static count(root: ASTNode): Map<string, number> {
    const counter = new NodeCounter();
    return counter.run(root);
  }
}
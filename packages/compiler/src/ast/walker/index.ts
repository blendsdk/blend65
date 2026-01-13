/**
 * AST Walker Infrastructure
 *
 * Provides reusable, type-safe AST traversal mechanisms.
 */

export { ASTWalker } from './base.js';
export { ASTTransformer } from './transformer.js';
export { ASTCollector, NodeFinder, NodeCounter } from './collector.js';
export { WalkerContext, ContextWalker, ContextType } from './context.js';
export type { ContextInfo } from './context.js';

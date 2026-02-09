/**
 * Optimizer Analysis Module
 *
 * Provides analysis infrastructure for optimization passes:
 * - CallGraph: Function call relationship analysis
 * - LoopTree: Loop nesting and hierarchy analysis
 *
 * Analysis passes compute information used by optimization passes
 * but do not modify the program themselves.
 *
 * @module optimizer/analysis
 */

export { CallGraph } from './call-graph.js';
export { LoopTree } from './loop-tree.js';
export type { LoopInfo } from './loop-tree.js';

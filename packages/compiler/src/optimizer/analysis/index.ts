/**
 * Optimizer Analysis Module
 *
 * Provides analysis infrastructure for inter-procedural optimization:
 * - CallGraph: Function call relationship analysis
 * - (Future) LoopTree: Loop nesting analysis
 *
 * Analysis passes compute information used by optimization passes
 * but do not modify the program themselves.
 *
 * @module optimizer/analysis
 */

export { CallGraph } from './call-graph.js';

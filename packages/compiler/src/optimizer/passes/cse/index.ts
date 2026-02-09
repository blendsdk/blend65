/**
 * CSE Pass Module Index
 *
 * Exports the Common Subexpression Elimination pass and its types.
 *
 * @module optimizer/passes/cse
 */

export { CSEPass } from './cse.js';
export type { ExpressionKey, TrackedExpression, AccumulatorState, CSEStats } from './types.js';

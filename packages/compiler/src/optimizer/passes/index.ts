/**
 * Optimization Passes Index
 *
 * Exports all optimization passes for registration with PassManager.
 *
 * @module optimizer/passes
 */

// ============================================================================
// Phase 2: Dead Code Elimination
// ============================================================================

export { DCEPass } from './dce.js';

// ============================================================================
// Phase 3: Constant Folding
// ============================================================================

export { ConstantFoldPass } from './constant-fold.js';

// ============================================================================
// Phase 4: Constant Propagation
// ============================================================================

export { ConstantPropPass } from './constant-prop.js';

// ============================================================================
// Phase 5: Copy Propagation
// ============================================================================

export { CopyPropPass } from './copy-prop.js';

// ============================================================================
// Phase 6: IL Peephole
// ============================================================================

export { ILPeepholePass } from './il-peephole.js';

// ============================================================================
// Program-Level Passes
// ============================================================================

export { DeadFunctionElimPass } from './dead-function-elim.js';

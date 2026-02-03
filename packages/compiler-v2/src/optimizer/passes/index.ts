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
// Phase 3: Constant Folding (to be added)
// ============================================================================

// export { ConstantFoldPass } from './constant-fold.js';

// ============================================================================
// Phase 4: Constant Propagation (to be added)
// ============================================================================

// export { ConstantPropPass } from './constant-prop.js';

// ============================================================================
// Phase 5: Copy Propagation (to be added)
// ============================================================================

// export { CopyPropPass } from './copy-prop.js';

// ============================================================================
// Phase 6: IL Peephole (to be added)
// ============================================================================

// export { ILPeepholePass } from './il-peephole.js';
/**
 * SSA (Static Single Assignment) Construction Module
 *
 * This module provides SSA form construction for IL functions.
 * SSA form is a key requirement for the IL generator as it enables:
 *
 * 1. Clean dataflow analysis - Each variable defined exactly once
 * 2. Efficient optimizations - Dead code elimination, constant propagation, etc.
 * 3. Register allocation - Better live range analysis for A/X/Y allocation
 * 4. Phi functions - Explicit merge points for variables from different paths
 *
 * **SSA Construction Process:**
 * ```
 * 1. Compute dominator tree from CFG
 * 2. Compute dominance frontiers
 * 3. Place phi functions at dominance frontiers
 * 4. Rename variables to unique versions (x → x.0, x.1, x.2, ...)
 * 5. Verify SSA invariants
 * ```
 *
 * **Key Invariants of SSA Form:**
 * - Each variable is assigned exactly once (single assignment)
 * - Every use of a variable is dominated by its definition
 * - Phi functions at control flow merge points select correct version
 *
 * @module il/ssa
 *
 * @example
 * ```typescript
 * import { SSAConstructor, verifySSA } from './ssa/index.js';
 *
 * // Convert function to SSA form
 * const constructor = new SSAConstructor();
 * const result = constructor.construct(ilFunction);
 *
 * if (result.success) {
 *   console.log(`Phi functions placed: ${result.stats.phiCount}`);
 *   console.log(`Variable versions created: ${result.stats.versionsCreated}`);
 * }
 *
 * // Verify SSA invariants
 * const verification = verifySSA(ilFunction);
 * if (!verification.valid) {
 *   console.error('SSA verification failed:', verification.errors);
 * }
 * ```
 */

// =============================================================================
// Dominator Tree (Sessions 2-4)
// =============================================================================

export {
  type DominatorInfo,
  DominatorTree,
  computeDominators,
  computeIntersection,
} from './dominators.js';

// =============================================================================
// Dominance Frontiers (Sessions 5-6)
// =============================================================================

export { DominanceFrontier, computeFrontiers } from './frontiers.js';

// =============================================================================
// Phi Placement (Sessions 7-9)
// =============================================================================

export {
  type VariableDefInfo,
  type PhiPlacementInfo,
  type PhiPlacementResult,
  type PhiPlacementStats,
  PhiPlacer,
} from './phi.js';

// =============================================================================
// Variable Renaming (Session 10)
// =============================================================================

export {
  type SSAName,
  type RenamedInstruction,
  type SSAPhiOperand,
  type RenamedPhi,
  type SSARenamingResult,
  type SSARenamingStats,
  VersionStackManager,
  SSARenamer,
  formatSSAName,
  parseSSAName,
  renameVariables,
} from './renaming.js';

// =============================================================================
// SSA Verification (Session 11)
// =============================================================================

export {
  SSAVerificationErrorCode,
  type SSAVerificationError,
  type SSAVerificationResult,
  type SSAVerificationStats,
  SSAVerifier,
  verifySSA,
} from './verification.js';

// =============================================================================
// SSA Constructor (Session 12)
// =============================================================================

export {
  SSAConstructionPhase,
  type SSAConstructionError,
  type SSAConstructionStats,
  type SSAConstructionResult,
  type SSAConstructionOptions,
  SSAConstructor,
  constructSSA,
} from './constructor.js';
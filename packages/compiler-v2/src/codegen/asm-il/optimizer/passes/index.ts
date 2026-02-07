/**
 * ASM-IL Optimization Passes
 *
 * All concrete optimization passes for the ASM-IL optimizer.
 * Each pass implements the AsmOptimizationPass interface and targets
 * specific patterns in 6502 assembly code.
 *
 * @module codegen/asm-il/optimizer/passes
 */

// Phase 3: Core Passes (O1)
export { FlagPatternsPass } from './flag-patterns.js';
export { StoreLoadPass } from './store-load.js';

// Phase 4: Standard Passes (O2)
export { BranchOptPass } from './branch-opt.js';
export { TransferOptPass } from './transfer-opt.js';

// Phase 5: Advanced Passes (O3)
// export { ZPPromotionPass } from './zp-promotion.js';
// export { Strength6502Pass } from './strength-6502.js';
// export { StackOptPass } from './stack-opt.js';

// Phase 6: Size Passes (Os/Oz)
// export { SizeOptPass } from './size-opt.js';

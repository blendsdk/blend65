/**
 * ASM-IL Builder Module
 *
 * Exports the complete builder inheritance chain for constructing
 * ASM-IL assembly modules.
 *
 * @module asm-il/builder
 */

// Re-export types from base-builder
export type { BuilderState, BuilderStats } from './base-builder.js';

// Re-export builder classes (for extension if needed)
export { BaseAsmBuilder } from './base-builder.js';
export { LoadStoreBuilder } from './load-store-builder.js';
export { TransferStackBuilder } from './transfer-stack-builder.js';
export { ArithmeticBuilder } from './arithmetic-builder.js';
export { LogicalBuilder } from './logical-builder.js';
export { BranchJumpBuilder } from './branch-jump-builder.js';
export { DataBuilder } from './data-builder.js';

// Re-export the final concrete class and factory
export { AsmModuleBuilder, createAsmModuleBuilder } from './module-builder.js';
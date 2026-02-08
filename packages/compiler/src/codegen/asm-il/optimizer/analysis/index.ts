/**
 * Analysis Utilities for ASM-IL Optimizer
 *
 * Provides CPU state analysis tools used by optimization passes to
 * determine when transformations are safe. These analyzers track:
 * - **Flag state**: Which processor flags (C, Z, N, V) are known
 * - **Register contents**: What values are in A, X, Y registers
 * - **Address aliasing**: Whether memory references could overlap
 *
 * @module codegen/asm-il/optimizer/analysis
 */

// Flag state analysis
export { FlagStateAnalyzer } from './flag-state.js';
export type { FlagState } from './flag-state.js';

// Register tracking
export { RegisterTracker } from './register-tracker.js';
export type { RegisterState, RegisterValue } from './register-tracker.js';

// Address aliasing analysis
export { AddressAnalyzer } from './address-analyzer.js';
export type { AddressRef } from './address-analyzer.js';

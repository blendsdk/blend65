/**
 * IL Builder Module
 *
 * Exports the ILBuilder class and supporting utilities.
 *
 * @module il/builder
 */

// Main builder class
export { ILBuilder } from './builder.js';

// Cost and def-use computation
export { computeInstructionCost, computeDefUse } from './base.js';

// Internal layers (exported for testing/extension)
export { ILBuilderBase } from './base.js';
export { ILBuilderMemory } from './memory.js';
export { ILBuilderArithmetic } from './arithmetic.js';
export { ILBuilderControl } from './control.js';
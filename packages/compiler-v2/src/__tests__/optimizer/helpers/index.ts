/**
 * Optimizer Test Helpers Module
 *
 * Exports all test helpers for IL Optimizer testing.
 * Import from this module for convenient access to all helpers.
 *
 * @example
 * ```typescript
 * import {
 *   compileAndOptimize,
 *   createTestILFunction,
 *   createLoadImmInstr,
 *   createAddImmInstr,
 *   generateManyIdentityOpportunities,
 * } from '../helpers/index.js';
 * ```
 *
 * @module __tests__/optimizer/helpers
 */

export {
  // Re-exported from IL helpers
  compileToIL,
  countOpcode,
  hasOpcode,
  findInstructions,
  getFunction,
  getMainFunction,
  getImmediateValue,
  wrapInModule,
  wrapInFunction,
  wrapInProgram,
  
  // Compile and optimize
  compileAndOptimize,
  compileAndOptimizeWithOptions,
  
  // Test slot/frame creation
  createTestSlot,
  createMockFrame,
  
  // Instruction creation helpers
  createLoadImmInstr,
  createStoreByteInstr,
  createLoadByteInstr,
  createAddImmInstr,
  createSubImmInstr,
  createAndImmInstr,
  createOrImmInstr,
  createXorImmInstr,
  createCmpImmInstr,
  createReturnInstr,
  createLabelInstr,
  createJumpInstr,
  createJumpEqInstr,
  createJumpNeInstr,
  createCallInstr,
  createIncByteInstr,
  createDecByteInstr,
  createNopInstr,
  
  // Function & program creation
  createTestILFunction,
  createTestILProgram,
  
  // Large code generation (for stress tests)
  generateLargeFunction,
  generateManyDeadCodeOpportunities,
  generateManyConstantFoldOpportunities,
  generateManyIdentityOpportunities,
  generateMixedIdentityOpportunities,
  generateCopyPropOpportunities,
  generateConstantPropOpportunities,
  
  // Verification helpers
  verifyOptimizationStats,
  verifyInstructionCountRange,
  verifyReduction,
  verifySemanticPreservation,
  
  // Optimizer instance helpers
  optimizeFunction,
  optimizeProgram,
} from './optimizer-test-utils.js';
/**
 * IL Test Helpers Module
 *
 * Exports all test helpers for IL Generator testing.
 * Import from this module for convenient access to all helpers.
 *
 * @example
 * ```typescript
 * import {
 *   compileToIL,
 *   countOpcode,
 *   hasOpcode,
 *   wrapInProgram,
 *   C64_ADDRESSES,
 * } from '../helpers/index.js';
 * ```
 *
 * @module __tests__/il/helpers
 */

export {
  // Core compilation
  compileToIL,
  
  // Opcode counting & finding
  countOpcode,
  hasOpcode,
  findInstructions,
  getFirstInstruction,
  getLastInstruction,
  
  // Operand value helpers
  getImmediateValue,
  getSlotName,
  getAllImmediateValues,
  
  // Function & program helpers
  getFunction,
  getMainFunction,
  getTotalInstructionCount,
  
  // Verification helpers
  verifyNoOpcode,
  verifyMinOpcodeCount,
  verifyOpcodeSequence,
  
  // Code wrapper helpers
  wrapInModule,
  wrapInFunction,
  wrapInProgram,
  
  // Constants
  C64_ADDRESSES,
  
  // Code generation helpers (for stress tests)
  generateManyVariables,
  generateManyFunctions,
  generateNestedIfs,
  generateNestedLoops,
  generateExpressionChain,
} from './il-test-utils.js';
/**
 * E2E Test Helpers
 *
 * Re-exports all helper functions for convenient importing.
 *
 * @module e2e/helpers
 *
 * @example
 * ```typescript
 * import {
 *   compile,
 *   compileToAsm,
 *   expectAsmContains,
 *   expectAsmInstruction
 * } from './helpers/index.js';
 * ```
 */

// Compilation helpers
export {
  compile,
  compileToAsm,
  compileExpectSuccess,
  compileExpectFailure,
  createTestConfig,
  hasErrorCode,
  hasErrorMessage,
  type TestCompileOptions,
  type TestCompileResult,
} from './compile-helper.js';

// ASM validation helpers
export {
  expectAsmContains,
  expectAsmNotContains,
  expectAsmInstruction,
  expectAsmNoInstruction,
  countAsmOccurrences,
  expectAsmByteData,
  expectAsmLabel,
  expectAsmCall,
  expectAsmLoadImmediate,
  expectAsmStoreAddress,
  expectAsmLoadAddress,
  extractAsmSection,
  expectAsmNoErrors,
} from './asm-validator.js';
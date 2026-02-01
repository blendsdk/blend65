/**
 * SFA Test Helpers Module
 *
 * This module exports all test helpers for Static Frame Allocation testing.
 * Import from this module for convenient access to all helpers.
 *
 * @example
 * ```typescript
 * import {
 *   buildCallGraph,
 *   parseSource,
 *   INLINE_FIXTURES,
 * } from './helpers/index.js';
 * ```
 *
 * @module __tests__/frame/helpers
 */

// Builder functions for creating compiler artifacts from source
export {
  parseSource,
  buildSymbolTable,
  buildCallGraph,
  runSemanticAnalysis,
  wrapInModule,
  wrapInFunction,
  wrapInProgram,
} from './builders.js';

// Test fixtures (both file-based and inline)
export {
  loadFixture,
  loadFixtureCategory,
  fixturesExist,
  INLINE_FIXTURES,
  type InlineFixtureKey,
} from './fixtures.js';

// Note: Assertions and mocks will be added in Session 0.2
// export * from './assertions.js';
// export * from './mocks.js';
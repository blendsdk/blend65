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

// Assertion functions for SFA testing
export {
  // Types
  SlotLocation,
  type DiagnosticSeverity,
  type FrameDiagnostic,
  type FrameSlot,
  type Frame,
  type FrameAllocationStats,
  type FrameAllocationResult,
  // Frame existence assertions
  expectFrameExists,
  expectFrameAt,
  expectFrameSize,
  // Slot location assertions
  expectSlotInZP,
  expectSlotInRAM,
  expectSlotAt,
  expectSlotSize,
  // Coalescing assertions
  expectCoalesced,
  expectNotCoalesced,
  expectAllCoalesced,
  // Diagnostic assertions
  expectNoErrors,
  expectSuccess,
  expectError,
  expectErrorForFunction,
  expectWarning,
  expectErrorCount,
  // Statistics assertions
  expectCoalescingSavings,
  expectZPUsage,
  expectExactZPUsage,
  expectTotalAllocation,
  expectCoalesceGroupCount,
  // Test data builders
  createTestAllocationResult,
  createTestFrame,
  createTestSlot,
  createTestDiagnostic,
} from './assertions.js';

// Note: NO MOCKS - per Testing Philosophy, we use real implementations
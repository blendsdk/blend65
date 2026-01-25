/**
 * SSA ID Collision Prevention Tests - Multi-Variable Same-Version Scenarios
 *
 * These tests verify that SSA construction properly handles multiple variables
 * that have the same SSA version numbers, ensuring globally unique register IDs
 * are assigned to each variable.
 *
 * **The Bug Being Prevented:**
 * In the original buggy code, SSA version numbers (which are per-variable) were
 * incorrectly used as VirtualRegister IDs (which must be globally unique).
 * For example, `a.0` and `b.0` both have version 0, but if the version was used
 * as the register ID, both would get ID 0, causing SSA verification to fail with
 * "Register r0 is defined multiple times".
 *
 * **Test Strategy:**
 * Test functions with N variables (2, 5, 10, etc.) where all variables would have
 * the same initial SSA version (0) to ensure unique IDs are assigned regardless
 * of version number.
 *
 * @module __tests__/il/ssa-id-collision-multivar
 */

import { describe, it, expect } from 'vitest';
import { ILFunction } from '../../il/function.js';
import { ILValueFactory } from '../../il/values.js';
import { IL_BYTE, IL_VOID, IL_WORD } from '../../il/types.js';
import {
  ILConstInstruction,
  ILStoreVarInstruction,
  ILLoadVarInstruction,
  ILBinaryInstruction,
  ILReturnInstruction,
  ILOpcode,
} from '../../il/instructions.js';
import { constructSSA } from '../../il/ssa/index.js';
import { verifyRegisterIdUniqueness, collectAllResultRegisterIds, getFunctionStats } from '../../il/ssa/test-utils.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a function with N variables in straight-line code.
 *
 * Each variable is assigned a constant value. After SSA construction,
 * all variables would have version 0 (first assignment), so this tests
 * that unique IDs are assigned even when versions are identical.
 *
 * @param numVariables - Number of variables to create
 * @returns An IL function with N variables
 */
function createMultiVariableLinearFunction(numVariables: number): ILFunction {
  const func = new ILFunction(`multiVar${numVariables}`, [], IL_VOID);
  const factory = new ILValueFactory();
  const entry = func.getEntryBlock();

  let instrId = 0;

  // Create N variables, each assigned a constant value
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `temp${i}`);
    entry.addInstruction(new ILConstInstruction(instrId++, i, IL_BYTE, reg));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, reg));
  }

  entry.addInstruction(new ILReturnInstruction(instrId));

  return func;
}

/**
 * Creates a function with N variables that are then read and used.
 *
 * This adds LoadVar instructions after the stores, testing that both
 * definitions and uses maintain unique IDs.
 *
 * @param numVariables - Number of variables to create
 * @returns An IL function with N variables being stored and loaded
 */
function createMultiVariableWithReadsFunction(numVariables: number): ILFunction {
  const func = new ILFunction(`multiVarRead${numVariables}`, [], IL_VOID);
  const factory = new ILValueFactory();
  const entry = func.getEntryBlock();

  let instrId = 0;

  // First, store values to all variables
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `temp${i}`);
    entry.addInstruction(new ILConstInstruction(instrId++, i, IL_BYTE, reg));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, reg));
  }

  // Then, load and use all variables
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `load${i}`);
    entry.addInstruction(new ILLoadVarInstruction(instrId++, `var${i}`, reg));
  }

  entry.addInstruction(new ILReturnInstruction(instrId));

  return func;
}

/**
 * Creates a function with N pairs of variables, where each pair has
 * variables that might have the same version.
 *
 * This tests more complex scenarios where multiple groups of variables
 * could have colliding versions.
 *
 * @param numPairs - Number of variable pairs to create
 * @returns An IL function with 2*numPairs variables
 */
function createPairedVariablesFunction(numPairs: number): ILFunction {
  const func = new ILFunction(`pairedVars${numPairs}`, [], IL_VOID);
  const factory = new ILValueFactory();
  const entry = func.getEntryBlock();

  let instrId = 0;

  // Create pairs of variables with interleaved assignments
  for (let i = 0; i < numPairs; i++) {
    // First variable in pair
    const regA = factory.createRegister(IL_BYTE, `a${i}`);
    entry.addInstruction(new ILConstInstruction(instrId++, i * 2, IL_BYTE, regA));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, `a${i}`, regA));

    // Second variable in pair - would have same version (0) as first
    const regB = factory.createRegister(IL_BYTE, `b${i}`);
    entry.addInstruction(new ILConstInstruction(instrId++, i * 2 + 1, IL_BYTE, regB));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, `b${i}`, regB));
  }

  entry.addInstruction(new ILReturnInstruction(instrId));

  return func;
}

/**
 * Creates a function with multiple variables of different types.
 *
 * This ensures type diversity doesn't affect ID uniqueness.
 *
 * @param numVariables - Number of variables per type
 * @returns An IL function with byte and word variables
 */
function createMultiTypeVariablesFunction(numVariables: number): ILFunction {
  const func = new ILFunction(`multiType${numVariables}`, [], IL_VOID);
  const factory = new ILValueFactory();
  const entry = func.getEntryBlock();

  let instrId = 0;

  // Create byte variables
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `byte${i}`);
    entry.addInstruction(new ILConstInstruction(instrId++, i, IL_BYTE, reg));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, `byteVar${i}`, reg));
  }

  // Create word variables
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_WORD, `word${i}`);
    entry.addInstruction(new ILConstInstruction(instrId++, i * 256, IL_WORD, reg));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, `wordVar${i}`, reg));
  }

  entry.addInstruction(new ILReturnInstruction(instrId));

  return func;
}

/**
 * Creates a function with variables that are reassigned multiple times.
 *
 * This tests that even multiple versions of the same variable don't
 * conflict with versions of other variables.
 *
 * @param numVariables - Number of variables
 * @param assignmentsPerVariable - Number of times each variable is assigned
 * @returns An IL function with multiple assignments
 */
function createMultipleAssignmentsFunction(numVariables: number, assignmentsPerVariable: number): ILFunction {
  const func = new ILFunction(`multiAssign${numVariables}x${assignmentsPerVariable}`, [], IL_VOID);
  const factory = new ILValueFactory();
  const entry = func.getEntryBlock();

  let instrId = 0;

  // Interleave assignments to different variables
  for (let assignment = 0; assignment < assignmentsPerVariable; assignment++) {
    for (let varIndex = 0; varIndex < numVariables; varIndex++) {
      const reg = factory.createRegister(IL_BYTE, `temp_${varIndex}_${assignment}`);
      const value = assignment * numVariables + varIndex;
      entry.addInstruction(new ILConstInstruction(instrId++, value, IL_BYTE, reg));
      entry.addInstruction(new ILStoreVarInstruction(instrId++, `var${varIndex}`, reg));
    }
  }

  entry.addInstruction(new ILReturnInstruction(instrId));

  return func;
}

// =============================================================================
// Tests: Basic Multi-Variable Same-Version Scenarios
// =============================================================================

describe('SSA ID Collision: Multi-Variable Same-Version', () => {
  describe('Basic Collision Prevention', () => {
    it('should assign unique register IDs for 2 variables with version 0', () => {
      const func = createMultiVariableLinearFunction(2);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
      expect(verification.duplicates).toHaveLength(0);
    });

    it('should assign unique register IDs for 3 variables with same versions', () => {
      const func = createMultiVariableLinearFunction(3);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should assign unique register IDs for 5 variables with same versions', () => {
      const func = createMultiVariableLinearFunction(5);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should assign unique register IDs for 10 variables with same versions', () => {
      const func = createMultiVariableLinearFunction(10);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
      expect(verification.totalChecked).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Variables with Reads', () => {
    it('should maintain unique IDs when variables are stored and loaded', () => {
      const func = createMultiVariableWithReadsFunction(3);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should handle 5 variables with store and load operations', () => {
      const func = createMultiVariableWithReadsFunction(5);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });
  });

  describe('Paired Variable Patterns', () => {
    it('should handle 3 pairs of variables (6 total) with interleaved assignments', () => {
      const func = createPairedVariablesFunction(3);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should handle 5 pairs of variables (10 total)', () => {
      const func = createPairedVariablesFunction(5);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });
  });

  describe('Multiple Type Variables', () => {
    it('should handle byte and word variables with same version numbers', () => {
      const func = createMultiTypeVariablesFunction(3);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should handle 5 byte and 5 word variables', () => {
      const func = createMultiTypeVariablesFunction(5);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });
  });

  describe('Multiple Assignments per Variable', () => {
    it('should handle 2 variables with 3 assignments each (interleaved)', () => {
      const func = createMultipleAssignmentsFunction(2, 3);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should handle 3 variables with 4 assignments each', () => {
      const func = createMultipleAssignmentsFunction(3, 4);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should handle 5 variables with 3 assignments each', () => {
      // This creates 15 total assignments, many with potentially colliding versions
      const func = createMultipleAssignmentsFunction(5, 3);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });
  });
});

// =============================================================================
// Tests: Register ID Counting and Distribution
// =============================================================================

describe('SSA ID Collision: Register ID Distribution', () => {
  it('should generate sequential, non-overlapping IDs', () => {
    const func = createMultiVariableLinearFunction(5);
    constructSSA(func, { skipVerification: false });

    const ids = collectAllResultRegisterIds(func);
    const uniqueIds = new Set(ids);

    // All IDs should be unique
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should produce expected number of result registers', () => {
    const numVariables = 5;
    const func = createMultiVariableLinearFunction(numVariables);
    constructSSA(func, { skipVerification: false });

    const stats = getFunctionStats(func);

    // Should have at least numVariables result registers (for the const instructions)
    expect(stats.resultRegisterCount).toBeGreaterThanOrEqual(numVariables);
  });

  it('should handle function statistics correctly after SSA', () => {
    const func = createMultiVariableWithReadsFunction(4);
    constructSSA(func, { skipVerification: false });

    const stats = getFunctionStats(func);

    expect(stats.blockCount).toBe(1); // Single entry block
    expect(stats.instructionCount).toBeGreaterThan(0);
    // 4 stores + 4 loads = at least 8 registers
    expect(stats.resultRegisterCount).toBeGreaterThanOrEqual(8);
  });
});

// =============================================================================
// Tests: Edge Cases
// =============================================================================

describe('SSA ID Collision: Edge Cases', () => {
  it('should handle single variable (no collision possible)', () => {
    const func = createMultiVariableLinearFunction(1);
    const result = constructSSA(func, { skipVerification: false });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });

  it('should handle empty function (no variables)', () => {
    const func = new ILFunction('empty', [], IL_VOID);
    const entry = func.getEntryBlock();
    entry.addInstruction(new ILReturnInstruction(0));

    const result = constructSSA(func, { skipVerification: false });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
    expect(verification.totalChecked).toBe(0);
  });

  it('should handle variables with similar names', () => {
    // Test that similarly-named variables don't cause confusion
    const func = new ILFunction('similarNames', [], IL_VOID);
    const factory = new ILValueFactory();
    const entry = func.getEntryBlock();

    let instrId = 0;

    // Create variables with similar names
    const names = ['x', 'x1', 'x2', 'x_a', 'x_b'];
    for (const name of names) {
      const reg = factory.createRegister(IL_BYTE, name);
      entry.addInstruction(new ILConstInstruction(instrId++, 0, IL_BYTE, reg));
      entry.addInstruction(new ILStoreVarInstruction(instrId++, name, reg));
    }

    entry.addInstruction(new ILReturnInstruction(instrId));

    const result = constructSSA(func, { skipVerification: false });
    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });
});
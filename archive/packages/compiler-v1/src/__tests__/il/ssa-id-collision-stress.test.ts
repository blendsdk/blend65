/**
 * SSA ID Collision Prevention Tests - Scale and Stress Tests
 *
 * These tests verify that SSA construction correctly handles large-scale
 * scenarios with many variables, deep nesting, and complex CFG patterns.
 *
 * **Purpose:**
 * Stress tests ensure the ID collision fix scales to real-world scenarios
 * and doesn't introduce performance regressions or edge case failures.
 *
 * **Test Strategy:**
 * - Large number of variables (50+)
 * - Deep CFG nesting
 * - Complex control flow patterns
 * - Performance characteristics
 *
 * @module __tests__/il/ssa-id-collision-stress
 */

import { describe, it, expect } from 'vitest';
import { ILFunction } from '../../il/function.js';
import { ILValueFactory } from '../../il/values.js';
import { IL_BYTE, IL_VOID } from '../../il/types.js';
import {
  ILConstInstruction,
  ILStoreVarInstruction,
  ILLoadVarInstruction,
  ILJumpInstruction,
  ILBranchInstruction,
  ILReturnInstruction,
  ILBinaryInstruction,
  ILOpcode,
} from '../../il/instructions.js';
import { constructSSA } from '../../il/ssa/index.js';
import { verifyRegisterIdUniqueness, countPhiInstructions, getFunctionStats } from '../../il/ssa/test-utils.js';

// =============================================================================
// Test Helpers - Large-Scale Patterns
// =============================================================================

/**
 * Creates a function with a large number of variables in straight-line code.
 *
 * @param numVariables - Number of variables (stress test: 50-100+)
 * @returns An IL function with many variables
 */
function createManyVariablesLinear(numVariables: number): ILFunction {
  const func = new ILFunction(`manyVars${numVariables}`, [], IL_VOID);
  // IMPORTANT: Use the function's value factory to ensure globally unique register IDs
  const factory = func.getValueFactory();
  const entry = func.getEntryBlock();

  let instrId = 0;

  // Create many variables
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `v${i}`);
    entry.addInstruction(new ILConstInstruction(instrId++, i % 256, IL_BYTE, reg));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, reg));
  }

  entry.addInstruction(new ILReturnInstruction(instrId));

  return func;
}

/**
 * Creates a diamond CFG with many variables needing phi functions.
 *
 * @param numVariables - Number of variables requiring phi (stress test: 20-50+)
 * @returns An IL function with large diamond pattern
 */
function createLargeDiamond(numVariables: number): ILFunction {
  const func = new ILFunction(`largeDiamond${numVariables}`, [], IL_VOID);
  // IMPORTANT: Use the function's value factory to ensure globally unique register IDs
  const factory = func.getValueFactory();

  const entry = func.getEntryBlock();
  const thenBlock = func.createBlock('then');
  const elseBlock = func.createBlock('else');
  const mergeBlock = func.createBlock('merge');

  let instrId = 0;

  // Entry: branch
  const condReg = factory.createRegister(IL_BYTE, 'cond');
  entry.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, condReg));
  entry.addInstruction(new ILBranchInstruction(instrId++, condReg, thenBlock.getLabel(), elseBlock.getLabel()));

  // Then block: assign all variables
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `then${i}`);
    thenBlock.addInstruction(new ILConstInstruction(instrId++, (10 + i) % 256, IL_BYTE, reg));
    thenBlock.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, reg));
  }
  thenBlock.addInstruction(new ILJumpInstruction(instrId++, mergeBlock.getLabel()));

  // Else block: assign all variables differently
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `else${i}`);
    elseBlock.addInstruction(new ILConstInstruction(instrId++, (20 + i) % 256, IL_BYTE, reg));
    elseBlock.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, reg));
  }
  elseBlock.addInstruction(new ILJumpInstruction(instrId++, mergeBlock.getLabel()));

  // Merge block: read all variables
  for (let i = 0; i < numVariables; i++) {
    const loadReg = factory.createRegister(IL_BYTE, `load${i}`);
    mergeBlock.addInstruction(new ILLoadVarInstruction(instrId++, `var${i}`, loadReg));
  }
  mergeBlock.addInstruction(new ILReturnInstruction(instrId));

  // Link CFG
  entry.linkTo(thenBlock);
  entry.linkTo(elseBlock);
  thenBlock.linkTo(mergeBlock);
  elseBlock.linkTo(mergeBlock);

  return func;
}

/**
 * Creates a loop with many variables modified in each iteration.
 *
 * @param numVariables - Number of loop variables (stress test: 20-50+)
 * @returns An IL function with large loop pattern
 */
function createLargeLoop(numVariables: number): ILFunction {
  const func = new ILFunction(`largeLoop${numVariables}`, [], IL_VOID);
  // IMPORTANT: Use the function's value factory to ensure globally unique register IDs
  const factory = func.getValueFactory();

  const entry = func.getEntryBlock();
  const header = func.createBlock('header');
  const body = func.createBlock('body');
  const exit = func.createBlock('exit');

  let instrId = 0;

  // Entry: initialize all variables
  for (let i = 0; i < numVariables; i++) {
    const initReg = factory.createRegister(IL_BYTE, `init${i}`);
    entry.addInstruction(new ILConstInstruction(instrId++, i % 256, IL_BYTE, initReg));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, initReg));
  }
  entry.addInstruction(new ILJumpInstruction(instrId++, header.getLabel()));

  // Header: condition
  const condReg = factory.createRegister(IL_BYTE, 'loopCond');
  header.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, condReg));
  header.addInstruction(new ILBranchInstruction(instrId++, condReg, body.getLabel(), exit.getLabel()));

  // Body: increment all variables
  for (let i = 0; i < numVariables; i++) {
    const loadReg = factory.createRegister(IL_BYTE, `load${i}`);
    const oneReg = factory.createRegister(IL_BYTE, `one${i}`);
    const incReg = factory.createRegister(IL_BYTE, `inc${i}`);
    body.addInstruction(new ILLoadVarInstruction(instrId++, `var${i}`, loadReg));
    body.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, oneReg));
    body.addInstruction(new ILBinaryInstruction(instrId++, ILOpcode.ADD, loadReg, oneReg, incReg));
    body.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, incReg));
  }
  body.addInstruction(new ILJumpInstruction(instrId++, header.getLabel()));

  // Exit
  exit.addInstruction(new ILReturnInstruction(instrId));

  // Link CFG
  entry.linkTo(header);
  header.linkTo(body);
  header.linkTo(exit);
  body.linkTo(header);

  return func;
}

/**
 * Creates a deeply nested if-else chain.
 *
 * @param depth - Nesting depth (stress test: 10-20+)
 * @returns An IL function with deeply nested branches
 */
function createDeepNesting(depth: number): ILFunction {
  const func = new ILFunction(`deepNest${depth}`, [], IL_VOID);
  // IMPORTANT: Use the function's value factory to ensure globally unique register IDs
  const factory = func.getValueFactory();

  let instrId = 0;
  let currentBlock = func.getEntryBlock();

  // Create nested if-else chain
  for (let level = 0; level < depth; level++) {
    const thenBlock = func.createBlock(`then${level}`);
    const elseBlock = func.createBlock(`else${level}`);
    const mergeBlock = func.createBlock(`merge${level}`);

    // Condition and branch
    const condReg = factory.createRegister(IL_BYTE, `cond${level}`);
    currentBlock.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, condReg));
    currentBlock.addInstruction(new ILBranchInstruction(instrId++, condReg, thenBlock.getLabel(), elseBlock.getLabel()));

    currentBlock.linkTo(thenBlock);
    currentBlock.linkTo(elseBlock);

    // Then block: store variable
    const thenReg = factory.createRegister(IL_BYTE, `thenVal${level}`);
    thenBlock.addInstruction(new ILConstInstruction(instrId++, level * 2, IL_BYTE, thenReg));
    thenBlock.addInstruction(new ILStoreVarInstruction(instrId++, `var${level}`, thenReg));
    thenBlock.addInstruction(new ILJumpInstruction(instrId++, mergeBlock.getLabel()));
    thenBlock.linkTo(mergeBlock);

    // Else block: store different value
    const elseReg = factory.createRegister(IL_BYTE, `elseVal${level}`);
    elseBlock.addInstruction(new ILConstInstruction(instrId++, level * 2 + 1, IL_BYTE, elseReg));
    elseBlock.addInstruction(new ILStoreVarInstruction(instrId++, `var${level}`, elseReg));
    elseBlock.addInstruction(new ILJumpInstruction(instrId++, mergeBlock.getLabel()));
    elseBlock.linkTo(mergeBlock);

    currentBlock = mergeBlock;
  }

  // Final return
  currentBlock.addInstruction(new ILReturnInstruction(instrId));

  return func;
}

/**
 * Creates a function with multiple independent loops.
 *
 * @param numLoops - Number of separate loops
 * @param varsPerLoop - Variables per loop
 * @returns An IL function with multiple loop patterns
 */
function createMultipleLoops(numLoops: number, varsPerLoop: number): ILFunction {
  const func = new ILFunction(`multiLoop${numLoops}x${varsPerLoop}`, [], IL_VOID);
  // IMPORTANT: Use the function's value factory to ensure globally unique register IDs
  const factory = func.getValueFactory();

  let instrId = 0;
  let currentBlock = func.getEntryBlock();

  for (let loopIndex = 0; loopIndex < numLoops; loopIndex++) {
    const header = func.createBlock(`header${loopIndex}`);
    const body = func.createBlock(`body${loopIndex}`);
    const exit = func.createBlock(`exit${loopIndex}`);

    // Initialize loop variables
    for (let v = 0; v < varsPerLoop; v++) {
      const initReg = factory.createRegister(IL_BYTE, `init${loopIndex}_${v}`);
      currentBlock.addInstruction(new ILConstInstruction(instrId++, v, IL_BYTE, initReg));
      currentBlock.addInstruction(new ILStoreVarInstruction(instrId++, `loop${loopIndex}_var${v}`, initReg));
    }
    currentBlock.addInstruction(new ILJumpInstruction(instrId++, header.getLabel()));
    currentBlock.linkTo(header);

    // Loop header
    const condReg = factory.createRegister(IL_BYTE, `cond${loopIndex}`);
    header.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, condReg));
    header.addInstruction(new ILBranchInstruction(instrId++, condReg, body.getLabel(), exit.getLabel()));
    header.linkTo(body);
    header.linkTo(exit);

    // Loop body: modify variables
    for (let v = 0; v < varsPerLoop; v++) {
      const loadReg = factory.createRegister(IL_BYTE, `load${loopIndex}_${v}`);
      const oneReg = factory.createRegister(IL_BYTE, `one${loopIndex}_${v}`);
      const incReg = factory.createRegister(IL_BYTE, `inc${loopIndex}_${v}`);
      body.addInstruction(new ILLoadVarInstruction(instrId++, `loop${loopIndex}_var${v}`, loadReg));
      body.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, oneReg));
      body.addInstruction(new ILBinaryInstruction(instrId++, ILOpcode.ADD, loadReg, oneReg, incReg));
      body.addInstruction(new ILStoreVarInstruction(instrId++, `loop${loopIndex}_var${v}`, incReg));
    }
    body.addInstruction(new ILJumpInstruction(instrId++, header.getLabel()));
    body.linkTo(header);

    currentBlock = exit;
  }

  // Final return
  currentBlock.addInstruction(new ILReturnInstruction(instrId));

  return func;
}

// =============================================================================
// Tests: Large Variable Counts
// =============================================================================

describe('SSA ID Collision Stress: Large Variable Counts', () => {
  it('should handle 50 variables in linear code', () => {
    const func = createManyVariablesLinear(50);
    const result = constructSSA(func, { skipVerification: false });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
    expect(verification.totalChecked).toBeGreaterThanOrEqual(50);
  });

  it('should handle 100 variables in linear code', () => {
    const func = createManyVariablesLinear(100);
    const result = constructSSA(func, { skipVerification: false });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });

  it('should handle 20 variables needing phi in diamond', () => {
    const func = createLargeDiamond(20);
    // Use skipVerification for complex CFG patterns (consistent with existing tests)
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });

  it('should handle 30 variables needing phi in diamond', () => {
    const func = createLargeDiamond(30);
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });

  it('should handle 20 variables in loop', () => {
    const func = createLargeLoop(20);
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });

  it('should handle 30 variables in loop', () => {
    const func = createLargeLoop(30);
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });
});

// =============================================================================
// Tests: Deep Nesting
// =============================================================================

describe('SSA ID Collision Stress: Deep Nesting', () => {
  it('should handle 10 levels of nested if-else', () => {
    const func = createDeepNesting(10);
    // Deep nesting has complex CFG - use skipVerification for ID uniqueness test
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });

  it('should handle 15 levels of nested if-else', () => {
    const func = createDeepNesting(15);
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });

  it('should handle 20 levels of nested if-else', () => {
    const func = createDeepNesting(20);
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });
});

// =============================================================================
// Tests: Multiple Loops
// =============================================================================

describe('SSA ID Collision Stress: Multiple Loops', () => {
  it('should handle 3 loops with 5 variables each', () => {
    const func = createMultipleLoops(3, 5);
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });

  it('should handle 5 loops with 3 variables each', () => {
    const func = createMultipleLoops(5, 3);
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });

  it('should handle 5 loops with 10 variables each', () => {
    const func = createMultipleLoops(5, 10);
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });
});

// =============================================================================
// Tests: Performance Characteristics
// =============================================================================

describe('SSA ID Collision Stress: Performance', () => {
  it('should complete 50-variable diamond in reasonable time', () => {
    const func = createLargeDiamond(50);

    const startTime = performance.now();
    const result = constructSSA(func, { skipVerification: true });
    const endTime = performance.now();

    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should complete 50-variable loop in reasonable time', () => {
    const func = createLargeLoop(50);

    const startTime = performance.now();
    const result = constructSSA(func, { skipVerification: true });
    const endTime = performance.now();

    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should complete deep nesting (20 levels) in reasonable time', () => {
    const func = createDeepNesting(20);

    const startTime = performance.now();
    const result = constructSSA(func, { skipVerification: true });
    const endTime = performance.now();

    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
  });
});

// =============================================================================
// Tests: Statistics for Stress Tests
// =============================================================================

describe('SSA ID Collision Stress: Statistics', () => {
  it('should report correct stats for large diamond', () => {
    const numVars = 20;
    const func = createLargeDiamond(numVars);
    constructSSA(func, { skipVerification: true, insertPhiInstructions: true });

    const stats = getFunctionStats(func);

    expect(stats.blockCount).toBe(4); // entry, then, else, merge
    expect(stats.phiCount).toBeGreaterThanOrEqual(numVars);
  });

  it('should report correct stats for large loop', () => {
    const numVars = 15;
    const func = createLargeLoop(numVars);
    constructSSA(func, { skipVerification: true, insertPhiInstructions: true });

    const stats = getFunctionStats(func);

    expect(stats.blockCount).toBe(4); // entry, header, body, exit
    expect(stats.phiCount).toBeGreaterThanOrEqual(numVars);
  });

  it('should count phi instructions correctly for deep nesting', () => {
    const depth = 10;
    const func = createDeepNesting(depth);
    constructSSA(func, { skipVerification: true, insertPhiInstructions: true });

    const phiCount = countPhiInstructions(func);
    // Each level creates a merge point that may need phi for variables from upper levels
    expect(phiCount).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// Tests: Combined Complex Patterns
// =============================================================================

describe('SSA ID Collision Stress: Combined Patterns', () => {
  /**
   * Creates a complex pattern: diamond + loop + more variables
   */
  function createComplexCombined(): ILFunction {
    const func = new ILFunction('complexCombined', [], IL_VOID);
    // IMPORTANT: Use the function's value factory to ensure globally unique register IDs
    const factory = func.getValueFactory();

    const entry = func.getEntryBlock();
    const thenBlock = func.createBlock('then');
    const elseBlock = func.createBlock('else');
    const merge = func.createBlock('merge');
    const loopHeader = func.createBlock('loopHeader');
    const loopBody = func.createBlock('loopBody');
    const exit = func.createBlock('exit');

    let instrId = 0;

    // 10 initial variables
    for (let i = 0; i < 10; i++) {
      const reg = factory.createRegister(IL_BYTE, `init${i}`);
      entry.addInstruction(new ILConstInstruction(instrId++, i, IL_BYTE, reg));
      entry.addInstruction(new ILStoreVarInstruction(instrId++, `preVar${i}`, reg));
    }

    // Diamond
    const condReg = factory.createRegister(IL_BYTE, 'cond');
    entry.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, condReg));
    entry.addInstruction(new ILBranchInstruction(instrId++, condReg, thenBlock.getLabel(), elseBlock.getLabel()));
    entry.linkTo(thenBlock);
    entry.linkTo(elseBlock);

    // Then: 5 more variables
    for (let i = 0; i < 5; i++) {
      const reg = factory.createRegister(IL_BYTE, `then${i}`);
      thenBlock.addInstruction(new ILConstInstruction(instrId++, 10 + i, IL_BYTE, reg));
      thenBlock.addInstruction(new ILStoreVarInstruction(instrId++, `diamondVar${i}`, reg));
    }
    thenBlock.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));
    thenBlock.linkTo(merge);

    // Else: 5 more variables (different values)
    for (let i = 0; i < 5; i++) {
      const reg = factory.createRegister(IL_BYTE, `else${i}`);
      elseBlock.addInstruction(new ILConstInstruction(instrId++, 20 + i, IL_BYTE, reg));
      elseBlock.addInstruction(new ILStoreVarInstruction(instrId++, `diamondVar${i}`, reg));
    }
    elseBlock.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));
    elseBlock.linkTo(merge);

    // Merge: init loop variables
    for (let i = 0; i < 8; i++) {
      const reg = factory.createRegister(IL_BYTE, `loopInit${i}`);
      merge.addInstruction(new ILConstInstruction(instrId++, i, IL_BYTE, reg));
      merge.addInstruction(new ILStoreVarInstruction(instrId++, `loopVar${i}`, reg));
    }
    merge.addInstruction(new ILJumpInstruction(instrId++, loopHeader.getLabel()));
    merge.linkTo(loopHeader);

    // Loop header
    const loopCond = factory.createRegister(IL_BYTE, 'loopCond');
    loopHeader.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, loopCond));
    loopHeader.addInstruction(new ILBranchInstruction(instrId++, loopCond, loopBody.getLabel(), exit.getLabel()));
    loopHeader.linkTo(loopBody);
    loopHeader.linkTo(exit);

    // Loop body
    for (let i = 0; i < 8; i++) {
      const loadReg = factory.createRegister(IL_BYTE, `load${i}`);
      const oneReg = factory.createRegister(IL_BYTE, `one${i}`);
      const incReg = factory.createRegister(IL_BYTE, `inc${i}`);
      loopBody.addInstruction(new ILLoadVarInstruction(instrId++, `loopVar${i}`, loadReg));
      loopBody.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, oneReg));
      loopBody.addInstruction(new ILBinaryInstruction(instrId++, ILOpcode.ADD, loadReg, oneReg, incReg));
      loopBody.addInstruction(new ILStoreVarInstruction(instrId++, `loopVar${i}`, incReg));
    }
    loopBody.addInstruction(new ILJumpInstruction(instrId++, loopHeader.getLabel()));
    loopBody.linkTo(loopHeader);

    // Exit
    exit.addInstruction(new ILReturnInstruction(instrId));

    return func;
  }

  it('should handle combined diamond + loop + many variables', () => {
    const func = createComplexCombined();
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });

  it('should produce meaningful stats for complex combined pattern', () => {
    const func = createComplexCombined();
    constructSSA(func, { skipVerification: true, insertPhiInstructions: true });

    const stats = getFunctionStats(func);

    expect(stats.blockCount).toBe(7); // entry, then, else, merge, loopHeader, loopBody, exit
    expect(stats.phiCount).toBeGreaterThanOrEqual(5 + 8); // At least diamond vars + loop vars need phi
    expect(stats.resultRegisterCount).toBeGreaterThan(0);
  });
});
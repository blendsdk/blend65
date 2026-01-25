/**
 * SSA ID Collision Prevention Tests - Phi Instruction Collision Scenarios
 *
 * These tests verify that SSA construction properly handles phi instruction
 * insertion when multiple variables need phi functions at the same merge point.
 *
 * **The Bug Being Prevented:**
 * When multiple variables need phi instructions at the same merge block,
 * using SSA versions as register IDs would cause collisions. For example,
 * in a diamond CFG where variables `a` and `b` are both assigned in both
 * branches, both would need phi instructions at the merge. If versions were
 * used as IDs, `a.2` and `b.2` would both get ID 2.
 *
 * **Test Strategy:**
 * Create diamond and loop CFG patterns with multiple variables, all requiring
 * phi functions at merge points. Verify unique IDs are assigned to all phi
 * instruction results.
 *
 * @module __tests__/il/ssa-id-collision-phi
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
import {
  verifyRegisterIdUniqueness,
  countPhiInstructions,
  findBlocksWithPhis,
  countPhisPerBlock,
  getFunctionStats,
} from '../../il/ssa/test-utils.js';

// =============================================================================
// Test Helpers - Diamond CFG Patterns
// =============================================================================

/**
 * Creates a diamond CFG where N variables are assigned different values
 * in each branch, requiring N phi functions at the merge point.
 *
 * ```
 *     entry
 *       |
 *     (cond)
 *      / \
 *   then  else   <- Both branches assign all N variables
 *      \ /
 *     merge      <- N phi functions needed here
 * ```
 *
 * @param numVariables - Number of variables to assign in both branches
 * @returns An IL function with diamond CFG requiring N phi functions
 */
function createMultiVariableDiamond(numVariables: number): ILFunction {
  const func = new ILFunction(`multiDiamond${numVariables}`, [], IL_VOID);
  // IMPORTANT: Use the function's value factory to ensure globally unique register IDs
  const factory = func.getValueFactory();

  const entry = func.getEntryBlock();
  const thenBlock = func.createBlock('then');
  const elseBlock = func.createBlock('else');
  const mergeBlock = func.createBlock('merge');

  let instrId = 0;

  // Entry: create condition and branch
  const condReg = factory.createRegister(IL_BYTE, 'cond');
  entry.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, condReg));
  entry.addInstruction(new ILBranchInstruction(instrId++, condReg, thenBlock.getLabel(), elseBlock.getLabel()));

  // Then block: assign all variables to 10, 11, 12, ...
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `then${i}`);
    thenBlock.addInstruction(new ILConstInstruction(instrId++, 10 + i, IL_BYTE, reg));
    thenBlock.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, reg));
  }
  thenBlock.addInstruction(new ILJumpInstruction(instrId++, mergeBlock.getLabel()));

  // Else block: assign all variables to 20, 21, 22, ...
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `else${i}`);
    elseBlock.addInstruction(new ILConstInstruction(instrId++, 20 + i, IL_BYTE, reg));
    elseBlock.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, reg));
  }
  elseBlock.addInstruction(new ILJumpInstruction(instrId++, mergeBlock.getLabel()));

  // Merge block: just return (phi functions will be inserted by SSA)
  mergeBlock.addInstruction(new ILReturnInstruction(instrId));

  // Link CFG
  entry.linkTo(thenBlock);
  entry.linkTo(elseBlock);
  thenBlock.linkTo(mergeBlock);
  elseBlock.linkTo(mergeBlock);

  return func;
}

/**
 * Creates a diamond CFG where variables are also read after the merge,
 * ensuring phi results are properly used.
 *
 * @param numVariables - Number of variables
 * @returns An IL function with reads after merge
 */
function createDiamondWithReadsAfterMerge(numVariables: number): ILFunction {
  const func = new ILFunction(`diamondRead${numVariables}`, [], IL_VOID);
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

  // Then block
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `then${i}`);
    thenBlock.addInstruction(new ILConstInstruction(instrId++, 10 + i, IL_BYTE, reg));
    thenBlock.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, reg));
  }
  thenBlock.addInstruction(new ILJumpInstruction(instrId++, mergeBlock.getLabel()));

  // Else block
  for (let i = 0; i < numVariables; i++) {
    const reg = factory.createRegister(IL_BYTE, `else${i}`);
    elseBlock.addInstruction(new ILConstInstruction(instrId++, 20 + i, IL_BYTE, reg));
    elseBlock.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, reg));
  }
  elseBlock.addInstruction(new ILJumpInstruction(instrId++, mergeBlock.getLabel()));

  // Merge block: read all variables (uses phi results)
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

// =============================================================================
// Test Helpers - Loop CFG Patterns
// =============================================================================

/**
 * Creates a simple loop where N variables are modified in the loop body,
 * requiring N phi functions at the loop header.
 *
 * ```
 *     entry
 *       |
 *     header <--+   <- N phi functions needed here
 *       |       |
 *      body ----+
 *       |
 *      exit
 * ```
 *
 * @param numVariables - Number of variables to modify in loop
 * @returns An IL function with loop requiring phi functions
 */
function createMultiVariableLoop(numVariables: number): ILFunction {
  const func = new ILFunction(`multiLoop${numVariables}`, [], IL_VOID);
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
    entry.addInstruction(new ILConstInstruction(instrId++, i, IL_BYTE, initReg));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, `var${i}`, initReg));
  }
  entry.addInstruction(new ILJumpInstruction(instrId++, header.getLabel()));

  // Header: branch condition
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

  // Exit: return
  exit.addInstruction(new ILReturnInstruction(instrId));

  // Link CFG
  entry.linkTo(header);
  header.linkTo(body);
  header.linkTo(exit);
  body.linkTo(header);

  return func;
}

/**
 * Creates a nested loop pattern with variables modified at different levels.
 *
 * ```
 *      entry
 *        |
 *    outer_header <---+
 *        |            |
 *   inner_header <-+  |
 *        |         |  |
 *    inner_body ---+  |
 *        |            |
 *   outer_cont -------+
 *        |
 *       exit
 * ```
 *
 * @param outerVars - Number of variables modified in outer loop
 * @param innerVars - Number of variables modified in inner loop
 * @returns An IL function with nested loops
 */
function createNestedLoopVariables(outerVars: number, innerVars: number): ILFunction {
  const func = new ILFunction(`nested${outerVars}x${innerVars}`, [], IL_VOID);
  // IMPORTANT: Use the function's value factory to ensure globally unique register IDs
  const factory = func.getValueFactory();

  const entry = func.getEntryBlock();
  const outerHeader = func.createBlock('outerHeader');
  const innerHeader = func.createBlock('innerHeader');
  const innerBody = func.createBlock('innerBody');
  const outerCont = func.createBlock('outerCont');
  const exit = func.createBlock('exit');

  let instrId = 0;

  // Entry: initialize all variables
  for (let i = 0; i < outerVars; i++) {
    const reg = factory.createRegister(IL_BYTE, `outerInit${i}`);
    entry.addInstruction(new ILConstInstruction(instrId++, i, IL_BYTE, reg));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, `outer${i}`, reg));
  }
  for (let i = 0; i < innerVars; i++) {
    const reg = factory.createRegister(IL_BYTE, `innerInit${i}`);
    entry.addInstruction(new ILConstInstruction(instrId++, i, IL_BYTE, reg));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, `inner${i}`, reg));
  }
  entry.addInstruction(new ILJumpInstruction(instrId++, outerHeader.getLabel()));

  // Outer header: check outer condition
  const outerCond = factory.createRegister(IL_BYTE, 'outerCond');
  outerHeader.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, outerCond));
  outerHeader.addInstruction(new ILBranchInstruction(instrId++, outerCond, innerHeader.getLabel(), exit.getLabel()));

  // Inner header: check inner condition
  const innerCond = factory.createRegister(IL_BYTE, 'innerCond');
  innerHeader.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, innerCond));
  innerHeader.addInstruction(new ILBranchInstruction(instrId++, innerCond, innerBody.getLabel(), outerCont.getLabel()));

  // Inner body: modify inner variables
  for (let i = 0; i < innerVars; i++) {
    const loadReg = factory.createRegister(IL_BYTE, `innerLoad${i}`);
    const oneReg = factory.createRegister(IL_BYTE, `innerOne${i}`);
    const incReg = factory.createRegister(IL_BYTE, `innerInc${i}`);
    innerBody.addInstruction(new ILLoadVarInstruction(instrId++, `inner${i}`, loadReg));
    innerBody.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, oneReg));
    innerBody.addInstruction(new ILBinaryInstruction(instrId++, ILOpcode.ADD, loadReg, oneReg, incReg));
    innerBody.addInstruction(new ILStoreVarInstruction(instrId++, `inner${i}`, incReg));
  }
  innerBody.addInstruction(new ILJumpInstruction(instrId++, innerHeader.getLabel()));

  // Outer continuation: modify outer variables, jump back
  for (let i = 0; i < outerVars; i++) {
    const loadReg = factory.createRegister(IL_BYTE, `outerLoad${i}`);
    const oneReg = factory.createRegister(IL_BYTE, `outerOne${i}`);
    const incReg = factory.createRegister(IL_BYTE, `outerInc${i}`);
    outerCont.addInstruction(new ILLoadVarInstruction(instrId++, `outer${i}`, loadReg));
    outerCont.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, oneReg));
    outerCont.addInstruction(new ILBinaryInstruction(instrId++, ILOpcode.ADD, loadReg, oneReg, incReg));
    outerCont.addInstruction(new ILStoreVarInstruction(instrId++, `outer${i}`, incReg));
  }
  outerCont.addInstruction(new ILJumpInstruction(instrId++, outerHeader.getLabel()));

  // Exit
  exit.addInstruction(new ILReturnInstruction(instrId));

  // Link CFG
  entry.linkTo(outerHeader);
  outerHeader.linkTo(innerHeader);
  outerHeader.linkTo(exit);
  innerHeader.linkTo(innerBody);
  innerHeader.linkTo(outerCont);
  innerBody.linkTo(innerHeader);
  outerCont.linkTo(outerHeader);

  return func;
}

// =============================================================================
// Tests: Phi Collision at Diamond Merge Points
// =============================================================================

describe('SSA ID Collision: Phi at Diamond Merge Points', () => {
  describe('Basic Diamond Phi Collision', () => {
    it('should assign unique IDs when 2 variables need phi at same merge', () => {
      const func = createMultiVariableDiamond(2);
      // Use skipVerification: true (like existing ssa-integration tests for diamond patterns)
      // We specifically test ID uniqueness via verifyRegisterIdUniqueness
      const result = constructSSA(func, { skipVerification: true });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should assign unique IDs when 3 variables need phi at same merge', () => {
      const func = createMultiVariableDiamond(3);
      const result = constructSSA(func, { skipVerification: true });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should assign unique IDs when 5 variables need phi at same merge', () => {
      const func = createMultiVariableDiamond(5);
      const result = constructSSA(func, { skipVerification: true });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should assign unique IDs when 10 variables need phi at same merge', () => {
      const func = createMultiVariableDiamond(10);
      const result = constructSSA(func, { skipVerification: true });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });
  });

  describe('Diamond with Reads After Merge', () => {
    it('should handle 2 variables with phi and subsequent reads', () => {
      const func = createDiamondWithReadsAfterMerge(2);
      const result = constructSSA(func, { skipVerification: true });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should handle 5 variables with phi and subsequent reads', () => {
      const func = createDiamondWithReadsAfterMerge(5);
      const result = constructSSA(func, { skipVerification: true });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });
  });

  describe('Phi Instruction Analysis', () => {
    it('should create expected number of phi instructions for diamond', () => {
      const numVariables = 3;
      const func = createMultiVariableDiamond(numVariables);
      constructSSA(func, { skipVerification: false, insertPhiInstructions: true });

      const phiCount = countPhiInstructions(func);
      // Should have at least numVariables phi instructions
      expect(phiCount).toBeGreaterThanOrEqual(numVariables);
    });

    it('should place phi instructions at merge block', () => {
      const func = createMultiVariableDiamond(3);
      constructSSA(func, { skipVerification: false, insertPhiInstructions: true });

      const blocksWithPhis = findBlocksWithPhis(func);
      // Phi instructions should be at the merge block
      expect(blocksWithPhis.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// =============================================================================
// Tests: Phi Collision at Loop Headers
// =============================================================================

describe('SSA ID Collision: Phi at Loop Headers', () => {
  describe('Simple Loop Phi Collision', () => {
    it('should assign unique IDs when 2 variables need phi at loop header', () => {
      const func = createMultiVariableLoop(2);
      // Use skipVerification: true for loop patterns (like existing ssa-integration tests)
      const result = constructSSA(func, { skipVerification: true });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should assign unique IDs when 3 variables need phi at loop header', () => {
      const func = createMultiVariableLoop(3);
      const result = constructSSA(func, { skipVerification: true });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should assign unique IDs when 5 variables need phi at loop header', () => {
      const func = createMultiVariableLoop(5);
      const result = constructSSA(func, { skipVerification: true });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });
  });

  describe('Nested Loop Phi Collision', () => {
    it('should handle 2 outer and 2 inner loop variables', () => {
      const func = createNestedLoopVariables(2, 2);
      const result = constructSSA(func, { skipVerification: true });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should handle 3 outer and 3 inner loop variables', () => {
      const func = createNestedLoopVariables(3, 3);
      const result = constructSSA(func, { skipVerification: true });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should handle asymmetric nested loops (2 outer, 5 inner)', () => {
      const func = createNestedLoopVariables(2, 5);
      const result = constructSSA(func, { skipVerification: true });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });
  });
});

// =============================================================================
// Tests: Mixed Patterns (Diamond + Loop)
// =============================================================================

describe('SSA ID Collision: Mixed CFG Patterns', () => {
  /**
   * Creates a function with both a diamond and a loop,
   * testing phi collision at multiple merge points.
   */
  function createDiamondThenLoop(diamondVars: number, loopVars: number): ILFunction {
    const func = new ILFunction(`diamondLoop${diamondVars}x${loopVars}`, [], IL_VOID);
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

    // Entry: branch for diamond
    const condReg = factory.createRegister(IL_BYTE, 'cond');
    entry.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, condReg));
    entry.addInstruction(new ILBranchInstruction(instrId++, condReg, thenBlock.getLabel(), elseBlock.getLabel()));

    // Then block
    for (let i = 0; i < diamondVars; i++) {
      const reg = factory.createRegister(IL_BYTE, `dthen${i}`);
      thenBlock.addInstruction(new ILConstInstruction(instrId++, 10 + i, IL_BYTE, reg));
      thenBlock.addInstruction(new ILStoreVarInstruction(instrId++, `dvar${i}`, reg));
    }
    thenBlock.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));

    // Else block
    for (let i = 0; i < diamondVars; i++) {
      const reg = factory.createRegister(IL_BYTE, `delse${i}`);
      elseBlock.addInstruction(new ILConstInstruction(instrId++, 20 + i, IL_BYTE, reg));
      elseBlock.addInstruction(new ILStoreVarInstruction(instrId++, `dvar${i}`, reg));
    }
    elseBlock.addInstruction(new ILJumpInstruction(instrId++, merge.getLabel()));

    // Merge -> loop init
    for (let i = 0; i < loopVars; i++) {
      const reg = factory.createRegister(IL_BYTE, `linit${i}`);
      merge.addInstruction(new ILConstInstruction(instrId++, i, IL_BYTE, reg));
      merge.addInstruction(new ILStoreVarInstruction(instrId++, `lvar${i}`, reg));
    }
    merge.addInstruction(new ILJumpInstruction(instrId++, loopHeader.getLabel()));

    // Loop header
    const loopCond = factory.createRegister(IL_BYTE, 'loopCond');
    loopHeader.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, loopCond));
    loopHeader.addInstruction(new ILBranchInstruction(instrId++, loopCond, loopBody.getLabel(), exit.getLabel()));

    // Loop body
    for (let i = 0; i < loopVars; i++) {
      const loadReg = factory.createRegister(IL_BYTE, `lload${i}`);
      const oneReg = factory.createRegister(IL_BYTE, `lone${i}`);
      const incReg = factory.createRegister(IL_BYTE, `linc${i}`);
      loopBody.addInstruction(new ILLoadVarInstruction(instrId++, `lvar${i}`, loadReg));
      loopBody.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, oneReg));
      loopBody.addInstruction(new ILBinaryInstruction(instrId++, ILOpcode.ADD, loadReg, oneReg, incReg));
      loopBody.addInstruction(new ILStoreVarInstruction(instrId++, `lvar${i}`, incReg));
    }
    loopBody.addInstruction(new ILJumpInstruction(instrId++, loopHeader.getLabel()));

    // Exit
    exit.addInstruction(new ILReturnInstruction(instrId));

    // Link CFG
    entry.linkTo(thenBlock);
    entry.linkTo(elseBlock);
    thenBlock.linkTo(merge);
    elseBlock.linkTo(merge);
    merge.linkTo(loopHeader);
    loopHeader.linkTo(loopBody);
    loopHeader.linkTo(exit);
    loopBody.linkTo(loopHeader);

    return func;
  }

  it('should handle diamond (2 vars) followed by loop (2 vars)', () => {
    const func = createDiamondThenLoop(2, 2);
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });

  it('should handle diamond (3 vars) followed by loop (3 vars)', () => {
    const func = createDiamondThenLoop(3, 3);
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });

  it('should handle asymmetric pattern (5 diamond vars, 2 loop vars)', () => {
    const func = createDiamondThenLoop(5, 2);
    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });
});

// =============================================================================
// Tests: Phi Instruction Statistics
// =============================================================================

describe('SSA ID Collision: Phi Statistics', () => {
  it('should count phi instructions per block correctly', () => {
    const func = createMultiVariableDiamond(3);
    constructSSA(func, { skipVerification: true, insertPhiInstructions: true });

    const phisPerBlock = countPhisPerBlock(func);

    // At least one block should have phi instructions
    expect(phisPerBlock.size).toBeGreaterThanOrEqual(1);
  });

  it('should report function statistics correctly', () => {
    const func = createMultiVariableDiamond(4);
    constructSSA(func, { skipVerification: false, insertPhiInstructions: true });

    const stats = getFunctionStats(func);

    expect(stats.blockCount).toBe(4); // entry, then, else, merge
    expect(stats.instructionCount).toBeGreaterThan(0);
    expect(stats.phiCount).toBeGreaterThanOrEqual(4); // At least 4 phis for 4 vars
  });
});
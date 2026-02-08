/**
 * SSA ID Collision Prevention Tests - Register ID Uniqueness Invariants
 *
 * These tests verify that the fundamental SSA invariant of globally unique
 * register IDs is maintained throughout SSA construction. This invariant
 * states that each register may be defined exactly once.
 *
 * **The Invariant Being Tested:**
 * In valid SSA form, every VirtualRegister ID must be globally unique across
 * the entire function. No two instructions may define a result register with
 * the same ID.
 *
 * **Test Strategy:**
 * Test various function structures and verify the uniqueness invariant holds
 * using dedicated verification utilities. These tests serve as documentation
 * and regression prevention for the invariant.
 *
 * @module __tests__/il/ssa-id-collision-uniqueness
 */

import { describe, it, expect } from 'vitest';
import { ILFunction } from '../../il/function.js';
import { ILValueFactory, VirtualRegister } from '../../il/values.js';
import { IL_BYTE, IL_VOID, IL_WORD, IL_POINTER } from '../../il/types.js';
import {
  ILConstInstruction,
  ILStoreVarInstruction,
  ILLoadVarInstruction,
  ILJumpInstruction,
  ILBranchInstruction,
  ILReturnInstruction,
  ILBinaryInstruction,
  ILUnaryInstruction,
  ILOpcode,
} from '../../il/instructions.js';
import { constructSSA } from '../../il/ssa/index.js';
import {
  verifyRegisterIdUniqueness,
  collectAllResultRegisterIds,
  collectAllRegisterUsage,
  assertUniqueRegisterIds,
  getFunctionStats,
} from '../../il/ssa/test-utils.js';

// =============================================================================
// Test Helpers - Complex CFG Patterns
// =============================================================================

/**
 * Creates a function with a long chain of blocks, each defining a register.
 *
 * @param length - Number of blocks in the chain
 * @returns An IL function with linear CFG
 */
function createBlockChain(length: number): ILFunction {
  const func = new ILFunction(`chain${length}`, [], IL_VOID);
  const factory = new ILValueFactory();

  let prevBlock = func.getEntryBlock();
  let instrId = 0;

  // Entry block stores first variable
  const entryReg = factory.createRegister(IL_BYTE, 'entry');
  prevBlock.addInstruction(new ILConstInstruction(instrId++, 0, IL_BYTE, entryReg));
  prevBlock.addInstruction(new ILStoreVarInstruction(instrId++, 'x', entryReg));

  // Create chain of blocks
  for (let i = 1; i < length; i++) {
    const newBlock = func.createBlock(`block${i}`);

    // Add jump from previous block
    prevBlock.addInstruction(new ILJumpInstruction(instrId++, newBlock.getLabel()));
    prevBlock.linkTo(newBlock);

    // Store to variable in new block
    const reg = factory.createRegister(IL_BYTE, `temp${i}`);
    newBlock.addInstruction(new ILConstInstruction(instrId++, i, IL_BYTE, reg));
    newBlock.addInstruction(new ILStoreVarInstruction(instrId++, 'x', reg));

    prevBlock = newBlock;
  }

  // Add return to last block
  prevBlock.addInstruction(new ILReturnInstruction(instrId));

  return func;
}

/**
 * Creates a function with multiple independent branches (no phi needed).
 *
 * @param numBranches - Number of branches
 * @returns An IL function with multiple non-merging branches
 */
function createMultiBranchNoMerge(numBranches: number): ILFunction {
  const func = new ILFunction(`multiBranch${numBranches}`, [], IL_VOID);
  const factory = new ILValueFactory();
  const entry = func.getEntryBlock();

  let instrId = 0;

  // Create condition for first branch
  const condReg = factory.createRegister(IL_BYTE, 'cond');
  entry.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, condReg));

  // Create multiple exit branches
  const exitBlocks: { block: typeof entry; reg: VirtualRegister }[] = [];

  for (let i = 0; i < numBranches; i++) {
    const block = func.createBlock(`branch${i}`);
    const reg = factory.createRegister(IL_BYTE, `result${i}`);
    block.addInstruction(new ILConstInstruction(instrId++, i, IL_BYTE, reg));
    block.addInstruction(new ILReturnInstruction(instrId++, reg));
    exitBlocks.push({ block, reg });
    entry.linkTo(block);
  }

  // Simple two-way branch for now (first two branches)
  if (exitBlocks.length >= 2) {
    entry.addInstruction(new ILBranchInstruction(instrId, condReg, exitBlocks[0].block.getLabel(), exitBlocks[1].block.getLabel()));
  } else {
    entry.addInstruction(new ILJumpInstruction(instrId, exitBlocks[0].block.getLabel()));
  }

  return func;
}

/**
 * Creates a function with complex expression chains.
 *
 * @param depth - Depth of expression nesting
 * @returns An IL function with deeply nested expressions
 */
function createNestedExpressions(depth: number): ILFunction {
  const func = new ILFunction(`nestedExpr${depth}`, [], IL_VOID);
  const factory = new ILValueFactory();
  const entry = func.getEntryBlock();

  let instrId = 0;

  // Create initial operands
  const reg0 = factory.createRegister(IL_BYTE, 'op0');
  const reg1 = factory.createRegister(IL_BYTE, 'op1');
  entry.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, reg0));
  entry.addInstruction(new ILConstInstruction(instrId++, 2, IL_BYTE, reg1));

  // Build nested expression: ((((a + b) + c) + d) + ...)
  let prevResult = reg0;
  for (let i = 0; i < depth; i++) {
    const newOperand = factory.createRegister(IL_BYTE, `op${i + 2}`);
    const result = factory.createRegister(IL_BYTE, `result${i}`);
    entry.addInstruction(new ILConstInstruction(instrId++, i + 3, IL_BYTE, newOperand));
    entry.addInstruction(new ILBinaryInstruction(instrId++, ILOpcode.ADD, prevResult, newOperand, result));
    prevResult = result;
  }

  entry.addInstruction(new ILReturnInstruction(instrId, prevResult));

  return func;
}

/**
 * Creates a function that combines unary and binary operations.
 *
 * @param numOperations - Number of operations to chain
 * @returns An IL function with mixed operations
 */
function createMixedOperations(numOperations: number): ILFunction {
  const func = new ILFunction(`mixedOps${numOperations}`, [], IL_VOID);
  const factory = new ILValueFactory();
  const entry = func.getEntryBlock();

  let instrId = 0;

  // Initial value
  const initial = factory.createRegister(IL_BYTE, 'initial');
  entry.addInstruction(new ILConstInstruction(instrId++, 10, IL_BYTE, initial));

  let current = initial;
  for (let i = 0; i < numOperations; i++) {
    if (i % 2 === 0) {
      // Binary operation
      const operand = factory.createRegister(IL_BYTE, `operand${i}`);
      const result = factory.createRegister(IL_BYTE, `binResult${i}`);
      entry.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, operand));
      entry.addInstruction(new ILBinaryInstruction(instrId++, ILOpcode.ADD, current, operand, result));
      current = result;
    } else {
      // Unary operation
      const result = factory.createRegister(IL_BYTE, `unaryResult${i}`);
      entry.addInstruction(new ILUnaryInstruction(instrId++, ILOpcode.NEG, current, result));
      current = result;
    }
  }

  entry.addInstruction(new ILReturnInstruction(instrId, current));

  return func;
}

// =============================================================================
// Tests: Basic Uniqueness Verification
// =============================================================================

describe('SSA ID Uniqueness: Basic Verification', () => {
  describe('verifyRegisterIdUniqueness utility', () => {
    it('should return unique=true for valid SSA function', () => {
      const func = new ILFunction('valid', [], IL_VOID);
      const factory = new ILValueFactory();
      const entry = func.getEntryBlock();

      // Two different registers
      const r0 = factory.createRegister(IL_BYTE, 'a');
      const r1 = factory.createRegister(IL_BYTE, 'b');

      entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, r0));
      entry.addInstruction(new ILConstInstruction(1, 2, IL_BYTE, r1));
      entry.addInstruction(new ILReturnInstruction(2));

      const result = verifyRegisterIdUniqueness(func);

      expect(result.unique).toBe(true);
      expect(result.duplicates).toHaveLength(0);
      expect(result.totalChecked).toBe(2);
    });

    it('should return unique=false when duplicate IDs exist', () => {
      const func = new ILFunction('invalid', [], IL_VOID);
      const entry = func.getEntryBlock();

      // Manually create registers with same ID (simulating bug)
      const r0a = new VirtualRegister(0, IL_BYTE, 'a');
      const r0b = new VirtualRegister(0, IL_BYTE, 'b'); // Same ID!

      entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, r0a));
      entry.addInstruction(new ILConstInstruction(1, 2, IL_BYTE, r0b));
      entry.addInstruction(new ILReturnInstruction(2));

      const result = verifyRegisterIdUniqueness(func);

      expect(result.unique).toBe(false);
      expect(result.duplicates).toContain(0);
      expect(result.details.length).toBeGreaterThan(0);
    });

    it('should track locations of duplicates', () => {
      const func = new ILFunction('trackLoc', [], IL_VOID);
      const entry = func.getEntryBlock();

      // Create duplicate
      const r0a = new VirtualRegister(42, IL_BYTE, 'a');
      const r0b = new VirtualRegister(42, IL_BYTE, 'b');

      entry.addInstruction(new ILConstInstruction(100, 1, IL_BYTE, r0a));
      entry.addInstruction(new ILConstInstruction(200, 2, IL_BYTE, r0b));
      entry.addInstruction(new ILReturnInstruction(300));

      const result = verifyRegisterIdUniqueness(func);

      expect(result.unique).toBe(false);
      expect(result.details.length).toBe(1);
      expect(result.details[0].id).toBe(42);
      expect(result.details[0].firstLocation.instructionId).toBe(100);
      expect(result.details[0].secondLocation.instructionId).toBe(200);
    });
  });

  describe('assertUniqueRegisterIds utility', () => {
    it('should not throw for valid SSA', () => {
      const func = new ILFunction('valid', [], IL_VOID);
      const factory = new ILValueFactory();
      const entry = func.getEntryBlock();

      const r0 = factory.createRegister(IL_BYTE, 'a');
      entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, r0));
      entry.addInstruction(new ILReturnInstruction(1));

      expect(() => assertUniqueRegisterIds(func)).not.toThrow();
    });

    it('should throw with descriptive message for invalid SSA', () => {
      const func = new ILFunction('invalid', [], IL_VOID);
      const entry = func.getEntryBlock();

      const r0a = new VirtualRegister(0, IL_BYTE, 'a');
      const r0b = new VirtualRegister(0, IL_BYTE, 'b');

      entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, r0a));
      entry.addInstruction(new ILConstInstruction(1, 2, IL_BYTE, r0b));
      entry.addInstruction(new ILReturnInstruction(2));

      expect(() => assertUniqueRegisterIds(func)).toThrow(/uniqueness violation/i);
    });
  });
});

// =============================================================================
// Tests: Uniqueness After SSA Construction
// =============================================================================

describe('SSA ID Uniqueness: After SSA Construction', () => {
  describe('Linear CFG patterns', () => {
    it('should maintain uniqueness for 5-block chain', () => {
      const func = createBlockChain(5);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should maintain uniqueness for 10-block chain', () => {
      const func = createBlockChain(10);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });
  });

  describe('Branching CFG patterns', () => {
    it('should maintain uniqueness for 2 branches', () => {
      const func = createMultiBranchNoMerge(2);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });
  });

  describe('Expression patterns', () => {
    it('should maintain uniqueness for deeply nested expressions (depth 5)', () => {
      const func = createNestedExpressions(5);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should maintain uniqueness for deeply nested expressions (depth 10)', () => {
      const func = createNestedExpressions(10);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });

    it('should maintain uniqueness for mixed unary/binary operations', () => {
      const func = createMixedOperations(8);
      const result = constructSSA(func, { skipVerification: false });

      expect(result.success).toBe(true);

      const verification = verifyRegisterIdUniqueness(func);
      expect(verification.unique).toBe(true);
    });
  });
});

// =============================================================================
// Tests: Register ID Collection Utilities
// =============================================================================

describe('SSA ID Uniqueness: Register Collection Utilities', () => {
  describe('collectAllResultRegisterIds', () => {
    it('should collect all result register IDs', () => {
      const func = new ILFunction('collect', [], IL_VOID);
      const factory = new ILValueFactory();
      const entry = func.getEntryBlock();

      const r0 = factory.createRegister(IL_BYTE, 'a');
      const r1 = factory.createRegister(IL_BYTE, 'b');
      const r2 = factory.createRegister(IL_BYTE, 'c');

      entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, r0));
      entry.addInstruction(new ILConstInstruction(1, 2, IL_BYTE, r1));
      entry.addInstruction(new ILBinaryInstruction(2, ILOpcode.ADD, r0, r1, r2));
      entry.addInstruction(new ILReturnInstruction(3));

      const ids = collectAllResultRegisterIds(func);

      expect(ids).toHaveLength(3);
      expect(ids).toContain(r0.id);
      expect(ids).toContain(r1.id);
      expect(ids).toContain(r2.id);
    });

    it('should return empty array for function with no results', () => {
      const func = new ILFunction('noResults', [], IL_VOID);
      const entry = func.getEntryBlock();
      entry.addInstruction(new ILReturnInstruction(0));

      const ids = collectAllResultRegisterIds(func);

      expect(ids).toHaveLength(0);
    });
  });

  describe('collectAllRegisterUsage', () => {
    it('should collect both definition and use IDs', () => {
      const func = new ILFunction('usage', [], IL_VOID);
      const factory = new ILValueFactory();
      const entry = func.getEntryBlock();

      const r0 = factory.createRegister(IL_BYTE, 'a');
      const r1 = factory.createRegister(IL_BYTE, 'b');
      const r2 = factory.createRegister(IL_BYTE, 'result');

      entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, r0));
      entry.addInstruction(new ILConstInstruction(1, 2, IL_BYTE, r1));
      // Binary instruction defines r2 and uses r0, r1
      entry.addInstruction(new ILBinaryInstruction(2, ILOpcode.ADD, r0, r1, r2));
      entry.addInstruction(new ILReturnInstruction(3));

      const usage = collectAllRegisterUsage(func);

      // Should have all result registers (definitions)
      expect(usage).toContain(r0.id);
      expect(usage).toContain(r1.id);
      expect(usage).toContain(r2.id);
    });
  });
});

// =============================================================================
// Tests: Verification Statistics
// =============================================================================

describe('SSA ID Uniqueness: Verification Statistics', () => {
  it('should report correct totalChecked count', () => {
    const func = new ILFunction('stats', [], IL_VOID);
    const factory = new ILValueFactory();
    const entry = func.getEntryBlock();

    // Create 5 result registers
    for (let i = 0; i < 5; i++) {
      const reg = factory.createRegister(IL_BYTE, `r${i}`);
      entry.addInstruction(new ILConstInstruction(i, i, IL_BYTE, reg));
    }
    entry.addInstruction(new ILReturnInstruction(5));

    const result = verifyRegisterIdUniqueness(func);

    expect(result.totalChecked).toBe(5);
  });

  it('should report detailed information about duplicates', () => {
    const func = new ILFunction('dupDetails', [], IL_VOID);
    const entry = func.getEntryBlock();
    const block2 = func.createBlock('block2');

    // Create duplicate across blocks
    const r0a = new VirtualRegister(99, IL_BYTE, 'a');
    const r0b = new VirtualRegister(99, IL_BYTE, 'b');

    entry.addInstruction(new ILConstInstruction(10, 1, IL_BYTE, r0a));
    entry.addInstruction(new ILJumpInstruction(11, block2.getLabel()));
    entry.linkTo(block2);

    block2.addInstruction(new ILConstInstruction(20, 2, IL_BYTE, r0b));
    block2.addInstruction(new ILReturnInstruction(21));

    const result = verifyRegisterIdUniqueness(func);

    expect(result.unique).toBe(false);
    expect(result.details.length).toBe(1);

    const detail = result.details[0];
    expect(detail.id).toBe(99);
    expect(detail.firstLocation.blockId).toBe(entry.id);
    expect(detail.secondLocation.blockId).toBe(block2.id);
  });

  it('should work with getFunctionStats', () => {
    const func = createNestedExpressions(5);
    constructSSA(func, { skipVerification: false });

    const stats = getFunctionStats(func);

    expect(stats.blockCount).toBe(1);
    expect(stats.instructionCount).toBeGreaterThan(0);
    expect(stats.resultRegisterCount).toBeGreaterThan(0);
  });
});

// =============================================================================
// Tests: Cross-Block Uniqueness
// =============================================================================

describe('SSA ID Uniqueness: Cross-Block', () => {
  it('should maintain uniqueness across multiple blocks', () => {
    const func = new ILFunction('crossBlock', [], IL_VOID);
    const factory = new ILValueFactory();

    const entry = func.getEntryBlock();
    const block1 = func.createBlock('block1');
    const block2 = func.createBlock('block2');

    let instrId = 0;

    // Entry: store to x
    const r0 = factory.createRegister(IL_BYTE, 't0');
    entry.addInstruction(new ILConstInstruction(instrId++, 0, IL_BYTE, r0));
    entry.addInstruction(new ILStoreVarInstruction(instrId++, 'x', r0));
    entry.addInstruction(new ILJumpInstruction(instrId++, block1.getLabel()));
    entry.linkTo(block1);

    // Block1: store to x again
    const r1 = factory.createRegister(IL_BYTE, 't1');
    block1.addInstruction(new ILConstInstruction(instrId++, 1, IL_BYTE, r1));
    block1.addInstruction(new ILStoreVarInstruction(instrId++, 'x', r1));
    block1.addInstruction(new ILJumpInstruction(instrId++, block2.getLabel()));
    block1.linkTo(block2);

    // Block2: store to x again
    const r2 = factory.createRegister(IL_BYTE, 't2');
    block2.addInstruction(new ILConstInstruction(instrId++, 2, IL_BYTE, r2));
    block2.addInstruction(new ILStoreVarInstruction(instrId++, 'x', r2));
    block2.addInstruction(new ILReturnInstruction(instrId));

    const result = constructSSA(func, { skipVerification: false });
    expect(result.success).toBe(true);

    const verification = verifyRegisterIdUniqueness(func);
    expect(verification.unique).toBe(true);
  });
});
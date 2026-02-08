/**
 * Tests for SSA Verification
 *
 * **Session 11 Tests:** SSA form verification for IL functions
 * - SSAVerificationErrorCode enum values
 * - SSAVerifier class behavior
 * - Single assignment property checking
 * - Dominance property verification
 * - Phi function well-formedness checks
 *
 * **Key SSA Invariants Tested:**
 * 1. Each register defined exactly once
 * 2. Every use dominated by its definition
 * 3. Phi functions have operands from all predecessors
 * 4. Phi functions only at block start
 * 5. No use before definition
 *
 * @module __tests__/il/ssa-verification.test
 */

import { describe, it, expect } from 'vitest';
import {
  SSAVerificationErrorCode,
  type SSAVerificationError,
  type SSAVerificationResult,
  type SSAVerificationStats,
  SSAVerifier,
  verifySSA,
} from '../../il/ssa/verification.js';
import { computeDominators, DominatorTree } from '../../il/ssa/dominators.js';
import { ILFunction } from '../../il/function.js';
import { IL_BYTE, IL_VOID } from '../../il/types.js';
import {
  ILReturnVoidInstruction,
  ILJumpInstruction,
  ILBranchInstruction,
  ILConstInstruction,
  ILBinaryInstruction,
  ILPhiInstruction,
  ILOpcode,
} from '../../il/instructions.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a simple linear CFG for testing.
 *
 * Structure:
 * ```
 *     entry (0)
 *        |
 *     block1 (1)
 *        |
 *     block2 (2)
 * ```
 */
function createLinearCFG(): { func: ILFunction; domTree: DominatorTree } {
  const func = new ILFunction('linear', [], IL_VOID);
  const entry = func.getEntryBlock();
  const block1 = func.createBlock('block1');
  const block2 = func.createBlock('block2');

  entry.linkTo(block1);
  entry.addInstruction(new ILJumpInstruction(0, block1.getLabel()));

  block1.linkTo(block2);
  block1.addInstruction(new ILJumpInstruction(1, block2.getLabel()));

  block2.addInstruction(new ILReturnVoidInstruction(2));

  const domTree = computeDominators(func);
  return { func, domTree };
}

/**
 * Creates a diamond CFG for testing phi functions.
 *
 * Structure:
 * ```
 *     entry (0)
 *        |
 *     header (1)
 *      / \
 *   left  right
 *   (2)    (3)
 *     \   /
 *    merge (4)
 * ```
 */
function createDiamondCFG(): { func: ILFunction; domTree: DominatorTree } {
  const func = new ILFunction('diamond', [], IL_VOID);
  const entry = func.getEntryBlock();
  const header = func.createBlock('header');
  const left = func.createBlock('left');
  const right = func.createBlock('right');
  const merge = func.createBlock('merge');

  const condReg = func.createRegister(IL_BYTE, 'cond');

  // entry -> header
  entry.linkTo(header);
  // Define condReg before using it
  entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, condReg));
  entry.addInstruction(new ILJumpInstruction(1, header.getLabel()));

  // header -> left, right
  header.linkTo(left);
  header.linkTo(right);
  header.addInstruction(new ILBranchInstruction(2, condReg, left.getLabel(), right.getLabel()));

  // left -> merge
  left.linkTo(merge);
  left.addInstruction(new ILJumpInstruction(3, merge.getLabel()));

  // right -> merge
  right.linkTo(merge);
  right.addInstruction(new ILJumpInstruction(4, merge.getLabel()));

  // merge returns
  merge.addInstruction(new ILReturnVoidInstruction(5));

  const domTree = computeDominators(func);
  return { func, domTree };
}

/**
 * Creates a loop CFG for testing back edges.
 *
 * Structure:
 * ```
 *     entry (0)
 *        |
 *     header (1) <--+
 *        |          |
 *      body (2) ----+
 *        |
 *      exit (3)
 * ```
 */
function createLoopCFG(): { func: ILFunction; domTree: DominatorTree } {
  const func = new ILFunction('loop', [], IL_VOID);
  const entry = func.getEntryBlock();
  const header = func.createBlock('header');
  const body = func.createBlock('body');
  const exit = func.createBlock('exit');

  const condReg = func.createRegister(IL_BYTE, 'cond');

  // entry -> header
  entry.linkTo(header);
  // Define condReg before using it
  entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, condReg));
  entry.addInstruction(new ILJumpInstruction(1, header.getLabel()));

  // header -> body or exit
  header.linkTo(body);
  header.linkTo(exit);
  header.addInstruction(new ILBranchInstruction(2, condReg, body.getLabel(), exit.getLabel()));

  // body -> header (back edge)
  body.linkTo(header);
  body.addInstruction(new ILJumpInstruction(3, header.getLabel()));

  // exit returns
  exit.addInstruction(new ILReturnVoidInstruction(4));

  const domTree = computeDominators(func);
  return { func, domTree };
}

// =============================================================================
// Test S11.1-S11.5: SSAVerificationErrorCode Enum
// =============================================================================

describe('SSA Verification Error Codes (Session 11)', () => {
  it('Test S11.1: SSAVerificationErrorCode has MULTIPLE_DEFINITIONS', () => {
    expect(SSAVerificationErrorCode.MULTIPLE_DEFINITIONS).toBe('MULTIPLE_DEFINITIONS');
  });

  it('Test S11.2: SSAVerificationErrorCode has USE_BEFORE_DEFINITION', () => {
    expect(SSAVerificationErrorCode.USE_BEFORE_DEFINITION).toBe('USE_BEFORE_DEFINITION');
  });

  it('Test S11.3: SSAVerificationErrorCode has DOMINANCE_VIOLATION', () => {
    expect(SSAVerificationErrorCode.DOMINANCE_VIOLATION).toBe('DOMINANCE_VIOLATION');
  });

  it('Test S11.4: SSAVerificationErrorCode has PHI_MISSING_OPERAND', () => {
    expect(SSAVerificationErrorCode.PHI_MISSING_OPERAND).toBe('PHI_MISSING_OPERAND');
  });

  it('Test S11.5: SSAVerificationErrorCode has all phi-related codes', () => {
    expect(SSAVerificationErrorCode.PHI_INVALID_PREDECESSOR).toBe('PHI_INVALID_PREDECESSOR');
    expect(SSAVerificationErrorCode.PHI_NOT_AT_BLOCK_START).toBe('PHI_NOT_AT_BLOCK_START');
    expect(SSAVerificationErrorCode.PHI_IN_ENTRY_BLOCK).toBe('PHI_IN_ENTRY_BLOCK');
    expect(SSAVerificationErrorCode.PHI_OPERAND_COUNT_MISMATCH).toBe('PHI_OPERAND_COUNT_MISMATCH');
  });
});

// =============================================================================
// Test S11.6-S11.10: SSAVerifier Basic Tests
// =============================================================================

describe('SSAVerifier Basic Tests (Session 11)', () => {
  it('Test S11.6: SSAVerifier can be instantiated', () => {
    const { domTree } = createLinearCFG();
    const verifier = new SSAVerifier(domTree);

    expect(verifier).toBeInstanceOf(SSAVerifier);
    expect(verifier.getDominatorTree()).toBe(domTree);
  });

  it('Test S11.7: verify returns valid for empty function', () => {
    const func = new ILFunction('empty', [], IL_VOID);
    func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
    const domTree = computeDominators(func);

    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Test S11.8: verify returns statistics', () => {
    const { func, domTree } = createLinearCFG();

    const result = verifySSA(func, domTree);

    expect(result.stats).toBeDefined();
    expect(result.stats.blocksVerified).toBeGreaterThan(0);
    expect(result.stats.instructionsVerified).toBeGreaterThan(0);
  });

  it('Test S11.9: verify processes all blocks', () => {
    const { func, domTree } = createDiamondCFG();

    const result = verifySSA(func, domTree);

    expect(result.stats.blocksVerified).toBe(5); // entry, header, left, right, merge
  });

  it('Test S11.10: convenience function verifySSA works correctly', () => {
    const { func, domTree } = createLinearCFG();

    const result = verifySSA(func, domTree);

    expect(result).toBeDefined();
    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.stats).toBeDefined();
  });
});

// =============================================================================
// Test S11.11-S11.15: Single Assignment Property
// =============================================================================

describe('SSAVerifier Single Assignment Property (Session 11)', () => {
  it('Test S11.11: valid SSA with single definitions passes', () => {
    const func = new ILFunction('single_def', [], IL_VOID);
    const entry = func.getEntryBlock();

    const r0 = func.createRegister(IL_BYTE, 'r0');
    const r1 = func.createRegister(IL_BYTE, 'r1');

    // Each register defined exactly once
    entry.addInstruction(new ILConstInstruction(0, 10, IL_BYTE, r0));
    entry.addInstruction(new ILConstInstruction(1, 20, IL_BYTE, r1));
    entry.addInstruction(new ILReturnVoidInstruction(2));

    const domTree = computeDominators(func);
    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Test S11.12: detects multiple definitions of same register', () => {
    const func = new ILFunction('multi_def', [], IL_VOID);
    const entry = func.getEntryBlock();

    const r0 = func.createRegister(IL_BYTE, 'r0');

    // Same register defined twice - SSA violation!
    entry.addInstruction(new ILConstInstruction(0, 10, IL_BYTE, r0));
    entry.addInstruction(new ILConstInstruction(1, 20, IL_BYTE, r0)); // Duplicate def
    entry.addInstruction(new ILReturnVoidInstruction(2));

    const domTree = computeDominators(func);
    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === SSAVerificationErrorCode.MULTIPLE_DEFINITIONS)).toBe(true);
  });

  it('Test S11.13: error contains register ID for multiple definitions', () => {
    const func = new ILFunction('multi_def_detail', [], IL_VOID);
    const entry = func.getEntryBlock();

    const r0 = func.createRegister(IL_BYTE, 'r0');

    entry.addInstruction(new ILConstInstruction(0, 10, IL_BYTE, r0));
    entry.addInstruction(new ILConstInstruction(1, 20, IL_BYTE, r0));
    entry.addInstruction(new ILReturnVoidInstruction(2));

    const domTree = computeDominators(func);
    const result = verifySSA(func, domTree);

    const error = result.errors.find((e) => e.code === SSAVerificationErrorCode.MULTIPLE_DEFINITIONS);
    expect(error).toBeDefined();
    expect(error?.registerId).toBe(r0.id);
  });

  it('Test S11.14: multiple definitions in different blocks detected', () => {
    const { func, domTree } = createLinearCFG();
    const blocks = func.getBlocks();
    const entry = blocks[0];
    const block1 = blocks[1];

    const r0 = func.createRegister(IL_BYTE, 'r0');

    // Add definitions to different blocks
    entry.insertInstruction(0, new ILConstInstruction(100, 10, IL_BYTE, r0));
    block1.insertInstruction(0, new ILConstInstruction(101, 20, IL_BYTE, r0));

    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === SSAVerificationErrorCode.MULTIPLE_DEFINITIONS)).toBe(true);
  });

  it('Test S11.15: different registers can be defined independently', () => {
    const func = new ILFunction('independent_defs', [], IL_VOID);
    const entry = func.getEntryBlock();

    const r0 = func.createRegister(IL_BYTE, 'r0');
    const r1 = func.createRegister(IL_BYTE, 'r1');
    const r2 = func.createRegister(IL_BYTE, 'r2');

    entry.addInstruction(new ILConstInstruction(0, 10, IL_BYTE, r0));
    entry.addInstruction(new ILConstInstruction(1, 20, IL_BYTE, r1));
    entry.addInstruction(new ILConstInstruction(2, 30, IL_BYTE, r2));
    entry.addInstruction(new ILReturnVoidInstruction(3));

    const domTree = computeDominators(func);
    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(true);
    expect(result.stats.registersVerified).toBe(3);
  });
});

// =============================================================================
// Test S11.16-S11.20: Dominance Property
// =============================================================================

describe('SSAVerifier Dominance Property (Session 11)', () => {
  it('Test S11.16: use after definition in same block is valid', () => {
    const func = new ILFunction('use_after_def', [], IL_VOID);
    const entry = func.getEntryBlock();

    const r0 = func.createRegister(IL_BYTE, 'r0');
    const r1 = func.createRegister(IL_BYTE, 'r1');
    const r2 = func.createRegister(IL_BYTE, 'r2');

    // r0 defined, then used in add
    entry.addInstruction(new ILConstInstruction(0, 10, IL_BYTE, r0));
    entry.addInstruction(new ILConstInstruction(1, 20, IL_BYTE, r1));
    entry.addInstruction(new ILBinaryInstruction(2, ILOpcode.ADD, r0, r1, r2));
    entry.addInstruction(new ILReturnVoidInstruction(3));

    const domTree = computeDominators(func);
    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(true);
  });

  it('Test S11.17: use before definition in same block is invalid', () => {
    const func = new ILFunction('use_before_def', [], IL_VOID);
    const entry = func.getEntryBlock();

    const r0 = func.createRegister(IL_BYTE, 'r0');
    const r1 = func.createRegister(IL_BYTE, 'r1');
    const r2 = func.createRegister(IL_BYTE, 'r2');

    // r0 used before it's defined - violation!
    entry.addInstruction(new ILConstInstruction(0, 20, IL_BYTE, r1));
    entry.addInstruction(new ILBinaryInstruction(1, ILOpcode.ADD, r0, r1, r2)); // r0 not defined yet
    entry.addInstruction(new ILConstInstruction(2, 10, IL_BYTE, r0)); // r0 defined after use
    entry.addInstruction(new ILReturnVoidInstruction(3));

    const domTree = computeDominators(func);
    const result = verifySSA(func, domTree);

    // Should detect either USE_BEFORE_DEFINITION or DOMINANCE_VIOLATION
    expect(result.valid).toBe(false);
  });

  it('Test S11.18: use in dominated block is valid', () => {
    const { func, domTree } = createLinearCFG();
    const blocks = func.getBlocks();
    const entry = blocks[0];
    const block1 = blocks[1];
    const block2 = blocks[2];

    const r0 = func.createRegister(IL_BYTE, 'r0');
    const r1 = func.createRegister(IL_BYTE, 'r1');
    const r2 = func.createRegister(IL_BYTE, 'r2');

    // Define r0 in entry, use in block2 (entry dominates block2)
    entry.insertInstruction(0, new ILConstInstruction(100, 10, IL_BYTE, r0));
    block1.insertInstruction(0, new ILConstInstruction(101, 20, IL_BYTE, r1));
    block2.insertInstruction(0, new ILBinaryInstruction(102, ILOpcode.ADD, r0, r1, r2));

    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(true);
  });

  it('Test S11.19: use in non-dominated block is invalid', () => {
    const { func, domTree } = createDiamondCFG();
    const blocks = func.getBlocks();
    const left = blocks.find((b) => b.label === 'left')!;
    const right = blocks.find((b) => b.label === 'right')!;

    const r0 = func.createRegister(IL_BYTE, 'r0');
    const r1 = func.createRegister(IL_BYTE, 'r1');
    const r2 = func.createRegister(IL_BYTE, 'r2');

    // Define r0 in left, try to use in right (left doesn't dominate right)
    left.insertInstruction(0, new ILConstInstruction(100, 10, IL_BYTE, r0));
    right.insertInstruction(0, new ILConstInstruction(101, 20, IL_BYTE, r1));
    right.insertInstruction(1, new ILBinaryInstruction(102, ILOpcode.ADD, r0, r1, r2));

    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.code === SSAVerificationErrorCode.DOMINANCE_VIOLATION || e.code === SSAVerificationErrorCode.USE_BEFORE_DEFINITION
      )
    ).toBe(true);
  });

  it('Test S11.20: undefined register use is detected', () => {
    const func = new ILFunction('undefined_use', [], IL_VOID);
    const entry = func.getEntryBlock();

    const r0 = func.createRegister(IL_BYTE, 'r0');
    const r1 = func.createRegister(IL_BYTE, 'r1');
    const r2 = func.createRegister(IL_BYTE, 'r2');

    // Use r0 and r1 without defining them
    entry.addInstruction(new ILBinaryInstruction(0, ILOpcode.ADD, r0, r1, r2));
    entry.addInstruction(new ILReturnVoidInstruction(1));

    const domTree = computeDominators(func);
    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === SSAVerificationErrorCode.USE_BEFORE_DEFINITION)).toBe(true);
  });
});

// =============================================================================
// Test S11.21-S11.25: Phi Function Verification
// =============================================================================

describe('SSAVerifier Phi Function Tests (Session 11)', () => {
  it('Test S11.21: well-formed phi function passes', () => {
    const { func, domTree } = createDiamondCFG();
    const blocks = func.getBlocks();
    const left = blocks.find((b) => b.label === 'left')!;
    const right = blocks.find((b) => b.label === 'right')!;
    const merge = blocks.find((b) => b.label === 'merge')!;

    const r0 = func.createRegister(IL_BYTE, 'r0');
    const r1 = func.createRegister(IL_BYTE, 'r1');
    const r2 = func.createRegister(IL_BYTE, 'r2');

    // Define values in branches
    left.insertInstruction(0, new ILConstInstruction(100, 10, IL_BYTE, r0));
    right.insertInstruction(0, new ILConstInstruction(101, 20, IL_BYTE, r1));

    // Phi at merge with correct operands (constructor: id, sources, result)
    const phi = new ILPhiInstruction(102, [
      { blockId: left.id, value: r0 },
      { blockId: right.id, value: r1 },
    ], r2);
    merge.insertInstruction(0, phi);

    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(true);
    expect(result.stats.phisVerified).toBe(1);
  });

  it('Test S11.22: phi with missing predecessor operand is invalid', () => {
    const { func, domTree } = createDiamondCFG();
    const blocks = func.getBlocks();
    const left = blocks.find((b) => b.label === 'left')!;
    const merge = blocks.find((b) => b.label === 'merge')!;

    const r0 = func.createRegister(IL_BYTE, 'r0');
    const r2 = func.createRegister(IL_BYTE, 'r2');

    left.insertInstruction(0, new ILConstInstruction(100, 10, IL_BYTE, r0));

    // Phi missing operand from right predecessor (constructor: id, sources, result)
    const phi = new ILPhiInstruction(102, [{ blockId: left.id, value: r0 }], r2);
    merge.insertInstruction(0, phi);

    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.code === SSAVerificationErrorCode.PHI_MISSING_OPERAND ||
          e.code === SSAVerificationErrorCode.PHI_OPERAND_COUNT_MISMATCH
      )
    ).toBe(true);
  });

  it('Test S11.23: phi with invalid predecessor is invalid', () => {
    const { func, domTree } = createDiamondCFG();
    const blocks = func.getBlocks();
    const left = blocks.find((b) => b.label === 'left')!;
    const merge = blocks.find((b) => b.label === 'merge')!;
    const entry = blocks.find((b) => b.label === 'entry')!;

    const r0 = func.createRegister(IL_BYTE, 'r0');
    const r1 = func.createRegister(IL_BYTE, 'r1');
    const r2 = func.createRegister(IL_BYTE, 'r2');

    left.insertInstruction(0, new ILConstInstruction(100, 10, IL_BYTE, r0));

    // Phi with operand from entry (not a predecessor of merge) (constructor: id, sources, result)
    const phi = new ILPhiInstruction(102, [
      { blockId: left.id, value: r0 },
      { blockId: entry.id, value: r1 }, // entry is not a predecessor of merge
    ], r2);
    merge.insertInstruction(0, phi);

    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === SSAVerificationErrorCode.PHI_INVALID_PREDECESSOR)).toBe(true);
  });

  it('Test S11.24: phi in entry block is invalid', () => {
    const func = new ILFunction('phi_in_entry', [], IL_VOID);
    const entry = func.getEntryBlock();

    const r0 = func.createRegister(IL_BYTE, 'r0');
    const r1 = func.createRegister(IL_BYTE, 'r1');

    // Phi in entry block - invalid since entry has no predecessors (constructor: id, sources, result)
    const phi = new ILPhiInstruction(0, [{ blockId: 999, value: r1 }], r0);
    entry.addInstruction(phi);
    entry.addInstruction(new ILReturnVoidInstruction(1));

    const domTree = computeDominators(func);
    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === SSAVerificationErrorCode.PHI_IN_ENTRY_BLOCK)).toBe(true);
  });

  it('Test S11.25: phi not at block start is invalid', () => {
    const { func, domTree } = createDiamondCFG();
    const blocks = func.getBlocks();
    const left = blocks.find((b) => b.label === 'left')!;
    const right = blocks.find((b) => b.label === 'right')!;
    const merge = blocks.find((b) => b.label === 'merge')!;

    const r0 = func.createRegister(IL_BYTE, 'r0');
    const r1 = func.createRegister(IL_BYTE, 'r1');
    const r2 = func.createRegister(IL_BYTE, 'r2');
    const r3 = func.createRegister(IL_BYTE, 'r3');

    left.insertInstruction(0, new ILConstInstruction(100, 10, IL_BYTE, r0));
    right.insertInstruction(0, new ILConstInstruction(101, 20, IL_BYTE, r1));

    // Add a non-phi instruction first at position 0
    merge.insertInstruction(0, new ILConstInstruction(102, 30, IL_BYTE, r3));

    // Then add phi after non-phi instruction - invalid (constructor: id, sources, result)
    const phi = new ILPhiInstruction(103, [
      { blockId: left.id, value: r0 },
      { blockId: right.id, value: r1 },
    ], r2);
    // Insert phi at index 1 (after the const instruction)
    merge.insertInstruction(1, phi);

    const result = verifySSA(func, domTree);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === SSAVerificationErrorCode.PHI_NOT_AT_BLOCK_START)).toBe(true);
  });
});
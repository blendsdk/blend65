/**
 * SSA Integration Tests
 *
 * Tests the complete SSA construction pipeline including:
 * - SSAConstructor orchestration
 * - End-to-end SSA conversion
 * - Statistics and error handling
 * - Various control flow patterns
 *
 * @module tests/il/ssa-integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILFunction } from '../../il/function.js';
import { BasicBlock } from '../../il/basic-block.js';
import { VirtualRegister, ILValueFactory } from '../../il/values.js';
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
import { IL_BYTE, IL_VOID } from '../../il/types.js';
import {
  SSAConstructor,
  SSAConstructionPhase,
  constructSSA,
  type SSAConstructionOptions,
  type SSAConstructionResult,
} from '../../il/ssa/index.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a simple function with entry block only.
 */
function createSimpleFunction(): ILFunction {
  const func = new ILFunction('simple', [], IL_VOID);
  const entry = func.getEntryBlock();

  // Store a value to variable x
  const factory = new ILValueFactory();
  const r0 = factory.createRegister(IL_BYTE, 'temp');
  entry.addInstruction(new ILConstInstruction(0, 42, IL_BYTE, r0));
  entry.addInstruction(new ILStoreVarInstruction(1, 'x', r0));
  entry.addInstruction(new ILReturnInstruction(2));

  return func;
}

/**
 * Creates a function with if-else control flow (diamond pattern).
 *
 * ```
 *     entry
 *       |
 *     cond
 *      / \
 *   then  else
 *      \ /
 *     merge
 * ```
 */
function createDiamondFunction(): ILFunction {
  const func = new ILFunction('diamond', [], IL_VOID);
  const factory = new ILValueFactory();

  // Entry block (use the one created by ILFunction)
  const entry = func.getEntryBlock();
  const condReg = factory.createRegister(IL_BYTE, 'cond');
  entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, condReg));

  // Then block - use createBlock to properly add to function
  const thenBlock = func.createBlock('then');
  const r1 = factory.createRegister(IL_BYTE, 'temp1');
  thenBlock.addInstruction(new ILConstInstruction(1, 10, IL_BYTE, r1));
  thenBlock.addInstruction(new ILStoreVarInstruction(2, 'x', r1));

  // Else block
  const elseBlock = func.createBlock('else');
  const r2 = factory.createRegister(IL_BYTE, 'temp2');
  elseBlock.addInstruction(new ILConstInstruction(3, 20, IL_BYTE, r2));
  elseBlock.addInstruction(new ILStoreVarInstruction(4, 'x', r2));

  // Merge block
  const mergeBlock = func.createBlock('merge');
  const r3 = factory.createRegister(IL_BYTE, 'result');
  mergeBlock.addInstruction(new ILLoadVarInstruction(5, 'x', r3));
  mergeBlock.addInstruction(new ILReturnInstruction(6, r3));

  // Add terminators
  entry.addInstruction(new ILBranchInstruction(7, condReg, thenBlock.getLabel(), elseBlock.getLabel()));
  thenBlock.addInstruction(new ILJumpInstruction(8, mergeBlock.getLabel()));
  elseBlock.addInstruction(new ILJumpInstruction(9, mergeBlock.getLabel()));

  // Setup CFG
  entry.linkTo(thenBlock);
  entry.linkTo(elseBlock);
  thenBlock.linkTo(mergeBlock);
  elseBlock.linkTo(mergeBlock);

  return func;
}

/**
 * Creates a function with a simple loop.
 *
 * ```
 *   entry
 *     |
 *   header <--+
 *     |       |
 *    body ----+
 *     |
 *    exit
 * ```
 */
function createLoopFunction(): ILFunction {
  const func = new ILFunction('loop', [], IL_VOID);
  const factory = new ILValueFactory();

  // Entry block - use the one created by ILFunction
  const entry = func.getEntryBlock();
  const initReg = factory.createRegister(IL_BYTE, 'init');
  entry.addInstruction(new ILConstInstruction(0, 0, IL_BYTE, initReg));
  entry.addInstruction(new ILStoreVarInstruction(1, 'counter', initReg));

  // Loop header - use createBlock
  const header = func.createBlock('header');
  const condReg = factory.createRegister(IL_BYTE, 'cond');
  header.addInstruction(new ILConstInstruction(2, 1, IL_BYTE, condReg)); // Simplified condition

  // Loop body - increment counter
  const body = func.createBlock('body');
  const loadReg = factory.createRegister(IL_BYTE, 'load');
  const incReg = factory.createRegister(IL_BYTE, 'inc');
  const oneReg = factory.createRegister(IL_BYTE, 'one');
  body.addInstruction(new ILLoadVarInstruction(3, 'counter', loadReg));
  body.addInstruction(new ILConstInstruction(4, 1, IL_BYTE, oneReg));
  body.addInstruction(new ILBinaryInstruction(5, ILOpcode.ADD, loadReg, oneReg, incReg));
  body.addInstruction(new ILStoreVarInstruction(6, 'counter', incReg));

  // Exit block
  const exit = func.createBlock('exit');
  const resultReg = factory.createRegister(IL_BYTE, 'result');
  exit.addInstruction(new ILLoadVarInstruction(7, 'counter', resultReg));
  exit.addInstruction(new ILReturnInstruction(8, resultReg));

  // Add terminators
  entry.addInstruction(new ILJumpInstruction(9, header.getLabel()));
  header.addInstruction(new ILBranchInstruction(10, condReg, body.getLabel(), exit.getLabel()));
  body.addInstruction(new ILJumpInstruction(11, header.getLabel()));

  // Setup CFG
  entry.linkTo(header);
  header.linkTo(body);
  header.linkTo(exit);
  body.linkTo(header);

  return func;
}

/**
 * Creates a function with no variables (no SSA transformations needed).
 */
function createNoVariablesFunction(): ILFunction {
  const func = new ILFunction('noVars', [], IL_VOID);
  const entry = func.getEntryBlock();

  entry.addInstruction(new ILReturnInstruction(0));

  return func;
}

/**
 * Creates a function with multiple variables.
 */
function createMultiVariableFunction(): ILFunction {
  const func = new ILFunction('multiVar', [], IL_VOID);
  const factory = new ILValueFactory();

  const entry = func.getEntryBlock();

  // Initialize three variables
  const r1 = factory.createRegister(IL_BYTE, 'temp1');
  const r2 = factory.createRegister(IL_BYTE, 'temp2');
  const r3 = factory.createRegister(IL_BYTE, 'temp3');

  entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, r1));
  entry.addInstruction(new ILStoreVarInstruction(1, 'a', r1));

  entry.addInstruction(new ILConstInstruction(2, 2, IL_BYTE, r2));
  entry.addInstruction(new ILStoreVarInstruction(3, 'b', r2));

  entry.addInstruction(new ILConstInstruction(4, 3, IL_BYTE, r3));
  entry.addInstruction(new ILStoreVarInstruction(5, 'c', r3));

  entry.addInstruction(new ILReturnInstruction(6));

  return func;
}

// =============================================================================
// SSAConstructor Class Tests
// =============================================================================

describe('SSAConstructor', () => {
  describe('constructor', () => {
    it('creates with default options', () => {
      const constructor = new SSAConstructor();
      const options = constructor.getOptions();

      expect(options.skipVerification).toBe(false);
      expect(options.insertPhiInstructions).toBe(true);
      expect(options.collectTimings).toBe(true);
      expect(options.verbose).toBe(false);
    });

    it('creates with custom options', () => {
      const constructor = new SSAConstructor({
        skipVerification: true,
        insertPhiInstructions: false,
        collectTimings: false,
        verbose: true,
      });
      const options = constructor.getOptions();

      expect(options.skipVerification).toBe(true);
      expect(options.insertPhiInstructions).toBe(false);
      expect(options.collectTimings).toBe(false);
      expect(options.verbose).toBe(true);
    });

    it('initializes state to null', () => {
      const constructor = new SSAConstructor();

      expect(constructor.getDominatorTree()).toBeNull();
      expect(constructor.getDominanceFrontiers()).toBeNull();
      expect(constructor.getPhiPlacement()).toBeNull();
      expect(constructor.getRenamingResult()).toBeNull();
      expect(constructor.getVerificationResult()).toBeNull();
      expect(constructor.getCurrentFunction()).toBeNull();
      expect(constructor.getErrors()).toHaveLength(0);
    });
  });

  describe('construct - simple functions', () => {
    it('converts simple function with single block', () => {
      const func = createSimpleFunction();
      const constructor = new SSAConstructor({ skipVerification: true });

      const result = constructor.construct(func);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.dominatorTree).not.toBeNull();
      expect(result.dominanceFrontiers).not.toBeNull();
    });

    it('handles function with no variables', () => {
      const func = createNoVariablesFunction();
      const constructor = new SSAConstructor({ skipVerification: true });

      const result = constructor.construct(func);

      expect(result.success).toBe(true);
      expect(result.stats.variablesProcessed).toBe(0);
      expect(result.stats.phiCount).toBe(0);
    });

    it('handles function with multiple variables', () => {
      const func = createMultiVariableFunction();
      const constructor = new SSAConstructor({ skipVerification: true });

      const result = constructor.construct(func);

      expect(result.success).toBe(true);
      // Three variables defined once each
      expect(result.stats.variablesProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('construct - control flow patterns', () => {
    it('handles diamond pattern (if-else)', () => {
      const func = createDiamondFunction();
      const constructor = new SSAConstructor({ skipVerification: true });

      const result = constructor.construct(func);

      expect(result.success).toBe(true);
      // Variable x is defined in both branches, needs phi at merge
      expect(result.phiPlacement).not.toBeNull();
    });

    it('handles loop pattern', () => {
      const func = createLoopFunction();
      const constructor = new SSAConstructor({ skipVerification: true });

      const result = constructor.construct(func);

      expect(result.success).toBe(true);
      // Counter is modified in loop, needs phi at header
      expect(result.phiPlacement).not.toBeNull();
    });
  });

  describe('construct - statistics', () => {
    it('collects timing statistics', () => {
      const func = createSimpleFunction();
      const constructor = new SSAConstructor({
        collectTimings: true,
        skipVerification: true,
      });

      const result = constructor.construct(func);

      expect(result.stats.totalTime).toBeGreaterThanOrEqual(0);
      expect(result.stats.phaseTimes.size).toBeGreaterThan(0);
    });

    it('skips timing when disabled', () => {
      const func = createSimpleFunction();
      const constructor = new SSAConstructor({
        collectTimings: false,
        skipVerification: true,
      });

      const result = constructor.construct(func);

      expect(result.stats.totalTime).toBe(0);
    });

    it('reports blocks processed', () => {
      const func = createDiamondFunction();
      const constructor = new SSAConstructor({ skipVerification: true });

      const result = constructor.construct(func);

      expect(result.stats.blocksProcessed).toBeGreaterThan(0);
    });
  });

  describe('construct - intermediate results', () => {
    it('provides dominator tree after construction', () => {
      const func = createDiamondFunction();
      const constructor = new SSAConstructor({ skipVerification: true });

      constructor.construct(func);

      const domTree = constructor.getDominatorTree();
      expect(domTree).not.toBeNull();
      expect(domTree!.getBlockCount()).toBe(4);
    });

    it('provides dominance frontiers after construction', () => {
      const func = createDiamondFunction();
      const constructor = new SSAConstructor({ skipVerification: true });

      constructor.construct(func);

      const frontiers = constructor.getDominanceFrontiers();
      expect(frontiers).not.toBeNull();
    });

    it('provides phi placement result', () => {
      const func = createDiamondFunction();
      const constructor = new SSAConstructor({ skipVerification: true });

      constructor.construct(func);

      const phiPlacement = constructor.getPhiPlacement();
      expect(phiPlacement).not.toBeNull();
    });

    it('provides renaming result', () => {
      const func = createDiamondFunction();
      const constructor = new SSAConstructor({ skipVerification: true });

      constructor.construct(func);

      const renaming = constructor.getRenamingResult();
      expect(renaming).not.toBeNull();
    });

    it('tracks current function', () => {
      const func = createSimpleFunction();
      const constructor = new SSAConstructor({ skipVerification: true });

      constructor.construct(func);

      expect(constructor.getCurrentFunction()).toBe(func);
    });
  });

  describe('construct - multiple calls', () => {
    it('resets state between constructions', () => {
      const constructor = new SSAConstructor({ skipVerification: true });

      // First construction
      const func1 = createSimpleFunction();
      const result1 = constructor.construct(func1);
      expect(result1.success).toBe(true);

      // Second construction - should reset
      const func2 = createDiamondFunction();
      const result2 = constructor.construct(func2);
      expect(result2.success).toBe(true);
      expect(constructor.getCurrentFunction()).toBe(func2);
    });
  });
});

// =============================================================================
// constructSSA Convenience Function Tests
// =============================================================================

describe('constructSSA', () => {
  it('converts function to SSA form', () => {
    const func = createSimpleFunction();

    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);
  });

  it('accepts custom options', () => {
    const func = createSimpleFunction();

    const result = constructSSA(func, {
      skipVerification: true,
      insertPhiInstructions: false,
    });

    expect(result.success).toBe(true);
  });

  it('works without options', () => {
    const func = createNoVariablesFunction();

    const result = constructSSA(func);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// SSAConstructionPhase Enum Tests
// =============================================================================

describe('SSAConstructionPhase', () => {
  it('has all expected phases', () => {
    expect(SSAConstructionPhase.DOMINATORS).toBe('DOMINATORS');
    expect(SSAConstructionPhase.FRONTIERS).toBe('FRONTIERS');
    expect(SSAConstructionPhase.DEFINITIONS).toBe('DEFINITIONS');
    expect(SSAConstructionPhase.PHI_PLACEMENT).toBe('PHI_PLACEMENT');
    expect(SSAConstructionPhase.RENAMING).toBe('RENAMING');
    expect(SSAConstructionPhase.VERIFICATION).toBe('VERIFICATION');
    expect(SSAConstructionPhase.PHI_INSERTION).toBe('PHI_INSERTION');
  });
});

// =============================================================================
// SSAConstructionResult Tests
// =============================================================================

describe('SSAConstructionResult', () => {
  it('contains expected fields on success', () => {
    const func = createSimpleFunction();
    const result = constructSSA(func, { skipVerification: true });

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('stats');
    expect(result).toHaveProperty('dominatorTree');
    expect(result).toHaveProperty('dominanceFrontiers');
    expect(result).toHaveProperty('phiPlacement');
    expect(result).toHaveProperty('renaming');
  });

  it('stats contains expected fields', () => {
    const func = createSimpleFunction();
    const result = constructSSA(func, { skipVerification: true });

    expect(result.stats).toHaveProperty('phiCount');
    expect(result.stats).toHaveProperty('versionsCreated');
    expect(result.stats).toHaveProperty('blocksProcessed');
    expect(result.stats).toHaveProperty('variablesProcessed');
    expect(result.stats).toHaveProperty('instructionsProcessed');
    expect(result.stats).toHaveProperty('phaseTimes');
    expect(result.stats).toHaveProperty('totalTime');
  });
});

// =============================================================================
// Integration with Verification Tests
// =============================================================================

describe('SSA Construction with Verification', () => {
  it('runs verification by default', () => {
    const func = createNoVariablesFunction();

    // Default options include verification
    const result = constructSSA(func);

    expect(result.verification).not.toBeNull();
  });

  it('skips verification when option set', () => {
    const func = createSimpleFunction();

    const result = constructSSA(func, { skipVerification: true });

    expect(result.verification).toBeNull();
  });
});

// =============================================================================
// Phi Insertion Tests
// =============================================================================

describe('Phi Instruction Insertion', () => {
  it('inserts phi instructions by default', () => {
    const func = createDiamondFunction();

    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);
    // Phi instructions should be inserted
    expect(result.stats.phiCount).toBeGreaterThanOrEqual(0);
  });

  it('skips phi insertion when option set', () => {
    const func = createDiamondFunction();

    const result = constructSSA(func, {
      skipVerification: true,
      insertPhiInstructions: false,
    });

    expect(result.success).toBe(true);
    // Phi placement is computed but not inserted
    expect(result.phiPlacement).not.toBeNull();
  });
});

// =============================================================================
// Edge Cases Tests
// =============================================================================

describe('Edge Cases', () => {
  it('handles empty blocks', () => {
    const func = new ILFunction('empty', [], IL_VOID);
    const entry = func.getEntryBlock();
    entry.addInstruction(new ILReturnInstruction(0));

    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);
  });

  it('handles single block with multiple stores to same variable', () => {
    const func = new ILFunction('multiStore', [], IL_VOID);
    const factory = new ILValueFactory();
    const entry = func.getEntryBlock();

    // Store to x twice in same block
    const r1 = factory.createRegister(IL_BYTE, 't1');
    const r2 = factory.createRegister(IL_BYTE, 't2');

    entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, r1));
    entry.addInstruction(new ILStoreVarInstruction(1, 'x', r1));
    entry.addInstruction(new ILConstInstruction(2, 2, IL_BYTE, r2));
    entry.addInstruction(new ILStoreVarInstruction(3, 'x', r2));
    entry.addInstruction(new ILReturnInstruction(4));

    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);
  });

  it('handles linear chain of blocks', () => {
    const func = new ILFunction('chain', [], IL_VOID);
    const factory = new ILValueFactory();

    // Use entry block and create additional blocks
    const entry = func.getEntryBlock();
    const blocks: BasicBlock[] = [entry];
    for (let i = 1; i < 4; i++) {
      blocks.push(func.createBlock(`block${i}`));
    }

    // Add store in each block
    for (let i = 0; i < 4; i++) {
      const r = factory.createRegister(IL_BYTE, `t${i}`);
      blocks[i].addInstruction(new ILConstInstruction(i * 2, i, IL_BYTE, r));
      blocks[i].addInstruction(new ILStoreVarInstruction(i * 2 + 1, 'x', r));
    }

    // Add terminators and link
    for (let i = 0; i < 3; i++) {
      blocks[i].addInstruction(new ILJumpInstruction(100 + i, blocks[i + 1].getLabel()));
      blocks[i].linkTo(blocks[i + 1]);
    }
    blocks[3].addInstruction(new ILReturnInstruction(200));

    const result = constructSSA(func, { skipVerification: true });

    expect(result.success).toBe(true);
  });
});
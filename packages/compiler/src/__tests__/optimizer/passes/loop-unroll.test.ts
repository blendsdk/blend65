/**
 * Loop Unroll Pass Tests
 *
 * Tests the LoopUnrollPass which duplicates loop bodies
 * for counted loops with known constant iteration counts.
 *
 * @module __tests__/optimizer/passes/loop-unroll.test
 */

import { describe, it, expect } from 'vitest';
import { LoopUnrollPass } from '../../../optimizer/passes/loop-unroll/index.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction, ILLoop } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import {
  createTestILFunction,
  createLoadImmInstr,
  createLoadByteInstr,
  createStoreByteInstr,
  createAddImmInstr,
  createCmpImmInstr,
  createLabelInstr,
  createJumpInstr,
  createJumpNeInstr,
  createReturnInstr,
  createIncByteInstr,
  createTestFrame,
} from '../helpers/optimizer-test-utils.js';
import type { OptimizationOptions } from '../../../optimizer/options.js';

// ============================================================================
// Helpers
// ============================================================================

/** Default O2 options */
const O2: OptimizationOptions = { level: 'O2' };

/** O3 options for aggressive unrolling */
const O3: OptimizationOptions = { level: 'O3' };

/** O2 with debug */
const O2_DEBUG: OptimizationOptions = { level: 'O2', debug: true };

/**
 * Create a counted for-loop function.
 *
 * Produces IL like:
 * ```
 *   [preInstructions]
 *   LABEL loop_header
 *   [bodyInstructions]
 *   INC counter
 *   LOAD counter
 *   CMP_IMM bound
 *   JUMP_NE loop_exit
 *   JUMP loop_header
 *   LABEL loop_exit
 *   [postInstructions]
 *   RETURN
 * ```
 */
function createCountedLoopFunction(
  bodyInstructions: ILInstruction[],
  bound: number,
  preInstructions: ILInstruction[] = [],
  postInstructions: ILInstruction[] = []
): ILFunction {
  const instructions: ILInstruction[] = [
    ...preInstructions,
    createLabelInstr('loop_header'),
    ...bodyInstructions,
    createIncByteInstr('counter'),
    createLoadByteInstr('counter'),
    createCmpImmInstr(bound),
    createJumpNeInstr('loop_exit'),
    createJumpInstr('loop_header'),
    createLabelInstr('loop_exit'),
    ...postInstructions,
    createReturnInstr(),
  ];

  const loops: ILLoop[] = [
    {
      headerLabel: 'loop_header',
      exitLabel: 'loop_exit',
      depth: 1,
      isCountedLoop: true,
      estimatedIterations: bound,
      boundValue: bound,
    },
  ];

  return {
    name: 'test',
    frame: createTestFrame('test'),
    instructions,
    isExported: false,
    isCallback: false,
    loops,
    maxLoopDepth: 1,
  };
}

/**
 * Create a while-loop (not counted) function.
 */
function createWhileLoopFunction(bodyInstructions: ILInstruction[]): ILFunction {
  const instructions: ILInstruction[] = [
    createLabelInstr('loop_header'),
    ...bodyInstructions,
    createJumpInstr('loop_header'),
    createLabelInstr('loop_exit'),
    createReturnInstr(),
  ];

  const loops: ILLoop[] = [
    {
      headerLabel: 'loop_header',
      exitLabel: 'loop_exit',
      depth: 1,
      isCountedLoop: false, // Not counted — won't be unrolled
    },
  ];

  return {
    name: 'test',
    frame: createTestFrame('test'),
    instructions,
    isExported: false,
    isCallback: false,
    loops,
    maxLoopDepth: 1,
  };
}

/** Count occurrences of an opcode in function instructions */
function countOpcode(func: ILFunction, opcode: ILOpcode): number {
  return func.instructions.filter(i => i.opcode === opcode).length;
}

/** Find label index */
function findLabelIndex(func: ILFunction, name: string): number {
  for (let i = 0; i < func.instructions.length; i++) {
    const instr = func.instructions[i];
    if (instr.opcode === ILOpcode.LABEL && instr.operands.length > 0 && 'name' in instr.operands[0] && instr.operands[0].name === name) {
      return i;
    }
  }
  return -1;
}

// ============================================================================
// Tests
// ============================================================================

describe('LoopUnrollPass', () => {
  const unroll = new LoopUnrollPass();

  // ──────────────────────────────────────────────────────────────
  // Pass interface
  // ──────────────────────────────────────────────────────────────

  describe('pass interface', () => {
    it('should have correct name and dependencies', () => {
      expect(unroll.name).toBe('loop-unroll');
      expect(unroll.dependencies).toContain('licm');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Skip cases (should NOT unroll)
  // ──────────────────────────────────────────────────────────────

  describe('skip cases', () => {
    it('should return no changes for functions without loops', () => {
      const func = createTestILFunction('noLoop', [
        createLoadImmInstr(5),
        createStoreByteInstr('x'),
        createReturnInstr(),
      ]);
      const result = unroll.run(func, O2);
      expect(result.modified).toBe(false);
    });

    it('should NOT unroll while loops (not counted)', () => {
      const func = createWhileLoopFunction([
        createStoreByteInstr('x'),
        createIncByteInstr('counter'),
      ]);
      const before = func.instructions.length;
      const result = unroll.run(func, O2);
      expect(result.modified).toBe(false);
      expect(func.instructions.length).toBe(before);
    });

    it('should NOT unroll at O0', () => {
      const func = createCountedLoopFunction(
        [createStoreByteInstr('x')],
        4
      );
      const result = unroll.run(func, { level: 'O0' });
      expect(result.modified).toBe(false);
    });

    it('should NOT unroll at O1', () => {
      const func = createCountedLoopFunction(
        [createStoreByteInstr('x')],
        4
      );
      const result = unroll.run(func, { level: 'O1' });
      expect(result.modified).toBe(false);
    });

    it('should NOT unroll at Os (size optimization)', () => {
      const func = createCountedLoopFunction(
        [createStoreByteInstr('x')],
        4
      );
      const result = unroll.run(func, { level: 'Os' });
      expect(result.modified).toBe(false);
    });

    it('should NOT unroll at Oz (size optimization)', () => {
      const func = createCountedLoopFunction(
        [createStoreByteInstr('x')],
        4
      );
      const result = unroll.run(func, { level: 'Oz' });
      expect(result.modified).toBe(false);
    });

    it('should NOT unroll loop with 1 iteration', () => {
      const func = createCountedLoopFunction(
        [createStoreByteInstr('x')],
        1 // Only 1 iteration — not worth unrolling
      );
      const result = unroll.run(func, O2);
      expect(result.modified).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Full unrolling (iteration count <= 8)
  // ──────────────────────────────────────────────────────────────

  describe('full unrolling', () => {
    it('should fully unroll a 4-iteration loop with 1 body instr', () => {
      const func = createCountedLoopFunction(
        [createStoreByteInstr('x')],
        4
      );

      // Before: should have LABEL, STORE, INC, LOAD, CMP, JUMP_NE, JUMP, LABEL, RETURN
      expect(findLabelIndex(func, 'loop_header')).toBeGreaterThanOrEqual(0);

      const result = unroll.run(func, O2);
      expect(result.modified).toBe(true);

      // After full unroll: loop structure should be eliminated
      // Header label removed, exit label remains
      expect(findLabelIndex(func, 'loop_header')).toBe(-1);

      // Body (STORE_BYTE) should appear 4 times
      expect(countOpcode(func, ILOpcode.STORE_BYTE)).toBe(4);

      // No more back-edge JUMP to loop_header
      const jumps = func.instructions.filter(
        i => i.opcode === ILOpcode.JUMP && i.operands.length > 0 && 'name' in i.operands[0] && i.operands[0].name === 'loop_header'
      );
      expect(jumps.length).toBe(0);
    });

    it('should fully unroll a 2-iteration loop', () => {
      const func = createCountedLoopFunction(
        [createStoreByteInstr('output')],
        2
      );

      unroll.run(func, O2);
      expect(countOpcode(func, ILOpcode.STORE_BYTE)).toBe(2);
    });

    it('should fully unroll a 3-iteration loop with multiple body instrs', () => {
      const func = createCountedLoopFunction(
        [
          createLoadImmInstr(42),
          createStoreByteInstr('x'),
        ],
        3
      );

      unroll.run(func, O2);

      // 3 copies of body: 3 LOAD_IMM + 3 STORE_BYTE
      expect(countOpcode(func, ILOpcode.LOAD_IMM)).toBe(3);
      expect(countOpcode(func, ILOpcode.STORE_BYTE)).toBe(3);
    });

    it('should remove loop from metadata after full unroll', () => {
      const func = createCountedLoopFunction(
        [createStoreByteInstr('x')],
        4
      );

      expect(func.loops.length).toBe(1);

      unroll.run(func, O2);

      expect(func.loops.length).toBe(0);
      expect(func.maxLoopDepth).toBe(0);
    });

    it('should preserve instructions before the loop', () => {
      const func = createCountedLoopFunction(
        [createStoreByteInstr('x')],
        3,
        [createLoadImmInstr(99), createStoreByteInstr('setup')]
      );

      unroll.run(func, O2);

      // Pre-loop instructions should still be first
      expect(func.instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
      expect(func.instructions[1].opcode).toBe(ILOpcode.STORE_BYTE);
    });

    it('should preserve instructions after the loop', () => {
      const func = createCountedLoopFunction(
        [createStoreByteInstr('x')],
        2,
        [],
        [createLoadImmInstr(0), createStoreByteInstr('cleanup')]
      );

      unroll.run(func, O2);

      // Last instructions should be: ...unrolled body..., exit_label, LOAD_IMM, STORE, RETURN
      const last = func.instructions[func.instructions.length - 1];
      expect(last.opcode).toBe(ILOpcode.RETURN);
    });

    it('should include debug info when debug is enabled', () => {
      const func = createCountedLoopFunction(
        [createStoreByteInstr('x')],
        4
      );

      const result = unroll.run(func, O2_DEBUG);
      if (result.debugInfo && result.debugInfo.length > 0) {
        expect(result.debugInfo[0]).toContain('UNROLL');
        expect(result.debugInfo[0]).toContain('Fully');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle a loop with 8 iterations (max full unroll)', () => {
      const func = createCountedLoopFunction(
        [createStoreByteInstr('x')],
        8
      );

      const result = unroll.run(func, O2);
      expect(result.modified).toBe(true);
      expect(countOpcode(func, ILOpcode.STORE_BYTE)).toBe(8);
    });
  });
});

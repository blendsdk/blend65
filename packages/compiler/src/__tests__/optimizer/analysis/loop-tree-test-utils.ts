/**
 * Loop Tree Test Utilities
 *
 * Shared helpers for creating test ILFunctions with loop structures.
 * Provides factory functions for building functions with single loops,
 * nested loops, sequential loops, and edge case configurations.
 *
 * @module __tests__/optimizer/analysis/loop-tree-test-utils
 */

import type { ILInstruction } from '../../../il/instruction.js';
import type { ILFunction, ILLoop } from '../../../il/structures.js';
import { createILLoop } from '../../../il/factories.js';
import {
  createTestILFunction,
  createLabelInstr,
  createLoadImmInstr,
  createStoreByteInstr,
  createLoadByteInstr,
  createJumpInstr,
  createJumpNeInstr,
  createReturnInstr,
  createIncByteInstr,
  createCmpImmInstr,
} from '../helpers/optimizer-test-utils.js';

// ============================================================================
// Single Loop Helpers
// ============================================================================

/**
 * Creates a function with a single while loop.
 *
 * Structure:
 * ```
 *   LOAD_IMM 0         [0]
 *   STORE_BYTE x        [1]
 *   LABEL while_0       [2]  ← header
 *   LOAD_BYTE x         [3]
 *   CMP_IMM 10          [4]
 *   JUMP_NE while_0_exit [5]
 *   INC_BYTE x          [6]
 *   JUMP while_0        [7]
 *   LABEL while_0_exit  [8]  ← exit
 *   RETURN              [9]
 * ```
 *
 * @returns ILFunction with one loop (header at 2, exit at 8)
 */
export function createSingleLoopFunc(): ILFunction {
  const instructions: ILInstruction[] = [
    createLoadImmInstr(0),          // [0]
    createStoreByteInstr('x'),      // [1]
    createLabelInstr('while_0'),    // [2] header
    createLoadByteInstr('x'),       // [3]
    createCmpImmInstr(10),          // [4]
    createJumpNeInstr('while_0_exit'), // [5]
    createIncByteInstr('x'),        // [6]
    createJumpInstr('while_0'),     // [7]
    createLabelInstr('while_0_exit'), // [8] exit
    createReturnInstr(),            // [9]
  ];

  const loops: ILLoop[] = [
    createILLoop('while_0', 'while_0_exit', 1, {
      isCountedLoop: false,
    }),
  ];

  const func = createTestILFunction('testFunc', instructions, true);
  func.loops = loops;
  func.maxLoopDepth = 1;
  return func;
}

/**
 * Creates a function with a counted for-loop (known iteration count).
 *
 * Structure:
 * ```
 *   LOAD_IMM 0         [0]
 *   STORE_BYTE i        [1]
 *   LABEL for_0         [2]  ← header
 *   LOAD_BYTE i         [3]
 *   CMP_IMM 8           [4]
 *   JUMP_NE for_0_exit  [5]
 *   LOAD_IMM 42         [6]  (loop body work)
 *   INC_BYTE i          [7]
 *   JUMP for_0          [8]
 *   LABEL for_0_exit    [9]  ← exit
 *   RETURN              [10]
 * ```
 *
 * @returns ILFunction with one counted loop (8 iterations)
 */
export function createCountedLoopFunc(): ILFunction {
  const instructions: ILInstruction[] = [
    createLoadImmInstr(0),          // [0]
    createStoreByteInstr('i'),      // [1]
    createLabelInstr('for_0'),      // [2] header
    createLoadByteInstr('i'),       // [3]
    createCmpImmInstr(8),           // [4]
    createJumpNeInstr('for_0_exit'), // [5]
    createLoadImmInstr(42),         // [6]
    createIncByteInstr('i'),        // [7]
    createJumpInstr('for_0'),       // [8]
    createLabelInstr('for_0_exit'), // [9] exit
    createReturnInstr(),            // [10]
  ];

  const loops: ILLoop[] = [
    createILLoop('for_0', 'for_0_exit', 1, {
      isCountedLoop: true,
      boundValue: 8,
      estimatedIterations: 8,
    }),
  ];

  const func = createTestILFunction('countedFunc', instructions, true);
  func.loops = loops;
  func.maxLoopDepth = 1;
  return func;
}

// ============================================================================
// Nested Loop Helpers
// ============================================================================

/**
 * Creates a function with two nested loops (outer + inner).
 *
 * Structure:
 * ```
 *   LOAD_IMM 0            [0]
 *   STORE_BYTE y           [1]
 *   LABEL outer            [2]  ← outer header
 *   LOAD_IMM 0             [3]
 *   STORE_BYTE x            [4]
 *   LABEL inner            [5]  ← inner header
 *   LOAD_BYTE x            [6]
 *   CMP_IMM 5              [7]
 *   JUMP_NE inner_exit     [8]
 *   INC_BYTE x             [9]
 *   JUMP inner             [10]
 *   LABEL inner_exit       [11] ← inner exit
 *   INC_BYTE y             [12]
 *   LOAD_BYTE y            [13]
 *   CMP_IMM 3              [14]
 *   JUMP_NE outer_exit     [15]
 *   JUMP outer             [16]
 *   LABEL outer_exit       [17] ← outer exit
 *   RETURN                 [18]
 * ```
 *
 * @returns ILFunction with nested loops (outer: 2-17, inner: 5-11)
 */
export function createNestedLoopFunc(): ILFunction {
  const instructions: ILInstruction[] = [
    createLoadImmInstr(0),              // [0]
    createStoreByteInstr('y'),          // [1]
    createLabelInstr('outer'),          // [2] outer header
    createLoadImmInstr(0),              // [3]
    createStoreByteInstr('x'),          // [4]
    createLabelInstr('inner'),          // [5] inner header
    createLoadByteInstr('x'),           // [6]
    createCmpImmInstr(5),               // [7]
    createJumpNeInstr('inner_exit'),    // [8]
    createIncByteInstr('x'),            // [9]
    createJumpInstr('inner'),           // [10]
    createLabelInstr('inner_exit'),     // [11] inner exit
    createIncByteInstr('y'),            // [12]
    createLoadByteInstr('y'),           // [13]
    createCmpImmInstr(3),               // [14]
    createJumpNeInstr('outer_exit'),    // [15]
    createJumpInstr('outer'),           // [16]
    createLabelInstr('outer_exit'),     // [17] outer exit
    createReturnInstr(),                // [18]
  ];

  const loops: ILLoop[] = [
    createILLoop('outer', 'outer_exit', 1, { isCountedLoop: false }),
    createILLoop('inner', 'inner_exit', 2, { isCountedLoop: false }),
  ];

  const func = createTestILFunction('nestedFunc', instructions, true);
  func.loops = loops;
  func.maxLoopDepth = 2;
  return func;
}

// ============================================================================
// Sequential Loop Helpers
// ============================================================================

/**
 * Creates a function with two sequential (non-nested) loops.
 *
 * Structure:
 * ```
 *   LOAD_IMM 0            [0]
 *   STORE_BYTE x           [1]
 *   LABEL loop_a           [2]  ← loop A header
 *   INC_BYTE x             [3]
 *   LOAD_BYTE x            [4]
 *   CMP_IMM 5              [5]
 *   JUMP_NE loop_a_exit    [6]
 *   JUMP loop_a            [7]
 *   LABEL loop_a_exit      [8]  ← loop A exit
 *   LOAD_IMM 0             [9]
 *   STORE_BYTE y            [10]
 *   LABEL loop_b           [11] ← loop B header
 *   INC_BYTE y             [12]
 *   LOAD_BYTE y            [13]
 *   CMP_IMM 3              [14]
 *   JUMP_NE loop_b_exit    [15]
 *   JUMP loop_b            [16]
 *   LABEL loop_b_exit      [17] ← loop B exit
 *   RETURN                 [18]
 * ```
 *
 * @returns ILFunction with two sequential loops at same depth
 */
export function createSequentialLoopsFunc(): ILFunction {
  const instructions: ILInstruction[] = [
    createLoadImmInstr(0),              // [0]
    createStoreByteInstr('x'),          // [1]
    createLabelInstr('loop_a'),         // [2] loop A header
    createIncByteInstr('x'),            // [3]
    createLoadByteInstr('x'),           // [4]
    createCmpImmInstr(5),               // [5]
    createJumpNeInstr('loop_a_exit'),   // [6]
    createJumpInstr('loop_a'),          // [7]
    createLabelInstr('loop_a_exit'),    // [8] loop A exit
    createLoadImmInstr(0),              // [9]
    createStoreByteInstr('y'),          // [10]
    createLabelInstr('loop_b'),         // [11] loop B header
    createIncByteInstr('y'),            // [12]
    createLoadByteInstr('y'),           // [13]
    createCmpImmInstr(3),               // [14]
    createJumpNeInstr('loop_b_exit'),   // [15]
    createJumpInstr('loop_b'),          // [16]
    createLabelInstr('loop_b_exit'),    // [17] loop B exit
    createReturnInstr(),                // [18]
  ];

  const loops: ILLoop[] = [
    createILLoop('loop_a', 'loop_a_exit', 1, { isCountedLoop: false }),
    createILLoop('loop_b', 'loop_b_exit', 1, { isCountedLoop: false }),
  ];

  const func = createTestILFunction('sequentialFunc', instructions, true);
  func.loops = loops;
  func.maxLoopDepth = 1;
  return func;
}

// ============================================================================
// Edge Case Helpers
// ============================================================================

/**
 * Creates a function with no loops (straight-line code).
 *
 * @returns ILFunction with no loops
 */
export function createNoLoopFunc(): ILFunction {
  const instructions: ILInstruction[] = [
    createLoadImmInstr(1),
    createStoreByteInstr('x'),
    createLoadImmInstr(2),
    createStoreByteInstr('y'),
    createReturnInstr(),
  ];

  const func = createTestILFunction('noLoopFunc', instructions, true);
  func.loops = [];
  func.maxLoopDepth = 0;
  return func;
}

/**
 * Creates a function with an empty instruction array.
 *
 * @returns ILFunction with no instructions and no loops
 */
export function createEmptyFunc(): ILFunction {
  const func = createTestILFunction('emptyFunc', [], true);
  func.loops = [];
  func.maxLoopDepth = 0;
  return func;
}

/**
 * Creates a function with a loop whose labels don't exist
 * in the instruction stream (unresolvable loop).
 *
 * The loop metadata references 'missing_header' and 'missing_exit'
 * but the instructions don't contain matching LABEL instructions.
 *
 * @returns ILFunction with unresolvable loop metadata
 */
export function createUnresolvableLoopFunc(): ILFunction {
  const instructions: ILInstruction[] = [
    createLoadImmInstr(1),
    createStoreByteInstr('x'),
    createReturnInstr(),
  ];

  const loops: ILLoop[] = [
    createILLoop('missing_header', 'missing_exit', 1, {
      isCountedLoop: false,
    }),
  ];

  const func = createTestILFunction('unresolvableFunc', instructions, true);
  func.loops = loops;
  func.maxLoopDepth = 1;
  return func;
}

/**
 * Volatile Protection Tests for Optimizer Passes
 *
 * Tests that @zp global variables (marked isVolatile) are properly
 * protected from incorrect optimizations:
 *
 * 1. DeadGlobalElimPass: Volatile stores in globalInit must NOT be eliminated
 * 2. CSEPass: Volatile loads must NOT be cached/reused across statements
 * 3. LICMPass: Volatile loads must NOT be hoisted out of loops
 *
 * These protections ensure that interrupt-accessible @zp globals
 * maintain correct semantics even under aggressive optimization.
 *
 * @module __tests__/optimizer/passes/volatile-protection
 */

import { describe, it, expect } from 'vitest';
import { DeadGlobalElimPass } from '../../../optimizer/passes/dead-global-elim.js';
import { CSEPass } from '../../../optimizer/passes/cse/cse.js';
import { LICMPass } from '../../../optimizer/passes/licm/licm-pass.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ILInstruction } from '../../../il/instruction.js';
import type { ILProgram } from '../../../il/structures.js';
import type { OptimizationOptions } from '../../../optimizer/options.js';
import {
  createTestILFunction,
  createTestILProgram,
  createLoadImmInstr,
  createStoreByteInstr,
  createLoadByteInstr,
  createReturnInstr,
  createAddImmInstr,
  createLabelInstr,
  createJumpInstr,
  createJumpNeInstr,
  createCmpImmInstr,
  createIncByteInstr,
} from '../helpers/optimizer-test-utils.js';

// ============================================================================
// Test Helpers
// ============================================================================

/** Creates O2 options (optimization level where these passes run) */
function opts(level: OptimizationOptions['level'] = 'O2'): OptimizationOptions {
  return { level, debug: false };
}

/**
 * Creates a LOAD_IMM instruction marked as volatile.
 *
 * Simulates an IL instruction generated for a @zp global initializer.
 */
function createVolatileLoadImm(value: number): ILInstruction {
  const instr = createLoadImmInstr(value);
  return { ...instr, isVolatile: true };
}

/**
 * Creates a STORE_BYTE instruction marked as volatile.
 *
 * Simulates an IL instruction generated for a @zp global store.
 */
function createVolatileStoreByteInstr(slotName: string): ILInstruction {
  const instr = createStoreByteInstr(slotName);
  return { ...instr, isVolatile: true };
}

/**
 * Creates a LOAD_BYTE instruction marked as volatile.
 *
 * Simulates an IL instruction generated for reading a @zp global.
 */
function createVolatileLoadByteInstr(slotName: string): ILInstruction {
  const instr = createLoadByteInstr(slotName);
  return { ...instr, isVolatile: true };
}

/**
 * Creates a test program with globalInit instructions.
 * Allows mixing volatile and non-volatile global init pairs.
 */
function createProgramWithGlobalInit(
  functions: ReturnType<typeof createTestILFunction>[],
  globalInit: ILInstruction[],
  entryPoint = 'main'
): ILProgram {
  const program = createTestILProgram(functions, entryPoint);
  program.globalInit = globalInit;
  return program;
}

// ============================================================================
// DeadGlobalElimPass — Volatile Protection
// ============================================================================

describe('DeadGlobalElimPass — volatile protection', () => {
  const pass = new DeadGlobalElimPass();

  it('should NOT eliminate volatile (@zp) global stores even when unreferenced', () => {
    // Setup: main function does NOT reference 'zpScore'
    const main = createTestILFunction('main', [
      createLoadImmInstr(42),
      createReturnInstr(),
    ]);

    // globalInit has a volatile store for @zp zpScore
    const program = createProgramWithGlobalInit([main], [
      createVolatileLoadImm(0),
      createVolatileStoreByteInstr('zpScore'),
    ]);

    const initCountBefore = program.globalInit.length;
    pass.run(program, opts());

    // The volatile store must be preserved despite no function referencing it
    expect(program.globalInit.length).toBe(initCountBefore);
    expect(program.globalInit.some(
      i => i.opcode === ILOpcode.STORE_BYTE && i.isVolatile
    )).toBe(true);
  });

  it('should eliminate non-volatile unreferenced globals normally', () => {
    // Setup: main function does NOT reference 'unusedRam'
    const main = createTestILFunction('main', [
      createLoadImmInstr(42),
      createReturnInstr(),
    ]);

    // globalInit has a non-volatile store for a normal @ram global
    const program = createProgramWithGlobalInit([main], [
      createLoadImmInstr(0),
      createStoreByteInstr('unusedRam'),
    ]);

    pass.run(program, opts());

    // The non-volatile unreferenced global SHOULD be eliminated
    expect(program.globalInit.length).toBe(0);
  });

  it('should keep volatile globals while eliminating non-volatile dead globals', () => {
    // Setup: main references 'usedGlobal' but NOT 'zpPinned' or 'deadGlobal'
    const main = createTestILFunction('main', [
      createLoadByteInstr('usedGlobal'),
      createReturnInstr(),
    ]);

    const program = createProgramWithGlobalInit([main], [
      // @zp volatile global — must be kept even though unreferenced
      createVolatileLoadImm(0),
      createVolatileStoreByteInstr('zpPinned'),
      // Normal unreferenced global — should be eliminated
      createLoadImmInstr(0),
      createStoreByteInstr('deadGlobal'),
      // Normal referenced global — should be kept
      createLoadImmInstr(100),
      createStoreByteInstr('usedGlobal'),
    ]);

    pass.run(program, opts());

    // zpPinned kept (volatile), deadGlobal removed, usedGlobal kept (referenced)
    const slotNames = program.globalInit
      .filter(i => i.opcode === ILOpcode.STORE_BYTE)
      .map(i => i.operands[0]?.kind === 'slot' ? (i.operands[0] as any).slot.name : '');

    expect(slotNames).toContain('zpPinned');
    expect(slotNames).toContain('usedGlobal');
    expect(slotNames).not.toContain('deadGlobal');
  });

  it('should preserve multiple volatile globals', () => {
    const main = createTestILFunction('main', [
      createReturnInstr(),
    ]);

    const program = createProgramWithGlobalInit([main], [
      createVolatileLoadImm(0),
      createVolatileStoreByteInstr('zpA'),
      createVolatileLoadImm(1),
      createVolatileStoreByteInstr('zpB'),
      createVolatileLoadImm(2),
      createVolatileStoreByteInstr('zpC'),
    ]);

    const initCountBefore = program.globalInit.length;
    pass.run(program, opts());

    // All volatile globals must be preserved
    expect(program.globalInit.length).toBe(initCountBefore);
  });
});

// ============================================================================
// CSEPass — Volatile Protection
// ============================================================================

describe('CSEPass — volatile protection', () => {
  const pass = new CSEPass();

  it('should NOT CSE-eliminate volatile loads', () => {
    // If a @zp global load is volatile, the CSE pass must not track
    // the accumulator state from it, preventing expression reuse.
    //
    // Pattern: LOAD_BYTE zpVar (volatile) → ADD_IMM 1 → STORE result
    //          LOAD_BYTE zpVar (volatile) → ADD_IMM 1 → STORE result2
    // Without volatile: CSE would replace second LOAD+ADD with LOAD result
    // With volatile: both loads must be preserved (value may have changed)
    const func = createTestILFunction('test', [
      createVolatileLoadByteInstr('zpVar'),
      createAddImmInstr(1),
      createStoreByteInstr('result'),
      createVolatileLoadByteInstr('zpVar'),
      createAddImmInstr(1),
      createStoreByteInstr('result2'),
      createReturnInstr(),
    ]);

    const countBefore = func.instructions.length;
    pass.run(func, opts());

    // Both volatile loads must be preserved — no CSE elimination
    const volatileLoads = func.instructions.filter(
      i => i.opcode === ILOpcode.LOAD_BYTE && i.isVolatile
    );
    expect(volatileLoads.length).toBe(2);

    // Both ADD_IMM instructions must be preserved
    const addImms = func.instructions.filter(
      i => i.opcode === ILOpcode.ADD_IMM
    );
    expect(addImms.length).toBe(2);
  });

  it('should still CSE non-volatile loads normally', () => {
    // Non-volatile loads (e.g., @ram or @data globals) should still
    // be eligible for CSE optimization.
    const func = createTestILFunction('test', [
      createLoadByteInstr('ramVar'),
      createAddImmInstr(1),
      createStoreByteInstr('result'),
      createLoadByteInstr('ramVar'),
      createAddImmInstr(1),
      createStoreByteInstr('result2'),
      createReturnInstr(),
    ]);

    const countBefore = func.instructions.length;
    pass.run(func, opts());

    // CSE should have eliminated one ADD_IMM instruction
    expect(func.instructions.length).toBeLessThan(countBefore);
  });

  it('should not cache expressions involving volatile sources', () => {
    // Even when the same slot is loaded twice with volatile flag,
    // the accumulator state is unknown after volatile load,
    // so no expression key can be formed.
    const func = createTestILFunction('test', [
      createVolatileLoadByteInstr('zpCounter'),
      createAddImmInstr(10),
      createStoreByteInstr('temp1'),
      // Intervening non-volatile operation
      createLoadByteInstr('localVar'),
      createStoreByteInstr('temp2'),
      // Second volatile load of same slot — must NOT be optimized away
      createVolatileLoadByteInstr('zpCounter'),
      createAddImmInstr(10),
      createStoreByteInstr('temp3'),
      createReturnInstr(),
    ]);

    pass.run(func, opts());

    // Both volatile loads must be preserved
    const volatileLoads = func.instructions.filter(
      i => i.opcode === ILOpcode.LOAD_BYTE && i.isVolatile
    );
    expect(volatileLoads.length).toBe(2);
  });
});

// ============================================================================
// LICMPass — Volatile Protection
// ============================================================================

describe('LICMPass — volatile protection', () => {
  const pass = new LICMPass();

  it('should NOT hoist volatile loads out of loops', () => {
    // A @zp global read inside a loop must stay inside the loop
    // because an interrupt handler may modify the value between iterations.
    const func = createTestILFunction('test', [
      createLoadImmInstr(0),
      createStoreByteInstr('i'),
      // Loop header
      createLabelInstr('loop_header'),
      // Volatile load inside loop — must NOT be hoisted
      createVolatileLoadByteInstr('zpFlag'),
      createStoreByteInstr('localCopy'),
      // Loop counter
      createIncByteInstr('i'),
      createLoadByteInstr('i'),
      createCmpImmInstr(10),
      createJumpNeInstr('loop_header'),
      // Loop exit
      createLabelInstr('loop_exit'),
      createReturnInstr(),
    ], true, false, [
      {
        headerLabel: 'loop_header',
        exitLabel: 'loop_exit',
        depth: 1,
        isCountedLoop: true,
        estimatedIterations: 10,
      },
    ]);

    pass.run(func, opts());

    // Find the volatile load — it must still be AFTER the loop header
    const headerIdx = func.instructions.findIndex(
      i => i.opcode === ILOpcode.LABEL && (i.operands[0] as any)?.name === 'loop_header'
    );
    const exitIdx = func.instructions.findIndex(
      i => i.opcode === ILOpcode.LABEL && (i.operands[0] as any)?.name === 'loop_exit'
    );
    const volatileLoadIdx = func.instructions.findIndex(
      i => i.opcode === ILOpcode.LOAD_BYTE && i.isVolatile
    );

    // Volatile load must be inside the loop (between header and exit)
    expect(volatileLoadIdx).toBeGreaterThan(headerIdx);
    expect(volatileLoadIdx).toBeLessThan(exitIdx);
  });

  it('should not mark volatile instructions as invariant even if they have no loop defs', () => {
    // A volatile instruction that would otherwise be loop-invariant
    // (no slot uses defined inside loop) must NOT be marked invariant
    // because the underlying memory may change between iterations.
    const func = createTestILFunction('test', [
      createLoadImmInstr(0),
      createStoreByteInstr('i'),
      // Loop header
      createLabelInstr('loop_header'),
      // Volatile load — must NOT be considered invariant
      createVolatileLoadByteInstr('zpConst'),
      createStoreByteInstr('localCopy'),
      // Non-volatile load of same slot — would be invariant if not for loop context
      createLoadByteInstr('outsideVar'),
      createStoreByteInstr('localCopy2'),
      // Loop counter
      createIncByteInstr('i'),
      createLoadByteInstr('i'),
      createCmpImmInstr(10),
      createJumpNeInstr('loop_header'),
      // Loop exit
      createLabelInstr('loop_exit'),
      createReturnInstr(),
    ], true, false, [
      {
        headerLabel: 'loop_header',
        exitLabel: 'loop_exit',
        depth: 1,
        isCountedLoop: true,
        estimatedIterations: 10,
      },
    ]);

    pass.run(func, opts());

    // The volatile load must still be inside the loop
    const headerIdx = func.instructions.findIndex(
      i => i.opcode === ILOpcode.LABEL && (i.operands[0] as any)?.name === 'loop_header'
    );
    const exitIdx = func.instructions.findIndex(
      i => i.opcode === ILOpcode.LABEL && (i.operands[0] as any)?.name === 'loop_exit'
    );
    const volatileLoadIdx = func.instructions.findIndex(
      i => i.opcode === ILOpcode.LOAD_BYTE && i.isVolatile
    );

    expect(volatileLoadIdx).toBeGreaterThan(headerIdx);
    expect(volatileLoadIdx).toBeLessThan(exitIdx);
  });

  it('should keep volatile stores inside loops', () => {
    // Volatile stores must not be moved out of loops either
    const func = createTestILFunction('test', [
      createLoadImmInstr(0),
      createStoreByteInstr('i'),
      createLabelInstr('loop_header'),
      // Volatile store inside loop — must NOT be hoisted
      createLoadImmInstr(1),
      { ...createStoreByteInstr('zpOutput'), isVolatile: true },
      createIncByteInstr('i'),
      createLoadByteInstr('i'),
      createCmpImmInstr(5),
      createJumpNeInstr('loop_header'),
      createLabelInstr('loop_exit'),
      createReturnInstr(),
    ], true, false, [
      {
        headerLabel: 'loop_header',
        exitLabel: 'loop_exit',
        depth: 1,
        isCountedLoop: true,
        estimatedIterations: 5,
      },
    ]);

    pass.run(func, opts());

    // Volatile store must still be inside the loop
    const headerIdx = func.instructions.findIndex(
      i => i.opcode === ILOpcode.LABEL && (i.operands[0] as any)?.name === 'loop_header'
    );
    const exitIdx = func.instructions.findIndex(
      i => i.opcode === ILOpcode.LABEL && (i.operands[0] as any)?.name === 'loop_exit'
    );
    const volatileStoreIdx = func.instructions.findIndex(
      i => i.opcode === ILOpcode.STORE_BYTE && i.isVolatile
    );

    expect(volatileStoreIdx).toBeGreaterThan(headerIdx);
    expect(volatileStoreIdx).toBeLessThan(exitIdx);
  });
});

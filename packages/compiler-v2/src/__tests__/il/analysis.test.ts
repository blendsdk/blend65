/**
 * IL Analysis Module Tests
 *
 * Tests for:
 * - Live range computation (backward dataflow)
 * - Dead store detection
 * - Optimization hints computation
 * - Full analysis passes
 *
 * @module __tests__/il/analysis
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeLiveRanges,
  isDeadStore,
  hasHotSlotAccess,
  hasFrequentSlotAccess,
  canCoalesce,
  computeHints,
  runAnalysisPasses,
  runAnalysisPassesWithLoops,
  getAnalysisStats,
} from '../../il/analysis.js';
import { ILOpcode, AddressingModeHint } from '../../il/enums.js';
import { ILInstruction } from '../../il/instruction.js';
import { ILFunction, ILLoop } from '../../il/structures.js';
import { createSlotOperand, createImmediateOperand, createLabelOperand } from '../../il/factories.js';
import { computeDefUse } from '../../il/builder/base.js';
import { SlotLocation, SlotKind } from '../../frame/enums.js';
import { FrameSlot } from '../../frame/types.js';
import { Frame } from '../../frame/allocator/frame-calculator.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test FrameSlot.
 */
function createTestSlot(
  name: string,
  options?: {
    address?: number;
    maxLoopDepth?: number;
    accessCount?: number;
    location?: SlotLocation;
  }
): FrameSlot {
  return {
    name,
    kind: SlotKind.Local,
    size: 1,
    offset: 0,
    location: options?.location ?? SlotLocation.ZeroPage,
    address: options?.address,
    maxLoopDepth: options?.maxLoopDepth ?? 0,
    accessCount: options?.accessCount ?? 1,
  };
}

/**
 * Create a minimal test Frame.
 */
function createTestFrame(): Frame {
  return {
    slots: [],
    totalSize: 0,
    zpSize: 0,
    frameSize: 0,
  };
}

/**
 * Create a test ILFunction with instructions.
 */
function createTestFunction(
  name: string,
  instructions: ILInstruction[],
  loops: ILLoop[] = []
): ILFunction {
  return {
    name,
    frame: createTestFrame(),
    instructions,
    isExported: false,
    isCallback: false,
    loops,
    maxLoopDepth: loops.length > 0 ? Math.max(...loops.map((l) => l.depth)) : 0,
  };
}

/**
 * Create an instruction with def-use pre-computed.
 */
function createInstrWithDefUse(
  opcode: ILOpcode,
  operands: ReturnType<typeof createSlotOperand | typeof createImmediateOperand | typeof createLabelOperand>[]
): ILInstruction {
  const instr: ILInstruction = { opcode, operands };
  instr.defUse = computeDefUse(instr);
  return instr;
}

// ============================================================================
// Live Range Analysis Tests
// ============================================================================

describe('computeLiveRanges', () => {
  describe('basic linear code', () => {
    it('should handle empty function', () => {
      const func = createTestFunction('empty', []);
      computeLiveRanges(func);
      expect(func.instructions.length).toBe(0);
    });

    it('should compute liveness for simple assignment', () => {
      // let x = 5
      // return x
      const xSlot = createTestSlot('x');

      const instructions: ILInstruction[] = [
        createInstrWithDefUse(ILOpcode.LOAD_IMM, [createImmediateOperand(5)]),
        createInstrWithDefUse(ILOpcode.STORE_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
        createInstrWithDefUse(ILOpcode.LOAD_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
        createInstrWithDefUse(ILOpcode.RETURN, []),
      ];

      const func = createTestFunction('simple', instructions);
      computeLiveRanges(func);

      // After STORE_BYTE to x, x should be live (used in LOAD_BYTE)
      expect(instructions[1].liveOut?.has('x')).toBe(true);

      // At RETURN, nothing is live
      expect(instructions[3].liveOut?.size).toBe(0);
    });

    it('should detect dead variable', () => {
      // let x = 5  (x is never used after this)
      // return 0
      const xSlot = createTestSlot('x');

      const instructions: ILInstruction[] = [
        createInstrWithDefUse(ILOpcode.LOAD_IMM, [createImmediateOperand(5)]),
        createInstrWithDefUse(ILOpcode.STORE_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
        createInstrWithDefUse(ILOpcode.LOAD_IMM, [createImmediateOperand(0)]),
        createInstrWithDefUse(ILOpcode.RETURN, []),
      ];

      const func = createTestFunction('deadVar', instructions);
      computeLiveRanges(func);

      // After STORE_BYTE to x, x should NOT be live (never used)
      expect(instructions[1].liveOut?.has('x')).toBe(false);
    });

    it('should handle multiple variables', () => {
      // let a = 1, b = 2
      // return a + b
      const aSlot = createTestSlot('a');
      const bSlot = createTestSlot('b');

      const instructions: ILInstruction[] = [
        createInstrWithDefUse(ILOpcode.LOAD_IMM, [createImmediateOperand(1)]),
        createInstrWithDefUse(ILOpcode.STORE_BYTE, [createSlotOperand(aSlot, AddressingModeHint.ZeroPage)]),
        createInstrWithDefUse(ILOpcode.LOAD_IMM, [createImmediateOperand(2)]),
        createInstrWithDefUse(ILOpcode.STORE_BYTE, [createSlotOperand(bSlot, AddressingModeHint.ZeroPage)]),
        createInstrWithDefUse(ILOpcode.LOAD_BYTE, [createSlotOperand(aSlot, AddressingModeHint.ZeroPage)]),
        createInstrWithDefUse(ILOpcode.ADD_BYTE, [createSlotOperand(bSlot, AddressingModeHint.ZeroPage)]),
        createInstrWithDefUse(ILOpcode.RETURN, []),
      ];

      const func = createTestFunction('multiVar', instructions);
      computeLiveRanges(func);

      // Both a and b should be live after their stores
      expect(instructions[1].liveOut?.has('a')).toBe(true);
      expect(instructions[3].liveOut?.has('b')).toBe(true);

      // After using a and b in ADD_BYTE, they are no longer live
      expect(instructions[5].liveOut?.has('a')).toBe(false);
      expect(instructions[5].liveOut?.has('b')).toBe(false);
    });
  });

  describe('control flow', () => {
    it('should handle if-else branches', () => {
      // if (cond) { x = 1 } else { x = 2 }
      // return x
      const xSlot = createTestSlot('x');

      const instructions: ILInstruction[] = [
        // if branch (assume condition checked before)
        createInstrWithDefUse(ILOpcode.LABEL, [createLabelOperand('if_then')]),
        createInstrWithDefUse(ILOpcode.LOAD_IMM, [createImmediateOperand(1)]),
        createInstrWithDefUse(ILOpcode.STORE_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
        createInstrWithDefUse(ILOpcode.JUMP, [createLabelOperand('if_end')]),
        // else branch
        createInstrWithDefUse(ILOpcode.LABEL, [createLabelOperand('if_else')]),
        createInstrWithDefUse(ILOpcode.LOAD_IMM, [createImmediateOperand(2)]),
        createInstrWithDefUse(ILOpcode.STORE_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
        // end
        createInstrWithDefUse(ILOpcode.LABEL, [createLabelOperand('if_end')]),
        createInstrWithDefUse(ILOpcode.LOAD_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
        createInstrWithDefUse(ILOpcode.RETURN, []),
      ];

      const func = createTestFunction('ifelse', instructions);
      computeLiveRanges(func);

      // x should be live at if_end (used in return)
      expect(instructions[8].liveIn?.has('x')).toBe(true);
    });

    it('should handle while loop', () => {
      // while (x < 10) { x = x + 1 }
      const xSlot = createTestSlot('x');

      const instructions: ILInstruction[] = [
        // Loop header
        createInstrWithDefUse(ILOpcode.LABEL, [createLabelOperand('while_header')]),
        createInstrWithDefUse(ILOpcode.LOAD_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
        createInstrWithDefUse(ILOpcode.CMP_IMM, [createImmediateOperand(10)]),
        createInstrWithDefUse(ILOpcode.JUMP_GE, [createLabelOperand('while_exit')]),
        // Loop body
        createInstrWithDefUse(ILOpcode.LOAD_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
        createInstrWithDefUse(ILOpcode.ADD_IMM, [createImmediateOperand(1)]),
        createInstrWithDefUse(ILOpcode.STORE_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
        createInstrWithDefUse(ILOpcode.JUMP, [createLabelOperand('while_header')]),
        // Exit
        createInstrWithDefUse(ILOpcode.LABEL, [createLabelOperand('while_exit')]),
        createInstrWithDefUse(ILOpcode.RETURN, []),
      ];

      const func = createTestFunction('whileLoop', instructions);
      computeLiveRanges(func);

      // x should be live at loop header (used in condition and body)
      expect(instructions[0].liveOut?.has('x')).toBe(true);
    });
  });
});

// ============================================================================
// Dead Store Detection Tests
// ============================================================================

describe('isDeadStore', () => {
  it('should detect dead store when variable not used after', () => {
    const xSlot = createTestSlot('x');
    const instr: ILInstruction = {
      opcode: ILOpcode.STORE_BYTE,
      operands: [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)],
      liveOut: new Set<string>(), // x is NOT in liveOut
    };

    expect(isDeadStore(instr)).toBe(true);
  });

  it('should not mark as dead when variable is live after', () => {
    const xSlot = createTestSlot('x');
    const instr: ILInstruction = {
      opcode: ILOpcode.STORE_BYTE,
      operands: [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)],
      liveOut: new Set<string>(['x']), // x IS in liveOut
    };

    expect(isDeadStore(instr)).toBe(false);
  });

  it('should return false for non-store instructions', () => {
    const xSlot = createTestSlot('x');
    const instr: ILInstruction = {
      opcode: ILOpcode.LOAD_BYTE,
      operands: [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)],
      liveOut: new Set<string>(),
    };

    expect(isDeadStore(instr)).toBe(false);
  });

  it('should return false when liveOut not computed', () => {
    const xSlot = createTestSlot('x');
    const instr: ILInstruction = {
      opcode: ILOpcode.STORE_BYTE,
      operands: [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)],
      // No liveOut set
    };

    expect(isDeadStore(instr)).toBe(false);
  });
});

// ============================================================================
// Hot Slot Access Tests
// ============================================================================

describe('hasHotSlotAccess', () => {
  it('should detect hot slot access (in loop)', () => {
    const hotSlot = createTestSlot('counter', { maxLoopDepth: 2 });
    const instr: ILInstruction = {
      opcode: ILOpcode.LOAD_BYTE,
      operands: [createSlotOperand(hotSlot, AddressingModeHint.ZeroPage)],
    };

    expect(hasHotSlotAccess(instr)).toBe(true);
  });

  it('should return false for non-hot slot', () => {
    const coldSlot = createTestSlot('temp', { maxLoopDepth: 0 });
    const instr: ILInstruction = {
      opcode: ILOpcode.LOAD_BYTE,
      operands: [createSlotOperand(coldSlot, AddressingModeHint.ZeroPage)],
    };

    expect(hasHotSlotAccess(instr)).toBe(false);
  });

  it('should return false for immediate operands', () => {
    const instr: ILInstruction = {
      opcode: ILOpcode.LOAD_IMM,
      operands: [createImmediateOperand(42)],
    };

    expect(hasHotSlotAccess(instr)).toBe(false);
  });
});

// ============================================================================
// Frequent Slot Access Tests
// ============================================================================

describe('hasFrequentSlotAccess', () => {
  it('should detect frequently accessed slot', () => {
    const frequentSlot = createTestSlot('loopVar', { accessCount: 50 });
    const instr: ILInstruction = {
      opcode: ILOpcode.LOAD_BYTE,
      operands: [createSlotOperand(frequentSlot, AddressingModeHint.ZeroPage)],
    };

    expect(hasFrequentSlotAccess(instr)).toBe(true);
  });

  it('should return false for infrequent slot', () => {
    const rareSlot = createTestSlot('once', { accessCount: 1 });
    const instr: ILInstruction = {
      opcode: ILOpcode.LOAD_BYTE,
      operands: [createSlotOperand(rareSlot, AddressingModeHint.ZeroPage)],
    };

    expect(hasFrequentSlotAccess(instr)).toBe(false);
  });

  it('should use custom threshold', () => {
    const slot = createTestSlot('medium', { accessCount: 15 });
    const instr: ILInstruction = {
      opcode: ILOpcode.LOAD_BYTE,
      operands: [createSlotOperand(slot, AddressingModeHint.ZeroPage)],
    };

    // With default threshold (20), should be false
    expect(hasFrequentSlotAccess(instr)).toBe(false);

    // With lower threshold (10), should be true
    expect(hasFrequentSlotAccess(instr, 10)).toBe(true);
  });
});

// ============================================================================
// Coalescing Detection Tests
// ============================================================================

describe('canCoalesce', () => {
  it('should detect load-store to same slot', () => {
    const xSlot = createTestSlot('x');
    const loadInstr: ILInstruction = {
      opcode: ILOpcode.LOAD_BYTE,
      operands: [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)],
    };
    const storeInstr: ILInstruction = {
      opcode: ILOpcode.STORE_BYTE,
      operands: [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)],
    };

    expect(canCoalesce(loadInstr, storeInstr)).toBe(true);
  });

  it('should not coalesce load-store to different slots', () => {
    const xSlot = createTestSlot('x');
    const ySlot = createTestSlot('y');
    const loadInstr: ILInstruction = {
      opcode: ILOpcode.LOAD_BYTE,
      operands: [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)],
    };
    const storeInstr: ILInstruction = {
      opcode: ILOpcode.STORE_BYTE,
      operands: [createSlotOperand(ySlot, AddressingModeHint.ZeroPage)],
    };

    expect(canCoalesce(loadInstr, storeInstr)).toBe(false);
  });

  it('should detect add-immediate followed by store', () => {
    const xSlot = createTestSlot('x');
    const addInstr: ILInstruction = {
      opcode: ILOpcode.ADD_IMM,
      operands: [createImmediateOperand(1)],
    };
    const storeInstr: ILInstruction = {
      opcode: ILOpcode.STORE_BYTE,
      operands: [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)],
    };

    expect(canCoalesce(addInstr, storeInstr)).toBe(true);
  });

  it('should return false when no next instruction', () => {
    const loadInstr: ILInstruction = {
      opcode: ILOpcode.LOAD_IMM,
      operands: [createImmediateOperand(5)],
    };

    expect(canCoalesce(loadInstr, undefined)).toBe(false);
  });
});

// ============================================================================
// Compute Hints Tests
// ============================================================================

describe('computeHints', () => {
  it('should mark instruction in loop as hot path', () => {
    const xSlot = createTestSlot('x');
    const instr: ILInstruction = {
      opcode: ILOpcode.LOAD_BYTE,
      operands: [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)],
    };

    const hints = computeHints(instr, 1); // loopDepth = 1

    expect(hints.isHotPath).toBe(true);
  });

  it('should mark instruction with hot slot as hot path', () => {
    const hotSlot = createTestSlot('counter', { maxLoopDepth: 2 });
    const instr: ILInstruction = {
      opcode: ILOpcode.LOAD_BYTE,
      operands: [createSlotOperand(hotSlot, AddressingModeHint.ZeroPage)],
    };

    const hints = computeHints(instr, 0); // Not in loop, but slot is hot

    expect(hints.isHotPath).toBe(true);
  });

  it('should compute all hints together', () => {
    const hotSlot = createTestSlot('x', { maxLoopDepth: 1, accessCount: 30 });
    const instr: ILInstruction = {
      opcode: ILOpcode.STORE_BYTE,
      operands: [createSlotOperand(hotSlot, AddressingModeHint.ZeroPage)],
      liveOut: new Set<string>(), // x not live - dead store
    };

    const hints = computeHints(instr, 1);

    expect(hints.isHotPath).toBe(true);
    expect(hints.isFrequentAccess).toBe(true);
    expect(hints.isDead).toBe(true);
  });
});

// ============================================================================
// Full Analysis Pass Tests
// ============================================================================

describe('runAnalysisPasses', () => {
  it('should compute live ranges and hints for simple function', () => {
    const xSlot = createTestSlot('x');

    const instructions: ILInstruction[] = [
      createInstrWithDefUse(ILOpcode.LOAD_IMM, [createImmediateOperand(5)]),
      createInstrWithDefUse(ILOpcode.STORE_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
      createInstrWithDefUse(ILOpcode.LOAD_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
      createInstrWithDefUse(ILOpcode.RETURN, []),
    ];

    const func = createTestFunction('simple', instructions);
    runAnalysisPasses(func);

    // Check live ranges computed
    expect(instructions[1].liveOut).toBeDefined();
    expect(instructions[1].liveOut?.has('x')).toBe(true);

    // Check hints computed
    expect(instructions[0].hints).toBeDefined();
  });

  it('should detect loop headers and track depth', () => {
    const xSlot = createTestSlot('x');

    const instructions: ILInstruction[] = [
      createInstrWithDefUse(ILOpcode.LABEL, [createLabelOperand('while_0_header')]),
      createInstrWithDefUse(ILOpcode.LOAD_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
      createInstrWithDefUse(ILOpcode.CMP_IMM, [createImmediateOperand(10)]),
      createInstrWithDefUse(ILOpcode.JUMP_GE, [createLabelOperand('while_0_exit')]),
      createInstrWithDefUse(ILOpcode.INC_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
      createInstrWithDefUse(ILOpcode.JUMP, [createLabelOperand('while_0_header')]),
      createInstrWithDefUse(ILOpcode.LABEL, [createLabelOperand('while_0_exit')]),
      createInstrWithDefUse(ILOpcode.RETURN, []),
    ];

    const func = createTestFunction('loopTest', instructions);
    runAnalysisPasses(func);

    // Instructions inside loop should be marked as hot path
    expect(instructions[1].hints?.isHotPath).toBe(true);
    expect(instructions[4].hints?.isHotPath).toBe(true);

    // Instruction after loop should not be hot
    expect(instructions[7].hints?.isHotPath).toBe(false);
  });
});

describe('runAnalysisPassesWithLoops', () => {
  it('should use ILLoop structures for accurate depth', () => {
    const xSlot = createTestSlot('x');

    const instructions: ILInstruction[] = [
      createInstrWithDefUse(ILOpcode.LABEL, [createLabelOperand('loop_header')]),
      createInstrWithDefUse(ILOpcode.LOAD_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
      createInstrWithDefUse(ILOpcode.CMP_IMM, [createImmediateOperand(10)]),
      createInstrWithDefUse(ILOpcode.JUMP_GE, [createLabelOperand('loop_exit')]),
      createInstrWithDefUse(ILOpcode.INC_BYTE, [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)]),
      createInstrWithDefUse(ILOpcode.JUMP, [createLabelOperand('loop_header')]),
      createInstrWithDefUse(ILOpcode.LABEL, [createLabelOperand('loop_exit')]),
      createInstrWithDefUse(ILOpcode.RETURN, []),
    ];

    const loops: ILLoop[] = [
      {
        headerLabel: 'loop_header',
        exitLabel: 'loop_exit',
        depth: 1,
        isCountedLoop: true,
        estimatedIterations: 10,
      },
    ];

    const func = createTestFunction('loopWithStructure', instructions, loops);
    runAnalysisPassesWithLoops(func);

    // Instructions in loop (indices 0-5) should be hot
    expect(instructions[1].hints?.isHotPath).toBe(true);
    expect(instructions[4].hints?.isHotPath).toBe(true);

    // Instruction after loop exit should not be hot
    expect(instructions[7].hints?.isHotPath).toBe(false);
  });
});

// ============================================================================
// Analysis Statistics Tests
// ============================================================================

describe('getAnalysisStats', () => {
  it('should return correct statistics', () => {
    const xSlot = createTestSlot('x', { maxLoopDepth: 1, accessCount: 30 });
    const deadSlot = createTestSlot('dead');

    const instructions: ILInstruction[] = [
      {
        opcode: ILOpcode.LOAD_IMM,
        operands: [createImmediateOperand(5)],
        hints: { isHotPath: true, isFrequentAccess: false, canCoalesce: false, isDead: false },
      },
      {
        opcode: ILOpcode.STORE_BYTE,
        operands: [createSlotOperand(deadSlot, AddressingModeHint.ZeroPage)],
        hints: { isHotPath: false, isFrequentAccess: false, canCoalesce: false, isDead: true },
      },
      {
        opcode: ILOpcode.LOAD_BYTE,
        operands: [createSlotOperand(xSlot, AddressingModeHint.ZeroPage)],
        hints: { isHotPath: true, isFrequentAccess: true, canCoalesce: true, isDead: false },
      },
      {
        opcode: ILOpcode.RETURN,
        operands: [],
        hints: { isHotPath: false, isFrequentAccess: false, canCoalesce: false, isDead: false },
      },
    ];

    const loops: ILLoop[] = [
      {
        headerLabel: 'loop',
        exitLabel: 'exit',
        depth: 1,
        isCountedLoop: false,
      },
    ];

    const func = createTestFunction('stats', instructions, loops);
    const stats = getAnalysisStats(func);

    expect(stats.totalInstructions).toBe(4);
    expect(stats.deadStores).toBe(1);
    expect(stats.hotInstructions).toBe(2);
    expect(stats.coalesceableInstructions).toBe(1);
    expect(stats.frequentAccesses).toBe(1);
    expect(stats.loopCount).toBe(1);
    expect(stats.maxLoopDepth).toBe(1);
  });

  it('should handle function with no hints', () => {
    const instructions: ILInstruction[] = [
      { opcode: ILOpcode.RETURN, operands: [] },
    ];

    const func = createTestFunction('noHints', instructions);
    const stats = getAnalysisStats(func);

    expect(stats.totalInstructions).toBe(1);
    expect(stats.deadStores).toBe(0);
    expect(stats.hotInstructions).toBe(0);
  });
});
/**
 * IL Peephole Pass: Delay Loop Canonicalization Tests
 *
 * Tests for the delay loop canonicalization optimization (Item H from
 * armenian-charset-compiler-fixes).
 *
 * **What it does:** Detects counted for-loops whose body contains ONLY
 * barrier() calls (and loop control instructions) — i.e., pure delay loops.
 * Replaces the entire loop with a single DELAY_LOOP instruction that emits
 * the canonical 6502 delay idiom: `LDX #N / .label: DEX / BNE .label`
 * (5 bytes total vs 10-15+ bytes for generic loop codegen).
 *
 * **Key behaviors tested:**
 * - Barrier-only loops are detected and replaced with DELAY_LOOP
 * - Non-barrier loops (with side effects) are NOT replaced
 * - Loop metadata (isCountedLoop, boundValue, counterSlot) is respected
 * - Edge cases: bound=1, bound=255, missing metadata, non-counted loops
 * - Exit label is preserved after replacement
 *
 * @module __tests__/optimizer/passes/il-peephole-delay-loop
 */

import { describe, it, expect } from 'vitest';
import { ILPeepholePass } from '../../../optimizer/passes/il-peephole.js';
import { ILOpcode } from '../../../il/enums.js';
import type { ILFunction, ILLoop } from '../../../il/structures.js';
import type { ILInstruction } from '../../../il/instruction.js';
import {
  createSlotOperand,
  createImmediateOperand,
  createLabelOperand,
  createILLoop,
} from '../../../il/factories.js';
import { SlotKind, SlotLocation } from '../../../frame/enums.js';
import type { FrameSlot } from '../../../frame/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a test frame slot for loop counter or variable operands.
 *
 * @param name - Slot name
 * @param address - Zero-page address (default 0x10)
 * @returns A minimal FrameSlot for testing
 */
function createTestSlot(name: string, address: number = 0x10): FrameSlot {
  return {
    name,
    kind: SlotKind.Variable,
    location: SlotLocation.ZeroPage,
    address,
    size: 1,
    accessCount: 0,
    maxLoopDepth: 0,
    isSingleDef: false,
    canPromoteToZP: false,
  };
}

/** Creates a LABEL instruction */
function createLabelInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.LABEL,
    operands: [createLabelOperand(label)],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a BARRIER instruction (the delay body) */
function createBarrierInstr(): ILInstruction {
  return {
    opcode: ILOpcode.BARRIER,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a LOAD_BYTE instruction for a given slot */
function createLoadByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.LOAD_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [], uses: [slotName] },
  };
}

/** Creates a CMP_IMM instruction */
function createCmpImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.CMP_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates an INC_BYTE instruction for a given slot */
function createIncByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.INC_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [slotName] },
  };
}

/** Creates a JUMP instruction (unconditional back-edge) */
function createJumpInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP,
    operands: [createLabelOperand(label)],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a JUMP_GE instruction (conditional exit) */
function createJumpGeInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP_GE,
    operands: [createLabelOperand(label)],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a STORE_BYTE instruction (side-effecting — NOT loop control) */
function createStoreByteInstr(slotName: string): ILInstruction {
  const slot = createTestSlot(slotName);
  return {
    opcode: ILOpcode.STORE_BYTE,
    operands: [createSlotOperand(slot)],
    defUse: { defs: [slotName], uses: [] },
  };
}

/** Creates a LOAD_IMM instruction */
function createLoadImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_IMM,
    operands: [createImmediateOperand(value, false)],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a RETURN instruction */
function createReturnInstr(): ILInstruction {
  return {
    opcode: ILOpcode.RETURN,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/** Creates a CALL instruction (side-effecting) */
function createCallInstr(): ILInstruction {
  return {
    opcode: ILOpcode.CALL,
    operands: [],
    defUse: { defs: [], uses: [] },
  };
}

/**
 * Creates a test ILFunction with given instructions and loop metadata.
 *
 * @param instructions - IL instruction array
 * @param loops - Loop metadata array (default: empty)
 * @returns A minimal ILFunction for testing
 */
function createTestFunction(
  instructions: ILInstruction[],
  loops: ILLoop[] = []
): ILFunction {
  return {
    name: 'test',
    frame: {} as never,
    instructions,
    isExported: false,
    isCallback: false,
    loops,
    maxLoopDepth: loops.length > 0 ? 1 : 0,
  };
}

/**
 * Builds a standard barrier-only delay loop instruction sequence.
 * Pattern: LABEL(header) / BARRIER / LOAD_BYTE(counter) / CMP_IMM(bound) /
 *          JUMP_GE(exit) / INC_BYTE(counter) / JUMP(header) / LABEL(exit)
 *
 * @param counterSlotName - Name of the loop counter slot
 * @param bound - Loop bound value for CMP
 * @param headerLabel - Header label name
 * @param exitLabel - Exit label name
 * @returns Array of IL instructions forming a barrier-only loop
 */
function buildBarrierOnlyLoop(
  counterSlotName: string,
  bound: number,
  headerLabel: string = '.for_0',
  exitLabel: string = '.endfor_0'
): ILInstruction[] {
  return [
    createLabelInstr(headerLabel),       // loop header
    createBarrierInstr(),                // delay body — barrier()
    createLoadByteInstr(counterSlotName), // load counter for comparison
    createCmpImmInstr(bound),            // compare against bound
    createJumpGeInstr(exitLabel),        // exit if counter >= bound
    createIncByteInstr(counterSlotName), // counter++
    createJumpInstr(headerLabel),        // back-edge to header
    createLabelInstr(exitLabel),         // exit label
  ];
}

// ============================================================================
// Delay Loop Canonicalization Tests
// ============================================================================

describe('ILPeepholePass: Delay Loop Canonicalization', () => {

  // --------------------------------------------------------------------------
  // Positive cases: barrier-only loops should be replaced
  // --------------------------------------------------------------------------

  it('should replace a barrier-only counted loop with DELAY_LOOP', () => {
    // A simple for-loop: for i = 0 to 100 { barrier() }
    const counterSlot = createTestSlot('i');
    const loopInstrs = buildBarrierOnlyLoop('i', 100);

    const func = createTestFunction(
      [
        createLoadImmInstr(0),       // i = 0 (init before loop)
        createStoreByteInstr('i'),
        ...loopInstrs,
        createReturnInstr(),
      ],
      [
        createILLoop('.for_0', '.endfor_0', 1, {
          isCountedLoop: true,
          counterSlot,
          boundValue: 100,
        }),
      ]
    );

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);

    // The loop body (8 instrs) should be replaced with DELAY_LOOP + exit label (2 instrs)
    // Total: init(2) + loop(8) + return(1) = 11 → init(2) + delay(1) + exit(1) + return(1) = 5
    const opcodes = func.instructions.map(i => i.opcode);
    expect(opcodes).toContain(ILOpcode.DELAY_LOOP);

    // The exit label should still be present (preserved for post-loop references)
    expect(opcodes).toContain(ILOpcode.LABEL);

    // Verify the DELAY_LOOP has the correct bound value (100)
    const delayInstr = func.instructions.find(i => i.opcode === ILOpcode.DELAY_LOOP);
    expect(delayInstr).toBeDefined();
    expect(delayInstr!.operands[0].value).toBe(100);
  });

  it('should handle bound=1 (minimum valid delay loop)', () => {
    const counterSlot = createTestSlot('i');
    const loopInstrs = buildBarrierOnlyLoop('i', 1);

    const func = createTestFunction(
      [...loopInstrs, createReturnInstr()],
      [
        createILLoop('.for_0', '.endfor_0', 1, {
          isCountedLoop: true,
          counterSlot,
          boundValue: 1,
        }),
      ]
    );

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    const delayInstr = func.instructions.find(i => i.opcode === ILOpcode.DELAY_LOOP);
    expect(delayInstr).toBeDefined();
    expect(delayInstr!.operands[0].value).toBe(1);
  });

  it('should handle bound=255 (maximum valid delay loop)', () => {
    const counterSlot = createTestSlot('i');
    const loopInstrs = buildBarrierOnlyLoop('i', 255);

    const func = createTestFunction(
      [...loopInstrs, createReturnInstr()],
      [
        createILLoop('.for_0', '.endfor_0', 1, {
          isCountedLoop: true,
          counterSlot,
          boundValue: 255,
        }),
      ]
    );

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    const delayInstr = func.instructions.find(i => i.opcode === ILOpcode.DELAY_LOOP);
    expect(delayInstr).toBeDefined();
    expect(delayInstr!.operands[0].value).toBe(255);
  });

  it('should preserve exit label after DELAY_LOOP replacement', () => {
    // Code after the loop may reference the exit label — it must be preserved
    const counterSlot = createTestSlot('i');
    const loopInstrs = buildBarrierOnlyLoop('i', 50);

    const func = createTestFunction(
      [...loopInstrs, createReturnInstr()],
      [
        createILLoop('.for_0', '.endfor_0', 1, {
          isCountedLoop: true,
          counterSlot,
          boundValue: 50,
        }),
      ]
    );

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // DELAY_LOOP should be immediately followed by the exit label
    const delayIdx = func.instructions.findIndex(i => i.opcode === ILOpcode.DELAY_LOOP);
    expect(delayIdx).toBeGreaterThanOrEqual(0);
    expect(func.instructions[delayIdx + 1].opcode).toBe(ILOpcode.LABEL);
  });

  it('should handle multiple barrier BARRIERs in loop body', () => {
    // for i = 0 to 10 { barrier(); barrier(); barrier() }
    const counterSlot = createTestSlot('i');
    const func = createTestFunction(
      [
        createLabelInstr('.for_0'),
        createBarrierInstr(),
        createBarrierInstr(),
        createBarrierInstr(),
        createLoadByteInstr('i'),
        createCmpImmInstr(10),
        createJumpGeInstr('.endfor_0'),
        createIncByteInstr('i'),
        createJumpInstr('.for_0'),
        createLabelInstr('.endfor_0'),
        createReturnInstr(),
      ],
      [
        createILLoop('.for_0', '.endfor_0', 1, {
          isCountedLoop: true,
          counterSlot,
          boundValue: 10,
        }),
      ]
    );

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    // Multiple BARRIERs are still barrier-only — should be replaced
    expect(result.modified).toBe(true);
    expect(func.instructions.some(i => i.opcode === ILOpcode.DELAY_LOOP)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Negative cases: loops with side effects should NOT be replaced
  // --------------------------------------------------------------------------

  it('should NOT replace loop with STORE_BYTE to non-counter slot', () => {
    // for i = 0 to 10 { poke(addr, value); barrier() }
    // STORE_BYTE to 'screen' is a side effect — not barrier-only
    const counterSlot = createTestSlot('i');
    const func = createTestFunction(
      [
        createLabelInstr('.for_0'),
        createBarrierInstr(),
        createStoreByteInstr('screen'),   // side effect!
        createLoadByteInstr('i'),
        createCmpImmInstr(10),
        createJumpGeInstr('.endfor_0'),
        createIncByteInstr('i'),
        createJumpInstr('.for_0'),
        createLabelInstr('.endfor_0'),
        createReturnInstr(),
      ],
      [
        createILLoop('.for_0', '.endfor_0', 1, {
          isCountedLoop: true,
          counterSlot,
          boundValue: 10,
        }),
      ]
    );

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Should NOT be replaced — loop has side effects
    expect(func.instructions.some(i => i.opcode === ILOpcode.DELAY_LOOP)).toBe(false);
  });

  it('should NOT replace loop with CALL instruction in body', () => {
    // for i = 0 to 10 { someFunction(); barrier() }
    const counterSlot = createTestSlot('i');
    const func = createTestFunction(
      [
        createLabelInstr('.for_0'),
        createBarrierInstr(),
        createCallInstr(),                // side effect — function call!
        createLoadByteInstr('i'),
        createCmpImmInstr(10),
        createJumpGeInstr('.endfor_0'),
        createIncByteInstr('i'),
        createJumpInstr('.for_0'),
        createLabelInstr('.endfor_0'),
        createReturnInstr(),
      ],
      [
        createILLoop('.for_0', '.endfor_0', 1, {
          isCountedLoop: true,
          counterSlot,
          boundValue: 10,
        }),
      ]
    );

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // CALL is a side effect — should NOT be replaced
    expect(func.instructions.some(i => i.opcode === ILOpcode.DELAY_LOOP)).toBe(false);
  });

  it('should NOT replace loop with LOAD_BYTE of non-counter variable', () => {
    // LOAD_BYTE of a variable that is NOT the counter slot — side effect
    const counterSlot = createTestSlot('i');
    const func = createTestFunction(
      [
        createLabelInstr('.for_0'),
        createBarrierInstr(),
        createLoadByteInstr('other_var'),  // NOT the counter slot!
        createLoadByteInstr('i'),
        createCmpImmInstr(10),
        createJumpGeInstr('.endfor_0'),
        createIncByteInstr('i'),
        createJumpInstr('.for_0'),
        createLabelInstr('.endfor_0'),
        createReturnInstr(),
      ],
      [
        createILLoop('.for_0', '.endfor_0', 1, {
          isCountedLoop: true,
          counterSlot,
          boundValue: 10,
        }),
      ]
    );

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Loading a non-counter variable means the loop has logic — NOT barrier-only
    expect(func.instructions.some(i => i.opcode === ILOpcode.DELAY_LOOP)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Loop metadata edge cases
  // --------------------------------------------------------------------------

  it('should NOT process non-counted loops', () => {
    // while(someCondition) { barrier() } — not a counted loop
    const func = createTestFunction(
      [
        createLabelInstr('.while_0'),
        createBarrierInstr(),
        createJumpInstr('.while_0'),
        createLabelInstr('.endwhile_0'),
        createReturnInstr(),
      ],
      [
        createILLoop('.while_0', '.endwhile_0', 1, {
          isCountedLoop: false,
        }),
      ]
    );

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Non-counted loops should be skipped
    expect(func.instructions.some(i => i.opcode === ILOpcode.DELAY_LOOP)).toBe(false);
  });

  it('should NOT process loops with bound > 255', () => {
    // Bound exceeds byte range — cannot use DELAY_LOOP (LDX #N is byte only)
    const counterSlot = createTestSlot('i');
    const loopInstrs = buildBarrierOnlyLoop('i', 256);

    const func = createTestFunction(
      [...loopInstrs, createReturnInstr()],
      [
        createILLoop('.for_0', '.endfor_0', 1, {
          isCountedLoop: true,
          counterSlot,
          boundValue: 256,
        }),
      ]
    );

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Bound > 255 cannot fit in LDX #imm8
    expect(func.instructions.some(i => i.opcode === ILOpcode.DELAY_LOOP)).toBe(false);
  });

  it('should NOT process loops with bound = 0', () => {
    // Bound of 0 means no iterations — degenerate case
    const counterSlot = createTestSlot('i');
    const loopInstrs = buildBarrierOnlyLoop('i', 0);

    const func = createTestFunction(
      [...loopInstrs, createReturnInstr()],
      [
        createILLoop('.for_0', '.endfor_0', 1, {
          isCountedLoop: true,
          counterSlot,
          boundValue: 0,
        }),
      ]
    );

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Bound < 1 should be rejected
    expect(func.instructions.some(i => i.opcode === ILOpcode.DELAY_LOOP)).toBe(false);
  });

  it('should NOT process loops with undefined boundValue', () => {
    // Dynamic bound — cannot determine iteration count at compile time
    const counterSlot = createTestSlot('i');
    const loopInstrs = buildBarrierOnlyLoop('i', 100);

    const func = createTestFunction(
      [...loopInstrs, createReturnInstr()],
      [
        createILLoop('.for_0', '.endfor_0', 1, {
          isCountedLoop: true,
          counterSlot,
          // boundValue intentionally omitted — dynamic bound
        }),
      ]
    );

    const pass = new ILPeepholePass();
    pass.run(func, { level: 'O2' });

    // Without a known bound, cannot emit DELAY_LOOP
    expect(func.instructions.some(i => i.opcode === ILOpcode.DELAY_LOOP)).toBe(false);
  });

  it('should gracefully handle function with no loops metadata', () => {
    // Functions without loop metadata should not crash
    const func = createTestFunction([
      createLoadImmInstr(42),
      createReturnInstr(),
    ]);
    // Explicitly no loops property (simulating old ILFunction objects)
    delete (func as Record<string, unknown>)['loops'];

    const pass = new ILPeepholePass();
    // Should not throw
    expect(() => pass.run(func, { level: 'O2' })).not.toThrow();
  });

  it('should gracefully handle function with empty loops array', () => {
    const func = createTestFunction(
      [createLoadImmInstr(42), createReturnInstr()],
      [] // empty loops
    );

    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    // No loops to canonicalize — should return without error
    expect(result).toBeDefined();
  });

  it('should report correct statistics for replaced loop', () => {
    const counterSlot = createTestSlot('i');
    const loopInstrs = buildBarrierOnlyLoop('i', 50);

    const func = createTestFunction(
      [...loopInstrs, createReturnInstr()],
      [
        createILLoop('.for_0', '.endfor_0', 1, {
          isCountedLoop: true,
          counterSlot,
          boundValue: 50,
        }),
      ]
    );

    const originalLength = func.instructions.length;
    const pass = new ILPeepholePass();
    const result = pass.run(func, { level: 'O2' });

    expect(result.modified).toBe(true);
    // After replacement: fewer instructions (loop body replaced with DELAY_LOOP + exit label)
    expect(func.instructions.length).toBeLessThan(originalLength);
  });
});

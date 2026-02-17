/**
 * Function Inlining Pass Tests
 *
 * Tests for the FunctionInliningPass program-level optimization pass.
 * Verifies single-call-site inlining, label/slot remapping, RETURN→JUMP
 * transformation, safety checks, and edge cases.
 *
 * @module __tests__/optimizer/function-inlining.test
 */

import { describe, it, expect } from 'vitest';
import {
  FunctionInliningPass,
  SMALL_FUNCTION_THRESHOLD,
  MAX_SIZE_GROWTH_RATIO,
} from '../../optimizer/passes/function-inlining.js';
import { ILOptimizer } from '../../optimizer/il-optimizer.js';
import { ILOpcode } from '../../il/enums.js';
import type { ILInstruction } from '../../il/instruction.js';
import type { FunctionOperand, LabelOperand } from '../../il/operands.js';
import {
  createTestILFunction,
  createTestILProgram,
  createLoadImmInstr,
  createStoreByteInstr,
  createLoadByteInstr,
  createReturnInstr,
  createCallInstr,
  createLabelInstr,
  createJumpInstr,
  createJumpEqInstr,
  createAddImmInstr,
} from './helpers/index.js';

// ============================================================================
// Pass Metadata Tests
// ============================================================================

describe('FunctionInliningPass metadata', () => {
  it('has correct name', () => {
    const pass = new FunctionInliningPass();
    expect(pass.name).toBe('function-inline');
  });

  it('depends on dead-function-elim', () => {
    const pass = new FunctionInliningPass();
    expect(pass.dependencies).toContain('dead-function-elim');
  });
});

// ============================================================================
// Single-Call-Site Inlining Tests
// ============================================================================

describe('FunctionInliningPass — single-call-site inlining', () => {
  it('inlines a function called exactly once', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createLoadImmInstr(1),
      createCallInstr('helper'),
      createReturnInstr(),
    ], true);

    const helper = createTestILFunction('helper', [
      createLoadImmInstr(42),
      createStoreByteInstr('x'),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, helper], 'main');
    const result = pass.run(program, { level: 'O1' });

    expect(result.modified).toBe(true);
    expect(result.functionsModified).toBe(1);

    // The CALL instruction should be replaced with the inlined body
    const mainInstrs = program.functions[0].instructions;
    const hasCall = mainInstrs.some((i) => i.opcode === ILOpcode.CALL);
    expect(hasCall).toBe(false);

    // Should have a continuation LABEL.
    // The trailing JUMP is removed by the JMP-to-next optimization because
    // the single RETURN at the end of the callee becomes a JUMP immediately
    // before the continuation label — a JMP-to-next-instruction.
    const labels = mainInstrs.filter((i) => i.opcode === ILOpcode.LABEL);
    const jumps = mainInstrs.filter((i) => i.opcode === ILOpcode.JUMP);
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(jumps.length).toBe(0);
  });

  it('does NOT inline a function called multiple times', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('helper'),
      createCallInstr('helper'), // Two calls → not single-call-site
      createReturnInstr(),
    ], true);

    const helper = createTestILFunction('helper', [
      createLoadImmInstr(10),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, helper], 'main');
    const result = pass.run(program, { level: 'O1' });

    // Should not inline (called twice)
    expect(result.modified).toBe(false);
  });

  it('does NOT inline the entry point function', () => {
    const pass = new FunctionInliningPass();

    // main is the entry point — never inlined even if called once
    const wrapper = createTestILFunction('wrapper', [
      createCallInstr('main'),
      createReturnInstr(),
    ], true);

    const main = createTestILFunction('main', [
      createLoadImmInstr(1),
      createReturnInstr(),
    ], true);

    const program = createTestILProgram([wrapper, main], 'main');
    const result = pass.run(program, { level: 'O1' });

    expect(result.modified).toBe(false);
  });

  it('does NOT inline exported functions', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('api'),
      createReturnInstr(),
    ], true);

    const api = createTestILFunction('api', [
      createLoadImmInstr(5),
      createReturnInstr(),
    ], true); // exported!

    const program = createTestILProgram([main, api], 'main');
    const result = pass.run(program, { level: 'O1' });

    expect(result.modified).toBe(false);
  });

  it('does NOT inline callback functions', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('isr'),
      createReturnInstr(),
    ], true);

    const isr: ReturnType<typeof createTestILFunction> = {
      ...createTestILFunction('isr', [
        createLoadImmInstr(0),
        createReturnInstr(),
      ]),
      isCallback: true,
    };

    const program = createTestILProgram([main, isr], 'main');
    const result = pass.run(program, { level: 'O1' });

    expect(result.modified).toBe(false);
  });

  it('does NOT inline self-recursive functions', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('recursive'),
      createReturnInstr(),
    ], true);

    const recursive = createTestILFunction('recursive', [
      createCallInstr('recursive'), // self-recursion
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, recursive], 'main');
    const result = pass.run(program, { level: 'O1' });

    expect(result.modified).toBe(false);
  });

  it('does NOT inline empty functions', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('empty'),
      createReturnInstr(),
    ], true);

    const empty = createTestILFunction('empty', []);

    const program = createTestILProgram([main, empty], 'main');
    const result = pass.run(program, { level: 'O1' });

    expect(result.modified).toBe(false);
  });
});

// ============================================================================
// Label and Slot Remapping Tests
// ============================================================================

describe('FunctionInliningPass — label/slot remapping', () => {
  it('remaps labels in inlined body to avoid collisions', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('helper'),
      createReturnInstr(),
    ], true);

    const helper = createTestILFunction('helper', [
      createLabelInstr('loop_start'),
      createLoadImmInstr(1),
      createJumpInstr('loop_start'),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, helper], 'main');
    pass.run(program, { level: 'O1' });

    // The original label 'loop_start' should be remapped with prefix
    const mainInstrs = program.functions[0].instructions;
    const labelInstrs = mainInstrs.filter((i) => i.opcode === ILOpcode.LABEL);

    // At least one label should contain the inline prefix
    const hasInlinePrefix = labelInstrs.some((i) => {
      const labelOp = i.operands[0] as LabelOperand;
      return labelOp.name.includes('_inline_helper_');
    });
    expect(hasInlinePrefix).toBe(true);

    // JUMP should also be remapped to the prefixed label
    const jumpInstrs = mainInstrs.filter((i) => i.opcode === ILOpcode.JUMP);
    const hasRemappedJump = jumpInstrs.some((i) => {
      const labelOp = i.operands[0] as LabelOperand;
      return labelOp.name.includes('_inline_helper_');
    });
    expect(hasRemappedJump).toBe(true);
  });

  it('remaps slot names in inlined body to avoid collisions', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createStoreByteInstr('x'), // 'x' in caller
      createCallInstr('helper'),
      createReturnInstr(),
    ], true);

    const helper = createTestILFunction('helper', [
      createLoadImmInstr(5),
      createStoreByteInstr('x'), // same name 'x' in callee
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, helper], 'main');
    pass.run(program, { level: 'O1' });

    // After inlining, the callee's 'x' should be remapped
    const mainInstrs = program.functions[0].instructions;
    const storeInstrs = mainInstrs.filter((i) => i.opcode === ILOpcode.STORE_BYTE);

    // There should be at least 2 stores: one original, one inlined with prefix
    expect(storeInstrs.length).toBeGreaterThanOrEqual(2);

    // The inlined STORE should have remapped defUse
    const remappedDefs = storeInstrs.some(
      (i) => i.defUse && i.defUse.defs.some((d) => d.includes('_inline_helper_'))
    );
    expect(remappedDefs).toBe(true);
  });
});

// ============================================================================
// RETURN→JUMP Transformation Tests
// ============================================================================

describe('FunctionInliningPass — RETURN→JUMP transformation', () => {
  it('replaces RETURN with JUMP to continuation label', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('helper'),
      createLoadImmInstr(99), // instruction after call
      createReturnInstr(),
    ], true);

    const helper = createTestILFunction('helper', [
      createLoadImmInstr(1),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, helper], 'main');
    pass.run(program, { level: 'O1' });

    const mainInstrs = program.functions[0].instructions;

    // Callee's RETURN should become JUMP to continuation
    // The continuation LABEL should exist and the LOAD_IMM 99 should follow
    const contLabels = mainInstrs.filter(
      (i) => i.opcode === ILOpcode.LABEL &&
        (i.operands[0] as LabelOperand).name.includes('_cont')
    );
    expect(contLabels.length).toBe(1);

    // LOAD_IMM 99 should be AFTER the continuation label
    const contLabelIdx = mainInstrs.indexOf(contLabels[0]);
    expect(mainInstrs[contLabelIdx + 1].opcode).toBe(ILOpcode.LOAD_IMM);
  });

  it('handles multiple RETURN statements in callee', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('multi_ret'),
      createReturnInstr(),
    ], true);

    // Callee with two RETURNs (e.g., early return in if-else)
    const multiRet = createTestILFunction('multi_ret', [
      createLoadImmInstr(0),
      createJumpEqInstr('skip'),
      createReturnInstr(), // early return
      createLabelInstr('skip'),
      createLoadImmInstr(1),
      createReturnInstr(), // normal return
    ]);

    const program = createTestILProgram([main, multiRet], 'main');
    pass.run(program, { level: 'O1' });

    const mainInstrs = program.functions[0].instructions;

    // The early RETURN becomes a JUMP to cont (must skip remaining code).
    // The final RETURN also becomes a JUMP to cont, but the JMP-to-next
    // optimization removes it because the continuation label immediately follows.
    // So only 1 JUMP to cont should remain.
    const jumpsToContLabel = mainInstrs.filter(
      (i) => i.opcode === ILOpcode.JUMP &&
        i.operands.length > 0 &&
        (i.operands[0] as LabelOperand).name.includes('_cont')
    );
    expect(jumpsToContLabel.length).toBe(1);
  });
});

// ============================================================================
// Bottom-Up Ordering Tests
// ============================================================================

describe('FunctionInliningPass — bottom-up ordering', () => {
  it('inlines leaf functions before callers', () => {
    const pass = new FunctionInliningPass();

    // A calls B, B calls C — all single-call-site
    // C should be inlined into B first, then B into A
    const a = createTestILFunction('main', [
      createCallInstr('b'),
      createReturnInstr(),
    ], true);

    const b = createTestILFunction('b', [
      createCallInstr('c'),
      createReturnInstr(),
    ]);

    const c = createTestILFunction('c', [
      createLoadImmInstr(42),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([a, b, c], 'main');
    const result = pass.run(program, { level: 'O1' });

    // Both b and c should be inlined
    expect(result.modified).toBe(true);
    expect(result.functionsModified).toBe(2);

    // main should NOT contain any CALL instructions
    const mainInstrs = program.functions[0].instructions;
    const calls = mainInstrs.filter((i) => i.opcode === ILOpcode.CALL);
    expect(calls).toHaveLength(0);

    // Should contain the leaf value (LOAD_IMM 42) from c
    const loads = mainInstrs.filter(
      (i) => i.opcode === ILOpcode.LOAD_IMM && i.operands[0]?.kind === 'immediate'
    );
    const hasLeafValue = loads.some(
      (i) => (i.operands[0] as { value: number }).value === 42
    );
    expect(hasLeafValue).toBe(true);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('FunctionInliningPass — edge cases', () => {
  it('returns empty result for single-function program', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createLoadImmInstr(1),
      createReturnInstr(),
    ], true);

    const program = createTestILProgram([main], 'main');
    const result = pass.run(program, { level: 'O1' });

    expect(result.modified).toBe(false);
  });

  it('returns empty result for empty program', () => {
    const pass = new FunctionInliningPass();

    const program = createTestILProgram([], 'main');
    const result = pass.run(program, { level: 'O1' });

    expect(result.modified).toBe(false);
  });

  it('handles function with no RETURN instruction gracefully', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('noret'),
      createReturnInstr(),
    ], true);

    // A function without RETURN (e.g., infinite loop)
    const noret = createTestILFunction('noret', [
      createLabelInstr('loop'),
      createJumpInstr('loop'),
    ]);

    const program = createTestILProgram([main, noret], 'main');

    // Should not throw
    expect(() => pass.run(program, { level: 'O1' })).not.toThrow();
  });

  it('generates debug info when debug option is enabled', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('helper'),
      createReturnInstr(),
    ], true);

    const helper = createTestILFunction('helper', [
      createLoadImmInstr(1),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, helper], 'main');
    const result = pass.run(program, { level: 'O1', debug: true });

    expect(result.modified).toBe(true);
    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo!.length).toBeGreaterThan(0);
    expect(result.debugInfo![0]).toContain('helper');
    expect(result.debugInfo![0]).toContain('main');
  });
});

// ============================================================================
// Integration with ILOptimizer
// ============================================================================

describe('FunctionInliningPass — ILOptimizer integration', () => {
  it('is auto-registered in ILOptimizer', () => {
    const optimizer = new ILOptimizer({ level: 'O1' });
    expect(optimizer.hasProgramPass('function-inline')).toBe(true);
  });

  it('runs at O1 as part of optimizeProgram', () => {
    const optimizer = new ILOptimizer({ level: 'O1' });

    const main = createTestILFunction('main', [
      createCallInstr('helper'),
      createReturnInstr(),
    ], true);

    const helper = createTestILFunction('helper', [
      createLoadImmInstr(7),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, helper], 'main');
    optimizer.optimizeProgram(program);

    // Verify inlining happened: CALL should be gone from main
    const mainFunc = program.functions.find((f) => f.name === 'main')!;
    const hasCalls = mainFunc.instructions.some((i) => i.opcode === ILOpcode.CALL);
    expect(hasCalls).toBe(false);
  });

  it('does NOT run at O0', () => {
    const optimizer = new ILOptimizer({ level: 'O0' });

    const main = createTestILFunction('main', [
      createCallInstr('helper'),
      createReturnInstr(),
    ], true);

    const helper = createTestILFunction('helper', [
      createLoadImmInstr(7),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, helper], 'main');
    optimizer.optimizeProgram(program);

    // CALL should remain at O0
    const mainFunc = program.functions.find((f) => f.name === 'main')!;
    const hasCalls = mainFunc.instructions.some((i) => i.opcode === ILOpcode.CALL);
    expect(hasCalls).toBe(true);
  });

  it('inlines single-call-site functions at Os (profitable-only inlining)', () => {
    const optimizer = new ILOptimizer({ level: 'Os' });

    const main = createTestILFunction('main', [
      createCallInstr('helper'),
      createReturnInstr(),
    ], true);

    const helper = createTestILFunction('helper', [
      createLoadImmInstr(7),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, helper], 'main');
    optimizer.optimizeProgram(program);

    // At Os, function-inline IS now in PROGRAM_LEVEL_PASSES with
    // profitable-only strategy. Single-call-site functions are always
    // inlined (saves JSR 3B + RTS 1B = 4B). The CALL should be replaced
    // with the inlined body, and DFE removes the fully-inlined helper.
    const mainFunc = program.functions.find((f) => f.name === 'main')!;
    const hasCalls = mainFunc.instructions.some((i) => i.opcode === ILOpcode.CALL);
    expect(hasCalls).toBe(false);
  });

  it('can be disabled via disabledPasses', () => {
    const optimizer = new ILOptimizer({
      level: 'O2',
      disabledPasses: ['function-inline'],
    });

    const main = createTestILFunction('main', [
      createCallInstr('helper'),
      createReturnInstr(),
    ], true);

    const helper = createTestILFunction('helper', [
      createLoadImmInstr(7),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, helper], 'main');
    optimizer.optimizeProgram(program);

    // CALL should remain when function-inline is disabled
    const mainFunc = program.functions.find((f) => f.name === 'main')!;
    const hasCalls = mainFunc.instructions.some((i) => i.opcode === ILOpcode.CALL);
    expect(hasCalls).toBe(true);
  });
});

// ============================================================================
// O2 Small-Function Inlining Tests
// ============================================================================

describe('FunctionInliningPass — O2 small-function inlining', () => {
  it('exports SMALL_FUNCTION_THRESHOLD constant', () => {
    // Verify the threshold is defined and reasonable
    expect(SMALL_FUNCTION_THRESHOLD).toBe(20);
  });

  it('exports MAX_SIZE_GROWTH_RATIO constant', () => {
    expect(MAX_SIZE_GROWTH_RATIO).toBe(0.20);
  });

  it('inlines small function called twice at O2', () => {
    const pass = new FunctionInliningPass();

    // main calls helper twice — at O1 this wouldn't inline, but at O2 it should
    const main = createTestILFunction('main', [
      createCallInstr('small'),
      createCallInstr('small'),
      createReturnInstr(),
    ], true);

    // Small function (3 instructions, well under threshold of 20)
    const small = createTestILFunction('small', [
      createLoadImmInstr(42),
      createStoreByteInstr('x'),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, small], 'main');
    const result = pass.run(program, { level: 'O2' });

    expect(result.modified).toBe(true);
    // Both call sites should be inlined
    expect(result.functionsModified).toBe(2);

    // No CALL instructions should remain in main
    const mainFunc = program.functions.find((f) => f.name === 'main')!;
    const calls = mainFunc.instructions.filter((i) => i.opcode === ILOpcode.CALL);
    expect(calls).toHaveLength(0);
  });

  it('does NOT inline small multi-call function at O1', () => {
    const pass = new FunctionInliningPass();

    // Same setup but at O1 — multi-call should NOT be inlined
    const main = createTestILFunction('main', [
      createCallInstr('small'),
      createCallInstr('small'),
      createReturnInstr(),
    ], true);

    const small = createTestILFunction('small', [
      createLoadImmInstr(42),
      createStoreByteInstr('x'),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, small], 'main');
    const result = pass.run(program, { level: 'O1' });

    // At O1, multi-call functions are NOT inlined
    expect(result.modified).toBe(false);
  });

  it('does NOT inline function exceeding size threshold at O2', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('big'),
      createCallInstr('big'),
      createReturnInstr(),
    ], true);

    // Create a function that exceeds SMALL_FUNCTION_THRESHOLD (21 instructions)
    const bigBody: ILInstruction[] = [];
    for (let i = 0; i < SMALL_FUNCTION_THRESHOLD + 1; i++) {
      bigBody.push(createLoadImmInstr(i % 256));
    }
    bigBody.push(createReturnInstr()); // Total: threshold + 2
    const big = createTestILFunction('big', bigBody);

    const program = createTestILProgram([main, big], 'main');
    const result = pass.run(program, { level: 'O2' });

    // Function exceeds threshold — should NOT be inlined
    expect(result.modified).toBe(false);
  });

  it('inlines function at exactly the size threshold', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('exact'),
      createCallInstr('exact'),
      createReturnInstr(),
    ], true);

    // Create a function with exactly SMALL_FUNCTION_THRESHOLD instructions
    const body: ILInstruction[] = [];
    for (let i = 0; i < SMALL_FUNCTION_THRESHOLD - 1; i++) {
      body.push(createLoadImmInstr(i % 256));
    }
    body.push(createReturnInstr()); // Total: exactly SMALL_FUNCTION_THRESHOLD
    const exact = createTestILFunction('exact', body);

    const program = createTestILProgram([main, exact], 'main');
    const result = pass.run(program, { level: 'O2' });

    // At exactly the threshold, the function IS a candidate for inlining.
    // However, the size budget (floor = 20) limits how many sites are inlined:
    // each inline of a 20-instr function adds 19 instructions of growth,
    // so only the first site fits the budget (19 <= 20), the second does not (38 > 20).
    expect(result.modified).toBe(true);
    expect(result.functionsModified).toBeGreaterThanOrEqual(1);
  });

  it('inlines small function called from multiple callers', () => {
    const pass = new FunctionInliningPass();

    // Two callers (a and b) each call 'small' once
    const main = createTestILFunction('main', [
      createCallInstr('a'),
      createCallInstr('b'),
      createReturnInstr(),
    ], true);

    const a = createTestILFunction('a', [
      createCallInstr('small'),
      createReturnInstr(),
    ]);

    const b = createTestILFunction('b', [
      createCallInstr('small'),
      createReturnInstr(),
    ]);

    const small = createTestILFunction('small', [
      createLoadImmInstr(99),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, a, b, small], 'main');
    const result = pass.run(program, { level: 'O2' });

    // 'small' is called twice (from a and b), so it's a small-function candidate
    // a and b are called once each, so they are single-site candidates
    // All should be inlined
    expect(result.modified).toBe(true);
    expect(result.functionsModified).toBeGreaterThanOrEqual(2);
  });

  it('enforces size budget (20% max growth)', () => {
    const pass = new FunctionInliningPass();

    // Create a main function with many calls to a moderate-size function.
    // The total growth should eventually exceed 20% of the program size.
    // Program: main (60 instrs) + heavy (15 instrs) = 75 total
    // Budget: 75 * 0.20 = 15 instructions growth
    // Each inline of 'heavy' grows by 14 (15 - 1 for replacing CALL)
    // So after 1 inline: 14 growth (within budget)
    // After 2 inlines: 28 growth (exceeds budget of 15)
    const mainBody: ILInstruction[] = [];
    // Add 55 padding instructions to make main large
    for (let i = 0; i < 55; i++) {
      mainBody.push(createLoadImmInstr(i % 256));
    }
    // Add 3 calls to heavy
    mainBody.push(createCallInstr('heavy'));
    mainBody.push(createCallInstr('heavy'));
    mainBody.push(createCallInstr('heavy'));
    mainBody.push(createReturnInstr());
    // Total main: 55 + 3 + 1 = 59 instrs

    const main = createTestILFunction('main', mainBody, true);

    // heavy: 15 instructions (under threshold of 20)
    const heavyBody: ILInstruction[] = [];
    for (let i = 0; i < 14; i++) {
      heavyBody.push(createLoadImmInstr(i % 256));
    }
    heavyBody.push(createReturnInstr()); // Total: 15
    const heavy = createTestILFunction('heavy', heavyBody);

    const program = createTestILProgram([main, heavy], 'main');
    const result = pass.run(program, { level: 'O2' });

    // Raw budget: (59 + 15) * 0.20 = 14.8 → floor = 14
    // But budget floor = max(14, SMALL_FUNCTION_THRESHOLD=20) = 20
    // Each inline grows by 14 instructions (15 callee - 1 CALL replaced)
    // First inline: cumulative growth = 14 (14 <= 20 → within budget)
    // Second inline: cumulative growth = 28 (28 > 20 → EXCEEDS budget)
    // So only 1 of the 3 calls should be inlined
    expect(result.modified).toBe(true);
    expect(result.functionsModified).toBe(1);

    // Remaining 2 calls should still be in main
    const mainFunc = program.functions.find((f) => f.name === 'main')!;
    const calls = mainFunc.instructions.filter(
      (i) => i.opcode === ILOpcode.CALL &&
        i.operands.length > 0 &&
        i.operands[0].kind === 'function' &&
        (i.operands[0] as FunctionOperand).name === 'heavy'
    );
    expect(calls).toHaveLength(2);
  });

  it('inlines at O3 same as O2 (small-function enabled)', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('tiny'),
      createCallInstr('tiny'),
      createReturnInstr(),
    ], true);

    const tiny = createTestILFunction('tiny', [
      createLoadImmInstr(1),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, tiny], 'main');
    const result = pass.run(program, { level: 'O3' });

    // O3 enables small-function inlining just like O2
    expect(result.modified).toBe(true);
    expect(result.functionsModified).toBe(2);
  });

  it('generates debug info with strategy name for multi-site inlining', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('small'),
      createCallInstr('small'),
      createReturnInstr(),
    ], true);

    const small = createTestILFunction('small', [
      createLoadImmInstr(1),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, small], 'main');
    const result = pass.run(program, { level: 'O2', debug: true });

    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo!.length).toBe(2);
    // Debug messages should include strategy name
    expect(result.debugInfo![0]).toContain('small-function');
    expect(result.debugInfo![1]).toContain('small-function');
  });

  it('uses unique label prefixes for each inlining of the same function', () => {
    const pass = new FunctionInliningPass();

    const main = createTestILFunction('main', [
      createCallInstr('dup'),
      createCallInstr('dup'),
      createReturnInstr(),
    ], true);

    const dup = createTestILFunction('dup', [
      createLabelInstr('inner'),
      createLoadImmInstr(5),
      createReturnInstr(),
    ]);

    const program = createTestILProgram([main, dup], 'main');
    pass.run(program, { level: 'O2' });

    // Each inlining should use a different counter prefix
    const mainFunc = program.functions.find((f) => f.name === 'main')!;
    const labels = mainFunc.instructions.filter((i) => i.opcode === ILOpcode.LABEL);

    // Collect all unique inline prefixes
    const prefixes = new Set<string>();
    for (const label of labels) {
      const name = (label.operands[0] as LabelOperand).name;
      // Extract the counter part: _inline_dup_0_, _inline_dup_1_, etc.
      const match = name.match(/_inline_dup_(\d+)_/);
      if (match) {
        prefixes.add(match[1]);
      }
    }
    // Should have at least 2 different prefix counters (0 and 1)
    expect(prefixes.size).toBeGreaterThanOrEqual(2);
  });
});

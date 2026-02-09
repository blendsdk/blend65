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
import { FunctionInliningPass } from '../../optimizer/passes/function-inlining.js';
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

    // Should have a continuation LABEL and a JUMP (from inlined RETURN)
    const labels = mainInstrs.filter((i) => i.opcode === ILOpcode.LABEL);
    const jumps = mainInstrs.filter((i) => i.opcode === ILOpcode.JUMP);
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(jumps.length).toBeGreaterThanOrEqual(1);
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

    // Both RETURNs should become JUMPs to the same continuation label
    const jumpsToContLabel = mainInstrs.filter(
      (i) => i.opcode === ILOpcode.JUMP &&
        i.operands.length > 0 &&
        (i.operands[0] as LabelOperand).name.includes('_cont')
    );
    expect(jumpsToContLabel.length).toBe(2);
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

  it('does NOT run at Os (size optimization avoids inlining)', () => {
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

    // At Os, function-inline is NOT in PROGRAM_LEVEL_PASSES
    // but DFE may remove unused. Helper IS reachable so should remain
    const mainFunc = program.functions.find((f) => f.name === 'main')!;
    const hasCalls = mainFunc.instructions.some((i) => i.opcode === ILOpcode.CALL);
    expect(hasCalls).toBe(true);
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

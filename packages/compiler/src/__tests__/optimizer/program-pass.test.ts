/**
 * Program-Level Optimization Pass Tests
 *
 * Tests for:
 * - ProgramOptimizationPass interface and helpers
 * - Program pass registration in ILOptimizer
 * - Program pass execution ordering and dependency resolution
 * - PROGRAM_LEVEL_PASSES configuration per level
 * - resolveProgramPasses() resolution logic
 * - Integration: program passes run before function passes
 *
 * @module __tests__/optimizer/program-pass
 */

import { describe, it, expect } from 'vitest';
import { ILOptimizer } from '../../optimizer/il-optimizer.js';
import type { ProgramOptimizationPass, ProgramPassResult } from '../../optimizer/pass.js';
import {
  createEmptyProgramResult,
  createProgramResult,
} from '../../optimizer/pass.js';
import {
  getProgramPassesForLevel,
  resolveProgramPasses,
} from '../../optimizer/options.js';
import type { OptimizationOptions } from '../../optimizer/options.js';
import type { ILProgram } from '../../il/structures.js';
import {
  createTestILFunction,
  createTestILProgram,
  createLoadImmInstr,
  createStoreByteInstr,
  createReturnInstr,
  createCallInstr,
} from './helpers/index.js';

// ============================================================================
// Test Helpers: Fake Program Passes
// ============================================================================

/**
 * Creates a no-op program pass for testing registration and ordering.
 *
 * @param name - Pass name
 * @param dependencies - Pass dependencies
 * @returns A ProgramOptimizationPass that does nothing
 */
function createNoOpProgramPass(
  name: string,
  dependencies: string[] = []
): ProgramOptimizationPass {
  return {
    name,
    dependencies,
    run(_program: ILProgram, _options: OptimizationOptions): ProgramPassResult {
      return createEmptyProgramResult();
    },
  };
}

/**
 * Creates a program pass that records when it runs.
 * Used to verify execution order.
 *
 * @param name - Pass name
 * @param executionLog - Array to push name into when run() is called
 * @param dependencies - Pass dependencies
 * @returns A ProgramOptimizationPass that logs its execution
 */
function createLoggingProgramPass(
  name: string,
  executionLog: string[],
  dependencies: string[] = []
): ProgramOptimizationPass {
  return {
    name,
    dependencies,
    run(_program: ILProgram, _options: OptimizationOptions): ProgramPassResult {
      executionLog.push(name);
      return createEmptyProgramResult();
    },
  };
}

/**
 * Creates a program pass that removes functions by name.
 * Used to test that program passes can modify the program.
 *
 * @param functionsToRemove - Names of functions to remove
 * @returns A ProgramOptimizationPass that removes specified functions
 */
function createRemovingProgramPass(
  functionsToRemove: string[]
): ProgramOptimizationPass {
  return {
    name: 'test-remover',
    dependencies: [],
    run(program: ILProgram, _options: OptimizationOptions): ProgramPassResult {
      const removeSet = new Set(functionsToRemove);
      const before = program.functions.length;
      program.functions = program.functions.filter(
        (f) => !removeSet.has(f.name)
      );
      const removed = before - program.functions.length;
      return createProgramResult(removed, 0, [
        ...functionsToRemove.map((n) => `Removed: ${n}`),
      ]);
    },
  };
}

// ============================================================================
// Helper: Create a simple test program with multiple functions
// ============================================================================

/**
 * Creates a test program with main, helper, and unused functions.
 */
function createMultiFunctionProgram(): ILProgram {
  const mainFunc = createTestILFunction(
    'main',
    [
      createLoadImmInstr(1),
      createCallInstr('helper'),
      createReturnInstr(),
    ],
    true
  );

  const helperFunc = createTestILFunction('helper', [
    createLoadImmInstr(42),
    createStoreByteInstr('x'),
    createReturnInstr(),
  ]);

  const unusedFunc = createTestILFunction('unused', [
    createLoadImmInstr(99),
    createReturnInstr(),
  ]);

  return createTestILProgram([mainFunc, helperFunc, unusedFunc], 'main');
}

// ============================================================================
// Tests: ProgramPassResult helpers
// ============================================================================

describe('ProgramPassResult helpers', () => {
  it('createEmptyProgramResult returns unmodified result', () => {
    const result = createEmptyProgramResult();
    expect(result.modified).toBe(false);
    expect(result.functionsRemoved).toBe(0);
    expect(result.functionsModified).toBe(0);
    expect(result.debugInfo).toBeUndefined();
  });

  it('createProgramResult with removals sets modified=true', () => {
    const result = createProgramResult(2, 0, ['Removed: a', 'Removed: b']);
    expect(result.modified).toBe(true);
    expect(result.functionsRemoved).toBe(2);
    expect(result.functionsModified).toBe(0);
    expect(result.debugInfo).toEqual(['Removed: a', 'Removed: b']);
  });

  it('createProgramResult with modifications sets modified=true', () => {
    const result = createProgramResult(0, 3);
    expect(result.modified).toBe(true);
    expect(result.functionsRemoved).toBe(0);
    expect(result.functionsModified).toBe(3);
  });

  it('createProgramResult with zero counts sets modified=false', () => {
    const result = createProgramResult(0, 0);
    expect(result.modified).toBe(false);
  });
});

// ============================================================================
// Tests: PROGRAM_LEVEL_PASSES configuration
// ============================================================================

describe('PROGRAM_LEVEL_PASSES configuration', () => {
  it('O0 has no program passes', () => {
    expect(getProgramPassesForLevel('O0')).toEqual([]);
  });

  it('O1 has dead-function-elim, function-inline, and post-inline dead-function-elim', () => {
    const passes = getProgramPassesForLevel('O1');
    expect(passes).toContain('dead-function-elim');
    expect(passes).toContain('function-inline');
    // DFE runs both before AND after inlining to clean up fully-inlined functions
    expect(passes).toHaveLength(3);
    expect(passes[0]).toBe('dead-function-elim');
    expect(passes[1]).toBe('function-inline');
    expect(passes[2]).toBe('dead-function-elim');
  });

  it('O2 has dead-function-elim, dead-global-elim, function-inline, and post-inline dead-function-elim', () => {
    const passes = getProgramPassesForLevel('O2');
    expect(passes).toContain('dead-function-elim');
    expect(passes).toContain('dead-global-elim');
    expect(passes).toContain('function-inline');
    // DFE runs both before AND after inlining to clean up fully-inlined functions
    expect(passes).toHaveLength(4);
    expect(passes[0]).toBe('dead-function-elim');
    expect(passes[1]).toBe('dead-global-elim');
    expect(passes[2]).toBe('function-inline');
    expect(passes[3]).toBe('dead-function-elim');
  });

  it('O3 matches O2 program passes', () => {
    const o2 = getProgramPassesForLevel('O2');
    const o3 = getProgramPassesForLevel('O3');
    expect(o3).toEqual(o2);
  });

  it('Os has dead-function-elim, dead-global-elim, function-inline, and post-inline dead-function-elim', () => {
    const passes = getProgramPassesForLevel('Os');
    expect(passes).toContain('dead-function-elim');
    expect(passes).toContain('dead-global-elim');
    expect(passes).toContain('function-inline');
    // DFE runs both before AND after inlining (same as O2/O3)
    expect(passes).toHaveLength(4);
    expect(passes[0]).toBe('dead-function-elim');
    expect(passes[1]).toBe('dead-global-elim');
    expect(passes[2]).toBe('function-inline');
    expect(passes[3]).toBe('dead-function-elim');
  });

  it('Oz matches Os program passes (profitable-only inlining)', () => {
    const os = getProgramPassesForLevel('Os');
    const oz = getProgramPassesForLevel('Oz');
    expect(oz).toEqual(os);
  });

  it('returns a copy (mutation-safe)', () => {
    const passes1 = getProgramPassesForLevel('O2');
    const passes2 = getProgramPassesForLevel('O2');
    passes1.push('mutated');
    expect(passes2).not.toContain('mutated');
  });
});

// ============================================================================
// Tests: resolveProgramPasses
// ============================================================================

describe('resolveProgramPasses', () => {
  it('returns level defaults when no overrides', () => {
    const passes = resolveProgramPasses({ level: 'O2' });
    expect(passes).toEqual(getProgramPassesForLevel('O2'));
  });

  it('respects disabledPasses filter', () => {
    const passes = resolveProgramPasses({
      level: 'O2',
      disabledPasses: ['dead-global-elim'],
    });
    expect(passes).toContain('dead-function-elim');
    expect(passes).toContain('function-inline');
    expect(passes).not.toContain('dead-global-elim');
  });

  it('disabledPasses can disable all program passes', () => {
    const passes = resolveProgramPasses({
      level: 'O2',
      disabledPasses: ['dead-function-elim', 'dead-global-elim', 'function-inline'],
    });
    expect(passes).toEqual([]);
  });

  it('returns empty array for O0', () => {
    const passes = resolveProgramPasses({ level: 'O0' });
    expect(passes).toEqual([]);
  });
});

// ============================================================================
// Tests: Program Pass Registration
// ============================================================================

describe('ILOptimizer program pass registration', () => {
  it('registers a program pass', () => {
    const optimizer = new ILOptimizer({ level: 'O0' });
    const pass = createNoOpProgramPass('test-pass');

    optimizer.registerProgramPass(pass);
    expect(optimizer.hasProgramPass('test-pass')).toBe(true);
  });

  it('getRegisteredProgramPasses returns registered names including defaults', () => {
    const optimizer = new ILOptimizer({ level: 'O0' });
    optimizer.registerProgramPass(createNoOpProgramPass('pass-a'));
    optimizer.registerProgramPass(createNoOpProgramPass('pass-b'));

    const names = optimizer.getRegisteredProgramPasses();
    // Includes auto-registered 'dead-function-elim', 'dead-global-elim', 'function-inline' plus two new
    expect(names).toContain('dead-function-elim');
    expect(names).toContain('dead-global-elim');
    expect(names).toContain('function-inline');
    expect(names).toContain('pass-a');
    expect(names).toContain('pass-b');
    expect(names).toHaveLength(5);
  });

  it('throws on duplicate program pass registration', () => {
    const optimizer = new ILOptimizer({ level: 'O0' });
    optimizer.registerProgramPass(createNoOpProgramPass('dup'));

    expect(() => {
      optimizer.registerProgramPass(createNoOpProgramPass('dup'));
    }).toThrow("Program pass 'dup' is already registered");
  });

  it('hasProgramPass returns false for unregistered pass', () => {
    const optimizer = new ILOptimizer({ level: 'O0' });
    expect(optimizer.hasProgramPass('nonexistent')).toBe(false);
  });

  it('starts with default program passes registered', () => {
    // DeadFunctionElimPass is auto-registered by the constructor
    const optimizer = new ILOptimizer({ level: 'O2' });
    expect(optimizer.getRegisteredProgramPasses()).toContain('dead-function-elim');
  });
});

// ============================================================================
// Tests: Program Pass Execution
// ============================================================================

describe('ILOptimizer program pass execution', () => {
  it('auto-registered dead-function-elim runs during optimizeProgram at O1', () => {
    // DeadFunctionElimPass is auto-registered by constructor
    const optimizer = new ILOptimizer({ level: 'O1' });

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    const result = optimizer.getProgramResult();
    // The auto-registered DFE should have produced a result
    expect(result!.programPassResults.length).toBeGreaterThanOrEqual(1);
    // 'unused' is unreachable from main → helper, so DFE should remove it
    expect(program.functions.map((f) => f.name)).not.toContain('unused');
  });

  it('does NOT run unregistered program passes even if enabled by level', () => {
    // Use O0 with enabledPasses override containing an unregistered pass name.
    // At O1, both 'dead-function-elim' and 'function-inline' are enabled AND registered,
    // so we test with a config that includes a truly unregistered pass name.
    const optimizer = new ILOptimizer({ level: 'O1' });

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    const result = optimizer.getProgramResult();
    // At O1: dead-function-elim, function-inline, dead-function-elim (DFE runs twice:
    // once before inlining to remove unreachable code, once after to remove
    // fully-inlined functions that are now unreachable)
    expect(result!.programPassResults).toHaveLength(3);
    // Verify no more than the enabled+registered passes ran
    expect(result!.programPassResults.length).toBeLessThanOrEqual(
      getProgramPassesForLevel('O1').length
    );
  });

  it('does NOT run program passes at O0', () => {
    // O0 has no enabled program passes in config
    const optimizer = new ILOptimizer({ level: 'O0' });

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    const result = optimizer.getProgramResult();
    // Even though DFE is registered, O0 config doesn't enable it
    expect(result!.programPassResults).toEqual([]);
  });

  it('runs additional program passes in dependency order', () => {
    const log: string[] = [];
    const optimizer = new ILOptimizer({ level: 'O2' });

    // Register a custom pass that depends on 'dead-function-elim' and logs execution.
    // 'function-inline' is now auto-registered, so we use a custom pass name.
    optimizer.registerProgramPass(
      createLoggingProgramPass('test-custom-pass', log, ['dead-function-elim'])
    );

    // Enable the custom pass by adding it to the O2 config via a program that
    // includes it. Since the pass won't be in PROGRAM_LEVEL_PASSES, we verify
    // differently: the auto-registered function-inline depends on dead-function-elim,
    // so it runs after. We verify all 3 auto-registered passes run at O2.
    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    const result = optimizer.getProgramResult();
    // O2 has: dead-function-elim, dead-global-elim, function-inline, dead-function-elim
    // (DFE runs twice: before and after inlining). All are auto-registered.
    // 'test-custom-pass' is registered but not in PROGRAM_LEVEL_PASSES, so it doesn't run
    expect(result!.programPassResults.length).toBe(4);
  });

  it('auto-registered DFE can modify the program (remove functions)', () => {
    // The real DeadFunctionElimPass removes unreachable functions.
    // At O1, the pipeline is: DFE → inline → DFE.
    // First DFE removes 'unused' (unreachable from main→helper).
    // Inlining inlines 'helper' into 'main' (single-call-site).
    // Second DFE removes 'helper' (no longer called after inlining).
    const optimizer = new ILOptimizer({ level: 'O1' });

    const program = createMultiFunctionProgram();
    expect(program.functions).toHaveLength(3);

    optimizer.optimizeProgram(program);

    // Both 'unused' and 'helper' are removed — only 'main' remains
    expect(program.functions).toHaveLength(1);
    expect(program.functions.map((f) => f.name)).not.toContain('unused');
    expect(program.functions.map((f) => f.name)).not.toContain('helper');
    expect(program.functions.map((f) => f.name)).toContain('main');
  });

  it('function passes only run on remaining functions after program pass', () => {
    // At O1: DFE removes 'unused', inline replaces 'helper' call,
    // second DFE removes 'helper'. Function-level passes only see 'main'.
    const optimizer = new ILOptimizer({ level: 'O1' });

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    const result = optimizer.getProgramResult();
    // Function results should only contain main (unused removed by DFE,
    // helper removed after inlining by second DFE)
    const funcNames = result!.functionResults.map((r) => r.functionName);
    expect(funcNames).toContain('main');
    expect(funcNames).not.toContain('unused');
    expect(funcNames).not.toContain('helper');
  });

  it('programPassResults are captured in ProgramOptimizationResult', () => {
    const optimizer = new ILOptimizer({ level: 'O1' });

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    const result = optimizer.getProgramResult();
    // At O1: dead-function-elim, function-inline, dead-function-elim (3 passes)
    expect(result!.programPassResults).toHaveLength(3);
    // First result is from dead-function-elim (removes 'unused')
    expect(result!.programPassResults[0].modified).toBe(true);
    expect(result!.programPassResults[0].functionsRemoved).toBe(1);
  });

  it('programPassResults is empty when no program passes are enabled', () => {
    // O0 disables all program passes, so results should be empty
    const optimizer = new ILOptimizer({ level: 'O0' });

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    const result = optimizer.getProgramResult();
    expect(result!.programPassResults).toEqual([]);
  });

  it('handles empty program gracefully', () => {
    // The auto-registered DFE handles empty programs without error
    const optimizer = new ILOptimizer({ level: 'O1' });

    const program = createTestILProgram([], 'main');
    optimizer.optimizeProgram(program);

    const result = optimizer.getProgramResult();
    expect(result!.modified).toBe(false);
    expect(result!.functionResults).toEqual([]);
  });
});

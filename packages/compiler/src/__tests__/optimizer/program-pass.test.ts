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

  it('O1 has dead-function-elim and single-site-inline', () => {
    const passes = getProgramPassesForLevel('O1');
    expect(passes).toContain('dead-function-elim');
    expect(passes).toContain('single-site-inline');
    expect(passes).toHaveLength(2);
  });

  it('O2 has dead-function-elim, dead-global-elim, function-inline', () => {
    const passes = getProgramPassesForLevel('O2');
    expect(passes).toContain('dead-function-elim');
    expect(passes).toContain('dead-global-elim');
    expect(passes).toContain('function-inline');
    expect(passes).toHaveLength(3);
  });

  it('O3 matches O2 program passes', () => {
    const o2 = getProgramPassesForLevel('O2');
    const o3 = getProgramPassesForLevel('O3');
    expect(o3).toEqual(o2);
  });

  it('Os has dead-function-elim and dead-global-elim but no inlining', () => {
    const passes = getProgramPassesForLevel('Os');
    expect(passes).toContain('dead-function-elim');
    expect(passes).toContain('dead-global-elim');
    expect(passes).not.toContain('function-inline');
    expect(passes).not.toContain('single-site-inline');
    expect(passes).toHaveLength(2);
  });

  it('Oz matches Os program passes (no inlining for size)', () => {
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

  it('getRegisteredProgramPasses returns registered names', () => {
    const optimizer = new ILOptimizer({ level: 'O0' });
    optimizer.registerProgramPass(createNoOpProgramPass('pass-a'));
    optimizer.registerProgramPass(createNoOpProgramPass('pass-b'));

    const names = optimizer.getRegisteredProgramPasses();
    expect(names).toContain('pass-a');
    expect(names).toContain('pass-b');
    expect(names).toHaveLength(2);
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

  it('starts with no program passes registered', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });
    expect(optimizer.getRegisteredProgramPasses()).toEqual([]);
  });
});

// ============================================================================
// Tests: Program Pass Execution
// ============================================================================

describe('ILOptimizer program pass execution', () => {
  it('runs registered program passes during optimizeProgram', () => {
    const log: string[] = [];
    const optimizer = new ILOptimizer({ level: 'O1' });
    // Register a pass matching O1 config: 'dead-function-elim'
    optimizer.registerProgramPass(
      createLoggingProgramPass('dead-function-elim', log)
    );

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    expect(log).toContain('dead-function-elim');
  });

  it('does NOT run unregistered program passes even if enabled by level', () => {
    const log: string[] = [];
    const optimizer = new ILOptimizer({ level: 'O1' });
    // Register only one of the two O1 program passes
    optimizer.registerProgramPass(
      createLoggingProgramPass('dead-function-elim', log)
    );
    // 'single-site-inline' is enabled at O1 but NOT registered

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    // Only the registered one should run
    expect(log).toEqual(['dead-function-elim']);
  });

  it('does NOT run program passes at O0', () => {
    const log: string[] = [];
    const optimizer = new ILOptimizer({ level: 'O0' });
    optimizer.registerProgramPass(
      createLoggingProgramPass('dead-function-elim', log)
    );

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    expect(log).toEqual([]);
  });

  it('runs program passes in dependency order', () => {
    const log: string[] = [];
    const optimizer = new ILOptimizer({ level: 'O2' });

    // Register passes in reverse order, but 'function-inline' depends on 'dead-function-elim'
    optimizer.registerProgramPass(
      createLoggingProgramPass('function-inline', log, ['dead-function-elim'])
    );
    optimizer.registerProgramPass(
      createLoggingProgramPass('dead-function-elim', log)
    );
    optimizer.registerProgramPass(
      createLoggingProgramPass('dead-global-elim', log)
    );

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    // dead-function-elim must come before function-inline
    const dfeIndex = log.indexOf('dead-function-elim');
    const fiIndex = log.indexOf('function-inline');
    expect(dfeIndex).toBeLessThan(fiIndex);
  });

  it('program passes can modify the program (remove functions)', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });
    // Register a pass that removes the 'unused' function
    optimizer.registerProgramPass(createRemovingProgramPass(['unused']));

    // Override pass name to match config
    const remover: ProgramOptimizationPass = {
      name: 'dead-function-elim',
      dependencies: [],
      run(program: ILProgram): ProgramPassResult {
        const before = program.functions.length;
        program.functions = program.functions.filter((f) => f.name !== 'unused');
        const removed = before - program.functions.length;
        return createProgramResult(removed, 0);
      },
    };
    // Reset and re-register
    const optimizer2 = new ILOptimizer({ level: 'O2' });
    optimizer2.registerProgramPass(remover);

    const program = createMultiFunctionProgram();
    expect(program.functions).toHaveLength(3);

    optimizer2.optimizeProgram(program);

    // 'unused' should have been removed by the program pass
    expect(program.functions).toHaveLength(2);
    expect(program.functions.map((f) => f.name)).not.toContain('unused');
  });

  it('function passes only run on remaining functions after program pass', () => {
    // This tests integration: program pass removes a function, then
    // function-level passes should NOT see the removed function
    const optimizer = new ILOptimizer({ level: 'O2' });

    const remover: ProgramOptimizationPass = {
      name: 'dead-function-elim',
      dependencies: [],
      run(program: ILProgram): ProgramPassResult {
        program.functions = program.functions.filter((f) => f.name !== 'unused');
        return createProgramResult(1, 0);
      },
    };
    optimizer.registerProgramPass(remover);

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    const result = optimizer.getProgramResult();
    // Function results should only contain main and helper (not unused)
    const funcNames = result!.functionResults.map((r) => r.functionName);
    expect(funcNames).toContain('main');
    expect(funcNames).toContain('helper');
    expect(funcNames).not.toContain('unused');
  });

  it('programPassResults are captured in ProgramOptimizationResult', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });

    const remover: ProgramOptimizationPass = {
      name: 'dead-function-elim',
      dependencies: [],
      run(program: ILProgram): ProgramPassResult {
        program.functions = program.functions.filter((f) => f.name !== 'unused');
        return createProgramResult(1, 0, ['Removed: unused']);
      },
    };
    optimizer.registerProgramPass(remover);

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    const result = optimizer.getProgramResult();
    expect(result!.programPassResults).toHaveLength(1);
    expect(result!.programPassResults[0].modified).toBe(true);
    expect(result!.programPassResults[0].functionsRemoved).toBe(1);
    expect(result!.programPassResults[0].debugInfo).toEqual(['Removed: unused']);
  });

  it('programPassResults is empty when no program passes run', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });
    // No program passes registered

    const program = createMultiFunctionProgram();
    optimizer.optimizeProgram(program);

    const result = optimizer.getProgramResult();
    expect(result!.programPassResults).toEqual([]);
  });

  it('handles empty program gracefully', () => {
    const optimizer = new ILOptimizer({ level: 'O2' });
    optimizer.registerProgramPass(createNoOpProgramPass('dead-function-elim'));

    const program = createTestILProgram([], 'main');
    optimizer.optimizeProgram(program);

    const result = optimizer.getProgramResult();
    expect(result!.modified).toBe(false);
    expect(result!.programPassResults).toHaveLength(1);
    expect(result!.functionResults).toEqual([]);
  });
});

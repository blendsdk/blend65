/**
 * Dead Function Elimination Pass Tests
 *
 * Tests for the DeadFunctionElimPass which removes functions
 * unreachable from the program's entry point.
 *
 * @module __tests__/optimizer/passes/dead-function-elim
 */

import { describe, it, expect } from 'vitest';
import { DeadFunctionElimPass } from '../../../optimizer/passes/dead-function-elim.js';
import { ILOptimizer } from '../../../optimizer/il-optimizer.js';
import type { OptimizationOptions } from '../../../optimizer/options.js';
import {
  createTestILFunction,
  createTestILProgram,
  createCallInstr,
  createReturnInstr,
  createLoadImmInstr,
  createStoreByteInstr,
} from '../helpers/optimizer-test-utils.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates default O1 options for testing dead function elimination.
 * DFE is enabled at O1+ in PROGRAM_LEVEL_PASSES.
 */
function createTestOptions(level: OptimizationOptions['level'] = 'O1'): OptimizationOptions {
  return { level, debug: false };
}

/**
 * Creates an exported test function (should never be eliminated).
 */
function createExportedFunction(name: string): ReturnType<typeof createTestILFunction> {
  return createTestILFunction(name, [createReturnInstr()], true);
}

/**
 * Creates a callback test function (should never be eliminated).
 * Uses Object.assign since createTestILFunction doesn't expose isCallback param.
 */
function createCallbackFunction(name: string): ReturnType<typeof createTestILFunction> {
  const func = createTestILFunction(name, [createReturnInstr()], false);
  return Object.assign(func, { isCallback: true });
}

// ============================================================================
// Tests
// ============================================================================

describe('DeadFunctionElimPass', () => {
  const pass = new DeadFunctionElimPass();

  // ──────────────────────────────────────────────────────────────
  // Pass Metadata
  // ──────────────────────────────────────────────────────────────

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(pass.name).toBe('dead-function-elim');
    });

    it('should have no dependencies', () => {
      expect(pass.dependencies).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // No-Op Scenarios (nothing to remove)
  // ──────────────────────────────────────────────────────────────

  describe('no-op scenarios', () => {
    it('should not modify a program with 0 functions', () => {
      const program = createTestILProgram([], 'main');
      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(false);
      expect(result.functionsRemoved).toBe(0);
      expect(program.functions).toHaveLength(0);
    });

    it('should not modify a program with only 1 function', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const program = createTestILProgram([main], 'main');
      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(false);
      expect(result.functionsRemoved).toBe(0);
      expect(program.functions).toHaveLength(1);
    });

    it('should not modify a program where all functions are reachable', () => {
      // main → helper → utility (all reachable chain)
      const utility = createTestILFunction('utility', [createReturnInstr()]);
      const helper = createTestILFunction('helper', [
        createCallInstr('utility'),
        createReturnInstr(),
      ]);
      const main = createTestILFunction('main', [
        createCallInstr('helper'),
        createReturnInstr(),
      ]);
      const program = createTestILProgram([main, helper, utility], 'main');
      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(false);
      expect(result.functionsRemoved).toBe(0);
      expect(program.functions).toHaveLength(3);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Basic Dead Function Removal
  // ──────────────────────────────────────────────────────────────

  describe('basic removal', () => {
    it('should remove a single unreachable function', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const dead = createTestILFunction('dead', [createReturnInstr()]);
      const program = createTestILProgram([main, dead], 'main');

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(true);
      expect(result.functionsRemoved).toBe(1);
      expect(result.functionsModified).toBe(0);
      expect(program.functions).toHaveLength(1);
      expect(program.functions[0].name).toBe('main');
    });

    it('should remove multiple unreachable functions', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const dead1 = createTestILFunction('dead1', [createReturnInstr()]);
      const dead2 = createTestILFunction('dead2', [createReturnInstr()]);
      const dead3 = createTestILFunction('dead3', [createReturnInstr()]);
      const program = createTestILProgram([main, dead1, dead2, dead3], 'main');

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(true);
      expect(result.functionsRemoved).toBe(3);
      expect(program.functions).toHaveLength(1);
      expect(program.functions[0].name).toBe('main');
    });

    it('should keep reachable functions and remove unreachable ones', () => {
      // main → helper (reachable); speedy, unused (unreachable)
      const helper = createTestILFunction('helper', [createReturnInstr()]);
      const main = createTestILFunction('main', [
        createCallInstr('helper'),
        createReturnInstr(),
      ]);
      const speedy = createTestILFunction('speedy', [createReturnInstr()]);
      const unused = createTestILFunction('unused', [createReturnInstr()]);
      const program = createTestILProgram([main, helper, speedy, unused], 'main');

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(true);
      expect(result.functionsRemoved).toBe(2);
      expect(program.functions).toHaveLength(2);

      const names = program.functions.map((f) => f.name);
      expect(names).toContain('main');
      expect(names).toContain('helper');
      expect(names).not.toContain('speedy');
      expect(names).not.toContain('unused');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Transitive Reachability
  // ──────────────────────────────────────────────────────────────

  describe('transitive reachability', () => {
    it('should keep deeply reachable functions', () => {
      // main → a → b → c (all reachable through chain)
      const c = createTestILFunction('c', [createReturnInstr()]);
      const b = createTestILFunction('b', [createCallInstr('c'), createReturnInstr()]);
      const a = createTestILFunction('a', [createCallInstr('b'), createReturnInstr()]);
      const main = createTestILFunction('main', [createCallInstr('a'), createReturnInstr()]);
      const program = createTestILProgram([main, a, b, c], 'main');

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(false);
      expect(program.functions).toHaveLength(4);
    });

    it('should remove functions only reachable from dead functions', () => {
      // main is entry; dead → deadHelper (both unreachable)
      const deadHelper = createTestILFunction('deadHelper', [createReturnInstr()]);
      const dead = createTestILFunction('dead', [
        createCallInstr('deadHelper'),
        createReturnInstr(),
      ]);
      const main = createTestILFunction('main', [createReturnInstr()]);
      const program = createTestILProgram([main, dead, deadHelper], 'main');

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(true);
      expect(result.functionsRemoved).toBe(2);
      expect(program.functions).toHaveLength(1);
      expect(program.functions[0].name).toBe('main');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Exported and Callback Preservation
  // ──────────────────────────────────────────────────────────────

  describe('exported/callback preservation', () => {
    it('should never remove exported functions', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const exported = createExportedFunction('render');
      const program = createTestILProgram([main, exported], 'main');

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(false);
      expect(program.functions).toHaveLength(2);

      const names = program.functions.map((f) => f.name);
      expect(names).toContain('render');
    });

    it('should never remove callback functions', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const irqHandler = createCallbackFunction('irqHandler');
      const program = createTestILProgram([main, irqHandler], 'main');

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(false);
      expect(program.functions).toHaveLength(2);

      const names = program.functions.map((f) => f.name);
      expect(names).toContain('irqHandler');
    });

    it('should remove dead functions but keep exported and callback ones', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const exported = createExportedFunction('initLib');
      const callback = createCallbackFunction('nmiHandler');
      const dead = createTestILFunction('unused', [createReturnInstr()]);
      const program = createTestILProgram([main, exported, callback, dead], 'main');

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(true);
      expect(result.functionsRemoved).toBe(1);
      expect(program.functions).toHaveLength(3);

      const names = program.functions.map((f) => f.name);
      expect(names).toContain('main');
      expect(names).toContain('initLib');
      expect(names).toContain('nmiHandler');
      expect(names).not.toContain('unused');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Debug Output
  // ──────────────────────────────────────────────────────────────

  describe('debug output', () => {
    it('should include debugInfo when debug is enabled', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const dead = createTestILFunction('speedy', [createReturnInstr()]);
      const program = createTestILProgram([main, dead], 'main');

      const result = pass.run(program, { level: 'O1', debug: true });

      expect(result.debugInfo).toBeDefined();
      expect(result.debugInfo).toHaveLength(1);
      expect(result.debugInfo![0]).toContain('speedy');
    });

    it('should not include debugInfo when debug is disabled', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const dead = createTestILFunction('unused', [createReturnInstr()]);
      const program = createTestILProgram([main, dead], 'main');

      const result = pass.run(program, { level: 'O1', debug: false });

      expect(result.debugInfo).toBeUndefined();
    });

    it('should list all removed function names in debugInfo', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const d1 = createTestILFunction('alpha', [createReturnInstr()]);
      const d2 = createTestILFunction('beta', [createReturnInstr()]);
      const program = createTestILProgram([main, d1, d2], 'main');

      const result = pass.run(program, { level: 'O1', debug: true });

      expect(result.debugInfo).toHaveLength(2);
      const debugText = result.debugInfo!.join(' ');
      expect(debugText).toContain('alpha');
      expect(debugText).toContain('beta');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Integration with ILOptimizer
  // ──────────────────────────────────────────────────────────────

  describe('integration with ILOptimizer', () => {
    it('should be automatically registered in ILOptimizer', () => {
      const optimizer = new ILOptimizer({ level: 'O1' });
      expect(optimizer.hasProgramPass('dead-function-elim')).toBe(true);
    });

    it('should run during optimizeProgram at O1', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const dead = createTestILFunction('speedy', [createReturnInstr()]);
      const program = createTestILProgram([main, dead], 'main');

      const optimizer = new ILOptimizer({ level: 'O1' });
      optimizer.optimizeProgram(program);

      // Dead function should have been removed
      expect(program.functions).toHaveLength(1);
      expect(program.functions[0].name).toBe('main');
    });

    it('should NOT run during optimizeProgram at O0', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const dead = createTestILFunction('speedy', [createReturnInstr()]);
      const program = createTestILProgram([main, dead], 'main');

      const optimizer = new ILOptimizer({ level: 'O0' });
      optimizer.optimizeProgram(program);

      // O0 disables all passes — dead function should still exist
      expect(program.functions).toHaveLength(2);
    });
  });
});

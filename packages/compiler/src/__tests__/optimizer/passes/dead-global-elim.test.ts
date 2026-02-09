/**
 * Dead Global Elimination Pass Tests
 *
 * Tests for the DeadGlobalElimPass which removes global variable
 * initialization code from `program.globalInit` when the global
 * is never referenced by any reachable function.
 *
 * @module __tests__/optimizer/passes/dead-global-elim
 */

import { describe, it, expect } from 'vitest';
import { DeadGlobalElimPass } from '../../../optimizer/passes/dead-global-elim.js';
import { ILOptimizer } from '../../../optimizer/il-optimizer.js';
import type { OptimizationOptions } from '../../../optimizer/options.js';
import {
  createTestILFunction,
  createTestILProgram,
  createLoadImmInstr,
  createStoreByteInstr,
  createLoadByteInstr,
  createReturnInstr,
  createCallInstr,
} from '../helpers/optimizer-test-utils.js';
import type { ILProgram } from '../../../il/structures.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates default O2 options for testing dead global elimination.
 * DGE is enabled at O2+ in PROGRAM_LEVEL_PASSES.
 */
function createTestOptions(level: OptimizationOptions['level'] = 'O2'): OptimizationOptions {
  return { level, debug: false };
}

/**
 * Creates a test program with global initialization instructions.
 *
 * Builds an ILProgram with specified functions and globalInit instructions.
 * Each global is initialized via a LOAD_IMM + STORE_BYTE pair.
 *
 * @param functions - Array of ILFunctions
 * @param globalSlotNames - Names of globals to initialize in globalInit
 * @param entryPoint - Entry point function name (default: 'main')
 * @returns ILProgram with globalInit populated
 */
function createProgramWithGlobals(
  functions: ReturnType<typeof createTestILFunction>[],
  globalSlotNames: string[],
  entryPoint = 'main'
): ILProgram {
  const program = createTestILProgram(functions, entryPoint);

  // Build globalInit: each global gets a LOAD_IMM + STORE_BYTE pair
  for (let i = 0; i < globalSlotNames.length; i++) {
    program.globalInit.push(createLoadImmInstr(i));
    program.globalInit.push(createStoreByteInstr(globalSlotNames[i]));
  }

  return program;
}

// ============================================================================
// Tests
// ============================================================================

describe('DeadGlobalElimPass', () => {
  const pass = new DeadGlobalElimPass();

  // ──────────────────────────────────────────────────────────────
  // Pass Metadata
  // ──────────────────────────────────────────────────────────────

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(pass.name).toBe('dead-global-elim');
    });

    it('should depend on dead-function-elim', () => {
      expect(pass.dependencies).toEqual(['dead-function-elim']);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // No-Op Scenarios (nothing to remove)
  // ──────────────────────────────────────────────────────────────

  describe('no-op scenarios', () => {
    it('should not modify a program with empty globalInit', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const program = createTestILProgram([main], 'main');

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(false);
      expect(result.functionsModified).toBe(0);
      expect(program.globalInit).toHaveLength(0);
    });

    it('should not modify a program where all globals are referenced', () => {
      // main references both 'x' and 'y'
      const main = createTestILFunction('main', [
        createLoadByteInstr('x'),
        createLoadByteInstr('y'),
        createReturnInstr(),
      ]);
      const program = createProgramWithGlobals([main], ['x', 'y']);

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(false);
      expect(result.functionsModified).toBe(0);
      // Both globals still have their LOAD_IMM + STORE_BYTE pairs
      expect(program.globalInit).toHaveLength(4);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Basic Dead Global Removal
  // ──────────────────────────────────────────────────────────────

  describe('basic removal', () => {
    it('should remove a single unreferenced global', () => {
      // main references 'x' but not 'unused'
      const main = createTestILFunction('main', [
        createLoadByteInstr('x'),
        createReturnInstr(),
      ]);
      const program = createProgramWithGlobals([main], ['x', 'unused']);

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(true);
      expect(result.functionsModified).toBe(1); // 1 dead global removed
      // Only 'x' init remains (LOAD_IMM + STORE_BYTE = 2 instructions)
      expect(program.globalInit).toHaveLength(2);
    });

    it('should remove multiple unreferenced globals', () => {
      // main references 'used' but not 'dead1', 'dead2', 'dead3'
      const main = createTestILFunction('main', [
        createLoadByteInstr('used'),
        createReturnInstr(),
      ]);
      const program = createProgramWithGlobals([main], ['used', 'dead1', 'dead2', 'dead3']);

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(true);
      expect(result.functionsModified).toBe(3); // 3 dead globals removed
      // Only 'used' init remains (2 instructions)
      expect(program.globalInit).toHaveLength(2);
    });

    it('should remove all globals when none are referenced', () => {
      // main doesn't reference any globals
      const main = createTestILFunction('main', [
        createLoadImmInstr(42),
        createReturnInstr(),
      ]);
      const program = createProgramWithGlobals([main], ['a', 'b', 'c']);

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(true);
      expect(result.functionsModified).toBe(3);
      expect(program.globalInit).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Cross-Function References
  // ──────────────────────────────────────────────────────────────

  describe('cross-function references', () => {
    it('should keep globals referenced by any reachable function', () => {
      // main calls helper; helper references 'counter'
      // 'unused' is not referenced by anyone
      const helper = createTestILFunction('helper', [
        createLoadByteInstr('counter'),
        createReturnInstr(),
      ]);
      const main = createTestILFunction('main', [
        createCallInstr('helper'),
        createReturnInstr(),
      ]);
      const program = createProgramWithGlobals([main, helper], ['counter', 'unused']);

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(true);
      expect(result.functionsModified).toBe(1); // 'unused' removed
      // Only 'counter' init remains (2 instructions)
      expect(program.globalInit).toHaveLength(2);
    });

    it('should keep globals referenced by multiple functions', () => {
      // Both main and helper reference 'shared'
      const helper = createTestILFunction('helper', [
        createLoadByteInstr('shared'),
        createReturnInstr(),
      ]);
      const main = createTestILFunction('main', [
        createLoadByteInstr('shared'),
        createCallInstr('helper'),
        createReturnInstr(),
      ]);
      const program = createProgramWithGlobals([main, helper], ['shared']);

      const result = pass.run(program, createTestOptions());

      expect(result.modified).toBe(false);
      expect(program.globalInit).toHaveLength(2);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Store Instructions in Functions Keep Globals Alive
  // ──────────────────────────────────────────────────────────────

  describe('store references keep globals alive', () => {
    it('should keep globals that are only stored to (not loaded) by functions', () => {
      // main stores to 'output' — this counts as a reference
      const main = createTestILFunction('main', [
        createLoadImmInstr(42),
        createStoreByteInstr('output'),
        createReturnInstr(),
      ]);
      const program = createProgramWithGlobals([main], ['output']);

      const result = pass.run(program, createTestOptions());

      // 'output' is referenced (via store), so it should NOT be removed
      expect(result.modified).toBe(false);
      expect(program.globalInit).toHaveLength(2);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Debug Output
  // ──────────────────────────────────────────────────────────────

  describe('debug output', () => {
    it('should include debugInfo when debug is enabled', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const program = createProgramWithGlobals([main], ['deadGlobal']);

      const result = pass.run(program, { level: 'O2', debug: true });

      expect(result.debugInfo).toBeDefined();
      expect(result.debugInfo).toHaveLength(1);
      expect(result.debugInfo![0]).toContain('deadGlobal');
    });

    it('should not include debugInfo when debug is disabled', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const program = createProgramWithGlobals([main], ['deadGlobal']);

      const result = pass.run(program, { level: 'O2', debug: false });

      expect(result.debugInfo).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Integration with ILOptimizer
  // ──────────────────────────────────────────────────────────────

  describe('integration with ILOptimizer', () => {
    it('should be automatically registered in ILOptimizer', () => {
      const optimizer = new ILOptimizer({ level: 'O2' });
      expect(optimizer.hasProgramPass('dead-global-elim')).toBe(true);
    });

    it('should run during optimizeProgram at O2', () => {
      // main references 'x' but not 'unused'
      const main = createTestILFunction('main', [
        createLoadByteInstr('x'),
        createReturnInstr(),
      ]);
      const program = createProgramWithGlobals([main], ['x', 'unused']);

      const optimizer = new ILOptimizer({ level: 'O2' });
      optimizer.optimizeProgram(program);

      // Dead global 'unused' should have been removed
      // Only 'x' init remains (2 instructions)
      expect(program.globalInit).toHaveLength(2);
    });

    it('should NOT run during optimizeProgram at O1', () => {
      // main references 'x' but not 'unused'
      const main = createTestILFunction('main', [
        createLoadByteInstr('x'),
        createReturnInstr(),
      ]);
      const program = createProgramWithGlobals([main], ['x', 'unused']);

      const optimizer = new ILOptimizer({ level: 'O1' });
      optimizer.optimizeProgram(program);

      // O1 does NOT enable dead-global-elim — both globals should remain
      // Both init pairs still present (4 instructions)
      expect(program.globalInit).toHaveLength(4);
    });

    it('should NOT run during optimizeProgram at O0', () => {
      const main = createTestILFunction('main', [createReturnInstr()]);
      const program = createProgramWithGlobals([main], ['unused']);

      const optimizer = new ILOptimizer({ level: 'O0' });
      optimizer.optimizeProgram(program);

      // O0 disables all passes — dead global should still exist
      expect(program.globalInit).toHaveLength(2);
    });
  });
});

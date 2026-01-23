/**
 * Optimizer Tests
 *
 * Tests for the Optimizer class which provides IL module optimization.
 * Currently tests the O0 (no optimization) pass-through stub implementation.
 *
 * Test Categories:
 * - Options: OptimizationLevel enum and options creation
 * - Construction: Optimizer creation with various options
 * - Optimization: Pass-through behavior at O0
 * - Validation: Module validation before optimization
 * - Integration: Optimizer with real IL modules
 *
 * @module optimizer/optimizer.test
 */

import { describe, expect, it } from 'vitest';
import {
  Optimizer,
  OptimizationLevel,
  OptimizationResult,
  OptimizationOptions,
  createDefaultOptions,
  createOptionsForLevel,
  createDefaultOptimizer,
  createOptimizerForLevel,
  isLevelImplemented,
} from '../../optimizer/index.js';
import { ILModule } from '../../il/module.js';
import { ILStorageClass } from '../../il/function.js';
import { IL_BYTE, IL_VOID } from '../../il/types.js';
import { ILReturnVoidInstruction } from '../../il/instructions.js';

// =============================================================================
// OptimizationLevel Enum Tests
// =============================================================================

describe('OptimizationLevel', () => {
  describe('enum values', () => {
    it('should have O0 as 0', () => {
      expect(OptimizationLevel.O0).toBe(0);
    });

    it('should have O1 as 1', () => {
      expect(OptimizationLevel.O1).toBe(1);
    });

    it('should have O2 as 2', () => {
      expect(OptimizationLevel.O2).toBe(2);
    });

    it('should have O3 as 3', () => {
      expect(OptimizationLevel.O3).toBe(3);
    });

    it('should have Os as 10', () => {
      expect(OptimizationLevel.Os).toBe(10);
    });

    it('should have Oz as 11', () => {
      expect(OptimizationLevel.Oz).toBe(11);
    });
  });

  describe('reverse lookup', () => {
    it('should get level name from value', () => {
      expect(OptimizationLevel[0]).toBe('O0');
      expect(OptimizationLevel[1]).toBe('O1');
      expect(OptimizationLevel[2]).toBe('O2');
      expect(OptimizationLevel[3]).toBe('O3');
      expect(OptimizationLevel[10]).toBe('Os');
      expect(OptimizationLevel[11]).toBe('Oz');
    });
  });
});

// =============================================================================
// Options Creation Tests
// =============================================================================

describe('optimization options', () => {
  describe('createDefaultOptions()', () => {
    it('should create options with O0 level', () => {
      const options = createDefaultOptions();

      expect(options.level).toBe(OptimizationLevel.O0);
    });

    it('should create options with verbose false', () => {
      const options = createDefaultOptions();

      expect(options.verbose).toBe(false);
    });

    it('should not set targetId by default', () => {
      const options = createDefaultOptions();

      expect(options.targetId).toBeUndefined();
    });
  });

  describe('createOptionsForLevel()', () => {
    it('should create options for O0', () => {
      const options = createOptionsForLevel(OptimizationLevel.O0);

      expect(options.level).toBe(OptimizationLevel.O0);
    });

    it('should create options for O1', () => {
      const options = createOptionsForLevel(OptimizationLevel.O1);

      expect(options.level).toBe(OptimizationLevel.O1);
    });

    it('should create options for O2', () => {
      const options = createOptionsForLevel(OptimizationLevel.O2);

      expect(options.level).toBe(OptimizationLevel.O2);
    });

    it('should create options for Os', () => {
      const options = createOptionsForLevel(OptimizationLevel.Os);

      expect(options.level).toBe(OptimizationLevel.Os);
    });
  });

  describe('isLevelImplemented()', () => {
    it('should return true for O0', () => {
      expect(isLevelImplemented(OptimizationLevel.O0)).toBe(true);
    });

    it('should return false for O1', () => {
      expect(isLevelImplemented(OptimizationLevel.O1)).toBe(false);
    });

    it('should return false for O2', () => {
      expect(isLevelImplemented(OptimizationLevel.O2)).toBe(false);
    });

    it('should return false for O3', () => {
      expect(isLevelImplemented(OptimizationLevel.O3)).toBe(false);
    });

    it('should return false for Os', () => {
      expect(isLevelImplemented(OptimizationLevel.Os)).toBe(false);
    });

    it('should return false for Oz', () => {
      expect(isLevelImplemented(OptimizationLevel.Oz)).toBe(false);
    });
  });
});

// =============================================================================
// Optimizer Construction Tests
// =============================================================================

describe('Optimizer', () => {
  describe('construction', () => {
    it('should create with default options', () => {
      const optimizer = new Optimizer();

      expect(optimizer.getLevel()).toBe(OptimizationLevel.O0);
    });

    it('should create with custom level', () => {
      const optimizer = new Optimizer({ level: OptimizationLevel.O2 });

      expect(optimizer.getLevel()).toBe(OptimizationLevel.O2);
    });

    it('should create with verbose option', () => {
      const optimizer = new Optimizer({ verbose: true });

      const options = optimizer.getOptions();
      expect(options.verbose).toBe(true);
    });

    it('should create with target option', () => {
      const optimizer = new Optimizer({ targetId: 'c64' });

      const options = optimizer.getOptions();
      expect(options.targetId).toBe('c64');
    });

    it('should merge partial options with defaults', () => {
      const optimizer = new Optimizer({ verbose: true });

      const options = optimizer.getOptions();
      expect(options.level).toBe(OptimizationLevel.O0);
      expect(options.verbose).toBe(true);
    });
  });

  describe('getLevel()', () => {
    it('should return the optimization level', () => {
      const optimizer = new Optimizer({ level: OptimizationLevel.O3 });

      expect(optimizer.getLevel()).toBe(OptimizationLevel.O3);
    });
  });

  describe('getOptions()', () => {
    it('should return a copy of options', () => {
      const optimizer = new Optimizer({ level: OptimizationLevel.O1, verbose: true });

      const options1 = optimizer.getOptions();
      const options2 = optimizer.getOptions();

      // Should be equal but not the same reference
      expect(options1).toEqual(options2);
      expect(options1).not.toBe(options2);
    });
  });

  describe('toString()', () => {
    it('should include level name', () => {
      const optimizer = new Optimizer({ level: OptimizationLevel.O2 });

      expect(optimizer.toString()).toContain('O2');
    });
  });
});

// =============================================================================
// Optimizer Factory Functions Tests
// =============================================================================

describe('optimizer factory functions', () => {
  describe('createDefaultOptimizer()', () => {
    it('should create optimizer with O0 level', () => {
      const optimizer = createDefaultOptimizer();

      expect(optimizer.getLevel()).toBe(OptimizationLevel.O0);
    });
  });

  describe('createOptimizerForLevel()', () => {
    it('should create optimizer for specified level', () => {
      const optimizer = createOptimizerForLevel(OptimizationLevel.O2);

      expect(optimizer.getLevel()).toBe(OptimizationLevel.O2);
    });
  });
});

// =============================================================================
// Optimization Tests (O0 Pass-Through)
// =============================================================================

describe('Optimizer.optimize()', () => {
  /**
   * Creates a simple valid IL module for testing
   */
  function createTestModule(name: string = 'test'): ILModule {
    const module = new ILModule(name);
    const func = module.createFunction('main', [], IL_VOID);
    func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
    return module;
  }

  describe('O0 level (pass-through)', () => {
    it('should return the same module unchanged', () => {
      const module = createTestModule();
      const optimizer = new Optimizer({ level: OptimizationLevel.O0 });

      const result = optimizer.optimize(module);

      expect(result.module).toBe(module);
    });

    it('should report modified as false', () => {
      const module = createTestModule();
      const optimizer = new Optimizer({ level: OptimizationLevel.O0 });

      const result = optimizer.optimize(module);

      expect(result.modified).toBe(false);
    });

    it('should report the correct level', () => {
      const module = createTestModule();
      const optimizer = new Optimizer({ level: OptimizationLevel.O0 });

      const result = optimizer.optimize(module);

      expect(result.level).toBe(OptimizationLevel.O0);
    });

    it('should report empty passes run', () => {
      const module = createTestModule();
      const optimizer = new Optimizer({ level: OptimizationLevel.O0 });

      const result = optimizer.optimize(module);

      expect(result.passesRun).toHaveLength(0);
    });

    it('should report time taken', () => {
      const module = createTestModule();
      const optimizer = new Optimizer({ level: OptimizationLevel.O0 });

      const result = optimizer.optimize(module);

      expect(result.timeMs).toBeGreaterThanOrEqual(0);
    });

    it('should have empty warnings', () => {
      const module = createTestModule();
      const optimizer = new Optimizer({ level: OptimizationLevel.O0 });

      const result = optimizer.optimize(module);

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('unimplemented levels (fallback to pass-through)', () => {
    it('should pass through at O1', () => {
      const module = createTestModule();
      const optimizer = new Optimizer({ level: OptimizationLevel.O1 });

      const result = optimizer.optimize(module);

      expect(result.module).toBe(module);
      expect(result.modified).toBe(false);
    });

    it('should pass through at O2', () => {
      const module = createTestModule();
      const optimizer = new Optimizer({ level: OptimizationLevel.O2 });

      const result = optimizer.optimize(module);

      expect(result.module).toBe(module);
      expect(result.modified).toBe(false);
    });

    it('should pass through at O3', () => {
      const module = createTestModule();
      const optimizer = new Optimizer({ level: OptimizationLevel.O3 });

      const result = optimizer.optimize(module);

      expect(result.module).toBe(module);
      expect(result.modified).toBe(false);
    });

    it('should pass through at Os', () => {
      const module = createTestModule();
      const optimizer = new Optimizer({ level: OptimizationLevel.Os });

      const result = optimizer.optimize(module);

      expect(result.module).toBe(module);
      expect(result.modified).toBe(false);
    });

    it('should pass through at Oz', () => {
      const module = createTestModule();
      const optimizer = new Optimizer({ level: OptimizationLevel.Oz });

      const result = optimizer.optimize(module);

      expect(result.module).toBe(module);
      expect(result.modified).toBe(false);
    });
  });

  describe('with complex modules', () => {
    it('should handle module with multiple functions', () => {
      const module = new ILModule('multi');
      const f1 = module.createFunction('init', [], IL_VOID);
      const f2 = module.createFunction('update', [], IL_VOID);
      const f3 = module.createFunction('render', [], IL_VOID);
      f1.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
      f2.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
      f3.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const optimizer = new Optimizer();
      const result = optimizer.optimize(module);

      expect(result.module.getFunctionCount()).toBe(3);
    });

    it('should handle module with globals', () => {
      const module = createTestModule();
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('buffer', IL_BYTE, ILStorageClass.Ram);

      const optimizer = new Optimizer();
      const result = optimizer.optimize(module);

      expect(result.module.getGlobalCount()).toBe(2);
    });

    it('should handle module with imports and exports', () => {
      const module = createTestModule();
      module.createImport('helper', 'helper', './utils.bl65');
      module.createExport('main', 'main', 'function');

      const optimizer = new Optimizer();
      const result = optimizer.optimize(module);

      expect(result.module.getImportCount()).toBe(1);
      expect(result.module.getExportCount()).toBe(1);
    });

    it('should handle module with entry point', () => {
      const module = createTestModule();
      module.setEntryPoint('main');

      const optimizer = new Optimizer();
      const result = optimizer.optimize(module);

      expect(result.module.hasEntryPoint()).toBe(true);
      expect(result.module.getEntryPointName()).toBe('main');
    });
  });
});

// =============================================================================
// Module Validation Tests
// =============================================================================

describe('Optimizer.validateModule()', () => {
  it('should return empty errors for valid module', () => {
    const module = new ILModule('test');
    const func = module.createFunction('main', [], IL_VOID);
    func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

    const optimizer = new Optimizer();
    const errors = optimizer.validateModule(module);

    expect(errors).toHaveLength(0);
  });

  it('should delegate to module validation', () => {
    const module = new ILModule('test');
    // Create an export referencing non-existent function
    module.createExport('missing', 'nonexistent', 'function');

    const optimizer = new Optimizer();
    const errors = optimizer.validateModule(module);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('nonexistent'))).toBe(true);
  });
});

// =============================================================================
// OptimizationResult Type Tests
// =============================================================================

describe('OptimizationResult', () => {
  it('should have all required properties', () => {
    const module = new ILModule('test');
    const func = module.createFunction('main', [], IL_VOID);
    func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

    const optimizer = new Optimizer();
    const result = optimizer.optimize(module);

    // Type check - all these should be defined
    expect(result.module).toBeDefined();
    expect(typeof result.modified).toBe('boolean');
    expect(typeof result.level).toBe('number');
    expect(Array.isArray(result.passesRun)).toBe(true);
    expect(typeof result.timeMs).toBe('number');
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
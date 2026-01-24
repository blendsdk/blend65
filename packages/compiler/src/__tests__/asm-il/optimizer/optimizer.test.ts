/**
 * ASM-IL Optimizer Tests
 *
 * Tests for the ASM optimizer including pass management,
 * pass-through mode, and fixed-point iteration.
 *
 * @module __tests__/asm-il/optimizer/optimizer.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AsmOptimizer, createAsmOptimizer } from '../../../asm-il/optimizer/asm-optimizer.js';
import { PassThroughOptimizer, createPassThroughOptimizer } from '../../../asm-il/optimizer/pass-through.js';
import { AsmModuleBuilder } from '../../../asm-il/builder/module-builder.js';
import type { AsmModule } from '../../../asm-il/types.js';
import type { AsmOptimizationPass, AsmOptimizationResult } from '../../../asm-il/optimizer/types.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a simple test module
 */
function createTestModule(): AsmModule {
  return new AsmModuleBuilder('test.blend')
    .functionLabel('_main')
    .ldaImm(0x05)
    .staAbs(0xD020)
    .rts()
    .build();
}

/**
 * Create a mock optimization pass that does nothing
 */
function createNoOpPass(name: string): AsmOptimizationPass {
  return {
    name,
    isTransform: true,
    run: (module: AsmModule) => module,
  };
}

/**
 * Create a mock optimization pass that marks it was run
 */
function createCountingPass(name: string, counter: { count: number }): AsmOptimizationPass {
  return {
    name,
    isTransform: true,
    run: (module: AsmModule) => {
      counter.count++;
      return module;
    },
  };
}

/**
 * Create a mock pass that makes a change on first run only
 */
function createOneShotPass(name: string): { pass: AsmOptimizationPass; runs: number[] } {
  const runs: number[] = [];
  let runCount = 0;
  
  return {
    runs,
    pass: {
      name,
      isTransform: true,
      run: (module: AsmModule) => {
        runCount++;
        runs.push(runCount);
        
        // Only "change" on first run by returning a new object
        if (runCount === 1) {
          return { ...module };
        }
        return module;
      },
    },
  };
}

// ============================================================================
// PASS-THROUGH OPTIMIZER TESTS
// ============================================================================

describe('PassThroughOptimizer', () => {
  describe('construction', () => {
    it('should create with factory function', () => {
      const optimizer = createPassThroughOptimizer();
      expect(optimizer).toBeInstanceOf(PassThroughOptimizer);
    });

    it('should create with constructor', () => {
      const optimizer = new PassThroughOptimizer();
      expect(optimizer).toBeInstanceOf(PassThroughOptimizer);
    });
  });

  describe('optimize', () => {
    it('should return module unchanged', () => {
      const optimizer = createPassThroughOptimizer();
      const module = createTestModule();

      const result = optimizer.optimize(module);

      expect(result.module).toBe(module);
    });

    it('should report no changes', () => {
      const optimizer = createPassThroughOptimizer();
      const module = createTestModule();

      const result = optimizer.optimize(module);

      expect(result.changed).toBe(false);
    });

    it('should report zero iterations (pass-through)', () => {
      const optimizer = createPassThroughOptimizer();
      const module = createTestModule();

      const result = optimizer.optimize(module);

      // Pass-through optimizer doesn't iterate
      expect(result.iterations).toBe(0);
    });

    it('should have empty pass stats', () => {
      const optimizer = createPassThroughOptimizer();
      const module = createTestModule();

      const result = optimizer.optimize(module);

      expect(result.passStats.size).toBe(0);
    });
  });
});

// ============================================================================
// ASM OPTIMIZER TESTS
// ============================================================================

describe('AsmOptimizer', () => {
  describe('construction', () => {
    it('should create with factory function', () => {
      const optimizer = createAsmOptimizer();
      expect(optimizer).toBeInstanceOf(AsmOptimizer);
    });

    it('should create with constructor', () => {
      const optimizer = new AsmOptimizer();
      expect(optimizer).toBeInstanceOf(AsmOptimizer);
    });

    it('should accept partial config', () => {
      const optimizer = createAsmOptimizer({
        enabled: true,
        maxIterations: 5,
      });

      expect(optimizer.isEnabled()).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should be disabled by default', () => {
      const optimizer = createAsmOptimizer();
      expect(optimizer.isEnabled()).toBe(false);
    });

    it('should enable/disable optimization', () => {
      const optimizer = createAsmOptimizer();

      optimizer.setEnabled(true);
      expect(optimizer.isEnabled()).toBe(true);

      optimizer.setEnabled(false);
      expect(optimizer.isEnabled()).toBe(false);
    });

    it('should set max iterations', () => {
      const optimizer = createAsmOptimizer();
      const result = optimizer.setMaxIterations(10);

      expect(result).toBe(optimizer); // Check chaining
    });

    it('should set debug mode', () => {
      const optimizer = createAsmOptimizer();
      const result = optimizer.setDebug(true);

      expect(result).toBe(optimizer); // Check chaining
    });
  });

  describe('pass management', () => {
    it('should add passes', () => {
      const optimizer = createAsmOptimizer({ enabled: true });
      const pass = createNoOpPass('test-pass');

      const result = optimizer.addPass(pass);

      expect(result).toBe(optimizer); // Check chaining
    });

    it('should remove passes by name', () => {
      // Test that removePass returns this for chaining
      const optimizer = createAsmOptimizer({ enabled: true });
      const pass = createNoOpPass('test-pass');
      
      const result = optimizer.addPass(pass).removePass('test-pass');
      
      expect(result).toBe(optimizer); // Chaining works
    });

    it('should handle removing non-existent pass gracefully', () => {
      const optimizer = createAsmOptimizer({ enabled: true });

      // Should not throw
      expect(() => optimizer.removePass('non-existent')).not.toThrow();
    });
  });

  describe('optimize - disabled mode', () => {
    it('should return pass-through result when disabled', () => {
      const optimizer = createAsmOptimizer({ enabled: false });
      const module = createTestModule();

      const result = optimizer.optimize(module);

      expect(result.module).toBe(module);
      expect(result.changed).toBe(false);
      expect(result.iterations).toBe(0);
    });

    it('should not run passes when disabled', () => {
      const counter = { count: 0 };
      const pass = createCountingPass('test-pass', counter);
      const optimizer = createAsmOptimizer({ enabled: false })
        .addPass(pass);

      const module = createTestModule();
      optimizer.optimize(module);

      expect(counter.count).toBe(0);
    });
  });

  describe('optimize - no passes', () => {
    it('should return pass-through result with no passes', () => {
      const optimizer = createAsmOptimizer({ enabled: true });
      const module = createTestModule();

      const result = optimizer.optimize(module);

      expect(result.module).toBe(module);
      expect(result.changed).toBe(false);
    });
  });

  describe('optimize - with passes', () => {
    it('should run all passes', () => {
      const counter1 = { count: 0 };
      const counter2 = { count: 0 };
      const optimizer = createAsmOptimizer({ enabled: true })
        .addPass(createCountingPass('pass1', counter1))
        .addPass(createCountingPass('pass2', counter2));

      const module = createTestModule();
      optimizer.optimize(module);

      expect(counter1.count).toBeGreaterThan(0);
      expect(counter2.count).toBeGreaterThan(0);
    });

    it('should run passes in order', () => {
      const order: string[] = [];
      const pass1: AsmOptimizationPass = {
        name: 'pass1',
        isTransform: true,
        run: (module: AsmModule) => {
          order.push('pass1');
          return module;
        },
      };
      const pass2: AsmOptimizationPass = {
        name: 'pass2',
        isTransform: true,
        run: (module: AsmModule) => {
          order.push('pass2');
          return module;
        },
      };

      const optimizer = createAsmOptimizer({ enabled: true })
        .addPass(pass1)
        .addPass(pass2);

      const module = createTestModule();
      optimizer.optimize(module);

      expect(order[0]).toBe('pass1');
      expect(order[1]).toBe('pass2');
    });

    it('should track pass statistics', () => {
      const pass = createNoOpPass('test-pass');
      const optimizer = createAsmOptimizer({ enabled: true })
        .addPass(pass);

      const module = createTestModule();
      const result = optimizer.optimize(module);

      expect(result.passStats.has('test-pass')).toBe(true);
      const stats = result.passStats.get('test-pass');
      expect(stats?.name).toBe('test-pass');
      expect(stats?.timeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('fixed-point iteration', () => {
    it('should stop when no changes', () => {
      const counter = { count: 0 };
      const pass = createCountingPass('test-pass', counter);
      const optimizer = createAsmOptimizer({ enabled: true, maxIterations: 10 })
        .addPass(pass);

      const module = createTestModule();
      const result = optimizer.optimize(module);

      // Should run once and stop because no change
      expect(result.iterations).toBe(1);
      expect(counter.count).toBe(1);
    });

    it('should iterate when changes occur', () => {
      const { pass, runs } = createOneShotPass('one-shot');
      const optimizer = createAsmOptimizer({ enabled: true, maxIterations: 10 })
        .addPass(pass);

      const module = createTestModule();
      const result = optimizer.optimize(module);

      // First iteration: pass makes change
      // Second iteration: pass makes no change, stop
      expect(result.iterations).toBe(2);
      expect(runs).toEqual([1, 2]);
    });

    it('should respect maxIterations', () => {
      // Pass that always "changes" (returns new object)
      let runCount = 0;
      const alwaysChangesPass: AsmOptimizationPass = {
        name: 'always-changes',
        isTransform: true,
        run: (module: AsmModule) => {
          runCount++;
          return { ...module }; // Always return new object
        },
      };

      const optimizer = createAsmOptimizer({ enabled: true, maxIterations: 3 })
        .addPass(alwaysChangesPass);

      const module = createTestModule();
      const result = optimizer.optimize(module);

      expect(result.iterations).toBe(3);
      expect(runCount).toBe(3);
    });

    it('should report changed = true when any pass changes module', () => {
      const { pass } = createOneShotPass('one-shot');
      const optimizer = createAsmOptimizer({ enabled: true })
        .addPass(pass);

      const module = createTestModule();
      const result = optimizer.optimize(module);

      expect(result.changed).toBe(true);
    });

    it('should report the optimization result correctly', () => {
      const pass = createNoOpPass('no-op');
      const optimizer = createAsmOptimizer({ enabled: true })
        .addPass(pass);

      const module = createTestModule();
      const result = optimizer.optimize(module);

      // When no-op pass runs, module should remain unchanged
      expect(result.module).toBeDefined();
      expect(result.iterations).toBeGreaterThanOrEqual(1);
      expect(result.passStats.has('no-op')).toBe(true);
    });
  });

  describe('fluent API', () => {
    it('should support full method chaining', () => {
      const pass = createNoOpPass('test');
      const module = createTestModule();

      const result = createAsmOptimizer()
        .setEnabled(true)
        .setMaxIterations(5)
        .setDebug(false)
        .addPass(pass)
        .optimize(module);

      expect(result).toBeDefined();
      expect(result.module).toBeDefined();
    });
  });
});

// ============================================================================
// RESULT INTERFACE TESTS
// ============================================================================

describe('AsmOptimizationResult', () => {
  it('should have all required properties', () => {
    const optimizer = createAsmOptimizer({ enabled: true });
    const module = createTestModule();

    const result = optimizer.optimize(module);

    expect(result).toHaveProperty('module');
    expect(result).toHaveProperty('changed');
    expect(result).toHaveProperty('iterations');
    expect(result).toHaveProperty('passStats');
  });

  it('should have correct types', () => {
    const optimizer = createAsmOptimizer({ enabled: true });
    const module = createTestModule();

    const result = optimizer.optimize(module);

    expect(typeof result.changed).toBe('boolean');
    expect(typeof result.iterations).toBe('number');
    expect(result.passStats).toBeInstanceOf(Map);
  });
});
/**
 * Tests for Pass Manager
 *
 * @module __tests__/optimizer/pass-manager.test
 */

import { describe, it, expect } from 'vitest';
import { PassManager } from '../../optimizer/pass-manager.js';
import { createEmptyResult, createResult, type OptimizationPass } from '../../optimizer/pass.js';
import type { ILFunction } from '../../il/structures.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a minimal ILFunction for testing.
 */
function createTestFunction(instructionCount: number = 10): ILFunction {
  return {
    name: 'test',
    frame: {} as never,
    instructions: Array(instructionCount).fill({
      opcode: 0,
      operands: [],
    }),
    isExported: false,
    isCallback: false,
    loops: [],
    maxLoopDepth: 0,
  };
}

/**
 * Create a mock pass for testing.
 */
function createMockPass(
  name: string,
  dependencies: string[] = [],
  behavior: 'remove' | 'add' | 'noop' = 'noop',
  amount: number = 1
): OptimizationPass {
  return {
    name,
    dependencies,
    run: (func) => {
      if (behavior === 'remove') {
        // Simulate removing instructions
        func.instructions = func.instructions.slice(0, -amount);
        return createResult(amount, 0);
      } else if (behavior === 'add') {
        // Simulate adding instructions
        for (let i = 0; i < amount; i++) {
          func.instructions.push({ opcode: 0, operands: [] });
        }
        return createResult(0, amount);
      }
      return createEmptyResult();
    },
  };
}

// ============================================================================
// Constructor Tests
// ============================================================================

describe('PassManager constructor', () => {
  it('should create with default options', () => {
    const manager = new PassManager();
    expect(manager.getOptions().level).toBe('O2');
  });

  it('should create with custom options', () => {
    const manager = new PassManager({ level: 'O3', debug: true });
    expect(manager.getOptions().level).toBe('O3');
    expect(manager.getOptions().debug).toBe(true);
  });

  it('should start with no registered passes', () => {
    const manager = new PassManager();
    expect(manager.getRegisteredPasses()).toEqual([]);
  });
});

// ============================================================================
// Pass Registration Tests
// ============================================================================

describe('PassManager.registerPass', () => {
  it('should register a pass', () => {
    const manager = new PassManager();
    const pass = createMockPass('test-pass');

    manager.registerPass(pass);

    expect(manager.hasPass('test-pass')).toBe(true);
  });

  it('should throw on duplicate registration', () => {
    const manager = new PassManager();
    const pass = createMockPass('test-pass');

    manager.registerPass(pass);

    expect(() => manager.registerPass(pass)).toThrow(
      "Pass 'test-pass' is already registered"
    );
  });

  it('should register multiple passes', () => {
    const manager = new PassManager();

    manager.registerPass(createMockPass('pass-a'));
    manager.registerPass(createMockPass('pass-b'));
    manager.registerPass(createMockPass('pass-c'));

    expect(manager.getRegisteredPasses()).toEqual(['pass-a', 'pass-b', 'pass-c']);
  });
});

describe('PassManager.hasPass', () => {
  it('should return true for registered pass', () => {
    const manager = new PassManager();
    manager.registerPass(createMockPass('test-pass'));

    expect(manager.hasPass('test-pass')).toBe(true);
  });

  it('should return false for unregistered pass', () => {
    const manager = new PassManager();

    expect(manager.hasPass('nonexistent')).toBe(false);
  });
});

describe('PassManager.getPass', () => {
  it('should return registered pass', () => {
    const manager = new PassManager();
    const pass = createMockPass('test-pass');
    manager.registerPass(pass);

    expect(manager.getPass('test-pass')).toBe(pass);
  });

  it('should return undefined for unregistered pass', () => {
    const manager = new PassManager();

    expect(manager.getPass('nonexistent')).toBeUndefined();
  });
});

// ============================================================================
// O0 Optimization Tests (No Optimization)
// ============================================================================

describe('PassManager O0 level', () => {
  it('should skip all passes at O0', () => {
    const manager = new PassManager({ level: 'O0' });
    manager.registerPass(createMockPass('dce', [], 'remove', 3));

    const func = createTestFunction(10);
    const result = manager.optimize(func);

    expect(result.modified).toBe(false);
    expect(result.totalIterations).toBe(0);
    expect(func.instructions).toHaveLength(10);
  });
});

// ============================================================================
// Pass Ordering Tests
// ============================================================================

describe('PassManager pass ordering', () => {
  it('should run passes in dependency order', () => {
    const executionOrder: string[] = [];

    const passA: OptimizationPass = {
      name: 'dce',
      dependencies: [],
      run: () => {
        executionOrder.push('dce');
        return createEmptyResult();
      },
    };

    const passB: OptimizationPass = {
      name: 'constant-fold',
      dependencies: ['dce'],
      run: () => {
        executionOrder.push('constant-fold');
        return createEmptyResult();
      },
    };

    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['dce', 'constant-fold'],
    });

    manager.registerPass(passA);
    manager.registerPass(passB);

    const func = createTestFunction();
    manager.optimize(func);

    expect(executionOrder).toEqual(['dce', 'constant-fold']);
  });

  it('should handle complex dependency chains', () => {
    const executionOrder: string[] = [];

    const createOrderTrackingPass = (
      name: string,
      deps: string[]
    ): OptimizationPass => ({
      name,
      dependencies: deps,
      run: () => {
        executionOrder.push(name);
        return createEmptyResult();
      },
    });

    // A → B → C chain
    const passA = createOrderTrackingPass('pass-a', []);
    const passB = createOrderTrackingPass('pass-b', ['pass-a']);
    const passC = createOrderTrackingPass('pass-c', ['pass-b']);

    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['pass-c', 'pass-a', 'pass-b'], // Out of order
    });

    // Register out of order
    manager.registerPass(passC);
    manager.registerPass(passA);
    manager.registerPass(passB);

    const func = createTestFunction();
    manager.optimize(func);

    expect(executionOrder).toEqual(['pass-a', 'pass-b', 'pass-c']);
  });

  it('should detect circular dependencies', () => {
    const passA: OptimizationPass = {
      name: 'pass-a',
      dependencies: ['pass-b'],
      run: () => createEmptyResult(),
    };

    const passB: OptimizationPass = {
      name: 'pass-b',
      dependencies: ['pass-a'],
      run: () => createEmptyResult(),
    };

    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['pass-a', 'pass-b'],
    });

    manager.registerPass(passA);
    manager.registerPass(passB);

    const func = createTestFunction();
    expect(() => manager.optimize(func)).toThrow(/Circular dependency/);
  });

  it('should only run enabled passes', () => {
    const executionOrder: string[] = [];

    const createTrackingPass = (name: string): OptimizationPass => ({
      name,
      dependencies: [],
      run: () => {
        executionOrder.push(name);
        return createEmptyResult();
      },
    });

    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['pass-a', 'pass-c'], // pass-b not enabled
    });

    manager.registerPass(createTrackingPass('pass-a'));
    manager.registerPass(createTrackingPass('pass-b'));
    manager.registerPass(createTrackingPass('pass-c'));

    const func = createTestFunction();
    manager.optimize(func);

    expect(executionOrder).toEqual(['pass-a', 'pass-c']);
    expect(executionOrder).not.toContain('pass-b');
  });
});

// ============================================================================
// Optimization Execution Tests
// ============================================================================

describe('PassManager.optimize', () => {
  it('should return empty result when no passes registered', () => {
    const manager = new PassManager({ level: 'O2' });
    const func = createTestFunction();

    const result = manager.optimize(func);

    expect(result.modified).toBe(false);
    expect(result.stats).toEqual([]);
  });

  it('should track modifications correctly', () => {
    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['dce'],
    });
    manager.registerPass(createMockPass('dce', [], 'remove', 3));

    const func = createTestFunction(10);
    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
    expect(result.totalInstructionsRemoved).toBe(3);
    expect(func.instructions).toHaveLength(7);
  });

  it('should track added instructions', () => {
    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['test'],
    });
    manager.registerPass(createMockPass('test', [], 'add', 2));

    const func = createTestFunction(10);
    const result = manager.optimize(func);

    expect(result.modified).toBe(true);
    expect(result.totalInstructionsAdded).toBe(2);
    expect(func.instructions).toHaveLength(12);
  });

  it('should collect stats for each pass', () => {
    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['dce', 'fold'],
    });
    manager.registerPass(createMockPass('dce', [], 'remove', 2));
    manager.registerPass(createMockPass('fold', ['dce'], 'remove', 1));

    const func = createTestFunction(10);
    const result = manager.optimize(func);

    expect(result.stats).toHaveLength(2);
    expect(result.stats[0].pass).toBe('dce');
    expect(result.stats[0].instructionsBefore).toBe(10);
    expect(result.stats[0].instructionsAfter).toBe(8);
    expect(result.stats[1].pass).toBe('fold');
    expect(result.stats[1].instructionsBefore).toBe(8);
    expect(result.stats[1].instructionsAfter).toBe(7);
  });

  it('should report totalIterations', () => {
    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['dce'],
    });
    manager.registerPass(createMockPass('dce'));

    const func = createTestFunction();
    const result = manager.optimize(func);

    expect(result.totalIterations).toBe(1);
  });

  it('should report totalDurationMs', () => {
    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['dce'],
    });
    manager.registerPass(createMockPass('dce'));

    const func = createTestFunction();
    const result = manager.optimize(func);

    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Iterative Optimization Tests (O3, Oz)
// ============================================================================

describe('PassManager iterative optimization', () => {
  it('should iterate multiple times at O3', () => {
    let runCount = 0;
    const pass: OptimizationPass = {
      name: 'test',
      dependencies: [],
      run: (func) => {
        runCount++;
        // Modify on first 3 runs, then stop
        if (runCount <= 3) {
          func.instructions.pop();
          return createResult(1, 0);
        }
        return createEmptyResult();
      },
    };

    const manager = new PassManager({
      level: 'O3',
      enabledPasses: ['test'],
      maxIterations: 10,
    });
    manager.registerPass(pass);

    const func = createTestFunction(10);
    const result = manager.optimize(func);

    expect(runCount).toBe(4); // 3 modifying + 1 that returns no change
    expect(result.totalIterations).toBe(4);
    expect(func.instructions).toHaveLength(7);
  });

  it('should respect maxIterations limit', () => {
    let runCount = 0;
    const pass: OptimizationPass = {
      name: 'test',
      dependencies: [],
      run: (func) => {
        runCount++;
        func.instructions.pop();
        return createResult(1, 0);
      },
    };

    const manager = new PassManager({
      level: 'O3',
      enabledPasses: ['test'],
      maxIterations: 3, // Limit iterations
    });
    manager.registerPass(pass);

    const func = createTestFunction(10);
    const result = manager.optimize(func);

    expect(runCount).toBe(3);
    expect(result.totalIterations).toBe(3);
  });

  it('should stop at fixed point (no changes)', () => {
    let runCount = 0;
    const pass: OptimizationPass = {
      name: 'test',
      dependencies: [],
      run: () => {
        runCount++;
        return createEmptyResult(); // No changes
      },
    };

    const manager = new PassManager({
      level: 'O3',
      enabledPasses: ['test'],
      maxIterations: 10,
    });
    manager.registerPass(pass);

    const func = createTestFunction();
    manager.optimize(func);

    expect(runCount).toBe(1); // Only one iteration since no changes
  });

  it('should not iterate at O2', () => {
    let runCount = 0;
    const pass: OptimizationPass = {
      name: 'test',
      dependencies: [],
      run: (func) => {
        runCount++;
        func.instructions.pop();
        return createResult(1, 0);
      },
    };

    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['test'],
    });
    manager.registerPass(pass);

    const func = createTestFunction(10);
    manager.optimize(func);

    expect(runCount).toBe(1); // Only one iteration at O2
  });

  it('should iterate at Oz', () => {
    let runCount = 0;
    const pass: OptimizationPass = {
      name: 'test',
      dependencies: [],
      run: (func) => {
        runCount++;
        if (runCount <= 2) {
          func.instructions.pop();
          return createResult(1, 0);
        }
        return createEmptyResult();
      },
    };

    const manager = new PassManager({
      level: 'Oz',
      enabledPasses: ['test'],
      maxIterations: 10,
    });
    manager.registerPass(pass);

    const func = createTestFunction(10);
    manager.optimize(func);

    expect(runCount).toBe(3); // Iterates until fixed point
  });
});

// ============================================================================
// Options Access Tests
// ============================================================================

describe('PassManager options access', () => {
  it('should get options', () => {
    const manager = new PassManager({ level: 'O3', debug: true });
    const options = manager.getOptions();

    expect(options.level).toBe('O3');
    expect(options.debug).toBe(true);
  });

  it('should set options', () => {
    const manager = new PassManager({ level: 'O2' });
    manager.setOptions({ level: 'O3', debug: true });

    expect(manager.getOptions().level).toBe('O3');
    expect(manager.getOptions().debug).toBe(true);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('PassManager edge cases', () => {
  it('should handle pass with unregistered dependency', () => {
    // Pass depends on something not registered - should still work
    const pass: OptimizationPass = {
      name: 'test',
      dependencies: ['nonexistent'],
      run: () => createEmptyResult(),
    };

    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['test'],
    });
    manager.registerPass(pass);

    const func = createTestFunction();
    // Should not throw
    expect(() => manager.optimize(func)).not.toThrow();
  });

  it('should handle empty function', () => {
    const manager = new PassManager({
      level: 'O2',
      enabledPasses: ['test'],
    });
    // Use a noop pass for empty function test
    manager.registerPass(createMockPass('test', [], 'noop'));

    const func = createTestFunction(0);
    const result = manager.optimize(func);

    // Should not throw, function stays empty
    expect(result.modified).toBe(false);
    expect(func.instructions).toHaveLength(0);
  });
});
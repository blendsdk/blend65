/**
 * ASM-IL Pipeline Performance Tests
 *
 * Benchmarks for the compilation pipeline to ensure
 * acceptable performance characteristics.
 *
 * @module __tests__/asm-il/integration/performance.test
 * @since Phase 3f (CodeGenerator Integration)
 */

import { describe, it, expect } from 'vitest';
import { compileToAcme, createDefaultConfig } from '../../../asm-il/compile-to-acme.js';
import { ILModule } from '../../../il/module.js';
import {
  ILReturnVoidInstruction,
  ILConstInstruction,
  ILHardwareWriteInstruction,
} from '../../../il/instructions.js';
import { IL_VOID, IL_BYTE } from '../../../il/types.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a module with a simple main function
 */
function createSmallModule(): ILModule {
  const module = new ILModule('small.blend');
  const func = module.createFunction('main', [], IL_VOID);
  func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
  module.setEntryPoint('main');
  return module;
}

/**
 * Creates a module with multiple functions and hardware access
 */
function createMediumModule(): ILModule {
  const module = new ILModule('medium.blend');

  // Main function
  const main = module.createFunction('main', [], IL_VOID);
  main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
  module.setEntryPoint('main');

  // Add several helper functions
  for (let i = 0; i < 10; i++) {
    const func = module.createFunction(`helper_${i}`, [], IL_VOID);
    const entry = func.getEntryBlock();
    const reg = func.createRegister(IL_BYTE, 't0');

    // Add several instructions per function
    for (let j = 0; j < 5; j++) {
      entry.addInstruction(new ILConstInstruction(j * 2, j, IL_BYTE, reg));
      entry.addInstruction(
        new ILHardwareWriteInstruction(j * 2 + 1, 0xd020 + i, reg)
      );
    }
    entry.addInstruction(new ILReturnVoidInstruction(10));
  }

  return module;
}

/**
 * Creates a larger module with many functions and instructions
 */
function createLargeModule(): ILModule {
  const module = new ILModule('large.blend');

  // Main function
  const main = module.createFunction('main', [], IL_VOID);
  main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
  module.setEntryPoint('main');

  // Add many helper functions
  for (let i = 0; i < 50; i++) {
    const func = module.createFunction(`func_${i}`, [], IL_VOID);
    const entry = func.getEntryBlock();
    const reg = func.createRegister(IL_BYTE, 't0');

    // Add more instructions per function
    for (let j = 0; j < 10; j++) {
      entry.addInstruction(new ILConstInstruction(j * 2, j, IL_BYTE, reg));
      entry.addInstruction(
        new ILHardwareWriteInstruction(j * 2 + 1, 0xd000 + (i % 256), reg)
      );
    }
    entry.addInstruction(new ILReturnVoidInstruction(20));
  }

  return module;
}

/**
 * Measures execution time of a function
 */
function measureTime(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

// ============================================================================
// PERFORMANCE BENCHMARKS
// ============================================================================

describe('Pipeline Performance', () => {
  describe('small program compilation', () => {
    it('should compile in < 150ms', () => {
      const module = createSmallModule();
      const config = createDefaultConfig();

      const elapsed = measureTime(() => {
        compileToAcme(module, config);
      });

      // 150ms threshold accounts for system load variability, cold starts, and GC timing
      expect(elapsed).toBeLessThan(150);
    });

    it('should compile with optimization in < 200ms', () => {
      const module = createSmallModule();
      const config = createDefaultConfig({ optimize: true });

      const elapsed = measureTime(() => {
        compileToAcme(module, config);
      });

      // Allow extra time for variability in system load and GC timing
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('medium program compilation', () => {
    it('should compile in < 200ms', () => {
      const module = createMediumModule();
      const config = createDefaultConfig();

      const elapsed = measureTime(() => {
        compileToAcme(module, config);
      });

      expect(elapsed).toBeLessThan(200);
    });

    it('should compile with optimization in < 300ms', () => {
      const module = createMediumModule();
      const config = createDefaultConfig({ optimize: true });

      const elapsed = measureTime(() => {
        compileToAcme(module, config);
      });

      expect(elapsed).toBeLessThan(300);
    });
  });

  describe('large program compilation', () => {
    it('should compile in < 500ms', () => {
      const module = createLargeModule();
      const config = createDefaultConfig();

      const elapsed = measureTime(() => {
        compileToAcme(module, config);
      });

      expect(elapsed).toBeLessThan(500);
    });

    it('should compile with optimization in < 750ms', () => {
      const module = createLargeModule();
      const config = createDefaultConfig({ optimize: true });

      const elapsed = measureTime(() => {
        compileToAcme(module, config);
      });

      expect(elapsed).toBeLessThan(750);
    });
  });
});

// ============================================================================
// REPEATED COMPILATION TESTS
// ============================================================================

describe('Repeated Compilations', () => {
  // Skip: This test is inherently flaky due to system load variations, GC timing, and CPU throttling
  it.skip('should maintain consistent performance over multiple compilations', () => {
    const module = createMediumModule();
    const config = createDefaultConfig();

    const times: number[] = [];

    // Warm up
    compileToAcme(module, config);

    // Measure multiple runs
    for (let i = 0; i < 5; i++) {
      const elapsed = measureTime(() => {
        compileToAcme(module, config);
      });
      times.push(elapsed);
    }

    // Calculate variance - should be reasonably consistent
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const maxDeviation = Math.max(...times.map(t => Math.abs(t - avg)));

    // Deviation should be less than 2x average (accounts for GC, etc.)
    expect(maxDeviation).toBeLessThan(avg * 2);
  });

  it('should handle sequential compilations without memory issues', () => {
    const config = createDefaultConfig();

    // Compile many modules sequentially
    for (let i = 0; i < 20; i++) {
      const module = new ILModule(`test_${i}.blend`);
      const func = module.createFunction('main', [], IL_VOID);
      func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
      module.setEntryPoint('main');

      const result = compileToAcme(module, config);

      // Each result should be valid
      expect(result.asmText.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// OUTPUT SIZE TESTS
// ============================================================================

describe('Output Size Scaling', () => {
  it('should produce proportionally sized output', () => {
    const smallModule = createSmallModule();
    const mediumModule = createMediumModule();
    const largeModule = createLargeModule();
    const config = createDefaultConfig();

    const smallResult = compileToAcme(smallModule, config);
    const mediumResult = compileToAcme(mediumModule, config);
    const largeResult = compileToAcme(largeModule, config);

    // Larger modules should produce more output
    expect(mediumResult.stats.totalBytes).toBeGreaterThan(smallResult.stats.totalBytes);
    expect(largeResult.stats.totalBytes).toBeGreaterThan(mediumResult.stats.totalBytes);

    // Line counts should also scale
    expect(mediumResult.stats.lineCount).toBeGreaterThan(smallResult.stats.lineCount);
    expect(largeResult.stats.lineCount).toBeGreaterThan(mediumResult.stats.lineCount);
  });

  it('should track function counts accurately', () => {
    const smallModule = createSmallModule();
    const mediumModule = createMediumModule();
    const largeModule = createLargeModule();
    const config = createDefaultConfig();

    const smallResult = compileToAcme(smallModule, config);
    const mediumResult = compileToAcme(mediumModule, config);
    const largeResult = compileToAcme(largeModule, config);

    // Function counts should match what we created
    expect(smallResult.stats.functionCount).toBeGreaterThanOrEqual(1); // main
    expect(mediumResult.stats.functionCount).toBeGreaterThanOrEqual(11); // main + 10 helpers
    expect(largeResult.stats.functionCount).toBeGreaterThanOrEqual(51); // main + 50 funcs
  });
});
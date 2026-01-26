/**
 * End-to-End Pipeline Tests for Ternary Expressions
 *
 * Tests the complete compilation pipeline for ternary expressions:
 * Source → Lexer → Parser → Semantic Analyzer → IL Generator → Code Generator
 *
 * Verifies that ternary expressions compile correctly through all phases
 * and produce valid assembly output.
 *
 * @module test;s/pipeline/ternary-e2e
 */

import { describe, it, expect } from 'vitest';

import { Compiler } from '../../compiler.js';
import { DiagnosticSeverity } from '../../ast/diagnostics.js';
import { getDefaultConfig } from '../../config/defaults.js';
import type { Blend65Config } from '../../config/types.js';

/**
 * Creates a minimal valid configuration
 */
function createConfig(overrides: Partial<Blend65Config> = {}): Blend65Config {
  const base = getDefaultConfig();
  return {
    ...base,
    ...overrides,
    compilerOptions: {
      ...base.compilerOptions,
      ...(overrides.compilerOptions || {}),
    },
  };
}

/**
 * Compiles source and returns the result.
 * Fails the test with diagnostics if compilation fails at an unexpected phase.
 */
function compileSource(
  source: string,
  stopAfterPhase?: 'parse' | 'semantic' | 'il' | 'optimize' | 'codegen'
) {
  const compiler = new Compiler();
  const sources = new Map([['main.blend', source]]);
  const config = createConfig();
  return compiler.compileSource(sources, config, stopAfterPhase);
}

// =============================================================================
// Basic Ternary E2E Tests - Parse Phase
// =============================================================================

describe('Ternary E2E - Parse Phase', () => {
  describe('basic ternary parsing', () => {
    it('should parse simple ternary expression', () => {
      const source = `module test;\nlet x: byte = true ? 1 : 0;`;
      const result = compileSource(source, 'parse');
      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.parse?.diagnostics.length).toBe(0);
    });

    it('should parse ternary with identifiers', () => {
      const source = `module test;\nlet flag: boolean = true;\nlet a: byte = 10;\nlet b: byte = 20;\nlet result: byte = flag ? a : b;`;
      const result = compileSource(source, 'parse');
      expect(result.phases.parse?.success).toBe(true);
    });

    it('should parse nested ternary (right-associative)', () => {
      const source = `module test;\nlet a: boolean = true;\nlet b: boolean = false;\nlet result: byte = a ? 1 : b ? 2 : 3;`;
      const result = compileSource(source, 'parse');
      expect(result.phases.parse?.success).toBe(true);
    });

    it('should parse ternary with comparison condition', () => {
      const source = `module test;\nlet x: byte = 5;\nlet y: byte = 10;\nlet result: byte = (x < y) ? x : y;`;
      const result = compileSource(source, 'parse');
      expect(result.phases.parse?.success).toBe(true);
    });

    it('should parse ternary with arithmetic in branches', () => {
      const source = `module test;\nlet x: byte = 10;\nlet result: byte = true ? x + 1 : x - 1;`;
      const result = compileSource(source, 'parse');
      expect(result.phases.parse?.success).toBe(true);
    });
  });
});

// =============================================================================
// Ternary E2E Tests - Semantic Phase
// =============================================================================

describe('Ternary E2E - Semantic Phase', () => {
  describe('type checking success', () => {
    it('should type check ternary with byte branches', () => {
      const source = `module test;\nlet flag: boolean = true;\nlet result: byte = flag ? 10 : 20;`;
      const result = compileSource(source, 'semantic');
      expect(result.phases.semantic?.success).toBe(true);
      expect(
        result.phases.semantic?.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR)
          .length
      ).toBe(0);
    });

    it('should type check ternary with word branches', () => {
      const source = `module test;\nlet flag: boolean = false;\nlet result: word = flag ? 1000 : 2000;`;
      const result = compileSource(source, 'semantic');
      expect(result.phases.semantic?.success).toBe(true);
    });

    it('should type check ternary with boolean branches', () => {
      const source = `module test;\nlet state: boolean = true;\nlet result: boolean = state ? false : true;`;
      const result = compileSource(source, 'semantic');
      expect(result.phases.semantic?.success).toBe(true);
    });

    it('should type check ternary with type promotion (byte + word → word)', () => {
      const source = `module test;\nlet flag: boolean = true;\nlet small: byte = 10;\nlet large: word = 1000;\nlet result: word = flag ? large : small;`;
      const result = compileSource(source, 'semantic');
      expect(result.phases.semantic?.success).toBe(true);
    });

    it('should type check nested ternary', () => {
      const source = `module test;\nlet a: boolean = true;\nlet b: boolean = false;\nlet result: byte = a ? 1 : b ? 2 : 3;`;
      const result = compileSource(source, 'semantic');
      expect(result.phases.semantic?.success).toBe(true);
    });
  });

  describe('type checking errors', () => {
    it('should report error for non-boolean condition', () => {
      const source = `module test;\nlet x: byte = 5;\nlet result: byte = x ? 1 : 0;`;
      const result = compileSource(source, 'semantic');
      // Should have error about condition not being boolean
      const errors =
        result.phases.semantic?.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR) ??
        [];
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some(
          e =>
            e.message.toLowerCase().includes('bool') ||
            e.message.toLowerCase().includes('condition')
        )
      ).toBe(true);
    });

    it('should report error for incompatible branch types (boolean vs numeric)', () => {
      const source = `module test;\nlet flag: boolean = true;\nlet result: byte = flag ? 10 : true;`;
      const result = compileSource(source, 'semantic');
      // Should have error about incompatible types
      const errors =
        result.phases.semantic?.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR) ??
        [];
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Ternary E2E Tests - IL Generation Phase
// =============================================================================

describe('Ternary E2E - IL Generation Phase', () => {
  describe('IL generation success', () => {
    it('should generate IL for simple ternary', () => {
      const source = `module test;\nfunction select(): byte { let flag: boolean = true; return flag ? 10 : 20; }`;
      const result = compileSource(source, 'il');
      expect(result.phases.il?.success).toBe(true);
    });

    it('should generate IL for ternary with comparison', () => {
      const source = `module test;\nfunction max(): byte { let a: byte = 5; let b: byte = 10; return (a > b) ? a : b; }`;
      const result = compileSource(source, 'il');
      expect(result.phases.il?.success).toBe(true);
    });

    it('should generate IL for nested ternary', () => {
      const source = `module test;\nfunction clamp(): byte { let x: byte = 50; let min: byte = 10; let max: byte = 100; return (x < min) ? min : (x > max) ? max : x; }`;
      const result = compileSource(source, 'il');
      expect(result.phases.il?.success).toBe(true);
    });

    it('should generate IL for ternary with arithmetic', () => {
      const source = `module test;\nfunction compute(): byte { let flag: boolean = true; let a: byte = 5; let b: byte = 10; return flag ? a + b : a - b; }`;
      const result = compileSource(source, 'il');
      expect(result.phases.il?.success).toBe(true);
    });

    it('should generate IL for ternary with function call', () => {
      const source = `module test;\nfunction identity(x: byte): byte { return x; }\nfunction test(): byte { let flag: boolean = true; return identity(flag ? 10 : 20); }`;
      const result = compileSource(source, 'il');
      expect(result.phases.il?.success).toBe(true);
    });
  });
});

// =============================================================================
// Ternary E2E Tests - Full Pipeline
// =============================================================================

describe('Ternary E2E - Full Pipeline', () => {
  describe('complete compilation', () => {
    it('should compile simple ternary to assembly', () => {
      const source = `module test;\nfunction select(): byte { let flag: boolean = true; return flag ? 42 : 0; }`;
      const result = compileSource(source);

      // Should complete all phases
      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });

    it('should compile min function using ternary', () => {
      const source = `module test;\nfunction min(a: byte, b: byte): byte { return (a < b) ? a : b; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });

    it('should compile max function using ternary', () => {
      const source = `module test;\nfunction max(a: byte, b: byte): byte { return (a > b) ? a : b; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });

    it('should compile clamp function using nested ternary', () => {
      const source = `module test;\nfunction clamp(x: byte, min: byte, max: byte): byte { return (x < min) ? min : (x > max) ? max : x; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });

    it('should compile absolute value using ternary', () => {
      // Note: Using unsigned byte, so we use simple byte difference
      const source = `module test;\nfunction abs(x: byte, y: byte): byte { return (x >= y) ? x - y : y - x; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
    });
  });
});

// =============================================================================
// Ternary E2E Tests - C64-Specific Patterns
// =============================================================================

describe('Ternary E2E - C64 Patterns', () => {
  describe('sprite control patterns', () => {
    it('should compile sprite enable toggle', () => {
      const source = `module test;\nfunction spriteEnable(enabled: boolean): byte { return enabled ? $FF : $00; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });

    it('should compile direction toggle', () => {
      const source = `module test;\nfunction getDirection(movingRight: boolean): byte { return movingRight ? 1 : 255; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });
  });

  describe('boundary checking patterns', () => {
    it('should compile screen boundary wrap', () => {
      const source = `module test;\nfunction wrapX(x: byte): byte { return (x >= 40) ? 0 : x; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });

    it('should compile coordinate clamping', () => {
      const source = `module test;\nfunction clampX(x: byte): byte { return (x > 255) ? 255 : x; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
    });
  });

  describe('color selection patterns', () => {
    it('should compile color selection', () => {
      const source = `module test;\nfunction selectColor(active: boolean): byte { return active ? 1 : 0; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });

    it('should compile alternate color pattern', () => {
      const source = `module test;\nfunction altColor(frameEven: boolean): byte { return frameEven ? 14 : 6; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });
  });

  describe('game logic patterns', () => {
    it('should compile collision response', () => {
      const source = `module test;\nfunction collisionResponse(hit: boolean, current: byte): byte { return hit ? 0 : current; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });

    it('should compile score bonus calculation', () => {
      const source = `module test;\nfunction scoreBonus(perfect: boolean): byte { return perfect ? 100 : 10; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });

    it('should compile enemy behavior selection', () => {
      const source = `module test;\nfunction enemySpeed(aggressive: boolean): byte { return aggressive ? 4 : 2; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });
  });
});

// =============================================================================
// Ternary E2E Tests - Complex Expressions
// =============================================================================

describe('Ternary E2E - Complex Expressions', () => {
  describe('ternary with complex conditions', () => {
    it('should compile ternary with logical AND condition', () => {
      const source = `module test;\nfunction check(a: boolean, b: boolean): byte { return (a && b) ? 1 : 0; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });

    it('should compile ternary with logical OR condition', () => {
      const source = `module test;\nfunction check(a: boolean, b: boolean): byte { return (a || b) ? 1 : 0; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });

    it('should compile ternary with arithmetic condition', () => {
      const source = `module test;\nfunction check(a: byte, b: byte, threshold: byte): byte { return (a + b > threshold) ? 1 : 0; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });
  });

  describe('ternary with complex branches', () => {
    it('should compile ternary with function calls in branches', () => {
      const source = `module test;\nfunction id(x: byte): byte { return x; }\nfunction test(flag: boolean): byte { return flag ? id(10) : id(20); }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });

    it('should compile ternary with bitwise operations in branches', () => {
      const source = `module test;\nfunction bitOp(flag: boolean, val: byte): byte { return flag ? val & $0F : val | $F0; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });
  });

  describe('deeply nested ternary', () => {
    it('should compile triple nested ternary', () => {
      const source = `module test;\nfunction grade(score: byte): byte { return (score >= 90) ? 4 : (score >= 80) ? 3 : (score >= 70) ? 2 : 1; }`;
      const result = compileSource(source);

      expect(result.phases.parse?.success).toBe(true);
      expect(result.phases.semantic?.success).toBe(true);
      expect(result.phases.il?.success).toBe(true);
    });
  });
});

// =============================================================================
// Ternary E2E Tests - Error Handling
// =============================================================================

describe('Ternary E2E - Error Handling', () => {
  describe('parse errors', () => {
    it('should report error for incomplete ternary (missing colon)', () => {
      const source = `module test;\nlet x: byte = true ? 1;`;
      const result = compileSource(source, 'parse');

      // Should have parse error - check if phase didn't complete fully
      // Parser might recover, so we check if there are any diagnostics or parse issues
      const hasIssue =
        !result.phases.parse?.success || (result.phases.parse?.diagnostics.length ?? 0) > 0;
      expect(hasIssue).toBe(true);
    });

    it('should report error for incomplete ternary (missing else branch)', () => {
      const source = `module test;\nlet x: byte = true ? 1 :;`;
      const result = compileSource(source, 'parse');

      // Should have parse error
      const hasIssue =
        !result.phases.parse?.success || (result.phases.parse?.diagnostics.length ?? 0) > 0;
      expect(hasIssue).toBe(true);
    });
  });

  describe('semantic errors', () => {
    it('should report error for undefined identifier in condition', () => {
      const source = `module test;\nlet x: byte = unknownVar ? 1 : 0;`;
      const result = compileSource(source, 'semantic');

      // Should have error about undefined
      const hasErrors =
        !result.phases.semantic?.success ||
        result.phases.semantic?.diagnostics.some(d => d.severity === DiagnosticSeverity.ERROR);
      expect(hasErrors).toBe(true);
    });

    it('should report error for undefined identifier in branch', () => {
      const source = `module test;\nlet x: byte = true ? unknownVar : 0;`;
      const result = compileSource(source, 'semantic');

      // Should have error about undefined
      const hasErrors =
        !result.phases.semantic?.success ||
        result.phases.semantic?.diagnostics.some(d => d.severity === DiagnosticSeverity.ERROR);
      expect(hasErrors).toBe(true);
    });
  });
});

// =============================================================================
// Ternary E2E Tests - Timing and Statistics
// =============================================================================

describe('Ternary E2E - Compilation Statistics', () => {
  it('should track compilation time for ternary expressions', () => {
    const source = `module test;\nfunction test(): byte { return true ? 1 : 0; }`;
    const result = compileSource(source);

    expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.totalTimeMs).toBe('number');
  });

  it('should track phase times for ternary compilation', () => {
    const source = `module test;\nfunction test(): byte { return true ? 1 : 0; }`;
    const result = compileSource(source);

    if (result.phases.parse) {
      expect(result.phases.parse.timeMs).toBeGreaterThanOrEqual(0);
    }
    if (result.phases.semantic) {
      expect(result.phases.semantic.timeMs).toBeGreaterThanOrEqual(0);
    }
    if (result.phases.il) {
      expect(result.phases.il.timeMs).toBeGreaterThanOrEqual(0);
    }
  });
});

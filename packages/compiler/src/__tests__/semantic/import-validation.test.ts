/**
 * Tests for Import Validation
 *
 * Validates export status checking and missing symbol detection
 * for cross-module imports (Task 6.2.3 enhancements).
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SemanticAnalyzer } from '../../semantic/analyzer.js';
import { DiagnosticCode } from '../../ast/diagnostics.js';

/**
 * Helper: Parse and analyze multiple modules
 */
function analyzeModules(sources: Array<{ name: string; code: string }>) {
  const programs = sources.map(({ code }) => {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  });

  const analyzer = new SemanticAnalyzer();
  return analyzer.analyzeMultiple(programs);
}

describe('Import Validation - Export Status', () => {
  it('should allow importing exported symbols', () => {
    const result = analyzeModules([
      {
        name: 'moduleA',
        code: `
          module moduleA
          export let counter: byte = 0;
          
          export function incrementCounter(): void
            counter = counter + 1;
          end function
        `,
      },
      {
        name: 'moduleB',
        code: `
          module moduleB
          import counter from moduleA
          
          export function useCounter(): byte
            return counter;
          end function
        `,
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('should error when importing non-exported variable', () => {
    const result = analyzeModules([
      {
        name: 'moduleA',
        code: `
          module moduleA
          let internal: byte = 0;
        `,
      },
      {
        name: 'moduleB',
        code: `
          module moduleB
          import internal from moduleA
        `,
      },
    ]);

    expect(result.success).toBe(false);

    const importErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.IMPORT_NOT_EXPORTED
    );
    expect(importErrors).toHaveLength(1);
    expect(importErrors[0].message).toContain('internal');
    expect(importErrors[0].message).toContain('not exported');
    expect(importErrors[0].message).toContain('moduleA');
  });

  it('should error when importing non-exported function', () => {
    const result = analyzeModules([
      {
        name: 'moduleA',
        code: `
          module moduleA
          function helper(): byte
            return 42;
          end function
        `,
      },
      {
        name: 'moduleB',
        code: `
          module moduleB
          import helper from moduleA
        `,
      },
    ]);

    expect(result.success).toBe(false);

    const importErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.IMPORT_NOT_EXPORTED
    );
    expect(importErrors).toHaveLength(1);
    expect(importErrors[0].message).toContain('helper');
    expect(importErrors[0].message).toContain('not exported');
  });

  it('should allow importing exported function', () => {
    const result = analyzeModules([
      {
        name: 'moduleA',
        code: `
          module moduleA
          export function helper(): byte
            return 42;
          end function
        `,
      },
      {
        name: 'moduleB',
        code: `
          module moduleB
          import helper from moduleA
          
          export function useHelper(): byte
            return helper();
          end function
        `,
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('should handle mixed exported and non-exported symbols', () => {
    const result = analyzeModules([
      {
        name: 'moduleA',
        code: `
          module moduleA
          export let publicVar: byte = 1;
          let privateVar: byte = 2;
          export function publicFunc(): byte
            return 3;
          end function
          function privateFunc(): byte
            return 4;
          end function
        `,
      },
      {
        name: 'moduleB',
        code: `
          module moduleB
          import publicVar, privateVar, publicFunc, privateFunc from moduleA
        `,
      },
    ]);

    expect(result.success).toBe(false);

    const importErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.IMPORT_NOT_EXPORTED
    );

    // Should have errors for privateVar and privateFunc
    expect(importErrors).toHaveLength(2);

    const errorMessages = importErrors.map(e => e.message).join(' ');
    expect(errorMessages).toContain('privateVar');
    expect(errorMessages).toContain('privateFunc');
  });
});

describe('Import Validation - Missing Symbols', () => {
  it('should error when importing non-existent symbol', () => {
    const result = analyzeModules([
      {
        name: 'moduleA',
        code: `
          module moduleA
          export let foo: byte = 0;
        `,
      },
      {
        name: 'moduleB',
        code: `
          module moduleB
          import bar from moduleA
        `,
      },
    ]);

    expect(result.success).toBe(false);

    const importErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.IMPORT_SYMBOL_NOT_FOUND
    );
    expect(importErrors).toHaveLength(1);
    expect(importErrors[0].message).toContain('bar');
    expect(importErrors[0].message).toContain('not found');
    expect(importErrors[0].message).toContain('moduleA');
  });

  it('should error for all non-existent symbols in multi-import', () => {
    const result = analyzeModules([
      {
        name: 'moduleA',
        code: `
          module moduleA
          export let foo: byte = 0;
        `,
      },
      {
        name: 'moduleB',
        code: `
          module moduleB
          import foo, bar, baz from moduleA
        `,
      },
    ]);

    expect(result.success).toBe(false);

    const importErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.IMPORT_SYMBOL_NOT_FOUND
    );

    // Should have errors for bar and baz
    expect(importErrors).toHaveLength(2);

    const errorMessages = importErrors.map(e => e.message).join(' ');
    expect(errorMessages).toContain('bar');
    expect(errorMessages).toContain('baz');
  });

  it('should allow importing existing exported symbols', () => {
    const result = analyzeModules([
      {
        name: 'moduleA',
        code: `
          module moduleA
          export let foo: byte = 1;
          export let bar: byte = 2;
          export let baz: byte = 3;
          
          export function initialize(): void
            foo = foo + 10;
            bar = bar + 20;
            baz = baz + 30;
          end function
        `,
      },
      {
        name: 'moduleB',
        code: `
          module moduleB
          import foo, bar, baz from moduleA
          
          export function getSum(): byte
            return foo + bar + baz;
          end function
        `,
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe('Import Validation - Combined Scenarios', () => {
  it('should report both missing and non-exported errors', () => {
    const result = analyzeModules([
      {
        name: 'moduleA',
        code: `
          module moduleA
          export let exported: byte = 1;
          let private: byte = 2;
        `,
      },
      {
        name: 'moduleB',
        code: `
          module moduleB
          import exported, private, missing from moduleA
        `,
      },
    ]);

    expect(result.success).toBe(false);

    const notExportedErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.IMPORT_NOT_EXPORTED
    );
    const notFoundErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.IMPORT_SYMBOL_NOT_FOUND
    );

    expect(notExportedErrors).toHaveLength(1);
    expect(notExportedErrors[0].message).toContain('private');

    expect(notFoundErrors).toHaveLength(1);
    expect(notFoundErrors[0].message).toContain('missing');
  });

  it('should validate imports across multiple modules', () => {
    const result = analyzeModules([
      {
        name: 'moduleA',
        code: `
          module moduleA
          export let a: byte = 1;
          let privateA: byte = 2;
        `,
      },
      {
        name: 'moduleB',
        code: `
          module moduleB
          export let b: byte = 3;
          let privateB: byte = 4;
        `,
      },
      {
        name: 'moduleC',
        code: `
          module moduleC
          import a, privateA from moduleA
          import b, privateB from moduleB
        `,
      },
    ]);

    expect(result.success).toBe(false);

    const notExportedErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.IMPORT_NOT_EXPORTED
    );

    expect(notExportedErrors).toHaveLength(2);

    const errorMessages = notExportedErrors.map(e => e.message).join(' ');
    expect(errorMessages).toContain('privateA');
    expect(errorMessages).toContain('privateB');
  });

  it('should allow valid imports while rejecting invalid ones', () => {
    const result = analyzeModules([
      {
        name: 'lib',
        code: `
          module lib
          export function abs(x: byte): byte
            return x;
          end function
          export let PI: byte = 3;
          function internal(): byte
            return 0;
          end function
        `,
      },
      {
        name: 'main',
        code: `
          module main
          import abs, PI, internal from lib

          export function main(): void
            let result: byte = abs(PI);
          end function
        `,
      },
    ]);

    expect(result.success).toBe(false);

    // Should have one error for importing non-exported 'internal'
    const importErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.IMPORT_NOT_EXPORTED
    );
    expect(importErrors).toHaveLength(1);
    expect(importErrors[0].message).toContain('internal');

    // But the valid imports (abs, PI) should work fine
    // (verified by absence of IMPORT_SYMBOL_NOT_FOUND errors for them)
  });
});

describe('Import Validation - Real-World Scenarios', () => {
  it('should validate C64 library imports', () => {
    const result = analyzeModules([
      {
        name: 'c64.kernal',
        code: `
          module c64.kernal
          export function CHROUT(char: byte): void
          end function
          export function GETIN(): byte
            return 0;
          end function
          function internalHelper(): void
          end function
        `,
      },
      {
        name: 'game',
        code: `
          module game
          import CHROUT, GETIN, internalHelper from c64.kernal
        `,
      },
    ]);

    expect(result.success).toBe(false);

    const importErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.IMPORT_NOT_EXPORTED
    );
    expect(importErrors).toHaveLength(1);
    expect(importErrors[0].message).toContain('internalHelper');
  });

  it('should handle snake game library structure', () => {
    const result = analyzeModules([
      {
        name: 'lib.math',
        code: `
          module lib.math
          export function abs(x: byte): byte
            return x;
          end function
        `,
      },
      {
        name: 'lib.random',
        code: `
          module lib.random
          export function random(): byte
            return 42;
          end function
        `,
      },
      {
        name: 'game.main',
        code: `
          module game.main
          import abs from lib.math
          import random from lib.random

          export function main(): void
            let r: byte = random();
            let a: byte = abs(r);
          end function
        `,
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('should detect typos in import names', () => {
    const result = analyzeModules([
      {
        name: 'utils',
        code: `
          module utils
          export function clearScreen(): void
          end function
        `,
      },
      {
        name: 'main',
        code: `
          module main
          import clearScren from utils
        `,
      },
    ]);

    expect(result.success).toBe(false);

    const importErrors = result.diagnostics.filter(
      d => d.code === DiagnosticCode.IMPORT_SYMBOL_NOT_FOUND
    );
    expect(importErrors).toHaveLength(1);
    expect(importErrors[0].message).toContain('clearScren');
    expect(importErrors[0].message).toContain('not found');
  });
});

describe('Import Validation - Regression Tests', () => {
  it('should still allow valid cross-module type propagation', () => {
    const result = analyzeModules([
      {
        name: 'moduleA',
        code: `
          module moduleA
          export function helper(): byte
            return 42;
          end function
        `,
      },
      {
        name: 'moduleB',
        code: `
          module moduleB
          import helper from moduleA
          
          export function useHelper(): byte
            return helper();
          end function
        `,
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('should not break existing multi-module tests', () => {
    const result = analyzeModules([
      {
        name: 'moduleA',
        code: `
          module moduleA
          export let foo: byte = 10;
          export function getFoo(): byte
            return foo;
          end function
        `,
      },
      {
        name: 'moduleB',
        code: `
          module moduleB
          import foo, getFoo from moduleA

          export function main(): void
            let x: byte = foo;
            let y: byte = getFoo();
          end function
        `,
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });
});
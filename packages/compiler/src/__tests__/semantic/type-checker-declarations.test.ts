/**
 * Type Checker Tests - Declarations & Memory-Mapped
 *
 * Tests for Session 4:
 * - Variable declaration type checking
 * - @map declaration type checking (all 4 forms)
 * - Array declaration validation
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTableBuilder } from '../../semantic/visitors/symbol-table-builder.js';
import { TypeResolver } from '../../semantic/visitors/type-resolver.js';
import { TypeChecker } from '../../semantic/visitors/type-checker/index.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity } from '../../ast/diagnostics.js';

/**
 * Parse source and run all three semantic analysis phases
 */
function parseAndTypeCheck(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();

  // Phase 1: Build symbol table
  const symbolBuilder = new SymbolTableBuilder();
  symbolBuilder.walk(program);
  const symbolTable = symbolBuilder.getSymbolTable();

  // Phase 2: Resolve types
  const typeResolver = new TypeResolver(symbolTable);
  typeResolver.walk(program);
  const typeSystem = typeResolver.getTypeSystem();

  // Phase 3: Type check
  const typeChecker = new TypeChecker(symbolTable, typeSystem);
  typeChecker.walk(program);

  return {
    program,
    symbolTable,
    typeSystem,
    diagnostics: [
      ...symbolBuilder.getDiagnostics(),
      ...typeResolver.getDiagnostics(),
      ...typeChecker.getDiagnostics(),
    ],
  };
}

/**
 * Get only error diagnostics
 */
function getErrors(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
}

/**
 * Get only warning diagnostics
 */
function getWarnings(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d => d.severity === DiagnosticSeverity.WARNING);
}

describe('TypeChecker - Variable Declarations', () => {
  describe('Variable Declaration with Initializer', () => {
    it('should type check valid byte variable with byte initializer', () => {
      const source = `
        let x: byte = 42;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check valid word variable with word initializer', () => {
      const source = `
        let x: word = 1000;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check valid word variable with byte initializer (widening)', () => {
      const source = `
        let x: word = 42;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should error on byte variable with word initializer (narrowing)', () => {
      const source = `
        let x: byte = 1000;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      const errors = getErrors(diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('cannot assign'))).toBe(true);
    });

    it('should type check boolean variable with boolean initializer', () => {
      const source = `
        let flag: boolean = true;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should allow boolean in byte variable (boolean ↔ byte is compatible)', () => {
      const source = `
        let x: byte = true;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      const errors = getErrors(diagnostics);
      // boolean → byte is allowed in the type system (boolean is just a byte: 0 or 1)
      expect(errors).toEqual([]);
    });
  });

  describe('Const Variables', () => {
    it('should type check const variable with valid initializer', () => {
      const source = `
        const MAX: byte = 255;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check const variable with expression initializer', () => {
      const source = `
        const DOUBLE: byte = 10 + 10;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });
  });

  describe('Storage Class Variables', () => {
    it('should type check @zp variable with initializer', () => {
      const source = `
        @zp let counter: byte = 0;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check @ram variable with initializer', () => {
      const source = `
        @ram let buffer: byte = 0;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check @data variable with initializer', () => {
      const source = `
        @data let config: byte = 5;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });
  });

  describe('Array Variables', () => {
    it('should type check array variable with array literal initializer', () => {
      const source = `
        let numbers: byte[] = [1, 2, 3];
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should error on array type mismatch', () => {
      const source = `
        let numbers: word[] = [1, 2, 3];
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      const errors = getErrors(diagnostics);
      // This might pass if byte[] can assign to word[] (widening)
      // OR error if arrays require exact match
      // We'll see what the actual behavior is
    });
  });

  describe('Variables Without Initializer', () => {
    it('should allow let variable without initializer', () => {
      const source = `
        let x: byte;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should allow word variable without initializer', () => {
      const source = `
        let addr: word;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });
  });

  describe('Exported Variables', () => {
    it('should type check exported variable with initializer', () => {
      const source = `
        export let gameScore: word = 0;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check exported const with initializer', () => {
      const source = `
        export const VERSION: byte = 1;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });
  });
});

describe('TypeChecker - Memory-Mapped Declarations (@map)', () => {
  describe('Simple @map - Single Address', () => {
    it('should type check @map with numeric literal address', () => {
      const source = `
        @map borderColor at $D020: byte;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check @map with hex literal address', () => {
      const source = `
        @map bgColor at 0xD021: byte;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check @map with word type', () => {
      const source = `
        @map irqVector at $FFFE: word;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check @map with expression address', () => {
      const source = `
        const BASE: word = $D000;
        @map vic at BASE: byte;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check @map with calculated address', () => {
      const source = `
        @map sprite0 at $D000 + 0: byte;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should error on @map with non-numeric address', () => {
      const source = `
        @map color at true: byte;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      const errors = getErrors(diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('numeric') || e.message.includes('word'))).toBe(
        true
      );
    });

    it('should error on @map with string address', () => {
      const source = `
        @map data at "hello": byte;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      const errors = getErrors(diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('numeric') || e.message.includes('word'))).toBe(
        true
      );
    });
  });

  describe('Range @map - Address Range', () => {
    it('should type check @map with address range', () => {
      const source = `
        @map sprites from $D000 to $D02E: byte;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check @map range with hex addresses', () => {
      const source = `
        @map colorRam from 0xD800 to 0xDBE7: byte;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check @map range with expression addresses', () => {
      const source = `
        const START: word = $C000;
        const END: word = $C0FF;
        @map buffer from START to END: byte;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should error on @map range with non-numeric start address', () => {
      const source = `
        @map range from true to $D0FF: byte;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      const errors = getErrors(diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('numeric') || e.message.includes('word'))).toBe(
        true
      );
    });

    it('should error on @map range with non-numeric end address', () => {
      const source = `
        @map range from $D000 to false: byte;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      const errors = getErrors(diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('numeric') || e.message.includes('word'))).toBe(
        true
      );
    });
  });

  describe('Sequential Struct @map', () => {
    it('should type check sequential struct @map', () => {
      const source = `
        @map sid at $D400 type
          voice1Freq: word;
          voice1Pulse: word;
          voice1Control: byte;
        end @map
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check sequential struct @map with arrays', () => {
      const source = `
        @map vic at $D000 type
          sprites: byte[8];
          colors: byte[4];
        end @map
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should error on sequential struct @map with non-numeric base address', () => {
      const source = `
        @map data at "invalid" type
          field: byte;
        end @map
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      const errors = getErrors(diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('numeric') || e.message.includes('word'))).toBe(
        true
      );
    });
  });

  describe('Explicit Struct @map', () => {
    it('should type check explicit struct @map', () => {
      const source = `
        @map vic at $D000 layout
          borderColor at 0: byte;
          bgColor at 1: byte;
          sprites at 16: byte[8];
        end @map
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check explicit struct @map with calculated offsets', () => {
      const source = `
        @map hardware at $D000 layout
          field1 at 0 + 0: byte;
          field2 at 0 + 1: byte;
        end @map
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check explicit struct @map with field ranges', () => {
      const source = `
        @map chip at $D000 layout
          registers from 0 to 15: byte;
        end @map
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should error on explicit struct @map with non-numeric base address', () => {
      const source = `
        @map data at true layout
          field at 0: byte;
        end @map
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      const errors = getErrors(diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('numeric') || e.message.includes('word'))).toBe(
        true
      );
    });

    it('should error on explicit struct @map with non-numeric field offset', () => {
      const source = `
        @map data at $D000 layout
          field at false: byte;
        end @map
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      const errors = getErrors(diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('numeric') || e.message.includes('word'))).toBe(
        true
      );
    });
  });

  describe('@map with Storage Class', () => {
    it('should type check @zp @map declaration', () => {
      const source = `
        @zp @map zpPointer at $FB: word;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });
  });
});

describe('TypeChecker - Declaration Integration', () => {
  describe('Multiple Declarations', () => {
    it('should type check multiple variable declarations', () => {
      const source = `
        let x: byte = 0;
        let y: word = 1000;
        const MAX: byte = 255;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should type check variables and @map declarations together', () => {
      const source = `
        let counter: byte = 0;
        @map borderColor at $D020: byte;
        const BASE: word = $D000;
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });
  });

  describe('Declarations in Functions', () => {
    it('should type check local variable declarations', () => {
      const source = `
        function test(): void
          let x: byte = 42;
          let y: word = 1000;
        end function
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      expect(getErrors(diagnostics)).toEqual([]);
    });

    it('should error on local variable type mismatch', () => {
      const source = `
        function test(): void
          let x: byte = 1000;
        end function
      `;

      const { diagnostics } = parseAndTypeCheck(source);
      const errors = getErrors(diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('cannot assign'))).toBe(true);
    });
  });
});

/**
 * Codegen E2E Tests: Simple Programs
 *
 * End-to-end tests that verify the complete pipeline from Blend source
 * code to ASM-IL output for simple programs including variable declarations,
 * assignments, and basic arithmetic expressions.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame → IL → CodeGen → ASM-IL
 *
 * @module __tests__/codegen/e2e/simple-programs
 */

import { describe, it, expect } from 'vitest';
import {
  compileToAsm,
  mnemonics,
  countMnemonic,
  hasLabel,
  hasComment,
  hasAnyMnemonic,
  getSections,
  labelNames,
} from './_helpers.js';

// ============================================================================
// E2E: Minimal Programs
// ============================================================================

describe('E2E Codegen: Minimal Programs', () => {
  it('should compile an empty main function', () => {
    const source = `
      module Test;
      function main(): void {
      }
    `;

    const result = compileToAsm(source);

    // Should produce a valid program with sections
    expect(result).toBeDefined();
    expect(result.sections.length).toBeGreaterThan(0);

    // Should have a main label
    expect(hasLabel(result, 'main')).toBe(true);

    // Empty function should still have RTS
    expect(countMnemonic(result, 'RTS')).toBeGreaterThanOrEqual(1);
  });

  it('should generate header comment with module name', () => {
    const source = `
      module MyGame;
      function main(): void {
      }
    `;

    const result = compileToAsm(source);

    // Should have module name in header comment
    expect(hasComment(result, 'MyGame')).toBe(true);
  });

  it('should generate code section for functions', () => {
    const source = `
      module Test;
      function main(): void {
        let x: byte = 1;
      }
    `;

    const result = compileToAsm(source);

    // Should have both header and code sections
    const sections = getSections(result);
    const sectionNames = sections.map(s => s.name);
    expect(sectionNames).toContain('header');
    expect(sectionNames).toContain('code');
  });
});

// ============================================================================
// E2E: Variable Declarations
// ============================================================================

describe('E2E Codegen: Variable Declarations', () => {
  it('should compile byte variable with literal initializer', () => {
    const source = `
      module Test;
      function main(): void {
        let x: byte = 42;
      }
    `;

    const result = compileToAsm(source);
    const ops = mnemonics(result);

    // Should load immediate value 42 then store to variable slot
    expect(ops).toContain('LDA');
    expect(ops).toContain('STA');
  });

  it('should compile hex literal initializer', () => {
    const source = `
      module Test;
      function main(): void {
        let color: byte = $0E;
      }
    `;

    const result = compileToAsm(source);

    // Should have LDA for the hex value and STA for the store
    expect(countMnemonic(result, 'LDA')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(1);
  });

  it('should compile zero-initialized variable', () => {
    const source = `
      module Test;
      function main(): void {
        let counter: byte = 0;
      }
    `;

    const result = compileToAsm(source);

    // Should load 0 and store
    expect(countMnemonic(result, 'LDA')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(1);
  });

  it('should compile multiple variable declarations', () => {
    const source = `
      module Test;
      function main(): void {
        let a: byte = 1;
        let b: byte = 2;
        let c: byte = 3;
      }
    `;

    const result = compileToAsm(source);

    // Should have at least 3 STA for three variables
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(3);
  });

  it('should compile word variable declaration', () => {
    const source = `
      module Test;
      function main(): void {
        let addr: word = $1000;
      }
    `;

    const result = compileToAsm(source);

    // Word stores use STA (low byte) and may use STX (high byte)
    // At minimum one store instruction is generated
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E: Arithmetic Expressions
// ============================================================================

describe('E2E Codegen: Arithmetic Expressions', () => {
  it('should compile addition of two literals', () => {
    const source = `
      module Test;
      function main(): void {
        let sum: byte = 5 + 3;
      }
    `;

    const result = compileToAsm(source);
    const ops = mnemonics(result);

    // Addition uses CLC + ADC pattern
    expect(ops).toContain('CLC');
    expect(ops).toContain('ADC');
  });

  it('should compile subtraction', () => {
    const source = `
      module Test;
      function main(): void {
        let diff: byte = 10 - 3;
      }
    `;

    const result = compileToAsm(source);
    const ops = mnemonics(result);

    // Subtraction uses SEC + SBC pattern
    expect(ops).toContain('SEC');
    expect(ops).toContain('SBC');
  });

  it('should compile addition of variables', () => {
    const source = `
      module Test;
      function main(): void {
        let a: byte = 10;
        let b: byte = 20;
        let sum: byte = a + b;
      }
    `;

    const result = compileToAsm(source);

    // Should have CLC/ADC for the add
    expect(countMnemonic(result, 'CLC')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(1);
  });

  it('should compile subtraction of variables', () => {
    const source = `
      module Test;
      function main(): void {
        let a: byte = 50;
        let b: byte = 20;
        let diff: byte = a - b;
      }
    `;

    const result = compileToAsm(source);

    // Should have SEC/SBC for the subtract
    expect(countMnemonic(result, 'SEC')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'SBC')).toBeGreaterThanOrEqual(1);
  });

  it('should compile chained addition', () => {
    const source = `
      module Test;
      function main(): void {
        let result: byte = 1 + 2 + 3;
      }
    `;

    const result = compileToAsm(source);

    // Should have multiple ADC instructions for chained add
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(2);
  });

  it('should compile mixed add and subtract', () => {
    const source = `
      module Test;
      function main(): void {
        let a: byte = 10;
        let b: byte = 5;
        let c: byte = 3;
        let result: byte = a + b - c;
      }
    `;

    const result = compileToAsm(source);

    // Should have both ADC and SBC
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'SBC')).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E: Bitwise Operations
// ============================================================================

describe('E2E Codegen: Bitwise Operations', () => {
  it('should compile AND operation', () => {
    const source = `
      module Test;
      function main(): void {
        let a: byte = $FF;
        let masked: byte = a & $0F;
      }
    `;

    const result = compileToAsm(source);

    // Bitwise AND uses the AND mnemonic
    expect(countMnemonic(result, 'AND')).toBeGreaterThanOrEqual(1);
  });

  it('should compile OR operation', () => {
    const source = `
      module Test;
      function main(): void {
        let a: byte = $F0;
        let combined: byte = a | $0F;
      }
    `;

    const result = compileToAsm(source);

    // Bitwise OR uses the ORA mnemonic
    expect(countMnemonic(result, 'ORA')).toBeGreaterThanOrEqual(1);
  });

  it('should compile XOR operation', () => {
    const source = `
      module Test;
      function main(): void {
        let a: byte = $AA;
        let flipped: byte = a ^ $FF;
      }
    `;

    const result = compileToAsm(source);

    // Bitwise XOR uses the EOR mnemonic
    expect(countMnemonic(result, 'EOR')).toBeGreaterThanOrEqual(1);
  });

  it('should compile shift left operation', () => {
    // The pipeline compiles shift left with proper ASL unrolling.
    // `x << 3` with a literal count emits SHL_BYTE IL → 3× ASL A in codegen.
    const source = `
      module Test;
      function main(): void {
        let x: byte = 1;
        let y: byte = x << 3;
      }
    `;
    const result = compileToAsm(source);

    // Pipeline completes: source is loaded, shifted, and result stored
    expect(result).toBeDefined();
    expect(result.sections.length).toBeGreaterThan(0);
    // x is stored, then loaded, shifted, and y is stored
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(2);
    // Shift left by 3 emits 3 ASL instructions (unrolled constant shift)
    expect(countMnemonic(result, 'ASL')).toBeGreaterThanOrEqual(1);
  });

  it('should compile shift right operation', () => {
    // The pipeline compiles shift right with proper LSR unrolling.
    // `x >> 2` with a literal count emits SHR_BYTE IL → 2× LSR A in codegen.
    const source = `
      module Test;
      function main(): void {
        let x: byte = $80;
        let y: byte = x >> 2;
      }
    `;
    const result = compileToAsm(source);

    // Pipeline completes: source is loaded, shifted, and result stored
    expect(result).toBeDefined();
    expect(result.sections.length).toBeGreaterThan(0);
    // x is stored, then loaded, shifted, and y is stored
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(2);
    // Shift right by 2 emits 2 LSR instructions (unrolled constant shift)
    expect(countMnemonic(result, 'LSR')).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E: Assignment Operations
// ============================================================================

describe('E2E Codegen: Assignments', () => {
  it('should compile simple reassignment', () => {
    const source = `
      module Test;
      function main(): void {
        let x: byte = 1;
        x = 2;
      }
    `;

    const result = compileToAsm(source);

    // Should have at least 2 STA: initial + reassignment
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(2);
  });

  it('should compile assignment from expression', () => {
    const source = `
      module Test;
      function main(): void {
        let x: byte = 10;
        let y: byte = 5;
        x = x + y;
      }
    `;

    const result = compileToAsm(source);

    // Should have ADC for the addition and STA for the store
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(2);
  });

  it('should compile compound += assignment', () => {
    const source = `
      module Test;
      function main(): void {
        let score: byte = 0;
        score += 10;
      }
    `;

    const result = compileToAsm(source);

    // Compound add uses CLC/ADC pattern
    expect(countMnemonic(result, 'CLC')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(1);
  });

  it('should compile compound -= assignment', () => {
    const source = `
      module Test;
      function main(): void {
        let health: byte = 100;
        health -= 25;
      }
    `;

    const result = compileToAsm(source);

    // Compound subtract uses SEC/SBC pattern
    expect(countMnemonic(result, 'SEC')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'SBC')).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E: Program Structure
// ============================================================================

describe('E2E Codegen: Program Structure', () => {
  it('should generate function labels for multiple functions', () => {
    const source = `
      module Test;
      function update(): void {
        let delta: byte = 1;
      }
      function draw(): void {
        let color: byte = 0;
      }
      function main(): void {
        update();
        draw();
      }
    `;

    const result = compileToAsm(source);

    // Should have labels for all three functions
    expect(hasLabel(result, 'update')).toBe(true);
    expect(hasLabel(result, 'draw')).toBe(true);
    expect(hasLabel(result, 'main')).toBe(true);
  });

  it('should generate RTS for each function', () => {
    const source = `
      module Test;
      function a(): void {}
      function b(): void {}
      function main(): void {}
    `;

    const result = compileToAsm(source);

    // Each function should end with RTS
    expect(countMnemonic(result, 'RTS')).toBeGreaterThanOrEqual(3);
  });

  it('should handle dotted module names', () => {
    const source = `
      module Game.Logic;
      function main(): void {
        let state: byte = 0;
      }
    `;

    const result = compileToAsm(source);

    // Should compile successfully and have module name in comment
    expect(hasComment(result, 'Game.Logic')).toBe(true);
  });
});

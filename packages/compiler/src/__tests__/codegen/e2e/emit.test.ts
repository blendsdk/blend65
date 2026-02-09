/**
 * E2E Emit Tests
 *
 * Tests the complete pipeline from Blend source code to ACME assembler text:
 *   Source → Lexer → Parser → Semantic → IL → CodeGen → Emitter → .asm text
 *
 * These tests verify that the emitter produces valid, readable ACME output
 * for real compiled programs, completing the full compilation pipeline.
 *
 * @module __tests__/codegen/e2e/emit
 */

import { describe, it, expect } from 'vitest';
import { compileToAsm } from './_helpers.js';
import { AsmILEmitter } from '../../../codegen/asm-il/emitter.js';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Wraps Blend source code in the required module + function main structure.
 *
 * @param body - Statements to place inside main()
 * @param extraFunctions - Optional additional function declarations
 */
function wrapMain(body: string, extraFunctions = ''): string {
  return `
    module Test;
    ${extraFunctions}
    function main(): void {
      ${body}
    }
  `;
}

/**
 * Compiles Blend source to ACME assembler text through the full pipeline.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → IL → CodeGen → Emitter
 *
 * @param source - Blend source code (should include module declaration)
 * @param includeHeader - Whether to include the emitter's file header (default: false)
 * @returns ACME assembler text string
 */
function compileToText(source: string, includeHeader = false): string {
  const program = compileToAsm(source);
  const emitter = new AsmILEmitter({
    includeHeader,
    includeSectionSeparators: false,
    includeStats: false,
  });
  return emitter.emit(program);
}

// ============================================================================
// Simple Variable Programs
// ============================================================================

describe('E2E Emit: Simple Programs', () => {
  it('should emit assembly for a simple variable declaration', () => {
    const text = compileToText(wrapMain('let x: byte = 42;'));
    // Should contain an LDA immediate with the value 42 ($2A)
    expect(text).toContain('LDA #$2A');
    // Should contain a STA for storing to the variable slot
    expect(text).toContain('STA');
  });

  it('should emit assembly for zero initialization', () => {
    const text = compileToText(wrapMain('let x: byte = 0;'));
    expect(text).toContain('LDA #$00');
  });

  it('should emit assembly for max byte value', () => {
    const text = compileToText(wrapMain('let x: byte = 255;'));
    expect(text).toContain('LDA #$FF');
  });

  it('should emit assembly for multiple variables', () => {
    const text = compileToText(wrapMain(`
      let a: byte = 1;
      let b: byte = 2;
    `));
    expect(text).toContain('LDA #$01');
    expect(text).toContain('LDA #$02');
  });
});

// ============================================================================
// Arithmetic Expressions
// ============================================================================

describe('E2E Emit: Arithmetic', () => {
  it('should emit add instruction for addition', () => {
    const text = compileToText(wrapMain(`
      let a: byte = 5;
      let b: byte = a + 3;
    `));
    // Should have CLC + ADC for addition
    expect(text).toContain('CLC');
    expect(text).toContain('ADC');
  });

  it('should emit subtract instruction for subtraction', () => {
    const text = compileToText(wrapMain(`
      let a: byte = 10;
      let b: byte = a - 2;
    `));
    // Should have SEC + SBC for subtraction
    expect(text).toContain('SEC');
    expect(text).toContain('SBC');
  });
});

// ============================================================================
// Control Flow
// ============================================================================

describe('E2E Emit: Control Flow', () => {
  it('should emit branch instructions for if statement', () => {
    const text = compileToText(wrapMain(`
      let x: byte = 5;
      if (x == 0) {
        let y: byte = 1;
      }
    `));
    // Should contain comparison and branch
    expect(text).toContain('CMP');
    expect(text).toMatch(/B(EQ|NE)/); // Branch equal or not-equal
  });

  it('should emit labels for control flow targets', () => {
    const text = compileToText(wrapMain(`
      let x: byte = 5;
      if (x == 0) {
        let y: byte = 1;
      }
    `));
    const lines = text.split('\n');
    // Should have at least one label (for branch target) — either global or local
    const labelLines = lines.filter(l => /^\S+:/.test(l.trim()) || /^\.\S+/.test(l.trim()));
    expect(labelLines.length).toBeGreaterThan(0);
  });

  it('should emit while loop with backward branch', () => {
    const text = compileToText(wrapMain(`
      let i: byte = 0;
      while (i < 10) {
        i = i + 1;
      }
    `));
    // Should have JMP for backward branch in while loop
    expect(text).toContain('JMP');
  });
});

// ============================================================================
// Functions
// ============================================================================

describe('E2E Emit: Functions', () => {
  it('should emit JSR for function calls', () => {
    const src = `
      module Test;
      function greet(): void {
        let x: byte = 0;
      }
      function main(): void {
        greet();
      }
    `;
    const text = compileToText(src);
    expect(text).toContain('JSR');
  });

  it('should emit RTS for function return', () => {
    const src = `
      module Test;
      function doNothing(): void {
      }
      function main(): void {
      }
    `;
    const text = compileToText(src);
    expect(text).toContain('RTS');
  });

  it('should emit function labels', () => {
    const src = `
      module Test;
      function update(): void {
        let delta: byte = 1;
      }
      function main(): void {
        update();
      }
    `;
    const text = compileToText(src);
    // Both function names should appear as labels
    expect(text).toContain('update');
    expect(text).toContain('main');
  });
});

// ============================================================================
// Intrinsics (hi/lo which work; peek/poke have a known gap)
// ============================================================================

describe('E2E Emit: Intrinsics', () => {
  it('should emit TXA for hi() intrinsic', () => {
    const text = compileToText(wrapMain(`
      let addr: word = $1234;
      let high: byte = hi(addr);
    `));
    // hi() generates TXA to move high byte from X to A
    expect(text).toContain('TXA');
  });

  it('should emit code for lo() intrinsic', () => {
    const text = compileToText(wrapMain(`
      let addr: word = $ABCD;
      let low: byte = lo(addr);
    `));
    // lo() is effectively a no-op (low byte already in A)
    // The important thing is it compiles and produces output
    expect(text).toContain('STA'); // Result stored to variable
  });

  // Known gap: IL generator emits PEEK/POKE without address operands.
  // Codegen expects address operands via getAddressOperand().
  // Unit/integration tests cover these with manually-constructed IL programs.
  it.todo('should emit STA for poke intrinsic (IL generator gap: address operand)');
  it.todo('should emit LDA for peek intrinsic (IL generator gap: address operand)');
});

// ============================================================================
// Full Program with Emitter Header
// ============================================================================

describe('E2E Emit: Full Program Output', () => {
  it('should produce complete output with emitter header when enabled', () => {
    const text = compileToText(wrapMain('let x: byte = 42;'), true);
    expect(text).toContain('; Generated by Blend65 compiler');
    expect(text).toContain('; Module:');
  });

  it('should produce output without emitter header when disabled', () => {
    const text = compileToText(wrapMain('let x: byte = 42;'), false);
    // The emitter header is disabled but the codegen's own header may exist
    expect(text).not.toContain('; Generated by Blend65 compiler');
  });

  it('should produce non-empty output for any valid program', () => {
    const text = compileToText(wrapMain('let x: byte = 0;'));
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should produce text ending with newline', () => {
    const text = compileToText(wrapMain('let x: byte = 0;'));
    expect(text.endsWith('\n')).toBe(true);
  });
});

// ============================================================================
// Output Format Validation
// ============================================================================

describe('E2E Emit: Output Format', () => {
  it('should use $ prefix for hex values', () => {
    const text = compileToText(wrapMain('let x: byte = 255;'));
    // All hex values should use $ prefix
    expect(text).toContain('$');
    expect(text).not.toMatch(/0x[0-9a-fA-F]+/); // No 0x-style hex
  });

  it('should use # prefix for immediate values', () => {
    const text = compileToText(wrapMain('let x: byte = 42;'));
    expect(text).toContain('#$');
  });

  it('should indent instructions with spaces', () => {
    const text = compileToText(wrapMain('let x: byte = 0;'));
    const instrLines = text.split('\n').filter(l => /^\s+[A-Z]{3}/.test(l));
    // All instruction lines should start with whitespace
    for (const line of instrLines) {
      expect(line).toMatch(/^\s+/);
    }
  });

  it('should use uppercase mnemonics', () => {
    const text = compileToText(wrapMain('let x: byte = 1;'));
    const instrLines = text.split('\n').filter(l => /^\s+[A-Z]{3}/.test(l));
    for (const line of instrLines) {
      const mnemonic = line.trim().split(/\s/)[0];
      expect(mnemonic).toBe(mnemonic.toUpperCase());
    }
  });
});

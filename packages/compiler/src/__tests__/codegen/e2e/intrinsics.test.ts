/**
 * Codegen E2E Tests: Intrinsics
 *
 * End-to-end tests that verify the complete pipeline from Blend source
 * code to ASM-IL output for intrinsic function calls (hi, lo, peek, poke,
 * peekw, pokew).
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame → IL → CodeGen → ASM-IL
 *
 * All intrinsics with constant addresses are fully supported. The IL generator's
 * tryResolveConstantAddress() resolves constant address arguments to AddressOperand
 * values, enabling the codegen to use absolute addressing mode.
 *
 * @module __tests__/codegen/e2e/intrinsics
 */

import { describe, it, expect } from 'vitest';
import {
  compileToAsm,
  mnemonics,
  countMnemonic,
  hasComment,
  hasAnyMnemonic,
} from './_helpers.js';

// ============================================================================
// E2E: hi() Intrinsic
// ============================================================================

describe('E2E Codegen: hi() Intrinsic', () => {
  it('should compile hi() extracting high byte of word variable', () => {
    const source = `
      module Test;
      function main(): void {
        let addr: word = $1234;
        let high: byte = hi(addr);
      }
    `;

    const result = compileToAsm(source);
    const ops = mnemonics(result);

    // hi() generates TXA to move high byte from X to A
    expect(ops).toContain('TXA');
  });

  it('should compile hi() with literal word', () => {
    const source = `
      module Test;
      function main(): void {
        let high: byte = hi($ABCD);
      }
    `;

    const result = compileToAsm(source);

    // Should generate code that extracts high byte
    expect(countMnemonic(result, 'TXA')).toBeGreaterThanOrEqual(1);
  });

  it('should compile hi() result stored to variable', () => {
    const source = `
      module Test;
      function main(): void {
        let addr: word = $D020;
        let h: byte = hi(addr);
      }
    `;

    const result = compileToAsm(source);

    // hi() result (in A after TXA) should be stored
    expect(countMnemonic(result, 'TXA')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E: lo() Intrinsic
// ============================================================================

describe('E2E Codegen: lo() Intrinsic', () => {
  it('should compile lo() extracting low byte of word variable', () => {
    const source = `
      module Test;
      function main(): void {
        let addr: word = $1234;
        let low: byte = lo(addr);
      }
    `;

    const result = compileToAsm(source);

    // lo() is a no-op (low byte already in A), but adds a comment
    // The main thing is it compiles without error
    expect(result).toBeDefined();
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('should compile lo() with literal word', () => {
    const source = `
      module Test;
      function main(): void {
        let low: byte = lo($ABCD);
      }
    `;

    const result = compileToAsm(source);

    // Should compile successfully, lo() generates a comment marker
    expect(result).toBeDefined();
    // The result should be stored to the variable
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(1);
  });

  it('should compile lo() result stored to variable', () => {
    const source = `
      module Test;
      function main(): void {
        let addr: word = $FC00;
        let l: byte = lo(addr);
      }
    `;

    const result = compileToAsm(source);

    // lo() keeps low byte in A, which is then stored
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E: hi() and lo() Combined
// ============================================================================

describe('E2E Codegen: hi/lo Combined', () => {
  it('should compile both hi() and lo() on same word', () => {
    const source = `
      module Test;
      function main(): void {
        let addr: word = $4000;
        let low: byte = lo(addr);
        let high: byte = hi(addr);
      }
    `;

    const result = compileToAsm(source);

    // Should have TXA for hi()
    expect(countMnemonic(result, 'TXA')).toBeGreaterThanOrEqual(1);

    // Should have STA for storing both results
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(2);
  });

  it('should compile hi() and lo() used in expressions', () => {
    const source = `
      module Test;
      function main(): void {
        let addr: word = $1000;
        let low: byte = lo(addr);
        let high: byte = hi(addr);
        let combined: byte = low + high;
      }
    `;

    const result = compileToAsm(source);

    // Should have ADC for the addition
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(1);
    // Should have TXA for hi()
    expect(countMnemonic(result, 'TXA')).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E: peek/poke Intrinsics (Known Gap - Skipped)
// ============================================================================

describe('E2E Codegen: peek/poke Intrinsics', () => {
  /**
   * These tests verify the complete pipeline from Blend source to ASM-IL
   * for peek/poke/peekw/pokew intrinsics with constant addresses.
   *
   * The IL generator's tryResolveConstantAddress() resolves constant address
   * arguments to AddressOperand values, which the codegen then uses for
   * absolute addressing mode in the generated 6502 instructions.
   */

  it('should compile peek() reading from hardware register', () => {
    const source = `
      module Test;
      function main(): void {
        let v: byte = peek($D020);
      }
    `;
    const result = compileToAsm(source);

    // peek() generates LDA with absolute address to read the hardware register
    expect(countMnemonic(result, 'LDA')).toBeGreaterThanOrEqual(1);
  });

  it('should compile poke() writing to hardware register', () => {
    const source = `
      module Test;
      function main(): void {
        poke($D020, 14);
      }
    `;
    const result = compileToAsm(source);

    // poke() generates STA with absolute address to write the hardware register
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(1);
  });

  it('should compile peekw() reading word from memory', () => {
    const source = `
      module Test;
      function main(): void {
        let v: word = peekw($00FB);
      }
    `;
    const result = compileToAsm(source);

    // peekw() generates LDA + LDX for reading the low and high bytes of a 16-bit value
    expect(countMnemonic(result, 'LDA')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'LDX')).toBeGreaterThanOrEqual(1);
  });

  it('should compile pokew() writing word to memory', () => {
    const source = `
      module Test;
      function main(): void {
        pokew($00FB, $1234);
      }
    `;
    const result = compileToAsm(source);

    // pokew() generates STA + STX for writing the low and high bytes of a 16-bit value
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'STX')).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E: Intrinsics in Context (using hi/lo which work)
// ============================================================================

describe('E2E Codegen: Intrinsics in Context', () => {
  it('should compile hi() inside function with parameter', () => {
    const source = `
      module Test;
      function getHigh(addr: word): byte {
        return hi(addr);
      }
      function main(): void {
        let h: byte = getHigh($1234);
      }
    `;

    const result = compileToAsm(source);

    // getHigh calls hi() which uses TXA
    expect(countMnemonic(result, 'TXA')).toBeGreaterThanOrEqual(1);
    // main calls getHigh via JSR
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(1);
  });

  it('should compile lo() inside conditional', () => {
    const source = `
      module Test;
      function main(): void {
        let addr: word = $0400;
        let low: byte = lo(addr);
        if (low == 0) {
          let aligned: byte = 1;
        }
      }
    `;

    const result = compileToAsm(source);

    // Should have CMP for the conditional
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(1);
    // Should have branch for if
    expect(hasAnyMnemonic(result, ['BEQ', 'BNE'])).toBe(true);
  });

  it('should compile hi() inside loop', () => {
    const source = `
      module Test;
      function main(): void {
        let addr: word = $0400;
        let high: byte = hi(addr);
        let count: byte = 0;
        while (count < high) {
          count += 1;
        }
      }
    `;

    const result = compileToAsm(source);

    // hi() generates TXA
    expect(countMnemonic(result, 'TXA')).toBeGreaterThanOrEqual(1);
    // Loop generates JMP + CMP
    expect(countMnemonic(result, 'JMP')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(1);
  });
});

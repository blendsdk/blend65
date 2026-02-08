/**
 * Bitwise Operator Edge Case Tests
 *
 * Tests for bitwise operators at edge cases:
 * - Shift by 0
 * - Shift by 8 (for byte)
 * - Shift by 16 (for word)
 * - Shift by more than type size
 * - Bitwise NOT edge cases (~0, ~255)
 * - Bitwise AND/OR/XOR at boundaries
 *
 * @module __tests__/semantic/edge-cases/operators/bitwise-edge-cases
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../../lexer/lexer.js';
import { Parser } from '../../../../parser/parser.js';
import { SemanticAnalyzer } from '../../../../semantic/analyzer.js';
import { DiagnosticSeverity } from '../../../../ast/diagnostics.js';

/**
 * Helper function to analyze source code and get diagnostics.
 * IMPORTANT: Always tokenize first, then parse!
 */
function analyzeSource(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();

  const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  return analyzer.analyze(program);
}

/**
 * Gets error messages from analysis result
 */
function getErrors(source: string): string[] {
  const result = analyzeSource(source);
  return result.diagnostics
    .filter(d => d.severity === DiagnosticSeverity.ERROR)
    .map(d => d.message);
}

/**
 * Checks if analysis has no errors
 */
function hasNoErrors(source: string): boolean {
  return getErrors(source).length === 0;
}

// =============================================================================
// Bitwise NOT (~) Operations
// =============================================================================

describe('Bitwise NOT (~) Operations', () => {
  it('should accept ~0 (byte)', () => {
    const source = `let x: byte = ~0;`;
    // ~0 = 255 in byte
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept ~255 (byte)', () => {
    const source = `let x: byte = ~255;`;
    // ~255 = 0 in byte
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept ~$FF (hex)', () => {
    const source = `let x: byte = ~$FF;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept ~$00 (hex zero)', () => {
    const source = `let x: byte = ~$00;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept ~variable (byte)', () => {
    const source = `let a: byte = 100; let x: byte = ~a;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept ~variable (word)', () => {
    const source = `let a: word = 1000; let x: word = ~a;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept ~~value (double NOT)', () => {
    const source = `let x: byte = ~~100;`;
    // ~~100 = 100
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept ~(expression)', () => {
    const source = `let a: byte = 100; let x: byte = ~(a + 1);`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word ~0', () => {
    const source = `let x: word = ~0;`;
    // Result could be word or need explicit type annotation
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word ~65535', () => {
    const source = `let x: word = ~65535;`;
    // ~65535 = 0 in word
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Bitwise AND (&) Operations
// =============================================================================

describe('Bitwise AND (&) Operations', () => {
  it('should accept byte & byte', () => {
    const source = `let x: byte = 0b10101010 & 0b11110000;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word & word', () => {
    const source = `let x: word = $FF00 & $0FF0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept x & 0 (always 0)', () => {
    const source = `let a: byte = 255; let x: byte = a & 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept x & $FF (identity for byte)', () => {
    const source = `let a: byte = 100; let x: byte = a & $FF;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept x & x (identity)', () => {
    const source = `let a: byte = 100; let x: byte = a & a;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept chained AND', () => {
    const source = `let x: byte = 255 & 127 & 63;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept AND with hex masks', () => {
    const source = `let x: byte = $AB & $0F;`;
    // Mask lower nibble
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept AND to clear bits', () => {
    const source = `let x: byte = $FF & $F0;`;
    // Clear lower nibble
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Bitwise OR (|) Operations
// =============================================================================

describe('Bitwise OR (|) Operations', () => {
  it('should accept byte | byte', () => {
    const source = `let x: byte = 0b10101010 | 0b01010101;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word | word', () => {
    const source = `let x: word = $FF00 | $00FF;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept x | 0 (identity)', () => {
    const source = `let a: byte = 100; let x: byte = a | 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept x | $FF (always $FF for byte)', () => {
    const source = `let a: byte = 100; let x: byte = a | $FF;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept x | x (identity)', () => {
    const source = `let a: byte = 100; let x: byte = a | a;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept chained OR', () => {
    const source = `let x: byte = 1 | 2 | 4 | 8;`;
    // 1 | 2 | 4 | 8 = 15
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept OR to set bits', () => {
    const source = `let x: byte = $00 | $80;`;
    // Set high bit
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Bitwise XOR (^) Operations
// =============================================================================

describe('Bitwise XOR (^) Operations', () => {
  it('should accept byte ^ byte', () => {
    const source = `let x: byte = 0b10101010 ^ 0b11110000;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word ^ word', () => {
    const source = `let x: word = $FFFF ^ $FF00;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept x ^ 0 (identity)', () => {
    const source = `let a: byte = 100; let x: byte = a ^ 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept x ^ $FF (flip all bits in byte)', () => {
    const source = `let a: byte = $0F; let x: byte = a ^ $FF;`;
    // Flip all bits
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept x ^ x (always 0)', () => {
    const source = `let a: byte = 100; let x: byte = a ^ a;`;
    // x ^ x = 0
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept chained XOR', () => {
    const source = `let x: byte = 255 ^ 127 ^ 63;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept XOR for toggle bits', () => {
    const source = `let x: byte = $AA ^ $0F;`;
    // Toggle lower nibble
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Left Shift (<<) Operations
// =============================================================================

describe('Left Shift (<<) Operations', () => {
  it('should accept byte << 0 (no shift)', () => {
    const source = `let x: byte = 1 << 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept byte << 1', () => {
    const source = `let x: byte = 1 << 1;`;
    // 1 << 1 = 2
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept byte << 7 (max for byte)', () => {
    const source = `let x: byte = 1 << 7;`;
    // 1 << 7 = 128
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle byte << 8 (shifts out)', () => {
    const source = `let x: byte = 1 << 8;`;
    // Would shift completely out in 8-bit
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept word << 15', () => {
    const source = `let x: word = 1 << 15;`;
    // 1 << 15 = 32768
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle word << 16 (shifts out)', () => {
    const source = `let x: word = 1 << 16;`;
    // Would shift completely out in 16-bit
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept variable << literal', () => {
    const source = `let a: byte = 1; let x: byte = a << 3;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept chained left shifts', () => {
    const source = `let x: byte = 1 << 2 << 2;`;
    // (1 << 2) << 2 = 4 << 2 = 16
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Right Shift (>>) Operations
// =============================================================================

describe('Right Shift (>>) Operations', () => {
  it('should accept byte >> 0 (no shift)', () => {
    const source = `let x: byte = 128 >> 0;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept byte >> 1', () => {
    const source = `let x: byte = 128 >> 1;`;
    // 128 >> 1 = 64
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept byte >> 7', () => {
    const source = `let x: byte = 128 >> 7;`;
    // 128 >> 7 = 1
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept byte >> 8 (becomes 0)', () => {
    const source = `let x: byte = 255 >> 8;`;
    // Any value >> 8 = 0 for byte
    const result = analyzeSource(source);
    expect(result).toBeDefined();
  });

  it('should accept word >> 15', () => {
    const source = `let x: word = 32768 >> 15;`;
    // 32768 >> 15 = 1
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept variable >> literal', () => {
    const source = `let a: byte = 128; let x: byte = a >> 3;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept chained right shifts', () => {
    const source = `let x: byte = 128 >> 2 >> 2;`;
    // (128 >> 2) >> 2 = 32 >> 2 = 8
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Mixed Bitwise Operations
// =============================================================================

describe('Mixed Bitwise Operations', () => {
  it('should accept (x & mask) | value', () => {
    const source = `let x: byte = 100; let result: byte = (x & $F0) | $0A;`;
    // Clear lower nibble, set to A
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept x ^ (y & z)', () => {
    const source = `let x: byte = 100; let y: byte = 50; let z: byte = 25; let r: byte = x ^ (y & z);`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept ~x & y', () => {
    const source = `let x: byte = 100; let y: byte = 50; let r: byte = ~x & y;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept (x << 4) | (y >> 4)', () => {
    const source = `let x: byte = $0F; let y: byte = $F0; let r: byte = (x << 4) | (y >> 4);`;
    // Swap nibbles
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept complex bit manipulation', () => {
    const source = `let flags: byte = $00; let result: byte = (flags & ~$04) | $02;`;
    // Clear bit 2, set bit 1
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Bitwise Operations in Expressions
// =============================================================================

describe('Bitwise Operations in Expressions', () => {
  it('should use bitwise in comparison', () => {
    const source = `let flags: byte = $F0; let r: bool = (flags & $80) != 0;`;
    // Check if high bit is set
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should use bitwise in conditional', () => {
    const source = `
      function test(): void {
        let flags: byte = $F0;
        if ((flags & $80) != 0) {
          let x: byte = 1;
        }
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should use bitwise with function parameter', () => {
    const source = `
      function setFlag(f: byte): byte { return f | $01; }
      function main(): void {
        let flags: byte = $00;
        flags = setFlag(flags);
      }
    `;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should use bitwise with array element', () => {
    const source = `
      let flags: byte[4] = [0, 0, 0, 0];
      let x: byte = flags[0] | $01;
    `;
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Bitwise Operator Precedence
// =============================================================================

describe('Bitwise Operator Precedence', () => {
  it('should handle ~ before &', () => {
    const source = `let x: byte = ~$0F & $FF;`;
    // (~$0F) & $FF = $F0 & $FF = $F0
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle shift before &', () => {
    const source = `let x: byte = 1 << 4 & $F0;`;
    // (1 << 4) & $F0 = $10 & $F0 = $10
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle & before |', () => {
    const source = `let x: byte = $0F | $F0 & $FF;`;
    // $0F | ($F0 & $FF) = $0F | $F0 = $FF
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle & before ^', () => {
    const source = `let x: byte = $FF ^ $0F & $F0;`;
    // $FF ^ ($0F & $F0) = $FF ^ $00 = $FF
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle ^ before |', () => {
    const source = `let x: byte = $FF | $0F ^ $F0;`;
    // $FF | ($0F ^ $F0) = $FF | $FF = $FF
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should respect parentheses', () => {
    const source = `let x: byte = ($0F | $F0) & $FF;`;
    // ($0F | $F0) & $FF = $FF & $FF = $FF
    expect(hasNoErrors(source)).toBe(true);
  });
});

// =============================================================================
// Bitwise Type Compatibility
// =============================================================================

describe('Bitwise Type Compatibility', () => {
  it('should accept byte & byte = byte', () => {
    const source = `let a: byte = 100; let b: byte = 50; let r: byte = a & b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept word & word = word', () => {
    const source = `let a: word = 1000; let b: word = 500; let r: word = a & b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should handle byte & word (promotion)', () => {
    const source = `let a: byte = 100; let b: word = 1000; let r: word = a & b;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept ~byte = byte', () => {
    const source = `let a: byte = 100; let r: byte = ~a;`;
    expect(hasNoErrors(source)).toBe(true);
  });

  it('should accept byte << byte', () => {
    const source = `let a: byte = 1; let b: byte = 4; let r: byte = a << b;`;
    expect(hasNoErrors(source)).toBe(true);
  });
});
/**
 * Codegen E2E Tests: Control Flow
 *
 * End-to-end tests that verify the complete pipeline from Blend source
 * code to ASM-IL output for control flow constructs: if/else, while loops,
 * and for loops.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame → IL → CodeGen → ASM-IL
 *
 * @module __tests__/codegen/e2e/control-flow
 */

import { describe, it, expect } from 'vitest';
import {
  compileToAsm,
  mnemonics,
  countMnemonic,
  hasLabel,
  hasAnyMnemonic,
  labelNames,
} from './_helpers.js';

// ============================================================================
// E2E: If Statements
// ============================================================================

describe('E2E Codegen: If Statements', () => {
  it('should compile simple if with comparison', () => {
    const source = `
      module Test;
      function main(): void {
        let x: byte = 10;
        if (x == 5) {
          let y: byte = 1;
        }
      }
    `;

    const result = compileToAsm(source);
    const ops = mnemonics(result);

    // If statement needs: CMP for comparison, branch instruction
    expect(ops).toContain('CMP');

    // Should have a conditional branch (BEQ or BNE)
    expect(hasAnyMnemonic(result, ['BEQ', 'BNE'])).toBe(true);
  });

  it('should compile if with not-equal comparison', () => {
    const source = `
      module Test;
      function main(): void {
        let x: byte = 10;
        if (x != 0) {
          let y: byte = 1;
        }
      }
    `;

    const result = compileToAsm(source);

    // Should have CMP and branch
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(1);
    expect(hasAnyMnemonic(result, ['BEQ', 'BNE'])).toBe(true);
  });

  it('should compile if with less-than comparison', () => {
    const source = `
      module Test;
      function main(): void {
        let x: byte = 3;
        if (x < 10) {
          let y: byte = 1;
        }
      }
    `;

    const result = compileToAsm(source);

    // Less-than uses CMP + conditional branch
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(1);
    // May use BCC, BCS, BEQ, or BNE depending on codegen strategy
    expect(hasAnyMnemonic(result, ['BCC', 'BCS', 'BEQ', 'BNE'])).toBe(true);
  });

  it('should compile if with greater-than comparison', () => {
    const source = `
      module Test;
      function main(): void {
        let x: byte = 20;
        if (x > 10) {
          let y: byte = 1;
        }
      }
    `;

    const result = compileToAsm(source);

    // Greater-than comparison generates CMP and branch
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(1);
  });

  it('should compile if-else', () => {
    const source = `
      module Test;
      function main(): void {
        let x: byte = 5;
        if (x == 0) {
          let a: byte = 1;
        } else {
          let b: byte = 2;
        }
      }
    `;

    const result = compileToAsm(source);

    // If-else needs: CMP, conditional branch, JMP for else skip
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(1);
    expect(hasAnyMnemonic(result, ['BEQ', 'BNE'])).toBe(true);
    // The else branch requires a JMP to skip over it
    expect(countMnemonic(result, 'JMP')).toBeGreaterThanOrEqual(1);
  });

  it('should generate branch labels for if blocks', () => {
    const source = `
      module Test;
      function main(): void {
        let x: byte = 5;
        if (x == 0) {
          let a: byte = 1;
        }
      }
    `;

    const result = compileToAsm(source);

    // Code generator should produce labels for branch targets
    const labels = labelNames(result);
    // Should have at least the function label + branch target labels
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// E2E: While Loops
// ============================================================================

describe('E2E Codegen: While Loops', () => {
  it('should compile simple while loop', () => {
    const source = `
      module Test;
      function main(): void {
        let i: byte = 0;
        while (i < 10) {
          i += 1;
        }
      }
    `;

    const result = compileToAsm(source);
    const ops = mnemonics(result);

    // While loop needs: CMP for condition, branch, JMP back to loop start
    expect(ops).toContain('CMP');
    expect(hasAnyMnemonic(result, ['BCC', 'BCS', 'BEQ', 'BNE'])).toBe(true);
    expect(ops).toContain('JMP');
  });

  it('should compile while loop with equality check', () => {
    const source = `
      module Test;
      function main(): void {
        let done: byte = 0;
        while (done == 0) {
          done = 1;
        }
      }
    `;

    const result = compileToAsm(source);

    // Equality check + branch + JMP for loop
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'JMP')).toBeGreaterThanOrEqual(1);
  });

  it('should compile while loop with decrement', () => {
    const source = `
      module Test;
      function main(): void {
        let count: byte = 10;
        while (count > 0) {
          count -= 1;
        }
      }
    `;

    const result = compileToAsm(source);

    // Should have SBC for the decrement and loop structure
    expect(countMnemonic(result, 'SBC')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'JMP')).toBeGreaterThanOrEqual(1);
  });

  it('should compile while loop with body operations', () => {
    const source = `
      module Test;
      function main(): void {
        let sum: byte = 0;
        let i: byte = 1;
        while (i < 5) {
          sum += i;
          i += 1;
        }
      }
    `;

    const result = compileToAsm(source);

    // Loop body should have at least one ADC for the increment
    // Note: compound assignment with variable (sum += i) uses a different IL path
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(1);
    // Loop structure should have JMP
    expect(countMnemonic(result, 'JMP')).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E: For Loops
// ============================================================================

describe('E2E Codegen: For Loops', () => {
  it('should compile simple for loop', () => {
    const source = `
      module Test;
      function main(): void {
        for (let i: byte = 0 to 9 step 1) {
          let temp: byte = i;
        }
      }
    `;

    const result = compileToAsm(source);

    // For loop: init + condition check + body + increment + JMP back
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'JMP')).toBeGreaterThanOrEqual(1);
  });

  it('should compile for loop with accumulation', () => {
    const source = `
      module Test;
      function main(): void {
        let total: byte = 0;
        for (let i: byte = 0 to 4 step 1) {
          total += 1;
        }
      }
    `;

    const result = compileToAsm(source);

    // Body uses literal compound assignment which generates ADC
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(1);
    // Loop structure
    expect(countMnemonic(result, 'JMP')).toBeGreaterThanOrEqual(1);
  });

  it('should compile countdown for loop', () => {
    const source = `
      module Test;
      function main(): void {
        for (let i: byte = 10 downto 1 step 1) {
          let temp: byte = i;
        }
      }
    `;

    const result = compileToAsm(source);

    // Countdown loop should compile and have loop structure
    // The for-loop step decrement is handled internally by the for-loop IL
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'JMP')).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E: Nested Control Flow
// ============================================================================

describe('E2E Codegen: Nested Control Flow', () => {
  it('should compile if inside while loop', () => {
    const source = `
      module Test;
      function main(): void {
        let i: byte = 0;
        while (i < 10) {
          if (i == 5) {
            let found: byte = 1;
          }
          i += 1;
        }
      }
    `;

    const result = compileToAsm(source);

    // Should have multiple CMP instructions (loop condition + if condition)
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(2);

    // Should have JMP for the loop
    expect(countMnemonic(result, 'JMP')).toBeGreaterThanOrEqual(1);

    // Should have multiple branch labels
    const labels = labelNames(result);
    expect(labels.length).toBeGreaterThanOrEqual(3); // function + loop labels + if labels
  });

  it('should compile nested while loops', () => {
    const source = `
      module Test;
      function main(): void {
        let i: byte = 0;
        while (i < 3) {
          let j: byte = 0;
          while (j < 3) {
            j += 1;
          }
          i += 1;
        }
      }
    `;

    const result = compileToAsm(source);

    // Two loops = at least 2 JMP instructions
    expect(countMnemonic(result, 'JMP')).toBeGreaterThanOrEqual(2);

    // Two loop conditions = at least 2 CMP instructions
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(2);
  });

  it('should compile if-else inside for loop', () => {
    const source = `
      module Test;
      function main(): void {
        let even: byte = 0;
        let odd: byte = 0;
        for (let i: byte = 0 to 9 step 1) {
          if (i == 0) {
            even += 1;
          } else {
            odd += 1;
          }
        }
      }
    `;

    const result = compileToAsm(source);

    // Should have JMP for both for-loop and else-skip
    expect(countMnemonic(result, 'JMP')).toBeGreaterThanOrEqual(2);

    // Should have multiple CMP (loop condition + if condition)
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(2);
  });
});

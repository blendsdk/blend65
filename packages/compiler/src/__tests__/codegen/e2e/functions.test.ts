/**
 * Codegen E2E Tests: Functions
 *
 * End-to-end tests that verify the complete pipeline from Blend source
 * code to ASM-IL output for function definitions, calls, parameters,
 * and return values.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame → IL → CodeGen → ASM-IL
 *
 * @module __tests__/codegen/e2e/functions
 */

import { describe, it, expect } from 'vitest';
import {
  compileToAsm,
  mnemonics,
  countMnemonic,
  hasLabel,
  hasAnyMnemonic,
  labelNames,
  hasComment,
} from './_helpers.js';

// ============================================================================
// E2E: Void Functions
// ============================================================================

describe('E2E Codegen: Void Functions', () => {
  it('should compile empty void function with RTS', () => {
    const source = `
      module Test;
      function doNothing(): void {
      }
      function main(): void {
        doNothing();
      }
    `;

    const result = compileToAsm(source);

    // Both functions should have labels
    expect(hasLabel(result, 'doNothing')).toBe(true);
    expect(hasLabel(result, 'main')).toBe(true);

    // Both functions end with RTS
    expect(countMnemonic(result, 'RTS')).toBeGreaterThanOrEqual(2);
  });

  it('should compile void function with local variables', () => {
    const source = `
      module Test;
      function setup(): void {
        let color: byte = 14;
        let bgColor: byte = 6;
      }
      function main(): void {
        setup();
      }
    `;

    const result = compileToAsm(source);

    // setup should have STA for two locals
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(2);

    // main should have JSR to call setup
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E: Function Calls
// ============================================================================

describe('E2E Codegen: Function Calls', () => {
  it('should compile function call with JSR', () => {
    const source = `
      module Test;
      function helper(): void {
      }
      function main(): void {
        helper();
      }
    `;

    const result = compileToAsm(source);

    // Function call compiles to JSR instruction
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(1);
  });

  it('should compile multiple function calls', () => {
    const source = `
      module Test;
      function init(): void {
        let x: byte = 0;
      }
      function update(): void {
        let delta: byte = 1;
      }
      function draw(): void {
        let color: byte = 14;
      }
      function main(): void {
        init();
        update();
        draw();
      }
    `;

    const result = compileToAsm(source);

    // Should have 3 JSR calls from main
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(3);

    // Should have labels for all 4 functions
    expect(hasLabel(result, 'init')).toBe(true);
    expect(hasLabel(result, 'update')).toBe(true);
    expect(hasLabel(result, 'draw')).toBe(true);
    expect(hasLabel(result, 'main')).toBe(true);
  });

  it('should compile chained function calls', () => {
    const source = `
      module Test;
      function inner(): void {
        let x: byte = 1;
      }
      function middle(): void {
        inner();
      }
      function outer(): void {
        middle();
      }
      function main(): void {
        outer();
      }
    `;

    const result = compileToAsm(source);

    // Call chain: main → outer → middle → inner = 3 JSR instructions
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// E2E: Functions with Parameters
// ============================================================================

describe('E2E Codegen: Function Parameters', () => {
  it('should compile function call with one argument', () => {
    const source = `
      module Test;
      function process(x: byte): void {
        let temp: byte = x;
      }
      function main(): void {
        process(42);
      }
    `;

    const result = compileToAsm(source);

    // Calling with argument: LDA #42, STA param_slot, JSR
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(1);

    // Parameter passing stores the value before calling
    expect(countMnemonic(result, 'STA')).toBeGreaterThanOrEqual(1);
  });

  it('should compile function call with two arguments', () => {
    const source = `
      module Test;
      function add(a: byte, b: byte): byte {
        return a + b;
      }
      function main(): void {
        let result: byte = add(10, 20);
      }
    `;

    const result = compileToAsm(source);

    // Should have JSR for the call
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(1);

    // add function should have ADC for the addition
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(1);
  });

  it('should compile function call with variable arguments', () => {
    const source = `
      module Test;
      function double(x: byte): byte {
        return x + x;
      }
      function main(): void {
        let value: byte = 5;
        let result: byte = double(value);
      }
    `;

    const result = compileToAsm(source);

    // Passing variable as argument requires LDA from slot + STA to param
    expect(countMnemonic(result, 'LDA')).toBeGreaterThanOrEqual(2);
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E: Functions with Return Values
// ============================================================================

describe('E2E Codegen: Return Values', () => {
  it('should compile function returning literal', () => {
    const source = `
      module Test;
      function getNumber(): byte {
        return 42;
      }
      function main(): void {
        let n: byte = getNumber();
      }
    `;

    const result = compileToAsm(source);

    // getNumber: LDA #42, STA return_slot, RTS
    expect(countMnemonic(result, 'RTS')).toBeGreaterThanOrEqual(2);

    // main: JSR getNumber, LDA return_slot, STA local
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(1);
  });

  it('should compile function returning computed value', () => {
    const source = `
      module Test;
      function calculate(): byte {
        let a: byte = 10;
        let b: byte = 20;
        return a + b;
      }
      function main(): void {
        let result: byte = calculate();
      }
    `;

    const result = compileToAsm(source);

    // calculate should have ADC for the addition
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(1);

    // main should have JSR
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(1);
  });

  it('should compile return value used in expression', () => {
    const source = `
      module Test;
      function getBase(): byte {
        return 10;
      }
      function main(): void {
        let result: byte = getBase() + 5;
      }
    `;

    const result = compileToAsm(source);

    // main: JSR getBase, then ADC #5
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(1);
  });

  it('should compile multiple return value usages', () => {
    const source = `
      module Test;
      function getValue(): byte {
        return 5;
      }
      function main(): void {
        let a: byte = getValue();
        let b: byte = getValue();
      }
    `;

    const result = compileToAsm(source);

    // Two calls to getValue
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// E2E: Complex Function Scenarios
// ============================================================================

describe('E2E Codegen: Complex Function Scenarios', () => {
  it('should compile function with parameter and local and return', () => {
    const source = `
      module Test;
      function increment(n: byte): byte {
        let result: byte = n + 1;
        return result;
      }
      function main(): void {
        let x: byte = increment(10);
      }
    `;

    const result = compileToAsm(source);

    // increment: load param, ADC #1, store to local, return
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(1);
  });

  it('should compile function calling another function', () => {
    const source = `
      module Test;
      function inner(): byte {
        return 5;
      }
      function outer(): byte {
        return inner() + 10;
      }
      function main(): void {
        let result: byte = outer();
      }
    `;

    const result = compileToAsm(source);

    // main calls outer, outer calls inner = at least 2 JSR
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(2);

    // outer adds 10 to inner result
    expect(countMnemonic(result, 'ADC')).toBeGreaterThanOrEqual(1);
  });

  it('should compile function with loop inside', () => {
    const source = `
      module Test;
      function countUp(): byte {
        let sum: byte = 0;
        for (let i: byte = 0 to 9 step 1) {
          sum += 1;
        }
        return sum;
      }
      function main(): void {
        let total: byte = countUp();
      }
    `;

    const result = compileToAsm(source);

    // Function with loop: JSR + loop structure (JMP + CMP + branch)
    expect(countMnemonic(result, 'JSR')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'JMP')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(1);
  });

  it('should compile function with conditional return', () => {
    const source = `
      module Test;
      function clamp(value: byte): byte {
        if (value > 100) {
          return 100;
        }
        return value;
      }
      function main(): void {
        let result: byte = clamp(150);
      }
    `;

    const result = compileToAsm(source);

    // clamp has conditional (CMP + branch) and at least one RTS
    expect(countMnemonic(result, 'CMP')).toBeGreaterThanOrEqual(1);
    expect(countMnemonic(result, 'RTS')).toBeGreaterThanOrEqual(2);
  });
});

/**
 * E2E Function Tests
 *
 * Tests for code generation of functions:
 * - Function declarations
 * - Function calls
 * - Parameters and return values
 * - Export modifier
 *
 * @module e2e/functions
 */

import { describe, it, expect } from 'vitest';

import {
  compile,
  compileToAsm,
  compileExpectSuccess,
  expectAsmContains,
  expectAsmNotContains,
  expectAsmInstruction,
  expectAsmLabel,
  expectAsmCall,
} from './helpers/index.js';

// =============================================================================
// Function Declarations
// =============================================================================

describe('E2E Functions - Declarations', () => {
  describe('Void Functions', () => {
    it('generates label and RTS for void function', () => {
      const asm = compileToAsm(`
        function doNothing(): void {
        }
      `);
      expectAsmInstruction(asm, 'RTS');
    });

    it('generates function label', () => {
      const asm = compileToAsm(`
        function myFunc(): void {
        }
      `);
      expectAsmContains(asm, 'myFunc');
    });

    it('generates code for void function with body', () => {
      const asm = compileToAsm(`
        function setBorder(): void {
          poke($D020, 5);
        }
      `);
      expectAsmContains(asm, 'STA $D020');
      expectAsmInstruction(asm, 'RTS');
    });
  });

  describe('Functions with Return Values', () => {
    it('generates byte return', () => {
      const asm = compileToAsm(`
        function getValue(): byte {
          return 42;
        }
      `);
      expectAsmContains(asm, 'LDA #$2A'); // 42 = $2A
      expectAsmInstruction(asm, 'RTS');
    });

    it('generates word return', () => {
      const asm = compileToAsm(`
        function getAddress(): word {
          return $D020;
        }
      `);
      expectAsmInstruction(asm, 'LDA');
      expectAsmInstruction(asm, 'RTS');
    });

    it('generates boolean return', () => {
      const asm = compileToAsm(`
        function isReady(): boolean {
          return true;
        }
      `);
      expectAsmInstruction(asm, 'LDA');
      expectAsmInstruction(asm, 'RTS');
    });

    it('generates return with expression', () => {
      const asm = compileToAsm(`
        let x: byte = 10;
        function calculate(): byte {
          return x + 5;
        }
      `);
      expectAsmInstruction(asm, 'ADC');
      expectAsmInstruction(asm, 'RTS');
    });
  });

  describe('Multiple Functions', () => {
    it('generates labels for multiple functions', () => {
      const asm = compileToAsm(`
        function first(): void {
        }
        
        function second(): void {
        }
        
        function third(): void {
        }
      `);
      expectAsmContains(asm, 'first');
      expectAsmContains(asm, 'second');
      expectAsmContains(asm, 'third');
    });
  });
});

// =============================================================================
// Function Parameters
// =============================================================================

describe('E2E Functions - Parameters', () => {
  describe('Single Parameter', () => {
    it('compiles function with byte parameter', () => {
      const result = compile(`
        function setColor(color: byte): void {
          poke($D020, color);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles function with word parameter', () => {
      const result = compile(`
        function setAddress(addr: word): void {
          pokew($0314, addr);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles function with boolean parameter', () => {
      const result = compile(`
        function setFlag(flag: boolean): void {
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Multiple Parameters', () => {
    it('compiles function with two parameters', () => {
      const result = compile(`
        function add(a: byte, b: byte): byte {
          return a + b;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles function with three parameters', () => {
      const result = compile(`
        function calculate(x: byte, y: byte, z: byte): byte {
          return x + y + z;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles function with mixed parameter types', () => {
      const result = compile(`
        function mixed(addr: word, value: byte, flag: boolean): void {
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Array Parameters', () => {
    it('compiles function with byte array parameter', () => {
      const result = compile(`
        function processData(data: byte[]): void {
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles function with word array parameter', () => {
      const result = compile(`
        function processWords(values: word[]): void {
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Function Calls
// =============================================================================

describe('E2E Functions - Calls', () => {
  describe('Simple Calls', () => {
    it('generates JSR for function call', () => {
      const asm = compileToAsm(`
        function helper(): void {
        }
        
        function main(): void {
          helper();
        }
      `);
      expectAsmCall(asm, 'helper');
    });

    it('generates JSR with correct label', () => {
      const asm = compileToAsm(`
        function setBorder(): void {
          poke($D020, 0);
        }
        
        function main(): void {
          setBorder();
        }
      `);
      // Function labels use underscore prefix
      expectAsmContains(asm, 'JSR _setBorder');
    });
  });

  describe('Calls with Arguments', () => {
    it('passes byte argument to function', () => {
      const asm = compileToAsm(`
        function setColor(color: byte): void {
          poke($D020, color);
        }
        
        function main(): void {
          setColor(5);
        }
      `);
      // Function labels use underscore prefix
      expectAsmContains(asm, 'JSR _setColor');
    });

    it('passes multiple arguments', () => {
      const result = compile(`
        function add(a: byte, b: byte): byte {
          return a + b;
        }
        
        function main(): byte {
          return add(10, 20);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('passes variable as argument', () => {
      const asm = compileToAsm(`
        let color: byte = 5;
        
        function setColor(c: byte): void {
          poke($D020, c);
        }
        
        function main(): void {
          setColor(color);
        }
      `);
      // Function labels use underscore prefix
      expectAsmContains(asm, 'JSR _setColor');
    });
  });

  describe('Calls with Return Values', () => {
    it('uses return value from function', () => {
      const result = compile(`
        function getValue(): byte {
          return 42;
        }
        
        function main(): void {
          let x: byte = getValue();
        }
      `);
      expect(result.success).toBe(true);
    });

    it('uses return value in expression', () => {
      const result = compile(`
        function getValue(): byte {
          return 10;
        }
        
        function main(): byte {
          return getValue() + 5;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('passes return value to another function', () => {
      const result = compile(`
        function getValue(): byte {
          return 5;
        }
        
        function setColor(c: byte): void {
          poke($D020, c);
        }
        
        function main(): void {
          setColor(getValue());
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Nested Calls', () => {
    it('handles nested function calls', () => {
      const result = compile(`
        function inner(): byte {
          return 5;
        }
        
        function outer(): byte {
          return inner();
        }
        
        function main(): byte {
          return outer();
        }
      `);
      expect(result.success).toBe(true);
    });

    it('handles multiple calls in sequence', () => {
      const asm = compileToAsm(`
        function a(): void {
        }
        
        function b(): void {
        }
        
        function c(): void {
        }
        
        function main(): void {
          a();
          b();
          c();
        }
      `);
      expectAsmCall(asm, 'a');
      expectAsmCall(asm, 'b');
      expectAsmCall(asm, 'c');
    });
  });
});

// =============================================================================
// Export Modifier
// =============================================================================

describe('E2E Functions - Export', () => {
  describe('Exported Functions', () => {
    it('compiles exported function', () => {
      const result = compile(`
        export function main(): void {
        }
      `);
      expect(result.success).toBe(true);
    });

    it('generates label for exported function', () => {
      const asm = compileToAsm(`
        export function entryPoint(): void {
          poke($D020, 0);
        }
      `);
      expectAsmContains(asm, 'entryPoint');
    });

    it('compiles multiple exported functions', () => {
      const result = compile(`
        export function init(): void {
        }
        
        export function update(): void {
        }
        
        export function render(): void {
        }
      `);
      expect(result.success).toBe(true);
    });

    it('mixes exported and non-exported functions', () => {
      const result = compile(`
        function helper(): void {
        }
        
        export function main(): void {
          helper();
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Recursion
// =============================================================================

describe('E2E Functions - Recursion', () => {
  describe('Direct Recursion', () => {
    // Recursive functions now compile successfully with an INFO diagnostic
    // explaining that stack depth cannot be statically determined.
    it('compiles recursive function with INFO diagnostic', () => {
      const result = compile(`
        function countdown(n: byte): void {
          if (n > 0) {
            poke($D020, n);
            countdown(n - 1);
          }
        }
      `);
      expect(result.success).toBe(true);
      
      // Should have an INFO diagnostic about recursion
      const recursionInfo = result.diagnostics.find(
        d => d.severity === 'info' && d.message.includes('recursive')
      );
      expect(recursionInfo).toBeDefined();
      expect(recursionInfo?.message).toContain('countdown');
      expect(recursionInfo?.message).toContain('bytes per call');
    });

    it('generates code for recursive function', () => {
      const asm = compileToAsm(`
        function factorial(n: byte): byte {
          if (n == 0) {
            return 1;
          }
          return n * factorial(n - 1);
        }
      `);
      // Should generate a function label
      expectAsmContains(asm, 'factorial');
      // Should have a JSR to itself (recursive call)
      expectAsmContains(asm, 'JSR _factorial');
      expectAsmInstruction(asm, 'RTS');
    });
  });

  describe('Mutual Recursion', () => {
    // Mutually recursive functions now compile with INFO diagnostics
    // for all functions in the recursion cycle.
    it('compiles mutually recursive functions with INFO diagnostics', () => {
      const result = compile(`
        function isEven(n: byte): boolean {
          if (n == 0) {
            return true;
          }
          return isOdd(n - 1);
        }
        
        function isOdd(n: byte): boolean {
          if (n == 0) {
            return false;
          }
          return isEven(n - 1);
        }
      `);
      expect(result.success).toBe(true);

      // Should have INFO diagnostics for both recursive functions
      const recursionInfos = result.diagnostics.filter(
        d => d.severity === 'info' && d.message.includes('recursive')
      );
      // At least one function should be marked as recursive
      expect(recursionInfos.length).toBeGreaterThanOrEqual(1);
    });

    it('generates code for mutually recursive functions', () => {
      const asm = compileToAsm(`
        function ping(n: byte): byte {
          if (n == 0) {
            return 0;
          }
          return pong(n - 1);
        }
        
        function pong(n: byte): byte {
          if (n == 0) {
            return 1;
          }
          return ping(n - 1);
        }
      `);
      // Should generate labels for both functions
      expectAsmContains(asm, 'ping');
      expectAsmContains(asm, 'pong');
      // Should have cross-calls
      expectAsmContains(asm, 'JSR _pong');
      expectAsmContains(asm, 'JSR _ping');
    });
  });
});

// =============================================================================
// Real-World Patterns
// =============================================================================

describe('E2E Functions - Real-World Patterns', () => {
  describe('Initialization Functions', () => {
    it('compiles hardware initialization function', () => {
      const asm = compileToAsm(`
        function initScreen(): void {
          poke($D020, 0);
          poke($D021, 0);
        }
        
        export function main(): void {
          initScreen();
        }
      `);
      expectAsmContains(asm, 'STA $D020');
      expectAsmContains(asm, 'STA $D021');
    });
  });

  describe('Getter/Setter Functions', () => {
    it('compiles getter function', () => {
      const asm = compileToAsm(`
        @map border at $D020: byte;
        
        function getBorderColor(): byte {
          return border;
        }
      `);
      expectAsmContains(asm, 'LDA $D020');
    });

    it('compiles setter function', () => {
      const asm = compileToAsm(`
        @map border at $D020: byte;
        
        function setBorderColor(color: byte): void {
          border = color;
        }
      `);
      expectAsmContains(asm, 'STA $D020');
    });
  });

  describe('Utility Functions', () => {
    it('compiles byte manipulation function', () => {
      const asm = compileToAsm(`
        function setHighNibble(value: byte, nibble: byte): byte {
          return (value & $0F) | (nibble & $F0);
        }
      `);
      expectAsmInstruction(asm, 'AND');
      expectAsmInstruction(asm, 'ORA');
    });

    it('compiles address manipulation function', () => {
      const asm = compileToAsm(`
        function getScreenAddress(row: byte): word {
          return $0400 + row;
        }
      `);
      expectAsmInstruction(asm, 'ADC');
    });
  });

  describe('Game Loop Pattern', () => {
    it('compiles game loop structure', () => {
      const result = compile(`
        function init(): void {
          poke($D020, 0);
        }
        
        function update(): void {
          nop();
        }
        
        function render(): void {
          nop();
        }
        
        export function main(): void {
          init();
          while (true) {
            update();
            render();
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('E2E Functions - Edge Cases', () => {
  describe('Empty Functions', () => {
    it('compiles empty void function', () => {
      const asm = compileToAsm(`
        function empty(): void {
        }
      `);
      expectAsmInstruction(asm, 'RTS');
    });
  });

  describe('Single Expression Functions', () => {
    it('compiles function with single return', () => {
      const asm = compileToAsm(`
        function identity(x: byte): byte {
          return x;
        }
      `);
      expectAsmInstruction(asm, 'RTS');
    });
  });

  describe('Function Naming', () => {
    it('handles single character function names', () => {
      const result = compile(`
        function f(): void {
        }
      `);
      expect(result.success).toBe(true);
    });

    it('handles underscore in function names', () => {
      const result = compile(`
        function my_function(): void {
        }
      `);
      expect(result.success).toBe(true);
    });

    it('handles numeric suffixes in function names', () => {
      const result = compile(`
        function handler1(): void {
        }
        
        function handler2(): void {
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Many Parameters', () => {
    it('compiles function with many parameters', () => {
      const result = compile(`
        function manyParams(a: byte, b: byte, c: byte, d: byte, e: byte): byte {
          return a + b + c + d + e;
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});
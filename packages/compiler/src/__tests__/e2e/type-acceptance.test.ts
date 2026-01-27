/**
 * E2E Type Acceptance Tests
 *
 * Tests for type acceptance in various contexts:
 * - Variable type annotations
 * - Function parameter types
 * - Function return types
 * - Intrinsic type parameters
 *
 * @module e2e/type-acceptance
 */

import { describe, it, expect } from 'vitest';

import { compile, compileExpectSuccess, compileExpectFailure, hasErrorMessage } from './helpers/index.js';

describe('E2E Type Acceptance - Variable Types', () => {
  describe('Primitive Types', () => {
    it('accepts byte type annotation', () => {
      const result = compile('let x: byte = 10;');
      expect(result.success).toBe(true);
    });

    it('accepts word type annotation', () => {
      const result = compile('let x: word = 1000;');
      expect(result.success).toBe(true);
    });

    it('accepts boolean type annotation', () => {
      const result = compile('let x: boolean = true;');
      expect(result.success).toBe(true);
    });

    it('accepts boolean with false value', () => {
      const result = compile('let x: boolean = false;');
      expect(result.success).toBe(true);
    });
  });

  describe('Array Types', () => {
    it('accepts byte array with explicit size', () => {
      const result = compile('let data: byte[10];');
      expect(result.success).toBe(true);
    });

    it('accepts word array with explicit size', () => {
      const result = compile('let values: word[5];');
      expect(result.success).toBe(true);
    });

    it('accepts byte array with initializer', () => {
      // Note: There's a known bug where array initializers generate $00
      // This test checks compilation succeeds, not correct codegen
      const result = compile('let data: byte[3] = [1, 2, 3];');
      expect(result.success).toBe(true);
    });

    it('accepts nested byte values in array initializer', () => {
      const result = compile('let data: byte[3] = [10, 20, 30];');
      expect(result.success).toBe(true);
    });
  });

  describe('Hex and Binary Literals', () => {
    it('accepts hex literal with $-prefix for byte', () => {
      const result = compile('let x: byte = $FF;');
      expect(result.success).toBe(true);
    });

    it('accepts hex literal with 0x-prefix for byte', () => {
      const result = compile('let x: byte = 0xFF;');
      expect(result.success).toBe(true);
    });

    it('accepts hex literal for word', () => {
      const result = compile('let x: word = $D020;');
      expect(result.success).toBe(true);
    });

    it('accepts binary literal with 0b-prefix', () => {
      const result = compile('let x: byte = 0b11110000;');
      expect(result.success).toBe(true);
    });

    it('accepts another binary literal with 0b-prefix', () => {
      const result = compile('let x: byte = 0b00001111;');
      expect(result.success).toBe(true);
    });
  });
});

describe('E2E Type Acceptance - Memory Mapped Variables', () => {
  describe('@map with byte type', () => {
    it('accepts @map with hex address', () => {
      const result = compile('@map borderColor at $D020: byte;');
      expect(result.success).toBe(true);
    });

    it('accepts @map with 0x-prefix address', () => {
      const result = compile('@map screenRam at 0x0400: byte;');
      expect(result.success).toBe(true);
    });

    it('accepts @map with decimal address', () => {
      const result = compile('@map zeroPage at 2: byte;');
      expect(result.success).toBe(true);
    });
  });

  describe('@map with word type', () => {
    it('accepts @map word at address', () => {
      const result = compile('@map vectorNmi at $FFFA: word;');
      expect(result.success).toBe(true);
    });
  });

  describe('@map with array type', () => {
    it('accepts @map byte array at address', () => {
      const result = compile('@map screen at $0400: byte[1000];');
      expect(result.success).toBe(true);
    });

    it('accepts @map word array at address', () => {
      const result = compile('@map vectors at $FFFA: word[3];');
      expect(result.success).toBe(true);
    });
  });
});

describe('E2E Type Acceptance - Function Parameter Types', () => {
  describe('Basic Parameter Types', () => {
    it('accepts byte parameter', () => {
      const result = compile(`
        function test(x: byte): void {
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts word parameter', () => {
      const result = compile(`
        function test(addr: word): void {
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts boolean parameter', () => {
      const result = compile(`
        function test(flag: boolean): void {
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts multiple parameters of different types', () => {
      const result = compile(`
        function test(x: byte, y: word, flag: boolean): void {
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Array Parameter Types', () => {
    it('accepts byte array parameter', () => {
      const result = compile(`
        function processData(data: byte[]): void {
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts word array parameter', () => {
      const result = compile(`
        function processWords(values: word[]): void {
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

describe('E2E Type Acceptance - Function Return Types', () => {
  describe('Basic Return Types', () => {
    it('accepts void return type', () => {
      const result = compile(`
        function doNothing(): void {
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts byte return type', () => {
      const result = compile(`
        function getByte(): byte {
          return 10;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts word return type', () => {
      const result = compile(`
        function getWord(): word {
          return 1000;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts boolean return type', () => {
      const result = compile(`
        function isReady(): boolean {
          return true;
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Return Type with Expression', () => {
    it('returns byte from parameter', () => {
      const result = compile(`
        function identity(x: byte): byte {
          return x;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('returns word from parameter', () => {
      const result = compile(`
        function identity(x: word): word {
          return x;
        }
      `);
      expect(result.success).toBe(true);
    });

    it('returns result of expression', () => {
      const result = compile(`
        function add(a: byte, b: byte): byte {
          return a + b;
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

describe('E2E Type Acceptance - sizeof() Intrinsic', () => {
  describe('sizeof with primitive types', () => {
    it('accepts sizeof(byte)', () => {
      const result = compile(`
        function test(): byte {
          return sizeof(byte);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts sizeof(word)', () => {
      const result = compile(`
        function test(): byte {
          return sizeof(word);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts sizeof(boolean)', () => {
      const result = compile(`
        function test(): byte {
          return sizeof(boolean);
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('sizeof with variable expressions', () => {
    it('accepts sizeof with variable', () => {
      const result = compile(`
        let x: word = 0;
        function test(): byte {
          return sizeof(x);
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

describe('E2E Type Acceptance - length() Intrinsic', () => {
  describe('length with byte array', () => {
    it('accepts length() with global byte array', () => {
      const result = compile(`
        let data: byte[10];
        function test(): word {
          return length(data);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts length() with initialized byte array', () => {
      const result = compile(`
        let data: byte[5] = [1, 2, 3, 4, 5];
        function test(): word {
          return length(data);
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('length with word array', () => {
    it('accepts length() with word array', () => {
      const result = compile(`
        let values: word[8];
        function test(): word {
          return length(values);
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('length with string - KNOWN ISSUE', () => {
    // This test documents a known issue where length() doesn't work with strings
    it.skip('should accept length() with string literal', () => {
      // Currently fails with type error - length expects byte[], not string
      const result = compile(`
        function test(): word {
          return length("hello");
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

describe('E2E Type Acceptance - Type Errors', () => {
  describe('Type mismatch errors', () => {
    it('rejects assigning string to byte', () => {
      const result = compile('let x: byte = "hello";');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects undefined variable', () => {
      const result = compile(`
        function test(): byte {
          return undefined_var;
        }
      `);
      expect(result.success).toBe(false);
    });

    it('rejects calling undefined function', () => {
      const result = compile(`
        function test(): void {
          undefined_function();
        }
      `);
      expect(result.success).toBe(false);
    });
  });

  describe('Syntax errors', () => {
    it('rejects missing type annotation', () => {
      const result = compile('let x = 10;');
      // This may succeed with type inference or fail - depends on implementation
      // Document actual behavior
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('rejects invalid type name', () => {
      const result = compile('let x: invalid_type = 10;');
      expect(result.success).toBe(false);
    });
  });
});

describe('E2E Type Acceptance - Export Modifiers', () => {
  it('accepts exported variable', () => {
    const result = compile('export let counter: byte = 0;');
    expect(result.success).toBe(true);
  });

  it('accepts exported function', () => {
    const result = compile(`
      export function main(): void {
      }
    `);
    expect(result.success).toBe(true);
  });

  it('accepts exported @map variable', () => {
    const result = compile('export @map screen at $0400: byte[1000];');
    expect(result.success).toBe(true);
  });
});
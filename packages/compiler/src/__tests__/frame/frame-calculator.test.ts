/**
 * Tests for FrameCalculator
 *
 * Tests the frame size calculation for functions:
 * - Parameter slot creation
 * - Local variable slot creation
 * - Return slot creation
 * - ZP directive detection
 * - Nested control structure handling
 *
 * Uses REAL Lexer, Parser, and SymbolTable (NO MOCKS per code.md Rule 25)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { FunctionDecl } from '../../ast/declarations.js';
import { isFunctionDecl } from '../../ast/type-guards.js';
import { FrameCalculator, Frame, createFrame } from '../../frame/allocator/frame-calculator.js';
import { SlotKind, ZpDirective } from '../../frame/enums.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Parse source code and return the first function declaration.
 */
function parseFunction(source: string): FunctionDecl {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();
  
  for (const decl of program.getDeclarations()) {
    if (isFunctionDecl(decl)) {
      return decl;
    }
  }
  
  throw new Error('No function found in source');
}

/**
 * Parse source code and return all function declarations.
 */
function parseFunctions(source: string): FunctionDecl[] {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();
  
  const functions: FunctionDecl[] = [];
  for (const decl of program.getDeclarations()) {
    if (isFunctionDecl(decl)) {
      functions.push(decl);
    }
  }
  return functions;
}

/**
 * Create a FrameCalculator with a fresh SymbolTable.
 */
function createCalculator(): FrameCalculator {
  const symbolTable = new SymbolTable();
  return new FrameCalculator(symbolTable);
}

/**
 * Calculate frame for a source code string.
 */
function calculateFrameFromSource(source: string): Frame {
  const func = parseFunction(source);
  const calculator = createCalculator();
  return calculator.calculateFrame(func);
}

// ============================================================================
// createFrame Factory Tests
// ============================================================================

describe('createFrame', () => {
  it('should create a frame with default values', () => {
    const frame = createFrame('testFunc');
    
    expect(frame.functionName).toBe('testFunc');
    expect(frame.slots).toEqual([]);
    expect(frame.totalSize).toBe(0);
    expect(frame.isExported).toBe(false);
    expect(frame.isCallback).toBe(false);
    expect(frame.baseAddress).toBe(0);
    expect(frame.coalesceGroup).toBe(-1);
  });

  it('should allow overriding default values', () => {
    const frame = createFrame('exportedFunc', {
      isExported: true,
      isCallback: true,
      totalSize: 10,
      baseAddress: 0x0200,
      coalesceGroup: 1,
    });
    
    expect(frame.functionName).toBe('exportedFunc');
    expect(frame.isExported).toBe(true);
    expect(frame.isCallback).toBe(true);
    expect(frame.totalSize).toBe(10);
    expect(frame.baseAddress).toBe(0x0200);
    expect(frame.coalesceGroup).toBe(1);
  });
});

// ============================================================================
// FrameCalculator Basic Tests
// ============================================================================

describe('FrameCalculator', () => {
  describe('constructor', () => {
    it('should create calculator with symbol table', () => {
      const symbolTable = new SymbolTable();
      const calculator = new FrameCalculator(symbolTable);
      expect(calculator).toBeInstanceOf(FrameCalculator);
    });
  });

  describe('empty function', () => {
    it('should calculate frame for function with no parameters or locals', () => {
      const source = `function empty(): void { }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.functionName).toBe('empty');
      expect(frame.slots).toHaveLength(0);
      expect(frame.totalSize).toBe(0);
    });

    it('should handle void return type without return slot', () => {
      const source = `function noReturn(): void { }`;
      const frame = calculateFrameFromSource(source);
      
      const returnSlots = frame.slots.filter(s => s.kind === SlotKind.Return);
      expect(returnSlots).toHaveLength(0);
    });
  });

  describe('parameter slots', () => {
    it('should create slot for single byte parameter', () => {
      const source = `function withParam(x: byte): void { }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(1);
      expect(frame.slots[0].name).toBe('x');
      expect(frame.slots[0].kind).toBe(SlotKind.Parameter);
      expect(frame.slots[0].size).toBe(1);
      expect(frame.slots[0].offset).toBe(0);
    });

    it('should create slot for single word parameter', () => {
      const source = `function withWord(ptr: word): void { }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(1);
      expect(frame.slots[0].name).toBe('ptr');
      expect(frame.slots[0].size).toBe(2);
    });

    it('should create slots for multiple parameters with correct offsets', () => {
      const source = `function add(x: byte, y: byte): void { }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(2);
      expect(frame.slots[0].name).toBe('x');
      expect(frame.slots[0].offset).toBe(0);
      expect(frame.slots[1].name).toBe('y');
      expect(frame.slots[1].offset).toBe(1);
      expect(frame.totalSize).toBe(2);
    });

    it('should handle mixed parameter types', () => {
      const source = `function mixed(a: byte, b: word, c: bool): void { }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(3);
      expect(frame.slots[0].name).toBe('a');
      expect(frame.slots[0].size).toBe(1);
      expect(frame.slots[0].offset).toBe(0);
      
      expect(frame.slots[1].name).toBe('b');
      expect(frame.slots[1].size).toBe(2);
      expect(frame.slots[1].offset).toBe(1);
      
      expect(frame.slots[2].name).toBe('c');
      expect(frame.slots[2].size).toBe(1);
      expect(frame.slots[2].offset).toBe(3);
      
      expect(frame.totalSize).toBe(4);
    });

    it('should set ZpDirective.None for all parameters', () => {
      const source = `function params(x: byte, y: word): void { }`;
      const frame = calculateFrameFromSource(source);
      
      for (const slot of frame.slots) {
        expect(slot.zpDirective).toBe(ZpDirective.None);
      }
    });
  });

  describe('local variable slots', () => {
    it('should create slot for single local variable', () => {
      const source = `function withLocal(): void { let x: byte = 0; }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(1);
      expect(frame.slots[0].name).toBe('x');
      expect(frame.slots[0].kind).toBe(SlotKind.Local);
      expect(frame.slots[0].size).toBe(1);
    });

    it('should create slots for multiple local variables', () => {
      const source = `function withLocals(): void {
        let a: byte = 1;
        let b: word = 2;
        let c: bool = true;
      }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(3);
      expect(frame.slots[0].name).toBe('a');
      expect(frame.slots[1].name).toBe('b');
      expect(frame.slots[2].name).toBe('c');
      expect(frame.totalSize).toBe(4); // 1 + 2 + 1
    });

    it('should place locals after parameters', () => {
      const source = `function withBoth(p: byte): void { let l: byte = 0; }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(2);
      expect(frame.slots[0].kind).toBe(SlotKind.Parameter);
      expect(frame.slots[0].offset).toBe(0);
      expect(frame.slots[1].kind).toBe(SlotKind.Local);
      expect(frame.slots[1].offset).toBe(1);
    });
  });

  describe('return slot', () => {
    it('should create return slot for byte return type', () => {
      const source = `function returnByte(): byte { return 42; }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(1);
      expect(frame.slots[0].name).toBe('__return');
      expect(frame.slots[0].kind).toBe(SlotKind.Return);
      expect(frame.slots[0].size).toBe(1);
    });

    it('should create return slot for word return type', () => {
      const source = `function returnWord(): word { return 1000; }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(1);
      expect(frame.slots[0].name).toBe('__return');
      expect(frame.slots[0].size).toBe(2);
    });

    it('should place return slot after parameters and locals', () => {
      const source = `function complex(p: byte): byte {
        let l: byte = 0;
        return l;
      }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(3);
      expect(frame.slots[0].kind).toBe(SlotKind.Parameter);
      expect(frame.slots[0].offset).toBe(0);
      expect(frame.slots[1].kind).toBe(SlotKind.Local);
      expect(frame.slots[1].offset).toBe(1);
      expect(frame.slots[2].kind).toBe(SlotKind.Return);
      expect(frame.slots[2].offset).toBe(2);
      expect(frame.totalSize).toBe(3);
    });
  });

  describe('ZP directive detection', () => {
    // NOTE: In v2, storage classes (@zp, @ram) are NOT supported on local variables
    // inside functions. The frame allocator decides ZP placement based on scoring.
    // Storage classes are only used on module-level variables.

    it('should default to ZpDirective.None for all locals (v2 design)', () => {
      const source = `function noDirective(): void { let x: byte = 0; }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(1);
      expect(frame.slots[0].zpDirective).toBe(ZpDirective.None);
    });

    it('should set ZpDirective.None for multiple locals', () => {
      const source = `function withLocals(): void {
        let a: byte = 0;
        let b: byte = 1;
        let c: byte = 2;
      }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(3);
      // All locals get ZpDirective.None in v2 - allocator decides based on scoring
      expect(frame.slots[0].zpDirective).toBe(ZpDirective.None);
      expect(frame.slots[1].zpDirective).toBe(ZpDirective.None);
      expect(frame.slots[2].zpDirective).toBe(ZpDirective.None);
    });
  });

  describe('function metadata', () => {
    it('should track exported functions', () => {
      const source = `export function exported(): void { }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.isExported).toBe(true);
    });

    it('should track non-exported functions', () => {
      const source = `function internal(): void { }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.isExported).toBe(false);
    });

    it('should track callback functions', () => {
      const source = `callback function handler(): void { }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.isCallback).toBe(true);
    });
  });

  describe('nested control structures', () => {
    it('should find locals inside if statements', () => {
      const source = `function withIf(cond: bool): void {
        if (cond) {
          let inner: byte = 1;
        }
      }`;
      const frame = calculateFrameFromSource(source);
      
      const localSlots = frame.slots.filter(s => s.kind === SlotKind.Local);
      expect(localSlots).toHaveLength(1);
      expect(localSlots[0].name).toBe('inner');
    });

    it('should find locals in both if and else branches', () => {
      const source = `function withIfElse(cond: bool): void {
        if (cond) {
          let inIf: byte = 1;
        } else {
          let inElse: byte = 2;
        }
      }`;
      const frame = calculateFrameFromSource(source);
      
      const localSlots = frame.slots.filter(s => s.kind === SlotKind.Local);
      expect(localSlots).toHaveLength(2);
      expect(localSlots.map(s => s.name)).toContain('inIf');
      expect(localSlots.map(s => s.name)).toContain('inElse');
    });

    it('should find locals inside while loops', () => {
      const source = `function withWhile(): void {
        while (true) {
          let counter: byte = 0;
        }
      }`;
      const frame = calculateFrameFromSource(source);
      
      const localSlots = frame.slots.filter(s => s.kind === SlotKind.Local);
      expect(localSlots).toHaveLength(1);
      expect(localSlots[0].name).toBe('counter');
    });

    it('should find locals inside do-while loops', () => {
      const source = `function withDoWhile(): void {
        do {
          let counter: byte = 0;
        } while (true);
      }`;
      const frame = calculateFrameFromSource(source);
      
      const localSlots = frame.slots.filter(s => s.kind === SlotKind.Local);
      expect(localSlots).toHaveLength(1);
      expect(localSlots[0].name).toBe('counter');
    });

    it('should find locals inside for loops', () => {
      const source = `function withFor(): void {
        for (let i: byte = 0 to 10) {
          let temp: byte = 0;
        }
      }`;
      const frame = calculateFrameFromSource(source);
      
      const localSlots = frame.slots.filter(s => s.kind === SlotKind.Local);
      // For loop iterator 'i' is also allocated as a local slot
      expect(localSlots).toHaveLength(2);
      expect(localSlots.map(s => s.name)).toContain('temp');
      expect(localSlots.map(s => s.name)).toContain('i');
    });

    it('should find locals in deeply nested structures', () => {
      const source = `function deeplyNested(cond: bool): void {
        if (cond) {
          while (true) {
            for (let i: byte = 0 to 5) {
              let deep: byte = 0;
            }
          }
        }
      }`;
      const frame = calculateFrameFromSource(source);
      
      const localSlots = frame.slots.filter(s => s.kind === SlotKind.Local);
      // For loop iterator 'i' is also allocated as a local slot
      expect(localSlots).toHaveLength(2);
      expect(localSlots.map(s => s.name)).toContain('deep');
      expect(localSlots.map(s => s.name)).toContain('i');
    });

    it('should find locals in switch cases', () => {
      const source = `function withSwitch(x: byte): void {
        switch (x) {
          case 1:
            let inCase: byte = 1;
            break;
          case 2:
            let inCase2: byte = 2;
            break;
          default:
            let inDefault: byte = 0;
        }
      }`;
      const frame = calculateFrameFromSource(source);
      
      const localSlots = frame.slots.filter(s => s.kind === SlotKind.Local);
      expect(localSlots).toHaveLength(3);
    });
  });

  describe('array types', () => {
    it('should calculate correct size for byte arrays', () => {
      const source = `function withArray(): void { let buffer: byte[10] = []; }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(1);
      expect(frame.slots[0].size).toBe(10);
      expect(frame.slots[0].isArrayElement).toBe(true);
      expect(frame.slots[0].arraySize).toBe(10);
    });

    it('should calculate correct size for word arrays', () => {
      const source = `function withWordArray(): void { let ptrs: word[5] = []; }`;
      const frame = calculateFrameFromSource(source);
      
      expect(frame.slots).toHaveLength(1);
      expect(frame.slots[0].size).toBe(10); // 5 * 2 bytes
      expect(frame.slots[0].isArrayElement).toBe(true);
      expect(frame.slots[0].arraySize).toBe(5);
    });
  });

  describe('calculateFrames (multiple functions)', () => {
    it('should calculate frames for multiple functions', () => {
      const source = `
        function first(a: byte): byte { return a; }
        function second(x: word, y: word): void { }
      `;
      const functions = parseFunctions(source);
      const calculator = createCalculator();
      const frames = calculator.calculateFrames(functions);
      
      expect(frames.size).toBe(2);
      expect(frames.has('first')).toBe(true);
      expect(frames.has('second')).toBe(true);
      
      const firstFrame = frames.get('first')!;
      expect(firstFrame.totalSize).toBe(2); // 1 param + 1 return
      
      const secondFrame = frames.get('second')!;
      expect(secondFrame.totalSize).toBe(4); // 2 word params
    });

    it('should skip stub functions', () => {
      const source = `
        function real(): void { }
        function stub(x: byte): byte;
      `;
      const functions = parseFunctions(source);
      const calculator = createCalculator();
      const frames = calculator.calculateFrames(functions);
      
      expect(frames.size).toBe(1);
      expect(frames.has('real')).toBe(true);
      expect(frames.has('stub')).toBe(false);
    });
  });

  describe('getFrameSize', () => {
    it('should return total frame size', () => {
      const source = `function sized(a: byte, b: word): byte {
        let x: byte = 0;
        return x;
      }`;
      const func = parseFunction(source);
      const calculator = createCalculator();
      const size = calculator.getFrameSize(func);
      
      // 1 (byte param) + 2 (word param) + 1 (local) + 1 (return) = 5
      expect(size).toBe(5);
    });
  });

  describe('complete frame calculation', () => {
    it('should calculate frame for realistic function', () => {
      // NOTE: v2 doesn't support @zp/@ram on local variables - allocator decides
      const source = `function gameLoop(frameCount: word): byte {
        let playerX: byte = 0;
        let playerY: byte = 0;
        let score: word = 0;
        let alive: bool = true;
        return 0;
      }`;
      const frame = calculateFrameFromSource(source);
      
      // Parameters
      expect(frame.slots[0].name).toBe('frameCount');
      expect(frame.slots[0].kind).toBe(SlotKind.Parameter);
      expect(frame.slots[0].size).toBe(2);
      expect(frame.slots[0].offset).toBe(0);
      
      // Locals (all ZpDirective.None in v2 - allocator decides based on scoring)
      expect(frame.slots[1].name).toBe('playerX');
      expect(frame.slots[1].kind).toBe(SlotKind.Local);
      expect(frame.slots[1].zpDirective).toBe(ZpDirective.None);
      expect(frame.slots[1].offset).toBe(2);
      
      expect(frame.slots[2].name).toBe('playerY');
      expect(frame.slots[2].zpDirective).toBe(ZpDirective.None);
      expect(frame.slots[2].offset).toBe(3);
      
      expect(frame.slots[3].name).toBe('score');
      expect(frame.slots[3].zpDirective).toBe(ZpDirective.None);
      expect(frame.slots[3].offset).toBe(4);
      
      expect(frame.slots[4].name).toBe('alive');
      expect(frame.slots[4].offset).toBe(6);
      
      // Return
      expect(frame.slots[5].name).toBe('__return');
      expect(frame.slots[5].kind).toBe(SlotKind.Return);
      expect(frame.slots[5].offset).toBe(7);
      
      // Total: 2 + 1 + 1 + 2 + 1 + 1 = 8
      expect(frame.totalSize).toBe(8);
    });
  });
});
/**
 * IL Generator E2E Test: Functions
 *
 * End-to-end test that verifies the complete pipeline from
 * source code to IL instructions for function definitions and calls.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame Allocator → IL Generator
 *
 * @module __tests__/il/e2e/functions
 */

import { describe, it, expect } from 'vitest';

// Lexer
import { Lexer } from '../../../lexer/index.js';

// Parser
import { Parser } from '../../../parser/index.js';

// Semantic
import { SemanticAnalyzer } from '../../../semantic/index.js';

// IL Generator
import { ILGenerator, ILOpcode } from '../../../il/index.js';

// Frame types
import { SlotKind } from '../../../frame/enums.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Compiles source code to IL program through the full pipeline.
 *
 * @param source - Blend source code
 * @returns IL program or throws on error
 */
function compileToIL(source: string) {
  const lexer = new Lexer(source, 'test.blend');
  const tokens = lexer.tokenize();

  const parser = new Parser(tokens, { filename: 'test.blend' });
  const ast = parser.parse();

  const semanticAnalyzer = new SemanticAnalyzer({
    runFrameAllocation: true,
    runAdvancedAnalysis: false,
  });
  const analysisResult = semanticAnalyzer.analyze(ast);

  const errors = analysisResult.diagnostics.filter(d => d.severity === 0);
  if (errors.length > 0) {
    throw new Error(`Semantic errors: ${errors.map(e => e.message).join(', ')}`);
  }

  if (!analysisResult.frameMap) {
    throw new Error('Frame allocation failed - no frameMap in analysis result');
  }

  const ilGenerator = new ILGenerator(analysisResult.frameMap, analysisResult.symbolTable);
  return ilGenerator.generate(ast);
}

/**
 * Counts occurrences of a specific opcode in an IL function.
 */
function countOpcode(instructions: { opcode: ILOpcode }[], opcode: ILOpcode): number {
  return instructions.filter(i => i.opcode === opcode).length;
}

// ============================================================================
// E2E Tests: Function Definitions
// ============================================================================

describe('E2E: Functions - Function Definitions', () => {
  describe('void functions', () => {
    it('should compile a simple void function', () => {
      const source = `
        module Test;
        
        function main(): void {
          let x: byte = 1;
        }
      `;

      const program = compileToIL(source);

      expect(program).toBeDefined();
      expect(program.functions.length).toBe(1);
      expect(program.functions[0].name).toBe('main');

      // Void functions have no return slot in frame
      const returnSlots = program.functions[0].frame.slots.filter(
        s => s.kind === SlotKind.Return
      );
      expect(returnSlots.length).toBe(0);
    });

    it('should generate RETURN instruction for void function', () => {
      const source = `
        module Test;
        
        function doNothing(): void {
        }
        
        function main(): void {
          doNothing();
        }
      `;

      const program = compileToIL(source);

      const doNothing = program.functions.find(f => f.name === 'doNothing');
      expect(doNothing).toBeDefined();

      const returnCount = countOpcode(doNothing!.instructions, ILOpcode.RETURN);
      expect(returnCount).toBe(1);
    });
  });

  describe('functions with return values', () => {
    it('should compile a function returning byte', () => {
      const source = `
        module Test;
        
        function getNumber(): byte {
          return 42;
        }
        
        function main(): void {
          let x: byte = getNumber();
        }
      `;

      const program = compileToIL(source);

      const getNumber = program.functions.find(f => f.name === 'getNumber');
      expect(getNumber).toBeDefined();

      // Non-void functions have a return slot in frame
      const returnSlots = getNumber!.frame.slots.filter(s => s.kind === SlotKind.Return);
      expect(returnSlots.length).toBe(1);

      // Should have LOAD_IMM 42 and RETURN
      const loadImm = countOpcode(getNumber!.instructions, ILOpcode.LOAD_IMM);
      const ret = countOpcode(getNumber!.instructions, ILOpcode.RETURN);

      expect(loadImm).toBeGreaterThanOrEqual(1);
      expect(ret).toBe(1);
    });

    it('should compile a function returning computed value', () => {
      const source = `
        module Test;
        
        function calculate(): byte {
          let x: byte = 10;
          let y: byte = 20;
          return x + y;
        }
        
        function main(): void {
          let result: byte = calculate();
        }
      `;

      const program = compileToIL(source);

      const calculate = program.functions.find(f => f.name === 'calculate');
      expect(calculate).toBeDefined();

      // Should have ADD instruction before RETURN
      const hasAdd =
        countOpcode(calculate!.instructions, ILOpcode.ADD_BYTE) > 0 ||
        countOpcode(calculate!.instructions, ILOpcode.ADD_IMM) > 0;
      expect(hasAdd).toBe(true);
    });
  });
});

// ============================================================================
// E2E Tests: Function Parameters
// ============================================================================

describe('E2E: Functions - Parameters', () => {
  describe('single parameter', () => {
    it('should compile function with one byte parameter', () => {
      const source = `
        module Test;
        
        function double(x: byte): byte {
          return x + x;
        }
        
        function main(): void {
          let result: byte = double(5);
        }
      `;

      const program = compileToIL(source);

      const double = program.functions.find(f => f.name === 'double');
      expect(double).toBeDefined();

      // Get parameter slots from frame
      const paramSlots = double!.frame.slots.filter(s => s.kind === SlotKind.Parameter);
      expect(paramSlots.length).toBe(1);
      expect(paramSlots[0].name).toBe('x');
    });

    it('should load parameter value in function body', () => {
      const source = `
        module Test;
        
        function increment(n: byte): byte {
          return n + 1;
        }
        
        function main(): void {
          let result: byte = increment(10);
        }
      `;

      const program = compileToIL(source);

      const increment = program.functions.find(f => f.name === 'increment');
      expect(increment).toBeDefined();

      // Should have LOAD_BYTE for parameter access
      const loadByte = countOpcode(increment!.instructions, ILOpcode.LOAD_BYTE);
      expect(loadByte).toBeGreaterThanOrEqual(1);
    });
  });

  describe('multiple parameters', () => {
    it('should compile function with two parameters', () => {
      const source = `
        module Test;
        
        function add(a: byte, b: byte): byte {
          return a + b;
        }
        
        function main(): void {
          let result: byte = add(10, 20);
        }
      `;

      const program = compileToIL(source);

      const add = program.functions.find(f => f.name === 'add');
      expect(add).toBeDefined();

      // Get parameter slots from frame
      const paramSlots = add!.frame.slots.filter(s => s.kind === SlotKind.Parameter);
      expect(paramSlots.length).toBe(2);
      expect(paramSlots[0].name).toBe('a');
      expect(paramSlots[1].name).toBe('b');
    });

    it('should compile function with three parameters', () => {
      const source = `
        module Test;
        
        function clamp(value: byte, min: byte, max: byte): byte {
          return value;
        }
        
        function main(): void {
          let result: byte = clamp(50, 0, 100);
        }
      `;

      const program = compileToIL(source);

      const clamp = program.functions.find(f => f.name === 'clamp');
      expect(clamp).toBeDefined();

      // Get parameter slots from frame
      const paramSlots = clamp!.frame.slots.filter(s => s.kind === SlotKind.Parameter);
      expect(paramSlots.length).toBe(3);
    });
  });
});

// ============================================================================
// E2E Tests: Function Calls
// ============================================================================

describe('E2E: Functions - Function Calls', () => {
  describe('simple calls', () => {
    it('should generate CALL instruction for function call', () => {
      const source = `
        module Test;
        
        function helper(): void {
        }
        
        function main(): void {
          helper();
        }
      `;

      const program = compileToIL(source);

      const main = program.functions.find(f => f.name === 'main');
      expect(main).toBeDefined();

      const callCount = countOpcode(main!.instructions, ILOpcode.CALL);
      expect(callCount).toBe(1);
    });

    it('should generate multiple CALL instructions', () => {
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

      const program = compileToIL(source);

      const main = program.functions.find(f => f.name === 'main');
      expect(main).toBeDefined();

      const callCount = countOpcode(main!.instructions, ILOpcode.CALL);
      expect(callCount).toBe(2);
    });
  });

  describe('calls with arguments', () => {
    it('should generate CALL instruction for function with immediate argument', () => {
      const source = `
        module Test;
        
        function process(x: byte): void {
          let temp: byte = x;
        }
        
        function main(): void {
          process(42);
        }
      `;

      const program = compileToIL(source);

      const main = program.functions.find(f => f.name === 'main');
      expect(main).toBeDefined();

      // Verify CALL instruction is generated
      const call = countOpcode(main!.instructions, ILOpcode.CALL);
      expect(call).toBe(1);
    });

    it('should generate CALL instruction for function with variable argument', () => {
      const source = `
        module Test;
        
        function process(x: byte): void {
          let temp: byte = x;
        }
        
        function main(): void {
          let value: byte = 10;
          process(value);
        }
      `;

      const program = compileToIL(source);

      const main = program.functions.find(f => f.name === 'main');
      expect(main).toBeDefined();

      // Verify CALL instruction is generated
      const call = countOpcode(main!.instructions, ILOpcode.CALL);
      expect(call).toBe(1);

      // Also verify that the local variable initialization generates LOAD_IMM
      // (for "let value: byte = 10")
      const loadImm = countOpcode(main!.instructions, ILOpcode.LOAD_IMM);
      expect(loadImm).toBeGreaterThanOrEqual(1);
    });
  });

  describe('calls with return values', () => {
    it('should store function return value', () => {
      const source = `
        module Test;
        
        function getNumber(): byte {
          return 100;
        }
        
        function main(): void {
          let result: byte = getNumber();
        }
      `;

      const program = compileToIL(source);

      const main = program.functions.find(f => f.name === 'main');
      expect(main).toBeDefined();

      // Should have CALL followed by STORE_BYTE
      const call = countOpcode(main!.instructions, ILOpcode.CALL);
      const store = countOpcode(main!.instructions, ILOpcode.STORE_BYTE);

      expect(call).toBe(1);
      expect(store).toBeGreaterThanOrEqual(1);
    });

    it('should use function return value in expression', () => {
      const source = `
        module Test;
        
        function getBase(): byte {
          return 10;
        }
        
        function main(): void {
          let result: byte = getBase() + 5;
        }
      `;

      const program = compileToIL(source);

      const main = program.functions.find(f => f.name === 'main');
      expect(main).toBeDefined();

      // Should have CALL and ADD_IMM
      const call = countOpcode(main!.instructions, ILOpcode.CALL);
      const addImm = countOpcode(main!.instructions, ILOpcode.ADD_IMM);

      expect(call).toBe(1);
      expect(addImm).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============================================================================
// E2E Tests: Nested Function Calls
// ============================================================================

describe('E2E: Functions - Nested Calls', () => {
  it('should handle chain of function calls', () => {
    const source = `
      module Test;
      
      function main(): void {
        let mainVar: byte = 0;
        outer();
      }
      
      function outer(): void {
        let outerVar: byte = 1;
        middle();
      }
      
      function middle(): void {
        let middleVar: byte = 2;
        inner();
      }
      
      function inner(): void {
        let innerVar: byte = 3;
      }
    `;

    const program = compileToIL(source);

    expect(program.functions.length).toBe(4);

    // main calls outer
    const main = program.functions.find(f => f.name === 'main');
    expect(countOpcode(main!.instructions, ILOpcode.CALL)).toBe(1);

    // outer calls middle
    const outer = program.functions.find(f => f.name === 'outer');
    expect(countOpcode(outer!.instructions, ILOpcode.CALL)).toBe(1);

    // middle calls inner
    const middle = program.functions.find(f => f.name === 'middle');
    expect(countOpcode(middle!.instructions, ILOpcode.CALL)).toBe(1);

    // inner doesn't call anything
    const inner = program.functions.find(f => f.name === 'inner');
    expect(countOpcode(inner!.instructions, ILOpcode.CALL)).toBe(0);
  });

  it('should handle nested call with return values', () => {
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

    const program = compileToIL(source);

    const outer = program.functions.find(f => f.name === 'outer');
    expect(outer).toBeDefined();

    // outer calls inner and adds to result
    const call = countOpcode(outer!.instructions, ILOpcode.CALL);
    const addImm = countOpcode(outer!.instructions, ILOpcode.ADD_IMM);

    expect(call).toBe(1);
    expect(addImm).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E Tests: Functions with Local Variables
// ============================================================================

describe('E2E: Functions - Local Variables', () => {
  it('should allocate locals in function frame', () => {
    const source = `
      module Test;
      
      function compute(): byte {
        let a: byte = 1;
        let b: byte = 2;
        let c: byte = 3;
        return a + b + c;
      }
      
      function main(): void {
        let result: byte = compute();
      }
    `;

    const program = compileToIL(source);

    const compute = program.functions.find(f => f.name === 'compute');
    expect(compute).toBeDefined();

    // Should have 3 STORE_BYTE for initializing locals
    const storeCount = countOpcode(compute!.instructions, ILOpcode.STORE_BYTE);
    expect(storeCount).toBeGreaterThanOrEqual(3);
  });

  it('should handle locals and parameters together', () => {
    const source = `
      module Test;
      
      function addWithLocal(a: byte, b: byte): byte {
        let sum: byte = a + b;
        return sum;
      }
      
      function main(): void {
        let result: byte = addWithLocal(10, 20);
      }
    `;

    const program = compileToIL(source);

    const addWithLocal = program.functions.find(f => f.name === 'addWithLocal');
    expect(addWithLocal).toBeDefined();

    // Get parameter slots from frame
    const paramSlots = addWithLocal!.frame.slots.filter(s => s.kind === SlotKind.Parameter);
    expect(paramSlots.length).toBe(2);

    // Should have ADD for a + b
    const hasAdd =
      countOpcode(addWithLocal!.instructions, ILOpcode.ADD_BYTE) > 0 ||
      countOpcode(addWithLocal!.instructions, ILOpcode.ADD_IMM) > 0;
    expect(hasAdd).toBe(true);
  });
});

// ============================================================================
// E2E Tests: Program Structure
// ============================================================================

describe('E2E: Functions - Program Structure', () => {
  it('should count all functions', () => {
    const source = `
      module Test;
      
      function a(): void {}
      function b(): void {}
      function c(): void {}
      
      function main(): void {
        a();
        b();
        c();
      }
    `;

    const program = compileToIL(source);
    expect(program.functions.length).toBe(4);
  });

  it('should preserve function order', () => {
    const source = `
      module Test;
      
      function first(): void {}
      function second(): void {}
      function main(): void {}
    `;

    const program = compileToIL(source);

    // Functions should be in declaration order
    expect(program.functions[0].name).toBe('first');
    expect(program.functions[1].name).toBe('second');
    expect(program.functions[2].name).toBe('main');
  });

  it('should track total instruction count across all functions', () => {
    const source = `
      module Test;
      
      function helper(): byte {
        return 1;
      }
      
      function main(): void {
        let x: byte = helper();
        let y: byte = helper();
      }
    `;

    const program = compileToIL(source);

    // Total instruction count should include all functions
    expect(program.instructionCount).toBeGreaterThan(0);

    const totalFromFunctions = program.functions.reduce(
      (sum, fn) => sum + fn.instructions.length,
      0
    );
    expect(program.instructionCount).toBe(totalFromFunctions);
  });
});
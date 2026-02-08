/**
 * IL Generator Integration Test: SFA → IL
 *
 * Tests that verify the IL Generator correctly uses SFA (Static Frame Allocation)
 * information - slots, addresses, and frame structures.
 *
 * @module __tests__/il/integration/sfa-to-il
 */

import { describe, it, expect } from 'vitest';

// Lexer
import { Lexer } from '../../../lexer/index.js';

// Parser
import { Parser } from '../../../parser/index.js';

// Semantic
import { SemanticAnalyzer } from '../../../semantic/index.js';

// Frame types
import { SlotKind } from '../../../frame/enums.js';

// IL Generator
import { ILGenerator, ILOpcode } from '../../../il/index.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Compiles source code and returns both IL program and frame map.
 */
function compileWithFrames(source: string) {
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
    throw new Error('Frame allocation failed');
  }

  const ilGenerator = new ILGenerator(analysisResult.frameMap, analysisResult.symbolTable);
  const program = ilGenerator.generate(ast);

  return { program, frameMap: analysisResult.frameMap };
}

// ============================================================================
// Integration Tests: SFA → IL
// ============================================================================

describe('Integration: SFA → IL', () => {
  describe('Frame Preservation', () => {
    it('should preserve frame from SFA in ILFunction', () => {
      const source = `
        module Test;
        function main(): void {
          let x: byte = 1;
        }
      `;
      const { program, frameMap } = compileWithFrames(source);

      const mainFunc = program.functions.find(f => f.name === 'main')!;
      expect(mainFunc.frame).toBeDefined();

      // Frame should have the local variable slot
      const localSlots = mainFunc.frame.slots.filter(s => s.kind === SlotKind.Local);
      expect(localSlots.length).toBeGreaterThanOrEqual(1);
    });

    it('should use frame slots for variable storage', () => {
      const source = `
        module Test;
        function main(): void {
          let counter: byte = 100;
          let result: byte = counter;
        }
      `;
      const { program } = compileWithFrames(source);

      const mainFunc = program.functions.find(f => f.name === 'main')!;

      // Should have slots for counter and result
      const localSlots = mainFunc.frame.slots.filter(s => s.kind === SlotKind.Local);
      expect(localSlots.length).toBe(2);
      expect(localSlots.some(s => s.name === 'counter')).toBe(true);
      expect(localSlots.some(s => s.name === 'result')).toBe(true);
    });
  });

  describe('Parameter Slots', () => {
    it('should have parameter slots in frame', () => {
      const source = `
        module Test;
        function add(a: byte, b: byte): byte {
          return a + b;
        }
        function main(): void {
          let x: byte = add(1, 2);
        }
      `;
      const { program } = compileWithFrames(source);

      const addFunc = program.functions.find(f => f.name === 'add')!;
      const paramSlots = addFunc.frame.slots.filter(s => s.kind === SlotKind.Parameter);

      expect(paramSlots.length).toBe(2);
      expect(paramSlots[0].name).toBe('a');
      expect(paramSlots[1].name).toBe('b');
    });

    it('should load parameters from frame slots', () => {
      const source = `
        module Test;
        function double(n: byte): byte {
          return n + n;
        }
        function main(): void {
          let x: byte = double(5);
        }
      `;
      const { program } = compileWithFrames(source);

      const doubleFunc = program.functions.find(f => f.name === 'double')!;

      // Should have LOAD_BYTE instructions for parameter access
      const loadByte = doubleFunc.instructions.filter(i => i.opcode === ILOpcode.LOAD_BYTE);
      expect(loadByte.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Return Slots', () => {
    it('should have return slot for non-void function', () => {
      const source = `
        module Test;
        function getValue(): byte {
          return 42;
        }
        function main(): void {
          let x: byte = getValue();
        }
      `;
      const { program } = compileWithFrames(source);

      const getValueFunc = program.functions.find(f => f.name === 'getValue')!;
      const returnSlots = getValueFunc.frame.slots.filter(s => s.kind === SlotKind.Return);

      expect(returnSlots.length).toBe(1);
    });

    it('should not have return slot for void function', () => {
      const source = `
        module Test;
        function doNothing(): void {}
        function main(): void { doNothing(); }
      `;
      const { program } = compileWithFrames(source);

      const doNothingFunc = program.functions.find(f => f.name === 'doNothing')!;
      const returnSlots = doNothingFunc.frame.slots.filter(s => s.kind === SlotKind.Return);

      expect(returnSlots.length).toBe(0);
    });
  });

  describe('Frame Size', () => {
    it('should calculate frame size from slots', () => {
      const source = `
        module Test;
        function main(): void {
          let a: byte = 1;
          let b: byte = 2;
          let c: byte = 3;
        }
      `;
      const { program } = compileWithFrames(source);

      const mainFunc = program.functions.find(f => f.name === 'main')!;

      // 3 bytes for 3 byte variables
      expect(mainFunc.frame.totalSize).toBe(3);
    });

    it('should include parameters in frame size', () => {
      const source = `
        module Test;
        function sum(a: byte, b: byte): byte {
          let result: byte = a + b;
          return result;
        }
        function main(): void {
          let x: byte = sum(1, 2);
        }
      `;
      const { program } = compileWithFrames(source);

      const sumFunc = program.functions.find(f => f.name === 'sum')!;

      // 2 params (2 bytes) + 1 local (1 byte) + 1 return (1 byte) = 4 bytes
      expect(sumFunc.frame.totalSize).toBe(4);
    });
  });

  describe('Function Metadata', () => {
    it('should preserve isExported flag', () => {
      const source = `
        module Test;
        export function publicFunc(): void {}
        function privateFunc(): void {}
        function main(): void { publicFunc(); privateFunc(); }
      `;
      const { program } = compileWithFrames(source);

      const publicFunc = program.functions.find(f => f.name === 'publicFunc')!;
      const privateFunc = program.functions.find(f => f.name === 'privateFunc')!;

      expect(publicFunc.isExported).toBe(true);
      expect(privateFunc.isExported).toBe(false);
    });
  });

  describe('Multi-Function Programs', () => {
    it('should create separate frames for each function', () => {
      const source = `
        module Test;
        function a(): void { let ax: byte = 1; }
        function b(): void { let bx: byte = 2; let by: byte = 3; }
        function main(): void { a(); b(); }
      `;
      const { program } = compileWithFrames(source);

      expect(program.functions.length).toBe(3);

      const aFunc = program.functions.find(f => f.name === 'a')!;
      const bFunc = program.functions.find(f => f.name === 'b')!;

      // Each function has its own frame
      expect(aFunc.frame.functionName).toBe('a');
      expect(bFunc.frame.functionName).toBe('b');

      // Frame sizes differ
      expect(aFunc.frame.totalSize).toBe(1);
      expect(bFunc.frame.totalSize).toBe(2);
    });
  });

  describe('Slot Operands in IL', () => {
    it('should reference correct slot in LOAD_BYTE operand', () => {
      const source = `
        module Test;
        function main(): void {
          let x: byte = 10;
          let y: byte = x;
        }
      `;
      const { program } = compileWithFrames(source);

      const mainFunc = program.functions.find(f => f.name === 'main')!;

      // Find LOAD_BYTE instructions
      const loadBytes = mainFunc.instructions.filter(i => i.opcode === ILOpcode.LOAD_BYTE);
      expect(loadBytes.length).toBeGreaterThanOrEqual(1);

      // The operand should reference the 'x' slot
      const loadX = loadBytes.find(i => {
        if (i.operands.length > 0 && 'slot' in i.operands[0]) {
          return i.operands[0].slot?.name === 'x';
        }
        return false;
      });
      expect(loadX).toBeDefined();
    });

    it('should reference correct slot in STORE_BYTE operand', () => {
      const source = `
        module Test;
        function main(): void {
          let counter: byte = 42;
        }
      `;
      const { program } = compileWithFrames(source);

      const mainFunc = program.functions.find(f => f.name === 'main')!;

      // Find STORE_BYTE instructions
      const storeBytes = mainFunc.instructions.filter(i => i.opcode === ILOpcode.STORE_BYTE);
      expect(storeBytes.length).toBeGreaterThanOrEqual(1);

      // The operand should reference the 'counter' slot
      const storeCounter = storeBytes.find(i => {
        if (i.operands.length > 0 && 'slot' in i.operands[0]) {
          return i.operands[0].slot?.name === 'counter';
        }
        return false;
      });
      expect(storeCounter).toBeDefined();
    });
  });
});
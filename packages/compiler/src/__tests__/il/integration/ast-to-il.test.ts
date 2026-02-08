/**
 * IL Generator Integration Test: AST → IL
 *
 * Tests that verify specific AST node types are correctly
 * transformed to corresponding IL instructions.
 *
 * @module __tests__/il/integration/ast-to-il
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

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Compiles source code to IL program through the full pipeline.
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
    throw new Error('Frame allocation failed - no frameMap');
  }

  const ilGenerator = new ILGenerator(analysisResult.frameMap, analysisResult.symbolTable);
  return ilGenerator.generate(ast);
}

/**
 * Finds instructions with specific opcode.
 */
function findOpcodes(instructions: { opcode: ILOpcode }[], opcode: ILOpcode) {
  return instructions.filter(i => i.opcode === opcode);
}

// ============================================================================
// Integration Tests: AST → IL Mapping
// ============================================================================

describe('Integration: AST → IL Mapping', () => {
  describe('LiteralExpression → LOAD_IMM', () => {
    it('should map number literal to LOAD_IMM', () => {
      const source = `
        module Test;
        function main(): void {
          let x: byte = 42;
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const loadImm = findOpcodes(main.instructions, ILOpcode.LOAD_IMM);

      expect(loadImm.length).toBeGreaterThanOrEqual(1);
    });

    it('should map hex literal to LOAD_IMM', () => {
      const source = `
        module Test;
        function main(): void {
          let x: byte = $FF;
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const loadImm = findOpcodes(main.instructions, ILOpcode.LOAD_IMM);

      expect(loadImm.length).toBeGreaterThanOrEqual(1);
    });

    it('should map boolean literal to LOAD_IMM 0 or 1', () => {
      const source = `
        module Test;
        function main(): void {
          let x: bool = true;
          let y: bool = false;
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const loadImm = findOpcodes(main.instructions, ILOpcode.LOAD_IMM);

      expect(loadImm.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('IdentifierExpression → LOAD_BYTE', () => {
    it('should map variable reference to LOAD_BYTE', () => {
      const source = `
        module Test;
        function main(): void {
          let x: byte = 10;
          let y: byte = x;
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const loadByte = findOpcodes(main.instructions, ILOpcode.LOAD_BYTE);

      expect(loadByte.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('BinaryExpression → Arithmetic Ops', () => {
    it('should map + to ADD_IMM for literal operand', () => {
      const source = `
        module Test;
        function main(): void {
          let x: byte = 10 + 5;
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const addImm = findOpcodes(main.instructions, ILOpcode.ADD_IMM);

      expect(addImm.length).toBeGreaterThanOrEqual(1);
    });

    it('should map + to ADD_BYTE for variable operand', () => {
      const source = `
        module Test;
        function main(): void {
          let a: byte = 10;
          let b: byte = 5;
          let c: byte = a + b;
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const addByte = findOpcodes(main.instructions, ILOpcode.ADD_BYTE);

      expect(addByte.length).toBeGreaterThanOrEqual(1);
    });

    it('should map - to SUB_IMM for literal operand', () => {
      const source = `
        module Test;
        function main(): void {
          let x: byte = 10 - 3;
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const subImm = findOpcodes(main.instructions, ILOpcode.SUB_IMM);

      expect(subImm.length).toBeGreaterThanOrEqual(1);
    });

    it('should map & to AND_IMM for literal operand', () => {
      const source = `
        module Test;
        function main(): void {
          let x: byte = $FF & $0F;
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const andImm = findOpcodes(main.instructions, ILOpcode.AND_IMM);

      expect(andImm.length).toBeGreaterThanOrEqual(1);
    });

    it('should map | to OR_IMM for literal operand', () => {
      const source = `
        module Test;
        function main(): void {
          let x: byte = $F0 | $0F;
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const orImm = findOpcodes(main.instructions, ILOpcode.OR_IMM);

      expect(orImm.length).toBeGreaterThanOrEqual(1);
    });

    it('should map ^ to XOR_IMM for literal operand', () => {
      const source = `
        module Test;
        function main(): void {
          let x: byte = $AA ^ $55;
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const xorImm = findOpcodes(main.instructions, ILOpcode.XOR_IMM);

      expect(xorImm.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('AssignmentExpression → STORE_BYTE', () => {
    it('should map simple assignment to STORE_BYTE', () => {
      const source = `
        module Test;
        function main(): void {
          let x: byte = 0;
          x = 42;
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const storeByte = findOpcodes(main.instructions, ILOpcode.STORE_BYTE);

      // At least 2: initial assignment + reassignment
      expect(storeByte.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('VariableDeclaration → LOAD + STORE sequence', () => {
    it('should generate LOAD_IMM + STORE_BYTE for initialized variable', () => {
      const source = `
        module Test;
        function main(): void {
          let counter: byte = 100;
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const loadImm = findOpcodes(main.instructions, ILOpcode.LOAD_IMM);
      const storeByte = findOpcodes(main.instructions, ILOpcode.STORE_BYTE);

      expect(loadImm.length).toBeGreaterThanOrEqual(1);
      expect(storeByte.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ReturnStatement → RETURN opcode', () => {
    it('should map return to RETURN opcode', () => {
      const source = `
        module Test;
        function getValue(): byte {
          return 42;
        }
        function main(): void {
          let x: byte = getValue();
        }
      `;
      const program = compileToIL(source);
      const getValue = program.functions.find(f => f.name === 'getValue')!;
      const ret = findOpcodes(getValue.instructions, ILOpcode.RETURN);

      expect(ret.length).toBe(1);
    });

    it('should generate LOAD_IMM before RETURN for value return', () => {
      const source = `
        module Test;
        function getValue(): byte {
          return 99;
        }
        function main(): void {
          let x: byte = getValue();
        }
      `;
      const program = compileToIL(source);
      const getValue = program.functions.find(f => f.name === 'getValue')!;
      const loadImm = findOpcodes(getValue.instructions, ILOpcode.LOAD_IMM);

      expect(loadImm.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CallExpression → CALL opcode', () => {
    it('should map function call to CALL opcode', () => {
      const source = `
        module Test;
        function helper(): void {}
        function main(): void {
          helper();
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;
      const call = findOpcodes(main.instructions, ILOpcode.CALL);

      expect(call.length).toBe(1);
    });
  });

  describe('IfStatement → CMP + conditional JUMP', () => {
    it('should generate comparison and conditional jump for if', () => {
      const source = `
        module Test;
        function main(): void {
          let x: byte = 10;
          if (x == 5) {
            x = 0;
          }
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;

      const hasJump =
        findOpcodes(main.instructions, ILOpcode.JUMP_EQ).length > 0 ||
        findOpcodes(main.instructions, ILOpcode.JUMP_NE).length > 0;
      expect(hasJump).toBe(true);
    });
  });

  describe('WhileStatement → JUMP + conditional back-edge', () => {
    it('should generate jump for while loop', () => {
      const source = `
        module Test;
        function main(): void {
          let i: byte = 0;
          while (i < 10) {
            i = i + 1;
          }
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;

      const jump = findOpcodes(main.instructions, ILOpcode.JUMP);
      expect(jump.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ForStatement → counted loop IL', () => {
    it('should generate for loop IL structure', () => {
      const source = `
        module Test;
        function main(): void {
          for (let i: byte = 0 to 5 step 1) {
            let temp: byte = i;
          }
        }
      `;
      const program = compileToIL(source);
      const main = program.functions.find(f => f.name === 'main')!;

      // Should have increment (INC_BYTE or ADD_IMM) and jump
      const hasIncrement =
        findOpcodes(main.instructions, ILOpcode.INC_BYTE).length > 0 ||
        findOpcodes(main.instructions, ILOpcode.ADD_IMM).length > 0;
      const jump = findOpcodes(main.instructions, ILOpcode.JUMP);

      expect(hasIncrement).toBe(true);
      expect(jump.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Integration: Program Structure', () => {
  it('should preserve module name in ILProgram', () => {
    const source = `
      module MyGame.Logic;
      function main(): void {}
    `;
    const program = compileToIL(source);
    expect(program.moduleName).toBe('MyGame.Logic');
  });

  it('should set entryPoint to main', () => {
    const source = `
      module Test;
      function helper(): void {}
      function main(): void { helper(); }
    `;
    const program = compileToIL(source);
    expect(program.entryPoint).toBe('main');
  });

  it('should include all functions in ILProgram', () => {
    const source = `
      module Test;
      function a(): void {}
      function b(): void {}
      function c(): void {}
      function main(): void {}
    `;
    const program = compileToIL(source);
    expect(program.functions.length).toBe(4);
  });

  it('should calculate total instruction count', () => {
    const source = `
      module Test;
      function main(): void {
        let x: byte = 1 + 2;
      }
    `;
    const program = compileToIL(source);
    expect(program.instructionCount).toBeGreaterThan(0);
  });
});
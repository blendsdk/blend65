/**
 * IL Generator E2E Test: Simple Add
 *
 * End-to-end test that verifies the complete pipeline from
 * source code to IL instructions for simple addition operations.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame Allocator → IL Generator
 *
 * @module __tests__/il/e2e/simple-add
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
 *
 * The SemanticAnalyzer with runFrameAllocation: true (default) performs:
 * - Symbol table building
 * - Type resolution
 * - Type checking
 * - Control flow analysis
 * - Call graph & recursion detection
 * - Frame allocation
 *
 * @param source - Blend source code
 * @returns IL program or throws on error
 */
function compileToIL(source: string) {
  // Step 1: Lexer
  const lexer = new Lexer(source, 'test.blend');
  const tokens = lexer.tokenize();

  // Step 2: Parser
  const parser = new Parser(tokens, { filename: 'test.blend' });
  const ast = parser.parse();

  // Step 3: Semantic Analysis (includes frame allocation)
  const semanticAnalyzer = new SemanticAnalyzer({
    runFrameAllocation: true,
    runAdvancedAnalysis: false, // Skip for faster E2E tests
  });
  const analysisResult = semanticAnalyzer.analyze(ast);

  // Check for errors
  const errors = analysisResult.diagnostics.filter(d => d.severity === 0); // 0 = ERROR
  if (errors.length > 0) {
    throw new Error(`Semantic errors: ${errors.map(e => e.message).join(', ')}`);
  }

  // Frame map is already computed by SemanticAnalyzer
  if (!analysisResult.frameMap) {
    throw new Error('Frame allocation failed - no frameMap in analysis result');
  }

  // Step 4: IL Generation
  const ilGenerator = new ILGenerator(analysisResult.frameMap, analysisResult.symbolTable);
  return ilGenerator.generate(ast);
}

/**
 * Counts occurrences of a specific opcode in an IL function.
 */
function countOpcode(instructions: { opcode: ILOpcode }[], opcode: ILOpcode): number {
  return instructions.filter(i => i.opcode === opcode).length;
}

/**
 * Finds all instructions with a specific opcode.
 */
function findOpcodes(instructions: { opcode: ILOpcode }[], opcode: ILOpcode) {
  return instructions.filter(i => i.opcode === opcode);
}

// ============================================================================
// E2E Tests: Simple Add Operations
// ============================================================================

describe('E2E: Simple Add - Source to IL', () => {
  describe('constant addition', () => {
    it('should compile "let x: byte = 1 + 2" to IL with ADD_IMM', () => {
      const source = `
        module Test;
        
        function main(): void {
          let x: byte = 1 + 2;
        }
      `;

      const program = compileToIL(source);

      expect(program).toBeDefined();
      expect(program.functions.length).toBeGreaterThanOrEqual(1);

      const mainFunc = program.functions.find(f => f.name === 'main');
      expect(mainFunc).toBeDefined();

      // Should have LOAD_IMM for 1, ADD_IMM for + 2, and STORE_BYTE for x
      const loadImm = findOpcodes(mainFunc!.instructions, ILOpcode.LOAD_IMM);
      const addImm = findOpcodes(mainFunc!.instructions, ILOpcode.ADD_IMM);
      const storeByte = findOpcodes(mainFunc!.instructions, ILOpcode.STORE_BYTE);

      expect(loadImm.length).toBeGreaterThanOrEqual(1);
      expect(addImm.length).toBeGreaterThanOrEqual(1);
      expect(storeByte.length).toBeGreaterThanOrEqual(1);
    });

    it('should compile multiple additions "let x: byte = 1 + 2 + 3"', () => {
      const source = `
        module Test;
        
        function main(): void {
          let x: byte = 1 + 2 + 3;
        }
      `;

      const program = compileToIL(source);
      const mainFunc = program.functions.find(f => f.name === 'main');

      // Should have multiple ADD_IMM instructions
      const addCount = countOpcode(mainFunc!.instructions, ILOpcode.ADD_IMM);
      expect(addCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('variable addition', () => {
    it('should compile "let y: byte = x + 5" with slot access', () => {
      const source = `
        module Test;
        
        function main(): void {
          let x: byte = 10;
          let y: byte = x + 5;
        }
      `;

      const program = compileToIL(source);
      const mainFunc = program.functions.find(f => f.name === 'main');

      // Should have LOAD_BYTE to read x, ADD_IMM for + 5
      const loadByte = countOpcode(mainFunc!.instructions, ILOpcode.LOAD_BYTE);
      const addImm = countOpcode(mainFunc!.instructions, ILOpcode.ADD_IMM);

      expect(loadByte).toBeGreaterThanOrEqual(1);
      expect(addImm).toBeGreaterThanOrEqual(1);
    });

    it('should compile "let z: byte = x + y" with ADD_BYTE', () => {
      const source = `
        module Test;
        
        function main(): void {
          let x: byte = 10;
          let y: byte = 20;
          let z: byte = x + y;
        }
      `;

      const program = compileToIL(source);
      const mainFunc = program.functions.find(f => f.name === 'main');

      // Should have ADD_BYTE for x + y
      const addByte = countOpcode(mainFunc!.instructions, ILOpcode.ADD_BYTE);
      expect(addByte).toBeGreaterThanOrEqual(1);
    });
  });

  describe('mixed arithmetic', () => {
    it('should compile "let result: byte = (a + b) - c"', () => {
      const source = `
        module Test;
        
        function main(): void {
          let a: byte = 10;
          let b: byte = 5;
          let c: byte = 3;
          let result: byte = (a + b) - c;
        }
      `;

      const program = compileToIL(source);
      const mainFunc = program.functions.find(f => f.name === 'main');

      // Should have both ADD and SUB operations
      const hasAdd =
        countOpcode(mainFunc!.instructions, ILOpcode.ADD_BYTE) > 0 ||
        countOpcode(mainFunc!.instructions, ILOpcode.ADD_IMM) > 0;
      const hasSub =
        countOpcode(mainFunc!.instructions, ILOpcode.SUB_BYTE) > 0 ||
        countOpcode(mainFunc!.instructions, ILOpcode.SUB_IMM) > 0;

      expect(hasAdd).toBe(true);
      expect(hasSub).toBe(true);
    });

    it('should compile hex literals "let x: byte = $10 + $20"', () => {
      const source = `
        module Test;
        
        function main(): void {
          let x: byte = $10 + $20;
        }
      `;

      const program = compileToIL(source);
      expect(program.functions.length).toBeGreaterThanOrEqual(1);

      const mainFunc = program.functions.find(f => f.name === 'main');
      const loadImm = findOpcodes(mainFunc!.instructions, ILOpcode.LOAD_IMM);

      // Should have load for $10 (16 decimal)
      expect(loadImm.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('program structure', () => {
    it('should identify main as entry point', () => {
      const source = `
        module Test;
        
        function helper(): byte {
          return 1;
        }
        
        function main(): void {
          let x: byte = 1 + 1;
        }
      `;

      const program = compileToIL(source);
      expect(program.entryPoint).toBe('main');
    });

    it('should track module name', () => {
      const source = `
        module Game.Logic;
        
        function main(): void {
          let x: byte = 1;
        }
      `;

      const program = compileToIL(source);
      expect(program.moduleName).toBe('Game.Logic');
    });

    it('should count total instructions', () => {
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
});

describe('E2E: Simple Add - Instruction Verification', () => {
  it('should generate proper instruction sequence for simple add', () => {
    const source = `
      module Test;
      
      function main(): void {
        let result: byte = 5 + 3;
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');
    const instructions = mainFunc!.instructions;

    // Verify instruction sequence: LOAD_IMM 5, ADD_IMM 3, STORE_BYTE result, RETURN
    let foundLoad = false;
    let foundAdd = false;
    let foundStore = false;
    let foundReturn = false;

    for (const inst of instructions) {
      if (inst.opcode === ILOpcode.LOAD_IMM) foundLoad = true;
      if (inst.opcode === ILOpcode.ADD_IMM) foundAdd = true;
      if (inst.opcode === ILOpcode.STORE_BYTE) foundStore = true;
      if (inst.opcode === ILOpcode.RETURN) foundReturn = true;
    }

    expect(foundLoad).toBe(true);
    expect(foundAdd).toBe(true);
    expect(foundStore).toBe(true);
    expect(foundReturn).toBe(true);
  });

  it('should track estimated cycles', () => {
    const source = `
      module Test;
      
      function main(): void {
        let x: byte = 1 + 2;
      }
    `;

    const program = compileToIL(source);
    expect(program.totalEstimatedCycles).toBeGreaterThan(0);
  });
});
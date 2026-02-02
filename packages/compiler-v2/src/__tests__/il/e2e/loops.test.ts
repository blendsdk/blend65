/**
 * IL Generator E2E Test: Loops
 *
 * End-to-end test that verifies the complete pipeline from
 * source code to IL instructions for loop constructs.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame Allocator → IL Generator
 *
 * @module __tests__/il/e2e/loops
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

/**
 * Checks if instruction sequence contains expected pattern.
 */
function hasOpcodeSequence(instructions: { opcode: ILOpcode }[], sequence: ILOpcode[]): boolean {
  const opcodes = instructions.map(i => i.opcode);
  for (let i = 0; i <= opcodes.length - sequence.length; i++) {
    if (sequence.every((op, j) => opcodes[i + j] === op)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// E2E Tests: While Loops
// ============================================================================

describe('E2E: Loops - While Loops', () => {
  it('should compile simple while loop with counter', () => {
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
    const mainFunc = program.functions.find(f => f.name === 'main');
    expect(mainFunc).toBeDefined();

    // Should have LABEL for loop start, CMP for condition, conditional JUMP
    const labels = countOpcode(mainFunc!.instructions, ILOpcode.LABEL);
    const jumps = countOpcode(mainFunc!.instructions, ILOpcode.JUMP);
    const cmpCount =
      countOpcode(mainFunc!.instructions, ILOpcode.CMP_IMM) +
      countOpcode(mainFunc!.instructions, ILOpcode.CMP_BYTE);

    expect(labels).toBeGreaterThanOrEqual(2); // Start label and end label
    expect(jumps).toBeGreaterThanOrEqual(1); // Jump back to start
    expect(cmpCount).toBeGreaterThanOrEqual(1); // Compare i < 10
  });

  it('should compile while loop with break condition check', () => {
    const source = `
      module Test;
      
      function main(): void {
        let x: byte = 100;
        while (x > 0) {
          x = x - 1;
        }
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');

    // Should have comparison operations
    const hasCmp = countOpcode(mainFunc!.instructions, ILOpcode.CMP_IMM) > 0;
    expect(hasCmp).toBe(true);
  });

  it('should compile nested while loops', () => {
    const source = `
      module Test;
      
      function main(): void {
        let i: byte = 0;
        while (i < 5) {
          let j: byte = 0;
          while (j < 5) {
            j = j + 1;
          }
          i = i + 1;
        }
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');

    // Nested loops should have multiple labels and jumps
    const labels = countOpcode(mainFunc!.instructions, ILOpcode.LABEL);
    const jumps = countOpcode(mainFunc!.instructions, ILOpcode.JUMP);

    expect(labels).toBeGreaterThanOrEqual(4); // Outer and inner loop labels
    expect(jumps).toBeGreaterThanOrEqual(2); // Outer and inner loop jumps
  });
});

// ============================================================================
// E2E Tests: For Loops
// ============================================================================

describe('E2E: Loops - For Loops', () => {
  it('should compile simple for loop with counter', () => {
    const source = `
      module Test;
      
      function main(): void {
        for (let i: byte = 0 to 9 step 1) {
          let dummy: byte = i;
        }
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');
    expect(mainFunc).toBeDefined();

    // Should have loop structure: init, condition check, increment, body
    const labels = countOpcode(mainFunc!.instructions, ILOpcode.LABEL);
    const jumps = countOpcode(mainFunc!.instructions, ILOpcode.JUMP);

    expect(labels).toBeGreaterThanOrEqual(2);
    expect(jumps).toBeGreaterThanOrEqual(1);
  });

  it('should compile for loop counting down', () => {
    const source = `
      module Test;
      
      function main(): void {
        for (let i: byte = 10 downto 1 step 1) {
          let dummy: byte = i;
        }
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');

    // Should have decrement operation (DEC_BYTE for step=1, or SUB for larger steps)
    const hasDecrement =
      countOpcode(mainFunc!.instructions, ILOpcode.DEC_BYTE) > 0 ||
      countOpcode(mainFunc!.instructions, ILOpcode.SUB_IMM) > 0 ||
      countOpcode(mainFunc!.instructions, ILOpcode.SUB_BYTE) > 0;
    expect(hasDecrement).toBe(true);
  });

  it('should compile for loop with step > 1', () => {
    const source = `
      module Test;
      
      function main(): void {
        for (let i: byte = 0 to 18 step 2) {
          let dummy: byte = i;
        }
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');

    // Should have ADD with value 2
    const addImms = findOpcodes(mainFunc!.instructions, ILOpcode.ADD_IMM);
    expect(addImms.length).toBeGreaterThanOrEqual(1);
  });

  it('should compile nested for loops', () => {
    const source = `
      module Test;
      
      function main(): void {
        for (let y: byte = 0 to 7 step 1) {
          for (let x: byte = 0 to 7 step 1) {
            let pos: byte = y * 8 + x;
          }
        }
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');

    // Nested loops should have multiple labels and jumps
    const labels = countOpcode(mainFunc!.instructions, ILOpcode.LABEL);
    expect(labels).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================================
// E2E Tests: Loop Control Flow
// ============================================================================

describe('E2E: Loops - Control Flow', () => {
  it('should generate conditional jumps for loop condition', () => {
    const source = `
      module Test;
      
      function main(): void {
        let i: byte = 0;
        while (i != 0) {
          i = i + 1;
        }
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');

    // Should have conditional jump (JUMP_EQ, JUMP_NE, etc.)
    const hasConditionalJump =
      countOpcode(mainFunc!.instructions, ILOpcode.JUMP_EQ) > 0 ||
      countOpcode(mainFunc!.instructions, ILOpcode.JUMP_NE) > 0 ||
      countOpcode(mainFunc!.instructions, ILOpcode.JUMP_LT) > 0 ||
      countOpcode(mainFunc!.instructions, ILOpcode.JUMP_GE) > 0 ||
      countOpcode(mainFunc!.instructions, ILOpcode.JUMP_GT) > 0 ||
      countOpcode(mainFunc!.instructions, ILOpcode.JUMP_LE) > 0;

    expect(hasConditionalJump).toBe(true);
  });

  it('should generate proper loop structure with labels', () => {
    const source = `
      module Test;
      
      function main(): void {
        for (let i: byte = 0 to 4 step 1) {
          let x: byte = 1;
        }
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');

    // Loop structure: LABEL (start) ... JUMP (back) ... LABEL (end)
    const labels = findOpcodes(mainFunc!.instructions, ILOpcode.LABEL);
    const jumps = findOpcodes(mainFunc!.instructions, ILOpcode.JUMP);

    expect(labels.length).toBeGreaterThanOrEqual(2);
    expect(jumps.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// E2E Tests: Loop with Memory Operations
// ============================================================================

describe('E2E: Loops - Memory Operations', () => {
  it('should compile loop with array-like indexed access', () => {
    const source = `
      module Test;
      
      function main(): void {
        let sum: byte = 0;
        for (let i: byte = 0 to 9 step 1) {
          sum = sum + i;
        }
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');

    // Should have ADD operations inside loop
    const hasAdd =
      countOpcode(mainFunc!.instructions, ILOpcode.ADD_BYTE) > 0 ||
      countOpcode(mainFunc!.instructions, ILOpcode.ADD_IMM) > 0;
    expect(hasAdd).toBe(true);
  });

  it('should compile loop with multiple variable accesses', () => {
    const source = `
      module Test;
      
      function main(): void {
        let a: byte = 0;
        let b: byte = 1;
        for (let i: byte = 0 to 9 step 1) {
          let temp: byte = a;
          a = b;
          b = temp + a;
        }
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');

    // Should have multiple LOAD_BYTE and STORE_BYTE operations
    const loadCount = countOpcode(mainFunc!.instructions, ILOpcode.LOAD_BYTE);
    const storeCount = countOpcode(mainFunc!.instructions, ILOpcode.STORE_BYTE);

    expect(loadCount).toBeGreaterThanOrEqual(2);
    expect(storeCount).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// E2E Tests: Loop Statistics
// ============================================================================

describe('E2E: Loops - Statistics', () => {
  it('should track loop structures in IL program', () => {
    const source = `
      module Test;
      
      function main(): void {
        for (let i: byte = 0 to 9 step 1) {
          let x: byte = i;
        }
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');

    // The function should have loop metadata
    expect(mainFunc!.loops).toBeDefined();
    expect(mainFunc!.loops.length).toBeGreaterThanOrEqual(1);
  });

  it('should track nested loop depth', () => {
    const source = `
      module Test;
      
      function main(): void {
        for (let i: byte = 0 to 4 step 1) {
          for (let j: byte = 0 to 4 step 1) {
            let x: byte = i + j;
          }
        }
      }
    `;

    const program = compileToIL(source);
    const mainFunc = program.functions.find(f => f.name === 'main');

    // Should have at least 2 loops
    expect(mainFunc!.loops.length).toBeGreaterThanOrEqual(2);
  });

  it('should count instructions correctly with loops', () => {
    const source = `
      module Test;
      
      function main(): void {
        for (let i: byte = 0 to 9 step 1) {
          let x: byte = i;
        }
      }
    `;

    const program = compileToIL(source);
    expect(program.instructionCount).toBeGreaterThan(0);
    expect(program.totalEstimatedCycles).toBeGreaterThan(0);
  });
});
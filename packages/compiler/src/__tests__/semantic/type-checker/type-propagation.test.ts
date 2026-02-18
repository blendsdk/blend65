/**
 * @file Type Propagation Tests (Item D)
 *
 * Tests that the type checker's `setExpressionType()` correctly propagates
 * resolved type info onto AST Expression nodes via `expr.setTypeInfo()`.
 *
 * After semantic analysis, every expression node should have `getTypeInfo()`
 * returning the correct TypeInfo. This enables downstream passes (e.g., IL
 * generator) to query type info directly instead of relying on heuristics.
 *
 * Bug context (Item D from armenian-charset-compiler-fixes):
 * - Before the fix, `setExpressionType()` only stored type info in a local map
 * - The fix added `expr.setTypeInfo(type)` so the AST node itself carries the type
 * - This allows the IL generator to call `expr.getTypeInfo()` directly
 *
 * @module __tests__/semantic/type-checker/type-propagation
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import type { Program, Expression, Declaration } from '../../../ast/index.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { TypeKind } from '../../../semantic/types.js';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parses source into a Program AST
 */
function parseProgram(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Runs full semantic analysis on source code and returns the analyzed Program.
 * After analysis, expression nodes should have type info set via setTypeInfo().
 */
function analyzeAndGetProgram(source: string): Program {
  const program = parseProgram(source);
  const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  const result = analyzer.analyze(program);
  // Ensure no errors so type info was fully propagated
  expect(result.success).toBe(true);
  return program;
}

/**
 * Extracts the initializer expression from a variable declaration
 * inside a function body.
 *
 * Navigates: Program → FunctionDeclaration(funcIndex) → body[varIndex] → getInitializer()
 *
 * @param program - The analyzed program AST
 * @param funcIndex - Index of the function declaration (0 = first function)
 * @param varIndex - Index of the variable declaration inside the function body
 */
function getVarInitializer(program: Program, funcIndex: number, varIndex: number): Expression {
  const decls = program.getDeclarations();
  // Find the Nth function declaration
  let funcCount = 0;
  for (const decl of decls) {
    // Check if this is a function declaration by looking for getBody()
    if ('getBody' in decl && typeof (decl as { getBody: () => unknown }).getBody === 'function') {
      const body = (decl as { getBody: () => unknown[] | null }).getBody();
      if (body !== null) {
        if (funcCount === funcIndex) {
          const stmt = body[varIndex] as Declaration;
          expect(stmt).toBeDefined();

          // Try to get initializer directly (VariableDeclaration)
          if ('getInitializer' in stmt && typeof (stmt as { getInitializer: () => Expression | null }).getInitializer === 'function') {
            const init = (stmt as { getInitializer: () => Expression | null }).getInitializer();
            expect(init).not.toBeNull();
            return init!;
          }

          throw new Error(`Statement at index ${varIndex} does not have getInitializer()`);
        }
        funcCount++;
      }
    }
  }
  throw new Error(`Function at index ${funcIndex} not found`);
}

// ============================================================================
// Literal Type Propagation
// ============================================================================

describe('Type Propagation: Literal Expressions', () => {

  it('should propagate byte type onto numeric literal (42)', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let x: byte = 42;
      }
    `);

    const init = getVarInitializer(program, 0, 0);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Byte);
    expect(typeInfo!.name).toBe('byte');
  });

  it('should propagate word type onto numeric literal (1000)', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let w: word = 1000;
      }
    `);

    const init = getVarInitializer(program, 0, 0);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Word);
  });

  it('should propagate bool type onto true literal', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let b: bool = true;
      }
    `);

    const init = getVarInitializer(program, 0, 0);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Bool);
  });

  it('should propagate string type onto string literal', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let s: string = "hello";
      }
    `);

    const init = getVarInitializer(program, 0, 0);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.String);
  });

  it('should propagate word type onto hex literal $D020', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let addr: word = $D020;
      }
    `);

    const init = getVarInitializer(program, 0, 0);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Word);
  });

  it('should propagate byte type onto hex literal $FF', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let mask: byte = $FF;
      }
    `);

    const init = getVarInitializer(program, 0, 0);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Byte);
  });
});

// ============================================================================
// Binary Expression Type Propagation
// ============================================================================

describe('Type Propagation: Binary Expressions', () => {

  it('should propagate byte type onto byte + byte binary expression', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let a: byte = 1;
        let b: byte = 2;
        let c: byte = a + b;
      }
    `);

    // c's initializer (a + b) should have byte type
    const init = getVarInitializer(program, 0, 2);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Byte);
  });

  it('should propagate word type onto word + byte binary expression', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let w: word = 1000;
        let b: byte = 5;
        let r: word = w + b;
      }
    `);

    const init = getVarInitializer(program, 0, 2);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Word);
  });

  it('should propagate bool type onto comparison expression', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let x: byte = 5;
        let y: byte = 10;
        let result: bool = x < y;
      }
    `);

    const init = getVarInitializer(program, 0, 2);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Bool);
  });

  it('should propagate byte type onto bitwise AND expression', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let mask: byte = $0F;
        let val: byte = $AB;
        let result: byte = val & mask;
      }
    `);

    const init = getVarInitializer(program, 0, 2);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Byte);
  });
});

// ============================================================================
// Unary Expression Type Propagation
// ============================================================================

describe('Type Propagation: Unary Expressions', () => {

  it('should propagate bool type onto logical NOT expression', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let flag: bool = true;
        let inv: bool = !flag;
      }
    `);

    const init = getVarInitializer(program, 0, 1);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    // !bool produces bool
    expect(typeInfo!.kind).toBe(TypeKind.Bool);
  });

  it('should propagate byte type onto bitwise NOT expression', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let val: byte = $AA;
        let inv: byte = ~val;
      }
    `);

    const init = getVarInitializer(program, 0, 1);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Byte);
  });

  it('should propagate word type onto address-of expression', () => {
    const program = analyzeAndGetProgram(`
      module test
      @data const buf: byte[] = [1, 2, 3];
      export function main(): void {
        let addr: word = @buf;
      }
    `);

    const init = getVarInitializer(program, 0, 0);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    // Address-of always produces a word (16-bit address)
    expect(typeInfo!.kind).toBe(TypeKind.Word);
  });

  it('should propagate byte type onto negation of byte', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let x: byte = 5;
        let neg: byte = -x;
      }
    `);

    const init = getVarInitializer(program, 0, 1);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Byte);
  });
});

// ============================================================================
// Identifier Expression Type Propagation
// ============================================================================

describe('Type Propagation: Identifier Expressions', () => {

  it('should propagate byte type onto byte identifier reference', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let x: byte = 42;
        let y: byte = x;
      }
    `);

    // y's initializer is an identifier expression referring to x
    const init = getVarInitializer(program, 0, 1);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Byte);
  });

  it('should propagate word type onto word identifier reference', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let addr: word = $D020;
        let copy: word = addr;
      }
    `);

    const init = getVarInitializer(program, 0, 1);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Word);
  });

  it('should propagate bool type onto bool identifier reference', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let flag: bool = true;
        let copy: bool = flag;
      }
    `);

    const init = getVarInitializer(program, 0, 1);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Bool);
  });
});

// ============================================================================
// Function Call Expression Type Propagation
// ============================================================================

describe('Type Propagation: Function Call Expressions', () => {

  it('should propagate byte return type onto function call expression', () => {
    const program = analyzeAndGetProgram(`
      module test
      function getByte(): byte {
        return 42;
      }
      function main(): void {
        let val: byte = getByte();
      }
    `);

    // main is the second function (index 1), its first var decl
    const init = getVarInitializer(program, 1, 0);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Byte);
  });

  it('should propagate word return type onto function call expression', () => {
    const program = analyzeAndGetProgram(`
      module test
      function getAddr(): word {
        return $D020;
      }
      function main(): void {
        let addr: word = getAddr();
      }
    `);

    const init = getVarInitializer(program, 1, 0);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Word);
  });

  it('should propagate bool return type onto function call expression', () => {
    const program = analyzeAndGetProgram(`
      module test
      function isReady(): bool {
        return true;
      }
      function main(): void {
        let ready: bool = isReady();
      }
    `);

    const init = getVarInitializer(program, 1, 0);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Bool);
  });
});

// ============================================================================
// Complex Expression Type Propagation
// ============================================================================

describe('Type Propagation: Complex Expressions', () => {

  it('should propagate word type through @data + byte_var (address arithmetic)', () => {
    const program = analyzeAndGetProgram(`
      module test
      @data const fontData: byte[] = [0, 1, 2, 3, 4, 5, 6, 7];
      export function main(): void {
        let i: byte = 0;
        let addr: word = @fontData + i;
      }
    `);

    // The initializer of addr is a binary expression: @fontData + i
    const init = getVarInitializer(program, 0, 1);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    // @fontData is word, i is byte → result should be word (widened)
    expect(typeInfo!.kind).toBe(TypeKind.Word);
  });

  it('should propagate byte type through nested byte arithmetic', () => {
    const program = analyzeAndGetProgram(`
      module test
      function main(): void {
        let a: byte = 10;
        let b: byte = 20;
        let c: byte = (a + b) & $7F;
      }
    `);

    const init = getVarInitializer(program, 0, 2);
    const typeInfo = init.getTypeInfo();
    expect(typeInfo).toBeDefined();
    expect(typeInfo!.kind).toBe(TypeKind.Byte);
  });
});

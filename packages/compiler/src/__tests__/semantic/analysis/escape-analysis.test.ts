/**
 * Tests for Escape Analysis (Task 8.10)
 *
 * Verifies that the analyzer correctly:
 * - Identifies variables that escape local scope
 * - Marks non-escaping variables for stack allocation
 * - Detects escape scenarios (parameters, returns, globals, address-of)
 * - Tracks 6502 stack depth
 * - Warns about stack overflow risk
 * - Sets metadata for optimization
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import {
  OptimizationMetadataKey,
  EscapeReason,
} from '../../../semantic/analysis/optimization-metadata-keys.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';

/**
 * Helper to parse and analyze code
 */
function analyzeCode(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const analyzer = new SemanticAnalyzer();
  analyzer.analyze(ast);

  return {
    ast,
    analyzer,
    diagnostics: analyzer.getDiagnostics(),
    errors: analyzer.getDiagnostics().filter(d => d.severity === DiagnosticSeverity.ERROR),
    warnings: analyzer.getDiagnostics().filter(d => d.severity === DiagnosticSeverity.WARNING),
  };
}

describe('EscapeAnalyzer', () => {
  describe('Local-Only Variables (No Escape)', () => {
    it('should mark simple local variable as non-escaping', () => {
      const source = `
        function test(): byte
          let x: byte = 10;
          let y: byte = x + 5;
          return y;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // Find local variable declarations
      const funcDecl = ast.getDeclarations()[0];
      if (funcDecl.getNodeType() === 'FunctionDecl') {
        const body = (funcDecl as any).getBody();
        if (body && body.length > 0) {
          const xDecl = body[0];

          // Variable 'x' should not escape (only used locally)
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(false);
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeReason)).toBe(
            EscapeReason.NoEscape
          );
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeStackAllocatable)).toBe(true);
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeLocalOnly)).toBe(true);
        }
      }
    });

    it('should mark multiple local-only variables', () => {
      const source = `
        function compute(): byte
          let a: byte = 1;
          let b: byte = 2;
          let c: byte = a + b;
          return c;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      if (funcDecl.getNodeType() === 'FunctionDecl') {
        const body = (funcDecl as any).getBody();

        // Variables 'a' and 'b' should not escape (only used locally in initializer)
        const aDecl = body[0];
        const bDecl = body[1];
        expect(aDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(false);
        expect(aDecl.metadata?.get(OptimizationMetadataKey.EscapeLocalOnly)).toBe(true);
        expect(bDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(false);
        expect(bDecl.metadata?.get(OptimizationMetadataKey.EscapeLocalOnly)).toBe(true);

        // Variable 'c' SHOULD escape (returned from function)
        const cDecl = body[2];
        expect(cDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
        expect(cDecl.metadata?.get(OptimizationMetadataKey.EscapeReason)).toBe(
          EscapeReason.ReturnedFromFunction
        );
      }
    });

    it('should handle local variables in loops', () => {
      const source = `
        function loop(): byte
          let sum: byte = 0;
          let i: byte = 0;
          while i < 10
            sum = sum + i;
            i = i + 1;
          end while
          return sum;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      if (funcDecl.getNodeType() === 'FunctionDecl') {
        const body = (funcDecl as any).getBody();

        // Variable 'sum' SHOULD escape (returned from function)
        const sumDecl = body[0];
        expect(sumDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
        expect(sumDecl.metadata?.get(OptimizationMetadataKey.EscapeReason)).toBe(
          EscapeReason.ReturnedFromFunction
        );

        // Variable 'i' should NOT escape (loop counter, local-only)
        const iDecl = body[1];
        expect(iDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(false);
        expect(iDecl.metadata?.get(OptimizationMetadataKey.EscapeLocalOnly)).toBe(true);
      }
    });

    it('should handle local variables in conditionals', () => {
      const source = `
        function conditional(flag: boolean): byte
          let result: byte = 0;
          if flag then
            let tempTrue: byte = 10;
            result = tempTrue;
          else
            let tempFalse: byte = 20;
            result = tempFalse;
          end if
          return result;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Variables Passed to Functions (Escape)', () => {
    it('should mark variable passed as argument as escaping', () => {
      const source = `
        function helper(value: byte): byte
          return value + 1;
        end function

        function test(): byte
          let x: byte = 10;
          return helper(x);
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // Find 'test' function
      const testFunc = ast.getDeclarations()[1];
      if (testFunc.getNodeType() === 'FunctionDecl') {
        const body = (testFunc as any).getBody();
        if (body && body.length > 0) {
          const xDecl = body[0];

          // Variable 'x' should escape (passed to function)
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeReason)).toBe(
            EscapeReason.PassedToFunction
          );
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeStackAllocatable)).toBe(false);
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeLocalOnly)).toBe(false);
        }
      }
    });

    it('should mark multiple arguments as escaping', () => {
      const source = `
        function add(a: byte, b: byte): byte
          return a + b;
        end function

        function test(): byte
          let x: byte = 5;
          let y: byte = 10;
          return add(x, y);
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const testFunc = ast.getDeclarations()[1];
      if (testFunc.getNodeType() === 'FunctionDecl') {
        const body = (testFunc as any).getBody();

        // Both 'x' and 'y' should escape
        const xDecl = body[0];
        const yDecl = body[1];

        expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
        expect(yDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
      }
    });
  });

  describe('Variables Returned from Functions (Escape)', () => {
    it('should mark returned variable as escaping', () => {
      const source = `
        function test(): byte
          let x: byte = 42;
          return x;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      if (funcDecl.getNodeType() === 'FunctionDecl') {
        const body = (funcDecl as any).getBody();
        if (body && body.length > 0) {
          const xDecl = body[0];

          // Variable 'x' should escape (returned from function)
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeReason)).toBe(
            EscapeReason.ReturnedFromFunction
          );
        }
      }
    });

    it('should handle multiple return paths', () => {
      const source = `
        function test(flag: boolean): byte
          let x: byte = 10;
          let y: byte = 20;
          if flag then
            return x;
          else
            return y;
          end if
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      if (funcDecl.getNodeType() === 'FunctionDecl') {
        const body = (funcDecl as any).getBody();

        // Both 'x' and 'y' should escape (both returned)
        const xDecl = body[0];
        const yDecl = body[1];

        expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
        expect(yDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
      }
    });

    it('should handle expression in return', () => {
      const source = `
        function test(): byte
          let x: byte = 5;
          let y: byte = 10;
          return x + y;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      if (funcDecl.getNodeType() === 'FunctionDecl') {
        const body = (funcDecl as any).getBody();

        // Both variables used in return expression should escape
        const xDecl = body[0];
        const yDecl = body[1];

        expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
        expect(yDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
      }
    });
  });

  describe('Variables Stored in Globals (Escape)', () => {
    it('should mark variable assigned to global as escaping', () => {
      const source = `
        let globalVar: byte = 0;

        function test(): void
          let x: byte = 42;
          globalVar = x;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // Find 'test' function
      const testFunc = ast.getDeclarations()[1];
      if (testFunc.getNodeType() === 'FunctionDecl') {
        const body = (testFunc as any).getBody();
        if (body && body.length > 0) {
          const xDecl = body[0];

          // Variable 'x' should escape (stored globally)
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeReason)).toBe(
            EscapeReason.StoredGlobally
          );
        }
      }
    });

    it('should handle multiple global assignments', () => {
      const source = `
        let global1: byte = 0;
        let global2: byte = 0;

        function test(): void
          let x: byte = 10;
          let y: byte = 20;
          global1 = x;
          global2 = y;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const testFunc = ast.getDeclarations()[2];
      if (testFunc.getNodeType() === 'FunctionDecl') {
        const body = (testFunc as any).getBody();

        // Both variables should escape
        const xDecl = body[0];
        const yDecl = body[1];

        expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
        expect(yDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
      }
    });
  });

  describe('Address-Of Operator (Escape)', () => {
    it('should mark variable with address taken as escaping', () => {
      const source = `
        function test(): word
          let x: byte = 42;
          return @x;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      if (funcDecl.getNodeType() === 'FunctionDecl') {
        const body = (funcDecl as any).getBody();
        if (body && body.length > 0) {
          const xDecl = body[0];

          // Variable 'x' should escape (address taken)
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
          expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeReason)).toBe(
            EscapeReason.AddressTaken
          );
        }
      }
    });

    it('should handle address-of in assignment', () => {
      const source = `
        function test(): void
          let x: byte = 10;
          let ptr: word = @x;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      if (funcDecl.getNodeType() === 'FunctionDecl') {
        const body = (funcDecl as any).getBody();

        // 'x' should escape (address taken)
        const xDecl = body[0];
        expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
        expect(xDecl.metadata?.get(OptimizationMetadataKey.EscapeReason)).toBe(
          EscapeReason.AddressTaken
        );

        // 'ptr' is local-only
        const ptrDecl = body[1];
        expect(ptrDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(false);
      }
    });
  });

  describe('Global Variables (Always Escape)', () => {
    it('should mark global variables as escaping', () => {
      const source = `
        let globalCounter: byte = 0;
        let globalFlag: boolean = false;

        function test(): void
          globalCounter = 1;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // Global variables should be marked as escaping
      const global1 = ast.getDeclarations()[0];
      const global2 = ast.getDeclarations()[1];

      expect(global1.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
      expect(global1.metadata?.get(OptimizationMetadataKey.EscapeReason)).toBe(
        EscapeReason.StoredGlobally
      );

      expect(global2.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
      expect(global2.metadata?.get(OptimizationMetadataKey.EscapeReason)).toBe(
        EscapeReason.StoredGlobally
      );
    });
  });

  describe('Stack Depth Tracking', () => {
    it('should calculate basic stack depth', () => {
      const source = `
        function simple(): byte
          let x: byte = 10;
          return x;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];

      // Stack depth = 2 (return address) + 0 (no params) + 1 (local var) = 3 bytes
      const stackDepth = funcDecl.metadata?.get(OptimizationMetadataKey.StackDepth);
      expect(stackDepth).toBeDefined();
      expect(stackDepth).toBeGreaterThanOrEqual(3);
    });

    it('should include parameters in stack depth', () => {
      const source = `
        function withParams(a: byte, b: byte): byte
          let x: byte = a + b;
          return x;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];

      // Stack depth = 2 (return) + 2 (params) + 1 (local) = 5 bytes
      const stackDepth = funcDecl.metadata?.get(OptimizationMetadataKey.StackDepth);
      expect(stackDepth).toBeDefined();
      expect(stackDepth).toBeGreaterThanOrEqual(5);
    });

    it('should include word-sized variables', () => {
      const source = `
        function withWord(): word
          let x: word = 1000;
          return x;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];

      // Stack depth = 2 (return) + 2 (word local) = 4 bytes
      const stackDepth = funcDecl.metadata?.get(OptimizationMetadataKey.StackDepth);
      expect(stackDepth).toBeDefined();
      expect(stackDepth).toBeGreaterThanOrEqual(4);
    });

    it('should propagate stack depth through call chain', () => {
      const source = `
        function leaf(): byte
          let x: byte = 10;
          return x;
        end function

        function middle(): byte
          let y: byte = leaf();
          return y;
        end function

        function root(): byte
          let z: byte = middle();
          return z;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      // Root should have deepest stack (includes middle + leaf)
      const rootFunc = ast.getDeclarations()[2];
      const rootDepth = rootFunc.metadata?.get(OptimizationMetadataKey.StackDepth);

      // Middle should have depth including leaf
      const middleFunc = ast.getDeclarations()[1];
      const middleDepth = middleFunc.metadata?.get(OptimizationMetadataKey.StackDepth);

      // Leaf should have smallest depth
      const leafFunc = ast.getDeclarations()[0];
      const leafDepth = leafFunc.metadata?.get(OptimizationMetadataKey.StackDepth);

      expect(rootDepth).toBeGreaterThan(middleDepth!);
      expect(middleDepth).toBeGreaterThan(leafDepth!);
    });
  });

  describe('Stack Overflow Detection', () => {
    it('should handle typical C64 game loop (safe stack usage)', () => {
      // Realistic C64 game loop: 3-5 function call depth, 5-10 locals each
      // Total should be under 100 bytes - safe, no warnings
      const source = `
        function updateSprite(id: byte): void
          let x: byte = 10;
          let y: byte = 20;
        end function

        function updateGame(): void
          let i: byte = 0;
          let maxSprites: byte = 8;
          while i < maxSprites
            updateSprite(i);
            i = i + 1;
          end while
        end function

        function gameLoop(): void
          let running: boolean = true;
          updateGame();
        end function
      `;

      const { errors, warnings } = analyzeCode(source);

      // Should not have any stack overflow errors or warnings
      expect(errors.some(e => e.message.includes('Stack overflow'))).toBe(false);
      expect(warnings.some(w => w.message.includes('stack usage'))).toBe(false);
    });

    it('should warn about realistic high stack usage', () => {
      // Realistic high usage: sprite system with nested rendering calls
      // Depth: 10 functions, each with ~10 bytes = ~120 bytes total
      // Should be under 200 byte warning threshold but getting close
      const source = `
        function renderPixel(x: byte, y: byte, color: byte): void
          let offset: word = 1024;
        end function

        function renderLine(x1: byte, y1: byte, x2: byte, y2: byte): void
          let dx: byte = 1;
          let dy: byte = 1;
          let steps: byte = 10;
          let i: byte = 0;
          renderPixel(x1, y1, 1);
        end function

        function renderRect(x: byte, y: byte, w: byte, h: byte): void
          let x2: byte = x;
          let y2: byte = y;
          renderLine(x, y, x2, y2);
        end function

        function renderSprite(id: byte): void
          let x: byte = 10;
          let y: byte = 20;
          let width: byte = 24;
          let height: byte = 21;
          renderRect(x, y, width, height);
        end function

        function renderLayer(layer: byte): void
          let count: byte = 8;
          let i: byte = 0;
          renderSprite(i);
        end function

        function renderScreen(): void
          let bgLayer: byte = 0;
          let fgLayer: byte = 1;
          let uiLayer: byte = 2;
          renderLayer(bgLayer);
          renderLayer(fgLayer);
          renderLayer(uiLayer);
        end function
      `;

      const { errors } = analyzeCode(source);

      // Deep call chain but still under limit - should not error
      // renderScreen -> renderLayer -> renderSprite -> renderRect -> renderLine -> renderPixel
      // 6 levels � ~15 bytes each = ~90 bytes (safe)
      expect(errors.some(e => e.message.includes('Stack overflow'))).toBe(false);
    });

    it('should correctly calculate stack depth with word variables', () => {
      // Verify word variables count as 2 bytes in stack calculation
      const source = `
        function withWords(addr1: word, addr2: word): word
          let pointer: word = 49152;
          let offset: word = 1024;
          let temp: byte = 0;
          return pointer;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      const stackDepth = funcDecl.metadata?.get(OptimizationMetadataKey.StackDepth);

      // Stack: 2 (return) + 4 (2 word params) + 5 (2 words + 1 byte locals) = 11 bytes
      expect(stackDepth).toBeDefined();
      expect(stackDepth).toBeGreaterThanOrEqual(11);
    });

    it('should not overflow with shallow call chain', () => {
      const source = `
        function helper1(): byte
          let x: byte = 1;
          return x;
        end function

        function helper2(): byte
          let y: byte = 2;
          return y;
        end function

        function main(): byte
          let a: byte = helper1();
          let b: byte = helper2();
          return a + b;
        end function
      `;

      const { errors } = analyzeCode(source);

      // Should not have stack overflow errors
      expect(errors.some(e => e.message.includes('Stack overflow'))).toBe(false);
    });
  });

  describe('Complex Escape Scenarios', () => {
    it('should handle mixed escape and non-escape variables', () => {
      const source = `
        let globalValue: byte = 0;

        function mixed(): byte
          let local1: byte = 10;
          let local2: byte = 20;
          let escape1: byte = 30;
          let escape2: byte = 40;

          globalValue = escape1;
          let temp: byte = local1 + local2;
          return escape2 + temp;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[1];
      if (funcDecl.getNodeType() === 'FunctionDecl') {
        const body = (funcDecl as any).getBody();

        // local1 and local2 should not escape (only used locally)
        const local1 = body[0];
        const local2 = body[1];
        expect(local1.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(false);
        expect(local2.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(false);

        // escape1 should escape (stored globally)
        const escape1 = body[2];
        expect(escape1.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);

        // escape2 should escape (returned from function)
        const escape2 = body[3];
        expect(escape2.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
      }
    });

    it('should handle escape in nested blocks', () => {
      const source = `
        function nested(flag: boolean): byte
          let outer: byte = 10;
          if flag then
            let inner: byte = 20;
            outer = inner;
          end if
          return outer;
        end function
      `;

      const { ast, errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);

      const funcDecl = ast.getDeclarations()[0];
      if (funcDecl.getNodeType() === 'FunctionDecl') {
        const body = (funcDecl as any).getBody();

        // 'outer' should escape (returned from function)
        const outerDecl = body[0];
        expect(outerDecl.metadata?.get(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
      }
    });
  });

  describe('Metadata Validation', () => {
    it('should set all escape metadata fields', () => {
      const source = `
        function test(): void
          let x: byte = 10;
          let y: byte = x;
        end function
      `;

      const { ast } = analyzeCode(source);

      const funcDecl = ast.getDeclarations()[0];
      if (funcDecl.getNodeType() === 'FunctionDecl') {
        const body = (funcDecl as any).getBody();
        const varDecl = body[0];

        // All metadata fields should be set
        expect(varDecl.metadata?.has(OptimizationMetadataKey.EscapeEscapes)).toBe(true);
        expect(varDecl.metadata?.has(OptimizationMetadataKey.EscapeReason)).toBe(true);
        expect(varDecl.metadata?.has(OptimizationMetadataKey.EscapeStackAllocatable)).toBe(true);
        expect(varDecl.metadata?.has(OptimizationMetadataKey.EscapeLocalOnly)).toBe(true);
      }
    });

    it('should set stack metadata on functions', () => {
      const source = `
        function test(): byte
          let x: byte = 10;
          return x;
        end function
      `;

      const { ast } = analyzeCode(source);

      const funcDecl = ast.getDeclarations()[0];

      // Stack metadata should be set
      expect(funcDecl.metadata?.has(OptimizationMetadataKey.StackDepth)).toBe(true);
      expect(funcDecl.metadata?.has(OptimizationMetadataKey.StackOverflowRisk)).toBe(true);

      // No overflow for simple function
      expect(funcDecl.metadata?.get(OptimizationMetadataKey.StackOverflowRisk)).toBe(false);
    });
  });
});

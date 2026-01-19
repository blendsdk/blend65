/**
 * Tests for Definite Assignment Analysis (Task 8.1)
 *
 * Verifies that the analyzer correctly:
 * - Detects variables used before initialization
 * - Marks variables that are always initialized
 * - Handles branching and merging
 * - Handles loops correctly
 * - Sets metadata for optimization
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { OptimizationMetadataKey } from '../../../semantic/analysis/optimization-metadata-keys.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';
import { isFunctionDecl } from '../../../ast/type-guards.js';

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

describe('DefiniteAssignmentAnalyzer', () => {
  describe('Basic Initialization Detection', () => {
    it('should allow using initialized variable', () => {
      const source = `
        function test(): void
          let x: byte = 10;
          let y: byte = x;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });

    it('should detect use before initialization', () => {
      const source = `
        function test(): void
          let x: byte;
          let y: byte = x;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('used before being initialized'))).toBe(true);
    });

    it('should allow use after assignment', () => {
      const source = `
        function test(): void
          let x: byte;
          x = 10;
          let y: byte = x;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });

    it('should handle multiple variables independently', () => {
      const source = `
        function test(): void
          let a: byte = 1;
          let b: byte;
          let c: byte = a;
          b = 2;
          let d: byte = b;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Conditional Initialization', () => {
    it('should detect uninitialized use when only one branch initializes', () => {
      const source = `
        function test(condition: boolean): void
          let x: byte;
          if condition then
            x = 10;
          end if
          let y: byte = x;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('used before being initialized'))).toBe(true);
    });

    it('should allow use when both branches initialize', () => {
      const source = `
        function test(condition: boolean): void
          let x: byte;
          if condition then
            x = 10;
          else
            x = 20;
          end if
          let y: byte = x;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });

    it('should handle nested conditionals', () => {
      const source = `
        function test(a: boolean, b: boolean): void
          let x: byte;
          if a then
            if b then
              x = 10;
            else
              x = 20;
            end if
          else
            x = 30;
          end if
          let y: byte = x;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Loop Initialization', () => {
    it('should detect uninitialized use before loop', () => {
      const source = `
        function test(): void
          let x: byte;
          while x < 10
            x = x + 1;
          end while
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should allow use when initialized before loop', () => {
      const source = `
        function test(): void
          let x: byte = 0;
          while x < 10
            x = x + 1;
          end while
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });

    it('should detect uninitialized use after loop when not initialized on all paths', () => {
      const source = `
        function test(condition: boolean): void
          let x: byte;
          while condition
            x = 10;
          end while
          let y: byte = x;
        end function
      `;

      const { errors } = analyzeCode(source);
      // Loop may not execute, so x might not be initialized
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Return Statements', () => {
    it('should allow early return with initialized variable', () => {
      const source = `
        function test(condition: boolean): byte
          let x: byte = 10;
          if condition then
            return x;
          end if
          return 0;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });

    it('should detect uninitialized use in return', () => {
      const source = `
        function test(): byte
          let x: byte;
          return x;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle multiple return paths', () => {
      const source = `
        function test(condition: boolean): byte
          let x: byte;
          if condition then
            x = 10;
            return x;
          else
            x = 20;
            return x;
          end if
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Metadata Generation', () => {
    it('should mark always-initialized variables', () => {
      const source = `
        function test(): void
          let x: byte = 10;
          let y: byte = x;
        end function
      `;

      const { ast } = analyzeCode(source);

      // Find variable declaration for x
      const functionDecl = ast.getDeclarations()[0];
      if (isFunctionDecl(functionDecl)) {
        const body = (functionDecl as any).getBody();
        if (body && body.length > 0) {
          const varDecl = body[0];

          // Check metadata
          const metadata = varDecl.metadata;
          expect(metadata).toBeDefined();
          expect(metadata?.get(OptimizationMetadataKey.DefiniteAssignmentAlwaysInitialized)).toBe(
            true
          );
        }
      }
    });

    it('should store constant initialization values', () => {
      const source = `
        function test(): void
          let x: byte = 42;
          let y: byte = x;
        end function
      `;

      const { ast } = analyzeCode(source);

      // Find variable declaration for x
      const functionDecl = ast.getDeclarations()[0];
      if (isFunctionDecl(functionDecl)) {
        const body = (functionDecl as any).getBody();
        if (body && body.length > 0) {
          const varDecl = body[0];

          // Check metadata
          const metadata = varDecl.metadata;
          expect(metadata).toBeDefined();
          expect(metadata?.get(OptimizationMetadataKey.DefiniteAssignmentInitValue)).toBe(42);
        }
      }
    });

    it('should mark uninitialized use nodes', () => {
      const source = `
        function test(): void
          let x: byte;
          let y: byte = x;
        end function
      `;

      const { ast, errors } = analyzeCode(source);

      // Should have error
      expect(errors.length).toBeGreaterThan(0);

      // Find identifier node in the use
      const functionDecl = ast.getDeclarations()[0];
      if (isFunctionDecl(functionDecl)) {
        const body = (functionDecl as any).getBody();
        if (body && body.length > 1) {
          const varDecl2 = body[1];
          const initializer = (varDecl2 as any).getInitializer();

          // The identifier 'x' should be marked as uninitialized use
          if (initializer && initializer.metadata) {
            const hasUninitUse = initializer.metadata.get(
              OptimizationMetadataKey.DefiniteAssignmentUninitializedUse
            );
            expect(hasUninitUse).toBe(true);
          }
        }
      }
    });
  });

  describe('Complex Control Flow', () => {
    it('should handle complex branching', () => {
      const source = `
        function test(a: boolean, b: boolean, c: boolean): void
          let x: byte;

          if a then
            if b then
              x = 1;
            else
              if c then
                x = 2;
              else
                x = 3;
              end if
            end if
          else
            x = 4;
          end if

          let y: byte = x;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing initialization in complex branches', () => {
      const source = `
        function test(a: boolean, b: boolean): void
          let x: byte;

          if a then
            if b then
              x = 1;
            end if
          else
            x = 2;
          end if

          let y: byte = x;
        end function
      `;

      const { errors } = analyzeCode(source);
      // The inner 'if (b)' branch doesn't cover all cases
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle loops with breaks', () => {
      const source = `
        function test(condition: boolean): void
          let x: byte = 0;

          while x < 10
            if condition then
              break;
            end if
            x = x + 1;
          end while

          let y: byte = x;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Parameter Initialization', () => {
    it('should treat parameters as initialized', () => {
      const source = `
        function test(x: byte): byte
          return x + 1;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });

    it('should handle both parameters and local variables', () => {
      const source = `
        function test(x: byte): byte
          let y: byte;
          y = x + 1;
          return y;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Assignment in Expressions', () => {
    it('should track assignments in complex expressions', () => {
      const source = `
        function test(): void
          let x: byte;
          let y: byte;
          y = (x = 10);
          let z: byte = x + y;
        end function
      `;

      const { errors } = analyzeCode(source);
      expect(errors).toHaveLength(0);
    });
  });
});
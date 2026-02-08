/**
 * Array Literal Expression Parser Tests
 *
 * Comprehensive test suite for array literal expressions:
 * - Empty arrays
 * - Single/multiple element arrays
 * - Nested arrays (multidimensional)
 * - Expressions in arrays
 * - Trailing commas
 * - Error cases
 * - Integration with variable declarations
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import {
  isArrayLiteralExpression,
  isLiteralExpression,
  isIdentifierExpression,
  isBinaryExpression,
  isCallExpression,
  isMemberExpression,
  isUnaryExpression,
  isVariableDecl,
} from '../../ast/type-guards.js';

/**
 * Helper function to parse a Blend65 expression
 */
function parseExpression(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();

  // Extract expression from variable declaration
  const decls = program.getDeclarations();
  expect(decls.length).toBeGreaterThan(0);

  const firstDecl = decls[0];
  expect(isVariableDecl(firstDecl)).toBe(true);

  if (isVariableDecl(firstDecl)) {
    const initializer = firstDecl.getInitializer();
    expect(initializer).not.toBeNull();
    return { expression: initializer!, parser, program };
  }

  throw new Error('Failed to extract expression from program');
}

describe('Parser - Array Literals', () => {
  // ============================================
  // EMPTY ARRAYS
  // ============================================

  describe('Empty Arrays', () => {
    it('should parse empty array literal', () => {
      const { expression } = parseExpression('let arr: byte[0] = [];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        expect(expression.getElements()).toEqual([]);
        expect(expression.getElementCount()).toBe(0);
        expect(expression.isEmpty()).toBe(true);
      }
    });

    it('should parse empty array with whitespace', () => {
      const { expression } = parseExpression('let arr: byte[0] = [ ];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        expect(expression.getElements()).toEqual([]);
        expect(expression.isEmpty()).toBe(true);
      }
    });

    it('should parse empty array in const declaration', () => {
      const { expression } = parseExpression('const arr: byte[0] = [];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        expect(expression.isEmpty()).toBe(true);
      }
    });
  });

  // ============================================
  // SINGLE ELEMENT ARRAYS
  // ============================================

  describe('Single Element Arrays', () => {
    it('should parse array with single number literal', () => {
      const { expression } = parseExpression('let arr: byte[1] = [42];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(1);
        expect(expression.getElementCount()).toBe(1);
        expect(expression.isEmpty()).toBe(false);

        const elem = elements[0];
        expect(isLiteralExpression(elem)).toBe(true);
        if (isLiteralExpression(elem)) {
          expect(elem.getValue()).toBe(42);
        }
      }
    });

    it('should parse array with single string literal', () => {
      const { expression } = parseExpression('let arr: string[1] = ["hello"];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(1);

        const elem = elements[0];
        expect(isLiteralExpression(elem)).toBe(true);
        if (isLiteralExpression(elem)) {
          expect(elem.getValue()).toBe('hello');
        }
      }
    });

    it('should parse array with single identifier', () => {
      const { expression } = parseExpression('let arr: byte[1] = [x];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(1);

        const elem = elements[0];
        expect(isIdentifierExpression(elem)).toBe(true);
        if (isIdentifierExpression(elem)) {
          expect(elem.getName()).toBe('x');
        }
      }
    });

    it('should parse array with single expression', () => {
      const { expression } = parseExpression('let arr: byte[1] = [x + 1];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(1);

        const elem = elements[0];
        expect(isBinaryExpression(elem)).toBe(true);
      }
    });

    it('should parse array with single function call', () => {
      const { expression } = parseExpression('let arr: byte[1] = [getValue()];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(1);

        const elem = elements[0];
        expect(isCallExpression(elem)).toBe(true);
      }
    });
  });

  // ============================================
  // MULTIPLE ELEMENT ARRAYS
  // ============================================

  describe('Multiple Element Arrays', () => {
    it('should parse array with multiple number literals', () => {
      const { expression } = parseExpression('let arr: byte[3] = [1, 2, 3];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(3);
        expect(expression.getElementCount()).toBe(3);

        expect(isLiteralExpression(elements[0])).toBe(true);
        expect(isLiteralExpression(elements[1])).toBe(true);
        expect(isLiteralExpression(elements[2])).toBe(true);

        if (
          isLiteralExpression(elements[0]) &&
          isLiteralExpression(elements[1]) &&
          isLiteralExpression(elements[2])
        ) {
          expect(elements[0].getValue()).toBe(1);
          expect(elements[1].getValue()).toBe(2);
          expect(elements[2].getValue()).toBe(3);
        }
      }
    });

    it('should parse array with hex numbers', () => {
      const { expression } = parseExpression('let arr: byte[3] = [$D000, $D001, $D002];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(3);

        if (
          isLiteralExpression(elements[0]) &&
          isLiteralExpression(elements[1]) &&
          isLiteralExpression(elements[2])
        ) {
          expect(elements[0].getValue()).toBe(0xd000);
          expect(elements[1].getValue()).toBe(0xd001);
          expect(elements[2].getValue()).toBe(0xd002);
        }
      }
    });

    it('should parse array with identifiers', () => {
      const { expression } = parseExpression('let arr: byte[3] = [x, y, z];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(3);

        expect(isIdentifierExpression(elements[0])).toBe(true);
        expect(isIdentifierExpression(elements[1])).toBe(true);
        expect(isIdentifierExpression(elements[2])).toBe(true);
      }
    });

    it('should parse array with expressions', () => {
      const { expression } = parseExpression('let arr: byte[2] = [a + b, c * d];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(2);

        expect(isBinaryExpression(elements[0])).toBe(true);
        expect(isBinaryExpression(elements[1])).toBe(true);
      }
    });

    it('should parse long array', () => {
      const { expression } = parseExpression(
        'let arr: byte[10] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];'
      );

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        expect(expression.getElementCount()).toBe(10);
      }
    });

    it('should parse array with varied whitespace', () => {
      const { expression } = parseExpression('let arr: byte[3] = [1,  2,   3];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        expect(expression.getElementCount()).toBe(3);
      }
    });
  });

  // ============================================
  // NESTED ARRAYS (MULTIDIMENSIONAL)
  // ============================================

  describe('Nested Arrays', () => {
    it('should parse 2D array literal', () => {
      const { expression } = parseExpression('let arr: byte[2][2] = [[1, 2], [3, 4]];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(2);

        // First row
        expect(isArrayLiteralExpression(elements[0])).toBe(true);
        if (isArrayLiteralExpression(elements[0])) {
          const row1 = elements[0].getElements();
          expect(row1.length).toBe(2);
        }

        // Second row
        expect(isArrayLiteralExpression(elements[1])).toBe(true);
        if (isArrayLiteralExpression(elements[1])) {
          const row2 = elements[1].getElements();
          expect(row2.length).toBe(2);
        }
      }
    });

    it('should parse 3D array literal', () => {
      const { expression } = parseExpression(
        'let arr: byte[2][2][2] = [[[1, 2], [3, 4]], [[5, 6], [7, 8]]];'
      );

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(2);

        expect(isArrayLiteralExpression(elements[0])).toBe(true);
        expect(isArrayLiteralExpression(elements[1])).toBe(true);
      }
    });

    it('should parse mixed nesting levels', () => {
      const { expression } = parseExpression('let arr: byte[3] = [1, [2, 3], 4];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(3);

        expect(isLiteralExpression(elements[0])).toBe(true);
        expect(isArrayLiteralExpression(elements[1])).toBe(true);
        expect(isLiteralExpression(elements[2])).toBe(true);
      }
    });

    it('should parse empty nested arrays', () => {
      const { expression } = parseExpression('let arr: byte[1][0] = [[]];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(1);

        expect(isArrayLiteralExpression(elements[0])).toBe(true);
        if (isArrayLiteralExpression(elements[0])) {
          expect(elements[0].isEmpty()).toBe(true);
        }
      }
    });

    it('should parse deep nesting', () => {
      const { expression } = parseExpression('let arr: byte[1][1][1][1] = [[[[1]]]];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        let current = expression.getElements()[0];
        expect(isArrayLiteralExpression(current)).toBe(true);

        if (isArrayLiteralExpression(current)) {
          current = current.getElements()[0];
          expect(isArrayLiteralExpression(current)).toBe(true);
        }
      }
    });
  });

  // ============================================
  // EXPRESSIONS IN ARRAYS
  // ============================================

  describe('Expressions in Arrays', () => {
    it('should parse binary expressions in array', () => {
      const { expression } = parseExpression('let arr: byte[2] = [a + b, c - d];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(2);

        expect(isBinaryExpression(elements[0])).toBe(true);
        expect(isBinaryExpression(elements[1])).toBe(true);
      }
    });

    it('should parse unary expressions in array', () => {
      const { expression } = parseExpression('let arr: byte[2] = [-x, !y];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(2);

        expect(isUnaryExpression(elements[0])).toBe(true);
        expect(isUnaryExpression(elements[1])).toBe(true);
      }
    });

    it('should parse function calls in array', () => {
      const { expression } = parseExpression('let arr: byte[2] = [foo(), bar()];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(2);

        expect(isCallExpression(elements[0])).toBe(true);
        expect(isCallExpression(elements[1])).toBe(true);
      }
    });

    it('should parse member access in array', () => {
      const { expression } = parseExpression('let arr: byte[2] = [player.x, player.y];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(2);

        expect(isMemberExpression(elements[0])).toBe(true);
        expect(isMemberExpression(elements[1])).toBe(true);
      }
    });

    it('should parse address-of expressions in array', () => {
      const { expression } = parseExpression('let arr: word[2] = [@x, @y];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(2);

        expect(isUnaryExpression(elements[0])).toBe(true);
        expect(isUnaryExpression(elements[1])).toBe(true);
      }
    });

    it('should parse complex expressions in array', () => {
      const { expression } = parseExpression('let arr: byte[2] = [a + b * c, foo(x, y)];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        const elements = expression.getElements();
        expect(elements.length).toBe(2);

        expect(isBinaryExpression(elements[0])).toBe(true);
        expect(isCallExpression(elements[1])).toBe(true);
      }
    });
  });

  // ============================================
  // TRAILING COMMAS
  // ============================================

  describe('Trailing Commas', () => {
    it('should allow trailing comma after single element', () => {
      const { expression } = parseExpression('let arr: byte[1] = [1,];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        expect(expression.getElementCount()).toBe(1);
      }
    });

    it('should allow trailing comma after multiple elements', () => {
      const { expression } = parseExpression('let arr: byte[3] = [1, 2, 3,];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        expect(expression.getElementCount()).toBe(3);
      }
    });

    it('should allow trailing commas in nested arrays', () => {
      const { expression } = parseExpression('let arr: byte[2][2] = [[1, 2,], [3, 4,],];');

      expect(isArrayLiteralExpression(expression)).toBe(true);
      if (isArrayLiteralExpression(expression)) {
        expect(expression.getElementCount()).toBe(2);
      }
    });
  });

  // ============================================
  // ERROR CASES
  // ============================================

  describe('Error Cases', () => {
    it('should report error for missing closing bracket', () => {
      const source = 'let arr: byte[3] = [1, 2, 3;';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      parser.parse();

      expect(parser.hasErrors()).toBe(true);
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);
    });

    it('should report error for missing comma between elements', () => {
      const source = 'let arr: byte[3] = [1 2 3];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      parser.parse();

      expect(parser.hasErrors()).toBe(true);
    });

    it('should report error for unclosed nested array', () => {
      const source = 'let arr: byte[2][2] = [[1, 2];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      parser.parse();

      expect(parser.hasErrors()).toBe(true);
    });
  });

  // ============================================
  // INTEGRATION WITH VARIABLE DECLARATIONS
  // ============================================

  describe('Integration with Variable Declarations', () => {
    it('should parse array literal in let declaration', () => {
      const source = 'let colors: byte[3] = [2, 5, 6];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const decls = program.getDeclarations();
      expect(decls.length).toBe(1);

      const varDecl = decls[0];
      expect(isVariableDecl(varDecl)).toBe(true);

      if (isVariableDecl(varDecl)) {
        expect(varDecl.getName()).toBe('colors');
        const init = varDecl.getInitializer();
        expect(isArrayLiteralExpression(init)).toBe(true);
      }
    });

    it('should parse array literal in const declaration', () => {
      const source = 'const palette: byte[3] = [0, 1, 2];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const decls = program.getDeclarations();
      const varDecl = decls[0];
      expect(isVariableDecl(varDecl)).toBe(true);

      if (isVariableDecl(varDecl)) {
        expect(varDecl.isConst()).toBe(true);
        expect(isArrayLiteralExpression(varDecl.getInitializer())).toBe(true);
      }
    });

    it('should parse array literal with storage class', () => {
      const source = '@data const lookup: byte[256] = [0, 1, 2, 3];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const decls = program.getDeclarations();
      const varDecl = decls[0];
      expect(isVariableDecl(varDecl)).toBe(true);

      if (isVariableDecl(varDecl)) {
        expect(varDecl.getStorageClass()).not.toBeNull();
        expect(isArrayLiteralExpression(varDecl.getInitializer())).toBe(true);
      }
    });

    it('should parse nested array type with nested array literal', () => {
      const source = 'let matrix: byte[2][2] = [[1, 2], [3, 4]];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const decls = program.getDeclarations();
      const varDecl = decls[0];
      expect(isVariableDecl(varDecl)).toBe(true);

      if (isVariableDecl(varDecl)) {
        const init = varDecl.getInitializer();
        expect(isArrayLiteralExpression(init)).toBe(true);

        if (isArrayLiteralExpression(init)) {
          expect(init.getElementCount()).toBe(2);

          const row1 = init.getElements()[0];
          expect(isArrayLiteralExpression(row1)).toBe(true);
        }
      }
    });

    it('should parse array with expression values', () => {
      const source = 'let vals: word[3] = [x, y + 1, z * 2];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const decls = program.getDeclarations();
      const varDecl = decls[0];
      expect(isVariableDecl(varDecl)).toBe(true);

      if (isVariableDecl(varDecl)) {
        const init = varDecl.getInitializer();
        expect(isArrayLiteralExpression(init)).toBe(true);

        if (isArrayLiteralExpression(init)) {
          const elements = init.getElements();
          expect(isIdentifierExpression(elements[0])).toBe(true);
          expect(isBinaryExpression(elements[1])).toBe(true);
          expect(isBinaryExpression(elements[2])).toBe(true);
        }
      }
    });
  });

  // ============================================
  // C64-SPECIFIC EXAMPLES
  // ============================================

  describe('C64-Specific Use Cases', () => {
    it('should parse sprite data array', () => {
      const source =
        '@data const spriteData: byte[8] = [0xFF, 0x3C, 0x18, 0x18, 0x18, 0x3C, 0xFF, 0x00];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const decls = program.getDeclarations();
      expect(isVariableDecl(decls[0])).toBe(true);

      if (isVariableDecl(decls[0])) {
        expect(isArrayLiteralExpression(decls[0].getInitializer())).toBe(true);
      }
    });

    it('should parse color palette array', () => {
      const source = 'const palette: byte[4] = [0, 1, 2, 6];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);
    });

    it('should parse tilemap as 2D array', () => {
      const source = 'let tilemap: byte[3][3] = [[1, 0, 1], [0, 2, 0], [1, 0, 1]];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const decls = program.getDeclarations();
      if (isVariableDecl(decls[0])) {
        const init = decls[0].getInitializer();
        expect(isArrayLiteralExpression(init)).toBe(true);

        if (isArrayLiteralExpression(init)) {
          expect(init.getElementCount()).toBe(3); // 3 rows
        }
      }
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    it('should parse array as function argument', () => {
      const source = 'let result: byte = processArray([1, 2, 3]);';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const decls = program.getDeclarations();
      if (isVariableDecl(decls[0])) {
        const init = decls[0].getInitializer();
        expect(isCallExpression(init)).toBe(true);

        if (isCallExpression(init)) {
          const args = init.getArguments();
          expect(args.length).toBe(1);
          expect(isArrayLiteralExpression(args[0])).toBe(true);
        }
      }
    });

    it('should parse array in binary expression', () => {
      const source = 'let result: boolean = compareArrays([1, 2], [3, 4]);';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);
    });

    it('should parse array with complex nested expressions', () => {
      const source = 'let arr: byte[3] = [a + b * c, d / (e + f), g << 2];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const decls = program.getDeclarations();
      if (isVariableDecl(decls[0])) {
        const init = decls[0].getInitializer();
        expect(isArrayLiteralExpression(init)).toBe(true);
      }
    });
  });

  // ============================================
  // NO REGRESSION TESTS
  // ============================================

  describe('No Regression - Array Indexing Still Works', () => {
    it('should still parse array indexing correctly', () => {
      const source = 'let value: byte = array[0];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const decls = program.getDeclarations();
      if (isVariableDecl(decls[0])) {
        const init = decls[0].getInitializer();
        expect(isArrayLiteralExpression(init)).toBe(false); // Should NOT be array literal
        // Should be index expression instead
      }
    });

    it('should parse multidimensional array indexing', () => {
      const source = 'let value: byte = matrix[row][col];';
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);
    });
  });
});

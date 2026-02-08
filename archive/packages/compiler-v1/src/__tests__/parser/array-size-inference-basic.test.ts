/**
 * Basic Array Size Inference Parser Tests
 *
 * Tests that the parser correctly handles empty array brackets syntax.
 * Semantic validation (ensuring initializer is present) will be tested separately.
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { isVariableDecl } from '../../ast/type-guards.js';

describe('Parser - Array Size Inference (Basic)', () => {
  /**
   * Helper: Parse a program and extract the first declaration
   */
  function parseFirstDecl(source: string) {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const program = parser.parse();

    expect(program.getDeclarations().length).toBeGreaterThan(0);
    return program.getDeclarations()[0];
  }

  describe('Single-dimensional arrays with empty brackets', () => {
    it('should parse byte[] with initializer', () => {
      const decl = parseFirstDecl('let arr: byte[] = [1, 2, 3];');

      expect(isVariableDecl(decl)).toBe(true);
      if (isVariableDecl(decl)) {
        expect(decl.getName()).toBe('arr');
        expect(decl.getTypeAnnotation()).toBe('byte[]');
        expect(decl.getInitializer()).not.toBeNull();
      }
    });

    it('should parse word[] with initializer', () => {
      const decl = parseFirstDecl('let values: word[] = [100, 200, 300];');

      expect(isVariableDecl(decl)).toBe(true);
      if (isVariableDecl(decl)) {
        expect(decl.getName()).toBe('values');
        expect(decl.getTypeAnnotation()).toBe('word[]');
        expect(decl.getInitializer()).not.toBeNull();
      }
    });

    it('should parse const with empty brackets', () => {
      const decl = parseFirstDecl('const colors: byte[] = [2, 5, 6];');

      expect(isVariableDecl(decl)).toBe(true);
      if (isVariableDecl(decl)) {
        expect(decl.getName()).toBe('colors');
        expect(decl.getTypeAnnotation()).toBe('byte[]');
        expect(decl.isConst()).toBe(true);
      }
    });
  });

  describe('Multi-dimensional arrays with empty brackets', () => {
    it('should parse byte[][] (2D array)', () => {
      const decl = parseFirstDecl('let matrix: byte[][] = [[1, 2], [3, 4]];');

      expect(isVariableDecl(decl)).toBe(true);
      if (isVariableDecl(decl)) {
        expect(decl.getName()).toBe('matrix');
        expect(decl.getTypeAnnotation()).toBe('byte[][]');
      }
    });

    it('should parse byte[][][] (3D array)', () => {
      const decl = parseFirstDecl('let cube: byte[][][] = [[[1]]];');

      expect(isVariableDecl(decl)).toBe(true);
      if (isVariableDecl(decl)) {
        expect(decl.getName()).toBe('cube');
        expect(decl.getTypeAnnotation()).toBe('byte[][][]');
      }
    });
  });

  describe('Mixed explicit and inferred dimensions', () => {
    it('should parse byte[3][] (explicit first, inferred second)', () => {
      const decl = parseFirstDecl('let mixed: byte[3][] = [[1], [2], [3]];');

      expect(isVariableDecl(decl)).toBe(true);
      if (isVariableDecl(decl)) {
        expect(decl.getName()).toBe('mixed');
        expect(decl.getTypeAnnotation()).toBe('byte[3][]');
      }
    });

    it('should parse byte[][4] (inferred first, explicit second)', () => {
      const decl = parseFirstDecl('let mixed: byte[][4] = [[1,2,3,4], [5,6,7,8]];');

      expect(isVariableDecl(decl)).toBe(true);
      if (isVariableDecl(decl)) {
        expect(decl.getName()).toBe('mixed');
        expect(decl.getTypeAnnotation()).toBe('byte[][4]');
      }
    });
  });

  describe('Storage classes with empty brackets', () => {
    it('should parse @zp with empty brackets', () => {
      const decl = parseFirstDecl('@zp let fast: byte[] = [0, 0, 0];');

      expect(isVariableDecl(decl)).toBe(true);
      if (isVariableDecl(decl)) {
        expect(decl.getName()).toBe('fast');
        expect(decl.getTypeAnnotation()).toBe('byte[]');
        expect(decl.getStorageClass()).toBe('ZP'); // Storage class stored as 'ZP' not '@zp'
      }
    });

    it('should parse @data const with empty brackets', () => {
      const decl = parseFirstDecl('@data const lookup: byte[] = [1, 2, 4, 8];');

      expect(isVariableDecl(decl)).toBe(true);
      if (isVariableDecl(decl)) {
        expect(decl.getName()).toBe('lookup');
        expect(decl.getTypeAnnotation()).toBe('byte[]');
        expect(decl.getStorageClass()).toBe('DATA'); // Storage class stored as 'DATA' not '@data'
        expect(decl.isConst()).toBe(true);
      }
    });
  });

  describe('Backward compatibility - explicit sizes still work', () => {
    it('should still parse byte[3] (explicit size)', () => {
      const decl = parseFirstDecl('let arr: byte[3] = [1, 2, 3];');

      expect(isVariableDecl(decl)).toBe(true);
      if (isVariableDecl(decl)) {
        expect(decl.getName()).toBe('arr');
        expect(decl.getTypeAnnotation()).toBe('byte[3]');
      }
    });

    it('should still parse word[10] (explicit size)', () => {
      const decl = parseFirstDecl('let values: word[10];');

      expect(isVariableDecl(decl)).toBe(true);
      if (isVariableDecl(decl)) {
        expect(decl.getName()).toBe('values');
        expect(decl.getTypeAnnotation()).toBe('word[10]');
        expect(decl.getInitializer()).toBeNull();
      }
    });
  });

  describe('Parser accepts empty brackets without initializer', () => {
    // Note: Semantic analyzer will enforce that initializer is required
    // Parser just parses the syntax
    it('should parse byte[] without initializer (semantic error later)', () => {
      const decl = parseFirstDecl('let arr: byte[];');

      expect(isVariableDecl(decl)).toBe(true);
      if (isVariableDecl(decl)) {
        expect(decl.getName()).toBe('arr');
        expect(decl.getTypeAnnotation()).toBe('byte[]');
        expect(decl.getInitializer()).toBeNull();
        // Semantic analyzer will report error: cannot infer size without initializer
      }
    });
  });
});
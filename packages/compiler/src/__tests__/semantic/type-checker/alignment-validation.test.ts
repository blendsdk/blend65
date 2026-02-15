/**
 * Alignment Validation Semantic Tests
 *
 * Tests the semantic analyzer's alignment validation for variable declarations:
 * - Valid alignment values pass without errors
 * - Alignment must be a power of 2 (S039 error)
 * - Alignment must be in range 2–16384 (S040 error)
 * - Sugar keywords (@sprite, @charset, etc.) always produce valid alignment
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import type { Program } from '../../../ast/index.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import { TypeSystem } from '../../../semantic/type-system.js';
import {
  DeclarationTypeChecker,
  TypeCheckPassResult,
  DeclarationDiagnosticCodes,
} from '../../../semantic/visitors/type-checker/index.js';

// ============================================
// TEST IMPLEMENTATION
// ============================================

/**
 * Concrete test implementation of DeclarationTypeChecker.
 * Since DeclarationTypeChecker is abstract (missing statement visitor methods),
 * we need a concrete class with stubs for testing declarations.
 */
class TestTypeChecker extends DeclarationTypeChecker {
  /**
   * Checks a program and returns the result
   * @param symbolTable - Pre-populated symbol table
   * @param program - The parsed AST
   * @returns Type check result with diagnostics
   */
  public check(symbolTable: SymbolTable, program: Program): TypeCheckPassResult {
    this.initializeState(symbolTable);
    this.walk(program);
    return this.finalizeResult();
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Parses source code into a Program AST
 * @param source - Blend65 source code
 * @returns Parsed Program AST node
 */
function parseProgram(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Runs the type checker on source code and returns results.
 * Pre-populates the symbol table with declared variables for proper resolution.
 *
 * @param source - Blend65 source code
 * @returns Object with type check result and checker instance
 */
function checkSource(source: string): { result: TypeCheckPassResult; checker: TestTypeChecker } {
  const typeSystem = new TypeSystem();
  const checker = new TestTypeChecker(typeSystem);
  const symbolTable = new SymbolTable();
  const program = parseProgram(source);

  // Pre-populate symbol table with declarations from the AST
  // so the type checker can find them when visiting
  for (const decl of program.getDeclarations()) {
    const loc = { line: 1, column: 1, offset: 0 };
    if ('getName' in decl) {
      const name = (decl as { getName(): string }).getName();
      const nodeType = decl.getNodeType();

      if (nodeType === 'VariableDecl') {
        const varDecl = decl as { getTypeAnnotation(): string | null; isConst(): boolean };
        const typeName = varDecl.getTypeAnnotation() ?? 'byte';
        // Resolve the base type (handles array types like byte[64] → byte)
        const baseTypeName = typeName.replace(/\[.*\]/, '');
        const type = typeSystem.getBuiltinType(baseTypeName) ?? typeSystem.getBuiltinType('byte')!;
        symbolTable.declareVariable(name, loc, type, {
          isConst: varDecl.isConst(),
          isExported: false,
        });
      }
    }
  }

  const result = checker.check(symbolTable, program);
  return { result, checker };
}

// ============================================
// TESTS
// ============================================

describe('Alignment Validation', () => {
  // ============================================
  // VALID ALIGNMENT VALUES (NO ERRORS EXPECTED)
  // ============================================

  describe('valid alignment values', () => {
    it('accepts @sprite sugar (alignment 64)', () => {
      const { result, checker } = checkSource(`
        module test;
        @sprite const data: byte = 0;
      `);

      // Check no alignment-specific errors
      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
          || d.code === DeclarationDiagnosticCodes.ALIGNMENT_OUT_OF_RANGE
      );
      expect(alignmentErrors).toHaveLength(0);
    });

    it('accepts @page sugar (alignment 256)', () => {
      const { result, checker } = checkSource(`
        module test;
        @page const table: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
          || d.code === DeclarationDiagnosticCodes.ALIGNMENT_OUT_OF_RANGE
      );
      expect(alignmentErrors).toHaveLength(0);
    });

    it('accepts @screen sugar (alignment 1024)', () => {
      const { result, checker } = checkSource(`
        module test;
        @screen const screenMem: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
          || d.code === DeclarationDiagnosticCodes.ALIGNMENT_OUT_OF_RANGE
      );
      expect(alignmentErrors).toHaveLength(0);
    });

    it('accepts @charset sugar (alignment 2048)', () => {
      const { result, checker } = checkSource(`
        module test;
        @charset const font: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
          || d.code === DeclarationDiagnosticCodes.ALIGNMENT_OUT_OF_RANGE
      );
      expect(alignmentErrors).toHaveLength(0);
    });

    it('accepts @bitmap sugar (alignment 8192)', () => {
      const { result, checker } = checkSource(`
        module test;
        @bitmap const gfx: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
          || d.code === DeclarationDiagnosticCodes.ALIGNMENT_OUT_OF_RANGE
      );
      expect(alignmentErrors).toHaveLength(0);
    });

    it('accepts @data(align: 64) explicit alignment', () => {
      const { result, checker } = checkSource(`
        module test;
        @data(align: 64) const data: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
          || d.code === DeclarationDiagnosticCodes.ALIGNMENT_OUT_OF_RANGE
      );
      expect(alignmentErrors).toHaveLength(0);
    });

    it('accepts @data(align: 16384) maximum valid alignment', () => {
      const { result, checker } = checkSource(`
        module test;
        @data(align: 16384) const data: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
          || d.code === DeclarationDiagnosticCodes.ALIGNMENT_OUT_OF_RANGE
      );
      expect(alignmentErrors).toHaveLength(0);
    });

    it('accepts @data(align: 2) minimum valid alignment', () => {
      const { result, checker } = checkSource(`
        module test;
        @data(align: 2) const data: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
          || d.code === DeclarationDiagnosticCodes.ALIGNMENT_OUT_OF_RANGE
      );
      expect(alignmentErrors).toHaveLength(0);
    });

    it('accepts @ram(align: 256) explicit RAM alignment', () => {
      const { result, checker } = checkSource(`
        module test;
        @ram(align: 256) let buffer: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
          || d.code === DeclarationDiagnosticCodes.ALIGNMENT_OUT_OF_RANGE
      );
      expect(alignmentErrors).toHaveLength(0);
    });
  });

  // ============================================
  // INVALID: NOT POWER OF 2 (S039)
  // ============================================

  describe('alignment not power of 2 (S039)', () => {
    it('rejects alignment 3', () => {
      const { result, checker } = checkSource(`
        module test;
        @data(align: 3) const data: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
      );
      expect(alignmentErrors).toHaveLength(1);
      expect(alignmentErrors[0].message).toContain('not a power of 2');
      expect(alignmentErrors[0].message).toContain('3');
    });

    it('rejects alignment 5', () => {
      const { result, checker } = checkSource(`
        module test;
        @data(align: 5) const data: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
      );
      expect(alignmentErrors).toHaveLength(1);
      expect(alignmentErrors[0].message).toContain('not a power of 2');
    });

    it('rejects alignment 100', () => {
      const { result, checker } = checkSource(`
        module test;
        @data(align: 100) const data: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
      );
      expect(alignmentErrors).toHaveLength(1);
      expect(alignmentErrors[0].message).toContain('not a power of 2');
    });

    it('rejects alignment 6', () => {
      const { result, checker } = checkSource(`
        module test;
        @ram(align: 6) let buf: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
      );
      expect(alignmentErrors).toHaveLength(1);
      expect(alignmentErrors[0].message).toContain('not a power of 2');
    });
  });

  // ============================================
  // INVALID: OUT OF RANGE (S040)
  // ============================================

  describe('alignment out of range (S040)', () => {
    it('rejects alignment 1 (below minimum)', () => {
      const { result, checker } = checkSource(`
        module test;
        @data(align: 1) const data: byte = 0;
      `);

      // alignment=1 is a power-of-2, but below the minimum of 2
      const diagnostics = checker.getDiagnostics();
      const rangeErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_OUT_OF_RANGE
      );
      expect(rangeErrors).toHaveLength(1);
      expect(rangeErrors[0].message).toContain('out of range');
      expect(rangeErrors[0].message).toContain('1');
    });
  });

  // ============================================
  // NO ALIGNMENT (NO ERRORS)
  // ============================================

  describe('no alignment produces no alignment errors', () => {
    it('plain @data has no alignment errors', () => {
      const { result, checker } = checkSource(`
        module test;
        @data const data: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
          || d.code === DeclarationDiagnosticCodes.ALIGNMENT_OUT_OF_RANGE
      );
      expect(alignmentErrors).toHaveLength(0);
    });

    it('plain let/const has no alignment errors', () => {
      const { result, checker } = checkSource(`
        module test;
        let x: byte = 0;
      `);

      const diagnostics = checker.getDiagnostics();
      const alignmentErrors = diagnostics.filter(
        (d) => d.code === DeclarationDiagnosticCodes.ALIGNMENT_NOT_POWER_OF_TWO
          || d.code === DeclarationDiagnosticCodes.ALIGNMENT_OUT_OF_RANGE
      );
      expect(alignmentErrors).toHaveLength(0);
    });
  });
});

/**
 * Alias Analysis Tests (Task 8.8 - Phase 8 Tier 3)
 *
 * Tests for pointer alias analysis and self-modifying code detection.
 * Covers:
 * - Points-to analysis
 * - Memory region detection
 * - Non-alias proofs
 * - Self-modifying code warnings
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { AliasAnalyzer } from '../../semantic/analysis/alias-analysis.js';
import {
  OptimizationMetadataKey,
  MemoryRegion,
} from '../../semantic/analysis/optimization-metadata-keys.js';
import { DiagnosticSeverity } from '../../ast/diagnostics.js';

/**
 * Helper: Parse and analyze source code
 */
function analyzeSource(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const symbolTable = new SymbolTable();
  const analyzer = new AliasAnalyzer(symbolTable);
  analyzer.analyze(ast);

  return {
    ast,
    symbolTable,
    analyzer,
    diagnostics: analyzer.getDiagnostics(),
  };
}

/**
 * Helper: Get identifier node by name
 */
function findIdentifier(ast: any, name: string): any {
  const identifiers: any[] = [];

  function walk(node: any): void {
    if (!node || typeof node !== 'object') return;

    // Check if this is an IdentifierExpression with matching name
    if (node.getNodeType && node.getNodeType() === 'IdentifierExpression') {
      if (node.getName && node.getName() === name) {
        identifiers.push(node);
      }
    }

    // Walk all properties
    for (const key of Object.keys(node)) {
      if (Array.isArray(node[key])) {
        for (const child of node[key]) {
          walk(child);
        }
      } else if (typeof node[key] === 'object') {
        walk(node[key]);
      }
    }
  }

  walk(ast);
  return identifiers[0];
}

describe('AliasAnalyzer', () => {
  describe('Memory Region Detection', () => {
    it('should detect zero-page region', () => {
      const source = `
        @map counter at $02: byte;
      `;

      const { ast } = analyzeSource(source);
      const counterDecl = ast.declarations[0];

      expect(counterDecl.metadata?.get(OptimizationMetadataKey.AliasMemoryRegion)).toBe(
        MemoryRegion.ZeroPage
      );
    });

    it('should detect hardware I/O region', () => {
      const source = `
        @map vicBorder at $D020: byte;
      `;

      const { ast } = analyzeSource(source);
      const borderDecl = ast.declarations[0];

      expect(borderDecl.metadata?.get(OptimizationMetadataKey.AliasMemoryRegion)).toBe(
        MemoryRegion.Hardware
      );
    });

    it('should detect RAM region for regular variables', () => {
      const source = `
        let counter: byte = 0;
      `;

      const { ast } = analyzeSource(source);
      const counterDecl = ast.declarations[0];

      expect(counterDecl.metadata?.get(OptimizationMetadataKey.AliasMemoryRegion)).toBe(
        MemoryRegion.RAM
      );
    });

    it('should detect ROM region', () => {
      const source = `
        @map basicRom at $A000: byte;
      `;

      const { ast } = analyzeSource(source);
      const romDecl = ast.declarations[0];

      expect(romDecl.metadata?.get(OptimizationMetadataKey.AliasMemoryRegion)).toBe(
        MemoryRegion.ROM
      );
    });
  });

  describe('Points-To Analysis', () => {
    it('should track direct assignment aliasing', () => {
      const source = `
        let x: byte = 0;
        let y: byte = x;
      `;

      const { ast } = analyzeSource(source);
      const yDecl = ast.declarations[1]; // y is second declaration

      const pointsTo = yDecl.metadata?.get(OptimizationMetadataKey.AliasPointsTo);
      expect(pointsTo).toBeDefined();

      // y points to x
      const pointsToNames = Array.from(pointsTo || []).map((sym: any) => sym.name);
      expect(pointsToNames).toContain('x');
    });

    it('should track address-of operator aliasing', () => {
      const source = `
        let counter: byte = 0;
        let ptr: word = @counter;
      `;

      const { ast } = analyzeSource(source);
      const ptrDecl = ast.declarations[1]; // ptr is second declaration

      const pointsTo = ptrDecl.metadata?.get(OptimizationMetadataKey.AliasPointsTo);

      // ptr points to counter
      const pointsToNames = Array.from(pointsTo || []).map((sym: any) => sym.name);
      expect(pointsToNames).toContain('counter');
    });

    it('should propagate aliasing transitively', () => {
      const source = `
        let a: byte = 0;
        let b: byte = a;
        let c: byte = b;
      `;

      const { ast } = analyzeSource(source);
      const cDecl = ast.declarations[2]; // c is third declaration

      const pointsTo = cDecl.metadata?.get(OptimizationMetadataKey.AliasPointsTo);

      // c should point to both b and a (transitive)
      const pointsToNames = Array.from(pointsTo || []).map((sym: any) => sym.name);
      expect(pointsToNames).toContain('b');
      expect(pointsToNames).toContain('a');
    });

    it('should handle complex aliasing chains', () => {
      const source = `
        let x: byte = 10;
        let y: byte = x;
        let z: byte = y;
        let w: byte = z;
      `;

      const { ast } = analyzeSource(source);
      const wDecl = ast.declarations[3]; // w is fourth declaration

      const pointsTo = wDecl.metadata?.get(OptimizationMetadataKey.AliasPointsTo);

      // w should point to z, y, and x (full chain)
      const pointsToNames = Array.from(pointsTo || []).map((sym: any) => sym.name);
      expect(pointsToNames).toContain('z');
      expect(pointsToNames).toContain('y');
      expect(pointsToNames).toContain('x');
    });
  });

  describe('Non-Alias Proofs', () => {
    it('should prove non-aliasing for different @map addresses', () => {
      const source = `
        @map screenRam at $0400: byte;
        @map colorRam at $D800: byte;
      `;

      const { ast } = analyzeSource(source);
      const screenDecl = ast.declarations[0]; // First declaration

      const nonAliasSet = screenDecl.metadata?.get(OptimizationMetadataKey.AliasNonAliasSet);

      // screenRam and colorRam have different addresses - proven non-alias
      const nonAliasNames = Array.from(nonAliasSet || []).map((sym: any) => sym.name);
      expect(nonAliasNames).toContain('colorRam');
    });

    it('should prove non-aliasing for different memory regions', () => {
      const source = `
        @map zpVar at $02: byte;
        @map ioReg at $D020: byte;
      `;

      const { ast } = analyzeSource(source);
      const zpDecl = ast.declarations[0]; // First declaration

      const nonAliasSet = zpDecl.metadata?.get(OptimizationMetadataKey.AliasNonAliasSet);

      // Zero-page and Hardware regions never alias
      const nonAliasNames = Array.from(nonAliasSet || []).map((sym: any) => sym.name);
      expect(nonAliasNames).toContain('ioReg');
    });

    it('should prove non-aliasing for Hardware vs RAM', () => {
      const source = `
        let ramVar: byte = 0;
        @map vicReg at $D000: byte;
      `;

      const { ast } = analyzeSource(source);
      const ramDecl = ast.declarations[0]; // First declaration

      const nonAliasSet = ramDecl.metadata?.get(OptimizationMetadataKey.AliasNonAliasSet);

      // RAM and Hardware regions never alias
      const nonAliasNames = Array.from(nonAliasSet || []).map((sym: any) => sym.name);
      expect(nonAliasNames).toContain('vicReg');
    });

    it('should handle multiple non-aliasing relationships', () => {
      const source = `
        @map reg1 at $D000: byte;
        @map reg2 at $D001: byte;
        @map reg3 at $D002: byte;
      `;

      const { ast } = analyzeSource(source);
      const reg1Decl = ast.declarations[0]; // First declaration

      const nonAliasSet = reg1Decl.metadata?.get(OptimizationMetadataKey.AliasNonAliasSet);

      // All three registers have different addresses
      const nonAliasNames = Array.from(nonAliasSet || []).map((sym: any) => sym.name);
      expect(nonAliasNames).toContain('reg2');
      expect(nonAliasNames).toContain('reg3');
    });
  });

  describe('Self-Modifying Code Detection', () => {
    it('should warn about writing to code address range (BASIC area)', () => {
      const source = `
        @map codeLocation at $0801: byte;
        function test(): void
          codeLocation = 0x60;
        end function
      `;

      const { diagnostics } = analyzeSource(source);

      const warnings = diagnostics.filter(d => d.severity === DiagnosticSeverity.WARNING);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain('self-modifying code');
      expect(warnings[0].message).toContain('$0801');
    });

    it('should warn about @map in code range', () => {
      const source = `
        @map modifyableCode at $2000: byte;
      `;

      const { diagnostics } = analyzeSource(source);

      const warnings = diagnostics.filter(d => d.severity === DiagnosticSeverity.WARNING);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain('code address');
      expect(warnings[0].message).toContain('$2000');
    });

    it('should warn about writing to KERNAL ROM range', () => {
      const source = `
        @map kernalLocation at $E000: byte;
      `;

      const { diagnostics } = analyzeSource(source);

      const warnings = diagnostics.filter(d => d.severity === DiagnosticSeverity.WARNING);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should NOT warn about I/O region writes', () => {
      const source = `
        @map vicBorder at $D020: byte;
        function test(): void
          vicBorder = 0;
        end function
      `;

      const { diagnostics } = analyzeSource(source);

      // I/O writes are normal - no self-modifying code warning
      const selfModWarnings = diagnostics.filter(
        d => d.severity === DiagnosticSeverity.WARNING && d.message.includes('self-modifying')
      );
      expect(selfModWarnings.length).toBe(0);
    });

    it('should NOT warn about zero-page writes', () => {
      const source = `
        @map temp at $02: byte;
        function test(): void
          temp = 42;
        end function
      `;

      const { diagnostics } = analyzeSource(source);

      // Zero-page writes are safe
      const selfModWarnings = diagnostics.filter(d => d.message.includes('self-modifying'));
      expect(selfModWarnings.length).toBe(0);
    });

    it('should mark self-modifying code in metadata', () => {
      const source = `
        @map codeAddr at $1000: byte;
        function test(): void
          codeAddr = 0xFF;
        end function
      `;

      const { ast } = analyzeSource(source);

      // Find function declaration using AST API
      const funcDecl = ast.declarations.find((d: any) => d.getNodeType() === 'FunctionDecl');
      const body = funcDecl.getBody();
      const assignment = body[0]; // First statement

      expect(assignment.metadata?.get(OptimizationMetadataKey.SelfModifyingCode)).toBe(true);
    });
  });

  describe('Function Parameters', () => {
    it('should track function parameters as memory locations', () => {
      const source = `
        function process(value: byte): void
          let temp: byte = value;
        end function
      `;

      const { ast } = analyzeSource(source);
      // Find function and get first local variable declaration
      const funcDecl = ast.declarations[0];
      const tempDecl = funcDecl.getBody()[0]; // First statement is temp variable

      const pointsTo = tempDecl.metadata?.get(OptimizationMetadataKey.AliasPointsTo);

      // temp points to value parameter
      const pointsToNames = Array.from(pointsTo || []).map((sym: any) => sym.name);
      expect(pointsToNames).toContain('value');
    });

    it('should detect parameter aliasing', () => {
      const source = `
        function swap(a: byte, b: byte): void
          let temp: byte = a;
        end function
      `;

      const { ast } = analyzeSource(source);
      // Find function and get first local variable declaration
      const funcDecl = ast.declarations[0];
      const tempDecl = funcDecl.getBody()[0]; // First statement is temp variable

      const pointsTo = tempDecl.metadata?.get(OptimizationMetadataKey.AliasPointsTo);
      const pointsToNames = Array.from(pointsTo || []).map((sym: any) => sym.name);

      expect(pointsToNames).toContain('a');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed aliasing and non-aliasing', () => {
      const source = `
        let x: byte = 0;
        let y: byte = x;
        @map ioReg at $D000: byte;
        let z: byte = 10;
      `;

      const { ast } = analyzeSource(source);
      const yDecl = ast.declarations[1]; // y is second declaration

      const pointsTo = yDecl.metadata?.get(OptimizationMetadataKey.AliasPointsTo);
      const nonAliasSet = yDecl.metadata?.get(OptimizationMetadataKey.AliasNonAliasSet);

      // y aliases x
      const pointsToNames = Array.from(pointsTo || []).map((sym: any) => sym.name);
      expect(pointsToNames).toContain('x');

      // y doesn't alias ioReg (different region)
      const nonAliasNames = Array.from(nonAliasSet || []).map((sym: any) => sym.name);
      expect(nonAliasNames).toContain('ioReg');
    });

    it('should handle C64 hardware register patterns', () => {
      const source = `
        @map vicBorder at $D020: byte;
        @map vicBackground at $D021: byte;
        @map spriteEnable at $D015: byte;
      `;

      const { ast } = analyzeSource(source);
      const borderDecl = ast.declarations[0]; // First declaration

      const region = borderDecl.metadata?.get(OptimizationMetadataKey.AliasMemoryRegion);
      const nonAliasSet = borderDecl.metadata?.get(OptimizationMetadataKey.AliasNonAliasSet);

      expect(region).toBe(MemoryRegion.Hardware);

      // All three registers have different addresses
      const nonAliasNames = Array.from(nonAliasSet || []).map((sym: any) => sym.name);
      expect(nonAliasNames).toContain('vicBackground');
      expect(nonAliasNames).toContain('spriteEnable');
    });

    it('should handle zero-page variable patterns', () => {
      const source = `
        @map zpCounter at $02: byte;
        @map zpTemp at $03: byte;
        let ramVar: byte = 0;
      `;

      const { ast } = analyzeSource(source);
      const zpCounterDecl = ast.declarations[0]; // First declaration

      const region = zpCounterDecl.metadata?.get(OptimizationMetadataKey.AliasMemoryRegion);
      const nonAliasSet = zpCounterDecl.metadata?.get(OptimizationMetadataKey.AliasNonAliasSet);

      expect(region).toBe(MemoryRegion.ZeroPage);

      // zpCounter doesn't alias zpTemp (different addresses)
      const nonAliasNames = Array.from(nonAliasSet || []).map((sym: any) => sym.name);
      expect(nonAliasNames).toContain('zpTemp');
    });

    it('should handle binary expression aliasing', () => {
      const source = `
      function addFive(): void
        let x: byte = 10;
        let y: byte = x + 5;
      end function
      `;

      const { ast } = analyzeSource(source);

      // Find the x identifier in the binary expression (x + 5)
      const xId = findIdentifier(ast, 'x');

      const pointsTo = xId?.metadata?.get(OptimizationMetadataKey.AliasPointsTo);

      // x should have points-to metadata
      expect(pointsTo).toBeDefined();
      const pointsToNames = Array.from(pointsTo || []).map((sym: any) => sym.name);
      expect(pointsToNames).toContain('x');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty program', () => {
      const source = ``;

      const { diagnostics } = analyzeSource(source);

      // Should not crash
      expect(diagnostics).toBeDefined();
    });

    it('should handle program with only declarations', () => {
      const source = `
        let x: byte;
        let y: byte;
      `;

      const { diagnostics } = analyzeSource(source);

      // Should analyze without errors
      const errors = diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
      expect(errors.length).toBe(0);
    });

    it('should handle programs without aliasing', () => {
      const source = `
        let x: byte = 1;
        let y: byte = 2;
        let z: byte = 3;
      `;

      const { ast } = analyzeSource(source);
      const xDecl = ast.declarations[0]; // First declaration

      // No aliasing - points-to set should exist (contains self-reference)
      const pointsTo = xDecl.metadata?.get(OptimizationMetadataKey.AliasPointsTo);
      expect(pointsTo).toBeDefined();
    });
  });
});
/**
 * Advanced Analyzer Orchestrator Tests (Task 8.14.5)
 *
 * Tests for the orchestrator update that adds GVN and CSE to Tier 3 analysis.
 * Verifies that all analyzers are called and metadata is properly attached.
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { AdvancedAnalyzer, OptimizationMetadataKey } from '../../../semantic/analysis/index.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import { ControlFlowGraph } from '../../../semantic/control-flow.js';
import { TypeSystem } from '../../../semantic/type-system.js';
import type { Program } from '../../../ast/nodes.js';
import { VariableDecl, FunctionDecl } from '../../../ast/nodes.js';

/**
 * Helper to parse and run advanced analysis
 */
function runAdvancedAnalysis(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const symbolTable = new SymbolTable();
  const cfgs = new Map<string, ControlFlowGraph>();
  const typeSystem = new TypeSystem(symbolTable);
  
  const advancedAnalyzer = new AdvancedAnalyzer(symbolTable, cfgs, typeSystem);
  advancedAnalyzer.analyze(ast);
  
  return {
    ast,
    diagnostics: advancedAnalyzer.getDiagnostics(),
    hasErrors: advancedAnalyzer.hasErrors(),
    hasWarnings: advancedAnalyzer.hasWarnings(),
  };
}

describe('AdvancedAnalyzer Orchestrator', () => {
  describe('GVN and CSE Integration', () => {
    it('should call GVN analyzer and attach GVNNumber metadata', () => {
      const source = `
let a: byte = 10;
let b: byte = 20;
let x: byte = a + b;
`;
      const { ast } = runAdvancedAnalysis(source);

      const declarations = ast.getDeclarations();
      const xDecl = declarations[2] as VariableDecl;
      expect(xDecl).toBeDefined();

      // The initializer should have GVN metadata
      const init = xDecl.getInitializer();
      expect(init).toBeDefined();
      expect(init!.metadata).toBeDefined();
      expect(init!.metadata!.has(OptimizationMetadataKey.GVNNumber)).toBe(true);
    });

    it('should call CSE analyzer and attach CSEAvailable metadata', () => {
      const source = `
let a: byte = 10;
let b: byte = 20;
let x: byte = a + b;
let y: byte = a + b;
`;
      const { ast } = runAdvancedAnalysis(source);

      const declarations = ast.getDeclarations();
      const yDecl = declarations[3] as VariableDecl;
      expect(yDecl).toBeDefined();

      // The y declaration should have CSEAvailable metadata
      expect(yDecl.metadata).toBeDefined();
      expect(yDecl.metadata!.has(OptimizationMetadataKey.CSEAvailable)).toBe(true);
    });

    it('should mark GVN redundant computations', () => {
      const source = `
let a: byte = 10;
let b: byte = 20;
let x: byte = a + b;
let y: byte = a + b;
`;
      const { ast } = runAdvancedAnalysis(source);

      const declarations = ast.getDeclarations();
      const yDecl = declarations[3] as VariableDecl;
      const yInit = yDecl.getInitializer();

      // Should have GVN redundant flag
      expect(yInit!.metadata!.get(OptimizationMetadataKey.GVNRedundant)).toBe(true);
      expect(yInit!.metadata!.get(OptimizationMetadataKey.GVNReplacement)).toBe('x');
    });

    it('should run Tier 3 pipeline for function with while loop', () => {
      const source = `
module Test

function test(): void
  let i: byte = 0
  while i < 10
    i = i + 1
  end while
end function
`;
      const { hasErrors, diagnostics } = runAdvancedAnalysis(source);

      // Should not have any analysis errors (warnings are OK)
      const errors = diagnostics.filter(d => d.severity === 1); // ERROR = 1
      expect(errors.length).toBe(0);
    });

    it('should collect diagnostics from GVN analyzer', () => {
      const source = `
let a: byte = 10;
let x: byte = a + a;
`;
      // GVN shouldn't produce warnings for normal code
      const { diagnostics } = runAdvancedAnalysis(source);
      
      // Just verify analysis completes without throwing
      expect(diagnostics).toBeDefined();
    });

    it('should collect diagnostics from CSE analyzer', () => {
      const source = `
let a: byte = 10;
let b: byte = 20;
let x: byte = a + b;
`;
      // CSE shouldn't produce warnings for normal code
      const { diagnostics } = runAdvancedAnalysis(source);
      
      // Just verify analysis completes without throwing
      expect(diagnostics).toBeDefined();
    });

    it('should handle programs with no functions gracefully', () => {
      const source = `let globalVar: byte = 100;`;
      const { hasErrors } = runAdvancedAnalysis(source);
      
      // Should complete without errors
      expect(hasErrors).toBe(false);
    });

    it('should handle complex C64 memory-mapped patterns', () => {
      const source = `
@map borderColor at $D020: byte;
@map screenMem at $0400: [byte; 1000];
@zp temp at $FB: byte;

function setBackground(color: byte): void
  borderColor = color;
end function
`;
      const { ast, hasErrors, diagnostics } = runAdvancedAnalysis(source);
      
      // Filter out just errors
      const errors = diagnostics.filter(d => d.severity === 1);
      expect(errors.length).toBe(0);
      
      // Verify functions were analyzed
      const funcs = ast.getDeclarations().filter(d => d instanceof FunctionDecl);
      expect(funcs.length).toBe(1);
    });

    it('should complete analysis in reasonable time for small programs', () => {
      const source = `
function compute(x: byte, y: byte): byte
  let result: byte = x + y;
  result = result * 2;
  result = result - 1;
  return result;
end function

function main(): void
  let a: byte = compute(10, 20);
  let b: byte = compute(30, 40);
  let c: byte = a + b;
end function
`;
      
      const startTime = Date.now();
      const { diagnostics } = runAdvancedAnalysis(source);
      const elapsed = Date.now() - startTime;
      
      // Just verify it completes
      expect(diagnostics).toBeDefined();
      // Should complete in under 1 second for small programs
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('Tier 3 Analyzer Order', () => {
    it('should run GVN before CSE for global declarations', () => {
      // This test verifies the order by checking metadata presence
      // GVN should run first
      const source = `
let a: byte = 10;
let b: byte = 20;
let x: byte = a + b;
let y: byte = a + b;
`;
      const { ast } = runAdvancedAnalysis(source);

      const declarations = ast.getDeclarations();

      // First declaration (x = a + b) should have GVNNumber
      const xDecl = declarations[2] as VariableDecl;
      const xInit = xDecl.getInitializer();
      expect(xInit!.metadata!.has(OptimizationMetadataKey.GVNNumber)).toBe(true);

      // Second declaration (y = a + b) should have both GVN and CSE metadata
      const yDecl = declarations[3] as VariableDecl;
      const yInit = yDecl.getInitializer();
      
      // GVN should have run and marked as redundant
      expect(yInit!.metadata!.has(OptimizationMetadataKey.GVNNumber)).toBe(true);
      expect(yInit!.metadata!.has(OptimizationMetadataKey.GVNRedundant)).toBe(true);
    });

    it('should process functions with both GVN and CSE', () => {
      const source = `
function test(): void
  let a: byte = 10
  let b: byte = 20
  let x: byte = a + b
  let y: byte = a + b
end function
`;
      const { ast } = runAdvancedAnalysis(source);

      const func = ast.getDeclarations().find(d => d instanceof FunctionDecl) as FunctionDecl;
      expect(func).toBeDefined();

      const body = func.getBody()!;
      expect(body.length).toBeGreaterThanOrEqual(4);

      // Find x and y declarations
      const xDecl = body.find(s => s instanceof VariableDecl && (s as VariableDecl).getName() === 'x') as VariableDecl;
      const yDecl = body.find(s => s instanceof VariableDecl && (s as VariableDecl).getName() === 'y') as VariableDecl;

      expect(xDecl).toBeDefined();
      expect(yDecl).toBeDefined();

      // x should have GVN metadata
      const xInit = xDecl.getInitializer();
      expect(xInit!.metadata!.has(OptimizationMetadataKey.GVNNumber)).toBe(true);

      // y should be marked as redundant by GVN
      const yInit = yDecl.getInitializer();
      expect(yInit!.metadata!.has(OptimizationMetadataKey.GVNNumber)).toBe(true);
      expect(yInit!.metadata!.get(OptimizationMetadataKey.GVNRedundant)).toBe(true);
    });
  });
});
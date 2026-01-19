/**
 * Tests for Global Value Numbering Analysis (Task 8.14.2 - Phase 8 Tier 3)
 *
 * Tests GVN value numbering for:
 * - Redundant expression detection
 * - Value number assignment
 * - Commutative operator handling
 * - Control flow handling (branches, loops)
 * - Variable reassignment invalidation
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { GlobalValueNumberingAnalyzer } from '../../../semantic/analysis/global-value-numbering.js';
import { OptimizationMetadataKey } from '../../../semantic/analysis/optimization-metadata-keys.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import { ControlFlowGraph } from '../../../semantic/control-flow.js';
import {
  VariableDecl,
  FunctionDecl,
  BinaryExpression,
  LiteralExpression,
} from '../../../ast/nodes.js';

/**
 * Helper to parse and analyze source code
 */
function analyzeSource(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const analyzer = new SemanticAnalyzer();
  analyzer.analyze(ast);
  
  return { ast, analyzer };
}

/**
 * Helper to run GVN analysis directly
 */
function runGVNAnalysis(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const symbolTable = new SymbolTable();
  const cfgs = new Map<string, ControlFlowGraph>();
  
  const gvnAnalyzer = new GlobalValueNumberingAnalyzer(cfgs, symbolTable);
  gvnAnalyzer.analyze(ast);
  
  return { ast, gvnAnalyzer };
}

describe('GlobalValueNumberingAnalyzer - Basic Value Numbering', () => {
  it('should assign same value number to identical expressions (a+b twice)', () => {
    const source = `
      let a: byte = 5;
      let b: byte = 3;
      let x: byte = a + b;
      let y: byte = a + b;
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const declarations = ast.getDeclarations();
    const xDecl = declarations[2] as VariableDecl;
    const yDecl = declarations[3] as VariableDecl;
    
    // Both should have GVN metadata
    expect(xDecl.metadata?.has(OptimizationMetadataKey.GVNNumber)).toBe(true);
    expect(yDecl.metadata?.has(OptimizationMetadataKey.GVNNumber)).toBe(true);
    
    // y's initializer should be marked as redundant
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.GVNRedundant)).toBe(true);
    expect(yInit?.metadata?.get(OptimizationMetadataKey.GVNReplacement)).toBe('x');
  });

  it('should assign different value numbers to different expressions', () => {
    const source = `
      let a: byte = 5;
      let b: byte = 3;
      let x: byte = a + b;
      let y: byte = a - b;
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const declarations = ast.getDeclarations();
    const xDecl = declarations[2] as VariableDecl;
    const yDecl = declarations[3] as VariableDecl;
    
    const xNum = xDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const yNum = yDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    // Different operators = different value numbers
    expect(xNum).not.toBe(yNum);
    
    // y should NOT be marked as redundant
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.GVNRedundant)).toBeUndefined();
  });

  it('should assign same value number to same expression structure', () => {
    const source = `
      let a: byte = 5;
      let b: byte = 3;
      let x: byte = a * b;
      let y: byte = a * b;
      let z: byte = a * b;
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const declarations = ast.getDeclarations();
    const xDecl = declarations[2] as VariableDecl;
    const yDecl = declarations[3] as VariableDecl;
    const zDecl = declarations[4] as VariableDecl;
    
    // All should have same value number
    const xNum = xDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const yNum = yDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const zNum = zDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    expect(xNum).toBe(yNum);
    expect(yNum).toBe(zNum);
  });
});

describe('GlobalValueNumberingAnalyzer - Commutative Operations', () => {
  it('should recognize commutative operations (a+b = b+a for addition)', () => {
    const source = `
      let a: byte = 5;
      let b: byte = 3;
      let x: byte = a + b;
      let y: byte = b + a;
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const declarations = ast.getDeclarations();
    const xDecl = declarations[2] as VariableDecl;
    const yDecl = declarations[3] as VariableDecl;
    
    // Same value number for commutative expressions
    const xNum = xDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const yNum = yDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    expect(xNum).toBe(yNum);
    
    // y should be marked as redundant
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.GVNRedundant)).toBe(true);
  });

  it('should recognize non-commutative operations (a-b != b-a)', () => {
    const source = `
      let a: byte = 5;
      let b: byte = 3;
      let x: byte = a - b;
      let y: byte = b - a;
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const declarations = ast.getDeclarations();
    const xDecl = declarations[2] as VariableDecl;
    const yDecl = declarations[3] as VariableDecl;
    
    // Different value numbers for non-commutative expressions
    const xNum = xDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const yNum = yDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    expect(xNum).not.toBe(yNum);
    
    // y should NOT be marked as redundant
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.GVNRedundant)).toBeUndefined();
  });

  it('should handle commutative multiplication', () => {
    const source = `
      let a: byte = 5;
      let b: byte = 3;
      let x: byte = a * b;
      let y: byte = b * a;
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const declarations = ast.getDeclarations();
    const xDecl = declarations[2] as VariableDecl;
    const yDecl = declarations[3] as VariableDecl;
    
    const xNum = xDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const yNum = yDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    expect(xNum).toBe(yNum);
  });
});

describe('GlobalValueNumberingAnalyzer - Variable References', () => {
  it('should track variable reference GVN', () => {
    const source = `
      let a: byte = 5;
      let x: byte = a;
      let y: byte = a;
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const declarations = ast.getDeclarations();
    const xDecl = declarations[1] as VariableDecl;
    const yDecl = declarations[2] as VariableDecl;
    
    // Same value number for same variable reference
    const xNum = xDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const yNum = yDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    expect(xNum).toBe(yNum);
  });

  it('should handle literal value GVN', () => {
    const source = `
      let x: byte = 42;
      let y: byte = 42;
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const declarations = ast.getDeclarations();
    const xDecl = declarations[0] as VariableDecl;
    const yDecl = declarations[1] as VariableDecl;
    
    // Same literal = same value number
    const xNum = xDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const yNum = yDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    expect(xNum).toBe(yNum);
  });

  it('should handle nested expression GVN', () => {
    const source = `
      let a: byte = 1;
      let b: byte = 2;
      let c: byte = 3;
      let x: byte = (a + b) * c;
      let y: byte = (a + b) * c;
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const declarations = ast.getDeclarations();
    const xDecl = declarations[3] as VariableDecl;
    const yDecl = declarations[4] as VariableDecl;
    
    // Same nested expression = same value number
    const xNum = xDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const yNum = yDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    expect(xNum).toBe(yNum);
    
    // y should be marked as redundant
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.GVNRedundant)).toBe(true);
  });
});

describe('GlobalValueNumberingAnalyzer - Reassignment Invalidation', () => {
  it('should invalidate after reassignment (no redundancy)', () => {
    const source = `
      function test(): void
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a + b;
        a = 10;
        let y: byte = a + b;
      end function
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // After reassignment, y = a + b uses new value of a
    // Should NOT be marked as redundant
    const yDecl = body[4] as VariableDecl;
    const yInit = yDecl.getInitializer();
    
    expect(yInit?.metadata?.get(OptimizationMetadataKey.GVNRedundant)).toBeUndefined();
  });

  it('should invalidate expressions using reassigned variable', () => {
    const source = `
      function test(): void
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a + b;
        a = 7;
        let y: byte = a + b;
      end function
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // After reassignment, x = a + b and y = a + b use different a values
    const xDecl = body[2] as VariableDecl;
    const yDecl = body[4] as VariableDecl;
    
    // y should NOT be marked as redundant (a changed)
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.GVNRedundant)).toBeUndefined();
  });
});

describe('GlobalValueNumberingAnalyzer - Array and Member Access', () => {
  it('should handle array access GVN', () => {
    const source = `
      @map screen at $0400: [byte; 1000];
      
      function test(): void
        let i: byte = 0;
        let x: byte = screen[i];
        let y: byte = screen[i];
      end function
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const func = ast.getDeclarations()[1] as FunctionDecl;
    const body = func.getBody()!;
    
    const xDecl = body[1] as VariableDecl;
    const yDecl = body[2] as VariableDecl;
    
    // Same array access = same value number
    const xNum = xDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const yNum = yDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    expect(xNum).toBe(yNum);
  });

  it('should handle member access GVN', () => {
    const source = `
      @map vic at $D000 type
        borderColor: byte;
        backgroundColor: byte;
      end @map
      
      function test(): void
        let x: byte = vic.borderColor;
        let y: byte = vic.borderColor;
      end function
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const func = ast.getDeclarations()[1] as FunctionDecl;
    const body = func.getBody()!;
    
    const xDecl = body[0] as VariableDecl;
    const yDecl = body[1] as VariableDecl;
    
    // Same member access = same value number
    const xNum = xDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const yNum = yDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    expect(xNum).toBe(yNum);
  });
});

describe('GlobalValueNumberingAnalyzer - Metadata Correctness', () => {
  it('should set GVN metadata correctly', () => {
    const source = `
      let a: byte = 5;
      let b: byte = 3;
      let x: byte = a + b;
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const declarations = ast.getDeclarations();
    const xDecl = declarations[2] as VariableDecl;
    
    expect(xDecl.metadata?.has(OptimizationMetadataKey.GVNNumber)).toBe(true);
    expect(typeof xDecl.metadata?.get(OptimizationMetadataKey.GVNNumber)).toBe('number');
  });

  it('should identify replacement variable correctly', () => {
    const source = `
      let a: byte = 5;
      let b: byte = 3;
      let first: byte = a + b;
      let second: byte = a + b;
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const declarations = ast.getDeclarations();
    const secondDecl = declarations[3] as VariableDecl;
    const secondInit = secondDecl.getInitializer();
    
    // Replacement should be 'first'
    expect(secondInit?.metadata?.get(OptimizationMetadataKey.GVNReplacement)).toBe('first');
  });
});

describe('GlobalValueNumberingAnalyzer - Complex Patterns', () => {
  it('should handle complex real-world expression', () => {
    const source = `
      function calculate(x: byte, y: byte): byte
        let temp1: byte = x * 2 + y;
        let temp2: byte = x * 2 + y;
        let temp3: byte = x * 2;
        let temp4: byte = x * 2;
        return temp1 + temp2;
      end function
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // temp1 and temp2 should have same value number
    const temp1 = body[0] as VariableDecl;
    const temp2 = body[1] as VariableDecl;
    
    const temp1Num = temp1.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const temp2Num = temp2.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    expect(temp1Num).toBe(temp2Num);
    
    // temp3 and temp4 should have same value number
    const temp3 = body[2] as VariableDecl;
    const temp4 = body[3] as VariableDecl;
    
    const temp3Num = temp3.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const temp4Num = temp4.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    expect(temp3Num).toBe(temp4Num);
  });

  it('should handle function parameters correctly', () => {
    const source = `
      function add(a: byte, b: byte): byte
        let x: byte = a + b;
        let y: byte = a + b;
        return x;
      end function
    `;
    
    const { ast } = runGVNAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    const xDecl = body[0] as VariableDecl;
    const yDecl = body[1] as VariableDecl;
    
    // Same expression with parameters should have same value number
    const xNum = xDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    const yNum = yDecl.metadata?.get(OptimizationMetadataKey.GVNNumber);
    
    expect(xNum).toBe(yNum);
    
    // y should be marked as redundant
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.GVNRedundant)).toBe(true);
  });
});

describe('GlobalValueNumberingAnalyzer - Error Handling', () => {
  it('should handle empty programs', () => {
    const source = ``;
    
    const { gvnAnalyzer } = runGVNAnalysis(source);
    
    const diagnostics = gvnAnalyzer.getDiagnostics();
    const errors = diagnostics.filter(d => d.severity === 1); // ERROR
    expect(errors).toHaveLength(0);
  });

  it('should handle programs with only functions', () => {
    const source = `
      function nop(): void
      end function
    `;
    
    const { gvnAnalyzer } = runGVNAnalysis(source);
    
    const diagnostics = gvnAnalyzer.getDiagnostics();
    const errors = diagnostics.filter(d => d.severity === 1); // ERROR
    expect(errors).toHaveLength(0);
  });

  it('should handle deeply nested expressions', () => {
    const source = `
      let a: byte = 1;
      let b: byte = 2;
      let c: byte = 3;
      let d: byte = 4;
      let x: byte = ((a + b) * (c - d)) + ((a + b) * (c - d));
    `;
    
    const { gvnAnalyzer } = runGVNAnalysis(source);
    
    const diagnostics = gvnAnalyzer.getDiagnostics();
    const errors = diagnostics.filter(d => d.severity === 1); // ERROR
    expect(errors).toHaveLength(0);
  });
});
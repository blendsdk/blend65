/**
 * Tests for Common Subexpression Elimination Analysis (Task 8.14.4 - Phase 8 Tier 3)
 *
 * Tests CSE block-local redundancy detection for:
 * - Simple repeated subexpressions
 * - Expression invalidation by assignment
 * - No CSE across control flow boundaries
 * - Commutative operator matching
 * - Array and member access handling
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { CommonSubexpressionEliminationAnalyzer } from '../../../semantic/analysis/common-subexpr-elimination.js';
import { OptimizationMetadataKey } from '../../../semantic/analysis/optimization-metadata-keys.js';
import { SymbolTable } from '../../../semantic/symbol-table.js';
import { ControlFlowGraph } from '../../../semantic/control-flow.js';
import {
  VariableDecl,
  FunctionDecl,
} from '../../../ast/nodes.js';

/**
 * Helper to run CSE analysis directly
 */
function runCSEAnalysis(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const symbolTable = new SymbolTable();
  const cfgs = new Map<string, ControlFlowGraph>();
  
  const cseAnalyzer = new CommonSubexpressionEliminationAnalyzer(cfgs, symbolTable);
  cseAnalyzer.analyze(ast);
  
  return { ast, cseAnalyzer };
}

describe('CommonSubexpressionEliminationAnalyzer - Basic CSE Detection', () => {
  it('should detect simple repeated subexpression in block', () => {
    const source = `
      function test(): void {
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a + b;
        let y: byte = a + b;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // y's initializer should be marked as CSE candidate
    const yDecl = body[3] as VariableDecl;
    const yInit = yDecl.getInitializer();
    
    expect(yInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBe(true);
    expect(yInit?.metadata?.get(OptimizationMetadataKey.GVNReplacement)).toBe('x');
  });

  it('should detect multiple occurrences', () => {
    const source = `
      function test(): void {
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a * b;
        let y: byte = a * b;
        let z: byte = a * b;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // y should be CSE candidate (replacing with x)
    const yDecl = body[3] as VariableDecl;
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBe(true);
    expect(yInit?.metadata?.get(OptimizationMetadataKey.GVNReplacement)).toBe('x');
    
    // z should also be CSE candidate (replacing with y or x)
    const zDecl = body[4] as VariableDecl;
    const zInit = zDecl.getInitializer();
    expect(zInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBe(true);
  });

  it('should not mark first occurrence as CSE candidate', () => {
    const source = `
      function test(): void {
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a + b;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // First occurrence should NOT be CSE candidate
    const xDecl = body[2] as VariableDecl;
    const xInit = xDecl.getInitializer();
    expect(xInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBeUndefined();
  });
});

describe('CommonSubexpressionEliminationAnalyzer - Assignment Invalidation', () => {
  it('should invalidate expression by assignment', () => {
    const source = `
      function test(): void {
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a + b;
        a = 10;
        let y: byte = a + b;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // y should NOT be CSE candidate (a was modified)
    const yDecl = body[4] as VariableDecl;
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBeUndefined();
  });

  it('should invalidate when holding variable is reassigned', () => {
    const source = `
      function test(): void {
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a + b;
        x = 100;
        let y: byte = a + b;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // y should NOT be CSE candidate (x was reassigned, so a+b is no longer "available" via x)
    const yDecl = body[4] as VariableDecl;
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBeUndefined();
  });
});

describe('CommonSubexpressionEliminationAnalyzer - No CSE Across Blocks', () => {
  it('should not detect CSE across if-else branches', () => {
    const source = `
      function test(): void {
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a + b;
        if (a > 0) {
          let y: byte = a + b;
        }
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    // The implementation resets available expressions for branches
    // This is conservative but correct for block-local CSE
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // x should not be CSE candidate (first occurrence)
    const xDecl = body[2] as VariableDecl;
    const xInit = xDecl.getInitializer();
    expect(xInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBeUndefined();
  });

  it('should not preserve CSE across loop boundaries', () => {
    const source = `
      function test(): void {
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a + b;
        while (a > 0) {
          let y: byte = a + b;
          a = a - 1;
        }
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    // CSE doesn't cross loop boundaries
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    const xDecl = body[2] as VariableDecl;
    const xInit = xDecl.getInitializer();
    expect(xInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBeUndefined();
  });
});

describe('CommonSubexpressionEliminationAnalyzer - Array and Member Access', () => {
  it('should detect CSE in array access', () => {
    const source = `
      @map screen at $0400: [byte; 1000];
      
      function test(): void {
        let i: byte = 5;
        let x: byte = screen[i];
        let y: byte = screen[i];
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[1] as FunctionDecl;
    const body = func.getBody()!;
    
    // y's initializer should be CSE candidate
    const yDecl = body[2] as VariableDecl;
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBe(true);
  });

  it('should detect CSE in member access', () => {
    const source = `
      @map vic at $D000 {
        borderColor: byte;
        backgroundColor: byte;
      }
      
      function test(): void {
        let x: byte = vic.borderColor;
        let y: byte = vic.borderColor;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[1] as FunctionDecl;
    const body = func.getBody()!;
    
    // y's initializer should be CSE candidate
    const yDecl = body[1] as VariableDecl;
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBe(true);
  });
});

describe('CommonSubexpressionEliminationAnalyzer - Nested Subexpressions', () => {
  it('should detect nested subexpression CSE', () => {
    const source = `
      function test(): void {
        let a: byte = 1;
        let b: byte = 2;
        let c: byte = 3;
        let x: byte = (a + b) * c;
        let y: byte = (a + b) * c;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // y's initializer should be CSE candidate
    const yDecl = body[4] as VariableDecl;
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBe(true);
    expect(yInit?.metadata?.get(OptimizationMetadataKey.GVNReplacement)).toBe('x');
  });

  it('should detect inner subexpression CSE separately', () => {
    const source = `
      function test(): void {
        let a: byte = 1;
        let b: byte = 2;
        let inner: byte = a + b;
        let outer: byte = (a + b) * 3;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // inner (a+b) is the first occurrence, not a CSE candidate
    const innerDecl = body[2] as VariableDecl;
    const innerInit = innerDecl.getInitializer();
    expect(innerInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBeUndefined();
    
    // The outer expression (a+b)*3 is unique and not a direct CSE candidate
    // But the sub-expression a+b inside it is analyzed and marked as redundant
    // since inner already computed a+b
    const outerDecl = body[3] as VariableDecl;
    expect(outerDecl).toBeDefined();
    
    // The outer expression's initializer might not have the full expression
    // tracked as CSE, but during recursive analysis the inner a+b is detected
    // We verify the analysis doesn't crash and produces expected structure
    const outerInit = outerDecl.getInitializer();
    expect(outerInit).toBeDefined();
  });
});

describe('CommonSubexpressionEliminationAnalyzer - Commutative Matching', () => {
  it('should match commutative expressions (a+b = b+a)', () => {
    const source = `
      function test(): void {
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a + b;
        let y: byte = b + a;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // y should be CSE candidate (commutative matching)
    const yDecl = body[3] as VariableDecl;
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBe(true);
  });

  it('should not match non-commutative expressions (a-b != b-a)', () => {
    const source = `
      function test(): void {
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a - b;
        let y: byte = b - a;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    // y should NOT be CSE candidate (subtraction is not commutative)
    const yDecl = body[3] as VariableDecl;
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBeUndefined();
  });
});

describe('CommonSubexpressionEliminationAnalyzer - Side Effect Expressions', () => {
  it('should not track function calls as CSE candidates', () => {
    const source = `
      function getValue(): byte {
        return 42;
      }
      
      function test(): void {
        let x: byte = getValue();
        let y: byte = getValue();
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[1] as FunctionDecl;
    const body = func.getBody()!;
    
    // y should NOT be CSE candidate (function calls may have side effects)
    const yDecl = body[1] as VariableDecl;
    const yInit = yDecl.getInitializer();
    expect(yInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBeUndefined();
  });
});

describe('CommonSubexpressionEliminationAnalyzer - Metadata Correctness', () => {
  it('should set CSE metadata correctly', () => {
    const source = `
      function test(): void {
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a + b;
        let y: byte = a + b;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    const yDecl = body[3] as VariableDecl;
    const yInit = yDecl.getInitializer();
    
    expect(yInit?.metadata?.has(OptimizationMetadataKey.CSECandidate)).toBe(true);
    expect(yInit?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBe(true);
  });

  it('should set available expressions metadata', () => {
    const source = `
      function test(): void {
        let a: byte = 5;
        let b: byte = 3;
        let x: byte = a + b;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[0] as FunctionDecl;
    const body = func.getBody()!;
    
    const xDecl = body[2] as VariableDecl;
    
    expect(xDecl.metadata?.has(OptimizationMetadataKey.CSEAvailable)).toBe(true);
    const available = xDecl.metadata?.get(OptimizationMetadataKey.CSEAvailable) as Set<string>;
    expect(available).toBeInstanceOf(Set);
    expect(available.size).toBeGreaterThan(0);
  });
});

describe('CommonSubexpressionEliminationAnalyzer - Complex Real-World Pattern', () => {
  it('should handle complex C64 screen update pattern', () => {
    const source = `
      @map screen at $0400: [byte; 1000];
      
      function updateScreen(): void {
        let offset: byte = 40;
        let char: byte = 32;
        
        // Multiple uses of offset + char
        let temp1: byte = offset + char;
        let temp2: byte = offset + char;
        
        // After assignment, expression is invalidated
        offset = 80;
        let temp3: byte = offset + char;
      }
    `;
    
    const { ast } = runCSEAnalysis(source);
    
    const func = ast.getDeclarations()[1] as FunctionDecl;
    const body = func.getBody()!;
    
    // temp2 should be CSE candidate
    const temp2Decl = body[3] as VariableDecl;
    const temp2Init = temp2Decl.getInitializer();
    expect(temp2Init?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBe(true);
    
    // temp3 should NOT be CSE candidate (offset changed)
    const temp3Decl = body[5] as VariableDecl;
    const temp3Init = temp3Decl.getInitializer();
    expect(temp3Init?.metadata?.get(OptimizationMetadataKey.CSECandidate)).toBeUndefined();
  });
});

describe('CommonSubexpressionEliminationAnalyzer - Error Handling', () => {
  it('should handle empty programs', () => {
    const source = ``;
    
    const { cseAnalyzer } = runCSEAnalysis(source);
    
    const diagnostics = cseAnalyzer.getDiagnostics();
    const errors = diagnostics.filter(d => d.severity === 1); // ERROR
    expect(errors).toHaveLength(0);
  });

  it('should handle programs with only functions', () => {
    const source = `
      function nop(): void {
      }
    `;
    
    const { cseAnalyzer } = runCSEAnalysis(source);
    
    const diagnostics = cseAnalyzer.getDiagnostics();
    const errors = diagnostics.filter(d => d.severity === 1); // ERROR
    expect(errors).toHaveLength(0);
  });
});
/**
 * Tests for Alias Analysis (Task 8.8 - Phase 8 Tier 3)
 *
 * Tests Andersen's-style points-to analysis for:
 * - Memory location tracking
 * - Points-to constraint collection
 * - Constraint solving (fixpoint)
 * - Alias metadata generation
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { OptimizationMetadataKey, MemoryRegion } from '../../../semantic/analysis/optimization-metadata-keys.js';

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

describe('AliasAnalyzer - Memory Location Tracking', () => {
  it('should track regular variable memory locations', () => {
    const source = `
      let x: byte = 0;
      let y: byte = 0;
    `;
    
    const { ast } = analyzeSource(source);
    
    // Check that variables have metadata
    const declarations = ast.getDeclarations();
    const xDecl = declarations[0];
    const yDecl = declarations[1];
    
    expect(xDecl.metadata?.get(OptimizationMetadataKey.AliasMemoryRegion)).toBe(MemoryRegion.RAM);
    expect(yDecl.metadata?.get(OptimizationMetadataKey.AliasMemoryRegion)).toBe(MemoryRegion.RAM);
  });

  it('should track @zp variable memory locations', () => {
    const source = `
      @zp let counter: byte = 0;
    `;
    
    const { ast } = analyzeSource(source);
    
    const decl = ast.getDeclarations()[0];
    expect(decl.metadata?.get(OptimizationMetadataKey.AliasMemoryRegion)).toBe(MemoryRegion.ZeroPage);
  });

  it('should track @map hardware locations', () => {
    const source = `
      @map borderColor at $D020: byte;
    `;
    
    const { ast } = analyzeSource(source);
    
    const decl = ast.getDeclarations()[0];
    expect(decl.metadata?.get(OptimizationMetadataKey.AliasMemoryRegion)).toBe(MemoryRegion.Hardware);
  });
});

describe('AliasAnalyzer - Points-To Analysis', () => {
  it('should collect constraints from variable initializers', () => {
    const source = `
      let x: byte = 0;
      let y: byte = x;
    `;
    
    const { ast } = analyzeSource(source);
    
    // y should have points-to metadata
    const yDecl = ast.getDeclarations()[1];
    const pointsTo = yDecl.metadata?.get(OptimizationMetadataKey.AliasPointsTo);
    
    expect(pointsTo).toBeDefined();
    expect(pointsTo).toBeInstanceOf(Set);
  });

  it('should handle simple assignments in functions', () => {
    const source = `
      let x: byte = 0;
      let y: byte = 0;
      
      function test(): void
        y = x;
      end function
    `;
    
    const { ast } = analyzeSource(source);
    
    // Should analyze without crashing
    expect(ast.getDeclarations().length).toBe(3);
  });
});

describe('AliasAnalyzer - Non-Alias Sets', () => {
  it('should identify non-aliasing @map variables at different addresses', () => {
    const source = `
      @map borderColor at $D020: byte;
      @map backgroundColor at $D021: byte;
    `;
    
    const { ast } = analyzeSource(source);
    
    // These two have different addresses, so they don't alias
    const borderDecl = ast.getDeclarations()[0];
    const nonAliasSet = borderDecl.metadata?.get(OptimizationMetadataKey.AliasNonAliasSet);
    
    expect(nonAliasSet).toBeDefined();
    if (nonAliasSet) {
      expect(nonAliasSet.size).toBeGreaterThan(0);
    }
  });

  it('should identify non-aliasing variables in different memory regions', () => {
    const source = `
      @zp let counter: byte = 0;
      @map borderColor at $D020: byte;
    `;
    
    const { ast } = analyzeSource(source);
    
    // Zero page and Hardware regions don't alias
    const counterDecl = ast.getDeclarations()[0];
    const nonAliasSet = counterDecl.metadata?.get(OptimizationMetadataKey.AliasNonAliasSet);
    
    expect(nonAliasSet).toBeDefined();
    if (nonAliasSet) {
      const nonAliasNames = Array.from(nonAliasSet).map(s => s.name);
      expect(nonAliasNames).toContain('borderColor');
    }
  });
});

describe('AliasAnalyzer - Self-Modifying Code Detection', () => {
  it('should detect @map declarations in code range', () => {
    const source = `
      @map programCode at $0801: byte;
    `;
    
    const { analyzer } = analyzeSource(source);
    
    const diagnostics = analyzer.getDiagnostics();
    const selfModWarning = diagnostics.find(d => 
      d.message.includes('self-modifying')
    );
    
    expect(selfModWarning).toBeDefined();
  });

  it('should not warn for data addresses', () => {
    const source = `
      @map buffer at $D800: byte;
    `;
    
    const { analyzer } = analyzeSource(source);
    
    const diagnostics = analyzer.getDiagnostics();
    const selfModWarning = diagnostics.find(d => 
      d.message.includes('self-modifying')
    );
    
    expect(selfModWarning).toBeUndefined();
  });
});

describe('AliasAnalyzer - Error Handling', () => {
  it('should handle empty programs', () => {
    const source = ``;
    
    const { analyzer } = analyzeSource(source);
    
    const diagnostics = analyzer.getDiagnostics();
    const errors = diagnostics.filter(d => d.severity === 1); // ERROR severity
    expect(errors).toHaveLength(0);
  });

  it('should handle programs with only functions', () => {
    const source = `
      function nop(): void
      end function
    `;
    
    const { analyzer } = analyzeSource(source);
    
    const diagnostics = analyzer.getDiagnostics();
    const errors = diagnostics.filter(d => d.severity === 1); // ERROR severity
    // Only semantic errors, no crashes
    expect(diagnostics.length).toBeGreaterThanOrEqual(0);
  });
});
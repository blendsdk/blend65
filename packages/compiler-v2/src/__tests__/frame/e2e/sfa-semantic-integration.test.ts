/**
 * E2E Tests: SFA Semantic Integration
 *
 * Tests the integration of Frame Allocator with Semantic Analyzer.
 * Verifies that analyzed programs have correct frame allocations.
 *
 * @module __tests__/frame/e2e/sfa-semantic-integration
 */

import { describe, it, expect } from 'vitest';
import { SemanticAnalyzer, type AnalysisResult } from '../../../semantic/analyzer.js';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { C64_PLATFORM_CONFIG, X16_PLATFORM_CONFIG } from '../../../frame/platform.js';

/**
 * Helper to parse and analyze a Blend program
 */
function analyzeProgram(source: string, options?: Parameters<typeof SemanticAnalyzer>[0]): AnalysisResult {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();
  
  const analyzer = new SemanticAnalyzer(options);
  return analyzer.analyze(program);
}

describe('SFA Semantic Integration E2E', () => {
  describe('Semantic Analyzer Integration', () => {
    it('should include frameMap in analysis result when enabled', () => {
      const source = `
        module test;
        
        let x: byte = 42;
      `;
      
      const result = analyzeProgram(source);
      
      // Analysis should succeed
      expect(result.success).toBe(true);
      
      // Frame map should be defined (even if empty for module-level code)
      expect(result.frameMap).toBeDefined();
      expect(result.frameAllocationStats).toBeDefined();
    });

    it('should not include frameMap when frame allocation is disabled', () => {
      const source = `
        module test;
        
        let x: byte = 42;
      `;
      
      const result = analyzeProgram(source, {
        runFrameAllocation: false,
      });
      
      expect(result.success).toBe(true);
      expect(result.frameMap).toBeUndefined();
      expect(result.frameAllocationStats).toBeUndefined();
    });

    it('should include frameAllocation in passResults when enabled', () => {
      const source = `
        module test;
        
        let x: byte = 1;
      `;
      
      const result = analyzeProgram(source);
      
      expect(result.success).toBe(true);
      expect(result.passResults.frameAllocation).toBeDefined();
      expect(result.passResults.frameAllocation!.success).toBe(true);
    });

    it('should not include frameAllocation in passResults when disabled', () => {
      const source = `
        module test;
        
        let x: byte = 1;
      `;
      
      const result = analyzeProgram(source, {
        runFrameAllocation: false,
      });
      
      expect(result.success).toBe(true);
      expect(result.passResults.frameAllocation).toBeUndefined();
    });
  });

  describe('Platform Configuration', () => {
    it('should use C64 platform config by default', () => {
      const source = `
        module test;
        
        let x: byte = 1;
      `;
      
      const result = analyzeProgram(source);
      
      expect(result.success).toBe(true);
      expect(result.frameAllocationStats).toBeDefined();
      expect(result.frameAllocationStats!.zpBytesAvailable).toBe(C64_PLATFORM_CONFIG.zpAvailable);
    });

    it('should use X16 platform config when specified', () => {
      const source = `
        module test;
        
        let x: byte = 1;
      `;
      
      const result = analyzeProgram(source, {
        platformConfig: X16_PLATFORM_CONFIG,
      });
      
      expect(result.success).toBe(true);
      expect(result.frameAllocationStats).toBeDefined();
      expect(result.frameAllocationStats!.zpBytesAvailable).toBe(X16_PLATFORM_CONFIG.zpAvailable);
    });
  });

  describe('Frame Allocation Statistics', () => {
    it('should track ZP allocation stats', () => {
      const source = `
        module test;
        
        let x: byte = 1;
      `;
      
      const result = analyzeProgram(source);
      
      expect(result.success).toBe(true);
      expect(result.frameAllocationStats).toBeDefined();
      
      const stats = result.frameAllocationStats!;
      
      // ZP stats should be populated
      expect(stats.zpBytesAvailable).toBeGreaterThan(0);
      expect(stats.frameRegionBytesAvailable).toBeGreaterThan(0);
    });

    it('should report zero frames when no functions present', () => {
      const source = `
        module test;
        
        let x: byte = 1;
      `;
      
      const result = analyzeProgram(source);
      
      expect(result.success).toBe(true);
      expect(result.frameAllocationStats!.functionCount).toBe(0);
      expect(result.frameAllocationStats!.framesAllocated).toBe(0);
    });
  });

  describe('Call Graph Integration', () => {
    it('should have call graph available alongside frame map', () => {
      const source = `
        module test;
        
        let x: byte = 1;
      `;
      
      const result = analyzeProgram(source);
      
      expect(result.success).toBe(true);
      expect(result.callGraph).toBeDefined();
      expect(result.frameMap).toBeDefined();
    });
  });

  // Tests for function frame allocation
  describe('Function Frame Allocation', () => {
    it('should allocate frames for simple function with local variables', () => {
      const source = `
        module test;
        
        function getValue(): byte {
          let x: byte = 42;
          return x;
        }
      `;
      
      const result = analyzeProgram(source);
      
      expect(result.success).toBe(true);
      expect(result.frameMap!.size).toBeGreaterThan(0);
      expect(result.frameMap!.has('getValue')).toBe(true);
    });

    it('should allocate frames for multiple functions', () => {
      const source = `
        module test;
        
        function foo(): byte { let x: byte = 1; return x; }
        function bar(): byte { let y: byte = 2; return y; }
        function baz(): byte { let z: byte = 3; return z; }
      `;
      
      const result = analyzeProgram(source);
      
      expect(result.success).toBe(true);
      expect(result.frameMap!.size).toBe(3);
    });

    it('should assign base addresses in frame region', () => {
      const source = `
        module test;
        
        function first(): byte { let a: byte = 1; return a; }
        function second(): byte { let b: byte = 2; return b; }
      `;
      
      const result = analyzeProgram(source);
      
      expect(result.success).toBe(true);
      
      const firstFrame = result.frameMap!.get('first');
      const secondFrame = result.frameMap!.get('second');
      
      expect(firstFrame).toBeDefined();
      expect(secondFrame).toBeDefined();
      expect(firstFrame!.baseAddress).toBeGreaterThanOrEqual(C64_PLATFORM_CONFIG.frameRegionStart);
    });

    it('should not allocate frames for stub functions', () => {
      const source = `
        module test;
        
        export function external_stub(): byte;
        function real_function(): byte { let y: byte = 1; return y; }
      `;
      
      const result = analyzeProgram(source);
      
      expect(result.success).toBe(true);
      expect(result.frameMap!.has('external_stub')).toBe(false);
      expect(result.frameMap!.has('real_function')).toBe(true);
    });
  });
});
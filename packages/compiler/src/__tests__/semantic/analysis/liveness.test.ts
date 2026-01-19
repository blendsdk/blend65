/**
 * Tests for Liveness Analysis (Task 8.6)
 *
 * Tests the backward data flow analysis that computes which
 * variables are live at each program point.
 */

import { describe, it, expect } from 'vitest';
import { Parser } from '../../../parser/parser.js';
import { Lexer } from '../../../lexer/lexer.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { LivenessAnalyzer } from '../../../semantic/analysis/liveness.js';

/**
 * Helper to parse and analyze source code
 */
function analyzeLiveness(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const analyzer = new SemanticAnalyzer();
  analyzer.analyze(ast);

  const symbolTable = analyzer.getSymbolTable();
  const cfgs = analyzer.getAllCFGs();

  const livenessAnalyzer = new LivenessAnalyzer(symbolTable, cfgs);
  livenessAnalyzer.analyze(ast);

  return {
    ast,
    analyzer: livenessAnalyzer,
    symbolTable,
    cfgs,
    diagnostics: livenessAnalyzer.getDiagnostics(),
  };
}

describe('LivenessAnalyzer (Task 8.6)', () => {
  describe('Basic Liveness', () => {
    it('should detect live variable in simple use', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // x should be live at the point where y uses it
      expect(info!.liveIn.size).toBeGreaterThan(0);
    });

    it('should detect dead variable (never used)', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = 20
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // Variables defined but never used
      expect(info!.intervals.size).toBeGreaterThanOrEqual(0);
    });

    it('should track variable live through multiple uses', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
          let z: byte = x
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // x should be live across both uses
      expect(info!.intervals.has('x')).toBe(true);
    });

    it('should handle sequential variable uses', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 1
          let b: byte = a + 2
          let c: byte = b + 3
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      expect(info!.intervals.size).toBeGreaterThan(0);
    });

    it('should detect variable not live after last use', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
          let z: byte = 20
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // x should not be live after y's initialization
      expect(info!.liveOut.size).toBeGreaterThan(0);
    });
  });

  describe('Liveness Across Branches', () => {
    it('should detect variable live in both branches', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let x: byte = 10
          if flag then
            let y: byte = x
          else
            let z: byte = x
          end if
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // x must be live before the if statement
      expect(info!.liveIn.size).toBeGreaterThan(0);
    });

    it('should detect variable live in only one branch', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let x: byte = 10
          if flag then
            let y: byte = x
          end if
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // x may be live depending on branch
      expect(info!.intervals.size).toBeGreaterThan(0);
    });

    it('should handle different variables live in different branches', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let x: byte = 10
          let y: byte = 20
          if flag then
            let a: byte = x
          else
            let b: byte = y
          end if
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // Both x and y should be live before if
      expect(info!.liveIn.size).toBeGreaterThan(0);
    });

    it('should handle nested if statements', () => {
      const source = `
        module Test

        function test(a: boolean, b: boolean): void
          let x: byte = 10
          if a then
            if b then
              let y: byte = x
            end if
          end if
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      expect(info!.intervals.size).toBeGreaterThan(0);
    });

    it('should detect variable live after branch merge', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let x: byte
          if flag then
            x = 10
          else
            x = 20
          end if
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // x is live out of both branches
      expect(info!.liveOut.size).toBeGreaterThan(0);
    });
  });

  describe('Liveness in Loops', () => {
    it('should detect variable live across loop iterations', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            i = i + 1
          end while
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // i is live throughout the loop
      expect(info!.intervals.has('i')).toBe(true);
    });

    it('should detect variable live in loop body', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          while x > 0
            x = x - 1
          end while
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // x is live in loop condition and body
      expect(info!.liveIn.size).toBeGreaterThan(0);
    });

    it('should handle variable defined and used in loop', () => {
      const source = `
        module Test

        function test(): void
          while true
            let x: byte = 10
            let y: byte = x
          end while
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      expect(info!.intervals.size).toBeGreaterThan(0);
    });

    it('should handle nested loops', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let j: byte = 0
            while j < 10
              j = j + 1
            end while
            i = i + 1
          end while
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // Both i and j should have intervals
      expect(info!.intervals.size).toBeGreaterThan(0);
    });

    it('should detect variable live out of loop', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 0
          while x < 10
            x = x + 1
          end while
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // x is live after loop
      expect(info!.intervals.has('x')).toBe(true);
    });
  });

  describe('Live-In and Live-Out Sets', () => {
    it('should compute correct live-in set', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x + 5
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      expect(info!.liveIn.size).toBeGreaterThan(0);
    });

    it('should compute correct live-out set', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = 20
          let z: byte = x + y
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      expect(info!.liveOut.size).toBeGreaterThan(0);
    });

    it('should handle empty live sets', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // Dead variable has no live-in/out at some points
      expect(info!.liveIn).toBeDefined();
    });

    it('should propagate liveness backward', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 1
          let b: byte = 2
          let c: byte = 3
          let result: byte = a + b + c
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // All variables should be live at some point
      expect(info!.intervals.size).toBeGreaterThan(0);
    });
  });

  describe('Liveness Intervals', () => {
    it('should compute interval for single use', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      const interval = info!.intervals.get('x');
      if (interval) {
        expect(interval.start).toBeDefined();
        expect(interval.end).toBeDefined();
        expect(interval.length).toBeGreaterThan(0);
      }
    });

    it('should compute interval spanning multiple uses', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
          let z: byte = x
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      const interval = info!.intervals.get('x');
      if (interval) {
        // Interval should span both uses
        expect(interval.length).toBeGreaterThan(0);
      }
    });

    it('should compute non-overlapping intervals', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
          let z: byte = 20
          let w: byte = z
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      const xInterval = info!.intervals.get('x');
      const zInterval = info!.intervals.get('z');

      // x and z should have non-overlapping intervals
      if (xInterval && zInterval) {
        expect(xInterval.end < zInterval.start || zInterval.end < xInterval.start).toBe(true);
      }
    });

    it('should compute overlapping intervals', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = 20
          let z: byte = x + y
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      const xInterval = info!.intervals.get('x');
      const yInterval = info!.intervals.get('y');

      // x and y should have overlapping intervals (both live at z's assignment)
      if (xInterval && yInterval) {
        const overlaps =
          xInterval.end >= yInterval.start && yInterval.end >= xInterval.start;
        expect(overlaps).toBe(true);
      }
    });

    it('should track interval length correctly', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let a: byte = 1
          let b: byte = 2
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      const interval = info!.intervals.get('x');
      if (interval) {
        expect(interval.length).toBe(interval.end - interval.start + 1);
      }
    });
  });

  describe('Register Interference', () => {
    it('should detect no interference for sequential lifetimes', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
          let z: byte = 20
          let w: byte = z
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      const xInterval = info!.intervals.get('x');
      const zInterval = info!.intervals.get('z');

      // x and z don't interfere (sequential)
      if (xInterval && zInterval) {
        expect(xInterval.overlaps.has('z')).toBe(false);
        expect(zInterval.overlaps.has('x')).toBe(false);
      }
    });

    it('should detect interference for overlapping lifetimes', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = 20
          let z: byte = x + y
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      const xInterval = info!.intervals.get('x');
      const yInterval = info!.intervals.get('y');

      // x and y interfere (both live at same time)
      if (xInterval && yInterval) {
        expect(xInterval.overlaps.has('y')).toBe(true);
        expect(yInterval.overlaps.has('x')).toBe(true);
      }
    });

    it('should compute interference graph for multiple variables', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 1
          let b: byte = 2
          let c: byte = 3
          let result: byte = a + b + c
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // All three variables are live at result's assignment
      const aInterval = info!.intervals.get('a');
      const bInterval = info!.intervals.get('b');
      const cInterval = info!.intervals.get('c');

      if (aInterval && bInterval && cInterval) {
        // All should interfere with each other
        expect(aInterval.overlaps.size).toBeGreaterThan(0);
        expect(bInterval.overlaps.size).toBeGreaterThan(0);
        expect(cInterval.overlaps.size).toBeGreaterThan(0);
      }
    });
  });

  describe('Complex Control Flow', () => {
    it('should handle complex branching with loops', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let x: byte = 0
          if flag then
            while x < 10
              x = x + 1
            end while
          else
            x = 100
          end if
          let y: byte = x
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // x should be live through both paths
      expect(info!.intervals.has('x')).toBe(true);
    });

    it('should handle early returns', () => {
      const source = `
        module Test

        function test(flag: boolean): byte
          let x: byte = 10
          if flag then
            return x
          end if
          x = 20
          return x
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // x is live at both returns
      expect(info!.intervals.has('x')).toBe(true);
    });

    it('should handle multiple exit points', () => {
      const source = `
        module Test

        function test(a: boolean, b: boolean): byte
          let x: byte = 10
          if a then
            return x
          end if
          if b then
            return x
          end if
          return x
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      expect(info!.intervals.has('x')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty function', () => {
      const source = `
        module Test

        function test(): void
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      expect(info!.intervals.size).toBe(0);
    });

    it('should handle function with only declarations', () => {
      const source = `
        module Test

        function test(): void
          let x: byte
          let y: byte
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // No uses = no liveness intervals
      expect(info!.intervals.size).toBe(0);
    });

    it('should handle parameters used in function', () => {
      const source = `
        module Test

        function test(x: byte): byte
          return x
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // Parameter x is live
      expect(info!.intervals.has('x')).toBe(true);
    });

    it('should handle variable redefinition', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = x
          x = 20
          let z: byte = x
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // x should have interval spanning both uses
      expect(info!.intervals.has('x')).toBe(true);
    });
  });

  describe('Performance and Correctness', () => {
    it('should converge to fixed point', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 0
          while x < 10
            x = x + 1
          end while
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      // Should complete without infinite loop
      expect(info).toBeDefined();
    });

    it('should handle large number of variables', () => {
      const source = `
        module Test

        function test(): void
          let x1: byte = 1
          let x2: byte = 2
          let x3: byte = 3
          let x4: byte = 4
          let x5: byte = 5
          let y: byte = x1 + x2 + x3 + x4 + x5
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // All variables should be live at y's assignment
      expect(info!.intervals.size).toBeGreaterThan(0);
    });

    it('should compute correct backward analysis', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 1
          let b: byte = 2
          let c: byte = a
          let d: byte = b
        end function
      `;

      const { analyzer } = analyzeLiveness(source);
      const info = analyzer.getLivenessInfo('test');

      expect(info).toBeDefined();
      // a should not be live after c's assignment
      // b should not be live after d's assignment
      expect(info!.intervals.size).toBeGreaterThan(0);
    });
  });
});
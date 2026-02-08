/**
 * Control Flow Analyzer Tests
 *
 * Tests CFG construction from actual Blend code including:
 * - Sequential statements
 * - If/else branches
 * - While/for loops
 * - Return statements
 * - Break/continue
 * - Dead code detection
 * - Complex control flow patterns
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTableBuilder } from '../../semantic/visitors/symbol-table-builder.js';
import { ControlFlowAnalyzer } from '../../semantic/visitors/control-flow-analyzer.js';
import { CFGNodeKind } from '../../semantic/control-flow.js';

/**
 * Helper to analyze control flow of Blend code
 */
function analyzeControlFlow(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();

  // Build symbol table first
  const symbolTableBuilder = new SymbolTableBuilder();
  symbolTableBuilder.walk(program);
  const symbolTable = symbolTableBuilder.getSymbolTable();

  // Analyze control flow
  const analyzer = new ControlFlowAnalyzer(symbolTable);
  analyzer.walk(program);

  return {
    analyzer,
    diagnostics: analyzer.getDiagnostics(),
    cfgs: analyzer.getAllCFGs(),
  };
}

describe('Control Flow Analyzer', () => {
  describe('Simple Sequential Flow', () => {
    it('builds CFG for function with sequential statements', () => {
      const source = `
        module Test

        function test(): void {
          let x: byte = 1;
          let y: byte = 2;
          let z: byte = 3;
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('test');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);

      // Should have: entry + 3 statements + exit = 5 nodes
      expect(cfg!.getNodeCount()).toBeGreaterThanOrEqual(5);
      expect(cfg!.entry.reachable).toBe(true);
      expect(cfg!.exit.reachable).toBe(true);
    });

    it('builds CFG for empty function', () => {
      const source = `
        module Test

        function empty(): void {
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('empty');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);

      // Should have: entry + exit = 2 nodes
      expect(cfg!.getNodeCount()).toBe(2);
      expect(cfg!.entry.reachable).toBe(true);
      expect(cfg!.exit.reachable).toBe(true);
    });
  });

  describe('Return Statements', () => {
    it('handles early return', () => {
      const source = `
        module Test

        function earlyReturn(): byte {
          return 42;
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('earlyReturn');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);

      // Find return node
      const returnNode = cfg!.getNodes().find(n => n.kind === CFGNodeKind.Return);
      expect(returnNode).toBeDefined();
      expect(returnNode!.successors).toContain(cfg!.exit);
    });

    it('detects unreachable code after return', () => {
      const source = `
        module Test

        function deadCode(): byte {
          return 1;
          let x: byte = 2;
        }
      `;

      const { diagnostics } = analyzeControlFlow(source);

      // Should have warning about unreachable code
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some(d => d.message.includes('Unreachable'))).toBe(true);
    });

    it('handles multiple returns in branches', () => {
      const source = `
        module Test

        function multipleReturns(flag: byte): byte {
          if (flag) {
            return 1;
          } else {
            return 2;
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('multipleReturns');

      expect(cfg).toBeDefined();

      // Both return paths should reach exit
      const returnNodes = cfg!.getNodes().filter(n => n.kind === CFGNodeKind.Return);
      expect(returnNodes).toHaveLength(2);
      returnNodes.forEach(ret => {
        expect(ret.successors).toContain(cfg!.exit);
      });
    });
  });

  describe('If Statements', () => {
    it('builds CFG for if without else', () => {
      const source = `
        module Test

        function ifOnly(x: byte): void {
          if (x) {
            let y: byte = 1;
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('ifOnly');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);

      // Find branch node
      const branchNode = cfg!.getNodes().find(n => n.kind === CFGNodeKind.Branch);
      expect(branchNode).toBeDefined();
      expect(branchNode!.successors.length).toBeGreaterThan(0);
    });

    it('builds CFG for if-else', () => {
      const source = `
        module Test

        function ifElse(x: byte): void {
          if (x) {
            let a: byte = 1;
          } else {
            let b: byte = 2;
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('ifElse');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);

      // Branch should have 2 successors
      const branchNode = cfg!.getNodes().find(n => n.kind === CFGNodeKind.Branch);
      expect(branchNode).toBeDefined();
      expect(branchNode!.successors.length).toBeGreaterThanOrEqual(2);
    });

    it('handles nested if statements', () => {
      const source = `
        module Test

        function nested(x: byte, y: byte): void {
          if (x) {
            if (y) {
              let a: byte = 1;
            }
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('nested');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);

      // Should have 2 branch nodes
      const branchNodes = cfg!.getNodes().filter(n => n.kind === CFGNodeKind.Branch);
      expect(branchNodes.length).toBeGreaterThanOrEqual(2);
    });

    it('detects unreachable code when both branches return', () => {
      const source = `
        module Test

        function bothReturn(x: byte): byte {
          if (x) {
            return 1;
          } else {
            return 2;
          }
          let dead: byte = 3;
          return dead;
        }
      `;

      const { diagnostics } = analyzeControlFlow(source);

      // Should have warnings about unreachable code
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some(d => d.message.includes('Unreachable'))).toBe(true);
    });
  });

  describe('While Loops', () => {
    it('builds CFG for while loop', () => {
      const source = `
        module Test

        function whileLoop(count: byte): void {
          while (count) {
            count = count - 1;
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('whileLoop');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);

      // Find loop node
      const loopNode = cfg!.getNodes().find(n => n.kind === CFGNodeKind.Loop);
      expect(loopNode).toBeDefined();

      // Loop should have back edge
      const hasBackEdge = loopNode!.predecessors.length > 1;
      expect(hasBackEdge).toBe(true);
    });

    it('handles break in loop', () => {
      const source = `
        module Test

        function withBreak(count: byte): void {
          while (count) {
            if (count == 5) {
              break;
            }
            count = count - 1;
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('withBreak');

      expect(cfg).toBeDefined();

      // Find break node
      const breakNode = cfg!.getNodes().find(n => n.kind === CFGNodeKind.Break);
      expect(breakNode).toBeDefined();
    });

    it('handles continue in loop', () => {
      const source = `
        module Test

        function withContinue(count: byte): void {
          while (count) {
            if (count == 5) {
              continue;
            }
            count = count - 1;
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('withContinue');

      expect(cfg).toBeDefined();

      // Find continue node
      const continueNode = cfg!.getNodes().find(n => n.kind === CFGNodeKind.Continue);
      expect(continueNode).toBeDefined();
    });
  });

  describe('For Loops', () => {
    it('builds CFG for for loop', () => {
      const source = `
        module Test

        function forLoop(): void {
          for (i = 0 to 10) {
            let x: byte = i;
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('forLoop');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);

      // Find loop node
      const loopNode = cfg!.getNodes().find(n => n.kind === CFGNodeKind.Loop);
      expect(loopNode).toBeDefined();
    });

    it('handles break in for loop', () => {
      const source = `
        module Test

        function forWithBreak(): void {
          for (i = 0 to 10) {
            if (i == 5) {
              break;
            }
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('forWithBreak');

      expect(cfg).toBeDefined();

      // Find break node
      const breakNode = cfg!.getNodes().find(n => n.kind === CFGNodeKind.Break);
      expect(breakNode).toBeDefined();
    });
  });

  describe('Complex Control Flow', () => {
    it('handles nested loops', () => {
      const source = `
        module Test

        function nested(): void {
          for (i = 0 to 10) {
            while (i) {
              let x: byte = i;
            }
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('nested');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);

      // Should have 2 loop nodes
      const loopNodes = cfg!.getNodes().filter(n => n.kind === CFGNodeKind.Loop);
      expect(loopNodes.length).toBeGreaterThanOrEqual(2);
    });

    it('handles if inside loop', () => {
      const source = `
        module Test

        function loopWithIf(count: byte): void {
          while (count) {
            if (count > 5) {
              count = count - 2;
            } else {
              count = count - 1;
            }
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('loopWithIf');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);
    });

    it('handles multiple functions', () => {
      const source = `
        module Test

        function first(): void {
          let x: byte = 1;
        }

        function second(): byte {
          return 42;
        }

        function third(): void {
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);

      expect(diagnostics).toHaveLength(0);
      expect(analyzer.getCFG('first')).toBeDefined();
      expect(analyzer.getCFG('second')).toBeDefined();
      expect(analyzer.getCFG('third')).toBeDefined();
    });

    it('builds complete CFG for realistic function', () => {
      const source = `
        module Test

        function process(value: byte, max: byte): byte {
          let result: byte = 0;

          if (value > max) {
            return max;
          }

          while (value > 0) {
            result = result + 1;
            value = value - 1;

            if (result > 100) {
              break;
            }
          }

          return result;
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('process');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);

      // Verify CFG structure
      expect(cfg!.entry.reachable).toBe(true);
      expect(cfg!.exit.reachable).toBe(true);

      // Should have branch, loop, return, and break nodes
      const nodes = cfg!.getNodes();
      expect(nodes.some(n => n.kind === CFGNodeKind.Branch)).toBe(true);
      expect(nodes.some(n => n.kind === CFGNodeKind.Loop)).toBe(true);
      expect(nodes.some(n => n.kind === CFGNodeKind.Return)).toBe(true);
      expect(nodes.some(n => n.kind === CFGNodeKind.Break)).toBe(true);

      // All nodes should be reachable
      const unreachable = cfg!.getUnreachableNodes();
      expect(unreachable).toHaveLength(0);
    });
  });

  describe('Dead Code Detection', () => {
    it('reports warning for unreachable code after return', () => {
      const source = `
        module Test

        function dead(): byte {
          return 1;
          let x: byte = 2;
          return x;
        }
      `;

      const { diagnostics } = analyzeControlFlow(source);

      expect(diagnostics.length).toBeGreaterThan(0);
      const unreachableWarnings = diagnostics.filter(d => d.message.includes('Unreachable'));
      expect(unreachableWarnings.length).toBeGreaterThan(0);
    });

    it('reports warning for unreachable code after both branches return', () => {
      const source = `
        module Test

        function dead(x: byte): byte {
          if (x) {
            return 1;
          } else {
            return 2;
          }
          return 3;
        }
      `;

      const { diagnostics } = analyzeControlFlow(source);

      expect(diagnostics.length).toBeGreaterThan(0);
      const unreachableWarnings = diagnostics.filter(d => d.message.includes('Unreachable'));
      expect(unreachableWarnings.length).toBeGreaterThan(0);
    });

    it('does not warn for reachable code', () => {
      const source = `
        module Test

        function reachable(x: byte): byte {
          if (x) {
            return 1;
          }
          return 2;
        }
      `;

      const { diagnostics } = analyzeControlFlow(source);

      // Should have no unreachable warnings
      const unreachableWarnings = diagnostics.filter(d => d.message.includes('Unreachable'));
      expect(unreachableWarnings).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles function with only return', () => {
      const source = `
        module Test

        function justReturn(): byte {
          return 42;
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('justReturn');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);
      expect(cfg!.exit.reachable).toBe(true);
    });

    it('handles deeply nested control flow', () => {
      const source = `
        module Test

        function deep(): void {
          if (1) {
            if (2) {
              if (3) {
                while (4) {
                  if (5) {
                    break;
                  }
                }
              }
            }
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('deep');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);
    });

    it('handles empty branches', () => {
      const source = `
        module Test

        function emptyBranches(x: byte): void {
          if (x) {
          } else {
          }
        }
      `;

      const { analyzer, diagnostics } = analyzeControlFlow(source);
      const cfg = analyzer.getCFG('emptyBranches');

      expect(cfg).toBeDefined();
      expect(diagnostics).toHaveLength(0);
    });
  });
});
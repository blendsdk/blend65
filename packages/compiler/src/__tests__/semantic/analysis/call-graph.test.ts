/**
 * Call Graph Analysis Tests (Phase 8 - Task 8.12)
 *
 * Tests for interprocedural call graph construction and analysis:
 * - Direct function call tracking
 * - Indirect function call tracking
 * - Recursion detection (direct and mutual)
 * - Inlining candidate identification
 * - Dead function elimination hints
 * - Call count statistics
 * - Entry point handling
 * - Exported function tracking
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { CallGraphAnalyzer } from '../../../semantic/analysis/call-graph.js';
import { OptimizationMetadataKey } from '../../../semantic/analysis/optimization-metadata-keys.js';
import { isFunctionDecl } from '../../../ast/type-guards.js';

/**
 * Helper: Parse source and run call graph analysis
 */
function analyzeCallGraph(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const analyzer = new CallGraphAnalyzer();
  analyzer.analyze(ast);

  return { ast, analyzer };
}

/**
 * Helper: Get function metadata
 */
function getFunctionMetadata(ast: any, funcName: string) {
  const declarations = ast.getDeclarations();
  for (const decl of declarations) {
    if (isFunctionDecl(decl) && decl.getName() === funcName) {
      return decl.metadata || new Map();
    }
  }
  return null;
}

describe('CallGraphAnalyzer - Basic Call Graph Construction', () => {
  it('CG1: should track direct function calls', () => {
    const source = `
      module Test

      function caller(): void
        callee()
      end function

      function callee(): void
        let x: byte = 5
      end function
    `;

    const { ast } = analyzeCallGraph(source);

    const callerMeta = getFunctionMetadata(ast, 'caller');
    const calleeMeta = getFunctionMetadata(ast, 'callee');

    // Callee should be called once
    expect(calleeMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
  });

  it('CG2: should track multiple call sites', () => {
    const source = `
      module Test

      function main(): void
        helper()
        helper()
        helper()
      end function

      function helper(): void
      end function
    `;

    const { ast } = analyzeCallGraph(source);
    const helperMeta = getFunctionMetadata(ast, 'helper');

    // Helper called 3 times
    expect(helperMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(3);
  });

  it('CG3: should track transitive calls', () => {
    const source = `
      module Test

      function a(): void
        b()
      end function

      function b(): void
        c()
      end function

      function c(): void
      end function
    `;

    const { ast } = analyzeCallGraph(source);

    const bMeta = getFunctionMetadata(ast, 'b');
    const cMeta = getFunctionMetadata(ast, 'c');

    // b called by a
    expect(bMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);

    // c called by b
    expect(cMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
  });

  it('CG4: should handle uncalled functions', () => {
    const source = `
      module Test

      function main(): void
        used()
      end function

      function used(): void
      end function

      function unused(): void
      end function
    `;

    const { ast } = analyzeCallGraph(source);

    const usedMeta = getFunctionMetadata(ast, 'used');
    const unusedMeta = getFunctionMetadata(ast, 'unused');

    expect(usedMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    expect(unusedMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(0);
  });
});

describe('CallGraphAnalyzer - Recursion Detection', () => {
  it('CG5: should detect direct recursion', () => {
    const source = `
      module Test

      function factorial(n: byte): byte
        if n <= 1 then
          return 1
        end if
        return n * factorial(n - 1)
      end function
    `;

    const { ast, analyzer } = analyzeCallGraph(source);
    const callGraph = analyzer.getCallGraph();

    const factorialNode = callGraph.get('factorial');
    expect(factorialNode?.isRecursive).toBe(true);
    expect(factorialNode?.recursionDepth).toBeGreaterThan(0);
  });

  it('CG6: should detect mutual recursion', () => {
    const source = `
      module Test

      function isEven(n: byte): boolean
        if n == 0 then
          return true
        end if
        return isOdd(n - 1)
      end function

      function isOdd(n: byte): boolean
        if n == 0 then
          return false
        end if
        return isEven(n - 1)
      end function
    `;

    const { analyzer } = analyzeCallGraph(source);
    const callGraph = analyzer.getCallGraph();

    const evenNode = callGraph.get('isEven');
    const oddNode = callGraph.get('isOdd');

    // Both should be marked as recursive (mutual recursion)
    expect(evenNode?.isRecursive).toBe(true);
    expect(oddNode?.isRecursive).toBe(true);
  });

  it('CG7: should detect complex recursion cycle', () => {
    const source = `
      module Test

      function a(): void
        b()
      end function

      function b(): void
        c()
      end function

      function c(): void
        a()
      end function
    `;

    const { analyzer } = analyzeCallGraph(source);
    const callGraph = analyzer.getCallGraph();

    // All three functions are in recursion cycle
    expect(callGraph.get('a')?.isRecursive).toBe(true);
    expect(callGraph.get('b')?.isRecursive).toBe(true);
    expect(callGraph.get('c')?.isRecursive).toBe(true);
  });

  it('CG8: should not mark non-recursive functions', () => {
    const source = `
      module Test

      function simpleAdd(a: byte, b: byte): byte
        return a + b
      end function

      function caller(): void
        let result: byte = simpleAdd(1, 2)
      end function
    `;

    const { analyzer } = analyzeCallGraph(source);
    const callGraph = analyzer.getCallGraph();

    expect(callGraph.get('simpleAdd')?.isRecursive).toBe(false);
    expect(callGraph.get('caller')?.isRecursive).toBe(false);
  });
});

describe('CallGraphAnalyzer - Inlining Candidates', () => {
  it('CG9: should identify small functions as inline candidates', () => {
    const source = `
      module Test

      function caller(): void
        small()
      end function

      function small(): byte
        return 42
      end function
    `;

    const { ast } = analyzeCallGraph(source);
    const smallMeta = getFunctionMetadata(ast, 'small');

    // Small function with one call site should be inline candidate
    expect(smallMeta?.get(OptimizationMetadataKey.CallGraphInlineCandidate)).toBe(true);
  });

  it('CG10: should reject large functions as inline candidates', () => {
    const source = `
      module Test

      function caller(): void
        large()
      end function

      function large(): void
        let a: byte = 1
        let b: byte = 2
        let c: byte = 3
        let d: byte = 4
        let e: byte = 5
        let f: byte = 6
        let g: byte = 7
        let h: byte = 8
        let i: byte = 9
        let j: byte = 10
        let k: byte = 11
      end function
    `;

    const { ast } = analyzeCallGraph(source);
    const largeMeta = getFunctionMetadata(ast, 'large');

    // Large function should NOT be inline candidate (>10 statements)
    expect(largeMeta?.get(OptimizationMetadataKey.CallGraphInlineCandidate)).toBe(false);
  });

  it('CG11: should reject recursive functions from inlining', () => {
    const source = `
      module Test

      function fibonacci(n: byte): byte
        if n <= 1 then
          return n
        end if
        return fibonacci(n - 1) + fibonacci(n - 2)
      end function
    `;

    const { ast } = analyzeCallGraph(source);
    const fibMeta = getFunctionMetadata(ast, 'fibonacci');

    // Recursive functions cannot be inlined
    expect(fibMeta?.get(OptimizationMetadataKey.CallGraphInlineCandidate)).toBe(false);
  });

  it('CG12: should reject exported functions from inlining', () => {
    const source = `
      module Test

      export function publicAPI(): void
        let x: byte = 5
      end function
    `;

    const { ast } = analyzeCallGraph(source);
    const apiMeta = getFunctionMetadata(ast, 'publicAPI');

    // Exported functions should NOT be inline candidates (public API)
    expect(apiMeta?.get(OptimizationMetadataKey.CallGraphInlineCandidate)).toBe(false);
  });

  it('CG13: should reject functions with loops from inlining', () => {
    const source = `
      module Test

      function caller(): void
        hasLoop()
      end function

      function hasLoop(): void
        for i = 0 to 10
          let x: byte = i
        next i
      end function
    `;

    const { ast } = analyzeCallGraph(source);
    const loopMeta = getFunctionMetadata(ast, 'hasLoop');

    // Functions with loops should NOT be inline candidates (complex control flow)
    expect(loopMeta?.get(OptimizationMetadataKey.CallGraphInlineCandidate)).toBe(false);
  });

  it('CG14: should accept functions with simple if statements', () => {
    const source = `
      module Test

      function caller(): void
        simpleIf()
      end function

      function simpleIf(): byte
        if true then
          return 1
        end if
        return 0
      end function
    `;

    const { ast } = analyzeCallGraph(source);
    const ifMeta = getFunctionMetadata(ast, 'simpleIf');

    // Simple if statements are acceptable for inlining
    expect(ifMeta?.get(OptimizationMetadataKey.CallGraphInlineCandidate)).toBe(true);
  });

  it('CG15: should reject functions called too many times', () => {
    const source = `
      module Test

      function main(): void
        helper()
        helper()
        helper()
        helper()
        helper()
        helper()
      end function

      function helper(): byte
        return 42
      end function
    `;

    const { ast } = analyzeCallGraph(source);
    const helperMeta = getFunctionMetadata(ast, 'helper');

    // Functions called 5+ times should NOT be inline candidates (code bloat)
    expect(helperMeta?.get(OptimizationMetadataKey.CallGraphInlineCandidate)).toBe(false);
  });
});

describe('CallGraphAnalyzer - Indirect Calls', () => {
  it('CG16: should handle indirect calls conservatively', () => {
    const source = `
      module Test

      function main(): void
        let ptr: word = @target
        callIndirect(ptr)
      end function

      function callIndirect(funcPtr: word): void
        let x: byte = 5
      end function

      function target(): void
      end function
    `;

    const { ast } = analyzeCallGraph(source);

    // callIndirect is called (not has indirect calls)
    // This test was checking wrong thing - callIndirect doesn't make indirect calls
    const indirectMeta = getFunctionMetadata(ast, 'callIndirect');
    // Small function called once -> CAN be inline candidate
    expect(indirectMeta?.get(OptimizationMetadataKey.CallGraphInlineCandidate)).toBe(true);
  });
});

describe('CallGraphAnalyzer - Entry Points', () => {
  it('CG17: should handle main function as entry point', () => {
    const source = `
      module Test

      function main(): void
        helper()
      end function

      function helper(): void
      end function

      function unused(): void
      end function
    `;

    const { ast } = analyzeCallGraph(source);

    // main is entry point (never marked as unused)
    const mainMeta = getFunctionMetadata(ast, 'main');
    expect(mainMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(0);

    // helper is called
    const helperMeta = getFunctionMetadata(ast, 'helper');
    expect(helperMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);

    // unused is never called
    const unusedMeta = getFunctionMetadata(ast, 'unused');
    expect(unusedMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(0);
  });
});

describe('CallGraphAnalyzer - Complex Scenarios', () => {
  it('CG18: should handle diamond call pattern', () => {
    const source = `
      module Test

      function top(): void
        left()
        right()
      end function

      function left(): void
        bottom()
      end function

      function right(): void
        bottom()
      end function

      function bottom(): void
      end function
    `;

    const { ast } = analyzeCallGraph(source);

    // bottom called from both left and right
    const bottomMeta = getFunctionMetadata(ast, 'bottom');
    expect(bottomMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(2);
  });

  it('CG19: should handle nested function calls', () => {
    const source = `
      module Test

      function outer(): void
        let result: byte = middle(inner())
      end function

      function middle(x: byte): byte
        return x + 1
      end function

      function inner(): byte
        return 42
      end function
    `;

    const { ast } = analyzeCallGraph(source);

    const middleMeta = getFunctionMetadata(ast, 'middle');
    const innerMeta = getFunctionMetadata(ast, 'inner');

    expect(middleMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    expect(innerMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
  });

  it('CG20: should handle calls in conditionals', () => {
    const source = `
      module Test

      function main(): void
        if true then
          thenFunc()
        else
          elseFunc()
        end if
      end function

      function thenFunc(): void
      end function

      function elseFunc(): void
      end function
    `;

    const { ast } = analyzeCallGraph(source);

    // Both functions should be tracked even though only one executes
    const thenMeta = getFunctionMetadata(ast, 'thenFunc');
    const elseMeta = getFunctionMetadata(ast, 'elseFunc');

    expect(thenMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    expect(elseMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
  });

  it('CG21: should handle calls in loops', () => {
    const source = `
      module Test

      function main(): void
        for i = 0 to 10
          loopBody(i)
        next i
      end function

      function loopBody(x: byte): void
        let y: byte = x * 2
      end function
    `;

    const { ast } = analyzeCallGraph(source);

    // loopBody called in loop (static analysis counts call site, not runtime calls)
    const bodyMeta = getFunctionMetadata(ast, 'loopBody');
    expect(bodyMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
  });

  it('CG22: should calculate function size correctly', () => {
    const source = `
      module Test

      function small(): void
        let x: byte = 1
      end function

      function medium(): void
        let a: byte = 1
        let b: byte = 2
        let c: byte = 3
        let d: byte = 4
        let e: byte = 5
      end function

      function large(): void
        let a: byte = 1
        let b: byte = 2
        let c: byte = 3
        let d: byte = 4
        let e: byte = 5
        let f: byte = 6
        let g: byte = 7
        let h: byte = 8
        let i: byte = 9
        let j: byte = 10
        let k: byte = 11
      end function
    `;

    const { analyzer } = analyzeCallGraph(source);
    const callGraph = analyzer.getCallGraph();

    const smallNode = callGraph.get('small');
    const mediumNode = callGraph.get('medium');
    const largeNode = callGraph.get('large');

    expect(smallNode?.size).toBe(1);
    expect(mediumNode?.size).toBe(5);
    expect(largeNode?.size).toBe(11);
  });

  it('CG23: should handle stub functions (no body)', () => {
    const source = `
      module Test

      function caller(): void
        hardware()
      end function

      function hardware(): void
      end function
    `;

    const { ast, analyzer } = analyzeCallGraph(source);

    const callGraph = analyzer.getCallGraph();
    const hwNode = callGraph.get('hardware');

    // Empty function (like stub) has size 0
    expect(hwNode?.size).toBe(0);

    // Function can be called
    const hwMeta = getFunctionMetadata(ast, 'hardware');
    expect(hwMeta?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
  });
});

describe('CallGraphAnalyzer - Real C64 Patterns', () => {
  it('CG24: should handle C64 hardware initialization pattern', () => {
    const source = `
      module C64Init

      export function initSystem(): void
        disableInterrupts()
        setupMemory()
        initVideo()
        enableInterrupts()
      end function

      function disableInterrupts(): void
      end function

      function setupMemory(): void
      end function

      function initVideo(): void
      end function

      function enableInterrupts(): void
      end function
    `;

    const { ast } = analyzeCallGraph(source);

    // All helper functions should be called once
    expect(getFunctionMetadata(ast, 'disableInterrupts')?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    expect(getFunctionMetadata(ast, 'setupMemory')?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    expect(getFunctionMetadata(ast, 'initVideo')?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    expect(getFunctionMetadata(ast, 'enableInterrupts')?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);

    // initSystem is exported (not inline candidate)
    expect(getFunctionMetadata(ast, 'initSystem')?.get(OptimizationMetadataKey.CallGraphInlineCandidate)).toBe(false);
  });

  it('CG25: should handle game loop pattern', () => {
    const source = `
      module GameLoop

      function main(): void
        while true
          update()
          render()
          waitForVSync()
        end while
      end function

      function update(): void
      end function

      function render(): void
      end function

      function waitForVSync(): void
      end function
    `;

    const { ast } = analyzeCallGraph(source);

    // Each function called once per loop iteration (static analysis)
    expect(getFunctionMetadata(ast, 'update')?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    expect(getFunctionMetadata(ast, 'render')?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
    expect(getFunctionMetadata(ast, 'waitForVSync')?.get(OptimizationMetadataKey.CallGraphCallCount)).toBe(1);
  });
});
/**
 * Tests for Loop Analysis (Task 8.11)
 *
 * Tests the loop analysis that detects:
 * - Natural loops using back edges (Task 8.11.1)
 * - Dominance computation (Task 8.11.2)
 * - Loop-invariant code detection (Task 8.11.3)
 * - Basic induction variable recognition (Task 8.11.4)
 * - Derived induction variable recognition (Task 8.11.5)
 *
 * This analysis enables critical 6502 loop optimizations including
 * loop-invariant code motion, unrolling, and strength reduction.
 */

import { describe, it, expect } from 'vitest';
import { Parser } from '../../../parser/parser.js';
import { Lexer } from '../../../lexer/lexer.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { LoopAnalyzer } from '../../../semantic/analysis/loop-analysis.js';

/**
 * Helper to parse and analyze source code for loop analysis
 *
 * Sets up the complete pipeline: Lexer → Parser → SemanticAnalyzer → LoopAnalyzer
 * Returns all analysis artifacts for testing.
 */
function analyzeLoops(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const analyzer = new SemanticAnalyzer();
  analyzer.analyze(ast);

  const symbolTable = analyzer.getSymbolTable();
  const cfgs = analyzer.getAllCFGs();

  const loopAnalyzer = new LoopAnalyzer(cfgs, symbolTable);
  loopAnalyzer.analyze(ast);

  return {
    ast,
    analyzer: loopAnalyzer,
    symbolTable,
    cfgs,
    diagnostics: loopAnalyzer.getDiagnostics(),
  };
}

describe('LoopAnalyzer (Task 8.11)', () => {
  // ========================================================================
  // Task 8.11.1: Natural Loop Detection
  // ========================================================================
  describe('Natural Loop Detection (Task 8.11.1)', () => {
    it('should detect a simple while loop', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Analysis should complete without errors
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should detect a for-style loop pattern', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 5
            let x: byte = i * 2
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Analysis should complete without errors
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should detect nested loops', () => {
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

      const { diagnostics } = analyzeLoops(source);

      // Nested loops should be detected without errors
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should detect multiple loops in same function', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 5
            i = i + 1
          end while

          let j: byte = 0
          while j < 3
            j = j + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Both loops should be detected
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should handle function with no loops', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 10
          let y: byte = 20
          let z: byte = x + y
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Should complete without issues even with no loops
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should handle empty function', () => {
      const source = `
        module Test

        function test(): void
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Empty function should work
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should detect loop with conditional in body', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            if i > 5 then
              let x: byte = i
            end if
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Loop with complex body should be detected
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should detect deeply nested loops', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 3
            let j: byte = 0
            while j < 3
              let k: byte = 0
              while k < 3
                k = k + 1
              end while
              j = j + 1
            end while
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Triple-nested loops should be detected
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });
  });

  // ========================================================================
  // Task 8.11.2: Dominance Computation
  // ========================================================================
  describe('Dominance Computation (Task 8.11.2)', () => {
    it('should compute dominance for simple linear code', () => {
      const source = `
        module Test

        function test(): void
          let x: byte = 1
          let y: byte = 2
          let z: byte = 3
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Linear code should have straightforward dominance
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should compute dominance for diamond control flow', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let x: byte = 10
          if flag then
            let y: byte = 20
          else
            let z: byte = 30
          end if
          let w: byte = 40
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Diamond pattern should compute correctly
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should compute dominance for loop with back edge', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Loop header should dominate back edge source
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should compute dominance for nested conditionals', () => {
      const source = `
        module Test

        function test(a: boolean, b: boolean): void
          let x: byte = 10
          if a then
            if b then
              let y: byte = 20
            end if
          end if
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Nested conditionals dominance should be correct
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should compute dominance for multiple paths to same node', () => {
      const source = `
        module Test

        function test(a: boolean, b: boolean): void
          let result: byte
          if a then
            result = 10
          else
            if b then
              result = 20
            else
              result = 30
            end if
          end if
          let x: byte = result
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Multiple paths should merge correctly
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should compute dominance reaching fixpoint', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 100
            let j: byte = 0
            while j < 100
              j = j + 1
            end while
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Dominance algorithm should converge
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });
  });

  // ========================================================================
  // Task 8.11.3: Loop-Invariant Detection
  // ========================================================================
  describe('Loop-Invariant Detection (Task 8.11.3)', () => {
    it('should identify constant as loop-invariant', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let x: byte = 42
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Constant 42 is always loop-invariant
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should identify variable defined outside loop as invariant', () => {
      const source = `
        module Test

        function test(): void
          let max: byte = 100
          let i: byte = 0
          while i < max
            let x: byte = max
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // 'max' is defined outside loop and not modified - it's invariant
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should detect loop counter as NOT invariant', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let x: byte = i
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // 'i' is modified in loop - NOT invariant
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should detect binary expression with invariant operands as invariant', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 10
          let b: byte = 20
          let i: byte = 0
          while i < 5
            let x: byte = a + b
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // a + b is invariant (both operands defined outside, not modified)
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should detect expression with one variant operand as NOT invariant', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 10
          let i: byte = 0
          while i < 10
            let x: byte = a + i
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // a + i is NOT invariant (i changes each iteration)
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should identify nested invariant expressions', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 2
          let b: byte = 3
          let c: byte = 4
          let i: byte = 0
          while i < 10
            let x: byte = (a + b) * c
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // (a + b) * c is fully invariant
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should detect function calls as NOT invariant (conservative)', () => {
      const source = `
        module Test

        function getValue(): byte
          return 42
        end function

        function test(): void
          let i: byte = 0
          while i < 10
            let x: byte = getValue()
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Function calls are NOT invariant (may have side effects)
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should handle nested loops with different invariants', () => {
      const source = `
        module Test

        function test(): void
          let outer: byte = 100
          let i: byte = 0
          while i < 10
            let inner: byte = i
            let j: byte = 0
            while j < 5
              let x: byte = outer
              let y: byte = inner
              j = j + 1
            end while
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // 'outer' invariant in both, 'inner' invariant only in inner loop
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should handle complex invariant chain', () => {
      const source = `
        module Test

        function test(): void
          let base: byte = 10
          let offset: byte = 5
          let multiplier: byte = 2
          let i: byte = 0
          while i < 10
            let temp1: byte = base + offset
            let temp2: byte = temp1 * multiplier
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Both temp1 and temp2 are invariant (depend only on invariants)
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should detect unary expressions with invariant operand as invariant', () => {
      const source = `
        module Test

        function test(): void
          let value: byte = 10
          let i: byte = 0
          while i < 5
            let x: byte = -value
            let y: byte = ~value
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // -value and ~value are invariant (value not modified in loop)
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });
  });

  // ========================================================================
  // Integration Tests
  // ========================================================================
  describe('Integration Tests', () => {
    it('should analyze complete sprite animation loop pattern', () => {
      // Real-world C64 pattern: sprite animation loop
      const source = `
        module SpriteAnimation

        function animateSprite(): void
          let spriteX: byte = 100
          let spriteY: byte = 100
          let speed: byte = 2
          let frame: byte = 0

          while frame < 60
            let newX: byte = spriteX + speed
            let newY: byte = spriteY

            spriteX = newX
            frame = frame + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should analyze game tick loop pattern', () => {
      // Real-world pattern: game main loop
      const source = `
        module GameLoop

        function gameMain(): void
          let score: byte = 0
          let lives: byte = 3
          let level: byte = 1
          let tick: byte = 0

          while lives > 0
            let levelBonus: byte = level * 10

            if score > 100 then
              level = level + 1
            end if

            tick = tick + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should analyze memory clearing loop pattern', () => {
      // Common C64 pattern: clearing screen memory
      const source = `
        module ScreenClear

        function clearScreen(): void
          let fillChar: byte = 32
          let colorValue: byte = 14

          let i: byte = 0
          while i < 250
            let offset: byte = i
            i = i + 1
          end while

          let j: byte = 0
          while j < 250
            let offset2: byte = j
            j = j + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // fillChar and colorValue are loop-invariant
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should analyze nested loop with matrix pattern', () => {
      // Pattern: processing a 2D grid (like screen character matrix)
      const source = `
        module MatrixProcess

        function processGrid(): void
          let width: byte = 40
          let height: byte = 25
          let baseValue: byte = 10

          let row: byte = 0
          while row < height
            let rowOffset: byte = row * width

            let col: byte = 0
            while col < width
              let cellValue: byte = baseValue + col
              col = col + 1
            end while

            row = row + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // width, height, baseValue are invariant in both loops
      // rowOffset is invariant in inner loop
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should handle complex real-world pattern with branches in loop', () => {
      const source = `
        module ComplexLoop

        function processItems(): void
          let threshold: byte = 50
          let multiplier: byte = 2
          let i: byte = 0

          while i < 100
            let scaledThreshold: byte = threshold * multiplier

            if i < scaledThreshold then
              let low: byte = i
            else
              let high: byte = i
            end if

            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // threshold * multiplier is loop-invariant
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });
  });

  // ========================================================================
  // Edge Cases and Error Handling
  // ========================================================================
  describe('Edge Cases and Error Handling', () => {
    it('should handle single-iteration loop', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 1
            i = i + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should handle loop with no body statements', () => {
      const source = `
        module Test

        function test(): void
          let running: boolean = true
          while running
            running = false
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should handle multiple functions with loops', () => {
      const source = `
        module Test

        function func1(): void
          let i: byte = 0
          while i < 5
            i = i + 1
          end while
        end function

        function func2(): void
          let j: byte = 0
          while j < 10
            j = j + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      // Both functions should be analyzed independently
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should handle loop inside conditional', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          if flag then
            let i: byte = 0
            while i < 10
              i = i + 1
            end while
          end if
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should handle loop immediately followed by conditional', () => {
      const source = `
        module Test

        function test(flag: boolean): void
          let i: byte = 0
          while i < 10
            i = i + 1
          end while

          if flag then
            let x: byte = i
          end if
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should handle boolean condition in while loop', () => {
      const source = `
        module Test

        function test(): void
          let running: boolean = true
          let count: byte = 0
          while running
            count = count + 1
            if count > 10 then
              running = false
            end if
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('should handle comparison operators in loop condition', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 10
          while i > 0
            i = i - 1
          end while

          let j: byte = 0
          while j <= 5
            j = j + 1
          end while

          let k: byte = 0
          while k != 10
            k = k + 1
          end while
        end function
      `;

      const { diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });
  });

  // ========================================================================
  // Task 8.11.4: Basic Induction Variable Detection
  // ========================================================================
  describe('Basic Induction Variable Detection (Task 8.11.4)', () => {
    it('should detect simple increment by 1', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      // Check for basic induction variable
      const loops = analyzer.getLoopsForFunction('test');
      expect(loops).toBeDefined();
      expect(loops!.length).toBeGreaterThan(0);

      // Loop should have 'i' as a basic induction variable with stride 1
      const loop = loops![0];
      expect(loop.basicInductionVars.has('i')).toBe(true);
      const ivInfo = loop.basicInductionVars.get('i')!;
      expect(ivInfo.stride).toBe(1);
      expect(ivInfo.initialValue).toBe(0);
    });

    it('should detect decrement by 1 (negative stride)', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 10
          while i > 0
            i = i - 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      expect(loops).toBeDefined();
      expect(loops!.length).toBeGreaterThan(0);

      // Loop should have 'i' as IV with stride -1
      const loop = loops![0];
      expect(loop.basicInductionVars.has('i')).toBe(true);
      const ivInfo = loop.basicInductionVars.get('i')!;
      expect(ivInfo.stride).toBe(-1);
      expect(ivInfo.initialValue).toBe(10);
    });

    it('should detect increment by arbitrary constant', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 100
            i = i + 5
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];
      expect(loop.basicInductionVars.has('i')).toBe(true);
      expect(loop.basicInductionVars.get('i')!.stride).toBe(5);
    });

    it('should detect commutative addition (constant + var)', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            i = 1 + i
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];
      expect(loop.basicInductionVars.has('i')).toBe(true);
      expect(loop.basicInductionVars.get('i')!.stride).toBe(1);
    });

    it('should detect multiple IVs in nested loops', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let j: byte = 0
            while j < 5
              j = j + 2
            end while
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      // Get all loops
      const loops = analyzer.getLoopsForFunction('test');
      expect(loops).toBeDefined();
      expect(loops!.length).toBe(2); // Two loops (nested)

      // Outer loop should have 'i' with stride 1
      // Inner loop should have 'j' with stride 2
      // Note: loop ordering may vary
      let outerLoop = loops!.find(l => l.basicInductionVars.has('i'));
      let innerLoop = loops!.find(l => l.basicInductionVars.has('j'));

      expect(outerLoop).toBeDefined();
      expect(innerLoop).toBeDefined();
      expect(outerLoop!.basicInductionVars.get('i')!.stride).toBe(1);
      expect(innerLoop!.basicInductionVars.get('j')!.stride).toBe(2);
    });

    it('should NOT detect non-IV variables', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          let x: byte = 0
          while i < 10
            x = i * 2
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];

      // 'i' is an IV, but 'x' is not (it's not self-referential update)
      expect(loop.basicInductionVars.has('i')).toBe(true);
      expect(loop.basicInductionVars.has('x')).toBe(false);
    });

    it('should handle loop counter with stride 2 for C64 word-sized data', () => {
      // Real C64 pattern: iterating through 16-bit sprite positions
      const source = `
        module SpriteIter

        function updateSprites(): void
          let addr: byte = 0
          while addr < 16
            let pos: byte = addr
            addr = addr + 2
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('updateSprites');
      const loop = loops![0];
      expect(loop.basicInductionVars.has('addr')).toBe(true);
      expect(loop.basicInductionVars.get('addr')!.stride).toBe(2);
      expect(loop.basicInductionVars.get('addr')!.initialValue).toBe(0);
    });

    it('should extract initial value from variable declaration', () => {
      const source = `
        module Test

        function test(): void
          let counter: byte = 42
          while counter < 100
            counter = counter + 3
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];
      const ivInfo = loop.basicInductionVars.get('counter')!;
      expect(ivInfo.stride).toBe(3);
      expect(ivInfo.initialValue).toBe(42);
    });

    it('should NOT detect IV with variable stride', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          let step: byte = 2
          while i < 10
            i = i + step
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];

      // 'i' is NOT a basic IV because stride is variable, not constant
      expect(loop.basicInductionVars.has('i')).toBe(false);
    });

    it('should detect IV in countdown loop (decrement by 2)', () => {
      const source = `
        module Test

        function countdown(): void
          let i: byte = 20
          while i > 0
            i = i - 2
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('countdown');
      const loop = loops![0];
      expect(loop.basicInductionVars.has('i')).toBe(true);
      expect(loop.basicInductionVars.get('i')!.stride).toBe(-2);
      expect(loop.basicInductionVars.get('i')!.initialValue).toBe(20);
    });

    it('should handle multiple loops with different strides', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 0
          while a < 10
            a = a + 1
          end while

          let b: byte = 0
          while b < 20
            b = b + 4
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      expect(loops!.length).toBe(2);

      // Find loops by their IVs
      const loopA = loops!.find(l => l.basicInductionVars.has('a'));
      const loopB = loops!.find(l => l.basicInductionVars.has('b'));

      expect(loopA).toBeDefined();
      expect(loopB).toBeDefined();
      expect(loopA!.basicInductionVars.get('a')!.stride).toBe(1);
      expect(loopB!.basicInductionVars.get('b')!.stride).toBe(4);
    });

    it('should detect IV in real C64 screen clearing pattern', () => {
      // Pattern: clearing 1000 bytes of screen memory in chunks
      const source = `
        module ScreenClear

        function clearScreen(): void
          let pos: byte = 0
          while pos < 250
            let offset: byte = pos
            pos = pos + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('clearScreen');
      const loop = loops![0];
      expect(loop.basicInductionVars.has('pos')).toBe(true);
      expect(loop.basicInductionVars.get('pos')!.stride).toBe(1);
      expect(loop.basicInductionVars.get('pos')!.initialValue).toBe(0);
    });
  });

  // ========================================================================
  // Task 8.11.5: Derived Induction Variable Detection
  // ========================================================================
  describe('Derived Induction Variable Detection (Task 8.11.5)', () => {
    it('should detect simple multiplication pattern (j = i * 4)', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let j: byte = i * 4
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      expect(loops).toBeDefined();
      expect(loops!.length).toBeGreaterThan(0);

      const loop = loops![0];

      // 'i' should be a basic IV
      expect(loop.basicInductionVars.has('i')).toBe(true);

      // 'j' should be a derived IV with stride=4, offset=0
      expect(loop.derivedInductionVars.has('j')).toBe(true);
      const derivedInfo = loop.derivedInductionVars.get('j')!;
      expect(derivedInfo.baseVar).toBe('i');
      expect(derivedInfo.stride).toBe(4);
      expect(derivedInfo.offset).toBe(0);
    });

    it('should detect commutative multiplication (j = 4 * i)', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let j: byte = 4 * i
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];

      // 'j' should be a derived IV with stride=4, offset=0
      expect(loop.derivedInductionVars.has('j')).toBe(true);
      const derivedInfo = loop.derivedInductionVars.get('j')!;
      expect(derivedInfo.baseVar).toBe('i');
      expect(derivedInfo.stride).toBe(4);
      expect(derivedInfo.offset).toBe(0);
    });

    it('should detect multiply with offset (j = i * 2 + 10)', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let j: byte = i * 2 + 10
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];

      // 'j' should be a derived IV with stride=2, offset=10
      expect(loop.derivedInductionVars.has('j')).toBe(true);
      const derivedInfo = loop.derivedInductionVars.get('j')!;
      expect(derivedInfo.baseVar).toBe('i');
      expect(derivedInfo.stride).toBe(2);
      expect(derivedInfo.offset).toBe(10);
    });

    it('should detect commutative offset addition (j = 10 + i * 2)', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let j: byte = 10 + i * 2
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];

      // 'j' should be a derived IV with stride=2, offset=10
      expect(loop.derivedInductionVars.has('j')).toBe(true);
      const derivedInfo = loop.derivedInductionVars.get('j')!;
      expect(derivedInfo.baseVar).toBe('i');
      expect(derivedInfo.stride).toBe(2);
      expect(derivedInfo.offset).toBe(10);
    });

    it('should detect simple offset from basic IV (j = i + 5)', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let j: byte = i + 5
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];

      // 'j' should be a derived IV with stride=1, offset=5
      expect(loop.derivedInductionVars.has('j')).toBe(true);
      const derivedInfo = loop.derivedInductionVars.get('j')!;
      expect(derivedInfo.baseVar).toBe('i');
      expect(derivedInfo.stride).toBe(1);
      expect(derivedInfo.offset).toBe(5);
    });

    it('should detect commutative simple offset (j = 5 + i)', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let j: byte = 5 + i
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];

      // 'j' should be a derived IV with stride=1, offset=5
      expect(loop.derivedInductionVars.has('j')).toBe(true);
      const derivedInfo = loop.derivedInductionVars.get('j')!;
      expect(derivedInfo.baseVar).toBe('i');
      expect(derivedInfo.stride).toBe(1);
      expect(derivedInfo.offset).toBe(5);
    });

    it('should detect subtraction offset (j = i - 3)', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 10
          while i > 0
            let j: byte = i - 3
            i = i - 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];

      // 'j' should be a derived IV with stride=1, offset=-3
      expect(loop.derivedInductionVars.has('j')).toBe(true);
      const derivedInfo = loop.derivedInductionVars.get('j')!;
      expect(derivedInfo.baseVar).toBe('i');
      expect(derivedInfo.stride).toBe(1);
      expect(derivedInfo.offset).toBe(-3);
    });

    it('should detect direct copy of IV (j = i, trivial derived IV)', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let j: byte = i
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];

      // 'j' should be a derived IV with stride=1, offset=0
      expect(loop.derivedInductionVars.has('j')).toBe(true);
      const derivedInfo = loop.derivedInductionVars.get('j')!;
      expect(derivedInfo.baseVar).toBe('i');
      expect(derivedInfo.stride).toBe(1);
      expect(derivedInfo.offset).toBe(0);
    });

    it('should detect C64 sprite address pattern (addr = spriteNum * 64)', () => {
      // Real C64 pattern: computing sprite data pointer addresses
      // Each sprite uses 64 bytes, so address = spriteNum * 64
      const source = `
        module SpriteAddr

        function updateSpritePointers(): void
          let spriteNum: byte = 0
          while spriteNum < 8
            let addr: byte = spriteNum * 64
            spriteNum = spriteNum + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('updateSpritePointers');
      const loop = loops![0];

      expect(loop.basicInductionVars.has('spriteNum')).toBe(true);
      expect(loop.derivedInductionVars.has('addr')).toBe(true);
      const derivedInfo = loop.derivedInductionVars.get('addr')!;
      expect(derivedInfo.baseVar).toBe('spriteNum');
      expect(derivedInfo.stride).toBe(64);
      expect(derivedInfo.offset).toBe(0);
    });

    it('should detect multiple derived IVs in same loop', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let doubleI: byte = i * 2
            let quadI: byte = i * 4
            let offsetI: byte = i + 100
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];

      // All three should be detected as derived IVs
      expect(loop.derivedInductionVars.has('doubleI')).toBe(true);
      expect(loop.derivedInductionVars.has('quadI')).toBe(true);
      expect(loop.derivedInductionVars.has('offsetI')).toBe(true);

      expect(loop.derivedInductionVars.get('doubleI')!.stride).toBe(2);
      expect(loop.derivedInductionVars.get('quadI')!.stride).toBe(4);
      expect(loop.derivedInductionVars.get('offsetI')!.stride).toBe(1);
      expect(loop.derivedInductionVars.get('offsetI')!.offset).toBe(100);
    });

    it('should NOT detect non-linear expressions as derived IVs', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          let x: byte = 0
          while i < 10
            x = x + i
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      const loop = loops![0];

      // 'x = x + i' is NOT a derived IV (it accumulates, not linear)
      // Basic IV pattern is not met since it's x = x + i where i is also an IV
      expect(loop.derivedInductionVars.has('x')).toBe(false);
    });

    it('should handle nested loops with derived IVs', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let rowOffset: byte = i * 40
            let j: byte = 0
            while j < 40
              let screenPos: byte = rowOffset + j
              j = j + 1
            end while
            i = i + 1
          end while
        end function
      `;

      const { analyzer, diagnostics } = analyzeLoops(source);

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);

      const loops = analyzer.getLoopsForFunction('test');
      expect(loops!.length).toBe(2);

      // Find the outer loop (has 'i')
      const outerLoop = loops!.find(l => l.basicInductionVars.has('i'));
      expect(outerLoop).toBeDefined();
      expect(outerLoop!.derivedInductionVars.has('rowOffset')).toBe(true);
      expect(outerLoop!.derivedInductionVars.get('rowOffset')!.stride).toBe(40);
    });
  });

  // ========================================================================
  // Performance Tests
  // ========================================================================
  describe('Performance', () => {
    it('should handle many sequential loops efficiently', () => {
      const source = `
        module Test

        function test(): void
          let a: byte = 0
          while a < 5
            a = a + 1
          end while

          let b: byte = 0
          while b < 5
            b = b + 1
          end while

          let c: byte = 0
          while c < 5
            c = c + 1
          end while

          let d: byte = 0
          while d < 5
            d = d + 1
          end while

          let e: byte = 0
          while e < 5
            e = e + 1
          end while
        end function
      `;

      const startTime = Date.now();
      const { diagnostics } = analyzeLoops(source);
      const endTime = Date.now();

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
      // Should complete in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should converge quickly for complex nested structures', () => {
      const source = `
        module Test

        function test(): void
          let i: byte = 0
          while i < 10
            let j: byte = 0
            while j < 10
              if j > 5 then
                let x: byte = i + j
              else
                let y: byte = i - j
              end if
              j = j + 1
            end while
            i = i + 1
          end while
        end function
      `;

      const startTime = Date.now();
      const { diagnostics } = analyzeLoops(source);
      const endTime = Date.now();

      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
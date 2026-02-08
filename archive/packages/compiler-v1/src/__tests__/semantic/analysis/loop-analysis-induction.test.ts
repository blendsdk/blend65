/**
 * Tests for Loop Analysis - Induction Variable Detection (Task 8.11.4-8.11.5)
 *
 * Tests detection of:
 * - Basic induction variables (Task 8.11.4) - variables that change by a constant each iteration
 * - Derived induction variables (Task 8.11.5) - linear functions of basic IVs
 */

import { describe, it, expect } from 'vitest';
import { Parser } from '../../../parser/parser.js';
import { Lexer } from '../../../lexer/lexer.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { LoopAnalyzer } from '../../../semantic/analysis/loop-analysis.js';

/**
 * Helper to parse and analyze source code for loop analysis
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

describe('LoopAnalyzer - Basic Induction Variable Detection (Task 8.11.4)', () => {
  it('should detect simple increment by 1', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
        }
      }
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

      function test(): void {
        let i: byte = 10;
        while (i > 0) {
          i = i - 1;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        while (i < 100) {
          i = i + 5;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          i = 1 + i;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = 0;
          while (j < 5) {
            j = j + 2;
          }
          i = i + 1;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        let x: byte = 0;
        while (i < 10) {
          x = i * 2;
          i = i + 1;
        }
      }
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

      function updateSprites(): void {
        let addr: byte = 0;
        while (addr < 16) {
          let pos: byte = addr;
          addr = addr + 2;
        }
      }
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

      function test(): void {
        let counter: byte = 42;
        while (counter < 100) {
          counter = counter + 3;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        let stride: byte = 2;
        while (i < 10) {
          i = i + stride;
        }
      }
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

      function countdown(): void {
        let i: byte = 20;
        while (i > 0) {
          i = i - 2;
        }
      }
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

      function test(): void {
        let a: byte = 0;
        while (a < 10) {
          a = a + 1;
        }

        let b: byte = 0;
        while (b < 20) {
          b = b + 4;
        }
      }
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

      function clearScreen(): void {
        let pos: byte = 0;
        while (pos < 250) {
          let offset: byte = pos;
          pos = pos + 1;
        }
      }
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

describe('LoopAnalyzer - Derived Induction Variable Detection (Task 8.11.5)', () => {
  it('should detect simple multiplication pattern (j = i * 4)', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = i * 4;
          i = i + 1;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = 4 * i;
          i = i + 1;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = i * 2 + 10;
          i = i + 1;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = 10 + i * 2;
          i = i + 1;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = i + 5;
          i = i + 1;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = 5 + i;
          i = i + 1;
        }
      }
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

      function test(): void {
        let i: byte = 10;
        while (i > 0) {
          let j: byte = i - 3;
          i = i - 1;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = i;
          i = i + 1;
        }
      }
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

      function updateSpritePointers(): void {
        let spriteNum: byte = 0;
        while (spriteNum < 8) {
          let addr: byte = spriteNum * 64;
          spriteNum = spriteNum + 1;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let doubleI: byte = i * 2;
          let quadI: byte = i * 4;
          let offsetI: byte = i + 100;
          i = i + 1;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        let x: byte = 0;
        while (i < 10) {
          x = x + i;
          i = i + 1;
        }
      }
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

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let rowOffset: byte = i * 40;
          let j: byte = 0;
          while (j < 40) {
            let screenPos: byte = rowOffset + j;
            j = j + 1;
          }
          i = i + 1;
        }
      }
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
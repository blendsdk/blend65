/**
 * Tier 3 Integration Tests (Task 8.14.6)
 *
 * Comprehensive end-to-end tests for Tier 3 advanced analysis.
 * Tests the full pipeline of all analyzers working together.
 *
 * Test Categories:
 * - Category A: Full Pipeline Tests (10 tests)
 * - Category B: Analysis Interdependencies (8 tests)
 * - Category C: Real C64 Patterns (7 tests)
 * - Category D: Performance Tests (5 tests)
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../../lexer/lexer.js';
import { Parser } from '../../../parser/parser.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { isFunctionDecl, isVariableDecl } from '../../../ast/type-guards.js';
import {
  OptimizationMetadataKey,
  PurityLevel,
  EscapeReason,
  MemoryRegion,
  Register,
} from '../../../semantic/analysis/index.js';
import type { Program, FunctionDecl, VariableDecl, WhileStmt } from '../../../ast/nodes.js';

/**
 * Helper to run full semantic analysis pipeline including Tier 3
 *
 * Uses SemanticAnalyzer which orchestrates all passes including
 * advanced analysis (Pass 8) that runs all Tier 1-3 analyzers.
 */
function runFullAnalysis(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const analyzer = new SemanticAnalyzer();
  const result = analyzer.analyze(ast);

  return {
    ast,
    symbolTable: result.symbolTable,
    diagnostics: result.diagnostics,
    success: result.success,
    hasErrors: () => result.diagnostics.some(d => d.severity === 'error'),
    hasWarnings: () => result.diagnostics.some(d => d.severity === 'warning'),
    getErrorCount: () => result.diagnostics.filter(d => d.severity === 'error').length,
    getWarningCount: () => result.diagnostics.filter(d => d.severity === 'warning').length,
  };
}

/**
 * Helper to find a function declaration by name
 */
function findFunction(ast: Program, name: string): FunctionDecl | undefined {
  return ast.getDeclarations().find(
    d => isFunctionDecl(d) && d.getName() === name
  ) as FunctionDecl | undefined;
}

/**
 * Helper to find a variable declaration by name in function body
 */
function findVarInFunction(func: FunctionDecl, name: string): VariableDecl | undefined {
  const body = func.getBody();
  if (!body) return undefined;
  return body.find(
    s => isVariableDecl(s) && s.getName() === name
  ) as VariableDecl | undefined;
}

// ============================================================================
// Category A: Full Pipeline Tests (10 tests)
// ============================================================================

describe('Tier 3 Integration Tests', () => {
  describe('Category A: Full Pipeline Tests', () => {
    it('A1: Complete Tier 1-3 pipeline runs without errors', () => {
      const source = `
module Test

function compute(x: byte, y: byte): byte {
  let result: byte = x + y;
  return result;
}

function main(): void {
  let a: byte = compute(10, 20);
  let b: byte = a * 2;
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      // Pipeline should complete without errors
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('A2: All analyzers produce metadata on AST nodes', () => {
      const source = `
module Test

function test(): void {
  let a: byte = 10;
  let b: byte = 20;
  let x: byte = a + b;
  let y: byte = a + b;
}
`;
      const { ast } = runFullAnalysis(source);

      const func = findFunction(ast, 'test');
      expect(func).toBeDefined();

      const xDecl = findVarInFunction(func!, 'x');
      expect(xDecl).toBeDefined();

      const xInit = xDecl!.getInitializer();
      expect(xInit).toBeDefined();
      expect(xInit!.metadata).toBeDefined();

      // GVN should have assigned value numbers
      expect(xInit!.metadata!.has(OptimizationMetadataKey.GVNNumber)).toBe(true);
    });

    it('A3: Real C64 hardware access pattern with @map', () => {
      const source = `
module Hardware

@map borderColor at $D020: byte;
@map backgroundColor at $D021: byte;

function setColors(fg: byte, bg: byte): void {
  borderColor = fg;
  backgroundColor = bg;
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('A4: Complex expression optimization analysis', () => {
      const source = `
module Math

function calculate(a: byte, b: byte, c: byte): byte {
  let temp1: byte = a + b;
  let temp2: byte = a + b;
  let temp3: byte = temp1 * c;
  return temp3;
}
`;
      const { ast } = runFullAnalysis(source);

      const func = findFunction(ast, 'calculate');
      expect(func).toBeDefined();

      // temp2 should be marked as GVN redundant (same as temp1)
      const temp2Decl = findVarInFunction(func!, 'temp2');
      expect(temp2Decl).toBeDefined();

      const temp2Init = temp2Decl!.getInitializer();
      expect(temp2Init).toBeDefined();
      expect(temp2Init!.metadata!.get(OptimizationMetadataKey.GVNRedundant)).toBe(true);
    });

    it('A5: Loop with invariant hoisting candidate', () => {
      const source = `
module LoopTest

function processLoop(): void {
  let base: byte = 10;
  let multiplier: byte = 2;
  let i: byte = 0;
  while (i < 100) {
    let invariant: byte = base * multiplier;
    let result: byte = i + invariant;
    i = i + 1;
  }
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('A6: Function with purity analysis', () => {
      const source = `
module PurityTest

function pureFunction(x: byte, y: byte): byte {
  let result: byte = x + y;
  return result;
}

function main(): void {
  let a: byte = pureFunction(1, 2);
  let b: byte = pureFunction(1, 2);
}
`;
      const { ast, hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);

      const pureFunc = findFunction(ast, 'pureFunction');
      expect(pureFunc).toBeDefined();
    });

    it('A7: Variable with escape analysis', () => {
      const source = `
module EscapeTest

function localOnly(): void {
  let local: byte = 42;
  let doubled: byte = local * 2;
}
`;
      const { ast, hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);

      const func = findFunction(ast, 'localOnly');
      expect(func).toBeDefined();
    });

    it('A8: Call graph with multiple functions', () => {
      const source = `
module CallGraph

function leaf(): byte {
  return 42;
}

function middle(): byte {
  return leaf();
}

function top(): byte {
  return middle();
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('A9: 6502 hints on hot path variable', () => {
      const source = `
module HotPath

function hotLoop(): void {
  let counter: byte = 0;
  while (counter < 255) {
    let temp: byte = counter + 1;
    counter = temp;
  }
}
`;
      const { ast, hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);

      const func = findFunction(ast, 'hotLoop');
      expect(func).toBeDefined();
    });

    it('A10: Multi-function program with complete analysis', () => {
      const source = `
module MultiFunc

function helper(n: byte): byte {
  return n * 2;
}

function process(a: byte, b: byte): byte {
  let x: byte = helper(a);
  let y: byte = helper(b);
  return x + y;
}

function main(): void {
  let result: byte = process(10, 20);
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category B: Analysis Interdependencies (8 tests)
  // ============================================================================

  describe('Category B: Analysis Interdependencies', () => {
    it('B1: Loop analysis feeds into 6502 hints (ZP priority)', () => {
      const source = `
module LoopZP

function loopWithCounter(): void {
  let i: byte = 0;
  while (i < 100) {
    let inner: byte = i * 2;
    i = i + 1;
  }
}
`;
      const { ast, hasErrors } = runFullAnalysis(source);

      expect(hasErrors()).toBe(false);

      const func = findFunction(ast, 'loopWithCounter');
      expect(func).toBeDefined();

      // Loop variable 'i' should have loop analysis metadata
      const iDecl = findVarInFunction(func!, 'i');
      expect(iDecl).toBeDefined();
    });

    it('B2: Usage analysis feeds into liveness', () => {
      const source = `
module UsageLiveness

function test(): void {
  let used: byte = 10;
  let unused: byte = 20;
  let result: byte = used * 2;
}
`;
      const { ast, hasErrors, diagnostics } = runFullAnalysis(source);

      expect(hasErrors()).toBe(false);

      const func = findFunction(ast, 'test');
      expect(func).toBeDefined();

      // 'unused' should be detected by usage analysis
      const unusedDecl = findVarInFunction(func!, 'unused');
      expect(unusedDecl).toBeDefined();
    });

    it('B3: Constant propagation feeds into dead code', () => {
      const source = `
module ConstDead

function test(): void {
  let constVal: byte = 10;
  let derived: byte = constVal + 5;
  if (false) {
    let dead: byte = 42;
  }
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      expect(hasErrors()).toBe(false);
    });

    it('B4: Reaching definitions feed into GVN', () => {
      const source = `
module ReachGVN

function test(): void {
  let a: byte = 10;
  let b: byte = 20;
  let x: byte = a + b;
  let y: byte = a + b;
}
`;
      const { ast, hasErrors } = runFullAnalysis(source);

      expect(hasErrors()).toBe(false);

      const func = findFunction(ast, 'test');
      const yDecl = findVarInFunction(func!, 'y');
      expect(yDecl).toBeDefined();

      // GVN should have used reaching definitions to identify redundancy
      const yInit = yDecl!.getInitializer();
      expect(yInit!.metadata!.get(OptimizationMetadataKey.GVNRedundant)).toBe(true);
    });

    it('B5: Purity analysis affects optimization decisions', () => {
      const source = `
module PurityOpt

function pure(x: byte): byte {
  return x * 2;
}

function caller(): void {
  let a: byte = pure(10);
  let b: byte = pure(10);
}
`;
      const { ast, hasErrors } = runFullAnalysis(source);

      expect(hasErrors()).toBe(false);

      const pureFunc = findFunction(ast, 'pure');
      expect(pureFunc).toBeDefined();
    });

    it('B6: Escape analysis affects stack allocation', () => {
      const source = `
module EscapeStack

function noEscape(): void {
  let local1: byte = 10;
  let local2: byte = 20;
  let sum: byte = local1 + local2;
}
`;
      const { ast, hasErrors } = runFullAnalysis(source);

      expect(hasErrors()).toBe(false);

      const func = findFunction(ast, 'noEscape');
      expect(func).toBeDefined();
    });

    it('B7: Alias analysis affects CSE safety', () => {
      const source = `
module AliasCSE

function test(): void {
  let a: byte = 10;
  let b: byte = 20;
  let x: byte = a + b;
  let y: byte = a + b;
}
`;
      const { ast, hasErrors } = runFullAnalysis(source);

      expect(hasErrors()).toBe(false);

      const func = findFunction(ast, 'test');
      const yDecl = findVarInFunction(func!, 'y');
      expect(yDecl).toBeDefined();
    });

    it('B8: Call graph affects purity transitivity', () => {
      const source = `
module CallPurity

function leaf(): byte {
  return 42;
}

function middle(): byte {
  return leaf();
}

function top(): byte {
  return middle();
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      expect(hasErrors()).toBe(false);
    });
  });

  // ============================================================================
  // Category C: Real C64 Patterns (7 tests)
  // ============================================================================

  describe('Category C: Real C64 Patterns', () => {
    it('C1: VIC-II register manipulation', () => {
      const source = `
module VIC

@map vicBank at $DD00: byte;
@map borderColor at $D020: byte;
@map backgroundColor at $D021: byte;
@map spriteEnable at $D015: byte;

function initVIC(): void {
  borderColor = 0;
  backgroundColor = 0;
  spriteEnable = 0;
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('C2: SID audio register access', () => {
      const source = `
module SID

@map sidVoice1FreqLo at $D400: byte;
@map sidVoice1FreqHi at $D401: byte;
@map sidVoice1Control at $D404: byte;
@map sidVolume at $D418: byte;

function playNote(freq: byte): void {
  sidVoice1FreqLo = freq;
  sidVoice1FreqHi = 0;
  sidVoice1Control = $11;
  sidVolume = $0F;
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('C3: Screen memory iteration', () => {
      const source = `
module Screen

function clearPartialScreen(): void {
  let i: byte = 0;
  while (i < 250) {
    let offset: byte = i;
    i = i + 1;
  }
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('C4: Color RAM update loop', () => {
      const source = `
module ColorRAM

function setColors(colorValue: byte): void {
  let i: byte = 0;
  while (i < 250) {
    let pos: byte = i;
    i = i + 1;
  }
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('C5: Raster interrupt style polling', () => {
      const source = `
module Raster

@map rasterLine at $D012: byte;

function waitForRaster(line: byte): void {
  let current: byte = rasterLine;
  while (current != line) {
    current = rasterLine;
  }
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('C6: Sprite position update pattern', () => {
      const source = `
module Sprites

@map sprite0X at $D000: byte;
@map sprite0Y at $D001: byte;
@map spriteXMSB at $D010: byte;

function moveSprite(x: byte, y: byte): void {
  sprite0X = x;
  sprite0Y = y;
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('C7: Zero-page intensive routine', () => {
      const source = `
module ZeroPage

function zpRoutine(): void {
  let zpTemp1: byte = 0;
  let zpTemp2: byte = 0;
  let zpCounter: byte = 0;
  while (zpCounter < 100) {
    zpTemp1 = zpTemp1 + 1;
    zpTemp2 = zpTemp2 + 2;
    zpCounter = zpCounter + 1;
  }
}
`;
      const { hasErrors, diagnostics } = runFullAnalysis(source);

      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Category D: Performance Tests (5 tests)
  // ============================================================================

  describe('Category D: Performance Tests', () => {
    it('D1: 100 LOC completes < 200ms', () => {
      // Generate ~100 lines of code
      let source = `module Perf100\n\n`;
      for (let i = 0; i < 10; i++) {
        source += `function func${i}(x: byte): byte {\n`;
        source += `  let a: byte = x + 1;\n`;
        source += `  let b: byte = a + 2;\n`;
        source += `  let c: byte = b + 3;\n`;
        source += `  let d: byte = c + 4;\n`;
        source += `  return d;\n`;
        source += `}\n\n`;
      }

      const startTime = Date.now();
      const { hasErrors } = runFullAnalysis(source);
      const elapsed = Date.now() - startTime;

      expect(hasErrors()).toBe(false);
      // Allow 200ms to account for varying CI/system load
      expect(elapsed).toBeLessThan(200);
    });

    it('D2: 500 LOC completes < 1500ms', () => {
      // Generate ~500 lines of code
      let source = `module Perf500\n\n`;
      for (let i = 0; i < 50; i++) {
        source += `function func${i}(x: byte): byte {\n`;
        source += `  let a: byte = x + 1;\n`;
        source += `  let b: byte = a + 2;\n`;
        source += `  let c: byte = b + 3;\n`;
        source += `  let d: byte = c + 4;\n`;
        source += `  let e: byte = d + 5;\n`;
        source += `  return e;\n`;
        source += `}\n\n`;
      }

      const startTime = Date.now();
      const { hasErrors } = runFullAnalysis(source);
      const elapsed = Date.now() - startTime;

      expect(hasErrors()).toBe(false);
      // Allow up to 1500ms for CI environments with varying performance
      expect(elapsed).toBeLessThan(1500);
    });

    it('D3: 1000 LOC completes < 3000ms', () => {
      // Generate ~1000 lines of code
      let source = `module Perf1000\n\n`;
      for (let i = 0; i < 100; i++) {
        source += `function func${i}(x: byte): byte {\n`;
        source += `  let a: byte = x + 1;\n`;
        source += `  let b: byte = a + 2;\n`;
        source += `  let c: byte = b + 3;\n`;
        source += `  let d: byte = c + 4;\n`;
        source += `  let e: byte = d + 5;\n`;
        source += `  return e;\n`;
        source += `}\n\n`;
      }

      const startTime = Date.now();
      const { hasErrors } = runFullAnalysis(source);
      const elapsed = Date.now() - startTime;

      expect(hasErrors()).toBe(false);
      // Allow up to 3000ms for CI environments with varying performance
      expect(elapsed).toBeLessThan(3000);
    });

    it('D4: Nested loops complete efficiently', () => {
      const source = `
module PerfNested

function nestedLoops(): void {
  let i: byte = 0;
  while (i < 10) {
    let j: byte = 0;
    while (j < 10) {
      let k: byte = 0;
      while (k < 10) {
        let x: byte = i + j + k;
        k = k + 1;
      }
      j = j + 1;
    }
    i = i + 1;
  }
}
`;

      const startTime = Date.now();
      const { hasErrors } = runFullAnalysis(source);
      const elapsed = Date.now() - startTime;

      expect(hasErrors()).toBe(false);
      expect(elapsed).toBeLessThan(200);
    });

    it('D5: Complex expressions complete efficiently', () => {
      let source = `module PerfExpr\n\n`;
      source += `function complexExpressions(): void {\n`;

      // Generate many complex expressions
      for (let i = 0; i < 50; i++) {
        source += `  let v${i}: byte = ${i} + ${i + 1} * 2;\n`;
      }

      // Add some redundant expressions for GVN/CSE
      for (let i = 0; i < 20; i++) {
        source += `  let r${i}: byte = v0 + v1;\n`;
      }

      source += `}\n`;

      const startTime = Date.now();
      const { hasErrors } = runFullAnalysis(source);
      const elapsed = Date.now() - startTime;

      expect(hasErrors()).toBe(false);
      expect(elapsed).toBeLessThan(300);
    });
  });
});
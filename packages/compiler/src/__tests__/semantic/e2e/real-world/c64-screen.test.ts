/**
 * C64 Screen Address E2E Tests
 * Small, focused tests for screen address calculations
 */

import { describe, it, expect } from 'vitest';
import { SemanticAnalyzer, type AnalysisResult } from '../../../../semantic/index.js';
import { Parser } from '../../../../parser/index.js';
import { Lexer } from '../../../../lexer/index.js';
import type { Program } from '../../../../ast/index.js';

function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

function analyze(source: string): AnalysisResult {
  const program = parse(source);
  const analyzer = new SemanticAnalyzer();
  return analyzer.analyze(program);
}

describe('C64 Screen Calculations', () => {
  it('should analyze screen position calculation', () => {
    const result = analyze(`
      module ScreenPos;
      const SCREEN_BASE: word = $0400;
      function getScreenAddr(row: byte, col: byte): word {
        let offset: word = row * 40 + col;
        return SCREEN_BASE + offset;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze color RAM calculation', () => {
    const result = analyze(`
      module ColorPos;
      const COLOR_RAM: word = $D800;
      function getColorAddr(row: byte, col: byte): word {
        return COLOR_RAM + row * 40 + col;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze screen clear function', () => {
    const result = analyze(`
      module ScreenClear;
      function clearScreen(): void {
        let i: word = 0;
        while (i < 1000) { i = i + 1; }
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze plot character function', () => {
    const result = analyze(`
      module PlotChar;
      function plotChar(x: byte, y: byte, ch: byte): void {
        let offset: word = y * 40 + x;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze fill color function', () => {
    const result = analyze(`
      module FillColor;
      function fillColor(color: byte): void {
        let i: word = 0;
        while (i < 1000) { i = i + 1; }
      }
    `);
    expect(result.success).toBe(true);
  });
});
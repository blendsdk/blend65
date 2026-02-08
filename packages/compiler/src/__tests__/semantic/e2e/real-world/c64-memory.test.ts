/**
 * C64 Memory Constants E2E Tests
 * Small, focused tests for C64 memory address constants
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

describe('C64 Memory Constants', () => {
  it('should analyze VIC-II address constants', () => {
    const result = analyze(`
      module VIC;
      const VIC_BASE: word = $D000;
      const VIC_BORDER: word = $D020;
      const VIC_BACKGROUND: word = $D021;
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze screen memory constants', () => {
    const result = analyze(`
      module Screen;
      const SCREEN_BASE: word = $0400;
      const COLOR_RAM: word = $D800;
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze SID address constants', () => {
    const result = analyze(`
      module SID;
      const SID_BASE: word = $D400;
      const SID_VOLUME: word = $D418;
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze CIA address constants', () => {
    const result = analyze(`
      module CIA;
      const CIA1_PORTA: word = $DC00;
      const CIA1_PORTB: word = $DC01;
      const CIA2_PORTA: word = $DD00;
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze C64 color constants', () => {
    const result = analyze(`
      module Colors;
      const BLACK: byte = 0;
      const WHITE: byte = 1;
      const RED: byte = 2;
      const BLUE: byte = 6;
    `);
    expect(result.success).toBe(true);
  });
});
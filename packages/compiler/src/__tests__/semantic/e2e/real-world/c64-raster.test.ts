/**
 * C64 Raster E2E Tests
 * Small, focused tests for raster handling
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

describe('C64 Raster Handling', () => {
  it('should analyze VIC raster registers', () => {
    const result = analyze(`
      module RasterRegs;
      const VIC_RASTER: word = $D012;
      const VIC_CONTROL: word = $D011;
      const VIC_IRQ_ENABLE: word = $D01A;
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze raster line reading', () => {
    const result = analyze(`
      module RasterRead;
      function getRasterLine(): word {
        let low: byte = 0;
        let high: word = 0;
        return high | low;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze raster wait loop', () => {
    const result = analyze(`
      module RasterWait;
      function waitLine(line: byte): void {
        let cur: byte = 0;
        while (cur != line) { cur = 0; }
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze IRQ acknowledge', () => {
    const result = analyze(`
      module RasterIRQ;
      const VIC_IRQ_STATUS: word = $D019;
      function ackIRQ(): void {
        let ack: byte = 1;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze border color timing', () => {
    const result = analyze(`
      module BorderTime;
      function flashBorder(): void {
        let i: byte = 0;
        while (i < 16) { i = i + 1; }
      }
    `);
    expect(result.success).toBe(true);
  });
});
/**
 * C64 Sprite Programming E2E Tests
 * Small, focused tests for sprite handling
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

describe('C64 Sprite Programming', () => {
  it('should analyze sprite position setting', () => {
    const result = analyze(`
      module SpritePos;
      function setSpriteXY(num: byte, x: word, y: byte): void {
        let xWord: word = x;
        let xLow: word = xWord & $FF;
        let xHigh: word = xWord >> 8;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze sprite enable mask', () => {
    const result = analyze(`
      module SpriteEnable;
      function enableSprite(num: byte): byte {
        return 1 << num;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze sprite disable mask', () => {
    const result = analyze(`
      module SpriteDisable;
      function disableSpriteMask(num: byte): byte {
        return ~(1 << num);
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze sprite color setting', () => {
    const result = analyze(`
      module SpriteColor;
      const VIC_SPRITE0_COLOR: word = $D027;
      function getColorReg(num: byte): word {
        return VIC_SPRITE0_COLOR + num;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze sprite pointer calculation', () => {
    const result = analyze(`
      module SpritePointer;
      const SPRITE_PTRS: word = $07F8;
      function getPointerAddr(num: byte): word {
        return SPRITE_PTRS + num;
      }
    `);
    expect(result.success).toBe(true);
  });
});
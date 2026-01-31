/**
 * C64 Joystick Reading E2E Tests
 * Small, focused tests for joystick handling
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

describe('C64 Joystick Reading', () => {
  it('should analyze joystick direction constants', () => {
    const result = analyze(`
      module JoyConst;
      const JOY_UP: byte = 1;
      const JOY_DOWN: byte = 2;
      const JOY_LEFT: byte = 4;
      const JOY_RIGHT: byte = 8;
      const JOY_FIRE: byte = 16;
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze joystick up check', () => {
    const result = analyze(`
      module JoyUp;
      function isUp(joyState: byte): bool {
        return (joyState & 1) == 0;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze joystick fire check', () => {
    const result = analyze(`
      module JoyFire;
      function isFire(joyState: byte): bool {
        return (joyState & 16) == 0;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze direction decoding', () => {
    const result = analyze(`
      module JoyDecode;
      function getDir(state: byte): byte {
        let dir: byte = 0;
        if ((state & 1) == 0) { dir = dir | 1; }
        if ((state & 2) == 0) { dir = dir | 2; }
        return dir;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze joystick port addresses', () => {
    const result = analyze(`
      module JoyPorts;
      const CIA1_PORTA: word = $DC00;
      const CIA1_PORTB: word = $DC01;
    `);
    expect(result.success).toBe(true);
  });
});
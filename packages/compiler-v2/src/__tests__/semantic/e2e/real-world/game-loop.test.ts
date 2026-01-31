/**
 * Game Loop Pattern E2E Tests
 * Small, focused tests for game loop patterns
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

describe('Game Loop Patterns', () => {
  it('should analyze basic game loop', () => {
    const result = analyze(`
      module GameLoop;
      function mainLoop(): void {
        let running: bool = true;
        while (running) {
          running = true;
        }
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze init-loop-cleanup pattern', () => {
    const result = analyze(`
      module InitLoop;
      function init(): void {}
      function update(): void {}
      function cleanup(): void {}
      function main(): void {
        init();
        update();
        cleanup();
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze frame counter pattern', () => {
    const result = analyze(`
      module FrameCount;
      let frameCount: word = 0;
      function tick(): void {
        frameCount = frameCount + 1;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze input-update-render pattern', () => {
    const result = analyze(`
      module GameUpdate;
      function readInput(): void {}
      function updateLogic(): void {}
      function render(): void {}
      function frame(): void {
        readInput();
        updateLogic();
        render();
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze game tick timing', () => {
    const result = analyze(`
      module GameTick;
      let lastTick: byte = 0;
      function waitForTick(): void {
        while (lastTick == 0) {
          lastTick = 0;
        }
      }
    `);
    expect(result.success).toBe(true);
  });
});
/**
 * Game State Pattern E2E Tests
 * Small, focused tests for game state management
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

describe('Game State Patterns', () => {
  it('should analyze player position state', () => {
    const result = analyze(`
      module PlayerState;
      let playerX: byte = 100;
      let playerY: byte = 100;
      function movePlayer(dx: byte, dy: byte): void {
        playerX = playerX + dx;
        playerY = playerY + dy;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze game score state', () => {
    const result = analyze(`
      module ScoreState;
      let score: word = 0;
      let highScore: word = 0;
      function addScore(points: word): void {
        score = score + points;
        if (score > highScore) {
          highScore = score;
        }
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze game level state', () => {
    const result = analyze(`
      module LevelState;
      let level: byte = 1;
      let lives: byte = 3;
      function nextLevel(): void {
        level = level + 1;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze game flags state', () => {
    const result = analyze(`
      module FlagState;
      let gameOver: bool = false;
      let paused: bool = false;
      function togglePause(): void {
        paused = !paused;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should analyze enemy position state', () => {
    const result = analyze(`
      module EnemyState;
      let enemyX: byte[8] = [0, 0, 0, 0, 0, 0, 0, 0];
      let enemyY: byte[8] = [0, 0, 0, 0, 0, 0, 0, 0];
      function setEnemy(i: byte, x: byte, y: byte): void {
        enemyX[i] = x;
        enemyY[i] = y;
      }
    `);
    expect(result.success).toBe(true);
  });
});
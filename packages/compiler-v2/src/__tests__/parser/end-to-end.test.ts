/**
 * End-to-End Parser Tests (V2)
 *
 * Tests complete parsing workflows with realistic Blend65 programs:
 * - Real-world code examples
 * - Integration with lexer
 * - Performance with larger programs
 * - Complete error scenarios
 *
 * NOTE: V2 has NO storage classes (@zp/@ram/@data) - frame allocator handles memory.
 * NOTE: V2 has NO @map syntax - uses peek/poke intrinsics instead.
 */

import { describe, expect, it } from 'vitest';
import { BinaryExpression, LiteralExpression, Program, VariableDecl } from '../../ast/index.js';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';

/**
 * Helper function to parse complete Blend65 source code
 */
function parseBlendProgram(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();

  return {
    program,
    parser,
    hasErrors: parser.hasErrors(),
    diagnostics: parser.getDiagnostics(),
  };
}

describe('End-to-End Parser Tests', () => {
  describe('Complete Blend65 Programs', () => {
    it('parses simple variable program', () => {
      const source = `
        module Game;

        let score: word = 0;
        const MAX_LIVES: byte = 3;
        let lives: byte = MAX_LIVES;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program).toBeInstanceOf(Program);
      expect(result.program.getModule().getFullName()).toBe('Game');
      expect(result.program.getDeclarations()).toHaveLength(3);

      const [scoreDecl, livesDecl, currentLivesDecl] = result.program.getDeclarations();
      expect((scoreDecl as VariableDecl).getName()).toBe('score');
      expect((livesDecl as VariableDecl).getName()).toBe('MAX_LIVES');
      expect((currentLivesDecl as VariableDecl).getName()).toBe('lives');
    });

    // V2: Removed "parses C64 memory mapping program" - all @map syntax

    it('parses game logic with expressions', () => {
      const source = `
        module Game.Logic;

        export let playerX: byte = 100;
        export let playerY: byte = 50;
        const SCREEN_WIDTH: byte = 320;
        const SCREEN_HEIGHT: byte = 200;

        // Complex expressions
        let boundedX: byte = playerX + 10 * 2;
        let isOnScreen: boolean = playerX < SCREEN_WIDTH && playerY < SCREEN_HEIGHT;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getDeclarations()).toHaveLength(6);

      // Check complex expression parsing
      const boundedXDecl = result.program.getDeclarations()[4] as VariableDecl;
      expect(boundedXDecl.getName()).toBe('boundedX');
      expect(boundedXDecl.getInitializer()).toBeInstanceOf(BinaryExpression);

      const isOnScreenDecl = result.program.getDeclarations()[5] as VariableDecl;
      expect(isOnScreenDecl.getName()).toBe('isOnScreen');
      expect(isOnScreenDecl.getInitializer()).toBeInstanceOf(BinaryExpression);
    });

    it('parses game constants module', () => {
      const source = `
        module Game.Constants;

        // Sprite configuration
        export const MAX_SPRITES: byte = 8;
        export const SPRITE_SIZE: byte = 64;
        export const SCREEN_WIDTH: word = 320;
        export const SCREEN_HEIGHT: word = 200;
        
        // Game limits
        export const MAX_ENEMIES: byte = 16;
        export const MAX_BULLETS: byte = 4;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getModule().getFullName()).toBe('Game.Constants');
      expect(result.program.getDeclarations()).toHaveLength(6);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('recovers from syntax errors and continues parsing', () => {
      const source = `
        module ErrorTest

        let valid1: byte = 5;

        invalid let byte = ;

        let valid2: byte = 10;
        let test: byte = 1;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(true);
      expect(result.diagnostics.length).toBeGreaterThan(0);

      // Should still parse valid declarations
      expect(result.program.getDeclarations().length).toBeGreaterThan(0);
    });

    // V2: Removed "handles malformed @map declarations" - no @map in v2

    it('handles missing semicolons', () => {
      const source = `
        module SemicolonTest

        let x: byte = 1  // Missing semicolon
        let y: byte = 2;
        let z: byte = 3  // Missing semicolon
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(true);
      // Should report multiple missing semicolon errors
      expect(result.diagnostics.length).toBeGreaterThan(1);
    });
  });

  describe('Performance and Scale Tests', () => {
    it('handles programs with many variables', () => {
      let source = 'module Performance;\n';

      // Generate 50 variable declarations
      for (let i = 0; i < 50; i++) {
        source += `let var${i}: byte = ${i};\n`;
      }

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getDeclarations()).toHaveLength(50);
    });

    it('handles programs with complex expressions', () => {
      const source = `
        module ComplexMath;

        let a: word = 1;
        let b: word = 2;
        let c: word = 3;
        let d: word = 4;

        // Deeply nested expression
        let result: word = ((a + b) * (c - d)) + ((a * b) - (c + d));

        // Multiple operations
        let complex: word = a + b * c - d + a * b + c - d;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getDeclarations()).toHaveLength(6);

      // Verify complex expressions were parsed
      const resultDecl = result.program.getDeclarations()[4] as VariableDecl;
      expect(resultDecl.getName()).toBe('result');
      expect(resultDecl.getInitializer()).toBeInstanceOf(BinaryExpression);
    });

    it('handles programs with many variable declarations', () => {
      const source = `
        module Mixed;

        // Variables
        let gameState: byte = 0;
        const VERSION: word = 100;

        // Exported variables
        export let playerX: byte = 100;
        export let playerY: byte = 50;
        export const MAX_SCORE: word = 99999;

        // More variables
        let counter: byte = 0;
        const BUFFER_SIZE: word = 1024;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getDeclarations()).toHaveLength(7);

      // Verify mix of declaration types
      const declarations = result.program.getDeclarations();
      const hasVariableDecl = declarations.some(d => d instanceof VariableDecl);
      expect(hasVariableDecl).toBe(true);
    });
  });

  describe('Realistic Game Examples', () => {
    it('parses space invaders style game setup', () => {
      const source = `
        module SpaceInvaders;

        // Game state
        export let score: word = 0;
        export let lives: byte = 3;
        export let level: byte = 1;

        // Player data
        let playerX: byte = 160;
        let playerY: byte = 230;
        const PLAYER_SPEED: byte = 2;

        // Screen constants
        const SCREEN_WIDTH: word = 320;
        const SCREEN_HEIGHT: word = 200;

        // Color calculations
        let playerColor: byte = 1 + level * 2;
        let enemyColor: byte = 2 + (level + 1) * 3;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getModule().getFullName()).toBe('SpaceInvaders');
      expect(result.program.getDeclarations()).toHaveLength(10);
    });

    it('parses C64 demo effect setup', () => {
      const source = `
        module Demo.Effects;

        // Raster interrupt data
        let rasterLine: byte = 50;
        let colorIndex: byte = 0;

        // Color cycle data
        const CYCLE_LENGTH: byte = 16;
        const RASTER_STEP: byte = 8;

        // Timing calculations
        let nextRaster: byte = rasterLine + 1;
        let colorOffset: byte = (colorIndex + 1) * 2;
        let isEvenFrame: boolean = (colorIndex + 1) == 0;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getModule().getFullName()).toBe('Demo.Effects');
      expect(result.program.getDeclarations()).toHaveLength(7);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('handles minimal valid program', () => {
      const source = 'let x: byte;';
      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getDeclarations()).toHaveLength(1);
    });

    it('handles program with only comments and whitespace', () => {
      const source = `
        // This is a comment

        // Another comment

      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getDeclarations()).toHaveLength(0);
    });

    it('handles program with deep module nesting and expressions', () => {
      const source = `
        module Very.Deeply.Nested.Module.Name;

        let field1: byte = 1;
        let field2: byte = 2;
        let field3: byte = 3;
        let field4: byte = 4;
        let field5: byte = 5;

        let deepExpr: word = ((((1 + 2) * 3) - 4) + 5) * 6;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getModule().getNamePath()).toHaveLength(5);
      expect(result.program.getDeclarations()).toHaveLength(6);
    });
  });

  describe('Lexer-Parser Integration', () => {
    it('handles all number formats correctly', () => {
      const source = `
        module Numbers;

        let decimal: word = 1024;
        let hexDollar: word = $D020;
        let hexPrefix: word = 0xFF00;
        let binary: byte = 0b11110000;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);

      const declarations = result.program.getDeclarations();
      expect((declarations[0] as VariableDecl).getInitializer()).toBeInstanceOf(LiteralExpression);
      expect((declarations[1] as VariableDecl).getInitializer()).toBeInstanceOf(LiteralExpression);
      expect((declarations[2] as VariableDecl).getInitializer()).toBeInstanceOf(LiteralExpression);
      expect((declarations[3] as VariableDecl).getInitializer()).toBeInstanceOf(LiteralExpression);

      // Verify values are parsed correctly
      expect(
        ((declarations[0] as VariableDecl).getInitializer() as LiteralExpression).getValue()
      ).toBe(1024);
      expect(
        ((declarations[1] as VariableDecl).getInitializer() as LiteralExpression).getValue()
      ).toBe(0xd020);
      expect(
        ((declarations[2] as VariableDecl).getInitializer() as LiteralExpression).getValue()
      ).toBe(0xff00);
      expect(
        ((declarations[3] as VariableDecl).getInitializer() as LiteralExpression).getValue()
      ).toBe(0b11110000);
    });

    it('handles string and boolean literals', () => {
      const source = `
        module Literals;

        let message: string = "Hello, Blend65!";
        let debug: boolean = true;
        let release: boolean = false;
        let empty: string = "";
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getDeclarations()).toHaveLength(4);

      const declarations = result.program.getDeclarations();
      expect(
        ((declarations[0] as VariableDecl).getInitializer() as LiteralExpression).getValue()
      ).toBe('Hello, Blend65!');
      expect(
        ((declarations[1] as VariableDecl).getInitializer() as LiteralExpression).getValue()
      ).toBe(true);
      expect(
        ((declarations[2] as VariableDecl).getInitializer() as LiteralExpression).getValue()
      ).toBe(false);
      expect(
        ((declarations[3] as VariableDecl).getInitializer() as LiteralExpression).getValue()
      ).toBe('');
    });
  });

  describe('Error Scenarios', () => {
    it('handles completely malformed input', () => {
      const source = `
        invalid let x: byte = ;
        unexpected tokens here
        let let let;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(true);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      // Should still return a Program node (for IDE support)
      expect(result.program).toBeInstanceOf(Program);
    });

    it('handles mixed valid and invalid content', () => {
      const source = `
        module MixedErrors

        let valid1: byte = 5;

        invalid let x: byte = ;  // Multiple syntax errors

        let valid2: byte = 10;

        let broken: = byte;    // Invalid syntax

        let valid3: byte = 15;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(true);
      expect(result.diagnostics.length).toBeGreaterThan(1);

      // Should still parse some valid declarations
      expect(result.program.getDeclarations().length).toBeGreaterThan(0);
    });
  });

  describe('Complex Real-World Scenarios', () => {
    it('parses complete C64 game initialization', () => {
      const source = `
        module C64Game.Init;

        // Game variables
        export let gameState: byte = 0;
        export let frameCounter: byte = 0;
        export let score: word = 0;
        export let hiScore: word = 5000;

        // Constants
        const SCREEN_WIDTH: byte = 40;
        const SCREEN_HEIGHT: byte = 25;
        const MAX_SCORE: word = 99999;

        // Memory addresses as constants (v2 uses peek/poke)
        const VIC_BORDER: word = $D020;
        const VIC_BACKGROUND: word = $D021;
        const SCREEN_RAM: word = $0400;

        // Calculated values
        let screenCenter: byte = SCREEN_WIDTH + SCREEN_HEIGHT * 2;
        let scoreMultiplier: word = (level + 1) * 100;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getModule().getFullName()).toBe('C64Game.Init');
      expect(result.program.getDeclarations()).toHaveLength(12);
    });
  });

  describe('Performance Benchmarks', () => {
    it('parses large programs efficiently', () => {
      let source = 'module LargeProgram;\n';

      // Generate a large program with many declarations
      for (let i = 0; i < 200; i++) {
        source += `let var${i}: byte = ${i % 256};\n`;
        if (i % 10 === 0) {
          source += `const ADDR${i}: word = $${(0x1000 + i).toString(16).toUpperCase()};\n`;
        }
      }

      const startTime = performance.now();
      const result = parseBlendProgram(source);
      const endTime = performance.now();

      expect(result.hasErrors).toBe(false);
      expect(result.program.getDeclarations().length).toBeGreaterThan(200);

      // Performance check - should parse reasonably quickly
      const parseTime = endTime - startTime;
      expect(parseTime).toBeLessThan(1000); // Less than 1 second
    });
  });
});
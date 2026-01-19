/**
 * End-to-End Parser Tests
 *
 * Tests complete parsing workflows with realistic Blend65 programs:
 * - Real-world code examples
 * - Integration with lexer
 * - Performance with larger programs
 * - Complete error scenarios
 */

import { describe, expect, it } from 'vitest';
import {
  BinaryExpression,
  LiteralExpression,
  Program,
  SequentialStructMapDecl,
  SimpleMapDecl,
  VariableDecl,
} from '../../ast/index.js';
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
        module Game

        let score: word = 0;
        const MAX_LIVES: byte = 3;
        @zp let lives: byte = MAX_LIVES;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program).toBeInstanceOf(Program);
      expect(result.program.getModule().getFullName()).toBe('Game');
      expect(result.program.getDeclarations()).toHaveLength(3);

      const [scoreDecl, livesDecl, zpLivesDecl] = result.program.getDeclarations();
      expect((scoreDecl as VariableDecl).getName()).toBe('score');
      expect((livesDecl as VariableDecl).getName()).toBe('MAX_LIVES');
      expect((zpLivesDecl as VariableDecl).getName()).toBe('lives');
    });

    it('parses C64 memory mapping program', () => {
      const source = `
        module Hardware.C64

        // VIC-II registers
        @map vic at $D000 layout
          borderColor: at $D020: byte,
          backgroundColor: at $D021: byte,
          sprites: from $D000 to $D02E: byte
        end @map

        // SID sound chip
        @map sid at $D400 type
          voice1Freq: word,
          voice1Pulse: word,
          voice1Control: byte,
          voice1Attack: byte
        end @map

        // Screen memory
        @map screen from $0400 to $07E7: byte;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getModule().getFullName()).toBe('Hardware.C64');
      expect(result.program.getDeclarations()).toHaveLength(3);
    });

    it('parses game logic with expressions', () => {
      const source = `
        module Game.Logic

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

    it('parses sprite system module', () => {
      const source = `
        module Graphics.Sprites

        // Sprite data structures
        @map spritePointers from $07F8 to $07FF: byte;
        @map spriteData from $2000 to $3FFF: byte;

        // Sprite registers
        @map spriteRegs at $D000 type
          x: byte[8],
          y: byte[8],
          msb: byte,
          enable: byte,
          expandX: byte,
          expandY: byte,
          priority: byte,
          multicolor: byte,
          colors: byte[8]
        end @map

        // Sprite configuration
        export const MAX_SPRITES: byte = 8;
        export @data let spriteBuffer: byte = 0;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getModule().getFullName()).toBe('Graphics.Sprites');
      expect(result.program.getDeclarations()).toHaveLength(5);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('recovers from syntax errors and continues parsing', () => {
      const source = `
        module ErrorTest

        let valid1: byte = 5;

        invalid let byte = ;

        let valid2: byte = 10;
        @map test at $1000: byte;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(true);
      expect(result.diagnostics.length).toBeGreaterThan(0);

      // Should still parse valid declarations
      expect(result.program.getDeclarations().length).toBeGreaterThan(0);
    });

    it('handles malformed @map declarations', () => {
      const source = `
        module MapErrors

        // Valid declaration
        let x: byte = 1;

        // Invalid @map (missing 'at')
        @map broken $1000: byte;

        // Another valid declaration
        let y: byte = 2;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(true);
      // Should still parse valid declarations
      expect(result.program.getDeclarations().length).toBeGreaterThan(1);
    });

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
      let source = 'module Performance\n';

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
        module ComplexMath

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

    it('handles programs with mixed declaration types', () => {
      const source = `
        module Mixed

        // Variables
        let gameState: byte = 0;
        const VERSION: word = 100;

        // Simple maps
        @map borderColor at $D020: byte;
        @map backgroundColor at $D021: byte;

        // Range map
        @map colorRam from $D800 to $DBE7: byte;

        // Sequential struct
        @map player at $8000 type
          x: byte,
          y: byte,
          sprite: byte,
          health: byte
        end @map

        // Explicit struct
        @map vic at $D000 layout
          border: at $D020: byte,
          background: at $D021: byte
        end @map

        // More variables
        export @zp let fastCounter: byte = 0;
        export @ram const BUFFER_SIZE: word = 1024;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getDeclarations()).toHaveLength(9);

      // Verify mix of declaration types
      const declarations = result.program.getDeclarations();
      const hasVariableDecl = declarations.some(d => d instanceof VariableDecl);
      const hasSimpleMapDecl = declarations.some(d => d instanceof SimpleMapDecl);
      const hasStructMapDecl = declarations.some(d => d instanceof SequentialStructMapDecl);

      expect(hasVariableDecl).toBe(true);
      expect(hasSimpleMapDecl).toBe(true);
      expect(hasStructMapDecl).toBe(true);
    });
  });

  describe('Realistic Game Examples', () => {
    it('parses space invaders style game setup', () => {
      const source = `
        module SpaceInvaders

        // Game state
        export let score: word = 0;
        export let lives: byte = 3;
        export let level: byte = 1;

        // Player data
        @zp let playerX: byte = 160;
        @zp let playerY: byte = 230;
        const PLAYER_SPEED: byte = 2;

        // VIC-II memory mapping
        @map vic at $D000 layout
          sprites: from $D000 to $D00F: byte,
          spriteX: from $D000 to $D00F: byte,
          spriteY: from $D001 to $D00F: byte,
          borderColor: at $D020: byte,
          backgroundColor: at $D021: byte
        end @map

        // Sprite pointers
        @map spritePointers from $07F8 to $07FF: byte;

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
        module Demo.Effects

        // Raster interrupt data
        @zp let rasterLine: byte = 50;
        @zp let colorIndex: byte = 0;

        // Color cycle data
        @data const rainbow: byte = 1;  // Will be array later
        @data const CYCLE_LENGTH: byte = 16;

        // VIC registers for effects
        @map vicEffect at $D000 layout
          rasterInterrupt: at $D012: byte,
          interruptEnable: at $D01A: byte,
          borderColor: at $D020: byte,
          backgroundColor: at $D021: byte
        end @map

        // Timing calculations
        let nextRaster: byte = rasterLine + 1;
        let colorOffset: byte = (colorIndex + 1) * 2;
        let isEvenFrame: boolean = (colorIndex + 1) == 0;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getModule().getFullName()).toBe('Demo.Effects');
      expect(result.program.getDeclarations()).toHaveLength(8);
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

    it('handles program with maximum nesting', () => {
      const source = `
        module Very.Deeply.Nested.Module.Name

        @map deep at $1000 layout
          field1: at $1000: byte,
          field2: at $1001: byte,
          field3: at $1002: byte,
          field4: at $1003: byte,
          field5: at $1004: byte
        end @map

        let deepExpr: word = ((((1 + 2) * 3) - 4) + 5) * 6;
      `;

      const result = parseBlendProgram(source);

      expect(result.hasErrors).toBe(false);
      expect(result.program.getModule().getNamePath()).toHaveLength(5);
      expect(result.program.getDeclarations()).toHaveLength(2);
    });
  });

  describe('Lexer-Parser Integration', () => {
    it('handles all number formats correctly', () => {
      const source = `
        module Numbers

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
        module Literals

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

        @map broken at: byte;    // Invalid @map syntax

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
        module C64Game.Init

        // Memory layout
        @map vic at $D000 layout
          spriteEnable: at $D015: byte,
          spriteExpandX: at $D01D: byte,
          spriteExpandY: at $D017: byte,
          borderColor: at $D020: byte,
          backgroundColor: at $D021: byte
        end @map

        @map colorRam from $D800 to $DBE7: byte;
        @map screen from $0400 to $07E7: byte;

        // Game variables
        export @zp let gameState: byte = 0;
        export @zp let frameCounter: byte = 0;
        export @ram let score: word = 0;
        export @ram let hiScore: word = 5000;

        // Constants
        const SCREEN_WIDTH: byte = 40;
        const SCREEN_HEIGHT: byte = 25;
        const MAX_SCORE: word = 99999;

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
      let source = 'module LargeProgram\n';

      // Generate a large program with many declarations
      for (let i = 0; i < 200; i++) {
        source += `let var${i}: byte = ${i % 256};\n`;
        if (i % 10 === 0) {
          source += `@map mem${i} at $${(0x1000 + i).toString(16).toUpperCase()}: byte;\n`;
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

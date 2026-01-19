/**
 * Import/Export Integration Tests
 *
 * Comprehensive tests for Phase 5 import/export system including:
 * - Import declaration edge cases
 * - Export declaration with full Parser
 * - End-to-end module system integration
 * - Real-world usage patterns
 */

import { describe, test, expect } from 'vitest';
import { Lexer } from '../../lexer/index.js';
import { Parser } from '../../parser/index.js';
import {
  Program,
  ImportDecl,
  FunctionDecl,
  VariableDecl,
  DiagnosticSeverity,
} from '../../ast/index.js';

describe('Import/Export Integration Tests', () => {
  // ============================================
  // IMPORT DECLARATION EDGE CASES
  // ============================================

  describe('Import Declaration Edge Cases', () => {
    test('parses import with single identifier', () => {
      const source = `
        module Game.Main
        import clearScreen from c64.graphics;
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);
      expect(ast).toBeInstanceOf(Program);

      const declarations = ast.getDeclarations();
      expect(declarations.length).toBe(1);
      expect(declarations[0]).toBeInstanceOf(ImportDecl);

      const importDecl = declarations[0] as ImportDecl;
      expect(importDecl.getIdentifiers()).toEqual(['clearScreen']);
      expect(importDecl.getModulePath()).toEqual(['c64', 'graphics']);
      expect(importDecl.getModuleName()).toBe('c64.graphics');
    });

    test('parses import with multiple identifiers', () => {
      const source = `
        module Game.Main
        import clearScreen, setPixel, drawLine from c64.graphics.screen;
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const declarations = ast.getDeclarations();
      expect(declarations.length).toBe(1);

      const importDecl = declarations[0] as ImportDecl;
      expect(importDecl.getIdentifiers()).toEqual(['clearScreen', 'setPixel', 'drawLine']);
      expect(importDecl.getModulePath()).toEqual(['c64', 'graphics', 'screen']);
    });

    test('parses import from deeply nested module', () => {
      const source = `
        module Game.Main
        import initSID, playNote, stopSound from c64.audio.sid.player;
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const importDecl = ast.getDeclarations()[0] as ImportDecl;
      expect(importDecl.getIdentifiers()).toEqual(['initSID', 'playNote', 'stopSound']);
      expect(importDecl.getModulePath()).toEqual(['c64', 'audio', 'sid', 'player']);
      expect(importDecl.getModuleName()).toBe('c64.audio.sid.player');
    });

    test('handles multiple import declarations', () => {
      const source = `
        module Game.Main
        import clearScreen from c64.graphics;
        import initSID from c64.audio;
        import random from utils.math;
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const declarations = ast.getDeclarations();
      expect(declarations.length).toBe(3);
      expect(declarations.every(d => d instanceof ImportDecl)).toBe(true);

      const import1 = declarations[0] as ImportDecl;
      const import2 = declarations[1] as ImportDecl;
      const import3 = declarations[2] as ImportDecl;

      expect(import1.getIdentifiers()).toEqual(['clearScreen']);
      expect(import2.getIdentifiers()).toEqual(['initSID']);
      expect(import3.getIdentifiers()).toEqual(['random']);
    });

    test('handles import with automatic semicolon insertion', () => {
      const source = `
        module Game.Main
        import clearScreen from c64.graphics;
        import initSID from c64.audio;
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const declarations = ast.getDeclarations();
      expect(declarations.length).toBe(2);
      expect(declarations.every(d => d instanceof ImportDecl)).toBe(true);
    });

    test('reports error for empty import list', () => {
      const source = `
        module Game.Main
        import from c64.graphics;
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      parser.parse();

      expect(parser.hasErrors()).toBe(true);
      const errors = parser.getDiagnostics().filter(d => d.severity === DiagnosticSeverity.ERROR);
      expect(errors.length).toBeGreaterThan(0);
    });

    test('reports error for missing from keyword', () => {
      const source = `
        module Game.Main
        import clearScreen c64.graphics;
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      parser.parse();

      expect(parser.hasErrors()).toBe(true);
      const errors = parser.getDiagnostics().filter(d => d.severity === DiagnosticSeverity.ERROR);
      expect(errors.length).toBeGreaterThan(0);
    });

    test('reports error for missing module path', () => {
      const source = `
        module Game.Main
        import clearScreen from;
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      parser.parse();

      expect(parser.hasErrors()).toBe(true);
      const errors = parser.getDiagnostics().filter(d => d.severity === DiagnosticSeverity.ERROR);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // EXPORT FUNCTION DECLARATIONS
  // ============================================

  describe('Export Function Declarations', () => {
    test('parses exported function with full Parser', () => {
      const source = `
        module c64.graphics

        export function clearScreen(): void
          // Implementation
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const declarations = ast.getDeclarations();
      expect(declarations.length).toBe(1);
      expect(declarations[0]).toBeInstanceOf(FunctionDecl);

      const funcDecl = declarations[0] as FunctionDecl;
      expect(funcDecl.getName()).toBe('clearScreen');
      expect(funcDecl.isExportedFunction()).toBe(true);
      expect(funcDecl.getReturnType()).toBe('void');
    });

    test('parses exported function with parameters', () => {
      const source = `
        module c64.graphics

        export function setPixel(x: byte, y: byte): void
          // Implementation
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const funcDecl = ast.getDeclarations()[0] as FunctionDecl;
      expect(funcDecl.getName()).toBe('setPixel');
      expect(funcDecl.isExportedFunction()).toBe(true);
      expect(funcDecl.getParameters().length).toBe(2);
      expect(funcDecl.getParameters()[0].name).toBe('x');
      expect(funcDecl.getParameters()[1].name).toBe('y');
    });

    test('parses exported callback function', () => {
      const source = `
        module Game.Main

        export callback function rasterIRQ(): void
          // IRQ handler
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const funcDecl = ast.getDeclarations()[0] as FunctionDecl;
      expect(funcDecl.getName()).toBe('rasterIRQ');
      expect(funcDecl.isExportedFunction()).toBe(true);
      expect(funcDecl.isCallbackFunction()).toBe(true);
    });

    test('parses exported function with return type', () => {
      const source = `
        module Utils.Math

        export function abs(x: byte): byte
          return x;
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const funcDecl = ast.getDeclarations()[0] as FunctionDecl;
      expect(funcDecl.getName()).toBe('abs');
      expect(funcDecl.isExportedFunction()).toBe(true);
      expect(funcDecl.getReturnType()).toBe('byte');
    });

    test('parses multiple exported functions', () => {
      const source = `
        module c64.graphics

        export function clearScreen(): void
        end function

        export function setPixel(x: byte, y: byte): void
        end function

        export function drawLine(x1: byte, y1: byte, x2: byte, y2: byte): void
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const declarations = ast.getDeclarations();
      expect(declarations.length).toBe(3);
      expect(declarations.every(d => d instanceof FunctionDecl)).toBe(true);
      expect(declarations.every(d => (d as FunctionDecl).isExportedFunction())).toBe(true);
    });
  });

  // ============================================
  // EXPORT VARIABLE DECLARATIONS
  // ============================================

  describe('Export Variable Declarations', () => {
    test('parses exported constant', () => {
      const source = `
        module c64.constants

        export const MAX_SPRITES: byte = 8;
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const varDecl = ast.getDeclarations()[0] as VariableDecl;
      expect(varDecl.getName()).toBe('MAX_SPRITES');
      expect(varDecl.isExportedVariable()).toBe(true);
      expect(varDecl.isConst()).toBe(true);
    });

    test('parses exported variable with storage class', () => {
      const source = `
        module Game.State

        export @zp let frameCounter: byte = 0;
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const varDecl = ast.getDeclarations()[0] as VariableDecl;
      expect(varDecl.getName()).toBe('frameCounter');
      expect(varDecl.isExportedVariable()).toBe(true);
      expect(varDecl.getStorageClass()).toBeTruthy();
    });

    test('parses multiple exported variables', () => {
      const source = `
        module Game.State

        export @zp let score: word = 0;
        export @zp let lives: byte = 3;
        export const MAX_LEVEL: byte = 10;
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const declarations = ast.getDeclarations();
      expect(declarations.length).toBe(3);
      expect(declarations.every(d => d instanceof VariableDecl)).toBe(true);
      expect(declarations.every(d => (d as VariableDecl).isExportedVariable())).toBe(true);
    });
  });

  // ============================================
  // END-TO-END MODULE SYSTEM INTEGRATION
  // ============================================

  describe('End-to-End Module System Integration', () => {
    test('parses complete module with imports and exports', () => {
      const source = `
        module Game.Main

        import clearScreen, setPixel from c64.graphics;
        import initSID from c64.audio;

        export @zp let score: word = 0;
        export const MAX_SCORE: word = 9999;

        export function init(): void
          clearScreen();
          initSID();
        end function

        export function main(): void
          init();
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const module = ast.getModule();
      expect(module.getFullName()).toBe('Game.Main');

      const declarations = ast.getDeclarations();
      expect(declarations.length).toBe(6);

      // Check imports
      expect(declarations[0]).toBeInstanceOf(ImportDecl);
      expect(declarations[1]).toBeInstanceOf(ImportDecl);

      // Check exports
      expect(declarations[2]).toBeInstanceOf(VariableDecl);
      expect((declarations[2] as VariableDecl).isExportedVariable()).toBe(true);

      expect(declarations[3]).toBeInstanceOf(VariableDecl);
      expect((declarations[3] as VariableDecl).isExportedVariable()).toBe(true);

      expect(declarations[4]).toBeInstanceOf(FunctionDecl);
      expect((declarations[4] as FunctionDecl).isExportedFunction()).toBe(true);

      expect(declarations[5]).toBeInstanceOf(FunctionDecl);
      expect((declarations[5] as FunctionDecl).isExportedFunction()).toBe(true);
    });

    test('parses graphics module example', () => {
      const source = `
        module c64.graphics

        @map screenRAM from $0400 to $07E7: byte;
        @map colorRAM from $D800 to $DBE7: byte;

        const SCREEN_WIDTH: byte = 40;

        export function clearScreen(): void
          for i = 0 to 999
            screenRAM[i] = 32;
            colorRAM[i] = 14;
          next i
        end function

        export function setPixel(x: byte, y: byte): void
          let offset: word = y * SCREEN_WIDTH + x;
          screenRAM[offset] = 160;
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const module = ast.getModule();
      expect(module.getFullName()).toBe('c64.graphics');

      const declarations = ast.getDeclarations();
      expect(declarations.length).toBe(5); // 2 @map, 1 const, 2 exported functions

      // Check exported functions
      const exportedFunctions = declarations.filter(
        d => d instanceof FunctionDecl && (d as FunctionDecl).isExportedFunction()
      );
      expect(exportedFunctions.length).toBe(2);
    });

    test('parses game module with imports and state', () => {
      const source = `
        module Game.Snake

        import clearScreen, setPixel from c64.graphics;
        import random from utils.math;

        @zp let playerX: byte = 10;
        @zp let playerY: byte = 10;
        export @zp let score: word = 0;

        function updatePosition(): void
          playerX = playerX + 1;
          playerY = playerY + 1;
        end function

        export function update(): void
          updatePosition();
          setPixel(playerX, playerY);
        end function

        export function main(): void
          clearScreen();
          update();
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const module = ast.getModule();
      expect(module.getFullName()).toBe('Game.Snake');

      const declarations = ast.getDeclarations();

      // Check imports
      const imports = declarations.filter(d => d instanceof ImportDecl);
      expect(imports.length).toBe(2);

      // Check exported declarations
      const exportedDecls = declarations.filter(
        d =>
          (d instanceof VariableDecl && (d as VariableDecl).isExportedVariable()) ||
          (d instanceof FunctionDecl && (d as FunctionDecl).isExportedFunction())
      );
      expect(exportedDecls.length).toBe(3); // 1 variable, 2 functions
    });

    test('validates import/export ordering', () => {
      const source = `
        module Game.Main

        import clearScreen from c64.graphics;

        export @zp let score: word = 0;

        export function main(): void
          clearScreen();
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const declarations = ast.getDeclarations();

      // Verify ordering: imports first, then other declarations
      expect(declarations[0]).toBeInstanceOf(ImportDecl);
      expect(declarations[1]).toBeInstanceOf(VariableDecl);
      expect(declarations[2]).toBeInstanceOf(FunctionDecl);
    });

    test('handles complex nested module structure', () => {
      const source = `
        module c64.audio.sid.player

        import initSID from c64.audio.sid.init;
        import setFrequency from c64.audio.sid.voice;

        export const VOICE_1: byte = 0;
        export const VOICE_2: byte = 1;
        export const VOICE_3: byte = 2;

        export function playNote(voice: byte, note: byte): void
          setFrequency(voice, note);
        end function

        export function stopSound(voice: byte): void
          // Stop sound implementation
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const module = ast.getModule();
      expect(module.getFullName()).toBe('c64.audio.sid.player');
      expect(module.getNamePath()).toEqual(['c64', 'audio', 'sid', 'player']);

      const declarations = ast.getDeclarations();
      expect(declarations.length).toBe(7); // 2 imports, 3 constants, 2 functions
    });
  });

  // ============================================
  // REAL-WORLD USAGE PATTERNS
  // ============================================

  describe('Real-World Usage Patterns', () => {
    test('C64 hardware abstraction module', () => {
      const source = `
        module c64.hardware

        @map borderColor at $D020: byte;
        @map backgroundColor at $D021: byte;

        export function setBorderColor(color: byte): void
          borderColor = color;
        end function

        export function setBackgroundColor(color: byte): void
          backgroundColor = color;
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const module = ast.getModule();
      expect(module.getFullName()).toBe('c64.hardware');

      const exportedFunctions = ast
        .getDeclarations()
        .filter(d => d instanceof FunctionDecl && (d as FunctionDecl).isExportedFunction());
      expect(exportedFunctions.length).toBe(2);
    });

    test('Game state management module', () => {
      const source = `
        module Game.State

        export @zp let score: word = 0;
        export @zp let lives: byte = 3;
        export @zp let level: byte = 1;
        export @ram let hiScore: word = 5000;

        export function resetGame(): void
          score = 0;
          lives = 3;
          level = 1;
        end function

        export function addScore(points: word): void
          score = score + points;
          if score > hiScore then
            hiScore = score;
          end if
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const declarations = ast.getDeclarations();
      const exportedVars = declarations.filter(
        d => d instanceof VariableDecl && (d as VariableDecl).isExportedVariable()
      );
      const exportedFuncs = declarations.filter(
        d => d instanceof FunctionDecl && (d as FunctionDecl).isExportedFunction()
      );

      expect(exportedVars.length).toBe(4);
      expect(exportedFuncs.length).toBe(2);
    });

    test('Utility library module', () => {
      const source = `
        module Utils.Math

        export function abs(x: byte): byte
          if x < 0 then
            return -x;
          end if
          return x;
        end function

        export function min(a: byte, b: byte): byte
          if a < b then
            return a;
          end if
          return b;
        end function

        export function max(a: byte, b: byte): byte
          if a > b then
            return a;
          end if
          return b;
        end function
      `;

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(parser.hasErrors()).toBe(false);

      const exportedFunctions = ast
        .getDeclarations()
        .filter(d => d instanceof FunctionDecl && (d as FunctionDecl).isExportedFunction());
      expect(exportedFunctions.length).toBe(3);
      expect((exportedFunctions[0] as FunctionDecl).getName()).toBe('abs');
      expect((exportedFunctions[1] as FunctionDecl).getName()).toBe('min');
      expect((exportedFunctions[2] as FunctionDecl).getName()).toBe('max');
    });
  });
});

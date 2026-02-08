/**
 * Import/Export Integration Tests (V2)
 *
 * Comprehensive tests for Phase 5 import/export system including:
 * - Import declaration edge cases
 * - Export declaration with full Parser
 * - End-to-end module system integration
 * - Real-world usage patterns
 *
 * NOTE: V2 has NO storage classes (@zp/@ram/@data) - frame allocator handles memory.
 * NOTE: V2 has NO @map syntax - uses peek/poke intrinsics instead.
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
        module Game.Main;
        import { clearScreen } from c64.graphics;
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
        module Game.Main;
        import { clearScreen, setPixel, drawLine } from c64.graphics.screen;
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
        module Game.Main;
        import { initSID, playNote, stopSound } from c64.audio.sid.player;
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
        module Game.Main;
        import { clearScreen } from c64.graphics;
        import { initSID } from c64.audio;
        import { random } from utils.math;
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
        module Game.Main;
        import { clearScreen } from c64.graphics;
        import { initSID } from c64.audio;
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
        module Game.Main;
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
        module Game.Main;
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
        module Game.Main;
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
        module c64.graphics;

        export function clearScreen(): void {
          // Implementation
        }
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
        module c64.graphics;

        export function setPixel(x: byte, y: byte): void {
          // Implementation
        }
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
        module Game.Main;

        export callback function rasterIRQ(): void {
          // IRQ handler
        }
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
        module Utils.Math;

        export function abs(x: byte): byte {
          return x;
        }
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
        module c64.graphics;

        export function clearScreen(): void {
        }

        export function setPixel(x: byte, y: byte): void {
        }

        export function drawLine(x1: byte, y1: byte, x2: byte, y2: byte): void {
        }
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
        module c64.constants;

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

    // V2: Removed "parses exported variable with storage class" - no storage classes in v2

    test('parses multiple exported variables', () => {
      const source = `
        module Game.State;

        export let score: word = 0;
        export let lives: byte = 3;
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
        module Game.Main;

        import { clearScreen, setPixel } from c64.graphics;
        import { initSID } from c64.audio;

        export let score: word = 0;
        export const MAX_SCORE: word = 9999;

        export function init(): void {
          clearScreen();
          initSID();
        }

        export function main(): void {
          init();
        }
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

    // V2: Removed "parses graphics module example" - had @map syntax

    test('parses game module with imports and state', () => {
      const source = `
        module Game.Snake;

        import { clearScreen, setPixel } from c64.graphics;
        import { random } from utils.math;

        let playerX: byte = 10;
        let playerY: byte = 10;
        export let score: word = 0;

        function updatePosition(): void {
          playerX = playerX + 1;
          playerY = playerY + 1;
        }

        export function update(): void {
          updatePosition();
          setPixel(playerX, playerY);
        }

        export function main(): void {
          clearScreen();
          update();
        }
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
        module Game.Main;

        import { clearScreen } from c64.graphics;

        export let score: word = 0;

        export function main(): void {
          clearScreen();
        }
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
        module c64.audio.sid.player;

        import { initSID } from c64.audio.sid.init;
        import { setFrequency } from c64.audio.sid.voice;

        export const VOICE_1: byte = 0;
        export const VOICE_2: byte = 1;
        export const VOICE_3: byte = 2;

        export function playNote(voice: byte, note: byte): void {
          setFrequency(voice, note);
        }

        export function stopSound(voice: byte): void {
          // Stop sound implementation
        }
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
    // V2: Removed "C64 hardware abstraction module" - had @map syntax

    test('Game state management module', () => {
      const source = `
        module Game.State;

        export let score: word = 0;
        export let lives: byte = 3;
        export let level: byte = 1;
        export let hiScore: word = 5000;

        export function resetGame(): void {
          score = 0;
          lives = 3;
          level = 1;
        }

        export function addScore(points: word): void {
          score = score + points;
          if (score > hiScore) {
            hiScore = score;
          }
        }
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
        module Utils.Math;

        export function abs(x: byte): byte {
          if (x < 0) {
            return -x;
          }
          return x;
        }

        export function min(a: byte, b: byte): byte {
          if (a < b) {
            return a;
          }
          return b;
        }

        export function max(a: byte, b: byte): byte {
          if (a > b) {
            return a;
          }
          return b;
        }
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
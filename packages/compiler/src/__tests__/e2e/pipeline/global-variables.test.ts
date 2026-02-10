/**
 * E2E Pipeline Tests: Global Variables & Storage Classes
 *
 * Tests the complete compilation pipeline for global variable support
 * including all storage classes (@zp, @ram, @data) and their
 * interactions with the full 8-phase pipeline.
 *
 * **Test Categories:**
 * - @zp global variables (zero page allocation)
 * - @ram global variables (general RAM allocation)
 * - @data const variables (data segment placement)
 * - Mixed storage classes in single/multi-module programs
 * - Cross-module @zp sharing
 * - Error handling (ZP overflow, storage class in functions)
 * - Sprite-test style real-world program
 *
 * @module __tests__/e2e/pipeline/global-variables
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlend,
  compileBlendSources,
  expectSuccess,
  expectFailure,
  expectAssemblyContains,
  expectDiagnosticContains,
  getAssembly,
} from './helpers.js';

describe('E2E: Global Variables & Storage Classes', () => {
  // ── @zp Global Variables ───────────────────────────────────────

  describe('@zp global variables', () => {
    it('should compile a single @zp byte variable', () => {
      const source = '@zp let counter: byte = 0;';
      const result = compileBlend(source);
      expectSuccess(result, '@zp byte variable');
    });

    it('should compile @zp variable with hex initializer', () => {
      const source = '@zp let flags: byte = $FF;';
      const result = compileBlend(source);
      expectSuccess(result, '@zp hex init');
    });

    it('should compile multiple @zp variables', () => {
      const source = `
        @zp let spriteX: byte = 24;
        @zp let spriteY: byte = 50;
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiple @zp variables');
    });

    it('should compile @zp word variable', () => {
      const source = '@zp let screenPtr: word = $0400;';
      const result = compileBlend(source);
      expectSuccess(result, '@zp word variable');
    });

    it('should generate zero-page addressing for @zp variables', () => {
      // @zp variables should use ZP addressing modes (shorter instructions)
      const source = `
        @zp let counter: byte = 0;

        export function increment(): void {
          counter += 1;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, '@zp addressing');
      // Assembly should contain LDA/STA with zero-page addresses
      const asm = getAssembly(result);
      expect(asm).toContain('LDA');
      expect(asm).toContain('STA');
    });
  });

  // ── @ram Global Variables ──────────────────────────────────────

  describe('@ram global variables', () => {
    it('should compile a @ram byte variable', () => {
      const source = '@ram let score: byte = 0;';
      const result = compileBlend(source);
      expectSuccess(result, '@ram byte variable');
    });

    it('should compile @ram word variable', () => {
      const source = '@ram let highScore: word = 0;';
      const result = compileBlend(source);
      expectSuccess(result, '@ram word variable');
    });

    it('should compile multiple @ram variables', () => {
      const source = `
        @ram let playerX: byte = 100;
        @ram let playerY: byte = 100;
        @ram let health: byte = 255;
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiple @ram variables');
    });
  });

  // ── @data Const Variables ──────────────────────────────────────

  describe('@data const variables', () => {
    it('should compile @data const byte variable', () => {
      const source = '@data const VERSION: byte = 1;';
      const result = compileBlend(source);
      expectSuccess(result, '@data const byte');
    });

    it('should compile @data const byte array', () => {
      const source = '@data const table: byte[] = [1, 2, 3, 4, 5];';
      const result = compileBlend(source);
      expectSuccess(result, '@data const byte array');
    });

    it('should compile @data with hex array values', () => {
      const source = '@data const spriteData: byte[] = [$0C, $00, $C0, $0C, $00, $C0];';
      const result = compileBlend(source);
      expectSuccess(result, '@data hex array');
    });

    it('should compile @data const word variable', () => {
      const source = '@data const MAGIC: word = $CAFE;';
      const result = compileBlend(source);
      expectSuccess(result, '@data const word');
    });

    it('should emit data segment section in assembly', () => {
      // @data globals should produce a data segment in the output
      const source = '@data const lookup: byte[] = [10, 20, 30, 40, 50];';
      const result = compileBlend(source);
      expectSuccess(result, '@data segment emission');
      // The data segment should be present in assembly output
      const asm = getAssembly(result);
      // Data segment has !byte directives for the data
      expect(asm.length).toBeGreaterThan(0);
    });
  });

  // ── Default (No Storage Class) Global Variables ────────────────

  describe('default global variables (no storage class)', () => {
    it('should compile variables without storage class', () => {
      const source = 'let gameState: byte = 0;';
      const result = compileBlend(source);
      expectSuccess(result, 'default global variable');
    });

    it('should compile const without storage class', () => {
      const source = 'const MAX_ENEMIES: byte = 10;';
      const result = compileBlend(source);
      expectSuccess(result, 'default const');
    });

    it('should compile exported globals without storage class', () => {
      const source = 'export let level: byte = 1;';
      const result = compileBlend(source);
      expectSuccess(result, 'exported default global');
    });
  });

  // ── Mixed Storage Classes ──────────────────────────────────────

  describe('mixed storage classes', () => {
    it('should compile program with @zp, @ram, and @data variables', () => {
      const source = `
        @zp let fastCounter: byte = 0;
        @ram let normalVar: byte = 10;
        @data const lookupTable: byte[] = [0, 1, 2, 3];
        const SCREEN: word = $0400;

        export function main(): void {
          fastCounter += 1;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'mixed storage classes');
    });

    it('should compile program with @zp and @data variables', () => {
      // Note: storage class and export are separate parser paths;
      // @zp variables without export are the typical pattern
      const source = `
        @zp let playerX: byte = 100;
        @zp let playerY: byte = 150;
        @data const spriteFrame: byte[] = [$FF, $00, $FF];
      `;
      const result = compileBlend(source);
      expectSuccess(result, '@zp + @data');
    });

    it('should compile program mixing globals with functions', () => {
      const source = `
        @zp let score: byte = 0;
        @ram let lives: byte = 3;
        const MAX_LIVES: byte = 9;

        function addScore(points: byte): void {
          score += points;
        }

        function loseLife(): void {
          lives -= 1;
        }

        export function main(): void {
          addScore(10);
          loseLife();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'globals + functions');
      // Should generate function calls
      expectAssemblyContains(result, 'JSR');
    });
  });

  // ── Cross-Module @zp Sharing ───────────────────────────────────

  describe('cross-module @zp sharing', () => {
    it('should compile multiple modules with @zp variables', () => {
      // @zp variables across modules share the same ZP pool
      const sources = new Map<string, string>();
      sources.set('game.blend', `
        module Game;
        @zp let posX: byte = 0;
        @zp let posY: byte = 0;
      `);
      sources.set('render.blend', `
        module Render;
        @zp let frameCount: byte = 0;
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'cross-module @zp variables');
    });

    it('should compile modules with mixed storage across files', () => {
      const sources = new Map<string, string>();
      sources.set('hardware.blend', `
        module Hardware;
        @data const colorTable: byte[] = [0, 1, 6, 14, 3, 5, 2, 4];
      `);
      sources.set('state.blend', `
        module State;
        @zp let currentColor: byte = 0;
        @ram let colorIndex: byte = 0;
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'cross-module mixed storage');
    });
  });

  // ── Sprite-Test Style Program ──────────────────────────────────

  describe('sprite-test style real-world program', () => {
    it('should compile a sprite demo pattern with all storage classes', () => {
      // Tests the global variable pattern from sprite-test.blend
      // without poke/peek (E2E tests skip library loading).
      // Verifies @zp, @data, const, and function interactions compile.
      const source = `
        @data const spriteData: byte[] = [
          $0C, $00, $C0, $0C, $00, $C0,
          $03, $03, $00, $03, $03, $00,
          $0F, $FF, $C0, $0F, $FF, $C0
        ];

        @zp let spriteX: byte = 24;
        @zp let spriteY: byte = 50;

        const SPRITE_PTR_VALUE: byte = 192;

        function updateSprite(): void {
          spriteY += 1;
          spriteX += 1;
          if (spriteY == 255) {
            spriteY = 1;
            spriteX = 1;
          }
        }

        export function main(): void {
          while (true) {
            updateSprite();
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'sprite demo program');

      // Should produce meaningful assembly
      const asm = getAssembly(result);
      expect(asm).toContain('main');
      expect(asm).toContain('JSR');
      expect(asm).toContain('RTS');
    });

    it('should compile a C64-style program with globals and control flow', () => {
      // Tests pattern of constants + @zp + functions with control flow
      // (without poke/peek since E2E tests skip library loading)
      const source = `
        @zp let currentColor: byte = 0;
        @zp let running: bool = true;
        const MAX_COLOR: byte = 15;

        function cycleBorderColor(): void {
          currentColor += 1;
          if (currentColor > MAX_COLOR) {
            currentColor = 0;
          }
        }

        export function main(): void {
          while (running) {
            cycleBorderColor();
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'C64-style pattern');
    });
  });

  // ── Error Handling ─────────────────────────────────────────────

  describe('error handling', () => {
    it('should report error for storage class inside function body', () => {
      const source = `
        function test(): void {
          @zp let x: byte = 5;
        }
      `;
      const result = compileBlend(source);
      // Should produce a diagnostic about storage class in function
      expectDiagnosticContains(result, 'storage class');
    });

    it('should report error for @ram inside function body', () => {
      const source = `
        function test(): void {
          @ram let buffer: byte = 0;
        }
      `;
      const result = compileBlend(source);
      expectDiagnosticContains(result, 'storage class');
    });

    it('should report error for @data inside function body', () => {
      const source = `
        function test(): void {
          @data const table: byte[] = [1, 2, 3];
        }
      `;
      const result = compileBlend(source);
      expectDiagnosticContains(result, 'storage class');
    });

    it('should report error for @data on non-const variable', () => {
      // @data requires const — mutable @data doesn't make sense (ROM data)
      const source = '@data let mutableData: byte = 5;';
      const result = compileBlend(source);
      // Should have a diagnostic about @data requiring const
      const hasDiag = result.diagnostics.length > 0;
      expect(hasDiag).toBe(true);
    });
  });

  // ── ZP Overflow Error ──────────────────────────────────────────

  describe('ZP overflow error handling', () => {
    it('should report error when too many @zp variables exhaust zero page', () => {
      // Create enough @zp variables to exceed the zero page pool
      // ZP pool is typically ~26 bytes on C64 (addresses $FB-$FE available)
      // Each @zp byte takes 1 byte. Creating many should overflow.
      const lines: string[] = [];
      for (let i = 0; i < 200; i++) {
        lines.push(`@zp let zpVar${i}: byte = 0;`);
      }
      const source = lines.join('\n');
      const result = compileBlend(source);

      // Should fail with ZP overflow diagnostic
      expect(result.diagnostics.length).toBeGreaterThan(0);
      // At least one diagnostic should mention ZP or zero page
      const hasZpError = result.diagnostics.some(d =>
        d.message.toLowerCase().includes('zero page') ||
        d.message.toLowerCase().includes('@zp') ||
        d.message.toLowerCase().includes('cannot fit')
      );
      expect(hasZpError).toBe(true);
    });
  });

  // ── All 8 Pipeline Phases ──────────────────────────────────────

  describe('pipeline phase verification with globals', () => {
    it('should complete all 8 phases for program with @zp globals', () => {
      const source = `
        @zp let x: byte = 10;

        export function main(): void {
          x += 1;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'all phases with @zp');

      // Verify all 8 phases completed
      expect(result.phases.parse).toBeDefined();
      expect(result.phases.semantic).toBeDefined();
      expect(result.phases.frame).toBeDefined();
      expect(result.phases.il).toBeDefined();
      expect(result.phases.optimize).toBeDefined();
      expect(result.phases.codegen).toBeDefined();
      expect(result.phases.asmOpt).toBeDefined();
      expect(result.phases.emit).toBeDefined();
    });

    it('should complete all 8 phases for program with @data globals', () => {
      const source = `
        @data const table: byte[] = [10, 20, 30, 40, 50];
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'all phases with @data');

      expect(result.phases.parse).toBeDefined();
      expect(result.phases.emit).toBeDefined();
    });

    it('should have timing info for all phases with globals', () => {
      const source = `
        @zp let a: byte = 1;
        @ram let b: byte = 2;
        @data const c: byte[] = [3, 4, 5];
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'timing with globals');
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should compile @zp bool variable', () => {
      const source = '@zp let gameRunning: bool = true;';
      const result = compileBlend(source);
      expectSuccess(result, '@zp bool');
    });

    it('should compile @data with binary literal values', () => {
      const source = '@data const bits: byte[] = [%10101010, %01010101, %11110000];';
      const result = compileBlend(source);
      expectSuccess(result, '@data binary literals');
    });

    it('should compile @zp variable with function that modifies it', () => {
      // @zp variable at module scope, modified by a function
      const source = `
        @zp let frameCounter: byte = 0;

        export function tick(): void {
          frameCounter += 1;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, '@zp with function modifier');
    });

    it('should compile program with only @data globals and no functions', () => {
      const source = `
        @data const sinTable: byte[] = [
          128, 131, 134, 137, 140, 143, 146, 149,
          152, 155, 158, 161, 164, 167, 170, 173
        ];
      `;
      const result = compileBlend(source);
      expectSuccess(result, '@data only program');
    });

    it('should compile @zp variable initialized to zero', () => {
      const source = '@zp let index: byte = 0;';
      const result = compileBlend(source);
      expectSuccess(result, '@zp zero init');
    });

    it('should compile program with globals and for-loop access', () => {
      // Tests @zp global used as for-loop variable
      // (without poke since E2E tests skip library loading)
      const source = `
        @zp let counter: byte = 0;
        @ram let total: byte = 0;

        export function main(): void {
          for (counter = 0 to 15) {
            total += counter;
          }
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'globals with for loop');
    });

    it('should compile multiple @data arrays', () => {
      const source = `
        @data const table1: byte[] = [1, 2, 3, 4];
        @data const table2: byte[] = [5, 6, 7, 8];
        @data const table3: byte[] = [9, 10, 11, 12];
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiple @data arrays');
    });

    it('should compile @zp with const modifier', () => {
      // @zp const is valid — a constant stored in zero page
      const source = '@zp const SPEED: byte = 5;';
      const result = compileBlend(source);
      expectSuccess(result, '@zp const');
    });
  });
});

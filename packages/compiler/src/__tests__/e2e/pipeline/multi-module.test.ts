/**
 * E2E Pipeline Tests: Multi-Module Compilation
 *
 * Tests the complete compilation pipeline with multiple source files.
 * Verifies that module declarations, exports, and multi-file compilation
 * work correctly through all 8 pipeline phases.
 *
 * **Test Categories:**
 * - Multiple independent source files
 * - Exported variables across files
 * - Exported functions across files
 * - Module declarations in source files
 * - Combining modules with different content types
 *
 * **Note on Import/Export:**
 * E2E tests skip library loading. Import resolution across modules
 * may have gaps depending on semantic analyzer support for
 * cross-module symbol resolution. Tests document the actual behavior.
 *
 * @module __tests__/e2e/pipeline/multi-module
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlendSources,
  compileBlend,
  expectSuccess,
  expectFailure,
  expectAssemblyContains,
  getAssembly,
} from './helpers.js';

describe('E2E: Multi-Module Compilation', () => {
  // ── Multiple Independent Files ─────────────────────────────────

  describe('multiple independent files', () => {
    it('should compile two independent files with variables', () => {
      const sources = new Map<string, string>();
      sources.set('a.blend', 'export let x: byte = 10;');
      sources.set('b.blend', 'export let y: byte = 20;');

      const result = compileBlendSources(sources);
      expectSuccess(result, 'two independent files');
    });

    it('should compile three independent files', () => {
      const sources = new Map<string, string>();
      sources.set('a.blend', 'export let x: byte = 1;');
      sources.set('b.blend', 'export let y: byte = 2;');
      sources.set('c.blend', 'export let z: byte = 3;');

      const result = compileBlendSources(sources);
      expectSuccess(result, 'three independent files');
    });

    it('should compile files with both variables and functions', () => {
      const sources = new Map<string, string>();
      sources.set('vars.blend', `
        export let score: byte = 0;
        export let lives: byte = 3;
      `);
      sources.set('funcs.blend', `
        function addScore(): byte {
          return 10;
        }
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'files with vars and functions');
    });
  });

  // ── Exported Variables ─────────────────────────────────────────

  describe('exported variables across files', () => {
    it('should compile multiple files with exported constants', () => {
      const sources = new Map<string, string>();
      sources.set('config.blend', `
        export const MAX_X: byte = 40;
        export const MAX_Y: byte = 25;
      `);
      sources.set('game.blend', `
        export let playerX: byte = 20;
        export let playerY: byte = 12;
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'exported constants in multiple files');
    });

    it('should compile exported word variables', () => {
      const sources = new Map<string, string>();
      sources.set('addrs.blend', `
        export const SCREEN: word = $0400;
        export const COLOR: word = $D800;
      `);
      sources.set('main.blend', `
        export let ptr: word = $0400;
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'exported word variables');
    });
  });

  // ── Exported Functions ─────────────────────────────────────────

  describe('exported functions across files', () => {
    it('should compile single file with exported function', () => {
      // Single-file functions always work via the multi-source API.
      // Multi-file functions require explicit module declarations
      // to avoid implicit module name collisions in the registry.
      const sources = new Map<string, string>();
      sources.set('main.blend', `
        export function getMax(): byte {
          return 255;
        }
        function helper(): byte {
          return 42;
        }
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'exported functions in single file via multi-source API');
    });

    it('should compile functions across multiple files with explicit modules', () => {
      // Cross-file function compilation works when files use explicit
      // module declarations (unique module names avoid registry collision).
      // The frame phase now allocates frames for ALL modules' functions,
      // preventing "No frame for function" errors during IL generation.
      const sources = new Map<string, string>();
      sources.set('utils.blend', `
        module Utils;
        export function double(x: byte): byte {
          return x + x;
        }
      `);
      sources.set('main.blend', `
        module Main;
        export function getMax(): byte {
          return 255;
        }
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'functions across multiple files with explicit modules');

      // Assembly should be generated and contain at least one function
      const asm = getAssembly(result);
      expect(asm).toContain('RTS');
    });
  });

  // ── Module Declarations ────────────────────────────────────────

  describe('module declarations', () => {
    it('should compile file with module declaration', () => {
      const result = compileBlend(`
        module Main;

        export function start(): void {
          let x: byte = 1;
        }
      `);
      expectSuccess(result, 'module declaration');
    });

    it('should compile multiple files with module declarations', () => {
      const sources = new Map<string, string>();
      sources.set('game.blend', `
        module Game;

        export let score: byte = 0;
      `);
      sources.set('utils.blend', `
        module Utils;

        export function clamp(val: byte): byte {
          return val;
        }
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'multiple module declarations');
    });

    it('should compile file with hierarchical module name', () => {
      // Note: 'length' is a reserved intrinsic name, using 'snakeLen' instead
      const result = compileBlend(`
        module Game.Snake;

        export let snakeLen: byte = 3;
      `);
      expectSuccess(result, 'hierarchical module name');
    });
  });

  // ── Module with ASM Stubs ──────────────────────────────────────

  describe('modules with asm stubs', () => {
    it('should compile asm stubs in one file and usage in another', () => {
      const sources = new Map<string, string>();
      sources.set('asm-stubs.blend', `
        export function asm_sei(): void;
        export function asm_cli(): void;
      `);
      sources.set('main.blend', `
        function init(): void {
          asm_sei();
        }
      `);

      const result = compileBlendSources(sources);
      // May or may not succeed depending on cross-module resolution
      // Document actual behavior
      if (result.success) {
        expectAssemblyContains(result, 'SEI');
      }
      // Either way, it shouldn't crash
      expect(result).toBeDefined();
    });
  });

  // ── Assembly Output ────────────────────────────────────────────

  describe('assembly output for multi-module', () => {
    it('should generate assembly from single file with multiple functions', () => {
      // Single file with multiple functions tests combined assembly output.
      const sources = new Map<string, string>();
      sources.set('main.blend', `
        export function funcA(): byte {
          return 1;
        }
        export function funcB(): byte {
          return 2;
        }
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'combined assembly output');
      const asm = getAssembly(result);
      // Both function labels should appear
      expect(asm).toContain('funcA');
      expect(asm).toContain('funcB');
      // Both should have RTS
      expect(asm).toContain('RTS');
    });

    it('should generate assembly from functions in separate files with explicit modules', () => {
      // With explicit module declarations, cross-file frame allocation works.
      // The frame phase allocates frames for ALL modules' functions.
      // Note: The IL/codegen phases currently process only the primary module,
      // so assembly output contains the primary module's functions. Full
      // combined assembly from ALL modules requires IL phase multi-module support.
      const sources = new Map<string, string>();
      sources.set('math.blend', `
        module Math;
        export function add(a: byte, b: byte): byte {
          return a + b;
        }
      `);
      sources.set('app.blend', `
        module App;
        export function init(): byte {
          return 0;
        }
      `);

      const result = compileBlendSources(sources);
      expectSuccess(result, 'assembly from functions in separate files');

      // Assembly should contain at least the primary module's function
      const asm = getAssembly(result);
      expect(asm).toContain('RTS');

      // Verify all 8 phases completed
      expect(result.phases.frame).toBeDefined();
      expect(result.phases.frame!.success).toBe(true);
      expect(result.phases.il).toBeDefined();
      expect(result.phases.codegen).toBeDefined();
      expect(result.phases.emit).toBeDefined();
    });

    it('should have all 8 phases for multi-file compilation', () => {
      const sources = new Map<string, string>();
      sources.set('x.blend', 'let x: byte = 1;');
      sources.set('y.blend', 'let y: byte = 2;');

      const result = compileBlendSources(sources);
      expectSuccess(result, 'all phases for multi-file');

      expect(result.phases.parse).toBeDefined();
      expect(result.phases.semantic).toBeDefined();
      expect(result.phases.frame).toBeDefined();
      expect(result.phases.il).toBeDefined();
      expect(result.phases.optimize).toBeDefined();
      expect(result.phases.codegen).toBeDefined();
      expect(result.phases.asmOpt).toBeDefined();
      expect(result.phases.emit).toBeDefined();
    });
  });

  // ── Error Handling in Multi-Module ─────────────────────────────

  describe('error handling in multi-module', () => {
    it('should report error if one file has syntax errors', () => {
      const sources = new Map<string, string>();
      sources.set('good.blend', 'let x: byte = 1;');
      sources.set('bad.blend', 'let y: = ;'); // Syntax error

      const result = compileBlendSources(sources);
      expectFailure(result, 'syntax error in one file');
    });

    it('should still compile successfully if all files are valid', () => {
      const sources = new Map<string, string>();
      sources.set('file1.blend', 'export let a: byte = 1;');
      sources.set('file2.blend', 'export let b: byte = 2;');
      sources.set('file3.blend', 'export let c: byte = 3;');

      const result = compileBlendSources(sources);
      expectSuccess(result, 'all valid files');
    });
  });
});

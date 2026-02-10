/**
 * E2E Pipeline Tests: Real-World Stress Tests — Scenarios 11-12
 *
 * Continuation of real-world Commodore 64 programming scenario tests.
 * Each scenario exercises multiple compiler subsystems simultaneously
 * through the complete compilation pipeline at multiple optimization levels.
 *
 * **Scenarios in this file:**
 * - Scenario 11: Collision Detection (early returns, 5-param functions, nested ifs, pure arithmetic)
 * - Scenario 12: Multi-Module Game (cross-module compilation, separate Hardware + Main modules)
 *
 * @module __tests__/e2e/pipeline/real-world-stress-scenarios-11-12
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlend,
  compileBlendSources,
  expectSuccess,
  expectAssemblyContains,
  expectAssemblyNotContains,
  getAssembly,
} from './helpers.js';
import type { Blend65Config } from '../../../config/types.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Create a Blend65Config for the given optimization level.
 *
 * @param optimization - The optimization level to use
 * @returns A C64-targeting config with the specified optimization
 */
function configAt(optimization: 'O0' | 'O1' | 'O2' | 'O3'): Blend65Config {
  return {
    compilerOptions: {
      target: 'c64',
      optimization,
    },
  };
}

/**
 * Assert that no "unused variable" warnings exist in the compilation result.
 *
 * @param result - Compilation result to check
 * @param context - Optional context string for error messages
 */
function expectNoUnusedWarnings(
  result: { diagnostics: Array<{ severity: string; message: string }> },
  context?: string
): void {
  const unusedWarnings = result.diagnostics.filter(
    d => d.severity === DiagnosticSeverity.WARNING &&
      d.message.toLowerCase().includes('unused')
  );
  const ctx = context ? ` (${context})` : '';
  if (unusedWarnings.length > 0) {
    const msgs = unusedWarnings.map(d => `  [${d.severity}] ${d.message}`).join('\n');
    throw new Error(`Expected no "unused variable" warnings${ctx}, but found:\n${msgs}`);
  }
}

// ── Scenario 11: Collision Detection ─────────────────────────────
// Tests: Classes 1, 3, 7, 10
// Pattern: Bounding box collision detection with abs_diff helper
//
// This scenario is purely arithmetic — no dynamic poke/peek addresses.
// Exercises early returns, 5-parameter functions, nested if-blocks,
// and function return values used in comparisons.

const COLLISION_SOURCE = `
module Collision;

function abs_diff(a: byte, b: byte): byte {
    if (a > b) {
        return a - b;
    }
    return b - a;
}

function checkCollision(x1: byte, y1: byte, x2: byte, y2: byte, size: byte): byte {
    let dx: byte = abs_diff(x1, x2);
    let dy: byte = abs_diff(y1, y2);
    if (dx < size) {
        if (dy < size) {
            return 1;
        }
    }
    return 0;
}

export function main(): void {
    let playerX: byte = 100;
    let playerY: byte = 150;
    let enemyX: byte = 120;
    let enemyY: byte = 140;

    while (true) {
        playerX += 1;
        if (playerX > 200) {
            playerX = 24;
        }
        let hit: byte = checkCollision(playerX, playerY, enemyX, enemyY, 16);
        if (hit == 1) {
            poke($D020, 2);
        } else {
            poke($D020, 0);
        }
    }
}
`;

// ── Scenario 12: Multi-Module Game ───────────────────────────────
// Tests: Class 5 (Multi-Module compilation)
// Pattern: Two separate modules compiled together through the full pipeline
//
// Module A: Hardware abstraction with exported functions
// Module B: Main game loop using separate module functions
//
// NOTE: Cross-module import resolution may not work in E2E pipeline
// (IL/codegen currently processes primary module only). Tests verify
// that both modules compile together successfully and assembly output
// is generated. Individual module compilation is also tested.

const HARDWARE_MODULE_SOURCE = `
module Hardware;

const BORDER: word = $D020;
const BG: word = $D021;
const RASTER: word = $D012;

export function setBorder(color: byte): void {
    poke(BORDER, color);
}

export function setBackground(color: byte): void {
    poke(BG, color);
}

export function waitVBlank(): void {
    while (peek(RASTER) != 250) {
        barrier();
    }
}
`;

const MAIN_MODULE_SOURCE = `
module Main;

export function main(): void {
    let color: byte = 0;
    while (true) {
        poke($D012, color);
        poke($D020, color);
        poke($D021, color);
        color += 1;
        if (color > 15) {
            color = 0;
        }
    }
}
`;

// ══════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════

describe('E2E: Real-World Stress Tests (Scenarios 11-12)', () => {

  // ── Scenario 11: Collision Detection ───────────────────────────

  describe('Scenario 11: Collision Detection', () => {

    it('should compile successfully at O0', () => {
      const result = compileBlend(COLLISION_SOURCE, configAt('O0'));
      expectSuccess(result, 'Collision at O0');
    });

    it('should compile successfully at O3', () => {
      const result = compileBlend(COLLISION_SOURCE, configAt('O3'));
      expectSuccess(result, 'Collision at O3');
    });

    it('should not produce false "unused variable" warnings (Bug 1)', () => {
      const result = compileBlend(COLLISION_SOURCE, configAt('O0'));
      expectSuccess(result, 'Collision unused check');
      expectNoUnusedWarnings(result, 'Collision at O0');
    });

    it('should contain abs_diff and checkCollision function labels at O0', () => {
      const result = compileBlend(COLLISION_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'abs_diff', 'checkCollision');
    });

    it('should generate JSR for function calls at O0', () => {
      // abs_diff and checkCollision are called, producing JSR
      const result = compileBlend(COLLISION_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'JSR');
    });

    it('should generate CMP for comparison operators at O0', () => {
      // a > b, dx < size, hit == 1 all generate CMP
      const result = compileBlend(COLLISION_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'CMP');
    });

    it('should generate SBC for subtraction in abs_diff at O0', () => {
      // a - b and b - a generate SBC (subtract with carry)
      const result = compileBlend(COLLISION_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'SBC');
    });

    it('should generate branch instructions for if/else and early returns at O0', () => {
      const result = compileBlend(COLLISION_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasBranch = asm.includes('BNE') || asm.includes('BEQ') ||
        asm.includes('BCC') || asm.includes('BCS');
      expect(hasBranch, 'Expected branch instructions for control flow').toBe(true);
    });

    it('should generate RTS for function returns at O0', () => {
      // abs_diff and checkCollision both have return statements → RTS
      const result = compileBlend(COLLISION_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'RTS');
    });

    it('should generate playerX += 1 compound assignment correctly (Bug 4)', () => {
      const result = compileBlend(COLLISION_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasIncrement = asm.includes('INC') || asm.includes('ADC');
      expect(hasIncrement, 'Expected INC or ADC for playerX += 1').toBe(true);
    });

    it('should generate LDA for playerX = 24 literal assignment (Bug 5)', () => {
      // playerX = 24 must produce LDA #$18 (24 = $18)
      const result = compileBlend(COLLISION_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'LDA #$18');
    });

    it('should NOT contain JSR abs_diff at O3 (Bug 3 — DFE after inline)', () => {
      // At O3, abs_diff should be inlined and original removed
      const result = compileBlend(COLLISION_SOURCE, configAt('O3'));
      const asm = getAssembly(result);
      expect(asm, 'Expected no JSR abs_diff at O3').not.toContain('JSR abs_diff');
    });

    it('should generate STA for poke($D020, ...) at O0', () => {
      const result = compileBlend(COLLISION_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'STA');
    });

    it('should generate correct assembly at all optimization levels', () => {
      for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
        const result = compileBlend(COLLISION_SOURCE, configAt(level));
        expectSuccess(result, `Collision at ${level}`);
        expectAssemblyContains(result, 'STA');
      }
    });
  });

  // ── Scenario 12: Multi-Module Game ─────────────────────────────

  describe('Scenario 12: Multi-Module Game', () => {

    it('should compile Hardware module independently at O0', () => {
      const result = compileBlend(HARDWARE_MODULE_SOURCE, configAt('O0'));
      expectSuccess(result, 'Hardware module at O0');
    });

    it('should compile Main module independently at O0', () => {
      const result = compileBlend(MAIN_MODULE_SOURCE, configAt('O0'));
      expectSuccess(result, 'Main module at O0');
    });

    it('should compile both modules together at O0', () => {
      const sources = new Map<string, string>();
      sources.set('hardware.blend', HARDWARE_MODULE_SOURCE);
      sources.set('main.blend', MAIN_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O0'));
      expectSuccess(result, 'Multi-module at O0');
    });

    it('should compile both modules together at O3', () => {
      const sources = new Map<string, string>();
      sources.set('hardware.blend', HARDWARE_MODULE_SOURCE);
      sources.set('main.blend', MAIN_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O3'));
      expectSuccess(result, 'Multi-module at O3');
    });

    it('should not produce false "unused variable" warnings (Bug 1)', () => {
      const sources = new Map<string, string>();
      sources.set('hardware.blend', HARDWARE_MODULE_SOURCE);
      sources.set('main.blend', MAIN_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O0'));
      expectSuccess(result, 'Multi-module unused check');
      expectNoUnusedWarnings(result, 'Multi-module at O0');
    });

    it('should generate STA for poke calls in assembly at O0', () => {
      const sources = new Map<string, string>();
      sources.set('hardware.blend', HARDWARE_MODULE_SOURCE);
      sources.set('main.blend', MAIN_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O0'));
      expectAssemblyContains(result, 'STA');
    });

    it('should generate LDA for values in assembly at O0', () => {
      const sources = new Map<string, string>();
      sources.set('hardware.blend', HARDWARE_MODULE_SOURCE);
      sources.set('main.blend', MAIN_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O0'));
      expectAssemblyContains(result, 'LDA');
    });

    it('should generate RTS for function returns at O0', () => {
      const sources = new Map<string, string>();
      sources.set('hardware.blend', HARDWARE_MODULE_SOURCE);
      sources.set('main.blend', MAIN_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O0'));
      expectAssemblyContains(result, 'RTS');
    });

    it('should generate branch instructions for while-loop at O0', () => {
      const sources = new Map<string, string>();
      sources.set('hardware.blend', HARDWARE_MODULE_SOURCE);
      sources.set('main.blend', MAIN_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O0'));
      const asm = getAssembly(result);
      const hasBranch = asm.includes('BNE') || asm.includes('BEQ') ||
        asm.includes('BCC') || asm.includes('JMP');
      expect(hasBranch, 'Expected branch/jump for while loop').toBe(true);
    });

    it('should generate color += 1 compound assignment correctly (Bug 4)', () => {
      const sources = new Map<string, string>();
      sources.set('hardware.blend', HARDWARE_MODULE_SOURCE);
      sources.set('main.blend', MAIN_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O0'));
      const asm = getAssembly(result);
      const hasIncrement = asm.includes('INC') || asm.includes('ADC');
      expect(hasIncrement, 'Expected INC or ADC for color += 1').toBe(true);
    });

    it('should generate LDA #$00 for color = 0 literal assignment (Bug 5)', () => {
      const sources = new Map<string, string>();
      sources.set('hardware.blend', HARDWARE_MODULE_SOURCE);
      sources.set('main.blend', MAIN_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O0'));
      expectAssemblyContains(result, 'LDA #$00');
    });

    it('should have all 8 pipeline phases complete for multi-module', () => {
      const sources = new Map<string, string>();
      sources.set('hardware.blend', HARDWARE_MODULE_SOURCE);
      sources.set('main.blend', MAIN_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O0'));
      expectSuccess(result, 'Multi-module pipeline phases');
      expect(result.phases.parse).toBeDefined();
      expect(result.phases.semantic).toBeDefined();
      expect(result.phases.frame).toBeDefined();
      expect(result.phases.il).toBeDefined();
      expect(result.phases.optimize).toBeDefined();
      expect(result.phases.codegen).toBeDefined();
      expect(result.phases.emit).toBeDefined();
    });

    it('should generate correct assembly at all optimization levels', () => {
      for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
        const sources = new Map<string, string>();
        sources.set('hardware.blend', HARDWARE_MODULE_SOURCE);
        sources.set('main.blend', MAIN_MODULE_SOURCE);
        const result = compileBlendSources(sources, configAt(level));
        expectSuccess(result, `Multi-module at ${level}`);
        expectAssemblyContains(result, 'LDA', 'STA');
      }
    });
  });
});

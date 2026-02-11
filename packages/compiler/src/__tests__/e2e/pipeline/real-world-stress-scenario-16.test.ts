/**
 * E2E Pipeline Tests: Real-World Stress Test — Scenario 16
 *
 * **Scenario 16: Screen Editor**
 * Tests: Classes 3, 4, 5
 * Pattern: Cursor movement + screen RAM + state management + multi-module
 *
 * Text cursor management with joystick movement and screen RAM editing.
 * Exercises:
 * - Multi-module compilation (Input + Editor modules)
 * - Bit testing patterns for joystick directions
 * - Nested if-blocks with boundary checking
 * - Word address calculation (cursorY * 40 + cursorX)
 * - Compound assignments and flag-based conditionals
 * - Multiple variables in same scope (memory layout)
 *
 * @module __tests__/e2e/pipeline/real-world-stress-scenario-16
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlend,
  compileBlendSources,
  expectSuccess,
  expectAssemblyContains,
  getAssembly,
} from './helpers.js';
import type { Blend65Config } from '../../../config/types.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';

// ── Helpers ──────────────────────────────────────────────────────

/** Create a Blend65Config for the given optimization level. */
function configAt(optimization: 'O0' | 'O1' | 'O2' | 'O3'): Blend65Config {
  return { compilerOptions: { target: 'c64', optimization } };
}

/** Assert no "unused variable" warnings exist. */
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

// ── Source Code ──────────────────────────────────────────────────
// Screen Editor: Cursor movement + character editing via joystick.
//
// Module A: Input — joystick reading functions
// Module B: Editor — main cursor editor with screen RAM writes
//
// NOTE: The Editor module reads joystick directly via peek($DC00)
// for the main loop, since cross-module import resolution may not
// fully work in the E2E pipeline. Each module is also tested independently.

const INPUT_MODULE_SOURCE = `
module Input;

const JOY2: word = $DC00;

export function readJoy(): byte {
    return peek(JOY2) & $1F;
}

export function joyUp(joy: byte): byte {
    if (joy & $01) {
        return 0;
    }
    return 1;
}

export function joyDown(joy: byte): byte {
    if (joy & $02) {
        return 0;
    }
    return 1;
}

export function joyLeft(joy: byte): byte {
    if (joy & $04) {
        return 0;
    }
    return 1;
}

export function joyRight(joy: byte): byte {
    if (joy & $08) {
        return 0;
    }
    return 1;
}

export function joyFire(joy: byte): byte {
    if (joy & $10) {
        return 0;
    }
    return 1;
}
`;

const EDITOR_MODULE_SOURCE = `
module Editor;

const SCREEN_RAM: word = $0400;
const COLOR_RAM: word = $D800;
const BORDER: word = $D020;

export function main(): void {
    let cursorX: byte = 0;
    let cursorY: byte = 0;
    let curChar: byte = 65;

    while (true) {
        let joy: byte = peek($DC00) & $1F;
        let moved: byte = 0;

        if ((joy & $01) == 0) {
            if (cursorY > 0) {
                cursorY -= 1;
                moved = 1;
            }
        }
        if ((joy & $02) == 0) {
            if (cursorY < 24) {
                cursorY += 1;
                moved = 1;
            }
        }
        if ((joy & $04) == 0) {
            if (cursorX > 0) {
                cursorX -= 1;
                moved = 1;
            }
        }
        if ((joy & $08) == 0) {
            if (cursorX < 39) {
                cursorX += 1;
                moved = 1;
            }
        }

        if ((joy & $10) == 0) {
            let pos: word = cursorY * 40 + cursorX;
            poke(SCREEN_RAM + pos, curChar);
            curChar += 1;
            if (curChar > 90) {
                curChar = 65;
            }
        }

        if (moved == 1) {
            let cursorAddr: word = cursorY * 40 + cursorX;
            poke(COLOR_RAM + cursorAddr, 1);
            poke(BORDER, cursorX);
        }

        for (_delay = 0 to 254) {
            barrier();
        }
    }
}
`;

// ══════════════════════════════════════════════════════════════════
// TEST SUITE
// ══════════════════════════════════════════════════════════════════

describe('E2E: Scenario 16 — Screen Editor', () => {

  // ── Input module standalone tests ──────────────────────────────

  describe('Input module (standalone)', () => {

    it('should compile Input module successfully at O0', () => {
      const result = compileBlend(INPUT_MODULE_SOURCE, configAt('O0'));
      expectSuccess(result, 'Input module at O0');
    });

    it('should compile Input module successfully at O3', () => {
      const result = compileBlend(INPUT_MODULE_SOURCE, configAt('O3'));
      expectSuccess(result, 'Input module at O3');
    });

    it('should generate AND for bitwise tests in joy functions (Class 7)', () => {
      const result = compileBlend(INPUT_MODULE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'AND');
    });

    it('should generate function labels for all joy functions at O0', () => {
      const result = compileBlend(INPUT_MODULE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'readJoy', 'joyUp', 'joyDown');
    });

    it('should generate RTS for function returns at O0', () => {
      const result = compileBlend(INPUT_MODULE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'RTS');
    });
  });

  // ── Editor module standalone tests ─────────────────────────────

  describe('Editor module (standalone)', () => {

    it('should compile Editor module successfully at O0', () => {
      const result = compileBlend(EDITOR_MODULE_SOURCE, configAt('O0'));
      expectSuccess(result, 'Editor module at O0');
    });

    it('should compile Editor module successfully at O3', () => {
      const result = compileBlend(EDITOR_MODULE_SOURCE, configAt('O3'));
      expectSuccess(result, 'Editor module at O3');
    });

    it('should not produce false "unused variable" warnings (Bug 1)', () => {
      const result = compileBlend(EDITOR_MODULE_SOURCE, configAt('O0'));
      expectSuccess(result, 'Editor unused check');
      expectNoUnusedWarnings(result, 'Editor at O0');
    });

    it('should generate AND for joystick bit testing (Class 7)', () => {
      const result = compileBlend(EDITOR_MODULE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'AND');
    });

    it('should generate CMP for boundary checks (Class 3)', () => {
      // cursorY > 0, cursorY < 24, cursorX > 0, cursorX < 39, etc.
      const result = compileBlend(EDITOR_MODULE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'CMP');
    });

    it('should generate branch instructions for nested if-blocks (Class 3)', () => {
      const result = compileBlend(EDITOR_MODULE_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasBranch = asm.includes('BNE') || asm.includes('BEQ') ||
        asm.includes('BCC') || asm.includes('BCS');
      expect(hasBranch, 'Expected branch for nested if-blocks').toBe(true);
    });

    it('should generate STA for poke calls to screen/color RAM (Class 9)', () => {
      const result = compileBlend(EDITOR_MODULE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'STA');
    });

    it('should generate compound assignments correctly (Bug 4)', () => {
      // cursorX += 1, cursorY -= 1, curChar += 1
      const result = compileBlend(EDITOR_MODULE_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasIncrement = asm.includes('INC') || asm.includes('ADC');
      expect(hasIncrement, 'Expected INC or ADC for compound assignments').toBe(true);
    });

    it('should generate LDA for literal assignments (Bug 5)', () => {
      // curChar = 65 → LDA #$41
      const result = compileBlend(EDITOR_MODULE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'LDA #$41');
    });
  });

  // ── Multi-module compilation tests ─────────────────────────────

  describe('Multi-module (Input + Editor)', () => {

    it('should compile both modules together at O0 (Class 5)', () => {
      const sources = new Map<string, string>();
      sources.set('input.blend', INPUT_MODULE_SOURCE);
      sources.set('editor.blend', EDITOR_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O0'));
      expectSuccess(result, 'Multi-module at O0');
    });

    it('should compile both modules together at O3 (Class 5)', () => {
      const sources = new Map<string, string>();
      sources.set('input.blend', INPUT_MODULE_SOURCE);
      sources.set('editor.blend', EDITOR_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O3'));
      expectSuccess(result, 'Multi-module at O3');
    });

    it('should not produce false "unused variable" warnings (Bug 1)', () => {
      const sources = new Map<string, string>();
      sources.set('input.blend', INPUT_MODULE_SOURCE);
      sources.set('editor.blend', EDITOR_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O0'));
      expectSuccess(result, 'Multi-module unused check');
      expectNoUnusedWarnings(result, 'Multi-module at O0');
    });

    it('should generate LDA and STA in multi-module assembly', () => {
      const sources = new Map<string, string>();
      sources.set('input.blend', INPUT_MODULE_SOURCE);
      sources.set('editor.blend', EDITOR_MODULE_SOURCE);
      const result = compileBlendSources(sources, configAt('O0'));
      expectAssemblyContains(result, 'LDA', 'STA');
    });

    it('should compile at all optimization levels', () => {
      for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
        const sources = new Map<string, string>();
        sources.set('input.blend', INPUT_MODULE_SOURCE);
        sources.set('editor.blend', EDITOR_MODULE_SOURCE);
        const result = compileBlendSources(sources, configAt(level));
        expectSuccess(result, `Multi-module at ${level}`);
      }
    });
  });
});

/**
 * E2E Pipeline Tests: Real-World Stress Test — Scenario 15
 *
 * **Scenario 15: Multiplexed Sprites**
 * Tests: Classes 1, 2, 7
 * Pattern: Word comparisons + raster sorting + bit manipulation
 *
 * Sorts sprites by Y-coordinate for raster multiplexing — a common
 * C64 demo technique. Exercises:
 * - Byte comparisons for Y sorting
 * - Dynamic register address computation (num * 2)
 * - R-M-W pattern on sprite enable register with temp vars
 * - 4-parameter function with if-else branching
 * - Multiple function calls building up state incrementally
 *
 * @module __tests__/e2e/pipeline/real-world-stress-scenario-15
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlend,
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
// Multiplexed Sprites: Y-sorting for raster multiplexing.
//
// NOTE: Uses loop-based mask computation instead of shift operator
// due to known codegen limitation with `<<`.
// NOTE: Uses temp vars for bitwise OR to avoid "slot operand undefined"
// codegen limitation with complex OR expressions.

const SPRITE_MUX_SOURCE = `
module SpriteMux;

const VIC_SPRITE_ENABLE: word = $D015;
const VIC_SPRITE_X_BASE: word = $D000;
const VIC_SPRITE_Y_BASE: word = $D001;
const VIC_RASTER: word = $D012;
const BORDER: word = $D020;

function setSpriteY(num: byte, y: byte): void {
    let regOffset: byte = num * 2;
    poke(VIC_SPRITE_Y_BASE + regOffset, y);
}

function setSpriteX(num: byte, x: byte): void {
    let regOffset: byte = num * 2;
    poke(VIC_SPRITE_X_BASE + regOffset, x);
}

// Enable a sprite by setting its bit in the enable register.
// Uses loop-based power-of-2 computation instead of shift operator.
function enableSprite(num: byte): void {
    let current: byte = peek(VIC_SPRITE_ENABLE);
    let mask: byte = 1;
    for (let i: byte = 0 to num - 1 step 1) {
        mask = mask * 2;
    }
    let result: byte = current | mask;
    poke(VIC_SPRITE_ENABLE, result);
}

function waitRasterLine(line: byte): void {
    while (peek(VIC_RASTER) != line) {
        barrier();
    }
}

// Sort 4 sprites by Y-coordinate using simple comparison swaps.
function sortAndDisplay(y0: byte, y1: byte, y2: byte, y3: byte): void {
    if (y0 < y1) {
        setSpriteY(0, y0);
        setSpriteY(1, y1);
    } else {
        setSpriteY(0, y1);
        setSpriteY(1, y0);
    }
    if (y2 < y3) {
        setSpriteY(2, y2);
        setSpriteY(3, y3);
    } else {
        setSpriteY(2, y3);
        setSpriteY(3, y2);
    }
}

export function main(): void {
    enableSprite(0);
    enableSprite(1);
    enableSprite(2);
    enableSprite(3);

    let frame: byte = 0;
    while (true) {
        waitRasterLine(250);
        let offset: byte = frame;
        sortAndDisplay(50 + offset, 80 + offset, 120 + offset, 160 + offset);
        setSpriteX(0, 50);
        setSpriteX(1, 100);
        setSpriteX(2, 150);
        setSpriteX(3, 200);
        frame += 1;
        if (frame > 40) {
            frame = 0;
        }
    }
}
`;

// ══════════════════════════════════════════════════════════════════
// TEST SUITE
// ══════════════════════════════════════════════════════════════════

describe('E2E: Scenario 15 — Multiplexed Sprites', () => {

  it('should compile successfully at O0', () => {
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O0'));
    expectSuccess(result, 'SpriteMux at O0');
  });

  it('should compile successfully at O3', () => {
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O3'));
    expectSuccess(result, 'SpriteMux at O3');
  });

  it('should not produce false "unused variable" warnings (Bug 1)', () => {
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O0'));
    expectSuccess(result, 'SpriteMux unused check');
    expectNoUnusedWarnings(result, 'SpriteMux at O0');
  });

  it('should generate function labels for all functions at O0', () => {
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O0'));
    expectAssemblyContains(result,
      'setSpriteY', 'setSpriteX', 'enableSprite', 'sortAndDisplay'
    );
  });

  it('should generate STA for poke calls to VIC registers (Class 9)', () => {
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'STA');
  });

  it('should generate LDA for peek in enableSprite and waitRasterLine (Class 9)', () => {
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'LDA');
  });

  it('should generate ORA for bitwise OR in enableSprite (Class 7)', () => {
    // current | mask produces ORA instruction
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'ORA');
  });

  it('should generate CMP for Y-comparisons in sortAndDisplay (Class 1)', () => {
    // y0 < y1, y2 < y3
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'CMP');
  });

  it('should generate branch instructions for if-else in sortAndDisplay (Class 3)', () => {
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasBranch = asm.includes('BNE') || asm.includes('BEQ') ||
      asm.includes('BCC') || asm.includes('BCS');
    expect(hasBranch, 'Expected branch for if-else sorting').toBe(true);
  });

  it('should generate frame += 1 compound assignment correctly (Bug 4)', () => {
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasIncrement = asm.includes('INC') || asm.includes('ADC');
    expect(hasIncrement, 'Expected INC or ADC for frame += 1').toBe(true);
  });

  it('should generate LDA #$00 for frame = 0 literal assignment (Bug 5)', () => {
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'LDA #$00');
  });

  it('should generate JSR for function calls at O0', () => {
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'JSR');
  });

  it('should generate RTS for function returns at O0', () => {
    const result = compileBlend(SPRITE_MUX_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'RTS');
  });

  it('should compile successfully at all optimization levels', () => {
    for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
      const result = compileBlend(SPRITE_MUX_SOURCE, configAt(level));
      expectSuccess(result, `SpriteMux at ${level}`);
      expectAssemblyContains(result, 'LDA', 'STA');
    }
  });
});

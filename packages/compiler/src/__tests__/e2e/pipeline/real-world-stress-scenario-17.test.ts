/**
 * E2E Pipeline Tests: Real-World Stress Test — Scenario 17
 *
 * **Scenario 17: High Score Table**
 * Tests: Classes 1, 4, 7
 * Pattern: Word comparisons + sorting logic + multiple variables
 *
 * Manages high scores with word comparisons, division-by-subtraction
 * digit extraction, and screen display. Exercises:
 * - Word variables with word comparisons (>= 1000, >= 100, etc.)
 * - Word compound assignments (remaining -= 1000)
 * - Multiple local variables in same function (memory layout)
 * - lo() byte extraction from word
 * - Word comparison in if-else for sorting
 *
 * @module __tests__/e2e/pipeline/real-world-stress-scenario-17
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
// High Score Table: Word comparisons, digit extraction, sorting.

const HIGH_SCORE_SOURCE = `
module HighScore;

const SCREEN_RAM: word = $0400;
const COLOR_RAM: word = $D800;
const BORDER: word = $D020;

function displayDigit(pos: word, value: byte): void {
    poke(SCREEN_RAM + pos, value + 48);
    poke(COLOR_RAM + pos, 1);
}

function displayScore(row: byte, score: word): void {
    let base: word = row * 40 + 10;
    let thousands: byte = 0;
    let hundreds: byte = 0;
    let tens: byte = 0;
    let remaining: word = score;

    while (remaining >= 1000) {
        thousands += 1;
        remaining -= 1000;
    }
    while (remaining >= 100) {
        hundreds += 1;
        remaining -= 100;
    }
    while (remaining >= 10) {
        tens += 1;
        remaining -= 10;
    }
    let ones: byte = lo(remaining);

    displayDigit(base, thousands);
    displayDigit(base + 1, hundreds);
    displayDigit(base + 2, tens);
    displayDigit(base + 3, ones);
}

function sortScores(s0: word, s1: word, s2: word): void {
    if (s0 < s1) {
        displayScore(2, s1);
        displayScore(4, s0);
    } else {
        displayScore(2, s0);
        displayScore(4, s1);
    }
    displayScore(6, s2);
}

export function main(): void {
    let score1: word = 1500;
    let score2: word = 2300;
    let score3: word = 800;
    sortScores(score1, score2, score3);
    poke(BORDER, 6);
}
`;

// ══════════════════════════════════════════════════════════════════
// TEST SUITE
// ══════════════════════════════════════════════════════════════════

describe('E2E: Scenario 17 — High Score Table', () => {

  it('should compile successfully at O0', () => {
    const result = compileBlend(HIGH_SCORE_SOURCE, configAt('O0'));
    expectSuccess(result, 'HighScore at O0');
  });

  it('should compile successfully at O3', () => {
    const result = compileBlend(HIGH_SCORE_SOURCE, configAt('O3'));
    expectSuccess(result, 'HighScore at O3');
  });

  it('should not produce false "unused variable" warnings (Bug 1)', () => {
    const result = compileBlend(HIGH_SCORE_SOURCE, configAt('O0'));
    expectSuccess(result, 'HighScore unused check');
    expectNoUnusedWarnings(result, 'HighScore at O0');
  });

  it('should generate function labels at O0', () => {
    const result = compileBlend(HIGH_SCORE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'displayDigit', 'displayScore', 'sortScores');
  });

  it('should generate STA for poke calls (Class 9)', () => {
    const result = compileBlend(HIGH_SCORE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'STA');
  });

  it('should generate CMP for word comparisons (Class 1)', () => {
    // remaining >= 1000, remaining >= 100, s0 < s1
    const result = compileBlend(HIGH_SCORE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'CMP');
  });

  it('should generate SBC for word subtraction remaining -= 1000 (Bug 4 + Class 1)', () => {
    const result = compileBlend(HIGH_SCORE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'SBC');
  });

  it('should generate branch instructions for while-loops and if-else (Class 3)', () => {
    const result = compileBlend(HIGH_SCORE_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasBranch = asm.includes('BNE') || asm.includes('BEQ') ||
      asm.includes('BCC') || asm.includes('BCS');
    expect(hasBranch, 'Expected branch for while/if-else').toBe(true);
  });

  it('should generate compound assignment thousands += 1 correctly (Bug 4)', () => {
    const result = compileBlend(HIGH_SCORE_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasIncrement = asm.includes('INC') || asm.includes('ADC');
    expect(hasIncrement, 'Expected INC or ADC for += 1').toBe(true);
  });

  it('should generate JSR for function calls at O0', () => {
    const result = compileBlend(HIGH_SCORE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'JSR');
  });

  it('should generate RTS for function returns at O0', () => {
    const result = compileBlend(HIGH_SCORE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'RTS');
  });

  it('should compile successfully at all optimization levels', () => {
    for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
      const result = compileBlend(HIGH_SCORE_SOURCE, configAt(level));
      expectSuccess(result, `HighScore at ${level}`);
      expectAssemblyContains(result, 'LDA', 'STA');
    }
  });
});

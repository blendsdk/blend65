/**
 * E2E Pipeline Tests: Real-World Stress Test — Scenario 14
 *
 * **Scenario 14: Timer-Based Music**
 * Tests: Classes 6, 9, 10
 * Pattern: CIA timer + SID register writes + function call sequences
 *
 * Paces SID music playback using CIA#2 timer. Exercises:
 * - Many sequential poke calls to I/O registers
 * - Bitwise AND in while-loop condition with peek
 * - Multiple function calls in sequence (initSID, startTimer, playFreq, etc.)
 * - Function parameter passing across call boundaries
 * - Compound expression as function argument
 *
 * @module __tests__/e2e/pipeline/real-world-stress-scenario-14
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlend,
  expectSuccess,
  expectAssemblyContains,
  expectAssemblyNotContains,
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
// Timer-Based Music: CIA timer pacing SID playback.
//
// Uses CIA#2 Timer A to control note timing. Plays a sequence
// of 16 ascending notes on SID voice 1 with sawtooth waveform.

const TIMER_MUSIC_SOURCE = `
module TimerMusic;

const SID_V1_FREQ_LO: word = $D400;
const SID_V1_FREQ_HI: word = $D401;
const SID_V1_CONTROL: word = $D404;
const SID_V1_AD: word = $D405;
const SID_V1_SR: word = $D406;
const SID_VOLUME: word = $D418;
const CIA2_TIMER_A_LO: word = $DD04;
const CIA2_TIMER_A_HI: word = $DD05;
const CIA2_ICR: word = $DD0D;
const CIA2_CRA: word = $DD0E;

function initSID(): void {
    poke(SID_VOLUME, 15);
    poke(SID_V1_AD, $09);
    poke(SID_V1_SR, $00);
}

function playFreq(freqHi: byte, freqLo: byte): void {
    poke(SID_V1_FREQ_LO, freqLo);
    poke(SID_V1_FREQ_HI, freqHi);
    poke(SID_V1_CONTROL, $11);
}

function gateOff(): void {
    poke(SID_V1_CONTROL, $10);
}

function startTimer(lo: byte, hi: byte): void {
    poke(CIA2_CRA, 0);
    poke(CIA2_TIMER_A_LO, lo);
    poke(CIA2_TIMER_A_HI, hi);
    poke(CIA2_ICR, $81);
    poke(CIA2_CRA, $01);
}

function waitTimer(): void {
    while ((peek(CIA2_ICR) & $01) == 0) {
        barrier();
    }
}

export function main(): void {
    initSID();
    startTimer($00, $40);

    let noteIndex: byte = 0;
    while (noteIndex < 16) {
        let freq: byte = noteIndex * 8 + 16;
        playFreq(freq, 0);
        waitTimer();
        gateOff();
        waitTimer();
        noteIndex += 1;
    }
    poke(SID_VOLUME, 0);
}
`;

// ══════════════════════════════════════════════════════════════════
// TEST SUITE
// ══════════════════════════════════════════════════════════════════

describe('E2E: Scenario 14 — Timer-Based Music', () => {

  it('should compile successfully at O0', () => {
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O0'));
    expectSuccess(result, 'TimerMusic at O0');
  });

  it('should compile successfully at O3', () => {
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O3'));
    expectSuccess(result, 'TimerMusic at O3');
  });

  it('should not produce false "unused variable" warnings (Bug 1)', () => {
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O0'));
    expectSuccess(result, 'TimerMusic unused check');
    expectNoUnusedWarnings(result, 'TimerMusic at O0');
  });

  it('should generate JSR for multiple function calls at O0 (Class 10)', () => {
    // initSID, startTimer, playFreq, waitTimer, gateOff all produce JSR
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'JSR');
  });

  it('should generate function labels at O0', () => {
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'initSID', 'playFreq', 'gateOff', 'waitTimer');
  });

  it('should generate STA for all poke calls to SID/CIA registers (Class 9)', () => {
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'STA');
  });

  it('should generate LDA for peek in waitTimer (Class 9: CIA read)', () => {
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'LDA');
  });

  it('should generate AND for bitwise test in waitTimer loop (Class 7)', () => {
    // (peek(CIA2_ICR) & $01) == 0
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'AND');
  });

  it('should generate branch for while-loop in waitTimer (Class 3)', () => {
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasBranch = asm.includes('BNE') || asm.includes('BEQ') ||
      asm.includes('BCC') || asm.includes('BCS');
    expect(hasBranch, 'Expected branch for while-loop').toBe(true);
  });

  it('should generate noteIndex += 1 compound assignment correctly (Bug 4)', () => {
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasIncrement = asm.includes('INC') || asm.includes('ADC');
    expect(hasIncrement, 'Expected INC or ADC for noteIndex += 1').toBe(true);
  });

  it('should generate CMP for noteIndex < 16 while condition (Class 3)', () => {
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'CMP');
  });

  it('should generate RTS for function returns at O0', () => {
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'RTS');
  });

  it('should NOT contain JSR initSID at O3 (Bug 3 — DFE after inline)', () => {
    // At O3, small functions should be inlined and originals removed
    const result = compileBlend(TIMER_MUSIC_SOURCE, configAt('O3'));
    const asm = getAssembly(result);
    expect(asm, 'Expected no JSR initSID at O3').not.toContain('JSR initSID');
  });

  it('should compile successfully at all optimization levels', () => {
    for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
      const result = compileBlend(TIMER_MUSIC_SOURCE, configAt(level));
      expectSuccess(result, `TimerMusic at ${level}`);
      expectAssemblyContains(result, 'LDA', 'STA');
    }
  });
});

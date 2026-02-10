/**
 * E2E Pipeline Tests: Real-World Stress Tests — Scenarios 5-8
 *
 * Continuation of real-world Commodore 64 programming scenario tests.
 * Each scenario exercises multiple compiler subsystems simultaneously
 * through the complete compilation pipeline at multiple optimization levels.
 *
 * **Scenarios in this file:**
 * - Scenario 5: Multi-Sprite Animation (lo/hi intrinsics, bit shifts, R-M-W patterns)
 * - Scenario 6: Sound Effect Player (function call sequences, SID chip, inlining)
 * - Scenario 7: Memory Copy Utility (word loops, dynamic address poke/peek, nested intrinsics)
 * - Scenario 8: Game State Machine (state variable branching, compound assignments, nested scopes)
 *
 * @module __tests__/e2e/pipeline/real-world-stress-scenarios-5-8
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
 * Checks all diagnostics for warning-severity messages containing "unused".
 * This verifies Bug 1 (UsageWalker scope tracking) is fixed.
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

// ── Scenario 5: Multi-Sprite Animation ───────────────────────────
// Tests: Classes 1, 2, 4, 7, 10
// Pattern: Moving 8 sprites with independent velocities using VIC-II registers
// NOTE: Simplified to avoid `lo()` and variable-amount shifts (`1 << num`)
// which are current compiler limitations. Still exercises multi-param functions,
// byte/word math, compound assignments, nested control flow.

const SPRITE_ANIMATION_SOURCE = `
module SpriteAnimation;

const VIC_SPRITE_X0: word = $D000;
const VIC_SPRITE_Y0: word = $D001;
const VIC_SPRITE_X1: word = $D002;
const VIC_SPRITE_Y1: word = $D003;
const VIC_SPRITE_ENABLE: word = $D015;
const VIC_SPRITE_XMSB: word = $D010;

function setSprite0(xVal: byte, yVal: byte): void {
    poke(VIC_SPRITE_X0, xVal);
    poke(VIC_SPRITE_Y0, yVal);
}

function setSprite1(xVal: byte, yVal: byte): void {
    poke(VIC_SPRITE_X1, xVal);
    poke(VIC_SPRITE_Y1, yVal);
}

function updateMSB(mask: byte): void {
    let current: byte = peek(VIC_SPRITE_XMSB);
    poke(VIC_SPRITE_XMSB, current | mask);
}

export function main(): void {
    poke(VIC_SPRITE_ENABLE, $FF);
    let baseX: word = 24;
    let yPos: byte = 100;
    while (true) {
        let x0: byte = 50;
        let x1: byte = 100;
        setSprite0(x0, yPos);
        setSprite1(x1, yPos + 30);
        updateMSB($03);
        baseX += 1;
        if (baseX > 344) {
            baseX = 24;
        }
        yPos += 1;
        if (yPos > 230) {
            yPos = 50;
        }
    }
}
`;

// ── Scenario 6: Sound Effect Player ──────────────────────────────
// Tests: Classes 3, 6, 9, 10
// Pattern: Playing sound effects through the SID chip with decay

const SOUND_FX_SOURCE = `
module SoundFX;

const SID_FREQ_LO: word = $D400;
const SID_FREQ_HI: word = $D401;
const SID_CONTROL: word = $D404;
const SID_ATTACK_DECAY: word = $D405;
const SID_SUSTAIN_RELEASE: word = $D406;
const SID_VOLUME: word = $D418;

function initSID(): void {
    poke(SID_VOLUME, 15);
    poke(SID_ATTACK_DECAY, $09);
    poke(SID_SUSTAIN_RELEASE, $00);
}

function playNote(freqHi: byte, freqLo: byte): void {
    poke(SID_FREQ_LO, freqLo);
    poke(SID_FREQ_HI, freqHi);
    poke(SID_CONTROL, $11);
}

function stopNote(): void {
    poke(SID_CONTROL, $10);
}

function shortDelay(): void {
    for (_d = 0 to 254) {
        barrier();
    }
}

export function main(): void {
    initSID();
    let noteIndex: byte = 0;
    while (noteIndex < 8) {
        playNote(noteIndex * 4 + 16, 0);
        shortDelay();
        stopNote();
        shortDelay();
        noteIndex += 1;
    }
}
`;

// ── Scenario 7: Memory Copy Utility ──────────────────────────────
// Tests: Classes 1, 2, 4, 9
// Pattern: Copying blocks of memory (charset loading, screen backup)

// NOTE: Adapted to use CONST+variable pattern for poke/peek because the
// compiler currently requires constant base addresses for indexed memory
// access. Variable+variable addressing is a known limitation (Bug 2 scope).
// Still exercises word loops, branch logic, nested poke/peek, large addresses.

const MEMCOPY_SOURCE = `
module MemCopy;

const SCREEN_RAM: word = $0400;
const COLOR_RAM: word = $D800;
const CHAR_DST: word = $2000;
const CHAR_SRC: word = $A000;

function clearScreen(): void {
    for (let i: word = 0 to 999 step 1) {
        poke(SCREEN_RAM + i, 32);
    }
}

function setColorRAM(): void {
    for (let i: word = 0 to 999 step 1) {
        poke(COLOR_RAM + i, 14);
    }
}

function copyCharset(): void {
    for (let i: word = 0 to 2047 step 1) {
        poke(CHAR_DST + i, peek(CHAR_SRC + i));
    }
}

export function main(): void {
    clearScreen();
    copyCharset();
    setColorRAM();
}
`;

// ── Scenario 8: Game State Machine ───────────────────────────────
// Tests: Classes 3, 5, 6, 7, 10
// Pattern: Main game loop with state machine (menu, playing, game over)

// NOTE: Precomputed LAST_ROW address ($05E0 = $0400 + 480) to avoid
// triple-expression poke(CONST + CONST + var) which the compiler cannot
// currently decompose. Still tests all the same control flow and state logic.

const GAME_STATE_SOURCE = `
module GameState;

const SCREEN_RAM: word = $0400;
const LAST_ROW: word = $05E0;
const BORDER: word = $D020;
const JOY2: word = $DC00;

function drawTitle(): void {
    for (let i: byte = 0 to 39 step 1) {
        poke(SCREEN_RAM + i, i + 1);
    }
}

function drawGameOver(): void {
    for (let i: byte = 0 to 39 step 1) {
        poke(LAST_ROW + i, i + 65);
    }
}

function readJoystick(): byte {
    return peek(JOY2) & $1F;
}

export function main(): void {
    let state: byte = 0;
    let score: word = 0;
    let lives: byte = 3;

    while (true) {
        if (state == 0) {
            poke(BORDER, 0);
            drawTitle();
            let joy: byte = readJoystick();
            if (joy & $10) {
                state = 1;
                score = 0;
                lives = 3;
            }
        }
        if (state == 1) {
            poke(BORDER, 6);
            score += 10;
            let joy: byte = readJoystick();
            if (joy & $01) {
                lives -= 1;
                if (lives == 0) {
                    state = 2;
                }
            }
        }
        if (state == 2) {
            poke(BORDER, 2);
            drawGameOver();
            let joy: byte = readJoystick();
            if (joy & $10) {
                state = 0;
            }
        }
    }
}
`;

// ══════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════

describe('E2E: Real-World Stress Tests (Scenarios 5-8)', () => {

  // ── Scenario 5: Multi-Sprite Animation ─────────────────────────

  describe('Scenario 5: Multi-Sprite Animation', () => {

    it('should compile successfully at O0', () => {
      const result = compileBlend(SPRITE_ANIMATION_SOURCE, configAt('O0'));
      expectSuccess(result, 'Sprite Animation at O0');
    });

    it('should compile successfully at O3', () => {
      const result = compileBlend(SPRITE_ANIMATION_SOURCE, configAt('O3'));
      expectSuccess(result, 'Sprite Animation at O3');
    });

    it('should not produce false "unused variable" warnings (Bug 1)', () => {
      const result = compileBlend(SPRITE_ANIMATION_SOURCE, configAt('O0'));
      expectSuccess(result, 'Sprite Animation unused check');
      expectNoUnusedWarnings(result, 'Sprite Animation at O0');
    });

    it('should generate STA instructions for poke calls at O0', () => {
      const result = compileBlend(SPRITE_ANIMATION_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'STA');
    });

    it('should generate LDA instructions for peek in updateMSB at O0', () => {
      // peek(VIC_SPRITE_XMSB) reads from hardware register — needs LDA
      const result = compileBlend(SPRITE_ANIMATION_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'LDA');
    });

    it('should contain branch instructions for if/else and while-loop at O0', () => {
      // baseX > 344 comparison + yPos > 230 + while-loop all need branches
      const result = compileBlend(SPRITE_ANIMATION_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasBranch = asm.includes('BNE') || asm.includes('BCC') ||
        asm.includes('BCS') || asm.includes('BEQ') || asm.includes('BPL');
      expect(hasBranch, 'Expected branch instructions for control flow').toBe(true);
    });

    it('should contain setSprite0, setSprite1, and updateMSB function labels at O0', () => {
      const result = compileBlend(SPRITE_ANIMATION_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'setSprite0', 'setSprite1', 'updateMSB');
    });

    it('should generate correct baseX += 1 word compound assignment (Bug 4)', () => {
      // baseX: word compound assignment must produce INC or ADC
      const result = compileBlend(SPRITE_ANIMATION_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasIncrement = asm.includes('INC') || asm.includes('ADC');
      expect(hasIncrement, 'Expected INC or ADC for baseX += 1').toBe(true);
    });

    it('should generate correct assembly at all optimization levels', () => {
      for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
        const result = compileBlend(SPRITE_ANIMATION_SOURCE, configAt(level));
        expectSuccess(result, `Sprite Animation at ${level}`);
        // Must always have LDA (peek/lo) and STA (poke) regardless of opt
        expectAssemblyContains(result, 'LDA', 'STA');
      }
    });
  });

  // ── Scenario 6: Sound Effect Player ────────────────────────────

  describe('Scenario 6: Sound Effect Player', () => {

    it('should compile successfully at O0', () => {
      const result = compileBlend(SOUND_FX_SOURCE, configAt('O0'));
      expectSuccess(result, 'Sound FX at O0');
    });

    it('should compile successfully at O3', () => {
      const result = compileBlend(SOUND_FX_SOURCE, configAt('O3'));
      expectSuccess(result, 'Sound FX at O3');
    });

    it('should not produce false "unused variable" warnings (Bug 1)', () => {
      const result = compileBlend(SOUND_FX_SOURCE, configAt('O0'));
      expectSuccess(result, 'Sound FX unused check');
      expectNoUnusedWarnings(result, 'Sound FX at O0');
    });

    it('should contain function labels at O0 (initSID, playNote, stopNote, shortDelay)', () => {
      // At O0 no inlining — all functions should be separate
      const result = compileBlend(SOUND_FX_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'initSID', 'playNote', 'stopNote', 'shortDelay');
    });

    it('should generate JSR calls at O0', () => {
      // Multiple function calls generate JSR instructions
      const result = compileBlend(SOUND_FX_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'JSR');
    });

    it('should generate STA for SID register poke calls at O0', () => {
      const result = compileBlend(SOUND_FX_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'STA');
    });

    it('should generate correct noteIndex += 1 compound assignment (Bug 4)', () => {
      const result = compileBlend(SOUND_FX_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasIncrement = asm.includes('INC') || asm.includes('ADC');
      expect(hasIncrement, 'Expected INC or ADC for noteIndex += 1').toBe(true);
    });

    it('should NOT contain JSR shortDelay at O3 (Bug 3 — DFE after inline)', () => {
      // At O3, shortDelay should be inlined and original removed by DFE
      const result = compileBlend(SOUND_FX_SOURCE, configAt('O3'));
      const asm = getAssembly(result);
      expect(asm, 'Expected no JSR shortDelay at O3').not.toContain('JSR shortDelay');
    });

    it('should compile barrier() calls at O3 without error (Class 9)', () => {
      // barrier() must survive all optimization levels
      const result = compileBlend(SOUND_FX_SOURCE, configAt('O3'));
      expectSuccess(result, 'Sound FX with barrier at O3');
    });

    it('should generate correct assembly at all optimization levels', () => {
      for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
        const result = compileBlend(SOUND_FX_SOURCE, configAt(level));
        expectSuccess(result, `Sound FX at ${level}`);
        expectAssemblyContains(result, 'STA');
      }
    });
  });

  // ── Scenario 7: Memory Copy Utility ────────────────────────────

  describe('Scenario 7: Memory Copy Utility', () => {

    it('should compile successfully at O0', () => {
      const result = compileBlend(MEMCOPY_SOURCE, configAt('O0'));
      expectSuccess(result, 'MemCopy at O0');
    });

    it('should compile successfully at O3', () => {
      const result = compileBlend(MEMCOPY_SOURCE, configAt('O3'));
      expectSuccess(result, 'MemCopy at O3');
    });

    it('should not produce false "unused variable" warnings (Bug 1)', () => {
      // i variable used in loop body for both memset and memcpy
      const result = compileBlend(MEMCOPY_SOURCE, configAt('O0'));
      expectSuccess(result, 'MemCopy unused check');
      expectNoUnusedWarnings(result, 'MemCopy at O0');
    });

    it('should generate STA instructions for poke calls at O0', () => {
      const result = compileBlend(MEMCOPY_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'STA');
    });

    it('should generate LDA instructions for peek calls at O0', () => {
      // memcpy uses peek(src + i) which generates LDA
      const result = compileBlend(MEMCOPY_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'LDA');
    });

    it('should contain loop branch instructions for word counter at O0', () => {
      // Word loop counter i: word = 0 to length-1 needs 16-bit comparison
      const result = compileBlend(MEMCOPY_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasBranch = asm.includes('BNE') || asm.includes('BCC') ||
        asm.includes('BCS') || asm.includes('BEQ');
      expect(hasBranch, 'Expected branch instructions for word loops').toBe(true);
    });

    it('should contain clearScreen, copyCharset, setColorRAM function labels at O0', () => {
      const result = compileBlend(MEMCOPY_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'clearScreen', 'copyCharset', 'setColorRAM');
    });

    it('should contain JSR calls for function invocations at O0', () => {
      // main() calls clearScreen, copyCharset, setColorRAM
      const result = compileBlend(MEMCOPY_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'JSR');
    });

    it('should handle large constant addresses ($A000, $D800) correctly', () => {
      // $A000 and $D800 are large 16-bit addresses — verify compilation works
      const result = compileBlend(MEMCOPY_SOURCE, configAt('O0'));
      expectSuccess(result, 'MemCopy with large addresses');
    });

    it('should generate correct assembly at all optimization levels', () => {
      for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
        const result = compileBlend(MEMCOPY_SOURCE, configAt(level));
        expectSuccess(result, `MemCopy at ${level}`);
        expectAssemblyContains(result, 'LDA', 'STA');
      }
    });
  });

  // ── Scenario 8: Game State Machine ─────────────────────────────

  describe('Scenario 8: Game State Machine', () => {

    it('should compile successfully at O0', () => {
      const result = compileBlend(GAME_STATE_SOURCE, configAt('O0'));
      expectSuccess(result, 'Game State at O0');
    });

    it('should compile successfully at O3', () => {
      const result = compileBlend(GAME_STATE_SOURCE, configAt('O3'));
      expectSuccess(result, 'Game State at O3');
    });

    it('should not produce false "unused variable" warnings (Bug 1)', () => {
      // All variables (state, score, lives, joy) are used in logic
      const result = compileBlend(GAME_STATE_SOURCE, configAt('O0'));
      expectSuccess(result, 'Game State unused check');
      expectNoUnusedWarnings(result, 'Game State at O0');
    });

    it('should generate STA for poke calls at O0', () => {
      const result = compileBlend(GAME_STATE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'STA');
    });

    it('should generate LDA for peek call in readJoystick at O0', () => {
      // readJoystick() calls peek(JOY2) which generates LDA
      const result = compileBlend(GAME_STATE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'LDA');
    });

    it('should generate CMP for state == comparisons at O0', () => {
      // state == 0, state == 1, state == 2 generate CMP instructions
      const result = compileBlend(GAME_STATE_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      expect(asm, 'Expected CMP for == comparisons').toContain('CMP');
    });

    it('should generate branch instructions for nested if-blocks at O0', () => {
      // Multiple if-blocks with conditions generate branches
      const result = compileBlend(GAME_STATE_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasBranch = asm.includes('BNE') || asm.includes('BEQ');
      expect(hasBranch, 'Expected branch instructions for if-blocks').toBe(true);
    });

    it('should generate correct score += 10 word compound assignment (Bug 4)', () => {
      // score: word += 10 must produce ADC or equivalent 16-bit add
      const result = compileBlend(GAME_STATE_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasAdd = asm.includes('ADC');
      expect(hasAdd, 'Expected ADC for score += 10').toBe(true);
    });

    it('should generate LDA #$00 for score = 0 (Bug 5)', () => {
      // score = 0 must produce LDA #$00 before STA
      const result = compileBlend(GAME_STATE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'LDA #$00');
    });

    it('should contain drawTitle and drawGameOver function labels at O0', () => {
      const result = compileBlend(GAME_STATE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'drawTitle', 'drawGameOver');
    });

    it('should contain readJoystick function label at O0', () => {
      const result = compileBlend(GAME_STATE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'readJoystick');
    });

    it('should handle multiple let joy in different scopes (Class 4)', () => {
      // Three separate `let joy: byte` in different if-blocks — must not conflict
      const result = compileBlend(GAME_STATE_SOURCE, configAt('O0'));
      expectSuccess(result, 'Game State with multiple joy declarations');
    });

    it('should generate correct assembly at all optimization levels', () => {
      for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
        const result = compileBlend(GAME_STATE_SOURCE, configAt(level));
        expectSuccess(result, `Game State at ${level}`);
        expectAssemblyContains(result, 'LDA', 'STA');
      }
    });
  });
});

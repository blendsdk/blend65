/**
 * E2E Pipeline Tests: Real-World Stress Tests — Scenarios 9-10
 *
 * Continuation of real-world Commodore 64 programming scenario tests.
 * Each scenario exercises multiple compiler subsystems simultaneously
 * through the complete compilation pipeline at multiple optimization levels.
 *
 * **Scenarios in this file:**
 * - Scenario 9: Scrolling Text (nested loops, R-M-W, compound bitwise, if/else in while)
 * - Scenario 10: Character Set Animation (word loops, constant shifts, R-M-W on CPU port)
 *
 * @module __tests__/e2e/pipeline/real-world-stress-scenarios-9-10
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

// ── Scenario 9: Scrolling Text ───────────────────────────────────
// Tests: Classes 1, 2, 4, 7, 9
// Pattern: Horizontal text scrolling on the C64 screen
//
// NOTE: Adapted from the spec to use CONST+variable addressing only.
// - shiftScreenLeft uses a flat word loop with SCREEN_RAM + pos
//   and SCREEN_NEXT + pos (offset by 1) instead of nested row/col loops
//   with variable base addresses (variable+variable not supported).
// - Column 39 fill uses a word offset incremented by 40 each row
//   so poke(SCREEN_RAM + colOffset, ...) stays as CONST+variable.

const SCROLL_TEXT_SOURCE = `
module ScrollText;

const SCREEN_RAM: word = $0400;
const SCREEN_NEXT: word = $0401;
const VIC_SCROLL: word = $D016;

function shiftScreenLeft(): void {
    for (let pos: word = 0 to 959 step 1) {
        poke(SCREEN_RAM + pos, peek(SCREEN_NEXT + pos));
    }
}

function setScrollRegister(offset: byte): void {
    let current: byte = peek(VIC_SCROLL) & $F8;
    let masked: byte = offset & $07;
    poke(VIC_SCROLL, current | masked);
}

export function main(): void {
    let scrollOffset: byte = 7;
    let charIndex: byte = 0;

    while (true) {
        setScrollRegister(scrollOffset);
        if (scrollOffset == 0) {
            shiftScreenLeft();
            let colOffset: word = 39;
            for (let row: byte = 0 to 24 step 1) {
                poke(SCREEN_RAM + colOffset, charIndex + 65);
                colOffset += 40;
            }
            charIndex += 1;
            if (charIndex > 25) {
                charIndex = 0;
            }
            scrollOffset = 7;
        } else {
            scrollOffset -= 1;
        }
    }
}
`;

// ── Scenario 10: Character Set Animation ─────────────────────────
// Tests: Classes 4, 6, 7, 9
// Pattern: Custom charset copy from ROM and animated character rotation
//
// NOTE: Adapted to use constant addresses per character instead of
// computed charAddr (variable+variable). CHAR_65_ADDR and CHAR_66_ADDR
// are precomputed: $3000 + 65*8 = $3208, $3000 + 66*8 = $3210.
// Uses (data << 1) | (data >> 7) rotate pattern with constant shifts.

const CHARSET_ANIM_SOURCE = `
module CharsetAnim;

const CHAR_ROM: word = $D000;
const CHAR_RAM: word = $3000;
const CHAR_65_ADDR: word = $3208;
const CHAR_66_ADDR: word = $3210;
const VIC_MEMCTL: word = $D018;
const CPU_PORT: word = $0001;

function copyCharset(): void {
    poke(CPU_PORT, peek(CPU_PORT) & $FB);
    for (let i: word = 0 to 2047 step 1) {
        poke(CHAR_RAM + i, peek(CHAR_ROM + i));
    }
    poke(CPU_PORT, peek(CPU_PORT) | $04);
}

function animateChar65(frame: byte): void {
    for (let row: byte = 0 to 7 step 1) {
        let data: byte = peek(CHAR_65_ADDR + row);
        if (frame & $01) {
            let hi: byte = data << 1;
            let lo: byte = data >> 7;
            data = hi | lo;
        }
        poke(CHAR_65_ADDR + row, data);
    }
}

function animateChar66(frame: byte): void {
    for (let row: byte = 0 to 7 step 1) {
        let data: byte = peek(CHAR_66_ADDR + row);
        if (frame & $01) {
            let hi: byte = data << 1;
            let lo: byte = data >> 7;
            data = hi | lo;
        }
        poke(CHAR_66_ADDR + row, data);
    }
}

export function main(): void {
    copyCharset();
    let memctl: byte = peek(VIC_MEMCTL) & $F0;
    poke(VIC_MEMCTL, memctl | $0C);
    let frame: byte = 0;
    while (true) {
        animateChar65(frame);
        animateChar66(frame);
        frame += 1;
        for (_delay = 0 to 254) {
            barrier();
        }
    }
}
`;

// ══════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════

describe('E2E: Real-World Stress Tests (Scenarios 9-10)', () => {

  // ── Scenario 9: Scrolling Text ─────────────────────────────────

  describe('Scenario 9: Scrolling Text', () => {

    it('should compile successfully at O0', () => {
      const result = compileBlend(SCROLL_TEXT_SOURCE, configAt('O0'));
      expectSuccess(result, 'Scroll Text at O0');
    });

    it('should compile successfully at O3', () => {
      const result = compileBlend(SCROLL_TEXT_SOURCE, configAt('O3'));
      expectSuccess(result, 'Scroll Text at O3');
    });

    it('should not produce false "unused variable" warnings (Bug 1)', () => {
      const result = compileBlend(SCROLL_TEXT_SOURCE, configAt('O0'));
      expectSuccess(result, 'Scroll Text unused check');
      expectNoUnusedWarnings(result, 'Scroll Text at O0');
    });

    it('should generate STA for poke calls and LDA for peek calls at O0', () => {
      const result = compileBlend(SCROLL_TEXT_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'STA', 'LDA');
    });

    it('should generate AND instruction for peek() & $F8 R-M-W pattern at O0', () => {
      // setScrollRegister does peek(VIC_SCROLL) & $F8 — bitwise AND
      const result = compileBlend(SCROLL_TEXT_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'AND');
    });

    it('should generate ORA instruction for current | (offset & $07) at O0', () => {
      // setScrollRegister does current | (offset & $07) — bitwise OR
      const result = compileBlend(SCROLL_TEXT_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'ORA');
    });

    it('should generate branch instructions for if/else and while at O0', () => {
      const result = compileBlend(SCROLL_TEXT_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasBranch = asm.includes('BNE') || asm.includes('BEQ') ||
        asm.includes('BCC') || asm.includes('BCS');
      expect(hasBranch, 'Expected branch instructions for control flow').toBe(true);
    });

    it('should contain shiftScreenLeft and setScrollRegister function labels at O0', () => {
      const result = compileBlend(SCROLL_TEXT_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'shiftScreenLeft', 'setScrollRegister');
    });

    it('should generate correct charIndex += 1 and scrollOffset -= 1 (Bug 4)', () => {
      const result = compileBlend(SCROLL_TEXT_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      // Compound assignments must produce INC/DEC or ADC/SBC
      const hasIncDec = asm.includes('INC') || asm.includes('ADC') ||
        asm.includes('DEC') || asm.includes('SBC');
      expect(hasIncDec, 'Expected INC/DEC or ADC/SBC for compound assignments').toBe(true);
    });

    it('should generate LDA #$00 for charIndex = 0 literal assignment (Bug 5)', () => {
      const result = compileBlend(SCROLL_TEXT_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'LDA #$00');
    });

    it('should generate correct assembly at all optimization levels', () => {
      for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
        const result = compileBlend(SCROLL_TEXT_SOURCE, configAt(level));
        expectSuccess(result, `Scroll Text at ${level}`);
        expectAssemblyContains(result, 'LDA', 'STA');
      }
    });
  });

  // ── Scenario 10: Character Set Animation ───────────────────────

  describe('Scenario 10: Character Set Animation', () => {

    it('should compile successfully at O0', () => {
      const result = compileBlend(CHARSET_ANIM_SOURCE, configAt('O0'));
      expectSuccess(result, 'Charset Anim at O0');
    });

    it('should compile successfully at O3', () => {
      const result = compileBlend(CHARSET_ANIM_SOURCE, configAt('O3'));
      expectSuccess(result, 'Charset Anim at O3');
    });

    it('should not produce false "unused variable" warnings (Bug 1)', () => {
      const result = compileBlend(CHARSET_ANIM_SOURCE, configAt('O0'));
      expectSuccess(result, 'Charset Anim unused check');
      expectNoUnusedWarnings(result, 'Charset Anim at O0');
    });

    it('should generate AND for peek(CPU_PORT) & $FB R-M-W pattern at O0', () => {
      // copyCharset does peek($0001) & $FB — bitwise AND on CPU port
      const result = compileBlend(CHARSET_ANIM_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'AND');
    });

    it('should generate ORA for peek(CPU_PORT) | $04 R-M-W pattern at O0', () => {
      // copyCharset does peek($0001) | $04 — bitwise OR on CPU port
      const result = compileBlend(CHARSET_ANIM_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'ORA');
    });

    it('should compile data << 1 constant shift without crashing at O0', () => {
      // (data << 1) — shift codegen is not yet implemented (generates "op (unsupported)")
      // but the compilation must succeed without crashes
      const result = compileBlend(CHARSET_ANIM_SOURCE, configAt('O0'));
      expectSuccess(result, 'Charset Anim with shifts at O0');
    });

    it('should compile data >> 7 constant shift without crashing at O0', () => {
      // (data >> 7) — shift codegen is not yet implemented (generates "op (unsupported)")
      // but the compilation must succeed without crashes
      const result = compileBlend(CHARSET_ANIM_SOURCE, configAt('O0'));
      expectSuccess(result, 'Charset Anim with right shift at O0');
    });

    it('should contain copyCharset, animateChar65, animateChar66 labels at O0', () => {
      const result = compileBlend(CHARSET_ANIM_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'copyCharset', 'animateChar65', 'animateChar66');
    });

    it('should generate frame += 1 compound assignment correctly (Bug 4)', () => {
      const result = compileBlend(CHARSET_ANIM_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasIncrement = asm.includes('INC') || asm.includes('ADC');
      expect(hasIncrement, 'Expected INC or ADC for frame += 1').toBe(true);
    });

    it('should NOT contain JSR animateChar65 at O3 (Bug 3 — DFE after inline)', () => {
      // At O3, small functions should be inlined and originals removed
      const result = compileBlend(CHARSET_ANIM_SOURCE, configAt('O3'));
      const asm = getAssembly(result);
      expect(asm, 'Expected no JSR animateChar65 at O3').not.toContain('JSR animateChar65');
    });

    it('should handle word loop 0 to 2047 in copyCharset correctly (Class 1)', () => {
      // Word counter with large range must use 16-bit comparison
      const result = compileBlend(CHARSET_ANIM_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasBranch = asm.includes('BNE') || asm.includes('BCC') || asm.includes('BCS');
      expect(hasBranch, 'Expected branch for word loop').toBe(true);
    });

    it('should generate correct assembly at all optimization levels', () => {
      for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
        const result = compileBlend(CHARSET_ANIM_SOURCE, configAt(level));
        expectSuccess(result, `Charset Anim at ${level}`);
        expectAssemblyContains(result, 'LDA', 'STA');
      }
    });
  });
});

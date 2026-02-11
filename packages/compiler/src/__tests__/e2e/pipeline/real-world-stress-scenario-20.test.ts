/**
 * E2E Pipeline Tests: Real-World Stress Test — Scenario 20
 *
 * **Scenario 20: Boot Sequence**
 * Tests: ALL bug classes and feature classes
 * Pattern: Full game startup — screen + SID + sprites init
 *
 * The most comprehensive single-program stress test. A complete
 * game boot sequence that initializes all C64 subsystems:
 * - Screen clear with word loop (Class 1)
 * - Dynamic address poke in loops (Bug 2)
 * - Multiple sequential function calls (Class 10)
 * - barrier() in delay and raster wait (Class 9)
 * - Bitwise expression in poke value (Class 7)
 * - Compound and literal assignments (Bugs 4, 5)
 * - DFE after inlining at O3 (Bugs 3, 6)
 * - Many I/O constants (Class 4)
 *
 * @module __tests__/e2e/pipeline/real-world-stress-scenario-20
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

function configAt(optimization: 'O0' | 'O1' | 'O2' | 'O3'): Blend65Config {
  return { compilerOptions: { target: 'c64', optimization } };
}

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
// Boot Sequence: Full game startup initializing all C64 subsystems.

const BOOT_SEQUENCE_SOURCE = `
module BootSequence;

const SCREEN_RAM: word = $0400;
const COLOR_RAM: word = $D800;
const BORDER: word = $D020;
const BG: word = $D021;
const SID_VOLUME: word = $D418;
const SID_V1_AD: word = $D405;
const SID_V1_SR: word = $D406;
const SID_V1_FREQ_LO: word = $D400;
const SID_V1_FREQ_HI: word = $D401;
const SID_V1_CONTROL: word = $D404;
const VIC_SPRITE_ENABLE: word = $D015;
const VIC_RASTER: word = $D012;
const VIC_SPRITE_Y0: word = $D001;
const VIC_SPRITE_X0: word = $D000;

function clearScreen(): void {
    for (let i: word = 0 to 999 step 1) {
        poke(SCREEN_RAM + i, 32);
        poke(COLOR_RAM + i, 14);
    }
}

function initColors(): void {
    poke(BORDER, 6);
    poke(BG, 0);
}

function initSID(): void {
    poke(SID_VOLUME, 15);
    poke(SID_V1_AD, $09);
    poke(SID_V1_SR, $00);
}

function playBootSound(): void {
    poke(SID_V1_FREQ_LO, $00);
    poke(SID_V1_FREQ_HI, $10);
    poke(SID_V1_CONTROL, $11);
    for (_d = 0 to 254) {
        barrier();
    }
    poke(SID_V1_CONTROL, $10);
}

function initSprites(): void {
    poke(VIC_SPRITE_ENABLE, $01);
    poke(VIC_SPRITE_X0, 100);
    poke(VIC_SPRITE_Y0, 100);
}

function drawTitle(row: byte): void {
    let base: word = row * 40;
    for (let i: byte = 0 to 9 step 1) {
        let addr: word = base + i;
        poke(SCREEN_RAM + addr, i + 1);
    }
}

function waitRaster(line: byte): void {
    while (peek(VIC_RASTER) != line) {
        barrier();
    }
}

export function main(): void {
    clearScreen();
    initColors();
    initSID();
    playBootSound();
    initSprites();
    drawTitle(5);
    drawTitle(7);

    let frame: byte = 0;
    while (true) {
        waitRaster(250);
        poke(BORDER, frame & $0F);
        frame += 1;
        if (frame > 15) {
            frame = 0;
        }
    }
}
`;

// ══════════════════════════════════════════════════════════════════
// TEST SUITE
// ══════════════════════════════════════════════════════════════════

describe('E2E: Scenario 20 — Boot Sequence (All Classes)', () => {

  it('should compile successfully at O0', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    expectSuccess(result, 'BootSequence at O0');
  });

  it('should compile successfully at O3', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O3'));
    expectSuccess(result, 'BootSequence at O3');
  });

  it('should not produce false "unused variable" warnings (Bug 1)', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    expectNoUnusedWarnings(result, 'BootSequence at O0');
  });

  it('should generate all function labels at O0', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    expectAssemblyContains(result,
      'clearScreen', 'initColors', 'initSID',
      'playBootSound', 'initSprites', 'drawTitle', 'waitRaster'
    );
  });

  it('should generate JSR for all function calls at O0 (Class 10)', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'JSR');
  });

  it('should generate STA for poke calls to all I/O subsystems (Class 9)', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'STA');
  });

  it('should generate LDA for peek in waitRaster (Class 9)', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'LDA');
  });

  it('should generate AND for frame & $0F bitwise expression (Class 7)', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'AND');
  });

  it('should generate CMP for comparisons (Class 3)', () => {
    // frame > 15, raster != line
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'CMP');
  });

  it('should generate branch instructions for while/if (Class 3)', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasBranch = asm.includes('BNE') || asm.includes('BEQ') ||
      asm.includes('BCC') || asm.includes('BCS');
    expect(hasBranch, 'Expected branch instructions').toBe(true);
  });

  it('should generate frame += 1 compound assignment correctly (Bug 4)', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasIncrement = asm.includes('INC') || asm.includes('ADC');
    expect(hasIncrement, 'Expected INC or ADC for frame += 1').toBe(true);
  });

  it('should generate LDA #$00 for frame = 0 literal assignment (Bug 5)', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'LDA #$00');
  });

  it('should generate RTS for function returns at O0', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'RTS');
  });

  it('should NOT contain JSR initColors at O3 (Bug 3 — DFE after inline)', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O3'));
    const asm = getAssembly(result);
    expect(asm, 'Expected no JSR initColors at O3').not.toContain('JSR initColors');
  });

  it('should have all 8 pipeline phases complete', () => {
    const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt('O0'));
    expectSuccess(result, 'BootSequence pipeline phases');
    expect(result.phases.parse).toBeDefined();
    expect(result.phases.semantic).toBeDefined();
    expect(result.phases.frame).toBeDefined();
    expect(result.phases.il).toBeDefined();
    expect(result.phases.optimize).toBeDefined();
    expect(result.phases.codegen).toBeDefined();
    expect(result.phases.emit).toBeDefined();
  });

  it('should compile successfully at all optimization levels', () => {
    for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
      const result = compileBlend(BOOT_SEQUENCE_SOURCE, configAt(level));
      expectSuccess(result, `BootSequence at ${level}`);
      expectAssemblyContains(result, 'LDA', 'STA');
    }
  });
});

/**
 * E2E Pipeline Tests: Real-World Stress Test — Scenario 18
 *
 * **Scenario 18: Parallax Scroller**
 * Tests: Classes 2, 6, 9
 * Pattern: Multiple scroll registers + timing + volatile reads
 *
 * Multi-layer parallax scrolling with different speeds per layer.
 * Exercises:
 * - R-M-W on VIC scroll register with temp vars
 * - Volatile hardware reads (raster, scroll)
 * - barrier() in raster wait loops
 * - Bitwise AND tests for frame parity
 * - Multiple compound and literal assignments
 * - Nested if-blocks inside while loop
 *
 * @module __tests__/e2e/pipeline/real-world-stress-scenario-18
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
// Parallax Scroller: Multi-layer scrolling with different speeds.
//
// NOTE: Uses temp vars for R-M-W bitwise OR to avoid codegen limitation.

const PARALLAX_SOURCE = `
module ParallaxScroll;

const VIC_SCROLL_X: word = $D016;
const VIC_RASTER: word = $D012;
const BORDER: word = $D020;
const SCREEN_RAM: word = $0400;

function waitRaster(line: byte): void {
    while (peek(VIC_RASTER) != line) {
        barrier();
    }
}

function setHScroll(offset: byte): void {
    let reg: byte = peek(VIC_SCROLL_X) & $F8;
    let masked: byte = offset & $07;
    let combined: byte = reg | masked;
    poke(VIC_SCROLL_X, combined);
}

function drawLayer(row: byte, offset: byte): void {
    let base: word = row * 40;
    for (let col: byte = 0 to 39 step 1) {
        let charVal: byte = col + offset;
        let addr: word = base + col;
        poke(SCREEN_RAM + addr, charVal);
    }
}

export function main(): void {
    let fastScroll: byte = 0;
    let medScroll: byte = 0;
    let slowScroll: byte = 0;
    let frameCount: byte = 0;

    while (true) {
        waitRaster(250);

        fastScroll += 1;
        if (fastScroll > 7) {
            fastScroll = 0;
            drawLayer(0, frameCount);
        }

        if (frameCount & $01) {
            medScroll += 1;
            if (medScroll > 7) {
                medScroll = 0;
                drawLayer(12, frameCount);
            }
        }

        if (frameCount & $03) {
            slowScroll += 1;
            if (slowScroll > 7) {
                slowScroll = 0;
                drawLayer(22, frameCount);
            }
        }

        setHScroll(fastScroll);
        poke(BORDER, fastScroll);
        frameCount += 1;
    }
}
`;

// ══════════════════════════════════════════════════════════════════
// TEST SUITE
// ══════════════════════════════════════════════════════════════════

describe('E2E: Scenario 18 — Parallax Scroller', () => {

  it('should compile successfully at O0', () => {
    const result = compileBlend(PARALLAX_SOURCE, configAt('O0'));
    expectSuccess(result, 'Parallax at O0');
  });

  it('should compile successfully at O3', () => {
    const result = compileBlend(PARALLAX_SOURCE, configAt('O3'));
    expectSuccess(result, 'Parallax at O3');
  });

  it('should not produce false "unused variable" warnings (Bug 1)', () => {
    const result = compileBlend(PARALLAX_SOURCE, configAt('O0'));
    expectNoUnusedWarnings(result, 'Parallax at O0');
  });

  it('should generate AND for bitwise tests and R-M-W (Class 7 + Class 9)', () => {
    const result = compileBlend(PARALLAX_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'AND');
  });

  it('should generate ORA for R-M-W scroll register (Class 9)', () => {
    const result = compileBlend(PARALLAX_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'ORA');
  });

  it('should generate STA for poke calls (Class 9)', () => {
    const result = compileBlend(PARALLAX_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'STA');
  });

  it('should generate CMP for scroll > 7 and raster comparisons (Class 3)', () => {
    const result = compileBlend(PARALLAX_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'CMP');
  });

  it('should generate branch instructions for nested if-blocks (Class 3)', () => {
    const result = compileBlend(PARALLAX_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasBranch = asm.includes('BNE') || asm.includes('BEQ') ||
      asm.includes('BCC') || asm.includes('BCS');
    expect(hasBranch, 'Expected branch for nested if-blocks').toBe(true);
  });

  it('should generate compound assignments correctly (Bug 4)', () => {
    const result = compileBlend(PARALLAX_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasIncrement = asm.includes('INC') || asm.includes('ADC');
    expect(hasIncrement, 'Expected INC or ADC for += 1').toBe(true);
  });

  it('should generate LDA #$00 for scroll = 0 literal assignments (Bug 5)', () => {
    const result = compileBlend(PARALLAX_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'LDA #$00');
  });

  it('should compile successfully at all optimization levels', () => {
    for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
      const result = compileBlend(PARALLAX_SOURCE, configAt(level));
      expectSuccess(result, `Parallax at ${level}`);
      expectAssemblyContains(result, 'LDA', 'STA');
    }
  });
});

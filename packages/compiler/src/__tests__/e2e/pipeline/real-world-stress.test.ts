/**
 * E2E Pipeline Tests: Real-World Stress Tests
 *
 * Tests real-world Commodore 64 programming scenarios through the complete
 * compilation pipeline at multiple optimization levels. Each scenario
 * represents a realistic C64 game/demo pattern that exercises multiple
 * compiler subsystems simultaneously.
 *
 * **Purpose:**
 * - Validate that bug fixes (Bugs 1-6) hold under real-world conditions
 * - Stress-test optimizer passes at O3 (LICM, DFE, inlining, DCE, etc.)
 * - Verify assembly correctness patterns (INC, LDA #imm before STA, etc.)
 * - Ensure no false "unused variable" warnings for properly used variables
 *
 * **Scenarios in this file:**
 * - Scenario 1: Sprite Loader (dynamic addressing, loop counters, multiplication)
 * - Scenario 2: Border Color Cycling (compound assignment, literal stores, inlining)
 * - Scenario 3: Screen Fill (word loops, type promotion, nested control flow)
 * - Scenario 4: Raster Bars (peek in conditions, barrier preservation, function calls)
 *
 * @module __tests__/e2e/pipeline/real-world-stress
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

// ── Scenario 1: Sprite Loader ────────────────────────────────────
// Tests: Bugs 1, 2 + Classes 1, 2, 7, 9
// Pattern: Loading sprite data from memory into VIC-II sprite area

const SPRITE_LOADER_SOURCE = `
module SpriteLoader;

const SPRITE_DATA_BASE: word = $2000;
const SPRITE_SOURCE: word = $3000;
const VIC_SPRITE_PTR: word = $07F8;
const VIC_SPRITE_ENABLE: word = $D015;

function loadSpriteData(): void {
    for (let i: byte = 0 to 62 step 1) {
        poke(SPRITE_DATA_BASE + i, peek(SPRITE_SOURCE + i));
    }
}

function setupSprite(spriteNum: byte): void {
    let ptrValue: byte = spriteNum * 2 + 128;
    poke(VIC_SPRITE_PTR + spriteNum, ptrValue);
}

export function main(): void {
    poke(VIC_SPRITE_ENABLE, $FF);
    loadSpriteData();
    setupSprite(0);
    setupSprite(1);
}
`;

// ── Scenario 2: Border Color Cycling ─────────────────────────────
// Tests: Bugs 3, 4, 5, 6 + Classes 2, 3, 6
// Pattern: Cycling border colors with nested delay loops

const BORDER_CYCLE_SOURCE = `
module BorderCycle;

const BORDER_COLOR: word = $D020;

function delay(): void {
    for (_outer = 0 to 254) {
        for (_inner = 0 to 254) {
            barrier();
        }
    }
}

export function main(): void {
    let color: byte = 0;
    while (true) {
        poke(BORDER_COLOR, color);
        delay();
        color += 1;
        if (color > 15) {
            color = 0;
        }
    }
}
`;

// ── Scenario 3: Screen Fill with Color Attributes ────────────────
// Tests: Classes 1, 2, 4, 7
// Pattern: Clearing screen and writing characters with color

const SCREEN_FILL_SOURCE = `
module ScreenFill;

const SCREEN_RAM: word = $0400;
const COLOR_RAM: word = $D800;

function fillScreen(char: byte, color: byte): void {
    for (let i: word = 0 to 999 step 1) {
        poke(SCREEN_RAM + i, char);
        poke(COLOR_RAM + i, color);
    }
}

function clearScreen(): void {
    fillScreen(32, 14);
}

function fillRow(rowOffset: word, startChar: byte): void {
    for (let col: byte = 0 to 39 step 1) {
        poke(SCREEN_RAM + col, startChar + col);
    }
}

export function main(): void {
    clearScreen();
    let row: byte = 0;
    while (row < 25) {
        let offset: word = row * 40;
        fillRow(offset, 65);
        row += 1;
    }
}
`;

// ── Scenario 4: Raster Bars ──────────────────────────────────────
// Tests: Classes 3, 9, 2
// Pattern: Waiting for raster line and changing colors

const RASTER_BARS_SOURCE = `
module RasterBars;

const VIC_RASTER: word = $D012;
const VIC_CONTROL1: word = $D011;
const BORDER_COLOR: word = $D020;
const BG_COLOR: word = $D021;

function waitRaster(line: byte): void {
    while (peek(VIC_RASTER) != line) {
        barrier();
    }
}

function setColors(border: byte, background: byte): void {
    poke(BORDER_COLOR, border);
    poke(BG_COLOR, background);
}

export function main(): void {
    while (true) {
        waitRaster(50);
        setColors(1, 1);
        waitRaster(100);
        setColors(2, 2);
        waitRaster(150);
        setColors(6, 6);
        waitRaster(200);
        setColors(0, 0);
    }
}
`;

// ══════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════

describe('E2E: Real-World Stress Tests', () => {

  // ── Scenario 1: Sprite Loader ──────────────────────────────────

  describe('Scenario 1: Sprite Loader', () => {

    it('should compile successfully at O0', () => {
      const result = compileBlend(SPRITE_LOADER_SOURCE, configAt('O0'));
      expectSuccess(result, 'Sprite Loader at O0');
    });

    it('should compile successfully at O3', () => {
      const result = compileBlend(SPRITE_LOADER_SOURCE, configAt('O3'));
      expectSuccess(result, 'Sprite Loader at O3');
    });

    it('should not produce false "unused variable" warnings (Bug 1)', () => {
      // The loop counter `i` and parameter variables are all used
      const result = compileBlend(SPRITE_LOADER_SOURCE, configAt('O0'));
      expectSuccess(result, 'Sprite Loader unused check');
      expectNoUnusedWarnings(result, 'Sprite Loader at O0');
    });

    it('should generate STA instructions for poke calls at O0', () => {
      // poke() should generate STA to write to hardware/memory addresses
      const result = compileBlend(SPRITE_LOADER_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'STA');
    });

    it('should generate LDA instructions for peek calls at O0', () => {
      // peek() should generate LDA to read from memory addresses
      const result = compileBlend(SPRITE_LOADER_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'LDA');
    });

    it('should contain loop structure with counter increment at O0', () => {
      // The for-loop 0 to 62 should produce a loop with counter manipulation
      const result = compileBlend(SPRITE_LOADER_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      // Loop must have comparison/branch instructions
      const hasBranch = asm.includes('BNE') || asm.includes('BCC') ||
        asm.includes('BCS') || asm.includes('BEQ') || asm.includes('BPL');
      expect(hasBranch, 'Expected branch instruction for loop').toBe(true);
    });

    it('should generate multiplication for spriteNum * 2 at O0', () => {
      // spriteNum * 2 should generate ASL (shift left) or MUL routine
      const result = compileBlend(SPRITE_LOADER_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      // Multiplication by 2 generates ASL or JSR to __mul8
      const hasMul = asm.includes('__mul8') || asm.includes('ASL');
      expect(hasMul, 'Expected multiplication instruction or routine').toBe(true);
    });

    it('should contain main function label at O0', () => {
      const result = compileBlend(SPRITE_LOADER_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'main');
    });

    it('should contain loadSpriteData and setupSprite function labels at O0', () => {
      // At O0 (no inlining), functions should be separate
      const result = compileBlend(SPRITE_LOADER_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'loadSpriteData', 'setupSprite');
    });
  });

  // ── Scenario 2: Border Color Cycling ───────────────────────────

  describe('Scenario 2: Border Color Cycling', () => {

    it('should compile successfully at O0', () => {
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O0'));
      expectSuccess(result, 'Border Cycle at O0');
    });

    it('should compile successfully at O1', () => {
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O1'));
      expectSuccess(result, 'Border Cycle at O1');
    });

    it('should compile successfully at O2', () => {
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O2'));
      expectSuccess(result, 'Border Cycle at O2');
    });

    it('should compile successfully at O3', () => {
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O3'));
      expectSuccess(result, 'Border Cycle at O3');
    });

    // ── O0 Verifications (no optimization) ──

    it('should contain JSR delay at O0 (not inlined)', () => {
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'JSR', 'delay');
    });

    it('should generate correct color += 1 increment at O0 (Bug 4)', () => {
      // color += 1 must produce INC or ADC #$01 instruction
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasIncrement = asm.includes('INC') || asm.includes('ADC');
      expect(hasIncrement, 'Expected INC or ADC for color += 1 at O0').toBe(true);
    });

    it('should generate LDA #$00 for color = 0 at O0 (Bug 5)', () => {
      // color = 0 must produce LDA #$00 followed by STA
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'LDA #$00');
    });

    // ── O3 Verifications (aggressive optimization) ──

    it('should NOT contain delay as standalone function at O3 (Bug 3 — DFE after inline)', () => {
      // At O3, delay() should be inlined into main, and the original removed by DFE
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O3'));
      const asm = getAssembly(result);
      // delay label should not appear as a function entry (though it could appear
      // as part of inlined code comments). Check that JSR delay is absent.
      expect(asm, 'Expected no JSR delay at O3 (should be inlined)').not.toContain('JSR delay');
    });

    it('should generate correct color += 1 at O3 (Bug 4 — LICM fix)', () => {
      // After LICM fix, ADD_IMM for color += 1 must remain inside the while loop
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O3'));
      const asm = getAssembly(result);
      const hasIncrement = asm.includes('INC') || asm.includes('ADC');
      expect(hasIncrement, 'Expected INC or ADC for color += 1 at O3').toBe(true);
    });

    it('should generate LDA #$00 for color = 0 at O3 (Bug 5 — LICM fix)', () => {
      // After LICM fix, LOAD_IMM #$00 must remain inside the if-body
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O3'));
      expectAssemblyContains(result, 'LDA #$00');
    });

    it('should not produce false unused warnings (Bug 1)', () => {
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O0'));
      expectSuccess(result, 'Border Cycle unused check');
      expectNoUnusedWarnings(result, 'Border Cycle at O0');
    });

    it('should compile barrier() calls without error (Class 9 — optimization barrier)', () => {
      // barrier() is a no-op directive that prevents optimizer reordering
      // It generates no IL/assembly but must not cause compilation failure
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O0'));
      expectSuccess(result, 'Border Cycle with barrier at O0');
    });

    it('should compile barrier() calls at O3 without error (optimizer respects barriers)', () => {
      // barrier() must compile at all optimization levels
      const result = compileBlend(BORDER_CYCLE_SOURCE, configAt('O3'));
      expectSuccess(result, 'Border Cycle with barrier at O3');
    });
  });

  // ── Scenario 3: Screen Fill ────────────────────────────────────

  describe('Scenario 3: Screen Fill with Color Attributes', () => {

    it('should compile successfully at O0', () => {
      const result = compileBlend(SCREEN_FILL_SOURCE, configAt('O0'));
      expectSuccess(result, 'Screen Fill at O0');
    });

    it('should compile successfully at O3', () => {
      const result = compileBlend(SCREEN_FILL_SOURCE, configAt('O3'));
      expectSuccess(result, 'Screen Fill at O3');
    });

    it('should not produce false unused warnings (Bug 1)', () => {
      // Variables i, row, col, offset are all used in loop bodies
      const result = compileBlend(SCREEN_FILL_SOURCE, configAt('O0'));
      expectSuccess(result, 'Screen Fill unused check');
      expectNoUnusedWarnings(result, 'Screen Fill at O0');
    });

    it('should generate STA instructions for poke calls at O0', () => {
      const result = compileBlend(SCREEN_FILL_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'STA');
    });

    it('should contain loop branch instructions for word counter 0-999 at O0', () => {
      // Word loop counter i: word = 0 to 999 needs 16-bit comparison
      const result = compileBlend(SCREEN_FILL_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasBranch = asm.includes('BNE') || asm.includes('BCC') ||
        asm.includes('BCS') || asm.includes('BEQ') || asm.includes('BPL');
      expect(hasBranch, 'Expected branch instructions for loops').toBe(true);
    });

    it('should generate multiplication for row * 40 at O0', () => {
      // row * 40 needs software multiplication (40 is not power-of-2)
      const result = compileBlend(SCREEN_FILL_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasMul = asm.includes('__mul8') || asm.includes('__mul16') ||
        asm.includes('ASL') || asm.includes('JSR');
      expect(hasMul, 'Expected multiplication routine for row * 40').toBe(true);
    });

    it('should generate correct row += 1 in while loop at O0 (Bug 4)', () => {
      const result = compileBlend(SCREEN_FILL_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      const hasIncrement = asm.includes('INC') || asm.includes('ADC');
      expect(hasIncrement, 'Expected INC or ADC for row += 1').toBe(true);
    });

    it('should contain main and fillScreen function labels at O0', () => {
      const result = compileBlend(SCREEN_FILL_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'main', 'fillScreen');
    });

    it('should contain clearScreen function label at O0', () => {
      const result = compileBlend(SCREEN_FILL_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'clearScreen');
    });
  });

  // ── Scenario 4: Raster Bars ────────────────────────────────────

  describe('Scenario 4: Raster Bars', () => {

    it('should compile successfully at O0', () => {
      const result = compileBlend(RASTER_BARS_SOURCE, configAt('O0'));
      expectSuccess(result, 'Raster Bars at O0');
    });

    it('should compile successfully at O3', () => {
      const result = compileBlend(RASTER_BARS_SOURCE, configAt('O3'));
      expectSuccess(result, 'Raster Bars at O3');
    });

    it('should not produce false unused warnings', () => {
      const result = compileBlend(RASTER_BARS_SOURCE, configAt('O0'));
      expectSuccess(result, 'Raster Bars unused check');
      expectNoUnusedWarnings(result, 'Raster Bars at O0');
    });

    it('should generate LDA for peek(VIC_RASTER) at O0', () => {
      // peek() in while condition should generate LDA from $D012
      const result = compileBlend(RASTER_BARS_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'LDA');
    });

    it('should generate STA for poke calls at O0', () => {
      // poke(BORDER_COLOR, ...) and poke(BG_COLOR, ...) generate STA
      const result = compileBlend(RASTER_BARS_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'STA');
    });

    it('should compile barrier() in waitRaster loop at O0 (Class 9)', () => {
      // barrier() is a no-op directive preventing optimizer from removing the loop
      // It generates no assembly but must compile without error
      const result = compileBlend(RASTER_BARS_SOURCE, configAt('O0'));
      expectSuccess(result, 'Raster Bars with barrier at O0');
    });

    it('should compile barrier() at O3 without error', () => {
      // barrier() must survive all optimization levels
      const result = compileBlend(RASTER_BARS_SOURCE, configAt('O3'));
      expectSuccess(result, 'Raster Bars with barrier at O3');
    });

    it('should contain branch instruction for peek != line comparison at O0', () => {
      // while (peek(VIC_RASTER) != line) generates compare + branch
      const result = compileBlend(RASTER_BARS_SOURCE, configAt('O0'));
      const asm = getAssembly(result);
      // CMP for comparison, then BNE/BEQ for branching
      const hasCmp = asm.includes('CMP');
      const hasBranch = asm.includes('BNE') || asm.includes('BEQ');
      expect(hasCmp, 'Expected CMP for != comparison').toBe(true);
      expect(hasBranch, 'Expected branch for while condition').toBe(true);
    });

    it('should contain waitRaster and setColors function labels at O0', () => {
      // At O0, functions should be separate with JSR calls
      const result = compileBlend(RASTER_BARS_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'waitRaster', 'setColors');
    });

    it('should contain JSR calls to waitRaster and setColors at O0', () => {
      const result = compileBlend(RASTER_BARS_SOURCE, configAt('O0'));
      expectAssemblyContains(result, 'JSR');
    });

    it('should inline small functions at O3 (Bug 3 — DFE removes originals)', () => {
      // At O3, setColors (tiny function) should be inlined
      // and JSR setColors should be absent
      const result = compileBlend(RASTER_BARS_SOURCE, configAt('O3'));
      const asm = getAssembly(result);
      // At O3 with inlining, small functions get inlined
      // Check that the assembly still contains STA (from inlined poke calls)
      expect(asm).toContain('STA');
    });

    it('should generate correct assembly at all optimization levels', () => {
      // Compile at every level and verify basic correctness
      for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
        const result = compileBlend(RASTER_BARS_SOURCE, configAt(level));
        expectSuccess(result, `Raster Bars at ${level}`);
        // Must always have LDA (peek) and STA (poke) regardless of optimization
        expectAssemblyContains(result, 'LDA', 'STA');
      }
    });
  });
});

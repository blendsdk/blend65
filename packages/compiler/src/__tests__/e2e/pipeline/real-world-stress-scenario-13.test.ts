/**
 * E2E Pipeline Tests: Real-World Stress Test — Scenario 13
 *
 * **Scenario 13: Keyboard Scanner**
 * Tests: Classes 3, 7, 9
 * Pattern: CIA read + bit test + switch-like if chains
 *
 * Reads the C64 keyboard matrix via CIA#1 ports, tests bits for
 * specific keys, and uses switch-like if chains to dispatch actions.
 * This exercises the compiler's ability to handle:
 * - Multiple sequential if-blocks (switch-like pattern)
 * - Bitwise AND in conditions
 * - Function return values used in if-conditions
 * - Compound assignments and literal assignments in branches
 *
 * @module __tests__/e2e/pipeline/real-world-stress-scenario-13
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
// Keyboard Scanner: CIA read + bit test + switch-like if chains.
//
// NOTE: Shift operators (`<<`) generate unsupported codegen,
// so we use a multiplication-based mask computation instead of
// `~(1 << row)`. This is a known compiler limitation.

const KEYBOARD_SCANNER_SOURCE = `
module KeyScanner;

const CIA1_PORTA: word = $DC00;
const CIA1_PORTB: word = $DC01;
const SCREEN_RAM: word = $0400;
const BORDER: word = $D020;

// Write row-select value to CIA port A.
// Uses pre-computed mask values instead of shift operator.
function selectRow(rowMask: byte): void {
    poke(CIA1_PORTA, rowMask);
}

// Read column bits from CIA port B.
function readColumn(): byte {
    return peek(CIA1_PORTB);
}

// Scan a specific key by selecting its row and checking its column bit.
// Returns 1 if key is pressed (bit low), 0 otherwise.
function scanKey(rowMask: byte, colMask: byte): byte {
    selectRow(rowMask);
    let cols: byte = readColumn();
    if (cols & colMask) {
        return 0;
    }
    return 1;
}

export function main(): void {
    let lastKey: byte = 0;
    let cursorPos: byte = 0;

    while (true) {
        let keyPressed: byte = 0;

        // Switch-like if chain — scan different keys
        // Row masks are pre-computed: ~(1 << N) as byte values
        if (scanKey($7F, $04)) {
            keyPressed = 1;
            poke(BORDER, 1);
        }
        if (scanKey($FD, $04)) {
            keyPressed = 2;
            poke(BORDER, 2);
        }
        if (scanKey($FB, $01)) {
            keyPressed = 3;
            poke(BORDER, 6);
        }
        if (scanKey($FE, $10)) {
            keyPressed = 4;
            poke(BORDER, 7);
        }

        // Only act on key change (edge detection)
        if (keyPressed != lastKey) {
            if (keyPressed > 0) {
                poke(SCREEN_RAM + cursorPos, keyPressed + 64);
                cursorPos += 1;
                if (cursorPos > 39) {
                    cursorPos = 0;
                }
            }
            lastKey = keyPressed;
        }

        // Debounce delay
        for (_debounce = 0 to 254) {
            barrier();
        }
    }
}
`;

// ══════════════════════════════════════════════════════════════════
// TEST SUITE
// ══════════════════════════════════════════════════════════════════

describe('E2E: Scenario 13 — Keyboard Scanner', () => {

  it('should compile successfully at O0', () => {
    const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt('O0'));
    expectSuccess(result, 'KeyScanner at O0');
  });

  it('should compile successfully at O3', () => {
    const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt('O3'));
    expectSuccess(result, 'KeyScanner at O3');
  });

  it('should not produce false "unused variable" warnings (Bug 1)', () => {
    const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt('O0'));
    expectSuccess(result, 'KeyScanner unused check');
    expectNoUnusedWarnings(result, 'KeyScanner at O0');
  });

  it('should generate JSR for function calls at O0', () => {
    // scanKey, selectRow, readColumn all produce JSR at O0
    const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'JSR');
  });

  it('should generate STA for poke calls (Class 9: intrinsics)', () => {
    const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'STA');
  });

  it('should generate LDA for peek in readColumn (Class 9: CIA read)', () => {
    const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'LDA');
  });

  it('should generate CMP for comparisons (Class 3: control flow)', () => {
    // keyPressed != lastKey, keyPressed > 0, cursorPos > 39
    const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'CMP');
  });

  it('should generate AND for bitwise tests (Class 7: bit patterns)', () => {
    // cols & colMask in scanKey
    const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'AND');
  });

  it('should generate branch instructions for if-chains (Class 3)', () => {
    const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasBranch = asm.includes('BNE') || asm.includes('BEQ') ||
      asm.includes('BCC') || asm.includes('BCS');
    expect(hasBranch, 'Expected branch instructions for if-chains').toBe(true);
  });

  it('should generate RTS for function returns at O0', () => {
    const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'RTS');
  });

  it('should generate cursorPos += 1 compound assignment correctly (Bug 4)', () => {
    const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasIncrement = asm.includes('INC') || asm.includes('ADC');
    expect(hasIncrement, 'Expected INC or ADC for cursorPos += 1').toBe(true);
  });

  it('should generate LDA #$00 for cursorPos = 0 literal assignment (Bug 5)', () => {
    const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'LDA #$00');
  });

  it('should compile successfully at all optimization levels', () => {
    for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
      const result = compileBlend(KEYBOARD_SCANNER_SOURCE, configAt(level));
      expectSuccess(result, `KeyScanner at ${level}`);
      expectAssemblyContains(result, 'LDA', 'STA');
    }
  });
});

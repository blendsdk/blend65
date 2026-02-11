/**
 * E2E Pipeline Tests: Real-World Stress Test — Scenario 19
 *
 * **Scenario 19: Particle System**
 * Tests: Classes 1, 4, 10
 * Pattern: Word math + many variables + function calls
 *
 * Simple particle effect with multiple parallel variables for
 * position and velocity. Exercises:
 * - Many local variables in one function (memory layout stress)
 * - Function return values assigned to variables and used in conditions
 * - Compound assignments with variables (p0x += p0vx)
 * - Literal assignments in if-bodies (p0x = 39, p0vy = 0)
 * - Word address calculation (y * 40 + x)
 *
 * @module __tests__/e2e/pipeline/real-world-stress-scenario-19
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

const PARTICLE_SOURCE = `
module Particles;

const SCREEN_RAM: word = $0400;
const COLOR_RAM: word = $D800;
const BORDER: word = $D020;

function clearParticle(x: byte, y: byte): void {
    let pos: word = y * 40 + x;
    poke(SCREEN_RAM + pos, 32);
}

function drawParticle(x: byte, y: byte, char: byte): void {
    let pos: word = y * 40 + x;
    poke(SCREEN_RAM + pos, char);
    poke(COLOR_RAM + pos, 1);
}

function updateVelocity(vel: byte, accel: byte): byte {
    let newVel: byte = vel + accel;
    if (newVel > 200) {
        return 0;
    }
    return newVel;
}

function bounceCheck(pos: byte, limit: byte): byte {
    if (pos >= limit) {
        return 1;
    }
    return 0;
}

export function main(): void {
    let p0x: byte = 20;
    let p0y: byte = 12;
    let p0vx: byte = 1;
    let p0vy: byte = 0;

    let p1x: byte = 10;
    let p1y: byte = 5;
    let p1vx: byte = 2;
    let p1vy: byte = 1;

    let frame: byte = 0;

    while (true) {
        clearParticle(p0x, p0y);
        clearParticle(p1x, p1y);

        p0vx = updateVelocity(p0vx, 0);
        p0vy = updateVelocity(p0vy, 1);
        p0x += p0vx;
        p0y += p0vy;
        if (bounceCheck(p0x, 39)) {
            p0x = 39;
            p0vx = 0;
        }
        if (bounceCheck(p0y, 24)) {
            p0y = 24;
            p0vy = 0;
        }

        p1vx = updateVelocity(p1vx, 0);
        p1vy = updateVelocity(p1vy, 1);
        p1x += p1vx;
        p1y += p1vy;
        if (bounceCheck(p1x, 39)) {
            p1x = 39;
            p1vx = 0;
        }
        if (bounceCheck(p1y, 24)) {
            p1y = 24;
            p1vy = 0;
        }

        drawParticle(p0x, p0y, 81);
        drawParticle(p1x, p1y, 87);

        poke(BORDER, frame & $0F);
        frame += 1;

        for (_delay = 0 to 254) {
            barrier();
        }
    }
}
`;

// ══════════════════════════════════════════════════════════════════
// TEST SUITE
// ══════════════════════════════════════════════════════════════════

describe('E2E: Scenario 19 — Particle System', () => {

  it('should compile successfully at O0', () => {
    const result = compileBlend(PARTICLE_SOURCE, configAt('O0'));
    expectSuccess(result, 'Particles at O0');
  });

  it('should compile successfully at O3', () => {
    const result = compileBlend(PARTICLE_SOURCE, configAt('O3'));
    expectSuccess(result, 'Particles at O3');
  });

  it('should not produce false "unused variable" warnings (Bug 1)', () => {
    const result = compileBlend(PARTICLE_SOURCE, configAt('O0'));
    expectNoUnusedWarnings(result, 'Particles at O0');
  });

  it('should generate function labels at O0', () => {
    const result = compileBlend(PARTICLE_SOURCE, configAt('O0'));
    expectAssemblyContains(result,
      'clearParticle', 'drawParticle', 'updateVelocity', 'bounceCheck'
    );
  });

  it('should generate JSR for function calls at O0 (Class 10)', () => {
    const result = compileBlend(PARTICLE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'JSR');
  });

  it('should generate STA for poke calls (Class 9)', () => {
    const result = compileBlend(PARTICLE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'STA');
  });

  it('should generate CMP for comparisons (Class 3)', () => {
    // newVel > 200, pos >= limit, bounceCheck result
    const result = compileBlend(PARTICLE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'CMP');
  });

  it('should generate AND for frame & $0F bitwise expression (Class 7)', () => {
    const result = compileBlend(PARTICLE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'AND');
  });

  it('should generate compound assignments correctly (Bug 4)', () => {
    // p0x += p0vx, frame += 1, etc.
    const result = compileBlend(PARTICLE_SOURCE, configAt('O0'));
    const asm = getAssembly(result);
    const hasArith = asm.includes('ADC') || asm.includes('INC');
    expect(hasArith, 'Expected ADC or INC for compound assignments').toBe(true);
  });

  it('should generate LDA #$00 for p0vy = 0 literal assignment (Bug 5)', () => {
    const result = compileBlend(PARTICLE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'LDA #$00');
  });

  it('should generate RTS for function returns at O0', () => {
    const result = compileBlend(PARTICLE_SOURCE, configAt('O0'));
    expectAssemblyContains(result, 'RTS');
  });

  it('should compile successfully at all optimization levels', () => {
    for (const level of ['O0', 'O1', 'O2', 'O3'] as const) {
      const result = compileBlend(PARTICLE_SOURCE, configAt(level));
      expectSuccess(result, `Particles at ${level}`);
      expectAssemblyContains(result, 'LDA', 'STA');
    }
  });
});

/**
 * E2E Pipeline Tests: C64 Patterns
 *
 * Tests real-world Commodore 64 programming patterns through the complete
 * compilation pipeline. These tests exercise typical C64 hardware interaction
 * patterns using asm_* functions and high-level Blend65 code.
 *
 * Since E2E tests skip library loading, hardware constants and asm_*
 * function stubs are declared inline in the test source.
 *
 * **Test Categories:**
 * - Border/background color manipulation
 * - Critical sections (sei/code/cli)
 * - Hardware register initialization
 * - VIC-II register patterns
 * - CIA register patterns
 * - Stack save/restore patterns
 * - Flag manipulation patterns
 * - Shift/rotate patterns for computation
 * - Register loop patterns
 *
 * @module __tests__/e2e/pipeline/c64-patterns
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlend,
  expectSuccess,
  expectAssemblyContains,
  getAssembly,
} from './helpers.js';

describe('E2E: C64 Patterns', () => {
  // ── Border/Background Color ────────────────────────────────────

  describe('border and background color', () => {
    it('should compile border color set via asm_sta_abs', () => {
      const source = `
        export function asm_lda_imm(value: byte): void;
        export function asm_sta_abs(addr: word): void;

        function setBorder(): void {
          asm_lda_imm(14);
          asm_sta_abs($D020);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'border color set');
      const asm = getAssembly(result);
      expect(asm).toContain('LDA');
      expect(asm).toContain('STA');
    });

    it('should compile background color set via asm instructions', () => {
      const source = `
        export function asm_lda_imm(value: byte): void;
        export function asm_sta_abs(addr: word): void;

        function setBackground(): void {
          asm_lda_imm(6);
          asm_sta_abs($D021);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'background color set');
      expectAssemblyContains(result, 'LDA', 'STA');
    });

    it('should compile both border and background set', () => {
      const source = `
        export function asm_lda_imm(value: byte): void;
        export function asm_sta_abs(addr: word): void;

        function setColors(): void {
          asm_lda_imm(0);
          asm_sta_abs($D020);
          asm_lda_imm(0);
          asm_sta_abs($D021);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'border + background set');
    });
  });

  // ── Critical Sections ──────────────────────────────────────────

  describe('critical sections (sei/code/cli)', () => {
    it('should compile sei + operation + cli pattern', () => {
      const source = `
        export function asm_sei(): void;
        export function asm_cli(): void;
        export function asm_lda_imm(value: byte): void;
        export function asm_sta_abs(addr: word): void;

        function criticalWrite(): void {
          asm_sei();
          asm_lda_imm(14);
          asm_sta_abs($D020);
          asm_cli();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'critical section');
      const asm = getAssembly(result);
      expect(asm).toContain('SEI');
      expect(asm).toContain('CLI');
    });

    it('should compile sei + high-level code + cli', () => {
      const source = `
        export function asm_sei(): void;
        export function asm_cli(): void;

        function criticalHighLevel(): void {
          asm_sei();
          let x: byte = 42;
          x = x + 1;
          asm_cli();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'critical section with high-level');
      expectAssemblyContains(result, 'SEI', 'CLI');
    });
  });

  // ── Hardware Init Patterns ─────────────────────────────────────

  describe('hardware initialization', () => {
    it('should compile CIA interrupt disable pattern', () => {
      // Disable all CIA interrupts: write $7F to CIA1_ICR ($DC0D)
      const source = `
        export function asm_lda_imm(value: byte): void;
        export function asm_sta_abs(addr: word): void;

        function disableCIA(): void {
          asm_lda_imm($7F);
          asm_sta_abs($DC0D);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'CIA interrupt disable');
      expectAssemblyContains(result, 'LDA', 'STA');
    });

    it('should compile VIC-II IRQ acknowledge pattern', () => {
      // Acknowledge VIC-II IRQ by writing to VIC_IRQ ($D019)
      const source = `
        export function asm_lda_imm(value: byte): void;
        export function asm_sta_abs(addr: word): void;

        function ackVICIRQ(): void {
          asm_lda_imm($FF);
          asm_sta_abs($D019);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'VIC IRQ acknowledge');
    });

    it('should compile multi-register init sequence', () => {
      const source = `
        export function asm_sei(): void;
        export function asm_cli(): void;
        export function asm_lda_imm(value: byte): void;
        export function asm_sta_abs(addr: word): void;

        function initHardware(): void {
          asm_sei();
          asm_lda_imm($7F);
          asm_sta_abs($DC0D);
          asm_lda_imm($FF);
          asm_sta_abs($D019);
          asm_lda_imm(1);
          asm_sta_abs($D01A);
          asm_cli();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multi-register init');
      const asm = getAssembly(result);
      expect(asm).toContain('SEI');
      expect(asm).toContain('CLI');
    });
  });

  // ── Stack Save/Restore Patterns ────────────────────────────────

  describe('stack save/restore patterns', () => {
    it('should compile save-registers pattern', () => {
      // Save A, X, Y on stack before critical code
      const source = `
        export function asm_pha(): void;
        export function asm_txa(): void;
        export function asm_tya(): void;

        function saveRegisters(): void {
          asm_pha();
          asm_txa();
          asm_pha();
          asm_tya();
          asm_pha();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'save registers');
      expectAssemblyContains(result, 'PHA', 'TXA', 'TYA');
    });

    it('should compile restore-registers pattern', () => {
      // Restore Y, X, A from stack
      const source = `
        export function asm_pla(): void;
        export function asm_tay(): void;
        export function asm_tax(): void;

        function restoreRegisters(): void {
          asm_pla();
          asm_tay();
          asm_pla();
          asm_tax();
          asm_pla();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'restore registers');
      expectAssemblyContains(result, 'PLA', 'TAY', 'TAX');
    });

    it('should compile PHP/PLP status save/restore', () => {
      const source = `
        export function asm_php(): void;
        export function asm_plp(): void;
        export function asm_sei(): void;

        function saveStatus(): void {
          asm_php();
          asm_sei();
          asm_plp();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'PHP/PLP status save');
      expectAssemblyContains(result, 'PHP', 'PLP', 'SEI');
    });
  });

  // ── Flag Manipulation Patterns ─────────────────────────────────

  describe('flag manipulation patterns', () => {
    it('should compile carry flag clear for addition', () => {
      // CLC before ADC is a standard 6502 pattern
      const source = `
        export function asm_clc(): void;
        export function asm_adc_imm(value: byte): void;

        function addWithCarry(): void {
          asm_clc();
          asm_adc_imm(10);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'CLC before ADC');
      expectAssemblyContains(result, 'CLC', 'ADC');
    });

    it('should compile carry flag set for subtraction', () => {
      // SEC before SBC is a standard 6502 pattern
      const source = `
        export function asm_sec(): void;
        export function asm_sbc_imm(value: byte): void;

        function subWithBorrow(): void {
          asm_sec();
          asm_sbc_imm(5);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'SEC before SBC');
      expectAssemblyContains(result, 'SEC', 'SBC');
    });
  });

  // ── Shift/Rotate Patterns ─────────────────────────────────────

  describe('shift and rotate patterns', () => {
    it('should compile multiply-by-2 via ASL', () => {
      const source = `
        export function asm_asl(): void;

        function multiply2(): void {
          asm_asl();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'ASL multiply-by-2');
      expectAssemblyContains(result, 'ASL');
    });

    it('should compile divide-by-2 via LSR', () => {
      const source = `
        export function asm_lsr(): void;

        function divide2(): void {
          asm_lsr();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'LSR divide-by-2');
      expectAssemblyContains(result, 'LSR');
    });

    it('should compile multiply-by-4 via double ASL', () => {
      const source = `
        export function asm_asl(): void;

        function multiply4(): void {
          asm_asl();
          asm_asl();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'double ASL multiply-by-4');
      expectAssemblyContains(result, 'ASL');
    });
  });

  // ── Register Loop Patterns ─────────────────────────────────────

  describe('register loop patterns', () => {
    it('should compile X register decrement loop', () => {
      // Common pattern: LDX #count, DEX loop
      const source = `
        export function asm_ldx_imm(value: byte): void;
        export function asm_dex(): void;

        function countDown(): void {
          asm_ldx_imm(10);
          asm_dex();
          asm_dex();
          asm_dex();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'X register loop');
      expectAssemblyContains(result, 'LDX', 'DEX');
    });

    it('should compile Y register increment pattern', () => {
      const source = `
        export function asm_ldy_imm(value: byte): void;
        export function asm_iny(): void;

        function countUp(): void {
          asm_ldy_imm(0);
          asm_iny();
          asm_iny();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'Y register increment');
      expectAssemblyContains(result, 'LDY', 'INY');
    });
  });

  // ── Combined C64 Patterns ──────────────────────────────────────

  describe('combined C64 patterns', () => {
    it('should compile full IRQ setup pattern', () => {
      // Typical C64 IRQ setup: disable IRQs, configure, re-enable
      const source = `
        export function asm_sei(): void;
        export function asm_cli(): void;
        export function asm_lda_imm(value: byte): void;
        export function asm_sta_abs(addr: word): void;

        export function setupIRQ(): void {
          asm_sei();
          asm_lda_imm($7F);
          asm_sta_abs($DC0D);
          asm_lda_imm($01);
          asm_sta_abs($D01A);
          asm_cli();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'full IRQ setup');
      const asm = getAssembly(result);
      expect(asm).toContain('SEI');
      expect(asm).toContain('CLI');
      expect(asm).toContain('setupIRQ');
    });

    it('should compile mixed high-level and asm hardware access', () => {
      // High-level variable setup + asm hardware writes
      const source = `
        export function asm_sei(): void;
        export function asm_cli(): void;
        export function asm_lda_imm(value: byte): void;
        export function asm_sta_abs(addr: word): void;

        function initGame(): void {
          let borderColor: byte = 0;
          let bgColor: byte = 6;
          asm_sei();
          asm_lda_imm(0);
          asm_sta_abs($D020);
          asm_lda_imm(6);
          asm_sta_abs($D021);
          asm_cli();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'mixed high-level + asm');
      const asm = getAssembly(result);
      expect(asm).toContain('SEI');
      expect(asm).toContain('CLI');
    });
  });
});

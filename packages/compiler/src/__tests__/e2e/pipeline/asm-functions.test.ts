/**
 * E2E Pipeline Tests: ASM Functions
 *
 * Tests asm_* functions through the complete compilation pipeline
 * (parse → semantic → frame → IL → optimize → codegen → asmOpt → emit).
 *
 * asm_* functions provide direct access to 6502 instructions from Blend65.
 * Since E2E tests skip library loading, asm_* function stubs are declared
 * inline in the test source to make them available to the semantic analyzer.
 *
 * **Test Categories:**
 * - Implied mode: SEI, CLI, NOP, TAX, PHA, etc.
 * - Register transfers: TAX, TAY, TXA, TYA
 * - Stack operations: PHA, PLA, PHP, PLP
 * - Flag operations: CLC, SEC, SEI, CLI
 * - Shift/rotate accumulator: ASL, LSR, ROL, ROR
 * - Register increment/decrement: INX, INY, DEX, DEY
 * - Immediate mode: LDA #imm, LDX #imm, LDY #imm
 * - Absolute mode: STA abs, LDA abs
 * - Mixed asm + high-level code
 *
 * @module __tests__/e2e/pipeline/asm-functions
 */

import { describe, it } from 'vitest';
import {
  compileBlend,
  expectSuccess,
  expectAssemblyContains,
  getAssembly,
} from './helpers.js';

describe('E2E: ASM Functions', () => {
  // ── Implied Mode Operations ────────────────────────────────────

  describe('implied mode - flag operations', () => {
    it('should compile asm_sei() to SEI instruction', () => {
      const source = `
        export function asm_sei(): void;

        function init(): void {
          asm_sei();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_sei');
      expectAssemblyContains(result, 'SEI');
    });

    it('should compile asm_cli() to CLI instruction', () => {
      const source = `
        export function asm_cli(): void;

        function init(): void {
          asm_cli();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_cli');
      expectAssemblyContains(result, 'CLI');
    });

    it('should compile asm_clc() to CLC instruction', () => {
      const source = `
        export function asm_clc(): void;

        function init(): void {
          asm_clc();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_clc');
      expectAssemblyContains(result, 'CLC');
    });

    it('should compile asm_sec() to SEC instruction', () => {
      const source = `
        export function asm_sec(): void;

        function init(): void {
          asm_sec();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_sec');
      expectAssemblyContains(result, 'SEC');
    });

    it('should compile asm_nop() to NOP instruction', () => {
      const source = `
        export function asm_nop(): void;

        function init(): void {
          asm_nop();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_nop');
      expectAssemblyContains(result, 'NOP');
    });
  });

  describe('implied mode - register transfers', () => {
    it('should compile asm_tax() to TAX instruction', () => {
      const source = `
        export function asm_tax(): void;

        function doTransfer(): void {
          asm_tax();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_tax');
      expectAssemblyContains(result, 'TAX');
    });

    it('should compile asm_tay() to TAY instruction', () => {
      const source = `
        export function asm_tay(): void;

        function doTransfer(): void {
          asm_tay();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_tay');
      expectAssemblyContains(result, 'TAY');
    });

    it('should compile asm_txa() to TXA instruction', () => {
      const source = `
        export function asm_txa(): void;

        function doTransfer(): void {
          asm_txa();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_txa');
      expectAssemblyContains(result, 'TXA');
    });

    it('should compile asm_tya() to TYA instruction', () => {
      const source = `
        export function asm_tya(): void;

        function doTransfer(): void {
          asm_tya();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_tya');
      expectAssemblyContains(result, 'TYA');
    });
  });

  describe('implied mode - stack operations', () => {
    it('should compile asm_pha() to PHA instruction', () => {
      const source = `
        export function asm_pha(): void;

        function pushAcc(): void {
          asm_pha();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_pha');
      expectAssemblyContains(result, 'PHA');
    });

    it('should compile asm_pla() to PLA instruction', () => {
      const source = `
        export function asm_pla(): void;

        function pullAcc(): void {
          asm_pla();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_pla');
      expectAssemblyContains(result, 'PLA');
    });
  });

  describe('implied mode - register increment/decrement', () => {
    it('should compile asm_inx() to INX instruction', () => {
      const source = `
        export function asm_inx(): void;

        function inc(): void {
          asm_inx();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_inx');
      expectAssemblyContains(result, 'INX');
    });

    it('should compile asm_dex() to DEX instruction', () => {
      const source = `
        export function asm_dex(): void;

        function dec(): void {
          asm_dex();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_dex');
      expectAssemblyContains(result, 'DEX');
    });

    it('should compile asm_iny() to INY instruction', () => {
      const source = `
        export function asm_iny(): void;

        function inc(): void {
          asm_iny();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_iny');
      expectAssemblyContains(result, 'INY');
    });

    it('should compile asm_dey() to DEY instruction', () => {
      const source = `
        export function asm_dey(): void;

        function dec(): void {
          asm_dey();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_dey');
      expectAssemblyContains(result, 'DEY');
    });
  });

  describe('implied mode - shift/rotate accumulator', () => {
    it('should compile asm_asl() to ASL instruction', () => {
      const source = `
        export function asm_asl(): void;

        function shift(): void {
          asm_asl();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_asl');
      expectAssemblyContains(result, 'ASL');
    });

    it('should compile asm_ror() to ROR instruction', () => {
      const source = `
        export function asm_ror(): void;

        function rotate(): void {
          asm_ror();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_ror');
      expectAssemblyContains(result, 'ROR');
    });
  });

  // ── Addressed Mode Operations ──────────────────────────────────

  describe('immediate mode', () => {
    it('should compile asm_lda_imm() with literal argument', () => {
      const source = `
        export function asm_lda_imm(value: byte): void;

        function load(): void {
          asm_lda_imm(42);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_lda_imm');
      // Should contain LDA instruction somewhere in the output
      expectAssemblyContains(result, 'LDA');
    });

    it('should compile asm_ldx_imm() with literal argument', () => {
      const source = `
        export function asm_ldx_imm(value: byte): void;

        function load(): void {
          asm_ldx_imm(0);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_ldx_imm');
      // The output should contain LDX
      expectAssemblyContains(result, 'LDX');
    });
  });

  describe('absolute mode', () => {
    it('should compile asm_sta_abs() with address argument', () => {
      const source = `
        export function asm_sta_abs(addr: word): void;

        function store(): void {
          asm_sta_abs($D020);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_sta_abs');
      expectAssemblyContains(result, 'STA');
    });

    it('should compile asm_jmp_abs() with address argument', () => {
      const source = `
        export function asm_jmp_abs(addr: word): void;

        function jump(): void {
          asm_jmp_abs($C000);
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm_jmp_abs');
      expectAssemblyContains(result, 'JMP');
    });
  });

  // ── Multiple ASM Calls ─────────────────────────────────────────

  describe('multiple asm calls', () => {
    it('should compile multiple implied mode calls in sequence', () => {
      const source = `
        export function asm_sei(): void;
        export function asm_cli(): void;
        export function asm_nop(): void;

        function criticalSection(): void {
          asm_sei();
          asm_nop();
          asm_cli();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'multiple implied asm calls');
      const asm = getAssembly(result);
      // All three instructions should appear
      expect(asm).toContain('SEI');
      expect(asm).toContain('NOP');
      expect(asm).toContain('CLI');
    });

    it('should compile push/pull pair', () => {
      const source = `
        export function asm_pha(): void;
        export function asm_pla(): void;

        function savePull(): void {
          asm_pha();
          asm_pla();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'push/pull pair');
      expectAssemblyContains(result, 'PHA', 'PLA');
    });

    it('should compile register transfer chain', () => {
      const source = `
        export function asm_tax(): void;
        export function asm_tya(): void;

        function transferChain(): void {
          asm_tax();
          asm_tya();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'transfer chain');
      expectAssemblyContains(result, 'TAX', 'TYA');
    });
  });

  // ── Mixed ASM + High-Level Code ────────────────────────────────

  describe('mixed asm and high-level code', () => {
    it('should compile asm calls alongside variable declarations', () => {
      const source = `
        export function asm_sei(): void;
        export function asm_cli(): void;

        function mixed(): void {
          let x: byte = 42;
          asm_sei();
          x = x + 1;
          asm_cli();
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'mixed asm + variables');
      const asm = getAssembly(result);
      expect(asm).toContain('SEI');
      expect(asm).toContain('CLI');
    });

    it('should compile asm calls inside exported function', () => {
      const source = `
        export function asm_sei(): void;

        export function main(): void {
          asm_sei();
          let counter: byte = 0;
        }
      `;
      const result = compileBlend(source);
      expectSuccess(result, 'asm in exported function');
      expectAssemblyContains(result, 'SEI');
    });
  });
});

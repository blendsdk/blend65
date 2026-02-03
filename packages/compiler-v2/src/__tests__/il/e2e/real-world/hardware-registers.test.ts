/**
 * IL Generator E2E Test: Hardware Register Patterns
 *
 * Real-world C64 VIC-II, SID, and CIA register manipulation patterns.
 * Tests verify that hardware register access compiles to proper IL instructions.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame Allocator → IL Generator
 *
 * @module __tests__/il/e2e/real-world/hardware-registers
 */

import { describe, it, expect } from 'vitest';
import {
  compileToIL,
  countOpcode,
  hasOpcode,
  getFunction,
  getMainFunction,
} from '../../helpers/il-test-utils.js';
import { ILOpcode } from '../../../../il/enums.js';

// ============================================================================
// C64 Hardware Register Reference
// ============================================================================

// VIC-II (Video Interface Chip)
// $D000-$D02E: Sprite registers (see sprite-handling.test.ts)
// $D011: VIC Control Register 1 (RST8, ECM, BMM, DEN, RSEL, YSCROLL)
// $D012: Raster line (read) / Raster compare (write)
// $D016: VIC Control Register 2 (RES, MCM, CSEL, XSCROLL)
// $D018: Memory Control Register (screen/char memory location)
// $D019: Interrupt Register
// $D01A: Interrupt Enable Register
// $D020: Border Color
// $D021: Background Color 0

// CIA (Complex Interface Adapter)
// $DC00: CIA1 Data Port A (keyboard column / joystick port 2)
// $DC01: CIA1 Data Port B (keyboard row / joystick port 1)
// $DC04-$DC05: CIA1 Timer A (low/high)
// $DC06-$DC07: CIA1 Timer B (low/high)
// $DD00: CIA2 Data Port A (VIC bank selection)

// SID (Sound Interface Device)
// $D400-$D414: Voice 1-3 Frequency, Pulse Width, Control, ADSR
// $D415-$D417: Filter Control
// $D418: Volume and Filter Mode

// ============================================================================
// VIC-II Color Registers
// ============================================================================

describe('E2E Real-World: Hardware Register Patterns', () => {
  describe('VIC-II Color Registers', () => {
    it('should generate IL for border color change ($D020)', () => {
      const source = `
        module BorderColor;
        
        const BORDER_COLOR: word = $D020;
        
        function setBorderColor(color: byte): void {
          poke(BORDER_COLOR, color);
        }
        
        function main(): void {
          setBorderColor(0);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setBorderColor');
      expect(setFunc).toBeDefined();

      // Should have LOAD_BYTE (param) and POKE (to address via poke intrinsic)
      expect(hasOpcode(setFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(setFunc!.instructions, ILOpcode.POKE)).toBe(true);
    });

    it('should generate IL for background color change ($D021)', () => {
      const source = `
        module BackgroundColor;
        
        const BG_COLOR: word = $D021;
        
        function setBackgroundColor(color: byte): void {
          poke(BG_COLOR, color);
        }
        
        function main(): void {
          setBackgroundColor(6);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setBackgroundColor');
      expect(setFunc).toBeDefined();

      expect(hasOpcode(setFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for color cycle pattern', () => {
      const source = `
        module ColorCycle;
        
        const BORDER_COLOR: word = $D020;
        
        function cycleBorderColor(): void {
          let currentColor: byte = peek(BORDER_COLOR);
          currentColor = currentColor + 1;
          if (currentColor > 15) {
            currentColor = 0;
          }
          poke(BORDER_COLOR, currentColor);
        }
        
        function main(): void {
          cycleBorderColor();
        }
      `;

      const program = compileToIL(source);
      const cycleFunc = getFunction(program, 'cycleBorderColor');
      expect(cycleFunc).toBeDefined();

      // Should have LOAD, ADD/INC, CMP, conditional, STORE
      expect(hasOpcode(cycleFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(cycleFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);
      expect(hasOpcode(cycleFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // VIC-II Raster Register
  // ============================================================================

  describe('VIC-II Raster Register', () => {
    it('should generate IL for raster line reading ($D012)', () => {
      const source = `
        module RasterLine;
        
        const RASTER_LINE: word = $D012;
        
        function getRasterLine(): byte {
          return volatile_read(RASTER_LINE);
        }
        
        function main(): void {
          let line: byte = getRasterLine();
        }
      `;

      const program = compileToIL(source);
      const getFunc = getFunction(program, 'getRasterLine');
      expect(getFunc).toBeDefined();

      expect(hasOpcode(getFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(getFunc!.instructions, ILOpcode.RETURN)).toBe(true);
    });

    it('should generate IL for raster compare setup ($D012 with MSB in $D011)', () => {
      const source = `
        module RasterCompare;
        
        const RASTER_LINE: word = $D012;
        const VIC_CONTROL_1: word = $D011;
        
        function setRasterCompare(line: byte, msb: byte): void {
          poke(RASTER_LINE, line);
          
          if (msb > 0) {
            poke(VIC_CONTROL_1, peek(VIC_CONTROL_1) | 128);
          } else {
            poke(VIC_CONTROL_1, peek(VIC_CONTROL_1) & 127);
          }
        }
        
        function main(): void {
          setRasterCompare(100, 0);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setRasterCompare');
      expect(setFunc).toBeDefined();

      // Should have OR for setting MSB bit
      const hasOr =
        hasOpcode(setFunc!.instructions, ILOpcode.OR_IMM) ||
        hasOpcode(setFunc!.instructions, ILOpcode.OR_BYTE);
      expect(hasOr).toBe(true);

      // Should have AND for clearing MSB bit
      const hasAnd =
        hasOpcode(setFunc!.instructions, ILOpcode.AND_IMM) ||
        hasOpcode(setFunc!.instructions, ILOpcode.AND_BYTE);
      expect(hasAnd).toBe(true);
    });

    it('should generate IL for raster wait loop pattern', () => {
      const source = `
        module RasterWait;
        
        const RASTER_LINE: word = $D012;
        
        function waitForRaster(targetLine: byte): void {
          while (volatile_read(RASTER_LINE) != targetLine) {
            let wait: byte = 0;
          }
        }
        
        function main(): void {
          waitForRaster(250);
        }
      `;

      const program = compileToIL(source);
      const waitFunc = getFunction(program, 'waitForRaster');
      expect(waitFunc).toBeDefined();

      // Should have LOAD, CMP, conditional JUMP, unconditional JUMP
      expect(hasOpcode(waitFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(waitFunc!.instructions, ILOpcode.CMP_BYTE)).toBe(true);
      expect(hasOpcode(waitFunc!.instructions, ILOpcode.JUMP)).toBe(true);
    });
  });

  // ============================================================================
  // VIC-II Memory Control
  // ============================================================================

  describe('VIC-II Memory Control', () => {
    it('should generate IL for screen memory pointer ($D018)', () => {
      const source = `
        module ScreenMemory;
        
        const MEMORY_CONTROL: word = $D018;
        
        function setScreenMemory(value: byte): void {
          poke(MEMORY_CONTROL, value);
        }
        
        function main(): void {
          setScreenMemory($14);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setScreenMemory');
      expect(setFunc).toBeDefined();

      expect(hasOpcode(setFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for smooth scroll X ($D016)', () => {
      const source = `
        module SmoothScrollX;
        
        const VIC_CONTROL_2: word = $D016;
        
        function setXScroll(scroll: byte): void {
          let masked: byte = peek(VIC_CONTROL_2) & $F8;
          poke(VIC_CONTROL_2, masked | (scroll & 7));
        }
        
        function main(): void {
          setXScroll(3);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setXScroll');
      expect(setFunc).toBeDefined();

      // Should have AND for masking and OR for setting
      const hasAnd =
        hasOpcode(setFunc!.instructions, ILOpcode.AND_IMM) ||
        hasOpcode(setFunc!.instructions, ILOpcode.AND_BYTE);
      expect(hasAnd).toBe(true);

      const hasOr =
        hasOpcode(setFunc!.instructions, ILOpcode.OR_IMM) ||
        hasOpcode(setFunc!.instructions, ILOpcode.OR_BYTE);
      expect(hasOr).toBe(true);
    });

    it('should generate IL for smooth scroll Y ($D011)', () => {
      const source = `
        module SmoothScrollY;
        
        const VIC_CONTROL_1: word = $D011;
        
        function setYScroll(scroll: byte): void {
          let masked: byte = peek(VIC_CONTROL_1) & $F8;
          poke(VIC_CONTROL_1, masked | (scroll & 7));
        }
        
        function main(): void {
          setYScroll(3);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setYScroll');
      expect(setFunc).toBeDefined();

      expect(hasOpcode(setFunc!.instructions, ILOpcode.AND_IMM)).toBe(true);
    });
  });

  // ============================================================================
  // VIC-II Interrupt Control
  // ============================================================================

  describe('VIC-II Interrupt Control', () => {
    it('should generate IL for IRQ enable pattern', () => {
      const source = `
        module IRQEnable;
        
        const IRQ_CONTROL: word = $D01A;
        
        function enableRasterIRQ(): void {
          poke(IRQ_CONTROL, peek(IRQ_CONTROL) | 1);
        }
        
        function main(): void {
          enableRasterIRQ();
        }
      `;

      const program = compileToIL(source);
      const enableFunc = getFunction(program, 'enableRasterIRQ');
      expect(enableFunc).toBeDefined();

      expect(hasOpcode(enableFunc!.instructions, ILOpcode.OR_IMM)).toBe(true);
    });

    it('should generate IL for IRQ disable pattern', () => {
      const source = `
        module IRQDisable;
        
        const IRQ_CONTROL: word = $D01A;
        
        function disableAllIRQ(): void {
          poke(IRQ_CONTROL, 0);
        }
        
        function main(): void {
          disableAllIRQ();
        }
      `;

      const program = compileToIL(source);
      const disableFunc = getFunction(program, 'disableAllIRQ');
      expect(disableFunc).toBeDefined();

      expect(hasOpcode(disableFunc!.instructions, ILOpcode.LOAD_IMM)).toBe(true);
      expect(hasOpcode(disableFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for IRQ acknowledge pattern', () => {
      const source = `
        module IRQAck;
        
        const IRQ_STATUS: word = $D019;
        
        function acknowledgeRasterIRQ(): void {
          volatile_write(IRQ_STATUS, 1);
        }
        
        function main(): void {
          acknowledgeRasterIRQ();
        }
      `;

      const program = compileToIL(source);
      const ackFunc = getFunction(program, 'acknowledgeRasterIRQ');
      expect(ackFunc).toBeDefined();

      expect(hasOpcode(ackFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // CIA Timer Registers
  // ============================================================================

  describe('CIA Timer Registers', () => {
    it('should generate IL for CIA timer setup (16-bit)', () => {
      const source = `
        module CIATimer;
        
        const TIMER_A_LO: word = $DC04;
        const TIMER_A_HI: word = $DC05;
        
        function setTimerA(valueLo: byte, valueHi: byte): void {
          poke(TIMER_A_LO, valueLo);
          poke(TIMER_A_HI, valueHi);
        }
        
        function main(): void {
          setTimerA($FF, $40);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setTimerA');
      expect(setFunc).toBeDefined();

      // Should have 2 STORE_BYTE operations
      const storeCount = countOpcode(setFunc!.instructions, ILOpcode.STORE_BYTE);
      expect(storeCount).toBe(2);
    });

    it('should generate IL for CIA timer read pattern', () => {
      const source = `
        module CIATimerRead;
        
        const TIMER_A_LO: word = $DC04;
        const TIMER_A_HI: word = $DC05;
        
        function readTimerALo(): byte {
          return volatile_read(TIMER_A_LO);
        }
        
        function readTimerAHi(): byte {
          return volatile_read(TIMER_A_HI);
        }
        
        function main(): void {
          let lo: byte = readTimerALo();
          let hi: byte = readTimerAHi();
        }
      `;

      const program = compileToIL(source);
      const readLoFunc = getFunction(program, 'readTimerALo');
      const readHiFunc = getFunction(program, 'readTimerAHi');

      expect(readLoFunc).toBeDefined();
      expect(readHiFunc).toBeDefined();

      expect(hasOpcode(readLoFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(readHiFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // SID Registers
  // ============================================================================

  describe('SID Registers', () => {
    it('should generate IL for SID frequency setting (16-bit)', () => {
      const source = `
        module SIDFreq;
        
        const VOICE_1_FREQ_LO: word = $D400;
        const VOICE_1_FREQ_HI: word = $D401;
        
        function setVoice1Freq(freqLo: byte, freqHi: byte): void {
          poke(VOICE_1_FREQ_LO, freqLo);
          poke(VOICE_1_FREQ_HI, freqHi);
        }
        
        function main(): void {
          setVoice1Freq($17, $01);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setVoice1Freq');
      expect(setFunc).toBeDefined();

      const storeCount = countOpcode(setFunc!.instructions, ILOpcode.STORE_BYTE);
      expect(storeCount).toBe(2);
    });

    it('should generate IL for SID volume control', () => {
      const source = `
        module SIDVolume;
        
        const SID_VOLUME: word = $D418;
        
        function setVolume(volume: byte): void {
          poke(SID_VOLUME, volume & $0F);
        }
        
        function main(): void {
          setVolume(15);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setVolume');
      expect(setFunc).toBeDefined();

      // Should have AND for masking to 4 bits
      expect(hasOpcode(setFunc!.instructions, ILOpcode.AND_IMM)).toBe(true);
    });

    it('should generate IL for SID ADSR envelope setting', () => {
      const source = `
        module SIDADSR;
        
        const VOICE_1_AD: word = $D405;
        const VOICE_1_SR: word = $D406;
        
        function setEnvelope(attack: byte, decay: byte, sustain: byte, release: byte): void {
          poke(VOICE_1_AD, (attack * 16) + decay);
          poke(VOICE_1_SR, (sustain * 16) + release);
        }
        
        function main(): void {
          setEnvelope(0, 9, 0, 0);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setEnvelope');
      expect(setFunc).toBeDefined();

      // Should have MUL for shifting and ADD for combining
      expect(hasOpcode(setFunc!.instructions, ILOpcode.MUL_BYTE)).toBe(true);
      expect(hasOpcode(setFunc!.instructions, ILOpcode.ADD_BYTE)).toBe(true);
    });

    it('should generate IL for SID waveform selection', () => {
      const source = `
        module SIDWaveform;
        
        const VOICE_1_CONTROL: word = $D404;
        
        function setWaveform(waveform: byte): void {
          poke(VOICE_1_CONTROL, waveform);
        }
        
        function triggerNote(): void {
          poke(VOICE_1_CONTROL, peek(VOICE_1_CONTROL) | 1);
        }
        
        function releaseNote(): void {
          poke(VOICE_1_CONTROL, peek(VOICE_1_CONTROL) & 254);
        }
        
        function main(): void {
          setWaveform($21);
          triggerNote();
          releaseNote();
        }
      `;

      const program = compileToIL(source);
      const triggerFunc = getFunction(program, 'triggerNote');
      const releaseFunc = getFunction(program, 'releaseNote');

      expect(triggerFunc).toBeDefined();
      expect(releaseFunc).toBeDefined();

      // Trigger uses OR to set gate bit
      expect(hasOpcode(triggerFunc!.instructions, ILOpcode.OR_IMM)).toBe(true);
      // Release uses AND to clear gate bit
      expect(hasOpcode(releaseFunc!.instructions, ILOpcode.AND_IMM)).toBe(true);
    });

    it('should generate IL for SID filter frequency sweep', () => {
      const source = `
        module SIDFilter;
        
        const FILTER_FREQ_LO: word = $D415;
        const FILTER_FREQ_HI: word = $D416;
        
        function sweepFilter(startLo: byte, startHi: byte, endHi: byte): void {
          poke(FILTER_FREQ_LO, startLo);
          
          let currentHi: byte = startHi;
          poke(FILTER_FREQ_HI, currentHi);
          
          while (currentHi < endHi) {
            currentHi = currentHi + 1;
            poke(FILTER_FREQ_HI, currentHi);
          }
        }
        
        function main(): void {
          sweepFilter(0, 0, 64);
        }
      `;

      const program = compileToIL(source);
      const sweepFunc = getFunction(program, 'sweepFilter');
      expect(sweepFunc).toBeDefined();

      // Should have loop structure
      expect(hasOpcode(sweepFunc!.instructions, ILOpcode.LABEL)).toBe(true);
      expect(hasOpcode(sweepFunc!.instructions, ILOpcode.JUMP)).toBe(true);
      expect(hasOpcode(sweepFunc!.instructions, ILOpcode.CMP_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // CIA2 VIC Bank Selection
  // ============================================================================

  describe('CIA2 VIC Bank Selection', () => {
    it('should generate IL for VIC bank selection', () => {
      const source = `
        module VICBank;
        
        const CIA2_DATA_A: word = $DD00;
        
        function setVICBank(bank: byte): void {
          let current: byte = peek(CIA2_DATA_A) & $FC;
          poke(CIA2_DATA_A, current | (3 - bank));
        }
        
        function main(): void {
          setVICBank(3);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setVICBank');
      expect(setFunc).toBeDefined();

      // Should have AND for masking, SUB for bank calculation, OR for setting
      expect(hasOpcode(setFunc!.instructions, ILOpcode.AND_IMM)).toBe(true);
      expect(hasOpcode(setFunc!.instructions, ILOpcode.SUB_BYTE)).toBe(true);
    });
  });
});
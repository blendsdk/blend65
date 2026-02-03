/**
 * IL Generator E2E Test: Sound & Music Patterns
 *
 * Real-world C64 SID music and sound effect patterns.
 * Tests verify that sound-related code compiles to proper IL instructions.
 *
 * Pipeline: Source → Lexer → Parser → Semantic → Frame Allocator → IL Generator
 *
 * @module __tests__/il/e2e/real-world/sound-music
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
// SID (Sound Interface Device) Reference
// ============================================================================

// Voice 1: $D400-$D406
// $D400-$D401: Frequency (16-bit, lo/hi)
// $D402-$D403: Pulse Width (12-bit, lo/hi bits 0-3)
// $D404: Control Register (gate, waveform, sync, ring, test)
// $D405: Attack/Decay (hi/lo nibbles)
// $D406: Sustain/Release (hi/lo nibbles)

// Voice 2: $D407-$D40D (same layout)
// Voice 3: $D40E-$D414 (same layout)

// Global:
// $D415-$D416: Filter Cutoff Frequency
// $D417: Resonance / Filter voice enable
// $D418: Volume / Filter mode

// ============================================================================
// Single Voice Operations
// ============================================================================

describe('E2E Real-World: Sound & Music Patterns', () => {
  describe('Single Voice Operations', () => {
    it('should generate IL for single voice note trigger', () => {
      const source = `
        module VoiceTrigger;
        
        @map v1FreqLo at $D400: byte;
        @map v1FreqHi at $D401: byte;
        @map v1Control at $D404: byte;
        
        function playNote(freqLo: byte, freqHi: byte): void {
          v1FreqLo = freqLo;
          v1FreqHi = freqHi;
          v1Control = 17;
        }
        
        function main(): void {
          playNote($17, $01);
        }
      `;

      const program = compileToIL(source);
      const playFunc = getFunction(program, 'playNote');
      expect(playFunc).toBeDefined();

      // Should have 3 STORE_BYTE operations
      const storeCount = countOpcode(playFunc!.instructions, ILOpcode.STORE_BYTE);
      expect(storeCount).toBe(3);
    });

    it('should generate IL for frequency table lookup', () => {
      const source = `
        module FreqTable;
        
        let freqTableLo: byte[12] = [$17, $27, $39, $4B, $5F, $74, $8B, $A3, $BD, $D8, $F5, $14];
        let freqTableHi: byte[12] = [$01, $01, $01, $01, $01, $01, $01, $01, $01, $01, $01, $02];
        
        @map v1FreqLo at $D400: byte;
        @map v1FreqHi at $D401: byte;
        
        function setNote(noteIndex: byte): void {
          v1FreqLo = freqTableLo[noteIndex];
          v1FreqHi = freqTableHi[noteIndex];
        }
        
        function main(): void {
          setNote(0);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setNote');
      expect(setFunc).toBeDefined();

      // Should have array access
      expect(hasOpcode(setFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(setFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });

    it('should generate IL for ADSR envelope setting', () => {
      const source = `
        module ADSR;
        
        @map v1AD at $D405: byte;
        @map v1SR at $D406: byte;
        
        function setEnvelope(attack: byte, decay: byte, sustain: byte, release: byte): void {
          v1AD = (attack * 16) + decay;
          v1SR = (sustain * 16) + release;
        }
        
        function main(): void {
          setEnvelope(0, 9, 0, 0);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setEnvelope');
      expect(setFunc).toBeDefined();

      // Should have MUL for nibble packing and ADD for combining
      expect(hasOpcode(setFunc!.instructions, ILOpcode.MUL_BYTE)).toBe(true);
      expect(hasOpcode(setFunc!.instructions, ILOpcode.ADD_BYTE)).toBe(true);
    });

    it('should generate IL for waveform selection', () => {
      const source = `
        module Waveform;
        
        @map v1Control at $D404: byte;
        
        function setTriangle(): void {
          v1Control = 17;
        }
        
        function setSawtooth(): void {
          v1Control = 33;
        }
        
        function setPulse(): void {
          v1Control = 65;
        }
        
        function setNoise(): void {
          v1Control = 129;
        }
        
        function main(): void {
          setTriangle();
        }
      `;

      const program = compileToIL(source);
      const triFunc = getFunction(program, 'setTriangle');
      const sawFunc = getFunction(program, 'setSawtooth');
      const pulseFunc = getFunction(program, 'setPulse');
      const noiseFunc = getFunction(program, 'setNoise');

      expect(triFunc).toBeDefined();
      expect(sawFunc).toBeDefined();
      expect(pulseFunc).toBeDefined();
      expect(noiseFunc).toBeDefined();
    });
  });

  // ============================================================================
  // Volume Control
  // ============================================================================

  describe('Volume Control', () => {
    it('should generate IL for volume control', () => {
      const source = `
        module Volume;
        
        @map sidVolume at $D418: byte;
        
        function setVolume(vol: byte): void {
          sidVolume = vol & $0F;
        }
        
        function main(): void {
          setVolume(15);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setVolume');
      expect(setFunc).toBeDefined();

      // Should have AND for masking
      expect(hasOpcode(setFunc!.instructions, ILOpcode.AND_IMM)).toBe(true);
    });

    it('should generate IL for volume fade in', () => {
      const source = `
        module FadeIn;
        
        @map sidVolume at $D418: byte;
        
        function fadeIn(): void {
          for (let vol: byte = 0 to 15 step 1) {
            sidVolume = vol;
            
            for (let delay: byte = 0 to 255 step 1) {
              let wait: byte = 0;
            }
          }
        }
        
        function main(): void {
          fadeIn();
        }
      `;

      const program = compileToIL(source);
      const fadeFunc = getFunction(program, 'fadeIn');
      expect(fadeFunc).toBeDefined();

      // Should have nested loops
      const labelCount = countOpcode(fadeFunc!.instructions, ILOpcode.LABEL);
      expect(labelCount).toBeGreaterThanOrEqual(4);
    });

    it('should generate IL for volume fade out', () => {
      const source = `
        module FadeOut;
        
        @map sidVolume at $D418: byte;
        
        function fadeOut(): void {
          for (let vol: byte = 15 downto 0 step 1) {
            sidVolume = vol;
            
            for (let delay: byte = 0 to 255 step 1) {
              let wait: byte = 0;
            }
          }
        }
        
        function main(): void {
          fadeOut();
        }
      `;

      const program = compileToIL(source);
      const fadeFunc = getFunction(program, 'fadeOut');
      expect(fadeFunc).toBeDefined();

      // Should have decrement in loop
      const hasDec =
        hasOpcode(fadeFunc!.instructions, ILOpcode.DEC_BYTE) ||
        hasOpcode(fadeFunc!.instructions, ILOpcode.SUB_IMM);
      expect(hasDec).toBe(true);
    });
  });

  // ============================================================================
  // Filter Control
  // ============================================================================

  describe('Filter Control', () => {
    it('should generate IL for filter frequency sweep', () => {
      const source = `
        module FilterSweep;
        
        @map filterLo at $D415: byte;
        @map filterHi at $D416: byte;
        
        function sweepFilter(startHi: byte, endHi: byte): void {
          filterLo = 0;
          filterHi = startHi;
          
          while (filterHi < endHi) {
            filterHi = filterHi + 1;
          }
        }
        
        function main(): void {
          sweepFilter(0, 64);
        }
      `;

      const program = compileToIL(source);
      const sweepFunc = getFunction(program, 'sweepFilter');
      expect(sweepFunc).toBeDefined();

      // Should have loop
      expect(hasOpcode(sweepFunc!.instructions, ILOpcode.LABEL)).toBe(true);
      expect(hasOpcode(sweepFunc!.instructions, ILOpcode.JUMP)).toBe(true);
    });

    it('should generate IL for filter mode and resonance', () => {
      const source = `
        module FilterMode;
        
        @map filterRes at $D417: byte;
        @map volumeFilter at $D418: byte;
        
        function setLowPass(resonance: byte, voiceMask: byte): void {
          filterRes = (resonance * 16) | voiceMask;
          volumeFilter = volumeFilter | $10;
        }
        
        function setHighPass(resonance: byte, voiceMask: byte): void {
          filterRes = (resonance * 16) | voiceMask;
          volumeFilter = volumeFilter | $40;
        }
        
        function main(): void {
          setLowPass(8, 1);
        }
      `;

      const program = compileToIL(source);
      const lowFunc = getFunction(program, 'setLowPass');
      expect(lowFunc).toBeDefined();

      // Should have MUL, OR
      expect(hasOpcode(lowFunc!.instructions, ILOpcode.MUL_BYTE)).toBe(true);
      expect(hasOpcode(lowFunc!.instructions, ILOpcode.OR_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // Multi-Voice
  // ============================================================================

  describe('Multi-Voice Operations', () => {
    it('should generate IL for multi-voice note trigger', () => {
      const source = `
        module MultiVoice;
        
        @map v1FreqLo at $D400: byte;
        @map v1FreqHi at $D401: byte;
        @map v1Control at $D404: byte;
        
        @map v2FreqLo at $D407: byte;
        @map v2FreqHi at $D408: byte;
        @map v2Control at $D40B: byte;
        
        @map v3FreqLo at $D40E: byte;
        @map v3FreqHi at $D40F: byte;
        @map v3Control at $D412: byte;
        
        function playChord(f1Lo: byte, f1Hi: byte, f2Lo: byte, f2Hi: byte, f3Lo: byte, f3Hi: byte): void {
          v1FreqLo = f1Lo;
          v1FreqHi = f1Hi;
          v2FreqLo = f2Lo;
          v2FreqHi = f2Hi;
          v3FreqLo = f3Lo;
          v3FreqHi = f3Hi;
          
          v1Control = 17;
          v2Control = 17;
          v3Control = 17;
        }
        
        function main(): void {
          playChord($17, $01, $1F, $01, $27, $01);
        }
      `;

      const program = compileToIL(source);
      const playFunc = getFunction(program, 'playChord');
      expect(playFunc).toBeDefined();

      // Should have 9 STORE_BYTE operations
      const storeCount = countOpcode(playFunc!.instructions, ILOpcode.STORE_BYTE);
      expect(storeCount).toBe(9);
    });
  });

  // ============================================================================
  // Sound Effects
  // ============================================================================

  describe('Sound Effect Patterns', () => {
    it('should generate IL for sound effect trigger pattern', () => {
      const source = `
        module SFX;
        
        @map v3FreqLo at $D40E: byte;
        @map v3FreqHi at $D40F: byte;
        @map v3AD at $D412: byte;
        @map v3SR at $D413: byte;
        @map v3Control at $D411: byte;
        
        function playSFX(freqLo: byte, freqHi: byte): void {
          v3FreqLo = freqLo;
          v3FreqHi = freqHi;
          v3AD = $00;
          v3SR = $F0;
          v3Control = 129;
          v3Control = 128;
        }
        
        function main(): void {
          playSFX($00, $10);
        }
      `;

      const program = compileToIL(source);
      const playFunc = getFunction(program, 'playSFX');
      expect(playFunc).toBeDefined();

      // Should have 6 STORE_BYTE operations
      const storeCount = countOpcode(playFunc!.instructions, ILOpcode.STORE_BYTE);
      expect(storeCount).toBe(6);
    });

    it('should generate IL for pitch slide effect', () => {
      const source = `
        module PitchSlide;
        
        @map v1FreqLo at $D400: byte;
        @map v1FreqHi at $D401: byte;
        
        function slideUp(startHi: byte, endHi: byte): void {
          v1FreqLo = 0;
          v1FreqHi = startHi;
          
          while (v1FreqHi < endHi) {
            v1FreqHi = v1FreqHi + 1;
            
            for (let delay: byte = 0 to 10 step 1) {
              let wait: byte = 0;
            }
          }
        }
        
        function main(): void {
          slideUp(1, 32);
        }
      `;

      const program = compileToIL(source);
      const slideFunc = getFunction(program, 'slideUp');
      expect(slideFunc).toBeDefined();

      // Should have nested loops
      const labelCount = countOpcode(slideFunc!.instructions, ILOpcode.LABEL);
      expect(labelCount).toBeGreaterThanOrEqual(4);
    });
  });

  // ============================================================================
  // Music Player Patterns
  // ============================================================================

  describe('Music Player Patterns', () => {
    it('should generate IL for simple music sequencer', () => {
      const source = `
        module Sequencer;
        
        let sequence: byte[8] = [0, 2, 4, 5, 7, 5, 4, 2];
        let seqPos: byte = 0;
        
        @map v1FreqLo at $D400: byte;
        
        function nextNote(): void {
          v1FreqLo = sequence[seqPos];
          seqPos = seqPos + 1;
          if (seqPos >= 8) {
            seqPos = 0;
          }
        }
        
        function main(): void {
          nextNote();
        }
      `;

      const program = compileToIL(source);
      const nextFunc = getFunction(program, 'nextNote');
      expect(nextFunc).toBeDefined();

      // Should have array access, increment, comparison
      expect(hasOpcode(nextFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(nextFunc!.instructions, ILOpcode.CMP_IMM)).toBe(true);
    });

    it('should generate IL for tempo-based tick pattern', () => {
      const source = `
        module Tempo;
        
        let tickCounter: byte = 0;
        let tempo: byte = 6;
        
        function musicTick(): byte {
          tickCounter = tickCounter + 1;
          if (tickCounter >= tempo) {
            tickCounter = 0;
            return 1;
          }
          return 0;
        }
        
        function main(): void {
          let advance: byte = musicTick();
        }
      `;

      const program = compileToIL(source);
      const tickFunc = getFunction(program, 'musicTick');
      expect(tickFunc).toBeDefined();

      // Should have increment and comparison
      const hasInc =
        hasOpcode(tickFunc!.instructions, ILOpcode.ADD_IMM) ||
        hasOpcode(tickFunc!.instructions, ILOpcode.INC_BYTE);
      expect(hasInc).toBe(true);
      expect(hasOpcode(tickFunc!.instructions, ILOpcode.CMP_BYTE)).toBe(true);
    });
  });

  // ============================================================================
  // SID Initialization
  // ============================================================================

  describe('SID Initialization', () => {
    it('should generate IL for SID reset/init', () => {
      const source = `
        module SIDInit;
        
        let sidRegs: byte[25] = [];
        
        function initSID(): void {
          for (let i: byte = 0 to 24 step 1) {
            sidRegs[i] = 0;
          }
        }
        
        function main(): void {
          initSID();
        }
      `;

      const program = compileToIL(source);
      const initFunc = getFunction(program, 'initSID');
      expect(initFunc).toBeDefined();

      // Should have loop with store
      expect(hasOpcode(initFunc!.instructions, ILOpcode.LABEL)).toBe(true);
      expect(hasOpcode(initFunc!.instructions, ILOpcode.STORE_BYTE)).toBe(true);
    });
  });
});
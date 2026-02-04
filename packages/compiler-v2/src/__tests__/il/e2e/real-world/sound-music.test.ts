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
        
        const V1_FREQ_LO: word = $D400;
        const V1_FREQ_HI: word = $D401;
        const V1_CONTROL: word = $D404;
        
        function playNote(freqLo: byte, freqHi: byte): void {
          poke(V1_FREQ_LO, freqLo);
          poke(V1_FREQ_HI, freqHi);
          poke(V1_CONTROL, 17);
        }
        
        function main(): void {
          playNote($17, $01);
        }
      `;

      const program = compileToIL(source);
      const playFunc = getFunction(program, 'playNote');
      expect(playFunc).toBeDefined();

      // poke() intrinsic generates POKE opcode - should have 3 POKE operations
      const pokeCount = countOpcode(playFunc!.instructions, ILOpcode.POKE);
      expect(pokeCount).toBe(3);
    });

    it('should generate IL for frequency table lookup', () => {
      const source = `
        module FreqTable;
        
        let freqTableLo: byte[12] = [$17, $27, $39, $4B, $5F, $74, $8B, $A3, $BD, $D8, $F5, $14];
        let freqTableHi: byte[12] = [$01, $01, $01, $01, $01, $01, $01, $01, $01, $01, $01, $02];
        
        const V1_FREQ_LO: word = $D400;
        const V1_FREQ_HI: word = $D401;
        
        function setNote(noteIndex: byte): void {
          poke(V1_FREQ_LO, freqTableLo[noteIndex]);
          poke(V1_FREQ_HI, freqTableHi[noteIndex]);
        }
        
        function main(): void {
          setNote(0);
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setNote');
      expect(setFunc).toBeDefined();

      // Should have array access and POKE via poke() intrinsic
      expect(hasOpcode(setFunc!.instructions, ILOpcode.LOAD_BYTE)).toBe(true);
      expect(hasOpcode(setFunc!.instructions, ILOpcode.POKE)).toBe(true);
    });

    it('should generate IL for ADSR envelope setting', () => {
      // Use module-level variables so they get memory slots (not register params)
      // which allows MUL_BYTE to be generated
      const source = `
        module ADSR;
        
        const V1_AD: word = $D405;
        const V1_SR: word = $D406;
        
        let attack: byte = 0;
        let decay: byte = 9;
        let sustain: byte = 0;
        let release: byte = 0;
        
        function setEnvelope(): void {
          poke(V1_AD, (attack * 16) + decay);
          poke(V1_SR, (sustain * 16) + release);
        }
        
        function main(): void {
          setEnvelope();
        }
      `;

      const program = compileToIL(source);
      const setFunc = getFunction(program, 'setEnvelope');
      expect(setFunc).toBeDefined();

      // Should have MUL for nibble packing and ADD for combining
      // Note: With module-level variables as slots, MUL_IMM is generated for * 16
      expect(hasOpcode(setFunc!.instructions, ILOpcode.MUL_IMM)).toBe(true);
      expect(hasOpcode(setFunc!.instructions, ILOpcode.ADD_BYTE)).toBe(true);
    });

    it('should generate IL for waveform selection', () => {
      const source = `
        module Waveform;
        
        const V1_CONTROL: word = $D404;
        
        function setTriangle(): void {
          poke(V1_CONTROL, 17);
        }
        
        function setSawtooth(): void {
          poke(V1_CONTROL, 33);
        }
        
        function setPulse(): void {
          poke(V1_CONTROL, 65);
        }
        
        function setNoise(): void {
          poke(V1_CONTROL, 129);
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
        
        const SID_VOLUME: word = $D418;
        
        function setVolume(vol: byte): void {
          poke(SID_VOLUME, vol & $0F);
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
        
        const SID_VOLUME: word = $D418;
        
        function fadeIn(): void {
          for (let vol: byte = 0 to 15 step 1) {
            poke(SID_VOLUME, vol);
            
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
        
        const SID_VOLUME: word = $D418;
        
        function fadeOut(): void {
          for (let vol: byte = 15 downto 0 step 1) {
            poke(SID_VOLUME, vol);
            
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
        
        const FILTER_LO: word = $D415;
        const FILTER_HI: word = $D416;
        
        function sweepFilter(startHi: byte, endHi: byte): void {
          poke(FILTER_LO, 0);
          
          let currentHi: byte = startHi;
          poke(FILTER_HI, currentHi);
          
          while (currentHi < endHi) {
            currentHi = currentHi + 1;
            poke(FILTER_HI, currentHi);
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
      // Use module-level variables for resonance/voiceMask so MUL_BYTE is generated
      const source = `
        module FilterMode;
        
        const FILTER_RES: word = $D417;
        const VOLUME_FILTER: word = $D418;
        
        let resonance: byte = 8;
        let voiceMask: byte = 1;
        
        function setLowPass(): void {
          poke(FILTER_RES, (resonance * 16) | voiceMask);
          poke(VOLUME_FILTER, peek(VOLUME_FILTER) | $10);
        }
        
        function main(): void {
          setLowPass();
        }
      `;

      const program = compileToIL(source);
      const lowFunc = getFunction(program, 'setLowPass');
      expect(lowFunc).toBeDefined();

      // Should have MUL_IMM (multiply by 16), OR (with module-level vars as slots)
      expect(hasOpcode(lowFunc!.instructions, ILOpcode.MUL_IMM)).toBe(true);
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
        
        const V1_FREQ_LO: word = $D400;
        const V1_FREQ_HI: word = $D401;
        const V1_CONTROL: word = $D404;
        
        const V2_FREQ_LO: word = $D407;
        const V2_FREQ_HI: word = $D408;
        const V2_CONTROL: word = $D40B;
        
        const V3_FREQ_LO: word = $D40E;
        const V3_FREQ_HI: word = $D40F;
        const V3_CONTROL: word = $D412;
        
        function playChord(f1Lo: byte, f1Hi: byte, f2Lo: byte, f2Hi: byte, f3Lo: byte, f3Hi: byte): void {
          poke(V1_FREQ_LO, f1Lo);
          poke(V1_FREQ_HI, f1Hi);
          poke(V2_FREQ_LO, f2Lo);
          poke(V2_FREQ_HI, f2Hi);
          poke(V3_FREQ_LO, f3Lo);
          poke(V3_FREQ_HI, f3Hi);
          
          poke(V1_CONTROL, 17);
          poke(V2_CONTROL, 17);
          poke(V3_CONTROL, 17);
        }
        
        function main(): void {
          playChord($17, $01, $1F, $01, $27, $01);
        }
      `;

      const program = compileToIL(source);
      const playFunc = getFunction(program, 'playChord');
      expect(playFunc).toBeDefined();

      // poke() intrinsic generates POKE opcode - should have 9 POKE operations
      const pokeCount = countOpcode(playFunc!.instructions, ILOpcode.POKE);
      expect(pokeCount).toBe(9);
    });
  });

  // ============================================================================
  // Sound Effects
  // ============================================================================

  describe('Sound Effect Patterns', () => {
    it('should generate IL for sound effect trigger pattern', () => {
      const source = `
        module SFX;
        
        const V3_FREQ_LO: word = $D40E;
        const V3_FREQ_HI: word = $D40F;
        const V3_AD: word = $D412;
        const V3_SR: word = $D413;
        const V3_CONTROL: word = $D411;
        
        function playSFX(freqLo: byte, freqHi: byte): void {
          poke(V3_FREQ_LO, freqLo);
          poke(V3_FREQ_HI, freqHi);
          poke(V3_AD, $00);
          poke(V3_SR, $F0);
          poke(V3_CONTROL, 129);
          poke(V3_CONTROL, 128);
        }
        
        function main(): void {
          playSFX($00, $10);
        }
      `;

      const program = compileToIL(source);
      const playFunc = getFunction(program, 'playSFX');
      expect(playFunc).toBeDefined();

      // poke() intrinsic generates POKE opcode - should have 6 POKE operations
      const pokeCount = countOpcode(playFunc!.instructions, ILOpcode.POKE);
      expect(pokeCount).toBe(6);
    });

    it('should generate IL for pitch slide effect', () => {
      const source = `
        module PitchSlide;
        
        const V1_FREQ_LO: word = $D400;
        const V1_FREQ_HI: word = $D401;
        
        function slideUp(startHi: byte, endHi: byte): void {
          poke(V1_FREQ_LO, 0);
          
          let currentHi: byte = startHi;
          poke(V1_FREQ_HI, currentHi);
          
          while (currentHi < endHi) {
            currentHi = currentHi + 1;
            poke(V1_FREQ_HI, currentHi);
            
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
        
        const V1_FREQ_LO: word = $D400;
        
        function nextNote(): void {
          poke(V1_FREQ_LO, sequence[seqPos]);
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
        
        let sidRegs: byte[25] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        
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
/**
 * SID Conflict Analyzer Tests
 *
 * Tests for Phase 8 Tier 4 - SID resource conflict analysis
 * Task 8.16: SID Voice and Filter Conflict Detection
 *
 * These tests cover realistic C64 game development scenarios:
 * - Music player voice allocation
 * - Sound effects on dedicated voices
 * - Filter sweeps for SFX
 * - Voice conflicts between music and SFX
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SIDConflictAnalyzer,
  SID_REGISTERS,
  SID_BASE,
  SID_VOICE_OFFSET,
  SID_ADDRESS_RANGE,
  SIDRegisterType,
  SIDFilterMode,
  isSIDAddress,
  isSIDVoiceRegister,
  isSIDFilterRegister,
  isSIDVolumeRegister,
  getVoiceForAddress,
  getSIDRegisterInfo,
  getFilteredVoices,
  getFilterMode,
  getVolume,
  type SIDVoiceNumber,
  type VoiceConflict,
  type FilterConflict,
} from '../../../../../semantic/analysis/hardware/c64/sid-conflicts.js';
import { C64_CONFIG } from '../../../../../target/configs/c64.js';
import type { SourceLocation } from '../../../../../ast/base.js';

describe('SID Conflict Analyzer', () => {
  let analyzer: SIDConflictAnalyzer;

  // Helper to create a mock source location
  const createMockLocation = (line = 1, column = 1): SourceLocation => ({
    start: { line, column, offset: 0 },
    end: { line, column: column + 10, offset: 10 },
  });

  beforeEach(() => {
    analyzer = new SIDConflictAnalyzer(C64_CONFIG);
  });

  // ============================================
  // SID Register Constants Tests
  // ============================================

  describe('SID Register Constants', () => {
    it('should have correct SID base address ($D400)', () => {
      expect(SID_BASE).toBe(0xd400);
    });

    it('should have correct voice offset (7 registers per voice)', () => {
      expect(SID_VOICE_OFFSET).toBe(7);
    });

    it('should have correct address range', () => {
      expect(SID_ADDRESS_RANGE.START).toBe(0xd400);
      expect(SID_ADDRESS_RANGE.END).toBe(0xd41c);
    });

    describe('Voice 1 Registers', () => {
      it('should have correct Voice 1 frequency low ($D400)', () => {
        expect(SID_REGISTERS.VOICE1_FREQ_LO).toBe(0xd400);
      });

      it('should have correct Voice 1 frequency high ($D401)', () => {
        expect(SID_REGISTERS.VOICE1_FREQ_HI).toBe(0xd401);
      });

      it('should have correct Voice 1 control ($D404)', () => {
        expect(SID_REGISTERS.VOICE1_CONTROL).toBe(0xd404);
      });

      it('should have correct Voice 1 AD ($D405)', () => {
        expect(SID_REGISTERS.VOICE1_AD).toBe(0xd405);
      });

      it('should have correct Voice 1 SR ($D406)', () => {
        expect(SID_REGISTERS.VOICE1_SR).toBe(0xd406);
      });
    });

    describe('Voice 2 Registers', () => {
      it('should have correct Voice 2 frequency low ($D407)', () => {
        expect(SID_REGISTERS.VOICE2_FREQ_LO).toBe(0xd407);
      });

      it('should have correct Voice 2 control ($D40B)', () => {
        expect(SID_REGISTERS.VOICE2_CONTROL).toBe(0xd40b);
      });
    });

    describe('Voice 3 Registers', () => {
      it('should have correct Voice 3 frequency low ($D40E)', () => {
        expect(SID_REGISTERS.VOICE3_FREQ_LO).toBe(0xd40e);
      });

      it('should have correct Voice 3 control ($D412)', () => {
        expect(SID_REGISTERS.VOICE3_CONTROL).toBe(0xd412);
      });
    });

    describe('Filter and Volume Registers', () => {
      it('should have correct filter cutoff low ($D415)', () => {
        expect(SID_REGISTERS.FILTER_CUTOFF_LO).toBe(0xd415);
      });

      it('should have correct filter cutoff high ($D416)', () => {
        expect(SID_REGISTERS.FILTER_CUTOFF_HI).toBe(0xd416);
      });

      it('should have correct filter resonance ($D417)', () => {
        expect(SID_REGISTERS.FILTER_RESONANCE).toBe(0xd417);
      });

      it('should have correct volume/mode ($D418)', () => {
        expect(SID_REGISTERS.VOLUME_MODE).toBe(0xd418);
      });
    });

    describe('Read-Only Registers', () => {
      it('should have correct Voice 3 waveform output ($D41B)', () => {
        expect(SID_REGISTERS.VOICE3_WAVEFORM).toBe(0xd41b);
      });

      it('should have correct Voice 3 envelope output ($D41C)', () => {
        expect(SID_REGISTERS.VOICE3_ENVELOPE).toBe(0xd41c);
      });
    });
  });

  // ============================================
  // Helper Function Tests
  // ============================================

  describe('isSIDAddress()', () => {
    it('should return true for SID base address', () => {
      expect(isSIDAddress(0xd400)).toBe(true);
    });

    it('should return true for last SID register', () => {
      expect(isSIDAddress(0xd41c)).toBe(true);
    });

    it('should return true for Voice 2 control', () => {
      expect(isSIDAddress(0xd40b)).toBe(true);
    });

    it('should return false for address before SID', () => {
      expect(isSIDAddress(0xd3ff)).toBe(false);
    });

    it('should return false for address after SID', () => {
      expect(isSIDAddress(0xd41d)).toBe(false);
    });

    it('should return false for VIC-II address', () => {
      expect(isSIDAddress(0xd020)).toBe(false);
    });
  });

  describe('getVoiceForAddress()', () => {
    it('should return 0 for Voice 1 registers ($D400-$D406)', () => {
      expect(getVoiceForAddress(0xd400)).toBe(0);
      expect(getVoiceForAddress(0xd404)).toBe(0);
      expect(getVoiceForAddress(0xd406)).toBe(0);
    });

    it('should return 1 for Voice 2 registers ($D407-$D40D)', () => {
      expect(getVoiceForAddress(0xd407)).toBe(1);
      expect(getVoiceForAddress(0xd40b)).toBe(1);
      expect(getVoiceForAddress(0xd40d)).toBe(1);
    });

    it('should return 2 for Voice 3 registers ($D40E-$D414)', () => {
      expect(getVoiceForAddress(0xd40e)).toBe(2);
      expect(getVoiceForAddress(0xd412)).toBe(2);
      expect(getVoiceForAddress(0xd414)).toBe(2);
    });

    it('should return null for filter registers', () => {
      expect(getVoiceForAddress(0xd415)).toBeNull();
      expect(getVoiceForAddress(0xd416)).toBeNull();
      expect(getVoiceForAddress(0xd417)).toBeNull();
    });

    it('should return null for volume register', () => {
      expect(getVoiceForAddress(0xd418)).toBeNull();
    });
  });

  describe('isSIDVoiceRegister()', () => {
    it('should return true for voice registers', () => {
      expect(isSIDVoiceRegister(0xd400)).toBe(true);
      expect(isSIDVoiceRegister(0xd407)).toBe(true);
      expect(isSIDVoiceRegister(0xd40e)).toBe(true);
    });

    it('should return false for filter registers', () => {
      expect(isSIDVoiceRegister(0xd415)).toBe(false);
      expect(isSIDVoiceRegister(0xd417)).toBe(false);
    });

    it('should return false for volume register', () => {
      expect(isSIDVoiceRegister(0xd418)).toBe(false);
    });
  });

  describe('isSIDFilterRegister()', () => {
    it('should return true for filter cutoff low', () => {
      expect(isSIDFilterRegister(0xd415)).toBe(true);
    });

    it('should return true for filter cutoff high', () => {
      expect(isSIDFilterRegister(0xd416)).toBe(true);
    });

    it('should return true for filter resonance', () => {
      expect(isSIDFilterRegister(0xd417)).toBe(true);
    });

    it('should return false for voice registers', () => {
      expect(isSIDFilterRegister(0xd400)).toBe(false);
    });

    it('should return false for volume register', () => {
      expect(isSIDFilterRegister(0xd418)).toBe(false);
    });
  });

  describe('isSIDVolumeRegister()', () => {
    it('should return true for volume register', () => {
      expect(isSIDVolumeRegister(0xd418)).toBe(true);
    });

    it('should return false for filter registers', () => {
      expect(isSIDVolumeRegister(0xd417)).toBe(false);
    });

    it('should return false for voice registers', () => {
      expect(isSIDVolumeRegister(0xd404)).toBe(false);
    });
  });

  describe('getSIDRegisterInfo()', () => {
    it('should return frequency info for Voice 1 freq low', () => {
      const info = getSIDRegisterInfo(0xd400);
      expect(info).not.toBeNull();
      expect(info?.type).toBe(SIDRegisterType.FREQUENCY);
      expect(info?.voice).toBe(0);
      expect(info?.readOnly).toBe(false);
    });

    it('should return control info for Voice 2 control', () => {
      const info = getSIDRegisterInfo(0xd40b);
      expect(info).not.toBeNull();
      expect(info?.type).toBe(SIDRegisterType.CONTROL);
      expect(info?.voice).toBe(1);
    });

    it('should return envelope info for Voice 3 AD', () => {
      const info = getSIDRegisterInfo(0xd413);
      expect(info).not.toBeNull();
      expect(info?.type).toBe(SIDRegisterType.ENVELOPE);
      expect(info?.voice).toBe(2);
    });

    it('should return filter cutoff info', () => {
      const info = getSIDRegisterInfo(0xd415);
      expect(info).not.toBeNull();
      expect(info?.type).toBe(SIDRegisterType.FILTER_CUTOFF);
      expect(info?.voice).toBeNull();
    });

    it('should return volume/mode info', () => {
      const info = getSIDRegisterInfo(0xd418);
      expect(info).not.toBeNull();
      expect(info?.type).toBe(SIDRegisterType.VOLUME_MODE);
      expect(info?.voice).toBeNull();
    });

    it('should return read-only info for Voice 3 waveform output', () => {
      const info = getSIDRegisterInfo(0xd41b);
      expect(info).not.toBeNull();
      expect(info?.type).toBe(SIDRegisterType.READ_ONLY);
      expect(info?.readOnly).toBe(true);
    });

    it('should return null for non-SID address', () => {
      const info = getSIDRegisterInfo(0xd020);
      expect(info).toBeNull();
    });
  });

  describe('getFilteredVoices()', () => {
    it('should return empty set for no voices filtered', () => {
      const voices = getFilteredVoices(0x00);
      expect(voices.size).toBe(0);
    });

    it('should return Voice 1 when bit 0 is set', () => {
      const voices = getFilteredVoices(0x01);
      expect(voices.has(0)).toBe(true);
      expect(voices.size).toBe(1);
    });

    it('should return Voice 2 when bit 1 is set', () => {
      const voices = getFilteredVoices(0x02);
      expect(voices.has(1)).toBe(true);
      expect(voices.size).toBe(1);
    });

    it('should return Voice 3 when bit 2 is set', () => {
      const voices = getFilteredVoices(0x04);
      expect(voices.has(2)).toBe(true);
      expect(voices.size).toBe(1);
    });

    it('should return all voices when bits 0-2 are set', () => {
      const voices = getFilteredVoices(0x07);
      expect(voices.has(0)).toBe(true);
      expect(voices.has(1)).toBe(true);
      expect(voices.has(2)).toBe(true);
      expect(voices.size).toBe(3);
    });

    it('should ignore resonance bits (4-7)', () => {
      // $F7 = high resonance + all voices filtered
      const voices = getFilteredVoices(0xf7);
      expect(voices.size).toBe(3);
    });
  });

  describe('getFilterMode()', () => {
    it('should return OFF when no mode bits set', () => {
      expect(getFilterMode(0x0f)).toBe(SIDFilterMode.OFF);
    });

    it('should return LOW_PASS when bit 4 set', () => {
      expect(getFilterMode(0x1f)).toBe(SIDFilterMode.LOW_PASS);
    });

    it('should return BAND_PASS when bit 5 set', () => {
      expect(getFilterMode(0x2f)).toBe(SIDFilterMode.BAND_PASS);
    });

    it('should return HIGH_PASS when bit 6 set', () => {
      expect(getFilterMode(0x4f)).toBe(SIDFilterMode.HIGH_PASS);
    });

    it('should return COMBINED when multiple mode bits set', () => {
      expect(getFilterMode(0x7f)).toBe(SIDFilterMode.COMBINED);
    });
  });

  describe('getVolume()', () => {
    it('should return 0 for minimum volume', () => {
      expect(getVolume(0x00)).toBe(0);
    });

    it('should return 15 for maximum volume', () => {
      expect(getVolume(0x0f)).toBe(15);
      expect(getVolume(0xff)).toBe(15); // Ignores mode bits
    });

    it('should extract volume correctly with filter mode', () => {
      expect(getVolume(0x1a)).toBe(10); // Low-pass + volume 10
    });
  });

  // ============================================
  // Voice Usage Tracking Tests
  // ============================================

  describe('Voice Usage Tracking', () => {
    describe('trackVoiceWrite()', () => {
      it('should track single voice write from one function', () => {
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_LO, 'playNote', createMockLocation());

        const usage = analyzer.getVoiceUsage(0);
        expect(usage).toBeDefined();
        expect(usage?.usedBy).toContain('playNote');
        expect(usage?.registers.has(SID_REGISTERS.VOICE1_FREQ_LO)).toBe(true);
      });

      it('should track multiple writes from same function', () => {
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_LO, 'playNote', createMockLocation(1));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_HI, 'playNote', createMockLocation(2));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'playNote', createMockLocation(3));

        const usage = analyzer.getVoiceUsage(0);
        expect(usage?.usedBy).toHaveLength(1);
        expect(usage?.usedBy).toContain('playNote');
        expect(usage?.registers.size).toBe(3);
      });

      it('should track writes from multiple functions to same voice', () => {
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_LO, 'musicPlayer', createMockLocation(1));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_LO, 'playSFX', createMockLocation(2));

        const usage = analyzer.getVoiceUsage(0);
        expect(usage?.usedBy).toHaveLength(2);
        expect(usage?.usedBy).toContain('musicPlayer');
        expect(usage?.usedBy).toContain('playSFX');
      });

      it('should track writes to different voices independently', () => {
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'musicVoice1', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'musicVoice2', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'sfxVoice', createMockLocation());

        expect(analyzer.getVoiceUsage(0)?.usedBy).toContain('musicVoice1');
        expect(analyzer.getVoiceUsage(1)?.usedBy).toContain('musicVoice2');
        expect(analyzer.getVoiceUsage(2)?.usedBy).toContain('sfxVoice');
      });

      it('should record first write location', () => {
        const firstLocation = createMockLocation(10, 5);
        const secondLocation = createMockLocation(20, 10);

        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_LO, 'playNote', firstLocation);
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_HI, 'playNote', secondLocation);

        const usage = analyzer.getVoiceUsage(0);
        expect(usage?.firstWriteLocation).toBe(firstLocation);
      });

      it('should ignore non-voice registers', () => {
        analyzer.trackVoiceWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'setFilter', createMockLocation());

        expect(analyzer.isVoiceUsed(0)).toBe(false);
        expect(analyzer.isVoiceUsed(1)).toBe(false);
        expect(analyzer.isVoiceUsed(2)).toBe(false);
      });
    });

    describe('trackVoiceWriteRange()', () => {
      it('should track range covering Voice 1 registers', () => {
        analyzer.trackVoiceWriteRange(0xd400, 0xd406, 'initVoice1', createMockLocation());

        const usage = analyzer.getVoiceUsage(0);
        expect(usage?.usedBy).toContain('initVoice1');
        expect(usage?.registers.size).toBe(7); // All Voice 1 registers
      });

      it('should track range spanning multiple voices', () => {
        // Range from Voice 1 to Voice 2
        analyzer.trackVoiceWriteRange(0xd400, 0xd40d, 'initAllVoices', createMockLocation());

        expect(analyzer.isVoiceUsed(0)).toBe(true);
        expect(analyzer.isVoiceUsed(1)).toBe(true);
        expect(analyzer.isVoiceUsed(2)).toBe(false);
      });

      it('should ignore non-voice registers in range', () => {
        // Range includes filter registers
        analyzer.trackVoiceWriteRange(0xd414, 0xd418, 'initAudio', createMockLocation());

        // Only Voice 3 SR ($D414) should be tracked
        expect(analyzer.isVoiceUsed(2)).toBe(true);
        expect(analyzer.getVoiceUsage(2)?.registers.size).toBe(1);
      });
    });

    describe('Voice Usage Queries', () => {
      it('should return false for unused voice', () => {
        expect(analyzer.isVoiceUsed(0)).toBe(false);
        expect(analyzer.isVoiceUsed(1)).toBe(false);
        expect(analyzer.isVoiceUsed(2)).toBe(false);
      });

      it('should return correct used voice count', () => {
        expect(analyzer.getUsedVoiceCount()).toBe(0);

        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'music', createMockLocation());
        expect(analyzer.getUsedVoiceCount()).toBe(1);

        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'music', createMockLocation());
        expect(analyzer.getUsedVoiceCount()).toBe(2);

        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'sfx', createMockLocation());
        expect(analyzer.getUsedVoiceCount()).toBe(3);
      });

      it('should return set of used voices', () => {
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'music', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'sfx', createMockLocation());

        const usedVoices = analyzer.getUsedVoices();
        expect(usedVoices.has(0)).toBe(true);
        expect(usedVoices.has(1)).toBe(false);
        expect(usedVoices.has(2)).toBe(true);
      });
    });
  });

  // ============================================
  // Filter Usage Tracking Tests
  // ============================================

  describe('Filter Usage Tracking', () => {
    describe('trackFilterWrite()', () => {
      it('should track filter cutoff write', () => {
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'setFilter', createMockLocation());

        const usage = analyzer.getFilterUsage();
        expect(usage.usedBy).toContain('setFilter');
        expect(usage.cutoffModified).toBe(true);
      });

      it('should track filter resonance write', () => {
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_RESONANCE, 'setFilter', createMockLocation());

        const usage = analyzer.getFilterUsage();
        expect(usage.resonanceModified).toBe(true);
      });

      it('should extract voice routing from resonance write', () => {
        // $F7 = high resonance, filter Voice 1, 2, 3
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_RESONANCE, 'setFilter', createMockLocation(), 0xf7);

        const usage = analyzer.getFilterUsage();
        expect(usage.routedVoices.size).toBe(3);
        expect(usage.routedVoices.has(0)).toBe(true);
        expect(usage.routedVoices.has(1)).toBe(true);
        expect(usage.routedVoices.has(2)).toBe(true);
      });

      it('should track multiple functions modifying filter', () => {
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'musicFilter', createMockLocation());
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_HI, 'sfxFilter', createMockLocation());

        const usage = analyzer.getFilterUsage();
        expect(usage.usedBy).toContain('musicFilter');
        expect(usage.usedBy).toContain('sfxFilter');
      });
    });

    describe('trackVolumeWrite()', () => {
      it('should track volume write', () => {
        analyzer.trackVolumeWrite('setVolume', createMockLocation());

        expect(analyzer.hasVolumeConflict()).toBe(false);
      });

      it('should detect volume conflict with multiple functions', () => {
        analyzer.trackVolumeWrite('musicVolume', createMockLocation());
        analyzer.trackVolumeWrite('sfxVolume', createMockLocation());

        expect(analyzer.hasVolumeConflict()).toBe(true);
      });

      it('should extract filter mode from volume write', () => {
        // $1F = low-pass filter + max volume
        analyzer.trackVolumeWrite('setVolume', createMockLocation(), 0x1f);

        const usage = analyzer.getFilterUsage();
        expect(usage.filterMode).toBe(SIDFilterMode.LOW_PASS);
      });
    });

    describe('Filter Usage Queries', () => {
      it('should return false for unused filter', () => {
        expect(analyzer.isFilterUsed()).toBe(false);
      });

      it('should return true when filter is used', () => {
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'setFilter', createMockLocation());
        expect(analyzer.isFilterUsed()).toBe(true);
      });
    });
  });

  // ============================================
  // Voice Conflict Detection Tests
  // ============================================

  describe('Voice Conflict Detection', () => {
    it('should detect no conflicts when voices are dedicated', () => {
      // Common pattern: Voice 1+2 for music, Voice 3 for SFX
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'musicPlayer', createMockLocation());
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'musicPlayer', createMockLocation());
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playSFX', createMockLocation());

      const conflicts = analyzer.analyzeVoiceConflicts();
      expect(conflicts).toHaveLength(0);
    });

    it('should detect voice conflict when multiple functions write to same voice', () => {
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'musicPlayer', createMockLocation(1));
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'playSFX', createMockLocation(2));

      const conflicts = analyzer.analyzeVoiceConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].voice).toBe(0);
      expect(conflicts[0].functions).toContain('musicPlayer');
      expect(conflicts[0].functions).toContain('playSFX');
    });

    it('should report error severity for control register conflicts', () => {
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'musicPlayer', createMockLocation());
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'playSFX', createMockLocation());

      const conflicts = analyzer.analyzeVoiceConflicts();
      expect(conflicts[0].severity).toBe('error');
    });

    it('should report warning severity for non-control conflicts', () => {
      // Only frequency writes, no control register
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_LO, 'musicPlayer', createMockLocation());
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_HI, 'playSFX', createMockLocation());

      const conflicts = analyzer.analyzeVoiceConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].severity).toBe('warning');
    });

    it('should detect conflicts on multiple voices', () => {
      // Conflict on Voice 1 and Voice 2
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'func1', createMockLocation());
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'func2', createMockLocation());
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'func3', createMockLocation());
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'func4', createMockLocation());

      const conflicts = analyzer.analyzeVoiceConflicts();
      expect(conflicts).toHaveLength(2);
    });

    it('should generate meaningful conflict message', () => {
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'playMusic', createMockLocation());
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'playSFX', createMockLocation());

      const conflicts = analyzer.analyzeVoiceConflicts();
      expect(conflicts[0].message).toContain('Voice 1');
      expect(conflicts[0].message).toContain('playMusic');
      expect(conflicts[0].message).toContain('playSFX');
    });
  });

  // ============================================
  // Filter Conflict Detection Tests
  // ============================================

  describe('Filter Conflict Detection', () => {
    it('should detect no conflicts when single function uses filter', () => {
      analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'filterSweep', createMockLocation());
      analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_HI, 'filterSweep', createMockLocation());

      const conflicts = analyzer.analyzeFilterConflicts();
      expect(conflicts).toHaveLength(0);
    });

    it('should detect filter cutoff conflict', () => {
      analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'musicFilter', createMockLocation());
      analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'sfxFilter', createMockLocation());

      const conflicts = analyzer.analyzeFilterConflicts();
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].conflictType).toBe('cutoff');
    });

    it('should detect filter resonance conflict', () => {
      analyzer.trackFilterWrite(SID_REGISTERS.FILTER_RESONANCE, 'musicFilter', createMockLocation());
      analyzer.trackFilterWrite(SID_REGISTERS.FILTER_RESONANCE, 'sfxFilter', createMockLocation());

      const conflicts = analyzer.analyzeFilterConflicts();
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some(c => c.conflictType === 'resonance')).toBe(true);
    });
  });

  // ============================================
  // Volume Conflict Detection Tests
  // ============================================

  describe('Volume Conflict Detection', () => {
    it('should detect no conflicts with single volume function', () => {
      analyzer.trackVolumeWrite('mainVolume', createMockLocation());

      const conflicts = analyzer.analyzeVolumeConflicts();
      expect(conflicts).toHaveLength(0);
    });

    it('should detect volume conflict with multiple functions', () => {
      analyzer.trackVolumeWrite('musicVolume', createMockLocation());
      analyzer.trackVolumeWrite('sfxVolume', createMockLocation());

      const conflicts = analyzer.analyzeVolumeConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].functions).toContain('musicVolume');
      expect(conflicts[0].functions).toContain('sfxVolume');
    });

    it('should report warning severity for volume conflicts', () => {
      analyzer.trackVolumeWrite('func1', createMockLocation());
      analyzer.trackVolumeWrite('func2', createMockLocation());

      const conflicts = analyzer.analyzeVolumeConflicts();
      expect(conflicts[0].severity).toBe('warning');
    });
  });

  // ============================================
  // Complete Analysis Tests
  // ============================================

  describe('Complete Analysis', () => {
    it('should return complete analysis result', () => {
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'music', createMockLocation());
      analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'music', createMockLocation());

      const result = analyzer.analyzeAllConflicts();

      expect(result.hasVoiceUsage).toBe(true);
      expect(result.hasFilterUsage).toBe(true);
      expect(result.totalConflicts).toBe(0);
      expect(result.voiceUsage.size).toBe(3);
    });

    it('should count total conflicts correctly', () => {
      // Voice 1 conflict
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'func1', createMockLocation());
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'func2', createMockLocation());

      // Filter conflict
      analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'func3', createMockLocation());
      analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'func4', createMockLocation());

      // Volume conflict
      analyzer.trackVolumeWrite('func5', createMockLocation());
      analyzer.trackVolumeWrite('func6', createMockLocation());

      const result = analyzer.analyzeAllConflicts();
      expect(result.totalConflicts).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================
  // Timing Requirements Tests
  // ============================================

  describe('Timing Requirements', () => {
    it('should detect music player pattern (all 3 voices)', () => {
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'playMusic', createMockLocation());
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'playMusic', createMockLocation());
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playMusic', createMockLocation());

      const timing = analyzer.estimateTimingRequirements();
      expect(timing.isMusicPlayer).toBe(true);
      expect(timing.voicesUsed).toBe(3);
      expect(timing.irqFrequency).toBe(50);
    });

    it('should detect SFX pattern (single voice)', () => {
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playSFX', createMockLocation());

      const timing = analyzer.estimateTimingRequirements();
      expect(timing.isMusicPlayer).toBe(false);
      expect(timing.voicesUsed).toBe(1);
      expect(timing.irqFrequency).toBe(25);
    });

    it('should report no SID usage when no voices used', () => {
      const timing = analyzer.estimateTimingRequirements();
      expect(timing.voicesUsed).toBe(0);
      expect(timing.irqFrequency).toBe(0);
    });
  });

  // ============================================
  // Reset and State Management Tests
  // ============================================

  describe('Reset and State Management', () => {
    it('should reset all state', () => {
      analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'music', createMockLocation());
      analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'music', createMockLocation());
      analyzer.trackVolumeWrite('music', createMockLocation());

      analyzer.reset();

      expect(analyzer.getUsedVoiceCount()).toBe(0);
      expect(analyzer.isFilterUsed()).toBe(false);
      expect(analyzer.hasConflicts()).toBe(false);
    });

    it('should report no conflicts before analysis', () => {
      expect(analyzer.hasConflicts()).toBe(false);
      expect(analyzer.getTotalConflicts()).toBe(0);
    });
  });

  // ============================================
  // Realistic C64 Game Development Scenarios
  // ============================================

  describe('C64 Game Development Scenarios', () => {
    /**
     * Scenario 1: Standard Music + SFX Architecture
     *
     * This is the most common C64 game audio setup:
     * - Voices 1 & 2 dedicated to music (3-voice music using only 2 voices)
     * - Voice 3 dedicated to sound effects
     * - Music player runs in IRQ handler
     * - SFX triggered by game events
     */
    describe('Scenario: Standard Music + SFX (2+1 Voice Split)', () => {
      it('should detect no conflicts with proper voice allocation', () => {
        // Music player uses Voices 1 & 2
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_LO, 'musicPlayerIRQ', createMockLocation(10));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_HI, 'musicPlayerIRQ', createMockLocation(11));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'musicPlayerIRQ', createMockLocation(12));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_AD, 'musicPlayerIRQ', createMockLocation(13));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_SR, 'musicPlayerIRQ', createMockLocation(14));

        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_FREQ_LO, 'musicPlayerIRQ', createMockLocation(20));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_FREQ_HI, 'musicPlayerIRQ', createMockLocation(21));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'musicPlayerIRQ', createMockLocation(22));

        // SFX system uses Voice 3 only
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_FREQ_LO, 'playSoundEffect', createMockLocation(30));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_FREQ_HI, 'playSoundEffect', createMockLocation(31));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playSoundEffect', createMockLocation(32));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_AD, 'playSoundEffect', createMockLocation(33));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_SR, 'playSoundEffect', createMockLocation(34));

        const result = analyzer.analyzeAllConflicts();

        expect(result.voiceConflicts).toHaveLength(0);
        expect(result.hasVoiceUsage).toBe(true);
        expect(analyzer.getUsedVoiceCount()).toBe(3);
      });

      it('should detect shared volume control (acceptable for unified audio)', () => {
        // Both music and SFX might control master volume
        analyzer.trackVolumeWrite('musicFadeOut', createMockLocation(100));
        analyzer.trackVolumeWrite('sfxMute', createMockLocation(200));

        const result = analyzer.analyzeAllConflicts();

        // Volume conflict expected but severity is warning
        expect(result.volumeConflicts).toHaveLength(1);
        expect(result.volumeConflicts[0].severity).toBe('warning');
      });
    });

    /**
     * Scenario 2: Full 3-Voice Music Player
     *
     * Games with complex music using all 3 SID voices:
     * - No voice available for SFX during music
     * - Common in games that prioritize music over SFX
     * - SFX might "steal" a voice temporarily
     */
    describe('Scenario: Full 3-Voice Music Player', () => {
      it('should detect music player using all voices', () => {
        // Full 3-voice music player
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'sidMusicPlayer', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'sidMusicPlayer', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'sidMusicPlayer', createMockLocation());

        const timing = analyzer.estimateTimingRequirements();

        expect(timing.isMusicPlayer).toBe(true);
        expect(timing.voicesUsed).toBe(3);
        expect(timing.irqFrequency).toBe(50);
      });

      it('should detect voice stealing conflict', () => {
        // Music player uses all 3 voices
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'sidMusicPlayer', createMockLocation(10));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'sidMusicPlayer', createMockLocation(11));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'sidMusicPlayer', createMockLocation(12));

        // SFX tries to steal Voice 3 (common pattern)
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_FREQ_LO, 'playExplosion', createMockLocation(20));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playExplosion', createMockLocation(21));

        const result = analyzer.analyzeAllConflicts();

        // Voice 3 conflict expected
        expect(result.voiceConflicts).toHaveLength(1);
        expect(result.voiceConflicts[0].voice).toBe(2); // Voice 3 (0-indexed)
        expect(result.voiceConflicts[0].severity).toBe('error'); // Control register conflict
      });
    });

    /**
     * Scenario 3: Multiple SFX Functions
     *
     * Games with different SFX functions that share voices:
     * - Jump sound, shoot sound, explosion sound
     * - All might use the same "SFX voice"
     * - Should NOT be flagged as conflict if designed correctly
     */
    describe('Scenario: Multiple SFX Functions Sharing Voice', () => {
      it('should detect conflict when multiple SFX functions share voice', () => {
        // Multiple SFX functions all using Voice 3
        // This is actually a conflict - they might interrupt each other
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playJumpSound', createMockLocation(10));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playShootSound', createMockLocation(20));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playExplosionSound', createMockLocation(30));

        const result = analyzer.analyzeAllConflicts();

        // Three functions writing to same control register = conflict
        expect(result.voiceConflicts).toHaveLength(1);
        expect(result.voiceConflicts[0].functions).toHaveLength(3);
        expect(result.voiceConflicts[0].severity).toBe('error');
      });

      it('should generate useful message for SFX conflict', () => {
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playJumpSound', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playShootSound', createMockLocation());

        const result = analyzer.analyzeAllConflicts();

        expect(result.voiceConflicts[0].message).toContain('Voice 3');
        expect(result.voiceConflicts[0].message).toContain('playJumpSound');
        expect(result.voiceConflicts[0].message).toContain('playShootSound');
      });
    });

    /**
     * Scenario 4: Filter Sweep SFX
     *
     * Classic C64 SFX technique:
     * - Use filter sweep for "laser" or "explosion" sounds
     * - Requires exclusive access to filter
     * - Conflicts with music that also uses filter
     */
    describe('Scenario: Filter Sweep Sound Effects', () => {
      it('should detect no filter conflict when only SFX uses filter', () => {
        // SFX system uses filter for laser sound
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'playLaserSound', createMockLocation(10));
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_HI, 'playLaserSound', createMockLocation(11));
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_RESONANCE, 'playLaserSound', createMockLocation(12), 0xf4); // High res, route Voice 3

        // Volume/mode set separately
        analyzer.trackVolumeWrite('playLaserSound', createMockLocation(13), 0x1f); // Low-pass + max vol

        const result = analyzer.analyzeAllConflicts();

        expect(result.filterConflicts).toHaveLength(0);
        expect(result.hasFilterUsage).toBe(true);
      });

      it('should detect filter conflict between music and SFX', () => {
        // Music uses filter for bass sound
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'musicFilter', createMockLocation(10));
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_HI, 'musicFilter', createMockLocation(11));

        // SFX also tries to use filter for laser
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'laserSweep', createMockLocation(20));
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_HI, 'laserSweep', createMockLocation(21));

        const result = analyzer.analyzeAllConflicts();

        // Filter cutoff conflict expected
        expect(result.filterConflicts.length).toBeGreaterThan(0);
        expect(result.filterConflicts[0].conflictType).toBe('cutoff');
      });
    });

    /**
     * Scenario 5: Arcade-Style Sound Manager
     *
     * Sophisticated audio system with:
     * - Central sound manager
     * - Prioritized sound playback
     * - Single point of SID access (no conflicts)
     */
    describe('Scenario: Centralized Sound Manager', () => {
      it('should detect no conflicts with single sound manager', () => {
        // All audio goes through single soundManager function
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'soundManager', createMockLocation(10));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'soundManager', createMockLocation(11));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'soundManager', createMockLocation(12));
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_CUTOFF_LO, 'soundManager', createMockLocation(13));
        analyzer.trackFilterWrite(SID_REGISTERS.FILTER_RESONANCE, 'soundManager', createMockLocation(14));
        analyzer.trackVolumeWrite('soundManager', createMockLocation(15));

        const result = analyzer.analyzeAllConflicts();

        expect(result.voiceConflicts).toHaveLength(0);
        expect(result.filterConflicts).toHaveLength(0);
        expect(result.volumeConflicts).toHaveLength(0);
        expect(result.totalConflicts).toBe(0);
      });
    });

    /**
     * Scenario 6: Demo/Intro with Digi Playback
     *
     * Digital sample playback using Volume register:
     * - Rapidly changing $D418 for 4-bit digi
     * - Conflicts with any music using filter modes
     * - Common in demos, rare in games
     */
    describe('Scenario: Digital Sample Playback', () => {
      it('should detect volume conflict during digi playback', () => {
        // Digi player rapidly writes volume
        analyzer.trackVolumeWrite('digiPlayer', createMockLocation(10));

        // Music also wants volume control
        analyzer.trackVolumeWrite('musicVolume', createMockLocation(20));

        const result = analyzer.analyzeAllConflicts();

        // Volume conflict between digi and music
        expect(result.volumeConflicts).toHaveLength(1);
        expect(result.volumeConflicts[0].functions).toContain('digiPlayer');
        expect(result.volumeConflicts[0].functions).toContain('musicVolume');
      });
    });

    /**
     * Scenario 7: Title Screen vs In-Game Audio
     *
     * Different audio systems for different game states:
     * - Title music might use all 3 voices
     * - In-game uses 2+1 split
     * - Transition should be handled by game state
     */
    describe('Scenario: State-Based Audio', () => {
      it('should detect conflict if title and ingame audio not properly separated', () => {
        // Title music (full 3-voice)
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'playTitleMusic', createMockLocation(10));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'playTitleMusic', createMockLocation(11));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playTitleMusic', createMockLocation(12));

        // In-game music (2-voice)
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'playGameMusic', createMockLocation(20));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'playGameMusic', createMockLocation(21));

        // In-game SFX (Voice 3)
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playGameSFX', createMockLocation(30));

        const result = analyzer.analyzeAllConflicts();

        // Voice 1, 2, 3 all have conflicts
        expect(result.voiceConflicts).toHaveLength(3);
      });
    });

    /**
     * Scenario 8: Random Number Generator via Voice 3
     *
     * Using Voice 3 noise waveform for random numbers:
     * - Read $D41B (Voice 3 oscillator output)
     * - Voice 3 must be in noise mode
     * - Conflicts with Voice 3 music/SFX
     */
    describe('Scenario: Voice 3 for Random Number Generation', () => {
      it('should detect conflict when RNG and SFX both use Voice 3', () => {
        // RNG setup using Voice 3 noise
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_FREQ_LO, 'initRNG', createMockLocation(10));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_FREQ_HI, 'initRNG', createMockLocation(11));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'initRNG', createMockLocation(12)); // Noise waveform

        // SFX also wants to use Voice 3
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'playExplosion', createMockLocation(20));

        const result = analyzer.analyzeAllConflicts();

        // Voice 3 control register conflict
        expect(result.voiceConflicts).toHaveLength(1);
        expect(result.voiceConflicts[0].voice).toBe(2);
        expect(result.voiceConflicts[0].functions).toContain('initRNG');
        expect(result.voiceConflicts[0].functions).toContain('playExplosion');
      });
    });

    /**
     * Scenario 9: Multi-Module Game with Separate Audio Modules
     *
     * Large game with separate modules:
     * - music.bl65 - Music player module
     * - sfx.bl65 - Sound effects module
     * - Both might access SID without coordination
     */
    describe('Scenario: Multi-Module Audio Architecture', () => {
      it('should detect cross-module voice conflicts', () => {
        // music.bl65 functions
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'music_play', createMockLocation(100));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'music_play', createMockLocation(101));
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'music_play', createMockLocation(102));

        // sfx.bl65 functions (trying to use Voice 3)
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'sfx_trigger', createMockLocation(200));

        const result = analyzer.analyzeAllConflicts();

        // Voice 3 conflict between modules
        expect(result.voiceConflicts).toHaveLength(1);
        expect(result.voiceConflicts[0].functions).toContain('music_play');
        expect(result.voiceConflicts[0].functions).toContain('sfx_trigger');
      });
    });

    /**
     * Scenario 10: Hardware Sprite + SID Timing
     *
     * Complex scenario where SID and VIC-II interact:
     * - IRQ handler needs to update both
     * - SID updates must fit within raster time
     * - Common in scrolling games with music
     */
    describe('Scenario: IRQ Handler Audio Updates', () => {
      it('should detect music player timing requirements', () => {
        // Full music player in IRQ - needs 50Hz updates
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_LO, 'irqHandler', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_FREQ_HI, 'irqHandler', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE1_CONTROL, 'irqHandler', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_FREQ_LO, 'irqHandler', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_FREQ_HI, 'irqHandler', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE2_CONTROL, 'irqHandler', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_FREQ_LO, 'irqHandler', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_FREQ_HI, 'irqHandler', createMockLocation());
        analyzer.trackVoiceWrite(SID_REGISTERS.VOICE3_CONTROL, 'irqHandler', createMockLocation());

        const timing = analyzer.estimateTimingRequirements();

        expect(timing.isMusicPlayer).toBe(true);
        expect(timing.irqFrequency).toBe(50);
        expect(timing.recommendation).toContain('50Hz');
      });
    });
  });
});
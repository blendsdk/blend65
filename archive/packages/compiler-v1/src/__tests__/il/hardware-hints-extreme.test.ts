/**
 * Hardware Hints Extreme Tests (Task 5.8)
 *
 * Extreme edge case tests for hardware hints passthrough from semantic analysis to IL.
 * Tests VIC-II timing info, SID register sequences, and hardware metadata preservation.
 *
 * Hardware hints are critical for C64-specific optimizations:
 * - VIC-II raster timing constraints
 * - SID register write sequences
 * - Interrupt handler metadata
 * - Hardware penalty calculations
 *
 * Test Categories:
 * - ILModule VIC-II Timing Metadata
 * - ILModule SID Register Metadata
 * - ILFunction Interrupt Handler Hints
 * - Hardware Metadata Preservation
 * - C64 Hardware Timing Integration
 *
 * @module il/hardware-hints-extreme.test
 */

import { describe, expect, it } from 'vitest';
import { ILModule } from '../../il/module.js';
import { ILFunction, ILStorageClass } from '../../il/function.js';
import { IL_VOID, IL_BYTE, IL_WORD } from '../../il/types.js';

// =============================================================================
// Test Constants - C64 Hardware Addresses and Timing
// =============================================================================

/**
 * VIC-II timing constants (PAL)
 */
const VIC_TIMING = {
  CYCLES_PER_LINE: 63,
  LINES_PER_FRAME: 312,
  BADLINE_PENALTY: 40,
  BADLINE_CYCLES: 23, // 63 - 40
  CYCLES_PER_FRAME: 19656, // 63 * 312
};

/**
 * SID register addresses
 */
const SID = {
  BASE: 0xd400,
  VOICE1_FREQ_LO: 0xd400,
  VOICE1_FREQ_HI: 0xd401,
  VOICE1_CONTROL: 0xd404,
  VOICE2_FREQ_LO: 0xd407,
  VOICE2_CONTROL: 0xd40b,
  VOICE3_FREQ_LO: 0xd40e,
  VOICE3_CONTROL: 0xd412,
  FILTER_CUTOFF_LO: 0xd415,
  FILTER_CUTOFF_HI: 0xd416,
  FILTER_RESONANCE: 0xd417,
  VOLUME_MODE: 0xd418,
};

/**
 * VIC-II register addresses
 */
const VIC = {
  BASE: 0xd000,
  BORDER_COLOR: 0xd020,
  BACKGROUND_COLOR: 0xd021,
  RASTER: 0xd012,
  CONTROL1: 0xd011,
  SPRITE_ENABLE: 0xd015,
  IRQ_STATUS: 0xd019,
  IRQ_ENABLE: 0xd01a,
};

// =============================================================================
// ILModule VIC-II Timing Metadata Tests
// =============================================================================

describe('Hardware Hints Extreme Tests', () => {
  describe('ILModule VIC-II Timing Metadata', () => {
    it('should store VIC-II cycles per line metadata', () => {
      const module = new ILModule('raster-effects.bl65');

      module.setMetadata('VICIICyclesPerLine', VIC_TIMING.CYCLES_PER_LINE);

      expect(module.getMetadata<number>('VICIICyclesPerLine')).toBe(63);
    });

    it('should store VIC-II lines per frame metadata (PAL)', () => {
      const module = new ILModule('graphics.bl65');

      module.setMetadata('VICIILinesPerFrame', VIC_TIMING.LINES_PER_FRAME);

      expect(module.getMetadata<number>('VICIILinesPerFrame')).toBe(312);
    });

    it('should store badline penalty cycles', () => {
      const module = new ILModule('demo.bl65');

      module.setMetadata('VICIIBadlinePenalty', VIC_TIMING.BADLINE_PENALTY);

      expect(module.getMetadata<number>('VICIIBadlinePenalty')).toBe(40);
    });

    it('should store raster-safe function metadata', () => {
      const module = new ILModule('raster-irq.bl65');

      // Store raster safety metadata for specific functions
      module.setMetadata('VICIIRasterSafeFunctions', ['rasterIRQ', 'updateBorder']);

      const safeFunctions = module.getMetadata<string[]>('VICIIRasterSafeFunctions');
      expect(safeFunctions).toContain('rasterIRQ');
      expect(safeFunctions).toContain('updateBorder');
    });

    it('should store estimated cycle counts per function', () => {
      const module = new ILModule('timing.bl65');

      // Store cycle estimates for timing-critical functions
      const cycleEstimates = new Map<string, number>([
        ['fastCopy', 45],
        ['updateSprites', 28],
        ['scanKeyboard', 62],
      ]);

      module.setMetadata('VICIICycleEstimates', cycleEstimates);

      const stored = module.getMetadata<Map<string, number>>('VICIICycleEstimates');
      expect(stored?.get('fastCopy')).toBe(45);
      expect(stored?.get('updateSprites')).toBe(28);
      expect(stored?.get('scanKeyboard')).toBe(62);
    });

    it('should store badline-aware function list', () => {
      const module = new ILModule('fld.bl65');

      // Functions that account for badline cycle stealing
      module.setMetadata('VICIIBadlineAwareFunctions', ['fldEffect', 'stableRaster']);

      const badlineAware = module.getMetadata<string[]>('VICIIBadlineAwareFunctions');
      expect(badlineAware).toContain('fldEffect');
    });

    it('should store complete VIC-II timing configuration', () => {
      const module = new ILModule('demo-complete.bl65');

      const timingConfig = {
        cyclesPerLine: VIC_TIMING.CYCLES_PER_LINE,
        linesPerFrame: VIC_TIMING.LINES_PER_FRAME,
        badlinePenalty: VIC_TIMING.BADLINE_PENALTY,
        cyclesPerFrame: VIC_TIMING.CYCLES_PER_FRAME,
        isPAL: true,
      };

      module.setMetadata('VICIITimingConfig', timingConfig);

      const config = module.getMetadata<typeof timingConfig>('VICIITimingConfig');
      expect(config?.cyclesPerLine).toBe(63);
      expect(config?.cyclesPerFrame).toBe(19656);
      expect(config?.isPAL).toBe(true);
    });
  });

  // ===========================================================================
  // ILModule SID Register Metadata Tests
  // ===========================================================================

  describe('ILModule SID Register Metadata', () => {
    it('should store SID voice usage metadata', () => {
      const module = new ILModule('music.bl65');

      module.setMetadata('SIDVoiceUsage', {
        voice1: { usedBy: ['playNote'], registers: [SID.VOICE1_FREQ_LO, SID.VOICE1_CONTROL] },
        voice2: { usedBy: ['playSFX'], registers: [SID.VOICE2_FREQ_LO, SID.VOICE2_CONTROL] },
        voice3: { usedBy: ['playNote', 'playBass'], registers: [SID.VOICE3_FREQ_LO] },
      });

      const usage = module.getMetadata<Record<string, { usedBy: string[]; registers: number[] }>>(
        'SIDVoiceUsage',
      );
      expect(usage?.voice1.usedBy).toContain('playNote');
      expect(usage?.voice2.registers).toContain(SID.VOICE2_CONTROL);
    });

    it('should store SID filter routing metadata', () => {
      const module = new ILModule('synth.bl65');

      module.setMetadata('SIDFilterRouting', {
        voice1Filtered: true,
        voice2Filtered: false,
        voice3Filtered: true,
        filterMode: 'lowpass',
      });

      const routing = module.getMetadata<{
        voice1Filtered: boolean;
        voice2Filtered: boolean;
        voice3Filtered: boolean;
        filterMode: string;
      }>('SIDFilterRouting');
      expect(routing?.voice1Filtered).toBe(true);
      expect(routing?.filterMode).toBe('lowpass');
    });

    it('should store SID register write sequence', () => {
      const module = new ILModule('sfx.bl65');

      // Store optimal register write order for sound effects
      const writeSequence = [
        { address: SID.VOICE1_FREQ_LO, description: 'Frequency low byte' },
        { address: SID.VOICE1_FREQ_HI, description: 'Frequency high byte' },
        { address: SID.VOICE1_CONTROL, description: 'Gate on' },
      ];

      module.setMetadata('SIDWriteSequence', writeSequence);

      const sequence = module.getMetadata<typeof writeSequence>('SIDWriteSequence');
      expect(sequence).toHaveLength(3);
      expect(sequence?.[0].address).toBe(SID.VOICE1_FREQ_LO);
    });

    it('should store SID conflict analysis results', () => {
      const module = new ILModule('game.bl65');

      module.setMetadata('SIDConflicts', {
        hasVoiceConflict: true,
        conflictingVoice: 1,
        conflictingFunctions: ['playMusic', 'playSFX'],
        severity: 'warning',
      });

      const conflicts = module.getMetadata<{
        hasVoiceConflict: boolean;
        conflictingVoice: number;
        conflictingFunctions: string[];
        severity: string;
      }>('SIDConflicts');
      expect(conflicts?.hasVoiceConflict).toBe(true);
      expect(conflicts?.conflictingFunctions).toContain('playMusic');
    });

    it('should store IRQ timing requirements for music player', () => {
      const module = new ILModule('player.bl65');

      module.setMetadata('SIDTimingRequirements', {
        irqFrequency: 50, // Hz (PAL)
        isMusicPlayer: true,
        voicesUsed: 3,
        recommendation: 'Set up 50Hz CIA timer for music playback',
      });

      const timing = module.getMetadata<{
        irqFrequency: number;
        isMusicPlayer: boolean;
        voicesUsed: number;
        recommendation: string;
      }>('SIDTimingRequirements');
      expect(timing?.irqFrequency).toBe(50);
      expect(timing?.isMusicPlayer).toBe(true);
    });
  });

  // ===========================================================================
  // ILFunction Interrupt Handler Hints Tests
  // ===========================================================================

  describe('ILFunction Interrupt Handler Hints', () => {
    it('should mark function as interrupt handler', () => {
      const func = new ILFunction('rasterIRQ', [], IL_VOID);

      func.setInterrupt(true);

      expect(func.getInterrupt()).toBe(true);
    });

    it('should distinguish regular function from interrupt handler', () => {
      const regularFunc = new ILFunction('updateGame', [], IL_VOID);
      const irqFunc = new ILFunction('irqHandler', [], IL_VOID);
      irqFunc.setInterrupt(true);

      expect(regularFunc.getInterrupt()).toBe(false);
      expect(irqFunc.getInterrupt()).toBe(true);
    });

    it('should preserve interrupt flag through multiple operations', () => {
      const func = new ILFunction('nmiHandler', [], IL_VOID);
      func.setInterrupt(true);

      // Perform other operations
      func.createBlock('body');
      func.setExported(true);
      func.createRegister(IL_BYTE, 'temp');

      // Interrupt flag should still be set
      expect(func.getInterrupt()).toBe(true);
    });

    it('should allow toggling interrupt status', () => {
      const func = new ILFunction('handler', [], IL_VOID);

      func.setInterrupt(true);
      expect(func.getInterrupt()).toBe(true);

      func.setInterrupt(false);
      expect(func.getInterrupt()).toBe(false);
    });

    it('should support multiple interrupt handlers in module', () => {
      const module = new ILModule('interrupts.bl65');

      const rasterIRQ = module.createFunction('rasterIRQ', [], IL_VOID);
      rasterIRQ.setInterrupt(true);

      const nmiHandler = module.createFunction('nmiHandler', [], IL_VOID);
      nmiHandler.setInterrupt(true);

      const regularFunc = module.createFunction('updateLogic', [], IL_VOID);

      const funcs = module.getFunctions();
      const interruptCount = funcs.filter((f) => f.getInterrupt()).length;

      expect(interruptCount).toBe(2);
    });
  });

  // ===========================================================================
  // Hardware Metadata Preservation Tests
  // ===========================================================================

  describe('Hardware Metadata Preservation', () => {
    it('should preserve hardware address hints in module metadata', () => {
      const module = new ILModule('hardware.bl65');

      // Store hardware address mapping
      const hardwareMap = new Map<string, number>([
        ['borderColor', VIC.BORDER_COLOR],
        ['backgroundColor', VIC.BACKGROUND_COLOR],
        ['sidVolume', SID.VOLUME_MODE],
        ['rasterLine', VIC.RASTER],
      ]);

      module.setMetadata('HardwareAddressMap', hardwareMap);

      const map = module.getMetadata<Map<string, number>>('HardwareAddressMap');
      expect(map?.get('borderColor')).toBe(0xd020);
      expect(map?.get('sidVolume')).toBe(0xd418);
    });

    it('should preserve hardware penalty information', () => {
      const module = new ILModule('sprites.bl65');

      module.setMetadata('HardwarePenalties', {
        spriteDMAPenalty: 16, // 8 sprites * 2 cycles each
        pageCrossingPenalty: 1,
        rmwPenalty: 2,
        activeSprites: 8,
      });

      const penalties = module.getMetadata<{
        spriteDMAPenalty: number;
        pageCrossingPenalty: number;
        rmwPenalty: number;
        activeSprites: number;
      }>('HardwarePenalties');
      expect(penalties?.spriteDMAPenalty).toBe(16);
      expect(penalties?.activeSprites).toBe(8);
    });

    it('should preserve register preference hints per variable', () => {
      const module = new ILModule('optimized.bl65');

      // Store M6502 register preferences from semantic analysis
      module.setMetadata('M6502RegisterPreferences', {
        loopCounter: 'X',
        arrayIndex: 'X',
        tempValue: 'A',
        indirectPointer: 'Y',
      });

      const prefs = module.getMetadata<Record<string, string>>('M6502RegisterPreferences');
      expect(prefs?.loopCounter).toBe('X');
      expect(prefs?.tempValue).toBe('A');
      expect(prefs?.indirectPointer).toBe('Y');
    });

    it('should preserve zero-page priority scores', () => {
      const module = new ILModule('zp-optimized.bl65');

      module.setMetadata('ZeroPagePriorities', {
        loopCounter: 85,
        screenPtr: 72,
        tempByte: 45,
        flags: 12,
      });

      const priorities = module.getMetadata<Record<string, number>>('ZeroPagePriorities');
      expect(priorities?.loopCounter).toBe(85);
      expect(priorities?.screenPtr).toBe(72);
    });

    it('should preserve addressing mode hints', () => {
      const module = new ILModule('addressing.bl65');

      module.setMetadata('AddressingModeHints', {
        zpVar: 'ZeroPage',
        zpIndexed: 'ZeroPageX',
        absoluteVar: 'Absolute',
        indirectPtr: 'IndirectIndexed',
      });

      const hints = module.getMetadata<Record<string, string>>('AddressingModeHints');
      expect(hints?.zpVar).toBe('ZeroPage');
      expect(hints?.indirectPtr).toBe('IndirectIndexed');
    });
  });

  // ===========================================================================
  // C64 Hardware Timing Integration Tests
  // ===========================================================================

  describe('C64 Hardware Timing Integration', () => {
    it('should store complete raster timing analysis', () => {
      const module = new ILModule('raster-demo.bl65');

      module.setMetadata('RasterTimingAnalysis', {
        rasterLine: 100,
        estimatedCycles: 45,
        availableCycles: 63,
        cycleMargin: 18,
        isSafe: true,
        isBadlineAware: true,
        recommendation: 'safe',
      });

      const analysis = module.getMetadata<{
        rasterLine: number;
        estimatedCycles: number;
        availableCycles: number;
        cycleMargin: number;
        isSafe: boolean;
        isBadlineAware: boolean;
        recommendation: string;
      }>('RasterTimingAnalysis');
      expect(analysis?.isSafe).toBe(true);
      expect(analysis?.cycleMargin).toBe(18);
    });

    it('should store sprite DMA timing impact', () => {
      const module = new ILModule('sprite-game.bl65');

      module.setMetadata('SpriteDMATiming', {
        activeSprites: 6,
        cyclesStolen: 12, // 6 * 2
        effectiveCyclesPerLine: 51, // 63 - 12
        effectiveBadlineCycles: 11, // 23 - 12
      });

      const timing = module.getMetadata<{
        activeSprites: number;
        cyclesStolen: number;
        effectiveCyclesPerLine: number;
        effectiveBadlineCycles: number;
      }>('SpriteDMATiming');
      expect(timing?.effectiveCyclesPerLine).toBe(51);
    });

    it('should store combined VIC+SID hardware analysis', () => {
      const module = new ILModule('game-complete.bl65');

      module.setMetadata('HardwareAnalysis', {
        vic: {
          rasterSafe: true,
          usesSprites: true,
          spriteCount: 4,
          usesMultiplex: false,
        },
        sid: {
          voicesUsed: 2,
          usesFilter: true,
          hasConflicts: false,
          irqRequired: true,
        },
        combined: {
          irqLoad: 'medium',
          timingCritical: true,
          optimizationLevel: 'aggressive',
        },
      });

      const analysis = module.getMetadata<{
        vic: { rasterSafe: boolean; usesSprites: boolean; spriteCount: number; usesMultiplex: boolean };
        sid: { voicesUsed: number; usesFilter: boolean; hasConflicts: boolean; irqRequired: boolean };
        combined: { irqLoad: string; timingCritical: boolean; optimizationLevel: string };
      }>('HardwareAnalysis');
      expect(analysis?.vic.spriteCount).toBe(4);
      expect(analysis?.sid.voicesUsed).toBe(2);
      expect(analysis?.combined.optimizationLevel).toBe('aggressive');
    });

    it('should store CIA timer configuration hints', () => {
      const module = new ILModule('timers.bl65');

      module.setMetadata('CIATimerHints', {
        cia1TimerA: {
          frequency: 50, // Hz
          purpose: 'music playback',
          interruptEnabled: true,
        },
        cia2TimerA: {
          frequency: 0, // Not used
          purpose: null,
          interruptEnabled: false,
        },
      });

      const hints = module.getMetadata<{
        cia1TimerA: { frequency: number; purpose: string | null; interruptEnabled: boolean };
        cia2TimerA: { frequency: number; purpose: string | null; interruptEnabled: boolean };
      }>('CIATimerHints');
      expect(hints?.cia1TimerA.frequency).toBe(50);
      expect(hints?.cia1TimerA.purpose).toBe('music playback');
    });

    it('should store memory bank configuration hints', () => {
      const module = new ILModule('banking.bl65');

      module.setMetadata('MemoryBankConfig', {
        vicBank: 0, // $0000-$3FFF
        screenAddress: 0x0400,
        charsetAddress: 0x1000,
        bitmapAddress: 0x2000,
        usesCustomCharset: true,
        usesMultipleBanks: false,
      });

      const config = module.getMetadata<{
        vicBank: number;
        screenAddress: number;
        charsetAddress: number;
        bitmapAddress: number;
        usesCustomCharset: boolean;
        usesMultipleBanks: boolean;
      }>('MemoryBankConfig');
      expect(config?.vicBank).toBe(0);
      expect(config?.screenAddress).toBe(0x0400);
    });
  });

  // ===========================================================================
  // ILFunction Parameter Storage Hints with Hardware Context Tests
  // ===========================================================================

  describe('ILFunction Parameter Storage Hints with Hardware Context', () => {
    it('should set ZeroPage storage hint for IRQ handler parameter', () => {
      const func = new ILFunction('irqHandler', [{ name: 'rasterLine', type: IL_BYTE }], IL_VOID);
      func.setInterrupt(true);

      func.setParameterStorageHint('rasterLine', ILStorageClass.ZeroPage);

      expect(func.getParameterStorageHint('rasterLine')).toBe(ILStorageClass.ZeroPage);
    });

    it('should set Map storage hint for hardware register parameter', () => {
      const func = new ILFunction(
        'writeVIC',
        [
          { name: 'register', type: IL_BYTE },
          { name: 'value', type: IL_BYTE },
        ],
        IL_VOID,
      );

      func.setParameterStorageHint('register', ILStorageClass.Map);

      expect(func.getParameterStorageHint('register')).toBe(ILStorageClass.Map);
    });

    it('should preserve storage hints for multiple SID parameters', () => {
      const func = new ILFunction(
        'setSIDVoice',
        [
          { name: 'freqLo', type: IL_BYTE },
          { name: 'freqHi', type: IL_BYTE },
          { name: 'control', type: IL_BYTE },
        ],
        IL_VOID,
      );

      func.setParameterStorageHint('freqLo', ILStorageClass.ZeroPage);
      func.setParameterStorageHint('freqHi', ILStorageClass.ZeroPage);
      func.setParameterStorageHint('control', ILStorageClass.Ram);

      expect(func.getParameterStorageHint('freqLo')).toBe(ILStorageClass.ZeroPage);
      expect(func.getParameterStorageHint('freqHi')).toBe(ILStorageClass.ZeroPage);
      expect(func.getParameterStorageHint('control')).toBe(ILStorageClass.Ram);
    });
  });

  // ===========================================================================
  // Module-Level Hardware Hints Summary Tests
  // ===========================================================================

  describe('Module-Level Hardware Hints Summary', () => {
    it('should store complete hardware hints summary', () => {
      const module = new ILModule('full-game.bl65');

      // Create functions with interrupt handlers
      const mainLoop = module.createFunction('mainLoop', [], IL_VOID);
      const rasterIRQ = module.createFunction('rasterIRQ', [], IL_VOID);
      rasterIRQ.setInterrupt(true);
      const musicIRQ = module.createFunction('musicIRQ', [], IL_VOID);
      musicIRQ.setInterrupt(true);

      // Create globals with different storage classes
      module.createGlobal('playerX', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('playerY', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('screenBuffer', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, { address: VIC.BORDER_COLOR });

      // Store comprehensive hardware hints summary
      module.setMetadata('HardwareHintsSummary', {
        totalFunctions: module.getFunctionCount(),
        interruptHandlers: module.getFunctions().filter((f) => f.getInterrupt()).length,
        zeroPageGlobals: module.getGlobalsByStorageClass(ILStorageClass.ZeroPage).length,
        hardwareMappedGlobals: module.getGlobalsByStorageClass(ILStorageClass.Map).length,
        usesVIC: true,
        usesSID: true,
        usesCIA: false,
        targetPlatform: 'C64',
      });

      const summary = module.getMetadata<{
        totalFunctions: number;
        interruptHandlers: number;
        zeroPageGlobals: number;
        hardwareMappedGlobals: number;
        usesVIC: boolean;
        usesSID: boolean;
        usesCIA: boolean;
        targetPlatform: string;
      }>('HardwareHintsSummary');

      expect(summary?.totalFunctions).toBe(3);
      expect(summary?.interruptHandlers).toBe(2);
      expect(summary?.zeroPageGlobals).toBe(2);
      expect(summary?.hardwareMappedGlobals).toBe(1);
      expect(summary?.targetPlatform).toBe('C64');
    });

    it('should validate hardware hints are preserved after module operations', () => {
      const module = new ILModule('preservation-test.bl65');

      // Set up hardware hints
      module.setMetadata('VICIICyclesPerLine', 63);
      module.setMetadata('SIDVoicesUsed', 3);
      module.setMetadata('HardwareTarget', 'C64-PAL');

      // Perform various module operations
      module.createFunction('func1', [], IL_VOID);
      module.createFunction('func2', [], IL_VOID);
      module.createGlobal('var1', IL_BYTE, ILStorageClass.Ram);
      module.createExport('func1', 'func1', 'function');
      module.createImport('helper', 'helper', './utils.bl65');

      // Verify hardware hints are still intact
      expect(module.getMetadata<number>('VICIICyclesPerLine')).toBe(63);
      expect(module.getMetadata<number>('SIDVoicesUsed')).toBe(3);
      expect(module.getMetadata<string>('HardwareTarget')).toBe('C64-PAL');
    });
  });
});
# Task 9.2b: SID Waveform Synchronization

> **Session**: 4.2b
> **Phase**: 09-target-specific
> **Est. Time**: 45 min
> **Tests**: ~25 unit tests
> **Prerequisites**: Task 9.2a complete (SID register timing)

---

## Overview

SID waveform synchronization enables complex sound effects through hard sync, ring modulation, and oscillator coupling. This document covers analysis and optimization of waveform synchronization techniques for the C64 SID chip.

---

## 1. SID Synchronization Fundamentals

### 1.1 Oscillator Relationships

```
SID Oscillator Sync Chain:
┌─────────────────────────────────────────────────────────────┐
│ Voice 3 ─────sync────→ Voice 1 ─────sync────→ Voice 2      │
│    ↑                      ↓                      ↓         │
│  ring mod            ring mod                ring mod      │
│    ↓                      ↓                      ↓         │
│ Voice 2 ←────────── Voice 3 ←────────── Voice 1            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Control Register Bits

| Bit | Name     | Effect                              |
| --- | -------- | ----------------------------------- |
| 0   | GATE     | Start/stop ADSR envelope            |
| 1   | SYNC     | Sync this oscillator to modulating  |
| 2   | RING     | Ring modulate with modulating voice |
| 3   | TEST     | Reset oscillator, disable output    |
| 4-7 | WAVEFORM | Triangle/Saw/Pulse/Noise select     |

### 1.3 Sync Timing Characteristics

```
Hard Sync Timing:
┌─────────────────────────────────────────────────────────────┐
│ Master Voice:  /\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\       │
│                ^       ^       ^       ^                    │
│                │       │       │       │                    │
│ Slave Voice:   │ /\/   │ /\/   │ /\/   │ /\/               │
│                ↑       ↑       ↑       ↑                    │
│              reset   reset   reset   reset                  │
│                                                             │
│ Result: Slave oscillator resets at master's zero crossing   │
│ Effect: Creates harmonically related complex waveforms      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
packages/compiler/src/optimizer/target/sid/
├── sid-wave-sync.ts           # Waveform sync analysis
├── sid-ring-mod.ts            # Ring modulation analysis
├── sid-oscillator-coupling.ts # Cross-voice coupling
├── sid-test-bit.ts            # TEST bit manipulation
└── index.ts                   # Public exports
```

---

## 3. Type Definitions

```typescript
// packages/compiler/src/optimizer/target/sid/wave-sync-types.ts

/**
 * SID voice waveform selection
 */
export enum SIDWaveform {
  NONE = 0x00,
  TRIANGLE = 0x10,
  SAWTOOTH = 0x20,
  PULSE = 0x40,
  NOISE = 0x80,
  // Combined waveforms (6581-specific effects)
  TRI_SAW = 0x30,
  TRI_PULSE = 0x50,
  SAW_PULSE = 0x60,
  TRI_SAW_PULSE = 0x70,
}

/**
 * Sync relationship between voices
 */
export interface SyncRelation {
  readonly masterVoice: 1 | 2 | 3;
  readonly slaveVoice: 1 | 2 | 3;
  readonly syncEnabled: boolean;
  readonly ringEnabled: boolean;
}

/**
 * Voice configuration for sync analysis
 */
export interface VoiceSyncConfig {
  readonly voiceNumber: 1 | 2 | 3;
  readonly frequency: number;
  readonly waveform: SIDWaveform;
  readonly syncBit: boolean;
  readonly ringBit: boolean;
  readonly testBit: boolean;
  readonly gateBit: boolean;
}

/**
 * Synchronization timing event
 */
export interface SyncEvent {
  readonly cyclePosition: number;
  readonly eventType: SyncEventType;
  readonly affectedVoice: 1 | 2 | 3;
  readonly masterVoice: 1 | 2 | 3;
}

export enum SyncEventType {
  SYNC_ENABLE = 'sync_enable',
  SYNC_DISABLE = 'sync_disable',
  RING_ENABLE = 'ring_enable',
  RING_DISABLE = 'ring_disable',
  TEST_ENABLE = 'test_enable',
  TEST_DISABLE = 'test_disable',
  FREQ_CHANGE = 'freq_change',
  WAVEFORM_CHANGE = 'waveform_change',
}

/**
 * Sync analysis result
 */
export interface SyncAnalysis {
  readonly voiceConfigs: [VoiceSyncConfig, VoiceSyncConfig, VoiceSyncConfig];
  readonly activeRelations: SyncRelation[];
  readonly syncEvents: SyncEvent[];
  readonly warnings: SyncWarning[];
  readonly optimizations: SyncOptimization[];
}

/**
 * Sync configuration warning
 */
export interface SyncWarning {
  readonly type: SyncWarningType;
  readonly message: string;
  readonly affectedVoices: number[];
  readonly cyclePosition: number;
}

export enum SyncWarningType {
  UNUSED_SYNC = 'unused_sync',
  NOISE_SYNC = 'noise_sync', // Sync with noise doesn't work well
  FREQ_RATIO = 'freq_ratio', // Non-harmonic frequency ratio
  RING_WITHOUT_TRI = 'ring_without_tri', // Ring mod needs triangle
}

/**
 * Sync optimization opportunity
 */
export interface SyncOptimization {
  readonly type: SyncOptimizationType;
  readonly description: string;
  readonly cyclesSaved: number;
  readonly affectedVoices: number[];
}

export enum SyncOptimizationType {
  BATCH_SYNC_SETUP = 'batch_sync_setup',
  REORDER_SYNC_WRITES = 'reorder_sync_writes',
  COMBINE_CONTROL_WRITES = 'combine_control_writes',
  OPTIMIZE_FREQ_RATIO = 'optimize_freq_ratio',
}
```

---

## 4. Waveform Sync Analyzer

```typescript
// packages/compiler/src/optimizer/target/sid/sid-wave-sync.ts

import {
  SIDWaveform,
  SyncRelation,
  VoiceSyncConfig,
  SyncEvent,
  SyncEventType,
  SyncAnalysis,
  SyncWarning,
  SyncWarningType,
  SyncOptimization,
  SyncOptimizationType,
} from './wave-sync-types.js';
import { SIDWriteOp, SIDRegisterCategory } from './types.js';
import { BasicBlock } from '../../../il/cfg.js';

/**
 * Sync modulation matrix - which voice syncs which
 */
const SYNC_MATRIX: Map<number, number> = new Map([
  [1, 3], // Voice 1 syncs to Voice 3
  [2, 1], // Voice 2 syncs to Voice 1
  [3, 2], // Voice 3 syncs to Voice 2
]);

/**
 * Ring modulation matrix - which voice ring-mods which
 */
const RING_MATRIX: Map<number, number> = new Map([
  [1, 3], // Voice 1 ring-mods with Voice 3
  [2, 1], // Voice 2 ring-mods with Voice 1
  [3, 2], // Voice 3 ring-mods with Voice 2
]);

/**
 * SID Waveform Synchronization Analyzer
 *
 * Analyzes oscillator sync and ring modulation patterns
 * for correct timing and optimization opportunities.
 */
export class SIDWaveSyncAnalyzer {
  protected voiceConfigs: [VoiceSyncConfig, VoiceSyncConfig, VoiceSyncConfig];
  protected syncEvents: SyncEvent[] = [];
  protected currentCycle: number = 0;

  constructor() {
    this.voiceConfigs = [
      this.createDefaultVoiceConfig(1),
      this.createDefaultVoiceConfig(2),
      this.createDefaultVoiceConfig(3),
    ];
  }

  /**
   * Create default voice configuration
   */
  protected createDefaultVoiceConfig(voiceNumber: 1 | 2 | 3): VoiceSyncConfig {
    return {
      voiceNumber,
      frequency: 0,
      waveform: SIDWaveform.NONE,
      syncBit: false,
      ringBit: false,
      testBit: false,
      gateBit: false,
    };
  }

  /**
   * Analyze SID writes for sync patterns
   */
  public analyze(writes: SIDWriteOp[]): SyncAnalysis {
    // Reset state
    this.syncEvents = [];
    this.currentCycle = 0;

    // Process writes in order
    for (const write of writes) {
      this.processWrite(write);
    }

    // Generate analysis results
    const activeRelations = this.getActiveRelations();
    const warnings = this.detectWarnings();
    const optimizations = this.findOptimizations(writes);

    return {
      voiceConfigs: this.voiceConfigs,
      activeRelations,
      syncEvents: this.syncEvents,
      warnings,
      optimizations,
    };
  }

  /**
   * Process a single SID write
   */
  protected processWrite(write: SIDWriteOp): void {
    const reg = write.register;
    this.currentCycle = write.cyclePosition;

    // Handle control register writes
    if (reg.category === SIDRegisterCategory.VOICE_CONTROL && reg.voiceNumber !== null) {
      const voiceIndex = reg.voiceNumber - 1;
      const oldConfig = this.voiceConfigs[voiceIndex];
      const value = write.value;

      if (value !== 'dynamic') {
        const newConfig: VoiceSyncConfig = {
          ...oldConfig,
          gateBit: (value & 0x01) !== 0,
          syncBit: (value & 0x02) !== 0,
          ringBit: (value & 0x04) !== 0,
          testBit: (value & 0x08) !== 0,
          waveform: (value & 0xf0) as SIDWaveform,
        };

        // Track sync/ring changes as events
        this.trackControlChanges(oldConfig, newConfig, write.cyclePosition);

        this.voiceConfigs[voiceIndex] = newConfig;
      }
    }

    // Handle frequency register writes
    if (reg.category === SIDRegisterCategory.VOICE_FREQ && reg.voiceNumber !== null) {
      const voiceIndex = reg.voiceNumber - 1;
      // Simplified - full implementation tracks lo/hi bytes
      if (write.value !== 'dynamic') {
        this.syncEvents.push({
          cyclePosition: write.cyclePosition,
          eventType: SyncEventType.FREQ_CHANGE,
          affectedVoice: reg.voiceNumber as 1 | 2 | 3,
          masterVoice: SYNC_MATRIX.get(reg.voiceNumber)! as 1 | 2 | 3,
        });
      }
    }
  }

  /**
   * Track changes to sync/ring control bits
   */
  protected trackControlChanges(
    oldConfig: VoiceSyncConfig,
    newConfig: VoiceSyncConfig,
    cycle: number
  ): void {
    const voice = newConfig.voiceNumber;
    const masterVoice = SYNC_MATRIX.get(voice)! as 1 | 2 | 3;

    // Sync bit changes
    if (oldConfig.syncBit !== newConfig.syncBit) {
      this.syncEvents.push({
        cyclePosition: cycle,
        eventType: newConfig.syncBit ? SyncEventType.SYNC_ENABLE : SyncEventType.SYNC_DISABLE,
        affectedVoice: voice,
        masterVoice,
      });
    }

    // Ring bit changes
    if (oldConfig.ringBit !== newConfig.ringBit) {
      this.syncEvents.push({
        cyclePosition: cycle,
        eventType: newConfig.ringBit ? SyncEventType.RING_ENABLE : SyncEventType.RING_DISABLE,
        affectedVoice: voice,
        masterVoice,
      });
    }

    // Test bit changes
    if (oldConfig.testBit !== newConfig.testBit) {
      this.syncEvents.push({
        cyclePosition: cycle,
        eventType: newConfig.testBit ? SyncEventType.TEST_ENABLE : SyncEventType.TEST_DISABLE,
        affectedVoice: voice,
        masterVoice,
      });
    }

    // Waveform changes
    if (oldConfig.waveform !== newConfig.waveform) {
      this.syncEvents.push({
        cyclePosition: cycle,
        eventType: SyncEventType.WAVEFORM_CHANGE,
        affectedVoice: voice,
        masterVoice,
      });
    }
  }

  /**
   * Get currently active sync/ring relations
   */
  protected getActiveRelations(): SyncRelation[] {
    const relations: SyncRelation[] = [];

    for (const config of this.voiceConfigs) {
      const masterVoice = SYNC_MATRIX.get(config.voiceNumber)! as 1 | 2 | 3;

      if (config.syncBit || config.ringBit) {
        relations.push({
          masterVoice,
          slaveVoice: config.voiceNumber,
          syncEnabled: config.syncBit,
          ringEnabled: config.ringBit,
        });
      }
    }

    return relations;
  }

  /**
   * Detect potential issues with sync configuration
   */
  protected detectWarnings(): SyncWarning[] {
    const warnings: SyncWarning[] = [];

    for (const config of this.voiceConfigs) {
      // Warning: Sync enabled but no audible result
      if (config.syncBit && config.waveform === SIDWaveform.NONE) {
        warnings.push({
          type: SyncWarningType.UNUSED_SYNC,
          message: `Voice ${config.voiceNumber} has sync enabled but no waveform`,
          affectedVoices: [config.voiceNumber],
          cyclePosition: this.currentCycle,
        });
      }

      // Warning: Sync with noise waveform
      if (config.syncBit && config.waveform === SIDWaveform.NOISE) {
        warnings.push({
          type: SyncWarningType.NOISE_SYNC,
          message: `Voice ${config.voiceNumber} uses sync with noise (limited effect)`,
          affectedVoices: [config.voiceNumber],
          cyclePosition: this.currentCycle,
        });
      }

      // Warning: Ring mod without triangle on master
      if (config.ringBit) {
        const masterVoice = RING_MATRIX.get(config.voiceNumber)!;
        const masterConfig = this.voiceConfigs[masterVoice - 1];

        if ((masterConfig.waveform & SIDWaveform.TRIANGLE) === 0) {
          warnings.push({
            type: SyncWarningType.RING_WITHOUT_TRI,
            message: `Voice ${config.voiceNumber} ring mod needs triangle on voice ${masterVoice}`,
            affectedVoices: [config.voiceNumber, masterVoice],
            cyclePosition: this.currentCycle,
          });
        }
      }
    }

    return warnings;
  }

  /**
   * Find optimization opportunities
   */
  protected findOptimizations(writes: SIDWriteOp[]): SyncOptimization[] {
    const optimizations: SyncOptimization[] = [];

    // Check for batching opportunities
    optimizations.push(...this.findBatchingOps(writes));

    // Check for control write combining
    optimizations.push(...this.findCombiningOps(writes));

    return optimizations;
  }

  /**
   * Find opportunities to batch sync setup writes
   */
  protected findBatchingOps(writes: SIDWriteOp[]): SyncOptimization[] {
    const optimizations: SyncOptimization[] = [];

    // Group control register writes
    const controlWrites = writes.filter(
      w => w.register.category === SIDRegisterCategory.VOICE_CONTROL
    );

    if (controlWrites.length >= 2) {
      const firstCycle = controlWrites[0].cyclePosition;
      const lastCycle = controlWrites[controlWrites.length - 1].cyclePosition;

      if (lastCycle - firstCycle > 12) {
        optimizations.push({
          type: SyncOptimizationType.BATCH_SYNC_SETUP,
          description: 'Batch voice control writes for tighter sync setup',
          cyclesSaved: Math.floor((lastCycle - firstCycle) * 0.3),
          affectedVoices: controlWrites.map(w => w.register.voiceNumber!),
        });
      }
    }

    return optimizations;
  }

  /**
   * Find opportunities to combine control writes
   */
  protected findCombiningOps(writes: SIDWriteOp[]): SyncOptimization[] {
    const optimizations: SyncOptimization[] = [];

    // Check for multiple writes to same control register
    const controlByVoice = new Map<number, SIDWriteOp[]>();

    for (const write of writes) {
      if (write.register.category === SIDRegisterCategory.VOICE_CONTROL) {
        const voice = write.register.voiceNumber!;
        const existing = controlByVoice.get(voice) || [];
        existing.push(write);
        controlByVoice.set(voice, existing);
      }
    }

    for (const [voice, vwrites] of controlByVoice) {
      if (vwrites.length >= 2) {
        optimizations.push({
          type: SyncOptimizationType.COMBINE_CONTROL_WRITES,
          description: `Combine ${vwrites.length} control writes for voice ${voice}`,
          cyclesSaved: (vwrites.length - 1) * 4,
          affectedVoices: [voice],
        });
      }
    }

    return optimizations;
  }

  /**
   * Get harmonic ratio between two frequencies
   */
  public getFrequencyRatio(freq1: number, freq2: number): number {
    if (freq2 === 0) return 0;
    return freq1 / freq2;
  }

  /**
   * Check if frequency ratio is harmonically useful
   */
  public isHarmonicRatio(ratio: number): boolean {
    // Check for simple ratios: 1:1, 2:1, 3:1, 3:2, 4:3, etc.
    const simpleRatios = [1, 2, 3, 4, 1.5, 1.333, 1.25, 0.5, 0.333, 0.25];
    return simpleRatios.some(r => Math.abs(ratio - r) < 0.01);
  }
}
```

---

## 5. Ring Modulation Analyzer

```typescript
// packages/compiler/src/optimizer/target/sid/sid-ring-mod.ts

import { SIDWaveform, VoiceSyncConfig } from './wave-sync-types.js';

/**
 * Ring modulation effect characteristics
 */
export interface RingModEffect {
  readonly slaveVoice: 1 | 2 | 3;
  readonly masterVoice: 1 | 2 | 3;
  readonly effectiveWaveform: 'metallic' | 'bell' | 'harsh' | 'subtle';
  readonly qualityScore: number; // 0-100
}

/**
 * Ring Modulation Analyzer
 *
 * Analyzes ring modulation configurations for audio quality
 * and provides optimization suggestions.
 */
export class RingModAnalyzer {
  /**
   * Analyze ring modulation setup
   */
  public analyzeRingMod(
    slaveConfig: VoiceSyncConfig,
    masterConfig: VoiceSyncConfig
  ): RingModEffect | null {
    if (!slaveConfig.ringBit) {
      return null;
    }

    const effectiveWaveform = this.determineEffect(slaveConfig, masterConfig);
    const qualityScore = this.calculateQuality(slaveConfig, masterConfig);

    return {
      slaveVoice: slaveConfig.voiceNumber,
      masterVoice: masterConfig.voiceNumber,
      effectiveWaveform,
      qualityScore,
    };
  }

  /**
   * Determine the effective ring mod sound character
   */
  protected determineEffect(
    slave: VoiceSyncConfig,
    master: VoiceSyncConfig
  ): 'metallic' | 'bell' | 'harsh' | 'subtle' {
    // Ring mod works best with triangle on master
    const masterHasTri = (master.waveform & SIDWaveform.TRIANGLE) !== 0;

    if (!masterHasTri) {
      return 'harsh'; // Non-triangle master creates harsh sounds
    }

    // Slave waveform affects character
    if (slave.waveform === SIDWaveform.TRIANGLE) {
      return 'bell';
    } else if (slave.waveform === SIDWaveform.SAWTOOTH) {
      return 'metallic';
    } else if (slave.waveform === SIDWaveform.PULSE) {
      return 'subtle';
    }

    return 'harsh';
  }

  /**
   * Calculate quality score for ring mod setup
   */
  protected calculateQuality(slave: VoiceSyncConfig, master: VoiceSyncConfig): number {
    let score = 50; // Base score

    // Triangle on master is essential for clean ring mod
    if ((master.waveform & SIDWaveform.TRIANGLE) !== 0) {
      score += 30;
    } else {
      score -= 20;
    }

    // Noise doesn't work well with ring mod
    if (slave.waveform === SIDWaveform.NOISE || master.waveform === SIDWaveform.NOISE) {
      score -= 30;
    }

    // Combined waveforms can create interesting effects
    if (this.hasCombinedWaveform(slave.waveform)) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if waveform is a combined waveform
   */
  protected hasCombinedWaveform(waveform: SIDWaveform): boolean {
    const combinedMask = SIDWaveform.TRI_SAW | SIDWaveform.TRI_PULSE | 
                         SIDWaveform.SAW_PULSE | SIDWaveform.TRI_SAW_PULSE;
    return (waveform & combinedMask) !== 0;
  }
}
```

---

## 6. Blend65 Syntax Integration

```js
// SID sync/ring mod examples for Blend65

@map SID_CTRL_1 at $D404: byte;
@map SID_CTRL_2 at $D40B: byte;
@map SID_CTRL_3 at $D412: byte;
@map SID_FREQ_LO_1 at $D400: byte;
@map SID_FREQ_HI_1 at $D401: byte;
@map SID_FREQ_LO_3 at $D40E: byte;
@map SID_FREQ_HI_3 at $D40F: byte;

// Hard sync setup - Voice 1 syncs to Voice 3
function setupHardSync(masterFreq: word, slaveFreq: word): void {
    // Set master frequency (Voice 3)
    SID_FREQ_LO_3 = <byte>masterFreq;
    SID_FREQ_HI_3 = <byte>(masterFreq >> 8);
    SID_CTRL_3 = $11; // Triangle + gate
    
    // Set slave frequency (Voice 1, syncs to Voice 3)
    SID_FREQ_LO_1 = <byte>slaveFreq;
    SID_FREQ_HI_1 = <byte>(slaveFreq >> 8);
    SID_CTRL_1 = $13; // Triangle + gate + SYNC
}

// Ring modulation setup - Voice 1 ring-mods with Voice 3
function setupRingMod(freq1: word, freq3: word): void {
    // Master voice needs triangle for clean ring mod
    SID_FREQ_LO_3 = <byte>freq3;
    SID_FREQ_HI_3 = <byte>(freq3 >> 8);
    SID_CTRL_3 = $11; // Triangle + gate
    
    // Slave voice with ring mod enabled
    SID_FREQ_LO_1 = <byte>freq1;
    SID_FREQ_HI_1 = <byte>(freq1 >> 8);
    SID_CTRL_1 = $15; // Triangle + gate + RING
}

// Combined sync + ring for complex timbres
function setupSyncRing(masterFreq: word, slaveFreq: word): void {
    SID_FREQ_LO_3 = <byte>masterFreq;
    SID_FREQ_HI_3 = <byte>(masterFreq >> 8);
    SID_CTRL_3 = $11; // Triangle + gate
    
    SID_FREQ_LO_1 = <byte>slaveFreq;
    SID_FREQ_HI_1 = <byte>(slaveFreq >> 8);
    SID_CTRL_1 = $17; // Triangle + gate + SYNC + RING
}
```

---

## 7. Test Requirements

| Category         | Test Cases | Coverage Target |
| ---------------- | ---------- | --------------- |
| Sync detection   | 5          | 100%            |
| Ring detection   | 5          | 100%            |
| Event tracking   | 5          | 100%            |
| Warning detect   | 4          | 100%            |
| Quality scoring  | 3          | 100%            |
| Optimization     | 3          | 100%            |
| **Total**        | **25**     | **100%**        |

---

## 8. Task Checklist

- [ ] Create type definitions for wave sync
- [ ] Implement wave sync analyzer
- [ ] Implement ring mod analyzer
- [ ] Implement sync event tracking
- [ ] Implement warning detection
- [ ] Implement optimization finder
- [ ] Create unit tests for all components

---

**Next Document**: `09-03a1-raster-irq-basic.md` (Session 4.3a1: Raster IRQ basic setup)
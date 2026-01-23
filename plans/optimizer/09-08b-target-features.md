# Task 9.8b: Platform Feature Flags & Detection

> **Session**: 4.8b
> **Phase**: 09-target-specific
> **Est. Time**: 45 min
> **Tests**: ~25 unit tests
> **Prerequisites**: Task 9.8a complete (Target emitter interface)

---

## Overview

This document defines the platform feature detection system that enables the compiler to generate optimized code for specific hardware configurations (PAL/NTSC, SID type, VIC-II revision).

---

## 1. Platform Features Overview

### 1.1 C64 Hardware Variations

```
C64 Hardware Matrix:
┌─────────────────────────────────────────────────────────────┐
│ Video:                                                      │
│   PAL:  312 lines, 63 cycles/line, 50 Hz                    │
│   NTSC: 263 lines, 65 cycles/line, 60 Hz (old)              │
│   NTSC: 262 lines, 64 cycles/line, 60 Hz (new)              │
│                                                             │
│ SID:                                                        │
│   6581: Original, DC offset, combined waveforms             │
│   8580: Revised, no DC offset, different filter             │
│                                                             │
│ VIC-II:                                                     │
│   6567: NTSC original                                       │
│   6567R8: NTSC revised                                      │
│   6569: PAL                                                 │
│   6572: PAL-N (Argentina)                                   │
│   8562: NTSC (C64C)                                         │
│   8565: PAL (C64C)                                          │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Feature Impact on Code Generation

| Feature       | Impact                               |
| ------------- | ------------------------------------ |
| PAL vs NTSC   | Cycles per line, total lines, timing |
| SID version   | Filter behavior, DC offset handling  |
| VIC revision  | Sprite timing, color RAM behavior    |
| RAM expansion | Available memory, bank switching     |

---

## 2. Directory Structure

```
packages/compiler/src/target/platform/
├── platform-features.ts      # Feature flag definitions
├── platform-detector.ts      # Runtime detection helpers
├── platform-config.ts        # Platform configuration
├── timing-tables.ts          # Platform-specific timing
└── index.ts                  # Public exports
```

---

## 3. Type Definitions

```typescript
// packages/compiler/src/target/platform/types.ts

/**
 * Video standard enumeration
 */
export enum VideoStandard {
  PAL = 'pal',
  NTSC = 'ntsc',
  NTSC_OLD = 'ntsc_old',
  PAL_N = 'pal_n',
}

/**
 * SID chip revision
 */
export enum SIDRevision {
  MOS6581 = '6581',
  MOS8580 = '8580',
  UNKNOWN = 'unknown',
}

/**
 * VIC-II chip revision
 */
export enum VICRevision {
  MOS6567 = '6567',     // NTSC original
  MOS6567R8 = '6567r8', // NTSC revised
  MOS6569 = '6569',     // PAL
  MOS6572 = '6572',     // PAL-N
  MOS8562 = '8562',     // NTSC (C64C)
  MOS8565 = '8565',     // PAL (C64C)
  UNKNOWN = 'unknown',
}

/**
 * Complete platform feature set
 */
export interface PlatformFeatures {
  readonly videoStandard: VideoStandard;
  readonly sidRevision: SIDRevision;
  readonly vicRevision: VICRevision;
  readonly cyclesPerLine: number;
  readonly linesPerFrame: number;
  readonly borderLines: { top: number; bottom: number };
  readonly displayLines: number;
  readonly clockSpeed: number; // Hz
  readonly hasREU: boolean;
  readonly hasGeoRAM: boolean;
}

/**
 * Platform timing constants
 */
export interface PlatformTiming {
  readonly cyclesPerLine: number;
  readonly visibleCyclesPerLine: number;
  readonly hBlankCycles: number;
  readonly linesPerFrame: number;
  readonly visibleLines: number;
  readonly vBlankLines: number;
  readonly frameRate: number;
  readonly cpuClock: number;
}

/**
 * Feature flag for conditional compilation
 */
export interface FeatureFlag {
  readonly name: string;
  readonly enabled: boolean;
  readonly requiredPlatform: VideoStandard | null;
  readonly description: string;
}

/**
 * Platform detection result
 */
export interface PlatformDetection {
  readonly detected: boolean;
  readonly features: PlatformFeatures;
  readonly confidence: number; // 0-100
  readonly detectionMethod: DetectionMethod;
}

export enum DetectionMethod {
  EXPLICIT = 'explicit',     // User specified
  COMPILE_TIME = 'compile_time', // Known at compile time
  RUNTIME = 'runtime',       // Detected at runtime
}
```

---

## 4. Platform Feature Definitions

```typescript
// packages/compiler/src/target/platform/platform-features.ts

import {
  VideoStandard,
  SIDRevision,
  VICRevision,
  PlatformFeatures,
  PlatformTiming,
} from './types.js';

/**
 * PAL platform features
 */
export const PAL_FEATURES: PlatformFeatures = {
  videoStandard: VideoStandard.PAL,
  sidRevision: SIDRevision.UNKNOWN,
  vicRevision: VICRevision.MOS6569,
  cyclesPerLine: 63,
  linesPerFrame: 312,
  borderLines: { top: 51, bottom: 61 },
  displayLines: 200,
  clockSpeed: 985248, // ~0.985 MHz
  hasREU: false,
  hasGeoRAM: false,
};

/**
 * NTSC platform features
 */
export const NTSC_FEATURES: PlatformFeatures = {
  videoStandard: VideoStandard.NTSC,
  sidRevision: SIDRevision.UNKNOWN,
  vicRevision: VICRevision.MOS6567,
  cyclesPerLine: 65,
  linesPerFrame: 263,
  borderLines: { top: 51, bottom: 12 },
  displayLines: 200,
  clockSpeed: 1022727, // ~1.023 MHz
  hasREU: false,
  hasGeoRAM: false,
};

/**
 * PAL timing constants
 */
export const PAL_TIMING: PlatformTiming = {
  cyclesPerLine: 63,
  visibleCyclesPerLine: 40,
  hBlankCycles: 23,
  linesPerFrame: 312,
  visibleLines: 200,
  vBlankLines: 112,
  frameRate: 50.125,
  cpuClock: 985248,
};

/**
 * NTSC timing constants
 */
export const NTSC_TIMING: PlatformTiming = {
  cyclesPerLine: 65,
  visibleCyclesPerLine: 40,
  hBlankCycles: 25,
  linesPerFrame: 263,
  visibleLines: 200,
  vBlankLines: 63,
  frameRate: 59.826,
  cpuClock: 1022727,
};

/**
 * Get timing constants for a video standard
 */
export function getTimingForStandard(standard: VideoStandard): PlatformTiming {
  switch (standard) {
    case VideoStandard.PAL:
    case VideoStandard.PAL_N:
      return PAL_TIMING;
    case VideoStandard.NTSC:
    case VideoStandard.NTSC_OLD:
      return NTSC_TIMING;
    default:
      return PAL_TIMING; // Default to PAL
  }
}

/**
 * Get features for a video standard
 */
export function getFeaturesForStandard(standard: VideoStandard): PlatformFeatures {
  switch (standard) {
    case VideoStandard.PAL:
    case VideoStandard.PAL_N:
      return PAL_FEATURES;
    case VideoStandard.NTSC:
    case VideoStandard.NTSC_OLD:
      return NTSC_FEATURES;
    default:
      return PAL_FEATURES;
  }
}
```

---

## 5. Platform Detector

```typescript
// packages/compiler/src/target/platform/platform-detector.ts

import {
  VideoStandard,
  SIDRevision,
  VICRevision,
  PlatformFeatures,
  PlatformDetection,
  DetectionMethod,
} from './types.js';
import { PAL_FEATURES, NTSC_FEATURES } from './platform-features.js';

/**
 * Platform Detector
 *
 * Provides utilities for detecting and configuring
 * platform-specific features.
 */
export class PlatformDetector {
  /**
   * Create platform features from explicit configuration
   */
  public static fromConfig(
    videoStandard: VideoStandard,
    sidRevision?: SIDRevision,
    vicRevision?: VICRevision
  ): PlatformDetection {
    const baseFeatures = videoStandard === VideoStandard.PAL || 
                         videoStandard === VideoStandard.PAL_N
      ? PAL_FEATURES
      : NTSC_FEATURES;

    return {
      detected: true,
      features: {
        ...baseFeatures,
        videoStandard,
        sidRevision: sidRevision ?? SIDRevision.UNKNOWN,
        vicRevision: vicRevision ?? this.defaultVIC(videoStandard),
      },
      confidence: 100,
      detectionMethod: DetectionMethod.EXPLICIT,
    };
  }

  /**
   * Get default VIC revision for video standard
   */
  protected static defaultVIC(standard: VideoStandard): VICRevision {
    switch (standard) {
      case VideoStandard.PAL:
        return VICRevision.MOS6569;
      case VideoStandard.NTSC:
        return VICRevision.MOS6567;
      case VideoStandard.PAL_N:
        return VICRevision.MOS6572;
      default:
        return VICRevision.UNKNOWN;
    }
  }

  /**
   * Generate runtime detection code
   */
  public static generateDetectionCode(): string[] {
    return [
      '; Platform detection routine',
      '; Detects PAL/NTSC and SID revision',
      '',
      'detect_platform:',
      '    ; Wait for raster line 0',
      '    LDA #$00',
      '    wait_raster:',
      '        CMP $D012',
      '        BNE wait_raster',
      '    ',
      '    ; Count lines until raster wraps',
      '    LDX #$00',
      '    count_lines:',
      '        LDA $D012',
      '        wait_line:',
      '            CMP $D012',
      '            BEQ wait_line',
      '        INX',
      '        BNE count_lines',
      '    ',
      '    ; X now contains low byte of line count',
      '    ; PAL: 312 ($138), NTSC: 263 ($107)',
      '    CPX #$38    ; PAL has $38 in low byte',
      '    BEQ is_pal',
      '    ',
      '    LDA #$01    ; NTSC',
      '    STA platform_type',
      '    RTS',
      '',
      'is_pal:',
      '    LDA #$00    ; PAL',
      '    STA platform_type',
      '    RTS',
      '',
      'platform_type:',
      '    .byte $00   ; 0=PAL, 1=NTSC',
    ];
  }

  /**
   * Generate SID detection code
   */
  public static generateSIDDetectionCode(): string[] {
    return [
      '; SID revision detection',
      '; Detects 6581 vs 8580 using filter behavior',
      '',
      'detect_sid:',
      '    ; Method: Check DC offset behavior',
      '    ; 6581 has DC offset, 8580 does not',
      '    ',
      '    LDA #$FF',
      '    STA $D418   ; Max volume',
      '    LDA #$00',
      '    STA $D417   ; Clear filter resonance',
      '    ',
      '    ; Set test bit to reset oscillator',
      '    LDA #$08',
      '    STA $D404',
      '    ',
      '    ; Read oscillator value',
      '    LDA $D41B',
      '    ',
      '    ; 6581 returns different value than 8580',
      '    CMP #$80',
      '    BCS is_6581',
      '    ',
      '    LDA #$01    ; 8580',
      '    STA sid_type',
      '    RTS',
      '',
      'is_6581:',
      '    LDA #$00    ; 6581',
      '    STA sid_type',
      '    RTS',
      '',
      'sid_type:',
      '    .byte $00   ; 0=6581, 1=8580',
    ];
  }
}
```

---

## 6. Feature Flag System

```typescript
// packages/compiler/src/target/platform/feature-flags.ts

import { VideoStandard, FeatureFlag, PlatformFeatures } from './types.js';

/**
 * Available feature flags
 */
export const FEATURE_FLAGS: Map<string, FeatureFlag> = new Map([
  ['PAL_ONLY', {
    name: 'PAL_ONLY',
    enabled: false,
    requiredPlatform: VideoStandard.PAL,
    description: 'Code only works on PAL machines',
  }],
  ['NTSC_ONLY', {
    name: 'NTSC_ONLY',
    enabled: false,
    requiredPlatform: VideoStandard.NTSC,
    description: 'Code only works on NTSC machines',
  }],
  ['SID_6581', {
    name: 'SID_6581',
    enabled: false,
    requiredPlatform: null,
    description: 'Requires 6581 SID features',
  }],
  ['SID_8580', {
    name: 'SID_8580',
    enabled: false,
    requiredPlatform: null,
    description: 'Requires 8580 SID features',
  }],
  ['REU_SUPPORT', {
    name: 'REU_SUPPORT',
    enabled: false,
    requiredPlatform: null,
    description: 'Uses REU if available',
  }],
]);

/**
 * Feature Flag Manager
 *
 * Manages conditional compilation based on platform features.
 */
export class FeatureFlagManager {
  protected flags: Map<string, boolean> = new Map();
  protected platform: PlatformFeatures;

  constructor(platform: PlatformFeatures) {
    this.platform = platform;
    this.initializeFlags();
  }

  /**
   * Initialize flags based on platform
   */
  protected initializeFlags(): void {
    // Set platform-specific flags
    this.flags.set('PAL', 
      this.platform.videoStandard === VideoStandard.PAL ||
      this.platform.videoStandard === VideoStandard.PAL_N
    );
    this.flags.set('NTSC', 
      this.platform.videoStandard === VideoStandard.NTSC ||
      this.platform.videoStandard === VideoStandard.NTSC_OLD
    );
    
    // SID flags
    this.flags.set('SID_6581', this.platform.sidRevision === '6581');
    this.flags.set('SID_8580', this.platform.sidRevision === '8580');
    
    // Expansion flags
    this.flags.set('HAS_REU', this.platform.hasREU);
    this.flags.set('HAS_GEORAM', this.platform.hasGeoRAM);
  }

  /**
   * Check if a flag is enabled
   */
  public isEnabled(flag: string): boolean {
    return this.flags.get(flag) ?? false;
  }

  /**
   * Set a flag value
   */
  public setFlag(flag: string, value: boolean): void {
    this.flags.set(flag, value);
  }

  /**
   * Get all enabled flags
   */
  public getEnabledFlags(): string[] {
    return Array.from(this.flags.entries())
      .filter(([_, enabled]) => enabled)
      .map(([name, _]) => name);
  }

  /**
   * Evaluate conditional compilation expression
   */
  public evaluate(expression: string): boolean {
    // Simple expression evaluator for #ifdef/#if style conditions
    // Supports: FLAG, !FLAG, FLAG && FLAG, FLAG || FLAG
    
    // Handle NOT
    if (expression.startsWith('!')) {
      return !this.isEnabled(expression.slice(1).trim());
    }
    
    // Handle AND
    if (expression.includes('&&')) {
      const parts = expression.split('&&').map(p => p.trim());
      return parts.every(p => this.evaluate(p));
    }
    
    // Handle OR
    if (expression.includes('||')) {
      const parts = expression.split('||').map(p => p.trim());
      return parts.some(p => this.evaluate(p));
    }
    
    // Simple flag check
    return this.isEnabled(expression.trim());
  }
}
```

---

## 7. Blend65 Syntax Integration

```js
// Platform-specific code in Blend65

// Compile-time platform configuration
@platform(pal)       // or @platform(ntsc)
@sid(6581)           // or @sid(8580)

// Conditional compilation based on platform
@if(PAL)
const CYCLES_PER_LINE: byte = 63;
@else
const CYCLES_PER_LINE: byte = 65;
@endif

// Runtime platform detection
function detectPlatform(): byte {
    // Returns 0 for PAL, 1 for NTSC
    asm {
        // Wait for raster line 0
        lda #$00
    wait:
        cmp $d012
        bne wait
        
        // Count high bit changes
        ldx #$00
    count:
        bit $d011
        bpl count  // Wait for line 256+
        inx
        bit $d011
        bmi count  // Wait for line < 256
        // X = number of frames with line > 255
    }
    
    if (x > 50) {
        return 0;  // PAL (312 lines)
    } else {
        return 1;  // NTSC (263 lines)
    }
}

// Platform-aware timing routine
function waitRasterLine(line: byte): void {
    @if(PAL)
        // PAL: 63 cycles per line
        let delay: byte = (line * 63) / 256;
    @else
        // NTSC: 65 cycles per line
        let delay: byte = (line * 65) / 256;
    @endif
    
    while (VIC_RASTER != line) { }
}
```

---

## 8. Test Requirements

| Category            | Test Cases | Coverage Target |
| ------------------- | ---------- | --------------- |
| Feature definitions | 4          | 100%            |
| Platform detection  | 5          | 100%            |
| Timing constants    | 4          | 100%            |
| Feature flags       | 5          | 100%            |
| Expression eval     | 4          | 100%            |
| Code generation     | 3          | 100%            |
| **Total**           | **25**     | **100%**        |

---

## 9. Task Checklist

- [ ] Create type definitions for platform features
- [ ] Implement platform feature constants
- [ ] Implement PlatformDetector class
- [ ] Implement FeatureFlagManager
- [ ] Implement runtime detection code generator
- [ ] Create unit tests for all components
- [ ] Integrate with target emitter interface

---

**Phase 09 Complete!**

All 14 active documents in Phase 09 (Target-Specific Optimizations) are now complete:
- VIC-II (6 documents)
- SID (2 documents)
- Raster IRQ (4 documents)
- Target Abstraction (2 documents)
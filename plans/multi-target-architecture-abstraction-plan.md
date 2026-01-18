# Multi-Target Architecture Abstraction Plan

> **Date:** 18 January 2026
> **Status:** Complete ✅
> **Priority:** Before Tier 4 Implementation
> **Estimated Time:** 8-12 hours

---

## Overview

This plan creates an abstraction layer so that hardware-specific analyzers and optimizers can be implemented for different target machines (C64, C128, X16, etc.) while sharing common 6502 CPU analysis code.

---

## User Decisions

1. **Implementation Order:** Abstract first, then implement Tier 4 tasks
2. **Target Priority:** C64 is primary; C128, X16 get "not implemented" placeholders
3. **CPU Priority:** 6502 is primary; 65C02, 65816 get placeholders
4. **Target Selection:** Via CLI flag (`--target c64`)

---

## Current State Assessment

### Currently C64-Specific (Hardcoded in `m6502-hints.ts`)

```typescript
// Reserved zero-page locations - C64 specific!
const RESERVED_ZERO_PAGE: ReservedRange[] = [
  { start: 0x00, end: 0x01, reason: 'CPU memory configuration registers (6510 I/O port)' },
  { start: 0x90, end: 0xff, reason: 'KERNAL workspace (used by BASIC/KERNAL routines)' },
];

const SAFE_ZERO_PAGE = { start: 0x02, end: 0x8f, size: 142 };
```

### What's Actually 6502-Common (Should Always Run)

- Register hints (A, X, Y preference)
- Zero-page priority scoring (concept applies to all)
- Stack overflow detection (256-byte limit is universal)
- Branch distance analysis (±127 bytes)
- Carry/Decimal flag dataflow
- Escape analysis, purity analysis, loop analysis
- Value range analysis, call graph analysis

### What's Hardware-Specific (Target-Dependent)

| Hardware | C64 | C128 | X16 (VERA) |
|----------|-----|------|------------|
| Graphics | VIC-II ($D000-$D3FF) | VIC-II / VDC ($D600) | VERA ($9F20+) |
| Sound | SID ($D400-$D7FF) | SID x2 | YM2151 / PSG |
| Zero Page Reserved | $00-$01, $90-$FF | Different KERNAL | Different ranges |
| Memory Map | 64K banked | 128K+ banked | Up to 2MB |
| Raster Timing | 63 cycles/line | Different | 40 MHz CPU! |
| CPU | 6510 (6502 variant) | 8502 | 65C02 |

---

## Architecture Design

### Three Analysis Levels

```
┌─────────────────────────────────────────────────────────────┐
│               Level 1: Universal (Always Run)               │
│  - Dead code, unused functions, constant propagation        │
│  - Liveness, reaching definitions, definite assignment      │
│  - GVN, CSE, loop invariants, value range analysis          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Level 2: 6502-Common (All Targets)             │
│  - Register hints (A, X, Y preference)                      │
│  - Branch distance analysis (±127 bytes)                    │
│  - Carry/Decimal flag dataflow                              │
│  - Stack depth analysis (256-byte limit)                    │
│  - Zero-page priority scoring (concept applies to all)      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│          Level 3: Target-Specific (Selected at Compile)     │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐          │
│  │   C64    │    │   C128   │    │   X16/VERA   │          │
│  ├──────────┤    ├──────────┤    ├──────────────┤          │
│  │ VIC-II   │    │ VIC-II   │    │ VERA timings │          │
│  │ SID      │    │ VDC      │    │ YM2151       │          │
│  │ $D000+   │    │ $D600+   │    │ $9F20+       │          │
│  │ ZP: 02-8F│    │ ZP: diff │    │ ZP: 22 bytes │          │
│  └──────────┘    └──────────┘    └──────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

### New Target System

```
packages/compiler/src/target/
├── index.ts                    # Exports
├── architecture.ts             # TargetArchitecture enum + CPUType enum
├── config.ts                   # TargetConfig interface + defaults
├── registry.ts                 # Target factory/registry
└── configs/
    ├── c64.ts                  # C64 configuration (full implementation)
    ├── c128.ts                 # Placeholder with "not implemented"
    └── x16.ts                  # Placeholder with "not implemented"
```

### New Hardware Analyzer Structure

```
packages/compiler/src/semantic/analysis/hardware/
├── index.ts                    # Exports
├── base-hardware-analyzer.ts   # Abstract base class
├── common-6502-analyzer.ts     # Common 6502 analysis (shared)
├── target-analyzer-registry.ts # Factory to get correct analyzer
└── c64/
    ├── index.ts
    ├── c64-hardware-analyzer.ts    # Extends base, implements C64-specific
    ├── c64-zero-page.ts            # C64 ZP reserved ranges
    ├── vic-ii-timing.ts            # VIC-II raster analysis (Tier 4)
    ├── sid-conflicts.ts            # SID resource conflicts (Tier 4)
    └── c64-memory-regions.ts       # C64 memory map (Tier 4)
```

---

## Core Type Definitions

### Target Architecture

```typescript
// packages/compiler/src/target/architecture.ts

/**
 * Supported target architectures
 */
export enum TargetArchitecture {
  /** Commodore 64 - Primary target */
  C64 = 'c64',
  
  /** Commodore 128 - Not yet implemented */
  C128 = 'c128',
  
  /** Commander X16 - Not yet implemented */
  X16 = 'x16',
  
  /** Generic 6502 - Minimal assumptions */
  Generic = 'generic',
}

/**
 * CPU types in the 6502 family
 */
export enum CPUType {
  /** Original MOS 6502 / 6510 */
  MOS6502 = '6502',
  
  /** WDC 65C02 with additional opcodes */
  WDC65C02 = '65c02',
  
  /** WDC 65816 with 16-bit mode */
  WDC65816 = '65816',
}
```

### Target Configuration

```typescript
// packages/compiler/src/target/config.ts

/**
 * Zero-page reserved range
 */
export interface ReservedZeroPageRange {
  /** Start address (inclusive) */
  start: number;
  /** End address (inclusive) */
  end: number;
  /** Human-readable reason */
  reason: string;
}

/**
 * Zero-page configuration for a target
 */
export interface ZeroPageConfig {
  /** Ranges that cannot be used (system reserved) */
  reservedRanges: ReservedZeroPageRange[];
  /** Safe range for user allocation */
  safeRange: { start: number; end: number };
  /** Total usable bytes */
  usableBytes: number;
}

/**
 * Graphics chip configuration
 */
export interface GraphicsChipConfig {
  /** Chip name (VIC-II, VDC, VERA) */
  name: string;
  /** Base register address */
  baseAddress: number;
  /** Cycles per raster line */
  cyclesPerLine: number;
  /** Lines per frame */
  linesPerFrame: number;
  /** Badline cycle penalty */
  badlinePenalty: number;
}

/**
 * Sound chip configuration
 */
export interface SoundChipConfig {
  /** Chip name (SID, PSG, YM2151) */
  name: string;
  /** Base register address */
  baseAddress: number;
  /** Number of voices */
  voices: number;
}

/**
 * Complete target configuration
 */
export interface TargetConfig {
  /** Target architecture identifier */
  architecture: TargetArchitecture;
  
  /** CPU type */
  cpu: CPUType;
  
  /** Clock speed in MHz */
  clockSpeedMHz: number;
  
  /** Total addressable memory in bytes */
  totalMemory: number;
  
  /** Zero-page configuration */
  zeroPage: ZeroPageConfig;
  
  /** Graphics chip (null if none) */
  graphicsChip: GraphicsChipConfig | null;
  
  /** Sound chip (null if none) */
  soundChip: SoundChipConfig | null;
  
  /** Whether target is fully implemented */
  implemented: boolean;
}
```

### C64 Configuration Example

```typescript
// packages/compiler/src/target/configs/c64.ts

export const C64_CONFIG: TargetConfig = {
  architecture: TargetArchitecture.C64,
  cpu: CPUType.MOS6502,
  clockSpeedMHz: 0.985,  // PAL: 985248 Hz
  totalMemory: 65536,    // 64K
  
  zeroPage: {
    reservedRanges: [
      { start: 0x00, end: 0x01, reason: 'CPU memory configuration (6510 I/O port)' },
      { start: 0x90, end: 0xff, reason: 'KERNAL workspace' },
    ],
    safeRange: { start: 0x02, end: 0x8f },
    usableBytes: 142,
  },
  
  graphicsChip: {
    name: 'VIC-II',
    baseAddress: 0xd000,
    cyclesPerLine: 63,
    linesPerFrame: 312,  // PAL
    badlinePenalty: 40,
  },
  
  soundChip: {
    name: 'SID',
    baseAddress: 0xd400,
    voices: 3,
  },
  
  implemented: true,
};
```

---

## Implementation Tasks

### Phase A: Target Architecture Foundation (2-3 hours)

| Task | Description | Status |
|------|-------------|--------|
| A.1 | Create `target/` directory structure | [ ] |
| A.2 | Define `TargetArchitecture` and `CPUType` enums | [ ] |
| A.3 | Define `TargetConfig` interface | [ ] |
| A.4 | Create `C64_CONFIG` with values from `m6502-hints.ts` | [ ] |
| A.5 | Create `TargetRegistry` factory | [ ] |
| A.6 | Create placeholder configs for C128, X16 | [ ] |

### Phase B: Hardware Analyzer Abstraction (3-4 hours)

| Task | Description | Status |
|------|-------------|--------|
| B.1 | Create `BaseHardwareAnalyzer` abstract class | [ ] |
| B.2 | Create `Common6502Analyzer` for shared logic | [ ] |
| B.3 | Create `TargetAnalyzerRegistry` factory | [ ] |
| B.4 | Create `C64HardwareAnalyzer` extending base | [ ] |
| B.5 | Create `c64-zero-page.ts` with C64 ZP logic | [ ] |
| B.6 | Create placeholder analyzers for C128, X16 | [ ] |

### Phase C: Refactor Existing Code (2-3 hours)

| Task | Description | Status |
|------|-------------|--------|
| C.1 | Extract C64-specific constants from `m6502-hints.ts` | [ ] |
| C.2 | Update `M6502HintAnalyzer` to use target config | [ ] |
| C.3 | Update `AdvancedAnalyzer` to accept `TargetConfig` | [ ] |
| C.4 | Add `runTier4HardwareAnalysis()` method | [ ] |
| C.5 | Ensure backward compatibility (default to C64) | [ ] |

### Phase D: Tests & Integration (1-2 hours)

| Task | Description | Status |
|------|-------------|--------|
| D.1 | Create `target/architecture.test.ts` | [ ] |
| D.2 | Create `target/registry.test.ts` | [ ] |
| D.3 | Create `hardware/base-hardware-analyzer.test.ts` | [ ] |
| D.4 | Create `hardware/c64/c64-hardware-analyzer.test.ts` | [ ] |
| D.5 | Verify all 1980 existing tests pass | [ ] |

---

## Files to Create

| File | Purpose |
|------|---------|
| `target/index.ts` | Exports |
| `target/architecture.ts` | `TargetArchitecture`, `CPUType` enums |
| `target/config.ts` | `TargetConfig` interface |
| `target/registry.ts` | Factory for getting target configs |
| `target/configs/c64.ts` | C64 full configuration |
| `target/configs/c128.ts` | Placeholder (throws error) |
| `target/configs/x16.ts` | Placeholder (throws error) |
| `analysis/hardware/index.ts` | Exports |
| `analysis/hardware/base-hardware-analyzer.ts` | Abstract base |
| `analysis/hardware/common-6502-analyzer.ts` | Shared 6502 logic |
| `analysis/hardware/target-analyzer-registry.ts` | Analyzer factory |
| `analysis/hardware/c64/index.ts` | C64 exports |
| `analysis/hardware/c64/c64-hardware-analyzer.ts` | C64 analyzer |
| `analysis/hardware/c64/c64-zero-page.ts` | C64 ZP logic |

## Files to Modify

| File | Changes |
|------|---------|
| `analysis/m6502-hints.ts` | Remove C64-specific hardcoding, use target config |
| `analysis/advanced-analyzer.ts` | Add `targetConfig` parameter, add Tier 4 method |
| `analysis/index.ts` | Export new hardware analyzers |

---

## Usage Example

```typescript
// Example: How compiler is invoked with target
import { TargetArchitecture, getTargetConfig } from './target/index.js';
import { AdvancedAnalyzer } from './semantic/analysis/index.js';

// Get target configuration from CLI flag
const target = parseCliArgs().target || 'c64';
const targetConfig = getTargetConfig(target as TargetArchitecture);

// Create analyzer with target
const analyzer = new AdvancedAnalyzer(
  symbolTable,
  cfgs,
  typeSystem,
  targetConfig  // NEW parameter
);

analyzer.analyze(ast);
```

---

## Backward Compatibility

To ensure existing code continues to work:

1. **Default Target:** If no target is specified, default to C64
2. **Existing Tests:** All existing tests should continue passing
3. **M6502HintAnalyzer:** Will internally use `targetConfig.zeroPage` instead of hardcoded values
4. **AdvancedAnalyzer:** Constructor signature changes but defaults to C64 config

---

## Future Expansion

After this foundation is in place, adding new targets requires:

1. Create `target/configs/[target].ts` with configuration
2. Create `analysis/hardware/[target]/` directory with analyzers
3. Register in `TargetRegistry` and `TargetAnalyzerRegistry`

No changes to core analyzer code needed!

---

## Success Criteria

- [ ] All 1980 existing tests pass
- [ ] C64 target works identically to current behavior
- [ ] C128/X16 targets throw "not implemented" error
- [ ] Target can be selected via `getTargetConfig()`
- [ ] Zero-page reserved ranges come from target config
- [ ] `AdvancedAnalyzer` accepts target configuration

---

## Next Steps After Completion

Once this abstraction is in place:

1. Implement Tier 4 tasks (VIC-II timing, SID conflicts, etc.) inside `analysis/hardware/c64/`
2. Future targets (C128, X16) can be implemented without touching core code
3. Each target can have its own hardware-specific analyzers

---

**Document Status:** Ready for Review

**Next Action:** Toggle to Act mode to begin implementation
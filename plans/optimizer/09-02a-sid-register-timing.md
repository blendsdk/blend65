# Task 9.2a: SID Register Write Timing

> **Session**: 4.2a
> **Phase**: 09-target-specific
> **Est. Time**: 45 min
> **Tests**: ~25 unit tests
> **Prerequisites**: Task 9.1b3 complete (VIC-II border effects)

---

## Overview

The SID (Sound Interface Device - 6581/8580) requires precise timing for register writes to achieve correct audio output. This document covers SID register write timing analysis and optimization for cycle-accurate sound programming.

---

## 1. SID Architecture Fundamentals

### 1.1 Register Map

| Address     | Register        | Description              | Write Timing   |
| ----------- | --------------- | ------------------------ | -------------- |
| $D400-$D406 | Voice 1         | Freq, PW, Control, AD/SR | Immediate      |
| $D407-$D40D | Voice 2         | Freq, PW, Control, AD/SR | Immediate      |
| $D40E-$D414 | Voice 3         | Freq, PW, Control, AD/SR | Immediate      |
| $D415-$D417 | Filter          | FC Lo/Hi, Res/Route      | 1 cycle settle |
| $D418       | Volume/Filter   | Master volume, modes     | Immediate      |
| $D419-$D41C | Paddle/OSC3/ENV | Read-only (mostly)       | N/A            |

### 1.2 Write Timing Characteristics

```
SID Register Write Timing:
┌─────────────────────────────────────────────────────────────┐
│ Cycle 0: STA $D4xx executed                                 │
│ Cycle 1: Data latched into SID register                     │
│ Cycle 2: Effect begins (voice/filter)                       │
│                                                             │
│ Critical: Filter resonance needs 1-cycle settle time        │
│ Critical: Gate bit transitions affect envelope immediately  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
packages/compiler/src/optimizer/target/sid/
├── sid-register-timing.ts      # Register timing analysis
├── sid-timing-context.ts       # Timing context tracking
├── sid-voice-analyzer.ts       # Per-voice optimization
├── sid-filter-analyzer.ts      # Filter timing analysis
└── index.ts                    # Public exports
```

---

## 3. Type Definitions

```typescript
// packages/compiler/src/optimizer/target/sid/types.ts

/**
 * SID chip version affects timing behavior
 */
export enum SIDVersion {
  MOS6581 = '6581', // Original, has DC offset
  MOS8580 = '8580', // Revised, no DC offset
}

/**
 * SID register categories for timing analysis
 */
export enum SIDRegisterCategory {
  VOICE_FREQ = 'voice_freq',
  VOICE_PW = 'voice_pw',
  VOICE_CONTROL = 'voice_control',
  VOICE_ADSR = 'voice_adsr',
  FILTER = 'filter',
  VOLUME = 'volume',
}

/**
 * Individual SID register with timing info
 */
export interface SIDRegister {
  readonly address: number;
  readonly name: string;
  readonly category: SIDRegisterCategory;
  readonly voiceNumber: number | null; // 1-3 or null for global
  readonly writeLatency: number; // Cycles until effect
  readonly isWriteOnly: boolean;
}

/**
 * SID write operation in IL
 */
export interface SIDWriteOp {
  readonly register: SIDRegister;
  readonly value: number | 'dynamic';
  readonly cyclePosition: number;
  readonly instruction: ILInstruction;
}

/**
 * Timing constraint for SID operations
 */
export interface SIDTimingConstraint {
  readonly minCyclesBetween: number;
  readonly reason: string;
  readonly registers: [SIDRegisterCategory, SIDRegisterCategory];
}

/**
 * SID timing analysis result
 */
export interface SIDTimingAnalysis {
  readonly writes: SIDWriteOp[];
  readonly violations: SIDTimingViolation[];
  readonly optimizations: SIDTimingOptimization[];
}

/**
 * Timing violation detected
 */
export interface SIDTimingViolation {
  readonly write1: SIDWriteOp;
  readonly write2: SIDWriteOp;
  readonly constraint: SIDTimingConstraint;
  readonly actualCycles: number;
  readonly severity: 'error' | 'warning';
}

/**
 * Suggested timing optimization
 */
export interface SIDTimingOptimization {
  readonly type: SIDOptimizationType;
  readonly writes: SIDWriteOp[];
  readonly cyclesSaved: number;
  readonly description: string;
}

export enum SIDOptimizationType {
  REORDER_WRITES = 'reorder_writes',
  BATCH_VOICE_UPDATE = 'batch_voice_update',
  INTERLEAVE_VOICES = 'interleave_voices',
  REMOVE_REDUNDANT = 'remove_redundant',
}
```

---

## 4. SID Register Timing Analyzer

```typescript
// packages/compiler/src/optimizer/target/sid/sid-register-timing.ts

import {
  SIDRegister,
  SIDRegisterCategory,
  SIDWriteOp,
  SIDTimingAnalysis,
  SIDTimingConstraint,
  SIDTimingViolation,
  SIDTimingOptimization,
  SIDOptimizationType,
  SIDVersion,
} from './types.js';
import { ILInstruction, ILOpcode } from '../../../il/types.js';
import { BasicBlock } from '../../../il/cfg.js';

/**
 * Complete SID register map with timing characteristics
 */
const SID_REGISTERS: Map<number, SIDRegister> = new Map([
  // Voice 1
  [0xd400, { address: 0xd400, name: 'FRELO1', category: SIDRegisterCategory.VOICE_FREQ, voiceNumber: 1, writeLatency: 0, isWriteOnly: true }],
  [0xd401, { address: 0xd401, name: 'FREHI1', category: SIDRegisterCategory.VOICE_FREQ, voiceNumber: 1, writeLatency: 0, isWriteOnly: true }],
  [0xd402, { address: 0xd402, name: 'PWLO1', category: SIDRegisterCategory.VOICE_PW, voiceNumber: 1, writeLatency: 0, isWriteOnly: true }],
  [0xd403, { address: 0xd403, name: 'PWHI1', category: SIDRegisterCategory.VOICE_PW, voiceNumber: 1, writeLatency: 0, isWriteOnly: true }],
  [0xd404, { address: 0xd404, name: 'VCREG1', category: SIDRegisterCategory.VOICE_CONTROL, voiceNumber: 1, writeLatency: 0, isWriteOnly: true }],
  [0xd405, { address: 0xd405, name: 'ATDCY1', category: SIDRegisterCategory.VOICE_ADSR, voiceNumber: 1, writeLatency: 0, isWriteOnly: true }],
  [0xd406, { address: 0xd406, name: 'SUREL1', category: SIDRegisterCategory.VOICE_ADSR, voiceNumber: 1, writeLatency: 0, isWriteOnly: true }],
  // Voice 2
  [0xd407, { address: 0xd407, name: 'FRELO2', category: SIDRegisterCategory.VOICE_FREQ, voiceNumber: 2, writeLatency: 0, isWriteOnly: true }],
  [0xd408, { address: 0xd408, name: 'FREHI2', category: SIDRegisterCategory.VOICE_FREQ, voiceNumber: 2, writeLatency: 0, isWriteOnly: true }],
  [0xd409, { address: 0xd409, name: 'PWLO2', category: SIDRegisterCategory.VOICE_PW, voiceNumber: 2, writeLatency: 0, isWriteOnly: true }],
  [0xd40a, { address: 0xd40a, name: 'PWHI2', category: SIDRegisterCategory.VOICE_PW, voiceNumber: 2, writeLatency: 0, isWriteOnly: true }],
  [0xd40b, { address: 0xd40b, name: 'VCREG2', category: SIDRegisterCategory.VOICE_CONTROL, voiceNumber: 2, writeLatency: 0, isWriteOnly: true }],
  [0xd40c, { address: 0xd40c, name: 'ATDCY2', category: SIDRegisterCategory.VOICE_ADSR, voiceNumber: 2, writeLatency: 0, isWriteOnly: true }],
  [0xd40d, { address: 0xd40d, name: 'SUREL2', category: SIDRegisterCategory.VOICE_ADSR, voiceNumber: 2, writeLatency: 0, isWriteOnly: true }],
  // Voice 3
  [0xd40e, { address: 0xd40e, name: 'FRELO3', category: SIDRegisterCategory.VOICE_FREQ, voiceNumber: 3, writeLatency: 0, isWriteOnly: true }],
  [0xd40f, { address: 0xd40f, name: 'FREHI3', category: SIDRegisterCategory.VOICE_FREQ, voiceNumber: 3, writeLatency: 0, isWriteOnly: true }],
  [0xd410, { address: 0xd410, name: 'PWLO3', category: SIDRegisterCategory.VOICE_PW, voiceNumber: 3, writeLatency: 0, isWriteOnly: true }],
  [0xd411, { address: 0xd411, name: 'PWHI3', category: SIDRegisterCategory.VOICE_PW, voiceNumber: 3, writeLatency: 0, isWriteOnly: true }],
  [0xd412, { address: 0xd412, name: 'VCREG3', category: SIDRegisterCategory.VOICE_CONTROL, voiceNumber: 3, writeLatency: 0, isWriteOnly: true }],
  [0xd413, { address: 0xd413, name: 'ATDCY3', category: SIDRegisterCategory.VOICE_ADSR, voiceNumber: 3, writeLatency: 0, isWriteOnly: true }],
  [0xd414, { address: 0xd414, name: 'SUREL3', category: SIDRegisterCategory.VOICE_ADSR, voiceNumber: 3, writeLatency: 0, isWriteOnly: true }],
  // Filter
  [0xd415, { address: 0xd415, name: 'FCLO', category: SIDRegisterCategory.FILTER, voiceNumber: null, writeLatency: 1, isWriteOnly: true }],
  [0xd416, { address: 0xd416, name: 'FCHI', category: SIDRegisterCategory.FILTER, voiceNumber: null, writeLatency: 1, isWriteOnly: true }],
  [0xd417, { address: 0xd417, name: 'RESON', category: SIDRegisterCategory.FILTER, voiceNumber: null, writeLatency: 1, isWriteOnly: true }],
  // Volume/Mode
  [0xd418, { address: 0xd418, name: 'SIGVOL', category: SIDRegisterCategory.VOLUME, voiceNumber: null, writeLatency: 0, isWriteOnly: true }],
]);

/**
 * Timing constraints between SID register writes
 */
const SID_TIMING_CONSTRAINTS: SIDTimingConstraint[] = [
  {
    minCyclesBetween: 1,
    reason: 'Filter cutoff needs settle time before resonance change',
    registers: [SIDRegisterCategory.FILTER, SIDRegisterCategory.FILTER],
  },
  {
    minCyclesBetween: 2,
    reason: 'Gate release before attack for clean note restart',
    registers: [SIDRegisterCategory.VOICE_CONTROL, SIDRegisterCategory.VOICE_CONTROL],
  },
];

/**
 * SID Register Timing Analyzer
 *
 * Analyzes SID register write patterns for timing correctness
 * and optimization opportunities.
 */
export class SIDRegisterTimingAnalyzer {
  protected readonly sidVersion: SIDVersion;
  protected readonly writes: SIDWriteOp[] = [];

  constructor(sidVersion: SIDVersion = SIDVersion.MOS6581) {
    this.sidVersion = sidVersion;
  }

  /**
   * Check if an address is a SID register
   */
  public isSIDAddress(address: number): boolean {
    return address >= 0xd400 && address <= 0xd41c;
  }

  /**
   * Get SID register info for an address
   */
  public getRegister(address: number): SIDRegister | undefined {
    return SID_REGISTERS.get(address);
  }

  /**
   * Analyze a basic block for SID write patterns
   */
  public analyzeBlock(block: BasicBlock): SIDTimingAnalysis {
    const writes = this.collectSIDWrites(block);
    const violations = this.detectViolations(writes);
    const optimizations = this.findOptimizations(writes);

    return { writes, violations, optimizations };
  }

  /**
   * Collect all SID writes from a basic block
   */
  protected collectSIDWrites(block: BasicBlock): SIDWriteOp[] {
    const writes: SIDWriteOp[] = [];
    let cyclePosition = 0;

    for (const instr of block.instructions) {
      // Track cycle position
      cyclePosition += this.getInstructionCycles(instr);

      // Check for SID writes (store to $D4xx)
      if (this.isSIDWrite(instr)) {
        const address = this.extractAddress(instr);
        const register = this.getRegister(address);

        if (register) {
          writes.push({
            register,
            value: this.extractValue(instr),
            cyclePosition,
            instruction: instr,
          });
        }
      }
    }

    return writes;
  }

  /**
   * Detect timing violations in SID writes
   */
  protected detectViolations(writes: SIDWriteOp[]): SIDTimingViolation[] {
    const violations: SIDTimingViolation[] = [];

    for (let i = 0; i < writes.length - 1; i++) {
      const write1 = writes[i];
      const write2 = writes[i + 1];

      for (const constraint of SID_TIMING_CONSTRAINTS) {
        if (this.violatesConstraint(write1, write2, constraint)) {
          const actualCycles = write2.cyclePosition - write1.cyclePosition;
          violations.push({
            write1,
            write2,
            constraint,
            actualCycles,
            severity: actualCycles < 0 ? 'error' : 'warning',
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check if two writes violate a timing constraint
   */
  protected violatesConstraint(
    write1: SIDWriteOp,
    write2: SIDWriteOp,
    constraint: SIDTimingConstraint
  ): boolean {
    const [cat1, cat2] = constraint.registers;

    if (write1.register.category === cat1 && write2.register.category === cat2) {
      const actualCycles = write2.cyclePosition - write1.cyclePosition;
      return actualCycles < constraint.minCyclesBetween;
    }

    return false;
  }

  /**
   * Find optimization opportunities in SID writes
   */
  protected findOptimizations(writes: SIDWriteOp[]): SIDTimingOptimization[] {
    const optimizations: SIDTimingOptimization[] = [];

    // Check for voice batching opportunities
    optimizations.push(...this.findVoiceBatchingOps(writes));

    // Check for redundant writes
    optimizations.push(...this.findRedundantWrites(writes));

    // Check for reordering opportunities
    optimizations.push(...this.findReorderingOps(writes));

    return optimizations;
  }

  /**
   * Find opportunities to batch voice register updates
   */
  protected findVoiceBatchingOps(writes: SIDWriteOp[]): SIDTimingOptimization[] {
    const optimizations: SIDTimingOptimization[] = [];

    // Group writes by voice
    const voiceWrites = new Map<number, SIDWriteOp[]>();
    for (const write of writes) {
      if (write.register.voiceNumber !== null) {
        const existing = voiceWrites.get(write.register.voiceNumber) || [];
        existing.push(write);
        voiceWrites.set(write.register.voiceNumber, existing);
      }
    }

    // Check for scattered voice updates that could be batched
    for (const [voice, vwrites] of voiceWrites) {
      if (vwrites.length >= 3) {
        const firstCycle = vwrites[0].cyclePosition;
        const lastCycle = vwrites[vwrites.length - 1].cyclePosition;
        const span = lastCycle - firstCycle;

        // If writes span more than 20 cycles, batching might help
        if (span > 20) {
          optimizations.push({
            type: SIDOptimizationType.BATCH_VOICE_UPDATE,
            writes: vwrites,
            cyclesSaved: Math.floor(span * 0.2), // Estimate
            description: `Batch voice ${voice} updates for tighter timing`,
          });
        }
      }
    }

    return optimizations;
  }

  /**
   * Find redundant SID writes
   */
  protected findRedundantWrites(writes: SIDWriteOp[]): SIDTimingOptimization[] {
    const optimizations: SIDTimingOptimization[] = [];
    const lastValueByRegister = new Map<number, number | 'dynamic'>();

    for (const write of writes) {
      const lastValue = lastValueByRegister.get(write.register.address);

      if (lastValue !== undefined && lastValue === write.value && write.value !== 'dynamic') {
        optimizations.push({
          type: SIDOptimizationType.REMOVE_REDUNDANT,
          writes: [write],
          cyclesSaved: 4, // STA absolute cycles
          description: `Remove redundant write to ${write.register.name}`,
        });
      }

      lastValueByRegister.set(write.register.address, write.value);
    }

    return optimizations;
  }

  /**
   * Find reordering opportunities
   */
  protected findReorderingOps(writes: SIDWriteOp[]): SIDTimingOptimization[] {
    const optimizations: SIDTimingOptimization[] = [];

    // Look for filter writes that could be done earlier
    for (let i = 0; i < writes.length; i++) {
      const write = writes[i];
      if (write.register.category === SIDRegisterCategory.FILTER) {
        // Check if there's dead time before where this could be moved
        if (i > 0 && writes[i - 1].register.category !== SIDRegisterCategory.FILTER) {
          const gap = write.cyclePosition - writes[i - 1].cyclePosition;
          if (gap > 10) {
            optimizations.push({
              type: SIDOptimizationType.REORDER_WRITES,
              writes: [write],
              cyclesSaved: 0, // Reordering doesn't save cycles directly
              description: `Move filter write earlier to allow settle time`,
            });
          }
        }
      }
    }

    return optimizations;
  }

  /**
   * Check if instruction is a SID write
   */
  protected isSIDWrite(instr: ILInstruction): boolean {
    // Check for store operations to SID address range
    if (instr.opcode === ILOpcode.STORE) {
      const address = this.extractAddress(instr);
      return this.isSIDAddress(address);
    }
    return false;
  }

  /**
   * Extract target address from instruction
   */
  protected extractAddress(instr: ILInstruction): number {
    // Implementation depends on IL structure
    return instr.operands?.[0]?.value ?? 0;
  }

  /**
   * Extract value being written
   */
  protected extractValue(instr: ILInstruction): number | 'dynamic' {
    const valueOp = instr.operands?.[1];
    if (valueOp?.kind === 'immediate') {
      return valueOp.value;
    }
    return 'dynamic';
  }

  /**
   * Get cycle count for instruction
   */
  protected getInstructionCycles(instr: ILInstruction): number {
    // Simplified - actual implementation uses instruction tables
    return 4; // Default for most store operations
  }
}
```

---

## 5. SID Timing Context

```typescript
// packages/compiler/src/optimizer/target/sid/sid-timing-context.ts

import { SIDRegister, SIDWriteOp, SIDVersion } from './types.js';

/**
 * Voice state for timing tracking
 */
interface VoiceState {
  readonly frequency: number | 'unknown';
  readonly pulseWidth: number | 'unknown';
  readonly waveform: number | 'unknown';
  readonly gate: boolean | 'unknown';
  readonly adsr: { attack: number; decay: number; sustain: number; release: number } | 'unknown';
}

/**
 * Filter state for timing tracking
 */
interface FilterState {
  readonly cutoff: number | 'unknown';
  readonly resonance: number | 'unknown';
  readonly routing: number | 'unknown';
}

/**
 * Complete SID state snapshot
 */
export interface SIDState {
  readonly voices: [VoiceState, VoiceState, VoiceState];
  readonly filter: FilterState;
  readonly volume: number | 'unknown';
}

/**
 * SID Timing Context
 *
 * Tracks SID state across multiple writes to enable
 * timing-aware optimizations.
 */
export class SIDTimingContext {
  protected readonly sidVersion: SIDVersion;
  protected state: SIDState;
  protected writeHistory: SIDWriteOp[] = [];
  protected cycleCount: number = 0;

  constructor(sidVersion: SIDVersion = SIDVersion.MOS6581) {
    this.sidVersion = sidVersion;
    this.state = this.createInitialState();
  }

  /**
   * Create initial unknown state
   */
  protected createInitialState(): SIDState {
    const unknownVoice: VoiceState = {
      frequency: 'unknown',
      pulseWidth: 'unknown',
      waveform: 'unknown',
      gate: 'unknown',
      adsr: 'unknown',
    };

    return {
      voices: [unknownVoice, unknownVoice, unknownVoice],
      filter: {
        cutoff: 'unknown',
        resonance: 'unknown',
        routing: 'unknown',
      },
      volume: 'unknown',
    };
  }

  /**
   * Record a SID write operation
   */
  public recordWrite(write: SIDWriteOp): void {
    this.writeHistory.push(write);
    this.updateState(write);
  }

  /**
   * Update internal state based on write
   */
  protected updateState(write: SIDWriteOp): void {
    if (write.value === 'dynamic') {
      // Can't track dynamic values
      return;
    }

    const reg = write.register;
    const value = write.value;

    // Update voice state
    if (reg.voiceNumber !== null) {
      const voiceIndex = reg.voiceNumber - 1;
      // State update logic based on register category
      // (simplified - full implementation tracks all registers)
    }
  }

  /**
   * Advance cycle counter
   */
  public advanceCycles(count: number): void {
    this.cycleCount += count;
  }

  /**
   * Get current cycle position
   */
  public getCyclePosition(): number {
    return this.cycleCount;
  }

  /**
   * Get current SID state
   */
  public getState(): SIDState {
    return this.state;
  }

  /**
   * Get write history
   */
  public getWriteHistory(): readonly SIDWriteOp[] {
    return this.writeHistory;
  }

  /**
   * Check if a write would be redundant
   */
  public isRedundantWrite(register: SIDRegister, value: number): boolean {
    // Check if state already has this value
    // Implementation depends on register type
    return false;
  }

  /**
   * Get minimum cycles until next filter write is safe
   */
  public getCyclesUntilFilterSafe(): number {
    const lastFilterWrite = this.writeHistory
      .filter(w => w.register.category === 'filter')
      .pop();

    if (!lastFilterWrite) {
      return 0;
    }

    const cyclesSince = this.cycleCount - lastFilterWrite.cyclePosition;
    return Math.max(0, 1 - cyclesSince); // 1 cycle settle time
  }

  /**
   * Get minimum cycles until gate can be toggled for clean restart
   */
  public getCyclesUntilGateSafe(voiceNumber: number): number {
    const lastGateWrite = this.writeHistory
      .filter(w => 
        w.register.category === 'voice_control' && 
        w.register.voiceNumber === voiceNumber
      )
      .pop();

    if (!lastGateWrite) {
      return 0;
    }

    const cyclesSince = this.cycleCount - lastGateWrite.cyclePosition;
    return Math.max(0, 2 - cyclesSince); // 2 cycles for clean gate
  }
}
```

---

## 6. Blend65 Syntax Integration

```js
// SID register definitions for Blend65
@map SID_FREQ_LO_1 at $D400: byte;
@map SID_FREQ_HI_1 at $D401: byte;
@map SID_PW_LO_1 at $D402: byte;
@map SID_PW_HI_1 at $D403: byte;
@map SID_CONTROL_1 at $D404: byte;
@map SID_ATTACK_DECAY_1 at $D405: byte;
@map SID_SUSTAIN_RELEASE_1 at $D406: byte;

@map SID_FILTER_LO at $D415: byte;
@map SID_FILTER_HI at $D416: byte;
@map SID_RESONANCE at $D417: byte;
@map SID_VOLUME at $D418: byte;

// Timing-aware SID update (compiler optimizes write order)
function playNote(freq: word, voice: byte): void {
    // Compiler will batch these writes efficiently
    SID_FREQ_LO_1 = <byte>freq;
    SID_FREQ_HI_1 = <byte>(freq >> 8);
    SID_CONTROL_1 = $11; // Triangle + gate
}

// Filter update with proper timing
function setFilter(cutoff: word, resonance: byte): void {
    // Compiler ensures 1-cycle gap between filter writes
    SID_FILTER_LO = <byte>cutoff;
    SID_FILTER_HI = <byte>(cutoff >> 8);
    SID_RESONANCE = resonance;
}
```

---

## 7. Test Requirements

| Category          | Test Cases | Coverage Target |
| ----------------- | ---------- | --------------- |
| Register mapping  | 5          | 100%            |
| Timing detection  | 6          | 100%            |
| Violation detect  | 5          | 100%            |
| Optimization find | 5          | 100%            |
| State tracking    | 4          | 100%            |
| **Total**         | **25**     | **100%**        |

---

## 8. Task Checklist

- [ ] Create type definitions for SID timing
- [ ] Implement SID register map with timing info
- [ ] Implement timing violation detection
- [ ] Implement optimization finder
- [ ] Implement SID timing context
- [ ] Create unit tests for all components
- [ ] Integrate with IL optimizer pipeline

---

**Next Document**: `09-02b-sid-wave-sync.md` (Session 4.2b: SID waveform synchronization)
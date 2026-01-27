# Task 9.3a1: Raster IRQ Basic Setup

> **Session**: 4.3a1
> **Phase**: 09-target-specific
> **Est. Time**: 45 min
> **Tests**: ~25 unit tests
> **Prerequisites**: Task 9.2b complete (SID waveform sync)

---

## Overview

Raster interrupts are the foundation of all advanced C64 effects. This document covers the basic setup and analysis of raster IRQ handlers, including CIA/VIC coordination and proper acknowledgment sequences.

---

## 1. Raster IRQ Fundamentals

### 1.1 VIC-II Raster Interrupt System

```
Raster IRQ Flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Write raster line to $D012/$D011.7                       │
│ 2. Enable raster IRQ in $D01A (bit 0)                       │
│ 3. VIC triggers IRQ when beam reaches line                  │
│ 4. CPU vectors through $FFFE/$FFFF (or $0314/$0315)         │
│ 5. IRQ handler must:                                        │
│    a. Acknowledge IRQ by writing to $D019                   │
│    b. Optionally set next raster line                       │
│    c. Return with RTI                                       │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Key Registers

| Address | Name    | Description                          |
| ------- | ------- | ------------------------------------ |
| $D011   | SCROLY  | Bit 7 = MSB of raster line           |
| $D012   | RASTER  | Current raster line / trigger line   |
| $D019   | IRQFLAG | Interrupt flags (write 1 to ack)     |
| $D01A   | IRQMASK | Interrupt enable mask                |
| $0314   | CINV    | IRQ vector (low) - via Kernal        |
| $0315   | CINV+1  | IRQ vector (high) - via Kernal       |
| $FFFE   | IRQVEC  | Hardware IRQ vector (low)            |
| $FFFF   | IRQVEC  | Hardware IRQ vector (high)           |

### 1.3 Raster Line Range

```
PAL (312 lines):
┌─────────────────────────────────────────────────────────────┐
│ Lines 0-50:     Top border (51 lines)                       │
│ Lines 51-250:   Main screen area (200 lines)                │
│ Lines 251-311:  Bottom border + vblank (61 lines)           │
│                                                             │
│ Note: Line numbers > 255 require $D011 bit 7 set            │
└─────────────────────────────────────────────────────────────┘

NTSC (263 lines):
┌─────────────────────────────────────────────────────────────┐
│ Lines 0-50:     Top border (51 lines)                       │
│ Lines 51-250:   Main screen area (200 lines)                │
│ Lines 251-262:  Bottom border + vblank (12 lines)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
packages/compiler/src/optimizer/target/raster/
├── raster-irq-setup.ts      # Basic IRQ setup analysis
├── raster-line-tracker.ts   # Raster line tracking
├── irq-vector-analyzer.ts   # Vector setup analysis
├── irq-ack-analyzer.ts      # Acknowledgment analysis
└── index.ts                 # Public exports
```

---

## 3. Type Definitions

```typescript
// packages/compiler/src/optimizer/target/raster/types.ts

/**
 * Target platform for raster timing
 */
export enum RasterPlatform {
  PAL = 'pal',
  NTSC = 'ntsc',
}

/**
 * IRQ vector mode
 */
export enum IRQVectorMode {
  KERNAL = 'kernal',    // Uses $0314/$0315
  HARDWARE = 'hardware', // Uses $FFFE/$FFFF (requires ROM disabled)
}

/**
 * Raster line configuration
 */
export interface RasterLineConfig {
  readonly line: number; // 0-311 PAL, 0-262 NTSC
  readonly uses9thBit: boolean; // Line > 255
}

/**
 * IRQ handler configuration
 */
export interface IRQHandlerConfig {
  readonly vectorMode: IRQVectorMode;
  readonly handlerAddress: number;
  readonly triggerLine: RasterLineConfig;
  readonly acknowledgesIRQ: boolean;
  readonly chainsToNext: boolean;
  readonly nextTriggerLine: RasterLineConfig | null;
}

/**
 * Raster IRQ setup sequence
 */
export interface RasterIRQSetup {
  readonly disableInterrupts: boolean;
  readonly disablesCIA: boolean;
  readonly setsRasterLine: boolean;
  readonly enablesRasterIRQ: boolean;
  readonly setsVector: boolean;
  readonly enablesInterrupts: boolean;
  readonly isComplete: boolean;
  readonly issues: RasterSetupIssue[];
}

/**
 * Issue detected in raster IRQ setup
 */
export interface RasterSetupIssue {
  readonly type: RasterSetupIssueType;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly cyclePosition: number;
}

export enum RasterSetupIssueType {
  MISSING_SEI = 'missing_sei',
  MISSING_ACK = 'missing_ack',
  CIA_NOT_DISABLED = 'cia_not_disabled',
  VECTOR_NOT_SET = 'vector_not_set',
  RASTER_NOT_ENABLED = 'raster_not_enabled',
  LINE_OUT_OF_RANGE = 'line_out_of_range',
  MISSING_CLI = 'missing_cli',
  ACK_WRONG_VALUE = 'ack_wrong_value',
}

/**
 * Raster IRQ optimization opportunity
 */
export interface RasterIRQOptimization {
  readonly type: RasterOptimizationType;
  readonly description: string;
  readonly cyclesSaved: number;
}

export enum RasterOptimizationType {
  COMBINE_SETUP = 'combine_setup',
  OPTIMIZE_ACK = 'optimize_ack',
  INLINE_HANDLER = 'inline_handler',
  REMOVE_REDUNDANT_SEI = 'remove_redundant_sei',
}
```

---

## 4. Raster IRQ Setup Analyzer

```typescript
// packages/compiler/src/optimizer/target/raster/raster-irq-setup.ts

import {
  RasterPlatform,
  IRQVectorMode,
  RasterLineConfig,
  IRQHandlerConfig,
  RasterIRQSetup,
  RasterSetupIssue,
  RasterSetupIssueType,
  RasterIRQOptimization,
  RasterOptimizationType,
} from './types.js';
import { ILInstruction, ILOpcode } from '../../../il/types.js';
import { BasicBlock } from '../../../il/cfg.js';

/**
 * VIC-II register addresses
 */
const VIC_REGISTERS = {
  SCROLY: 0xd011,
  RASTER: 0xd012,
  IRQFLAG: 0xd019,
  IRQMASK: 0xd01a,
};

/**
 * CIA register addresses
 */
const CIA_REGISTERS = {
  CIA1_ICR: 0xdc0d,
  CIA2_ICR: 0xdd0d,
};

/**
 * IRQ vector addresses
 */
const IRQ_VECTORS = {
  KERNAL_LO: 0x0314,
  KERNAL_HI: 0x0315,
  HARDWARE_LO: 0xfffe,
  HARDWARE_HI: 0xffff,
};

/**
 * Raster IRQ Setup Analyzer
 *
 * Analyzes code for correct raster IRQ setup patterns
 * and identifies issues or optimization opportunities.
 */
export class RasterIRQSetupAnalyzer {
  protected readonly platform: RasterPlatform;
  protected setupState: RasterIRQSetup;
  protected issues: RasterSetupIssue[] = [];
  protected currentCycle: number = 0;

  constructor(platform: RasterPlatform = RasterPlatform.PAL) {
    this.platform = platform;
    this.setupState = this.createInitialState();
  }

  /**
   * Create initial setup state
   */
  protected createInitialState(): RasterIRQSetup {
    return {
      disableInterrupts: false,
      disablesCIA: false,
      setsRasterLine: false,
      enablesRasterIRQ: false,
      setsVector: false,
      enablesInterrupts: false,
      isComplete: false,
      issues: [],
    };
  }

  /**
   * Get maximum raster line for platform
   */
  public getMaxRasterLine(): number {
    return this.platform === RasterPlatform.PAL ? 311 : 262;
  }

  /**
   * Check if raster line is valid
   */
  public isValidRasterLine(line: number): boolean {
    return line >= 0 && line <= this.getMaxRasterLine();
  }

  /**
   * Check if line requires 9th bit
   */
  public requires9thBit(line: number): boolean {
    return line > 255;
  }

  /**
   * Analyze a basic block for raster IRQ setup
   */
  public analyzeBlock(block: BasicBlock): RasterIRQSetup {
    this.issues = [];
    this.setupState = this.createInitialState();
    this.currentCycle = 0;

    for (const instr of block.instructions) {
      this.analyzeInstruction(instr);
      this.currentCycle += this.getInstructionCycles(instr);
    }

    // Check for completeness
    this.validateSetup();

    return {
      ...this.setupState,
      isComplete: this.isSetupComplete(),
      issues: this.issues,
    };
  }

  /**
   * Analyze a single instruction for IRQ setup patterns
   */
  protected analyzeInstruction(instr: ILInstruction): void {
    // Check for SEI (disable interrupts)
    if (this.isSEI(instr)) {
      this.setupState = { ...this.setupState, disableInterrupts: true };
    }

    // Check for CLI (enable interrupts)
    if (this.isCLI(instr)) {
      this.setupState = { ...this.setupState, enablesInterrupts: true };
    }

    // Check for CIA disable
    if (this.isCIADisable(instr)) {
      this.setupState = { ...this.setupState, disablesCIA: true };
    }

    // Check for raster line write
    if (this.isRasterLineWrite(instr)) {
      this.setupState = { ...this.setupState, setsRasterLine: true };
      this.validateRasterLine(instr);
    }

    // Check for raster IRQ enable
    if (this.isRasterIRQEnable(instr)) {
      this.setupState = { ...this.setupState, enablesRasterIRQ: true };
    }

    // Check for vector setup
    if (this.isVectorSetup(instr)) {
      this.setupState = { ...this.setupState, setsVector: true };
    }
  }

  /**
   * Check if instruction is SEI
   */
  protected isSEI(instr: ILInstruction): boolean {
    return instr.opcode === ILOpcode.SEI;
  }

  /**
   * Check if instruction is CLI
   */
  protected isCLI(instr: ILInstruction): boolean {
    return instr.opcode === ILOpcode.CLI;
  }

  /**
   * Check if instruction disables CIA interrupts
   */
  protected isCIADisable(instr: ILInstruction): boolean {
    if (instr.opcode !== ILOpcode.STORE) return false;

    const address = this.extractAddress(instr);
    const value = this.extractValue(instr);

    // Writing $7F to CIA ICR disables all interrupts
    return (
      (address === CIA_REGISTERS.CIA1_ICR || address === CIA_REGISTERS.CIA2_ICR) &&
      value === 0x7f
    );
  }

  /**
   * Check if instruction writes raster line
   */
  protected isRasterLineWrite(instr: ILInstruction): boolean {
    if (instr.opcode !== ILOpcode.STORE) return false;

    const address = this.extractAddress(instr);
    return address === VIC_REGISTERS.RASTER;
  }

  /**
   * Check if instruction enables raster IRQ
   */
  protected isRasterIRQEnable(instr: ILInstruction): boolean {
    if (instr.opcode !== ILOpcode.STORE) return false;

    const address = this.extractAddress(instr);
    const value = this.extractValue(instr);

    // Bit 0 of $D01A enables raster IRQ
    return address === VIC_REGISTERS.IRQMASK && (value & 0x01) !== 0;
  }

  /**
   * Check if instruction sets IRQ vector
   */
  protected isVectorSetup(instr: ILInstruction): boolean {
    if (instr.opcode !== ILOpcode.STORE) return false;

    const address = this.extractAddress(instr);
    return (
      address === IRQ_VECTORS.KERNAL_LO ||
      address === IRQ_VECTORS.KERNAL_HI ||
      address === IRQ_VECTORS.HARDWARE_LO ||
      address === IRQ_VECTORS.HARDWARE_HI
    );
  }

  /**
   * Validate raster line value
   */
  protected validateRasterLine(instr: ILInstruction): void {
    const value = this.extractValue(instr);

    if (value !== 'dynamic' && !this.isValidRasterLine(value)) {
      this.issues.push({
        type: RasterSetupIssueType.LINE_OUT_OF_RANGE,
        severity: 'error',
        message: `Raster line ${value} out of range (max ${this.getMaxRasterLine()})`,
        cyclePosition: this.currentCycle,
      });
    }
  }

  /**
   * Validate complete setup
   */
  protected validateSetup(): void {
    // Should disable interrupts before setup
    if (!this.setupState.disableInterrupts) {
      this.issues.push({
        type: RasterSetupIssueType.MISSING_SEI,
        severity: 'warning',
        message: 'IRQ setup without SEI - may cause race conditions',
        cyclePosition: 0,
      });
    }

    // Should disable CIA to prevent timer IRQs
    if (!this.setupState.disablesCIA) {
      this.issues.push({
        type: RasterSetupIssueType.CIA_NOT_DISABLED,
        severity: 'warning',
        message: 'CIA IRQs not disabled - may interfere with raster IRQ',
        cyclePosition: this.currentCycle,
      });
    }

    // Must set vector
    if (!this.setupState.setsVector) {
      this.issues.push({
        type: RasterSetupIssueType.VECTOR_NOT_SET,
        severity: 'error',
        message: 'IRQ vector not set',
        cyclePosition: this.currentCycle,
      });
    }

    // Must enable raster IRQ
    if (!this.setupState.enablesRasterIRQ) {
      this.issues.push({
        type: RasterSetupIssueType.RASTER_NOT_ENABLED,
        severity: 'error',
        message: 'Raster IRQ not enabled in $D01A',
        cyclePosition: this.currentCycle,
      });
    }

    // Should re-enable interrupts
    if (!this.setupState.enablesInterrupts) {
      this.issues.push({
        type: RasterSetupIssueType.MISSING_CLI,
        severity: 'warning',
        message: 'Interrupts not re-enabled after setup',
        cyclePosition: this.currentCycle,
      });
    }
  }

  /**
   * Check if setup is complete
   */
  protected isSetupComplete(): boolean {
    return (
      this.setupState.setsRasterLine &&
      this.setupState.enablesRasterIRQ &&
      this.setupState.setsVector
    );
  }

  /**
   * Find optimization opportunities
   */
  public findOptimizations(): RasterIRQOptimization[] {
    const optimizations: RasterIRQOptimization[] = [];

    // Check if multiple SEIs can be combined
    // Check if setup can be streamlined
    // Check if acknowledgment can be optimized

    return optimizations;
  }

  /**
   * Extract address from instruction
   */
  protected extractAddress(instr: ILInstruction): number {
    return instr.operands?.[0]?.value ?? 0;
  }

  /**
   * Extract value from instruction
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
    return 4; // Simplified
  }
}
```

---

## 5. IRQ Acknowledgment Analyzer

```typescript
// packages/compiler/src/optimizer/target/raster/irq-ack-analyzer.ts

import {
  RasterSetupIssue,
  RasterSetupIssueType,
} from './types.js';
import { ILInstruction, ILOpcode } from '../../../il/types.js';
import { BasicBlock } from '../../../il/cfg.js';

/**
 * IRQ Acknowledgment Analysis Result
 */
export interface IRQAckAnalysis {
  readonly acknowledgesVIC: boolean;
  readonly ackValue: number | 'dynamic';
  readonly ackCyclePosition: number;
  readonly issues: RasterSetupIssue[];
}

/**
 * IRQ Acknowledgment Analyzer
 *
 * Analyzes IRQ handlers for correct acknowledgment sequences.
 */
export class IRQAckAnalyzer {
  protected readonly VIC_IRQFLAG = 0xd019;

  /**
   * Analyze handler for IRQ acknowledgment
   */
  public analyzeHandler(block: BasicBlock): IRQAckAnalysis {
    let acknowledgesVIC = false;
    let ackValue: number | 'dynamic' = 'dynamic';
    let ackCyclePosition = 0;
    const issues: RasterSetupIssue[] = [];
    let currentCycle = 0;

    for (const instr of block.instructions) {
      if (this.isVICAck(instr)) {
        acknowledgesVIC = true;
        ackValue = this.extractValue(instr);
        ackCyclePosition = currentCycle;

        // Check acknowledgment value
        if (ackValue !== 'dynamic' && ackValue !== 0x01 && ackValue !== 0xff) {
          issues.push({
            type: RasterSetupIssueType.ACK_WRONG_VALUE,
            severity: 'warning',
            message: `IRQ ack with $${ackValue.toString(16)} - should be $01 or $FF`,
            cyclePosition: currentCycle,
          });
        }
      }
      currentCycle += 4; // Simplified
    }

    if (!acknowledgesVIC) {
      issues.push({
        type: RasterSetupIssueType.MISSING_ACK,
        severity: 'error',
        message: 'IRQ handler does not acknowledge VIC interrupt',
        cyclePosition: 0,
      });
    }

    return { acknowledgesVIC, ackValue, ackCyclePosition, issues };
  }

  /**
   * Check if instruction acknowledges VIC IRQ
   */
  protected isVICAck(instr: ILInstruction): boolean {
    if (instr.opcode !== ILOpcode.STORE) return false;

    const address = instr.operands?.[0]?.value;
    return address === this.VIC_IRQFLAG;
  }

  /**
   * Extract value from instruction
   */
  protected extractValue(instr: ILInstruction): number | 'dynamic' {
    const valueOp = instr.operands?.[1];
    if (valueOp?.kind === 'immediate') {
      return valueOp.value;
    }
    return 'dynamic';
  }

  /**
   * Generate optimal acknowledgment sequence
   */
  public generateOptimalAck(): string {
    // Most efficient: ASL $D019 (shifts bit 0 out, clears flag)
    // Standard: LDA #$01 / STA $D019
    // Alternative: LSR $D019
    return `
      ; Optimal IRQ acknowledgment
      ASL $D019    ; 6 cycles - shifts out bit 0, clears raster flag
      ; OR
      ; LDA #$01   ; 2 cycles
      ; STA $D019  ; 4 cycles = 6 total, but uses accumulator
    `;
  }
}
```

---

## 6. Blend65 Syntax Integration

```js
// Raster IRQ setup in Blend65

@map VIC_SCROLY at $D011: byte;
@map VIC_RASTER at $D012: byte;
@map VIC_IRQFLAG at $D019: byte;
@map VIC_IRQMASK at $D01A: byte;
@map CIA1_ICR at $DC0D: byte;
@map IRQ_VECTOR_LO at $0314: byte;
@map IRQ_VECTOR_HI at $0315: byte;

// Basic raster IRQ setup
function setupRasterIRQ(line: byte, handler: word): void {
    asm { sei }              // Disable interrupts during setup
    
    // Disable CIA interrupts
    CIA1_ICR = $7F;          // Disable all CIA1 IRQs
    CIA1_ICR;                // Read to acknowledge pending
    
    // Set raster line
    VIC_RASTER = line;
    VIC_SCROLY = VIC_SCROLY & $7F;  // Clear bit 7 for lines 0-255
    
    // Set IRQ vector
    IRQ_VECTOR_LO = <byte>handler;
    IRQ_VECTOR_HI = <byte>(handler >> 8);
    
    // Enable raster IRQ
    VIC_IRQMASK = $01;
    
    asm { cli }              // Re-enable interrupts
}

// IRQ handler template
function rasterHandler(): void {
    VIC_IRQFLAG = $01;       // Acknowledge raster IRQ (CRITICAL!)
    
    // Your effect code here
    
    asm { jmp $EA31 }        // Return through Kernal (preserves regs)
}

// For lines > 255 (PAL only)
function setupRasterIRQExtended(line: word, handler: word): void {
    asm { sei }
    CIA1_ICR = $7F;
    CIA1_ICR;
    
    VIC_RASTER = <byte>line;
    if (line > 255) {
        VIC_SCROLY = VIC_SCROLY | $80;  // Set bit 7 for lines 256+
    } else {
        VIC_SCROLY = VIC_SCROLY & $7F;
    }
    
    IRQ_VECTOR_LO = <byte>handler;
    IRQ_VECTOR_HI = <byte>(handler >> 8);
    VIC_IRQMASK = $01;
    
    asm { cli }
}
```

---

## 7. Test Requirements

| Category           | Test Cases | Coverage Target |
| ------------------ | ---------- | --------------- |
| Setup detection    | 5          | 100%            |
| Issue detection    | 6          | 100%            |
| Line validation    | 4          | 100%            |
| Ack detection      | 4          | 100%            |
| Vector detection   | 3          | 100%            |
| Optimization       | 3          | 100%            |
| **Total**          | **25**     | **100%**        |

---

## 8. Task Checklist

- [ ] Create type definitions for raster IRQ
- [ ] Implement setup analyzer
- [ ] Implement acknowledgment analyzer
- [ ] Implement issue detection
- [ ] Implement line validation
- [ ] Create unit tests for all components
- [ ] Document common patterns

---

**Next Document**: `09-03a2-raster-irq-double.md` (Session 4.3a2: Raster IRQ double technique)
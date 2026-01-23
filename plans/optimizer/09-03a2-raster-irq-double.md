# Task 9.3a2: Raster IRQ Double Technique

> **Session**: 4.3a2
> **Phase**: 09-target-specific
> **Est. Time**: 45 min
> **Tests**: ~25 unit tests
> **Prerequisites**: Task 9.3a1 complete (Raster IRQ basic setup)

---

## Overview

The double IRQ technique achieves stable raster timing by using a second IRQ to eliminate jitter from the first. This document covers analysis and optimization of the double IRQ pattern for cycle-exact C64 effects.

---

## 1. Double IRQ Fundamentals

### 1.1 The Jitter Problem

```
Single IRQ Jitter (7-8 cycle variance):
┌─────────────────────────────────────────────────────────────┐
│ IRQ trigger → [0-7 cycles] → IRQ handler starts             │
│                                                             │
│ Reason: CPU must complete current instruction before IRQ    │
│ - BRK, JSR: 7 cycles                                        │
│ - Most instructions: 2-6 cycles                             │
│ - Result: 7-8 cycle jitter window                           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Double IRQ Solution

```
Double IRQ Technique:
┌─────────────────────────────────────────────────────────────┐
│ IRQ 1 (line N):                                             │
│   - Acknowledge IRQ                                         │
│   - Set raster for line N+1 (or N+2)                        │
│   - Re-enable interrupts (CLI)                              │
│   - Execute exactly timed NOP sequence                      │
│                                                             │
│ IRQ 2 (line N+1):                                           │
│   - Now jitter is only 0-1 cycles                           │
│   - Use NOP slide or branch trick for final stabilization   │
│   - Execute cycle-exact effect code                         │
│                                                             │
│ Why it works:                                               │
│ - IRQ 1 provides stable "anchor point"                      │
│ - Timed code after CLI means IRQ 2 fires during known ops   │
│ - Known ops = predictable jitter = eliminable jitter        │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Timing Diagram

```
Raster Line N:
│ VIC triggers IRQ 1
│     ↓ [0-7 cycle jitter]
│ Handler 1 starts → ACK → set line N+1 → CLI → NOPs...
│                                              │
│                                              └─ IRQ 2 fires here
│                                                 (within NOP sequence)
│
Raster Line N+1:
│ VIC triggers IRQ 2
│     ↓ [0-1 cycle jitter now!]
│ Handler 2 starts → NOP slide → STABLE CODE
```

---

## 2. Directory Structure

```
packages/compiler/src/optimizer/target/raster/
├── double-irq-analyzer.ts    # Double IRQ pattern detection
├── irq-chain-analyzer.ts     # Multi-IRQ chain analysis
├── jitter-calculator.ts      # Jitter range calculation
├── stabilization-analyzer.ts # Stabilization technique detection
└── index.ts                  # Public exports
```

---

## 3. Type Definitions

```typescript
// packages/compiler/src/optimizer/target/raster/double-irq-types.ts

/**
 * Double IRQ handler configuration
 */
export interface DoubleIRQConfig {
  readonly firstHandler: IRQHandler;
  readonly secondHandler: IRQHandler;
  readonly lineOffset: number; // Lines between IRQ 1 and IRQ 2
  readonly stabilizationMethod: StabilizationMethod;
}

/**
 * Individual IRQ handler info
 */
export interface IRQHandler {
  readonly address: number;
  readonly triggerLine: number;
  readonly cycleCount: number;
  readonly acknowledgesIRQ: boolean;
  readonly setsNextLine: boolean;
  readonly enablesInterrupts: boolean; // CLI before exit
  readonly hasNOPSequence: boolean;
  readonly nopCount: number;
}

/**
 * Method used to stabilize final timing
 */
export enum StabilizationMethod {
  NONE = 'none',
  NOP_SLIDE = 'nop_slide',
  BRANCH_TRICK = 'branch_trick',
  TSX_STABILIZE = 'tsx_stabilize',
  COMBINED = 'combined',
}

/**
 * Double IRQ analysis result
 */
export interface DoubleIRQAnalysis {
  readonly isValidDoubleIRQ: boolean;
  readonly config: DoubleIRQConfig | null;
  readonly jitterBefore: JitterRange;
  readonly jitterAfter: JitterRange;
  readonly issues: DoubleIRQIssue[];
  readonly optimizations: DoubleIRQOptimization[];
}

/**
 * Jitter range in cycles
 */
export interface JitterRange {
  readonly min: number;
  readonly max: number;
  readonly typical: number;
}

/**
 * Issue in double IRQ implementation
 */
export interface DoubleIRQIssue {
  readonly type: DoubleIRQIssueType;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly handler: 'first' | 'second';
}

export enum DoubleIRQIssueType {
  MISSING_CLI = 'missing_cli',
  MISSING_NOP_SEQUENCE = 'missing_nop_sequence',
  INSUFFICIENT_NOPS = 'insufficient_nops',
  LINE_OFFSET_WRONG = 'line_offset_wrong',
  NO_STABILIZATION = 'no_stabilization',
  TIMING_OVERFLOW = 'timing_overflow',
}

/**
 * Double IRQ optimization opportunity
 */
export interface DoubleIRQOptimization {
  readonly type: DoubleIRQOptType;
  readonly description: string;
  readonly cyclesSaved: number;
}

export enum DoubleIRQOptType {
  REDUCE_NOP_COUNT = 'reduce_nop_count',
  OPTIMIZE_STABILIZATION = 'optimize_stabilization',
  INLINE_HANDLERS = 'inline_handlers',
  USE_BRANCH_TRICK = 'use_branch_trick',
}
```

---

## 4. Double IRQ Analyzer

```typescript
// packages/compiler/src/optimizer/target/raster/double-irq-analyzer.ts

import {
  DoubleIRQConfig,
  IRQHandler,
  StabilizationMethod,
  DoubleIRQAnalysis,
  JitterRange,
  DoubleIRQIssue,
  DoubleIRQIssueType,
  DoubleIRQOptimization,
  DoubleIRQOptType,
} from './double-irq-types.js';
import { ILInstruction, ILOpcode } from '../../../il/types.js';
import { BasicBlock } from '../../../il/cfg.js';

/**
 * Standard jitter values for 6502
 */
const JITTER = {
  SINGLE_IRQ_MIN: 0,
  SINGLE_IRQ_MAX: 7,
  DOUBLE_IRQ_MIN: 0,
  DOUBLE_IRQ_MAX: 1, // After proper stabilization
};

/**
 * Minimum NOPs required between CLI and expected IRQ 2
 */
const MIN_NOP_COUNT = 10;

/**
 * Double IRQ Analyzer
 *
 * Analyzes code for correct double IRQ implementation
 * and suggests optimizations.
 */
export class DoubleIRQAnalyzer {
  /**
   * Analyze handlers for double IRQ pattern
   */
  public analyze(
    firstHandler: BasicBlock,
    secondHandler: BasicBlock,
    firstLine: number,
    secondLine: number
  ): DoubleIRQAnalysis {
    const first = this.analyzeHandler(firstHandler, firstLine, true);
    const second = this.analyzeHandler(secondHandler, secondLine, false);

    const lineOffset = secondLine - firstLine;
    const stabilizationMethod = this.detectStabilization(secondHandler);

    const config: DoubleIRQConfig = {
      firstHandler: first,
      secondHandler: second,
      lineOffset,
      stabilizationMethod,
    };

    const issues = this.detectIssues(config);
    const optimizations = this.findOptimizations(config);

    const jitterBefore: JitterRange = {
      min: JITTER.SINGLE_IRQ_MIN,
      max: JITTER.SINGLE_IRQ_MAX,
      typical: 4,
    };

    const jitterAfter: JitterRange = this.calculateResultingJitter(config);

    return {
      isValidDoubleIRQ: issues.filter(i => i.severity === 'error').length === 0,
      config,
      jitterBefore,
      jitterAfter,
      issues,
      optimizations,
    };
  }

  /**
   * Analyze a single IRQ handler
   */
  protected analyzeHandler(
    block: BasicBlock,
    triggerLine: number,
    isFirst: boolean
  ): IRQHandler {
    let cycleCount = 0;
    let acknowledgesIRQ = false;
    let setsNextLine = false;
    let enablesInterrupts = false;
    let hasNOPSequence = false;
    let nopCount = 0;
    let consecutiveNops = 0;

    for (const instr of block.instructions) {
      cycleCount += this.getInstructionCycles(instr);

      if (this.isIRQAck(instr)) {
        acknowledgesIRQ = true;
      }

      if (this.isRasterLineWrite(instr)) {
        setsNextLine = true;
      }

      if (this.isCLI(instr)) {
        enablesInterrupts = true;
      }

      if (this.isNOP(instr)) {
        consecutiveNops++;
        nopCount++;
        if (consecutiveNops >= 3) {
          hasNOPSequence = true;
        }
      } else {
        consecutiveNops = 0;
      }
    }

    return {
      address: 0, // Would be extracted from context
      triggerLine,
      cycleCount,
      acknowledgesIRQ,
      setsNextLine,
      enablesInterrupts,
      hasNOPSequence,
      nopCount,
    };
  }

  /**
   * Detect stabilization method in second handler
   */
  protected detectStabilization(block: BasicBlock): StabilizationMethod {
    const instructions = block.instructions;

    // Check for NOP slide pattern
    if (this.hasNOPSlide(instructions)) {
      return StabilizationMethod.NOP_SLIDE;
    }

    // Check for branch trick (BIT $EA, etc.)
    if (this.hasBranchTrick(instructions)) {
      return StabilizationMethod.BRANCH_TRICK;
    }

    // Check for TSX stabilization
    if (this.hasTSXStabilize(instructions)) {
      return StabilizationMethod.TSX_STABILIZE;
    }

    return StabilizationMethod.NONE;
  }

  /**
   * Check for NOP slide pattern
   */
  protected hasNOPSlide(instructions: ILInstruction[]): boolean {
    // NOP slide: sequence of NOPs followed by cycle-counted branch
    let nopCount = 0;
    for (const instr of instructions) {
      if (this.isNOP(instr)) {
        nopCount++;
      } else if (nopCount >= 3 && this.isBranch(instr)) {
        return true;
      } else {
        nopCount = 0;
      }
    }
    return nopCount >= 5;
  }

  /**
   * Check for branch trick pattern
   */
  protected hasBranchTrick(instructions: ILInstruction[]): boolean {
    // Branch trick: conditional branch over a 2-cycle instruction
    // BCS *+2 / NOP pattern
    for (let i = 0; i < instructions.length - 1; i++) {
      if (this.isBranch(instructions[i]) && this.isNOP(instructions[i + 1])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check for TSX stabilization
   */
  protected hasTSXStabilize(instructions: ILInstruction[]): boolean {
    // TSX stabilization: use stack pointer for timing
    for (const instr of instructions) {
      if (instr.opcode === ILOpcode.TSX) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect issues with double IRQ implementation
   */
  protected detectIssues(config: DoubleIRQConfig): DoubleIRQIssue[] {
    const issues: DoubleIRQIssue[] = [];

    // First handler must enable interrupts
    if (!config.firstHandler.enablesInterrupts) {
      issues.push({
        type: DoubleIRQIssueType.MISSING_CLI,
        severity: 'error',
        message: 'First handler must CLI to allow second IRQ',
        handler: 'first',
      });
    }

    // First handler should have NOP sequence
    if (!config.firstHandler.hasNOPSequence) {
      issues.push({
        type: DoubleIRQIssueType.MISSING_NOP_SEQUENCE,
        severity: 'warning',
        message: 'First handler should have NOP sequence after CLI',
        handler: 'first',
      });
    }

    // Check NOP count
    if (config.firstHandler.nopCount < MIN_NOP_COUNT) {
      issues.push({
        type: DoubleIRQIssueType.INSUFFICIENT_NOPS,
        severity: 'warning',
        message: `First handler has ${config.firstHandler.nopCount} NOPs, recommend ${MIN_NOP_COUNT}+`,
        handler: 'first',
      });
    }

    // Line offset should be 1 or 2
    if (config.lineOffset < 1 || config.lineOffset > 2) {
      issues.push({
        type: DoubleIRQIssueType.LINE_OFFSET_WRONG,
        severity: 'warning',
        message: `Line offset ${config.lineOffset} - recommend 1 or 2`,
        handler: 'second',
      });
    }

    // Second handler should have stabilization
    if (config.stabilizationMethod === StabilizationMethod.NONE) {
      issues.push({
        type: DoubleIRQIssueType.NO_STABILIZATION,
        severity: 'warning',
        message: 'Second handler has no final stabilization technique',
        handler: 'second',
      });
    }

    return issues;
  }

  /**
   * Calculate resulting jitter after double IRQ
   */
  protected calculateResultingJitter(config: DoubleIRQConfig): JitterRange {
    // With proper double IRQ, jitter is reduced to 0-1 cycles
    // Stabilization can eliminate even this
    
    if (config.stabilizationMethod === StabilizationMethod.NONE) {
      return { min: 0, max: 1, typical: 0.5 };
    }

    // With stabilization
    return { min: 0, max: 0, typical: 0 };
  }

  /**
   * Find optimization opportunities
   */
  protected findOptimizations(config: DoubleIRQConfig): DoubleIRQOptimization[] {
    const optimizations: DoubleIRQOptimization[] = [];

    // Too many NOPs?
    if (config.firstHandler.nopCount > 20) {
      optimizations.push({
        type: DoubleIRQOptType.REDUCE_NOP_COUNT,
        description: 'Reduce NOP count by calculating exact timing',
        cyclesSaved: (config.firstHandler.nopCount - 15) * 2,
      });
    }

    // No stabilization but could use branch trick
    if (config.stabilizationMethod === StabilizationMethod.NONE) {
      optimizations.push({
        type: DoubleIRQOptType.USE_BRANCH_TRICK,
        description: 'Add branch trick for perfect stabilization',
        cyclesSaved: 0, // Doesn't save cycles but improves stability
      });
    }

    // NOP slide could be replaced with branch trick
    if (config.stabilizationMethod === StabilizationMethod.NOP_SLIDE) {
      optimizations.push({
        type: DoubleIRQOptType.OPTIMIZE_STABILIZATION,
        description: 'Replace NOP slide with branch trick (smaller code)',
        cyclesSaved: 4,
      });
    }

    return optimizations;
  }

  /**
   * Helper methods for instruction detection
   */
  protected isIRQAck(instr: ILInstruction): boolean {
    return instr.opcode === ILOpcode.STORE && 
           (instr.operands?.[0]?.value === 0xd019);
  }

  protected isRasterLineWrite(instr: ILInstruction): boolean {
    return instr.opcode === ILOpcode.STORE && 
           (instr.operands?.[0]?.value === 0xd012);
  }

  protected isCLI(instr: ILInstruction): boolean {
    return instr.opcode === ILOpcode.CLI;
  }

  protected isNOP(instr: ILInstruction): boolean {
    return instr.opcode === ILOpcode.NOP;
  }

  protected isBranch(instr: ILInstruction): boolean {
    const branchOps = [
      ILOpcode.BEQ, ILOpcode.BNE, ILOpcode.BCC, ILOpcode.BCS,
      ILOpcode.BMI, ILOpcode.BPL, ILOpcode.BVC, ILOpcode.BVS,
    ];
    return branchOps.includes(instr.opcode);
  }

  protected getInstructionCycles(instr: ILInstruction): number {
    // Simplified cycle counting
    if (this.isNOP(instr)) return 2;
    if (this.isBranch(instr)) return 2; // +1 if taken, +2 if page cross
    return 4; // Default
  }
}
```

---

## 5. Blend65 Syntax Integration

```js
// Double IRQ implementation in Blend65

@map VIC_RASTER at $D012: byte;
@map VIC_IRQFLAG at $D019: byte;
@map VIC_IRQMASK at $D01A: byte;

// Global state for double IRQ
let irqPhase: byte = 0;
const EFFECT_LINE: byte = 100;

// First IRQ handler - sets up second IRQ
function irqHandler1(): void {
    VIC_IRQFLAG = $01;              // Acknowledge
    VIC_RASTER = EFFECT_LINE + 1;    // Set line for IRQ 2
    
    asm { cli }                      // Re-enable interrupts
    
    // NOP sequence - IRQ 2 will fire during this
    asm {
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
        nop
    }
    
    // If we get here, IRQ 2 didn't fire (timing error)
    asm { jmp $EA31 }
}

// Second IRQ handler - stable timing achieved
function irqHandler2(): void {
    VIC_IRQFLAG = $01;              // Acknowledge
    VIC_RASTER = EFFECT_LINE;        // Reset for next frame
    
    // NOP slide for final stabilization (optional)
    // The branch trick: if jitter = 1, branch takes 3 cycles
    // if jitter = 0, no branch takes 2 cycles + NOP = 3 cycles
    asm {
        lda #$00
        bne skip          // Never taken, but 2 cycles
        bit $EA           // 3 cycles
    skip:
    }
    
    // NOW we have stable timing!
    // Execute cycle-exact effect here
    doEffect();
    
    asm { jmp $EA31 }
}

// Switch between handlers
function irqRouter(): void {
    if (irqPhase == 0) {
        irqPhase = 1;
        irqHandler1();
    } else {
        irqPhase = 0;
        irqHandler2();
    }
}
```

---

## 6. Test Requirements

| Category             | Test Cases | Coverage Target |
| -------------------- | ---------- | --------------- |
| Handler analysis     | 5          | 100%            |
| Stabilization detect | 5          | 100%            |
| Issue detection      | 5          | 100%            |
| Jitter calculation   | 4          | 100%            |
| Optimization find    | 3          | 100%            |
| Integration          | 3          | 100%            |
| **Total**            | **25**     | **100%**        |

---

## 7. Task Checklist

- [ ] Create type definitions for double IRQ
- [ ] Implement handler analysis
- [ ] Implement stabilization detection
- [ ] Implement issue detection
- [ ] Implement jitter calculation
- [ ] Implement optimization finder
- [ ] Create unit tests for all components

---

**Next Document**: `09-03b1-raster-cycle-exact.md` (Session 4.3b1: Raster critical cycle-exact)
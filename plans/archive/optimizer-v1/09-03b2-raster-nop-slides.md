# Task 9.3b2: Raster NOP Slide Patterns

> **Session**: 4.3b2
> **Phase**: 09-target-specific
> **Est. Time**: 45 min
> **Tests**: ~25 unit tests
> **Prerequisites**: Task 9.3b1 complete (Cycle-exact timing)

---

## Overview

NOP slides are a fundamental technique for eliminating residual jitter in raster IRQ handlers. This document covers analysis, generation, and optimization of NOP slide patterns for stable C64 raster timing.

---

## 1. NOP Slide Fundamentals

### 1.1 How NOP Slides Work

```
NOP Slide Timing Absorption:
┌─────────────────────────────────────────────────────────────┐
│ Problem: IRQ has 0-N cycles jitter                          │
│                                                             │
│ Solution: Jump into a sequence of NOPs based on jitter      │
│                                                             │
│ If jitter = 0:  JMP slide+0 → NOP NOP NOP NOP → stable code │
│ If jitter = 2:  JMP slide+2 → NOP NOP NOP → stable code     │
│ If jitter = 4:  JMP slide+4 → NOP NOP → stable code         │
│ If jitter = 6:  JMP slide+6 → NOP → stable code             │
│                                                             │
│ Result: All paths reach stable code at same cycle!          │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Classic NOP Slide Structure

```
; After double IRQ, jitter is 0 or 1 cycle
; Use TSX to detect odd/even cycle position

tsx_stabilize:
    TSX             ; 2 cycles
    LDA $0104,X     ; 4+1 cycles (stack peek, always page cross)
    ; Stack contains return address which varies by 1 based on jitter
    
nop_slide:
    NOP             ; Entry +0
    NOP             ; Entry +2  
    NOP             ; Entry +4
    NOP             ; Entry +6
    BIT $00         ; 3 cycles - consume odd cycle if needed
    
stable_code:
    ; Now at exactly the same cycle regardless of initial jitter
```

### 1.3 Alternative: Branch-Based Slide

```
; Uses conditional branch cycle difference
; Branch taken = 3 cycles, not taken = 2 cycles

branch_slide:
    LDA $D012       ; Get raster position (varies by jitter)
    AND #$07        ; Extract low bits
    ORA #$C0        ; Create branch offset table lookup
    STA branch+1    ; Self-modify branch target
branch:
    BNE *           ; Branch to calculated offset in slide
    
slide:
    NOP             ; +0
    NOP             ; +2
    NOP             ; +4
    NOP             ; +6
    NOP             ; +8
    ; ... continue until max jitter absorbed
```

---

## 2. Directory Structure

```
packages/compiler/src/optimizer/target/raster/
├── nop-slide-analyzer.ts     # NOP slide detection and analysis
├── nop-slide-generator.ts    # Generate optimal NOP slides
├── tsx-stabilizer.ts         # TSX-based stabilization
├── branch-slide.ts           # Branch-based slide patterns
└── index.ts                  # Public exports
```

---

## 3. Type Definitions

```typescript
// packages/compiler/src/optimizer/target/raster/nop-slide-types.ts

/**
 * NOP slide technique type
 */
export enum NOPSlideType {
  SIMPLE = 'simple',           // Basic NOP sequence
  TSX_BASED = 'tsx_based',     // TSX stack peek method
  BRANCH_BASED = 'branch_based', // Self-modifying branch
  TABLE_JUMP = 'table_jump',   // Jump table lookup
}

/**
 * NOP slide configuration
 */
export interface NOPSlideConfig {
  readonly type: NOPSlideType;
  readonly maxJitter: number;      // Maximum jitter to absorb (cycles)
  readonly nopCount: number;       // Number of NOPs in slide
  readonly entryOffset: number;    // Offset into slide based on jitter
  readonly usesOddCycleHandler: boolean; // Has BIT/other 3-cycle instr
}

/**
 * NOP slide analysis result
 */
export interface NOPSlideAnalysis {
  readonly isValidSlide: boolean;
  readonly config: NOPSlideConfig;
  readonly effectiveJitterAbsorption: number;
  readonly codeSize: number;
  readonly cycleOverhead: number;
  readonly issues: NOPSlideIssue[];
  readonly optimizations: NOPSlideOptimization[];
}

/**
 * Issue in NOP slide implementation
 */
export interface NOPSlideIssue {
  readonly type: NOPSlideIssueType;
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

export enum NOPSlideIssueType {
  INSUFFICIENT_NOPS = 'insufficient_nops',
  NO_ODD_HANDLER = 'no_odd_handler',
  SLIDE_TOO_LONG = 'slide_too_long',
  MISALIGNED_ENTRY = 'misaligned_entry',
  MISSING_STABILIZATION = 'missing_stabilization',
}

/**
 * NOP slide optimization opportunity
 */
export interface NOPSlideOptimization {
  readonly type: NOPSlideOptType;
  readonly description: string;
  readonly bytesSaved: number;
  readonly cyclesSaved: number;
}

export enum NOPSlideOptType {
  USE_BRANCH_TRICK = 'use_branch_trick',
  REDUCE_NOP_COUNT = 'reduce_nop_count',
  USE_TSX_METHOD = 'use_tsx_method',
  COMBINE_WITH_WORK = 'combine_with_work',
}

/**
 * Jitter measurement result
 */
export interface JitterMeasurement {
  readonly minJitter: number;
  readonly maxJitter: number;
  readonly oddCyclesPossible: boolean;
  readonly measurementMethod: 'tsx' | 'raster' | 'timer' | 'known';
}
```

---

## 4. NOP Slide Analyzer

```typescript
// packages/compiler/src/optimizer/target/raster/nop-slide-analyzer.ts

import {
  NOPSlideType,
  NOPSlideConfig,
  NOPSlideAnalysis,
  NOPSlideIssue,
  NOPSlideIssueType,
  NOPSlideOptimization,
  NOPSlideOptType,
  JitterMeasurement,
} from './nop-slide-types.js';
import { ILInstruction, ILOpcode } from '../../../il/types.js';
import { BasicBlock } from '../../../il/cfg.js';

/**
 * NOP Slide Analyzer
 *
 * Analyzes and validates NOP slide implementations
 * for raster IRQ stabilization.
 */
export class NOPSlideAnalyzer {
  /**
   * Analyze a block for NOP slide patterns
   */
  public analyze(block: BasicBlock): NOPSlideAnalysis {
    const slideType = this.detectSlideType(block);
    const config = this.extractConfig(block, slideType);
    const issues = this.detectIssues(config);
    const optimizations = this.findOptimizations(config);

    return {
      isValidSlide: issues.filter(i => i.severity === 'error').length === 0,
      config,
      effectiveJitterAbsorption: this.calculateJitterAbsorption(config),
      codeSize: this.calculateCodeSize(config),
      cycleOverhead: this.calculateCycleOverhead(config),
      issues,
      optimizations,
    };
  }

  /**
   * Detect the type of NOP slide
   */
  protected detectSlideType(block: BasicBlock): NOPSlideType {
    const instructions = block.instructions;

    // Check for TSX-based stabilization
    if (this.hasTSXPattern(instructions)) {
      return NOPSlideType.TSX_BASED;
    }

    // Check for self-modifying branch
    if (this.hasBranchSlide(instructions)) {
      return NOPSlideType.BRANCH_BASED;
    }

    // Check for jump table
    if (this.hasJumpTable(instructions)) {
      return NOPSlideType.TABLE_JUMP;
    }

    // Default to simple NOP slide
    return NOPSlideType.SIMPLE;
  }

  /**
   * Check for TSX-based stabilization pattern
   */
  protected hasTSXPattern(instructions: ILInstruction[]): boolean {
    for (let i = 0; i < instructions.length - 1; i++) {
      if (instructions[i].opcode === ILOpcode.TSX) {
        // Look for stack access following TSX
        const next = instructions[i + 1];
        if (next.opcode === ILOpcode.LDA_ABX || next.opcode === ILOpcode.LDA_ZPX) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check for self-modifying branch slide
   */
  protected hasBranchSlide(instructions: ILInstruction[]): boolean {
    // Look for STA to branch target followed by branch
    for (let i = 0; i < instructions.length - 1; i++) {
      if (instructions[i].opcode === ILOpcode.STA_ABS) {
        // Check if storing to code area (branch offset)
        const nextInstr = instructions[i + 1];
        if (this.isBranch(nextInstr)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check for jump table pattern
   */
  protected hasJumpTable(instructions: ILInstruction[]): boolean {
    // Look for indexed JMP
    for (const instr of instructions) {
      if (instr.opcode === ILOpcode.JMP_IND) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract NOP slide configuration
   */
  protected extractConfig(block: BasicBlock, type: NOPSlideType): NOPSlideConfig {
    let nopCount = 0;
    let hasOddHandler = false;

    for (const instr of block.instructions) {
      if (instr.opcode === ILOpcode.NOP) {
        nopCount++;
      }
      // BIT $xx is 3 cycles - handles odd cycle
      if (instr.opcode === ILOpcode.BIT_ZP || instr.opcode === ILOpcode.BIT_ABS) {
        hasOddHandler = true;
      }
    }

    return {
      type,
      maxJitter: nopCount * 2 + (hasOddHandler ? 1 : 0),
      nopCount,
      entryOffset: 0, // Would be calculated from context
      usesOddCycleHandler: hasOddHandler,
    };
  }

  /**
   * Detect issues in NOP slide
   */
  protected detectIssues(config: NOPSlideConfig): NOPSlideIssue[] {
    const issues: NOPSlideIssue[] = [];

    // Check for sufficient NOPs
    if (config.nopCount < 4) {
      issues.push({
        type: NOPSlideIssueType.INSUFFICIENT_NOPS,
        severity: 'warning',
        message: `Only ${config.nopCount} NOPs - may not absorb all jitter`,
      });
    }

    // Check for odd cycle handling after double IRQ
    if (!config.usesOddCycleHandler && config.type !== NOPSlideType.TSX_BASED) {
      issues.push({
        type: NOPSlideIssueType.NO_ODD_HANDLER,
        severity: 'warning',
        message: 'No odd-cycle handler (BIT $xx) - may have 1-cycle residual jitter',
      });
    }

    // Check for excessively long slides
    if (config.nopCount > 20) {
      issues.push({
        type: NOPSlideIssueType.SLIDE_TOO_LONG,
        severity: 'warning',
        message: `${config.nopCount} NOPs is excessive - consider optimizing`,
      });
    }

    return issues;
  }

  /**
   * Calculate effective jitter absorption
   */
  protected calculateJitterAbsorption(config: NOPSlideConfig): number {
    // Each NOP absorbs 2 cycles
    // Odd handler adds 1 more cycle absorption
    return config.nopCount * 2 + (config.usesOddCycleHandler ? 1 : 0);
  }

  /**
   * Calculate code size
   */
  protected calculateCodeSize(config: NOPSlideConfig): number {
    // NOP = 1 byte each
    // BIT $xx = 2 bytes
    let size = config.nopCount;
    if (config.usesOddCycleHandler) {
      size += 2;
    }

    // Add overhead for slide type
    switch (config.type) {
      case NOPSlideType.TSX_BASED:
        size += 5; // TSX + LDA $0104,X
        break;
      case NOPSlideType.BRANCH_BASED:
        size += 8; // Setup and branch
        break;
      case NOPSlideType.TABLE_JUMP:
        size += 10; // Table and jump
        break;
    }

    return size;
  }

  /**
   * Calculate cycle overhead
   */
  protected calculateCycleOverhead(config: NOPSlideConfig): number {
    switch (config.type) {
      case NOPSlideType.SIMPLE:
        return config.nopCount * 2;
      case NOPSlideType.TSX_BASED:
        return 7 + config.nopCount; // TSX (2) + LDA (5) + slide
      case NOPSlideType.BRANCH_BASED:
        return 10 + config.nopCount; // Setup + slide
      case NOPSlideType.TABLE_JUMP:
        return 12 + config.nopCount; // Table lookup + slide
      default:
        return config.nopCount * 2;
    }
  }

  /**
   * Find optimization opportunities
   */
  protected findOptimizations(config: NOPSlideConfig): NOPSlideOptimization[] {
    const optimizations: NOPSlideOptimization[] = [];

    // Simple slide could use branch trick
    if (config.type === NOPSlideType.SIMPLE && config.nopCount > 4) {
      optimizations.push({
        type: NOPSlideOptType.USE_BRANCH_TRICK,
        description: 'Replace NOP slide with branch trick for 1-cycle jitter',
        bytesSaved: config.nopCount - 4,
        cyclesSaved: 0,
      });
    }

    // Excessive NOPs
    if (config.nopCount > 10) {
      optimizations.push({
        type: NOPSlideOptType.REDUCE_NOP_COUNT,
        description: 'Calculate exact jitter and reduce NOP count',
        bytesSaved: config.nopCount - 8,
        cyclesSaved: (config.nopCount - 8) * 2,
      });
    }

    // Could upgrade to TSX method
    if (config.type === NOPSlideType.SIMPLE) {
      optimizations.push({
        type: NOPSlideOptType.USE_TSX_METHOD,
        description: 'Use TSX stabilization for smaller code',
        bytesSaved: config.nopCount - 7,
        cyclesSaved: 0,
      });
    }

    return optimizations;
  }

  /**
   * Check if instruction is a branch
   */
  protected isBranch(instr: ILInstruction): boolean {
    const branchOps = [
      ILOpcode.BEQ, ILOpcode.BNE, ILOpcode.BCC, ILOpcode.BCS,
      ILOpcode.BMI, ILOpcode.BPL, ILOpcode.BVC, ILOpcode.BVS,
    ];
    return branchOps.includes(instr.opcode);
  }
}
```

---

## 5. NOP Slide Generator

```typescript
// packages/compiler/src/optimizer/target/raster/nop-slide-generator.ts

import { NOPSlideType, NOPSlideConfig } from './nop-slide-types.js';

/**
 * NOP Slide Generator
 *
 * Generates optimal NOP slide code for various jitter scenarios.
 */
export class NOPSlideGenerator {
  /**
   * Generate simple NOP slide
   */
  public generateSimpleSlide(jitterCycles: number): string[] {
    const instructions: string[] = [];
    const nopCount = Math.ceil(jitterCycles / 2);

    instructions.push('; Simple NOP slide');
    instructions.push('nop_slide:');
    
    for (let i = 0; i < nopCount; i++) {
      instructions.push(`  NOP        ; +${i * 2} cycles`);
    }

    // Add odd-cycle handler if needed
    if (jitterCycles % 2 === 1) {
      instructions.push('  BIT $00    ; +3 cycles (odd handler)');
    }

    instructions.push('stable:');
    instructions.push('  ; Stable code starts here');

    return instructions;
  }

  /**
   * Generate TSX-based stabilization
   */
  public generateTSXSlide(): string[] {
    return [
      '; TSX-based stabilization',
      '; Works by detecting stack position after IRQ',
      '; which varies by jitter amount',
      '',
      'stabilize:',
      '  TSX              ; 2 cycles',
      '  LDA $0104,X      ; 5 cycles (always page cross)',
      '  ; A now contains low byte of return address',
      '  ; which differs based on entry jitter',
      '  ',
      '  ; Use lookup table or calculation',
      '  AND #$07         ; Extract relevant bits',
      '  TAX              ; Transfer to X',
      '  LDA slide_table,X ; Get NOP count needed',
      '  ; ... execute calculated slide',
      '',
      'slide_table:',
      '  .byte 0,0,1,1,2,2,3,3  ; NOPs needed for each jitter',
    ];
  }

  /**
   * Generate branch-based stabilization
   */
  public generateBranchSlide(maxJitter: number): string[] {
    const instructions: string[] = [];

    instructions.push('; Branch-based stabilization');
    instructions.push('; Uses branch taken/not-taken cycle difference');
    instructions.push('');
    instructions.push('branch_stabilize:');
    instructions.push('  ; After double IRQ, jitter is 0 or 1 cycle');
    instructions.push('  ; BEQ/BNE taken = 3 cycles, not taken = 2 cycles');
    instructions.push('  ');
    instructions.push('  LDA #$00      ; Set Z flag');
    instructions.push('  BEQ skip      ; Always taken (3 cycles)');
    instructions.push('  NOP           ; Skipped');
    instructions.push('skip:');
    instructions.push('  ; Or for 1-cycle absorption:');
    instructions.push('  ; Use the fact that page-crossing adds 1 cycle');
    instructions.push('  BIT $00       ; 3 cycles - handles odd case');
    instructions.push('');
    instructions.push('stable:');
    instructions.push('  ; Stable timing achieved');

    return instructions;
  }

  /**
   * Generate optimal slide for given jitter
   */
  public generateOptimalSlide(
    minJitter: number,
    maxJitter: number,
    oddCyclesPossible: boolean
  ): string[] {
    const jitterRange = maxJitter - minJitter;

    // For small jitter (0-1 cycles), use branch trick
    if (jitterRange <= 1 && !oddCyclesPossible) {
      return this.generateBranchSlide(1);
    }

    // For medium jitter (2-7 cycles), use simple slide
    if (jitterRange <= 7) {
      return this.generateSimpleSlide(maxJitter);
    }

    // For larger jitter, use TSX method
    return this.generateTSXSlide();
  }
}
```

---

## 6. Blend65 Syntax Integration

```js
// NOP slide examples in Blend65

@map VIC_BORDER at $D020: byte;
@map VIC_RASTER at $D012: byte;

// Simple NOP slide after double IRQ
function simpleNOPSlide(): void {
    // After double IRQ, jitter is 0-1 cycles
    asm {
        nop         // Entry if jitter = 0
        nop         // Entry if jitter = 2
        nop         // Safety margin
        nop
        bit $00     // Handle odd cycle (3 cycles)
    }
    
    // Now stable - do cycle-exact work
    VIC_BORDER = $02;
}

// TSX-based stabilization (most robust)
function tsxStabilize(): void {
    asm {
        tsx              // Get stack pointer
        lda $0104,x      // Read from stack (return address)
        and #$07         // Mask relevant bits
        tax
        lda slide_table,x
        ; ... continue based on table
    }
}

// Branch trick for 1-cycle jitter
function branchTrick(): void {
    asm {
        lda #$00      // Ensure Z flag set
        beq skip      // Always taken = 3 cycles
        nop           // Never executed
    skip:
        bit $00       // Handle any residual (3 cycles)
    }
    
    // Stable!
    VIC_BORDER = $03;
}

// Compiler hint for auto-generating slide
@stabilize(jitter: 1)
function autoSlide(): void {
    // Compiler inserts optimal NOP slide here
    VIC_BORDER = $04;
}
```

---

## 7. Test Requirements

| Category           | Test Cases | Coverage Target |
| ------------------ | ---------- | --------------- |
| Slide detection    | 5          | 100%            |
| Config extraction  | 4          | 100%            |
| Issue detection    | 5          | 100%            |
| Generator simple   | 4          | 100%            |
| Generator TSX      | 3          | 100%            |
| Optimization       | 4          | 100%            |
| **Total**          | **25**     | **100%**        |

---

## 8. Task Checklist

- [ ] Create type definitions for NOP slides
- [ ] Implement slide type detection
- [ ] Implement config extraction
- [ ] Implement issue detection
- [ ] Implement slide generators
- [ ] Implement optimization finder
- [ ] Create unit tests for all components

---

**Next Document**: `09-08a-target-interface.md` (Session 4.8a: Target emitter interface design)
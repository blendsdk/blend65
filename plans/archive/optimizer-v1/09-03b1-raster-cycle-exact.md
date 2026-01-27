# Task 9.3b1: Raster Critical Cycle-Exact Timing

> **Session**: 4.3b1
> **Phase**: 09-target-specific
> **Est. Time**: 45 min
> **Tests**: ~25 unit tests
> **Prerequisites**: Task 9.3a2 complete (Double IRQ technique)

---

## Overview

Cycle-exact timing is essential for advanced C64 effects like FLI, tech-tech, and split-screen effects. This document covers analysis and generation of cycle-exact code sequences for raster-critical operations.

---

## 1. Cycle-Exact Fundamentals

### 1.1 Why Cycles Matter

```
Raster Line Timing (PAL):
┌─────────────────────────────────────────────────────────────┐
│ 63 CPU cycles per raster line                               │
│                                                             │
│ Cycle 0-10:   Right border (11 cycles)                      │
│ Cycle 11-13:  Horizontal blank (3 cycles)                   │
│ Cycle 14-17:  Left border (4 cycles)                        │
│ Cycle 18-57:  Main display (40 cycles)                      │
│ Cycle 58-62:  Right border (5 cycles)                       │
│                                                             │
│ Critical events:                                            │
│ - Cycle 14-54: Character/bitmap data fetch                  │
│ - Cycle 55-56: Sprite pointer fetch                         │
│ - Cycle 58: Border compare (CSEL)                           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Instruction Cycle Reference

| Instruction | Cycles | Notes                    |
| ----------- | ------ | ------------------------ |
| NOP         | 2      | Perfect padding          |
| LDA #imm    | 2      | Load immediate           |
| LDA abs     | 4      | Load from memory         |
| STA abs     | 4      | Store to memory          |
| STA abs,X   | 5      | Indexed store (no +1)    |
| LDA abs,X   | 4(+1)  | +1 if page cross         |
| INC abs     | 6      | Read-modify-write        |
| BEQ/BNE     | 2/3/4  | Not taken/taken/cross    |
| JSR         | 6      | Subroutine call          |
| RTS         | 6      | Subroutine return        |
| BIT abs     | 4      | Test bits                |
| PHA/PLA     | 3/4    | Stack operations         |

---

## 2. Directory Structure

```
packages/compiler/src/optimizer/target/raster/
├── cycle-exact-analyzer.ts   # Cycle counting and validation
├── timing-generator.ts       # Generate timed sequences
├── cycle-budget.ts           # Cycle budget tracking
├── critical-section.ts       # Critical section analysis
└── index.ts                  # Public exports
```

---

## 3. Type Definitions

```typescript
// packages/compiler/src/optimizer/target/raster/cycle-exact-types.ts

/**
 * Cycle-counted instruction
 */
export interface CycleCountedInstruction {
  readonly instruction: string; // Assembly mnemonic
  readonly opcode: number;
  readonly baseCycles: number;
  readonly conditionalCycles: number; // Extra if condition met
  readonly pageCrossCycles: number;   // Extra if page boundary crossed
  readonly totalCycles: number;       // Final calculated cycles
}

/**
 * Timing constraint for code section
 */
export interface TimingConstraint {
  readonly minCycles: number;
  readonly maxCycles: number;
  readonly exactCycles: number | null; // null if range is acceptable
  readonly startCycle: number;         // Cycle within raster line
  readonly endCycle: number;
}

/**
 * Cycle budget for a code section
 */
export interface CycleBudget {
  readonly totalAvailable: number;
  readonly used: number;
  readonly remaining: number;
  readonly instructions: CycleCountedInstruction[];
  readonly overBudget: boolean;
  readonly underBudget: boolean;
}

/**
 * Critical section of cycle-exact code
 */
export interface CriticalSection {
  readonly startAddress: number;
  readonly endAddress: number;
  readonly constraint: TimingConstraint;
  readonly budget: CycleBudget;
  readonly issues: CycleExactIssue[];
}

/**
 * Issue in cycle-exact code
 */
export interface CycleExactIssue {
  readonly type: CycleExactIssueType;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly instructionIndex: number;
  readonly cyclePosition: number;
}

export enum CycleExactIssueType {
  OVER_BUDGET = 'over_budget',
  UNDER_BUDGET = 'under_budget',
  PAGE_CROSS_RISK = 'page_cross_risk',
  VARIABLE_TIMING = 'variable_timing',
  MISALIGNED_TIMING = 'misaligned_timing',
  BRANCH_TIMING = 'branch_timing',
}

/**
 * Timing padding options
 */
export enum PaddingStrategy {
  NOP_ONLY = 'nop_only',           // Use NOPs for padding
  BIT_ZP = 'bit_zp',               // Use BIT $xx (3 cycles)
  COMBO = 'combo',                  // Combine NOPs and BIT
  CUSTOM = 'custom',                // Custom padding sequence
}

/**
 * Cycle-exact optimization result
 */
export interface CycleExactOptimization {
  readonly type: CycleExactOptType;
  readonly description: string;
  readonly originalCycles: number;
  readonly optimizedCycles: number;
}

export enum CycleExactOptType {
  REMOVE_PADDING = 'remove_padding',
  REPLACE_INSTRUCTION = 'replace_instruction',
  REORDER_INSTRUCTIONS = 'reorder_instructions',
  USE_UNROLLING = 'use_unrolling',
}
```

---

## 4. Cycle-Exact Analyzer

```typescript
// packages/compiler/src/optimizer/target/raster/cycle-exact-analyzer.ts

import {
  CycleCountedInstruction,
  TimingConstraint,
  CycleBudget,
  CriticalSection,
  CycleExactIssue,
  CycleExactIssueType,
  PaddingStrategy,
  CycleExactOptimization,
  CycleExactOptType,
} from './cycle-exact-types.js';
import { ILInstruction, ILOpcode } from '../../../il/types.js';
import { BasicBlock } from '../../../il/cfg.js';

/**
 * 6502 instruction cycle timing table
 */
const CYCLE_TABLE: Map<ILOpcode, { base: number; conditional: number; pageCross: number }> = new Map([
  [ILOpcode.NOP, { base: 2, conditional: 0, pageCross: 0 }],
  [ILOpcode.LDA_IMM, { base: 2, conditional: 0, pageCross: 0 }],
  [ILOpcode.LDA_ABS, { base: 4, conditional: 0, pageCross: 0 }],
  [ILOpcode.LDA_ABX, { base: 4, conditional: 0, pageCross: 1 }],
  [ILOpcode.LDA_ABY, { base: 4, conditional: 0, pageCross: 1 }],
  [ILOpcode.STA_ABS, { base: 4, conditional: 0, pageCross: 0 }],
  [ILOpcode.STA_ABX, { base: 5, conditional: 0, pageCross: 0 }],
  [ILOpcode.STA_ABY, { base: 5, conditional: 0, pageCross: 0 }],
  [ILOpcode.INC_ABS, { base: 6, conditional: 0, pageCross: 0 }],
  [ILOpcode.BEQ, { base: 2, conditional: 1, pageCross: 1 }],
  [ILOpcode.BNE, { base: 2, conditional: 1, pageCross: 1 }],
  [ILOpcode.JSR, { base: 6, conditional: 0, pageCross: 0 }],
  [ILOpcode.RTS, { base: 6, conditional: 0, pageCross: 0 }],
  [ILOpcode.BIT_ABS, { base: 4, conditional: 0, pageCross: 0 }],
  [ILOpcode.BIT_ZP, { base: 3, conditional: 0, pageCross: 0 }],
  [ILOpcode.PHA, { base: 3, conditional: 0, pageCross: 0 }],
  [ILOpcode.PLA, { base: 4, conditional: 0, pageCross: 0 }],
]);

/**
 * Cycle-Exact Analyzer
 *
 * Analyzes code for cycle-exact timing requirements
 * and validates against constraints.
 */
export class CycleExactAnalyzer {
  protected readonly cyclesPerLine: number;

  constructor(cyclesPerLine: number = 63) {
    this.cyclesPerLine = cyclesPerLine;
  }

  /**
   * Count cycles for an instruction
   */
  public countCycles(instr: ILInstruction, assumePageCross: boolean = false): CycleCountedInstruction {
    const timing = CYCLE_TABLE.get(instr.opcode) || { base: 4, conditional: 0, pageCross: 0 };

    const totalCycles = timing.base + (assumePageCross ? timing.pageCross : 0);

    return {
      instruction: ILOpcode[instr.opcode],
      opcode: instr.opcode,
      baseCycles: timing.base,
      conditionalCycles: timing.conditional,
      pageCrossCycles: timing.pageCross,
      totalCycles,
    };
  }

  /**
   * Calculate cycle budget for a block
   */
  public calculateBudget(
    block: BasicBlock,
    constraint: TimingConstraint
  ): CycleBudget {
    const instructions: CycleCountedInstruction[] = [];
    let used = 0;

    for (const instr of block.instructions) {
      const counted = this.countCycles(instr);
      instructions.push(counted);
      used += counted.totalCycles;
    }

    const totalAvailable = constraint.exactCycles ?? constraint.maxCycles;

    return {
      totalAvailable,
      used,
      remaining: totalAvailable - used,
      instructions,
      overBudget: used > totalAvailable,
      underBudget: constraint.exactCycles !== null && used < constraint.exactCycles,
    };
  }

  /**
   * Analyze a critical section
   */
  public analyzeCriticalSection(
    block: BasicBlock,
    constraint: TimingConstraint
  ): CriticalSection {
    const budget = this.calculateBudget(block, constraint);
    const issues = this.detectIssues(budget, constraint);

    return {
      startAddress: 0, // Would come from context
      endAddress: 0,
      constraint,
      budget,
      issues,
    };
  }

  /**
   * Detect timing issues
   */
  protected detectIssues(
    budget: CycleBudget,
    constraint: TimingConstraint
  ): CycleExactIssue[] {
    const issues: CycleExactIssue[] = [];

    // Over budget
    if (budget.overBudget) {
      issues.push({
        type: CycleExactIssueType.OVER_BUDGET,
        severity: 'error',
        message: `Code uses ${budget.used} cycles, limit is ${budget.totalAvailable}`,
        instructionIndex: -1,
        cyclePosition: budget.used,
      });
    }

    // Under budget (for exact timing)
    if (budget.underBudget) {
      issues.push({
        type: CycleExactIssueType.UNDER_BUDGET,
        severity: constraint.exactCycles !== null ? 'error' : 'warning',
        message: `Code uses ${budget.used} cycles, need exactly ${constraint.exactCycles}`,
        instructionIndex: -1,
        cyclePosition: budget.used,
      });
    }

    // Check for page cross risks
    let cyclePosition = constraint.startCycle;
    for (let i = 0; i < budget.instructions.length; i++) {
      const instr = budget.instructions[i];

      if (instr.pageCrossCycles > 0) {
        issues.push({
          type: CycleExactIssueType.PAGE_CROSS_RISK,
          severity: 'warning',
          message: `${instr.instruction} may add ${instr.pageCrossCycles} extra cycle(s) on page cross`,
          instructionIndex: i,
          cyclePosition,
        });
      }

      // Check for variable timing branches
      if (instr.conditionalCycles > 0) {
        issues.push({
          type: CycleExactIssueType.BRANCH_TIMING,
          severity: 'warning',
          message: `${instr.instruction} has variable timing (${instr.baseCycles}-${instr.baseCycles + instr.conditionalCycles + instr.pageCrossCycles} cycles)`,
          instructionIndex: i,
          cyclePosition,
        });
      }

      cyclePosition += instr.totalCycles;
    }

    return issues;
  }

  /**
   * Generate padding to hit exact cycle count
   */
  public generatePadding(
    cyclesToFill: number,
    strategy: PaddingStrategy
  ): string[] {
    const instructions: string[] = [];

    if (cyclesToFill <= 0) return instructions;

    switch (strategy) {
      case PaddingStrategy.NOP_ONLY:
        // NOPs are 2 cycles each
        const nopCount = Math.floor(cyclesToFill / 2);
        for (let i = 0; i < nopCount; i++) {
          instructions.push('NOP');
        }
        // If odd cycles remaining, we need a 3-cycle instruction
        if (cyclesToFill % 2 === 1) {
          instructions.push('BIT $00'); // 3 cycles
          instructions.pop(); // Remove one NOP
        }
        break;

      case PaddingStrategy.BIT_ZP:
        // BIT $xx is 3 cycles
        const bitCount = Math.floor(cyclesToFill / 3);
        for (let i = 0; i < bitCount; i++) {
          instructions.push('BIT $00');
        }
        const remaining = cyclesToFill % 3;
        for (let i = 0; i < remaining / 2; i++) {
          instructions.push('NOP');
        }
        break;

      case PaddingStrategy.COMBO:
        // Optimize for minimum instruction count
        let cycles = cyclesToFill;
        while (cycles > 0) {
          if (cycles >= 3 && cycles % 2 === 1) {
            instructions.push('BIT $00');
            cycles -= 3;
          } else if (cycles >= 2) {
            instructions.push('NOP');
            cycles -= 2;
          } else {
            // Can't perfectly fill 1 cycle
            break;
          }
        }
        break;
    }

    return instructions;
  }

  /**
   * Find optimizations for cycle-exact code
   */
  public findOptimizations(section: CriticalSection): CycleExactOptimization[] {
    const optimizations: CycleExactOptimization[] = [];

    // Check for excessive padding
    let nopCount = 0;
    for (const instr of section.budget.instructions) {
      if (instr.instruction === 'NOP') nopCount++;
    }

    if (nopCount > 5) {
      optimizations.push({
        type: CycleExactOptType.REMOVE_PADDING,
        description: `Replace ${nopCount} NOPs with useful work`,
        originalCycles: nopCount * 2,
        optimizedCycles: 0,
      });
    }

    // Check for instruction replacement opportunities
    for (let i = 0; i < section.budget.instructions.length; i++) {
      const instr = section.budget.instructions[i];

      // STA abs,X (5 cycles) could be STA abs (4 cycles) if index not needed
      if (instr.instruction === 'STA_ABX' || instr.instruction === 'STA_ABY') {
        optimizations.push({
          type: CycleExactOptType.REPLACE_INSTRUCTION,
          description: `Consider STA abs (4 cycles) instead of ${instr.instruction} (5 cycles)`,
          originalCycles: 5,
          optimizedCycles: 4,
        });
      }
    }

    return optimizations;
  }
}
```

---

## 5. Timing Generator

```typescript
// packages/compiler/src/optimizer/target/raster/timing-generator.ts

import { PaddingStrategy } from './cycle-exact-types.js';

/**
 * Timing sequence template
 */
export interface TimingTemplate {
  readonly name: string;
  readonly totalCycles: number;
  readonly instructions: string[];
}

/**
 * Timing Generator
 *
 * Generates cycle-exact code sequences for common patterns.
 */
export class TimingGenerator {
  /**
   * Generate a stable loop of exactly N cycles
   */
  public generateStableLoop(cyclesPerIteration: number, iterations: number): string[] {
    const instructions: string[] = [];

    // Standard 2-cycle loop decrement
    // LDX #iterations  (2 cycles)
    // loop: DEX        (2 cycles)
    //       BNE loop   (3 cycles if taken, 2 if not)
    // Total: 2 + (iterations * 5) - 1 = 1 + iterations * 5

    instructions.push(`LDX #${iterations}`);
    instructions.push('loop:');
    
    // Add padding NOPs to hit target cycles
    const cyclesInLoop = cyclesPerIteration - 5; // DEX (2) + BNE taken (3)
    const nops = Math.floor(cyclesInLoop / 2);
    for (let i = 0; i < nops; i++) {
      instructions.push('  NOP');
    }
    
    instructions.push('  DEX');
    instructions.push('  BNE loop');

    return instructions;
  }

  /**
   * Generate exact cycle delay
   */
  public generateDelay(cycles: number, strategy: PaddingStrategy = PaddingStrategy.COMBO): string[] {
    const instructions: string[] = [];
    let remaining = cycles;

    // Use loops for large delays
    if (remaining >= 20) {
      const loopIterations = Math.floor(remaining / 7);
      if (loopIterations > 0) {
        instructions.push(`; ${loopIterations * 7} cycles via loop`);
        instructions.push(`LDX #${loopIterations}`);
        instructions.push('delay_loop:');
        instructions.push('  DEX');
        instructions.push('  BNE delay_loop');
        remaining -= loopIterations * 7;
      }
    }

    // Fill remaining with padding
    instructions.push(`; ${remaining} cycles via padding`);
    while (remaining >= 4) {
      instructions.push('BIT $EA'); // 4 cycles, doesn't affect registers
      remaining -= 4;
    }
    while (remaining >= 3) {
      instructions.push('BIT $00'); // 3 cycles
      remaining -= 3;
    }
    while (remaining >= 2) {
      instructions.push('NOP'); // 2 cycles
      remaining -= 2;
    }

    if (remaining === 1) {
      instructions.push('; WARNING: Cannot achieve exactly 1 cycle');
    }

    return instructions;
  }

  /**
   * Generate raster line wait
   */
  public generateRasterWait(targetLine: number): string[] {
    return [
      `; Wait for raster line ${targetLine}`,
      `wait_raster:`,
      `  LDA $D012`,
      `  CMP #${targetLine}`,
      `  BNE wait_raster`,
    ];
  }

  /**
   * Common timing templates
   */
  public getTemplate(name: string): TimingTemplate | undefined {
    const templates: Map<string, TimingTemplate> = new Map([
      ['2_cycle', { name: '2-cycle delay', totalCycles: 2, instructions: ['NOP'] }],
      ['3_cycle', { name: '3-cycle delay', totalCycles: 3, instructions: ['BIT $00'] }],
      ['4_cycle', { name: '4-cycle delay', totalCycles: 4, instructions: ['NOP', 'NOP'] }],
      ['5_cycle', { name: '5-cycle delay', totalCycles: 5, instructions: ['BIT $00', 'NOP'] }],
      ['6_cycle', { name: '6-cycle delay', totalCycles: 6, instructions: ['NOP', 'NOP', 'NOP'] }],
      ['7_cycle', { name: '7-cycle delay', totalCycles: 7, instructions: ['BIT $00', 'NOP', 'NOP'] }],
      ['63_cycle', { name: 'full raster line', totalCycles: 63, instructions: ['JSR delay_63'] }],
    ]);

    return templates.get(name);
  }
}
```

---

## 6. Blend65 Syntax Integration

```js
// Cycle-exact timing in Blend65

@map VIC_BORDER at $D020: byte;
@map VIC_BGCOLOR at $D021: byte;

// Exact 63-cycle raster line routine
function exactLine(): void {
    // Total must be exactly 63 cycles
    VIC_BORDER = $01;    // 4 cycles (STA abs)
    asm {
        nop              // 2 cycles
        nop              // 2 cycles
        nop              // 2 cycles
    }
    VIC_BORDER = $00;    // 4 cycles
    
    // Fill remaining: 63 - 14 = 49 cycles
    asm {
        bit $00          // 3
        nop              // 2 = 5
        nop              // 2 = 7
        nop              // 2 = 9
        nop              // 2 = 11
        bit $00          // 3 = 14
        nop              // 2 = 16
        nop              // 2 = 18
        nop              // 2 = 20
        bit $00          // 3 = 23
        nop              // 2 = 25
        nop              // 2 = 27
        nop              // 2 = 29
        bit $00          // 3 = 32
        nop              // 2 = 34
        nop              // 2 = 36
        nop              // 2 = 38
        bit $00          // 3 = 41
        nop              // 2 = 43
        nop              // 2 = 45
        nop              // 2 = 47
        nop              // 2 = 49
    }
}

// Compiler annotation for cycle-exact section
@cycles(63)
function rasterBar(): void {
    // Compiler will verify this takes exactly 63 cycles
    VIC_BGCOLOR = $02;
    asm { nop; nop; nop }
    VIC_BGCOLOR = $00;
    // ... padding auto-generated by compiler
}
```

---

## 7. Test Requirements

| Category           | Test Cases | Coverage Target |
| ------------------ | ---------- | --------------- |
| Cycle counting     | 6          | 100%            |
| Budget calculation | 5          | 100%            |
| Issue detection    | 5          | 100%            |
| Padding generation | 4          | 100%            |
| Timing templates   | 3          | 100%            |
| Optimization       | 2          | 100%            |
| **Total**          | **25**     | **100%**        |

---

## 8. Task Checklist

- [ ] Create type definitions for cycle-exact timing
- [ ] Implement cycle counting analyzer
- [ ] Implement budget calculator
- [ ] Implement issue detection
- [ ] Implement padding generator
- [ ] Implement timing templates
- [ ] Create unit tests for all components

---

**Next Document**: `09-03b2-raster-nop-slides.md` (Session 4.3b2: Raster NOP slide patterns)
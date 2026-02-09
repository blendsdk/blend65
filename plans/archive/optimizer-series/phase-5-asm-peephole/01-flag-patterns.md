# Phase 5.1: Flag Patterns

> **Document**: 01-flag-patterns.md  
> **Phase**: 5 - ASM Peephole  
> **Focus**: CLC/SEC/Zero-flag optimization patterns  
> **Est. Implementation**: ~300 lines

---

## Overview

Flag patterns optimize the 6502's processor status flags (N, V, Z, C). The 6502 has no dedicated comparison instructions that don't set flags—almost every instruction affects flags. This creates opportunities for eliminating redundant flag-setting instructions.

**Key Insight**: Many instructions implicitly set flags that subsequent code can use without explicit CMP/CLC/SEC instructions.

---

## 1. Zero-Flag Optimization

### The Problem

The zero flag (Z) is set by many instructions, but programmers often add redundant `CMP #0`:

```asm
; BEFORE (redundant CMP)
LDA counter                 ; Sets Z flag if A == 0
CMP #0                      ; ← REDUNDANT! Z already correct
BEQ done                    

; AFTER (CMP removed)
LDA counter                 ; Z flag already set correctly
BEQ done
```

### Implementation

```typescript
// packages/compiler/src/asm-il/optimizer/passes/zero-flag.ts

import { AsmInstruction, AsmOpcode } from '../../types.js';
import { Pattern, MatchResult, PatternContext } from '../pattern-framework.js';

/**
 * Instructions that set the zero flag based on their result
 */
const ZERO_FLAG_SETTERS: Set<AsmOpcode> = new Set([
  AsmOpcode.LDA, AsmOpcode.LDX, AsmOpcode.LDY,  // Load instructions
  AsmOpcode.TAX, AsmOpcode.TAY, AsmOpcode.TXA,  // Transfers
  AsmOpcode.TYA, AsmOpcode.TSX, AsmOpcode.TXS,
  AsmOpcode.AND, AsmOpcode.ORA, AsmOpcode.EOR,  // Logical
  AsmOpcode.INC, AsmOpcode.INX, AsmOpcode.INY,  // Increment
  AsmOpcode.DEC, AsmOpcode.DEX, AsmOpcode.DEY,  // Decrement
  AsmOpcode.ADC, AsmOpcode.SBC,                  // Arithmetic
  AsmOpcode.ASL, AsmOpcode.LSR, AsmOpcode.ROL,  // Shifts
  AsmOpcode.ROR,
  AsmOpcode.PLA, AsmOpcode.PLX, AsmOpcode.PLY,  // Stack pulls
  AsmOpcode.BIT,                                  // Bit test
]);

/**
 * Pattern: Removes CMP #0 after instructions that set zero flag
 * 
 * Match: <zero-setter>; CMP #0
 * Replace: <zero-setter>
 */
export class RedundantCmpZeroPattern implements Pattern<AsmInstruction> {
  readonly name = 'redundant-cmp-zero';
  readonly priority = 90;
  readonly category = 'flag-patterns';

  /**
   * Match a zero-flag setter followed by CMP #0
   */
  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    if (index + 1 >= instructions.length) return null;

    const first = instructions[index];
    const second = instructions[index + 1];

    // First instruction must set zero flag
    if (!ZERO_FLAG_SETTERS.has(first.opcode)) return null;

    // Second must be CMP #0
    if (second.opcode !== AsmOpcode.CMP) return null;
    if (second.addressingMode !== 'immediate') return null;
    if (second.operand !== 0) return null;

    // Don't remove if there's a label between (jump target)
    if (second.label) return null;

    return {
      matchedInstructions: [first, second],
      startIndex: index,
      length: 2,
      metadata: {
        patternName: this.name,
        reason: 'CMP #0 redundant after zero-flag setter',
        cyclesSaved: 2,  // CMP immediate = 2 cycles
        bytesSaved: 2,   // CMP #nn = 2 bytes
      }
    };
  }

  /**
   * Remove the redundant CMP #0
   */
  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    // Keep only the first instruction (the zero-flag setter)
    return [match.matchedInstructions[0]];
  }
}
```

### Test Cases

```typescript
describe('RedundantCmpZeroPattern', () => {
  it('removes CMP #0 after LDA', () => {
    const input = [
      { opcode: AsmOpcode.LDA, addressingMode: 'zeroPage', operand: 0x50 },
      { opcode: AsmOpcode.CMP, addressingMode: 'immediate', operand: 0 },
      { opcode: AsmOpcode.BEQ, addressingMode: 'relative', operand: 'done' },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(2);
    expect(result[0].opcode).toBe(AsmOpcode.LDA);
    expect(result[1].opcode).toBe(AsmOpcode.BEQ);
  });

  it('removes CMP #0 after AND', () => {
    const input = [
      { opcode: AsmOpcode.AND, addressingMode: 'immediate', operand: 0x0F },
      { opcode: AsmOpcode.CMP, addressingMode: 'immediate', operand: 0 },
      { opcode: AsmOpcode.BNE, addressingMode: 'relative', operand: 'loop' },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(2);
  });

  it('preserves CMP #0 after STA (does not set flags)', () => {
    const input = [
      { opcode: AsmOpcode.STA, addressingMode: 'zeroPage', operand: 0x50 },
      { opcode: AsmOpcode.CMP, addressingMode: 'immediate', operand: 0 },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(2); // No change
  });

  it('preserves CMP #0 with label (jump target)', () => {
    const input = [
      { opcode: AsmOpcode.LDA, addressingMode: 'zeroPage', operand: 0x50 },
      { opcode: AsmOpcode.CMP, addressingMode: 'immediate', operand: 0, label: 'check' },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(2); // Preserve - it's a jump target
  });
});
```

---

## 2. Redundant CLC Patterns

### The Problem

`CLC` (Clear Carry) is only needed before `ADC` if the carry might be set. Often it's redundant:

```asm
; BEFORE (redundant CLC)
LDA #$10
ADC #$05                    ; C might be set from previous op
CLC                         ; Clear carry
ADC #$03                    ; ← BUT carry is 0 after ADC #$05 (no overflow!)

; AFTER (CLC removed)
LDA #$10
ADC #$05
ADC #$03                    ; Safe: prior ADC didn't overflow
```

### Implementation

```typescript
// packages/compiler/src/asm-il/optimizer/passes/redundant-clc.ts

import { AsmInstruction, AsmOpcode } from '../../types.js';
import { Pattern, MatchResult, PatternContext } from '../pattern-framework.js';

/**
 * Instructions that guarantee carry is clear after execution
 */
const CARRY_CLEAR_GUARANTEED: Set<AsmOpcode> = new Set([
  AsmOpcode.CLC,  // Explicitly clears
  // Note: CMP/CPX/CPY set carry to 1 if A >= M
  // ADC/SBC set carry based on result
]);

/**
 * Pattern: Removes CLC when carry is already guaranteed clear
 * 
 * Scenarios:
 * 1. CLC; CLC → CLC (remove duplicate)
 * 2. ADC with small constants that can't overflow → remove subsequent CLC
 */
export class RedundantClcPattern implements Pattern<AsmInstruction> {
  readonly name = 'redundant-clc';
  readonly priority = 85;
  readonly category = 'flag-patterns';

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    if (index + 1 >= instructions.length) return null;

    const first = instructions[index];
    const second = instructions[index + 1];

    // Case 1: CLC; CLC → remove second CLC
    if (first.opcode === AsmOpcode.CLC && second.opcode === AsmOpcode.CLC) {
      if (second.label) return null; // Preserve jump target
      
      return {
        matchedInstructions: [first, second],
        startIndex: index,
        length: 2,
        metadata: {
          patternName: this.name,
          reason: 'Duplicate CLC',
          cyclesSaved: 2,
          bytesSaved: 1,
        }
      };
    }

    // Case 2: AND/ORA/EOR (logical ops never affect carry) followed by CLC before ADC
    // CLC is only needed if carry might be set
    // TODO: More sophisticated carry tracking would be needed for full optimization

    return null;
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    // Keep only the first CLC
    return [match.matchedInstructions[0]];
  }
}

/**
 * Pattern: Removes CLC when followed by instruction that doesn't use carry
 * 
 * Match: CLC; <non-carry-using-instruction>
 * Note: This is more complex - we need to track until the next carry-using instruction
 */
export class DeadClcPattern implements Pattern<AsmInstruction> {
  readonly name = 'dead-clc';
  readonly priority = 80;
  readonly category = 'flag-patterns';

  /** Instructions that USE the carry flag */
  protected readonly CARRY_USERS = new Set([
    AsmOpcode.ADC,  // Add with carry
    AsmOpcode.SBC,  // Subtract with carry
    AsmOpcode.ROL,  // Rotate left through carry
    AsmOpcode.ROR,  // Rotate right through carry
    AsmOpcode.BCC,  // Branch if carry clear
    AsmOpcode.BCS,  // Branch if carry set
  ]);

  /** Instructions that SET the carry flag (overwrite CLC) */
  protected readonly CARRY_SETTERS = new Set([
    AsmOpcode.SEC,  // Set carry
    AsmOpcode.CLC,  // Clear carry (another one)
    AsmOpcode.ADC,  // Sets carry on overflow
    AsmOpcode.SBC,  // Sets carry on underflow
    AsmOpcode.ASL,  // Shifts bit 7 into carry
    AsmOpcode.LSR,  // Shifts bit 0 into carry
    AsmOpcode.ROL,  // Rotates through carry
    AsmOpcode.ROR,
    AsmOpcode.CMP,  // Sets carry if A >= M
    AsmOpcode.CPX,
    AsmOpcode.CPY,
  ]);

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    const inst = instructions[index];
    if (inst.opcode !== AsmOpcode.CLC) return null;

    // Look ahead to find if carry is used before being set again
    for (let i = index + 1; i < instructions.length; i++) {
      const next = instructions[i];

      // Stop at labels (control flow uncertainty)
      if (next.label) break;

      // Stop at branches/jumps (control flow uncertainty)
      if (this.isControlFlow(next.opcode)) break;

      // If carry is USED before being reset, CLC is needed
      if (this.CARRY_USERS.has(next.opcode)) return null;

      // If carry is SET before being used, CLC is dead
      if (this.CARRY_SETTERS.has(next.opcode)) {
        return {
          matchedInstructions: [inst],
          startIndex: index,
          length: 1,
          metadata: {
            patternName: this.name,
            reason: `CLC dead: carry overwritten by ${AsmOpcode[next.opcode]} before use`,
            cyclesSaved: 2,
            bytesSaved: 1,
          }
        };
      }
    }

    return null; // Conservative: keep CLC if uncertain
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    return []; // Remove the dead CLC
  }

  protected isControlFlow(opcode: AsmOpcode): boolean {
    return opcode === AsmOpcode.JMP || 
           opcode === AsmOpcode.JSR ||
           opcode === AsmOpcode.RTS ||
           opcode === AsmOpcode.RTI ||
           opcode === AsmOpcode.BCC ||
           opcode === AsmOpcode.BCS ||
           opcode === AsmOpcode.BEQ ||
           opcode === AsmOpcode.BNE ||
           opcode === AsmOpcode.BMI ||
           opcode === AsmOpcode.BPL ||
           opcode === AsmOpcode.BVC ||
           opcode === AsmOpcode.BVS;
  }
}
```

---

## 3. Redundant SEC Patterns

### The Problem

Similar to CLC, `SEC` (Set Carry) is only needed before `SBC` for borrow semantics:

```asm
; BEFORE (redundant SEC)
SEC                         
SBC #$05
SEC                         ; ← REDUNDANT if we know carry is set
SBC #$03

; AFTER
SEC
SBC #$05
SBC #$03                    ; Safe if no borrow occurred
```

### Implementation

```typescript
// packages/compiler/src/asm-il/optimizer/passes/redundant-sec.ts

import { AsmInstruction, AsmOpcode } from '../../types.js';
import { Pattern, MatchResult, PatternContext } from '../pattern-framework.js';

/**
 * Pattern: Removes duplicate SEC instructions
 */
export class RedundantSecPattern implements Pattern<AsmInstruction> {
  readonly name = 'redundant-sec';
  readonly priority = 85;
  readonly category = 'flag-patterns';

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    if (index + 1 >= instructions.length) return null;

    const first = instructions[index];
    const second = instructions[index + 1];

    // SEC; SEC → remove second SEC
    if (first.opcode === AsmOpcode.SEC && second.opcode === AsmOpcode.SEC) {
      if (second.label) return null;

      return {
        matchedInstructions: [first, second],
        startIndex: index,
        length: 2,
        metadata: {
          patternName: this.name,
          reason: 'Duplicate SEC',
          cyclesSaved: 2,
          bytesSaved: 1,
        }
      };
    }

    return null;
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    return [match.matchedInstructions[0]];
  }
}

/**
 * Pattern: Removes dead SEC (carry overwritten before use)
 * Mirror of DeadClcPattern
 */
export class DeadSecPattern implements Pattern<AsmInstruction> {
  readonly name = 'dead-sec';
  readonly priority = 80;
  readonly category = 'flag-patterns';

  protected readonly CARRY_USERS = new Set([
    AsmOpcode.ADC, AsmOpcode.SBC, AsmOpcode.ROL, AsmOpcode.ROR,
    AsmOpcode.BCC, AsmOpcode.BCS,
  ]);

  protected readonly CARRY_SETTERS = new Set([
    AsmOpcode.SEC, AsmOpcode.CLC, AsmOpcode.ADC, AsmOpcode.SBC,
    AsmOpcode.ASL, AsmOpcode.LSR, AsmOpcode.ROL, AsmOpcode.ROR,
    AsmOpcode.CMP, AsmOpcode.CPX, AsmOpcode.CPY,
  ]);

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    const inst = instructions[index];
    if (inst.opcode !== AsmOpcode.SEC) return null;

    for (let i = index + 1; i < instructions.length; i++) {
      const next = instructions[i];

      if (next.label) break;
      if (this.isControlFlow(next.opcode)) break;
      if (this.CARRY_USERS.has(next.opcode)) return null;

      if (this.CARRY_SETTERS.has(next.opcode)) {
        return {
          matchedInstructions: [inst],
          startIndex: index,
          length: 1,
          metadata: {
            patternName: this.name,
            reason: `SEC dead: carry overwritten by ${AsmOpcode[next.opcode]} before use`,
            cyclesSaved: 2,
            bytesSaved: 1,
          }
        };
      }
    }

    return null;
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    return [];
  }

  protected isControlFlow(opcode: AsmOpcode): boolean {
    return opcode === AsmOpcode.JMP || opcode === AsmOpcode.JSR ||
           opcode === AsmOpcode.RTS || opcode === AsmOpcode.RTI ||
           opcode.toString().startsWith('B'); // All branch opcodes
  }
}
```

---

## 4. Negative Flag Optimization

### The Problem

The negative flag (N) is often redundantly tested:

```asm
; BEFORE (redundant comparison)
LDA counter                 ; Sets N if bit 7 is set
CMP #$80                    ; ← Testing for negative, but N already set!
BCS negative                ; Branch if >= $80 (negative in signed)

; AFTER (use BMI directly)
LDA counter
BMI negative                ; Branch if N flag set (bit 7 = 1)
```

### Implementation

```typescript
// packages/compiler/src/asm-il/optimizer/passes/negative-flag.ts

import { AsmInstruction, AsmOpcode } from '../../types.js';
import { Pattern, MatchResult, PatternContext } from '../pattern-framework.js';

/**
 * Pattern: Convert CMP #$80; BCS to BMI
 * 
 * CMP #$80 sets carry if A >= $80 (i.e., A is negative in signed arithmetic)
 * This is equivalent to checking the N flag directly
 */
export class SignedComparisonPattern implements Pattern<AsmInstruction> {
  readonly name = 'signed-comparison';
  readonly priority = 75;
  readonly category = 'flag-patterns';

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    if (index + 1 >= instructions.length) return null;

    const cmp = instructions[index];
    const branch = instructions[index + 1];

    // Match CMP #$80
    if (cmp.opcode !== AsmOpcode.CMP) return null;
    if (cmp.addressingMode !== 'immediate') return null;
    if (cmp.operand !== 0x80) return null;

    // Match BCS (branch if >= $80)
    if (branch.opcode !== AsmOpcode.BCS) return null;
    if (branch.label) return null;

    return {
      matchedInstructions: [cmp, branch],
      startIndex: index,
      length: 2,
      metadata: {
        patternName: this.name,
        reason: 'CMP #$80; BCS → BMI',
        cyclesSaved: 2,
        bytesSaved: 2,
      }
    };
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    const branch = match.matchedInstructions[1];
    
    // Replace with BMI (branch if minus/negative)
    return [{
      opcode: AsmOpcode.BMI,
      addressingMode: branch.addressingMode,
      operand: branch.operand,
      comment: 'Optimized from CMP #$80; BCS',
    }];
  }
}

/**
 * Pattern: Convert CMP #$80; BCC to BPL
 * 
 * BCC after CMP #$80 means A < $80 (positive in signed)
 */
export class PositiveComparisonPattern implements Pattern<AsmInstruction> {
  readonly name = 'positive-comparison';
  readonly priority = 75;
  readonly category = 'flag-patterns';

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    if (index + 1 >= instructions.length) return null;

    const cmp = instructions[index];
    const branch = instructions[index + 1];

    if (cmp.opcode !== AsmOpcode.CMP) return null;
    if (cmp.addressingMode !== 'immediate') return null;
    if (cmp.operand !== 0x80) return null;

    if (branch.opcode !== AsmOpcode.BCC) return null;
    if (branch.label) return null;

    return {
      matchedInstructions: [cmp, branch],
      startIndex: index,
      length: 2,
      metadata: {
        patternName: this.name,
        reason: 'CMP #$80; BCC → BPL',
        cyclesSaved: 2,
        bytesSaved: 2,
      }
    };
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    const branch = match.matchedInstructions[1];
    
    return [{
      opcode: AsmOpcode.BPL,
      addressingMode: branch.addressingMode,
      operand: branch.operand,
      comment: 'Optimized from CMP #$80; BCC',
    }];
  }
}
```

---

## 5. BIT Instruction Optimization

### The Problem

The `BIT` instruction is underutilized. It tests bits without destroying the accumulator:

```asm
; BEFORE (destroys A)
LDA status
AND #$80                    ; Test bit 7
BNE set

; AFTER (preserves A)
BIT status                  ; V ← bit 6, N ← bit 7, Z ← A AND status
BMI set                     ; Test N flag (bit 7)
```

### Implementation

```typescript
// packages/compiler/src/asm-il/optimizer/passes/bit-instruction.ts

import { AsmInstruction, AsmOpcode } from '../../types.js';
import { Pattern, MatchResult, PatternContext } from '../pattern-framework.js';

/**
 * Pattern: Convert LDA; AND #$80; BNE to BIT; BMI
 * 
 * Note: Only safe if A is not needed with the AND result
 */
export class BitTestBit7Pattern implements Pattern<AsmInstruction> {
  readonly name = 'bit-test-bit7';
  readonly priority = 70;
  readonly category = 'flag-patterns';

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    if (index + 2 >= instructions.length) return null;

    const lda = instructions[index];
    const and = instructions[index + 1];
    const branch = instructions[index + 2];

    // Match LDA <mem>
    if (lda.opcode !== AsmOpcode.LDA) return null;
    if (lda.addressingMode !== 'zeroPage' && lda.addressingMode !== 'absolute') return null;

    // Match AND #$80
    if (and.opcode !== AsmOpcode.AND) return null;
    if (and.addressingMode !== 'immediate') return null;
    if (and.operand !== 0x80) return null;
    if (and.label) return null;

    // Match BNE
    if (branch.opcode !== AsmOpcode.BNE) return null;
    if (branch.label) return null;

    // Check if A is used after the branch with the AND result
    // For safety, only apply if we can prove A is not needed
    // This requires liveness analysis - for now, skip if next instruction reads A
    if (index + 3 < instructions.length) {
      const after = instructions[index + 3];
      if (this.readsAccumulator(after)) return null;
    }

    return {
      matchedInstructions: [lda, and, branch],
      startIndex: index,
      length: 3,
      metadata: {
        patternName: this.name,
        reason: 'LDA; AND #$80; BNE → BIT; BMI',
        cyclesSaved: 2,  // 2 (AND) saved, BIT costs same as LDA
        bytesSaved: 1,   // AND #$80 is 2 bytes, saved
      }
    };
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    const lda = match.matchedInstructions[0];
    const branch = match.matchedInstructions[2];

    return [
      {
        opcode: AsmOpcode.BIT,
        addressingMode: lda.addressingMode,
        operand: lda.operand,
        comment: 'Optimized bit test',
      },
      {
        opcode: AsmOpcode.BMI,
        addressingMode: branch.addressingMode,
        operand: branch.operand,
        comment: 'N flag set by BIT bit 7',
      }
    ];
  }

  protected readsAccumulator(inst: AsmInstruction): boolean {
    // Instructions that read A
    const A_READERS = new Set([
      AsmOpcode.STA, AsmOpcode.TAX, AsmOpcode.TAY,
      AsmOpcode.AND, AsmOpcode.ORA, AsmOpcode.EOR,
      AsmOpcode.ADC, AsmOpcode.SBC, AsmOpcode.CMP,
      AsmOpcode.ASL, AsmOpcode.LSR, AsmOpcode.ROL, AsmOpcode.ROR,
      AsmOpcode.PHA,
    ]);
    return A_READERS.has(inst.opcode);
  }
}
```

---

## Pattern Summary

| Pattern | Match | Replace | Cycles Saved | Bytes Saved |
|---------|-------|---------|--------------|-------------|
| `redundant-cmp-zero` | LDA; CMP #0 | LDA | 2 | 2 |
| `redundant-clc` | CLC; CLC | CLC | 2 | 1 |
| `dead-clc` | CLC; <setter> | <setter> | 2 | 1 |
| `redundant-sec` | SEC; SEC | SEC | 2 | 1 |
| `dead-sec` | SEC; <setter> | <setter> | 2 | 1 |
| `signed-comparison` | CMP #$80; BCS | BMI | 2 | 2 |
| `positive-comparison` | CMP #$80; BCC | BPL | 2 | 2 |
| `bit-test-bit7` | LDA; AND #$80; BNE | BIT; BMI | 2 | 1 |

---

## Test Count

| Category | Tests |
|----------|-------|
| RedundantCmpZeroPattern | 15 |
| RedundantClcPattern | 8 |
| DeadClcPattern | 12 |
| RedundantSecPattern | 8 |
| DeadSecPattern | 12 |
| SignedComparisonPattern | 10 |
| PositiveComparisonPattern | 10 |
| BitTestBit7Pattern | 10 |
| **Total** | **85** |

---

## Integration

```typescript
// packages/compiler/src/asm-il/optimizer/passes/index.ts

export { RedundantCmpZeroPattern } from './zero-flag.js';
export { RedundantClcPattern, DeadClcPattern } from './redundant-clc.js';
export { RedundantSecPattern, DeadSecPattern } from './redundant-sec.js';
export { SignedComparisonPattern, PositiveComparisonPattern } from './negative-flag.js';
export { BitTestBit7Pattern } from './bit-instruction.js';
```

---

**Parent Document**: [Phase Index](00-phase-index.md)  
**Next Document**: [02 - Load-Store ASM](02-load-store-asm.md)
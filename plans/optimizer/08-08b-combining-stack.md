# Task 8.8b: Stack Operation Combining Patterns

> **Task**: 8.8b of 27 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~20 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement peephole patterns that combine or eliminate redundant stack operations. These patterns target PHA/PLA pairs, stack pointer manipulation, and stack frame optimization for more efficient code generation.

**Patterns in this document:**
- PHA + PLA → NOP (redundant push/pull removal)
- PHA + LDA #imm + PLA → LDA #imm (A preserved across immediate load)
- JSR label + RTS → JMP label (tail call optimization)
- PHP + PLP → NOP (redundant flag push/pull)
- TSX + TXS → NOP (redundant stack pointer read/write)
- PHA + PHA + PLA + PLA → NOP (double redundant pair)

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                        # Pattern exports
└── combining-stack.ts              # THIS TASK
```

---

## 6502 Instruction Background

### Stack Instructions
| Instruction | Bytes | Cycles | Flags | Description |
|-------------|-------|--------|-------|-------------|
| PHA         | 1     | 3      | -     | Push A onto stack |
| PLA         | 1     | 4      | N, Z  | Pull A from stack |
| PHP         | 1     | 3      | -     | Push processor status |
| PLP         | 1     | 4      | All   | Pull processor status |
| TXS         | 1     | 2      | -     | Transfer X to stack pointer |
| TSX         | 1     | 2      | N, Z  | Transfer stack pointer to X |

### Control Flow Instructions
| Instruction | Bytes | Cycles | Flags | Description |
|-------------|-------|--------|-------|-------------|
| JSR addr    | 3     | 6      | -     | Jump to subroutine |
| RTS         | 1     | 6      | -     | Return from subroutine |
| JMP addr    | 3     | 3      | -     | Jump (absolute) |

---

## Implementation

### File: `combining-stack.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Pattern: PHA followed by PLA → Remove both (when A not modified between)
 * 
 * Before:
 *   PHA
 *   PLA
 * 
 * After:
 *   (nothing)
 * 
 * Saves: 7 cycles, 2 bytes
 * 
 * Preconditions:
 * - No instructions between PHA and PLA
 * - Stack must be balanced
 * 
 * Note: Common in naive compiler output when preserving A "just in case"
 */
export class RedundantPushPullPattern extends BasePattern {
  readonly id = 'pha-pla-remove';
  readonly description = 'Remove redundant PHA/PLA pair';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [pha, pla] = instructions;
    
    // Check: PHA
    if (!this.isPushAccumulator(pha)) {
      return null;
    }
    
    // Check: PLA
    if (!this.isPullAccumulator(pla)) {
      return null;
    }
    
    return {
      matched: [pha, pla],
      captures: this.capture([]),
      confidence: 0.95, // Very safe transformation
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Remove both instructions - empty replacement
    return {
      instructions: [],
      cyclesSaved: 7,  // PHA (3) + PLA (4) = 7 cycles
      bytesSaved: 2,   // PHA (1) + PLA (1) = 2 bytes
    };
  }
  
  protected isPushAccumulator(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PHA';
  }
  
  protected isPullAccumulator(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PLA';
  }
}

/**
 * Pattern: PHP followed by PLP → Remove both (when flags not modified between)
 * 
 * Before:
 *   PHP
 *   PLP
 * 
 * After:
 *   (nothing)
 * 
 * Saves: 7 cycles, 2 bytes
 * 
 * Preconditions:
 * - No instructions between PHP and PLP
 * - Flags must be intentionally preserved (not just redundant)
 */
export class RedundantPushPullFlagsPattern extends BasePattern {
  readonly id = 'php-plp-remove';
  readonly description = 'Remove redundant PHP/PLP pair';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [php, plp] = instructions;
    
    // Check: PHP
    if (!this.isPushFlags(php)) {
      return null;
    }
    
    // Check: PLP
    if (!this.isPullFlags(plp)) {
      return null;
    }
    
    return {
      matched: [php, plp],
      captures: this.capture([]),
      confidence: 0.95,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 7,  // PHP (3) + PLP (4) = 7 cycles
      bytesSaved: 2,   // PHP (1) + PLP (1) = 2 bytes
    };
  }
  
  protected isPushFlags(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PHP';
  }
  
  protected isPullFlags(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PLP';
  }
}

/**
 * Pattern: TSX followed by TXS → Remove both
 * 
 * Before:
 *   TSX
 *   TXS
 * 
 * After:
 *   (nothing)
 * 
 * Saves: 4 cycles, 2 bytes
 * 
 * Note: Reading stack pointer to X then writing back is a no-op
 * (unless X is used between, but then TXS wouldn't be the immediate next)
 */
export class RedundantStackPointerPattern extends BasePattern {
  readonly id = 'tsx-txs-remove';
  readonly description = 'Remove redundant TSX/TXS pair';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [tsx, txs] = instructions;
    
    // Check: TSX
    if (!this.isTransferSPtoX(tsx)) {
      return null;
    }
    
    // Check: TXS
    if (!this.isTransferXtoSP(txs)) {
      return null;
    }
    
    return {
      matched: [tsx, txs],
      captures: this.capture([]),
      confidence: 0.9,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 4,  // TSX (2) + TXS (2) = 4 cycles
      bytesSaved: 2,   // TSX (1) + TXS (1) = 2 bytes
    };
  }
  
  protected isTransferSPtoX(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TSX';
  }
  
  protected isTransferXtoSP(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TXS';
  }
}

/**
 * Pattern: JSR addr followed by RTS → JMP addr (tail call optimization)
 * 
 * Before:
 *   JSR $1234
 *   RTS
 * 
 * After:
 *   JMP $1234
 * 
 * Saves: 9 cycles, 1 byte
 * 
 * This is a classic tail call optimization - when a subroutine call
 * is immediately followed by RTS, we can jump directly and let the
 * called routine return to our caller.
 * 
 * Preconditions:
 * - RTS must be the very next instruction after JSR
 * - Called subroutine will return to our original caller
 */
export class TailCallOptimizationPattern extends BasePattern {
  readonly id = 'jsr-rts-to-jmp';
  readonly description = 'Convert JSR/RTS to JMP (tail call optimization)';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [jsr, rts] = instructions;
    
    // Check: JSR addr
    if (!this.isJumpSubroutine(jsr)) {
      return null;
    }
    
    // Check: RTS
    if (!this.isReturnSubroutine(rts)) {
      return null;
    }
    
    const targetAddr = jsr.metadata?.get('address');
    const targetLabel = jsr.metadata?.get('label');
    
    return {
      matched: [jsr, rts],
      captures: this.capture([
        ['address', targetAddr],
        ['label', targetLabel],
      ]),
      confidence: 0.95, // Very reliable optimization
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const address = match.captures.get('address') as string | undefined;
    const label = match.captures.get('label') as string | undefined;
    
    // Create JMP instruction
    const jmp = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'JMP',
      addressingMode: 'absolute',
      address,
      label,
    });
    
    return {
      instructions: [jmp],
      cyclesSaved: 9,  // JSR (6) + RTS (6) = 12 → JMP (3) = saves 9
      bytesSaved: 1,   // JSR (3) + RTS (1) = 4 → JMP (3) = saves 1
    };
  }
  
  protected isJumpSubroutine(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'JSR';
  }
  
  protected isReturnSubroutine(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'RTS';
  }
}

/**
 * Pattern: PHA + instruction that doesn't use A + PLA → remove PHA/PLA
 * 
 * Before:
 *   PHA
 *   LDX #$42    ; Or any instruction that doesn't read/write A
 *   PLA
 * 
 * After:
 *   LDX #$42
 * 
 * Saves: 7 cycles, 2 bytes
 * 
 * Preconditions:
 * - Middle instruction must not read or write A
 * - This is common when compiler preserves A around index operations
 */
export class RedundantPreserveAcrossNonAPattern extends BasePattern {
  readonly id = 'pha-non-a-pla-remove';
  readonly description = 'Remove PHA/PLA around instructions not using A';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [pha, middle, pla] = instructions;
    
    // Check: PHA
    if (!this.isPushAccumulator(pha)) {
      return null;
    }
    
    // Check: PLA
    if (!this.isPullAccumulator(pla)) {
      return null;
    }
    
    // Check: Middle instruction doesn't use A
    if (!this.doesNotUseAccumulator(middle)) {
      return null;
    }
    
    return {
      matched: [pha, middle, pla],
      captures: this.capture([['middle', middle]]),
      confidence: 0.85, // Requires A-usage analysis
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const middle = match.captures.get('middle') as ILInstruction;
    
    // Just keep the middle instruction, remove PHA/PLA
    return {
      instructions: [middle],
      cyclesSaved: 7,  // PHA (3) + PLA (4) = 7 cycles
      bytesSaved: 2,   // PHA (1) + PLA (1) = 2 bytes
    };
  }
  
  protected isPushAccumulator(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PHA';
  }
  
  protected isPullAccumulator(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PLA';
  }
  
  /**
   * Check if instruction doesn't use the accumulator
   * These are instructions safe to have between PHA/PLA
   */
  protected doesNotUseAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) {
      return false;
    }
    
    const mnemonic = inst.metadata?.get('mnemonic');
    
    // Instructions that don't use A
    const nonAInstructions = [
      'LDX', 'LDY',           // Load X/Y
      'STX', 'STY',           // Store X/Y
      'INX', 'INY',           // Increment X/Y
      'DEX', 'DEY',           // Decrement X/Y
      'CPX', 'CPY',           // Compare X/Y
      'TAX', 'TAY',           // Transfer (reads A but doesn't modify)
      'NOP',                   // No operation
    ];
    
    // TAX and TAY read A, so we should exclude them if we want strict "doesn't use A"
    // For this pattern, we allow TAX/TAY since A is preserved via stack
    const strictNonAInstructions = [
      'LDX', 'LDY', 'STX', 'STY',
      'INX', 'INY', 'DEX', 'DEY',
      'CPX', 'CPY', 'NOP',
    ];
    
    return strictNonAInstructions.includes(mnemonic);
  }
}

/**
 * Pattern: Double PHA + Double PLA → Remove all (when nothing between)
 * 
 * Before:
 *   PHA
 *   PHA
 *   PLA
 *   PLA
 * 
 * After:
 *   (nothing)
 * 
 * Saves: 14 cycles, 4 bytes
 * 
 * This pattern catches double redundant pairs that might occur
 * in complex compiler output or macro expansions.
 */
export class RedundantDoublePushPullPattern extends BasePattern {
  readonly id = 'double-pha-pla-remove';
  readonly description = 'Remove redundant double PHA/PHA/PLA/PLA sequence';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 4;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 4) return null;
    
    const [pha1, pha2, pla1, pla2] = instructions;
    
    // Check: PHA, PHA, PLA, PLA sequence
    if (!this.isPushAccumulator(pha1)) return null;
    if (!this.isPushAccumulator(pha2)) return null;
    if (!this.isPullAccumulator(pla1)) return null;
    if (!this.isPullAccumulator(pla2)) return null;
    
    return {
      matched: [pha1, pha2, pla1, pla2],
      captures: this.capture([]),
      confidence: 0.95,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 14, // 2×PHA (6) + 2×PLA (8) = 14 cycles
      bytesSaved: 4,   // 2×PHA (2) + 2×PLA (2) = 4 bytes
    };
  }
  
  protected isPushAccumulator(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PHA';
  }
  
  protected isPullAccumulator(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PLA';
  }
}

/**
 * Pattern: PLA followed by PHA → Keep A value (when A not needed on stack)
 * 
 * Before:
 *   PLA
 *   PHA
 * 
 * After:
 *   (nothing) OR
 *   LDA (sp),Y ; if A value is needed
 * 
 * Saves: 7 cycles, 2 bytes (when A not needed)
 * 
 * Note: This is different from PHA+PLA - pulling then immediately
 * pushing back is redundant if the value stays the same.
 * 
 * Preconditions:
 * - A is not modified between PLA and PHA
 * - Stack position not needed for alignment purposes
 */
export class RedundantPullPushPattern extends BasePattern {
  readonly id = 'pla-pha-remove';
  readonly description = 'Remove redundant PLA/PHA pair';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [pla, pha] = instructions;
    
    // Check: PLA
    if (!this.isPullAccumulator(pla)) {
      return null;
    }
    
    // Check: PHA
    if (!this.isPushAccumulator(pha)) {
      return null;
    }
    
    return {
      matched: [pla, pha],
      captures: this.capture([]),
      confidence: 0.8, // May be intentional for A value peek
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Note: This optimization removes both, assuming A value isn't needed
    // More sophisticated version would preserve A if it's used later
    return {
      instructions: [],
      cyclesSaved: 7,  // PLA (4) + PHA (3) = 7 cycles
      bytesSaved: 2,   // PLA (1) + PHA (1) = 2 bytes
    };
  }
  
  protected isPullAccumulator(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PLA';
  }
  
  protected isPushAccumulator(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PHA';
  }
}

/**
 * Pattern: PLP followed by PHP → Remove redundant pair
 * 
 * Before:
 *   PLP
 *   PHP
 * 
 * After:
 *   (nothing)
 * 
 * Saves: 7 cycles, 2 bytes
 * 
 * Similar to PLA+PHA but for processor status flags
 */
export class RedundantPullPushFlagsPattern extends BasePattern {
  readonly id = 'plp-php-remove';
  readonly description = 'Remove redundant PLP/PHP pair';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [plp, php] = instructions;
    
    // Check: PLP
    if (!this.isPullFlags(plp)) {
      return null;
    }
    
    // Check: PHP
    if (!this.isPushFlags(php)) {
      return null;
    }
    
    return {
      matched: [plp, php],
      captures: this.capture([]),
      confidence: 0.8,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 7,  // PLP (4) + PHP (3) = 7 cycles
      bytesSaved: 2,   // PLP (1) + PHP (1) = 2 bytes
    };
  }
  
  protected isPullFlags(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PLP';
  }
  
  protected isPushFlags(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PHP';
  }
}

/**
 * Register all stack operation combining patterns
 */
export function registerStackCombiningPatterns(registry: PatternRegistry): void {
  // Basic redundant push/pull patterns
  registry.register(new RedundantPushPullPattern());         // PHA+PLA
  registry.register(new RedundantPushPullFlagsPattern());    // PHP+PLP
  registry.register(new RedundantPullPushPattern());         // PLA+PHA
  registry.register(new RedundantPullPushFlagsPattern());    // PLP+PHP
  
  // Stack pointer patterns
  registry.register(new RedundantStackPointerPattern());     // TSX+TXS
  
  // Multi-instruction stack patterns
  registry.register(new RedundantDoublePushPullPattern());   // PHA+PHA+PLA+PLA
  registry.register(new RedundantPreserveAcrossNonAPattern()); // PHA+non-A+PLA
  
  // Tail call optimization
  registry.register(new TailCallOptimizationPattern());      // JSR+RTS
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `RedundantPushPull match` | Matches PHA + PLA sequence |
| `RedundantPushPull no match` | No match with instruction between |
| `RedundantPushPull remove` | Both instructions removed |
| `RedundantPushPull savings` | Reports 7 cycles, 2 bytes saved |
| `RedundantPushPullFlags match` | Matches PHP + PLP sequence |
| `RedundantPushPullFlags remove` | Both instructions removed |
| `RedundantStackPointer match` | Matches TSX + TXS sequence |
| `RedundantStackPointer remove` | Both instructions removed |
| `TailCall match` | Matches JSR + RTS sequence |
| `TailCall replace` | Creates JMP instruction |
| `TailCall preserves address` | JMP target matches JSR target |
| `TailCall preserves label` | JMP label matches JSR label |
| `TailCall savings` | Reports 9 cycles, 1 byte saved |
| `PreserveAcrossNonA match` | Matches PHA + non-A-instr + PLA |
| `PreserveAcrossNonA no match` | No match if middle uses A |
| `PreserveAcrossNonA remove` | Removes PHA/PLA, keeps middle |
| `DoublePushPull match` | Matches PHA+PHA+PLA+PLA |
| `DoublePushPull remove` | All four instructions removed |
| `register all` | All 8 patterns registered correctly |
| `integration` | Patterns work with matcher and optimizer |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerStackCombiningPatterns } from './patterns/combining-stack.js';

registerStackCombiningPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 |
|---------|----|----|-----|
| RedundantPushPullPattern         | ✅ | ✅ | ✅ |
| RedundantPushPullFlagsPattern    | ✅ | ✅ | ✅ |
| RedundantStackPointerPattern     | ✅ | ✅ | ✅ |
| RedundantDoublePushPullPattern   | ✅ | ✅ | ✅ |
| TailCallOptimizationPattern      | ❌ | ✅ | ✅ |
| RedundantPreserveAcrossNonAPattern | ❌ | ✅ | ✅ |
| RedundantPullPushPattern         | ❌ | ✅ | ✅ |
| RedundantPullPushFlagsPattern    | ❌ | ✅ | ✅ |

### Pattern Ordering Considerations

Stack combining patterns should run:
1. **After** load/transfer combining (may create redundant stack ops)
2. **Before** general redundancy elimination (catches missed patterns)

### Code Generation Considerations

These patterns are particularly effective when the compiler:
- Generates conservative register saves
- Uses simple calling conventions with stack frames
- Produces code from templates/macros that include unnecessary saves

---

## Savings Summary

| Pattern | Cycles Saved | Bytes Saved |
|---------|-------------|-------------|
| PHA+PLA remove | 7 | 2 |
| PHP+PLP remove | 7 | 2 |
| PLA+PHA remove | 7 | 2 |
| PLP+PHP remove | 7 | 2 |
| TSX+TXS remove | 4 | 2 |
| JSR+RTS → JMP | 9 | 1 |
| PHA+PHA+PLA+PLA remove | 14 | 4 |
| PHA+non-A+PLA remove | 7 | 2 |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `combining-stack.ts` | [ ] |
| Implement RedundantPushPullPattern | [ ] |
| Implement RedundantPushPullFlagsPattern | [ ] |
| Implement RedundantStackPointerPattern | [ ] |
| Implement TailCallOptimizationPattern | [ ] |
| Implement RedundantPreserveAcrossNonAPattern | [ ] |
| Implement RedundantDoublePushPullPattern | [ ] |
| Implement RedundantPullPushPattern | [ ] |
| Implement RedundantPullPushFlagsPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 3.8a → `08-08a-combining-load-transfer.md`  
**Next Task**: 3.8c → `08-08c-combining-register.md`
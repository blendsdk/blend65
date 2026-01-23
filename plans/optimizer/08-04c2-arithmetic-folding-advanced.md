# Task 8.4c2: Constant Folding Patterns - Advanced

> **Task**: 8.4c2 of 17 (Peephole Phase)  
> **Time**: ~1 hour  
> **Tests**: ~18 tests  
> **Prerequisites**: Tasks 8.1-8.2, 8.4c1

---

## Overview

Implement advanced constant folding peephole patterns:
- AND #$00 → LDA #$00 (result always zero)
- ORA #$FF → LDA #$FF (result always $FF)
- EOR #$FF (bit complement, keep for semantic clarity)
- Double EOR elimination (EOR #k, EOR #k → remove both)
- Chained shift folding (ASL, ASL → shift by 2)
- Compare with zero after load optimization

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                           # Pattern exports
├── constant-folding.ts                # Core patterns (8.4c1)
└── constant-folding-advanced.ts       # THIS TASK
```

---

## 6502 Advanced Constant Operations

### Absorbing Elements
- **AND #$00**: Result is always 0 regardless of A (absorbing element)
- **ORA #$FF**: Result is always $FF regardless of A (absorbing element)

### Self-Inverse Operations
- **EOR #k, EOR #k**: Two XORs with same value cancel out
- **EOR #$FF, EOR #$FF**: Double complement is identity

### Shift Combining
- **ASL, ASL**: Shift left by 2 (multiply by 4)
- **LSR, LSR**: Shift right by 2 (divide by 4)

### Comparison Optimization
- **LDA #$00** followed by **CMP #$00**: CMP is redundant

---

## Implementation

### File: `constant-folding-advanced.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Pattern: AND #$00 (absorbing element)
 * 
 * Before:
 *   AND #$00
 * 
 * After:
 *   LDA #$00
 * 
 * Saves: 0 cycles, 0 bytes (same size, but semantic clarity)
 * 
 * Note: Result is always 0 regardless of accumulator value.
 * We replace with LDA for clarity since the original A value is discarded.
 * Some downstream optimizations may benefit from knowing A = 0.
 */
export class AndZeroPattern extends BasePattern {
  readonly id = 'and-zero';
  readonly description = 'Replace AND #$00 with LDA #$00 (result always zero)';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const [and] = instructions;
    
    // Check: AND #$00
    if (!this.isAndImmediate(and, 0x00)) return null;
    
    return {
      matched: [and],
      captures: new Map(),
      confidence: 1.0,
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    const newLda = this.createInstruction(ILOpcode.LoadImm, {
      mnemonic: 'LDA',
      addressingMode: 'immediate',
      value: 0x00,
    });
    
    return {
      instructions: [newLda],
      cyclesSaved: 0,
      bytesSaved: 0,
    };
  }
  
  protected isAndImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.BinaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'AND') return false;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return false;
    
    const operand = inst.operands[1];
    return this.isConstant(operand, value);
  }
}

/**
 * Pattern: ORA #$FF (absorbing element)
 * 
 * Before:
 *   ORA #$FF
 * 
 * After:
 *   LDA #$FF
 * 
 * Saves: 0 cycles, 0 bytes (same size, but semantic clarity)
 * 
 * Note: Result is always $FF regardless of accumulator value.
 */
export class OrFullPattern extends BasePattern {
  readonly id = 'or-full';
  readonly description = 'Replace ORA #$FF with LDA #$FF (result always $FF)';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const [ora] = instructions;
    
    // Check: ORA #$FF
    if (!this.isOrImmediate(ora, 0xFF)) return null;
    
    return {
      matched: [ora],
      captures: new Map(),
      confidence: 1.0,
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    const newLda = this.createInstruction(ILOpcode.LoadImm, {
      mnemonic: 'LDA',
      addressingMode: 'immediate',
      value: 0xFF,
    });
    
    return {
      instructions: [newLda],
      cyclesSaved: 0,
      bytesSaved: 0,
    };
  }
  
  protected isOrImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.BinaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'ORA') return false;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return false;
    
    const operand = inst.operands[1];
    return this.isConstant(operand, value);
  }
}

/**
 * Pattern: Double EOR with same value (self-inverse)
 * 
 * Before:
 *   EOR #$XX
 *   EOR #$XX
 * 
 * After:
 *   (removed)
 * 
 * Saves: 4 cycles, 4 bytes
 * 
 * Note: XOR is self-inverse: A ^ k ^ k = A
 */
export class DoubleEorPattern extends BasePattern {
  readonly id = 'double-eor';
  readonly description = 'Remove double EOR with same value (A ^ k ^ k = A)';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [eor1, eor2] = instructions;
    
    // Check: Both are EOR immediate
    const v1 = this.getEorImmediateValue(eor1);
    const v2 = this.getEorImmediateValue(eor2);
    
    if (v1 === null || v2 === null) return null;
    
    // Check: Same value
    if (v1 !== v2) return null;
    
    return {
      matched: [eor1, eor2],
      captures: this.capture([['value', v1]]),
      confidence: 1.0,
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 4,
      bytesSaved: 4,
    };
  }
  
  protected getEorImmediateValue(inst: ILInstruction): number | null {
    if (inst.opcode !== ILOpcode.BinaryOp) return null;
    if (inst.metadata?.get('mnemonic') !== 'EOR') return null;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return null;
    
    const operand = inst.operands[1];
    if (typeof operand === 'number') return operand;
    if (this.isConstantValue(operand)) {
      return this.getConstantNumericValue(operand);
    }
    return null;
  }
}

/**
 * Pattern: Consecutive ASL instructions
 * 
 * Before:
 *   ASL A
 *   ASL A
 * 
 * After:
 *   ASL A
 *   ASL A
 *   (kept - but annotated for potential macro expansion)
 * 
 * Note: Unlike x86, 6502 has no "shift by N" instruction.
 * This pattern mainly exists for analysis/annotation.
 * At O3, could generate self-modifying code with computed shift.
 * 
 * Savings depend on context - this is an analysis pattern.
 */
export class ConsecutiveAslPattern extends BasePattern {
  readonly id = 'consecutive-asl';
  readonly description = 'Detect consecutive ASL for potential optimization';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O3]; // Analysis only at O3
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [asl1, asl2] = instructions;
    
    // Check: Both are ASL A (accumulator mode)
    if (!this.isAslAccumulator(asl1)) return null;
    if (!this.isAslAccumulator(asl2)) return null;
    
    return {
      matched: [asl1, asl2],
      captures: this.capture([['shiftCount', 2]]),
      confidence: 0.5, // Low confidence - analysis only
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // For now, keep instructions but add annotation
    // Future: Could use lookup table for multiply by 4
    const asl1 = match.matched[0];
    const asl2 = match.matched[1];
    
    // Add metadata annotation for shift count
    const annotatedAsl1 = this.cloneWithMetadata(asl1, {
      shiftSequence: true,
      totalShift: 2,
    });
    const annotatedAsl2 = this.cloneWithMetadata(asl2, {
      shiftSequence: true,
      totalShift: 2,
    });
    
    return {
      instructions: [annotatedAsl1, annotatedAsl2],
      cyclesSaved: 0,
      bytesSaved: 0,
    };
  }
  
  protected isAslAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.UnaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'ASL') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'accumulator' || mode === 'implied';
  }
}

/**
 * Pattern: Consecutive LSR instructions
 * 
 * Before:
 *   LSR A
 *   LSR A
 * 
 * After:
 *   (kept with annotation)
 * 
 * Same rationale as ConsecutiveAslPattern.
 */
export class ConsecutiveLsrPattern extends BasePattern {
  readonly id = 'consecutive-lsr';
  readonly description = 'Detect consecutive LSR for potential optimization';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [lsr1, lsr2] = instructions;
    
    if (!this.isLsrAccumulator(lsr1)) return null;
    if (!this.isLsrAccumulator(lsr2)) return null;
    
    return {
      matched: [lsr1, lsr2],
      captures: this.capture([['shiftCount', 2]]),
      confidence: 0.5,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const lsr1 = match.matched[0];
    const lsr2 = match.matched[1];
    
    const annotatedLsr1 = this.cloneWithMetadata(lsr1, {
      shiftSequence: true,
      totalShift: 2,
    });
    const annotatedLsr2 = this.cloneWithMetadata(lsr2, {
      shiftSequence: true,
      totalShift: 2,
    });
    
    return {
      instructions: [annotatedLsr1, annotatedLsr2],
      cyclesSaved: 0,
      bytesSaved: 0,
    };
  }
  
  protected isLsrAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.UnaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'LSR') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'accumulator' || mode === 'implied';
  }
}

/**
 * Pattern: CMP #$00 after LDA #$00
 * 
 * Before:
 *   LDA #$00
 *   CMP #$00
 * 
 * After:
 *   LDA #$00
 * 
 * Saves: 2 cycles, 2 bytes
 * 
 * Note: LDA already sets Z flag if value is 0, so CMP is redundant.
 */
export class RedundantCompareZeroPattern extends BasePattern {
  readonly id = 'redundant-cmp-zero';
  readonly description = 'Remove CMP #$00 after LDA #$00 (Z flag already set)';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [lda, cmp] = instructions;
    
    // Check: LDA #$00
    const ldaValue = this.getLoadImmediateValue(lda);
    if (ldaValue !== 0x00) return null;
    
    // Check: CMP #$00
    if (!this.isCompareImmediate(cmp, 0x00)) return null;
    
    return {
      matched: [lda, cmp],
      captures: new Map(),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const lda = match.matched[0];
    
    return {
      instructions: [lda],
      cyclesSaved: 2,
      bytesSaved: 2,
    };
  }
  
  protected getLoadImmediateValue(inst: ILInstruction): number | null {
    if (inst.opcode !== ILOpcode.LoadImm) return null;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return null;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return null;
    
    const value = inst.operands[0];
    if (typeof value === 'number') return value;
    if (this.isConstantValue(value)) {
      return this.getConstantNumericValue(value);
    }
    return null;
  }
  
  protected isCompareImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.BinaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'CMP') return false;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return false;
    
    const operand = inst.operands[1];
    return this.isConstant(operand, value);
  }
}

/**
 * Pattern: LDA #k followed by CMP #k (always equal)
 * 
 * Before:
 *   LDA #$XX
 *   CMP #$XX
 * 
 * After:
 *   LDA #$XX
 * 
 * Saves: 2 cycles, 2 bytes
 * 
 * Note: Comparing a value with itself always sets Z=1, C=1.
 * The CMP is redundant if we just loaded that same value.
 */
export class RedundantCompareSamePattern extends BasePattern {
  readonly id = 'redundant-cmp-same';
  readonly description = 'Remove CMP #k after LDA #k (comparing same value)';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [lda, cmp] = instructions;
    
    // Check: LDA #immediate
    const ldaValue = this.getLoadImmediateValue(lda);
    if (ldaValue === null) return null;
    
    // Check: CMP #immediate with same value
    const cmpValue = this.getCompareImmediateValue(cmp);
    if (cmpValue === null) return null;
    
    if (ldaValue !== cmpValue) return null;
    
    return {
      matched: [lda, cmp],
      captures: this.capture([['value', ldaValue]]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const lda = match.matched[0];
    
    return {
      instructions: [lda],
      cyclesSaved: 2,
      bytesSaved: 2,
    };
  }
  
  protected getLoadImmediateValue(inst: ILInstruction): number | null {
    if (inst.opcode !== ILOpcode.LoadImm) return null;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return null;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return null;
    
    const value = inst.operands[0];
    if (typeof value === 'number') return value;
    if (this.isConstantValue(value)) {
      return this.getConstantNumericValue(value);
    }
    return null;
  }
  
  protected getCompareImmediateValue(inst: ILInstruction): number | null {
    if (inst.opcode !== ILOpcode.BinaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'CMP') return false;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return false;
    
    const operand = inst.operands[1];
    if (typeof operand === 'number') return operand;
    if (this.isConstantValue(operand)) {
      return this.getConstantNumericValue(operand);
    }
    return null;
  }
}

/**
 * Pattern: EOR #$FF followed by AND #k → AND #(~k)
 * 
 * Before:
 *   EOR #$FF    ; complement A
 *   AND #$0F    ; mask lower nibble
 * 
 * After:
 *   AND #$F0    ; mask upper nibble (complement of $0F)
 *   EOR #$FF    ; complement to get original intent
 * 
 * Note: This is a reordering optimization. Actually:
 * ~A & k = ~(A | ~k) by De Morgan
 * 
 * For simplicity, we skip this complex case. Just document it.
 * This pattern is marked as analysis-only.
 */
export class ComplementAndPattern extends BasePattern {
  readonly id = 'complement-and-analysis';
  readonly description = 'Analyze EOR #$FF + AND pattern for potential optimization';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [eor, and] = instructions;
    
    // Check: EOR #$FF (complement)
    if (!this.isEorImmediate(eor, 0xFF)) return null;
    
    // Check: AND #k
    const maskValue = this.getAndImmediateValue(and);
    if (maskValue === null) return null;
    
    return {
      matched: [eor, and],
      captures: this.capture([['mask', maskValue]]),
      confidence: 0.3, // Very low - analysis only
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Keep original - this is analysis only
    return {
      instructions: match.matched.slice(),
      cyclesSaved: 0,
      bytesSaved: 0,
    };
  }
  
  protected isEorImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.BinaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'EOR') return false;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return false;
    
    const operand = inst.operands[1];
    return this.isConstant(operand, value);
  }
  
  protected getAndImmediateValue(inst: ILInstruction): number | null {
    if (inst.opcode !== ILOpcode.BinaryOp) return null;
    if (inst.metadata?.get('mnemonic') !== 'AND') return null;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return null;
    
    const operand = inst.operands[1];
    if (typeof operand === 'number') return operand;
    if (this.isConstantValue(operand)) {
      return this.getConstantNumericValue(operand);
    }
    return null;
  }
}

/**
 * Register advanced constant folding patterns
 */
export function registerConstantFoldingAdvancedPatterns(registry: PatternRegistry): void {
  registry.register(new AndZeroPattern());
  registry.register(new OrFullPattern());
  registry.register(new DoubleEorPattern());
  registry.register(new ConsecutiveAslPattern());
  registry.register(new ConsecutiveLsrPattern());
  registry.register(new RedundantCompareZeroPattern());
  registry.register(new RedundantCompareSamePattern());
  registry.register(new ComplementAndPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `AndZero match` | Matches AND #$00 |
| `AndZero replace` | Replaces with LDA #$00 |
| `AndZero no match $01` | No match for AND #$01 |
| `OrFull match` | Matches ORA #$FF |
| `OrFull replace` | Replaces with LDA #$FF |
| `OrFull no match $FE` | No match for ORA #$FE |
| `DoubleEor match same` | Matches EOR #$AB, EOR #$AB |
| `DoubleEor no match diff` | No match for EOR #$AB, EOR #$CD |
| `DoubleEor replace` | Returns empty instruction list |
| `ConsecutiveAsl match` | Matches ASL A, ASL A |
| `ConsecutiveAsl annotation` | Adds shiftCount=2 metadata |
| `ConsecutiveLsr match` | Matches LSR A, LSR A |
| `ConsecutiveLsr annotation` | Adds shiftCount=2 metadata |
| `RedundantCmpZero match` | Matches LDA #$00, CMP #$00 |
| `RedundantCmpZero replace` | Keeps only LDA #$00 |
| `RedundantCmpSame match` | Matches LDA #$42, CMP #$42 |
| `RedundantCmpSame no match` | No match for LDA #$42, CMP #$43 |
| `register all` | All 8 patterns registered |

---

## Optimization Levels

| Pattern | O1 | O2 | O3 |
|---------|----|----|-----|
| AndZeroPattern | ✅ | ✅ | ✅ |
| OrFullPattern | ✅ | ✅ | ✅ |
| DoubleEorPattern | ❌ | ✅ | ✅ |
| ConsecutiveAslPattern | ❌ | ❌ | ✅ |
| ConsecutiveLsrPattern | ❌ | ❌ | ✅ |
| RedundantCompareZeroPattern | ✅ | ✅ | ✅ |
| RedundantCompareSamePattern | ✅ | ✅ | ✅ |
| ComplementAndPattern | ❌ | ❌ | ✅ |

---

## Relationship to Core Patterns (8.4c1)

This document extends the core constant folding patterns from 8.4c1:

| Core (8.4c1) | Advanced (8.4c2) |
|--------------|------------------|
| ConstantAddFoldPattern | - |
| ConstantSubtractFoldPattern | - |
| AndFullMaskPattern (AND #$FF) | AndZeroPattern (AND #$00) |
| OrZeroPattern (ORA #$00) | OrFullPattern (ORA #$FF) |
| EorZeroPattern (EOR #$00) | DoubleEorPattern (EOR #k, EOR #k) |
| - | ConsecutiveAslPattern |
| - | ConsecutiveLsrPattern |
| - | RedundantCompareZeroPattern |
| - | RedundantCompareSamePattern |
| - | ComplementAndPattern |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `constant-folding-advanced.ts` | [ ] |
| Implement AndZeroPattern | [ ] |
| Implement OrFullPattern | [ ] |
| Implement DoubleEorPattern | [ ] |
| Implement ConsecutiveAslPattern | [ ] |
| Implement ConsecutiveLsrPattern | [ ] |
| Implement RedundantCompareZeroPattern | [ ] |
| Implement RedundantCompareSamePattern | [ ] |
| Implement ComplementAndPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.4c1 → `08-04c1-arithmetic-folding-core.md`  
**Next Task**: 8.5 → `08-05-branch-patterns.md`
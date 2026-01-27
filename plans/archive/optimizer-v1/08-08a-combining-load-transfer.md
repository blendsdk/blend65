# Task 8.8a: Load/Transfer Combining Patterns

> **Task**: 8.8a of 27 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~18 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement peephole patterns that combine load and transfer instructions into more efficient single-instruction equivalents. These patterns eliminate redundant register-to-register transfers.

**Patterns in this document:**
- LDA + TAX → LDX (immediate and memory)
- LDA + TAY → LDY (immediate and memory)
- LDX + TXA → LDA (when X not needed)
- LDY + TYA → LDA (when Y not needed)

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                        # Pattern exports
└── combining-load-transfer.ts      # THIS TASK
```

---

## 6502 Instruction Background

### Load Instructions
| Instruction | Bytes | Cycles | Flags |
|-------------|-------|--------|-------|
| LDA #imm    | 2     | 2      | N, Z  |
| LDA zp      | 2     | 3      | N, Z  |
| LDA abs     | 3     | 4      | N, Z  |
| LDX #imm    | 2     | 2      | N, Z  |
| LDX zp      | 2     | 3      | N, Z  |
| LDX abs     | 3     | 4      | N, Z  |
| LDY #imm    | 2     | 2      | N, Z  |
| LDY zp      | 2     | 3      | N, Z  |
| LDY abs     | 3     | 4      | N, Z  |

### Transfer Instructions
| Instruction | Bytes | Cycles | Flags |
|-------------|-------|--------|-------|
| TAX         | 1     | 2      | N, Z  |
| TAY         | 1     | 2      | N, Z  |
| TXA         | 1     | 2      | N, Z  |
| TYA         | 1     | 2      | N, Z  |

---

## Implementation

### File: `combining-load-transfer.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Pattern: LDA #imm followed by TAX → LDX #imm
 * 
 * Before:
 *   LDA #$42
 *   TAX
 * 
 * After:
 *   LDX #$42
 * 
 * Saves: 2 cycles, 1 byte
 * 
 * Preconditions:
 * - A must not be live after TAX (A value is discarded)
 * 
 * Note: Both LDA #imm + TAX and LDX #imm set N, Z flags identically
 */
export class LoadImmTransferToXPattern extends BasePattern {
  readonly id = 'lda-imm-tax-to-ldx';
  readonly description = 'Combine LDA #imm + TAX into LDX #imm';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [lda, tax] = instructions;
    
    // Check: LDA #imm
    if (!this.isLoadAccumulatorImmediate(lda)) {
      return null;
    }
    
    // Check: TAX
    if (!this.isTransferAtoX(tax)) {
      return null;
    }
    
    // Get immediate value
    const immValue = this.getImmediateValue(lda);
    if (immValue === null) return null;
    
    return {
      matched: [lda, tax],
      captures: this.capture([['value', immValue]]),
      confidence: 0.9, // Requires A not live after
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const value = match.captures.get('value') as number;
    
    // Create LDX #imm
    const ldx = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDX',
      addressingMode: 'immediate',
      operand: value,
    });
    
    return {
      instructions: [ldx],
      cyclesSaved: 2,  // LDA #imm (2) + TAX (2) = 4 → LDX #imm (2) = saves 2
      bytesSaved: 1,   // LDA #imm (2) + TAX (1) = 3 → LDX #imm (2) = saves 1
    };
  }
  
  protected isLoadAccumulatorImmediate(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'LDA' &&
           inst.metadata?.get('addressingMode') === 'immediate';
  }
  
  protected isTransferAtoX(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TAX';
  }
}

/**
 * Pattern: LDA #imm followed by TAY → LDY #imm
 * 
 * Before:
 *   LDA #$42
 *   TAY
 * 
 * After:
 *   LDY #$42
 * 
 * Saves: 2 cycles, 1 byte
 */
export class LoadImmTransferToYPattern extends BasePattern {
  readonly id = 'lda-imm-tay-to-ldy';
  readonly description = 'Combine LDA #imm + TAY into LDY #imm';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [lda, tay] = instructions;
    
    // Check: LDA #imm
    if (!this.isLoadAccumulatorImmediate(lda)) {
      return null;
    }
    
    // Check: TAY
    if (!this.isTransferAtoY(tay)) {
      return null;
    }
    
    const immValue = this.getImmediateValue(lda);
    if (immValue === null) return null;
    
    return {
      matched: [lda, tay],
      captures: this.capture([['value', immValue]]),
      confidence: 0.9,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const value = match.captures.get('value') as number;
    
    const ldy = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDY',
      addressingMode: 'immediate',
      operand: value,
    });
    
    return {
      instructions: [ldy],
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
  
  protected isLoadAccumulatorImmediate(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'LDA' &&
           inst.metadata?.get('addressingMode') === 'immediate';
  }
  
  protected isTransferAtoY(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TAY';
  }
}

/**
 * Pattern: LDA addr followed by TAX → LDX addr
 * 
 * Before:
 *   LDA $1234    ; or LDA $12 (zero page)
 *   TAX
 * 
 * After:
 *   LDX $1234    ; or LDX $12 (zero page)
 * 
 * Saves:
 * - Zero page: 2 cycles, 1 byte (3+2=5 → 3, 2+1=3 → 2)
 * - Absolute:  2 cycles, 1 byte (4+2=6 → 4, 3+1=4 → 3)
 */
export class LoadMemTransferToXPattern extends BasePattern {
  readonly id = 'lda-mem-tax-to-ldx';
  readonly description = 'Combine LDA addr + TAX into LDX addr';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [lda, tax] = instructions;
    
    // Check: LDA addr (zero page or absolute)
    if (!this.isLoadAccumulatorMemory(lda)) {
      return null;
    }
    
    // Check: TAX
    if (!this.isTransferAtoX(tax)) {
      return null;
    }
    
    const address = this.getAddress(lda);
    const addrMode = lda.metadata?.get('addressingMode');
    
    return {
      matched: [lda, tax],
      captures: this.capture([
        ['address', address],
        ['addressingMode', addrMode],
      ]),
      confidence: 0.9,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const address = match.captures.get('address') as string;
    const addrMode = match.captures.get('addressingMode') as string;
    
    const ldx = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDX',
      addressingMode: addrMode,
      address,
    });
    
    return {
      instructions: [ldx],
      cyclesSaved: 2,  // TAX cycles eliminated
      bytesSaved: 1,   // TAX byte eliminated
    };
  }
  
  protected isLoadAccumulatorMemory(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isTransferAtoX(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TAX';
  }
}

/**
 * Pattern: LDA addr followed by TAY → LDY addr
 * 
 * Before:
 *   LDA $1234
 *   TAY
 * 
 * After:
 *   LDY $1234
 * 
 * Saves: 2 cycles, 1 byte
 */
export class LoadMemTransferToYPattern extends BasePattern {
  readonly id = 'lda-mem-tay-to-ldy';
  readonly description = 'Combine LDA addr + TAY into LDY addr';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [lda, tay] = instructions;
    
    // Check: LDA addr (zero page or absolute)
    if (!this.isLoadAccumulatorMemory(lda)) {
      return null;
    }
    
    // Check: TAY
    if (!this.isTransferAtoY(tay)) {
      return null;
    }
    
    const address = this.getAddress(lda);
    const addrMode = lda.metadata?.get('addressingMode');
    
    return {
      matched: [lda, tay],
      captures: this.capture([
        ['address', address],
        ['addressingMode', addrMode],
      ]),
      confidence: 0.9,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const address = match.captures.get('address') as string;
    const addrMode = match.captures.get('addressingMode') as string;
    
    const ldy = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDY',
      addressingMode: addrMode,
      address,
    });
    
    return {
      instructions: [ldy],
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
  
  protected isLoadAccumulatorMemory(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isTransferAtoY(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TAY';
  }
}

/**
 * Pattern: LDX #imm followed by TXA → LDA #imm (when X not needed)
 * 
 * Before:
 *   LDX #$42
 *   TXA
 * 
 * After:
 *   LDA #$42
 * 
 * Saves: 2 cycles, 1 byte
 * 
 * Preconditions:
 * - X must not be live after TXA (X value is discarded)
 */
export class LoadXTransferToAPattern extends BasePattern {
  readonly id = 'ldx-imm-txa-to-lda';
  readonly description = 'Combine LDX #imm + TXA into LDA #imm (X unused)';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [ldx, txa] = instructions;
    
    // Check: LDX #imm
    if (!this.isLoadXImmediate(ldx)) {
      return null;
    }
    
    // Check: TXA
    if (!this.isTransferXtoA(txa)) {
      return null;
    }
    
    const immValue = this.getImmediateValue(ldx);
    if (immValue === null) return null;
    
    return {
      matched: [ldx, txa],
      captures: this.capture([['value', immValue]]),
      confidence: 0.8, // Lower - requires X not live
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const value = match.captures.get('value') as number;
    
    const lda = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDA',
      addressingMode: 'immediate',
      operand: value,
    });
    
    return {
      instructions: [lda],
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
  
  protected isLoadXImmediate(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'LDX' &&
           inst.metadata?.get('addressingMode') === 'immediate';
  }
  
  protected isTransferXtoA(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TXA';
  }
}

/**
 * Pattern: LDY #imm followed by TYA → LDA #imm (when Y not needed)
 * 
 * Before:
 *   LDY #$42
 *   TYA
 * 
 * After:
 *   LDA #$42
 * 
 * Saves: 2 cycles, 1 byte
 */
export class LoadYTransferToAPattern extends BasePattern {
  readonly id = 'ldy-imm-tya-to-lda';
  readonly description = 'Combine LDY #imm + TYA into LDA #imm (Y unused)';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [ldy, tya] = instructions;
    
    // Check: LDY #imm
    if (!this.isLoadYImmediate(ldy)) {
      return null;
    }
    
    // Check: TYA
    if (!this.isTransferYtoA(tya)) {
      return null;
    }
    
    const immValue = this.getImmediateValue(ldy);
    if (immValue === null) return null;
    
    return {
      matched: [ldy, tya],
      captures: this.capture([['value', immValue]]),
      confidence: 0.8,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const value = match.captures.get('value') as number;
    
    const lda = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDA',
      addressingMode: 'immediate',
      operand: value,
    });
    
    return {
      instructions: [lda],
      cyclesSaved: 2,
      bytesSaved: 1,
    };
  }
  
  protected isLoadYImmediate(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'LDY' &&
           inst.metadata?.get('addressingMode') === 'immediate';
  }
  
  protected isTransferYtoA(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TYA';
  }
}

/**
 * Register all load/transfer combining patterns
 */
export function registerLoadTransferCombiningPatterns(registry: PatternRegistry): void {
  // LDA + transfer patterns (A → X/Y)
  registry.register(new LoadImmTransferToXPattern());
  registry.register(new LoadImmTransferToYPattern());
  registry.register(new LoadMemTransferToXPattern());
  registry.register(new LoadMemTransferToYPattern());
  
  // LDX/LDY + transfer patterns (X/Y → A)
  registry.register(new LoadXTransferToAPattern());
  registry.register(new LoadYTransferToAPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `LoadImmTransferToX match` | Matches LDA #imm + TAX sequence |
| `LoadImmTransferToX no match` | No match for LDA #imm without TAX |
| `LoadImmTransferToX replace` | Creates correct LDX #imm |
| `LoadImmTransferToX savings` | Reports 2 cycles, 1 byte saved |
| `LoadImmTransferToY match` | Matches LDA #imm + TAY sequence |
| `LoadImmTransferToY replace` | Creates correct LDY #imm |
| `LoadMemTransferToX zp` | Matches LDA zp + TAX → LDX zp |
| `LoadMemTransferToX abs` | Matches LDA abs + TAX → LDX abs |
| `LoadMemTransferToX replace` | Creates correct LDX addr |
| `LoadMemTransferToY match` | Matches LDA addr + TAY sequence |
| `LoadMemTransferToY replace` | Creates correct LDY addr |
| `LoadXTransferToA match` | Matches LDX #imm + TXA sequence |
| `LoadXTransferToA replace` | Creates correct LDA #imm |
| `LoadXTransferToA confidence` | Lower confidence (0.8) due to liveness |
| `LoadYTransferToA match` | Matches LDY #imm + TYA sequence |
| `LoadYTransferToA replace` | Creates correct LDA #imm |
| `register all` | All 6 patterns registered correctly |
| `integration` | Patterns work with matcher and optimizer |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerLoadTransferCombiningPatterns } from './patterns/combining-load-transfer.js';

registerLoadTransferCombiningPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 |
|---------|----|----|-----|
| LoadImmTransferToXPattern | ✅ | ✅ | ✅ |
| LoadImmTransferToYPattern | ✅ | ✅ | ✅ |
| LoadMemTransferToXPattern | ✅ | ✅ | ✅ |
| LoadMemTransferToYPattern | ✅ | ✅ | ✅ |
| LoadXTransferToAPattern   | ❌ | ✅ | ✅ |
| LoadYTransferToAPattern   | ❌ | ✅ | ✅ |

### Liveness Analysis Requirements

The `LoadXTransferToAPattern` and `LoadYTransferToAPattern` require liveness analysis to ensure the index register (X or Y) is not used after the transformation. These patterns have lower confidence (0.8) to indicate this requirement.

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `combining-load-transfer.ts` | [ ] |
| Implement LoadImmTransferToXPattern | [ ] |
| Implement LoadImmTransferToYPattern | [ ] |
| Implement LoadMemTransferToXPattern | [ ] |
| Implement LoadMemTransferToYPattern | [ ] |
| Implement LoadXTransferToAPattern | [ ] |
| Implement LoadYTransferToAPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 3.7b → `08-07b-flag-status.md`  
**Next Task**: 3.8b → `08-08b-combining-stack.md`
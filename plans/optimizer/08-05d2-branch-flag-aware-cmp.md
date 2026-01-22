# Task 8.5d.2: Comparison-Aware Branch Patterns

> **Task**: 8.5d.2 of 25 (Peephole Phase)  
> **Time**: ~45 min  
> **Tests**: ~12 tests  
> **Prerequisites**: Task 8.5d.1 (Core Flag-Aware Patterns)

---

## Overview

Implement comparison-aware branch patterns for the 6502 processor:
- CMP/CPX/CPY flag inference after immediate comparison
- Dead branch elimination based on known comparison results
- Comparison chain simplification
- Branch direction optimization for known comparisons

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                         # Pattern exports
├── branch-flag-aware-core.ts        # Task 8.5d.1 (done)
└── branch-flag-aware-cmp.ts         # THIS TASK
```

---

## 6502 Compare Instruction Semantics

### CMP/CPX/CPY Flag Effects

| Comparison Result | N | Z | C |
|-------------------|---|---|---|
| A < operand | 1 | 0 | 0 |
| A = operand | 0 | 1 | 1 |
| A > operand | 0 | 0 | 1 |

**Key insight**: N is set based on (A - operand) bit 7, not just sign.

### Branch Conditions After Compare

| Branch | Condition | After CMP |
|--------|-----------|-----------|
| BEQ | Z=1 | A == operand |
| BNE | Z=0 | A != operand |
| BCC | C=0 | A < operand (unsigned) |
| BCS | C=1 | A >= operand (unsigned) |
| BMI | N=1 | (A - operand) has bit 7 set |
| BPL | N=0 | (A - operand) has bit 7 clear |

---

## Implementation

### File: `branch-flag-aware-cmp.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';
import { FlagState, FlagStates, unknownFlags, isBranchNeverTaken, isBranchAlwaysTaken } from './branch-flag-aware-core.js';

/**
 * Compare mnemonics
 */
const COMPARE_MNEMONICS = new Set(['CMP', 'CPX', 'CPY']);

/**
 * Branch mnemonics set
 */
const BRANCH_MNEMONICS = new Set([
  'BEQ', 'BNE', 'BCC', 'BCS', 'BMI', 'BPL', 'BVC', 'BVS'
]);

/**
 * Get flag states after CMP/CPX/CPY with immediate operand
 * when we know both the register value and the operand.
 * 
 * @param regValue Known value in register (A, X, or Y)
 * @param operand The immediate operand being compared
 * @returns Flag states after comparison
 */
export function getFlagsAfterCompare(regValue: number, operand: number): FlagStates {
  const a = regValue & 0xFF;
  const m = operand & 0xFF;
  const result = (a - m) & 0xFF;
  
  return {
    N: (result & 0x80) ? FlagState.Set : FlagState.Clear,
    Z: (a === m) ? FlagState.Set : FlagState.Clear,
    C: (a >= m) ? FlagState.Set : FlagState.Clear,
    V: FlagState.Unknown, // CMP doesn't affect V
  };
}

/**
 * Get partial flag states when only operand is known (CMP #0 case)
 * 
 * After CMP #0:
 * - Z is set if A == 0 (we don't know A)
 * - N is set if (A - 0) bit 7 is set = A's bit 7
 * - C is set if A >= 0 (always true for unsigned)
 * 
 * So we KNOW: C = Set (always)
 */
export function getFlagsAfterCmpZero(): FlagStates {
  return {
    N: FlagState.Unknown, // Depends on A's value
    Z: FlagState.Unknown, // Depends on A's value
    C: FlagState.Set,     // A >= 0 is always true (unsigned)
    V: FlagState.Unknown,
  };
}

/**
 * Get flags after CMP #$FF
 * 
 * After CMP #$FF:
 * - If A == $FF: Z=1, C=1, N=0
 * - If A < $FF (i.e., A != $FF): Z=0, C=0, N varies
 * - We only know C is set when A >= $FF, which means A == $FF
 */
export function getFlagsAfterCmpFF(): FlagStates {
  // We can't determine exact flags without knowing A
  return unknownFlags();
}

/**
 * Pattern: CMP #0 followed by BCC - BCC never taken
 * 
 * After CMP #0, C is always set (since A >= 0 in unsigned).
 * 
 * Before:
 *   CMP #0
 *   BCC target    ; Never taken - C always set after CMP #0
 * 
 * After:
 *   CMP #0        ; Branch removed
 * 
 * Saves: 2-3 cycles, 2 bytes
 */
export class CmpZeroBccNeverTakenPattern extends BasePattern {
  readonly id = 'cmp-zero-bcc-never-taken';
  readonly description = 'Remove dead BCC after CMP #0 (C always set)';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [cmp, branch] = instructions;
    
    // Check: CMP #0
    if (!this.isCmpImmediate(cmp, 0)) {
      return null;
    }
    
    // Check: BCC
    if (!this.isBranch(branch, 'BCC')) {
      return null;
    }
    
    // BCC checks C=0, but after CMP #0, C=1 always
    return {
      matched: [cmp, branch],
      captures: this.capture([
        ['cmpMnemonic', cmp.metadata?.get('mnemonic')],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const mnemonic = match.captures.get('cmpMnemonic') as string;
    
    // Keep only the CMP
    const cmp = this.createInstruction(ILOpcode.Compare, {
      mnemonic: mnemonic,
      value: 0,
      addressingMode: 'immediate',
    });
    
    return {
      instructions: [cmp],
      cyclesSaved: 2,
      bytesSaved: 2,
    };
  }
  
  /** Check if instruction is CMP/CPX/CPY immediate with value */
  protected isCmpImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.Compare) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    if (!COMPARE_MNEMONICS.has(mnemonic)) return false;
    const mode = inst.metadata?.get('addressingMode');
    if (mode !== 'immediate') return false;
    const cmpValue = inst.metadata?.get('value') as number;
    return cmpValue === value;
  }
  
  /** Check if instruction is specific branch */
  protected isBranch(inst: ILInstruction, mnemonic: string): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    return inst.metadata?.get('mnemonic') === mnemonic;
  }
}

/**
 * Pattern: CMP #0 followed by BCS - BCS always taken
 * 
 * After CMP #0, C is always set. Convert BCS to JMP.
 * 
 * Before:
 *   CMP #0
 *   BCS target    ; Always taken - C always set
 * 
 * After:
 *   CMP #0
 *   JMP target    ; Unconditional
 * 
 * Saves: 0 cycles (branch prediction), but clearer semantics
 */
export class CmpZeroBcsAlwaysTakenPattern extends BasePattern {
  readonly id = 'cmp-zero-bcs-always-taken';
  readonly description = 'Convert BCS to JMP after CMP #0 (C always set)';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [cmp, branch] = instructions;
    
    // Check: CMP #0
    if (!this.isCmpImmediate(cmp, 0)) {
      return null;
    }
    
    // Check: BCS
    if (!this.isBranch(branch, 'BCS')) {
      return null;
    }
    
    return {
      matched: [cmp, branch],
      captures: this.capture([
        ['cmpMnemonic', cmp.metadata?.get('mnemonic')],
        ['target', branch.metadata?.get('target')],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const mnemonic = match.captures.get('cmpMnemonic') as string;
    const target = match.captures.get('target') as string;
    
    const cmp = this.createInstruction(ILOpcode.Compare, {
      mnemonic: mnemonic,
      value: 0,
      addressingMode: 'immediate',
    });
    
    const jmp = this.createInstruction(ILOpcode.Jump, {
      mnemonic: 'JMP',
      target,
      addressingMode: 'absolute',
    });
    
    return {
      instructions: [cmp, jmp],
      cyclesSaved: 0,
      bytesSaved: -1, // JMP is 1 byte larger
    };
  }
  
  /** Check if instruction is CMP/CPX/CPY immediate with value */
  protected isCmpImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.Compare) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    if (!COMPARE_MNEMONICS.has(mnemonic)) return false;
    const mode = inst.metadata?.get('addressingMode');
    if (mode !== 'immediate') return false;
    const cmpValue = inst.metadata?.get('value') as number;
    return cmpValue === value;
  }
  
  /** Check if instruction is specific branch */
  protected isBranch(inst: ILInstruction, mnemonic: string): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    return inst.metadata?.get('mnemonic') === mnemonic;
  }
}

/**
 * Pattern: Known load + CMP + branch elimination
 * 
 * When we know both the loaded value and the comparison operand,
 * we can determine the branch outcome.
 * 
 * Before:
 *   LDA #5
 *   CMP #10
 *   BCS target    ; Never taken: 5 >= 10 is false, C=0
 * 
 * After:
 *   LDA #5
 *   CMP #10       ; Branch removed
 * 
 * Saves: 2-3 cycles, 2 bytes
 */
export class KnownCompareBranchPattern extends BasePattern {
  readonly id = 'known-compare-branch';
  readonly description = 'Remove dead branch after known load + compare';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [load, cmp, branch] = instructions;
    
    // Check: LDA/LDX/LDY immediate
    if (!this.isLoadImmediate(load)) {
      return null;
    }
    
    // Check: CMP/CPX/CPY immediate
    if (!this.isCompareImmediate(cmp)) {
      return null;
    }
    
    // Verify register match: LDA -> CMP, LDX -> CPX, LDY -> CPY
    if (!this.registersMatch(load, cmp)) {
      return null;
    }
    
    // Check: Conditional branch
    if (!this.isConditionalBranch(branch)) {
      return null;
    }
    
    const loadValue = load.metadata?.get('value') as number;
    const cmpValue = cmp.metadata?.get('value') as number;
    const flags = getFlagsAfterCompare(loadValue, cmpValue);
    const branchMnemonic = branch.metadata?.get('mnemonic') as string;
    
    // Check: Branch never taken
    if (!isBranchNeverTaken(branchMnemonic, flags)) {
      return null;
    }
    
    return {
      matched: [load, cmp, branch],
      captures: this.capture([
        ['loadMnemonic', load.metadata?.get('mnemonic')],
        ['loadValue', loadValue],
        ['cmpMnemonic', cmp.metadata?.get('mnemonic')],
        ['cmpValue', cmpValue],
        ['branchMnemonic', branchMnemonic],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const loadMnemonic = match.captures.get('loadMnemonic') as string;
    const loadValue = match.captures.get('loadValue') as number;
    const cmpMnemonic = match.captures.get('cmpMnemonic') as string;
    const cmpValue = match.captures.get('cmpValue') as number;
    
    const load = this.createInstruction(ILOpcode.Load, {
      mnemonic: loadMnemonic,
      value: loadValue,
      addressingMode: 'immediate',
    });
    
    const cmp = this.createInstruction(ILOpcode.Compare, {
      mnemonic: cmpMnemonic,
      value: cmpValue,
      addressingMode: 'immediate',
    });
    
    return {
      instructions: [load, cmp],
      cyclesSaved: 2,
      bytesSaved: 2,
    };
  }
  
  /** Check if instruction is LDA/LDX/LDY immediate */
  protected isLoadImmediate(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Load) return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'immediate' && inst.metadata?.has('value');
  }
  
  /** Check if instruction is CMP/CPX/CPY immediate */
  protected isCompareImmediate(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Compare) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    if (!COMPARE_MNEMONICS.has(mnemonic)) return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'immediate' && inst.metadata?.has('value');
  }
  
  /** Check if load and compare target same register */
  protected registersMatch(load: ILInstruction, cmp: ILInstruction): boolean {
    const loadMnem = load.metadata?.get('mnemonic') as string;
    const cmpMnem = cmp.metadata?.get('mnemonic') as string;
    
    return (
      (loadMnem === 'LDA' && cmpMnem === 'CMP') ||
      (loadMnem === 'LDX' && cmpMnem === 'CPX') ||
      (loadMnem === 'LDY' && cmpMnem === 'CPY')
    );
  }
  
  /** Check if instruction is conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_MNEMONICS.has(mnemonic);
  }
}

/**
 * Pattern: Known load + CMP + branch always taken -> JMP
 * 
 * Before:
 *   LDA #10
 *   CMP #5
 *   BCS target    ; Always taken: 10 >= 5, C=1
 * 
 * After:
 *   LDA #10
 *   CMP #5
 *   JMP target
 * 
 * Saves: 0 cycles (clarity improvement)
 */
export class KnownCompareJmpPattern extends BasePattern {
  readonly id = 'known-compare-to-jmp';
  readonly description = 'Convert always-taken branch to JMP after known compare';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O3];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [load, cmp, branch] = instructions;
    
    // Check: LDA/LDX/LDY immediate
    if (!this.isLoadImmediate(load)) {
      return null;
    }
    
    // Check: CMP/CPX/CPY immediate
    if (!this.isCompareImmediate(cmp)) {
      return null;
    }
    
    // Verify register match
    if (!this.registersMatch(load, cmp)) {
      return null;
    }
    
    // Check: Conditional branch
    if (!this.isConditionalBranch(branch)) {
      return null;
    }
    
    const loadValue = load.metadata?.get('value') as number;
    const cmpValue = cmp.metadata?.get('value') as number;
    const flags = getFlagsAfterCompare(loadValue, cmpValue);
    const branchMnemonic = branch.metadata?.get('mnemonic') as string;
    
    // Check: Branch always taken
    if (!isBranchAlwaysTaken(branchMnemonic, flags)) {
      return null;
    }
    
    return {
      matched: [load, cmp, branch],
      captures: this.capture([
        ['loadMnemonic', load.metadata?.get('mnemonic')],
        ['loadValue', loadValue],
        ['cmpMnemonic', cmp.metadata?.get('mnemonic')],
        ['cmpValue', cmpValue],
        ['target', branch.metadata?.get('target')],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const loadMnemonic = match.captures.get('loadMnemonic') as string;
    const loadValue = match.captures.get('loadValue') as number;
    const cmpMnemonic = match.captures.get('cmpMnemonic') as string;
    const cmpValue = match.captures.get('cmpValue') as number;
    const target = match.captures.get('target') as string;
    
    const load = this.createInstruction(ILOpcode.Load, {
      mnemonic: loadMnemonic,
      value: loadValue,
      addressingMode: 'immediate',
    });
    
    const cmp = this.createInstruction(ILOpcode.Compare, {
      mnemonic: cmpMnemonic,
      value: cmpValue,
      addressingMode: 'immediate',
    });
    
    const jmp = this.createInstruction(ILOpcode.Jump, {
      mnemonic: 'JMP',
      target,
      addressingMode: 'absolute',
    });
    
    return {
      instructions: [load, cmp, jmp],
      cyclesSaved: 0,
      bytesSaved: -1,
    };
  }
  
  /** Check if instruction is LDA/LDX/LDY immediate */
  protected isLoadImmediate(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Load) return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'immediate' && inst.metadata?.has('value');
  }
  
  /** Check if instruction is CMP/CPX/CPY immediate */
  protected isCompareImmediate(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Compare) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    if (!COMPARE_MNEMONICS.has(mnemonic)) return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'immediate' && inst.metadata?.has('value');
  }
  
  /** Check if load and compare target same register */
  protected registersMatch(load: ILInstruction, cmp: ILInstruction): boolean {
    const loadMnem = load.metadata?.get('mnemonic') as string;
    const cmpMnem = cmp.metadata?.get('mnemonic') as string;
    
    return (
      (loadMnem === 'LDA' && cmpMnem === 'CMP') ||
      (loadMnem === 'LDX' && cmpMnem === 'CPX') ||
      (loadMnem === 'LDY' && cmpMnem === 'CPY')
    );
  }
  
  /** Check if instruction is conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_MNEMONICS.has(mnemonic);
  }
}

/**
 * Register all comparison-aware branch patterns
 */
export function registerCompareAwareBranchPatterns(registry: PatternRegistry): void {
  registry.register(new CmpZeroBccNeverTakenPattern());
  registry.register(new CmpZeroBcsAlwaysTakenPattern());
  registry.register(new KnownCompareBranchPattern());
  registry.register(new KnownCompareJmpPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `CmpZeroBccNeverTaken match` | Matches CMP #0 + BCC |
| `CmpZeroBccNeverTaken replace` | Removes dead BCC |
| `CmpZeroBcsAlwaysTaken match` | Matches CMP #0 + BCS |
| `CmpZeroBcsAlwaysTaken replace` | Converts BCS to JMP |
| `KnownCompareBranch match never` | Matches LDA #5 + CMP #10 + BCS |
| `KnownCompareBranch match equal` | Matches LDA #5 + CMP #5 + BNE |
| `KnownCompareBranch replace` | Removes dead branch |
| `KnownCompareJmp match always` | Matches LDA #10 + CMP #5 + BCS |
| `KnownCompareJmp replace` | Converts to JMP |
| `getFlagsAfterCompare equal` | Returns Z=set, C=set |
| `getFlagsAfterCompare less` | Returns Z=clear, C=clear |
| `getFlagsAfterCompare greater` | Returns Z=clear, C=set |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerCompareAwareBranchPatterns } from './patterns/branch-flag-aware-cmp.js';

registerCompareAwareBranchPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 | Os | Oz |
|---------|----|----|----|----|-----|
| CmpZeroBccNeverTakenPattern | ❌ | ✅ | ✅ | ❌ | ❌ |
| CmpZeroBcsAlwaysTakenPattern | ❌ | ❌ | ✅ | ❌ | ❌ |
| KnownCompareBranchPattern | ❌ | ✅ | ✅ | ❌ | ❌ |
| KnownCompareJmpPattern | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `branch-flag-aware-cmp.ts` | [ ] |
| Implement getFlagsAfterCompare | [ ] |
| Implement CmpZeroBccNeverTakenPattern | [ ] |
| Implement CmpZeroBcsAlwaysTakenPattern | [ ] |
| Implement KnownCompareBranchPattern | [ ] |
| Implement KnownCompareJmpPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.5d.1 → `08-05d1-branch-flag-aware-core.md`  
**Next Task**: 8.6a → `08-06a-transfer-core.md` (Core transfer patterns)
# Task 8.5c: Complementary Branch Peephole Patterns

> **Task**: 8.5c of 24 (Peephole Phase)  
> **Time**: ~1 hour  
> **Tests**: ~15 tests  
> **Prerequisites**: Task 8.5a-b (Core Branch + Chain Patterns)

---

## Overview

Implement complementary branch peephole patterns for the 6502 processor:
- Complementary branch elimination (opposite branches to same code)
- Redundant branch after comparison
- Branch pair simplification
- Complementary branch merging

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                     # Pattern exports
├── branch-core.ts               # Task 8.5a (done)
├── branch-chain.ts              # Task 8.5b (done)
├── branch-complementary.ts      # THIS TASK
└── branch-flag-aware.ts         # Task 8.5d
```

---

## Complementary Branch Concepts

### What are Complementary Branches?

Complementary branches are pairs that test opposite conditions:

| Branch | Complement | Condition |
|--------|------------|-----------|
| BEQ | BNE | Z flag |
| BNE | BEQ | Z flag |
| BCC | BCS | C flag |
| BCS | BCC | C flag |
| BMI | BPL | N flag |
| BPL | BMI | N flag |
| BVC | BVS | V flag |
| BVS | BVC | V flag |

### Optimization Opportunities

1. **Consecutive complementary branches** - Always one branch is taken
2. **Redundant branch after unconditional path** - Second branch never needed
3. **Branch pair to fall-through** - Can be simplified to single branch

---

## Implementation

### File: `branch-complementary.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Branch complement map - maps each branch to its opposite
 */
const BRANCH_COMPLEMENT: Map<string, string> = new Map([
  ['BEQ', 'BNE'],
  ['BNE', 'BEQ'],
  ['BCC', 'BCS'],
  ['BCS', 'BCC'],
  ['BMI', 'BPL'],
  ['BPL', 'BMI'],
  ['BVC', 'BVS'],
  ['BVS', 'BVC'],
]);

/**
 * All branch mnemonics
 */
const BRANCH_MNEMONICS = new Set([
  'BEQ', 'BNE', 'BCC', 'BCS', 'BMI', 'BPL', 'BVC', 'BVS'
]);

/**
 * Pattern: Complementary branch pair elimination
 * 
 * Before:
 *   BEQ target1
 *   BNE target2      ; Opposite condition - always taken if first not taken
 *   ...              ; Unreachable!
 * 
 * After:
 *   BEQ target1
 *   JMP target2      ; Unconditional since BNE always taken
 * 
 * Saves: 0-1 cycles (predictability improvement)
 * Bytes: +1 (JMP is 3 bytes, BNE is 2 bytes)
 * 
 * Alternative (if target2 is next instruction):
 *   BEQ target1      ; Just keep this, fall through to target2
 */
export class ComplementaryBranchPairPattern extends BasePattern {
  readonly id = 'complementary-branch-pair';
  readonly description = 'Eliminate second branch in complementary pair';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Check: Both are conditional branches
    if (!this.isConditionalBranch(first) || !this.isConditionalBranch(second)) {
      return null;
    }
    
    // Check: Second is complement of first
    const firstMnemonic = first.metadata?.get('mnemonic') as string;
    const secondMnemonic = second.metadata?.get('mnemonic') as string;
    const complement = BRANCH_COMPLEMENT.get(firstMnemonic);
    
    if (secondMnemonic !== complement) {
      return null;
    }
    
    // Check: No label on second (not a jump target from elsewhere)
    if (this.getLabel(second)) {
      return null;
    }
    
    // Get targets
    const target1 = this.getBranchTarget(first);
    const target2 = this.getBranchTarget(second);
    
    if (!target1 || !target2) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([
        ['firstMnemonic', firstMnemonic],
        ['secondMnemonic', secondMnemonic],
        ['target1', target1],
        ['target2', target2],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const firstMnemonic = match.captures.get('firstMnemonic') as string;
    const target1 = match.captures.get('target1') as string;
    const target2 = match.captures.get('target2') as string;
    
    // Keep first branch, replace second with JMP
    const firstBranch = this.createInstruction(ILOpcode.Branch, {
      mnemonic: firstMnemonic,
      target: target1,
      addressingMode: 'relative',
    });
    
    const jmp = this.createInstruction(ILOpcode.Jump, {
      mnemonic: 'JMP',
      target: target2,
      addressingMode: 'absolute',
    });
    
    return {
      instructions: [firstBranch, jmp],
      cyclesSaved: 0, // May actually be slightly worse for cycles
      bytesSaved: -1, // JMP is 1 byte larger than branch
      // But this is semantically clearer and may help other optimizations
    };
  }
  
  /** Check if instruction is a conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_MNEMONICS.has(mnemonic);
  }
  
  /** Get branch target */
  protected getBranchTarget(inst: ILInstruction): string | null {
    return inst.metadata?.get('target') as string ?? null;
  }
  
  /** Get label if any */
  protected getLabel(inst: ILInstruction): string | null {
    return inst.metadata?.get('label') as string ?? null;
  }
}

/**
 * Pattern: Complementary branch to fall-through
 * 
 * Before:
 *   BEQ skip
 *   BNE skip         ; Same target - redundant!
 * skip:
 *   ...
 * 
 * After:
 *   JMP skip         ; Always goes to skip
 * 
 * Saves: 1-2 cycles, -1 bytes
 * 
 * Note: This pattern indicates dead code between branches
 */
export class ComplementaryBranchSameTargetPattern extends BasePattern {
  readonly id = 'complementary-same-target';
  readonly description = 'Replace complementary branches to same target with JMP';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3, OptimizationLevel.Os];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Check: Both are conditional branches
    if (!this.isConditionalBranch(first) || !this.isConditionalBranch(second)) {
      return null;
    }
    
    // Check: Second is complement of first
    const firstMnemonic = first.metadata?.get('mnemonic') as string;
    const secondMnemonic = second.metadata?.get('mnemonic') as string;
    
    if (BRANCH_COMPLEMENT.get(firstMnemonic) !== secondMnemonic) {
      return null;
    }
    
    // Check: Same target
    const target1 = this.getBranchTarget(first);
    const target2 = this.getBranchTarget(second);
    
    if (!target1 || !target2 || target1 !== target2) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([
        ['target', target1],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const target = match.captures.get('target') as string;
    
    // Replace with single JMP
    const jmp = this.createInstruction(ILOpcode.Jump, {
      mnemonic: 'JMP',
      target,
      addressingMode: 'absolute',
    });
    
    return {
      instructions: [jmp],
      cyclesSaved: 1, // Save one branch check
      bytesSaved: 1,  // 2 branches (4 bytes) → 1 JMP (3 bytes)
    };
  }
  
  /** Check if instruction is a conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_MNEMONICS.has(mnemonic);
  }
  
  /** Get branch target */
  protected getBranchTarget(inst: ILInstruction): string | null {
    return inst.metadata?.get('target') as string ?? null;
  }
}

/**
 * Pattern: Redundant branch after unconditional
 * 
 * Before:
 *   JMP somewhere
 *   BEQ target        ; Never reached
 *   BNE target2       ; Never reached
 * 
 * After:
 *   JMP somewhere
 * 
 * Saves: 4-6 cycles (branch checking), 4 bytes
 * 
 * Note: Multiple unreachable instructions after JMP
 */
export class RedundantBranchesAfterJmpPattern extends BasePattern {
  readonly id = 'redundant-branches-after-jmp';
  readonly description = 'Remove all branches after unconditional JMP';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3, OptimizationLevel.Os, OptimizationLevel.Oz];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const jmp = instructions[0];
    
    // Check: First is unconditional JMP
    if (!this.isUnconditionalJmp(jmp)) {
      return null;
    }
    
    // Find all consecutive branches after JMP that have no labels
    const unreachable: ILInstruction[] = [];
    
    for (let i = 1; i < instructions.length; i++) {
      const inst = instructions[i];
      
      // Stop if instruction has a label (reachable from elsewhere)
      if (this.getLabel(inst)) {
        break;
      }
      
      // Only remove branches (be conservative)
      if (!this.isConditionalBranch(inst)) {
        break;
      }
      
      unreachable.push(inst);
    }
    
    if (unreachable.length === 0) {
      return null;
    }
    
    return {
      matched: [jmp, ...unreachable],
      captures: this.capture([
        ['jmpTarget', this.getJmpTarget(jmp)],
        ['removedCount', unreachable.length],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const target = match.captures.get('jmpTarget') as string;
    const removedCount = match.captures.get('removedCount') as number;
    
    // Keep only the JMP
    const jmp = this.createInstruction(ILOpcode.Jump, {
      mnemonic: 'JMP',
      target,
      addressingMode: 'absolute',
    });
    
    return {
      instructions: [jmp],
      cyclesSaved: removedCount * 2, // Each removed branch saves ~2 cycles
      bytesSaved: removedCount * 2,  // Each branch is 2 bytes
    };
  }
  
  /** Check if unconditional JMP */
  protected isUnconditionalJmp(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Jump) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return mnemonic === 'JMP';
  }
  
  /** Check if conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_MNEMONICS.has(mnemonic);
  }
  
  /** Get JMP target */
  protected getJmpTarget(inst: ILInstruction): string | null {
    return inst.metadata?.get('target') as string ?? null;
  }
  
  /** Get label if any */
  protected getLabel(inst: ILInstruction): string | null {
    return inst.metadata?.get('label') as string ?? null;
  }
}

/**
 * Pattern: Branch followed by its complement with fall-through
 * 
 * Before:
 *   CMP #10
 *   BEQ equal_case
 *   BNE not_equal    ; Fall through never reached
 * not_equal:
 *   ...
 * 
 * After:
 *   CMP #10
 *   BEQ equal_case
 * not_equal:          ; Fall through naturally
 *   ...
 * 
 * Saves: 2-3 cycles, 2 bytes
 * 
 * Note: Branch to immediately following label is redundant
 */
export class ComplementaryBranchFallThroughPattern extends BasePattern {
  readonly id = 'complementary-fall-through';
  readonly description = 'Remove complementary branch when it falls through';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3, OptimizationLevel.Os];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [first, second, third] = instructions;
    
    // Check: Both first and second are conditional branches
    if (!this.isConditionalBranch(first) || !this.isConditionalBranch(second)) {
      return null;
    }
    
    // Check: Second is complement of first
    const firstMnemonic = first.metadata?.get('mnemonic') as string;
    const secondMnemonic = second.metadata?.get('mnemonic') as string;
    
    if (BRANCH_COMPLEMENT.get(firstMnemonic) !== secondMnemonic) {
      return null;
    }
    
    // Check: Second branch targets the third instruction
    const secondTarget = this.getBranchTarget(second);
    const thirdLabel = this.getLabel(third);
    
    if (!secondTarget || !thirdLabel || secondTarget !== thirdLabel) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([
        ['firstMnemonic', firstMnemonic],
        ['firstTarget', this.getBranchTarget(first)],
        ['secondMnemonic', secondMnemonic],
        ['fallThroughLabel', thirdLabel],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const mnemonic = match.captures.get('firstMnemonic') as string;
    const target = match.captures.get('firstTarget') as string;
    
    // Keep only the first branch
    const branch = this.createInstruction(ILOpcode.Branch, {
      mnemonic,
      target,
      addressingMode: 'relative',
    });
    
    return {
      instructions: [branch],
      cyclesSaved: 2,
      bytesSaved: 2,
    };
  }
  
  /** Check if conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_MNEMONICS.has(mnemonic);
  }
  
  /** Get branch target */
  protected getBranchTarget(inst: ILInstruction): string | null {
    return inst.metadata?.get('target') as string ?? null;
  }
  
  /** Get label if any */
  protected getLabel(inst: ILInstruction): string | null {
    return inst.metadata?.get('label') as string ?? null;
  }
}

/**
 * Register all complementary branch patterns
 */
export function registerComplementaryBranchPatterns(registry: PatternRegistry): void {
  registry.register(new ComplementaryBranchPairPattern());
  registry.register(new ComplementaryBranchSameTargetPattern());
  registry.register(new RedundantBranchesAfterJmpPattern());
  registry.register(new ComplementaryBranchFallThroughPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `ComplementaryPair match BEQ/BNE` | Matches BEQ followed by BNE |
| `ComplementaryPair match BCS/BCC` | Matches BCS followed by BCC |
| `ComplementaryPair no match same type` | No match when both are same branch |
| `ComplementaryPair no match non-complement` | No match BEQ/BPL (not complements) |
| `ComplementaryPair no match labeled` | No match when second has label |
| `ComplementaryPair replace` | Creates branch + JMP |
| `SameTarget match` | Matches complements to same target |
| `SameTarget no match different targets` | No match when targets differ |
| `SameTarget replace` | Creates single JMP |
| `RedundantAfterJmp match 1` | Matches JMP + 1 branch |
| `RedundantAfterJmp match 2` | Matches JMP + 2 branches |
| `RedundantAfterJmp no match labeled` | Stops at labeled instruction |
| `RedundantAfterJmp replace` | Removes all unreachable |
| `FallThrough match` | Matches complement branch to next label |
| `FallThrough replace` | Keeps only first branch |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerComplementaryBranchPatterns } from './patterns/branch-complementary.js';

registerComplementaryBranchPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 | Os | Oz |
|---------|----|----|----|----|-----|
| ComplementaryBranchPairPattern | ❌ | ✅ | ✅ | ❌ | ❌ |
| ComplementaryBranchSameTargetPattern | ❌ | ✅ | ✅ | ✅ | ❌ |
| RedundantBranchesAfterJmpPattern | ✅ | ✅ | ✅ | ✅ | ✅ |
| ComplementaryBranchFallThroughPattern | ✅ | ✅ | ✅ | ✅ | ❌ |

### Dependencies

- Requires label information for correctness
- Must run after dead code elimination for best results
- Works well with branch chain patterns

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `branch-complementary.ts` | [ ] |
| Implement ComplementaryBranchPairPattern | [ ] |
| Implement ComplementaryBranchSameTargetPattern | [ ] |
| Implement RedundantBranchesAfterJmpPattern | [ ] |
| Implement ComplementaryBranchFallThroughPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.5b → `08-05b-branch-chain.md`  
**Next Task**: 8.5d → `08-05d-branch-flag-aware.md` (Flag-aware branch patterns)
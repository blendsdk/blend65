# Task 8.5a: Core Branch Peephole Patterns

> **Task**: 8.5a of 22 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~25 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement core branch peephole patterns for the 6502 processor:
- Branch to next instruction elimination (dead branch)
- Branch-over-JMP pattern inversion
- Duplicate branch elimination
- Branch to unconditional jump elimination

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                     # Pattern exports
├── branch-core.ts               # THIS TASK
└── branch-advanced.ts           # Task 8.5b
```

---

## 6502 Branch Instruction Background

### Conditional Branches (All: 2 bytes, 2-3 cycles)

| Instruction | Flag Condition | Description |
|-------------|---------------|-------------|
| **BEQ** | Z = 1 | Branch if Equal (zero) |
| **BNE** | Z = 0 | Branch if Not Equal |
| **BCC** | C = 0 | Branch if Carry Clear |
| **BCS** | C = 1 | Branch if Carry Set |
| **BMI** | N = 1 | Branch if Minus (negative) |
| **BPL** | N = 0 | Branch if Plus (positive) |
| **BVC** | V = 0 | Branch if Overflow Clear |
| **BVS** | V = 1 | Branch if Overflow Set |

### Branch Timing
- **Not taken**: 2 cycles
- **Taken, same page**: 3 cycles
- **Taken, page cross**: 4 cycles

### JMP (Unconditional Jump)
- **JMP absolute**: 3 bytes, 3 cycles
- **JMP indirect**: 3 bytes, 5 cycles

### Branch Range
- Branches are **relative** with signed 8-bit offset
- Range: **-128 to +127 bytes** from next instruction

---

## Implementation

### File: `branch-core.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode, ILValue } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Branch mnemonics and their inverse pairs
 */
const BRANCH_INVERSE: Map<string, string> = new Map([
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
 * Pattern: Branch to next instruction
 * 
 * Before:
 *   BEQ next
 * next:
 *   LDA #0
 * 
 * After:
 *   LDA #0
 * 
 * Saves: 2-4 cycles, 2 bytes
 * 
 * Reason: Branch to immediately following instruction has no effect
 */
export class BranchToNextPattern extends BasePattern {
  readonly id = 'branch-to-next';
  readonly description = 'Remove branch to immediately following instruction';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [branch, target] = instructions;
    
    // Check: Is conditional branch?
    if (!this.isConditionalBranch(branch)) {
      return null;
    }
    
    // Check: Does branch target the next instruction?
    const branchTarget = this.getBranchTarget(branch);
    const targetLabel = this.getLabel(target);
    
    if (!branchTarget || !targetLabel) {
      return null;
    }
    
    if (branchTarget !== targetLabel) {
      return null;
    }
    
    return {
      matched: [branch],
      captures: this.capture([
        ['mnemonic', branch.metadata?.get('mnemonic')],
        ['target', branchTarget],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    // Remove the branch entirely
    return {
      instructions: [],
      cyclesSaved: 2, // Minimum branch not-taken cycles
      bytesSaved: 2,
    };
  }
  
  /** Check if instruction is a conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_INVERSE.has(mnemonic);
  }
  
  /** Get branch target label */
  protected getBranchTarget(inst: ILInstruction): string | null {
    return inst.metadata?.get('target') as string ?? null;
  }
  
  /** Get instruction's label if it has one */
  protected getLabel(inst: ILInstruction): string | null {
    return inst.metadata?.get('label') as string ?? null;
  }
}

/**
 * Pattern: Branch-over-JMP inversion
 * 
 * Before:
 *   BEQ skip
 *   JMP far_target
 * skip:
 *   ...
 * 
 * After:
 *   BNE far_target
 *   ...
 * 
 * Saves: 3 cycles (not taken), 3 bytes
 * 
 * Condition: far_target must be reachable by branch (within ±127 bytes)
 * If far_target is out of branch range, pattern does not apply
 */
export class BranchOverJmpPattern extends BasePattern {
  readonly id = 'branch-over-jmp';
  readonly description = 'Invert branch and remove JMP when target in range';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3, OptimizationLevel.Os, OptimizationLevel.Oz];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [branch, jmp, skipTarget] = instructions;
    
    // Check: Conditional branch
    if (!this.isConditionalBranch(branch)) {
      return null;
    }
    
    // Check: Unconditional JMP
    if (!this.isUnconditionalJmp(jmp)) {
      return null;
    }
    
    // Check: Branch targets the instruction after JMP (skip)
    const branchTarget = this.getBranchTarget(branch);
    const skipLabel = this.getLabel(skipTarget);
    
    if (!branchTarget || !skipLabel || branchTarget !== skipLabel) {
      return null;
    }
    
    // Check: JMP target is within branch range
    const jmpTarget = this.getJmpTarget(jmp);
    if (!jmpTarget) {
      return null;
    }
    
    // Note: Actual range check would need code layout info
    // For now, we mark confidence lower to indicate this needs verification
    
    return {
      matched: [branch, jmp],
      captures: this.capture([
        ['originalBranch', branch.metadata?.get('mnemonic')],
        ['inverseBranch', this.getInverseBranch(branch)],
        ['jmpTarget', jmpTarget],
      ]),
      confidence: 0.8, // Lower confidence - requires distance verification
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const inverseMnemonic = match.captures.get('inverseBranch') as string;
    const target = match.captures.get('jmpTarget') as string;
    
    // Create inverted branch directly to JMP's target
    const invertedBranch = this.createBranchInstruction(inverseMnemonic, target);
    
    return {
      instructions: [invertedBranch],
      cyclesSaved: 3, // JMP is 3 cycles, now just branch taken
      bytesSaved: 3,  // JMP is 3 bytes, branch is 2, net save 3-2=1... wait
                       // Actually: Before = 2 (branch) + 3 (JMP) = 5 bytes
                       // After = 2 (branch) = 2 bytes
                       // Save = 3 bytes
    };
  }
  
  /** Check if instruction is a conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_INVERSE.has(mnemonic);
  }
  
  /** Check if instruction is unconditional JMP */
  protected isUnconditionalJmp(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Jump) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return mnemonic === 'JMP';
  }
  
  /** Get branch target label */
  protected getBranchTarget(inst: ILInstruction): string | null {
    return inst.metadata?.get('target') as string ?? null;
  }
  
  /** Get JMP target label */
  protected getJmpTarget(inst: ILInstruction): string | null {
    return inst.metadata?.get('target') as string ?? null;
  }
  
  /** Get instruction's label if it has one */
  protected getLabel(inst: ILInstruction): string | null {
    return inst.metadata?.get('label') as string ?? null;
  }
  
  /** Get inverse branch mnemonic */
  protected getInverseBranch(inst: ILInstruction): string {
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_INVERSE.get(mnemonic) ?? mnemonic;
  }
  
  /** Create a branch instruction */
  protected createBranchInstruction(mnemonic: string, target: string): ILInstruction {
    return this.createInstruction(ILOpcode.Branch, {
      mnemonic,
      target,
      addressingMode: 'relative',
    });
  }
}

/**
 * Pattern: Duplicate branch elimination
 * 
 * Before:
 *   BEQ target
 *   BEQ target   ; Duplicate - can never execute
 * 
 * After:
 *   BEQ target
 * 
 * Saves: 2-3 cycles, 2 bytes
 * 
 * Reason: If first branch taken, second never reached
 *         If first branch not taken, second condition identical
 */
export class DuplicateBranchPattern extends BasePattern {
  readonly id = 'duplicate-branch';
  readonly description = 'Remove duplicate consecutive branches to same target';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Check: Both are conditional branches
    if (!this.isConditionalBranch(first) || !this.isConditionalBranch(second)) {
      return null;
    }
    
    // Check: Same branch type
    const firstMnemonic = first.metadata?.get('mnemonic');
    const secondMnemonic = second.metadata?.get('mnemonic');
    
    if (firstMnemonic !== secondMnemonic) {
      return null;
    }
    
    // Check: Same target
    const firstTarget = this.getBranchTarget(first);
    const secondTarget = this.getBranchTarget(second);
    
    if (firstTarget !== secondTarget) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: this.capture([
        ['mnemonic', firstMnemonic],
        ['target', firstTarget],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Keep only the first branch
    const mnemonic = match.captures.get('mnemonic') as string;
    const target = match.captures.get('target') as string;
    
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
  
  /** Check if instruction is a conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_INVERSE.has(mnemonic);
  }
  
  /** Get branch target label */
  protected getBranchTarget(inst: ILInstruction): string | null {
    return inst.metadata?.get('target') as string ?? null;
  }
}

/**
 * Pattern: Branch to unconditional jump
 * 
 * Before:
 *   BEQ label
 *   ...
 * label:
 *   JMP final_target
 * 
 * After:
 *   BEQ final_target   ; Branch directly to final target
 *   ...
 * 
 * Saves: 3 cycles when taken (skips JMP)
 * 
 * Condition: final_target must be within branch range
 */
export class BranchToJmpPattern extends BasePattern {
  readonly id = 'branch-to-jmp';
  readonly description = 'Redirect branch through JMP directly to final target';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1; // Need label resolution, not window-based
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const branch = instructions[0];
    
    // Check: Conditional branch
    if (!this.isConditionalBranch(branch)) {
      return null;
    }
    
    // Check: Branch target is a JMP instruction
    // Note: This requires label resolution which needs external context
    // Pattern matcher would provide resolved target info in metadata
    const targetInst = branch.metadata?.get('resolvedTarget') as ILInstruction | undefined;
    
    if (!targetInst || !this.isUnconditionalJmp(targetInst)) {
      return null;
    }
    
    // Get JMP's target
    const finalTarget = targetInst.metadata?.get('target') as string;
    if (!finalTarget) {
      return null;
    }
    
    return {
      matched: [branch],
      captures: this.capture([
        ['mnemonic', branch.metadata?.get('mnemonic')],
        ['originalTarget', this.getBranchTarget(branch)],
        ['finalTarget', finalTarget],
      ]),
      confidence: 0.8, // Requires distance verification
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const mnemonic = match.captures.get('mnemonic') as string;
    const finalTarget = match.captures.get('finalTarget') as string;
    
    const branch = this.createInstruction(ILOpcode.Branch, {
      mnemonic,
      target: finalTarget,
      addressingMode: 'relative',
    });
    
    return {
      instructions: [branch],
      cyclesSaved: 3, // Skip the intermediate JMP
      bytesSaved: 0,  // Branch size unchanged, JMP may become dead code
    };
  }
  
  /** Check if instruction is a conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_INVERSE.has(mnemonic);
  }
  
  /** Check if instruction is unconditional JMP */
  protected isUnconditionalJmp(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Jump) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return mnemonic === 'JMP';
  }
  
  /** Get branch target label */
  protected getBranchTarget(inst: ILInstruction): string | null {
    return inst.metadata?.get('target') as string ?? null;
  }
}

/**
 * Pattern: Unreachable branch after unconditional JMP
 * 
 * Before:
 *   JMP somewhere
 *   BEQ target    ; Never reached!
 * 
 * After:
 *   JMP somewhere
 * 
 * Saves: 2-3 cycles, 2 bytes
 */
export class UnreachableBranchPattern extends BasePattern {
  readonly id = 'unreachable-branch';
  readonly description = 'Remove branch instruction after unconditional JMP';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3, OptimizationLevel.Os, OptimizationLevel.Oz];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [jmp, branch] = instructions;
    
    // Check: First is unconditional JMP
    if (!this.isUnconditionalJmp(jmp)) {
      return null;
    }
    
    // Check: Second is conditional branch
    if (!this.isConditionalBranch(branch)) {
      return null;
    }
    
    // Check: No label on branch (not a jump target)
    if (this.getLabel(branch)) {
      return null; // Branch might be reachable from elsewhere
    }
    
    return {
      matched: [jmp, branch],
      captures: this.capture([
        ['jmpTarget', jmp.metadata?.get('target')],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const target = match.captures.get('jmpTarget') as string;
    
    // Keep only the JMP
    const jmp = this.createInstruction(ILOpcode.Jump, {
      mnemonic: 'JMP',
      target,
      addressingMode: 'absolute',
    });
    
    return {
      instructions: [jmp],
      cyclesSaved: 2,
      bytesSaved: 2,
    };
  }
  
  /** Check if instruction is unconditional JMP */
  protected isUnconditionalJmp(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Jump) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return mnemonic === 'JMP';
  }
  
  /** Check if instruction is a conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_INVERSE.has(mnemonic);
  }
  
  /** Get instruction's label if it has one */
  protected getLabel(inst: ILInstruction): string | null {
    return inst.metadata?.get('label') as string ?? null;
  }
}

/**
 * Register all core branch patterns
 */
export function registerCoreBranchPatterns(registry: PatternRegistry): void {
  registry.register(new BranchToNextPattern());
  registry.register(new BranchOverJmpPattern());
  registry.register(new DuplicateBranchPattern());
  registry.register(new BranchToJmpPattern());
  registry.register(new UnreachableBranchPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `BranchToNext match` | Matches BEQ to immediately following label |
| `BranchToNext no match different target` | No match when branch goes elsewhere |
| `BranchToNext replace` | Returns empty instruction list |
| `BranchToNext cycles/bytes` | Reports 2 cycles, 2 bytes saved |
| `BranchOverJmp match` | Matches BEQ skip / JMP far / skip: pattern |
| `BranchOverJmp no match no JMP` | No match when second isn't JMP |
| `BranchOverJmp no match wrong skip` | No match when branch doesn't skip JMP |
| `BranchOverJmp replace BEQ→BNE` | Creates inverted branch |
| `BranchOverJmp replace BCS→BCC` | Creates inverted branch |
| `BranchOverJmp replace BMI→BPL` | Creates inverted branch |
| `BranchOverJmp cycles/bytes` | Reports 3 cycles, 3 bytes saved |
| `DuplicateBranch match BEQ BEQ` | Matches duplicate BEQ to same target |
| `DuplicateBranch match BNE BNE` | Matches duplicate BNE to same target |
| `DuplicateBranch no match diff type` | No match BEQ followed by BNE |
| `DuplicateBranch no match diff target` | No match when targets differ |
| `DuplicateBranch replace` | Keeps single branch |
| `BranchToJmp match` | Matches branch to label containing JMP |
| `BranchToJmp replace` | Creates branch to final target |
| `BranchToJmp no match non-JMP target` | No match if target isn't JMP |
| `UnreachableBranch match` | Matches JMP followed by unlabeled branch |
| `UnreachableBranch no match labeled` | No match if branch has label |
| `UnreachableBranch replace` | Keeps only JMP |
| `register all` | All 5 patterns registered correctly |
| `optimization levels` | Patterns enabled at correct levels |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerCoreBranchPatterns } from './patterns/branch-core.js';

registerCoreBranchPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 | Os | Oz |
|---------|----|----|----|----|-----|
| BranchToNextPattern | ✅ | ✅ | ✅ | ❌ | ❌ |
| BranchOverJmpPattern | ❌ | ✅ | ✅ | ✅ | ✅ |
| DuplicateBranchPattern | ✅ | ✅ | ✅ | ❌ | ❌ |
| BranchToJmpPattern | ❌ | ✅ | ✅ | ❌ | ❌ |
| UnreachableBranchPattern | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `branch-core.ts` | [ ] |
| Implement BranchToNextPattern | [ ] |
| Implement BranchOverJmpPattern | [ ] |
| Implement DuplicateBranchPattern | [ ] |
| Implement BranchToJmpPattern | [ ] |
| Implement UnreachableBranchPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.4c2 → `08-04c2-arithmetic-folding-advanced.md`  
**Next Task**: 8.5b → `08-05b-branch-advanced.md` (Chain branches, complementary branches, flag-aware patterns)
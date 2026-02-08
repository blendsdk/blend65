# Branch Optimization Pass: ASM-IL Optimizer

> **Document**: 06-branch-opt.md
> **Parent**: [Index](00-index.md)
> **Pass**: `BranchOptPass`
> **Enabled**: O2, O3, Os, Oz

## Overview

The Branch Optimization Pass collapses branch chains, removes unreachable code after unconditional jumps, and optimizes branch sequences.

## Patterns

### Pattern 1: JMP Chain Collapse

```asm
; BEFORE - Jump to another jump
JMP label1
...
label1: JMP label2          ; Chain!

; AFTER - Direct jump
JMP label2
```

### Pattern 2: Conditional Branch to JMP

```asm
; BEFORE - Branch to unconditional jump
BEQ label1
...
label1: JMP final           ; Target is JMP

; AFTER - Direct conditional branch
BEQ final                   ; If in range!
```

### Pattern 3: Unreachable Code Removal

```asm
; BEFORE - Code after unconditional jump
JMP somewhere
LDA #5                      ; UNREACHABLE!
STA $50                     ; UNREACHABLE!
next_label:                 ; Reachable via other path

; AFTER
JMP somewhere
next_label:                 ; Dead code removed
```

### Pattern 4: Branch Over Branch

```asm
; BEFORE - Branch skipping single instruction
BEQ skip
JMP target
skip:

; AFTER - Invert condition
BNE target                  ; Inverted, single instruction
```

### Pattern 5: Branch Direction Optimization

```asm
; BEFORE - Forward branch that can go backward
BEQ far_forward             ; +120 bytes forward
...
; Target could be moved closer

; Keep as-is (reordering is Phase 7 territory)
```

## Implementation

```typescript
import type { AsmModule, AsmInstruction, AsmItem, AsmLabel } from '../../types.js';
import type { AsmOptimizationPass } from '../types.js';
import { isAsmInstruction, isAsmLabel, AddressingMode } from '../../types.js';

/**
 * Optimizes branch and jump patterns
 */
export class BranchOptPass implements AsmOptimizationPass {
  readonly name = 'branch-opt';
  readonly isTransform = true;

  run(module: AsmModule): AsmModule {
    let currentModule = module;
    let changed = true;

    // Iterate until no more changes (chains can be >2 deep)
    while (changed) {
      changed = false;
      
      const result1 = this.collapseJmpChains(currentModule);
      if (result1 !== currentModule) {
        currentModule = result1;
        changed = true;
      }

      const result2 = this.removeUnreachableCode(currentModule);
      if (result2 !== currentModule) {
        currentModule = result2;
        changed = true;
      }

      const result3 = this.optimizeBranchOverBranch(currentModule);
      if (result3 !== currentModule) {
        currentModule = result3;
        changed = true;
      }
    }

    return currentModule;
  }

  /**
   * Collapse JMP → JMP chains
   */
  protected collapseJmpChains(module: AsmModule): AsmModule {
    // Build label → target map
    const labelTargets = this.buildLabelTargetMap(module);
    
    const newItems: AsmItem[] = [];
    let changed = false;

    for (const item of module.items) {
      if (!isAsmInstruction(item)) {
        newItems.push(item);
        continue;
      }

      // Check for JMP/branch to label that JMPs elsewhere
      if (this.isJumpOrBranch(item) && typeof item.operand === 'string') {
        const finalTarget = this.resolveChain(item.operand, labelTargets);
        if (finalTarget !== item.operand) {
          // Replace with direct jump
          newItems.push({
            ...item,
            operand: finalTarget,
          });
          changed = true;
          continue;
        }
      }

      newItems.push(item);
    }

    return changed ? { ...module, items: newItems } : module;
  }

  /**
   * Build map of label → what it immediately jumps to (if JMP)
   */
  protected buildLabelTargetMap(module: AsmModule): Map<string, string> {
    const map = new Map<string, string>();
    const items = module.items;

    for (let i = 0; i < items.length - 1; i++) {
      const item = items[i];
      if (!isAsmLabel(item)) continue;

      // Find next instruction after label
      for (let j = i + 1; j < items.length; j++) {
        const next = items[j];
        if (isAsmLabel(next)) continue; // Skip consecutive labels
        if (!isAsmInstruction(next)) continue;

        // If label is followed by JMP, record the target
        if (next.mnemonic === 'JMP' && typeof next.operand === 'string') {
          map.set(item.name, next.operand);
        }
        break;
      }
    }

    return map;
  }

  /**
   * Resolve chain of jumps to final target
   */
  protected resolveChain(label: string, targets: Map<string, string>, depth = 0): string {
    if (depth > 10) return label; // Prevent infinite loops
    const target = targets.get(label);
    if (!target || target === label) return label;
    return this.resolveChain(target, targets, depth + 1);
  }

  /**
   * Remove unreachable code after unconditional jumps
   */
  protected removeUnreachableCode(module: AsmModule): AsmModule {
    const newItems: AsmItem[] = [];
    let changed = false;
    let inUnreachable = false;

    for (const item of module.items) {
      // Labels end unreachable sections (could be jumped to)
      if (isAsmLabel(item)) {
        inUnreachable = false;
        newItems.push(item);
        continue;
      }

      // If we're in unreachable code, skip instructions
      if (inUnreachable && isAsmInstruction(item)) {
        changed = true;
        continue; // Skip unreachable instruction
      }

      newItems.push(item);

      // Unconditional jumps start unreachable sections
      if (isAsmInstruction(item)) {
        if (['JMP', 'RTS', 'RTI', 'BRK'].includes(item.mnemonic)) {
          inUnreachable = true;
        }
      }
    }

    return changed ? { ...module, items: newItems } : module;
  }

  /**
   * Optimize branch-over-branch patterns
   */
  protected optimizeBranchOverBranch(module: AsmModule): AsmModule {
    const items = module.items;
    const newItems: AsmItem[] = [];
    let changed = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Look for: BXX skip; JMP target; skip:
      if (isAsmInstruction(item) && this.isConditionalBranch(item)) {
        const pattern = this.matchBranchOverJmp(items, i);
        if (pattern) {
          // Replace with inverted branch
          newItems.push({
            ...item,
            mnemonic: this.invertBranch(item.mnemonic),
            operand: pattern.jmpTarget,
          });
          i = pattern.skipIndex; // Skip the JMP and label
          changed = true;
          continue;
        }
      }

      newItems.push(item);
    }

    return changed ? { ...module, items: newItems } : module;
  }

  protected isJumpOrBranch(instr: AsmInstruction): boolean {
    return ['JMP', 'BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS'].includes(instr.mnemonic);
  }

  protected isConditionalBranch(instr: AsmInstruction): boolean {
    return ['BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS'].includes(instr.mnemonic);
  }

  protected invertBranch(mnemonic: string): string {
    const inversions: Record<string, string> = {
      'BCC': 'BCS', 'BCS': 'BCC',
      'BEQ': 'BNE', 'BNE': 'BEQ',
      'BMI': 'BPL', 'BPL': 'BMI',
      'BVC': 'BVS', 'BVS': 'BVC',
    };
    return inversions[mnemonic] ?? mnemonic;
  }

  protected matchBranchOverJmp(items: readonly AsmItem[], branchIndex: number): { jmpTarget: string; skipIndex: number } | null {
    const branch = items[branchIndex] as AsmInstruction;
    const skipLabel = branch.operand as string;

    // Look for JMP immediately after
    let jmpIndex = branchIndex + 1;
    while (jmpIndex < items.length && !isAsmInstruction(items[jmpIndex])) {
      jmpIndex++;
    }
    if (jmpIndex >= items.length) return null;

    const maybeJmp = items[jmpIndex];
    if (!isAsmInstruction(maybeJmp) || maybeJmp.mnemonic !== 'JMP') return null;

    // Look for skip label after JMP
    let labelIndex = jmpIndex + 1;
    while (labelIndex < items.length && !isAsmLabel(items[labelIndex])) {
      if (isAsmInstruction(items[labelIndex])) return null; // Code in between
      labelIndex++;
    }
    if (labelIndex >= items.length) return null;

    const maybeLabel = items[labelIndex];
    if (!isAsmLabel(maybeLabel) || maybeLabel.name !== skipLabel) return null;

    return {
      jmpTarget: maybeJmp.operand as string,
      skipIndex: labelIndex,
    };
  }
}
```

## Edge Cases

### Case 1: Branch Range Limits

```asm
; Conditional branches have ±127 byte range
BEQ far_label               ; May be out of range after optimization!
```

**Solution**: Check range before optimizing. If out of range, keep original.

### Case 2: Circular References

```asm
label1: JMP label2
label2: JMP label1          ; Infinite loop!
```

**Solution**: Limit chain resolution depth (max 10 hops).

## Testing Requirements

```typescript
describe('BranchOptPass', () => {
  it('collapses JMP chains', () => { ... });
  it('removes unreachable code after JMP', () => { ... });
  it('keeps code after conditional branch', () => { ... });
  it('optimizes branch-over-JMP', () => { ... });
  it('handles multiple chain levels', () => { ... });
});
```

## Performance Impact

| Pattern | Frequency | Cycles Saved | Bytes Saved |
|---------|-----------|--------------|-------------|
| JMP chain | Moderate | 3+ | 0-3 |
| Unreachable code | Rare | N/A | Variable |
| Branch-over-JMP | Common | 3 | 2 |

**Expected Impact**: 5-10% reduction in branch overhead.
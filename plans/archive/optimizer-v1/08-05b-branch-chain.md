# Task 8.5b: Branch Chain Peephole Patterns

> **Task**: 8.5b of 24 (Peephole Phase)  
> **Time**: ~1 hour  
> **Tests**: ~15 tests  
> **Prerequisites**: Task 8.5a (Core Branch Patterns)

---

## Overview

Implement branch chain peephole patterns for the 6502 processor:
- Simple branch chain optimization (A→B→C becomes A→C)
- Multi-level branch chain flattening
- JMP chain optimization
- Mixed branch/JMP chain handling

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                     # Pattern exports
├── branch-core.ts               # Task 8.5a (done)
├── branch-chain.ts              # THIS TASK
├── branch-complementary.ts      # Task 8.5c
└── branch-flag-aware.ts         # Task 8.5d
```

---

## Branch Chain Concepts

### What is a Branch Chain?

A branch chain occurs when a branch targets another branch/jump:

```asm
; Chain: BEQ label1 → JMP label2 → JMP final
    BEQ label1      ; Branch to label1
    ...
label1:
    JMP label2      ; Jump to label2
    ...
label2:
    JMP final       ; Jump to final
```

### Optimization Goal

Eliminate intermediate jumps by branching directly to final target:

```asm
; Optimized: BEQ directly to final
    BEQ final       ; Branch directly to final (if in range)
```

### Constraints

- Branch range: -128 to +127 bytes
- Must verify final target is within branch range
- JMP has no range limit (but costs more)

---

## Implementation

### File: `branch-chain.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode, ILValue } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Branch mnemonics (reuse from branch-core.ts or import)
 */
const BRANCH_MNEMONICS = new Set([
  'BEQ', 'BNE', 'BCC', 'BCS', 'BMI', 'BPL', 'BVC', 'BVS'
]);

/**
 * Pattern: Simple branch chain (branch → JMP → target)
 * 
 * Before:
 *   BEQ label1
 *   ...
 * label1:
 *   JMP final_target
 * 
 * After:
 *   BEQ final_target  ; Direct branch to final (if in range)
 * 
 * Saves: 3 cycles when branch taken (skips intermediate JMP)
 * 
 * Condition: final_target must be within branch range (-128 to +127)
 */
export class SimpleBranchChainPattern extends BasePattern {
  readonly id = 'simple-branch-chain';
  readonly description = 'Optimize branch → JMP chain to direct branch';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1; // Requires resolved target analysis
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const branch = instructions[0];
    
    // Check: Is conditional branch?
    if (!this.isConditionalBranch(branch)) {
      return null;
    }
    
    // Get resolved target instruction
    const targetInst = this.getResolvedTarget(branch);
    if (!targetInst) {
      return null;
    }
    
    // Check: Target is unconditional JMP
    if (!this.isUnconditionalJmp(targetInst)) {
      return null;
    }
    
    // Get JMP's target (final destination)
    const finalTarget = this.getJmpTarget(targetInst);
    if (!finalTarget) {
      return null;
    }
    
    // Check: Final target is within branch range
    const distance = this.calculateDistance(branch, finalTarget);
    if (!this.isWithinBranchRange(distance)) {
      return null; // Cannot optimize - too far for branch
    }
    
    return {
      matched: [branch],
      captures: this.capture([
        ['mnemonic', branch.metadata?.get('mnemonic')],
        ['originalTarget', this.getBranchTarget(branch)],
        ['finalTarget', finalTarget],
        ['cyclesSaved', 3], // Skip intermediate JMP
      ]),
      confidence: 0.9, // High confidence if distance verified
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const mnemonic = match.captures.get('mnemonic') as string;
    const finalTarget = match.captures.get('finalTarget') as string;
    
    // Create direct branch to final target
    const optimizedBranch = this.createInstruction(ILOpcode.Branch, {
      mnemonic,
      target: finalTarget,
      addressingMode: 'relative',
    });
    
    return {
      instructions: [optimizedBranch],
      cyclesSaved: 3, // Intermediate JMP cycles saved
      bytesSaved: 0,  // Branch size unchanged, JMP may become dead
    };
  }
  
  /** Check if instruction is a conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_MNEMONICS.has(mnemonic);
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
  
  /** Get resolved target instruction (requires label resolution) */
  protected getResolvedTarget(inst: ILInstruction): ILInstruction | null {
    return inst.metadata?.get('resolvedTarget') as ILInstruction ?? null;
  }
  
  /** Calculate distance to target (placeholder - needs layout info) */
  protected calculateDistance(_from: ILInstruction, _to: string): number {
    // Real implementation needs code layout information
    // Returns signed byte distance
    return 0; // Placeholder
  }
  
  /** Check if distance is within branch range */
  protected isWithinBranchRange(distance: number): boolean {
    return distance >= -128 && distance <= 127;
  }
}

/**
 * Pattern: Multi-level branch chain (A → B → C → final)
 * 
 * Before:
 *   BEQ label1
 * label1:
 *   JMP label2
 * label2:
 *   JMP label3
 * label3:
 *   JMP final
 * 
 * After:
 *   BEQ final  ; Skip all intermediate jumps (if in range)
 * 
 * Saves: 9+ cycles when taken (3 cycles per skipped JMP)
 */
export class MultiBranchChainPattern extends BasePattern {
  readonly id = 'multi-branch-chain';
  readonly description = 'Flatten multi-level branch/JMP chain';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  /** Maximum chain depth to follow */
  protected maxChainDepth = 5;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const branch = instructions[0];
    
    // Check: Is conditional branch or JMP?
    if (!this.isBranchOrJmp(branch)) {
      return null;
    }
    
    // Follow the chain to find final target
    const chainResult = this.followChain(branch);
    if (!chainResult) {
      return null;
    }
    
    const { finalTarget, chainLength, cyclesSaved } = chainResult;
    
    // Only optimize if chain has 2+ intermediate jumps
    if (chainLength < 2) {
      return null;
    }
    
    // For conditional branches, verify final target is in range
    if (this.isConditionalBranch(branch)) {
      const distance = this.calculateDistance(branch, finalTarget);
      if (!this.isWithinBranchRange(distance)) {
        return null;
      }
    }
    
    return {
      matched: [branch],
      captures: this.capture([
        ['mnemonic', branch.metadata?.get('mnemonic')],
        ['originalTarget', this.getTarget(branch)],
        ['finalTarget', finalTarget],
        ['chainLength', chainLength],
        ['cyclesSaved', cyclesSaved],
      ]),
      confidence: 0.85,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const mnemonic = match.captures.get('mnemonic') as string;
    const finalTarget = match.captures.get('finalTarget') as string;
    const cyclesSaved = match.captures.get('cyclesSaved') as number;
    
    // Determine opcode based on original instruction
    const opcode = mnemonic === 'JMP' ? ILOpcode.Jump : ILOpcode.Branch;
    const addressingMode = mnemonic === 'JMP' ? 'absolute' : 'relative';
    
    const optimized = this.createInstruction(opcode, {
      mnemonic,
      target: finalTarget,
      addressingMode,
    });
    
    return {
      instructions: [optimized],
      cyclesSaved,
      bytesSaved: 0,
    };
  }
  
  /**
   * Follow branch/JMP chain to find final target
   * Returns null if chain doesn't lead anywhere optimizable
   */
  protected followChain(start: ILInstruction): {
    finalTarget: string;
    chainLength: number;
    cyclesSaved: number;
  } | null {
    let current = start;
    let depth = 0;
    let cyclesSaved = 0;
    const visited = new Set<string>();
    
    while (depth < this.maxChainDepth) {
      const target = this.getTarget(current);
      if (!target) break;
      
      // Detect cycles
      if (visited.has(target)) {
        return null; // Infinite loop detected
      }
      visited.add(target);
      
      // Get resolved target instruction
      const targetInst = this.getResolvedTarget(current);
      if (!targetInst) {
        // Target is not a jump - this is our final destination
        return depth > 0 ? {
          finalTarget: target,
          chainLength: depth,
          cyclesSaved,
        } : null;
      }
      
      // Check if target is another JMP
      if (this.isUnconditionalJmp(targetInst)) {
        cyclesSaved += 3; // JMP costs 3 cycles
        current = targetInst;
        depth++;
        continue;
      }
      
      // Target is not a JMP - end of chain
      return depth > 0 ? {
        finalTarget: target,
        chainLength: depth,
        cyclesSaved,
      } : null;
    }
    
    return null; // Chain too deep or no optimization
  }
  
  /** Check if instruction is branch or JMP */
  protected isBranchOrJmp(inst: ILInstruction): boolean {
    return this.isConditionalBranch(inst) || this.isUnconditionalJmp(inst);
  }
  
  /** Check if instruction is a conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_MNEMONICS.has(mnemonic);
  }
  
  /** Check if instruction is unconditional JMP */
  protected isUnconditionalJmp(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Jump) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return mnemonic === 'JMP';
  }
  
  /** Get target from branch or JMP */
  protected getTarget(inst: ILInstruction): string | null {
    return inst.metadata?.get('target') as string ?? null;
  }
  
  /** Get resolved target instruction */
  protected getResolvedTarget(inst: ILInstruction): ILInstruction | null {
    return inst.metadata?.get('resolvedTarget') as ILInstruction ?? null;
  }
  
  /** Calculate distance (placeholder) */
  protected calculateDistance(_from: ILInstruction, _to: string): number {
    return 0; // Needs layout info
  }
  
  /** Check branch range */
  protected isWithinBranchRange(distance: number): boolean {
    return distance >= -128 && distance <= 127;
  }
}

/**
 * Pattern: JMP chain flattening
 * 
 * Before:
 *   JMP label1
 * label1:
 *   JMP label2
 * label2:
 *   JMP final
 * 
 * After:
 *   JMP final
 * 
 * Saves: 6 cycles (2 intermediate JMPs × 3 cycles each)
 * 
 * Note: JMP has no range limit, so always applicable
 */
export class JmpChainPattern extends BasePattern {
  readonly id = 'jmp-chain';
  readonly description = 'Flatten JMP → JMP chain';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3, OptimizationLevel.Os];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const jmp = instructions[0];
    
    // Check: Is unconditional JMP?
    if (!this.isUnconditionalJmp(jmp)) {
      return null;
    }
    
    // Get target instruction
    const targetInst = this.getResolvedTarget(jmp);
    if (!targetInst) {
      return null;
    }
    
    // Check: Target is also a JMP
    if (!this.isUnconditionalJmp(targetInst)) {
      return null;
    }
    
    // Get final target
    const finalTarget = this.getJmpTarget(targetInst);
    if (!finalTarget) {
      return null;
    }
    
    // Don't optimize self-referential jumps
    const originalTarget = this.getJmpTarget(jmp);
    if (originalTarget === finalTarget) {
      return null;
    }
    
    return {
      matched: [jmp],
      captures: this.capture([
        ['originalTarget', originalTarget],
        ['finalTarget', finalTarget],
      ]),
      confidence: 1.0, // JMP has no range limit
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const finalTarget = match.captures.get('finalTarget') as string;
    
    const optimizedJmp = this.createInstruction(ILOpcode.Jump, {
      mnemonic: 'JMP',
      target: finalTarget,
      addressingMode: 'absolute',
    });
    
    return {
      instructions: [optimizedJmp],
      cyclesSaved: 3, // Skip one intermediate JMP
      bytesSaved: 0,
    };
  }
  
  /** Check if instruction is unconditional JMP */
  protected isUnconditionalJmp(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Jump) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return mnemonic === 'JMP';
  }
  
  /** Get JMP target */
  protected getJmpTarget(inst: ILInstruction): string | null {
    return inst.metadata?.get('target') as string ?? null;
  }
  
  /** Get resolved target instruction */
  protected getResolvedTarget(inst: ILInstruction): ILInstruction | null {
    return inst.metadata?.get('resolvedTarget') as ILInstruction ?? null;
  }
}

/**
 * Register all branch chain patterns
 */
export function registerBranchChainPatterns(registry: PatternRegistry): void {
  registry.register(new SimpleBranchChainPattern());
  registry.register(new MultiBranchChainPattern());
  registry.register(new JmpChainPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `SimpleBranchChain match` | Matches BEQ → JMP pattern |
| `SimpleBranchChain no match non-JMP target` | No match when target isn't JMP |
| `SimpleBranchChain no match out of range` | No match when final target too far |
| `SimpleBranchChain replace` | Creates direct branch |
| `SimpleBranchChain cycles` | Reports 3 cycles saved |
| `MultiBranchChain match depth 2` | Matches A→B→C chain |
| `MultiBranchChain match depth 3` | Matches A→B→C→D chain |
| `MultiBranchChain no match depth 1` | No match for single-level |
| `MultiBranchChain cycle detection` | Detects infinite loops |
| `MultiBranchChain max depth` | Respects depth limit |
| `MultiBranchChain replace` | Creates optimized branch |
| `JmpChain match` | Matches JMP → JMP pattern |
| `JmpChain no match self-ref` | No match for JMP to self |
| `JmpChain replace` | Creates direct JMP |
| `register all` | All 3 patterns registered |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerBranchChainPatterns } from './patterns/branch-chain.js';

registerBranchChainPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 | Os | Oz |
|---------|----|----|----|----|-----|
| SimpleBranchChainPattern | ❌ | ✅ | ✅ | ❌ | ❌ |
| MultiBranchChainPattern | ❌ | ✅ | ✅ | ❌ | ❌ |
| JmpChainPattern | ✅ | ✅ | ✅ | ✅ | ❌ |

### Dependencies

- Requires label resolution to follow chains
- Distance calculation needs code layout information
- Dead code elimination may remove intermediate JMPs

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `branch-chain.ts` | [ ] |
| Implement SimpleBranchChainPattern | [ ] |
| Implement MultiBranchChainPattern | [ ] |
| Implement JmpChainPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.5a → `08-05a-branch-core.md`  
**Next Task**: 8.5c → `08-05c-branch-complementary.md` (Complementary branch patterns)
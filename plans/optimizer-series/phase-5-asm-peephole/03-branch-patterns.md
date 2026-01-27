# Phase 5.3: Branch Patterns

> **Document**: 03-branch-patterns.md  
> **Phase**: 5 - ASM Peephole  
> **Focus**: Branch chain collapse, unreachable code elimination  
> **Est. Implementation**: ~250 lines

---

## Overview

Branch patterns optimize control flow by:
1. Collapsing branch chains (JMP to JMP)
2. Removing unreachable code after unconditional jumps
3. Inverting branches to eliminate unnecessary jumps
4. Optimizing conditional branch sequences

---

## 1. Branch Chain Collapse

### The Problem

Code generation often creates chains of jumps:

```asm
; BEFORE (branch chain)
    JMP label1
    ...
label1:
    JMP label2              ; ← Chain link
    ...
label2:
    LDA #$00                ; Final destination
```

### Implementation

```typescript
// packages/compiler/src/asm-il/optimizer/passes/branch.ts

import { AsmInstruction, AsmOpcode } from '../../types.js';
import { Pattern, MatchResult, PatternContext } from '../pattern-framework.js';

/**
 * Pattern: Branch Chain Collapse
 * 
 * Match: JMP label1 where label1: JMP label2
 * Replace: JMP label2 (skip intermediate)
 * 
 * Note: This requires label resolution context
 */
export class BranchChainPattern implements Pattern<AsmInstruction> {
  readonly name = 'branch-chain';
  readonly priority = 75;
  readonly category = 'branch';

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    const jmp = instructions[index];
    if (jmp.opcode !== AsmOpcode.JMP) return null;

    // Get the target label
    const targetLabel = jmp.operand as string;
    if (typeof targetLabel !== 'string') return null;

    // Find the instruction at that label
    const targetIndex = this.findLabel(instructions, targetLabel);
    if (targetIndex === -1) return null;

    const target = instructions[targetIndex];

    // If target is also a JMP, we have a chain
    if (target.opcode !== AsmOpcode.JMP) return null;

    // Avoid infinite loops (JMP to itself)
    if (target.operand === targetLabel) return null;

    return {
      matchedInstructions: [jmp],
      startIndex: index,
      length: 1,
      metadata: {
        patternName: this.name,
        reason: `JMP chain: ${targetLabel} → ${target.operand}`,
        cyclesSaved: 3,  // Save one JMP execution
        bytesSaved: 0,   // No bytes saved, just faster
        newTarget: target.operand,
      }
    };
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    const jmp = match.matchedInstructions[0];
    
    return [{
      ...jmp,
      operand: match.metadata.newTarget,
      comment: `Chain collapsed from ${jmp.operand}`,
    }];
  }

  protected findLabel(instructions: readonly AsmInstruction[], label: string): number {
    return instructions.findIndex(inst => inst.label === label);
  }
}
```

### Test Cases

```typescript
describe('BranchChainPattern', () => {
  it('collapses JMP to JMP chain', () => {
    const input = [
      { opcode: AsmOpcode.JMP, operand: 'label1' },
      { opcode: AsmOpcode.NOP },
      { opcode: AsmOpcode.JMP, operand: 'label2', label: 'label1' },
      { opcode: AsmOpcode.LDA, operand: 0, label: 'label2' },
    ];
    const result = engine.optimize(input);
    expect(result[0].operand).toBe('label2'); // Chain collapsed
  });

  it('handles multi-level chains', () => {
    const input = [
      { opcode: AsmOpcode.JMP, operand: 'a' },
      { opcode: AsmOpcode.JMP, operand: 'b', label: 'a' },
      { opcode: AsmOpcode.JMP, operand: 'c', label: 'b' },
      { opcode: AsmOpcode.RTS, label: 'c' },
    ];
    // After multiple passes, should jump directly to 'c'
    const result = engine.optimizeFixedPoint(input, 5);
    expect(result[0].operand).toBe('c');
  });

  it('avoids infinite loop on self-referencing JMP', () => {
    const input = [
      { opcode: AsmOpcode.JMP, operand: 'loop', label: 'loop' },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(1); // No change
  });
});
```

---

## 2. Conditional Branch Chain Optimization

### The Problem

Conditional branches can also form chains:

```asm
; BEFORE
    BEQ label1
    ...
label1:
    JMP label2              ; BEQ → JMP chain
```

### Implementation

```typescript
/**
 * Pattern: Conditional Branch to JMP
 * 
 * Match: Bxx label1 where label1: JMP label2
 * Replace: Bxx label2 (if in range)
 */
export class ConditionalBranchChainPattern implements Pattern<AsmInstruction> {
  readonly name = 'conditional-branch-chain';
  readonly priority = 70;
  readonly category = 'branch';

  protected readonly CONDITIONAL_BRANCHES = new Set([
    AsmOpcode.BEQ, AsmOpcode.BNE,
    AsmOpcode.BCC, AsmOpcode.BCS,
    AsmOpcode.BMI, AsmOpcode.BPL,
    AsmOpcode.BVC, AsmOpcode.BVS,
  ]);

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    const branch = instructions[index];
    if (!this.CONDITIONAL_BRANCHES.has(branch.opcode)) return null;

    const targetLabel = branch.operand as string;
    if (typeof targetLabel !== 'string') return null;

    const targetIndex = this.findLabel(instructions, targetLabel);
    if (targetIndex === -1) return null;

    const target = instructions[targetIndex];

    // Target must be an unconditional JMP
    if (target.opcode !== AsmOpcode.JMP) return null;

    // Check if new target is in branch range (-128 to +127 bytes)
    // For now, assume it is - the assembler will error if not
    // A more sophisticated version would calculate distances

    return {
      matchedInstructions: [branch],
      startIndex: index,
      length: 1,
      metadata: {
        patternName: this.name,
        reason: `Branch chain: ${targetLabel} → ${target.operand}`,
        cyclesSaved: 3,
        bytesSaved: 0,
        newTarget: target.operand,
      }
    };
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    const branch = match.matchedInstructions[0];
    
    return [{
      ...branch,
      operand: match.metadata.newTarget,
      comment: `Chain collapsed from ${branch.operand}`,
    }];
  }

  protected findLabel(instructions: readonly AsmInstruction[], label: string): number {
    return instructions.findIndex(inst => inst.label === label);
  }
}
```

---

## 3. Unreachable Code Elimination

### The Problem

Code after unconditional jumps is unreachable (unless it has a label):

```asm
; BEFORE
    JMP done
    LDA #$05                ; ← UNREACHABLE (no label)
    STA $50                 ; ← UNREACHABLE
done:
    RTS
```

### Implementation

```typescript
/**
 * Pattern: Unreachable Code After JMP/RTS
 * 
 * Match: JMP/RTS; <unlabeled instruction>
 * Replace: JMP/RTS (remove unreachable code)
 */
export class UnreachableCodePattern implements Pattern<AsmInstruction> {
  readonly name = 'unreachable-code';
  readonly priority = 85;
  readonly category = 'branch';

  protected readonly UNCONDITIONAL = new Set([
    AsmOpcode.JMP,
    AsmOpcode.RTS,
    AsmOpcode.RTI,
    AsmOpcode.BRK,  // Break also doesn't return normally
  ]);

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    const term = instructions[index];
    if (!this.UNCONDITIONAL.has(term.opcode)) return null;

    // Collect unreachable instructions until we hit a label
    const unreachable: AsmInstruction[] = [];
    for (let i = index + 1; i < instructions.length; i++) {
      const inst = instructions[i];
      
      // Stop at labels - they might be jump targets
      if (inst.label) break;
      
      unreachable.push(inst);
    }

    if (unreachable.length === 0) return null;

    return {
      matchedInstructions: [term, ...unreachable],
      startIndex: index,
      length: 1 + unreachable.length,
      metadata: {
        patternName: this.name,
        reason: `${unreachable.length} unreachable instruction(s) after ${AsmOpcode[term.opcode]}`,
        cyclesSaved: unreachable.reduce((sum, inst) => sum + this.getCycles(inst), 0),
        bytesSaved: unreachable.reduce((sum, inst) => sum + this.getBytes(inst), 0),
      }
    };
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    // Keep only the terminating instruction
    return [match.matchedInstructions[0]];
  }

  protected getCycles(inst: AsmInstruction): number {
    // Rough estimate
    return 3;
  }

  protected getBytes(inst: AsmInstruction): number {
    switch (inst.addressingMode) {
      case 'implied': return 1;
      case 'immediate':
      case 'zeroPage':
      case 'relative': return 2;
      default: return 3;
    }
  }
}
```

### Test Cases

```typescript
describe('UnreachableCodePattern', () => {
  it('removes code after JMP', () => {
    const input = [
      { opcode: AsmOpcode.JMP, operand: 'done' },
      { opcode: AsmOpcode.LDA, addressingMode: 'immediate', operand: 5 },
      { opcode: AsmOpcode.STA, addressingMode: 'zeroPage', operand: 0x50 },
      { opcode: AsmOpcode.RTS, label: 'done' },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(2); // JMP + RTS
  });

  it('removes code after RTS', () => {
    const input = [
      { opcode: AsmOpcode.RTS },
      { opcode: AsmOpcode.NOP },
      { opcode: AsmOpcode.NOP },
      { opcode: AsmOpcode.LDA, label: 'next' },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(2); // RTS + labeled LDA
  });

  it('preserves labeled instructions', () => {
    const input = [
      { opcode: AsmOpcode.JMP, operand: 'skip' },
      { opcode: AsmOpcode.LDA, label: 'target' }, // Preserve - it's a target
      { opcode: AsmOpcode.RTS, label: 'skip' },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(3); // All preserved
  });
});
```

---

## 4. Branch Inversion

### The Problem

Sometimes a branch followed by JMP can be inverted to remove the JMP:

```asm
; BEFORE
    BEQ skip                ; Branch if equal
    JMP continue            ; Otherwise jump away
skip:
    LDA #$00                ; Only reached if equal

; AFTER
    BNE continue            ; Branch if NOT equal (inverted)
    LDA #$00                ; Falls through if equal
```

### Implementation

```typescript
/**
 * Pattern: Branch Inversion
 * 
 * Match: Bxx label; JMP other; label: ...
 * Replace: B!xx other; ... (invert condition, remove JMP)
 */
export class BranchInversionPattern implements Pattern<AsmInstruction> {
  readonly name = 'branch-inversion';
  readonly priority = 65;
  readonly category = 'branch';

  /** Map branch opcode to its inverse */
  protected readonly INVERSE: Map<AsmOpcode, AsmOpcode> = new Map([
    [AsmOpcode.BEQ, AsmOpcode.BNE],
    [AsmOpcode.BNE, AsmOpcode.BEQ],
    [AsmOpcode.BCC, AsmOpcode.BCS],
    [AsmOpcode.BCS, AsmOpcode.BCC],
    [AsmOpcode.BMI, AsmOpcode.BPL],
    [AsmOpcode.BPL, AsmOpcode.BMI],
    [AsmOpcode.BVC, AsmOpcode.BVS],
    [AsmOpcode.BVS, AsmOpcode.BVC],
  ]);

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    if (index + 2 >= instructions.length) return null;

    const branch = instructions[index];
    const jmp = instructions[index + 1];
    const target = instructions[index + 2];

    // Must be conditional branch
    if (!this.INVERSE.has(branch.opcode)) return null;

    // Must be followed by JMP
    if (jmp.opcode !== AsmOpcode.JMP) return null;
    if (jmp.label) return null; // JMP must not be a jump target

    // Branch target must be the instruction after JMP
    if (target.label !== branch.operand) return null;

    return {
      matchedInstructions: [branch, jmp, target],
      startIndex: index,
      length: 3,
      metadata: {
        patternName: this.name,
        reason: `Invert ${AsmOpcode[branch.opcode]} → ${AsmOpcode[this.INVERSE.get(branch.opcode)!]}`,
        cyclesSaved: 3,  // JMP removed
        bytesSaved: 3,   // JMP is 3 bytes
        inverseBranch: this.INVERSE.get(branch.opcode)!,
        jmpTarget: jmp.operand,
      }
    };
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    const target = match.matchedInstructions[2];
    
    return [
      {
        opcode: match.metadata.inverseBranch,
        addressingMode: 'relative',
        operand: match.metadata.jmpTarget,
        comment: 'Inverted branch, JMP eliminated',
      },
      target,  // Keep the target instruction with its label
    ];
  }
}
```

### Test Cases

```typescript
describe('BranchInversionPattern', () => {
  it('inverts BEQ+JMP to BNE', () => {
    const input = [
      { opcode: AsmOpcode.BEQ, operand: 'skip' },
      { opcode: AsmOpcode.JMP, operand: 'elsewhere' },
      { opcode: AsmOpcode.LDA, operand: 0, label: 'skip' },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(2);
    expect(result[0].opcode).toBe(AsmOpcode.BNE);
    expect(result[0].operand).toBe('elsewhere');
  });

  it('preserves when JMP has label', () => {
    const input = [
      { opcode: AsmOpcode.BEQ, operand: 'skip' },
      { opcode: AsmOpcode.JMP, operand: 'elsewhere', label: 'retry' },
      { opcode: AsmOpcode.LDA, operand: 0, label: 'skip' },
    ];
    const result = engine.optimize(input);
    expect(result).toHaveLength(3); // No change
  });
});
```

---

## 5. Skip Over Single Instruction

### The Problem

Branching over a single instruction wastes cycles:

```asm
; BEFORE
    BEQ skip
    INX                     ; Single instruction
skip:
    ...

; AFTER (use conditional execution if possible)
; On 6502, this is hard to optimize further, but we can at least
; detect when the skipped code could be replaced with a NOP
```

For 6502, this optimization is limited, but we can still optimize some cases:

```typescript
/**
 * Pattern: Branch over NOP
 * 
 * Match: Bxx skip; NOP; skip: ...
 * Replace: skip: ... (remove branch and NOP)
 */
export class BranchOverNopPattern implements Pattern<AsmInstruction> {
  readonly name = 'branch-over-nop';
  readonly priority = 60;
  readonly category = 'branch';

  protected readonly CONDITIONAL = new Set([
    AsmOpcode.BEQ, AsmOpcode.BNE, AsmOpcode.BCC, AsmOpcode.BCS,
    AsmOpcode.BMI, AsmOpcode.BPL, AsmOpcode.BVC, AsmOpcode.BVS,
  ]);

  match(
    instructions: readonly AsmInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<AsmInstruction> | null {
    if (index + 2 >= instructions.length) return null;

    const branch = instructions[index];
    const nop = instructions[index + 1];
    const target = instructions[index + 2];

    if (!this.CONDITIONAL.has(branch.opcode)) return null;
    if (nop.opcode !== AsmOpcode.NOP) return null;
    if (nop.label) return null;  // NOP is a jump target
    if (target.label !== branch.operand) return null;

    return {
      matchedInstructions: [branch, nop, target],
      startIndex: index,
      length: 3,
      metadata: {
        patternName: this.name,
        reason: 'Branch over NOP is pointless',
        cyclesSaved: 2 + 2,  // Branch + NOP
        bytesSaved: 2 + 1,   // Branch + NOP
      }
    };
  }

  apply(
    match: MatchResult<AsmInstruction>,
    context: PatternContext
  ): AsmInstruction[] {
    // Just keep the target instruction
    return [match.matchedInstructions[2]];
  }
}
```

---

## Pattern Summary

| Pattern | Match | Replace | Cycles | Bytes | Priority |
|---------|-------|---------|--------|-------|----------|
| `branch-chain` | JMP l1; l1: JMP l2 | JMP l2 | 3 | 0 | 75 |
| `conditional-branch-chain` | BEQ l1; l1: JMP l2 | BEQ l2 | 3 | 0 | 70 |
| `unreachable-code` | JMP; <no label> | JMP | varies | varies | 85 |
| `branch-inversion` | BEQ skip; JMP x; skip: | BNE x | 3 | 3 | 65 |
| `branch-over-nop` | BEQ skip; NOP; skip: | skip: | 4 | 3 | 60 |

---

## Test Count

| Category | Tests |
|----------|-------|
| BranchChainPattern | 12 |
| ConditionalBranchChainPattern | 10 |
| UnreachableCodePattern | 15 |
| BranchInversionPattern | 12 |
| BranchOverNopPattern | 8 |
| **Total** | **57** |

---

## Integration

```typescript
// packages/compiler/src/asm-il/optimizer/passes/index.ts

export { 
  BranchChainPattern,
  ConditionalBranchChainPattern,
} from './branch-chain.js';

export {
  UnreachableCodePattern,
} from './unreachable.js';

export {
  BranchInversionPattern,
  BranchOverNopPattern,
} from './branch-invert.js';
```

---

**Parent Document**: [Phase Index](00-phase-index.md)  
**Previous Document**: [02 - Load-Store ASM](02-load-store-asm.md)  
**Next Document**: [04 - Transfer Patterns](04-transfer-patterns.md)
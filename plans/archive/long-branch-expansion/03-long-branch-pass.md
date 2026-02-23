# Technical Specification: Long-Branch Expansion Pass

> **Document**: 03-long-branch-pass.md
> **Parent**: [Index](00-index.md)

## Overview

A new ASM-IL optimizer pass that scans for conditional branch instructions with potentially out-of-range targets and expands them into an inverted-branch + JMP + skip-label pattern.

## Architecture

### Current Architecture

```
Codegen → AsmILProgram → [FlagPatterns → StoreLoad → BranchOpt → ... → RegisterPromote] → ACME Emitter
```

Branch instructions are emitted directly by the codegen (`BCS label`, `BNE label`, etc.) with no range awareness. If inlining makes the target too far, ACME fails.

### Proposed Changes

```
Codegen → AsmILProgram → [FlagPatterns → ... → RegisterPromote → LongBranchExpansion] → ACME Emitter
                                                                  ^^^^^^^^^^^^^^^^^^^^^^^^
                                                                  NEW: runs LAST
```

The new pass runs as the **final** ASM-IL optimization pass at all levels ≥ O1. It ensures no conditional branch targets are out of range before the ACME emitter.

## Implementation Details

### New File: `long-branch-expansion.ts`

```typescript
/**
 * Long-Branch Expansion Pass
 *
 * Detects conditional branches whose targets may exceed the 6502's
 * ±127 byte range and expands them into an inverted-branch + JMP pattern.
 *
 * Transformation:
 *   BCS .far_label  →  BCC .skip_long_N
 *                       JMP .far_label
 *                       .skip_long_N:
 *
 * This pass MUST run LAST (after branch-opt) to avoid conflicts with
 * branch-opt's Pattern 3 which does the inverse transformation.
 */
export class LongBranchExpansionPass implements AsmOptimizationPass {
  readonly name = 'long-branch-expansion';
  readonly isTransform = true;

  run(program: AsmILProgram): AsmOptimizationPassResult { ... }
}
```

### Constants

```typescript
/** All conditional branch mnemonics */
const CONDITIONAL_BRANCHES = new Set([
  'BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS',
]);

/** Branch inversion mapping (same as branch-opt.ts) */
const BRANCH_INVERSIONS: Record<string, string> = {
  BCC: 'BCS', BCS: 'BCC',
  BEQ: 'BNE', BNE: 'BEQ',
  BMI: 'BPL', BPL: 'BMI',
  BVC: 'BVS', BVS: 'BVC',
};

/**
 * Byte-distance threshold for expansion.
 * Branches with estimated distance > this are expanded.
 * Set well below 127 to account for estimation inaccuracy.
 */
const LONG_BRANCH_THRESHOLD = 100;
```

### Core Algorithm

```
For each section in the program:
  1. Build a label position map: label_name → element_index
  2. For each element in the section:
     a. If it's a conditional branch with a label operand:
        - Find the target label's element index
        - Count instruction elements between branch and target
        - Estimate byte distance = instruction_count × 2 (conservative avg)
        - If estimated distance > LONG_BRANCH_THRESHOLD:
          * Replace the branch with 3 elements:
            - Inverted branch to a new skip label
            - JMP to the original target
            - The skip label definition
```

### Byte Distance Estimation

The pass uses a simple, conservative estimation:

```typescript
protected estimateByteDistance(
  elements: readonly AsmILElement[],
  fromIndex: number,
  toIndex: number
): number {
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  let bytes = 0;

  for (let i = start; i < end; i++) {
    const el = elements[i];
    if (isInstructionElement(el)) {
      // Most 6502 instructions are 2-3 bytes. Use 2 as conservative estimate.
      // This underestimates, which is SAFE: we expand more aggressively,
      // never missing a genuine out-of-range branch.
      bytes += 2;
    }
    // Labels, comments, and blanks contribute 0 bytes
  }

  return bytes;
}
```

**Why 2 bytes per instruction is safe:**
- If the real average is 2.5 bytes, our estimate of 200 for 100 instructions underestimates the true 250 bytes
- This means we might expand a branch that's actually at 120 real bytes (estimated as 80), but we'd never MISS one at 140 real bytes (estimated as ~95, still might be under threshold)
- Actually wait — 2 bytes UNDERESTIMATES, which means some real distances of 130+ bytes could estimate as only 90 bytes and NOT be expanded
- Better approach: use the ACTUAL addressing mode to calculate more accurately

**Revised approach — per-mode estimation:**

```typescript
protected estimateInstructionBytes(instr: AsmInstruction): number {
  switch (instr.mode) {
    case AsmAddressingMode.Implied:
    case AsmAddressingMode.Accumulator:
      return 1;
    case AsmAddressingMode.Immediate:
    case AsmAddressingMode.ZeroPage:
    case AsmAddressingMode.ZeroPageX:
    case AsmAddressingMode.ZeroPageY:
    case AsmAddressingMode.Relative:
    case AsmAddressingMode.IndexedIndirect:
    case AsmAddressingMode.IndirectIndexed:
      return 2;
    case AsmAddressingMode.Absolute:
    case AsmAddressingMode.AbsoluteX:
    case AsmAddressingMode.AbsoluteY:
    case AsmAddressingMode.Indirect:
      return 3;
    default:
      return 3; // Worst case: assume 3 bytes for unknown
  }
}
```

**With per-mode estimation, the distance calculation is accurate to ±1 byte** (only uncertainty is label-operand instructions where we don't know if the assembler resolves to ZP or Absolute). Using 3 bytes for Absolute/label-operand modes is the safe overestimate.

### Unique Label Generation

```typescript
protected labelCounter = 0;

protected uniqueSkipLabel(): string {
  return `.skip_long_${this.labelCounter++}`;
}
```

The counter resets per `run()` invocation. Labels are section-local (prefixed with `.`), so no cross-section collision.

### Integration Points

**Pass Factory (`pass-factory.ts`):**
```typescript
// Add as LAST pass for all O1+ levels:
// After all other passes in the array
passes.push(new LongBranchExpansionPass());
return passes;
```

**Pass Exports (`passes/index.ts`):**
```typescript
export { LongBranchExpansionPass } from './long-branch-expansion.js';
```

## Error Handling

| Error Case | Handling Strategy |
|-----------|-------------------|
| Branch target label not found in section | Skip expansion (target may be in another section — rare but possible) |
| Branch to self (zero distance) | Skip expansion (always within range) |
| Backward branch exceeding range | Same expansion pattern (works for both directions) |

## Testing Requirements

- Unit tests for each of the 8 branch types (BCS, BCC, BEQ, BNE, BMI, BPL, BVC, BVS)
- Unit tests verifying short branches are NOT expanded
- Unit tests verifying long branches ARE expanded with correct inversion
- Integration test: compile armenian-charset at O2 and O3 and verify ACME succeeds
- E2E test: large for-loop body that triggers expansion

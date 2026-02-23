# Loop Unroller Fixes: L1-L3, O1, O2

> **Document**: 04-loop-unroller.md
> **Parent**: [Index](00-index.md)
> **Priority**: P1 — O2/O3 produce corrupt or un-assemblable code

## Overview

The loop unroller has 5 interrelated bugs. The root causes are:
1. Body extraction includes counter increments that are also duplicated separately (L1)
2. Cloned instructions don't get unique labels (L2)
3. BARRIER opcode not checked during eligibility analysis (O1)
4. Flag clobbering is a symptom of L1 (O2)
5. Missing exit conditions are a symptom of L1/body extraction (L3)

## Safety-First Approach

**Step 1**: Add a BARRIER check to reject loops containing `barrier()` from unrolling.
This is a one-line safety guard that prevents the most dangerous optimizer bug (O1).

**Step 2**: Fix `extractBodyInstructions()` to exclude counter increments (L1).
Remove the separate `findCounterIncrements()` duplication in partial unrolling.

**Step 3**: Fix `cloneInstructions()` to remap labels with unique copy index (L2).

These three fixes address all 5 bugs (L1, L2, L3, O1, O2).

---

## Bug O1: barrier() Must Block Unrolling

### File: `analysis.ts`, method `analyzeCandidate()`

**Fix**: After extracting body instructions, scan for BARRIER opcode. If found, return null.

```typescript
// In analyzeCandidate(), after extractBodyInstructions():
const bodyInstructions = this.extractBodyInstructions(func, headerIdx, exitIdx);

// NEW: Reject loops containing BARRIER — the barrier() intrinsic
// explicitly prevents optimization across its boundary
const containsBarrier = bodyInstructions.some(
  instr => instr.opcode === ILOpcode.BARRIER
);
if (containsBarrier) {
  return null;  // Loop body has optimization barrier — do not unroll
}
```

---

## Bug L1: Fix Body Extraction (Triple Increment)

### File: `base.ts`, method `extractBodyInstructions()`

**Root Cause**: The current extraction includes counter increment instructions
(INC_BYTE/DEC_BYTE on the counter slot) in the body. Then `performPartialUnroll()`
also finds and duplicates counter increments via `findCounterIncrements()`.
Result: body has 1 increment + partial unroll adds 1 more per copy = 3 total.

**Fix Strategy**: Exclude counter increment/decrement instructions from the extracted
body. The partial unroller already handles counter increments separately.

**Implementation**: `extractBodyInstructions()` needs to know the counter slot.
Pass the loop's `counterSlot` (from ILLoop metadata) and filter out INC/DEC on it.

```typescript
protected extractBodyInstructions(
  func: ILFunction,
  headerIdx: number,
  exitIdx: number,
  counterSlot?: FrameSlot  // NEW parameter
): ILInstruction[] {
  const body: ILInstruction[] = [];
  const counterName = counterSlot?.name;

  for (let i = headerIdx + 1; i < exitIdx; i++) {
    const instr = func.instructions[i];

    // Skip back-edge JUMP
    if (this.isBackEdgeJump(instr, func, headerIdx)) continue;

    // Skip exit branches
    if (this.isExitBranch(instr, func, exitIdx)) continue;

    // NEW: Skip counter increment/decrement (handled separately by partial unroll)
    if (counterName && this.isCounterModification(instr, counterName)) continue;

    // NEW: Skip termination check (LOAD counter + CMP)
    if (counterName && this.isTerminationCheck(instr, counterName)) continue;

    body.push(instr);
  }

  return body;
}
```

Also add helper methods:

```typescript
protected isCounterModification(instr: ILInstruction, counterName: string): boolean {
  if (instr.opcode !== ILOpcode.INC_BYTE && instr.opcode !== ILOpcode.DEC_BYTE &&
      instr.opcode !== ILOpcode.INC_WORD && instr.opcode !== ILOpcode.DEC_WORD) {
    return false;
  }
  return instr.defUse?.defs.includes(counterName) ?? false;
}

protected isTerminationCheck(instr: ILInstruction, counterName: string): boolean {
  // LOAD_BYTE of counter or CMP_IMM/CMP_BYTE that uses counter
  if (instr.opcode === ILOpcode.LOAD_BYTE && instr.defUse?.uses.includes(counterName)) {
    return true;
  }
  if (this.isComparison(instr) && instr.defUse?.uses.includes(counterName)) {
    return true;
  }
  return false;
}
```

**Update callers**: `performFullUnroll()` and `performPartialUnroll()` must pass
the counter slot from `candidate.loop.loop.counterSlot`.

---

## Bug L2: Fix Label Duplication in Cloned Bodies

### File: `base.ts`, method `cloneInstructions()`

**Root Cause**: `cloneInstructions()` copies label operands as-is. When multiple
copies are created for unrolling, all copies share the same label names.

**Fix**: Add a copy index parameter and remap all label operands.

```typescript
protected cloneInstructions(instructions: ILInstruction[], copyIndex?: number): ILInstruction[] {
  if (copyIndex === undefined) {
    // No remapping needed (single copy)
    return instructions.map(instr => this.cloneInstruction(instr));
  }

  // Collect all labels defined in this instruction set
  const definedLabels = new Set<string>();
  for (const instr of instructions) {
    if (instr.opcode === ILOpcode.LABEL && instr.operands.length > 0) {
      const labelOp = instr.operands[0] as LabelOperand;
      definedLabels.add(labelOp.name);
    }
  }

  // Clone with label remapping
  const suffix = `_u${copyIndex}`;
  return instructions.map(instr => {
    const cloned = this.cloneInstruction(instr);
    // Remap label operands that reference locally-defined labels
    cloned.operands = cloned.operands.map(op => {
      if (isLabelOperand(op) && definedLabels.has(op.name)) {
        return { ...op, name: op.name + suffix };
      }
      return op;
    });
    return cloned;
  });
}
```

**Update callers**: `performFullUnroll()` and `performPartialUnroll()` pass
the copy index `i` when calling `cloneInstructions(body, i)`.

---

## Bug L3 & O2: Auto-Fixed

- **L3** (outer loop unrolled without exits): Fixed by correcting body extraction in L1.
  Once counter increments and termination checks are excluded from the body,
  full unrolling only duplicates the actual work instructions.

- **O2** (stale CMP flags): Fixed by correcting body extraction in L1.
  Once counter increments aren't duplicated inside the body, there are no
  INC instructions between CMP and BCS.

## Testing

- Unit test: Loop with `barrier()` is NOT unrolled
- Unit test: Partial unroll of `for i = 0 to 5` produces 1 increment per copy, not 3
- Unit test: Full unroll of `for i = 0 to 3` produces no duplicate labels
- Integration test: compile spinning-line at O2, verify clean loop structure
- Integration test: compile spinning-line at O3, verify no duplicate labels

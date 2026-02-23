# Inlining Fixes: I1-I4

> **Document**: 05-inlining.md
> **Parent**: [Index](00-index.md)
> **Priority**: P2 (I3, I4, I1) + P3 (I2)

## Overview

Four bugs in the inlining pipeline affect O1-O3 output. Two are critical
(ghost instructions, missing CLC), one is medium (dead code not removed),
and one is low (redundant JMP).

**Important**: Bug I3 (ghost instructions) may partially auto-resolve when
Bug C1 (multi-arg passing) is fixed, because the ghost `CLC; ADC $02`
instructions may originate from the never-executed second-argument code path.
This must be verified after Phase 1 (core codegen fixes) before implementing
a separate fix.

---

## Bug I3: Ghost Instructions After Inline

### Investigation Required

After fixing C1 (multi-arg passing), recompile spinning-line at O2 and check
whether ghost instructions still appear. The ghost `CLC; ADC $02` may be
IL instructions generated for the second argument that the inliner incorrectly
places after the inline body.

**If ghost instructions persist**: The inlining pass's `cloneInstructions()`
or `inlineFunction()` is including instructions from after the CALL site in
the inlined body. Debug by dumping IL before and after the inlining pass.

**If ghost instructions disappear**: Mark as resolved by C1 fix. No separate
fix needed.

---

## Bug I4: Missing CLC Before ADC in Inlined Code

### Investigation Required

The CLC instruction before ADC in `lo()` intrinsic code is being removed by
an optimizer pass. After Phase 1 and Phase 2 fixes, check if this still occurs.

**Likely root cause**: The `il-peephole` pass or `dce` pass considers CLC
"dead" because it only modifies the carry flag and the pass doesn't track
flag liveness. On the 6502, CLC is semantically required before ADC.

**Fix Strategy** (if still present after Phase 1+2):

1. Check `il-peephole.ts` for rules that might remove CLC
2. Check if DCE considers CLC dead (no subsequent read of carry flag)
3. Add CLC to the "side-effecting" instruction list so DCE never removes it

The IL opcode for CLC is part of an ASM_RAW or ADD_BYTE instruction sequence.
If it's emitted as part of ADD_BYTE (CLC + ADC), the optimizer should never
split or remove the CLC from the ADC.

---

## Bug I1: Inlined Functions Still Emitted as Dead Code

### Root Cause Analysis

The pass sequence at O1+ is:
```
dead-function-elim → function-inline → dead-function-elim
```

The second `dead-function-elim` should detect that fully-inlined functions
have zero callers and remove them. If it doesn't, possible issues:

1. The DFE pass's call graph is stale (doesn't reflect post-inlining state)
2. The DFE pass doesn't count inlined-away calls as "removed"
3. The function is marked as exported or callback (exempt from removal)

### Fix Strategy

1. Verify `dead-function-elim.ts` rebuilds the call graph from scratch
   (not reusing the pre-inlining graph)
2. Verify the fully-inlined function has `isExported: false` and
   `isCallback: false`
3. If DFE is working correctly, the bug may be that inlining doesn't
   remove the CALL instruction — it replaces it with the body but the
   original function still has references. Check that `inlineFunction()`
   in `function-inlining.ts` actually removes the CALL (it uses `splice`).

### Testing

- Unit test: After inlining a single-call-site function, DFE removes it
- Integration test: compile spinning-line at O1, verify no dead `delay:` label

---

## Bug I2: Redundant JMP to Next Instruction

### Root Cause

The inlining pass replaces RETURN with `JUMP contLabel`, then places
`LABEL contLabel` immediately after. When RETURN is the last callee
instruction, this creates a JMP to the very next instruction.

### Fix Strategy

Add a post-inlining peephole in `inlineFunction()` or in `il-peephole.ts`:

**Option A** (in inliner — simpler):
After building the replacement sequence, scan for JUMP immediately followed
by LABEL with the same name. Remove the JUMP.

**Option B** (in il-peephole — more general):
Add a peephole rule: if `JUMP label` is immediately followed by `LABEL label`,
remove the JUMP. This catches all cases, not just inlining.

**Recommended**: Option B — more general, catches other sources of redundant JMPs.

```typescript
// In il-peephole.ts, add rule:
// JUMP label + LABEL label → just LABEL label
if (instr.opcode === ILOpcode.JUMP && nextInstr.opcode === ILOpcode.LABEL) {
  if (isLabelOperand(instr.operands[0]) && isLabelOperand(nextInstr.operands[0])) {
    if (instr.operands[0].name === nextInstr.operands[0].name) {
      // Remove the redundant JUMP
      markForRemoval(i);
    }
  }
}
```

### Testing

- Unit test: JUMP followed by same LABEL is removed by peephole
- Integration test: compile spinning-line at O1, verify no `JMP ._inline_*_cont` before its label

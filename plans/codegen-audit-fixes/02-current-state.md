# Current State: Codegen Audit Fixes

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### Architecture Overview

The compiler pipeline is: Source → Lexer → Parser → AST → Semantic → IL Generator → Optimizer → Codegen → ASM

The IL Generator uses an inheritance chain:
```
ILGeneratorBase → ILGeneratorExpressions → ILGeneratorControlFlow → ILGenerator
```

The Optimizer runs passes in this order per level:
- **Program-level** (on entire ILProgram): `dead-function-elim` → `dead-global-elim` → `function-inline` → `dead-function-elim`
- **Function-level** (per ILFunction): `dce` → `constant-fold` → `constant-prop` → `copy-prop` → `il-peephole` → `cse` → `licm` → `loop-unroll`

### Relevant Files

| File | Purpose | Bugs |
|------|---------|------|
| `il/generator/expressions.ts` | Expression IL generation, function call argument passing | C1, C3 |
| `il/generator/control-flow.ts` | If/while/for condition generation | C2 |
| `optimizer/passes/loop-unroll/base.ts` | Loop body extraction, instruction cloning | L1, L2, O2 |
| `optimizer/passes/loop-unroll/analysis.ts` | Unroll candidate detection | O1 |
| `optimizer/passes/loop-unroll/loop-unroll-pass.ts` | Full/partial unrolling execution | L1, L2, L3 |
| `optimizer/passes/function-inlining.ts` | Function body cloning at call sites | I1, I2, I3 |
| `optimizer/passes/dead-function-elim.ts` | Remove unused functions | I1 |
| `optimizer/passes/il-peephole.ts` | IL-level peephole optimizations | I4 |

## Root Cause Analysis

### Bug C1: Missing Multi-Argument Passing

**File**: `expressions.ts`, method `generateCallArguments()` (line ~590)

**Root Cause**: The method only processes `args[0]`. There is no loop over `args[1..N]`.

```typescript
protected generateCallArguments(funcName: string, args: Expression[]): void {
  if (args.length === 0) return;
  this.generateExpression(args[0]);  // ← Only first arg!
  // ... promotion logic for first param only
  // MISSING: args[1], args[2], etc.
}
```

**Fix Strategy**: After generating `args[0]` into A (or A:X), store it to the first param slot. Then for each subsequent arg, generate it into A and store to the corresponding param slot. The callee frame is available via `this.frameMap.get(funcName)`.

### Bug C2: Constant Identifier Not Resolved in Conditions

**File**: `control-flow.ts`, method `generateConditionWithBranch()` (line ~164)

**Root Cause**: The comparison handler has three branches for right operands:
1. `isLiteralExpression(right)` → `cmpImm(rightVal)` ✅
2. `isIdentifierExpression(right)` → `tryResolveVariable()` → `cmpSlot(slot)` ❌ for constants
3. Complex right → fallback ✅

Branch 2 calls `tryResolveVariable()` which returns a slot with address `$FFFF` for constants instead of recognizing them as compile-time values. It NEVER calls `tryResolveConstantIdentifier()`.

**Fix Strategy**: In branch 2, before falling through to slot comparison, call `tryResolveConstantIdentifier(right)`. If it returns a value, use `cmpImm(constValue)` instead of `cmpSlot(slot)`. This is the same pattern already used in `generateBinary()`.

### Bug C3: Function Reads Wrong ZP

**Root Cause**: Direct consequence of C1. The caller never stores the second argument to the parameter slot, so the callee reads whatever was at that ZP address from boot.

**Fix**: Auto-resolves when C1 is fixed.

### Bug I1: Inlined Functions Still Emitted

**Root Cause**: The `dead-function-elim` pass runs AFTER `function-inline` in the program-level pass sequence. It should detect that a function is no longer called and remove it. Need to verify this pass correctly identifies fully-inlined functions.

**Possible Issue**: The DFE pass may not re-scan call references after inlining, or the call graph may be stale.

### Bug I2: Redundant JMP to Next Instruction

**Root Cause**: The inlining pass replaces `RETURN` with `JUMP contLabel`, then places `contLabel` immediately after. When RETURN is the last instruction, this creates `JMP label` followed by `label:`. The il-peephole pass should catch this but may not have a rule for it.

### Bug I3: Ghost Instructions After Inline

**Root Cause**: Likely related to how the IL generator handles the second argument of the `getSpriteFrame` call. When the function is inlined at O2+, the argument generation IL (for the missing second arg from Bug C1) may be placed at the wrong location — after the inline body instead of before it.

**Investigation needed**: Dump IL before and after inlining to see where ghost instructions originate.

### Bug I4: Missing CLC Before ADC

**Root Cause**: An optimizer pass (likely `il-peephole` or `dce`) incorrectly removes the CLC instruction before ADC. On the 6502, CLC is required before ADC to ensure correct arithmetic. The optimizer likely thinks CLC is a "dead" instruction because it only modifies the carry flag and the pass doesn't understand flag dependencies.

**Investigation needed**: Check if `il-peephole.ts` has a rule that removes CLC, or if DCE considers CLC dead.

### Bug L1: Corrupted Loop Unrolling (Triple Increment)

**Root Cause**: `extractBodyInstructions()` in `base.ts` extracts the body between header and exit labels, filtering out back-edge JUMPs and exit branches. However, the counter increment instructions (INC_BYTE) are included in the extracted body. Then `performPartialUnroll()` separately duplicates counter increments via `findCounterIncrements()`. This double-inclusion causes the increment to appear 3x per iteration (1 from body + 2 from separate counter duplication).

**Fix Strategy**: Either exclude counter increments from `extractBodyInstructions()`, OR remove the separate `findCounterIncrements()` duplication. The cleaner approach is to exclude the counter increment/decrement and termination check from the body extraction and handle them separately.

### Bug L2: Duplicate Labels from Unrolling

**Root Cause**: `cloneInstructions()` in `base.ts` does a shallow copy — it copies label operands as-is without remapping. Unlike the function inlining pass (which has `cloneInstruction()` with prefix remapping), the loop unroller's clone is name-preserving. When multiple copies are created, all copies share the same label names → duplicate labels.

**Fix Strategy**: Add a unique prefix to labels in each unrolled copy, similar to how `function-inlining.ts` does it. Each copy needs labels like `.for2_copy0`, `.for2_copy1`, etc.

### Bug L3: Outer Loop Unrolled Without Exit Conditions

**Root Cause**: Full unrolling removes the loop structure entirely (header, condition check, back-edge). It only duplicates the "body instructions" N times. The CMP + branch to exit is correctly removed (it's not needed when the exact iteration count is known). However, the issue is that the extracted body is wrong — it includes too much or too little of the loop content.

**Fix Strategy**: This is a consequence of the body extraction issues in L1. Fixing L1's body extraction will also fix L3.

### Bug O1: barrier() Not Respected by Unroller

**Root Cause**: `analyzeCandidate()` in `analysis.ts` checks `isCountedLoop`, `boundValue`, and body size. It never checks whether the loop body contains a BARRIER opcode. The BARRIER instruction should make the loop ineligible for unrolling.

**Fix Strategy**: Add a check in `analyzeCandidate()` or `extractBodyInstructions()` that rejects loops containing BARRIER opcodes.

### Bug O2: Stale CMP Flags After Instruction Reordering

**Root Cause**: This is a consequence of the corrupted unrolling (L1). The extra INC instructions between CMP and BCS cause flag clobbering. Fixing L1 will prevent the wrong instruction ordering.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| C1 fix changes arg passing ABI | Medium | High | Use ZP parameter slots (not stack); match callee prologue expectations |
| Loop unroller fix causes new regressions | Medium | Medium | Disable unroller first, re-enable with fixes, compare output |
| Inlining ghost instructions hard to trace | Low | Medium | Dump IL before/after inlining to identify source |
| Existing tests depend on buggy behavior | Low | Low | Run full test suite after each change |

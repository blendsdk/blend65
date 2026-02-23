# Current State: Spinning-Line Diagnostic Fixes

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### Optimization Pipeline Overview

The Blend65 compiler has a two-level optimization pipeline:

1. **IL Optimizer** (`packages/compiler/src/optimizer/`) — Operates on IL (intermediate language) instructions
2. **ASM-IL Optimizer** (`packages/compiler/src/codegen/asm-il/optimizer/`) — Operates on generated 6502 assembly

### Relevant Files

| File | Purpose | Bug |
|------|---------|-----|
| `packages/compiler/src/il/analysis.ts` | Liveness analysis + `isDeadStore()` | Bug #1 |
| `packages/compiler/src/optimizer/passes/dce.ts` | Dead Code Elimination pass | Bug #1 |
| `packages/compiler/src/optimizer/passes/function-inlining.ts` | Function inlining pass | Bug #3 |
| `packages/compiler/src/optimizer/passes/il-peephole.ts` | IL peephole optimizer | Bug #3 |
| `packages/compiler/src/codegen/asm-il/optimizer/passes/store-load.ts` | Store-load elimination | Bug #2 |
| `packages/compiler/src/codegen/generator/functions.ts` | Function code generation | Bug #2 |

## Root Cause Analysis

### Bug #1: DCE Removes Parameter Stores

**Flow:**

1. IL generator emits `STORE_BYTE` to parameter slot (e.g., `frameIndex`) before `CALL getSpriteFrame`
2. DCE pass calls `computeLiveRanges()` which performs **intra-function** backward dataflow analysis
3. `isDeadStore()` checks if the stored variable name is in `liveOut`
4. The CALL instruction's `defUse.uses` does NOT include parameter slot names
5. Therefore, liveness does not propagate backward from CALL to the STORE — the store appears dead
6. DCE removes the STORE, breaking the parameter passing

**Key code in `isDeadStore()`:**
```typescript
export function isDeadStore(instr: ILInstruction): boolean {
  // Only check store instructions
  if (instr.opcode !== ILOpcode.STORE_BYTE && instr.opcode !== ILOpcode.STORE_WORD) {
    return false;
  }
  const varName = (operand as SlotOperand).slot.name;
  // If variable is not live after this store, it's dead!
  if (!instr.liveOut) return false;
  return !instr.liveOut.has(varName);
}
```

**Why it manifests at O1/Os/Oz but NOT O2/O3:**
- At O1: `delay()` is inlined (single call site), `getSpriteFrame` is NOT inlined (2 call sites). DCE runs and removes the parameter store because the use is in the callee.
- At O2/O3: Both functions are inlined. When `getSpriteFrame` is inlined, its body (including the `LOAD_BYTE` of the parameter) is placed directly in `main`. The inliner preserves parameter slot names (does NOT remap them), so the LOAD creates a USE in the caller, making the preceding STORE live.
- At Os/Oz: No inlining at all (`getSpriteFrame` is called via CALL). DCE sees the store as dead.

**Fix strategy:** Ensure CALL instructions include parameter slot names in their `defUse.uses`. This way, `computeLiveRanges()` will see that the parameter slot is used at the CALL point, keeping the preceding store alive.

### Bug #2: Redundant Store/Reload

**Flow:**

1. Code generator emits parameter receiving code: `STA $07; STX $08` (store word param to slots)
2. Code generator then emits parameter load code: `LDA $07; LDX $08` (load word param from slots)
3. The ASM-IL StoreLoadPass SHOULD eliminate the redundant loads
4. However, the pattern persists at all optimization levels

**Investigation needed:** The `StoreLoadPass` handles exactly this pattern (`STA addr / LDA addr` → remove `LDA`). The pass runs at O1+. The backward scan from `LDA $07` should find `STA $07` (with only `STX $08` between them, which doesn't modify A or address $07). **The pass should work but currently doesn't.** Possible causes:
- Labels between store and load that break backward scanning
- The instructions may not have matching addressing modes or operands at the ASM-IL level
- The pass may not be reaching this code section

**Fix strategy:** Debug why StoreLoadPass misses this pattern. Likely a small fix (label placement, operand format, or section structure issue).

### Bug #3: JMP-to-Next-Instruction

**Flow:**

1. Function inlining replaces `RETURN` with `JUMP` to continuation label
2. `replaceReturnsWithJump()` always emits the JUMP, even when RETURN is the last instruction
3. At O2+, `il-peephole` removes JUMP-to-next patterns
4. At O1, `il-peephole` does NOT run (only `dce` and `constant-fold`)

**Why it manifests only at O1:**
- O1 function passes: `dce`, `constant-fold` — no `il-peephole`
- O2+ function passes include `il-peephole` which catches this pattern

**Fix strategy (two options):**
1. **Option A (preferred):** Fix the inliner to detect when RETURN is the last instruction and skip the JUMP emission entirely
2. **Option B:** Enable a lightweight JMP-to-next cleanup at O1 (either in DCE or as a mini-pass after inlining)

Option A is preferred because it prevents the JMP from being emitted in the first place, rather than generating it and cleaning it up later.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bug #1 fix causes parameter slots to be marked as always-live, reducing DCE effectiveness | Medium | Medium | Only mark parameter slots as uses on CALL instructions, not globally |
| Bug #2 investigation reveals deeper codegen issue | Low | Medium | If StoreLoadPass can't catch it, add codegen-level fix to avoid emitting redundant loads |
| Bug #3 fix in inliner introduces edge cases for multi-RETURN functions | Low | Low | Test with functions that have multiple return points |

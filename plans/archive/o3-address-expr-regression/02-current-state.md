# Current State: O3 Address-Expr Folding Regression

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Root Cause Analysis

### The IL Sequence After Inlining

When `getSpriteFrame(@lineFrames, frameIndex)` is inlined at O3, the IL is:

```
LOAD_IMM 0                    ; caller sets up frameIndex = 0
STORE_BYTE frameIndex_slot    ; store byte param
LOAD_ADDRESS lineFrames       ; caller sets up spriteAddr = @lineFrames
STORE_WORD spriteAddr_slot    ; store word param
LOAD_WORD spriteAddr_slot     ; callee body: read spriteAddr param
SHR_WORD 6                    ; callee body: >> 6
LO                            ; callee body: lo()
LOAD_BYTE frameIndex_slot     ; callee body: read frameIndex param
ADD_BYTE                      ; callee body: + frameIndex
LABEL _inline_getSpriteFrame_0_cont
```

### What Peephole Does (Step by Step)

The IL peephole pass runs patterns in order:

**Step 3 — `loadStoreElimination`:**

Sees `STORE_WORD spriteAddr; LOAD_WORD spriteAddr` (consecutive) → removes LOAD_WORD.

IL becomes:
```
LOAD_ADDRESS lineFrames       [i+0]
STORE_WORD spriteAddr_slot    [i+1]  ← DEAD (load was removed, but store remains)
SHR_WORD 6                    [i+2]
LO                            [i+3]
```

**Step 6 — `addressExprFolding`:**

Checks at position of LOAD_ADDRESS:
- **Direct pattern** `[i, i+1, i+2]`: Expects `LOAD_ADDRESS, SHR_WORD, LO` → `[i+1]` is STORE_WORD → **FAILS**
- **Gap pattern** `[i, i+1, i+2, i+3, i+4]`: Expects `LOAD_ADDRESS, STORE_WORD, LOAD_WORD, SHR_WORD, LO` → `[i+2]` is SHR_WORD not LOAD_WORD → **FAILS**

**Step 7 — `shrWordLoNarrowing`:**

Sees `SHR_WORD 6, LO` at `[i+2, i+3]` → converts to `SHR_WORD_LO 6` (shift-left technique, ~8 instructions in codegen).

### Why This Worked Before optimization-pass2

Before optimization-pass2, `shrWordLoNarrowing` **did not exist**. So:

1. **Iteration 1**: `SHR_WORD + LO` survived (no narrowing to catch it)
2. **Iteration 2**: DCE removed the dead `STORE_WORD` (its LOAD_WORD was removed in iteration 1)
3. **Iteration 2 peephole**: `addressExprFolding` now sees clean `LOAD_ADDRESS, SHR_WORD, LO` → matches direct pattern → `LOAD_ADDRESS_EXPR` → `LDA #(addr >> 6)` (2 bytes!)

After optimization-pass2, `shrWordLoNarrowing` catches `SHR_WORD+LO` on iteration 1. By iteration 2, there's no `SHR_WORD+LO` left for `addressExprFolding` to ever match.

## Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `optimizer/passes/il-peephole.ts` | Peephole optimizer | Add store-gap pattern + extend loadStoreElimination |
| `il/guards.ts` | IL instruction guards | Already has `isInlineContinuationLabel()` — reuse |
| `__tests__/optimizer/` | Optimizer tests | Add new pattern tests |

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Forward-scan misses a LOAD_WORD in complex code | Low | Critical (wrong code) | Conservative: skip optimization if uncertain |
| Pattern conflicts with future peephole additions | Low | Medium | Document pattern priority in code comments |
| Compile-time regression from forward scans | Very Low | Low | Bound scan distance (same as existing `findSlotConstant`) |

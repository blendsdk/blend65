# Post-Inlining Cleanup (Fixes 3, 4, 5)

> **Document**: 05-post-inline-cleanup.md
> **Parent**: [Index](00-index.md)

## Overview

After function inlining, several patterns of redundant code remain that existing passes don't fully handle. This document covers three related fixes that improve post-inlining code quality.

## Fix 3: Add IL Peephole to O1 Level

### Problem

At O1, `function-inline` runs (single-call-site strategy), but `il-peephole` does NOT run. This means:
- Inlined code has STORE_WORD/LOAD_WORD pairs from parameter passing
- The IL peephole's `loadStoreElimination` would catch these, but it's absent at O1
- Result: redundant `STA $07 / STX $08 / LDA $07 / LDX $08` in assembly

### Solution

Add `il-peephole` to O1 function-level passes in `options.ts`:

```typescript
// BEFORE:
O1: ['dce', 'constant-fold'],

// AFTER:
O1: ['dce', 'constant-fold', 'il-peephole'],
```

**Risk assessment:** Low. The IL peephole is safe — it only applies known-correct pattern transformations. Adding it to O1 gives O1 the same store/reload elimination that O2+ already benefits from.

**Also consider adding to O1s/O1z:**
```typescript
O1s: ['dce', 'constant-fold', 'il-peephole'],
O1z: ['dce', 'constant-fold', 'il-peephole'],
```

### Impact

At O1, spinning-line's inlined `getSpriteFrame` will no longer have redundant parameter store/reload. The 4-instruction pattern `STA/STX/LDA/LDX` (8 bytes, 12 cycles) is eliminated.

---

## Fix 4: Parameter Slot Forwarding (Copy Propagation)

### Problem

After inlining at O3, the caller's argument setup stores to param slots, and the inlined body reads from those same slots. When the source value is a local variable that's still live:

```
LOAD_BYTE frame       ; load frame counter
STORE_BYTE $02        ; store to param slot $02 (inlined arg)
...
ADD_BYTE $02          ; uses $02 instead of original 'frame' slot
```

Copy propagation should forward `$02 → frame` so the `ADD_BYTE $02` becomes `ADD_BYTE frame`, eliminating the need for the STORE_BYTE $02.

### Current Copy Propagation Behavior

The existing `copy-prop.ts` tracks LOAD/STORE pairs:
- When it sees `LOAD_BYTE src / STORE_BYTE dst`, it records `dst = copy of src`
- When it sees a USE of `dst`, it replaces with `src`

**Potential issue:** The copy-prop may not handle the pattern because:
1. The STORE_BYTE happens in the argument-setup region (before the inlined body)
2. An inline continuation LABEL may sit between the STORE and the USE
3. Labels kill the copy-prop state (control-flow boundary)

### Solution

Investigate the copy-prop pass to determine:
1. Does it already handle this pattern? (may need debug script to verify)
2. If labels kill the state, can we make inline continuation labels transparent?
3. If the pattern is already handled, is there a different reason the slot shuffle persists?

**Implementation approach:**
- First, create a debug script to dump the IL before and after copy-prop at O3
- If copy-prop doesn't fire, determine why (label boundary? different pattern?)
- Fix the specific blocker

**If labels are the issue:** Modify copy-prop to check if a label is an inline continuation label (`_inline_*_cont`) and NOT kill state for those labels. This is safe because inline continuation labels are only jumped to from within the same inlined body — they are sequencing labels, not external branch targets.

### Impact

Eliminates the `LOAD_BYTE frame / STORE_BYTE $02 / ... / ADD_BYTE $02` shuffle. The `ADD_BYTE` directly references the original slot, and DCE removes the dead STORE_BYTE.

---

## Fix 5: Constant Propagation Through Inlined Params

### Problem

After inlining at O3, when a constant is passed as an argument:

```
LOAD_IMM 0            ; constant 0 for first call's frameIndex param
STORE_BYTE $02        ; store to param slot $02
...
ADD_BYTE $02          ; adds 0 — should be eliminated
```

The constant-prop pass should detect that `$02 = 0` and replace `ADD_BYTE $02` with `ADD_IMM 0`. Then identity elimination removes `ADD_IMM 0`.

### Current Constant Propagation Behavior

The existing `constant-prop.ts`:
- Tracks LOAD_IMM+STORE pairs to know slot values
- Replaces LOAD_BYTE with LOAD_IMM when slot has known constant
- **Kills all knowledge at LABEL instructions** (control-flow boundary)

### Root Cause

After inlining, the code looks like:
```
LOAD_IMM 0
STORE_BYTE $02
LABEL _inline_getSpriteFrame_0_cont    ; ← kills $02 knowledge!
...
ADD_BYTE $02                            ; constant not propagated
```

The inline continuation label between the STORE and the USE kills the constant-prop state.

### Solution

Same fix as Fix 4 — make inline continuation labels transparent to constant-prop:

```typescript
// In constant-prop.ts, where labels kill state:
if (instr.opcode === ILOpcode.LABEL) {
  const labelName = getLabelName(instr);
  // Inline continuation labels are sequencing-only — don't kill state
  if (labelName && labelName.includes('_inline_') && labelName.endsWith('_cont')) {
    // Skip — this label is not a real control-flow merge point
    continue;
  }
  // All other labels: kill known-constant state
  knownConstants.clear();
}
```

**Safety justification:**
- Inline continuation labels are ONLY jumped to from within the same inlined body
- They are placed at the end of the inlined body, immediately after RETURN→JUMP replacement
- No code from outside the inlined body jumps to these labels
- Therefore, any constant known before the label is still valid after it

### Impact

For spinning-line O3, the first call to `getSpriteFrame` passes `frameIndex = 0`. After this fix:
1. `STORE_BYTE $02` records `$02 = 0`
2. Knowledge survives through inline continuation label
3. `ADD_BYTE $02` → `ADD_IMM 0` → eliminated by identity
4. Saves 7 bytes + 10 cycles (the entire `STA $02` + `ADC $02` chain)

---

## Combined Effect

When all three fixes are applied together:

| Bug | Fix | Savings per Occurrence |
|-----|-----|----------------------|
| #1 (store/reload at O1) | Fix 3 (il-peephole at O1) | 8 bytes, 12 cycles |
| #2 (dead stores at O2) | Already handled by il-peephole at O2 | — |
| #4 (add constant 0) | Fix 5 (const-prop through labels) | 7 bytes, 10 cycles |
| #5 (param slot shuffle) | Fix 4 (copy-prop through labels) | 2 bytes, 3 cycles per use |

## Testing Requirements

### Fix 3 Tests
- Verify il-peephole runs at O1 (check pass execution log)
- Compile spinning-line at O1 and verify no STORE_WORD/LOAD_WORD pairs in output
- Regression test: all O1 tests still pass

### Fix 4 Tests
- Unit test: copy-prop forwards param slot when no intervening label
- Unit test: copy-prop forwards param slot through inline continuation label
- Unit test: copy-prop does NOT forward through regular labels (safety)
- Integration test: spinning-line O3 uses original slot instead of param slot

### Fix 5 Tests
- Unit test: const-prop propagates through inline continuation label
- Unit test: const-prop does NOT propagate through regular labels (safety)
- Integration test: spinning-line O3 eliminates ADD_IMM 0 after const-prop
- End-to-end test: spinning-line O3 PRG size decreases

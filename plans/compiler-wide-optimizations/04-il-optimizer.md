# IL Optimizer Improvements (Themes A, C, G, J)

> **Document**: 04-il-optimizer.md
> **Parent**: [Index](00-index.md)
> **Applies to**: O1+ optimization levels

## Overview

Four IL-level optimizations to add to `ILPeepholePass` or as new IL passes. All operate on the IL instruction stream after inlining has occurred.

---

## Theme A: Label Arithmetic Folding Post-Inlining

### Pattern to Detect (IL level)

After inlining `getSpriteFrame(@lineFrames, frame)`, the IL contains:
```
LOAD_ADDRESS slot:lineFrames      ; loads label address into A:X
STORE_WORD slot:spriteAddr        ; store to param slot ($07/$08)
LOAD_WORD slot:spriteAddr         ; reload from param slot ← REDUNDANT (Theme F fixes this)
SHR_WORD 6                        ; 16-bit shift right by 6
LO                                ; narrow to low byte
```

### Optimization

When LOAD_ADDRESS flows (possibly through store/load pair) into SHR_WORD N:
- Replace entire sequence with `LOAD_ADDRESS_EXPR slot, N`
- This emits `LDA #(label >> N)` — 2 bytes, 2 cycles

### Implementation Location

**File**: `packages/compiler/src/optimizer/passes/il-peephole.ts`

Add new method `addressExprFolding()` that scans for:
1. `LOAD_ADDRESS slot` at position i
2. Optional `STORE_WORD + LOAD_WORD` pair (same slot) — skip over them
3. `SHR_WORD N` or sequence indicating division by power-of-2
4. Optional `LO` (narrowing to byte)

Replace positions i through end with single `LOAD_ADDRESS_EXPR`.

### Preconditions
- Slot between LOAD_ADDRESS and SHR_WORD must not be written to by other code
- Division must be by power-of-2
- Slot must have a data label (not a numeric address)

---

## Theme C: Power-of-2 Modulo → AND Bitmask

### Pattern to Detect (IL level)

```
ADD_IMM 1            ; increment
STORE_BYTE slot      ; store result
CMP_IMM N            ; compare with N (power of 2)
JUMP_NE label_skip   ; skip if not equal
LOAD_IMM 0           ; load zero
STORE_BYTE slot      ; reset to zero
LABEL label_skip     ; continuation
```

### Optimization

When N is a power of 2, replace entire pattern with:
```
ADD_IMM 1
AND_IMM (N-1)        ; bitmask wraps value to 0..N-1
STORE_BYTE slot
```

### Safety Check
- N must be a power of 2 (2, 4, 8, 16, 32, 64, 128, 256)
- The STORE_BYTE must target the same slot both times
- The JUMP_NE must target the LABEL immediately after the second STORE_BYTE
- **CRITICAL**: Must NOT apply when N is not power of 2 (e.g., mod 5)

### Implementation Location

**File**: `packages/compiler/src/optimizer/passes/il-peephole.ts`

Add new method `moduloToBitmask()` as a new pattern in the `run()` method.

---

## Theme G: SHR_WORD + LO Narrowing

### Pattern to Detect (IL level)

```
SHR_WORD N    ; 16-bit shift (produces A:X word)
LO            ; take only low byte (discard X)
```

### Optimization

When SHR_WORD is immediately followed by LO, the high byte of the shift result is discarded. For shift counts ≥ 8, the codegen can emit just `TXA` followed by byte-level LSR for the remainder, completely avoiding the 16-bit shift sequence.

Replace `SHR_WORD N + LO` with a new combined approach:
- Mark the SHR_WORD with metadata `narrowToLoByte: true`
- Codegen checks this flag and emits the optimized byte-only sequence

### Alternative: IL Rewrite

Replace `SHR_WORD N / LO` with:
- `HI` (take high byte, since shift by ≥8 means result comes from high byte)
- `SHR_BYTE (N-8)` (shift the remaining positions as byte)

For shift by 6 (N < 8), this doesn't simplify, so only apply for N ≥ 8.

### Implementation Location

**File**: `packages/compiler/src/optimizer/passes/il-peephole.ts`

---

## Theme J: Constant Propagation Through Inlined Arguments

### Pattern to Detect

After inlining `getSpriteFrame(@lineFrames, 0)`, the IL contains:
```
LOAD_IMM 0                    ; literal 0 argument
STORE_BYTE slot:frameIndex    ; store to param slot
...
ADD_BYTE slot:frameIndex      ; later: adds frameIndex (which is 0!)
```

### Optimization

The existing `ConstantPropPass` should handle this — it tracks `LOAD_IMM N / STORE_BYTE slot` and propagates N to later reads of slot. If it's not working post-inlining, investigate whether:
1. Inliner output has labels between store and use that break the scan
2. The constant prop pass runs before inlining (should run after too)

### Implementation

**Investigation first** — check pass ordering in `pass-manager.ts`. Ensure ConstantProp runs AFTER FunctionInlining. If already correct, investigate why the pattern isn't caught.

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/compiler/src/optimizer/passes/il-peephole.ts` | Add `addressExprFolding()`, `moduloToBitmask()`, and optional `shrWordNarrowing()` |
| `packages/compiler/src/optimizer/pass-manager.ts` | Verify pass ordering (ConstProp after Inlining) |

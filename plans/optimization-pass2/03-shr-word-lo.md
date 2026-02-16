# SHR_WORD+LO Shift-Left Technique (N=3-7)

> **Document**: 03-shr-word-lo.md
> **Parent**: [Index](00-index.md)

## Overview

When the IL sequence `SHR_WORD N` + `LO` appears (with N=3-7), the full 16-bit shift is wasteful because only the low byte of the result is used. The shift-left technique exploits the identity `lo(word >> N) = hi(word << (8-N))` to achieve the same result with far fewer instructions.

## Current Architecture

### Existing SHR_WORD+LO Narrowing (`shrWordLoNarrowing`)

The IL peephole already has Pattern 7 that matches SHR_WORD+LO:

```
SHR_WORD N    ; 16-bit shift right
LO            ; take low byte
```

**Current behavior:**
- N ≥ 8: Replaces with `HI` + `SHR_BYTE(N-8)` — takes high byte, shifts remaining
- N < 8: **No optimization** — falls through to full SHR_WORD codegen

### Current SHR_WORD Codegen (N=1-7)

For each shift position, emits 6 instructions:
```asm
PHA           ; save low byte (A)
TXA           ; high byte → A
LSR A         ; shift high byte right
TAX           ; save shifted high → X
PLA           ; restore low byte
ROR A         ; rotate carry into low byte (bits propagate high→low)
```

Cost for N=6: 6 × 6 = **36 bytes, ~90 cycles**

## Proposed Changes

### IL Peephole: Extend `shrWordLoNarrowing` for N=3-7

Extend the existing method to handle N=3-7 by replacing `SHR_WORD(N) + LO` with a new IL sequence that the codegen can emit efficiently.

**Two approaches:**

#### Approach A: New IL opcode `SHR_WORD_LO`

Add a new opcode `SHR_WORD_LO(N)` that means "shift word right by N, take low byte." The codegen emits the shift-left technique directly.

**Pro:** Clean separation of concerns, codegen has full context
**Con:** New opcode requires changes to enums, codegen dispatch, cost table

#### Approach B: Reuse existing opcodes with rewrite

Replace `SHR_WORD(N) + LO` with `SHL_WORD(8-N) + HI` where:
- `SHL_WORD(M)` is a new opcode for 16-bit shift left
- `HI` takes the high byte

This is mathematically equivalent but requires `SHL_WORD` which doesn't exist.

#### Approach C: Emit multi-instruction IL sequence (CHOSEN)

Replace `SHR_WORD(N) + LO` (2 instructions) with a sequence using existing opcodes that the codegen already handles. Specifically:

```
SWAP           ; Exchange A and X (low ↔ high byte) — equivalent to TXA effect
SHL_BYTE(8-N)  ; Shift left by (8-N) using existing codegen (ASL × (8-N))
```

Wait — this doesn't work because SHL_BYTE only operates on A (the low byte), but we need to shift bits FROM the original low byte INTO the high byte position.

**Actually, the correct IL-level approach is:**

Replace `SHR_WORD(N) + LO` with:
1. `HI` — move high byte (X) to accumulator (A) — this is TXA
2. `SHR_WORD_LO_SHIFT N` — new IL opcode that the codegen handles with the shift-left technique

But since we want to avoid too many new opcodes, the cleanest approach is **Approach A**: a single `SHR_WORD_LO` opcode.

### Chosen: Approach A — New `SHR_WORD_LO` Opcode

**IL Peephole transformation:**
```
BEFORE:                    AFTER:
  SHR_WORD N   (N=3-7)      SHR_WORD_LO N
  LO
```

**Codegen for `SHR_WORD_LO(N)` where N=3-7:**

The shift-left technique: `lo(word >> N) = hi(word << (8-N))`

```asm
; Input: A = low byte, X = high byte of 16-bit value
; Output: A = lo(word >> N)
; Method: Shift word LEFT by (8-N), then take high byte

  STA __tmp     ; save original low byte to temp ZP location
  TXA           ; high byte → A (we'll shift bits into this)
  ; Repeat (8-N) times:
  ASL __tmp     ; shift low byte left, MSB → carry
  ROL A         ; rotate carry into A from right, A's MSB → carry (discarded)
  ; After (8-N) rounds, A contains hi(word << (8-N)) = lo(word >> N)
```

**Cost analysis for each N:**

| N | Rounds (8-N) | Instructions | Bytes | Cycles | vs Current (6N) |
|---|-------------|-------------|-------|--------|-----------------|
| 3 | 5 | 2+5×2=12 | ~14 | ~25 | 18 instrs, ~21B (saves ~7B) |
| 4 | 4 | 2+4×2=10 | ~12 | ~21 | 24 instrs, ~27B (saves ~15B) |
| 5 | 3 | 2+3×2=8 | ~10 | ~17 | 30 instrs, ~33B (saves ~23B) |
| 6 | 2 | 2+2×2=6 | ~8 | ~13 | 36 instrs, ~39B (saves ~31B) |
| 7 | 1 | 2+1×2=4 | ~6 | ~9 | 42 instrs, ~45B (saves ~39B) |

**Spinning-line specific:** N=6, savings = ~31 bytes per occurrence × 2 call sites = ~62 bytes.

### Implementation Steps

#### Step 1: Add `SHR_WORD_LO` to IL enums

In `packages/compiler/src/il/enums.ts`:
- Add `SHR_WORD_LO = 'SHR_WORD_LO'` to `ILOpcode` enum
- Add cost entry: `{ cycles: 13, bytes: 8, memoryAccesses: 1 }` (approximate for N=6)

#### Step 2: Extend `shrWordLoNarrowing` in IL peephole

In `il-peephole.ts`, modify the method to also handle N=3-7:
- Current: `if (shiftCount < 8) continue;`
- New: Two branches:
  - N ≥ 8: existing HI + SHR_BYTE replacement
  - N = 3-7: new SHR_WORD_LO replacement

#### Step 3: Add codegen for `SHR_WORD_LO`

In `bitwise.ts`, add `genShrWordLo(instr)` method:
- Extract shift count N from immediate operand
- Emit: `STA __tmp / TXA / [ASL __tmp / ROL A] × (8-N)`
- The `__tmp` address needs to be a dedicated codegen temp — check if one exists

#### Step 4: Register dispatch

In `bitwise.ts`, add `SHR_WORD_LO` to the dispatch switch in `generateInstruction()`.

## Temp Variable Concern

The shift-left technique needs a temporary ZP location (`__tmp`). Options:
1. Use an existing unused ZP slot from the function's frame
2. Use a dedicated codegen temp register (check if one exists)
3. Use the stack (PHA/PLA) — but this makes the technique more expensive

**Preferred:** Check if the codegen already has a temporary ZP location. If not, allocate one from the frame's scratch area.

## Testing Requirements

- Unit tests for SHR_WORD_LO at N=3, 4, 5, 6, 7
- Verify each produces correct result for known input values
- Compare assembly output byte count: before vs after
- End-to-end test: spinning-line compile at O2 should be smaller
- Negative test: N=1, 2 should NOT trigger the optimization (not profitable)
- Negative test: SHR_WORD without following LO should NOT trigger

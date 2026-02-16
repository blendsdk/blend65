# Inliner Improvements (Theme F)

> **Document**: 06-inliner.md
> **Parent**: [Index](00-index.md)
> **Applies to**: O1+ optimization levels (wherever inlining is active)

## Overview

Every inlined function call produces a redundant store/reload sequence for each parameter. The value is already in A (or A:X for words) from the caller's argument generation, gets stored to the callee's parameter slot, then the inlined callee body immediately reloads it from the same slot. This wastes 4+ bytes and 6+ cycles per inlined parameter at every call site.

## The Problem

### Caller generates argument → stores to callee param slot:
```
; Caller side (generateCallArguments)
LOAD_IMM 0               ; generate argument value
STORE_BYTE slot:frameIndex  ; store to callee's param slot
```

### Inlined callee body starts by loading from param slot:
```
; Inlined callee body (first instruction of cloned body)
LOAD_BYTE slot:frameIndex   ; load parameter ← REDUNDANT!
```

### At the ASM level this becomes:
```asm
LDA #$00        ; argument value
STA $02          ; store to param slot
; [inlined body starts]
LDA $02          ; immediately reload ← WASTED
```

For word parameters it's even worse:
```asm
LDA #<label      ; low byte
LDX #>label      ; high byte
STA $07          ; store low
STX $08          ; store high
; [inlined body starts]
LDA $07          ; reload low ← WASTED
LDX $08          ; reload high ← WASTED
```

## Solution Options

### Option 1: IL Peephole (Recommended — simplest, safest)

Extend `loadStoreElimination()` in `ILPeepholePass` to handle:
1. **STORE_BYTE x → LOAD_BYTE x** (consecutive) — already handled ✅
2. **STORE_WORD x → LOAD_WORD x** (consecutive) — may not be handled, check
3. **STORE_BYTE x → [non-modifying instructions] → LOAD_BYTE x** — extend scan window

The key insight: after inlining, the store and load are usually consecutive or separated only by inline metadata comments. The IL peephole should catch these.

### Option 2: Inliner Splice Cleanup

During `inlineFunction()` in `function-inlining.ts`, after splicing:
1. Look at the last instructions before splice point (caller's arg stores)
2. Look at the first instructions of the inlined body (callee's param loads)
3. If they reference the same slots, remove the callee's loads

This is more targeted but requires modifying the inliner itself.

### Option 3: ASM-Level Store/Load Pass Enhancement

The existing `StoreLoadPass` should already catch `STA $07 / LDA $07`. Investigate why it doesn't. Possible reasons:
- `STX $08` between `STA $07` and `LDA $07` breaks the consecutive pattern
- The pass only checks strict adjacency

## Recommended Approach

**Try Option 1 first** (IL peephole extension) because:
- It's the simplest and safest change
- It works for both byte and word parameters
- It benefits any future optimization that creates store→load pairs
- It doesn't require modifying the inliner

**If that's insufficient**, add Option 2 as an inliner post-splice cleanup.

## Files to Modify

| File | Changes |
|------|---------|
| `packages/compiler/src/optimizer/passes/il-peephole.ts` | Extend `loadStoreElimination()` for STORE_WORD→LOAD_WORD and wider scan window |
| `packages/compiler/src/optimizer/passes/function-inlining.ts` | (Option 2) Add post-splice store/load cleanup |
| `packages/compiler/src/codegen/asm-il/optimizer/passes/store-load.ts` | (Option 3) Investigate why STA/LDA elimination misses this pattern |

# Block Copy Pattern Recognition — Research & Design

> **Document**: 08-block-copy-research.md
> **Parent**: [Index](00-index.md)
> **Item**: J — Block Copy Pattern Recognition
> **Status**: Research Complete — Ready for Implementation

## 1. The Pattern (Task 5.1.1)

### Source Pattern

The armenian-charset `copyCharset()` function copies 2048 bytes using a for-loop:

```js
function copyCharset(): void {
    for (let i: word = 0 to 2047) {
        poke(CHARSET_DEST + i, peek(@armenianFont + i));
    }
}
```

This is the **canonical block copy pattern**: `for (i = 0 to N) { poke(dst+i, peek(src+i)) }`.

### Current Compiler Output (O0)

The compiler generates ~30 bytes of code **per iteration** through Tier 3 indirect addressing:

```asm
; Per iteration:
  LDA #<src_base     ; 2B — load source base low
  LDX #>src_base     ; 2B — load source base high
  CLC / ADC i_lo     ; 3B — add loop counter to base (carry propagation)
  BCC +2 / INX       ; 4B — propagate carry to high byte
  STA $FB / STX $FC  ; 4B — store to ZP pointer
  LDY #0             ; 2B — Y=0 for indirect indexed
  LDA ($FB),Y        ; 2B — read source byte
  ; ... similar ~15B for destination address computation ...
  STA ($FB),Y        ; 2B — write destination byte
  ; Total body: ~30 bytes, ~60 cycles per iteration
```

For 2048 iterations: ~60 × 2048 = **~123,000 cycles** (over 1/10th of a PAL frame).

### Optimal 6502 Block Copy

The canonical page-based 6502 memory copy:

```asm
; Setup: 16 bytes
  LDA #<src           ; 2B — source low
  STA $FB             ; 2B — store to ZP ptr
  LDA #>src           ; 2B — source high
  STA $FC             ; 2B
  LDA #<dst           ; 2B — dest low
  STA $FD             ; 2B — store to ZP ptr
  LDA #>dst           ; 2B — dest high
  STA $FE             ; 2B
; Loop: 11 bytes
  LDX #8              ; 2B — 8 pages (2048/256)
  LDY #0              ; 2B — start at offset 0
.loop:
  LDA ($FB),Y         ; 2B — read source
  STA ($FD),Y         ; 2B — write dest
  INY                 ; 1B — next byte
  BNE .loop           ; 2B — inner loop (256 iterations)
; Page advance: 6 bytes (per page iteration)
  INC $FC             ; 2B — next source page
  INC $FE             ; 2B — next dest page
  DEX                 ; 1B — page counter
  BNE .loop           ; 2B — outer loop
; Total: ~27 bytes, ~2048 × 11 + 8 × 10 ≈ 22,608 cycles
```

**Savings**: 30 bytes → 27 bytes code, ~123,000 → ~22,600 cycles (**5.4× faster**).

## 2. Design Options Analysis (Task 5.1.2, 5.1.4)

### Option A: `memcpy()` Intrinsic

Add an explicit intrinsic function to the language:

```js
// Blend source — explicit call
memcpy(CHARSET_DEST, @armenianFont, 2048);
```

**Pros:**
- Explicit intent — programmer knows exactly what happens
- Simple to implement — no fragile pattern matching
- Reliable — always generates optimal code
- Predictable — no "did it optimize?" uncertainty
- Easy to test — one intrinsic function, one codegen handler

**Cons:**
- Requires language specification change (new intrinsic)
- Programmer must know to use it (vs automatic optimization)
- Doesn't optimize existing code without source changes

**Implementation effort:** ~100-150 lines
- Language spec update: add `memcpy` intrinsic
- IL: add `MEMCPY` opcode
- IL generator: handle `memcpy()` call → emit `MEMCPY`
- Codegen: `MEMCPY` → page-based copy assembly

### Option B: Automatic Pattern Recognition

Detect `for (i = 0 to N) { poke(dst+i, peek(src+i)) }` and rewrite:

**Pros:**
- Automatic — optimizes existing code without changes
- Transparent — programmer writes natural loops

**Cons:**
- Fragile pattern matching — many variations to handle:
  - `for` vs `while` loops
  - Counter type (byte vs word)
  - Start offset (0 vs non-zero)
  - Step size (1 vs other)
  - Ascending vs descending
  - Additional operations in loop body
  - Index expressions (`dst + i` vs `dst + i * 2`)
- Hard to verify correctness for all variations
- May have unexpected behavior when pattern partially matches
- Significantly more complex (~300-500 lines)

### Option C: Both (Intrinsic + Pattern Recognition)

**Recommended phased approach:**

1. **Phase 1 (this plan):** Implement `memcpy()` intrinsic — simple, reliable
2. **Phase 2 (future):** Add pattern recognition as optimizer pass — bonus optimization

### ✅ Decision: Option A — `memcpy()` Intrinsic

**Rationale:**
- Fits the Blend philosophy of explicit hardware control
- Consistent with existing intrinsics (`peek`, `poke`, `peekw`, `pokew`)
- Low implementation complexity
- High reliability
- Pattern recognition can be added later as an optimizer enhancement

## 3. Canonical 6502 Memcpy Lowering (Task 5.1.3)

### Copy Size Categories

| Category | Size | Strategy | Code Size |
|----------|------|----------|-----------|
| Tiny | 1-3 bytes | Unrolled inline LDA/STA | 4B per byte |
| Small | 4-15 bytes | Unrolled LDA abs / STA abs | 6B per byte |
| Medium | 16-255 bytes | Single-page Y-indexed loop | ~15 bytes |
| Large | 256+ bytes | Page-based nested loop | ~27 bytes |
| Page-aligned | Multiple of 256 | Page loop without remainder | ~25 bytes |

### Large Copy Template (Primary Target)

```asm
; memcpy(dst, src, count) where count > 255
; Input: src address, dst address, page count, remainder
;
; Uses ZP pointer pair: $FB/$FC (source), $FD/$FE (dest)

; --- Setup phase ---
  LDA #<src             ; source low byte
  STA $FB
  LDA #>src             ; source high byte
  STA $FC
  LDA #<dst             ; dest low byte
  STA $FD
  LDA #>dst             ; dest high byte
  STA $FE

; --- Full pages phase ---
  LDX #page_count       ; number of full 256-byte pages
  LDY #0                ; byte offset within page
.page_loop:
  LDA ($FB),Y           ; read source
  STA ($FD),Y           ; write dest
  INY                   ; next byte
  BNE .page_loop        ; loop within page (256 times)
  INC $FC               ; advance source page
  INC $FE               ; advance dest page
  DEX                   ; decrement page counter
  BNE .page_loop        ; next page

; --- Remainder phase (if count % 256 != 0) ---
  LDY #0
.rem_loop:
  LDA ($FB),Y
  STA ($FD),Y
  INY
  CPY #remainder        ; remaining bytes
  BNE .rem_loop
```

### Medium Copy Template (16-255 bytes)

```asm
; memcpy(dst, src, count) where count <= 255
; Simpler: single Y-indexed loop, no page advancing

  LDA #<src
  STA $FB
  LDA #>src
  STA $FC
  LDA #<dst
  STA $FD
  LDA #>dst
  STA $FE
  LDY #0
.loop:
  LDA ($FB),Y
  STA ($FD),Y
  INY
  CPY #count
  BNE .loop
```

### ZP Pointer Usage

The Blend65 codegen already uses `$FB/$FC` as a ZP pointer pair for indirect addressing. For `memcpy`, we need two pointer pairs:
- **$FB/$FC**: Source pointer (already used by PEEK_INDIRECT)
- **$FD/$FE**: Destination pointer (new — currently unused by codegen)

This is safe because `memcpy` is a self-contained operation that saves/restores no caller state.

## 4. Implementation Plan

### Language Specification

Add to `docs/language-specification-v2/08-intrinsics.md`:

```js
function memcpy(dest: word, src: word, count: word): void;
```

### IL Opcode

Add `MEMCPY` to `ILOpcode` enum:

```typescript
/**
 * Block memory copy: memcpy(dest, src, count).
 *
 * Copies `count` bytes from source to destination using optimal
 * page-based 6502 copy loop with ZP indirect addressing.
 *
 * Operands: [ImmediateOperand(count)]
 * Precondition: A:X = dest address, $FB/$FC = src address (or vice versa)
 * Effect: Copies count bytes from src to dest
 */
MEMCPY = 'MEMCPY',
```

### IL Generator

In `generateIntrinsicCall()`, handle `memcpy`:

```typescript
case 'memcpy':
  // args[0] = dest, args[1] = src, args[2] = count
  this.generateMemcpyIntrinsic(args[0], args[1], args[2]);
  break;
```

### Codegen

In control/memory generator, handle `MEMCPY`:

```typescript
protected genMemcpy(instr: ILInstruction): void {
  // Emit page-based or single-page copy based on count
}
```

### Files Changed

| File | Change |
|------|--------|
| `docs/language-specification-v2/08-intrinsics.md` | Add `memcpy` intrinsic spec |
| `il/enums.ts` | Add `MEMCPY` opcode |
| `il/builder/base.ts` | Add cost model for MEMCPY |
| `il/generator/expressions.ts` | Handle `memcpy()` in intrinsic dispatch |
| `codegen/generator/memory.ts` or `control.ts` | MEMCPY codegen |
| `optimizer/passes/licm/base.ts` | Mark MEMCPY as having side effects |
| `__tests__/il/` | IL generation tests |
| `__tests__/codegen/` | Codegen output tests |
| `__tests__/e2e/` | End-to-end memcpy tests |

### Estimated Effort

- Language spec: ~30 minutes
- IL + IL generator: ~1 hour
- Codegen: ~1 hour
- Tests: ~1 hour
- **Total: ~3.5 hours (2 sessions)**

## 5. Future Enhancements

After `memcpy()` intrinsic is working:

1. **Pattern recognition pass**: Detect `for + peek/poke` loops and suggest or auto-replace with `memcpy()`
2. **`memset()` intrinsic**: Fill memory with constant value (also very common on C64)
3. **`memcmp()` intrinsic**: Compare memory blocks
4. **DMA support**: For REU (RAM Expansion Unit) — hardware-accelerated copies

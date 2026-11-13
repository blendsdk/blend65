# Design — RD-08 Residual NMI Forms

> **Parent**: [Index](00-index.md)
> **Authority**: issue #150; frozen Specification 4.0; the unchanged NMI private-home proof
> **Updated**: 2026-11-13

## 1. Wide-word-mask join

### 1.1 Selection

A single-use `binary &` qualifies when:

- its result type is `word`;
- one operand is a compile-time constant mask `M` with `1 <= M <= 0xFFFF` and a nonzero high byte;
- the other operand is a byte-addressable word place (an empty-path `load`);
- its single consumer is a materialized `==`/`!=` whose other operand is the constant `0` or a
  single-bit mask `M`;
- the comparison result is single-use with an A consumer (byte store, constant-address byte memory
  write, or void return).

The selection records `{ form: "word", constant, mask, highMask, operand }` for the masked value.
The comparison result and the masked value join `forwardedRegisterValues`; no `retained-value`
request is created.

### 1.2 Lowering

A mask with exactly one selected bit in each byte is the branchless expert form. The byte with the
higher selected bit is shifted down to the other bit's position; `ORA` (any bit) or `AND` (both
bits) combines them, and a normalization shift yields 0/1:

```asm
        lda     W                ; low byte
        lsr                      ; bit 1 -> bit 0
        ora     W+1              ; high selected bit at bit 0
        and     #$01             ; 0/1
```

`(w & 258) == 258` uses `and W+1` instead of `ora`, and the inverse operator appends `EOR #1`.
The `&` site emits the load and shift; the comparison emits the combine, normalization and optional
inversion. No temporary exists.

For a multi-bit mask, `lowerBitwise` emits only the low byte at the `&` site and returns a
`masked-word` value that carries the operand and the high mask:

```asm
        lda     operand          ; low byte
        and     #lowMask
```

Its Z flag is `low == 0`. The comparison lowerer splits the block:

```asm
        bne     .nonzero         ; low != 0
        lda     operand+1
        and     #highMask
        beq     .continue        ; both zero
.nonzero:
        lda     #$01
.continue:
```

For `== 0` the same join appends the splitter's `eor #1` arm:

```asm
        bne     .nonzero
        lda     operand+1
        and     #highMask
        beq     .zero
.nonzero:
        lda     #$01
.zero:
        eor     #$01
.continue:
```

A general nonzero word constant needs one equality test per masked byte. The low
`CMP` starts the split and the high `CMP` confirms only when the low byte matched:

```asm
        cmp     #lowConstant
        bne     .false
        lda     operand+1
        and     #highMask
        cmp     #highConstant
        beq     .true
.false:
        lda     #$00
        beq     .continue        ; unconditional, Z from LDA #0
.true:
        lda     #$01
.continue:
```

The `!=` form swaps the true and false arms and uses `bne .continue` after the
one load. The result is in A in both cases.

### 1.3 Why no temporary is needed

The joined value never exists as a two-byte object. The low masked byte lives in A; the high masked
byte is produced and consumed by the same test. The only ordering obligation is that the operand's
high byte is reloadable, which the empty-path `load` proof provides. A computed word operand (for
example a register pair) is deliberately absent from the selection.

## 2. Computed runtime mask

### 2.1 Retention

The stack-retention proof now also admits a byte initializer that is a single-use `&`, `|` or `^`
already in A. The mask local's store becomes one `PHA`; its load becomes a `{kind:"stack"}` value.
The load is admitted as the right-hand operand of `&` when the other operand is a single-use byte
in A: a forwardable platform read, a fixed-address byte read, or a byte bitwise result.

### 2.2 Lowering

`lowerBitwise` recognizes a stack operand on either side. The other operand is made current in A
(no instruction when it is already register A), then:

```asm
        tsx
        and     $0100+n,x
```

The volatile read happens once, at its source point, before the `AND`. The mask byte is never
copied to RAM. The existing zero-test Boolean selection then consumes the `AND` result and Z.

### 2.3 Why the stack is the only home

The mask must be addressable across the volatile read. A register cannot be an `AND` operand, and
the AND is not commutative with a register that holds the read. The handler's own stack is
invocation-private, which the private-home proof already permits, and the byte is popped at the
return.

## 3. Nonzero masked comparison

### 3.1 Selection

A byte masked value (or a zero-extended word whose low byte is the whole value) qualifies when its
single consumer is a materialized `==`/`!=` against a byte constant `C != 0`, and the comparison
result has one A consumer. The constant mask (if any) is recorded.

### 3.2 Identity branch

When `C` equals the constant mask and the mask is a single bit, the masked value is exactly `0` or
`C`. `(x & M) == M` is then the inverted zero test, and the existing splitter is called with the
inverted operator. No `CMP` is emitted.

```asm
        lda     $DD0D
        and     #$08
        beq     .false
        lda     #$01
.false:
        sta     flag
```

### 3.3 General constant

Every other byte constant emits `EOR #C` on A, which sets A=0 and Z=1 exactly on equality, and
then calls the splitter with the source operator. `EOR` destroys A, which is safe because the
masked value is single-use. `CMP` would preserve A but leave it equal to C on the equality path,
which the shared zero-test arms do not expect.

```asm
        lda     $DD0D
        and     #$0F
        eor     #$03
        beq     .false
        lda     #$01
.false:
        sta     flag
```

## 4. Capacity-bounded retention

The fixed `MAX_STACK_RETAINED_BYTES = 8` is removed. The proof's bound becomes the platform's
proved hardware-stack capacity, which closure already checks against
`hardwareStackCapacity - hardwareStackReserve` and reports as `E10238` when exceeded. The handler's
body pushes are added to the NMI entry demand, so the reported peak is exact.

No new storage class is introduced. The number of pushes is the number of retained byte locals; the
number of pops at the single return equals that count.

## 5. Multi-block and calling retention

### 5.1 Structural plan

`nmiStackPlan(fn)` computes, from the semantic CFG:

- the reachable blocks from the entry;
- dominator sets;
- the single `return` block;
- the retained stores (one per retained binding);
- a total dominance order over those stores (every pair is comparable);
- no store inside a cycle;
- every store dominates every load of its binding and the return block.

The slot number is the one-based position in the dominance order. The depth at a load is the number
of stores that dominate it. The push order is therefore identical on every path, and no path can
push a different number of bytes before a join.

### 5.2 Lowering

At each semantic block entry the machine state sets `stackDepth` to the plan's depth for that block
and resets the stack-pointer register fact. The slot map is seeded from the plan before the first
block, so a load can resolve its slot even when the block order is not the store order. The return
consumes the final top slot with `PLA` and removes the remaining dead slots with a proved bulk cleanup or one `PLA` each.

### 5.3 Register and stack validity

`appendLoadA` reuses X only while the same `TSX` instruction dominates the current instruction list
and no later instruction defines X or S. Any `JS R`/`RTS` (S), `TAX`/`INX`/`LDX` (X), push/pull (S)
or `TXS` (S) forces one fresh `TSX`. The address is `$0100 + depth - slot + 1`; a balanced call
restores SP, so the address is unchanged after the call. Ordinary functions have no net stack
pushes; only an NMI entry pushes, and an interrupt handler cannot be called directly.

## 6. Expert cost table

Body costs exclude the shared wrapper. Handler bytes include it. `W` is the absolute word address,
`n` the stack offset.

| Form | Body sequence | Bytes | Path-max cycles |
|---|---|---:|---:|
| `(w & 258) != 0` | `LDA W; LSR; ORA W+1; AND #1; STA` | 12 | 16 |
| `(w & 258) == 0` | same plus `EOR #1` | 14 | 18 |
| `(w & 258) == 258` | `LDA W; LSR; AND W+1; AND #1; STA` | 12 | 16 |
| `(w & 258) != 258` | same plus `EOR #1` | 14 | 18 |
| multi-bit word mask | `LDA W; AND #lo; BNE; LDA W+1; AND #hi; BEQ; LDA #1; STA` | 19 | 22 |
| high-byte-only mask | `LDA W+1; AND #hi; BEQ; LDA #1; STA` | 12 | 14 |
| `m = mask|1; (read & m) != 0` | `LDA mask; ORA #1; PHA; LDA ICR; TSX; AND $0101,X; BEQ; LDA #1; STA; PLA` | 21 | 31 |
| `(read & 8) == 8` | `LDA ICR; AND #8; BEQ; LDA #1; STA` | 12 | 14 |
| `(read & 3) == 1` | `LDA ICR; AND #3; EOR #1; BEQ; LDA #1; EOR #1; STA` | 16 | 18 |
| nine samples | `9×(LDA; PHA); TSX; 8×(LDA $010n,X; STA); PLA; STA; TXA; CLC; ADC #9; TAX; TXS` | 95 | 147 |
| cross-join sample | `LDA ICR; PHA; LDA flag; BNE; …; TSX; LDA; STA; …; PLA; STA` | 28 | 35 |
| call sample | `LDA ICR; PHA; JSR; PLA; STA` | 11 | 21 |

The hand-written alternatives:

| Form | Expert with a private home | Constrained expert (no private home) |
|---|---|---|
| wide single-bit-per-byte mask | a private temporary cannot beat the aligned 12/16 sequence | the same aligned `LSR; ORA/AND; AND #1` sequence |
| multi-bit word mask | 21 bytes, 26 cycles (ZP temporary and `ORA`) | the same branch join: 19 bytes, 23 cycles |
| computed mask | 17 bytes, 25 cycles (ZP mask, `AND` absolute) but forbidden | the same `PHA`/`TSX`/`AND absolute,X` sequence |
| nonzero comparison | `EOR` plus branch, 16 bytes, 18 cycles; the impossible fold is #151 | the same `EOR` and branch |
| nine samples | 9 stores + 9 loads, no push/pop, but forbidden | the same constrained push/pop sequence with the final `PLA` |
| join/call retention | a static home, but forbidden | the same `PHA`/`PLA` or `TSX` sequence |

The compiler is at or below the best legal expert sequence in every row except the cross-join
(#152), which is behaviorally correct but not yet the per-path consume. The aligned and computed
forms also beat the private-home expert on bytes; the private-home expert is not a legal result for
the cooperative NMI route. The impossible-constant fold (#151) is a separate local gap outside the
delivered forms.

## 7. Proof obligations preserved

| Obligation | Evidence |
|---|---|
| No private RAM/zero-page request | The inventory omits every retained local; machine lowering creates no temporary for the delivered forms; the existing `nmiPrivateStorageRoute` check is unchanged. |
| Volatile read order and count | The read stays at its source operation; the computed mask is pushed after its own source operations and before the read. |
| Flags | The low `AND` owns Z for the join; the high `AND` owns Z for the second test; `EOR` owns Z for the general byte constant and `CMP` for each general word byte; no later producer intervenes. |
| Stack balance | Every retained store is removed by `PLA` or the proved bulk cleanup; calls are stack-balanced; the peak is reported. |
| Interrupt safety | The body uses only A, X, the stack pointer and flags; the wrapper's clobber analysis saves A and X. No Y use is added. |
| Alias/visibility | The word operand is a placed word or a normal word local; the mask is a placed byte or a computed byte; no extra read or write is introduced. |

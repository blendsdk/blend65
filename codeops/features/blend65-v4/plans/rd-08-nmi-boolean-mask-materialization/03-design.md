# Design — NMI Boolean Mask Materialization

> **Parent**: [Index](00-index.md)
> **Authority**: issue #149; frozen Specification 4.0; existing NMI private-home proof
> **Updated**: 2026-11-13

## 1. Selection

`selectRegisterForwarding` already proves the shape for masks `1`, `2` and `4`. This plan adds one
more selection on the same producer/consumer window.

### 1.1 Producer

A single-use binary `&` whose result type is:

- a byte, or
- a word whose mask operand is a compile-time byte constant (`0..255`), which proves the high result
  byte is zero (`lowerBitwise` already returns `zero-extended`).

The mask operand is one of:

- a compile-time constant on either side (the existing literal map, including conversions);
- a directly addressable byte load on the other side of a forwarded platform read, in either
  operand order. The byte bitwise lowering commutes it so the read stays in A.

### 1.2 Consumer

The next machine operation is `==`/`!=` with the masked value on either side and a constant zero on
the other. The comparison result is single-use and materialized. The following operation is one
byte store or a Boolean return; a constant-address byte memory write is accepted defensively at the
machine boundary, but a source Boolean cannot be poked.

### 1.3 Selection result

| Mask | Selection | Lowering |
|---|---|---|
| `1` (byte or zero-extended word) | existing `booleanValues` | identity, or one `EOR #1` for `==` |
| `2`, `4` (byte or zero-extended word) | existing `booleanShiftValues` | `LSR × k`, plus `EOR #1` for `==` |
| `0` | no map: zero-mask fold and constant comparison fold | `LDA #0`/`LDA #1` |
| `255` (`0xFF`) | `booleanBranchValues` with the all-ones identity | `LDA` owns the value and flags; no `AND` |
| any other constant, or an addressable runtime mask | `booleanBranchValues` | expert branch blocks |

The word mask `1` is the identity (`AND #1`), not a branch: the low byte is the whole Boolean. The
word branch also serves a branch condition on a byte mask, where the `AND`'s Z is the zero test.

The masked value and comparison result join `forwardedRegisterValues`, suppressing every
`retained-value` request. The zero mask folds the `&` itself, so no `AND #0` is emitted. A constant
bitwise expression and a materialized comparison of two constants fold to a constant value, so the
constant-local word form also reaches the optimal `LDA #1` result.

## 2. Branch materialization

The comparison is lowered by a block-splitting lowerer, the same pattern used by checked division
and guarded shifts. The `&` already emitted `AND`; A holds the masked byte (or the low byte of a
zero-extended word). The current machine block ends with a branch.

### 2.1 `!= 0`

```asm
        ; current block: read and AND already emitted
        beq     .continue          ; Z from AND, taken when the mask is zero
        lda     #$01
.continue:
        sta     flag
```

### 2.2 `== 0`

```asm
        beq     .zero
        lda     #$01
.zero:
        eor     #$01
        sta     flag
```

### 2.3 Zero mask and constant folds

```asm
        lda     #$00               ; $01 for == 0
        sta     flag
```

`x & 0` returns constant zero and emits no `AND`. A materialized `==`/`!=` whose two operands are
both constants emits one `LDA #result`. The read still executes exactly once; only the dead `AND #0`
disappears. The same folds turn `2 & 2` and its zero test into the constant 1 when a single-use
constant local is elided.

### 2.4 Block shape and labels

The current block keeps its label and ends with `beq`. The arm blocks use
`<current>.boolean.<ordinal>.<role>` and the continuation uses
`<current>.boolean.<ordinal>.continue`. Ordinals are per semantic block and monotone, so a block
that already split for a checked division or another Boolean cannot collide. The `.boolean.` family
is added to the debug-range semantic-owner prefix list in `services/debug-machine-ranges.ts`; without
that registration the build would fail while publishing ranges.

The splitter bypasses `lowerComparison`, sets the comparison result to register A itself, and
returns the arm blocks plus the continuation label. It is not a wrapper around the normal
comparison instruction stream.

Each arm ends in a fallthrough to the next arm or the continuation. The continuation is the
current label for the remaining source operations; the normal loop closes it with the semantic
terminator. No synthetic storage, helper call or data object is created.

## 3. Why the sequence is exact

| Obligation | Evidence |
|---|---|
| Read count and order | No rule adds, moves or removes the volatile read. Its single `lda` stays at the source point. |
| A at the `AND` | #147's platform-to-bitwise rule keeps the read in A for a constant or addressable mask. The byte bitwise lowering commutes an addressable left mask. |
| Masked value | `AND` sets Z exactly when the masked byte is zero. The branch reads only that flag. |
| `!=` arms | Zero path leaves A = 0; nonzero path loads 1. |
| `==` arms | Zero path `EOR`s A=0 to 1; nonzero path loads 1 then `EOR`s to 0. |
| Word high byte | A byte-sized `AND` mask cannot set any high bit; `lowerBitwise` proves the high byte is zero and keeps the low byte in A. |
| Flags | `LDA` sets N/Z but the following store consumes A. The branch consumes only the `AND` Z. |
| Private storage | The masked value and comparison result are forwarded; no request is invented. |
| NMI proof | Unchanged. The handler has no non-instruction storage request. |
| Alias/volatile | The mask is a constant or a directly addressed byte; no extra read or write is introduced. |

## 4. Expert comparison

The comparison convention is the largest generated path. Each branch arm pays its own cost,
including the documented page-cross allowance.

| Operator | Emitted tail after `AND` | Bytes | Path-max cycles |
|---|---|---:|---:|
| `!= 0` | `BEQ cont; LDA #1` | 4 | 4 |
| `== 0` | `BEQ zero; LDA #1; zero: EOR #1` | 6 | 6 |

The emitted sequence is byte-for-byte and cycle-for-cycle the expert hand-written branch for an
arbitrary nonzero mask. The zero mask folds below the branch. No generated form is worse than the
expert.

## 5. Lowered handler costs

The NMI wrapper is `PHA`/`CLD`/`PLA`/`RTI` = 4 bytes, 15 cycles, 4 stack bytes. Only A is saved
because the body proves A live and X/Y dead at every reachable point. `flag` is an absolute placed
global at `$C000`.

| Form | Body after the read | Handler bytes | Path-max cycles |
|---|---|---:|---:|
| mask `8`/`3`, `!=` | `AND #m; BEQ; LDA #1; STA` | 16 | 29 |
| mask `8`/`3`, `==` | `AND #m; BEQ; LDA #1; EOR #1; STA` | 18 | 31 |
| zero mask, either polarity | `LDA #0/1; STA` | 12 | 25 |
| runtime mask, `!=` | `AND mask; BEQ; LDA #1; STA` | 17 | 31 |
| runtime mask, `==` | `AND mask; BEQ; LDA #1; EOR #1; STA` | 19 | 33 |
| word global mask `1`, `!=` | `AND #1; STA` | 12 | 25 |
| word global mask `2`, `!=` | `AND #2; LSR; STA` | 13 | 27 |
| word global other byte mask, `!=` | `AND #m; BEQ; LDA #1; STA` | 16 | 29 |
| all-ones mask `0xFF`, `!=` | `BEQ; LDA #1; STA` (no `AND`) | 14 | 27 |
| constant local, `!=` | `LDA #0/#1; STA` (elision plus folds) | 9 | 21 |

Totals are compiler-owned handler code. They exclude the fixed 7-cycle CPU NMI acceptance and the
7-cycle/4-ROM-byte KERNAL `$FE43` stub; those terms cancel in the relative expert comparison.

## 6. Single-use constant local elision

The existing NMI register-only rule proves a byte local whose life is one store/load pair fed by a
direct read. This plan adds a constant initializer:

- one store of a constant (or a conversion of a constant) and zero loads: omit the dead store and
  the home;
- one store of a constant and one adjacent load with one use: omit the home; the load yields the
  constant value.

The store emits nothing. The load, when present, finds the single preceding store for the same
binding in its block, reads `state.values.get(store.value)`, and sets the load result to that value.
A constant initializer therefore yields the constant; a read initializer keeps the existing
register-A claim. The store lowering asserts register A only for a non-constant initializer. No new
discriminator is added to the elided-local set. A word local is included because the constant is
known in full; a runtime word local is not.

## 7. Restrictions that stay

| Case | Result | Reason |
|---|---|---|
| Masked value shared by several consumers | `E10245` | The byte is live across consumers and needs bounded storage |
| Several simultaneously retained samples | `E10245` | Same bounded-retention gap across volatile reads |
| 16-bit word mask with a possibly-nonzero high byte | `E10245` | Needs two masked bytes plus a join/temporary |
| Runtime word local from a byte read | `E10245` | The zero-extension conversion stages a private byte |
| Computed/non-addressable runtime mask | `E10245` | The mask needs a temporary, so the read cannot stay in A |
| Masked value compared to a nonzero constant | `E10245` | Only the zero-test consumer is selected |

All six are re-owned by the follow-up issue. None is a language restriction.

## 8. Blast radius

- The branch rule changes mainline output wherever the selected mask-`8+`/multi-bit/runtime shape
  appears. It replaces retention with the expert branch.
- The zero fold changes `x & 0` output in every domain.
- The constant-local elision is NMI-only, like the existing register-only rule.
- Masks `1`, `2` and `4` keep their existing output; the word mask `1` joins the identity.
- The all-ones mask identity removes a redundant `AND #$FF` in every domain.
- Branch conditions keep using the `AND` flags and do not gain blocks; a word byte-mask condition now
  uses the low `AND`'s Z.
- The complete compiler suite and pinned optimizer artifacts are the guard; a moved artifact is a
  defect to explain, not a baseline to update silently.

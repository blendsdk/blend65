# Design — Residual Boolean Masks

> **Parent**: [Index](00-index.md)
> **Authority**: issue #148; frozen Specification 4.0; existing NMI private-home proof
> **Updated**: 2026-11-13

## 1. One rule on the existing Boolean identity

The mask-`1` identity already proves the shape: a single-use byte `&` with a constant mask, consumed
by a single-use zero comparison whose result has one A consumer. This plan extends the same shape
with a shift count.

### 1.1 Selection

In `selectRegisterForwarding`, for a producer `binary &` of byte type:

```
mask literal: one operand is a compile-time constant, obtained through the existing
              literal map (including conversions of constants), on either side
shift count:  k = 1 for mask 2, k = 2 for mask 4
consumer:     the next machine operation is == / != with the masked value on
              either side and a constant zero as the other operand
              the comparison result is single-use
following:    a byte store or Boolean return consuming the comparison result
              (a constant-address byte memory write is also accepted at the machine
              boundary, but a source-level Boolean cannot be poked)
effect:       booleanShiftValues.set(producer.result, k)
              forwardedRegisterValues.add(producer.result)
              forwardedRegisterValues.add(comparison.result)
```

The lowering identifies the masked operand on either side and requires that lowered value to be
register A; a mirrored `0 != (read() & 2)` therefore emits the same body. The branch-condition
consumer is deliberately excluded: #147 already uses the `AND` result's Z directly and must not gain
shifts. The mask-`1` path keeps its existing `booleanValues` selection, including the branch case.

A constant left operand is already commuted by the byte bitwise lowering, so `(2 & read())` selects
the same sequence. A register, computed, or runtime mask is not selected.

### 1.2 Lowering

`FunctionLoweringState` carries the selected map. In `lowerOperation`, a materialized `== 0`/`!= 0`
comparison whose masked value is register A on either side and whose mask has a selected shift count
lowers to:

```
LSR A × k
EOR #$01        only for == 0
```

and returns register A. The normal comparison materialization (`EOR #0; CMP #1; LDA #0; ADC #0`) is
not emitted for this shape. Mask `1` keeps its existing `booleanValues` selection; lowering derives
`k = 0` from that set, so one Boolean-identity lowering serves both the existing identity and the new
shift forms. Its emitted bytes do not change.

### 1.3 Why the sequence is exact

| Obligation | Evidence |
|---|---|
| Read count and order | No rule adds, moves or removes the volatile read. The read's single `lda` stays at its source point. |
| A at the `AND` | #147's platform-to-bitwise rule keeps a single-use direct read in A for a constant-mask `&`. An elided local load is already register A. |
| Masked value | `x & 2^k` is exactly `0` or `2^k`; `LSR` repeated `k` times produces exactly `0` or `1`. |
| Inverse | `EOR #$01` maps `0`/`1` to `1`/`0`, which is exactly `== 0`. |
| A at the store | The comparison result is forwarded, so the single following byte store or Boolean return consumes A directly. The defensive memory-write branch is machine-level only; a source Boolean cannot be poked. |
| Flags | `LSR` sets N/Z from the final value and C from the shifted-out bit; the store consumes A, not a flag. `EOR #1` sets N/Z but the result is stored, not branched. |
| Private storage | The masked value and comparison result are never materialized. No request is invented. |
| NMI proof | Unchanged. The handler still has no non-installation request. |
| Alias/volatile | The mask is a compile-time constant; no memory is read or written by the shifts. |

### 1.4 Threshold

The comparison convention is the largest generated path, not a static sum of mutually exclusive
branch arms. Each branch arm uses its actual cost, including the documented page-cross allowance for
a taken relative branch. With the shared `LDA`/`AND`/`STA` and the wrapper cancelled:

| Form | Expert tail after `AND` | Shift tail |
|---|---|---|
| `!= 0` | `BEQ done; LDA #1` = 4 bytes, 4 path-max cycles | `LSR × k` = `k` bytes, `2k` cycles |
| `== 0` | `BEQ zero; LDA #1; zero: EOR #1` = 6 bytes, 6 path-max cycles | `LSR × k; EOR #1` = `k+2` bytes, `2k+2` cycles |

| `k` | Mask | Shift `!=` tail | Expert `!=` tail | Shift `==` tail | Expert `==` tail | Verdict |
|---:|---:|---|---|---|---|---|
| 1 | 2 | 1 byte, 2 cycles | 4 bytes, 4 cycles | 3 bytes, 4 cycles | 6 bytes, 6 cycles | beats both |
| 2 | 4 | 2 bytes, 4 cycles | 4 bytes, 4 cycles | 4 bytes, 6 cycles | 6 bytes, 6 cycles | meets cycles, beats bytes |
| 3 | 8 | 3 bytes, 6 cycles | 4 bytes, 4 cycles | 5 bytes, 8 cycles | 6 bytes, 6 cycles | loses cycles; deferred |
| ≥4 | ≥16 | `k` bytes, `2k` cycles | 4 bytes, 4 cycles | `k+2` bytes, `2k+2` cycles | 6 bytes, 6 cycles | deferred |
| any | multi-bit | not shift-normalizable | branch required | not shift-normalizable | branch required | deferred |

Masks `2` and `4` are the only constants whose shift chain does not exceed the expert on either
measure.

## 2. Lowered sequences and costs

NMI wrapper for every sequence: `PHA` (1 byte/3 cycles), `CLD` (1/2), `PLA` (1/4), `RTI` (1/6):
4 bytes, 15 cycles, 4 stack bytes. Only A is saved because the body proves A live and X/Y dead at
every reachable point; the qualified specialization rule permits removing a register save only after
that deadness proof. The frozen appendix's generic save-all entry (12 bytes, 6 stack bytes) is not
the selected variant. `flag` is an absolute placed global at `$C000`.

The totals below are compiler-owned handler code. They exclude the fixed 7-cycle CPU NMI acceptance
and the 7-cycle/4-ROM-byte KERNAL `$FE43` stub; those terms cancel in the relative expert comparison
and are enumerated by the existing route record.

### 2.1 Mask 2, `!= 0`

```asm
pha
cld
lda $dd0d
and #$02
lsr
sta $C000
pla
rti
```

Handler 13 bytes, 27 path-max cycles. Expert branch: 16 bytes, 29 path-max cycles. Byte win 3, cycle
win 2.

### 2.2 Mask 4, `!= 0`

```asm
pha
cld
lda $dd0d
and #$04
lsr
lsr
sta $C000
pla
rti
```

Handler 14 bytes, 29 path-max cycles. Expert branch: 16 bytes, 29 path-max cycles. Byte win 2,
cycle tie.

### 2.3 Mask 2, `== 0`

```asm
pha
cld
lda $dd0d
and #$02
lsr
eor #$01
sta $C000
pla
rti
```

Handler 15 bytes, 29 path-max cycles. Expert inverse: 18 bytes, 31 path-max cycles. Byte win 3,
cycle win 2.

### 2.4 Mask 4, `== 0`

```asm
pha
cld
lda $dd0d
and #$04
lsr
lsr
eor #$01
sta $C000
pla
rti
```

Handler 16 bytes, 31 path-max cycles. Expert inverse: 18 bytes, 31 path-max cycles. Byte win 2,
cycle tie.

The elided-local variants emit the same body: the local store and load emit no instruction.

## 3. Restrictions that stay

| Case | Result | Reason |
|---|---|---|
| Constant mask `8` or higher (single bit) | `E10245` | The shift tail exceeds the expert's path-max cycles |
| Multi-bit constant mask (`3`, `6`, …) | `E10245` | Shifting cannot normalize `0` or `mask` to `0`/`1`; the expert needs a branch block |
| Runtime mask (`maskGlobal`) | `E10245` | No compile-time mask value means no fixed shift count; the fallback comparison materialization is larger than the expert branch |
| Several simultaneously retained samples | `E10245` | Storage the private-home-free route does not admit |
| Any real private home | `E10245` | The NMI proof is unchanged |

The first three stay in `v4-nmi-retained-source-reads` with the multi-sample boundary and a
follow-up owner.

## 4. Blast radius

- The rule changes mainline output wherever the exact mask-`2`/`4` materialized shape appears.
- Mask-`1` identity keeps its output; the lowering is unified but the emitted bytes are unchanged.
- Branch conditions keep using the `AND` flags and are not shifted.
- The new implementation tests pin the mainline selection, exact output and costs. The existing
  pinned optimizer artifacts do not contain this shape, so they are not its guard; the complete
  compiler suite is the broad regression guard.

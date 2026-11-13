# Design — Bounded NMI Retention

> **Parent**: [Index](00-index.md)
> **Updated**: 2026-11-13

## 1. Stack-retention proof

`nmiStackRetainedLocals(fn, excluded)` accepts only:

- one semantic block with a `return` terminator, `void` result, no calls or indirect calls;
- a byte local with exactly one store and one to eight loads, all in that block, no address taken,
  no indexed path;
- the store precedes every load;
- the initializer is already in A: a forwardable platform byte read, a fixed-address byte
  `memory-read`, or a byte `&`; its value has one use (the store) and no intervening code;
- every load result has at least one use;
- at most eight retained bytes.

The inventory omits each retained local's request and records both the elision key and the source
binding key. No RAM/zero-page request is created.

## 2. Lowering

At the initializer store, the value is asserted to be register A and one byte. The lowering emits
`PHA`, increments the body depth, and records the binding's one-based push order.

At each load, the value becomes `{kind: "stack", slot}`. `appendLoadA` emits:

```asm
tsx                     ; SP into X
lda $0100+n,x           ; n = currentDepth - slot + 1
```

The current depth is the number of pushes already executed. A load before a later push therefore
uses the correct deeper offset. The loaded byte owns Z, so the existing expert Boolean branch
materializes the comparison with no scratch.

At the single `return`, the body emits one `PLA` per pushed byte before the wrapper's `PLA; RTI`
(and before the wrapper restores X). The machine function reports `stackBytes`; the NMI entry adds
it to the fixed entry demand, so `hardwareStack` is the real peak. `TSX` defines X, so the wrapper's
existing clobber analysis saves and restores X.

## 3. Zero-extension staging

A single-use word local whose initializer is a zero-extending conversion of a forwardable byte read
and whose single load is consumed by a byte-masked `&` is elided. The conversion result is recorded
as a zero-extension value. At the conversion, the operand is register A; the lowering keeps
`{zero-extended, low: A}` with no staging store. The store emits nothing and the load resolves the
same value. The `&` observes only the low byte; the high byte is proved zero.

## 4. Costs

| Form | Body shape | Handler bytes | Hardware stack |
|---|---|---:|---:|
| shared `a`/`b` | `PHA`; one `TSX`; two `LDA $0101,X` + expert branch; `PLA` | 38 (A+X wrapper) | 6 |
| five samples | five `PHA`; one `TSX`; five `LDA $010n,X; STA`; six `PLA` + X restore | 64 (A+X wrapper) | 10 |
| runtime word local | `LDA $DD0D; AND #2; LSR; STA` with the A-only wrapper | 13 | 4 |

The stack sequence is the constrained expert result: the route has no private RAM, so the
hand-written equivalent must also push the values or spend X/Y plus saves. The compiler's version
is uniform and reports the exact peak.

## 5. Remaining restrictions

| Form | Reason |
|---|---|
| 16-bit word mask with a possibly-nonzero high byte | Needs both masked bytes and a join |
| Computed/non-addressable runtime mask | Needs a temporary before the `AND` |
| Masked value compared to a nonzero constant | Outside the selected zero-test branch |
| More than eight retained bytes, multi-block or calling handler | Outside the bounded straight-line proof |

All are owned by issue #150.

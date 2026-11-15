# Private element forwarding — closeout

> **Issue**: [#154](https://github.com/blendsdk/blend65/issues/154), byte-element slice
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done (bounded to the byte element); word element remains
> **Recorded**: 2026-11-15

## Delivered

The last supplied constant element of a partial private array aggregate is forwarded from A into an
adjacent read of that exact element. The witness now emits the expert form:

```asm
lda #$07
sta a[0]
sta $C000
```

The artifact is 634 payload / 632 program / 620 code / 0 zero-page / 0 scratch, from 637/635/623:
the issue's 3-byte saving.

- A global or parameter element, a runtime index store, a dynamic raw destination and a
  non-adjacent consumer keep the ordinary reload.
- The `placeSignature` BigInt crash found by the indexed-alias/resource suites is fixed; those
  suites pass.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/machine/lower-register-forwarding.ts` | Partial-array last-element fact, exact place signature, private-root and adjacency guards |
| `packages/compiler/src/machine/lower-operation.ts` | Consume A for the forwarded element load; constant-address raw-write consumer |
| `packages/compiler/src/machine/lower-state.ts`, `lower-function.ts` | State wiring and globals |
| `test/rd04/private-element-forwarding.spec.test.ts` | Four-profile expert/barrier oracle |
| `test/rd04/private-element-forwarding-cost.impl.test.ts` | Exact artifact pin |

## Verification

| Tier | Result |
| --- | --- |
| Assembly oracle | 16/16 across four profiles |
| Cost pin | 634/632/620, zero-page 0, scratch 0 |
| Compiler package | 233 files / 3,916 passed / 2 skipped |
| Host checkpoint | 234 files / 5,029 passed |
| Indexed-alias/resource suites | 154/154 |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Word element forwarding | #154; the word construction leaves the high byte in A |
| Non-constant element values | not claimed |

## Deferral-expiry check

No deferral's reason is invalidated. The byte element meets the expert form; the word case remains
the measured residual and keeps #154 open.

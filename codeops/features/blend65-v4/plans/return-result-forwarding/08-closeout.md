# Return-result forwarding — closeout

> **Issue**: [#124](https://github.com/blendsdk/blend65/issues/124), byte and helper slice
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done (bounded to byte and helper returns); word high-byte staging remains
> **Recorded**: 2026-11-15

## Delivered

A value defined by the last operation of a block whose terminator returns that exact value now
returns in its register without a private staging home.

| Witness | Before | After | Saving |
| --- | ---: | ---: | ---: |
| Byte return, bounds on | 242 | 236 | **6 bytes** |
| Byte return, bounds off | 226 | 220 | **6 bytes** |
| Helper/multiply return | 155 | 149 | **6 bytes** |
| Word return | 148 | 148 | 0 (residual) |

The byte callee now emits `lda param; clc; adc #1; rts`; the helper callee ends `jsr multiply; rts`.
No ABI, caller, stack, alias or asynchronous contract changed. The #157 helper cost pin moved 713/711/699 → 707/705/693 and the M1
`paddingBeforeBytes` moved 2930 → 2936, both by the same six-byte return win.
The word high-byte sequence is
unchanged: `sta low; lda high; adc #0; sta high; lda high; tax; lda low; rts`, where the expert keeps
the high byte in X and only the low byte in scratch.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/machine/lower-function.ts` | Build the last-operation/return adjacency fact |
| `packages/compiler/src/machine/lower-state.ts` | Skip retention for that exact return value |
| `test/rd04/return-result-forwarding.spec.test.ts` | Four-profile assembly oracle for byte and helper returns |
| `test/rd04/return-result-forwarding-cost.impl.test.ts` | Exact PRG pins for both bounds modes and the helper |

## Verification

| Tier | Result |
| --- | --- |
| Assembly oracle | 8/8 across four profiles |
| Cost pins | 220 / 236 / 149 payload |
| Compiler package | 233 files / 3,916 passed / 2 skipped |
| Host checkpoint | 232 files / 5,012 passed |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Word full-width return high-byte staging | #124, `lower-arithmetic.ts` low-scratch/X-high construction |
| Other return-result shapes | not claimed |

## Deferral-expiry check

No deferral's reason is invalidated. The byte and helper paths meet the expert return shape; the
word path remains the measured residual and keeps #124 open.

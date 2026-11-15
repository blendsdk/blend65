# Bounded local callable index — closeout

> **Issue**: [#163](https://github.com/blendsdk/blend65/issues/163)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done (bounded to same-block dominating stores)
> **Recorded**: 2026-11-15

## Delivered

A proved upper bound for a local place is carried from a dominating store into an unchecked dynamic
callable read. The witness builds with bounds checks disabled and an unrelated raw-write kill:

- The bounded local masked index is accepted.
- The unmasked local index still fails `E10277`.
- The inline masked expression still builds.
- A later masked store does not retroactively bound an earlier read.

No runtime check, mask or source restriction is added. The analysis is per block; a predecessor
block's bound is not propagated (false rejection only), and a merge with a wider incoming value is
unbounded.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/semantic/raw-write-kills.ts` | Local place-bound map, index-bound lookup through loads, possible-range use |
| `packages/compiler/src/semantic/assignment-facts.ts` | Record/clear the bound on stores; pass it to the dynamic read |
| `test/rd04/bounded-local-index.spec.test.ts` | Four-profile bounded/unbounded/inline/later-store oracle |

## Verification

| Tier | Result |
| --- | --- |
| Public oracle | 16/16 across four profiles, bounds off |
| Compiler package | 233 files / 3,916 passed / 2 skipped |
| Host checkpoint | 235 files / 5,045 passed |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Cross-block dominating bound propagation | #163 precision debt |
| Bounds through helper returns | not claimed |
| Array-element bound keys | conservative `index:*` collapse |

## Deferral-expiry check

No deferral's reason is invalidated. The issue's two precision witnesses are delivered; the
cross-block propagation remains a measured conservative boundary, not an unsafe acceptance.

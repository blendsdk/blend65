# Raw-write callable invalidation — bounded direct slice closeout

> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Review packet**: [05-review-packet.md](05-review-packet.md)
> **Issue**: [#156](https://github.com/blendsdk/blend65/issues/156) — stays open
> **Status**: direct slice implemented and source-verified; public GREEN and complete checkpoint
> pending
> **Follow-up debt**: [#161](https://github.com/blendsdk/blend65/issues/161),
> [#162](https://github.com/blendsdk/blend65/issues/162),
> [#163](https://github.com/blendsdk/blend65/issues/163)

## Delivered behavior

A raw write in the same executable body kills the exact bytes it writes. A callable leaf is
rejected when its complete pointer interval overlaps a killed interval; a later typed store
restores only the bytes it writes. A branch kill survives the join, a write before the assignment
does not, and a disjoint field write does not poison its sibling.

| Case | Result |
| --- | --- |
| Word/byte write to a callable | Fails `E10277`. |
| Callable field and packed crossing word | Fails `E10277`. |
| Constant write overlapping a placed callable | Fails `E10277`. |
| Branch-only kill | Fails `E10277`. |
| Write before the assignment, unrelated write, direct reassignment | Accepted. |
| Disjoint field byte | Accepted. |
| Dynamic read of a raw-written element | Fails `E10277`. |
| Dynamic read of an untouched leaf through a copy | Accepted. |
| Checked dynamic read with an untouched sibling | Accepted. |
| Unchecked unbounded dynamic read with any kill | Conservatively rejected. |
| Inline masked unchecked index | Accepted. |

## Evidence

| Check | Result |
| --- | --- |
| `raw-write-invalidation.impl.test.ts` | 24 passed |
| `function-targets` + `block-index-alignment` + `whole-program` targeted | 4 files, 85 passed |
| Complete compiler package suite | 229 files, 3,872 passed / 2 skipped |
| `tsc -p packages/compiler/tsconfig.json --noEmit` | clean |
| Public spec RED | 24 failed / 20 controls passed (44 cases) |
| Public spec GREEN | 44 passed (44) |
| Public spec GREEN | pending the #74 checkpoint build |
| Complete `yarn test:full` | 80m39s: compiler 229 files / 3,872 passed / 2 skipped, host 221 files / 4,789 passed, VICE 122 files / 2,270 passed / 4 skipped |

## Review record

| Lens | Verdict |
| --- | --- |
| SFA/ABI | APPROVE; analysis-only, zero added runtime storage. |
| Machine code | APPROVE on analysis-only output; MC-004 local-index precision is #163. |
| Correctness | Review rounds found and fixed loop, packed-field, placed-adjacent, dynamic-read and aggregate-copy defects. The final authorization-gated recheck produced no code finding; the reviewer could not load hidden expert references. |
| Semantics | Earlier semantic findings fixed; final authorization-gated recheck produced no code finding. |
| Spec oracle | PASS/independent author audit; 44 public cases, 24 RED / 20 controls. The `spec-test-author` role was unavailable because its required standards path is absent; an implementation-blind general agent authored the oracle and an independent audit checked it. |

## Residual boundaries

| Boundary | Why it remains | Owner |
| --- | --- | --- |
| Raw write inside a callee, then caller read | Interprocedural may-kill summaries and context handling. | #161 |
| Borrowed parameter/global aliasing | Call-site-sensitive alias translation and byte intervals. | #161 |
| Finite indirect call kills | Provisional target set and interprocedural summaries. | #161 |
| Runtime write destination | Address is not statically resolvable; AR-P1 raw-alias class. | #161 |
| Constant-index callable array recovery | Must-assignment collapses array indices. | #162 |
| Bounded local index value | No dominating local range propagation; inline masked expressions are proved. | #163 |

## Deferral-expiry check

- #156 is not closed. The direct slice is delivered; the interprocedural/alias remainder is still
  owned by #161 and the AR-P1 risk is not waived.
- #162 and #163 are precision debt, not presented as solved behavior.
- `spec/` is byte-identical and the expressiveness ledger has the same eight rows.
- No existing oracle was deleted, skipped or weakened. The new public oracle is a new file with
  24 RED / 20 control evidence.

## Verification status

Source-level implementation tests and typecheck pass. The public oracle is GREEN at 44/44. The
complete `yarn test:full` checkpoint passed in 80m39s: compiler 229 files / 3,872 passed / 2
skipped, host 221 files / 4,789 passed, VICE 122 files / 2,270 passed / 4 skipped. No oracle was
deleted, skipped or weakened.

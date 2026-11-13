# Preflight Report — Residual Boolean Masks

> **Target**: [Plan index](00-index.md) and the full plan set
> **Status**: PASS WITH FIXES — all critical and major findings dispositioned before implementation
> **Date**: 2026-11-13

## Method

An independent read-only preflight auditor compared the plan against issue #148, the frozen NMI
contract, the qualified expert references, the real lowering/storage/test seams, and the cost facts.
The auditor did not modify files, run the suite or launch VICE. The spec author independently wrote
the two requirement oracles; its RED run is recorded below.

## Findings and dispositions

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| C1 | Critical | The #147 spec oracle still pins `BOOLEAN_MASK_TWO` as a negative, but this plan makes exactly that form build. No task authorized retiring it, so the suite could not go green honestly. | Fixed: AR-R7 records the authorized retirement; task 1.1.7 routes the one-case removal through the independent spec author. The other #147 negatives (five samples, borrowed local address) stay. |
| M1 | Major | The cost table mixed a 3-cycle taken branch with "maximum cycles", and `02`/`03` disagreed. Under a static sum of per-instruction maxima, mask 8 would tie the branch, contradicting the stated threshold. | Fixed: the plan now states the comparison convention explicitly — the largest path sum, using each branch arm's actual cost including the documented page-cross allowance, not a static sum of mutually exclusive arms. Corrected tails: expert `!=` is 4 bytes/4 path-max cycles and expert `==` is 6 bytes/6; shift is `k`/`2k` and `k+2`/`2k+2`. Threshold `k ≤ 2` (masks 2 and 4); mask 8 loses 2 path-max cycles. All tables corrected. |
| M2 | Major | The selection pseudo-code omitted the mirrored comparison case, so `0 != (read() & 2)` could have been left as an unowned residual or, if selected without lowering support, failed internally. | Fixed: §1.1 accepts the masked value on either comparison side; the lowering identifies the masked register-A operand on either side and emits the same body. An impl positive pins the mirrored comparison output and the spec oracle covers it. |
| M3 | Major | Calling multi-sample retention a "contract boundary" because the bytes "genuinely need private storage" overstated the frozen rule; a bounded stack scheme is not obviously forbidden. | Fixed: reworded as a route limitation — the cooperative route admits no invocation-private RAM/ZP homes, and no bounded stack-retention mechanism is implemented or proved. It stays a real negative owned by the follow-up, not a language restriction. |
| m1 | Minor | The local witness was recorded as "local home plus comparison retained byte"; the local is already elided, so the offending storage is the masked value plus the comparison result. | Fixed in `02-current-state.md`. |
| m2 | Minor | The index said 0/26 tasks while the execution plan said 0/24. | Fixed: 25 tasks everywhere after the oracle-retirement task was added. |
| m3 | Minor | The design said mask 1 unification while the testing strategy said selection records nothing for mask 1, conflicting with the existing impl test. | Fixed: selection keeps `booleanValues` for mask 1 unchanged and adds `booleanShiftValues` for masks 2/4; lowering derives shift 0 from the existing set. No existing assertion changes. |
| m4 | Minor | The runtime-mask reason cited size only; the real reason is that no fixed shift count is knowable. | Fixed in the design and ledger text. |
| m5 | Minor | Mask 4 is ICR bit 2 (TOD alarm), not the FLAG line. | Fixed: the runtime-scope record now says the typed library exposes no TOD-alarm programming, and a raw `$DD08–$DD0B` write would invalidate the typed lease/handback proof. |
| m6 | Minor | The ledger probes omitted multi-bit constants and the inverse residual, and the row text still carried the old reason. | Fixed: probes cover mask 8 `!=`, mask 8 `==`, mask 3 `!=`, a runtime mask `!=` and five samples; task 4.4.2 rewrites the row text and sets the new owner explicitly (the gate's closing-owner check is RD-04 and does not enforce this row). |
| m7 | Minor | The plan lacked the mandatory deferral-expiry answer. | Fixed: task 4.4.8 and the exit boundary require the walk and the closeout records it. |
| m8 | Minor | The "zero path is 1 cycle faster" sentence was ambiguous and wrong for mask 2. | Fixed: the plan now compares path-max totals only and records no per-path claim beyond the table. |
| m9 | Minor | AR-R1 promised local forms for all delivered polarities but the oracle covered only two. | Fixed: the spec author adds the two missing local polarities and one mirrored constant-left positive. |
| m10 | Minor | The A-only wrapper totals were not reconciled with the frozen appendix's general 12-byte save-all entry. | Fixed: the design cites the specification's entry-variant latitude and records that only A is saved because the body clobbers only A; this slice does not change the route. |

## Oracle RED evidence

The implementation-blind spec author wrote `test/rd08/nmi-residual-boolean-masks.spec.test.ts` and
`test/rd08/nmi-residual-boolean-masks-vice.spec.test.ts`. The initial six-form RED was:

```text
Test Files  1 failed (1)
Tests       24 failed | 16 passed (40)
```

After the authorized correction round added the two local polarities and the mirrored positive, the
final nine-form RED was re-captured before implementation:

```text
Test Files  1 failed (1)
Tests       36 failed | 16 passed (52)
```

Every positive failure carried exactly one `E10245`; the passes are the residual negatives. The VICE
file was not run at baseline because its positives could not build. After implementation the oracle
grew to eleven positives with the two mirrored operand-order forms and passed 60/60.

## Residual risk

- The rule changes mainline output for the mask-2/mask-4 materialized shape; pinned optimizer
  artifacts and the complete suite are the guard.
- The path-max comparison is stricter than a static sum; the closeout records both bytes and the
  path-max total so the claim is auditable.
- Timer B NMI feasibility is established by the existing typed API and ownership facts but is only
  proven by the sequential runtime case.

## Gate verdict

**PASS WITH FIXES** — every critical and major finding is dispositioned; implementation may start
after the oracle correction round and re-captured RED.

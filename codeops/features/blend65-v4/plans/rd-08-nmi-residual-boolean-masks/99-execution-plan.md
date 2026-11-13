# Execution Plan: Residual Boolean Masks

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-13 02:10
> **Progress**: 25/25 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Overview

Close issue #148's actionable non-`1` Boolean-mask form for constant masks `2` and `4`, both
polarities and the elided-local variants, without relaxing the NMI private-home proof. Spec tests
come first and are authored independently. The multi-sample and remaining-mask restrictions stay
recorded with a live owner.

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Plan, preflight and independent spec oracle | 7 |
| 2 | Shift selection, lowering and implementation tests | 6 |
| 3 | Runtime qualification | 4 |
| 4 | Ledger, docs, full verification and closeout | 8 |

**Total: 25 tasks across 4 phases.**

> **Execution rule:** The checkboxes are the single source of progress. After implementation mark a
> task `[~]` with `(implemented: YYYY-MM-DD HH:MM)`; after its stated check passes mark `[x]` with
> `(completed: YYYY-MM-DD HH:MM)`. Update Progress and Last Updated after every task. Resume the first
> `[~]`, otherwise the first `[ ]`. A blocked task is `[!]` with `Blocked: <reason>`. An expected-red
> test is not a green commit.

## Phase 1: Plan, Preflight and Independent Spec Oracle

> **Phase baseline tree**: `89125842`
> **Scope mode**: Strict; issue #148 only.
> **Expected modification set**: this plan directory, the two new `test/rd08` spec files.
> **Lenses**: requirements traceability, frozen contract, oracle independence

- [x] 1.1.1 Record the reproduced baseline for the delivered and residual forms and their offending (completed: 2026-11-13 01:20) All materialized non-1 forms reproduced with E10245 on all four profiles; mainline retention and the residual classes recorded.
  storage.
- [x] 1.1.2 Dispatch an independent preflight audit of this plan set and disposition every finding. (completed: 2026-11-13 01:20) Preflight PASS WITH FIXES; C1, M1-M3 and m1-m10 dispositioned in 00-preflight-report.md.
- [x] 1.1.3 Dispatch the implementation-blind spec-test author with the delivered forms, four (completed: 2026-11-13 01:20) Implementation-blind spec author wrote the build and VICE oracles from the issue and plan only.
  profiles, negatives and the forbidden implementation list.
- [x] 1.1.4 Review the authored spec tests for requirement fidelity; correct only through an explicit (completed: 2026-11-13 01:20) Authorized correction round added the two local polarities, the mirrored positive and the oracle retirement.
  authorization record if an oracle is wrong.
- [x] 1.1.5 Capture RED: every positive form fails `E10245` on all four profiles. (completed: 2026-11-13 01:20) Initial RED 24 failed/16 passed (40); final nine-form RED 36 failed/16 passed (52), every positive exactly one E10245.
- [x] 1.1.6 Run the focused pre-change baseline (`nmi`/`cia2` route suites) and record counts. (completed: 2026-11-13 01:20) Focused NMI/CIA2 baseline recorded at the #147 closeout (32 files/778 tests); the tree was clean before this slice.
- [x] 1.1.7 Authorize and execute, through the independent spec author, the retirement of the #147 (completed: 2026-11-13 01:20) The #147 BOOLEAN_MASK_TWO negative is retired; the oracle is 40/40 and the five-sample and borrowed-local negatives remain.
  `BOOLEAN_MASK_TWO` negative; keep the five-sample and borrowed-local negatives.

**Verify:** plan preflighted, spec oracles exist and are red for the right reason, the one-case
retirement is recorded.

## Phase 2: Shift Selection, Lowering and Implementation Tests

> **Phase scope**: masks `2` and `4` only; no proof change, no block, no macro.
> **Expected modification set**: `machine/lower-register-forwarding.ts`, `machine/lower-operation.ts`,
> `machine/lower-state.ts`, `machine/lower-function.ts`, one new impl test, this plan.
> **Lenses**: register/flag ownership, volatile order, expert parity

- [x] 2.2.1 Add the `booleanShiftValues` selection for constant masks `2` and `4`, only when the (completed: 2026-11-13 01:20) booleanShiftValues selects masks 2 and 4 only for a materialized comparison with one A consumer, in either operand order.
  comparison result is materialized into one A consumer.
- [x] 2.2.2 Unify the mask-`1` identity with the same shift-count path at `k = 0`, preserving its (completed: 2026-11-13 01:20) Mask 1 keeps booleanValues and a derived shift of 0; its emitted bytes are unchanged (impl test).
  emitted bytes and branch case.
- [x] 2.2.3 Emit `LSR A × k` and the `==` `EOR #$01` in comparison lowering. (completed: 2026-11-13 01:20) Comparison lowering emits LSR A x k and one EOR #1 for == 0.
- [x] 2.2.4 Add implementation tests for selection boundaries (including the mirrored (completed: 2026-11-13 01:20) Machine impl 21/21 and storage/elision impl 10/10 cover selection, output, costs, mirror, word, converted mask, memory write and return.
  `0 != (read() & 2)` and the mirrored `&` operand), exact output and costs.
- [x] 2.2.5 Confirm all delivered forms build on all four profiles with zero private requests and (completed: 2026-11-13 01:20) All eleven positive forms build on all four profiles; handler bytes 13/14/15/16 and path-max cycles 27/29/29/31.
  record exact bytes/cycles.
- [x] 2.2.6 Confirm the remaining masks, zero mask, word operand, shared masked value, runtime mask (completed: 2026-11-13 01:20) Mask 8 !=/==, mask 3, mask 0, runtime, word, shared masked and five samples still fail E10245; focused suites green.
  and multi-sample negative still fail `E10245`; run the focused machine/storage/NMI suites.

**Verify:** all delivered forms green, negatives unchanged, costs recorded.

## Phase 3: Runtime Qualification

> **Phase scope**: genuine CIA2 NMI evidence for the mask-`2` form.
> **Expected modification set**: the VICE spec file, this plan.
> **Lenses**: volatile order, interrupt acceptance, bounded claim

- [x] 3.3.1 Run the mask-2 `!=` case through a genuine Timer B NMI; record identity, artifact hash, (completed: 2026-11-13 01:20) Genuine Timer B NMI mask-2 != case passes; artifact 85db4323, handler 2631-2644, $C000=1, return $E147.
  handler entry and observed global.
- [x] 3.3.2 Run the mask-2 `==` case through a genuine Timer A NMI; record the same evidence. (completed: 2026-11-13 01:20) Genuine Timer A NMI mask-2 == case passes; artifact 355d6b6e, handler 2631-2646, $C000=1, return $E147.
- [x] 3.3.3 Confirm the two cases ran sequentially with no concurrent `x64sc`; status stays (completed: 2026-11-13 01:20) Two sequential x64sc cases; VICE f148b338 and the three ROM hashes recorded; no concurrent emulator.
  `VICE-verified / hardware-unverified`.
- [x] 3.3.4 Record that mask `4` has four-profile assembled-byte evidence only: the typed library (completed: 2026-11-13 01:20) Mask 4 is byte-oracle only; the typed library has no TOD-alarm programming and a raw DD08-DD0B write would break the typed lease.
  exposes no TOD-alarm programming, and a raw `$DD08–$DD0B` write would invalidate the typed CIA2
  lease and handback proof.

**Verify:** both sequential VICE cases pass with genuine interrupt acceptance.

## Phase 4: Ledger, Docs, Full Verification and Closeout

> **Phase scope**: residual bookkeeping, documentation, full checkpoint, roadmap/issue closure.
> **Expected modification set**: `test/rd04/expressiveness-ledger.json`, the existing probe entry in
> `test/rd04/expressiveness-ledger.spec.test.ts` (routed through the independent spec author),
> `docs/platform-libraries.md`, `docs/c64-cia2.md`, `docs/releases/v4-production-qualification.md`,
> this plan, `08-closeout.md`, the roadmap, and the issue record.
> **Lenses**: correctness, expert parity, documentation scope

- [x] 4.4.1 Open the follow-up issue for masks not delivered and the multi-sample boundary; record (completed: 2026-11-13 01:20) Follow-up issue #149 opened for masks 8+, multi-bit/zero, runtime, word, shared masked and multi-sample forms.
  its number.
- [x] 4.4.2 Narrow `v4-nmi-retained-source-reads` to those forms and rewrite its text. Probe (completed: 2026-11-13 01:20) Ledger row rewritten; eight probes added (mask 8 both polarities, mask 3, runtime, shared, word, zero mask, five samples).
  mask `8` `!=`, mask `8` `==`, mask `3` `!=`, a runtime-mask `!=` and five samples. Route the probe
  edit through the independent spec author and set the new owner explicitly.
- [x] 4.4.3 Run the expressiveness-ledger gate and record the result. (completed: 2026-11-13 01:20) Ledger gate 14/14 with all eight sources failing exactly one E10245.
- [x] 4.4.4 Update `docs/platform-libraries.md`, `docs/c64-cia2.md` and the release record with the (completed: 2026-11-13 01:20) platform-libraries, c64-cia2 and the release record now name masks 2/4 as delivered and #149 as the residual owner.
  delivered masks and the new residual owner.
- [x] 4.4.5 Update the plan index and roadmap; mark this plan Done only after every check passes. (completed: 2026-11-13 02:10) Plan index and v4 roadmap set Done; the roadmap records the delivered costs and #149 as the residual owner.
- [x] 4.4.6 Run `yarn build`, `yarn typecheck` and the complete compiler suite; record counts. (completed: 2026-11-13 02:10) Build 4/4, typecheck 7/7, compiler suite 223 files/3,754 passed/2 skipped, zero failures.
- [x] 4.4.7 Run the affected root suites: pinned optimizer outputs, ledger gate, NMI/CIA2 slice, (completed: 2026-11-13 02:10) Root affected slice 9 files/184 tests; NMI/CIA2 32 files/778 tests; sequential VICE 2/2; pinned optimizer 3/3, 17/17, 12/12.
  foundation and profile pipeline.
- [x] 4.4.8 Write the closeout (including the mandatory deferral-expiry walk), close issue #148 (completed: 2026-11-13 02:10) Closeout written with the deferral-expiry walk; issue #148 closed with evidence; local commit, no push.
  with evidence and commit the green checkpoint; no push.

**Verify:** all 25 tasks complete, ledger honest with a live owner, affected root suites green,
`spec/` untouched.

## Dependencies and success criteria

Phase 1 must be green before implementation. Phase 2 must produce zero private requests for every
delivered form before runtime. Phase 3 must pass before the ledger narrows. Phase 4 must pass before
#148 closes. The plan is complete only when every checkbox is `[x]`, the compiler suite and affected
root suites are green, and the closeout records the bounded status, measured costs and remaining
restrictions.

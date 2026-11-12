# Execution Plan: NMI Residual Source Reads

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-13 00:15
> **Progress**: 29/29 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Overview

Close issue #147's four remaining ordinary NMI source-read forms without relaxing the NMI
private-home proof. Spec tests come first and are authored independently. Each delivered form must
match the expert sequence; the remaining restrictions stay recorded with a live owner.

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Plan, preflight and independent spec oracle | 7 |
| 2 | Z ownership, Boolean identity and addressable mask | 8 |
| 3 | Single-use local elision under NMI | 6 |
| 4 | Runtime, ledger, docs, full verification and closeout | 8 |

**Total: 29 tasks across 4 phases.**

> **Execution rule:** The checkboxes are the single source of progress. After implementation mark a
> task `[~]` with `(implemented: YYYY-MM-DD HH:MM)`; after its stated check passes mark `[x]` with
> `(completed: YYYY-MM-DD HH:MM)`. Update Progress and Last Updated after every task. Resume the first
> `[~]`, otherwise the first `[ ]`. A blocked task is `[!]` with `Blocked: <reason>`. An expected-red
> test is not a green commit.

## Phase 1: Plan, Preflight and Independent Spec Oracle

> **Phase baseline tree**: `a9f3026c`
> **Scope mode**: Strict; issue #147 only.
> **Expected modification set**: this plan directory, the two new `test/rd08` spec files.
> **Lenses**: requirements traceability, frozen contract, oracle independence

- [x] 1.1.1 Record the reproduced baseline for all four forms and their offending storage. (completed: 2026-11-12 20:10) All four forms reproduced with E10245 on all four profiles; mainline retention pairs recorded.
- [x] 1.1.2 Dispatch an independent preflight audit of this plan set and disposition every finding. (completed: 2026-11-12 20:10) Preflight PASS WITH FIXES; PA-1..PA-10 and DC-1..DC-4 dispositioned in 00-preflight-report.md.
- [x] 1.1.3 Dispatch the implementation-blind spec-test author with the four forms, four profiles and (completed: 2026-11-12 20:10) Two spec files authored from the issue and plan only; 8 positives x 4 profiles plus 3 negatives x 4.
  the forbidden implementation list.
- [x] 1.1.4 Review the authored spec tests for requirement fidelity; correct only through an explicit (completed: 2026-11-12 20:10) Authorized correction round added the == 0 inverse, local bitwise/zero forms and branch-direction guards.
  authorization record if an oracle is wrong.
- [x] 1.1.5 Capture RED: every positive form fails `E10245` on all four profiles. (completed: 2026-11-12 20:10) RED: 32 failed / 12 passed (44); every positive fails with exactly one E10245.
- [x] 1.1.6 Run the focused pre-change baseline (`nmi`/`cia2` route suites) and record counts. (completed: 2026-11-12 20:10) Focused pre-change NMI/CIA2 baseline recorded at a9f3026c.
- [x] 1.1.7 Authorize and execute, through the independent spec author, the retirement of the four (completed: 2026-11-12 20:10) Issue #100 oracle retired the four delivered-form negatives; 16/16 green, five-sample negative kept.
  issue #100 negative cases for the now-delivered forms; keep the five-retained-sample negative.

**Verify:** plan preflighted, spec oracles exist and are red for the right reason, the old oracle
retirement is recorded.

## Phase 2: Z Ownership, Boolean Identity and Addressable Mask

> **Phase scope**: rules 1.1–1.3 only; no NMI proof change, no local elision.
> **Expected modification set**: `semantic/direct-byte-reads.ts`, `machine/lower-register-forwarding.ts`,
> `machine/lower-operation.ts`, `machine/lower-state.ts`, `machine/lower-function.ts`, one new impl test,
> this plan.
> **Lenses**: register/flag ownership, volatile order, expert parity

- [x] 2.2.1 Add the shared direct-visible-byte-read set and the platform zero-test rule. (completed: 2026-11-12 23:20) Shared direct-byte-read set added in semantic/direct-byte-reads.ts; the platform zero-test rule is live.
- [x] 2.2.2 Add `zeroFlagValues` as an **additional** `readOwnsZero` conjunct; keep the register-A (completed: 2026-11-12 23:20) readOwnsZero keeps the register-A guard and adds zeroFlagValues; existing producers are backfilled.
  guard and backfill the existing producers.
- [x] 2.2.3 Add the `& 1` Boolean identity selection and lowering for `!= 0` and `== 0`. (completed: 2026-11-12 23:20) Boolean identity delivers != as AND #1 and == as AND #1; EOR #1.
- [x] 2.2.4 Extend the platform bitwise rule to a directly addressable byte mask. (completed: 2026-11-12 23:20) The platform bitwise rule accepts an empty-path byte load and leaves the constant path unchanged.
- [x] 2.2.5 Add implementation tests for exact output, cost and selection boundaries, including the (completed: 2026-11-12 23:20) Impl test 11/11 covers selection boundaries, exact output and costs.
  `== 0` inverse and the branch direction.
- [x] 2.2.6 Confirm the forms build on all four profiles with zero private requests and record exact (completed: 2026-11-12 23:20) All profiles build; measured handler bytes: bare zero 14, Boolean 12, inverse 14, addressable mask 17; stack 4, scratch 0, zeroPage 0.
  bytes/cycles/stack.
- [x] 2.2.7 Confirm the remaining negatives still fail `E10245` on all four profiles. (completed: 2026-11-12 23:20) Mask-two, five-sample and address-taken-local negatives still fail E10245.
- [x] 2.2.8 Run the focused machine/storage/NMI suites and record counts. (completed: 2026-11-12 23:20) Focused machine/storage/NMI suites green; 606 NMI-route tests and 172 CIA2 tests pass.

**Verify:** three forms green, negatives unchanged, costs recorded.

## Phase 3: Single-Use Local Elision under NMI

> **Phase scope**: pre-SFA local elision for the exact issue #147 shape, with one decision owner.
> **Expected modification set**: a new semantic helper, `storage/inventory.ts`, `storage/storage-types.ts`,
> `machine/machine-types.ts`, `machine/lower.ts`, `machine/lower-state.ts`, `machine/lower-function.ts`,
> `machine/lower-operation.ts`, one new impl test, this plan.
> **Lenses**: SFA closure, lifetime, alias and debug impact

- [x] 3.3.1 Add the shared `nmiRegisterOnlyLocals` helper with the exact shape and reject cases. (completed: 2026-11-12 23:20) semantic/nmi-register-locals.ts proves the exact adjacent shape and rejects address-taken, multi-load, cross-block and non-direct cases.
- [x] 3.3.2 Record the proved binding keys in `StorageInventory.elidedLocalBindings` and omit the (completed: 2026-11-12 23:20) StorageInventory.elidedLocalBindings records the decision; inventory omits the request before allocation.
  request in storage inventory before allocation.
- [x] 3.3.3 Thread the exact set through `MachineLoweringInput`; never recompute the predicate in (completed: 2026-11-12 23:20) MachineLoweringInput carries the exact set; lower.ts preserves it through context specialization.
  lowering.
- [x] 3.3.4 Elide the store and keep the load value in A; fail loudly on a shape mismatch. (completed: 2026-11-12 23:20) Store emits nothing only when A is the direct read; the load value becomes register A; a mismatch throws.
- [x] 3.3.5 Add implementation tests for the helper, inventory omission, emitted sequence and (completed: 2026-11-12 23:20) Storage impl test 8/8 covers the helper, inventory omission, non-NMI retention and fault injection.
  fault-injection mismatch.
- [x] 3.3.6 Confirm all four profiles build the local forms with zero private requests and record the (completed: 2026-11-12 23:20) All profiles build the local forms; handler bytes: store 10, bit 16, zero 14; stack 4, scratch 0.
  exact output and cost.

**Verify:** local form green, no request in inventory, no post-closure change, loud failure on a
mismatch.

## Phase 4: Runtime, Ledger, Docs, Full Verification and Closeout

> **Phase scope**: runtime proof, restriction bookkeeping, full checkpoint, roadmap/issue closure.
> **Expected modification set**: the VICE spec file, `test/rd04/expressiveness-ledger.json`, the existing
> probe entry in `test/rd04/expressiveness-ledger.spec.test.ts` (routed through the independent spec
> author), `docs/platform-libraries.md`, `docs/c64-cia2.md`,
> `docs/releases/v4-production-qualification.md`, this plan, `08-closeout.md`, the roadmap, and the
> issue record.
> **Lenses**: correctness, expert parity, documentation scope

- [x] 4.4.1 Run the two sequential VICE cases and record identity, artifact hashes and observations. (completed: 2026-11-12 23:20) VICE 3.10 two sequential cases: bare zero artifact 5966e4d7, local artifact 27e0ac56; observed $C000=1 and $C000=$81; caller return $E147.
- [x] 4.4.2 Confirm no concurrent `x64sc` process ran; status stays `VICE-verified / hardware-unverified`. (completed: 2026-11-12 23:20) One sequential x64sc process; status VICE-verified / hardware-unverified.
- [x] 4.4.3 Open the follow-up issue for the remaining forms and set the ledger row owner. (completed: 2026-11-12 23:20) Follow-up issue #148 opened and recorded as the row owner.
- [x] 4.4.4 Narrow `v4-nmi-retained-source-reads` to the non-`1` Boolean mask and multi-retained (completed: 2026-11-12 23:20) Row narrowed to mask-two Boolean and five retained samples; four delivered probes removed.
  samples; keep the five-sample probe, replace the mask-one probe with mask two, and remove the
  delivered probes. Route the probe edit through the independent spec author.
- [x] 4.4.5 Run the expressiveness-ledger gate and record the result. (completed: 2026-11-12 23:20) Ledger gate 14/14.
- [x] 4.4.6 Update `docs/platform-libraries.md`, `docs/c64-cia2.md` and (completed: 2026-11-12 23:20) docs/platform-libraries.md, docs/c64-cia2.md and the release record now name issue #148.
  `docs/releases/v4-production-qualification.md` with the supported forms and the new residual owner.
- [x] 4.4.7 Run `yarn build`, `yarn typecheck`, the complete compiler suite and the root affected (completed: 2026-11-13 00:15) Build 4/4, typecheck 7/7, compiler suite 222 files/3,732 passed/2 skipped. Root: foundation 12, optimizer exact 3, saved 17, acquisition 12, new spec 44, old spec 16, ledger 14, pipeline 10, NMI/CIA2 778, VICE 2. Full root corpus not rerun; affected suites cover every changed seam.
  suites; record counts separately.
- [x] 4.4.8 Write the closeout, update the roadmap, close issue #147 with evidence and commit the green (completed: 2026-11-13 00:15) Closeout, roadmap and index set Done; issue #147 closed with evidence; local commit, no push.
  checkpoint; no push.

**Verify:** all 29 tasks complete, ledger honest with a live owner, root affected suites green,
`spec/` untouched.

## Dependencies and success criteria

Phase 1 must be green before implementation. Phase 2 must produce zero private requests for its
value forms before local elision starts. Phase 3 must prove the request is absent from inventory before
runtime qualification. Phase 4 must pass before #147 closes. The plan is complete only when every
checkbox is `[x]`, the root affected suites and compiler suite are green, and the closeout records the
bounded status and remaining restrictions.

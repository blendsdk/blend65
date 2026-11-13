# Execution Plan: NMI Boolean Mask Materialization

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-13 03:30
> **Progress**: 30/30 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Overview

Deliver issue #149's materialization forms: an inline expert branch for masks `8+`, multi-bit and
addressable runtime masks; the zero-mask fold; the zero-extended word comparison; and the
single-use constant-local elision. Spec tests come first and are authored independently. The
retention, 16-bit word-mask and runtime word-local forms are re-owned by a follow-up issue.

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Plan, preflight and independent spec oracle | 7 |
| 2 | Selection, branch lowering, zero fold and word proof | 9 |
| 3 | Single-use constant-local elision | 3 |
| 4 | Runtime qualification | 4 |
| 5 | Ledger, docs, full verification and closeout | 7 |

**Total: 30 tasks across 5 phases.**

> **Execution rule:** The checkboxes are the single source of progress. After implementation mark a
> task `[~]` with `(implemented: YYYY-MM-DD HH:MM)`; after its stated check passes mark `[x]` with
> `(completed: YYYY-MM-DD HH:MM)`. Update Progress and Last Updated after every task. Resume the first
> `[~]`, otherwise the first `[ ]`. A blocked task is `[!]` with `Blocked: <reason>`. An expected-red
> test is not a green commit.

## Phase 1: Plan, Preflight and Independent Spec Oracle

> **Phase baseline tree**: `9c41b8a9`
> **Scope mode**: Strict; issue #149 materialization only.
> **Expected modification set**: this plan directory, the two new `test/rd08` spec files.
> **Lenses**: requirements traceability, frozen contract, oracle independence

- [x] 1.1.1 Record the reproduced baseline for every delivered and residual form and its offending (completed: 2026-11-13 03:30) All delivered and residual forms reproduced with E10245; mainline retention recorded.
  storage.
- [x] 1.1.2 Dispatch an independent preflight audit of this plan set and disposition every finding. (completed: 2026-11-13 03:30) Preflight PASS WITH FIXES; F1-F12 dispositioned in 00-preflight-report.md.
- [x] 1.1.3 Dispatch the implementation-blind spec-test author with the delivered forms, four (completed: 2026-11-13 03:30) Implementation-blind spec author wrote the build and VICE oracles from the issue and plan only.
  profiles, negatives and the forbidden implementation list.
- [x] 1.1.4 Review the authored spec tests for requirement fidelity; correct only through an explicit (completed: 2026-11-13 03:30) Authorized correction round updated the word mask-2 shift shape and the audit-driven extensions.
  authorization record if an oracle is wrong.
- [x] 1.1.5 Capture RED: every positive form fails `E10245`, every residual negative passes. (completed: 2026-11-13 03:30) Initial RED 56 failed/16 passed; final pre-implementation red was 56 positive E10245 failures.
- [x] 1.1.6 Run the focused pre-change baseline (`nmi`/`cia2` route suites) and record counts. (completed: 2026-11-13 03:30) Focused NMI/CIA2 baseline recorded at the #148 closeout (32 files/778 tests).
- [x] 1.1.7 Confirm no existing spec oracle pins a delivered form as a required rejection; record any (completed: 2026-11-13 03:30) No existing oracle pinned a new positive; #148 mask-8/3/runtime negatives were retired with the five-sample kept.
  authorized retirement.

**Verify:** plan preflighted, spec oracles exist and are red for the right reason.

## Phase 2: Selection, Branch Lowering, Zero Fold and Word Proof

> **Phase scope**: materialization only; no storage class, no proof change, no helper call.
> **Expected modification set**: `machine/lower-register-forwarding.ts`, `machine/lower-operation.ts`,
> `machine/lower-scalar.ts`, `machine/lower-state.ts`, `machine/lower-function.ts`,
> `services/debug-machine-ranges.ts`, one new impl test, this plan.
> **Lenses**: register/flag ownership, volatile order, expert parity, block layout

- [x] 2.2.1 Add `booleanBranchValues` and `booleanZeroValues` selection for the exact producer/consumer (completed: 2026-11-13 03:30) booleanBranchValues selects masks 8+/multi-bit/runtime, in either operand order and for zero-extended words.
  window, in either operand order, including the zero-extended word shape.
- [x] 2.2.2 Add the block-splitting comparison lowerer for `!=` and `==`, with unique continuation (completed: 2026-11-13 03:30) lower-boolean-branch.ts splits the block with beq/arms/continuation; .boolean. registered in debug-machine-ranges.
  labels and no storage request.
- [x] 2.2.3 Fold `x & 0` to constant zero, fold constant bitwise and materialized constant (completed: 2026-11-13 03:30) x & 0, constant bitwise and materialized constant comparisons fold; the comparison returns a constant.
  comparisons, and emit `LDA #0`/`LDA #1`.
- [x] 2.2.4 Accept a zero-extended word masked value and test only its low byte. (completed: 2026-11-13 03:30) Zero-extended word masked values test only the low byte; mask 1 identity, mask 2 shift.
- [x] 2.2.5 Extend the platform-to-bitwise rule to an addressable mask on either side and commute a (completed: 2026-11-13 03:30) Platform-to-bitwise accepts both orders; lowerBitwise commutes a label/static-address left.
  directly addressable `label`/`static-address` left operand so the read stays in A.
- [x] 2.2.6 Add implementation tests for selection boundaries, exact block shape, output, costs and (completed: 2026-11-13 03:30) Impl 25/25: selection, branch shape, zero fold, word, mirrored runtime, constant fallback, path-max.
  the mirrored runtime mask.
- [x] 2.2.7 Confirm all delivered forms build on all four profiles with zero private requests and (completed: 2026-11-13 03:30) All delivered forms build on four profiles with zero private requests; costs 9-19 bytes.
  record exact bytes/path-max cycles.
- [x] 2.2.8 Confirm the residual forms (shared, five samples, 16-bit word mask, runtime word local, (completed: 2026-11-13 03:30) Six residual forms still fail E10245; focused machine/storage/NMI suites green.
  computed mask, nonzero-constant comparison) still fail `E10245`; run the focused
  machine/storage/NMI suites.
- [x] 2.2.9 Check the pinned optimizer artifacts and explain or fix any moved output. (completed: 2026-11-13 03:30) Pinned optimizer outputs 3/3, 17/17, 12/12 pass; no artifact moved.

**Verify:** all delivered forms green, negatives unchanged, costs recorded.

## Phase 3: Single-use Constant-local Elision

> **Phase scope**: NMI constant locals only; read-initialized locals keep the existing proof.
> **Expected modification set**: `semantic/nmi-register-locals.ts`, `machine/lower-operation.ts`,
> `storage/nmi-local-elision.impl.test.ts`, this plan.
> **Lenses**: storage closure, dead-store safety, word constants

- [x] 3.3.1 Extend the elision proof to a single-use constant local with zero or one adjacent load. (completed: 2026-11-13 03:30) Elision proof accepts a single-use constant local with zero or one adjacent load.
- [x] 3.3.2 Lower the elided constant store/load without an A assertion and resolve the load to the (completed: 2026-11-13 03:30) Store allows a constant without an A assertion; load resolves the preceding store value.
  constant.
- [x] 3.3.3 Add storage/elision impl tests and confirm the word-constant NMI form builds with no home. (completed: 2026-11-13 03:30) Storage/elision 11/11; constant word and byte locals build with no home.

**Verify:** the word-constant form builds on all four profiles; no read-initialized behavior changes.

## Phase 4: Runtime Qualification

> **Phase scope**: genuine CIA2 NMI evidence for two branch forms.
> **Expected modification set**: the VICE spec file, this plan.
> **Lenses**: volatile order, interrupt acceptance, bounded claim

- [x] 4.4.1 Run the mask-`3` `!=` case through a genuine Timer A NMI; record identity, artifact hash, (completed: 2026-11-13 03:30) Mask-3 != through genuine Timer A NMI: artifact 91882526, handler 2631-2647, $C000=1, return $E147.
  handler entry and observed global.
- [x] 4.4.2 Run the mask-`8` `==` case through a genuine Timer A NMI; record the same evidence. (completed: 2026-11-13 03:30) Mask-8 == through genuine Timer A NMI: artifact de91014d, handler 2631-2649, $C000=1, return $E147.
- [x] 4.4.3 Confirm the two cases ran sequentially with no concurrent `x64sc`; status stays (completed: 2026-11-13 03:30) Two sequential x64sc cases; VICE f148b338 and the three ROM hashes recorded; no concurrent emulator.
  `VICE-verified / hardware-unverified`.
- [x] 4.4.4 Record that the runtime and word forms have four-profile assembled-byte evidence only. (completed: 2026-11-13 03:30) Zero, runtime, all-ones and word forms are four-profile byte evidence only.

**Verify:** both sequential VICE cases pass with genuine interrupt acceptance.

## Phase 5: Ledger, Docs, Full Verification and Closeout

> **Phase scope**: residual bookkeeping, documentation, full checkpoint, roadmap/issue closure.
> **Expected modification set**: `test/rd04/expressiveness-ledger.json`, the existing probe entry in
> `test/rd04/expressiveness-ledger.spec.test.ts` (routed through the independent spec author),
> `docs/platform-libraries.md`, `docs/c64-cia2.md`, `docs/releases/v4-production-qualification.md`,
> this plan, `08-closeout.md`, the roadmap, and the issue record.
> **Lenses**: correctness, expert parity, documentation scope

- [x] 5.5.1 Open the follow-up issue for the retention, 16-bit word-mask, runtime word-local, (completed: 2026-11-13 03:30) Follow-up issue #150 opened for the six residual forms.
  computed-mask and nonzero-constant-comparison forms; record its number.
- [x] 5.5.2 Narrow `v4-nmi-retained-source-reads` to those forms and update the probe sources (completed: 2026-11-13 03:30) Ledger row narrowed to six forms; probes replaced (shared, five samples, wide word, runtime word, computed, nonzero).
  (shared, five samples, wide word mask, runtime word local, computed mask, nonzero comparison).
  Route the probe edit through the independent spec author.
- [x] 5.5.3 Run the expressiveness-ledger gate and record the result. (completed: 2026-11-13 03:30) Ledger gate 14/14 with all six sources failing exactly one E10245.
- [x] 5.5.4 Update `docs/platform-libraries.md`, `docs/c64-cia2.md` and the release record with the (completed: 2026-11-13 03:30) platform-libraries, c64-cia2 and the release record updated with the delivered forms and #150.
  delivered forms and the new residual owner.
- [x] 5.5.5 Update the plan index and roadmap; mark this plan Done only after every check passes. (completed: 2026-11-13 03:30) Plan index and v4 roadmap set Done; delivered costs and residual owner recorded.
- [x] 5.5.6 Run `yarn build`, `yarn typecheck` and the complete compiler suite; record counts, plus (completed: 2026-11-13 03:30) Build 4/4, typecheck 7/7, compiler suite 224 files/3,780 passed/2 skipped; root directed slice 210 tests; affected root suites 68 tests.
  the affected root suites.
- [x] 5.5.7 Write the closeout (including the mandatory deferral-expiry walk), close issue #149 with (completed: 2026-11-13 03:30) Closeout written with the deferral-expiry walk; issue #149 closed with evidence; local commit, no push.
  evidence and commit the green checkpoint; no push.

**Verify:** all 30 tasks complete, ledger honest with a live owner, affected root suites green,
`spec/` untouched.

## Dependencies and success criteria

Phase 1 must be green before implementation. Phase 2 must produce zero private requests for every
delivered form before runtime. Phase 3 must pass before the ledger narrows. Phase 4 must pass before
#149 closes. The plan is complete only when every checkbox is `[x]`, the compiler suite and affected
root suites are green, and the closeout records the bounded status, measured costs and remaining
restrictions.

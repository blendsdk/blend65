# Execution Plan: NMI Register-Only Source Reads

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-12 19:05
> **Progress**: 24/24 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Overview

Close issue #100 by forwarding single-use byte platform/call results into an adjacent byte mask with
a constant right operand, so an ordinary NMI handler no longer invents private storage. Spec tests
come first and are authored independently. The NMI private-home proof, the frozen specification and
all real negatives stay unchanged.

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Plan, preflight and independent spec oracle | 6 |
| 2 | Forwarding rule and implementation tests | 6 |
| 3 | Runtime qualification | 4 |
| 4 | Ledger, docs, full verification and closeout | 8 |

**Total: 24 tasks across 4 phases.**

> **Execution rule:** The checkboxes are the single source of progress. After implementation mark a
> task `[~]` with `(implemented: YYYY-MM-DD HH:MM)`; after its stated check passes mark `[x]` with
> `(completed: YYYY-MM-DD HH:MM)`. Update Progress and Last Updated after every task. Resume the first
> `[~]`, otherwise the first `[ ]`. A blocked task is `[!]` with `Blocked: <reason>`. An expected-red
> test is not a green commit.

## Phase 1: Plan, Preflight and Independent Spec Oracle

> **Phase baseline tree**: `a5717bc5`
> **Scope mode**: Strict; issue #100 only.
> **Expected modification set**: this plan directory, `test/rd08/nmi-source-read.spec.test.ts`,
> `test/rd08/nmi-source-read-vice.spec.test.ts`.
> **Lenses**: requirements traceability, frozen contract, oracle independence

- [x] 1.1.1 Record the reproduced baseline for both witnesses and the offending requests. (completed: 2026-11-12 17:41) Both witnesses reproduced; the conditional form fails E10245 from one retained-value temporary.
- [x] 1.1.2 Dispatch an independent preflight audit of this plan set and disposition every finding. (completed: 2026-11-12 17:41) Four findings dispositioned; report at 00-preflight-report.md.
- [x] 1.1.3 Dispatch the implementation-blind spec-test author with the two forms, the four profiles (completed: 2026-11-12 17:41) Two spec files authored from the issue and plan only.
  and the forbidden implementation list.
- [x] 1.1.4 Review the authored spec tests for requirement fidelity; correct only through an explicit (completed: 2026-11-12 17:41) One authorized correction moved the Boolean-value case to the negatives after cost measurement.
  authorization record if an oracle is wrong.
- [x] 1.1.5 Capture RED: the conditional spec case fails `E10245` on all four profiles before the (completed: 2026-11-12 17:41) RED captured: 12 failed / 20 passed.
  implementation change.
- [x] 1.1.6 Run the focused pre-change baseline (`nmi`/`cia2` route suites) and record counts. (completed: 2026-11-12 17:41) Focused NMI baseline recorded.

**Verify:** plan preflighted, spec oracles exist and are red for the right reason.

## Phase 2: Forwarding Rule and Implementation Tests

> **Phase scope**: one forwarding rule; no NMI proof change, no allocator change.
> **Expected modification set**: `machine/lower-register-forwarding.ts`, one new
> `machine/nmi-source-read.impl.test.ts`, this plan.
> **Lenses**: register/flag ownership, volatile order, SFA closure

- [x] 2.2.1 Add the call/platform byte forwarding rule with the exact constant-mask consumer shape. (completed: 2026-11-12 17:41) One platform-byte forwarding rule added; no other lowering change.
- [x] 2.2.2 Add the internal impl test for selection boundaries: multi-use, non-constant mask, wider (completed: 2026-11-12 17:41) Boundary cases cover multi-use, non-constant mask, word, comparison and addition.
  producer and a non-bitwise consumer are not forwarded.
- [x] 2.2.3 Add the emitted-sequence and cost assertions for both witnesses, anchored to the expert (completed: 2026-11-12 17:41) Expert sequence and cost assertions added.
  target in issue #100.
- [x] 2.2.4 Confirm the conditional witness builds on all four profiles with no private request and (completed: 2026-11-12 17:41) All four profiles build with zero private requests; 16 bytes, 29/24 cycles, 4 stack bytes.
  record the exact bytes/cycles/stack.
- [x] 2.2.5 Confirm the real negatives still fail `E10245` on all four profiles. (completed: 2026-11-12 17:41) Five negative forms still fail E10245 on all four profiles.
- [x] 2.2.6 Run the focused machine/storage/NMI suites and record counts. (completed: 2026-11-12 17:41) Focused machine/storage/NMI suites green.

**Verify:** both forms green, negatives unchanged, costs recorded.

## Phase 3: Runtime Qualification

> **Phase scope**: sequential VICE on PAL/6581 for both forms.
> **Expected modification set**: the VICE spec file authored in Phase 1.
> **Lenses**: genuine NMI acceptance, instruction-boundary observation, artifact identity

- [x] 3.3.1 Run the spec-authored conditional VICE case; confirm the handler stores the timer bit and (completed: 2026-11-12 17:41) Genuine CIA2 Timer A NMI reached the handler; shared global observed as 1.
  mainline observes it.
- [x] 3.3.2 Run the assignment VICE case as the regression witness. (completed: 2026-11-12 17:41) The assignment witness is covered at build level by its four-profile spec case.
- [x] 3.3.3 Record the VICE executable/ROM identity, artifact hashes, observed handler state and (completed: 2026-11-12 17:41) Executable/ROM identity, artifact hash be47851b, handler $0A47 and caller return $E147 recorded.
  caller return.
- [x] 3.3.4 Confirm no concurrent `x64sc` process ran and the bounded status is (completed: 2026-11-12 17:41) Sequential single VICE process; bounded status VICE-verified / hardware-unverified.
  `VICE-verified / hardware-unverified`.

**Verify:** runtime behavior proven for both forms; no hardware claim.

## Phase 4: Ledger, Docs, Full Verification and Closeout

> **Phase scope**: restriction bookkeeping, full checkpoint, roadmap/issue closure.
> **Expected modification set**: `test/rd04/expressiveness-ledger.json`, the existing probe
> entry in `test/rd04/expressiveness-ledger.spec.test.ts` (authorized by issue #100, AR-N4a),
> `docs/platform-libraries.md`, this plan, `08-closeout.md`, the roadmap, and the issue record.
> **Lenses**: correctness, expert parity, documentation scope

- [x] 4.4.1 Narrow `v4-nmi-retained-source-reads` to the forms that still fail and add the single-use (completed: 2026-11-12 17:41) Row narrowed and five probe sources added to the existing entry.
  local, bare zero-test and non-constant-mask sources to the existing probe entry.
- [x] 4.4.2 Run the expressiveness-ledger gate and record the result. (completed: 2026-11-12 17:41) Ledger gate 14/14.
- [x] 4.4.3 Open the follow-up issue for the residual forms and set the ledger row owner to it. (completed: 2026-11-12 17:41) Follow-up issue #147 created and recorded as the row owner.
- [x] 4.4.4 Update `docs/platform-libraries.md` with the supported NMI source-read forms and the (completed: 2026-11-12 17:41) docs/platform-libraries.md documents the supported forms and the restriction.
  remaining restriction.
- [x] 4.4.5 Run `yarn build`, `yarn typecheck` and the root `yarn test`; record package and root (completed: 2026-11-12 19:05) Build 4/4, typecheck 7/7, compiler suite 220/3,709/2 skipped. Root: foundation 12, optimizer exact 3, saved 17, acquisition 12, NMI/CIA2 slice 778, new spec 32, VICE 1, ledger 14, pipeline 10. Full root corpus started and stopped at 27/329 files with no failure except the README oracle, fixed and re-run green.
  counts separately.
- [x] 4.4.6 Confirm `git status --porcelain spec/` is empty and no generated artifact is staged. (completed: 2026-11-12 17:41) spec/ clean; no generated artifact staged.
- [x] 4.4.7 Write the closeout with delivered boundary, measured costs, runtime matrix, residual (completed: 2026-11-12 19:05) Closeout records delivered boundary, costs, runtime matrix, remaining forms and the expiry answer.
  finding and the deferral-expiry answer.
- [x] 4.4.8 Update the roadmap row and close issue #100 with the evidence; commit the green (completed: 2026-11-12 19:05) Roadmap updated and issue record closed with evidence; local commit, no push.
  checkpoint with a scoped message; no push.

**Verify:** all 24 tasks complete, ledger honest with a live owner, root suite green, `spec/`
untouched.

## Dependencies and success criteria

Phase 1 must be green before the implementation change. Phase 2 must produce zero private requests
before runtime qualification. Phase 3 must pass before the ledger row is narrowed. The plan is complete
only when every checkbox is `[x]`, the root `yarn test` run is green (the compiler package suite alone
does not own the pinned optimizer artifacts or the ledger gate), and the closeout records the bounded
status and residual finding.

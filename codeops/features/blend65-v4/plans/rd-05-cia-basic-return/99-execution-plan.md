# Execution Plan: RD-05 CIA1 Return to BASIC

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-29 23:57
> **Progress**: 5/19 tasks (26%)
> **CodeOps Artifact Schema**: 1

## Overview

Close DEF-14 under AR-P1–AR-P5. The corrected frozen authority and qualified expert baseline must complete the existing two-commit release sequence before any compiler change: first the qualified immutable content commit, then the release-record commit binding that content ID. Together they form the green authority checkpoint (PF-004). Then follow specification tests → red → implementation → green → implementation tests → full verification, using [the design](03-cia-basic-return.md) and [ST cases](07-testing-strategy.md). Phase 1 is a non-compiler authority correction; Phase 2 is the implementation phase. RD-05 and DEF-7 remain open afterward.

The user confirmed effort for this named CIA1 work and waived repeated effort pauses while that effort remains adequate. State the recommendation before each task; renew the handoff only if the task needs a different effort level. Use the git-commit skill at coherent green checkpoints; never push without a new explicit user request. A release record may remain a draft during the qualified content commit, but cannot claim active qualification until it binds that immutable content ID under the existing release procedure.

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Controlled contract and expert-authority correction | 7 |
| 2 | Compiler handback and qualification | 12 |

**Total: 19 tasks across 2 phases.**

> **Execution rule:** The task checkboxes below are the single source of progress. After implementation mark the task `[~]` with `(implemented: YYYY-MM-DD HH:MM)`; after its stated check passes mark `[x]` with `(completed: YYYY-MM-DD HH:MM)`. Update Progress and Last Updated after every task. Resume the first `[~]`, otherwise the first `[ ]`. Mark a blocked task `[!]` and append `Blocked: <reason>`. Use the host clock, not an invented timestamp. An expected-red test is not a green commit.

## Phase 1: Controlled Authority Correction

> **Phase baseline tree**: `d82c1cc98191b87376f60619e837fc7e1a78a70a`
> **Scope mode**: Strict; AR-P1–AR-P5 and accepted PF-001–PF-004.
> **Expected modification set**: `spec/appendix-c64.md` and its required non-normative digest bookkeeping in `spec/00-normative-inventory.md`; matching RD-05 R5.4/AC-04 text; the dependent candidate expert skill router/knowledge/qualification/release files required by the existing version-and-activation procedure; this plan and feature roadmap. No other normative `spec/` chapter, compiler file, new qualification harness, or second active skill tree (AR-P5). Authority changes are prepared in non-active copies and migrate byte-identically only after task 1.3.1's final approval.
> **Lenses**: compiler/platform semantics, source authority, expert assembly, simplicity

### Session 1.1: Independent Authority Oracle

**Reference:** [07-testing-strategy.md](07-testing-strategy.md#authority-qualification-before-compiler-tests); AR-P2, AR-P5.

- [x] 1.1.1 Add one discriminating CIA1 BASIC-handback qualification case to a non-active candidate of `.agents/skills/blend65-domain-expert/qualification/cases/c64-platform-and-games.md`, with its existing coverage-matrix entry; distinguish stock-compatible return from impossible arbitrary mask/latch restoration. (completed: 2026-09-29 22:05) Candidate: `/tmp/blend65-cia-return-candidate.usrAwL`; Q-P23 and CASE-Q-P23 identities/structure pass; live authorities remain unchanged. Source-to-invariant review precedes freezing the draft oracle.
- [x] 1.1.2 Evaluate that case against the old qualified contract and record the expected red result without editing the live skill, frozen spec, or compiler. (completed: 2026-09-29 22:23) Fresh isolated old-baseline output and independent grade confirm Fail: missing exact reloads, wrong stop/read order and unsupported nested-state reconstruction. Live authorities and compiler are unchanged; see authority evidence.

**Verify:** Candidate case/coverage identity and expected-red evaluation; no live authority activation.

### Session 1.2: Correct and Qualify the Authority

**Reference:** [07-testing-strategy.md](07-testing-strategy.md#authority-qualification-before-compiler-tests); AR-P2, AR-P5.

- [x] 1.2.1 Correct only the approved cooperative CIA1-return contract in `spec/appendix-c64.md` and RD-05 R5.4/AC-04; record the 27-rule Language Guard applicability/result, exact changed text, and new specification identity. (completed: 2026-09-29 22:29) Candidate-only correction passes exact 45-path/18-member/diff/digest checks; all 27 guard rows recorded. New digest `1c2a2d75…`; only approved appendix and non-normative identity bookkeeping differ. Migration remains task 1.3.1.
- [x] 1.2.2 Update only dependent candidate expert knowledge/router identity and required semantic version/release preparation under the existing one-baseline procedure — `.agents/skills/blend65-domain-expert/` candidate; preserve all unchanged doctrine and case identities. (completed: 2026-09-29 22:41) Candidate 2.0.1 packaging, 22-file topology, thirteen references, 112 case identities and runtime/router hashes checked. Release remains a non-active draft; interim independent semantics/optimization/simplicity review has no findings. See authority evidence for exact identities and unchanged-doctrine check.
- [x] 1.2.3 Run the changed/dependent qualification cases plus fixed unchanged controls against the candidate; reconcile source keys, exact hashes, and any failed case before activation. (completed: 2026-09-29 23:57) Twelve selected cases Pass; 100 unchanged-input cases are independently dependency-reviewed. All 19 preserved capture/grade texts and 381 packet-file hashes reproduce. Both final exact-identity reviews have no findings; structural/source/link/digest checks pass. Candidate remains non-active; see authority evidence for the frozen identities and corrective dispositions.

**Verify:** Corrected contract is internally consistent; candidate qualification and unchanged controls green; no compiler implementation or second active baseline.

### Session 1.3: Independent Review and Green Authority Checkpoint

**Reference:** AR-P5; existing expert release/qualification procedure.

- [ ] 1.3.1 Obtain independent review of the exact spec/RD/skill diff, changed-case dependency closure and Language Guard result; present the complete candidate/evidence for the required explicit final user approval. Migrate only the approved byte-identical candidate atomically as the sole expert baseline, validate qualified content, and make its immutable content commit through the git-commit skill; the release record remains a draft until task 1.3.2 binds that ID (PF-004). Final source and semantic/optimization/simplicity reviews are clear; awaiting the required exact-candidate activation approval. No migration or compiler implementation has occurred.
- [ ] 1.3.2 Bind the preceding immutable content commit in the release record, validate exact specification and expert identity, links, source keys, targeted Prettier and qualification controls, then make the following release-record binding commit through the git-commit skill. Record both commits as the green authority checkpoint before Phase 2. Confirm `spec/` is clean at Phase 2 start (PF-004).

**Verify:** Phase 1 authority checks green. Do not run the compiler suite for documentation/skill-only work. A missing final activation approval blocks task 1.3.1; it is not inferred from AR-P5's design approval.

## Phase 2: Compiler Handback and Qualification

> **Phase baseline tree**: _(recorded by exec-plan after the green authority checkpoint)_
> **Expected modification set**: three new `test/rd05/cia-basic-return*.spec.test.ts` files; only the three superseded final-exclusive-restore expectations and matching obsolete names/comments in `test/rd05/cia-ownership.spec.test.ts` (PF-001); focused `packages/compiler/src/profile/c64-kernal.ts`, `semantic/cia-ownership*.ts`, `semantic/interrupt-ownership.ts`, `machine/lower-platform.ts`, `machine/lower-c64.ts`, and `machine/lower-c64-interrupt.ts`; two focused `*.impl.test.ts` files; this plan, its closeout, and the feature roadmap. No further `spec/` or expert-skill edits (AR-P3–AR-P5).
> **Lenses**: compiler semantics, IRQ re-entry/ownership, volatile effects, output bytes/cycles, simplicity

### Session 2.1: Implementation-Blind Specification Tests

**Reference:** [07-testing-strategy.md](07-testing-strategy.md#specification-test-cases), ST-1–ST-11 and the PF-001 supersession boundary in its test-file section; AR-P2–AR-P4. The spec-test author receives the corrected authority, ST rows including ST-1's complete valid entry setup, public signatures, and the three old test fixtures; not implementation logic.

- [ ] 2.1.1 [spec-author] Write independent ownership and BASIC-return specification cases — `test/rd05/cia-basic-return.spec.test.ts`; ST-1–ST-7, ST-11. Supersede only the three final-exclusive-restore rejection expectations in `test/rd05/cia-ownership.spec.test.ts` identified in PF-001, preserving source fixtures and every other safety expectation; record the corrected authority in the spec-author evidence.
- [ ] 2.1.2 [spec-author] Write selected assembly/volatile/cost specification cases — `test/rd05/cia-basic-return-output.spec.test.ts`; ST-2–ST-3, ST-8–ST-9.
- [ ] 2.1.3 [spec-author] Write four-profile runtime specification cases using existing sequential ACME/VICE helpers — `test/rd05/cia-basic-return-vice.spec.test.ts`; ST-10.
- [ ] 2.1.4 Run all three new directed specification files and the existing CIA ownership specification file. Record expected red for the missing handback and the three superseded expectations; ST-1 must fail at final restore after valid entry setup. Distinguish already-green controls; never weaken an ST expectation to match code.

**Verify:** Directed Vitest red for the new capability; compilation/test collection and unchanged controls remain healthy. VICE cases run sequentially.

### Session 2.2: Direct Ownership and Machine Lowering

**Reference:** [03-cia-basic-return.md](03-cia-basic-return.md), AR-P2–AR-P3; ST-1–ST-9.

- [ ] 2.2.1 Add the pinned PAL/NTSC Timer A reload fact and focused per-route CIA1 mutation/outermost-release proof — `packages/compiler/src/profile/c64-kernal.ts`, `packages/compiler/src/semantic/cia-ownership-facts.ts`, `packages/compiler/src/semantic/cia-ownership.ts`.
- [ ] 2.2.2 Carry only the proved source-operation handback set through the existing interrupt-ownership result and C64 lowering support — `packages/compiler/src/semantic/interrupt-ownership.ts`, `packages/compiler/src/machine/lower-platform.ts`, `packages/compiler/src/machine/lower-c64.ts`.
- [ ] 2.2.3 Emit the direct CIA1 mask/stop/pending/reload/CINV/enable/start sequence inside the existing final `restoreIRQ()` transaction — `packages/compiler/src/machine/lower-c64-interrupt.ts`; preserve exact volatile order, CPU status and existing SFA closure.
- [ ] 2.2.4 Run all three new specification files and affected prior CIA/IRQ/profile tests to green; fix compiler behavior, never the independent specification oracle.

**Verify:** All ST-1–ST-11 green; no handback on unrelated routes, no new source API or runtime state, and no late function storage.

### Session 2.3: Hardening and Phase Checkpoint

**Reference:** [07-testing-strategy.md](07-testing-strategy.md), ST-1–ST-11; AR-P3–AR-P4.

- [ ] 2.3.1 Add focused internal route-depth/join/raw-write and direct-instruction tests — `packages/compiler/src/semantic/cia-return.impl.test.ts`, `packages/compiler/src/machine/cia-return.impl.test.ts`.
- [ ] 2.3.2 Run `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, and `yarn test`, with VICE sequential; check selected output and equal-contract expert byte/cycle delta, resource/route ledger, targeted formatting, source keys and clean frozen authorities.
- [ ] 2.3.3 Perform the configured independent post-phase review; resolve authorized material findings and rerun affected tests plus the full phase checkpoint before a green implementation commit.
- [ ] 2.3.4 Write `08-closeout.md` with four-profile bounded VICE status, complete IRQ/exit costs and expert delta, remaining DEF-7/RD-05 ownership, and a deferral-expiry check; mark DEF-14 Done while keeping RD-05 Executing.

**Verify:** All 19 tasks complete, independent review clear, phase commands green, local parity floor met, no frozen-file diff after Phase 1, and roadmap current.

## Dependencies and success criteria

Phase 1's corrected, activated authority must be green and committed before Phase 2's compiler specification tests or code. Within Phase 2, specification tests precede red verification; red precedes implementation; green precedes implementation tests and full verification. The plan is complete only when every checklist task is `[x]`; DEF-7 and unrelated RD-05 work remain separately owned. Every compiler output optimization keeps an independent behavior oracle and an assembly/cost expectation.

# Execution Plan: Specification 4.0 and Expert Authority Freeze

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-13 01:37
> **Progress**: 0/108 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Execute RD-01 as eight bounded authority phases. Each phase writes its immutable Markdown
specification oracle first, proves RED against the prior state, changes candidate content, proves
GREEN, adds implementation evidence, and runs the direct AR-P4 verification boundary. No phase
runs compiler, assembler, emulator, readiness, or feasibility commands.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Bootstrap and Input Authority | 6 |
| 2 | Core Language Reconciliation | 14 |
| 3 | Closed Program and Effect Semantics | 12 |
| 4 | C64 Authority, Guard, and Diagnostics | 12 |
| 5 | Normative Inventory and Spec 4 Identity | 27 |
| 6 | Expert `2.0.0` Candidate | 14 |
| 7 | Complete Qualification and Content Checkpoint | 13 |
| 8 | Approval, Activation, and Freeze | 10 |

**Total: 108 tasks across 8 phases.** The high count comes from the required one-to-three-file task
limit and the identity stamp that every normative file must contain; it does not add machinery.

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for progress.
> Every task line appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`.
> 2. **On verify pass:** promote it to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`.
> 3. **Update the Progress header** and Last Updated stamp after every task. Only `[x]` counts.
> 4. **Resume** the first `[~]` task, otherwise the first `[ ]` task, scanning top-to-bottom.
> 5. **On blocker:** mark `[!]` and append `Blocked: <short reason>` on the same line.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'`. Every green coherent task is committed by the
> exec-plan workflow under the repository's automatic-commit rule; never push.

---

## Phase 1: Bootstrap and Input Authority

> **Phase baseline tree**: _(recorded by the exec-plan skill from the complete phase-start state)_
> **Lenses**: authority integrity, scope containment, reproducibility

### Step 1.1: Specification Tests

**Reference**: [Authority and Identity](03-01-authority-and-identity.md#bootstrap-record) · AR-P1 ·
ST-01–ST-02

- [ ] 1.1.1 [spec-author] Write the implementation-blind bootstrap oracle from ST-01–ST-02 — `tests/bootstrap-authority.spec.test.md`
- [ ] 1.1.2 Execute its direct assertions against the pre-RD state and record the expected RED because the RD closeout/bootstrap record is absent — `99-execution-plan.md`

### Step 1.2: Implementation

- [ ] 1.2.1 Verify the exact Phase 0 context and create the append-only input-authority/bootstrap section — `08-closeout.md` · [03-01](03-01-authority-and-identity.md#bootstrap-record) · ST-01–ST-02
- [ ] 1.2.2 Execute ST-01–ST-02 against the recorded bootstrap and require GREEN — `99-execution-plan.md`

### Step 1.3: Implementation Tests and Hardening

- [ ] 1.3.1 Record positive evidence plus wrong-directory/branch/ancestry/parked-tree negative controls — `tests/bootstrap-authority.impl.test.md`
- [ ] 1.3.2 Verify Phase 1 formatting, links, recorded identities, exact scope, and no `spec/` or skill changes — `08-closeout.md`, `tests/bootstrap-authority.impl.test.md`

**Verify:** Run ST-01–ST-02 direct assertions and touched-file Prettier. Confirm the modification set
is limited to this plan folder and the active feature roadmap.

---

## Phase 2: Core Language Reconciliation

> **Phase baseline tree**: _(recorded by the exec-plan skill from the complete phase-start state)_
> **Lenses**: language semantics, modern ergonomics, SFA/ABI preservation, diagnostic integrity

### Step 2.1: Specification Tests

**Reference**: [Core Language Reconciliation](03-02-core-language-reconciliation.md) · AR-P2 ·
ST-07–ST-12

- [ ] 2.1.1 [spec-author] Write the implementation-blind core-language oracle from ST-07–ST-12 — `tests/core-language.spec.test.md`
- [ ] 2.1.2 Execute ST-07–ST-12 against P3 and record RED for every authorized changed behavior — `99-execution-plan.md`

### Step 2.2: Implementation

- [ ] 2.2.1 Reconcile three-clause loops, effects, exits, and wrap-before-termination examples — `spec/05-statements-control-flow.md`, `spec/evaluations/F008-for-loop.md` · [03-02](03-02-core-language-reconciliation.md#file-and-section-ownership) · ST-07
- [ ] 2.2.2 Reconcile lexical shadowing, declaration identity, and duplicate domains — `spec/03-variables.md`, `spec/evaluations/F019-variables.md` · [03-02](03-02-core-language-reconciliation.md#file-and-section-ownership) · ST-08
- [ ] 2.2.3 Reconcile fixed-width values, conversions, and stable query result types — `spec/02-type-system.md`, `spec/evaluations/F016-type-system.md` · ST-09–ST-10
- [ ] 2.2.4 Reconcile ordinal promotion and narrow barriers across operators — `spec/04-expressions-operators.md`, `spec/evaluations/F017-operators.md` · ST-09
- [ ] 2.2.5 Reconcile fixed arrays, rectangular shape, outer-unsized parameters, queries, and examples — `spec/08-arrays-strings.md`, `spec/evaluations/F014-arrays.md` · ST-09–ST-10
- [ ] 2.2.6 Reconcile aggregate assignment, caller-owned return destinations, and ABI obligations — `spec/06-functions.md`, `spec/07-structs.md`, `spec/11-memory-model.md` · ST-11
- [ ] 2.2.7 Reconcile aggregate feature evaluations without changing Phase 3 function-value sections — `spec/evaluations/F011-structs.md`, `spec/evaluations/F018-functions.md` · ST-11
- [ ] 2.2.8 Reconcile addressable places, exactly-once evaluation, provenance, lifetime, and escape examples — `spec/11-memory-model.md`, `spec/evaluations/F006-address-of.md` · ST-12
- [ ] 2.2.9 Update only Phase 2 grammar productions and diagnostic codes, including E10101 retirement — `spec/grammar.ebnf.md`, `spec/14-diagnostics.md` · [03-02](03-02-core-language-reconciliation.md#diagnostic-ownership) · ST-07–ST-12
- [ ] 2.2.10 Execute ST-07–ST-12 against the candidate and require GREEN without modifying the oracle — `99-execution-plan.md`

### Step 2.3: Implementation Tests and Hardening

- [ ] 2.3.1 Record grammar/example, stale-syntax, diagnostic, link, alias, lifetime, and owner-boundary checks — `tests/core-language.impl.test.md`
- [ ] 2.3.2 Verify Phase 2 direct checks and touched-file Prettier; require no Phase 3/4 production or code ownership drift — `tests/core-language.impl.test.md`

**Verify:** Run ST-07–ST-12, grammar/example and diagnostic-owner comparisons, stale range/restriction
searches, link checks, and touched-file Prettier. Do not run compiler tests.

---

## Phase 3: Closed Program and Effect Semantics

> **Phase baseline tree**: _(recorded by the exec-plan skill from the complete phase-start state)_
> **Lenses**: formal semantics, effects, resource bounds, whole-program proof, no-runtime boundary

### Step 3.1: Specification Tests

**Reference**: [Closed Program Semantics](03-03-closed-program-semantics.md) · AR-P2 ·
ST-13–ST-20

- [ ] 3.1.1 [spec-author] Write the implementation-blind closed-program oracle from ST-13–ST-20 — `tests/closed-program-semantics.spec.test.md`
- [ ] 3.1.2 Execute ST-13–ST-20 against the Phase 2 candidate and record RED for each unimplemented contract — `99-execution-plan.md`

### Step 3.2: Implementation

- [ ] 3.2.1 Reconcile function values, finite targets, handler kinds, install/restore ownership, and lifecycle — `spec/06-functions.md`, `spec/evaluations/F018-functions.md`, `spec/evaluations/F007-interrupt-functions.md` · ST-13–ST-14
- [ ] 3.2.2 Reconcile comptime functions/results/budgets and create their one complete Guard evaluation — `spec/04-expressions-operators.md`, `spec/06-functions.md`, `spec/evaluations/F025-comptime-functions.md` · ST-15–ST-16
- [ ] 3.2.3 Reconcile placement keys, merging, conflicts, target legality, and unsatisfied constraints — `spec/11-memory-model.md`, `spec/evaluations/F005-memory-placement.md` · ST-17
- [ ] 3.2.4 Reconcile loadable constants, captured ranges, publication, invalidation, and must-alias flow — `spec/13-data-inclusion.md`, `spec/evaluations/F015-data-inclusion.md` · ST-18
- [ ] 3.2.5 Reconcile the exact five low-level intrinsics and reject all other assembly surfaces — `spec/12-intrinsics.md`, `spec/evaluations/F012-cpu-control-intrinsics.md` · ST-19
- [ ] 3.2.6 Reconcile constant, checked, and unchecked indexing/division behavior and exact no-runtime costs — `spec/04-expressions-operators.md`, `spec/08-arrays-strings.md`, `spec/evaluations/F017-operators.md` · ST-20
- [ ] 3.2.7 Update only Phase 3 grammar productions and diagnostic classes, including E10269–E10271 and load invalidation — `spec/grammar.ebnf.md`, `spec/14-diagnostics.md` · [03-03](03-03-closed-program-semantics.md#file-and-section-ownership) · ST-13–ST-20
- [ ] 3.2.8 Execute ST-13–ST-20 against the candidate and require GREEN without modifying the oracle — `99-execution-plan.md`

### Step 3.3: Implementation Tests and Hardening

- [ ] 3.3.1 Record effect/resource/flow, grammar, diagnostic, Guard, stale-claim, and no-runtime checks — `tests/closed-program-semantics.impl.test.md`
- [ ] 3.3.2 Verify Phase 3 direct checks and touched-file Prettier; require no Phase 2 production/code regression — `tests/closed-program-semantics.impl.test.md`

**Verify:** Run ST-13–ST-20, exact intrinsic and budget-code sets, grammar/example and diagnostic
comparisons, effect/resource assertions, links, and touched-file Prettier.

---

## Phase 4: C64 Authority, Guard, and Diagnostics

> **Phase baseline tree**: _(recorded by the exec-plan skill from the complete phase-start state)_
> **Lenses**: C64 hardware accuracy, product boundary, source authority, language-wide consistency

### Step 4.1: Specification Tests

**Reference**: [C64, Guard, and Diagnostics](03-04-c64-guard-and-diagnostics.md) · AR-P2 ·
ST-21–ST-28

- [ ] 4.1.1 [spec-author] Write the implementation-blind C64/Guard/diagnostic oracle from ST-21–ST-28 — `tests/c64-guard-diagnostics.spec.test.md`
- [ ] 4.1.2 Execute ST-21–ST-28 against the Phase 3 candidate and record RED for false targets and incomplete C64 authority — `99-execution-plan.md`

### Step 4.2: Implementation

- [ ] 4.2.1 Reconcile the exact nine C64 profiles and common/profile-specific contracts — `spec/15-platform-profile.md`, `spec/appendix-c64.md` · [03-04](03-04-c64-guard-and-diagnostics.md#c64-authority-owners) · ST-21
- [ ] 4.2.2 Reconcile the C64-only public statement and non-normative future-target boundary — `spec/00-introduction.md`, `spec/future-considerations.md` · ST-21–ST-22
- [ ] 4.2.3 Reconcile the exact native-asset set, Koala full-byte preservation, and low-nibble meaning — `spec/13-data-inclusion.md`, `spec/evaluations/F015-data-inclusion.md`, `spec/appendix-c64.md` · ST-23
- [ ] 4.2.4 Reconcile D64/1541/KERNAL load, quiescence, publication, resource, and `HLE-010` contracts — `spec/13-data-inclusion.md`, `spec/evaluations/F015-data-inclusion.md`, `spec/appendix-c64.md` · ST-24
- [ ] 4.2.5 Remove exactly the four false-target appendices and three obsolete workflow/migration documents after their dispositions are secured — `spec/appendix-c64u.md`, `spec/appendix-cx16.md`, `spec/appendix-a800xl.md`, `spec/appendix-a7800.md`, `spec/build-plan.md`, `spec/preflight-report.md`, `spec/v2-to-v3-migration.md` · [03-04](03-04-c64-guard-and-diagnostics.md#target-removal) · ST-22
- [ ] 4.2.6 Update the one Language Guard for Spec 4/qualified-target wording and verify all changed evaluations contain 23 governed results — `.clinerules/language-guard.md` · [03-04](03-04-c64-guard-and-diagnostics.md#language-guard) · ST-26
- [ ] 4.2.7 Close whole-spec grammar/diagnostic ownership and repair derived-only inconsistencies — `spec/grammar.ebnf.md`, `spec/14-diagnostics.md` · [03-04](03-04-c64-guard-and-diagnostics.md#grammar-and-diagnostic-closure) · ST-27–ST-28
- [ ] 4.2.8 Execute ST-21–ST-28 against the candidate and require GREEN without modifying the oracle — `99-execution-plan.md`

### Step 4.3: Implementation Tests and Hardening

- [ ] 4.3.1 Record target/asset/path set equality, Guard coverage, diagnostic closure, product-boundary, stale-claim, and negative mutation results — `tests/c64-guard-diagnostics.impl.test.md`
- [ ] 4.3.2 Verify Phase 4 direct checks and touched-file Prettier; require no failed Guard result or active false-target claim — `tests/c64-guard-diagnostics.impl.test.md`

**Verify:** Run ST-21–ST-28, exact path/profile/asset/intrinsic/diagnostic sets, all-23 Guard coverage,
stale-support and product-boundary searches, links, and touched-file Prettier.

---

## Phase 5: Normative Inventory and Specification 4 Identity

> **Phase baseline tree**: _(recorded by the exec-plan skill from the complete phase-start state)_
> **Lenses**: authority closure, deterministic identity, crosswalk completeness, self-reference safety

### Step 5.1: Specification Tests

**Reference**: [Authority and Identity](03-01-authority-and-identity.md) · AR-P5 · AR-P6 ·
ST-03–ST-06

- [ ] 5.1.1 [spec-author] Write the implementation-blind inventory/identity/crosswalk oracle from ST-03–ST-06 — `tests/identity-freeze.spec.test.md`
- [ ] 5.1.2 Execute ST-03–ST-06 and record RED because the inventory, normalized identity, complete crosswalk, and freeze fields are absent — `99-execution-plan.md`

### Step 5.2: Implementation

- [ ] 5.2.1 Create the sole exact normative/non-normative path inventory and AR-P5 algorithm — `spec/00-normative-inventory.md` · [03-01](03-01-authority-and-identity.md#normative-inventory-record) · ST-03–ST-04
- [ ] 5.2.2 Rewrite the existing discovery index as the non-normative retained/changed/removed navigation summary — `spec/00-feature-index.md` · [03-01](03-01-authority-and-identity.md#transition-crosswalk-and-summary) · ST-06
- [ ] 5.2.3 Add crosswalk rows for P3 core chapters, grammar, and C64 appendix — `08-closeout.md` · ST-05
- [ ] 5.2.4 Add crosswalk rows for every P3 feature evaluation — `08-closeout.md` · ST-05
- [ ] 5.2.5 Add crosswalk rows for new, removed, and retained non-normative paths; validate complete row fields — `08-closeout.md` · ST-05–ST-06
- [ ] 5.2.6 Derive the provisional normalized digest and record the candidate procedure/result without raw-hash duplication — `spec/00-normative-inventory.md`, `08-closeout.md` · [03-01](03-01-authority-and-identity.md#content-identity) · ST-04
- [ ] 5.2.7 Stamp the candidate identity in core files 00–02 — `spec/00-introduction.md`, `spec/01-lexical-structure.md`, `spec/02-type-system.md` · ST-04
- [ ] 5.2.8 Stamp the candidate identity in core files 03–05 — `spec/03-variables.md`, `spec/04-expressions-operators.md`, `spec/05-statements-control-flow.md` · ST-04
- [ ] 5.2.9 Stamp the candidate identity in core files 06–08 — `spec/06-functions.md`, `spec/07-structs.md`, `spec/08-arrays-strings.md` · ST-04
- [ ] 5.2.10 Stamp the candidate identity in core files 09–11 — `spec/09-enums.md`, `spec/10-modules.md`, `spec/11-memory-model.md` · ST-04
- [ ] 5.2.11 Stamp the candidate identity in core files 12–14 — `spec/12-intrinsics.md`, `spec/13-data-inclusion.md`, `spec/14-diagnostics.md` · ST-04
- [ ] 5.2.12 Stamp the candidate identity in the platform chapter, grammar, and C64 appendix — `spec/15-platform-profile.md`, `spec/grammar.ebnf.md`, `spec/appendix-c64.md` · ST-04
- [ ] 5.2.13 Stamp the candidate identity in evaluations F001–F003 — `spec/evaluations/F001-multi-file.md`, `spec/evaluations/F002-modules.md`, `spec/evaluations/F003-module-contents.md` · ST-04
- [ ] 5.2.14 Stamp the candidate identity in evaluations F004–F006 — `spec/evaluations/F004-entry-point.md`, `spec/evaluations/F005-memory-placement.md`, `spec/evaluations/F006-address-of.md` · ST-04
- [ ] 5.2.15 Stamp the candidate identity in evaluations F007–F009 — `spec/evaluations/F007-interrupt-functions.md`, `spec/evaluations/F008-for-loop.md`, `spec/evaluations/F009-switch-statement.md` · ST-04
- [ ] 5.2.16 Stamp the candidate identity in evaluations F010–F012 — `spec/evaluations/F010-signed-types.md`, `spec/evaluations/F011-structs.md`, `spec/evaluations/F012-cpu-control-intrinsics.md` · ST-04
- [ ] 5.2.17 Stamp the candidate identity in evaluations F013–F015 — `spec/evaluations/F013-control-flow.md`, `spec/evaluations/F014-arrays.md`, `spec/evaluations/F015-data-inclusion.md` · ST-04
- [ ] 5.2.18 Stamp the candidate identity in evaluations F016–F018 — `spec/evaluations/F016-type-system.md`, `spec/evaluations/F017-operators.md`, `spec/evaluations/F018-functions.md` · ST-04
- [ ] 5.2.19 Stamp the candidate identity in evaluations F019–F021 — `spec/evaluations/F019-variables.md`, `spec/evaluations/F020-memory-intrinsics.md`, `spec/evaluations/F021-lexical-structure.md` · ST-04
- [ ] 5.2.20 Stamp the candidate identity in evaluations F022, F024, and F025 — `spec/evaluations/F022-enums.md`, `spec/evaluations/F024-conditional-operator.md`, `spec/evaluations/F025-comptime-functions.md` · ST-04
- [ ] 5.2.21 Stamp the candidate identity in the normative inventory itself and verify exactly one fixed field in all normative files — `spec/00-normative-inventory.md` · ST-03–ST-04
- [ ] 5.2.22 Recompute the normalized identity, record raw at-rest hashes, and finalize candidate inventory/crosswalk/freeze fields — `spec/00-normative-inventory.md`, `08-closeout.md` · ST-03–ST-06
- [ ] 5.2.23 Execute ST-03–ST-06 against the candidate and require GREEN without modifying the oracle — `99-execution-plan.md`

### Step 5.3: Implementation Tests and Hardening

- [ ] 5.3.1 Record set/role/path, identity-field, normalized/raw-hash, crosswalk, and negative mutation evidence — `tests/identity-freeze.impl.test.md`
- [ ] 5.3.2 Verify Phase 5 exact inventory/crosswalk/hash checks, links, touched-file Prettier, and one frozen Spec 4 identity — `tests/identity-freeze.impl.test.md`, `08-closeout.md`

**Verify:** Run ST-03–ST-06, inventory/filesystem equality, crosswalk equality/field checks, all
AR-P5 positive and negative identity checks, raw hashes, links, and touched-file Prettier.

---

## Phase 6: Expert `2.0.0` Candidate

> **Phase baseline tree**: _(recorded by the exec-plan skill from the complete phase-start state)_
> **Lenses**: expert correctness, source governance, 6502/C64 quality, product boundary, coverage

### Step 6.1: Specification Tests

**Reference**: [Expert Authority](03-05-expert-authority.md) · AR-P3 · ST-29–ST-33

- [ ] 6.1.1 [spec-author] Write the implementation-blind expert-candidate oracle from ST-29–ST-33 — `tests/expert-authority.spec.test.md`
- [ ] 6.1.2 Execute ST-29–ST-33 against active v1.0/P3 and record RED for version, identity, C64-only, product-boundary, optimizer, source, and case obligations — `99-execution-plan.md`

### Step 6.2: Implementation

- [ ] 6.2.1 Reconcile router and agent metadata with expert v2.0, Spec 4, and selective loading — `.agents/skills/blend65-domain-expert/SKILL.md`, `.agents/skills/blend65-domain-expert/agents/openai.yaml` · [03-05](03-05-expert-authority.md#router-and-metadata) · ST-29
- [ ] 6.2.2 Reconcile language, compiler, and SFA/ABI knowledge with frozen Spec 4 obligations — `.agents/skills/blend65-domain-expert/references/blend65-semantics.md`, `.agents/skills/blend65-domain-expert/references/compiler-architecture.md`, `.agents/skills/blend65-domain-expert/references/sfa-and-abi.md` · ST-29
- [ ] 6.2.3 Reconcile optimization, lowering, and CPU knowledge including AR-045/AR-046 — `.agents/skills/blend65-domain-expert/references/il-and-optimization.md`, `.agents/skills/blend65-domain-expert/references/6502-lowering-casebook.md`, `.agents/skills/blend65-domain-expert/references/mos-6502-family.md` · ST-31
- [ ] 6.2.4 Reconcile C64 hardware, memory/loading, and game-workload knowledge — `.agents/skills/blend65-domain-expert/references/c64-hardware.md`, `.agents/skills/blend65-domain-expert/references/c64-memory-and-runtime.md`, `.agents/skills/blend65-domain-expert/references/c64-game-engineering.md` · ST-30, ST-32
- [ ] 6.2.5 Reconcile artifact, portability, and evidence knowledge with the C64-only/product boundaries — `.agents/skills/blend65-domain-expert/references/acme-and-artifacts.md`, `.agents/skills/blend65-domain-expert/references/target-portability.md`, `.agents/skills/blend65-domain-expert/references/evidence-parity-and-recovery.md` · ST-30, ST-32
- [ ] 6.2.6 Reconcile the source manifest with Spec 4 identity and all required D64/KERNAL/Koala/optimizer keys — `.agents/skills/blend65-domain-expert/references/source-manifest.md` · [03-05](03-05-expert-authority.md#source-governance) · ST-32
- [ ] 6.2.7 Reconcile language and CPU/optimization casebooks; add only uncovered AR-046 discriminators — `.agents/skills/blend65-domain-expert/qualification/cases/language-architecture-and-sfa.md`, `.agents/skills/blend65-domain-expert/qualification/cases/cpu-lowering-and-optimization.md` · ST-31, ST-33
- [ ] 6.2.8 Reconcile C64 and recovery/portability casebooks without adding game-policy APIs — `.agents/skills/blend65-domain-expert/qualification/cases/c64-platform-and-games.md`, `.agents/skills/blend65-domain-expert/qualification/cases/parity-recovery-and-portability.md` · ST-30, ST-32–ST-33
- [ ] 6.2.9 Reconcile routing/evidence cases and derive the complete final coverage/dependency matrix — `.agents/skills/blend65-domain-expert/qualification/cases/routing-and-evidence.md`, `.agents/skills/blend65-domain-expert/qualification/coverage-matrix.md` · ST-29–ST-33
- [ ] 6.2.10 Execute ST-29–ST-33 against the candidate and require GREEN without modifying the oracle — `99-execution-plan.md`

### Step 6.3: Implementation Tests and Hardening

- [ ] 6.3.1 Record topology, case-field/ID, source-key, link, stale-claim, product-boundary, optimizer, and negative mutation checks — `tests/expert-authority.impl.test.md`
- [ ] 6.3.2 Verify Phase 6 direct checks, touched-file Prettier, and skill packaging smoke validation; do not treat packaging success as qualification — `tests/expert-authority.impl.test.md`

**Verify:** Run ST-29–ST-33; exact router/reference/case/topology and source-key checks; case ID and
eleven-field integrity; links/anchors; stale identity/target/product claims; AR-045/AR-046 coverage;
touched-file Prettier; and `quick_validate.py` as packaging smoke only.

---

## Phase 7: Complete Qualification and Content Checkpoint

> **Phase baseline tree**: _(recorded by the exec-plan skill from the complete phase-start state)_
> **Lenses**: evidence integrity, evaluator isolation, semantic blast radius, independent review

### Step 7.1: Specification Tests

**Reference**: [Qualification and Activation](03-06-qualification-and-activation.md) · AR-P3 ·
ST-34–ST-37

- [ ] 7.1.1 [spec-author] Write the implementation-blind qualification oracle from ST-34–ST-37 — `tests/qualification.spec.test.md`
- [ ] 7.1.2 Execute ST-34–ST-37 and record RED because final deterministic, blind-sample, grade, and review evidence is absent — `99-execution-plan.md`

### Step 7.2: Implementation

- [ ] 7.2.1 Run all deterministic positive/negative gates before evaluation and record exact candidate digests — `.agents/skills/blend65-domain-expert/qualification/coverage-matrix.md`, `.agents/skills/blend65-domain-expert/qualification/release.md` · ST-34
- [ ] 7.2.2 Obtain independent changed-surface and dependency-traced review; resolve and re-review every critical/major finding — `.agents/skills/blend65-domain-expert/qualification/release.md` · ST-37
- [ ] 7.2.3 Run one complete isolated blind evaluator sample with positive/negative sandbox controls and independent graders — `.agents/skills/blend65-domain-expert/qualification/release.md` · ST-35
- [ ] 7.2.4 Record final applicable grades for language and CPU/optimization cases — `.agents/skills/blend65-domain-expert/qualification/cases/language-architecture-and-sfa.md`, `.agents/skills/blend65-domain-expert/qualification/cases/cpu-lowering-and-optimization.md` · ST-35–ST-36
- [ ] 7.2.5 Record final applicable grades for C64 and recovery/portability cases — `.agents/skills/blend65-domain-expert/qualification/cases/c64-platform-and-games.md`, `.agents/skills/blend65-domain-expert/qualification/cases/parity-recovery-and-portability.md` · ST-35–ST-36
- [ ] 7.2.6 Record final applicable grades for routing/evidence cases and synchronize coverage status — `.agents/skills/blend65-domain-expert/qualification/cases/routing-and-evidence.md`, `.agents/skills/blend65-domain-expert/qualification/coverage-matrix.md` · ST-35–ST-36
- [ ] 7.2.7 Apply the defect-versus-omission invalidation rule, complete any focused reruns/regression, and record zero unresolved material defects — `.agents/skills/blend65-domain-expert/qualification/release.md` · [03-06](03-06-qualification-and-activation.md#candidate-qualification) · ST-36–ST-37
- [ ] 7.2.8 Finalize composed qualification state and the exact qualified candidate content allowlist — `.agents/skills/blend65-domain-expert/qualification/coverage-matrix.md`, `.agents/skills/blend65-domain-expert/qualification/release.md` · ST-34–ST-37
- [ ] 7.2.9 Execute ST-34–ST-37 against the qualified candidate and require GREEN without modifying the oracle — `99-execution-plan.md`

### Step 7.3: Implementation Tests and Hardening

- [ ] 7.3.1 Record deterministic gates, sandbox controls, packet/evaluator/grader hashes, review, invalidation trials, and final evidence — `tests/qualification.impl.test.md`
- [ ] 7.3.2 Verify every Phase 7 gate, exact allowlist, case evidence, links/hashes, touched-file Prettier, and frozen Spec identity; complete the immutable candidate checkpoint through the exec-plan commit workflow — `tests/qualification.impl.test.md`, `.agents/skills/blend65-domain-expert/qualification/release.md`

**Verify:** Run ST-34–ST-37, all deterministic gates and controls, applicable-case evidence checks,
independent review closure, exact candidate allowlist, Spec identity reproduction, skill packaging
smoke, and touched-file Prettier. The resulting content commit is never amended.

---

## Phase 8: Approval, Activation, and Freeze

> **Phase baseline tree**: _(recorded by the exec-plan skill from the complete phase-start state)_
> **Lenses**: user authority, atomic release, immutable-content binding, deferral expiry

### Step 8.1: Specification Tests

**Reference**: [Qualification and Activation](03-06-qualification-and-activation.md) · AR-P6 ·
ST-38–ST-40

- [ ] 8.1.1 [spec-author] Write the implementation-blind activation/freeze oracle from ST-38–ST-40 — `tests/activation-freeze.spec.test.md`
- [ ] 8.1.2 Execute ST-38–ST-40 before approval and record RED while confirming v1.0 remains the sole active release — `99-execution-plan.md`

### Step 8.2: Implementation

- [ ] 8.2.1 Capture the immutable candidate commit and assemble the complete approval packet in the closeout — `08-closeout.md` · [03-06](03-06-qualification-and-activation.md#explicit-approval-gate) · ST-38
- [ ] 8.2.2 Present the packet to the user, stop for explicit activation approval, and record the exact approved identity/commit — `08-closeout.md` · ST-38
- [ ] 8.2.3 After approval only, activate expert v2.0 in the sole release record and bind the immutable candidate commit/Spec identity — `.agents/skills/blend65-domain-expert/qualification/release.md` · [03-06](03-06-qualification-and-activation.md#atomic-activation) · ST-39
- [ ] 8.2.4 Finalize raw normative/skill/router/reference/qualification/release hashes and the no-content-drift freeze proof — `08-closeout.md` · ST-39–ST-40
- [ ] 8.2.5 Complete the deferral-expiry walk; record the answer and add named successor-owner rows for every expired rationale — `08-closeout.md`, `../../00-roadmap.md` · [03-06](03-06-qualification-and-activation.md#deferral-expiry-gate) · ST-40
- [ ] 8.2.6 Execute ST-38–ST-40 after activation and require GREEN without modifying the oracle — `99-execution-plan.md`

### Step 8.3: Implementation Tests and Hardening

- [ ] 8.3.1 Record approval, release-tail allowlist, raw hashes, candidate equality, sole-release, freeze, and deferral negative controls — `tests/activation-freeze.impl.test.md`
- [ ] 8.3.2 Verify the complete RD-01 direct boundary, finalize feature-roadmap Done state, and complete the release/closeout checkpoint through the exec-plan commit workflow — `tests/activation-freeze.impl.test.md`, `08-closeout.md`, `../../00-roadmap.md`

**Verify:** Run ST-38–ST-40, release-tail allowlist and candidate byte-equality checks, all raw and
normalized hashes, sole-active-release topology, approval/deferral/freeze fields, links, skill
packaging smoke, and touched-file Prettier. Confirm no compiler/emulator/readiness command ran.

---

## Dependencies

```text
Phase 1: verified P3/v1.0 input authority
    ↓
Phase 2: core language reconciliation
    ↓
Phase 3: closed-program/effect reconciliation
    ↓
Phase 4: C64-only authority + Guard/diagnostic closure
    ↓
Phase 5: inventory + P3→4 crosswalk + frozen Spec 4 identity
    ↓
Phase 6: expert v2.0 candidate bound to frozen Spec 4
    ↓
Phase 7: complete qualification + immutable content checkpoint
    ↓
Phase 8: explicit approval + atomic activation + freeze/deferral closeout
    ↓
RD-02 may begin against unchanged frozen authorities
```

## Success Criteria

The feature is complete when:

1. All 108 tasks are verified and all RD-01 acceptance criteria pass.
2. Exactly one active Specification 4 corpus and one expert v2.0 release share the same identity.
3. The complete P3→4 and qualification crosswalks have exact membership and no unresolved finding.
4. Every changed feature passes all 23 Guard rules and the grammar/diagnostic registries are closed.
5. All 107 existing expert case IDs plus required AR-046 cases have applicable green evidence.
6. Independent review has zero unresolved critical or major finding.
7. Explicit user activation approval is recorded before release activation.
8. Raw/normalized hashes reproduce, `spec/` is frozen, and every expired deferral has an owner.
9. Direct validation and touched-file formatting pass; no excluded compiler/emulator suite ran.
10. The v4 feature roadmap marks RD-01 Done and RD-02 unblocked; the portfolio cascade waits for the
    integration branch under the roadmap policy.

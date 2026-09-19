# Execution Plan: RD-03 Frontend First

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-19 10:18
> **Progress**: 20/64 tasks (31.3%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement only [Requirements](01-requirements.md)' partial RD-03 coverage.
No implementation begins until this plan passes preflight. Use exec-plan for
execution, with local coherent green checkpoints through the git-commit skill;
the overriding project policy prohibits automatic pushing.

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---|
| 1 | Source tokens and lexical recovery | 8 |
| 2 | Admitted syntax and parser recovery | 12 |
| 3 | Module graph and declaration bindings | 8 |
| 4 | Scalar expressions, direct calls and structured flow | 14 |
| 5 | Fixed aggregates, places and memory intrinsics | 12 |
| 6 | Effects, initializer schedule and service acceptance | 10 |

Total: 64 tasks across six phases. Scope is bounded by reviewable feature units,
not fabricated hour estimates. Each task targets at most three focused files;
split a task before it exceeds the project size/concern limits, preserving the
spec-first order and immediately updating this checklist's denominator.

The phase lists below are the only task-progress authority. Update after each
task: implemented `[~]` with actual timestamp; verified `[x]`; only `[x]` counts
complete. Update Progress/Last Updated immediately. Resume first `[~]`, otherwise
first `[ ]`, in document order. A blocker uses `[!]` and `Blocked: <reason>` on
that task line. Timestamps come from the host clock. Do not duplicate task lists.

Every spec-author task is implementation-blind. Pass raw normative excerpts,
approved component contracts and the referenced ST rows; all production
`frontend/` implementation files are forbidden to that author. Record behavioral
red, then implement, prove green, add separate implementation tests and qualify.
Existing unchanged specification tests remain immutable.
The source/syntax and semantic components now freeze exact test-visible fields
before authoring (PF-001). Include the owning phase's contract tables in every
author packet; never ask authors to derive field names from implementation.
Early phase tests assert only their stage's behavior. ST-3, ST-17 and ST-45
semantic assertions run in their later owning phases (PF-002); no assertions
are silently dropped. Phase 4/5 use the internal module-analysis entry, not the
phase 6 whole-analysis service or an invented successful typed program.

Strict scope, independent review and minimum one reviewer are active in
`codeops/codeops.json`. Phase quality packets include these component/ST/AR
contracts and the actual verification results. Base correctness/maintainability/
standards lenses plus api-surface/security input handling apply; semantics review
is required for the typed expression/flow/aggregate/effect boundaries. There is
no performance-critical machine path, network service or applicable web/auth/
financial/tenant/MCP security profile. Do not import irrelevant auditor checklists.

## Phase 1: Source Tokens and Lexical Recovery

> **Phase baseline tree**: 552c5c3d67ee2d3cfdfa1379f9e7690696af9197
> **Scope mode**: strict
> **Expected modification set**: `packages/compiler/src/frontend/{tokens.ts,lexer.ts,diagnostics.ts,lexer.spec.test.ts,lexer.impl.test.ts}`; this plan's index, execution, ambiguity register, source/syntax clarification and phase review evidence; feature roadmap. No compiler-root export, CLI, dependency, frozen authority or portfolio changes.
> **Mechanical verification correction**: rename only CLI `args.impl.test.ts` / `render.impl.test.ts` to `project-args.impl.test.ts` / `project-render.impl.test.ts` with byte-identical contents (AR-P9). No production CLI behavior changes.
> **Lenses**: api-surface, security

### Step 1.1: Specification Tests

Reference: [Source/syntax §Tokens](03-01-source-and-syntax.md#tokens-and-source-coordinates), AR-P4–AR-P6.

- [x] 1.1.1 [spec-author] Write ST-1–ST-6 lexical assertions only; use frozen phase 1 fields — `frontend/lexer.spec.test.ts`. ✅ (completed: 2026-09-18 15:13)
- [x] 1.1.2 Verify newly specified lexical behavior is red; record pre-existing passes — `frontend/lexer.spec.test.ts`. ✅ (completed: 2026-09-18 15:14)

Authoring verification: 16 independent lexical cases written and formatted.
Initial red: missing `./lexer.js`, exit 1, log `/tmp/blend65-lexer-spec-red.Lisqs0`.
At that initial run, no behavior discriminator executed; later red and green
runs below directly exercise all 16 cases.
Pre-existing compiler baseline: 570 tests pass, log `/tmp/blend65-lexer-baseline.log`.
No failing phase is committed. Source escape display was verified by actual
backslash counts, not JSON-rendered tool text; the author confirmed AR-P8 matches.

### Step 1.2: Implementation

- [x] 1.2.1 Define token/payload contracts and raw-byte cursor — `frontend/tokens.ts`, `frontend/lexer.ts`; source/syntax §Tokens. ✅ (completed: 2026-09-18 15:15)
- [x] 1.2.2 Implement keywords, numeric literals and maximal-munch operators — `frontend/lexer.ts`; ST-2–ST-5. ✅ (completed: 2026-09-18 15:17)

- [x] 1.2.3 Implement comments/literals and lexical poison recovery — `frontend/lexer.ts`; reuse existing `project/diagnostics.ts` helpers instead of creating an unused frontend diagnostic layer; ST-1, ST-4–ST-6. ✅ (completed: 2026-09-18 15:18)
- [x] 1.2.4 Verify the lexical specification tier is green — `frontend/lexer.spec.test.ts`. ✅ (completed: 2026-09-18 15:18)

Cursor-entry behavioral red: all 16 lexical assertions executed and failed;
log `/tmp/blend65-lexer-behavior-red.log`. This supersedes unavailable-entry red
as direct proof that each newly specified behavior was missing.
Green: all 16 pass without an oracle change, log `/tmp/blend65-lexer-spec-qualified.log`.
The final 47 edge cases pass with the specification tier, log
`/tmp/blend65-lexer-rv2-test.log`.

### Step 1.3: Implementation Tests and Qualification

- [x] 1.3.1 Add cursor/span/deep-input edge tests — `frontend/lexer.impl.test.ts`; AR-P4/AR-P6. ✅ (completed: 2026-09-18 15:22)
- [x] 1.3.2 Run phase qualification and touched formatting; record independent phase review — `99-execution-plan.md`; testing §Verification commands. ✅ (completed: 2026-09-18 15:31)

Qualification: build, typecheck and 737 repository tests pass. Two minor recovery/
ordering findings were corrected. See [phase review](08-phase-1-review.md) for
independent review, immutable oracle hashes, scope and bounded evidence.

Deliverable: real target-neutral tokens with accountable recovery, not semantic acceptance.
Verify: phase qualification and touched formatting from [Testing](07-testing-strategy.md#verification-commands).

## Phase 2: Admitted Syntax and Parser Recovery

> **Phase baseline tree**: 6887414fd1ec5317d9ebc85f7b097ae28b0fc383
> **Scope mode**: strict
> **Expected modification set**: `packages/compiler/src/frontend/{syntax.ts,expressions.ts,parser.ts,statements.ts,diagnostics.ts,expressions.spec.test.ts,parser.spec.test.ts,parser.impl.test.ts}`; this execution plan, phase review evidence and the feature-roadmap status note. No compiler-root export, CLI, dependency, frozen authority, roadmap stage or portfolio change.
> **Lenses**: api-surface, security

### Step 2.1: Specification Tests

Reference: [Source/syntax §Parsing](03-01-source-and-syntax.md#parsing-and-syntax), AR-P3–AR-P6.

- [x] 2.1.1 [spec-author] Write ST-7–ST-9 — `frontend/expressions.spec.test.ts`. ✅ (completed: 2026-09-19 09:45)
- [x] 2.1.2 [spec-author] Write ST-10–ST-14, ST-45 syntax/recovery and ST-3 reserved `type` use; use frozen phase 2 fields — `frontend/parser.spec.test.ts`. ✅ (completed: 2026-09-19 09:47)
- [x] 2.1.3 Verify both new syntax tiers are behaviorally red — `frontend/expressions.spec.test.ts`, `frontend/parser.spec.test.ts`. ✅ (completed: 2026-09-19 09:48)

Both suites first failed collection because `frontend/parser.ts` did not exist.
After adding only the planned entry stubs, all 29 cases executed and failed on
missing behavior; log `/tmp/blend65-parser-behavior-red.log`. Immutable oracle
SHA-256 values are `9bdd248c56e1ea071d96019a0a5dce5a527ecefca5c2168ba69c790546eb9985`
and `f4399cae257d1b3a96f5be889bf39ff1c45b24b950b383f9c3c767a5d72e4c3e`.
The parser author made one independently confirmed oracle correction before
GREEN: the unexpected `let` span now covers that token only, as the frozen
diagnostic contract requires; no behavior expectation changed.

### Step 2.2: Implementation

- [x] 2.2.1 Define admitted syntax/result unions and source associations — `frontend/syntax.ts`; source/syntax §Parsing. ✅ (completed: 2026-09-19 09:50)
- [x] 2.2.2 Implement primary/postfix/cast/literal expression parsing — `frontend/expressions.ts`; ST-8–ST-9. ✅ (completed: 2026-09-19 09:52)
- [x] 2.2.3 Implement Pratt unary/binary/conditional/assignment binding — `frontend/expressions.ts`; ST-7. ✅ (completed: 2026-09-19 09:53)
- [x] 2.2.4 Implement headers/imports/declarations/types and normative-root recovery — `frontend/parser.ts`; ST-8, ST-9, ST-13. ✅ (completed: 2026-09-19 09:58)
- [x] 2.2.5 Implement admitted blocks/control/jumps and ordinary for clauses — `frontend/statements.ts`; ST-10. ✅ (completed: 2026-09-19 09:59)
- [x] 2.2.6 Implement syntax template, poison/unchecked-region recovery — `frontend/parser.ts`, `frontend/diagnostics.ts`; ST-11–ST-14, ST-45. ✅ (completed: 2026-09-19 10:00)
- [x] 2.2.7 Verify syntax specification tiers are green — `frontend/expressions.spec.test.ts`, `frontend/parser.spec.test.ts`. ✅ (completed: 2026-09-19 10:00)

### Step 2.3: Implementation Tests and Qualification

- [x] 2.3.1 Add recovery-progress, malformed/deep-input and poison-isolation tests — `frontend/parser.impl.test.ts`; AR-P4/AR-P6. ✅ (completed: 2026-09-19 10:03)
- [x] 2.3.2 Run phase qualification/formatting and independent phase review — `99-execution-plan.md`. ✅ (completed: 2026-09-19 10:18)

Qualification: compiler build/typecheck, 682 compiler tests and 24 import-boundary
tests pass; touched formatting, whitespace and frozen-authority checks pass. Six
initial major findings were corrected; the sole re-review confirmed five and
identified two remaining boundary cases, both corrected with direct regressions.
No critical or major finding remains. See [phase review](08-phase-2-review.md).

Deliverable: real admitted syntax with proving diagnostics and explicitly unchecked regions.
Verify: phase qualification and touched formatting from Testing §Verification commands.

## Phase 3: Module Graph and Declaration Bindings

> **Phase baseline tree**: recorded by exec-plan at phase start
> **Lenses**: api-surface

### Step 3.1: Specification Tests

Reference: [Semantics §Module graph](03-02-semantic-analysis.md#module-graph-and-binding), AR-P4–AR-P5.

- [ ] 3.1.1 [spec-author] Write ST-15–ST-18 module/entry assertions only, excluding ST-17 initializer scheduling; use frozen phase 3 fields — `frontend/modules.spec.test.ts`.
- [ ] 3.1.2 Verify module/entry cases are red — `frontend/modules.spec.test.ts`.

### Step 3.2: Implementation

- [ ] 3.2.1 Implement shared-scanner header index and merged contributions — `frontend/modules.ts`; ST-15.
- [ ] 3.2.2 Implement imports/qualified dependency traversal and exported lookup — `frontend/modules.ts`; ST-16–ST-17.
- [ ] 3.2.3 Implement selected-entry/collision checks and intermediate graph contracts — `frontend/modules.ts`, `frontend/semantic-types.ts`; ST-18.
- [ ] 3.2.4 Verify module specification cases are green — `frontend/modules.spec.test.ts`.

### Step 3.3: Implementation Tests and Qualification

- [ ] 3.3.1 Add input-order/cycle/dependency poison tests — `frontend/modules.impl.test.ts`; semantics §Module graph.
- [ ] 3.3.2 Run phase qualification/formatting and independent phase review — `99-execution-plan.md`.

Deliverable: selected source graph and source-based declaration identities; no fabricated profile declarations.
Verify: phase qualification and touched formatting from Testing §Verification commands.

## Phase 4: Scalar Expressions, Direct Calls and Structured Flow

> **Phase baseline tree**: recorded by exec-plan at phase start
> **Lenses**: api-surface

### Step 4.1: Specification Tests

Reference: [Semantics §Types](03-02-semantic-analysis.md#types-constants-and-ordered-expressions) and §Structured flow, AR-P4–AR-P6.

- [ ] 4.1.1 [spec-author] Write ST-19–ST-25 including ST-23 division/remainder rows and ST-3 reserved declaration; use frozen phase 4 fields — `frontend/scalars.spec.test.ts`.
- [ ] 4.1.2 [spec-author] Write ST-26–ST-29 — `frontend/flow.spec.test.ts`.
- [ ] 4.1.3 Verify scalar/flow behavior is red — `frontend/scalars.spec.test.ts`, `frontend/flow.spec.test.ts`.

### Step 4.2: Implementation

- [ ] 4.2.1 Implement internal analyzeModules/result contracts, body binding/scopes and exact scalar type facts — `frontend/analyzer.ts`, `frontend/semantic-types.ts`; ST-19–ST-21, ST-3 reserved declaration.
- [ ] 4.2.2 Implement exact constant integer operations and context/range validation, signed division/remainder and structured constant-zero errors — `frontend/constants.ts`; ST-22–ST-23.
- [ ] 4.2.3 Implement runtime widths, conversions, casts and wrap warning predicates — `frontend/analyzer.ts`, `frontend/constants.ts`; ST-21–ST-23.
- [ ] 4.2.4 Preserve scalar assignment/place order, short circuit and conditional structure — `frontend/analyzer.ts`, `frontend/semantic-types.ts`; ST-24.
- [ ] 4.2.5 Implement direct/nested call signatures and independent argument recovery — `frontend/analyzer.ts`; ST-25.
- [ ] 4.2.6 Implement direct-call cycle detection and complete source paths — `frontend/effects.ts`; ST-26.
- [ ] 4.2.7 Implement structured assignment/return/exits and Boolean conditions — `frontend/flow.ts`; ST-27–ST-28.
- [ ] 4.2.8 Implement bounded canonical-loop proof and header flow — `frontend/flow.ts`; ST-29.
- [ ] 4.2.9 Verify scalar/flow specification tiers are green — `frontend/scalars.spec.test.ts`, `frontend/flow.spec.test.ts`.

### Step 4.3: Implementation Tests and Qualification

- [ ] 4.3.1 Add exact-integer boundaries, conservative reaching facts and poison tests — `frontend/scalars.impl.test.ts`; semantics §§Types/Structured flow.
- [ ] 4.3.2 Run phase qualification/formatting and independent phase/semantics review — `99-execution-plan.md`.

Deliverable: correct admitted scalar semantic facts and structured flow; no SFA staging/storage claim.
Verify: phase qualification and touched formatting from Testing §Verification commands.

## Phase 5: Fixed Aggregates, Places and Memory Intrinsics

> **Phase baseline tree**: recorded by exec-plan at phase start
> **Lenses**: api-surface

### Step 5.1: Specification Tests

Reference: [Semantics §Aggregates](03-02-semantic-analysis.md#aggregates-places-and-intrinsics), AR-P4–AR-P6.

- [ ] 5.1.1 [spec-author] Write ST-30–ST-38 — `frontend/aggregates.spec.test.ts`.
- [ ] 5.1.2 [spec-author] Write ST-39–ST-40 — `frontend/intrinsics.spec.test.ts`.
- [ ] 5.1.3 Verify aggregate/intrinsic behavior is red — `frontend/aggregates.spec.test.ts`, `frontend/intrinsics.spec.test.ts`.

### Step 5.2: Implementation

- [ ] 5.2.1 Implement admitted nominal struct fields/layout/literals — `frontend/aggregates.ts`; ST-30–ST-31.
- [ ] 5.2.2 Implement extent inference/full-size validation and array initializers — `frontend/aggregates.ts`, `frontend/constants.ts`; ST-32–ST-34.
- [ ] 5.2.3 Implement ordinal promotion/barriers and indexed assignment places — `frontend/aggregates.ts`, `frontend/analyzer.ts`; ST-35–ST-36.
- [ ] 5.2.4 Implement exact aggregate parameters and read-only propagation — `frontend/aggregates.ts`, `frontend/analyzer.ts`; ST-37.
- [ ] 5.2.5 Implement partial initialized ranges and independent local-read warnings — `frontend/flow.ts`, `frontend/aggregates.ts`; ST-38.
- [ ] 5.2.6 Implement volatile memory/query signatures and typed effect payload — `frontend/analyzer.ts`, `frontend/semantic-types.ts`; ST-39–ST-40.
- [ ] 5.2.7 Verify aggregate/intrinsic specification tiers are green — `frontend/aggregates.spec.test.ts`, `frontend/intrinsics.spec.test.ts`.

### Step 5.3: Implementation Tests and Qualification

- [ ] 5.3.1 Add shape/barrier/const-alias and range-join tests — `frontend/aggregates.impl.test.ts`; semantics §Aggregates.
- [ ] 5.3.2 Run phase qualification/formatting and independent phase/semantics review — `99-execution-plan.md`.

Deliverable: admitted aggregate/place semantics and volatile symbolic operations; no copy/return ABI or pointer allocation.
Verify: phase qualification and touched formatting from Testing §Verification commands.

## Phase 6: Effects, Initializer Schedule and Service Acceptance

> **Phase baseline tree**: recorded by exec-plan at phase start
> **Lenses**: api-surface, security

### Step 6.1: Specification Tests

Reference: [Semantics §Effects](03-02-semantic-analysis.md#effects-and-initializer-schedule) and §Service boundary, AR-P4–AR-P7.

- [ ] 6.1.1 [spec-author] Write ST-41–ST-42 and ST-17 initializer-order assertions; use frozen phase 6 fields — `frontend/effects.spec.test.ts`.
- [ ] 6.1.2 [spec-author] Write ST-43–ST-44, ST-46, ST-48 and ST-45 independent-error retention; use frozen phase 6 fields — `frontend/service.spec.test.ts`; reuse existing ST-47 root cases.
- [ ] 6.1.3 Verify service/effect behavior is red — `frontend/effects.spec.test.ts`, `frontend/service.spec.test.ts`.

### Step 6.2: Implementation

- [ ] 6.2.1 Implement transitive may-read/write/opaque summaries and initializer schedule — `frontend/effects.ts`; ST-41–ST-42.
- [ ] 6.2.2 Implement internal stage orchestration and result/obligation union — `frontend/service.ts`, `frontend/semantic-types.ts`; ST-43, ST-46, ST-48.
- [ ] 6.2.3 Implement deterministic diagnostic ordering/ceiling across stages — `frontend/diagnostics.ts`, `frontend/service.ts`; ST-44.
- [ ] 6.2.4 Verify service/effect specification tiers are green — `frontend/effects.spec.test.ts`, `frontend/service.spec.test.ts`.

### Step 6.3: Implementation Tests and Qualification

- [ ] 6.3.1 Add dependency/effect poisoning, deep input and immutable-input tests — `frontend/service.impl.test.ts`; semantics §Service boundary.
- [ ] 6.3.2 Run final integration/formatting and independent phase/semantics review — `99-execution-plan.md`; Testing §Verification commands.
- [ ] 6.3.3 Record partial acceptance, deferral-expiry answer and parent follow-on ownership; update feature roadmap — `08-closeout.md`, `codeops/features/blend65-v4/00-roadmap.md`; requirements §Plan-local acceptance.

Deliverable: real internal source-to-typed-analysis journey with honest incomplete/error states.
Verify: `yarn build && yarn typecheck && yarn test`, touched formatting, unchanged frozen boundaries.

## Dependencies and Success Criteria

Phases 1 → 2 → 3 → 4 → 5 → 6. Each phase consumes only completed previous
stage contracts; unchecked material never enters a successful next-stage result.
RD-02's implemented project API is required. By RD-02 AR-P11, its deferred native
Windows foundation proof does not block this plan or later Linux compiler work;
that proof runs in RD-10's existing Windows qualification window.

Completion means all tasks and [plan-local acceptance](01-requirements.md#plan-local-acceptance)
are verified, required reviews are clear, documentation reflects partial evidence,
and no dead scaffolding exists. Remaining full RD-03 work still needs its own
complete plan, authentic SpritePad evidence, qualified profile/asset checks,
backend/SFA/CLI/editor integration, ACME and VICE acceptance. This plan's completion
must never set the parent RD Done. Post-completion project analysis follows
exec-plan, without rewriting unrelated/default-branch guidance in this worktree.

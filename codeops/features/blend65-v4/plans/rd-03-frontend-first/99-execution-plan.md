# Execution Plan: RD-03 Frontend First

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-19 21:46
> **Progress**: 64/64 tasks (100%)
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

> **Phase baseline tree**: a17413080305edbd7fc02ff956d0f1c27148defb
> **Implementation-review baseline tree**: df10a000b6fea2f9573396c6304d73c0494fe483
> **Scope mode**: strict
> **Expected modification set**: `packages/compiler/src/frontend/{modules.ts,module-references.ts,semantic-types.ts,modules.spec.test.ts,modules.impl.test.ts}`; this plan's index/execution/review evidence and the feature-roadmap status note. The internal reference walker is split only to keep the resolver below the source-file size ceiling; it adds no public package surface. No further parser-oracle edit, compiler-root export, CLI, dependency, frozen authority, roadmap stage or portfolio change.
> **Lenses**: api-surface

### Step 3.1: Specification Tests

Reference: [Semantics §Module graph](03-02-semantic-analysis.md#module-graph-and-binding), AR-P4–AR-P5.

- [x] 3.1.1 [spec-author] Write ST-15–ST-18 module/entry assertions only, excluding ST-17 initializer scheduling; use frozen phase 3 fields — `frontend/modules.spec.test.ts`. ✅ (completed: 2026-09-19 10:34)
- [x] 3.1.2 Verify module/entry cases are red — `frontend/modules.spec.test.ts`. ✅ (completed: 2026-09-19 10:35)

The independent module oracle contains nine cases and has SHA-256
`c4af1131482c703c1b5ce36fd59464ea8a0a5a4ad176c2aaec0c9034d67486d2`.
The absent module entry first failed collection. After adding only two throwing
entry stubs, all nine cases executed and failed on missing behavior; log
`/tmp/blend65-modules-behavior-red.log`. AR-P10 fixes E10003 related-location
text as one-based raw-byte `sourceId:line:column` before implementation.
The user authorized a test-only correction after the oracle's helper accidentally
matched the `f` in `function` instead of the declared name; no expectation changed.

### Step 3.2: Implementation

- [x] 3.2.1 Implement shared-scanner header index and merged contributions — `frontend/modules.ts`; ST-15. ✅ (completed: 2026-09-19 10:41)
- [x] 3.2.2 Implement imports/qualified dependency traversal and exported lookup — `frontend/modules.ts`; ST-16–ST-17. ✅ (completed: 2026-09-19 10:45)
- [x] 3.2.3 Implement selected-entry/collision checks and intermediate graph contracts — `frontend/modules.ts`, `frontend/semantic-types.ts`; ST-18. ✅ (completed: 2026-09-19 10:48)
- [x] 3.2.4 Verify module specification cases are green — `frontend/modules.spec.test.ts`. ✅ (completed: 2026-09-19 10:48)

### Step 3.3: Implementation Tests and Qualification

- [x] 3.3.1 Add input-order/cycle/dependency poison tests — `frontend/modules.impl.test.ts`; semantics §Module graph. ✅ (completed: 2026-09-19 10:50)
- [x] 3.3.2 Run phase qualification/formatting and independent phase review — `99-execution-plan.md`. ✅ (completed: 2026-09-19 11:12)

Qualification: compiler build/typecheck, 701 compiler tests, 43 root integration
tests and 24 import-boundary cases pass; touched formatting, whitespace and
frozen-authority checks pass. The independent review raised one procedural
critical and four correctness majors. Three were confirmed resolved by the sole
focused re-review; its two remaining ordering findings were corrected with direct
regressions and inline verification. No critical or major finding remains. See
[phase review](08-phase-3-review.md).

Deliverable: selected source graph and source-based declaration identities; no fabricated profile declarations.
Verify: phase qualification and touched formatting from Testing §Verification commands.

## Phase 4: Scalar Expressions, Direct Calls and Structured Flow

> **Phase baseline tree**: 03bbad73ce2362dee92750691fae70625ff7e6de
> **Implementation-review baseline tree**: ad4176c326e9115efa167ceea90d28238b3f50b1
> **Accepted-fix baseline tree**: dfea4cb67f7ebdae114419f7ed7008a1216bd3e7
> **Scope mode**: strict
> **Expected modification set**: `packages/compiler/src/frontend/{scalars.spec.test.ts,flow.spec.test.ts,analyzer.ts,scalar-expressions.ts,scalar-assignments.ts,semantic-types.ts,constants.ts,effects.ts,flow.ts,scalars.impl.test.ts}`; this plan's testing-strategy packet correction, execution plan, phase review evidence and the feature-roadmap status note. `scalar-expressions.ts` and its direct assignment helper are mechanical logic splits that keep the implementation below the source-file ceiling; they add no layer or public surface. No parser/lexer/module oracle edit, compiler-root export, CLI, dependency, generalized CFG/IR layer, frozen authority, roadmap stage or portfolio change.
> **Lenses**: api-surface

### Step 4.1: Specification Tests

Reference: [Semantics §Types](03-02-semantic-analysis.md#types-constants-and-ordered-expressions) and §Structured flow, AR-P4–AR-P6.

- [x] 4.1.1 [spec-author] Write ST-19–ST-25 including ST-23 division/remainder rows and ST-3 reserved declaration; use frozen phase 4 fields — `frontend/scalars.spec.test.ts`. ✅ (completed: 2026-09-19 11:39)
- [x] 4.1.2 [spec-author] Write ST-26–ST-29 — `frontend/flow.spec.test.ts`. ✅ (completed: 2026-09-19 11:32)
- [x] 4.1.3 Verify scalar/flow behavior is red — `frontend/scalars.spec.test.ts`, `frontend/flow.spec.test.ts`. ✅ (completed: 2026-09-19 11:33)

The independent scalar and flow oracles contain 30 expanded cases. Their
SHA-256 values are `248ebdac03d109471e364bcbbac1c6f79618ecef435ea379ab3c02073d65ed89`
and `44efb6453db86726ec6be146c8650efc080a8d2364e6956b04eb13066fc15945`.
Both suites fail collection because the planned `frontend/analyzer.ts` entry does
not yet exist; no behavior case can pass accidentally. Red log:
`/tmp/blend65-phase4-red-corrected.log`. Before implementation, the user approved
correcting the E10081 oracle to name `sbyte` as signed and `byte` as unsigned.

### Step 4.2: Implementation

- [x] 4.2.1 Implement internal analyzeModules/result contracts, body binding/scopes and exact scalar type facts — `frontend/analyzer.ts`, `frontend/semantic-types.ts`; ST-19–ST-21, ST-3 reserved declaration. ✅ (completed: 2026-09-19 12:09)
- [x] 4.2.2 Implement exact constant integer operations and context/range validation, signed division/remainder and structured constant-zero errors — `frontend/constants.ts`; ST-22–ST-23. ✅ (completed: 2026-09-19 12:09)
- [x] 4.2.3 Implement runtime widths, conversions, casts and wrap warning predicates — `frontend/analyzer.ts`, `frontend/constants.ts`; ST-21–ST-23. ✅ (completed: 2026-09-19 12:09)
- [x] 4.2.4 Preserve scalar assignment/place order, short circuit and conditional structure — `frontend/analyzer.ts`, `frontend/semantic-types.ts`; ST-24. ✅ (completed: 2026-09-19 12:09)
- [x] 4.2.5 Implement direct/nested call signatures and independent argument recovery — `frontend/analyzer.ts`; ST-25. ✅ (completed: 2026-09-19 12:09)
- [x] 4.2.6 Implement direct-call cycle detection and complete source paths — `frontend/effects.ts`; ST-26. ✅ (completed: 2026-09-19 12:09)
- [x] 4.2.7 Implement structured assignment/return/exits and Boolean conditions — `frontend/flow.ts`; ST-27–ST-28. ✅ (completed: 2026-09-19 12:09)
- [x] 4.2.8 Implement bounded canonical-loop proof and header flow — `frontend/flow.ts`; ST-29. ✅ (completed: 2026-09-19 12:09)
- [x] 4.2.9 Verify scalar/flow specification tiers are green — `frontend/scalars.spec.test.ts`, `frontend/flow.spec.test.ts`. ✅ (completed: 2026-09-19 12:09)

### Step 4.3: Implementation Tests and Qualification

- [x] 4.3.1 Add exact-integer boundaries, conservative reaching facts and poison tests — `frontend/scalars.impl.test.ts`; semantics §§Types/Structured flow. ✅ (completed: 2026-09-19 12:10)
- [x] 4.3.2 Run phase qualification/formatting and independent phase/semantics review — `99-execution-plan.md`. ✅ (completed: 2026-09-19 13:31)

Qualification: compiler build/typecheck, 751 compiler tests, 24 import-boundary
tests and the root build/typecheck/test checkpoint pass. The initial critical/
major findings and the sole focused re-review's five remaining direct defects
were corrected with user authority. No third review is claimed. See
[phase review](08-phase-4-review.md).

Deliverable: correct admitted scalar semantic facts and structured flow; no SFA staging/storage claim.
Verify: phase qualification and touched formatting from Testing §Verification commands.

## Phase 5: Fixed Aggregates, Places and Memory Intrinsics

> **Phase baseline tree**: 283265299b5cf27e490aa1b2b2c543a88ebc9332
> **Scope mode**: strict
> **Expected modification set**: `packages/compiler/src/frontend/{aggregates.spec.test.ts,intrinsics.spec.test.ts,aggregates.ts,aggregate-types.ts,aggregate-initialization.ts,direct-calls.ts,analysis-result.ts,module-bindings.ts,flow-facts.ts,conditional-expressions.ts,analyzer.ts,semantic-types.ts,constants.ts,flow.ts,scalar-expressions.ts,scalar-assignments.ts,aggregates.impl.test.ts,scalars.impl.test.ts}`; this plan's ambiguity register, execution plan, phase review evidence and the feature-roadmap status note. The scalar modules are the existing recursion and assignment hooks needed to admit aggregate expressions and places. Focused helpers keep aggregate type resolution, initialization facts, direct-call checks, flow facts, conditional expressions, module binding preparation and final result assembly out of already-large files; they add no semantic layer or public package surface. The scalar implementation expectation now distinguishes inaccessible caller locals from call-visible module state. No parser/lexer/module/scalar/flow specification-oracle edit, compiler-root export, CLI, dependency, generalized alias/borrow/CFG layer, backend/SFA/allocation work, frozen authority, roadmap stage or portfolio change.
> **Lenses**: api-surface

### Step 5.1: Specification Tests

Reference: [Semantics §Aggregates](03-02-semantic-analysis.md#aggregates-places-and-intrinsics), AR-P4–AR-P6.

- [x] 5.1.1 [spec-author] Write ST-30–ST-38 — `frontend/aggregates.spec.test.ts`. ✅ (completed: 2026-09-19 13:56)
- [x] 5.1.2 [spec-author] Write ST-39–ST-40 — `frontend/intrinsics.spec.test.ts`. ✅ (completed: 2026-09-19 13:56)
- [x] 5.1.3 Verify aggregate/intrinsic behavior is red — `frontend/aggregates.spec.test.ts`, `frontend/intrinsics.spec.test.ts`. ✅ (completed: 2026-09-19 13:56)

Independent authoring produced 11 specification cases. All 11 executed and
failed on missing aggregate/intrinsic behavior; log
`/tmp/blend65-phase5-spec-red-parent.log`. Prettier and whitespace checks pass.

### Step 5.2: Implementation

- [x] 5.2.1 Implement admitted nominal struct fields/layout/literals — `frontend/aggregates.ts`; ST-30–ST-31. ✅ (completed: 2026-09-19 14:16)
- [x] 5.2.2 Implement extent inference/full-size validation and array initializers — `frontend/aggregates.ts`, `frontend/constants.ts`; ST-32–ST-34. ✅ (completed: 2026-09-19 14:16)
- [x] 5.2.3 Implement ordinal promotion/barriers and indexed assignment places — `frontend/aggregates.ts`, `frontend/analyzer.ts`; ST-35–ST-36. ✅ (completed: 2026-09-19 14:16)
- [x] 5.2.4 Implement exact aggregate parameters and read-only propagation — `frontend/aggregates.ts`, `frontend/analyzer.ts`; ST-37. ✅ (completed: 2026-09-19 14:16)
- [x] 5.2.5 Implement partial initialized ranges and independent local-read warnings — `frontend/flow.ts`, `frontend/aggregates.ts`; ST-38. ✅ (completed: 2026-09-19 14:16)
- [x] 5.2.6 Implement volatile memory/query signatures and typed effect payload — `frontend/analyzer.ts`, `frontend/semantic-types.ts`; ST-39–ST-40. ✅ (completed: 2026-09-19 14:16)
- [x] 5.2.7 Verify aggregate/intrinsic specification tiers are green — `frontend/aggregates.spec.test.ts`, `frontend/intrinsics.spec.test.ts`. ✅ (completed: 2026-09-19 14:16)

### Step 5.3: Implementation Tests and Qualification

- [x] 5.3.1 Add shape/barrier/const-alias and range-join tests — `frontend/aggregates.impl.test.ts`; semantics §Aggregates. ✅ (completed: 2026-09-19 14:18)
- [x] 5.3.2 Run phase qualification/formatting and independent phase/semantics review — `99-execution-plan.md`. ✅ (completed: 2026-09-19 16:12)

Qualification: compiler build/typecheck, 780 compiler tests and 24
import-boundary tests pass; touched formatting, whitespace, source-file size and
frozen-authority checks pass. Eight initial major finding clusters and the sole
focused re-review's three major and two minor edge cases were corrected with
explicit user authority. No third review is claimed. See
[phase review](08-phase-5-review.md).

Deliverable: admitted aggregate/place semantics and volatile symbolic operations; no copy/return ABI or pointer allocation.
Verify: phase qualification and touched formatting from Testing §Verification commands.

## Phase 6: Effects, Initializer Schedule and Service Acceptance

> **Phase baseline tree**: 4778012d2db3710d7a1f8e1c93a26e9aaabf6e3c
> **Scope mode**: strict
> **Expected modification set**: `packages/compiler/src/frontend/{effects.spec.test.ts,service.spec.test.ts,effects.ts,service.ts,semantic-types.ts,diagnostics.ts,service.impl.test.ts,analyzer.ts,direct-calls.ts,scalar-expressions.ts,module-references.ts,call-cycles.ts}`; this plan's index, execution, closeout/review evidence and feature-roadmap status note. Existing effect analysis is extended directly; the service only orchestrates current stages and assembles their existing result contracts. The existing direct-call, reference-walk and poison-recovery hooks receive the minimum corrections needed for already-required qualified calls, bounded hostile input and truthful safe recovery. `call-cycles.ts` is a mechanical move of existing recursion checking which keeps `effects.ts` below the source-file limit; no new semantic layer is added. No compiler-root export, CLI/editor API, dependency, workspace, generalized effect/alias framework, backend/SFA/allocation work, frozen authority, roadmap stage or portfolio change.
> **Lenses**: api-surface, security

### Step 6.1: Specification Tests

Reference: [Semantics §Effects](03-02-semantic-analysis.md#effects-and-initializer-schedule) and §Service boundary, AR-P4–AR-P7.

- [x] 6.1.1 [spec-author] Write ST-41–ST-42 and ST-17 initializer-order assertions; use frozen phase 6 fields — `frontend/effects.spec.test.ts`. ✅ (completed: 2026-09-19 16:59)
- [x] 6.1.2 [spec-author] Write ST-43–ST-44, ST-46, ST-48 and ST-45 independent-error retention; use frozen phase 6 fields — `frontend/service.spec.test.ts`; reuse existing ST-47 root cases. ✅ (completed: 2026-09-19 16:59)
- [x] 6.1.3 Verify service/effect behavior is red — `frontend/effects.spec.test.ts`, `frontend/service.spec.test.ts`. ✅ (completed: 2026-09-19 16:59; independently adopted baseline RED: missing `frontend/service.js`; 2 suites failed, 0/17 tests executed; log SHA-256 `e3c27f31356ddc0f92d992ad3aa6ef7dc96ca06b2f246f619948655dc5322bfb`)

### Step 6.2: Implementation

- [x] 6.2.1 Implement transitive may-read/write/opaque summaries and initializer schedule — `frontend/effects.ts`; ST-41–ST-42. ✅ (completed: 2026-09-19 17:15)
- [x] 6.2.2 Implement internal stage orchestration and result/obligation union — `frontend/service.ts`, `frontend/semantic-types.ts`; ST-43, ST-46, ST-48. ✅ (completed: 2026-09-19 17:15)
- [x] 6.2.3 Implement deterministic diagnostic ordering/ceiling across stages — `frontend/diagnostics.ts`, `frontend/service.ts`; ST-44. ✅ (completed: 2026-09-19 17:15)
- [x] 6.2.4 Verify service/effect specification tiers are green — `frontend/effects.spec.test.ts`, `frontend/service.spec.test.ts`. ✅ (completed: 2026-09-19 17:15; 17 tests passed)

### Step 6.3: Implementation Tests and Qualification

- [x] 6.3.1 Add dependency/effect poisoning, deep input and immutable-input tests — `frontend/service.impl.test.ts`; semantics §Service boundary. ✅ (completed: 2026-09-19 21:45; 14 implementation cases passed)
- [x] 6.3.2 Run final integration/formatting and independent phase/semantics review — `99-execution-plan.md`; Testing §Verification commands. ✅ (completed: 2026-09-19 21:46; both focused re-reviews found no critical or major blocker; final minor ordering correction verified inline)
- [x] 6.3.3 Record partial acceptance, deferral-expiry answer and parent follow-on ownership; update feature roadmap — `08-closeout.md`, `codeops/features/blend65-v4/00-roadmap.md`; requirements §Plan-local acceptance. ✅ (completed: 2026-09-19 21:46)

Phase 6 qualification: the independently adopted Phase 6 oracle passes 17/17
cases. Root build and typecheck pass; 811 compiler, 61 CLI and 43 root tests
pass. Touched formatting, documentation-ban, whitespace and frozen-spec checks
pass. See [phase review](08-phase-6-review.md) and [partial closeout](08-closeout.md).

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

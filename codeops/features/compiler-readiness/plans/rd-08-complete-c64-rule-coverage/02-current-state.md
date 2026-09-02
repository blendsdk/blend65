# Current State: RD-08 Complete C64 Rule Coverage

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

`@blend65/readiness` already owns a closed scalar/memory generator IR, defensive validation,
deterministic source rendering, bounded semantic evaluation, reviewed operation bindings,
content-addressed parent publication and replay. `@blend65/readiness-execution` already consumes
published source through frontend, compiler API, CLI, emit, ACME and VICE routes. The selected
authority contains 2,112 inventory rules, nine modeled entries and 2,103
`outside-initial-slice` entries.

The root command graph now excludes the exhaustive readiness suites and invokes file-selected
smoke configs. Production readiness VICE is not in normal `yarn test`; the compiler test-harness's
independent emulator tier remains untouched. (AR-7)

### Relevant Files

| File | Current purpose | Planned change |
|---|---|---|
| `packages/readiness/src/generator-ir.ts` | Closed scalar/memory IR and budgets | Add only structured type discriminants/unions (AR-4) |
| `packages/readiness/src/generator-ir-validator.ts` | 952-line defensive syntax/type validator | Delegate new structured nodes to a companion; do not enlarge the monolith (AR-4) |
| `packages/readiness/src/source-renderer.ts` | Canonical Blend module rendering | Delegate arrays/calls/control statements to a focused renderer |
| `packages/readiness/src/modeled-generators.ts` | 735-line scalar/memory request path | Delegate new family construction to `structured-case-families.ts` |
| `packages/readiness/src/oracle-evaluator.ts` | 654-line independent scalar/memory evaluator | Delegate structured semantics without compiler imports |
| `packages/readiness/src/model-registry-model.ts` | v1 modeled/unmodeled registry | Add the smallest versioned family/route representation |
| `packages/readiness/src/binding-publication.ts` | Reviewed atomic parent publication | Reuse; add only changed-format member dispatch |
| `packages/readiness/src/publication-model.ts` | Seven-member v1 release and pointer | Preserve v1 bytes; dispatch additive release version |
| `packages/readiness/src/dependency-boundary.impl.test.ts` | Proves readiness has no compiler dependency | Extend expected companion coverage; retain empty workspace imports |
| `packages/readiness-execution/src/execution-route-adapters.ts` | Existing public compiler/ACME adapters | No new route; consume new published cases unchanged |
| `packages/readiness-execution/src/execution-publication-catalog.ts` | Exact child-to-parent selection | Reuse fail-closed stale-pair behavior (AR-5) |
| `packages/readiness/vitest.smoke.config.ts` | Fixed readiness smoke file list | Add an explicit capped generated-case selection only |
| `package.json` | Normal versus full readiness command graph | Preserve topology; add only explicit family/full commands if missing |

### Code Analysis

- `generator-ir.ts:76-82` and `generator-ir.ts:113-118` are the closed unions that must remain
  the central type authority.
- `generator-ir.ts:151-160` already names all required structural budget dimensions, including
  loop work; RD-08 does not need another budget system.
- `source-renderer.ts:13-17` already bounds source bytes and spelling selections.
- `dependency-boundary.impl.test.ts:105-151` already enforces the absence of compiler/toolchain
  workspace imports in readiness.
- `publication-model.ts:131-155` freezes v1 limits and exact members; changed bytes therefore use
  additive dispatch rather than reinterpretation.
- `publication-model.ts:186-200` already models immutable release identity and a separate selected
  parent pointer.
- `packages/readiness/vitest.smoke.config.ts:3-21` is an explicit include list, so the positive
  per-family/total case cap can remain a small local selector rather than a new runner.

## Gaps Identified

### Gap 1: Structured generated programs

**Current Behavior:** Only scalar expressions, locals, assignment, memory access and return are
representable.

**Required Behavior:** Independently validate, render and evaluate arrays, calls, branches and
bounded loops, including the RD's boundary and invalid-neighbor distinctions.

**Fix Required:** Extend the closed IR and delegate structured logic through focused companions.
(AR-2, AR-4)

### Gap 2: Complete rule authority

**Current Behavior:** `RuleModelReason` still permits `outside-initial-slice`; the selected model
has only nine executable rows.

**Required Behavior:** Every inventory ID has separate applicability, claim role, evidence route
and decisive result, with reviewed family data and named non-source handlers.

**Fix Required:** Add the minimum versioned family/disposition data and exhaustive fail-closed
join. (AR-3, AR-6)

### Gap 3: Additive publication and bounded selection

**Current Behavior:** v1 publication has fixed members and separate parent/execution pointers;
normal smoke is file-selected but has no generated-case ceiling.

**Required Behavior:** Historical v1 stays byte-identical; changed-format evidence is selected
only after local evolution proof; normal smoke rejects case 5 per family and case 17 overall.

**Fix Required:** Add version dispatch/migration/replay invalidation and one capped selector while
reusing existing pointer transactions and command topology. (AR-5, AR-7)

## Dependencies

### Internal Dependencies

- Completed RD-01 inventory/schema, RD-02 generator/replay, RD-03 oracle and RD-04 execution.
- Completed RD-05 Phase 3 classification/exact-route/confirmation contracts only.
- Local RD-07 version dispatch/migration/failure-atomic selection/replay invalidation before the
  first changed-format selection.

### External Dependencies

- None added. Node 22, Yarn, Vitest, ACME and local VICE remain existing project tools. (AR-8)

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| New evaluator repeats compiler semantics too broadly | Medium | High | Closed minimal nodes and explicit proof-incomplete outcome (AR-2, AR-4) |
| 2,112 rows encourage bespoke code | Medium | High | Reviewed family data with one result per ID (AR-6) |
| Format change breaks historical replay | Medium | High | Byte-identical v1 plus local migration/replay tests before selection (AR-5) |
| Generated suite slows development | Medium | High | Explicit selector with 4/family and 16-total ceilings (AR-7) |
| Compiler defect blocks readiness work | High | Medium | Record exact failing evidence and route to owning feature; do not fix here (AR-1) |
| Existing large files grow further | High | Medium | Focused companion modules and 1–3-file execution tasks (AR-4) |

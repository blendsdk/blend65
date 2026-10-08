# Execution: source-library reachability prerequisite

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-08 20:42 CEST
> **Progress**: 0/10 tasks (0%)
> **CodeOps Artifact Schema**: 1
> **Scope mode**: strict

## Implementation phases

| Phase | Title                                  | Tasks |
| ----- | -------------------------------------- | ----- |
| 1     | Existing executable closure correction | 10    |

The remaining-RD-05 effort waiver applies. State recommended effort for each task; no repeated
effort pause. Use coherent green local commits through the git-commit skill; never push without
an explicit new request. Prior keyboard AR-P7 approval covers only this bounded support surface.

**Execution rule:** These task marks are the sole progress authority. Mark `[~]` on implementation
with the actual timestamp, promote `[x]` only after its verify passes, update Progress/Last Updated
immediately. Resume first `[~]`, otherwise first `[ ]`. Use `[!]` and `Blocked: reason` for a
real blocker. Each task occurs once. No broken/red checkpoint is committed.

## Phase 1: closure correction

> **Phase baseline tree**: Record at execution start.
> **Lenses**: compiler/language; concurrency (selected callback roots); data/compatibility.

### Step 1.1: specification tests

- [ ] 1.1.1 [spec-author] Write root specs ST-1–5 — `test/rd05/source-library-reachability.spec.test.ts`; source: [test strategy](07-testing-strategy.md).
- [ ] 1.1.2 [spec-author] Write data/output specs ST-6–16 — `test/rd05/source-library-observability.spec.test.ts`, `test/rd05/source-library-output.spec.test.ts`; source: [test strategy](07-testing-strategy.md).
- [ ] 1.1.3 Run new directed specs and record each red/pass justification before implementation.

**Verify:** Directed new cases; implementation-blind authorship and unchanged old oracles.

### Step 1.2: implementation

- [ ] 1.2.1 Correct executable/assignment entry classification — `semantic/whole-program.ts`, `semantic/function-targets.ts`; [closure §Executable roots](03-01-reachability.md#executable-roots-ar-24), AR-2/4.
- [ ] 1.2.2 Retain real global visibility metadata — `semantic/operations.ts`, `semantic/lower.ts`; [closure §Private data](03-01-reachability.md#private-data-ar-34), AR-3/4.
- [ ] 1.2.3 Select proved cold data before consumers — focused semantic helper and `semantic/whole-program.ts`; [closure](03-01-reachability.md), AR-3–5.
- [ ] 1.2.4 Run all new specification cases green; fix implementation only.

**Verify:** Typecheck and directed root/data/target/storage tests for each implementation task;
all new specs after the complete correction. Preserve immutable oracles.

### Step 1.3: implementation tests and hardening

- [ ] 1.3.1 Add internal boundary/scaling tests and correct export-only implementation expectation — `semantic/whole-program.impl.test.ts` and focused `*.impl.test.ts`; AR-3–6.
- [ ] 1.3.2 Run full checkpoint, actual artifact/resource controls and sequential runtime witnesses — existing verification commands from [test strategy](07-testing-strategy.md).
- [ ] 1.3.3 Complete applicable independent phase reviews, fix-only verification and bounded closeout — this plan, keyboard register and feature roadmap; AR-1/6.

**Verify:** Frozen install/build/typecheck/full Linux tests; targeted formatting/links and frozen
authority checks. Independent reviews consume the complete phase diff and exact evidence.

## Dependencies and completion

One phase; tasks execute in listed order, with all spec authoring/red complete before code changes.
Complete when all ten marks verify, the accepted artifact/resource bounds and retained effects are
proved, reviews have no unresolved critical/major findings, and downstream keyboard planning
names the finished prerequisite. This does not close RD-05 or qualify keyboard acquisition.

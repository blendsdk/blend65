# Execution Plan: RD-04 Compare-and-Branch Fusion

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-19 10:28
> **Progress**: 0/43 tasks (0%)
> **CodeOps Skills Version**: 3.9.0

## Overview

Five phases per plan-AR #1: terminator infrastructure → translator branch-form framings →
`guards` fixture pre-flip baseline → the atomic flip (condition lowering + SFA + corpus
supersession) → closeout. Phases 1–3 diff no existing golden; phase 4 changes all 14 in one
verify-green unit; the req-AR #22 staging fallback is not used. Each phase follows the
specification-first ordering (spec → red → implement → green → impl tests → verify).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | IL terminator & validation infrastructure | 10 |
| 2 | Translator branch-form framings | 9 |
| 3 | `guards` fixture — pre-flip baseline | 7 |
| 4 | The flip: condition lowering + SFA + corpus supersession | 14 |
| 5 | Closeout | 3 |

**Total: 43 tasks across 5 phases** (no fabricated hour estimates — scope is bounded by the
task-size criteria in the quality checklist)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for
> progress. Every task line appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote it to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** (`> **Progress**: X/Y tasks (Z%)`) and the Last Updated
>    stamp after EVERY task — never batch updates. Only `[x]` counts as complete.
> 4. **Resume** by scanning the phase sections top-to-bottom: the first `[~]` task is resumed
>    first, else the first `[ ]` task.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented. Failure to keep the marks
> current means progress is invisible after crashes, context resets, or session handoffs.

> **Routing note (roadmap):** execution is routed to Opus per the feature roadmap's RD-04 row
> ("Fable (design; exec → Opus)").

---

## Phase 1: IL terminator & validation infrastructure

### Step 1.1: Specification tests

**Reference**: 07 ST-9a–d, ST-13 · 03-01 · plan-AR #2, #4
**Objective**: Pin the `brcmp` contract before it exists.

- [ ] 1.1.1 Write printer + successor + termination spec cases (ST-9a/9b/9c, ST-13) — `packages/codegen/src/il/print-il.spec.test.ts`, `packages/codegen/src/il/termination.spec.test.ts` (new)
- [ ] 1.1.2 Write dangling-target ICE spec cases for all three branching kinds (ST-9d) — `packages/codegen/src/instr/translate.spec.test.ts`
- [ ] 1.1.3 Red phase: run the two suites; type errors on the not-yet-existing `brcmp` kind count as red for the type-level cases — document any case that passes

### Step 1.2: Implementation

**Reference**: 03-01 §Implementation Details
**Objective**: The terminator kind + every consumer that must understand it.

- [ ] 1.2.1 Add the `brcmp` union member; add `terminatorTargets()` (exhaustive switch closed by the repo's `default:` never-guard); amend `cfg.ts`'s "pure data" module header (records + this one pure helper) — `packages/codegen/src/il/instruction.ts`, `packages/codegen/src/il/cfg.ts`
- [ ] 1.2.2 Render `brcmp` in the printer — `packages/codegen/src/il/print-il.ts`
- [ ] 1.2.3 Rebase the termination walk on `terminatorTargets` (keep the constant-`brcond` taken-edge rule; `brcmp` = both edges); update the dangling-label comment — `packages/codegen/src/il/termination.ts`
- [ ] 1.2.4 Add the `validateTerminatorTargets()` pre-pass beside `prescanAll()` — `packages/codegen/src/instr/translate.ts`
- [ ] 1.2.5 Green phase: ST-9a–d and ST-13 pass; fix implementation only

### Step 1.3: Implementation tests & hardening

- [ ] 1.3.1 Impl tests: helper edge cases (`ret`/`unreachable` empty, order stable), pre-pass on ICE-degraded functions — `packages/codegen/src/il/termination.impl.test.ts`, `packages/codegen/src/instr/translate.impl.test.ts`
- [ ] 1.3.2 Full verification

**Deliverables**:
- [ ] `brcmp` exists, printable, terminable, validated; nothing emits it; zero golden diffs
- [ ] All verification passing

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: Translator branch-form framings

### Step 2.1: Specification tests

**Reference**: 07 ST-10a–c, ST-6 · 03-02
**Objective**: Byte-exact branch-form expectations per framing × polarity × operand order, both branch senses (inversion guard).

- [ ] 2.1.1 Write ST-10a matrix cases (constructed IL with `brcmp` terminators) — `packages/codegen/src/instr/translate.spec.test.ts`
- [ ] 2.1.2 Write ST-10b (signed sequence), ST-10c (deferred-load fold), ST-6 (value form byte-identical) — `packages/codegen/src/instr/translate.spec.test.ts`, `packages/codegen/src/instr/translate-expressions.spec.test.ts`
- [ ] 2.1.3 Red phase: `brcmp` inputs currently translate to NO output (`translateTerminator`'s switch has no `default` and falls through silently on an unhandled kind) — the byte-sequence expectations fail red on missing instructions; verify and document

### Step 2.2: Implementation

**Reference**: 03-02 §Implementation Details
**Objective**: Shared flag-producing cores, two tails; `brcmp` dispatch; use-count plumbing.

- [ ] 2.2.1 Extend `terminatorReads` with `brcmp` `[left, right]`; add the `translateTerminator` dispatch case and close its switch with the repo's `default:` never-guard (unhandled kind = compile error, not silent no-emission) — `packages/codegen/src/instr/translate.ts`
- [ ] 2.2.2 Refactor the 8-bit framings (unsigned/equality inline, `byteSignedOrdered`) into core + value/branch tails — `packages/codegen/src/instr/translate.ts`
- [ ] 2.2.3 Refactor the three word framings (`wordEquality`, `wordUnsignedOrdered` — internal labels become real targets, `wordSignedOrdered`) into core + tails — `packages/codegen/src/instr/translate.ts`
- [ ] 2.2.4 Green phase: ST-10a–c, ST-6 pass; fix implementation only

### Step 2.3: Implementation tests & hardening

- [ ] 2.3.1 Impl tests: `gt`/`le` swaps, memory-RHS word framings, `_cmp` label allocation, residency after fused blocks — `packages/codegen/src/instr/translate.impl.test.ts`
- [ ] 2.3.2 Full verification + confirm zero golden diffs (nothing emits `brcmp` yet)

**Deliverables**:
- [ ] All five framings translate `brcmp` to fused branch form; value form byte-identical
- [ ] All verification passing

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 3: `guards` fixture — pre-flip baseline

### Step 3.1: Fixture (spec-first: observables are the spec)

**Reference**: 07 ST-12 · 03-04 §The guards fixture · plan-AR #1, #5
**Objective**: The behavioral witness exists and is VICE-green BEFORE the flip.

- [ ] 3.1.1 Write the VICE observables spec + testing module skeleton (assertions from 03-04's four hazard shapes) — `packages/test-harness/src/guards.spec.test.ts`, `packages/test-harness/src/testing/guards.ts`
- [ ] 3.1.2 Red phase: suite fails (no fixture source yet)
- [ ] 3.1.3 Author the fixture source (four hazard shapes, deterministic observables) + inline verbatim; observables green on local VICE — `examples/guards/main.blend`, `packages/test-harness/src/testing/guards.ts`
- [ ] 3.1.4 Add the golden suite; generate + hand-review the PRE-FUSION baseline golden (it documents today's defect — reviewed as such) — `packages/test-harness/src/golden-guards.spec.test.ts`, `packages/test-harness/test/golden/guards.asm.golden`

### Step 3.2: Twin + corpus registration

**Reference**: 03-04 §Registration · plan-AR #1
**Objective**: The pair is a full corpus citizen with a measured "before" row.

- [ ] 3.2.1 Author the hand-written twin (blind to fused output — the parity bar) + twin tier green via the shared observables — `packages/test-harness/test/golden/guards.twin.asm`
- [ ] 3.2.2 Register: `twins.json` pair + routed divergence groups; `budgets.json` bytes + compound-guard window (current values, ratchet); regenerate `SCOREBOARD.md` — `packages/test-harness/test/golden/twins.json`, `budgets.json`, `SCOREBOARD.md`
- [ ] 3.2.3 Full verification + local VICE fixture & twin tiers + examples-sync green

**Deliverables**:
- [ ] `guards` pair committed with pre-fusion golden, twin, budgets, scoreboard row
- [ ] All verification passing

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (+ local VICE tiers)

---

## Phase 4: The flip — condition lowering + SFA + corpus supersession (atomic)

### Step 4.1: Specification tests

**Reference**: 07 ST-8a–g, ST-14, ST-15 · 03-03
**Objective**: The condition-position contract pinned on both packages before the flip.

- [ ] 4.1.1 Write lowering spec cases ST-8a–g + ST-14 — `packages/codegen/src/il/control-flow-lowering.spec.test.ts`, `packages/codegen/src/il/switch-lowering.spec.test.ts`
- [ ] 4.1.2 Write SFA adapter spec cases ST-14/ST-15 (position-dependent counts, structural definition) — `packages/frontend/src/sfa/model-adapter.spec.test.ts`
- [ ] 4.1.3 Red phase: verify the new cases fail against today's materializing lowering

### Step 4.2: Implementation (lowering + adapter, in step)

**Reference**: 03-03 §Implementation Details · req-AR #22 · plan-AR #3
**Objective**: Every condition statement lowers through `lowerCondition`; slots agree.

- [ ] 4.2.1 Implement `lowerCondition` + the shared comparison-operand/promotion helper factored from `lowerExpr` — `packages/codegen/src/il/lower.ts`
- [ ] 4.2.2 Rewire `lowerIf`/`lowerWhile`/`lowerDoWhile`/`lowerFor` predicate/`lowerSwitch` dispatch onto it — `packages/codegen/src/il/lower.ts`
- [ ] 4.2.3 Make the adapter's slot predicate position-dependent per the structural definition (no codegen import — R15) — `packages/frontend/src/sfa/model-adapter.ts`
- [ ] 4.2.4 Green phase on unit tiers: ST-8a–g, ST-14, ST-15 pass; fix implementation only

### Step 4.3: Corpus supersession (same change — req-AR #24)

**Reference**: 03-04 §Corpus supersession · req-AR #12, #17, #24
**Objective**: Every tier asserts the fused idiom; every committed number is current.

- [ ] 4.3.1 Rewrite pre-existing tests asserting the superseded materialize idiom (grep-enumerate per 03-04 §1; sanctioned oracle supersession) — codegen + frontend test files listed there
- [ ] 4.3.2 Regenerate all 14 goldens (`UPDATE_GOLDEN=1`; the balloon pair is twin-only); hand-review each diff with its twin beside it (ST-1/2/3/4/5/7 shapes; Prime Directive read) — `packages/test-harness/test/golden/*.asm.golden`
- [ ] 4.3.3 Tighten `budgets.json` to the new exact values (incl. locally re-measured phase-stable measured windows — balloon frameUpdate, req-AR #15 addendum); re-run `twin-diff` and update `twins.json` routing blocks for the changed divergence-group set (req-AR #18 — unrouted-group gate must pass); regenerate `SCOREBOARD.md`; CI freshness green — `packages/test-harness/test/golden/budgets.json`, `twins.json`, `SCOREBOARD.md`
- [ ] 4.3.4 Local VICE fixture + twin tiers green; assert ST-12 (`guards` observables identical to phase 3) — local run record
- [ ] 4.3.5 Full verification (includes ST-11 boundary tier)

### Step 4.4: Implementation tests & hardening

- [ ] 4.4.1 Impl tests: lowering nests (`!!`, mixed `&&`/`||`, `else if`, `downto`, poisoned types), adapter deep nesting — `packages/codegen/src/il/control-flow-lowering.impl.test.ts`, `packages/frontend/src/sfa/model-adapter.impl.test.ts`
- [ ] 4.4.2 Full verification

**Deliverables**:
- [ ] The corpus compiles, asserts, and measures the fused idiom end to end; no `0sc` claims in condition position; verify-green
- [ ] All verification passing

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (+ local VICE tiers)

---

## Phase 5: Closeout

### Step 5.1: Delta record, AC walk, sync

**Reference**: RD AC-1…AC-10 · 03-04 §Closeout delta record · plan-AR #7
**Objective**: Evidence recorded where the initiative tracks it.

- [ ] 5.1.1 Produce the delta record (phase-3 vs phase-4 scoreboard diff + `rasterpoll`/`guards` windows) and post the area report on issue #50 (tick its checklist) — GitHub #50
- [ ] 5.1.2 Walk RD-04 AC-1…AC-10 against the landed state; record the walk in the RD's checkboxes — `codeops/features/asm-parity/requirements/RD-04-compare-and-branch-fusion.md`
- [ ] 5.1.3 Roadmap sync (RD-04 row → Done per lifecycle) + final full verification — `codeops/features/asm-parity/00-roadmap.md`

**Deliverables**:
- [ ] Area report posted; ACs walked; roadmap current
- [ ] All verification passing

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Dependencies

```
Phase 1 (brcmp exists + validated)
    ↓
Phase 2 (translator understands brcmp)      — needs the type
    ↓
Phase 3 (guards baseline)                   — needs a working compiler, pre-flip
    ↓
Phase 4 (the flip + supersession, atomic)   — needs 1+2 (emitting brcmp must translate) and 3 (behavioral witness)
    ↓
Phase 5 (closeout)                          — needs the measured before/after
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (plan-AR #6 command; local VICE tiers for phases 3–5)
3. ✅ No warnings/errors
4. ✅ No dead code — the value-form tails remain reachable (value contexts); nothing else unused
5. ✅ Security posture per the RD: dangling-target ICE live; malformed terminators unrepresentable; framing × polarity inversion guard in place
6. ✅ Documentation updated (JSDoc on new exported symbols; RD AC boxes walked)
7. ✅ RD-04 AC-1…AC-10 all pass
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)

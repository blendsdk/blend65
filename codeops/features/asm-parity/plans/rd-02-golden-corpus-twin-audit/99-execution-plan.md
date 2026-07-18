# Execution Plan: RD-02 Golden-Corpus Twin Audit + Scoreboard

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-18 11:42
> **Progress**: 12/58 tasks (21%)
> **CodeOps Skills Version**: 3.9.0

## Overview

Five phases: shared observables foundation → twin tier + balloon retrofit + the shared scripts
corpus lib (the multi-module fix lands BEFORE the corpus needs it — plan-preflight PF-001) → the
13 twins in four batches → the scoreboard generator → the routed audit, committed scoreboard, and
CI gate. Requirements live in RD-02; design in 03-01…03-03; expectations in 07 (ST-1…ST-20);
decisions in the register (plan-AR #1…#12 + preflight addenda).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Shared observables foundation | 12 |
| 2 | Twin tier + balloon retrofit + scripts corpus lib | 13 |
| 3 | Twin corpus (four batches) | 17 |
| 4 | Scoreboard generator | 6 |
| 5 | Audit, routing, scoreboard & CI | 10 |

**Total: 58 tasks across 5 phases** (no fabricated hour estimates — scope is bounded by the
task-size criteria in the quality checklist)

> **Sequencing invariant (plan-preflight PF-001):** every committed, verify-gated state must be
> green — no task may leave the standing suites red for a later task to clear. Concretely: the
> scripts-lib multi-module fix precedes the corpus (Step 2.4); pair-entry and twin authorship are
> atomic per task (a manifest key never outlives a missing twin file); the twin-diff spec is
> amended ONCE to a computed-consistency form before the first pair lands; ST-10's corpus-coverage
> assertion and ST-18/ST-20 enter exactly when the world state they assert exists.

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for
> progress. Every task line appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote it to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** and the Last Updated stamp after EVERY task — never batch
>    updates. Only `[x]` counts as complete.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

> **Local-tier note:** ST-2, ST-5…ST-8, ST-10…ST-13 need VICE + ACME locally (CI skips them,
> AR-27 posture). "Green phase" for those tasks means green on the local emulator tier.

---

## Phase 1: Shared observables foundation

### Step 1.1: Specification tests

**Reference**: 07 ST-1…ST-4 · 03-01 · plan-AR #2, #5, #10
**Objective**: pin the observables contract, the Nth-arrival semantics, and source sync before code exists

- [x] 1.1.1 Write observables-module spec tests (ST-1, ST-3; fake driver) — `packages/test-harness/src/testing/observables.spec.test.ts` ✅ (completed: 2026-07-18 10:38)
- [x] 1.1.2 Write the live VICE Nth-arrival probe spec (ST-2) — `packages/test-harness/src/run/label-arrivals.spec.test.ts` — and the fake-driver lifecycle/error spec (ST-2b, runs everywhere) — `packages/test-harness/src/run/strategies.spec.test.ts` ✅ (completed: 2026-07-18 10:38)
- [x] 1.1.3 Write the inlined-source sync spec (ST-4) — `packages/test-harness/src/examples-sync.spec.test.ts` ✅ (completed: 2026-07-18 10:38)
- [x] 1.1.4 Red phase: ST-1/ST-2/ST-2b/ST-3 fail (module/strategy absent); ST-4 red for slice3b (known comment-only drift of `SLICE3B_SRC` vs `examples/slice3b/main.blend` — a genuine red proving the sync spec bites, plan-preflight PF-003); the other 17 modules pre-pass (verified byte-identical at plan time, documented per the ordering protocol) ✅ (completed: 2026-07-18 10:38 — observed: observables.spec load-fails [module absent]; 5×ST-2b + ST-2 fail `runUntilLabelArrivals is not a function`; ST-4 red exactly for slice3b, 17 modules green; log: scratchpad red-1.1.4.log)

### Step 1.2: Implementation

**Reference**: 03-01 §strategy, §module, §tables, §suites · plan-AR #2…#5
**Objective**: the shared module, the strategy, the 13 tables, the 2 new fixture suites

- [x] 1.2.1 Implement `runUntilLabelArrivals` (set-once/resume-n/delete) — `packages/test-harness/src/run/strategies.ts` ✅ (completed: 2026-07-18 10:58)
- [x] 1.2.2 Implement the observables module — `packages/test-harness/src/testing/observables.ts` ✅ (completed: 2026-07-18 10:58)
- [x] 1.2.3 Green phase: ST-1…ST-4 pass incl. ST-2b (ST-2 on local VICE — if the probe REFUTES Nth-arrival semantics, STOP and surface per 03-01); clear ST-4's slice3b red by updating `SLICE3B_SRC` to the example's exact text (`examples/` is the oracle — plan-AR #10 addendum) ✅ (completed: 2026-07-18 10:58 — 38/38 green, live ST-2 CONFIRMED Nth-arrival semantics on VICE; full verify exit 0)
- [x] 1.2.4 Export `OBSERVABLES` + refactor suites, first half: gate, slice3a, slice3b, slice4a, slice4b, slice5a (`testing/<fixture>.ts` + `<fixture>.spec.test.ts` pairs); local tier green for these (ST-8) ✅ (completed: 2026-07-18 11:07 — 6 suites / 11 tests green; build+typecheck+lint exit 0)
- [x] 1.2.5 Export `OBSERVABLES` + refactor suites, second half: slice5b, slice6, slice7, slice7b, slice8 (per plan-AR #3/#4 — ST-7), slice8b; local tier green (ST-8) ✅ (completed: 2026-07-18 11:18 — 6 suites / 12 tests green incl. slice8's exact $F2 readback; build+typecheck+lint exit 0)
- [x] 1.2.6 Add the fixture-side VICE suites (ST-5, ST-6) — `packages/test-harness/src/rasterpoll.spec.test.ts`, `packages/test-harness/src/balloon.spec.test.ts` ✅ (completed: 2026-07-18 11:27 — both green on live VICE; build+typecheck+lint exit 0)

### Step 1.3: Implementation tests & hardening

- [x] 1.3.1 Write impl tests (landmark ordering, option validation, block-file edges) — `packages/test-harness/src/testing/observables.impl.test.ts` ✅ (completed: 2026-07-18 11:42 — 7/7 green; full verify exit 0)
- [x] 1.3.2 Full verification ✅ (completed: 2026-07-18 11:42 — full verify command exit 0, incl. local VICE tier)

**Deliverables**:
- [x] One assertion source per fixture, two-consumer-ready; rasterpoll + balloon observable-tested
- [x] All verification passing

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (plan-AR #12)

---

## Phase 2: Twin tier + balloon retrofit

### Step 2.1: Specification tests

**Reference**: 07 ST-9…ST-13 · 03-02 · plan-AR #1, #6
**Objective**: the tier and loader specs exist and fail before the corpus mechanics do

- [ ] 2.1.1 Write manifest-loader spec tests (ST-9) — `packages/test-harness/src/twin-manifest.spec.test.ts`
- [ ] 2.1.2 Write the twin tier (ST-10a per-pair cases over the registered manifest pairs, ST-11 negative, ST-12 measured) — `packages/test-harness/src/twins.spec.test.ts`; the ST-10b corpus-coverage assertion (pair-set == corpus-set) is NOT written yet — it enters at corpus completion (3.5.3, plan-preflight PF-001)
- [ ] 2.1.3 Amend the budget tier's balloon measured case to exact equality (ST-13) — `packages/test-harness/src/budgets.spec.test.ts` (deliberate spec amendment per RD AC-6/PF-012)
- [ ] 2.1.4 Red phase: loader absent, twin behaviorally divergent, no measured reference — documented failures

### Step 2.2: Implementation

**Reference**: 03-02 §balloon, §twin-assemble, §loader · plan-AR #1, #8
**Objective**: a green balloon pair proving the whole twin path end-to-end

- [ ] 2.2.1 Fix `examples/balloon/balloon.asm` to the source's ±2 / `>=`-`<=` semantics and add the `update:` window label — plan-AR #1; RD F7
- [ ] 2.2.2 Implement twin assembly (ACME `--report` + `--vicelabels`, named-twin staging, `!to` rule) — `packages/test-harness/src/testing/twin-assemble.ts`
- [ ] 2.2.3 Implement the strict manifest loader — `packages/test-harness/src/twin-manifest.ts`
- [ ] 2.2.4 Measure the corrected twin's `update→mainloop` window (quiesced, identical across two fresh VICE processes) and record `measured` in `test/golden/twins.json` — RD AC-6
- [ ] 2.2.5 Green phase: ST-9, ST-10a (balloon — the only registered pair), ST-11…ST-13 pass on the local tier

### Step 2.3: Implementation tests & hardening

- [ ] 2.3.1 Write loader impl tests (error-message shapes, frozen returns) — `packages/test-harness/src/twin-manifest.impl.test.ts`

### Step 2.4: Scripts corpus lib (multi-module fix ahead of the corpus — plan-preflight PF-001)

**Reference**: 03-03 §lib · plan-AR #6, #8
**Objective**: the shared lib exists and multi-module builds work BEFORE any multi-module pair can enter the manifest

- [ ] 2.4.1 Write the lib spec (ST-14: `buildGeneratedSide` on a staged multi-module dir, direct lib import) as an amendment to `test/twin-diff.spec.test.ts`; red phase: lib absent
- [ ] 2.4.2 Extract `scripts/lib/twin-corpus.mjs` (strict `loadManifest`, multi-module `buildGeneratedSide` — `main.blend` first, rest sorted, named-twin `assembleTwin`, throw-not-exit); define `CATEGORIES` in the lib and re-export from `scripts/twin-diff.mjs` (plan-AR #6 addendum — avoids the lib↔CLI import cycle; `test/twin-diff.impl.test.ts` keeps its import point); rewire `twin-diff.mjs`; add the `twin-diff:` stderr-prefix assertion to the path-rejection spec (plan-preflight PF-005)
- [ ] 2.4.3 Green phase: ST-14 passes; ALL existing twin-diff suites stay green; full verification

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (plan-AR #12)

---

## Phase 3: Twin corpus (four batches)

> Spec-first shape: the twin tier (Phase 2) is the standing specification. **Pair-entry and twin
> authorship are ATOMIC per task** (plan-preflight PF-001): within one task the pair enters the
> manifest (tier red, naming the missing/failing twin — the observed red phase), the twin is
> authored, and the tier goes green before the task completes. A committed state never carries a
> manifest key without its twin file, so the standing twin-diff spec keeps passing throughout.
> Authorship contract: 03-02 §contract; twins are judged as the Prime Directive demands —
> idiomatic, commented, no observable-changing cleverness.

### Step 3.1: Corpus-transition spec amendment

- [ ] 3.1.1 Amend `test/twin-diff.spec.test.ts`'s `unpaired` expectation ONCE, from the membership pins (gate/slice8b) to computed consistency (`unpaired == goldens − manifest keys`) — a truer spec of the script's documented contract, valid at every corpus state (deliberate spec amendment; the empty-set pin lands at 3.5.2 per RD F3)

### Step 3.2: Batch A — gate, slice3a, slice3b, slice4a

- [ ] 3.2.1 Pair + author `gate.twin.asm` (red→green in-task)
- [ ] 3.2.2 Pair + author `slice3a.twin.asm` (red→green in-task)
- [ ] 3.2.3 Pair + author `slice3b.twin.asm` (red→green in-task)
- [ ] 3.2.4 Pair + author `slice4a.twin.asm` (red→green in-task)

### Step 3.3: Batch B — slice4b, slice5a, slice5b, slice6

- [ ] 3.3.1 Pair + author `slice4b.twin.asm` (red→green in-task)
- [ ] 3.3.2 Pair + author `slice5a.twin.asm` (red→green in-task; first multi-module pair — exercises 2.4's `buildGeneratedSide` fix through the standing twin-diff spec)
- [ ] 3.3.3 Pair + author `slice5b.twin.asm` (red→green in-task)
- [ ] 3.3.4 Pair + author `slice6.twin.asm` (red→green in-task)

### Step 3.4: Batch C — slice7, slice7b, slice8, slice8b

- [ ] 3.4.1 Pair + author `slice7.twin.asm` (red→green in-task)
- [ ] 3.4.2 Pair + author `slice7b.twin.asm` (red→green in-task)
- [ ] 3.4.3 Pair + author `slice8.twin.asm` honoring the strengthened `$D020 == $F2` contract (plan-AR #4); the twin must actually saturate (100 bumps) — the landmark is deterministic only at saturation (mod-16 aliasing, plan-preflight PF-009); red→green in-task
- [ ] 3.4.4 Pair + author `slice8b.twin.asm` (red→green in-task)

### Step 3.5: Batch D — rasterpoll + corpus completion

- [ ] 3.5.1 Pair + author `rasterpoll.twin.asm` (red→green in-task) — corpus complete at 14 pairs
- [ ] 3.5.2 Pin `test/twin-diff.spec.test.ts`'s `unpaired` expectation to empty (ST-15, deliberate spec amendment per RD F3) and confirm `yarn twin:diff` reports zero unpaired
- [ ] 3.5.3 Enable the ST-10b corpus-coverage assertion in the twin tier (pair-set == corpus-set: 13 goldens + balloon)
- [ ] 3.5.4 Full verification incl. the complete local twin tier

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (plan-AR #12)

---

## Phase 4: Scoreboard generator

> The scripts-lib extraction already landed in Step 2.4 (plan-preflight PF-001). ST-18/ST-20
> assert world states (committed routing, committed `SCOREBOARD.md`) that only Phase 5 creates —
> they are authored and turned green there, not here.

### Step 4.1: Specification tests

**Reference**: 07 ST-16, ST-17, ST-19 · 03-03 · plan-AR #6, #7 + #11 addendum (input flags)
**Objective**: generator enforcement pinned against temp inputs before it exists

- [ ] 4.1.1 Write generator spec tests (ST-16, ST-17, ST-19 — via `--manifest`/`--budgets` temp copies, 1-pair forms where possible; never committed assets; ST-19 asserts the `gen-parity-scoreboard:` stderr prefix) — `test/gen-parity-scoreboard.spec.test.ts`
- [ ] 4.1.2 Red phase: all fail (script absent)

### Step 4.2: Implementation

**Reference**: 03-03 §generator
**Objective**: a deterministic, routing-enforcing generator

- [ ] 4.2.1 Implement `scripts/gen-parity-scoreboard.mjs` + root alias `gen:scoreboard` — routing enforcement before output, deterministic render, measured columns from committed data, `--out`/`--manifest`/`--budgets` all repo-inside-canonicalized
- [ ] 4.2.2 Green phase: ST-16, ST-17, ST-19 pass

### Step 4.3: Implementation tests & hardening

- [ ] 4.3.1 Write generator impl tests (render helpers, totals, formatting) — `test/gen-parity-scoreboard.impl.test.ts`
- [ ] 4.3.2 Full verification

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (plan-AR #12)

---

## Phase 5: Audit, routing, scoreboard & CI

**Reference**: 03-03 §workflow · plan-AR #7, #9 · RD F6, F8, AC-3…AC-5, AC-7, AC-9

- [ ] 5.1.1 Run `yarn twin:diff` (+ `yarn annotate:cycles` evidence) over the complete corpus; compile every divergence group (pair × mechanical category)
- [ ] 5.1.2 Draft disposition(s) per group, incl. the balloon unrolled-pokes `sourceForced` data/placement case (RD F8); preview the rendered scoreboard against a draft-routed TEMP manifest via `--manifest` (no committed asset touched — plan-AR #9 posture)
- [ ] 5.1.3 Present the complete routing table to the user and STOP for confirmation — plan-AR #9 (no manifest commit, no GitHub write before this)
- [ ] 5.1.4 Write the confirmed `routing` blocks into `test/golden/twins.json`; loader specs stay green
- [ ] 5.1.5 Execute the confirmed GitHub writes: append #52's catalog, reference #49/#59, file any new structural issues
- [ ] 5.1.6 Write the full-corpus generator specs (ST-18 determinism/content, ST-20 freshness-on-mutation) — red while `SCOREBOARD.md` is absent (observed in-task)
- [ ] 5.1.7 Generate and commit `packages/test-harness/test/golden/SCOREBOARD.md`; ST-18 and ST-20 green (two-run byte-identity holds)
- [ ] 5.1.8 Add the CI "Scoreboard freshness" step (regenerate + `git diff --exit-code`) — `.github/workflows/ci.yml`
- [ ] 5.1.9 Add the re-sweep checklist item to umbrella #56 (RD AC-9)
- [ ] 5.1.10 Full verification; walk RD AC-1…AC-10 and record each as met (area report on #61 happens at RD close per the closeout convention)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (plan-AR #12)

---

## Dependencies

```
Phase 1 (observables foundation)
    ↓
Phase 2 (twin tier + balloon retrofit + scripts corpus lib)
    ↓      2.4's multi-module buildGeneratedSide fix MUST precede the corpus —
    ↓      batch B's slice5a/5b pairs exercise it through the standing twin-diff spec
Phase 3 (twin corpus, batches A→D; 14 pairs at 3.5)
    ↓
Phase 4 (scoreboard generator; ST-18/ST-20 deferred — their world state exists only after Phase 5's audit)
    ↓
Phase 5 (audit, routing, scoreboard, CI; ST-18/ST-20 authored + green at 5.1.6–5.1.7)
```

The CI freshness step deliberately lands in Phase 5 (after `SCOREBOARD.md` exists) — adding it
earlier would fail every build on the not-yet-routed corpus.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (the plan-AR #12 verify command), incl. the local emulator tier
3. ✅ No warnings/errors
4. ✅ No dead code — no unused parameters, functions, classes, or modules
5. ✅ Security hardened — RD-02 §Security verified via ST-19 (path rejection, malformed-input
   failure, argv-only spawns)
6. ✅ RD-02 AC-1…AC-10 all demonstrably met (5.1.10)
7. ✅ Documentation updated (JSDoc on new exported symbols; twin headers truthful)
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)

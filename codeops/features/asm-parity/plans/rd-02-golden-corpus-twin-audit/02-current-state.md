# Current State: RD-02 Golden-Corpus Twin Audit + Scoreboard

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What exists

RD-01's instruments are live: `scripts/twin-diff.mjs` (mechanical taxonomy + ratios, exports
`classifyDivergences`, spec/impl-tested from the root `test/` tier), `scripts/annotate-cycles.mjs`,
the `@blend65/core` timing table, `measureCycles`/`quiesce`
(`packages/test-harness/src/run/measure.ts`), and the ratcheting budget tier
(`budgets.spec.test.ts` + `budget-loader.ts` + `test/golden/budgets.json`). The pair manifest
`test/golden/twins.json` holds exactly one pair (balloon). 13 goldens exist; every golden fixture
has a builder in `testing/<fixture>.ts` and (except rasterpoll/balloon) a VICE spec suite
asserting memory observables inline.

### Relevant files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/test-harness/src/testing/<fixture>.ts` (×14) | Builders; gate + 11 slices + rasterpoll inline sources (17 of 18 modules byte-identical to `examples/`; `SLICE3B_SRC` drifts by comments — plan-preflight PF-003); balloon copies from `examples/balloon` (`balloon.ts:22-30`) | Export per-fixture `OBSERVABLES` tables (03-01) |
| `packages/test-harness/src/<fixture>.spec.test.ts` (×12 VICE suites: gate + 11 slices) | Inline `runUntilMemory`/`assertMemory` observable assertions | Consume `OBSERVABLES`; probes stay local (03-01) |
| `packages/test-harness/src/run/strategies.ts` | `runUntilLabel` (stops machine; leaks its checkpoint, :81-89), `runUntilMemory` (polls a RUNNING machine, :116-131) | Add `runUntilLabelArrivals` (03-01) |
| `packages/test-harness/src/fixture.ts` | `setupEmulator` accepts bare `binary` + `labelFile`, parses VICE `.lbl` (:22-33, :117-126) | None — the twin-tier loading path already exists |
| `packages/test-harness/src/budgets.spec.test.ts` | Balloon measured case asserts `≤ measuredMaxCycles` (:311-317) | Amend to exact equality (RD AC-6 / PF-012) |
| `packages/test-harness/test/golden/twins.json` | 1 pair, `{source, twin}` | 14 pairs + `measured` + `routing` (03-03) |
| `scripts/twin-diff.mjs` | `buildGeneratedSide` hardcodes `["main.blend"]` (:187) — breaks the 4 multi-module pairs; `assembleTwin` stages every `.asm` in the twin's dir (:203-206) | Extract + fix in `scripts/lib/twin-corpus.mjs`; export `CATEGORIES` (03-03) |
| `test/twin-diff.spec.test.ts` | Pins `unpaired` to contain `gate`/`slice8b` (:96-98); pins the path-rejection *message*, not the `twin-diff:` prefix (:114 — plan-preflight PF-005) | Two-stage deliberate spec amendment: computed-consistency form at Phase 3 start, empty pin at corpus completion (RD F3; plan-preflight PF-001); prefix pin added in 2.4 |
| `examples/balloon/balloon.asm` | The existing twin; ±1/exact-equality semantics diverge from source; labels `mainloop`/`vic`, no `update` label | Fix semantics (plan-AR #1); add `update` label (RD F7) |
| `.github/workflows/ci.yml` | Informational `twin:diff` step (:51-53) | Add "Scoreboard freshness" step (03-03) |
| `package.json` (root) | `twin:diff`, `annotate:cycles`, `gen:matrix` aliases (:18-20) | Add `gen:scoreboard` |

### Code analysis (load-bearing findings)

- **Balloon pair is not functionally identical** — `main.blend:96-103` (±2, `>=`/`<=`) vs
  `balloon.asm:57-105` (±1, exact `cmp`). Resolved by plan-AR #1(a).
- **Two of 14 programs have no observable suite**: `buildRasterpoll`/`buildBalloon` are consumed
  only by the budget tier, which asserts no memory observables. RD F2/PF-009 authors their sets.
- **`runUntilMemory` cannot serve frame-looping programs**: their state mutates every frame and
  one frame (~6–9k instructions) is shorter than the 20 000-instruction poll batch
  (`strategies.ts:25`) — hence the stopped-machine 2nd-arrival landmark (plan-AR #5).
- **Slice8 observables sit at compiler-allocated addresses** read from equates at test time
  (`slice8.spec.test.ts:64-66`) and its border check is a masked inequality (:81-82). Resolved by
  plan-AR #3/#4.
- **ACME twin symbol path exists end-to-end**: the installed ACME (0.97) supports
  `--vicelabels`; the compiler itself uses it and `parseLabelFile` reads that format, so a twin
  assembled with `--report` + `--vicelabels` loads through `setupEmulator({binary, labelFile})`
  unchanged.
- **The manifest can grow safely mid-migration**: `twin-diff.mjs:62-66` validates only
  `source`/`twin` and tolerates unknown pair keys until the strict validator lands. But a
  registered pair whose twin file is absent CRASHES the script (`assembleTwin` reads it,
  :203-208) — which is why pair-entry and twin authorship are atomic per task (plan-preflight
  PF-001) and the multi-module `buildGeneratedSide` fix precedes the corpus (Step 2.4).
- **`SLICE3B_SRC` has drifted from `examples/slice3b/main.blend`** (comment-only; verified by
  byte comparison of all 18 inlined modules — the other 17 match). ST-4's genuine red;
  reconciled to the example's text in Phase 1 (plan-preflight PF-003, plan-AR #10 addendum).

## Gaps Identified

### Gap 1: No twin corpus
**Current:** 1 twin (balloon, itself divergent). **Required:** 14 verified pairs.
**Fix:** Phases 2–3 (03-02).

### Gap 2: Assertion logic is per-suite, inline
**Current:** each VICE suite hardcodes its addresses/values; nothing is shareable.
**Required:** one assertion source per fixture, two consumers (RD F2).
**Fix:** Phase 1 (03-01).

### Gap 3: No scoreboard, no routing, informational-only CI
**Current:** twin-diff prints to CI logs, `continue-on-error: true`. **Required:** committed
`SCOREBOARD.md`, freshness-gated, routing-enforced. **Fix:** Phases 4–5 (03-03).

## Dependencies

### Internal
- RD-01 instruments (all shipped; `Done` on the feature roadmap).
- The built compiler + ACME for scripts; VICE 3.10 + ACME for the local tiers.

### External
- GitHub issues #49–#53, #56, #59, #61 (routing targets + closeout); `gh` CLI for exec-time
  writes (user-confirmed, plan-AR #9).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| VICE Nth-arrival checkpoint semantics differ from the documented assumption | Low | High (invalidates 2nd-arrival landmarks) | Live probe spec FIRST (plan-AR #2; ST-2); fall back to measureCycles-style tracked checkpoints if refuted |
| Twin authoring reveals a fixture whose observables can't be reproduced without impl coupling | Low | Medium | Source-mandated boundary (plan-AR #3) already excludes allocator-chosen addresses; surface-during-authoring rule otherwise |
| Scoreboard nondeterminism (ordering, temp paths) breaks CI freshness | Medium | Medium | Determinism spec test (two-run byte-identity) + sorted iteration everywhere (03-03) |
| 13-twin authoring effort balloons | Medium | Low (schedule only) | Four batches with per-batch green gates; the tier ratchets pair-by-pair |
| Local VICE tier runtime grows (14 twin cases + 2 new fixture cases, sequential) | High | Low | Accepted — `fileParallelism: false` is the established emulator-tier posture |
| CI wall-time grows: full-corpus generator runs (14 builds + 14 assemblies each) in ST-18 ×2, the freshness step, and the informational twin-diff step at 14 pairs (plan-preflight PF-010) | Medium | Low | ST-16/17/19 use 1-pair temp manifests via `--manifest`; measure the full-run cost at Phase 4 before deciding whether anything needs trimming |

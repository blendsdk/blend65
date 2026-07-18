# Testing Strategy: RD-02 Golden-Corpus Twin Audit + Scoreboard

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage goals

| Code type | Target |
| --------- | ------ |
| Observables module, manifest loaders, generator logic | 90% |
| Strategies addition, twin-assemble, suite glue | 80% |
| CI yaml / package.json aliases | verified by the CI run itself |

- Test names state behavior: `should [expected behavior] when [condition]`.
- Tiers follow the established split: unit/fake-driver specs run everywhere; ACME-bearing specs
  `skipIf(!hasAcme())` (run in CI); VICE specs `skipIf(!(hasVice && hasAcme))` (local only,
  sequential). Root-`test/` script specs additionally guard on `hasDist()`.
- Twins themselves are test ASSETS — their "coverage" is the twin tier (ST-10) plus the golden
  corpus they mirror.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from RD-02, the component specs (03-01…03-03), and the Ambiguity Register.
> **IMMUTABLE ORACLE RULE:** if the implementation does not match a spec test case, the
> implementation is wrong — not the test.
> The `Source` column lives in this plan document; in-code traceability comments quote behavior
> in plain language, never ST/AR ids or planning paths.

### Observables foundation (03-01)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `assertObservables` on a fake driver whose memory holds 9 where a check expects `{address: 0xC000, value: 7}` | `AssertionError` naming the address, expected 7, actual 9; a matching memory image passes | plan-AR #2; RD F2 |
| ST-2 | Live VICE probe: `runUntilLabelArrivals(driver, symbols, <loop head>, 2)` on the built rasterpoll fixture | Machine stopped with `pc == symbols.get(loop head)`; `$0400` then reads exactly 1 (one frame body ran); the tracked checkpoint is deleted afterwards (a subsequent resume does not re-break there) | plan-AR #2, #5 |
| ST-2b | Fake-driver `runUntilLabelArrivals` lifecycle/errors: checkpoint set once and deleted on success AND on a thrown/timeout path; unknown label; a driver without the measurement capabilities | Runs everywhere (no VICE — mirrors the per-strategy fake-driver convention): exactly one `setCheckpoint`/`deleteCheckpoint` pair per call incl. error exits; unknown-label error names sample keys; capability-less driver rejected naming the caller | plan-AR #2; plan-preflight PF-008 |
| ST-3 | Block check `{address: 0x0340, bytesFile: examples/balloon/balloon.bin}` against a fake driver staged with those 63 bytes; then with one byte flipped | Match passes; flipped byte fails naming the file and the mismatching offset; a length/read shortfall fails naming the file and both lengths | plan-AR #5 |
| ST-4 | `examples-sync.spec.test.ts`: every inlined `*_SRC` constant vs its `examples/<fixture>/<module>.blend` — incl. slice5a `math.blend`, slice5b `math.blend`+`math2.blend`, slice7 `gfx.blend`, slice7b `game.blend` | Byte-for-byte equal for all inlined modules of the 13 inlined-source programs; balloon and `.bin` assets not asserted | plan-AR #10; RD F3, AC-1 |
| ST-5 | New `rasterpoll.spec.test.ts` on VICE: `assertObservables` with the rasterpoll set (loopHead arrivals=2, generated loop-head label from the build's symbols) | `$0400 == 1` and `$D020 == 0xF1` at the stopped 2nd arrival | plan-AR #5; RD AC-2 |
| ST-6 | New `balloon.spec.test.ts` on VICE: balloon set at the stopped 2nd arrival | `$D000 == 174`, `$D010 == 0`, `$D001 == 141`, `$07F8 == 13`, `$D015 == 1`, `$D027 == 0xF1`, `$D017/$D01C/$D01D == 0`, block `$0340` == `balloon.bin` | plan-AR #1, #5; RD AC-2 |
| ST-7 | Refactored slice8 suite: fixture-local counter/mirror waits (equate-derived addresses), then the shared set | Shared set asserts exactly `$D020 == 0xF2` (readback of (14+100) mod 16 = 2); the counter/mirror assertions no longer appear in the shared table | plan-AR #3, #4 |
| ST-8 | All 12 existing VICE suites (gate + 11 slices) after the refactor (local tier run) | Every suite passes consuming its `OBSERVABLES` table; implementation probes (e.g. gate's `_main` opcode/PC checks) still present and fixture-local | RD F2; PF-011 |

### Twin corpus & tier (03-02)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-9 | `loadTwinManifest` validation matrix: valid 14-pair manifest; unknown pair key; routing key not in `CATEGORIES`; `parity` entry with `issue`; non-`parity` entry without `issue`; malformed `measured` | Valid loads typed; each invalid case throws naming file + JSON path, and for vocabulary errors, WHICH vocabulary (mechanical category vs routing disposition) | plan-AR #6 |
| ST-10 | `twins.spec.test.ts` on VICE, completed manifest | All 14 pairs: twin assembles via ACME (report + vicelabels), loads via `setupEmulator({binary, labelFile})`, passes the IDENTICAL `OBSERVABLES` table its fixture suite used (**ST-10a**, green per registered pair from Phase 2 on); the tier also asserts pair-set == corpus-set, 13 goldens + balloon (**ST-10b** — enters at corpus completion, 3.5.3; plan-preflight PF-001) | RD F1, F2, AC-1, AC-2 |
| ST-11 | One twin case run against a deliberately byte-flipped expected observable (temp copy) | Exactly that twin's case fails, naming the twin; other pairs unaffected | RD AC-2 |
| ST-12 | Balloon twin measured window: quiesced `measureCycles(vice, symbols, "update", "mainloop")` on the corrected twin | Fresh measurement equals the manifest's `measured.cycles` exactly | RD F7, AC-6; PF-012 |
| ST-13 | Budget tier balloon measured case after amendment | Fresh measurement equals `budgets.json`'s `measuredMaxCycles` exactly (not merely ≤); the ratchet-bites negative (measurement vs measurement−1) still fails naming balloon/frameUpdate | RD AC-6; PF-012 |

### Scripts, scoreboard & CI (03-03)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-14 | `buildGeneratedSide` (lib) on a staged multi-module dir (slice5b: `main`+`math`+`math2`) — direct lib import, authored in Step 2.4 as an amendment to `test/twin-diff.spec.test.ts` | Build succeeds; all modules compiled (no unresolved-module failure) | plan-AR #8; plan-preflight PF-001 |
| ST-15 | `yarn twin:diff` with the completed manifest | Zero unpaired programs; the twin-diff spec's `unpaired` expectation is the amended empty form (interim corpus states are covered by the 3.1.1 computed-consistency form) | RD F3, AC-1 |
| ST-16 | Generator on a temp manifest (`--manifest`, 1-pair form) missing a routing entry for a computed divergence group | Exit non-zero naming the pair AND the mechanical category; no output file written | RD F6, AC-5; plan-AR #6, #11 addendum |
| ST-17 | Generator on a temp manifest (`--manifest`) with a routing key whose category has zero computed divergence rows | Exit non-zero naming the stale key; no output written | plan-AR #7, #11 addendum |
| ST-18 | Two consecutive `yarn gen:scoreboard` runs on pristine repo state — **authored + green in Phase 5 (5.1.6–5.1.7): requires the committed routing blocks and `SCOREBOARD.md`** (plan-preflight PF-001) | Byte-identical output containing: all 14 pair rows, bytes + static-cycle ratios to two decimals, a corpus totals row, balloon measured columns sourced from `budgets.json` + manifest, per-pair routing sections with issue links and the `sourceForced` annotation on the balloon data-placement entry | RD F4, AC-3, AC-5, AC-7 |
| ST-19 | Generator `--out ../outside.md`; generator on malformed manifest JSON (`--manifest` temp copy) | Path rejected before any build work; malformed input fails loudly naming file + path under the `gen-parity-scoreboard:` stderr prefix (spec-demonstrated per RD security requirements; plan-preflight PF-005) | RD AC-8 |
| ST-20 | Generator run with `--budgets` pointing at a temp-mutated copy (one measured value changed), output diffed against the committed scoreboard — **authored + green in Phase 5 (5.1.6–5.1.7)** | Output differs — demonstrating the CI freshness step fails on stale committed data and `yarn gen:scoreboard` clears it | RD F5, AC-4 |

> **⚠️ AUTHORING RULE:** expectations above derive from the RD, the register, and the committed
> sources (`main.blend` semantics for ST-6; VIC-II readback behavior already pinned by the gate
> suite). If an expected value cannot be derived from those sources at implementation time, STOP
> and add a register entry — never infer from the implementation.

## Test Categories

### Specification tests (from ST-cases above)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/test-harness/src/testing/observables.spec.test.ts` (fake driver) | ST-1, ST-3 | 03-01 |
| `packages/test-harness/src/run/label-arrivals.spec.test.ts` (VICE, local) | ST-2 | 03-01 |
| `packages/test-harness/src/run/strategies.spec.test.ts` (amended; fake driver, runs everywhere) | ST-2b | 03-01 |
| `packages/test-harness/src/examples-sync.spec.test.ts` | ST-4 | 03-01 |
| `packages/test-harness/src/rasterpoll.spec.test.ts` (new VICE suite) | ST-5 | 03-01 |
| `packages/test-harness/src/balloon.spec.test.ts` (new VICE suite) | ST-6 | 03-01 |
| 12 refactored fixture suites (gate + 11 slices) | ST-7, ST-8 | 03-01 |
| `packages/test-harness/src/twin-manifest.spec.test.ts` | ST-9 | 03-02 |
| `packages/test-harness/src/twins.spec.test.ts` (VICE, local) | ST-10, ST-11, ST-12 | 03-02 |
| `packages/test-harness/src/budgets.spec.test.ts` (amended) | ST-13 | 03-02 |
| `test/twin-diff.spec.test.ts` (amended: computed-consistency `unpaired`, `twin-diff:` prefix pin, direct-lib ST-14) | ST-14, ST-15 | 03-03 |
| `test/gen-parity-scoreboard.spec.test.ts` (ST-18/ST-20 authored in Phase 5) | ST-16…ST-20 | 03-03 |

### Implementation tests (after implementation)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/test-harness/src/testing/observables.impl.test.ts` | Landmark ordering, option-validation branches, block-file resolution edges | High |
| `packages/test-harness/src/twin-manifest.impl.test.ts` | Loader internals: error-message shapes, frozen returns | Medium |
| `test/gen-parity-scoreboard.impl.test.ts` | Render helpers (CLI-gated exports): totals arithmetic, two-decimal formatting, routing-section rendering | High |

### Integration / E2E

| Scenario | Steps | Expected |
| -------- | ----- | -------- |
| Full local tier | verify command with VICE + ACME present | All suites incl. twins tier green; sequential VICE |
| CI (no VICE) | push branch | Typecheck/lint/build/test green; twin-diff informational; Scoreboard freshness green |

## Test Data

- **Fixtures:** the 13 committed goldens + `examples/` sources (already present); the 13 new
  twins (authored in Phase 3); temp-mutated manifest/budget copies for negative cases (never
  mutate committed assets in tests).
- **Mocks:** the existing `testing/fake-driver.ts` only; everything else uses real
  ACME/VICE/compiler per the local-tier conventions.

## Verification Checklist

- [ ] All ST cases defined with concrete input/output pairs — yes, above
- [ ] Every ST case traces to RD / component doc / AR entry — yes, Source column
- [ ] Spec tests written BEFORE implementation, red phase verified (sync/equality cases that
      pass pre-implementation are documented with justification per the ordering protocol;
      ST-4 enters RED for slice3b — known comment-only drift, plan-preflight PF-003)
- [ ] Green phase after implementation; impl tests after; full verify (plan-AR #12) at each
      phase gate

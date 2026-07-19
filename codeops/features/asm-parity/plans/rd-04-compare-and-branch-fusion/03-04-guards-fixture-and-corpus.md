# Guards Fixture & Corpus Supersession: RD-04 Compare-and-Branch Fusion

> **Document**: 03-04-guards-fixture-and-corpus.md
> **Parent**: [Index](00-index.md)

## Overview

The `guards` acceptance fixture (plan-AR #5) — authored BEFORE the flip so its twin stays blind
to fused output and its VICE observables guard phase 4 (plan-AR #1) — plus the mechanics of the
corpus supersession the flip performs (req-AR #24, #12, #17).

## The `guards` fixture

### Program shape

`examples/guards/main.blend` — a small game-shaped loop containing exactly the RD's four hazard
shapes (RD "Acceptance shapes have named homes"), each observable through screen/border pokes so
the VICE tier asserts behavior, not code shape:

- **compound guard**: `if (x >= 8 && x < 40)` — unsigned bytes, the sprite-window check
  (RD AC-3: two fused sequences, no `0sc` traffic, second clause reachable only via the
  first's true edge);
- **free negation**: `if (!active)` (RD AC-4);
- **signed compare**: sbyte velocity test, e.g. `if (dx < dy)` (RD AC-5 framing);
- **peek in the right clause**: `if (armed && peek($DC00) == 127)` (RD AC-7: the load sits in
  the right-clause block only).

Final source text is authored at execution against these constraints (observable pokes to
`$0400`-area cells + `$D020`, deterministic iteration so observables settle); the constraint
list above is the spec, per ST-12.

### Registration (model: rasterpoll)

| Asset | Path | Notes |
| ----- | ---- | ----- |
| Source | `examples/guards/main.blend` | inlined verbatim in the testing module (examples-sync tier asserts the copies match) |
| Testing module | `packages/test-harness/src/testing/guards.ts` | `GUARDS_MAIN_SRC`, `build`/`emitAsm` helpers, observables — model `testing/rasterpoll.ts` |
| VICE suite | `packages/test-harness/src/guards.spec.test.ts` | memory-observable assertions; `describe.skipIf(!hasVice()||!hasAcme())` |
| Golden suite | `packages/test-harness/src/golden-guards.spec.test.ts` | CI tier, `assertGolden` against `test/golden/guards.asm.golden` |
| Twin | `packages/test-harness/test/golden/guards.twin.asm` | hand-written expert asm, authored pre-flip (plan-AR #1), verified via the SAME observables in the twin tier |
| Manifest | `test/golden/twins.json` | pair entry + routed divergence groups (generator enforces no group without a disposition) |
| Budgets | `test/golden/budgets.json` | bytes + a `windows` entry over the compound-guard block (ratchet: current values at entry, tightened in phase 4 — req-AR #12) |
| Scoreboard | `test/golden/SCOREBOARD.md` | regenerated (`node scripts/gen-parity-scoreboard.mjs`); the pre-flip row is the measured "before" |

## Corpus supersession (phase 4, same change — req-AR #24)

The flip changes every condition in every fixture. The supersession surface, in order:

1. **Codegen spec tests asserting the `_cmp` materialization pattern** — rewrite to the fused
   idiom (immutable-oracle note: these rewrites are REQUIRED by the RD, which supersedes the
   old expectations; the RD is the oracle, not the old tests). Affected homes:
   `instr/translate.spec.test.ts`, `instr/translate-expressions.spec.test.ts`,
   `instr/generate.golden.spec.test.ts`, `instr/multiblock-translate.impl.test.ts`,
   `instr/switch-translate.spec.test.ts`, `il/control-flow-lowering.spec.test.ts`,
   `il/switch-lowering.spec.test.ts`, `il/lower*.test.ts` where they pin `brcond`-materialized
   shapes, `il/print-il.golden.spec.test.ts`, plus frontend SFA adapter tests pinning
   position-independent slot counts. (Execution enumerates the concrete list by grepping the
   suites; anything asserting 0/1-materialization in condition position is in scope.)
2. **Golden regeneration** — `UPDATE_GOLDEN=1` across the harness (all 14 goldens including
   `guards` — the balloon pair is twin-only, so the scoreboard has 15 pairs but 14 golden
   files), then a per-golden hand review with the twin beside it: the diff must read as an
   expert's fused idiom (Prime Directive). No golden is committed unreviewed.
3. **Budgets** — `budgets.json` tightened to the new exact byte/cycle values in the same
   change (ratchet, req-AR #12); the `guards` and `rasterpoll` windows demonstrate the cycle
   drop (RD AC-1: rasterpoll poll path ≤12 static cycles). Phase-stable MEASURED windows
   (balloon frameUpdate) are re-measured locally and refreshed in the same change — the
   budget tier's exact-equality assertion (req-AR #15 addendum) must hold against the new
   value.
4. **Twin-diff routing re-audit** — re-run `twin-diff` per pair and update each pair's
   `routing` block in `twins.json` for the changed divergence-group set (req-AR #18): the
   structural groups routed to #50 (rasterpoll "poll compare/branch not fused", balloon
   "bounce compares") should shrink to nothing — that disappearance IS the evidenced fix.
   The scoreboard generator's unrouted-group gate must pass before the next item.
5. **Scoreboard** — regenerated; CI freshness gate must pass (req-AR #17).
6. **Emulator proof** — local VICE fixture tier AND twin tier green (fused control flow is
   observationally identical; RD Integration with RD-02). `guards` observables must be
   IDENTICAL to their phase-3 values (ST-12 — the fixture is the behavioral before/after
   witness).
7. **Boundary** — `test/boundary.spec.test.ts` green (RD AC-9).

## Closeout delta record (phase 5 — plan-AR #7)

Per-fixture before/after bytes and straight-line cycles: the committed scoreboard diff
(phase 3 baseline vs phase 4 regeneration) plus the `rasterpoll`/`guards` window values,
quoted in the area report on issue #50. Tooling: `scripts/gen-parity-scoreboard.mjs`,
`scripts/twin-diff.mjs`, `scripts/annotate-cycles.mjs` (RD-01 instruments).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Golden diff shows non-fused residue (`_cmp` labels in condition position) | Hand review rejects; fix codegen, regenerate — never commit | req-AR #24 |
| `guards` observables differ pre/post flip | STOP — behavioral regression; the flip is wrong, not the fixture | plan-AR #1 |
| Scoreboard stale in CI | Freshness gate fails the build | req-AR #17 |

## Testing Requirements

- Spec: ST-11 (boundary), ST-12 (guards observables invariant across the flip), ST-1…ST-7
  golden-level shapes (07).
- Impl: none beyond the tiers themselves — this component IS test assets.

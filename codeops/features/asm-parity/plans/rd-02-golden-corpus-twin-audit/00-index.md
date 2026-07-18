# RD-02 Golden-Corpus Twin Audit + Scoreboard — Implementation Plan

> **Feature**: 13 hand-written twins for the golden corpus, a permanent VICE twin tier, the
> committed parity scoreboard with CI freshness, and a fully routed divergence inventory
> **Status**: Planning Complete
> **Created**: 2026-07-18
> **Implements**: asm-parity/RD-02
> **CodeOps Skills Version**: 3.9.0

## Overview

RD-01 shipped the parity instruments (twin-diff taxonomy + ratios, timing table,
`measureCycles`/`quiesce`, ratcheting budgets). This plan supplies the corpus those instruments
were built for: an expert hand-written twin for each of the 13 goldens (`gate`,
`slice3a`–`slice8b`, `rasterpoll`), each earning functional equivalence on real VICE through the
same memory-observable assertions its fixture uses, plus the committed `SCOREBOARD.md` — the
number the compiler drives toward 1.00× — kept honest by a CI freshness gate and a
generator-enforced routing invariant (no divergence group without a disposition).

No compiler package changes: the deliverables are test assets, a test tier, dev scripts, one CI
step, and two example-side fixes surfaced during planning — the balloon twin's behavioral
divergence from its source (plan-AR #1) and its measured-window labels (RD F7).

Execution follows five phases: shared observables foundation → twin tier + balloon retrofit +
the shared scripts corpus lib (the multi-module fix lands before the corpus needs it) → the 13
twins in four batches, pair-entry and authorship atomic per task → the scoreboard generator →
the routed audit, committed scoreboard and CI gate (routing table user-confirmed before manifest
commit and GitHub writes, plan-AR #9). Sequencing re-staged at plan preflight (PF-001) so every
committed state stays verify-green.

## Document Index

| #   | Document                                                     | Description                                   |
| --- | ------------------------------------------------------------ | --------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)               | Zero-Ambiguity Gate decisions (12 + preflight addenda, all resolved) |
| 00  | [Index](00-index.md)                                         | This document — overview and navigation       |
| 01  | [Requirements](01-requirements.md)                           | Delta view onto RD-02 (the owning RD)         |
| 02  | [Current State](02-current-state.md)                         | What exists, gaps, risks                      |
| 03-01 | [Shared Observables & Fixture Suites](03-01-observables-and-fixture-suites.md) | Observables module, Nth-arrival strategy, suite refactor, sync test |
| 03-02 | [Twin Corpus & Verification Tier](03-02-twin-corpus-and-tier.md) | Twin authorship, twin assembly, manifest loader, `twins.spec.test.ts`, balloon fix + measured window |
| 03-03 | [Manifest Routing, Scoreboard & CI](03-03-manifest-scoreboard-ci.md) | `scripts/lib` extraction, generator, freshness step, audit workflow |
| 07  | [Testing Strategy](07-testing-strategy.md)                   | Specification test cases (ST-*) and verification |
| 99  | [Execution Plan](99-execution-plan.md)                       | Phases, sessions, task checklist              |

## Quick Reference

### Usage examples

```bash
yarn twin:diff                 # mechanical divergence report, all 14 pairs (RD-01 tool, completed manifest)
yarn gen:scoreboard            # regenerate packages/test-harness/test/golden/SCOREBOARD.md
yarn workspace @blend65/test-harness test   # includes twins.spec.test.ts locally (VICE + ACME)
```

### Key decisions

| Decision | Outcome |
| -------- | ------- |
| Balloon pair divergence | Fix the twin to the source's ±2 / `>=`-`<=` semantics (plan-AR #1) |
| Assertion sharing | Data-first `testing/observables.ts`; per-fixture `OBSERVABLES` tables, one runner (plan-AR #2) |
| Shared-set boundary | Source-mandated addresses only; slice8 border strengthened to exact `$F2` (plan-AR #3, #4) |
| Manifest schema | `measured` + `routing` blocks in `twins.json`; stale routing = error (plan-AR #6, #7) |
| Code sharing | `scripts/lib/twin-corpus.mjs` + harness-internal `twin-manifest.ts` (plan-AR #8) |
| Audit workflow | Routing table user-confirmed before commit/GitHub writes (plan-AR #9) |

## Related Files

Created: 13 `<fixture>.twin.asm` (beside goldens) · `testing/observables.ts` ·
`testing/twin-assemble.ts` · `twin-manifest.ts` (+ tests) · `twins.spec.test.ts` ·
`rasterpoll.spec.test.ts` · `balloon.spec.test.ts` · `examples-sync.spec.test.ts` ·
`scripts/lib/twin-corpus.mjs` · `scripts/gen-parity-scoreboard.mjs` (+ root `test/` specs) ·
`test/golden/SCOREBOARD.md`.
Modified: 12 existing fixture suites (gate + 11 slices) + the 14 `testing/<fixture>.ts` helpers ·
`run/strategies.ts` · `budgets.spec.test.ts` · `twins.json` · `examples/balloon/balloon.asm` ·
`scripts/twin-diff.mjs` · `test/twin-diff.spec.test.ts` · root `package.json` ·
`.github/workflows/ci.yml`.

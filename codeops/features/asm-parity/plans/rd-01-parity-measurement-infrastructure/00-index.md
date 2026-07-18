# RD-01 Parity Measurement Infrastructure — Implementation Plan

> **Feature**: Instruments for the Prime Directive — measured cycles, timing table, ratcheting budgets, twin-diff, size gate, annotator, report integration
> **Status**: Planning Complete
> **Created**: 2026-07-18
> **Implements**: asm-parity/RD-01
> **CodeOps Skills Version**: 3.9.0

## Overview

The Prime Directive judges every compiler change by output parity with hand-written 6502
assembly, but nothing in the toolchain measures parity today. This plan builds the instruments
defined by [RD-01](../../requirements/RD-01-parity-measurement-infrastructure.md): a shared NMOS
6502 timing table in `@blend65/core`, exact measured cycle counts in the VICE harness, a
ratcheting byte/cycle budget tier (static in CI, measured locally), a golden↔twin diff tool
with parity ratios, a static cycle annotator, and per-function cycle estimates in the resource
report.

The plan's central technical decision — the VICE cycle-measurement mechanism deferred by
req-AR #1 — was resolved by a live protocol spike against VICE 3.10.0: the binary monitor has no
cycle counter, but the text remote monitor's **stopwatch** coexists with the binary monitor and
measured a known hardware ground truth cycle-exactly. measureCycles reads the absolute counter
at the from-label and to-label checkpoint stops and subtracts (plan-AR #1), under the
phase-locking determinism contract (plan-AR #10).

## Document Index

| #   | Document                                         | Description                                        |
| --- | ------------------------------------------------ | -------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)   | Zero-Ambiguity Gate decisions (11 items, audit trail) |
| PF  | [Preflight Report](00-preflight-report.md)       | Plan preflight — 11 findings (PF-009…PF-019), all resolved; fixes applied |
| 00  | [Index](00-index.md)                             | This document — overview and navigation            |
| 01  | [Requirements](01-requirements.md)               | Delta view onto RD-01 + plan-local decisions       |
| 02  | [Current State](02-current-state.md)             | Verified current implementation + spike evidence   |
| 03-01 | [Timing Table](03-01-timing-table.md)          | `@blend65/core` `timing/` module (F1)              |
| 03-02 | [Cycle Measurement](03-02-cycle-measurement.md)| Text-monitor client, measureCycles, driver fix (F2) |
| 03-03 | [Budget Tier](03-03-budget-tier.md)            | budgets.json, size gate, rasterpoll fixture, windows (F3/F4) |
| 03-04 | [Parity Scripts](03-04-parity-scripts.md)      | twin-diff, annotate-cycles, manifest, CI step (F5/F6/F9) |
| 03-05 | [Resource Report](03-05-resource-report.md)    | Per-function estimates + startupCycles (F7/F8)     |
| 07  | [Testing Strategy](07-testing-strategy.md)       | Specification test cases ST-1…ST-31                |
| 99  | [Execution Plan](99-execution-plan.md)           | 7 phases, task checklist                           |

## Quick Reference

### Usage Examples

```ts
// Local emulator tier (skipIf(!hasVice())):
const cycles = await measureCycles(driver, symbols, "Main_update", "Main_pollEntry");

// Static costing anywhere (mode literals are the PascalCase instr-model union values):
const t = getTiming("LDA", "AbsoluteX"); // { bytes: 3, baseCycles: 4, pageCrossPenalty: 1, ... }
```

```bash
yarn twin:diff                 # markdown scoreboard for all golden↔twin pairs
yarn annotate:cycles build/main.report   # cycle-annotated listing from an ACME report
```

### Key Decisions

| Decision | Outcome |
| -------- | ------- |
| Cycle mechanism | Text-monitor stopwatch, absolute reads (plan-AR #1) |
| Measured metric | Elapsed machine cycles — DMA stalls + IRQs included (plan-AR #2) |
| Determinism | Phase-locking contract (plan-AR #10); budget windows harness-quiesced (PF-009) |
| budgets.json shape | Nested per-program schema, `kind: span \| perIteration` (plan-AR #3) |
| Cost-stream acquisition | Shared ACME report parser in `compiler/src/acme/` (PF-010) |
| F7/F8 cost owner | Producers compute via core `timing/` (plan-AR #6); plugin `startupCost` member (PF-012) |
| Driver race | Fixed in this RD — STOPPED-event completion (plan-AR #8) |

## Related Files

Created: `packages/core/src/timing/*`, `packages/compiler/src/acme/report-file.ts`,
`packages/test-harness/src/run/measure.ts`,
`packages/test-harness/src/emulator/vice/text-monitor.ts`, `packages/test-harness/src/testing/rasterpoll.ts`,
`packages/test-harness/src/testing/balloon.ts`, `packages/test-harness/src/budgets.spec.test.ts`,
`packages/test-harness/test/golden/budgets.json`, `packages/test-harness/test/golden/twins.json`,
`packages/test-harness/test/golden/rasterpoll.asm.golden`, `packages/test-harness/test/asm/measure-irq-demo.asm`,
`examples/rasterpoll/main.blend`, `scripts/twin-diff.mjs`, `scripts/annotate-cycles.mjs`,
repo-root `test/twin-diff.spec.test.ts` + `test/annotate-cycles.spec.test.ts`.

Modified: `packages/test-harness/src/emulator/vice/vice-driver.ts` (race fix, launch args, FL
writes, checkpoint delete), `packages/test-harness/src/emulator/driver.ts` (LaunchOptions),
`packages/test-harness/src/run/strategies.ts` (export `withTimeout` — PF-014),
`packages/test-harness/src/fixture.ts` (second free port — PF-013),
`packages/core/src/platform/platform-plugin.ts` (optional `startupCost` — PF-012),
`packages/codegen` (per-function cost summaries), `packages/platforms` (startup cycles),
`packages/core/src/report/*` (F7 fields + renderers), `packages/compiler/src/api/build.ts`
(report threading), root `package.json` (aliases), `.github/workflows/ci.yml` (informational
twin-diff step).

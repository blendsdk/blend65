# RD-11b Diagnostics Remainder & Resource Reporter — Implementation Plan

> **Feature**: Complete the RD-11 diagnostics engine in `@blend65/core` — the `SourceMap` registry, the severity-policy layer, the terminal/JSON diagnostic renderers, and the `ResourceReport` aggregator with its terminal (Ch 11 §6 build summary) and JSON renderers
> **Status**: Planning Complete
> **Created**: 2026-07-03
> **Implements**: blend65-ri/RD-11 (the RD-11b slice — RD-11a shipped ✅, archived at `codeops/_archive/rd-11a-diagnostics-core/`)
> **CodeOps Skills Version**: 3.1.0

## Overview

RD-11a shipped the diagnostics *core*: the span model, `LineMap`, the structured
`Diagnostic` record, the accumulating `DiagnosticBag`, and the code registry.
RD-11b finishes the RD: the pieces every *consumer* of diagnostics needs —
resolving spans back to files (`SourceMap`), deciding final severities
(`applySeverityPolicy`/`createSeverityPolicy`), and turning structured records
into output (`renderTerminal` caret format, `renderJson`). It also delivers the
second RD-11 subsystem: the `ResourceReport` — the typed build-summary record
aggregating SFA/ACME/plugin resource data — with `buildResourceReport`,
`checkBinaryBudget` (E10034), the Ch 11 §6 terminal table, and the JSON report.

Everything lands in `@blend65/core` (zero runtime dependencies, hand-rolled ANSI
— no chalk in core, PF-007). RD-15 (the CLI/programmatic driver, next on the
roadmap) consumes all eight new exports; its preflight PF-001 explicitly
reordered RD-11b ahead of it for exactly these deliverables.

## Document Index

| #   | Document                                            | Description                                 |
| --- | --------------------------------------------------- | ------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)      | Zero-Ambiguity Gate decisions (16 items, all resolved) |
| 00  | [Index](00-index.md)                                | This document — overview and navigation     |
| 01  | [Requirements](01-requirements.md)                  | Requirements and scope (from RD-11)         |
| 02  | [Current State](02-current-state.md)                | Shipped RD-11a/05/09/16 surfaces this plan builds on |
| 03-01 | [SourceMap Registry](03-01-sourcemap.md)          | `SourceMap`/`createSourceMap` technical spec |
| 03-02 | [Severity Policy](03-02-severity-policy.md)       | `SeverityPolicy`/`applySeverityPolicy`/`createSeverityPolicy` |
| 03-03 | [Diagnostic Renderers](03-03-diagnostic-renderers.md) | `renderTerminal` (Ch 14 caret format) + `renderJson` |
| 03-04 | [Resource Report](03-04-resource-report.md)       | `ResourceReport`, `buildResourceReport`, `checkBinaryBudget`, report renderers |
| 07  | [Testing Strategy](07-testing-strategy.md)          | ST-1..ST-28 specification cases + verification |
| 99  | [Execution Plan](99-execution-plan.md)              | 4 phases, 12 sessions, 39-task checklist    |

## Quick Reference

### Usage Examples

```typescript
import {
  createDiagnosticBag, createSourceMap,
  createSeverityPolicy, applySeverityPolicy,
  renderTerminal, renderJson,
  buildResourceReport, checkBinaryBudget,
  renderReportTerminal, renderReportJson,
} from '@blend65/core';

// Diagnostics pipeline (RD-15 will wire this end-to-end)
const sourceMap = createSourceMap();
const id = sourceMap.intern('player.blend', source);
const bag = createDiagnosticBag({ maxErrors: config.maxErrors });
// ... compiler phases append to the bag ...
const policy = createSeverityPolicy({
  warnAsError: config.warnAsError,          // boolean | string[]
  suppressWarnings: config.suppressWarnings,
});
const finalDiags = applySeverityPolicy(bag.getAll(), policy);
const failed = finalDiags.some((d) => d.severity === 'error'); // never bag.hasErrors() (PF-005)
process.stderr.write(renderTerminal(finalDiags, sourceMap, { color: useColor }));

// Resource report (build summary)
const report = buildResourceReport({
  platformName: 'c64', targetName: 'game.prg',
  plan: allocationPlan,                      // embeds resourceData/zpAllocations/stackAnalysis
  binaryBudget: profile.maxBinarySize,
  binarySize,                                // post-ACME, from the emitted file
});
checkBinaryBudget(report, bag);              // E10034 when binarySize > binaryBudget
if (!config.quiet) process.stdout.write(renderReportTerminal(report));
```

### Key Decisions

| Decision | Outcome |
| -------- | ------- |
| Module layout | `diagnostics/` gains 4 files; new `packages/core/src/report/` module with barrel (AR-Q2) |
| Report assembly | Pure `buildResourceReport()` in core; no I/O/label parsing; RD-15 wires data (AR-Q3) |
| E10034 timing | `checkBinaryBudget(report, bag)` in core; RD-15 calls post-`emitBinary` (AR-Q4) |
| Type completion | `platformName`/`targetName`/ranges/`zpAllocations?`/`stackAnalysis?` added to `ResourceReport` (AR-Q5/Q6/Q15 → requirements AR-103) |
| SourceMap semantics | Path-keyed intern, `has()` probe, throwing getters (AR-Q7 → AR-104) |
| Presentation contract | Carets-only primary line, SGR color map, JSON schemas, §4.7-verbatim geometry, `($0000–$0000)` placeholders (AR-Q8..Q11/Q14/Q16 → AR-105) |
| AC-08/09/R16 | Closed by audit — shipped in RD-03/04/07a (AR-Q12) |

## Related Files

**Created:** `packages/core/src/diagnostics/source-map.ts`, `severity-policy.ts`,
`ansi.ts`, `render-terminal.ts`, `render-json.ts`;
`packages/core/src/report/resource-report.ts`, `build-resource-report.ts`,
`render-report-terminal.ts`, `render-report-json.ts`, `index.ts` — each with
co-located `*.spec.test.ts`/`*.impl.test.ts` (plus `render-terminal.security.spec.test.ts` for R52).

**Modified:** `packages/core/src/diagnostics/index.ts` (new exports),
`packages/core/src/index.ts` (report barrel), `packages/core/src/index.spec.test.ts`
(export surface), `requirements/RD-11-diagnostics-reporting.md` + requirements
register (AR-103/104/105 back-propagation — done at plan time), both roadmaps.

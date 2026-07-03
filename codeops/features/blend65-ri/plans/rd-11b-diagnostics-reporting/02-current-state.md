# Current State: RD-11b — Diagnostics Remainder & Resource Reporter

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Analyzed**: 2026-07-03 (all `file:line` cites verified against the working tree)

## Existing Implementation

### What Exists

**RD-11a (shipped, archived `codeops/_archive/rd-11a-diagnostics-core/`)** — the
diagnostics core this plan extends, all in `packages/core/src/diagnostics/`:

- `source-span.ts` — `SourceId = number`, `SourceSpan` (byte offsets), `LabeledSpan`, `makeSpan`. Line 16's doc comment explicitly defers the registry: *"assigned by the (deferred, RD-11b) SourceMap registry"*.
- `line-map.ts` — `LineMap` class: `getLineCol` (1-based line/byte-column), `getUtf16Column` (0-based, LSP), `getLineText` (terminator-stripped). Total (clamping, never throws). Exactly what R35 renderers need.
- `diagnostic.ts` — frozen `Diagnostic` record `{code, severity, message, primarySpan, secondarySpans, notes, help?}` + `DiagnosticOptions`. **No primary-label field** — drove AR-Q14 (carets only).
- `diagnostic-bag.ts` — `createDiagnosticBag`: dedup `(code, sourceId, start)`, max-errors cap (default 20, E10000 sentinel, ICEs exempt), deterministic `getAll()` sort. `hasErrors()` is **pre-policy** (PF-005) — consumers must use the policy-applied array.
- `diagnostic-codes.ts` — the single code registry. Already carries everything RD-11b emits or renders: `BinaryTooLarge: "E10034"` (line 40), budget warnings `W10030/W10033/W10180`, config band `E10240–46`/`W10240–41`.
- `index.ts` — barrel; RD-11b adds its exports here.

**RD-05 (shipped)** — the SFA data the report embeds, in `packages/core/src/sfa/allocation-plan.ts`:

- `SfaResourceData` (line 125) — frame/ZP/RAM/stack used-vs-budget totals. Embedded verbatim as `ResourceReport.sfa` (PF-002).
- `ZpAllocation` (line 49) — `{name, address, size, category}` with `category ∈ user|pointer|temp|irq-temp|arg-block` → the ZP breakdown source (AR-Q6). Note the layout has no `arg-block` line → folds into "Compiler temps".
- `StackAnalysis` (line 68) — `maxMainDepth`, `maxMainStackBytes`, `irqOverhead`, `totalWorstCase`, `platformBudget` → the stack-block source (AR-Q15).
- `AllocationPlan` (line 154) — frozen output carrying all three + `hasErrors`.
- Budget emission already lives in `packages/frontend/src/sfa/budgets.ts` (E10032/E10033, W10030/W10033/W10180) — R42's pre-ACME half and R49's emission are **done**; this plan adds only the post-ACME E10034 check.

**RD-09 (shipped)** — ACME artifacts in `packages/compiler/src/acme/`:

- `label-file.ts:37` — `parseLabelFile(content): Map<string, number>`. **No segment boundary labels are emitted** by `packages/codegen/src/instr/serialize-acme.ts` (verified — no `__code_start`/`__code_end`), so code/data sizes are *not derivable today* → AR-Q3 rejects label parsing in RD-11b; ACME-owned fields stay undefined → render zero (AR-102).
- `emit-binary.ts` — RD-15's future source for `binarySize` (output file byte length).

**RD-10 (shipped)** — `packages/core/src/platform/platform-profile.ts:78` `maxBinarySize`, `:84` `stackBudget` → `binaryBudget` and budget denominators.

**RD-16 (shipped)** — `packages/config/src/types.ts`: `BlendConfig.maxErrors`, `warnAsError: boolean | string[]`, `suppressWarnings: string[]` — exactly `createSeverityPolicy`'s input shape (RD §4.4, PF-005). `CONFIG_SOURCE_ID = -2` (line 18) is the concrete R51 unresolvable-`sourceId` case the renderer must degrade on.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/core/src/diagnostics/index.ts` | diagnostics barrel | add SourceMap/policy/renderer exports |
| `packages/core/src/index.ts` | root barrel | add `export * from "./report/index.js"` |
| `packages/core/src/index.spec.test.ts` | export-surface spec | extend for the 15 new exports (ST-28, plan preflight PF-002) |
| `packages/core/src/diagnostics/source-map.ts` | **new** — SourceMap registry | create (03-01) |
| `packages/core/src/diagnostics/severity-policy.ts` | **new** — policy layer | create (03-02) |
| `packages/core/src/diagnostics/ansi.ts` | **new** — internal SGR constants | create (03-03) |
| `packages/core/src/diagnostics/render-terminal.ts` | **new** — Ch 14 caret renderer | create (03-03) |
| `packages/core/src/diagnostics/render-json.ts` | **new** — JSON emitter | create (03-03) |
| `packages/core/src/report/*.ts` | **new** — report module (type, builder, renderers, barrel) | create (03-04) |

### Code Analysis

The RD-11a surfaces compose cleanly: `renderTerminal` needs only
`SourceMap.has/getPath/getLineMap` + `LineMap.getLineCol/getLineText`;
`applySeverityPolicy` is a pure map/filter over `Diagnostic[]`;
`buildResourceReport` is a pure restructuring of `AllocationPlan` + numbers.
No existing file needs behavioral change — every task is additive.

## Gaps Identified

### Gap 1: No SourceMap registry
**Current:** `SourceId` is produced ad hoc (lexer tests use literal ids; RD-16 uses the `-2` sentinel). No id→path/content resolution exists.
**Required:** `createSourceMap()` per §4.2 + AR-104 (`has()`, path-keyed intern, cached `LineMap`).
**Fix:** 03-01.

### Gap 2: No severity policy
**Current:** `bag.getAll()` returns natural severities; nothing implements promote/suppress; RD-16 validates the *flags* but nothing applies them.
**Required:** §4.4 `createSeverityPolicy` + `applySeverityPolicy` with R50 precedence.
**Fix:** 03-02.

### Gap 3: No renderers
**Current:** Zero rendering code in the workspace (AC-14 audit expected to pass — nothing prints).
**Required:** §4.5 terminal caret + JSON, with the AR-105 presentation contract.
**Fix:** 03-03.

### Gap 4: No resource-report subsystem
**Current:** All data sources shipped, nothing aggregates or renders them; `PeepholeStats` exists only as RD-08 §4.8 prose (grep verified: no TypeScript definition anywhere).
**Required:** §4.6/§4.7 as amended by AR-103 (type + builder + `checkBinaryBudget` + two renderers).
**Fix:** 03-04.

## Dependencies

### Internal
- `@blend65/core` internal only: `diagnostics/` (existing), `sfa/allocation-plan.js` types, `platform` profile types are **not** imported (budget values arrive as plain numbers — keeps `report/` decoupled).
- No new cross-package edges; R15 boundary (`test/boundary.spec.test.ts`) unaffected.

### External
- None. Core stays zero-dependency (PF-007 — hand-rolled ANSI; AR-Q11 — hand-rolled grouping).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Golden-test brittleness (byte-exact renderer output) | Med | Low | Geometry transcribed once from §4.7/Ch 14 §1 into ST fixtures; AR-105 pins every open detail so goldens are decided, not discovered |
| §4.7 example's internal alignment inconsistencies (e.g. startup line column) | Med | Low | AR-Q11: template transcribed verbatim; goldens lock the transcription — no per-line re-derivation |
| Caret alignment vs. R52 stripping | Med | Med | Columns computed against the *sanitized* line (03-03 §Sanitization); ST-17/ST-18 cover tab + injection cases together |
| RD-15 needs a report input this plan didn't foresee | Low | Med | AR-103 completed the shape against the *frozen layout* (every §4.7 line now has an owner field); anything left is values-only per AR-102 |
| `arg-block` fold distorts "Compiler temps" | Low | Low | Deliberate, documented (AR-Q6); ZP Total uses `zpUsed` independently — no double counting |

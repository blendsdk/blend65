# Budget Tier: budgets.json, size gate, rasterpoll fixture

> **Document**: 03-03-budget-tier.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 F3/F4 (AC-3, AC-4) · req-AR #3, #4, #5, #12 (+ addendum) · preflight PF-001/PF-003 · plan-AR #3, #4, #10

## Overview

A ratcheting cost gate: assembled byte budgets and named cycle windows per program, asserted
from one data file. Static assertions (bytes via ACME, straight-line cycles via the timing
table) run in CI; measured assertions run in the local `skipIf(!hasVice())` tier (req-AR #5).

## Architecture

### Proposed files

- `packages/test-harness/test/golden/budgets.json` — the single budget file (req-AR #3), schema
  per plan-AR #3:

```json
{
  "programs": {
    "slice8b": {
      "bytes": 0,
      "windows": [
        { "name": "copyLoop", "kind": "span", "fromLabel": "Main_copyBytes_L0", "toLabel": "Main_copyBytes_L3", "staticMaxCycles": 0, "measuredMaxCycles": 0 }
      ]
    },
    "rasterpoll": {
      "bytes": 0,
      "windows": [
        { "name": "pollIter", "kind": "perIteration", "fromLabel": "…", "toLabel": "…", "staticCyclesPerIteration": 0 }
      ]
    },
    "balloon": {
      "bytes": 0,
      "windows": [
        { "name": "frameUpdate", "kind": "span", "fromLabel": "…", "toLabel": "…", "staticMaxCycles": 0, "measuredMaxCycles": 0 }
      ]
    }
  }
}
```

  (Zeros above are placeholders — real values are seeded by the ratchet task from the verified
  current build, per req-AR #12. Exact labels for rasterpoll/balloon come from their emitted
  asm at seeding time.)

- `budget-loader.ts` (test-harness internal): parse + validate — unknown keys, wrong types,
  missing `bytes`, or a `kind` mismatch with its fields fail loudly naming the path (RD
  §Technical Requirements; ST-14).
- `packages/test-harness/src/budgets.spec.test.ts` — the tier (req-AR #13):
  - **bytes**: assemble each budgeted program (fixture `testing/<f>.ts` build paths; balloon via
    `testing/balloon.ts` — mkdtemp + `build()` facade, slice8b pattern, generated output never
    committed per RD §pair-manifest); assert size ≤ budget; failure names program, actual,
    budget (AC-3). Runs in CI (ACME present). Every such build already emits the ACME report
    and VICE label files (`--report`/`--vicelabels`, `invoke-acme.ts`) — the window
    acquisition below reuses them, no second assembly.
  - **static windows**: slice the build's ACME **report** between the window's label addresses
    (labels from the `.lbl`/`symbolMap` side) via the shared report parser
    (`compiler/src/acme/report-file.ts`, 03-04 §Shared acquisition — PF-010); each sliced
    instruction is a classified `(opcode, mode)` pair with its final address, so
    zeropage-vs-absolute and page crossings are **exact**; sum min–max via `getTiming` (span
    kind — residual spread is branch variance only) or per-iteration over the poll body
    (perIteration kind, PF-003); assert max ≤ `staticMaxCycles`/`staticCyclesPerIteration`. CI.
  - **measured windows**: run to the from-label, then **quiesce** (03-02: I-flag mask; plus
    display blank + settle for windows inside the active display area — slice8b `copyLoop`
    yes, balloon `frameUpdate` no, it runs at raster ≥251), then `measureCycles` per 03-02
    under `skipIf(!hasVice())`; assert ≤ `measuredMaxCycles`. Local only. Quiesce is what makes
    these windows cross-process deterministic — the measured programs carry no interrupt
    discipline of their own, so un-quiesced they are NOT phase-locked under plan-AR #10's
    definition (preflight PF-009); budget numbers are documented as *quiesced machine cycles*.
- The **size-regression gate (F4)** is exactly the bytes assertion running in CI — no separate
  mechanism (RD F4; req-AR #4 hard-fail).

### Rasterpoll fixture (PF-001, plan-AR #4)

- `examples/rasterpoll/main.blend`: poll `$D012` for a target line, then a small frame-update
  body (a few pokes/increments), loop forever — the balloon idiom, minimal.
- `testing/rasterpoll.ts` (embeds the source verbatim, slice pattern) +
  `golden-rasterpoll.spec.test.ts` + committed `rasterpoll.asm.golden`.
- Its hand-written twin is RD-02's deliverable (RD Won't Have).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Malformed / unknown-key budgets.json | Loader throws naming file + JSON path, before any assertion | plan-AR #3 |
| Budgeted program missing from corpus (or vice versa) | Tier fails naming the orphan | RD AC-3 |
| Window label absent from symbols/asm | Failure names program + window + label | plan-AR #3 |
| Cost over budget | Assertion failure: program, window, actual, budget | RD AC-3/AC-4, req-AR #4 |

## Testing Requirements
- Spec: ST-12…ST-19 (07 §Budget Tier) — including the ratchet-bites check (lowering a budget
  below current cost fails, AC-4).
- Impl: loader internals, min–max span math (branch/page-cross variance), perIteration
  extraction.

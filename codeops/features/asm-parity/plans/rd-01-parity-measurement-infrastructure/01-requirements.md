# Requirements: RD-01 Parity Measurement Infrastructure

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-01](../../requirements/RD-01-parity-measurement-infrastructure.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan

- RD-01 **F1** — timing table in `@blend65/core` `timing/` (03-01)
- RD-01 **F2** — `measureCycles` via the stopwatch mechanism resolved by plan-AR #1 (03-02)
- RD-01 **F3/F4** — budget tier + size-regression gate, incl. the new rasterpoll fixture (03-03)
- RD-01 **F5/F6/F9** — twin-diff, annotator, convenience assemble (03-04)
- RD-01 **F7/F8** — per-function report estimates + `startupCycles` (03-05)
- **Plan-local addition (plan-AR #8):** fix the `advanceInstructions` async-completion race in
  `ViceDriver` (user decision — the spike proved `runFrames`/`runUntilMemory` silently under-run).
  This does NOT touch the RD's Won't Have on replacing `INSTRUCTIONS_PER_FRAME` — the heuristic
  stays; it just executes correctly.

### Deferred / out of this plan

- Everything in RD-01's Won't Have list (twins authoring, scoreboard doc, loop-aware totals,
  `peepholeStats`, cycle-exact frame stepping, illegal opcodes, 65C02 timings, intrinsic
  `costMetadata` cross-validation) — owned by the RD; unchanged here.

## Plan-local decisions

Only decisions NOT already in the RD (the RD owns req-AR #2…#14 and the preflight decisions):

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| VICE cycle-measurement mechanism (resolves req-AR #1 deferral) | Text-monitor stopwatch, absolute reads, with mandatory mitigations | plan-AR #1 |
| Measured-metric semantics | Elapsed machine cycles (VIC-II DMA stalls + IRQ handlers included) | plan-AR #2 |
| `budgets.json` schema | Nested per-program shape, window `kind: "span" \| "perIteration"` | plan-AR #3 |
| Rasterpoll fixture program | Poll `$D012` + small frame-update body, loop forever | plan-AR #4 |
| Scripts' table access | Import the built `@blend65/core` | plan-AR #5 |
| F7/F8 cost computation owner | Producers compute via core `timing/` | plan-AR #6 |
| New file/API names | Batch per plan-AR #7 and #11 | plan-AR #7, #11 |
| `advanceInstructions` race | Fix in this RD | plan-AR #8 |
| Verify command | Per project CLAUDE.md, confirmed | plan-AR #9 |
| Determinism contract | Phase-locked windows guarantee cross-run determinism | plan-AR #10 |
| Measured budget windows | Harness-quiesced (I-flag mask; display blank + settle for display-area windows) — the measured programs carry no interrupt discipline of their own | preflight PF-009 |
| Cost-stream acquisition | One shared ACME report parser (`compiler/src/acme/report-file.ts`) for the budget tier, twin-diff, and the annotator | preflight PF-010 |

## Acceptance Criteria

The RD owns AC-1…AC-10. Plan-local criteria only:

1. [ ] `advanceInstructions(n)` completes only when VICE's `STOPPED` event arrives; a regression
   test proves a large-count advance actually executes n instructions (plan-AR #8).
2. [ ] measureCycles documentation states the machine-cycle metric (plan-AR #2) and the
   phase-locking determinism contract (plan-AR #10) explicitly, including the harness-quiesce
   clause for programs without their own interrupt discipline (preflight PF-009).
3. [ ] The budget tier's measured windows are taken under harness quiesce and are identical
   across fresh emulator processes; budget numbers are documented as quiesced machine cycles
   (preflight PF-009).

# Ambiguity Register: RD-01 Parity Measurement Infrastructure (plan)

> **Status**: ✅ GATE PASSED — all 11 items resolved
> **Last Updated**: 2026-07-18 00:57
> **Scope**: Implementation plan for asm-parity/RD-01 (`../../requirements/RD-01-parity-measurement-infrastructure.md`)
> **CodeOps Skills Version**: 3.9.0
>
> Requirement-level decisions live in the feature register
> (`../../requirements/00-ambiguity-register.md`) and are cited as **req-AR #N**; they import as
> pre-resolved context and are NOT re-confirmed here. Plan-AR #1 below resolves the one named
> deferral (req-AR #1) with the live-spike evidence it prescribed.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Technical | **VICE cycle-measurement mechanism** (resolves req-AR #1 deferral; spike run live against VICE 3.10.0) — the binary monitor exposes NO cumulative cycle counter (live `REGISTERS_AVAILABLE` = PC A X Y SP 00 01 FL LIN CYC only; issue #64's claim refuted); the text-monitor **stopwatch** coexists with the binary monitor and measured a known CIA-IRQ window cycle-exactly (16424/16421 vs the PAL KERNAL timer period 16421) | (a′) Stopwatch via coexisting text remote monitor, **absolute reads** (`stopwatch` with no reset returns the absolute count since power-on; read at both stops, subtract) — reentrant, exact, model-independent. (b) Chunked `ADVANCE_INSTRUCTIONS` + LIN/CYC raster arithmetic with wrap counting — per-model constants, wrap bookkeeping, race fix first, same timeline (no determinism gain). Named rejected: single-step + timing table (table cycles ≠ machine cycles; circular vs the table it validates); snapshot-DUMP `maincpu_clk` parsing (heavyweight, VSF layout version-dependent — kept named as the absolute-clock fallback if a future VICE breaks the text stopwatch) | ✅ Resolved — User chose (a′): stopwatch via coexisting text remote monitor, absolute reads, with the challenger's mandatory mitigations | ✅ Resolved |
| 2 | Behavioral | **Measured-metric semantics refinement** (new spike information refining req-AR #2's wording): the stopwatch counts elapsed **machine cycles** — including VIC-II DMA stalls (badlines/sprites) and IRQ-handler cycles; measured ≥ static estimate on badline-crossing windows | Machine cycles, documented side-by-side with the table-based static (CPU-execution) metric / CPU-execution-only cycles (would force the rejected single-step mechanism) | ✅ Resolved — User chose machine cycles (DMA + IRQ included), the two metrics documented as distinct | ✅ Resolved |
| 3 | Data | **`budgets.json` concrete schema** (req-AR #3 chose the single file; RD leaves the shape to the plan) | Proposed nested shape with a `kind: "span" \| "perIteration"` window discriminator / flat per-program arrays split by budget type | ✅ Resolved — User accepted the proposed schema: `{ "programs": { "<name>": { "bytes": N, "windows": [ { "name", "fromLabel", "toLabel", "kind", "staticMaxCycles"?, "measuredMaxCycles"?, "staticCyclesPerIteration"? } ] } } }`; loader rejects unknown keys, wrong types, and missing budgets loudly | ✅ Resolved |
| 4 | Feature | **Raster-poll golden fixture program shape** (preflight PF-001 mandates the fixture; content undefined) | Poll `$D012` + small frame-update body, loop forever (balloon idiom; yields both window kinds) / poll-only loop | ✅ Resolved — User chose poll + update body | ✅ Resolved |
| 5 | Technical | **Scripts' timing-table access** (RD: "the scripts import the built package or a generated JSON mirror — plan decides the wiring") | Import the built `@blend65/core` by package name (workspace hoisting; scripts already need the built compiler) / generated JSON mirror | ✅ Resolved — User chose importing the built `@blend65/core`; scripts fail with a clear "run yarn build first" message when dist is missing | ✅ Resolved |
| 6 | Technical | **F7/F8 per-function cost data flow** (R15-safe owner): who computes per-function `{bytes, minCycles, maxCycles}` | Producers compute via core `timing/` (codegen summarizes `InstrProgram.streams`; the platform plugin costs its startup shim; compiler threads plain records into `BuildResourceReportInputs`) / compiler extracts raw (opcode, mode) lists and core computes | ✅ Resolved — User chose producers-compute | ✅ Resolved |
| 7 | Naming | **Naming/location batch** (all follow existing conventions) | `packages/test-harness/src/run/measure.ts`; `emulator/vice/text-monitor.ts`; `LaunchOptions.remoteMonitorPort`; fixture `rasterpoll` (`examples/rasterpoll/main.blend` + `testing/rasterpoll.ts` + `golden-rasterpoll.spec.test.ts` + `rasterpoll.asm.golden`); balloon build helper `testing/balloon.ts` (mkdtemp + `build()` facade, the slice8b pattern); pair manifest `packages/test-harness/test/golden/twins.json`; script spec tests at repo-root `test/twin-diff.spec.test.ts` + `test/annotate-cycles.spec.test.ts`; core module `packages/core/src/timing/` (req-AR #6/#13) | ✅ Resolved — User accepted the batch as listed | ✅ Resolved |
| 8 | Scope | **Latent `advanceInstructions` race** (spike discovery, challenger-confirmed live): VICE answers `ADVANCE_INSTRUCTIONS` immediately and steps asynchronously; any follow-up command aborts the stepping — `runFrames`/`runUntilMemory` issue back-to-back advances and silently under-run | File a GitHub issue, out of RD-01 scope / fix the driver in this RD | ✅ Resolved — **User chose to fix the driver in this RD** (await the STOPPED event as completion, `vice-driver.ts:211`, + regression coverage; recommendation was issue-only — user decided otherwise) | ✅ Resolved |
| 9 | Process | **Verify command** (make_plan step 4b confirmation) | Detected from project CLAUDE.md: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` | ✅ Resolved — User confirmed; phases touching measured cycles additionally run the local `skipIf(!hasVice())` tier | ✅ Resolved |
| 10 | Behavioral | **measureCycles determinism contract + fixture phase-locking** (challenger finding F1, live-verified): VICE autostart lands at a different absolute machine cycle each process (~5–6 frames spread) → unlocked IRQ/badline-inclusive windows vary a few hundred cycles across processes while staying exact within a run; a phase-locked window (SEI + screen-blank + settle, or own-raster-IRQ-setup idiom) measured identical across three fresh processes AND equal to the hand-computed cycle sum | Phase-locking contract (determinism guaranteed for phase-locked windows; budget windows + the AC-1 IRQ demo use phase-locked idioms; unlocked windows documented exact-per-run) / hard-restrict to phase-locked only | ✅ Resolved — User chose the phase-locking contract | ✅ Resolved |
| 11 | Naming | **Final naming addendum** (surfaced while closing the gate) | (1) IRQ demo fixture `packages/test-harness/test/asm/measure-irq-demo.asm` (new `test/asm/` dir; assembled at test time via ACME into mkdtemp; local tier; own-raster-IRQ phase-locked idiom per plan-AR #10). (2) Timing API `getTiming(opcode, mode)` → `InstrTiming` record. (3) `remoteMonitorPort ?? monitorPort + 1` (default 6503). (4) CI step name "twin-diff (informational)" appended after tests | ✅ Resolved — User accepted all four | ✅ Resolved |

### Resolution Notes

**Plan-AR #1:** Spike artifacts live in the session scratchpad (`probe-binmon.mjs`,
`probe-mechanisms.mjs`, `probe-stopwatch-e2e.mjs`, plus the challenger's `probe-challenge.mjs`,
`probe-determinism.mjs`, `probe-det2.mjs`, `probe-det3.mjs`); key numbers: text stopwatch ==
raster arithmetic over the same window (3567 == 3567); consecutive KERNAL CIA-IRQ windows
measured 16424/16421 (PAL CIA#1 Timer A period = 16421, ±3 = instruction-boundary IRQ-entry
jitter); checkpoint aborted a 30000-instruction advance at the first hit. An independent
challenger ran per recommendation-hardening (high-stakes decision); it CONFIRMED mechanism (a),
refined it to absolute reads (a′), adversarially re-verified coexistence (zero binary-socket
frames during stopped-state text I/O; no stale STOPPED events), and contributed plan-AR #10 plus
the mitigations below. Confidence: high (every load-bearing claim live-verified). Hardening:
independent challenger + live counter-probes; reconciled before presenting.

**Plan-AR #1 mitigations (bound to option a′ — carried into 03-02):** strict parser
(drain-before-send; read-to-prompt `(C:$xxxx)`; anchored `^Stopwatch:` regex on the post-send
segment only — the checkpoint break banner ends in a raw unlabeled stopwatch value; loud failure
with raw bytes on mismatch); text I/O only while the machine is stopped, serialized against
driver operations (a text command while running halts the machine and emits a spurious
registers-event + STOPPED on the binary socket); both ports via `LaunchOptions`, loud failure if
the text connect fails; version-gate via `VICE_INFO` (0x85) at connect; pin the machine model
explicitly; fresh process per binary (existing driver lifecycle — monitor RESET is NOT a
deterministic re-anchor, live-verified); assert PC equals the from-label address at the
from-stop.

**Plan-AR #2:** Cross-validated live: the measured window matched the CIA timer period, which
counts φ2 clocks regardless of VIC-II BA stalls — proving the stopwatch counts machine cycles,
not CPU-execution cycles. Static estimates (timing table) count execution cycles only; the two
metrics are documented side by side in the budget tier.

**Plan-AR #8:** Evidence: a 30000-instruction advance followed immediately by `REGISTERS_GET`
moved the raster by 1 cycle (the get aborted the stepping); awaiting the `STOPPED` event first,
the same advance ran to the checkpoint. Existing `runUntilLabel` (resume/checkpoint path) is
correct. The in-RD fix also verifies `executeUntilReturn` for the same async-completion defect
class and covers it if affected — same root cause, same one-line pattern.

**Plan-AR #10:** The challenger's phase-locked control measured W=328,713 in three fresh
processes, exactly equal to the hand-computed instruction-cycle sum. The AC-1 IRQ demo fixture
uses the own-raster-IRQ idiom so the spec test exercises IRQ-inclusive counting AND cross-run
determinism at once. RD acceptance criteria are unaffected (AC-1's "two consecutive runs" holds
for the phase-locked demo fixture; the balloon frame-update body window is phase-stable per
preflight PF-003).

**Plan-AR #10 (addendum — preflight PF-009):** the contract stands unchanged; its *application*
to the budget windows is corrected. Neither measured budget window satisfies the phase-locked
definition as-is (no interrupt discipline in either program; the KERNAL CIA-1 IRQ is live, and
its 16421-cycle period drifts 3235 cycles/frame against the PAL raster, so IRQ-in-window varies
across process launches; slice8b's window also sits in badline territory). PF-003's
"phase-stable" reasoning covered raster phase only, not CIA phase. Resolution: the budget tier
**quiesces externally** before measuring (I-flag mask via extended `writeRegisters`; display
blank + settle for display-area windows) — the same idiom the phase-locked control verified,
applied by the harness. Budget numbers are documented as quiesced machine cycles; the IRQ demo
fixture stays un-quiesced as the IRQ-inclusive proof (03-02/03-03).

**Plan-AR #7/#11 (addendum — preflight PF-010):** one name added to the batch: the shared ACME
report parser + (opcode, mode) classifier at `packages/compiler/src/acme/report-file.ts`
(sibling of `label-file.ts`), consumed by the budget tier's static windows, twin-diff, and the
annotator. Chosen over a raw-asm text classifier because zeropage-vs-absolute is undecidable
from symbolic operand text; every real build already emits `--report`/`--vicelabels`
(`invoke-acme.ts`), so acquisition reuses existing artifacts — extending req-AR #8's rationale
to all three cost consumers.

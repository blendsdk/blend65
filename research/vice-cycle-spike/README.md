# VICE cycle-measurement spike — probes and measured ground truth

Live protocol probes against VICE 3.10 (`x64sc`, PAL) that pinned the
cycle-measurement mechanism the test harness now ships (`measureCycles` +
`TextMonitorClient` in `@blend65/test-harness`). Preserved verbatim from the
design spike; the production code and its spec/impl tests are the living
successors, but these scripts document how each load-bearing claim was
established. Run any of them with `node <probe>.mjs` (needs `x64sc` on PATH).

## What each probe established

| Probe | Finding |
| ----- | ------- |
| `probe-binmon.mjs` | The binary monitor exposes NO cumulative cycle counter: live `REGISTERS_AVAILABLE` returns PC A X Y SP 00 01 FL LIN CYC only (LIN/CYC are per-frame raster coordinates, not a free-running clock). |
| `probe-mechanisms.mjs` | Candidate-mechanism comparison; the text remote monitor's `stopwatch` coexists with the binary monitor and reads the machine-cycle clock. Text stopwatch == LIN/CYC raster arithmetic over the same window (3567 == 3567). |
| `probe-stopwatch-e2e.mjs` | End-to-end stopwatch measurement over checkpoint stops: consecutive KERNAL CIA-IRQ windows measured 16424/16421 vs the PAL CIA#1 Timer A period of exactly 16421 (±3 = instruction-boundary IRQ-entry jitter) — the counter counts machine cycles, φ2-exact. |
| `probe-challenge.mjs` | Adversarial re-verification of binary/text coexistence: zero binary-socket frames during stopped-state text I/O; no stale STOPPED events; a text command while RUNNING halts the machine (hence the stopped-state-only rule). |
| `probe-determinism.mjs`, `probe-det2.mjs`, `probe-det3.mjs` | Cross-process determinism: VICE autostart lands at a different absolute machine cycle each process (~5–6 frames spread), so unlocked IRQ/badline windows vary across processes while staying exact within a run. A phase-locked window (interrupts masked + display settled) measured identical across three fresh processes AND equal to the hand-computed instruction sum (W = 328,713). Monitor RESET is NOT a deterministic re-anchor. |
| `probe-warpspeed.mjs` | Warp mode decouples host time only — cycle counts are unaffected. |

## Measured ground truth (PAL C64, VICE 3.10)

- PAL frame: 19,656 cycles (312 lines × 63 cycles).
- KERNAL CIA#1 Timer A period: 16,421 cycles → the timer IRQ drifts 3,235
  cycles per frame against the raster, which is why un-quiesced windows are
  phase-dependent across launches.
- A checkpoint aborts an in-flight `ADVANCE_INSTRUCTIONS` at its first hit;
  VICE also answers the advance's response frame immediately and steps
  asynchronously — completion is the STOPPED event (the driver fix).
- Stopwatch replies may land on the same line as a pending prompt
  (`(C:$xxxx) Stopwatch:   N`), and every machine stop emits an asynchronous
  break banner whose register line ends in a raw unlabeled cycle count —
  the parser accepts only the labeled, anchored form.
- The VIC latches badline-enable when DEN is set at raster line $30: a
  mid-frame display blank does NOT suppress the current frame's badlines
  (measured on the slice8b copy window as a 568 + k×43, k ∈ 0..2 cycle
  distribution). One-shot windows inside the boot frame therefore cannot be
  externally quiesced to cross-process determinism; recurring windows and
  own-raster-IRQ programs can.
- The production proof fixture (`packages/test-harness/test/asm/measure-irq-demo.asm`)
  measures 51,534 cycles — 51,441 straight-line + 3 × 31 raster-IRQ cycles —
  identically across fresh emulator processes.

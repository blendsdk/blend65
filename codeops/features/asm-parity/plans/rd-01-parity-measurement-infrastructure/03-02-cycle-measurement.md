# Cycle Measurement: text-monitor client, measureCycles, driver fix

> **Document**: 03-02-cycle-measurement.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 F2 (AC-1) · req-AR #2, #13 (+ addenda) · plan-AR #1, #2, #8, #10, #11

## Overview

`measureCycles(driver, symbols, fromLabel, toLabel, timeout?)` returns the exact elapsed
**machine cycles** (plan-AR #2) between arrival at two labels, measured via VICE's text-monitor
stopwatch read at both checkpoint stops — absolute reads, subtracted (plan-AR #1). Ships with
the `advanceInstructions` completion fix (plan-AR #8).

## Architecture

### Current
`ViceDriver` speaks only the binary monitor (02 §What Exists). `runUntilLabel` resolves labels
through the `symbols` map and rides the checkpoint/STOPPED path (correct today).

### Proposed

1. **`emulator/vice/text-monitor.ts`** — `TextMonitorClient`: a persistent loopback socket to
   the remote text monitor. API: `connect(port)`, `readStopwatch(): Promise<number>`, `close()`.
   Protocol invariants (plan-AR #1 mitigations — each is load-bearing, all live-verified):
   - drain the receive buffer before every send;
   - read until the prompt regex `/\(C:\$[0-9a-f]{4}\) $/`;
   - extract with `/^Stopwatch:\s+(\d+)$/m` from the post-send segment ONLY (the checkpoint
     break banner ends in a raw unlabeled stopwatch number — a trailing-digits parser reads the
     wrong value);
   - any mismatch → error carrying the raw reply bytes;
   - text I/O permitted only while the machine is stopped (a text command while running halts
     the machine and emits a spurious registers-event + STOPPED on the binary socket).
2. **`ViceDriver` changes** (`vice-driver.ts`):
   - `buildArgs` adds `-remotemonitor -remotemonitoraddress 127.0.0.1:<remoteMonitorPort>`;
     `LaunchOptions.remoteMonitorPort` defaults to `monitorPort + 1` (plan-AR #11) **for direct
     driver construction only** — `setupEmulator` acquires a **second free ephemeral port** and
     passes it explicitly, since its `monitorPort` comes from `freePort()` and the +1 neighbor
     is unchecked (`fixture.ts:69-79,133`; PF-013). Text connect failure is a launch failure
     (loud, never degraded);
   - version gate: send `VICE_INFO` (0x85) at connect; unexpected major/minor → clear error;
   - **race fix** (plan-AR #8): `advanceInstructions` (:211) resolves on the `STOPPED` event
     that ends the stepping, not on the response frame; handle either arrival order;
     `executeUntilReturn` audited for the same defect class and fixed if affected;
   - `writeRegisters` (:221) extended to accept `FL` (the status register is present in
     `REGISTERS_AVAILABLE`) — the primitive the quiesce helper uses to set the I flag (PF-009);
   - a driver-specific **checkpoint delete** (`CHECKPOINT_DELETE` 0x13 — already in the codec,
     `protocol.ts:31`), `writeRegisters`-style extension; checkpoint ids captured from the
     `CHECKPOINT_SET` responses (PF-017).
3. **`run/measure.ts`** — `measureCycles(driver, symbols, fromLabel, toLabel, timeout?)`:
   - resolve both labels through `symbols` exactly as `runUntilLabel` (req-AR #13 addendum);
   - set both checkpoints up-front; run to `fromLabel`; assert `PC === symbols[fromLabel]`;
     read absolute stopwatch; resume to `toLabel`; assert PC; read again; return the difference;
   - **delete its two checkpoints on exit** (success and failure paths), so a second
     measurement or run strategy in the same launch never stops at a stale checkpoint (PF-017);
   - `withTimeout`-guarded end to end (RD F2) — `withTimeout` is **exported from
     `strategies.ts`** (currently module-private, `strategies.ts:40`; that file's "only entry
     points" doc comment is updated with it; PF-014); `from === to` measures one full traversal
     (arrival → next arrival), per req-AR #2's label-placement semantics.
4. **`run/measure.ts` — quiesce helper (PF-009)**: `quiesce(driver, { blankDisplay?: boolean })`,
   applied by the budget tier at the from-label stop before a measured budget window:
   - masks maskable IRQs by setting the CPU **I flag** via the extended `writeRegisters` — the
     KERNAL CIA-1 timer IRQ can no longer land inside the window (the measured programs carry
     no interrupt discipline of their own and never execute `CLI`/`PLP`);
   - with `blankDisplay` (windows inside the active display area, e.g. slice8b's copy loop):
     clears the `$D011` DEN bit via `writeMemory` and settles ≥1 frame, eliminating badline
     DMA stalls; windows outside the display window (balloon's frame-update body, raster ≥251)
     need only the I-flag mask;
   - fallback mechanism if live verification shows a register-write quirk: write `$DC0D = $7F`
     through a side-effects-enabled `MEMORY_SET` variant (`memorySetBody` currently hardcodes
     the side-effects byte to 0, `protocol.ts:147`) — same contract, red/green phase decides.

### Metric & determinism contract (doc-comment on `measureCycles`, plain language)
- Counts elapsed machine cycles: VIC-II DMA stalls and IRQ-handler cycles included (plan-AR #2).
- Identical binaries give identical counts within a run and, for **phase-locked** windows
  (interrupts disabled + display state settled, or the program installs its own raster IRQ),
  across fresh emulator processes; unlocked IRQ/badline-inclusive windows are exact per run but
  phase-dependent across processes (plan-AR #10). The comment states this without citing plan
  documents (standards: code stands alone).
- Programs without their own interrupt discipline are phase-locked **externally** via the
  `quiesce` helper — this is how the budget tier's measured windows achieve cross-process
  determinism (their numbers are *quiesced machine cycles*; PF-009). The IRQ demo fixture
  stays un-quiesced: it proves IRQ-inclusive counting through its own-raster-IRQ idiom.

## IRQ demo fixture (AC-1)

`packages/test-harness/test/asm/measure-irq-demo.asm` (plan-AR #11): hand-written ACME source,
own-raster-IRQ idiom — SEI; configure VIC raster IRQ; settle one frame; labeled window
`demo_from`/`demo_to` spanning ≥1 raster IRQ. Assembled at test time via ACME (mkdtemp),
autostarted, measured under `skipIf(!hasVice() || !hasAcme())`. Phase-locked → deterministic
across fresh processes AND IRQ-inclusive (plan-AR #10) — satisfying both halves of AC-1 in one
spec test.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Text socket fails to connect | Launch error (measurement unavailable is never silent) | plan-AR #1 |
| Stopwatch reply unparseable | Error with raw bytes | plan-AR #1 |
| PC ≠ label address at a stop | Error naming label, expected, actual PC | plan-AR #1 |
| `toLabel` never reached | `withTimeout` rejection (existing convention) | RD F2 |
| Unexpected VICE version | Clear error at connect | plan-AR #1 |

## Testing Requirements
- Spec: ST-6…ST-11 (07 §Cycle Measurement).
- Impl: parser edge cases (split TCP frames, banner interleaving), stop-state invariant,
  either-order STOPPED/response handling in the race fix, checkpoint cleanup on both exit
  paths (PF-017), quiesce state writes (I flag set; DEN cleared only when requested).

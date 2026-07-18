# Shared Observables & Fixture Suites: RD-02

> **Document**: 03-01-observables-and-fixture-suites.md
> **Parent**: [Index](00-index.md)

## Overview

The single-source-two-consumers requirement (RD F2) lands here: a data-first observables module,
per-fixture `OBSERVABLES` tables in the `testing/<fixture>.ts` helpers, a stopped-machine
Nth-arrival run strategy, the two newly authored observable sets (rasterpoll, balloon) with their
fixture-side VICE cases, and the inlined-source sync test. Everything in this document is
consumed again by the twin tier (03-02) — that is the point.

## Architecture

### Current

Each of the 12 existing VICE suites (gate + 11 slices) hardcodes its landmarks/checks inline
(e.g. `gate.spec.test.ts:45-48`, `slice3a.spec.test.ts:63-64`); rasterpoll and balloon have no
observable suite at all.
`runUntilLabel` stops the machine but leaks its checkpoint and only reaches the FIRST arrival
(`strategies.ts:81-89`); `runUntilMemory` polls a running machine (`strategies.ts:116-131`).

### Proposed

One new module + one new strategy; 14 helpers gain data tables (12 lifted from their suites,
rasterpoll + balloon newly authored); 12 suites shrink to table-consumers; 2 new suites appear.

## Implementation Details

### New module: `packages/test-harness/src/testing/observables.ts` (plan-AR #2, #3)

```typescript
/** A wait target that must be reached before the checks run. Ordered. */
export type Landmark =
  /** Poll a RUNNING machine until [address] holds [value] (stable-state programs). */
  | { readonly kind: "memory"; readonly address: number; readonly value: number }
  /**
   * Stop the machine at the [arrivals]-th arrival at the consumer-supplied
   * loop-head label (frame-looping programs; deterministic checks at a stopped CPU).
   */
  | { readonly kind: "loopHead"; readonly arrivals: number };

/** One shared memory-observable check. Source-mandated addresses ONLY (plan-AR #3). */
export type Check =
  | { readonly address: number; readonly value: number; readonly note?: string }
  /** A block compared against the bytes of a committed asset file (balloon sprite data). */
  | { readonly address: number; readonly bytesFile: string; readonly note?: string };

/** A fixture's complete shared observable set — the twin-equivalence contract. */
export interface ProgramObservables {
  readonly landmarks: readonly Landmark[];
  readonly checks: readonly Check[];
}

/** Consumer-side inputs a loopHead landmark needs. */
export interface ObservableRunOptions {
  readonly symbols?: Map<string, number>;
  /** The consumer's own frame-loop-head label (generated label vs twin label). */
  readonly loopHeadLabel?: string;
  readonly timeout?: number;
}

export async function assertObservables(
  driver: EmulatorDriver,
  observables: ProgramObservables,
  options?: ObservableRunOptions,
): Promise<void>;
```

- `assertObservables` walks `landmarks` in order (`memory` → `runUntilMemory`; `loopHead` →
  `runUntilLabelArrivals` with `options.loopHeadLabel`, throwing a clear error if the label is
  absent), then asserts every check via the existing `assertMemory` (byte) or a
  `driver.readMemory` block compare (bytesFile, resolved relative to the repo root).
- The data table is the PF-011 boundary made structural: a row cannot execute driver probes.
  Review guidance (not a type rule): checks at code addresses are opcode probes in disguise and
  are rejected in review.
- Test-only module — NOT exported from the package barrel (same posture as the other
  `testing/` helpers).

### New strategy: `runUntilLabelArrivals` in `run/strategies.ts` (plan-AR #2)

```typescript
/** Run to the n-th arrival at `label`; machine STOPPED on return. Set-once/resume-n/delete. */
export async function runUntilLabelArrivals(
  driver: EmulatorDriver,
  symbols: Map<string, number>,
  label: string,
  arrivals: number,
  timeout?: number,
): Promise<Registers>;
```

- Lifecycle: one tracked checkpoint (`setCheckpoint`), `arrivals` × resume-to-breakpoint,
  `deleteCheckpoint` in a `finally` — fixing, for this path, the leak `runUntilLabel` carries.
  Requires the `CycleMeasurementDriver` capabilities (tracked checkpoints), narrowed exactly as
  `measure.ts` does.
- Its Nth-arrival semantics (resuming from a stop AT the armed address fires on the NEXT
  arrival) are pinned by a live VICE probe spec BEFORE any suite depends on it (ST-2;
  01-requirements plan-local AC-2). If the probe refutes the assumption, the fallback is the
  measureCycles-style two-checkpoint dance — a plan deviation to surface, not to absorb
  silently.
- Lifecycle and error paths additionally carry CI-runnable fake-driver coverage (ST-2b) —
  the established per-strategy convention; the live probe proves VICE semantics, the fake
  driver keeps the checkpoint lifecycle regression-guarded everywhere (plan-preflight PF-008).
- **Off the package barrel** (plan-preflight PF-007): its only consumer today is the
  observables runner; `index.ts` and the barrel-surface spec (ST-27) stay untouched. Promote
  deliberately if an external consumer appears.

### Per-fixture `OBSERVABLES` tables (plan-AR #3, #4, #5)

Each `testing/<fixture>.ts` exports `export const <FIXTURE>_OBSERVABLES: ProgramObservables`,
lifted from its suite's current constants. The 11 straight lifts keep their existing
memory-landmark + exact-value form. The exceptions, each an explicit decision:

| Fixture | Shared set | AR Ref |
| ------- | ---------- | ------ |
| slice8 | Landmarks: counter→100 then mirror→100 **at source-mandated addresses?** — NO: those are allocator-chosen, so they move OUT of the shared set; shared landmarks = `memory $D020 == 0xF2` (strengthened exact readback, (14+100) mod 16 = 2); the counter/mirror waits stay fixture-local pre-steps of the fixture suite | plan-AR #3, #4 |
| rasterpoll (new) | Landmarks: `loopHead` arrivals=2 · checks: `$0400 == 1`, `$D020 == 0xF1` | plan-AR #5 |
| balloon (new) | Landmarks: `loopHead` arrivals=2 · checks: `$D000 == 174`, `$D010 == 0`, `$D001 == 141`, `$07F8 == 13`, `$D015 == 1`, `$D027 == 0xF1`, `$D017 == 0`, `$D01C == 0`, `$D01D == 0`, block `$0340` == `examples/balloon/balloon.bin` (63 bytes) | plan-AR #1, #5 |

Slice8 note: the fixture suite still performs its counter/mirror waits (against equate-derived
addresses) BEFORE calling `assertObservables` — those waits are how the fixture proves interrupt
interleaving, and they are implementation-coupled, so they stay out of the twin contract. The
twin's own path to the `$D020` landmark is its saturating loop, no waits needed.

### Suite refactor (12 files)

Each VICE suite replaces its inline landmark/check code with
`await assertObservables(driver, <FIXTURE>_OBSERVABLES, {...})`. Implementation probes stay
exactly where they are (e.g. the gate suite's `_main` opcode + PC checks,
`gate.spec.test.ts:48, 54-55`). Assemble-clean suites and negative suites are untouched.

### New fixture-side VICE suites (RD F2 / PF-009)

- `rasterpoll.spec.test.ts` — builds via `buildRasterpoll`, resolves the generated loop-head
  label from the build's symbol map, runs `assertObservables`. The generated loop-head label
  is discovered at implementation time from the emitted asm (the golden shows `_main: JMP
  Main_main_L0` — the label is `Main_main_L0`); the suite derives it from the build's symbols,
  never hardcodes a guess.
- `balloon.spec.test.ts` — same shape via `buildBalloon` (loop head `Main_main_L0`-equivalent,
  derived the same way).

### Sync test: `examples-sync.spec.test.ts` (RD F3 / PF-013, plan-AR #10)

Asserts, for every fixture with inlined sources (gate, 11 slices, rasterpoll — 13 programs, 18
modules), that each exported `*_SRC` constant equals the corresponding
`examples/<fixture>/<module>.blend` file byte-for-byte — including the multi-module fixtures
(slice5a: `math.blend`; slice5b: `math.blend`, `math2.blend`; slice7: `gfx.blend`; slice7b:
`game.blend`). Balloon exempt (builds from `examples/` directly); `.bin` assets exempt (copied,
never inlined). Runs everywhere (no ACME/VICE needed).

Known drift at plan time (plan-preflight PF-003): `SLICE3B_SRC` lacks the trailing explanatory
comments `examples/slice3b/main.blend` carries — comment-only, codegen-inert. This is ST-4's
genuine red; the green phase updates the constant to the example's exact text (`examples/` is
the oracle — plan-AR #10 addendum). The other 17 modules were verified byte-identical.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `loopHead` landmark without `loopHeadLabel`/`symbols` | Throw naming the fixture's requirement ("this observable set needs a loop-head label") | plan-AR #2 |
| Label absent from symbol map | Existing `runUntilLabel`-style error with sample keys | plan-AR #2 |
| Block check file missing/size mismatch | Throw naming the file and both lengths before any byte compare | plan-AR #5 |
| Nth-arrival timeout | `TimeoutError` naming label + which arrival was pending | plan-AR #2 |

## Testing Requirements

Owned by [07-testing-strategy.md](07-testing-strategy.md): ST-1…ST-8 incl. ST-2b (module +
strategy + live probe + fake-driver lifecycle + sync + the two new fixture cases + refactor
regression).

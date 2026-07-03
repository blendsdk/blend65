# Run Strategies, Assertions, Registry & Fixture

> **Document**: 03-03-run-strategies-fixture.md
> **Parent**: [Index](00-index.md)
> **Covers**: AC-03/04/05/06/07/08/11 · R7a · R17–R28 · AR-H6/H8/H9/H15

## Overview

On top of the driver sit the four public building blocks tests actually use: the three run
strategies (each timeout-guarded), the register/memory assertion helpers, the harness
platform→emulator registry (R7a), and the `setupEmulator` Vitest fixture that owns the
emulator lifecycle and binds a `BuildResult`/binary to a `ViceDriver` + `symbolMap`.

## Architecture

### Module layout (AR-H13)

```
src/run/strategies.ts     # runUntilLabel / runFrames / runUntilMemory + timeout guard
src/run/assertions.ts     # assertRegister / assertMemory
src/emulator/registry.ts  # R7a platform → { driver, executableName, defaultArgs }
src/fixture.ts            # setupEmulator({ build|binary, labelFile?, platform?, timeout?, gui? })
```

## Implementation Details

### Run strategies (`strategies.ts`, RD §4.2, R20–R24)

```typescript
/** Default per-strategy timeout (R23). Overridable per call/test (R24). */
export const DEFAULT_TIMEOUT_MS = 5000;

/** Break at a labeled address and return registers (R20, AC-03).
 *  Resolves `label` via `symbols` (keys per parseLabelFile — no leading dot). */
export async function runUntilLabel(
  driver: EmulatorDriver, symbols: Map<string, number>, label: string, timeout = DEFAULT_TIMEOUT_MS
): Promise<Registers>;

/** Run for N video frames (R21, AC-04). Implemented via ADVANCE_INSTRUCTIONS batches or a
 *  frame-count checkpoint; wall-clock bounded by the timeout guard. */
export async function runFrames(
  driver: EmulatorDriver, frames: number, timeout = DEFAULT_TIMEOUT_MS
): Promise<void>;

/** Poll a memory address until it holds `value` (R22, AC-05). */
export async function runUntilMemory(
  driver: EmulatorDriver, address: number, value: number, timeout = DEFAULT_TIMEOUT_MS
): Promise<void>;
```

**Mandatory timeout guard (R23, AC-06 — the load-bearing safety property):** every strategy
races its work against a single shared `withTimeout(promise, ms, label)` helper. On timeout
the helper (a) asks the driver to halt (a checkpoint at the current PC / stop), (b) rejects
with a `TimeoutError` naming the strategy, the label/address, and the elapsed ms. No
strategy can be written that bypasses the guard — the three exported functions are the only
entry points and each wraps its body in `withTimeout`.

- `runUntilLabel`: `setBreakpoint(symbols.get(label))` (throws a clear error if the label is
  absent from `symbols` — guards the DEF-2 class of failure), `resume()`, on
  `"breakpoint"` return `readRegisters()`; on `"timeout"`/`"exit"` reject.
- `runUntilMemory`: `resume` in bounded slices (or `ADVANCE_INSTRUCTIONS`), `readMemory(addr,1)`
  between slices until equal or the guard fires. This is the gate program's primary proof
  (AR-H9).
- `runFrames`: advance by a per-platform instructions-per-frame estimate × N (c64 ≈ 19656
  cycles/frame; a coarse instruction batch is adequate for the MVP), guard-bounded.
  **PF-004 (accuracy caveat):** this is an *approximate* frame count — instructions ≠ cycles,
  so N is a lower-bound batch, not a cycle-exact frame boundary. AC-04 ("runs N frames") is
  therefore verified at the "advances and completes within the guard" level (ST-22); a
  cycle-exact frame primitive (VIC-II raster / `DISPLAY_GET` frame-delta polling) is a future
  refinement beyond the MVP registry, not required by any ST case.

### Assertion helpers (`assertions.ts`, RD §4.3, R17–R19)

```typescript
/** Assert a register value (R17, AC-07). Throws a descriptive AssertionError on mismatch. */
export function assertRegister(registers: Registers, register: "a" | "x" | "y" | "sp", expected: number): void;

/** Assert memory content (R17/R19, AC-08). `address` is a numeric address OR a symbolic
 *  label resolved via `symbols` (keys per parseLabelFile — raw label, no leading `.`/`C:`).
 *  `expected` is a byte or a byte sequence. */
export async function assertMemory(
  driver: EmulatorDriver, address: number | string, expected: number | number[], symbols?: Map<string, number>
): Promise<void>;
```

- Symbolic resolution: when `address` is a string, `symbols.get(address)` — throws if the
  symbol is unknown, listing a few available keys (surfaces label-naming drift). The keys
  are exactly what `parseLabelFile` emits (e.g. `_main`, `__zp_arg_0` — verified live,
  PF-004).
- `expected` as `number[]` reads `length` bytes and compares the sequence; mismatch reports
  the address (symbolic + numeric), expected vs actual bytes in hex.

### Platform→emulator registry (`registry.ts`, R7a)

```typescript
interface EmulatorEntry {
  createDriver(): EmulatorDriver;   // () => new ViceDriver()
  executableName: string;           // "x64sc"
  defaultArgs: string[];            // headless monitor args
}
/** Harness-internal table (R7a). MVP: only `c64` → VICE x64sc. Others register as their
 *  drivers land; a future RD may migrate this into the RD-10 platform profile (PF-006). */
export const EMULATOR_REGISTRY: Record<string, EmulatorEntry>;
/** Look up an entry; throws a clear "no emulator registered for platform '<p>'" otherwise. */
export function emulatorFor(platform: string): EmulatorEntry;
```

The executable path resolves from `LaunchOptions.executablePath` if given, else the
registry `executableName` looked up on `PATH` (the same discovery style as ACME in RD-09).

### `setupEmulator` fixture (`fixture.ts`, RD §4.4, R25–R28, AC-11)

```typescript
export async function setupEmulator(options: {
  build?: BuildResult;   // RD-15 facade result (symbolMap/binaryPath/binary) — R27 (AR-H2)
  binary?: string;       // OR a pre-compiled binary path; sibling `.lbl` parsed via parseLabelFile (R28)
  labelFile?: string;    // explicit label-file override
  platform?: string;     // default "c64" → registry lookup (R7a)
  timeout?: number;
  gui?: boolean;
}): Promise<{ driver: EmulatorDriver; symbols: Map<string, number> }>;
```

- **Binary source:** `options.build.binaryPath` (preferred) or `options.binary`. A
  `BuildResult` with only `binary` bytes is written to a temp file for `-autostart`.
- **Symbols:** `options.build.symbolMap` when present (R28); else parse `labelFile` /
  the sibling `<binary>.lbl` via the compiler's `parseLabelFile` (R28, AR-H2).
- **Lifecycle (AR-H6, relaunch-per-binary):** the fixture launches a fresh `ViceDriver`
  (registry entry + headless args) with `-autostart <binary>` for the given binary. Callers
  own `describe.skipIf(no VICE)` at suite level (AC-13); `afterAll`/`afterEach` call
  `driver.shutdown()`. A `hasVice(platform?)` helper is exported so suites can gate cleanly.
  A sibling `hasAcme()` helper (mirroring `runtime-asm.impl.test.ts`'s `findAcme()`) is also
  exported: suites that **compile/assemble** as part of the test (the gate test's `build()`
  and the RD-17 routine vectors' `loadRuntimeModule`→ACME step) gate on
  `skipIf(!hasVice() || !hasAcme())`, so a VICE-without-ACME environment skips cleanly rather
  than erroring (PF-002). Pure-VICE suites (driver round-trips, strategies) gate on `hasVice`
  alone.

## Code Examples

### Gate program (AR-H9)

```typescript
const result = await build({ platform: "c64", sourceFiles: ["examples/gate/main.blend"] });
const { driver, symbols } = await setupEmulator({ build: result, platform: "c64" });
await runUntilMemory(driver, 0xd020, 5);            // primary proof (AC-05)
await assertMemory(driver, 0xd020, 5);              // numeric (AC-08)
await assertMemory(driver, "_main", 0xa9, symbols); // symbolic: _main's first opcode LDA=$A9 (AC-08)
const regs = await runUntilLabel(driver, symbols, "_main"); // exercises AC-03
assertRegister(regs, "sp", regs.sp);                // registers readable at the break
await driver.shutdown();
```

## Error Handling

| Error Case                                        | Handling Strategy                                                            | AR Ref |
| ------------------------------------------------- | --------------------------------------------------------------------------- | ------ |
| Strategy exceeds its timeout                      | `withTimeout` halts the emulator + rejects with a `TimeoutError` (R23)       | AR-H3  |
| `runUntilLabel` label absent from `symbols`       | Throw naming the missing label + sample available keys (DEF-2-class guard)   | AR-H7  |
| `assertMemory` symbolic label unknown             | Throw listing available symbol keys                                         | R19    |
| Register/memory mismatch                          | `AssertionError` with expected vs actual in hex + (symbolic) address        | R17    |
| Unknown platform in `setupEmulator`               | `emulatorFor` throws "no emulator registered for platform '<p>'"            | R7a    |
| VICE absent                                       | `hasVice()` → suite `skipIf`; `setupEmulator` also rejects clearly (AC-13)  | AR-H3  |

> **Traceability:** signatures are RD §4.2–§4.4 verbatim; the timeout guard is R23/AC-06;
> symbolic keys are R19/PF-004; the registry is R7a; relaunch-per-binary is AR-H6; the gate
> sync choice is AR-H9.

## Testing Requirements

- **Spec tests (mixed):** timeout-guard behavior is unit-testable against a **fake driver**
  (no VICE, runs in CI) — a strategy whose driver never breaks must reject with a
  `TimeoutError` within the budget (ST-14/ST-15). `assertRegister`/`assertMemory` logic is
  unit-testable against a fake driver / literal `Registers` (ST-16/ST-17/ST-18). The
  registry lookup is a pure unit test (ST-19).
- **Integration (local, skipIf-VICE):** the three strategies against real VICE + the gate
  program; `setupEmulator` end-to-end (ST-20..ST-23).

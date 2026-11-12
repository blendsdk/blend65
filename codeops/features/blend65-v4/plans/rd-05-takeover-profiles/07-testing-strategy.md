# Testing Strategy — Takeover Resident Profiles

> **Parent**: [Index](00-index.md)
> **Updated**: 2026-11-12

The takeover capability is qualified by independent source, output and runtime cases. The
frozen behavioral oracle is the emitted artifact and the C64 device state, not the
compiler's own evidence claims. Every case names whether it is a specification case
(derived from RD-05/Specification 4.0) or an implementation case (compiler internals).

## New files

| File | Tier | Purpose |
|---|---|---|
| `test/rd05/takeover-vice.spec.test.ts` | spec | Four-profile sequential VICE matrix with real raw execution, default IRQ/NMI entries, raw IRQ route and normal return |
| `test/rd05/takeover-smoke.impl.test.ts` | impl | Public build smoke, raw IRQ build, negative admission and placement cases |
| `packages/compiler/src/target/takeover-profiles.impl.test.ts` | impl | Fact-row identity, composition, startup state/order, default-entry and raw-wrapper costs |

## Author independence

Behavioral oracles live in the VICE spec file and are derived from the frozen takeover
contract and RD-05, not from emitted implementation details. Internal instruction, cost
and admission assertions live in `*.impl.test.ts`. A failure in the VICE behavior oracle
means the implementation is wrong; the oracle is not adjusted to match emitted code. Any
oracle change requires an explicit authorization record. The implementation session did
not use the compiler's own evidence sidecars as the behavioral expectation.

## Specification cases

### ST-T1 — Closed inventory admission

- All four takeover IDs are accepted by `parseManifest`, `checkProject` and
  `buildProject`.
- The manifest still rejects `c64-pal`, `c64-pal-d64-kernal-8580`,
  `c64-ntsc-d64-kernal-6581`, and uppercase variants.
- A takeover ID is not accepted with a `d64` packager and a D64 ID is not accepted as
  takeover.

### ST-T2 — Compile-time profile constants

- Takeover builds expose `c64.profile.hasRawInterrupts == true` and
  `c64.profile.usesKernal == false`; cooperative builds expose the opposite.
- A compile-time `if (c64.profile.isPal) ... else ...` branch contains no inactive path
  under `optimization: none`.
- PAL/NTSC and 6581/8580 pairs produce exact frame/SID constants.

### ST-T3 — Startup artifact shape

- PRG starts with `$01 $08` then the frozen 12-byte stub.
- `startup.entry` is `$080D`.
- The startup block writes `$FFFA/$FFFB` and `$FFFE/$FFFF` before the `$0001` write.
- The `$0001` write uses `(saved & $F8) | $05`; the `$0000` write uses
  `saved | $07`.
- The startup path contains no `$0314/$0318` write, no `$EA81` jump and no KERNAL call.
- `startup.restore` writes `$0001` then `$0000` and ends in `RTS`.

### ST-T4 — Default raw entries

- The default IRQ entry preserves A, reads `$DC0D` once, reads `$D019` once and writes
  the observed value back once, then `RTI`; expected 12 bytes / 25 nominal cycles.
- The default NMI entry executes `BIT $DD0D` (A preserved) and `RTI`; expected 4 bytes / 10
  nominal cycles.
- Both vector words point at their default entries in the assembled label map.
- The default NMI entry is placed at low byte `$47`.
- No CIA mask/timer control or latch write appears in startup or in the default entries.

### ST-T5 — Raw IRQ install and restore

- A source `setRawIRQ(&handler)` followed by `restoreRawIRQ()` builds.
- The emitted install captures both current vector bytes, writes both new bytes, and is
  surrounded by the existing `PHP; PHA; SEI` transaction.
- The emitted restore writes the exact saved predecessor back inside the same transaction.
- Two nested installs and two restores export two live predecessor words and restore the
  second then the first.
- An ordinary function passed to `setRawIRQ` is `E10244`; erased provenance is `E10247`.
- An unmatched restore, cross-sink restore, or raw write after install is `E10278`.
- A raw handler that neither drains nor disables CIA1 before install, or that drains it
  only on some paths, is `E10278`; an unconditional typed `readAndClearPendingSources`
  or full disable in every path builds. A full disable is a typed mutation, so a
  returning program cannot use it: the final `restoreRawIRQ` is `E10278` unless the path
  is nonreturning.
- A `setRawIRQ` route that cannot keep both vector bytes valid inside the IRQ-masked
  transaction is rejected before ACME.

### ST-T6 — Default NMI ownership and raw NMI deferral

- The startup default NMI entry is the only NMI route in a normal takeover build.
- `c64.system.setRawNMI` and `c64.system.restoreRawNMI` are unknown names under every
  profile in this slice.
- A typed CIA2 source or state operation without a proved exclusive NMI owner is
  `E10278`; the default NMI entry does not satisfy that proof for source-enabled sources.
- A program using only the default NMI entry builds and the VICE case executes it.
- The expected deferred limitation is recorded as `V4-TAKEOVER-F2`.

### ST-T7 — CIA ownership

- A raw IRQ handler that unconditionally consumes every CIA1 source and returns builds;
  an unowned, conditionally consuming or unbalanced route is `E10278`.
- A handler that fully disables CIA1 is accepted only on a nonreturning path; a returning
  program that changed CIA1 timer or mask state is `E10278`.
- A CIA2 typed operation without a proved raw NMI owner is `E10278`.
- Cooperative-only sinks are unknown names under takeover; raw IRQ sinks are unknown names
  under cooperative and D64.

### ST-T8 — Normal return

- A returning takeover `main` reaches the caller's return address with `$0000/$0001`,
  `$DD02`, A/X/Y, P and SP restored to their entry values.
- A nonreturning takeover `main` builds and its artifact contains no reachable restore
  path.
- Borrowed zero-page bytes are restored to their exact incoming values, not zeroes.

### ST-T9 — Takeover layout visibility

- The prescribed `$05` mapping exposes RAM at `$A000–$BFFF`; ordinary code, data, default
  entries and SFA may use the full `$0801–$CFFF` range.
- A high fixed object or function at `$C000` builds with a contiguous PRG body.
- The startup code and saved-state visibility guard still passes on the cooperative
  restore boundary.
- A VICE read/write probe under the running `$05` mapping confirms `$A000` is RAM.

### ST-T10 — Torn-vector and unhandled-source negatives

- A source that changes `$0001` or writes `$FFFE/$FFFA` outside the recognized raw sink
  invalidates the vector proof and fails with `E10278`.
- A raw IRQ handler that leaves a known enabled source unowned fails before emission.
- A takeover program that enables a CIA2 NMI source without a raw NMI owner fails with
  `E10278`.
- No negative case produces an artifact.

## Output and cost cases

| Case | Expectation |
|---|---|
| `takeover-output` default startup | exact opcode/operand order for state capture, CIA2 mask, vector writes, mapping writes, `CLI`, initializer calls, `main` |
| `takeover-output` startup state | 8 bytes plus borrowed bytes; every offset accessed once |
| `takeover-output` default IRQ | 12 bytes / 25 nominal cycles; one `$DC0D` read, one `$D019` read, one `$D019` write, A preserved |
| `takeover-output` default NMI | 4 bytes / 10 nominal cycles; `BIT $DD0D` (A-preserving read), `RTI`, low byte `$47` |
| `takeover-output` raw IRQ wrapper | 12 output bytes / 37 cycles plus body; 6 stack bytes |
| `takeover-output` raw IRQ install | 27 bytes / 44 nominal cycles from the emitted `PHP; PHA; SEI` transaction; two vector writes; no CIA write |
| `takeover-output` raw IRQ restore | 17 bytes / 32 nominal cycles; exact saved predecessor; no extra device traffic |
| `takeover-output` startup entry/restore | 77/107 and 36/59 bytes/cycles for the empty takeover constructor |
| `takeover-output` borrowed bytes | captured once at entry and restored once at exit |
| `takeover-output` profile pairs | PAL/NTSC and 6581/8580 differ only in selected constants and SID identity |

No cost is accepted from a formula when the emitted assembly can be measured. The
independent expectation is derived from the specification/CPU facts; the compiler's cost
sidecar is cross-checked, not trusted.

## VICE matrix

`test/rd05/takeover-vice.spec.test.ts` runs `describe.sequential` over:

| Profile | VIC model | SID model | Raster lines |
|---|---|---:|---:|
| `c64-pal-prg-takeover-6581` | 6569 | 6581 | 312 |
| `c64-pal-prg-takeover-8580` | 6569 | 8580 | 312 |
| `c64-ntsc-prg-takeover-6581` | 6567 | 6581 | 263 |
| `c64-ntsc-prg-takeover-8580` | 6567 | 8580 | 263 |

Each case:

1. builds a fresh source with a real initializer, a `main` that writes selected profile
   constants and device state, and a normal return;
2. hashes the PRG and asserts the `$01 $08` header and stub;
3. locates `startup.entry`, `startup.restore`, `startup.rawIrqDefault`,
   `startup.rawNmiDefault` and `main` from the public label map;
4. launches only that PRG in the attested VICE 3.10 with the exact ROMs;
5. executes to `startup.entry`, then observes the vector words, `$0000/$0001` and `$DD02`
   before and after the mapping change;
6. executes the default IRQ entry at least once and confirms the CIA1/VIC acknowledgements;
7. executes the default NMI entry with a monitor-injected CIA2 timer NMI and confirms the
   `$DD0D` read and `RTI` return;
8. executes `main`, observes the profile constants and device writes;
9. executes `startup.restore`, observes the caller return address, exact `$0000/$0001`,
   `$DD02`, borrowed-byte, SP and status restoration;
10. records artifact, identity, resources, entry/main/exit CPU and state.

A second VICE case installs a raw IRQ handler that unconditionally consumes **CIA1
Timer A**, executes it, restores it, and returns. VIC-raster acknowledgement remains a
source responsibility and raw VIC source enablement is the `V4-TAKEOVER-F3` boundary. The
negative cases are compile-time only: an unowned or conditionally consuming CIA1 raw
handler, a raw NMI source request, and a source write to the compiler-owned
port/vector/bank bytes are rejected, and no VICE process is launched.

VICE cases run sequentially so concurrent `x64sc` instances do not contend.

## Verification commands

During implementation:

```sh
yarn vitest run test/rd05/takeover-smoke.impl.test.ts
yarn vitest run test/rd05/takeover-vice.spec.test.ts
yarn workspace @blend65/compiler test -- src/target/takeover-profiles.impl.test.ts
```

Before the phase checkpoint:

```sh
yarn install --frozen-lockfile
yarn build
yarn typecheck
yarn test
```

Formatting is targeted to touched files. `git status --porcelain spec/` must stay empty.

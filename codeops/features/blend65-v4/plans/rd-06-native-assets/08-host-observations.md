# Host Observations: RD-06 Native Assets

> **Document**: 08-host-observations.md
> **Parent**: [Index](00-index.md)
> **Recorded**: 2026-11-09

## Scope

These are trend observations, not wall-clock gates. The compiler runs on Linux; the C64 target
behavior is observed through the pinned VICE 3.10 `x64sc` harness. No native hardware claim is made.

## Handler identities

| Handler | Version | Accepted input | Evidence level |
| --- | --- | --- | --- |
| `raw` | `1` | Any nonempty file without a registered native extension | Synthetic public fixtures |
| `psid` | `1-4` | Self-contained PSID v1-v4 | Constructed public fixtures + VICE placement |
| `koala` | `classic` | Classic 10,003-byte Koala at `$6000` | Constructed public fixtures + Q-P15 VICE |
| `spritepad` | `3.80` | SPD v5 | Committed synthetic fixture + local producer examples (licensed app) |
| `charpad` | `3.80` | CTM v9 | Committed synthetic fixture + local producer examples (licensed app) |

## Observed runs

| Run | Result | Notes |
| --- | --- | --- |
| Compiler suite | 3,634 passed, 2 skipped | `yarn workspace @blend65/compiler test` |
| Directed root suites | 908 passed | `test/rd06`, `test/rd04`, `test/m1` and the RD-05 joystick oracle, including all RD-06 VICE files |
| RD-06 non-VICE directed | 82 passed | All committed RD-06 specification, impl and fixture suites |
| PSID VICE placement | Fixed and payload-load data observed at `$3000` | `test/rd06/vice-psid.spec.test.ts` |
| Koala/Q-P15 VICE | Screen, Color RAM, bitmap head and change bytes observed | `test/rd06/vice-qp15.spec.test.ts` |
| Producer examples | Selected SPD and CTM selectors parsed and hashed from the installed 3.80 examples | `spritepad.spec.test.ts`, `charpad.spec.test.ts` |
| Synthetic producer fixtures | Committed SPD v5 / CTM v9 fixtures parse with exact selector hashes | `native-producer-assets.spec.test.ts` |

Per-handler wall-clock parse/layout/build durations and peak RSS are not recorded here as exact
numbers. The host measurements in `.build.json` remain `Unknown` where the compiler cannot measure
them; they are not correctness gates.

## Memory views

`.memory.json` now publishes three views:

| View | Window | Occupied source |
| --- | --- | --- |
| `cpu16-resident` | `$0000-$10000` | Loaded program, data, SFA and assets; free/hole reporting bounded to `$0801-$CFFF` |
| `vic-bank-0` | `$0000-$4000` | Bank-0 intervals, excluding objects that cross the bank boundary |
| `color-ram` | `$0000-$0400` in `colorram4` | One `color-ram.hardware` reservation |

Free intervals are computed with the same inclusive-end helper used by layout, so
`occupiedBytes + freeBytes === capacityBytes` and the free partition tiles the window exactly.
Non-allocatable CPU ranges (`$0000-$0800`, `$D000-$FFFF`) and the active screen are published as
reservations; uncovered character-ROM bytes are reserved too. The contiguous PRG may still span
those addresses as RAM, so a separate disjoint CPU interval would double-count bytes. The VIC view
continues to omit objects that cross `$4000`; that residual is owned by `T-26`, not claimed as a
complete crossing projection.

## Specification red-phase record (6.1.4)

Command:

```text
yarn vitest run test/rd06/fixtures.spec.test.ts test/rd06/examples.spec.test.ts \
  test/rd06/integration.spec.test.ts test/rd06/aliasing.spec.test.ts \
  test/rd06/blocked-gates.spec.test.ts
```

Result: 5 files, 14 tests passed.

These five files were completed while phases 5–8 were being implemented, so a preserved
pre-implementation red log does not exist for the final file set. The expected red failure modes were
observed during completion: `.memory.json` malformed (missing/inconsistent views), `.costs.json`
malformed (resource reconciliation), missing compile-time scalar records, and the integration and
aliasing files being absent. This is recorded as a qualification gap rather than an independently
reproduced red phase.

## Phase 10 review fixes

Five independent reviews found two critical and nine major defects. The critical defects were
fixed and covered by regression tests:

- A constant aggregate initialized from a named or embedded aggregate no longer falls through to
  BSS; `[ROW]` and `const ALIAS = ROW` emit initialized data.
- `&asset` now materializes the asset address (`#<label`/`#>label`), not its first data bytes.

Major fixes: fixed-sprite self-collision, order-independent VIC-visible placement, zero-byte
selected-array evidence, CharPad packed-12 type length, consumer-derived VIC alignment/visibility,
E10144 for scalar selectors in array declarations, placement diagnostics for zero-byte/loadable
assets, honest asset padding, CPU-bounded memory views, and a single helper-scratch definition.
Deferred review items are owned by `T-20`–`T-27`.

## Evidence boundary

Local producer examples are retained at `/home/gevik/workdir/github/blend65.ri/apps` with the
recorded SHA-256 values in `test/rd06/fixtures/producer-evidence.json`. They are not committed
because the vendor EULA does not grant redistribution of the bundled files. Committed public
fixtures are synthetic.

Runtime status: `VICE-verified / hardware-unverified`.

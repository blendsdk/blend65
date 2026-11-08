# Host Observations: RD-06 Native Assets

> **Document**: 08-host-observations.md
> **Parent**: [Index](00-index.md)
> **Recorded**: 2026-11-08

## Scope

These are trend observations, not wall-clock gates. The compiler runs on Linux; the C64 target
behavior is observed through the pinned VICE 3.10 `x64sc` harness. No native hardware claim is made.

## Handler identities

| Handler | Version | Accepted input | Evidence level |
| --- | --- | --- | --- |
| `raw` | `1` | Any nonempty file without a registered native extension | Synthetic public fixtures |
| `psid` | `1-4` | Self-contained PSID v1-v4 | Constructed public fixtures + VICE placement |
| `koala` | `classic` | Classic 10,003-byte Koala at `$6000` | Constructed public fixtures + Q-P15 VICE |
| `spritepad` | `3.80` | SPD v5 | Local producer examples (licensed app) |
| `charpad` | `3.80` | CTM v9 | Local producer examples (licensed app) |

## Observed runs

| Run | Result | Notes |
| --- | --- | --- |
| Compiler suite | 3,630 passed, 2 skipped | `yarn workspace @blend65/compiler test` |
| Directed root suites | 896 passed | `test/rd04`, `test/m1`, `test/rd06` and the RD-05 joystick oracle |
| PSID VICE placement | Fixed and payload-load data observed at `$3000` | `test/rd06/vice-psid.spec.test.ts` |
| Koala/Q-P15 VICE | Screen, Color RAM, bitmap head and change bytes observed | `test/rd06/vice-qp15.spec.test.ts` |
| Producer examples | Selected SPD and CTM selectors parsed and hashed from the installed 3.80 examples | `spritepad.spec.test.ts`, `charpad.spec.test.ts` |

Per-handler wall-clock parse/layout/build durations and peak RSS are not recorded here as exact
numbers. The host measurements in `.build.json` remain `Unknown` where the compiler cannot measure
them; they are not correctness gates.

## Memory views

`.memory.json` now publishes three views:

| View | Window | Occupied source |
| --- | --- | --- |
| `cpu16-resident` | `$0000-$10000` | Loaded program, data, SFA and assets |
| `vic-bank-0` | `$0000-$4000` | Bank-0 intervals, excluding objects that cross the bank boundary |
| `color-ram` | `$0000-$0400` in `colorram4` | One `color-ram.hardware` reservation |

Free intervals are computed with the same inclusive-end helper used by layout, so
`occupiedBytes + freeBytes === capacityBytes` and the free partition tiles the window exactly.
Screen and character-ROM reservations remain layout constraints rather than CPU intervals: the
contiguous PRG legitimately spans those addresses as RAM, so publishing them as disjoint CPU
occupancy would double-count bytes. This is recorded as a residual layout/evidence item, not a
claim that the windows are unreserved for VIC placement.

## Specification red-phase record (6.1.4)

Command:

```text
yarn vitest run test/rd06/fixtures.spec.test.ts test/rd06/examples.spec.test.ts   test/rd06/integration.spec.test.ts test/rd06/aliasing.spec.test.ts   test/rd06/blocked-gates.spec.test.ts
```

Result: 5 files, 14 tests passed.

These five files were completed while phases 5–8 were being implemented, so a preserved
pre-implementation red log does not exist for the final file set. The expected red failure modes were
observed during completion: `.memory.json` malformed (missing/inconsistent views), `.costs.json`
malformed (resource reconciliation), missing compile-time scalar records, and the integration and
aliasing files being absent. This is recorded as a qualification gap rather than an independently
reproduced red phase.

## Evidence boundary

Local producer examples are retained at `/home/gevik/workdir/github/blend65.ri/apps` with the
recorded SHA-256 values in `test/rd06/fixtures/producer-evidence.json`. They are not committed
because the vendor EULA does not grant redistribution of the bundled files. Committed public
fixtures are synthetic.

Runtime status: `VICE-verified / hardware-unverified`.

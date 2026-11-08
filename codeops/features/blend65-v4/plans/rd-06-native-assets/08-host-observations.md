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
| Compiler suite | 3,623 passed, 2 skipped | `yarn workspace @blend65/compiler test` |
| Directed root suites | 673 passed | `test/rd04`, `test/m1`, `test/rd06` |
| PSID VICE placement | Fixed and payload-load data observed at `$3000` | `test/rd06/vice-psid.spec.test.ts` |
| Koala/Q-P15 VICE | Screen, Color RAM, bitmap head and change bytes observed | `test/rd06/vice-qp15.spec.test.ts` |
| Producer examples | Selected SPD and CTM selectors parsed and hashed from the installed 3.80 examples | `spritepad.spec.test.ts`, `charpad.spec.test.ts` |

Per-handler wall-clock parse/layout/build durations and peak RSS are not recorded here as exact
numbers. The host measurements in `.build.json` remain `Unknown` where the compiler cannot measure
them; they are not correctness gates.

## Evidence boundary

Local producer examples are retained at `/home/gevik/workdir/github/blend65.ri/apps` with the
recorded SHA-256 values in `test/rd06/fixtures/producer-evidence.json`. They are not committed
because the vendor EULA does not grant redistribution of the bundled files. Committed public
fixtures are synthetic.

Runtime status: `VICE-verified / hardware-unverified`.

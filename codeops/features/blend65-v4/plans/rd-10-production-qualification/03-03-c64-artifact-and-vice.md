# C64 Artifact and VICE Qualification: RD-10

> **Document**: 03-03-c64-artifact-and-vice.md
> **Parent**: [Index](00-index.md)

## Overview

Every runtime observation for this candidate comes from VICE 3.10 `x64sc`. This document defines the
artifact matrix, the sequential VICE order, and the focused requalification of language, assets, and
optimizer output. It does not add a loader, runtime, or emulator wrapper.

## VICE identity

| Fact | Source |
| ---- | ------ |
| Executable | Canonical `x64sc` path and SHA-256 |
| Version | VICE 3.10 banner |
| ROMs | KERNAL, BASIC, CHARGEN exact hashes |
| Monitor | Attested binary-monitor connection |
| Lifecycle | Owned process group stopped after each case |

`test/m1/vice-runtime.ts` already owns these facts. RD-10 reuses it and records the observed identity
in the release record.

## Artifact matrix

| Profile | Build/assemble/package | VICE observation |
| ------- | ---------------------- | ---------------- |
| `c64-pal-prg-kernal-6581` | Required | Required |
| `c64-pal-prg-kernal-8580` | Required | Required |
| `c64-ntsc-prg-kernal-6581` | Required | Required |
| `c64-ntsc-prg-kernal-8580` | Required | Required |
| `c64-pal-prg-takeover-6581` | Required | Required representative takeover case |
| `c64-pal-prg-takeover-8580` | Required | Required representative takeover case |
| `c64-ntsc-prg-takeover-6581` | Required | Required representative takeover case |
| `c64-ntsc-prg-takeover-8580` | Required | Required representative takeover case |
| `c64-pal-d64-kernal-6581` | Required | Required D64 boot/load/BASIC-return case |

Each resident run records exact profile facts, source/artifact hashes, ACME/VICE identity, startup,
banking, interrupt/NMI routes, initial state, stop condition, expected values/MMIO, normal return or
declared nonreturning exit, and complete resource evidence. One profile result cannot stand in for
another dimension.

## Sequential VICE order

1. `test/rd05/profiles-vice.spec.test.ts`
2. A focused takeover runtime case (extend the existing profile fixture or add one bounded case)
3. `test/rd05/cia-*.spec.test.ts`, `handler-irq-*.spec.test.ts`, `runtime-switch-vice.spec.test.ts`,
   `vic-collision-vice.spec.test.ts`, `joystick-vice.spec.test.ts`, and other enabled VICE cases
4. `test/rd06/vice-*.spec.test.ts`
5. `test/rd07/d64-vice.spec.test.ts` with `RD07_VICE=1`
6. `test/rd08/input-startup-selection.spec.test.ts` and other enabled native optimizer cases
7. `test/rd09` tooling boundary (no VICE dependency)

Run each command sequentially. Never start a second `x64sc` while one is active. A bounded startup
timeout is retried once, alone, and recorded with the failed case identity.

## D64 qualification

The D64 run proves:

- exact 174,848-byte image;
- BAM/directory/sector/data-chain validation;
- drive-8 mount and boot;
- successful and failed loads;
- exact destination/canary bytes;
- success/failure publication;
- explicit quiescence;
- BASIC return;
- `HLE-010` trusted-media disclosure.

No other D64 combination, compressor, fastloader, hostile-media guarantee, or all-drive claim.

## Language and assets

- Every normative Specification 4 family has positive, boundary, negative, diagnostic, and
  representative composition evidence; at least one required case per family reaches assembled bytes
  and applicable VICE behavior through the public compiler.
- SpritePad 3.80/SPD v5, CharPad 3.88/CTM v9, self-contained PSID v1–v4, GoatTracker 2.77, Koala, and
  raw producer/format fixtures prove selectors, provenance, composition, placement, bytes, runtime
  consumers, and negative cases.
- The installed CharPad 3.80 versus frozen 3.88 mismatch from RD-06 is recorded as a release gap or
  resolved with the exact 3.88 fixture before the asset claim is made.

## Optimizer

- `none` proves complete correctness, determinism, direct lowering, resources, and absence of
  optional search.
- `balanced`, `speed`, and `size` run the complete relevant transformation matrix with an independent
  behavior oracle and a separate assembly/resource expectation.
- No optimized result loses to equivalent expert work for its selected objective.
- Every meet-only result links an authorized issue with measured delta and a path to a win.
- Each mode demonstrates its realistic whole-program win without hiding bytes, tables, ZP, SFA,
  stack, scratch, load, or timing cost.

## Compiler-not-engine boundary

The self-contained sprite multiplexing, scrolling, double buffering, input, SID music/effects,
fixed-pool, collision, state-dispatch, loading, and M1 programs compile and run as user-authored
Blend65. Package/API/binary inspection proves no renderer, entity system, scheduler, mixer, scene
manager, or gameplay policy is linked or exposed.

## Error handling

| Case | Handling |
| ---- | -------- |
| VICE unavailable | `Unknown` for every runtime claim; no pass count |
| Monitor startup timeout | Retry once alone; record the case |
| Profile build mismatch | Block that profile |
| D64 structure failure | Block the disk claim |
| Asset fixture missing | Leave that handler unqualified |
| Optimizer regression | Block that mode |
| Emitted bytes differ from pinned identity | Rerun the affected family and record the cause |

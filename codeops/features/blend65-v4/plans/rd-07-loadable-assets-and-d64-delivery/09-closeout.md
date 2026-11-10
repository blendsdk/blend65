# RD-07 Closeout (In Progress)

> **Document**: 09-closeout.md
> **Parent**: [Index](00-index.md)
> **Status**: In Progress — not ready to close
> **Date**: 2026-11-10

## Result

RD-07 is **not fully delivered**. The core vertical slice is implemented, verified, and committed:

| Capability | Evidence |
| --- | --- |
| Loadable unit model | `frontend/load-units.ts`; 17 `loadable-model` tests |
| Native/raw assets under `loadable const` | Handler validation instead of E10204 rejection; RD-06 handler test updated |
| D64 serializer | `packages/compiler/src/packaging/d64/`; 5 independent-decoder tests |
| D64 profile | `c64-pal-d64-kernal-6581` selects `cbm-d64`; target oracles updated |
| Load operation | `c64.loader.load(unit, destination)` accepted; `load-unit` semantic operation |
| KERNAL lowering | `machine/lower-load-unit.ts`: SETLFS/SETNAM/LOAD, STATUS + exact end check |
| D64 build/publication | A real project publishes `load.d64` with boot + unit components |
| Publication flow | Direct, inverted, and stored results; E10276 on failed/non-covering edges |
| Quiescence | Active IRQ/NMI routes reject with E10275; restored routes pass |
| Evidence | `loadStates`, debug `loadUnits`, disk/`existingRom` costs |
| Run | D64 primary passed to the pinned VICE `-autostart` path |
| Example | `examples/rd07-loadable` builds a composite unit D64 |

Verification: compiler suite **3,656 passed / 2 skipped**; RD-07 directed suite **36/36**; `spec/` untouched.

## Remaining work (blocking closeout)

| Requirement | Remaining work | Plan tasks |
| --- | --- | --- |
| R7.3/R7.29/AC-24 | Dynamic fixed-array destination sets and their finite candidate/publication proof | 2.2.5, 2.2.7, 3.2.4, 3.2.6 |
| R7.5/AC-04 | Full must/may/partial alias cases, loops, retries, and prior initialized candidates | 3.2.4, 3.2.6, 3.3.1 |
| R7.40/AC-31 | Loader/destination memory intervals, exclusive state views, free-space reconciliation | 5.2.1–5.2.8 |
| R7.39 | Loader/call-site byte split and measured/unknown transfer timing | 4.3.2, 8.2.2 |
| R7.17/AC-14 | D64 mount/autostart failure separation and VICE runtime proof | 7.2.5–7.2.7, 9.1.3–9.1.5 |
| R7.41/AC-07 | Capacity/name/structural tests against the exact published image | 6.1.2, 6.2.10 |
| R7.45–R7.46/AC-36 | Full boundary, deferral-expiry scan, and closeout | 9.2.1–9.2.4 |
| R7.47/R7.49 | Remaining focused examples and host observations | 9.1.2, 9.1.7 |

## Verification record

| Check | Command | Result |
| --- | --- | --- |
| Compiler suite | `yarn workspace @blend65/compiler test` | 3,656 passed / 2 skipped |
| RD-07 directed | `yarn vitest run test/rd07` | 36 passed |
| Example | `test/rd07/examples.spec.test.ts` | pass |
| D64 run argv | `src/services/vice-profiles.spec.test.ts` | 12 passed |
| Frozen spec | `git status --porcelain spec/` | empty |

## Honest boundary

- No automated VICE runtime proof of the loader is committed yet. The D64 image opens in VICE
  manually, but the bounded monitor test is pending.
- The KERNAL loader status check uses the KERNAL `STATUS` byte plus the returned end address.
- The quiescence check is the conservative linear route proof, not the full conditional path proof.
- Dynamic destination sets and the complete alias/loop publication matrix are not implemented.
- No claim of `VICE-verified` or physical-hardware qualification is made.

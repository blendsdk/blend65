# Testing strategy

> **Parent**: [Index](00-index.md)
> **Authority**: plan-local R-1–R-7 and AR-2–AR-8; frozen language/CPU/platform semantics.

## Specification Test Cases

An independent author writes new specifications from this table and planned signatures only.
The parent's existing poll and behavior/startup/trace specifications stay frozen. No expectation
comes from the eventual implementation.

| ID    | Concrete input                                                                                                                                                                | Expected result                                                                                                      | Source                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| ST-1  | Byte `frame=0`; arbitrary forward/reverse and unchanged iterations; forward increment then reset at `>=4`; reverse zero sets 3, otherwise subtracts 1                         | Publication loads certified below 4; transient increment/guard load not certified                                    | R-1; AR-3                                   |
| ST-2  | Same graph but reverse path subtracts at zero without the zero guard                                                                                                          | That path's later frame load is not certified below 4                                                                | R-1; byte wrap semantics                    |
| ST-3  | Same graph with an additional `frame=9` path reaching publication unchanged                                                                                                   | Publication load not certified below 4                                                                               | R-1; AR-3                                   |
| ST-4  | Load frame, then write frame=9, then branch on the old captured comparison                                                                                                    | Old comparison does not certify new frame storage                                                                    | R-1; immutable values versus mutable places |
| ST-5  | Initialize frame=0, include an unchanged loop backedge, and an unreachable uninitialized predecessor                                                                          | Reachable publication remains certified; unreachable is not Unknown                                                  | R-1; AR-3                                   |
| ST-6  | Real immutable 1,024-byte sprite asset, `vicSpriteBlock(&asset) + frame*4 + 0..3`, ST-1 counter, initialize all four pointer slots before enable mask15, adjacent raster poll | Proof permits those exact pointer/enable publications; public none-mode poll is 7 bytes / 9 same-page nominal cycles | R-2–R-5                                     |
| ST-7  | Omit one of four pointer initializations on a reachable branch before enable15                                                                                                | Publication proof absent; original poll capture remains                                                              | R-2; AR-5                                   |
| ST-8  | Use numeric pointer `$80`, dynamic pointer source, negative/wrapped offset or an offset whose 64-byte block exceeds the asset                                                 | Publication proof absent; build retains ordinary lowering, no new diagnostic                                         | R-2, R-6                                    |
| ST-9  | Add source `$D018`, `$DD00`, `$DD02`, CPU-port or mirrored selector write; or a generated IRQ pointer writer                                                                  | No publication exemption; named/aggregate guards unchanged                                                           | R-2, R-3; AR-5                              |
| ST-10 | Add an unbounded raw/indexed observer or ordinary raw write which may alias SFA windows                                                                                       | No anonymous forwarding; original observable storage effects retained                                                | R-3; AR-2, AR-5                             |
| ST-11 | Comparison result is materialized, producer is multi-use, runtime RHS, signed/wide read or an intervening effect/operation                                                    | Existing general lowering remains correct; no new register ownership                                                 | R-4, R-6                                    |
| ST-12 | Reuse a proof with a different program/function/operation object; or call the named-source reload helper without a proof                                                      | Stale proof grants no exemption; existing named-source result unchanged                                              | R-3; AR-7                                   |
| ST-13 | Four cooperative profiles, both equality polarities, no source publications                                                                                                   | Parent eight simple poll cases pass; no proof framework or asset needed                                              | R-4, R-5                                    |
| ST-14 | Canonical boing-ball and corrected twin under VICE                                                                                                                            | Parent 5 tests pass unchanged; parent workload poll passes; compiler code decreases by measured capture removal      | R-5; AR-8                                   |

## Files and ordering

| Tier                             | File / role                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New independent counter spec     | `packages/compiler/src/machine/sprite-publication-proof.spec.test.ts` — ST-1–ST-5                                                                               |
| New independent eligibility spec | `packages/compiler/src/machine/sprite-publication-eligibility.spec.test.ts` — proof/observer-interface parts of ST-6–ST-12; no public byte-shape assertion      |
| New public integration spec      | `test/rd05/sprite-publication-forwarding.spec.test.ts` — ST-6–ST-11 via real public builds                                                                      |
| Frozen existing spec             | Parent `volatile-byte-poll.spec.test.ts`, `boing-ball-contract-vice.spec.test.ts`, `boing-ball-startup.spec.test.ts`, original `boing-ball-parity.spec.test.ts` |
| Implementation controls          | New `sprite-publication-proof.impl.test.ts` and existing observer tests, after behavior/assembly GREEN                                                          |

The parent already demonstrates meaningful transformation RED in nine cases. A missing new module
is setup/API RED only, not additional behavior evidence. Freeze new author outputs after adapter
qualification and record actual commands. Add no custom runner or emulator harness.

## Hardening and verification

Cover finite-counter transfers/joins, zero underflow, clamp edges, stale load identity, unreachable
edges, initialized masks, exact asset identity/extents, mirrors, all observer barriers, flags and
all uses including terminators. Add adversarial long-chain/large-CFG controls without noisy time
thresholds; prove work bounds and inspect actual allocations/scans in independent performance review.

Run the new directed package/root tests and frozen parent suite, existing byte-capture/forwarding
tests and pinned optimizer outputs. Run `yarn test:changed --host`, then `yarn test` before a green
commit. At phase closeout run install/build/typecheck and `yarn test:full` with serialized VICE.
Never use a passing subset or isolated rerun to claim the full gate passed. Hardware remains
unverified; entry-to-return cycles for a nonreturning loop remain Unknown, not zero.

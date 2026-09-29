# Testing Strategy: RD-05 CIA Timer and Interrupt Slice

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Coverage goal: every new public operation and constant has a source-level type/effect case; every ownership boundary has a positive and negative case; every device effect has an independent assembly expectation; and a simultaneous-source program runs on each of the four selected profiles. These are behavior goals, not an invented percentage gate. Specification tests precede implementation and are immutable oracles (AR-P1–AR-P7).

Test fixtures use existing compiler service and VICE helpers. No CIA simulator, general hardware harness, or CI tier is introduced. VICE runs are sequential and qualify only their configured model; revision-sensitive CIA edges remain for targeted physical QA (AR-P2–AR-P3).

## Specification Test Cases

The source fragments below are inserted in otherwise valid minimal programs selecting the stated profile. A “selected output” is the compiled 6510 instruction stream, not a host-language mock. Runtime observations are independent of emitted-instruction assertions.

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-1 | On each of the four cooperative profiles, use every named CIA1 constant and call both `c64.cia1.readTimerACounter()` and `c64.cia2.readTimerBCounter()` in a `word` expression. | All names resolve with the specified byte/word types; no runtime helper or CIA state change is introduced by the counter reads. | AR-P1, AR-P5, AR-P7; 03 §Source API |
| ST-2 | Compile a CIA1 A counter read and a CIA2 B counter read. | Selected volatile reads are `$DC04` then `$DC05`, and `$DD06` then `$DD07`, with a `word` result in low/high order; no `$DC0D`/`$DD0D` read. | R5.20; AR-P5; 03 §Device Effects |
| ST-3 | A counter is running while `readTimerACounter()` executes across a decrement. | The result is the low-then-high pair actually observed; no atomic-snapshot promise, retry, interrupt mask, or extra device read appears. | R5.20; AR-P5; 03 §Device Effects |
| ST-4 | Under a proved exclusive CIA1 IRQ route, write A/B latches with a `word` while stopped, then while running, and issue `configureTimerA(timerLoad | timerStart)`. | Each latch write is low then high; stopped high write loads the counter, running high write only updates the latch, and the later LOAD write transfers the latch once. | R5.20/AC-16; AR-P5–AR-P6; 03 §Device Effects |
| ST-5 | With nonzero CRA serial/TOD/PB6 fields and nonzero CRB TOD/PB7 fields, call `configureTimerA(timerStart | timerLoad)` and `configureTimerB(timerStart | timerBCountAUnderflows)`. | Exactly one read and one write per control register; unrelated fields retain their old bits, A selects PHI2, B selects A-underflow, and LOAD does not persist on readback. | R5.20/AC-16; AR-P6–AR-P7; 03 §Device Effects |
| ST-6 | Call `configureTimerA($20)`, `configureTimerB($20)`, or `configureTimerA($02)` with constant unsupported CNT/port bits; call `configureTimerA(dynamicByte)` where the byte contains `$FF`. | Constant calls report source-linked E10278; the dynamic call writes only the safe timer-owned flags and cannot select CNT or PB6 output. | AR-P6–AR-P7; 03 §Source API |
| ST-7 | Call CIA2 latch/configuration/mask/ICR-read operations under a cooperative profile, while CIA2 counter reads remain in the program. | Each state-changing or consuming call reports E10278 at its call site; counter reads remain admitted; no `$DD0D` read/write is emitted. | AR-P3–AR-P5; 03 §Source API |
| ST-8 | Call CIA1 configuration or `readAndClearPendingSources()` with only `setIRQ(&handler)`, no installer, or a restored exclusive installer; compare a live `setIRQExclusive(&handler)` route. | Unproved/chain/restored paths report E10278; the live exclusive path is admitted, including a helper called from that path. | R5.15–R5.17; AR-P3–AR-P4; 03 §Ownership and Integration |
| ST-9 | After exclusive installation, use `enableInterruptSources(sourceTimerA)` before any full disable, versus `disableInterruptSources(sourceAll)` followed by enabling Timer A/B; include branch joins with unequal mask state. | The first enable and uncertain join report E10278; full disable establishes known mask and later timer-only enables are admitted. No ICR read is used to infer the mask. | R5.17/R5.20; AR-P3, AR-P7; 03 §Ownership and Integration |
| ST-10 | Use constant `enableInterruptSources(sourceTimerA | sourceTimerB)` and `disableInterruptSources(sourceAll)`; pass `sourceIrq` or a TOD/serial/FLAG bit to enable; pass a runtime byte containing `$FF` to each operation. | Constant valid calls write `$83` and `$1F` once to `$DC0D` with no read. Invalid constant enables report E10278. Runtime enable/disable masks only `$03`/`$1F`, respectively, before the one write. | R5.20/AC-16; AR-P3, AR-P7; 03 §Device Effects |
| ST-11 | Cause Timer A and B pending bits to coexist, stop both timers, call `pending = c64.cia1.readAndClearPendingSources()`, and test both `sourceTimerA` and `sourceTimerB` in ordinary source branches. | One `$DC0D` read returns both pending bits (plus `sourceIrq` if either enabled); both branches can run; a later explicit read sees cleared latches. No compiler-invented second read or branch checker. | R5.20/AC-16; AR-P3; 03 §Device Effects |
| ST-12 | Establish known mask, then make a raw/opaque write that may hit CIA1 ICR, or restore the exclusive vector while Timer B remains enabled. | The known-mask/route proof is invalidated and a subsequent unsafe operation or unowned enabled route reports E10278; no automatic device restoration is emitted. | R5.16–R5.17; AR-P3–AR-P4, AR-P7; 03 §Ownership and Integration |
| ST-13 | Compile the constant/simple cases in 03 §Lowering and Cost. | Instruction selection, volatile read/write count and order, bytes/cycles, SFA scratch and stack agree with those independent expert expectations; no helper, mask read, table or copy is added. | R5.20/R5.47–R5.56; AR-P3, AR-P5–AR-P7; 03 §Lowering and Cost |
| ST-14 | Run a timer/ICR program on PAL/NTSC × 6581/8580 selected profiles, using the existing sequential VICE path. | Each run observes latch/load, timer A/B pending bits, one ICR clear, and preserved unrelated control bits; the result is reported `VICE-verified / hardware-unverified`, not generalized to every CIA revision. | AC-16; AR-P1–AR-P3; 03 §Authority and Uncertainty |

## Test Files and Order

| Tier | Planned file | Cases |
|---|---|---|
| Specification | `test/rd05/cia-api.spec.test.ts` | ST-1–ST-7 |
| Specification | `test/rd05/cia-ownership.spec.test.ts` | ST-8–ST-12 |
| Specification | `test/rd05/cia-output.spec.test.ts` | ST-2, ST-5, ST-10, ST-11, ST-13 |
| Specification / VICE | `test/rd05/cia-vice.spec.test.ts` | ST-4, ST-11, ST-14 |
| Implementation | `packages/compiler/src/semantic/cia-ownership.impl.test.ts` | Join/loop/alias facts and stable source spans after implementation |
| Implementation | `packages/compiler/src/machine/cia-operations.impl.test.ts` | Dynamic scratch, volatile effects, and selected instruction accounting after implementation |

The implementation tests may inspect internals; specification tests may use only the source contracts and expected observations above. A pre-existing test may change only if its old expectation demonstrably contradicts this approved contract, and the exact change must be reported before editing it. No blanket golden rewrite is authorized.

## Verification

During tasks, run directed Vitest cases and affected package typechecks. At the phase checkpoint run the already-approved `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, and `yarn test`; run VICE cases sequentially (AR-P2). Check touched-file Prettier, independent behavior and assembly/cost oracles, frozen `spec/` and expert-skill diffs, and source-key/link integrity. E2E evidence uses the existing compiler-to-ACME-to-VICE path; no browser/server security test applies to a local compiler device API.

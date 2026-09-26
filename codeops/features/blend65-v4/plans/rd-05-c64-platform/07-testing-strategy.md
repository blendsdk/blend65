# Testing Strategy: RD-05 Stage A

> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P4–AR-P8

## Oracles and Coverage

Cover all four selected IDs, every new constant, each ordinary constant/import failure, both
video standards and SID values, unsupported IDs, evidence identity and owned process cleanup.
This is contract coverage, not a new percentage gate. Keep existing immutable tests unchanged;
new spec tests derive only from the frozen specification, component contracts and the cases below.

Use two independent expectations: language/hardware-derived values and observable effects;
and required assembly shape/storage/cost. Literal-substitution builds are additional comparative
evidence, not the sole behavior oracle. Do not import production fact rows to generate expected
values. A shared wrong table must not make the tests pass. No new test runner or benchmark
framework is needed (AR-P6/AR-P8).

## Specification Test Cases

Source fragments below live in otherwise valid modules/functions with `optimization: none`.
Each row is a test family; parameterize explicitly over the four IDs where stated. The spec
author receives the referenced component contract verbatim, plus existing public signatures,
without reading implementation logic. A preservation case may already pass during the red
session; record why. New capability cases must fail for the missing behavior, not a broken fixture.

### Frontend

| Case | Input / scenario | Expected output | Source |
|---|---|---|---|
| ST-1 | Select each of the four frontend IDs; enumerate new constants and existing operations. Also select `c64-pal-prg-kernal-9999` and a takeover ID. | Four complete profiles, exactly the 14 typed constant bindings/values in 03-01 §Source contract, stable qualified-name order and unchanged 17 operations. Rejected selections return E10279 with the requested ID and no profile. | R5.1–R5.3; 03-01 §Integration; AR-P4/AR-P7 |
| ST-2 | Use `c64.profile.rasterLines`, import it directly, and import it `as lines`; initialize three `word` constants. | All resolve to 312 on PAL, 263 on NTSC; no unavailable-module obligation. SID choice does not alter these values. | Chapter 10 §4; 03-01 §Source contract |
| ST-3 | A `comptime function lines(): word` returns an imported `rasterLines`; a constant calls it. Repeat with the qualified name. | Constant values are 312 / 263, with no runtime call or illegal runtime-read diagnostic. | Chapter 06 §13.1; 03-01 §Integration |
| ST-4 | Initialize a `word` constant with the full millihertz expression in 03-01, and another with `cpuClockKilohertz`; evaluate for both video standards. | Millihertz 50124 / 59826 and clock class 985 / 1022. Constant intermediates are not prematurely wrapped to 16 bits. | Chapter 02 TS-18; 03-01 §Source contract |
| ST-5 | In separate valid functions, assign `c64.profile.rasterLines = 1` or take `&c64.profile.rasterLines`; repeat via import alias. | E10192 / E10040 respectively, with the offending source span; no address or mutable cell is allocated. | Chapter 03 §§2.2, 4.1; 03-01 §Diagnostics and compatibility |
| ST-6 | Declare `const lines: byte = c64.profile.rasterLines`, then a separate valid case using `word`. | Byte case: E10084 on both standards (312 and 263 exceed 255). Word case: complete with the exact selected value. | Chapter 02 TS-18; 03-01 §Diagnostics and compatibility |
| ST-7 | Independently import nonexistent `missing` from `c64.profile`; import two members with the same alias; define a source member at `c64.profile.rasterLines`. | E10012 for missing export; E10003 for each name collision. No silent overwrite of a profile/source binding. | Chapter 10 §4.3; 03-01 §Integration |
| ST-8 | Import `rasterLines as lines`; inside a child block declare local `lines: word = 7`; read qualified `c64.profile.rasterLines` too. | Local read is 7; qualified read is 312 / 263; after the block the alias has its original profile value. | Chapter 03 scoping; 03-01 §Integration |
| ST-9 | Analyze PAL→NTSC→PAL snapshots and two concurrent PAL/NTSC analyses using the public frontend boundary. | Each result contains its own exact facts and diagnostics; no reused PAL/NTSC state. Existing frontend import-boundary tests remain green. | 03-01 §Integration; AR-P6/AR-P7 |
| ST-10 | Under NTSC, put `const tooLarge: byte = 300` inside `if (c64.profile.isPal)`. | E10084 still occurs. Profile constants do not make invalid source legal or act as a preprocessor. | Chapter 02 TS-18; 03-01 §Source contract |
| ST-11 | On each profile, use an unencodable character with `screen_codes`, and in a separate fixture call the unavailable resident `c64.loader.load`. | E10249 / E10275 respectively; existing proof spans/canonical records remain, and diagnostic context identifies the actual profile rather than hardcoded PAL. | R5.48; 03-01 §Diagnostics and compatibility; AR-P7 |
| ST-12 | Call `firmwareVectorSink` for `$0314`, `$0318` and `$0400` on each admitted ID, plus `null` profile. | Admitted IDs give `c64.system.setIRQ`, `c64.system.setNMI`, `null`; null profile gives `null`. This adds no positive NMI-safety result. | Frozen appendix §9.2; 03-01 §Diagnostics and compatibility |

### Build and Generated Output

| Case | Input / scenario | Expected output | Source |
|---|---|---|---|
| ST-13 | Backend-select each Stage A ID, a takeover ID, the D64 ID, `c64-pal` and an ID containing shell metacharacters. | Only the four Stage A IDs succeed, with matching machine/storage IDs and common CPU/assembler/PRG/resource facts. Others fail E10279 without fallback or process execution. Manifest inventory remains nine IDs. | R5.1–R5.2; 03-02 §Selected identities |
| ST-14 | Compile known profile-dependent `if`, conditional, `switch` and false-loop cases. Selected paths write a fixed marker; dead paths have distinguishable writes and calls. | Only selected writes/calls exist after mandatory lowering; a false-loop body contributes none. No runtime profile test, dead helper reachability or dead-path SFA home. All source remains type checked. | R5.3; 03-01 §No runtime cost |
| ST-15 | Build one profile-fact program and the same program with facts replaced by independent literal values, on the same target. Exercise every constant and a selected volatile store. | Equal emitted program bytes/cost after symbol-name normalization where needed, equal RAM/ZP/stack demand, no storage or initialization for profile constants. Independent assembly expectation: straight-line selected store, zero profile-test/dispatch instructions and zero dead-call instructions. Behavior expectation: exactly the selected value/store count, independent of either build. | R5.3, R5.13, R5.50; 03-01 §No runtime cost |
| ST-16 | Fresh-build the same source in sequence for PAL/6581, NTSC/8580 and PAL/6581; validate each public evidence record and target override. | Exact selected identity survives check/build/evidence; version-1 closed keys remain unchanged; input identity reflects target changes. Same inputs reproduce artifacts. Artifact bytes may legitimately match across profiles when source has no differing behavior. | 03-02 §Evidence and failures; AR-P7 |
| ST-17 | On each profile, check an ordinary balanced mainline IRQ installation, an NMI installation and a handler-side IRQ installation. | Existing safe mainline IRQ case remains accepted; NMI and handler-side IRQ cases still fail E10245 before emission. No invented reentry bound or late function-storage allocation. | AR-P3; carried RD-04 AR-P16/AR-P17; 03-02 §Target and layout |
| ST-18 | Build an empty returning main and an explicitly initialized fixed-data program on each target. | PRG header is `$01 $08`, entry `$080D`, normal cooperative startup/return, common bounded layout and no recopy of bytes loaded at their destination. Existing PAL startup cost/state budget does not grow merely to select another profile. | Frozen appendix §5.1; R5.4; 03-02 §Target and layout |

### Emulator, Failure and Runtime Proof

| Case | Input / scenario | Expected output | Source |
|---|---|---|---|
| ST-19 | Interactive-run each target using a fake external VICE executable that records argv; include spaces/metacharacters in the literal PRG path. | Exact fixed selection arguments from 03-02 §Emulator launch, one unchanged PRG-path argument, no shell interpretation, correct pinned generation; result remains `interactive-unverified`. | R5.2; 03-02 §Emulator launch |
| ST-20 | Select NTSC/8580 for a fresh run, then alter the project target after build but before emulator launch; separately fail a new build while an old generation exists. | First run still launches its pinned NTSC/8580 result. Failed new build launches nothing and never runs the old generation. | 03-02 §Evidence and failures; AR-P7 |
| ST-21 | Cancel during probe/run; simulate spawn failure, nonzero exit and cleanup uncertainty using existing external-process fixtures. | Existing cancellation/start/runtime/recovery-required categories and pin-release/retention rules are unchanged; never claim verified execution. | 03-02 §Evidence and failures; AR-P8 |
| ST-22 | Resource-get replies contain `[1,4,3,0,0,0]`, a string-type payload, length 3, length 7, wrong value-length or a protocol error. | Valid payload returns 3; all malformed/error cases reject through the owned monitor error path. Only the five declared resource names can be requested. | 03-02 §Qualification; pinned VICE monitor protocol |
| ST-23 | In each of the four fresh VICE runs read active resources before program execution. | `VICIIModel` is 0 (PAL) / 3 (later NTSC); `SidModel` is 0 (6581) / 1 (8580); `CIA1Model=0`, `CIA2Model=0`, `KernalRev=3`. Executable and three ROM hashes match existing pins. Any mismatch makes qualification fail, not skip. | R5.2/R5.7; 03-02 §Qualification; pinned VICE model/VIC sources |
| ST-24 | Each fresh PRG writes selected raster lines and SID model to ordinary test memory and executes a profile-selected border store. Capture startup entry, main, restore and caller-return checkpoints. | Memory words are 312/263 and 6581/8580; selected border value is 6/2, with exactly one source-level store. At main: `D=0`, owned mapping bits `$06` and DDR bits `$07`. At return: captured owned ports/devices/vectors and I/D restored; SP equals entry SP + 2 modulo 256 after RTS. Initializers execute once; no data recopy; bounded run reaches caller return. | Frozen appendix §5.1; R5.3–R5.4; 03-02 §Qualification |
| ST-25 | Run the existing PAL M1 qualification with the unchanged two-argument/default helper calls. | The existing 441-input generated-versus-expert rendered journey and cleanup assertions remain green with their original meanings. | AR-P6/AR-P8; 03-02 §Qualification |

For ST-24 distinguish the one **source** border write from startup/restoration writes using
execution checkpoints; do not assert that the entire process touches that register only once.
Capture readable device masks according to the frozen contract, not undocumented hidden latches.
Record complete startup cost separately from the selected-body delta. This stage makes no new
cycle-stable raster, NMI, SID analog or physical-machine claim.

## Test Files and Fixtures

| Planned file | Coverage |
|---|---|
| `packages/compiler/src/frontend/profile-constants.spec.test.ts` | ST-1, ST-12 |
| `test/rd05/profile-constants.spec.test.ts` | ST-2–ST-4, ST-8–ST-9 |
| `test/rd05/profile-diagnostics.spec.test.ts` | ST-5–ST-7, ST-10–ST-11 |
| `packages/compiler/src/target/cooperative-profiles.spec.test.ts` | ST-13 |
| `test/rd05/profile-output.spec.test.ts` | ST-14–ST-15 |
| `test/rd05/profile-pipeline.spec.test.ts` | ST-16, ST-18 |
| `test/rd05/profile-interrupts.spec.test.ts` | ST-17 |
| `packages/compiler/src/services/vice-profiles.spec.test.ts` | ST-19–ST-21 |
| `test/rd05/vice-resource.spec.test.ts` | ST-22 |
| `test/rd05/profiles-vice.spec.test.ts` | ST-23–ST-24 |
| Existing `test/m1/vice.spec.test.ts` | ST-25; do not edit |
| `packages/compiler/src/frontend/profile-constants.impl.test.ts` | Shared-fact immutability, stable bindings and null/unknown selection internals |
| `packages/compiler/src/target/cooperative-profiles.impl.test.ts` | Machine/storage fact agreement and startup-certificate rejection |
| `packages/compiler/src/services/vice-profiles.impl.test.ts`, `test/rd05/vice-resource.impl.test.ts` | Argument assembly, resource transport and owned-process error edges |

One small `test/rd05/profile-fixture.ts` may create/clean a real temporary project for the new
root tests, following the existing `test/rd04/diagnostic-fixture.ts` pattern and accepting an
explicit target. It is test data setup, not a runner. Keep independent expected values in the
tests. Use the compiler's public package exports from root tests; no relative `src`/`dist`
cross-package imports. Existing diagnostic fixtures and immutable tests stay untouched.

Mock only real external process failures and monitor transport responses. Build/semantic/layout
tests use real compiler objects; final runtime tests use actual ACME and the pinned VICE.
Authentication, HTTP rate limiting, secrets, database and new infrastructure controls are N/A:
this is a local compiler change with no such product surface. Closed IDs, fixed argv, literal
paths, bounded binary input, snapshot isolation and cleanup are the applicable security checks.

## Verification Commands

AR-P8 uses the repository's established commands. From the repository root:

```sh
yarn install --frozen-lockfile
yarn build
yarn typecheck
yarn test
yarn prettier --check <explicit-touched-files>
```

During a phase, run only its new directed tests and affected existing suites. For workspace
tests use `yarn workspace @blend65/compiler test <src/path.spec.test.ts>`; for root tests use
`yarn vitest run <test/path.spec.test.ts>`, after `yarn build` supplies fresh public declarations.
The exact new paths are in the table above. Never run emulator suites concurrently.

Before each phase checkpoint, run the full command set, verify the frozen specification/expert
paths are unchanged, and complete the quality review required by the execution plan. No new
lint command, CI tier, coverage framework or host requirement is introduced. A final Stage A
handoff records real results and the unresolved full-RD obligations, not a blanket RD closeout.

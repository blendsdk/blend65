# Current State — Takeover Implementation Seams

> **Updated**: 2026-11-12
> **Baseline**: `11cef459` (v4 production approval); clean tree

## Closed profile inventory

| Location | Current fact |
|---|---|
| `packages/compiler/src/project/manifest.ts:21–30` | Nine recognized IDs: four cooperative PRG, four takeover PRG, one PAL D64. The manifest already accepts all nine. |
| `packages/compiler/src/profile/c64-kernal.ts:2–7` | `C64KernalProfileId` contains only the five executable IDs. |
| `packages/compiler/src/profile/c64-kernal.ts:38–109` | `C64_KERNAL_PROFILES` contains five rows; no ownership field. |
| `packages/compiler/src/target/profile.ts:198–208` | `PROFILES` is composed only from `C64_KERNAL_PROFILES`. |
| `packages/compiler/src/target/profile.ts:216–228` | Unknown ID returns `E10279` "not a complete qualified profile ID". This is the current takeover rejection. |
| `packages/compiler/src/frontend/profile.ts:442–475` | Frontend selection also uses `C64_KERNAL_PROFILES`; an unknown ID returns `E10279`. |
| `packages/compiler/src/frontend/profile.ts:411–436` | Constants hardcode `hasRawInterrupts=false` and `usesKernal=true`. |

## Target and machine facts

| Location | Current fact |
|---|---|
| `packages/compiler/src/target/c64-kernal.ts:4–67` | One machine fact table with VIC/screen/sprite/CIA addresses. No ownership, mapping or raw-vector field. |
| `packages/compiler/src/target/c64-kernal.ts:94–105` | Shared resource budgets; stack warning 188. |
| `packages/compiler/src/target/c64-kernal.ts:140–151` | Machine identity is `c64-{video}-kernal-901227-03-{sid}`. |
| `packages/compiler/src/target/profile.ts:95–109` | `COMMON_PROFILE.storage.hardwareStackReserve` is fixed at 20; takeover must be 0. |
| `packages/compiler/src/target/profile.ts:110–194` | Interrupt variants and sinks are the four cooperative KERNAL routes; vectors are `$0314/$0318`. |

## Startup and return

| Location | Current fact |
|---|---|
| `packages/compiler/src/layout/startup.ts:57–59` | The frozen 12-byte `$0801` BASIC stub. |
| `packages/compiler/src/layout/startup.ts:209–650` | One cooperative constructor: saves caller state, masks CIA2 VIC-bank bits, sets `$01/$00` cooperative mapping, initializes, runs `main`, restores caller state and `RTS`. No raw vector installation. |
| `packages/compiler/src/layout/startup-status.ts:12–83` | Save offsets and policies; `full` captures A/X/Y/status/stack and VIC state, compact forms capture only mapping bytes plus borrowed BASIC bytes. |
| `packages/compiler/src/layout/startup.ts:118–166` | `bindC64StartupState` closes the saved-state object and borrowed zero-page bytes into final SFA homes. |
| `packages/compiler/src/machine/lower.ts:566–576` | Every lowered program calls `createC64Startup`; there is no ownership dispatch. |
| `packages/compiler/src/machine/lower.ts:682–690` | The startup state object is created from `c64Startup` configuration only. |
| `packages/compiler/src/layout/c64-layout.ts:226` | Layout rebinds startup state after allocation. |
| `packages/compiler/src/services/size-observers.ts:179–254` | Startup code and saved state may not overlap the BASIC ROM window `$A000–$BFFF` when banking is restored. |

## Interrupt ownership and lowering

| Location | Current fact |
|---|---|
| `packages/compiler/src/semantic/interrupt-ownership.ts:189–202` | Recognizes only `setIRQ`, `setIRQExclusive`, `setNMI`, `setNMIExclusive`, `restoreIRQ`, `restoreNMI`. |
| `packages/compiler/src/semantic/interrupt-routes.ts:46–65` | Rejects every non-self-masking unbounded route except cooperative NMINV. |
| `packages/compiler/src/semantic/cia-ownership.ts:271–300` | Treats `setIRQExclusive` as the exclusive CIA1 owner; `setIRQ` as chained. |
| `packages/compiler/src/semantic/cia-ownership-facts.ts:28–34` | Initial CIA1 state: unknown mask, possible sources `$1F`, stock predecessor true. |
| `packages/compiler/src/semantic/cia2-ownership.ts:45–57` | Only `c64_kernal_nminv_exclusive` is an exclusive CIA2 owner. |
| `packages/compiler/src/storage/nmi-private-storage.ts:13–57` | Final no-private-home proof for any selected NMI route. |
| `packages/compiler/src/machine/lower-c64-interrupt.ts:250–475` | Vector transaction lowering; hardcodes `$0314/$0318` restore vectors and cooperative CIA1/CIA2 handbacks. |
| `packages/compiler/src/machine/lower-c64-interrupt.ts:105–236` | Raw/compiler-save wrapper builder; already supports `registerSaveOwner: "compiler"` and `terminal: "rti"`. |
| `packages/compiler/src/machine/lower-c64-interrupt.ts:38–47` | `RAW_HANDLER_ENTRY` is a CPU-entry ABI shell with six stack bytes and an `RTI` terminal. |
| `packages/compiler/src/layout/c64-layout-placement.ts:4–5,68–102` | Existing low-byte `$47` matching mechanism for NMI publication entries. |
| `packages/compiler/src/layout/c64-layout.ts:347–415` | Layout aligns `nmiPublicationEntry` functions to low `$47`, or adds a three-byte adapter. |

## Evidence, tooling and tests

| Location | Current fact |
|---|---|
| `packages/compiler/src/services/vice.ts:284–363` | `launchVice` accepts only cooperative facts; no raw mode concept. |
| `test/m1/vice-runtime.ts:240–282` | `viceLaunchArguments` accepts only the four cooperative IDs and throws for any other. |
| `test/m1/vice-runtime.ts:310–328` | `startVice` performs the same cooperative-only check. |
| `test/rd05/profiles-vice.spec.test.ts` | Four cooperative profiles, execute checkpoints, caller-return proof, exact state comparison. |
| `test/rd05/profile-pipeline.spec.test.ts:133–176` | Asserts nine manifest IDs but only four buildable profiles. |
| `test/rd05/profile-fixture.ts` | Real project/build/fixture helper used by the profile matrix. |
| `docs/releases/v4-production-qualification.md` | Approved statement covers four KERNAL PRGs plus one D64; takeover rows are `Unknown`. |

## Test and tool baseline

- Compiler package: 218 files / 3,683 passed / 2 skipped at the release boundary.
- Root suite: 6,570 passed / 4 skipped plus one corrected docs oracle.
- VICE: `/home/gevik/.local/bin/x64sc`, VICE 3.10, SHA-256
  `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`.
- ACME: `/usr/bin/acme` 0.97.
- `spec/` is clean and must stay clean.

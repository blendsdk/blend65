# Cooperative Pipeline: RD-05 Stage A

> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P3–AR-P8

## Selected Identities

The executable allowlist is exactly the following four complete IDs. Selection is exact and
case-sensitive; no independent user switches compose a target (AR-P4/AR-P7).

| Complete ID | Machine identity | Video | SID |
|---|---|---|---|
| `c64-pal-prg-kernal-6581` | `c64-pal-kernal-901227-03-6581` | PAL | 6581 |
| `c64-pal-prg-kernal-8580` | `c64-pal-kernal-901227-03-8580` | PAL | 8580 |
| `c64-ntsc-prg-kernal-6581` | `c64-ntsc-kernal-901227-03-6581` | Later NTSC | 6581 |
| `c64-ntsc-prg-kernal-8580` | `c64-ntsc-kernal-901227-03-8580` | Later NTSC | 8580 |

The manifest's nine-ID inventory stays unchanged. The four takeover IDs and the D64 ID remain
recognized by project loading but unavailable to this executable stage. Profile-independent
frontend analysis retains its existing contract; it does not grant executable support.

## Target and Layout

Use the pure facts from [03-01 — Integration](03-01-profile-facts.md#integration) in
`target/profile.ts`. Widen `TargetProfile.id`, its `storage.profileId` and machine identity
without widening selection to arbitrary strings. Rename the existing machine-facts file to
`target/c64-kernal.ts`, update its two production consumers (`target/profile.ts` and
`services/resource-diagnostics.ts`), and generalize the immutable machine facts to these four
identities. Keep CPU, serializer and packager independently typed. No compatibility re-export
file is needed: the old internal module is not a public entry or imported by existing spec tests.

All four retain NMOS 6510, ACME 0.97, CBM PRG, pinned KERNAL 901227-03 and the common
cooperative memory/ownership contract in the frozen appendix §§5.1, 9.1 and 10. Only the video
and SID dimensions vary; no C64C-board, early-NTSC, expansion, raw-vector or silicon-wide claim
is introduced. Machine raster/frame facts must agree with the source facts.

Preserve the current addresses, resident range `$0801..$CFFF`, 51199-byte shared code/data/BSS
budget, 142 program zero-page bytes, hardware-stack capacity and existing firmware reserve.
Keep the current frame-wait boundary `$FB`, which is within both selected raster geometries.
This is an existing frame observation operation, not a new stable-raster timing proof.

Replace the single-ID guards in `layout/startup.ts`, `layout/c64-layout.ts` and
`artifacts/acme-validate.ts` with the closed cooperative-family predicate (PF-001). The last is
the independent terminal admission check called by `acme-serializer.ts`; it is not the public
build-evidence validator. Retain its ACME 0.97/CBM PRG checks, closed certificate and exact
certificate/target identity agreement, legal-machine checks and layout validation. ST-18 must
exercise actual serialization for every admitted ID. Task 2.3.1 owns focused negative
certificate/format checks in the already planned implementation-test file; existing tests stay
unchanged. Preserve startup/return behavior: BASIC `SYS` entry, captured `$0000/$0001` handling, BASIC-out/KERNAL-and-I/O-in
mapping, binary arithmetic, declared device state, language-required initialization and ordinary
return restoration. Initialized payload already loaded at its destination is never recopied.
Do not introduce SID initialization merely because a SID model is now selectable (AR-P4/AR-P6).

The existing interrupt sink facts are shared unchanged. A four-profile table is not a proof of
finite NMI or handler-side IRQ safety. Preserve E10245 on those routes and preserve the existing
mainline IRQ ABI/storage/chain semantics. No bank state, enabled source or ownership mechanism
is added. AR-P3 still gates any work needing the missing positive NMI proof.

## Evidence and Failures

Keep manifest and public build-evidence version 1 unchanged (AR-P7). Existing target fields
carry the exact `profileId`, `cpuId`, `emitterId` and `packagerId`; existing machine/layout and
resource records retain their shapes. Do not add parallel JSON reports or migration machinery.
Artifact hashes and the existing selected-target snapshot identify each fresh result. Identical
source on different profiles cannot reuse stale profile facts or an earlier run generation.

Unknown/unsupported profile selection remains E10279 with the exact requested ID and the
deterministic four-ID allowlist. Resource failures retain their current codes and measured versus
available quantities, naming the actual selected profile. Preserve existing publication, pin,
cancellation and process-cleanup classifications. A failed profile build must not publish or run
an older generation. No successful artifact is relabeled as another target.

## Emulator Launch

Carry `profileId: C64KernalProfileId` in the private `PreparedBuild` result in `services.ts`,
copied from the checked target which produced that generation. Pass it to
`launchVice(executable, prg, profileId, signal?)` in `services/vice.ts`. This internal signature
is not a public CLI/API change. Resolve only the closed four-row facts; do not reload a manifest
or use a global last-selected target after pinning (AR-P6/AR-P7).

The fixed argument mapping follows. Use argv with `shell: false`, `-default` first, and the
existing owned-process lifecycle. These are internal derived settings, not new user switches.

| Video/SID | Fixed selection arguments |
|---|---|
| PAL / 6581 | `-model c64 -pal -VICIImodel 6569 -sidmodel 0 -ciamodel 0` |
| PAL / 8580 | `-model c64 -pal -VICIImodel 6569 -sidmodel 1 -ciamodel 0` |
| NTSC / 6581 | `-model ntsc -ntsc -VICIImodel 6567 -sidmodel 0 -ciamodel 0` |
| NTSC / 8580 | `-model ntsc -ntsc -VICIImodel 6567 -sidmodel 1 -ciamodel 0` |

Do not substitute the C64C/new-NTSC presets to change SID: those also change CIA/board assumptions.
This fixed-model mapping is grounded in the pinned VICE 3.10
[command options](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/c64/c64-cmdline-options.c)
and [model definitions](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/c64/c64model.c).
Interactive runs retain their existing `interactive-unverified` result; launching alone is not
runtime qualification.

## Qualification

Extend the existing test helper to
`startVice(prgPath, maximumCycles = 100_000_000, profileId = "c64-pal-prg-kernal-6581")` with
the same closed profile type and fixed argument mapping. Existing two-argument calls retain
their meaning. Keep executable/ROM hashes, loopback monitor attestation, time limits, cleanup and
sequential ownership. Apply explicit pinned ROM paths **after** the model preset so the preset
cannot overwrite them. This is a bounded existing-helper change, not a new runner (AR-P8).

Add one test-only monitor method:
`readIntegerResource(name: "VICIIModel" | "SidModel" | "CIA1Model" | "CIA2Model" | "KernalRev"): Promise<number>`.
It sends resource-get command `0x51` with byte-length-prefixed ASCII, checks the existing
response/error envelope, and accepts exactly a six-byte payload: integer type `1`, value length
`4`, then a little-endian 32-bit value. Reject wrong types, short/oversized data and transport
errors. Add no resource setter or generic configuration layer. The exact wire shape is in the
pinned [monitor implementation](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/monitor/monitor_binary.c).

At startup, assert actual resource values against the independent ST-23 table. The PAL/later-NTSC
VIC enum values are defined in pinned
[vicii.h](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/vicii.h).
Requested flags alone are not sufficient proof of active settings.

Each profile gets a fresh build, ACME assembly, PRG and bounded VICE run. Use existing labels,
memory/IO reads, CPU state and checkpoints to observe startup, constant results, branch effects
and normal return. Test setup may set captured ordinary CPU/owned-device state before entry;
do not introduce an NMI source or a raw interrupt route. Preserve the M1 441-input PAL journey
unchanged. Missing/mismatched tools yield Unknown/failed qualification, never a skipped green
claim. Report `VICE-verified / hardware-unverified` only after the tests actually pass.

Store observations in the existing test assertions/output and the Stage A handoff: profile,
artifact hash, pinned executable/ROM identity, active resources, entry/exit state and stop reason.
No persistent test-result schema is added. Native Windows and physical QA remain RD-10.

## Review and Output Quality

ST-13–ST-25 own the expected results. Independent review must check the target/constant
agreement, closed frontend boundary, process identity and unchanged interrupt safety. Compare
emitted profile-driven code with both the independent semantic oracle and literal-program
assembly/cost expectations. No extra startup, SFA, ZP, stack or runtime-dispatch cost is permitted
for exposing facts. Existing measured parity debt stays visible; any new meet-only result must
have the project-required measured, actionable issue rather than a silent quality waiver.

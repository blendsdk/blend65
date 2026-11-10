# Artifact, Publication, and Run: RD-07 Loadable Assets and D64 Delivery

> **Document**: 03-06-artifact-publication-and-run.md
> **Parent**: [Index](00-index.md)

## Overview

This component makes `c64-pal-d64-kernal-6581` an executable target, publishes the D64 as the one
primary artifact inside the existing immutable generation, and binds `blendc run` to that exact
fresh image. It reuses RD-02's staging, lock, current-record, predecessor, pin, and cleanup model.

## Architecture

### Current architecture

`TargetProfile` is composed from four PRG profile rows; `PackagerFacts` is always `cbm-prg`
(`target/c64-kernal.ts:76-87`, `target/profile.ts:95-120`). ACme produces `<name>.prg` and the
publication path requires `package.kind: "prg"` (`publication/current-record.ts:290`). `runProject`
builds with `pinForRun: true`, requires the pin, and launches `x64sc` with `-autostart <prg>`
(`services/services.ts:802-860`, `services/vice.ts:259-285`).

### Proposed changes

1. Add the D64 profile row and `cbm-d64` packager facts.
2. After ACME verifies the boot PRG, run the packager and add the `.d64` to the generation.
3. Extend `evidenceAgrees` and the producer to accept `package.kind: "d64"`.
4. Extend the launch path to attach the image as drive 8 and autostart its first entry.

## Implementation Details

### Profile composition

```ts
/** Packager facts for the one qualified disk profile. */
export interface D64PackagerFacts {
  readonly id: "cbm-d64";
  readonly bootLoadAddress: 0x0801;
  readonly startupAddress: 0x080d;
  readonly residentStart: 0x0801;
  readonly residentEnd: 0xcfff;
  readonly imageBytes: 174_848;
  readonly tracks: 35;
  readonly dataBlocks: 664;
  readonly directoryEntries: 144;
  readonly allocationPolicyId: "cbm-dos-1541-interleave-v1";
}
```

`TargetProfile.id` widens to `"c64-pal-d64-kernal-6581" | C64KernalProfileId`.
`C64_KERNAL_PROFILES` gains one row with the PAL/6581 timing and SID facts and a
`profileKind: "d64"` discriminator. `PROFILES` composes it with `CBM_D64` and the same machine,
storage, and interrupt facts. `selectTargetProfile` and `selectC64KernalFacts` admit it exactly and
still reject every partial/unknown ID with E10279.

### Build order

```text
frontend -> semantic -> whole-program -> storage -> machine -> layout
  -> ACME boot PRG verification
  -> D64 packager (boot PRG + reachable units)
  -> sidecars (.asm/.labels/.assets/.memory/.costs/.debug)
  -> .build.json (D64 package)
  -> publish immutable generation
```

The boot PRG remains the ACME output and is not re-emitted. The packager receives the verified boot
PRG bytes, the reachable unit records, the project name, and the semantic-input hash. It returns the
image and component facts. No host file is read by the packager.

### Generation contents

The generation still contains exactly eight files:

| File | Contents |
| ---- | -------- |
| `<name>.d64` | Primary artifact, 174,848 bytes |
| `<name>.asm` | Boot resident assembly |
| `<name>.labels` | Boot ACME symbols |
| `<name>.assets.json` | Resident and loadable asset records |
| `<name>.memory.json` | Resident, loader, destination, and state views |
| `<name>.costs.json` | Resident, loader, disk, and call-site costs |
| `<name>.debug.json` | Boot and contained load-unit records |
| `<name>.build.json` | Hashes, semantic inputs, package record |

The boot PRG and unit files are contained components, not separate advertised products. They are
not written as standalone generation files.

### Publication

`prepareEvidence` writes the `.d64` and sidecars; `.build.json` is written last. `publishGeneration`
keeps the existing staging/rename/current-record/lock/pin/predecessor rules. `evidenceAgrees` gains
a D64 branch:

- `package.kind === "d64"`;
- `package.artifactPath === primary.path`;
- `package.imageBytes === 174848`;
- `package.dosType === "2A"`;
- every component resolves to a contained file and its exact chain;
- `debug.value.primaryArtifact` is the `.d64`;
- the sidecar references agree.

Any failure or pre-commit cancellation leaves the prior current generation intact. A post-commit
cancellation retains the new generation and releases only its own pin. No stale or mixed artifact is
launched.

### `run`

`runProject` performs a fresh build in the same invocation and requests the pin. It never
re-resolves the current record after the build. For the D64 profile:

1. Verify the pinned generation's `.d64` and sidecar hashes.
2. Launch VICE only after the durable pin is visible.
3. Attach the image as drive 8.
4. Autostart the first boot entry under the exact `c64-pal-d64-kernal-6581` model.
5. On cancellation after commit, stop only the owned VICE/monitor work and release the exact pin.
6. On release failure, retain the pin and return `recovery-required` with a diagnosed cleanup.

The exact argv is fixed by a VICE 3.10 probe before implementation:

```text
x64sc -default -model c64 -pal -VICIImodel 6569 -sidmodel 0 -ciamodel 0
  -8 <generation>/<name>.d64
  -autostart <generation>/<name>.d64        # or the probed 8:<name> spelling
```

The probe records which spelling autostarts the first directory entry and returns to BASIC. No PRG
fallback is used.

### Failure identities

| Failure | Category | Stable code |
| ------- | -------- | ----------- |
| Build/source/compiler/assembler | existing | existing |
| D64 capacity/name/structure | `packaging` | `D64_CAPACITY` / `D64_NAME` / `D64_STRUCTURE` |
| Unsupported D64 profile | `source` | E10279 |
| Pin acquisition | `recovery-required` | `RUN_PIN` |
| Mount/autostart | `emulator-start` | `RUN_MOUNT` / `RUN_AUTOSTART` |
| Emulator runtime/timeout | `emulator-runtime` | `RUN_TIMEOUT` / `RUN_OBSERVATION` |
| Cancellation | `cancelled` | `SERVICE_CANCELLED` |
| Pin release/cleanup | `recovery-required` | `RUN_PIN_RELEASE` / `VICE_CLEANUP` |

## Integration Points

| Stage | Use |
| ----- | --- |
| Target selection | D64 row and `cbm-d64` packager |
| Build orchestration | Insert packager after ACME |
| Evidence | D64 primary and package record |
| Publication | D64 primary acceptance |
| VICE | Drive-8 mount and autostart |
| CLI | Same `build`/`run` commands; no new command |

## Error Handling

| Error case | Handling | AR Ref |
| ---------- | -------- | ------ |
| D64 profile selected with no loader use | Build a resident-only D64; no loader bytes | AR-P6 |
| Packager capacity/name/structure failure | No generation; prior current preserved | AR-P10, AR-P21 |
| Primary not `.d64` | Reject before publication | AR-P14 |
| VICE missing/wrong version | `tool-discovery` | AR-P15 |
| Mount/autostart failure | `emulator-start` with `RUN_MOUNT`/`RUN_AUTOSTART` | AR-P15 |
| Stale/mixed generation | Never launched; pin/identity check | AR-P15 |

## Testing Requirements

- Profile selection and D64 packager identity.
- Exact eight-file generation with `.d64` primary.
- Publication atomicity and prior-generation preservation.
- VICE argv probe and exact mount/autostart test.
- Build/pin/mount/runtime/cancellation/recovery failure separation.

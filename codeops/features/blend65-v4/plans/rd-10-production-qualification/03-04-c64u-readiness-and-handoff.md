# C64U Readiness and Handoff: RD-10

> **Document**: 03-04-c64u-readiness-and-handoff.md
> **Parent**: [Index](00-index.md)

## Overview

RD-10 proves that the shipped v4 architecture can accept a future C64 Ultimate target without
implementing it. Readiness is an audit of real seams, not a new abstraction layer. The handoff is a
discovery seed under the existing successor owner.

## Readiness gate

| # | Seam | Existing evidence to inspect | Pass condition |
| - | ---- | --------------------------- | -------------- |
| 1 | Language and semantic IR | `packages/compiler/src/frontend/`, `spec/` | No C64 address, VIC/SID/CIA, PRG, PETSCII, 1 MHz, or NMOS-only assumption changes ordinary meaning |
| 2 | CPU ownership | `packages/compiler/src/machine/` | Instruction legality, flags, cycles, and CPU identity are independent of devices and artifact format |
| 3 | Machine ownership | profile selection and machine contracts | Visibility, banking, devices, interrupts, reserved memory, and clocks belong to an exact profile |
| 4 | Serializer/packager ownership | `packages/compiler/src/artifacts/`, `packages/compiler/src/packaging/` | ACME text and PRG/D64 records are terminal components |
| 5 | Function storage | `packages/compiler/src/storage/` | SFA closes function execution storage only; globals, assets, banks, transfer storage, and packaging stay outside |
| 6 | Physical identity | `.debug.json`, `.memory.json`, diagnostics | Direct, banked, and transfer-only identity is representable without widening core `word` |
| 7 | Transfer effects | `packages/compiler/src/frontend/load-units.ts`, `test/rd07/` | Transfer source/destination, publication, clobbers, synchronization, bytes, and timing are explicit |
| 8 | Multiple clocks | profile/cost facts | CPU, video/bus, SID, serial/loader, and configurable clocks are distinguished |
| 9 | Device topology | audio/profile/asset evidence | SID/audio evidence can describe endpoint topology and deployment preconditions |
| 10 | Optimization | `packages/compiler/src/machine/` optimizer seams | Legality/cost accepts CPU, machine, address-space, transfer, clock, and scarce-resource facts without C64 hard-coding or runtime dispatch |
| 11 | Project/tooling | CLI/LSP/VS Code/evidence | Target/profile selection, artifacts, maps, debugger identity, and diagnostics can carry future facts through typed boundaries |
| 12 | Product honesty | manifest profile list and public docs | No selectable `c64u` ID, empty package, copied backend, fake emulator case, or support claim |

Each row records concrete files/types and at least one existing C64 consumer. Where future pressure
has no current consumer, the gate records the pressure and leaves the implementation absent. A failed
row is fixed in its owning v4 seam or recorded as an explicit blocker; it is not deferred as C64U
debt.

## C64 preservation

Every readiness correction must leave the eight C64 profiles' language behavior, final artifacts, and
expert parity intact. Do not add an indirect hot-path dispatch, generalized device layer, runtime
target probe, widened core `word`, universal address, or optional-target payload to C64 output.

## Handoff packet

Create `codeops/features/blend65-c64u/requirements/_draft/discovery-notes.md` with:

1. v4 candidate/specification/expert identities and passed readiness rows.
2. Retained C64 behavior and facts that must not be copied as Ultimate assumptions.
3. Pinned and still-required board, firmware, register, storage, artifact, emulator, and hardware
   sources.
4. Explicit unknowns for model/firmware, turbo modes and clocks, badline/external-device behavior,
   REU/DMA/stream transfer, CPU-visible and transfer-only storage, cartridge/package/startup,
   physical SID sockets, UltiSID mappings, and audio/video/debug streams.
5. Source-language, CPU, machine, serializer, packager, layout, optimizer, asset, debug, and tooling
   impact questions.
6. The five activation gates: frozen target-specific cases, expert semantic-version bump, complete
   affected/cross-domain qualification, dependent-impact review, and atomic single-version
   activation.
7. One smallest C64U-native vertical proof with exact deployment identity and no renamed C64 artifact.
8. Every transferred deferral, hardware limitation, expressiveness item, or parity debt with one
   named owner and reconsideration reason.

## Ownership

Keep `blend65-c64u/RD-01 — C64 Ultimate Target Family` as the named successor, dependent on RD-10.
Update its roadmap with the handoff artifact when RD-10 closes. Do not add a selectable C64U profile,
workspace package, feature flag, code stub, emulator case, or support statement in v4.

## Error handling

| Case | Handling |
| ---- | -------- |
| Seam has a hidden C64 assumption | Fix in the owning v4 file or record blocker |
| No current consumer for future pressure | Record the pressure; add no speculative abstraction |
| C64 artifact changes | Re-run affected C64 profile evidence |
| Handoff contains assumed behavior | Reject and replace with explicit unknown/source need |
| C64U package or target appears in v4 | Block product-honesty row |

# Requirements: RD-07 Loadable Assets and D64 Delivery

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-07](../../requirements/RD-07-loadable-assets-and-d64-delivery.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan

- R7.1–R7.8: truthful `loadable const` values, illegal resident use, destination compatibility,
  the direct `c64.loader.load` operation, publication through control flow, reachability, SFA
  separation, and resident/loadable distinction.
- R7.9–R7.17: the `c64-pal-d64-kernal-6581` profile, one primary D64, exact geometry, deterministic
  internal serialization, boot and unit entries, disk limits, directory integrity, and fresh `run`.
- R7.18–R7.26: the built-in KERNAL sequential transport, exact call contract, success validation,
  direct placement, machine-environment preservation, explicit quiescence, no hidden lifecycle, the
  trusted-media boundary, and application-owned recovery.
- R7.27–R7.35: joint transport/resident views, sequential reuse, several destinations, destructive
  overlap rejection, CPU/VIC visibility, publication timing, address/provenance preservation,
  explicit transfer effects, and closed allocation.
- R7.36–R7.46: the diagnostic boundary and developer-facing detail, complete disk/cost/memory
  evidence, independent codec and flow oracles, the final machine path, bounded hardware claims,
  impact-based verification, and deferral closeout.
- R7.47–R7.49: focused examples, tooling metadata handoff, and host responsiveness observations.

### Deferred / out of this plan

- Real-drive and physical-C64 qualification. RD-10 owns it; this plan records
  `VICE-verified / hardware-unverified` (AR-P20).
- Fastloader, compressor, drive code, staging buffer, hostile-media containment, and any loader
  strategy beyond `kernal-sequential-uncompressed`. RD-07's Won't Have section excludes them.
- Multiple disks, swap, writable files, REL/SEQ/USR, 40-track/G64/tape/cartridge/network, code
  overlays, runtime linking, D64 variants for NTSC/8580/takeover/C64U/X16/C128/Atari.
- A public loader plugin API, external packager hook, `c1541` dependency, VFS, asset manager, or
  game engine.
- A new diagnostic registry entry or a `spec/` edit. The frozen registry is used as-is (AR-P8).

## Plan-local decisions

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Destination candidate set | Static place, or fixed-array element with a runtime index whose every element is an exact-type candidate | AR-P3 |
| Publication fact | Sparse half-open ranges per binding plus proved must-alias propagation | AR-P4 |
| Quiescence proof | Reuse RD-05 LIFO IRQ/NMI ownership and audio route state | AR-P5 |
| Loader form | Inline SETLFS/SETNAM/LOAD per reachable call | AR-P6 |
| KERNAL workspace | Reserve the documented workspace; save/restore live program registers; report clobbers | AR-P7 |
| Diagnostic mapping | E10274/E10275/E10276/E10279 plus `D64_PROFILE`/`D64_NAME`/`D64_CAPACITY`/`D64_STRUCTURE` | AR-P8 |
| Disk label/ID | Deterministic PETSCII from project name and semantic hash | AR-P9 |
| Unit names | `L` + 12 uppercase identity hex; boot from project name | AR-P10 |
| Allocation | `cbm-dos-1541-interleave-v1`, measured before acceptance | AR-P11 |
| Fill | `$00` | AR-P12 |
| Packager location | `packages/compiler/src/packaging/d64/` | AR-P13 |
| Sidecar records | Existing version-1 families only | AR-P14 |
| `run` argv | Probe VICE 3.10, then freeze the exact drive-8/autostart form | AR-P15 |
| Native loadable assets | Allowed; remove the current E10204 loadable rejection | AR-P16 |
| Unit identity | Qualified declaration identity, not content hash | AR-P17 |
| Verification | Impact-based directed suites plus one RD-07 boundary and the AGENTS.md commands | AR-P18 |
| Expert baseline | Active `2.0.4`; HLE-010 already present | AR-P19 |
| Hardware boundary | VICE only; physical QA stays RD-10 | AR-P20 |
| Exact-fit boundaries | `$10000`, 664 blocks, 144 entries accepted; one beyond rejected | AR-P21 |
| Complexity | No escalation; all machinery is directly requested | AR-P22 |

## Acceptance Criteria

The RD owns its acceptance criteria. This plan adds only these execution-level criteria:

1. Every RD-07 `Must Have` and `Should Have` item is implemented or explicitly recorded as an
   RD-10-owned or Won't-Have boundary.
2. The independent D64 decoder never imports the production serializer.
3. `spec/` stays byte-identical to the frozen baseline.
4. `git status --porcelain spec/` is empty at every task completion.
5. The closeout records `VICE-verified / hardware-unverified` and the exact remaining debt.

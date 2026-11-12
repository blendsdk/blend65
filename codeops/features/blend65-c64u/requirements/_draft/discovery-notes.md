# C64 Ultimate Discovery Notes

> **Status**: Draft discovery seed — no C64U implementation
> **Owner**: `blend65-c64u/RD-01 — C64 Ultimate Target Family`
> **Source qualification**: `blend65-v4` RD-10
> **Created**: 2026-11-12

This packet records what the shipped v4 architecture can carry into a future C64 Ultimate
target and what still needs primary evidence. It is not a target definition, a support claim, or an
implementation stub.

## 1. Qualified v4 identities and readiness

| Fact | Value |
| ---- | ----- |
| Candidate code commit | `bb10e0d116d19a1d96f169a09d14f02ff0daa0f8` |
| Full specification corpus | 45 files; `BLEND65-SPEC-4-2ea3decf9362644b657e9d20ffeadb318028615958263147e579bfeeb5aada0e` |
| Normative specification | 18 files; `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b` |
| Expert skill | `2.0.4`; content commit `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15` |
| Qualified hosts | `linux/x64` only; Windows and macOS remain `Unknown` |
| Runtime oracle | VICE 3.10 `x64sc`; `VICE-verified / hardware-unverified` |
| Qualified C64 profiles | Four KERNAL PRG profiles plus one D64 profile |
| Deferred C64 mode | Four takeover profiles; `V4-TAKEOVER-1` |

Readiness rows 1–7 and 11–12 pass against real v4 types. Rows 8–10 pass at the seam level and
carry recorded future-pressure items listed in section 4.

## 2. Retained C64 behavior that must not be copied as Ultimate assumptions

- NMOS 6510 instruction behavior, 1 MHz nominal CPU clock, and the C64 memory map.
- VIC-II 6569/6567 video timing and the current VIC bank/visibility model.
- One SID at `$D400`, selectable 6581/8580 model, with no multi-SID or UltiSID topology.
- KERNAL `901227-03`, BASIC `901226-01`, and character `901225-01` ROM identities.
- `$0801` PRG load address, the cooperative startup/return contract, and BASIC `READY.` return.
- One 35-track D64 layout, trusted media, KERNAL sequential loading, and `HLE-010` disclosure.
- VICE 3.10 as the only runtime oracle; no physical C64 evidence exists.
- The four KERNAL profiles only. Takeover startup/return, raw vectors, and their bank rules remain
  unimplemented.

## 3. Sources still required

- C64 Ultimate board revisions, FPGA bitstream/firmware versions, and configuration modes.
- Official register maps for turbo modes, REU/DMA/stream transfer, cartridge/expansion, and
  CPU-visible versus transfer-only storage.
- Official startup, cartridge/package, and recovery behavior for each supported firmware family.
- Audio topology: physical SID sockets, UltiSID mappings, stereo/multi-SID addressing, and mixer
  behavior.
- Video and debug stream definitions, including any host-side capture protocol.
- Timing evidence for turbo clocks, badline behavior, external devices, and serial/loader paths.
- Physical C64, drive, SID, and C64U hardware for the affected claims.

Emulator behavior, community summaries, and v3 or C64 readiness snapshots are not primary
authority.

## 4. Explicit unknowns

| Area | Unknown |
| ---- | ------- |
| Model and firmware | Exact supported C64U models, firmware versions, and update behavior |
| Turbo | Legal turbo modes, clock ratios, switching rules, and their effect on CPU/video/SID/serial |
| Badlines and external devices | Badline timing under turbo, external cartridge and expansion behavior |
| REU/DMA/stream | Transfer sources, destinations, clobbers, synchronization, byte and timing cost |
| Storage identity | CPU-visible and transfer-only storage, bank identity, retention, and permissions |
| Cartridge/package/startup | Artifact format, load/start behavior, recovery, and deployment preconditions |
| Physical SID | Socket population, model detection, addressing, and analog behavior |
| UltiSID | Register mapping, topology, configuration, and mix behavior |
| Streams | Audio, video, and debug stream ownership, framing, and host integration |
| Host support | Windows/macOS user-host proof and C64U-specific discovery |

The three readiness pressure items map here: multiple clocks (row 8), device topology (row 9), and
bank/transfer optimizer costs (row 10). No speculative field or abstraction is added in v4.

## 5. Impact questions

- **Source language:** Does any ordinary construct need a C64U-specific meaning, or can the current
  target-neutral frontend remain unchanged?
- **CPU:** Which CPU modes are selectable, and how are legality, flags, cycles, and interrupts
  expressed without a runtime target probe?
- **Machine:** Which visibility, banking, MMIO, reserved-memory, and interrupt facts belong to the
  exact C64U profile?
- **Serializer/packager:** Is a C64U artifact a terminal serializer/packager component, and what
  replaces ACME/PRG/D64 where needed?
- **Layout:** Can banks, cartridges, loaders, and transfer-only storage be placed without widening
  the core `word` or adding hot-path dispatch?
- **Optimizer:** Which bank, transfer, clock, and scarce-resource costs must enter legality and cost
  selection?
- **Assets:** Do current asset selectors, placement, and evidence carry C64U-visible bytes and
  restrictions?
- **Debug:** How are banked and transfer-only identities represented in `.debug.json` and
  `.memory.json` without inventing a second evidence product?
- **Tooling:** How do `blend65.json`, `tools.jsonc`, CLI, LSP, VS Code, and diagnostics carry the
  future target/profile facts through typed boundaries?

## 6. Activation gates

1. Freeze target-specific cases and primary-source authority before implementation.
2. Bump the expert semantic version for any new target doctrine and qualify it atomically.
3. Run complete affected and cross-domain qualification, including C64 preservation.
4. Complete dependent-impact review across compiler, CLI, language server, VS Code, assets,
   packaging, optimizer, and evidence.
5. Activate one target version atomically; no partial or shadow target.

## 7. Smallest C64U-native vertical proof

Build one target-native program that initializes the minimum documented C64U state, writes a
canary through a CPU-visible and a transfer-only path, observes the canary, and exits through the
documented target return or nonreturning path. Bind the exact board, firmware, artifact hash,
deployment transport, video/audio/debug configuration, and stop condition. Do not rename a C64 PRG
or D64 artifact as C64U evidence.

## 8. Transferred deferrals and owners

| Item | Owner | Reconsideration reason |
| ---- | ----- | ---------------------- |
| Four takeover profiles | `V4-TAKEOVER-1` | Raw startup/return, vectors, banking, and runtime harness are unimplemented |
| Physical C64 timing, SID, drive, board/chip revisions | `V4-HW-1` | No physical hardware exists for this candidate |
| Multi-screen sprite pointer | `T-27` / issue #140 | Frozen `setSpritePointer` has no per-call screen relation |
| CharPad 3.88 producer proof | RD-06 residual owner | Installed producer is 3.80; only CTM v9 is exercised |
| Open optimizer/parity issues | RD-08 backlog | Measured deltas and reopen paths are linked in issues #107–#140 |
| Windows/macOS native hosts | RD-10 host backlog | No native hosts were available for end-to-end proof |

No transferred item is a C64U implementation claim. Each remains owned where it is recorded.

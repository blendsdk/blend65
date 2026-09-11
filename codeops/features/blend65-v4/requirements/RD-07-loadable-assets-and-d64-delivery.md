# RD-07: Loadable Assets and D64 Delivery

> **Document**: RD-07-loadable-assets-and-d64-delivery.md
> **Status**: Draft
> **Created**: 2026-09-10
> **Project**: Blend65 v4
> **Depends On**: RD-01, RD-02, RD-03, RD-04, RD-05, RD-06
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

RD-07 lets a program keep fixed assets outside the initial resident PRG and load one explicitly
when it is needed. A `loadable const` retains its exact compile-time type, size, bytes, and
provenance but is not CPU-readable storage. `c64.loader.load(unit, destination)` transfers the
selected unit into a compatible mutable fixed destination and returns `boolean`; only the success
edge publishes the complete value. This adds no heap, runtime asset handle, implicit copy,
scheduler, scene system, or game engine. (AR-029, AR-031, AR-038)

The first disk profile is exactly `c64-pal-d64-kernal-6581`. Its one primary deployable artifact is
an atomic standard 35-track D64 containing a BASIC-startable boot PRG and every reachable load
unit. The first transport is a built-in uncompressed relocating KERNAL loader, linked only when
used. User callback/audio routes must be explicitly quiescent; the loader does not silently pause
or reconstruct application state. The exact generated D64 is trusted: KERNAL and final-address
failures return `false`, but stock `LOAD` cannot contain a readable longer replacement file because
its interface has no maximum-length input. (AR-032, AR-042 through AR-044)

> **Decisions:** AR-002 through AR-005, AR-007 through AR-014, AR-018 through AR-026, AR-029
> through AR-035, AR-038, and AR-042 through AR-044.

---

## Functional Requirements

### Must Have

#### Truthful loadable values — complexity L

- [ ] **R7.1 — Preserve one narrow source concept.** `loadable const` is a compile-time-known
  immutable scalar, fixed array, or fixed struct whose initializer is any legal constant or RD-06
  embedded/composed value. It may be declared wherever an ordinary constant declaration is legal;
  lexical scope does not create runtime storage. Its stable declaration identity includes its
  qualified scope. Its logical type, exact extent, fields, bytes, hash, provenance, and placement
  constraints remain available before packaging. It denotes no resident address or runtime object.
  (AR-019, AR-031)
- [ ] **R7.2 — Reject every false resident use.** Before a successful load, source cannot read,
  index, mutate, address, cast, return, store, compare, iterate, or pass a loadable value as an
  ordinary parameter. It may use compile-time queries and pass the declaration only as the first
  argument of a compatible selected-profile load operation. Diagnostics identify the exact illegal
  operation and the explicit destination/load pattern. (AR-002, AR-031)
- [ ] **R7.3 — Accept every proved mutable fixed place.** The destination is any ordinary mutable,
  lifetime-valid place with exactly the load unit's logical type and size. A module object, local,
  parameter place, matching field or nested field, or fixed-array element/subaggregate is legal
  when flow and layout prove its complete interval, visibility, alignment, nonoverlap, lifetime, and
  publication behavior. The place expression is evaluated exactly once into a compiler-only
  captured physical byte range with root/provenance, address space, bank, base/index/address value,
  and half-open bounds. Constants, MMIO, loadable values, temporaries without stable storage,
  incompatible nominal structs, mismatched extents, and any place whose complete destination set
  cannot be proven are rejected. A field is not rejected merely because it is part of a larger
  object, and no root-only restriction may be defended as a platform limitation. (AR-016, AR-017,
  AR-020, AR-031)
- [ ] **R7.4 — Expose one direct C64 operation.** The public operation is
  `c64.loader.load(unit, destination): boolean`. Both arguments are evaluated exactly once. The
  compiler resolves the unit, disk entry, exact byte count, and either one exact destination address
  or a finite statically proved set of complete legal intervals. A dynamic place calculation is
  lowered once to X/Y only after every possible interval passes the same layout and lifetime proof;
  source supplies no runtime filename, device number, size, descriptor, or loader handle. (AR-007,
  AR-031, AR-042)
- [ ] **R7.5 — Model publication through normal control flow.** Each evaluated call creates a fresh
  compiler-only capture/result identity. Entry makes only the captured range indeterminate. Its
  `true` result edge marks only that range definitely initialized with this load unit's logical
  value; its `false` edge leaves only that range indeterminate because a partial transfer may have
  occurred. Every must-not-alias candidate preserves its incoming state. Must-alias names observe
  the strong update; may-alias or partially overlapping names receive only byte-granular facts that
  are valid for every possible selection. A later read is legal only when its complete range is
  definitely initialized on every reaching path; it may rely on this load's logical value only when
  dominated by its successful result and proved must-alias with the capture on every reaching path.
  An independent later assignment may establish its own value fact. Joins meet predecessor facts,
  loops use the normal monotone fixed point, and every repeated call gets a fresh identity. No
  hidden runtime flag, token, descriptor, bitmap, validity byte, or read check is emitted.
  Equal source spelling alone is not identity when an index/base is volatile or may have changed.
  Keep the relation sparse and symbolic; do not enumerate every array element or introduce a
  general theorem solver. (AR-031)
- [ ] **R7.6 — Package only runtime-reachable units.** A loadable declaration whose load operation
  is unreachable contributes no D64 entry, filename data, loader call site, or resident bytes.
  Reachable canonical aliases share one disk file. Different logical objects remain distinct even
  when their bytes match unless RD-06 proves canonical identity. (AR-023, AR-029)
- [ ] **R7.7 — Keep loadable storage outside SFA.** Transport bytes, disk entries, loader code,
  KERNAL state, and packaging metadata are never function homes. A mutable local destination may
  occupy an already closed SFA interval, but final layout must prove its lifetime and complete
  nonoverlap with loader/KERNAL/interrupt resources before emission. No later phase invents helper
  scratch after SFA closure. (AR-002, AR-018)
- [ ] **R7.8 — Keep resident and loadable declarations distinct.** Ordinary `embed()` values retain
  RD-06's resident semantics. Changing a declaration between `const` and `loadable const` changes
  artifact residency and requires explicit source review; the compiler never spills resident data
  to disk or promotes a load unit into RAM automatically. (AR-020, AR-029, AR-031)

#### One exact standard D64 — complexity XL

- [ ] **R7.9 — Implement only the selected disk profile.** `c64-pal-d64-kernal-6581` composes the
  PAL, 6510, 6581, cooperative KERNAL, BASIC-return, native-asset, and disk contracts already frozen
  by RD-01/RD-05/RD-06. It is not an alias for a PRG profile. Other PAL/NTSC, SID, takeover, drive,
  or target combinations remain unavailable until separately qualified. (AR-024, AR-032)
- [ ] **R7.10 — Publish one primary deployable artifact.** A successful disk-profile build
  stages `<name>.d64` plus the common `.asm`, `.labels`, `.memory.json`, `.assets.json`,
  `.costs.json`, `.debug.json`, and `.build.json` evidence inside one immutable build generation,
  then atomically replaces the current-generation record. This is the complete final component set:
  only the primary D64 derives from the literal validated manifest basename, while every sidecar
  has the fixed name shown. Materialize and validate the set before staging under RD-02/RD-03's
  native ordinary-file, alias, exclusive-ownership, and prior-generation-preservation rules. The
  direct JSON sidecars conform to their RD-03 versioned schemas; `.debug.json` populates the existing load-unit, publication, residence,
  address-space, location, and final-range record families without redefining them, and `.build.json`
  hashes every other contained artifact. The boot PRG and
  unit files are contained components, not separate advertised products. Any failure or pre-commit
  cancellation leaves the prior current generation intact, and `run` never launches a stale or
  mixed artifact. The same short per-project publication lock and private pin protocol retain the
  current generation, its immediate predecessor, every active or uncertain pin, and delete only
  other provably unpinned generations. Normal released-pin retention is bounded; a crash-left or
  ambiguous pin fails closed and requires diagnosed deliberate cleanup. RD-07 adds no disk-specific
  transaction, liveness, or cache layer. (AR-008, AR-022, AR-032)
- [ ] **R7.11 — Serialize one exact physical format.** Emit a 174,848-byte, 35-track, single-sided
  Commodore 1541 D64 without an error-information table. Use 256-byte sectors, standard track-18
  BAM/directory structures, DOS type `2A`, closed PRG entries, 254 payload bytes per linked data
  sector, and a valid free-block map. Reject rather than emit any invalid track, sector, link,
  count, directory, BAM, or capacity state.
- [ ] **R7.12 — Generate the image internally and deterministically.** The compiler-owned
  packager writes the minimal D64 structures directly; it does not require VICE `c1541`, a host
  filesystem mount, shell command, script hook, downloader, or third-party image builder.
  Allocation uses one measured, documented, and versioned fixed sector-order/interleave policy,
  never allocates file data on track 18, and produces byte-identical images for identical build
  identities. The implementation plan must select that policy from primary 1541 evidence and a
  representative KERNAL-load measurement before serializer code is written; changing it later is
  an observable artifact-format change that requires dependent requalification. (AR-012, AR-022)
- [ ] **R7.13 — Make the boot component first and runnable.** The first directory entry is one
  closed PRG containing the selected profile's BASIC `SYS` bootstrap and complete resident image.
  Its directory name and disk label derive deterministically from the validated project output
  name through the Specification 4 C64 encoding policy. The profile rejects an unrepresentable or
  colliding identity rather than silently changing it.
- [ ] **R7.14 — Give each distinct unit one deterministic entry.** Canonically order reachable
  units by stable object identity and assign collision-free compiler-owned uppercase PETSCII names
  within the 16-byte directory limit. Each entry is a closed PRG whose first two bytes are a fixed
  ignored little-endian load header of `$0000` and whose remaining bytes are exactly the
  uncompressed logical unit.
  The evidence map binds source declaration and hash to directory name, track/sector chain, file
  byte range, block count, and logical bytes. (AR-022, AR-042)
- [ ] **R7.15 — Enforce real disk limits before packaging.** Account for the boot file, two-byte
  headers, load units, sector links/tails, directory entries, BAM, and reserved track. The standard
  image has 664 available data blocks and at most 144 directory entries; the boot component leaves
  at most 143 distinct unit files. Exceeding either exact limit is a compile-time packaging error
  with the largest contributors and grouping remedy, never truncation or an extended/nonstandard
  image. D64 image length, allocated-sector count, directory/BAM/link overhead, tail padding, and
  unused fill are capacity and reporting facts only; they never contribute to optimizer program-byte
  metric `B`, target-memory vector `R`, or candidate selection. Any future load-order/latency policy
  requires its own explicit packager oracle rather than being called `size` optimization.
- [ ] **R7.16 — Preserve visible directory integrity.** Every entry is closed, uniquely named,
  correctly typed, length-counted, and reachable through one acyclic in-range sector chain; no
  allocated sector is shared by different files, marked free, orphaned, or referenced twice.
  Unused bytes and sectors use one deterministic fill value. Directory ordering remains stable.
- [ ] **R7.17 — Bind `run` to the fresh D64.** `blendc run` performs a successful build in the same
  invocation, pins the exact immutable generation returned by that build without re-resolving the
  current record before releasing the publication lock, verifies its D64/evidence hashes, attaches
  that exact image to VICE drive 8 only after pin acquisition, and starts its first boot entry under
  the exact `c64-pal-d64-kernal-6581` model. Publication is the no-return point: pre-commit
  cancellation publishes nothing, while cancellation after commit retains that generation and
  stops only VICE and its monitor/control work before releasing its exact pin. Build,
  pin-acquisition/release, mount/autostart, emulator, timeout,
  cancellation, and observation failures remain distinct. (AR-009, AR-032)

#### KERNAL-first transfer — complexity XL

- [ ] **R7.18 — Link one built-in transport only when reached.** The first strategy is exactly
  `kernal-sequential-uncompressed`. A project with no reachable load call contains no loader code,
  filenames, KERNAL-call scaffolding, load-unit entries, or loader resource reservations. No
  fastloader, decompressor, drive code, registry, or general runtime is present. (AR-029, AR-042)
- [ ] **R7.19 — Lower through the documented KERNAL contract.** Emit the exact selected-ROM
  `SETLFS`, `SETNAM`, and `LOAD` call sequence. Use secondary address zero so `LOAD` consumes the
  file header but relocates the payload to the destination address evaluated once for this call and
  supplied in X/Y. Reuse the
  boot device captured by the disk-profile startup; source never hardcodes drive 8 or a filename.
- [ ] **R7.20 — Validate complete success.** `true` requires clear KERNAL carry/error status and a
  returned end address exactly equal to the low 16 bits of conceptual
  `destination + sizeof(unit)`. A statically valid interval may end exactly at `$10000`, producing
  returned X/Y `$0000`; an interval that extends beyond `$10000` is rejected before emission. Any
  device/file/abort/read error, short load, unexpected final address, or impossible range returns
  `false`. The boolean is materialized directly through the normal ABI without an exception,
  string, allocation, or dispatch table. (AR-031, AR-044)
- [ ] **R7.21 — Place bytes directly at their consumer destination.** KERNAL writes the logical
  bytes into the final mutable object. The compiler emits no staging buffer, relocation copy,
  conversion pass, checksum buffer, or duplicate resident representation. A later user read uses
  the ordinary destination address. (AR-029, AR-042, AR-044)
- [ ] **R7.22 — Preserve the required machine environment.** The adapter declares its complete
  A/X/Y/flags, KERNAL workspace, zero-page, stack, ROM, I/O, CIA/serial-bus, message-state, device,
  and banking contract. Final allocation reserves every touched byte. Every normal success/failure
  exit restores all state promised by the selected profile and reports every unavoidable clobber;
  it never calls a ROM routine while KERNAL or required I/O is unavailable.
- [ ] **R7.23 — Require application quiescence.** `load()` is mainline-only. At the call, flow and
  route analysis must prove every user-installed IRQ/NMI callback, audio/player tick, and other
  selected-profile asynchronous observer or writer explicitly stopped/restored. The stock KERNAL
  service route required by the loader remains active. Unknown, conditionally active, externally
  installed, or unqualified DMA activity is rejected with an actionable diagnostic. C64U DMA is not
  implied by this C64 contract. (AR-018, AR-043)
- [ ] **R7.24 — Add no hidden pause or timing promise.** The loader never silently uninstalls,
  snapshots, restarts, or reconstructs application callbacks, music, effects, frame counters, or
  gameplay state. It claims no stable raster, frame, or audio cadence during the call. Source owns
  the loading screen, fade, silence, retry, abort, and post-load reinstallation policy. (AR-038,
  AR-043)
- [ ] **R7.25 — State the trusted-media boundary exactly.** The compiler proves and hashes the
  generated D64 and every contained unit. Runtime KERNAL/end-address errors return `false`, but the
  baseline cannot contain a readable longer replacement file before it writes beyond the declared
  destination. Document this as a selected-loader hardware/toolchain limitation; do not describe
  the wrapper as memory-safe against corrupted or hostile media. (AR-044)
- [ ] **R7.26 — Keep failure recovery application-owned.** On `false`, destination bytes are
  indeterminate and cannot be read until fully reassigned or a later successful load. For a dynamic
  destination this invalidates only the captured range; a proved unselected initialized candidate
  remains readable. A read that may alias the invalidated range is rejected. Source may retry, show
  an error, return to a menu, or terminate using ordinary language/platform features. The compiler
  supplies no modal UI, retry loop, error text, disk prompt, or policy engine. (AR-031)

#### Layout, reuse, and publication — complexity XL

- [ ] **R7.27 — Solve transport and resident views together.** For every unit record logical
  bytes/type, disk header/file/block ranges, destination physical interval, CPU/VIC visibility,
  alignment, bank/mapping requirements, mutable lifetime, loader resource interference, and every
  reachable consumer. Disk capacity never substitutes for RAM fit, and payload length never
  substitutes for physical interval proof.
- [ ] **R7.28 — Permit destination reuse without a new overlay language.** Several mutually
  exclusive loadable constants may target the same compatible mutable destination at different
  calls. This is ordinary sequential replacement of one fixed object, not a scene, resource
  manager, dynamic allocation, or linker-overlay API. The `true` edge publishes the new value;
  prior contents cease to be the logical value.
- [ ] **R7.29 — Permit one unit at several valid destinations.** Because the baseline uses a
  relocating KERNAL load, one packaged unit may load into several exact-type destinations. Each
  call and every member of a finite dynamic-place destination set receives its own placement,
  liveness, visibility, quiescence, end-address, and cost proof; one disk file remains canonical.
  The runtime choice is represented by that call's captured range, not by marking every candidate
  selected. No destination-specific duplicate is emitted.
- [ ] **R7.30 — Forbid destructive overlap.** A destination interval cannot overlap executing or
  reachable code, a live return address, hardware stack, active SFA home, loader code/state,
  KERNAL/ROM-required workspace, vector/saved link, active player data, MMIO, reserved range, or any
  other simultaneously live object. Report all conflicting owners before ACME/D64 publication.
- [ ] **R7.31 — Respect CPU and device visibility.** Loading under BASIC/KERNAL ROM or into
  VIC-visible RAM is legal only when the exact write and later read/fetch mappings are proven.
  Reject destinations whose transfer would write I/O devices or hide loader/serial-bus resources.
  Derive VIC bank/base/pointer fields from the destination, never from the disk address.
- [ ] **R7.32 — Publish only after the blocking call returns.** Mainline cannot observe bytes during
  the synchronous transfer. Quiescence prevents user interrupt consumers from observing partial
  state. The successful return edge is the sole publication point for the captured range; no
  pointer flip, callback, event, flag, or hidden notification is emitted automatically. (AR-043)
- [ ] **R7.33 — Preserve address/provenance rules.** Addresses and aliases of the destination retain
  their normal lifetime and identity across loads; they refer to the same mutable storage whose
  contents change on success. Must-alias names observe the captured-range update; may-alias names do
  not receive definite-initialization credit, and partial overlap is tracked by byte range. A
  loadable value itself never gains an address. Optimizers cannot cache destination contents across
  the effectful load operation or across a later ordinary, interrupt, external, or DMA write.
- [ ] **R7.34 — Keep transfer effects explicit in IL.** The semantic/machine representations carry
  unit identity, fresh capture/result identity, evaluated destination range/provenance, finite
  candidate ranges, selected-range strong update, unselected-range preservation, complete write
  effect, blocking KERNAL/IO effect, failure edge, quiescence requirement, and strategy/profile
  identity until their consumers discharge them. No generic call or byte-copy operation may erase
  these facts before analysis, layout, lowering, and evidence.
- [ ] **R7.35 — Close all storage before final layout.** Loader code, filenames, KERNAL adapter
  state, call temporaries, SFA destinations, and all reserved work areas are known before final
  interval solving. The emitter and D64 serializer cannot invent helper code, scratch, or copies.
  (AR-002, AR-018)

#### Diagnostics, evidence, and qualification — complexity XL

- [ ] **R7.36 — Define the complete diagnostic boundary.** Specification 4 assigns unique stable
  diagnostics for illegal loadable use, incompatible destination, unsupported profile, unresolved
  unit, unproved captured-range success/alias at a read, unproved quiescence, destructive overlap,
  invalid mapping, destination overflow, too many entries, insufficient disk blocks,
  duplicate/invalid encoded names, D64 structural failure, KERNAL contract mismatch, and unavailable
  loader strategy. The captured-range diagnostic points to the read, governing load, and the
  mutation, join, or failure edge that prevents proof. No diagnostic invents a workaround or emits
  a partial artifact.
- [ ] **R7.37 — Make diagnostics useful to modern developers.** Name the loadable declaration,
  logical type/size, destination and interval, active route or conflicting owner, selected profile,
  disk blocks/entries required and available, exact failed rule, and one direct source/configuration
  remedy. Explain the hardware reason without requiring the user to know KERNAL calling folklore.
- [ ] **R7.38 — Publish complete disk evidence.** `.build.json` binds the D64 hash/size, disk
  label/ID, boot entry, ordered directory, BAM, allocation policy, and profile/loader identities.
  Each component records logical/source/output hashes, directory bytes/name/type, load header,
  start/end track-sector chain, block count, byte length, destination calls, and aliasing.
  The same identities populate the RD-03-frozen debug version-1 load-unit and artifact records; no
  separate loader debug format is introduced.
- [ ] **R7.39 — Publish complete runtime costs.** `.costs.json` separately reports boot-resident
  bytes, loader code/data, per-unit filename bytes, call-site bytes, SFA/temp/ZP/stack, KERNAL ROM
  bytes as existing zero-output code, logical and disk bytes, sector overhead, destination
  residency, best/worst load time where measured, and post-load access. Unknown timing is
  `Unknown`, never zero.
- [ ] **R7.40 — Publish complete memory/lifetime evidence.** `.memory.json` identifies loader and
  KERNAL reservations, every possible destination interval, mutually exclusive sequential states,
  CPU/VIC mappings, ROM/I/O visibility, prohibited overlap, selected-profile asynchronous-agent
  quiescence, and the successful call-site publication point. The report lists static possible
  ranges and never claims to know which runtime range was selected. For every occupied or reserved
  interval it includes the half-open physical range, exact size, owner/kind, source/import identity, mutability,
  alignment/contiguity, residency/lifetime, CPU mapping, VIC bank/visibility, and ZP/stack class.
  Each compatible residency and CPU/VIC view reports every free interval, total free bytes, largest
  contiguous hole, and stack headroom. The versioned report is emitted only after final machine
  selection, SFA closure, joint layout, ACME assembly, and symbol/segment reconciliation. A proved
  overlap, overflow, resource exhaustion, visibility/banking/alignment failure, or mismatch is a
  hard diagnostic naming the request, blockers, and compatible holes before the generation can be
  published. Bounded runtime writes are checked against the ledger; unbounded raw writes remain
  expressible but appear as source-linked effects with `runtimeMemorySafety: unproven`. Disk-only
  bytes are never labelled as resident RAM.
- [ ] **R7.41 — Prove the codec independently.** Byte-level tests parse the generated image without
  using the production serializer and verify exact image length, geometry, BAM/free counts,
  directory entries, names/types/blocks, every acyclic sector chain, component bytes, deterministic
  padding, and absence of orphan/shared sectors. Round-tripping through the same code is not an
  oracle.
- [ ] **R7.42 — Prove source and flow semantics independently.** Specification tests cover every
  allowed compile-time use, forbidden resident use, exact/mismatched destination, success/failure
  definite assignment, unchanged and changed indexes, volatile indexes, saved addresses,
  must/may/not aliases, partial overlaps, joins, stored results, loops, covering loops, retries,
  repeated overlapping loads, prior initialized candidates, reachability, several destinations,
  and every profile-declared asynchronous observer/writer. Tests derive from Specification 4 rather
  than current implementation.
- [ ] **R7.43 — Prove the final machine path.** Focused ACME/VICE cases load byte patterns and
  composite values from the freshly built D64 into final destinations, verify exact bytes and
  surrounding canaries for the trusted artifact, exercise KERNAL error/short-load paths, and prove
  success/failure publication, device reuse, BASIC return, and no hidden resident copy.
- [ ] **R7.44 — Bound physical-hardware claims.** VICE 3.10 `x64sc` is the normal automated oracle.
  Record `VICE-verified / hardware-unverified` until targeted QA on a stock PAL C64 with the pinned
  KERNAL and 1541-compatible drive checks boot, load, error, directory, real-drive timing, and
  serial/IRQ behavior. Emulator success never proves all drives or altered media. (AR-027, AR-044)
- [ ] **R7.45 — Preserve impact-based verification.** During implementation run focused language,
  codec, layout, loader, and bounded VICE cases. Run the complete RD-07 boundary once after
  integration. Do not run the unrelated compiler/readiness corpus per file or unit; do not create a
  readiness product. (AR-026)
- [ ] **R7.46 — Close deferrals and durable limitations.** Before RD-07 closes, answer whether its
  deliverables expired any deferral rationale; walk the ambiguity register, Won't Have sections,
  Specification 4 future considerations, expressiveness ledger, and hardware-limitation register.
  Record AR-044 as named hardware limitation `HLE-010` in Specification 4 and expert baseline
  `2.0.0`, with the later bounded-loader reconsideration trigger. Re-own every due item. (AR-014,
  AR-034)

#### Required tooling metadata handoff — complexity M

- [ ] **R7.48 — Expose pre-build and final metadata.** The shared semantic model exposes logical
  loadable type/size/provenance, illegal uses, and known destination compatibility to RD-09 without
  importing packaging. Build-only views expose directory, sector, address, strategy, quiescence,
  memory-proof status, and cost facts after final layout. This required handoff conforms to the
  direct versioned sidecar schemas and immutable generation identity.

### Should Have

- [ ] **R7.47 — Provide focused examples — complexity M.** Include one level-like composite load,
  sequential reuse of one destination, the required `if`/failure path, explicit callback/audio
  quiescence and restoration, automatic omission of an unreachable unit, and a disk-capacity
  diagnostic. Examples remain application source, not a framework or game engine.
- [ ] **R7.49 — Record host responsiveness — complexity S.** At closeout record D64 serialization,
  independent decode, captured-range flow/alias analysis, build, and bounded-run duration plus peak
  host memory for named fixtures. These are comparable observations, not wall-clock pass/fail gates,
  proof budgets, or authorization for a cache or theorem solver. (AR-011, AR-026)

### Won't Have (Out of Scope)

- A fastloader, drive-resident transfer code, compressor/decompressor, checksum protocol, staging
  buffer, uninterrupted audio/raster loading, or hostile-media containment. Each needs a measured,
  separately qualified loader contract after the KERNAL baseline. (AR-042 through AR-044)
- Streaming part of one object, random disk access, sectors exposed to source, asynchronous load,
  background tasks, futures/promises, callbacks, queues, dynamic file names, a directory API, or a
  persistent runtime asset handle. The first operation is one synchronous whole-value transfer.
- Multiple disks, disk swapping, writable files, save games, high scores, REL/SEQ/USR files, error
  tables, 40-track/nonstandard images, G64, tape, cartridge, network, or host filesystem access.
- Code/function overlays, self-relocating executable units, runtime linking, or execution from a
  loadable constant. RD-07 transports immutable data into ordinary mutable fixed storage only.
- A loader plugin/strategy registry, external packager hook, shell command, `c1541` dependency,
  Spindle integration, generalized virtual filesystem, asset manager, scene manager, or game
  engine. Future support adds one exact built-in qualified strategy at a time. (AR-012, AR-038)
- D64 variants for NTSC, 8580, takeover, C64U, X16, C128, or Atari. Only
  `c64-pal-d64-kernal-6581` is qualified here; later targets own their storage systems. (AR-024,
  AR-032, AR-035)

---

## Technical Requirements

### Source surface — complexity L

```blend
struct LevelData {
    map: byte[1200];
    charset: byte[2048];
    colors: byte[1000];
    collision: byte[300];
}

loadable const LEVEL_2: LevelData = buildLevel(
    embed("level2.ctm", "map"),
    embed("level2.ctm", "charset"),
    embed("level2.ctm", "colors")
);

let currentLevel: LevelData;

function enterLevel2(): boolean {
    c64.system.restoreIRQ();
    c64.audio.stop();

    if (!c64.loader.load(LEVEL_2, currentLevel)) {
        return false;
    }

    c64.system.setIRQ(frameIRQ);
    return true;
}
```

The exact interrupt/audio operation names come from the selected Specification 4 platform
appendix; this example shows ownership and control flow, not a promise of these placeholder
spellings. No operation receives a path string or dynamic unit ID.

### Compilation and runtime flow — complexity XL

```text
loadable const declaration
  -> exact compile-time logical value + provenance
  -> reachable load-call inventory
  -> canonical unit identity + deterministic PRG disk entry
  -> joint resident/destination/loader interval proof
  -> boot PRG + uncompressed unit files
  -> compiler-owned D64 serialization + independent structural oracle
  -> KERNAL relocating LOAD into the final destination
  -> carry/end-address validation
  -> true-edge publication or false-edge invalidation of the captured range
```

### D64 geometry and naming contract — complexity L

| Item | Required value |
|---|---|
| Image | 35 tracks, 174,848 bytes, no error-information table |
| Sector | 256 bytes; first 2 bytes link to the next sector; 254 file bytes |
| System track | Track 18 owns BAM and directory; no file payload allocation |
| DOS identity | Standard `2A` format with deterministic label and ID |
| Capacity | 664 data blocks; 144 directory entries maximum |
| Entry 0 | Closed PRG boot component, first/autostart target |
| Unit entry | Closed PRG; ignored little-endian `$0000` header + exact logical bytes |
| Unit name | Compiler-owned, deterministic uppercase PETSCII identity, at most 16 bytes |
| Allocation | One measured, documented, versioned sector-order/interleave policy; stable for identical inputs |
| Fill | One documented byte for all unused tail/directory/image bytes |

The build report is the authoritative mapping from Blend65 declarations to disk names. Source code
never relies on those internal names, so a later qualified transport can change its private disk
organization without changing the language.

### Publication state — complexity M

| Program point | Destination state | Legal observation |
|---|---|---|
| Before first complete assignment/load | Existing bits; not definitely initialized | No read on an uninitialized path |
| During synchronous load | Captured range partially overwritten; other candidates retain their state; asynchronous agents quiescent | No mainline or selected-profile asynchronous observation |
| `true` result edge | Captured range is the exact complete logical value; unselected candidates retain their state | Ordinary use where every reaching path proves complete initialization; loaded-value reasoning additionally requires must-alias success proof |
| `false` result edge | Captured range is indeterminate; unselected candidates retain their state | Full assignment or another successful load before a read that may alias the captured range |
| After later successful replacement | New exact logical value in same storage | Existing valid destination addresses observe new contents |

This is compile-time definite-assignment state plus ordinary blocking execution. It is not a
runtime typestate object, option/result allocation, generation counter, or hidden validity byte.

### KERNAL adapter boundary — complexity L

| Boundary | Contract |
|---|---|
| Device | Reuse the disk-profile boot device; VICE `run` mounts the D64 as drive 8 |
| Name | Statically resolved internal directory bytes and length |
| Address | Secondary address 0; destination supplied in X/Y; file header ignored for placement |
| Result | Carry/error plus returned X/Y end address normalized to `boolean` |
| Concurrency | Stock KERNAL service route active; user callback/NMI/player routes proved inactive |
| Mapping | KERNAL ROM, I/O, CIA/serial bus, workspace, stack, and loader code remain usable |
| Integrity | Exact generated D64 trusted; no pre-transfer maximum-length containment |
| Cost | Every emitted byte, reservation, stack/ZP/SFA term, and measured/unknown time reported |

### Evidence lineage — complexity M

Implementation binds Specification 4 and expert baseline `2.0.0`. RD-01 must add exact source
governance and qualification cases for the documented C64 KERNAL `SETLFS`/`SETNAM`/`LOAD`
interface, 1541 35-track directory/BAM/data-chain format, AR-043 quiescence contract, and AR-044
hardware limitation `HLE-010`. Existing expert keys `CBM-C64-PRG-1982`, `CBM-C64-KERNAL-03`,
`SPINDLE-V3`,
`HESSIAN-1.2`, and `C64-GAMEFRAME-C634F6F` remain supporting hardware/practitioner evidence, not a
mandate to copy a game loader or framework. (AR-014, AR-034, AR-042 through AR-044)

---

## Integration Points

### With RD-01 (Specification 4.0 and Expert Authority Freeze)

- Consumes exact `loadable const`, definite-assignment, C64 disk-profile, diagnostic, KERNAL, and
  hardware-limitation contracts plus the requalified expert `2.0.0` baseline.

### With RD-02 (Clean V4 Foundation and Deterministic Project Model)

- Uses the coherent project snapshot, validated output name, profile selection, atomic publication,
  contained staging area, and fresh-build `run` rule. It adds no manifest loader registry or tool
  command.

### With RD-03 (Playable M1 Complete Pipeline)

- Reuses the actual CLI-to-ACME-to-VICE path and artifact observation boundaries. M1 remains a
  resident PRG workload and gains no loader dependency.

### With RD-04 (Complete Language and Correct Unoptimized Compiler)

- Activates RD-04's parsed/typed loadable semantics through real selected-profile transfer,
  definite assignment, effectful IL, SFA closure, and correct `optimization: none` lowering.

### With RD-05 (C64 Platform Profiles and Game-Workload Compiler Support)

- Extends exact KERNAL startup, banking, interrupt/audio ownership, memory reservations, platform
  operations, and VICE model into one separately qualified disk profile.

### With RD-06 (Native Assets, Compile-Time Composition, and Resident Layout)

- Converts exact embedded/composed logical values into nonresident units while reusing provenance,
  type, one-copy, placement, device-visibility, report, and fixture contracts.

### With RD-08 (Optimization and Expert Output)

- Supplies correct uncompressed load units and complete loader/disk/runtime costs. RD-08 may not
  silently add compression, staging, duplication, or a fastloader under an optimizer mode.

### With RD-09 (Developer Tooling and Debug Evidence)

- Publishes frontend loadable/destination/flow facts and final disk/address/cost mappings without
  making the language server depend on D64 serialization or code generation.

### With RD-10 (Production Qualification and C64U Handoff)

- Supplies the complete disk-profile qualification and its bounded real-hardware status. RD-10
  must retain or re-own the fastloader/integrity follow-ons and cannot imply C64U storage support.

---

## Scope Decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Nonresident model | Ordinary const / manifest inventory / typed load unit | `loadable const` | Makes unavailable storage unrepresentable as a resident value. | AR-029, AR-031 |
| Primary artifact | PRG plus side files / one D64 | One profile-owned D64 | The boot and units are one deployable program. | AR-032 |
| First transport | KERNAL / fastloader+compression / plugin system | KERNAL sequential, uncompressed | Proves the complete path with the smallest optional code. | AR-042 |
| Runtime concurrency | Explicit quiescence / hidden pause / continuity now | Explicit quiescence | Avoids partial observation and hidden state reconstruction. | AR-043 |
| Corrupted media | Trusted D64 / staging / bounded custom loader | Trust exact generated D64; disclose limit | Avoids impossible containment claims and RAM duplication. | AR-044 |
| Destination | Fixed final storage / staging / runtime handle | Compatible mutable fixed object | Modern direct use with one transfer and no heap. | AR-031 |
| Unit organization | One file per canonical unit / packed custom container | One PRG per unit | This is the direct form supported by the selected KERNAL loader. | AR-042 |
| Product boundary | Compiler delivery / game asset manager | Compiler delivery only | Source owns every loading/game policy decision. | AR-038 |

> **Traceability:** Decisions are recorded in
> [00-ambiguity-register.md](00-ambiguity-register.md). Exact source syntax, diagnostics, platform
> ABI, and hardware exceptions are frozen by RD-01 before implementation.

---

## Security Considerations

- **Build input:** Reuse RD-02/RD-06 canonical containment, coherent snapshot, bounded asset parsing,
  output collision, and atomic staging rules. The D64 serializer consumes validated in-memory bytes
  and never interpolates a path into shell or ACME input.
- **D64 integrity:** Independently validate geometry, arithmetic, block ownership, links, BAM,
  directory entries, encoded names, and capacity. Reject overflow, cycles, duplicate sectors,
  invalid track 18 use, truncation, or non-deterministic bytes before publication.
- **Runtime trust:** The exact compiler-produced D64 is trusted and hash-bound. KERNAL errors and
  final-size mismatch return `false`; AR-044 explicitly denies containment against a longer altered
  file. Documentation cannot call this path safe for hostile/removable media.
- **Memory integrity:** Static interval, mapping, SFA, stack, vector, loader, KERNAL, MMIO, and
  concurrency checks prevent every compiler-known overlap. No failed build or failed load publishes
  a valid logical value.
- **Execution:** The manifest cannot execute packager/loader hooks or select arbitrary host/player
  code. `run` launches only pinned VICE with the freshly built hash-bound D64.
- **No service concerns:** There is no network listener, authentication, authorization, database,
  tenant, secret, personal-data, TLS, CORS, CSRF, or rate-limit surface in this RD.

---

## Non-Functional Requirements

### Determinism — complexity L

- Identical authoritative inputs produce byte-identical D64, directory/BAM/sector layout, contained
  files, loader code, deterministic reports, and hashes regardless of checkout path, locale,
  working directory, host filesystem enumeration, or Turbo scheduling. Invocation-specific
  `.build.json` may differ only in `generationId` and declared host provenance; its semantic-input,
  portable-tool, and artifact-hash projection must match exactly.

### Correctness and safety — complexity XL

- No target artifact is published unless language flow, SFA closure, resident/destination layout,
  D64 structure, KERNAL ABI, quiescence, and independent byte oracles all pass.
- A result is never described as memory-safe beyond the trusted generated-media boundary.

### Performance and resources — complexity L

- The baseline emits no compression, staging copy, dynamic registry, scheduler, or unused loader.
  Report real bytes and resource reservations; measure host responsiveness and available load timing
  without flaky pass/fail thresholds.

### Maintainability — complexity L

- Keep loadable semantics, C64 transport, D64 serialization, interval layout, evidence decoding,
  and VICE observation independently testable through small public boundaries. Do not create a
  generic VFS, loader plugin system, or monolithic build/readiness harness.

### Portability — complexity L

- Core `loadable const` and transfer effects contain no D64, KERNAL, C64 address, or 1541 fact.
  Profile-owned strategy and artifact implementations provide those facts. C64U or another target
  may map the same language concept to wider/banked/DMA storage without widening `word` or copying
  the C64 loader architecture.

---

## Acceptance Criteria

1. [ ] **AC-01 — Loadable declaration:** Scalars, fixed arrays, structs, embedded values, and
   compile-time-composed values retain exact type/size/bytes/provenance without receiving a
   resident address or SFA home at module or function scope.
2. [ ] **AC-02 — Illegal uses:** Reads, indexing, address-of, mutation, casts, ordinary arguments,
   returns, iteration, and storage of a loadable value each produce their stable Specification 4
   diagnostic and no target artifact.
3. [ ] **AC-03 — Destination compatibility:** Exact mutable fixed globals, locals, parameter places,
   matching fields/nested fields, and fixed-array elements/subaggregates pass when every possible
   complete interval is proved and the place evaluates once. Constants, unstable temporaries, MMIO,
   nominal/extent mismatch, expired storage, and unproved interval/visibility/alignment/overlap fail
   independently; no root-only rejection is accepted. The captured destination is the evaluated
   physical range and provenance, not the source expression spelling or every candidate.
4. [ ] **AC-04 — Definite publication:** True/false branches, early returns, joins, loops, retries,
   stored results, unchanged/changed/volatile indexes, saved addresses, must/may aliases, partial
   overlaps, repeated loads, covering loops, prior initialized candidates, and full reassignment
   prove exact byte-range initialization state without target-side validity state.
5. [ ] **AC-05 — Reachability:** Unreachable units and load calls add zero disk entries, filenames,
   code, data, reservations, and report aliases; reachable canonical aliases share one entry.
6. [ ] **AC-06 — Resident separation:** An ordinary embedded asset remains resident and directly
   addressable; its loadable twin is disk-only before load. Neither silently changes category.
7. [ ] **AC-07 — Exact D64 geometry:** Independent decoding proves 174,848 bytes, 35-track geometry,
   track-18 BAM/directory ownership, DOS `2A`, valid free counts, deterministic fill, and no error
   table.
8. [ ] **AC-08 — Boot component:** The first closed PRG entry contains the exact BASIC-startable
   resident image, loads at its reported origin, reaches `main`, and can return normally to BASIC.
9. [ ] **AC-09 — Unit components:** Each canonical unit has one closed PRG entry with the fixed
   ignored little-endian `$0000` header and exact uncompressed logical bytes; report hashes and
   disk chains match.
10. [ ] **AC-10 — Disk structure:** Every directory/block count and sector link is exact, acyclic,
    in range, nonshared, allocated in BAM, outside track 18, and reachable from one entry.
11. [ ] **AC-11 — Deterministic identity:** Identical inputs in different checkout paths and
    enumeration orders produce byte-identical disk, deterministic evidence, encoded names, and
    hashes. Their `.build.json` files differ only in `generationId` and declared host provenance;
    their semantic-input, portable-tool, and artifact-hash projections match exactly.
12. [ ] **AC-12 — Capacity boundaries:** Exactly fitting block and directory cases succeed; one
    excess block, one excess unit entry, D64-directory name collision, unrepresentable disk
    identity, host artifact-component alias/collision/limit, occupied non-regular output, and
    arithmetic overflow fail before publication with exact contributors and preserve the prior
    current generation.
13. [ ] **AC-13 — No external packager:** Build succeeds without VICE/c1541 except when `run` or the
    emulator tier is requested; static inspection finds no shell command, hook, or plugin path.
14. [ ] **AC-14 — Fresh run:** `run` pins one newly published generation, mounts drive 8 with only
    that generation's hash-bound D64, and starts its first entry only after the durable pin is
    visible. Failed build, pin acquisition, stale or mixed files, missing/wrong VICE, mount failure,
    timeout, cancellation, and program failure remain distinct; post-commit cancellation preserves
    the complete generation and releases only its own pin after owned work stops, or diagnoses a
    safely retained pin when release fails.
15. [ ] **AC-15 — KERNAL call contract:** Assembly and runtime evidence prove exact SETLFS/SETNAM/
    relocating LOAD arguments, boot-device reuse, filename bytes, destination X/Y, declared
    clobbers, and restored state.
16. [ ] **AC-16 — Exact success:** A complete unit clears error, returns the exact one-past-end
    address, yields `true`, initializes every destination byte, and preserves canaries.
17. [ ] **AC-17 — Observable failures:** File-not-found/device/abort/read error, short payload, and
    unexpected returned end address yield `false`, leave only the captured range indeterminate by
    flow, preserve every proved unselected candidate, and reject a later may-alias read with related
    source spans.
18. [ ] **AC-18 — Trusted-media boundary:** The generated D64 and unit hashes are exact; a
    VICE-only test using an isolated sacrificial destination and bounded observation canaries
    demonstrates that a controlled longer replacement is detected only after prior overwrite, and
    user documentation names this limitation without weakening ordinary generated-artifact tests.
19. [ ] **AC-19 — One-copy destination:** Static maps, disk bytes, PRG inspection, and runtime traces
    prove the unit travels directly from its disk file to the final destination with no resident
    twin, staging buffer, relocation copy, or hidden conversion.
20. [ ] **AC-20 — Optional loader:** A resident-only disk-profile program and every PRG-profile
    program contain no loader implementation or load-unit files. One reachable call links exactly
    the selected KERNAL adapter and its required data.
21. [ ] **AC-21 — Explicit quiescence:** Calls with no user routes or with proved prior
    restore/stop operations compile. Active, conditional, unknown, raw/external, or reinstalled
    callback/NMI/player routes and every selected-profile external/DMA agent fail at the call with
    the exact route and remedy unless proved absent or quiescent.
22. [ ] **AC-22 — No hidden lifecycle:** Binary and trace inspection finds no automatic callback,
    music, effect, loading-screen, retry, prompt, state-save, uninstall, reinstall, scheduler, or
    registry behavior.
23. [ ] **AC-23 — Sequential reuse:** Two different composite units load successively into one
    fixed destination, each successful edge exposes exact new contents, and only one destination
    interval is resident.
24. [ ] **AC-24 — Several destinations:** One unit loads into two compatible legal destinations
    and through one finite dynamic-place case using one disk entry; each possible address has its own
    exact end-address and interval proof, the place expression evaluates exactly once, and flow
    updates only the captured range while preserving must-not-alias candidates.
25. [ ] **AC-25 — Overlap rejection:** Code, live SFA, stack, vectors, loader/KERNAL workspaces,
    MMIO, active player data, resident objects, and illegal VIC/bank mappings each fail before ACME
    with every conflicting owner.
26. [ ] **AC-26 — ROM and VIC placement:** Legal RAM under ROM and legal VIC-visible destinations
    load/read/fetch correctly under exact mapping transitions; I/O-space and hidden-loader cases
    reject without device writes.
27. [ ] **AC-27 — Effect preservation:** Optimizer-none IL and machine output retain the complete
    capture/result correlation, selected-range update, unselected preservation, blocking
    write/failure/quiescence/profile effect; no memory read or MMIO operation crosses the load call
    illegally.
28. [ ] **AC-28 — Closed allocation:** Loader, filenames, KERNAL state, SFA/temp/ZP/stack, destination
    and reserved intervals reconcile before emission; the emitter/packager introduces none later.
29. [ ] **AC-29 — Complete disk report:** Every R7.38 D64/component field decodes back to the exact
    image bytes; unavailable values are `Unknown`, not omitted or zero.
30. [ ] **AC-30 — Complete cost report:** Every R7.39 byte/resource/time category is separate and
    reconciled; KERNAL ROM code is existing zero-output code, not free runtime work. D64 allocation
    and filesystem overhead remain capacity/reporting fields and never enter optimizer `B`, `R`, or
    candidate selection.
31. [ ] **AC-31 — Complete memory report:** Disk-only, resident boot, destination, mutually
    exclusive states, loader/KERNAL, mappings, quiescence, publication, occupied/free intervals,
    largest compatible holes, CPU/VIC views, SFA/ZP/stack ownership, runtime-memory-safety proof
    status, and final ACME reconciliation appear without double counting or false simultaneous
    residency. A seeded omission, overlap, resource failure, or ACME mismatch prevents publication.
32. [ ] **AC-32 — Bounded VICE path:** The fresh D64 boots and completes load/success/failure/basic-
    return observations on pinned VICE 3.10; emulator evidence remains hardware-bounded.
33. [ ] **AC-33 — Targeted real hardware:** A stock PAL C64 with the pinned KERNAL and named
    1541-compatible device records boot/load/error bytes, timing, serial behavior, and deviations;
    until run, status is exactly `VICE-verified / hardware-unverified`.
34. [ ] **AC-34 — Product boundary:** No public package, symbol, example dependency, or generated
    module implements a VFS, asset manager, loader plugin system, game state, loading screen,
    renderer, scene, scheduler, or engine.
35. [ ] **AC-35 — Impact-based qualification:** Focused tiers and one complete RD-07 boundary pass;
    no acceptance claim depends on unrelated readiness or the full legacy compiler corpus.
36. [ ] **AC-36 — Closeout:** Deferral-expiry and durable-register scans re-own every due item,
    Specification 4 and expert `2.0.0` contain the KERNAL/D64 evidence plus `HLE-010`, all public
    links resolve, `spec/` changed only through RD-01's authorized transition, and no unqualified
    fastloader/compressor or target claim remains.

---

## Did You Consider... Checklist

- **Authentication / authorization / sessions / rate limiting:** Not applicable; RD-07 exposes no
  service, account, remote endpoint, or multi-user authority boundary.
- **Input validation / injection / infrastructure hardening:** Applicable to project paths, binary
  assets, D64 arithmetic/encoding, output staging, ACME/VICE process arguments, and generated
  filenames. Requirements above define allowlists, containment, direct serialization, and atomic
  publication; no shell or plugin execution is added.
- **Encryption / secrets / privacy / GDPR / retention / backup / deletion:** Not applicable; the
  compiler handles local source/assets/build artifacts and no credentials or personal records.
  Ordinary filesystem backup/deletion remains the developer's responsibility.
- **Audit logging / export:** No server audit log is needed. The atomic machine-readable build,
  disk, asset, memory, cost, label, and debug evidence is the required export/audit trail.
- **Accessibility / i18n / timezones / onboarding / empty states:** No runtime UI is supplied.
  Diagnostics and examples provide developer onboarding; encoded disk identities use the selected
  C64 mapping and reject unsupported text rather than claim Unicode support.
- **API versioning:** Specification 4 and the exact target profile version the source/API contract;
  D64 and KERNAL identities are explicit. There is no compatibility promise to compiler v3.
- **Failure and recovery:** Build failures publish nothing. Runtime load failure returns `false`,
  leaves destination indeterminate, and gives application source full recovery control.
- **Concurrency:** The baseline is synchronous and requires proved user-route quiescence. Stock
  KERNAL service activity, mapping, stack, and all storage interference remain explicit.
- **Observability:** Exact disk bytes, block chains, destinations, publication state, machine
  resources, costs, emulator identity, and hardware-verification status are inspectable.

---

## Open Questions

None. All scope and behavior choices are resolved in
[00-ambiguity-register.md](00-ambiguity-register.md). Implementation discoveries with semantic
weight must reopen that register before work continues.

# RD-10: Production Qualification and C64U Handoff

> **Document**: RD-10-production-qualification-and-c64u-handoff.md
> **Status**: Draft
> **Created**: 2026-09-10
> **Project**: Blend65 v4
> **Depends On**: RD-05, RD-06, RD-07, RD-08, RD-09
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

RD-10 closes the complete Blend65 v4 C64 production boundary. It does not add another compiler
feature or build a readiness product. It verifies the exact public language, compiler, target,
asset, loading, optimizer, CLI, language-server, VS Code, ACME, VICE, host, and physical-hardware
claims already owned by RD-01 through RD-09. A production claim is permitted only when every
applicable requirement has current evidence through its required endpoint and every remaining
limitation is bounded, documented, and owned. (AR-002, AR-008, AR-011, AR-024, AR-033)

The initial production target set is eight resident C64 PRG profiles plus one PAL/KERNAL/6581 D64
profile. The host set is Node 22 on Linux x64 and Windows x64. VICE 3.10 `x64sc` remains the normal
automated execution oracle, while exact physical C64 configurations close the profile, timing,
CIA, SID, banking, and real-drive claims that emulation cannot prove. RD-10 also proves that the
real shared architecture can accept C64 Ultimate differences without claiming that a `c64u` target,
turbo, REU/DMA, UltiSID, multi-SID, or Ultimate artifact is implemented. It then hands a bounded
evidence packet to the already-owned `blend65-c64u` feature. (AR-024, AR-035, AR-048)

> **Decisions:** AR-002 through AR-005, AR-008 through AR-014, AR-020 through AR-026, AR-029
> through AR-038, and AR-040 through AR-048.

---

## Functional Requirements

### Must Have

#### Production authority and claim closure — complexity XL

- [ ] **R10.1 — Qualify one exact candidate.** Bind the production candidate to one clean Git
  commit, one Specification 4 identity, one active expert-skill `2.0.0` content commit, one Node 22
  release line, exact TypeScript/Yarn/Turbo/Vitest versions, ACME 0.97, VICE 3.10 `x64sc`, and every
  selected host/profile/artifact identity. A dirty tree, mutable version range, mismatched authority,
  skipped required endpoint, or later code change invalidates only the intersecting evidence but
  prevents release until that evidence is refreshed. (AR-014, AR-034, AR-036, AR-048)
- [ ] **R10.2 — Require every prerequisite RD to be complete.** RD-01 through RD-09 must each have
  an approved requirement document, a completed implementation plan, passing applicable acceptance
  evidence, an honest closeout, and no unresolved critical or major finding. A roadmap stage,
  checklist count, readiness score, feasibility row, or inherited v3 result cannot substitute for
  those artifacts. (AR-002, AR-025, AR-033)
- [ ] **R10.3 — Qualify the shipped public path.** Exercise the installed/package-built compiler
  library, `blendc`, language server, packaged VS Code extension, ACME serializer/invocation,
  profile packager, and VICE launcher that users receive. Unit helpers or source-tree-only adapters
  cannot prove a public capability that is missing, differently wired, or excluded from the shipped
  package. (AR-009, AR-021, AR-022)
- [ ] **R10.4 — Preserve atomic failure.** Any compiler diagnostic, ACME failure, packaging error,
  tool mismatch, evidence mismatch, qualification failure, or cancellation observed before the
  publication commit prevents production approval and cannot publish or launch a stale, mixed,
  partial, or runnable-looking artifact set. Publication is the no-return point: later VICE failure
  or run cancellation preserves the successfully committed immutable generation while terminating
  only owned execution. Preserve the last known good release record as historical evidence without
  relabelling it as the current candidate. (AR-022, AR-032, AR-048)
- [ ] **R10.5 — Publish one bounded support statement.** Name only the exact language identity,
  compiler version/candidate commit, nine C64 profiles, native asset/adapter versions, optimization
  modes, safety options, Linux/Windows hosts, tools, and evidence levels that passed. Distinguish
  `Verified complete`, `Verified partial`, `Incorrect`, `Scaffold/stub`, `Unknown`, and
  `VICE-verified / hardware-unverified`; never advertise a broader target, game engine, source
  debugger, hostile-media loader, future asset format, or C64U capability. (AR-002, AR-010,
  AR-024, AR-035, AR-038, AR-040, AR-044, AR-048)

#### Evidence aggregation without a readiness product — complexity L

- [ ] **R10.6 — Create one release closeout record.** Check in
  `docs/releases/v4-production-qualification.md` as a concise index of candidate identity,
  prerequisite RD closeouts, host results, profile/artifact results, ACME/VICE results, physical QA,
  parity/debt, security checks, deferral dispositions, C64U readiness, known limitations, and final
  disposition. Link existing authoritative evidence and hashes instead of copying logs or building a
  second evidence database. (AR-008, AR-011, AR-026)
- [ ] **R10.7 — Reuse evidence only by exact identity.** Reuse a lower-RD result only when its
  source, asset, manifest, compiler, specification, skill, profile, mode, safety, tool, host, and
  artifact identities still match every fact relevant to the release claim. Otherwise rerun the
  smallest intersecting family. Do not rerun an unrelated family merely because another result was
  refreshed. (AR-008, AR-011, AR-022, AR-026)
- [ ] **R10.8 — Keep skips visible.** Record every conditional skip, unavailable tool, unavailable
  hardware configuration, unexecuted profile, and missing producer fixture as `Unknown` for the
  affected endpoint. A required unknown blocks the corresponding production claim; it is never
  converted into a pass through an aggregate percentage. (AR-008, AR-024, AR-040)
- [ ] **R10.9 — Preserve independent oracles.** Language and runtime behavior expectations come
  from Specification 4, selected CPU/platform semantics, and explicit product decisions. Assembly,
  bytes, costs, layout, and parity expectations come from pinned independent evidence and expert
  equivalent work. Generated output, the unoptimized compiler, VICE, or a second decoder cannot be
  its own sole oracle. (AR-002, AR-008, AR-023, AR-040, AR-045, AR-046)
- [ ] **R10.10 — Run one complete relevant release boundary.** After all focused prerequisite
  evidence is green, run the complete integrated release qualification once for the fixed candidate.
  Repeat only failed or invalidated families and their real dependents. Run the complete boundary
  again only when a later change crosses several owned families or creates a new candidate; never
  trigger it after every local correction. (AR-011, AR-026, AR-033)

#### Linux and Windows production hosts — complexity XL

- [ ] **R10.11 — Qualify both production hosts natively.** On clean Node 22 `linux/x64` and
  `win32/x64` environments, install the locked workspace, build/package the public products, run
  language/project/security tests, execute CLI `check`/`build`/fresh `run`, start the LSP, exercise
  the packaged VS Code extension, discover pinned ACME/VICE, cancel owned child trees, and validate
  unique staging, immutable-generation commit, atomic current-record replacement, run pinning, and
  retention cleanup. Linux simulation of Windows paths or processes is supporting evidence only.
  (AR-021, AR-022, AR-036, AR-047, AR-048)
- [ ] **R10.12 — Prove cross-host output identity.** Both production hosts build the same frozen
  release projects under identical profiles, modes, and safety options. Normalized assembly,
  labels, maps, debug evidence, packaged PRG/D64 bytes, diagnostics, and semantic query results are
  byte-identical where their contracts exclude host identity. `.build.json` records canonical
  semantic inputs and portable tool identities and hashes every other artifact, never itself.
  Reproducibility compares those semantic records and deterministic output hashes. Host-side records
  may differ only in `generationId` and explicitly declared tool path/hash, host, duration, and
  peak-memory provenance fields outside that comparison. (AR-022, AR-026, AR-032, AR-048)
- [ ] **R10.13 — Qualify deterministic tool discovery.** On both hosts, prove the exact machine-local
  version-1 tools-file precedence, normal process-`PATH` lookup, version checks, canonical executable
  identity, diagnostic behavior, and no-download/no-shell boundary from RD-09. There is no ordinary-
  install-location registry. `check` and ordinary LSP do not load the file and work with no external
  tools; assembly emission remains available without tools; binary production fails clearly without
  ACME; `run` fails clearly without ACME or `x64sc` and never launches a stale artifact. (AR-022,
  AR-048)
- [ ] **R10.14 — Bound non-production hosts honestly.** macOS, Linux ARM64, and other Node 22 hosts
  remain best-effort even if individual checks pass. Hosts outside the declared Node 22 range and
  32-bit or unknown architectures are unsupported. Promotion requires the same native end-to-end
  host boundary and a recorded requirements decision; Unix similarity alone is not qualification.
  (AR-048)

#### Complete C64 artifacts and emulator boundary — complexity XL

- [ ] **R10.15 — Qualify all eight resident profiles.** Build, assemble, byte-validate, package,
  and execute fresh artifacts for exactly
  `c64-{pal|ntsc}-prg-{kernal|takeover}-{6581|8580}`. Each run records exact profile facts, source
  and artifact hashes, ACME/VICE identity, startup, banking, enabled interrupt/NMI routes, initial
  state, stop condition, expected values/MMIO, normal return or declared nonreturning exit, and
  complete resource evidence. No profile result may stand in for another dimension. (AR-013,
  AR-024)
- [ ] **R10.16 — Qualify the one disk profile.** Build, structurally validate, mount, boot, and run
  a fresh `c64-pal-d64-kernal-6581` 174,848-byte D64 containing its startup PRG and reachable
  uncompressed load units. Prove exact directory/BAM/data chains, destination bytes/canaries,
  success/failure publication, explicit application quiescence, BASIC return, and trusted-media
  `HLE-010` disclosure. No other D64 combination, compressor, or fastloader is implied. (AR-029,
  AR-031, AR-032, AR-042 through AR-044)
- [ ] **R10.17 — Requalify the complete language through real artifacts.** Every normative
  Specification 4 language family has independent positive, boundary, negative, diagnostic, and
  representative composition evidence. At least one required case per family reaches final
  assembled bytes and applicable VICE behavior through the public compiler rather than stopping at
  parser, analyzer, SFA, IL, or emitted assembly. Inexpressible ordinary modern source remains an
  open conformance defect and blocks a complete-language claim. (AR-002, AR-003, AR-014)
- [ ] **R10.18 — Requalify native assets and composition.** Use the exact qualified SpritePad C64
  Pro 3.80/SPD v5, CharPad C64 Pro 3.88/CTM v9, self-contained PSID v1–v4 subset, GoatTracker 2.77,
  classic Koala, and raw producer/format fixtures. Prove selected typed data, symbols, provenance,
  deterministic compile-time composition, Integrator-style refinement, one-copy placement,
  assembled bytes, runtime consumers, and negative format/profile cases. Comparative decoders or
  guessed fixtures cannot qualify a handler. (AR-019, AR-020, AR-038 through AR-041)
- [ ] **R10.19 — Requalify every optimizer mode.** `none` passes complete correctness,
  determinism, direct-lowering, resource, and no-optional-search evidence. `balanced`, `speed`, and
  `size` additionally run the complete relevant transformation matrix with an independent behavior
  oracle and separate assembly/resource expectation. No local optimized result may lose to
  equivalent expert work for its selected objective. Every optimized meet-only result has an
  authorized GitHub issue with measured delta and a concrete path to a future win; each optimized
  mode demonstrates its required realistic whole-program win without hiding bytes, tables, ZP,
  SFA, stack, scratch, load, or timing cost. (AR-023, AR-045, AR-046)
- [ ] **R10.20 — Prove workload expressibility without shipping an engine.** The self-contained
  sprite multiplexing, scrolling, double buffering, input, SID music/effects, fixed-pool,
  collision, state-dispatch, loading, and M1 programs compile and run as user-authored Blend65.
  Inspect public packages and artifacts to prove no renderer, entity system, game-state system,
  scheduler, mixer, scene manager, or gameplay policy is linked or exposed merely because a
  workload was recognized. (AR-027, AR-037, AR-038)

#### Targeted physical C64 qualification — complexity XL

- [ ] **R10.21 — Cover the physical risk dimensions.** Use named base-C64 configurations that
  collectively cover PAL and later NTSC timing, KERNAL and takeover ownership, and both 6581 and
  8580 audio. A configuration may cover several dimensions. Run representative KERNAL and takeover
  artifacts on each video standard and audio fixtures on each SID model. Record C64 model,
  board/ASSY and relevant chip revisions, ROM hashes, video/power environment, peripherals,
  artifact hash, setup, expected and actual observations, frame scope where applicable, and
  deviations. VICE still runs all eight exact profiles; physical QA is targeted rather than an
  exhaustive cartesian hardware matrix. A C64U compatibility run cannot replace base-C64 evidence.
  (AR-013, AR-024)
- [ ] **R10.22 — Target silicon-sensitive behavior.** On the matching units, exercise the exact
  raster/badline and sprite-DMA timing fixtures, IRQ/NMI/CIA edge cases, unusual banking/ROM/I/O
  visibility, startup/restore paths, and every enabled undocumented or silicon-sensitive local
  contract. Any such public contract without its assigned physical result remains
  `VICE-verified / hardware-unverified` and blocks its production claim. (AR-008, AR-013, AR-024)
- [ ] **R10.23 — Qualify physical SID behavior within a bounded claim.** On named 6581 and 8580
  configurations, play the qualified music-only, integrated music/SFX, SFX-only, and cue/subtune
  fixtures. Verify command/cue selection, start/stop/resume, no stuck voice, and the declared
  arbitration path; record audible/model-specific deviations. Digital register traces remain the
  exact behavioral oracle, while listening is bounded analogue compatibility evidence rather than
  a claim that all SID revisions sound identical. (AR-024, AR-040)
- [ ] **R10.24 — Qualify the D64 on a real drive path.** On a stock PAL C64 with the pinned KERNAL
  and a named 1541-compatible drive, test boot, directory visibility, successful and failed loads,
  exact destination/canary bytes, timing, serial/IRQ behavior, device reuse, and BASIC return.
  Record the drive model/firmware and media path. The result does not claim hostile-media
  containment, every drive clone, or every altered disk image. (AR-042 through AR-044)
- [ ] **R10.25 — Reconcile emulator/hardware disagreement.** Preserve both raw observations. Check
  artifact and configuration identity first, then classify the difference by CPU, chip revision,
  timing, analogue behavior, peripheral, emulator model, or compiler defect. Physical evidence
  governs the named physical configuration; neither one run nor an averaged result becomes a
  universal silicon claim. A contradiction affecting a required profile blocks release until fixed
  or the user explicitly narrows the product scope through requirements. (AR-008, AR-024)

#### Production documentation and release surface — complexity L

- [ ] **R10.26 — Document the complete supported workflow.** Supply installation and first-project
  instructions for Linux x64 and Windows x64, machine-local ACME/VICE discovery and overrides,
  `blend65.json`, `check`/`build`/`run`, VS Code trust/commands, nine C64 profiles, optimizer/safety
  choices, native assets, D64 loading, evidence files, diagnostics, and clean cancellation. Every
  command and path example must be exercised on its claimed host. (AR-003, AR-021, AR-022, AR-048)
- [ ] **R10.27 — Document restrictions where users encounter them.** Explain deliberate
  platform-mandated limitations, unsafe default behavior and optional checks, recursion and
  interrupt rules, fixed arrays, address/banking visibility, D64 trusted-media limitations,
  exact asset versions, physical-evidence bounds, and unsupported targets in modern-programmer
  language. Do not document compiler-convenience restrictions as if they were hardware facts.
  (AR-002, AR-003, AR-024, AR-040, AR-044)
- [ ] **R10.28 — Package without publishing externally.** Produce installable local package
  artifacts for the public `@blend65/*` surface, `blendc`, language server, and VS Code extension,
  with locked identities and no development-only source dependency. NPM publication, VS Code
  Marketplace publication, release tags, and public announcements remain separate user-owned
  outward actions and are not performed by this RD. (AR-004, AR-021, AR-025)

#### C64U readiness and owned handoff — complexity XL

- [ ] **R10.29 — Pass the C64U architecture-readiness gate.** Inspect the real shipped architecture
  and prove every item in the C64U readiness table below. A document, interface name, empty target
  package, copied C64 backend, or synthetic registry entry cannot pass. A failed item is corrected in
  its owning v4 seam before production closeout or is recorded as an explicit blocker; it is not
  deferred into C64U implementation. (AR-012, AR-024, AR-035)
- [ ] **R10.30 — Preserve C64 expert quality while opening the seam.** Every readiness correction
  must keep the eight C64 profiles' language behavior, final artifacts, and expert parity intact.
  Do not add an indirect hot-path dispatch, generalized device layer, runtime target probe, widened
  core `word`, universal address, or optional-target payload to C64 output. (AR-002, AR-012,
  AR-024)
- [ ] **R10.31 — Create one evidence-backed handoff packet.** Add
  `codeops/features/blend65-c64u/requirements/_draft/discovery-notes.md` under the existing successor
  owner. It records the exact v4 candidate and passed seam evidence; every still-unknown
  board/firmware, turbo, clock, badline, REU/DMA/transfer, storage, physical/UltiSID topology,
  startup, artifact, emulator, and hardware fact; required primary sources; and the smallest first
  C64U-native vertical proof. It contains no assumed C64U behavior or copied C64 implementation
  decision. (AR-024, AR-035)
- [ ] **R10.32 — Preserve the future-target activation gates.** The C64U work must add
  target-specific frozen behavioral cases, explicitly version-bump the one active expert skill,
  run affected and cross-domain qualification, perform dependent-impact review, and activate the
  new single baseline atomically between compiler journeys. Its target support requires a normative
  appendix and one target-native artifact/emulator/hardware path; C64 compatibility alone is not
  C64U compiler support. (AR-014, AR-024, AR-034, AR-035)
- [ ] **R10.33 — Hand off ownership without implementing C64U.** Keep
  `blend65-c64u/RD-01 — C64 Ultimate Target Family` as the named successor, dependent on this RD,
  and update its roadmap with the handoff artifact when RD-10 closes. Do not add a selectable C64U
  profile, workspace package, feature flag, code stub, emulator case, or support statement in v4.
  (AR-012, AR-024, AR-035)

#### Final deferral and decision closure — complexity L

- [ ] **R10.34 — Run the mandatory deferral-expiry scan.** Answer: “did this RD's deliverables
  expire any deferral's stated rationale?” Walk every v4 ambiguity entry, every RD Won't Have
  section, Specification 4 `future-considerations.md`, the expert-skill deferral/errata records,
  hardware-limitation register, expressiveness ledger, parity-debt issue, and C64U handoff unknown.
  Record each item as still valid with its reason, due with a named owner, satisfied, or superseded.
  (AR-002, AR-014, AR-024)
- [ ] **R10.35 — Leave no orphaned landing place.** RD-10 cannot close while any deferral names
  RD-10, a completed v4 RD, an absent feature, or an unspecified “later” phase as its owner. Reassign
  each due item to a concrete roadmap row or authorized issue. User-visible expressiveness defects
  remain in the conformance ledger; hardware facts remain in the limitation register; C64U-specific
  unknowns belong to `blend65-c64u`. (AR-024, AR-033)
- [ ] **R10.36 — Require explicit production approval.** Present the bounded support statement,
  complete closeout record, unresolved limitations/debt, physical evidence, C64U readiness result,
  and handoff to the user. Do not mark v4 production-complete until the user explicitly approves
  that exact candidate and claim. Approval authorizes the internal lifecycle transition only; it
  does not authorize pushing, registry/Marketplace publication, tagging, or announcement.
  (AR-002, AR-024)

### Should Have

- [ ] **R10.37 — Keep release reproduction concise — complexity M.** Provide one documented command
  sequence per production host that reconstructs the candidate's generated qualification artifacts
  from the clean commit and locked dependencies. It may call existing package/fixture commands but
  cannot create an additional orchestration service or all-purpose release DSL.
- [ ] **R10.38 — Capture bounded responsiveness trends — complexity S.** Include the RD-02/RD-09
  phase-separated compiler, ACME, LSP, run-startup, and peak-memory observations for both production
  hosts. They are diagnostic trends only and cannot fail production through a wall-clock threshold.
  (AR-011, AR-026)
- [ ] **R10.39 — Record optional best-effort host observations — complexity S.** If a macOS or Linux
  ARM64 run is readily available, record its exact boundary and result without delaying the two-host
  production decision or converting it into support. (AR-048)

### Won't Have (Out of Scope)

- A readiness package, execution service, dashboard, score, broad scenario matrix, persistent
  evidence database, generic release framework, or repeated all-tests-after-every-change workflow.
  RD-10 is one release boundary over evidence owned by RD-01 through RD-09. (AR-011, AR-026)
- New language syntax, intrinsics, platform APIs, asset formats, optimization modes, loader
  strategies, compressors, fastloaders, game systems, or debugger adapters. A discovered missing
  product capability reopens its owning requirement; RD-10 cannot patch scope during qualification.
  (AR-002, AR-010, AR-038, AR-042)
- A game engine, renderer, scene/entity/state system, sprite multiplexer, scrolling library,
  scheduler, mixer, asset manager, or gameplay framework. Qualification programs remain
  self-contained user code. (AR-038)
- C64U, C128, X16, Atari 8-bit, or Atari 7800 implementation or support claims; a public target
  plugin system; empty future-target packages; or a runtime target detector. (AR-012, AR-024,
  AR-035)
- Automatic download or installation of ACME, VICE, ROMs, asset-authoring applications, drivers,
  or emulators. Project content cannot select executable commands or tool arguments. (AR-022,
  AR-048)
- General hostile-media integrity, checksum, staged bounded loading, compression, fastloading, or
  disk continuity guarantees beyond the one trusted D64/KERNAL profile. (AR-042 through AR-044)
- Universal proof across every C64 board, chip revision, SID sound, drive clone, peripheral,
  analogue environment, or undocumented behavior. Physical results remain bound to recorded units
  and configurations.
- NPM/Marketplace publication, Git push, release tagging, signing/notarization, or public
  announcement. These are outward release actions requiring separate user direction.

---

## Technical Requirements

### Release qualification matrix — complexity XL

| Boundary | Required release evidence | Blocking rule |
|---|---|---|
| Authority | Specification 4 and expert `2.0.0` exact identities, transition/guard/qualification closeout | Any mismatch or unresolved authority defect blocks all claims |
| Language/compiler | Complete normative families, diagnostics, SFA, IL, `none` lowering, assembled bytes, representative VICE behavior | Any reachable ordinary-language gap or miscompile blocks complete-language status |
| Resident C64 | Eight exact PRG profiles, profile facts, bytes, fresh VICE run, complete costs | A missing dimension cannot inherit another profile's result |
| Assets | Exact producer fixtures/format versions, selectors, derived bytes, layout, consumer behavior, negatives | A guessed/comparative fixture leaves that handler unqualified |
| D64/loading | One exact D64 profile, structure, trusted media, KERNAL load behavior, real drive | No implication of another disk profile or hostile-media containment |
| Optimization | Correct direct `none`; three frontier-searched modes with two independent oracles, complete costs, expert floor, whole-program wins, and linked debt | A `none` correctness/search-boundary failure or optimized regression/untracked meet blocks that mode |
| Tooling | Public API/CLI/LSP/VS Code package, trust, cancellation, debug/evidence coherence | Source-tree-only or mocked public path cannot qualify |
| Hosts/tools | Native Linux/Windows Node 22, deterministic discovery, ACME 0.97, VICE 3.10 | Required host/tool unknown blocks that production host |
| Physical C64 | Targeted PAL/NTSC, KERNAL/takeover, 6581/8580, timing/CIA/banking, and one D64 drive path | Required unverified/contradictory behavior blocks the affected claim |
| Product boundary | Public package and binary inspection plus self-contained workload fixtures | Any injected game/runtime/future-target surface blocks the bounded claim |
| C64U readiness | All readiness-table rows pass against real v4 architecture; handoff packet exists | A failed seam is repaired in v4, not handed off as C64U debt |
| Deferrals/security | Complete disposition scan and security boundary results | An orphaned due item or unresolved critical/major finding blocks closeout |

This is a coverage index, not a Cartesian-product generator. Each lower RD retains ownership of its
focused positive, boundary, negative, resource, and security cases. RD-10 reruns the smallest set
that collectively proves every row and adds only cross-boundary journeys that no individual RD can
prove.

### Cross-host execution topology — complexity L

| Evidence family | Linux x64 | Windows x64 | Cross-host comparison |
|---|---|---|---|
| Install/build/package | Native locked install and public package build | Native locked install and public package build | Package inventory and declared platform differences |
| Language/project/security | Complete applicable suite | Complete applicable suite | Normalized diagnostics/query results |
| Release fixtures | Build all frozen release projects | Build all frozen release projects | Assembly/evidence/PRG/D64 bytes |
| Emulator profiles | Run all eight PRG smokes and D64 smoke | Run all eight PRG smokes and D64 smoke | Final observations for identical artifacts |
| Deep C64 workload suite | Run once on the Linux x64 reference host | Do not duplicate unless Windows changes invalidate it | Same VICE identity plus byte-identical artifact is required for reuse |
| Tooling integration | CLI/LSP/packaged VS Code, discovery and cancellation | CLI/LSP/packaged VS Code, discovery and Windows process-tree cancellation | Same public behavior; host fields remain explicit |

No row authorizes parallel VICE processes when they can contend for ports, temporary state, or host
resources. Emulator runs remain sequential where required. A Windows result cannot be synthesized
from Wine, path-string fixtures, or a Linux container.

### Physical C64 matrix — complexity XL

| Risk dimension | Minimum physical evidence | Focus |
|---|---|---|
| PAL | one named base-C64 PAL configuration; representative KERNAL and takeover artifacts | PAL raster/badline, IRQ/NMI/CIA, banking/restore |
| Later NTSC | one named base-C64 later-NTSC configuration; representative KERNAL and takeover artifacts | separately derived 263-line/65-cycle timing, IRQ/NMI/CIA, banking/restore |
| 6581 | one named base-C64 configuration with 6581 | qualified music/SFX/cue behavior and bounded analogue observation |
| 8580 | one named base-C64 configuration with 8580 | qualified music/SFX/cue behavior and bounded analogue observation |
| PAL disk | stock PAL C64 with pinned KERNAL and named 1541-compatible drive | `c64-pal-d64-kernal-6581` boot/load/serial/error path |

One unit may satisfy several rows when its recorded configuration genuinely matches them. A SID or
video-standard change is a distinct configuration. C64U compatibility mode does not replace
base-C64 evidence, and no row claims every board or chip combination was sampled.

### C64U architecture-readiness gate — complexity XL

| # | Seam that must already be real in v4 | Pass condition without C64U implementation |
|---|---|---|
| 1 | Language and semantic IR | No C64 address, VIC/SID/CIA, PRG, PETSCII, 1 MHz, or NMOS-only assumption changes ordinary language meaning |
| 2 | CPU ownership | Instruction legality, flags, cycles, and CPU identity are selected independently of machine devices and artifact format |
| 3 | Machine ownership | Address visibility, banking, devices, interrupts, reserved memory, and clocks belong to an exact machine/profile contract |
| 4 | Serializer/packager ownership | ACME text and PRG/D64 records are terminal components, not embedded in semantics or CPU selection |
| 5 | Function storage | SFA closes function execution storage only; globals, assets, banks, transfer storage, and packaging remain outside it |
| 6 | Physical identity | Layout, assets, build/debug evidence, and diagnostics can retain direct, banked, and transfer-only storage identity without widening core `word` |
| 7 | Transfer effects | The existing load-unit path represents transfer source/destination, publication, clobbers, synchronization, bytes, and timing explicitly enough for a later DMA implementation |
| 8 | Multiple clocks | Cost/timing facts distinguish CPU, video/bus, SID cadence, serial/loader, and configurable profile clocks instead of scaling one ambient frequency |
| 9 | Device topology | SID/audio evidence can describe selected endpoint topology and deployment preconditions rather than assuming one universal `$D400` device |
| 10 | Optimization | Candidate legality/cost accepts selected CPU, machine, address-space, transfer, clock, and scarce-resource facts without C64 hard-coding or runtime dispatch |
| 11 | Project/tooling | Exact target/profile selection, artifacts, maps, debugger identity, and diagnostics can carry future bank/device/profile facts through existing typed boundaries |
| 12 | Product honesty | No selectable `c64u` ID, empty target package, copied backend, fake emulator case, or C64U support claim exists before the successor qualifies it |

Each row records concrete v4 files/types and at least one existing C64 consumer that proves the seam
is real. Where the future pressure has no current consumer, the gate records the pressure and leaves
the implementation absent rather than creating a speculative abstraction.

### C64U handoff packet — complexity L

The successor discovery seed contains these exact sections:

1. v4 candidate/specification/expert identities and passed C64U-readiness rows;
2. retained C64 compatibility behavior and facts that must not be copied as Ultimate assumptions;
3. pinned and still-required primary board, firmware, register, storage, artifact, emulator, and
   hardware sources;
4. explicit unknowns for model/firmware, turbo modes and clocks, badline/external-device behavior,
   REU/DMA/stream transfer, CPU-visible and transfer-only storage, cartridge/package/startup,
   physical SID sockets, UltiSID mappings, and audio/video/debug streams;
5. source-language, CPU, machine, serializer, packager, layout, optimizer, asset, debug, and tooling
   impact questions;
6. the five activation gates: frozen target-specific cases, expert semantic-version bump, complete
   affected/cross-domain qualification, dependent-impact review, and atomic single-version
   activation between journeys;
7. one smallest C64U-native vertical proof with exact deployment identity and no fallback to a
   renamed C64 artifact; and
8. every transferred deferral, hardware limitation, expressiveness item, or parity debt with one
   named owner and reconsideration reason.

### Evidence freshness and invalidation — complexity M

| Change after evidence | Minimum invalidation |
|---|---|
| Specification or expert rule/source | Every dependent semantic, lowering, parity, platform, asset, and documentation result identified by lineage |
| Compiler semantic/SFA/IR change | Affected language cases plus every downstream artifact/workload using that path |
| Machine lowering/optimizer/layout change | Affected profiles/modes, exact bytes/costs, and downstream VICE/physical result when artifacts change |
| Asset handler/fixture change | Handler cases, derived bytes/layout, consuming artifacts, and runtime observation |
| Serializer/packager change | Exact source/report/bytes/container results and every changed runtime artifact |
| Host/process/tool integration change | Affected native host discovery, cancellation, package, build/run, and cross-host comparison |
| Documentation-only correction | Link/content validation and any claim whose meaning changed; no compiler/emulator rerun when behavior is unaffected |

Changing one profile or host does not invalidate unrelated results by default. The closeout records
the dependency reason for every rerun and every reuse.

### Verification topology — complexity XL

During RD-10 authoring and planning, validate only requirements structure, links, source keys, and
affected documentation. During implementation, use directed tests for each changed family. At the
final candidate boundary:

1. verify all prerequisite closeouts and exact identities;
2. run complete language/project/security qualification on both production hosts;
3. build every frozen release project on both hosts and compare normalized outputs;
4. run the nine bounded VICE profile smokes on both hosts sequentially;
5. run the deep integrated C64/device/asset/optimizer/tooling matrix once on the Linux x64 reference
   host;
6. complete and reconcile the exact physical matrix;
7. inspect package/product boundaries, parity debt, limitations, and all deferrals;
8. run the C64U architecture-readiness gate and create the handoff packet; and
9. freeze the closeout record, rerun only invalidated families, and request explicit production
   approval.

This sequence is not a new command runner or test taxonomy. It invokes and links the focused
verification already owned by each RD and adds only cross-RD/host/profile journeys.

---

## Integration Points

| Owner | RD-10 contract |
|---|---|
| RD-01 | Consume one frozen Specification 4 and expert `2.0.0`; requalify changed authority before proceeding. |
| RD-02 | Consume the clean locked project/package model, compiler-owned output-state rules, immutable generations/current record, and native Linux/Windows paths; add no second model. |
| RD-03/RD-04 | Reuse M1 and the complete `optimization: none` language/SFA/lowering path without retaining M1's subset as a limit. |
| RD-05 | Consume eight resident profiles, platform APIs, user-authored workloads, costs, VICE evidence, and physical assignments. |
| RD-06 | Consume exact producer fixtures, adapter identities, composition, Integrator-style refinement, and interval placement. |
| RD-07 | Consume the one trusted-media KERNAL D64, quiescence/publication, HLE-010, and named real-drive QA. |
| RD-08 | Consume four-mode qualification, independent oracles, full costs, expert-floor results, program wins, and parity debt. |
| RD-09 | Consume public CLI/LSP/VS Code/debug, independent sidecar schemas, config-or-`PATH` tool discovery, and generation/pinning behavior and qualify them on both production hosts. |
| `blend65-c64u/RD-01` | Receive passed seam evidence, unknowns, sources, ownership, and a first target-native proof seed—never implementation claims. |

---

## Non-Functional Requirements

### Correctness and determinism — complexity XL

- Every production claim maps to an exact requirement, candidate identity, independent oracle, and
  evidence endpoint. Identical normalized inputs produce identical normalized outputs on both
  production hosts.
- A required failure, skip, mismatch, stale identity, or physical contradiction blocks only its
  affected claim but blocks the complete v4 production transition while that claim remains in the
  mandatory nine-profile scope.
- Release evidence is append-only or superseded with explicit lineage; a corrected result never
  rewrites history to imply an earlier candidate passed.

### Target performance and resources — complexity XL

- Every shipped target operation and optimization reports complete bytes, data, padding, ZP, SFA,
  hardware stack, scratch, memory traffic, path cycles, loader/transfer, and timing obligations.
- Local expert parity and realistic whole-program improvement apply to the three optimized modes as
  defined by RD-08. `none` reports its competent direct-lowering costs without an expert-optimality
  gate. Host compiler speed is observational and never substitutes for target quality.

### Host responsiveness — complexity S

- Record phase-separated trends on Linux and Windows without duration or peak-memory pass/fail
  thresholds. A measured regression is investigated and owned, not hidden or “fixed” by adding a
  daemon, cache, worker farm, or readiness service.

### Maintainability and portability — complexity L

- Qualification uses the smallest existing owner-specific checks and one integration closeout.
  There is no permanent second workflow product to maintain.
- C64U readiness preserves explicit responsibility seams without generalizing C64 code prematurely.
  No abstraction is added unless a present C64 consumer or unavoidable readiness defect proves it.

### Accessibility and documentation — complexity M

- Supported commands, diagnostics, status, progress, evidence access, and installation guidance are
  available through keyboard-accessible textual surfaces. Color, emulator video, or audio alone
  cannot communicate a pass/failure reason.
- Manual physical/audio evidence includes a textual setup, expected result, actual result, and
  deviation record so another tester can reproduce the bounded observation.

---

## Security Considerations

- **Data sensitivity:** Source, assets, local paths, physical test media, build/debug evidence, and
  unpublished release artifacts may be private. They stay local unless the user separately chooses
  publication; reports avoid unnecessary absolute paths and content dumps.
- **Input validation:** Treat manifests, source/assets, native format files, machine-local tool
  configuration, external-tool output, emulator monitor data, D64 contents, debug/build records,
  physical-QA records, and handoff text as untrusted. Apply their owning schema, size, hash,
  canonicalization, profile, version, and containment rules before use.
- **Authentication and authorization:** N/A for accounts or remote APIs. VS Code workspace trust and
  explicit user commands remain the local execution authorization boundary. Physical test access
  and outward publication remain user-controlled.
- **Injection risks:** Use canonical executable paths and argument arrays, never a shell or `eval`.
  Project, asset, tool output, diagnostic, release record, or handoff content cannot supply an
  executable, option, monitor command, Markdown script, or outside-project artifact path.
- **Encryption needs:** N/A — RD-10 adds no network transport, credential store, or regulated data
  database. Host/workspace storage protection remains the user's operating-system concern.
- **Rate limiting:** N/A for remote abuse. Bound file traversal, tool-output capture, monitor frames,
  retries, cancellation waits, and concurrent processes to prevent local resource exhaustion.
- **Secrets management:** No token, password, signing key, publisher credential, ROM image, or
  private tool license is checked in or required by the production qualification record.
- **Infrastructure:** Linux and Windows jobs use locked dependencies and least-required user
  privileges. They expose no public service, do not run untrusted project builds automatically, and
  retain only intentional evidence/artifacts. Emulator monitor ports remain loopback-bound and are
  closed after each run.
- **Security verification:** Run negative path/symlink, malformed JSONC/native asset, output
  collision, executable/argument injection, hostile tool output, untrusted workspace, cancellation,
  stale artifact, corrupted build/debug record, malformed D64, and unrelated loopback-service cases
  on the owning production hosts.

---

## Scope Decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Production boundary | Partial milestone / complete active language and C64 surface | Complete active language and approved C64 surface | Prevents a partial compiler from being called production. | AR-002 |
| Release verification | New readiness platform / one integration closeout over owner evidence | One bounded closeout | Preserves proof without recreating v3's second product. | AR-011, AR-026 |
| Resident targets | One baseline / eight exact C64 profiles | Eight exact PRG profiles | Qualifies PAL/NTSC, KERNAL/takeover, and 6581/8580 differences honestly. | AR-024 |
| Disk delivery | PRG only / one qualified D64 profile / general loaders | One PAL/KERNAL/6581 D64 | Delivers large assets without a loader framework. | AR-029, AR-042 |
| Hosts | Linux only / Linux and Windows / Linux, Windows, macOS | Linux x64 and Windows x64 production | Covers the current workflow and asset-authoring ecosystem without an unjustified wider matrix. | AR-048 |
| Hardware evidence | VICE only / targeted physical QA / universal hardware matrix | Targeted exact-profile QA | Closes emulator limits while keeping claims bounded to real configurations. | AR-008, AR-024 |
| C64U timing | Implement in v4 / readiness then successor | Readiness plus owned successor | Keeps C64 production bounded while protecting the next target's architecture. | AR-024, AR-035 |
| External release | Publish automatically / prepare and request separately | Prepare local packages only | Publication is an outward user-owned action. | AR-021, AR-022 |

> **Traceability:** Every scope decision references
> [00-ambiguity-register.md](00-ambiguity-register.md). RD-10 introduces no new optional product
> surface; it closes the already-approved production boundary.

---

## Acceptance Criteria

1. [ ] **AC-01 — Candidate identity:** The closeout names one clean Git commit, Specification 4
   identity, expert `2.0.0` content commit, Node/TypeScript/Yarn/Turbo/Vitest versions, ACME 0.97,
   VICE 3.10 `x64sc`, two production hosts, nine profile IDs, and hashes for every primary release
   artifact. Changing one named input invalidates the intersecting result.
2. [ ] **AC-02 — Prerequisite closure:** Every RD-01 through RD-09 row links an approved RD,
   completed plan, acceptance/closeout evidence, and zero unresolved critical/major findings.
   Removing one artifact or substituting roadmap status makes the production gate fail.
3. [ ] **AC-03 — Shipped public path:** Installed local packages and the packaged VS Code extension
   perform compiler-library, CLI, LSP, Build, and fresh Run operations without importing private
   source paths or relying on a source checkout. A working internal helper with a broken package
   entry cannot pass.
4. [ ] **AC-04 — Atomic failure:** Seeded compiler, ACME, packager, VICE, cancellation, hash, and
   qualification failures before publication each publish no new generation and launch no prior
   artifact. A deterministic commit-boundary race proves a post-commit VICE failure/cancellation
   preserves the valid build, reports build success separately, and only terminates owned execution.
5. [ ] **AC-05 — Release record:** `docs/releases/v4-production-qualification.md` contains every
   required section from R10.6, links/hash-binds each reused evidence item, records the final
   candidate disposition, and contains no readiness percentage or feasibility score.
6. [ ] **AC-06 — Evidence reuse:** One unchanged lower-RD family is reused with complete matching
   identity; one changed source/tool/profile family is rejected as stale and only its real dependent
   evidence is rerun. No unrelated complete suite is triggered.
7. [ ] **AC-07 — Honest skips:** Seeded missing VICE, hardware, producer fixture, and optional host
   cases are reported as `Unknown`; each blocks exactly the claim that requires its endpoint and
   none contributes a passing count.
8. [ ] **AC-08 — Independent oracles:** Sample language, asset, optimization, artifact, and runtime
   release cases identify their independent behavior and assembly/bytes/cost oracle. Replacing an
   oracle with generated output or decoder agreement fails review.
9. [ ] **AC-09 — One bounded release run:** The command/evidence log shows directed prerequisite
   checks, one complete integrated candidate boundary, and only dependency-justified reruns after
   failure. It contains no all-tests rerun after each local fix and no new readiness service.
10. [ ] **AC-10 — Native host qualification:** Clean Node 22 `linux/x64` and `win32/x64` runs each
    install, build, package, check, build/run a project, start LSP/packaged VS Code, discover tools,
    cancel owned process trees, and validate unique staging, immutable generation/current-record
    publication, concurrent build/run pins, and bounded retention. Current, active pins, and the
    newest unpinned predecessor survive cleanup; only older unpinned generations are deleted under
    the project lock. First and repeated builds prove that `outDir` is creatable compiler-owned
    output state excluded from discovery/hashes, including under `sourceRoot: "."`; file, symlink,
    escape, and declared-input collisions fail safely. Wine, containers pretending to be Windows,
    or path fixtures cannot replace the native Windows run.
11. [ ] **AC-11 — Cross-host determinism:** Both hosts build all frozen release projects. Normalized
    assembly, labels, maps, diagnostics, debug evidence, PRGs, and D64s are byte-identical. Each of
    `.assets.json`, `.memory.json`, `.costs.json`, and `.build.json` passes its independent versioned
    schema, exact `Unknown`/field/canonical-encoding rules, and unsupported-major cases. Identical
    semantic inputs and portable tool identities yield identical deterministic output hashes;
    `.build.json` excludes itself from its artifact hashes. Only `generationId` and declared
    host/tool-path/hash/timing/memory provenance fields may differ.
12. [ ] **AC-12 — Tool discovery:** Configured path, absent config, single omitted key, PATH, every
    valid override combination, native PATH ordering, wrong-version, broken-symlink, and missing-tool
    cases pass RD-09 precedence on both hosts. Present-file cases require integer `schemaVersion: 1`
    and reject missing/unsupported versions, duplicate/unknown keys, wrong types, and invalid explicit
    paths without fallback. `check` and ordinary LSP do not load the file. No fixed install-location
    case, download, or shell exists.
13. [ ] **AC-13 — Best-effort boundary:** Public support documentation labels macOS, Linux ARM64,
    and other Node 22 hosts best-effort, labels out-of-range/32-bit/unknown hosts unsupported, and
    contains no inference of macOS production support from Unix similarity.
14. [ ] **AC-14 — Eight PRG profiles:** Exactly eight fresh profile builds produce byte-validated
    PRGs and exact VICE 3.10 runs with recorded expected state/exit. Removing or substituting any
    PAL/NTSC, KERNAL/takeover, or 6581/8580 result fails the matrix.
15. [ ] **AC-15 — One D64 profile:** A 174,848-byte `c64-pal-d64-kernal-6581` image passes exact
    BAM/directory/sector/file validation, mounts as drive 8, boots, loads all reachable units into
    canary-bounded destinations, covers success/failure publication, and returns to BASIC. No second
    disk profile or hostile-media guarantee appears.
16. [ ] **AC-16 — Complete language:** Every normative Specification 4 family has positive,
    boundary, negative, diagnostic, final-byte, and applicable VICE evidence through the public
    compiler. A seeded ordinary-source rejection caused only by missing lowering fails completion
    and enters the expressiveness ledger.
17. [ ] **AC-17 — Native assets:** Exact producer/hash fixtures for every supported SpritePad,
    CharPad, PSID, GoatTracker, Koala, and raw identity pass selectors, malformed boundaries,
    deterministic derivation, placement, assembled bytes, and a runtime consumer. A comparative-
    decoder-only fixture remains unqualified.
18. [ ] **AC-18 — Optimizer qualification:** All four modes pass independent behavior,
    assembly/cost, complete-resource, and representative whole-program cases. `none` additionally
    proves deterministic direct lowering and absence of optional search. `balanced`, `speed`, and
    `size` prove deterministic frontier closure; no local selected-objective ratio exceeds 1.0,
    every exact meet links an authorized issue, and each records the required realistic
    whole-program win.
19. [ ] **AC-19 — Compiler-not-engine boundary:** Package/API/binary inspection and the user-authored
    workload programs prove all named game workloads run without any public or injected renderer,
    entity/state, multiplexer, scrolling, scheduler, mixer, scene, or gameplay system.
20. [ ] **AC-20 — Targeted physical coverage:** Named base-C64 configurations collectively cover
    PAL, later NTSC, 6581, and 8580. Representative KERNAL and takeover artifacts run on each video
    standard, audio fixtures run on both SID models, and every record includes the
    unit/chip/ROM/setup/artifact/expected/actual/deviation fields. One unit may cover several
    dimensions; a C64U compatibility run cannot fill a base-C64 row.
21. [ ] **AC-21 — Physical timing and machine state:** Named raster/badline/sprite-DMA, IRQ/NMI/CIA,
    unusual banking, startup, and restoration fixtures match their bounded physical expectations on
    the assigned configurations. Any unresolved required discrepancy blocks the affected profile.
22. [ ] **AC-22 — Physical SID:** Named 6581 and 8580 runs exercise music-only, music/SFX,
    SFX-only, and cue/subtune commands with the expected digital trace and recorded bounded listening
    observations for start/stop/resume/stuck-voice/arbitration behavior.
23. [ ] **AC-23 — Physical disk path:** A stock PAL C64 and named 1541-compatible drive pass boot,
    directory, successful/failed load, destination/canary, timing, serial/IRQ, reuse, and BASIC-return
    observations. The report retains `HLE-010` and makes no hostile-media or all-drive claim.
24. [ ] **AC-24 — Emulator disagreement:** A seeded VICE-versus-hardware difference preserves both
    observations, checks identities, receives one bounded classification and owner, and blocks a
    required unresolved profile rather than averaging or deleting either result.
25. [ ] **AC-25 — Production documentation:** Linux and Windows install/first-project/tool/CLI/
    VS Code instructions execute as written. Profile, mode, safety, asset, loading, evidence,
    limitation, and unsupported-target documentation matches the final support statement.
26. [ ] **AC-26 — Local packaging only:** Installable compiler/CLI/LSP/VSIX artifacts pass package
    inspection and fresh-host use. The execution log contains no push, registry/Marketplace publish,
    tag, signing, notarization, credential access, or announcement.
27. [ ] **AC-27 — C64U readiness:** All twelve readiness-table rows name real v4 files/types and a
    present C64 consumer where applicable, pass without target/runtime overhead, and identify no
    hidden C64 assumption. A fake `c64u` package or registry entry fails rather than helping.
28. [ ] **AC-28 — C64 preservation:** Applying every readiness correction leaves the eight C64
    source behaviors and qualified final artifacts unchanged unless the correction fixes a recorded
    defect; all local parity and whole-program obligations remain green and no runtime target
    dispatch appears.
29. [ ] **AC-29 — C64U handoff:** The existing `blend65-c64u` feature contains one discovery seed
    with all eight sections from the handoff contract, exact v4 evidence links, explicit unknowns,
    primary-source needs, activation gates, and one C64U-native vertical-proof proposal. It contains
    no assumed target fact or copied backend decision.
30. [ ] **AC-30 — No premature C64U support:** V4 public target IDs, packages, configuration,
    examples, tests, artifacts, and support text contain no selectable or claimed C64U implementation.
    The successor roadmap still names `blend65-c64u/RD-01` and its dependency on this RD.
31. [ ] **AC-31 — Deferral-expiry closeout:** The final scan records every ambiguity, Won't Have,
    future consideration, expert deferral/erratum, hardware limitation, expressiveness entry, parity
    issue, and handoff unknown as valid, due/owned, satisfied, or superseded. No item points to RD-10,
    a completed RD, an absent feature, or unspecified later work.
32. [ ] **AC-32 — Security boundary:** Native-host negative cases cover path/symlink containment,
    malformed inputs, output collisions, executable/argument injection, hostile tool/monitor output,
    workspace trust, cancellation cleanup, stale artifacts, corrupted records/D64, and unrelated
    loopback services without outside file/process/network effects.
33. [ ] **AC-33 — Bounded responsiveness:** Linux and Windows closeout records contain
    phase-separated duration and peak-memory observations with complete identities and no wall-clock
    or memory threshold that changes pass/fail.
34. [ ] **AC-34 — Explicit production decision:** The user receives the exact candidate/support
    statement, evidence record, limitations/debt, physical results, C64U gate, and handoff. The
    roadmap does not become production-complete without explicit approval, and that approval causes
    no external publication action.

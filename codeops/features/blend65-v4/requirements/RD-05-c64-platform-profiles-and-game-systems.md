# RD-05: C64 Platform Profiles and Game Systems

> **Document**: RD-05-c64-platform-profiles-and-game-systems.md
> **Status**: Draft
> **Created**: 2026-09-10
> **Project**: Blend65 v4
> **Depends On**: RD-01, RD-02, RD-03, RD-04
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

RD-05 turns the complete, correct `optimization: none` compiler into a complete base-C64
development platform. It implements all eight approved resident-PRG target profiles and the C64
platform-library behavior needed for real games: startup and return, ROM and RAM banking, IRQ/NMI
ownership, raster timing, named VIC-II/CIA/SID access, input, direct sprites, sprite multiplexing,
scrolling, double buffering, music/effect calls, fixed entity pools, collision, and state dispatch.

The platform library hides incidental hardware lore from a modern developer but never hides work.
A constant platform operation lowers to the same direct register access or short sequence an expert
would write. A selected reusable facility links only its reachable code and data, with every byte,
cycle, zero-page location, SFA home, stack byte, interrupt path, and placement constraint reported.
There is no mandatory engine, scheduler, mixer, dispatcher, heap, software stack, or general
runtime.

RD-05 owns platform and game-system behavior, not native authoring-file conversion. It may consume
the already-qualified M1 SpritePad fixture and exact internal audio/reference fixtures, while RD-06
owns complete SpritePad, CharPad, PSID, Koala, raw-asset, and scene-composition handlers. RD-07 owns
disk loading, load units, and overlays. RD-08 adds optional cost-guided and optimizing choices; the
correct general and explicitly selected RD-05 paths must already work under `optimization: none`.

> **Decisions:** AR-002 through AR-004, AR-007 through AR-009, AR-012 through AR-014, AR-018,
> AR-020 through AR-024, AR-026 through AR-030, AR-033, AR-035, and AR-037.

---

## Functional Requirements

### Must Have

#### Exact base-C64 target profiles — complexity XL

- [ ] **R5.1 — Implement exactly eight resident-PRG identities.** Implement and expose only
  `c64-{pal|ntsc}-prg-{kernal|takeover}-{6581|8580}` as the base-C64 resident profiles. Each ID is
  one indivisible, qualified CPU, video, ROM/startup, banking, interrupt, SID, memory, artifact,
  exit, and evidence contract. Reject unknown IDs and unqualified mixtures rather than composing
  independent user switches. (AR-013, AR-024, AR-030, AR-035)
- [ ] **R5.2 — Bind every profile to exact evidence facts.** Each profile record names NMOS 6510
  legality, PAL or later-NTSC raster geometry, the exact VICE 3.10 machine selection, compatible
  VIC-II/SID/CIA and board assumptions, KERNAL ROM identity where used, `$0000/$0001` and
  `$DD00/$DD02` ownership, enabled interrupt/NMI sources, usable/reserved RAM and zero page,
  hardware-stack capacity, assembler identity, PRG startup, and physical-QA boundary. The NTSC
  profiles do not claim the early 262-line/64-cycle 6567R56A model. (AR-008, AR-013, AR-024)
- [ ] **R5.3 — Keep profile differences compile-time visible.** Provide immutable selected-profile
  facts for video standard, rational frame rate, raster lines/cycles, CPU clock class, SID model and
  endpoint, ownership mode, and capability availability. A compile-time-selected branch disappears
  even under `optimization: none`; runtime probing, string IDs, and generic profile dispatch are
  forbidden. (AR-023, AR-030)
- [ ] **R5.4 — Implement KERNAL-profile startup and return.** The four `kernal` profiles load at
  `$0801` with a BASIC `SYS` entry, bank BASIC ROM out while keeping KERNAL and I/O visible, establish
  binary arithmetic and all declared device/resource state, initialize only language-required
  storage, run module initializers then `main`, and restore every compiler-owned change before a
  normal return to BASIC. No initialized range already loaded at its final address is copied.
  (AR-013, AR-024)
- [ ] **R5.5 — Implement takeover-profile startup and return.** The four `takeover` profiles use a
  separately qualified raw ownership path: BASIC and KERNAL execution are absent while application
  code runs; I/O and the required RAM/vector storage remain visible; the compiler owns all enabled
  IRQ/NMI sources and vectors; and every entry remains valid across every reachable bank state.
  Startup installs the complete raw vectors before exposing them. A normal `main` return restores
  the captured machine state and returns to BASIC; an exit with an unreleased exclusive resource is
  rejected or follows an explicitly nonreturning source path. (AR-013, AR-024)
- [ ] **R5.6 — Distinguish compatibility from timing proof.** Ordinary profile behavior uses the
  documented common subset for its declared models. Every cycle-stable raster, sprite, CIA, or SID
  claim additionally binds the exact device revision/model and final layout used by that local
  contract. VICE-only evidence is reported as `VICE-verified / hardware-unverified` until RD-10's
  required physical checks close the claim. (AR-008, AR-024)
- [ ] **R5.7 — Qualify every complete profile identity.** Factor repeated CPU, video, ownership, and
  SID proofs by dimension, but run a bounded fresh build/ACME/PRG/VICE smoke for all eight exact
  IDs. Each smoke records the selected profile, artifact hash, emulator configuration, initial
  state, stop condition, expected memory/device state, and normal or declared nonreturning exit.
  (AR-009, AR-022, AR-024)

#### Memory, banking, and named hardware access — complexity XL

- [ ] **R5.8 — Model CPU, VIC-II, and physical storage separately.** Carry logical address,
  CPU-selected RAM/ROM/I/O storage, access direction, VIC bank-relative storage, visibility,
  volatility, and bank state as distinct facts. Equal numeric addresses cannot prove aliasing or
  visibility, and a bank change cannot be moved across an affected access. (AR-007, AR-013)
- [ ] **R5.9 — Complete the selected-profile memory map.** Reserve `$0000/$0001`, page one, active
  ROM/system work areas, vectors, device space, screen/pointer tails, compiler homes, user zero-page
  objects, and every selected game-system owner. Reject overlap, invisibility, an invalid zero-page
  pair, or an unprovable stack peak before assembly. SFA continues to own only function-execution
  storage; platform layout owns globals, devices, assets, vectors, and library state. (AR-007,
  AR-013, AR-020)
- [ ] **R5.10 — Provide scoped banking operations.** A Specification 4 C64 banking operation
  changes only declared `$0000/$0001` fields, preserves the real DDR and output-latch state,
  accounts for IRQ and unmaskable NMI exposure, keeps all reachable code/vectors/homes visible, and
  restores CPU interrupt state, device masks, DDR, latch, and mapping on every normal exit. Reject a
  scope whose pending-source or NMI behavior cannot be preserved; do not inject a generic banking
  manager. (AR-013, AR-024)
- [ ] **R5.11 — Expose named typed device operations.** The normative C64 appendix defines the
  exact public platform-library modules and operation signatures for VIC-II, CIA1, CIA2, SID, CPU
  port, vectors, and KERNAL services. Source uses named registers/fields and semantic actions rather
  than unexplained addresses. Direct `PEEK`/`POKE` remains available as the explicit raw volatile
  boundary. (AR-003, AR-014)
- [ ] **R5.12 — Preserve device-specific access effects.** Represent and lower ordinary full-byte
  writes, shared bitfields, write-one-to-clear status, read-to-clear latches, differing read/write
  meanings, write-only state, and cycle-sensitive accesses separately. Preserve exact address,
  direction, width, count, order, bus pattern, and declared timing; never replace a device
  acknowledgement with a semantically different RMW. (AR-002, AR-008)
- [ ] **R5.13 — Make platform abstractions zero cost.** A constant named operation emits the expert
  direct instruction sequence, reusing a proven live register value when legal. It cannot add an
  indirect call, generic dispatch, runtime address calculation for a link-time fact, duplicate
  volatile access, implicit data copy, or hidden temporary. Any necessary shadow byte or critical
  section is linked only for a selected consumer and reports its complete cost. (AR-002, AR-008,
  AR-012)
- [ ] **R5.14 — Derive hardware selectors from final placement.** Screen, charset, bitmap, sprite
  block, pointer-table, VIC-bank, and CIA2/`$D018` fields derive from solved symbolic placement.
  Misalignment, mixed banks, a character-ROM visibility conflict, an out-of-bank object, or shared
  CIA2 ownership conflict is a source-linked layout error—not a runtime division, address table, or
  data-copy request. (AR-007, AR-020)

#### Interrupts, timers, and frame timing — complexity XL

- [ ] **R5.15 — Implement every Specification 4 interrupt sink exactly.** Preserve callback-only
  `interrupt function` identity to each recognized C64 sink. The normal KERNAL CINV chain, advanced
  KERNAL-exclusive CINV path, raw IRQ path, KERNAL NMINV paths, and raw NMI paths each use only
  their profile-authorized entry, save, decimal-state, acknowledgement, link, restoration, and
  terminal contract. Only reachable entry/body variants are emitted. (AR-013, AR-018, AR-024)
- [ ] **R5.16 — Make handler installation reversible.** Every replaceable vector operation has the
  corresponding Specification 4 restore/uninstall operation, retains exactly one page-safe saved
  predecessor where chaining/restoration needs it, and updates two-byte vectors only in a proven
  safe transaction. Restoring a handler cannot silently discard another owner installed after it;
  ownership misuse receives a compile-time diagnostic where statically visible. (AR-013, AR-018)
- [ ] **R5.17 — Close every interrupt route before emission.** For each enabled source, enumerate
  source and entry kind, vector/link storage, acknowledgement owner, terminal owner, enabled peer
  sources, nesting/re-entry, bank visibility, SFA interference, shared state, handler/wrapper bytes,
  existing-ROM bytes, hardware-stack peak, and entry/body/acknowledgement/restore/exit cycles. An
  unknown source, unbounded nesting cycle, unsafe home overlap, or missing exit blocks the build.
  (AR-008, AR-013, AR-018)
- [ ] **R5.18 — Preserve shared-state reality.** Mainline, IRQ, and NMI private invocation storage
  receives disjoint SFA homes when overlap is possible, but globals, assets, device state, and
  deliberately shared game variables remain shared. Warn on statically visible lost-update RMW or
  torn multi-byte access. Never clone program state or mask interrupts silently; provide explicit
  bounded publication/critical-section operations where the platform contract permits them.
  (AR-003, AR-018)
- [ ] **R5.19 — Implement VIC raster ownership and acknowledgement.** Raster compare updates preserve
  `$D011`'s shared fields, avoid a two-write accidental match, distinguish pending status from
  enable state, and acknowledge only selected `$D019` bits with the correct write-one effect. A
  raster handler's source, line, entry jitter, badline and sprite-DMA exposure, late behavior, and
  next-event ownership are explicit. (AR-008, AR-013)
- [ ] **R5.20 — Implement CIA timer and interrupt operations.** Distinguish counter observation from
  latch programming, model byte order and running state, treat `LOAD` as a strobe, and preserve
  CIA1/CIA2 board-level ownership. Read each owned ICR result once, dispatch every returned pending
  bit, and never reconstruct mask state by reading the acknowledgement register. Revision-sensitive
  edge claims remain hardware-bounded. (AR-008, AR-013)
- [ ] **R5.21 — Support explicit frame and raster schedules without a hidden scheduler.** Source
  owns its game loop, logical cadence, audio tick, and requested interrupt schedule. Compile-time
  constant schedule declarations or platform operations may produce a straight chain, bounded
  table, or unrolled kernel only when all target facts and path bounds are closed. There is no
  background task, callback registry, runtime event queue, or compiler-invented update cadence.
  (AR-002, AR-012, AR-023)
- [ ] **R5.22 — Prove cycle-stable local contracts.** A stable region fixes the exact VIC model,
  trigger line and target bus-write cycle/window, entry jitter, bus denial, branch/page layout,
  register/flag state, calls, shared ownership, and late/overrun behavior. Variable or unbounded
  work is moved outside the region or diagnosed. The frozen expert double-IRQ baseline is a
  qualification case, not an automatic default or new language construct. (AR-008, AR-013)
- [ ] **R5.23 — Compute complete frame budgets.** For each game-system slice, begin with
  model-specific CPU opportunities, subtract the union of actual badline and sprite-DMA bus denial,
  then charge interrupt, input, simulation, render preparation, audio, and safety margin by
  worst-case path. Do not use nominal instruction cycles, frame averages, or double-counted BA lead
  time as proof that a path fits. (AR-008, AR-024)

#### Input and direct VIC-II game operations — complexity L

- [ ] **R5.24 — Implement both joystick ports correctly.** Provide active-low up/down/left/right/fire
  snapshots for ports 1 and 2. Preserve CIA1 DDRs/output latches and unrelated bits, respect keyboard
  line sharing, and perform one port read plus the required mask when preconditions prove that form.
  Do not touch CIA2 or hide a keyboard scan in a joystick read. (AR-003, AR-013)
- [ ] **R5.25 — Implement keyboard and combined-input scanning.** Provide named-key tests and a
  stable keyboard snapshot using the exact 8×8 matrix, declared column-drive sequence, DDR/latch
  restoration, ghosting behavior, and joystick coexistence policy. Debounce, key repeat, and
  per-update publication are explicit opt-in source facilities with visible storage/cycle costs;
  `RESTORE` remains an NMI source. (AR-003, AR-013)
- [ ] **R5.26 — Implement all eight hardware sprites.** Provide typed operations for 9-bit X,
  byte Y, enable, expansion, multicolor, priority, per-sprite/shared colors, and placed image
  pointers. Shared registers use one proved owner/shadow or a scheduled full write. Constant
  operations lower directly; no per-sprite object, dispatch loop, or copied image is compulsory.
  (AR-003, AR-007, AR-013)
- [ ] **R5.27 — Preserve collision-latch semantics.** Sprite/sprite and sprite/background collision
  operations perform one intentional read at the requested point and expose the resulting bitset.
  They cannot be hoisted, duplicated, commoned, or reread as though the latch were ordinary memory.
  Higher-level collision remains ordinary source logic unless explicitly selected. (AR-002,
  AR-013)
- [ ] **R5.28 — Provide direct standard display operations.** Support the five documented standard
  VIC-II modes, screen/charset/bitmap base selection, border/background/palette fields, screen and
  Color RAM access, fine-scroll fields, and safe pointer/base flips. Mode selection validates every
  required resident object and never performs an implicit runtime conversion or full-screen copy.
  (AR-003, AR-007, AR-013)

#### Opt-in sprite, scrolling, and buffer systems — complexity XL

- [ ] **R5.29 — Provide a fixed-capacity sprite multiplexer.** The opt-in facility consumes a
  source-declared fixed logical pool with positions, image pointers, colors, expansion/priority
  policy, deterministic tie order, maximum capacity, and visible overflow/drop result. Mainline
  culls/sorts/builds an inactive schedule; one atomic selector publishes it; IRQ code reads only
  that immutable schedule and owns every changed shared VIC register. (AR-002, AR-012, AR-013)
- [ ] **R5.30 — Select no universal sprite sorter.** Provide the correct general deterministic path
  and compare only credible bounded candidates such as insertion order, Y buckets, or preordered
  layers when the source/profile facts make them applicable. Under `optimization: none`, the
  explicitly selected/reference path remains correct. Automatic cost-guided sorter or schedule
  specialization belongs to RD-08. (AR-023, AR-033)
- [ ] **R5.31 — Qualify multiplexing against the frozen expert workload.** Reproduce the Q-P13
  24-logical-sprite PAL baseline's accepted/drop order, table publication, hardware-channel reuse,
  exact raster events, write order, stack/SFA separation, and all code/data/ZP/vector/padding costs.
  Reject its numeric budget when any pinned model, ownership, placement, expansion, NMI, banking,
  or interval precondition differs. Add a separately derived NTSC schedule rather than scaling PAL
  raster lines. (AR-008, AR-013, AR-024)
- [ ] **R5.32 — Separate fine and coarse scrolling.** Horizontal and vertical scrolling each expose
  their fine VIC field, coarse row/column or tile update, off-screen preparation, Color RAM work,
  object-coordinate adjustment, and visibility publication. The implementation handles both
  increasing and decreasing movement and crossings at character-cell and map-width boundaries
  without byte-index truncation. (AR-002, AR-013)
- [ ] **R5.33 — Implement explicit double-buffer ownership.** A buffer declaration identifies what
  is doubled: screen matrix, charset, bitmap, software render state, or command/sprite schedule.
  Mainline writes only the inactive state and publishes through a proved atomic selector/pointer;
  the consumer flips a link-time-derived base or pointer only after completion. Different evolving
  buffers are distinct state, while identical static replication still needs a necessity/cost
  proof. (AR-007, AR-013, AR-020)
- [ ] **R5.34 — Qualify scrolling and buffering through real slices.** Provide at least one standard
  text-mode horizontal scrolling slice, one vertical scrolling slice, one screen-matrix flip, and
  one logical schedule handoff. Each slice proves output cells/colors, edge publication, bank and
  alignment, no torn frame, no hidden full-screen copy, and complete worst-frame resource cost on
  its PAL and NTSC profile. (AR-008, AR-024, AR-033)

#### SID music and effects — complexity XL

- [ ] **R5.35 — Provide safe direct SID operations.** Expose all three voice blocks and global
  filter/volume fields through model-aware named operations. Preserve write-only state with complete
  known writes or explicit shadows, keep `$D417` routing and `$D418` mode bits in their documented
  order, use a deliberate gate transition for retrigger, and permit reads only from the selected
  profile's defined readable endpoints. (AR-003, AR-013, AR-024)
- [ ] **R5.36 — Implement the player-neutral audio API.** Implement the exact Specification 4
  operations for default/numeric/named song initialization, one explicit player tick, named SFX,
  and optional logical voice `0..2`. Compile-time names emit no string/name table. A constant call
  lowers directly to the selected adapter's register setup and absolute `JSR`; no generic
  scheduler, mixer, queue, dispatcher, or copied payload is added. (AR-002, AR-012, AR-014)
- [ ] **R5.37 — Support all four deliberate audio paths.** The platform contract can select music
  only, integrated music+SFX, minimal SFX only, or one exact qualified custom player. Each path
  states its available operations, cadence, entry ABI/clobbers, writable/self-modifying ranges,
  placement/banking, SID topology/model, voice arbitration, priority/replacement/resume,
  reentrancy, and complete resources. Missing fields remain unavailable rather than guessed.
  (AR-008, AR-013, AR-024)
- [ ] **R5.38 — Keep audio scheduling source-owned.** `audioTick()` performs exactly one update at
  the user's call site. A game may call it from a main loop, raster IRQ, or timer IRQ only when the
  selected adapter's cadence and call domain match. Reject reachable concurrent use of nonreentrant
  player state unless an explicit bounded critical section safely masks every racing source and
  reports its cost. (AR-002, AR-018)
- [ ] **R5.39 — Prove commands, effects, and tune fragments.** A real audio slice starts a theme,
  triggers action effects such as shot/collision/explosion, selects distinct win and loss cues or
  subtunes, and proves same-frame arbitration and music resume according to one exact contract.
  Behavior checks the selected cues and ordered register/call trace; assembly checks direct call
  sequences and every linked code/data/ZP/stack/cycle cost. Analogue 6581/8580 similarity is never
  inferred from the digital trace. (AR-008, AR-024, AR-033)
- [ ] **R5.40 — Preserve the native-audio boundary.** RD-05 proves SID and adapter-call behavior
  with exact hash-bound platform/reference fixtures. RD-06 supplies and qualifies the first
  GoatTracker 2.77/native PSID import path and later handler-owned adapters. A PSID header alone
  never proves an SFX API, writable state, reentrancy, or voice arbitration. (AR-012, AR-033)

#### Fixed game state, collision, and dispatch — complexity L

- [ ] **R5.41 — Provide bounded fixed-pool building blocks.** Reusable source modules use fixed
  arrays plus an active count, bitset, or free list; all maximum counts and overflow outcomes are
  explicit. Pools larger than 255 use word-capable ordinals automatically. No allocator, heap,
  hidden handle table, or dynamic array is linked. (AR-002, AR-012, AR-014)
- [ ] **R5.42 — Preserve source-level data layout semantics.** Ordinary AoS, SoA, and hybrid layouts
  remain expressible. Public addresses, aliases, placement, and volatile identity constrain any
  later relayout. RD-05 supplies correct direct paths; automatic layout selection or scalarization
  is an RD-08 optimization and must compare complete code/data/setup costs. (AR-002, AR-020,
  AR-023)
- [ ] **R5.43 — Provide bounded collision building blocks.** Support explicit broad-phase lists,
  grids/buckets, or sorted intervals and narrow-phase point, half-open AABB, sprite, mask, or tile
  tests over fixed capacity. Every result buffer has an exact order and overflow result. Arithmetic
  width follows world/map range rather than screen width; a full buffer never overwrites memory or
  silently drops an unreported result. (AR-002, AR-014)
- [ ] **R5.44 — Support deterministic state dispatch.** Ordinary switch/compare chains, tables, and
  finite typed function values preserve declared update order and the complete call/SFA domain.
  The correct `none` path never requires a dispatcher runtime. RD-08 may specialize a proven finite
  target set or select a table only when its complete costs beat the chain for the selected goal.
  (AR-018, AR-023)
- [ ] **R5.45 — Qualify the 320-slot expert workload.** Run the frozen Q-P16 workload with 320
  slots, 40 active word ordinals including slot 270, eight states, deterministic update order,
  half-open AABB results, a 96-pair result bound, and the clustered overflow counterexample. Under
  `optimization: none`, prove exact state and collision behavior plus final addresses/index widths;
  record candidate costs without pretending RD-08 has selected an optimized layout. (AR-008,
  AR-023, AR-033)
- [ ] **R5.46 — Link reusable facilities only when reached.** Built-in source/platform-library
  modules compile through the normal frontend and call graph. Unused input policies, raster
  templates, multiplexers, scroll paths, buffers, audio features, collision strategies, and state
  helpers contribute zero artifact bytes, RAM, ZP, stack, startup work, and runtime cycles.
  (AR-002, AR-012)

#### Evidence, diagnostics, and closure — complexity XL

- [ ] **R5.47 — Emit one complete platform resource report.** Report CPU-visible ranges and mapping,
  VIC bank intervals, alignment/padding, screen-pointer tails, code, immutable/mutable data, BSS,
  globals, SFA, user/compiler ZP, hardware-stack peak by domain, vector/saved-link storage, device
  shadows, selected library/player code and state, replicas, startup/exit, IRQ/NMI routes, frame
  budgets, and every unresolved physical-QA bound. Useful payload and reserved address space remain
  separate totals. (AR-008, AR-013)
- [ ] **R5.48 — Make platform failures actionable.** Diagnostics name the exact profile, source
  operation/object/handler, violated device or ownership rule, required versus available bytes,
  range/alignment/bank/timing facts, shortest call/preemption path, and a realistic remedy. A
  missing compiler proof cannot be disguised as a language restriction or unusual source rewrite.
  (AR-003, AR-008)
- [ ] **R5.49 — Use independent game-system behavior oracles.** Derive expected sprites, cells,
  colors, input masks, collision pairs, state changes, audio commands, MMIO order/count, interrupt
  restoration, and timing signatures from Specification 4 plus hardware semantics—not generated
  assembly or a second compiler path. Optimized-versus-unoptimized comparison remains supporting
  evidence only. (AR-002, AR-008)
- [ ] **R5.50 — Enforce expert assembly and complete cost expectations.** Every platform operation
  and selected facility has an equal-contract hand-written reference or independently reviewed
  expert bound. Compare final assembled bytes, hot/cold/worst-path cycles after final placement,
  setup, data, padding, ZP, SFA, stack, interrupt, and frame effects. A local result below expert
  parity is a defect, not acceptable because optimization is `none`. (AR-002, AR-008, AR-023)
- [ ] **R5.51 — Keep verification impact-based.** During implementation run focused profile,
  hardware-operation, game-system, assembly, and VICE cases for the changed family. At each
  completed family run its complete relevant qualification; at RD closeout run the integrated
  RD-05 boundary once. Do not run unrelated repository suites after each change or recreate a
  readiness service, scorecard, or synthetic matrix. (AR-026, AR-033)
- [ ] **R5.52 — Close the resident C64 platform boundary honestly.** At closeout, all eight PRG
  identities and every RD-05 platform/game-system capability are either directly qualified or
  absent from the public surface. RD-06 native assets/scenes, RD-07 disk loading, RD-08 optional
  optimization, RD-09 complete tooling, and C64U remain explicitly incomplete. No profile,
  placeholder package, or unexecuted hardware claim can be reported as support. (AR-024, AR-033,
  AR-035)
- [ ] **R5.53 — Recheck portability and deferrals.** Confirm shared frontend/semantic/SFA/CPU
  responsibilities contain no C64 address, VIC/SID/CIA, PRG, screen-code, 1 MHz, or selected-ROM
  assumption. Walk all ambiguity registers, Won't Have sections, future-consideration triggers,
  and the expressiveness ledger; reopen every deferral whose reason RD-05 invalidated and assign a
  new owner before closeout. (AR-024, AR-030, AR-035)

### Should Have

- [ ] **R5.54 — Provide small modern examples — complexity M.** Add focused, runnable examples for
  named MMIO, joystick/keyboard snapshots, reversible IRQ installation, direct sprites, a
  multiplexer, scrolling, buffer publication, music/effects, fixed pools, collision, and state
  dispatch. Examples show game intent and source ownership rather than raw register folklore.
  (AR-003, AR-033)
- [ ] **R5.55 — Preserve readable machine evidence — complexity M.** Generated ACME uses stable
  labels for startup, handlers, schedules, buffers, player calls, and safety/late paths. Maps and
  reports connect each emitted range and machine effect to the selected source operation and
  profile contract without becoming a second source of truth. (AR-008, AR-010)
- [ ] **R5.56 — Record host responsiveness observations — complexity S.** At the completed RD-05
  boundary, record phase-separated check/build/ACME/VICE-control duration and peak host memory for
  its representative real slices. These values are trends, never wall-clock pass/fail gates.
  (AR-026)

### Won't Have (Out of Scope)

- Native SpritePad, CharPad, PSID, Koala, raw-asset, or Integrator-style scene-handler completion;
  RD-06 owns those import and composition paths. The already-qualified M1 fixture and exact internal
  reference fixtures may be consumed without broadening their handler claims. (AR-033, AR-037)
- D64 packaging, `loadable const` transport, fastloaders, decompression, overlays, or streaming;
  RD-07 owns them. (AR-029, AR-031 through AR-033)
- `balanced`, `speed`, or `size` transformations, automatic representation/layout choice, general
  unrolling, machine peepholes, or global optimization; RD-08 owns them. (AR-023, AR-033)
- A hidden game engine, scheduler, entity-component system, scene graph, allocator, mixer, task
  system, callback registry, or general runtime. (AR-002, AR-012)
- Automatic FLI, FLD, border opening, line/sprite crunch, VSP/AGSP, undocumented opcodes, or other
  silicon-sensitive effects inferred from ordinary source. They require a separately authorized,
  named local contract and physical compatibility proof when a real vertical consumer needs them.
  (AR-002, AR-012, AR-024)
- A public platform/asset plugin framework, custom profile composition language, user-authored
  target definitions, or arbitrary device-description registry. (AR-012, AR-024)
- C64U, REU/DMA, turbo, multi-SID/UltiSID, C128, X16, or Atari implementation. C64U remains the
  already-owned next feature and RD-10 readiness handoff. (AR-024, AR-035)
- Complete production editor/debugger workflow or source debug adapter; RD-09 owns tooling, and an
  owned debug adapter remains conditional. (AR-010, AR-021, AR-033)

---

## Technical Requirements

### Profile composition contract — complexity L

The eight identities form this closed matrix:

| Video | Ownership | SID | Required profile ID |
|---|---|---|---|
| PAL | KERNAL | 6581 | `c64-pal-prg-kernal-6581` |
| PAL | KERNAL | 8580 | `c64-pal-prg-kernal-8580` |
| PAL | takeover | 6581 | `c64-pal-prg-takeover-6581` |
| PAL | takeover | 8580 | `c64-pal-prg-takeover-8580` |
| NTSC | KERNAL | 6581 | `c64-ntsc-prg-kernal-6581` |
| NTSC | KERNAL | 8580 | `c64-ntsc-prg-kernal-8580` |
| NTSC | takeover | 6581 | `c64-ntsc-prg-takeover-6581` |
| NTSC | takeover | 8580 | `c64-ntsc-prg-takeover-8580` |

The Specification 4 C64 appendix is the normative owner of every exact fact and public operation.
RD-05 implements that appendix; it does not duplicate it in a configurable host-side registry.
Structured internal facts are allowed only when consumed directly by legality, layout, startup,
lowering, reporting, or proof.

### Ownership and cost envelope — complexity XL

Every selected game facility supplies this minimum compile-time record:

| Field | Required result |
|---|---|
| Intent | The source-visible game or hardware operation |
| Machine facts | Exact profile, device model, banking, IRQ/NMI, visibility, writable-code state |
| Ownership | Registers, bitfields, vectors, buffers, source events, and terminal/restore owner |
| Execution | Mainline/IRQ/NMI domain, calls, reentrancy, publication, late/overflow behavior |
| Storage | Code, immutable/mutable data, padding, ZP, SFA, stack, shadow/link/vector bytes |
| Timing | Setup plus best/worst/path cycles, DMA-adjusted frame/raster fit where observable |
| Evidence | Independent behavior oracle, assembly/cost expectation, VICE observation, hardware bound |

This record is evidence carried by the smallest existing representations and reports. It is not a
new runtime registry, universal game-system interface, or requirement for one class per row.

### Frame/publication model — complexity L

The default reusable pattern is explicit and bounded:

1. mainline samples input and updates ordinary fixed game state;
2. mainline prepares only inactive display/sprite/audio command state;
3. one byte or otherwise proved atomic value publishes the completed state;
4. a bounded frame/raster handler reads that publication once and performs only scheduled work;
5. the former visible state becomes reusable after the declared hardware visibility boundary.

The compiler may prove and specialize this pattern later, but it does not invent a game loop,
silently move user work into an IRQ, or serialize a shared update by masking interrupts.

### Qualification lineage — complexity M

RD-05 implementation evidence binds the frozen Specification 4 identity and expert baseline
`2.0.0` activated by RD-01. The decisive expert reference families are C64 hardware, C64 memory and
runtime ownership, C64 game engineering, SFA/ABI, 6502 lowering, ACME/artifacts, and target
portability. A changed expert baseline pauses affected implementation and follows the single-active
version, qualification, dependent-audit, and atomic-activation protocol. (AR-014, AR-024, AR-034)

---

## Integration Points

### With RD-01 (Specification 4.0 and Expert Authority Freeze)

- Consumes one frozen Specification 4 C64 appendix containing exact profile and platform-library
  contracts and one qualified expert baseline `2.0.0`.

### With RD-02 (Clean V4 Foundation and Deterministic Project Model)

- Extends the real C64 platform/packager components and records one exact profile ID in each
  coherent project snapshot and artifact set.

### With RD-03 (Playable M1 Complete Pipeline)

- Retains M1 as the first profile's direct-sprite/input/startup regression and extends that same
  pipeline; it does not fork an advanced-game compiler.

### With RD-04 (Complete Language and Correct Unoptimized Compiler)

- Consumes complete target-neutral semantics, function/interrupt kinds, effects, SFA closure,
  legal NMOS lowering, and `optimization: none`; adds only selected-platform facts and facilities.

### With RD-06 (Native Assets, Scene Composition, and Resident Layout)

- Supplies device, bank, mode, pointer, audio-adapter, renderer, and resource contracts that native
  asset handlers must satisfy. RD-06 replaces internal/reference fixtures with qualified producer
  formats without changing RD-05 game semantics.

### With RD-07 (Loadable Assets and D64 Delivery)

- Exposes exact IRQ/audio/banking/frame ownership that a later loader must pause, preserve, or
  coexist with; RD-05 itself remains resident PRG only.

### With RD-08 (Optimization and Expert Output)

- Supplies correct general/reference game-system paths, complete costs, effects, ranges, layout,
  and independent oracles. RD-08 may choose better equivalents but cannot repair missing RD-05
  semantics or device ownership.

### With RD-09 (Developer Tooling and Debug Evidence)

- Publishes profile facts, platform symbols, handler domains, maps, cycles, resources, and source
  provenance for hover, diagnostics, build/run, generated-artifact access, and later debugging.

### With RD-10 (Production Qualification and C64U Handoff)

- Supplies the eight qualified PRG identities, VICE evidence, and bounded physical-QA list. RD-10
  runs the integrated release gate and verifies that C64U extension seams remain real.

---

## Scope Decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Base-C64 coverage | First profile only / eight exact combinations | Eight exact PRG profiles | Covers real PAL/NTSC, ownership, and SID differences without unsafe flag mixtures. | AR-024 |
| First profile | Cooperative PAL KERNAL / takeover / NTSC | `c64-pal-prg-kernal-6581` | Smallest useful C64 baseline with normal BASIC return and services. | AR-013 |
| Platform structure | Public plugins / built-in qualified components | Explicit built-in components | Keeps contracts testable without a speculative framework. | AR-012 |
| Game facilities | Hidden engine / explicit opt-in facilities | Explicit zero-cost or fully costed facilities | Modern source receives help without mandatory runtime cost. | AR-002, AR-012 |
| Profile variance | Preprocessor / shared modules and facts | Compile-time facts plus selectable entries | Keeps one language and removes inactive profile paths. | AR-030 |
| Optimization boundary | Optimize while adding systems / correct `none` first | Correct explicit/reference paths in RD-05 | Prevents optimization from masking platform defects. | AR-023, AR-033 |
| C64U | Implement here / readiness and successor | Preserve seams; implement later | Avoids false support while keeping the next target feasible. | AR-024, AR-035 |

> **Traceability:** All material choices are recorded in
> [00-ambiguity-register.md](00-ambiguity-register.md). Exact API spellings and profile facts are
> normative Specification 4 material owned by RD-01, not duplicated as a second mutable contract.

---

## Security Considerations

- **Data sensitivity:** No credentials, personal data, network data, or secrets are processed.
- **Input validation:** Profile IDs and platform-operation arguments use closed allowlists and
  compile-time range/type checks. Raw addresses remain explicit volatile operations rather than
  being relabelled safe.
- **Authentication and authorization:** N/A; this is a local compiler and target library with no
  accounts, remote service, or privilege model.
- **Injection risks:** Platform operations produce structured machine operations, never assembler
  text assembled from source strings. Existing contained project paths and safe ACME/VICE process
  invocation remain governed by RD-02/RD-03.
- **Encryption:** N/A; there is no sensitive stored or transmitted data.
- **Rate limiting:** N/A; there is no network or public endpoint.
- **Infrastructure:** No daemon, service, container, secret, downloader, or new dependency is added.
- **Target safety:** All MMIO, banking, interrupt, and vector changes are exact, ordered, owned, and
  restored when the profile promises return. Compilation stops before emitting an unproved route,
  overlap, bank state, timing contract, or instruction.
- **Security verification:** Negative cases cover malformed profile selections, raw-address versus
  typed-sink misuse, unsupported hardware combinations, unsafe vector/bank transactions, resource
  overflow, and structured-operation-to-ACME containment.

---

## Acceptance Criteria

1. [ ] **AC-01 — Closed profile inventory:** The public target list contains exactly the eight IDs
   in the profile table; every unknown, partial, or independently mixed video/ownership/SID choice
   fails before lowering and produces no artifact.
2. [ ] **AC-02 — Complete profile facts:** A machine-checked crosswalk reports no missing CPU,
   raster, clock, device, ROM, banking, interrupt, memory/ZP/stack, SID, startup, artifact, exit,
   emulator, or hardware-QA field for any of the eight profiles.
3. [ ] **AC-03 — Profile constants:** Paired PAL/NTSC, KERNAL/takeover, and 6581/8580 builds prove
   exact compile-time facts and contain no inactive branch, runtime target string, or profile
   dispatcher under `optimization: none`.
4. [ ] **AC-04 — KERNAL startup/return:** All four KERNAL profiles load through the `$0801` BASIC
   entry, establish the specified mapping/state, initialize exactly the required ranges, execute
   initializers then `main`, and restore the captured compiler-owned state before returning to
   BASIC.
5. [ ] **AC-05 — Takeover startup/return:** All four takeover profiles install valid underlying raw
   IRQ/NMI vectors before banking out KERNAL execution, keep code/I/O/vectors visible, own every
   enabled source, and either restore exact entry state on normal return or prove the path
   nonreturning. Torn-vector and unhandled-NMI counterexamples fail compilation.
6. [ ] **AC-06 — Eight profile smokes:** Eight fresh example builds assemble and run only their
   hashed PRGs in the exact VICE 3.10 configuration; each reaches its expected state/exit and records
   the bounded status `VICE-verified / hardware-unverified` where required.
7. [ ] **AC-07 — Memory views:** Cases distinguish ROM-visible reads, RAM-under-ROM writes, I/O
   writes, RAM-under-I/O transactions, VIC bank selection, and character-ROM VIC windows. Every
   legal case reaches the intended physical consumer; each visibility/overlap failure stops before
   ACME.
8. [ ] **AC-08 — Banking restoration:** Nested normal exits and every error-capable source path of a
   scoped bank operation restore exact `$0000` DDR, `$0001` latch, CPU `I`, device masks, and
   declared pending-source behavior; an unsafe NMI/IRQ configuration is rejected.
9. [ ] **AC-09 — Named zero-cost MMIO:** Representative VIC border, raster acknowledge, sprite
   enable, screen/charset select, CIA mask enable/disable, and SID control operations match the
   expert direct sequence with no call, generic dispatch, duplicate access, runtime selector, or
   hidden copy.
10. [ ] **AC-10 — Volatile device classes:** Trace cases prove exact direction/count/order for
    `$D019`, VIC collision latches, CIA ICR, shared sprite fields, write-only SID fields, and
    cycle-sensitive display writes; deliberate duplicate/hoist/RMW defects are detected.
11. [ ] **AC-11 — Placement-derived fields:** Aligned objects produce exact VIC-bank, `$D018`,
    sprite-pointer, and CIA2 values at link time. Misalignment, mixed banks, character-ROM conflict,
    and an object outside its 16 KiB bank each produce one source-linked error and no copy.
12. [ ] **AC-12 — Interrupt sink variants:** One source handler used by every compatible selected
    sink emits only the reachable CINV-chain, exclusive-CINV, raw IRQ, NMINV, or raw NMI variants;
    each has the required entry D state, saves, acknowledgement, terminal, and restored status.
13. [ ] **AC-13 — Reversible installation:** Install/restore cases preserve the exact predecessor,
    keep every indirect saved link off an NMOS-invalid `$xxFF` start, reject stale ownership, and
    never expose a torn vector to a reachable IRQ/NMI.
14. [ ] **AC-14 — Complete route ledger:** For every installed route, the report includes every
    enabled source, entry kind, vector/link, acknowledgement and terminal owner, nesting,
    visibility, SFA interference, generated/existing-ROM bytes, stack peak, and complete path
    cycles; removing any field fails the evidence check.
15. [ ] **AC-15 — Shared-state diagnostics:** Single-byte shared state remains shared; known
    cross-domain RMW loss and multi-byte tearing each warn with the shortest preemption path.
    Private mainline/IRQ/NMI homes are disjoint, and no warning is “fixed” by hidden masking or
    cloned globals.
16. [ ] **AC-16 — Raster and CIA effects:** Raster compare, enable, pending acknowledgement, CIA
    counter/latch programming, `LOAD`, masks, and simultaneous ICR source bits produce their exact
    access sequence and state transition. CIA1 and CIA2 ownership are never interchanged.
17. [ ] **AC-17 — Stable raster contract:** The frozen PAL double-IRQ qualification case reaches
    one exact stable-body cycle from both admitted entry-jitter paths with final page placement and
    DMA assumptions proved; changed model/line/NMI/DMA/vector preconditions reject that numeric
    baseline.
18. [ ] **AC-18 — Frame ledger:** Each representative game slice reports total model slots, actual
    bus-denial union, fixed interrupt/player overhead, every worst-case work category, and margin.
    A seeded double-count or average-only budget fails.
19. [ ] **AC-19 — Joysticks:** All 32 combinations of five active-low joystick bits are correct for
    both ports, preserve unrelated CIA1 state, and perform no CIA2 access. Keyboard-coexistence
    counterexamples use the declared combined policy rather than returning invented input.
20. [ ] **AC-20 — Keyboard:** All 64 named matrix positions resolve from the correct driven column
    and read row; snapshot tests preserve DDR/latches, expose declared ghosting/joystick ambiguity,
    and treat RESTORE only as NMI.
21. [ ] **AC-21 — Direct sprites:** Each of eight channels proves 9-bit X, Y, enable, expansion,
    mode, priority, colors, and placement-derived pointer behavior. Shared-register updates preserve
    other channels, and collision latches are read exactly once.
22. [ ] **AC-22 — Standard displays:** One case for each of the five documented VIC-II modes proves
    required data objects, bank/alignment, exact mode/base fields, and visible output. Missing Color
    RAM, screen, charset, or bitmap data fails without runtime conversion/copy.
23. [ ] **AC-23 — Multiplexer oracle:** The frozen 24-sprite Q-P13 PAL case produces exact accepted
    sprites/order, schedule tables, channel reuse, selector publication, raster events, late/drop
    outcome, MMIO trace, and complete cost. Nine-overlap, page-cross, banking, NMI, and expanded-
    sprite counterexamples reject that specialized contract.
24. [ ] **AC-24 — NTSC multiplexer:** A separately derived later-NTSC schedule passes its exact
    263-line/65-cycle budget; no test or emitted table is obtained by scaling PAL line numbers.
25. [ ] **AC-25 — Scrolling:** Horizontal and vertical standard-text fixtures cross fine/coarse,
    direction, character-cell, and map-ordinal boundaries with exact screen and Color RAM results,
    no byte-truncated index, no torn edge, and a complete PAL/NTSC frame budget.
26. [ ] **AC-26 — Double buffering:** Screen-matrix and logical-schedule fixtures write only the
    inactive object, publish once atomically, flip only after completion, and never perform a full
    copy under the name “flip.” Reports count both evolving buffers and all alignment/padding.
27. [ ] **AC-27 — Direct SID:** Voice and global-field tests prove exact frequency, pulse width,
    waveform/gate, ADSR, routing/filter/volume bit positions, readable-register restrictions, and
    shadow/full-write behavior for both selected SID models.
28. [ ] **AC-28 — Audio API:** Exact hash-bound fixtures prove default/numeric/named tune init, one
    tick per call, named shot/collision/explosion effects, win/loss cues, optional logical voice
    `0..2`, direct register/`JSR` sequences, and zero emitted name lookup/scheduler/mixer code.
29. [ ] **AC-29 — Audio arbitration:** Integrated music+SFX tests prove priority, replacement,
    same-frame request order, selected voice, and resume behavior. Concurrent nonreentrant calls and
    incompatible PAL/NTSC or 6581/8580 contracts fail before emission.
30. [ ] **AC-30 — Native-audio boundary:** RD-05 evidence identifies its exact internal/reference
    fixtures and makes no PSID/GoatTracker parser claim. An arbitrary valid PSID cannot call the
    audio API until RD-06 binds a qualified player contract.
31. [ ] **AC-31 — Fixed pools:** Empty, full, release/reuse, and overflow cases for a pool larger
    than 255 retain exact object identity and word ordinals without heap, hidden tables, or memory
    overwrite; unused pool modules emit no code/data.
32. [ ] **AC-32 — Collision/state workload:** Q-P16 updates all 40 active entries including slot
    270, dispatches five instances of each of eight states, emits the exact 20 ordered half-open
    AABB pairs, and reports overflow at pair 97 in the clustered case without publishing a 97th
    result.
33. [ ] **AC-33 — Reachability stripping:** For every opt-in system, a paired unused build has zero
    related code, data, RAM, ZP, stack, startup operations, and cycles; a used build lists every
    linked owner separately.
34. [ ] **AC-34 — Independent behavior:** Deliberate defects in input polarity, volatile count,
    sprite order, scroll edge, publication timing, audio cue, collision order, status restore, and
    banking are detected by oracles that do not read generated assembly as expected behavior.
35. [ ] **AC-35 — Expert output:** Each direct operation and selected system meets its equal-contract
    expert byte/cycle/resource floor from final assembled addresses. A below-floor result fails;
    optional RD-08 optimization is not accepted as a future excuse.
36. [ ] **AC-36 — Complete report:** The report contains every R5.47 category and reconciles useful
    payload, reserved address ranges, replicas, and final artifact bytes without omission or double
    counting.
37. [ ] **AC-37 — Diagnostics:** Each invalid ownership, model, address, bank, alignment, timing,
    capacity, route, source-kind, or resource case names its profile, source owner, exact violated
    fact, demand/availability where applicable, and a usable remedy; no runnable artifact appears.
38. [ ] **AC-38 — Impact-based verification:** Evidence records focused tests per family and one
    complete RD-05 boundary run after all families are integrated. It contains no repeated
    unrelated full-suite runs and no new readiness/scoreboard service.
39. [ ] **AC-39 — Honest support statement:** Public status names all eight resident PRG profiles
    and the exact RD-05 systems as qualified, while native asset handlers/scenes, D64/loading,
    optional optimization, complete tooling, C64U, and hardware-unverified claims remain explicitly
    outside that boundary.
40. [ ] **AC-40 — Security and containment:** Closed profile/operation allowlists, structured
    machine operations, safe inherited ACME/VICE invocation, and negative vector/banking/resource
    cases pass; no source string becomes assembler text or a host command.
41. [ ] **AC-41 — Portability seam:** Static inspection finds no C64 address/device/profile fact in
    shared frontend, semantic, whole-program, SFA, CPU, emitter, or packager-independent code; no
    empty future-target package or generic platform plugin framework exists.
42. [ ] **AC-42 — Deferral-expiry closeout:** The closeout answers whether RD-05 invalidated any
    deferral rationale, walks every required register and Won't Have source, reassigns each newly
    due item, and leaves no deferral naming a closed RD-05 slice as its future owner.

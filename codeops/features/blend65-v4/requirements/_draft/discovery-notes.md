# Blend65 v4 Requirements Discovery Notes

> **Mode**: Full Discovery
> **Phase**: 3 — Authoring ready
> **Started**: 2026-09-09
> **Target feature**: `blend65-v4` (explicitly confirmed by the user)
> **Artifact status**: Working discovery record; RD-01 through RD-05 are approved

## Authority and evidence

- Active language identity: `BLEND65-SPEC-P3-4bf8a989`.
- Active expert baseline: `blend65-domain-expert` 1.0.0, qualified content commit
  `a96cfd3c41a456d4d4f983021cf43535a1d5bdaa`.
- Current implementation evidence: `codeops/features/blend65-ri/01-expert-recovery-audit.md`.
- Existing v3 code, tests, packages, roadmaps, readiness artifacts, and feasibility snapshots are
  audit and salvage evidence only. They are not v4 requirements authority.

## Selected domain lenses

| Lens | Why it applies |
|---|---|
| Compiler and language | Blend65 owns grammar, typing, effects, SFA, IL, optimization, ABI, diagnostics, target lowering, artifacts, and language tooling. |
| Data and migration | V4 must safely import versioned asset formats while preserving provenance and deterministic derived data. V3 itself has no compatibility or migration obligation. |

The web, financial, and distributed-system lenses are not currently applicable. IRQ/mainline
interaction is a compiler and machine-semantics concern rather than a distributed-system feature.

## Confirmed product direction from the discovery seed

- Build v4 as a controlled clean-slate compiler recovery rather than repair v3 in place.
- Permit qualified development milestones, but do not call v4 production-complete until the
  complete active Blend65 language works for C64 with correct behavior and expert-quality output.
- Preserve v3 in Git and port a component only after it satisfies the v4 contract.
- Provide no source, configuration, CLI, API, package, diagnostic, generated-assembly, binary,
  artifact, or migration compatibility with compiler v3. No one uses or has used v3, so preserving
  any historical behavior would add cost without a consumer. Conformance to the active language
  specification is a v4 product requirement, not a v3 compatibility promise.
- Implement C64 first while separating CPU, machine/platform, assembler dialect, and artifact
  packager responsibilities for later qualified 6502-family targets.
- Present a normal modern-language experience unless a documented physical target restriction
  genuinely prevents it; compiler convenience is not a valid source restriction.
- Use Static Frame Allocation as the sole general function-execution storage model. Keep assets,
  globals, banking, alignment, loaders, and whole-machine placement outside SFA.
- Establish horizontal contract and feature-pressure coverage before implementation, then deliver
  behavior in complete vertical slices. Do not build placeholder frameworks that fabricate support.
- Treat sprites, charsets, bitmaps, SID music/effects, native asset formats, loaders, overlays,
  scrolling, multiplexing, double buffering, and Integrator-style compile-time composition as
  compiler architecture pressures from the beginning. Implement capabilities vertically without
  turning the compiler into a game engine. (AR-038)
- Treat Blend65 as a general compiler for games, renderers, tools, and other C64 software. Its only
  game-oriented convenience is compile-time ingestion, validation, conversion, typing, and target
  integration of externally authored assets. Hardware access and delivery are general platform
  support; every runtime game or rendering algorithm remains user-authored. (AR-038)
- Design all intrinsic families from the beginning: volatile memory, CPU-control `asm_*`, queries,
  packed BCD, target encodings, and `embed()`. No arbitrary inline-assembly blocks.
- Share one frontend/compiler service between CLI and LSP. The VS Code extension and language
  server must not duplicate compiler semantics or depend on code generation.
- Keep compiler verification impact-based: focused checks during a slice and the complete relevant
  qualification at a major boundary. Do not recreate the readiness product.
- Use TypeScript 7 with no replacement general linter as the approved v4 toolchain direction;
  exact package/version and migration availability remain to be fixed before scaffolding.

## Confirmed repository boundary

- Physical working directory: `/home/gevik/workdir/github/blend65.ri/v4`.
- Recommended mechanism: a sibling Git worktree on `feature/v4-rebuild` in the existing repository.
- The first v4 checkpoint must be a minimal green baseline, not a broken deletion-only tree.

## Confirmed stakeholders

| Role | Candidate need |
|---|---|
| Modern C64 game developer (primary) | Familiar source language, useful diagnostics, direct asset workflows, and expert-quality machine code without requiring routine assembly knowledge. |
| Advanced C64/6502 developer | Predictable low-level effects, exact costs, named hardware access, the five admitted `asm_*` controls, and inspectable generated assembly/output. |
| Blend65 compiler contributor | Small accountable boundaries, authoritative semantic tests, directed verification, and reliable failure localization. |
| VS Code user | Live syntax/semantic diagnostics, navigation, symbol/type information, and target-aware help from the same frontend used by the compiler. |

## Open discovery questions

None. The complete 38-item register is resolved and the Zero-Ambiguity Gate passed.

## Approved first C64 production profile

The first implemented profile is `c64-pal-prg-kernal-6581`: a stock unexpanded PAL C64 with an NMOS
6510, PAL VIC-II timing, one 6581 SID at `$D400`, a KERNAL-loaded PRG and BASIC `SYS` autostart
at `$0801`, BASIC ROM banked out, KERNAL ROM and I/O visible, and cooperative KERNAL CINV IRQ
chaining. A normal exit restores compiler-owned startup state and returns to BASIC; an unreleased
exclusive resource makes normal return invalid.

Profile composition is represented from day one, but a later PAL raw-takeover profile and NTSC
profiles require their own complete qualification. V4 must not expose independent banking,
interrupt, video, ROM, and startup switches that can produce an unproved hybrid profile.

## Approved v4 authority transition

V4 uses one active Blend65 Language Specification 4.0 in `spec/`. All language decisions in this
discovery are resolved before that tree changes. A single controlled specification phase then
applies them, passes the complete Language Guard, updates and versions the expert skill once,
qualifies that version, and freezes both specification and skill identities before semantic
compiler implementation. Git and the parked v3 worktree preserve Specification 3.0; there is no
parallel live `spec-v4/` tree and no implementation-only semantic override.

## Approved complete address-of model

Specification 4.0 supports `&` on every real storage-place expression, including parameters,
nested struct fields, indexed array elements, and their compositions. It retains the existing
`word` result and adds no pointer, reference, view, or slice type. Expressions evaluate once;
array-derived addresses follow the normal constant, checked, or unchecked ordinal contract; and
one-past addresses require explicit arithmetic. Hidden origin, lifetime, and read-only provenance
survive derivation so local homes cannot escape and a known const-derived address cannot be used as
a mutable path. No runtime lifetime mechanism or descriptor is introduced.

## Systematic ambiguity scan

The 12-category scan separates user-owned product/language choices from one-way correctness and
security obligations. Correctness anchors such as atomic failure, deterministic output, path
containment, selected-CPU legality, no artifact after an error, exact volatile effects, and
impact-based verification already follow from the accepted audit, expert baseline, supplied
project directives, and coding standards; they are not presented as false choices.

| Category | Scan result |
|---|---|
| Feature gaps | AR-015 through AR-019 cover addressability, aggregates, nested fixed arrays, finite indirect calls, and compile-time game-data generation. Existing language semantics otherwise come from the selected v4 specification identity. |
| Behavioral gaps | AR-023 owns visible optimization modes. Atomic failure, evaluation order, overflow, unsafe-check behavior, MMIO effects, IRQ/SFA overlap, and target legality already have authoritative contracts. |
| Scope ambiguities | AR-014, AR-024, AR-025, AR-027, AR-037, and AR-038 own specification authority, production C64 profile coverage, v3-tree disposition, the first qualified milestone, and the general-compiler versus game-engine boundary. |
| Technical unknowns | Representation/pass/package counts remain implementation-plan decisions constrained by responsibility contracts, not product requirements. TypeScript 7, Node 22, Yarn classic, ACME, VICE, SFA, and no general linter are already explicit product/toolchain decisions. |
| Edge cases | The expert baseline already governs recursion rejection, nested calls, array ordinal promotion, unchecked addressing, optional checks, BCD, local-address escape, IRQ/NMI entry, banking, asset validation, tool failure, and selected-profile mismatch. Journey review will test their composition. |
| Integration points | AR-021 and AR-022 own editor and project/build integration. ACME serialization, VICE execution, native asset handlers, debug metadata, and CLI/LSP frontend sharing are confirmed scope. |
| Data & state | AR-016 and AR-022 own aggregate transfer and project declarations. Asset provenance, exact format/version validation, deterministic derivation, debug-data versioning, memory maps, SFA ownership, and no v3 migration are already fixed. |
| Security & compliance | Supplied project standards require path containment, allowlisted inputs/options, safe subprocess invocation, bounded untrusted input, no secrets, and workspace-trust-safe editor behavior. The compiler has no network service, authentication, personal-data store, or regulatory data domain. |
| Non-functional gaps | AR-026 owns observational host responsiveness. Expert output parity, target memory/cycle accounting, deterministic builds, bounded test selection, and VICE/real-hardware evidence levels are fixed. |
| UX & presentation | AR-020 through AR-023 own placement syntax, editor experience, project workflow, and optimizer controls. Inspectable assembly/maps/costs and modern-language diagnostics are confirmed. |
| Stakeholder conflicts | Automatic placement with expert overrides, cooperative versus takeover profiles, modern source versus expert output, and focused versus boundary verification already resolve the identified conflicts. |
| Naming & terminology | AR-014, AR-020, AR-022, and AR-023 include the remaining public names. `blend65`, `blendc`, `c64-pal-prg-kernal-6581`, SFA, target profile, CPU, platform, emitter, and packager already have stable meanings. |

The subsequent journey composition re-scan found three gaps that the isolated category scan did
not expose: named imports had no way to discover module files (resolved by AR-028), resident-PRG
assets had no decided large-asset delivery boundary (AR-029), and multi-profile source adaptation
had no explicit scope decision (AR-030).

## Approved large-asset delivery boundary

C64 production includes compiler-owned, opt-in disk delivery for explicit nonresident load units.
Ordinary `embed()` values remain resident and PRG-only projects link no loader. A separately
qualified disk profile packages its startup PRG and used load units, links only its selected
loader/decompressor code, and records transport bytes, resident/destination ranges, overlays,
banking, scratch, worst-case output, timing, IRQ/audio policy, publication, restoration, and all
resource costs. This is game functionality rather than a mandatory compiler runtime. M1 remains a
resident PRG. AR-031 owns the source-level resident-versus-loadable distinction.

## Approved explicit loadable-value contract

The narrow `loadable const` declaration denotes a compile-time-known immutable load unit rather
than resident CPU-readable storage. Its logical scalar, fixed-array, or struct type, exact size, and
asset provenance remain available at compile time, but ordinary reads, indexing, address-of,
mutation, and ordinary value passing are invalid. A selected-profile loader explicitly transfers it
into a compatible mutable fixed destination, which may use automatic placement or `place(...)`.
The C64 operation returns `boolean`: success publishes the complete logical value; failure leaves
destination contents unspecified. Fixed composite structs let a complete level or Integrator-style
scene travel as one load unit and reuse one destination across mutually exclusive levels. There is
no heap, descriptor, hidden load/copy, or persistent runtime asset handle, and unused loader support
does not link.

## Approved multi-profile source model

One project source tree uses shared modules, separate entry/platform modules only where hardware
APIs genuinely differ, and immutable compile-time facts for ordinary profile differences such as
PAL/NTSC frame rate. `blend65.json` supplies the default entry and exact profile; recorded
`--entry` and `--target` overrides select another qualified build without duplicate manifests.
Only the selected entry's reachable graph is semantically analyzed. A profile-constant branch is
resolved and removed even in `optimization: none`, with zero runtime bytes or cycles. V4 adds no
preprocessor, `#if`, conditional declarations, or build-variant framework. The C64U follow-on may
reopen that scope only if its real implementation proves substantial unavoidable duplication.

## Completed final consistency scan

The approved disk-delivery path exposed and AR-032 resolved the remaining contradiction: AR-022 had
required every build to publish `<name>.prg`, while a loadable game is complete only as a disk image
containing its boot PRG and load units. Each profile now owns one primary deployable artifact. The
first disk profile is `c64-pal-d64-kernal-6581`, which atomically publishes `<name>.d64` plus the
common evidence set; `blendc run` mounts and starts only that newly built image.

## Approved deterministic source discovery

One required `sourceRoot` in `blend65.json` is resolved relative to the manifest directory, never
the process working directory. It names one relative, canonical, project-contained directory;
absolute paths and escapes are invalid. The compiler recursively indexes its `.blend` files in
canonical path order to map qualified module identities, supports legal multi-file merged modules,
then analyzes only the entry module's reachable import graph. Profile-provided platform modules are
resolved separately. This preserves path-independent language modules without restoring source
globs or an explicit source-file inventory.

## Approved aggregate value model

Specification 4.0 gives fixed arrays and structs normal value semantics for assignment and return.
Types and fixed-array extents must match exactly, and unsized `T[]` remains a parameter-only borrow.
Aggregate parameters stay zero-copy: mutable through `T` and read-only through `const T`. Returns
use caller-owned storage, direct construction, and copy elision. An explicit copy must preserve
source-value semantics under aliasing and expose its cost, but the model adds no mandatory runtime,
heap, dynamic frame, or source-level copy intrinsic. Any generated shared copy sequence is a
measured backend choice whose scratch is closed before SFA, not a general runtime facility.

## Approved multidimensional array model

Nested fixed arrays are contiguous rectangular values in row-major order. `byte[25][40]` means 25
rows of 40 bytes and is indexed as `map[row][column]`. All stored extents are compile-time fixed.
Only the outermost extent may be omitted in a borrowed parameter: `const byte[][4]` accepts any
fixed row count with a statically known four-byte row width. `byte[][]`, `byte[25][]`, dynamic and
jagged arrays, slices, and views are not language concepts. Shape-exact assignment/return,
dimension-specific bounds rules, nested initializers, `length` at each level, and address-of for
rows/elements are required. The compiler retains static strides and must generate expert address
arithmetic without a runtime descriptor system.

## Approved typed function-value model

V4 supports `fn(...)` values for named ordinary `RTS` functions. Their signatures are exact, and
they may be stored, passed, returned, selected, and called only while whole-program analysis retains
a finite target set. Interrupt-handler values are a separate non-callable kind accepted only by
compatible recognized sinks. Explicit conversion to `word` erases proof; a raw `word` cannot become
callable. There are no lambdas, closures, captures, unknown indirect calls, or dynamic code loading.
Indirect lowering is cost-selected and domain-correct: singleton targets become direct calls;
finite sets use the best measured dispatch or trampoline; and domain-specific SFA variants are
selected by context rather than sharing unsafe storage. No universal dispatcher or runtime library
is added, and all target-set, memory, stack, byte, and cycle costs are visible.

## Approved compile-time generation model

V4 adds bounded deterministic `comptime function` declarations rather than a second comprehension
language. They reuse normal typed expressions, control flow, local fixed storage, direct calls to
other compile-time functions, and aggregate returns. They may read constants and validated embedded
data but cannot observe or change runtime state, access MMIO, invoke low-level intrinsics, perform
indirect calls, read arbitrary host inputs, or use nondeterminism. Recursion is still forbidden,
and deterministic execution and memory budgets fail with source diagnostics. The initial
byte-exact integer-phase math surface is `sin8`, `cos8`, `sin16`, and `cos16`. Evaluation emits no
target code, SFA storage, stack work, helper, or runtime library; only returned constant data is
placed in the target image.

## Approved placement syntax

Automatic target-aware placement remains the normal path. V4 adds one closed expert declaration
modifier, `place(...)`, with exactly `at`, `align`, `noCross`, and typed profile `region`
constraints. It applies to module-level stored objects, emitted functions, and refinements inside a
`zeropage` block; a placed scalar constant is deliberately materialized. It cannot place locals,
parameters, fields, types, or compiler-owned SFA homes. Explicit constraints only strengthen
automatic hardware, asset, visibility, timing, ownership, and reserved-range requirements.
Canonical aliases combine constraints, and conflicts fail with complete placement evidence rather
than duplicating or moving bytes silently. This is a compile/link-time constraint with no runtime
cost and is not a general annotation framework.

## Approved LSP and VS Code production surface

The language server is one consumer of the shared compiler frontend, typed semantic model,
diagnostics, project graph, target profiles, and asset metadata. It supports cancellable versioned
unsaved snapshots; live frontend/profile/asset/placement diagnostics; completion; hover; signature
help; definition; references; safe rename; symbols; semantic tokens; bounded code actions; and one
canonical full-document formatter. It never imports code generation for ordinary editor work. The
thin VS Code client adds language configuration, project/profile status, explicit build and VICE
commands, cancellation, Problems/Output integration, refresh, and generated-artifact access, with
workspace trust required before tool execution. An owned debugger, visual designers, package or
plugin systems, formatter configuration, broad refactoring, and mandatory incremental compilation
are outside the initial production surface.

## Approved project and build model

V4 has one upward-discovered JSONC `blend65.json` manifest with schema version, name, one entry
module, exact target profile, contained source/asset paths and output directory, optimization mode,
and independent bounds/division safety switches. The required `sourceRoot` supplies a module index;
imports define reachable source membership and asset declarations define packaged data.
Include/exclude globs and duplicate inventories do not exist. All paths remain inside the project
root. Machine-local ACME/VICE discovery stays outside the shared manifest, which cannot execute
scripts, hooks, plugins, or arbitrary tools. Manifest-based `blendc check`, `build`, and `run`
share one configuration path; `run` launches VICE only after its own successful build. A successful
build atomically publishes the profile-owned primary artifact plus assembly, labels, memory, asset,
cost, debug, and identity/hash evidence. Production mode has no competing single-file configuration
model.

## Approved optimizer modes

V4 exposes exactly `none`, `balanced`, `speed`, and `size`, with `balanced` as the production
`build`/`run` default. `none` still performs every semantic, SFA, legalization, layout, assembly,
and packaging obligation while disabling optional transforms. The other modes run both
machine-independent and target-machine optimization: `balanced` uses the complete target cost
model, `speed` prioritizes cycles after hard memory constraints, and `size` prioritizes bytes after
hard timing constraints. Correctness and all observable platform contracts remain hard in every
mode. Safety checks are orthogonal, per-pass user switches do not exist, overrides are recorded,
debug provenance survives, and complete transformation/resource effects are reported.

## Approved base-C64 matrix and C64U successor boundary

C64U is the required next platform family after the base C64 work, although its Ultimate-specific
features do not block the first C64 implementation. The C64 production architecture must leave
real semantic seams for target-neutral frontend/IR, symbolic address spaces, direct/banked/
transfer-only storage, platform-owned wider physical addresses, explicit DMA effects and costs,
separate CPU/video/audio clock facts, firmware/device-qualified profiles, coordinated multi-artifact
packaging, and emulator/hardware evidence. Core `word` remains 16-bit and SFA remains function
storage in CPU-visible RAM; REU and other assets belong to platform layout. This requirement does
not authorize a plugin framework, empty C64U packages, or speculative abstractions without a real
consumer.

Base-C64 production qualifies the eight exact combinations of PAL/NTSC, KERNAL/takeover, and
6581/8580. Their IDs are `c64-{pal|ntsc}-prg-{kernal|takeover}-{6581|8580}`, with
`c64-pal-prg-kernal-6581` implemented first. Shared qualification is factored by dimension, while
every complete identity receives a bounded end-to-end build/VICE smoke and timing/SID-sensitive
claims receive real-hardware QA. C64U is the first target-family expansion after base C64 and gains
an owned follow-on feature during requirements structuring; the base release waits for architectural
readiness and assigned ownership, not for Ultimate feature implementation.

## Approved v3 disposition and salvage rule

V3 is preserved by an exact recorded commit, Git history, and the parked current worktree. The
`feature/v4-rebuild` sibling worktree does not contain a duplicated legacy tree. A written
component inventory must tie each port/adaptation to a v4 requirement, Spec 4 compatibility,
focused independent proof, freedom from discarded architecture, and lower risk than replacement.
Source-span/diagnostic rendering, JSONC discovery, process adapters, and qualified asset
codecs/fixtures are likely candidates; lexer/Pratt mechanics require audit; semantic analysis, IL,
SFA implementation, lowering, codegen/optimization, orchestration, CLI behavior, and editor tooling
default to rewrite. V3 tests remain evidence only. The v4 branch removes the readiness packages and
workflow, inherited tests, and false target packages, then creates only packages needed by a real
C64 path. Minimal ACME/VICE utilities and authoritative fixtures may be deliberately ported.

## Approved host-responsiveness observation

V4 records phase-separated compiler/check/build/ACME durations, representative LSP request times,
and peak host memory together with real project, assets, configuration, tool, and machine identity.
These measurements expose trends but never fail a test, ordinary verification, shared CI,
milestone, or release on wall-clock time. Run them only for performance-sensitive changes and major
milestone/release observations, using real qualified examples rather than building a synthetic game
or readiness framework. Incremental compilation becomes due for reconsideration only when real
developer workflows are noticeably slow, profiling identifies repeated unchanged analysis as a
substantial cause, and smaller targeted repairs are insufficient. Generated-code performance keeps
its independent mandatory expert-output gates.

## Approved first useful milestone

M1 is a bounded, original-art Invaders-style microgame for `c64-pal-prg-kernal-6581` built with
`optimization: none`. One player, six invaders, and one shared projectile/explosion slot use the
eight hardware sprites without multiplexing. It uses a real JSONC project, the shared CLI/LSP
frontend, qualified current SpritePad input, joystick/fire interaction, fixed enemy state, ordinary
loops/functions, simple source-level collision, win/loss, normal return to BASIC, and every real
compiler stage through ACME, PRG, and deterministic VICE execution. Score, lives, barriers, enemy
projectiles, audio, scrolling, application IRQ callbacks, loaders, and optional optimization remain
later vertical capabilities. M1 requires independent behavior and assembly/cost expectations,
one-copy VIC-correct asset placement, complete SFA/resource/debug evidence, directed tests plus one
boundary qualification, expert local output, and an early C64U-readiness review.

The official SpritePad C64 Pro 3.80 native project and exports are an explicit prerequisite before
RD-03 implementation planning or asset-decoder work, not before requirements authoring. The user
will provide a producer-generated template with distinct placeholders and provenance, then save the
final exact C64 art through the official producer. The compiler and Linux/CI workflow consume the
committed bytes and never invoke SpritePad.

## Comparable-system feature selection

Comparable evidence includes cc65 and ACME for linking/layout, KickC, Oscar64, Prog8, and LLVM-MOS
for compiler behavior, and clangd/VICE workflows for editor and execution tooling. These systems are
comparison evidence only; none dictates v4's architecture.

| ID | Candidate | Recommended disposition | User decision |
|---|---|---|---|
| F1 | Low-level escape beyond the thirteen curated `asm_*` CPU-control operations | Want, strictly bounded | **Exactly five source intrinsics approved** |
| F2 | Automatic memory placement plus explicit expert overrides required by hardware | Want | **Want — explicitly confirmed** |
| F3 | Inspectable ASM, labels, memory map, asset placement, cycles, bytes, ZP, stack, and SFA reports | Want | **Want — explicitly confirmed** |
| F4 | One-command build and VICE run from CLI and VS Code | Want | **Want — explicitly confirmed** |
| F5 | Full source-level debugger integration | Want later; outside the first compiler milestone | **Want later — simplified debug-metadata scope explicitly approved** |
| F6 | Incremental compiler and persistent compilation cache | Skip initially; require measured need | **Skip initially — explicitly confirmed** |
| F7 | Public third-party plugin framework for targets and asset formats | Skip | **Skip — explicitly confirmed** |

F7 does not exclude modular internal target/asset boundaries. V4 implements explicit built-in C64
components first, adds X16 only as a qualified real target, and extracts a shared internal interface
only after multiple real consumers demonstrate the same contract. Dynamic plugin discovery, public
extension API compatibility, and third-party registration are out of scope.

F1 was initially selected as external assembly-module linking. During its complexity review, the
user explained the intended alternative: selected opcode-shaped functions such as
`asm_<instruction>(parameters...)` would add structured machine instructions to IL and later
serialize to ACME or a future assembler. The user does not currently see a need for C-like
`extern function` and explicitly clarified that not every assembly instruction can or should be
exposed. This is not the rejected full opcode/addressing-mode API.

The user approved the strict admission rule: a finite audit classifies every instruction family as
a source intrinsic, ordinary Blend65 operation, platform API, backend-only operation, or prohibited
operation. Every admitted source intrinsic needs complete variable/result, register, flag,
control-flow, target-legality, SFA, optimizer, byte, cycle, stack, memory, and bus semantics. It may
not depend on hidden register state across calls or expose compiler-owned labels/storage. The audit
is in `_draft/instruction-intrinsic-audit.md`. The user approved its exact initial C64 source set:
`asm_sei`, `asm_cli`, `asm_php`, `asm_plp`, and `asm_nop`. Inline assembly blocks,
external assembly functions, parameterized opcode calls, and the other eight v3 CPU-control names
are not part of v4. Full legal selected-CPU instruction coverage remains internal to target
legalization, instruction selection, machine optimization, and serialization.

F5 depends on the selected emulator's debugging interface but also requires compiler-owned
source-to-address metadata, static-home/SFA variable descriptions, bank-aware address mapping, a
debug-adapter protocol implementation, and editor integration. VICE 3.10 exposes the necessary
machine-debugging foundation through its monitor and stable binary-monitor interface.

The user directly approved the simplified complexity boundary: v4 must preserve and emit a
versioned, host-side debug-information artifact covering machine-address ranges to source spans,
function context, SFA variable homes/liveness, types, symbols, and bank identity. V4 does not now
commit to a Blend65-owned Debug Adapter Protocol implementation. A focused interoperability test
must first determine whether an existing VICE-capable adapter can consume the compiler information;
only a proven semantic gap may reopen the larger owned-adapter proposal. The debug artifact has no
PRG, RAM, ZP, hardware-stack, or runtime-cycle cost.

### F5 complexity-escalation approval evidence

- **Original goal:** Later full source-level debugging for modern Blend65 users in VS Code.
- **Extra system or support code:** Versioned compiler debug-information artifact and later emulator
  adapter integration.
- **Why it may be needed:** VICE exposes machine state but does not know Blend65 source spans,
  types, optimized liveness, SFA homes, or bank-qualified object identity.
- **Evidence:** VICE 3.10 documents breakpoints, watchpoints, registers, memory, labels, and a stable
  binary-monitor interface; the v3 implementation proves that source provenance, SFA homes, VICE
  control, and ACME label output can exist but does not provide a source debugger.
- **Smallest solution that still works:** ACME/VICE labels plus direct VICE-monitor use. It does not
  satisfy the accepted modern source-debugging outcome.
- **Extra cost:** One host-side schema/serializer, source and live-location preservation, bank-aware
  mapping, focused qualification, and a later interoperability probe. No target runtime cost.
- **Independent verdict:** Simplify — preserve the information and user outcome without selecting
  or building an owned DAP now.
- **Direct user decision:** Approved the simplified scope: preserve and emit compiler debug
  information; do not commit now to a complete Blend65-owned debug adapter.

## User journey re-scan

| Journey | Complete path checked | Result |
|---|---|---|
| Project discovery | Start below a project, find the nearest `blend65.json`, resolve its required `sourceRoot` relative to the manifest, index contained `.blend` module headers, locate the entry module, then follow named imports. | Covered by AR-022 and AR-028; process working directory does not affect the source set. |
| Editor session | Open trusted or untrusted workspace, analyze versioned unsaved text, cancel stale requests, navigate/rename/format, inspect profile/assets, then explicitly build or run. | Covered by AR-021/AR-022. Build and run use a coherent saved filesystem snapshot; the extension offers Save All or Cancel for dirty project inputs. Untrusted workspaces never execute tools. |
| Check | Read one coherent project snapshot, validate manifest/source/import/type/effect/profile/asset facts, and return stable diagnostics without lowering, ACME, packaging, or published outputs. | Covered. Final machine-layout failures remain build diagnostics; `check` reports only facts provable before target lowering. |
| Build | Reuse the same frontend result, close whole-program/SFA storage, lower and optimize under the selected mode, solve placement, serialize ACME, assemble/package, then atomically publish the profile's primary deployable artifact plus evidence. | Covered by AR-008, AR-022, AR-023, and AR-032. Any changed input, stage error, ACME failure, collision, or no-space result prevents publication of a mixed set. |
| Run | Perform a fresh successful build, bind the exact output hashes and selected VICE profile, launch only that profile's primary artifact, and report emulator/tool failure distinctly from compiler success. | Covered by AR-009, AR-022, and AR-032. A failed build never launches an older artifact. |
| Resident asset | Resolve literal `embed()`, validate exact handler/version/selector, retain symbolic identity and constraints, place one requested representation at the hardware-visible address, and report bytes/residency. | Covered by the active specification, expert asset contracts, AR-020, and M1 in AR-027/AR-037. Required producer fixtures remain qualification prerequisites rather than assumed parser proof. |
| Large asset or scene | Import and compose data that cannot coexist in one resident image, declare a fixed `loadable const` unit and compatible destination, select load windows/overlays, package transport bytes, load/decompress, publish, and preserve or pause IRQ/audio safely. | Covered by AR-029 and AR-031. |
| Multi-profile build | Build shared game code for PAL/NTSC, KERNAL/takeover, SID variants, then add a C64U-specific path without redefining core semantics. | Covered by AR-030: compile-time facts for ordinary differences, recorded target/entry overrides, and separate reachable platform modules for different hardware APIs. |
| Specification transition | Apply all accepted language changes once to Specification 4.0, run the Language Guard, version/qualify one expert skill, freeze both identities, then begin semantic implementation. | Covered by AR-014; no implementation-only override or parallel live specification is allowed. |
| V3 salvage | Record the exact v3 commit, create the sibling worktree, inventory each candidate against v4 requirements and focused proof, remove rejected topology, then create the smallest real C64 path. | Covered by AR-005 and AR-025. V3 tests and readiness claims remain evidence only. |
| Production and successor | Qualify the eight base C64 profile identities, meet local expert output and whole-program improvement obligations, add the approved disk-delivery slice, pass the C64U-readiness gate, and assign the C64U follow-on feature. | Covered by AR-002, AR-024, and AR-029. |

## Edge-case composition re-scan

| Boundary | Required behavior | Authority or open item |
|---|---|---|
| Source indexing | Fixed `.blend` extension, canonical contained paths, deterministic ordering, legal merged modules, declaration collisions, case-sensitive identities, symlink escape rejection, unreadable/vanished files, and profile-provided modules outside the project index. | AR-028 |
| Configuration | Nearest manifest wins; duplicate/unknown keys, invalid schema/profile/options, output escape, and nested-project ambiguity are diagnosed. | AR-022 |
| Coherent inputs | A build consumes one stable source/asset/config snapshot. A file changing during the read is retried as a whole or fails; it never yields mixed hashes/artifacts. | Determinism and AR-022 build identity |
| Modules and startup | Circular declaration imports remain legal; missing exports, duplicates, multiple/no `main`, and cyclic initializer effects are diagnosed with paths. | Active language specification |
| Editor freshness | Cancellation and document versions discard stale results; build/run do not silently compile an unsaved state different from the recorded files. | AR-021 plus deterministic build obligation |
| Frontend/build diagnostic boundary | LSP/`check` report only provable profile/asset/constraint issues; final sizes, addresses, branch repair, and global placement/no-space failures belong to `build`. | Compiler responsibility boundary |
| Assets | Wrong signature/version/selector/type/extent/EOF fails closed; aliases deduplicate only canonical-identical outputs; selected outputs alone emit; asset replacement during build cannot mix versions. | Active asset contract and AR-022 |
| Layout | Address overflow, alignment/no-cross violation, VIC invisibility, reserved-range collision, SFA/global overlap, and unsatisfied explicit placement all fail with contributing constraints. | AR-020 and SFA/platform boundary |
| Arrays and addresses | Empty/boundary extents, nested row strides, byte/word ordinal promotion, checked/unchecked access, one-past arithmetic, const provenance, and local-address escape retain their approved semantics. | AR-015 through AR-017 and active specification |
| Calls and interrupts | Unknown function targets, signature mismatch, execution-domain variants, handler misuse, IRQ/mainline interference, stack/status/D/banking restoration, and recursion rejection are closed before emission. | AR-018 and expert SFA/ABI contract |
| Low-level effects | Variable-address `PEEK`/`POKE` remains volatile and ordered; only the five admitted `asm_*` names exist and their exact flag/stack/control effects constrain optimization. | AR-006 and active intrinsic contract |
| Compile-time evaluation | No runtime/MMIO/host-nondeterministic effects; exact integer math is specified byte-for-byte; exhaustion produces a deterministic diagnostic instead of a hang or partial result. | AR-019; exact algorithms/limits are Specification 4.0 tasks |
| Optimization | Every mode preserves behavior, MMIO, ABI, memory, timing, debug provenance, and placement; each transform has an independent oracle and assembly/cost expectation. | AR-023 and expert parity contract |
| Tool and artifact failure | Missing/wrong ACME or VICE, assembler error, timeout, hash mismatch, output collision, no-space, or packaging failure retains distinct status and cannot publish/run a stale mixed set. | AR-009/AR-022 and artifact evidence contract |
| Loader/overlay lifetime | No live code, return address, vector, SFA home, pointer, handler, player, or asset may be overwritten; interrupt/audio pause or continuity and publication are explicit. | AR-029 and AR-031 |
| Debug evidence | Optimized ranges, split liveness, bank-qualified symbols, SFA homes, and source spans remain representable without adding target runtime bytes. | AR-010 |
| C64U readiness | Core `word` stays 16-bit while physical storage identity may be wider/banked/transfer-only; DMA and independent clocks remain explicit. | AR-024 |
| Host responsiveness | Measurements are attributable and comparable but cannot become a flaky wall-clock test or a second readiness system. | AR-026 |

The public product identity already requires a programmatic compiler entry point as well as
`blendc`. Requirements will expose one documented high-level check/build service used by the CLI
and language tooling; concrete internal package count and names remain implementation details and
gain no v3 compatibility promise.

## Consolidated scope for confirmation

> **Status:** Confirmed by the user after all AR-001 through AR-032 decisions were reviewed.

### In scope

- One controlled transition to frozen Blend65 Language Specification 4.0, followed by one
  versioned, requalified expert skill before semantic implementation.
- A sibling v4 worktree with an exact v3 salvage inventory, no compatibility obligation, and only
  independently proven small ports into a newly designed production compiler.
- The complete active language for C64, including the accepted modern `for` form, fixed-array and
  ordinal rules, ordinary aggregate values, complete addressable places, nested rectangular arrays,
  finite typed function values, deterministic compile-time functions, optional bounds/division
  checks, `place(...)`, `loadable const`, volatile `PEEK`/`POKE`, and exactly the five admitted
  `asm_*` source operations.
- Independently accountable frontend, typed semantic representation, whole-program analysis, SFA
  closure, target legalization, instruction selection/resource binding, machine optimization,
  ACME serialization, platform layout/startup/library, packaging, and driver responsibilities,
  combined into the smallest concrete module set that preserves those contracts.
- One JSONC project model with manifest-relative `sourceRoot`, entry-reachable modules, literal
  assets, exact profiles, recorded target/entry overrides, coherent snapshots, atomic outputs, and
  one documented programmatic check/build API shared by CLI and language tooling.
- C64-native SpritePad 3.80/SPD v5, CharPad 3.88/CTM v9, qualified PSID v1–v4, Koala, raw assets,
  deterministic compile-time asset composition, exact placement, and no hidden copies.
- Resident PRG delivery for the eight approved PAL/NTSC × KERNAL/takeover × 6581/8580 profiles,
  plus one qualified `c64-pal-d64-kernal-6581` profile with explicit load units and a profile-owned
  loader/decompressor contract.
- C64 platform APIs and compiler capabilities sufficient for user-authored game loops, input,
  interrupts, sprite multiplexing, scrolling, double buffering, graphics composition, SID music and
  effects, fixed pools, collision, state dispatch, loading, overlays, and related expert patterns.
  Only hardware and exact external-integration operations belong to the platform library; game
  algorithms remain ordinary source, and game-shaped slices remain qualification workloads.
  (AR-038)
- `none`, `balanced`, `speed`, and `size` optimizer modes with independent semantic and assembly/cost
  expectations and complete resource evidence.
- A production LSP and thin VS Code client, compiler debug metadata, manifest-based `check`,
  `build`, and fresh-artifact VICE `run` workflows.
- Impact-based specification, implementation, boundary, ACME, VICE, and targeted real-hardware
  evidence without recreating the v3 readiness product; host responsiveness is observed but never a
  wall-clock pass gate.
- M1 as the first real playable PAL/KERNAL/6581 resident-PRG Invaders-style microgame, followed by
  complete
  vertical slices rather than horizontal placeholders.
- A mandatory C64U architecture-readiness gate and an owned C64U follow-on feature as the first
  platform expansion after base C64.

### Out of scope

- Any v3 source, CLI, package, API, diagnostic, artifact, binary, or behavior compatibility.
- Preserving v3 implementation topology, inherited tests as authority, readiness packages,
  scoreboards, false target packages, or the game-feasibility matrix as compiler direction.
- A general target/asset plugin system, empty future-target packages, or one-class-per-pass
  architecture.
- Inline assembly blocks, external assembly functions, arbitrary opcode intrinsics, or hidden
  compiler-owned register state across source calls.
- A mandatory runtime, heap, garbage collector, dynamic arrays, slices, views, closures, lambdas,
  unrestricted indirect calls, or recursion.
- A Blend65-owned debug adapter in this feature, visual designers, package manager, plugin
  marketplace, general refactoring engine, or configurable formatter framework.
- A textual preprocessor, `#if`, conditional declarations, or named build-variant framework.
- Mandatory incremental compilation/persistent caching, synthetic scale projects, general linting,
  or wall-clock test failures.
- Implementing C64U, C128, X16, Atari 8-bit, or Atari 7800 inside the base v4/C64 feature. Their
  separately sourced and qualified features may reuse only proven shared contracts.
- Automatic support for old/unregistered native asset generations or unqualified player/loader
  formats.
- A built-in game engine, framework, or gameplay library, including game loops, entity/pool modules,
  collision systems, state machines/dispatchers, renderers, scene graphs, sprite-multiplexing or
  scrolling engines, double-buffer managers, and audio mixers/schedulers. (AR-038)

### Explicit later triggers

| Later capability | Reconsideration trigger |
|---|---|
| Blend65-owned debug adapter | A focused interoperability probe proves existing VICE-capable adapters cannot consume the required compiler metadata correctly. |
| Incremental compiler or persistent cache | Real projects are noticeably slow, profiling attributes substantial cost to repeated unchanged analysis, and smaller focused repairs are insufficient. |
| Conditional-compilation language surface | The real C64U implementation demonstrates substantial unavoidable duplication that shared modules, compile-time facts, and selectable entry modules cannot remove. |
| Additional D64 profile combinations | A real PAL/NTSC, takeover, or SID deployment requires the disk loader under that exact profile and its differing IRQ/audio/timing contract is qualified. |
| C64U implementation | Base C64 reaches its architecture-readiness gate and the separately owned C64U feature has pinned firmware/device/tool evidence. |
| Other 6502 machines | Each target obtains its own qualified expert-skill extension, exact CPU/platform/artifact contracts, and one target-native vertical proof. |

## Proposed Phase 2 structure (AR-033)

> **Status:** Approved by the user under AR-033. These are the Phase 3 authoring boundaries.

### Working glossary

| Term | Meaning in v4 |
|---|---|
| Blend65 v4 | The clean-slate language, AOT compiler, tooling, and narrow C64 platform library governed by Specification 4.0. It has no v3 compatibility obligation and is not a game engine. |
| Specification 4.0 | The single language authority produced by the controlled v4 specification transition and frozen before semantic compiler implementation. |
| Expert baseline | The single active, versioned, qualified `blend65-domain-expert` skill used to judge language, compiler, 6502, and C64 decisions. |
| CPU model | The selected processor's instruction, register, flag, stack, interrupt, and cycle semantics. The first model is NMOS 6510-compatible. |
| Platform | The complete machine environment around a CPU: memory map, chips, clocks, banking, startup, interrupts, operating ROMs, and delivery media. |
| Target profile | One exact, qualified CPU/platform/startup/video/audio/artifact identity. A profile is not a bag of independent switches. |
| Platform library | Compiler-owned, typed, target-specific hardware operations and exact external integration adapters that remove incidental machine lore without owning game policy or algorithms. |
| Game workload | A user-authored program or focused fixture used to prove language expressiveness, target correctness, resource use, and expert output. It is not a shipped engine or library module. |
| Semantic IR | The target-neutral typed representation after frontend analysis, retaining source meaning, effects, storage requirements, and debug provenance. |
| Machine representation | The selected-CPU and selected-platform representation used for legalization, instruction selection, resource binding, and machine optimization. |
| Static Frame Allocation (SFA) | The sole general model for parameters, returns, locals, temporaries, spills, and helper scratch for function execution. It is not the machine's global or asset layout system. |
| Resident value | A value placed in CPU-visible memory as part of the built program and usable directly under the selected profile's banking rules. |
| `loadable const` | A fixed, compile-time-known nonresident load unit that must be explicitly transferred into a compatible resident destination before use. |
| Load unit | The bytes and metadata packaged for one explicit load operation, possibly representing a scalar, fixed array, struct, or composed scene. |
| Primary artifact | The one deployable file owned by a profile: `<name>.prg` for PRG profiles or `<name>.d64` for the first disk profile. |
| `sourceRoot` | The manifest-relative contained directory whose `.blend` files form the deterministic module index. |
| Reachable module graph | The entry module plus only the modules reached through its named imports for the selected build. |
| M1 | The first independently useful vertical milestone: a bounded, original-art, unoptimized PAL/KERNAL/6581 Invaders-style microgame through the complete real pipeline. |
| Expert parity | The local floor that generated code is no worse than competent hand-written 6502 assembly, with whole-program compiler advantages expected to beat the realistic expert result. |
| VICE-verified / hardware-unverified | Evidence that passed on the pinned emulator but has not yet received the targeted physical-hardware checks required for silicon-sensitive behavior. |
| Build evidence | Deterministic assembly, symbols, maps, placement, SFA, resources, costs, diagnostics, hashes, and debug metadata tied to one coherent input and profile identity. |
| C64U readiness | Proof that shared contracts leave the correct extension seams for the later C64 Ultimate feature without pretending that its behavior is already implemented. |

### Proposed requirement documents

| RD | Capability and outcome | Vertical completion boundary |
|---|---|---|
| RD-01 — Specification 4.0 and Expert Authority Freeze | Apply every accepted language decision in one controlled specification transition, pass all Language Guard rules, version and requalify the expert skill once, then freeze both identities. | Ends with complete, internally consistent language and expert authorities. It contains no compiler implementation. |
| RD-02 — Clean V4 Foundation and Deterministic Project Model | Create the sibling v4 worktree, record the exact v3 salvage inventory, remove rejected topology, establish the TypeScript 7/no-ESLint toolchain, smallest real package graph, one `blend65.json` project model, coherent snapshots, and shared high-level compiler-service/CLI foundations. | Ends with a minimal green v4 foundation that can load and validate a deterministic project without recreating readiness infrastructure. |
| RD-03 — Playable M1 Complete Pipeline | Deliver one bounded original-art PAL/KERNAL/6581 Invaders-style game from source, CLI, and minimum editor support through parsing, analysis, semantic representation, SFA, target lowering, ACME, PRG, and VICE using `optimization: none`. Import qualified SpritePad assets, update one player, six invaders, and one projectile/explosion slot from joystick/fire input, resolve simple collision and win/loss, then restore/return to BASIC. | Ends with one useful, qualified, fully connected product slice plus independent behavior and assembly/cost evidence. No stage is a placeholder. |
| RD-04 — Complete Language and Correct Unoptimized Compiler | Implement all Specification 4.0 language semantics and diagnostics across the real pipeline, including calls, aggregates, arrays, function values, compile-time functions, intrinsics, safety options, ABI/effects, SFA closure, legalization, and correct `optimization: none` output. | Ends with the complete language compiling correctly for the first C64 profile before optional optimization is added. |
| RD-05 — C64 Platform Profiles and Game-Workload Compiler Support | Complete startup, banking, interrupts, timing, named hardware access, and narrow platform APIs for PAL/NTSC, KERNAL/takeover, and 6581/8580. Prove that user-authored sprite multiplexing, scrolling, double buffering, input, SID music/effects, fixed pools, collision, and state dispatch compile and run correctly without shipping those algorithms as an engine. | Ends with all eight approved resident-PRG profile identities and their relevant hardware operations and representative game workloads qualified. |
| RD-06 — Native Assets, Compile-Time Composition, and Resident Layout | Implement and qualify current SpritePad, CharPad, PSID, Koala, and raw handlers; deterministic compile-time data composition; Integrator-style asset refinement; exact placement, banking, alignment, deduplication, and one-copy resident layout. | Ends with resident assets converted into typed Blend65 data, metadata, symbols, and placement/package facts. User-authored programs consume them; no runtime renderer, player scheduler, mixer, scene system, or game architecture is supplied. |
| RD-07 — Loadable Assets and D64 Delivery | Implement `loadable const`, compatible mutable destinations, explicit load success/failure, one qualified disk profile, atomic D64 packaging, loader/decompressor selection, overlays, liveness, and IRQ/audio/timing contracts. | Ends with `c64-pal-d64-kernal-6581` producing and running one complete D64 whose reachable load units work without a hidden general runtime. |
| RD-08 — Optimization and Expert Output | Implement target-neutral and C64-machine optimization for `balanced`, `speed`, and `size`, retaining `none` as the correctness reference. Qualify each transformation with an independent behavior oracle and assembly/cost expectation. | Ends with expert parity as the local floor, measured whole-program wins, complete resource reports, and explicit GitHub debt for any qualified meet-only result. |
| RD-09 — Developer Tooling and Debug Evidence | Complete the public compiler API, CLI, production LSP, thin VS Code client, canonical formatter, diagnostics/navigation/rename, trusted build/run workflow, generated-artifact access, and compiler debug metadata. | Ends with a coherent modern editing and command-line workflow. It preserves debugger information but does not build a Blend65-owned debug adapter. |
| RD-10 — Production Qualification and C64U Handoff | Run the complete relevant boundary qualification for the language, eight PRG profiles, one D64 profile, tooling, ACME, VICE, and targeted hardware; expire or reassign every deferral; pass the C64U-readiness gate and hand off to the successor feature already assigned during requirements structuring. | Ends with a bounded C64 production claim and an evidence-backed C64U handoff, not a claim that C64U is already supported. |

This is deliberately not one RD per lexer, parser, analyzer, SFA, lowering, optimizer, or emitter.
Those are independently testable implementation responsibilities inside each relevant capability
slice. A pass-per-RD split would recreate horizontal progress without a working product. Combining
the scope into a few large documents would instead hide dependencies, postpone evidence, and make
completion difficult to judge.

### Dependency graph

```text
RD-01 -> RD-02 -> RD-03 -> RD-04 -> RD-05 -> RD-06 -> RD-07 -> RD-08
                              |         |       |       |       |
                              +---------+-------+-------+------> RD-09
                                        |       |       |       |
                                        +-------+-------+-------+-> RD-10
```

The diagram is compact; the exact dependency rules are:

| Requirement | Direct prerequisites | Reason |
|---|---|---|
| RD-01 | None | Language and expert authority must be stable before v4 semantics are implemented. |
| RD-02 | RD-01 | The clean foundation must use the frozen authorities. |
| RD-03 | RD-02 | M1 proves the real foundation and full pipeline. |
| RD-04 | RD-03 | Complete language work extends a working vertical compiler rather than a skeleton. |
| RD-05 | RD-04 | C64 platform support and representative game workloads consume a complete correct unoptimized language pipeline. |
| RD-06 | RD-04, RD-05 | Native transformation needs complete language semantics and real C64 placement/platform rules. |
| RD-07 | RD-04, RD-05, RD-06 | Loading and D64 packaging extend the proven value, platform, asset, and layout models. |
| RD-08 | RD-04, RD-05, RD-06, RD-07 | Optimization follows the complete correct unoptimized path and must cover resident and loadable programs. |
| RD-09 | RD-04 | Full tooling needs stable complete semantics. It may proceed alongside RD-05 through RD-08; RD-03 already supplies its minimum real editor/CLI slice. |
| RD-10 | RD-05, RD-06, RD-07, RD-08, RD-09 | Production qualification integrates every C64 delivery and developer-facing capability. |

### Delivery phases

| Phase | Requirements | Product checkpoint |
|---|---|---|
| A — Authority and foundation | RD-01, RD-02 | Frozen semantics and a minimal green clean-slate project foundation. |
| B — First useful slice | RD-03 | A playable, inspectable, unoptimized C64 program through the real pipeline. |
| C — Complete unoptimized production capability | RD-04, RD-05, RD-06, RD-07 | Complete language, C64 platform behavior, game-workload qualification, native assets, and resident plus D64 delivery before optimization. |
| D — Optimize and complete tooling | RD-08 and RD-09 | Expert-quality generated code and a production developer workflow. RD-09 may run in parallel once RD-04 is stable. |
| E — Production qualification and handoff | RD-10 | Evidence-backed C64 completion and an owned C64U successor. |

Every implementation RD must produce a real end-to-end capability and use directed checks while it
is changing. The complete relevant boundary qualification runs at the RD checkpoint. No RD may
create a generic readiness framework, placeholder target implementation, or pass topology without
an owned user-visible behavior.

### External integration map

| Integration | Direction and trust boundary | Owning RDs | Required contract |
|---|---|---|---|
| ACME assembler | Compiler launches a pinned local executable and consumes its output. Source and paths are untrusted inputs to a safely constructed process invocation. | RD-03, RD-04, RD-08, RD-10 | Exact supported identity, deterministic dialect serialization, contained canonical paths, distinct tool diagnostics, and no artifact publication after failure. |
| VICE 3.10 `x64sc` | CLI/test harness launches and controls a local emulator; VICE is the normal runtime oracle, not universal hardware proof. | RD-03, RD-05, RD-07, RD-09, RD-10 | Exact profile launch, timeouts, fresh artifact hash binding, observable-state capture, distinct emulator failure, and bounded hardware follow-up. |
| VS Code through LSP stdio | A thin extension exchanges versioned text and language requests with the shared frontend service. Workspace files and command execution are trust boundaries. | RD-03, RD-09 | Cancellation, stale-result rejection, workspace trust, no codegen dependency for ordinary editor requests, and a coherent saved snapshot for build/run. |
| Native asset files | The compiler reads local producer files through literal, contained paths and version-specific handlers. Files are untrusted binary input. | RD-03, RD-06, RD-07 | Exact signature/version/size validation, bounded parsing, canonical provenance, deterministic selected output, and producer-generated fixtures. |
| D64 packaging and loading | The compiler packages a boot PRG and reachable load units; the target loader consumes the resulting disk layout. | RD-07, RD-10 | One atomic primary artifact, exact filenames/locations, complete loader and decompressor resource ownership, publication semantics, and no stale partial image. |
| Git repository and sibling worktree | Local development operation used to preserve v3 and isolate v4. It is not a runtime product dependency. | RD-02 | Exact source commit, non-destructive salvage inventory, clean feature branch, and no duplicated legacy tree. |
| Physical C64 hardware | Targeted manual QA validates behavior where emulator evidence is insufficient. | RD-05, RD-07, RD-08, RD-10 | Recorded machine/chip/revision/configuration, selected silicon-sensitive cases, and explicit `VICE-verified / hardware-unverified` status until completed. |
| C64 Ultimate successor | A later feature consumes frozen shared contracts only after the readiness gate. | RD-10 | Owned follow-on scope, pinned firmware/device/tool evidence, 16-bit language `word` preservation, and explicit wider/banked/transfer-only storage identity. |

V4 has no network service, authentication system, remote package source, plugin marketplace, or
server-side data store. Adding one would be a new product decision rather than an implied
integration.

## Resume point

`RD-01` through `RD-05` are approved and committed. RD-05 establishes the eight exact resident-PRG
C64 profiles, general hardware/platform operations, and representative user-authored game
workloads without defining an engine. RD-06 is next: it owns native asset ingestion, validation,
conversion into typed Blend65 data and metadata, deterministic compile-time asset refinement, and
resident placement. It must not introduce a compiler-owned renderer, player scheduler, mixer,
scene runtime, or game architecture. Any new material choice reopens the gate.

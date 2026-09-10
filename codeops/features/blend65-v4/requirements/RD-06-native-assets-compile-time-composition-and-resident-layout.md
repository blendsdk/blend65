# RD-06: Native Assets, Compile-Time Composition, and Resident Layout

> **Document**: RD-06-native-assets-compile-time-composition-and-resident-layout.md
> **Status**: Draft
> **Created**: 2026-09-10
> **Project**: Blend65 v4
> **Depends On**: RD-01, RD-02, RD-03, RD-04, RD-05
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

RD-06 lets a Blend65 program consume current C64 authoring-tool files directly without a separate
conversion script. It implements exact built-in handlers for SpritePad, CharPad, PSID, and Koala,
retains raw inclusion for unregistered extensions, and converts each selected component into an
ordinary typed Blend65 constant with exact provenance and placement requirements. It then proves
that ordinary `comptime function` code can refine those values into resident tables, masks, panels,
and other application data while the target layout places each byte where its hardware consumer can
read it. (AR-007, AR-019, AR-020, AR-022, AR-040)

This is asset integration, not a game engine. The compiler owns parsing, validation, conversion,
typing, compile-time evaluation, placement, packaging, diagnostics, and evidence. The program owns
what the assets mean and every runtime consumer: rendering, animation, scene organization, audio
tick placement, cue policy, mixing, collision, scrolling, and gameplay. No handler or platform API
supplies a renderer, scheduler, mixer, scene runtime, or game architecture. (AR-038)

RD-06 is resident-only. Every emitted object is present in the profile's primary PRG image and
final runtime layout. RD-07 separately owns `loadable const`, D64 packaging, loaders,
decompression, overlays, and assets whose mutually exclusive sets cannot coexist in the resident
image. RD-08 separately owns automatic cost-guided representation choice and optional optimizing
transformations. (AR-023, AR-029, AR-031, AR-033)

> **Decisions:** AR-002 through AR-004, AR-007, AR-008, AR-012 through AR-014, AR-019 through
> AR-023, AR-025, AR-026, AR-029 through AR-035, and AR-038 through AR-040.

---

## Functional Requirements

### Must Have

#### Bounded asset integration surface — complexity L

- [ ] **R6.1 — Implement exactly the approved handler baseline.** Provide explicit built-in C64
  handlers for SpritePad C64 Pro 3.80 project files with SPD v5, CharPad C64 Pro 3.88 project files
  with CTM v9, the self-contained directly callable PSID v1–v4 subset, and classic 10,003-byte
  Koala files. Preserve one-argument raw byte inclusion only for extensions that the selected
  profile has not registered. Do not infer adjacent format generations or add a public handler
  plugin framework. (AR-012, AR-040)
- [ ] **R6.2 — Keep handlers outside language semantics and SFA.** The core language owns the
  bounded literal `embed(path[, selector])` expression and typed constant result. The selected
  platform owns handler identity, selector meanings, hardware constraints, and compatibility. A
  handler allocates no function frame, SFA home, target stack, hidden runtime object, or import
  routine. (AR-014, AR-038, AR-040)
- [ ] **R6.3 — Dispatch and validate before producing values.** Canonical extension selects one
  candidate handler, but signature, version, complete structure, counts, indices, conditional
  blocks, reserved fields, component lengths, and exact end-of-file establish validity. A
  registered extension never falls back to raw bytes after validation fails. Malformed,
  unsupported, older, or newer registered generations fail with E10204 and emit no selected data.
  (AR-002, AR-040)
- [ ] **R6.4 — Preserve literal and deterministic source behavior.** Both path and optional
  selector are string literals. The selector is a case-sensitive opaque key owned by the handler,
  not a dotted query language. Search starts beside the declaring source, then uses the manifest's
  ordered contained asset paths. The build consumes one coherent canonical source/asset/config
  snapshot and hashes every consumed asset. (AR-022)
- [ ] **R6.5 — Produce ordinary exact typed constants.** A handler returns only the scalar,
  immutable fixed array, or immutable fixed composite type declared by the resolved selector. An
  omitted array extent is inferred; an explicit extent and element type must match exactly.
  `embed()` remains module-constant-only and cannot initialize mutable storage or appear as a
  runtime file operation. (AR-016, AR-017, AR-040)
- [ ] **R6.6 — Emit only reachable selected outputs.** A scalar selector becomes a compile-time
  constant and contributes no target bytes unless ordinary language use materializes it. An array
  or composite selector remains symbolic until layout. Only reachable selected representations
  emit; parsing a project file must not emit unselected components, alternate encodings, offsets,
  names, metadata tables, or copies.
- [ ] **R6.7 — Deduplicate only canonical embedded identity.** Declarations resolving to the same
  canonical path, resolved selector including a handler default, and output representation alias
  one immutable object and address. Different selectors or representations remain distinct even
  when their bytes happen to match. No general constant-folding or layout pass may merge distinct
  address-observable objects under `optimization: none`. (AR-023)

#### SpritePad C64 Pro 3.80 / SPD v5 — complexity XL

- [ ] **R6.8 — Validate complete SPD v5 projects.** Accept ASCII `SPD` version 5 only and validate
  all flags, word-sized counts and indices, 64-byte sprite records, tile data, attributes, tags,
  overlay distances, sprite-animation data, tile-animation data, optional-component conditions,
  and exact EOF. Reject SPD v4, SPD v6, truncation, count mismatch, invalid index/attribute, and
  unexplained trailing bytes with E10204. (AR-040)
- [ ] **R6.9 — Preserve native sprite records.** Selector `"sprites"` yields one immutable byte
  array containing 63 bitmap bytes followed by the packed attribute byte for each sprite, in file
  order. `"count"` is a `word`; `"background_color"`, `"multicolor_1"`, and `"multicolor_2"` are
  bytes. Omitted selector resolves to `"sprites"`. No file-wide multicolor flag, base block, or
  implicit offset table is invented.
- [ ] **R6.10 — Expose the complete approved optional surface.** Expose the exact typed SpritePad
  selector set in the technical table, including per-sprite derived attributes, tile metadata,
  overlay distances, and both sprite- and tile-animation components. A selector absent from the
  parsed project is E10133; an explicit derived selector emits and reports its own bytes.
- [ ] **R6.11 — Derive VIC addresses only after placement.** `"sprites"` carries 64-byte alignment
  and selected-VIC-bank visibility constraints. Final placement, not the file handler, determines
  `vicSpriteBlock` values. Reject misalignment, an out-of-bank record, or a record set that cannot
  coexist with the active screen and other live VIC objects; never copy or split records silently.
- [ ] **R6.12 — Require authentic producer evidence.** Parser qualification requires the
  producer-generated `SPD380-MIN-V5`, `SPD380-ALL-V5`, `SPD380-WIDE-V5`, and meaningful
  `SPD380-OPTIONALS-V5-*` fixtures, plus derived v4/v6 and malformed cases. Record SpritePad 3.80
  project/save provenance, file SHA-256, every selected output's type, length and SHA-256, and
  complete tail/EOF coverage. The Linux compiler and CI never invoke SpritePad. (AR-037, AR-040)

#### CharPad C64 Pro 3.88 / CTM v9 — complexity XL

- [ ] **R6.13 — Validate complete CTM v9 projects.** Accept ASCII `CTM` version 9 only and validate
  the full ordered `$DABn` block schema, flags, counts, dimensions, display/color/tile conditions,
  materials, tags, names, referenced indices, payload lengths, and exact EOF. Reject CTM v8, CTM
  v10, malformed ordering, truncation, count/index mismatch, or trailing bytes with E10204. The
  handler has no default selector; omission is E10132. (AR-040)
- [ ] **R6.14 — Expose exact character, map, tile, and metadata selectors.** Implement the selector
  table below with its exact scalar/array types and availability. `"tile_width"`, `"tile_height"`,
  and `"tile_mode"` always exist and yield `1`, `1`, and `false` without a tile layer. Only the
  selectors explicitly marked tile-mode-only are absent outside tile mode.
- [ ] **R6.15 — Select canonical index width without truncation.** Canonical `"tiles"` and `"map"`
  yield `byte[]` when the maximum referenced index is at most 255 and little-endian `word[]` when it
  is greater than 255. A declared type mismatch is E10144 and reports the required type. It is not
  a parse failure, implicit cast, wrap, or silent widening of other outputs.
- [ ] **R6.16 — Provide explicit stable-width and split forms.** `"tiles_word"` and `"map_word"`
  always return little-endian word arrays. Independent `"tiles_low"`/`"tiles_high"` and
  `"map_low"`/`"map_high"` selectors return full byte planes. Selecting one plane or representation
  never emits its companion.
- [ ] **R6.17 — Implement the exact packed-12 form.** `"tiles_packed12"` and `"map_packed12"` exist
  only for an available layer whose every index is at most 4095. Emit all low bytes first, followed
  by `ceil(N/2)` high-nibble bytes; the absent odd partner contributes zero. For values
  `$123,$456,$789`, emit exactly `$23,$56,$89,$41,$07`. Above 4095 the selector is absent and
  produces E10133 rather than truncating.
- [ ] **R6.18 — Keep CharPad data native and placement independent.** Do not invent flattened
  screens, derived Color RAM, base addresses, VIC register fields, or offset tables. `"charset"`
  carries 2-KiB alignment and selected-VIC-bank visibility. Final layout supplies the address used
  by `vicCharsetSelect`; the handler supplies bytes and constraints only. (AR-038)
- [ ] **R6.19 — Require authentic CharPad evidence.** Qualification requires producer-generated
  `CTM388-MIN-V9`, `CTM388-ALL-V9`, `CTM388-WIDE-V9`, and every meaningful display × color ×
  tile-mode fixture, plus v8/v10 and block-derived malformed cases. Record 3.88 project/save
  provenance, input SHA-256, dimensions/widths, and every selected output's type, length and
  SHA-256. Comparative parsers cannot replace missing producer evidence. (AR-040)

#### PSID data and exact player adapters — complexity XL

- [ ] **R6.20 — Parse only the qualified PSID subset.** Accept ASCII `PSID` v1–v4 with version-correct
  header lengths and big-endian fields, nonempty payload, songs in `1..256`, valid start song,
  supported flags, nonwrapping load range, init inside the emitted interval, and a nonzero play
  address inside that interval. Reject RSID, Compute! MUS, PlaySID-dependent flags, invalid reserved
  fields/relocation ranges, unsupported SID addresses/topology, and structurally invalid input.
  (AR-040)
- [ ] **R6.21 — Resolve load and entry metadata exactly.** A nonzero header load address applies to
  bytes beginning at the format data offset. A zero header load address consumes and removes the
  first two little-endian payload bytes as the effective load address. A zero init address resolves
  to that effective load address. Expose `"data"` as immutable bytes, `"init_address"` and
  `"play_address"` as words, with `"data"` as the default.
- [ ] **R6.22 — Preserve declared compatibility sets.** Retain PSID clock and SID-model meanings as
  Unknown, PAL/6581, NTSC/8580, or Both without conflation. A specific incompatible video, model,
  SID address, or multi-SID topology is E10261. Unknown remains valid for embed-only data but does
  not prove callable compatibility; no retiming, retuning, filter translation, or hardware
  activation occurs.
- [ ] **R6.23 — Separate PSID parsing from callable audio.** A plain PSID supplies data plus init and
  play addresses; it never implies sound effects, voice arbitration, writable state, cadence,
  interrupt ownership, or a safe ABI. Callable use requires provenance matching one exact
  hash-bound selected-profile player contract. Missing contract is E10256 and an unavailable
  operation/cue/voice is E10257. (AR-038, AR-040)
- [ ] **R6.24 — Qualify GoatTracker 2.77 as the first adapter.** Bind the exact exported player/data
  identity and selected feature set. Cover init with subtune in A to `JSR start`, one tick to
  `JSR start+3`, and optional `-Dx` SFX with effect address in A/Y and channel offset `0`, `7`, or
  `14` in X to `JSR start+6`. Preserve feature-pruned exports and report every code, data, writable,
  self-modifying, ZP, stack, register/flag, banking, cadence, IRQ, and cycle obligation. (AR-040)
- [ ] **R6.25 — Keep audio policy in source and the selected player.** User-authored source chooses
  init, song/effect, and every tick call site. The compiler installs no scheduler, mixer, queue,
  interrupt, or name table. Player-native arbitration/queue behavior is allowed only when the exact
  adapter declares it; it is not generalized into a Blend65 audio engine. Reachable unsafe overlap
  of non-reentrant player operations is E10258. (AR-038)
- [ ] **R6.26 — Prove audio assets independently.** Cover one fixed-load and one payload-load-address
  file for every accepted PSID version, valid PAL/NTSC/model combinations, exact GoatTracker
  music-only and integrated-SFX exports, and all listed negative classes. Runtime proof observes
  calls and ordered SID-register effects; named physical 6581/8580 listening remains the bounded
  analogue QA and cannot be replaced by VICE register traces.

#### Koala and raw data — complexity L

- [ ] **R6.27 — Validate classic Koala structure.** Accept `.kla` and `.koa` only when the file is
  exactly 10,003 bytes: little-endian `$6000`, 8,000 bitmap bytes, 1,000 screen bytes, 1,000 Color
  RAM bytes, and one background byte. A wrong length, load address, or structure is E10204. The
  handler has no default selector; omission is E10132. (AR-039, AR-040)
- [ ] **R6.28 — Expose exactly four Koala components.** `"bitmap"` yields `const byte[8000]`,
  `"screen"` and `"color_ram"` each yield `const byte[1000]`, and `"background"` yields `byte`.
  Emit only requested components. Do not expose the file load address, a target base, bank,
  register field, combined image, renderer, or hidden Color RAM copy. (AR-038)
- [ ] **R6.29 — Preserve Color RAM source bytes exactly.** Accept nonzero unused high nibbles,
  preserve all eight bits in imported typed data and provenance, and report that only
  `value & $0f` has Color RAM hardware meaning. Never reject or silently normalize a structurally
  valid Koala file solely because an unused high bit is nonzero. AR-041 separately owns whether the
  same source-preservation rule applies to the final background byte; do not implement that part
  until the ambiguity is resolved. (AR-039)
- [ ] **R6.30 — Keep display transfer explicit.** `"bitmap"` carries 8-KiB alignment;
  `"screen"` carries 1-KiB alignment; both must be visible in the same selected VIC bank. Color RAM
  remains separate hardware at `$D800`; user-authored source explicitly transfers the 1,000
  selected bytes and bears the reported instruction/cycle cost. The handler never injects that
  runtime work. (AR-038)
- [ ] **R6.31 — Preserve strict raw inclusion.** One-argument `embed(path)` on an unregistered
  extension yields the exact nonempty file bytes as `const byte[]`; empty input is E10131. A
  selector on an unregistered extension is E10137. A registered extension always uses its handler
  and cannot bypass validation through raw fallback.

#### Compile-time refinement without a game engine — complexity XL

- [ ] **R6.32 — Compose through ordinary language features.** User-authored `comptime function`
  declarations may read validated embedded constants and return fixed arrays or structs containing
  transformed bytes and metadata. RD-06 adds no scene DSL, asset graph language, template system,
  renderer API, callback registry, or host plugin. (AR-019, AR-038)
- [ ] **R6.33 — Preserve deterministic phase separation.** Compile-time refinement uses normal
  typed expressions, loops, conditions, fixed storage, direct compile-time calls, and aggregate
  returns. It cannot read files except through literal `embed()`, observe environment/time/random
  state, access MMIO, call runtime or indirect functions, or emit target instructions, SFA homes,
  stack use, helpers, or runtime conversion code. (AR-019)
- [ ] **R6.34 — Make every transformation explicit in source.** Source may construct repeated
  panel data, occlusion masks, draw-priority metadata, address/clipping tables, dirty-region data,
  or pre-shifted forms. Under `optimization: none`, the compiler evaluates exactly the selected
  source representation; it does not invent a representation, decide game policy, infer update
  frequency, or add a runtime consumer. Optional cost-guided choice belongs to RD-08. (AR-023,
  AR-033, AR-038)
- [ ] **R6.35 — Diagnose C64 data conflicts without changing intent.** Compile-time checks reject
  invalid dimensions, indices, mode/color combinations, and unsatisfied target constraints with
  the originating source/asset location and available legal choices. They never silently recolor,
  crop, reorder, flatten, repack, or replace user-selected values.
- [ ] **R6.36 — Prove Integrator-style refinement as a workload.** Q-P15 uses user-authored
  compile-time source to build a large visible area from repeated elements/panels, foreground
  objects, occlusion masks, and at least one multicolor attribute conflict. It compares two
  explicitly selected credible data representations and proves exact result bytes, reuse,
  padding, alignment, VIC visibility, mask/priority metadata, conflict diagnostics, and absence of
  hidden copies. It does not publish a renderer or scene API. (AR-038)
- [ ] **R6.37 — Keep runtime proof application-owned.** A qualification program may render or play
  the resulting data to prove usability, draw order, foreground occlusion, changed-panel behavior,
  Color RAM work, audio calls, and worst-case cycles. That renderer/player call schedule is test
  source, not emitted support or a public library. Its code and costs are reported separately from
  asset bytes and compiler-generated metadata. (AR-038)

#### Resident placement and evidence — complexity XL

- [ ] **R6.38 — Carry symbolic constraints to final layout.** Preserve output type, exact byte
  size, canonical identity, source hash, required address, alignment, no-cross window,
  CPU/VIC visibility, bank, writable/self-modifying ranges, and consumer relationship until the
  selected-profile layout solves them. No frontend, handler, or emitter guesses a final address.
- [ ] **R6.39 — Use interval-based resident layout.** Model every simultaneously live object as a
  physical interval plus its CPU and device views. Prove alignment, containment, nonoverlap,
  banking, character-ROM windows, and every reserved range. A scalar total never substitutes for
  the interval proof.
- [ ] **R6.40 — Place one copy at the final consumer address.** Prefer direct compile-time
  placement, bank selection, and derived register/pointer fields over runtime copying. No handler
  emits a convenience duplicate, implicit offset table, or runtime-transcoded form. Any deliberate
  future compiler replication requires a measured consumer/timing reason, exact bytes and benefit,
  and is not introduced by this RD under `optimization: none`. (AR-023)
- [ ] **R6.41 — Derive hardware fields from final addresses.** `vicSpriteBlock`,
  `vicCharsetSelect`, `vicBitmapSelect`, and `vicScreenSelect` are compile/link-time calculations
  against final placement. They reject illegal visibility/alignment/bank combinations and emit
  constants or direct register fields, never runtime division, lookup tables, relocation, or
  copies. (AR-007, AR-020)
- [ ] **R6.42 — Account for complete hardware reservations.** Report useful payload, alignment
  padding, and reserved address space separately. An active screen occupies its complete 1,024-byte
  interval, whose final eight bytes are its sprite-pointer table rather than another allocation.
  Color RAM occupies 1,024 hardware addresses although a Koala payload supplies 1,000 visible-cell
  bytes. Never double-count padding already included in final interval endpoints.
- [ ] **R6.43 — Reject impossible resident sets honestly.** A 16-KiB VIC bank cannot hold 256 native
  64-byte sprite records together with an active screen: the records alone occupy `[0,$4000)`.
  More than 256 records cannot fit in one bank. If the reachable resident set cannot satisfy all
  CPU/VIC/player/code/global/SFA constraints, fail before ACME with interval evidence. Do not hide
  a copy, split, overlay, loader, or bank transition; RD-07 owns explicit nonresident delivery.
  (AR-029, AR-031)
- [ ] **R6.44 — Respect explicit placement without weakening safety.** Automatic target-aware
  placement is the default. `place(at|align|noCross|region)` may strengthen constraints on an asset
  or derived constant but cannot weaken handler/profile visibility, ownership, fixed-load,
  alignment, or reserved-range requirements. Conflicts identify every source of the unsatisfied
  constraint. (AR-007, AR-020)
- [ ] **R6.45 — Serialize only solved objects.** ACME receives symbolic labels, explicit addresses,
  alignment/fill, and final byte sequences after format parsing and layout. Generated ACME never
  parses an authoring format, obtains an unsanitized source path, or uses permissive `!binary`
  truncation/padding to validate an asset. Any assembler failure publishes no new artifact.
- [ ] **R6.46 — Publish complete asset evidence.** The atomic build set includes `.assets.json`,
  `.memory.json`, `.costs.json`, labels, ACME, debug data, and the PRG. For every selected or derived
  object report source path identity without leaking host-specific absolute roots, input hash,
  handler/version/selector, logical type/shape, output hash, payload bytes, emitted bytes,
  alignment/padding, physical interval, CPU/VIC visibility, bank, aliases, writable ranges, and
  zero/runtime costs. Unavailable evidence is `Unknown`, never zero. (AR-008, AR-022)

#### Diagnostics, qualification, and closeout — complexity XL

- [ ] **R6.47 — Preserve the complete diagnostic boundary.** Implement unique Specification 4
  diagnostics for missing/empty files, missing defaults, unknown/unavailable selectors, illegal
  mutable/runtime use, nonliteral paths/selectors, raw-selector misuse, extent/type mismatch,
  malformed/unsupported format, unsatisfied placement, incompatible SID profile, missing audio
  contract/operation, and unsafe player overlap. A failed import or layout publishes no target
  artifact.
- [ ] **R6.48 — Make diagnostics useful to modern developers.** Every diagnostic names the source
  declaration, canonical project-relative asset, detected handler/identity where safe, exact failed
  field/offset/count/constraint, declared versus required type or range, and one actionable remedy.
  Binary parser failures never dump arbitrary asset contents or host absolute paths.
- [ ] **R6.49 — Bind parser evidence to authentic fixtures.** Maintain one data-only fixture
  manifest recording stable ID, provenance, producer/baseline identity, license/redistribution
  disposition, file SHA-256, expected parse result, selector inventory, typed output lengths/hashes,
  and malformed derivation recipe. A label or hand-written byte file cannot impersonate a
  producer-generated acceptance fixture. (AR-037, AR-040)
- [ ] **R6.50 — Test each boundary at the smallest relevant tier.** Use byte-level parser and
  serializer tests, typed frontend tests, layout interval tests, focused ACME artifact checks, and
  bounded VICE programs only for hardware-facing consumption. Do not rerun the unrelated compiler,
  emulator, or readiness corpus after each handler case. Run one complete RD-06 boundary suite
  after the five paths and layout integrate. (AR-026, AR-033)
- [ ] **R6.51 — Separate behavior and artifact expectations.** Each positive transformation has an
  independent typed/byte behavior oracle and a separate final-layout/artifact/cost expectation.
  VICE observation supports but does not replace either. Parser agreement with another tool does
  not replace producer provenance and exact output proof.
- [ ] **R6.52 — Report qualification honestly.** Public status names each handler, exact accepted
  identity, completed fixture roles, supported selectors, selected profiles, and evidence level.
  Missing producer evidence leaves that parser facet `Unknown` or `Verified partial`; it cannot be
  called qualified because the compiler accepts a guessed comparative schema.
- [ ] **R6.53 — Close deferrals and version dependencies.** Before RD-06 closes, answer whether its
  deliverables expired any deferral rationale, walk the ambiguity register, Won't Have lists,
  Specification 4 future considerations, and expressiveness ledger, and re-own every due item.
  Bind all evidence to the frozen Specification 4 identity and active expert baseline `2.0.0`.
  (AR-014, AR-034)

### Should Have

- [ ] **R6.54 — Provide focused source examples — complexity M.** Add small examples for every
  handler family, CharPad representation boundary, callable versus embed-only audio, Koala display
  data, raw inclusion, same-output aliasing, and one user-authored compile-time refinement. They
  teach asset consumption without prescribing a game or renderer architecture. (AR-003, AR-038)
- [ ] **R6.55 — Expose frontend asset metadata — complexity M.** Make parsed selector names, exact
  types, availability, provenance, and pre-layout constraints available through the shared
  semantic model so RD-09 can provide completion, hover, and diagnostics without importing
  codegen or final layout. Unknown final addresses remain unknown until build. (AR-021)
- [ ] **R6.56 — Record host import observations — complexity S.** At RD-06 closeout record per-handler
  parse/type/layout/build duration and peak host memory against the named fixtures. These are
  trends, not wall-clock pass/fail gates and do not authorize an incremental cache. (AR-011,
  AR-026)

### Won't Have (Out of Scope)

- A game engine, framework, renderer, scene graph/runtime, animation system, sprite multiplexer,
  scrolling engine, double-buffer manager, collision library, entity/pool module, state dispatcher,
  audio scheduler/mixer, or gameplay policy. Asset examples and Q-P15 are qualification programs,
  not shipped support systems. (AR-038)
- `loadable const`, D64 construction, loaders, decompression, overlays, streaming, fastloaders, or
  nonresident lifetime/publication. RD-07 owns those capabilities. (AR-029, AR-031, AR-033)
- Automatic representation selection, automatic pre-shifting/compression/replication, or other
  optional cost-guided asset optimization. RD-08 owns proved optimizing choices; RD-06 executes the
  representation explicitly selected by source. (AR-023, AR-033)
- SpritePad/CharPad application execution, a visual editor, build-time Wine dependency, or native
  project generation. Those products author evidence files; Linux builds consume committed bytes.
  (AR-021, AR-037, AR-040)
- Automatic support for older/newer SpritePad or CharPad versions, RSID, MUS, PlaySID-dependent
  tunes, unsupported SID topology, SID Factory II, GTUltra, multi-SID, or arbitrary format/player
  guesses. Each requires its own exact later qualification. (AR-024, AR-040)
- A public target/asset plugin API, scriptable import pipeline, external converter hooks, or generic
  schema/selector/query framework. Add explicit built-in handlers only after a real target and
  accepted evidence require them. (AR-012, AR-022)
- C64U/REU/turbo/UltiSID, X16, C128, Atari 8-bit, Atari 7800, or their asset formats. C64U is the
  separately owned next target; the other machines require their own qualified expert extensions.
  (AR-024, AR-035)

---

## Technical Requirements

### Handler boundary and data model — complexity L

```text
literal embed declaration
  -> contained canonical path + coherent input bytes
  -> selected-profile extension candidate
  -> exact signature/version/structure validation
  -> enumerated opaque selector + exact Blend65 type
  -> symbolic immutable object + provenance + placement constraints
  -> optional user-authored comptime refinement
  -> selected-profile interval layout
  -> ACME bytes + PRG + maps/reports
```

One parsed source file may serve several selectors, but parse caching is a host implementation
detail. The semantic model observes only exact typed outputs and provenance. It does not expose a
mutable parser object, runtime asset handle, generic property bag, or public handler registry.

| Record | Required fields |
|---|---|
| Input identity | Canonical project-relative path, input SHA-256, coherent-snapshot identity |
| Handler identity | Target profile, handler key, accepted format/version, evidence-fixture identity |
| Selected output | Resolved selector/default, exact scalar or fixed type/shape, output SHA-256 |
| Placement intent | Size, alignment, fixed address, no-cross, region, CPU/device view, writability |
| Final layout | Physical interval, bank, padding, aliases, conflicts, derived hardware fields |
| Cost | Artifact bytes, runtime residency, compile-time work observation, runtime transfer/access |

### Exact SpritePad selector contract — complexity M

| Selector | Result and availability |
|---|---|
| `sprites` | `const byte[]`; 64 native bytes per sprite; default selector |
| `count` | `word` sprite count |
| `background_color`, `multicolor_1`, `multicolor_2` | One `byte` each |
| `sprite_attributes` | Explicit derived `const byte[]`, one packed byte per sprite |
| `tile_count` | `word`; number of sprite tiles |
| `tile_width`, `tile_height` | `byte`; tile dimensions in sprites |
| `tiles` | `const word[]`; native row-major sprite indices |
| `tile_attributes`, `tile_tags` | Native `const byte[]` components |
| `sprite_overlay_distance`, `tile_overlay_distance` | One `word` each |
| `sprite_animation_count`, `tile_animation_count` | One `word` each |
| `sprite_animation_starts`, `sprite_animation_ends` | `const word[]` |
| `sprite_animation_timers`, `sprite_animation_flags` | `const byte[]` |
| `tile_animation_starts`, `tile_animation_ends` | `const word[]` |
| `tile_animation_timers`, `tile_animation_flags` | `const byte[]` |

Every optional name is enumerated only when the complete validated file makes it available. Names
or tags used solely for compile-time lookup do not become emitted runtime strings.

### Exact CharPad selector contract — complexity L

| Selector | Result and availability |
|---|---|
| `charset` | `const byte[]`; eight bytes per character; 2-KiB aligned and VIC-visible |
| `tiles` | Smallest-lossless `const byte[]` or `const word[]`; tile mode only |
| `map` | Smallest-lossless `const byte[]` or `const word[]`; tile indices or character indices |
| `tiles_word`, `map_word` | Forced little-endian `const word[]`; `tiles_word` is tile-mode-only |
| `tiles_packed12`, `map_packed12` | Explicit packed `const byte[]`; available only at maximum 4095 |
| `tiles_low`, `tiles_high` | Independent `const byte[]` planes; tile mode only |
| `map_low`, `map_high` | Independent `const byte[]` planes |
| `colors` | Native `const byte[]` for the file's color method |
| `color_method` | Native method as `byte` |
| `map_width`, `map_height` | Dimensions in entries as `word` |
| `tile_width`, `tile_height` | `byte`; each is `1` without tile mode |
| `tile_mode` | `boolean`; always available |

Canonical, forced-word, packed, and split forms are independent selected outputs. The handler does
not emit all useful representations speculatively.

### PSID and player-contract split — complexity L

| Layer | Owns | Must not infer |
|---|---|---|
| PSID handler | Container validation, payload/load/init/play fields, clock/model/topology metadata | SFX ABI, arbitration, writable state, interrupt safety |
| Player adapter | Exact hash-bound entry ABI, features, cues, voices, state, effects, ownership, costs | Compatibility from filename or unbound header alone |
| C64 platform operations | Typed direct init/tick/cue calls through the selected adapter | Scheduler, mixer, generic dispatcher, hidden IRQ |
| User program | When to initialize/tick/request, and all application audio policy | — |

The GoatTracker adapter is one exact external-format/player integration. It does not make
GoatTracker a language concept or turn its queue/arbitration behavior into a Blend65 runtime.

### Resident interval model — complexity L

For a selected 16-KiB VIC bank `B = [0,$4000)`, `S` native SpritePad records placed at bank-relative
offset `o` occupy `R = [o,o + 64*S)`. Require `o mod 64 = 0` and `R` wholly inside `B`. Screen,
charset, bitmap, code, player, global, SFA, ROM-underlay, and reserved intervals retain their own
physical and consumer views. Overlap is legal only for the same canonical immutable object alias;
RD-06 defines no overlay lifetime.

The asset report separates:

- useful source/component bytes;
- emitted object bytes;
- alignment padding and complete reserved intervals;
- immutable aliases versus distinct data;
- CPU-visible, VIC-visible, writable, and self-modifying ranges; and
- zero-cost compile-time facts versus actual runtime residency or explicit access/transfer work.

### Qualification lineage — complexity M

Implementation evidence binds the frozen Specification 4 identity and expert baseline `2.0.0`
activated by RD-01. The decisive expert references are `c64-game-engineering.md#native-asset-handlers`,
`c64-game-engineering.md#integrator-style-scene-and-asset-pipeline`, C64 memory/runtime placement,
compiler architecture, ACME/artifacts, Blend65 semantics, and source-manifest keys
`SPRITEPAD-380`, `CHARPAD-388`, `HVSC-SID-FORMAT-20260906`, `KOALA-NATIVE-003`,
`GOATTRACKER-2.77`, and `GOATTRACKER-R172`. RD-01 must first correct the active expert wording that
currently implies a compiler-supplied renderer while preserving the data-transformation knowledge
and Q-P15 proof. (AR-014, AR-034, AR-038)

---

## Integration Points

### With RD-01 (Specification 4.0 and Expert Authority Freeze)

- Consumes the frozen `embed()`, fixed-value, compile-time-function, placement, C64 handler,
  diagnostic, and expert `2.0.0` contracts, including AR-039's corrected Koala rule and AR-038's
  compiler-only product boundary.

### With RD-02 (Clean V4 Foundation and Deterministic Project Model)

- Uses the manifest's contained asset paths, coherent input snapshot, selected target profile,
  atomic output transaction, and explicit internal platform boundary without adding a plugin
  framework or separate asset build system.

### With RD-03 (Playable M1 Complete Pipeline)

- Requalifies the first SpritePad path against the complete 3.80 fixture set while retaining M1 as
  a regression. The user-provided original-art project is evidence, not a template game system.

### With RD-04 (Complete Language and Correct Unoptimized Compiler)

- Consumes complete fixed arrays/structs, aggregate values, `comptime function`, constant
  evaluation, address-of, diagnostics, and correct `optimization: none` semantics.

### With RD-05 (C64 Platform Profiles and Game-Workload Compiler Support)

- Consumes exact CPU/VIC/SID/profile facts, typed hardware operations, player-call lowering,
  banking, interrupt ownership, and game-workload qualification. Replaces internal/reference asset
  fixtures with exact producer/interchange handlers without adding runtime application behavior.

### With RD-07 (Loadable Assets and D64 Delivery)

- Supplies exact typed objects, hashes, constraints, and resident-layout truth. RD-07 reuses those
  values as explicit nonresident load units; RD-06 itself never links a loader or overlay.

### With RD-08 (Optimization and Expert Output)

- Supplies correct explicit representations, provenance, complete costs, and Q-P15 alternatives.
  RD-08 may choose proved equivalent representations when authorized but cannot invent asset or
  game meaning.

### With RD-09 (Developer Tooling and Debug Evidence)

- Publishes pre-layout selector/type/provenance facts to the shared frontend and final build-only
  address/bank/cost facts to artifact views. The language server never imports format placement or
  code generation merely to answer ordinary source requests.

### With RD-10 (Production Qualification and C64U Handoff)

- Supplies the complete resident native-asset qualification set and exposes where C64U-specific
  storage, transfer, multi-SID, or format assumptions must be reopened rather than inherited.

---

## Scope Decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Product boundary | Asset conversion plus engine behavior / asset conversion only | Typed compile-time asset integration only | Lets developers build any software without making the compiler own game architecture. | AR-038 |
| Initial formats | Current exact identities / broad version compatibility / raw only | SPD v5, CTM v9, PSID v1–v4 subset, Koala classic, raw fallback | Matches explicitly approved current workflows and fail-closed evidence. | AR-040 |
| Format extensibility | Public plugin API / explicit built-in handlers | Built-in handlers only | Avoids a speculative second product and keeps each contract qualified. | AR-012 |
| Koala high bits | Reject / normalize / preserve | Preserve exact bytes; low nibble is hardware meaning | Retains source fidelity and accepts valid historic producer output. | AR-039 |
| Composition | New scene DSL/runtime / ordinary compile-time source | `comptime function` plus fixed values | Reuses the language and produces no target runtime. | AR-019, AR-038 |
| Representation choice | Automatic now / explicit now, optimize later | Source selects under `none`; RD-08 may optimize | Keeps correctness independent from optimizer policy. | AR-023, AR-033 |
| Residency | Hidden loading / resident values / explicit later load units | Resident only in RD-06 | Keeps ordinary `embed()` truthful; RD-07 owns transport. | AR-029, AR-031 |
| Placement | Handler-fixed addresses / automatic target layout plus expert constraints | Symbolic constraints solved by final layout | Separates file meaning from target memory while retaining exact hardware legality. | AR-007, AR-020 |

> **Traceability:** All material choices are recorded in
> [00-ambiguity-register.md](00-ambiguity-register.md). Specification 4 owns exact public syntax,
> selector spelling, types, diagnostics, and C64 profile contracts; this RD does not create a second
> language authority.

---

## Security Considerations

- **Data sensitivity:** Asset files contain no required credentials, personal data, secrets, or
  network data. Reports use canonical project-relative identities and hashes, not host absolute
  paths or arbitrary binary dumps.
- **Input validation:** Treat every asset as untrusted binary input. Use bounded reads,
  overflow-safe length/count/index arithmetic, exact magic/version/field validation, conditional
  block validation, and exact EOF before allocating or exposing selectors. Reject decompression or
  recursive container behavior in RD-06.
- **Authentication and authorization:** N/A; this is a local compiler with no accounts, remote
  service, or privilege model.
- **Injection risks:** Canonicalize and contain every source/asset path under the project root,
  reject absolute paths and traversal/symlink escapes, and never turn asset bytes, names, tags,
  selectors, or source strings into ACME source directives or shell fragments. Invoke no authoring
  application or converter.
- **Encryption:** N/A; no sensitive data is stored or transmitted.
- **Rate limiting:** N/A; there is no network or public endpoint. Parser budgets bound local
  resource exhaustion instead.
- **Infrastructure:** Add no daemon, downloader, executable plugin, converter process, Wine
  dependency, container, secret, or network permission. The build consumes local committed inputs.
- **Target safety:** Reject wrap, overlap, impossible bank/visibility, unsupported SID topology,
  writable-player collision, and unproved hardware placement before ACME. A failed import/layout
  publishes no new PRG or evidence set.
- **Security verification:** Negative fixtures cover path escape, integer overflow, exaggerated
  counts/dimensions, truncation at every block boundary, trailing data, malformed Unicode/path
  spelling, selector abuse, registered-format raw bypass, and parser resource budgets.

---

## Acceptance Criteria

1. [ ] **AC-01 — Closed handler list:** The selected C64 profile exposes exactly SPD v5, CTM v9,
   qualified PSID v1–v4, classic Koala, and unregistered-extension raw inclusion. Adjacent versions
   and unsupported registered variants fail with E10204 and emit no bytes.
2. [ ] **AC-02 — Literal dispatch:** Positive cases resolve source-relative then ordered manifest
   asset paths. Nonliteral path/selector, selector on raw input, missing registered default, and
   unknown selector produce E10136, E10250, E10137, E10132, and E10133 respectively.
3. [ ] **AC-03 — Coherent snapshot:** Replacing any source, manifest, or asset during input capture
   causes a complete retry or deterministic failure; no output set contains mixed input hashes.
4. [ ] **AC-04 — Typed constant boundary:** Every selector produces its specified scalar/fixed
   immutable type. Mutable, runtime-local, scalar/array-context, explicit-extent, and element-type
   mismatches fail with the Specification 4 diagnostic and no artifact.
5. [ ] **AC-05 — Requested-only emission:** For every multi-component fixture, selecting one output
   emits only its reachable bytes and metadata. Unselected alternate encodings, names, offsets,
   tables, and components are absent from the PRG and asset report.
6. [ ] **AC-06 — Canonical aliasing:** Two declarations of the same canonical path/resolved
   selector/representation share one address and one byte count; a different selector or
   representation remains a distinct object.
7. [ ] **AC-07 — SPD identity and records:** Authentic 3.80 fixtures prove ASCII `SPD` v5, exact
   64-byte records, word counts, global colors, packed per-record attributes, default `sprites`, and
   every selector in the SpritePad technical table by type, length, and SHA-256.
8. [ ] **AC-08 — SPD optional matrix:** The `SPD380-OPTIONALS-V5-*` set exercises every supported
   tile, tag, overlay, sprite-animation, and tile-animation component both present and absent in
   meaningful valid combinations; absent selection is E10133.
9. [ ] **AC-09 — SPD failures:** V4, v6, every block truncation, mismatched count/index/attribute,
   and trailing-byte case produces E10204 at the exact field/offset and no selected object.
10. [ ] **AC-10 — SPD placement:** A legal aligned visible record set yields exact final
    `vicSpriteBlock` values with no runtime calculation/copy. Misaligned, out-of-bank, and
    256-record-plus-active-screen resident cases fail with interval evidence before ACME.
11. [ ] **AC-11 — CTM identity and modes:** Authentic 3.88 fixtures prove ASCII `CTM` v9, complete
    ordered blocks, every display × color × tile-mode combination, exact EOF, and all selector
    types/availability in the CharPad table.
12. [ ] **AC-12 — CTM canonical width:** Maximum index 255 produces `byte[]`; 256 produces
    little-endian `word[]`. Declaring the opposite type produces E10144 with the required type and
    never truncates or changes the parsed file result.
13. [ ] **AC-13 — CTM packed-12:** `$123,$456,$789` produces
    `$23,$56,$89,$41,$07`; an odd final value zero-fills the unused upper nibble. Maximum 4095 is
    accepted and 4096 makes the packed selector unavailable with E10133.
14. [ ] **AC-14 — CTM independent representations:** Canonical, forced-word, packed-12, low, and
    high selections each emit only their own exact bytes. Non-tile mode retains `tile_width=1`,
    `tile_height=1`, and `tile_mode=false` while rejecting only tile-mode-only selectors.
15. [ ] **AC-15 — CTM failures:** V8, v10, wrong block order, exaggerated dimensions/counts,
    invalid indices, every block truncation, and trailing bytes produce E10204 before allocation or
    output publication.
16. [ ] **AC-16 — PSID versions and load rules:** Fixed-load and payload-load-address fixtures for
    versions 1–4 prove version-correct data offsets, big-endian headers, little-endian embedded load
    address removal, zero-init resolution, exact payload bytes, and nonzero in-range play address.
17. [ ] **AC-17 — PSID rejection and compatibility:** RSID, MUS, PlaySID dependency, zero play,
    malformed offsets/ranges, unsupported SID address/topology, and specific profile mismatch
    produce E10204 or E10261 according to structural versus compatibility ownership.
18. [ ] **AC-18 — Unknown is not Both:** Unknown PSID clock/model remains legal embedded data but
    cannot be called without an exact contract; a specific compatible set passes and a specific
    incompatible set fails without conversion.
19. [ ] **AC-19 — GoatTracker exact adapter:** Hash-bound GoatTracker 2.77 music-only and `-Dx`
    exports prove direct init/tick/SFX call sequences, logical voice mapping to X offsets
    `0`, `7`, `14`, enabled feature pruning, exact writable ranges, and complete resource costs.
20. [ ] **AC-20 — No audio engine:** Static and binary inspection finds no compiler-installed IRQ,
    scheduler, mixer, generic queue, dispatcher, runtime name table, or unrequested player feature.
    User source contains every tick/cue call site; unsafe overlap is E10258.
21. [ ] **AC-21 — Koala exact layout:** Zero-pattern, patterned, and nonzero-high-nibble 10,003-byte
    fixtures prove `$6000`, component lengths `8000/1000/1000/1`, exact requested output hashes,
    selector-required behavior, and requested-only emission.
22. [ ] **AC-22 — Koala nibble preservation:** Every Color RAM source byte, including nonzero high
    bits, is preserved byte-for-byte; metadata reports low-nibble hardware meaning. No case is
    rejected or normalized solely for an unused high bit.
23. [ ] **AC-23 — Koala hardware placement:** Bitmap and screen resolve to legal aligned locations
    in one VIC bank and yield exact derived `$D018` fields. The build contains no implicit Color RAM
    transfer; a user-authored transfer's bytes and cycles appear separately.
24. [ ] **AC-24 — Raw fallback:** A nonempty unregistered file embeds byte-for-byte. Empty input is
    E10131, selector use is E10137, and malformed `.spd`, `.ctm`, `.sid`, `.kla`, or `.koa` never
    bypasses its registered handler.
25. [ ] **AC-25 — Compile-time-only refinement:** A `comptime function` reads embedded data and
    returns exact fixed arrays/structs with no target instructions, SFA homes, stack use, helper,
    file read, MMIO access, or runtime conversion.
26. [ ] **AC-26 — Integrator-style Q-P15:** The workload proves repeated elements/panels,
    foreground occlusion, one multicolor conflict, two explicit source-selected representations,
    exact output bytes/hashes, reuse/padding/visibility, conflict diagnostics, and no hidden copies
    or public renderer/scene API.
27. [ ] **AC-27 — Runtime consumer boundary:** Q-P15's user-authored renderer produces the expected
    VICE-visible draw/occlusion/update behavior and worst-case cycle record. Its code cost is
    separate from assets and no equivalent renderer/support module is linked by the compiler.
28. [ ] **AC-28 — Interval layout:** The complete resident qualification project proves every code,
    global, SFA, player, screen, charset, bitmap, sprite, Color RAM, ROM-underlay, and reserved
    interval without overlap or visibility ambiguity. Useful, emitted, padding, and reserved bytes
    reconcile without double counting.
29. [ ] **AC-29 — One-copy rule:** Every selected asset has one final resident copy unless it is a
    canonical alias. Static inspection and the PRG/hash map find no convenience duplicate, runtime
    relocation, transcoding, or implicit offset table.
30. [ ] **AC-30 — Placement failures:** Misalignment, no-cross, fixed-load collision, mixed VIC
    bank, character-ROM visibility, reserved-range overlap, and out-of-memory each identify every
    conflicting constraint and publish no ACME/PRG artifact.
31. [ ] **AC-31 — Complete asset report:** Every selected/derived output contains all R6.46 fields;
    scalar compile-time metadata, artifact bytes, final residency, import work, and runtime access
    or transfer are separate quantities, with missing evidence reported as `Unknown` rather than
    zero.
32. [ ] **AC-32 — Authentic fixture manifest:** Every accepted producer/interchange fixture has
    provenance, pinned identity, redistribution disposition, SHA-256, expected selector inventory,
    output type/length/hash, and negative-derivation lineage. No invented fixture fills a required
    SpritePad or CharPad producer slot.
33. [ ] **AC-33 — Secure parser boundary:** Path traversal/symlink escape, oversized counts,
    arithmetic overflow, truncation at every boundary, invalid conditional blocks, selector abuse,
    and hostile names/tags fail deterministically without escaping the project, executing a tool,
    exhausting the parser budget, or leaking binary/absolute-path content.
34. [ ] **AC-34 — Impact-based verification:** Evidence records focused tests for each handler,
    typed frontend, interval layout, ACME artifact, and bounded VICE consumer, followed by one
    complete RD-06 integration run. It contains no repeated unrelated compiler/readiness/emulator
    suite after each fixture.
35. [ ] **AC-35 — Honest status and lineage:** Public status identifies the exact supported
    format/adapter versions, frozen Specification 4 and expert `2.0.0` identities, fixture evidence,
    selected C64 profiles, and any `VICE-verified / hardware-unverified` boundary. Missing producer
    evidence is never reported as qualification.
36. [ ] **AC-36 — Compiler-only product surface:** Public packages, examples, generated support,
    reports, and binaries contain no renderer, scene runtime, animation/game system, scheduler,
    mixer, or gameplay architecture. Handler results stop at typed data, metadata, symbols,
    provenance, constraints, and placement/package facts. (AR-038)
37. [ ] **AC-37 — Deferral-expiry closeout:** The closeout answers whether RD-06 invalidated any
    deferral rationale, reassigns every due item, and leaves no deferred item naming closed RD-06
    work as its future owner.

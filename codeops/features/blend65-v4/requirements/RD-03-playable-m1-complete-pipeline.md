# RD-03: Playable M1 Complete Pipeline

> **Document**: RD-03-playable-m1-complete-pipeline.md
> **Status**: Draft
> **Created**: 2026-09-10
> **Project**: Blend65 v4
> **Depends On**: RD-01, RD-02
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

M1 is the first useful Blend65 v4 product slice: a bounded, original-art Invaders-style microgame
that compiles with `optimization: none`, runs on the exact `c64-pal-prg-kernal-6581` profile, uses
all eight hardware sprites without multiplexing, responds to joystick port 2, reaches a visible win
or loss, and returns normally to BASIC. It starts from the real `blend65.json` project model and
crosses every required boundary: shared frontend, whole-program semantics, Static Frame Allocation
(SFA), target-neutral lowering, C64/6510 lowering, instruction selection, resource binding, layout,
ACME 0.97, PRG packaging, and VICE 3.10 execution.

This is not a compiler skeleton. Every stage implements the complete contract required by the M1
source and focused boundary cases. No stage may forward unresolved or untyped material, emit a
placeholder operation, claim a future target, or compensate for missing analysis with unusual
source. M1 deliberately remains a narrow language and platform slice; RD-04 completes
Specification 4; later RDs add broader C64 platform support, compile-time assets, optimization,
and production tooling. Game-shaped programs remain qualification workloads, not a second engine
product. (AR-038)

> **Decisions:** AR-002, AR-004 through AR-014, AR-020 through AR-030, AR-032 through AR-038.
> **Primary M1 decisions:** AR-027 and AR-037.

---

## Functional Requirements

### Must Have

#### One useful public journey — complexity XL

- [ ] **R3.1 — Ship one real M1 project.** Provide a contained `blend65.json` project whose entry
  graph builds one playable SpritePad-backed Invaders-style microgame for
  `c64-pal-prg-kernal-6581` with `optimization: none`, `boundsCheck: false`, and
  `divisionZeroCheck: false`. The project is the same source used for CLI, editor, assembly,
  artifact, and VICE qualification. Its name and art are original; it imports no game ROM, copied
  sprite sheet, or other third-party game asset. (AR-022, AR-023, AR-027, AR-037)
- [ ] **R3.2 — Define the observable game exactly.** Use sprite 0 for one player, sprites 1 through
  6 for six invaders, and sprite 7 for either the one active player projectile or its two-frame
  explosion. The player moves left/right from joystick port 2; a rising fire edge creates a
  projectile only when that slot is idle. A fixed enemy-state array, an ordinary `for` loop, and
  source-level rectangular collision update the six invaders. Destroying all six enters the win
  state; an invader reaching the player line enters the loss state. After either terminal state is
  visible, a released-then-pressed fire action restores compiler-owned machine state and returns
  through the profile's BASIC-return contract. The exact constants and update order are fixed by
  the behavior table below. (AR-013, AR-027, AR-037)
- [ ] **R3.3 — Provide truthful CLI commands.** `blendc check` performs project loading, reachable
  module/frontend analysis, and every selected-profile check provable before layout. `blendc build`
  performs a fresh complete pipeline and atomically publishes the M1 artifact set. `blendc run`
  performs its own successful fresh build, launches that exact PRG in configured VICE, and never
  runs a stale artifact after any failure. Exit statuses distinguish source/compiler, assembler,
  packaging, tool-discovery, emulator-start, and emulator-runtime failures. (AR-009, AR-022,
  AR-032)
- [ ] **R3.4 — Add only the minimum real editor slice.** A small language server reuses the exact
  project/frontend service to publish lexical, syntax, module, and semantic diagnostics for `.blend`
  documents. A thin VS Code extension registers the language, starts that server over stdio, and
  shows diagnostics. This real bundle may introduce Vite. Build/run commands, navigation, rename,
  formatting, debug integration, and the complete production editor surface remain RD-09 work.
  (AR-021, AR-027, AR-036)

#### Complete frontend for the admitted slice — complexity XL

- [ ] **R3.5 — Implement the real lexer contract.** Tokenize the complete lexical forms exercised
  by M1 and its focused cases from Specification 4, retaining exact UTF-8 byte spans, literal
  spelling/value, comments, keywords, operators, maximal-munch behavior, and recoverable lexical
  diagnostics. The lexer has no C64, address, SpritePad, ACME, or machine-cost knowledge. (AR-014,
  AR-027)
- [ ] **R3.6 — Implement the real parser contract.** Parse the admitted declarations, modules,
  imports, types, statements, fixed arrays, structs, calls, postfix forms, and expressions with one
  precedence-owning Pratt expression parser. Parse the familiar three-clause
  `for (initializer; condition; update)` through the ordinary expression parser; do not restore the
  v3 range loop or create a special loop-expression grammar. Syntax recovery must retain useful
  independent diagnostics without making recovered nodes valid semantic input. (AR-014, AR-027)
- [ ] **R3.7 — Build the reachable module graph from language headers.** Use RD-02's deterministic
  source snapshot to parse module headers, merge legal same-module contributions, resolve qualified
  imports, detect collisions/missing exports and initializer cycles, locate exactly one selected
  entry `main`, and analyze only its reachable graph plus profile-provided modules. Filenames do not
  define modules and circular declaration-only imports remain legal. (AR-028, AR-030)
- [ ] **R3.8 — Implement the coherent semantic slice.** Correctly resolve and type the M1 forms:
  module/import/export; module and local `const`/`let`; `byte`, `sbyte`, `word`, `sword`, `boolean`,
  and `void`; conversions; unary/binary/assignment expressions; `if`, `while`, standard `for`,
  `break`, `continue`, and `return`; ordinary functions and nested calls; the fixed arrays and
  structs used by M1; variable-address `PEEK`/`POKE`; literal `embed()`; and the exact selected C64
  profile APIs used by the program. Implemented behavior comes only from frozen Specification 4,
  not from v3 behavior or tests. The game must express its fixed six-element enemy state and
  collision functions directly; a compiler limitation may not force hand-unrolled enemy logic or
  raw VIC writes. (AR-003, AR-006, AR-014, AR-027, AR-037)
- [ ] **R3.9 — Preserve modern evaluation behavior.** Enforce left-to-right evaluation, exact
  intermediate widths and wrapping, right-associative value-producing assignment, single
  evaluation of places and operands, short-circuit control, fixed-array ordinal promotion, and
  correct nested-call staging. `POKE(variableAddress, value)` and nested calls are mandatory
  positive cases; requiring literals or source-written temporaries is a compiler defect. (AR-002,
  AR-006, AR-015 through AR-018)
- [ ] **R3.10 — Keep diagnostics authoritative and terminal.** Use Specification 4 codes, severities,
  messages, UTF-8 primary/related spans, notes/help, stable ordering, and cascade suppression for
  every admitted invalid class. Poison may support independent frontend recovery but cannot enter
  SFA, lowering, layout, ACME, or artifact publication. Any error suppresses all runnable-looking
  output. (AR-003, AR-014, AR-025)

#### Small accountable representations and SFA — complexity XL

- [ ] **R3.11 — Add only representations with an M1 consumer.** Use the smallest typed semantic and
  machine representations that preserve every M1 distinction needed downstream: widths,
  signedness, wrap, place/value identity, evaluation order, CFG edges, volatility, memory access
  width/count/order, calls/effects, alias/escape, symbolic storage, placement constraints, source
  provenance, target capability, registers, flags, clobbers, and costs. Do not create a generic IR
  framework, textual pseudo-assembly, pass registry, or one package/class per responsibility.
  (AR-012, AR-025, AR-027)
- [ ] **R3.12 — Lower control flow explicitly.** Represent branches, short circuit, early return,
  and the standard `for` initializer/condition/body/update/end edges explicitly. `continue` reaches
  update; `break` and `return` do not. The generic correct CFG is required even if one M1 loop also
  admits a smaller proved machine form. (AR-014, AR-027)
- [ ] **R3.13 — Close the real whole-program graph.** Determine startup, module initializers,
  `main`, direct and finite resolved call targets, platform operations, and compiler-selected helper
  edges. Reject recursive strongly connected components. Do not infer safety by omitting an unknown
  call, callback, or target edge. M1 has no IRQ callback and must not create an interrupt dispatcher.
  (AR-018, AR-027)
- [ ] **R3.14 — Complete SFA for all execution storage.** Allocate every parameter, return, local,
  argument-staging value, expression temporary, spill, indirect-address pointer pair, and helper
  scratch required by the admitted program. Nested calls such as `f(1, f(2, 3))` preserve the outer
  argument without false recursion. Globals, fixed enemy state, and sprite assets remain outside
  SFA. (AR-002, AR-015, AR-027, AR-037)
- [ ] **R3.15 — Enforce final storage closure.** Target legalization and resource binding return
  every new temporary, spill, pointer, or helper byte to SFA. Recompute interference and placement
  through a bounded monotonic process, then freeze a closure certificate before final layout and
  emission. No later stage or ACME macro may invent function-lifetime RAM or zero page. (AR-002,
  AR-012, AR-027)
- [ ] **R3.16 — Add no hidden runtime.** M1 links no heap, software stack, dispatcher, scheduler,
  generic safety handler, asset copier, or library runtime. Required startup/return code and any
  selected direct helper are explicit profile/compiler output with complete ownership and cost.
  (AR-002, AR-006, AR-013, AR-023)

#### C64/6510 backend, platform behavior, and placement — complexity XL

- [ ] **R3.17 — Compose target facts without leaking them upstream.** Bind the normative
  `c64-pal-prg-kernal-6581` profile as independently owned CPU, C64 machine, ACME serializer, and
  PRG packager facts. Shared frontend and semantic representations contain no `$Dxxx`, VIC, CIA,
  SID, KERNAL-address, ACME-syntax, PRG-header, PAL-cycle, or 6510-opcode assumption. (AR-012,
  AR-013, AR-024, AR-027)
- [ ] **R3.18 — Lower named platform intent at zero abstraction cost.** The Specification 4 C64
  profile APIs used by M1 own frame-boundary observation, joystick-port-2 sampling, sprite
  enable/position/pointer/color for all eight slots, border result indication, and normal exit. They
  lower to the same direct volatile operations and already-required control flow an expert would
  write—without generic dispatch, hidden calls, duplicate register reads/writes, runtime address
  discovery, or data copying. Ordinary game source does not need VIC/CIA magic numbers. Collision
  and game-state rules remain ordinary target-neutral source rather than hidden platform behavior.
  (AR-007, AR-013, AR-027, AR-037)
- [ ] **R3.19 — Keep raw memory access correct and separate.** Focused full-pipeline cases prove
  variable and expression addresses for byte and word `PEEK`/`POKE`, little-endian word access,
  exactly-once address/value evaluation, volatile access identity/order, modulo-65536 address
  behavior, and any SFA-owned indirect pointer pair. The M1 game uses named C64 APIs where they
  express the intended device operation; raw memory intrinsics remain available for deliberate
  low-level work. (AR-006, AR-027)
- [ ] **R3.20 — Select legal documented NMOS output.** Target legalization, instruction selection,
  register/flag binding, mandatory CFG layout, and branch repair produce structured legal
  `nmos6510` machine operations restricted to the documented NMOS instruction set. The C64 machine
  model owns the 6510 `$0000/$0001` port separately. Do not use undocumented or CMOS-only opcodes,
  ambient carry or decimal assumptions, opaque ACME macros, or optional optimizer transforms.
  `optimization: none` still includes correct constant evaluation, dead unreachable exclusion,
  legal instruction selection, SFA/resource binding, layout, and branch repair. (AR-002, AR-023,
  AR-027)
- [ ] **R3.21 — Qualify the current SpritePad input before use.** Before RD-03 implementation
  planning or asset-decoder work, the project owner supplies and approves retention of the
  user-owned native project and relevant exports produced by the official SpritePad C64 Pro 3.80
  application; the compiler implementation owner records and independently checks the fixture.
  Record producer/version, execution environment, settings, provenance, redistribution disposition,
  and SHA-256; retain a distinguishable nonblank template and the final producer-saved art project.
  The consumed SPD v5 schema review validates signature, version,
  counts, complete 64-byte records, used attributes, tails, exact EOF, record order, and requested
  selector. A handmade file, v3 parser, extension, passing legacy test, or comparative parser alone
  cannot establish qualification. SpritePad is never invoked by the compiler, Linux build, or CI.
  Missing evidence blocks the format-dependent boundary rather than requirements authoring or a
  guessed implementation. This bounded eight-sprite evidence does not satisfy RD-06's complete
  SpritePad/CharPad fixture gates. (AR-014, AR-027, AR-037)
- [ ] **R3.22 — Emit only the selected asset representation.** `embed(path, "sprites")` produces
  the exact typed native 64-byte record array required by Specification 4. The final M1 game project
  contains exactly eight records: player, two two-frame invader designs, projectile, and two-frame
  explosion. The `"sprites"` selector emits all eight in source order; it is not a record-subset
  query. Unrequested attributes, tiles, animation metadata, overlays, derived selector outputs, or
  duplicate raw payloads are not emitted. A broader format-probe fixture may remain test-only but
  is never linked into M1. The compile-time handler allocates no SFA storage and adds no runtime
  parsing or conversion code. (AR-007, AR-020, AR-027, AR-037)
- [ ] **R3.23 — Place sprite art once where the VIC reads it.** Platform layout assigns the selected
  records one non-overlapping, 64-byte-aligned interval wholly inside the active 16-KiB VIC bank,
  outside character-ROM visibility conflicts and the active 1-KiB screen matrix. Derive every
  sprite pointer from final bank-relative placement; multiple hardware sprites may deliberately
  share one immutable record. The PRG loads the bytes directly at their final address; no startup
  or frame-time copy, duplicate representation, or runtime division is allowed. (AR-007, AR-020,
  AR-027, AR-037)
- [ ] **R3.24 — Implement exact startup and BASIC return.** Emit the profile's 12-byte BASIC
  auto-start line at `$0801`–`$080C`, enter generated startup at `$080D`, establish required stack,
  decimal, banking, I/O, VIC/CIA, and interrupt assumptions, execute reachable module initializers
  once, and enter `main` through the specified fallthrough boundary. Save and restore every
  compiler-owned machine/register/device field changed by M1 and return safely to BASIC. Do not
  disable or replace the cooperative KERNAL IRQ merely to simplify the program. (AR-013, AR-027)

#### Terminal emission, artifacts, and execution — complexity XL

- [ ] **R3.25 — Keep ACME emission terminal.** Serialize the final structured machine program to
  deterministic ACME 0.97 source with explicit CPU, origin, segments, align fill, stable labels,
  parenthesized expressions, and deliberate addressing widths. The emitter performs no semantic
  optimization, storage allocation, target policy, asset parsing, or string-based branch repair.
  Generated source contains no `!to` directive and never interpolates the manifest `name`, final
  output path, or another raw project string as ACME source syntax. Program values and symbols are
  emitted only through their typed compiler-owned serializers. The compiler driver is the sole
  owner of output name and format. (AR-012, AR-022, AR-027)
- [ ] **R3.26 — Invoke and verify ACME exactly.** Discover ACME outside project configuration,
  require version 0.97, and invoke it with an argument array using `--cpu 6502` so ACME rejects
  undocumented forms while the compiler separately models the 6510 port. Supply `--format cbm`,
  `--outfile`, `--report`, and `--symbollist` as separate direct arguments containing the validated
  canonical staging paths for `<name>.prg`, fixed staging-only `.acme.report`, and published fixed
  `.labels`, plus `--strict-segments`; generated source is fixed `.asm`. Do not use a shell or
  permit project data to become an option. Before invocation, require the three output paths to be
  distinct and absent inside the unique staging directory. After invocation, require every expected
  output to be an ordinary regular file at its planned identity; reject a symlink, device,
  directory, alias, unexpected file, stale output, or overwrite. Treat any diagnostic/error as
  build failure. Verify process status, report, symbol list, actual bytes, segment ranges,
  addressing widths, asset bytes, and PRG header/body agreement, then remove `.acme.report` before
  publication. (AR-022, AR-027, AR-032)
- [ ] **R3.27 — Publish one coherent evidence set atomically.** A successful build publishes the
  PRG plus deterministic assembly, labels, memory/segment map, asset map, SFA/closure report,
  zero-page and hardware-stack report, code/data/padding and path-cycle report, source/debug map,
  selected-profile/tool identities, options/overrides, and input/output SHA-256 values. The
  selected profile materializes and validates the complete final component set before staging:
  `<name>.prg`, `.asm`, `.labels`, `.memory.json`, `.assets.json`, `.costs.json`, `.debug.json`, and
  `.build.json` for M1. The basename is preserved literally only in the primary artifact; fixed
  sidecar components never derive from it. Each JSON sidecar conforms to its small direct versioned
  schema. All files bind one snapshot through
  explicit semantic-input and output hashes inside one uniquely named immutable generation; one
  atomically replaced current-generation
  record publishes the complete set. A failed or pre-commit-cancelled build publishes no new
  generation as current and leaves no stale file looking current. (AR-008, AR-010, AR-022, AR-032)
- [ ] **R3.28 — Run the exact fresh PRG in VICE 3.10.** `blendc run` verifies `x64sc` version 3.10,
  pins the exact immutable generation returned by its own build without re-resolving the current
  record, selects that generation's recorded PAL C64 model/profile settings, launches only its PRG,
  reports the bounded status
  `VICE-verified / hardware-unverified`, and owns reliable cancellation and child cleanup.
  Publication is the no-return point: cancellation before the current-generation commit publishes
  nothing, while cancellation after it preserves the complete build and stops only VICE and its
  monitor/control work. Interactive run leaves control with the developer; automated qualification
  stops VICE externally after observing the return contract. (AR-009, AR-013, AR-027)
- [ ] **R3.29 — Exercise real emulated joystick input deterministically.** The qualification driver
  uses one version-pinned VICE-supported control-port input mechanism to replay a checked-in,
  requirements-derived PAL-frame trace that moves the player, launches projectiles, destroys all
  six invaders, displays the win state, releases fire, presses it again, and returns to BASIC. It
  must exercise the emulated joystick-port-2/CIA path—not patch game variables, alive flags, the
  selected branch, or expected VIC registers. A separate pure behavior case reaches loss by letting
  the formation reach the player line; one final VICE boundary run is sufficient unless platform
  behavior changes. The implementation plan must first prove and record the smallest reliable VICE
  3.10 injection mechanism; skipped or unavailable input evidence is `Unknown`, never a pass.
  (AR-027, AR-037)

#### Independent proof without a readiness product — complexity XL

- [ ] **R3.30 — Derive specification tests before implementation.** Re-author immutable
  `*.spec.test.ts` cases from RD-01/RD-03 and pinned CPU/C64/ACME/VICE authorities for each admitted
  stage and public command. Keep implementation-focused `*.impl.test.ts` cases separate. Do not
  copy v3 expectations merely because they pass. (AR-004, AR-025, AR-027)
- [ ] **R3.31 — Prove each transition, not just the final demo.** Directed cases observe tokens,
  syntax/recovery, module resolution, types/effects, semantic operations/CFG, call roots, SFA homes,
  storage closure, target legalization, machine operations, layout, ACME text, assembled bytes,
  PRG structure, and VICE behavior. Each transition states what it consumes, preserves, produces,
  rejects, and must never own. (AR-003, AR-012, AR-027)
- [ ] **R3.32 — Use an independent behavior oracle.** Define expected source results and machine
  effects independently of the compiler: joystick samples, update order, all entity states and
  per-frame coordinates, fire-edge/projectile/explosion transitions, collision results, win/loss,
  volatile access count/order, sprite placement/visibility, startup, restored state, and return.
  Comparing two compiler paths or reading generated assembly is supporting evidence only. (AR-002,
  AR-027, AR-037)
- [ ] **R3.33 — Establish an independent expert assembly and cost baseline.** Before accepting codegen,
  write or obtain an equivalent hand-authored ACME M1 twin under the identical profile, startup,
  input, asset, frame, and return obligations. Compare final assembled code/data/padding, ZP, SFA,
  stack, memory traffic, and relevant path cycles. Under `optimization: none`, correctness and
  deterministic canonical lowering are acceptance gates; expert-cost comparison is recorded as the
  RD-08 optimization baseline and does not fail M1 or create parity debt. The twin implements the
  same fixed entity, collision, and terminal-state behavior rather than a smaller sprite
  demonstration. (AR-002, AR-023, AR-027, AR-037)
- [ ] **R3.34 — Keep verification impact-based.** During implementation run the affected stage or
  package cases. At M1 closeout run the complete new v4 foundation/frontend/compiler/CLI/editor
  boundary suite, the one M1 ACME build, and the one M1 VICE qualification path. Do not import v3's
  readiness suites, game matrix, thousands of unrelated tests, repeated full-corpus batches, or a
  replacement qualification framework. VICE remains a local sequential tier and is absent from
  shared CI; ACME and pure artifact/oracle checks run in CI. (AR-025, AR-026, AR-027)
- [ ] **R3.35 — Pass the early C64U-readiness review.** Confirm from the implemented seams that
  shared semantics/IR contain no C64 address or device assumptions; CPU, machine, serializer, and
  packager facts are independent; storage identity can later represent banked or transfer-only
  memory; DMA effects and independent clocks have owners; and no speculative C64U code/package was
  created. A failed item corrects the seam now; it does not add a plugin framework. (AR-024,
  AR-027)

### Should Have

- [ ] **R3.36 — Keep the M1 source readable — complexity S.** The example should read as a small
  modern game program: named entity state, ordinary loops/functions, visible collision rules, and
  direct win/loss flow. Hardware-specific intent uses named C64 APIs, comments explain game intent,
  and compiler mechanics such as SFA homes, VIC block arithmetic, or ACME syntax do not appear in
  ordinary source. (AR-002, AR-007, AR-037)
- [ ] **R3.37 — Record observational host measurements — complexity S.** At M1 closeout record
  separately attributable check, frontend, SFA/lowering, ACME, complete build/run startup, LSP
  diagnostic, and peak-host-memory observations for the real M1 project. No numeric threshold may
  fail a test, milestone, or release. (AR-026)

### Won't Have (Out of Scope)

- Complete Specification 4 language coverage, aggregate returns, function values, compile-time
  functions, all placement forms, all safety paths, every diagnostic, or every low-level intrinsic;
  RD-04 owns complete correct `optimization: none` coverage.
- Optional target-neutral or machine optimization for `balanced`, `speed`, or `size`; an optimizer
  catalog, pass DSL, plugin system, or general peephole framework. RD-08 owns optional optimization.
- IRQ callbacks, raster scheduling, multiplexing, scrolling, double buffering, audio/SFX, loaders,
  overlays, D64 delivery, or aggressive VIC techniques. M1 contains only its exact ordinary-source
  projectile-versus-invader rectangles; RD-05 through RD-07 own the compiler, hardware, asset, and
  delivery capabilities needed by broader user-authored workloads. (AR-038)
- A faithful Space Invaders recreation, copied art, scores, lives, barriers, enemy projectiles,
  attract mode, multiple levels, or a reusable game engine. These would obscure the compiler proof
  and turn a compiler qualification fixture into a second product. (AR-038)
- CharPad, PSID, Koala, general SpritePad selector coverage, compile-time asset composition, derived
  assets, or runtime-loadable assets. M1 qualifies only the exact resident SpritePad surface it
  consumes.
- Production LSP/VS Code navigation, completion, hover, signature help, rename, formatting,
  build/run UI, generated-artifact browsing, source debugger, or owned debug adapter. RD-09 owns the
  production tooling surface.
- NTSC, takeover, 8580, D64, C64U, X16, Atari, another CPU, another emitter, or another packager
  implementation. Their constraints may test the seam but cannot appear as support.
- A readiness service, dashboard, score, broad game corpus, feasibility matrix dependency, remote
  build/test service, persistent compiler daemon, or mandatory incremental compilation.

---

## Technical Requirements

### M1 end-to-end contract — complexity XL

```text
blend65.json + coherent source/asset snapshot
  -> lexer -> parser -> reachable module graph -> semantic analysis
  -> typed semantic operations + explicit CFG
  -> whole-program roots/effects/lifetimes -> SFA plan
  -> selected C64/6510 legalization -> machine operations/resource binding
  -> final SFA closure -> platform layout -> mandatory CFG layout/branch repair
  -> deterministic ACME 0.97 -> verified bytes/report/symbols
  -> verified PRG + coherent evidence publication
  -> VICE 3.10 exact-profile execution
```

Each arrow has a typed success/failure result and a direct proof. Adjacent responsibilities may
share a package or module when their contracts remain independently visible. A later implementation
plan decides the smallest consumer-driven package graph; this diagram does not authorize one
package, class, or pass per arrow.

### M1 language coverage matrix — complexity XL

| Surface | Positive boundary required in RD-03 | Explicitly deferred boundary |
|---|---|---|
| Modules | merged contributions, qualified imports/exports, selected entry and deterministic initialization | broad production-scale namespace/tooling coverage |
| Values | required scalar types/conversions, module/local `const`/`let`, assignment values | complete aggregate value/return surface |
| Expressions | precedence, left-to-right effects, calls, indexing, fields, dynamic addresses | every Specification 4 operator/type combination |
| Control | `if`, `while`, three-clause `for`, `break`, `continue`, `return`, short circuit | complete switch/fallthrough matrix |
| Functions | direct ordinary calls, nested calls, scalar return, recursion rejection | function values and interrupt functions |
| Aggregates | fixed arrays and structs used by M1, correct ordinal promotion | nested/unsized parameters and full copy/return matrix |
| Intrinsics | variable-address `PEEK`/`POKE`, exact `embed()` use | remaining intrinsic families and optional safety paths |
| Platform | frame boundary, joystick 2, all eight sprites, normal exit | IRQ/audio/loading and other C64 systems |

Every positive row reaches actual 6510 bytes through at least one focused fixture. A deferred row
has no fake node, empty handler, package, or success result.

### M1 input and behavior oracle — complexity L

The game uses only fixed state and compile-time constants:

| State | Exact M1 value |
|---|---|
| Runtime sprite ownership | 0 player; 1–6 corresponding invaders; 7 projectile or explosion |
| Display | high-resolution, unexpanded sprites; black background/border during play; prior owned values saved for exit |
| Player | `(160, 220)`, color `3`, horizontal range `48..296`, one pixel per frame |
| Invaders | alive at `(72,72)`, `(112,72)`, `(152,72)`, `(192,72)`, `(232,72)`, `(272,72)`; alternating art A/B; color `5`; initial direction right |
| Formation | one horizontal pixel every eighth update; reverse and descend eight pixels instead when the next live outer edge would leave `48..320`; toggle both designs' animation frame on each move/descent |
| Projectile | one maximum, color `1`; spawn at `(player.x, 199)` on a fire rising edge while idle; move four pixels upward per update; hide when its logical top passes `50` |
| Projectile hitbox | two pixels wide at `x + 11..x + 12`, eight pixels high at `y..y + 7` |
| Invader hitbox | the live sprite rectangle `x..x + 23`, `y..y + 20`; the lowest array index wins an otherwise simultaneous hit |
| Explosion | the projectile-hit update removes the winning invader, consumes the projectile, and publishes explosion frame 1 at the hit position in color `8` with count 1; the next update publishes frame 2 with count 2; the following update makes sprite 7 idle before fire-edge spawning and terminal exit handling |
| Win | all six `alive` fields are false; freeze player/formation, set border color `5`, and finish any just-started two-frame explosion |
| Loss | any live invader's bottom reaches player `y = 220`; freeze play and set border color `2` |
| Exit | after sprite 7 is idle and a terminal frame has been published, observe fire released and then a new press; restore owned state and return to BASIC |

Each PAL update performs these steps in order: wait for the qualified frame boundary; sample
joystick port 2 exactly once; process terminal explosion/exit state or, while playing, clamp player
left/right motion; advance an existing projectile or explosion; advance the formation when its
eighth-frame counter is due; resolve at most one projectile hit in ascending enemy index order;
spawn a new projectile from a rising fire edge only if sprite 7 is now idle; determine win/loss;
select animation records; and publish each required sprite register plus the result border once.
Opposing left/right inputs produce no motion. Up and down are ignored. Holding fire never repeats.
Resolving a projectile hit is itself the first explosion update; there is no unrendered or
zero-count explosion state between collision and frame 1.

Before compiler implementation, the specification tier freezes one complete predetermined input
trace and its per-frame entity/VIC expectations from this table using an independent reference
model. The VICE driver replays those inputs without observing or adapting to compiler state. Its
boundary journey destroys all six invaders, publishes the win state, releases and presses fire,
then observes restoration and BASIC return. A smaller independent pure case proves the loss path.
The driver also observes active screen pointer bytes, resident sprite bytes, and deterministic
rendered-frame signatures. It never overwrites expected results to make the test pass.

### SFA closure record — complexity L

The M1 report and test fixture enumerate:

| Class | Required evidence |
|---|---|
| Parameters/returns | type, width, caller staging, incoming/return home or register, live range |
| Locals/temporaries | source owner, definition/use, lexical and CFG lifetime, alias/address state |
| Calls | direct edge, left-to-right argument order, values live across each call, stack return bytes |
| Pointer pairs | exact dynamic-memory operation, two-byte ZP/RAM placement and interrupt contract |
| Spills/helpers | creation reason, clobbers, scratch, nested-call safety and returned SFA demand |
| Closure | deterministic final homes, interference, resource totals and no-new-storage assertion |

Because M1 installs no application IRQ/NMI handler, its own SFA execution domain is mainline. The
profile still accounts for the cooperative KERNAL interrupt path in machine-state, hardware-stack,
CIA, and timing evidence; absence of an M1 handler does not mean interrupts are absent.

### Asset and layout record — complexity L

The layout proof records the SpritePad source identity, each selected record and sharing relation,
the emitted interval, alignment and padding, VIC bank and bank-relative blocks, active screen-matrix
interval and pointer slots, CPU/VIC visibility, PRG segment ownership, and every simultaneously
resident code/data/global/SFA range. Useful payload bytes and reserved address-space bytes remain
separate. Each selected record occurs once in the PRG body and once in its final loaded RAM location
because those are the same bytes loaded to their final address—not two runtime copies.

### Artifact publication — complexity L

The complete M1 generation contains exactly `<name>.prg`, `.asm`, `.labels`, `.memory.json`,
`.assets.json`, `.costs.json`, `.debug.json`, and `.build.json`; no other ACME or compiler output is
published. Before tool invocation or publication, the selected-profile artifact plan validates
every final component separately. Pure checks reject duplicate names and known host aliases;
creation inside the unique staging directory decides actual native component/path limits and
ordinary-file ownership without guessing a universal maximum filename length. The project basename uses
RD-02's shared Linux/Windows lexical safety floor and is preserved literally; source and asset
filenames remain outside that rule. The producer assigns the lowercase canonical UUID v4 returned
by Node `crypto.randomUUID()` as one unique opaque `generationId`, stages one complete immutable generation
under that name, and atomically replaces one small current-generation record only after compiler,
ACME, byte, layout, and packaging validation succeeds. An existing target generation fails
publication rather than being overwritten or reused. Every compiler-owned file is created
exclusively and must remain the expected ordinary regular file; symlinks, devices, directories,
truncation, overwrite, merging, and stat-then-write authorization inside the immutable generation
are forbidden. The deliberately replaced publication component is only fixed
`<outDir>/current.json`; the generation directory name is the canonical UUID v4 already specified,
so neither is derived from project data. The current record
contains the `generationId` and the SHA-256 of the generation's `.build.json`. Readers resolve the
record once and retain the selected generation for their whole operation, so concurrent builds
cannot expose mixed siblings. `.build.json` records the canonical Specification 4, compiler,
project snapshot, target, options, overrides, SpritePad input, and portable ACME semantic
identities. It hashes every other published artifact, excludes its own bytes, and records the
`generationId` and host executable provenance separately from reproducibility comparison.

A short per-project lock coordinates only staging-directory commit, current-record replacement,
run pin acquisition/release, and cleanup; compilation and ACME execution do not hold it. `run` pins
the exact generation returned by its own build rather than resolving a possibly newer current
record. Failed work removes only its unique staging directory. Cleanup retains the current
generation, every actively pinned generation, and the newest unpinned predecessor, and removes only
older unpinned generations while holding the same lock. This is one direct output routine, not a
general transaction, cache, or readiness service. Linux and Windows must prove competing builds,
reader pinning, failed staging, atomic current replacement, active-run retention, stale-pin recovery,
and deterministic bounded cleanup.

The first public sidecars use these direct schemas; they are not a registry or database:

| Sidecar | Required schema identity and payload |
|---|---|
| `.build.json` | `kind: "blend65.build"`; exact root and records are frozen under **Build JSON version 1** below. |
| `.assets.json` | `kind: "blend65.assets"`; exact root and records are frozen under **Assets JSON version 1** below. |
| `.memory.json` | `kind: "blend65.memory"`; exact root and records are frozen under **Memory JSON version 1** below. |
| `.costs.json` | `kind: "blend65.costs"`; exact root and records are frozen under **Costs JSON version 1** below. |
| `.debug.json` | `kind: "blend65.debug"`; the complete version-1 root, record unions, references, ordering, and validation contract is frozen below before any RD-03 specification test or producer implementation. |

The current-generation record is `<outDir>/current.json`: canonical UTF-8 JSON without BOM, with
one LF terminator and lexicographically ordered keys. It contains exactly integer
`schemaVersion: 1`, canonical lowercase UUID-v4 `generationId`, and lowercase 64-hexadecimal
`buildJsonSha256`. Missing, duplicate, unknown, or malformed fields invalidate the record.

Every sidecar also requires the JSON integer `schemaVersion: 1`. Counts,
addresses, sizes, shape elements, and cycle bounds are nonnegative JSON integers; identities, names,
kinds, paths, hashes, and symbolic cycle expressions are JSON strings; records are JSON objects;
collections are canonically ordered JSON arrays. Hashes are 64 lowercase hexadecimal characters.
String identities and paths are nonempty. Arrays contain no duplicate records under their declared
identity. JSON `null` is never admitted.
Source and asset paths preserve their exact host-exposed project-relative spelling with `/` used
only as the evidence separator representation; separate resolved identities own containment and
alias checks. Memory intervals are half-open
`{ start, end, size }` objects where `start` is `0..65535`, `end` is `1..65536`, and
`size = end - start`. All fields listed above are required. The only unavailable representation is
the tagged `{ kind: "unknown" }` cycle value or a field that explicitly admits the exact string
`Unknown`; zero, omission, and `null` never mean unavailable.

Canonical sidecar bytes are UTF-8 without BOM, use LF, end in one newline, sort object keys and
unordered arrays by unsigned UTF-8 byte order of their declared stable identity, and use decimal
integer spelling without exponent or insignificant fractional syntax. A schema-version-1 producer
emits only declared fields. Consumer validation has this fixed precedence:

1. invalid JSON, a duplicate key, a non-object root, a wrong or missing `kind`, or a missing,
   noninteger, or nonpositive `schemaVersion` reports E10267 as a malformed envelope;
2. a correct `kind` with a positive integer `schemaVersion` other than `1` reports E10268 without
   inspecting that version's payload;
3. a version-1 missing, unknown, mistyped, out-of-range, misordered, dangling, or internally
   inconsistent field reports E10267 and names the sidecar, JSON pointer, and failed invariant; and
4. only a complete valid version-1 value proceeds to digest and cross-artifact validation.

RD-01 adds both unique codes and message contracts to the Specification 4 diagnostic registry
before any producer specification test. A consumer never guesses, silently upgrades, or rewrites
evidence. Because version 1 rejects unknown fields and union tags, every future field, record, or
admitted union value changes that sidecar's integer schema version. Each sidecar evolves
independently; no registry, service, database, generator, or shared runtime schema framework is
introduced.

The following value shapes are repeated contracts, not a shared decoder dependency:

- `DigestRecord` is exactly `{ path: string, bytes: integer, sha256: string }`. Its path is
  project-relative for an input and generation-relative for an artifact.
- `IdentityRecord` is exactly `{ name: string, version: string, sha256: string }`.
- `SourceSiteRecord` is exactly
  `{ path: string, startByte: integer, endByte: integer }`; locally it satisfies
  `0 <= startByte <= endByte`. Complete-generation validation resolves the path through the build
  source inventory and proves that `endByte` fits the named source bytes.
- `MeasuredValue` is exactly one of `{ kind: "exact", value: integer }`,
  `{ kind: "range", minimum: integer, maximum: integer }`,
  `{ kind: "symbolic", expression: string, variables: DomainVariable[] }`, or
  `{ kind: "unknown" }`. A range satisfies `minimum <= maximum`.
  `DomainVariable` is exactly `{ name: string, minimum: integer, maximum: integer }`, has a unique
  name, and satisfies `minimum <= maximum`.

These repeated shapes do not couple sidecar versions. Each version-1 decoder validates its own
root and every nested value directly.

Unless a schema below states a semantic order, record arrays sort by the named record ID, then by
their remaining canonical fields; scalar identity arrays sort by unsigned UTF-8 byte order.
Semantic order is retained for asset-search precedence, array shape dimensions, machine paths,
routes, disk directory and sector-chain order, and portable command options. Source-site arrays
sort by path, start byte, and end byte unless a field explicitly preserves execution order. Free
intervals and physical copies sort by address space, bank, start, and end. These rules cover empty
and singleton arrays as well as larger collections.

#### Build JSON version 1 — publication and reproducibility contract

The root contains exactly:

| Field | Exact JSON contract |
|---|---|
| `kind`, `schemaVersion` | Literal `"blend65.build"` and integer `1` |
| `generationId` | Canonical lowercase UUID v4 used only for publication ownership |
| `semanticInputs` | `SemanticInputsRecord` |
| `portableTools` | `PortableToolRecord[]` |
| `hostProvenance` | `HostProvenanceRecord` |
| `package` | `PackageRecord` |
| `artifacts` | `ArtifactDigestRecord[]`; every published file except `.build.json`, exactly once |

`SemanticInputsRecord` is exactly
`{ projectName: string, sourceRoot: string, entryModule: string, assetSearchPaths: string[], manifest: DigestRecord, sources: DigestRecord[], assets: DigestRecord[], compiler: IdentityRecord, specification: IdentityRecord, expertSkill: IdentityRecord, target: TargetSelectionRecord, options: BuildOptionsRecord, overrides: OverrideRecord[] }`.
`assetSearchPaths` preserves manifest precedence order; source and asset digest arrays sort by path
and then hash.
`TargetSelectionRecord` is exactly
`{ profileId: string, cpuId: string, emitterId: string, packagerId: string }`.
`BuildOptionsRecord` is exactly
`{ optimization: OptimizationMode, boundsCheck: boolean, divisionZeroCheck: boolean }`, where
`OptimizationMode` is `"none"`, `"balanced"`, `"speed"`, or `"size"`.
`OverrideRecord` is exactly one of
`{ name: "target", value: string }`, `{ name: "entry", value: string }`,
`{ name: "optimization", value: OptimizationMode }`,
`{ name: "boundsCheck", value: boolean }`, or
`{ name: "divisionZeroCheck", value: boolean }`. It records only CLI values that differ from the
manifest, with at most one record per name.
Overrides occur in `target`, `entry`, `optimization`, `boundsCheck`, `divisionZeroCheck` order after
omitting names whose effective value equals the manifest.

`PortableToolRecord` is exactly
`{ name: string, version: string, semanticOptions: string[] }`. It contains only output-affecting
portable identity and preserves semantic option order; `portableTools` sorts by name/version.
`HostProvenanceRecord` is exactly
`{ platform: HostPlatform, architecture: "x64", nodeVersion: string, tools: HostToolRecord[], durationMilliseconds: ObservedInteger, peakRssBytes: ObservedInteger }`, where `HostPlatform` is
`"linux"` or `"win32"`, `ObservedInteger` is a nonnegative integer or literal `"Unknown"`, and
`HostToolRecord` is exactly `{ name: string, canonicalPath: string, sha256: string }`; tools sort by
name then canonical path. Hostname,
username, environment dumps, timestamps, and unrelated process data are forbidden.

`ArtifactDigestRecord` is exactly
`{ path: string, kind: ArtifactKind, bytes: integer, sha256: string }`, where `ArtifactKind` is
`"primary"`, `"assembly"`, `"labels"`, `"assets"`, `"memory"`, `"costs"`, or `"debug"`.
Paths are unique, generation-relative, contained, and ordered by path; `.build.json` is forbidden.
Reproducibility compares `semanticInputs`, `portableTools`, and the complete `artifacts` array.
A consumer may derive an ephemeral hash of that canonical array for comparison, but version 1 does
not persist a redundant aggregate identity.

`PackageRecord` is exactly one of:

- `{ kind: "prg", artifactPath: string, loadAddress: integer, endAddress: integer }`, where the
  half-open loaded range is within the selected CPU address space and `artifactPath` resolves to
  the primary PRG digest; or
- `{ kind: "d64", artifactPath: string, imageBytes: 174848, dosType: "2A", diskLabelPetsciiHex: string, diskIdPetsciiHex: string, bamSha256: string, directorySha256: string, allocationPolicyId: string, freeBlocks: integer, bootComponentId: string, components: DiskComponentRecord[] }`, where
  `artifactPath` resolves to the primary D64 digest.

`DiskComponentRecord` is exactly
`{ id: string, logicalSha256: string, source: ComponentSourceRecord, outputSha256: string, directoryNamePetsciiHex: string, fileType: "PRG", loadAddress: integer, startTrack: integer, startSector: integer, endTrack: integer, endSector: integer, blocks: integer, bytes: integer, destinationCalls: SourceSiteRecord[], aliases: string[] }`.
`ComponentSourceRecord` is exactly
`{ kind: "input", path: string, sha256: string }` or
`{ kind: "generated", identity: string, sha256: string }`. Component IDs, directory names, and
sector chains are unique and occur in on-disk directory order; `bootComponentId` resolves exactly
once. Hex strings contain lowercase pairs, destination calls are in source order, and aliases are
sorted and unique.

#### Assets JSON version 1 — selected-data and placement contract

The root contains exactly `{ kind: "blend65.assets", schemaVersion: 1, assets: AssetRecord[] }`.
Each `AssetRecord` contains exactly
`{ id: string, inputs: AssetInputRecord[], handler: string, handlerVersion: string, selector: string, logicalType: string, shape: integer[], outputSha256: string, payloadBytes: integer, emittedBytes: integer, aliases: string[], constraints: AssetConstraintRecord[], placement: AssetPlacementRecord }`.

`AssetInputRecord` is exactly `{ path: string, bytes: integer, sha256: string }`. `id` is the
lowercase SHA-256 of the canonical JSON encoding of
`{ handler, handlerVersion, selector, logicalType, shape, outputSha256 }`; it therefore identifies
one canonical selected value without depending on discovery order. Inputs are ordered by path/hash;
aliases are qualified Blend65 symbols sorted and unique. `shape` contains the fully resolved fixed
extents; `payloadBytes` is the selected value's byte width and matches the bytes hashed by
`outputSha256`. `emittedBytes` is the total selected payload bytes emitted across physical copies,
excluding alignment padding. Raw inclusion uses handler `"raw"`, version `"1"`, selector `"raw"`,
and logical type `"const byte[]"` with one concrete extent.
The root `assets` array sorts by asset ID. `inputs` sorts by path/hash; aliases sort by qualified
symbol. Shape dimensions remain in declared type order.

`AssetConstraintRecord` is exactly one of the following. Every form includes
`origin: "source" | "handler" | "profile"`:

- `{ kind: "at", origin, addressSpaceId: string, start: integer }` plus optional `bankId`;
- `{ kind: "align", origin, bytes: integer }`, where bytes is a nonzero power of two;
- `{ kind: "noCross", origin, boundaryBytes: integer }`, where the boundary is nonzero;
- `{ kind: "region", origin, regionId: string }`;
- `{ kind: "visibility", origin, consumer: "cpu" | "vic" | "player" | "loader", conditionId: string }`;
- `{ kind: "writable", origin, startOffset: integer, endOffset: integer }`; or
- `{ kind: "contiguous", origin }`.

Constraint arrays sort by kind, origin, and their remaining canonical fields. Writable ranges are
half-open, non-overlapping, and fit `payloadBytes`.

`PlacedRangeRecord` is exactly
`{ addressSpaceId: string, start: integer, end: integer, alignmentBytes: integer, paddingBeforeBytes: integer, residencyId: string, visibility: string[], writableRanges: ByteRangeRecord[] }` plus optional `bankId`.
`ByteRangeRecord` is exactly `{ start: integer, end: integer }`; it is half-open and relative to the
selected payload. A placed range is half-open, has size `payloadBytes`, satisfies its constraints,
and names sorted unique visibility identities. `AssetPlacementRecord` is exactly one of:

- `{ kind: "single", range: PlacedRangeRecord }`;
- `{ kind: "replicated", copies: PlacedRangeRecord[], consumer: string, hardwareConstraint: string, extraBytes: integer, cycleBenefit: MeasuredValue }`, with at least two copies and
  `extraBytes = emittedBytes - payloadBytes`; or
- `{ kind: "loadable", loadUnitId: string, artifactPath: string, destinations: PlacedRangeRecord[] }`,
  where every possible successful destination is named, `artifactPath` resolves to the D64 primary
  artifact, `loadUnitId` resolves to exactly one package component, and disk-only bytes are not
  called resident. `destinations` is the static finite candidate set; it never claims which range a
  runtime call selected and contains no validity token or execution trace.

For `single`, `emittedBytes = payloadBytes`; for `replicated`, `emittedBytes` is the sum of copy
sizes; for `loadable`, it is the contained component payload size rather than the sum of mutually
exclusive destinations. An empty placement or a compiler-convenience copy is invalid.

#### Memory JSON version 1 — reconciled physical ledger contract

The root contains exactly
`{ kind: "blend65.memory", schemaVersion: 1, profileId: string, sfaClosureSha256: string, acmeReconciled: true, runtimeMemorySafety: RuntimeMemorySafety, residencies: ResidencyRecord[], unboundedEffects: UnboundedEffectRecord[], intervals: MemoryIntervalRecord[], views: MemoryViewRecord[], stackDomains: StackDomainRecord[] }`.
Only an ACME-reconciled successful generation can contain this file, so `acmeReconciled` is the
literal `true`. `RuntimeMemorySafety` is `"proved"` or `"unproven"`; it is `"unproven"` exactly when
`unboundedEffects` is nonempty.

`ResidencyRecord` is exactly `{ kind: "always", id: string }` or
`{ kind: "exclusive", id: string, group: string }`. Every interval names one or more residency IDs.
A view includes every `always` residency and at most one member of each exclusive group.

`MemoryIntervalRecord` contains exactly
`{ id: string, addressSpaceId: string, start: integer, end: integer, size: integer, owner: MemoryOwnerRecord, kind: MemoryKind, origin: MemoryOriginRecord, mutability: MutabilityKind, alignmentBytes: integer, contiguity: ContiguityRecord, residencyIds: string[], cpuMappings: string[], resourceClass: ResourceClass, payloadBytes: integer, paddingBytes: integer, reservedBytes: integer }` plus optional `bankId`, `noCrossBytes`, `vic`, and `loadUnitId`.
The interval is half-open; `size = end - start = payloadBytes + paddingBytes + reservedBytes`.
`alignmentBytes` is a nonzero power of two. `noCrossBytes`, when present, is nonzero and the range
does not cross that boundary. Residency and mapping arrays are sorted and unique.

The closed memory types are:

- `MemoryOwnerRecord`: `{ kind: MemoryOwnerKind, id: string }`, where `MemoryOwnerKind` is
  `"function"`, `"helper"`, `"symbol"`, `"asset"`, `"compiler"`, `"platform"`, or `"loadUnit"`;
- `MemoryKind`: `"code"`, `"initializedData"`, `"bss"`, `"global"`, `"sfa"`, `"zeroPage"`,
  `"hardwareStack"`, `"asset"`, `"helper"`, `"loader"`, `"scratch"`, `"padding"`,
  `"reservation"`, `"vector"`, `"deviceShadow"`, `"replica"`, `"existingRom"`, or
  `"loadDestination"`;
- `MemoryOriginRecord`: `{ kind: "source", site: SourceSiteRecord }`,
  `{ kind: "asset", assetId: string }`, `{ kind: "import", path: string, sha256: string }`, or
  `{ kind: "generated", identity: string }`;
- `MutabilityKind`: `"immutable"`, `"mutable"`, or `"reserved"`;
- `ResourceClass`: `"general"`, `"zeroPage"`, `"hardwareStack"`, or `"device"`;
- `ContiguityRecord`: `{ kind: "single" }` or
  `{ kind: "group", id: string, index: integer, count: integer }`; group members cover every index
  once and are adjacent in index order; and
- `vic`: exactly `{ bankId: string, visibility: string[] }` with sorted unique conditions.

Interval IDs are unique. Canonical interval order is address space, bank, start, end, kind, owner,
then ID. Overlap is valid only when no `MemoryViewRecord` activates both intervals; every other
overlap is E10267. Disk-container bytes never appear as RAM intervals.

`UnboundedEffectRecord` is exactly one of
`{ kind: "dynamicRead", site: SourceSiteRecord, addressSpaceId: string, accessBytes: integer | "Unknown" }`,
`{ kind: "dynamicWrite", site: SourceSiteRecord, addressSpaceId: string, accessBytes: integer | "Unknown" }`,
`{ kind: "machineState", site: SourceSiteRecord, effectClass: string }`, or
`{ kind: "importedCode", site: SourceSiteRecord, effectClass: string }`.
Records are ordered by source site and kind. They limit the static safety claim but never inject a
runtime guard or reject otherwise legal low-level source.

`MemoryViewRecord` is exactly
`{ id: string, consumer: "cpu" | "vic", addressSpaceId: string, start: integer, end: integer, activeResidencyIds: string[], visibility: string[], capacityBytes: integer, occupiedBytes: integer, payloadBytes: integer, paddingBytes: integer, reservedBytes: integer, zeroPageBytes: integer, freeBytes: integer, freeIntervals: FreeIntervalRecord[], largestFreeBytes: integer }` plus optional `bankId`.
`FreeIntervalRecord` is exactly `{ start: integer, end: integer, size: integer }` and obeys the
common half-open interval rule. Within each view, active occupied intervals and free intervals
partition `[start, end)` without overlap; `capacityBytes = end - start`,
`occupiedBytes + freeBytes = capacityBytes`,
`payloadBytes + paddingBytes + reservedBytes = occupiedBytes`, and `largestFreeBytes` equals the
largest free interval or zero when none exists. Active residency and visibility arrays are sorted
and unique.

`StackDomainRecord` is exactly
`{ id: string, route: string[], capacityBytes: integer, peakBytes: integer, headroomBytes: integer }`.
Routes name the bounded call/interrupt path in entry order;
`peakBytes + headroomBytes = capacityBytes`. An unbounded stack route or a route exceeding capacity
fails before publication. `sfaClosureSha256` is SHA-256 of the canonical JSON encoding, without
trailing LF, of the ordered projection
`{ id, addressSpaceId, bankId?, start, end, owner, kind, resourceClass, residencyIds }[]` for every
final interval whose `kind` is `"sfa"`, `"zeroPage"`, or `"scratch"` and whose owner kind is
`"function"` or `"helper"`.

#### Costs JSON version 1 — final resources and optimizer decisions

The root contains exactly
`{ kind: "blend65.costs", schemaVersion: 1, mode: OptimizationMode, totals: CostVectorRecord, entries: CostEntryRecord[], decisions: OptimizationDecisionRecord[] }`.

`CostEntryRecord` is exactly one of:

- `{ kind: "bytes", id: string, owner: CostOwnerRecord, component: ByteCostComponent, accounting: ByteAccounting, bytes: integer, sourceSites: SourceSiteRecord[], dependencyIds: string[] }`;
- `{ kind: "blocks", id: string, owner: CostOwnerRecord, component: "diskFile" | "diskMetadata" | "sectorOverhead", blocks: integer, sourceSites: SourceSiteRecord[], dependencyIds: string[] }`; or
- `{ kind: "cycles", id: string, owner: CostOwnerRecord, pathId: string, cycles: MeasuredValue, traffic: TrafficRecord[], sourceSites: SourceSiteRecord[], dependencyIds: string[] }`.

`CostOwnerRecord` is `{ kind: CostOwnerKind, id: string }`, where `CostOwnerKind` is
`"function"`, `"symbol"`, `"asset"`, `"compiler"`, `"platform"`, `"loadUnit"`, or `"candidate"`.
`ByteCostComponent` is `"code"`, `"initializedData"`, `"bss"`, `"global"`, `"sfa"`,
`"zeroPage"`, `"hardwareStack"`, `"asset"`, `"helper"`, `"table"`, `"loader"`, `"scratch"`,
`"padding"`, `"reservation"`, `"diskFile"`, `"diskMetadata"`, `"sectorOverhead"`,
`"existingRom"`, `"callSite"`, `"startup"`, `"exit"`, `"branchRepair"`, `"replication"`, or
`"platform"`.
`ByteAccounting` is `"program"`, `"residentRam"`, `"zeroPage"`, `"sfa"`,
`"hardwareStack"`, `"scratch"`, `"diskFile"`, `"diskContainer"`, or `"existingRom"`.

The admitted accounting/component pairs are exact:

| Accounting | Admitted byte components |
|---|---|
| `program` | `code`, `initializedData`, `asset`, `helper`, `table`, `loader`, `padding`, `callSite`, `startup`, `exit`, `branchRepair`, `replication`, `platform` |
| `residentRam` | every `program` component plus `bss`, `global`, `sfa`, `zeroPage`, `hardwareStack`, `scratch`, and `reservation` |
| `zeroPage` | `sfa`, `zeroPage`, `scratch`, or `reservation` |
| `sfa` | `sfa` |
| `hardwareStack` | `hardwareStack` |
| `scratch` | `scratch` |
| `diskFile`, `diskContainer` | every component except `bss`, `sfa`, `zeroPage`, `hardwareStack`, `scratch`, `reservation`, and `existingRom` |
| `existingRom` | `existingRom` |

Every other pair is malformed version-1 evidence.

One physical object may have entries in multiple accounting dimensions—for example program bytes
that are also resident RAM—but has at most one entry for each accounting dimension. `program`
entries sum to optimizer `B`; D64 filesystem and container overhead use only `diskFile` or
`diskContainer`. `zeroPage`, `sfa`, `hardwareStack`, and `scratch` are classified views of physical
use and are not added to `residentRam` a second time. `existingRom` records already-present work and
contributes zero program bytes. Entry IDs are unique. Byte entries sort by kind, accounting,
component, owner kind, owner ID, then ID; block entries by kind, component, owner kind, owner ID,
then ID; and cycle entries by kind, path ID, owner kind, owner ID, then ID. Dependencies are sorted
unique entry IDs. Final
totals come from reconciled liveness/residency and path composition rather than blindly summing
entries whose lifetimes are mutually exclusive.

`TrafficRecord` is exactly
`{ kind: "read" | "write" | "rmw" | "bankSwitch" | "loaderTransfer", target: string, count: MeasuredValue }`.
Cycle paths are derived from stable semantic/profile path classes, not optimized block names, and
are ordered by `pathId`. Traffic is ordered by kind/target. An unavailable cycle or traffic count
uses `{ kind: "unknown" }`, never zero.

`CostVectorRecord` is exactly
`{ programBytes: integer, pathCycles: PathCycleRecord[], resources: ResourceCostRecord[] }`.
`PathCycleRecord` is exactly `{ pathId: string, cycles: MeasuredValue }`.
`ResourceCostRecord` is exactly
`{ kind: "standard", id: StandardResourceId, value: integer }` or
`{ kind: "profile", id: string, value: integer }`, where `StandardResourceId` is `"zeroPage"`,
`"residentRam"`, `"hardwareStack"`, or `"scratch"`. Standard resources occur exactly once in that
order, followed by unique profile resources in profile-declared order. This is the exact optimizer
`B`, `T`, and `R` vector: `programBytes` is `B`, path cycles sorted worst-to-best are `T`, and the
resource array is `R`. The root `totals` equals the selected final program.
Its `programBytes` equals the reconciled sum of `program` byte entries; standard resources equal
the corresponding final memory/stack ledger values; and each path cycle equals the composed cycle
entries for that path. Profile resources define their entry mapping in the selected profile.

`OptimizationDecisionRecord` contains exactly
`{ id: string, scope: string, mode: "balanced" | "speed" | "size", sourceSites: SourceSiteRecord[], closurePoint: ClosurePoint, baselineCandidateId: string, selectedCandidateId: string, candidates: CandidateRecord[], incomparableComponents: CostComponentRef[], tieBreak: TieBreakRecord }`.
`ClosurePoint` is `"local"`, `"function"`, `"wholeProgram"`, `"postLayout"`, or
`"postPackaging"`. A `CandidateRecord` is exactly
`{ id: string, feasibility: { kind: "feasible", vector: CostVectorRecord } }` or
`{ id: string, feasibility: { kind: "rejected", reasons: HardRejectionRecord[] } }`.
`HardRejectionRecord` is exactly
`{ kind: "semantics" | "timing" | "memory" | "zeroPage" | "stack" | "sfa" | "scratch" | "layout" | "banking" | "loading" | "packaging" | "cpu" | "safety" | "unknownCost", detail: string, sourceSites: SourceSiteRecord[] }`.
`CostComponentRef` is exactly `"B"`, `"T:<pathId>"`, or `"R:<resourceId>"`.
`TieBreakRecord` is `{ kind: "none" }` or
`{ kind: "stableId", candidateIds: string[] }`.

Decision and candidate IDs are unique; decisions and candidates sort by ID; baseline and selected IDs resolve to
feasible candidates; a rejected candidate is never selected. Incomparable components and tie-break
IDs are sorted and unique. A stable-ID tie break is present only when every tied candidate has an
identical complete vector. `decisions` is empty for `mode: "none"`; other modes record every
consequential selection or retained baseline without becoming a pass log or tuning database.

For M1, the build sidecar publishes the PRG artifact set, the SpritePad source is represented by one
selected resident asset record, the memory sidecar contains the complete reconciled ledger, and the
cost sidecar uses `mode: "none"` with an empty `decisions` array. Later asset, packaging, and
optimization RDs populate the already-defined variants; they do not silently extend these schemas
or fabricate unavailable observations.

#### Debug JSON version 1 — first-producer contract

The root contains exactly these required fields. Optional fields exist only where the tagged record
rules below explicitly admit them.

| Field | Exact JSON contract |
|---|---|
| `kind` | Literal string `"blend65.debug"` |
| `schemaVersion` | Integer `1` |
| `compiler`, `specification`, `expertSkill` | `IdentityRecord` |
| `profileId`, `cpuId` | Non-empty strings naming the selected qualified identities |
| `optimization` | One of `"none"`, `"balanced"`, `"speed"`, or `"size"` |
| `safety` | `{ boundsCheck: boolean, divisionZeroCheck: boolean }` |
| `primaryArtifact` | `ArtifactRecord` for the PRG or later profile-owned primary artifact |
| `tools` | `ToolRecord[]` |
| `sources` | `SourceRecord[]` |
| `assets` | `AssetInputRecord[]` |
| `addressSpaces` | `AddressSpaceRecord[]` |
| `functions` | `FunctionRecord[]` |
| `contexts` | `ContextRecord[]` |
| `symbols` | `SymbolRecord[]` |
| `locations` | `LocationRecord[]` |
| `ranges` | `RangeRecord[]` |
| `optimizations` | `OptimizationRecord[]`; empty for M1 `optimization: none` |
| `loadUnits` | `LoadUnitRecord[]`; empty when the selected artifact has no separately published load unit |

The direct value records are:

| Record | Exact required fields and admitted values |
|---|---|
| `IdentityRecord` | `{ name: string, version: string, sha256: string }`; `sha256` is the portable content identity of that compiler, specification, or skill release. |
| `ToolRecord` | `{ name: string, version: string, semanticOptions: string[] }`; contains only portable output-affecting tool identity and options, never host paths or executable hashes. |
| `ArtifactRecord` | `{ path: string, kind: string, sha256: string }`; `path` is generation-relative and contained. |
| `SpanRecord` | `{ sourceIndex: integer, startByte: integer, endByte: integer }`; indexes `sources`, uses a half-open UTF-8 byte interval, and satisfies `0 <= startByte <= endByte <= sources[sourceIndex].byteLength`. |
| `MachineRangeRecord` | `{ addressSpaceIndex: integer, start: integer, end: integer }` plus optional `bankIndex` and `loadUnitIndex`; indexes the named arrays, uses a half-open byte interval, and must fit the selected address space and bank. `bankIndex` is required exactly when that address space has banks. `loadUnitIndex` is present exactly when the bytes belong to a separately published load unit. |
| `SourceOrigin` | `{ kind: "source", span: SpanRecord }` |
| `GeneratedOrigin` | `{ kind: "generated", cause: GeneratedCause }` plus optional `sourceSpan`; `sourceSpan` is present only when a source operation caused the generated bytes. |

`GeneratedCause` is exactly `"startup"`, `"helper"`, `"loader"`, `"branchRepair"`,
`"safetyStop"`, `"platform"`, or `"asset"`. `SourceOrigin | GeneratedOrigin` is the only origin
union.

The indexed record arrays use these exact shapes:

| Record | Exact required fields and admitted values |
|---|---|
| `SourceRecord` | `{ path: string, byteLength: integer, sha256: string }` plus optional `lineStarts: integer[]`. `path` is the exact host-exposed project-relative spelling represented with `/`; `lineStarts`, when present, starts with `0`, is strictly increasing, and contains UTF-8 byte offsets no greater than `byteLength`. |
| `AssetInputRecord` | `{ path: string, sha256: string, handler: string, handlerVersion: string, selector: string }`; raw assets use handler `"raw"`, handler version `"1"`, and selector `"raw"`. |
| `AddressSpaceRecord` | `{ id: string, kind: AddressSpaceKind, sizeBytes: integer, banks: BankRecord[] }`; `AddressSpaceKind` is exactly `"cpu"`, `"banked"`, `"overlay"`, or `"transfer"`. |
| `BankRecord` | `{ id: string, visibility: string[] }`; each visibility entry is a selected-profile symbolic condition, not a host address or free-form executable expression. Unbanked spaces use an empty `banks` array. |
| `FunctionRecord` | `{ qualifiedName: string, kind: FunctionKind, declaration: SpanRecord, entryVariants: EntryVariantRecord[], rangeIndexes: integer[] }`; `FunctionKind` is `"ordinary"` or `"interrupt"`. |
| `EntryVariantRecord` | `{ id: string, kind: string, label: string, rangeIndexes: integer[] }`; `kind` is a selected-profile variant identity. |
| `ContextRecord` | `{ kind: ContextKind, functionIndex: integer }` plus tag-dependent fields. `ContextKind` is `"entry"`, `"call"`, or `"inlined"`. An entry requires integer `entryVariantIndex` into that function's `entryVariants` and forbids `parentContextIndex`/`callSite`; call and inlined contexts require integer `parentContextIndex` plus `callSite: SpanRecord` and forbid `entryVariantIndex`. |
| `SymbolRecord` | `{ name: string, qualifiedName: string, kind: SymbolKind, type: string, shape: ShapeExtent[], scope: string, origin: SourceOrigin | GeneratedOrigin, linkage: LinkageKind, labels: string[], locationIndexes: integer[] }`. `type` is the canonical Specification 4 type spelling; scalar symbols use an empty `shape`. |
| `LocationRecord` | `{ symbolIndex: integer, liveRangeIndexes: integer[], availability: AvailabilityRecord }` plus optional integer `contextIndex`. `contextIndex` is required for parameters, returns, locals, and temporaries; forbidden for functions, globals, constants, and assets; and present for helper scratch exactly when the scratch belongs to a recorded function context. Every referenced live range belongs to that context when present. `liveRangeIndexes` names the final machine ranges over which the availability applies; it is empty only for a context-free object whose location applies for its complete resident lifetime. |
| `RangeRecord` | `{ machine: MachineRangeRecord, origin: SourceOrigin | GeneratedOrigin, owner: RangeOwner, optimizationIndexes: integer[] }` plus optional `contextIndex`, present exactly for bytes attached to a recorded `FunctionRecord`; generated startup, loader, and platform-helper bytes use a platform owner and omit it. |
| `OptimizationRecord` | `{ stage: string, rule: string, result: OptimizationResult, sourceSpans: SpanRecord[], outputRangeIndexes: integer[] }`; eliminated results have no output ranges. |
| `LoadUnitRecord` | `{ name: string, kind: LoadUnitKind, publication: PublicationKind, artifact: ArtifactRecord, residence: MachineRangeRecord[] }`; residence is empty when no final resident interval exists. It lists static possible resident ranges and never claims which runtime range a call selected. |

The remaining closed types are:

- `SymbolKind`: `"function"`, `"parameter"`, `"return"`, `"local"`, `"temporary"`,
  `"global"`, `"constant"`, `"asset"`, or `"helperScratch"`.
- `ShapeExtent`: a nonnegative integer or literal string `"unsized"`; only the outermost borrowed
  parameter extent may be `"unsized"`.
- `LinkageKind`: `"internal"`, `"exported"`, or `"platform"`.
- `OptimizationResult`: `"retained"`, `"inlined"`, `"eliminated"`, `"rematerialized"`, or
  `"split"`.
- `LoadUnitKind`: `"resident"` or `"loadable"`; `PublicationKind`: `"primary"` or `"contained"`.
- `RangeOwner`: `{ kind: "function", functionIndex: integer }`,
  `{ kind: "symbol", symbolIndex: integer }`, or `{ kind: "platform", name: string }`.

`AvailabilityRecord` is exactly one of:

| Tag | Exact record |
|---|---|
| `available` | `{ kind: "available", pieces: StoragePiece[] }`; one or more pieces |
| `split` | `{ kind: "split", pieces: StoragePiece[] }`; two or more pieces |
| `constant` | `{ kind: "constant", bytesHex: string }`; lowercase even-length target-representation bytes |
| `rematerializable` | `{ kind: "rematerializable", rule: string, operandSymbolIndexes: integer[] }` |
| `optimizedAway` | `{ kind: "optimizedAway", rule: string }` |
| `unavailable` | `{ kind: "unavailable", reason: UnavailableReason }` |

`UnavailableReason` is exactly `"notLive"`, `"notResident"`, `"notMaterialized"`, or
`"notRepresentable"`. `StoragePiece` is either
`{ kind: "memory", machine: MachineRangeRecord, valueOffset: integer, byteLength: integer }` or
`{ kind: "register", register: string, valueOffset: integer, byteLength: integer }`. Piece value
intervals are non-overlapping, cover the represented bytes exactly, and use only registers admitted
by `cpuId`. Constant bytes and the combined piece widths must equal the represented symbol's exact
type width.

Every integer is a nonnegative JSON safe integer unless a tighter bound is stated. Every index must
resolve inside its named array; every reverse index must agree; duplicate records and dangling or
cyclic context references are invalid. Optional keys are omitted rather than encoded as `null`.
Root arrays are canonical in this order: sources by path; assets by path/handler/selector; address
spaces by `id`; functions by qualified name/declaration; entry contexts before child contexts, then
by parent/call-site/function; symbols by qualified name/kind/origin; locations by symbol/context/
first live range; ranges by address-space/bank/load-unit/start/end/origin; optimizations by
stage/rule/source span; and load units by name. Referenced index arrays are ascending and unique;
machine pieces and ranges stay in increasing address order. Hashes are lowercase 64-hexadecimal
strings. `semanticOptions` preserves invocation argument order; visibility, label, and operand arrays
are sorted by their declared identity. Version-1 readers reject every missing, duplicate, unknown,
mistyped, out-of-range, or internally inconsistent field and every unsupported schema major.
Because version 1 rejects unknown fields and union tags, every future field, record, or admitted
union value changes the integer schema version; no producer silently extends version 1.

M1 populates the exact applicable header, tool, source, SpritePad asset, CPU address-space,
function, context, symbol, SFA location, final range, generated startup/helper, and primary-artifact
records for `c64-pal-prg-kernal-6581` under `optimization: none`. It emits empty arrays for admitted
but inapplicable optimization and load-unit families; it never fabricates loader, interrupt-variant,
optimized-away, future-machine, or unavailable-value records. This schema is semantic evidence, not
a serialization of TypeScript classes, AST nodes, IL nodes, or a debugger protocol.

The successful-build memory ledger is produced after optimization-none selection, final SFA
closure, target layout, ACME assembly, and reconciliation with ACME's actual symbols, bytes, and
segments. Every occupied or reserved interval records its physical identity, half-open range, exact
size, owner/kind, source or imported identity, mutability, alignment/contiguity, residency/lifetime,
CPU mapping requirements, VIC bank/visibility where applicable, and zero-page/stack class. For each
compatible residency and CPU/VIC view it reports total occupied and free bytes, every free interval,
largest contiguous hole, useful payload, padding, reservations, zero-page allocation, and proved
hardware-stack peak/headroom without double counting. A proved overlap, overflow, exhaustion,
visibility/banking/alignment failure, or ACME disagreement is a hard error before publication and
names the request, constraints, conflicting owners, and largest compatible holes.

Raw variable-address `PEEK`/`POKE`, `asm_*`, imported code, or a later runtime loader does not make
static placement approximate. A bounded effect is checked against this ledger. An unbounded effect
remains expressible but sets `runtimeMemorySafety` to `unproven` and lists its source sites and
effect classes; the compiler never converts that honest boundary into a whole-program memory-safety
claim or injects a hidden runtime check.

### Verification topology — complexity XL

| Tier | Runs when | Evidence |
|---|---|---|
| Directed frontend/stage | While changing its owner | Small positive, boundary, negative, poison, and transition cases |
| Package/feature | When an M1 package or cross-package seam changes | Complete affected M1 specification and implementation cases |
| ACME/artifact | When machine, emitter, layout, or packaging changes; at M1 closeout | One exact M1 assembly/report/symbol/byte/PRG proof plus small rejection probes |
| VICE | When runtime/platform/run behavior changes; once at M1 closeout | One sequential exact-profile program/input/display/return proof |
| Editor boundary | When frontend/LSP/extension changes; at M1 closeout | Shared diagnostics and forbidden frontend-to-backend dependency proof |
| Expert comparison | When generated M1 machine output changes; at M1 closeout | Equivalent hand-authored twin and complete resource ledger |
| Hardware | Not required for M1's documented routine behavior | Later targeted QA for timing/silicon-sensitive production claims |

A skip is visible as `Unknown`. Only the relevant tier reruns during correction; the complete M1
set runs once at the accepted milestone boundary.

---

## Integration Points

### With RD-01 (Specification 4 and Expert Authority)

RD-03 consumes the exact frozen Specification 4 file inventory/hashes, expert `2.0.0` release,
diagnostic registry, C64 profile, SpritePad contract, and knowledge-source identities. A mismatch
stops implementation or reopens the authority gate; compiler convenience cannot reinterpret them.

### With RD-02 (Foundation and Project Model)

RD-03 consumes the sibling worktree, salvage inventory, TypeScript 7/Yarn/Turbo/Vitest foundation,
typed project snapshot, diagnostic foundation, public compiler/CLI boundaries, and direct import
boundary test. Any v3 component used here must already have a qualifying RD-02 disposition and new
v4 proof.

### With RD-04 (Complete Correct Unoptimized Compiler)

RD-04 extends the same real representations and pipeline to all Specification 4 behavior. It does
not replace an M1 shortcut architecture, because M1 may contain no semantic or target shortcut.
Every deferred M1 language surface has an explicit RD-04 owner.

### With RD-08 (Optimization and Expert Output)

M1's `none` mode and independent behavior/expert twin become the correctness and measured cost
baseline; expert-cost parity is not an acceptance gate for `none`.
RD-08 may add optional transformations but cannot make `none` semantically incomplete or repair
facts that M1 erased too early.

### With RD-09 (Developer Tooling)

RD-09 extends the real shared frontend, LSP transport, VS Code client, and debug map created here.
The language server remains unable to import codegen, packaging, or emulator control.

### With blend65-c64u/RD-01

The early readiness review records concrete extension pressure and any corrected seam. It creates
no C64U target identity or support claim; the owned successor activates only after RD-10 handoff.

---

## Non-Functional Requirements

### Correctness and determinism — complexity XL

- Identical frozen inputs produce byte-identical diagnostics, assembly, deterministic sidecars, and
  PRG output regardless of checkout path, working directory, filesystem enumeration, Turbo
  scheduling, locale, or CPU concurrency. Invocation-specific `.build.json` may differ only in
  `generationId` and declared host provenance; its semantic-input, portable-tool, and artifact-hash
  projection must match exactly.
- Every stage failure is typed and attributed to its owner. Expected input/tool failures never
  become internal crashes, stale artifacts, or later-stage guesses.
- No compiler code path reads the game-feasibility matrix or v3 readiness status.

### Generated target quality — complexity XL

- Modern source remains ordinary and readable; platform APIs carry necessary hardware intent.
- `optimization: none` produces correct deterministic canonical machine code and complete cost
  evidence. Its measured expert delta seeds RD-08 but is not a parity acceptance gate or debt trigger.
- Routine runtime evidence is `VICE-verified / hardware-unverified`; M1 claims no cycle-exact or
  universal-silicon result.

### Host responsiveness — complexity S

- Measurements are observations, not pass/fail thresholds.
- The implementation investigates measured dominant work before adding persistent caches,
  incremental compilation, workers, a daemon, or a readiness system.

### Maintainability — complexity L

- Public APIs and non-trivial invariants are documented for junior maintainers.
- Every module has one clear behavior owner and no speculative generalization.
- Production files remain within project size guidance; generated tables/data are machine-produced
  and separately identified.

---

## Security Considerations

- Treat source, JSONC, SpritePad bytes, paths, ACME/VICE output, monitor frames, and subprocess
  failures as untrusted input. Validate lengths, enums, identities, containment, protocol frames,
  timeouts, and process output bounds.
- Invoke ACME and VICE with argument arrays and canonical executable paths. Project data cannot
  insert shell commands, options, includes, output paths, ACME source, or VICE monitor commands.
  ACME output ownership is expressed only through the driver's separate `--format`, `--outfile`,
  `--report`, and `--symbollist` arguments; generated source contains no `!to` directive.
- Bind VICE monitors to fresh loopback-only ports, authenticate ownership by exact child/session,
  bound all waits and retained responses, cancel cleanly, and never connect to an unrelated service.
- VS Code workspace analysis is allowed without trust, but this RD adds no editor-triggered process
  execution. Later build/run commands require workspace trust.
- Source and asset content remains local. No telemetry, upload, remote Turbo cache, credential, or
  network service is introduced.

---

## Scope Decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| First milestone | Skeleton / complete language first / playable vertical slice | Playable vertical slice | Proves the real architecture before expanding breadth. | AR-027 |
| M1 product | Single-sprite interaction / bounded Invaders-style microgame / faithful full recreation | Bounded original-art microgame | Exercises a coherent compiler slice while fitting eight sprites and excluding later platform/workload capabilities. | AR-037, AR-038 |
| Optimization | Default balanced / optional subset / `none` | `none` | Separates correctness and expert selection from optional transforms. | AR-023, AR-027 |
| Editor | None / diagnostics-only real slice / production tooling | Diagnostics-only real slice | Creates the shared frontend consumer without pulling RD-09 forward. | AR-021, AR-027 |
| Asset | Raw bytes / current qualified SpritePad / broad asset set | Current qualified SpritePad supplied before RD-03 planning | Forces authentic asset identity and placement into the first real architecture without making a Windows application a build dependency. | AR-007, AR-027, AR-037 |
| Device access | Game uses raw addresses / named zero-cost APIs / hidden engine | Named zero-cost APIs | Modern source with expert direct output. | AR-002, AR-007 |
| VICE input | Patch program variables / real emulated joyport / manual-only | Real emulated joyport | Tests the actual platform API and CIA path. | AR-027 |
| Runtime | General runtime / targeted helpers / no hidden runtime | No hidden runtime | Matches SFA and the constrained C64 contract. | AR-002 |
| Proof | Final demo only / every transition plus final boundary | Every transition plus final boundary | Prevents one working fixture from hiding invalid stages. | AR-003, AR-027 |

---

## Acceptance Criteria

1. [ ] **AC-01 — One authoritative M1 project:** One checked-in manifest/source/SpritePad project
   with original art, the exact eight-sprite product scope, exact profile, and `none` options
   supplies CLI, editor, build, twin, and runtime proof.
2. [ ] **AC-02 — Public check:** `blendc check` reports stable authoritative frontend/profile
   diagnostics, emits no compiler artifact, and reaches no target/backend process for frontend-only
   success or failure.
3. [ ] **AC-03 — Public build:** `blendc build` crosses every named pipeline stage, reconciles final
   ACME bytes/symbols/segments, and publishes one coherent immutable artifact/evidence generation
   through the atomic current record only on success.
4. [ ] **AC-04 — Public run:** `blendc run` rebuilds first, pins and launches only its exact
   successful generation, distinguishes build/tool/runtime/cancellation errors, never launches a
   stale prior artifact, and preserves a completed generation when cancellation occurs after commit.
5. [ ] **AC-05 — Minimum editor:** Opening the M1 project publishes the same lexer/parser/module/
   semantic diagnostics through the bundled VS Code client and language server; the server imports
   no target, codegen, packager, or emulator code.
6. [ ] **AC-06 — Lexer boundary:** Focused cases prove exact tokens/UTF-8 spans, maximal munch,
   literals/comments, and recovery for every admitted M1 lexical form without target facts.
7. [ ] **AC-07 — Parser boundary:** Focused cases prove precedence, postfix/call/index/field forms,
   standard three-clause `for`, recovery, and rejection of the removed range loop.
8. [ ] **AC-08 — Module boundary:** Multi-file fixtures prove merged modules, qualified imports,
   reachable-only analysis, declaration-only circular imports, collisions, missing exports,
   initializer cycles, and exact selected `main` independent of filenames.
9. [ ] **AC-09 — Semantic boundary:** Each R3.8 surface has at least one positive and one decisive
   invalid case with the exact Specification 4 type/effect/diagnostic result.
10. [ ] **AC-10 — Modern-expression traps:** Full-pipeline cases prove nested calls,
    `POKE(variableAddress, value)`, right-associative assignment values, exactly-once effectful
    places, short circuit, and array index promotion without source workarounds.
11. [ ] **AC-11 — Poison containment:** Injected independent source errors produce their root
    diagnostics without cascades, SFA/lowering/ACME access, crash, or runnable-looking output.
12. [ ] **AC-12 — Representation payload:** Transition assertions show every distinction in R3.11
    present until its responsible consumer deliberately discharges it; no later stage guesses.
13. [ ] **AC-13 — CFG behavior:** Branch/loop fixtures prove condition and clause order,
    `continue`/`break`/`return` edges, short circuit, and generic correct fallback.
14. [ ] **AC-14 — Whole-program roots:** Startup, initializers, `main`, nested calls, platform
    operations, and selected helpers are present; dead source is absent and recursion is rejected.
15. [ ] **AC-15 — Complete SFA:** The nested-call and dynamic-address fixtures enumerate and place
    every activation-owned home with correct interference and no global/asset ownership leakage.
16. [ ] **AC-16 — Final closure:** A seeded late pointer/spill/helper request returns to SFA and
    changes the closure certificate; a seeded post-closure storage request fails before emission.
17. [ ] **AC-17 — No runtime:** Link/symbol/map inspection finds no heap, software stack,
    dispatcher, scheduler, safety handler, asset copier, or generic runtime object.
18. [ ] **AC-18 — Target separation:** Structural and synthetic forbidden-edge tests prove shared
    frontend/semantic code contains no C64/6510/ACME/PRG knowledge and future constraints add no
    target packages.
19. [ ] **AC-19 — Platform API directness:** Each M1 C64 API produces the same required volatile
    operations, count/order, and state as its expert direct sequence with no hidden call. Exact cost
    deltas are recorded for RD-08 and do not fail `none` solely for being above the expert baseline.
20. [ ] **AC-20 — Memory intrinsics:** Full-pipeline byte/word cases at constant, variable,
    expression, page-edge, and `$FFFF` addresses prove exact access/evaluation/order and pointer
    resource behavior.
21. [ ] **AC-21 — Legal machine program:** Every emitted opcode/addressing mode is legal documented
    NMOS 6502/6510 behavior; flags/carry/decimal state and branch ranges are accounted explicitly.
22. [ ] **AC-22 — SpritePad qualification:** The native 3.80 template/final project, exports,
    settings, hashes, schema evidence, and malformed/version/EOF cases prove the consumed SPD v5
    surface. The official producer is absent from build/CI; missing evidence blocks rather than
    skips qualification.
23. [ ] **AC-23 — Requested-only asset:** Actual PRG bytes/map contain exactly one copy of each of
    the final project's eight native sprite records, permit deliberate pointer sharing, and
    contain no duplicate raw representation or unrequested derived/optional selector output.
24. [ ] **AC-24 — VIC-correct placement:** Final addresses prove 64-byte alignment, one-bank
    containment, screen/pointer compatibility, visibility, no overlap, derived pointer correctness,
    and no runtime copy/division.
25. [ ] **AC-25 — Startup and restoration:** Byte and VICE observations prove the `$0801` stub,
    `$080D` entry, established state, initializer order, fallthrough to `main`, preserved cooperative
    KERNAL IRQ, restored owned state, and normal return to BASIC.
26. [ ] **AC-26 — ACME terminal boundary:** Source inspection and seeded failures prove the emitter
    only serializes final decisions and contains no `!to`, manifest name, or output path. Invocation
    inspection proves the exact separate `--format cbm`, `--outfile`, `--report`, and
    `--symbollist` argument values under the validated staging root. Strict ACME invocation,
    actual report/symbol/byte checks, and output suppression behave exactly.
27. [ ] **AC-27 — Coherent artifacts:** Every required evidence file passes its direct version-1
    schema, has one semantic-input record and immutable generation identity, and has the correct
    hash. Cases cover the exact PRG and fixed-sidecar component set, basename preservation, native
    component-length rejection, case/alias collision, occupied symlink/non-regular paths, and
    exclusive-create collision. A concurrent reader pins one complete generation; an input change,
    pre-commit cancellation, or seeded compiler/ACME/layout/package failure publishes no mixed or
    stale set and preserves the prior current generation. Post-commit run cancellation preserves
    that build and stops only emulator/control work.
28. [ ] **AC-28 — Deterministic VICE input:** The predetermined real-joyport trace produces the
    exact table-derived player, six-invader, projectile/explosion, collision, win, rendered-sprite,
    release/press, and return results without observing or patching program state. A hit update
    publishes explosion frame/count 1, its next update publishes frame/count 2, and the following
    update makes sprite 7 idle; no zero-count delay is accepted.
29. [ ] **AC-29 — VICE return:** The same run observes the final win frame, fire release and new
    press, restoration, and exact BASIC-return boundary, then the driver stops VICE externally
    without target debug-cart or injected exit code.
30. [ ] **AC-30 — Independent behavior oracle:** Deliberately breaking movement direction, update
    order, fire-edge behavior, entity indexing, collision, win/loss, pointer placement, volatile
    order, restoration, or return causes the matching oracle to fail independently of assembly
    shape.
31. [ ] **AC-31 — Expert baseline:** The hand-authored equivalent twin and generated program use the
    same obligations and complete resource ledger. Exact local and whole-program deltas are recorded
    as RD-08 input; cost alone neither fails `optimization: none` nor creates parity debt.
32. [ ] **AC-32 — Determinism:** Byte-identical copies built from different absolute paths and
    working directories produce identical normalized diagnostics, assembly, deterministic
    sidecars, and PRG. Their `.build.json` files differ only in `generationId` and declared host
    provenance; their semantic-input, portable-tool, and artifact-hash projections match exactly.
33. [ ] **AC-33 — Focused verification:** The closeout records directed checks plus one relevant
    boundary suite, one ACME M1 proof, and one sequential VICE M1 proof; no v3 readiness/game matrix
    or repeated unrelated full suite ran.
34. [ ] **AC-34 — C64U seam review:** Every R3.35 item has evidence and any failed shared seam is
    corrected without creating C64U implementation or plugin scaffolding.
35. [ ] **AC-35 — Deferral-expiry closeout:** The closeout answers whether M1 invalidated any
    deferral reason in the v4 register, Specification 4 future considerations, expert skill records,
    or expressiveness ledger. Every expired deferral has an owner before RD-03 closes.

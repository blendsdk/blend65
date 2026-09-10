# RD-04: Complete Language and Correct Unoptimized Compiler

> **Document**: RD-04-complete-language-correct-unoptimized-compiler.md
> **Status**: Draft
> **Created**: 2026-09-10
> **Project**: Blend65 v4
> **Depends On**: RD-01, RD-02, RD-03
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

RD-04 extends the proven M1 pipeline until every core-language construct, semantic rule,
diagnostic, ABI obligation, and `optimization: none` lowering in the frozen Blend65 Language
Specification 4.0 is implemented correctly for the first C64 profile. It completes the language
before optional optimization or the remaining target-platform integrations are added. Game
algorithms remain ordinary user code. (AR-038)

This is not a second compiler path and not a horizontal collection of disconnected parser or IR
features. Each added language family crosses the existing real pipeline through legal NMOS 6510
machine operations, ACME 0.97, a verified PRG where runtime behavior applies, and focused VICE 3.10
evidence. The implementation may add only representation or helper machinery required by a current
Specification 4 consumer. It cannot revive v3 restrictions, make users expose SFA/compiler
mechanics, or fabricate future platform support.

The completion claim is deliberately bounded. RD-04 completes the language and unoptimized
compiler for profile-independent programs and the already-qualified first-profile surface. RD-05
through RD-07 add the remaining C64 hardware APIs, asset families, and disk loading. A source
form requiring one of those not-yet-qualified facilities receives an honest selected-profile
capability diagnostic; it does not silently succeed, gain placeholder output, or weaken its core
language semantics.

> **Decisions:** AR-002 through AR-004, AR-006 through AR-025, AR-027 through AR-035, and AR-037
> through AR-038.

---

## Functional Requirements

### Must Have

#### Frozen authority and completion accounting — complexity XL

- [ ] **R4.1 — Consume only frozen Specification 4 authority.** Refuse implementation planning or
  semantic work until RD-01 has activated one exact Specification 4 identity and expert baseline
  `2.0.0`. Bind both identities to tests and build evidence. V3 code/tests remain audit or salvage
  input only and cannot define accepted behavior. (AR-004, AR-014, AR-034)
- [ ] **R4.2 — Account for the complete normative language.** Build a small checked coverage
  crosswalk from every normative Specification 4 grammar production, semantic rule, active
  diagnostic, and applicable conformance clause to its implementation owner and decisive proof.
  Every entry is implemented, explicitly owned by RD-05 through RD-07 as a platform capability, or
  rejected by Specification 4. `Unknown`, inherited behavior, and unowned exclusions block RD-04.
  This crosswalk is a static audit artifact, not a readiness service or second specification.
  (AR-002, AR-014, AR-033)
- [ ] **R4.3 — Extend the one M1 pipeline.** All new behavior uses RD-03's project snapshot,
  frontend, semantic representations, whole-program/SFA analysis, target lowering, resource
  binding, layout, ACME emission, packaging, artifact publication, and CLI/LSP services. Do not add
  a legacy frontend, alternate compiler mode, feature-specific pseudo-assembler, or bypass from AST
  to output. (AR-012, AR-025, AR-027)
- [ ] **R4.4 — Stop on authoritative errors.** Any lexical, syntax, module, semantic, target-
  capability, SFA/resource, lowering, layout, ACME, or packaging error remains terminal for
  runnable-looking output. Recovery poison cannot enter a success path, and failed builds cannot
  publish or run stale artifacts. (AR-003, AR-022, AR-025)

#### Complete frontend, modules, and diagnostics — complexity XL

- [ ] **R4.5 — Complete the lexer.** Implement every Specification 4 token, keyword, contextual or
  reserved word, punctuation form, operator, numeric base/separator rule, comment, string/character
  escape, UTF-8 source rule, maximal-munch decision, and lexical diagnostic with exact byte spans.
  Retain Unicode scalar identity inside literals for later profile encoding; do not normalize or
  interpret target character maps in the lexer. (AR-003, AR-014)
- [ ] **R4.6 — Complete one Pratt-based parser.** Parse the complete Specification 4 grammar with
  one precedence-owning Pratt expression parser and direct statement/declaration parsing. Cover
  every postfix, prefix, infix, assignment, conditional, aggregate literal, type, declaration,
  module, control-flow, placement, `loadable const`, function-value, interrupt-function, and
  compile-time-function form. Do not restore the removed range loop or create parallel expression
  grammars for loops, constants, or subscripts. (AR-014 through AR-020)
- [ ] **R4.7 — Complete bounded syntax recovery.** Recover at grammar-owned synchronization points,
  preserve exact primary and related spans, and continue only far enough to find independent
  errors. A recovered or missing node is explicitly poisoned and cannot acquire a valid type,
  effect, SFA home, machine operation, or artifact. Stable source order controls diagnostics rather
  than parser accident. (AR-003, AR-014)
- [ ] **R4.8 — Complete modules and program structure.** Resolve deterministic `sourceRoot`
  indexing, same-module contributions, qualified imports/exports and aliases, visibility,
  declaration collisions, circular declaration-only imports, reachable module selection, exactly
  one valid `main`, deterministic initializer dependencies/order, and unreachable declarations.
  Recorded `--entry`/`--target` overrides select one graph/profile without duplicate manifests, and
  only that graph is analyzed. Filenames and filesystem enumeration never become module identity.
  (AR-022, AR-028, AR-030)
- [ ] **R4.9 — Complete names, scopes, and declarations.** Implement declaration-order
  independence where specified; mandatory annotations; duplicate, unknown, and reserved-name
  handling; block/function/module scopes; no shadowing; zero-page blocks; structs; enums;
  functions; variables; constants; placement; and contextual validity. Each declaration has one
  stable symbol identity shared by compiler and LSP. (AR-003, AR-014, AR-020, AR-021)
- [ ] **R4.10 — Implement the complete active diagnostic registry.** Emit every applicable
  Specification 4 error and warning with its exact code, severity, template, primary/related UTF-8
  spans, notes/help, cascade suppression, and stable ordering. Do not reuse retired codes or create
  implementation-only public diagnostics. Profile and resource failures name the selected profile,
  violated constraint, source owner, and relevant cost or limit. (AR-003, AR-008, AR-014)

#### Complete scalar semantics, expressions, and control flow — complexity XL

- [ ] **R4.11 — Implement the complete scalar and nominal type system.** Cover `byte`, `sbyte`,
  `word`, `sword`, `boolean`, `void`, enum types, function types, fixed arrays, structs, contextual
  unsized array parameters, and loadable values. Enforce exact type annotations, nominal identity,
  legal implicit promotion, explicit casts, signedness restrictions, assignment compatibility, and
  the 16-bit representable object domain. (AR-014 through AR-018, AR-031)
- [ ] **R4.12 — Separate constant and runtime arithmetic exactly.** Constant-expression evaluation
  uses Specification 4 full precision followed by declared-type range checks. Ordinary runtime
  expressions use operand-determined width, signed interpretation, left association, and
  deterministic wrapping even when their operands happen to be foldable. Host JavaScript number,
  bitwise, shift, or coercion behavior is never the semantic oracle. (AR-002, AR-014)
- [ ] **R4.13 — Preserve normal expression evaluation.** Evaluate operands and function arguments
  left to right; evaluate every place, index, address, and value exactly once; preserve
  right-associative value-producing assignment; and implement selected-arm `?:` plus short-circuit
  `&&`/`||` without evaluating an unselected effect. Nested calls require compiler-owned staging,
  never source-written temporaries. (AR-002, AR-003)
- [ ] **R4.14 — Implement every legal operator.** Cover unary, arithmetic, bitwise, logical,
  comparison, shift, conditional, simple assignment, and compound assignment over every legal
  width/signedness combination. Signed comparison, signed right shift, wide shifts, quotient
  truncation toward zero, remainder sign, carry/borrow ownership, and minimum-value overflow follow
  Specification 4 exactly. (AR-002, AR-014)
- [ ] **R4.15 — Implement the division-zero boundary and optional check.** Constant zero remains a
  compile-time error. With `divisionZeroCheck: false`, a runtime zero divisor terminates with a
  valid-width unspecified result and bounded effects; surrounding behavior remains defined. With
  the option enabled, evaluate operands once and branch before division to the C64 source-labelled
  `SEI` plus self-loop terminal block. Link no handler, string, RAM, ZP, exception, or runtime.
  Record all success-path and resource costs. (AR-002, AR-023)
- [ ] **R4.16 — Complete ordinary control flow.** Implement mandatory-brace blocks, `if`/`else`,
  `while`, `do`/`while`, familiar three-clause `for`, `break`, `continue`, `return`, and omitted
  loop clauses with exact scopes and evaluation edges. Reject only the proved canonical byte-loop
  wrap trap defined by Specification 4; deliberate ring cursors, timers, modular loops, and
  explicit infinite loops remain legal. (AR-002, AR-014)
- [ ] **R4.17 — Complete switch behavior.** Implement scalar/enum switch expressions, compile-time
  and multi-value cases, unique values, one default, automatic break, explicit terminal
  `fallthrough`, nested control flow, and stable source evaluation. Range cases and labelled break
  remain outside Specification 4. Lowering may select comparisons, tables, or another measured
  form only when semantics and costs remain exact. (AR-014)
- [ ] **R4.18 — Complete reachability, return, and initialization analysis.** Prove required returns,
  report always-false and unreachable paths as specified, and distinguish indeterminate stored bits
  from optimizer undefined behavior. An uninitialized mutable declaration emits no implicit clear.
  Warnings for a nonzero uninitialized array and for a function-local maybe-read-before-assignment
  are independent and may both apply. (AR-002, AR-014)
- [ ] **R4.19 — Complete enum semantics.** Preserve byte-backed nominal identity, declaration-order
  auto-numbering, explicit constant values, duplicate-value legality, unique names, qualified member
  access, export visibility, enum-to-byte conversion, explicit byte-to-enum conversion, and
  cross-enum rejection through analysis and lowering. (AR-014)

#### Arrays, strings, structs, addresses, and aggregate values — complexity XL

- [ ] **R4.20 — Implement the complete fixed-array model.** Support stored `T[N]`, initialized
  extent-inferred `T[]`, rectangular row-major nesting, zero extent, exact object-size limits,
  nested/fill/string initializers, arrays of structs, and `length()` at every applicable level.
  Dynamic arrays, capacities, jagged storage, slices, spans, and views do not exist. (AR-016,
  AR-017)
- [ ] **R4.21 — Preserve the array ordinal context.** Every integer type may index an array. Direct
  unbarriered integer-producing operators inside `[]` promote byte/sbyte operands into the specified
  signedness-preserving 16-bit ordinal domain. Explicit narrow casts, stored narrow values, compound
  assignments, and completed narrow call results remain barriers. Keep final signedness, full
  element-size scaling, dimension extent, and fixed-versus-carried length until address lowering.
  (AR-002, AR-017)
- [ ] **R4.22 — Implement exact bounds behavior.** A statically provable negative or out-of-extent
  ordinal is an error. With checks disabled, sign-extend signed ordinals, scale by full element
  size, form the effective address modulo 65536, and continue multi-byte access byte by byte across
  `$FFFF` to `$0000` under active banking/MMIO. With `boundsCheck: true`, test signed lower and
  upper bounds before address formation and enter the same no-runtime terminal form on failure.
  (AR-002, AR-023)
- [ ] **R4.23 — Complete literals and immutable character maps.** Decode string and character
  escapes as Unicode scalars, then resolve each required byte through the selected profile's exact
  immutable `encoding + character-map` identity. Implement raw bytes, no implicit terminator,
  explicit encoding/map intrinsics, size validation, and unrepresentable-scalar diagnostics. Never
  normalize, transliterate, replace, guess a glyph, emit target UTF-8, or change VIC state.
  (AR-003, AR-024)
- [ ] **R4.24 — Complete struct semantics and layout.** Implement nonempty ordered fields, nested
  structs/arrays, circular-containment rejection, literals, field places, address-of, exact
  deterministic layout, `sizeof`/`offsetof`, zero-page/resource accounting, and no implicit padding
  unless Specification 4 explicitly requires it. Struct equality remains unavailable. (AR-015,
  AR-016)
- [ ] **R4.25 — Implement aggregate assignment and return as values.** Fixed arrays and structs
  support exact-shape assignment and return. Use caller-owned return storage, direct construction,
  and copy elision where semantics permit. Any required copy preserves the source value under
  overlap/aliasing and reports bytes/cycles/scratch. Do not require a source-level destination
  parameter or copy intrinsic. (AR-002, AR-016)
- [ ] **R4.26 — Implement zero-copy aggregate parameters.** Exact `T[N]` parameters carry a base
  address; outer-unsized `T[]` parameters carry base plus word element count; nested inner extents
  stay fixed. Mutable and `const` borrows use the same ABI, with transitive read-only enforcement
  and exact forwarding rules. Scalars/enums reject meaningless `const` parameter spelling.
  (AR-016, AR-017)
- [ ] **R4.27 — Implement complete addressable-place behavior.** `&` accepts all real storage
  places, including parameters and composed field/index expressions, evaluates them once, and
  yields `word`. Track local-origin and read-only provenance through copies, casts, conditionals,
  `lo`/`hi`, arithmetic, and bitwise derivation. Reject the first return, longer-lived store,
  asynchronous publication, retaining/unproved call, or opaque escape; loaded data does not inherit
  address provenance. (AR-015)
- [ ] **R4.28 — Implement placement and loadable-value semantics.** Parse, type, preserve, and
  validate the closed `place(at, align, noCross, region)` modifier on its legal declaration kinds.
  Implement `loadable const` as fixed compile-time-known nonresident data that cannot be read,
  indexed, addressed, mutated, or ordinarily passed before an explicit compatible load. Because
  RD-04 qualifies only the resident PRG profile, a reachable transfer request is rejected as an
  unavailable selected-profile capability until RD-07 supplies its real disk profile and loader;
  no placeholder transfer is emitted. (AR-020, AR-029, AR-031)

#### Functions, compile-time execution, and intrinsics — complexity XL

- [ ] **R4.29 — Complete ordinary functions and nested calls.** Implement typed declarations,
  left-to-right argument evaluation, scalar and aggregate parameters/returns, declaration-order
  independence, exact argument diagnostics, direct calls, cross-module calls, nested-call staging,
  and finite hardware-stack accounting. There is no source parameter-count limit or hidden source
  workaround for SFA. (AR-002, AR-016)
- [ ] **R4.30 — Complete typed finite function values.** Named ordinary functions may be stored,
  assigned, selected, passed, returned, and called through exact `fn(...)` types while whole-program
  analysis retains a finite compatible target set. Preserve target identity separately from its
  numeric address, merge sets safely, devirtualize singleton sets, and select a measured finite
  dispatch/trampoline form for larger sets. Raw `word` cannot become callable; there are no lambdas,
  closures, captures, unknown calls, or runtime registry. (AR-018)
- [ ] **R4.31 — Reject recursion without rejecting nested evaluation.** Detect every reachable
  direct or indirect recursive strongly connected component and report the complete cycle before
  allocation. Calls such as `f(1, f(2, 3))` are legal and use distinct staging rather than being
  misclassified as recursion. (AR-002, AR-018)
- [ ] **R4.32 — Complete interrupt-function and execution-domain semantics.** Keep interrupt-handler
  values distinct and non-callable except through compatible recognized sinks. Select raw,
  firmware-mediated, or ordinary callback entry variants only from the exact profile contract;
  model mainline/IRQ/NMI preemption, decimal state, A/X/Y/flag ownership, `RTI` versus `RTS`, vector
  compatibility, reentrancy, shared-state lost-update/tearing warnings, and finite overlap. A
  minimal first-profile interrupt qualification may prove this compiler contract; reusable C64
  IRQ scheduling and takeover facilities remain RD-05 work. (AR-013, AR-018, AR-024)
- [ ] **R4.33 — Complete deterministic compile-time functions.** Execute `comptime function` code
  under typed Specification 4 semantics with bounded steps and memory, direct acyclic calls, local
  fixed storage, constants, validated embedded data, and aggregate returns. Reject runtime/MMIO,
  low-level intrinsics, indirect calls, recursion, arbitrary host input, nondeterminism, and budget
  exhaustion with no partial target data. Implement byte-exact `sin8`, `cos8`, `sin16`, and `cos16`;
  emit only their resulting constants. (AR-019)
- [ ] **R4.34 — Complete memory, size, and profile queries.** Implement variable/expression-address
  `PEEK`/`POKE` byte and word access, little-endian order, modulo-65536 continuation, exactly-once
  effects, volatility, `lo`, `hi`, stable-word `sizeof`, `offsetof`, and `length`, including runtime
  word count for `T[]` parameters and errors for unsized standalone size. Resolve Specification 4's
  immutable selected-profile facts at compile time so ordinary PAL/NTSC or other fact branches emit
  only the selected arm even in `optimization: none`. Do not restrict addresses to literals, add
  hidden MMIO caching, or introduce a preprocessor/conditional declaration system. (AR-002,
  AR-015 through AR-017, AR-030)
- [ ] **R4.35 — Complete the approved CPU-control and packed-BCD surface.** Implement exactly
  `asm_sei`, `asm_cli`, `asm_php`, `asm_plp`, and `asm_nop` with their flag, stack, ordering,
  profile-legality, and SFA/stack effects. Implement `bcd_add`/`bcd_sub` with owned carry/no-borrow,
  D-clear exit, constant invalid-nibble diagnostics, and selected-NMOS behavior for unproved invalid
  runtime digits. Reject every other opcode-shaped source intrinsic and inline/external assembly.
  (AR-006)
- [ ] **R4.36 — Complete core `embed()` dispatch.** Implement contained literal-path resolution,
  raw unregistered-extension bytes, registered extension/signature/version dispatch, literal opaque
  selectors, exact result types/sizes, canonical identity/deduplication, provenance, deterministic
  diagnostics, and immutable symbolic placement. RD-04 retains the qualified M1 SpritePad surface;
  CharPad, PSID, Koala, broad SpritePad selectors, scene refinement, and derived assets remain RD-06
  work. No parser guesses a format from extension or legacy tests. (AR-007, AR-014, AR-037)

#### Complete representations, whole-program reasoning, ABI, and SFA — complexity XL

- [ ] **R4.37 — Preserve the complete semantic payload.** Extend the smallest existing typed
  representations to retain width, signedness, constant/runtime context, wrap, nominal type,
  place/value identity, evaluation order, selected control arm, volatility, memory width/count/order,
  alias/escape, symbolic storage, array ordinal/extent/stride, aggregate shape, callable target set,
  execution domain/entry variant, placement, calls/helpers/clobbers, target capability, costs, and
  source/debug association until each fact's accountable consumer. (AR-002, AR-012)
- [ ] **R4.38 — Build explicit control and effect graphs.** Represent all branch, loop, switch,
  short-circuit, conditional, call, return, interrupt, safety-stop, and unreachable edges. Track
  ordered RAM/MMIO/CPU effects and per-parameter retaining summaries. No later pass may infer
  semantic order or volatility from emitted text. (AR-003, AR-012, AR-018)
- [ ] **R4.39 — Close the complete whole-program graph.** Include entry/startup, deterministic
  module initializers, direct calls, every finite indirect target, address-taken/exported roots,
  recognized callback/interrupt roots, and compiler-selected helpers. Unknown or escaped calls are
  diagnosed or handled by an explicit conservative contract, never dropped. Reject recursion and
  retain dead-source exclusion without erasing required diagnostics. (AR-018, AR-022, AR-030)
- [ ] **R4.40 — Allocate every execution home through SFA.** Cover parameters, returns, caller
  staging, locals, address-taken storage, expression temporaries, aggregate destinations, spills,
  indirect pointer pairs, finite-dispatch state, domain variants, saved machine state, and helper
  scratch. Use deterministic interference and compatible overlay while respecting lifetime, alias,
  calls, interrupts, alignment, region, and zero-page facts. Globals, explicit user ZP, assets,
  layout, and loader buffers stay outside SFA. (AR-002, AR-016, AR-018)
- [ ] **R4.41 — Complete one explicit ABI family.** Define and implement ordinary direct/indirect
  calls, scalar and aggregate returns, exact/unsized aggregate borrows, compiler helpers,
  interrupt/raw/firmware/callback entries, and the five approved CPU-control intrinsics without
  per-function ABI invention. Account for hardware return addresses, CPU-pushed interrupt bytes,
  explicit stack operations, saved registers/flags, and maximum overlap. (AR-006, AR-016, AR-018)
- [ ] **R4.42 — Freeze final storage closure and add no runtime.** Legalization and resource binding
  return every new spill, pointer, helper, and scratch demand to the bounded monotonic SFA process.
  After its closure certificate, no stage or ACME macro invents function storage. Link only used,
  direct, fully costed compiler helpers; add no heap, software stack, generic dispatcher, exception
  service, safety runtime, array descriptor system, or mandatory library object. (AR-002, AR-012)

#### Correct `optimization: none` backend and artifacts — complexity XL

- [ ] **R4.43 — Lower every scalar operation legally.** Select correct documented NMOS 6510
  sequences for each width/signedness combination of arithmetic, comparison, shifts, multiply,
  divide/remainder, conversions, boolean operations, and BCD. Helpers are selected only where they
  beat an inline legal form under complete cost and have explicit clobber/scratch/reentrancy
  contracts. (AR-002, AR-023)
- [ ] **R4.44 — Lower control, aggregates, arrays, and calls completely.** Implement generic correct
  CFG lowering, switch, short circuit, aggregate construction/copy/return, fixed/nested array
  addressing, exact/unsized borrows, dynamic addresses, direct and finite indirect calls, safety
  stops, and relevant interrupt variants. A proved special form may be smaller, but an unrecognized
  case always retains a correct generic path. (AR-002, AR-016 through AR-018)
- [ ] **R4.45 — Enforce selected CPU and machine legality.** Final machine operations use only
  documented NMOS instructions/addressing modes, explicit flag/decimal assumptions, legal branch
  ranges, deliberate zero-page/absolute widths, and the selected C64 memory/banking/MMIO map. ACME
  remains configured with `--cpu 6502`; the platform model separately owns the 6510 `$0000/$0001`
  port. No undocumented, CMOS-only, or ambient-state-dependent instruction reaches output.
  (AR-013, AR-024)
- [ ] **R4.46 — Keep `none` semantically complete and structurally small.** `none` performs required
  constant/comptime evaluation, unreachable exclusion, semantic canonicalization, instruction
  selection, helper choice, resource binding, SFA closure, layout, branch repair, emission, and
  packaging. It performs no optional target-neutral or machine transformation, has no hidden
  peephole catalog, and never depends on `balanced`, `speed`, or `size` to generate correct or legal
  code. (AR-012, AR-023)
- [ ] **R4.47 — Complete layout, terminal emission, and evidence.** Place code, globals, user ZP,
  SFA, constants, and admitted resident assets without overlap; honor `place(...)`, banking,
  visibility, alignment, no-cross, reserved regions, branch layout, and the profile's startup/exit.
  Serialize deterministic ACME, verify its report/symbols/bytes, package the PRG, and atomically
  publish assembly, labels, memory/asset/SFA/ZP/stack/cost/debug maps and hashes. (AR-007, AR-008,
  AR-020, AR-022)
- [ ] **R4.48 — Keep the profile claim honest.** At RD-04 closeout, claim complete Specification 4
  core-language and `optimization: none` compilation only for the implemented first-profile surface.
  Platform APIs, asset handlers, loading, or deployment owned by RD-05 through RD-07 remain named
  unavailable capabilities. Do not create empty packages, callable stubs, permissive defaults, or
  a readiness score to imply support. (AR-002, AR-012, AR-024, AR-033)

#### Independent qualification without a readiness product — complexity XL

- [ ] **R4.49 — Derive specification tests before each implementation family.** Author immutable
  `*.spec.test.ts` cases only from the frozen Specification 4 identity, RD-04, and pinned CPU/C64/
  ACME/VICE evidence. Cover every normative production/rule/diagnostic with the smallest decisive
  positive, boundary, negative, and interaction cases. Implementation tests remain separate and
  may not weaken the oracle. (AR-004, AR-014, AR-025)
- [ ] **R4.50 — Use independent behavior oracles.** For every runtime semantic family, define
  source results and observable state independently of compiler implementation, including values,
  wrap, memory/MMIO order/count, calls, aggregate contents, flags/decimal/interrupt state, failure
  boundaries, and timing where the contract makes it observable. Compiler-path differential tests
  are supporting evidence only. (AR-002, AR-003)
- [ ] **R4.51 — Enforce expert assembly and cost expectations.** Each implemented operation family
  has a competent hand-written sequence or independently derived cost frontier under the identical
  ABI, storage, effects, and profile obligations. Generated local results may not be worse. An
  honest meet records the authorized actionable parity-debt issue and RD-08 path; a worse result
  blocks RD-04. No unimplemented source form can hide outside the ratio. (AR-002, AR-008)
- [ ] **R4.52 — Keep verification impact-based.** During implementation run only the affected
  language/stage/package cases. At each language-family boundary run its complete qualification.
  At RD-04 closeout run the complete v4 core-language, compiler/CLI/LSP boundary, ACME artifact, and
  bounded sequential VICE corpus once. Do not import v3 readiness, rerun thousands of unrelated
  cases after local changes, or create randomized AI-answer gates. (AR-025, AR-026)
- [ ] **R4.53 — Keep CLI and editor semantics identical.** `blendc check` and the language server
  consume the same project snapshot, module graph, symbols, types, profile facts, and complete
  diagnostics without importing codegen into the frontend. `build`/`run` use that result only after
  successful analysis; the minimum VS Code client from RD-03 receives the expanded diagnostics but
  does not grow into RD-09's production feature set here. (AR-021, AR-022)
- [ ] **R4.54 — Recheck portability, deferrals, and expressiveness.** Verify that complete shared
  semantics/IR contain no C64 addresses or device assumptions and that C64U/banked/transfer-only
  storage remains representable by later owners. Re-scan the ambiguity register, Specification 4
  future considerations, RD Won't Have sections, and expressiveness ledger; assign every expired
  deferral or reachable unidiomatic restriction before closeout. (AR-002, AR-024, AR-033)

### Should Have

- [ ] **R4.55 — Keep diagnostics and examples modern — complexity S.** Complete-language examples
  should use normal C/TypeScript-familiar expressions, calls, aggregates, and loops. Diagnostics
  explain the source problem and platform-forced exception without teaching compiler internals or
  defending a lowering shortcut. (AR-002, AR-003)
- [ ] **R4.56 — Preserve readable machine evidence — complexity M.** Deterministic assembly uses
  stable source-related labels and comments at meaningful routine/data boundaries. Reports connect
  source operations to helpers, SFA homes, bytes, cycles, and constraints without turning ACME
  source into a second semantic IR. (AR-008, AR-010)
- [ ] **R4.57 — Record host responsiveness observations — complexity S.** Record phase-separated
  check, build, ACME, representative LSP request, and peak-memory measurements for the complete
  language corpus. They are diagnostic observations, never pass/fail thresholds or justification
  for speculative caching. (AR-011, AR-026)

### Won't Have (Out of Scope)

- Optional `balanced`, `speed`, or `size` transformations, a generic optimizer/pass registry,
  optimization barrier, or performance claims based on transformed code. RD-08 owns optimization.
- The complete C64 hardware/platform library, takeover and NTSC behavior, SID music/effects,
  sprite, scrolling, buffering, and raster-timing support. RD-05 owns those target-specific
  capabilities and qualifies user-authored game workloads; it does not own gameplay modules for
  collision, pools, or state dispatch. (AR-038)
- CharPad, PSID, Koala, broad SpritePad surface, compile-time Integrator refinement, derived graphics,
  automatic asset placement across complete games, or general resident-asset qualification. RD-06
  owns them.
- A loader, decompressor, overlay lifetime, `loadable const` transfer implementation, D64 packager,
  or disk-profile support. RD-07 owns them; RD-04 implements the language semantics and honest
  unsupported-profile result only.
- Production LSP/VS Code completion, navigation, rename, formatting, build/run UI, artifact browser,
  or debugger integration. RD-09 owns those; RD-04 only extends shared diagnostics.
- Recursion, heap allocation, dynamic arrays, slices, views, closures, lambdas, unknown indirect
  calls, type aliases, labelled break, switch ranges, inline assembly, external assembly functions,
  arbitrary opcode intrinsics, or a general runtime. Specification 4 rejects or defers them.
- C64U, X16, Atari, another CPU, assembler dialect, artifact packager, public plugin system, or
  empty future-target packages.
- V3 compatibility, v3 tests as authority, readiness services, dashboards, game-feasibility scores,
  broad game corpora, remote caches, persistent compiler daemons, or wall-clock acceptance gates.

---

## Technical Requirements

### RD-04 completion boundary — complexity XL

RD-04 is complete only when this table has no unowned or falsely successful row:

| Domain | Required RD-04 result | Later owner retained |
|---|---|---|
| Lexical and grammar | Every normative Specification 4 token and production parses or diagnoses exactly | None |
| Core semantics | Every type, expression, statement, module, function, aggregate, address, intrinsic, and compile-time rule has a typed result or exact error | None |
| Diagnostics | Complete active registry, stable spans/order/cascades, and LSP/CLI identity | Production editor UX in RD-09 |
| Execution storage | Complete ABI, whole-program graph, effects, domain-aware SFA, and final closure | None |
| Unoptimized target path | Correct legal NMOS 6510 output, first-profile layout, ACME, PRG, and evidence | Optional optimization in RD-08 |
| Platform surface | M1 APIs, first-profile facts, character maps, minimal interrupt qualification, raw embed, and qualified M1 SpritePad input | General C64 systems/assets/loading in RD-05 through RD-07 |
| Deferred platform request | Exact selected-profile capability diagnostic before lowering; no output or placeholder | Owning later RD |

“Complete language” means that ordinary language semantics are not deferred merely because a
backend case is difficult. “Bounded platform surface” means that separately owned hardware APIs,
asset formats, and artifact modes are not falsely implemented merely to increase a feature count.

### Mandatory semantic-to-machine paths — complexity XL

| Semantic family | Required machine/accounting boundary |
|---|---|
| Scalar values | Exact width/signedness, wrap, flags, loads/stores, conversions, comparisons, shifts, multiply/divide/remainder, and helper costs |
| Places and memory | One address evaluation, alias/provenance, volatile order, byte/word little-endian access, page and `$FFFF` continuation |
| Control flow | Explicit CFG, source effect order, generic branch form, deterministic layout/relaxation, and correct return/continue/fallthrough edges |
| Arrays | Static shape/stride, ordinal promotion/barriers, fixed or carried length, bounds policy, element scaling, and no descriptor beyond `T[]` ABI count |
| Structs/aggregates | Exact layout, by-reference borrow, caller-owned return, overlap-safe value copy, direct construction, and full resource cost |
| Calls | Direct or finite target set, caller staging, exact ABI, clobbers/effects, recursion rejection, helper edges, and hardware-stack peak |
| Interrupts | Source handler identity, recognized sink, entry variant, preemption domain, SFA instance, save/tail semantics, and shared-state warnings |
| Compile time | Bounded deterministic evaluation and emitted constants only; zero target execution storage or helper code |
| Intrinsics | Typed semantic operation with exact machine/flag/MMIO effect; never opaque source text |
| Placement/assets | Symbolic identity and constraints until final map; no copy or provisional address baked into earlier representations |

### `optimization: none` boundary — complexity L

| Always required in `none` | Forbidden as an implicit optional transform |
|---|---|
| Context-correct constant and compile-time evaluation | Algebraic reassociation or value-range assumptions not required for correctness |
| Unreachable source exclusion after authoritative diagnostics | Cross-routine specialization or cloning for performance |
| Semantic canonicalization needed by one correct lowering | Optional common-subexpression, dead-store, loop, or data-flow optimization |
| Legal instruction/addressing selection and helper choice | Peephole catalogs or pattern DSLs hidden inside emission |
| SFA/resource binding and final storage closure | Allocation decisions invented after closure |
| Platform placement, mandatory CFG layout, and branch repair | Profile-independent facts rewritten to match one C64 idiom |
| ACME serialization, byte verification, packaging, and evidence | String rewrites that change program decisions |

Required selection still uses the best legal expert sequence for the operation under its complete
contract. Calling a poor sequence “unoptimized” does not excuse output below the expert floor.

### SFA and ABI completion record — complexity XL

The closeout evidence records, for every root and feasible execution domain:

| Record | Required facts |
|---|---|
| Call graph | direct, finite indirect, helper, initializer, callback, interrupt, exported/address-taken roots, and rejected cycles |
| Parameters | by-value/reference, const access, exact versus any-size array, staging, alias, retain/escape, homes, and live intervals |
| Returns | scalar/aggregate ABI, caller destination, direct construction/copy, nested-call survival, and ownership |
| Locals/temporaries | lexical/dynamic lifetime, initialization, address provenance, CFG liveness, effects crossed, and home |
| Domains | mainline/IRQ/NMI/startup identity, preemption/nesting, disjoint instances, selected variants, and shared-state warnings |
| Machine resources | registers, flags, decimal/interrupt state, explicit and implicit stack bytes, ZP, spills, pointers, helper scratch, and costs |
| Closure | each legalization feedback demand, convergence step, deterministic final placement, and proof that no later owner allocates execution storage |

### Verification topology — complexity XL

| Tier | Normal trigger | Evidence |
|---|---|---|
| Grammar/frontend | A lexical, grammar, module, type, or diagnostic owner changes | Small rule-specific positive/boundary/negative/recovery cases |
| Semantic family | One operator/control/aggregate/function/intrinsic family changes | Complete family matrix plus interaction and independent result oracle |
| SFA/ABI | Calls, addresses, aggregate returns, helpers, or execution domains change | Roots, liveness, interference, closure, stack/ZP, nested/overlap cases |
| Machine/ACME | Selection, legalization, layout, emission, or helper changes | Legal operations, exact bytes, reports/symbols, behavior, and expert cost frontier |
| VICE | Observable runtime/platform behavior changes; family qualification; closeout | Small sequential PRGs grouped by semantic family; exact profile and state oracle |
| CLI/LSP boundary | Shared frontend/project/diagnostic behavior changes | Identical diagnostics and forbidden backend import proof |
| RD closeout | Once after all family qualifications are green | Complete core-language and relevant boundary set, not v3 readiness/full corpus |

Skipped external evidence is `Unknown`, never a pass. A fix reruns its direct cases and the
dependency-traced family boundary; it does not automatically rerun every unrelated language case.

---

## Integration Points

### With RD-01 (Specification 4 and Expert Authority)

RD-04 consumes the exact normative inventory, hashes, grammar, diagnostics, C64 core-profile facts,
Language Guard result, and expert `2.0.0` release. Any inconsistency reopens RD-01 rather than being
resolved privately in compiler code.

### With RD-02 and RD-03 (Foundation and M1)

RD-04 extends the minimal v4 package graph and the one fully connected M1 compiler path. Salvaged v3
mechanics still require requirement ownership and independent proof. RD-03's game, SpritePad fixture,
expert twin, and VICE driver remain regression boundaries; they do not become universal semantic
oracles.

### With RD-05 through RD-07 (Platform, assets, and loading)

RD-04 supplies complete language semantics, effects, ABI, symbolic storage, placement constraints,
and legal unoptimized machine operations. Later RDs add real target consumers without changing those
shared meanings. A later consumer that exposes missing semantic payload corrects the seam rather
than adding an AST-to-platform shortcut.

### With RD-08 (Optimization)

`none` and its independent behavior oracles are the correctness reference. RD-08 may transform only
the preserved semantic/machine representations, must add its own transformation expectations, and
cannot make the unoptimized compiler legal or semantically complete after the fact.

### With RD-09 (Language tooling)

The shared symbol/type/diagnostic service is complete here. RD-09 adds production editor operations
without reimplementing parsing, name resolution, type analysis, target facts, or diagnostics.

---

## Non-Functional Requirements

### Correctness and determinism — complexity XL

- Identical frozen project snapshots and tool/profile identities produce byte-identical diagnostics,
  semantic evidence, assembly, maps, and PRGs across absolute paths, filesystem enumeration,
  concurrency, locale, and Turbo scheduling.
- No host-language arithmetic, object iteration, locale collation, clock, randomness, network input,
  or process working directory can affect language or artifact results.
- Every unspecified hardware-limitation result remains narrowly unspecified; surrounding control,
  effects, storage, and optimizer assumptions remain bounded and testable.

### Generated output quality — complexity XL

- Every admitted program compiles without source workarounds introduced for parser, SFA, or backend
  convenience.
- Each local operation/routine meets or beats the competent expert sequence under the same complete
  contract. Meet-only results create actionable parity debt; worse results block completion.
- All costs distinguish ROM bytes, resident RAM, reserved address space, ZP, stack peak, helper
  scratch, padding, initialization, path cycles, and timing-sensitive variance.

### Maintainability and bounded architecture — complexity L

- Each representation, module, helper, and abstraction has a current Specification 4 consumer and
  direct proof. No pass/plugin framework, textual pseudo-assembly, generic runtime, or one-class-per-
  rule topology is introduced.
- Public APIs and non-trivial invariants are documented for junior maintainers without workflow IDs
  or plan language in source comments.
- Complete coverage is expressed as direct cross-references and tests, not a second orchestration or
  readiness product.

### Host responsiveness — complexity S

- Measurements are observations only. Correctness tests, CI, milestone, and release do not fail on
  elapsed time.
- Profiling must identify a real dominant source before adding incremental compilation, persistent
  caches, workers, or a daemon.

---

## Security Considerations

- Treat source, JSONC, imported bytes, character data, compile-time execution, paths, ACME/VICE
  output, monitor frames, and subprocess failures as untrusted. Bound all lengths, counts, nesting,
  diagnostics, retained output, evaluator steps/memory, protocol frames, and waits.
- Canonicalize project paths and reject absolute paths, traversal, symlink escape, device files,
  output overlap, and input mutation between snapshot and publication.
- Invoke ACME and VICE with argument arrays and canonical executable identities. Source and project
  content cannot inject shell, assembler directives, include paths, output options, monitor commands,
  scripts, hooks, or plugins.
- Compile-time functions have no filesystem/network/environment/time/random/process access beyond
  validated assets already present in the coherent project snapshot.
- LSP analysis performs no process execution and respects workspace trust. Source and artifacts
  remain local; no telemetry, upload, credential, remote cache, or listening network service is
  introduced.

---

## Scope Decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Completion order | Optional optimization alongside semantics / complete `none` first | Complete correct `none` first | Prevents optimization from concealing incomplete semantics or lowering. | AR-023, AR-033 |
| Language authority | V3 behavior / implementation inference / frozen Specification 4 | Frozen Specification 4 | Removes historical compiler restrictions from product semantics. | AR-004, AR-014 |
| Representation growth | Generic multi-IR framework / consumer-driven extension | Consumer-driven extension | Preserves every required fact without recreating an abstract compiler framework. | AR-012 |
| Arrays | Dynamic/slice model / fixed arrays with contextual `T[]` | Fixed arrays with contextual `T[]` | Matches the approved no-runtime resource model while retaining modern indexing. | AR-016, AR-017 |
| Aggregate calls | Source-written destination / caller-owned compiler return | Caller-owned compiler return | Gives normal value semantics without heap or dynamic frames. | AR-016 |
| Function values | Raw arbitrary address / finite typed target sets | Finite typed target sets | Enables normal use while preserving closed-world ABI/SFA proof. | AR-018 |
| Safety | Mandatory runtime / no option / independent inline checks | Independent default-off inline checks | Provides development checks without permanent runtime cost. | AR-002, AR-023 |
| Platform incompleteness | Placeholder success / honest unavailable capability | Honest unavailable capability | Keeps the language complete without pretending later C64 facilities exist. | AR-002, AR-033 |
| Proof | Final corpus only / direct family evidence plus one closeout | Direct family evidence plus one closeout | Localizes defects and avoids repeated irrelevant full runs. | AR-025, AR-026 |

---

## Acceptance Criteria

1. [ ] **AC-01 — Frozen inputs:** Build/test evidence names one activated Specification 4 identity
   and expert `2.0.0`; no v3 artifact acts as semantic authority.
2. [ ] **AC-02 — Complete crosswalk:** Every normative grammar/rule/diagnostic/conformance entry is
   linked to implementation and proof or to an explicit later platform owner; none is unowned.
3. [ ] **AC-03 — One pipeline:** Structural inspection finds no alternate frontend, AST-to-assembly
   bypass, textual pseudo-IR, feature-specific compiler, or placeholder future-target path.
4. [ ] **AC-04 — Complete lexer:** Decisive cases cover every Specification 4 token/literal/comment/
   UTF-8/maximal-munch rule and lexical diagnostic with exact byte spans.
5. [ ] **AC-05 — Complete parser:** Decisive cases cover every grammar production, precedence and
   associativity relation, contextual form, recovery boundary, and removed syntax.
6. [ ] **AC-06 — Modules and symbols:** Multi-file cases prove deterministic source discovery,
   imports/exports/aliases, merged modules, visibility, scopes, declarations, initializer order,
   selected entry, cycles, collisions, and stable symbol identity.
7. [ ] **AC-07 — Diagnostic registry:** Every applicable active error/warning is triggered by at
   least one focused oracle with exact code/severity/template/spans/order/cascade behavior; retired
   and implementation-only public codes are absent.
8. [ ] **AC-08 — Scalar types:** Full type matrices prove literal typing, annotations, nominal enums,
   promotion, signedness, casts, assignment, compound assignment, and object-size limits.
9. [ ] **AC-09 — Arithmetic contexts:** Paired constant/runtime cases prove full-precision constants,
   operand-width runtime wrap, association, shifts, signed comparison/division/remainder, and no
   host-number leakage.
10. [ ] **AC-10 — Expression effects:** Mutation probes prove left-to-right and exactly-once
    evaluation, assignment values, nested calls, short circuit, and selected conditional arms.
11. [ ] **AC-11 — Division boundary:** Constant zero errors; default runtime zero terminates with
    bounded effects; enabled checks stop before division with the exact no-runtime C64 terminal
    sequence and complete cost report.
12. [ ] **AC-12 — Control flow:** CFG and runtime cases prove every statement, scope, loop clause,
    continue/break/return edge, canonical wrap diagnostic, and legal modular-loop counterexample.
13. [ ] **AC-13 — Switch:** Cases prove automatic break, terminal fallthrough, multiple constants,
    type/value checks, one default, nested exits, generic lowering, and measured selected forms.
14. [ ] **AC-14 — Initialization:** Cases distinguish existing stored bits, function-local
    maybe-read warnings, independent uninitialized-array warnings, explicit initialization, startup
    ordering, and absence of blanket clear code.
15. [ ] **AC-15 — Fixed arrays:** Cases cover zero/maximum extents, total-size failure, inference,
    fill/string/nested initializers, row-major shape, arrays of structs, and per-level `length`.
16. [ ] **AC-16 — Ordinals and bounds:** Cases cover every integer-producing subscript operator,
    narrow barriers, signed negative values, extents above 255, word elements, nested strides,
    constant errors, checked bounds, unchecked modulo addresses, and `$FFFF` continuation.
17. [ ] **AC-17 — Strings and characters:** Exhaustive selected-map fixtures prove scalar escape
    handling, exact bytes, map identity, unsupported maps/scalars, no implicit terminator, and no
    hardware-state side effect.
18. [ ] **AC-18 — Structs:** Cases prove declaration/layout, nested fields/arrays, cycles, literals,
    addressability, size/offset, exact field access, resource cost, and equality rejection.
19. [ ] **AC-19 — Aggregate values:** Assignment and return cases prove exact shape, caller-owned
    storage, nested-call survival, direct construction/copy elision, overlap-safe copies, and no
    source workaround or hidden runtime.
20. [ ] **AC-20 — Aggregate borrows:** Cases prove exact and outer-unsized array ABI costs, runtime
    word length, mutable/const transitive access, forwarding, aliasing, and invalid scalar `const`.
21. [ ] **AC-21 — Address provenance:** Legal composed addresses evaluate once and remain contained;
    every copy/derivation, non-retaining call, escape class, sequential reuse, and overlapping-domain
    case produces the exact lifetime/SFA result.
22. [ ] **AC-22 — Ordinary calls:** Direct/cross-module/nested calls and scalar/aggregate parameters/
    returns preserve values, effects, ABI, SFA homes, clobbers, and stack peak without a source
    parameter limit.
23. [ ] **AC-23 — Function values:** Singleton and multi-target cases prove signature/type flow,
    storage/pass/return/call, safe target-set merging, devirtualization or measured dispatch, erased
    address rejection, and no runtime registry.
24. [ ] **AC-24 — Recursion:** Direct, mutual, and finite-indirect cycles report complete paths before
    allocation; repeated sequential and nested argument calls remain legal.
25. [ ] **AC-25 — Interrupt semantics:** Focused first-profile cases prove recognized sink/type,
    selected entry variant, `RTS`/`RTI`, save/restore, decimal state, vector compatibility, domain-
    specific SFA homes, bounded stack, reentrancy rejection, and shared-state warnings.
26. [ ] **AC-26 — Compile-time functions:** Exact constants, aggregate/table returns, trigonometric
    goldens, acyclic calls, budget failures, forbidden effects/inputs, determinism, and zero target
    execution code/storage are proven.
27. [ ] **AC-27 — Placement and loadable semantics:** Every legal placement owner/constraint and
    conflict is proven; loadable values reject every invalid ordinary use and the resident profile
    reports transfer unavailability without a stub or emitted loader.
28. [ ] **AC-28 — Intrinsics and profile facts:** Full-pipeline cases prove dynamic byte/word
    memory access, query widths, encoding maps, compile-time selected-profile branches with zero
    unselected runtime code, BCD, each of the five approved CPU controls, exact effects/costs, and
    rejection of every removed opcode-shaped form and preprocessor substitute.
29. [ ] **AC-29 — Embed core:** Raw and qualified M1 SpritePad cases prove containment, identity,
    signature/version/selector/type/size validation, deduplication, provenance, failure suppression,
    symbolic placement, and no runtime parsing/copy.
30. [ ] **AC-30 — Representation payload:** Transition probes show every R4.37 fact present until
    its named consumer discharges it; no backend or emitter guesses source semantics.
31. [ ] **AC-31 — Complete roots and SFA:** Evidence enumerates all roots/edges/domains/homes,
    liveness/interference/alias/escape, overlays, ZP/stack, helper feedback, deterministic convergence,
    and final no-new-storage closure.
32. [ ] **AC-32 — No runtime:** Symbols/maps/bytes contain no heap, software stack, generic
    dispatcher, exception/safety service, array descriptor framework, asset parser/copier, or
    unselected helper.
33. [ ] **AC-33 — Legal `none` machine output:** Every semantic family reaches documented NMOS 6510
    operations, correct flags/addressing/branches/banking, verified ACME bytes, and correct VICE
    behavior without an optional optimizer.
34. [ ] **AC-34 — `none` boundary:** Seeded optional transforms remain absent while every mandatory
    correctness/selection/SFA/layout/emission step still runs and reports its decisions.
35. [ ] **AC-35 — Layout and artifacts:** Placement conflicts fail completely; successful builds
    atomically publish one coherent PRG and complete deterministic assembly/map/SFA/resource/cost/
    debug/hash evidence verified against ACME output.
36. [ ] **AC-36 — Independent behavior:** Deliberate defects in values, effect order, aliasing,
    aggregate contents, flags, checks, MMIO, interrupts, or return state fail their independent
    oracle even if generated assembly shape or another compiler path agrees.
37. [ ] **AC-37 — Expert output:** Each operation family has a complete equal-contract hand-written
    frontier; no generated result is worse, and every honest meet has an authorized issue with exact
    delta and RD-08 path to a win.
38. [ ] **AC-38 — Honest platform boundary:** Later C64 APIs/formats/loading and every future target
    fail as explicit unavailable/unknown capability rather than compiling, linking a stub, or
    appearing in a support score.
39. [ ] **AC-39 — CLI/LSP identity:** CLI and LSP return byte-for-byte-equivalent complete frontend
    diagnostics from the same snapshot, and direct boundary tests prove frontend/LSP do not import
    codegen, packaging, or emulator control.
40. [ ] **AC-40 — Impact-based closeout:** Evidence records focused family checks and one complete
    RD-04 boundary run; no repeated unrelated v3 readiness, broad game corpus, or wall-clock gate ran.
41. [ ] **AC-41 — C64U/portability seam:** Shared representations contain no C64 address/device
    assumptions and retain symbolic address-space, bank, transfer, DMA-effect, and clock ownership
    required by later target work without speculative packages.
42. [ ] **AC-42 — Deferral-expiry closeout:** The closeout answers whether RD-04 invalidated any
    deferral rationale in the ambiguity register, RD Won't Have sections, Specification 4 future
    considerations, expert records, or expressiveness ledger, and assigns every expired item before
    closure.

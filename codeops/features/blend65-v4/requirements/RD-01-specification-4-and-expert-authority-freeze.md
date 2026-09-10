# RD-01: Specification 4.0 and Expert Authority Freeze

> **Document**: RD-01-specification-4-and-expert-authority-freeze.md
> **Status**: Draft
> **Created**: 2026-09-10
> **Project**: Blend65 v4
> **Depends On**: —
> **Execution Prerequisite**: Mandatory Phase 0 worktree bootstrap (AR-005, AR-025)
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Blend65 v4 starts from one complete, internally consistent language authority rather than asking
the compiler implementation to reconcile historical documents while it is being built. This
requirement performs a single controlled transition from the frozen Specification 3 baseline to
Blend65 Language Specification 4.0. It incorporates every approved language change, removes false
target-support claims, re-runs the complete Language Guard, and freezes the resulting identity
before semantic compiler implementation begins.

The `blend65-domain-expert` skill is part of the same authority boundary. Its current `1.0.0`
release is governed by Specification 3. Specification 4 therefore produces a fully requalified
`2.0.0` expert baseline and activates it atomically as the only current version. Compiler code,
v3 tests, readiness artifacts, scoreboards, and feasibility snapshots remain audit evidence only;
none may define language or expert doctrine.

RD-01 executes only in the prepared `/home/gevik/workdir/github/blend65.ri/v4` worktree on
`feature/v4-rebuild`. The bootstrap records the exact final v3 source commit before creating that
branch and leaves the current checkout parked as v3 evidence. Authority files are never changed in
the parked worktree.

> **Decisions:** AR-004, AR-006, AR-014 through AR-020, AR-023, AR-024, AR-029 through AR-031,
> AR-034, AR-035, and AR-038 through AR-046.

---

## Functional Requirements

### Must Have

#### Authority transition — complexity L

- [ ] **R1.1 — Verify the bootstrap and record the input authorities.** Before editing the
  specification, verify that execution is in `/home/gevik/workdir/github/blend65.ri/v4` on
  `feature/v4-rebuild`, that the branch was created from the recorded exact final v3 source commit,
  and that the parked v3 worktree remains unchanged. Record that commit, Specification 3 content
  identity `BLEND65-SPEC-P3-4bf8a989`, expert-skill version `1.0.0`, expert content commit
  `a96cfd3c41a456d4d4f983021cf43535a1d5bdaa`, and every approved ambiguity-register decision
  consumed by the transition. Existing compiler behavior is not an input authority. (AR-004,
  AR-005, AR-014, AR-025, AR-038)
- [ ] **R1.2 — Produce one Specification 4.0 tree.** Update the existing `spec/` tree in one
  controlled change. Do not create a parallel live `spec-v4/`, retain a second active Specification
  3 tree, or publish implementation-only semantic overrides. Git history and the parked v3
  worktree preserve the earlier specification. (AR-014)
- [ ] **R1.3 — Publish a normative-document inventory.** Specification 4.0 must identify every
  normative chapter, grammar, evaluation, and target appendix. A file not named by that inventory
  cannot silently become language authority. Historical workflow, migration, preflight, or build
  notes must be removed from the active specification tree or labelled non-normative by the
  inventory. (AR-004, AR-014, AR-035)
- [ ] **R1.4 — Freeze a content-derived Specification 4 identity.** The completed normative corpus
  receives one deterministic content identity. Every normative chapter, evaluation, qualification
  artifact, and dependent release record must name that same identity before activation. (AR-014)

#### Complete semantic reconciliation — complexity XL

- [ ] **R1.5 — Preserve all unchanged language behavior.** Every Specification 3 behavior not
  explicitly changed by the approved transition remains defined in Specification 4. Omissions,
  contradictory summaries, stale examples, and silent changes are defects. A checked transition
  crosswalk must account for every prior normative path and every deliberate addition, change,
  move, or removal. (AR-014)
- [ ] **R1.6 — Apply the approved modern control-flow and integer rules.** Specification 4 must
  define the familiar three-clause `for` statement, increasing and decreasing iteration through
  ordinary expressions, deterministic fixed-width wrapping, rejection of a provably
  finite-looking loop whose explicitly typed counter must wrap before termination, and expert
  lowering freedom that does not change observable source values. It must remove obsolete range
  loop syntax and preserve ordinary side-effect and exit ordering. (AR-002, AR-003, AR-014)
- [ ] **R1.7 — Apply the complete fixed-array model.** All stored arrays remain fixed, contiguous
  values with extents and total object sizes in the 16-bit representable domain. Specification 4
  must define extent inference, parameter-only outer unsizing, stable `word` results for
  `length`, `sizeof`, and `offsetof`, rectangular row-major nested arrays, exact-shape value
  semantics, nested initializers, per-dimension bounds behavior, and direct-subscript ordinal
  promotion across every integer-producing operator. It must define explicit narrow barriers and
  reject dynamic arrays, jagged arrays, slices, spans, and views. (AR-016, AR-017)
- [ ] **R1.8 — Apply ordinary aggregate value semantics.** Fixed arrays and structs support
  assignment and return with exact type and extent compatibility. Parameters remain zero-copy
  mutable or `const` borrows. Returns use caller-owned storage, direct construction, and copy
  elision; required observable copies retain source-value semantics under aliasing and expose
  their cost. No heap, dynamic frame, mandatory runtime, or source-level copy helper is introduced.
  (AR-016)
- [ ] **R1.9 — Apply the complete addressable-place model.** `&` accepts every real storage place,
  including parameters, fields, indexed elements, and their compositions, evaluates place/index
  expressions once, and returns `word`. The specification must define lifetime and read-only
  provenance, legal contained use, local-address escape rejection, address arithmetic, and explicit
  one-past construction without adding pointer, reference, view, or slice types. (AR-015)
- [ ] **R1.10 — Apply finite typed function values.** Specification 4 must define exact
  `fn(...)` signatures for named ordinary functions, assignment/storage/passing/return/call rules,
  precise target provenance, signature mismatch, target-set merging, devirtualization freedom, and
  distinct non-callable interrupt-handler values accepted only by compatible platform sinks. When
  precise provenance is lost but the closed program remains finite, the callable set widens to
  every address-taken source function with the exact signature and that proved finite superset
  governs calls, effects, recursion, stack, interrupt, and SFA reasoning. Reject only a call for
  which no finite source target set can be proved, closures, captures, conversion from raw `word` to
  a callable, and hidden runtime registries or dispatchers. Each interrupt sink has a statically
  proved LIFO installation stack: restore matches the active top, control-flow joins agree, and
  repeated or nested installation is legal only with finite proved depth and balance. Only required
  predecessor words are allocated. A raw vector write remains legal low-level access but invalidates
  helper ownership, so a later helper restore is diagnosed; no runtime registry, token, ownership
  flag, scheduler, or hidden lifecycle service is introduced. (AR-018)
- [ ] **R1.11 — Apply deterministic compile-time functions.** `comptime function` must reuse the
  normal typed language over bounded compile-time state, permit direct calls and aggregate returns,
  and reject runtime state, MMIO, low-level intrinsics, indirect calls, recursion, arbitrary host
  input, and nondeterminism. `sin8`, `cos8`, `sin16`, and `cos16` must have normative phase,
  amplitude, extrema, symmetry, rounding, and byte-exact results. Exhausted execution or memory
  budgets produce deterministic source diagnostics and no partial target output. (AR-019)
- [ ] **R1.12 — Apply explicit placement and loadable-value syntax.** Specification 4 must define
  the closed `place(at, align, noCross, region)` declaration modifier and `loadable const` values.
  Placement constraints can strengthen but never weaken profile, visibility, banking, alignment,
  ownership, or reserved-range facts. A loadable value retains a fixed logical type and provenance
  but is not readable, indexable, addressable, mutable, or ordinarily passable until an explicit
  selected-profile load succeeds into a compatible mutable fixed destination. (AR-020, AR-029,
  AR-031)
- [ ] **R1.13 — Apply the finite low-level intrinsic surface.** The only opcode-shaped source
  operations are `asm_sei`, `asm_cli`, `asm_php`, `asm_plp`, and `asm_nop`, each with exact CPU,
  flag, stack, scheduling, optimizer, and selected-profile legality semantics. Variable-address
  `PEEK` and `POKE`, packed-BCD operations, target encodings, queries, and `embed()` remain typed
  semantic or platform operations rather than arbitrary assembly. Inline assembly, external
  assembly functions, hidden register state, and all other opcode calls are rejected. (AR-006)
- [ ] **R1.14 — Define optional safety behavior without a mandatory runtime.** Constant division by
  zero and statically invalid indexing remain compile-time errors. Runtime array-bounds and
  division-zero checks are separate explicit build options, disabled unless selected, and emit
  only the inline or selected-profile code whose exact effect and cost the specification defines.
  When checks are disabled, behavior follows the documented 6502/platform limitation; no hidden
  trap routine, exception system, heap, or general runtime is linked. (AR-002, AR-023)

#### Honest platform authority — complexity L

- [ ] **R1.15 — Make only C64 profiles normative.** The first Specification 4 target set contains
  the eight `c64-{pal|ntsc}-prg-{kernal|takeover}-{6581|8580}` identities plus
  `c64-pal-d64-kernal-6581`. Their CPU, video, startup, ROM/banking, IRQ ownership, SID topology,
  artifact, exit, loader, and evidence contracts must be exact. The first implementation profile
  remains `c64-pal-prg-kernal-6581`. The appendix may define narrow hardware operations and exact
  external adapters, but no game-engine, gameplay-module, or application-policy API. (AR-013,
  AR-024, AR-029, AR-032, AR-035, AR-038)
  Its native-asset baseline is exactly the approved SPD v5, CTM v9, PSID v1–v4 subset, classic
  Koala, and raw fallback contract. Koala Color RAM and background components preserve complete
  source bytes while identifying only their low nibbles as VIC-II color meaning; Specification 4
  removes the prior zero-high-nibble rejection. (AR-039 through AR-041)
  The D64 profile uses one optional, built-in, uncompressed KERNAL sequential loader. Its
  `SETLFS`/`SETNAM`/relocating-`LOAD` ABI, boot-device reuse, explicit application-route
  quiescence, direct destination write, success/failure publication, and exact D64/1541 format are
  normative. The compiler-produced D64 is trusted; `HLE-010` records that stock `LOAD` has no
  destination-length bound and therefore cannot contain a readable longer replacement before its
  returned end address is checked. (AR-042 through AR-044)
- [ ] **R1.16 — Remove false target authority.** `spec/appendix-c64u.md`,
  `spec/appendix-cx16.md`, `spec/appendix-a800xl.md`, and `spec/appendix-a7800.md` must not remain
  active normative Specification 4 documents. Git preserves their drafts. Concise future-target
  constraints may remain only when explicitly labelled non-normative and non-supporting.
  Specification 4 must reject unknown or planned target IDs rather than treating them as
  provisional backends. (AR-024, AR-035)
- [ ] **R1.17 — Keep portability pressure without false support.** Core language chapters cannot
  name C64 hardware as universal semantics. The Language Guard must require conformance on every
  qualified active target and a separate portability review against recorded future-target
  constraints. A future target becomes active only after expert evidence, a normative appendix, a
  real CPU/machine/emitter/packager path, full core-language requalification, emulator evidence,
  required hardware QA, and atomic authority activation. (AR-012, AR-024, AR-035)
- [ ] **R1.18 — Preserve the C64U successor boundary.** C64U remains the owned next target feature,
  with REU/DMA, turbo clocks, firmware, storage, SID topology, and packaging explicitly unqualified
  here. Running a C64 artifact on compatible Ultimate hardware cannot be reported as support for a
  `c64u` compiler target. (AR-024, AR-035)

#### Guard, diagnostics, and expert activation — complexity XL

- [ ] **R1.19 — Re-run the complete Language Guard.** Update the guard itself from its obsolete
  five-target/v3 wording, then evaluate every changed or added feature against all 23 rules. Each
  conditional or rejected case must contain its reason and authorized resolution. No failed rule
  may enter the normative corpus. (AR-014, AR-035)
- [ ] **R1.20 — Make misuse and limits diagnosable.** Every newly legal or rejected form must have
  an exact grammar rule, type/effect/storage behavior, positive example, boundary example,
  interaction coverage, and unique actionable diagnostic for each invalid class. The diagnostics
  registry and normative chapters must agree exactly, with no implementation-only error rule.
  Reserve E10267 for malformed supported-version public artifact evidence and E10268 only for an
  unsupported positive integer public artifact schema version. Their distinct messages and
  ownership follow RD-03's validation precedence and must enter the registry before any public
  sidecar producer specification test.
  (AR-002, AR-003, AR-014)
- [ ] **R1.21 — Publish expert baseline `2.0.0`.** Reconcile the expert router, every affected
  knowledge reference, source-governance record, qualification oracle, coverage matrix, and release
  record against the frozen Specification 4 identity. Correct current wording that presents
  sprite multiplexing, scrolling, buffering, fixed pools, collision, state dispatch, or other game
  algorithms as compiler-supplied systems or APIs: retain their expert knowledge and qualification
  value while making application policy explicitly user-authored. Correct any asset-pipeline text
  that promises a compiler-owned renderer, scene runtime, player scheduler, mixer, or game
  architecture: asset handlers stop at typed data, metadata, symbols, exact imported-player ABI,
  and placement/package facts. Integrator-style composition, conflict detection, mask generation,
  and representation construction are user-authored compile-time Blend65 workloads that the skill
  teaches and qualifies, not compiler-supplied scene operations. Typed hardware APIs remain general
  platform support. No active file may still claim baseline `1.0.0`, Specification 3 authority, or
  a Blend65 game-engine product surface after activation. Koala knowledge and its qualification
  cases must also implement the accepted exact-byte/low-nibble distinction for both Color RAM and
  background. Add primary source-governance records and qualification cases for the 1541 D64
  geometry/directory/BAM/data-chain contract, the selected C64 KERNAL loader ABI and resource
  effects, explicit application quiescence, and `HLE-010`; do not teach a general loader framework
  or claim containment against altered media. Record AR-045's exact optimizer-mode boundary and
  complete-cost policy. `none` is the deterministic correctness-only predefined direct lowering and
  runs every mandatory semantic, legalization, SFA, resource, layout, branch, emission, and package
  step without optional candidate enumeration, rewriting, B/R/T comparison, or expert-parity gate;
  its policy is reproducible under the recorded compiler identity and may improve in a later compiler
  version. Every optimized mode exhausts the same finite candidate frontier. `balanced` selects only
  a no-regression Pareto dominance result, `speed` orders `T` then `R` then `B`, and `size` orders `B`
  then `R` then `T`, followed only by stable ID for an exact complete-cost tie. `B` is logical
  compiler-generated target-loadable program/data bytes, `R` is the ordered selected-profile memory
  resource vector, and `T` is the comparable semantic-path cycle vector. D64 filesystem/container
  bytes are hard package-capacity and evidence facts, never B/R/T preference inputs. Preserve the
  prohibition on weights, hotness, PGO, and a tuning DSL. Add discriminating qualification cases
  for tradeoffs, downstream cost reversal, and hard-budget rejection. Freeze a deep, sourced optimization
  inventory that combines applicable modern target-neutral and whole-program techniques with
  NMOS 6510 and C64-specific instruction, resource, layout, banking, and peephole knowledge. For
  modern techniques, cover at least exact constant/range/known-bit propagation, CFG simplification,
  unreachable/dead-work removal, alias/effect-qualified value and memory reuse, interprocedural
  reachability/effects, finite-target devirtualization, specialization, inlining/outlining, tail
  calls, aggregate scalarization, copy elision, direct construction, canonical induction,
  loop-invariant motion, strength reduction, measured unrolling, and liveness/interference. Connect
  them explicitly to accumulator/register/flag/carry reuse, addressing modes, global ZP allocation,
  SFA, inline/helper/table selection, page and branch layout, banking, and structured peepholes. For
  each technique family, record applicability, preserved semantic facts, 6502/C64 interaction,
  smallest counterexample, complete cost terms, behavior oracle, assembly/cost oracle, and
  qualification expectations. Record frontier exhaustion, fixed-point proof, structured
  cost-selected peepholes, bounded exact-search conditions, and frontier-optimal terminology.
  Import algorithms and proof ideas, not another compiler's architecture, implementation, target
  assumptions, broad pass catalog, or framework. (AR-014, AR-023, AR-034, AR-038 through AR-046)
- [ ] **R1.22 — Requalify according to blast radius.** Every pre-existing expert qualification
  case and every new AR-046 case must retain admissible green evidence under the `2.0.0` candidate;
  no existing case may disappear merely to keep a fixed total count. Use deterministic
  structural/source/oracle checks, one complete isolated blind coverage sample, focused reruns for
  each corrected case and dependency-traced regression, and independent review of the correction
  and its blast radius. Do not require a lucky simultaneous 107-answer transcript and do not
  invalidate unrelated evidence for an evaluator-only omission. (AR-014, AR-034, AR-046)
- [ ] **R1.23 — Activate atomically and freeze.** The candidate becomes active only after the
  specification crosswalk, Language Guard, all required expert evidence, independent review, links,
  topology, source keys, content hashes, and release record pass together. The release record binds
  `2.0.0` to its exact content commit and Specification 4 identity. Only one release is active;
  earlier versions remain in Git history. (AR-014, AR-034)
- [ ] **R1.24 — Obtain explicit authority approval.** Present the complete Specification 4 change
  summary, guard results, expert qualification evidence, removed target claims, remaining future
  constraints, and exact identities to the user before activation. Approval of this RD does not
  pre-approve an incomplete or materially different resulting specification. (AR-014, AR-035)
- [ ] **R1.25 — Freeze before compiler semantics.** After activation, record the exact normative
  file set and hashes. No semantic compiler implementation may begin against a moving specification
  or skill. Any later substantive authority change requires a new semantic version,
  affected/dependent qualification, independent review, user approval, and atomic activation.
  (AR-014, AR-034)

### Should Have

- [ ] **R1.26 — Human-readable transition summary — complexity S.** Provide a concise table of
  Specification 3 behavior retained, Specification 4 behavior changed, and behavior removed, with
  links to the normative clauses and ambiguity decisions. This summary is navigation, not a second
  source of semantics. (AR-014)
- [ ] **R1.27 — Representative modern game examples — complexity M.** Each changed language area
  should include at least one example recognizable to a modern C/TypeScript/JavaScript developer
  and one C64 game-oriented example. Examples must illustrate normative behavior without teaching
  unnecessary hardware lore. (AR-003, AR-014)

### Won't Have (Out of Scope)

- Compiler, lexer, parser, analyzer, SFA, lowering, code-generation, optimizer, assembler,
  packager, CLI, LSP, or VS Code implementation changes — RD-02 and later own implementation.
- Compiler, ACME, VICE, readiness, game-corpus, or emulator test execution — this RD changes only
  specification, expert knowledge, and their direct qualification evidence.
- A second active specification tree or multiple active expert-skill releases. (AR-014, AR-034)
- V3 compatibility, migration tooling, or preservation of obsolete v2/v3 workflow documents in the
  active authority tree. (AR-004)
- Normative C64U, X16, Atari 800XL, or Atari 7800 target profiles. (AR-035)
- A public target plugin framework, speculative target packages, or generalized target machinery.
  (AR-012, AR-024)
- New language features beyond the approved Specification 4 transition. A newly discovered
  material semantic choice reopens the ambiguity gate before it enters the specification.

---

## Technical Requirements

### Authority precedence — complexity M

For this transition, conflicts resolve in this order:

1. Explicit user decisions in the Blend65 v4 ambiguity register.
2. Explicit product decisions and durable semantic corrections already qualified by the active
   expert baseline.
3. Primary CPU, C64 hardware, ACME, VICE, and native-format evidence for their respective factual
   domains.
4. Unchanged normative Specification 3 behavior.
5. Existing compiler code and tests as audit evidence only.

No feasibility matrix, readiness result, scoreboard ratio, package topology, or historical
implementation restriction can override the first four authorities. (AR-004, AR-014)

### Required transition crosswalk — complexity L

The checked crosswalk must contain one row for every normative Specification 3 file and every
Specification 4 addition. Each row records:

| Field | Required content |
|---|---|
| Prior path and identity | Exact Specification 3 source path and content identity, or `new` |
| Authority role | Normative chapter, grammar, evaluation, C64 appendix, or non-normative future constraint |
| Disposition | Retained, changed, split, merged, added, or removed |
| Governing decisions | Every applicable `AR-*` and prequalified semantic ruling |
| Specification 4 destination | Exact normative destination path and section |
| Semantics | Concise statement of preserved or changed observable behavior |
| Compiler obligations | Parser, typing, effects, SFA, lowering, target, diagnostics, and evidence consumers affected |
| Guard evidence | All applicable Language Guard rules and their results |
| Skill impact | Router/reference/oracle cases affected and dependency closure |

A count-only inventory is insufficient. The crosswalk must expose conflicting summaries, stale
examples, missing diagnostics, and old target claims before activation. (AR-014, AR-035)

### Normative Specification 4 structure — complexity M

- Core chapters define language meaning without C64 addresses, chip names, or machine-specific
  startup behavior.
- `grammar.ebnf.md` is the one formal grammar authority and agrees with every syntax example.
- Feature evaluations explain guard decisions but cannot contradict their normative chapter.
- `appendix-c64.md` owns exact C64 profile facts and profile-library contracts.
- `future-considerations.md` may name C64U and other target constraints only as non-normative,
  non-supporting reconsideration triggers.
- Old build plans, preflight reports, and v2/v3 migration notes are Git history, not active
  Specification 4 authority.

The normative inventory must make these roles machine-checkable through exact paths and identities;
it must not introduce a documentation generator or a second schema when a direct checked table is
sufficient. (AR-014, AR-035)

### Language Guard revision — complexity M

The 23 guard rules remain the feature-admission framework, but their platform clauses must stop
claiming unqualified targets. In particular:

- cross-platform compilation and runtime verification apply to every qualified active target;
- core-language platform neutrality and 6502 feasibility remain mandatory;
- future-target review records pressure and unknowns without passing them as implementations;
- target-specific language/library behavior belongs in its normative target appendix;
- a future target must re-run the complete guard before joining the active set; and
- a failed or conditional rule cannot be hidden by compiler difficulty or SFA convenience.

The guard version and every evaluation must identify Specification 4.0. (AR-003, AR-014, AR-035)

### Expert-skill `2.0.0` activation — complexity XL

The candidate update must follow the existing single-active-release policy:

1. Build against the frozen candidate Specification 4 identity.
2. Update the router and only the knowledge required by changed authority.
3. Reconcile source provenance and remove stale target-support claims.
4. Update affected oracles and dependency traces without weakening an expectation.
5. Establish green evidence for all 107 cases under the accepted composed-evidence method.
6. Complete independent changed-surface and blast-radius review.
7. Validate exact router/reference/qualification topology, links, anchors, source keys, and hashes.
8. Commit the qualified content, then bind its commit and Specification identity in the sole active
   release record as bookkeeping that does not recursively bump the version.
9. Atomically expose `2.0.0` as the only active baseline.

Qualification may use language-model evaluation where the existing cases require it, but it must
not launch the Blend65 compiler, ACME, VICE, readiness workflows, or unrelated repository tests.
(AR-014, AR-034)

### Freeze and change control — complexity M

The closeout record must contain:

- Specification 4 version and content identity;
- normative file manifest and hashes;
- expert skill version `2.0.0`, content commit, router hash, reference hashes, qualification hashes,
  and release-record hash;
- Language Guard result and changed-feature evaluation list;
- the complete transition and qualification crosswalks;
- unresolved findings, which must be zero at activation;
- explicitly non-normative future-target constraints; and
- the user approval that authorized activation.

After this closeout, `spec/` is frozen during compiler implementation. A discovered compiler
discrepancy is repaired in the compiler or registered as conformance debt; it does not silently
change the language or teach implementation behavior to the expert skill. (AR-004, AR-014)

---

## Integration Points

### With RD-02 (Clean V4 Foundation and Deterministic Project Model)

RD-02 continues in the same prepared v4 worktree only after this RD publishes the frozen
Specification 4 and expert `2.0.0` identities. Its salvage inventory judges every candidate against
those identities; RD-02 does not create or relocate the worktree.

### With RD-03 through RD-10

Every later requirement, plan, audit, diagnostic, specification test, build record, and release
claim must record the frozen Specification 4 and expert `2.0.0` identities. Later compiler work
cannot reinterpret an RD-01 semantic decision to fit an implementation.

### With blend65-c64u/RD-01

This RD retains C64U architecture pressure and hands a future normative-target activation process
to the separately owned C64U feature. It supplies no C64U target-support claim. (AR-024, AR-035)

---

## Non-Functional Requirements

### Determinism — complexity M

- Re-running inventory, identity, topology, link, anchor, source-key, and hash checks on unchanged
  inputs produces byte-identical results.
- Normative identity cannot depend on filesystem enumeration order, locale, timestamps, or model
  wording.
- Language-model qualification evidence is bounded by the accepted composed-evidence method;
  deterministic structural and oracle checks remain authoritative for their domains.

### Maintainability — complexity M

- Each observable rule has one normative owner and all summaries link to it.
- The transition adds no documentation framework, generated policy engine, second specification
  schema, or replacement readiness harness.
- A future target can join through the documented activation gate without changing core-language
  meaning merely to accommodate that target.

### Resource use — complexity S

- Verification is limited to specification, source-governance, skill-topology, qualification, and
  direct formatting/link checks.
- Unaffected model-evaluation cases are not repeatedly rerun after evaluator-only omissions.
- No compiler, assembler, emulator, or readiness suite runs for this documentation/skill-only RD.

---

## Security Considerations

- **Data sensitivity:** No credentials, personal data, or regulated data are handled.
- **Input validation:** Qualification scripts must treat Markdown, paths, anchors, source keys, and
  model output as untrusted text and validate them against contained, explicit inventories.
- **Authentication and authorization:** N/A; this RD adds no network or multi-user service.
- **Injection risks:** Validation must not evaluate repository text as shell code. Paths passed to
  local tools must be canonical, contained, and passed as arguments rather than interpolated shell
  programs.
- **Encryption:** N/A; there is no secret or network data.
- **Rate limiting:** N/A; there are no public endpoints.
- **Infrastructure:** No service, container, CI expansion, remote package source, or new external
  dependency is required.

---

## Scope Decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Specification authority | One updated tree / parallel v3+v4 trees / implementation overrides | One updated Specification 4 tree | Prevents authority drift; Git preserves v3. | AR-014 |
| Expert release identity | `2.0.0` / `1.1.0` / `1.0.1` | `2.0.0` | Replacing the governing language authority is a breaking expert-baseline change. | AR-034 |
| Normative targets | Qualified C64 only / all five historical targets / provisional appendices in active spec | Qualified C64 profiles only | Matches authority to evidence without weakening target-neutral architecture. | AR-035 |
| Product boundary | Reusable game systems / compiler with game-workload qualification | Compiler and narrow platform library | Retains expert game knowledge without turning Blend65 into an engine or gameplay library. | AR-038 |
| Optimizer knowledge | 6502 tricks only / imported modern framework / combined qualified knowledge | Deep modern-plus-6502 inventory with no imported framework | Gives the compiler modern whole-program leverage while keeping every choice grounded in exact 6502/C64 semantics and costs. | AR-046 |
| Low-level source surface | Five curated controls / external assembly / arbitrary opcode calls | Five curated controls | Stable complete semantics with no external ABI or hidden register state. | AR-006 |
| Arrays and aggregates | Historical restrictions / fixed modern values / dynamic runtime model | Fixed modern values | Modern source behavior without heap or dynamic frames. | AR-016, AR-017 |
| Function values | Recognized sinks only / finite typed values / raw calls | Finite typed values | Expressive bounded calls compatible with whole-program SFA proof. | AR-018 |
| Compile-time generation | External tools only / second DSL / typed compile-time functions | Typed compile-time functions | Reuses one language and emits no runtime code. | AR-019 |
| Placement | Automatic only / general attributes / closed expert modifier | Automatic plus closed `place(...)` | Keeps normal use simple and expert constraints explicit without a framework. | AR-020 |
| Nonresident assets | Resident only / explicit typed load units / hidden runtime assets | Explicit `loadable const` | Makes residency truthful and loading visible without heap or hidden runtime. | AR-029, AR-031 |

---

## Acceptance Criteria

1. [ ] **AC-01 — Bootstrap and input identity:** The transition record proves that RD-01 ran in
   `/home/gevik/workdir/github/blend65.ri/v4` on `feature/v4-rebuild`, names the branch's exact final
   v3 source commit, confirms that the parked v3 worktree remained unchanged, and names the exact
   Specification 3 identity, expert `1.0.0` identity/content commit, and complete resolved Blend65
   v4 ambiguity register from AR-001 through AR-048; no compiler implementation or v3 test is
   listed as authority.
2. [ ] **AC-02 — Single spec:** Exactly one active language specification exists under `spec/`, its
   public version is `4.0`, and no active `spec-v4/` or duplicate Specification 3 tree exists.
3. [ ] **AC-03 — Normative inventory:** One checked normative inventory resolves every normative
   chapter, grammar, evaluation, and C64 appendix path; every other retained file is explicitly
   non-normative.
4. [ ] **AC-04 — Complete crosswalk:** Every prior normative Specification 3 path and every new
   Specification 4 path has exactly one transition-crosswalk row with disposition, authority,
   semantics, consumers, guard result, and skill impact.
5. [ ] **AC-05 — No stale identity:** Searching active normative and expert-skill files finds no
   claim that the active language is Specification 3, that the active expert baseline is `1.0.0`,
   or that v4 supports five target families.
6. [ ] **AC-06 — Grammar agreement:** Every Specification 4 syntax form has one production in
   `grammar.ebnf.md`; every normative positive example parses under that grammar, and every
   normative invalid syntax example is rejected by the grammar validator.
7. [ ] **AC-07 — Modern loop contract:** The normative statement and grammar define one ordinary
   three-clause `for` form; old range-loop syntax is absent; evaluation ordering, `continue`,
   `break`, return, wrap, and provably unreachable finite termination are covered by positive and
   negative examples.
8. [ ] **AC-08 — Complete array contract:** Normative examples cover fixed extents below, at, and
   above 255; byte and word index variables; `arr[i + 10]` selecting element 265 when `i` is byte
   255; explicit byte narrowing selecting element 9; nested row-major arrays; outer-unsized
   parameters; exact-shape copy/return; and rejection of dynamic/jagged/view forms.
9. [ ] **AC-09 — Aggregate/address contract:** Examples cover struct and fixed-array assignment and
   return, caller-owned return storage, alias-safe copies, addresses of parameters/fields/elements,
   single evaluation, const provenance, contained local use, and every prohibited escape.
10. [ ] **AC-10 — Function-value and handler-lifecycle contract:** Examples cover singleton
    devirtualization eligibility, precise and widened multi-target finite sets, stored and returned
    function values, signature mismatch, handler-kind mismatch, target erasure to `word`, rejection
    of raw-word calls and genuinely unbounded targets, per-sink balanced LIFO install/restore,
    control-flow joins, bounded nesting and predecessor-word cost, and diagnosis of helper restore
    after a raw vector write invalidates ownership.
11. [ ] **AC-11 — Compile-time contract:** The specification defines exact results for every input
    to `sin8` and `cos8`, a reproducible exact rule plus boundary vectors for `sin16` and `cos16`,
    and deterministic diagnostics for forbidden effects and exhausted budgets.
12. [ ] **AC-12 — Placement/loadable contract:** Positive and negative examples cover every
    `place(...)` key, combined constraints, illegal target, collision, unsatisfied region,
    `loadable const` compile-time use, illegal direct reads/addressing, compatible destination,
    successful publication, and failed-load unspecified destination.
13. [ ] **AC-13 — Intrinsic contract:** The normative intrinsic inventory contains exactly the five
    admitted `asm_*` names. Every other opcode-shaped source name, inline assembly block, and
    external assembly function is rejected, while `POKE(variableAddress, value)` remains legal and
    volatile-ordered.
14. [ ] **AC-14 — Safety contract:** Constant invalid division/indexing is rejected. Checked runtime
    bounds and division behavior and unchecked hardware-limited behavior are each defined with
    exact effects and costs, and no hidden trap/runtime routine is mandatory.
15. [ ] **AC-15 — C64 target set:** The normative target inventory contains exactly the eight
    approved PRG profile identities and `c64-pal-d64-kernal-6581`; the first profile's PAL,
    KERNAL, BASIC-return, banking, CINV, 6510, and 6581 facts agree across all owners. Its public
    modules contain only target hardware operations and exact external adapters, not gameplay
    algorithms or engine policy. Its native-asset inventory contains exactly AR-040's initial
    formats, and its Koala contract accepts and preserves nonzero high nibbles in Color RAM and
    background while exposing only low-nibble hardware meaning. Its D64 profile defines the exact
    KERNAL sequential-load, explicit-quiescence, trusted-media, and standard 35-track D64 contracts,
    including `HLE-010`. (AR-038 through AR-044)
16. [ ] **AC-16 — False targets removed:** The four historical non-C64 appendix paths are absent
    from the normative inventory and cannot be selected as active target IDs. Any retained C64U,
    X16, or Atari text explicitly says non-normative, unqualified, and not compiler support.
17. [ ] **AC-17 — Guard result:** All 23 Language Guard rules have a recorded result for every
    changed feature; no result is failed, every conditional result names its authorized condition,
    and the guard targets every qualified active profile rather than the historical five-platform
    list.
18. [ ] **AC-18 — Diagnostic integrity:** Every new invalid class has one unique documented error
    code, message template, triggering example, correction, and normative owner; a registry-to-spec
    check reports zero missing, duplicate, dead, or conflicting entries.
19. [ ] **AC-19 — Expert version, product boundary, and optimizer knowledge:** Every active
    router/reference/qualification file identifies expert baseline `2.0.0` and the same frozen
    Specification 4 identity. Technique knowledge and Q-P workloads remain available, but no active
    text presents game algorithms, modules, renderers, scheduling, or policies as a Blend65
    engine/library deliverable. Asset guidance ends at compile-time ingestion, conversion, typed
    data/metadata/symbols, exact external ABI, and placement/package facts; runtime consumers are
    user-authored Blend65 programs. The active optimization reference contains the combined
    modern-plus-6502 inventory, the correctness-only `none` boundary, the identical optimized-mode
    frontier, exact `balanced`, `speed` (`T`/`R`/`B`), and `size` (`B`/`R`/`T`) order, logical
    target-byte `B` definition with D64 container overhead excluded, and complete
    admission/proof/cost fields required by R1.21 without importing a general optimizer framework or
    another compiler's target assumptions. (AR-038, AR-046)
20. [ ] **AC-20 — Qualification coverage:** The coverage matrix accounts for all 107 pre-existing
    unique case identities plus every newly approved AR-046 case, with all required fields and
    admissible green evidence under the `2.0.0` candidate according to the accepted composed-
    evidence rule. No existing identity is silently removed to preserve an arbitrary case count.
21. [ ] **AC-21 — Qualification independence:** Independent changed-surface and blast-radius review
    reports zero unresolved critical or major knowledge, oracle, authority, or coverage defects.
22. [ ] **AC-22 — Atomic release:** The sole active release record binds expert `2.0.0`, its exact
    qualified content commit, router/reference/qualification hashes, and Specification 4 identity;
    no second release record is active.
23. [ ] **AC-23 — Direct verification only:** Formatting, links, anchors, topology, source keys,
    hashes, crosswalks, guard evaluations, and relevant skill qualification pass. The recorded
    command log contains no Blend65 compiler, ACME, VICE, readiness, emulator, or unrelated
    repository test command.
24. [ ] **AC-24 — Explicit activation approval:** The user receives the complete change summary and
    evidence named by R1.24 and explicitly approves activation before the release record becomes
    active.
25. [ ] **AC-25 — Freeze proof:** The closeout records the exact normative and skill hashes, and
    `spec/` remains unchanged when RD-02 begins. A later compiler discrepancy is recorded as
    implementation/conformance debt rather than silently changing the frozen authority.
26. [ ] **AC-26 — Deferral-expiry closeout:** The RD closeout answers whether its deliverables expire
    any reason recorded in the v4 ambiguity register, Specification 3 future considerations, or
    expert-skill deferrals. Every expired deferral is reopened with a named owner before RD-01 may
    close.
27. [ ] **AC-27 — Clean non-code boundary:** The RD implementation changes only specification,
    expert-skill, qualification, direct authority records, and their CodeOps documentation. No
    compiler package, generated binary, asset, emulator artifact, or readiness framework is added
    or modified.

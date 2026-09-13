# Blend65 Semantics Crosswalk

> **Baseline version**: `2.0.0`. This module routes decisions to the reconciled specification;
> it does not replace it.
>
> **Current source identity**:
> `BLEND65-SPEC-4-5c6bac04a56b91d7d55ff570fbbf0dde5f521e2edce8901279dfa39a32c7acfa`,
> derived from the 18 normative files in `spec/00-normative-inventory.md`. The complete
> Specification 4 tree has 45 Markdown files: 18 normative and 27 non-normative. Any specification
> edit invalidates this binding.
>
> **Historical Specification 3 candidate identities (not current authority)**:
> `BLEND65-SPEC-P3-3b90e498`, exact digest
> `3b90e49806f027e8bdd2e8e6b948e685a4776319fe8301fc9f0032f1dcd9ceee`, passed the initial
> summary reconciliation but still contained several invalid source/proof examples and
> instruction-cost totals that omitted displayed work. The first repair wave produced
> `BLEND65-SPEC-P3-cab87cad`, exact digest
> `cab87cad0e7ed7455e8181b72f214553a8483792e0562989fc376bf335869979`; the independent full
> impact scan then found the remaining operator, conditional, switch, and loop-cost copies.
> `BLEND65-SPEC-P3-ae75170a`, exact digest
> `ae75170ab4bbc99e7f36e28ffc68e0fe94e570005179a20b3772bd59be12463c`, closed those cost
> findings but still used reserved intrinsic names as variables in one F014 codegen example.
> `BLEND65-SPEC-P3-e1e966c6`, exact digest
> `e1e966c609e093c5d2b6da9ee59a14d912ed4f53d470706a9c1eeabcb7c2d2db`, fixed that source but
> its full impact scan exposed remaining page-cross assumptions, accounting-boundary ambiguity,
> selected-lowering drift, one severity word, and obsolete range-history wording. SC-141..SC-143
> produced `BLEND65-SPEC-P3-be2b9701`, exact digest
> `be2b970177a057fd98a4a183cc98134836e541cea8804399546f19c7cae59475`. A final local boundary
> scan then removed the last context-free logical-cost total and clarified three F017
> instruction-core comments without changing semantics, producing `BLEND65-SPEC-P3-695dd174`,
> exact digest `695dd1747c175a73dc6d5ac5764c7e76bed4930a0683d7e68dfd3e4f2deb1d6b`.
> Independent correctness review invalidated it after finding an unsupported byte-typed
> `offsetof()`, undefined aggregate limits, and inconsistent index-operator coverage. The first
> repair identity, `BLEND65-SPEC-P3-818daab3`, exact digest
> `818daab37128de27b3b55355d5f3b0b6ce6f07c0864a989786ef2e40f3fcfa69`, still used an
> out-of-bounds shift example and did not give E10264 a total non-integer predicate. SC-144..SC-145
> closed those findings in `BLEND65-SPEC-P3-3c0560fd`; the later final-impact scan invalidated that
> identity on derived cost, example, diagnostic-ownership, and grammar-routing defects. SC-146
> closed that broad non-product repair wave in `BLEND65-SPEC-P3-96d1cf19`, exact digest
> `96d1cf19ceb5e4eefb7fc2f8bc4aba00652af8959aced8129ba859f164fc6232`. Its broad impact
> evaluation passed, but the focused Q-L19 evaluator found that the examples did not explicitly
> diagnose ordinal 510 against a 500-element array. SC-147 adds that missing E10240 example in the
> current identity without changing product behavior. No historical candidate may be relabelled as
> the final Phase-3 source.
>
> **Previous warning-corrected candidate identity (invalidated)**: `BLEND65-SPEC-P3-8d6ac46d`, exact
> 50-path digest
> `8d6ac46dd5861327d79a52f745ea582e543801c27244769a514fff89d191b318`. It contained the final
> language model and an initial cost correction, but the closeout scan found one F016 summary sentence
> that described only assignment while the governing W10160/W10161 trigger also covers argument,
> return, and explicit widening contexts. SC-140 aligned that summary and produced the later
> `3b90e498` candidate.
>
> **Previous query-width candidate identity (invalidated)**: `BLEND65-SPEC-P3-54812089`, exact
> 50-path digest
> `548120898322de07b286c5c24cca37aa94e337e54bf24b2d0817216785e29082`. It contained the final
> language model, but the closeout cost scan found one incomplete F020 dynamic-address `poke()`
> total. SC-139 corrected that documentation-only cost and produced `BLEND65-SPEC-P3-8d6ac46d`.
>
> **Previous no-view candidate identity (invalidated)**: `BLEND65-SPEC-P3-1a5f2882`, exact
> 50-path digest
> `1a5f2882f035e234aba2011ee8e6ac77deda3c542d421e373cc60334e17f2544`. It contained the
> final array/index/loop model, but final representation-leak review found one stale F020 rule that
> made `sizeof()` return type depend on whether the value crossed 255. AR-P39/SC-138 reconciled that
> derived-document defect and produced `BLEND65-SPEC-P3-54812089`.
>
> **Previous candidate identity (invalidated)**: `BLEND65-SPEC-P3-0565e5fd`, exact 50-path digest
> `0565e5fd178a5e0fe6d5eefd86f4c4b7b54286c942dd48d73da181cdf1f68235`. It bound rulings
> through AR-P34/SC-133, but AR-P35–AR-P38 changed array parameters, indexing, loop reachability,
> and the diagnostic inventory. Its Q-L19 result is historical and must not govern the final
> contract.
>
> **Earlier evaluated source identity (invalidated)**: `BLEND65-SPEC-P3-3344394e`, exact 50-path
> digest `3344394e69e10c9e9ba6674f2773f514a8634438fe86f5efb3d0db49b4846c27`. It passed the
> comprehensive content evaluation, but final correctness review found that the parser-note
> cross-reference named §5.6 instead of the actual §5.5. Correcting that non-semantic navigation
> defect produced the later `0565e5fd` identity. Earlier
> identities include `BLEND65-SPEC-P3-001b1331`, exact digest
> `001b13316eb9925980a36fb3ac6c793b8e4abede01fe134f8458c2ab10b717b3`. Strict re-review
> invalidated `BLEND65-SPEC-P3-9ea60a68`; the comprehensive evaluator then invalidated the
> intermediate `BLEND65-SPEC-P3-6a3f90a1`; the focused Q-L29 correction rerun invalidated
> `BLEND65-SPEC-P3-9a1d4f5a`; final correction evaluation then invalidated
> `BLEND65-SPEC-P3-4e17c2bc` and clean Q-L01 evaluation invalidated
> `BLEND65-SPEC-P3-bbefb347`; final Q-L27 evaluation invalidated
> `BLEND65-SPEC-P3-36111ca9`; deep all-file evaluation invalidated
> `BLEND65-SPEC-P3-265f1ced`; focused final regression invalidated
> `BLEND65-SPEC-P3-409235f9`. The subsequent deep rescan and specification repairs through SC-133
> invalidated `P3-001b1331` and produced the later `0565e5fd` candidate above.

## Authority and Use

Read every governing source row before deciding language behavior. The inventory-marked normative
chapters and grammar are current authority. Evaluations explain intent and rejected choices but
cannot override a normative chapter. The feature index is navigation only. Future considerations
record non-normative reconsideration triggers, not current behavior. Specification 3 build,
preflight, target-appendix, and migration files were removed from the active corpus.

Track two independent axes:

1. **Current behavior determined** — a governing chapter or accepted ruling gives one answer.
2. **Release consistency ready** — every derived, rationale, index, grammar, and registry copy agrees
   with that answer.

A subordinate-document mismatch can leave current behavior determined while still blocking release
consistency. Specification 4 froze only after its semantic-diff review found no unexplained change.
Any genuine contradiction returns the affected field to
`blocked-conflict`: cite both
sides and exclude only that field until an explicit product ruling and specification repair are
complete. Do not choose from convenience. Existing compiler code, tests, examples, readiness
artifacts, generated assembly, and feasibility matrices are observations about an implementation;
none can settle language semantics.

For every language decision:

1. locate all governing rows below and read their cited sections;
2. separate normative behavior, rationale, target feasibility, and current implementation state;
3. trace types, evaluation order, observable effects, storage lifetime, and diagnostic ownership;
4. preserve each required distinction until the compiler stage responsible for it can act; and
5. classify an implementation-only restriction as a compiler defect, not a language rule.

Blend65 source must behave like a normal modern language unless a deliberate specification rule is
forced by the selected platform. Dynamic addresses, nested calls, ordinary expressions, and
left-to-right effects require correct lowering. Making the user manually unroll operations, expose a
temporary, or understand a VIC/SID storage rule merely because the compiler lacks a lowering is not
an acceptable remedy. See [Compiler Architecture](compiler-architecture.md#restriction-triage) and
[SFA and ABI](sfa-and-abi.md#modern-source-and-static-storage).

## Semantic Preservation Checklist

| Concern | Information that must survive | Earliest accountable consumer |
|---|---|---|
| Tokens and syntax | exact spans, literal spelling/value, contextual role, recovery boundaries | parser and diagnostic producer |
| Types | width, signedness, nominal identity, aggregate shape, constness, conversion kind | semantic analysis; retained through legalization when machine choice depends on it |
| Expressions | precedence, left-to-right order, short-circuit edges, selected conditional arm, lvalue/place identity | semantic IR and control-flow lowering |
| Arithmetic | intermediate width, deterministic wrap, signed comparison/shift/division meaning, constant-versus-runtime rules | constant evaluator and target legalization |
| Memory effects | read/write identity, width, address computation, alias/escape, volatility, access count and order | memory-aware optimization and selection |
| Calls | callee identity/escape class, argument order and homes, return ownership, effects, clobbers | call lowering, SFA, and ABI binding |
| Storage | lifetime, address-taken state, storage class, alignment, placement, bank/visibility constraints | SFA for function storage; platform layout for globals/assets |
| Control and interrupts | reachability, for-clause order/effects/exits, switch semantics, entry-root identity, preemption/nesting contract | CFG construction, SFA interference, machine lowering |
| Diagnostics | root code, primary span, notes, recovery state, artifact-suppression decision | owning frontend stage and compilation driver |
| Target/artifact | selected CPU/platform capabilities, encoding, output format, startup, resource reservations | declarative target profile, backend, emitter, packager |

## Crosswalk

The table contains exactly one row for every live `spec/**/*.md` file. `N/A rationale` says why a
file does or does not add compiler/runtime guidance; it is never an excuse to omit the file.

### Complete crosswalk-audit gate

A complete audit first proves set equality against the supplied `spec/**/*.md` inventory. It then
reports, for every path, its authority role, one substantive payload, one compiler/storage/effect
consequence, one interaction or failure boundary, the correct expert branch, and a per-path reason
for each genuinely inapplicable facet. Cite the raw `spec/<path>#<heading>` or supplied line
location; a citation only to this crosswalk cannot prove that the crosswalk represented its source
correctly.

Do not sample or summarize these high-risk seams away:

- inspect every open or resolved `FUT-NNN` entry and its reconsideration reason rather than
  trusting an aggregate count;
- preserve the exact W10190 function-local read-path scope and the independent W10141 nonzero
  uninitialized-array scope;
- charge SFA frames and optional stack-free return homes per allocated activation, including
  bounded overlapping homes and entry variants;
- preserve address provenance and lifetime for parameters, fields, and indexed elements without
  reviving retired manual-address restrictions;
- include C64 HLE disclosures, including HLE-010, instead of treating them as incidental prose;
- keep F001 to supplied source files, one output binary, path-name irrelevance, and module-based
  cross-file references; explicitly leave input discovery, module-to-file mapping,
  duplicate-module policy, and diagnostic stability unspecified there; and
- distinguish all nine complete qualified C64 profile IDs and reject shorthand, partial, or
  unqualified IDs with E10279.

When the packet also supplies a project-policy overlay, report it separately from language
authority. The current pinned overlay selects ACME 0.97 and requires an already-authorized GitHub
debt issue whenever generated code can only meet rather than beat the expert result. Neither fact
may be inferred from the language specification alone.

Before declaring a complete-inventory audit green, emit a separate closure entry for every bullet
above. In particular, name direct addressability and retained caller-object lifetime for a field or
element reached through an aggregate parameter. Also name the C64 default:
unchecked indexing, modulo-65536 effective addresses, byte-by-byte `$FFFF` to `$0000` continuation
under the active memory map, and explicit default-off bounds checks. A path row that merely says
“HLE” or cites the wrong line is shallow; keep the audit open until the exact raw location supports
the claim.

| Exact path | Normative status | Relevant semantic concerns | Pipeline obligations | Expert module links | N/A rationale |
|---|---|---|---|---|---|
| `spec/00-normative-inventory.md` | Non-normative identity owner | exact normative/non-normative membership, digest algorithm, Specification 4 identity | verify membership and digest before using the corpus; never treat the inventory as language semantics | [Authority](#authority-and-use) | No direct compiler guidance — it proves which files own current authority |
| `spec/00-feature-index.md` | Non-normative discovery index | axioms, feature ownership, feature-to-chapter routing and discovery of live `FUT-NNN` entries without a duplicated endpoint | use as a navigation surface; preserve owning chapter meaning | [Authority](#authority-and-use); [Diagnostics](#diagnostic-doctrine) | None — adds navigation guidance, but not independent semantics |
| `spec/00-introduction.md` | Normative design axioms | modern C-like source, SFA, no undefined behavior, explicitness, C64-only qualified-target scope | reject silent corruption and target leakage; retain deterministic behavior | [Semantic preservation](#semantic-preservation-checklist); [SFA safety](sfa-and-abi.md#interference-and-reentrancy) | None — supplies project-wide language invariants, including the bounded hardware-exception policy |
| `spec/01-lexical-structure.md` | Normative chapter | UTF-8, case, comments, identifiers, keywords, literals, closed escape spellings, maximal munch, spans | exact token kind/value/span; preserve symbolic escapes for semantic encoding; lexer recovery without target knowledge | [Frontend boundary](compiler-architecture.md#target-neutral-front-end) | None — directly governs lexing and lexical diagnostics but does not choose target byte mappings |
| `spec/02-type-system.md` | Normative chapter | primitive/derived types, promotions, casts, constants, intermediate width, wrapping, right shift | preserve width/signedness/nominal type and constant/runtime distinction through legalization | [IR semantic payload](il-and-optimization.md#mandatory-semantic-payload) | None — directly governs typing, including saturated wide shifts |
| `spec/03-variables.md` | Normative chapter | mutable, constant, and loadable declarations; lexical shadowing; initialization; zero page; closed `place(...)` | distinguish compile-time values, package-only values, module/function storage, startup initialization, and placement constraints | [Storage ownership](sfa-and-abi.md#storage-ownership-boundary) | None — directly governs declarations, lifetime, publication, and placement requests |
| `spec/04-expressions-operators.md` | Normative chapter | precedence, fixed-width arithmetic, direct-subscript promotion, short circuit, assignment, address/function values, memory access, and compile-time trigonometry | retain evaluation order, effects, place/value, widths, narrow barriers, finite function targets, and local-origin address provenance | [Optimization proof](il-and-optimization.md#two-oracle-proof); [SFA lifetime](sfa-and-abi.md#lifetime-model) | None — directly governs expression meaning, exact trigonometric results, and runtime safety boundaries |
| `spec/05-statements-control-flow.md` | Normative chapter | blocks, Boolean conditions, three-clause for loops including local `loadable const`, switch, fallthrough, break/continue/return | explicit CFG edges, clause order/effects, lexical scope, fixed-width values, reachability, diagnostic ownership; keep a loop-local `loadable const` package-only with no per-iteration initialization or SFA home | [Control-flow representation](il-and-optimization.md#control-flow-and-layout) | None — directly governs statements; `continue` reaches update, while `break` and `return` skip it |
| `spec/06-functions.md` | Normative chapter | calls, typed function values, left-to-right arguments, caller-owned aggregate returns, recursion, SFA, callback-only interrupts, sink-selected entry variants, and typed compile-time functions | call/target graphs, argument and destination homes, lifetime, roots, escape, preemption, source-handler provenance, exact ABI, compile-time budgets, and diagnostics | [SFA and ABI](sfa-and-abi.md); [Call effects](il-and-optimization.md#calls-helpers-and-clobbers) | None — directly governs ordinary, function-value, interrupt, aggregate-return, and compile-time call boundaries |
| `spec/07-structs.md` | Normative chapter | field order, composition, by-reference passing, exact assignment/return values, aliasing, address-of | preserve layout/order, aggregate size/alignment, caller-owned destinations, by-reference alias identity, and copy effects | [Aggregate homes](sfa-and-abi.md#frame-contents-and-homes) | None — directly governs struct value semantics and representation constraints |
| `spec/08-arrays-strings.md` | Normative chapter | fixed extents, exact-shape array values, indexing/promotion, initialization, strings/characters, const and any-size parameters | preserve extents, nested shape, copy/return destinations, narrow barriers, encoding identity, bounds, address, alias, and const effects | [Memory effects](il-and-optimization.md#memory-effects-and-volatility) | None — directly governs fixed-array value semantics, parameter-only `T[]`, runtime `length()`, and exact OOB behavior |
| `spec/09-enums.md` | Normative chapter | byte representation, nominal identity, conversions, comparison, visibility | retain enum identity until checked conversion; lower only after semantic distinctions are consumed | [Legalization](il-and-optimization.md#legalization) | None — directly governs nominal byte-backed enums |
| `spec/10-modules.md` | Normative chapter | module/import/export resolution, entry point, startup and initialization order | complete symbol graph, entry roots, initialization dependencies, deterministic program order | [Whole-program roots](sfa-and-abi.md#call-graph-roots-and-escape) | None — directly governs program structure and dependency/effect-ordered runtime initializers |
| `spec/11-memory-model.md` | Normative chapter | segments, placement, captured load ranges, SFA, aggregate-return destinations/copies, ZP, and hardware-stack budgets | separate function storage from global/platform layout; prove borrow containment, overlays, destination/snapshot lifetime, and exact resource peaks | [SFA lifetime](sfa-and-abi.md#lifetime-model); [SFA closure](sfa-and-abi.md#final-storage-closure) | None — directly governs SFA closure, aggregate destinations, load publication, and resource failures |
| `spec/12-intrinsics.md` | Normative chapter | exactly five CPU controls, packed BCD, volatile memory access, byte extraction, and size/count queries | model exact interrupt/status-stack effects, dynamic addresses, MMIO order/count, and query widths; do not reintroduce removed raw controls | [Memory effects](il-and-optimization.md#memory-effects-and-volatility) | None — directly governs the five `asm_*` controls and ordinary memory/query intrinsics |
| `spec/13-data-inclusion.md` | Normative chapter | raw/format-aware embed, output identity, literal selector keys, pinned format versions, alignment, linker-resolved values, callable-audio provenance, exact SID metadata/profile compatibility, and trusted-media-only KERNAL loading | keep selected bytes symbolic and emit no runtime or unrequested copy; canonical-identical path/selector/representation declarations share one immutable object/address while different selected outputs remain distinct; keep selector-key interpretation inside the format handler; validate the profile's exact application/format and video/SID topology baseline; preserve native SpritePad records and keep placement-derived VIC fields outside the handler; retain an exact attached player contract without inferring SFX from PSID; keep Unknown distinct from Both and reject known incompatibility with E10261; route format, alignment, segment, artifact, and bounded loader work to their platform owners; preserve HLE-010's warning that stock `LOAD` may overwrite past the expected range before returning failure | [Native assets](c64-game-engineering.md#native-asset-handlers); [C64 placement and loading](c64-memory-and-runtime.md#qualified-d64-and-load-unit-contract); [Artifacts](acme-and-artifacts.md#artifact-boundaries) | None — directly governs asset inclusion and packaging, including exact C64 asset meanings, version rejection, qualified callable-audio provenance, no automatic SID conversion, and the trusted-media limit |
| `spec/14-diagnostics.md` | Normative registry | diagnostic format, severities, codes, flags | one root cause, stable code/span/notes, recovery state, no artifact after error | [Diagnostic doctrine](#diagnostic-doctrine) | None — canonical public registry; its 182-code active set is unique and complete |
| `spec/15-platform-profile.md` | Normative contract | target fields, capabilities, immutable encoding/map identities, interrupt sources/sinks/entry variants/vector paths, explicit video standard and SID endpoint topology, hash-bound audio-player contracts, determinism, conformance, build summary | query declarative facts; keep lexer/parser target-neutral; select encoding/map and source handler kind semantically; select the exact raw/firmware entry only after target choice; validate SID metadata against `video_standard` and `sid_chips`; treat CPU clock as derived timing rather than SID identity; lower audio operations only through an exact compatible contract; pass facts to allocation/backend/packager | [Target composition](compiler-architecture.md#target-composition) | None — directly governs platform abstraction, named encoding/map availability, raw fallback bounds, interrupt ABI selection, callable audio, exact SID deployment identity, and the exact division/OOB policies |
| `spec/appendix-c64.md` | Normative target profile | 6510/VIC-II/SID/CIA memory, exact PAL/NTSC timing records, explicit SID endpoint topology, ZP, PRG/D64, exhaustive upper/graphics and lower/upper screen-code/PETSCII maps, embeds, pinned asset-format baseline, qualified player-neutral audio, KERNAL CINV/raw IRQ ABIs, startup/return, trusted-media-only loading, and the C64 manifestation of unchecked indexing | compose C64 platform facts with shared 6502 backend; resolve literals through the exact encoding/map pair without changing hardware state; select no-second-save KERNAL chain/exclusive or profile-gated raw entry; accept only exact registered application/format generations; preserve SPD v5 records/metadata and derive VIC fields from final placement; validate PSID clock/model/topology against the selected profile and exact player contract, rejecting incompatibility with E10261; lower audio operations directly with source-owned scheduling and no generic runtime or automatic conversion; keep banking/layout/loading in platform layers; preserve HLE-010's direct-write/possible-overwrite boundary; run scheduled initializers once and fall through into `main` before the return-to-BASIC epilogue; when bounds checks are off, form effective addresses modulo 65536 and continue multi-byte access byte by byte across `$FFFF` to `$0000`, observing the active bank/MMIO map | [C64 hardware](c64-hardware.md); [C64 memory and runtime](c64-memory-and-runtime.md); [C64 asset/game integration](c64-game-engineering.md); [Artifacts](acme-and-artifacts.md) | None — current primary platform contract, including exact SID deployment identity, character maps, CINV `$EA81` tail, E10252, VIC-relative asset derivation, E10256..E10258/E10261 audio ownership, HLE-003 default-off checks, and HLE-010 trusted-media loading |
| `spec/evaluations/F001-multi-file.md` | Evaluation rationale | one or more supplied source files compile into one binary; file and directory names have no language meaning; cross-file references use modules | preserve the supplied source set and resolve cross-file names through the module system without deriving semantics from paths | [Frontend boundary](compiler-architecture.md#target-neutral-front-end) | Input discovery, module-to-file mapping, duplicate-module policy, and diagnostic-stability guarantees are N/A because F001 does not specify them; do not infer those contracts from this document |
| `spec/evaluations/F002-modules.md` | Evaluation rationale | module syntax/naming and file relationship | keep module identity and spans through name resolution | [Frontend boundary](compiler-architecture.md#target-neutral-front-end) | None — intent evidence; final module chapter owns behavior |
| `spec/evaluations/F003-module-contents.md` | Evaluation rationale | allowed contents, visibility, initializer behavior | preserve declaration class/visibility and initializer dependency/effect facts | [Whole-program roots](sfa-and-abi.md#call-graph-roots-and-escape) | None — reconciled intent evidence; final module chapter owns behavior |
| `spec/evaluations/F004-entry-point.md` | Evaluation rationale | unique `main`, signature, startup invocation, call restrictions | identify one program root and suppress artifact for invalid entry configuration | [Roots](sfa-and-abi.md#call-graph-roots-and-escape) | None — intent evidence for entry behavior |
| `spec/evaluations/F005-memory-placement.md` | Evaluation rationale | module/function/ZP/data placement and target budgets | carry symbolic storage class and placement constraints; diagnose target resource conflict | [Storage boundary](sfa-and-abi.md#storage-ownership-boundary) | None — intent evidence for memory placement |
| `spec/evaluations/F006-address-of.md` | Evaluation rationale | addressable objects/functions, address result, restrictions | preserve object identity, escape/address-taken state, and symbolic relocation | [Escape policy](sfa-and-abi.md#call-graph-roots-and-escape) | None — intent evidence for address-of behavior |
| `spec/evaluations/F007-interrupt-functions.md` | Evaluation rationale | interrupt declaration, raw/firmware entry/exit, source acknowledgement, ZP temps, reentrancy hazard | mark asynchronous root, preserve handler identity, select exact sink ABI/clobbers/tail, model nesting/preemption/interference, and account for every variant/link; never accept double-save or silent corruption | [Interrupt domains](sfa-and-abi.md#interference-and-reentrancy) | None — reconciled intent evidence for entry variants, disjoint invocation-private homes, and genuinely shared state |
| `spec/evaluations/F008-for-loop.md` | Evaluation rationale | familiar initializer/condition/update syntax, `let`/`const`/`loadable const` local declarations, exact clause order, normal mutation/scope/wrap, exits, canonical induction | lower every loop to correct generic CFG; preserve effects and fixed-width semantics; retain package-only `loadable const` without runtime initialization/storage; specialize only with proof | [Control flow](il-and-optimization.md#control-flow-and-layout) | None — reconciled intent evidence for modern source and proof-based expert loop output without a runtime or second range syntax |
| `spec/evaluations/F009-switch-statement.md` | Evaluation rationale | auto-break, explicit fallthrough, cases/default, lowering options | preserve case order/fallthrough, reachability, exact comparison type and chosen CFG | [Control flow](il-and-optimization.md#control-flow-and-layout) | None — intent and cost evidence for switch |
| `spec/evaluations/F010-signed-types.md` | Evaluation rationale | signed ranges, conversions, arithmetic/comparison/shift | retain signedness and width through constant evaluation, legalization, and selection | [IR payload](il-and-optimization.md#mandatory-semantic-payload) | None — intent evidence for signed operations |
| `spec/evaluations/F011-structs.md` | Evaluation rationale | layout, nesting, arrays of structs, by-reference calls, aliasing, access costs | retain field offsets, aggregate alignment, address identity and alias-visible order; support array-of-structs and SoA layouts without turning cost into a language restriction | [Memory effects](il-and-optimization.md#memory-effects-and-volatility) | None — intent and lowering evidence for structs |
| `spec/evaluations/F012-cpu-control-intrinsics.md` | Evaluation rationale | the exact five CPU-control intrinsics, flags, kind-correct status-stack/interrupt control, typed BCD ownership, explicit low-level responsibility, volatile `peek`/`poke` boundary | represent exact machine-state effects, status-stack entry kinds, ownership, and ABI preconditions; keep every other `asm_*` spelling an ordinary unresolved name; do not reorder across barriers or inject handlers; do not recommend deferred `volatile_read`/`volatile_write` APIs as current behavior | [Machine effects](il-and-optimization.md#machine-state-and-explicit-low-level-effects) | None — reconciled intent evidence for deliberately low-level operations without allocator-accidental cross-kind register/status transfer, raw decimal controls, or a fictitious generic BRK debugger |
| `spec/evaluations/F013-control-flow.md` | Evaluation rationale | if/loops, scope, definite assignment, return completeness | build explicit CFG, scope/reachability state, root diagnostic and recovery | [Control flow](il-and-optimization.md#control-flow-and-layout) | None — intent evidence for general control flow |
| `spec/evaluations/F014-arrays.md` | Evaluation rationale | arrays/strings/const parameters, arrays of structs, indexing tiers, Unicode-scalar literal content, closed escapes and named encoding/map selection | retain extent/element type, address calculation, alias/const effects and selected encoding/map identity; diagnose unavailable maps or scalar/escape mappings; treat SoA as an optional measured layout choice, never an expressiveness requirement | [Memory effects](il-and-optimization.md#memory-effects-and-volatility) | None — reconciled intent and cost evidence for arrays and compile-time encoding |
| `spec/evaluations/F015-data-inclusion.md` | Evaluation rationale | embeds, literal format-handler keys, pinned latest-stable baseline, version validation, alignment, native/derived selector costs, linker-resolved values, SID metadata/profile compatibility | keep embedded data and relocations symbolic; pass opaque selector keys only to the handler; pin the exact producing application release plus accepted signature/version; retain exact SPD v5 records and per-sprite attributes; report requested derived tables; let platform layout own visibility/alignment and VIC field derivation; preserve all PSID clock/model meanings and reject known profile/player mismatch with E10261 without conversion | [Native assets](c64-game-engineering.md#native-asset-handlers); [C64 placement](c64-memory-and-runtime.md#vic-view-and-placement); [Artifacts](acme-and-artifacts.md#artifact-boundaries) | None — reconciled intent and platform-handler evidence, including exact SpritePad/CharPad semantics, fail-closed versioning, and exact SID configuration identity |
| `spec/evaluations/F016-type-system.md` | Evaluation rationale | type table, promotions, casts, intermediate overflow, constants | share one semantic evaluator between compile-time and runtime rules while preserving their specified differences | [IR payload](il-and-optimization.md#mandatory-semantic-payload) | None — intent evidence for typing |
| `spec/evaluations/F017-operators.md` | Evaluation rationale | operators, short circuit, expensive arithmetic tiers, shifts/comparisons | preserve effects/width/signedness; warn by semantic cost rule; choose legal lowering later | [Optimization proof](il-and-optimization.md#two-oracle-proof) | None — reconciled intent and cost evidence, including wide shifts and runtime-zero division |
| `spec/evaluations/F018-functions.md` | Evaluation rationale | function rules, SFA convention, recursion, parameter evaluation, call costs, function-relative explicit-stack state, and per-allocated-instance frame/return-home accounting | call graph, homes, left-to-right staging, return/clobber contract, stack ownership/kind sequence, and recursion diagnostic; charge every bounded simultaneous activation separately and create only the required entry/body variants | [SFA and ABI](sfa-and-abi.md) | None — reconciled function, stack-state, and diagnostic intent evidence; no-recursion alone never proves one frame or one optional stack-free return home per source function |
| `spec/evaluations/F019-variables.md` | Evaluation rationale | initialization, module startup, locals, definite assignment, resident constants, and package-only `loadable const` declarations | storage/lifetime class, dependency/effect order, initial value state and diagnostics; a local or loop-initializer `loadable const` has lexical scope but no resident address, runtime initialization, or SFA home | [Storage ownership](sfa-and-abi.md#storage-ownership-boundary) | None — reconciled intent evidence for runtime module initialization and zero-runtime packaged constants |
| `spec/evaluations/F020-memory-intrinsics.md` | Evaluation rationale | volatile `peek`/`poke`, variable addresses, word order, queries | dynamic address lowering; exact access count/order/width; compile-time versus carried-count query separation | [Memory effects](il-and-optimization.md#memory-effects-and-volatility) | None — decisive intent and cost evidence; runtime-address ZP scratch is accounted through SFA |
| `spec/evaluations/F021-lexical-structure.md` | Evaluation rationale | token inventory, literal forms, closed escape spellings, ambiguous prefixes/operators, positions | deterministic maximal munch and complete source spans; preserve symbolic escape identity for later encoding with recoverable lexical errors | [Frontend boundary](compiler-architecture.md#target-neutral-front-end) | None — reconciled lexer intent; mapping availability is semantic, not lexical |
| `spec/evaluations/F022-enums.md` | Evaluation rationale | nominal enum rules, byte representation, casts and member resolution | preserve nominal identity until validated; then lower to byte without losing diagnostic context | [Legalization](il-and-optimization.md#legalization) | None — intent evidence for enums |
| `spec/evaluations/F024-conditional-operator.md` | Evaluation rationale | boolean condition, selected-arm-only evaluation, type unification | explicit branch/merge value; preserve unchosen-arm non-effects and right association | [Control flow](il-and-optimization.md#control-flow-and-layout) | None — intent and lowering evidence for conditional expressions |
| `spec/evaluations/F025-comptime-functions.md` | Evaluation rationale | typed compile-time calls, deterministic root order, exact integer trigonometry, and `comptime-budget-v1` | evaluate with ordinary semantic rules, charge the three exact budgets, and emit no target code or partial output | [Semantic preservation](#semantic-preservation-checklist) | None — current rationale and boundary examples for compile-time evaluation |
| `spec/future-considerations.md` | Non-normative future register | every open or resolved future item, its rationale, owner, and exact reconsideration trigger | do not implement a deferral as current behavior; reopen it when its stated reason expires | [Authority](#authority-and-use) | No current semantics; the normative chapters own every resolved Specification 4 behavior |
| `spec/grammar.ebnf.md` | Normative master syntax grammar | complete source grammar and syntactic ambiguity boundaries; its expression structure delegates operator precedence to Chapter 04 | parser acceptance must match both the grammar and the normative chapter rules they jointly state; any genuine inconsistency is a blocked specification conflict, not an assumed chapter-precedence rule | [Frontend boundary](compiler-architecture.md#target-neutral-front-end) | None — directly governs accepted source structure alongside the other inventory-marked normative files |

## Consistency Scan

The Specification 4 scan compares all 45 specification Markdown files. It does not infer correctness from the
current parser or tests. The table records the repaired grammar surfaces and their governing rules:

| Area | Governing chapter behavior | Derived grammar result | State |
|---|---|---|---|
| `let` and zero page | `let` initializer is optional; explicit zero-page declarations use one module-level `zeropage { ... }` block | preserves both distinctions | Reconciled |
| functions | return annotation is mandatory; every complete value type may return; fixed aggregates use caller-owned destinations; interrupt functions declare `(): void`; `comptime function` is typed and target-free | preserves each form without a heap or general runtime | Reconciled |
| arrays and literals | every stored array resolves to fixed `T[N]`; `T[]` is only an initializer extent placeholder or an any-size parameter carrying the full caller-array count; array literals include empty, value-list, string/encoded-string, and remaining-fill forms; no slice/span/view value exists | represents each form without redefining fill semantics or creating a first-class subarray | Reconciled |
| casts | integer casts use `Type(expression)` | obsolete `expression as Type` casts are absent | Reconciled |
| CPU intrinsics | Chapter 12 defines exactly five CPU-control intrinsics | only `asm_sei`, `asm_cli`, `asm_php`, `asm_plp`, and `asm_nop` are present | Reconciled |
| embedded data | Chapter 13 defines one literal path plus one optional literal, handler-owned selector key | matches that bounded call surface; no member access, generic selector query, or generic offset argument exists | Reconciled |
| strings/chars | strings use double quotes; chars use single quotes; empty string is valid; the closed escape set is `\\`, `\"`, `\'`, `\n`, `\r`, `\t`, `\0`, `\xNN` | preserves every spelling; leaves selected-encoding mapping and E10249 to semantics | Reconciled |
| assignment | Chapters 04 and 05 define a value-producing assignment expression | makes assignment lowest-precedence and right-associative | Reconciled |
| expression statements | Chapter 05 permits `expression ;`; unused-result behavior has no W10131 rule | accepts general expression statements without inventing a warning | Reconciled |
| for loops | Chapter 05 defines one optional initializer/condition/update header with normal declaration/expression semantics | two semicolons delimit clauses; statement parsing invokes ordinary expression parsing; no contextual range words remain | Reconciled |

### Assignment-expression invariant

AR-P4 selects assignment expressions for modern C/JavaScript-familiar ergonomics without changing
the static-frame architecture:

- Every otherwise legal simple or compound assignment is an expression. It has the lowest
  precedence, associates right, and has the target type. `a = b = value` means
  `a = (b = value)`.
- Evaluate the target place exactly once, then the right-hand expression exactly once, and store
  exactly once. Compound assignment reads the old target value exactly once before evaluating the
  right-hand expression.
- The result is the exact target-typed value written after the language's conversion, range, wrap,
  or enum rules. Reuse the computed value; do not reload the destination. This preserves one write
  for simple volatile/MMIO assignment and one read plus one write for volatile/MMIO compound
  assignment.
- A legal whole-struct or exact-shape fixed-array assignment yields the assigned aggregate value.
  Lowering may reuse its destination only when alias and lifetime proof makes that observably
  equivalent; otherwise it uses an SFA-owned aggregate snapshot. The same caller-owned destination
  and alias-safe construction/copy rules govern fixed aggregate returns.
- Assignment is not a constant expression. Normal context rules still apply, so an integer
  assignment cannot satisfy a boolean-only condition; a boolean assignment can.
- IL and optimization must preserve target-before-RHS order, exactly-once place/index/address
  evaluation, volatile access counts, the expression result, and any aggregate snapshot. Every
  temporary and helper scratch byte remains inside final SFA storage closure.

These rules are clean-slate semantic requirements. Existing parser, analyzer, IL, code-generation,
and test behavior is never evidence that they have been implemented correctly; each layer must be
audited later against the reconciled specification.

### Three-clause for-loop invariant

AR-P32 removes the provisional range-only loop rather than preserving two overlapping forms:

```ebnf
for_stmt        = "for" , "(" , [ for_initializer ] , ";"
                , [ expression ] , ";" , [ for_update ] , ")" , block ;
for_initializer = for_local_decl | expression_list ;
for_local_decl  = "let" , identifier , ":" , value_type , [ "=" , expression ]
                | "const" , identifier , ":" , value_type , "=" , const_expression
                | "loadable" , "const" , identifier , ":" , value_type
                , "=" , const_expression ;
for_update      = expression_list ;
expression_list = expression , { "," , expression } ;
```

- `for (I; C; U) B` evaluates `I` once, evaluates Boolean `C` before every possible iteration,
  executes `B` only when `C` is true, and evaluates `U` after normal body completion or `continue`.
  Omitted `C` means `true`; `break` and `return` skip `U`.
- Initializer/update expression lists evaluate left to right. A header declaration is an ordinary
  local `let`, `const`, or `loadable const`; its scope covers condition, update, and body but not
  code after the loop. A `loadable const` remains package-only and adds no per-iteration
  initialization, resident address, or SFA home. The body is a nested scope and may shadow the
  header binding; E10003 still rejects a duplicate in the same scope. Mutation, conversion, call,
  MMIO, and fixed-width wrap rules remain ordinary language rules. The former range words `until`,
  `to`, `downto`, and `step` are ordinary identifiers.
- Correctness lowers to initializer, condition, body, update, and end blocks. Statement parsing
  owns the delimiters and calls the ordinary expression parser; this adds no Pratt grammar or SFA
  model.
- A `word` induction value may be represented by an 8-bit register only when range, alias, escape,
  effect, and exit proof preserves every source observation. Thus the normal 256-element form
  `for (let i: word = 0; i < length(a); i += 1)` may become `INX/BNE`. E10262 rejects a canonical
  finite-looking byte form when proof shows its counter repeats before its invariant condition can
  become false; deliberate wrap and infinite loops remain legal.
- A bounded canonical-induction recognizer over the normal CFG is sufficient. Failure to recognize
  a pattern falls back to correct generic lowering; it never justifies a source restriction or a
  generalized loop framework.

A complete loop analysis states the current lexical consequence as well as the CFG: `until`, `to`,
`downto`, and `step` are ordinary identifiers, not a second range syntax. For every fixed-width
counterexample, it also separates E10262's proved finite-looking unreachable-termination case from
legal intentional modular behavior; it must not report the rejected byte `i < 256` example as an
accepted infinite loop merely because fixed-width arithmetic wraps.

For the proved register-only 256-iteration control skeleton `LDX #0; loop: ...; INX; BNE loop`,
the static control code is 5 bytes. It costs 1,281 cycles including `LDX`, 256 `INX` operations,
255 taken same-page branches, and the final untaken branch; if the fixed backedge crosses a page,
add 255 cycles. It clobbers X and N/Z; A, Y, C, V, D, and I are unchanged by the skeleton. Body,
call/ABI, spill, materialization, layout/padding, and any save/restore costs remain separate. This
machine narrowing never changes the semantic `word` induction value or makes a byte-typed
`i < 256` source loop finite.

Before closing a for-loop review, explicitly state: all three clauses are independently optional;
omitted condition means `true`; the exact `let`, `const`, and `loadable const` initializer forms and
their ordinary mutability, residency, and initialization rules; left-to-right evaluation of every
initializer and update expression-list element; header-local scope, legal child-scope shadowing,
and same-scope E10003; `continue`/`break`/`return` update edges; and that header commas delimit only
these lists rather than adding a general comma operator.
Then report CFG/SFA ownership and any selected machine sequence's complete bytes, paths, flags,
registers, memory traffic, and proof conditions.

### Binary and packed-BCD arithmetic invariant

Ordinary integer arithmetic, including `+`, `-`, `*`, `/`, `%`, and their compound-assignment
forms, always uses binary fixed-width semantics regardless of the processor's D or C flags. Packed
decimal exists only through these four overloads:

| Operation | Accepted operands | Result | Rejected operands |
|---|---|---|---|
| `bcd_add` | `byte, byte` | `byte`, modulo 100 | signed or mixed-width: E10172 |
| `bcd_add` | `word, word` | `word`, modulo 10,000 | signed or mixed-width: E10172 |
| `bcd_sub` | `byte, byte` | `byte`, modulo 100 | signed or mixed-width: E10172 |
| `bcd_sub` | `word, word` | `word`, modulo 10,000 | signed or mixed-width: E10172 |

Both operands evaluate exactly once from left to right before the decimal operation. Effectful
values are staged in SFA-owned homes. Each operation owns its carry input: add starts with `CLC`,
subtract with `SEC`; word forms propagate carry/no-borrow from low to high byte and discard the
final carry/borrow. A valid constant call folds. A statically known `$A`–`$F` nibble is E10254;
runtime-invalid digits follow the selected CPU's exact ordered decimal `ADC`/`SBC` result and never
authorize unproved decimal algebra. D is clear on every normal exit.

For operands and results in ZP or absolute homes, canonical complete non-coalesced sequences are:

```asm
; ordinary binary byte add; use SEC/SBC for subtraction
LDA left
CLC
ADC right
STA result
; 11-14 cycles, 7-10 bytes

; byte bcd_add; use SEC/SBC for bcd_sub
SED
CLC
LDA left
ADC right
CLD
STA result
; NMOS 6502/6510: 15-18 cycles, 9-12 bytes

; word bcd_add; use SEC/SBC for bcd_sub
SED
CLC
LDA left
ADC right
STA result
LDA left+1
ADC right+1
STA result+1
CLD
; NMOS 6502/6510: 24-30 cycles, 15-21 bytes
```

These totals include memory loads and result stores but exclude the prior evaluation/staging of
non-home expressions; report those actual instructions and SFA costs too. The binary sequence
clobbers A and arithmetic flags but never depends on ambient D/C. The BCD sequences clobber A and
arithmetic flags, temporarily set D, and leave D clear. There is no helper, linked runtime,
validation block, or hidden scratch. Adjacent regions may coalesce only with proved carry ownership,
left-to-right effects, D-clear entry/exit equivalence, control-flow closure, and IRQ/NMI restoration.
Specification 4 exposes no raw decimal-state control. The compiler owns each internal `SED`/`CLD`
region and proves D-clear entry/exit plus interrupt restoration. The five public `asm_*` controls
retain only their specified interrupt, status-stack, or no-op effects.

Before closing a binary/BCD review, reproduce the complete four-row accepted signature/result table
and E10172 rejection boundary; state that all four ordinary `+`, `-`, `+=`, and `-=` forms remain
binary; give at least one valid folded value and one E10254 invalid constant plus one runtime-invalid
selected-CPU example; and show the actual inline byte and word `SED`, carry/no-borrow, low-to-high
`ADC`/`SBC`, store, and `CLD` sequences. Enumerate every coalescing barrier independently: carry
ownership, calls, joins and other control-flow entries/exits, ordinary arithmetic, address
formation, raw machine-state effects, and asynchronous IRQ/NMI paths. State W10120's retirement
explicitly. A cost range without the sequences or this semantic inventory is incomplete.

Those BCD cycle totals are NMOS-only. W65C02S takes one additional cycle for every decimal-mode
`ADC` or `SBC`: the complete byte form is therefore 16–19 cycles and the word form 26–32 cycles.
Instruction bytes are unchanged. Always select the CPU before reporting decimal timing; do not
reuse C64/6510 totals for a 65C02 target.

### Const-parameter invariant

AR-P5 selects `name: const Type` for read-only by-reference array and struct parameters. The
qualifier describes the callee's access permission, not a JavaScript-style non-rebindable local:

- reads are legal, but writes through the parameter are rejected transitively through every nested
  field and element;
- mutable aggregate arguments may flow to mutable or const parameters, while const declarations and
  const parameters cannot flow to mutable parameters;
- forwarding to another const parameter preserves read-only access;
- scalar and enum parameters are already passed by value, so spelling `const` on either is rejected
  with E10246 rather than accepted as a no-op;
- constness does not prove that the underlying storage is immutable when another mutable alias,
  interrupt, DMA-like hardware activity, or external agent can change it; and
- the qualifier changes no ABI or generated instructions. Arrays and structs still pass the same
  base address, and enforcement is compile-time only.

### Fixed-array and index-ordinal invariant

AR-P35–AR-P41 keep the source model small while preventing byte/word backend details from leaking
into ordinary array use:

- Every stored array is one compile-time-sized contiguous `T[N]` object. There is no dynamic array,
  capacity, resize, slice, span, `view()` operation, or storable/returnable unsized-array value.
- `T[]` on initialized storage only asks the compiler to infer `N` and then becomes `T[N]`. In a
  parameter it accepts a complete fixed array of any extent; its SFA ABI is the caller array's
  two-byte address plus full word element count: four SFA bytes per concurrent frame instance.
  An exact `T[N]` parameter carries only the two-byte base address per concurrent frame instance.
  `T[]` may be forwarded to another compatible any-size parameter but cannot be assigned, stored,
  returned, or converted to exact `T[N]`.
- `length()` always has semantic type `word`. It folds for fixed arrays and loads the carried word
  count from the any-size parameter's two-byte SFA count home at runtime. Exact `T[N]` parameters
  remain address-only. Compile-time `sizeof`/`offsetof` add no runtime metadata, but that fact must
  never be generalized to the runtime `length(T[])` parameter query.
- `sizeof()` also always has semantic type `word`. Its value folds at compile time, and proof may
  narrow machine work, but crossing 255 bytes never changes the source expression's arithmetic.
- `offsetof()` always has semantic type `word` too; valid fields may begin after byte 255. An array
  extent must be a compile-time integer in `0..65535` or E10264 applies. Every complete fixed array
  or struct is computed at full precision and must occupy `0..65535` bytes or E10265 applies.
  `sizeof(T[])` is E10266 because an unsized array has no standalone fixed extent.
- Every integer type may be a final element ordinal. Direct unbarriered integer-producing operators
  inside `[]` widen byte/sbyte operands into a 16-bit signedness-preserving domain before
  evaluation. This includes unary `~`/`-`, arithmetic, shifts, and bitwise operators, so `a[i + 10]`
  with byte `i == 255` denotes ordinal 265 and `a[i << 1]` denotes 510. Comparisons/logical
  operators produce `boolean`; an explicit 8-bit cast or earlier stored or called narrow result is a
  deliberate barrier.
- Known negative or out-of-extent ordinals are E10240; non-integers are E10263. Checked runtime
  indexing sign-extends a signed ordinal and tests both `index >= 0` and `index < length` before
  address formation. Default unchecked indexing still sign-extends signed ordinals, scales by the
  complete element size, adds to the base modulo 65536, and preserves HLE-003: a multi-byte element
  continues byte by byte from `$FFFF` to `$0000` under the active banking/MMIO map. Proof may keep
  machine work byte-only or feed carry directly into address formation without a source-visible
  word temporary.
- `--bounds-check` is explicit and default-off. On C64 a surviving failed check branches to the
  source-labelled, non-returning `SEI` plus self-loop safety stop. It links no runtime, handler,
  string, RAM, or ZP; successful-path branches/layout, ROM, timing, and any SFA/register pressure
  remain attributable costs.
- A declared byte loop counter never widens silently. E10262 rejects only a proved canonical,
  finite-looking loop whose counter repeats before its invariant condition can be false and that
  has no other explicit exit. Ring cursors, timers, deliberate wrap/infinite loops, and other
  intentional modular-byte patterns remain legal. Correctly typed word induction may still lower
  to an expert byte-counter idiom under proof.

Before closing an array/index review, state all applicable boundaries explicitly: computed
ordinals before and after every deliberate narrow barrier; E10240 for each known negative or
out-of-extent access (including ordinal 510 against `byte[500]`); the `0..65535` extent and complete
object-size domains with E10264/E10265; E10266 for `sizeof(T[])`; checked signed lower-bound and
upper-bound tests; unchecked sign extension, element scaling, modulo-65536 address formation, and
byte-by-byte `$FFFF` to `$0000` continuation; E10262's body/bound invariance and no-other-explicit-
exit predicates; legality of deliberate ring/timer/infinite loops; and proof-based machine
narrowing of correctly typed word induction. Cite the exact governing specification locations,
not only this invariant. Include the exact two-byte `T[N]` versus four-byte `T[]` parameter cost per
concurrent frame instance and identify which `length()` form folds versus loads its carried count.
Treat the supplied source structure as scope evidence: a declaration inside a named function is
function-local even when target-profile facts are absent. If that source immediately reads a
nonzero uninitialized local array, report W10141 at the declaration and W10190 at the read. Do not
leave either warning Unknown merely because placement or interference facts are missing. A
`Verified complete` conclusion also requires exact raw specification headings or line locations
for the semantic, diagnostic, ABI/SFA, and lowering claims; a filename inventory and candidate
reference headings alone are insufficient.

### Uninitialized-storage warning completion gate

Analyze initialization state and read-path state as independent predicates. W10141 belongs at the
declaration of every nonzero uninitialized mutable array, whether module-level or function-local.
W10190 belongs to a function-local read that may occur before first assignment; module storage is
exempt from W10190 only. Therefore one function-local array can receive W10141 at its declaration
and W10190 at a later read. A complete answer must state that overlap explicitly, not merely say
that arrays do not receive W10190 by virtue of being arrays.

### Immutable character-map invariant

AR-P25 makes an encoding name insufficient by itself: every conversion resolves one immutable
`encoding + character-map` pair from the selected target profile. The lexer retains Unicode scalar
identity and symbolic escapes; semantic analysis performs the finite scalar-to-one-byte conversion.
No normalization, replacement, transliteration, target UTF-8, lookup table, or runtime helper is
permitted.

- Every qualified C64 profile exposes `screen_codes` and `petscii`. Its profile default is
  `screen_codes + upper_graphics`. A named call may select `"upper_graphics"` or `"lower_upper"`
  with an optional second string literal. That selection affects only the compiled literal and
  never writes `$D018` or changes the hardware character set.
- The four exhaustive maps are `c64-screen-upper-graphics-v1`,
  `c64-screen-lower-upper-v1`, `c64-petscii-upper-graphics-v1`, and
  `c64-petscii-lower-upper-v1`. Appendix A §6 owns their complete positive allowlists. Useful
  sentinels are default screen `"AZ0 £↑←"` → `$01,$1A,$30,$20,$1C,$1E,$1F`, lower/upper screen
  `"Az"` → `$41,$1A`, and lower/upper PETSCII `"Az"` → `$C1,$5A`. ASCII lookalikes never replace
  `£`, `↑`, or `←`; reverse-video bytes require exact byte input.
- Future targets must qualify their own exhaustive source-backed maps. Never clone the C64 tables
  merely because another machine looks similar.
- A custom charset requires explicit, versioned compile-time scalar-to-glyph metadata and its own
  immutable map identity. Without it, use exact bytes or asset-generated symbols. The compiler
  never guesses glyph semantics from bitmap order or filenames.

An absent encoding or map key is E10125, an absent scalar or symbolic escape is E10249, and a
non-literal optional map argument is E10251. These distinctions belong to semantic/profile
validation; character maps and their identities must also participate in deterministic build
identity and reporting.

### Module-initializer order

Runtime module initializers form one deterministic startup graph. Actual direct/transitive reads and
call effects create dependency edges; import syntax by itself does not, so circular declaration
imports remain legal. Among ready independent initializers, compare each unique fully qualified
variable name (`Module.Path.variable`) in case-sensitive ASCII byte order. This total order is
independent of file paths and compiler-input order. Observable independent effects preserve it;
only an actual initializer dependency/effect cycle is E10194.

### Runtime division-by-zero boundary

AR-P6 makes the smallest hardware-limitation exception to A3's fully specified-result rule. The
6502/6510 has no divide or remainder instruction and therefore supplies no native zero-divisor
value, flag, or trap. Runtime `/`, `%`, `/=`, and `%=` remain expressible, but only a nonzero
divisor has a specified arithmetic quotient or remainder:

- a compile-time constant zero divisor is an error;
- a runtime zero divisor executes the compiler-selected total division sequence and yields an
  unspecified value of the declared result type;
- emit no zero check, trap, catch path, handler, fallback, special-result code, or zero-handling
  scratch;
- the operation must terminate, produce a valid bit pattern of the declared width, touch only its
  operands, result, and ordinary SFA-accounted division scratch, and preserve evaluation order and
  volatile effects; and
- the optimizer must not assume the divisor is nonzero or use the unspecified result to delete,
  invent, or reorder surrounding behavior.

This is not C-style undefined behavior. It extends the specification's existing unspecified-value
category: only the result bits are unpredictable. Programs requiring a defined fallback test the
divisor explicitly. Do not freeze the accidental zero result of one helper; that would constrain
future signedness, width, CPU-family, and whole-program lowering choices. Signed `minimum / -1`
remains governed separately by the normal deterministic integer-overflow rule.

## Modern Expressiveness Debt

Specification 4 resolves the former fixed-aggregate assignment and return restriction. Fixed
structs and arrays are ordinary exact-shape values, and returns use a compiler-managed caller-owned
destination. A current compiler that still emits E10093, E10119, or E10120 is incorrect relative to
Specification 4. Record that implementation gap in the expressiveness ledger; never teach the old
restriction as language or SFA doctrine.

The general rule remains: a source restriction that exists only because parsing, lowering,
allocation, or optimization is incomplete is an implementation defect and an infinite parity gap.

## Hardware-Limitation Exception Register

This is the canonical register for Blend65 behavior that deliberately differs from normal modern
language expectations because the selected hardware and no-runtime constraint cannot provide that
behavior at acceptable cost. It is a documentation input and a design control, not a general escape
hatch for weak lowering.

An entry may become authoritative only when all of these conditions hold:

1. the product owner explicitly accepts the exception;
2. the exact hardware or resource constraint is stated, and compiler convenience is not the reason;
3. the result, observable effects, optimizer boundary, and diagnostic behavior are precise;
4. every byte and cycle of added runtime support is stated—normally zero unless separately approved;
5. a normal source-level mitigation is available where the platform permits one; and
6. the language and user documentation obligations are named.

Pending entries preserve a visible decision and documentation need, but they do not authorize
compiler behavior. Accepted entries govern the candidate knowledge while their specification and
documentation status remains explicit.

| ID | Status | Mainstream expectation | Forced constraint | Blend65 contract and runtime cost | Developer mitigation and documentation |
|---|---|---|---|---|---|
| HLE-001 | Accepted; current language rule | General-purpose languages normally permit recursive calls. | Blend65's established SFA model has no dynamic activation frames; the 6502 hardware stack and C64 RAM budget cannot carry a transparent general frame runtime. | Reject every direct or indirect recursive call-graph cycle at compile time with its cycle path. Add no dynamic frame runtime. Ordinary nested call evaluation is not recursion and must compile through SFA staging. Runtime cost: zero. | Express the algorithm iteratively or with an explicit fixed-capacity work structure when recursion is conceptually required. The language guide must explain the constraint, cycle diagnostic, and SFA-safe alternatives. |
| HLE-002 | Accepted and reconciled | Managed languages commonly trap or throw for integer division by zero; C-family systems languages may leave it undefined. | The 6502/6510 has no division/remainder instruction or native zero-divisor trap, and Blend65 may not inject a mandatory runtime handler. | Constant zero is E10160. By default, a runtime zero divisor terminates with an unspecified valid-width result while preserving the bounded effects above. No mandatory check, trap, catch path, handler, fallback, special result, or zero-handling scratch is emitted. Default runtime cost beyond the selected division sequence: zero. The only optional check is default-off `--division-zero-check`; it fails before division and, on C64, enters the source-labelled `SEI` plus self-loop terminal block. It adds no handler choice, returning path, KERNAL/user vector, error string, linked runtime, RAM, or ZP. | Test the divisor explicitly when a defined fallback is required. Operator, safety, optimization, C64, and migration documentation must distinguish this bounded unspecified result from both an exception and C-style undefined behavior, and must account for the optional check's ROM, SFA/register pressure, success-path branch/layout, and timing effects. |
| HLE-003 | Accepted and reconciled | Memory-safe and managed languages normally check array bounds; JavaScript-style arrays do not expose unrelated physical memory. C permits unchecked access only as undefined behavior. | The 6502 has a 16-bit address space with no bounds or memory-protection trap, and Blend65 may not inject mandatory bounds handling. | A constant provable out-of-bounds access is a compile-time error. By default, runtime indexing emits no implicit check, trap, clamp, or modulo-array-length code. It computes the effective address modulo 65536; a multi-byte element continues byte by byte across `$FFFF` to `$0000`, and every byte observes the active target memory map, banking, and MMIO effects. The optimizer may use a sound range proof but may never assume an unproved index is in range. Default bounds-handling runtime cost: zero. | Guard a dynamic index explicitly when its source may exceed the array extent. Array, safety, optimizer, C64 memory-map, and migration documentation must state the exact address-wrap and MMIO/banking consequences prominently. Optional instrumentation may be selected explicitly and cannot change the default. |
| HLE-004 | Accepted and reconciled | A normal modern function may be called from several contexts while each simultaneous invocation retains private parameters, locals, and temporaries. Shared globals remain shared. One source interrupt handler should not require the developer to hand-write a different prologue or remember an inherited decimal flag for each platform entry path. | Raw 6502 interrupt entry uses `RTI`, firmware may already own saved registers and a restore tail, NMOS entry does not clear decimal mode, ordinary calls use `RTS`, and SFA provides only a finite statically allocated set of invocation homes. NMOS indirect `JMP ($xxFF)` also wraps its high-byte fetch. Unbounded same-entry nesting cannot select infinitely many homes without runtime dispatch or a dynamic stack. | An `interrupt function` is callback-only. A recognized sink selects its raw or firmware-mediated entry variant; C64 KERNAL variants never save A/X/Y twice. The compiler establishes binary mode before Blend65 handler/helper code, preserves the interrupted or chained status, and places saved indirect vectors page-safely. Ordinary helpers remain reusable across mainline/IRQ/NMI domains; the compiler creates disjoint SFA homes and only the entry/body variants required. A potentially self-nesting storage-bearing path that cannot be bounded is a compile-time error. No generic dispatcher, runtime selector, frame copy, or dynamic stack is added. All ROM/RAM/ZP/stack/cycle costs are reported. | Use the profile's typed installer and take exclusive/raw ownership only through a profile that qualifies it. Packed-decimal operations own their internal decimal-state transitions; Specification 4 exposes no raw `asm_sed()` escape. Keep reusable logic in ordinary helpers. Shared single-byte state remains genuinely shared; protect read-modify-write or multi-byte state when ordering/atomicity matters. Function, interrupt, concurrency, SFA, platform-API, and diagnostic documentation must explain the ABI, source acknowledgement, decimal boundary, and shared-state boundary. |
| HLE-005 | Accepted; frozen language rule reconciled | Managed and memory-safe languages normally initialize storage or reject every read that is not definitely assigned. | Automatically clearing all mutable storage adds startup bytes/cycles, while rejecting every deliberate scratch-buffer or externally populated storage pattern would impose a compiler-convenience restriction on constrained 6502 programs. The 6502 provides existing RAM bits and no automatic initialization facility. | A mutable declaration without an initializer emits no initialization code and initially contains its existing stored bits. A read yields a valid-width value with ordinary fixed memory/MMIO effects; it is not optimizer undefined behavior. W10190 reports a function-local control-flow path that may read before first assignment; module-level storage is exempt only from W10190. W10141 independently reports every nonzero uninitialized mutable array, including module-level arrays. A function-local nonzero array may therefore receive W10141 at its declaration and W10190 when a path reads it before assignment; these are different predicates, not duplicate reports of one event. Runtime cost: zero bytes and zero cycles. | Initialize storage explicitly before a value matters, or deliberately overwrite/populate it before reading. Variable, array, startup, optimizer, diagnostics, safety, and migration documentation must state the indeterminate-bit contract and both exact warning scopes. |
| HLE-006 | Accepted and reconciled | A high-level decimal API normally accepts decimal values and reports invalid input rather than exposing a processor-specific result. | Packed BCD is stored in ordinary bytes, and the 6502 has no validity trap or tag. Checking every runtime nibble would add branches, bytes, cycles, and timing variation to a deliberately zero-runtime operation. The CPU manuals define decimal arithmetic over valid packed decimal digits, not a portable high-level meaning for invalid digits. | `bcd_add()`/`bcd_sub()` reject a statically known nibble `$A`–`$F` with E10254. With runtime-invalid digits, they return the selected CPU's exact bytewise decimal `ADC`/`SBC` result for the specified carry sequence. No default validation, trap, helper, or hidden scratch is emitted. The optimizer may assume decimal digits only when it has proof. | Validate untrusted runtime BCD explicitly or produce it through validated decimal operations. Language, target, optimizer, diagnostics, and migration documentation must state that runtime-invalid BCD is a hardware-limited exception whose result is bound to the selected CPU. |
| HLE-007 | Accepted and reconciled | Memory-safe languages reject references that outlive a local; managed languages may instead promote escaping storage to a heap. C permits a dangling automatic-local address only through undefined behavior. | SFA has a finite compile-time set of invocation homes, while Blend65 has no heap, dynamic frame allocator, ownership runtime, or undefined behavior. Pinning silently would turn an automatic local into shared static state, and bounded multi-home allocation cannot support addresses retained across an unbounded number of sequential calls. | `&local` creates a compiler-tracked borrow bounded by the local's dynamic source lifetime. Local-origin provenance survives copies and derivations. A proven non-retaining call chain may use the address while the local is alive; E10260 rejects return, longer-lived storage, asynchronous/hardware publication, retaining/unknown calls, and opaque escape. Legal use extends SFA liveness. Sequential lifetimes may reuse one home; bounded concurrent domains receive disjoint homes and address-specific code variants when required. No heap, runtime check, hidden persistent home, or implicit static-local conversion is added. | Use module-level storage for a program-lifetime address or let the caller own and pass the aggregate. The language, function, SFA, optimizer, diagnostic, interrupt, and migration guides must explain the lifetime, provenance, non-retaining-call, repeated-call, and domain-overlap rules. |
| HLE-008 | Accepted and reconciled | Mainstream languages commonly offer resizable arrays, heap-backed collections, or first-class slices/views. | Blend65 targets machines with very small fixed memory maps and has no heap, allocator, garbage collector, or general runtime. Hidden capacity, ownership, growth, or descriptor lifetime would add memory and semantic machinery that the selected platforms cannot afford transparently. | Every stored array is a fixed contiguous `T[N]` object. `T[]` is only an initialized-storage extent placeholder or a whole-fixed-array any-size parameter carrying an address and word element count. It cannot be stored or returned, and it creates no dynamic array, slice, span, view, allocation, copy, helper, or runtime. Runtime cost beyond ordinary address/count parameter passing: zero. | Choose a compile-time maximum, use a separate logical count when only part of the storage is active, or build an explicit fixed-capacity pool/ring for the game workload. Array, function, ABI, SFA, and migration documentation must explain fixed storage, the two contextual `T[]` roles, and the exact any-size parameter cost. |
| HLE-009 | Accepted and reconciled | Mainstream host languages can represent collections and aggregate objects larger than 65535 bytes and may expose platform-sized size/offset queries. | Blend65's current 6502-family model has a 16-bit address space, `word` is its widest integer, any-size array parameters carry a word count, and no wider integer/runtime address model exists. | Array extents must be integers in `0..65535`; every complete fixed array or struct type must occupy `0..65535` bytes. `sizeof()` and `offsetof()` are stable compile-time `word` values. E10264/E10265 reject out-of-domain types and E10266 rejects `sizeof(T[])`; no runtime check, helper, metadata, or wider arithmetic is emitted. | Split data into separately placed/banked fixed objects when one logical asset exceeds an addressable object, and pass each complete fixed array normally. Array, struct, query, diagnostic, SFA, placement, and migration documentation must state the exact limits and compile-time failures. |
| HLE-010 | Accepted; current C64 profile rule | Modern loading APIs normally accept an explicit destination limit and contain an oversized input before it can overwrite unrelated state. | Stock C64 KERNAL `LOAD` has no maximum-length argument and writes each received byte before the wrapper can inspect the returned end address. Adding transparent staging would consume scarce RAM and introduce a copy. | The no-copy wrapper is valid only for the exact trusted compiler-produced D64. It publishes success only after carry and one-past-end checks, invalidates the destination range on failure, and makes no containment claim: a readable longer replacement may already have overwritten beyond the expected range before `false` is returned. No checksum, staging buffer, relocation copy, compressor, fastloader, or hostile-media runtime is added. | Keep deployable media compiler-produced and immutable. Use a separately qualified bounded transport for hostile or independently mutable media. Asset, loader, platform, safety, migration, and build-report documentation must state the possible-overwrite boundary and direct-load costs. |

### Optional safety instrumentation

AR-P10 defines two independent, default-off compiler options: existing `--bounds-check` and new
`--division-zero-check`. They provide development instrumentation without changing HLE-002 or
HLE-003 when disabled and without linking a runtime library:

- constant division by zero and constant provable out-of-bounds indexing remain compile-time errors
  in every mode;
- an enabled check evaluates and captures every source operand, base, and index exactly once, then
  fails before invoking division or forming/accessing the invalid effective address;
- a sound static proof removes a check. A surviving check permits nonzero or in-bounds assumptions
  only on the success path it dominates; mutation, aliasing, calls, or volatile effects invalidate
  a stale proof;
- C64 failure enters a source-labelled terminal block that uses no RAM or zero page. The portable
  baseline disables maskable interrupts and self-loops; it does not depend on `BRK`, a KERNAL/user
  vector, a returning handler, an error string, or a runtime object;
- NMI and external hardware remain governed by the platform. The terminal contract prevents normal
  Blend65 execution from reaching the unsafe operation, but it cannot promise that NMOS 6502
  hardware stops all activity; and
- the build report identifies enabled checks and sites and accounts for added ROM, any SFA/register
  pressure, successful-path cycles, branch/layout changes, and timing-critical consequences.

The options may be combined, but neither is an umbrella claim that all array, pointer, memory,
aliasing, or arithmetic behavior is safe. They are never enabled implicitly by an optimization,
build mode, or target profile.

### Interrupt-domain SFA and shared state

AR-P8 separates invocation-private execution storage from deliberately shared program state:

- parameters, returns, locals, argument staging, temporaries, spills, ZP pointer pairs, and helper
  scratch belong to a particular activation. Mainline, IRQ, and NMI activations that can overlap
  receive disjoint SFA homes;
- an `interrupt function` is callback-only and cannot be called through the ordinary `JSR`/`RTS`
  ABI. Its raw CPU-vector variant owns A/X/Y save/restore and terminates with `RTI`; a recognized
  firmware sink selects a distinct entry variant that honors the firmware's existing frame and
  declared chain/restore tail. An ordinary callback invoked with `JSR` from an IRQ dispatcher
  remains an ordinary function executing in an interrupt domain;
- ordinary helpers may be used from mainline and interrupt domains. The compiler creates invisible
  domain-specific machine-code variants only when absolute home references or specialized callees
  require them. A storage-free routine whose call targets remain identical may stay shared;
- IRQ/NMI masking and preemption come from the selected platform contract. A potentially
  self-nesting entry is legal only when its complete transitive path is storage-free/reentrant or a
  finite bound is proven; otherwise compilation fails instead of adding a nesting counter, dynamic
  frame selector, frame-copy protocol, or software stack;
- module/global variables, assets, and MMIO are never cloned as part of SFA specialization. They
  retain their shared identity, so real interrupt ordering remains observable;
- state proven reachable from both normal and interrupt domains is treated as asynchronously
  observable. A byte access is indivisible with respect to CPU interrupt entry, but multi-instruction
  read-modify-write sequences can lose updates and multi-byte accesses can tear. Emit a precise
  warning when an unprotected hazard is statically visible; do not silently mask interrupts or
  duplicate state; and
- preserve function identity and source-handler provenance through direct scalar
  declaration/assignment/copy, identity casts, conditional merges, and profile-recognized platform
  sinks while every source remains known and unescaped. Diagnose a known ordinary/interrupt source
  mismatch, reject erased/unknown provenance at a recognized sink, and reject a visible raw-entry
  address written to an exactly known incompatible firmware vector. A completely opaque raw address
  remains an explicit hardware boundary and cannot be certified safe.

The build report accounts for every domain variant and disjoint home. A resource failure names the
conflicting mainline/IRQ/NMI paths and the exact ROM, RAM, ZP, or stack deficit; it does not ask the
developer to duplicate ordinary helper source merely to compensate for missing compiler analysis.

Every compiler audit and specification repair must check this register. If a new target constraint
would make Blend65 differ from mainstream source behavior, add a pending entry and obtain an explicit
product ruling before implementation. If the constraint later disappears, reopen the exception
rather than preserving it for compatibility by default.

The diagnostic rescan extracts active `E#####`/`W#####` rows from Chapter 14 and the feature index.
Chapter 14 contains 182 unique active diagnostic codes and is the
only public-field authority. The feature index is navigation only. Retired or remapped meanings
remain only in Chapter 14's migration history and cannot be reassigned.

## Specification 4 Reconciliation Summary

Specification 4 keeps the established deterministic core and changes only the accepted language
and C64 authority surfaces below. Treat any contradictory compiler behavior as an implementation
finding; do not restore a removed restriction or target claim.

| Area | Current contract | Required compiler boundary |
|---|---|---|
| Loops and scope | One familiar three-clause `for`; left-to-right clause effects; ordinary lexical shadowing; same-scope duplicates use E10003 | Normal CFG and declaration identity; proof-based induction narrowing only |
| Integers and arrays | Fixed-width expression wrap; direct subscript arithmetic promotes before evaluation unless explicitly narrowed; fixed arrays have exact shape and value semantics | Preserve width barriers, exact extents, element scaling, and bounds mode through lowering |
| Aggregate values and returns | Fixed structs and arrays assign and return as values through caller-owned destinations and alias-safe construction/copy | Close destinations, snapshots, temporaries, and helper scratch through SFA before emission |
| Function values | Typed finite target sets; widening is monotonic; ordinary and interrupt handler kinds are distinct | Preserve target identity and handler kind; emit only reachable call/entry variants |
| Compile-time functions | Typed `comptime function` roots use deterministic order, exact integer trigonometry, and `comptime-budget-v1` limits | Produce no runtime code or partial artifact on budget failure |
| Placement and loading | Closed `place(...)`; typed `loadable const`; exact captured-range publication and invalidation | Platform layout/packaging owns residency; SFA owns only function execution storage |
| CPU controls and safety | Exactly `asm_sei`, `asm_cli`, `asm_php`, `asm_plp`, and `asm_nop`; variable-address PEEK/POKE; explicit bounds/division checks | Model exact effects and stack kinds; add no hidden runtime |
| Qualified target | Exactly nine C64 profiles; PRG and one D64 profile; other machines are non-normative future pressure | Reject unknown, partial, or unqualified profile IDs with E10279 |

## Diagnostic Doctrine

A diagnostic is part of the language contract, not a last-stage string. The owning stage emits one
root diagnostic with a stable code, a primary source span, useful secondary notes, and a recovery
state. Later stages must not reinterpret poison as valid typed input or crash while allocating or
emitting it. Any error suppresses the output artifact. Cascades are suppressed when they add no new
actionable cause.

AR-P9 assigns authority precisely. An owning language chapter defines the semantic predicate, rule
identity, and reject-versus-advisory consequence. Chapter 14 alone defines the public code, default
severity, canonical template/placeholders, primary and ordered secondary spans, notes/help,
suppression/promotion behavior, and retirement/replacement history. Owning chapters link to that
entry instead of repeating registries; the feature index is discovery-only. A Chapter-14 entry
cannot invent a condition without one owning rule.

Preserve uncontested codes. For a collision, retain the code for the active condition whose accepted
feature evaluation and feature-index lineage agree; otherwise obtain an explicit ruling. Allocate a
fresh code above the highest published range to each displaced valid condition; never fill gaps or
reuse a retired number. Warning promotion changes the build outcome, not its `W` identity. Only
warnings are suppressible, and a permanent warning/error class change receives a new code. Migration
keys include old source, old code, and old condition because an ambiguous old number is insufficient.

A resource failure reports the failed invariant, requested resource, selected target budget,
contributing lifetimes/paths, and a likely source or target-profile remedy.

## Source Traceability

Use citations such as
`[BLEND65-SPEC-4-5c6bac04a56b91d7d55ff570fbbf0dde5f521e2edce8901279dfa39a32c7acfa, spec/06-functions.md §FN-10]`.
A citation is an audit
pointer, not proof that the cited text is consistent. Record any new direct contradiction in the
qualification conflict register before relying on either side. When the live `spec/**/*.md` path
set changes, this module is incomplete until the table again has exact set equality.

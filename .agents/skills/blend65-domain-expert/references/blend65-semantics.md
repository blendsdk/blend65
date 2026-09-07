# Blend65 Semantics Crosswalk

> **Construction status**: Candidate knowledge for the unqualified compiler-knowledge build. This
> module routes decisions to the reconciled specification; it does not replace it.
>
> **Current source identity**: `BLEND65-SPEC-P3-ed278ab9`, exact 50-path digest
> `ed278ab974513b4975ece688d7b9a91a2346e4d0f6478c96b85a4a2bd3d50a14`. This candidate binds
> every accepted Phase-3 product ruling through AR-P41 and every consistency repair through SC-147,
> including the final no-view fixed-array, complete index-operator, loop-reachability,
> stable-query, and representable-object contracts. Earlier grades are supporting evidence only;
> the final impact audit, affected-case rerun, corrective independent grade, and formal review bind
> the changed facets to this identity. Phase 3 is complete; definitive whole-skill isolation remains
> Phase 7. Any specification edit invalidates this identity.
>
> **Closeout-audit candidate identities (invalidated)**: `BLEND65-SPEC-P3-3b90e498`, exact digest
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

Read every governing source row before deciding language behavior. The consolidated chapters
`00`–`15` are the current semantic and syntax authority. An accepted product ruling controls a
chapter-to-chapter contradiction until the chapters are reconciled. Evaluations explain intent and
rejected choices but cannot override a consolidated chapter. The feature index is a navigation and
diagnostic-mirror surface. The master grammar is a derived conformance artifact assembled from the
chapters; it does not override them. Migration, build-plan, preflight, and future-consideration files
provide history or reconsideration triggers, not current behavior.

Track two independent axes:

1. **Current behavior determined** — a governing chapter or accepted ruling gives one answer.
2. **Release consistency ready** — every derived, rationale, index, grammar, and registry copy agrees
   with that answer.

A subordinate-document mismatch can leave current behavior determined while still blocking release
consistency. Strict re-review opened SC-050..SC-054, the comprehensive evaluator opened
SC-055..SC-058, the focused Q-L29 correction rerun opened SC-059, and final correction evaluation
opened SC-060..SC-062; clean Q-L01 reruns opened SC-063..SC-066; final Q-L27 evaluation opened
SC-067; deep all-file evaluation opened SC-068..SC-072; the paired focused regression opened
SC-073..SC-075; focused final regression opened SC-076..SC-077. Subsequent strict rescans and
product rulings and derived-document repairs have closed recorded conflicts through SC-147 in the current candidate. Any genuine
contradiction returns the affected field to
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

| Exact path | Normative status | Relevant semantic concerns | Pipeline obligations | Expert module links | N/A rationale |
|---|---|---|---|---|---|
| `spec/00-feature-index.md` | Discovery index and diagnostic mirror | axioms, feature ownership, feature-to-chapter routing, diagnostic assignments, complete deferred-feature discovery through FUT-019 | use as discovery/checksum surface; preserve owning chapter meaning; Chapter 14 owns public diagnostic fields | [Authority](#authority-and-use); [Diagnostics](#diagnostic-doctrine) | None — adds navigation and registry guidance, but not independent semantics |
| `spec/00-introduction.md` | Normative design axioms | modern C-like source, SFA, no undefined behavior, explicitness, multi-platform scope | reject silent corruption and target leakage; retain deterministic behavior | [Semantic preservation](#semantic-preservation-checklist); [SFA safety](sfa-and-abi.md#interference-and-reentrancy) | None — supplies project-wide language invariants, including the bounded hardware-exception policy |
| `spec/01-lexical-structure.md` | Normative chapter | UTF-8, case, comments, identifiers, keywords, literals, closed escape spellings, maximal munch, spans | exact token kind/value/span; preserve symbolic escapes for semantic encoding; lexer recovery without target knowledge | [Frontend boundary](compiler-architecture.md#target-neutral-front-end) | None — directly governs lexing and lexical diagnostics but does not choose target byte mappings |
| `spec/02-type-system.md` | Normative chapter | primitive/derived types, promotions, casts, constants, intermediate width, wrapping, right shift | preserve width/signedness/nominal type and constant/runtime distinction through legalization | [IR semantic payload](il-and-optimization.md#mandatory-semantic-payload) | None — directly governs typing, including saturated wide shifts |
| `spec/03-variables.md` | Normative chapter | mutable/constant declarations, scope, initialization, zero page, module/local storage | distinguish constant value, module storage, function lifetime, startup initialization, ZP request | [Storage ownership](sfa-and-abi.md#storage-ownership-boundary) | None — directly governs declarations, lifetime, initialization, and placement requests |
| `spec/04-expressions-operators.md` | Normative chapter | precedence, arithmetic, logical short circuit, conditional, address-of and local-borrow lifetime, memory intrinsics | retain evaluation order, effects, place/value, widths, signedness, selected-arm control flow, and local-origin address provenance | [Optimization proof](il-and-optimization.md#two-oracle-proof); [SFA lifetime](sfa-and-abi.md#lifetime-model) | None — directly governs expressions, including assignment values, wide shifts, division-zero boundaries, and E10260 for an escaping local address |
| `spec/05-statements-control-flow.md` | Normative chapter | blocks, Boolean conditions, three-clause for loops, switch, fallthrough, break/continue/return | explicit CFG edges, clause order/effects, lexical scope, fixed-width values, reachability, diagnostic ownership | [Control-flow representation](il-and-optimization.md#control-flow-and-layout) | None — directly governs statements; `continue` reaches update, while `break` and `return` skip it |
| `spec/06-functions.md` | Normative chapter | declarations, calls, left-to-right arguments, returns, recursion, SFA, per-position non-retaining address contracts, callback-only interrupt handlers, sink-selected entry variants, address-taken functions, kind-correct relative explicit-stack state | call graph, argument/return homes, lifetime, roots, escape, preemption, transitive retain summaries, source-handler provenance, raw/firmware ABI, stack-entry ownership, and diagnostics | [SFA and ABI](sfa-and-abi.md); [Call effects](il-and-optimization.md#calls-helpers-and-clobbers) | None — directly governs calls, const aggregate parameter access, local-address retention, interrupt-domain safety, E10248 stack-state preservation, E10252 for visible incompatible vector writes, and E10260 for retaining/unknown local-address paths |
| `spec/07-structs.md` | Normative chapter | field order, composition, by-reference passing, copying, aliasing, address-of | preserve layout/order, aggregate size/alignment, by-reference alias identity and copy effects | [Aggregate homes](sfa-and-abi.md#frame-contents-and-homes) | None — directly governs aggregate semantics and representation constraints |
| `spec/08-arrays-strings.md` | Normative chapter | fixed size, indexing, initialization, Unicode-scalar source content, closed escapes, named one-byte encodings and immutable map keys, const parameters, array passing | preserve ordinary scalar and symbolic-escape identity until selected-profile encoding/map resolution; retain exact `\0`/`\xNN`; enforce mapping, map-literal form, bounds, address, mutability, alias and const effects | [Memory effects](il-and-optimization.md#memory-effects-and-volatility) | None — directly governs arrays, strings, const aggregate parameter access, exact OOB behavior, E10249 for an unavailable character/escape, and E10251 for a non-literal map argument |
| `spec/09-enums.md` | Normative chapter | byte representation, nominal identity, conversions, comparison, visibility | retain enum identity until checked conversion; lower only after semantic distinctions are consumed | [Legalization](il-and-optimization.md#legalization) | None — directly governs nominal byte-backed enums |
| `spec/10-modules.md` | Normative chapter | module/import/export resolution, entry point, startup and initialization order | complete symbol graph, entry roots, initialization dependencies, deterministic program order | [Whole-program roots](sfa-and-abi.md#call-graph-roots-and-escape) | None — directly governs program structure and dependency/effect-ordered runtime initializers |
| `spec/11-memory-model.md` | Normative chapter | segments, SFA, local-borrow liveness, frame coloring, ZP allocation, hardware-stack capacity, explicit save kinds/ownership, synchronous BRK edges, budgets | separate function storage from global/platform layout; prove borrow containment, overlays, and exact stack-state/peak bounds; charge BRK's three CPU bytes plus contracted handler peak; report resource failures | [SFA lifetime](sfa-and-abi.md#lifetime-model); [SFA closure](sfa-and-abi.md#final-storage-closure) | None — directly governs memory, lifetime-bounded local addresses, SFA, kind-aware explicit-stack accounting, and profile-bound BRK stack use |
| `spec/12-intrinsics.md` | Normative chapter | CPU control, kind-correct explicit stack operations, profile-bound BRK, volatile memory access, byte extraction, size/element-count queries, known-vector ABI rejection | exact effects and barriers, dynamic addresses, platform availability, no duplicated/elided MMIO, no cross-kind stack pulls, exact returning/non-returning BRK edge, and no misuse of a raw store as a typed installer | [Memory effects](il-and-optimization.md#memory-effects-and-volatility) | None — directly governs intrinsic type/effect contracts; explicit stack state is compile-time-only, BRK emits only `$00 $EA` and requires E10259-governed profile proof, dynamic-address scratch is compiler-owned and fully accounted, and E10252 is shared with Chapter 06 |
| `spec/13-data-inclusion.md` | Normative chapter | raw/format-aware embed, output identity, literal selector keys, pinned format versions, alignment, linker-resolved values, callable-audio provenance, exact SID metadata/profile compatibility | keep selected bytes symbolic and emit no runtime or unrequested copy; canonical-identical path/selector/representation declarations share one immutable object/address while different selected outputs remain distinct; keep selector-key interpretation inside the format handler; validate the profile's exact application/format and video/SID topology baseline; preserve native SpritePad records and keep placement-derived VIC fields outside the handler; retain an exact attached player contract without inferring SFX from PSID; keep Unknown distinct from Both and reject known incompatibility with E10261; route format, alignment, segment, and artifact work to platform layout | [Storage boundary](sfa-and-abi.md#storage-ownership-boundary) | None — directly governs asset inclusion and packaging, including exact C64 asset meanings, version rejection, qualified callable-audio provenance, and no automatic SID conversion |
| `spec/14-diagnostics.md` | Normative registry | diagnostic format, severities, codes, flags | one root cause, stable code/span/notes, recovery state, no artifact after error | [Diagnostic doctrine](#diagnostic-doctrine) | None — canonical public registry; its 177-code active set is equal to the feature-index mirror |
| `spec/15-platform-profile.md` | Normative contract | target fields, capabilities, immutable encoding/map identities, interrupt sources/sinks/entry variants/vector paths, optional exact BRK contract, explicit video standard and SID endpoint topology, hash-bound audio-player contracts, determinism, conformance, build summary | query declarative facts; keep lexer/parser target-neutral; select encoding/map and source handler kind semantically; select the exact raw/firmware entry only after target choice; reject reachable BRK without complete proof; validate SID metadata against `video_standard` and `sid_chips`; treat CPU clock as derived timing rather than SID identity; lower audio operations only through an exact compatible contract; pass facts to allocation/backend/packager | [Target composition](compiler-architecture.md#target-composition) | None — directly governs platform abstraction, named encoding/map availability, raw fallback bounds, interrupt ABI and BRK selection, callable audio, exact SID deployment identity, and the exact division/OOB policies |
| `spec/appendix-a7800.md` | Normative target profile | 6502/MARIA platform memory, shadowed ZP/stack windows, ROM format, exact ASCII-identity raw baseline, raw embed, budgets, startup/return | select A7800 facts without copying C64 backend; give each physical RAM byte one owner despite low-page aliases; resolve literals through `ascii-raw-v1` and raw assets without inventing unqualified text or PNG/TMX conversion; perform device bootstrap, run the Chapter 10 initializer schedule once, fall through into `main`, then apply the target epilogue; do not blanket-clear storage or copy a generic data segment | [Target composition](compiler-architecture.md#target-composition) | None — target-specific guidance, read only when A7800 is selected or compared; format handlers and custom-font mappings reopen with its expert-skill extension |
| `spec/appendix-a800xl.md` | Normative target profile | 6502/ANTIC/POKEY memory, ZP, XEX, exact ASCII-identity raw baseline, raw embed, budgets, startup/return | select A800XL facts declaratively; do not expose ATASCII/internal-code conversions until exhaustive maps are independently qualified; do not invent unqualified FNT/RIP/RMT parsers; preserve display-list and bank/resource constraints; run scheduled initializers once and fall through into `main` before the target epilogue | [Target composition](compiler-architecture.md#target-composition) | None — target-specific guidance, read only when A800XL is selected or compared; text maps and format handlers reopen with its expert-skill extension |
| `spec/appendix-c64.md` | Normative target profile | 6510/VIC-II/SID/CIA memory, exact PAL/NTSC timing records, explicit SID endpoint topology, ZP, PRG, exhaustive upper/graphics and lower/upper screen-code/PETSCII maps, embeds, pinned asset-format baseline, qualified player-neutral audio, KERNAL CINV/raw IRQ ABIs, stock non-returning BRK warm-start path, startup/return | compose C64 platform facts with shared 6502 backend; resolve literals through the exact encoding/map pair without changing hardware state; select no-second-save KERNAL chain/exclusive or profile-gated raw entry; reject reachable BRK because the default profile omits a complete contract; accept only exact registered application/format generations; preserve SPD v5 records/metadata and derive VIC fields from final placement; validate PSID clock/model/topology against the selected profile and exact player contract, rejecting incompatibility with E10261; lower audio operations directly with source-owned scheduling and no generic runtime or automatic conversion; keep banking/layout in platform layer; run scheduled initializers once and fall through into `main` before the return-to-BASIC epilogue | [Target composition](compiler-architecture.md#target-composition) | None — current primary platform contract, including exact SID deployment identity, character maps, CINV `$EA81` tail, E10252, stock BRK evidence/E10259, VIC-relative asset derivation, and E10256..E10258/E10261 audio ownership |
| `spec/appendix-c64u.md` | Normative target profile | C64 compatibility, REU memory, physical-SID/UltiSID endpoint deployment, turbo timing separation, proven-compatible C64 character-map and KERNAL-IRQ aliases, explicit absence of a generic BRK contract, exact single-SID audio-contract inheritance, resources, profile differences, startup/return | inherit only declared C64-compatible facts; model REU and SID endpoints as selected platform capabilities; reuse exact C64 encoding and compatible 901227-03 IRQ identities; require a separately pinned ROM/monitor profile for BRK; inherit only compatible exact single-SID player contracts and require qualified topology for multi-SID; never discover or activate SID hardware at runtime and never equate turbo CPU speed with PAL/NTSC SID cadence; require a separate profile for patched ROM/raw-vector claims; inherit initializer/fallthrough/epilogue behavior without blanket clearing or generic data copying | [Target composition](compiler-architecture.md#target-composition) | None — target-specific guidance, read only when C64U is selected or compared |
| `spec/appendix-cx16.md` | Normative target profile | 65C02/VERA/banked RAM, ZP, PRG, exact ASCII-identity raw baseline, raw embed, budgets, startup/return | select CPU variant and X16 platform independently; do not reuse C64 maps for X16's distinct character modes; never leak 65C02 forms into 6502 targets or invent unqualified PCX/BMX/music handlers; run scheduled initializers once and fall through into `main` before the target epilogue | [CPU/platform split](compiler-architecture.md#target-composition) | None — target-specific guidance, read only when CX16 is selected or compared; production text maps, depth, and format handlers reopen with the X16 expert-skill extension |
| `spec/build-plan.md` | Historical plan | locked spec-writing decisions, chapter map, completion history | no runtime semantics; use only to explain document intent or detect superseded planning claims | [Authority](#authority-and-use) | No direct compiler guidance — plan/history is subordinate to final chapters |
| `spec/evaluations/F001-multi-file.md` | Evaluation rationale | source discovery, module/file mapping, duplicate modules, deterministic compilation | preserve file/module identities and stable cross-file diagnostics | [Frontend boundary](compiler-architecture.md#target-neutral-front-end) | None — intent evidence for multi-file behavior; final chapters remain authoritative |
| `spec/evaluations/F002-modules.md` | Evaluation rationale | module syntax/naming and file relationship | keep module identity and spans through name resolution | [Frontend boundary](compiler-architecture.md#target-neutral-front-end) | None — intent evidence; final module chapter owns behavior |
| `spec/evaluations/F003-module-contents.md` | Evaluation rationale | allowed contents, visibility, initializer behavior | preserve declaration class/visibility and initializer dependency/effect facts | [Whole-program roots](sfa-and-abi.md#call-graph-roots-and-escape) | None — reconciled intent evidence; final module chapter owns behavior |
| `spec/evaluations/F004-entry-point.md` | Evaluation rationale | unique `main`, signature, startup invocation, call restrictions | identify one program root and suppress artifact for invalid entry configuration | [Roots](sfa-and-abi.md#call-graph-roots-and-escape) | None — intent evidence for entry behavior |
| `spec/evaluations/F005-memory-placement.md` | Evaluation rationale | module/function/ZP/data placement and target budgets | carry symbolic storage class and placement constraints; diagnose target resource conflict | [Storage boundary](sfa-and-abi.md#storage-ownership-boundary) | None — intent evidence for memory placement |
| `spec/evaluations/F006-address-of.md` | Evaluation rationale | addressable objects/functions, address result, restrictions | preserve object identity, escape/address-taken state, and symbolic relocation | [Escape policy](sfa-and-abi.md#call-graph-roots-and-escape) | None — intent evidence for address-of behavior |
| `spec/evaluations/F007-interrupt-functions.md` | Evaluation rationale | interrupt declaration, raw/firmware entry/exit, source acknowledgement, ZP temps, reentrancy hazard | mark asynchronous root, preserve handler identity, select exact sink ABI/clobbers/tail, model nesting/preemption/interference, and account for every variant/link; never accept double-save or silent corruption | [Interrupt domains](sfa-and-abi.md#interference-and-reentrancy) | None — reconciled intent evidence for entry variants, disjoint invocation-private homes, and genuinely shared state |
| `spec/evaluations/F008-for-loop.md` | Evaluation rationale | familiar initializer/condition/update syntax, exact clause order, normal mutation/scope/wrap, exits, canonical induction | lower every loop to correct generic CFG; preserve effects and fixed-width semantics; specialize only with proof | [Control flow](il-and-optimization.md#control-flow-and-layout) | None — reconciled intent evidence for modern source and proof-based expert loop output without a runtime or second range syntax |
| `spec/evaluations/F009-switch-statement.md` | Evaluation rationale | auto-break, explicit fallthrough, cases/default, lowering options | preserve case order/fallthrough, reachability, exact comparison type and chosen CFG | [Control flow](il-and-optimization.md#control-flow-and-layout) | None — intent and cost evidence for switch |
| `spec/evaluations/F010-signed-types.md` | Evaluation rationale | signed ranges, conversions, arithmetic/comparison/shift | retain signedness and width through constant evaluation, legalization, and selection | [IR payload](il-and-optimization.md#mandatory-semantic-payload) | None — intent evidence for signed operations |
| `spec/evaluations/F011-structs.md` | Evaluation rationale | layout, nesting, arrays of structs, by-reference calls, aliasing, access costs | retain field offsets, aggregate alignment, address identity and alias-visible order; support array-of-structs and SoA layouts without turning cost into a language restriction | [Memory effects](il-and-optimization.md#memory-effects-and-volatility) | None — intent and lowering evidence for structs |
| `spec/evaluations/F012-cpu-control-intrinsics.md` | Evaluation rationale | the current 13 CPU-control intrinsics, flags, kind-correct stack/decimal/interrupt control, profile-bound BRK, explicit low-level responsibility, volatile `peek`/`poke` boundary | represent exact machine-state effects, stack-entry kinds, ownership, ABI preconditions, and returning/non-returning BRK edges; do not reorder across barriers or inject handlers; do not recommend deferred `volatile_read`/`volatile_write` APIs as current behavior | [Machine effects](il-and-optimization.md#machine-state-and-explicit-low-level-effects) | None — reconciled intent evidence for deliberately low-level operations without allocator-accidental cross-kind register/status transfer or a fictitious generic BRK debugger |
| `spec/evaluations/F013-control-flow.md` | Evaluation rationale | if/loops, scope, definite assignment, return completeness | build explicit CFG, scope/reachability state, root diagnostic and recovery | [Control flow](il-and-optimization.md#control-flow-and-layout) | None — intent evidence for general control flow |
| `spec/evaluations/F014-arrays.md` | Evaluation rationale | arrays/strings/const parameters, arrays of structs, indexing tiers, Unicode-scalar literal content, closed escapes and named encoding/map selection | retain extent/element type, address calculation, alias/const effects and selected encoding/map identity; diagnose unavailable maps or scalar/escape mappings; treat SoA as an optional measured layout choice, never an expressiveness requirement | [Memory effects](il-and-optimization.md#memory-effects-and-volatility) | None — reconciled intent and cost evidence for arrays and compile-time encoding |
| `spec/evaluations/F015-data-inclusion.md` | Evaluation rationale | embeds, literal format-handler keys, pinned latest-stable baseline, version validation, alignment, native/derived selector costs, linker-resolved values, SID metadata/profile compatibility | keep embedded data and relocations symbolic; pass opaque selector keys only to the handler; pin the exact producing application release plus accepted signature/version; retain exact SPD v5 records and per-sprite attributes; report requested derived tables; let platform layout own visibility/alignment and VIC field derivation; preserve all PSID clock/model meanings and reject known profile/player mismatch with E10261 without conversion | [Storage boundary](sfa-and-abi.md#storage-ownership-boundary) | None — reconciled intent and platform-handler evidence, including exact SpritePad/CharPad semantics, fail-closed versioning, and exact SID configuration identity |
| `spec/evaluations/F016-type-system.md` | Evaluation rationale | type table, promotions, casts, intermediate overflow, constants | share one semantic evaluator between compile-time and runtime rules while preserving their specified differences | [IR payload](il-and-optimization.md#mandatory-semantic-payload) | None — intent evidence for typing |
| `spec/evaluations/F017-operators.md` | Evaluation rationale | operators, short circuit, expensive arithmetic tiers, shifts/comparisons | preserve effects/width/signedness; warn by semantic cost rule; choose legal lowering later | [Optimization proof](il-and-optimization.md#two-oracle-proof) | None — reconciled intent and cost evidence, including wide shifts and runtime-zero division |
| `spec/evaluations/F018-functions.md` | Evaluation rationale | function rules, SFA convention, recursion, parameter evaluation, call costs, function-relative explicit-stack state | call graph, homes, left-to-right staging, return/clobber contract, stack ownership/kind sequence, and recursion diagnostic | [SFA and ABI](sfa-and-abi.md) | None — reconciled function, stack-state, and diagnostic intent evidence |
| `spec/evaluations/F019-variables.md` | Evaluation rationale | initialization, module startup, locals, definite assignment, constants | storage/lifetime class, dependency/effect order, initial value state and diagnostics | [Storage ownership](sfa-and-abi.md#storage-ownership-boundary) | None — reconciled intent evidence for runtime module initialization |
| `spec/evaluations/F020-memory-intrinsics.md` | Evaluation rationale | volatile `peek`/`poke`, variable addresses, word order, queries | dynamic address lowering; exact access count/order/width; compile-time versus carried-count query separation | [Memory effects](il-and-optimization.md#memory-effects-and-volatility) | None — decisive intent and cost evidence; runtime-address ZP scratch is accounted through SFA |
| `spec/evaluations/F021-lexical-structure.md` | Evaluation rationale | token inventory, literal forms, closed escape spellings, ambiguous prefixes/operators, positions | deterministic maximal munch and complete source spans; preserve symbolic escape identity for later encoding with recoverable lexical errors | [Frontend boundary](compiler-architecture.md#target-neutral-front-end) | None — reconciled lexer intent; mapping availability is semantic, not lexical |
| `spec/evaluations/F022-enums.md` | Evaluation rationale | nominal enum rules, byte representation, casts and member resolution | preserve nominal identity until validated; then lower to byte without losing diagnostic context | [Legalization](il-and-optimization.md#legalization) | None — intent evidence for enums |
| `spec/evaluations/F024-conditional-operator.md` | Evaluation rationale | boolean condition, selected-arm-only evaluation, type unification | explicit branch/merge value; preserve unchosen-arm non-effects and right association | [Control flow](il-and-optimization.md#control-flow-and-layout) | None — intent and lowering evidence for conditional expressions |
| `spec/future-considerations.md` | Future consideration | deferred capabilities and exact reconsideration triggers | do not implement as current behavior; re-open when the stated deferral reason expires | [Authority](#authority-and-use) | None — no current semantics, but mandatory deferral-expiry guidance; callback/SFA deferrals are reconciled |
| `spec/grammar.ebnf.md` | Derived conformance grammar | complete source grammar and syntactic ambiguity boundaries | keep synchronized from syntax-owning chapters; parser acceptance must match reconciled chapter syntax | [Frontend boundary](compiler-architecture.md#target-neutral-front-end) | None — reconciled derived artifact; never overrides Chapters 00–15 |
| `spec/preflight-report.md` | Historical preflight context | resolved ambiguities, source integrity, readiness of spec set | no runtime semantics; use to locate decision history and identify claims requiring final-chapter confirmation | [Authority](#authority-and-use) | No direct compiler guidance — final chapters and reconciled rulings govern |
| `spec/v2-to-v3-migration.md` | Migration context | removed/changed v2 constructs and replacement direction, including initializer/startup changes | never preserve v2 behavior unless v3 normative text does; useful for diagnosing accidental legacy carryover; do not restore blanket BSS clearing or generic DATA copying | [Restriction triage](compiler-architecture.md#restriction-triage) | No independent current semantics — migration comparison only |

## Consistency Scan

The Phase-3 scan compares all 50 specification Markdown files. It does not infer correctness from the
current parser or tests. The table records the repaired grammar surfaces and their governing rules:

| Area | Governing chapter behavior | Derived grammar result | State |
|---|---|---|---|
| `let` and zero page | `let` initializer is optional; explicit zero-page declarations use one module-level `zeropage { ... }` block | preserves both distinctions | Reconciled |
| functions | return annotation is mandatory; all value types parse so semantics can accept scalar/enum returns and diagnose aggregate returns; interrupt functions declare `(): void`; read-only aggregate parameters use `name: const Type` and reject scalar/enum `const` | preserves every distinction and leaves return-type admissibility to semantics | Reconciled |
| arrays and literals | every stored array resolves to fixed `T[N]`; `T[]` is only an initializer extent placeholder or an any-size parameter carrying the full caller-array count; array literals include empty, value-list, string/encoded-string, and remaining-fill forms; no slice/span/view value exists | represents each form without redefining fill semantics or creating a first-class subarray | Reconciled |
| casts | integer casts use `Type(expression)` | obsolete `expression as Type` casts are absent | Reconciled |
| CPU intrinsics | Chapter 12 defines exactly thirteen NMOS-compatible control intrinsics | `asm_wai` is absent | Reconciled |
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
- A legal whole-struct assignment yields the assigned struct value. Lowering may reuse its
  destination only when alias and lifetime proof makes that observably equivalent; otherwise it
  uses an SFA-owned aggregate snapshot. This ruling does not make an otherwise illegal whole-array
  assignment legal and does not add struct returns or other unrelated aggregate capabilities.
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

- `for (I; C; U) B` evaluates `I` once, evaluates Boolean `C` before every possible iteration,
  executes `B` only when `C` is true, and evaluates `U` after normal body completion or `continue`.
  Omitted `C` means `true`; `break` and `return` skip `U`.
- Initializer/update expression lists evaluate left to right. A header declaration is an ordinary
  local `let` or `const`; its scope covers condition, update, and body. Mutation, no-shadowing,
  conversion, call, MMIO, and fixed-width wrap rules remain ordinary language rules.
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
  two-byte address plus full word element count. It may be forwarded to another compatible
  any-size parameter but cannot be assigned, stored, returned, or converted to exact `T[N]`.
- `length()` always has semantic type `word`. It folds for fixed arrays and loads the carried word
  count for an any-size parameter. Exact `T[N]` parameters remain address-only.
- `sizeof()` also always has semantic type `word`. Its value folds at compile time, and proof may
  narrow machine work, but crossing 255 bytes never changes the source expression's arithmetic.
- `offsetof()` always has semantic type `word` too; valid fields may begin after byte 255. Array
  extents and complete fixed array/struct sizes are computed at full precision and must fit
  `0..65535`; `sizeof(T[])` is invalid because an unsized array has no standalone fixed extent.
- Every integer type may be a final element ordinal. Direct unbarriered integer-producing operators
  inside `[]` widen byte/sbyte operands into a 16-bit signedness-preserving domain before
  evaluation. This includes unary `~`/`-`, arithmetic, shifts, and bitwise operators, so `a[i + 10]`
  with byte `i == 255` denotes ordinal 265 and `a[i << 1]` denotes 510. Comparisons/logical
  operators produce `boolean`; an explicit 8-bit cast or earlier stored or called narrow result is a
  deliberate barrier.
- Known negative or out-of-extent ordinals are E10240; non-integers are E10263. Checked runtime
  indexing tests signed lower and upper bounds. Default unchecked indexing preserves HLE-003.
  Proof may keep machine work byte-only or feed carry directly into address formation without a
  source-visible word temporary.
- A declared byte loop counter never widens silently. E10262 rejects only a proved canonical,
  finite-looking loop whose counter repeats before its invariant condition can be false and that
  has no other explicit exit. Ring cursors, timers, deliberate wrap/infinite loops, and other
  intentional modular-byte patterns remain legal. Correctly typed word induction may still lower
  to an expert byte-counter idiom under proof.

### Immutable character-map invariant

AR-P25 makes an encoding name insufficient by itself: every conversion resolves one immutable
`encoding + character-map` pair from the selected target profile. The lexer retains Unicode scalar
identity and symbolic escapes; semantic analysis performs the finite scalar-to-one-byte conversion.
No normalization, replacement, transliteration, target UTF-8, lookup table, or runtime helper is
permitted.

- C64 and C64U expose `screen_codes` and `petscii`. Their profile default is
  `screen_codes + upper_graphics`. A named call may select `"upper_graphics"` or `"lower_upper"`
  with an optional second string literal. That selection affects only the compiled literal and
  never writes `$D018` or changes the hardware character set.
- The four exhaustive maps are `c64-screen-upper-graphics-v1`,
  `c64-screen-lower-upper-v1`, `c64-petscii-upper-graphics-v1`, and
  `c64-petscii-lower-upper-v1`. Appendix A §6 owns their complete positive allowlists. Useful
  sentinels are default screen `"AZ0 £↑←"` → `$01,$1A,$30,$20,$1C,$1E,$1F`, lower/upper screen
  `"Az"` → `$41,$1A`, and lower/upper PETSCII `"Az"` → `$C1,$5A`. ASCII lookalikes never replace
  `£`, `↑`, or `←`; reverse-video bytes require exact byte input.
- C64U aliases these identities only through its stated C64-compatibility mode. It does not create
  a similar-but-unproven C64U map.
- A7800, A800XL, and X16 currently use only `ascii-raw-v1`, the exact U+0000..U+007F identity map.
  This is a neutral byte baseline, not a display-encoding claim. X16 and Atari named encodings stay
  inactive until their own expert extensions supply exhaustive source-backed maps; never clone the
  C64 tables because a target looks Commodore-like.
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
| HLE-002 | Accepted and reconciled | Managed languages commonly trap or throw for integer division by zero; C-family systems languages may leave it undefined. | The 6502/6510 has no division/remainder instruction or native zero-divisor trap, and Blend65 may not inject a mandatory runtime handler. | Constant zero is a compile-time error. By default, a runtime zero divisor terminates with an unspecified valid-width result while preserving the bounded effects above. No mandatory check, trap, catch path, handler, fallback, special result, or zero-handling scratch is emitted. Default runtime cost beyond the selected division sequence: zero. | Test the divisor explicitly when a defined fallback is required. Operator, safety, optimization, and migration documentation must distinguish this bounded unspecified result from both an exception and C-style undefined behavior. Optional instrumentation may be selected explicitly and cannot change the default. |
| HLE-003 | Accepted and reconciled | Memory-safe and managed languages normally check array bounds; JavaScript-style arrays do not expose unrelated physical memory. C permits unchecked access only as undefined behavior. | The 6502 has a 16-bit address space with no bounds or memory-protection trap, and Blend65 may not inject mandatory bounds handling. | A constant provable out-of-bounds access is a compile-time error. By default, runtime indexing emits no implicit check, trap, clamp, or modulo-array-length code. It computes the effective address modulo 65536; a multi-byte element continues byte by byte across `$FFFF` to `$0000`, and every byte observes the active target memory map, banking, and MMIO effects. The optimizer may use a sound range proof but may never assume an unproved index is in range. Default bounds-handling runtime cost: zero. | Guard a dynamic index explicitly when its source may exceed the array extent. Array, safety, optimizer, C64 memory-map, and migration documentation must state the exact address-wrap and MMIO/banking consequences prominently. Optional instrumentation may be selected explicitly and cannot change the default. |
| HLE-004 | Accepted and reconciled | A normal modern function may be called from several contexts while each simultaneous invocation retains private parameters, locals, and temporaries. Shared globals remain shared. One source interrupt handler should not require the developer to hand-write a different prologue or remember an inherited decimal flag for each platform entry path. | Raw 6502 interrupt entry uses `RTI`, firmware may already own saved registers and a restore tail, NMOS entry does not clear decimal mode, ordinary calls use `RTS`, and SFA provides only a finite statically allocated set of invocation homes. NMOS indirect `JMP ($xxFF)` also wraps its high-byte fetch. Unbounded same-entry nesting cannot select infinitely many homes without runtime dispatch or a dynamic stack. | An `interrupt function` is callback-only. A recognized sink selects its raw or firmware-mediated entry variant; C64 KERNAL variants never save A/X/Y twice. The compiler establishes binary mode before Blend65 handler/helper code, preserves the interrupted or chained status, and places saved indirect vectors page-safely. Ordinary helpers remain reusable across mainline/IRQ/NMI domains; the compiler creates disjoint SFA homes and only the entry/body variants required. A potentially self-nesting storage-bearing path that cannot be bounded is a compile-time error. No generic dispatcher, runtime selector, frame copy, or dynamic stack is added. All ROM/RAM/ZP/stack/cycle costs are reported. | Use `c64.system.setIRQ` normally; use the exclusive or raw tier only when taking the corresponding IRQ/firmware/banking ownership. Use `bcd_add()`/`bcd_sub()` for packed decimal; `asm_sed()` remains only a raw expert hardware-state escape. Keep reusable logic in ordinary helpers. Shared single-byte state remains genuinely shared; protect read-modify-write or multi-byte state when ordering/atomicity matters. Function, interrupt, concurrency, SFA, platform-API, diagnostic, and migration documentation must explain the ABI, source acknowledgement, decimal boundary, and shared-state boundary. |
| HLE-005 | Accepted; frozen language rule reconciled | Managed and memory-safe languages normally initialize storage or reject every read that is not definitely assigned. | Automatically clearing all mutable storage adds startup bytes/cycles, while rejecting every deliberate scratch-buffer or externally populated storage pattern would impose a compiler-convenience restriction on constrained 6502 programs. The 6502 provides existing RAM bits and no automatic initialization facility. | A mutable declaration without an initializer emits no initialization code and initially contains its existing stored bits. A read yields a valid-width value with ordinary fixed memory/MMIO effects; it is not optimizer undefined behavior. W10190 reports a function-local control-flow path that may read before first assignment. Module-level storage is exempt from that warning. Runtime cost: zero bytes and zero cycles. | Initialize storage explicitly before a value matters, or deliberately overwrite/populate it before reading. Variable, startup, optimizer, diagnostics, safety, and migration documentation must state the indeterminate-bit contract and the exact warning scope. |
| HLE-006 | Accepted and reconciled | A high-level decimal API normally accepts decimal values and reports invalid input rather than exposing a processor-specific result. | Packed BCD is stored in ordinary bytes, and the 6502 has no validity trap or tag. Checking every runtime nibble would add branches, bytes, cycles, and timing variation to a deliberately zero-runtime operation. The CPU manuals define decimal arithmetic over valid packed decimal digits, not a portable high-level meaning for invalid digits. | `bcd_add()`/`bcd_sub()` reject a statically known nibble `$A`–`$F` with E10254. With runtime-invalid digits, they return the selected CPU's exact bytewise decimal `ADC`/`SBC` result for the specified carry sequence. No default validation, trap, helper, or hidden scratch is emitted. The optimizer may assume decimal digits only when it has proof. | Validate untrusted runtime BCD explicitly or produce it through validated decimal operations. Language, target, optimizer, diagnostics, and migration documentation must state that runtime-invalid BCD is a hardware-limited exception whose result is bound to the selected CPU. |
| HLE-007 | Accepted and reconciled | Memory-safe languages reject references that outlive a local; managed languages may instead promote escaping storage to a heap. C permits a dangling automatic-local address only through undefined behavior. | SFA has a finite compile-time set of invocation homes, while Blend65 has no heap, dynamic frame allocator, ownership runtime, or undefined behavior. Pinning silently would turn an automatic local into shared static state, and bounded multi-home allocation cannot support addresses retained across an unbounded number of sequential calls. | `&local` creates a compiler-tracked borrow bounded by the local's dynamic source lifetime. Local-origin provenance survives copies and derivations. A proven non-retaining call chain may use the address while the local is alive; E10260 rejects return, longer-lived storage, asynchronous/hardware publication, retaining/unknown calls, and opaque escape. Legal use extends SFA liveness. Sequential lifetimes may reuse one home; bounded concurrent domains receive disjoint homes and address-specific code variants when required. No heap, runtime check, hidden persistent home, or implicit static-local conversion is added. | Use module-level storage for a program-lifetime address or let the caller own and pass the aggregate. The language, function, SFA, optimizer, diagnostic, interrupt, and migration guides must explain the lifetime, provenance, non-retaining-call, repeated-call, and domain-overlap rules. |
| HLE-008 | Accepted and reconciled | Mainstream languages commonly offer resizable arrays, heap-backed collections, or first-class slices/views. | Blend65 targets machines with very small fixed memory maps and has no heap, allocator, garbage collector, or general runtime. Hidden capacity, ownership, growth, or descriptor lifetime would add memory and semantic machinery that the selected platforms cannot afford transparently. | Every stored array is a fixed contiguous `T[N]` object. `T[]` is only an initialized-storage extent placeholder or a whole-fixed-array any-size parameter carrying an address and word element count. It cannot be stored or returned, and it creates no dynamic array, slice, span, view, allocation, copy, helper, or runtime. Runtime cost beyond ordinary address/count parameter passing: zero. | Choose a compile-time maximum, use a separate logical count when only part of the storage is active, or build an explicit fixed-capacity pool/ring for the game workload. Array, function, ABI, SFA, and migration documentation must explain fixed storage, the two contextual `T[]` roles, and the exact any-size parameter cost. |
| HLE-009 | Accepted and reconciled | Mainstream host languages can represent collections and aggregate objects larger than 65535 bytes and may expose platform-sized size/offset queries. | Blend65's current 6502-family model has a 16-bit address space, `word` is its widest integer, any-size array parameters carry a word count, and no wider integer/runtime address model exists. | Array extents must be integers in `0..65535`; every complete fixed array or struct type must occupy `0..65535` bytes. `sizeof()` and `offsetof()` are stable compile-time `word` values. E10264/E10265 reject out-of-domain types and E10266 rejects `sizeof(T[])`; no runtime check, helper, metadata, or wider arithmetic is emitted. | Split data into separately placed/banked fixed objects when one logical asset exceeds an addressable object, and pass each complete fixed array normally. Array, struct, query, diagnostic, SFA, placement, and migration documentation must state the exact limits and compile-time failures. |

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
Both surfaces now contain the same 177 unique codes: 148 errors and 29 warnings. Chapter 14 is the
only public-field authority. The feature index is a discovery mirror. Retired or remapped meanings
remain only in Chapter 14's migration history and cannot be reassigned.

## Reconciled Conflict Register

The original contradictions remain recorded so later edits cannot accidentally restore them. Every
settled row below has an accepted ruling and a matching specification repair under the source
identity above. A newly observed contradiction must be added as a blocked row
rather than silently reopening a settled meaning.

SC-026 through SC-033 were never assigned. Their absence is preserved as identifier history and
does not represent an unresolved conflict.

| ID | Reconciled surfaces | Durable resolution | Status |
|---|---|---|---|
| SC-001..SC-003 | feature index, Chapter 06, F018, Chapter 14 | Function codes retain E10170–E10176 and E10180–E10181 meanings; there is no parameter-count limit. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-004 | Chapter 10, F003, F019 | Module `let` initializers accept legal non-`void` expressions and run once before `main` in deterministic dependency/effect order. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-005 | Chapters 02 and 04 | Wide `<<` yields 0; wide signed-negative `>>` yields -1; other wide `>>` yields 0. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-006 | Chapter 05, F008, examples | The former range-loop direction/bound/step contract was reconciled at this checkpoint. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-007 | introduction, Chapter 06, F007/F018, future considerations | `interrupt function` is callback-only; recognized sinks select raw or firmware entry variants; ordinary helpers use `RTS`; overlapping invocation-private storage is disjoint; globals/assets/MMIO remain shared. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-008 | Chapter 13, C64 appendix, F015 | CharPad component meanings, placement, and VIC register derivation are separate and zero-copy. Canonical `"tiles"`/`"map"` use the smallest lossless `byte[]` or little-endian `word[]`; explicit forced-word, exact packed-12, and independently selected low/high planes provide all useful 8/12/16-bit C64 layouts; no representation truncates or silently emits another. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-009 | Chapter 12, F020 | A runtime-address memory intrinsic may require a compiler-owned two-byte ZP pointer, charged through SFA/resource accounting. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-010 | Chapters 04/05, F024, grammar | Assignment is a lowest-precedence, right-associative value expression with exactly-once target/RHS/store rules. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-011 | Chapters 06/08, F014/F018, grammar | Read-only aggregate parameters use `name: const Type`; constness is transitive and has no ABI cost. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-012 | Chapter 04, F017, Chapter 15 | Constant zero division is E10160; runtime zero has a bounded unspecified result with no default injected handling. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-013 | Chapter 08, F014, Chapter 15 | Default dynamic OOB indexing wraps the 16-bit effective address; optional checks are explicit inline instrumentation. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-014 | syntax-owning chapters, grammar, lexical/migration copies | The derived grammar now matches declarations, arrays, casts, literals, intrinsics, and bounded embed syntax. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-015 | Chapter 05, grammar | General expression statements are legal and do not reuse W10131. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-016 | owning chapters, feature index, Chapter 14 | Owners define predicates/consequences; Chapter 14 defines public fields; both active sets contain 177 codes (148 errors, 29 warnings), and collision/retirement history is durable. W10190 applies only to function-local definite assignment; W10121, range-only E10060/E10061/E10062/E10064/W10060, and array-width E10085/E10117/E10118/W10142 are retired. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-017 | Chapters 06/11/15 and F018 | Stack overflow compares the simultaneous program peak with derived usable capacity; W10180 uses the explicit profile threshold or the defined 80%-rounded-down default. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-018 | Chapters 03/10 and all five target appendices | Target startup performs only selected device bootstrap, executes each scheduled module/zeropage initializer once, falls through into `main`, and applies the target return epilogue; it does not blanket-clear uninitialized storage or copy a generic data segment. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-019 | Chapters 07/08, F011, F014 | Arrays of structs are valid v3 source. SoA is an optional, measured layout choice; its possible cost advantage cannot become a language restriction. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-020 | Chapter 12, F012, F020, future considerations | Current memory access uses volatile `peek`/`poke` intrinsics. Separate `volatile_read`/`volatile_write` APIs remain deferred and cannot be recommended as current behavior. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-021 | feature index, future considerations | Deferred-feature discovery includes the complete FUT-001 through FUT-019 set. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-022 | `AGENTS.md`, source manifest, compiler architecture, IL/optimization doctrine | ACME selection and automatic GitHub parity-debt recording are explicit product/process policy, not language, hardware, or optimizer semantics. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-023 | Chapters 03/10, target appendices, v2-to-v3 migration | The migration guide now reflects scheduled one-time `let` initialization, no emitted initialization for omitted initializers, and image-resident aggregate constants; it no longer restores obsolete blanket BSS clearing or generic DATA copying. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-024 | Chapter 03, Chapter 14, feature index, v2-to-v3 migration | Variable shadowing is E10101. E10031 remains exclusively the prohibition on `const` declarations inside `zeropage`. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-025 | Chapters 01/08/15, all target appendices, F014/F021, grammar, feature index, Chapter 14, migration | The full closed escape syntax is target-neutral; `\0`/`\xNN` are exact, every other escape and ordinary literal scalar uses the selected compile-time one-byte encoding/map, and E10249 rejects an unavailable mapping. C64/C64U use game-oriented screen-code defaults; unqualified future targets use the exact raw identity baseline until their specialized maps are qualified. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-034 | Chapter 13, F015/F016, grammar, feature index, Chapter 14, migration, future considerations | Format-aware import requires a literal path and, when supplied, a literal selector. The exact case-sensitive selector is handler-owned, may be file-derived, and creates no core query language. A registered handler resolves an explicit selector, its one documented default, or E10132; E10250 rejects a non-literal selector. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-035 | Chapter 13, C64 appendix, F015 | Initial handlers qualify against an exact latest-stable application release and accept only the file's pinned observable signature/version; an application release not encoded in the file is provenance, not a detectable rejection predicate. Unsupported, malformed, old, and new format versions are E10204. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-036 | Chapter 13, C64 appendix, F015 | SpritePad Pro 3.80 SPD v5 uses exact 64-byte sprite records and a word-sized count; sprite mode/color/expansion/overlay are per-record attributes, optional components remain typed, requested derived tables are costed, and VIC block values come from placement operations rather than asset selectors. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-037 | Chapter 04, F017 | For a nonzero divisor, quotient truncates toward zero and `r = a - q*b`; a nonzero signed remainder has the dividend's sign. Shift/mask strength reduction requires a proof of equivalent signed behavior. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-038 | Chapter 13, C64/C64U appendices, F015, future considerations | Classic 10,003-byte Koala files expose only bitmap, screen, color-RAM, and background components after exact load-address/layout/color validation. Bitmap/screen `$D018` fields derive from final common-bank placement; color-RAM transfer remains explicit and costed. Native decomposition is distinct from deferred modern-image conversion. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-039 | Atari appendices, F015 | Initial Atari 7800 and Atari 800XL profiles expose raw embedding only. PNG/TMX and FNT/RIP/RMT handlers reopen only with the relevant target's separately researched skill extension and exact source, format, selector, layout, placement, cost, failure, and fixture qualification. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-040 | Commander X16 appendix, F015 | Commander X16 remains a first-class planned target but its initial profile exposes raw embedding only. Its separately qualified platform-skill extension owns production W65C02/VERA/banking depth and reopens asset handlers, beginning with official ZSM revision 1; the stale `.zcm` identity is invalid. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-041 | Chapter 02, F010 | Same-size integer casts preserve bits and add no conversion sequence, but distinct source variables remain independent objects. Storage coalescing requires ordinary liveness, alias, volatility, and interference proof; representation equality never creates an alias. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-042 | Chapter 13, Chapter 14, F015 | E10140 applies to an explicit length mismatch for any embedded array element type. E10204 owns malformed or unsupported recognized-format input and remains part of F015's active diagnostic summary. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-043 | Chapter 06, v2-to-v3 migration, SFA/ABI reference | The v3 ABI uses caller-stored static-frame parameter homes, with scalar/enum values copied and aggregate base addresses passed by reference; scalar/enum returns use A or A/X. A different ABI needs a future versioned specification decision. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-044 | Chapter 04, F017 | The cost table now distinguishes unsigned/proven-nonnegative power-of-two division and remainder from signed operations that need sign-aware correction or general lowering. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-045 | Chapter 06, v2-to-v3 migration | Removing the v2 `callback` keyword does not turn every callback into an interrupt handler. Ordinary callbacks remain ordinary `RTS` functions referenced with `&name`; callback-only `interrupt function` declarations use the raw or firmware variant selected by a recognized platform sink. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-046 | Chapter 05, F008 | Historical range-only syntax had three directions: `until`, `to`, and `downto`. SC-131 supersedes that whole design: current Blend65 has only the three-clause `for`, and the former range words are ordinary identifiers. | Superseded by SC-131; no current range-loop syntax survives |
| SC-047 | Chapter 01, future considerations, v2-to-v3 migration | `type` is reserved but unusable in v3. Type aliases are rejected under REJ-001 and are not a provisional current feature. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-048 | Chapter 01, F021 | The declared token enumeration contains 32 operator tokens and 79 total token types. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-049 | Chapters 01/08/15, all target appendices, F014/F021, grammar, Chapter 14, feature index | Literal tokens preserve exact Unicode scalar values. Every current target encoding is a finite compile-time scalar-to-one-byte map; absent ordinary characters/symbolic escapes and non-single-byte character results are E10249. There is no normalization, replacement, UTF-8 target emission, or runtime conversion; `\0`/`\xNN` remain exact. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-050 | Chapter 15, target appendices, Chapter 08/F014 examples, Chapter 14, feature index | Every effective encoding binds to an immutable map identity. C64/C64U expose exact upper/graphics and lower/upper screen-code/PETSCII maps with a literal per-call override and no hardware change; A7800/A800XL/X16 use `ascii-raw-v1` until separately qualified target maps exist; custom charsets require explicit metadata. E10125/E10249/E10251 own map availability, scalar availability, and argument form. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-051 | Chapter 01, Chapter 08, F021, grammar | Character literals are valid non-ASCII literal contexts, and every grammar now accepts the same single scalar set: any scalar except quote, backslash, CR, and LF. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-052 | F015, Atari appendices | The stale PMG `base_page` selector example is removed; current Atari profiles remain raw-embed-only until their target extensions qualify handlers. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-053 | Chapter 06, SFA/ABI reference | A function has one logical frame layout and as many disjoint static instances as simultaneously live execution domains require; the total after coloring is compile-time known. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-054 | Chapters 06/12/15, C64/C64U appendices, F006/F007/F012/F020, migration/future guidance, SFA/ABI, architecture/IL, source manifest, and Q-L29/Q-P07 | One source-level `interrupt function` materializes as the recognized sink's entry variant. Default `c64.system.setIRQ` uses a no-second-save CINV variant and chains a two-byte saved previous handler; `setIRQExclusive` uses the no-second-save `$EA81` KERNAL restore tail; `setRawIRQ` is available only from a profile with a proven writable/active raw vector and uses compiler save/restore/`RTI`. Handlers acknowledge their declared source, ordinary helpers remain `JSR`/`RTS`, all costs are static/reported, no generic dispatcher/runtime exists, and visible `pokew($0314, &interruptFunction)` is E10252. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-055 | F016, F019, governing Chapters 02/03/10 | Evaluation documents explain rationale and rejected alternatives; they are not independent semantic authority and cannot call themselves the single source of truth. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-056 | F019, Chapters 03/10, target appendices | Startup uses the selected platform bootstrap. Scheduled initializer bodies may call ordinary functions. Only the final transition from completed initialization into `main` is guaranteed to use fallthrough rather than `JSR`/`JMP`. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-057 | Chapter 01, F021 | The lexical surface contains three literal categories: integer, character, and string. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-058 | Grammar definitions and production index | The historical P3-001b1331 grammar contained 92 definitions and index rows. The current SC-131 candidate adds four for-loop productions, giving 96 definitions and 96 unique index rows. A line comment ends at the lexical LF byte or EOF; it does not reference an undefined `newline` production. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-059 | Chapters 06/12/15, C64/C64U appendices, F007/F012/F018, architecture/IL/SFA references, source manifest, Q-L29/Q-P07 | NMOS interrupt entry establishes binary mode before Blend65 handler/helper execution. Default CINV chaining preserves entry flags with `PHP; CLD`/`PLP`; raw/exclusive variants use `CLD` and eventual `RTI` restoration. The two-byte saved chain link cannot begin at `$xxFF`; all bytes, cycles, and stack costs are reported and proof-based elision must preserve both boundaries. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-060 | Master grammar, Chapter 01, F021 | Lexical character sets use ISO special sequences rather than comment notation; line-comment terminators are explicit special sequences; and every operator production includes `?`. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-061 | Chapter 04, Chapters 05/06, architecture/IL/SFA references | Immediate expression subexpressions evaluate exactly once from left to right unless a more specific short-circuit, selected-arm, assignment, or call rule applies. Associativity changes grouping, not observable effect order. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-062 | Chapter 14, Chapter 06, semantics/architecture references | A root error poisons its rejected construct. Diagnostics caused only by that poison are suppressed, independently provable violations still emit, and no poisoned construct reaches lowering or artifact production. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-063 | Chapters 01/08, F014/F021, master grammar | Every lexical grammar surface spells reverse solidus, HT, CR, LF, and end-of-file as unambiguous ISO special sequences; no source-language escape convention is assumed by the EBNF metalanguage. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-064 | Migration guidance, Chapter 14, feature index | Migration guidance reports the same active diagnostic inventory as the governing registry. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-065 | Chapter 04, master grammar | `conditional_expr` always admits a plain logical-or expression and optionally adds the right-associative `? :` tail in every grammar fragment. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-066 | C64 appendix, F015 | SpritePad's governing target contract declares `"sprites"` as the default when the selector is omitted, matching the accepted evaluation. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-067 | Chapter 15, C64 appendix, F015 | The generic platform-profile example names only SpritePad's real `"sprites"` default and delegates the exhaustive selector set to the target profile; it does not advertise a fictitious `"colors"` selector. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-068 | Chapter 06, F018/F019, master grammar | Function and variable type fragments use one non-recursive array-element production with an optional extent, admitting supported unsized parameters while excluding deferred multidimensional arrays. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-069 | Chapter 04, master grammar | The expression fragment admits every current primary class, including primitive casts, aggregate literals, intrinsics, and embedding; it does not narrow the master grammar. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-070 | F005/F014/F019/F020 and governing Chapters 03/08/12 | Evaluation grammar fragments require a non-empty zeropage block, permit ordinary initializer and array-base expressions, accept any array-typed `length` expression, and apply semantic constant evaluation to the full expression grammar. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-071 | Chapters 01/08, F014/F021, master grammar | Every scalar-exclusion special sequence names quote, reverse solidus, CR, and LF by Unicode code point, avoiding source-escape or quote-spelling conventions inside EBNF prose. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-072 | Chapters 03/10 and target appendices | Chapter 03 governs declaration/initializer semantics, Chapter 10 governs cross-module startup scheduling, and the selected target appendix governs bootstrap/epilogue behavior; no chapter claims all three. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-073 | F024, Chapter 04, master grammar | F024's optional conditional tail uses the declared ISO concatenation commas and matches the governing right-associative expression production. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-074 | Chapter 15, target appendices, F018, Chapters 06/08/14 | The unsupported `warn_frame_size` profile surface is removed; exact frame sizes remain reported. Array thresholds use W10143, W10030 remains zero-page usage, W10180 remains hardware-stack peak, and W10191 remains unused-variable. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-075 | C64 appendix, Chapter 15, F015 | The initial SID handler has one exact current selector set: `"data"` (also the default), `"init_address"`, and `"play_address"`. Unsupported header-metadata/data-size selectors are not advertised. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-076 | C64 appendix, Chapter 15 | C64 documentation reports exact SFA frame/instance costs and total RAM fit without claiming the removed arbitrary single-frame warning. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-077 | Chapter 08, F014, master grammar | Value-list array literals do not accept a trailing comma; the derived master grammar cannot independently add that syntax. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-078 | Chapter 13, C64/C64U appendices, F015, source manifest | The initial SID handler is pinned to the official HVSC format-description snapshot and accepts one exact self-contained PSID v1–v4 subset with deterministic validation, address resolution, rejection, fixed-placement rules, and exact SC-133 profile/player compatibility. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-079 | Chapters 03/07/11/13/15, F005/F011, C64/C64U appendices | Every resource warning has an exact profile field or default formula, rounding rule, comparison, and advisory consequence. Frame-size warning policy remains removed. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-080 | Chapter 12, F012/F020 | CPU-control calls omit the statement semicolon in their expression grammar. All intrinsics are reserved built-in function identifiers with E10212 redeclaration. Its earlier depth-only explicit-stack conclusion is superseded by SC-128. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-081 | Chapters 03/07/08/09, F011/F014/F019 | Enum constants are scalar/inlined; enum fields and enum arrays are legal; aggregate summaries exclude `void`. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-082 | Chapter 08, F014, master grammar | Array fragments use the master production names and expression forms, with no undefined stale aliases. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-083 | Chapters 02/06/14, F018 | Return expressions use assignment compatibility and the matching conversion diagnostic. E10172 is exclusively argument mismatch. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-084 | Chapters 01/08/13/14, F014/F015, grammar, index, migration | Empty strings and zero-length arrays are valid zero-byte values with deterministic indexing/address behavior. E10111 is retired; E10131 remains an empty-raw-input policy error. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-085 | Chapter 15, C64/C64U appendices | `$0801`–`$CFFF` is consistently 51,199 bytes; overlapping code/data/mutable/SFA placements fit collectively rather than treating budget maxima as separate pools. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-086 | F014/F018 | Diagnostic-count summaries match their tables, and function resource accounting covers complete SFA closure, all static instances, and full simultaneous hardware-stack peak. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-087 | Chapter 15 | A present `warn_array_size` fires W10143 at `measured >= threshold`, must be in `1..65535`, and has no inferred default; omission disables only that advisory warning. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-088 | Chapter 15, C64 appendix | Every duplicate of the default C64 profile advertises the same complete initial format-handler set. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-089 | F020, master grammar | Memory-intrinsic grammar fragments use the declared `type` and `qualified_name` productions for `sizeof` and `offsetof`; no undefined `type_name` alias remains. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-090 | Chapter 08, F014 | Historical address-only any-size-parameter rule. Superseded by SC-134: an any-size parameter now carries the complete fixed argument's word element count, and `length(parameter)` reads it. | Superseded by SC-134 under BLEND65-SPEC-P3-ed278ab9; exact-identity affected evaluation passes; independent correction grade passes |
| SC-091 | C64 appendix | The default PRG image starts at `$0801`; its 12-byte BASIC auto-start line occupies `$0801`–`$080C` and enters generated startup at `$080D`. No byte at unloaded `$0800` is part of the stub. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-092 | Chapter 12, F012 | W10120 is retired. E10255 rejects a raw `asm_sed()` path that reaches ordinary arithmetic, address formation, a call, a terminal, or a mismatched-D join before `asm_cld()`. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-093 | Chapters 03/05, master grammar | Variable fragments use `value_type`; local constants require `const_expression`; top-level `let`/`const` accept optional `export`, while local declarations do not. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-094 | F014, Chapter 06, Chapter 14 | A sized-array argument mismatch uses canonical argument diagnostic E10172; no placeholder diagnostic is published. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-095 | C64 appendix | The 35-byte default W10110 threshold is described as approximately, not at least, one quarter of the 142-byte allocatable zero-page budget. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-096 | Chapter 11, Chapter 15, C64 appendix | The default C64 memory example uses the canonical `$02`–`$8F` 142-byte zero-page budget and shared `$0801`–`$CFFF` program span. Its inclusive segment and total sizes are arithmetically exact. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-097 | Atari 7800 appendix | Placeable code and const data end at `$FFEF`. The packaging-owned `$FFF0`–`$FFFF` verification/vector trailer is reserved, and the `$8000`–`$FFEF` inclusive budget is exactly 32,752 bytes. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-098 | Chapter 08, F014, grammar, diagnostic registry/index | Array storage always has a compile-time-known extent: explicit `[N]` or an extent-inferencing initializer. Struct fields and uninitialized storage require an explicit extent, and E10253 owns the rejection. Its former address-only any-size-parameter clause is superseded by SC-134. | Retained storage rule; parameter clause superseded by SC-134 under BLEND65-SPEC-P3-ed278ab9; exact-identity affected evaluation passes; independent correction grade passes |
| SC-099 | Chapters 13/15, target appendices | `embed_formats` contains signature/version-validating handlers only. Format-neutral one-argument raw-byte embedding, including `.bin` and `.prg`, is the universal fallback and is never registered as a `raw_binary` handler. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-100 | Chapter 03, target appendices | The zero-page comparison table reports the exact current default-profile budgets and ranges—C64/C64U 142, CX16 94, A800XL 128, and A7800 64—while leaving custom profiles free to choose other proven-safe ranges. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-101 | Chapter 15, C64/C64U appendices | The duplicated default C64 profile uses the selected PAL record's exact `0.985248` MHz derived CPU clock and names the NTSC record's exact `1.022730` MHz value; timing reports do not use a rounded value as machine identity. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-102 | Chapters 13–15, F015, feature index | W10150 measures embedded bytes against `max_binary_size`; its public message and rationale call this the binary-size budget, not an undefined data budget. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-103 | Chapters 03/11/15, C64 appendix, F019 | A contiguous load image serializes emitted bytes and internal padding as one prefix, then reserves mutable/SFA storage as a trailing non-emitted BSS suffix. Reports distinguish emitted payload from the complete shared-range footprint. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-104 | Chapter 05, F008, master grammar | For-loop declaration fragments use `value_type`, matching the master grammar; integer-only counter legality remains a semantic restriction. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-105 | Chapters 02/14, F010/F016/F024, feature index | Diagnostic examples retain mandatory declaration annotations and distinct names so E10081/E10162 are isolated from E10150/redeclaration errors. E10150's public template covers variables, constants, and parameters; a missing return annotation remains E10170. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-106 | Chapter 01, Chapter 08, F021 | String examples use inferred extents, so `"HELLO WORLD"` owns exactly 11 bytes and `""` owns zero; they do not accidentally trigger const-array incompleteness. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-107 | Chapter 13, F015, target appendices | `embed()` dispatch is total: a registered extension always validates through its handler and uses the explicit selector, its default, or E10132; only an unregistered extension without a selector is raw fallback, while one with a selector is E10137. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-108 | Chapter 06, F018, master grammar | Function parameter and return fragments use the shared `value_type` production and do not define a stale competing `type_expr` alias. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-109 | Chapter 15, target appendices | A profile requires a target ID, supported CPU identity, positive selected clock, and load address. Reset-vector presence is determined by the packaging contract, and an explicit stack-warning threshold must fit usable capacity. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-110 | Chapters 08/14/15, F014, feature index, A7800 appendix | W10141 requires a nonzero uninitialized mutable array. W10143 measures one mutable array's RAM allocation at `>= warn_array_size`; const arrays do not trigger it. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-111 | Chapters 01/08/10/15, F004/F014/F021, master grammar | Twenty-nine intrinsic names are globally reserved, including both BCD operations and four target-encoding names. `main` is separately entry-reserved: only the exact entry declaration is legal, and E10020–E10023—not E10212—govern it. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-112 | F018 | The complete function error summary includes missing-path return, interrupt-sink ABI, local-address escape, and unbounded overlap/stack errors: 17 errors plus 2 warnings. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-113 | CX16 appendix | The default BASIC-loaded PRG controls `$0801`–`$9EFF`, exactly 38,655 bytes. Physical `$0800` is outside the load image and cannot satisfy code/data/BSS placement. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-114 | Chapter 15, A800XL appendix | XEX serializes ordered, non-overlapping emitted intervals and RUNAD, omits mutable/SFA BSS holes, and reports emitted container bytes separately from the full shared footprint. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-115 | Chapter 13, F015, target appendices, SC-034/SC-107 | Format-aware `embed()` always has a literal path; a selector is literal when present. Registered handlers resolve explicit/default selector dispatch or E10132. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-116 | Chapter 07, F011 | W10112 fires only when two mutable struct arguments at one call site are statically proven to designate the same base storage; may-alias uncertainty alone does not warn. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-117 | Chapter 04, F017 | W10170/W10171 fire exactly for selected software-helper calls. W10172 fires for a selected constant-multiply sequence containing a shift plus add/subtract; one power-of-two shift is excluded. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-118 | Chapters 13/14, F015, feature index | Identical canonical path/selector/representation outputs are one immutable object and address. W10151 reports the aliasing; bytes and fixed placement occur once. Different components are distinct. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-119 | Chapter 04, F006, master grammar, diagnostics/index | Address-of parses a unary operand so invalid forms receive semantic diagnostics. E10042 owns field/element forms; E10043 owns every other non-name literal/expression. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-120 | Chapters 03/04, F006/F019/F020 | Published 6502 byte/cycle examples use exact immediate, zero-page, and absolute instruction costs and distinguish intrinsic cost from argument/result materialization. Aggregate startup costs are selected-lowering totals, not a false fixed multiplier. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-121 | Chapter 11, A7800 appendix | A7800 code and const data share ROM `$8000`–`$FFEF`; default mutable/SFA storage uses the conservative `$2200`–`$27FF` general-allocation range. `$FFF0`–`$FFFF` is packaging-owned, with vectors at `$FFFA`–`$FFFF`. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-122 | Chapter 06, F018 | Call-cost examples separate the four-byte, twelve-cycle `JSR`/`RTS` core from parameter stores, result materialization, body work, and addressing-mode-dependent costs. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-123 | Chapter 04, F003, F017 | Multiplication and modulo examples use explicit operand widths, preserve the specified intermediate width, and do not rely on an accidental wider destination to change the operation. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-124 | F003, F019, F020 | Examples use the accepted `0b` binary-literal syntax and distinct declaration names, so they demonstrate the intended rule instead of triggering unrelated lexical or redeclaration errors. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-125 | Chapters 01/02/04/12/14, F012/F021, master grammar, diagnostics/index, IL reference, and Q-L30 | Ordinary addition/subtraction is always binary and context-independent. Explicit same-width unsigned `bcd_add()`/`bcd_sub()` own carry/borrow, inline decimal state, and D-clear exit; valid constants fold modulo 100/10,000, invalid constants are E10254, runtime-invalid digits follow HLE-006, raw `asm_sed()` violations are E10255, and W10120 is retired. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-126 | Chapters 11/15, A7800 appendix, TARGET-ATARI7800-SW | The 7800 has 4,096 physical RAM bytes at `$1800`–`$27FF`; `$0040`–`$00FF` and `$0140`–`$01FF` are shadows, not additional capacity. The default profile uses `$40`–`$7F` ZP, a 192-byte `$0140`–`$01FF` stack with no static reserve, and disjoint `$2200`–`$27FF` general allocation. Page 2 and `$80`–`$FF` are unavailable to the default allocator, preventing double ownership of aliased physical bytes. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-127 | Chapter 15, A7800 appendix, TARGET-ATARI7800-SW | The 7800 profile records Sally's 1.79 MHz nominal CPU clock. TIA/RIOT accesses slow the CPU clock to 1.19 MHz and MARIA DMA steals bus time; these variable timing effects are modeled separately instead of being collapsed into a false 1.19 MHz average `clock_mhz`. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-128 | Chapters 06/11/12/14, F012/F018, diagnostics/index, SFA/ABI reference, and Q-L11 | Explicit stack analysis tracks accumulator-save and status-save kinds relative to each function entry. Pulls require the matching top kind; joins/backedges require identical sequences; exits require an empty sequence; caller, call, interrupt, and generated ABI bytes retain separate ownership. E10248 owns invalid finite stack state, while E10245 owns unbounded growth. No runtime, SFA storage, or extra instruction is introduced. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-129 | Chapters 06/13/14/15, F015, C64/C64U appendices, source manifest, and Q-P11 | Callable C64 game audio requires handler-preserved provenance to an exact hash-bound player contract. Player-neutral constant operations lower directly to init/tick/song/SFX entries; source owns cadence; the contract owns supported video standards and SID topology, writable state, voice mapping, arbitration, concurrency, machine state, and complete feature costs. It may close Unknown metadata but cannot contradict specific flags. Plain PSID never implies SFX, no generic runtime is added, and E10256..E10258/E10261 own missing contract/capability, unsafe overlap, and configuration mismatch. GoatTracker 2.77 is the first adapter family; minimal SFX-only and exact custom-player contracts remain equal paths. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-130 | Chapters 11/12/14/15, F012, target appendices, source manifest, IL/SFA references, and Q-L11 | Reachable `asm_brk()` is a synchronous profile-bound software-interrupt edge. The compiler emits only `$00 $EA`, always charges the CPU's three pushed bytes plus the contract's maximum handler stack use, and models the declared returning or non-returning successor and machine effects. E10259 rejects missing proof. W10121 is retired because no debug/release semantic mode exists. Every baseline target profile currently omits the contract; stock C64 KERNAL evidence warm-starts BASIC rather than defining a generic returning debugger. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-131 | Chapters 01/03/05/14, F008/F010/F011/F013/F014/F016/F017/F018/F019/F020, examples, migration, future considerations, master grammar, diagnostics/index, IL/SFA references, Q-L31, and Q-C19 | One C/JavaScript-style `for (initializer; condition; update)` replaces the range-only syntax. Clause order, optionality, scope, mutation, effects, exits, and wrap use ordinary rules. Correct generic CFG lowering needs no runtime; proof-based canonical induction may narrow or use wrap-exit expert patterns. The four range-only errors and W10060 are retired. Current implementation behavior is an audit subject, not authority. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-132 | Chapters 00/04/06/11/14, F006/F018, diagnostics/index, migration, IL/SFA references, source manifest, and Q-L32 | `&local` is a hidden-provenance borrow bounded by the local's dynamic source lifetime. Copies and address-derived fragments cannot launder the dependency. Contained local storage and transitively proven non-retaining calls are legal; return, persistent/raw/MMIO storage, asynchronous publication, retaining/unknown calls, and opaque escape are E10260. Legal uses extend SFA liveness; sequential lifetimes may reuse one home, bounded concurrent domains get disjoint homes/variants, and no heap, runtime, persistent pin, or implicit static local is added. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-133 | Chapters 13–15, F015, C64/C64U appendices, diagnostics/index, source manifest, and Q-L33/Q-P11 | Every SID-capable C64/C64U profile selects `video_standard` and an ordered address/model `sid_chips` topology; `clock_mhz` is derived/validated timing data. PSID clock/model bits keep Unknown, PAL/MOS6581, NTSC/MOS8580, and Both distinct, while secondary/tertiary `00` inherits the resolved primary requirement. Known mismatch is E10261 with no conversion. Unknown remains legal for embedding but callable audio needs an exact contract that closes it without contradicting specific metadata. C64U physical-SID/UltiSID selection is a deployment precondition, not runtime discovery or activation, and turbo CPU speed is separate from SID timing. | Closed under BLEND65-SPEC-P3-ed278ab9; prior comprehensive grading plus final impact audit and affected rerun pass |
| SC-134 | Chapters 04/06/08/11/12, F014/F018/F020, semantics/SFA references, and Q-L19 | Every stored array resolves to fixed contiguous `T[N]`. `T[]` is only an initialized-storage extent placeholder or an any-size parameter. The parameter carries the complete fixed argument's address and word element count, supports runtime `length()`, and may only be compatibly forwarded. It is not a storable or returnable array value. Exact parameters remain address-only. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-135 | Chapters 02/04/08/14, F010/F011/F014/F016, diagnostics/index, semantics/IL references, and Q-L19 | Every integer type may index every array. Direct unbarriered 8-bit arithmetic inside `[]` promotes into the 16-bit-capable index-ordinal context before evaluation; explicit narrow barriers preserve ordinary wrap. Known negative/out-of-extent values are E10240, non-integers are E10263, and E10085/E10117/E10118/W10142 are retired. Proof may still select byte-only machine work. SC-145 fixes the complete promoted-operator set. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-136 | Chapters 05/14, F008, diagnostics/index, semantics/IL references, and Q-L19 | A declared byte loop counter is never silently widened. E10262 rejects only a proved canonical finite-looking loop whose counter repeats before its invariant condition can become false, whose body does not change the counter or bound, and that has no other explicit exit. Intentional modular byte loops remain legal; a correct word source loop may still use a proved byte machine induction form. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-137 | Chapters 04/12, F020, master grammar, semantics crosswalk | The query family distinguishes compile-time `sizeof`/`offsetof`, fixed-array `length()` folding, and runtime any-size-parameter `length()`. The derived grammar names the family `query_intrinsic`; no syntax or runtime helper is added. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-138 | Chapters 02/04/12, F011/F016/F020, migration/preflight, semantics and Q-L19 | `sizeof(Type)` always has semantic type `word`. Its value is compile-time, and proof may select byte-only machine work, but a 255-byte boundary cannot change surrounding source arithmetic. SC-144 applies the same stable-width rule to `offsetof()` and closes the representable aggregate domain. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-139 | F020 dynamic-address `poke()` example and complete-cost doctrine | The displayed pointer setup, value load, index load, and indirect store total 23–26 cycles and 14–17 bytes depending on ZP versus absolute value homes. The example no longer omits materialization costs. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-140 | F016 warning summary, Chapter 02 and Chapter 14 | W10160/W10161 apply when narrow runtime arithmetic is widened by assignment, argument or return binding, or another explicit semantic context. The summary no longer narrows the trigger to assignment only. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-141 | Chapters 01/07/08/14, F011/F014 | Examples and optimization preconditions preserve source validity, typing, and full effective-offset proof: the word-valued color-ramp expression narrows explicitly to `byte`; array-of-struct byte indexing requires proof that the complete effective offset fits the selected byte form; and generated-code examples do not redeclare reserved intrinsic names. Declared aggregate size alone is insufficient. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-142 | Chapters 04/05/07/08/12 and F009/F010/F011/F013/F014/F017/F020/F024 | Published cycle/ROM totals use one stated accounting boundary and exact 6502 instruction costs. Repairs cover scalar arithmetic and comparisons, multiply/shift sequences and helper ranges, struct operations, array accesses/fill, memory intrinsics, conditional selection, switch dispatch, and loop control. W10172 follows the selected lowering rather than every non-power-of-two constant. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-143 | Chapters 02/04/05/12, F008/F009/F014/F016/F017, and historical SC-046 | Final cost and supersession audit makes branch-page assumptions explicit, separates instruction-core from complete-sequence totals, binds extension costs to actual materialization, and preserves inline-versus-helper selection for division/remainder. E10073 remains an error, and obsolete range-loop wording is historical only under SC-131. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-144 | Chapters 02/04/07/08/12/14, F011/F014/F016/F020, diagnostics/index, migration, semantics and Q-L19 | `sizeof()` and `offsetof()` are stable compile-time `word` queries. Array extents are full-precision integers in `0..65535`; complete fixed array/struct sizes are in `0..65535` bytes. E10264/E10265 reject out-of-domain types, and E10266 rejects `sizeof(T[])`. Structs are not artificially capped at 255 bytes, and no runtime or wider source integer is added. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-145 | Chapters 08 and F014, AR-P37, semantics/IL references, and Q-L19 | The direct index-ordinal context promotes before every unbarriered integer-producing operation: unary `~`/`-`, arithmetic, shifts, and bitwise operators. Existing signedness rules still apply; comparisons/logical operators yield invalid-index `boolean`. Explicit 8-bit casts, typed 8-bit assignments/compound assignments, and completed calls remain narrow barriers. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-146 | Feature index; Chapters 04–06/08/10; F013/F016/F017/F018/F020/F024; future considerations; master grammar | Final impact repair removes stale switch/promotion costs, reserved-name examples, incomplete operator/helper accounting boundaries, unregistered advisories, untyped diagnostic/workaround examples, and obsolete conditional-expression prose. The derived grammar routes all 29 reserved built-ins through deterministic intrinsic-call lexeme dispatch while leaving ordinary identifiers disjoint in call position. No product behavior or diagnostic set changes. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |
| SC-147 | Chapter 08, F014, E10240, and Q-L19 | The examples now make the frozen boundary result explicit: ordinal 510 is valid for `shifted[600]` and is E10240 for `data[500]`. This is an example-completeness repair only; index semantics and the no-view array model are unchanged. | Exact-identity affected evaluation passes under BLEND65-SPEC-P3-ed278ab9; independent correction grade passes |

The SC-007 resolution does not authorize a hidden software stack. It requires automatic static specialization
for every statically bounded invocation-private overlap and a compile-time diagnostic only when the
entry/nesting set cannot be bounded or resources cannot fit. It never clones deliberately shared
program state. See [Interference and Reentrancy](sfa-and-abi.md#interference-and-reentrancy).

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

Use citations such as `[BLEND65-SPEC-P3-ed278ab9, spec/06-functions.md §FN-10]`. A citation is an audit
pointer, not proof that the cited text is consistent. Record any new direct contradiction in the
qualification conflict register before relying on either side. When the live `spec/**/*.md` path
set changes, this module is incomplete until the table again has exact set equality.

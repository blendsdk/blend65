# Execution Plan: RD-04 Language Completion

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-26
> **Progress**: 74/99 tasks (75%)
> **CodeOps Artifact Schema**: 1

## Overview

Complete Specification 4 through the existing compiler in nine vertical phases. Every behavior
phase follows specification tests → red proof → implementation → green proof → implementation
tests → family qualification. Phase 9 only reconciles and closes evidence already specified and
implemented by Phases 1–8.

**🚨 Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Authority, lexer, parser, modules and diagnostics | 12 |
| 2 | Scalars, enums, expressions and control flow | 12 |
| 3 | Arrays, strings, structs, addresses and placement | 12 |
| 4 | Aggregate values, ABI and SFA | 10 |
| 5 | Ordinary calls, function values and recursion | 11 |
| 6 | Interrupt functions and execution domains | 10 |
| 7 | Compile-time functions, intrinsics and core embed | 12 |
| 8 | Complete NMOS backend, artifacts and service identity | 12 |
| 9 | Complete qualification and closeout | 8 |

**Total: 99 tasks across 9 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for progress.
> Every task line appears exactly once. The executing agent MUST:
>
> 1. On implementation, mark the task `[~]` with its real timestamp.
> 2. On verification pass, promote it to `[x]` with its real completion timestamp.
> 3. Update the Progress header and Last Updated after every task; only `[x]` counts complete.
> 4. Resume the first `[~]` task, otherwise the first `[ ]` task, scanning top-to-bottom.
> 5. Mark blockers `[!]` on the task line with the concrete reason.
>
> Specification tests are immutable oracles. If implementation disagrees, fix implementation.

## Phase 1: Authority, Lexer, Parser, Modules and Diagnostics

> **Phase baseline tree**: `c7faaf844176e76681a1c9402286c39a75df9850`
> **Expected modification set**: Phase 1 task paths in `packages/compiler/src/frontend/`, `packages/compiler/src/services/`, `packages/language-server/src/`, and `test/rd04/`; this plan and the feature roadmap. Scope mode: strict; complete the existing compiler pipeline without new packages, frameworks or runtime.
> **Lenses**: correctness, maintainability, standards, language semantics, diagnostic integrity

### Step 1.1: Specification Tests

**Reference**: [03-01](03-01-authority-and-frontend.md) · ST-01–ST-07, ST-09; frontend-owned ST-08 diagnostics and full registry · AR-P6–AR-P8

- [x] 1.1.1 [spec-author] Write coverage, lexer and parser specification cases — `test/rd04/normative-coverage.spec.test.ts`, `packages/compiler/src/frontend/lexer.spec.test.ts`, `packages/compiler/src/frontend/parser.spec.test.ts`, `packages/compiler/src/frontend/parser-grammar.spec.test.ts` — Resume after AR-P10: the named-item oracle is authored; new grammar cases are split from the existing parser test to keep that file below the size ceiling. RED verified 2026-09-23 19:29: five pending grammar cases and five absent coverage-validator cases; lexer and existing parser cases pass.
- [x] 1.1.2 [spec-author] Write module, scope, frontend-owned diagnostic and asset-aware CLI/LSP canonical-record identity specification cases; reserve the full ST-08 sweep for Phase 8 — `packages/compiler/src/frontend/modules.spec.test.ts`, `packages/compiler/src/frontend/service.spec.test.ts`, `test/rd04/frontend-boundary.spec.test.ts` — Resume after AR-P10: existing module/scope cases pass and two new canonical diagnostic comparisons are RED. Add registry completeness proof through the named-item crosswalk. RED verified 2026-09-23 19:30: two CLI/LSP overlay identity cases fail; nine module and twelve service cases pass.
- [x] 1.1.3 Run only the new Phase 1 specification cases and record the expected red failures — Phase 1 test files — RED recorded 2026-09-23 19:30: grammar 5/7 fail for pending syntax, coverage 5/5 fail for absent validator, boundary 2/3 fail for overlay/check divergence; all other directed lexer/parser/module/service cases pass.

### Step 1.2: Implementation

**Reference**: [03-01 §Implementation Details](03-01-authority-and-frontend.md#implementation-details) · AR-P6, AR-P8

- [x] 1.2.1 Add the static coverage artifact and exact source-key validator — `test/rd04/normative-coverage.json`, `test/rd04/normative-coverage-validator.ts`, `test/rd04/normative-coverage.spec.test.ts` — Verified 2026-09-23 19:32: exact 395-key set, duplicate/missing/unknown/identity tests green; targeted Prettier, typecheck, whitespace and frozen-spec checks pass.
- [x] 1.2.2 Extract type/declaration parsing from the oversized parser without changing accepted behavior — `packages/compiler/src/frontend/parser.ts`, `packages/compiler/src/frontend/parser-declarations.ts`, `packages/compiler/src/frontend/parser.impl.test.ts` — Verified 2026-09-23 19:36: parser 505 lines, declaration owner 420 lines, existing and shared-cursor implementation tests green; typecheck, Prettier, whitespace and frozen-spec checks pass.
- [x] 1.2.3 Complete token inventory, literals, UTF-8, maximal munch and lexical diagnostics — `packages/compiler/src/frontend/tokens.ts`, `packages/compiler/src/frontend/lexer.ts`, `packages/compiler/src/frontend/diagnostics.ts` — Verified existing implementation 2026-09-23 19:38: 83 token kinds (36 keywords, 42 fixed spellings), raw-byte literal and maximal-munch cases, lexical registry and project-loader invalid UTF-8 cases; 48 directed tests pass. No code change needed.
- [x] 1.2.4 Complete syntax nodes, grammar, Pratt integration and bounded recovery; remove Phase 1 pending syntax — `packages/compiler/src/frontend/syntax.ts`, `packages/compiler/src/frontend/parser-declarations.ts`, `packages/compiler/src/frontend/statements.ts` — Verified 2026-09-23: AR-P11 supersession, 77 directed parser/module tests, compiler typecheck, whitespace and frozen-spec checks pass; invalid placement/export recovery is bounded. One obsolete module implementation expectation was retired.
- [x] 1.2.5 Complete module graph, symbol identity, scopes and deterministic initializer ordering — `packages/compiler/src/frontend/modules.ts`, `packages/compiler/src/frontend/module-bindings.ts`, `packages/compiler/src/frontend/effects.ts` — Verified 2026-09-23: enum and zeropage member bindings, import identity, new-form dependency traversal, existing parameter/for scopes and qualified-name initializer order; 50 directed tests, typecheck, whitespace and frozen-spec checks pass. Zero-page initializer semantics remain with its later semantic phase.
- [x] 1.2.6 Complete the RD-04-applicable diagnostic registry, frontend-owned producers and terminal poison handling; extend existing overlay analysis with the same bounded asset resolution as project analysis and await it in the LSP so CLI/LSP canonical records match — `packages/compiler/src/frontend/diagnostics.ts`, `packages/compiler/src/frontend/service.ts`, `packages/compiler/src/services/services.ts`, `packages/language-server/src/server.ts` — Verified 2026-09-24: one awaited asset-aware overlay path, canonical CLI/editor identity, zero-page root diagnostics, duplicate-block rejection and existing poison/cap tests; 51 directed compiler/root/LSP cases, typecheck, formatting, whitespace and frozen-spec checks pass. The checked crosswalk owns the complete active-code inventory; no duplicate production registry was added.
- [x] 1.2.7 Run Phase 1 specification cases and make all immutable expectations green — Phase 1 test files — Verified 2026-09-24: all 93 directed Phase 1 specification cases pass across compiler and root test suites.

### Step 1.3: Implementation Tests and Qualification

**Reference**: [03-05](03-05-qualification.md) · ST-01–ST-07, ST-09; frontend-owned ST-08 diagnostics and full registry

- [x] 1.3.1 Add recovery-budget, graph-order and malformed-crosswalk implementation tests — `packages/compiler/src/frontend/parser.impl.test.ts`, `packages/compiler/src/frontend/modules.impl.test.ts`, `test/rd04/normative-coverage.impl.test.ts` — Verified 2026-09-24: 42 directed implementation cases pass, including new bounded zero-page recovery, shuffled merged-module order, and seven malformed crosswalk cases; typecheck, formatting, whitespace and frozen-spec checks pass.
- [x] 1.3.2 Run complete frontend/compiler/CLI/LSP family tests, touched-file Prettier, whitespace and frozen-spec checks — affected packages and `test/rd04/` — Verified 2026-09-24: frozen install, build, typecheck and complete test suite pass (1,194 tests after review fixes); touched-file Prettier, whitespace and frozen-spec checks pass.

**Deliverables:** complete frontend; checked authority ledger; identical CLI/LSP canonical
diagnostic records. Later diagnostic producers remain owned by their phases; full ST-08 and
pipeline-wide failure case ST-10 first qualify in Phase 8.

**Verify:** `yarn workspace @blend65/compiler test && yarn workspace @blend65/cli test && yarn workspace @blend65/language-server test && yarn test`

### Phase 1 Quality Review — Closed

The independent correctness and language-semantics reviews completed on 2026-09-24. On 2026-09-24
the user approved keeping the strengthened specification tests, fixing the four frontend defects,
and splitting the oversized parser class locally. All approved fixes are implemented. The focused
red cases failed before implementation and now pass; frozen install, build, typecheck, all 1,194
tests, formatting, whitespace, and frozen-spec checks pass. The one permitted fix-scoped
correctness and semantics re-review found no remaining issues. No Phase 2 task has started.

| Finding | Severity | Evidence | Approved ruling |
|---|---|---|---|
| RV-001 | Critical policy conflict | Planned spec-author work changed existing `*.spec.test.ts` assertions; AR-P11 and AR-P12 explicitly approved the affected supersessions. Review found no weakened expectation. | Resolved by user ruling: keep the stronger tests. |
| RV-002 / semantics 2 | Major | Unknown `place(...)` key reports syntax error at `:` and leaves its declaration detached, instead of E10272 at the key. | Fixed: E10272 on the key; reject the full owner or zero-page member. |
| Semantics 1 | Major | Empty enum reports generic syntax error and loses the declaration before E10234 can be produced. | Fixed: E10234 and bounded declaration retention. |
| Semantics 3 | Major | Recovery after a missing semicolon loses later `switch`/`do` statements and emits spurious module errors. | Fixed: safe sibling starts include `switch`, `do`, and `loadable`. |
| Semantics 4 | Major | `switch` accepts a `case` after `default`, contrary to the frozen grammar. | Fixed: one syntax diagnostic at the late `case`. |
| RV-003 | Minor | `DeclarationParser` exceeds the written 500-line class limit. | Fixed: recursive type parsing moved to a companion file; declaration class is 495 lines. |

## Phase 2: Scalars, Enums, Expressions and Control Flow

> **Phase baseline tree**: `cd0d2b609f5e41026e50ed3fd6ddc2aa5a9102d8`
> **Expected modification set**: Phase 2 task paths in `packages/compiler/src/frontend/`, `packages/compiler/src/semantic/`, `packages/compiler/src/machine/`, and `test/rd04/`; this plan and the feature roadmap. Scope mode: strict; extend the existing compiler path without new packages, frameworks, runtime or alternate IR.
> **Lenses**: language semantics, arithmetic correctness, effect ordering, expert 6502 output

### Step 2.1: Specification Tests

**Reference**: [03-02](03-02-values-and-memory.md) · ST-11–ST-20

- [x] 2.1.1 [spec-author] Write scalar, enum, conversion and arithmetic-context specification matrices — `packages/compiler/src/frontend/scalars.spec.test.ts`, `packages/compiler/src/frontend/expressions.spec.test.ts` — Verified RED 2026-09-24: 14 new scalar/enum cases, one failing nominal-enum case and 45 passing directed cases; formatting and whitespace checks pass. Existing scalar and expression expectations were not weakened.
- [x] 2.1.2 [spec-author] Write control-flow, switch, effect-order and initialization specification cases, including one synthetic stored-result conditional effect with captured-range and join checks — `packages/compiler/src/frontend/flow.spec.test.ts`, `packages/compiler/src/semantic/cfg.spec.test.ts`, `test/rd04/scalars-runtime.spec.test.ts` — Verified RED 2026-09-24 09:21: 10 directed frontend/CFG cases fail as expected and 14 pass; the direct VICE case fails at build on missing enum semantics before VICE starts. Typecheck, formatting, whitespace and frozen-spec checks pass. ✅ (completed: 2026-09-24 09:21)
- [x] 2.1.3 Run only the new Phase 2 specification cases and record the expected red failures — Phase 2 test files — Verified RED 2026-09-24 09:22: 11 compiler cases fail and 59 pass; the direct runtime case fails at build before VICE starts. Logs `/tmp/rd04-phase2-compiler-red.2qEn1W` and `/tmp/rd04-phase2-runtime-red.QeGo8W`; typecheck, formatting, whitespace and frozen-spec checks pass. ✅ (completed: 2026-09-24 09:22)

### Step 2.2: Implementation

**Reference**: [03-02 §Expression and Arithmetic Rules](03-02-values-and-memory.md#expression-and-arithmetic-rules) · AR-P4, AR-P8

- [x] 2.2.1 Complete nominal enum, scalar declaration and conversion rules; extract that responsibility from the oversized analyzer — `packages/compiler/src/frontend/semantic-types.ts`, `packages/compiler/src/frontend/analyzer.ts`, `packages/compiler/src/frontend/analyzer-scalars.ts` — Nominal byte-backed enum typing, declaration/member resolution and zero-cost conversions implemented; scalar declaration checking extracted. Verified directed scalar/expression/parser specification cases (63/63), compiler typecheck, targeted formatting and whitespace checks 2026-09-24. Remaining Phase 2 control-flow cases are expected RED until later tasks. ✅ (completed: 2026-09-24 09:43)
- [x] 2.2.2 Complete exact constant/runtime arithmetic and every scalar operator — `packages/compiler/src/frontend/constants.ts`, `packages/compiler/src/frontend/scalar-expressions.ts`, `packages/compiler/src/frontend/expressions.ts` — Existing exact-versus-wrapped arithmetic, signed division/remainder, wide shifts and operator parsing verified against the Phase 2 scalar matrix; enum operands now use byte representation for unary as well as binary operators. Directed scalar/expression cases (46/46), compiler typecheck, formatting and whitespace checks pass 2026-09-24. ✅ (completed: 2026-09-24 09:44)
- [x] 2.2.3 Complete exactly-once assignment, short circuit and conditional effects that retain stored-result/captured-range correlation through joins — `packages/compiler/src/frontend/conditional-expressions.ts`, `packages/compiler/src/frontend/flow-facts.ts`, `packages/compiler/src/frontend/effects.ts` — Existing left-to-right assignment and short-circuit typed effects retained; constant-selected conditional facts now follow the selected arm, same-enum arms retain nominal type, and the approved minimal stored-result/captured-range fact snapshots, joins and credits only matching true results. Synthetic effect specification case (1/1), scalar/expression cases (46/46), compiler typecheck, formatting and whitespace checks pass 2026-09-24. Remaining switch/flow cases are expected RED until 2.2.4. ✅ (completed: 2026-09-24 09:46)
- [x] 2.2.4 Complete `if`/loops/three-clause `for`/switch/jumps and reachability analysis — `packages/compiler/src/frontend/statements.ts`, `packages/compiler/src/frontend/flow.ts`, `packages/compiler/src/semantic/cfg.ts` — Switch labels, auto-break/fallthrough, do-while, branch joins and direct unreachable/constant-false warnings now use the existing typed-statement and CFG path. Superseded the old implementation test that expected switch to remain unchecked. Directed flow/scalar/CFG cases (44/44), compiler typecheck, formatting and whitespace checks pass 2026-09-24. Full compiler suite was 1060/1061 before the superseded implementation assertion was updated; rerun at Phase 2 checkpoint. ✅ (completed: 2026-09-24 09:55)
- [x] 2.2.5 Extend semantic operations and split the oversized semantic lowerer by scalar/control responsibility — `packages/compiler/src/semantic/operations.ts`, `packages/compiler/src/semantic/lower.ts`, `packages/compiler/src/semantic/lower-control.ts` — Existing operation union now carries enum constants/loads and switch comparisons through the standard CFG; selected-arm expression lowering was extracted to `lower-control.ts` and constant data encoding to `lower-data.ts`, leaving `lower.ts` below 700 lines. Directed CFG cases (5/5), compiler typecheck, targeted formatting, whitespace and frozen-spec checks pass 2026-09-24. The direct VICE case builds and reaches the restore checkpoint but remains RED on observed RAM bytes; machine lowering is next. ✅ (completed: 2026-09-24 10:00)
- [x] 2.2.6 Complete direct `none` scalar/control lowering including division checks and generic CFG paths — `packages/compiler/src/machine/lower-scalar.ts`, `packages/compiler/src/machine/lower-arithmetic.ts`, `packages/compiler/src/machine/lower-control.ts` — Byte/word conversion and call/write staging, variable shifts, byte/word multiply and divide/remainder, selected arithmetic warnings, and the optional inline division-zero stop now lower through the existing machine CFG and SFA closure. The byte multiply helper uses the expert 20-byte loop form; full expert-sequence comparison remains owned by 2.3.2. Directed VICE arithmetic cases 6/6, warning cases 3/3, compiler build/typecheck, formatting and whitespace checks pass 2026-09-24. ✅ (completed: 2026-09-24 11:02)
- [x] 2.2.7 Run Phase 2 specification cases and make all immutable expectations green — Phase 2 test files — Frozen install, build, typecheck and complete `yarn test` pass: 1,062 compiler tests, 60 CLI, 12 language-server, 6 VS Code, and 93 root tests including Phase 2 VICE scalar/control and arithmetic cases. An initial unrelated ACME test timed out under parallel load; it passed alone and on the complete rerun. Frozen `spec/` remains untouched. ✅ (completed: 2026-09-24 11:02)

### Step 2.3: Implementation Tests and Qualification

- [x] 2.3.1 Add fixed-point, arithmetic-boundary, malformed-CFG and lowering implementation tests — `packages/compiler/src/frontend/scalars.impl.test.ts`, `packages/compiler/src/semantic/cfg.impl.test.ts`, `packages/compiler/src/machine/lowering.impl.test.ts` — Loop back-edge facts, helper warning/scratch selection, word-count shift saturation and a malformed semantic successor are covered. The malformed-edge test failed first; the CFG builder now rejects it before publication. Directed frontend/CFG/machine implementation and CFG specification cases (45/45), compiler build, formatting and whitespace checks pass 2026-09-24. ✅ (completed: 2026-09-24 11:06)
- [x] 2.3.2 Add independent scalar/control behavior and expert-sequence evidence — `test/rd04/scalars-runtime.spec.test.ts`, `test/rd04/expert/scalars.json`, `test/rd04/expert-output.spec.test.ts` — The existing VICE scalar/control oracle remains green. Independent qualified byte-multiply baselines now record `x * 3` as a 6-byte/10-cycle local core and general byte multiply as a 20-byte helper; public assembly tests verify their contiguous instruction forms, and bound-machine implementation checks verify the exact local cost, helper ROM bytes and two zero-page scratch homes. No operation-local public cost schema was invented. The `x * 3` assembly case was RED before its short addition-chain lowering and is GREEN afterward. Frozen install, build, typecheck and complete tests pass: 1,066 compiler and 95 root tests, plus 60 CLI, 12 language-server and 6 VS Code tests. ✅ (completed: 2026-09-24 11:19)

### Phase 2 Quality Review — Closed

Independent correctness, semantic and performance reviews found missed constant-zero rejection, do-loop definite-initialization paths, switch/loop proof edges, enum case conversion, short arithmetic/shift idioms, repeated quotient/remainder work and duplicate helper bodies. Focused specification cases were RED first; these findings are fixed and re-reviewed. The planned spec-author edits only strengthen `*.spec.test.ts` expectations; none were weakened. Same-operand division results are reused within one semantic block, and byte-multiply helper bodies are shared only when their bound instruction and scratch fingerprints match. No general sharing framework was added. Frozen install, build, typecheck and complete tests pass after the fixes: 1,075 compiler, 103 root (including VICE and expert-output cases), 60 CLI, 12 language-server and 6 VS Code cases (2026-09-24). Frozen `spec/` remains untouched.

**Deliverables:** complete scalar/control semantics and legal direct NMOS output.

**Verify:** `yarn workspace @blend65/compiler test && yarn test`

## Phase 3: Arrays, Strings, Structs, Addresses and Placement

> **Phase baseline tree**: `a1f8067b12a7a80cadd0d534482a08238b8f9d88`
> **Expected modification set**: Phase 3 task paths in `packages/compiler/src/frontend/`, `packages/compiler/src/semantic/`, `packages/compiler/src/machine/`, `packages/compiler/src/layout/`, and `test/rd04/`; this plan and the feature roadmap. Scope mode: strict; extend the existing compiler path without new packages, frameworks, runtime or alternate IR.
> **Lenses**: aggregate semantics, alias/lifetime safety, target-neutrality, data placement

### Step 3.1: Specification Tests

**Reference**: [03-02](03-02-values-and-memory.md) · ST-21–ST-25, ST-28–ST-29; ST-26/27 belong to Phase 4

- [x] 3.1.1 [spec-author] Write array, ordinal, bounds, string/map and struct layout specification cases, excluding aggregate value assignment and parameter ABI — `packages/compiler/src/frontend/aggregates.spec.test.ts`, `packages/compiler/src/frontend/address-of.spec.test.ts`, `test/rd04/aggregate-runtime.spec.test.ts` — Focused nested shape/layout/cycle, local-address and bounded C64 runtime oracles authored without implementation changes. Verified RED: six new frontend cases fail while 12 prior cases pass; the bounded runtime case fails before VICE. Typecheck, formatting, whitespace and frozen-spec checks pass. ✅ (completed: 2026-09-24 12:00)
- [x] 3.1.2 [spec-author] Write placement, loadable-value and address-provenance specification cases — `packages/compiler/src/frontend/profile.spec.test.ts`, `test/rd04/provenance.spec.test.ts` — The current direct layout-test input has no source-constraint field, so public `buildProject` supplies the placement oracle without a new test-only interface. Verified RED: 15 new frontend and nine public-build cases fail; six and two prior cases respectively pass. Typecheck, formatting, whitespace and frozen-spec checks pass. ✅ (completed: 2026-09-24 12:06)
- [x] 3.1.3 Run only the new Phase 3 specification cases and record the expected red failures — Phase 3 test files — Verified RED 2026-09-24 12:07: 21 frontend cases fail and 18 pass; 10 public cases fail and two pass. Logs `/tmp/rd04-phase3-combined-red-compiler.log` and `/tmp/rd04-phase3-combined-red-public.log`; no implementation or frozen-spec change. ✅ (completed: 2026-09-24 12:07)

### Step 3.2: Implementation

**Reference**: [03-02 §Aggregates and Places](03-02-values-and-memory.md#aggregates-and-places) · AR-P8

- [x] 3.2.1 Complete nested fixed-array shapes, inference, initializers, ordinals and `length` — `packages/compiler/src/frontend/parser-types.ts`, `packages/compiler/src/frontend/aggregate-types.ts`, `packages/compiler/src/frontend/semantic-type-relations.ts`; existing initialization and ordinal paths reused. The first written dimension is now outermost; nested types resolve recursively and render in source order. Verified the new rectangular-array case and seven existing array/ordinal cases, build, typecheck, formatting, whitespace and frozen-spec checks. Struct, placement, string and provenance RED cases remain owned by later Phase 3 tasks. ✅ (completed: 2026-09-24 12:11)
- [x] 3.2.2 Complete immutable character-map conversion and literal diagnostics — `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/frontend/encoded-literals.ts`, `packages/compiler/src/frontend/aggregates.ts`, `packages/compiler/src/frontend/constants.ts`, plus existing literal syntax/discovery and semantic constant lowering. Selected C64 mappings now produce exact bytes or diagnostics; encoded strings and string fills remain compile-time data. Verified eight focused string/map cases, 140 lexer/parser/service regressions, the bounded VICE runtime case, build, typecheck, formatting, whitespace and frozen-spec checks. An unselected profile retains the existing honest encoding obligation. ✅ (completed: 2026-09-24 12:29)
- [x] 3.2.3 Complete nominal structs, packed layout, nested fields and circular-containment rejection — `packages/compiler/src/frontend/aggregate-types.ts`, `packages/compiler/src/frontend/struct-types.ts`, `packages/compiler/src/frontend/aggregate-names.ts`; existing semantic analyzer used unchanged. Struct fields resolve recursively in declaration order, preserve packed byte offsets and reject direct/indirect containment cycles. Updated the obsolete implementation-tier deferral expectation. Verified four new struct specification cases, 42 aggregate/parser implementation cases, build, typecheck, formatting, whitespace and frozen-spec checks. Remaining Phase 3 RED cases are owned by later tasks. ✅ (completed: 2026-09-24 12:30)
- [x] 3.2.4 Add address provenance, physical ranges, retaining summaries and alias classes — `packages/compiler/src/frontend/semantic-types.ts`, `packages/compiler/src/frontend/address-provenance.ts`, `packages/compiler/src/frontend/borrow-calls.ts`, `packages/compiler/src/frontend/flow-facts.ts` and existing expression/analyzer paths. Local-address and read-only facts now survive copies, casts, choices, byte extraction and integer derivation; lexical stores and returns reject the first escape. Whole-function parameter summaries reject transitive retaining calls while allowing proved non-retaining calls. Places retain exact root-relative byte intervals where known and classify must/may/not-alias conservatively. Verified new provenance/range implementation tests, frontend address specification cases, public borrowed-address cases, 1064 unrelated compiler regression cases, build, typecheck, formatting, whitespace and frozen-spec checks. The separate placement cases remain RED for 3.2.5. ✅ (completed: 2026-09-24 12:49)
- [x] 3.2.5 Complete `place(...)` and `loadable const` semantics with honest resident-profile diagnostics — `packages/compiler/src/frontend/analyzer.ts`, `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/layout/c64-layout.ts`. Closed source placement is checked before layout and retained for code/data placement; placed scalar constants materialize, while loadable constants have no resident home and the resident profile reports missing transfer support. Verified public placement/provenance cases, placed helper and entry-function builds through ACME/PRG evidence, zero-page build, 1114 compiler tests, build, typecheck, formatting, whitespace and frozen-spec checks. ✅ (completed: 2026-09-24 13:21)
- [x] 3.2.6 Lower nested array/struct places, dynamic addresses, bounds checks and modulo wrap — `packages/compiler/src/semantic/lower.ts`, `packages/compiler/src/machine/lower-aggregate.ts`, `packages/compiler/src/machine/lower-memory.ts`. The existing packed-address path retains nested strides and 16-bit effective-address wrap; the selected bounds option now emits inline checks with one four-byte stop per function. A VICE case exercised valid byte/nested word indexes and a field inside an indexed struct, then confirmed an invalid index stops before the read. Full build, typecheck, repository tests, formatting and frozen-spec checks pass. ✅ (completed: 2026-09-24 13:35)
- [x] 3.2.7 Run Phase 3 specification cases and make all immutable expectations green — Phase 3 test files. All authored Phase 3 frontend and public specification cases are green in the complete repository run; no frozen specification file was changed. ✅ (completed: 2026-09-24 13:35)

### Step 3.3: Implementation Tests and Qualification

- [x] 3.3.1 Add layout-cycle, ordinal-barrier, provenance and malformed-placement implementation tests — `packages/compiler/src/frontend/aggregates.impl.test.ts`, `packages/compiler/src/layout/c64-layout.impl.test.ts`, `packages/compiler/src/machine/lowering.impl.test.ts`. Existing implementation cases cover ordinal promotion/barriers and address provenance; new cases cover array-mediated struct cycles, malformed fixed placement, and the selected one-stop bounds shape. All 50 focused cases and typecheck pass. ✅ (completed: 2026-09-24 13:39)
- [x] 3.3.2 Run complete aggregate/memory ACME and VICE family qualification plus expert comparisons — `test/rd04/aggregate-runtime.spec.test.ts`, `test/rd04/bounds.impl.test.ts`, `test/rd04/expert/aggregates.json`, `test/rd04/expert-aggregates.impl.test.ts`. Existing aggregate runtime, new checked-index/unchecked-wrap VICE cases, and an independent expert static byte-array core comparison passed through real ACME output. The proven byte-index path now uses native absolute indexed access without an aggregate pointer home; general word/signed paths retain page-safe pointer lowering. Clean checkpoint passed install, build, typecheck, 1121 compiler tests and 120 repository tests; formatting, whitespace and frozen-spec checks pass. ✅ (completed: 2026-09-24 13:50)

**Deliverables:** complete core aggregate/address semantics through executable machine output;
ST-26/27 aggregate value and ABI expectations remain Phase 4 work.

**Verify:** `yarn workspace @blend65/compiler test && yarn test`

### Phase 3 Quality Review — Closed

The independent correctness and performance reviews found seven implementation defects after the
first green checkpoint. On 2026-09-24 the user approved narrow fixes for all seven and approved
keeping the specification tests, which were recorded RED before implementation. The approved fixes
are complete. The one fix-scoped correctness and performance re-review reported no new findings.
The final checkpoint passed frozen-lockfile install, build, typecheck, 1,125 compiler tests and
123 repository tests; targeted formatting, whitespace and frozen-`spec/` checks pass. No new
framework or language scope was added.

| Finding | Ruling | Required correction |
|---|---|---|
| RV-001 | Fix | Preserve prior-target provenance through compound assignment and its result. |
| RV-002 | Fix | Iterate loop alias summaries until stable. |
| RV-003 | Fix | Honor disjoint fixed code/data placements regardless of declaration order, then fit automatic objects. |
| RV-004 | Fix | Reserve user zero-page storage before SFA chooses homes. |
| RV-005 | Fix | Select native zero-page machine forms for user zero-page globals. |
| PE-001 | Fix | Use native indexed forms for proved small static word/struct accesses; retain the general pointer path elsewhere. |
| PE-002 | Fix | Propagate retaining-summary changes only to affected callers. |
| RV-006 | Keep stronger tests | Planned spec-author edits were RED first; review found no weakened expectation. |

## Phase 4: Aggregate Values, ABI and SFA

> **Phase baseline tree**: `e49325fdbd6b00d23c79a06373f2afc653f71afe`
> **Expected modification set**: Phase 4 task paths in `packages/compiler/src/frontend/`, `packages/compiler/src/semantic/`, `packages/compiler/src/storage/`, `packages/compiler/src/machine/`, `packages/compiler/src/artifacts/`, and `test/rd04/`; this plan and the feature roadmap. Scope mode: strict; use the existing semantic operations and SFA closure, with no dynamic frame, heap, runtime registry, or new IR.
> **Lenses**: ABI soundness, SFA closure, alias-safe copies, performance

### Step 4.1: Specification Tests

**Reference**: [03-03 §ABI Family](03-03-calls-abi-and-sfa.md#abi-family) · ST-26, ST-27, ST-31, ST-39

- [x] 4.1.1 [spec-author] Write aggregate assignment/return/borrow and overlap specification cases — `packages/compiler/src/frontend/aggregates.spec.test.ts`, `packages/compiler/src/storage/sfa.spec.test.ts`, `test/rd04/aggregate-abi.spec.test.ts` — Seven focused cases authored from the frozen language rules without implementation changes. Typecheck, formatting, whitespace and frozen-spec checks pass. ✅ (completed: 2026-09-24 15:08)
- [x] 4.1.2 Run only the new Phase 4 specification cases and record the expected red failures — Phase 4 test files — RED confirmed: three frontend cases and two public runtime builds fail against the old compiler; 27 focused cases pass. Logs `/tmp/rd04-phase4-red-compiler.log` and `/tmp/rd04-phase4-red-public.log`. Unsized-return and undeclared late-storage cases already pass as non-vacuous regressions. ✅ (completed: 2026-09-24 15:08)

### Step 4.2: Implementation

- [x] 4.2.1 Complete aggregate value assignment and caller-owned return destinations — `packages/compiler/src/frontend/scalar-assignments.ts`, `packages/compiler/src/frontend/direct-calls.ts`, `packages/compiler/src/semantic/operations.ts` — Full install, build, typecheck and test pass: compiler 1,130; root 125; CLI 60; LSP 12; VS Code 6. ✅ (completed: 2026-09-24 20:49)
- [x] 4.2.2 Complete exact and outer-unsized aggregate parameter ABI records — `packages/compiler/src/frontend/aggregate-types.ts`, `packages/compiler/src/semantic/lower.ts`, `packages/compiler/src/storage/storage-types.ts` — Checked indexing uses the full carried word count; a VICE test proves index 299 succeeds and 300 stops. Full install, build, typecheck and test pass: compiler 1,130; root 126; CLI 60; LSP 12; VS Code 6. ✅ (completed: 2026-09-24 20:58)
- [x] 4.2.3 Inventory aggregate destinations, snapshots, caller staging and pointer pairs — `packages/compiler/src/storage/inventory.ts`, `packages/compiler/src/storage/interference.ts`, `packages/compiler/src/storage/closure.ts` — Closed machine-discovered homes cover aggregate results, snapshots and pointer pairs; removed an unused full-byte stage for borrowed arguments. Full install, build, typecheck and test pass: compiler 1,131; root 126; CLI 60; LSP 12; VS Code 6. ✅ (completed: 2026-09-24 21:06)
- [x] 4.2.4 Lower direct construction and overlap-safe copies with explicit scratch/costs — `packages/compiler/src/machine/lower-aggregate.ts`, `packages/compiler/src/machine/lower.ts`, `packages/compiler/src/machine/machine-types.ts` — Direct destinations and SFA snapshots retain alias safety; counted page-safe loops keep large copies, returns and byte fills compact. Machine-cost and VICE tests pass; full install, build, typecheck and test pass: compiler 1,134; root 127; CLI 60; LSP 12; VS Code 6. ✅ (completed: 2026-09-24 21:26)
- [x] 4.2.5 Reconcile aggregate homes/copies in SFA, memory, cost and debug evidence — `packages/compiler/src/artifacts/memory-evidence-validator.ts`, `packages/compiler/src/artifacts/costs-evidence-validator.ts`, `packages/compiler/src/artifacts/debug-evidence-validator.ts` — Existing version-1 validators and final-certificate producers need no schema change. A public build checks the 300-byte SFA snapshot, physical memory/cost totals and source-owned debug function ranges. Full install, build, typecheck and test pass: compiler 1,134; root 127; CLI 60; LSP 12; VS Code 6. ✅ (completed: 2026-09-24 21:32)
- [x] 4.2.6 Run Phase 4 specification cases, including the first full ST-26/27 qualification, and make all immutable expectations green — Phase 4 test files — Focused frontend/SFA specification cases pass 30/30; public ACME/VICE aggregate ABI cases pass 2/2. The unchanged full-suite checkpoint is green: compiler 1,134; root 127; CLI 60; LSP 12; VS Code 6. ✅ (completed: 2026-09-24 21:32)

### Step 4.3: Implementation Tests and Qualification

- [x] 4.3.1 Add snapshot-lifetime, interference and closure-feedback implementation tests — `packages/compiler/src/storage/sfa.impl.test.ts`, `packages/compiler/src/storage/closure.impl.test.ts`, `packages/compiler/src/machine/call-retention.impl.test.ts` — Three new cases prove live snapshot separation and later reuse, finite closure feedback with undeclared-demand rejection, and bound copy pointers/snapshot. Full install, build, typecheck and test pass: compiler 1,137; root 127; CLI 60; LSP 12; VS Code 6. ✅ (completed: 2026-09-24 21:38)
- [x] 4.3.2 Run aggregate ABI/SFA ACME/VICE and equal-contract expert qualification — `test/rd04/aggregate-abi.spec.test.ts`, `test/rd04/expert/aggregate-abi.json`, `test/rd04/vice.spec.test.ts` — Existing aggregate ABI specification cases and the focused aggregate-copy VICE implementation case provide the sequential runtime oracle without a redundant new spec file. Measured 300-byte copy/clone/fill bodies are 71/59/31 bytes, meeting the independent equal-contract NMOS baseline with one overlaid 300-byte SFA snapshot; [issue #81](https://github.com/blendsdk/blend65/issues/81) records the whole-program beat path. Full install, build, typecheck and test pass: compiler 1,138; root 127; CLI 60; LSP 12; VS Code 6. Independent phase review follows. ✅ (completed: 2026-09-24 21:53)

**Deliverables:** ordinary aggregate values and one closed zero-runtime ABI.

**Independent Phase 4 review (2026-09-24):** correctness, language-semantics and performance reviewers inspected the phase-baseline diff. The pre-review full verification was green, but four major findings block Phase 4 review closeout and Phase 5 start pending a user ruling. The Phase 4 specification cases were authored before implementation and not weakened; AR-P14 authorized the two changed older service expectations. Frozen `spec/` is unchanged.

| Finding | Severity | Review result / narrow correction proposed |
|---|---|---|
| RV-001 / semantics 1 | Major | Nested aggregate fields sourced from existing values are lowered as pointer bytes, or fail lowering when wider than two bytes. Copy complete source values into their fields with the existing alias-safe, SFA-closed path. |
| Semantics 2 | Major | A legal zero-length local array requests a zero-byte SFA home and fails allocation. Represent empty values without a positive-byte storage request. |
| PE-001 | Major | An unknown-overlap 300-byte copy always reserves a 300-byte snapshot and performs two copy passes. Compare an overlap-safe directional copy against the snapshot on bytes, cycles and RAM; retain the snapshot where required. |
| PE-002 | Major | Large copy/fill emits a loop body for every 256-byte page, growing code linearly with page count. Use a bounded-size outer page loop for larger objects while retaining the small-loop form where it is better. |

The user approved all four narrow corrections on 2026-09-24. Nested member reads now copy object bytes, including alias-prone field swaps. Zero-length homes are nonresident markers, including across calls and returns. Unknown-overlap large copies use a directional one-pass loop without a full-size snapshot, including mixed global/borrowed homes; large borrowed copy and fill bodies use bounded page loops. Public VICE cases cover nested values, aliasing, 300-byte copies, and retained pointers. Full frozen install, build, typecheck and tests pass after the fixes: compiler 1,140; root 129; CLI 60; LSP 12; VS Code 6. Touched-file formatting, whitespace and frozen-`spec/` checks pass. No runtime, heap, general optimization framework or spec edit was added. Fix checkpoint: `135e37f`.

**One fix-scoped re-review (2026-09-24):** the generic large-copy/fill and zero-size corrections passed inspection. Reviewers found three distinct major gaps in nested construction, so Phase 4 and Phase 5 remain blocked pending a user ruling. No specification test or frozen `spec/` file changed.

| Finding | Impact | Narrow proposed correction |
|---|---|---|
| RV-001 / semantics 1 | A constructed borrowed value over 256 bytes can retain a pointer advanced by one or more pages; a following call reads the wrong bytes. | Restore the pointer before its next use; prove the expression-to-call path in VICE. |
| Semantics 2 | A later field expression can mutate an earlier place-backed field before that earlier value is captured. | Preserve each evaluated member before a later effect can change it; prove source-order behavior in VICE. |
| PE-001 / PE-002 | Large nested fields still expand to per-byte code; borrowed construction can reserve a full-size snapshot and copy twice without a cross-field hazard. | Use existing counted/directional copy forms for large safe members, and stage only real cross-member hazards; measure bytes, cycles and RAM. |

The user approved all three bounded corrections on 2026-09-24. This does not authorize a new runtime, heap, IR or general optimization framework. No second re-review is planned; the next checkpoint must verify these fixes and report any remaining risk honestly.

The three approved corrections are implemented and verified. Retained pointers, source-order capture, large nested members, cross-member swaps and a borrowed alias into direct storage have focused regressions. Full frozen install, build, typecheck and tests pass: compiler 1,143; root 129; CLI 60; LSP 12; VS Code 6. Touched-file formatting, whitespace and frozen-`spec/` checks pass. The reviewer findings were corrected without a new runtime, heap, IR or general optimization framework. Correction checkpoint: `e0d94f3`.

**Phase 4 quality closeout (2026-09-24):** a local single-use address reuse and page-tail cleanup reduced the equal-contract borrowed 300-byte nested-copy body from 119 to 103 bytes, beating the independent 104-byte expert reference. The 8 KiB body remains bounded at 105 bytes. The 300-byte case uses at most four zero-page pointer bytes and no full-size snapshot; a repeated-fill test guards against consuming an advanced pointer twice. Full frozen install, build, typecheck and tests pass again: compiler 1,144; root 129; CLI 60; LSP 12; VS Code 6. No second independent re-review was run. [Issue #82](https://github.com/blendsdk/blend65/issues/82) remains open administratively until explicitly closed; its measured byte gap is fixed on this branch. Phase 4 review is closed and Phase 5 may start.

**Verify:** `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`

## Phase 5: Ordinary Calls, Function Values and Recursion

> **Phase baseline tree**: `fb8a77e6e7ec7b2b7cf22379799f6f98a97120e3`
> **Lenses**: call-graph soundness, ABI, whole-program closure, expert call output
> **Expected modification set**: Phase 5 task paths in `packages/compiler/src/frontend/`, `packages/compiler/src/semantic/`, `packages/compiler/src/storage/`, `packages/compiler/src/machine/`, `packages/compiler/src/artifacts/`, and `test/rd04/`; this plan and the feature roadmap. Scope mode: strict; extend the current compiler path without a dispatcher registry, runtime, new IR or framework.

### Step 5.1: Specification Tests

**Reference**: [03-03](03-03-calls-abi-and-sfa.md) · ST-30, ST-32–ST-34

- [x] 5.1.1 [spec-author] Write nested/direct/cross-module call and function-value specification cases — `packages/compiler/src/frontend/expressions.spec.test.ts`, `packages/compiler/src/semantic/whole-program.spec.test.ts`, `test/rd04/function-values.spec.test.ts` — Five implementation-blind cases authored: four expected RED and one existing-behavior GREEN. Full typecheck, touched-file formatting, whitespace and frozen-`spec/` checks pass; no existing spec assertion was weakened. ✅ (completed: 2026-09-24 23:43)
- [x] 5.1.2 Run only the new Phase 5 specification cases and record the expected red failures — Phase 5 test files — Compiler: three expected RED, 18 existing/new GREEN (`/tmp/blend65-phase5-red-compiler.log`); public build: one expected RED at unimplemented function-value source (`/tmp/blend65-phase5-red-runtime.log`). The cross-module nested-call case passes already. ✅ (completed: 2026-09-24 23:44)

### Step 5.2: Implementation

- [x] 5.2.1 Add ordinary/interrupt function types and exact signature compatibility — `packages/compiler/src/frontend/semantic-types.ts`, `packages/compiler/src/frontend/aggregate-types.ts`, `packages/compiler/src/frontend/direct-calls.ts` — Exact invariant signatures, typed `&function`, function-value call checks, and one-way `word` conversion verified 2026-09-24 23:54: 84 directed frontend cases, compiler typecheck, whitespace and frozen-spec checks pass. The obsolete implementation-tier address deferral expectation now checks both resolved address kinds. Indirect target proof and machine lowering remain later Phase 5 tasks. ✅ (completed: 2026-09-24 23:54)
- [x] 5.2.2 Complete left-to-right nested-call staging and scalar/aggregate marshalling — `packages/compiler/src/frontend/direct-calls.ts`, `packages/compiler/src/semantic/lower.ts`, `packages/compiler/src/storage/inventory.ts` — Existing source-ordered direct-call staging and aggregate borrows retained; function values now use two-byte by-value loads, stages, parameter homes and AX returns. Cross-module nested-call proof and 16 machine-lowering cases pass, with compiler typecheck, formatting, whitespace and frozen-spec checks (2026-09-24 23:57). Function-address lowering is the next task. ✅ (completed: 2026-09-24 23:57)
- [x] 5.2.3 Add finite callable target sets, deterministic joins and safe signature widening — `packages/compiler/src/frontend/effects.ts`, `packages/compiler/src/semantic/operations.ts`, `packages/compiler/src/semantic/whole-program.ts` — One bounded target-neutral propagation pass tracks function addresses through typed storage, parameters, results, aggregates and joins; only an imprecise typed target widens to address-taken functions with the exact signature. The finite/opaque/recursive whole-program oracle and 21 focused cases pass with compiler typecheck, formatting, whitespace and frozen-spec checks (2026-09-25 00:01). Callable effect and machine binding are owned by the following tasks. ✅ (completed: 2026-09-25 00:01)
- [x] 5.2.4 Complete roots, indirect edges, SCC paths and pre-allocation recursion rejection — `packages/compiler/src/frontend/call-cycles.ts`, `packages/compiler/src/semantic/whole-program.ts`, `packages/compiler/src/storage/interference.ts` — Existing deterministic cycle traversal now receives finite indirect edges before allocation; source roots, call graph, liveness and SFA overlap include those targets. The finite/opaque/recursive oracle and 27 directed whole-program/SFA cases pass with compiler typecheck, formatting, whitespace and frozen-spec checks (2026-09-25 00:02). ✅ (completed: 2026-09-25 00:02)
- [x] 5.2.5 Add singleton devirtualization and predefined finite indirect dispatch lowering — `packages/compiler/src/machine/lower.ts`, `packages/compiler/src/machine/lower-control.ts`, `packages/compiler/src/machine/machine-types.ts` — Singleton calls reuse the direct ABI; larger finite sets use a bounded local comparison chain and per-candidate parameter homes, with symbolic address bytes and no registry. Public ACME/VICE source-order and result-byte oracle passes; 26 directed compiler cases, typecheck, formatting, whitespace and frozen-spec checks pass (2026-09-25 00:12). Expert cost comparison remains in 5.3.2. ✅ (completed: 2026-09-25 00:12)
- [x] 5.2.6 Complete call hardware-stack, clobber, helper and dispatch storage accounting — `packages/compiler/src/storage/inventory.ts`, `packages/compiler/src/storage/closure.ts`, `packages/compiler/src/artifacts/costs-evidence-validator.ts` — Indirect call sites enter lifetime and static-home interference, the closed graph drives the existing exact call-stack budget, and emitted dispatch blocks reconcile in validated debug and cost sidecars. Public ACME/VICE case and 35 directed SFA/closure/evidence cases pass with typecheck, formatting, whitespace and frozen-spec checks (2026-09-25 00:14). No evidence schema or runtime registry added. ✅ (completed: 2026-09-25 00:14)
- [x] 5.2.7 Run Phase 5 specification cases and make all immutable expectations green — Phase 5 test files — All 21 focused frontend/whole-program cases and the public ACME/VICE function-value case pass. Targeted whitespace and frozen-spec checks pass (2026-09-25 00:15); the complete repository checkpoint follows implementation tests. ✅ (completed: 2026-09-25 00:15)

### Step 5.3: Implementation Tests and Qualification

- [x] 5.3.1 Add target-set lattice, malformed edge, SCC order and dispatch binding tests — `packages/compiler/src/semantic/whole-program.impl.test.ts`, `packages/compiler/src/storage/sfa.impl.test.ts`, `packages/compiler/src/machine/lowering.impl.test.ts` — Precise joined targets, malformed absent functions, shuffled recursive paths, indirect-call home interference, and bound two-target dispatch are covered. The dispatch case uses the smaller existing `call-retention.impl.test.ts` rather than the oversized generic lowering test. All 27 directed cases, compiler typecheck, formatting, whitespace and frozen-spec checks pass (2026-09-25 00:18). ✅ (completed: 2026-09-25 00:18)
- [x] 5.3.2 Run complete call/function-value ACME/VICE and expert qualification — `test/rd04/function-values.spec.test.ts`, `test/rd04/expert/calls.json`, `test/rd04/expert-calls.impl.test.ts` — The user-approved bounded corrections now cover borrowed aggregate mutation, field and direct-caller initialization, both allocator placement paths, and A/AX-return indirect thunks. The independent behavior oracle runs both void and scalar target choices plus borrowed-field mutation in VICE; the 6-byte/11-cycle dispatch expectation remains distinct. Frozen install, build, typecheck and complete tests pass: compiler 1,166; root 131; CLI 60; language server 12; VS Code 6. Formatting, whitespace, documentation and frozen-`spec/` checks pass. Separate optimization debt remains in issues #83 and #84. ✅ (completed: 2026-09-25 02:26)

**Independent Phase 5 review (2026-09-25):** correctness, language-semantics and performance reviewers inspected the complete phase-baseline worktree snapshot. Planned specification tests were added before implementation, recorded RED, and not weakened; frozen `spec/` is unchanged. Full pre-review verification passed, but the findings below block phase closeout and commit pending a user ruling:

| Finding | Severity | Narrow correction |
|---|---|---|
| RV-001 / S1 | Major | Keep exact function signatures and aggregate field/element provenance through borrowed parameters, so legal calls neither include incompatible targets nor gain false recursion edges. |
| RV-002 | Major | Pass readonly function-value fields by value; reserve the const-aggregate restriction for array/struct parameters. |
| S2 | Major | Track unknown or uninitialized provenance so a nonempty known-target set cannot hide a possible opaque call. |
| PE-001 | Major | Replace the inferior expert dispatch oracle; use a page-safe, ABI-equivalent indirect-JMP thunk only when its pointer and interrupt conditions are proved, retaining the bounded comparison fallback. |
| S3 | Minor | Render the actual indirect-call expression and function type in E10277 instead of literal placeholders. |

No runtime registry, new IR, generic framework or source restriction is authorized by these findings. A single fix-scoped re-review is permitted after approved major corrections.

The user approved the recommended bounded correction pass on 2026-09-25: correct the four major findings and the diagnostic text, rerun full verification and one focused independent re-review, then make a local green checkpoint commit without pushing. No general framework or extra product surface was approved.

**One fix-scoped re-review (2026-09-25):** The approved corrections pass the complete install, build, typecheck and test commands (compiler 1,160; root 131; CLI 60; LSP 12; VS Code 6). A subsequent compiler-only repeat hit the pre-existing five-second timeout in one project-service test under review load; that test passed on directed retry. The new void-call thunk ran both targets correctly in VICE. Reviewers nevertheless found the following new or remaining major gaps, so 5.3.2 remains `[~]`, Phase 5 is not closed, and no checkpoint commit is permitted before a user ruling. This is the single permitted fix-scoped re-review; no third review is scheduled.

| Finding | Severity | Verified impact / narrow proposed correction |
|---|---|---|
| S4 | Major | A borrowed struct parameter can write a callback field, but target proof keeps only the caller's old target and may devirtualize to the wrong function. Carry the alias mutation back to the caller or conservatively retain every compatible target. |
| S5 / RV-001 | Major | A field-only callback assignment and a global callback assigned before entering its caller both falsely produce E10277. Track definite assignment at member paths and preserve proven caller-before-callee initialization without accepting an uninitialized route. |
| RV-002 | Major | The exhaustive allocator fallback does not honor the callable-word NMOS page-end exclusion used by first-fit. Apply the same guard in both placement paths. |
| PE-001 | Major | No-argument byte/word-return callbacks still use comparison dispatch where the same 6-byte/11-cycle thunk can preserve A/AX via existing result retention. Keep aggregate returns on the fallback path. |
| PE-002 | Minor | Repeated sites using the same pointer home emit duplicate 3-byte thunks. Reuse one per home within a function when the safety proof matches; tracked in [issue #84](https://github.com/blendsdk/blend65/issues/84). |

The first item is a wrong-program risk, not only a diagnostic or cost gap. The correction scope remains no registry, new IR, generic framework or source restriction. These findings required the subsequent user ruling before implementation resumed.

The user approved the recommended bounded fix for the four major gaps on 2026-09-25. The minor duplicate-thunk observation is tracked separately in issue #84, not added to this correction scope. The corrected behavior, expert dispatch, complete repository verification and source checks pass, so Phase 5 is closed. No third independent review is scheduled.

**Deliverables:** normal nested calls, typed finite callables and exact recursion rejection.

**Verify:** `yarn workspace @blend65/compiler test && yarn test`

## Phase 6: Interrupt Functions and Execution Domains

> **Phase baseline tree**: `36e3864f4077702d087e572299657086387d76a8`
> **Expected modification set**: Phase 6 task paths in `packages/compiler/src/target/`, `frontend/`, `semantic/`, `storage/`, `machine/`, `layout/`, and `artifacts/`; `test/rd04/` interrupt evidence; this plan and the feature roadmap. Scope mode: strict; complete finite interrupt domains through existing compiler stages, with no runtime, scheduler, or framework.
> **Lenses**: interrupt semantics, stack/flag correctness, concurrency, SFA domains

### Step 6.1: Specification Tests

**Reference**: [03-03 §Interrupt Domains](03-03-calls-abi-and-sfa.md#interrupt-domains) · ST-35–ST-38

- [x] 6.1.1 [spec-author] Write sink, entry-variant, ownership, stack and shared-state specification cases — `packages/compiler/src/frontend/profile.spec.test.ts`, `packages/compiler/src/storage/sfa.spec.test.ts`, `test/rd04/interrupts.spec.test.ts` — Verified 2026-09-25 02:35: 14 new specification cases are RED as required; targeted typecheck and formatting pass.
- [x] 6.1.2 Run only the new Phase 6 specification cases and record the expected red failures — Phase 6 test files — Verified 2026-09-25 02:35: compiler 8/8 new cases RED, root 6/6 RED; other 26 directed cases pass. Existing frontend accepts invalid handler forms or returns incomplete; build returns COMPILER_INCOMPLETE for sink/entry/domain paths.

### Step 6.2: Implementation

- [x] 6.2.1 Complete profile interrupt sinks, source-kind provenance and entry selection — `packages/compiler/src/target/profile.ts`, `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/semantic/operations.ts` — Verified 2026-09-25 09:03: 51 directed frontend, target and semantic cases pass; compiler typecheck, formatting, whitespace and frozen-spec checks pass. AR-P15's old exact list was updated narrowly; later tasks consume the selected profile route and lower the machine entry.
- [x] 6.2.2 Add execution domains, install/restore ownership and shared-state hazard analysis — `packages/compiler/src/frontend/effects.ts`, `packages/compiler/src/semantic/whole-program.ts`, `packages/compiler/src/frontend/flow.ts` — Verified 2026-09-25 10:11: profile-selected handler domains propagate through the closed call graph; ordered per-sink ownership effects detect unmatched restores, unequal joins, and raw-vector invalidation across helpers; source effects yield shared-state warnings. Compiler typecheck, 51 directed tests, targeted formatting, raw-helper and hazard probes, whitespace and frozen-spec checks pass. Four end-to-end interrupt cases remain expected-RED at machine lowering. ✅ (completed: 2026-09-25 10:11)
- [x] 6.2.3 Allocate domain-specific homes/variants and exact stack peaks — `packages/compiler/src/storage/inventory.ts`, `packages/compiler/src/storage/interference.ts`, `packages/compiler/src/storage/closure.ts` — Verified 2026-09-25: independent mainline/IRQ homes and finite stack-capacity rejection pass directed and full checks. RV-010 notes a safe but sometimes conservative pairing of independent stack maxima; the precise-route correction is tracked for RD-04 Phase 9 in the expressiveness ledger.
- [x] 6.2.4 Lower raw, firmware-chain, firmware-exclusive and ordinary callback entries — `packages/compiler/src/machine/lower-c64.ts`, `packages/compiler/src/machine/lower.ts`, `packages/compiler/src/layout/startup.ts` — Verified 2026-09-25: selected entries, explicit raw addresses, initializer depth, direct conditional IRQ selection and AR-P17 E10245 rejection pass directed and full checks. Sink-only conditional selection emits no duplicate raw RTI body.
- [x] 6.2.5 Publish variant, vector, predecessor-link, stack, ROM-tail and shared-state evidence — `packages/compiler/src/artifacts/debug-evidence-validator.ts`, `packages/compiler/src/artifacts/memory-evidence-validator.ts`, `packages/compiler/src/artifacts/costs-evidence-validator.ts` — Verified 2026-09-25: multi-location machine variants, links and complete evidence pass directed and full checks. RV-009's source-call context on later variants remains a minor RD-04 qualification item.
- [x] 6.2.6 Run Phase 6 specification cases and make all immutable expectations green — Phase 6 test files — Verified 2026-09-25: all 14 Phase 6 specification cases pass unchanged after their red baseline; full suite passes (1,180 compiler and 140 root tests).

### Step 6.3: Implementation Tests and Qualification

- [x] 6.3.1 Add domain-overlap, unsafe-nesting, join-state and page-wrap implementation tests — `packages/compiler/src/semantic/whole-program.impl.test.ts`, `packages/compiler/src/storage/closure.impl.test.ts`, `packages/compiler/src/machine/lowering-c64.impl.test.ts` — Verified 2026-09-25: directed coverage includes transitive handler-side rejection, balanced ownership, separate homes, nested links, finite conditional selection, initializer depth, raw address use and evidence variants.
- [x] 6.3.2 Run complete interrupt ACME/VICE state and equal-contract expert qualification — `test/rd04/interrupts.spec.test.ts`, `test/rd04/expert/interrupts.json`, `test/rd04/vice.spec.test.ts` — Verified 2026-09-25: install/restore, conditional choices, entry costs and stack balance pass ACME and sequential VICE; final install/build/typecheck/full tests pass (1,185 compiler and 141 root tests). Status: VICE-verified / hardware-unverified. Meet-only whole-program win path is tracked in issue #85.

**Deliverables:** finite zero-runtime interrupt domains with exact selected C64 entries.

**Review status (2026-09-25):** RV-002–RV-006 are fixed and the one allowed re-review confirms their functional paths. RV-001 spec tests were authored and shown RED before implementation, then left unchanged. RV-008's raw RTI duplication is corrected by lowering a direct conditional sink choice as two exclusive control-flow arms; directed machine and VICE cases pass and assert only the two selected CINV entries. This compiler-owned correction adds no runtime state. RV-009 (source-call context on only the first machine variant) and RV-010 (conservative rather than exact mainline/IRQ stack pairing) are minor, recorded for RD-04 qualification. AR-P17's approved handler-side IRQ update deferral is enforced with E10245 and owned by RD-05. No third independent review is dispatched under the one-re-review limit.

**Verify:** `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`

## Phase 7: Compile-Time Functions, Intrinsics and Core Embed

> **Phase baseline tree**: `204870d0520a1ab6553ba9cf8a331c8dfa52795e`
> **Expected modification set**: Phase 7 task paths in `packages/compiler/src/frontend/`, `packages/compiler/src/semantic/`, `packages/compiler/src/machine/`, `packages/compiler/src/assets/`, `packages/compiler/src/layout/`, `packages/compiler/src/storage/`, `packages/compiler/src/artifacts/`, and `test/rd04/`; this plan and the feature roadmap. Scope mode: strict; extend the existing compiler with no new package, runtime, framework, or speculative asset handler.
> **Lenses**: deterministic evaluation, bounded resources, machine-state effects, input safety

### Step 7.1: Specification Tests

**Reference**: [03-03 §Compile-Time Execution](03-03-calls-abi-and-sfa.md#compile-time-execution) · ST-40–ST-45

- [x] 7.1.1 [spec-author] Write compile-time evaluator, exact meter and trigonometric specification cases — `packages/compiler/src/frontend/comptime.spec.test.ts`, `test/rd04/comptime.spec.test.ts` — Verified RED 2026-09-25: 23 frontend and 2 build cases fail on missing Phase 7 behavior; typecheck, formatting, whitespace and frozen-spec checks pass. Full sin16 stream hash is owned by 7.3.1's internal-function test. ✅ (completed: 2026-09-25 16:01)
- [x] 7.1.2 [spec-author] Write memory/query/CPU/BCD/embed specification cases — `packages/compiler/src/frontend/intrinsics.spec.test.ts`, `packages/compiler/src/assets/raw-asset.spec.test.ts`, `test/rd04/intrinsics-runtime.spec.test.ts` — AR-P19 assigns source-visible profile facts to RD-05. Verified directed RED: 9 compiler and 7 root cases fail on missing behavior, while 21 compiler and 2 root cases pass; typecheck, targeted formatting, whitespace and frozen-spec checks pass. ✅ (completed: 2026-09-25 16:38)
- [x] 7.1.3 Run only the new Phase 7 specification cases and record the expected red failures — Phase 7 test files — Combined directed RED: 32 failed/21 passed in three compiler files and 9 failed/2 passed in two root files. The passing cases cover already-working dynamic access, traversal refusal and unknown removed-opcode names; failures name missing evaluator, CPU, BCD, raw embed and source-lookup behavior. ✅ (completed: 2026-09-25 16:40)

### Step 7.2: Implementation

- [x] 7.2.1 Add the deterministic typed compile-time evaluator and exact production meters — `packages/compiler/src/frontend/comptime.ts`, `packages/compiler/src/frontend/comptime-budget.ts`, `packages/compiler/src/frontend/analyzer.ts`, with focused existing frontend support — Typed scalar calls, local mutation, selected flow, source-dependent constant ordering, no target function body, and fixed production/reduced internal step/live-byte/depth limits are implemented. Folded scalar built-ins retain ordered argument accounting; alias reads do not invent storage. Verified nine evaluator spec cases and 45 aggregate regressions, build, typecheck, formatting and frozen-spec checks. Full compiler suite: 1,198 passed; 23 RED failures belong to later Phase 7 trigonometry, CPU/BCD and embed tasks. ✅ (completed: 2026-09-25 17:06)
- [x] 7.2.2 Implement exact integer trigonometry, aggregate returns and all-or-nothing evaluator results — `packages/compiler/src/frontend/comptime.ts`, `packages/compiler/src/frontend/constants.ts`, `packages/compiler/src/semantic/lower.ts` — Deterministic integer sine/cosine passes both canonical stream hashes. Fixed struct/array results, prior constant reads, nested aggregate writes, and failed-root discard have directed frontend and build evidence. The evaluator is split into focused modules; build, typecheck, 76 directed compiler cases, and both compile-time build cases pass. Full compiler suite has 1,214 passes and only the same 9 expected later-task CPU/BCD/embed failures. ✅ (completed: 2026-09-25 20:09)
- [x] 7.2.3 Complete dynamic memory access and size/count queries — `packages/compiler/src/frontend/expressions.ts`, `packages/compiler/src/semantic/operations.ts`, `packages/compiler/src/machine/lower-memory.ts` — Existing frontend, semantic and machine paths already handled computed addresses and word count queries. Corrected only the ACME spelling of unambiguous absolute stores, preserving the selected bytes. Directed frontend cases, VICE dynamic-address execution, low-first assembly, any-size count forwarding, build and typecheck pass. Full compiler suite has 1,214 passes and the same 9 later-task CPU/BCD/embed failures. ✅ (completed: 2026-09-25 23:25)
- [x] 7.2.4 Complete five CPU controls, status-stack proof and packed BCD semantics/lowering — `packages/compiler/src/frontend/flow.ts`, `packages/compiler/src/semantic/operations.ts`, `packages/compiler/src/machine/lower-arithmetic.ts` — Verified 2026-09-26 00:17: all focused frontend and compile-time cases, VICE decimal execution and CPU instruction-order checks, build, typecheck, formatting and frozen-spec check pass. The complete compiler run has 1,221 passes, one expected raw-asset failure owned by 7.2.5, and one service timeout that passed alone. Whole-program stack-peak accounting remains with 7.2.6. ✅ (completed: 2026-09-26 00:17)
- [!] 7.2.5 Complete contained raw `embed()` dispatch, identity and registered-format refusal — `packages/compiler/src/assets/raw-asset.ts`, `packages/compiler/src/frontend/analyzer.ts`, `packages/compiler/src/layout/c64-layout.ts` — Blocked: AR-P20 requires a user ruling on one obsolete fixed-512-byte raw-asset spec expectation before the frozen variable-length rule can be implemented.
- [ ] 7.2.6 Account for all intrinsic/evaluator effects, homes, helpers and costs — `packages/compiler/src/storage/inventory.ts`, `packages/compiler/src/storage/closure.ts`, `packages/compiler/src/artifacts/costs-evidence-validator.ts`
- [ ] 7.2.7 Run Phase 7 specification cases and make all immutable expectations green — Phase 7 test files

### Step 7.3: Implementation Tests and Qualification

- [ ] 7.3.1 Add meter-charge/release, forbidden-host-input, status-join and embed-parser implementation tests, including the canonical full sin16 stream hash through the evaluator's internal trigonometry function — `packages/compiler/src/frontend/comptime.impl.test.ts`, `packages/compiler/src/frontend/flow.impl.test.ts`, `packages/compiler/src/assets/raw-asset.impl.test.ts`
- [ ] 7.3.2 Run complete compile-time/intrinsic/embed ACME/VICE and expert qualification — `test/rd04/comptime.spec.test.ts`, `test/rd04/intrinsics-runtime.spec.test.ts`, `test/rd04/expert/intrinsics.json`

**Deliverables:** deterministic target-free compile time and complete approved intrinsic surface.

**Verify:** `yarn workspace @blend65/compiler test && yarn test`

## Phase 8: Complete NMOS Backend, Artifacts and Service Identity

> **Phase baseline tree**: _(recorded by exec-plan at phase start)_
> **Lenses**: machine legality, artifact integrity, output parity, package boundaries

### Step 8.1: Specification Tests

**Reference**: [03-04](03-04-machine-and-artifacts.md) · full ST-08 and ST-10 sweeps, ST-46–ST-52

- [ ] 8.1.1 [spec-author] Write complete machine-legality, direct-`none`, layout, artifact and pipeline-wide terminal-publication specification cases — `packages/compiler/src/machine/lowering.spec.test.ts`, `packages/compiler/src/artifacts/evidence.spec.test.ts`, `test/rd04/backend.spec.test.ts`
- [ ] 8.1.2 [spec-author] Write the full ST-08 diagnostic sweep, complete CLI/LSP identity, modern diagnostic wording, readable-assembly evidence and unavailable-capability specification cases — `packages/compiler/src/frontend/diagnostics.spec.test.ts`, `packages/cli/src/commands.spec.test.ts`, `packages/language-server/src/server.spec.test.ts`, `test/rd04/frontend-boundary.spec.test.ts`, `test/rd04/backend.spec.test.ts`
- [ ] 8.1.3 Run only the new Phase 8 specification cases and record the expected red failures — Phase 8 test files

### Step 8.2: Implementation

- [ ] 8.2.1 Split the oversized machine coordinator and complete remaining scalar/helper selections — `packages/compiler/src/machine/lower.ts`, `packages/compiler/src/machine/lower-operation.ts`, `packages/compiler/src/machine/lower-helpers.ts`
- [ ] 8.2.2 Complete aggregate/control/call lowering and generic fallback paths — `packages/compiler/src/machine/lower-aggregate.ts`, `packages/compiler/src/machine/lower-control.ts`, `packages/compiler/src/machine/lower-operation.ts`
- [ ] 8.2.3 Complete NMOS legality, state/clobber validation and deterministic branch repair — `packages/compiler/src/machine/validate.ts`, `packages/compiler/src/machine/block-layout.ts`, `packages/compiler/src/target/nmos6510.ts`
- [ ] 8.2.4 Complete layout, ACME serialization with stable source-related labels and meaningful routine/data boundary comments, report reconciliation and final PRG packaging — `packages/compiler/src/layout/c64-layout.ts`, `packages/compiler/src/artifacts/acme-serializer.ts`, `packages/compiler/src/artifacts/acme-validate.ts`
- [ ] 8.2.5 Complete build/memory/cost/debug evidence without schema changes — `packages/compiler/src/artifacts/evidence.ts`, `packages/compiler/src/artifacts/memory-evidence-validator.ts`, `packages/compiler/src/artifacts/costs-evidence-validator.ts`
- [ ] 8.2.6 Keep compiler/CLI/LSP failure and canonical diagnostic identity through public services; correct source-facing diagnostic wording where the cases require it — `packages/compiler/src/services/services.ts`, `packages/cli/src/run.ts`, `packages/language-server/src/server.ts`
- [ ] 8.2.7 Run Phase 8 specification cases and make all immutable expectations green — Phase 8 test files

### Step 8.3: Implementation Tests and Qualification

- [ ] 8.3.1 Add malformed-machine, branch-range, ACME mismatch and evidence/publication implementation tests — `packages/compiler/src/machine/lowering.impl.test.ts`, `packages/compiler/src/artifacts/evidence.impl.test.ts`, `packages/compiler/src/publication/publication.impl.test.ts`
- [ ] 8.3.2 Run complete backend/artifact/service ACME qualification and expert comparisons using one normal-form complete-language example; assert its source-related routine/data labels and comments directly in the generated assembly — `test/rd04/backend.spec.test.ts`, `test/rd04/expert-output.spec.test.ts`, `test/rd04/frontend-boundary.spec.test.ts`

**Deliverables:** complete legal `none` backend, coherent artifacts and identical public services.

**Verify:** `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`

## Phase 9: Complete Qualification and Closeout

> **Phase baseline tree**: _(recorded by exec-plan at phase start)_
> **Lenses**: completeness, independent evidence, expert parity, portability, deferral expiry

This phase adds no language or lowering behavior. Specification-first cases were authored before
their implementation in Phases 1–8; Phase 9 reconciles and executes them.

### Step 9.1: Evidence Reconciliation

**Reference**: [03-05](03-05-qualification.md) · ST-49–ST-54 · AR-P3–AR-P7

- [ ] 9.1.1 Complete every crosswalk owner/proof reference and prove exact normative set equality — `test/rd04/normative-coverage.json`, `test/rd04/normative-coverage.spec.test.ts`
- [ ] 9.1.2 Validate all independent behavior-oracle mutation probes — `test/rd04/oracle-integrity.spec.test.ts`, `test/rd04/oracles/`
- [ ] 9.1.3 Reconcile every expert comparison; fix worse results and file measured meet-only debt — `test/rd04/expert/`, `test/rd04/expert-output.spec.test.ts`
- [ ] 9.1.4 Run the complete bounded sequential RD-04 VICE corpus and record `VICE-verified / hardware-unverified` — `test/rd04/vice.spec.test.ts`, `test/rd04/vice-driver.ts`

### Step 9.2: Closeout

- [ ] 9.2.1 Run complete compiler/CLI/LSP boundary and unavailable-capability qualification — `test/rd04/backend.spec.test.ts`, `test/rd04/frontend-boundary.spec.test.ts`
- [ ] 9.2.2 Run portability, frozen-spec and no-runtime/no-framework structural inspections — `test/rd04/portability.spec.test.ts`, `test/rd04/backend.spec.test.ts`
- [ ] 9.2.3 Record non-gating host responsiveness observations and the AR-P5 native Windows deferral — `codeops/features/blend65-v4/plans/rd-04-language-completion/08-closeout.md`
- [ ] 9.2.4 Complete the mandatory deferral-expiry/expressiveness scan and final full verification — `codeops/features/blend65-v4/plans/rd-04-language-completion/08-closeout.md`, `test/rd04/expressiveness-ledger.json`, `test/rd04/expressiveness-ledger.spec.test.ts` (AR-P9). Update the feature roadmap at the lifecycle transition.

**Deliverables:** complete Linux RD-04 evidence, explicit Windows deferral, owned expired deferrals.

**Verify:** `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`

## Dependencies

```text
Phase 1 authority/frontend
  -> Phase 2 scalar/control semantics
  -> Phase 3 aggregate/address semantics
  -> Phase 4 aggregate ABI/SFA
  -> Phase 5 calls/function values
  -> Phase 6 interrupt domains
  -> Phase 7 compile time/intrinsics/embed
  -> Phase 8 backend/artifacts/services
  -> Phase 9 qualification/closeout
```

## Success Criteria

The feature is implementation-complete when:

1. All 99 tasks are verified.
2. Every RD-04 acceptance criterion has decisive crosswalk proof.
3. Focused and repository-wide verification pass on Linux.
4. ACME 0.97 and bounded VICE 3.10 qualification pass where applicable.
5. Every generated family meets or beats its equal-contract expert reference; all meet-only debt is filed.
6. No optional optimizer, runtime, second compiler path, new package or readiness product was added.
7. `spec/` remains frozen and every terminal error suppresses runnable-looking output.
8. Native Windows evidence remains explicitly deferred to RD-10 under AR-P5.
9. The deferral-expiry gate and expressiveness-ledger scan are complete.

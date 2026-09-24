# Execution Plan: RD-04 Language Completion

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-24
> **Progress**: 46/99 tasks (46%)
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

No finding authorizes a new runtime, heap, general optimization framework or spec edit. Findings await a user ruling; no correction or waiver has been applied.

**Verify:** `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`

## Phase 5: Ordinary Calls, Function Values and Recursion

> **Phase baseline tree**: _(recorded by exec-plan at phase start)_
> **Lenses**: call-graph soundness, ABI, whole-program closure, expert call output

### Step 5.1: Specification Tests

**Reference**: [03-03](03-03-calls-abi-and-sfa.md) · ST-30, ST-32–ST-34

- [ ] 5.1.1 [spec-author] Write nested/direct/cross-module call and function-value specification cases — `packages/compiler/src/frontend/expressions.spec.test.ts`, `packages/compiler/src/semantic/whole-program.spec.test.ts`, `test/rd04/function-values.spec.test.ts`
- [ ] 5.1.2 Run only the new Phase 5 specification cases and record the expected red failures — Phase 5 test files

### Step 5.2: Implementation

- [ ] 5.2.1 Add ordinary/interrupt function types and exact signature compatibility — `packages/compiler/src/frontend/semantic-types.ts`, `packages/compiler/src/frontend/aggregate-types.ts`, `packages/compiler/src/frontend/direct-calls.ts`
- [ ] 5.2.2 Complete left-to-right nested-call staging and scalar/aggregate marshalling — `packages/compiler/src/frontend/direct-calls.ts`, `packages/compiler/src/semantic/lower.ts`, `packages/compiler/src/storage/inventory.ts`
- [ ] 5.2.3 Add finite callable target sets, deterministic joins and safe signature widening — `packages/compiler/src/frontend/effects.ts`, `packages/compiler/src/semantic/operations.ts`, `packages/compiler/src/semantic/whole-program.ts`
- [ ] 5.2.4 Complete roots, indirect edges, SCC paths and pre-allocation recursion rejection — `packages/compiler/src/frontend/call-cycles.ts`, `packages/compiler/src/semantic/whole-program.ts`, `packages/compiler/src/storage/interference.ts`
- [ ] 5.2.5 Add singleton devirtualization and predefined finite indirect dispatch lowering — `packages/compiler/src/machine/lower.ts`, `packages/compiler/src/machine/lower-control.ts`, `packages/compiler/src/machine/machine-types.ts`
- [ ] 5.2.6 Complete call hardware-stack, clobber, helper and dispatch storage accounting — `packages/compiler/src/storage/inventory.ts`, `packages/compiler/src/storage/closure.ts`, `packages/compiler/src/artifacts/costs-evidence-validator.ts`
- [ ] 5.2.7 Run Phase 5 specification cases and make all immutable expectations green — Phase 5 test files

### Step 5.3: Implementation Tests and Qualification

- [ ] 5.3.1 Add target-set lattice, malformed edge, SCC order and dispatch binding tests — `packages/compiler/src/semantic/whole-program.impl.test.ts`, `packages/compiler/src/storage/sfa.impl.test.ts`, `packages/compiler/src/machine/lowering.impl.test.ts`
- [ ] 5.3.2 Run complete call/function-value ACME/VICE and expert qualification — `test/rd04/function-values.spec.test.ts`, `test/rd04/expert/calls.json`, `test/rd04/vice.spec.test.ts`

**Deliverables:** normal nested calls, typed finite callables and exact recursion rejection.

**Verify:** `yarn workspace @blend65/compiler test && yarn test`

## Phase 6: Interrupt Functions and Execution Domains

> **Phase baseline tree**: _(recorded by exec-plan at phase start)_
> **Lenses**: interrupt semantics, stack/flag correctness, concurrency, SFA domains

### Step 6.1: Specification Tests

**Reference**: [03-03 §Interrupt Domains](03-03-calls-abi-and-sfa.md#interrupt-domains) · ST-35–ST-38

- [ ] 6.1.1 [spec-author] Write sink, entry-variant, ownership, stack and shared-state specification cases — `packages/compiler/src/frontend/profile.spec.test.ts`, `packages/compiler/src/storage/sfa.spec.test.ts`, `test/rd04/interrupts.spec.test.ts`
- [ ] 6.1.2 Run only the new Phase 6 specification cases and record the expected red failures — Phase 6 test files

### Step 6.2: Implementation

- [ ] 6.2.1 Complete profile interrupt sinks, source-kind provenance and entry selection — `packages/compiler/src/target/profile.ts`, `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/semantic/operations.ts`
- [ ] 6.2.2 Add execution domains, install/restore ownership and shared-state hazard analysis — `packages/compiler/src/frontend/effects.ts`, `packages/compiler/src/semantic/whole-program.ts`, `packages/compiler/src/frontend/flow.ts`
- [ ] 6.2.3 Allocate domain-specific homes/variants and exact stack peaks — `packages/compiler/src/storage/inventory.ts`, `packages/compiler/src/storage/interference.ts`, `packages/compiler/src/storage/closure.ts`
- [ ] 6.2.4 Lower raw, firmware-chain, firmware-exclusive and ordinary callback entries — `packages/compiler/src/machine/lower-c64.ts`, `packages/compiler/src/machine/lower.ts`, `packages/compiler/src/layout/startup.ts`
- [ ] 6.2.5 Publish variant, vector, predecessor-link, stack, ROM-tail and shared-state evidence — `packages/compiler/src/artifacts/debug-evidence-validator.ts`, `packages/compiler/src/artifacts/memory-evidence-validator.ts`, `packages/compiler/src/artifacts/costs-evidence-validator.ts`
- [ ] 6.2.6 Run Phase 6 specification cases and make all immutable expectations green — Phase 6 test files

### Step 6.3: Implementation Tests and Qualification

- [ ] 6.3.1 Add domain-overlap, unsafe-nesting, join-state and page-wrap implementation tests — `packages/compiler/src/semantic/whole-program.impl.test.ts`, `packages/compiler/src/storage/closure.impl.test.ts`, `packages/compiler/src/machine/lowering-c64.impl.test.ts`
- [ ] 6.3.2 Run complete interrupt ACME/VICE state and equal-contract expert qualification — `test/rd04/interrupts.spec.test.ts`, `test/rd04/expert/interrupts.json`, `test/rd04/vice.spec.test.ts`

**Deliverables:** finite zero-runtime interrupt domains with exact selected C64 entries.

**Verify:** `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`

## Phase 7: Compile-Time Functions, Intrinsics and Core Embed

> **Phase baseline tree**: _(recorded by exec-plan at phase start)_
> **Lenses**: deterministic evaluation, bounded resources, machine-state effects, input safety

### Step 7.1: Specification Tests

**Reference**: [03-03 §Compile-Time Execution](03-03-calls-abi-and-sfa.md#compile-time-execution) · ST-40–ST-45

- [ ] 7.1.1 [spec-author] Write compile-time evaluator, exact meter and trigonometric specification cases — `packages/compiler/src/frontend/comptime.spec.test.ts`, `test/rd04/comptime.spec.test.ts`
- [ ] 7.1.2 [spec-author] Write memory/query/profile/CPU/BCD/embed specification cases — `packages/compiler/src/frontend/intrinsics.spec.test.ts`, `packages/compiler/src/assets/raw-asset.spec.test.ts`, `test/rd04/intrinsics-runtime.spec.test.ts`
- [ ] 7.1.3 Run only the new Phase 7 specification cases and record the expected red failures — Phase 7 test files

### Step 7.2: Implementation

- [ ] 7.2.1 Add the deterministic typed compile-time evaluator and exact production meters — `packages/compiler/src/frontend/comptime.ts`, `packages/compiler/src/frontend/comptime-budget.ts`, `packages/compiler/src/frontend/analyzer.ts`
- [ ] 7.2.2 Implement exact integer trigonometry, aggregate returns and all-or-nothing evaluator results — `packages/compiler/src/frontend/comptime.ts`, `packages/compiler/src/frontend/constants.ts`, `packages/compiler/src/semantic/lower.ts`
- [ ] 7.2.3 Complete dynamic memory access, size/count and selected-profile queries — `packages/compiler/src/frontend/expressions.ts`, `packages/compiler/src/semantic/operations.ts`, `packages/compiler/src/machine/lower-memory.ts`
- [ ] 7.2.4 Complete five CPU controls, status-stack proof and packed BCD semantics/lowering — `packages/compiler/src/frontend/flow.ts`, `packages/compiler/src/semantic/operations.ts`, `packages/compiler/src/machine/lower-arithmetic.ts`
- [ ] 7.2.5 Complete contained raw `embed()` dispatch, identity and registered-format refusal — `packages/compiler/src/assets/raw-asset.ts`, `packages/compiler/src/frontend/analyzer.ts`, `packages/compiler/src/layout/c64-layout.ts`
- [ ] 7.2.6 Account for all intrinsic/evaluator effects, homes, helpers and costs — `packages/compiler/src/storage/inventory.ts`, `packages/compiler/src/storage/closure.ts`, `packages/compiler/src/artifacts/costs-evidence-validator.ts`
- [ ] 7.2.7 Run Phase 7 specification cases and make all immutable expectations green — Phase 7 test files

### Step 7.3: Implementation Tests and Qualification

- [ ] 7.3.1 Add meter-charge/release, forbidden-host-input, status-join and embed-parser implementation tests — `packages/compiler/src/frontend/comptime.impl.test.ts`, `packages/compiler/src/frontend/flow.impl.test.ts`, `packages/compiler/src/assets/raw-asset.impl.test.ts`
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

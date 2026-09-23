# Execution Plan: RD-04 Language Completion

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-23 15:04
> **Progress**: 0/99 tasks (0%)
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

> **Phase baseline tree**: _(recorded by exec-plan at phase start)_
> **Lenses**: correctness, maintainability, standards, language semantics, diagnostic integrity

### Step 1.1: Specification Tests

**Reference**: [03-01](03-01-authority-and-frontend.md) · ST-01–ST-10 · AR-P6–AR-P8

- [ ] 1.1.1 [spec-author] Write coverage, lexer and parser specification cases — `test/rd04/normative-coverage.spec.test.ts`, `packages/compiler/src/frontend/lexer.spec.test.ts`, `packages/compiler/src/frontend/parser.spec.test.ts`
- [ ] 1.1.2 [spec-author] Write module, scope, diagnostic and CLI/LSP identity specification cases — `packages/compiler/src/frontend/modules.spec.test.ts`, `packages/compiler/src/frontend/service.spec.test.ts`, `test/rd04/frontend-boundary.spec.test.ts`
- [ ] 1.1.3 Run only the new Phase 1 specification cases and record the expected red failures — Phase 1 test files

### Step 1.2: Implementation

**Reference**: [03-01 §Implementation Details](03-01-authority-and-frontend.md#implementation-details) · AR-P6, AR-P8

- [ ] 1.2.1 Add the static coverage artifact and exact source-key validator — `test/rd04/normative-coverage.json`, `test/rd04/normative-coverage.spec.test.ts`
- [ ] 1.2.2 Extract type/declaration parsing from the oversized parser without changing accepted behavior — `packages/compiler/src/frontend/parser.ts`, `packages/compiler/src/frontend/parser-declarations.ts`, `packages/compiler/src/frontend/parser.impl.test.ts`
- [ ] 1.2.3 Complete token inventory, literals, UTF-8, maximal munch and lexical diagnostics — `packages/compiler/src/frontend/tokens.ts`, `packages/compiler/src/frontend/lexer.ts`, `packages/compiler/src/frontend/diagnostics.ts`
- [ ] 1.2.4 Complete syntax nodes, grammar, Pratt integration and bounded recovery; remove Phase 1 pending syntax — `packages/compiler/src/frontend/syntax.ts`, `packages/compiler/src/frontend/parser-declarations.ts`, `packages/compiler/src/frontend/statements.ts`
- [ ] 1.2.5 Complete module graph, symbol identity, scopes and deterministic initializer ordering — `packages/compiler/src/frontend/modules.ts`, `packages/compiler/src/frontend/module-bindings.ts`, `packages/compiler/src/frontend/effects.ts`
- [ ] 1.2.6 Complete the RD-04-applicable frontend diagnostic registry and terminal poison handling — `packages/compiler/src/frontend/diagnostics.ts`, `packages/compiler/src/frontend/service.ts`, `packages/compiler/src/services/services.ts`
- [ ] 1.2.7 Run Phase 1 specification cases and make all immutable expectations green — Phase 1 test files

### Step 1.3: Implementation Tests and Qualification

**Reference**: [03-05](03-05-qualification.md) · ST-01–ST-10

- [ ] 1.3.1 Add recovery-budget, graph-order and malformed-crosswalk implementation tests — `packages/compiler/src/frontend/parser.impl.test.ts`, `packages/compiler/src/frontend/modules.impl.test.ts`, `test/rd04/normative-coverage.impl.test.ts`
- [ ] 1.3.2 Run complete frontend/compiler/CLI/LSP family tests, touched-file Prettier, whitespace and frozen-spec checks — affected packages and `test/rd04/`

**Deliverables:** complete frontend; checked authority ledger; identical CLI/LSP diagnostics.

**Verify:** `yarn workspace @blend65/compiler test && yarn workspace @blend65/cli test && yarn workspace @blend65/language-server test && yarn test`

## Phase 2: Scalars, Enums, Expressions and Control Flow

> **Phase baseline tree**: _(recorded by exec-plan at phase start)_
> **Lenses**: language semantics, arithmetic correctness, effect ordering, expert 6502 output

### Step 2.1: Specification Tests

**Reference**: [03-02](03-02-values-and-memory.md) · ST-11–ST-20

- [ ] 2.1.1 [spec-author] Write scalar, enum, conversion and arithmetic-context specification matrices — `packages/compiler/src/frontend/scalars.spec.test.ts`, `packages/compiler/src/frontend/expressions.spec.test.ts`
- [ ] 2.1.2 [spec-author] Write control-flow, switch, effect-order and initialization specification cases — `packages/compiler/src/frontend/flow.spec.test.ts`, `packages/compiler/src/semantic/cfg.spec.test.ts`, `test/rd04/scalars-runtime.spec.test.ts`
- [ ] 2.1.3 Run only the new Phase 2 specification cases and record the expected red failures — Phase 2 test files

### Step 2.2: Implementation

**Reference**: [03-02 §Expression and Arithmetic Rules](03-02-values-and-memory.md#expression-and-arithmetic-rules) · AR-P4, AR-P8

- [ ] 2.2.1 Complete nominal enum, scalar declaration and conversion rules; extract that responsibility from the oversized analyzer — `packages/compiler/src/frontend/semantic-types.ts`, `packages/compiler/src/frontend/analyzer.ts`, `packages/compiler/src/frontend/analyzer-scalars.ts`
- [ ] 2.2.2 Complete exact constant/runtime arithmetic and every scalar operator — `packages/compiler/src/frontend/constants.ts`, `packages/compiler/src/frontend/scalar-expressions.ts`, `packages/compiler/src/frontend/expressions.ts`
- [ ] 2.2.3 Complete exactly-once assignment, short circuit and selected conditional effects — `packages/compiler/src/frontend/conditional-expressions.ts`, `packages/compiler/src/frontend/flow-facts.ts`, `packages/compiler/src/frontend/effects.ts`
- [ ] 2.2.4 Complete `if`/loops/three-clause `for`/switch/jumps and reachability analysis — `packages/compiler/src/frontend/statements.ts`, `packages/compiler/src/frontend/flow.ts`, `packages/compiler/src/semantic/cfg.ts`
- [ ] 2.2.5 Extend semantic operations and split the oversized semantic lowerer by scalar/control responsibility — `packages/compiler/src/semantic/operations.ts`, `packages/compiler/src/semantic/lower.ts`, `packages/compiler/src/semantic/lower-control.ts`
- [ ] 2.2.6 Complete direct `none` scalar/control lowering including division checks and generic CFG paths — `packages/compiler/src/machine/lower-scalar.ts`, `packages/compiler/src/machine/lower-arithmetic.ts`, `packages/compiler/src/machine/lower-control.ts`
- [ ] 2.2.7 Run Phase 2 specification cases and make all immutable expectations green — Phase 2 test files

### Step 2.3: Implementation Tests and Qualification

- [ ] 2.3.1 Add fixed-point, arithmetic-boundary, malformed-CFG and lowering implementation tests — `packages/compiler/src/frontend/scalars.impl.test.ts`, `packages/compiler/src/semantic/cfg.impl.test.ts`, `packages/compiler/src/machine/lowering.impl.test.ts`
- [ ] 2.3.2 Add independent scalar/control behavior and expert-sequence evidence — `test/rd04/scalars-runtime.spec.test.ts`, `test/rd04/expert/scalars.json`, `test/rd04/expert-output.spec.test.ts`

**Deliverables:** complete scalar/control semantics and legal direct NMOS output.

**Verify:** `yarn workspace @blend65/compiler test && yarn test`

## Phase 3: Arrays, Strings, Structs, Addresses and Placement

> **Phase baseline tree**: _(recorded by exec-plan at phase start)_
> **Lenses**: aggregate semantics, alias/lifetime safety, target-neutrality, data placement

### Step 3.1: Specification Tests

**Reference**: [03-02](03-02-values-and-memory.md) · ST-21–ST-29

- [ ] 3.1.1 [spec-author] Write array, ordinal, bounds, string/map and struct specification cases — `packages/compiler/src/frontend/aggregates.spec.test.ts`, `packages/compiler/src/frontend/address-of.spec.test.ts`, `test/rd04/aggregate-runtime.spec.test.ts`
- [ ] 3.1.2 [spec-author] Write placement, loadable-value and address-provenance specification cases — `packages/compiler/src/frontend/profile.spec.test.ts`, `packages/compiler/src/layout/c64-layout.spec.test.ts`, `test/rd04/provenance.spec.test.ts`
- [ ] 3.1.3 Run only the new Phase 3 specification cases and record the expected red failures — Phase 3 test files

### Step 3.2: Implementation

**Reference**: [03-02 §Aggregates and Places](03-02-values-and-memory.md#aggregates-and-places) · AR-P8

- [ ] 3.2.1 Complete nested fixed-array shapes, inference, initializers, ordinals and `length` — `packages/compiler/src/frontend/aggregate-types.ts`, `packages/compiler/src/frontend/aggregate-initialization.ts`, `packages/compiler/src/frontend/aggregates.ts`
- [ ] 3.2.2 Complete immutable character-map conversion and literal diagnostics — `packages/compiler/src/frontend/lexer.ts`, `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/frontend/constants.ts`
- [ ] 3.2.3 Complete nominal structs, packed layout, nested fields and circular-containment rejection — `packages/compiler/src/frontend/aggregate-types.ts`, `packages/compiler/src/frontend/aggregates.ts`, `packages/compiler/src/frontend/analyzer.ts`
- [ ] 3.2.4 Add address provenance, physical ranges, retaining summaries and alias classes — `packages/compiler/src/frontend/semantic-types.ts`, `packages/compiler/src/frontend/effects.ts`, `packages/compiler/src/frontend/flow-facts.ts`
- [ ] 3.2.5 Complete `place(...)` and `loadable const` semantics with honest resident-profile diagnostics — `packages/compiler/src/frontend/analyzer.ts`, `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/layout/c64-layout.ts`
- [ ] 3.2.6 Lower nested array/struct places, dynamic addresses, bounds checks and modulo wrap — `packages/compiler/src/semantic/lower.ts`, `packages/compiler/src/machine/lower-aggregate.ts`, `packages/compiler/src/machine/lower-memory.ts`
- [ ] 3.2.7 Run Phase 3 specification cases and make all immutable expectations green — Phase 3 test files

### Step 3.3: Implementation Tests and Qualification

- [ ] 3.3.1 Add layout-cycle, ordinal-barrier, provenance and malformed-placement implementation tests — `packages/compiler/src/frontend/aggregates.impl.test.ts`, `packages/compiler/src/layout/c64-layout.impl.test.ts`, `packages/compiler/src/machine/lowering.impl.test.ts`
- [ ] 3.3.2 Run complete aggregate/memory ACME and VICE family qualification plus expert comparisons — `test/rd04/aggregate-runtime.spec.test.ts`, `test/rd04/expert/aggregates.json`, `test/rd04/vice.spec.test.ts`

**Deliverables:** complete core aggregate/address semantics through executable machine output.

**Verify:** `yarn workspace @blend65/compiler test && yarn test`

## Phase 4: Aggregate Values, ABI and SFA

> **Phase baseline tree**: _(recorded by exec-plan at phase start)_
> **Lenses**: ABI soundness, SFA closure, alias-safe copies, performance

### Step 4.1: Specification Tests

**Reference**: [03-03 §ABI Family](03-03-calls-abi-and-sfa.md#abi-family) · ST-26, ST-27, ST-31, ST-39

- [ ] 4.1.1 [spec-author] Write aggregate assignment/return/borrow and overlap specification cases — `packages/compiler/src/frontend/aggregates.spec.test.ts`, `packages/compiler/src/storage/sfa.spec.test.ts`, `test/rd04/aggregate-abi.spec.test.ts`
- [ ] 4.1.2 Run only the new Phase 4 specification cases and record the expected red failures — Phase 4 test files

### Step 4.2: Implementation

- [ ] 4.2.1 Complete aggregate value assignment and caller-owned return destinations — `packages/compiler/src/frontend/scalar-assignments.ts`, `packages/compiler/src/frontend/direct-calls.ts`, `packages/compiler/src/semantic/operations.ts`
- [ ] 4.2.2 Complete exact and outer-unsized aggregate parameter ABI records — `packages/compiler/src/frontend/aggregate-types.ts`, `packages/compiler/src/semantic/lower.ts`, `packages/compiler/src/storage/storage-types.ts`
- [ ] 4.2.3 Inventory aggregate destinations, snapshots, caller staging and pointer pairs — `packages/compiler/src/storage/inventory.ts`, `packages/compiler/src/storage/interference.ts`, `packages/compiler/src/storage/closure.ts`
- [ ] 4.2.4 Lower direct construction and overlap-safe copies with explicit scratch/costs — `packages/compiler/src/machine/lower-aggregate.ts`, `packages/compiler/src/machine/lower.ts`, `packages/compiler/src/machine/machine-types.ts`
- [ ] 4.2.5 Reconcile aggregate homes/copies in SFA, memory, cost and debug evidence — `packages/compiler/src/artifacts/memory-evidence-validator.ts`, `packages/compiler/src/artifacts/costs-evidence-validator.ts`, `packages/compiler/src/artifacts/debug-evidence-validator.ts`
- [ ] 4.2.6 Run Phase 4 specification cases and make all immutable expectations green — Phase 4 test files

### Step 4.3: Implementation Tests and Qualification

- [ ] 4.3.1 Add snapshot-lifetime, interference and closure-feedback implementation tests — `packages/compiler/src/storage/sfa.impl.test.ts`, `packages/compiler/src/storage/closure.impl.test.ts`, `packages/compiler/src/machine/call-retention.impl.test.ts`
- [ ] 4.3.2 Run aggregate ABI/SFA ACME/VICE and equal-contract expert qualification — `test/rd04/aggregate-abi.spec.test.ts`, `test/rd04/expert/aggregate-abi.json`, `test/rd04/vice.spec.test.ts`

**Deliverables:** ordinary aggregate values and one closed zero-runtime ABI.

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

**Reference**: [03-04](03-04-machine-and-artifacts.md) · ST-46–ST-52

- [ ] 8.1.1 [spec-author] Write complete machine-legality, direct-`none`, layout and artifact specification cases — `packages/compiler/src/machine/lowering.spec.test.ts`, `packages/compiler/src/artifacts/evidence.spec.test.ts`, `test/rd04/backend.spec.test.ts`
- [ ] 8.1.2 [spec-author] Write complete CLI/LSP identity and unavailable-capability specification cases — `packages/cli/src/commands.spec.test.ts`, `packages/language-server/src/server.spec.test.ts`, `test/rd04/frontend-boundary.spec.test.ts`
- [ ] 8.1.3 Run only the new Phase 8 specification cases and record the expected red failures — Phase 8 test files

### Step 8.2: Implementation

- [ ] 8.2.1 Split the oversized machine coordinator and complete remaining scalar/helper selections — `packages/compiler/src/machine/lower.ts`, `packages/compiler/src/machine/lower-operation.ts`, `packages/compiler/src/machine/lower-helpers.ts`
- [ ] 8.2.2 Complete aggregate/control/call lowering and generic fallback paths — `packages/compiler/src/machine/lower-aggregate.ts`, `packages/compiler/src/machine/lower-control.ts`, `packages/compiler/src/machine/lower-operation.ts`
- [ ] 8.2.3 Complete NMOS legality, state/clobber validation and deterministic branch repair — `packages/compiler/src/machine/validate.ts`, `packages/compiler/src/machine/block-layout.ts`, `packages/compiler/src/target/nmos6510.ts`
- [ ] 8.2.4 Complete layout, ACME serialization/report reconciliation and final PRG packaging — `packages/compiler/src/layout/c64-layout.ts`, `packages/compiler/src/artifacts/acme-serializer.ts`, `packages/compiler/src/artifacts/acme-validate.ts`
- [ ] 8.2.5 Complete build/memory/cost/debug evidence without schema changes — `packages/compiler/src/artifacts/evidence.ts`, `packages/compiler/src/artifacts/memory-evidence-validator.ts`, `packages/compiler/src/artifacts/costs-evidence-validator.ts`
- [ ] 8.2.6 Keep compiler/CLI/LSP failure and diagnostic identity through public services — `packages/compiler/src/services/services.ts`, `packages/cli/src/commands.ts`, `packages/language-server/src/server.ts`
- [ ] 8.2.7 Run Phase 8 specification cases and make all immutable expectations green — Phase 8 test files

### Step 8.3: Implementation Tests and Qualification

- [ ] 8.3.1 Add malformed-machine, branch-range, ACME mismatch and evidence/publication implementation tests — `packages/compiler/src/machine/lowering.impl.test.ts`, `packages/compiler/src/artifacts/evidence.impl.test.ts`, `packages/compiler/src/publication/publication.impl.test.ts`
- [ ] 8.3.2 Run complete backend/artifact/service ACME qualification and expert comparisons — `test/rd04/backend.spec.test.ts`, `test/rd04/expert-output.spec.test.ts`, `test/rd04/frontend-boundary.spec.test.ts`

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

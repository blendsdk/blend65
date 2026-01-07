# Parser Phase 2 Implementation Plan (Agents Spec v3)

## Objective
Reframe the Blend65 parser rollout into tightly scoped, sequential phases that satisfy the updated `.clinerules/agents.md` planning rules. Each phase must stay small enough for an independent iteration while still moving the parser toward full top-level declaration coverage and ordering enforcement.

## Constraints & Shared Assumptions
- Phase 1 scaffolding (lexer integration, parser shell, AST enums, diagnostics plumbing) is already merged and remains authoritative.
- Coding standards and testing requirements from `.clinerules/code.md` and `.clinerules/testing.md` apply to every deliverable (JSDoc, why-focused comments, DRY, exhaustive tests).
- Ordering expectations derive from `plans/ordering.md` and the language specification.
- Every phase must leave the repository buildable with `yarn clean && yarn build && yarn test`.

## Phase 1 – Parser Bootstrap & Deterministic State
**Dependencies:** None (entry point phase).

**Context & Rationale:**
Everything downstream relies on predictable parser initialization. We must guarantee modules, implicit global handling, and parser state flags exist before deeper syntax work begins.

**Deliverables:**
- Deterministic `parseProgram` that injects `module global` when missing.
- Parser state container (documented/JSDoc) tracking explicit vs implicit modules and exported main counts.
- Utility helpers for token peeking/skipping trivia to keep later logic DRY.
- Warning diagnostic signaling implicit module synthesis.

## Phase 2 – Ordering Guards, Diagnostics & Recovery
**Dependencies:** Phase 1 must provide parser state + helpers.

**Context & Rationale:**
Ordering rules shape recovery behavior. Establishing diagnostics + sync strategies now prevents large rewrites when declaration parsers arrive. Per `.clinerules/agents.md`, the phase is now broken into four micro-phases so each deliverable remains reviewable and independently testable.

### Phase 2.1 – Diagnostic Catalog & Tests
- **Dependency:** Task 1.3
- **Goal:** Enumerate every ordering/structure failure the parser must recognize before declaration parsing exists.
- **Deliverables:**
  - Expanded `ParserDiagnosticCode` entries with why-focused doc comments for duplicate module, missing `from`, empty import list, missing `end`, implicit main export, duplicate exported main, etc.
  - Vitest coverage validating message text, severity, and code associations (snapshot or explicit string tests).

### Phase 2.2 – Helper Emitters & Wiring
- **Dependency:** Phase 2.1 diagnostics available
- **Goal:** Centralize diagnostic creation so later parser phases stay DRY and junior-friendly.
- **Deliverables:**
  - Named helper functions such as `reportDuplicateModule`, `reportMissingFromClause`, `reportEmptyImportList`, `reportImplicitMainExport`, each with JSDoc describing parameters/side effects.
  - Parser scaffolding updated to call helpers even in stubbed paths so diagnostics remain reachable. White-box tests validating helpers are invoked.

### Phase 2.3 – Recovery Token Tables
- **Dependency:** Phase 2.2 helpers in place
- **Goal:** Define shared synchronization tables for each declaration type to prevent infinite loops.
- **Deliverables:**
  - Recovery table definitions documenting why each token boundary is safe.
  - Parser hooks that reference the tables plus tests proving we exit panic mode when encountering synced tokens (newline, END, declaration keywords, etc.).

### Phase 2.4 – Ordering Documentation & Traceability
- **Dependency:** Phase 2.3 recovery behavior defined
- **Goal:** Capture the rationale and reference links so future contributors understand the “why”.
- **Deliverables:**
  - Updated `plans/ordering.md` (and cross-links from this plan) explaining ordering contracts, implicit module behavior, and recovery expectations in junior-friendly language.
  - Traceability notes inside this plan’s task table referencing the documentation section for each ordering rule.

## Phase 3 – AST Nodes & Factory Layer
**Dependencies:** Phase 2 provides diagnostic enums used inside factories/tests.

**Context & Rationale:**
Declaration parsers must target stable AST shapes. Implementing nodes/factories now allows unit tests to pin structure before more complex parsing arrives.

**Deliverables:**
- Node interfaces covering modules, imports, exports, functions, parameters, variables, type aliases, enums, and decorators/storage metadata.
- Factory helpers (with exhaustive JSDoc) plus utilities like `withDecorators`, `createIdentifierPath`, and span helpers.
- Snapshot-style unit tests ensuring factories emit correct metadata defaults.

## Phase 4 – Module, Import & Export Parsing
**Dependencies:** Phases 1–3 (state, diagnostics, factories).

**Context & Rationale:**
Top-level topology must exist before tackling heavier declarations. Module/import/export support lets us parse file skeletons and verify export bookkeeping early.

**Deliverables:**
- `parseModuleDeclaration` with duplicate detection and qualified identifiers.
- `parseImportDeclaration` supporting comma lists, mandatory `from`, dotted sources, and recovery.
- `parseExportDeclaration` wrappers that toggle `isExported` flags on nested nodes.
- Integration tests for files combining module + imports + exports.

## Phase 5 – Function, Variable, Type & Enum Parsing Plus Decorators
**Dependencies:** Phase 4 ensures exports wrap correctly and AST factories exist.

**Context & Rationale:**
These declarations carry semantics (callbacks, storage classes, const enforcement). Splitting them into granular tasks keeps the work reviewable.

**Deliverables:**
- Function parsing with params, optional returns, callback flag, `end function` enforcement, auto-exported `main`, and duplicate main diagnostics.
- Variable parsing that handles decorators/storage classes and const initializer requirements.
- Type alias + enum parsing, including placeholder expressions for enum member values and `end enum` enforcement.
- Decorator parsing utilities reused later for statements.
- Exhaustive unit tests per declaration kind.

## Phase 6 – End-to-End Validation, Documentation & Plan Review
**Dependencies:** Phases 1–5 complete.

**Context & Rationale:**
Final validation ensures the parser meets `.clinerules/testing.md`, documentation stays current, and the plan is re-evaluated before shipping.

**Deliverables:**
- Integration suites covering implicit modules, ordering errors, decorator usage, and recovery journeys.
- Documentation updates (language spec, parser roadmap, README if present).
- Recorded plan vs implementation notes for future contributors.
- Verified `yarn clean && yarn build && yarn test` run with captured output.

## Re-Evaluation Checklist
- ✅ Phases progress sequentially with explicit dependencies.
- ✅ Each phase ends with concrete deliverables, aligned to coding/testing standards.
- ✅ Tasks (below) are granular and evenly distributed to avoid oversized iterations.
- ✅ Testing/documentation are embedded, not deferred.
- ✅ A final review phase forces re-checking per `.clinerules/plans.md`.

## Task Table
| Task ID | Phase | Description | Dependencies | Deliverable | Status |
| --- | --- | --- | --- | --- | --- |
| Task 1.1 | Phase 1 | Update `parseProgram` to enforce module-first rule and synthesize `module global` when absent, emitting warning diagnostic. | — | Deterministic module bootstrap. | [x] |
| Task 1.2 | Phase 1 | Introduce parser state flags (`hasExplicitModule`, `hasImplicitModule`, `exportedMainCount`, `sawMainFunction`) with JSDoc + unit tests. | Task 1.1 | Documented state container + coverage. | [x] |
| Task 1.3 | Phase 1 | Implement trivia-aware helpers (`peekEffectiveToken`, `skipNewlines`, etc.) and reuse in `parseProgram`. | Task 1.2 | DRY utilities with tests/doc comments. | [x] |
| Task 2.1.1 | Phase 2.1 | Enumerate ordering/structure diagnostics and add codes/messages to `ParserDiagnosticCode`. | Task 1.3 | Updated enum + why-focused doc comments. | [x] |
| Task 2.1.2 | Phase 2.1 | Add vitest coverage validating diagnostic messages/severity for new codes. | Task 2.1.1 | Snapshot or explicit string tests. | [x] |
| Task 2.2.1 | Phase 2.2 | Implement helper emitters (`reportDuplicateModule`, `reportMissingFromClause`, etc.) with shared span logic + JSDoc. | Task 2.1.2 | Helper module ready. | [x] |
| Task 2.2.2 | Phase 2.2 | Wire helper emitters into parser scaffolding so diagnostics are reachable; add white-box tests. | Task 2.2.1 | Parser invoking helpers. | [x] |
| Task 2.3.1 | Phase 2.3 | Define recovery token tables per declaration type with documentation on safe boundaries. | Task 2.2.2 | Recovery definitions module. | [ ] |
| Task 2.3.2 | Phase 2.3 | Integrate recovery tables into parser sync paths; add tests proving panic mode exits. | Task 2.3.1 | Parser recovery updated. | [ ] |
| Task 2.4.1 | Phase 2.4 | Update `plans/ordering.md` (or companion doc) with ordering rationale + junior-friendly explanations. | Task 2.3.2 | Documentation published. | [ ] |
| Task 2.4.2 | Phase 2.4 | Add traceability notes linking plan tasks to documentation sections. | Task 2.4.1 | Updated plan cross-links. | [ ] |
| Task 3.1 | Phase 3 | Extend AST interfaces for modules/imports/exports/functions/variables/types/enums with decorator metadata fields. | Task 2.3 | Node definitions aligned with requirements. | [x] |
| Task 3.2 | Phase 3 | Implement factory helpers + utilities (withDecorators, identifier paths, spans) including JSDoc + unit tests. | Task 3.1 | Factory layer ready for parser usage. | [x] |
| Task 3.3 | Phase 3 | Create snapshot-based tests validating factory output shapes + defaults. | Task 3.2 | Guardrails for AST regressions. | [ ] |
| Task 4.1 | Phase 4 | Implement `parseModuleDeclaration`, handling qualified names and duplicate-module diagnostics. | Task 3.3 | Module parser + tests. | [ ] |
| Task 4.2 | Phase 4 | Implement `parseImportDeclaration` with comma lists, mandatory `from`, dotted sources, and recovery handlers. | Task 4.1 | Import parser + unit tests. | [ ] |
| Task 4.3 | Phase 4 | Implement `parseExportDeclaration` that wraps nested declarations and toggles export flags consistently. | Task 4.2 | Export parser + tests. | [ ] |
| Task 4.4 | Phase 4 | Add integration tests covering module + import + export scenarios end-to-end. | Task 4.3 | Verified topology parsing. | [ ] |
| Task 5.1 | Phase 5 | Build function parser (params, optional return, callback flag, `end function`, auto-export `main`, duplicate main diagnostics). | Task 4.4 | Function parsing + tests. | [ ] |
| Task 5.2 | Phase 5 | Implement `parseDecoratorList` and storage-class handling for globals. | Task 5.1 | Decorator infrastructure ready. | [ ] |
| Task 5.3 | Phase 5 | Implement variable parser enforcing const initializers and decorator metadata storage. | Task 5.2 | Variable parsing + tests. | [ ] |
| Task 5.4 | Phase 5 | Implement type alias parsing with type expressions and validation diagnostics. | Task 5.3 | Type alias parsing + tests. | [ ] |
| Task 5.5 | Phase 5 | Implement enum parsing including member placeholders and `end enum` enforcement + diagnostics. | Task 5.4 | Enum parsing + tests. | [ ] |
| Task 5.6 | Phase 5 | Add comprehensive unit suites covering all declaration parsers (happy paths + negatives). | Task 5.5 | Robust declaration-level coverage. | [ ] |
| Task 6.1 | Phase 6 | Build integration tests exercising implicit modules, ordering violations, decorators, recovery paths. | Task 5.6 | End-to-end verification suite. | [ ] |
| Task 6.2 | Phase 6 | Update docs (language spec, roadmap) to reflect implemented parser features. | Task 6.1 | Current documentation set. | [ ] |
| Task 6.3 | Phase 6 | Execute `yarn clean && yarn build && yarn test`, archive results, and log plan vs implementation notes. | Task 6.2 | Final verification artifacts + retrospective. | [ ] |

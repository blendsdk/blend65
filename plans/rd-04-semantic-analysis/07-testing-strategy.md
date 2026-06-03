# Testing Strategy: RD-04 Semantic Analysis (Skeleton)

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

This plan delivers **interfaces + a passthrough `analyze()`**, so the test surface is
deliberately small: it verifies that every RD-04 §4 contract **exists and is constructible**,
that the **pure structural type utilities** compute correct values, that the **policy stubs**
exist with their documented placeholder behavior, and that **`analyze()` never throws and
returns the empty model** (AC-01). No semantic-checking behavior is tested — that arrives with
the deferred checker.

> **Spec-tests-first (testing.md Rule 10):** the ST-cases below are written **before**
> implementation and must FAIL first (red), then PASS (green). The immutable-oracle rule
> applies: if the passthrough doesn't match an ST-case, the implementation is wrong — not the
> test. Spec files use `*.spec.test.ts`; edge/internal files use `*.impl.test.ts`.

### Coverage Goals

- Every RD-04 §4 interface in scope: constructible in a test (shape existence).
- Pure structural type utilities: representative + edge inputs.
- `analyze()`: AC-01 on valid, error-laden, and empty inputs.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from [01-requirements.md](01-requirements.md),
> [03-01](03-01-type-model.md)/[03-02](03-02-scope-symbol-model.md)/[03-03](03-03-passthrough-analyzer.md),
> and the [Ambiguity Register](00-ambiguity-register.md). They define expected behavior of the
> **passthrough**, not the (deferred) checker.

### Type model (core)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-S1 | Construct `PrimitiveType`/`ArrayType`/`StructType`/`EnumType`/`ErrorType` | All five variants build; `Type` union accepts each | FR-S1 / §4.4 |
| ST-S2 | `primitive("boolean")` | `{ kind: "primitive", name: "boolean" }` (D5 — `"boolean"`, not `'bool'`) | FR-S2 / D5 |
| ST-S3 | `isInteger(primitive("byte"))` / `isInteger(primitive("word"))` | `true` / `true` | FR-S3 / §4.4 |
| ST-S4 | `isInteger(primitive("boolean"))` / `isInteger(ERROR_TYPE)` | `false` / `false` | FR-S3 / §4.4 |
| ST-S5 | `isSigned(primitive("sbyte"))` / `isUnsigned(primitive("byte"))` | `true` / `true` | FR-S3 |
| ST-S6 | `bitWidth(primitive("byte"))` / `bitWidth(primitive("word"))` | `8` / `16` | FR-S3 |
| ST-S7 | `byteSize(primitive("byte"))` / `byteSize(primitive("word"))` | `1` / `2` | FR-S3 |
| ST-S8 | `isError(ERROR_TYPE)` / `isError(primitive("byte"))` | `true` / `false` | FR-S3 / R29 |
| ST-S9 | `typeName(primitive("sword"))` | `"sword"` (human-readable) | FR-S3 |
| ST-S10 | `isAssignableTo(...)` exists; returns documented placeholder (`true`) | Function exists; no checker semantics asserted | FR-S4 / D10 |
| ST-S11 | `commonType(...)` exists; returns documented placeholder (`null`) | Function exists; no checker semantics asserted | FR-S4 / D10 |
| ST-S12 | Construct `PlatformProfile` / use `DEFAULT_PROFILE` | Stub builds; `DEFAULT_PROFILE.charEncoding` defined | FR-S9 / D4 |

### Scope / Symbol / Model (core)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-S13 | `createScope("global", null, null)` | `{ kind:"global", parent:null, children:[], symbols:Map(0), node:null }` | FR-S5 / §4.2 |
| ST-S14 | Construct a `Symbol` literal | Builds against the `Symbol`/`SymbolKind` interface | FR-S6 / §4.3 |
| ST-S15 | Construct a `ConstValue` `{ type, value }` | Builds | FR-S8 / §4.7 |
| ST-S16 | `emptyCallGraph()` | `functions.size===0`, `edges.size===0`, `findCycles()===[]` | FR-S7 / §4.8 |
| ST-S17 | `createEmptyModel()` shape | `hasErrors===false`, `mainFunction===null`, `globalScope.kind==="global"`, all maps `.size===0`, `initOrder.length===0` | FR-S10/FR-S12 / §4.10 / D2 |
| ST-S18 | `createEmptyModel().typeOf(anyExpr)` | `ERROR_TYPE` (`kind==="error"`) | FR-S13 / D2 |
| ST-S19 | `createEmptyModel().symbolOf(anyNode)` | `null` | FR-S13 / D2 |
| ST-S20 | `createEmptyModel().scopeOf(anyNode)` | the model's `globalScope` (same reference) | FR-S13 / D2 |

### Passthrough `analyze()` (frontend)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-S21 | `parse()` a valid program → `analyze({ programs:[ast], bag, profile:DEFAULT_PROFILE })` | Returns a `SemanticModel`; `hasErrors===false`; empty maps; `mainFunction===null`; **no throw** | AC-01 / FR-S12/FR-S15 |
| ST-S22 | `analyze()` on an AST containing parser error-sentinels | Returns without throwing; `hasErrors===false` (passthrough ignores sentinels — D3) | AC-01 / D3 |
| ST-S23 | `analyze({ programs: [], bag, profile })` | Returns a valid empty model | FR-S12 / D2 |
| ST-S24 | After `analyze()`, the passed `bag` has no new diagnostics added by the analyzer | bag error/warning count unchanged | D3 |
| ST-S25 | `AnalyzeInput` is constructible with `{ programs, bag, profile }` | Type-checks; object accepted | FR-S11 / D6 |
| ST-S26 | The four pass functions (`collectDeclarations`/`resolveTypes`/`checkBodies`/`postCheck`) are callable no-ops | No throw; no model mutation observable | FR-S14 / §4.1 |

> **AUTHORING RULE honored:** every expectation above is derived from the passthrough contract
> (D1–D14), **not** from any imagined checker behavior. Checker expectations are intentionally
> absent and recorded as deferred in [08](08-deferred-semantics-ledger.md).

## Test Categories

### Specification Tests (from ST-cases above)

> Written BEFORE implementation; filed as `*.spec.test.ts`.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `packages/core/src/semantics/type.spec.test.ts` | ST-S1, ST-S2, ST-S8 | Type union |
| `packages/core/src/semantics/type-utils.spec.test.ts` | ST-S3–ST-S11 | Type utilities |
| `packages/core/src/semantics/platform-profile.spec.test.ts` | ST-S12 | PlatformProfile stub |
| `packages/core/src/semantics/semantic-model.spec.test.ts` | ST-S13–ST-S20 | Scope/Symbol/CallGraph/Model |
| `packages/frontend/src/semantics/analyze.spec.test.ts` | ST-S21–ST-S26 | Passthrough analyze |

### Implementation Tests (edge cases, internals)

> Written AFTER implementation; filed as `*.impl.test.ts`.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/core/src/semantics/type-utils.impl.test.ts` | `byteSize`/`bitWidth`/`typeName` across array/struct/enum/void/error variants | High |
| `packages/core/src/semantics/scope.impl.test.ts` | `createScope` parent/child wiring; nested scopes | Med |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| parse→analyze pipeline | frontend lexer+parser+semantics | A real `.blend` snippet lexed, parsed, analyzed; asserts the empty-model passthrough contract (ST-S21/22) |

### End-to-End Tests

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| Gate program through `analyze()` | lex → parse `module Main; function main(): void { poke(0xD020, 5); }` → analyze | No throw; empty `SemanticModel`, `hasErrors===false` (passthrough) |

## Test Data

### Fixtures Needed

- A small valid `.blend` source string (gate program) and its parsed `ProgramNode`.
- An error-laden source string that yields parser error-sentinels.

### Mock Requirements

- None. Use real `DiagnosticBag`, real `parse()`, real `DEFAULT_PROFILE`. (Prefer real objects.)

## Verification Checklist

- [ ] All ST-cases (ST-S1..ST-S26) defined with concrete input/output pairs
- [ ] Every ST-case traces to a requirement / spec doc / AR entry
- [ ] Spec tests written BEFORE implementation
- [ ] Spec tests verified to FAIL before implementation (red phase)
- [ ] All spec tests pass after implementation (green phase)
- [ ] Implementation tests written for type-util edge cases
- [ ] parse→analyze integration test passes
- [ ] No regressions in existing core/frontend tests
- [ ] R15 boundary tier green; `git status --porcelain spec/` empty
- [ ] Deferred behavior is NOT tested here (it is ledgered, not implemented)

# Testing Strategy: RD-18 Slice 3a — Model-Seam Proof

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core seam logic (`function-collection.ts`, `modelToFunctionInfo`) | 90% |
| `analyze()` wiring | 80% |
| Acceptance fixtures / harness glue | covered by the 3-part bar (assemble + golden + VICE) |

- Test names state behavior: `should [expected] when [condition]`.
- File convention: `*.spec.test.ts` for spec (immutable-oracle) tests, `*.impl.test.ts` for edge/
  internal tests.
- The three-part RD-18 acceptance bar (assemble-clean CI, golden CI, VICE local) is the integration/
  E2E tier.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from `01-requirements.md`, the component specs (03-01/02/03), the
> `SemanticModel`/`FunctionInfo` contracts in `@blend65/core`, the RD-05 adapter contract
> (`03-05-allocation-plan-and-api.md`), and the Ambiguity Register. **Immutable oracles** — if one
> fails after implementation, the implementation is wrong.

### Adapter — `modelToFunctionInfo` (03-02)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | `modelToFunctionInfo(populated 3a model)` | `[{ name:"Main.main", parameters:[], locals:[{name:"x", type:primitive("byte"), byRef:false}], isInterrupt:false, isEscaped:false, isReachable:true, callees:[] }]` | FR-2 / AR-6/7/10 |
| ST-1b | `modelToFunctionInfo(createEmptyModel())` | `[]` (RD-05 AC-22 preserved) | FR-2 / AR-9 |
| ST-1c | populated model, `main` with two locals `a,b` (decl order) | `locals` = `[a, b]` in that order | AR-6 |

### Model population — `collectFunctions` / `analyze()` (03-01)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-2 | `collectFunctions([3a program], globalScope)` | `functions` = `{ main }`; `mainFunction` = `main`; `main.scope` is a `kind:"module"` scope whose `node.name === "Main"` (AR-13); `scopeByNode.get(mainDecl)` (the body scope) has `x` as a `kind:"variable"` symbol, `type` byte, in insertion order | FR-1 / AR-5/6/13 |
| ST-3 | `analyze(3a program)` | model with `main ∈ callGraph.functions`, `mainFunction` set, `main.scope.node.name === "Main"` (module scope, AR-13), `scopeOf(mainDecl)` → the body scope containing `x` | FR-1 / AR-10/13 |
| ST-4 | `analyze(function-free intrinsic-free program)` | empty-model passthrough: empty `callGraph.functions`, `mainFunction === null`, no diagnostics, never throws | FR-1 / AR-9 |
| ST-4b | `analyze(function with a body but no locals)` | `main ∈ functions`; its scope has zero variable symbols | AR-5 |

### Acceptance — the 3-part bar (03-03)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-5 | `build()` the `examples/slice3a/main.blend` fixture (c64) | loadable PRG, zero error diagnostics; emitted ASM contains `__frame_Main_main` and `__frame_Main_main_x` | FR-3 / RD-18 AC-1 |
| ST-6 | `emitAsm()` the fixture | byte-exact match with `test/golden/slice3a.asm.golden` | FR-4 / RD-18 AC-2 |
| ST-7 | Run the fixture PRG on VICE 3.10 | `$D020 == 0xF5` (local's slot read into the border register) | FR-5 / RD-18 AC-3 / AR-11 |
| ST-8 | Re-minted gate golden + existing gate VICE test | gate golden gains only `__frame_Main_main`; `gate.spec.test.ts` still asserts `$D020 == 0xF5` | FR-4 / AR-8 |

### Boundary & security

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-9 | ESLint + `test/boundary.spec.test.ts` over `function-collection.ts` + `model-adapter.ts` | no `@blend65/codegen` import (R15/AR-20) | 01 §Compatibility |
| ST-10 | `analyze()` on a malformed/body-less function declaration | no throw; degrades to registering the function without locals (diagnostic-not-crash) | 01 §Security / AR-15/AR-73 |

> **⚠️ AUTHORING RULE:** ST expectations come from the contracts and the RD, never from imagined
> implementation output. Exact `__frame_*` *addresses* in ST-5/ST-6 are captured by the golden at
> mint time (deterministic SFA layout), not hand-predicted here — the spec assertion is the *presence*
> and *shape* of the symbols, the golden pins the bytes.

> **⚠️ RED vs. GREEN-GUARD (PF-003).** Not every spec test is expected to fail in the red phase.
> **Expected-red** (fail before implementation — the seam returns `[]` / the model is unpopulated):
> ST-1, ST-1c, ST-2, ST-3, ST-5, ST-6. **Green-guard invariants** (already pass today and MUST stay
> green — they codify preserved passthrough behavior, not new behavior): ST-1b (empty model → `[]`,
> re-asserts AC-22), ST-4 (function-free program → passthrough), ST-4b (body-less fn → no locals).
> Task 1.1.3's red verification asserts only the expected-red set fails; the green-guards are checked
> to *remain* green, never forced to fail (that would corrupt the immutable oracle).

## Test Categories

### Specification Tests (written BEFORE implementation)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/frontend/src/sfa/model-adapter.spec.test.ts` | ST-1, ST-1b, ST-1c | Adapter |
| `packages/frontend/src/semantics/function-collection.spec.test.ts` | ST-2, ST-4b | Population |
| `packages/frontend/src/semantics/analyze.spec.test.ts` (extend) | ST-3, ST-4 | `analyze()` wiring |
| `packages/test-harness/src/golden-slice3a.spec.test.ts` | ST-6 | Golden (CI) |
| `packages/test-harness/src/slice3a.spec.test.ts` | ST-5, ST-7 | Assemble + VICE |

### Implementation Tests (written AFTER implementation)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/frontend/src/semantics/function-collection.impl.test.ts` | body-less fn, two-local order, function-free program, interrupt decl | High |
| `packages/frontend/src/sfa/model-adapter.impl.test.ts` | interrupt→`isInterrupt`, no-locals fn still emitted, `scopeOf` miss → no locals | High |
| existing `analyze.spec.test.ts` / `passes.impl.test.ts` (update) | reconcile passthrough assertions with intentional population (AR-9) | High |

### Integration / E2E Tests

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| Model→SFA→ACME→PRG (assemble-clean) | build fixture → PRG | loadable PRG, `__frame_*` present, zero undefined symbols (ST-5) |
| Golden regression (CI) | emitAsm → assertGolden | byte-exact (ST-6) |
| VICE runtime (local) | build → setupEmulator → runUntilMemory/assertMemory | `$D020 == 0xF5` (ST-7) |
| Gate non-regression | re-mint gate golden → VICE | gate still green (ST-8) |

## Test Data

### Fixtures Needed
- `examples/slice3a/main.blend` — the local-byte fixture (also `examples/` living doc, SR-1).
- Populated-model builder in the adapter spec test — construct a `SemanticModel` with `main` + local
  `x` directly (fixture-style), independent of `analyze()`, so the adapter is tested in isolation.
- `test/golden/slice3a.asm.golden` — minted via `UPDATE_GOLDEN=1`.

### Mock Requirements
- None beyond the existing RD-12 fake driver (CI) vs real VICE (local). Prefer real objects: the SFA
  planner, lowering, ACME, and build pipeline are exercised for real; only VICE is gated by `skipIf`.

## Verification Checklist
- [ ] All ST-* defined with concrete input/output pairs
- [ ] Every ST traces to a requirement / contract / AR entry
- [ ] Spec tests written BEFORE implementation
- [ ] Spec tests verified to FAIL before implementation (red phase)
- [ ] All spec tests pass after implementation (green phase)
- [ ] Impl tests written for edge cases and internals
- [ ] Existing passthrough tests reconciled (AR-9); AC-22 empty-model test still green
- [ ] All unit / integration / VICE (local) tests pass; golden tier green in CI
- [ ] No regressions in existing tests (incl. `gate.spec.test.ts` after re-mint)
- [ ] R15 boundary tier green; coverage meets goals

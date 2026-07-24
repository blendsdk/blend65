# Execution Plan: RD-02 Typed Generative Cases and Deterministic Replay

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-24 15:55
> **Progress**: 0/64 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-02 as seven dependency-ordered phases. Each phase follows specification tests → red
proof → implementation → green proof → implementation tests → full verification. Binding remains
unpublished until the final phase.

**🚨 Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Closed contracts and exhaustive rule-model skeleton | 10 |
| 2 | Independent IR, neighbors and structural budgets | 9 |
| 3 | Canonical identity and path-local deterministic choices | 9 |
| 4 | Deterministic renderer and independent round trip | 9 |
| 5 | Generators, boundary transform and modeled semantic slice | 9 |
| 6 | Campaign composition and exact replay | 8 |
| 7 | Atomic binding publication and closeout | 10 |

**Total: 64 tasks across 7 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> 1. Mark implemented tasks `[~]` with an implementation timestamp.
> 2. Promote only verified tasks to `[x]` with a completion timestamp.
> 3. Update Progress and Last Updated after every task; only `[x]` counts.
> 4. Resume the first `[~]`, otherwise the first `[ ]`, scanning top-to-bottom.

## Phase 1: Closed Contracts and Rule-Model Skeleton

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: api-surface, security

**Reference**: 03-01 · AR-P2, AR-P9, AR-P12 · ST-01–ST-07

- [ ] 1.1.1 [spec-author] Write rule-model and binding specification tests — `packages/readiness/src/rule-model-registry.spec.test.ts`, `handler-bindings.spec.test.ts`
- [ ] 1.1.2 Run Phase 1 spec tests and record expected RED for ST-01–ST-07
- [ ] 1.2.1 Add closed model/binding types, diagnostics and limits — `model-registry-model.ts`, `binding-model.ts`
- [ ] 1.2.2 Add bounded closed JSON model schema/parser — `readiness/schema/rule-models-v1.schema.json`, `rule-model-input.ts`
- [ ] 1.2.3 Add exhaustive manifest skeleton for all inventory rules — `readiness/rule-models/rule-models-v1.json`
- [ ] 1.2.4 Add executable-operation registry and model semantic validator — `rule-model-registry.ts`, `rule-model-validator.ts`
- [ ] 1.2.5 Add candidate and published-state binding validators — `binding-validator.ts`
- [ ] 1.2.6 Export stable public contracts and prove production import boundary — `index.ts`, `dependency-boundary.impl.test.ts`
- [ ] 1.2.7 Run ST-01–ST-07 GREEN; fix implementation only
- [ ] 1.3.1 Add schema/validator/error-path implementation tests and full verify

**Deliverable:** exhaustive non-vacuous model-state and binding foundation; no bound handlers.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 2: Independent IR, Neighbors and Structural Budgets

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: api-surface, security, perf

**Reference**: 03-02 · AR-P3, AR-P8, AR-P11 · ST-08–ST-14

- [ ] 2.1.1 [spec-author] Write IR, neighbor and budget specification tests — `generator-ir.spec.test.ts`, `generation-budget.spec.test.ts`
- [ ] 2.1.2 Run Phase 2 spec tests and record expected RED for ST-08–ST-14
- [ ] 2.2.1 Implement branded identifiers, scalar types and immutable IR unions — `generator-ir.ts`
- [ ] 2.2.2 Implement IR structural validation and model predicates — `generator-ir-validator.ts`
- [ ] 2.2.3 Implement incremental/final budget accounting with checked arithmetic — `generation-budget.ts`
- [ ] 2.2.4 Implement single-violation neighbor application and revalidation — `invalid-neighbor.ts`
- [ ] 2.2.5 Implement boundary variant core independent of rule population — `boundary-variants.ts`
- [ ] 2.2.6 Run ST-08–ST-14 GREEN; fix implementation only
- [ ] 2.3.1 Add IR/budget/neighbor implementation tests, coverage and full verify

**Deliverable:** compiler-independent typed construction kernel with enforced bounds.

**Verify:** project full verify command above.

## Phase 3: Canonical Identity and Deterministic Choices

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: security, perf, api-surface

**Reference**: 03-03 · AR-P4–AR-P6, AR-P12 · ST-15–ST-22 excluding fresh-process ST-17

- [ ] 3.1.1 [spec-author] Write identity/counter/input specification tests — `case-identity.spec.test.ts`, replay input cases in `replay.spec.test.ts`
- [ ] 3.1.2 Run Phase 3 spec tests and record expected RED
- [ ] 3.2.1 Implement canonical length-prefixed encoding and closed identity inputs — `canonical-identity.ts`
- [ ] 3.2.2 Implement SHA-256 counter draws and unbiased bounded integers — `deterministic-choice.ts`
- [ ] 3.2.3 Implement configuration, campaign and case digest derivation/collision checks — `case-identity.ts`
- [ ] 3.2.4 Implement bounded replay envelope parser and exact revision resolver contracts — `replay-input.ts`, `revision-registry.ts`
- [ ] 3.2.5 Run Phase 3 ST cases GREEN; fix implementation only
- [ ] 3.3.1 Add canonicalization/vector/collision/path-stability implementation tests
- [ ] 3.3.2 Run coverage, Prettier and full verify

**Deliverable:** stable random-access choice and identity substrate; no generator yet.

**Verify:** project full verify command above.

## Phase 4: Deterministic Renderer and Independent Round Trip

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: correctness, api-surface

**Reference**: 03-04 · AR-P7, AR-P11 · ST-23–ST-27

- [ ] 4.1.1 [spec-author] Write renderer/round-trip specification tests — `renderer-roundtrip.spec.test.ts`
- [ ] 4.1.2 Run Phase 4 spec tests and record expected RED
- [ ] 4.2.1 Implement deterministic module/declaration/statement renderer — `source-renderer.ts`
- [ ] 4.2.2 Implement renderer-owned expression precedence/parentheses — `expression-renderer.ts`
- [ ] 4.2.3 Implement independent bounded tokenizer — `roundtrip-tokenizer.ts`
- [ ] 4.2.4 Implement independent Pratt projection parser/normalizer — `roundtrip-parser.ts`, `roundtrip-model.ts`
- [ ] 4.2.5 Implement projection equality and bounded mismatch diagnostics — `roundtrip-validator.ts`
- [ ] 4.2.6 Run ST-23–ST-27 GREEN; fix implementation only
- [ ] 4.3.1 Add mutation/error-path implementation tests, coverage and full verify

**Deliverable:** source bytes independently checked for structural fidelity.

**Verify:** project full verify command above.

## Phase 5: Generators, Boundary Transform and Modeled Semantic Slice

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: compiler-semantics, api-surface, perf

**Reference**: 03-01, 03-02 · AR-P1, AR-P2, AR-P8 · ST-03–ST-05, ST-09–ST-14

- [ ] 5.1.1 [spec-author] Extend model/generator specification tests with the exact scalar-memory subset and spelling matrix
- [ ] 5.1.2 Run Phase 5 spec tests and record expected RED
- [ ] 5.2.1 Author independently reviewed modeled manifest records/citations — `readiness/rule-models/rule-models-v1.json`
- [ ] 5.2.2 Implement scalar/module/function constructors and predicates — `scalar-rule-models.ts`
- [ ] 5.2.3 Implement memory-intrinsic constructors, predicates and neighbors — `memory-rule-models.ts`
- [ ] 5.2.4 Implement frontend/compiler/runtime generator entrypoints — `generators.ts`
- [ ] 5.2.5 Bind executable boundary-transform implementation in candidate registry — `bindings.ts`
- [ ] 5.2.6 Run Phase 5 ST matrix GREEN, including ordinary local/parameter memory operands
- [ ] 5.3.1 Add distribution/deduplication/model-invariant implementation tests, review and full verify

**Deliverable:** first meaningful modeled generator slice; bindings remain candidate-only.

**Verify:** project full verify command above.

## Phase 6: Campaign Composition and Exact Replay

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: security, perf, concurrency

**Reference**: 03-02, 03-03, 03-04 · AR-P4–AR-P8, AR-P11–AR-P12 · ST-15–ST-27

- [ ] 6.1.1 [spec-author] Write end-to-end campaign/fresh-process replay specification cases including ST-17
- [ ] 6.1.2 Run Phase 6 spec tests and record expected RED
- [ ] 6.2.1 Implement campaign planner and deterministic generation paths — `campaign.ts`
- [ ] 6.2.2 Implement valid/invalid case composition and stable metadata — `case-generator.ts`
- [ ] 6.2.3 Implement exact replay orchestration and fresh-process fixture — `replay.ts`, `test-fixtures/replay-child.ts`
- [ ] 6.2.4 Integrate render/round-trip/budget finalization in one case pipeline — `generate-case.ts`
- [ ] 6.2.5 Run all campaign/replay ST cases GREEN; fix implementation only
- [ ] 6.3.1 Add scale/determinism/error implementation tests, coverage and full verify

**Deliverable:** reproducible case generation and replay, still unpublished.

**Verify:** project full verify command above.

## Phase 7: Atomic Binding Publication and Closeout

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Lenses**: concurrency, security, api-surface

**Reference**: 03-05 · AR-P9, AR-P10, AR-P12–AR-P14 · ST-28–ST-33

- [ ] 7.1.1 [spec-author] Write publication, crash and resolver-boundary specification tests — `binding-publication.spec.test.ts`
- [ ] 7.1.2 Run Phase 7 spec tests and record expected RED
- [ ] 7.2.1 Implement release manifest/schema and digest-verified resolver — `publication-model.ts`, `publication-resolver.ts`
- [ ] 7.2.2 Implement staged release builder under generation lock — `binding-publication.ts`
- [ ] 7.2.3 Implement atomic pointer commit and crash recovery — `publication-pointer.ts`
- [ ] 7.2.4 Route published readiness loads through resolver and add direct-read boundary gate — `authority-loader.ts`, `dependency-boundary.impl.test.ts`
- [ ] 7.2.5 Stage four RD-02 declaration bindings, refresh review evidence/projections, validate release
- [ ] 7.2.6 Atomically publish final snapshot; run ST-28–ST-33 GREEN
- [ ] 7.3.1 Add concurrency/symlink/crash/digest implementation tests and full readiness coverage
- [ ] 7.3.2 Run generate/check/full verify, deferral-expiry review, traceability/roadmap/docs closeout

**Deliverable:** four RD-02 handlers bound and visible only as a complete validated publication.

**Verify:** project full verify command above.

## Dependencies

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
```

## Success Criteria

1. All 64 tasks verified and the full command passes.
2. All ST-01–ST-33 expectations pass without modification.
3. No `@blend65/*` production dependency enters the independent generation surface.
4. `spec/` remains untouched.
5. Readiness package branch coverage remains at least 90%.
6. Three generators and `transform.boundary-variants` are atomically bound; later-RD handlers stay unbound.
7. Deferral-expiry and architecture documentation checks are recorded.

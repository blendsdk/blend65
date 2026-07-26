# Execution Plan: RD-02 Typed Generative Cases and Deterministic Replay

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-26 15:16 UTC
> **Progress**: 71/71 tasks (100%)
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
| 3 | Canonical identity and path-local deterministic choices | 10 |
| 4 | Deterministic renderer and independent round trip | 10 |
| 5 | Generators, boundary transform and modeled semantic slice | 10 |
| 6 | Campaign composition and exact replay | 8 |
| 7 | Atomic binding publication and closeout | 14 |

**Total: 71 tasks across 7 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> 1. Mark implemented tasks `[~]` with an implementation timestamp.
> 2. Promote only verified tasks to `[x]` with a completion timestamp.
> 3. Update Progress and Last Updated after every task; only `[x]` counts.
> 4. Resume the first `[~]`, otherwise the first `[ ]`, scanning top-to-bottom.

## Phase 1: Closed Contracts and Rule-Model Skeleton

> **Phase baseline tree**: `b3ebf3ef92468f0d8762dcc0c7e03d8b5a767752`
> **Lenses**: api-surface, security

**Reference**: 03-01 · AR-P2, AR-P9, AR-P12 · ST-01–ST-03, ST-06–ST-07

- [x] 1.1.1 [spec-author] Write skeleton and binding specification tests — `packages/readiness/src/rule-model-registry.spec.test.ts`, `handler-bindings.spec.test.ts` — completed 2026-07-24 15:05 UTC
- [x] 1.1.2 Run Phase 1 spec tests and record expected RED for ST-01–ST-03, ST-06–ST-07 — completed 2026-07-24 15:06 UTC; both suites failed collection because production modules do not yet exist
- [x] 1.2.1 Add closed model/binding types, diagnostics and limits — `model-registry-model.ts`, `binding-model.ts` — completed 2026-07-24 15:08 UTC
- [x] 1.2.2 Add bounded closed JSON model schema/parser — `readiness/schema/rule-models-v1.schema.json`, `rule-model-input.ts` — completed 2026-07-24 15:11 UTC
- [x] 1.2.3 Add exhaustive manifest skeleton for all inventory rules — `readiness/rule-models/rule-models-v1.json` — completed 2026-07-24 15:11 UTC
- [x] 1.2.4 Add executable-operation registry and model semantic validator — `rule-model-registry.ts`, `rule-model-validator.ts` — completed 2026-07-24 15:14 UTC
- [x] 1.2.5 Add candidate and published-state binding validators — `binding-validator.ts` — completed 2026-07-24 15:15 UTC
- [x] 1.2.6 Export stable public contracts and prove production import boundary — `index.ts`, `dependency-boundary.impl.test.ts` — completed 2026-07-24 15:16 UTC
- [x] 1.2.7 Run ST-01–ST-03 and ST-06–ST-07 GREEN; fix implementation only — completed 2026-07-24 15:29 UTC; 38/38 specification assertions pass
- [x] 1.3.1 Add schema/validator/error-path implementation tests and full verify — completed 2026-07-24 16:13 UTC; 473 readiness tests and full repository verify pass; 95.67% readiness branch coverage; quality review resolved

**Deliverable:** exhaustive non-vacuous model-state and binding foundation; no bound handlers.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 2: Independent IR, Neighbors and Structural Budgets

> **Phase baseline tree**: `b44624f2b1fb22803cc85221fdadb587e6345d51`
> **Lenses**: api-surface, security, perf

**Reference**: 03-02 · AR-P3, AR-P8, AR-P11 · ST-08–ST-14

- [x] 2.1.1 [spec-author] Write IR, neighbor and budget specification tests — `generator-ir.spec.test.ts`, `generation-budget.spec.test.ts` — completed 2026-07-24 16:26 UTC
- [x] 2.1.2 Run Phase 2 spec tests and record expected RED for ST-08–ST-14 — completed 2026-07-24 16:27 UTC; both suites failed collection because Phase 2 modules do not yet exist
- [x] 2.2.1 Implement branded identifiers, scalar types and immutable IR unions — `generator-ir.ts` — completed 2026-07-24 16:52 UTC
- [x] 2.2.2 Implement IR structural validation and model predicates — `generator-ir-validator.ts` — completed 2026-07-24 16:52 UTC
- [x] 2.2.3 Implement incremental/final budget accounting with checked arithmetic — `generation-budget.ts` — completed 2026-07-24 16:52 UTC
- [x] 2.2.4 Implement single-violation neighbor application and revalidation — `invalid-neighbor.ts` — completed 2026-07-24 16:52 UTC
- [x] 2.2.5 Implement boundary variant core independent of rule population — `boundary-variants.ts` — completed 2026-07-24 16:52 UTC
- [x] 2.2.6 Run ST-08–ST-14 GREEN; fix implementation only — completed 2026-07-24 16:52 UTC; 28/28 immutable specification assertions pass
- [x] 2.3.1 Add IR/budget/neighbor implementation tests, coverage and full verify — completed 2026-07-24 17:15 UTC; review remediations cover operator semantics, writable bindings, terminal returns and bounded validation; 651 readiness tests pass with 95.45% branch coverage; exact full verify exits 0

**Deliverable:** compiler-independent typed construction kernel with enforced bounds.

**Verify:** project full verify command above.

## Phase 3: Canonical Identity and Deterministic Choices

> **Phase baseline tree**: `ad54627c8704da5cd7c092f80f94fd1854816f36`
> **Lenses**: security, perf, api-surface

**Reference**: 03-03 · AR-P4–AR-P6, AR-P12 · ST-15–ST-22 excluding fresh-process ST-17, plus ST-34

- [x] 3.1.1 [spec-author] Write identity/counter/input specification tests — `case-identity.spec.test.ts`, replay input cases in `replay.spec.test.ts` — completed 2026-07-24 17:27 UTC
- [x] 3.1.2 Run Phase 3 spec tests and record expected RED — completed 2026-07-24 17:28 UTC; both suites failed collection because Phase 3 modules do not yet exist
- [x] 3.2.1 Implement canonical length-prefixed encoding and closed identity inputs — `canonical-identity.ts` — completed 2026-07-24 17:48 UTC; readiness typecheck and immutable Phase 3 specifications pass
- [x] 3.2.2 Implement SHA-256 counter draws and unbiased bounded integers — `deterministic-choice.ts` — completed 2026-07-24 17:48 UTC; published counter and bounded vectors pass
- [x] 3.2.3 Implement configuration, campaign and case digest derivation/collision checks — `case-identity.ts` — completed 2026-07-24 17:48 UTC; field mutation, path stability and collision specifications pass
- [x] 3.2.4 Implement bounded replay envelope parser and exact revision resolver contracts — `replay-input.ts`, `revision-registry.ts` — completed 2026-07-24 17:48 UTC; closed input and exact no-fallback specifications pass
- [x] 3.2.5 Implement canonical handler dependency digests and freshness gate — `implementation-revision.ts`, generated revision metadata — completed 2026-07-24 17:48 UTC; stale dependency bytes reject; generated metadata is not yet warranted because Phase 5 owns the first production handlers
- [x] 3.2.6 Run Phase 3 ST cases including ST-34 GREEN; fix implementation only — completed 2026-07-24 17:48 UTC; 19/19 immutable Phase 3 specification assertions pass
- [x] 3.3.1 Add canonicalization/vector/collision/path-stability implementation tests — completed 2026-07-24 21:15 UTC; 130/130 focused implementation assertions pass across canonicalization, deterministic choice, reusable context validation/encoding, identity, replay, revision resolution, freshness, lifecycle bounds and allocation-sensitive pre-copy paths
- [x] 3.3.2 Run coverage, Prettier and full verify — completed 2026-07-24 21:25 UTC; all Phase 3 review findings remediated, including complete exported result/helper documentation, unconditional intrinsic byte-length checks before registry lookup or copies, extracted collision lifecycle and reusable pre-encoded choice contexts; 800/800 readiness tests and 95.01% branch coverage; touched TypeScript is Prettier-clean; exact full verify exits zero

**Deliverable:** stable random-access choice and identity substrate; no generator yet.

**Verify:** project full verify command above.

## Phase 4: Deterministic Renderer and Independent Round Trip

> **Phase baseline tree**: `9d6650f3157e99fdeaa6d5f6e24d36bebb378d42`
> **Lenses**: correctness, api-surface

**Reference**: 03-04 · AR-P7, AR-P11 · ST-23–ST-27, ST-36

- [x] 4.1.1 [spec-author] Write renderer/round-trip specification tests — `renderer-roundtrip.spec.test.ts` ✅ (completed: 2026-07-24 22:01 UTC)
- [x] 4.1.2 Run Phase 4 spec tests and record expected RED ✅ (completed: 2026-07-24 22:01 UTC; suite failed collection because `roundtrip-conformance-v1.js` does not yet exist)
- [x] 4.2.1 Implement deterministic module/declaration/statement renderer — `source-renderer.ts`
- [x] 4.2.2 Implement renderer-owned expression precedence/parentheses — `expression-renderer.ts`
- [x] 4.2.3 Implement independent bounded tokenizer — `roundtrip-tokenizer.ts`
- [x] 4.2.4 Implement independent Pratt projection parser/normalizer — `roundtrip-parser.ts`, `roundtrip-model.ts`
- [x] 4.2.5 Implement projection equality and bounded mismatch diagnostics — `roundtrip-validator.ts`
- [x] 4.2.6 Add inverse module-graph gate and frozen spec-derived vectors — `roundtrip-boundary.impl.test.ts`
- [x] 4.2.7 Run ST-23–ST-27 and ST-36 GREEN; fix implementation only
- [x] 4.3.1 Add mutation/error-path implementation tests, coverage and full verify ✅ (completed: 2026-07-24 23:18 UTC; second authorized remediation resolved all five retained composition/inverse findings; exact full gate passed with 849 readiness tests and 95.05% branch coverage)

**Deliverable:** source bytes independently checked for structural fidelity.

**Verify:** project full verify command above.

## Phase 5: Generators, Boundary Transform and Modeled Semantic Slice

> **Phase baseline tree**: `8e347e96225724581e86e4b9948c7b723a0e2fc6`
> **Lenses**: compiler-semantics, api-surface, perf

**Reference**: 03-01, 03-02 · AR-P1, AR-P2, AR-P8, AR-P26–AR-P29 · ST-03–ST-05, ST-09–ST-14

- [x] 5.1.1 [spec-author] Extend model/generator specification tests with the exact scalar-memory subset and spelling matrix ✅ (completed: 2026-07-25 02:02 UTC; immutable 10-case oracle authored in `modeled-generators.spec.test.ts`)
- [x] 5.1.2 Run Phase 5 spec tests and record expected RED ✅ (completed: 2026-07-25 02:02 UTC; 1 suite and all 10 authored tests failed because the reviewed suite and handler APIs do not yet exist)
- [x] 5.2.1 Author exact nine-rule seed contract and modeled manifest facts/citations — `readiness/rule-models/rule-models-v1.json`, `readiness/rule-models/rule-model-seed-v1.json` ✅ (completed: 2026-07-25 02:09 UTC; exact 9/2,103/0 population and seed/model identity check pass; JSON is Prettier-clean)
- [x] 5.2.2 [semantics-reviewer] Independently review seed/manifest semantics and record digest-bound evidence — `readiness/reviews/rule-models-v1-review.json` ✅ (completed: 2026-07-25 02:14 UTC; accepted no-findings review is bound to seed, manifest and citation digests)
- [x] 5.2.3 Implement scalar/module/function constructors and predicates — `modeled-case-builder.ts`, `modeled-generator-facts.ts` ✅ (completed: 2026-07-25 02:18 UTC; all 40 scalar boundary/spelling choices construct as valid independent IR)
- [x] 5.2.4 Implement memory-intrinsic constructors, predicates and neighbors — `modeled-case-builder.ts`, `modeled-generators.ts` ✅ (completed: 2026-07-25 02:18 UTC; all 80 direct/computed ordinary-variable choices and every reviewed wrong-arity/type delta pass)
- [x] 5.2.5 Implement frontend/compiler/runtime generator entrypoints — `modeled-generator-suite.ts`, `modeled-generators.ts` ✅ (completed: 2026-07-25 02:18 UTC; authority-gated stateless routing passes with compiler composition deliberately empty)
- [x] 5.2.6 Bind executable boundary-transform implementation in candidate registry — `modeled-candidate-bindings.ts`, `modeled-generators.ts`, `index.ts` ✅ (completed: 2026-07-25 02:39 UTC; all four revisions are derived from injected dependency closures, freshness-gated through authoritative candidate registration and remain unavailable to published lookup)
- [x] 5.2.7 Run Phase 5 ST matrix GREEN, including exact ST-04 equality and ordinary local/parameter memory operands ✅ (completed: 2026-07-25 02:18 UTC; 10/10 immutable specification tests pass)
- [x] 5.3.1 Add distribution/deduplication/model-invariant implementation tests, review and full verify ✅ (completed: 2026-07-25 02:56 UTC; three authorized review passes leave no critical/major findings, two minor semantic documentation drifts are closed, PE-003 is explicitly owned by Phase 6, and the exact full gate passes with 869 readiness tests)

**Deliverable:** first meaningful modeled generator slice; bindings remain candidate-only.

**Verify:** project full verify command above.

## Phase 6: Campaign Composition and Exact Replay

> **Phase baseline tree**: `1f3ca90ce60dd395681c92211ec965302bfc5caf`
> **Lenses**: security, perf, concurrency

**Reference**: 03-02, 03-03, 03-04 · AR-P4–AR-P8, AR-P11–AR-P12, AR-P30–AR-P35 · ST-15–ST-27, ST-35, ST-41–ST-42

- [x] 6.1.1 [spec-author] Write end-to-end campaign/fresh-process replay specification cases including ST-17 ✅ (completed: 2026-07-25 03:30 UTC; implementation-blind author produced 16 immutable campaign/replay cases plus the checked-in child fixture after AR-P30 closed the orchestration contract)
- [x] 6.1.2 Run Phase 6 spec tests and record expected RED ✅ (completed: 2026-07-25 03:30 UTC; 1 suite and all 16 cases fail solely because the seven Phase 6 orchestration exports do not yet exist; readiness typecheck, exact-file lint, Prettier and diff checks pass)
- [x] 6.2.1 Implement campaign planner and deterministic generation paths — `campaign.ts` ✅ (completed: 2026-07-25 05:16 UTC; cursor-free ordinal planning uses fixed lanes, one prepared choice context, exact mandatory coverage and a single-use 100,000-witness collision proof)
- [x] 6.2.2 Implement valid/invalid case composition and stable metadata — `case-generator.ts` ✅ (completed: 2026-07-25 05:16 UTC; valid, parameter-binding and structural-invalid cases carry independently parsed projections and reject no-op, out-of-range or unrelated transform drift)
- [x] 6.2.3 Implement exact replay orchestration and fresh-process fixture — `replay.ts`, `test-fixtures/replay-child.ts` ✅ (completed: 2026-07-25 05:16 UTC; bounded six-revision replay enforces freshness, suite protocol/content authority and exact target identity with no ambient fallback; ordinary replay is target-only while explicit conformance indexes retain full proof)
- [x] 6.2.4 Integrate render/round-trip/budget finalization in one case pipeline — `generate-case.ts`; use prepared or batched construction accounting so campaign-scale generation does not repeat full IR and budget snapshots per case (Phase 5 PE-003) ✅ (completed: 2026-07-25 05:16 UTC; finite reviewed construction templates cache validated IR usage behind the suite capability, branded cases take the prepared path, arbitrary outputs retain full validation, and final usage is published once)
- [x] 6.2.5 Run all campaign/replay ST cases GREEN; fix implementation only ✅ (completed: 2026-07-25 05:16 UTC; immutable oracle hashes remain exact and all 16 campaign/replay cases pass, including two fresh processes)
- [x] 6.3.1 Add scale/determinism/error implementation tests, coverage and full verify ✅ (completed: 2026-07-25 05:16 UTC; correctness, semantics, security and performance review findings remediated or independently adjudicated; exact full gate passes with 63 readiness files / 908 tests and 8 root files / 33 tests)

**Deliverable:** reproducible case generation and replay, still unpublished.

**Verify:** project full verify command above.

## Phase 7: Atomic Binding Publication and Closeout

> **Phase baseline tree**: `f08e7975855767fd7f7246873a80427bb6f056e8`
> **Remediation baseline tree**: `7de5559b753e89927aef989ba4692232a8b46a6a`
> **Lenses**: concurrency, security, api-surface

**Reference**: 03-05 · AR-P9, AR-P10, AR-P12–AR-P14, AR-P36 · ST-28–ST-33, ST-37–ST-40

- [x] 7.1.1 [spec-author] Write publication, durability, collision, CLI and resolver-capability specification tests — `binding-publication.spec.test.ts` ✅ (completed: 2026-07-25 05:40 UTC; 12 implementation-blind cases plus a bounded fresh-process crash fixture cover release selection, exact bindings, collision/reuse, limits, review/staged-validation failure, durability, path/digest validation, all nine crash points, CLI authority separation and the direct-read boundary; user-authorized mechanical oracle corrections on 2026-07-25 pass the existing freshness capability directly, execute built Node entrypoints, and scope synthetic collision resolution under the same injected digest; user-authorized AR-P37 correction on 2026-07-26 removes synthetic callable candidates and exercises the real package-owned version-one catalog; user-authorized AR-P38 correction distinguishes runtime staged invariant validation from the workflow ST gate; replacement immutable hashes `30837fc1c9cb9fba70190d82889fdc9851c89e483887f0be0cacd00059d5164e` and `3f1110d0590a51638078d697dee353bfa162d556f9c762bccc5a241cc88fd721`)
- [x] 7.1.2 Run Phase 7 spec tests and record expected RED ✅ (completed: 2026-07-25 05:40 UTC; exact-file lint, typecheck and Prettier pass; the focused suite is 12/12 RED solely on the absent Phase 7 publication exports/conformance module and the not-yet-migrated four-command CLI protocol)
- [x] 7.2.1 Implement release manifest/schema and digest-verified resolver — `publication-model.ts`, `publication-resolver.ts` ✅ (completed: 2026-07-25 19:35 UTC; bounded resolver verifies exact manifest/member digests, rejects pointer symlinks as path violations and returns only opaque snapshot capabilities)
- [x] 7.2.2 Implement staged release builder under generation lock — `binding-publication.ts` ✅ (completed: 2026-07-25 19:35 UTC; independent review input, inert staging and package-owned acceptance pass the immutable publication gate)
- [x] 7.2.3 Implement atomic pointer commit and crash recovery — `publication-pointer.ts` ✅ (completed: 2026-07-25 19:35 UTC; all nine fresh-process hard-crash boundaries pass with directory and file synchronization enforced)
- [x] 7.2.4 Migrate generate/check and add guarded publish API/CLI/root script/documentation — `cli.ts`, CLI tests, `package.json`, `readiness/README.md` ✅ (completed: 2026-07-25 19:35 UTC; source-check/check authority separation and the exact built four-command CLI protocol pass)
- [x] 7.2.5 Route claims through opaque `PublishedSnapshot` and add direct-read boundary gate — `authority-loader.ts`, `dependency-boundary.impl.test.ts` ✅ (completed: 2026-07-25 19:35 UTC; shared complete authority validation avoids duplicate semantic passes, capability reads remain WeakMap-gated, and the publication boundary passes)
- [x] 7.2.6 Stage four RD-02 declaration bindings and compute semantic digests; do not select the pointer ✅ (completed: 2026-07-25 19:35 UTC; read-only preparation produced the exact four lexical handlers, 21 review units and semantic digest `sha256:dbfa2d26bc392a00b88cf13d46d0d9511f36d6e1437c40112b53d9d1acdbb304` without creating the real pointer)
- [x] 7.2.7 [semantics-reviewer] Independently review staged semantic changes and record accepted digest-bound evidence ✅ (completed: 2026-07-26 11:57 UTC; accepted no-findings review by `codex-semantics-reviewer-rd02-p7-option-c-b` covers all 21 exact review units at semantic digest `sha256:dbfa2d26bc392a00b88cf13d46d0d9511f36d6e1437c40112b53d9d1acdbb304`; canonical evidence is recorded in `readiness/reviews/semantic-review-v1.json`)
- [x] 7.2.8 Refresh projections and published-state-validate the complete staged release ✅ (completed: 2026-07-26 12:10 UTC; loose projections regenerate byte-identically and pass source-check; the complete release built from the recorded independent review published and resolved in an isolated repository at digest `sha256:41afbb4512456470e0b182fb14edb5caeaac7688d7e36ba1e102fc8d42ae3403` while the real pointer remained absent)
- [x] 7.2.9 Run ST-01–ST-40 GREEN on the exact unchanged phase tree immediately before real publication ✅ (completed: 2026-07-26 12:57 UTC; recovery repaired stale traceability revisions and the exact execution gate passes; 66 immutable specification files and 942 tests pass)
- [x] 7.2.10 Add concurrency/symlink/crash/digest implementation tests and full readiness coverage against staging ✅ (completed: 2026-07-26 13:13 UTC; hardening suites cover concurrent publication, filesystem substitution, wire bounds, digest corruption, fault boundaries and capability/module guards; 66 files / 942 tests pass with 90.00% branch coverage)
- [x] 7.2.11 Publish the independently reviewed authority from that unchanged green tree; recompute and runtime-validate the exact staged digest before pointer commit, then verify the selected snapshot ✅ (completed: 2026-07-26 13:15 UTC; guarded transaction selected the independently reviewed staged digest `sha256:41afbb4512456470e0b182fb14edb5caeaac7688d7e36ba1e102fc8d42ae3403`, and publication-only check resolves it cleanly)
- [x] 7.3.1 Run source-check/generate/check/full verify, deferral-expiry review, traceability/roadmap/docs closeout ✅ (completed: 2026-07-26 15:16 UTC; the authorized immutable specification baseline is unchanged, RV-002–RV-006 are independently accepted as resolved, RV-007 documentation drift is corrected, source and selected-publication checks pass, and the exact repository gate is green with 66 readiness files / 952 tests and 90.01% branch coverage)

**Deliverable:** four RD-02 handlers bound and visible only as a complete validated publication.

**Verify:** project full verify command above.

## Dependencies

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
```

## Success Criteria

1. All 71 tasks verified and the full command passes.
2. All ST-01–ST-40 expectations pass without modification.
3. No `@blend65/*` production dependency enters the independent generation surface.
4. `spec/` remains untouched.
5. Readiness package branch coverage remains at least 90%.
6. Three generators and `transform.boundary-variants` are atomically bound; later-RD handlers stay unbound.
7. Deferral-expiry and architecture documentation checks are recorded.

# Preflight Report: RD-03 Independent Semantic, Diagnostic and Metamorphic Oracles

> **Status**: ✅ PREFLIGHT PASSED — all 13 findings resolved
> **Iteration**: 2 (bounded full re-scan after authorized corrections)
> **Artifact**: Single requirement at `RD-03-independent-oracles.md`
> **Artifact Revision**: `sha256:c50f2c995116070fd701a95871baf35bba4e26c3738c9705b37b916d7bd473ef`
> **Codebase Grounded**: 26 source/test/config/artifact files examined
> **Mode**: Auto-design
> **Last Updated**: 2026-07-27

## Audit Scope

- **Audit target**: `RD-03-independent-oracles.md`
- **Context only**: the compiler-readiness ambiguity register, RD-01/RD-02 requirements and
  plans, traceability graph, authoritative inventory/publication data, frozen specification,
  `packages/readiness`, and repository conventions
- **Authorized modification set**: RD-03, its preflight report, dependency index/roadmap and
  traceability state. The user authorized the recommended correction set on 2026-07-27.

## Codebase Context Summary

**Tech stack:** strict TypeScript ESM on Node 22, Yarn workspaces, Vitest, ESLint, Turborepo.

**Architecture:** RD-01 supplies the versioned inventory, declarations, review evidence and
binding rules. RD-02 supplies a closed independent generator IR, nine reviewed modeled rules,
deterministic campaign/replay identity, freshness-gated candidates and atomic publication.
RD-03 is intended to add independent expected-result authority without importing compiler
implementation packages.

**Key files examined:** `generator-ir.ts`, `generator-ir-validator.ts`,
`generation-budget.ts`, `modeled-generator-facts.ts`, `modeled-generator-suite.ts`,
`binding-model.ts`, `binding-validator.ts`, `publication-candidates.ts`,
`publication-resolver.ts`, `case-identity.ts`, `replay.ts`, `generated/declarations.ts`,
the inventory/model/review JSON, RD-01/RD-02 design documents, and relevant frozen-spec sections.

**Key observations:**

- The current closed IR has scalar expressions, constants, parameters, locals, assignments,
  memory reads/writes and returns. It has no arrays, call expressions, branches or loops.
- Exactly nine rules are generator-modeled: five scalar-domain rules and four memory-signature
  rules. The remaining 2,103 rules are explicitly unmodeled.
- The inventory has four unbound RD-03 oracle declarations and no RD-03 semantic-transform
  declaration. The only transform is RD-02's published boundary transform.
- Inventory v1 has no structured expected diagnostic code/phase/projection contract.
- Generation/replay identity carries generator, boundary-transform and renderer revisions, not
  oracle or semantic-transform revisions.

**Reference verification:** all material references were mapped; the identified mismatches are
grounded below.

## Summary

| Dimension | Findings | Highest severity |
|---|---:|---|
| 1. Ambiguities | 2 | 🟠 Major |
| 2. Implicit assumptions | 3 | 🟠 Major |
| 3. Logical contradictions | 2 | 🟠 Major |
| 4. Completeness gaps | 4 | 🟠 Major |
| 5. Dependency issues | 1 | 🟠 Major |
| 6. Feasibility concerns | 4 | 🟠 Major |
| 7. Testability | 4 | 🟠 Major |
| 8. Security blind spots | 2 | 🟠 Major |
| 9. Edge cases | 2 | 🟠 Major |
| 10. Scope creep | 1 | 🟠 Major |
| 11. Ordering and sequencing | 1 | 🟠 Major |
| 12. Consistency | 0 | — |
| 13. Codebase alignment | 6 | 🟠 Major |

| Severity | Count | Status |
|---|---:|---|
| Critical | 0 | — |
| Major | 12 | All resolved and verified in Iteration 2 |
| Minor | 1 | Resolved and verified in Iteration 2 |
| Observation | 0 | — |

## Findings

### PF-001: The initial oracle subset conflicts with the mandatory IR surface 🟠 MAJOR

**Dimensions:** Ambiguity, Logical Contradiction, Scope Creep, Codebase Alignment<br>
**Location:** `RD-03-independent-oracles.md:24-31,44-47,67-73`<br>
**Codebase evidence:** `packages/readiness/src/generator-ir.ts:76-82,113-118,143-149`;
`packages/readiness/src/modeled-generator-facts.ts:40-163`

**Problem:** “Included rules” and “first subset” are unnamed. The current executable population is
nine scalar/memory rules, but the RD also mandates bounded loop unrolling and describes arrays,
calls, call frames and control flow that the closed IR cannot represent. Expanding all of those
here turns the bounded oracle into the second compiler that the RD explicitly excludes; omitting
them silently leaves mandatory requirements vacuous.

**Surviving options:**

| Option | Description | Trade-off |
|---|---|---|
| A | Pin RD-03 v1 to the nine modeled scalar/memory rules and current closed IR; move array/call/control-flow modeling and loop-unrolling to RD-08 as an explicit owned continuation | Honest, executable scope; requires approved back-propagation because it narrows current RD wording |
| B | Expand the closed IR, validation, renderer, round trip, budgets, generator models and evaluator here to implement arrays, calls, control flow and loops | Preserves literal current wording; duplicates RD-08 and approaches a second compiler |

**Recommendation — BEST:** Option A. It is the only bounded path consistent with the shipped
generator authority and the RD's own “not a second compiler” boundary. A loop relation that is
always inapplicable is rejected as vacuous.

**Authority:** User accepted the recommended Option A on 2026-07-27.<br>
**Confidence:** High.<br>
**Hardening:** blind challenger converged and required explicit RD-08 ownership.<br>
**Challenger:** converged.

### PF-002: No RD-03 semantic-transform declaration or publication route exists 🟠 MAJOR

**Dimensions:** Logical Contradiction, Dependency, Codebase Alignment<br>
**Location:** `RD-03-independent-oracles.md:22-23,29-31,76-77`<br>
**Codebase evidence:** `packages/readiness/src/generated/declarations.ts:1-3`;
`packages/readiness/src/modeled-candidate-bindings.ts:49-78,194-198`;
`packages/readiness/src/publication-candidates.ts:16-83`

**Problem:** Required semantic relations cannot bind to RD-01 authority. The only transform
declaration is the already-bound RD-02 boundary transform, and package-owned publication accepts
only the four RD-02 handlers.

**Selected resolution:** Add one versioned `transform.semantic-relations` declaration whose closed
contract enumerates relation IDs and relation-specific preconditions/results. Extend reviewed
freshness registration, package-owned publication candidates and selected-snapshot lookup.

**Authority:** AI — delegated by `--auto-design` (internal interface/publication mechanism).<br>
**Rejected:** six independent handlers add rollout granularity but unnecessary versioning and
publication surface for one cohesive relation engine.<br>
**Counterargument:** one implementation revision invalidates every relation together.<br>
**Confidence:** High. **Hardening:** challenger converged.

### PF-003: Diagnostic expectations have no structured authority 🟠 MAJOR

**Dimensions:** Implicit Assumption, Completeness, Codebase Alignment<br>
**Location:** `RD-03-independent-oracles.md:28,53-55`<br>
**Codebase evidence:** `packages/readiness/src/model.ts:189-224`;
`packages/readiness/src/model-registry-model.ts:51-56`

**Problem:** Inventory rules contain prose, polarity, domains and handler IDs but no exact expected
diagnostic code, phase or observable projection. RD-02 forbids parsing requirement prose to decide
executable behavior.

**Selected resolution:** Add a closed, independently reviewed RD-03 diagnostic manifest keyed by
modeled rule/invalid-neighbor identity. It owns exact stable code, phase and observable diagnostic
projection; completeness joins it to the modeled registry and its digest enters evaluation identity
and atomic publication.

**Authority:** AI — delegated by `--auto-design` (internal versioned data representation).<br>
**Rejected:** inventory schema v2 is unavailable until RD-07's evolution gate; prose extraction is
circular and unstable.<br>
**Counterargument:** a second rule-keyed authority needs strict completeness and freshness joins.<br>
**Confidence:** High. **Hardening:** challenger converged.

### PF-004: Metamorphic equivalence is undefined and not falsifiably tested 🟠 MAJOR

**Dimensions:** Ambiguity, Completeness, Testability<br>
**Location:** `RD-03-independent-oracles.md:29-34,70-73`

**Problem:** “Identical diagnostics or observable state” does not define normalization, ordering,
source/name treatment or state projection. AC-4 checks preconditions and IDs but not whether a
wrong transform or comparator is rejected.

**Selected resolution:** Every relation contract owns a closed precondition, normalization,
observable projection and comparator. Acceptance must inject a precondition bug, non-preserving
rewrite and omitted observable and prove each fails an oracle specification test.

**Authority:** AI — delegated by `--auto-design` (testing and comparison mechanism).<br>
**Rejected:** one global comparator is unsound across renaming, diagnostic and state relations.<br>
**Counterargument:** relation-local policies can drift without shared conformance tests.<br>
**Confidence:** High. **Hardening:** challenger converged.

### PF-005: Mutation adequacy can pass with three token mutants 🟠 MAJOR

**Dimensions:** Completeness, Testability<br>
**Location:** `RD-03-independent-oracles.md:34,72-73`<br>
**Codebase evidence:** `packages/readiness/src/roundtrip-conformance-v1.ts:11-34`;
`packages/readiness/src/renderer-roundtrip.spec.test.ts:144-198`

**Problem:** AC-5 proves only one wrong arithmetic, evaluation-order and diagnostic-code mutant.
It does not cover every implemented operation, width/sign path, diagnostic mapping, transform
precondition/rewrite or comparator.

**Selected resolution:** Require a closed versioned mutation catalog with at least one killed
production-path mutant per evaluator operation, diagnostic mapping, transform precondition,
transform rewrite and relation comparator; zero required mutants may survive.

**Authority:** AI — delegated by `--auto-design` (testing strategy).<br>
**Rejected:** three examples are insufficient; an external mutation dependency is unnecessary
because the repository already uses explicit production-path mutation catalogs.<br>
**Counterargument:** catalog maintenance grows with semantic operation granularity.<br>
**Confidence:** High. **Hardening:** challenger converged.

### PF-006: Acceptance proves failed bindings but not selected authority 🟠 MAJOR

**Dimensions:** Completeness, Testability, Codebase Alignment<br>
**Location:** `RD-03-independent-oracles.md:22-23,76-77`<br>
**Codebase evidence:** `packages/readiness/src/binding-validator.ts:287-305,320-329`;
`packages/readiness/src/handler-bindings.spec.test.ts:61-80`

**Problem:** RD-03 can pass AC-7 while every new handler remains candidate-only and unavailable.

**Selected resolution:** Add positive acceptance requiring every intended RD-03 handler exactly
once as `bound` in the atomically selected publication, resolvable only through its opaque snapshot
with the exact content-derived revision; failed promotion must leave it unavailable.

**Authority:** AI — delegated by `--auto-design` (integration verification).<br>
**Rejected:** candidate validation proves shape, not selected semantic authority.<br>
**Counterargument:** publication evolution is substantial for a narrow initial subset.<br>
**Confidence:** High. **Hardening:** challenger converged.

### PF-007: RD-02 dependency and oracle evaluation identity are absent 🟠 MAJOR

**Dimensions:** Dependency, Ordering, Completeness, Codebase Alignment<br>
**Location:** `RD-03-independent-oracles.md:7,20-23,70-71`<br>
**Codebase evidence:** `packages/readiness/src/case-identity.ts:41-80`;
`packages/readiness/src/replay.ts:124-221`

**Problem:** RD-03 materially consumes RD-02's IR, modeled registry, case identities, revision
registry and publication, but declares only RD-01. Source/transformed case IDs alone do not bind
expected results to oracle/transform revisions, budgets or comparators.

**Selected resolution:** Add RD-02 as a dependency and define a separate oracle-evaluation identity
that preserves RD-02 source-case identity while binding source/transformed IDs, relation ID,
diagnostic-manifest digest, budget/policy revision, observable projection and all oracle/transform
contract and implementation revisions.

**Authority:** AI — delegated by `--auto-design` (dependency and identity mechanism).<br>
**Rejected:** changing campaign/case identity would incorrectly change source identity when only
an oracle changes.<br>
**Counterargument:** a second collision/replay lifecycle must be maintained.<br>
**Confidence:** High. **Hardening:** challenger converged.

### PF-008: The four oracle handlers have no callable or routing contract 🟠 MAJOR

**Dimensions:** Completeness, Integration, Codebase Alignment<br>
**Location:** `RD-03-independent-oracles.md:20-34`<br>
**Codebase evidence:** `packages/readiness/src/generated/declarations.ts:1-3`;
`packages/readiness/src/binding-model.ts:19-52`

**Problem:** The inventory names `oracle.frontend-result`, `oracle.compiler-result`,
`oracle.emitted-program` and `oracle.runtime-state`, but the RD does not define their inputs,
closed outcomes, supported/unmodeled/budget/fault routing or how RD-04 consumes them.

**Selected resolution:** Define one closed version-one oracle request/result protocol shared by the
four typed handler façades. It routes by exact declared handler and modeled contract; unsupported
rules return `oracle-unmodeled`, never success.

**Authority:** AI — delegated by `--auto-design` (internal API design).<br>
**Rejected:** four unrelated protocols invite semantic drift; one untyped generic callable cannot
prove routing compatibility.<br>
**Counterargument:** shared protocol must not erase genuinely different observables.<br>
**Confidence:** High.

### PF-009: Oracle entry and resource safety are not acceptance-gated 🟠 MAJOR

**Dimensions:** Security, Edge Cases, Feasibility<br>
**Location:** `RD-03-independent-oracles.md:44-47,59-61,74-75`<br>
**Codebase evidence:** `packages/readiness/src/generator-ir-validator.ts:91-165,860-939`;
`packages/readiness/src/generation-budget.ts:26-46,333-403`

**Problem:** TypeScript types do not protect runtime entry. A step cap alone does not bound hostile
objects, cycles, nodes/depth, frames, memory cells, arrays, allocation or transform expansion.

**Selected resolution:** Every evaluator/transform entry accepts `unknown`, uses the existing
defensive IR validator and operates only on its immutable snapshot. A closed oracle budget caps
input nodes/depth, steps, frames, cells, array elements and transform-output growth; transformed
IR is revalidated before execution. Hostile-object/cycle/oversize cases are acceptance tests.

**Authority:** AI — delegated by `--auto-design` (security and resource-control mechanism within
the approved closed-input policy).<br>
**Rejected:** trusting only RD-02-produced objects leaves public handler entry unsafe.<br>
**Counterargument:** repeated validation adds bounded overhead.<br>
**Confidence:** High.

### PF-010: Memory-state semantics are underdetermined 🟠 MAJOR

**Dimensions:** Edge Cases, Feasibility<br>
**Location:** `RD-03-independent-oracles.md:26-27,44-45`<br>
**Codebase evidence:** `packages/readiness/src/generator-ir.ts:68-74,99-105`;
`spec/04-expressions-operators.md:320-338`

**Problem:** The RD does not define initial memory, absent-cell reads, address wrap, word access at
`$ffff`, overlapping writes or ordered volatile effects. Those choices would otherwise become
invented language semantics.

**Selected resolution:** Use a versioned explicit initial-memory fixture and ordered volatile
access log. Define sparse/default behavior and aliasing only where the frozen spec is decisive;
route unresolved `$ffff + 1` behavior to `blocked-errata`/`oracle-unmodeled`.

**Authority:** AI — delegated by `--auto-design` for representation and unresolved-authority
handling; it does not invent a language result.<br>
**Rejected:** silently choosing wrap/trap or an absent-cell value would exceed delegated authority.<br>
**Counterargument:** excluding unresolved boundaries reduces initial coverage.<br>
**Confidence:** High.

### PF-011: Evaluation-order mutation has no observable witness 🟠 MAJOR

**Dimensions:** Testability, Feasibility<br>
**Location:** `RD-03-independent-oracles.md:26-27,72-73`<br>
**Codebase evidence:** `packages/readiness/src/generator-ir.ts:76-82`

**Problem:** Pure operands and immutable-map reads make operand reversal observationally invisible.
A test-only traversal assertion would test implementation structure, not language semantics.

**Selected resolution:** The supported scalar/memory subset includes an ordered volatile-memory
effect projection; the evaluation-order mutant must change that independent observable and fail.

**Authority:** AI — delegated by `--auto-design` (test witness and observable representation).<br>
**Rejected:** internal traversal assertions are circular.<br>
**Counterargument:** the witness must be backed by frozen-spec ordering, not merely test design.<br>
**Confidence:** High.

### PF-012: Frozen specification conflicts prevent an authoritative division oracle 🟠 MAJOR

**Dimensions:** Feasibility, Consistency with Authority<br>
**Location:** `RD-03-independent-oracles.md:26-28,53-55`<br>
**Codebase evidence:** `spec/04-expressions-operators.md:91-93,482`;
`spec/15-platform-profile.md:163-175`; `spec/14-diagnostics.md:157-160`

**Problem:** The frozen spec gives both maximum-value and zero runtime results for division by zero,
and both E10160 and E10082 for constant division by zero. Both statements remain mandatory
inventory rules, so an independent oracle cannot select one without inventing semantic authority.

**Recommendation — BEST:** Exclude the conflicting rules from the v1 supported subset, retain
`oracle-unmodeled`/`blocked-errata`, and give the conflict an explicit owner/reopen trigger. Do not
modify frozen `spec/`.

**Authority:** User accepted the recommended exclusion/blocked-errata handling on 2026-07-27.<br>
**Confidence:** High.<br>
**Hardening:** no viable technical mechanism can reconcile contradictory authority.

### PF-013: Step accounting and exact budget boundary are unspecified 🟡 MINOR

**Dimension:** Testability<br>
**Location:** `RD-03-independent-oracles.md:46-47,74-75`

**Problem:** Per-expression, per-statement, per-call and per-effect counters could all satisfy the
current AC with incompatible boundaries.

**Selected resolution:** The contract enumerates step-consuming events and tests `bound-1`,
`bound`, and `bound+1`, including nested applicable constructs; budget failure contributes no
readiness success.

**Authority:** AI — delegated by `--auto-design` (resource-accounting mechanism).<br>
**Confidence:** High.

## Challenger Reconciliation

One blind independent challenger received the major finding batch and viable options without the
lead recommendation. It converged on every technical selection and on the recommended scope
correction. It additionally corrected execution order: contracts/declarations/manifests →
evaluator/transforms/comparators → mutation adequacy → content-derived fresh candidates → atomic
publication. Candidate revisions cannot be authoritative before implementation dependency bytes
exist.

## Iteration 2 Verification

| Finding | Verified correction |
|---|---|
| PF-001 | V1 is pinned to the nine RD-02 scalar/memory rules and current IR; broader IR and loop relations are explicitly owned by RD-08 |
| PF-002 | `transform.semantic-relations` and the five-handler publication obligation are named |
| PF-003 | A closed independently reviewed diagnostic manifest owns code/phase/projection |
| PF-004 | Every relation owns precondition, normalization, projection and comparator plus three negative witnesses |
| PF-005 | A closed production-path mutation catalog requires zero survivors |
| PF-006 | Atomic selected publication and opaque-snapshot lookup are acceptance-gated |
| PF-007 | RD-02 is an explicit dependency and oracle evaluation has a separate revision-complete identity |
| PF-008 | One closed protocol and exact façade routing are required |
| PF-009 | Unknown entry validation, immutable snapshots and multidimensional budgets are acceptance-gated |
| PF-010 | Initial memory, ordered effects, overlap and unresolved boundary behavior are defined |
| PF-011 | Evaluation order uses an observable volatile-effect witness |
| PF-012 | Contradictory division rules remain blocked/unmodeled without changing frozen `spec/` |
| PF-013 | Step events and `bound-1`/`bound`/`bound+1` behavior are fixed |

The bounded re-scan covered all 13 dimensions against the unchanged audit target. No new finding
survived refutation. The RD is ready for plan creation.

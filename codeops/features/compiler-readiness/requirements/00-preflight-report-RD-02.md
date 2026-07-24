# Preflight Report: RD-02 Typed Generative Cases and Deterministic Replay

> **Status**: ✅ PASSED — all 7 findings resolved
> **Iteration**: 2 (verification after target-local remediation)
> **Artifact**: single requirement at `RD-02-generative-cases.md`
> **Artifact Revision**: `sha256:e1b60b0281d24d69daa056e58c123e0346a891a9ea26d04e69a3695c7027a218`
> **Audit Target**: `compiler-readiness/RD-02`
> **Codebase Grounded**: 12 source/config/artifact files examined; 18 references verified
> **Last Updated**: 2026-07-24
> **Mode**: Auto-design
> **Root Invocation ID**: `compiler-readiness-rd02-20260724-01`

## Scope

- **Target:** `RD-02-generative-cases.md` only.
- **Context:** compiler-readiness ambiguity register, RD-01 inventory contracts and implementation,
  downstream RD-03–RD-07 dependency declarations, workspace package boundaries.
- **Authorized changes:** target-local requirement corrections plus required report, traceability
  and roadmap lifecycle metadata. Context documents were not treated as audited or passed.

## Codebase Context Summary

**Tech Stack:** TypeScript ESM/NodeNext, Yarn classic workspaces, Turborepo and Vitest.

**Architecture:** RD-01 established the independent `@blend65/readiness` package and authoritative
JSON inventory. The package exports closed rule, declaration, projection and versioning contracts
without compiler-workspace runtime dependencies. No generator runtime, generator IR, PRNG,
renderer, replay identity, executable binding registry or rule-model registry exists yet.

**Key files examined:** `packages/readiness/src/model.ts`,
`packages/readiness/src/declaration-validator.ts`, `packages/readiness/src/index.ts`,
`packages/readiness/src/dependency-boundary.impl.test.ts`,
`packages/readiness/src/versioning.ts`, `packages/readiness/src/generated/declarations.ts`,
`readiness/schema/inventory-v1.schema.json`, `readiness/inventory/compiler-readiness-v1.json`,
and compiler-readiness RD-03, RD-04, RD-06 and RD-07.

**Domain lenses:** compiler/language and data/migration.

**Critical observation:** all 2,112 inventory rules had empty `validDomains`,
`invalidNeighbors` and `boundaryFamilies`; RD-02's original domain-driven acceptance criteria
could therefore pass vacuously.

## Summary

| # | Finding | Severity | Resolution |
|---|---|---|---|
| PF-001 | Executable rule models do not exist | 🔴 Critical | Resolved |
| PF-002 | Executable handler binding protocol is undefined | 🟠 Major | Resolved |
| PF-003 | Replay identity is incomplete and inconsistent | 🟠 Major | Resolved |
| PF-004 | Independence boundary is ambiguous | 🟠 Major | Resolved |
| PF-005 | Structural round-trip has no independent inverse | 🟠 Major | Resolved |
| PF-006 | Structural and execution budgets are conflated | 🟠 Major | Resolved |
| PF-007 | RD-02-owned boundary transform is omitted | 🟠 Major | Resolved |

All 13 dimensions were scanned in five exact clusters. No surviving minor or observation finding
remains after iteration 2.

## Findings and Resolutions

### PF-001: Executable rule models do not exist 🔴 CRITICAL

**Dimensions:** Implicit Assumptions, Completeness, Feasibility, Scope, Codebase Alignment

**Evidence:** The original requirement conditioned generation on inventoried domains and neighbors,
but every current rule has empty generation-domain arrays. `InventoryRule` exposes only generic
domain descriptors and no separate model registry.

**Resolution:** RD-02 now explicitly owns a separate exhaustive, versioned rule-model registry.
Every inventory rule is `modeled`, `unmodeled` or `not-generatable`; only modeled rules participate,
and an independently reviewed non-empty initial subset prevents vacuous completion. Models cite
authoritative rules and requirement prose is never parsed as an executable model.

**Delegated Decision:** AI — delegated by `--auto-design`.

- **Eligibility:** internal compiler-testing architecture within the confirmed RD-02 objective
- **Objective:** make inventory-driven generation real without rewriting or weakening RD-01
- **Rejected alternatives:** broad population of stringly inventory-v1 fields risks unreviewed
  semantic inference; a new prerequisite RD would expand the authorized roadmap scope
- **Strongest counterargument:** the registry is substantial enough to deserve its own RD
- **Confidence:** High — reopen if the registry cannot remain exhaustive and independently reviewed
- **Hardening:** challenger converged on the separate registry but preferred a prerequisite RD;
  the target-local form was retained because preflight cannot expand scope silently
- **Policy version:** 1
- **Reopen trigger:** any claimed rule lacks a machine-checkable cited model

### PF-002: Executable handler binding protocol is undefined 🟠 MAJOR

**Evidence:** `HandlerDeclaration` records contract metadata and `bound | unbound`, while the
existing validator has no executable registry or implementation revision.

**Resolution:** RD-02 requires a separate closed binding registry, content-addressed implementation
revisions and bidirectional declaration/registry validation.

**Delegated Decision:** AI — delegated by `--auto-design`; challenger converged; confidence High.

### PF-003: Replay identity is incomplete and inconsistent 🟠 MAJOR

**Evidence:** The original Must Have and AC-2 named different replay tuples and omitted handler,
renderer, configuration and implementation identities.

**Resolution:** RD-02 now defines a canonical content-addressed `CampaignIdentity` and derived
`CaseIdentity`, including canonical inventory content and the case-shaping boundary-transform
revision, collision rejection and explicit historical-revision incompatibility without fallback.

**Delegated Decision:** AI — delegated by `--auto-design`; challenger converged; confidence High.

### PF-004: Independence boundary is ambiguous 🟠 MAJOR

**Evidence:** The original package list omitted the compiler facade while the existing readiness
boundary already rejects every `@blend65/*` production import.

**Resolution:** The rule-model, generator, transform, PRNG, renderer and replay surfaces forbid all
`@blend65/*` production imports. Compiler invocation remains RD-04 adapter work.

**Delegated Decision:** AI — delegated by `--auto-design`; challenger converged; confidence High.

### PF-005: Structural round-trip has no independent inverse 🟠 MAJOR

**Evidence:** The only existing Blend65 parser is compiler-owned, and readiness has no independent
inverse capable of proving renderer structure.

**Resolution:** RD-02 now requires a bounded independent tokenizer/parser/normalizer for exactly
the generated subset, separate precedence data and mutation detection.

**Delegated Decision:** AI — delegated by `--auto-design`; challenger converged; confidence High.

### PF-006: Structural and execution budgets are conflated 🟠 MAJOR

**Evidence:** The original acceptance criterion omitted declaration limits and required runtime
steps before compilation, overlapping RD-03 evaluator and RD-04 emulator budgets.

**Resolution:** RD-02 owns explicit pre-compilation structural limits. Evaluator, compiler,
assembler and emulator limits remain with RD-03, RD-04 and RD-07.

**Delegated Decision:** AI — delegated by `--auto-design`; challenger converged; confidence High.

### PF-007: RD-02-owned boundary transform is omitted 🟠 MAJOR

**Evidence:** RD-01 declares `transform.boundary-variants` with owner `readiness-rd02`, but the
original RD-02 only required generator bindings.

**Resolution:** RD-02 explicitly implements and binds that transform; semantic/metamorphic
transforms remain RD-03-owned.

**Delegated Decision:** AI — delegated by `--auto-design`; challenger converged; confidence High.

## Iteration-2 Verification

- Every original critical/major root cause has a concrete Must Have and acceptance oracle.
- Iteration 2 reopened PF-003 because transform revision and canonical inventory content were
  missing from identity; both were added and their inequality behavior is now explicit.
- Iteration 2 clarified that `not-generatable` projects to RD-06 `unmodeled`, and made handler
  publication an atomic validate/bind/review/project/validate sequence with rollback to unbound.
- Iteration 3 split candidate and published-state binding validation so the promotion sequence has
  a deterministic, non-contradictory oracle.
- The target now distinguishes normative inventory authority from executable generator models.
- Identity contains every case-shaping revision and configuration boundary found during the scan.
- Import, registry, identity, path, size and version failures are closed and testable.
- No target-local contradiction remains with RD-03/RD-04 ownership.
- No `spec/` file is modified or made part of the plan.

## Verdict

✅ **PREFLIGHT PASSED — all 7 findings resolved.**

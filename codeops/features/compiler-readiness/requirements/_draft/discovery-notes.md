# Compiler Readiness — Requirements Discovery Notes

> Mode: make-requirements `--auto-design`
> Root invocation ID: `compiler-readiness-20260723-01`
> Status: Zero-Ambiguity Gate preparation

## Confirmed Vision

Establish compiler readiness from the frozen Blend65 v3.0 specification using deterministic,
generative evidence whose semantic oracle is independent of the compiler implementation. Existing
examples, assembly twins, goldens and performance budgets remain secondary regression or quality
evidence and do not define readiness.

## Stakeholders

| Role | Need |
|---|---|
| Modern Blend65 programmer | Specified programs compile and behave correctly without compiler-shaped workarounds |
| Compiler maintainer | Rule-level coverage, deterministic failures and minimized reproducers |
| Release owner | Decidable readiness gates and visible exclusions |
| Optimization owner | Correctness-cleared programs and trustworthy runtime measurements |

## Comparable-System Lessons

| System/family | Relevant lesson | Intended use |
|---|---|---|
| QuickCheck/Hypothesis | Typed/property-based generation, shrinking and seed replay | Generator and minimizer |
| Csmith/YARPGen | Generate only programs with defined semantics; differential comparison | Valid-program discipline |
| LLVM lit/FileCheck suites | Small named regression fixtures and tiered execution | Promoted minimal regressions |
| Language conformance suites | Rule-indexed positive and negative cases | Coverage denominator |
| Metamorphic compiler testing | Equivalence-preserving transformations expose wrong-code defects | Oracle supplement |

## Scope

### In

- Machine-readable inventory for mandatory v3.0 specification rules.
- Deterministic valid- and invalid-program generation.
- Independent bounded reference semantics.
- Metamorphic relations for cases outside the first oracle subset.
- Frontend, emission, ACME and VICE outcome classification.
- Replay, shrinking, promoted regressions and readiness reporting.
- Explicit ambiguity/errata and unsupported-rule handling.
- Evidence feeding a recovery roadmap.

### Out

- Rewriting the frozen language specification.
- Fixing compiler defects within this requirements workflow.
- Treating asm parity or expert assembly as the readiness gate.
- Exhaustive proof over unbounded programs.
- Replacing existing tests, examples or parity tools.
- Cross-platform emulator rollout in the first implementation slice; architecture must remain
  target-extensible.

## Applicable Domain Lenses

- **Compiler and language:** grammar, typing, evaluation, diagnostics, IR preservation,
  optimization equivalence and conformance.
- **Data and migration:** versioned rule models, seed/reproducer formats, invalidation and
  compatibility of persisted evidence.

## Proposed RD Decomposition

| RD | Capability | Depends on |
|---|---|---|
| RD-01 | Specification inventory and rule schema | — |
| RD-02 | Typed program generation and deterministic replay | RD-01 |
| RD-03 | Independent semantic and diagnostic oracle | RD-01 |
| RD-04 | Tiered compiler, ACME and VICE execution | RD-02, RD-03 |
| RD-05 | Failure classification, shrinking and regression promotion | RD-02, RD-04 |
| RD-06 | Readiness matrix, release gate and legacy-evidence integration | RD-01–RD-05 |
| RD-07 | Non-functional safety, determinism and evolution | RD-01–RD-06 |

## Reserved Decision Still Required

The exact release threshold for calling the compiler “ready” is product acceptance authority and
cannot be delegated by `--auto-design`.

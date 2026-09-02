# Compiler Readiness — Requirements Documents

> **Project**: Blend65 — specification-derived C64 v3.0 compiler readiness
> **Status**: Complete through RD-07; RD-08 approved for denominator expansion
> **Created**: 2026-07-23
> **Architecture**: TypeScript rule inventory, independent generator/oracle, ACME and VICE
> **CodeOps Artifact Schema**: 1

## Overview

Compiler readiness means that every mandatory, applicable Blend65 v3.0 rule is modeled and passes
its declared observation tier for the C64 target. Correctness, expressibility, diagnostics and
robustness gate readiness; assembly parity and performance remain downstream quality work.

The baseline uses a versioned rule inventory as its denominator, an independent typed generator,
a bounded semantic interpreter plus metamorphic properties, and target execution through ACME and
VICE where runtime behavior must be observed. Existing examples and assembly twins remain useful
regressions but never define readiness.

## Domain Lenses

| Lens | Evidence |
|---|---|
| Compiler and language | Grammar, typing, semantics, diagnostics, IR preservation and execution |
| Data and migration | Versioned rule schemas, generator identity, replay and persisted failures |

## Domain Glossary

| Term | Definition |
|---|---|
| Rule | One normative, uniquely identified obligation from the frozen v3.0 specification |
| Rule inventory | Versioned JSON authority containing every mandatory C64-applicable rule |
| Case | A deterministic generated Blend65 program tied to one or more rules |
| Oracle | Independent mechanism that determines the expected diagnostic or observable result |
| Terminal tier | Cheapest declared tier capable of proving a case's normative outcome |
| Campaign | A reproducible set of cases defined by inventory version, generator version and seed |
| Failure class | Semantic mismatch, diagnostic mismatch, ICE, assembler failure or timeout |
| Readiness claim | The exact string `C64 v3.0 Ready`, issued only under RD-06's strict gate |

## Document Index

| Document | Description | Depends on |
|---|---|---|
| [Ambiguity Register](00-ambiguity-register.md) | Authorized design decisions | — |
| [RD-01](RD-01-specification-inventory.md) | Specification inventory and rule schema | — |
| [RD-02](RD-02-generative-cases.md) | Typed generation and deterministic replay | RD-01 |
| [RD-03](RD-03-independent-oracles.md) | Semantic, diagnostic and metamorphic oracles | RD-01 |
| [RD-04](RD-04-tiered-execution.md) | Compiler, ACME and VICE execution | RD-02, RD-03 |
| [RD-05](RD-05-failure-reduction.md) | Classification, shrinking and regression promotion | RD-02, RD-04 |
| [RD-08](RD-08-complete-c64-rule-coverage.md) | Complete C64 rule models and generated-program coverage | RD-01–RD-04 |
| [RD-06](RD-06-readiness-gate.md) | Matrix, strict release gate and legacy evidence | RD-01–RD-05, RD-08 |
| [RD-07](RD-07-non-functional.md) | Safety, determinism, evolution and operational bounds | RD-01–RD-06 |

## Dependency Graph

```text
RD-01 Specification Inventory
├── RD-02 Generative Cases
├── RD-03 Independent Oracles
│   └── RD-04 Tiered Execution ← RD-02
│       ├── RD-05 Failure Reduction
│       └── RD-08 Complete C64 Coverage ← RD-01, RD-02, RD-03
│           └── RD-06 Readiness Gate ← RD-05
└───────────────────────────────┘
                                └── RD-07 Non-Functional Requirements
```

## Suggested Implementation Order

| Phase | Documents | Outcome |
|---|---|---|
| A: Authority | RD-01 | Known denominator, source precedence and ambiguity status |
| B: Evidence engine | RD-02 → RD-03 → RD-04 | Generated cases with decisive outcomes |
| C: Coverage and operability | RD-08 first vertical slice → RD-05 remainder → RD-08 denominator closure | Broad real-program evidence and minimal reproducible failures |
| D: Readiness | RD-06 → RD-07 | Strict C64 claim and durable operation |

RD-01 defines the v1 format and migration interface. RD-07's evolution subset is a conditional
prerequisite before the first schema or inventory-format upgrade, even if that upgrade occurs
before RD-07's remaining operational work.

## Key Decisions

| Decision | Choice | AR |
|---|---|---|
| Semantic authority | Frozen v3.0 specification | AR-1 |
| Rule storage | JSON + JSON Schema; keyed TypeScript handlers | AR-4 |
| Oracle | Bounded independent interpreter plus metamorphic relations | AR-5 |
| Generator | Independent typed IR; text generation only for malformed inputs | AR-6 |
| Execution | Declared cheapest-sufficient terminal tier | AR-7 |
| Persistence | Versioned metadata and minimized regressions, not bulk cases | AR-9 |
| Claim | Strict target-scoped `C64 v3.0 Ready` | AR-10 |
| Complete coverage | Family-driven rule models with explicit per-rule dispositions | AR-11–AR-14 |
| Optimizer handoff | First arrays/calls/branches/loops publication unlocks optimizer foundations | AR-18 |

## Scope

**Must:** model and prove every mandatory C64-applicable v3.0 rule.
**Should:** make gaps cheap to reproduce, diagnose and route into recovery work.
**Won't:** modify `spec/`, fix compiler defects, claim readiness for other platforms, or use
performance parity as semantic evidence.

## Final Requirements Check

| Concern | Disposition |
|---|---|
| Input validation and sanitization | RD-01, RD-02, RD-04 and RD-07 |
| Command/path injection prevention | RD-04 and RD-07 |
| Authentication, authorization and rate limiting | N/A — no service or multi-user surface |
| Secrets and sensitive data | RD-05 and RD-07 prohibit persistence/logging |
| Encryption in transit/at rest | N/A — local non-sensitive artifacts only |
| Infrastructure hardening | RD-04 and RD-07 subprocess isolation and bounds |
| Security testing | RD-01, RD-04, RD-05 and RD-07 acceptance criteria |
| Audit trail | Versioned inventory, campaign manifests and promoted failures |
| Export/reporting | RD-06 machine-readable JSON and human-readable Markdown |
| Backup/recovery | Deterministic replay and explicit evidence invalidation in RD-07 |
| Monitoring/capacity | Per-tier duration/case telemetry in RD-07 |
| Accessibility, mobile, i18n, user sessions | N/A — developer tooling with no UI/service |

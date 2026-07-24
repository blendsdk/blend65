# RD-02 Typed Generative Cases and Deterministic Replay Implementation Plan

> **Feature**: Independent typed program generation, stable identities and exact replay
> **Status**: Planning Complete
> **Created**: 2026-07-24
> **Implements**: compiler-readiness/RD-02
> **CodeOps Artifact Schema**: 1

## Overview

This plan builds the first specification-governed generative baseline for Blend65. It does not use
the compiler's AST or current behavior as truth. A closed rule-model registry identifies exactly
which inventory rules can generate cases, an independent typed IR constructs them, and a separate
renderer/parser pair proves source structure before the real compiler sees it.

The first modeled vertical slice is deliberately meaningful: scalar types and expressions plus
`peek`, `poke`, `peekw` and `pokew`, including literal, named-constant, local-variable and parameter
spellings. That slice directly exposes the known runtime-address restriction instead of preserving
it as a test limitation (AR-P1).

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | RD-02 delta scope |
| 02 | [Current State](02-current-state.md) | Existing readiness implementation and gaps |
| 03-01 | [Rule Models and Bindings](03-01-rule-models-bindings.md) | Governed model and executable binding registries |
| 03-02 | [Generator IR and Budgets](03-02-generator-ir-budgets.md) | Independent IR, construction and limits |
| 03-03 | [Identity and Replay](03-03-identity-replay.md) | Canonical identities, deterministic draws and replay |
| 03-04 | [Rendering and Round Trip](03-04-rendering-roundtrip.md) | Source renderer and independent inverse |
| 03-05 | [Atomic Publication](03-05-atomic-publication.md) | Content-addressed snapshot publication |
| 07 | [Testing Strategy](07-testing-strategy.md) | Immutable ST cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Ordered implementation tasks |

## Quick Reference

### Public flow

```text
load authority + rule models
  → create campaign identity
  → generate typed case by path
  → render and independently round-trip
  → replay exact case identity
  → publish bindings only after complete validation
```

### Key Decisions

| Decision | Outcome |
|---|---|
| Initial semantic slice | Scalar kernel plus memory-intrinsic argument spellings (AR-P1) |
| Rule models | Canonical JSON facts plus closed TypeScript executors (AR-P2) |
| Random choices | Path-local SHA-256 counter generation (AR-P4) |
| Round trip | Independent bounded tokenizer/Pratt normalizer (AR-P7) |
| Binding visibility | Content-addressed release plus one atomic pointer (AR-P10) |

## Primary Change Surface

- `packages/readiness/src/` — schemas, registries, IR, generation, identity, renderer and replay
- `readiness/rule-models/` — canonical exhaustive rule-model manifest
- `readiness/bindings/` and `readiness/publications/` — executable binding metadata and releases
- `readiness/inventory/`, `readiness/review/`, generated projections — final reviewed binding update
- `codeops/features/compiler-readiness/` — execution evidence and closeout only

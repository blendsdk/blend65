# RD-01 Specification Inventory — Implementation Plan

> **Feature**: Build the authoritative, machine-readable C64 v3.0 readiness denominator
> **Status**: Planning Complete
> **Created**: 2026-07-23
> **Implements**: compiler-readiness/RD-01
> **CodeOps Artifact Schema**: 1

## Overview

This plan creates a private `@blend65/readiness` workspace for inventory mechanics and a root
`readiness/` authority directory for the schema, source manifest, fragmentation vectors, clause
ledger, rule inventory and generated human projection (AR-P2, AR-P3). The implementation never
changes `spec/`; it identifies every included fragment, classifies every other specification
source, and makes omissions, contradictions, unsafe citations and unavailable evidence handlers
machine-visible.

The work closes in five specification-first phases: strict data intake and schema; byte-exact
fragmentation and source safety; semantic graph/declaration validation; complete inventory
population; and deterministic documentation/version-evolution closeout (AR-P12). The result is the
denominator consumed by RD-02 through RD-07, not a readiness claim by itself.

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | Thin RD-01 scope delta |
| 02 | [Current State](02-current-state.md) | Existing repository and implementation gaps |
| 03-01 | [Workspace and Data Model](03-01-workspace-data-model.md) | Package, artifact layout, strict input and v1 schema |
| 03-02 | [Fragmentation and Source Safety](03-02-fragmentation-source-safety.md) | Byte spans, manifest and citations |
| 03-03 | [Semantic Validation](03-03-semantic-validation.md) | Ledger, conflicts, declarations and graph |
| 03-04 | [Projection and Evolution](03-04-projection-evolution.md) | Markdown, command, version dispatch and migration seam |
| 07 | [Testing Strategy](07-testing-strategy.md) | Immutable specification cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Five phases and task checklist |

## Quick Reference

### Repository commands

```text
yarn readiness:check
yarn readiness:generate
```

`readiness:check` does not alter tracked, authoritative, conformance, review-evidence or generated
artifacts and fails if validation or either generated projection is stale. Its package build may
refresh ignored `dist/**` and `*.tsbuildinfo` outputs. `readiness:generate` validates first, renders
all outputs in memory, then updates only the explicitly enumerated generated TypeScript declaration
module and generated Markdown projection (AR-P7).

### Key Decisions

| Decision | Outcome |
|---|---|
| Implementation boundary | Private `@blend65/readiness` workspace (AR-P2) |
| Authority boundary | Root `readiness/`; JSON authoritative, Markdown generated (AR-P3) |
| JSON intake | Strict `jsonc-parser` tree inspection before Ajv (AR-P4, AR-P5) |
| Fragmentation | Versioned byte-oriented scanner, not a full Markdown renderer (AR-P6) |
| Rule identity | Stable assigned rule IDs plus source hashes and lineage (AR-P8) |
| Downstream handlers | Typed declarations may remain explicitly unbound (AR-P9) |

## Related Files

- `packages/readiness/` — new private typed implementation and tests.
- `readiness/schema/inventory-v1.schema.json` — committed closed schema.
- `readiness/inventory/compiler-readiness-v1.json` — authoritative inventory aggregate.
- `readiness/inventory/rule-identities-v1.jsonl` — append-only, hash-chained allocation and
  retirement ledger anchored by the inventory's current head digest.
- `readiness/conformance/fragmentation-v1.json` — implementation-independent source vectors.
- `readiness/reviews/compiler-readiness-v1-review.json` — unit/dependency-digest and aggregate
  independent semantic review evidence; process evidence, not semantic authority.
- `readiness/generated/compiler-readiness.md` — deterministic non-authoritative projection.
- `packages/readiness/src/generated/declarations.ts` — deterministic non-authoritative bounded
  handler/capability/declaration ID unions.
- `package.json`, `tsconfig.json`, `yarn.lock` — workspace integration and commands.

# RD-03 Independent Semantic, Diagnostic and Metamorphic Oracles Implementation Plan

> **Feature**: Bounded independent expected-result authority for generated readiness cases
> **Status**: Planning Complete
> **Created**: 2026-07-27
> **Implements**: compiler-readiness/RD-03
> **CodeOps Artifact Schema**: 1

## Overview

This plan adds an independent expected-result system to the compiler-readiness package without
building a second compiler. A bounded reference evaluator owns exact scalar and memory semantics
for the nine rules already modeled by RD-02. A separately reviewed diagnostic manifest owns exact
invalid-neighbor expectations. Five typed metamorphic relations supplement the absolute oracle
with relation-specific preconditions and comparators.

RD-02 source-case identity stays unchanged and is verified through complete deterministic replay
provenance. RD-03 adds distinct source/transformed content digests and a separate
oracle-evaluation identity. Authoritative calls run through a resolver-owned, snapshot-bound
context that supplies the reviewed suite and participant revisions; callers cannot substitute
authority. Four oracle façades plus `transform.semantic-relations` are promoted through the
existing content-addressed publication without changing its seven-member v1 format.

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions and provenance |
| 00 | [Index](00-index.md) | Overview, navigation and change surface |
| 01 | [Requirements](01-requirements.md) | Approved RD-03 delta and traceability |
| 02 | [Current State](02-current-state.md) | Existing RD-02 foundations and exact gaps |
| 03-01 | [Oracle Contracts and Diagnostic Authority](03-01-oracle-contracts-authority.md) | Public protocol, authority files and route joins |
| 03-02 | [Reference Evaluator](03-02-reference-evaluator.md) | Scalar, frame, budget and memory semantics |
| 03-03 | [Semantic Relations](03-03-semantic-relations.md) | Transform preconditions, rewrites and comparators |
| 03-04 | [Identity and Mutation Adequacy](03-04-identity-mutation.md) | Evaluation identity and closed mutation catalog |
| 03-05 | [Atomic Publication](03-05-atomic-publication.md) | Fresh candidates, compatibility and pointer commit |
| 07 | [Testing Strategy](07-testing-strategy.md) | Immutable specification cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Ordered implementation tasks |

## Quick Reference

### Public flow

```text
resolve one accepted publication into a snapshot-bound evaluation context
  → validate unknown request and complete RD-02 replay provenance
  → regenerate and verify the source case; derive source content identity
  → enforce structural and oracle semantic closure
  → evaluate source case or apply one relation and revalidate transformed content
  → compare the relation-specific observable projection
  → derive revision-complete oracle-evaluation identity
  → return result, provenance and content identities as one evidence envelope
```

### Key decisions

| Decision | Outcome |
|---|---|
| Initial population | Exact nine RD-02 modeled rules and current generator IR |
| Absolute oracle | Pure bounded evaluator using `bigint` and typed normalization |
| Supplemental oracle | Five closed relation IDs with local preconditions/comparators |
| Diagnostic truth | Reviewed compiler-source manifest plus separate external-binding rejection authority |
| Identity | Replay-verified RD-02 provenance, two content digests and one evaluation digest |
| Mutation proof | Exact operation/path join; isolated async contexts; bounded worker execution |
| Invocation authority | Resolver-owned snapshot context; caller cannot provide the reviewed suite |
| Publication | Legacy preparation preserved; incremental four-carried-plus-five promotion API |
| Format evolution | No inventory or publication schema upgrade; RD-07 gate remains inactive |

## Primary Change Surface

- `packages/readiness/src/` — oracle protocol, authority parsers, replay/content identity,
  semantic-closure validator, evaluator, transforms, identity, worker-contained mutation
  conformance, snapshot evaluation, binding candidates, publication staging and resolver
  compatibility
- `readiness/oracles/` — canonical diagnostic manifest and mutation catalog
- `readiness/reviews/` — independent diagnostic and final semantic review evidence
- `readiness/inventory/` and generated projections — one transform declaration and five bound rows
- `readiness/publications/` — one final compatible selected nine-binding release
- `codeops/features/compiler-readiness/` — traceability, execution evidence and roadmap closeout

## Explicit Non-Changes

- No file under `spec/`.
- No compiler-package production import into `@blend65/readiness`.
- No arrays, nested calls, branches, loops or loop-unrolling relations.
- No change to RD-02 configuration, campaign or case identity.
- No eighth publication-v1 member and no inventory-v2 schema.
- No new runtime dependency, service, network or subprocess. Node worker threads are used only for
  deterministic test/harness isolation and bounded execution.

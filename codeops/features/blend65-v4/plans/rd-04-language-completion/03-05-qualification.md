# Qualification: RD-04 Language Completion

> **Document**: 03-05-qualification.md
> **Parent**: [Index](00-index.md)

## Overview

Qualification proves language behavior independently from compiler implementation and separately
proves expert-grade generated output. It reuses Vitest, the public compiler service, ACME 0.97 and
the bounded RD-03 VICE protocol. It is not a readiness service, package, dashboard or game engine
(AR-P6, AR-P7).

## Architecture

### Current Architecture

Focused compiler tests are co-located with source. Root `test/m1/` builds through the public API,
reconciles artifacts, runs sequential VICE cases and compares observed state with an independent
TypeScript oracle and hand-written expert program.

### Proposed Changes

- Keep focused specification and implementation tests beside each owner.
- Add `test/rd04/` only for cross-stage fixtures and qualification.
- Use small deterministic source programs grouped by language family, not one giant program.
- Derive expected values/effects from Specification 4, CPU/profile authority or a direct reference
  model, never from generated assembly.
- Store equal-contract expert sequences or independently derived frontiers with exact costs.
- Run one complete bounded sequential VICE corpus at closeout.

## Implementation Details

### Test Topology

| Evidence | Location | Purpose |
|---|---|---|
| Frontend/semantic specification | `packages/compiler/src/**/*.spec.test.ts` | Immutable rule and diagnostic oracles |
| Internal hardening | `packages/compiler/src/**/*.impl.test.ts` | Algorithms, malformed state and edge handling |
| CLI/LSP boundary | Existing package tests plus root import boundary | Shared diagnostics and dependency direction |
| Completion crosswalk | `test/rd04/normative-coverage.json` and direct spec test | Exact normative ownership/proof set |
| Expressiveness debt | `test/rd04/expressiveness-ledger.json` and direct spec test | Detect a restriction that has become obsolete and route it to the conformance owner (AR-P9) |
| Runtime family fixtures | `test/rd04/fixtures/` | Minimal projects for cross-stage execution |
| Independent oracles | `test/rd04/oracles/` | Values, memory, MMIO, flags, domains and stop boundaries |
| Expert references | `test/rd04/expert/` | Equal-contract assembly/cost expectations |
| ACME/VICE drivers | `test/rd04/` reusing `test/m1/` protocol pieces | Real assembled bytes and C64 runtime state |

### Behavior Oracle

Each family observes every channel its contract makes relevant: result bytes, ordinary memory,
MMIO address/value/count/order, control termination, calls, aggregate contents, stack balance,
flags/decimal/interrupt state and timing only when timing is semantic. Unoptimized-versus-other-path
comparison is supporting evidence only.

### Expert Oracle

Each implemented operation family records equal work, ABI, storage, clobber, effect, profile and
layout assumptions. Local generated output must meet or beat the expert. A meet-only result creates
an actionable GitHub parity-debt issue naming the exact missing improvement; a worse result blocks
the phase (AR-P4). Issue creation is already authorized by project policy; pushing is not.

### Phase and Closeout Gates

Every phase runs focused checks while changing code, then its complete family qualification once.
Repository-wide install/build/typecheck/test runs at integration boundaries and final closeout
(AR-P3). ACME/VICE cases remain sequential and bounded. Missing external evidence is `Unknown`, not
pass. Native Windows execution remains explicitly deferred to RD-10 (AR-P5).

Closeout also performs the mandatory deferral-expiry scan across the plan register, RD Won't Have,
Specification 4 future considerations and expressiveness ledger. An expired rationale receives a
new owned backlog row before closeout.

## Integration Points

| Producer | Consumer | Contract | AR Ref |
|---|---|---|---|
| Frozen spec/RD | Spec tests and behavior oracle | Expected behavior independent of implementation | AR-P1 |
| Compiler artifacts | Expert oracle | Actual bytes/costs/resources under equal contract | AR-P4 |
| Public compiler service | Root fixtures | Same path users invoke; no private bypass | AR-P7 |
| VICE | Runtime evidence | `VICE-verified / hardware-unverified` only | AR-P7 |
| Crosswalk | Closeout | Every key resolves to an owner and decisive proof | AR-P6 |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Required ACME/VICE evidence unavailable | Record `Unknown` and do not close affected phase | AR-P3 |
| Generated and expert contracts differ | Correct the contract before comparing; no ratio claim | AR-P4 |
| Generated output is worse | Fix before phase completion | AR-P4 |
| Generated output only meets | File measured parity debt with path to a win | AR-P4 |
| Native Windows unavailable | Retain explicit RD-10 deferral; do not fabricate a pass | AR-P5 |
| Crosswalk proof path disappears | Fail the completion test | AR-P6 |

## Testing Requirements

- Mutation probes proving behavior oracles fail on wrong values/effect order/flags/aliases.
- Expert-reference schema, equal-contract and complete-cost validation.
- Bounded timeout/protocol/parser failure cases for ACME/VICE subprocesses.
- One family qualification per phase and one complete RD-04 closeout run.
- Frozen `spec/`, touched-file Prettier and whitespace checks at every coherent checkpoint.

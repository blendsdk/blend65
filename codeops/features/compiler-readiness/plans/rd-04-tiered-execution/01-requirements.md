# Requirements: RD-04 Tiered Compiler, ACME and VICE Execution

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-04](../../requirements/RD-04-tiered-execution.md) — the OWNING requirements document

## Scope of this plan (delta view)

### In this plan

- RD-04 Must Have 1–4: closed six-tier registry, content-derived bindings, child execution
  publication and exact composite projection.
- RD-04 Must Have 5–7: deterministic pre-execution planning, independent obligations and distinct
  frontend/compiler/CLI contracts.
- RD-04 Must Have 8–12: exact diagnostics, valid-only envelope, initial-state fixture, safe actual
  observations and selected modeled C64 runtime coverage.
- RD-04 Must Have 13–16: ACME artifacts, crash-recoverable exclusive VICE, closed result taxonomy and
  unavailable-tool blockers.
- RD-04 technical requirements: finite cumulative budgets, streaming bounded output, canonical
  filesystem/process lifecycle and deterministic timeout precedence.
- RD-04 AC-1–AC-12, including local real ACME/VICE proof before the six execution bindings may be
  selected.

### Deferred / out of this plan

- RD-08's remaining 2,103 rule models, generator/oracle expansion and broader stratified population.
- Additional target emulators or non-C64 runtime projections.
- Performance measurement as semantic readiness evidence.
- Any mutation of the existing compiler-readiness publication-v1 member or binding format.
- Any language-specification change; `spec/` remains frozen.
- RD-05 shrinking/promotion and RD-06 release-gate aggregation beyond preserving their blockers.

## Plan-local decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Toolchain composition | New private `@blend65/readiness-execution`; readiness core remains independent | AR-P2 |
| Diagnostic provenance | Additive accepted-diagnostic sidecar and CLI observer injection | AR-P3 |
| VICE reuse | Additive test-harness `./vice-control` subpath | AR-P4 |
| Selector algorithm/caps | Digest-ranked round-robin strata; 16 per rule/obligation, 256 campaign expensive selections | AR-P6 |
| Observation placement | Compiler-allocated globals, label-derived final layout and two-stage identity | AR-P7 |
| Supported recovery host | Linux positive identity; fail closed elsewhere | AR-P11 |
| Coverage/acceptance | 90% branch floors plus mandatory local ACME/VICE publication gate | AR-P13 |

## Plan-local Acceptance Criteria

1. The new composition package creates no reverse workspace import from `@blend65/readiness` and
   does not weaken the existing dependency-boundary test. (AR-P2)
2. Existing `Diagnostic`, renderer JSON, compiler results, CLI output and `ViceDriver` root API
   remain compatible while their additive evidence/control seams are exercised. (AR-P3, AR-P4)
3. Execution publication cannot be prepared or selected until the real-VICE MMIO projection and at
   least one VICE case for each modeled runtime rule have accepted local evidence. (AR-P8, AR-P13)
4. The exact repository verify command, focused coverage, Prettier, publication resolution and
   frozen-`spec/` gates pass at every coherent checkpoint. (AR-P14)

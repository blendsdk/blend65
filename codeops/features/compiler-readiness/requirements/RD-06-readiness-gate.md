# RD-06: Readiness Matrix, Release Gate and Legacy Evidence

> **Document**: RD-06-readiness-gate.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: Compiler Readiness
> **Depends On**: RD-01, RD-02, RD-03, RD-04, RD-05, RD-08
> **CodeOps Artifact Schema**: 1

## Feature Overview

Produce a transparent rule-by-rule readiness matrix and issue the exact claim `C64 v3.0 Ready`
only when every applicable mandatory rule passes all declared evidence obligations. The matrix, not a
single percentage, is the decision surface for compiler recovery.

## Functional Requirements

### Must Have

- [ ] Report every inventory rule as `passing`, `failing`, `unmodeled`, `blocked-errata` or
  `not-applicable-c64`, with target-projected children outside this claim shown separately as
  `out-of-claim-target`, all with links to evidence.
- [ ] Show counts by specification area, evidence tier and failure class.
- [ ] Refuse `C64 v3.0 Ready` unless 100% of `mandatory-c64` rules are modeled and passing, no
  rule is `blocked-errata`, and no campaign contains ICE, assembler-failure or timeout outcomes.
  (AR-10)
- [ ] Treat missing required ACME/VICE execution as incomplete evidence, not pass.
- [ ] Treat any declared-but-unbound generator, oracle or transform and any missing evidence
  obligation as incomplete evidence, not pass.
- [ ] Generate human-readable Markdown and machine-readable JSON from the same result model.
- [ ] Preserve existing examples, goldens, twins and performance budgets as named secondary
  regression/quality sections that cannot affect semantic pass status. (AR-3)
- [ ] Rename aggregate scoreboard “cycles” to an explicit static instruction-cost label before
  linking it from readiness output.
- [ ] Export failing rule IDs and minimal reproducers as input to the compiler recovery roadmap.
- [ ] Qualify every claim with target and specification version; never emit global
  `Compiler Ready`.

### Won't Have

- Weighted averages that allow one mandatory failure to be hidden.
- Readiness claims for Atari, X16, C64 Ultimate or Atari 7800 in this feature.
- Automatic closure of compiler gaps.
- Performance thresholds as readiness pass conditions.

## Technical Requirements

The matrix is a pure projection of validated inventory plus campaign results. Its JSON schema
includes inventory/generator/oracle/compiler versions, target, timestamp, rule results and
evidence references. Generation fails on missing or duplicate rule results.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Claim | Strict `C64 v3.0 Ready` | AR-10 |
| Threshold | 100% applicable mandatory rules | AR-10 |
| Legacy evidence | Secondary only | AR-1, AR-3 |

## Security Considerations

Report links are repository-relative and path-validated. Reports exclude environment values,
absolute paths and arbitrary subprocess output. No network publishing, authentication, sensitive
data, encryption or rate limiting is authorized.

## Acceptance Criteria

1. [ ] One failing, unmodeled or blocked mandatory rule prevents the exact readiness claim.
2. [ ] One ICE, assembler failure or VICE timeout prevents the claim even when all other cases
   pass.
3. [ ] A `not-applicable-c64` rule is excluded only when RD-01 validation accepts its citation.
   An `out-of-claim-target` child is excluded only when its source-linked C64 sibling exists and
   the report names the unevaluated target.
4. [ ] Markdown and JSON contain identical rule IDs, statuses and counts.
5. [ ] Altering a twin byte ratio or static-cost value cannot change any semantic rule status.
6. [ ] The report never emits `Compiler Ready`; the only success claim is `C64 v3.0 Ready`.
7. [ ] Every failing row links a deterministic reproducer or, for infrastructure failure, the
   classified campaign record.
8. [ ] A declared-but-unbound handler or one missing obligation prevents the claim even when all
   available evidence passes.
9. [ ] Each RD-01 readiness-blocking reason (`blocked-errata`, unresolved conflict, unbound handler
   or unbound evidence capability) independently prevents the exact readiness claim.

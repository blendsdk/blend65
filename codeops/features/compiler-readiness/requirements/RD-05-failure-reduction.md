# RD-05: Failure Classification, Shrinking and Regression Promotion

> **Document**: RD-05-failure-reduction.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: Compiler Readiness
> **Depends On**: RD-02, RD-04
> **CodeOps Artifact Schema**: 1

## Feature Overview

Turn generated failures into small, stable and actionable evidence. Minimization must preserve the
target rule, terminal oracle and failure class rather than collapsing semantic failures into
irrelevant parser errors.

## Functional Requirements

### Must Have

- [ ] Classify every non-pass using RD-04's closed failure vocabulary.
- [ ] Shrink valid and type-constrained cases through independent typed-IR transformations that
  preserve rule coverage and well-formedness. (AR-8)
- [ ] Shrink intentionally malformed cases through token/text delta debugging.
- [ ] Re-run the identical terminal tier and failure predicate after every proposed reduction.
- [ ] Record original identity, minimized source, rule IDs, versions, target, seed, case ID,
  failure class and oracle observation.
- [ ] Deduplicate failures by normalized minimized source, rule set, target and failure class.
- [ ] Promote each confirmed unique minimal failure to an immutable specification regression test.
- [ ] Keep bulk generated source ephemeral while persisting deterministic campaign manifests,
  summaries and confirmed minimized regressions. (AR-9)

### Won't Have

- Automatic modification of the compiler or specification.
- Golden approval of the failing compiler output.
- Text-only shrinking for valid semantic cases.

## Technical Requirements

A shrink operation is accepted only if the case remains inside configured budgets, retains every
primary target rule and reproduces the same failure class at the same terminal tier. Promotion
metadata records the originating campaign but the regression expectation derives from the
inventory/oracle contract.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Semantic shrinking | Typed-IR aware | AR-8 |
| Malformed shrinking | Token/text delta debugging | AR-8 |
| Persistent evidence | Minimized regressions and manifests | AR-9 |

## Security Considerations

Failure files use generated allowlisted names beneath a dedicated directory. Normalize and redact
host-specific temporary paths from persisted output. Cap shrink attempts, compiler invocations and
captured diagnostics. Do not persist environment variables, arbitrary host file contents or
subprocess command lines containing secrets.

## Acceptance Criteria

1. [ ] A semantic failure cannot be replaced by a candidate that only produces a parse error.
2. [ ] A malformed-input failure can be minimized to token/text fragments without requiring a
   valid typed IR.
3. [ ] Replaying the persisted identity reproduces the same terminal tier and failure class before
   promotion.
4. [ ] Two campaigns finding the same normalized minimal failure create one promoted regression
   with both campaign identities recorded.
5. [ ] A promoted regression fails when the defect is present and passes only when the
   inventory/oracle expectation is met.
6. [ ] Persisted records contain no absolute temporary path or environment-variable value.

# RD-07: Non-Functional Safety, Determinism and Evolution

> **Document**: RD-07-non-functional.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: Compiler Readiness
> **Depends On**: RD-01, RD-02, RD-03, RD-04, RD-05, RD-06
> **CodeOps Artifact Schema**: 1

## Feature Overview

Define the operational properties that make readiness evidence trustworthy across machines,
versions and long-running compiler recovery. These requirements apply to every preceding RD.

## Functional Requirements

### Must Have

- [ ] Produce identical case source and expected outcome for identical versioned identity.
- [ ] Pin inventory schema, inventory, generator, PRNG, oracle and result schema versions.
- [ ] Detect stale evidence whenever a semantic source, handler, generator or oracle revision
  changes.
- [ ] Preserve replay through compatible upgrades or emit an explicit invalidation record naming
  affected campaigns and regressions. (AR-9)
- [ ] Bound source size, generation attempts, compilation time, subprocess output, shrink attempts
  and emulator execution.
- [ ] Run all non-emulator readiness tiers in CI; require the VICE tier in the release environment
  before the C64 readiness claim.
- [ ] Make campaigns resumable at case boundaries and idempotent by case ID.
- [ ] Validate that critical oracles can fail through controlled mutations.
- [ ] Keep failure metadata portable: repository-relative paths, stable line endings and no host
  secrets.
- [ ] Complete a threat-model review for hostile generated/malformed source and external-tool
  invocation before execution.

### Should Have

- [ ] Parallelize cases that do not share ACME/VICE resources while preserving deterministic
  result ordering.
- [ ] Publish duration and case-count telemetry by terminal tier for capacity planning.

### Won't Have

- Network service availability targets.
- Multi-tenant access control.
- Persistent storage of all generated source.
- Silent evidence migration or invalidation.

## Quality Attributes

| Attribute | Requirement |
|---|---|
| Determinism | Same identity produces byte-identical source, oracle and classification |
| Reliability | Interrupted campaigns resume without duplicate or missing case IDs |
| Performance | Configured campaign completes within explicit per-tier budgets; no semantic shortcuts |
| Maintainability | Rule data, handlers, oracles and runner have enforced dependency boundaries |
| Portability | Persisted metadata contains no host-specific absolute path |
| Observability | Each failure names phase, tier, duration, identity and evidence |

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Evidence lifecycle | Versioned replay or explicit invalidation | AR-9 |
| Runtime resource use | Declared tier and hard bounds | AR-7 |
| Other targets | Future readiness features | AR-10 |

## Security Considerations

All generated content is hostile input. Canonicalize file paths; reject traversal, absolute paths
and symlink escapes; never invoke a shell; pass fixed executable paths and argument arrays; cap
stdout/stderr; kill process groups on timeout; use unique least-privilege temporary directories;
never log environment variables, credentials or arbitrary embedded-file contents. Authentication,
authorization, TLS, encryption at rest and rate limiting are not applicable because no service or
sensitive persisted data is introduced.

## Acceptance Criteria

1. [ ] Two fresh-process replays of a fixed campaign identity produce byte-identical ordered JSON
   results after normalizing the report timestamp.
2. [ ] Changing any semantic source or registered handler revision marks affected evidence stale
   before matrix generation.
3. [ ] Killing a campaign between cases and resuming it produces exactly the same final case-ID set
   as an uninterrupted run, with no duplicates.
4. [ ] Source-size, compile-time, output-size, shrink-attempt and VICE-step limits each have a test
   that reaches the boundary and a test that exceeds it.
5. [ ] Traversal, absolute-path and symlink-escape attempts are rejected before external tool
   invocation.
6. [ ] A timed-out ACME/VICE child and its process group are absent after cleanup.
7. [ ] Controlled mutations demonstrate failing checks for rule mapping, generator rendering,
   interpreter semantics, metamorphic comparison and VICE observation.

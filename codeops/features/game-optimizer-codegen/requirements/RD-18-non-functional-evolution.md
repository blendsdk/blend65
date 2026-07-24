# RD-18: Determinism, Scale, Security and Evolution

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-01–RD-17
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Make the optimizer/code generator safe and durable under large game programs, generated campaigns,
parallel workers, evolving pass/profile schemas and failures. Commercial quality requires
reproducible binaries, bounded compile time/memory, atomic evidence and recoverable upgrades.

## Functional Requirements

### Must Have

- [ ] Produce byte-identical IL, assembly, symbols, binaries, manifests and canonical reports for
  identical complete inputs in fresh processes and supported worker counts.
- [ ] Bound source/IL/graph nodes, candidates/Pareto fronts, pass iterations, proof/search work,
  compile time, memory, subprocess output/time/processes and persisted evidence. (AR-22)
- [ ] Use deterministic scheduling/merge independent of worker completion order.
- [ ] Support cancellation/deadlines with cleanup of temporary files, locks, ACME/VICE processes
  and unpublished artifacts.
- [ ] Publish manifests, profiles, proofs and reports atomically after complete validation.
- [ ] Version every schema/algorithm and use content revisions for semantic implementations.
- [ ] Provide deterministic, idempotent migrations with pre/postconditions, rollback/recovery and
  mixed-version rejection; exact replay or explicit invalidation, never fallback. (AR-21)
- [ ] Canonicalize all file operations beneath allocated roots; reject traversal, absolute and
  symlink escape paths before reads/writes/subprocesses.
- [ ] Invoke tools with argument arrays, allowlisted executables/options and bounded captured output;
  generated source/data never controls shell or host paths.
- [ ] Preserve no secrets, PII, environment variables or host-specific paths in artifacts/logs.
- [ ] Track compile/search/proof duration, memory peaks, fallbacks and capacity saturation.
- [ ] Complete deferral-expiry and external-capability review before feature closeout.

### Should Have

- [ ] Reuse content-addressed immutable analyses/proofs safely across processes.
- [ ] Support resumable scheduled campaigns from validated checkpoints.

### Won't Have

- Network-distributed workers in the first release.
- Best-effort nondeterministic optimization.
- Destructive/irreversible evidence migrations without a separately authorized decision.

## Technical Requirements

Initial hard safety ceilings are frozen below. They are not performance targets: the implementation
plan must measure p50/p95/p99 demand and may lower a ceiling with evidence and a new profile
revision. Raising one requires a resource/security review and a new revision. A run exceeding any
ceiling returns a typed bounded result and the last semantically valid pipeline state; it cannot
publish assurance. (AR-26)

| Resource | Interactive | Release | Campaign |
|---|---:|---:|---:|
| Source bytes per compilation | 8 MiB | 32 MiB | 8 MiB per case |
| Canonical IL instructions | 1,000,000 | 4,000,000 | 1,000,000 per case |
| Overlay graph nodes | 2,000,000 | 8,000,000 | 2,000,000 per case |
| Manifest passes | 128 | 128 | 128 |
| Fixpoint iterations per pass/region | 32 | 64 | 64 |
| Candidate states per optimized region | 16,384 | 65,536 | 65,536 |
| Retained Pareto candidates per region | 32 | 64 | 64 |
| Translation-validation states per region | 100,000 | 1,000,000 | 1,000,000 |
| Wall-clock deadline | 30 s | 600 s | 120 s per case |
| Resident-memory ceiling | 2 GiB | 4 GiB | 2 GiB per worker |
| Captured output per subprocess | 4 MiB | 16 MiB | 16 MiB |
| ACME deadline | 30 s | 60 s | 60 s per case |
| VICE deadline | 60 s | 120 s | 120 s per case |
| Concurrent child processes | 2 | 4 | `min(4, availableProcessors)` |
| Published evidence | 64 MiB | 256 MiB | 1 GiB per campaign |

## Integration Points

- Applies to every preceding RD and provider/tool interaction.
- Uses project CI for emulator-free tiers and a recorded local/release VICE tier.
- Roadmap/traceability consume only atomically published verified evidence.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Reproducibility | Complete-input byte determinism | AR-8, AR-21, AR-22 |
| Evolution | Exact migration/replay or invalidation | AR-21 |
| Parallelism | Bounded workers + deterministic merge | AR-22 |
| Initial ceilings | Exact profile-specific hard limits | AR-26 |

## Security Considerations

This RD owns the cross-cutting threat model: hostile generated input, path/symlink traversal,
command injection, decompression/JSON bombs, resource exhaustion, stale mixed-version evidence and
orphan processes. Authentication, rate limiting, TLS and encryption-at-rest are N/A because no
network/multi-user/sensitive-data service exists.

## Acceptance Criteria

1. [ ] Two fresh complete builds with worker counts 1 and the configured maximum produce
   byte-identical canonical outputs and linked binaries.
2. [ ] Each graph/search/pass/proof/compile/memory/output/process bound has a test that reaches the
   exact limit successfully and rejects limit+1 with a typed bounded result.
3. [ ] Cancellation before/during/after ACME or VICE leaves no child process, lock, checkpoint or
   partial published artifact.
4. [ ] Traversal, absolute path and symlink escape inputs are rejected before any external read,
   write or subprocess.
5. [ ] Argument values containing shell metacharacters are passed literally or rejected; no shell
   is invoked.
6. [ ] Parallel result merge is byte-identical under reversed/delayed worker completion.
7. [ ] A simulated publication crash leaves the prior complete version selected.
8. [ ] Every migration is idempotent, validates pre/postconditions and either rolls back cleanly or
   records an explicit irreversible boundary authorized outside this RD.
9. [ ] Missing exact historical revisions produce explicit invalidation/incompatibility and never
   current-version replay.
10. [ ] Artifacts/logs contain no absolute temp paths, environment values, credentials or
    unbounded subprocess output.
11. [ ] The largest game-shaped fixture stays within frozen compile-time/memory budgets without an
    unreported optimizer fallback.
12. [ ] Closeout answers the mandatory deferral-expiry question and leaves every external
    capability dependency owned.
13. [ ] Lowering a ceiling preserves all in-budget outputs byte-for-byte; raising one is rejected
    without a new profile revision and recorded resource/security review.
14. [ ] At 75% of any ceiling the run emits one structured capacity warning naming the resource,
    observed amount, ceiling and profile; it emits no duplicate warning for that resource.

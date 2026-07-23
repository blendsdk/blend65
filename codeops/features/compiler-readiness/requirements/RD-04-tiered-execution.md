# RD-04: Tiered Compiler, ACME and VICE Execution

> **Document**: RD-04-tiered-execution.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: Compiler Readiness
> **Depends On**: RD-02, RD-03
> **CodeOps Artifact Schema**: 1

## Feature Overview

Run each generated case through the cheapest tier that can decisively observe its normative
outcome. Runtime-semantic rules must reach real assembled C64 execution; invalid diagnostic cases
must prove both the diagnostic and absence of executable output.

## Functional Requirements

### Must Have

- [ ] Support terminal tiers `frontend`, `emit`, `acme` and `vice`. (AR-7)
- [ ] Execute every case through all prerequisite tiers up to its declared terminal tier.
- [ ] Require diagnostic cases to match expected code/severity and prove no executable is emitted.
- [ ] Require `acme` cases to assemble successfully and expose required labels/artifacts.
- [ ] Require runtime-semantic rules to include bounded generated cases that reach ACME and VICE,
  regardless of cheaper-tier success.
- [ ] Encode expected results into a reserved ordinary-RAM observation region independent of C64
  MMIO side effects whenever the rule permits.
- [ ] Classify compiler diagnostic mismatch, ICE, emission failure, assembler failure, emulator
  launch failure, timeout and semantic mismatch separately.
- [ ] Make missing ACME/VICE an unavailable-tier result that blocks the relevant readiness gate,
  never a pass.

### Won't Have

- Heuristic escalation only after failure.
- VICE execution for every frontend-only invalid case.
- Performance measurement in the semantic readiness result.
- Additional platform emulators in this first target-scoped feature. (AR-10)

## Technical Requirements

Every execution receives a unique canonical temporary directory. Subprocess arguments are arrays,
not interpolated shell strings. VICE runs with a deterministic setup, instruction/cycle/time
budgets, declared completion observation and cleanup that removes breakpoints/processes on all
outcomes.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Terminal tier | Declared per rule | AR-7 |
| First runtime target | C64 through VICE | AR-10 |
| Performance | Excluded from semantic gate | AR-3 |

## Security Considerations

Canonicalize paths beneath the allocated temporary root, reject traversal and absolute generated
paths, pass subprocess arguments without shell evaluation, cap output capture, terminate timed-out
processes and never permit generated source to choose host paths. No authentication, secrets,
network service, encryption or rate limiting applies.

## Acceptance Criteria

1. [ ] A frontend-terminal case invokes neither ACME nor VICE; an ACME-terminal case invokes ACME
   but not VICE; a VICE-terminal case invokes both in order.
2. [ ] Every runtime-semantic inventory rule has at least one generated case whose recorded
   terminal tier is `vice`.
3. [ ] A diagnostic match with emitted executable output fails as `unexpected-emission`.
4. [ ] Deliberate compiler throw, invalid assembly, missing VICE executable, never-reached
   completion marker and wrong memory byte produce five distinct result classes.
5. [ ] VICE timeout leaves no process or monitor checkpoint running.
6. [ ] A generated path containing `..` or an absolute prefix is rejected before any file or
   subprocess operation.

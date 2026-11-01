# Requirements: Full RD-08 Optimizer

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-08](../../requirements/RD-08-optimization-and-expert-output.md) — the owning requirements document

## Scope of this plan (delta view)

### In this plan

- RD-08 R8.1–R8.12: four modes, `none` preservation, hard constraints, complete B/R/T, deterministic selection, explanations.
- RD-08 R8.13–R8.24: target-neutral and whole-program transformations, including constants, reachability, values, memory, conditions, calls, aggregates, loops, addresses and arithmetic.
- RD-08 R8.25–R8.38: NMOS 6510 machine optimization, register/flag reuse, zero-page opportunity cost, address forms, fixed loops, raw/volatile rules, callbacks/interrupt state and a bounded frontier.
- RD-08 R8.39–R8.58: closure/publication/final observers, finite resource closure, architecture/provenance, cost/debug evidence, assets/load units and expert comparison.
- The saved 725/then acquisition 963 optimization milestones.
- Size-first qualification, then balanced/speed on the same pipeline.
- Existing final-observer, SFA, platform, ACME and VICE authorities.

### Deferred / out of this plan

- RD-05 keyboard/correctness implementation and every non-RD-08 feature task. Those belong to the separate correctness track.
- Public `size` release claims until the milestones pass.
- New language syntax, source restrictions, game policy, runtime, dependency, loader/D64 expansion or frozen-spec/expert changes.
- Deleting or weakening 963/725 tests, behavior oracles or security permissions.

The RD owns the detailed requirements. This plan owns implementation sequencing,
the saved/acquisition milestones and the two-track release boundary.

## Plan-local decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Optimizer architecture | Shared immutable facts + ordered machine rules inside the lowering producer | AR-003 |
| Proof model | Per-rule obligations; untouched code keeps canonical fallback/proof | AR-007 |
| Mode sequence | Size first; balanced/speed after measured size stability | AR-004 |
| Milestones | Foundation → saved 725 → acquisition 963 | AR-005 |
| Release boundary | `none` ships independently; `size` experimental until qualified | AR-002 |
| Limits | 963/725 remain unchanged optimizer targets | AR-002, AR-005 |
| New modules | Bounded facts/rules/cost modules and adjacent tests | AR-006 |
| Verification | Full build/typecheck/test + targeted specs + sequential VICE | AR-011 |
| Native claim | VICE-verified / hardware-unverified | AR-015 |
| Planning edits | New plan documents only | AR-016 |

## Acceptance Criteria

1. `none` artifacts and behavior remain unchanged by this plan.
2. The foundation phase proves facts, rule obligations, provenance and B/R/T evidence without benchmark-specific rules.
3. Saved-query output passes the unchanged 725/745/14/759/5 limits and its behavior/native suites.
4. Acquisition/library output passes the unchanged 963/984/14/998/10 limits and its behavior/native suites.
5. `balanced` and `speed` are implemented and qualified only after size stability, on the same complete B/R/T pipeline.
6. All specification tests, implementation tests, ownership tests and sequential VICE cases pass.
7. Every selected/rejected candidate has exact evidence; no unknown is treated as zero, a win or a stable-ID tie.
8. If a milestone cannot approach its target after its measured tranche, the plan stops and returns to the user; no limit or oracle is weakened.

# RD-14: Translation Validation and Optimizer Assurance

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-03–RD-13
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Prove each transform locally and the complete compiler end to end. Combine pass-contract tests,
bounded translation validation, generated independent semantics, ACME/VICE execution, mutation
testing, exact replay and reduction. No single oracle may approve its own implementation.

## Functional Requirements

### Must Have

- [ ] Derive immutable specification tests for each pass precondition, rewrite, non-match and
  failure contract before implementing the pass. (AR-17)
- [ ] Validate before/after overlay/IL/instruction semantics with an independent bounded evaluator
  or symbolic/exhaustive checker where the declared subset supports it.
- [ ] Run the same generated case through reference, isolated, prefix and full profiles and compare
  each to the RD-03 independent oracle. (AR-18)
- [ ] Require runtime-semantic and timing obligations to assemble with ACME and execute on bounded
  VICE routes.
- [ ] Treat unsupported oracle/effect/proof forms as explicit `unmodeled`/`proof-incomplete`, never
  pass.
- [ ] Classify wrong result, wrong diagnostics, ICE, invalid IL/instruction, assembler failure,
  VICE failure, timeout, cost regression and timing failure separately.
- [ ] Seed mandatory semantic mutations for preconditions, flags, overflow, aliasing, barriers,
  successors, calls, allocation and target legality; require 100% kill for default enablement.
- [ ] Replay an exact execution identity; missing revisions fail incompatible with no fallback.
- [ ] Shrink valid cases through typed IR/IL transforms and reduce the pass set while preserving the
  terminal tier and predicate.
- [ ] Promote every confirmed unique minimal failure to an immutable specification regression.
- [ ] Require independent semantics and performance review before pass assurance/default enablement.

### Should Have

- [ ] Cache proof/evaluation results by complete content identity.
- [ ] Emit bounded human-readable counterexamples including entry state and first divergence.

### Won't Have

- Optimized-versus-unoptimized agreement as absolute semantic proof.
- Golden approval of wrong compiler behavior.
- Waiving a semantic gap because a pass improves performance.

## Technical Requirements

Each profile uses one generated `CaseIdentity` and a separate `ExecutionIdentity`. Reducers preserve
rule IDs, definedness, target, failing profile, terminal route and failure class. Campaigns use
closed schemas, canonical roots and deterministic aggregation.

## Integration Points

- Consumes compiler-readiness generator/oracle/execution/reducer contracts.
- Supplies assurance evidence to RD-03 lifecycle and RD-15 commercial gate.
- Uses asm-parity only for cost results, not semantic expectations.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Assurance | Layered local + independent end-to-end | AR-5, AR-17 |
| Profiles | Reference/isolated/prefix/full | AR-18 |
| Failure action | Replay, reduce, promote | AR-17, AR-18 |

## Security Considerations

Generated/replay inputs are closed and bounded; paths reject absolute/traversal values. ACME/VICE
arguments are arrays, output/time/memory/process counts are capped, and cleanup terminates process
groups on every outcome. Artifacts redact host paths/environment.

## Acceptance Criteria

1. [ ] A seeded wrong arithmetic, flag, alias, barrier, branch-target, allocation and CPU-legality
   mutation is killed by at least one immutable specification/translation/target test.
2. [ ] Mandatory semantic mutation score is exactly 100% before an assured/default-enabled state.
3. [ ] Reference, isolated and full profiles for a valid generated case all equal the independent
   expected state; a seeded candidate mismatch names the failing profile/pass.
4. [ ] Prefix bisection and pass-set reduction isolate a seeded pass interaction and reproduce it
   from a fresh process.
5. [ ] An unsupported proof/oracle case is visible and cannot count toward coverage or acceptance.
6. [ ] Runtime-semantic cases reach ACME then VICE; missing tools are unavailable/blocking, not
   passing.
7. [ ] Shrinking cannot replace a semantic mismatch with a parse error, timeout or different tier.
8. [ ] Two campaigns finding the same normalized failure create one promoted regression with both
   identities.
9. [ ] Missing exact compiler/pass/profile/tool revisions return a typed incompatibility and never
   invoke current code.
10. [ ] Independent semantics and performance reviews report zero unresolved critical/major
    findings before assurance.

# Requirements: RD-08 Complete C64 Rule Coverage

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-08](../../requirements/RD-08-complete-c64-rule-coverage.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan

- RD-08 complete 2,112-ID terminal disposition and exact per-rule result.
- RD-08 minimum typed IR, rendering, independent expectations and relations for arrays, calls,
  branches and bounded loops first. (AR-1, AR-2)
- RD-08 reviewed family data, source-generated routes and named non-source evidence.
- RD-08 declared frontend/compiler/CLI/emit/ACME/VICE evidence routes using existing execution
  contracts.
- RD-08 additive publication evolution, historical v1 replay and fail-closed separate-pointer
  selection. (AR-5)
- RD-08 bounded smoke, explicit exhaustive tiers, defect ownership and deferral-expiry closeout.
  (AR-6, AR-7)

### Deferred / out of this plan

- Compiler, platform-library or optimizer fixes discovered by generated evidence.
- Optimizer reference/isolated/prefix/full profiles, cost truth and expert-parity scoring.
- Full RD-05 Phase 4–5 or RD-07 execution; only their already-authorized local contracts apply.
- New readiness-execution runners, workspaces, process controllers, publication selectors or
  generalized failure infrastructure.
- Non-C64 claims, new language semantics, changes under `spec/`, or new dependencies. (AR-1, AR-8)

## Plan-local decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| First phase | Generated arrays/calls/branches/loops plus independent semantics | AR-2 |
| Initial population | Exact ST-owned ID list, no category inference | AR-3 |
| File boundaries | Central union delta plus focused companions | AR-4 |
| Changed selection | After local evolution proof, through existing pointers | AR-5 |
| Remaining sequence | Families → routes → publication/closeout | AR-6 |
| Verification | Exact project verify; exhaustive/VICE remain explicit | AR-7 |

## Acceptance Criteria

1. [ ] Phase 1 produces real rendered Blend programs and independent state expectations for all
   four required construct families before denominator-wide work begins.
2. [ ] The implementation adds no generalized framework, dependency, optimizer profile, compiler
   fix or readiness-execution infrastructure.
3. [ ] Every phase keeps normal `yarn test` within the RD smoke ceilings and leaves exhaustive/
   production VICE routes explicit.

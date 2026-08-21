# Component Design: Orchestration and Acceptance

> **Document**: 03-07-orchestration-acceptance.md
> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P1, AR-P5, AR-P9, AR-P13

## Responsibility

Join selected authority, precomputed routes, real adapters and independent expectations into a
replayable campaign result. Preserve every blocker outside the executed modeled population.

## Entry point

`executeReadinessCampaign` accepts opaque selected parent/execution/oracle contexts, a prepared
campaign, target, selector revision, policy and an explicit environment capability probe. It first
derives and serializes the complete `ExecutionRoutePlanV1`; only then may it create a case workspace
or call an adapter.

For each planned selection it builds a valid-only envelope when required, executes prerequisite
stages in order, captures the actual diagnostic/value/effect, and asks the selected RD-03 evaluator
to compare actual evidence against the host-side expectation. Results are sorted by stable plan
order and serialized canonically with identities, terminal tier, stage/code, cumulative usage and
bounded evidence digests.

## Campaign outcome

The summary reports independently for every rule/obligation:

- selected and terminal case identities;
- pass/failure and stable primary result code;
- unavailable execution capabilities;
- remaining unmodeled, not-generatable, oracle-unmodeled and capability-unbound blockers;
- local-authority proof status for ACME/VICE-dependent bindings.

Cheaper success cannot satisfy an unexecuted expensive obligation. Missing tools are visible
`tier-unavailable` blockers, never skipped tests or passes. RD-04 completion therefore establishes
execution for its selected modeled population but does not claim the RD-06 release gate.

## Publication acceptance

The six-route candidate can be reviewed and selected only after:

1. every immutable specification and CI-safe implementation test passes;
2. readiness and readiness-execution each meet a 90% branch floor;
3. the exact repository verification command passes;
4. local real ACME/VICE proof passes for the projection and all four current runtime rules;
5. semantic, correctness, security and performance review findings are resolved under project
   policy; and
6. candidate resolution clears exactly six parent blockers against the exact nine-binding digest.

The workspace exposes a documented local execution command through the new package/root script,
but CI does not pretend to provide emulator authority. Reports must state tool versions and evidence
digests without embedding machine-specific temporary paths.

## Closeout

At completion, update the feature roadmap and closeout evidence. Before marking RD-04 complete,
walk ambiguity registers, Won't Have clauses and `spec/future-considerations.md` and answer whether
any deliverable expired a deferral rationale. Reopen every expired restriction as an owned backlog
or expressiveness-ledger row; no future-slice owner may become orphaned.

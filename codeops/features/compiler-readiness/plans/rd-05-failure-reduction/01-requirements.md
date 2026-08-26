# Requirements: RD-05 Failure Reduction

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-05](../../requirements/RD-05-failure-reduction.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan

- Every RD-05 Must Have requirement and acceptance criterion, including the complete
  code/tier/stage disposition matrix and separate cleanup classification.
- Typed-valid, typed-invalid, and raw-malformed reduction with exact family invariants and a
  deterministic non-empty V1 catalog.
- Durable historical failure envelopes and every run/summary outcome, truthful reusable
  reduction-candidate authority with single-use invocation tokens, same-route execution, fresh
  confirmation, and stateful-sequence classification.
- Immutable cores, provenance events, activation markers, secure publication, deduplication, and an
  activation-rooted specification regression tier.
- Compatibility-safe refresh of the selected RD-04 execution publication when participating bytes
  change. (AR-P13)

### Deferred / out of this plan

- Compiler defect fixes and any automatic compiler or frozen-spec modification remain excluded by
  RD-05.
- RD-06 readiness-matrix and release-gate behavior remains owned by RD-06.
- RD-07 packaging or migration remains owned by RD-07; this plan only preserves its verified-input
  seam.
- Optional command grammars, UI, network service, external storage, and non-C64 product expansion
  are absent under strict scope.
- Activation of a currently failing candidate is performed by the separately owned compiler-fix
  plan through the two-checkpoint protocol, not by RD-05 implementation. (AR-P14)

## Plan-local decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Component ownership | Existing readiness/readiness-execution dependency direction | AR-P1 |
| Reduction control | Pure readiness state machine driven by execution orchestration | AR-P1, AR-P4 |
| Regression discovery | Activation-rooted tracked graph read by one fail-closed spec runner | AR-P8 |
| Quality floor | Checked exact source lists with per-file ≥90% new-core branch coverage plus exact full verify | AR-P10, AR-P12 |
| Publication invalidation | Refresh and reselect the genuine execution child at closeout | AR-P13 |

## Acceptance Criteria

The RD owns all behavioral acceptance criteria. Plan-local completion additionally requires:

1. [ ] Every RD-05 acceptance criterion maps to at least one concrete ST case in
   `07-testing-strategy.md`.
2. [ ] Every module in the checked RD-05 source-owner lists retains at least 90% per-file branch
   coverage and the ownership freshness guards pass.
3. [ ] The unchanged RD-04 V1 report remains readable and byte-compatible.
4. [ ] The final selected execution child resolves the exact reviewed post-RD-05 handler bytes.
5. [ ] The exact project verification command passes and `spec/` remains untouched.

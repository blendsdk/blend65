# Requirements: RD-04 Language Completion

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-04](../../requirements/RD-04-complete-language-correct-unoptimized-compiler.md) — the OWNING requirements document

## Scope of this plan (delta view)

### In this plan

- RD-04 R4.1–R4.54: every Must Have requirement.
- RD-04 R4.55–R4.57: all three Should Have requirements.
- RD-04 AC-01–AC-42 on Linux, ACME 0.97 and VICE 3.10 where applicable.
- The smallest checked completion crosswalk required by R4.2 (AR-P6).
- Focused specification, implementation, ACME, VICE and expert-reference evidence (AR-P7).

### Deferred / out of this plan

- Native Node 22 Windows x64 execution evidence is deferred to RD-10 (AR-P5). The implementation
  and deterministic host-independent cases remain in this plan.
- Every capability assigned by RD-04 to RD-05 through RD-09 remains with that RD (AR-P1).
- Optional optimization, a pass framework, a generic runtime, a software stack, new packages,
  broad game infrastructure and readiness machinery are excluded (AR-P1, AR-P4, AR-P8).

## Plan-local decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Plan partition | One plan with nine vertical phases | AR-P2 |
| Verification | Focused checks per task; full repository boundary at integration points | AR-P3 |
| Expert-output rule | Independent qualification gates `none`; no parity search inside the compiler | AR-P4 |
| Windows status | Preserve missing native evidence explicitly until RD-10 | AR-P5 |
| Completion accounting | One static JSON crosswalk plus one direct validator test | AR-P6 |
| Test placement | Co-located focused tests; root-only cross-stage qualification | AR-P7 |
| Source growth | Existing pipeline and responsibility-based splits only when touched | AR-P8 |
| Expressiveness debt | V4 ledger and expiry gate in the approved root test area; conformance feature owns follow-up | AR-P9 |

## Acceptance Criteria

1. [ ] Every RD-04 acceptance criterion has decisive proof referenced by the checked crosswalk.
2. [ ] Every phase closes with its focused family qualification and no unresolved major finding.
3. [ ] Linux closeout records native Windows execution as the only host deferral, owned by RD-10.

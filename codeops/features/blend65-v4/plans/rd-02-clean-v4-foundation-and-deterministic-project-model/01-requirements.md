# Requirements: RD-02 Foundation

> **Parent**: [Index](00-index.md)
> **Source**: [RD-02](../../requirements/RD-02-clean-v4-foundation-and-deterministic-project-model.md) — owning requirements document

## Scope of This Plan

| Included | Requirement references |
|---|---|
| Safe worktree transition and independently proven salvage | R2.1–R2.6, R2.29 |
| Minimal real toolchain and durable direct import boundary | R2.7–R2.13 |
| One manifest, exact identities, contained project loading | R2.14–R2.24 |
| No publication; independent focused proof and observational baseline | R2.25–R2.28 |
| One minimal project fixture | R2.30 |

All RD-02 acceptance criteria are in scope, with the user-approved AC-15 correction
recorded in AR-P2. Nothing is silently deferred. The owning RD's Won't Have section
continues to exclude the compiler pipeline and artifact publication.

## Plan-Local Decisions

Refer to AR-P3–AR-P7 in [the register](00-ambiguity-register.md).
Component specifications own their implementation details; this document does not
copy the RD, decision rows, or test expectations.

## Acceptance

RD-02 AC-01–AC-29 govern closeout. Newly authored spec tests remain immutable;
inventory-approved removal of obsolete v3 test files is not permission to weaken
the new oracles. Native Windows evidence is required, not inferred from Linux
path simulations. No additional timing, coverage-percentage, or scale gate is added.

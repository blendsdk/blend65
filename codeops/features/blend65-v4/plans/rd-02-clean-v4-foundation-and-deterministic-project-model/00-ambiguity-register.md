# Ambiguity Register: RD-02 Foundation Planning

> **Status**: ❌ GATE BLOCKED — scope confirmation and one upstream correction await a decision; discovery is incomplete
> **Last Updated**: 2026-09-17
> **CodeOps Artifact Schema**: 1

## Planning Boundaries

| Boundary | Proposed scope |
|---|---|
| Planning target | `blend65-v4/RD-02` only: clean foundation and deterministic project loading, not a compiler pipeline. |
| Context artifacts | Phase 0 handoff; RD-01 closeout and frozen identities; v4 requirements and preflight report; inherited manifests, source, tests, scripts, workflows, documentation, and historical roadmaps as salvage evidence only. |
| Modification set | This RD-02 plan directory and required feature-roadmap lifecycle rows. No implementation, specification, active expert, or parked-worktree changes. The narrow RD-02 correction below needs separate confirmation before changing the requirement. |

## Decisions

| ID | Category | Question | Recommendation | Authority | Status |
|---|---|---|---|---|---|
| AR-P1 | Scope | Confirm the planning target and modification boundary. | Plan only RD-02 from its accepted requirements. Preserve the frozen spec and expert. Keep compiler, packaging, emulator, and future infrastructure work out. | Awaiting user confirmation. | ❌ Open |
| AR-P2 | Scope / upstream correction | AC-15 requires output creation and artifact-publication tests despite the explicit exclusion of publication from RD-02. | Correct RD-02 only: validate missing contained `outDir` without creating it; test the pure basename validator and input containment here; leave native artifact creation, collision/alias, and publication proof with RD-03 and subsequent artifact-producing owners. Align the Paths verification-table row. Preserve R2.25 as a later-producer contract, not an RD-02 implementation task. | Awaiting explicit authorization to edit this requirement. | ❌ Open |

## Evidence and Resolution Notes

### AR-P1 — Startup checks

The worktree is clean on `feature/v4-rebuild` at
`5deb2a5341bea00cf6050a0aba4668315198d91a`. It descends from the Phase 0 base
`4c2f27f54273a713c0bbf398bf6c56be45f4aae3`. The parked v3 worktree remains clean at
that recorded base. RD-01 is Done; RD-02 has no implementation plan yet.

### AR-P2 — Why the correction is necessary

[RD-02](../../requirements/RD-02-clean-v4-foundation-and-deterministic-project-model.md)
R2.17 permits output-directory creation only during publication. R2.25 supplies a pure
basename validator here and explicitly assigns actual artifact creation to later
artifact-producing RDs. The Won't Have section excludes compiler artifact publication.
AC-15 nevertheless asks RD-02 to prove first-build directory creation and native
artifact creation/collision behavior. Its Paths verification-table row repeats that
premature artifact proof.

[RD-03](../../requirements/RD-03-playable-m1-complete-pipeline.md), Artifact publication,
already owns selected-profile artifact components, native alias/limit rejection,
exclusive creation, staging, and preservation of the prior generation. No new subsystem,
test framework, or sibling-RD redesign is needed. Planning those operations in RD-02
would either violate its scope or create premature publication support code. The narrow
correction removes that conflict without weakening the later publication contract.

Discovery and the complete ambiguity scan resume after the scope decision. No other
plan document is authorized while this gate is blocked.

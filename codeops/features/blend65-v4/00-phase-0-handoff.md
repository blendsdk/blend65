# Blend65 v4 Phase 0 Bootstrap and Session Handoff

> **Status**: Complete
> **Recorded**: 2026-09-11
> **Next Lifecycle Action**: Create the RD-01 implementation plan
> **CodeOps Artifact Schema**: 1

## Purpose

This is the durable handoff for starting a new Codex session in the Blend65 v4 worktree. Phase 0
created the approved sibling worktree without changing the parked v3 checkout. It also verified the
existing nested CodeOps layout and removed obsolete workflow-state graphs through the official
CodeOps migration.

Phase 0 does not design or implement compiler architecture. RD-01 must first freeze Specification
4.0 and the qualified expert baseline 2.0.0. RD-02 then inventories the inherited v3 tree and creates
the smallest real, buildable TypeScript 7 project skeleton. This ordering prevents inherited v3
packages, tests, or pass boundaries from becoming accidental v4 architecture.

## Exact Bootstrap Identity

| Role | Path / identity | Recorded state |
|---|---|---|
| Parked v3 evidence worktree | `/home/gevik/workdir/github/blend65.ri/blend65-asm-parity` | Branch `feature/domain-expert-skill`; clean at `4c2f27f54273a713c0bbf398bf6c56be45f4aae3` after bootstrap |
| Recorded final v3 repository source | `4c2f27f54273a713c0bbf398bf6c56be45f4aae3` | Exact base commit for `feature/v4-rebuild` |
| V4 working directory | `/home/gevik/workdir/github/blend65.ri/v4` | Git worktree on `feature/v4-rebuild` |
| V4 branch base | `4c2f27f54273a713c0bbf398bf6c56be45f4aae3` | Ancestry verified with `git merge-base --is-ancestor` |
| CodeOps migration checkpoint | `52da1c4aff6a2938a384cbd06ebbfa321c231936` | Legacy plan ownership migrated; obsolete graphs removed |
| Integration branch | `master` | Portfolio cascade waits until v4 work lands on the integration branch |

Do not reset, relocate, delete, or repurpose either worktree. Read v3 only as evidence. All RD-01
and later v4 planning, authority changes, implementation, verification, and commits happen from
`/home/gevik/workdir/github/blend65.ri/v4`.

## Starting State

| Boundary | State |
|---|---|
| Requirements | Preflight PASS; PF-001 through PF-029 resolved; AR-001 through AR-048 resolved |
| Roadmap | RD-01 through RD-10 are `RD Preflighted`; 0 of 10 implemented |
| CodeOps | Nested layout active; strict quality policy present; legacy `traceability.json` files removed |
| Specification | `spec/` is still the frozen Specification 3.0 input authority; RD-01 alone creates and activates Specification 4.0 |
| Expert skill | Single active `blend65-domain-expert` version 1.0.0, qualified content commit `a96cfd3c41a456d4d4f983021cf43535a1d5bdaa` |
| V4 compiler skeleton | Not created yet; RD-02 owns it after RD-01 closes |
| Inherited v3 files | Reference and salvage candidates only; no package, test, pass, or status is v4 authority |

## New Session Startup

Start the next Codex session with the working directory set to:

```text
/home/gevik/workdir/github/blend65.ri/v4
```

Then have Codex read these files before taking action:

1. `AGENTS.md`
2. `codeops/features/blend65-v4/00-phase-0-handoff.md`
3. `codeops/features/blend65-v4/00-roadmap.md`
4. `codeops/features/blend65-v4/requirements/README.md`
5. `codeops/features/blend65-v4/requirements/RD-01-specification-4-and-expert-authority-freeze.md`
6. `.agents/skills/blend65-domain-expert/SKILL.md` and only the references routed for RD-01

Before writing, verify:

```bash
pwd
git branch --show-current
git status --short
git worktree list --porcelain
git merge-base --is-ancestor 4c2f27f54273a713c0bbf398bf6c56be45f4aae3 HEAD
```

The expected directory is `/home/gevik/workdir/github/blend65.ri/v4`, the expected branch is
`feature/v4-rebuild`, the worktree must be clean, and the ancestry command must succeed.

## Next Authorized Work

Use `codeops:make-plan` to create the implementation plan for
`blend65-v4/RD-01`. The plan must implement RD-01 only: reconcile and activate Specification 4.0,
upgrade and qualify the one active expert skill as version 2.0.0, and record both frozen identities.
Run a plan preflight before execution.

Do not create the TypeScript monorepo or compiler packages during RD-01. After RD-01 closes, create
and preflight the RD-02 plan. RD-02 must inventory v3 before deciding what to retain, remove rejected
v3 surfaces from the v4 branch, and land the first minimal buildable project skeleton. It must not
copy the twelve-package v3 topology or create empty future-facing packages.

## Handoff Prompt

The user can start the next session with:

> Work only from `/home/gevik/workdir/github/blend65.ri/v4`. Read `AGENTS.md` and
> `codeops/features/blend65-v4/00-phase-0-handoff.md` completely. Verify the Phase 0 identities,
> then use the Blend65 domain-expert and CodeOps make-plan skills to create the RD-01 implementation
> plan. Do not modify the parked v3 worktree and do not start RD-02 implementation.

## Phase 0 Verification

- The v4 branch descends from the recorded base commit.
- The parked v3 evidence worktree remained clean and at the recorded commit.
- CodeOps plan ownership verification completed with no reported mapping problem.
- The three obsolete workflow-state graphs were removed; Markdown plan state is now authoritative.
- Markdown formatting and diff checks passed for the migration and this handoff.
- No compiler, ACME, VICE, readiness, or feasibility test ran because Phase 0 changed workspace and
  workflow metadata only.
- Nothing was pushed.

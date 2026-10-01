# Execution plan: VIC-II collision reads

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-01 07:08
> **Progress**: 0/10 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---|
| 1 | Two consuming hardware reads | 10 |

The phase checklist is the sole task-progress authority. Update after every task:
mark implemented work `[~]` with a real timestamp, then verified work `[x]` with completion
timestamp. Only `[x]` counts; update Progress and Last Updated immediately. Resume the first
`[~]`, otherwise the first `[ ]`. Mark blockers `[!]` with `Blocked: reason` on that line.
Commits use the git-commit skill at coherent green checkpoints. Push is never automatic.
Effort handoffs follow AGENTS.md; planning approval is not a batch execution waiver.

## Phase 1: Two consuming hardware reads

**Phase baseline tree:** Record at execution start using the exec-plan skill.
**Lenses:** Compiler/language semantics, volatile hardware effects and expert output cost.
**Reference:** [Component contract](03-collision-reads.md), AR-P1–AR-P4.

### Session 1.1: Specification tests

- [ ] 1.1.1 [spec-author] Write `test/rd05/vic-collision-api.spec.test.ts` and `vic-collision-output.spec.test.ts` from ST-1–ST-5/ST-10.
- [ ] 1.1.2 [spec-author] Write `test/rd05/vic-collision-vice.spec.test.ts` from ST-6–ST-9 using existing bounded VICE utilities.
- [ ] 1.1.3 Verify directed RED for the three new spec files; record failed missing-capability cases and justify any already-green cases in this plan.

**Verify:** Directed Vitest runs for the named files, with VICE sequential. RED must demonstrate
the missing capability, not broken setup, missing tools or a timeout.

### Session 1.2: Implementation

- [ ] 1.2.1 Add AR-P2 declarations and named device facts in `packages/compiler/src/frontend/profile.ts` and `target/c64-kernal.ts`; verify source/API cases.
- [ ] 1.2.2 Apply only AR-P3's approved edits to `packages/compiler/src/frontend/profile.spec.test.ts` and `profile-constants.spec.test.ts`; verify both inventories.
- [ ] 1.2.3 Add direct lowering in `packages/compiler/src/machine/lower-c64.ts` per the component contract; preserve existing result retention and effects without a new representation. Verify output cases.
- [ ] 1.2.4 Verify directed GREEN for ST-1–ST-10 and the two inventory tests; inspect assembled bytes/cost and sequential runtime observations. Fix implementation, not new oracles.

**Verify:** Directed Vitest runs for new specification files and both inventories; existing
compiler build when fresh public declarations are needed. Do not commit a partially green tree.

### Session 1.3: Implementation tests and hardening

- [ ] 1.3.1 Write `packages/compiler/src/machine/vic-collision.impl.test.ts` for internal result retention and instruction selection. Per approved PF-001, update only `frontend/profile-constants.impl.test.ts` binding total 60→62 and both operation/constant boundaries 35→37, preserving all identity, immutability and fresh-state assertions. Verify both implementation-test files directly; specification expectations remain unchanged.
- [ ] 1.3.2 Run the full AR-P4 checkpoint: `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`; check touched-file formatting, local links and frozen `spec/`/expert authority. Obtain required independent phase review and resolve blocking findings.
- [ ] 1.3.3 Write `08-closeout.md` with bounded behavior/output/runtime evidence, measured expert comparison and deferral-expiry answer; update the feature roadmap without claiming RD-05 complete. Update maintained API docs through techdocs where applicable; commit the green checkpoint through git-commit.

**Verify:** AR-P4 full checkpoint, review clearance, document/link checks and frozen-authority
checks. Documentation-only closeout edits use impact-based validation, not a redundant full run.

## Dependencies and success

Tasks run in listed order. Session 1.2 depends on valid RED; Session 1.3 depends on GREEN.
No other RD or unavailable Windows host is an execution dependency for this slice.
Success requires all ten tasks verified, independent review clear and no hidden runtime cost.
R5.27 remains subject to the recorded evidence boundary; other RD-05 obligations remain open.
If a new semantic ambiguity or material support mechanism is discovered, stop and record it
in the register before implementation. This plan does not authorize additional machinery.

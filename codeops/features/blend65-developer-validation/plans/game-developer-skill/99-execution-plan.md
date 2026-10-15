# Execution Plan: Game-Developer Skill First

> **Parent**: [Index](00-index.md)
> **Status**: Ready after plan preflight; not started
> **Last Updated**: 2026-10-16 01:16 CEST
> **Progress**: 0/20 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement only the [requirements delta](01-requirements.md). The component owns
interfaces/protocols; the testing strategy owns ST answers; the register owns
decisions. This checklist alone owns task progress. No task here implements
Slither, changes a compiler owner or closes RD-01. AR-S1, AR-S11.

## Implementation Phases

| Phase | Title | Tasks |
| --- | --- | ---: |
| 1 | Independent expectations, isolated authoring and bounded qualification | 20 |

The twenty tasks are small source/document changes or isolated verification and
review actions. No elapsed-hour estimate or readiness beyond the plan's actual
preflight verdict is implied.

**Execution rule:** mark an implemented task `[~]` immediately with an actual
timestamp. After its stated verification passes, mark it `[x]`, then update the
Progress and Last Updated fields. Resume the first `[~]`, otherwise the first
`[ ]`. Mark a blocker `[!]` with a same-line reason. Only `[x]` counts complete.
Never duplicate task lines in summaries or maintain another progress store.
Use the git-commit skill only at coherent green checkpoints; this repository's
no-push rule and protection of unrelated work remain binding. Expected RED work
may remain uncommitted until the logical green unit is complete.

## Phase 1: Companion Skill and Independent Core-Source Proof

> **Phase baseline tree**: Recorded by exec-plan at phase entry, including existing work.
> **Lenses**: correctness, maintainability, standards, security, api-surface, concurrency
> **Reasoning**: high — independent authoring contexts and identity-bound runtime evidence

### Step 1.1 — Specification Tests and Oracle Review

**Reference:** `03-skill-and-qualification.md` §§Independence/Acceptance;
`07-testing-strategy.md` ST-01–ST-13; AR-S2–AR-S8, AR-S12.

- [ ] 1.1.1 [spec-author] Write `test/developer-skill/package.spec.test.ts` from ST-01–ST-03, including harmless malformed/missing payload controls.
- [ ] 1.1.2 [spec-author] Write the fixed request/vector and public-observation assertions in `test/developer-skill/authoring.spec.test.ts` from ST-05–ST-06/ST-12; no implementation reads.
- [ ] 1.1.3 [spec-author] Add ST-07–ST-09's discriminating controls to the same new spec file without weakening the existing expected answers.
- [ ] 1.1.4 Obtain an independent review of both new oracle files against the ST cases; reviewer must not be their author. Record the bounded disposition in execution notes.
- [ ] 1.1.5 Run directed specs and record explicit absent-payload/application RED assertions; distinguish structural RED from the later semantic controls, never count a loader crash as proof.

**Deliverable:** independent reviewed oracles and honest initial RED evidence;
no payload or authored application exists yet.

**Verify:** directed specification command from the testing strategy; expected
assertion failures are recorded, not labelled a green checkpoint.

### Step 1.2 — Observation, Payload and Fresh Authoring

**Reference:** component §§Payload/Writer Packets/Runtime Observation/Acceptance;
ST-01–ST-12; AR-S3–AR-S10, AR-S12.

- [ ] 1.2.1 Implement the public-build and validated source/global/range mapping portion of `test/developer-skill/qualification-driver.ts` from its planned interface; accept no expected values.
- [ ] 1.2.2 Complete the same driver's fixed-exercise VICE observation and owned `finally` teardown using unchanged M1 helpers; keep the file focused and within project size limits.
- [ ] 1.2.3 Obtain a renewed exclusive emulator window and run the compiled wrong-module and identity controls from ST-07–ST-09; record actual semantic mismatch/Unknown results before genuine authoring.
- [ ] 1.2.4 Copy only the component's answer-free request sections into `examples/developer-skill-qualification/requests.md`; preserve the oracle boundary.
- [ ] 1.2.5 [fresh payload writer] Create `.opencode/skills/blend65-game-developer/SKILL.md` and `references/workflow-and-source.md` using the allowlisted packet, never the plan or grading inputs.
- [ ] 1.2.6 [same payload writer] Create `references/game-systems.md` and `references/evidence-and-boundaries.md`; cover the full guidance table without broader qualification claims.
- [ ] 1.2.7 Obtain independent semantics/DX and security review of the four-file payload; route general corrections to its writer without exposing exercise answers.
- [ ] 1.2.8 Verify native discovery/loading of `blend65-game-developer` and the exact selected payload identity; report any override or permission blocker without changing configuration.
- [ ] 1.2.9 [fresh application author] Load the pinned skill and score request only; write `examples/developer-skill-qualification/score/src/award-math.blend` and `score.blend` without grader/plan/compiler-internal exposure.
- [ ] 1.2.10 [different fresh application author] Load the same pinned skill and patrol request only; write `examples/developer-skill-qualification/patrol/src/patrol.blend` without answers or prior attempts.
- [ ] 1.2.11 Run public check/build and directed specification tests with actual sequential VICE observations; require GREEN for every fixed answer and control, or keep the affected task blocked.

**Deliverable:** the four-file native skill and two genuinely authored application
modules, observed through the public compiler and existing execution facilities.
Structural, native, source and runtime endpoints remain separately recorded.

**Verify:** directed specs, native load/content check and actual fresh-context
dispatch records. No silent fallback, oracle edit or stand-in author is allowed.

### Step 1.3 — Implementation Tests and Hardening

**Reference:** component §§Result/Refresh/Failure; ST-08–ST-13; AR-S8–AR-S12.

- [ ] 1.3.1 Write `test/developer-skill/qualification-driver.impl.test.ts` for actual field/location/path and cleanup failure boundaries with harmless owned fixtures; no new validator framework.
- [ ] 1.3.2 Obtain final independent correctness, source-semantics and applicable platform review of the complete phase diff, actual new oracles/applications and claimed endpoints; resolve findings through the normal ruling gate.
- [ ] 1.3.3 Run locked install, build, typecheck, complete owned tests and exact touched-file formatting with coordinated sequential emulator ownership; record full results and remaining skips honestly.
- [ ] 1.3.4 Write `examples/developer-skill-qualification/qualification.md`, bind exact native/author/compiler/input/artifact identities and coverage limits, and record this slice's closeout/reopening obligations without closing the full RD.

**Deliverable:** reviewed, verified and identity-bound skill-slice evidence;
complete Slither and any unproved capability remain explicitly open.

**Verify:** helper hardening plus full checkpoint commands in the testing strategy;
source/identity and exposure review of the final record. Clean owned temporary
artifacts before reporting the slice complete.

## Dependencies and Stop Conditions

The steps above are sequential. Payload authoring waits for independent oracle
review and semantic controls. Application authors wait for reviewed native
payload identity. Full verification waits for actual runtime GREEN and relevant
reviews. New findings return to the normal user ruling gate; unavailable public
compiler behavior returns to its existing owner, not a source workaround.

If the payload or request changes, follow the component's refresh rules before
crediting old exercise results. If no meaningful exercise subset can be proved,
stop without declaring the skill qualified. Slither's blocked full-port plan is
not silently implemented by any task here.

## Success Boundary

All twenty marks must be verified complete, the precise skill subset must satisfy
its ST/workflow endpoints, and all required reviews/checks must pass. The feature
roadmap may report the skill milestone while retaining full-port ownership and
the RD's incomplete count. No general compiler, engine, expert-parity, other-profile,
native release-host or physical-hardware qualification follows.
